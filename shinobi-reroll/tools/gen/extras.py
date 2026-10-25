"""Armor attachables + layers, particle effects + atlas, pack icons."""
from __future__ import annotations

import math
import random
import zlib

from PIL import Image, ImageDraw

from . import sprites as S
from .core import FMT_ATTACHABLE, FMT_PARTICLE, Build, ident
from .hd import FLAT, MatCanvas, render_hd
from .pixel import box_faces, hexc, outline, scale, shade, swirl

# --- armor -------------------------------------------------------------------------

HEAD = box_faces(0, 0, 8, 8, 8)
BODY = box_faces(16, 16, 8, 12, 4)
ARM = box_faces(40, 16, 4, 12, 4)


def _put(px, x, y, c):
    if 0 <= x < 64 and 0 <= y < 32:
        px[x, y] = c


def _band(px, faces, rows, color, rng):
    for name in ("north", "south", "east", "west"):
        x0, y0, w, h = faces[name]
        for y in rows:
            for x in range(x0, x0 + w):
                _put(px, x, y0 + y, shade(color, 1 + rng.uniform(-0.05, 0.05)))


ARMOR_HD_SCALE = 4


def armor_layer(style: str, cloth: str | None = None, scratched: bool = False) -> Image.Image:
    """Armor layer designed on the 64x32 vanilla armor layout, rendered HD (256x128)."""
    faces = [r for f in (HEAD, BODY, ARM) for r in f.values()]
    return render_hd(design_armor(style, cloth, scratched), ARMOR_HD_SCALE, faces, seed=zlib.crc32(style.encode()),
                     fringe=False)


def design_armor(style: str, cloth: str | None = None, scratched: bool = False) -> MatCanvas:
    rng = random.Random(zlib.crc32(style.encode()))
    img = MatCanvas(64, 32)
    img.material = "cloth"
    px = img.load()
    if style == "headband":
        c = hexc(cloth or "#1f3f7a")
        _band(px, HEAD, range(1, 3), c, rng)
        x0, y0, w, h = HEAD["north"]
        img.material = "metal"
        img.feature("plate", x0 + 1, y0 + 1, 6, 2, scratched)
        plate, dark = hexc("#b4bec8"), hexc("#4f5966")
        for x in range(1, 7):
            for y in (1, 2):
                _put(px, x0 + x, y0 + y, shade(plate, 1.2) if y == 1 else plate)
        _put(px, x0 + 3, y0 + 2, dark)
        _put(px, x0 + 4, y0 + 1, dark)
        _put(px, x0 + 4, y0 + 2, dark)
        if scratched:
            for i, x in enumerate(range(1, 7)):
                _put(px, x0 + x, y0 + 1 + (i % 2), hexc("#7a1418"))
        img.material = "cloth"
        sx, sy, sw, sh = HEAD["south"]
        for y in range(3, 6):
            _put(px, sx + 3, sy + y, c)
            _put(px, sx + 4, sy + y + 1, c)
    elif style == "mask":
        white, red, dark = hexc("#f1eee6"), hexc("#c0262b"), hexc("#1a1a1a")
        x0, y0, w, h = HEAD["north"]
        img.material = "skin"  # porcelain: smooth top-lit gradient
        for y in range(1, 8):
            for x in range(8):
                _put(px, x0 + x, y0 + y, shade(white, 1 + rng.uniform(-0.03, 0.03)))
        img.material = FLAT
        for x, y in ((1, 3), (2, 3), (5, 3), (6, 3)):
            _put(px, x0 + x, y0 + y, dark)
        for x, y in ((1, 2), (6, 2), (2, 5), (5, 5), (3, 6), (4, 6)):
            _put(px, x0 + x, y0 + y, red)
        img.material = "cloth"
        for side in ("east", "west"):
            sx, sy, sw, sh = HEAD[side]
            for y in range(2, 4):
                for x in range(sw):
                    _put(px, sx + x, sy + y, hexc("#3a3a44"))
    elif style == "hat":
        white, red = hexc("#f4f1ea"), hexc("#c0262b")
        x0, y0, w, h = HEAD["up"]
        for y in range(h):
            for x in range(w):
                _put(px, x0 + x, y0 + y, shade(white, 1 + rng.uniform(-0.04, 0.04)))
        _band(px, HEAD, range(0, 3), white, rng)
        _band(px, HEAD, range(3, 4), hexc("#c9c3b6"), rng)
        fx, fy, fw, fh = HEAD["north"]
        img.material = FLAT
        for x, y in ((3, 0), (4, 0), (2, 1), (3, 1), (4, 1), (5, 1), (3, 2), (4, 2)):
            _put(px, fx + x, fy + y, red)
    elif style in ("vest", "cloak"):
        c = hexc(cloth or "#5f7f3a")
        for name, rect in BODY.items():
            x0, y0, w, h = rect
            for y in range(h):
                for x in range(w):
                    _put(px, x0 + x, y0 + y, shade(c, (1.12 if name == "up" else 0.9 if name in ("east", "west") else 1.0)
                                                     * (1 + rng.uniform(-0.05, 0.05))))
        arm_rows = range(0, 12) if style == "cloak" else range(0, 3)
        for name, rect in ARM.items():
            x0, y0, w, h = rect
            rows = range(h) if name in ("up", "down") else arm_rows
            if style != "cloak" and name == "down":
                continue
            for y in rows:
                for x in range(w):
                    _put(px, x0 + x, y0 + y, shade(c, 1 + rng.uniform(-0.05, 0.05)))
        bx, by, bw, bh = BODY["north"]
        if style == "vest":
            pocket = shade(c, 0.78)
            for y in (4, 5, 7, 8):
                for x in (1, 2, 5, 6):
                    _put(px, bx + x, by + y, pocket)
            for y in range(bh):
                _put(px, bx + 3, by + y, shade(c, 0.7))
            sx, sy, sw, sh = BODY["south"]
            for x, y in ((3, 3), (4, 3), (3, 4), (4, 4)):
                _put(px, sx + x, sy + y, hexc("#c0262b"))
        else:
            for face, spots in ((BODY["north"], ((1, 3), (5, 8))), (BODY["south"], ((2, 2), (4, 7), (1, 10))),
                                (ARM["north"], ((0, 5),)), (ARM["south"], ((1, 8),))):
                fx, fy, fw, fh = face
                for sx_, sy_ in spots:
                    img.feature("cloud", fx + sx_, fy + sy_)
            for x in range(bw):
                _put(px, bx + x, by, hexc("#2a2730"))
                _put(px, bx + x, by + 1, hexc("#2a2730"))
            for y in range(bh):
                _put(px, bx + 3, by + y, shade(c, 0.6))
    return img


