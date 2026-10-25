"""Offline validation for the generated packs.

Cross-reference checks (always on):
  * every JSON file parses; manifests are consistent and the script entry exists
  * item icons / block textures / client-entity textures / attachable textures resolve to real PNGs
  * geometry, animation and render-controller ids resolve to this pack or to known vanilla ids
  * geometry UVs stay inside the declared texture and the PNG matches the declared size
  * component names exist in the target format (1.21.90 entities, 1.20.50+ items)
  * entity events / component groups / loot tables / shooter + spawn-rule targets resolve
  * recipe, loot and ore-feature item/block ids exist (custom ids or @minecraft/vanilla-data ids)
  * every lang key the content needs is present
  * scripts: every shinobi:* identifier, vanilla sound, effect, item and entity id they use exists

Official schema checks (optional, --schemas): item components, blocks and particles are validated
against Mojang's JSON schemas from github.com/Mojang/bedrock-samples (metadata/json_schemas).
"""
from __future__ import annotations

import json
import re
import struct
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
REF = json.loads((Path(__file__).parent / "reference" / "vanilla.json").read_text())

# components introduced after the 1.20.50 item schema but available at format 1.21.90
ITEM_COMPONENTS_EXTRA = {"minecraft:rarity"}
# runtime-only identifiers the scripts use (script events typed by players/admins)
SCRIPT_EVENT_IDS = {"shinobi:admin", "shinobi:jutsu", "shinobi:jutsu_remove"}
VANILLA_TEXTURES = {"textures/misc/enchanted_actor_glint"}


def _png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", head[16:24])


def _vanilla_ids(kind: str) -> set[str]:
    p = ROOT / "node_modules" / "@minecraft" / "vanilla-data" / "lib" / f"mojang-{kind}.d.ts"
    if not p.exists():
        return set()
    return set(re.findall(r'= "(minecraft:[a-z0-9_.]+)"', p.read_text()))


def _load_all(root: Path, problems: list[str]) -> dict[str, object]:
    out = {}
    for f in sorted(root.rglob("*.json")):
        rel = f.relative_to(root).as_posix()
        try:
            out[rel] = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:  # pragma: no cover - reported, not raised
            problems.append(f"{root.name}/{rel}: invalid JSON ({e})")
    return out


def _lang(root: Path) -> dict[str, str]:
    p = root / "texts" / "en_US.lang"
    keys = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            keys[k] = v
    return keys


