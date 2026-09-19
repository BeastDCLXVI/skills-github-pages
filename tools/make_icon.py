#!/usr/bin/env python3
"""Draw the site icon from the deployment's own encoding.

The mark scheme is: something above the glyph means modelled, something below
means shaded, both sides means both. The icon is that legend as a picture - the
block sigil with marks above and below - drawn as rectangles rather than typed
as combining characters, so it does not depend on the viewer having a font that
renders U+0300..U+036F at 16 pixels.

No image library is available here, so the PNG and ICO containers are written
directly. Both are deterministic: same grid in, same bytes out.

Usage:  python3 tools/make_icon.py [--check]
"""

import argparse
import pathlib
import struct
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# 16x16 design grid. M = a mark, B = the block sigil.
GRID = [
    "................",
    "..MM..MM...MM...",
    "................",
    "....MM...MM.....",
    "................",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "................",
    "...MM...MM..MM..",
    "................",
    "..MM...MM...MM..",
    "................",
]

INK = {"B": (0x1F, 0x88, 0x3D, 0xFF),   # the sigil
       "M": (0x3F, 0xB9, 0x50, 0xFF)}   # the marks on it
CLEAR = (0, 0, 0, 0)


def pixels(scale):
    """Expand the grid to a flat RGBA pixel list at `scale`x."""
    size = 16 * scale
    rows = []
    for line in GRID:
        row = []
        for ch in line:
            row.extend([INK.get(ch, CLEAR)] * scale)
        rows.extend([row] * scale)
    return size, rows


def png_bytes(scale):
    size, rows = pixels(scale)
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBBB", *px) for px in row) for row in rows
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def ico_bytes(scales=(1, 2, 3)):
    """ICO holding one BMP-encoded image per scale (16, 32, 48 px)."""
    images = []
    for scale in scales:
        size, rows = pixels(scale)
        # BMP inside an ICO is bottom-up, BGRA, with a doubled height in the header.
        xor = b"".join(
            b"".join(struct.pack("BBBB", px[2], px[1], px[0], px[3]) for px in row)
            for row in reversed(rows)
        )
        # 1bpp AND mask, unused for 32-bit images but required to be present.
        mask_row = b"\x00" * (((size + 31) // 32) * 4)
        header = struct.pack(
            "<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, len(xor), 0, 0, 0, 0
        )
        images.append((size, header + xor + mask_row * size))

    out = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    for size, blob in images:
        out += struct.pack(
            "<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(blob), offset
        )
        offset += len(blob)
    return out + b"".join(blob for _, blob in images)


def svg_bytes():
    """Same grid as merged horizontal runs, so the vector stays small."""
    rects = []
    for y, line in enumerate(GRID):
        x = 0
        while x < 16:
            ch = line[x]
            if ch == ".":
                x += 1
                continue
            run = 0
            while x + run < 16 and line[x + run] == ch:
                run += 1
            r, g, b, _ = INK[ch]
            rects.append(
                f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="#{r:02x}{g:02x}{b:02x}"/>'
            )
            x += run
    body = "\n  ".join(rects)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
        'shape-rendering="crispEdges" role="img" '
        'aria-label="A block sigil with marks above and below it">\n  '
        f"{body}\n</svg>\n"
    ).encode("utf-8")


FILES = {
    "favicon.ico": ico_bytes,
    "favicon.svg": svg_bytes,
    "icon-192.png": lambda: png_bytes(12),
    "icon-32.png": lambda: png_bytes(2),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="fail instead of writing if the committed icons are stale")
    args = parser.parse_args()

    ASSETS.mkdir(exist_ok=True)
    stale = []
    for name, build in FILES.items():
        path = ASSETS / name
        data = build()
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                stale.append(name)
            else:
                print(f"assets/{name} is up to date ({len(data)} bytes)")
        else:
            path.write_bytes(data)
            print(f"wrote assets/{name} ({len(data)} bytes)")

    if stale:
        print("stale, run python3 tools/make_icon.py: " + ", ".join(stale), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
