"""Procedural pixel-art item icons (fallback when neither Gemini web nor the LoRA can make them).

The LoRA turns weapons/potions into creatures (it has never seen such objects), so these are drawn
from primitives on a 32x32 canvas, given the game's dark ink outline and upscaled with nearest.
Gemini versions (../assets/gemini_inbox/jobs_items.json -> gemini_web.mjs -> key_magenta.py)
should replace them when available — same file names.

    python scripts/draw_items.py            # all -> public/assets/sprites/<name>.png
    python scripts/draw_items.py fx_wind    # only some
"""
import os
import sys
from PIL import Image, ImageDraw

N = 32
SCALE = 6
INK = (45, 30, 62, 255)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "sprites")

GOLD, GOLD_D = (255, 201, 60, 255), (217, 154, 20, 255)
SILVER, SILVER_L = (196, 206, 222, 255), (240, 246, 255, 255)
WOOD, WOOD_D = (176, 112, 58, 255), (122, 74, 36, 255)
RED, RED_D = (232, 85, 62, 255), (169, 52, 33, 255)
GLASS = (226, 240, 250, 255)
WHITE = (255, 255, 255, 255)


def canvas(n=N):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def star(d, cx, cy, r, fill):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def sword():
    img, d = canvas()
    d.rectangle((14, 3, 17, 20), fill=SILVER)
    d.rectangle((14, 3, 15, 20), fill=SILVER_L)
    d.polygon([(14, 3), (17, 3), (15.5, 0)], fill=SILVER_L)
    d.rectangle((9, 20, 22, 22), fill=GOLD)
    d.rectangle((14, 23, 17, 27), fill=RED)
    d.ellipse((13, 27, 18, 31), fill=GOLD)
    return img.rotate(-40, resample=Image.NEAREST, center=(16, 16))


def bow():
    img, d = canvas()
    d.line((9, 3, 9, 29), fill=(250, 240, 220, 255), width=1)
    d.arc((1, 3, 21, 29), 270, 90, fill=WOOD, width=3)
    d.line((4, 16, 26, 16), fill=WOOD_D, width=2)
    d.polygon([(26, 13), (30, 16), (26, 19)], fill=SILVER)
    d.polygon([(3, 13), (7, 16), (3, 19)], fill=RED)
    return img


def wand():
    img, d = canvas()
    d.line((6, 27, 19, 14), fill=(122, 79, 192, 255), width=3)
    d.line((6, 26, 18, 14), fill=(176, 138, 232, 255), width=1)
    star(d, 21, 11, 8, GOLD)
    star(d, 21, 11, 4, (255, 240, 170, 255))
    for x, y in ((8, 8), (28, 22), (12, 4)):
        d.rectangle((x, y, x + 1, y + 1), fill=GOLD)
    return img


def shield():
    img, d = canvas()
    d.ellipse((2, 2, 29, 29), fill=SILVER)
    d.ellipse((5, 5, 26, 26), fill=WOOD)
    for x in (10, 15, 20):
        d.line((x, 6, x, 25), fill=WOOD_D, width=1)
    star(d, 15.5, 16, 7, GOLD)
    d.arc((5, 5, 26, 26), 200, 260, fill=(220, 160, 100, 255), width=2)
    return img


def key():
    img, d = canvas()
    d.ellipse((2, 2, 15, 15), fill=GOLD)
    d.ellipse((6, 6, 11, 11), fill=(0, 0, 0, 0))
    d.line((12, 12, 28, 28), fill=GOLD, width=4)
    d.polygon([(22, 22), (26, 18), (28, 20), (24, 24)], fill=GOLD)
    d.polygon([(18, 18), (21, 15), (23, 17), (20, 20)], fill=GOLD)
    d.line((12, 11, 27, 26), fill=(255, 235, 150, 255), width=1)
    return img


def torch():
    img, d = canvas()
    d.polygon([(13, 15), (19, 15), (17, 30), (15, 30)], fill=WOOD)
    d.line((15, 15, 15, 29), fill=WOOD_D)
    d.rectangle((12, 14, 20, 16), fill=SILVER)
    d.ellipse((9, 1, 23, 16), fill=(255, 128, 40, 255))
    d.polygon([(10, 9), (16, -2), (22, 9)], fill=(255, 128, 40, 255))
    d.ellipse((12, 6, 20, 15), fill=GOLD)
    d.ellipse((14, 9, 18, 14), fill=(255, 245, 200, 255))
    return img


