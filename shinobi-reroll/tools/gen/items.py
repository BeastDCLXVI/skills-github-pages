"""Item catalogue -> BP item JSON, RP icons, lang entries."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from PIL import Image

from . import sprites as S
from .core import FMT_ITEM, Build, ident
from .models import BIJUU


@dataclass
class Item:
    id: str
    name: str
    icon: Callable[[], Image.Image]
    category: str = "items"  # construction | equipment | items | nature
    stack: int = 64
    components: dict = field(default_factory=dict)
    use_label: str | None = None  # touch "interact" button text => item is usable
    glint: bool = False
    rarity: str | None = None
    tags: list[str] = field(default_factory=list)
    armor: dict | None = None  # {"slot": ..., "texture": callable, "geometry": ...}


def _food(nutrition: int, saturation: float, always: bool = False, duration: float = 1.6, converts: str | None = None,
          anim: str = "eat") -> dict:
    food = {"nutrition": nutrition, "saturation_modifier": saturation, "can_always_eat": always}
    if converts:
        food["using_converts_to"] = converts
    return {
        "minecraft:food": food,
        "minecraft:use_modifiers": {"use_duration": duration, "movement_modifier": 0.35},
        "minecraft:use_animation": anim,
    }


def _weapon(damage: int, durability: int | None = None, enchant: str = "sword") -> dict:
    c = {"minecraft:damage": damage, "minecraft:hand_equipped": True,
         "minecraft:enchantable": {"slot": enchant, "value": 14}}
    if durability:
        c["minecraft:durability"] = {"max_durability": durability}
    return c


ORB_COLORS = {
    "shukaku": "#cfae6a", "matatabi": "#2f5fd0", "isobu": "#6f8a7a", "son_goku": "#b8322a", "kokuo": "#ece6dc",
    "saiken": "#cfe0c4", "chomei": "#6fae3a", "gyuki": "#6a5a7e", "kurama": "#e2701f",
}

_DIGITS = {
    1: [".o.", "oo.", ".o.", ".o.", "ooo"], 2: ["oo.", "..o", ".o.", "o..", "ooo"], 3: ["oo.", "..o", ".o.", "..o", "oo."],
    4: ["o.o", "o.o", "ooo", "..o", "..o"], 5: ["ooo", "o..", "oo.", "..o", "oo."], 6: [".oo", "o..", "ooo", "o.o", "ooo"],
    7: ["ooo", "..o", ".o.", ".o.", ".o."], 8: ["ooo", "o.o", "ooo", "o.o", "ooo"], 9: ["ooo", "o.o", "ooo", "..o", "oo."],
}


def build_items() -> list[Item]:
    items: list[Item] = [
        # --- core tools -------------------------------------------------------
        Item("shinobi_scroll", "Shinobi Scroll", lambda: S.scroll("#c0262b"), stack=1, use_label="Open Scroll"),
        Item("chakra_focus", "Chakra Focus", S.chakra_focus, stack=1, use_label="Cast Jutsu", category="equipment",
             components={"minecraft:hand_equipped": False}),
        Item("clan_reroll_scroll", "Clan Reroll Scroll", lambda: S.scroll("#f2b632", ink="#6b2d8f"), stack=16,
             use_label="Reroll Clan", glint=True, rarity="rare"),
        Item("bijuu_summoning_scroll", "Tailed Beast Summoning Scroll", lambda: S.scroll("#5a1b6e", ink="#c0262b"),
             stack=1, use_label="Summon", rarity="epic"),
        Item("sealing_scroll", "Sealing Scroll", lambda: S.scroll("#2f4f8f", ink="#1a1a1a"), stack=16,
             use_label="Seal", rarity="uncommon"),
        Item("toad_contract", "Toad Summoning Contract", lambda: S.scroll("#e07a1f", paper="#e8d6a8", ink="#3a5a2a"),
             stack=1, use_label="Sign Contract", rarity="rare"),
        Item("forbidden_scroll", "Scroll of Seals", lambda: S.scroll("#3a1d1d", paper="#e3d3a8", ink="#7a1418"),
             stack=16, use_label="Study", glint=True, rarity="rare"),
        Item("otsutsuki_sigil", "Otsutsuki Summoning Sigil", S.sigil, stack=1, use_label="Summon", glint=True,
             rarity="epic"),
        Item("gedo_core", "Gedo Statue Core", S.gedo_core, stack=1, use_label="Summon", glint=True, rarity="epic"),
        Item("karma_seal", "Karma Seal", S.karma_seal, stack=1, use_label="Accept Karma", glint=True, rarity="epic"),
        Item("hashirama_cells", "Hashirama Cells", lambda: S.vial("#6fbf4a"), stack=1, use_label="Implant",
             rarity="rare"),
        Item("kote_gauntlet", "Scientific Ninja Tool: Kote", S.gauntlet, stack=1, use_label="Fire Scroll",
             category="equipment", components={"minecraft:durability": {"max_durability": 320}}, rarity="rare"),
        Item("jutsu_cartridge", "Jutsu Scroll Cartridge", S.cartridge, stack=64),
        Item("training_post", "Training Post", S.training_post_icon, stack=16, category="equipment",
             components={"minecraft:entity_placer": {"entity": ident("training_post")}}),
        # --- materials ------------------------------------------------------
        Item("chakra_crystal", "Chakra Crystal", S.crystal),
        Item("zetsu_spore", "White Zetsu Spore", S.spore),
        # --- weapons --------------------------------------------------------
        Item("kunai", "Kunai", S.kunai, category="equipment", use_label="Throw",
             components={"minecraft:damage": 4, "minecraft:hand_equipped": True}),
        Item("explosive_kunai", "Explosive Kunai", S.explosive_kunai, category="equipment", stack=16,
             use_label="Throw", components={"minecraft:damage": 4, "minecraft:hand_equipped": True}),
        Item("shuriken", "Shuriken", S.shuriken, category="equipment", use_label="Throw"),
        Item("fuma_shuriken", "Fuma Shuriken", S.fuma_shuriken, category="equipment", stack=8, use_label="Throw",
             components={"minecraft:damage": 5}),
        Item("senbon", "Senbon", S.senbon, category="equipment", use_label="Throw"),
        Item("explosive_tag", "Explosive Tag", S.explosive_tag, category="equipment", stack=16, use_label="Plant"),
        Item("smoke_bomb", "Smoke Bomb", S.smoke_bomb, category="equipment", stack=16, use_label="Throw"),
        Item("kusanagi", "Kusanagi Sword", S.kusanagi, category="equipment", stack=1,
             components=_weapon(7, 1561), rarity="rare"),
        Item("samehada", "Samehada", S.samehada, category="equipment", stack=1, components=_weapon(8, 2031),
             rarity="epic"),
        Item("kubikiribocho", "Kubikiribocho", S.kubikiribocho, category="equipment", stack=1,
             components=_weapon(10, 900), rarity="epic"),
        Item("chakra_blade", "Chakra Blades", S.chakra_blade, category="equipment", stack=1,
             components=_weapon(6, 750), rarity="uncommon"),
        Item("gunbai", "Uchiha Gunbai", S.gunbai, category="equipment", stack=1, use_label="Uchiha Return",
             components=_weapon(6, 1200), rarity="epic"),
        # --- food -----------------------------------------------------------
        Item("ichiraku_ramen", "Ichiraku Ramen", S.ramen, stack=16,
             components=_food(10, 1.2, converts="minecraft:bowl", duration=2.0)),
        Item("soldier_pill", "Soldier Pill", lambda: S.pill("#7a5a2b"), stack=16,
             components=_food(2, 0.3, always=True, duration=0.8)),
        Item("spinach_pill", "Akimichi Spinach Pill", lambda: S.pill("#4f9a3a"), stack=8,
             components=_food(1, 0.1, always=True, duration=0.8)),
        Item("curry_pill", "Akimichi Curry Pill", lambda: S.pill("#e0b020"), stack=8,
             components=_food(1, 0.1, always=True, duration=0.8)),
        Item("chili_pill", "Akimichi Chili Pill", lambda: S.pill("#d8262b", accent="#ffd36a"), stack=8,
             components=_food(1, 0.1, always=True, duration=0.8), rarity="rare"),
        Item("dango", "Tri-Color Dango", S.dango, components=_food(4, 0.6, duration=1.2)),
        Item("chakra_fruit", "Chakra Fruit", S.chakra_fruit, stack=1, glint=True, rarity="epic",
             components=_food(20, 1.5, always=True, duration=3.0)),
    ]
    # --- tailed beast chakra orbs ------------------------------------------
    for key, name, tails, _ in BIJUU:
        items.append(Item(f"{key}_chakra", f"{name}'s Chakra", (lambda c=ORB_COLORS[key], t=tails:
                          S.chakra_orb(c, glyph=_DIGITS[t], glyph_color="#1b1020")), stack=1,
                          use_label="Become Jinchuriki", glint=True, rarity="epic", tags=[ident("bijuu_chakra")]))
    # --- wearables ------------------------------------------------------------
    items += [
        Item("leaf_headband", "Leaf Forehead Protector", lambda: S.headband("#1f3f7a"), stack=1, category="equipment",
             components={"minecraft:wearable": {"slot": "slot.armor.head", "protection": 2},
                         "minecraft:enchantable": {"slot": "armor_head", "value": 12},
                         "minecraft:durability": {"max_durability": 240}},
             armor={"slot": "head", "geometry": "geometry.humanoid.armor.helmet", "style": "headband",
                    "cloth": "#1f3f7a"}),
        Item("rogue_headband", "Rogue Forehead Protector", lambda: S.headband("#2a2a2a", plate_scratched=True), stack=1,
             category="equipment",
             components={"minecraft:wearable": {"slot": "slot.armor.head", "protection": 2},
                         "minecraft:enchantable": {"slot": "armor_head", "value": 12},
                         "minecraft:durability": {"max_durability": 240}},
             armor={"slot": "head", "geometry": "geometry.humanoid.armor.helmet", "style": "headband",
                    "cloth": "#2a2a2a", "scratched": True}),
        Item("anbu_mask", "ANBU Mask", S.anbu_mask, stack=1, category="equipment",
             components={"minecraft:wearable": {"slot": "slot.armor.head", "protection": 1},
                         "minecraft:enchantable": {"slot": "armor_head", "value": 10},
                         "minecraft:durability": {"max_durability": 200}},
             armor={"slot": "head", "geometry": "geometry.humanoid.armor.helmet", "style": "mask"}),
        Item("kage_hat", "Kage Hat", S.kage_hat, stack=1, category="equipment", rarity="rare",
             components={"minecraft:wearable": {"slot": "slot.armor.head", "protection": 3},
                         "minecraft:enchantable": {"slot": "armor_head", "value": 15},
                         "minecraft:durability": {"max_durability": 400}},
             armor={"slot": "head", "geometry": "geometry.humanoid.armor.helmet", "style": "hat"}),
        Item("flak_vest", "Chunin Flak Jacket", lambda: S.vest("#5f7f3a", "#3d5226"), stack=1, category="equipment",
             components={"minecraft:wearable": {"slot": "slot.armor.chest", "protection": 6},
                         "minecraft:enchantable": {"slot": "armor_torso", "value": 12},
                         "minecraft:durability": {"max_durability": 360}},
             armor={"slot": "chest", "geometry": "geometry.humanoid.armor.chestplate", "style": "vest",
                    "cloth": "#5f7f3a"}),
        Item("akatsuki_cloak", "Akatsuki Cloak", lambda: S.vest("#17151c", "#c0262b", "clouds"), stack=1,
             category="equipment", rarity="epic",
             components={"minecraft:wearable": {"slot": "slot.armor.chest", "protection": 5},
                         "minecraft:enchantable": {"slot": "armor_torso", "value": 15},
                         "minecraft:durability": {"max_durability": 420}},
             armor={"slot": "chest", "geometry": "geometry.humanoid.armor.chestplate", "style": "cloak",
                    "cloth": "#17151c"}),
    ]
    return items


def emit_items(b: Build, items: list[Item]) -> None:
    for it in items:
        comps: dict = {
            "minecraft:icon": it.id,
            "minecraft:display_name": {"value": f"item.{ident(it.id)}.name"},
            "minecraft:max_stack_size": it.stack,
        }
        if it.use_label:
            comps["minecraft:interact_button"] = it.use_label
        if it.glint:
            comps["minecraft:glint"] = True
        if it.tags:
            comps["minecraft:tags"] = {"tags": it.tags}
        comps.update(it.components)
        if it.rarity:
            comps["minecraft:rarity"] = it.rarity
        b.bp.json(f"items/{it.id}.json", {
            "format_version": FMT_ITEM,
            "minecraft:item": {
                "description": {"identifier": ident(it.id), "menu_category": {"category": it.category}},
                "components": comps,
            },
        })
        b.rp.png(f"textures/items/{it.id}.png", it.icon())
        b.item_texture(it.id, f"textures/items/{it.id}")
        b.rp_lang.add(f"item.{ident(it.id)}.name", it.name)