def emit_armor(b: Build, items) -> None:
    for it in items:
        if not it.armor:
            continue
        a = it.armor
        tex = f"textures/models/armor/{it.id}"
        b.rp.png(tex + ".png", armor_layer(a["style"], a.get("cloth"), a.get("scratched", False)))
        layer_var = "variable.helmet_layer_visible = 0.0;" if a["slot"] == "head" else "variable.chest_layer_visible = 0.0;"
        b.rp.json(f"attachables/{it.id}.json", {
            "format_version": FMT_ATTACHABLE,
            "minecraft:attachable": {"description": {
                "identifier": ident(it.id),
                "materials": {"default": "armor", "enchanted": "armor_enchanted"},
                "textures": {"default": tex, "enchanted": "textures/misc/enchanted_actor_glint"},
                "geometry": {"default": a["geometry"]},
                "scripts": {"parent_setup": layer_var},
                "render_controllers": ["controller.render.armor"],
            }},
        })


# --- particles -----------------------------------------------------------------------

ATLAS = "textures/particle/shinobi_particles"
CELL = 32  # v2.0: HD particle sprites (were 8px)
GRID = ["dot", "spark", "smoke", "ring",
        "leaf", "shard", "flame", "tomoe",
        "crescent", "bolt", "droplet", "petal",
        "grain", "sparkle", "wisp", "ink"]
