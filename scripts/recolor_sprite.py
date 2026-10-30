"""Перекрашивает спрайт сдвигом оттенка (HSV): насыщенные пиксели (тело)
получают новый оттенок, а контур, глаза и блики (низкая насыщенность)
остаются как были. Нужен для биома цветов: LoRA упорно рисует слаймов
синими, а одинаковое существо разного цвета ещё и лучше для обучения —
отличается только цвет.

Usage:
    python scripts/recolor_sprite.py <src.png> <dst.png> <hue_degrees> [value_boost]
    python scripts/recolor_sprite.py --colors-biome   # пересобрать colors_00..05 из colors_00
"""
import os
import sys

import numpy as np
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SPRITES = os.path.join(SCRIPT_DIR, "..", "public", "assets", "sprites")

# порядок как в BIOMES.colors (src/data/vocab.js): red, blue, green, yellow, purple, orange
COLORS_BIOME = [(0, 1.0), (215, 1.0), (115, 1.0), (52, 1.35), (275, 1.0), (28, 1.15)]


def recolor(src, dst, hue_deg, value_boost=1.0, min_sat=0.35):
    im = Image.open(src).convert("RGBA")
    alpha = np.array(im)[:, :, 3]
    hsv = np.array(im.convert("RGB").convert("HSV")).astype(np.float32)
    body = (hsv[:, :, 1] / 255 >= min_sat) & (alpha > 0)
    hsv[:, :, 0] = np.where(body, (hue_deg / 360 * 255) % 255, hsv[:, :, 0])
    hsv[:, :, 2] = np.where(body, np.clip(hsv[:, :, 2] * value_boost, 0, 255), hsv[:, :, 2])
    rgb = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
    out = np.dstack([np.array(rgb), alpha])
    Image.fromarray(out.astype(np.uint8), "RGBA").save(dst)
    print("saved", dst)


if __name__ == "__main__":
    if sys.argv[1:] == ["--colors-biome"]:
        base = os.path.join(SCRIPT_DIR, "..", "raw", "sprites", "colors_base.png")
        if not os.path.exists(base):
            Image.open(os.path.join(SPRITES, "colors_00.png")).save(base)
        for i, (hue, boost) in enumerate(COLORS_BIOME):
            recolor(base, os.path.join(SPRITES, f"colors_{i:02d}.png"), hue, boost)
    else:
        src, dst, hue = sys.argv[1], sys.argv[2], float(sys.argv[3])
        recolor(src, dst, hue, float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
