"""Make a square album cover in Shalone Cason's series style.

Painting rules:
  - Public domain or CC0 only, confirmed by the museum's own per-image flag:
    The Met (isPublicDomain: true), Art Institute of Chicago
    (is_public_domain: true), Cleveland Museum of Art (share_license_status:
    CC0), Rijksmuseum, or National Gallery of Art open data.
    Never Google Images or Pinterest finds.
  - No nudity, including see-through or sheer clothing, anywhere in the crop.

Usage:
  python make_cover.py PAINTING.jpg OUT_FOLDER --crop CX CY SIDE \
      --title "..." --artist "..." --year "..." --museum "..." \
      --url "..." --license "..."

--crop: centre of the square (0-1 across, 0-1 down) and its size as a
fraction of the painting's shorter edge. Writes cover.jpg, cover-800.jpg
and credits.txt into OUT_FOLDER.

Optional per-album tweaks (leave them off to keep the series look):
  --light-leak 0.4   light leak strength for this album (series default below)
  --hue -12          shift the painting's colours by this many degrees
"""
import argparse
import datetime
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFilter, ImageFont

# ---- Series settings: keep these the same for every album -------------------
HERE = Path(__file__).resolve().parent
SIZE = 3000                       # main cover, square px
SITE_SIZE = 800                   # site copy, square px
LOGO_PATH = HERE / "logo-white.png"
LOGO_WIDTH = 0.18                 # logo width as a fraction of cover width
MARGIN = 0.05                     # gap from the edges, fraction of cover width
TEXT = "human-made"
FONT_PATH = HERE / "Caladea-Regular.ttf"   # SIL Open Font License
TEXT_SIZE = 0.051                 # text height as a fraction of cover width
MARK_COLOR = (238, 231, 216)      # warm ivory for the logo and text
LOGO_OPACITY = 0.92
TEXT_OPACITY = 0.88
SHADOW = 0.6                      # soft drop shadow under logo and text; 0 = none
GRUNGE = 1.0                      # 0 = clean, 1 = series default, 2 = heavy
LIGHT_LEAK = 0.7                  # warm film light leaks at the edges; 0 = none
BLACK_LIFT = 16                   # 0-255; raises the darkest blacks to a matte grey
BORDER = "card"                   # none | line | double | card | beaded
BORDER_INSET = 0.025              # border distance from the edge, fraction of cover width
SEED = 7                          # same seed = same grain/dust pattern
JPEG_QUALITY = 92
# ------------------------------------------------------------------------------


def load_srgb(path):
    im = Image.open(path)
    icc = im.info.get("icc_profile")
    if icc:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        im = ImageCms.profileToProfile(im, src, ImageCms.createProfile("sRGB"), outputMode="RGB")
    return im.convert("RGB")


def square_crop(im, cx, cy, side):
    w, h = im.size
    s = int(min(w, h) * side)
    x0 = min(max(int(cx * w - s / 2), 0), w - s)
    y0 = min(max(int(cy * h - s / 2), 0), h - s)
    return im.crop((x0, y0, x0 + s, y0 + s)).resize((SIZE, SIZE), Image.LANCZOS)


def soft_noise(rng, cells):
    """Smooth random field in 0..1, made by upscaling a tiny random grid."""
    small = Image.fromarray((rng.random((cells, cells)) * 255).astype(np.uint8))
    return np.asarray(small.resize((SIZE, SIZE), Image.BICUBIC), np.float32) / 255


