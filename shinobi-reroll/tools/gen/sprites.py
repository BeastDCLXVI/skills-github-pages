"""16x16 item icons and projectile sprites, all drawn procedurally or from ASCII."""
from __future__ import annotations

import math
import random

from PIL import Image, ImageDraw

from .pixel import RGBA, hexc, mix, orb, outline, ramp, shade, sprite, swirl

OUT = hexc("#16131c")

STEEL = {"l": hexc("#e8eef2"), "m": hexc("#a9b4bf"), "d": hexc("#66717d")}
DARK_STEEL = {"l": hexc("#8e9aa8"), "m": hexc("#4f5966"), "d": hexc("#2c323b")}
WRAP = {"a": hexc("#2f2a3d"), "b": hexc("#54496b")}
RED_WRAP = {"a": hexc("#5b1a1a"), "b": hexc("#9c2b2b")}
WHITE_WRAP = {"a": hexc("#b9b4a8"), "b": hexc("#ece6d6")}


# --- diagonal weapons -------------------------------------------------------

def diag_weapon(segments: list[tuple], ring: bool = False, origin=(1.0, 15.0), extra=None) -> Image.Image:
    """Rasterise a weapon lying on the bottom-left -> top-right diagonal.

    segments: (t0, t1, halfwidth0, halfwidth1, kind, palette)
      kind "blade" shades across the edge, "wrap" draws a diamond grip pattern,
      "solid" uses the mid tone.
    """
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    ux, uy = 1 / math.sqrt(2), -1 / math.sqrt(2)
    nx, ny = 1 / math.sqrt(2), 1 / math.sqrt(2)
    ox, oy = origin
    for y in range(16):
        for x in range(16):
            cx, cy = x + 0.5 - ox, y + 0.5 - oy
            t = cx * ux + cy * uy
            s = cx * nx + cy * ny
            for t0, t1, w0, w1, kind, pal in segments:
                if t0 <= t < t1:
                    f = (t - t0) / max(1e-6, t1 - t0)
                    hw = w0 + (w1 - w0) * f
                    if abs(s) <= hw:
                        if kind == "blade":
                            col = pal["l"] if s < -hw * 0.25 else (pal["m"] if s < hw * 0.45 else pal["d"])
                        elif kind == "wrap":
                            col = pal["b"] if (int(t * 1.4) + (s > 0)) % 2 else pal["a"]
                        elif kind == "hole":
                            col = None
                        else:
                            col = pal["m"]
                        if col is None:
                            px[x, y] = (0, 0, 0, 0)
                        else:
                            px[x, y] = col
                    break
    if ring:
        d = ImageDraw.Draw(img)
        d.ellipse((0, 12, 3, 15), outline=STEEL["m"])
        px[1, 13] = (0, 0, 0, 0)
    if extra:
        extra(img)
    return outline(img, OUT)


def kunai() -> Image.Image:
    return diag_weapon([
        (1.6, 6.6, 0.75, 0.75, "wrap", WRAP),
        (6.6, 7.6, 1.6, 1.6, "solid", DARK_STEEL),
        (7.6, 11.5, 1.2, 2.3, "blade", STEEL),
        (11.5, 19.2, 2.3, 0.0, "blade", STEEL),
    ], ring=True)


def explosive_kunai() -> Image.Image:
    def tag(img):
        d = ImageDraw.Draw(img)
        d.polygon([(4, 8), (7, 5), (9, 7), (6, 10)], fill=hexc("#efe3c2"))
        d.line([(5, 8), (7, 6)], fill=hexc("#c0262b"))
        img.putpixel((6, 8), hexc("#c0262b"))
    return diag_weapon([
        (1.6, 6.6, 0.75, 0.75, "wrap", WRAP),
        (6.6, 7.6, 1.6, 1.6, "solid", DARK_STEEL),
        (7.6, 11.5, 1.2, 2.3, "blade", STEEL),
        (11.5, 19.2, 2.3, 0.0, "blade", STEEL),
    ], ring=True, extra=tag)


def senbon() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for off in (0, 3, 6):
        for i in range(11):
            x, y = i + 1 + off, 14 - i
            if 0 <= x < 16 and 0 <= y < 16:
                px[x, y] = STEEL["l"] if i > 7 else STEEL["m"]
            if 0 <= x < 16 and 0 <= y + 1 < 16 and not px[x, y + 1][3]:
                px[x, y + 1] = OUT
    return img


def kusanagi() -> Image.Image:
    return diag_weapon([
        (0.4, 5.4, 0.8, 0.8, "wrap", WHITE_WRAP),
        (5.4, 6.4, 1.9, 1.9, "solid", {"m": hexc("#c9a548")}),
        (6.4, 19.5, 0.95, 0.45, "blade", STEEL),
        (19.5, 20.6, 0.45, 0.0, "blade", STEEL),
    ])


def chakra_blade() -> Image.Image:
    def knuckle(img):
        d = ImageDraw.Draw(img)
        d.line([(2, 10), (5, 13)], fill=DARK_STEEL["m"])
    return diag_weapon([
        (1.0, 5.2, 0.9, 0.9, "wrap", WRAP),
        (5.2, 6.2, 2.0, 2.0, "solid", DARK_STEEL),
        (6.2, 14.5, 1.4, 1.0, "blade", {"l": hexc("#e6fbff"), "m": hexc("#9fd8e6"), "d": hexc("#4e8da0")}),
        (14.5, 16.2, 1.0, 0.0, "blade", {"l": hexc("#e6fbff"), "m": hexc("#9fd8e6"), "d": hexc("#4e8da0")}),
    ], extra=knuckle)


