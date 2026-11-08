#!/usr/bin/env python3
"""Verify installed GAME image bytes, collection separation and retained archives."""
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'game/overview/comparison-data'
failures, collections = [], []

def validate(file, kind):
    manifest = json.loads(file.read_text())
    items, ids, sources, checked = manifest['items'], set(), Counter(), 0
    if kind == 'perspective':
        assert manifest['captureType'] == 'game-perspective-context'
        assert manifest['comparisonCompatible'] is False
    for item in items:
        if item['id'] in ids:
            failures.append(str(file) + ': duplicate ' + item['id'])
        ids.add(item['id'])
        if kind == 'current':
            assert item['square'] is True and item['heading'] == 0 and item['pitch'] == -90
            assert len(item['gameSourceCommit']) == 40
        if kind == 'perspective':
            assert item['comparisonCompatible'] is False
            assert item['staticCamera'] is True and item['controllerExercised'] is False
            assert all(k in item['pose'] for k in ('x', 'y', 'z', 'heading', 'pitch', 'fov', 'aspect'))
        sources[item.get('gameSourceCommit', manifest.get('gameSourceCommit'))] += 1
        for key, hashkey in [('image', 'sha256'), ('thumbnail', 'thumbnailSha256')]:
            name = item.get(key) or (item.get('thumb') if key == 'thumbnail' else None)
            if not name:
                continue
            path = (file.parent / name).resolve()
            assert file.parent.resolve() in path.parents, 'Image leaves its collection'
            if not path.is_file():
                failures.append(str(path) + ': missing asset')
            elif item.get(hashkey):
                checked += 1
                if hashlib.sha256(path.read_bytes()).hexdigest() != item[hashkey]:
                    failures.append(str(path) + ': SHA mismatch')
    if kind == 'current':
        assert dict(sources) == manifest['atlasSourceCounts']
        assert len(manifest['review']['entries']) == len(items) == manifest['review']['framesReviewed']
        review = {i['id']: i for i in manifest['review']['entries']}
        assert all(review[i['id']]['gameSha256'] == i['sha256'] and review[i['id']]['gameSourceCommit'] == i['gameSourceCommit'] for i in items)
        assert manifest['review']['realWorldParityAccepted'] is False
    collections.append({'manifest': str(file.relative_to(ROOT)), 'kind': kind, 'frames': len(items),
                        'verifiedImageHashes': checked, 'sourceCounts': dict(sources)})
    return manifest

for district, expected in [('floreasca', 90), ('romana', 116), ('grozavesti', 100)]:
    file = BASE / district / 'manifest.json'
    manifest = validate(file, 'current')
    assert len(manifest['items']) == expected
    for collection in manifest.get('historicalCollections', []):
        historical = validate(file.parent / collection['manifest'], 'historical')
        assert len(historical['items']) == collection['frames']
    for collection in manifest.get('perspectiveCollections', []):
        assert collection['captureType'] == 'game-perspective-context'
        assert collection['comparisonCompatible'] is False
        perspective = validate(file.parent / collection['manifest'], 'perspective')
        assert len(perspective['items']) == collection['frames']
print(json.dumps({'collections': collections, 'currentAtlasFrames': sum(c['frames'] for c in collections if c['kind'] == 'current'),
                  'failures': failures}, indent=2))
raise SystemExit(bool(failures))
