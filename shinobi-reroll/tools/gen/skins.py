"""64x64 humanoid skins (geometry.humanoid.custom layout) painted from a short spec."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from PIL import Image

from .pixel import RGBA, box_faces, hexc, shade

# (uv_u, uv_v, w, h, d) for each part of the player-style 64x64 layout
PARTS = {
    "head": (0, 0, 8, 8, 8),
    "hat": (32, 0, 8, 8, 8),
    "body": (16, 16, 8, 12, 4),
    "jacket": (16, 32, 8, 12, 4),
    "right_arm": (40, 16, 4, 12, 4),
    "right_sleeve": (40, 32, 4, 12, 4),
    "left_arm": (32, 48, 4, 12, 4),
    "left_sleeve": (48, 48, 4, 12, 4),
    "right_leg": (0, 16, 4, 12, 4),
    "right_pants": (0, 32, 4, 12, 4),
    "left_leg": (16, 48, 4, 12, 4),
    "left_pants": (0, 48, 4, 12, 4),
}


@dataclass
class SkinSpec:
    skin: str = "#e8b98f"
    hair: str = "#2b2118"
    hair_style: str = "short"  # short | spiky | long | bald | topknot
    eyes: str = "#2b3a66"
    eye_style: str = "normal"  # normal | sharingan | byakugan | rinnegan | blank | slit
    top: str = "#2b3550"
    top_style: str = "jumpsuit"  # jumpsuit | vest | cloak | robe | wraps
    top_accent: str | None = None
    sleeves: str = "long"  # long | short
    pants: str = "#232a3d"
    shoes: str = "#1d1d24"
    headband: str | None = None  # cloth colour
    headband_scratched: bool = False
    marks: list[str] = field(default_factory=list)  # whiskers | mask | horns | cheek_lines | bandages
    seed: int = 1


def _put(img: Image.Image, x: int, y: int, c: RGBA) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def _fill_face(img, rect, color, rng, jitter=0.05):
    x0, y0, w, h = rect
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            _put(img, x, y, shade(color, 1 + rng.uniform(-jitter, jitter)))


def _faces(part: str):
    u, v, w, h, d = PARTS[part]
    return box_faces(u, v, w, h, d)


def _paint_box(img, part, color, rng, jitter=0.05, top_mul=1.12, bottom_mul=0.8):
    f = _faces(part)
    for name, rect in f.items():
        mul = top_mul if name == "up" else bottom_mul if name == "down" else (0.92 if name in ("east", "west") else 1.0)
        _fill_face(img, rect, shade(color, mul), rng, jitter)


def _rows(img, part, rows: range, color, rng, faces=("north", "south", "east", "west"), jitter=0.05):
    f = _faces(part)
    for name in faces:
        x0, y0, w, h = f[name]
        mul = 0.92 if name in ("east", "west") else 1.0
        for y in rows:
            if 0 <= y < h:
                for x in range(x0, x0 + w):
                    _put(img, x, y0 + y, shade(color, mul * (1 + rng.uniform(-jitter, jitter))))


def paint_skin(spec: SkinSpec) -> Image.Image:
    rng = random.Random(spec.seed)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    skin = hexc(spec.skin)
    hair = hexc(spec.hair)
    top = hexc(spec.top)
    pants = hexc(spec.pants)
    shoes = hexc(spec.shoes)

    # --- head ---
    _paint_box(img, "head", skin, rng, 0.03)
    hf = _faces("head")
    if spec.hair_style != "bald":
        _fill_face(img, hf["up"], hair, rng, 0.08)
        back_rows = 8 if spec.hair_style == "long" else 5
        _rows(img, "head", range(0, back_rows), hair, rng, faces=("south",), jitter=0.08)
        side_rows = 7 if spec.hair_style == "long" else 3
        _rows(img, "head", range(0, side_rows), hair, rng, faces=("east", "west"), jitter=0.08)
        x0, y0, w, h = hf["north"]
        for x in range(w):
            depth = 2 if spec.hair_style in ("spiky", "long") and x % 3 != 1 else 1
            if spec.hair_style == "topknot":
                depth = 1
            for y in range(depth):
                _put(img, x0 + x, y0 + y, shade(hair, 1 + rng.uniform(-0.08, 0.08)))
        if spec.hair_style == "long":
            for y in range(2, 6):
                _put(img, x0, y0 + y, hair)
                _put(img, x0 + w - 1, y0 + y, hair)
    # face details on the north face
    x0, y0, w, h = hf["north"]
    white = hexc("#f4f4f0")
    iris = hexc(spec.eyes)
    eye_y = y0 + 4
    for ex, inner in ((x0 + 1, x0 + 2), (x0 + 5, x0 + 5)):
        outer = ex if ex == x0 + 1 else x0 + 6
        if spec.eye_style == "byakugan":
            _put(img, outer, eye_y, hexc("#eae6f4"))
            _put(img, inner, eye_y, hexc("#d4cce8"))
        elif spec.eye_style == "blank":
            _put(img, outer, eye_y, hexc("#1a1a1a"))
            _put(img, inner, eye_y, hexc("#1a1a1a"))
        elif spec.eye_style == "rinnegan":
            _put(img, outer, eye_y, hexc("#b9a7e0"))
            _put(img, inner, eye_y, hexc("#6b4fa8"))
        elif spec.eye_style == "sharingan":
            _put(img, outer, eye_y, white)
            _put(img, inner, eye_y, hexc("#c0101a"))
        elif spec.eye_style == "slit":
            _put(img, outer, eye_y, hexc("#e8c13a"))
            _put(img, inner, eye_y, hexc("#1a1a1a"))
        else:
            _put(img, outer, eye_y, white)
            _put(img, inner, eye_y, iris)
    _put(img, x0 + 3, y0 + 6, shade(skin, 0.75))
    _put(img, x0 + 4, y0 + 6, shade(skin, 0.75))
    if "whiskers" in spec.marks:
        for y in (5, 6):
            _put(img, x0, y0 + y, shade(skin, 0.55))
            _put(img, x0 + 7, y0 + y, shade(skin, 0.55))
    if "cheek_lines" in spec.marks:
        for y in (5, 6):
            _put(img, x0 + 1, y0 + y, hexc("#8a3a8a"))
            _put(img, x0 + 6, y0 + y, hexc("#8a3a8a"))
    if "mask" in spec.marks:
        mask = hexc("#2a2f3a")
        _rows(img, "head", range(5, 8), mask, rng, faces=("north", "east", "west", "south"), jitter=0.04)
    if "gills" in spec.marks:
        for y in (4, 5, 6):
            _put(img, x0, y0 + y, shade(skin, 0.6))
            _put(img, x0 + 7, y0 + y, shade(skin, 0.6))
    if "eyeshadow" in spec.marks:
        for x in (0, 1, 2, 5, 6, 7):
            _put(img, x0 + x, y0 + 3, hexc("#7a3f9a"))
    if "third_eye" in spec.marks:
        _put(img, x0 + 3, y0 + 2, hexc("#f4f4f0"))
        _put(img, x0 + 4, y0 + 2, hexc("#1a1a1a"))
    if "beard" in spec.marks:
        _rows(img, "head", range(6, 8), hair, rng, faces=("north", "east", "west"), jitter=0.05)
    if "bangs_left" in spec.marks:
        for y in range(1, 6):
            for x in (0, 1, 2):
                _put(img, x0 + x, y0 + y, shade(hair, 1 + rng.uniform(-0.06, 0.06)))
    if "horn" in spec.marks:
        hx, hy, hw, hh = _faces("hat")["north"]
        for y in (0, 1, 2):
            _put(img, hx + 3, hy + y, hexc("#e8e2d6"))
            _put(img, hx + 4, hy + y, hexc("#d6cfc0"))
    if spec.headband:
        cloth = hexc(spec.headband)
        _rows(img, "head", range(2, 4), cloth, rng, faces=("north", "east", "west", "south"), jitter=0.04)
        plate = hexc("#aab4bf")
        for x in range(2, 6):
            for y in (2, 3):
                _put(img, x0 + x, y0 + y, plate if y == 3 or x in (2, 5) else shade(plate, 1.25))
        _put(img, x0 + 3, y0 + 3, hexc("#4f5966"))
        _put(img, x0 + 4, y0 + 2, hexc("#4f5966"))
        if spec.headband_scratched:
            _put(img, x0 + 2, y0 + 3, hexc("#7a1418"))
            _put(img, x0 + 3, y0 + 2, hexc("#7a1418"))
            _put(img, x0 + 4, y0 + 3, hexc("#7a1418"))
            _put(img, x0 + 5, y0 + 2, hexc("#7a1418"))
    # hat layer: spikes / horns for silhouette volume
    if spec.hair_style == "spiky":
        hx0, hy0, hw, hh = _faces("hat")["up"]
        for x in range(hw):
            for y in range(hh):
                if (x + y * 2) % 3 == 0:
                    _put(img, hx0 + x, hy0 + y, shade(hair, 1.1))
        for side in ("east", "west", "south"):
            sx, sy, sw, sh = _faces("hat")[side]
            for x in range(sw):
                if x % 2 == 0:
                    _put(img, sx + x, sy, shade(hair, 1.05))
                    _put(img, sx + x, sy + 1, shade(hair, 0.95))
    if "horns" in spec.marks:
        nx, ny, nw, nh = _faces("hat")["north"]
        horn = hexc("#efe8dc")
        for (x, y) in ((1, 0), (1, 1), (6, 0), (6, 1)):
            _put(img, nx + x, ny + y, horn)

    # --- body ---
    _paint_box(img, "body", top, rng)
    bf = _faces("body")
    bx, by, bw, bh = bf["north"]
    accent = hexc(spec.top_accent) if spec.top_accent else shade(top, 0.6)
    if spec.top_style == "jumpsuit":
        for y in range(bh):
            _put(img, bx + 3, by + y, shade(top, 0.8))
        _rows(img, "body", range(0, 2), accent, rng, faces=("north", "south", "east", "west"))
        _rows(img, "body", range(8, 9), shade(accent, 0.8), rng)
    elif spec.top_style == "vest":
        for y in range(1, 9):
            for x in (1, 2, 5, 6):
                if y in (4, 5, 7, 8):
                    _put(img, bx + x, by + y, shade(top, 0.8))
        _rows(img, "body", range(0, 1), accent, rng)
        _rows(img, "body", range(9, 12), hexc(spec.pants), rng)
    elif spec.top_style in ("cloak", "robe"):
        for y in range(bh):
            _put(img, bx + 3, by + y, shade(top, 0.75))
        _rows(img, "body", range(0, 2), accent, rng, faces=("north", "east", "west", "south"))
    elif spec.top_style == "wraps":
        for y in range(0, bh, 3):
            _rows(img, "body", range(y, y + 1), shade(top, 0.85), rng)
    if spec.top_style == "cloak":
        _clouds(img, "body", rng)

    # --- arms ---
    sleeve_rows = range(0, 10) if spec.sleeves == "long" else range(0, 4)
    for arm in ("right_arm", "left_arm"):
        _paint_box(img, arm, skin, rng, 0.03)
        _rows(img, arm, sleeve_rows, top, rng, faces=("north", "south", "east", "west"))
        x, y, w, d = _faces(arm)["up"]
        _fill_face(img, (x, y, w, d), shade(top, 1.1), rng)
        if spec.top_style == "jumpsuit" and spec.top_accent:
            _rows(img, arm, range(0, 3), accent, rng)
        if "bandages" in spec.marks:
            _rows(img, arm, range(10, 12), hexc("#e8e2d0"), rng)
        if spec.top_style == "cloak":
            _clouds(img, arm, rng, small=True)

    # --- legs ---
    for leg in ("right_leg", "left_leg"):
        _paint_box(img, leg, pants, rng)
        _rows(img, leg, range(9, 10), hexc("#e8e2d0"), rng)  # leg wraps
        _rows(img, leg, range(10, 12), shoes, rng)
        x, y, w, d = _faces(leg)["down"]
        _fill_face(img, (x, y, w, d), shade(shoes, 0.8), rng)

    # --- outer layers ---
    if spec.top_style in ("cloak", "robe"):
        robe = top
        _paint_box_outer(img, "jacket", robe, rng, rows=range(0, 12))
        jx, jy, jw, jh = _faces("jacket")["north"]
        for y in range(jh):
            _put(img, jx + 3, jy + y, shade(robe, 0.7))
        for y in range(0, 2):
            for x in range(jw):
                _put(img, jx + x, jy + y, accent)
        for p in ("right_pants", "left_pants"):
            _paint_box_outer(img, p, robe, rng, rows=range(0, 8))
        if spec.top_style == "cloak":
            _clouds(img, "jacket", rng)
            _clouds(img, "right_pants", rng, small=True)
            _clouds(img, "left_pants", rng, small=True)
    return img


def _paint_box_outer(img, part, color, rng, rows: range):
    f = _faces(part)
    for name in ("north", "south", "east", "west"):
        x0, y0, w, h = f[name]
        for y in rows:
            for x in range(x0, x0 + w):
                _put(img, x, y0 + y, shade(color, (0.92 if name in ("east", "west") else 1.0) * (1 + rng.uniform(-0.05, 0.05))))
    x0, y0, w, d = f["up"]
    _fill_face(img, (x0, y0, w, d), shade(color, 1.1), rng)


def _clouds(img, part, rng, small: bool = False):
    red, white = hexc("#c0262b"), hexc("#f4f1ea")
    f = _faces(part)
    for name in ("north", "south"):
        x0, y0, w, h = f[name]
        spots = 1 if small else 2
        for _ in range(spots):
            cx = x0 + rng.randrange(0, max(1, w - 2))
            cy = y0 + rng.randrange(2, max(3, h - 2))
            for dx, dy in ((0, 0), (1, 0), (1, -1), (2, 0)):
                _put(img, cx + dx, cy + dy, red)
            _put(img, cx, cy + 1, white)
            _put(img, cx + 2, cy + 1, white)


NPC_SKINS: dict[str, SkinSpec] = {
    "shadow_clone": SkinSpec(skin="#f0c08f", hair="#f2cf3c", hair_style="spiky", eyes="#2f7fd8", top="#f07a1a",
                             top_accent="#1d2a4a", pants="#f07a1a", shoes="#1d2a4a", headband="#1f3f7a",
                             marks=["whiskers"], seed=3),
    "leaf_shinobi": SkinSpec(skin="#e2b48a", hair="#4a3222", hair_style="short", eyes="#2b2118", top="#5f7f3a",
                             top_style="vest", top_accent="#3d5226", pants="#1f2a44", shoes="#1d1d24",
                             headband="#1f3f7a", marks=["bandages"], seed=5),
    "rogue_ninja": SkinSpec(skin="#d9a77d", hair="#1c1a1f", hair_style="spiky", eyes="#5a5a5a", top="#3b3f46",
                            top_style="wraps", pants="#2a2d33", shoes="#151519", headband="#2a2a2a",
                            headband_scratched=True, marks=["mask", "bandages"], seed=7),
    "akatsuki_rogue": SkinSpec(skin="#e6c3a0", hair="#151319", hair_style="long", eye_style="sharingan",
                               top="#17151c", top_style="cloak", top_accent="#2a2730", pants="#17151c",
                               shoes="#2d2a4a", headband="#2a2a2a", headband_scratched=True,
                               marks=["cheek_lines"], seed=9),
    "white_zetsu": SkinSpec(skin="#eceee4", hair="#eceee4", hair_style="bald", eye_style="blank",
                            top="#e3e6da", top_style="wraps", pants="#dfe2d4", shoes="#cfd3c4", seed=11),
    "itachi": SkinSpec(skin="#e8c8a8", hair="#14121a", hair_style="long", eye_style="sharingan", top="#17151c",
                       top_style="cloak", top_accent="#2a2730", pants="#17151c", shoes="#2d2a4a", headband="#2a2a2a",
                       headband_scratched=True, marks=["cheek_lines"], seed=21),
    "kisame": SkinSpec(skin="#7f9cbc", hair="#2a3f6a", hair_style="spiky", eyes="#f2f2e8", top="#17151c",
                       top_style="cloak", top_accent="#2a2730", pants="#17151c", shoes="#2d2a4a", headband="#2a2a2a",
                       headband_scratched=True, marks=["gills"], seed=23),
    "deidara": SkinSpec(skin="#efcfa8", hair="#f2cf3c", hair_style="long", eyes="#3a6fd0", top="#17151c",
                        top_style="cloak", top_accent="#2a2730", pants="#17151c", shoes="#2d2a4a", headband="#2a2a2a",
                        headband_scratched=True, marks=["bangs_left"], seed=25),
    "orochimaru": SkinSpec(skin="#f0eee6", hair="#141218", hair_style="long", eye_style="slit", top="#e8e4d6",
                           top_style="robe", top_accent="#6b4a8f", pants="#3a3550", shoes="#2a2a30",
                           marks=["eyeshadow"], seed=27),
    "kinshiki": SkinSpec(skin="#efe8e0", hair="#f2efe8", hair_style="long", eye_style="byakugan", top="#ece6d8",
                         top_style="robe", top_accent="#8a6a3a", pants="#d8d0c0", shoes="#5a4a3a",
                         marks=["horns", "beard"], seed=29),
    "jigen": SkinSpec(skin="#e2c4a4", hair="#1a1a20", hair_style="short", eye_style="rinnegan", top="#2e2b33",
                      top_style="robe", top_accent="#5a4a6e", pants="#222026", shoes="#151519", marks=["horn"],
                      seed=31),
    "puppet_karasu": SkinSpec(skin="#9c6b3a", hair="#1a1a1a", hair_style="spiky", eyes="#f2d24a", top="#4a3a5e",
                              top_style="wraps", pants="#3a2e48", shoes="#2a2030", marks=["third_eye"], seed=33),
    "momoshiki": SkinSpec(skin="#f2eee8", hair="#f4f2ee", hair_style="long", eye_style="byakugan",
                          top="#f1ede4", top_style="robe", top_accent="#6b4a8f", pants="#e8e3d8",
                          shoes="#3a2f45", marks=["horns"], seed=13),
}