def validate(bp: Path, rp: Path, scripts: Path, schemas: Path | None = None):
    problems: list[str] = []
    P = problems.append
    bpj = _load_all(bp, problems)
    rpj = _load_all(rp, problems)
    rp_lang = _lang(rp)
    vanilla_items = _vanilla_ids("item")
    vanilla_blocks = _vanilla_ids("block")
    vanilla_effects = _vanilla_ids("effect")
    vanilla_entities = _vanilla_ids("entity")
    vanilla_cameras = _vanilla_ids("cameraPresets")
    have_vanilla = bool(vanilla_items)
    if not have_vanilla:
        P("node_modules/@minecraft/vanilla-data missing: run `npm install` so vanilla ids can be checked")

    # ---- manifests -------------------------------------------------------------------
    bm, rm = bpj["manifest.json"], rpj["manifest.json"]
    uuids = [bm["header"]["uuid"], rm["header"]["uuid"]] + [m["uuid"] for m in bm["modules"] + rm["modules"]]
    if len(set(uuids)) != len(uuids):
        P("manifest UUIDs are not unique")
    deps = {d.get("uuid") for d in bm["dependencies"]}
    if rm["header"]["uuid"] not in deps:
        P("BP manifest does not depend on RP")
    for m in bm["modules"]:
        if m["type"] == "script" and not (bp / m["entry"]).exists():
            P(f"script entry {m['entry']} missing")

    # ---- collect custom content ids --------------------------------------------------
    items = {d["minecraft:item"]["description"]["identifier"]: (k, d) for k, d in bpj.items() if k.startswith("items/")}
    blocks = {d["minecraft:block"]["description"]["identifier"]: (k, d) for k, d in bpj.items() if k.startswith("blocks/")}
    entities = {d["minecraft:entity"]["description"]["identifier"]: (k, d) for k, d in bpj.items()
                if k.startswith("entities/")}
    clients = {d["minecraft:client_entity"]["description"]["identifier"]: (k, d) for k, d in rpj.items()
               if k.startswith("entity/")}
    particles = {d["particle_effect"]["description"]["identifier"]: (k, d) for k, d in rpj.items()
                 if k.startswith("particles/")}
    geometries = {}
    for k, d in rpj.items():
        if k.startswith("models/"):
            for g in d["minecraft:geometry"]:
                geometries[g["description"]["identifier"]] = (k, g)
    animations = {}
    for k, d in rpj.items():
        if k.startswith("animations/"):
            animations.update({a: k for a in d["animations"]})
    controllers = {}
    for k, d in rpj.items():
        if k.startswith("render_controllers/"):
            controllers.update({c: k for c in d["render_controllers"]})
    item_tex = rpj["textures/item_texture.json"]["texture_data"]
    terrain_tex = rpj["textures/terrain_texture.json"]["texture_data"]
    known_items = set(items) | set(blocks) | vanilla_items | vanilla_blocks
    known_blocks = set(blocks) | vanilla_blocks
    properties = set()
    events = set()
    for _, (k, d) in entities.items():
        e = d["minecraft:entity"]
        properties |= set(e["description"].get("properties", {}))
        events |= set(e.get("events", {}))

    def tex_exists(path: str) -> bool:
        return path in VANILLA_TEXTURES or (rp / f"{path}.png").exists()

    def item_ok(name: str) -> bool:
        return not have_vanilla or name in known_items

    # ---- items -------------------------------------------------------------------------
    allowed_item = set(REF["item_components_1_20_50"]) | ITEM_COMPONENTS_EXTRA
    for iid, (k, d) in items.items():
        comps = d["minecraft:item"]["components"]
        for c in comps:
            if c not in allowed_item:
                P(f"{k}: item component {c} not available at format 1.21.90")
        icon = comps.get("minecraft:icon")
        icon_key = icon if isinstance(icon, str) else (icon or {}).get("textures", {}).get("default")
        if icon_key not in item_tex:
            P(f"{k}: icon {icon_key} missing from item_texture.json")
        elif not tex_exists(item_tex[icon_key]["textures"]):
            P(f"{k}: icon texture file {item_tex[icon_key]['textures']}.png missing")
        name_key = comps.get("minecraft:display_name", {}).get("value")
        if name_key not in rp_lang:
            P(f"{k}: lang key {name_key} missing")
        placer = comps.get("minecraft:entity_placer")
        if placer and placer["entity"] not in entities:
            P(f"{k}: entity_placer targets unknown entity {placer['entity']}")
        food = comps.get("minecraft:food", {})
        if food.get("using_converts_to") and not item_ok(food["using_converts_to"]):
            P(f"{k}: food converts to unknown item {food['using_converts_to']}")
        if "minecraft:food" in comps and "minecraft:use_modifiers" not in comps:
            P(f"{k}: food without use_modifiers.use_duration cannot be eaten")
    for key, v in item_tex.items():
        if not tex_exists(v["textures"]):
            P(f"item_texture.json: {key} -> missing {v['textures']}.png")

    # ---- blocks ------------------------------------------------------------------------
    for bid, (k, d) in blocks.items():
        comps = d["minecraft:block"]["components"]
        for face, inst in comps.get("minecraft:material_instances", {}).items():
            t = inst["texture"]
            if t not in terrain_tex:
                P(f"{k}: texture {t} missing from terrain_texture.json")
            elif not tex_exists(terrain_tex[t]["textures"]):
                P(f"{k}: terrain texture file for {t} missing")
        loot = comps.get("minecraft:loot")
        if loot and f"{loot}" not in bpj:
            P(f"{k}: loot table {loot} missing")
        if f"tile.{bid}.name" not in rp_lang:
            P(f"{k}: lang key tile.{bid}.name missing")

    # ---- entities (behaviour) ---------------------------------------------------------
    allowed_entity = set(REF["entity_components_1_21_90"])
    for eid, (k, d) in entities.items():
        e = d["minecraft:entity"]
        groups = e.get("component_groups", {})
        evs = e.get("events", {})
        all_comp_sets = [("components", e.get("components", {}))] + [(f"group {g}", c) for g, c in groups.items()]
        for where, comps in all_comp_sets:
            for c, val in comps.items():
                if c not in allowed_entity:
                    P(f"{k}: {where}: component {c} not in the 1.21.90 entity component list")
                if c == "minecraft:loot" and val["table"] not in bpj:
                    P(f"{k}: loot table {val['table']} missing")
                if c == "minecraft:shooter" and val["def"] not in entities:
                    P(f"{k}: shooter def {val['def']} unknown")
                if c in ("minecraft:timer",):
                    ev = val["time_down_event"]["event"]
                    if ev not in evs:
                        P(f"{k}: timer fires unknown event {ev}")
                if c == "minecraft:tameable":
                    ev = val["tame_event"]["event"]
                    if ev not in evs:
                        P(f"{k}: tame event {ev} unknown")
                    ti = val["tame_items"]
                    for t in ([ti] if isinstance(ti, str) else ti):
                        if not item_ok(t if ":" in t else f"minecraft:{t}"):
                            P(f"{k}: tame item {t} unknown")
                if c == "minecraft:damage_sensor":
                    trig = val.get("triggers", [])
                    for t in ([trig] if isinstance(trig, dict) else trig):
                        ev = t.get("on_damage", {}).get("event")
                        if ev and ev not in evs:
                            P(f"{k}: damage sensor fires unknown event {ev}")
                if c == "minecraft:healable":
                    for h in val["items"]:
                        if not item_ok(h["item"]):
                            P(f"{k}: healable item {h['item']} unknown")
        for ev_name, ev in evs.items():
            for op in ("add", "remove"):
                for g in ev.get(op, {}).get("component_groups", []):
                    if g not in groups:
                        P(f"{k}: event {ev_name} references unknown group {g}")
        if eid not in clients:
            P(f"{k}: no client entity for {eid}")
        if f"entity.{eid}.name" not in rp_lang:
            P(f"{k}: lang key entity.{eid}.name missing")
        if e["description"].get("is_spawnable") and f"item.spawn_egg.entity.{eid}.name" not in rp_lang:
            P(f"{k}: spawn egg lang key missing")
    for k, d in bpj.items():
        if k.startswith("spawn_rules/"):
            sid = d["minecraft:spawn_rules"]["description"]["identifier"]
            if sid not in entities:
                P(f"{k}: spawn rule for unknown entity {sid}")
            elif not entities[sid][1]["minecraft:entity"]["description"].get("is_spawnable"):
                P(f"{k}: spawn rule for non-spawnable entity {sid}")

    # ---- client entities ---------------------------------------------------------------
    vanilla_geo = set(REF["vanilla_geometry"])
    vanilla_anim = set(REF["vanilla_animations"]) | set(REF["vanilla_animation_controllers"])
    vanilla_rc = set(REF["vanilla_render_controllers"])
    for cid, (k, d) in clients.items():
        desc = d["minecraft:client_entity"]["description"]
        if cid not in entities:
            P(f"{k}: client entity without behaviour entity")
        for t in desc.get("textures", {}).values():
            if not tex_exists(t):
                P(f"{k}: texture {t}.png missing")
        for g in desc.get("geometry", {}).values():
            if g not in geometries and g not in vanilla_geo:
                P(f"{k}: geometry {g} unknown")
        for short, full in desc.get("animations", {}).items():
            if full not in animations and full not in vanilla_anim:
                P(f"{k}: animation {full} unknown")
        for rc in desc.get("render_controllers", []):
            rc = rc if isinstance(rc, str) else next(iter(rc))
            if rc not in controllers and rc not in vanilla_rc:
                P(f"{k}: render controller {rc} unknown")
        anims = desc.get("animations", {})
        for a in desc.get("scripts", {}).get("animate", []):
            a = a if isinstance(a, str) else next(iter(a))
            if a not in anims:
                P(f"{k}: scripts.animate references undeclared animation {a}")
        for m in re.findall(r"query\.property\('([^']+)'\)", json.dumps(desc)):
            if m not in properties:
                P(f"{k}: query.property('{m}') not declared on any entity")
    for rc_name, k in controllers.items():
        body = rpj[k]["render_controllers"][rc_name]
        for m in re.findall(r"query\.property\('([^']+)'\)", json.dumps(body)):
            if m not in properties:
                P(f"{k}: query.property('{m}') not declared")

    # ---- geometry vs textures ----------------------------------------------------------
    for gid, (k, g) in geometries.items():
        tw, th = g["description"]["texture_width"], g["description"]["texture_height"]
        for bone in g["bones"]:
            for c in bone.get("cubes", []):
                w, h, dd = c["size"]
                u, v = c["uv"]
                if u + 2 * (w + dd) > tw or v + h + dd > th:
                    P(f"{k}: cube in bone {bone['name']} has UV outside {tw}x{th}")
        users = [d for cid, (ck, d) in clients.items()
                 if gid in d["minecraft:client_entity"]["description"].get("geometry", {}).values()]
        for d in users:
            for t in d["minecraft:client_entity"]["description"]["textures"].values():
                if not (rp / f"{t}.png").exists():
                    continue  # reported by the client-entity texture check
                size = _png_size(rp / f"{t}.png")
                # HD textures: any power-of-two multiple of the geometry's texture size (UVs are normalised)
                if not any(size == (tw * m, th * m) for m in (1, 2, 4, 8)):
                    P(f"{k}: texture {t} is {size}, geometry expects {(tw, th)} or an HD multiple of it")
        bones = {b["name"] for b in g["bones"]}
        for b in g["bones"]:
            if b.get("parent") and b["parent"] not in bones:
                P(f"{k}: bone {b['name']} parent {b['parent']} missing")
    for aid, k in animations.items():
        anim = rpj[k]["animations"][aid]
        owner_geo = f"geometry.shinobi.{aid.split('.')[2]}"
        if owner_geo in geometries:
            bones = {b["name"] for b in geometries[owner_geo][1]["bones"]}
            for bn in anim.get("bones", {}):
                if bn not in bones:
                    P(f"{k}: animation {aid} animates missing bone {bn}")

    # ---- attachables ---------------------------------------------------------------------
    for k, d in rpj.items():
        if not k.startswith("attachables/"):
            continue
        desc = d["minecraft:attachable"]["description"]
        if desc["identifier"] not in items:
            P(f"{k}: attachable for unknown item")
        for t in desc["textures"].values():
            if not tex_exists(t):
                P(f"{k}: texture {t} missing")
        for g in desc["geometry"].values():
            if g not in vanilla_geo and g not in geometries:
                P(f"{k}: geometry {g} unknown")

    # ---- particles -------------------------------------------------------------------------
    for pid, (k, d) in particles.items():
        t = d["particle_effect"]["description"]["basic_render_parameters"]["texture"]
        if not tex_exists(t):
            P(f"{k}: particle texture {t} missing")

    # ---- recipes / loot / features -------------------------------------------------------------
    recipe_ids = set()
    for k, d in bpj.items():
        if k.startswith("recipes/"):
            body = next(v for kk, v in d.items() if kk.startswith("minecraft:recipe"))
            rid = body["description"]["identifier"]
            if rid in recipe_ids:
                P(f"{k}: duplicate recipe id {rid}")
            recipe_ids.add(rid)
            refs = [body["result"]["item"]]
            refs += [v["item"] for v in body.get("key", {}).values()]
            refs += [v["item"] for v in body.get("ingredients", [])]
            refs += [u["item"] for u in body.get("unlock", [])]
            for r in refs:
                if not item_ok(r):
                    P(f"{k}: unknown item {r}")
            if "pattern" in body:
                used = set("".join(body["pattern"])) - {" "}
                if used != set(body["key"]):
                    P(f"{k}: pattern symbols {sorted(used)} != key {sorted(body['key'])}")
        if k.startswith("loot_tables/"):
            for pool in d.get("pools", []):
                for ent in pool["entries"]:
                    if ent["type"] == "item" and not item_ok(ent["name"]):
                        P(f"{k}: unknown item {ent['name']}")
        if k.startswith("features/"):
            for rule in d.get("minecraft:ore_feature", {}).get("replace_rules", []):
                for b in [rule["places_block"]] + rule.get("may_replace", []):
                    if have_vanilla and b not in known_blocks:
                        P(f"{k}: unknown block {b}")
        if k.startswith("feature_rules/"):
            feat = d["minecraft:feature_rules"]["description"]["places_feature"]
            if not any(fd.get("minecraft:ore_feature", {}).get("description", {}).get("identifier") == feat
                       for fk, fd in bpj.items() if fk.startswith("features/")):
                P(f"{k}: places unknown feature {feat}")

    # ---- scripts ---------------------------------------------------------------------------------
    custom_ids = set(items) | set(blocks) | set(entities) | set(particles) | properties | events | SCRIPT_EVENT_IDS
    sounds = set(REF["sounds"])
    script_stats = {"files": 0, "shinobi ids": 0, "vanilla ids": 0, "sounds": 0}
    for f in sorted(scripts.rglob("*.js")):
        script_stats["files"] += 1
        src = f.read_text(encoding="utf-8")
        rel = f.relative_to(scripts.parent.parent).as_posix()
        for m in sorted(set(re.findall(r"""['"`](shinobi:[a-z0-9_]+)['"`]""", src))):
            script_stats["shinobi ids"] += 1
            if m not in custom_ids:
                P(f"{rel}: '{m}' is not an item/block/entity/particle/property/event of the add-on")
        component_ids = set(re.findall(r"""(?:get|has)Component\(\s*['"](minecraft:[a-z0-9_.]+)['"]""", src))
        for m in sorted(set(re.findall(r"""['"`](minecraft:[a-z0-9_.]+)['"`]""", src)) - component_ids):
            script_stats["vanilla ids"] += 1
            if have_vanilla and m not in (vanilla_items | vanilla_blocks | vanilla_effects | vanilla_entities
                                          | set(REF["particles"]) | vanilla_cameras
                                          | {"minecraft:on_tame", "minecraft:from_player", "minecraft:entity_spawned",
                                             "minecraft:item"}):
                P(f"{rel}: '{m}' is not a known vanilla id")
        for raw in re.findall(r"""(?:ping|sound|playSound)\([^)]*?['"]([a-z]+\.[a-z0-9_.]+)['"]""", src):
            P(f"{rel}: raw sound '{raw}' — use the validated SOUND table in ids.js")
        for block in re.findall(r"SOUND\s*=\s*Object\.freeze\(\{(.*?)\}\)", src, re.S):
            for s in re.findall(r""":\s*['"]([a-z0-9_.]+)['"]""", block):
                script_stats["sounds"] += 1
                if s not in sounds:
                    P(f"{rel}: sound '{s}' does not exist in vanilla sound_definitions")

    # jutsu orb element order must match the render controller texture array
    ids_js = scripts / "ids.js"
    if ids_js.exists():
        m = re.search(r"ORB_ELEMENTS\s*=\s*\[(.*?)\]", ids_js.read_text(encoding="utf-8"), re.S)
        js_order = re.findall(r"'([a-z_]+)'", m.group(1)) if m else []
        rc = rpj.get("render_controllers/jutsu_orb.render_controllers.json", {})
        arr = rc.get("render_controllers", {}).get("controller.render.shinobi.jutsu_orb", {}) \
            .get("arrays", {}).get("textures", {}).get("Array.elements", [])
        rc_order = [a.split(".", 1)[1] for a in arr]
        if js_order != rc_order:
            P(f"ids.js ORB_ELEMENTS {js_order} != render controller order {rc_order}")

    # ---- lang ---------------------------------------------------------------------------------------
    for key in ("pack.name", "pack.description"):
        if key not in rp_lang or key not in _lang(bp):
            P(f"lang key {key} missing")

    # ---- optional official schema validation --------------------------------------------------
    schema_stats = 0
    if schemas:
        schema_stats = _official_schemas(schemas, items, blocks, particles, problems)

    stats = {
        "behavior files": sum(1 for _ in bp.rglob("*") if _.is_file()),
        "resource files": sum(1 for _ in rp.rglob("*") if _.is_file()),
        "items": len(items), "blocks": len(blocks), "entities": len(entities), "particles": len(particles),
        "geometries": len(geometries), "recipes": len(recipe_ids), "lang keys": len(rp_lang),
        "script files": script_stats["files"], "script shinobi ids": script_stats["shinobi ids"],
        "script vanilla ids": script_stats["vanilla ids"], "script sounds": script_stats["sounds"],
        "official schema checks": schema_stats if schemas else "skipped (pass --schemas)",
    }
    return problems, stats


