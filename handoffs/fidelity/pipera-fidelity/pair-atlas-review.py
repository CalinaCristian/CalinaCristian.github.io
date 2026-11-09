#!/usr/bin/env python3
"""Prepare private game/reference review sheets; publish only their hash ledger."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument('--atlas', required=True)
p.add_argument('--reference', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
atlas, reference, out = map(Path, (a.atlas, a.reference, a.out))
out.mkdir(exist_ok=False)
(out / 'sheets').mkdir()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
current, old = read(atlas / 'manifest.json'), read(reference / 'manifest.json')
refs = {x['id']: x for x in old['items']}
assert len(refs) == len(old['items']) == len(current['items']) == 133
records = []
for item in current['items']:
    ref = refs[item['id']]
    f = reference / 'reference' / (item['id'] + '.jpg')
    assert sha(f) == ref['referenceSha256']
    assert max(abs(x-y) for x,y in zip(item['boundsXZ'], ref['groundBoundsXZ'])) < 1e-6
    assert ref['referenceCoverageFraction'] == 1
    assert sha(atlas / item['image']) == item['sha256']
    records.append({
        'id': item['id'], 'scope': item['scope'], 'boundsXZ': item['boundsXZ'],
        'gameSourceCommit': item['gameSourceCommit'], 'gameSha256': item['sha256'],
        'gameCapturedAt': item['capturedAt'], 'referenceSha256': ref['referenceSha256'],
        'referenceCoverageFraction': ref['referenceCoverageFraction'],
        'referencePixelBox': ref['referencePixelBox'], 'referenceAcquisitionDate': None,
    })
for offset in range(0, len(records), 8):
    rows = records[offset:offset+8]
    sheet = Image.new('RGB', (1280, 4*360), '#15191d')
    draw = ImageDraw.Draw(sheet)
    for k, row in enumerate(rows):
        x, y = (k % 2)*640, (k // 2)*360
        draw.text((x+5,y+3), row['id']+' / '+row['scope'], fill='white')
        draw.text((x+5,y+18), 'GAME '+current['gameSourceCommit'][:7]+' | ESRI / acquisition unknown', fill='#b7c9d1')
        paths = (atlas / next(i['image'] for i in current['items'] if i['id']==row['id']), reference / 'reference' / (row['id']+'.jpg'))
        for col, path in enumerate(paths):
            image = Image.open(path).convert('RGB')
            image.thumbnail((320,320), Image.Resampling.LANCZOS)
            sheet.paste(image,(x+col*320,y+35))
        row['reviewSheet'] = f'sheets/paired-{offset//8+1:02d}.jpg'
    sheet.crop((0,0,1280,((len(rows)+1)//2)*360)).save(out/'sheets'/f'paired-{offset//8+1:02d}.jpg',quality=90)
ledger = {
    'gameSourceCommit': current['gameSourceCommit'], 'referenceProvider': old['referenceProvider'],
    'referenceSourceUrl': old['referenceSourceUrl'], 'referenceAccessDate': old['referenceAccessDate'],
    'referenceAcquisitionDate': None, 'referenceManifestSha256': sha(reference/'manifest.json'),
    'mosaicSha256': old['mosaicSha256'], 'frames': len(records), 'items': records,
    'sheets': {str(f.relative_to(out)):sha(f) for f in sorted((out/'sheets').glob('*.jpg'))},
    'limits': 'Private comparison only. Game is a perspective north-up ground-square capture; roofs project beyond their source footprints. Reference acquisition date, season and registration are not known. Reference images and paired sheets remain outside the checkout.',
}
(out/'paired-source-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
print(json.dumps({'pairs':len(records),'sheets':len(ledger['sheets']),'allReferenceCoverage':1.0}))
