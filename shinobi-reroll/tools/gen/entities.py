"""Entities: behaviour JSON, client entities, geometry/textures, animations, loot and spawn rules."""
from __future__ import annotations

import copy

from . import sprites as S
from .core import (FMT_ANIMATION, FMT_CLIENT_ENTITY, FMT_ENTITY, FMT_RENDER_CONTROLLER, FMT_SPAWN, Build, ident)
from .hd import hd_icon
from .models import BIJUU, JUUBI, Model, build_beast, claw_grime, decoy_log, serpent, slug, toad, training_post
from .skins import NPC_SKINS, paint_skin

# Jutsu orb element index -> sprite key. Scripts mirror this table in ELEMENT_INDEX.
ORB_ELEMENTS = list(S.JUTSU_SPRITES) + ["hidden"]

ATTACK_PLAYERS_AND_ALLIES = [{
    "filters": {"any_of": [
        {"test": "is_family", "subject": "other", "value": "player"},
        {"test": "is_family", "subject": "other", "value": "shinobi_ally"},
    ]},
    "max_dist": 32,
}]

ATTACK_MONSTERS = [{
    "filters": {"all_of": [
        {"test": "is_family", "subject": "other", "value": "monster"},
        {"test": "is_family", "subject": "other", "operator": "!=", "value": "creeper"},
    ]},
    "max_dist": 20,
}]


def _base(health: float, families: list[str], box=(0.6, 1.8), speed=0.3) -> dict:
    return {
        "minecraft:type_family": {"family": families},
        "minecraft:health": {"value": health, "max": health},
        "minecraft:collision_box": {"width": box[0], "height": box[1]},
        "minecraft:movement": {"value": speed},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:physics": {},
        "minecraft:pushable_by_entity": {},
        "minecraft:pushable_by_block": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 9},
    }


def _entity(identifier: str, components: dict, *, spawnable=True, groups=None, events=None, properties=None,
            category="monster") -> dict:
    desc = {"identifier": identifier, "is_spawnable": spawnable, "is_summonable": True, "spawn_category": category}
    if properties:
        desc["properties"] = properties
    body = {"description": desc, "components": components}
    if groups:
        body["component_groups"] = groups
    if events:
        body["events"] = events
    return {"format_version": FMT_ENTITY, "minecraft:entity": body}


DESPAWN_GROUP = {"shinobi:despawn": {"minecraft:instant_despawn": {}}}
DESPAWN_EVENT = {"shinobi:despawn": {"add": {"component_groups": ["shinobi:despawn"]}}}


# --- projectiles ---------------------------------------------------------------

THROWN = [
    # id, sprite fn, damage, gravity, power, lifetime seconds
    ("kunai_projectile", S.kunai, 6, 0.03, 1.8, 8),
    ("explosive_kunai_projectile", S.explosive_kunai, 5, 0.03, 1.6, 8),
    ("shuriken_projectile", S.shuriken, 4, 0.02, 2.0, 8),
    ("fuma_shuriken_projectile", S.fuma_shuriken, 9, 0.01, 1.5, 10),
    ("senbon_projectile", S.senbon, 2, 0.01, 2.4, 6),
    ("smoke_bomb_projectile", S.smoke_bomb, 0, 0.05, 1.2, 6),
]


def projectile_entity(identifier: str, damage: int, gravity: float, power: float, lifetime: float,
                      properties=None) -> dict:
    on_hit: dict = {"remove_on_hit": {}}
    if damage:
        on_hit["impact_damage"] = {"damage": damage, "knockback": True, "destroy_on_hit": True}
    comps = {
        "minecraft:type_family": {"family": ["projectile", "shinobi_projectile"]},
        "minecraft:collision_box": {"width": 0.25, "height": 0.25},
        "minecraft:physics": {},
        "minecraft:projectile": {
            "on_hit": on_hit,
            "power": power,
            "gravity": gravity,
            "inertia": 1.0,
            "liquid_inertia": 0.6,
            "uncertainty_base": 1.0,
            "uncertainty_multiplier": 0.0,
            "anchor": 1,
            "offset": [0, -0.1, 0],
        },
        "minecraft:timer": {"looping": False, "time": lifetime, "time_down_event": {"event": "shinobi:despawn"}},
    }
    return _entity(identifier, comps, spawnable=False, groups=copy.deepcopy(DESPAWN_GROUP),
                   events=copy.deepcopy(DESPAWN_EVENT), properties=properties, category="misc")


def sprite_client(identifier: str, textures: dict[str, str], render_controller: str, scale: str = "1.0",
                  material: str = "entity_alphatest") -> dict:
    return {
        "format_version": FMT_CLIENT_ENTITY,
        "minecraft:client_entity": {
            "description": {
                "identifier": identifier,
                "materials": {"default": material},
                "textures": textures,
                "geometry": {"default": "geometry.item_sprite"},
                "render_controllers": [render_controller],
                "animations": {"billboard": "animation.actor.billboard"},
                "scripts": {"animate": ["billboard"], "scale": scale},
            }
        },
    }