def kubikiribocho() -> Image.Image:
    blade = {"l": hexc("#f2f5f7"), "m": hexc("#b8c2cb"), "d": hexc("#6d7884")}
    return diag_weapon([
        (0.4, 5.0, 0.8, 0.8, "wrap", RED_WRAP),
        (5.0, 6.0, 1.5, 1.5, "solid", DARK_STEEL),
        (6.0, 15.0, 3.6, 3.9, "blade", blade),
        (15.0, 17.6, 3.9, 3.0, "blade", blade),
        (17.6, 19.6, 3.0, 0.5, "blade", blade),
    ], extra=lambda img: _cleaver_hole(img))


def _cleaver_hole(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    d.ellipse((10, 1, 13, 4), fill=(0, 0, 0, 0))
    d.arc((10, 1, 13, 4), 0, 360, fill=hexc("#6d7884"))


def samehada() -> Image.Image:
    rng = random.Random(11)
    scales = {"l": hexc("#8fb1c9"), "m": hexc("#5d7e99"), "d": hexc("#33495e")}

    def bumps(img):
        px = img.load()
        for y in range(16):
            for x in range(16):
                if px[x, y][3] and px[x, y][:3] in (scales["m"][:3], scales["l"][:3]) and rng.random() < 0.3:
                    px[x, y] = hexc("#c8dbe8")
    return diag_weapon([
        (0.4, 5.0, 0.8, 0.8, "wrap", WRAP),
        (5.0, 6.2, 1.4, 1.4, "solid", DARK_STEEL),
        (6.2, 17.5, 2.6, 3.1, "blade", scales),
        (17.5, 20.0, 3.1, 1.2, "blade", scales),
    ], extra=bumps)


# --- radial / polygon sprites ----------------------------------------------

def star(points: int, r_out: float, r_in: float, twist: float, pal: dict, hole: bool = True,
         size: int = 16) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = (size - 1) / 2
    poly = []
    for i in range(points * 2):
        ang = math.pi * i / points - math.pi / 2 + (twist if i % 2 else 0)
        r = r_out if i % 2 == 0 else r_in
        poly.append((c + r * math.cos(ang), c + r * math.sin(ang)))
    d.polygon(poly, fill=pal["m"])
    px = img.load()
    for y in range(size):
        for x in range(size):
            if px[x, y][3]:
                if x + y < size - 2:
                    px[x, y] = pal["l"]
                elif x + y > size + 1:
                    px[x, y] = pal["d"]
    if hole:
        for x, y in ((7, 7), (8, 7), (7, 8), (8, 8)):
            px[x, y] = (0, 0, 0, 0)
    return outline(img, OUT)


def shuriken() -> Image.Image:
    return star(4, 7.8, 3.3, 0.55, STEEL)


def fuma_shuriken() -> Image.Image:
    img = star(4, 7.9, 3.6, 0.9, DARK_STEEL)
    px = img.load()
    for x, y in ((6, 6), (9, 6), (6, 9), (9, 9)):
        px[x, y] = hexc("#c9a548")
    return img


def crystal(base: str = "#4fc3ff") -> Image.Image:
    r = ramp(base)
    rows = [
        "................",
        "......oo........",
        ".....owco.......",
        ".....owcbo..oo..",
        "....owcbbo.owco.",
        "....owcbbaoowcbo",
        "...owcbbbaoowcbo",
        "...owcbbbaoowbao",
        "..owcbbbbaoowbao",
        "..owcbbbbao.obao",
        "..ocbbbbaao.obo.",
        "..obbbbbaao..o..",
        "...obbbaao......",
        "....obbaao......",
        ".....oaao.......",
        "......oo........",
    ]
    return sprite(rows, {**r})


def gem_block_overlay(base: str, size: int = 16) -> Image.Image:
    return crystal(base)


def chakra_orb(base: str, glyph: list[str] | None = None, glyph_color: str = "#1b1020", rim: str | None = None) -> Image.Image:
    return outline(orb(16, base, glyph, glyph_color, rim=rim, radius=6.4), OUT)


def pill(base: str, accent: str | None = None) -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = hexc(base)
    d.ellipse((3, 4, 12, 11), fill=c)
    d.ellipse((4, 5, 7, 7), fill=shade(c, 1.5))
    d.arc((3, 4, 12, 11), 20, 160, fill=shade(c, 0.65))
    if accent:
        d.line([(5, 10), (10, 10)], fill=hexc(accent))
    return outline(img, OUT)


SCROLL_ROWS = [
    "................",
    "................",
    "..oo........oo..",
    ".occo......occo.",
    ".oaao......oaao.",
    ".oppoooooooopqo.",
    ".oppppppppppppqo",
    ".oppxxpppxxpppqo",
    ".opppppxxppppqqo",
    ".oppxxpppppxxpqo",
    ".oppppppppppppqo",
    ".oppoooooooopqo.",
    ".oaao......oaao.",
    ".occo......occo.",
    "..oo........oo..",
    "................",
]


def scroll(cap: str, paper: str = "#efe3c2", ink: str = "#2a1d1d") -> Image.Image:
    rows = [r[:16] for r in SCROLL_ROWS]
    rows = [(r + "." * 16)[:16] for r in rows]
    cr = ramp(cap)
    pal = {
        "o": OUT,
        "c": cr["c"], "a": cr["a"],
        "p": hexc(paper), "q": shade(hexc(paper), 0.82), "x": hexc(ink),
    }
    return sprite(rows, pal)


def headband(cloth: str, plate_scratched: bool = False) -> Image.Image:
    rows = [
        "................",
        "................",
        "................",
        "................",
        "...oooooooooo...",
        "oooolllllllloooo",
        "occolldllllmocco",
        "obbolddldllmobbo",
        "obbollldllmmobbo",
        "oaaommmmmmmmoaao",
        "oooooooooooooooo",
        "...........obbo.",
        "...........obao.",
        "............obo.",
        "............oao.",
        ".............o..",
    ]
    cr = ramp(cloth)
    pal = {"o": OUT, "c": cr["c"], "b": cr["b"], "a": cr["a"],
           "m": hexc("#9aa5b1"), "l": hexc("#dfe7ee"), "d": hexc("#4f5966")}
    img = sprite(rows, pal)
    if plate_scratched:
        d = ImageDraw.Draw(img)
        d.line([(4, 9), (11, 5)], fill=hexc("#7a1418"))
    return img


def anbu_mask() -> Image.Image:
    rows = [
        "................",
        ".....oooooo.....",
        "....owwwwwwo....",
        "...owwwwwwwwo...",
        "..owrwwwwwwrwo..",
        "..owwrwwwwrwwo..",
        "..owwoowwoowwo..",
        "..owwoowwoowwo..",
        "..owwwwwwwwwwo..",
        "..owwwwrrwwwwo..",
        "...owwwrrwwwo...",
        "...owwwwwwwwo...",
        "....owggggwo....",
        ".....owwwwo.....",
        "......oooo......",
        "................",
    ]
    return sprite(rows, {"o": OUT, "w": hexc("#f1eee6"), "r": hexc("#c0262b"), "g": hexc("#c9c3b6")})


def kage_hat() -> Image.Image:
    rows = [
        "................",
        ".......oo.......",
        "......owwo......",
        ".....owwwwo.....",
        ".....owrrwo.....",
        "....owrrrrwo....",
        "....owrwwrwo....",
        "...owwrrrrwwo...",
        "...owwwwwwwwo...",
        "..owwwwwwwwwwo..",
        ".owwwwwwwwwwwwo.",
        "owwwwwwwwwwwwwwo",
        "oggggggggggggggo",
        ".oooooooooooooo.",
        "................",
        "................",
    ]
    return sprite(rows, {"o": OUT, "w": hexc("#f4f1ea"), "r": hexc("#c0262b"), "g": hexc("#c9c3b6")})


def vest(body: str, trim: str, pattern: str | None = None) -> Image.Image:
    rows = [
        "................",
        "...ooo....ooo...",
        "..obbbo..obbbo..",
        ".obbbbboobbbbbo.",
        ".obtbbbbbbbbtbo.",
        ".obtbbbbbbbbtbo.",
        "..obbbbbbbbbbo..",
        "..obppbbbbppbo..",
        "..obppbbbbppbo..",
        "..obbbbbbbbbbo..",
        "..obppbbbbppbo..",
        "..obppbbbbppbo..",
        "..obbbbbbbbbbo..",
        "..oaaaaaaaaaao..",
        "..oooooooooooo..",
        "................",
    ]
    b = hexc(body)
    pal = {"o": OUT, "b": b, "a": shade(b, 0.7), "t": hexc(trim), "p": shade(b, 0.82)}
    img = sprite(rows, pal)
    if pattern == "clouds":
        px = img.load()
        for (x, y) in ((4, 7), (5, 7), (5, 8), (10, 10), (11, 10), (10, 11), (7, 4), (8, 4)):
            px[x, y] = hexc("#c0262b")
        for (x, y) in ((4, 8), (11, 11)):
            px[x, y] = hexc("#f4f1ea")
    return img


def ramen() -> Image.Image:
    rows = [
        "................",
        "......y..y......",
        ".......y..y.....",
        "......y..y......",
        "...oooooooooo...",
        "..onnnnnpnnnnno.",
        ".onnppnnnnnnegno",
        ".ofnnnnnmmnneeno",
        ".obbbbbbbbbbbbbo",
        ".obrbbbbbbbbrbbo",
        "..obbbrbbbbbbbo.",
        "..obbbbbbbrbbbo.",
        "...oaaaaaaaaao..",
        "....oooooooo....",
        "................",
        "................",
    ]
    pal = {
        "o": OUT, "n": hexc("#f2d27a"), "p": hexc("#f7f1df"), "e": hexc("#fff7e0"), "g": hexc("#f5b81a"),
        "m": hexc("#c97b5a"), "f": hexc("#5aa04a"), "b": hexc("#c0262b"), "r": hexc("#f4f1ea"),
        "a": hexc("#7a1418"), "y": hexc("#e6e6e6", 150),
    }
    return sprite([(r + "................")[:16] for r in rows], pal)


def dango() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([(2, 14), (13, 3)], fill=hexc("#c9a46a"))
    for (cx, cy), col in zip(((5, 11), (8, 8), (11, 5)), ("#9ccf6e", "#f4f1ea", "#f29cb5")):
        d.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), fill=hexc(col))
        img.putpixel((cx - 1, cy - 1), shade(hexc(col), 1.4))
    return outline(img, OUT)


