"""Reproduce private reference crops from the pinned source aerial files.

Usage: python calibrate.py REFERENCE_IMAGE_DIRECTORY NEW_PRIVATE_OUTPUT
Only measurements, calibration and hashes belong in the repository.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
from PIL import Image, ImageDraw

base = Path(__file__).resolve().parent
refs, output = map(Path, sys.argv[1:])
if output.exists():
    raise SystemExit('Output must be new')
repo = base.parents[3]
if output.resolve().is_relative_to(repo):
    raise SystemExit('Reference imagery output must stay outside the checkout')
output.mkdir(parents=True)
native = json.loads(gzip.decompress((base / 'fixtures/native-subset.json.gz').read_bytes()))
measure = json.loads((base / 'reference-measurements.json').read_text())
proj = native['projection']
for profile in measure['profiles']:
    c = profile['calibration']
    name = profile['id'] + '19.jpg'
    source = refs / name
    expected = next(r['sha256'] for r in measure['referenceInputs']
                    if r.get('privatePath', '').endswith('/' + name))
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise SystemExit('Reference image hash mismatch: ' + name)
    meta, step = c['sourceImageMeta'], c['metresPerOutputPixel']

    def pixel(x, z):
        lat = proj['lat0'] - z / proj['mPerLat']
        lon = proj['lon0'] + x / proj['mPerLon']
        n = 2 ** meta['z'] * 256
        return ((lon + 180) / 360 * n - meta['px0'],
                (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - meta['py0'])

    x, z = c['centerXZ']
    a = pixel(x, z)
    n, u = c['normal'], c['along']
    b, d = pixel(x + n[0] * step, z + n[1] * step), pixel(x + u[0] * step, z + u[1] * step)
    ax, ay, bx, by = b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1]
    image = Image.open(source).transform((240, 400), Image.Transform.AFFINE,
        (ax, bx, a[0] - 120 * ax - 200 * bx, ay, by, a[1] - 120 * ay - 200 * by),
        resample=Image.Resampling.BICUBIC)
    image.resize((480, 800)).save(output / (profile['id'] + '-raw.png'))
    draw = ImageDraw.Draw(image)
    for lateral in range(-10, 11):
        at = 120 + 10 * lateral
        draw.line((at, 0, at, 399), fill=(100, 100, 100), width=1)
        draw.text((at + 1, 3), str(lateral), fill=(255, 0, 0))
    draw.line((120, 0, 120, 399), fill=(0, 255, 0))
    draw.line((0, 200, 239, 200), fill=(0, 255, 0))
    for lateral in [-3.5, 3.5]:
        at = 120 + 10 * lateral
        draw.line((at, 0, at, 399), fill=(255, 255, 0))
    image.resize((480, 800)).save(output / (profile['id'] + '-grid.png'))
print('Pinned reference crops reproduced in', output)
