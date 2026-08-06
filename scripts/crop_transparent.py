"""Crops a single-character image (flat-ish, dithered background, one
subject) to a tight transparent PNG.

Uses a tolerant flood-fill from the image border instead of a single
fixed-color threshold: each step compares a candidate pixel to its
already-background NEIGHBOR (not one fixed reference color), so it follows
gradual per-pixel dithering noise in the background but still stops hard at
the character's thick black outline. A single global color-distance
threshold (as used previously) fails on these images because the "flat"
background itself contains pixel-dithering texture whose local variance can
exceed any single reasonable threshold.

Usage (as a module):
    from crop_transparent import crop_to_transparent
    crop_to_transparent(src_path, dst_path)

Or standalone: python scripts/crop_transparent.py <src> <dst> [<src> <dst> ...]
"""
import sys
from collections import deque
import numpy as np
from PIL import Image
from scipy import ndimage


def flood_background_mask(arr, step_tol=28):
    """BFS flood fill from the border; True = background."""
    h, w = arr.shape[:2]
    farr = arr.astype(np.float32)
    bg = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            q.append((y, x))
    for y, x in q:
        visited[y, x] = True

    while q:
        y, x = q.popleft()
        bg[y, x] = True
        cur = farr[y, x]
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if np.sqrt(((farr[ny, nx] - cur) ** 2).sum()) <= step_tol:
                    visited[ny, nx] = True
                    q.append((ny, nx))
    return bg


def crop_to_transparent(src_path, dst_path, pad=8, step_tol=28):
    im = Image.open(src_path).convert("RGB")
    arr = np.array(im)
    bg_mask = flood_background_mask(arr, step_tol=step_tol)
    fg_mask = ~bg_mask

    # close small holes (specular highlights etc. inside the subject) and
    # drop tiny background specks that snuck through as "foreground"
    fg_mask = ndimage.binary_closing(fg_mask, structure=np.ones((5, 5)))
    fg_mask = ndimage.binary_opening(fg_mask, structure=np.ones((3, 3)))

    labeled, n = ndimage.label(fg_mask)
    if n == 0:
        raise ValueError(f"no subject found in {src_path}")
    sizes = ndimage.sum(fg_mask, labeled, range(1, n + 1))
    biggest = int(np.argmax(sizes)) + 1
    comp_mask = labeled == biggest

    h, w = arr.shape[:2]
    rows = np.any(comp_mask, axis=1)
    cols = np.any(comp_mask, axis=0)
    ry0, ry1 = np.where(rows)[0][[0, -1]]
    rx0, rx1 = np.where(cols)[0][[0, -1]]
    y0, y1 = max(0, ry0 - pad), min(h, ry1 + 1 + pad)
    x0, x1 = max(0, rx0 - pad), min(w, rx1 + 1 + pad)

    orig_arr = np.array(Image.open(src_path).convert("RGBA"))
    orig_arr[:, :, 3] = np.where(comp_mask, 255, 0).astype(np.uint8)
    Image.fromarray(orig_arr, mode="RGBA").crop((x0, y0, x1, y1)).save(dst_path)


if __name__ == "__main__":
    args = sys.argv[1:]
    for i in range(0, len(args), 2):
        crop_to_transparent(args[i], args[i + 1])
        print("saved", args[i + 1])
