"""One-off test: compare rbkstyle_v4 against production rbkstyle on
background-texture and character prompts, to check whether the fixed
caption_extension actually taught the LoRA the background concept.

Usage:
    python scripts/test_lora_v4.py
"""
import os
import json
import time
import uuid
import shutil
import urllib.request

COMFY_URL = "http://127.0.0.1:8188"
CHECKPOINT = "anything-v5.safetensors"
COMFY_OUTPUT = r"C:\Users\SS\ComfyUI_windows_portable\ComfyUI\output"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
OUT_DIR = os.path.join(ROOT, "raw", "sprites", "v4test")

NEGATIVE = (
    "1girl, girl, woman, human, humanoid face, human face, hair, realistic, "
    "photo, 3d render, text, watermark, logo, signature, blurry, low "
    "quality, deformed"
)

CASES = [
    ("bg_desert", "rbkstyle, seamless top-down game background texture, desert ground with sand and cacti, no characters, no creatures"),
    ("bg_village", "rbkstyle, seamless top-down game background texture, village path ground with grass dirt and flowers, no characters, no creatures"),
    ("creature_forest", "rbkstyle, a single cute round forest creature, leaf-shaped ears, moss green fur, big friendly eyes, chibi pixel art creature, thick clean outline, dark navy background"),
]


def build_workflow(lora_name, strength, prompt, negative, seed, width=512, height=512):
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": 22, "cfg": 7.5,
                "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
                "model": ["12", 0], "positive": ["6", 0], "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "12": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["4", 0], "clip": ["4", 1], "lora_name": lora_name,
                "strength_model": strength, "strength_clip": strength,
            },
        },
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["12", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["12", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "v4test", "images": ["8", 0]}},
    }


def run_prompt(lora_name, strength, prompt_text, negative_text, seed):
    workflow = build_workflow(lora_name, strength, prompt_text, negative_text, seed)
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    prompt_id = result["prompt_id"]
    print("queued", prompt_id, lora_name, strength)

    for _ in range(300):
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
    os.makedirs(OUT_DIR, exist_ok=True)
    for lora_name, strength in [("rbkstyle.safetensors", 0.45), ("rbkstyle_v4.safetensors", 0.45)]:
        tag = "v1" if "v4" not in lora_name else "v4"
        for i, (name, prompt) in enumerate(CASES):
            print(f"generating {tag}_{name} ...")
            fname = run_prompt(lora_name, strength, prompt, NEGATIVE, seed=200 + i)
            out_path = os.path.join(OUT_DIR, f"{tag}_{name}.png")
            shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
            print("saved", out_path)

    print("DONE")
