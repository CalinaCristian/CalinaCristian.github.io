#!/usr/bin/env python3
"""Make PRIVATE game/reference pairs from existing georeferenced Esri mosaics.

No network requests. Reference images must stay outside the repository.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('--atlas', required=True)
p.add_argument('--mosaic', action='append', required=True, help='Existing JPEG with its same-stem mosaic JSON; first has priority')
p.add_argument('--out', required=True)
a = p.parse_args()
atlas, out = Path(a.atlas).resolve(), Path(a.out).resolve()
repo = Path(__file__).resolve().parents[3]
if out == repo or repo in out.parents:
    p.error('Reference comparison output must remain outside the public repository')
out.mkdir(parents=True, exist_ok=True)
(out / 'pairs').mkdir(exist_ok=True)
(out / 'sheets').mkdir(exist_ok=True)
manifest = json.loads((atlas / 'manifest.json').read_text())
sources = []
for name in a.mosaic:
    f = Path(name).resolve()
    metadata = json.loads(f.with_suffix('.json').read_text())
    im = Image.open(f).convert('RGB')
    sources.append({'path': str(f), 'sha256': hashlib.sha256(f.read_bytes()).hexdigest(), 'metadata': metadata, 'image': im, 'mask': Image.new('L', im.size, 255)})

def pixel(lat, lon, metadata):
    n = 256 * 2 ** metadata['z']
    return ((lon + 180) / 360 * n - metadata['px0'], (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - metadata['py0'])

rows = []
for item in manifest['items']:
    south, west, north, east = item['boundsWgs84']
    ref, coverage = Image.new('RGB', (640, 640), '#5a214b'), Image.new('L', (640, 640), 0)
    # Fill lower-priority sources first; native pixel bounds, not requested bbox, define coverage.
    for source in reversed(sources):
        m, im = source['metadata'], source['image']
        x0, y0 = pixel(north, west, m)
        x1, y1 = pixel(south, east, m)
        b = (x0, y0, x1, y1)
        mask = source['mask'].transform((640, 640), Image.Transform.EXTENT, b, resample=Image.Resampling.NEAREST, fillcolor=0)
        crop = im.transform((640, 640), Image.Transform.EXTENT, b, resample=Image.Resampling.BICUBIC, fillcolor=0)
        ref.paste(crop, (0, 0), mask)
        coverage.paste(255, (0, 0), mask)
    game = Image.open(atlas / item['image']).convert('RGB').resize((640, 640), Image.Resampling.LANCZOS)
    pair = Image.new('RGB', (1280, 672), '#15191d')
    pair.paste(game, (0, 32)); pair.paste(ref, (640, 32))
    covered = sum(coverage.histogram()[1:]) / (640 * 640)
    draw = ImageDraw.Draw(pair)
    draw.text((8, 4), item['id'] + ' | GAME ' + item['gameSourceCommit'][:7], fill='white')
    draw.text((648, 4), 'ESRI existing mosaics | acquisition date unknown | covered ' + f'{covered:.1%}', fill='white')
    pair.save(out / 'pairs' / (item['id'] + '.jpg'), quality=90)
    rows.append({'id': item['id'], 'gameSourceCommit': item['gameSourceCommit'], 'gameSha256': item['sha256'], 'boundsWgs84': item['boundsWgs84'], 'referenceCoverageFraction': covered, 'pair': 'pairs/' + item['id'] + '.jpg'})
for start in range(0, len(rows), 6):
    batch = rows[start:start + 6]
    sheet = Image.new('RGB', (1280, math.ceil(len(batch) / 2) * 336), '#15191d')
    for i, row in enumerate(batch):
        pair = Image.open(out / row['pair']).resize((640, 336), Image.Resampling.LANCZOS)
        sheet.paste(pair, ((i % 2) * 640, (i // 2) * 336))
    sheet.save(out / 'sheets' / f'comparison-{start // 6 + 1:02d}.jpg', quality=90)
report = {
    'gameSourceCommit': manifest['gameSourceCommit'], 'district': manifest['locationId'] if 'locationId' in manifest else json.loads((atlas / 'boundary-source.json').read_text())['district'],
    'method': 'Game capture ground bounds transformed to native existing Esri mosaic pixels. Purple is uncovered reference, never fabricated imagery. Elevated perspective roofs and off-nadir reference roofs need independent interpretation; this registration is not a fidelity score.',
    'imageryAcquisitionDate': None, 'referenceAttribution': 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    'sources': [{k: v for k, v in source.items() if k not in ('image', 'mask')} for source in sources], 'items': rows,
    'frameCount': len(rows), 'contactSheetCount': math.ceil(len(rows) / 6),
}
(out / 'comparison-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'frames': len(rows), 'sheets': report['contactSheetCount'], 'partlyUncovered': sum(r['referenceCoverageFraction'] < .999 for r in rows)}, indent=2))