CELLS = {name: ((i % 4) * CELL, (i // 4) * CELL) for i, name in enumerate(GRID)}
ATLAS_W, ATLAS_H = 4 * CELL, 4 * CELL


def _cell_canvas():
    """Draw each sprite at 4x and downsample, so every edge is antialiased."""
    big = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    return big, ImageDraw.Draw(big)


def _radial(alpha_fn) -> Image.Image:
    img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    c = (CELL - 1) / 2
    for y in range(CELL):
        for x in range(CELL):
            a = alpha_fn(math.hypot(x - c, y - c) / c, x, y)
            if a > 0:
                img.putpixel((x, y), (255, 255, 255, max(0, min(255, int(255 * a)))))
    return img


def _sprite(name: str) -> Image.Image:
    S = CELL * 4
    big, d = _cell_canvas()
    W = (255, 255, 255, 255)
    if name == "dot":
        return _radial(lambda r, x, y: (1 - r) ** 1.6 if r < 1 else 0)
    if name == "spark":
        img = _radial(lambda r, x, y: max(0.0, 1 - r * 3.2))
        dd = ImageDraw.Draw(img)
        c = CELL // 2
        dd.line([(c, 1), (c, CELL - 2)], fill=W, width=2)
        dd.line([(1, c), (CELL - 2, c)], fill=W, width=2)
        return img
    if name == "smoke":  # soft, faint puff of overlapping blobs (v2.0: lighter)
        blobs = ((0.42, 0.55, 0.3), (0.62, 0.45, 0.28), (0.5, 0.32, 0.24), (0.3, 0.38, 0.2), (0.7, 0.66, 0.22))

        def puff(r, x, y):
            a = 0.0
            for bx, by, br in blobs:
                dd = math.hypot(x / (CELL - 1) - bx, y / (CELL - 1) - by) / br
                a = max(a, (1 - dd) ** 1.2 if dd < 1 else 0)
            return 0.5 * a
        return _radial(puff)
    if name == "ring":
        return _radial(lambda r, x, y: max(0.0, 1 - abs(r - 0.78) * 7) + max(0.0, 0.35 - abs(r - 0.6) * 4))
    if name == "leaf":
        d.polygon([(S * 0.1, S * 0.9), (S * 0.25, S * 0.35), (S * 0.65, S * 0.1), (S * 0.9, S * 0.12),
                   (S * 0.85, S * 0.45), (S * 0.55, S * 0.8)], fill=W)
        d.line([(S * 0.12, S * 0.88), (S * 0.8, S * 0.2)], fill=(190, 190, 190, 255), width=S // 28)
    elif name == "shard":
        d.polygon([(S * 0.5, S * 0.04), (S * 0.78, S * 0.42), (S * 0.56, S * 0.96), (S * 0.24, S * 0.5)], fill=W)
        d.polygon([(S * 0.5, S * 0.04), (S * 0.56, S * 0.96), (S * 0.24, S * 0.5)], fill=(225, 225, 225, 255))
    elif name == "flame":  # a tongue of fire with two side licks
        d.polygon([(S * 0.52, S * 0.0), (S * 0.62, S * 0.28), (S * 0.78, S * 0.18), (S * 0.76, S * 0.48),
                   (S * 0.86, S * 0.66), (S * 0.72, S * 0.92), (S * 0.5, S * 0.99), (S * 0.28, S * 0.92),
                   (S * 0.14, S * 0.66), (S * 0.24, S * 0.42), (S * 0.22, S * 0.24), (S * 0.38, S * 0.36)], fill=W)
    elif name == "tomoe":  # comma: a round head with a tail curling around it
        d.ellipse((S * 0.34, S * 0.4, S * 0.84, S * 0.9), fill=W)
        for i in range(24):
            t = i / 23
            a = math.pi * (1.05 + 0.75 * t)
            rr = S * (0.25 + 0.12 * t)
            cx, cy = S * 0.59 + math.cos(a) * rr, S * 0.65 + math.sin(a) * rr
            w = S * (0.15 * (1 - t) + 0.02)
            d.ellipse((cx - w, cy - w, cx + w, cy + w), fill=W)
    elif name == "crescent":  # wind blade
        d.ellipse((S * 0.05, S * 0.2, S * 0.95, S * 0.9), fill=W)
        d.ellipse((S * 0.05, S * 0.02, S * 0.95, S * 0.7), fill=(0, 0, 0, 0))
    elif name == "bolt":  # jagged lightning arc
        pts = [(0.15, 0.02), (0.55, 0.32), (0.38, 0.42), (0.78, 0.7), (0.6, 0.74), (0.9, 0.98)]
        d.line([(x * S, y * S) for x, y in pts], fill=W, width=S // 12, joint="curve")
    elif name == "droplet":
        d.ellipse((S * 0.22, S * 0.36, S * 0.78, S * 0.92), fill=W)
        d.polygon([(S * 0.5, S * 0.04), (S * 0.74, S * 0.5), (S * 0.26, S * 0.5)], fill=W)
    elif name == "petal":
        d.ellipse((S * 0.2, S * 0.1, S * 0.8, S * 0.9), fill=W)
        d.polygon([(S * 0.5, S * 0.0), (S * 0.62, S * 0.2), (S * 0.38, S * 0.2)], fill=(0, 0, 0, 0))
    elif name == "grain":
        for (cx, cy, r) in ((0.3, 0.35, 0.12), (0.62, 0.3, 0.09), (0.5, 0.62, 0.14), (0.75, 0.7, 0.08), (0.25, 0.72, 0.07)):
            d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=W)
    elif name == "sparkle":
        c = S / 2
        d.polygon([(c, 0), (c + S * 0.09, c - S * 0.09), (S, c), (c + S * 0.09, c + S * 0.09), (c, S),
                   (c - S * 0.09, c + S * 0.09), (0, c), (c - S * 0.09, c - S * 0.09)], fill=W)
    elif name == "wisp":  # soft vertical streak: chakra flow, shockwave dust
        return _radial(lambda r, x, y: max(0.0, 1 - abs(x - (CELL - 1) / 2) / 5) * max(0.0, 1 - abs(y - (CELL - 1) / 2) / 15) * 0.9)
    elif name == "ink":
        for (cx, cy, r) in ((0.5, 0.5, 0.32), (0.25, 0.35, 0.14), (0.75, 0.68, 0.12), (0.68, 0.22, 0.09)):
            d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=W)
    return big.resize((CELL, CELL), Image.LANCZOS)


def particle_atlas() -> Image.Image:
    img = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    for name, (u, v) in CELLS.items():
        img.alpha_composite(_sprite(name), (u, v))
    return img


def _uv(cell: str) -> dict:
    u, v = CELLS[cell]
    return {"texture_width": ATLAS_W, "texture_height": ATLAS_H, "uv": [u, v], "uv_size": [CELL, CELL]}


def _tint(default: tuple[float, float, float], fade=True) -> dict:
    r, g, b = default
    alpha = "1 - variable.particle_age / variable.particle_lifetime" if fade else 1
    return {"color": [f"variable.color.r ?? {r}", f"variable.color.g ?? {g}", f"variable.color.b ?? {b}", alpha]}


def _effect(name: str, components: dict, material: str = "particles_alpha") -> dict:
    return {"format_version": FMT_PARTICLE, "particle_effect": {
        "description": {"identifier": ident(name),
                        "basic_render_parameters": {"material": material, "texture": ATLAS}},
        "components": components}}


def _billboard(cell: str, size) -> dict:
    return {"size": [size, size], "facing_camera_mode": "rotate_xyz", "uv": _uv(cell)}


def _once(n: int, t: float = 0.05) -> dict:
    return {"minecraft:emitter_rate_instant": {"num_particles": n}, "minecraft:emitter_lifetime_once": {"active_time": t}}


PARTICLES = {
    "chakra_burst": _effect("chakra_burst", {
        "minecraft:emitter_rate_instant": {"num_particles": 26},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(2.5, 6.0)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.35, 0.8)"},
        "minecraft:particle_appearance_billboard": _billboard("dot", "0.22 * (1 - variable.particle_age / variable.particle_lifetime) + 0.05"),
        "minecraft:particle_appearance_tinting": _tint((0.35, 0.75, 1.0)),
    }, material="particles_blend"),
    "chakra_aura": _effect("chakra_aura", {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.55, "plane_normal": "y", "surface_only": True,
                                         "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": "Math.random(0.8, 1.8)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 0.9)"},
        "minecraft:particle_appearance_billboard": _billboard("flame", "0.25 - variable.particle_age * 0.15"),
        "minecraft:particle_appearance_tinting": _tint((0.35, 0.75, 1.0)),
    }, material="particles_blend"),
    "smoke_poof": _effect("smoke_poof", {
        "minecraft:emitter_rate_instant": {"num_particles": 9},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(0.6, 1.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 2.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.35, 0.7)"},
        "minecraft:particle_appearance_billboard": _billboard("smoke", "0.35 + variable.particle_age * 0.5"),
        "minecraft:particle_appearance_tinting": _tint((0.92, 0.92, 0.94)),
    }),
    "trail": _effect("trail", {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.2,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.2, 0.4)"},
        "minecraft:particle_appearance_billboard": _billboard("dot", "0.2 - variable.particle_age * 0.4"),
        "minecraft:particle_appearance_tinting": _tint((1.0, 0.6, 0.2)),
    }, material="particles_blend"),
    "shockwave": _effect("shockwave", {
        "minecraft:emitter_rate_instant": {"num_particles": 48},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.5, "plane_normal": "y", "surface_only": True,
                                         "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(6.0, 9.0)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 0.8)"},
        "minecraft:particle_appearance_billboard": _billboard("wisp", "0.4"),
        "minecraft:particle_appearance_tinting": _tint((0.85, 0.9, 1.0)),
    }, material="particles_blend"),
    "sparks": _effect("sparks", {
        "minecraft:emitter_rate_instant": {"num_particles": 18},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(4.0, 10.0)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 6.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.15, 0.35)"},
        "minecraft:particle_appearance_billboard": _billboard("spark", "0.18"),
        "minecraft:particle_appearance_tinting": _tint((0.75, 0.88, 1.0), fade=False),
    }, material="particles_blend"),
    "leaves": _effect("leaves", {
        "minecraft:emitter_rate_instant": {"num_particles": 20},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 1.0, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": "Math.random(1.0, 3.0)",
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)", "rotation_rate": "Math.random(-360, 360)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -1.5, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.9, 1.6)"},
        "minecraft:particle_appearance_billboard": _billboard("leaf", "0.2"),
        "minecraft:particle_appearance_tinting": _tint((0.45, 0.75, 0.3)),
    }),
    "mark": _effect("mark", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.0},
        "minecraft:particle_appearance_billboard": _billboard("ring", "0.4 + variable.particle_age * 0.2"),
        "minecraft:particle_appearance_tinting": _tint((0.85, 0.8, 1.0)),
    }, material="particles_blend"),
    "black_flame": _effect("black_flame", {
        "minecraft:emitter_rate_instant": {"num_particles": 12},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 0.6, 0.4], "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": "Math.random(0.6, 1.6)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.4, 0.8)"},
        "minecraft:particle_appearance_billboard": _billboard("flame", "0.3 - variable.particle_age * 0.2"),
        "minecraft:particle_appearance_tinting": _tint((0.08, 0.02, 0.1)),
    }),
    "spiral": _effect("spiral", {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_instant": {"num_particles": 30},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.35, 0.6)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            "math.cos(variable.particle_age * 1440 + variable.particle_random_1 * 360) * (0.15 + variable.particle_random_2 * 0.45)",
            "math.sin(variable.particle_age * 1440 + variable.particle_random_3 * 360) * (0.15 + variable.particle_random_2 * 0.45)",
            "math.sin(variable.particle_age * 1440 + variable.particle_random_1 * 360) * (0.15 + variable.particle_random_2 * 0.45)",
        ]},
        "minecraft:particle_appearance_billboard": _billboard("dot", "0.12"),
        "minecraft:particle_appearance_tinting": _tint((0.55, 0.85, 1.0)),
    }, material="particles_blend"),
    "tomoe": _effect("tomoe", {
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.9},
        "minecraft:particle_motion_parametric": {"relative_position": [
            "math.cos(variable.particle_age * 540 + variable.particle_random_1 * 360) * 0.6",
            "0",
            "math.sin(variable.particle_age * 540 + variable.particle_random_1 * 360) * 0.6",
        ]},
        "minecraft:particle_appearance_billboard": _billboard("tomoe", "0.22"),
        "minecraft:particle_appearance_tinting": _tint((0.85, 0.05, 0.08), fade=False),
    }),
    "shards": _effect("shards", {
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(2.0, 5.0)",
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)", "rotation_rate": 180},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 0.8},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 1.0)"},
        "minecraft:particle_appearance_billboard": _billboard("shard", "0.18"),
        "minecraft:particle_appearance_tinting": _tint((0.75, 0.95, 1.0)),
    }),
}


