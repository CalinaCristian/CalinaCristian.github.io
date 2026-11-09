#!/usr/bin/env python3
"""Install a validated, reviewed game atlas and retain the entire previous collection."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--atlas', required=True)
p.add_argument('--district', required=True, choices=('floreasca', 'romana', 'grozavesti'))
p.add_argument('--root', required=True)
p.add_argument('--review', required=True)
a = p.parse_args()
atlas, root = Path(a.atlas).resolve(), Path(a.root).resolve()
target = root / 'game/overview/comparison-data' / a.district
read = lambda f: json.loads(f.read_text())
manifest, validation, review = read(atlas / 'manifest.json'), read(atlas / 'validation.json'), read(Path(a.review))
assert not validation['failures'], validation['failures']
assert validation['frames'] == len(manifest['items']) == review['framesReviewed']
assert manifest['gameSourceCommit'] == review['gameSourceCommit']
assert read(atlas / 'boundary-source.json')['district'] == a.district
assert manifest['orientation'] == 'north-up'
assert all(item.get('square') is True and item.get('heading') == 0 and item.get('pitch') == -90
           and item.get('size', 0) > 0 and len(item.get('boundsXZ', [])) == 4
           for item in manifest['items']), 'Perspective evidence must stay separate from the matched north-up atlas'
old = read(target / 'manifest.json') if (target / 'manifest.json').exists() else {}
historical = target / 'historical'
historical.mkdir(parents=True, exist_ok=True)
if old:
    source = old.get('gameSourceCommit') or old.get('publishedBaseline') or 'mixed-historical'
    digest = hashlib.sha256((target / 'manifest.json').read_bytes()).hexdigest()[:8]
    archive = historical / (source + '-' + digest)
    assert not archive.exists(), 'Archive already exists; inspect before replacing it'
    archive.mkdir()
    for f in list(target.iterdir()):
        if f.name != 'historical':
            shutil.move(str(f), archive / f.name)
for name in ('images', 'thumbs'):
    shutil.copytree(atlas / name, target / name)
if (atlas / 'provenance').is_dir():
    shutil.copytree(atlas / 'provenance', target / 'provenance')
if (atlas / 'water-mask.json').is_file():
    shutil.copy2(atlas / 'water-mask.json', target / 'water-mask.json')
for name in ('boundary-source.json', 'capture-report.json', 'source-provenance.json', 'validation.json', 'poses.json', 'grid-plan.json'):
    shutil.copy2(atlas / name, target / name)
shutil.copy2(atlas / 'manifest.json', target / 'capture-manifest.json')
source_counts = manifest.get('atlasSourceCounts') or {manifest['gameSourceCommit']: len(manifest['items'])}
source_label = ', '.join(str(n) + ' frames on ' + str(commit)[:7] for commit, n in source_counts.items())
manifest.update({
    'locationId': a.district,
    'captureType': 'branch-source-snapshot',
    'sourceCaptureManifest': 'capture-manifest.json',
    'aerial': old.get('aerial', {
        'provider': 'Esri World Imagery',
        'endpoint': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export',
        'attribution': 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        'acquisitionDate': None,
        'delivery': 'Live image request; no reference imagery is stored in this repository.',
    }),
    'description': 'Complete atlas of the playable area and exact 600 m scenery ring, preserving the actual source revision of every frame, with separately labelled distant context.',
    'coverageNote': manifest['coverage'] + ' Boundary cells also contain land outside the ring.',
    'reviewNote': review['status'],
    'review': review,
    'collectionNotes': {'atlas': source_label + '. High quality, summer, clear daylight; moving traffic and mirrors disabled. Every frame retains its actual immutable source SHA. Historical captures preserve their original source and date in historical/.'},
    'atlasSourceCounts': source_counts,
})
manifest['historicalCollections'] = []
for f in sorted(historical.glob('*/manifest.json')):
    j = read(f)
    manifest['historicalCollections'].append({
        'manifest': str(f.relative_to(target)), 'frames': len(j['items']),
        'generatedAt': j.get('generatedAt', j.get('generatedDate')),
        'gameSourceCommit': j.get('gameSourceCommit'), 'publishedBaseline': j.get('publishedBaseline'),
        'sourceCounts': j.get('atlasSourceCounts'), 'captureType': j.get('captureType'),
        'note': 'Entire original collection retained, including unchanged image bytes, per-frame source identities and capture provenance.',
    })
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'district': a.district, 'frames': len(manifest['items']), 'source': manifest['gameSourceCommit'], 'historicalCollections': manifest['historicalCollections']}, indent=2))
