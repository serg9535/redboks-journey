"""Assembles a LoRA training dataset from our existing sliced sprites +
the new reference grid, flattened onto the game's navy background and
captioned with a consistent style trigger word.

Output: raw/lora_dataset/10_rbkstyle/*.png + *.txt (kohya sd-scripts layout)

Usage:
    python scripts/prepare_lora_dataset.py
"""
import os
import json
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
BG_COLOR = (10, 14, 39)  # #0a0e27
CANVAS = 512
TRIGGER = "rbkstyle"

OUT_DIR = os.path.join(ROOT, "raw", "lora_dataset", "10_" + TRIGGER)

EXISTING_SPRITES_DIR = os.path.join(ROOT, "public", "assets", "sprites")
REFGRID_DIR = os.path.join(ROOT, "raw", "sprites", "refgrid")

# word captions for our own named sprites (biome_NN -> short subject description)
WORD_CAPTIONS = {
    "forest_00": "green sprout creature",
    "forest_01": "mushroom creature",
    "forest_02": "purple bat creature",
    "forest_03": "walking tree creature",
    "forest_04": "leaf sprite creature",
    "forest_05": "bee creature",
    "forest_06": "berry bush creature",
    "desert_00": "sand golem creature",
    "desert_01": "scorpion creature",
    "desert_02": "sun spirit creature",
    "desert_03": "spiky rock golem creature",
    "desert_04": "cactus creature",
    "desert_05": "tornado golem creature",
    "cave_00": "mossy rock golem creature",
    "cave_01": "purple bat creature",
    "cave_02": "crystal stalactite creature",
    "cave_03": "stone spider creature",
    "cave_04": "cave troll creature",
    "cave_05": "mole digger creature",
    "cave_06": "underground worm creature",
    "ocean_00": "shark creature",
    "ocean_01": "crab creature",
    "ocean_02": "jellyfish creature",
    "ocean_03": "octopus creature",
    "ocean_04": "coral guardian creature",
    "ocean_05": "water spirit fish creature",
    "neutral_00": "green sprout creature",
    "neutral_01": "mushroom creature",
    "neutral_02": "water droplet creature",
    "neutral_03": "mossy rock creature",
    "neutral_04": "fire creature",
    "neutral_05": "cactus creature",
    "neutral_06": "water swirl spirit creature",
    "neutral_07": "acorn creature",
}


def caption_for(name):
    if name in WORD_CAPTIONS:
        return WORD_CAPTIONS[name]
    if name.startswith("redbok_"):
        idx = int(name.split("_")[1])
        if idx <= 3:
            return "green and red tomato character, walking pose"
        if idx <= 7:
            return "green and red tomato character, running pose"
        if idx == 8:
            return "green and red tomato character, hurt pose"
        if idx == 9:
            return "green and red tomato character, defeated pose"
        return "green and red tomato character, victory pose"
    if name.startswith("refgrid_"):
        return "cute monster creature"
    return "cute monster creature"


def flatten_and_pad(im, size=CANVAS, bg=BG_COLOR):
    im = im.convert("RGBA")
    w, h = im.size
    scale = min(size / w, size / h, 1.0) if max(w, h) > size else min(size / w, size / h)
    new_w, new_h = int(w * scale), int(h * scale)
    im = im.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    canvas.alpha_composite(im, ((size - new_w) // 2, (size - new_h) // 2))
    return canvas.convert("RGB")


def collect_sources():
    sources = []
    for fname in os.listdir(EXISTING_SPRITES_DIR):
        if not fname.endswith(".png"):
            continue
        name = fname[:-4]
        sources.append((os.path.join(EXISTING_SPRITES_DIR, fname), name))
    for fname in os.listdir(REFGRID_DIR):
        if not fname.endswith(".png"):
            continue
        name = fname[:-4]
        sources.append((os.path.join(REFGRID_DIR, fname), name))
    return sources


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    sources = collect_sources()
    print(f"found {len(sources)} source images")

    for path, name in sources:
        im = Image.open(path)
        flat = flatten_and_pad(im)
        out_path = os.path.join(OUT_DIR, f"{name}.png")
        flat.save(out_path)
        caption = f"{TRIGGER}, {caption_for(name)}, chibi pixel art creature, thick clean outline, large expressive eyes, dark navy background"
        with open(os.path.join(OUT_DIR, f"{name}.txt"), "w") as f:
            f.write(caption)

    print(f"dataset ready: {OUT_DIR} ({len(sources)} image/caption pairs)")
