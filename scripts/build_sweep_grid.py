"""Builds a labeled comparison grid from raw/sprites/sweep_lora/ (and,
if present, raw/sprites/sweep_sdxl/) for visual side-by-side comparison.

Usage:
    python scripts/build_sweep_grid.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
LORA_DIR = os.path.join(ROOT, "raw", "sprites", "sweep_lora")
SDXL_DIR = os.path.join(ROOT, "raw", "sprites", "sweep_sdxl")
OUT_PATH = os.path.join(ROOT, "raw", "sprites", "comparison_grid.png")

CELL = 220
LABEL_H = 26
ROW_LABEL_W = 90
PAD = 6

LORA_COLUMNS = ["str0.40", "str0.55", "str0.70", "str0.85", "euler_cfg6", "dpmpp2m_cfg9", "dpmpp_sde_cfg7.5"]
SDXL_COLUMNS = ["sdxl_noLora"]
ROWS = ["forest", "desert"]


def load_font(size):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def main():
    columns = LORA_COLUMNS + [c for c in SDXL_COLUMNS if os.path.isdir(SDXL_DIR)]
    font = load_font(13)
    title_font = load_font(15)

    grid_w = ROW_LABEL_W + len(columns) * (CELL + PAD)
    grid_h = 40 + len(ROWS) * (CELL + LABEL_H + PAD)
    canvas = Image.new("RGB", (grid_w, grid_h), (30, 30, 34))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 8), "rbkstyle LoRA sweep (anything-v5 + rbkstyle.safetensors) vs SDXL no-LoRA", fill=(230, 230, 230), font=title_font)

    y0 = 40
    for r, row in enumerate(ROWS):
        y = y0 + r * (CELL + LABEL_H + PAD)
        draw.text((10, y + CELL // 2 - 8), row, fill=(230, 230, 230), font=title_font)
        for c, col in enumerate(columns):
            x = ROW_LABEL_W + c * (CELL + PAD)
            src_dir = LORA_DIR if col in LORA_COLUMNS else SDXL_DIR
            fname = f"{row}_{col}.png"
            path = os.path.join(src_dir, fname)
            if os.path.isfile(path):
                img = Image.open(path).convert("RGB").resize((CELL, CELL))
                canvas.paste(img, (x, y))
            else:
                draw.rectangle([x, y, x + CELL, y + CELL], outline=(90, 90, 90))
                draw.text((x + 10, y + CELL // 2), "missing", fill=(180, 60, 60), font=font)
            draw.text((x + 4, y + CELL + 4), col, fill=(200, 200, 200), font=font)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    canvas.save(OUT_PATH)
    print("saved", OUT_PATH)


if __name__ == "__main__":
    main()
