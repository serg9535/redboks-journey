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
BACKGROUNDS_DIR = os.path.join(ROOT, "public", "assets", "backgrounds")

BACKGROUND_CAPTIONS = {
    "background_forest": "forest ground, green grass with mushrooms and tree roots",
    "background_meadow": "flower meadow ground, sunflowers in a radial pattern",
    "background_desert": "desert ground, sand with cacti and rocks",
    "background_cave": "cave ground, mossy stone with glowing crystals",
    "background_ocean": "ocean floor, coral and seaweed with bubbles",
    "background_village": "village path ground, grass and dirt path with flowers",
    "background_robots": "sci-fi robot workshop floor, metal panels with glowing circuit lines",
    "background_farm": "farm yard ground, grass with dirt patches, hay and small wooden fences",
    "background_colors": "rainbow meadow ground, grass patches tinted in all rainbow colors with flowers",
    "background_food": "picnic meadow ground, grass with red checkered blankets and berries",
    "background_winter": "snowy ground, snow drifts with frozen ice patches and snowy bushes",
    "background_home": "cozy house floor, wooden planks with round rugs and toy blocks",
}

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
    "farm_00": "orange cat creature",
    "farm_01": "puppy dog creature",
    "farm_02": "black and white spotted cow creature",
    "farm_03": "pink pig creature",
    "farm_04": "yellow duckling creature",
    "farm_05": "brown horse creature",
    "colors_00": "red slime creature",
    "colors_01": "blue slime creature",
    "colors_02": "green slime creature",
    "colors_03": "yellow slime creature",
    "colors_04": "purple slime creature",
    "colors_05": "orange slime creature",
    "food_00": "red apple object with a cute face",
    "food_01": "yellow banana object with a cute face",
    "food_02": "white egg creature",
    "food_03": "milk carton object with a cute face",
    "food_04": "pink cake creature",
    "food_05": "orange carrot object with a cute face",
    "winter_00": "snowman creature",
    "winter_01": "penguin creature",
    "winter_02": "ice snowflake object with a cute face",
    "winter_03": "white polar bear creature",
    "winter_04": "blue ice cube slime creature",
    "winter_05": "white arctic fox creature",
    "home_00": "colorful beach ball object with a cute face",
    "home_01": "red tea cup object with a cute face",
    "home_02": "wooden bed object with a cute face",
    "home_03": "yellow table lamp object with a cute face",
    "home_04": "red book object with a cute face",
    "home_05": "wooden chair object with a cute face",
    "npc_bee": "bee creature",
    "npc_butterfly": "butterfly creature",
    "npc_elder": "mossy stone elder creature",
    "npc_merchant": "round merchant creature",
    "npc_rabbit": "lavender bunny creature",
    "npc_teacher": "stone teacher creature with glasses",
}


def caption_for(name):
    if name in WORD_CAPTIONS:
        return WORD_CAPTIONS[name]
    if name.startswith("redbok_back_walk"):
        return "green and red tomato character, back view, walking away, no face visible"
    if name.startswith("redbok_back"):
        return "green and red tomato character, back view, no face visible"
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
        sources.append((os.path.join(EXISTING_SPRITES_DIR, fname), name, "sprite"))
    for fname in os.listdir(REFGRID_DIR):
        if not fname.endswith(".png"):
            continue
        name = fname[:-4]
        sources.append((os.path.join(REFGRID_DIR, fname), name, "sprite"))
    for fname in os.listdir(BACKGROUNDS_DIR):
        if not fname.endswith(".png"):
            continue
        name = fname[:-4]
        sources.append((os.path.join(BACKGROUNDS_DIR, fname), name, "background"))
    return sources


if __name__ == "__main__":
    # optional: python scripts/prepare_lora_dataset.py <out_dir> — build a fresh dataset next to
    # the old one instead of overwriting raw/lora_dataset/10_rbkstyle (stale files would stay there)
    import sys
    if len(sys.argv) > 1:
        OUT_DIR = sys.argv[1]
    os.makedirs(OUT_DIR, exist_ok=True)
    sources = collect_sources()
    print(f"found {len(sources)} source images")

    for path, name, kind in sources:
        im = Image.open(path)
        out_path = os.path.join(OUT_DIR, f"{name}.png")
        if kind == "background":
            im.convert("RGB").resize((CANVAS, CANVAS), Image.LANCZOS).save(out_path)
            caption = f"{TRIGGER}, {BACKGROUND_CAPTIONS[name]}, seamless top-down game background texture, thick clean outlines, flat colors with pixel dithering texture, no characters"
        else:
            flatten_and_pad(im).save(out_path)
            subject = caption_for(name)
            # "large expressive eyes" on a back view would teach the model the opposite of the subject
            eyes = "" if "back view" in subject else " large expressive eyes,"
            caption = f"{TRIGGER}, {subject}, chibi pixel art creature, thick clean outline,{eyes} dark navy background"
        with open(os.path.join(OUT_DIR, f"{name}.txt"), "w") as f:
            f.write(caption)

    print(f"dataset ready: {OUT_DIR} ({len(sources)} image/caption pairs)")
