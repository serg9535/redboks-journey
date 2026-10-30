"""Generates the monster set + background for a new battle biome via the local
ComfyUI + rbkstyle LoRA (see game/CLAUDE.md), one creature per generation,
auto-cropped to transparent PNGs straight into public/assets/sprites/.

Biomes are described in BIOMES below: sprite order == word order in
src/data/vocab.js. Re-run a single sprite with another seed if it came out
wrong, e.g.:

    python scripts/generate_biome.py farm
    python scripts/generate_biome.py farm --only 2 --seed 777
    python scripts/generate_biome.py farm --background-only

Requires ComfyUI running at http://127.0.0.1:8188.
"""
import argparse
import os
import shutil
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from generate_comfyui import COMFY_OUTPUT, run_prompt  # noqa: E402
from crop_transparent import crop_auto  # noqa: E402

ROOT = os.path.join(SCRIPT_DIR, "..")

STYLE_LOCK = (
    "rbkstyle, chibi pixel art creature, thick clean outline, large "
    "expressive eyes, dark navy background, no_humans"
)
NEGATIVE = (
    "1girl, girl, woman, human, humanoid face, human face, hair, ponytail, "
    "heart, skirt, anime girl, realistic, photo, 3d render, "
    "complex background, scenery, multiple characters, text, watermark, "
    "logo, signature, blurry, low quality, deformed, extra limbs, cropped"
)
BG_NEGATIVE = (
    "character, creature, animal, person, face, eyes, text, watermark, logo, "
    "signature, blurry, low quality, 3d render, photo"
)

# Базовая детская лексика (животные, еда, зима, дом) — как «милые существа»
# в стиле игры: LoRA всё равно тянет к круглым зверушкам, и это нам на руку.
BIOMES = {
    "farm": {
        "seed": 4100,
        "creatures": [
            "a single cute round kitten creature, orange tabby fur, pointy cat ears, whiskers, tiny pink nose",
            ("a single cute round puppy dog creature, light brown fur all over body, long brown floppy ears hanging down, big black dog nose, wagging tail", "rabbit, bunny, white fur, long upright ears"),
            ("a single cute round cow creature, white body covered with big black spots, two small yellow horns, wide pink muzzle with nostrils, golden cow bell on neck", "panda, bear"),
            "a single cute round piglet creature, pink skin, round snout with two nostrils, curly tail, small ears",
            ("a single cute round yellow duck creature, bright yellow feathers all over the body, big flat orange duck bill, small yellow wings, orange webbed feet", "penguin, black feathers, navy, two characters"),
            "a single cute round pony creature, brown horse with dark mane, long horse face, small hooves",
        ],
        "background": (
            "rbkstyle, top-down view pixel art background texture, farm yard ground, "
            "green grass patches and brown dirt paths, small hay piles, wooden fence pieces, "
            "flat saturated colors, game map tile texture, no characters, no text"
        ),
    },
    "food": {
        "seed": 4200,
        "creatures": [
            "a single cute round red apple creature, shiny red apple body with a green leaf on top, tiny arms and legs",
            ("a single cute banana creature, long curved crescent-shaped yellow banana fruit body, brown stem tip on top, tiny arms and legs", "round, ball, blob, lemon, slime"),
            "a single cute egg creature, white oval egg body with a little crack, tiny arms and legs",
            "a single cute milk carton creature, white and blue milk box body, tiny arms and legs",
            "a single cute round cake creature, pink frosting with a cherry on top, strawberry cake body, tiny arms and legs",
            ("a single cute carrot creature, long pointy orange carrot root body shaped like a cone, bushy green leaves on top, tiny arms and legs", "round, ball, orange fruit, pumpkin, slime"),
        ],
        "background": (
            "rbkstyle, top-down view pixel art background texture, kitchen floor, "
            "checkered cream and warm orange tiles, a few crumbs, flat saturated colors, "
            "game map tile texture, no characters, no text"
        ),
    },
    "winter": {
        "seed": 4300,
        "creatures": [
            "a single cute snowman creature, two white snowballs, carrot nose, small stick arms, red scarf",
            "a single cute round penguin creature, black and white feathers, orange beak and feet",
            ("a single cute snowflake creature, flat white six-pointed star shaped ice crystal body, face in the center", "slime, blob, ball, round body, animal"),
            "a single cute round polar bear cub creature, white fluffy fur, black nose, round ears",
            "a single cute ice cube creature, light blue transparent ice block body, tiny arms and legs",
            "a single cute round fox creature, white arctic fox fur, fluffy tail, pointy ears",
        ],
        "background": (
            "rbkstyle, top-down view pixel art background texture, snowy winter ground, "
            "white snow with light blue shadows, small ice patches and pebbles, flat colors, "
            "game map tile texture, no characters, no text"
        ),
    },
    # Цвета — одинаковые слаймы разного цвета: картинка не мешает узнать именно цвет.
    "colors": {
        "seed": 4500,
        "creatures": [
            ("a single cute round slime creature, bright red glossy jelly body, solid red color", "blue, green, yellow"),
            ("a single cute round slime creature, bright blue glossy jelly body, solid blue color", "red, green, yellow"),
            ("a single cute round slime creature, bright green glossy jelly body, solid green color", "red, blue, yellow"),
            ("a single cute round slime creature, bright yellow glossy jelly body, solid yellow color", "red, blue, green"),
            ("a single cute round slime creature, bright purple glossy jelly body, solid purple color", "red, green, yellow"),
            ("a single cute round slime creature, bright orange glossy jelly body, solid orange color", "blue, green, purple"),
        ],
        "background": (
            "rbkstyle, top-down view pixel art background texture, magical rainbow meadow ground, "
            "soft pastel grass with rainbow colored flower patches, flat saturated colors, "
            "game map tile texture, no characters, no text"
        ),
    },
    "home": {
        "seed": 4400,
        "creatures": [
            ("a single cute beach ball creature, round toy ball with red, yellow and blue stripes, tiny arms and legs", "slime, animal"),
            "a single cute cup creature, blue tea cup with a handle, tiny arms and legs",
            ("a single cute small bed creature, rectangular wooden bed frame with a blue blanket and a white pillow, face on the headboard", "animal, cat ears, slime, blob"),
            ("a single cute table lamp creature, yellow cone-shaped lampshade on a thin stand, glowing light bulb, face on the lampshade", "animal, slime, blob, ball"),
            ("a single cute book creature, rectangular red hardcover book with white pages, face on the cover", "animal, slime, blob, round"),
            ("a single cute wooden chair creature, four wooden legs, square seat and backrest, face on the backrest", "animal, horns, slime, blob"),
        ],
        "background": (
            "rbkstyle, top-down view pixel art background texture, cozy house floor, "
            "warm wooden floor planks and a soft round rug, flat saturated colors, "
            "game map tile texture, no characters, no text"
        ),
    },
}


