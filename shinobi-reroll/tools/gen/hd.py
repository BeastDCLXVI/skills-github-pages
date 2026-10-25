"""HD texturing (v1.3).

Textures are still *designed* at classic resolution (64x64 skins, 16x16 icons), but every design
canvas also records what each pixel is made of: skin, hair, cloth, metal, fur, scales... `render_hd`
then paints the texture at 2-4x with material-aware micro-detail (hair strands, cloth weave, brushed
metal, fur), soft face shading and edge occlusion. Features that would look blocky when merely
enlarged (eyes, forehead-protector crests, Akatsuki clouds, whiskers, hair fringes) are redrawn
natively at the higher resolution.

Bedrock samples entity textures by normalised UVs, so a 256x256 skin works with the 64x64 humanoid
geometry: the head becomes a 32x32x32-texel cube.
"""
from __future__ import annotations

import math

from PIL import Image

from .pixel import RGBA, hexc, mix, shade

FLAT = "flat"


class MatCanvas:
    """A low-resolution canvas that remembers the material of every pixel it paints."""

    def __init__(self, w: int, h: int):
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.width, self.height = w, h
        self.mat = [[FLAT] * w for _ in range(h)]
        self.material = FLAT
        self.features: list[tuple] = []  # (kind, *data) drawn natively by render_hd overlays

    # PIL-compatible subset used by the painters
    def putpixel(self, xy: tuple[int, int], color: RGBA) -> None:
        self.img.putpixel(xy, color)
        self.mat[xy[1]][xy[0]] = self.material

    def getpixel(self, xy: tuple[int, int]) -> RGBA:
        return self.img.getpixel(xy)

    def load(self):
        return _PixelAccess(self)

    def feature(self, kind: str, *data) -> None:
        self.features.append((kind, *data))


class _PixelAccess:
    def __init__(self, cv: MatCanvas):
        self.cv = cv
        self.px = cv.img.load()

    def __getitem__(self, xy):
        return self.px[xy]

    def __setitem__(self, xy, color):
        self.cv.putpixel(xy, color)


def _hash(x: int, y: int, s: int = 0) -> float:
    """Deterministic value noise in [0, 1) (no process-randomised hashing: builds stay reproducible)."""
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536.0


