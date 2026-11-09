#!/usr/bin/env python3
"""Retain an entire reviewed original capture before a scoped mixed-source retake."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--atlas', type=Path, required=True)
p.add_argument('--review', type=Path, required=True)
p.add_argument('--root', type=Path, required=True)
p.add_argument('--district', required=True)
a = p.parse_args()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest, validation, review = read(a.atlas / 'manifest.json'), read(a.atlas / 'validation.json'), read(a.review)
assert not validation['failures']
assert validation['frames'] == len(manifest['items']) == review['reviewedFrames']
assert review['district'] == a.district
entries = {i['id']: i for i in review['entries']}
for item in manifest['items']:
    assert item['gameSourceCommit'] == manifest['gameSourceCommit']
    assert sha(a.atlas / item['image']) == item['sha256'] == entries[item['id']]['gameSha256']
    assert sha(a.atlas / item['thumbnail']) == item['thumbnailSha256']
base = a.root / 'game/overview/comparison-data' / a.district
target = base / 'historical' / (manifest['gameSourceCommit'] + '-' + sha(a.atlas / 'manifest.json')[:8])
assert not target.exists(), 'Preserve existing archive; inspect before replacing it'
target.mkdir(parents=True)
for name in ('images', 'thumbs'):
    shutil.copytree(a.atlas / name, target / name)
for name in ('boundary-source.json', 'capture-report.json', 'source-provenance.json', 'validation.json', 'poses.json', 'grid-plan.json'):
    shutil.copy2(a.atlas / name, target / name)
shutil.copy2(a.atlas / 'manifest.json', target / 'capture-manifest.json')
manifest.update({'locationId': a.district, 'captureType': 'branch-source-snapshot',
                 'sourceCaptureManifest': 'capture-manifest.json',
                 'description': 'Entire original atlas before the scoped water retakes. Original source revision, capture dates and image bytes are retained.',
                 'review': {'framesReviewed': review['reviewedFrames'], 'entries': review['entries'],
                            'captureCoverageAccepted': True, 'realWorldParityAccepted': False, 'status': review['scope']}})
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
current = read(base / 'manifest.json')
current.setdefault('historicalCollections', []).append({'manifest': str((target / 'manifest.json').relative_to(base)),
    'label': 'Original full atlas · ' + manifest['gameSourceCommit'][:7], 'frames': len(manifest['items']),
    'generatedAt': manifest.get('generatedAt', manifest.get('generatedDate')),
    'gameSourceCommit': manifest['gameSourceCommit'], 'captureType': manifest['captureType'],
    'note': 'Entire original capture retained, including the frames superseded by current water retakes.'})
current['description'] = 'Complete atlas of the playable area and exact 600 m scenery ring, preserving the actual source revision of every frame, with separately labelled distant context.'
(base / 'manifest.json').write_text(json.dumps(current, indent=2) + '\n')
print(json.dumps({'district': a.district, 'historicalFrames': len(manifest['items']), 'source': manifest['gameSourceCommit']}))
