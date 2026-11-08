#!/usr/bin/env python3
"""Validate a complete GAME context attempt and prepare sheets for actual review."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageStat

p = argparse.ArgumentParser()
p.add_argument('--capture', type=Path, required=True)
a = p.parse_args()
root = a.capture
manifest = json.loads((root / 'manifest.json').read_text())
assert not (root / 'coverage-failure.json').exists(), 'Preserve failed attempt; do not promote it'
assert not manifest['pageErrors'] and not manifest['consoleErrors']
assert not manifest.get('validationFailures'), 'Requested capture constraint failed; preserve raw attempt'
assert manifest['captureType'] == 'game-perspective-context' and manifest['comparisonCompatible'] is False
items = manifest['items']
assert len({i['id'] for i in items}) == len(items) == len({i['image'] for i in items})
metrics = []
for item in items:
    assert item['gameSourceCommit'] == manifest['gameSourceCommit']
    assert item['staticCamera'] is True and item['controllerExercised'] is False
    assert item['comparisonCompatible'] is False
    assert all(math.isfinite(item['pose'][k]) for k in ('x', 'y', 'z', 'heading', 'pitch', 'fov', 'aspect'))
    assert hashlib.sha256((root / item['image']).read_bytes()).hexdigest() == item['sha256']
    with Image.open(root / item['image']) as image:
        assert image.size == (item['width'], item['height']) == (960, 640)
        stddev = ImageStat.Stat(image.convert('RGB')).stddev
        assert max(stddev) > .05, 'Uniform frame requires actual investigation'
    observed = item.get('observedConditions')
    if manifest['time'] == 'night' or manifest['season'] == 'winter':
        assert observed, 'Night/winter needs actual renderer condition readback'
    if observed:
        assert observed['rendererClockOverride'] == manifest['time']
        assert observed['seasonOverride'] == manifest['season']
        assert observed['weatherOverride'] == manifest['weather']
    metrics.append({'id': item['id'], 'sha256': item['sha256'], 'rgbStddev': stddev,
                    'conditionsReadBack': bool(observed), 'cameraBodyValidated': item.get('cameraBodyValidation', {}).get('clear', False)})
sheets = root / 'review-sheets'
sheets.mkdir(exist_ok=True)
for start in range(0, len(items), 6):
    batch = items[start:start + 6]
    sheet = Image.new('RGB', (1280, math.ceil(len(batch) / 2) * 452), '#15191d')
    draw = ImageDraw.Draw(sheet)
    for n, item in enumerate(batch):
        with Image.open(root / item['image']) as image:
            image.thumbnail((640, 426), Image.Resampling.LANCZOS)
            x, y = n % 2 * 640, n // 2 * 452
            sheet.paste(image, (x, y + 26))
            draw.text((x + 5, y + 4), item['id'] + ' ' + item['gameSourceCommit'][:7], fill='white')
    sheet.save(sheets / f'context-{start // 6 + 1:02}.jpg', quality=90)
contacts = json.loads((root / 'source-contact-probe.json').read_text())
result = {'gameSourceCommit': manifest['gameSourceCommit'], 'district': manifest['district'],
          'condition': {k: manifest[k] for k in ('season', 'weather', 'time')},
          'frames': len(items), 'sheets': math.ceil(len(items) / 6), 'failures': [], 'metrics': metrics,
          'rawSourceContactHits': len(contacts['hits']),
          'note': 'Capture integrity checks only. Sheets require actual human/model visual review; raw contacts and source/visual gaps are not dismissed by this result. No controller, complete scene-clearance or driving/mirror budget pass claimed.'}
(root / 'capture-validation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'metrics'}))