PARTICLES.update({
    # --- v2.0: refined chakra shapes ------------------------------------------------
    "sphere": _effect("sphere", {  # Rasengan-like sphere: particles orbiting on random great circles
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        **_once(36),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.25, 0.4)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            "math.cos(variable.particle_age * 1080 + variable.particle_random_1 * 360) * 0.42",
            "math.sin(variable.particle_age * 1080 + variable.particle_random_1 * 360) * math.cos(variable.particle_random_2 * 360) * 0.42",
            "math.sin(variable.particle_age * 1080 + variable.particle_random_1 * 360) * math.sin(variable.particle_random_2 * 360) * 0.42",
        ]},
        "minecraft:particle_appearance_billboard": _billboard("dot", "0.1"),
        "minecraft:particle_appearance_tinting": _tint((0.45, 0.8, 1.0), fade=False),
    }, material="particles_blend"),
    "helix": _effect("helix", {  # double helix rising around a shinobi: cloaks, buffs, healing
        "minecraft:emitter_local_space": {"position": True, "rotation": False},
        **_once(28),
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.6 + variable.particle_random_3 * 0.3"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            "math.cos(variable.particle_age * 600 + (variable.particle_random_1 > 0.5 ? 180 : 0)) * 0.65",
            "variable.particle_age * 2.6",
            "math.sin(variable.particle_age * 600 + (variable.particle_random_1 > 0.5 ? 180 : 0)) * 0.65",
        ]},
        "minecraft:particle_appearance_billboard": _billboard("sparkle", "0.14 - variable.particle_age * 0.08"),
        "minecraft:particle_appearance_tinting": _tint((0.45, 0.8, 1.0)),
    }, material="particles_blend"),
    "ring": _effect("ring", {  # expanding flat ring of chakra: impacts and bursts
        **_once(40),
        "minecraft:emitter_shape_disc": {"radius": 0.3, "plane_normal": "y", "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(5.0, 6.5)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.35, 0.5)"},
        "minecraft:particle_appearance_billboard": _billboard("dot", "0.16"),
        "minecraft:particle_appearance_tinting": _tint((0.6, 0.85, 1.0)),
    }, material="particles_blend"),
    "sparkle": _effect("sparkle", {
        **_once(10),
        "minecraft:emitter_shape_sphere": {"radius": 0.8, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(0.2, 0.8)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 1.0)"},
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 90)", "rotation_rate": 120},
        "minecraft:particle_appearance_billboard": _billboard("sparkle", "0.16 * (1 - variable.particle_age / variable.particle_lifetime)"),
        "minecraft:particle_appearance_tinting": _tint((0.7, 1.0, 0.75)),
    }, material="particles_blend"),
    "wisp": _effect("wisp", {  # chakra flowing upwards
        **_once(8),
        "minecraft:emitter_shape_disc": {"radius": 0.6, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": "Math.random(1.0, 2.2)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.4},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.4, 0.7)"},
        "minecraft:particle_appearance_billboard": {"size": [0.12, "0.45 - variable.particle_age * 0.3"],
                                                   "facing_camera_mode": "lookat_y", "uv": _uv("wisp")},
        "minecraft:particle_appearance_tinting": _tint((0.45, 0.8, 1.0)),
    }, material="particles_blend"),
    # --- element impacts --------------------------------------------------------------
    "flame": _effect("flame", {
        **_once(16, 0.1),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(0.8, 2.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 2.2, 0], "linear_drag_coefficient": 2.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.35, 0.7)"},
        "minecraft:particle_appearance_billboard": _billboard("flame", "0.34 - variable.particle_age * 0.3"),
        "minecraft:particle_appearance_tinting": {"color": {
            "interpolant": "variable.particle_age / variable.particle_lifetime",
            "gradient": {"0.0": [1.0, 0.95, 0.6, 1.0], "0.4": [1.0, 0.55, 0.15, 0.9], "1.0": [0.5, 0.12, 0.05, 0.0]}}},
    }, material="particles_blend"),
    "splash": _effect("splash", {
        **_once(18),
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(2.0, 4.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -12, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.4, 0.8)"},
        "minecraft:particle_appearance_billboard": {"size": [0.1, 0.14], "facing_camera_mode": "lookat_direction",
                                                   "uv": _uv("droplet")},
        "minecraft:particle_appearance_tinting": _tint((0.45, 0.7, 1.0)),
    }, material="particles_blend"),
    "gust": _effect("gust", {  # spinning wind blades
        **_once(10),
        "minecraft:emitter_shape_disc": {"radius": 0.4, "plane_normal": "y", "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(3.0, 6.0)",
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)", "rotation_rate": 720},
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2.4},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.3, 0.55)"},
        "minecraft:particle_appearance_billboard": _billboard("crescent", "0.4"),
        "minecraft:particle_appearance_tinting": _tint((0.8, 1.0, 0.92)),
    }, material="particles_blend"),
    "arc": _effect("arc", {  # flickering lightning arcs
        **_once(8),
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.08, 0.2)"},
        "minecraft:particle_appearance_billboard": _billboard("bolt", "Math.random(0.3, 0.55)"),
        "minecraft:particle_appearance_tinting": _tint((0.8, 0.9, 1.0), fade=False),
    }, material="particles_blend"),
    "debris": _effect("debris", {
        **_once(14),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(2.0, 5.0)",
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)", "rotation_rate": 240},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 0.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 0.9)"},
        "minecraft:particle_appearance_billboard": _billboard("shard", "0.2"),
        "minecraft:particle_appearance_tinting": _tint((0.6, 0.45, 0.3), fade=False),
    }),
    "grains": _effect("grains", {
        **_once(22),
        "minecraft:emitter_shape_sphere": {"radius": 0.7, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(0.8, 2.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -5, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.5, 1.0)"},
        "minecraft:particle_appearance_billboard": _billboard("grain", "0.14"),
        "minecraft:particle_appearance_tinting": _tint((0.85, 0.72, 0.45)),
    }),
    "ink": _effect("ink", {
        **_once(10),
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(1.0, 2.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -4, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.4, 0.8)"},
        "minecraft:particle_appearance_billboard": _billboard("ink", "0.22"),
        "minecraft:particle_appearance_tinting": _tint((0.08, 0.06, 0.12)),
    }),
    "petals": _effect("petals", {  # genjutsu petals and feathers
        **_once(14, 0.1),
        "minecraft:emitter_shape_disc": {"radius": 1.2, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": "Math.random(0.5, 1.5)",
        "minecraft:particle_initial_spin": {"rotation": "Math.random(0, 360)", "rotation_rate": "Math.random(-200, 200)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -0.9, 0], "linear_drag_coefficient": 1.4},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(1.0, 1.8)"},
        "minecraft:particle_appearance_billboard": _billboard("petal", "0.16"),
        "minecraft:particle_appearance_tinting": _tint((1.0, 0.7, 0.82)),
    }),
})


def emit_particles(b: Build) -> None:
    b.rp.png(ATLAS + ".png", particle_atlas())
    for name, eff in PARTICLES.items():
        b.rp.json(f"particles/{name}.particle.json", eff)


# --- pack icons ------------------------------------------------------------------------

def pack_icon(kind: str) -> Image.Image:
    size = 128
    img = Image.new("RGBA", (size, size), hexc("#141826"))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = math.hypot(x - 64, y - 64) / 90
            base = hexc("#1d2a4a") if kind == "bp" else hexc("#3a1d4a")
            px[x, y] = shade(base, 1.2 - t * 0.6)
    ball = scale(swirl(32, "#ffffff", "#2f7fd8" if kind == "bp" else "#b46cf0", arms=3,
                       glow="#7fe0ff" if kind == "bp" else "#e8c8ff"), 3)
    img.alpha_composite(ball, (16, 6))
    band = scale(S.headband("#1f3f7a" if kind == "bp" else "#2a2a2a", plate_scratched=kind != "bp"), 4)
    img.alpha_composite(band, (32, 56))
    return img
