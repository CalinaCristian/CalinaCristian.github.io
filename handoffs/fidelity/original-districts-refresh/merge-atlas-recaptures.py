#!/usr/bin/env python3
"""Merge a validated conservative water subset without relabelling dry image provenance."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('--baseline', type=Path, required=True)
p.add_argument('--recaptures', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
base, wet = read(a.baseline / 'manifest.json'), read(a.recaptures / 'manifest.json')
mask = read(a.recaptures / 'water-mask.json')
expected = {p['id'] for p in mask['tiles']}
replacement = {p['id']: p for p in wet['items']}
assert expected == set(replacement), 'Missing or unexpected water recaptures'
assert len({p['id'] for p in base['items']}) == len(base['items']) == mask['totalFrames']
assert not a.out.exists(), 'Keep existing merged evidence immutable'
a.out.mkdir(parents=True)
for folder in ('images', 'thumbs', 'provenance', 'contact-sheets'):
    (a.out / folder).mkdir()
snapshots, counts, items, errors = [], Counter(), [], []
for source, manifest in ((a.baseline, base), (a.recaptures, wet)):
    validation, provenance = read(source / 'validation.json'), read(source / 'source-provenance.json')
    assert not validation['failures']
    assert manifest['capture']['pageErrors'] == manifest['capture']['consoleErrors'] == manifest['capture']['failedRequests'] == []
    assert sha(source / 'poses.json') == mask['posesSha256'] if source == a.baseline else True
    data_file = next(p for p in provenance['files'] if p['path'] == 'game/data/' + mask['district'] + '.json')
    assert data_file['sha256'] == mask['dataSha256'], 'District source data changed'
    for f in provenance['files']:
        assert sha(Path(provenance['sourceRoot']) / f['path']) == f['sha256'], 'Served snapshot changed'
    commit = manifest['gameSourceCommit']
    folder = a.out / 'provenance' / commit
    folder.mkdir()
    for name in ('manifest.json', 'validation.json', 'capture-report.json', 'source-provenance.json', 'poses.json', 'grid-plan.json'):
        shutil.copy2(source / name, folder / name)
    snapshots.append({'gameSourceCommit': commit, 'treeSha256': provenance['treeSha256'], 'manifest': str((folder / 'manifest.json').relative_to(a.out)), 'manifestSha256': sha(folder / 'manifest.json'), 'frames': len(manifest['items'])})
for original in base['items']:
    item = replacement.get(original['id'], original)
    source = a.recaptures if original['id'] in replacement else a.baseline
    for k in ('id', 'x', 'z', 'h', 'size', 'fov', 'heading', 'pitch', 'square', 'boundsXZ'):
        assert item[k] == original[k], 'Ground pose changed: ' + original['id'] + '/' + k
    assert item['square'] and item['heading'] == 0 and item['pitch'] == -90
    assert sha(source / item['image']) == item['sha256']
    assert sha(source / item['thumbnail']) == item['thumbnailSha256']
    for key in ('image', 'thumbnail'):
        shutil.copy2(source / item[key], a.out / item[key])
    counts[item['gameSourceCommit']] += 1
    items.append(item)
assert len(items) == mask['totalFrames']
base.update({'gameSourceCommit': None, 'publishedBaseline': None, 'atlasSourceCounts': dict(counts), 'items': items, 'generatedAt': wet['generatedAt'], 'generatedDate': wet['generatedDate'], 'sourceSnapshots': snapshots,
             'sourceCompatibility': {'method': 'Conservative source-water mask: replace every intersecting water square, retain dry original image bytes and their actual source SHA. Original district data hash and every ground pose are unchanged. This is scoped render reuse, not a claim that dry frames were captured on the later source.', 'waterMask': 'water-mask.json', 'waterMaskSha256': sha(a.recaptures / 'water-mask.json')}})
base['capture'].update({'startedAt': min(base['capture']['startedAt'], wet['capture']['startedAt']), 'endedAt': max(base['capture']['endedAt'], wet['capture']['endedAt']), 'frameCounts': len(items), 'sourceSnapshots': snapshots, 'source': None,
                        'perfMaxima': {'triangles': max(p['perf']['triangles'] for p in items), 'drawCalls': max(p['perf']['drawCalls'] for p in items), 'note': 'Separate maxima; world-only high north-up, traffic/mirror disabled. No hardware FPS or driving-budget claim.'}})
base['capture']['validation'] = {'framesVerified': len(items), 'failures': [], 'mixedSourceProvenancePreserved': True}
for start in range(0, len(items), 12):
    group = items[start:start + 12]
    sheet = Image.new('RGB', (1280, ((len(group) + 3) // 4) * 350), '#15191d')
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(group):
        with Image.open(a.out / item['image']) as image:
            image.thumbnail((320, 320), Image.Resampling.LANCZOS)
            x, y = i % 4 * 320, i // 4 * 350
            sheet.paste(image, (x, y + 30))
            draw.text((x + 5, y + 3), item['id'] + ' ' + item['gameSourceCommit'][:7], fill='white')
            draw.text((x + 5, y + 16), item['scope'], fill='#a8c5d6')
    sheet.save(a.out / 'contact-sheets' / f'all-{start // 12 + 1:02}.jpg', quality=88)
write = lambda name, value: (a.out / name).write_text(json.dumps(value, indent=2) + '\n')
write('manifest.json', base)
write('capture-report.json', base['capture'])
write('source-provenance.json', {'gameSourceCommit': None, 'sourceSnapshots': snapshots, 'note': 'Every retained frame carries its actual immutable capture SHA. Full original source and capture records are preserved under provenance/.'})
write('poses.json', [{k: item[k] for k in read(a.baseline / 'poses.json')[0]} for item in items])
plan = read(a.baseline / 'grid-plan.json'); plan.update({'gameSourceCommit': None, 'sourceCounts': dict(counts)})
write('grid-plan.json', plan)
shutil.copy2(a.baseline / 'boundary-source.json', a.out / 'boundary-source.json')
shutil.copy2(a.recaptures / 'water-mask.json', a.out / 'water-mask.json')
write('validation.json', {'frames': len(items), 'failures': [], 'sourceCounts': dict(counts), 'baselineValidationSha256': sha(a.baseline / 'validation.json'), 'recaptureValidationSha256': sha(a.recaptures / 'validation.json'), 'manifestSha256': sha(a.out / 'manifest.json')})
print(json.dumps({'frames': len(items), 'sourceCounts': dict(counts), 'failures': []}))