def render_raw(desc, seed, extra_negative, raw_path):
    prompt = f"{STYLE_LOCK}, {desc}, front view, standing pose, full body"
    negative = f"{NEGATIVE}, {extra_negative}" if extra_negative else NEGATIVE
    fname = run_prompt(prompt, negative, seed=seed)
    os.makedirs(os.path.dirname(raw_path), exist_ok=True)
    shutil.copy(os.path.join(COMFY_OUTPUT, fname), raw_path)


def install_sprite(biome, index, raw_path):
    out_path = os.path.join(ROOT, "public", "assets", "sprites", f"{biome}_{index:02d}.png")
    tol, share = crop_auto(raw_path, out_path)
    print(f"saved {out_path} (crop tol {tol}, subject {share:.0%})", flush=True)


def generate_creature(biome, index, desc, seed, extra_negative=""):
    raw_path = os.path.join(ROOT, "raw", "sprites", f"{biome}_individual", f"{biome}_{index:02d}.png")
    render_raw(desc, seed, extra_negative, raw_path)
    install_sprite(biome, index, raw_path)


def candidate_path(biome, index, seed):
    return os.path.join(ROOT, "raw", "sprites", f"{biome}_candidates", f"{biome}_{index:02d}_s{seed}.png")


def generate_variants(biome, index, desc, extra_negative, seeds):
    """Несколько вариантов одного существа + лист с номерами seed, чтобы
    выбрать глазами и поставить нужный через --pick <seed>."""
    from PIL import Image, ImageDraw

    tiles = []
    for seed in seeds:
        path = candidate_path(biome, index, seed)
        render_raw(desc, seed, extra_negative, path)
        im = Image.open(path).convert("RGB")
        im.thumbnail((256, 256))
        ImageDraw.Draw(im).text((6, 6), str(seed), fill=(255, 255, 0))
        tiles.append(im)
    sheet = Image.new("RGB", (256 * len(tiles), 256))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 256, 0))
    sheet_path = os.path.join(ROOT, "raw", "sprites", f"{biome}_candidates", f"{biome}_{index:02d}_sheet.jpg")
    sheet.save(sheet_path)
    print("sheet", sheet_path, flush=True)


def generate_background(biome, prompt, seed):
    fname = run_prompt(prompt, BG_NEGATIVE, seed=seed)
    out_path = os.path.join(ROOT, "public", "assets", "backgrounds", f"background_{biome}.png")
    shutil.copy(os.path.join(COMFY_OUTPUT, fname), out_path)
    print("saved", out_path, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("biome", choices=sorted(BIOMES))
    parser.add_argument("--only", type=int, help="regenerate one creature by index")
    parser.add_argument("--seed", type=int, help="override seed (with --only)")
    parser.add_argument("--background-only", action="store_true")
    parser.add_argument("--variants", type=int, help="with --only: render N candidates + a contact sheet")
    parser.add_argument("--pick", type=int, help="with --only: install the candidate with this seed")
    args = parser.parse_args()

    cfg = BIOMES[args.biome]
    if args.only is not None and (args.variants or args.pick is not None):
        entry = cfg["creatures"][args.only]
        desc, extra_negative = entry if isinstance(entry, tuple) else (entry, "")
        if args.pick is not None:
            install_sprite(args.biome, args.only, candidate_path(args.biome, args.only, args.pick))
        else:
            base = args.seed if args.seed is not None else cfg["seed"] + 1000 + args.only * 10
            generate_variants(args.biome, args.only, desc, extra_negative, range(base, base + args.variants))
        print("DONE", flush=True)
        sys.exit(0)
    if not args.background_only:
        for i, entry in enumerate(cfg["creatures"]):
            # запись — строка-описание или (описание, доп. негатив), когда LoRA уводит в другое существо
            desc, extra_negative = entry if isinstance(entry, tuple) else (entry, "")
            if args.only is not None and i != args.only:
                continue
            seed = args.seed if args.seed is not None else cfg["seed"] + i
            print(f"generating {args.biome}_{i:02d} (seed {seed})...", flush=True)
            generate_creature(args.biome, i, desc, seed, extra_negative)
    if args.only is None:
        print("generating background...", flush=True)
        generate_background(args.biome, cfg["background"], cfg["seed"] + 99)
    print("DONE", flush=True)
