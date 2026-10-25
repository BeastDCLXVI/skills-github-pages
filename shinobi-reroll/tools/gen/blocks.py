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


def _stone(seed: int, dark: bool = False) -> Image.Image:
    rng = random.Random(seed)
    base = ["#7d7d7d", "#747474", "#868686", "#6a6a6a"] if not dark else ["#4d4d55", "#45454c", "#57575f", "#3c3c42"]
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = hexc(rng.choice(base))
    return img


def _crystal_cluster(img: Image.Image, seed: int, color: str = "#4fc3ff") -> Image.Image:
    rng = random.Random(seed)
    px = img.load()
    c = hexc(color)
    for _ in range(5):
        cx, cy = rng.randrange(2, 14), rng.randrange(2, 14)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (0, -1), (-1, 0)):
            x, y = cx + dx, cy + dy
            if 0 <= x < 16 and 0 <= y < 16:
                px[x, y] = shade(c, 1.4 if (dx, dy) == (0, -1) else (0.75 if (dx, dy) == (1, 1) else 1.0))
    return img


def chakra_ore() -> Image.Image:
    return _crystal_cluster(_stone(21), 5)


def deepslate_chakra_ore() -> Image.Image:
    return _crystal_cluster(_stone(22, dark=True), 6, "#6fd8ff")


def chakra_block() -> Image.Image:
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    a, b = hexc("#2f8fd8"), hexc("#9fe6ff")
    for y in range(16):
        for x in range(16):
            t = (math.sin((x + y) * 0.9) + math.sin((x - y) * 0.7) + 2) / 4
            px[x, y] = mix(a, b, t)
            if x in (0, 15) or y in (0, 15):
                px[x, y] = shade(a, 0.7)
    for x, y in ((4, 4), (11, 6), (6, 11), (12, 12)):
        px[x, y] = hexc("#ffffff")
    return img


def earth_wall() -> Image.Image:
    rng = random.Random(31)
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    layers = ["#8a6a42", "#7a5c38", "#9a7a50", "#6e5232"]
    for y in range(16):
        band = hexc(layers[(y // 4) % len(layers)])
        for x in range(16):
            px[x, y] = shade(band, 1 + rng.uniform(-0.08, 0.08))
            if y % 4 == 0 and rng.random() < 0.6:
                px[x, y] = shade(band, 0.7)
    return img


def hashirama_wood() -> Image.Image:
    rng = random.Random(41)
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    for x in range(16):
        col = hexc("#6b4a2b") if x % 4 else hexc("#4a3220")
        for y in range(16):
            px[x, y] = shade(col, 1 + rng.uniform(-0.1, 0.1))
    for y in (3, 9, 13):
        px[rng.randrange(16), y] = hexc("#5aa04a")
    return img


def crystal_ice() -> Image.Image:
    rng = random.Random(51)
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = shade(hexc("#bfefff", 210), 1 + rng.uniform(-0.06, 0.06))
    for i in range(16):
        px[i, i] = hexc("#ffffff", 235)
        if i + 5 < 16:
            px[i + 5, i] = hexc("#e8fbff", 225)
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
