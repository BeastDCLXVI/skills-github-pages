"""Parametric box models (tailed beasts, Ten-Tails, toad, training post, decoy log).

Each model is built from bones + cubes, box-UV packed automatically and painted
from per-cube roles, so geometry, texture and animation always agree.
Model space follows Bedrock: 16 units = 1 block, the front faces -Z.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from PIL import Image

from .core import FMT_ANIMATION, FMT_GEOMETRY
from .pixel import box_faces, hexc, shade


@dataclass
class Cube:
    bone: str
    origin: tuple[float, float, float]
    size: tuple[int, int, int]
    role: str
    pivot: tuple[float, float, float] | None = None
    rotation: tuple[float, float, float] | None = None
    uv: tuple[int, int] | None = None
    mirror: bool = False


@dataclass
class Bone:
    name: str
    parent: str | None
    pivot: tuple[float, float, float]
    rotation: tuple[float, float, float] | None = None


@dataclass
class Model:
    key: str
    palette: dict[str, str]
    scale: float = 1.0
    bones: list[Bone] = field(default_factory=list)
    cubes: list[Cube] = field(default_factory=list)
    tex_w: int = 0
    tex_h: int = 0
    features: dict = field(default_factory=dict)

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None) -> str:
        if any(b.name == name for b in self.bones):
            raise ValueError(f"{self.key}: duplicate bone {name}")
        self.bones.append(Bone(name, parent, tuple(round(p, 3) for p in pivot),
                               tuple(round(r, 2) for r in rotation) if rotation else None))
        return name

    def cube(self, bone, origin, size, role, pivot=None, rotation=None) -> Cube:
        size = tuple(max(1, int(round(s))) for s in size)
        c = Cube(bone, tuple(round(o, 3) for o in origin), size, role, pivot, rotation)
        self.cubes.append(c)
        return c

    # -- UV packing --------------------------------------------------------
    def pack(self) -> None:
        regions = []
        for c in self.cubes:
            w, h, d = c.size
            regions.append((c, 2 * (w + d), h + d))
        width = 64
        widest = max(r[1] for r in regions)
        area = sum(r[1] * r[2] for r in regions)
        while width < widest or width * width < area * 1.25:
            width *= 2
        order = sorted(regions, key=lambda r: (-r[2], -r[1]))
        x = y = row_h = 0
        for c, rw, rh in order:
            if x + rw > width:
                x, y, row_h = 0, y + row_h, 0
            c.uv = (x, y)
            x += rw
            row_h = max(row_h, rh)
        used_h = y + row_h
        height = 16
        while height < used_h:
            height *= 2
        self.tex_w, self.tex_h = width, height

    # -- export ------------------------------------------------------------
    def geometry(self) -> dict:
        bones = []
        for b in self.bones:
            jb: dict = {"name": b.name, "pivot": list(b.pivot)}
            if b.parent:
                jb["parent"] = b.parent
            if b.rotation:
                jb["rotation"] = list(b.rotation)
            cubes = []
            for c in self.cubes:
                if c.bone != b.name:
                    continue
                jc: dict = {"origin": list(c.origin), "size": list(c.size), "uv": list(c.uv)}
                if c.rotation:
                    jc["pivot"] = list(c.pivot or c.origin)
                    jc["rotation"] = list(c.rotation)
                cubes.append(jc)
            if cubes:
                jb["cubes"] = cubes
            bones.append(jb)
        extent = self.extent()
        return {
            "format_version": FMT_GEOMETRY,
            "minecraft:geometry": [{
                "description": {
                    "identifier": f"geometry.shinobi.{self.key}",
                    "texture_width": self.tex_w,
                    "texture_height": self.tex_h,
                    "visible_bounds_width": round(extent[0] / 16 + 2, 1),
                    "visible_bounds_height": round(extent[1] / 16 + 2, 1),
                    "visible_bounds_offset": [0, round(extent[1] / 32, 2), 0],
                },
                "bones": bones,
            }],
        }

    def extent(self) -> tuple[float, float]:
        xs, ys, zs = [], [], []
        for c in self.cubes:
            for i, arr in enumerate((xs, ys, zs)):
                arr.append(c.origin[i])
                arr.append(c.origin[i] + c.size[i])
        horiz = max(max(xs) - min(xs), max(zs) - min(zs)) * 1.6
        return horiz, max(ys) * 1.3

    # -- texture -------------------------------------------------------------
    def texture(self, seed: int = 0) -> Image.Image:
        rng = random.Random(seed)
        img = Image.new("RGBA", (self.tex_w, self.tex_h), (0, 0, 0, 0))
        px = img.load()
        for c in self.cubes:
            w, h, d = c.size
            faces = box_faces(c.uv[0], c.uv[1], w, h, d)
            base = hexc(self.palette.get(c.role, self.palette["body"]))
            for fname, (fx, fy, fw, fh) in faces.items():
                mul = {"up": 1.15, "down": 0.72, "east": 0.9, "west": 0.9, "south": 0.95, "north": 1.0}[fname]
                if c.role in ("body", "tail", "leg", "arm") and fname == "down" and "belly" in self.palette:
                    face_col = hexc(self.palette["belly"])
                else:
                    face_col = shade(base, mul)
                for yy in range(fh):
                    for xx in range(fw):
                        col = shade(face_col, 1 + rng.uniform(-0.06, 0.06))
                        col = self._pattern(c, fname, xx, yy, fw, fh, col, rng)
                        px[fx + xx, fy + yy] = col
            if c.role == "head":
                self._face(img, faces["north"])
            if c.role == "eye_bump":
                fx, fy, fw, fh = faces["north"]
                px[fx + fw // 2, fy + fh // 2] = hexc(self.palette.get("pupil", "#141018"))
                px[fx + fw // 2 - 1, fy + fh // 2] = hexc(self.palette.get("pupil", "#141018"))
            if self.features.get("end_grain") and c.role == "body":
                ring = hexc(self.palette.get("head", "#c9a46a"))
                for fname in ("up", "down"):
                    fx, fy, fw, fh = faces[fname]
                    cx, cy = (fw - 1) / 2, (fh - 1) / 2
                    for yy in range(fh):
                        for xx in range(fw):
                            r = max(abs(xx - cx), abs(yy - cy))
                            px[fx + xx, fy + yy] = shade(ring, 0.8 if int(r) % 2 else 1.05) if r < min(fw, fh) / 2 - 0.5 else shade(base, 0.9)
            if c.role in ("tail", "tentacle") and self.features.get("tail_tip"):
                tip = hexc(self.features["tail_tip"])
                if self.features.get("tip_bones") and c.bone in self.features["tip_bones"]:
                    for fname in ("north", "south", "east", "west", "up", "down"):
                        fx, fy, fw, fh = faces[fname]
                        for yy in range(fh):
                            for xx in range(fw):
                                if fname in ("north", "up", "down") or rng.random() < 0.5 or yy > fh // 2:
                                    px[fx + xx, fy + yy] = shade(tip, 1 + rng.uniform(-0.05, 0.05))
        return img

    def _pattern(self, c, fname, x, y, w, h, col, rng):
        pat = self.features.get("pattern")
        accent = hexc(self.palette.get("accent", "#000000"))
        if c.role in ("eye_white",):
            return col
        if pat == "tribal" and c.role in ("body", "head", "tail", "arm", "leg"):
            if (x + y * 2) % 7 == 0 or (fname == "up" and (x - y) % 6 == 0):
                return accent
        if pat == "rings" and c.role in ("tail", "tentacle"):
            if y % 4 == 0:
                return accent
        if pat == "spots" and c.role in ("body", "tail"):
            if rng.random() < 0.06:
                return accent
        if pat == "ripples" and c.role in ("body", "head", "tail", "arm"):
            if (x * 3 + y * 5) % 11 == 0:
                return accent
        if pat == "flames" and c.role in ("body", "tail", "head", "leg"):
            if fname in ("east", "west", "up") and (y + (x % 3)) % 5 == 0:
                return accent
        return col

    def _face(self, img, rect):
        fx, fy, fw, fh = rect
        px = img.load()
        eye = hexc(self.palette.get("eye", "#f0d040"))
        pupil = hexc(self.palette.get("pupil", "#141018"))
        style = self.features.get("eyes", "pair")
        if style == "none":
            return
        ey = fy + max(1, round(fh * 0.3))
        if style == "single":
            cx = fx + fw // 2
            for dy in range(-1, 2):
                for dx in range(-2, 2):
                    if 0 <= cx + dx < img.width:
                        px[cx + dx, ey + 1 + dy] = eye
            px[cx - 1, ey + 1] = pupil
            px[cx, ey + 1] = pupil
            for dx in (-2, 1):
                px[cx + dx, ey] = shade(eye, 0.6)
            return
        ew = 2 if fw >= 8 else 1
        positions = [fx + max(0, round(fw * 0.18)), fx + fw - max(0, round(fw * 0.18)) - ew]
        for ex in positions:
            for dx in range(ew):
                px[ex + dx, ey] = eye
            if style == "slit":
                px[ex + (1 if ex > fx + fw // 2 else 0) if ew > 1 else ex, ey] = pupil
            elif style == "pair":
                px[ex + (0 if ex > fx + fw // 2 else ew - 1), ey] = pupil
            if self.features.get("eye_marks"):
                mark = hexc(self.features["eye_marks"])
                for dx in range(-1, ew + 1):
                    if 0 <= ex + dx < img.width and ey + 1 < img.height:
                        px[ex + dx, ey + 1] = mark
        if fh >= 6 and self.features.get("mouth", True):
            my = fy + fh - 2
            for x in range(fx + 2, fx + fw - 2):
                px[x, my] = shade(hexc(self.palette.get("head", self.palette["body"])), 0.45)
            if self.features.get("teeth"):
                for x in range(fx + 2, fx + fw - 2, 2):
                    px[x, my - 1] = hexc("#f4f1ea")

    # -- animations ----------------------------------------------------------
    def animations(self) -> dict:
        key = self.key
        anims: dict = {}
        legs = self.features.get("legs", [])
        arms = self.features.get("arms", [])
        tails = self.features.get("tail_chains", [])
        gait = round(38.17 / max(1.0, self.scale * 0.8), 2)
        move_bones = {}
        for i, leg in enumerate(legs):
            phase = "" if i in (0, 3) else "-"
            move_bones[leg] = {"rotation": [f"{phase}math.cos(query.anim_time * {gait}) * 32.0", 0.0, 0.0]}
        for i, arm in enumerate(arms):
            phase = "-" if i == 0 else ""
            move_bones[arm] = {"rotation": [f"{phase}math.cos(query.anim_time * {gait}) * 24.0", 0.0, 0.0]}
        if self.features.get("hop"):
            move_bones["body"] = {"position": [0.0, f"math.abs(math.sin(query.anim_time * {gait} * 0.5)) * 3.0", 0.0]}
        if move_bones:
            anims[f"animation.shinobi.{key}.move"] = {
                "loop": True, "anim_time_update": "query.modified_distance_moved", "bones": move_bones}
        idle_bones: dict = {}
        for i, chain in enumerate(tails):
            for j, bone in enumerate(chain):
                amp_y = 10.0 if j == 0 else 7.0
                amp_x = 5.0 if j == 0 else 6.0
                ph = i * 40 + j * 35
                idle_bones[bone] = {"rotation": [
                    f"math.cos(query.life_time * 50.0 + {ph}) * {amp_x}",
                    f"math.sin(query.life_time * 60.0 + {ph}) * {amp_y}",
                    0.0]}
        if "body" in [b.name for b in self.bones] and not self.features.get("hop"):
            idle_bones["body"] = {"scale": [1.0, "1.0 + math.sin(query.life_time * 90.0) * 0.015", 1.0]}
        for wing in self.features.get("wings", []):
            idle_bones[wing] = {"rotation": [0.0, 0.0, f"math.sin(query.life_time * 400.0) * 6.0"]}
        if idle_bones:
            anims[f"animation.shinobi.{key}.idle"] = {"loop": True, "bones": idle_bones}
        if any(b.name == "head" for b in self.bones):
            anims[f"animation.shinobi.{key}.look"] = {
                "loop": True,
                "bones": {"head": {"rotation": ["query.target_x_rotation * 0.6", "query.target_y_rotation * 0.6", 0.0]}},
            }
        return {"format_version": FMT_ANIMATION, "animations": anims}


# --- builders -----------------------------------------------------------------

def _tails(m: Model, count: int, base: tuple[float, float, float], segs: int, width: float, seg_len: float,
           spread: float, lift: float, role: str = "tail", taper: float = 0.82, parent: str = "body",
           tip_segments: int = 0) -> None:
    chains = []
    tips = []
    for i in range(count):
        yaw = 0.0 if count == 1 else -spread + 2 * spread * i / (count - 1)
        name = m.bone(f"tail{i}", parent, base, rotation=(lift, yaw, 0))
        chain = [name]
        z = base[2]
        w = width
        prev = name
        for j in range(segs):
            bname = name if j == 0 else m.bone(f"tail{i}_{j}", prev, (base[0], base[1], z), rotation=(-lift * 0.25, 0, 0))
            if j:
                chain.append(bname)
            m.cube(bname, (base[0] - w / 2, base[1] - w / 2, z), (w, w, seg_len), role)
            if j >= segs - tip_segments:
                tips.append(bname)
            z += seg_len - 0.5
            w = max(1.0, w * taper)
            prev = bname
        chains.append(chain)
    m.features["tail_chains"] = chains
    if tips:
        m.features["tip_bones"] = tips


def quadruped(key: str, palette: dict, *, body=(12, 10, 20), head=(10, 9, 8), snout=(5, 4, 4), leg=(4, 9, 4),
              tails=1, tail_w=4, tail_len=8, tail_segs=3, tail_spread=55, tail_lift=38, ears="fox",
              horns=0, shell=False, wings=0, scale=1.0, legs=True, features=None, extra=None) -> Model:
    m = Model(key, palette, scale)
    m.features.update(features or {})
    bw, bh, bl = body
    lw, lh, _ = leg
    if not legs:
        lh = 0
    m.bone("root")
    body_y = lh
    m.bone("body", "root", (0, body_y + bh / 2, 0))
    m.cube("body", (-bw / 2, body_y, -bl / 2), (bw, bh, bl), "body")
    if shell:
        sh_w, sh_h, sh_l = bw + 6, 6, bl + 4
        m.cube("body", (-sh_w / 2, body_y + bh - 2, -sh_l / 2), (sh_w, sh_h, sh_l), "shell")
        for i in range(5):
            m.cube("body", (-1.5 + (i % 2) * 3 - 3 * (i == 4), body_y + bh + 4, -sh_l / 2 + 3 + i * (sh_l - 6) / 4),
                   (3, 3, 3), "spike")
    legs_names = []
    if legs:
        for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
            x = sx * (bw / 2 - lw / 2)
            z = sz * (bl / 2 - lw / 2 - 1)
            n = m.bone(f"leg{i}", "root", (x, lh, z))
            m.cube(n, (x - lw / 2, 0, z - lw / 2), (lw, lh, lw), "leg")
            legs_names.append(n)
    m.features["legs"] = legs_names
    hw, hh, hd = head
    head_y = body_y + bh * 0.45
    hz = -bl / 2
    m.bone("head", "body", (0, head_y + hh / 2, hz))
    m.cube("head", (-hw / 2, head_y, hz - hd), (hw, hh, hd), "head")
    if snout:
        sw, sh, sd = snout
        m.cube("head", (-sw / 2, head_y, hz - hd - sd), (sw, sh, sd), "snout")
    top = head_y + hh
    if ears == "fox":
        for sx in (-1, 1):
            m.cube("head", (sx * hw / 2 - (3 if sx > 0 else 0), top, hz - hd + 2), (3, 6, 2), "ear")
    elif ears == "cat":
        for sx in (-1, 1):
            m.cube("head", (sx * hw / 2 - (3 if sx > 0 else 0), top, hz - hd + 2), (3, 3, 1), "ear")
    elif ears == "round":
        for sx in (-1, 1):
            m.cube("head", (sx * hw / 2 - (3 if sx > 0 else 0) - sx, top - 1, hz - hd + 3), (3, 3, 2), "ear")
    elif ears == "stalks":
        for sx in (-1, 1):
            m.cube("head", (sx * 2 - 0.5, top, hz - hd + 1), (1, 4, 1), "ear")
    for i in range(horns):
        side = -1 if i % 2 == 0 else 1
        rank = i // 2
        hx = side * (hw / 2 - 1.5 - rank * 1.5)
        m.cube("head", (hx - 1, top - 1, hz - hd / 2 - rank * 2), (2, 7 - rank, 2), "horn",
               pivot=(hx, top, hz - hd / 2), rotation=(-25 - rank * 10, 0, side * (18 + rank * 8)))
    if wings:
        wing_names = []
        for i in range(wings):
            side = -1 if i % 2 == 0 else 1
            row = i // 2
            n = m.bone(f"wing{i}", "body", (side * 2, body_y + bh, -bl / 2 + 4 + row * 5),
                       rotation=(0, side * (25 + row * 18), side * 12))
            m.cube(n, (side * 2 - (14 if side < 0 else 0), body_y + bh, -bl / 2 + 3 + row * 5), (14, 1, 5), "wing")
            wing_names.append(n)
        m.features["wings"] = wing_names
    if tails:
        _tails(m, tails, (0, body_y + bh * 0.72, bl / 2 - 1), tail_segs, tail_w, tail_len, tail_spread if tails > 1 else 0,
               tail_lift, tip_segments=1 if m.features.get("tail_tip") else 0)
    if extra:
        extra(m, body_y, bh, bl, head)
    m.pack()
    return m


def upright(key: str, palette: dict, *, torso=(14, 16, 10), head=(10, 10, 9), leg=(6, 10, 6), arm=(5, 15, 5),
            tails=1, tail_w=5, tail_len=8, tail_segs=3, tail_spread=60, tail_lift=20, ears="round", horns=0,
            snout=None, tail_role="tail", scale=1.0, features=None) -> Model:
    m = Model(key, palette, scale)
    m.features.update(features or {})
    tw, th, td = torso
    lw, lh, _ = leg
    aw, ah, _ = arm
    m.bone("root")
    m.bone("body", "root", (0, lh + th / 2, 0))
    m.cube("body", (-tw / 2, lh, -td / 2), (tw, th, td), "body")
    m.cube("body", (-tw / 2 + 2, lh + 1, -td / 2 - 1), (tw - 4, th - 5, 1), "belly")
    legs = []
    for i, sx in enumerate((-1, 1)):
        x = sx * (tw / 2 - lw / 2 - 0.5)
        n = m.bone(f"leg{i}", "root", (x, lh, 0))
        m.cube(n, (x - lw / 2, 0, -lw / 2), (lw, lh, lw), "leg")
        legs.append(n)
    m.features["legs"] = legs
    arms = []
    for i, sx in enumerate((-1, 1)):
        x = sx * (tw / 2 + aw / 2)
        n = m.bone(f"arm{i}", "body", (x, lh + th - 2, 0))
        m.cube(n, (x - aw / 2, lh + th - ah, -aw / 2), (aw, ah, aw), "arm")
        arms.append(n)
    m.features["arms"] = arms
    hw, hh, hd = head
    m.bone("head", "body", (0, lh + th, 0))
    m.cube("head", (-hw / 2, lh + th, -hd / 2 - 1), (hw, hh, hd), "head")
    top = lh + th + hh
    if snout:
        sw, sh, sd = snout
        m.cube("head", (-sw / 2, lh + th + 1, -hd / 2 - 1 - sd), (sw, sh, sd), "snout")
    if ears == "round":
        for sx in (-1, 1):
            m.cube("head", (sx * hw / 2 - (3 if sx > 0 else 0), top - 1, -1), (3, 3, 2), "ear")
    for i in range(horns):
        side = -1 if i % 2 == 0 else 1
        rank = i // 2
        hx = side * (hw / 2 - 1 - rank * 2)
        m.cube("head", (hx - 1, top - 1, -1 - rank * 2), (2, 8 - rank * 2, 2), "horn",
               pivot=(hx, top, -1), rotation=(-10 - rank * 12, 0, side * (30 + rank * 12)))
    if tails:
        _tails(m, tails, (0, lh + th * 0.25, td / 2 - 1), tail_segs, tail_w, tail_len, tail_spread if tails > 1 else 0,
               tail_lift, role=tail_role)
    m.pack()
    return m


def toad() -> Model:
    def eyes(m, body_y, bh, bl, head):
        hw, hh, hd = head
        top = body_y + bh * 0.45 + hh
        for sx in (-1, 1):
            m.cube("head", (sx * (hw / 2 - 2) - 2, top - 1, -bl / 2 - hd + 1), (4, 3, 4), "eye_bump")

    m = quadruped("summoned_toad", {"body": "#c4553a", "belly": "#e8c79a", "head": "#c4553a", "leg": "#b04a32",
                                     "snout": "#c4553a", "ear": "#c4553a", "eye": "#141018", "pupil": "#141018",
                                     "eye_bump": "#f2d24a", "accent": "#7a2f22"},
                  body=(18, 10, 16), head=(18, 8, 8), snout=None, leg=(5, 5, 5), tails=0, ears=None,
                  scale=1.6, features={"pattern": "spots", "hop": True, "eyes": "none", "teeth": False}, extra=eyes)
    return m


def training_post() -> Model:
    m = Model("training_post", {"body": "#9c6b3a", "head": "#e2c26a", "arm": "#8a5a2b", "leg": "#6b4a2b"})
    m.bone("root")
    m.bone("body", "root", (0, 0, 0))
    m.cube("body", (-1.5, 2, -1.5), (3, 22, 3), "body")
    m.cube("body", (-4, 0, -4), (8, 2, 8), "leg")
    m.cube("body", (-7, 16, -1), (14, 2, 2), "arm")
    m.cube("body", (-1, 8, -6), (2, 2, 12), "arm")
    m.bone("head", "body", (0, 24, 0))
    m.cube("head", (-3, 24, -3), (6, 6, 6), "head")
    m.features.update({"eyes": "pair", "mouth": False})
    m.palette.update({"eye": "#c0262b", "pupil": "#c0262b"})
    m.pack()
    return m


def decoy_log() -> Model:
    m = Model("substitution_log", {"body": "#6b4a2b", "head": "#c9a46a", "accent": "#4a3220"})
    m.bone("root")
    m.bone("body", "root", (0, 0, 0))
    m.cube("body", (-4, 0, -4), (8, 15, 8), "body")
    m.features.update({"pattern": "rings", "end_grain": True})
    m.pack()
    return m


BIJUU = [
    # key, display name, tails, builder kwargs
    ("shukaku", "Shukaku", 1, dict(
        kind="upright", palette={"body": "#cfae6a", "belly": "#e8d6a8", "head": "#cfae6a", "arm": "#c4a160",
                                  "leg": "#c4a160", "tail": "#cfae6a", "ear": "#cfae6a", "accent": "#3c4f9c",
                                  "eye": "#f2d24a", "pupil": "#141018", "snout": "#cfae6a"},
        torso=(16, 16, 12), head=(12, 10, 10), leg=(6, 8, 6), arm=(5, 13, 5), tail_w=6, tail_len=9, tail_segs=3,
        tail_lift=25, ears="round", scale=2.3, features={"pattern": "tribal", "eyes": "pair", "teeth": True})),
    ("matatabi", "Matatabi", 2, dict(
        kind="quad", palette={"body": "#2f5fd0", "belly": "#7fb8ff", "head": "#2f5fd0", "leg": "#284fb0",
                               "tail": "#2f5fd0", "ear": "#1d3a8a", "snout": "#3a6fe0", "accent": "#8fd8ff",
                               "eye": "#7fe06a", "pupil": "#141018"},
        body=(10, 9, 20), head=(9, 8, 7), snout=(5, 3, 3), leg=(3, 10, 3), tail_w=3, tail_len=9, tail_spread=25,
        ears="cat", scale=2.2, features={"pattern": "flames", "eyes": "slit"})),
    ("isobu", "Isobu", 3, dict(
        kind="quad", palette={"body": "#6f8a7a", "belly": "#a9b89a", "head": "#6f8a7a", "leg": "#5d7566",
                               "tail": "#6f8a7a", "shell": "#4f5f52", "spike": "#d8d0b8", "snout": "#6f8a7a",
                               "eye": "#d8262b", "pupil": "#141018", "ear": "#6f8a7a"},
        body=(14, 8, 18), head=(8, 7, 6), snout=None, leg=(5, 5, 5), tail_w=4, tail_len=7, tail_spread=35,
        tail_lift=10, ears=None, shell=True, scale=2.3, features={"eyes": "single"})),
    ("son_goku", "Son Goku", 4, dict(
        kind="upright", palette={"body": "#b8322a", "belly": "#d8705a", "head": "#b8322a", "arm": "#a82a24",
                                  "leg": "#a82a24", "tail": "#b8322a", "horn": "#efe8dc", "ear": "#b8322a",
                                  "snout": "#e8b48a", "eye": "#f2d24a", "pupil": "#141018", "accent": "#5a2a8a"},
        torso=(15, 15, 11), head=(10, 9, 9), leg=(6, 9, 6), arm=(6, 16, 6), tail_w=4, tail_len=8, tail_segs=3,
        horns=1, snout=(6, 4, 2), scale=2.3, features={"teeth": True})),
    ("kokuo", "Kokuo", 5, dict(
        kind="quad", palette={"body": "#ece6dc", "belly": "#d8d0c4", "head": "#ece6dc", "leg": "#d8d0c4",
                               "tail": "#ece6dc", "horn": "#b8b0a0", "snout": "#ece6dc", "ear": "#ece6dc",
                               "eye": "#3a6fd0", "pupil": "#141018", "accent": "#c0262b"},
        body=(11, 10, 20), head=(7, 7, 7), snout=(5, 5, 6), leg=(3, 13, 3), tail_w=3, tail_len=8, tail_spread=40,
        ears=None, horns=4, scale=2.1, features={"eye_marks": "#c0262b"})),
    ("saiken", "Saiken", 6, dict(
        kind="quad", palette={"body": "#dfe8d8", "belly": "#c8d4c0", "head": "#dfe8d8", "tail": "#d0dcc8",
                               "ear": "#bfcab4", "snout": "#dfe8d8", "eye": "#141018", "pupil": "#141018",
                               "accent": "#9ab88a", "leg": "#dfe8d8"},
        body=(12, 8, 24), head=(10, 9, 6), snout=None, legs=False, tail_w=3, tail_len=6, tail_spread=45,
        tail_lift=30, ears="stalks", scale=2.2, features={"pattern": "spots", "eyes": "pair", "mouth": True})),
    ("chomei", "Chomei", 7, dict(
        kind="quad", palette={"body": "#6fae3a", "belly": "#a8d070", "head": "#5f9a30", "leg": "#3d6a20",
                               "tail": "#6fae3a", "wing": "#bfe8f0", "horn": "#e8e4c8", "snout": "#5f9a30",
                               "eye": "#f2a024", "pupil": "#141018", "ear": "#5f9a30"},
        body=(10, 8, 18), head=(8, 7, 6), snout=None, leg=(2, 8, 2), tail_w=3, tail_len=7, tail_spread=0,
        ears=None, horns=1, wings=6, scale=2.1, features={"eyes": "pair"})),
    ("gyuki", "Gyuki", 8, dict(
        kind="upright", palette={"body": "#5a4a5e", "belly": "#7a6a7e", "head": "#5a4a5e", "arm": "#4e4052",
                                  "leg": "#4e4052", "tentacle": "#5a4a5e", "horn": "#efe8dc", "ear": "#5a4a5e",
                                  "snout": "#6a5a6e", "eye": "#f2d24a", "pupil": "#141018", "accent": "#efe8dc"},
        torso=(16, 15, 12), head=(10, 9, 9), leg=(5, 6, 5), arm=(6, 15, 6), tail_w=5, tail_len=8, tail_segs=4,
        tail_spread=80, tail_lift=-10, horns=2, snout=(6, 4, 2), tail_role="tentacle", scale=2.4,
        features={"pattern": "rings"})),
    ("kurama", "Kurama", 9, dict(
        kind="quad", palette={"body": "#e2701f", "belly": "#f0a55a", "head": "#e2701f", "leg": "#c95f18",
                               "tail": "#e2701f", "ear": "#e2701f", "snout": "#e2701f", "eye": "#d8262b",
                               "pupil": "#141018", "accent": "#5a1a0a"},
        body=(13, 11, 20), head=(11, 9, 8), snout=(6, 4, 5), leg=(4, 11, 4), tail_w=4, tail_len=9, tail_segs=3,
        tail_spread=70, tail_lift=42, ears="fox", scale=2.5,
        features={"eyes": "slit", "eye_marks": "#5a1a0a", "teeth": True, "tail_tip": "#f6c38a"})),
]

JUUBI = ("juubi", "Ten-Tails", 10, dict(
    kind="upright", palette={"body": "#6e665e", "belly": "#8a8278", "head": "#6e665e", "arm": "#615a52",
                              "leg": "#615a52", "tail": "#6e665e", "horn": "#d8d0c4", "ear": "#6e665e",
                              "eye": "#c0101a", "pupil": "#141018", "accent": "#4a4440", "snout": "#6e665e"},
    torso=(18, 18, 13), head=(12, 11, 10), leg=(7, 10, 7), arm=(7, 18, 7), tail_w=5, tail_len=9, tail_segs=3,
    tail_spread=85, tail_lift=30, horns=6, ears=None, scale=3.2,
    features={"eyes": "single", "pattern": "ripples", "teeth": True}))


def build_beast(key, tails, kw) -> Model:
    kw = dict(kw)
    kind = kw.pop("kind")
    palette = kw.pop("palette")
    if kind == "quad":
        return quadruped(key, palette, tails=tails, **kw)
    return upright(key, palette, tails=tails, **kw)


def serpent(key: str = "summoned_snake") -> Model:
    """Giant summoning snake: a head plus a swaying chain of tapering body segments."""
    palette = {"body": "#6a4a8e", "belly": "#d8c890", "head": "#6a4a8e", "tail": "#6a4a8e", "snout": "#5a3a7e",
               "eye": "#f2d24a", "pupil": "#141018", "accent": "#3a2a5e", "horn": "#efe8dc"}
    m = Model(key, palette, scale=2.2)
    m.features.update({"eyes": "slit", "pattern": "spots", "teeth": True})
    m.bone("root")
    m.bone("body", "root", (0, 4, 0))
    m.cube("body", (-4, 0, -4), (8, 8, 8), "body")
    m.bone("head", "body", (0, 6, -4))
    m.cube("head", (-5, 2, -13), (10, 7, 9), "head")
    m.cube("head", (-3.5, 2, -17), (7, 4, 4), "snout")
    for sx in (-1, 1):
        m.cube("head", (sx * 3.5 - 0.5, 8.5, -8), (1, 3, 1), "horn", pivot=(sx * 3.5, 9, -7.5), rotation=(-30, 0, 0))
    _tails(m, 1, (0, 4, 3.5), 6, 7.0, 8.0, 0, 0, role="tail", taper=0.86)
    m.pack()
    return m


def slug() -> Model:
    return quadruped("summoned_slug", {"body": "#e8f0ff", "belly": "#c8d8f0", "head": "#e8f0ff", "ear": "#b8c8f0",
                                        "eye": "#141018", "pupil": "#141018", "accent": "#4a7ad8", "leg": "#e8f0ff",
                                        "snout": "#e8f0ff", "tail": "#e8f0ff"},
                     body=(10, 7, 20), head=(8, 7, 6), snout=None, legs=False, tails=0, ears="stalks", scale=1.8,
                     features={"pattern": "tribal", "eyes": "none", "mouth": True})