def chakra_fruit() -> Image.Image:
    img = outline(orb(16, "#b58ad6", glyph=["o.o", "...", ".o."], glyph_color="#4a1d63", radius=6.0), OUT)
    d = ImageDraw.Draw(img)
    d.line([(8, 0), (8, 2)], fill=hexc("#5a3a1e"))
    d.polygon([(9, 1), (12, 0), (11, 2)], fill=hexc("#5aa04a"))
    return img


def smoke_bomb() -> Image.Image:
    img = outline(orb(16, "#3a3a44", radius=5.6), OUT)
    d = ImageDraw.Draw(img)
    d.line([(10, 3), (12, 1)], fill=hexc("#c9a46a"))
    img.putpixel((13, 0), hexc("#ffb43a"))
    return img


def explosive_tag() -> Image.Image:
    rows = [
        "................",
        ".....oooooo.....",
        ".....oppppo.....",
        ".....opxxpo.....",
        ".....oppxpo.....",
        ".....oxxxxo.....",
        ".....oppxpo.....",
        ".....opxpxo.....",
        ".....oxpppo.....",
        ".....oppxpo.....",
        ".....opxxpo.....",
        ".....oppppo.....",
        ".....oqqqqo.....",
        ".....oooooo.....",
        "......o..o......",
        ".......oo.......",
    ]
    return sprite(rows, {"o": OUT, "p": hexc("#efe3c2"), "q": hexc("#d6c49a"), "x": hexc("#c0262b")})


