"""Generates individual robot-character images + a background for a new biome
via a local ComfyUI server (http://127.0.0.1:8188). One character per
generation (SD1.5-family models handle single-subject prompts far more
reliably than multi-panel grid sheets), then each is auto-cropped to a
transparent PNG the same way scripts/slice_sprites.py does for grid sheets.

Usage:
    python scripts/generate_comfyui.py
"""
import os
import json
import time
import uuid
import shutil
import urllib.request

COMFY_URL = "http://127.0.0.1:8188"
CHECKPOINT = "anything-v5.safetensors"
LORA_NAME = "rbkstyle.safetensors"
LORA_STRENGTH = 0.45  # see scripts/lora_sweep.py comparison — 0.7 let extra
# background objects (bushes/cacti) leak into scenes despite the negative
# prompt; 0.4-0.55 kept clean flat backgrounds with equally strong style

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
COMFY_OUTPUT = r"C:\Users\SS\ComfyUI_windows_portable\ComfyUI\output"

# style now comes from the rbkstyle LoRA trained on our own sprite set;
# keep the prompt focused on subject + a light style nudge as backup
STYLE_LOCK = (
    "rbkstyle, chibi pixel art creature, thick clean outline, large "
    "expressive eyes, dark navy background, no_humans, mecha, machine, "
    "non-humanoid robot"
)
NEGATIVE = (
    "1girl, girl, woman, human, humanoid face, human face, hair, ponytail, "
    "cat ears, heart, bow, skirt, anime girl, realistic, photo, 3d render, "
    "complex background, scenery, multiple characters, text, watermark, "
    "logo, signature, blurry, low quality, deformed, extra limbs, cropped"
)

METAL = "made of metal, metallic plating with visible panel seams and rivets, mechanical joints"
ROBOTS = [
    ("scout-bot", f"small round toy robot on two wheels, {METAL}, a thin antenna with a glowing tip on its head, glowing blue visor instead of eyes, silver and blue"),
    ("guard-bot", f"blocky toy robot, {METAL}, holding a shield-shaped metal arm, glowing red visor, red and grey"),
    ("drone-bot", f"small hovering toy robot, {METAL}, tiny mechanical propeller wings on its back, glowing cyan visor, light blue"),
    ("spider-bot", f"small toy robot, {METAL}, standing on four short mechanical legs, glowing purple visor, purple and black"),
    ("rocket-bot", f"toy robot, {METAL}, rocket boosters bolted onto its back, glowing orange visor, orange and yellow"),
    ("laser-bot", f"toy robot, {METAL}, a laser-cannon barrel instead of one arm, glowing green visor, green and silver"),
]

BACKGROUND_PROMPT = (
    "rbkstyle, seamless tileable pixel art background texture, techno "
    "sci-fi planet floor, metallic panels with glowing neon circuit-line "
    "seams, dark navy and cyan purple neon accents, flat saturated colors, "
    "no characters, no text"
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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "redbok", "images": ["8", 0]}},
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

    for _ in range(1800):
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
    individuals_dir = os.path.join(ROOT, "raw", "sprites", "robots_individual")
    bg_dir = os.path.join(ROOT, "raw", "backgrounds")
    os.makedirs(individuals_dir, exist_ok=True)
    os.makedirs(bg_dir, exist_ok=True)

    for i, (name, desc) in enumerate(ROBOTS):
        print(f"generating {name}...")
        prompt = f"{STYLE_LOCK}, a single {desc}, front view, standing pose, full body"
        fname = run_prompt(prompt, NEGATIVE, seed=100 + i)
        out_path = os.path.join(individuals_dir, f"{name}.png")
        shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
        print("saved", out_path)

    print("generating background...")
    fname = run_prompt(BACKGROUND_PROMPT, NEGATIVE, seed=7)
    shutil.copy(os.path.join(COMFY_OUTPUT, fname), os.path.join(bg_dir, "background_robots.png"))
    print("saved background_robots.png")
