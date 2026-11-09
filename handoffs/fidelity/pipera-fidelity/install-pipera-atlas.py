#!/usr/bin/env python3
"""Publish a complete reviewed Pipera atlas without touching the global catalogue."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--atlas', required=True)
p.add_argument('--root', required=True)
p.add_argument('--review', required=True)
a = p.parse_args()
atlas, root, review_path = map(Path, (a.atlas, a.root, a.review))
read = lambda p: json.loads(p.read_text())
manifest, validation, review = read(atlas/'manifest.json'), read(atlas/'validation.json'), read(review_path)
assert not validation['failures'], validation['failures']
assert len(manifest['items']) == validation['frames'] == review['framesReviewed'] == 133
assert manifest['gameSourceCommit'] == review['gameSourceCommit']
assert len({x['id'] for x in manifest['items']}) == 133
assert all(x['gameSourceCommit'] == manifest['gameSourceCommit'] and x['square'] and x['pitch']==-90 and x['heading']==0 for x in manifest['items'])
boundary = read(atlas/'boundary-source.json')
assert boundary['district'] == 'pipera'
locations = read(Path(__file__).with_name('locations.json'))
projection = boundary['projection']
for location in locations:
    x = (location['lon']-projection['lon0'])*projection['mPerLon']
    z = -(location['lat']-projection['lat0'])*projection['mPerLat']
    location['tileId'] = next((item['id'] for item in manifest['items'] if item['boundsXZ'][0] <= x < item['boundsXZ'][2] and item['boundsXZ'][1] <= z < item['boundsXZ'][3]), None)
    assert location['tileId'], location
target = root/'game/overview/comparison-data/pipera'
target.mkdir(parents=True,exist_ok=True)
old = read(target/'manifest.json') if (target/'manifest.json').exists() else None
if old:
    digest = hashlib.sha256((target/'manifest.json').read_bytes()).hexdigest()[:8]
    historical = target/'historical'/(old.get('gameSourceCommit','mixed')+'-'+digest)
    historical.mkdir(parents=True,exist_ok=False)
    for item in list(target.iterdir()):
        if item.name != 'historical':
            shutil.move(str(item),historical/item.name)
for name in ('images','thumbs'):
    shutil.copytree(atlas/name,target/name)
for name in ('boundary-source.json','capture-report.json','source-provenance.json','validation.json','poses.json','grid-plan.json'):
    shutil.copy2(atlas/name,target/name)
shutil.copy2(atlas/'manifest.json',target/'capture-manifest.json')
shutil.copy2(review_path,target/'review.json')
manifest.update({
    'locationId':'pipera', 'captureType':'branch-source-snapshot', 'sourceCaptureManifest':'capture-manifest.json',
    'locations':locations, 'defaultTile':locations[0]['tileId'],
    'aerial':{
        'provider':'Esri World Imagery',
        'endpoint':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export',
        'attribution':'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        'acquisitionDate':None,
        'delivery':'Live image request; no reference imagery is stored in this repository.',
    },
    'description':'Complete game atlas of the playable area and exact 600 m source scenery ring, with four separately labelled distant context views.',
    'coverageNote':manifest['coverage']+' Boundary cells also contain land outside the source ring.',
    'reviewNote':review['status'], 'review':review,
    'collectionNotes':{'atlas':f"133 fresh frames on {manifest['gameSourceCommit'][:7]}. High quality, summer, clear daylight; moving traffic and mirrors disabled. Source SHA and capture time are retained per frame. The atlas documents remaining modelling limits."},
    'atlasSourceCounts':{manifest['gameSourceCommit']:133},
    'historicalCollections':[],
})
for f in sorted((target/'historical').glob('*/manifest.json')):
    m=read(f)
    manifest['historicalCollections'].append({'manifest':str(f.relative_to(target)),'frames':len(m['items']),'gameSourceCommit':m.get('gameSourceCommit'),'generatedAt':m.get('generatedAt',m.get('generatedDate')),'note':'Original image bytes, source identity and date retained.'})
(target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'district':'pipera','frames':133,'source':manifest['gameSourceCommit'],'historical':len(manifest['historicalCollections'])}))