def gauntlet() -> Image.Image:
    rows = [
        "................",
        ".....oooooo.....",
        "....ommmmmmo....",
        "...omlllllmmo...",
        "...omlccclmmo...",
        "...omlcrclmmo...",
        "...omlccclmmo...",
        "...ommmmmmmmo...",
        "...oddddddddo...",
        "...ommmmmmmmo...",
        "...omsssssmmo...",
        "...ommmmmmmmo...",
        "...oddddddddo...",
        "....obbbbbbo....",
        "....obbbbbbo....",
        ".....oooooo.....",
    ]
    return sprite(rows, {"o": OUT, "m": hexc("#7d8794"), "l": hexc("#c4ccd4"), "c": hexc("#4fc3ff"),
                         "r": hexc("#ffffff"), "d": hexc("#3c434c"), "s": hexc("#f2b632"),
                         "b": hexc("#2e2a3b")})


def cartridge() -> Image.Image:
    rows = [
        "................",
        "................",
        "................",
        "......oooo......",
        ".....occcco.....",
        ".....oaaaao.....",
        ".....oppppo.....",
        ".....opxxpo.....",
        ".....oppppo.....",
        ".....opxxpo.....",
        ".....oppppo.....",
        ".....oaaaao.....",
        ".....occcco.....",
        "......oooo......",
        "................",
        "................",
    ]
    return sprite(rows, {"o": OUT, "c": hexc("#f2b632"), "a": hexc("#9c6b12"), "p": hexc("#efe3c2"),
                         "x": hexc("#2f7fd8")})


def gunbai() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([(2, 14), (6, 10)], fill=hexc("#6b4a2b"))
    d.ellipse((4, 1, 14, 11), fill=hexc("#d9d2c0"))
    d.ellipse((6, 3, 12, 9), fill=hexc("#c0262b"))
    d.rectangle((8, 3, 9, 6), fill=hexc("#f4f1ea"))
    d.line([(9, 6), (11, 8)], fill=hexc("#2a2a2a"))
    return outline(img, OUT)


def karma_seal() -> Image.Image:
    rows = [
        "................",
        ".......oo.......",
        "......oxxo......",
        ".....oxxxxo.....",
        "....oxxppxxo....",
        "...oxxpxxpxxo...",
        "..oxxpxxxxpxxo..",
        ".oxxpxxxxxxpxxo.",
        ".oxxpxxxxxxpxxo.",
        "..oxxpxxxxpxxo..",
        "...oxxpxxpxxo...",
        "....oxxppxxo....",
        ".....oxxxxo.....",
        "......oxxo......",
        ".......oo.......",
        "................",
    ]
    return sprite(rows, {"o": hexc("#6b2d8f"), "x": hexc("#141018"), "p": hexc("#b46cf0")})


def spore() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((3, 5, 12, 13), fill=hexc("#ecefe6"))
    d.ellipse((6, 2, 10, 7), fill=hexc("#dfe6d4"))
    d.point([(5, 8), (9, 10), (8, 7)], fill=hexc("#9ab88a"))
    return outline(img, OUT)


def vial(liquid: str) -> Image.Image:
    rows = [
        "................",
        "......oooo......",
        "......occo......",
        ".......oo.......",
        "......ogwo......",
        ".....ogwwgo.....",
        "....ogllllgo....",
        "....ollllllo....",
        "....ollhllllo...",
        "....olllllllo...",
        "....ollllllo....",
        "....ollllllo....",
        ".....olllllo....",
        "......ooooo.....",
        "................",
        "................",
    ]
    rows = [(r + "................")[:16] for r in rows]
    l = hexc(liquid)
    return sprite(rows, {"o": OUT, "c": hexc("#8a6a3a"), "g": hexc("#cfe8ee", 200), "w": hexc("#ffffff", 210),
                         "l": l, "h": shade(l, 1.5)})


def training_post_icon() -> Image.Image:
    rows = [
        "................",
        "......oooo......",
        ".....oyyyyo.....",
        ".....oyxyyo.....",
        ".....oyyyyo.....",
        "......owwo......",
        "..ooooowwooooo..",
        "..owwwwwwwwwwo..",
        "..ooooowwooooo..",
        "......owwo......",
        "......owwo......",
        "......owwo......",
        "......owwo......",
        "....oowwwwoo....",
        "...owwwwwwwwo...",
        "...oooooooooo...",
    ]
    return sprite(rows, {"o": OUT, "w": hexc("#9c6b3a"), "y": hexc("#e2c26a"), "x": hexc("#c0262b")})


def chakra_focus() -> Image.Image:
    img = swirl(16, "#ffffff", "#2f7fd8", arms=3, glow="#7fe0ff")
    return outline(img, OUT)


def gedo_core() -> Image.Image:
    glyph = ["oo.oo", "o...o", ".ooo."]
    return chakra_orb("#5a4a6e", glyph=glyph, glyph_color="#d8c8f0", rim="#2a1d38")


