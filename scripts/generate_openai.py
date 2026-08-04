"""Generates a monster-grid sprite sheet + background for a new biome via
OpenAI Images API (gpt-image-1), matching the existing chibi pixel-art style-lock.

Usage:
    python scripts/generate_openai.py

Requires OPENAI_API_KEY in game/.env (see .env.example).
Requires: pip install requests python-dotenv
"""
import os
import sys
import base64
import requests
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
load_dotenv(os.path.join(ROOT, ".env"))

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("OPENAI_API_KEY not set in game/.env")
    sys.exit(1)

STYLE_LOCK = (
    "cute chibi pixel art, thick clean outlines, large expressive eyes, "
    "rounded soft silhouette, no sharp edges, dark navy background (#0a0e27), "
    "soft cel-shading, saturated flat color palette, oversized head, small "
    "compact body. Negative: no realistic textures, no complex shading, no "
    "thin linework, no scary/aggressive design, no text, no watermark, no logos."
)


def generate_image(prompt, out_path, size="1024x1024"):
    resp = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"model": "gpt-image-1", "prompt": prompt, "size": size, "n": 1},
        timeout=180,
    )
    if resp.status_code >= 400:
        print(resp.status_code, resp.text)
    resp.raise_for_status()
    data = resp.json()["data"][0]
    if "b64_json" in data:
        img_bytes = base64.b64decode(data["b64_json"])
    else:
        img_bytes = requests.get(data["url"], timeout=60).content
    with open(out_path, "wb") as f:
        f.write(img_bytes)
    print("saved", out_path)


MONSTERS_PROMPT = (
    f"{STYLE_LOCK}\n\n"
    "A grid sprite sheet of 6 different friendly toy-robot characters, arranged in "
    "2 rows x 3 columns, evenly spaced, each character fully visible and separated "
    "by clear gaps of plain dark navy background:\n"
    "1. scout-bot: small round wheeled robot with a little antenna\n"
    "2. guard-bot: blocky robot with a shield-shaped arm\n"
    "3. drone-bot: small hovering robot with tiny propeller wings\n"
    "4. spider-bot: small robot with four mechanical legs\n"
    "5. rocket-bot: robot with rocket boosters on its back\n"
    "6. laser-bot: robot with a laser-cannon arm\n"
    "Transformers/toy-robot inspired chibi designs, bright metallic colors "
    "(silver, red, blue, yellow accents), glowing neon eye lights, friendly "
    "smiling expressions (not scary), same proportions and style as a matched set."
)

BACKGROUND_PROMPT = (
    "Seamless tileable pixel-art background texture of a techno sci-fi planet "
    "floor: metallic panels with glowing neon circuit-line seams, dark navy and "
    "cyan/purple neon accents, small dots of light, flat saturated colors, chibi "
    "game background style, no characters, no text, no watermark, evenly lit, "
    "1024x1024."
)

if __name__ == "__main__":
    sprites_dir = os.path.join(ROOT, "raw", "sprites")
    bg_dir = os.path.join(ROOT, "raw", "backgrounds")
    os.makedirs(sprites_dir, exist_ok=True)
    os.makedirs(bg_dir, exist_ok=True)

    generate_image(MONSTERS_PROMPT, os.path.join(sprites_dir, "monsters_robots_biome.png"))
    generate_image(BACKGROUND_PROMPT, os.path.join(bg_dir, "background_robots.png"))
