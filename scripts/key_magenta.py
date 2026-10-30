"""Cut a Gemini sprite rendered on a flat magenta (#FF00FF) background into a tight transparent PNG.

Gemini web is asked for "plain flat solid pure magenta background" (see scripts/gemini_web.mjs):
nothing in the game's palette is magenta, so a chroma key is more reliable than the flood fill
in crop_transparent.py. Pixels close to magenta become transparent; anti-aliased edge pixels get
the magenta spill removed (the purple fringe otherwise visible on light backgrounds).

    python scripts/key_magenta.py <src> <dst> [--size 512]          # one sprite
    python scripts/key_magenta.py --sheet <src> <dst_prefix> [--size 512]
        # a horizontal sheet of several sprites -> <dst_prefix>00.png, 01.png, ... (left to right)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def magenta_alpha(rgb):
    """0 = background, 1 = opaque. Magenta-ness = how much R and B exceed G."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = np.minimum(r, b) - g  # ~255 on pure magenta, <= 0 on most sprite colors
    alpha = np.clip((200 - m) / 120, 0, 1)
    return alpha


def despill(rgb, alpha):
    """Pull R and B down towards G on semi-transparent / fringe pixels."""
    out = rgb.copy()
    edge = alpha < 1
    lim = np.maximum(out[..., 1], (out[..., 0] + out[..., 2]) / 2 * 0)  # cap by green
    for ch in (0, 2):
        c = out[..., ch]
        c[edge] = np.minimum(c[edge], np.maximum(lim[edge], c[edge] * alpha[edge]))
    return out


def key(img):
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    alpha = magenta_alpha(rgb)
    # drop specks: keep only connected components of reasonable size
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.flatnonzero(sizes >= max(200, sizes.max() * 0.002)))
        alpha = np.where(ndimage.binary_dilation(keep, iterations=2), alpha, 0)
    rgb = despill(rgb, alpha)
    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def tight(img, size=None, pad=4):
    bbox = img.getbbox()
    img = img.crop(bbox)
    if size:
        s = size / max(img.size)
        if s < 1:
            img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad))
    canvas.paste(img, (pad, pad))
    return canvas


def split_sheet(img):
    """Split a keyed horizontal sheet into sprites by empty columns."""
    a = np.asarray(img)[..., 3] > 0
    cols = a.any(axis=0)
    runs, start = [], None
    for x, on in enumerate(cols):
        if on and start is None:
            start = x
        if not on and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, len(cols)))
    widest = max(e - s for s, e in runs)
    runs = [r for r in runs if r[1] - r[0] > widest * 0.25]  # drop dust between frames
    return [img.crop((s, 0, e, img.height)) for s, e in runs]


if __name__ == "__main__":
    args = sys.argv[1:]
    size = None
    if "--size" in args:
        i = args.index("--size"); size = int(args[i + 1]); del args[i:i + 2]
    if args[0] == "--sheet":
        src, prefix = args[1], args[2]
        for i, part in enumerate(split_sheet(key(Image.open(src)))):
            tight(part, size).save(f"{prefix}{i:02d}.png")
            print(f"{prefix}{i:02d}.png")
    else:
        tight(key(Image.open(args[0])), size).save(args[1])
        print(args[1])
