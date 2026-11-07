"""Generate a caustic mask from the project's original field. Build-time only: Pillow."""
from pathlib import Path
from PIL import Image, ImageChops

base = Path(__file__).resolve().parents[1] / 'public/assets/home'
plate = Image.open(base / 'z30-signal-field.webp').convert('RGB')
red, green, blue = plate.split()
peak = ImageChops.lighter(red, ImageChops.lighter(green, blue))
energy = Image.blend(plate.convert('L'), peak, .70)
opacity = [round(255 * min(1, max(0, (x / 255 - .105) / .54)) ** 1.16) for x in range(256)]
mask = Image.new('RGBA', plate.size, 'white')
mask.putalpha(energy.point(opacity))
target = base / 'z30-caustic-mask.webp'
mask.save(target, quality=72, alpha_quality=85, method=6)
print(f'{target.name}: {target.stat().st_size} bytes')
