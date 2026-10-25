"""Crafting recipes (shaped + shapeless)."""
from __future__ import annotations

from .core import FMT_RECIPE, Build, ident
from .models import BIJUU


def _key(v: str) -> dict:
    return {"item": v if ":" in v else ident(v)}


def shaped(name: str, pattern: list[str], key: dict[str, str], result: str, count: int = 1,
           unlock: str | None = None) -> dict:
    res = result if ":" in result else ident(result)
    return {"format_version": FMT_RECIPE, "minecraft:recipe_shaped": {
        "description": {"identifier": ident(name)},
        "tags": ["crafting_table"],
        "pattern": pattern,
        "key": {k: _key(v) for k, v in key.items()},
        "unlock": [_key(unlock or next(iter(key.values())))],
        "result": {"item": res, "count": count},
    }}


def shapeless(name: str, ingredients: list[str], result: str, count: int = 1, unlock: str | None = None) -> dict:
    res = result if ":" in result else ident(result)
    return {"format_version": FMT_RECIPE, "minecraft:recipe_shapeless": {
        "description": {"identifier": ident(name)},
        "tags": ["crafting_table"],
        "ingredients": [_key(i) for i in ingredients],
        "unlock": [_key(unlock or ingredients[0])],
        "result": {"item": res, "count": count},
    }}


CC = "chakra_crystal"
CCB = "chakra_crystal_block"