def sigil() -> Image.Image:
    glyph = [".ooo.", "o.o.o", "ooooo", "o.o.o", ".ooo."]
    return chakra_orb("#e9e4f2", glyph=glyph, glyph_color="#7a3fb0", rim="#9a8cb8")


# --- jutsu projectile sprites (also 16x16) ---------------------------------

def jutsu_sprite(kind: str) -> Image.Image:
    if kind == "fire":
        return swirl(16, "#fff3b0", "#e2461f", arms=5, glow="#ff9a2a", twist=1.4)
    if kind == "water":
        return swirl(16, "#e6fbff", "#1f6fd8", arms=2, glow="#56b6ff", twist=1.0)
    if kind == "wind":
        return swirl(16, "#ffffff", "#9fe6c4", arms=4, glow="#d8fff0", twist=3.0)
    if kind == "lightning":
        img = swirl(16, "#ffffff", "#7fb6ff", arms=7, glow="#e8f4ff", twist=4.0)
        return img
    if kind == "earth":
        return outline(orb(16, "#8a6a42", radius=6.5), OUT)
    if kind == "rasengan":
        return swirl(16, "#ffffff", "#2f7fd8", arms=3, glow="#7fe0ff", twist=2.6)
    if kind == "rasenshuriken":
        img = swirl(16, "#ffffff", "#5fb8ff", arms=4, glow="#ffffff", twist=0.6)
        d = ImageDraw.Draw(img)
        for a in range(4):
            ang = a * math.pi / 2 + 0.4
            d.line([(7.5, 7.5), (7.5 + 7.5 * math.cos(ang), 7.5 + 7.5 * math.sin(ang))], fill=hexc("#ffffff", 220))
        return img
    if kind == "ice":
        return crystal("#9fe8ff")
    if kind == "lava":
        return swirl(16, "#ffd36a", "#5a1608", arms=3, glow="#ff5a1f", twist=1.2)
    if kind == "bone":
        return diag_weapon([(4, 18, 1.2, 0.0, "blade", {"l": hexc("#ffffff"), "m": hexc("#efe8d8"), "d": hexc("#c9bfa8")})])
    if kind == "ash_bone":
        return diag_weapon([(4, 18, 1.2, 0.0, "blade", {"l": hexc("#e8e8e8"), "m": hexc("#9a9a9a"), "d": hexc("#555555")})])
    if kind == "truth":
        return outline(orb(16, "#16121c", rim="#4b3a66", radius=6.6), hexc("#000000", 0))
    if kind == "bijuu_bomb":
        return swirl(16, "#1a0f24", "#5a1b6e", arms=5, glow="#ff3b5c", twist=2.0)
    if kind == "karma":
        return swirl(16, "#0e0a14", "#6b2d8f", arms=2, glow="#c78cff", twist=1.6)
    if kind == "wood":
        return outline(orb(16, "#5a8a3a", glyph=[".o.", "ooo", ".o."], glyph_color="#8a5a2b", radius=6.2), OUT)
    if kind == "boil":
        return swirl(16, "#fbfff0", "#b8c94a", arms=3, glow="#e8f59a", twist=1.0)
    if kind == "amaterasu":
        return swirl(16, "#3a0a3a", "#050307", arms=6, glow="#26062a", twist=2.2)
    if kind == "sand":
        return swirl(16, "#f6e2a8", "#b88a3a", arms=3, glow="#d8b56a", twist=1.8)
    if kind == "ink":
        return swirl(16, "#3a3550", "#0c0a14", arms=3, glow="#1c1828", twist=1.5)
    if kind == "hidden":
        return Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    raise KeyError(kind)


JUTSU_SPRITES = [
    "fire", "water", "wind", "lightning", "earth", "rasengan", "rasenshuriken", "ice", "lava", "bone",
    "ash_bone", "truth", "bijuu_bomb", "karma", "wood", "boil", "amaterasu", "sand", "ink",
]


# --- v1.1: Akatsuki & Boruto update ----------------------------------------------

def ryo() -> Image.Image:
    img = outline(orb(16, "#e8b830", radius=6.2, rim="#9c6b12"), OUT)
    px = img.load()
    for x, y in ((7, 7), (8, 7), (7, 8), (8, 8)):
        px[x, y] = (0, 0, 0, 0)
    for x, y in ((6, 6), (9, 6), (6, 9), (9, 9)):
        px[x, y] = hexc("#9c6b12")
    return img


def kiba() -> Image.Image:
    blade = {"l": hexc("#f4fbff"), "m": hexc("#9fc8ff"), "d": hexc("#3a6fd0")}

    def sparks(img):
        px = img.load()
        for x, y in ((12, 1), (10, 5), (14, 4), (8, 6)):
            px[x, y] = hexc("#fff26a")
    return diag_weapon([
        (0.6, 5.0, 0.8, 0.8, "wrap", WRAP),
        (5.0, 6.0, 1.8, 1.8, "solid", DARK_STEEL),
        (6.0, 16.0, 1.6, 1.3, "blade", blade),
        (16.0, 19.0, 1.3, 0.0, "blade", blade),
    ], extra=sparks)


def nuibari() -> Image.Image:
    def thread(img):
        d = ImageDraw.Draw(img)
        d.arc((0, 9, 6, 15), 90, 300, fill=hexc("#c0262b"))
    return diag_weapon([
        (2.0, 6.0, 0.8, 0.8, "wrap", RED_WRAP),
        (6.0, 6.8, 1.2, 1.2, "solid", DARK_STEEL),
        (6.8, 20.5, 0.6, 0.15, "blade", STEEL),
    ], extra=thread)


