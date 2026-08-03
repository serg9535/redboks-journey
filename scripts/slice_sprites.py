"""Slices a grid sprite sheet (characters on a flat-color background) into
individual transparent PNGs, sorted in reading order (top-to-bottom, left-to-right).

Usage: place raw sheets in a folder, point SRC at it, then:
    python scripts/slice_sprites.py

Requires: pip install numpy scipy pillow
"""
import os
import json
import numpy as np
from PIL import Image
from scipy import ndimage

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SCRIPT_DIR, "..", "raw", "sprites")
OUT = os.path.join(SCRIPT_DIR, "..", "public", "assets", "sprites")


def bg_color(arr):
    """Background is a flat navy color (sampled from the corners); sheets have no gradient."""
    corners = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    return np.median(np.array(corners), axis=0)


def slice_sheet(path, prefix, out_dir, pad=8, min_area=3000, tol=20, close_radius=10):
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    bg = bg_color(arr)
    dist = np.sqrt(((arr.astype(np.float32) - bg) ** 2).sum(axis=2))
    mask = dist > tol

    # drop tiny specks (dust/sparkle particles), then bridge gaps within one character
    mask = ndimage.binary_opening(mask, structure=np.ones((3, 3)))
    merged = ndimage.binary_closing(mask, structure=np.ones((close_radius, close_radius)))
    merged = ndimage.binary_dilation(merged, iterations=3)

    labeled, n = ndimage.label(merged)
    objs = ndimage.find_objects(labeled)

    results = []
    h, w = arr.shape[:2]
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        ys, xs = sl
        # bbox from the *real* mask within this component, not the dilated blob,
        # so crops hug the actual artwork
        comp_mask = mask[ys, xs] & (labeled[ys, xs] == (i + 1))
        if comp_mask.sum() < min_area:
            continue
        rows = np.any(comp_mask, axis=1)
        cols = np.any(comp_mask, axis=0)
        ry0, ry1 = np.where(rows)[0][[0, -1]]
        rx0, rx1 = np.where(cols)[0][[0, -1]]
        y0 = max(0, ys.start + ry0 - pad)
        y1 = min(h, ys.start + ry1 + 1 + pad)
        x0 = max(0, xs.start + rx0 - pad)
        x1 = min(w, xs.start + rx1 + 1 + pad)
        results.append((x0, y0, x1, y1))

    # sort reading order: top-to-bottom rows, then left-to-right
    results.sort(key=lambda b: b[1])
    rows_out = []
    cur_row = []
    row_y = None
    for b in results:
        cy = (b[1] + b[3]) / 2
        if row_y is None or abs(cy - row_y) < 120:
            cur_row.append(b)
            row_y = cy if row_y is None else row_y
        else:
            rows_out.append(cur_row)
            cur_row = [b]
            row_y = cy
    if cur_row:
        rows_out.append(cur_row)
    ordered = []
    for row in rows_out:
        row.sort(key=lambda b: b[0])
        ordered.extend(row)

    orig_arr = np.array(Image.open(path).convert("RGBA"))
    alpha_mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)))
    alpha_mask = ndimage.binary_dilation(alpha_mask, iterations=1)
    orig_arr[:, :, 3] = np.where(alpha_mask, 255, 0).astype(np.uint8)
    orig_rgba = Image.fromarray(orig_arr, mode="RGBA")

    frames = []
    for idx, (x0, y0, x1, y1) in enumerate(ordered):
        crop = orig_rgba.crop((x0, y0, x1, y1))
        name = f"{prefix}_{idx:02d}.png"
        crop.save(os.path.join(out_dir, name))
        frames.append({"name": name, "bbox": [int(x0), int(y0), int(x1), int(y1)], "size": [int(x1 - x0), int(y1 - y0)]})

    return frames


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    # map: raw sheet filename (in raw/sprites/) -> output prefix used in vocab.js / maps.js
    sheets = {
        "monsters_forest_biome.png": "forest",
        "monsters_desert_biome.png": "desert",
        "monsters_cave_biome.png": "cave",
        "monsters_ocean_biome.png": "ocean",
        "monsters_neutral_starter_set.png": "neutral",
        "redbok_walk_run_hurt_defeated_victory.png": "redbok",
    }
    for fname, prefix in sheets.items():
        path = os.path.join(SRC, fname)
        if not os.path.exists(path):
            print(f"skip {fname}: not found in {SRC}")
            continue
        frames = slice_sheet(path, prefix, OUT)
        manifest[prefix] = frames
        print(prefix, "->", len(frames), "frames")

    manifest_path = os.path.join(OUT, "manifest.json")
    existing = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            existing = json.load(f)
    existing.update(manifest)
    with open(manifest_path, "w") as f:
        json.dump(existing, f, indent=2)
