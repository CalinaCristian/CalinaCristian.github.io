#!/usr/bin/env python3
"""Apply reviewed exact-pose retakes to a mixed atlas and archive its full prior state.

Reference pixels never enter this tool. Only GAME captures and review hash ledgers
are copied. Historical and perspective collections remain distinct from items.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

p = argparse.ArgumentParser()
for key in ('root', 'retakes', 'review'):
    p.add_argument('--' + key, type=Path, required=True)
p.add_argument('--city', default='bucharest')
p.add_argument('--district', required=True)
a = p.parse_args()
assert re.fullmatch(r'[a-z0-9-]+', a.city) and re.fullmatch(r'[a-z0-9-]+', a.district)
read = lambda path: json.loads(path.read_text())
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
write = lambda path, value: path.write_text(json.dumps(value, indent=2) + '\n')
target = a.root / 'game/overview/comparison-data' / a.district
before_bytes = (target / 'manifest.json').read_bytes()
old, new, review = read(target / 'manifest.json'), read(a.retakes / 'manifest.json'), read(a.review)
mask, validation, source = (read(a.retakes / name) for name in ('recapture-mask.json', 'validation.json', 'source-provenance.json'))
assert hashlib.sha256(before_bytes).hexdigest() == mask['originalManifestSha256'], 'Baseline changed after planning'
assert digest(target / 'poses.json') == mask['originalPosesSha256']
assert mask['district'] == a.district and mask['sourceCommit'] == new['gameSourceCommit'] == review['sourceCommit']
assert review['visuallyInspected'] is True and review['realWorldParityAccepted'] is False
assert not validation['failures'] and validation['frames'] == len(new['items'])
assert not any(new['capture'][key] for key in ('pageErrors', 'consoleErrors', 'failedRequests'))
originals, replacements = ({i['id']: i for i in manifest['items']} for manifest in (old, new))
assert len(originals) == len(old['items']) == mask['totalFrames']
assert set(replacements) == {i['id'] for i in mask['tiles']}
assert review['reviewedIds'] == [i['id'] for i in new['items']]
reviews = {i['id']: i for i in review['items']}
assert len(reviews) == len(replacements)
assert source['gameSourceCommit'] == new['gameSourceCommit']
for file in source['files']:
    assert digest(Path(source['sourceRoot']) / file['path']) == file['sha256'], 'Immutable served source changed'
data_path = 'game/data/' + a.city + '-' + a.district + '.json'
data_sha = next(i['sha256'] for i in source['files'] if i['path'] == data_path)
assert (Path(source['sourceRoot']) / data_path).read_bytes() == subprocess.check_output(['git', 'show', new['gameSourceCommit'] + ':' + data_path], cwd=a.root)
assert digest(a.root / data_path) == data_sha, 'Source data changed from the original atlas'
pose_keys = ('id', 'x', 'z', 'h', 'size', 'fov', 'heading', 'pitch', 'square', 'boundsXZ', 'scope')
for id, original in originals.items():
    assert digest(target / original['image']) == original['sha256']
    assert digest(target / original['thumbnail']) == original['thumbnailSha256']
    if id not in replacements:
        continue
    item, check = replacements[id], reviews[id]
    assert all(item[key] == original[key] for key in pose_keys), 'Actual ground pose changed: ' + id
    assert item['gameSourceCommit'] == new['gameSourceCommit']
    assert item['square'] and item['heading'] == 0 and item['pitch'] == -90
    assert item['sha256'] == check['retakeGameSha256'] == digest(a.retakes / item['image'])
    assert original['sha256'] == check['originalGameSha256']
    assert item['thumbnailSha256'] == digest(a.retakes / item['thumbnail'])

# Preserve complete prior current metadata, all GAME pixels and its context/provenance
# directories. Existing historical collections remain at their original stable paths.
archive_rel = Path('historical') / ('mixed-before-' + new['gameSourceCommit'][:8] + '-' + hashlib.sha256(before_bytes).hexdigest()[:8])
archive = target / archive_rel
assert not archive.exists(), 'Prior archive already exists; preserve it'
archive.mkdir(parents=True)
for file in list(target.iterdir()):
    if file.name == 'historical':
        continue
    if file.is_dir():
        shutil.copytree(file, archive / file.name)
    else:
        shutil.copy2(file, archive / file.name)
assert (archive / 'manifest.json').read_bytes() == before_bytes
for original in originals.values():
    assert digest(archive / original['image']) == original['sha256']
    assert digest(archive / original['thumbnail']) == original['thumbnailSha256']

retake_rel = Path('retakes') / new['gameSourceCommit']
retake_dir = target / retake_rel
assert not retake_dir.exists()
shutil.copytree(a.retakes, retake_dir)
shutil.copy2(a.review, retake_dir / 'paired-review.json')
old_entries = {i['id']: i for i in old['review']['entries']}
for id, item in replacements.items():
    for key in ('image', 'thumbnail'):
        shutil.copy2(a.retakes / item[key], target / item[key])
    item.update({'sourceCaptureManifest': str(retake_rel / 'manifest.json'), 'sourceNote': 'Exact-pose scoped retake; full prior mixed atlas archived byte-identically.'})
    originals[id] = item
    old_entries[id] = dict(reviews[id], gameSourceCommit=item['gameSourceCommit'], gameSha256=item['sha256'])
items = [originals[item['id']] for item in old['items']]
counts = dict(Counter(i['gameSourceCommit'] for i in items))
snapshot = {'gameSourceCommit': new['gameSourceCommit'], 'treeSha256': source['treeSha256'], 'manifest': str(retake_rel / 'manifest.json'), 'manifestSha256': digest(retake_dir / 'manifest.json'), 'sourceProvenance': str(retake_rel / 'source-provenance.json'), 'sourceProvenanceSha256': digest(retake_dir / 'source-provenance.json'), 'frames': len(replacements)}
snapshots = old.get('sourceSnapshots', []) + [snapshot]
old.update({'gameSourceCommit': None, 'publishedBaseline': None, 'items': items, 'atlasSourceCounts': counts, 'sourceSnapshots': snapshots, 'generatedAt': new['generatedAt'], 'generatedDate': new['generatedDate']})
old['historicalCollections'].append({'manifest': str(archive_rel / 'manifest.json'), 'label': 'Full mixed atlas before ' + new['gameSourceCommit'][:8] + ' scoped water/paint retakes', 'frames': len(items), 'generatedAt': read(archive / 'manifest.json')['generatedAt'], 'gameSourceCommit': None, 'sourceCounts': read(archive / 'manifest.json')['atlasSourceCounts'], 'captureType': 'mixed-source-survey', 'note': 'Full previous current collection: original metadata, dates, image/thumbnail bytes and per-frame source identities preserved.'})
old['sourceCompatibility'] = {'method': 'Only reviewed impacted source-water/paint squares replaced at their exact existing poses. Every other item, image byte, date and source SHA is retained; no full-scene pixel-equivalence or fidelity claim.', 'retakeMask': str(retake_rel / 'recapture-mask.json'), 'retakeMaskSha256': digest(retake_dir / 'recapture-mask.json'), 'unchangedDistrictDataSha256': data_sha}
old['capture'].update({'frameCounts': len(items), 'source': None, 'sourceSnapshots': snapshots, 'endedAt': new['capture']['endedAt'], 'perfMaxima': {'triangles': max(i['perf']['triangles'] for i in items), 'drawCalls': max(i['perf']['drawCalls'] for i in items), 'note': 'Separate static north-up atlas maxima; traffic/mirrors disabled. No hardware FPS, controller or driving-budget claim.'}})
old['capture']['validation'] = {'framesVerified': len(items), 'failures': [], 'mixedSourceProvenancePreserved': True}
old['review'].update({'gameSourceCommit': None, 'sourceCounts': counts, 'framesReviewed': len(items), 'entries': [old_entries[i['id']] for i in items], 'status': 'Complete prior review retained with ' + str(len(replacements)) + ' fresh exact-pose water/paint pairs inspected; all geometry, source-height, facade, canopy, occupancy and unknown-date limits remain.', 'realWorldParityAccepted': False, 'targetedRetakeReview': str(retake_rel / 'paired-review.json')})
old['reviewNote'] = old['review']['status']
old['collectionNotes']['atlas'] = 'Complete mixed atlas; per-frame source SHA and capturedAt are authoritative. Only the recorded impacted subset is fresh. Full prior current collection is archived. Technical north-up capture removes fog and extends depth as recorded by the atlas tool; native perspective controls are separate.'
write(target / 'manifest.json', old)
write(target / 'capture-report.json', old['capture'])
write(target / 'source-provenance.json', {'gameSourceCommit': None, 'sourceSnapshots': snapshots, 'note': 'Original source inventories and fresh immutable retake inputs remain attached to their actual captures.'})
write(target / 'capture-manifest.json', old)
poses = read(target / 'poses.json')
for item in poses:
    if item['id'] in replacements:
        item['gameSourceCommit'] = new['gameSourceCommit']
write(target / 'poses.json', poses)
plan = read(target / 'grid-plan.json'); plan.update({'gameSourceCommit': None, 'sourceCounts': counts}); write(target / 'grid-plan.json', plan)
unchanged = 0
archived = read(archive / 'manifest.json')
for before in archived['items']:
    after = originals[before['id']]
    assert digest(target / after['image']) == after['sha256']
    assert digest(target / after['thumbnail']) == after['thumbnailSha256']
    if before['id'] not in replacements:
        assert before == after, 'Untouched item metadata changed'
        unchanged += 1
assert old.get('perspectiveCollections') == archived.get('perspectiveCollections')
result = {'district': a.district, 'frames': len(items), 'retakesReviewed': len(replacements), 'untouchedItemsAndBytesPreserved': unchanged, 'archivedFullFrames': len(items), 'archivedManifestSha256': digest(archive / 'manifest.json'), 'atlasSourceCounts': counts, 'allGroundPosesPreserved': True, 'perspectiveCollectionsUnchanged': True, 'failures': []}
write(target / 'validation.json', result)
write(retake_dir / 'publication-validation.json', result)
print(json.dumps(result))