def shibuki() -> Image.Image:
    blade = {"l": hexc("#e8eef2"), "m": hexc("#a9b4bf"), "d": hexc("#66717d")}

    def tags(img):
        px = img.load()
        for i in range(4):
            for j in range(2):
                x, y = 7 + i * 2 + j, 9 - i * 2 - j
                if 0 <= x < 16 and 0 <= y < 16 and px[x, y][3]:
                    px[x, y] = hexc("#efe3c2") if j == 0 else hexc("#c0262b")
    return diag_weapon([
        (0.4, 5.0, 0.8, 0.8, "wrap", WRAP),
        (5.0, 6.0, 1.6, 1.6, "solid", DARK_STEEL),
        (6.0, 17.0, 2.8, 2.8, "blade", blade),
        (17.0, 19.5, 2.8, 0.6, "blade", blade),
    ], extra=tags)


def hiramekarei() -> Image.Image:
    blade = {"l": hexc("#dfe9f2"), "m": hexc("#8ea6bd"), "d": hexc("#4d6680")}
    return diag_weapon([
        (0.2, 3.4, 0.8, 0.8, "wrap", WRAP),
        (3.4, 4.2, 1.4, 1.4, "solid", DARK_STEEL),
        (4.2, 6.4, 0.8, 0.8, "wrap", WRAP),
        (6.4, 7.2, 2.4, 2.4, "solid", DARK_STEEL),
        (7.2, 18.0, 3.0, 3.4, "blade", blade),
        (18.0, 20.0, 3.4, 1.5, "blade", blade),
    ])


def explosive_clay() -> Image.Image:
    rows = [
        "................",
        "................",
        "................",
        "..........oo....",
        ".........owwo...",
        "...oo...owwwbo..",
        "..owwo.owwwwo...",
        "..owwwowwwwwo...",
        "...owwwwwwwwo...",
        "....owwwwwwwo...",
        "....owwwwwwo....",
        ".....owwwwo.....",
        "......owwo......",
        ".......oo.......",
        "................",
        "................",
    ]
    return sprite(rows, {"o": hexc("#8a8478"), "w": hexc("#f2eee2"), "b": hexc("#1a1a1a")})


def uchiha_eye() -> Image.Image:
    glyph = [".o.o.", "o...o", ".....", "o...o", ".o.o."]
    return chakra_orb("#d01020", glyph=glyph, glyph_color="#141018", rim="#5a0a0a")


def curse_seal() -> Image.Image:
    glyph = ["o...o", "oo.oo", ".....", "..o..", ".oo.."]
    return chakra_orb("#e2b48a", glyph=glyph, glyph_color="#1a1a1a", rim="#7a5a3a")


def kara_ring() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 4, 13, 15), outline=hexc("#c9a548"))
    d.ellipse((3, 5, 12, 14), outline=hexc("#8a6a22"))
    d.polygon([(7, 0), (10, 3), (7, 6), (4, 3)], fill=hexc("#7a3fb0"))
    img.putpixel((6, 2), hexc("#d8b8ff"))
    return outline(img, OUT)


def blueprint(cap: str) -> Image.Image:
    return scroll(cap, paper="#cfe0f4", ink="#1f4f9a")


def journal() -> Image.Image:
    """Shinobi Journal: a bound notebook with a gold Leaf crest and a red ribbon (v1.2)."""
    rows = [
        "................",
        "..oooooooooooo..",
        ".osbbbbbbbbbbbo.",
        ".oslllllllllllo.",
        ".oslbbbbyybbblo.",
        ".oslbbbyyyybblo.",
        ".oslbbyyddyyblo.",
        ".oslbbyydyyyblo.",
        ".oslbbbyyyybblo.",
        ".oslbbbbybbbblo.",
        ".oslbbbbbybbblo.",
        ".oslllllllllllo.",
        ".osppppppppppro.",
        "..oooooooooooro.",
        "............ro..",
        "................",
    ]
    pal = {"o": OUT, "s": hexc("#2a4a2a"), "b": hexc("#3f6f3a"), "l": hexc("#5a8f4a"), "y": hexc("#e8c65a"),
           "d": hexc("#a8862a"), "p": hexc("#efe3c2"), "r": hexc("#c0262b")}
    return sprite(rows, pal)


def kara_inner_mark() -> Image.Image:
    """v1.3: Kara Inner Mark: a dark disc torn by three white claw slashes."""
    glyph = ["..o.o", ".o.o.", ".o.o.", "o.o..", "o...."]
    return chakra_orb("#2a2430", glyph=glyph, glyph_color="#f4f0e8", rim="#8a7a9a")


def white_karma_seal() -> Image.Image:
    """v1.3: the White Karma, a pale version of the Karma seal."""
    img = karma_seal()
    px = img.load()
    swap = {hexc("#6b2d8f"): hexc("#8a8478"), hexc("#141018"): hexc("#f2eee6"), hexc("#b46cf0"): hexc("#1a1820")}
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y] in swap:
                px[x, y] = swap[px[x, y]]
    return img


# --- v2.0: refined chakra shapes: jutsu projectiles drawn natively at 64x64 -------------------

ORB_HD = 64


def _halo(img: Image.Image, color: str, strength: float = 0.55) -> Image.Image:
    """Soft glow behind the shape: chakra light bleeding into the air."""
    size = img.size[0]
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px = out.load()
    c = hexc(color)
    mid = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            t = math.hypot(x - mid, y - mid) / (size / 2)
            if t < 1:
                px[x, y] = (c[0], c[1], c[2], round(255 * strength * (1 - t) ** 2.2))
    out.alpha_composite(img)
    return out


