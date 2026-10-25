"""Shared constants and the in-memory pack model used by every generator module.

Everything the add-on ships is produced from this package: the generators add
files to a :class:`Pack`, ``build.py`` writes them to disk, validates the
result and zips the ``.mcaddon``.
"""
from __future__ import annotations

import io
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

NS = "shinobi"
ADDON_NAME = "Shinobi Reroll"
VERSION = [1, 1, 0]
MIN_ENGINE = [1, 21, 90]

# Format versions are pinned to the 1.21.90 engine (the first release with
# @minecraft/server 2.0.0 stable) so the add-on loads on every client since.
FMT_ENTITY = "1.21.90"
FMT_ITEM = "1.21.90"
FMT_BLOCK = "1.21.90"
FMT_CLIENT_ENTITY = "1.10.0"
FMT_GEOMETRY = "1.12.0"
FMT_ANIMATION = "1.10.0"
FMT_RENDER_CONTROLLER = "1.10.0"
FMT_ATTACHABLE = "1.10.0"
FMT_PARTICLE = "1.10.0"
FMT_RECIPE = "1.20.10"
FMT_SPAWN = "1.8.0"
FMT_FEATURE = "1.13.0"

SCRIPT_MODULES = {
    "@minecraft/server": "2.0.0",
    "@minecraft/server-ui": "2.0.0",
}

_UUID_NS = uuid.UUID("6d7c1f0e-5b1a-4c55-9a51-5b0a5e1f0b0e")


def stable_uuid(name: str) -> str:
    """Deterministic UUIDs keep pack identity stable across rebuilds."""
    return str(uuid.uuid5(_UUID_NS, f"{NS}/{name}"))


def ident(name: str) -> str:
    return f"{NS}:{name}"


@dataclass
class Pack:
    """A behavior or resource pack held in memory as path -> bytes."""

    root: str
    files: dict[str, bytes] = field(default_factory=dict)

    def json(self, path: str, obj: Any) -> None:
        self._put(path, (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))

    def text(self, path: str, text: str) -> None:
        self._put(path, text.encode("utf-8"))

    def png(self, path: str, image) -> None:
        buf = io.BytesIO()
        image.save(buf, format="PNG", optimize=True)
        self._put(path, buf.getvalue())

    def raw(self, path: str, data: bytes) -> None:
        self._put(path, data)

    def _put(self, path: str, data: bytes) -> None:
        if path in self.files:
            raise ValueError(f"{self.root}: duplicate file {path}")
        self.files[path] = data


@dataclass
class Lang:
    """Collects localisation keys; both packs get their own en_US.lang."""

    entries: dict[str, str] = field(default_factory=dict)

    def add(self, key: str, value: str) -> None:
        if key in self.entries and self.entries[key] != value:
            raise ValueError(f"lang key {key} defined twice with different text")
        self.entries[key] = value

    def render(self) -> str:
        return "".join(f"{k}={v}\n" for k, v in sorted(self.entries.items()))


@dataclass
class Build:
    bp: Pack
    rp: Pack
    rp_lang: Lang
    bp_lang: Lang
    # item_texture.json / terrain_texture.json entries: short name -> texture path
    item_textures: dict[str, str] = field(default_factory=dict)
    terrain_textures: dict[str, str] = field(default_factory=dict)
    # block sounds for RP blocks.json
    block_sounds: dict[str, str] = field(default_factory=dict)

    def item_texture(self, short: str, path: str) -> None:
        if short in self.item_textures and self.item_textures[short] != path:
            raise ValueError(f"item texture {short} redefined")
        self.item_textures[short] = path

    def terrain_texture(self, short: str, path: str) -> None:
        if short in self.terrain_textures and self.terrain_textures[short] != path:
            raise ValueError(f"terrain texture {short} redefined")
        self.terrain_textures[short] = path
