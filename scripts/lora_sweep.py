"""Parameter sweep for the rbkstyle LoRA: varies lora_strength and
sampler/CFG on two reference prompts (forest monster, desert monster) to
find a more consistent setting than the current default (0.7, dpmpp_2m,
cfg 7.5). Same seed per prompt across all variants for a fair comparison.

Usage:
    python scripts/lora_sweep.py
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

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
COMFY_OUTPUT = r"C:\Users\SS\ComfyUI_windows_portable\ComfyUI\output"
OUT_DIR = os.path.join(ROOT, "raw", "sprites", "sweep_lora")

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

PROMPTS = {
    "forest": (
        f"{STYLE_LOCK}, a single cute round forest creature, leaf-shaped "
        "ears, moss green fur with darker patches, small twig antlers, "
        "big friendly eyes, front view, standing pose, full body",
        500,
    ),
    "desert": (
        f"{STYLE_LOCK}, a single cute round desert creature, sandy tan fur, "
        "small cactus-spike ridge on its back, big friendly eyes, front "
        "view, standing pose, full body",
        501,
    ),
}

# (label, lora_strength, sampler_name, scheduler, cfg)
STRENGTH_SWEEP = [
    ("str0.40", 0.40, "dpmpp_2m", "karras", 7.5),
    ("str0.55", 0.55, "dpmpp_2m", "karras", 7.5),
    ("str0.70", 0.70, "dpmpp_2m", "karras", 7.5),  # current default
    ("str0.85", 0.85, "dpmpp_2m", "karras", 7.5),
]
SAMPLER_SWEEP = [
    ("euler_cfg6", 0.70, "euler", "normal", 6.0),
    ("dpmpp2m_cfg9", 0.70, "dpmpp_2m", "karras", 9.0),
    ("dpmpp_sde_cfg7.5", 0.70, "dpmpp_sde", "karras", 7.5),
]
ALL_VARIANTS = STRENGTH_SWEEP + SAMPLER_SWEEP


def build_workflow(prompt, negative, seed, lora_strength, sampler_name, scheduler, cfg, width=512, height=512):
    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 22,
                "cfg": cfg,
                "sampler_name": sampler_name,
                "scheduler": scheduler,
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
                "strength_model": lora_strength,
                "strength_clip": lora_strength,
            },
        },
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["12", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["12", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "sweep", "images": ["8", 0]}},
    }


def run_prompt(workflow):
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    prompt_id = result["prompt_id"]

    for _ in range(180):
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
    total = len(PROMPTS) * len(ALL_VARIANTS)
    done = 0
    for biome, (prompt, seed) in PROMPTS.items():
        for label, strength, sampler_name, scheduler, cfg in ALL_VARIANTS:
            done += 1
            print(f"[{done}/{total}] {biome} / {label} ...", flush=True)
            workflow = build_workflow(prompt, NEGATIVE, seed, strength, sampler_name, scheduler, cfg)
            fname = run_prompt(workflow)
            out_path = os.path.join(OUT_DIR, f"{biome}_{label}.png")
            shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
            print("  saved", out_path, flush=True)
    print("DONE", flush=True)