def potion(color, dark):
    def draw():
        img, d = canvas()
        d.rectangle((12, 2, 19, 6), fill=WOOD)
        d.rectangle((13, 6, 18, 11), fill=GLASS)
        d.ellipse((5, 10, 26, 30), fill=GLASS)
        d.chord((6, 11, 25, 29), 0, 180, fill=color)
        d.rectangle((7, 18, 24, 20), fill=color)
        d.chord((6, 11, 25, 29), 20, 160, fill=dark)
        d.ellipse((9, 13, 12, 17), fill=WHITE)
        d.rectangle((15, 22, 16, 23), fill=WHITE)
        return img
    return draw


def backpack():
    img, d = canvas()
    d.arc((10, 1, 21, 12), 180, 360, fill=WOOD_D, width=2)
    d.rounded_rectangle((5, 6, 26, 30), radius=5, fill=WOOD)
    d.rounded_rectangle((5, 6, 26, 15), radius=5, fill=WOOD_D)
    d.rounded_rectangle((9, 19, 22, 28), radius=2, fill=(150, 92, 46, 255))
    d.rectangle((14, 13, 17, 17), fill=GOLD)
    d.line((7, 9, 7, 26), fill=(200, 140, 80, 255))
    return img


def tmap():
    img, d = canvas()
    d.rectangle((4, 7, 28, 25), fill=(243, 226, 184, 255))
    d.rectangle((2, 6, 5, 26), fill=(214, 186, 130, 255))
    d.rectangle((27, 6, 30, 26), fill=(214, 186, 130, 255))
    for x, y in ((8, 21), (10, 19), (12, 18), (14, 16), (16, 15), (18, 13)):
        d.rectangle((x, y, x, y), fill=WOOD_D)
    d.line((20, 9, 25, 14), fill=RED, width=2)
    d.line((20, 14, 25, 9), fill=RED, width=2)
    d.polygon([(7, 10), (9, 9), (10, 11)], fill=(123, 201, 80, 255))
    return img


def hammer():
    img, d = canvas()
    d.rectangle((14, 13, 17, 30), fill=WOOD)
    d.line((15, 14, 15, 29), fill=(214, 160, 100, 255))
    d.rounded_rectangle((4, 3, 27, 14), radius=4, fill=RED)
    d.rounded_rectangle((4, 9, 27, 14), radius=4, fill=RED_D)
    d.rectangle((7, 5, 13, 6), fill=(255, 170, 150, 255))
    return img


def outline(img):
    """Ink border around every opaque pixel (8-neighbour), like the sprites' dark contour."""
    src = img.load()
    W, H = img.size
    out = Image.new("RGBA", (W + 4, H + 4), (0, 0, 0, 0))
    out.paste(img, (2, 2))
    px = out.load()
    for y in range(H + 4):
        for x in range(W + 4):
            if px[x, y][3] > 0:
                continue
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    sx, sy = x - 2 + dx, y - 2 + dy
                    if 0 <= sx < W and 0 <= sy < H and src[sx, sy][3] > 0:
                        px[x, y] = INK
                        break
                else:
                    continue
                break
    return out


CRYSTAL, CRYSTAL_D, CRYSTAL_L = (120, 170, 255, 255), (122, 79, 192, 255), (220, 236, 255, 255)
GREEN, GREEN_D = (123, 201, 80, 255), (76, 147, 44, 255)
CYAN = (150, 230, 255, 255)


def crystal_gun():
    img, d = canvas()
    d.rectangle((6, 12, 24, 19), fill=CRYSTAL)
    d.rectangle((22, 13, 30, 17), fill=CRYSTAL_L)
    d.polygon([(8, 19), (14, 19), (12, 28), (6, 28)], fill=CRYSTAL_D)
    for x in (8, 13, 18):
        d.polygon([(x, 12), (x + 2, 5), (x + 4, 12)], fill=CRYSTAL_L)
    d.line((7, 14, 22, 14), fill=CRYSTAL_L)
    return img


