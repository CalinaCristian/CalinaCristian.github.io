#!/usr/bin/env python3
"""Validate game-only atlas delivery; make thumbnails/contact sheets without reference imagery."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageStat

p = argparse.ArgumentParser()
p.add_argument('--out', required=True)
args = p.parse_args()
root = Path(args.out)
manifest = json.loads((root / 'manifest.json').read_text())
boundary = json.loads((root / 'boundary-source.json').read_text())
source = json.loads((root / 'source-provenance.json').read_text())
sha256 = lambda f: hashlib.sha256(Path(f).read_bytes()).hexdigest()
failures, metrics = [], []
expected = set()
for item in manifest['items']:
    f = root / item['image']
    expected.add(f.name)
    try:
        with Image.open(f) as im:
            im.load()
            rgb = im.convert('RGB')
            stddev = ImageStat.Stat(rgb).stddev
            if rgb.size != (item['width'], item['height']) or rgb.width != rgb.height:
                failures.append(f'{item["id"]}: incorrect dimensions {rgb.size}')
            if max(stddev) < 2:
                failures.append(f'{item["id"]}: near-blank frame')
            thumb = rgb.copy()
            thumb.thumbnail((192, 192), Image.Resampling.LANCZOS)
            tf = root / item['thumbnail']
            tf.parent.mkdir(parents=True, exist_ok=True)
            thumb.save(tf, quality=82, optimize=True)
        if sha256(f) != item['sha256']:
            failures.append(f'{item["id"]}: image SHA256 mismatch')
        if item['gameSourceCommit'] != manifest['publishedBaseline']:
            failures.append(f'{item["id"]}: source commit mismatch')
        expected_height = item['size'] / 2 / math.tan(math.pi / 6)
        if not (item['heading'] == 0 and item['pitch'] == -90 and item['fov'] == 60 and abs(item['h'] - expected_height) < 1e-7):
            failures.append(f'{item["id"]}: incorrect pose')
        item['thumbnailSha256'] = sha256(root / item['thumbnail'])
        item['captureType'] = 'game-topdown'
        proj, b = boundary['projection'], item['boundsXZ']
        item['boundsWgs84'] = [proj['lat0'] - b[3] / proj['mPerLat'], proj['lon0'] + b[0] / proj['mPerLon'], proj['lat0'] - b[1] / proj['mPerLat'], proj['lon0'] + b[2] / proj['mPerLon']]
        metrics.append({'id': item['id'], 'rgbStddev': stddev, 'sha256': item['sha256']})
    except Exception as exc:
        failures.append(f'{item["id"]}: {exc}')

for file in source['files']:
    if sha256(Path(source['sourceRoot']) / file['path']) != file['sha256']:
        failures.append(f'Served source changed: {file["path"]}')

if manifest['capture']['pageErrors'] or manifest['capture']['consoleErrors'] or manifest['capture']['failedRequests']:
    failures.append('Capture contained page, console, or request failures')

extra = sorted(f.name for f in (root / 'images').glob('*.jpg') if f.name not in expected)
if extra:
    unused = root / 'first-attempt-unused'
    unused.mkdir(exist_ok=True)
    for name in extra:
        (root / 'images' / name).rename(unused / name)

sheets = root / 'contact-sheets'
sheets.mkdir(exist_ok=True)
for start in range(0, len(manifest['items']), 12):
    items = manifest['items'][start:start + 12]
    sheet = Image.new('RGB', (1280, 4 * 350), '#15191d')
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(items):
        im = Image.open(root / item['image']).convert('RGB')
        im.thumbnail((320, 320), Image.Resampling.LANCZOS)
        x, y = (i % 4) * 320, (i // 4) * 350
        sheet.paste(im, (x, y + 30))
        draw.text((x + 5, y + 3), item['id'], fill='white')
        draw.text((x + 5, y + 16), item['scope'], fill='#a8c5d6')
    sheet.crop((0, 0, 1280, math.ceil(len(items) / 4) * 350)).save(sheets / f'all-{start // 12 + 1:02d}.jpg', quality=88)

manifest['title'] = boundary['district'].capitalize() + ' aerial comparisons'
manifest['capture']['validation'] = {'framesVerified': len(metrics), 'sourceFilesVerified': len(source['files']), 'pageErrors': len(manifest['capture']['pageErrors']), 'consoleErrors': len(manifest['capture']['consoleErrors']), 'failedRequests': len(manifest['capture']['failedRequests']), 'failures': failures}
manifest['capture']['perfMaxima'] = {'triangles': max(v['perf']['triangles'] for v in manifest['items']), 'drawCalls': max(v['perf']['drawCalls'] for v in manifest['items']), 'note': 'World-only high-quality top-down captures, moving traffic hidden, mirror excluded. Separate maxima need not occur in one frame; not a driving frame-budget acceptance test.'}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
report = {'frames': len(metrics), 'sourceFilesVerified': len(source['files']), 'scopeCounts': manifest['atlasScopeCounts'], 'failures': failures, 'imageMetrics': metrics, 'movedUnusedFirstAttemptFrames': extra, 'manifestSha256': sha256(root / 'manifest.json')}
(root / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
(root / 'manifest.sha256').write_text(report['manifestSha256'] + '  manifest.json\n')
print(json.dumps({k: v for k, v in report.items() if k != 'imageMetrics'}, indent=2))
raise SystemExit(bool(failures))
