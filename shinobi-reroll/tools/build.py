"""Build the Shinobi Reroll add-on.

    python3 tools/build.py            # generate packs into build/, validate, write dist/*.mcaddon
    python3 tools/build.py --check    # generate + validate only (CI)
    python3 tools/build.py --schemas <bedrock-samples>/metadata/json_schemas
                                      # also validate against Mojang's official JSON schemas
"""
from __future__ import annotations

import argparse
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from gen.blocks import emit_blocks  # noqa: E402
from gen.core import (ADDON_NAME, MIN_ENGINE, SCRIPT_MODULES, VERSION, Build, Lang, Pack,  # noqa: E402
                      stable_uuid)
from gen.entities import emit_entities  # noqa: E402
from gen.extras import emit_armor, emit_particles, pack_icon  # noqa: E402
from gen.items import build_items, emit_items  # noqa: E402
from gen.recipes import emit_recipes  # noqa: E402

BP_DIR = "ShinobiReroll_BP"
RP_DIR = "ShinobiReroll_RP"
DESCRIPTION = ("Naruto, Shippuden & Boruto on Bedrock: chakra, 50+ jutsu, clan rerolls, dojutsu, "
               "tailed beasts, Karma and the Otsutsuki. v" + ".".join(map(str, VERSION)))


def manifests(b: Build) -> None:
    bp_uuid, rp_uuid = stable_uuid("bp/header"), stable_uuid("rp/header")
    meta = {"authors": ["Shinobi Reroll contributors"], "license": "MIT", "product_type": "addon"}
    b.bp.json("manifest.json", {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": bp_uuid,
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": stable_uuid("bp/data"), "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": stable_uuid("bp/script"), "version": VERSION,
             "entry": "scripts/main.js"},
        ],
        "dependencies": [{"uuid": rp_uuid, "version": VERSION}]
        + [{"module_name": m, "version": v} for m, v in SCRIPT_MODULES.items()],
        "metadata": meta,
    })
    b.rp.json("manifest.json", {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": rp_uuid,
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": stable_uuid("rp/resources"), "version": VERSION}],
        "dependencies": [{"uuid": bp_uuid, "version": VERSION}],
        "metadata": meta,
    })


def generate() -> Build:
    b = Build(bp=Pack(BP_DIR), rp=Pack(RP_DIR), rp_lang=Lang(), bp_lang=Lang())
    manifests(b)
    items = build_items()
    emit_items(b, items)
    emit_armor(b, items)
    emit_blocks(b)
    emit_entities(b)
    emit_particles(b)
    emit_recipes(b)

    b.rp.json("textures/item_texture.json", {
        "resource_pack_name": "shinobi_reroll", "texture_name": "atlas.items",
        "texture_data": {k: {"textures": v} for k, v in sorted(b.item_textures.items())}})
    b.rp.json("textures/terrain_texture.json", {
        "resource_pack_name": "shinobi_reroll", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
        "texture_data": {k: {"textures": v} for k, v in sorted(b.terrain_textures.items())}})
    b.rp.json("blocks.json", {"format_version": [1, 1, 0],
                              **{k: {"sound": v} for k, v in sorted(b.block_sounds.items())}})

    for pack, lang, kind in ((b.bp, b.bp_lang, "bp"), (b.rp, b.rp_lang, "rp")):
        lang.add("pack.name", f"{ADDON_NAME} {'Behavior' if kind == 'bp' else 'Resources'}")
        lang.add("pack.description", DESCRIPTION)
        pack.text("texts/en_US.lang", lang.render())
        pack.json("texts/languages.json", ["en_US"])
        pack.png("pack_icon.png", pack_icon(kind))

    scripts = ROOT / "src" / "scripts"
    for f in sorted(scripts.rglob("*.js")):
        b.bp.raw(f"scripts/{f.relative_to(scripts).as_posix()}", f.read_bytes())
    return b


def write(b: Build, out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    for pack in (b.bp, b.rp):
        for rel, data in pack.files.items():
            p = out / pack.root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)


def _zip(path: Path, entries: list[tuple[str, bytes]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(entries):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)


def package(b: Build, dist: Path) -> list[Path]:
    ver = ".".join(map(str, VERSION))
    addon = dist / f"ShinobiReroll-v{ver}.mcaddon"
    _zip(addon, [(f"{p.root}/{rel}", data) for p in (b.bp, b.rp) for rel, data in p.files.items()])
    outs = [addon]
    for p, suffix in ((b.bp, "BP"), (b.rp, "RP")):
        path = dist / f"ShinobiReroll_{suffix}-v{ver}.mcpack"
        _zip(path, list(p.files.items()))
        outs.append(path)
    return outs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate only, do not package")
    ap.add_argument("--schemas", help="path to bedrock-samples metadata/json_schemas for official schema checks")
    args = ap.parse_args()

    from validate import validate  # noqa: E402

    b = generate()
    write(b, ROOT / "build")
    problems, stats = validate(ROOT / "build" / BP_DIR, ROOT / "build" / RP_DIR, ROOT / "src" / "scripts",
                               Path(args.schemas) if args.schemas else None)
    for k, v in stats.items():
        print(f"  {k:<28} {v}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    print("validation: OK")
    if not args.check:
        for p in package(b, ROOT / "dist"):
            print(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
