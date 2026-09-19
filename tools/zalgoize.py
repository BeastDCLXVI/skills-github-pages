#!/usr/bin/env python3
"""Generate the zalgo marks used by the Minecraft pages.

The marks are not decoration: they encode two facts about each entry so a
reader can sort a long list by eye before reading a single word.

    direction   what kind of thing it is   -> marks above / below / both
    density     how reachable it is        -> 1, 2 or 4 marks per character

Each registry keeps its own direction map, because "kind" means something
different for a render subject than for a file on disk:

    render subjects   modeled  -> above     geometry
                      shadered -> below     shading
                      both     -> both      resolves geometry and shading

    .minecraft files  directory -> above    a container of other entries
                      file      -> below    a leaf
                      archive   -> both     a container that is also a leaf

Density is the same axis everywhere: tier 1 is something you can open and
edit by hand, tier 2 needs a tool, tier 3 is machine-owned - compiled,
generated, locked or cached.

Marks are seeded from each entry's id, so the same registry always produces
the same file and the diff stays empty unless the registry actually changed.

Usage:  python3 tools/zalgoize.py [--check]
"""

import argparse
import hashlib
import pathlib
import random
import sys
from dataclasses import dataclass, field

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Combining diacriticals, split by where they render relative to the glyph.
ABOVE = "̀́̂̃̄̆̇̈̊̋̌̑̒̓̈́͆͊͐͑͗͛̚"
BELOW = "̧̖̗̘̙̜̝̞̟̠̣̤̥̦̩̭̮̰̱̹̼ͅ"

# marks per character, by tier
DENSITY = {1: 1, 2: 2, 3: 4}


def front_matter(path):
    """Parse the YAML front matter of a Markdown file."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise SystemExit(f"{path}: no front matter")
    _, fm, _ = text.split("---", 2)
    entry = yaml.safe_load(fm)
    entry["_path"] = str(path)
    return entry


@dataclass
class Registry:
    """One source of entries and the marks file generated from it.

    `ident` is the field holding the slug each mark is seeded from. It is not
    always "id": a Jekyll collection document already has an `id` of its own,
    so the subject files carry `sid` instead.

    `loader` is either "yaml_list" - a single YAML file with a list under
    `key` - or "frontmatter_dir", a folder of Markdown files whose YAML front
    matter carries the fields and whose body carries the prose.
    """

    source: str
    key: str            # top-level list key, yaml_list only
    out: str
    label: str          # field holding the human-readable name
    kind: str           # field holding the class/kind
    ident: str = "id"   # field holding the stable slug the mark is seeded from
    directions: dict = field(default_factory=dict)
    loader: str = "yaml_list"

    @property
    def source_path(self):
        return ROOT / self.source

    @property
    def out_path(self):
        return ROOT / self.out

    def load(self):
        if self.loader == "yaml_list":
            data = yaml.safe_load(self.source_path.read_text(encoding="utf-8"))
            return data[self.key]
        return [front_matter(p) for p in sorted(self.source_path.glob("*.md"))]


REGISTRIES = [
    Registry(
        source="_subjects",
        key="",
        out="_data/zalgo_marks.yml",
        label="title",
        kind="render_class",
        ident="sid",
        loader="frontmatter_dir",
        directions={
            "modeled": ("above",),
            "shadered": ("below",),
            "both": ("above", "below"),
        },
    ),
    Registry(
        source="_data/minecraft_filesets.yml",
        key="entries",
        out="_data/zalgo_filesets.yml",
        label="name",
        kind="kind",
        directions={
            "directory": ("above",),
            "file": ("below",),
            "archive": ("above", "below"),
        },
    ),
    Registry(
        source="_data/minecraft_jar.yml",
        key="entries",
        out="_data/zalgo_jar.yml",
        label="name",
        kind="kind",
        directions={
            "directory": ("above",),
            "file": ("below",),
            "archive": ("above", "below"),
        },
    ),
]


def mark(text, sides, tier, seed):
    """Return `text` with combining marks layered on, deterministically."""
    rng = random.Random(seed)
    per_char = DENSITY[tier]
    out = []
    for char in text:
        out.append(char)
        if not char.strip():
            continue
        for side in sides:
            pool = ABOVE if side == "above" else BELOW
            for _ in range(per_char):
                out.append(rng.choice(pool))
    return "".join(out)


def next_seq(last):
    """Next label in the fixed-width letter sequence: aa, ab, ... az, ba.

    Fixed width is the point - it keeps lexical order and append order the
    same, so a new subject never renumbers an existing one.
    """
    index = (ord(last[0]) - ord("a")) * 26 + (ord(last[1]) - ord("a")) + 1
    if index >= 26 * 26:
        raise SystemExit("sequence exhausted at zz")
    return chr(ord("a") + index // 26) + chr(ord("a") + index % 26)


def build(registry):
    marks = {}
    for entry in registry.load():
        entry_id = entry[registry.ident]
        kind = entry[registry.kind]
        tier = int(entry["tier"])
        if kind not in registry.directions:
            raise SystemExit(f"{entry_id}: unknown {registry.kind} {kind!r}")
        if tier not in DENSITY:
            raise SystemExit(f"{entry_id}: unknown tier {tier!r}")
        sides = registry.directions[kind]
        # Seed on the id only. Renaming the display text must not reshuffle
        # marks for every other entry in the file.
        seed = hashlib.sha256(entry_id.encode("utf-8")).hexdigest()
        marks[entry_id] = {
            # the marked copy of the name, for skimming
            "name": mark(entry[registry.label], sides, tier, seed),
            # a short standalone badge, same encoding, for tables and legends
            "sigil": mark("█", sides, tier, seed + ":sigil"),
        }

    legend = " / ".join(
        f"{k} = {'+'.join(v)}" for k, v in registry.directions.items()
    )
    header = (
        "# GENERATED by tools/zalgoize.py - do not edit by hand.\n"
        f"# Source: {registry.source}\n"
        f"# Mark direction ({registry.kind}): {legend}.\n"
        "# Mark density tracks tier 1/2/3 (hand-editable / needs a tool / machine-owned).\n"
        "\n"
    )
    return header + yaml.safe_dump(marks, allow_unicode=True, sort_keys=False, width=4096)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail instead of writing if the committed marks are stale",
    )
    parser.add_argument(
        "--next",
        action="store_true",
        help="print the next free sequence letters for each collection registry",
    )
    args = parser.parse_args()

    if args.next:
        for registry in REGISTRIES:
            entries = registry.load()
            used = sorted(e["seq"] for e in entries if e.get("seq"))
            if not used:
                continue
            nxt = next_seq(used[-1])
            where = (
                f"{registry.source}/{nxt}-<id>.md"
                if registry.loader == "frontmatter_dir"
                else f"a new entry in {registry.source} with seq: {nxt}"
            )
            print(f"{registry.source}: {len(used)} entries, last {used[-1]}, next {nxt} -> {where}")
        return 0

    stale = []
    for registry in REGISTRIES:
        generated = build(registry)
        if args.check:
            current = (
                registry.out_path.read_text(encoding="utf-8")
                if registry.out_path.exists()
                else ""
            )
            if current != generated:
                stale.append(registry.out)
            else:
                print(f"{registry.out} is up to date")
        else:
            registry.out_path.write_text(generated, encoding="utf-8")
            print(f"wrote {registry.out}")

    if stale:
        print(
            "stale, run python3 tools/zalgoize.py: " + ", ".join(stale),
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
