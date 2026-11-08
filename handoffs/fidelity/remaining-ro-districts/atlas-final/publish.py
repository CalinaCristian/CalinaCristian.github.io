#!/usr/bin/env python3
"""Copy validated game atlases only; private aerials are never selected."""
import argparse
import collections
import hashlib
import json
import os
import shutil
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--evidence-root', type=Path, required=True)
parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[4])
parser.add_argument('--district', choices=['unirii', 'otopeni'], required=True)
parser.add_argument('--revision', default='0775fda')
parser.add_argument('--historical', action='store_true')
args = parser.parse_args()
district, revision = args.district, args.revision
source = args.evidence_root / district / ('atlas-' + revision)
destination = args.repo / 'game/overview/comparison-data' / district
if args.historical:
    destination /= 'historical/' + revision

read = lambda path: json.loads(path.read_text())
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = read(source / 'manifest.json')
validation = read(source / 'validation.json')
plan = read(source / 'grid-plan.json')
poses = read(source / 'poses.json')
items = manifest['items']
ids = [row['id'] for row in items]
assert len(ids) == len(set(ids)) == len(poses) == validation['frames']
assert ids == [pose['id'] for pose in poses], 'Missing, reordered or duplicate capture'
assert collections.Counter(row['scope'] for row in items) == plan['counts']
assert not validation['failures']
assert digest(source / 'manifest.json') == validation['manifestSha256']
assert manifest['gameSourceCommit'] == plan['gameSourceCommit']
for kind in ['pageErrors', 'consoleErrors', 'failedRequests']:
    assert not manifest['capture'][kind], kind

destination.mkdir(parents=True, exist_ok=True)
for name in ['boundary-source.json', 'source-provenance.json', 'capture-report.json',
             'validation.json', 'world-stats.json', 'grid-plan.json', 'poses.json']:
    shutil.copy2(source / name, destination / name)
shutil.copy2(source / 'manifest.json', destination / 'capture-manifest.json')
for item in items:
    assert item['gameSourceCommit'] == manifest['gameSourceCommit']
    assert item['capturedAt'] and item['width'] == item['height'] == 640
    for key, hash_key in [('image', 'sha256'), ('thumbnail', 'thumbnailSha256')]:
        relative = Path(item[key])
        assert relative.parts[0] in ('images', 'thumbs') and '..' not in relative.parts
        original, target = source / relative, destination / relative
        assert digest(original) == item[hash_key]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        assert digest(target) == item[hash_key]
    with Image.open(destination / item['image']) as image:
        assert image.size == (640, 640)
    item.update(coverageType=item['scope'], orientation='north-up', places=[])
    if args.historical:
        item['captureType'] = 'historical-survey'
for image in (source / 'contact-sheets').glob('all-*.jpg'):
    target = destination / 'contact-sheets' / image.name
    target.parent.mkdir(exist_ok=True)
    shutil.copy2(image, target)

historical_note = ('Historical game survey before the reviewed non-crown input corrections. '
                   'Its original source revision, image hashes and capture dates are retained.')
current_note = (f'Corrected game source {revision}, captured {manifest["generatedDate"]}. '
                'High quality, summer, clear daylight; moving traffic and mirrors disabled.')
counts = manifest['atlasScopeCounts']
manifest.update(
    locationId=district,
    captureType='historical-survey' if args.historical else 'immutable-source-snapshot',
    description=historical_note if args.historical else current_note,
    coverageNote=(f"{len(items)} captured 250 m squares: {counts['core-touches']} touch the playable mask, "
                  f"{counts['ring-touches']} additional squares touch its exact 600 m ring and "
                  f"{counts['outside-ring']} are optional distant context. Boundary squares also include land beyond the ring."),
    reviewNote='Capture completeness and source coverage are separate from architectural fidelity and native movement acceptance.',
    collectionNotes={'atlas': historical_note if args.historical else current_note},
    atlasSourceCounts={manifest['gameSourceCommit']: len(items)},
    sourceCaptureManifest={'path': 'capture-manifest.json',
                           'sha256': digest(destination / 'capture-manifest.json'),
                           'note': 'Exact validated capture ledger. The overview manifest adds provider, scope and review labels.'},
    aerial={'provider': 'Esri World Imagery',
            'endpoint': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export',
            'attribution': 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            'acquisitionDate': None,
            'delivery': 'Live provider request; no aerial or Street View imagery is distributed.',
            'extent': '250 m ground square at the listed WGS84 centre; EPSG:3857 with latitude scale correction.'})
review_file = args.repo / f'handoffs/fidelity/d-{district}/atlas-paired-review-{revision}.json'
review = read(review_file) if review_file.exists() else None
manifest['review'] = {
    'status': 'reviewed-with-gaps' if review else 'capture-verified-only',
    'purpose': 'Source-led inspection and complete capture evidence; no exact visual-parity claim.',
    'framesInspected': review['pairedFramesInspected'] if review else 0,
    'pairedFramesInspected': review['pairedFramesInspected'] if review else 0,
    'contactSheetsInspected': review['contactSheetsInspected'] if review else 0,
    'referenceImagesCommitted': False,
    'referenceAcquisitionDate': None,
    'reviewLedger': os.path.relpath(review_file, destination) if review else None,
    'limitations': review['limitations'] if review else [historical_note, 'No new paired visual inspection is claimed for this collection.']}
if review:
    assert review['gameSourceCommit'] == manifest['gameSourceCommit']
    assert review['captureManifestSha256'] == digest(destination / 'capture-manifest.json')
    assert review['pairedFramesInspected'] == len(items)
    assert [row['id'] for row in review['rows']] == ids
    for item, row in zip(items, review['rows']):
        assert item['sha256'] == row['gameSha256'] and row['referenceAvailable']
if not args.historical:
    manifest['historicalCollections'] = []
    for old_revision in ['4198996', '4378317']:
        relative = f'historical/{old_revision}/manifest.json'
        old_file = destination / relative
        if old_file.exists():
            old = read(old_file)
            manifest['historicalCollections'].append({
                'manifest': relative, 'frames': len(old['items']),
                'gameSourceCommit': old['gameSourceCommit'], 'generatedAt': old['generatedAt'],
                'label': f'Before corrected tree inputs · {old_revision}'})
(destination / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'district': district, 'source': manifest['gameSourceCommit'],
                  'frames': len(items), 'destination': str(destination),
                  'manifestSha256': digest(destination / 'manifest.json')}))
