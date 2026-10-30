"""Side-by-side comparison of several LoRA files on the same prompts and seeds.

Rows = prompts (a creature to check the style didn't regress, Redbok's back view, objects, a
background), columns = LoRA files. Reuses the workflow from lora_sweep.py. Needs ComfyUI running.

    python scripts/lora_compare.py rbkstyle.safetensors rbkstyle_v5.safetensors [...]
Output: raw/sprites/lora_compare/<lora>_<prompt>.png + grid.png
"""
import os
import sys
import shutil
from PIL import Image, ImageDraw

import lora_sweep
from lora_sweep import COMFY_OUTPUT, NEGATIVE, ROOT, STYLE_LOCK, build_workflow, run_prompt

OUT_DIR = os.path.join(ROOT, "raw", "sprites", "lora_compare")
STRENGTH = 0.5
BACK_STYLE = "rbkstyle, chibi pixel art creature, thick clean outline, dark navy background, no_humans"

PROMPTS = {
    "forest": (f"{STYLE_LOCK}, a single cute round forest creature, leaf-shaped ears, moss green fur, small twig antlers, front view, standing pose, full body", 500),
    "back": (f"{BACK_STYLE}, green and red tomato character, back view, walking away, no face visible, full body", 502),
    "cup": (f"{STYLE_LOCK}, red tea cup object with a cute face, single object, full view", 503),
    "lamp": (f"{STYLE_LOCK}, yellow table lamp object with a cute face, single object, full view", 504),
    "chair": (f"{STYLE_LOCK}, wooden chair object with a cute face, single object, full view", 505),
    "bg": ("rbkstyle, snowy ground, snow drifts with frozen ice patches and snowy bushes, seamless top-down game background texture, thick clean outlines, flat colors with pixel dithering texture, no characters", 506),
}


if __name__ == "__main__":
    loras = sys.argv[1:]
    os.makedirs(OUT_DIR, exist_ok=True)
    cells = {}
    for lora in loras:
        lora_sweep.LORA_NAME = lora  # build_workflow reads the module global
        for name, (prompt, seed) in PROMPTS.items():
            negative = NEGATIVE + (", face, eyes, mouth" if name == "back" else "")
            fname = run_prompt(build_workflow(prompt, negative, seed, STRENGTH, "dpmpp_2m", "karras", 7.5))
            out = os.path.join(OUT_DIR, f"{lora.replace('.safetensors', '')}_{name}.png")
            shutil.copy(os.path.join(COMFY_OUTPUT, fname), out)
            cells[(lora, name)] = out
            print("saved", out, flush=True)
    S = 256
    grid = Image.new("RGB", (S * len(loras), S * len(PROMPTS) + 24), (30, 30, 30))
    d = ImageDraw.Draw(grid)
    for c, lora in enumerate(loras):
        d.text((c * S + 6, 6), lora, fill=(255, 255, 255))
        for r, name in enumerate(PROMPTS):
            grid.paste(Image.open(cells[(lora, name)]).convert("RGB").resize((S, S)), (c * S, 24 + r * S))
    grid.save(os.path.join(OUT_DIR, "grid.png"))
    print("DONE", os.path.join(OUT_DIR, "grid.png"))