def emit_projectiles(b: Build) -> None:
    for pid, sprite_fn, dmg, grav, power, life in THROWN:
        b.bp.json(f"entities/{pid}.json", projectile_entity(ident(pid), dmg, grav, power, life))
        tex = f"textures/entity/projectiles/{pid}"
        b.rp.png(tex + ".png", hd_icon(sprite_fn()))
        b.rp.json(f"entity/{pid}.entity.json",
                  sprite_client(ident(pid), {"default": tex}, "controller.render.item_sprite", "0.6"))
        b.rp_lang.add(f"entity.{ident(pid)}.name", pid.replace("_projectile", "").replace("_", " ").title())

    # one scripted orb entity renders every jutsu element through an int property
    props = {
        "shinobi:element": {"type": "int", "range": [0, len(ORB_ELEMENTS) - 1], "default": 0, "client_sync": True},
        "shinobi:size": {"type": "int", "range": [1, 8], "default": 2, "client_sync": True},
        "shinobi:hidden": {"type": "bool", "default": False, "client_sync": True},
    }
    orb = projectile_entity(ident("jutsu_orb"), 0, 0.0, 1.6, 12, properties=props)
    orb["minecraft:entity"]["components"]["minecraft:type_family"]["family"].append("jutsu_orb")
    orb["minecraft:entity"]["components"]["minecraft:fire_immune"] = {}
    b.bp.json("entities/jutsu_orb.json", orb)
    textures = {}
    for i, key in enumerate(ORB_ELEMENTS):
        path = f"textures/entity/jutsu/{key}"
        b.rp.png(path + ".png", S.jutsu_sprite_hd(key))
        textures[key] = path
    b.rp.json("entity/jutsu_orb.entity.json",
              sprite_client(ident("jutsu_orb"), textures, "controller.render.shinobi.jutsu_orb",
                            "query.property('shinobi:size') * 0.5", material="entity_alphablend"))
    b.rp.json("render_controllers/jutsu_orb.render_controllers.json", {
        "format_version": FMT_RENDER_CONTROLLER,
        "render_controllers": {"controller.render.shinobi.jutsu_orb": {
            "arrays": {"textures": {"Array.elements": [f"Texture.{k}" for k in ORB_ELEMENTS]}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["query.property('shinobi:hidden') ? Texture.hidden : Array.elements[query.property('shinobi:element')]"],
            "filter_lighting": True,
        }},
    })
    b.rp_lang.add(f"entity.{ident('jutsu_orb')}.name", "Jutsu")

    # armed explosive tag stuck to a surface
    tag = _entity(ident("paper_bomb"), {
        "minecraft:type_family": {"family": ["inanimate", "shinobi_paper_bomb"]},
        "minecraft:collision_box": {"width": 0.3, "height": 0.3},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:health": {"value": 1, "max": 1},
        "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no"}},
        "minecraft:timer": {"looping": False, "time": 8, "time_down_event": {"event": "shinobi:despawn"}},
    }, spawnable=False, groups=copy.deepcopy(DESPAWN_GROUP), events=copy.deepcopy(DESPAWN_EVENT), category="misc")
    b.bp.json("entities/paper_bomb.json", tag)
    b.rp.png("textures/entity/projectiles/paper_bomb.png", hd_icon(S.explosive_tag()))
    b.rp.json("entity/paper_bomb.entity.json",
              sprite_client(ident("paper_bomb"), {"default": "textures/entity/projectiles/paper_bomb"},
                            "controller.render.item_sprite", "0.8"))
    b.rp_lang.add(f"entity.{ident('paper_bomb')}.name", "Explosive Tag")


# --- humanoids -------------------------------------------------------------------

HUMANOID_ANIMS = {
    "look_at_target_default": "animation.humanoid.look_at_target.default",
    "look_at_target_gliding": "animation.humanoid.look_at_target.gliding",
    "look_at_target_swimming": "animation.humanoid.look_at_target.swimming",
    "move": "animation.humanoid.move",
    "riding.arms": "animation.humanoid.riding.arms",
    "riding.legs": "animation.humanoid.riding.legs",
    "riding.body": "animation.humanoid.riding.body",
    "holding": "animation.humanoid.holding",
    "attack.rotations": "animation.humanoid.attack.rotations",
    "bob": "animation.humanoid.bob",
    "look_at_target_controller": "controller.animation.humanoid.look_at_target",
    "move_controller": "controller.animation.humanoid.move",
    "riding_controller": "controller.animation.humanoid.riding",
    "holding_controller": "controller.animation.humanoid.holding",
    "attack_controller": "controller.animation.humanoid.attack",
    "bob_controller": "controller.animation.humanoid.bob",
}


def humanoid_client(key: str, egg: tuple[str, str] | None, scale: str = "0.9375") -> dict:
    desc = {
        "identifier": ident(key),
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/npc/{key}"},
        "geometry": {"default": "geometry.humanoid.custom"},
        "render_controllers": ["controller.render.default"],
        "animations": dict(HUMANOID_ANIMS),
        "scripts": {
            "pre_animation": [
                "variable.tcos0 = Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed * 57.3;",
            ],
            "animate": ["look_at_target_controller", "move_controller", "riding_controller", "holding_controller",
                        "attack_controller", "bob_controller"],
            "scale": scale,
        },
        "enable_attachables": True,
    }
    if egg:
        desc["spawn_egg"] = {"base_color": egg[0], "overlay_color": egg[1]}
    return {"format_version": FMT_CLIENT_ENTITY, "minecraft:client_entity": {"description": desc}}


def _ally_groups(follow_speed=1.1) -> dict:
    return {
        "shinobi:tamed": {
            "minecraft:is_tamed": {},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": follow_speed, "start_distance": 9,
                                                "stop_distance": 3},
            "minecraft:behavior.teleport_to_owner": {"priority": 1, "filters": {
                "test": "owner_distance", "operator": ">", "value": 28}},
            "minecraft:persistent": {},
        },
        **copy.deepcopy(DESPAWN_GROUP),
    }