def _tongues(img: Image.Image, n: int, inner: float, outer: float, color: str, tip: str, seed: int = 1) -> None:
    """Flame tongues licking outwards from a ball."""
    d = ImageDraw.Draw(img)
    size = img.size[0]
    mid = (size - 1) / 2
    rng = random.Random(seed)
    for i in range(n):
        a = i / n * math.tau + rng.uniform(-0.2, 0.2)
        r1, r2 = size * inner, size * (outer + rng.uniform(-0.04, 0.04))
        w = 0.32
        pts = [(mid + math.cos(a - w) * r1, mid + math.sin(a - w) * r1),
               (mid + math.cos(a) * r2, mid + math.sin(a) * r2),
               (mid + math.cos(a + w) * r1, mid + math.sin(a + w) * r1)]
        d.polygon(pts, fill=hexc(color, 230))
        d.line([pts[1], (mid + math.cos(a) * r1, mid + math.sin(a) * r1)], fill=hexc(tip, 200), width=2)


def _arcs(img: Image.Image, n: int, color: str, seed: int = 3) -> None:
    """Jagged lightning arcs crossing the ball."""
    d = ImageDraw.Draw(img)
    size = img.size[0]
    mid = (size - 1) / 2
    rng = random.Random(seed)
    for _ in range(n):
        a = rng.uniform(0, math.tau)
        pts = []
        for k in range(6):
            rr = size * 0.48 * k / 5
            j = rng.uniform(-0.35, 0.35)
            pts.append((mid + math.cos(a + j) * rr, mid + math.sin(a + j) * rr))
        d.line(pts, fill=hexc(color), width=2)


def _blades(img: Image.Image, n: int, color: str, twist: float = 0.6) -> None:
    """Curved shuriken blades (Rasenshuriken)."""
    d = ImageDraw.Draw(img)
    size = img.size[0]
    mid = (size - 1) / 2
    for i in range(n):
        a0 = i / n * math.tau
        pts = []
        for k in range(12):
            t = k / 11
            a = a0 + twist * t
            r = size * (0.18 + 0.32 * t)
            pts.append((mid + math.cos(a) * r, mid + math.sin(a) * r))
        back = [(mid + math.cos(a0 + 0.55 + twist * k / 11 * 0.6) * size * (0.18 + 0.22 * k / 11),
                 mid + math.sin(a0 + 0.55 + twist * k / 11 * 0.6) * size * (0.18 + 0.22 * k / 11)) for k in range(11, -1, -1)]
        d.polygon(pts + back, fill=hexc(color, 215))