def all_recipes() -> list[dict]:
    r = [
        shapeless("shinobi_scroll", ["minecraft:paper", "minecraft:paper", "minecraft:paper", "minecraft:ink_sac"],
                  "shinobi_scroll"),
        shapeless("chakra_focus", [CC, "minecraft:string", "minecraft:leather"], "chakra_focus", unlock=CC),
        shaped("kunai", ["I", "S"], {"I": "minecraft:iron_ingot", "S": "minecraft:stick"}, "kunai", 4),
        shaped("shuriken", [" N ", "N N", " N "], {"N": "minecraft:iron_nugget"}, "shuriken", 8),
        shaped("fuma_shuriken", [" I ", "ISI", " I "], {"I": "minecraft:iron_ingot", "S": "minecraft:stick"},
               "fuma_shuriken"),
        shapeless("senbon", ["minecraft:iron_nugget", "minecraft:iron_nugget"], "senbon", 8),
        shapeless("explosive_tag", ["minecraft:paper", "minecraft:gunpowder"], "explosive_tag", 2),
        shapeless("explosive_kunai", ["kunai", "explosive_tag"], "explosive_kunai", unlock="explosive_tag"),
        shapeless("smoke_bomb", ["minecraft:gunpowder", "minecraft:charcoal", "minecraft:paper"], "smoke_bomb", 2),
        shaped("kusanagi", ["C", "D", "S"], {"C": CC, "D": "minecraft:diamond", "S": "minecraft:stick"}, "kusanagi",
               unlock=CC),
        shaped("samehada", ["PPP", "PCP", " B "], {"P": "minecraft:prismarine_shard", "C": CCB, "B": "minecraft:bone"},
               "samehada", unlock=CCB),
        shaped("kubikiribocho", ["BB ", "BC ", " S "], {"B": "minecraft:iron_block", "C": CC, "S": "minecraft:stick"},
               "kubikiribocho", unlock=CC),
        shapeless("chakra_blade", ["minecraft:iron_ingot", "minecraft:iron_ingot", CC], "chakra_blade", unlock=CC),
        shaped("gunbai", ["WWW", "WCW", " S "], {"W": "minecraft:red_wool", "C": CCB, "S": "minecraft:stick"},
               "gunbai", unlock=CCB),
        shaped("kote_gauntlet", ["IRI", "ICI", " L "], {"I": "minecraft:iron_ingot", "R": "minecraft:redstone",
                                                       "C": CCB, "L": "minecraft:leather"}, "kote_gauntlet",
               unlock=CCB),
        shapeless("jutsu_cartridge", ["minecraft:paper", CC, "minecraft:gunpowder"], "jutsu_cartridge", 4, unlock=CC),
        shaped("leaf_headband", ["WIW"], {"W": "minecraft:blue_wool", "I": "minecraft:iron_ingot"}, "leaf_headband"),
        shapeless("rogue_headband", ["leaf_headband", "minecraft:flint"], "rogue_headband", unlock="leaf_headband"),
        shaped("flak_vest", ["L L", "LGL", "LLL"], {"L": "minecraft:leather", "G": "minecraft:green_dye"}, "flak_vest"),
        shaped("akatsuki_cloak", ["B B", "BRB", "BBB"], {"B": "minecraft:black_wool", "R": "minecraft:red_wool"},
               "akatsuki_cloak"),
        shaped("anbu_mask", ["BBB", "BRB"], {"B": "minecraft:bone", "R": "minecraft:red_dye"}, "anbu_mask"),
        shaped("kage_hat", [" W ", "WRW"], {"W": "minecraft:white_wool", "R": "minecraft:red_wool"}, "kage_hat"),
        shapeless("ichiraku_ramen", ["minecraft:bowl", "minecraft:wheat", "minecraft:egg", "minecraft:cooked_porkchop"],
                  "ichiraku_ramen", unlock="minecraft:bowl"),
        shapeless("soldier_pill", [CC, "minecraft:wheat_seeds", "minecraft:sugar"], "soldier_pill", 3, unlock=CC),
        shapeless("spinach_pill", ["soldier_pill", "minecraft:dried_kelp"], "spinach_pill", unlock="soldier_pill"),
        shapeless("curry_pill", ["soldier_pill", "minecraft:blaze_powder"], "curry_pill", unlock="soldier_pill"),
        shapeless("chili_pill", ["soldier_pill", "minecraft:nether_wart", "minecraft:blaze_powder"], "chili_pill",
                  unlock="soldier_pill"),
        shapeless("dango", ["minecraft:stick", "minecraft:wheat", "minecraft:sugar"], "dango", 2,
                  unlock="minecraft:sugar"),
        shaped("clan_reroll_scroll", ["GCG", "CPC", "GCG"], {"G": "minecraft:gold_ingot", "C": CC,
                                                            "P": "minecraft:paper"}, "clan_reroll_scroll", unlock=CC),
        shaped("bijuu_summoning_scroll", ["CEC", "EPE", "CEC"], {"C": CCB, "E": "minecraft:ender_eye",
                                                                "P": "minecraft:paper"}, "bijuu_summoning_scroll",
               unlock=CCB),
        shaped("otsutsuki_sigil", ["CDC", "DFD", "CDC"], {"C": CCB, "D": "minecraft:diamond", "F": "chakra_fruit"},
               "otsutsuki_sigil", unlock="chakra_fruit"),
        shapeless("gedo_core", [f"{k}_chakra" for k, *_ in BIJUU], "gedo_core", unlock="kurama_chakra"),
        shaped("sealing_scroll", ["PIP", "ICI", "PIP"], {"P": "minecraft:paper", "I": "minecraft:ink_sac", "C": CC},
               "sealing_scroll", unlock=CC),
        shapeless("toad_contract", ["minecraft:paper", "minecraft:slime_ball", CC, "minecraft:ink_sac"],
                  "toad_contract", unlock=CC),
        shapeless("hashirama_cells", ["zetsu_spore", "zetsu_spore", "zetsu_spore", "zetsu_spore", CC,
                                      "minecraft:glass_bottle"], "hashirama_cells", unlock="zetsu_spore"),
        shaped("training_post", [" H ", "SLS", " L "], {"H": "minecraft:hay_block", "S": "minecraft:stick",
                                                       "L": "minecraft:oak_log"}, "training_post",
               unlock="minecraft:hay_block"),
        shaped("kara_ring", ["GEG", "ECE", "GEG"], {"G": "minecraft:gold_ingot", "E": "minecraft:ender_pearl", "C": CCB},
               "kara_ring", unlock=CCB),
        shapeless("slug_contract", ["minecraft:paper", "minecraft:slime_ball", CC, "minecraft:honey_bottle"],
                  "slug_contract", unlock=CC),
        shapeless("puppet_scroll", ["minecraft:paper", "minecraft:string", "minecraft:oak_planks", CC], "puppet_scroll",
                  unlock=CC),
        # v1.2: The Inner Path
        shapeless("shinobi_journal", ["minecraft:book", CC], "shinobi_journal", unlock="minecraft:book"),
        # v1.3: Boruto
        shaped("kara_inner_mark", ["OCO", "CRC", "OCO"], {"O": "minecraft:obsidian", "C": CC, "R": "kara_ring"},
               "kara_inner_mark", unlock="kara_ring"),
        # v2.0
        shaped("sand_gourd", ["SLS", "SBS", "SSS"], {"S": "minecraft:sand", "L": "minecraft:leather", "B": CCB},
               "sand_gourd", unlock="minecraft:sand"),
        shapeless("explosive_clay", ["minecraft:clay_ball", "minecraft:gunpowder", CC], "explosive_clay", 4, unlock=CC),
        shapeless("kiba", ["minecraft:iron_sword", "minecraft:iron_sword", "minecraft:lightning_rod", CCB], "kiba",
                  unlock=CCB),
        shapeless("nuibari", ["minecraft:iron_sword", "minecraft:string", "minecraft:string", CCB], "nuibari",
                  unlock=CCB),
        shapeless("shibuki", ["minecraft:iron_sword", "explosive_tag", "explosive_tag", "explosive_tag", CCB],
                  "shibuki", unlock=CCB),
        shapeless("hiramekarei", ["minecraft:iron_sword", "minecraft:iron_sword", "minecraft:prismarine_crystals", CCB],
                  "hiramekarei", unlock=CCB),
        shaped("chakra_crystal_block", ["CCC", "CCC", "CCC"], {"C": CC}, CCB),
        shapeless("chakra_crystal_from_block", [CCB], CC, 9),
    ]
    return r


def emit_recipes(b: Build) -> None:
    for rec in all_recipes():
        body = rec.get("minecraft:recipe_shaped") or rec.get("minecraft:recipe_shapeless")
        name = body["description"]["identifier"].split(":", 1)[1]
        b.bp.json(f"recipes/{name}.json", rec)
