#!/usr/bin/env python3
"""Prepare private original/retake/reference sheets and a portable hash ledger."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('--original', required=True)
p.add_argument('--retakes', required=True)
p.add_argument('--reference', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
original, retakes, reference, out = map(Path, (a.original, a.retakes, a.reference, a.out))
read = lambda f: json.loads(f.read_text())
sha = lambda f: hashlib.sha256(f.read_bytes()).hexdigest()
old, new, refs = read(original/'manifest.json'), read(retakes/'manifest.json'), read(reference/'manifest.json')
old_by_id, refs_by_id = ({r['id']: r for r in m['items']} for m in (old, refs))
assert len(old_by_id) == len(old['items'])
assert len(refs_by_id) == len(refs['items'])
assert len({r['id'] for r in new['items']}) == len(new['items'])
out.mkdir(exist_ok=False)
(out/'sheets').mkdir()
records = []
pose_keys = ['x', 'z', 'h', 'size', 'fov', 'heading', 'pitch', 'square', 'boundsXZ', 'scope']
for r in new['items']:
    before, ref = old_by_id[r['id']], refs_by_id[r['id']]
    assert all(before[k] == r[k] for k in pose_keys), r['id']
    assert sha(original/before['image']) == before['sha256']
    assert sha(retakes/r['image']) == r['sha256']
    assert sha(reference/'reference'/(r['id']+'.jpg')) == ref['referenceSha256']
    assert ref['referenceCoverageFraction'] == 1
    assert max(abs(x-y) for x,y in zip(r['boundsXZ'], ref['groundBoundsXZ'])) < 1e-6
    records.append({'id': r['id'], 'scope': r['scope'], 'boundsXZ': r['boundsXZ'],
                    'originalSourceCommit': before['gameSourceCommit'], 'originalCapturedAt': before['capturedAt'],
                    'originalGameSha256': before['sha256'], 'retakeSourceCommit': r['gameSourceCommit'],
                    'retakeCapturedAt': r['capturedAt'], 'retakeGameSha256': r['sha256'],
                    'referenceSha256': ref['referenceSha256'], 'referenceCoverageFraction': 1,
                    'referencePixelBox': ref['referencePixelBox'], 'referenceAcquisitionDate': None})
for offset in range(0, len(records), 4):
    rows = records[offset:offset+4]
    sheet = Image.new('RGB', (960, len(rows)*355), '#15191d')
    draw = ImageDraw.Draw(sheet)
    sheet_path = f'sheets/triplets-{offset//4+1:02d}.jpg'
    for i, row in enumerate(rows):
        y = i*355
        draw.text((5,y+3), row['id']+' / '+row['scope'], fill='white')
        for j,(label,path) in enumerate([
            ('ORIGINAL '+old_by_id[row['id']]['gameSourceCommit'][:7], original/old_by_id[row['id']]['image']),
            ('RETAKE '+new['gameSourceCommit'][:8], retakes/next(r['image'] for r in new['items'] if r['id']==row['id'])),
            ('ESRI / acquisition unknown', reference/'reference'/(row['id']+'.jpg')),
        ]):
            draw.text((j*320+5,y+18), label, fill='#b7c9d1')
            with Image.open(path) as im:
                im = im.convert('RGB'); im.thumbnail((320,320), Image.Resampling.LANCZOS)
                sheet.paste(im,(j*320,y+35))
        row['privateReviewSheet'] = sheet_path
    sheet.save(out/sheet_path, quality=92)
ledger = {'sourceCommit': new['gameSourceCommit'], 'originalSourceCommit': old['gameSourceCommit'],
          'frames': len(records), 'items': records,
          'referenceProvider': refs['referenceProvider'], 'referenceSourceUrl': refs['referenceSourceUrl'],
          'referenceAccessDate': refs['referenceAccessDate'], 'referenceAcquisitionDate': None,
          'referenceManifestSha256': sha(reference/'manifest.json'), 'mosaicSha256': refs['mosaicSha256'],
          'privateSheetsSha256': {str(f.relative_to(out)): sha(f) for f in sorted((out/'sheets').glob('*.jpg'))},
          'note': 'Prepared review material, not a completed visual review. Reference imagery and triplet sheets remain private.'}
(out/'triplet-source-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
print(json.dumps({'frames':len(records),'sheets':len(ledger['privateSheetsSha256']),'allReferenceCoverage':1}))