def _micro(mat: str, hx: int, hy: int, rx: float, ry: float, scale: int, seed: int) -> float:
    """Brightness multiplier for one HD texel. rx/ry: position inside the face, 0..1."""
    n = _hash(hx, hy, seed)
    if mat == "skin":
        return (1.045 - 0.09 * ry) * (1 + (n - 0.5) * 0.025)
    if mat == "hair":
        strand = _hash(hx + hy // 3, 7, seed)
        shine = 1.08 if 0.12 < ry < 0.32 else 1.0
        return (0.84 + 0.26 * strand) * shine * (1 + (n - 0.5) * 0.04)
    if mat == "fur":
        strand = _hash(hx + hy // 2, hy // (scale * 2), seed)
        return (0.88 + 0.22 * strand) * (1.04 - 0.08 * ry)
    if mat == "cloth":
        weave = 1.025 if (hx + hy) % 2 == 0 else 0.975
        fold = 1 - 0.035 * math.sin(ry * math.pi * 3 + rx * 1.3)
        return weave * fold * (1 + (n - 0.5) * 0.05)
    if mat == "wrap":
        band = 1.05 if (hy // 2) % 2 == 0 else 0.9
        seam = 0.84 if (hx + hy * 2) % (scale * 4) == 0 else 1.0
        return band * seam
    if mat == "metal":
        spark = 1.3 if n > 0.985 else 1.0
        return (1.18 - 0.32 * (rx * 0.45 + ry * 0.55)) * spark
    if mat == "scale":
        row = hy // 3
        edge = (hx + (row % 2) * 2) % 4 == 0 or hy % 3 == 0
        return (0.84 if edge else 1.04) * (1.03 - 0.06 * ry)
    if mat == "bone":
        return (1.08 - 0.16 * ry) * (0.92 if hy % 4 == 0 else 1.0)
    if mat == "shoe":
        return (1.02 - 0.08 * ry) * (1 + (n - 0.5) * 0.04)
    if mat == "wood":
        grain = 0.86 + 0.22 * _hash(hx, 3, seed)
        return grain * (1 + (n - 0.5) * 0.05)
    return 1.0


def _apply(c: RGBA, k: float) -> RGBA:
    """Fast brightness change (RGB space; the HLS `shade` is too slow for millions of texels)."""
    if k == 1.0:
        return c
    if k < 1:
        return (round(c[0] * k), round(c[1] * k), round(c[2] * k), c[3])
    t = min(1.0, k - 1)
    return (round(c[0] + (255 - c[0]) * t), round(c[1] + (255 - c[1]) * t), round(c[2] + (255 - c[2]) * t), c[3])


def render_hd(cv: MatCanvas, scale: int, faces: list[tuple[int, int, int, int]] = (), seed: int = 0,
              fringe: bool = True) -> Image.Image:
    """Paint `cv` at `scale`x with material micro-detail, face shading and native-resolution features."""
    W, H = cv.width * scale, cv.height * scale
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    po = out.load()
    src = cv.img.load()
    face_of: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for r in faces:
        fx, fy, fw, fh = r
        for y in range(fy, fy + fh):
            for x in range(fx, fx + fw):
                face_of[(x, y)] = r
    for y in range(cv.height):
        for x in range(cv.width):
            c = src[x, y]
            if c[3] == 0:
                continue
            mat = cv.mat[y][x]
            f = face_of.get((x, y))
            above = (x, y - 1)
            hair_above = (fringe and mat != "hair" and y > 0 and cv.mat[y - 1][x] == "hair"
                          and f is not None and face_of.get(above) == f)
            hair_col = src[x, y - 1] if hair_above else None
            for sy in range(scale):
                for sx in range(scale):
                    hx, hy = x * scale + sx, y * scale + sy
                    if f:
                        fx, fy, fw, fh = f
                        rx = (hx - fx * scale + 0.5) / (fw * scale)
                        ry = (hy - fy * scale + 0.5) / (fh * scale)
                    else:
                        rx = ry = 0.5
                    col, m = c, mat
                    if hair_col is not None:
                        # jagged fringe: each low-res hair pixel grows a tooth into the pixel below
                        tooth = round(scale / 2 - abs(sx + 0.5 - scale / 2))
                        if sy < tooth:
                            col, m = hair_col, "hair"
                    k = _micro(m, hx, hy, rx, ry, scale, seed)
                    if f and m != FLAT:
                        lx, ly = hx - f[0] * scale, hy - f[1] * scale
                        if lx == 0 or ly == 0 or lx == f[2] * scale - 1 or ly == f[3] * scale - 1:
                            k *= 0.9
                    po[hx, hy] = _apply(col, k)
    for feat in cv.features:
        OVERLAYS[feat[0]](out, scale, *feat[1:])
    return out


# ------------------------------------------------------------------ native-resolution features

def _px(img: Image.Image, x: int, y: int, c: RGBA) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def _eye(img: Image.Image, s: int, x: int, y: int, style: str, iris: str, skin: str) -> None:
    """An eye covering 2x1 low-res pixels at (x, y): sclera, iris, pupil, lid and highlight."""
    x0, y0, w, h = x * s, y * s, 2 * s, s
    white = hexc("#f4f4f0")
    lid = shade(hexc(skin), 0.45)
    cx = x0 + (w - 1) / 2
    cy = y0 + (h - 1) / 2 + 0.25
    r = max(1.0, h * 0.5)
    pal = {
        "normal": (white, hexc(iris), hexc("#121016")),
        "sharingan": (white, hexc("#c0101a"), hexc("#140808")),
        "byakugan": (hexc("#ece8f6"), hexc("#d8d0ec"), None),
        "rinnegan": (hexc("#e8e2f4"), hexc("#a58fd8"), hexc("#4a3480")),
        "blank": (hexc("#141414"), hexc("#141414"), None),
        "slit": (hexc("#f0e2a0"), hexc("#e8c13a"), hexc("#141010")),
        "void": (hexc("#2a1030"), hexc("#ff3a52"), hexc("#ffd0d8")),
    }
    sclera, iris_c, pupil = pal.get(style, pal["normal"])
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w):
            d = math.hypot((xx - cx) / 1.0, (yy - cy) * 1.15)
            col = sclera
            if d <= r:
                col = shade(iris_c, 1.15 - 0.35 * (d / r)) if style != "blank" else iris_c
                if style == "rinnegan" and abs(d - r * 0.55) < 0.5:
                    col = pupil
                elif pupil is not None and style != "rinnegan" and d <= r * (0.3 if style != "slit" else 1.0):
                    if style != "slit" or abs(xx - cx) < 0.6:
                        col = pupil
            _px(img, xx, yy, col)
    if style == "sharingan":
        for a in (0.3, 2.4, 4.5):
            _px(img, round(cx + math.cos(a) * r * 0.75), round(cy + math.sin(a) * r * 0.75), hexc("#140808"))
    if style in ("normal", "sharingan", "slit", "void"):
        _px(img, round(cx - r * 0.4), round(cy - r * 0.45), hexc("#ffffff"))
    for xx in range(x0, x0 + w):
        _px(img, xx, y0, lid)  # upper lid / lash line


def _plate(img: Image.Image, s: int, x: int, y: int, w: int, h: int, scratched: bool) -> None:
    """Forehead-protector plate: brushed steel, rivets and an engraved village crest."""
    x0, y0, W, H = x * s, y * s, w * s, h * s
    steel = hexc("#b6c0ca")
    engrave = hexc("#47505c")
    for yy in range(H):
        for xx in range(W):
            k = 1.18 - 0.34 * ((xx / W) * 0.4 + (yy / H) * 0.6)
            if xx in (0, W - 1) or yy in (0, H - 1):
                k *= 0.78
            _px(img, x0 + xx, y0 + yy, shade(steel, k))
    for rx, ry in ((1, 1), (W - 2, 1), (1, H - 2), (W - 2, H - 2)):
        _px(img, x0 + rx, y0 + ry, shade(steel, 0.6))
    # leaf crest: a spiral with a pointed tip
    cx, cy = x0 + W / 2 - 0.5, y0 + H / 2
    rad = min(W, H) * 0.32
    for i in range(48):
        t = i / 48 * math.pi * 1.7
        rr = rad * (0.35 + 0.65 * i / 48)
        _px(img, round(cx + math.cos(t) * rr), round(cy + math.sin(t) * rr), engrave)
    for i in range(int(rad * 1.6)):
        _px(img, round(cx + rad + i * 0.7), round(cy - rad + i * 0.45), engrave)
    if scratched:
        red = hexc("#7a1418")
        for i in range(W - 2):
            _px(img, x0 + 1 + i, round(y0 + H - 2 - i * (H - 3) / max(1, W - 3)), red)


def _cloud(img: Image.Image, s: int, x: int, y: int) -> None:
    """Red Akatsuki cloud with a white outline, anchored at a low-res pixel."""
    red, white = hexc("#c0262b"), hexc("#f4f1ea")
    ox, oy = x * s, (y - 1) * s
    blobs = [(0.8, 1.3, 0.75), (1.6, 0.8, 0.85), (2.4, 1.3, 0.75)]

    def inside(px_, py_, grow=0.0):
        return any(math.hypot(px_ / s - bx, py_ / s - by) <= br + grow for bx, by, br in blobs) and py_ / s <= 1.9 + grow

    for yy in range(-1, 2 * s + 1):
        for xx in range(-1, 3 * s + 2):
            if inside(xx, yy):
                _px(img, ox + xx, oy + yy, shade(red, 1.1 - 0.2 * (yy / (2 * s))))
            elif inside(xx, yy, 1.2 / s):
                _px(img, ox + xx, oy + yy, white)


def _vline(img: Image.Image, s: int, x: int, y0: int, y1: int, color: str) -> None:
    """A one-texel line down the middle of a low-res column (tear troughs, gills)."""
    cx = x * s + s // 2
    for yy in range(y0 * s + 1, (y1 + 1) * s - 1):
        _px(img, cx, yy, hexc(color))


def _whiskers(img: Image.Image, s: int, x0: int, y0: int, skin: str) -> None:
    """Three thin whisker marks on each cheek of the face starting at low-res (x0, y0)."""
    col = shade(hexc(skin), 0.5)
    for i, yy in enumerate((5 * s, 5 * s + s // 2 + 1, 6 * s + 1)):
        for k in range(int(s * 1.5)):
            _px(img, x0 * s + k, y0 * s + yy - (1 if k > s and i == 0 else 0), col)
            _px(img, (x0 + 8) * s - 1 - k, y0 * s + yy - (1 if k > s and i == 0 else 0), col)


def _mouth(img: Image.Image, s: int, x: int, y: int, skin: str) -> None:
    col = shade(hexc(skin), 0.62)
    yy = y * s + s // 2
    for xx in range(x * s + s // 2, (x + 2) * s - s // 2):
        _px(img, xx, yy, col)
    _px(img, x * s + s // 2 - 1, yy - 1, shade(hexc(skin), 0.75))
    _px(img, (x + 2) * s - s // 2, yy - 1, shade(hexc(skin), 0.75))


OVERLAYS = {
    "eye": _eye,
    "plate": _plate,
    "cloud": _cloud,
    "vline": _vline,
    "whiskers": _whiskers,
    "mouth": _mouth,
}


# ------------------------------------------------------------------ icons: 16x16 -> 32x32

def scale2x(img: Image.Image) -> Image.Image:
    """EPX / Scale2x: doubles pixel art while rounding diagonal edges instead of staircasing them."""
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    po = out.load()

    def g(x, y):
        return src[min(max(x, 0), w - 1), min(max(y, 0), h - 1)]

    for y in range(h):
        for x in range(w):
            p, a, b, c, d = g(x, y), g(x, y - 1), g(x + 1, y), g(x - 1, y), g(x, y + 1)
            e0 = e1 = e2 = e3 = p
            if c == a and c != d and a != b:
                e0 = a
            if a == b and a != c and b != d:
                e1 = b
            if d == c and d != b and c != a:
                e2 = c
            if b == d and b != a and d != c:
                e3 = d
            po[2 * x, 2 * y], po[2 * x + 1, 2 * y] = e0, e1
            po[2 * x, 2 * y + 1], po[2 * x + 1, 2 * y + 1] = e2, e3
    return out


def hd_icon(img: Image.Image, outline: RGBA = hexc("#16131c")) -> Image.Image:
    """32x32 icon from a 16x16 design: Scale2x, then a light inner bevel so surfaces read as volume."""
    if img.size[0] >= 32:
        return img
    big = scale2x(img)
    w, h = big.size
    src = big.load()
    out = big.copy()
    po = out.load()

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and src[x, y][3] > 0 and src[x, y][:3] != outline[:3]

    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if c[3] == 0 or c[:3] == outline[:3]:
                continue
            if not solid(x - 1, y) or not solid(x, y - 1):
                po[x, y] = shade(c, 1.14)
            elif not solid(x + 1, y) or not solid(x, y + 1):
                po[x, y] = shade(c, 0.86)
    return out


def blend(a: str, b: str, t: float) -> RGBA:
    return mix(hexc(a), hexc(b), t)