def make_overlay():
    """The series texture. Same SEED = identical grain, dust and scratches on every cover."""
    rng = np.random.default_rng(SEED)
    g = GRUNGE

    # Grime: blotchy darkening that gathers toward the edges and corners.
    yy, xx = np.mgrid[0:SIZE, 0:SIZE] / (SIZE - 1) - 0.5
    edge = np.clip((np.hypot(xx, yy) * 2 - 0.55) / 0.85, 0, 1) ** 1.6
    blotch = 0.5 * soft_noise(rng, 5) + 0.3 * soft_noise(rng, 16) + 0.2 * soft_noise(rng, 50)
    multiply = 1 - g * (0.30 * edge * (0.4 + blotch) + 0.06 * blotch)

    # Film grain: coarse (about 2 px) luminance noise with a touch of colour.
    half = SIZE // 2
    mono = rng.normal(0, 1, (half, half))
    chroma = rng.normal(0, 1, (half, half, 3)) * 0.35
    grain = ((mono[..., None] + chroma) * 40 + 128).clip(0, 255).astype(np.uint8)
    grain = np.asarray(Image.fromarray(grain).resize((SIZE, SIZE), Image.BILINEAR), np.float32) - 128
    add = grain * 0.45 * g

    # Dust and scratches: mostly white flecks, some in loose clusters, plus fine vertical scratches.
    layer = Image.new("L", (SIZE, SIZE), 0)
    d = ImageDraw.Draw(layer)
    centres = rng.integers(0, SIZE, (int(10 * g), 2))
    for i in range(int(1400 * g)):
        if i % 2:
            cx, cy = centres[rng.integers(len(centres))]
            x, y = (rng.normal([cx, cy], 140)).astype(int)
        else:
            x, y = rng.integers(0, SIZE, 2)
        r = rng.choice([1, 1, 1, 2, 2, 3, 4, 6])
        d.ellipse((x - r, y - r, x + r, y + r), fill=int(rng.integers(60, 200)))
    for _ in range(int(45 * g)):
        x, y = rng.integers(0, SIZE, 2)
        angle = rng.normal(np.pi / 2, 0.3)
        length = rng.integers(80, 1100)
        pts = [(x + np.cos(angle) * t + rng.normal(0, 2), y + np.sin(angle) * t)
               for t in np.linspace(0, length, 14)]
        d.line(pts, fill=int(rng.integers(70, 170)), width=int(rng.choice([1, 2, 2, 3])))
    dark = Image.new("L", (SIZE, SIZE), 0)
    dd = ImageDraw.Draw(dark)
    for _ in range(int(60 * g)):                    # a few dark specks too
        x, y = rng.integers(0, SIZE, 2)
        r = rng.choice([2, 3, 5])
        dd.ellipse((x - r, y - r, x + r, y + r), fill=int(rng.integers(60, 140)))
    light = np.asarray(layer.filter(ImageFilter.GaussianBlur(1.0)), np.float32)
    dark = np.asarray(dark.filter(ImageFilter.GaussianBlur(1.0)), np.float32)
    add += ((light - dark) * 0.85)[..., None]
    return multiply[..., None], add


def make_light_leak(strength):
    """Fixed warm glows (same on every cover): red-orange from the left, amber top right."""
    rng = np.random.default_rng(SEED + 1)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE] / (SIZE - 1)
    leak = np.zeros((SIZE, SIZE, 3), np.float32)
    for cx, cy, r, colour, strength in [
        (-0.08, 0.72, 0.38, (255, 70, 30), 0.75),
        (-0.04, 0.95, 0.22, (255, 150, 60), 0.45),
        (1.06, 0.08, 0.30, (255, 175, 80), 0.50),
        (1.04, 0.40, 0.18, (230, 90, 160), 0.25),
    ]:
        glow = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r ** 2)) * strength
        leak += glow[..., None] * np.array(colour, np.float32)
    leak *= (0.75 + 0.5 * soft_noise(rng, 7))[..., None]
    return (leak * strength).clip(0, 255)


def shift_hue(im, degrees):
    hsv = np.asarray(im.convert("HSV")).copy()
    hsv[..., 0] = (hsv[..., 0].astype(int) + round(degrees * 256 / 360)) % 256
    return Image.fromarray(hsv, "HSV").convert("RGB")


def grunge(im, light_leak=LIGHT_LEAK):
    a = np.asarray(im, np.float32)

    # Matte finish: slightly lower contrast and saturation.
    lum = a.mean(axis=2, keepdims=True)
    a = lum + (a - lum) * (1 - 0.06 * GRUNGE)
    a = 128 + (a - 128) * (1 - 0.05 * GRUNGE)

    multiply, add = make_overlay()
    a = a * multiply + add

    # Light leaks: warm glows bleeding in from the edges, screen-blended.
    a = 255 - (255 - a.clip(0, 255)) * (255 - make_light_leak(light_leak)) / 255

    # Lift the blacks so the cover sits softly on a matte black site.
    a = BLACK_LIFT + a.clip(0, 255) * (255 - BLACK_LIFT) / 255
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def make_card(im):
    """'card' border: the painting as a rounded-corner card on matte black."""
    inset, radius = int(SIZE * 0.04), int(SIZE * 0.045)
    inner = SIZE - 2 * inset
    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius, fill=255)
    card = Image.new("RGB", (SIZE, SIZE), (20, 20, 20))
    card.paste(im.resize((inner, inner), Image.LANCZOS), (inset, inset), mask)
    return card


