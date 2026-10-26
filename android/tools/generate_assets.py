#!/usr/bin/env python3
"""Regenerates launcher icons, notification icon, and Play Store graphics for TrailLog.

Only needs Pillow. Artwork geometry is taken from www/icons/icon.svg (512x512 design space).
Run from the project root:  python3 tools/generate_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
STORE = os.path.join(ROOT, 'store')
SS = 4  # supersampling factor

GREEN_1, GREEN_2 = (46, 139, 87), (20, 81, 58)
ORANGE, YELLOW, WHITE = (255, 107, 44), (255, 209, 102), (255, 255, 255)
MOUNTAIN = [(64, 392), (214, 146), (296, 282), (348, 202), (448, 392)]
DOTS = [(150, 414), (189, 399), (224, 384), (259, 387), (294, 399), (329, 403), (364, 391)]
SUN = (400, 120, 30)


def gradient(size_w, size_h):
    im = Image.new('RGB', (size_w, size_h))
    px = im.load()
    for y in range(size_h):
        for x in range(size_w):
            t = (x / max(1, size_w - 1) + y / max(1, size_h - 1)) / 2
            px[x, y] = tuple(int(GREEN_1[i] + (GREEN_2[i] - GREEN_1[i]) * t) for i in range(3))
    return im


def draw_art(im, scale, cx, cy, with_dots=True, with_sun=True, color=WHITE):
    """Draw mountains/dots/sun onto im. (256,256) of the design space maps to (cx,cy)."""
    d = ImageDraw.Draw(im)
    def P(x, y):
        return (cx + (x - 256) * scale, cy + (y - 256) * scale)
    d.polygon([P(*p) for p in MOUNTAIN], fill=color)
    if with_dots:
        r = 11 * scale
        for (x, y) in DOTS:
            px, py = P(x, y)
            d.ellipse([px - r, py - r, px + r, py + r], fill=ORANGE)
    if with_sun:
        x, y, rr = SUN
        px, py = P(x, y)
        r = rr * scale
        d.ellipse([px - r, py - r, px + r, py + r], fill=YELLOW)


def launcher_square(size, rounded=True, circle=False):
    big = size * SS
    base = gradient(big, big).convert('RGBA')
    draw_art(base, big / 512 * 0.92, big / 2, big / 2 + big * 0.01)
    mask = Image.new('L', (big, big), 0)
    md = ImageDraw.Draw(mask)
    if circle:
        md.ellipse([0, 0, big - 1, big - 1], fill=255)
    elif rounded:
        md.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=255)
    else:
        md.rectangle([0, 0, big, big], fill=255)
    base.putalpha(mask)
    return base.resize((size, size), Image.LANCZOS)


def write_legacy_icons():
    for name, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        d = os.path.join(RES, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        launcher_square(px).save(os.path.join(d, 'ic_launcher.png'))
        launcher_square(px, circle=True).save(os.path.join(d, 'ic_launcher_round.png'))
        stale = os.path.join(d, 'ic_launcher_foreground.png')
        if os.path.exists(stale):
            os.remove(stale)


def store_icon():
    # Full-bleed square, 32-bit PNG, as Play requires (Google applies the mask).
    big = 512 * SS
    base = gradient(big, big).convert('RGBA')
    draw_art(base, big / 512 * 0.92, big / 2, big / 2 + big * 0.01)
    base.resize((512, 512), Image.LANCZOS).save(os.path.join(STORE, 'icon-512.png'))


def font(size, bold=True):
    name = 'LiberationSans-Bold.ttf' if bold else 'LiberationSans-Regular.ttf'
    return ImageFont.truetype('/usr/share/fonts/truetype/liberation/' + name, size)


def feature_graphic():
    w, h = 1024, 500
    big = Image.new('RGBA', (w * 2, h * 2))
    big.paste(gradient(w * 2, h * 2).convert('RGBA'))
    # faint contour-like ridges
    import math
    overlay = Image.new('RGBA', big.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for k in range(7):
        pts = []
        for x in range(0, w * 2 + 20, 20):
            y = h * 2 * (0.62 + k * 0.07) + math.sin(x / 140 + k) * 26 + math.sin(x / 61 + k * 2) * 8
            pts.append((x, y))
        d.line(pts, fill=(255, 255, 255, 28), width=3)
    big = Image.alpha_composite(big, overlay)
    # artwork on the left
    draw_art(big, 2 * 0.85, 2 * 215, 2 * 260)
    big = big.resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(big)
    d.text((440, 150), 'TrailLog', font=font(112), fill=WHITE)
    d.text((444, 290), 'Record your hikes, runs and rides.', font=font(32, False), fill=(226, 240, 232))
    d.text((444, 335), 'Private. Works offline. No account.', font=font(32, False), fill=(226, 240, 232))
    big.convert('RGB').save(os.path.join(STORE, 'feature-graphic-1024x500.png'))


def notification_png_preview():
    pass


if __name__ == '__main__':
    os.makedirs(STORE, exist_ok=True)
    write_legacy_icons()
    store_icon()
    feature_graphic()
    print('ok')