def tornado_gun():
    img, d = canvas()
    d.rectangle((4, 15, 26, 21), fill=SILVER)
    d.rectangle((25, 16, 31, 20), fill=(150, 160, 175, 255))
    d.polygon([(7, 21), (13, 21), (11, 29), (5, 29)], fill=WOOD)
    d.ellipse((7, 3, 23, 19), fill=GLASS)
    for w, y in ((12, 6), (9, 9), (7, 12), (4, 15)):
        d.line((15 - w // 2, y, 15 + w // 2, y), fill=(150, 160, 175, 255), width=2)
    return img


def blower():
    img, d = canvas()
    d.rounded_rectangle((3, 10, 15, 22), radius=3, fill=GREEN_D)
    d.polygon([(14, 12), (27, 7), (27, 25), (14, 20)], fill=GREEN)
    d.rectangle((26, 7, 28, 25), fill=GREEN_D)
    d.polygon([(6, 22), (11, 22), (10, 29), (5, 29)], fill=(60, 60, 70, 255))
    d.arc((4, 2, 14, 12), 180, 360, fill=(60, 60, 70, 255), width=2)
    return img


def berry_gun():
    img, d = canvas()
    d.polygon([(1, 15), (9, 13), (9, 22), (2, 24)], fill=WOOD)
    d.rectangle((8, 14, 30, 18), fill=WOOD_D)
    d.line((8, 19, 28, 19), fill=GREEN, width=1)
    for cx, cy in ((14, 10), (18, 9), (16, 6), (21, 11)):
        d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=RED)
        d.point((cx - 1, cy - 1), fill=WHITE)
    d.polygon([(19, 4), (24, 2), (22, 6)], fill=GREEN)
    return img


def fx_crystal():
    img, d = canvas()
    d.polygon([(2, 16), (12, 9), (30, 16), (12, 23)], fill=CRYSTAL)
    d.polygon([(4, 16), (12, 11), (26, 16)], fill=CRYSTAL_L)
    return img


def fx_tornado():
    img, d = canvas()
    for i, (w, y) in enumerate(((26, 4), (21, 9), (16, 14), (11, 19), (7, 24), (4, 28))):
        col = (200, 205, 215, 255) if i % 2 else (235, 240, 248, 255)
        d.ellipse((16 - w // 2, y - 3, 16 + w // 2, y + 3), fill=col)
    return img


def fx_wind():
    img, d = canvas()
    for y, w in ((8, 22), (16, 28), (24, 20)):
        d.line((2, y, w, y), fill=CYAN, width=2)
        d.arc((w - 6, y - 6, w + 2, y + 2), 270, 120, fill=CYAN, width=2)
    return img


def fx_berry():
    img, d = canvas()
    d.ellipse((6, 9, 26, 29), fill=RED)
    d.ellipse((10, 13, 15, 18), fill=WHITE)
    d.polygon([(16, 9), (22, 2), (24, 7)], fill=GREEN)
    return img


def basket():
    img, d = canvas()
    d.arc((7, 2, 25, 22), 180, 360, fill=WOOD_D, width=3)
    d.polygon([(3, 12), (29, 12), (25, 29), (7, 29)], fill=WOOD)
    for y in (16, 21, 26):
        d.line((5, y, 27, y), fill=WOOD_D)
    for x in (10, 16, 22):
        d.line((x, 12, x, 29), fill=(200, 140, 80, 255))
    return img


def box():
    img, d = canvas()
    tan, tan_d = (214, 170, 110, 255), (170, 125, 70, 255)
    d.rectangle((4, 12, 28, 29), fill=tan)
    d.polygon([(4, 12), (0, 6), (12, 6), (14, 12)], fill=tan_d)
    d.polygon([(28, 12), (31, 6), (20, 6), (18, 12)], fill=tan_d)
    d.line((16, 13, 16, 29), fill=tan_d)
    return img


def eyes(d, cx, cy, gap=6, r=2):
    for dx in (-gap, gap):
        d.ellipse((cx + dx - r, cy - r, cx + dx + r, cy + r), fill=INK)
        d.point((cx + dx - 1, cy - 1), fill=WHITE)


def pet_chick():
    img, d = canvas()
    d.ellipse((5, 6, 27, 29), fill=(255, 214, 60, 255))
    d.ellipse((8, 9, 14, 14), fill=(255, 240, 160, 255))
    eyes(d, 16, 15, 5)
    d.polygon([(14, 19), (18, 19), (16, 22)], fill=(255, 128, 40, 255))
    d.polygon([(14, 6), (16, 1), (18, 6)], fill=(255, 214, 60, 255))
    return img


def pet_puppy():
    img, d = canvas()
    d.ellipse((6, 6, 26, 26), fill=(176, 112, 58, 255))
    d.ellipse((2, 8, 10, 22), fill=(122, 74, 36, 255))
    d.ellipse((22, 8, 30, 22), fill=(122, 74, 36, 255))
    d.ellipse((11, 15, 21, 24), fill=(240, 210, 170, 255))
    eyes(d, 16, 13, 5)
    d.ellipse((14, 16, 18, 19), fill=INK)
    d.rectangle((9, 25, 23, 28), fill=RED)
    return img


def pet_kitten():
    img, d = canvas()
    orange = (255, 150, 60, 255)
    d.polygon([(6, 12), (8, 2), (14, 8)], fill=orange)
    d.polygon([(26, 12), (24, 2), (18, 8)], fill=orange)
    d.ellipse((5, 6, 27, 27), fill=orange)
    d.line((9, 10, 12, 12), fill=(210, 110, 30, 255), width=1)
    eyes(d, 16, 15, 5)
    d.polygon([(15, 18), (17, 18), (16, 20)], fill=(255, 140, 170, 255))
    d.ellipse((13, 25, 19, 31), fill=GOLD)
    return img


def boss_forest():
    img, d = canvas(48)
    bark, bark_d, moss = (150, 95, 50, 255), (100, 60, 30, 255), (110, 170, 70, 255)
    d.line((4, 26, 13, 22), fill=bark_d, width=4)
    d.line((44, 26, 35, 22), fill=bark_d, width=4)
    d.line((4, 26, 2, 20), fill=bark_d, width=2)
    d.line((44, 26, 46, 20), fill=bark_d, width=2)
    d.rounded_rectangle((11, 12, 37, 46), radius=6, fill=bark)
    for x in (15, 22, 29, 34):
        d.line((x, 28, x, 44), fill=bark_d)
    d.ellipse((11, 8, 37, 18), fill=(200, 150, 90, 255))
    d.ellipse((16, 10, 32, 16), fill=(170, 120, 70, 255))
    for x in range(10, 36, 5):
        d.polygon([(x, 12), (x + 3, 1), (x + 6, 12)], fill=GREEN if (x // 5) % 2 else GREEN_D)
    d.ellipse((7, 3, 13, 8), fill=RED)
    d.ellipse((35, 4, 41, 9), fill=RED)
    d.ellipse((13, 34, 21, 40), fill=moss)
    d.ellipse((26, 38, 35, 44), fill=moss)
    for cx in (19, 29):
        d.ellipse((cx - 4, 20, cx + 4, 27), fill=(255, 230, 90, 255))
        d.ellipse((cx - 1, 22, cx + 1, 25), fill=INK)
    d.line((14, 17, 22, 20), fill=INK, width=2)
    d.line((34, 17, 26, 20), fill=INK, width=2)
    d.arc((19, 28, 29, 35), 200, 340, fill=INK, width=2)
    return img


ITEMS = {
    "item_sword": sword,
    "item_bow": bow,
    "item_wand": wand,
    "item_shield": shield,
    "item_key": key,
    "item_torch": torch,
    "item_potion_red": potion(RED, RED_D),
    "item_potion_blue": potion((110, 198, 255, 255), (56, 137, 196, 255)),
    "item_potion_green": potion((123, 201, 80, 255), (76, 147, 44, 255)),
    "item_backpack": backpack,
    "item_map": tmap,
    "item_hammer": hammer,
    "item_crystal_gun": crystal_gun,
    "item_tornado_gun": tornado_gun,
    "item_blower": blower,
    "item_berry_gun": berry_gun,
    "fx_crystal": fx_crystal,
    "fx_tornado": fx_tornado,
    "fx_wind": fx_wind,
    "fx_berry": fx_berry,
    "item_basket": basket,
    "item_box": box,
    "pet_chick": pet_chick,
    "pet_puppy": pet_puppy,
    "pet_kitten": pet_kitten,
    "boss_forest": boss_forest,
}

if __name__ == "__main__":
    only = sys.argv[1:]
    for name, fn in ITEMS.items():
        if only and name not in only:
            continue
        img = fn().convert("RGBA")
        # убрать полупрозрачность от поворота/сглаживания — только чистые пиксели
        img.putalpha(img.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
        img = outline(img)
        img = img.crop(img.getbbox())
        k = SCALE if img.width < 40 else 5
        img = img.resize((img.width * k, img.height * k), Image.NEAREST)
        dst = os.path.join(OUT, f"{name}.png")
        img.save(dst)
        print("saved", dst)