def rounded_rect_points(inset, radius, spacing):
    """Evenly spaced points along a rounded rectangle (for the beaded border)."""
    lo, hi = inset + radius, SIZE - 1 - inset - radius
    path = []
    for (cx, cy), start in [((hi, lo), -90), ((hi, hi), 0), ((lo, hi), 90), ((lo, lo), 180)]:
        for t in np.linspace(start, start + 90, 200):
            path.append((cx + radius * np.cos(np.radians(t)), cy + radius * np.sin(np.radians(t))))
    path.append(path[0])
    path = np.array(path)
    dist = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(path, axis=0).T))])
    n = int(dist[-1] // spacing)
    at = np.linspace(0, dist[-1], n, endpoint=False)
    return np.stack([np.interp(at, dist, path[:, 0]), np.interp(at, dist, path[:, 1])], axis=1)


def draw_border(marks):
    d = ImageDraw.Draw(marks)
    col = MARK_COLOR + (int(255 * LOGO_OPACITY),)
    i = int(SIZE * BORDER_INSET)
    u = SIZE / 1000                                  # 1 unit = 0.1% of the cover
    if BORDER == "line":
        d.rectangle((i, i, SIZE - 1 - i, SIZE - 1 - i), outline=col, width=int(3 * u))
    elif BORDER == "double":
        i2 = i + int(11 * u)
        d.rectangle((i, i, SIZE - 1 - i, SIZE - 1 - i), outline=col, width=int(3 * u))
        d.rectangle((i2, i2, SIZE - 1 - i2, SIZE - 1 - i2), outline=col, width=int(1.5 * u))
        c, mid = (i + i2) / 2, SIZE / 2
        for x, y, r in [(c, c, 14), (SIZE - c, c, 14), (c, SIZE - c, 14), (SIZE - c, SIZE - c, 14),
                        (mid, c, 8), (mid, SIZE - c, 8), (c, mid, 8), (SIZE - c, mid, 8)]:
            r *= u
            d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill=col)
    elif BORDER == "beaded":
        radius = int(40 * u)
        d.rounded_rectangle((i, i, SIZE - 1 - i, SIZE - 1 - i), radius, outline=col, width=int(2.5 * u))
        gap = int(11 * u)
        for x, y in rounded_rect_points(i + gap, radius - gap, 12 * u):
            r = 2.6 * u
            d.ellipse((x - r, y - r, x + r, y + r), fill=col)


def add_marks(im):
    if BORDER == "card":
        im = make_card(im)
    im = im.convert("RGBA")
    extra = {"none": 0, "line": 0.015, "double": 0.022, "card": 0.03, "beaded": 0.022}[BORDER]
    margin = int(SIZE * (MARGIN + extra))

    marks = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw_border(marks)

    logo = Image.open(LOGO_PATH).convert("RGBA")
    lw = int(SIZE * LOGO_WIDTH)
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    alpha = logo.getchannel("A").point(lambda v: int(v * LOGO_OPACITY))
    logo = Image.new("RGBA", logo.size, MARK_COLOR + (0,))
    logo.putalpha(alpha)
    marks.alpha_composite(logo, (margin, margin))

    font = ImageFont.truetype(str(FONT_PATH), int(SIZE * TEXT_SIZE))
    ImageDraw.Draw(marks).text((SIZE - margin, SIZE - margin), TEXT, font=font, anchor="rd",
                               fill=MARK_COLOR + (int(255 * TEXT_OPACITY),))

    if SHADOW:
        offset = int(SIZE * 0.003)
        shadow_alpha = marks.getchannel("A").filter(ImageFilter.GaussianBlur(SIZE * 0.006))
        shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
        shadow.putalpha(shadow_alpha.point(lambda v: int(v * SHADOW)))
        im.alpha_composite(shadow, (offset, offset))
    im.alpha_composite(marks)
    return im.convert("RGB")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("painting")
    p.add_argument("out")
    p.add_argument("--crop", nargs=3, type=float, default=[0.5, 0.5, 1.0], metavar=("CX", "CY", "SIDE"))
    p.add_argument("--light-leak", type=float, default=LIGHT_LEAK)
    p.add_argument("--hue", type=float, default=0)
    for field in ["title", "artist", "year", "museum", "url", "license"]:
        p.add_argument("--" + field, required=True)
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # Marks go on before the grunge so they age with the painting instead of looking pasted on.
    painting = square_crop(load_srgb(args.painting), *args.crop)
    if args.hue:
        painting = shift_hue(painting, args.hue)
    cover = grunge(add_marks(painting), args.light_leak)
    cover.save(out / "cover.jpg", quality=JPEG_QUALITY, optimize=True)
    cover.resize((SITE_SIZE, SITE_SIZE), Image.LANCZOS).save(out / "cover-800.jpg", quality=JPEG_QUALITY, optimize=True)

    (out / "credits.txt").write_text(
        f"Cover painting: {args.title}\n"
        f"Artist: {args.artist}\n"
        f"Year: {args.year}\n"
        f"Museum: {args.museum}\n"
        f"Object URL: {args.url}\n"
        f"License: {args.license}\n"
        f"Date: {datetime.date.today().isoformat()}\n"
    )
    print("Wrote", out / "cover.jpg", out / "cover-800.jpg", out / "credits.txt")


if __name__ == "__main__":
    main()