def _ally_events() -> dict:
    return {
        "minecraft:on_tame": {"add": {"component_groups": ["shinobi:tamed"]}},
        **copy.deepcopy(DESPAWN_EVENT),
    }


def shadow_clone() -> dict:
    c = _base(8, ["shinobi_ally", "shadow_clone", "mob"], speed=0.34)
    c.update({
        "minecraft:attack": {"damage": 4},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.25, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {"priority": 4, "must_see": True, "reselect_targets": True,
                                                         "entity_types": ATTACK_MONSTERS},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:timer": {"looping": False, "time": 120, "time_down_event": {"event": "shinobi:despawn"}},
        "minecraft:fire_immune": {},
    })
    return _entity(ident("shadow_clone"), c, spawnable=False, groups=_ally_groups(1.3), events=_ally_events(),
                   category="creature")


def leaf_shinobi() -> dict:
    c = _base(40, ["shinobi_npc", "leaf_shinobi", "mob"], speed=0.31)
    c.update({
        "minecraft:attack": {"damage": 5},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 4, "must_see": True, "reselect_targets": True,
                                                         "entity_types": ATTACK_MONSTERS},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:healable": {"items": [{"item": ident("ichiraku_ramen"), "heal_amount": 20},
                                         {"item": "minecraft:bread", "heal_amount": 6}]},
        "minecraft:leashable": {"soft_distance": 4, "hard_distance": 6, "max_distance": 10},
        "minecraft:loot": {"table": "loot_tables/entities/leaf_shinobi.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 6 : 0"},
    })
    groups = _ally_groups()
    groups["shinobi:wild"] = {
        "minecraft:tameable": {"probability": 0.34, "tame_items": ident("ichiraku_ramen"),
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:despawn": {"despawn_from_distance": {}},
    }
    events = _ally_events()
    events["minecraft:entity_spawned"] = {"add": {"component_groups": ["shinobi:wild"]}}
    events["minecraft:on_tame"] = {"remove": {"component_groups": ["shinobi:wild"]},
                                   "add": {"component_groups": ["shinobi:tamed"]}}
    return _entity(ident("leaf_shinobi"), c, groups=groups, events=events, category="creature")


def rogue_ninja() -> dict:
    c = _base(30, ["shinobi_npc", "rogue", "monster", "mob"], speed=0.32)
    c.update({
        "minecraft:attack": {"damage": 4},
        "minecraft:shooter": {"def": ident("shuriken_projectile")},
        "minecraft:behavior.ranged_attack": {"priority": 3, "attack_interval_min": 1.4, "attack_interval_max": 3.0,
                                             "attack_radius": 14.0, "speed_multiplier": 1.1},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                                                         "within_radius": 24, "entity_types": ATTACK_PLAYERS_AND_ALLIES},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.9},
        "minecraft:loot": {"table": "loot_tables/entities/rogue_ninja.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 12 : 0"},
        "minecraft:despawn": {"despawn_from_distance": {}},
    })
    return _entity(ident("rogue_ninja"), c)


def akatsuki_rogue() -> dict:
    c = _base(90, ["shinobi_npc", "rogue", "akatsuki", "monster", "mob"], speed=0.33)
    c.update({
        "minecraft:attack": {"damage": 8},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                                                         "within_radius": 32, "entity_types": ATTACK_PLAYERS_AND_ALLIES},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:knockback_resistance": {"value": 0.5},
        "minecraft:fire_immune": {},
        "minecraft:loot": {"table": "loot_tables/entities/akatsuki_rogue.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 40 : 0"},
        "minecraft:despawn": {"despawn_from_distance": {"min_distance": 64, "max_distance": 128}},
    })
    return _entity(ident("akatsuki_rogue"), c)


def white_zetsu() -> dict:
    c = _base(16, ["shinobi_npc", "zetsu", "monster", "mob"], speed=0.3)
    c.update({
        "minecraft:attack": {"damage": 3},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.15, "track_target": True},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                                                         "within_radius": 20, "entity_types": ATTACK_PLAYERS_AND_ALLIES},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.9},
        "minecraft:loot": {"table": "loot_tables/entities/white_zetsu.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 5 : 0"},
        "minecraft:despawn": {"despawn_from_distance": {}},
    })
    return _entity(ident("white_zetsu"), c)


def boss_components(name: str, health: int, attack: int, box: tuple[float, float], speed: float,
                    families: list[str], loot: str, xp: int, fire_immune=True) -> dict:
    c = _base(health, families + ["shinobi_boss", "monster", "mob"], box=box, speed=speed)
    c.update({
        "minecraft:attack": {"damage": attack},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.15, "track_target": True},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": False, "reselect_targets": True,
                                                         "within_radius": 48, "entity_types": [
                                                             {**ATTACK_PLAYERS_AND_ALLIES[0], "max_dist": 48}]},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7},
        "minecraft:boss": {"hud_range": 64, "name": name, "should_darken_sky": False},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"},
                                                 {"cause": "suffocation", "deals_damage": "no"},
                                                 {"cause": "drowning", "deals_damage": "no"}]},
        "minecraft:loot": {"table": loot},
        "minecraft:experience_reward": {"on_death": str(xp)},
        "minecraft:persistent": {},
    })
    c["minecraft:navigation.walk"] = {"can_path_over_water": True, "avoid_water": False, "avoid_damage_blocks": True}
    c.pop("minecraft:pushable_by_entity")
    if fire_immune:
        c["minecraft:fire_immune"] = {}
    return c


