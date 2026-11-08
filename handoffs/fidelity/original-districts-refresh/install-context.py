#!/usr/bin/env python3
"""Install explicitly reviewed GAME-only perspective evidence as a separate collection."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--capture', required=True)
p.add_argument('--review', required=True)
p.add_argument('--root', required=True)
p.add_argument('--district', required=True, choices=('floreasca', 'romana', 'grozavesti'))
p.add_argument('--condition', required=True)
a = p.parse_args()
source, root = Path(a.capture).resolve(), Path(a.root).resolve()
manifest, review = json.loads((source / 'manifest.json').read_text()), json.loads(Path(a.review).read_text())
assert a.condition.replace('-', '').isalnum(), 'Condition is a relative safe path component'
assert manifest['district'] == a.district
assert manifest['captureType'] == 'game-perspective-context' and manifest['comparisonCompatible'] is False
assert manifest['gameSourceCommit'] == review['gameSourceCommit']
assert len(manifest['items']) == review['imagesReviewed']
assert not manifest['pageErrors'] and not manifest['consoleErrors']
base = root / 'game/overview/comparison-data' / a.district
target = base / 'context' / a.condition
assert not target.exists(), 'Preserve an existing current context collection before replacement'
(target / 'images').mkdir(parents=True)
(target / 'thumbs').mkdir()
for item in manifest['items']:
    assert item['comparisonCompatible'] is False and item['staticCamera'] is True and item['controllerExercised'] is False
    assert item['gameSourceCommit'] == manifest['gameSourceCommit']
    assert all(k in item['pose'] for k in ('x', 'y', 'z', 'heading', 'pitch', 'fov', 'aspect'))
    f = source / item['image']
    assert hashlib.sha256(f.read_bytes()).hexdigest() == item['sha256']
    destination = target / item['image']
    assert destination.parent == target / 'images'
    shutil.copy2(f, destination)
    thumbnail = 'thumbs/' + Path(item['image']).name
    image = Image.open(f).convert('RGB')
    image.thumbnail((320, 214), Image.Resampling.LANCZOS)
    image.save(target / thumbnail, quality=86)
    item['thumbnail'] = thumbnail
    item['thumb'] = thumbnail
manifest['review'] = review
for name in ('runtime-integrity.json', 'world-stats.json', 'source-contact-probe.json'):
    shutil.copy2(source / name, target / name)
manifest['runtimeIntegrity'] = 'runtime-integrity.json'
manifest['sourceContactProbe'] = 'source-contact-probe.json'
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
atlas = json.loads((base / 'manifest.json').read_text())
entry = {'manifest': 'context/' + a.condition + '/manifest.json', 'label': a.condition.replace('-', ' ').title() + ' · district context', 'captureType': 'game-perspective-context', 'comparisonCompatible': False, 'frames': len(manifest['items']), 'gameSourceCommit': manifest['gameSourceCommit']}
atlas.setdefault('perspectiveCollections', []).append(entry)
(base / 'manifest.json').write_text(json.dumps(atlas, indent=2) + '\n')
print(json.dumps(entry, indent=2))
