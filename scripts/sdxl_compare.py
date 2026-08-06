"""No-LoRA comparison: same forest/desert prompts as scripts/lora_sweep.py,
run on a plain SDXL anime/illustration checkpoint (Animagine XL 4.0 opt)
with a detailed natural-language style description instead of a trained
LoRA, to see whether prompt engineering alone gets consistency comparable
to (or better than) the rbkstyle LoRA.

Usage:
    python scripts/sdxl_compare.py
"""
import os
import json
import time
import uuid
import shutil
import urllib.request

COMFY_URL = "http://127.0.0.1:8188"
CHECKPOINT = "animagine-xl-4.0-opt.safetensors"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
COMFY_OUTPUT = r"C:\Users\SS\ComfyUI_windows_portable\ComfyUI\output"
OUT_DIR = os.path.join(ROOT, "raw", "sprites", "sweep_sdxl")

# Detailed natural-language style description standing in for the LoRA,
# plus Animagine-recommended quality tags (this checkpoint responds well
# to them specifically).
STYLE_DESCRIPTION = (
    "masterpiece, best quality, very aesthetic, absurdres, chibi pixel art "
    "game sprite, thick clean black outline, large glossy expressive eyes "
    "with bright highlight, flat cel-shaded colors with visible pixel "
    "dithering texture, sticker-like white border around the character, "
    "flat solid-color background, no scenery, no props, centered "
    "composition, front view, full body, standing pose"
)
NEGATIVE = (
    "lowres, bad anatomy, bad hands, text, error, missing finger, extra "
    "digits, fewer digits, cropped, worst quality, low quality, normal "
    "quality, jpeg artifacts, signature, watermark, username, blurry, "
    "realistic, photo, 3d render, human, humanoid face, scenery, multiple "
    "characters, complex background, gradient background"
)

PROMPTS = {
    "forest": (
        f"{STYLE_DESCRIPTION}, a single cute round forest creature, "
        "leaf-shaped ears, moss green fur with darker patches, small twig "
        "antlers, big friendly eyes",
        500,
    ),
    "desert": (
        f"{STYLE_DESCRIPTION}, a single cute round desert creature, sandy "
        "tan fur, small cactus-spike ridge on its back, big friendly eyes",
        501,
    ),
}


def build_workflow(prompt, negative, seed, width=1024, height=1024):
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 30,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "sdxl_compare", "images": ["8", 0]}},
    }


def run_prompt(workflow):
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    prompt_id = result["prompt_id"]

    for _ in range(600):
        with urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}") as resp:
            history = json.loads(resp.read())
        if prompt_id in history:
            outputs = history[prompt_id]["outputs"]
            for node_out in outputs.values():
                for img in node_out.get("images", []):
                    return img["filename"]
        time.sleep(3)
    raise TimeoutError("generation did not finish in time")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for biome, (prompt, seed) in PROMPTS.items():
        print(f"generating {biome} (SDXL, no LoRA) ...", flush=True)
        workflow = build_workflow(prompt, NEGATIVE, seed)
        fname = run_prompt(workflow)
        out_path = os.path.join(OUT_DIR, f"{biome}_sdxl_noLora.png")
        shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
        print("  saved", out_path, flush=True)
    print("DONE", flush=True)