def momoshiki() -> dict:
    c = boss_components("Momoshiki Otsutsuki", 420, 12, (0.7, 2.2), 0.32, ["otsutsuki"],
                        "loot_tables/entities/momoshiki.json", 400)
    return _entity(ident("momoshiki"), c)


def toad_entity() -> dict:
    c = _base(90, ["shinobi_ally", "summon", "mob"], box=(2.2, 2.0), speed=0.28)
    c.update({
        "minecraft:attack": {"damage": 12},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {"priority": 4, "must_see": True, "reselect_targets": True,
                                                         "entity_types": ATTACK_MONSTERS},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.7},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:knockback_resistance": {"value": 0.8},
        "minecraft:jump.static": {"jump_power": 0.7},
        "minecraft:timer": {"looping": False, "time": 150, "time_down_event": {"event": "shinobi:despawn"}},
        "minecraft:damage_sensor": {"triggers": {"cause": "fall", "deals_damage": "no"}},
    })
    return _entity(ident("summoned_toad"), c, spawnable=False, groups=_ally_groups(1.2), events=_ally_events(),
                   category="creature")


def training_post_entity() -> dict:
    c = {
        "minecraft:type_family": {"family": ["inanimate", "shinobi_training"]},
        "minecraft:health": {"value": 1000, "max": 1000},
        "minecraft:collision_box": {"width": 0.8, "height": 1.9},
        "minecraft:physics": {},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no_but_side_effects_apply"}},
        "minecraft:persistent": {},
        "minecraft:nameable": {},
    }
    return _entity(ident("training_post"), c, spawnable=False, category="misc")


def decoy_entity() -> dict:
    c = {
        "minecraft:type_family": {"family": ["inanimate", "shinobi_decoy"]},
        "minecraft:health": {"value": 4, "max": 4},
        "minecraft:collision_box": {"width": 0.6, "height": 1.0},
        "minecraft:physics": {},
        "minecraft:timer": {"looping": False, "time": 4, "time_down_event": {"event": "shinobi:despawn"}},
    }
    return _entity(ident("substitution_log"), c, spawnable=False, groups=copy.deepcopy(DESPAWN_GROUP),
                   events=copy.deepcopy(DESPAWN_EVENT), category="misc")


def model_client(key: str, model: Model, egg: tuple[str, str] | None, anims: dict) -> dict:
    desc = {
        "identifier": ident(key),
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/{key}"},
        "geometry": {"default": f"geometry.shinobi.{model.key}"},
        "render_controllers": ["controller.render.default"],
        "scripts": {"scale": str(model.scale)},
    }
    names = {}
    animate = []
    for full in anims:
        short = full.rsplit(".", 1)[1]
        names[short] = full
        animate.append({short: "query.modified_move_speed"} if short == "move" else short)
    if names:
        desc["animations"] = names
        desc["scripts"]["animate"] = animate
    if egg:
        desc["spawn_egg"] = {"base_color": egg[0], "overlay_color": egg[1]}
    return {"format_version": FMT_CLIENT_ENTITY, "minecraft:client_entity": {"description": desc}}


def emit_model(b: Build, key: str, model: Model, egg) -> None:
    b.rp.json(f"models/entity/{model.key}.geo.json", model.geometry())
    # big creatures (bosses) get 4x textures: their fur is seen from close up at several blocks tall
    b.rp.png(f"textures/entity/{key}.png", model.texture_hd(seed=len(key), scale=4 if model.scale >= 1.8 else 2))
    anim = model.animations()
    if anim["animations"]:
        b.rp.json(f"animations/{model.key}.animation.json", anim)
    b.rp.json(f"entity/{key}.entity.json", model_client(key, model, egg, anim["animations"]))


# --- v1.1: legendary rogues, Otsutsuki and new summons -----------------------------

# key: (display name, health, attack, speed, extra families, client scale, xp, spawns naturally)
MINI_BOSSES = {
    "itachi": ("Itachi Uchiha", 220, 9, 0.33, ["akatsuki_boss", "akatsuki"], "0.9375", 300, True),
    "kisame": ("Kisame Hoshigaki", 280, 12, 0.31, ["akatsuki_boss", "akatsuki"], "1.05", 300, True),
    "deidara": ("Deidara", 180, 7, 0.33, ["akatsuki_boss", "akatsuki"], "0.9375", 300, True),
    "orochimaru": ("Orochimaru", 240, 9, 0.33, ["akatsuki_boss", "sannin"], "0.9375", 320, True),
    "kinshiki": ("Kinshiki Otsutsuki", 360, 14, 0.3, ["otsutsuki"], "1.3", 350, False),
    "jigen": ("Jigen", 520, 14, 0.33, ["otsutsuki", "kara"], "1.0", 800, False),
    # v1.3: Boruto
    "code": ("Code", 640, 15, 0.36, ["kara", "kara_inner"], "1.0", 900, False),
}


def mini_boss(key: str) -> dict:
    name, health, attack, speed, fams, _scale, xp, natural = MINI_BOSSES[key]
    c = boss_components(name, health, attack, (0.7, 2.0 if key != "kinshiki" else 2.5), speed, fams,
                        f"loot_tables/entities/{key}.json", xp)
    if natural:
        c.pop("minecraft:persistent")
        c["minecraft:despawn"] = {"despawn_from_distance": {"min_distance": 64, "max_distance": 128}}
        c["minecraft:boss"]["hud_range"] = 40
    return _entity(ident(key), c)