def _rock(size: int, base: str, seed: int = 4) -> Image.Image:
    """Faceted boulder: polygon facets lit from the upper left."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    mid = (size - 1) / 2
    pts = []
    for i in range(9):
        a = i / 9 * math.tau
        r = size * rng.uniform(0.36, 0.46)
        pts.append((mid + math.cos(a) * r, mid + math.sin(a) * r))
    c = hexc(base)
    d.polygon(pts, fill=c)
    for i in range(9):
        p1, p2 = pts[i], pts[(i + 1) % 9]
        nx, ny = (p1[0] + p2[0]) / 2 - mid, (p1[1] + p2[1]) / 2 - mid
        light = -(nx * 0.7 + ny * 0.7) / (size * 0.4)
        d.polygon([(mid + rng.uniform(-4, 4), mid + rng.uniform(-4, 4)), p1, p2], fill=shade(c, 1 + light * 0.35))
    d.polygon(pts, outline=shade(c, 0.45))
    return img


def _shard_cluster(size: int, color: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = hexc(color)
    mid = size / 2
    for a, ln, w in ((-1.9, 0.46, 0.09), (-1.2, 0.4, 0.08), (-2.6, 0.38, 0.07), (-0.6, 0.3, 0.07), (2.4, 0.3, 0.06)):
        tip = (mid + math.cos(a) * size * ln, mid + math.sin(a) * size * ln)
        l = (mid + math.cos(a + 1.5) * size * w, mid + math.sin(a + 1.5) * size * w)
        r = (mid + math.cos(a - 1.5) * size * w, mid + math.sin(a - 1.5) * size * w)
        d.polygon([l, tip, r], fill=shade(c, 1.15))
        d.polygon([(mid, mid), tip, r], fill=shade(c, 0.85))
    return img


def _bone_spike(size: int, light: str, dark: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    a, b = (size * 0.12, size * 0.88), (size * 0.9, size * 0.1)
    d.line([a, b], fill=hexc(dark), width=size // 7)
    d.line([a, b], fill=hexc(light), width=size // 11)
    d.ellipse((a[0] - size * 0.09, a[1] - size * 0.09, a[0] + size * 0.09, a[1] + size * 0.09), fill=hexc(light))
    d.polygon([b, (b[0] - size * 0.14, b[1] + size * 0.03), (b[0] - size * 0.03, b[1] + size * 0.14)], fill=hexc(light))
    return img


def jutsu_sprite_hd(kind: str, size: int = ORB_HD) -> Image.Image:
    """Projectile sprite for one jutsu element, drawn at full resolution."""
    if kind == "hidden":
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if kind in ("fire", "amaterasu"):
        dark = kind == "amaterasu"
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        _tongues(img, 10, 0.2, 0.5, "#0a040c" if dark else "#ff7a2a", "#5a1a6a" if dark else "#ffe08a", seed=7 if dark else 1)
        inner = round(size * 0.68)
        ball = (swirl(inner, "#3a0a3a", "#050307", arms=6, glow="#26062a", twist=2.2) if dark
                else swirl(inner, "#fff6c8", "#e2461f", arms=5, glow="#ff9a2a", twist=1.4))
        img.alpha_composite(ball, ((size - inner) // 2, (size - inner) // 2))
        return _halo(img, "#3a0a4a" if dark else "#ff8a2a", 0.4 if dark else 0.55)
    if kind == "water":
        ball = swirl(size, "#e6fbff", "#1f6fd8", arms=2, glow="#56b6ff", twist=1.0)
        shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(shine)
        for x, y, r in ((0.32, 0.3, 0.07), (0.62, 0.24, 0.04), (0.7, 0.6, 0.05)):
            d.ellipse(((x - r) * size, (y - r) * size, (x + r) * size, (y + r) * size), fill=hexc("#ffffff", 170))
        ball.alpha_composite(shine)
        return _halo(ball, "#56b6ff", 0.4)
    if kind == "wind":
        ball = swirl(size, "#ffffff", "#9fe6c4", arms=4, glow="#d8fff0", twist=3.0)
        _blades(ball, 3, "#e8fff6", twist=1.2)
        return _halo(ball, "#c8ffe8", 0.35)
    if kind == "lightning":
        ball = swirl(size, "#ffffff", "#7fb6ff", arms=7, glow="#e8f4ff", twist=4.0)
        _arcs(ball, 5, "#ffffff")
        return _halo(ball, "#9fc8ff", 0.6)
    if kind == "rasengan":
        ball = swirl(size, "#ffffff", "#2f7fd8", arms=3, glow="#7fe0ff", twist=2.6)
        return _halo(ball, "#6fc8ff", 0.65)
    if kind == "rasenshuriken":
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        _blades(img, 4, "#eef8ff", twist=0.5)
        core = swirl(size // 2, "#ffffff", "#2f7fd8", arms=3, glow="#7fe0ff", twist=2.6)
        img.alpha_composite(core, (size // 4, size // 4))
        return _halo(img, "#cfefff", 0.45)
    if kind == "earth":
        return _rock(size, "#8a6a42")
    if kind == "ice":
        return _halo(_shard_cluster(size, "#9fe8ff"), "#dff8ff", 0.3)
    if kind == "lava":
        ball = swirl(size, "#ffd36a", "#5a1608", arms=3, glow="#ff5a1f", twist=1.2)
        _arcs(ball, 4, "#ffb43a", seed=9)
        return _halo(ball, "#ff5a1f", 0.5)
    if kind == "bone":
        return _bone_spike(size, "#fbf6ea", "#b9ae96")
    if kind == "ash_bone":
        return _bone_spike(size, "#e4e4e4", "#5a5a5a")
    if kind == "truth":
        ball = orb(size, "#16121c", rim="#4b3a66", radius=size * 0.42)
        return _halo(ball, "#6a5a8a", 0.3)
    if kind == "bijuu_bomb":
        ball = swirl(size, "#1a0f24", "#5a1b6e", arms=5, glow="#ff3b5c", twist=2.0)
        _arcs(ball, 3, "#ff6a8a", seed=11)
        return _halo(ball, "#ff3b5c", 0.55)
    if kind == "karma":
        ball = swirl(size, "#0e0a14", "#6b2d8f", arms=2, glow="#c78cff", twist=1.6)
        return _halo(ball, "#b46cf0", 0.55)
    if kind == "wood":
        img = _rock(size, "#6b4a2b", seed=13)
        d = ImageDraw.Draw(img)
        for x, y in ((0.3, 0.3), (0.62, 0.4), (0.45, 0.66)):
            d.ellipse(((x - 0.06) * size, (y - 0.04) * size, (x + 0.06) * size, (y + 0.04) * size), fill=hexc("#5aa04a"))
        return img
    if kind == "boil":
        ball = swirl(size, "#fbfff0", "#b8c94a", arms=3, glow="#e8f59a", twist=1.0)
        return _halo(ball, "#f4ffd0", 0.6)
    if kind == "sand":
        ball = swirl(size, "#f6e2a8", "#b88a3a", arms=3, glow="#d8b56a", twist=1.8)
        px = ball.load()
        rng = random.Random(17)
        for _ in range(size * 4):
            x, y = rng.randrange(size), rng.randrange(size)
            if px[x, y][3]:
                px[x, y] = shade(px[x, y], rng.uniform(0.75, 1.2))
        return ball
    if kind == "ink":
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for (cx, cy, r) in ((0.5, 0.5, 0.3), (0.28, 0.36, 0.12), (0.74, 0.66, 0.1), (0.66, 0.24, 0.08), (0.36, 0.74, 0.07)):
            d.ellipse(((cx - r) * size, (cy - r) * size, (cx + r) * size, (cy + r) * size), fill=hexc("#14101e"))
        d.ellipse((0.36 * size, 0.34 * size, 0.46 * size, 0.42 * size), fill=hexc("#5a5070"))
        return img
    raise KeyError(kind)


def sand_gourd() -> Image.Image:
    """v2.0: Gaara's sand gourd: a double-bulb gourd with a strap."""
    rows = [
        "................",
        "......oooo......",
        ".....ossllo.....",
        ".....osslllo....",
        "....ossssllo....",
        "....osssssllo...",
        ".....osssslo....",
        "......ossso.....",
        ".....ossssslo...",
        "....ossssssllo..",
        "...osssssssslo..",
        "...osssssssslo..",
        "...oddsssssslo..",
        "....oddddddso...",
        ".....oooooooo...",
        "................",
    ]
    img = sprite(rows, {"o": OUT, "s": hexc("#c9a46a"), "l": hexc("#e8cf98"), "d": hexc("#8a6a3a")})
    d = ImageDraw.Draw(img)
    d.line([(4, 7), (11, 3)], fill=hexc("#7a1418"))
    return img
