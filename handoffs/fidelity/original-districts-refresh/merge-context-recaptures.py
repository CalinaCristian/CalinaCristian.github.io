#!/usr/bin/env python3
"""Replace reviewed exact-pose GAME views while retaining every original source identity."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil

p = argparse.ArgumentParser()
for key in ('baseline', 'recapture', 'baseline-review', 'recapture-review', 'baseline-provenance', 'recapture-provenance', 'out'):
    p.add_argument('--' + key, type=Path, required=True)
p.add_argument('--replace-ids', help='Comma-separated exact IDs; extra reviewed angles stay in the raw provenance archive')
a = p.parse_args()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
old, new = read(a.baseline / 'manifest.json'), read(a.recapture / 'manifest.json')
baseline_source_commit = old['gameSourceCommit']
old_review, new_review = read(a.baseline_review), read(a.recapture_review)
assert new_review['pitchVisibilityAccepted'] is True, 'Actual new paint visibility must be reviewed before replacement'
assert not a.out.exists(), 'Preserve existing merged evidence'
for k in ('district', 'season', 'weather', 'time', 'quality', 'traffic', 'mirror', 'captureType', 'comparisonCompatible'):
    assert old[k] == new[k], 'Capture condition changed: ' + k
assert old['gameSourceCommit'] != new['gameSourceCommit']
before, replacements = {i['id']: i for i in old['items']}, {i['id']: i for i in new['items']}
assert len(before) == len(old['items']) and len(replacements) == len(new['items'])
if a.replace_ids:
    selected = set(a.replace_ids.split(','))
    assert selected <= set(replacements), 'Replacement ID was not captured'
    replacements = {id: item for id, item in replacements.items() if id in selected}
assert replacements and set(replacements) <= set(before)
for id, item in replacements.items():
    original = before[id]
    for k in ('x', 'y', 'z', 'heading', 'pitch', 'fov', 'aspect'):
        assert abs(item['pose'][k] - original['pose'][k]) < 1e-9, 'Exact pose changed: ' + id + '/' + k
    assert item['pose']['near'] == .2
    # Snow's production FogExp2 culling is native. Recompute it from the actual
    # captured weather visibility; never force the clear-weather far plane.
    observed = item['observedConditions']
    expected_far = 5000
    if new['weather'] == 'snow':
        assert observed['weatherOverride'] == 'snow' and observed['weather']['kind'] == 'snow'
        expected_far = min(5000, max(220, 5.3 / (3.912 / max(150, observed['weather']['visibilityM']))))
    assert abs(item['pose']['far'] - expected_far) < 1e-6, 'Far plane differs from native weather policy'
    assert item['width'] == original['width'] and item['height'] == original['height']
provenance = [read(a.baseline_provenance), read(a.recapture_provenance)]
data_path = 'game/data/bucharest-' + old['district'] + '.json'
assert len({next(f['sha256'] for f in record['files'] if f['path'] == data_path) for record in provenance}) == 1, 'Source district data changed'
a.out.mkdir(parents=True)
(a.out / 'images').mkdir()
snapshots = []
for folder, manifest, review, record, source_file in [(a.baseline, old, old_review, provenance[0], a.baseline_provenance), (a.recapture, new, new_review, provenance[1], a.recapture_provenance)]:
    assert not (folder / 'coverage-failure.json').exists()
    assert not manifest['pageErrors'] and not manifest['consoleErrors']
    assert not manifest.get('validationFailures'), 'Requested capture constraint failed'
    assert manifest['gameSourceCommit'] == record['gameSourceCommit'] == review['gameSourceCommit']
    reviewed = {i['id']: i for i in review['entries']}
    assert len(reviewed) == len(manifest['items']) == review['imagesReviewed']
    for item in manifest['items']:
        assert sha(folder / item['image']) == item['sha256'] == reviewed[item['id']]['sha256']
        assert item['gameSourceCommit'] == manifest['gameSourceCommit']
    for f in record['files']:
        assert sha(Path(record['sourceRoot']) / f['path']) == f['sha256'], 'Served source changed'
    archive = a.out / 'provenance' / manifest['gameSourceCommit']
    archive.mkdir(parents=True)
    shutil.copytree(folder / 'images', archive / 'images')
    for name in ('manifest.json', 'runtime-integrity.json', 'world-stats.json', 'source-contact-probe.json', 'capture-validation.json'):
        shutil.copy2(folder / name, archive / name)
    shutil.copy2(source_file, archive / 'source-provenance.json')
    (archive / 'review.json').write_text(json.dumps(review, indent=2) + '\n')
    snapshots.append({'gameSourceCommit': manifest['gameSourceCommit'], 'manifest': str((archive / 'manifest.json').relative_to(a.out)),
                      'manifestSha256': sha(archive / 'manifest.json'), 'sourceProvenance': str((archive / 'source-provenance.json').relative_to(a.out)),
                      'sourceProvenanceSha256': sha(archive / 'source-provenance.json'), 'frames': len(manifest['items'])})
items, counts = [], Counter()
reviewed = {i['id']: i for i in old_review['entries']}
reviewed.update({i['id']: i for i in new_review['entries']})
for original in old['items']:
    item = replacements.get(original['id'], original)
    folder = a.recapture if original['id'] in replacements else a.baseline
    shutil.copy2(folder / item['image'], a.out / item['image'])
    counts[item['gameSourceCommit']] += 1
    items.append(item)
for name in ('runtime-integrity.json', 'world-stats.json', 'source-contact-probe.json'):
    shutil.copy2(a.baseline / name, a.out / name)
old.update({'gameSourceCommit': None, 'items': items, 'sourceCounts': dict(counts), 'sourceSnapshots': snapshots,
            'sourceCompatibility': {'method': 'Only actually reviewed exact-pose pitch views replaced; every other original image byte, source SHA, pose and capture time retained. This does not relabel retained frames or claim full-scene pixel equivalence.',
                                    'replacedIds': sorted(replacements), 'unchangedDistrictDataSha256': next(f['sha256'] for f in provenance[0]['files'] if f['path'] == data_path)},
            'captureTool': None})
review = dict(old_review, gameSourceCommit=None, sourceCounts=dict(counts), publicPromotionHeld=False,
              reportedMarkingIssueAccepted=True, pitchVisibilityAccepted=True,
              status='Complete reviewed perspective collection with fresh exact-pose filtered-coverage pitch visibility proof from ' + new['gameSourceCommit'] + '; every retained original frame keeps its actual source. Other source/appearance gaps remain.',
              entries=[reviewed[i['id']] for i in items])
for entry in review['entries']:
    if 'football' in entry['id'] and entry['id'] not in replacements:
        entry['sourceCaptureObservation'] = entry['observations']
        entry['observations'] = 'Retained ' + baseline_source_commit[:8] + ' walking-height frame before the paint correction. See the fresh ' + new['gameSourceCommit'][:8] + ' elevated pitch view for current marking visibility.'
        entry['status'] = 'retained_before_paint_correction'
        entry['displayLabel'] = 'Dinamo walking-height view · retained ' + baseline_source_commit[:8] + ' before paint correction'
write = lambda name, value: (a.out / name).write_text(json.dumps(value, indent=2) + '\n')
write('manifest.json', old)
write('review.json', review)
write('source-provenance.json', {'gameSourceCommit': None, 'sourceSnapshots': snapshots,
                               'delivery': 'Per-source immutable captures and complete source-file inventories retained under provenance/; no original image relabelled.'})
write('capture-validation.json', {'gameSourceCommit': None, 'frames': len(items), 'failures': [], 'sourceCounts': dict(counts),
                                'replacedIds': sorted(replacements), 'exactGroundPosesPreserved': True})
print(json.dumps({'frames': len(items), 'sourceCounts': dict(counts), 'replacedIds': sorted(replacements)}))
