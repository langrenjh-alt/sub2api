"""Bake Z30's deterministic particle plate. Development only: Python + Pillow + NumPy.
Run from any directory: python frontend/tools/render-signal-field.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
rng = np.random.default_rng(3030)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
x, y = xx / W, yy / H


def halo(cx, cy, sx, sy):
    return np.exp(-((x - cx) / sx) ** 2 - ((y - cy) / sy) ** 2)


def cloud_noise():
    noise = np.zeros((H, W), dtype=np.float32)
    for size, weight in [(7, 0.42), (17, 0.28), (41, 0.18), (83, 0.08), (211, 0.04)]:
        a = rng.integers(0, 255, (size, round(size * W / H)), dtype=np.uint8)
        layer = np.asarray(Image.fromarray(a).resize((W, H), Image.Resampling.BICUBIC))
        noise += (layer / 255 - 0.5) * weight
    return noise


noise = cloud_noise()
mist = np.clip((1 + noise * 2.2), 0.15, 2.0)
rgb = np.tile(np.array([7, 10, 17], dtype=np.float32), (H, W, 1))
for glow, colour in [
    (halo(0.04, 0.37, 0.33, 0.51), [6, 20, 22]),
    (halo(0.73, 0.52, 0.33, 0.41), [15, 13, 25]),
    (halo(0.54, 0.67, 0.22, 0.20), [10, 20, 17]),
    (halo(0.97, 0.67, 0.31, 0.42), [15, 20, 46]),
    (halo(0.22, 0.84, 0.31, 0.20), [11, 34, 32]),
]:
    rgb += (glow * mist)[:, :, None] * np.array(colour)
rgb += rng.normal(0, 1.45, (H, W, 1))
scene = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))


def trajectory(u, stream):
    if stream == 0:
        return .795 + .10 * np.sin(u * 6.0 + 1.1) - .14 * np.exp(-((u - .83) / .16) ** 2)
    if stream == 1:
        return .815 - .19 * np.exp(-((u - .16) / .14) ** 2) + .074 * np.sin(u * 11.1)
    return .96 - .25 * np.exp(-((u - .24) / .19) ** 2) - .09 * np.cos(u * 7.5)


def particles(n, stream):
    u = rng.uniform(-.1, 1.1, n)
    theta = rng.normal(0, 1, n)
    # Filaments twist around a common current instead of filling a flat gradient.
    strand = rng.integers(0, 28, n) / 28
    width = .032 + .045 * np.cos(u * 5.0 + stream) ** 2
    z = rng.normal(0, 1, n)
    py = trajectory(u, stream) + width * np.sin(strand * 6.28 + u * 9) + theta * .017
    py += .012 * np.cos(strand * 6.28 + u * 19) + z * .011
    return u, py, z


layer = Image.new("RGB", scene.size)
dust = ImageDraw.Draw(layer)
palettes = np.array([[116, 222, 183], [120, 202, 202], [117, 160, 234], [172, 154, 225], [199, 226, 155]])
for stream, count in [(2, 6000), (1, 15000), (0, 25000)]:
    u, v, z = particles(count, stream)
    energy = rng.lognormal(-.96, .64, count) * (.78 + .2 * z)
    tint = palettes[np.mod((u * 2.8 + (z + rng.normal(0, .22, count)) * .49 + stream).astype(int), 5)]
    colours = np.uint8(np.clip(tint * np.maximum(0, energy[:, None]), 0, 255))
    radii = np.maximum(.26, rng.lognormal(-.5, .57, count) * (.83 + .28 * np.maximum(0, z)))
    for px, py, r, col in zip(u * W, v * H, radii, colours):
        dust.ellipse((px-r, py-r, px+r, py+r), fill=tuple(col))

# Sparse, out-of-focus bodies describe the near plane; each is a sphere,
# illuminated consistently by a narrow cyan grazing light.
for _ in range(880):
    u = rng.uniform(-.02, 1.02)
    v = rng.uniform(-.02, 1.04)
    if .16 < u < .84 and v < .58 and rng.random() < .96:
        continue
    r = max(.45, rng.lognormal(.28, .9))
    col = palettes[rng.integers(0, len(palettes))].astype(float)
    i, j = u*W, v*H
    light = rng.uniform(.1, .74)
    dust.ellipse((i-r,j-r,i+r,j+r), fill=tuple(np.uint8(col * light * .25)))
    dust.ellipse((i-r*.89,j-r*.94,i+r*.35,j+r*.48), fill=tuple(np.uint8(col * light * .44)))
    dust.ellipse((i-r*.75,j-r*.85,i-r*.14,j-r*.26), fill=tuple(np.uint8(col * light)))

dust_pixels = np.asarray(layer).astype(np.float32)
bloom = np.asarray(layer.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
rgb = np.asarray(scene, dtype=np.float32) + dust_pixels * .94 + bloom * 1.65
art = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))
target = Path(__file__).resolve().parents[1] / 'public/assets/home/z30-signal-field.webp'
art.save(target, quality=93, method=6)
print(f'{target.name}: {target.stat().st_size:,} bytes')
