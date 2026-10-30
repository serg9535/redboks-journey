"""Generates the 3 flower-meadow NPCs + meadow background via local ComfyUI,
using the freshly-tuned LoRA strength (0.45 — see scripts/lora_sweep.py) so
this location doubles as a real-content test of that change, not just
another synthetic sweep comparison.

Usage:
    python scripts/generate_meadow.py
"""
import os
import json
import time
import uuid
import shutil
import urllib.request

COMFY_URL = "http://127.0.0.1:8188"
CHECKPOINT = "anything-v5.safetensors"
LORA_NAME = "rbkstyle_v5.safetensors"  # see generate_comfyui.py
LORA_STRENGTH = 0.45

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
COMFY_OUTPUT = r"C:\Users\SS\ComfyUI_windows_portable\ComfyUI\output"

STYLE_LOCK = (
    "rbkstyle, chibi pixel art creature, thick clean outline, large "
    "expressive eyes, dark navy background, no_humans"
)
NEGATIVE = (
    "1girl, girl, woman, human, humanoid face, human face, hair, ponytail, "
    "cat ears, heart, bow, skirt, anime girl, realistic, photo, 3d render, "
    "complex background, scenery, multiple characters, text, watermark, "
    "logo, signature, blurry, low quality, deformed, extra limbs, cropped"
)

NPCS = [
    ("npc_bee", "a single cute round bee creature, fuzzy yellow and black striped body, small transparent wings, tiny antennae, big friendly eyes"),
    ("npc_butterfly", "a single cute round butterfly creature, large colorful patterned wings in pink and orange, small delicate body, big friendly eyes"),
    ("npc_rabbit", "a single cute round rabbit creature, soft white fur, long floppy ears, tiny pink nose, big friendly eyes"),
]

BACKGROUND_PROMPT = (
    "rbkstyle, seamless tileable pixel art background texture, sunny flower "
    "meadow landscape, green grass with scattered colorful flowers, soft "
    "warm daylight, flat saturated colors, no characters, no text"
)


def build_workflow(prompt, negative, seed, width=512, height=512):
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 22,
                "cfg": 7.5,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": ["12", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "12": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["4", 0],
                "clip": ["4", 1],
                "lora_name": LORA_NAME,
                "strength_model": LORA_STRENGTH,
                "strength_clip": LORA_STRENGTH,
            },
        },
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["12", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["12", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "meadow", "images": ["8", 0]}},
    }


def run_prompt(prompt_text, negative_text, seed):
    workflow = build_workflow(prompt_text, negative_text, seed)
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    prompt_id = result["prompt_id"]
    print("queued", prompt_id)

    for _ in range(600):
        with urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}") as resp:
            history = json.loads(resp.read())
        if prompt_id in history:
            outputs = history[prompt_id]["outputs"]
            for node_out in outputs.values():
                for img in node_out.get("images", []):
                    return img["filename"]
        time.sleep(2)
    raise TimeoutError("generation did not finish in time")


if __name__ == "__main__":
    sprites_dir = os.path.join(ROOT, "raw", "sprites", "meadow_individual")
    bg_dir = os.path.join(ROOT, "raw", "backgrounds")
    os.makedirs(sprites_dir, exist_ok=True)
    os.makedirs(bg_dir, exist_ok=True)

    for i, (name, desc) in enumerate(NPCS):
        print(f"generating {name}...", flush=True)
        prompt = f"{STYLE_LOCK}, {desc}, front view, standing pose, full body"
        fname = run_prompt(prompt, NEGATIVE, seed=300 + i)
        out_path = os.path.join(sprites_dir, f"{name}.png")
        shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
        print("saved", out_path, flush=True)

    print("generating background...", flush=True)
    fname = run_prompt(BACKGROUND_PROMPT, NEGATIVE, seed=17)
    shutil.copy(os.path.join(COMFY_OUTPUT, fname), os.path.join(bg_dir, "background_meadow.png"))
    print("saved background_meadow.png", flush=True)
    print("DONE", flush=True)
