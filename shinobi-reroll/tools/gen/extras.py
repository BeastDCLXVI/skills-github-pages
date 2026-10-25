"""Armor attachables + layers, particle effects + atlas, pack icons."""
from __future__ import annotations

import math
import random
import zlib

from PIL import Image, ImageDraw

from . import sprites as S
from .core import FMT_ATTACHABLE, FMT_PARTICLE, Build, ident
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


def armor_layer(style: str, cloth: str | None = None, scratched: bool = False) -> Image.Image:
    rng = random.Random(zlib.crc32(style.encode()))
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    px = img.load()
    if style == "headband":
        c = hexc(cloth or "#1f3f7a")
        _band(px, HEAD, range(1, 3), c, rng)
        x0, y0, w, h = HEAD["north"]
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
        sx, sy, sw, sh = HEAD["south"]
        for y in range(3, 6):
            _put(px, sx + 3, sy + y, c)
            _put(px, sx + 4, sy + y + 1, c)
    elif style == "mask":
        white, red, dark = hexc("#f1eee6"), hexc("#c0262b"), hexc("#1a1a1a")
        x0, y0, w, h = HEAD["north"]
        for y in range(1, 8):
            for x in range(8):
                _put(px, x0 + x, y0 + y, shade(white, 1 + rng.uniform(-0.03, 0.03)))
        for x, y in ((1, 3), (2, 3), (5, 3), (6, 3)):
            _put(px, x0 + x, y0 + y, dark)
        for x, y in ((1, 2), (6, 2), (2, 5), (5, 5), (3, 6), (4, 6)):
            _put(px, x0 + x, y0 + y, red)
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
            red, white = hexc("#c0262b"), hexc("#f4f1ea")
            for face, spots in ((BODY["north"], ((1, 3), (5, 8))), (BODY["south"], ((2, 2), (4, 7), (1, 10))),
                                (ARM["north"], ((0, 5),)), (ARM["south"], ((1, 8),))):
                fx, fy, fw, fh = face
                for sx_, sy_ in spots:
                    for dx, dy in ((0, 0), (1, 0), (1, -1), (2, 0)):
                        _put(px, fx + sx_ + dx, fy + sy_ + dy, red)
                    _put(px, fx + sx_, fy + sy_ + 1, white)
                    _put(px, fx + sx_ + 2, fy + sy_ + 1, white)
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
CELLS = {"dot": (0, 0), "spark": (8, 0), "smoke": (16, 0), "ring": (24, 0),
         "leaf": (0, 8), "shard": (8, 8), "flame": (16, 8), "tomoe": (24, 8)}


def particle_atlas() -> Image.Image:
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # soft dot
    for y in range(8):
        for x in range(8):
            r = math.hypot(x - 3.5, y - 3.5)
            if r < 3.6:
                img.putpixel((x, y), (255, 255, 255, int(255 * max(0.0, 1 - (r / 3.6) ** 2))))
    # spark star
    for i in range(8):
        img.putpixel((8 + i, 3), (255, 255, 255, 200 if i in (0, 7) else 255))
        img.putpixel((8 + 3, i), (255, 255, 255, 200 if i in (0, 7) else 255))
    for p in ((9, 1), (13, 1), (9, 5), (13, 5)):
        img.putpixel(p, (255, 255, 255, 140))
    # smoke puff
    for y in range(8):
        for x in range(8):
            r = math.hypot(x - 3.5, y - 3.5) + (0.6 if (x * 7 + y * 3) % 5 == 0 else 0)
            if r < 3.8:
                v = 235 - int(r * 12)
                img.putpixel((16 + x, y), (v, v, v, int(220 * (1 - r / 3.8) ** 0.6)))
    # ring
    d.ellipse((24, 0, 31, 7), outline=(255, 255, 255, 255))
    d.ellipse((25, 1, 30, 6), outline=(255, 255, 255, 120))
    # leaf
    d.polygon([(1, 14), (4, 9), (7, 9), (5, 13)], fill=(255, 255, 255, 255))
    d.line([(1, 14), (5, 10)], fill=(200, 200, 200, 255))
    # shard
    d.polygon([(11, 8), (14, 11), (11, 15), (8, 11)], fill=(255, 255, 255, 255))
    # flame tongue
    d.polygon([(19, 8), (22, 12), (21, 15), (17, 15), (16, 12)], fill=(255, 255, 255, 230))
    # tomoe
    d.ellipse((25, 10, 30, 15), fill=(255, 255, 255, 255))
    d.line([(29, 10), (31, 8)], fill=(255, 255, 255, 255))
    return img


def _uv(cell: str) -> dict:
    u, v = CELLS[cell]
    return {"texture_width": 32, "texture_height": 16, "uv": [u, v], "uv_size": [8, 8]}


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
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.7, "direction": "outwards"},
        "minecraft:particle_initial_speed": "Math.random(0.6, 1.8)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.6},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "Math.random(0.7, 1.3)"},
        "minecraft:particle_appearance_billboard": _billboard("smoke", "0.5 + variable.particle_age * 0.6"),
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
        "minecraft:particle_appearance_billboard": _billboard("smoke", "0.45"),
        "minecraft:particle_appearance_tinting": _tint((0.85, 0.9, 1.0)),
    }),
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