def _official_schemas(root: Path, items, blocks, particles, problems) -> int:
    try:
        import jsonschema
        from referencing import Registry, Resource
    except ImportError:
        problems.append("--schemas needs the python 'jsonschema' package")
        return 0

    def retrieve(uri: str):
        path = root / unquote(uri).lstrip("/")
        return Resource.from_contents(json.loads(path.read_text(encoding="utf-8")))

    registry = Registry(retrieve=retrieve)
    count = 0

    def check(schema_rel: str, instance, where: str):
        nonlocal count
        path = root / schema_rel
        if not path.exists():
            return
        schema = json.loads(path.read_text(encoding="utf-8"))
        v = jsonschema.Draft7Validator(schema, registry=registry)
        for err in v.iter_errors(instance):
            problems.append(f"schema {schema_rel}: {where}: {err.message[:200]}")
        count += 1

    for iid, (k, d) in items.items():
        for comp, val in d["minecraft:item"]["components"].items():
            name = comp.replace("minecraft:", "minecraft_")
            for ver in ("1.20.50", "1.26.30"):
                if (root / f"server/item/{ver}/{name}.json").exists():
                    check(f"server/item/{ver}/{name}.json", val, f"{k} {comp}")
                    break
    for pid, (k, d) in particles.items():
        check("client/particles/1.21.10/Particle Effect Data.json", d["particle_effect"], k)
    for bid, (k, d) in blocks.items():
        check("server/block/1.26.20/Blocks.json", d["minecraft:block"], k)
    return count


if __name__ == "__main__":
    import sys
    probs, st = validate(ROOT / "build" / "ShinobiReroll_BP", ROOT / "build" / "ShinobiReroll_RP",
                         ROOT / "src" / "scripts", Path(sys.argv[1]) if len(sys.argv) > 1 else None)
    for k, v in st.items():
        print(f"  {k:<28} {v}")
    for p in probs:
        print(" -", p)
    raise SystemExit(1 if probs else 0)
