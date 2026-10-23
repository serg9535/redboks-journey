"""Converts a smooth (vector-like) sprite into the game's chunky pixel-art look.

Downsamples to a coarse grid, reduces the palette, re-adds a 1-px dark outline
around the opaque silhouette, then upscales with nearest-neighbour so the result
has the same visible "pixel size" as the sliced sprites (~4-5 screen px per art
pixel at the sizes the game uses).

Usage: python scripts/pixelate.py <src> <dst> [--grid 56] [--colors 24] [--out-size 256]
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage


def pixelate(src, dst, grid=56, colors=24, out_size=256, outline=(24, 20, 28)):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    scale = grid / max(w, h)
    small = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BOX)

    arr = np.array(small)
    alpha = arr[:, :, 3] >= 128
    rgb = Image.fromarray(arr[:, :, :3]).quantize(colors=colors, method=Image.MEDIANCUT).convert("RGB")
    out = np.zeros_like(arr)
    out[:, :, :3] = np.array(rgb)
    out[:, :, 3] = np.where(alpha, 255, 0)

    edge = alpha & ~ndimage.binary_erosion(alpha, structure=np.ones((3, 3)))
    out[edge, :3] = outline

    up = out_size / max(small.size)
    Image.fromarray(out, "RGBA").resize(
        (round(small.size[0] * up), round(small.size[1] * up)), Image.NEAREST
    ).save(dst)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--grid", type=int, default=56)
    p.add_argument("--colors", type=int, default=24)
    p.add_argument("--out-size", type=int, default=256)
    a = p.parse_args()
    pixelate(a.src, a.dst, a.grid, a.colors, a.out_size)
    print("saved", a.dst)