def puppet_entity() -> dict:
    c = _base(40, ["shinobi_ally", "puppet", "mob"], speed=0.32)
    c.update({
        "minecraft:attack": {"damage": 6},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {"priority": 4, "must_see": True, "reselect_targets": True,
                                                         "entity_types": ATTACK_MONSTERS},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:timer": {"looping": False, "time": 150, "time_down_event": {"event": "shinobi:despawn"}},
        "minecraft:fire_immune": {},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"},
                                                 {"cause": "drowning", "deals_damage": "no"}]},
    })
    return _entity(ident("puppet_karasu"), c, spawnable=False, groups=_ally_groups(1.3), events=_ally_events(),
                   category="creature")


def snake_entity() -> dict:
    c = _base(70, ["snake", "summon", "mob"], box=(1.6, 1.4), speed=0.3)
    c.pop("minecraft:can_climb")
    c.update({
        "minecraft:attack": {"damage": 10},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:knockback_resistance": {"value": 0.6},
        "minecraft:damage_sensor": {"triggers": {"cause": "fall", "deals_damage": "no"}},
    })
    groups = _ally_groups(1.3)
    groups["shinobi:tamed"]["minecraft:type_family"] = {"family": ["snake", "shinobi_ally", "summon", "mob"]}
    groups["shinobi:tamed"]["minecraft:behavior.nearest_attackable_target"] = {
        "priority": 4, "must_see": True, "reselect_targets": True, "entity_types": ATTACK_MONSTERS}
    groups["shinobi:tamed"]["minecraft:timer"] = {"looping": False, "time": 150,
                                                  "time_down_event": {"event": "shinobi:despawn"}}
    groups["shinobi:wild"] = {
        "minecraft:type_family": {"family": ["snake", "monster", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                                                         "within_radius": 24, "entity_types": ATTACK_PLAYERS_AND_ALLIES},
        "minecraft:timer": {"looping": False, "time": 90, "time_down_event": {"event": "shinobi:despawn"}},
    }
    events = _ally_events()
    events["minecraft:entity_spawned"] = {"add": {"component_groups": ["shinobi:wild"]}}
    events["minecraft:on_tame"] = {"remove": {"component_groups": ["shinobi:wild"]},
                                   "add": {"component_groups": ["shinobi:tamed"]}}
    return _entity(ident("summoned_snake"), c, spawnable=False, groups=groups, events=events, category="creature")


def slug_entity() -> dict:
    c = _base(60, ["shinobi_ally", "summon", "slug", "mob"], box=(1.6, 1.2), speed=0.2)
    c.pop("minecraft:can_climb")
    c.update({
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:timer": {"looping": False, "time": 150, "time_down_event": {"event": "shinobi:despawn"}},
        "minecraft:damage_sensor": {"triggers": {"cause": "fall", "deals_damage": "no"}},
    })
    return _entity(ident("summoned_slug"), c, spawnable=False, groups=_ally_groups(1.0), events=_ally_events(),
                   category="creature")


# --- loot / spawns ---------------------------------------------------------------

def _entry(item: str, weight=1, count=None, chance=None) -> dict:
    e: dict = {"type": "item", "name": item, "weight": weight}
    if count:
        e["functions"] = [{"function": "set_count", "count": {"min": count[0], "max": count[1]}}]
    return e


def _pool(entries, rolls=1, chance=None, player_only=False) -> dict:
    p: dict = {"rolls": rolls, "entries": entries}
    conds = []
    if player_only:
        conds.append({"condition": "killed_by_player_or_pets"})
    if chance is not None:
        conds.append({"condition": "random_chance_with_looting", "chance": chance, "looting_multiplier": 0.02})
    if conds:
        p["conditions"] = conds
    return p


LOOT = {
    "rogue_ninja": [
        _pool([_entry(ident("shuriken"), count=(1, 4)), _entry(ident("kunai"), count=(0, 2))]),
        _pool([_entry(ident("ryo"), count=(0, 2))], player_only=True),
        _pool([_entry(ident("explosive_tag"))], chance=0.15),
        _pool([_entry(ident("chakra_crystal"))], chance=0.12, player_only=True),
        _pool([_entry(ident("rogue_headband"))], chance=0.05, player_only=True),
        _pool([_entry(ident("forbidden_scroll"))], chance=0.025, player_only=True),
    ],
    "akatsuki_rogue": [
        _pool([_entry(ident("chakra_crystal"), count=(1, 4))]),
        _pool([_entry(ident("ryo"), count=(2, 6))], player_only=True),
        _pool([_entry(ident("explosive_kunai"), count=(1, 3))], chance=0.5),
        _pool([_entry(ident("soldier_pill"), count=(1, 2))], chance=0.4),
        _pool([_entry(ident("akatsuki_cloak"))], chance=0.15, player_only=True),
        _pool([_entry(ident("forbidden_scroll"))], chance=0.25, player_only=True),
        _pool([_entry(ident("clan_reroll_scroll"))], chance=0.08, player_only=True),
    ],
    "white_zetsu": [
        _pool([_entry(ident("zetsu_spore"), count=(0, 2))]),
        _pool([_entry(ident("ryo"))], chance=0.3, player_only=True),
    ],
    "leaf_shinobi": [
        _pool([_entry(ident("kunai"), count=(0, 2))]),
        _pool([_entry(ident("soldier_pill"))], chance=0.15),
        _pool([_entry(ident("leaf_headband"))], chance=0.08, player_only=True),
    ],
    "momoshiki": [
        _pool([_entry(ident("karma_seal"))]),
        _pool([_entry(ident("ryo"), count=(20, 40))]),
        _pool([_entry(ident("chakra_crystal_block"), count=(2, 5))]),
        _pool([_entry(ident("chakra_fruit"))], chance=0.25),
        _pool([_entry(ident("clan_reroll_scroll"), count=(1, 2))]),
    ],
    "juubi": [
        _pool([_entry(ident("chakra_fruit"), count=(2, 2))]),
        _pool([_entry(ident("ryo"), count=(40, 64))]),
        _pool([_entry(ident("chakra_crystal_block"), count=(4, 8))]),
        _pool([_entry(ident("otsutsuki_sigil"))], chance=0.2),
    ],
}

LOOT.update({
    "itachi": [
        _pool([_entry(ident("ryo"), count=(8, 16))]),
        _pool([_entry(ident("uchiha_eye"))], chance=0.3, player_only=True),
        _pool([_entry(ident("akatsuki_cloak"))], chance=0.4, player_only=True),
        _pool([_entry(ident("forbidden_scroll"))], chance=0.5, player_only=True),
    ],
    "kisame": [
        _pool([_entry(ident("ryo"), count=(8, 16))]),
        _pool([_entry(ident("samehada"))], chance=0.25, player_only=True),
        _pool([_entry(ident("akatsuki_cloak"))], chance=0.4, player_only=True),
        _pool([_entry(ident("chakra_crystal_block"), count=(1, 2))]),
    ],
    "deidara": [
        _pool([_entry(ident("ryo"), count=(8, 16))]),
        _pool([_entry(ident("explosive_clay"), count=(3, 6))]),
        _pool([_entry(ident("akatsuki_cloak"))], chance=0.4, player_only=True),
    ],
    "orochimaru": [
        _pool([_entry(ident("ryo"), count=(8, 16))]),
        _pool([_entry(ident("curse_seal"))], chance=0.35, player_only=True),
        _pool([_entry(ident("snake_contract"))], chance=0.5, player_only=True),
        _pool([_entry(ident("kusanagi"))], chance=0.2, player_only=True),
    ],
    "kinshiki": [
        _pool([_entry(ident("ryo"), count=(10, 20))]),
        _pool([_entry(ident("chakra_crystal_block"), count=(2, 4))]),
        _pool([_entry(ident("chakra_fruit"))], chance=0.1),
    ],
    "jigen": [
        _pool([_entry(ident("ryo"), count=(30, 64))]),
        _pool([_entry(ident("karma_seal"))]),
        _pool([_entry(ident("kara_inner_mark"))], player_only=True),
        _pool([_entry(ident("chakra_fruit"))], chance=0.5),
        _pool([_entry(ident("clan_reroll_scroll"), count=(1, 3))]),
    ],
    # v1.3: Boruto
    "code": [
        _pool([_entry(ident("white_karma_seal"))]),
        _pool([_entry(ident("ryo"), count=(30, 64))]),
        _pool([_entry(ident("chakra_crystal_block"), count=(2, 4))]),
        _pool([_entry(ident("clan_reroll_scroll"))], chance=0.5),
    ],
    "claw_grime": [
        _pool([_entry(ident("chakra_crystal"), count=(0, 2))], player_only=True),
        _pool([_entry(ident("ryo"), count=(0, 3))], player_only=True),
    ],
})

SPAWNS = {
    "rogue_ninja": dict(population="monster", weight=6, herd=(1, 2), brightness=(0, 7), biomes=[
        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
        {"test": "has_biome_tag", "operator": "!=", "value": "mushroom_island"}], surface=True),
    "white_zetsu": dict(population="monster", weight=5, herd=(2, 4), brightness=(0, 7), biomes=[
        {"test": "has_biome_tag", "operator": "==", "value": "forest"}], surface=True),
    "akatsuki_rogue": dict(population="monster", weight=1, herd=(1, 1), brightness=(0, 7), biomes=[
        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
        {"test": "has_biome_tag", "operator": "!=", "value": "mushroom_island"}], surface=True, difficulty="normal"),
    **{key: dict(population="monster", weight=1, herd=(1, 1), brightness=(0, 7), biomes=[
        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
        {"test": "has_biome_tag", "operator": "!=", "value": "mushroom_island"}], surface=True, difficulty="normal")
       for key in ("itachi", "kisame", "deidara", "orochimaru")},
    "claw_grime": dict(population="monster", weight=2, herd=(1, 2), brightness=(0, 7), biomes=[
        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
        {"test": "has_biome_tag", "operator": "!=", "value": "mushroom_island"}], surface=True, difficulty="normal"),
    "leaf_shinobi": dict(population="creature", weight=4, herd=(1, 2), brightness=(7, 15), biomes=[
        {"any_of": [{"test": "has_biome_tag", "operator": "==", "value": "forest"},
                    {"test": "has_biome_tag", "operator": "==", "value": "plains"}]}], surface=True),
}


def spawn_rule(key: str, spec: dict) -> dict:
    cond = {
        "minecraft:spawns_on_surface": {},
        "minecraft:brightness_filter": {"min": spec["brightness"][0], "max": spec["brightness"][1],
                                        "adjust_for_weather": True},
        "minecraft:weight": {"default": spec["weight"]},
        "minecraft:herd": {"min_size": spec["herd"][0], "max_size": spec["herd"][1]},
        "minecraft:biome_filter": {"all_of": spec["biomes"]},
    }
    if spec["population"] == "monster":
        cond["minecraft:difficulty_filter"] = {"min": spec.get("difficulty", "easy"), "max": "hard"}
    return {"format_version": FMT_SPAWN, "minecraft:spawn_rules": {
        "description": {"identifier": ident(key), "population_control": spec["population"]},
        "conditions": [cond]}}


# --- v1.2: The Inner Path ---------------------------------------------------------

def dark_reflection() -> dict:
    """The Waterfall of Truth trial. Nothing can damage it: every strike fires shinobi:struck instead,
    which the trial script counts. Calm, it only watches and whispers; struck, it fights back
    (shinobi:enraged) until the script calms it again."""
    c = _base(60, ["shinobi_npc", "inner_darkness", "mob"], speed=0.32)
    c["minecraft:navigation.walk"] = {"can_path_over_water": True, "can_swim": True, "avoid_damage_blocks": True}
    c["minecraft:breathable"] = {"breathes_water": True, "breathes_air": True}
    c["minecraft:behavior.look_at_player"] = {"priority": 1, "look_distance": 16, "probability": 1.0}
    c.update({
        "minecraft:damage_sensor": {"triggers": [{
            "on_damage": {"event": "shinobi:struck",
                          "filters": {"test": "is_family", "subject": "other", "value": "player"}},
            "cause": "all", "deals_damage": "no"}]},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:fire_immune": {},
        "minecraft:timer": {"looping": False, "time": 150, "time_down_event": {"event": "shinobi:despawn"}},
    })
    groups = {
        **copy.deepcopy(DESPAWN_GROUP),
        "shinobi:enraged": {
            "minecraft:movement": {"value": 0.38},
            "minecraft:attack": {"damage": 5},
            "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True},
            "minecraft:behavior.nearest_attackable_target": {
                "priority": 1, "must_see": False, "reselect_targets": True, "within_radius": 24,
                "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"},
                                  "max_dist": 24}]},
        },
    }
    events = {**copy.deepcopy(DESPAWN_EVENT),
              "shinobi:struck": {"add": {"component_groups": ["shinobi:enraged"]}},
              "shinobi:calm": {"remove": {"component_groups": ["shinobi:enraged"]}}}
    return _entity(ident("dark_reflection"), c, spawnable=False, groups=groups, events=events)


