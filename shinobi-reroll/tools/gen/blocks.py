"""Blocks: chakra ore/crystal plus the temporary blocks summoned by Earth, Wood and Ice jutsu."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Callable

from PIL import Image

from .core import FMT_BLOCK, FMT_FEATURE, Build, ident
from .pixel import hexc, mix, shade


@dataclass
class Block:
    id: str
    name: str
    texture: Callable[[], Image.Image]
    seconds: float
    resistance: float
    sound: str
    light: int = 0
    map_color: str = "#808080"
    loot: str | None = None  # loot table path (None => no drops)
    render: str = "opaque"
    extra: dict = field(default_factory=dict)


N = 32  # block texture resolution (v1.3: native 32x32, designed at this size rather than upscaled)


def _smooth_noise(rng: random.Random, n: int, cell: int) -> list[list[float]]:
    """Bilinear value noise: blotches of roughly `cell` texels, tiling seamlessly."""
    g = n // cell
    grid = [[rng.random() for _ in range(g)] for _ in range(g)]
    out = []
    for y in range(n):
        row = []
        for x in range(n):
            gx, gy = x / cell, y / cell
            x0, y0 = int(gx) % g, int(gy) % g
            x1, y1 = (x0 + 1) % g, (y0 + 1) % g
            tx, ty = gx - int(gx), gy - int(gy)
            a = grid[y0][x0] + (grid[y0][x1] - grid[y0][x0]) * tx
            b = grid[y1][x0] + (grid[y1][x1] - grid[y1][x0]) * tx
            row.append(a + (b - a) * ty)
        out.append(row)
    return out


def _stone(seed: int, dark: bool = False) -> Image.Image:
    rng = random.Random(seed)
    base = hexc("#7d7d7d") if not dark else hexc("#4d4d55")
    img = Image.new("RGBA", (N, N))
    px = img.load()
    big = _smooth_noise(rng, N, 8)
    fine = _smooth_noise(rng, N, 2)
    for y in range(N):
        for x in range(N):
            v = 0.82 + 0.26 * big[y][x] + 0.12 * (fine[y][x] - 0.5) + rng.uniform(-0.03, 0.03)
            px[x, y] = shade(base, v)
    # a few hairline cracks
    for _ in range(3):
        x, y = rng.randrange(N), rng.randrange(N)
        for _ in range(rng.randrange(5, 10)):
            px[x % N, y % N] = shade(base, 0.62)
            x += rng.choice((-1, 0, 1))
            y += 1
    return img


def _crystal(px, cx: int, cy: int, h: int, c) -> None:
    """One upright hexagonal crystal: bright left facet, mid face, dark right facet, white tip."""
    for dy in range(h):
        w = 3 if dy > 1 else (2 if dy == 1 else 1)
        for dx in range(-w // 2, w - w // 2):
            x, y = cx + dx, cy - dy
            if 0 <= x < N and 0 <= y < N:
                px[x, y] = shade(c, 1.45 if dx < 0 else (0.72 if dx > 0 else 1.05))
    if 0 <= cy - h < N:
        px[cx, cy - h] = hexc("#ffffff")


def _crystal_cluster(img: Image.Image, seed: int, color: str = "#4fc3ff") -> Image.Image:
    rng = random.Random(seed)
    px = img.load()
    c = hexc(color)
    for _ in range(6):
        cx, cy = rng.randrange(3, N - 3), rng.randrange(8, N - 2)
        for k, off in enumerate((0, -3, 3)):
            _crystal(px, cx + off, cy - (0 if k == 0 else rng.randrange(0, 2)), rng.randrange(3, 7) - k, c)
    return img


def chakra_ore() -> Image.Image:
    return _crystal_cluster(_stone(21), 5)


def deepslate_chakra_ore() -> Image.Image:
    return _crystal_cluster(_stone(22, dark=True), 6, "#6fd8ff")


def chakra_block() -> Image.Image:
    img = Image.new("RGBA", (N, N))
    px = img.load()
    a, b = hexc("#2f8fd8"), hexc("#9fe6ff")
    for y in range(N):
        for x in range(N):
            t = (math.sin((x + y) * 0.45) + math.sin((x - y) * 0.35) + 2) / 4
            px[x, y] = mix(a, b, t)
            if x in (0, N - 1) or y in (0, N - 1):
                px[x, y] = shade(a, 0.65)
            elif x in (1, N - 2) or y in (1, N - 2):
                px[x, y] = shade(mix(a, b, t), 1.15)
    rng = random.Random(7)
    for _ in range(9):
        x, y = rng.randrange(3, N - 3), rng.randrange(3, N - 3)
        px[x, y] = hexc("#ffffff")
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            px[x + dx, y + dy] = mix(px[x + dx, y + dy], hexc("#ffffff"), 0.5)
    return img


def earth_wall() -> Image.Image:
    rng = random.Random(31)
    img = Image.new("RGBA", (N, N))
    px = img.load()
    layers = ["#8a6a42", "#7a5c38", "#9a7a50", "#6e5232"]
    wobble = [round(math.sin(x * 0.4) * 1.2) for x in range(N)]
    for y in range(N):
        for x in range(N):
            yy = (y + wobble[x]) % N
            band = hexc(layers[(yy // 8) % len(layers)])
            col = shade(band, 1 + rng.uniform(-0.07, 0.07))
            if yy % 8 == 0 and rng.random() < 0.7:
                col = shade(band, 0.68)
            px[x, y] = col
    for _ in range(14):  # pebbles
        x, y = rng.randrange(1, N - 2), rng.randrange(1, N - 2)
        peb = hexc(rng.choice(["#a89a88", "#8f8578", "#6b6258"]))
        px[x, y], px[x + 1, y] = shade(peb, 1.2), peb
        px[x, y + 1], px[x + 1, y + 1] = peb, shade(peb, 0.7)
    return img


def hashirama_wood() -> Image.Image:
    rng = random.Random(41)
    img = Image.new("RGBA", (N, N))
    px = img.load()
    for x in range(N):
        col = hexc("#6b4a2b") if x % 8 not in (0, 1) else hexc("#4a3220")
        for y in range(N):
            px[x, y] = shade(col, 1 + rng.uniform(-0.08, 0.08) + 0.06 * math.sin(y * 0.5 + x))
    for kx, ky in ((11, 9), (22, 23)):  # knots
        for y in range(-3, 4):
            for x in range(-2, 3):
                r = math.hypot(x * 1.4, y)
                if r < 3.2:
                    px[kx + x, ky + y] = shade(hexc("#4a3220"), 0.8 if int(r * 1.5) % 2 else 1.15)
    for y in (6, 17, 27):  # young shoots
        x = rng.randrange(2, N - 3)
        px[x, y], px[x + 1, y - 1], px[x + 2, y - 1] = hexc("#3f8a3a"), hexc("#5aa04a"), hexc("#7cc06a")
    return img


def crystal_ice() -> Image.Image:
    rng = random.Random(51)
    img = Image.new("RGBA", (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            px[x, y] = shade(hexc("#bfefff", 205), 1 + rng.uniform(-0.05, 0.05) + 0.05 * math.sin((x + y) * 0.3))
    for i in range(N):
        for off, col in ((0, "#ffffff"), (11, "#e8fbff"), (22, "#f2fdff")):
            x = i + off
            if x < N:
                px[x, i] = hexc(col, 235)
                if x + 1 < N:
                    px[x + 1, i] = hexc("#dff7ff", 225)
    return img


BLOCKS = [
    Block("chakra_ore", "Chakra Ore", chakra_ore, 3.0, 3.0, "stone", light=3, map_color="#7d7d7d",
          loot="loot_tables/blocks/chakra_ore.json"),
    Block("deepslate_chakra_ore", "Deepslate Chakra Ore", deepslate_chakra_ore, 4.5, 3.0, "stone", light=4,
          map_color="#4d4d55", loot="loot_tables/blocks/chakra_ore.json"),
    Block("chakra_crystal_block", "Block of Chakra Crystal", chakra_block, 5.0, 6.0, "glass", light=10,
          map_color="#4fc3ff", loot="loot_tables/blocks/chakra_crystal_block.json"),
    Block("earth_wall", "Earth Style Wall", earth_wall, 2.0, 12.0, "gravel", map_color="#8a6a42"),
    Block("hashirama_wood", "Wood Style Timber", hashirama_wood, 2.0, 3.0, "wood", map_color="#6b4a2b"),
    Block("crystal_ice", "Crystal Ice", crystal_ice, 0.6, 1.0, "glass", light=2, map_color="#bfefff",
          render="blend"),
]


def emit_blocks(b: Build) -> None:
    for blk in BLOCKS:
        comps = {
            "minecraft:destructible_by_mining": {"seconds_to_destroy": blk.seconds},
            "minecraft:destructible_by_explosion": {"explosion_resistance": blk.resistance},
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {"*": {"texture": blk.id, "render_method": blk.render}},
            "minecraft:map_color": blk.map_color,
            "minecraft:loot": blk.loot or "loot_tables/empty.json",
        }
        if blk.light:
            comps["minecraft:light_emission"] = blk.light
        if blk.render == "blend":
            comps["minecraft:light_dampening"] = 0
        b.bp.json(f"blocks/{blk.id}.json", {
            "format_version": FMT_BLOCK,
            "minecraft:block": {
                "description": {"identifier": ident(blk.id), "menu_category": {"category": "construction"}},
                "components": comps,
            },
        })
        b.rp.png(f"textures/blocks/{blk.id}.png", blk.texture())
        b.terrain_texture(blk.id, f"textures/blocks/{blk.id}")
        b.block_sounds[ident(blk.id)] = blk.sound
        b.rp_lang.add(f"tile.{ident(blk.id)}.name", blk.name)

    b.bp.json("loot_tables/empty.json", {"pools": []})
    b.bp.json("loot_tables/blocks/chakra_ore.json", {"pools": [{"rolls": 1, "entries": [{
        "type": "item", "name": ident("chakra_crystal"), "weight": 1,
        "functions": [{"function": "set_count", "count": {"min": 1, "max": 3}}]}]}]})
    b.bp.json("loot_tables/blocks/chakra_crystal_block.json", {"pools": [{"rolls": 1, "entries": [{
        "type": "item", "name": ident("chakra_crystal_block"), "weight": 1}]}]})

    # world generation: chakra ore veins in stone and deepslate
    b.bp.json("features/chakra_ore_feature.json", {
        "format_version": FMT_FEATURE,
        "minecraft:ore_feature": {
            "description": {"identifier": ident("chakra_ore_feature")},
            "count": 5,
            "replace_rules": [
                {"places_block": ident("chakra_ore"),
                 "may_replace": ["minecraft:stone", "minecraft:granite", "minecraft:diorite", "minecraft:andesite"]},
                {"places_block": ident("deepslate_chakra_ore"),
                 "may_replace": ["minecraft:deepslate", "minecraft:tuff"]},
            ],
        },
    })
    b.bp.json("feature_rules/chakra_ore_rule.json", {
        "format_version": FMT_FEATURE,
        "minecraft:feature_rules": {
            "description": {"identifier": ident("chakra_ore_rule"), "places_feature": ident("chakra_ore_feature")},
            "conditions": {
                "placement_pass": "underground_pass",
                "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}],
            },
            "distribution": {
                "iterations": 7,
                "coordinate_eval_order": "zyx",
                "x": {"distribution": "uniform", "extent": [0, 16]},
                "y": {"distribution": "triangle", "extent": [-56, 40]},
                "z": {"distribution": "uniform", "extent": [0, 16]},
            },
        },
    })
