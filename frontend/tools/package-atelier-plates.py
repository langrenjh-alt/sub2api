"""Package original optical stills for the Z30 exhibition. No network/runtime dependency."""
import argparse
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1] / 'public/assets/home'
ap = argparse.ArgumentParser()
ap.add_argument('--landscape', type=Path)
ap.add_argument('--portrait', type=Path)
ap.add_argument('--folio', type=Path)
args = ap.parse_args()

for kind, src in [('landscape', args.landscape), ('portrait', args.portrait)]:
    if not src:
        continue
    im = Image.open(src).convert('RGB')
    im.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
    im.save(root / f'atelier-{kind}.webp', quality=88, method=6)
    # A lightweight texture of the bevels illuminated by the real studio lights.
    # Animated lighting stays localized to cuts; it isn't a wash over the photo.
    im.thumbnail((820, 820), Image.Resampling.LANCZOS)
    r, g, b = im.split()
    energy = Image.blend(im.convert('L'), ImageChops.lighter(r, ImageChops.lighter(g, b)), .35)
    mask = Image.new('RGBA', im.size, 'white')
    mask.putalpha(energy.point(lambda x: round(255 * max(0., (x - 42) / 213) ** 1.4)))
    mask.save(root / f'atelier-light-{kind}.webp', quality=70, alpha_quality=82, method=6)
if args.folio:
    atlas = Image.open(args.folio).convert('RGB')
    w, h = atlas.size
    for i, key in enumerate(('corona', 'strata', 'interference', 'suspension')):
        x, y = (i % 2) * (w // 2), (i // 2) * (h // 2)
        atlas.crop((x+1, y+1, x+w//2-1, y+h//2-1)).save(root/f'atelier-{key}.webp', quality=89, method=6)