# --- v1.3: Boruto -------------------------------------------------------------------

def claw_grime_entity() -> dict:
    """Claw Grime: hostile chakra-hunters in the wild; loyal (and short-lived) when summoned with Code's arts."""
    c = _base(45, ["claw_grime", "mob"], box=(0.9, 2.3), speed=0.3)
    c.update({
        "minecraft:attack": {"damage": 7},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier",
                               "tame_event": {"event": "minecraft:on_tame", "target": "self"}},
        "minecraft:knockback_resistance": {"value": 0.5},
        "minecraft:damage_sensor": {"triggers": {"cause": "fall", "deals_damage": "no"}},
        "minecraft:loot": {"table": "loot_tables/entities/claw_grime.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 15 : 0"},
    })
    groups = _ally_groups(1.3)
    groups["shinobi:tamed"]["minecraft:type_family"] = {"family": ["claw_grime", "shinobi_ally", "summon", "mob"]}
    groups["shinobi:tamed"]["minecraft:behavior.nearest_attackable_target"] = {
        "priority": 4, "must_see": True, "reselect_targets": True, "entity_types": ATTACK_MONSTERS}
    groups["shinobi:tamed"]["minecraft:timer"] = {"looping": False, "time": 60,
                                                  "time_down_event": {"event": "shinobi:despawn"}}
    groups["shinobi:wild"] = {
        "minecraft:type_family": {"family": ["claw_grime", "monster", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                                                         "within_radius": 28, "entity_types": ATTACK_PLAYERS_AND_ALLIES},
        "minecraft:despawn": {"despawn_from_distance": {}},
    }
    events = _ally_events()
    events["minecraft:entity_spawned"] = {"add": {"component_groups": ["shinobi:wild"]}}
    events["minecraft:on_tame"] = {"remove": {"component_groups": ["shinobi:wild"]},
                                   "add": {"component_groups": ["shinobi:tamed"]}}
    return _entity(ident("claw_grime"), c, groups=groups, events=events)


# --- emit everything -------------------------------------------------------------

BEAST_EGGS = {
    "shukaku": ("#cfae6a", "#3c4f9c"), "matatabi": ("#2f5fd0", "#8fd8ff"), "isobu": ("#6f8a7a", "#d8d0b8"),
    "son_goku": ("#b8322a", "#efe8dc"), "kokuo": ("#ece6dc", "#c0262b"), "saiken": ("#dfe8d8", "#9ab88a"),
    "chomei": ("#6fae3a", "#bfe8f0"), "gyuki": ("#5a4a5e", "#efe8dc"), "kurama": ("#e2701f", "#5a1a0a"),
    "juubi": ("#6e665e", "#c0101a"),
}

NPC_EGGS = {
    "leaf_shinobi": ("#5f7f3a", "#1f3f7a"), "rogue_ninja": ("#3b3f46", "#7a1418"),
    "akatsuki_rogue": ("#17151c", "#c0262b"), "white_zetsu": ("#eceee4", "#9ab88a"),
    "momoshiki": ("#f1ede4", "#6b4a8f"), "itachi": ("#17151c", "#d01020"), "kisame": ("#17151c", "#7f9cbc"),
    "deidara": ("#17151c", "#f2cf3c"), "orochimaru": ("#e8e4d6", "#6b4a8f"), "kinshiki": ("#ece6d8", "#8a6a3a"),
    "jigen": ("#2e2b33", "#9a7ad8"), "code": ("#26242c", "#ece8de"),
}

NPC_NAMES = {
    "shadow_clone": "Shadow Clone", "leaf_shinobi": "Leaf Shinobi", "rogue_ninja": "Rogue Ninja",
    "akatsuki_rogue": "Akatsuki Rogue", "white_zetsu": "White Zetsu", "momoshiki": "Momoshiki Otsutsuki",
    "puppet_karasu": "Puppet: Karasu", "dark_reflection": "Dark Reflection", **{k: v[0] for k, v in MINI_BOSSES.items()},
}


def emit_entities(b: Build) -> None:
    emit_projectiles(b)

    npc_defs = {"shadow_clone": shadow_clone(), "leaf_shinobi": leaf_shinobi(), "rogue_ninja": rogue_ninja(),
                "akatsuki_rogue": akatsuki_rogue(), "white_zetsu": white_zetsu(), "momoshiki": momoshiki(),
                "puppet_karasu": puppet_entity(), "dark_reflection": dark_reflection(),
                **{k: mini_boss(k) for k in MINI_BOSSES}}
    scales = {"momoshiki": "1.05", **{k: v[5] for k, v in MINI_BOSSES.items()}}
    for key, ent in npc_defs.items():
        b.bp.json(f"entities/{key}.json", ent)
        b.rp.png(f"textures/entity/npc/{key}.png", paint_skin(NPC_SKINS[key]))
        b.rp.json(f"entity/{key}.entity.json", humanoid_client(key, NPC_EGGS.get(key), scales.get(key, "0.9375")))
        b.rp_lang.add(f"entity.{ident(key)}.name", NPC_NAMES[key])
        if NPC_EGGS.get(key):
            b.rp_lang.add(f"item.spawn_egg.entity.{ident(key)}.name", f"Spawn {NPC_NAMES[key]}")

    # tailed beasts + Ten-Tails
    for key, name, tails, kw in BIJUU + [JUUBI]:
        model = build_beast(key, tails, kw)
        bw = max(c.origin[0] + c.size[0] for c in model.cubes if c.role in ("body", "shell")) - \
            min(c.origin[0] for c in model.cubes if c.role in ("body", "shell"))
        height = max(c.origin[1] + c.size[1] for c in model.cubes if c.role == "head")
        box = (round(min(4.5, bw * model.scale / 16), 2), round(min(9.0, height * model.scale / 16), 2))
        health = 1500 if key == "juubi" else 220 + tails * 60
        attack = 24 if key == "juubi" else 8 + tails
        loot = f"loot_tables/entities/{key}.json"
        families = ["bijuu" if key != "juubi" else "juubi", "tailed_beast"]
        comps = boss_components(name, health, attack, box, 0.27 if key != "juubi" else 0.24, families, loot,
                                250 + tails * 50 if key != "juubi" else 2000)
        if key in ("isobu",):
            comps["minecraft:navigation.walk"]["can_swim"] = True
            comps["minecraft:breathable"] = {"breathes_water": True, "breathes_air": True}
        b.bp.json(f"entities/{key}.json", _entity(ident(key), comps))
        emit_model(b, key, model, BEAST_EGGS[key])
        b.rp_lang.add(f"entity.{ident(key)}.name", name)
        b.rp_lang.add(f"item.spawn_egg.entity.{ident(key)}.name", f"Spawn {name}")
        if key != "juubi":
            LOOT[key] = [
                _pool([_entry(ident(f"{key}_chakra"))]),
                _pool([_entry(ident("chakra_crystal_block"), count=(1, 3))]),
                _pool([_entry(ident("clan_reroll_scroll"))], chance=0.35),
            ]

    # summons and props
    b.bp.json("entities/summoned_toad.json", toad_entity())
    emit_model(b, "summoned_toad", toad(), None)
    b.rp_lang.add(f"entity.{ident('summoned_toad')}.name", "Summoned Toad")
    b.bp.json("entities/summoned_snake.json", snake_entity())
    emit_model(b, "summoned_snake", serpent(), None)
    b.rp_lang.add(f"entity.{ident('summoned_snake')}.name", "Summoned Snake")
    b.bp.json("entities/summoned_slug.json", slug_entity())
    emit_model(b, "summoned_slug", slug(), None)
    b.rp_lang.add(f"entity.{ident('summoned_slug')}.name", "Katsuyu")
    b.bp.json("entities/claw_grime.json", claw_grime_entity())
    emit_model(b, "claw_grime", claw_grime(), ("#17151b", "#ece8de"))
    b.rp_lang.add(f"entity.{ident('claw_grime')}.name", "Claw Grime")
    b.rp_lang.add(f"item.spawn_egg.entity.{ident('claw_grime')}.name", "Spawn Claw Grime")
    b.bp.json("entities/training_post.json", training_post_entity())
    emit_model(b, "training_post", training_post(), None)
    b.rp_lang.add(f"entity.{ident('training_post')}.name", "Training Post")
    b.bp.json("entities/substitution_log.json", decoy_entity())
    emit_model(b, "substitution_log", decoy_log(), None)
    b.rp_lang.add(f"entity.{ident('substitution_log')}.name", "Substitution Log")

    for key, pools in LOOT.items():
        b.bp.json(f"loot_tables/entities/{key}.json", {"pools": pools})
    for key, spec in SPAWNS.items():
        b.bp.json(f"spawn_rules/{key}.json", spawn_rule(key, spec))
