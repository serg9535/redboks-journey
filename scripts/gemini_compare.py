"""No-LoRA comparison via Google Gemini ("Nano Banana" / gemini-2.5-flash-image):
two modes, same forest/desert prompts as scripts/lora_sweep.py and
scripts/sdxl_compare.py for an apples-to-apples comparison.

  1. text-only: same detailed style description as the SDXL test, no image input.
  2. reference: feeds an existing project sprite as a style-anchor image, the
     technique the research consistently recommends for Gemini ("...same
     style as the reference image...") instead of training anything.

Requires GEMINI_API_KEY in the environment or in .env next to this script's
project root.

Usage:
    python scripts/gemini_compare.py
"""
import os
import re
import json
import base64
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
OUT_DIR = os.path.join(ROOT, "raw", "sprites", "sweep_gemini")
REF_IMAGE = os.path.join(ROOT, "public", "assets", "sprites", "forest_00.png")

MODEL = "gemini-2.5-flash-image"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

STYLE_DESCRIPTION = (
    "chibi pixel art game sprite, thick clean black outline, large glossy "
    "expressive eyes with bright highlight, flat cel-shaded colors with "
    "visible pixel dithering texture, sticker-like white border around the "
    "character, flat solid-color background, no scenery, no props, "
    "centered composition, front view, full body, standing pose"
)

PROMPTS = {
    "forest": (
        "a single cute round forest creature, leaf-shaped ears, moss green "
        "fur with darker patches, small twig antlers, big friendly eyes"
    ),
    "desert": (
        "a single cute round desert creature, sandy tan fur, small "
        "cactus-spike ridge on its back, big friendly eyes"
    ),
}


def load_api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    env_path = os.path.join(ROOT, ".env")
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            m = re.search(r"^GEMINI_API_KEY=(.+)$", f.read(), re.MULTILINE)
            if m:
                return m.group(1).strip()
    raise RuntimeError("Set GEMINI_API_KEY env var or add it to .env")


def call_gemini(api_key, parts):
    payload = json.dumps({
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL}?key={api_key}",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    for cand in result.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "inlineData" in part:
                return base64.b64decode(part["inlineData"]["data"])
    raise RuntimeError(f"no image in response: {json.dumps(result)[:500]}")


def main():
    api_key = load_api_key()
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(REF_IMAGE, "rb") as f:
        ref_b64 = base64.b64encode(f.read()).decode("ascii")

    for biome, subject in PROMPTS.items():
        # mode 1: text-only, detailed style description (same spirit as the SDXL test)
        print(f"generating {biome} (Gemini, text-only style description) ...", flush=True)
        prompt = f"{STYLE_DESCRIPTION}, {subject}"
        img_bytes = call_gemini(api_key, [{"text": prompt}])
        out_path = os.path.join(OUT_DIR, f"{biome}_gemini_text.png")
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print("  saved", out_path, flush=True)

        # mode 2: reference-image style anchor (the technique the research recommends)
        print(f"generating {biome} (Gemini, reference-image style anchor) ...", flush=True)
        ref_prompt = (
            f"Using the exact same art style as the attached reference image "
            f"(same outline, shading, eyes, proportions, and background "
            f"treatment), draw {subject}. Keep the same style but a "
            f"different creature."
        )
        img_bytes = call_gemini(api_key, [
            {"inline_data": {"mime_type": "image/png", "data": ref_b64}},
            {"text": ref_prompt},
        ])
        out_path = os.path.join(OUT_DIR, f"{biome}_gemini_ref.png")
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print("  saved", out_path, flush=True)

    print("DONE", flush=True)


if __name__ == "__main__":
    main()
