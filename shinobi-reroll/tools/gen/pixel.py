"""Tiny pixel-art toolkit: palettes, ASCII sprites, procedural shapes and box-UV painting.

All art in the add-on is original and generated here, so the pack carries no
third-party textures.
"""
from __future__ import annotations

import colorsys
import math
import random
from typing import Iterable

from PIL import Image

RGBA = tuple[int, int, int, int]


def hexc(h: str, a: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c: RGBA, f: float) -> RGBA:
    """f < 1 darkens, f > 1 lightens (in HLS lightness)."""
    r, g, b, a = c
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    l = max(0.0, min(1.0, l * f if f < 1 else l + (1 - l) * (f - 1)))
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)


def mix(a: RGBA, b: RGBA, t: float) -> RGBA:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(4))  # type: ignore[return-value]


def ramp(base: str | RGBA) -> dict[str, RGBA]:
    """Outline/dark/mid/light/highlight ramp from one colour."""
    c = hexc(base) if isinstance(base, str) else base
    return {
        "o": shade(c, 0.35),
        "a": shade(c, 0.7),
        "b": c,
        "c": shade(c, 1.35),
        "w": shade(c, 1.7),
    }


def sprite(rows: list[str], palette: dict[str, RGBA | None]) -> Image.Image:
    h = len(rows)
    w = len(rows[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        if len(row) != w:
            raise ValueError(f"sprite row {y} has width {len(row)} != {w}: {row!r}")
        for x, ch in enumerate(row):
            if ch in (".", " "):
                continue
            col = palette.get(ch)
            if col is None:
                raise ValueError(f"sprite uses unmapped char {ch!r}")
            px[x, y] = col
    return img


def outline(img: Image.Image, color: RGBA) -> Image.Image:
    """Add a 1px outline around opaque pixels (4-neighbourhood)."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0:
                    dst[x, y] = color
                    break
    return out


def orb(size: int, base: str, glyph: list[str] | None = None, glyph_color: str = "#ffffff",
        rim: str | None = None, radius: float | None = None) -> Image.Image:
    """Shaded sphere with optional centred glyph; used for chakra orbs and jutsu sprites."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = hexc(base)
    r = radius if radius is not None else size / 2 - 1.5
    cx = cy = (size - 1) / 2
    lx, ly = cx - r * 0.4, cy - r * 0.45
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r + 0.35:
                continue
            light = 1 - min(1.0, math.hypot(x - lx, y - ly) / (r * 1.6))
            col = shade(c, 0.55 + light * 0.9) if light < 0.5 else shade(c, 1 + (light - 0.5) * 0.9)
            if d > r - 0.9:
                col = hexc(rim) if rim else shade(c, 0.4)
            px[x, y] = col
    hl = (round(lx + 0.2), round(ly + 0.2))
    if 0 <= hl[0] < size and 0 <= hl[1] < size:
        px[hl] = (255, 255, 255, 230)
    if glyph:
        gh, gw = len(glyph), len(glyph[0])
        ox, oy = round(cx - gw / 2 + 0.5), round(cy - gh / 2 + 0.5)
        gc = hexc(glyph_color)
        for y, row in enumerate(glyph):
            for x, ch in enumerate(row):
                if ch != "." and 0 <= ox + x < size and 0 <= oy + y < size:
                    px[ox + x, oy + y] = gc
    return img


def swirl(size: int, inner: str, outer: str, arms: int = 3, glow: str | None = None,
          twist: float = 2.4, seed: int = 0) -> Image.Image:
    """Spiralling energy ball (Rasengan, chakra focus, tailed beast bomb)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    ci, co = hexc(inner), hexc(outer)
    r = size / 2 - 0.5
    cx = cy = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            ang = math.atan2(dy, dx)
            t = d / r
            band = (math.sin(arms * ang + twist * math.pi * t * 2 + seed) + 1) / 2
            col = mix(ci, co, min(1.0, t * 0.8 + band * 0.45))
            alpha = 255 if t < 0.82 else round(255 * (1 - (t - 0.82) / 0.18) ** 0.8)
            if glow and t > 0.7:
                col = mix(col, hexc(glow), (t - 0.7) / 0.3)
            px[x, y] = (col[0], col[1], col[2], max(0, min(255, alpha)))
    return img


def noise_texture(size: tuple[int, int], colors: list[str], seed: int, weights: list[float] | None = None) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", size)
    px = img.load()
    cols = [hexc(c) for c in colors]
    for y in range(size[1]):
        for x in range(size[0]):
            px[x, y] = rng.choices(cols, weights=weights)[0]
    return img


def scale(img: Image.Image, f: int) -> Image.Image:
    return img.resize((img.width * f, img.height * f), Image.NEAREST)


# --- box UV ---------------------------------------------------------------

def box_faces(u: int, v: int, w: int, h: int, d: int) -> dict[str, tuple[int, int, int, int]]:
    """Bedrock/Java box-UV layout -> {face: (x, y, width, height)} in texture pixels."""
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + d + w + d, v + d, w, h),
    }


def fill_rect(img: Image.Image, rect: tuple[int, int, int, int], color: RGBA, rng: random.Random | None = None,
              jitter: float = 0.0) -> None:
    x0, y0, w, h = rect
    px = img.load()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if 0 <= x < img.width and 0 <= y < img.height:
                c = color
                if rng and jitter:
                    c = shade(color, 1 + rng.uniform(-jitter, jitter))
                px[x, y] = c


def iter_rect(rect: tuple[int, int, int, int]) -> Iterable[tuple[int, int]]:
    x0, y0, w, h = rect
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            yield x, y
