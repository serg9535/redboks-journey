"""Item icons (weapons, potions, backpack, map, hammer...) via local ComfyUI + rbkstyle_v5.

v5 draws objects much better than the original LoRA (see lora_compare.py). Fallback for when
Gemini web (gemini_web.mjs, jobs: ../assets/gemini_inbox/jobs_items.json) is unreachable.
Needs ComfyUI running.

    python scripts/generate_items.py                    # all items, seed 900+i
    python scripts/generate_items.py item_bow --variants 4   # candidates -> raw/sprites/items_candidates/
    python scripts/generate_items.py item_bow --pick 1234    # regenerate one with a chosen seed
Output: public/assets/sprites/<name>.png (transparent, cropped).
"""
import os
import sys
import shutil

import lora_sweep
from lora_sweep import COMFY_OUTPUT, ROOT, build_workflow, run_prompt
from crop_transparent import crop_auto

lora_sweep.LORA_NAME = "rbkstyle_v5.safetensors"
STRENGTH = 0.5
STYLE = "rbkstyle, chibi pixel art game item icon, thick clean outline, flat colors with pixel dithering, dark navy background, no_humans"
NEGATIVE = (
    "face, eyes, mouth, creature, character, animal, 1girl, girl, human, hands, realistic, photo, 3d render, "
    "complex background, scenery, multiple objects, text, watermark, blurry, low quality, cropped"
)

ITEMS = {
    "item_sword": "a single toy hero sword with a shiny silver blade, golden crossguard and red handle, diagonal",
    "item_bow": "a single wooden archery bow with a string and one arrow with red feathers",
    "item_wand": "a single magic wand, short purple stick with a glowing yellow star on top, sparkles",
    "item_shield": "a single round wooden shield with a metal rim and a yellow star emblem in the middle",
    "item_key": "a single big old golden key with a round ring handle",
    "item_torch": "a single wooden torch with a bright orange and yellow flame on top",
    "item_potion_red": "a single round glass potion bottle with a cork, filled with bright red liquid",
    "item_potion_blue": "a single round glass potion bottle with a cork, filled with bright blue liquid",
    "item_potion_green": "a single round glass potion bottle with a cork, filled with bright green liquid",
    "item_backpack": "a single small brown leather adventure backpack with a buckle and a front pocket",
    "item_map": "a single old paper treasure map, unrolled, dotted path and a red X mark",
    "item_hammer": "a single big toy mallet hammer with a red head and a wooden handle",
}

SPRITES = os.path.join(ROOT, "public", "assets", "sprites")
CANDIDATES = os.path.join(ROOT, "raw", "sprites", "items_candidates")


def generate(name, seed, dst):
    prompt = f"{STYLE}, {ITEMS[name]}, centered, full view"
    fname = run_prompt(build_workflow(prompt, NEGATIVE, seed, STRENGTH, "dpmpp_2m", "karras", 7.5))
    raw = os.path.join(CANDIDATES, f"{name}_{seed}_raw.png")
    shutil.copy(os.path.join(COMFY_OUTPUT, fname), raw)
    crop_auto(raw, dst)
    print("saved", dst, flush=True)


if __name__ == "__main__":
    os.makedirs(CANDIDATES, exist_ok=True)
    args = sys.argv[1:]
    names = [a for a in args if a in ITEMS] or list(ITEMS)
    if "--variants" in args:
        n = int(args[args.index("--variants") + 1])
        for name in names:
            for k in range(n):
                seed = 900 + 37 * k + list(ITEMS).index(name)
                generate(name, seed, os.path.join(CANDIDATES, f"{name}_{seed}.png"))
    elif "--pick" in args:
        seed = int(args[args.index("--pick") + 1])
        for name in names:
            generate(name, seed, os.path.join(SPRITES, f"{name}.png"))
    else:
        for i, name in enumerate(names):
            generate(name, 900 + i, os.path.join(SPRITES, f"{name}.png"))
