"""Developer preview: software-render every generated box model to a PNG contact sheet.

    python3 tools/preview.py out.png

Bones are transformed with Bedrock's conventions (rotations about bone pivots,
X/Y rotation signs flipped, ZYX order) and faces are painted with the average
colour of their texture region, so a misplaced tail or wrong UV shows up
without launching the game.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gen.models import BIJUU, JUUBI, Model, build_beast, decoy_log, toad, training_post  # noqa: E402
from gen.pixel import box_faces  # noqa: E402


def _rot(rx, ry, rz):
    rx, ry, rz = math.radians(-rx), math.radians(-ry), math.radians(rz)
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    return _mm(Rz, _mm(Ry, Rx))


def _mm(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def _mv(m, v):
    return [sum(m[i][k] * v[k] for k in range(3)) for i in range(3)]


def _about(pivot, rot):
    """Affine transform (R, t) rotating about pivot."""
    R = _rot(*rot)
    p = pivot
    rp = _mv(R, p)
    return R, [p[i] - rp[i] for i in range(3)]


def _compose(a, b):
    """a after b."""
    Ra, ta = a
    Rb, tb = b
    return _mm(Ra, Rb), [x + y for x, y in zip(_mv(Ra, tb), ta)]


def _apply(tf, v):
    R, t = tf
    rv = _mv(R, v)
    return [rv[i] + t[i] for i in range(3)]


def bone_transforms(model: Model):
    by_name = {b.name: b for b in model.bones}
    cache = {}

    def get(name):
        if name in cache:
            return cache[name]
        b = by_name[name]
        local = _about(b.pivot, b.rotation) if b.rotation else ([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0, 0, 0])
        tf = _compose(get(b.parent), local) if b.parent else local
        cache[name] = tf
        return tf

    return {n: get(n) for n in by_name}


def render(model: Model, tex: Image.Image, size=260, yaw=35.0, pitch=20.0) -> Image.Image:
    tfs = bone_transforms(model)
    tpx = tex.load()
    polys = []
    for c in model.cubes:
        ox, oy, oz = c.origin
        w, h, d = c.size
        corners = {
            "north": [(ox, oy, oz), (ox + w, oy, oz), (ox + w, oy + h, oz), (ox, oy + h, oz)],
            "south": [(ox, oy, oz + d), (ox + w, oy, oz + d), (ox + w, oy + h, oz + d), (ox, oy + h, oz + d)],
            "east": [(ox + w, oy, oz), (ox + w, oy, oz + d), (ox + w, oy + h, oz + d), (ox + w, oy + h, oz)],
            "west": [(ox, oy, oz), (ox, oy, oz + d), (ox, oy + h, oz + d), (ox, oy + h, oz)],
            "up": [(ox, oy + h, oz), (ox + w, oy + h, oz), (ox + w, oy + h, oz + d), (ox, oy + h, oz + d)],
            "down": [(ox, oy, oz), (ox + w, oy, oz), (ox + w, oy, oz + d), (ox, oy, oz + d)],
        }
        regions = box_faces(c.uv[0], c.uv[1], w, h, d)
        cube_tf = _about(c.pivot or c.origin, c.rotation) if c.rotation else None
        for face, pts in corners.items():
            rx, ry, rw, rh = regions[face]
            acc = [0, 0, 0, 0]
            for yy in range(ry, ry + rh):
                for xx in range(rx, rx + rw):
                    p = tpx[xx, yy]
                    for i in range(4):
                        acc[i] += p[i]
            n = max(1, rw * rh)
            col = tuple(v // n for v in acc)
            world = []
            for p in pts:
                v = list(p)
                if cube_tf:
                    v = _apply(cube_tf, v)
                world.append(_apply(tfs[c.bone], v))
            polys.append((world, col, face))
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))

    def view(v):
        x, y, z = v
        x, z = x * cy - z * sy, x * sy + z * cy
        y, z = y * cp - z * sp, y * sp + z * cp
        return x, y, z

    projected = [([view(v) for v in w], col, face) for w, col, face in polys]
    xs = [p[0] for poly, _, _ in projected for p in poly]
    ys = [p[1] for poly, _, _ in projected for p in poly]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) or 1
    s = (size - 20) / span
    mx, my = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    img = Image.new("RGBA", (size, size), (52, 56, 66, 255))
    d = ImageDraw.Draw(img)
    light = {"up": 1.15, "north": 1.0, "south": 0.8, "east": 0.88, "west": 0.88, "down": 0.6}
    for poly, col, face in sorted(projected, key=lambda q: sum(p[2] for p in q[0]) / 4, reverse=False):
        pts = [(size / 2 + (p[0] - mx) * s, size / 2 - (p[1] - my) * s) for p in poly]
        if col[3] < 20:
            continue
        lc = tuple(min(255, int(c * light[face])) for c in col[:3])
        d.polygon(pts, fill=lc, outline=(20, 20, 26))
    return img


def main(out: str) -> None:
    models = [build_beast(k, t, kw) for k, _, t, kw in BIJUU] + [build_beast(JUUBI[0], JUUBI[2], JUUBI[3]),
                                                                toad(), training_post(), decoy_log()]
    tiles = []
    for m in models:
        tex = m.texture(seed=len(m.key))
        front = render(m, tex, yaw=200, pitch=18)
        side = render(m, tex, yaw=110, pitch=12)
        tile = Image.new("RGBA", (520 + tex.width * 2, 280), (40, 42, 50, 255))
        tile.paste(front, (0, 10))
        tile.paste(side, (260, 10))
        tile.paste(tex.resize((tex.width * 2, tex.height * 2), Image.NEAREST), (520, 10))
        ImageDraw.Draw(tile).text((6, 2), f"{m.key}  tex {tex.width}x{tex.height}", fill=(255, 255, 255))
        tiles.append(tile)
    W = max(t.width for t in tiles)
    sheet = Image.new("RGBA", (W, sum(t.height for t in tiles)), (30, 30, 36, 255))
    y = 0
    for t in tiles:
        sheet.paste(t, (0, y))
        y += t.height
    sheet.save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "model_preview.png")
