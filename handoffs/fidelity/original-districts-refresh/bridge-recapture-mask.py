#!/usr/bin/env python3
"""Intersect native emitted passive-deck bounds with immutable north-up plans."""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--native', type=Path, required=True)
p.add_argument('--atlas', action='append', required=True, help='Full district ID=poses.json')
p.add_argument('--out', type=Path, required=True)
p.add_argument('--review-margin', type=float, default=200)
a = p.parse_args()
assert a.review_margin >= 0


def intersects(one, two):
    return one[0] <= two[2] and one[2] >= two[0] and one[1] <= two[3] and one[3] >= two[1]


def union(one, two):
    return [min(one[0], two[0]), min(one[1], two[1]), max(one[2], two[2]), max(one[3], two[3])]


districts = []
for spec in a.atlas:
    district, filename = spec.split('=', 1)
    source = a.native / (district + '.json')
    native, poses = json.loads(source.read_text()), json.loads(Path(filename).read_text())
    assert native['district'] == district
    assert all(item['square'] and item['heading'] == 0 and item['pitch'] == -90 for item in poses)
    direction = native.get('lighting', {}).get('sunDirection')
    projected = bool(direction and direction[1] > 0 and native['lighting'].get('shadowsEnabled'))
    records = []
    for case in native['cases']:
        bounds = case['boundsXZ']
        shadow = bounds[:]
        if projected:
            # This bounds all rays from the rendered quad band to the game's flat zero plane.
            # It is a rendering review bound, not a measured physical ground elevation.
            height = max(0, case['y1'])
            dx, dz = -direction[0] * height / direction[1], -direction[2] * height / direction[1]
            shadow = union(bounds, [bounds[0] + dx, bounds[1] + dz, bounds[2] + dx, bounds[3] + dz])
        review = [shadow[0] - a.review_margin, shadow[1] - a.review_margin,
                  shadow[2] + a.review_margin, shadow[3] + a.review_margin]
        records.append({'index': case['index'], 'sourceId': case['sourceId'],
                        'emittedBoundsXZ': bounds, 'y0': case['y0'], 'y1': case['y1'],
                        'dayShadowBoundsXZ': shadow if projected else None,
                        'conservativeReviewBoundsXZ': review,
                        'directFrames': [item['id'] for item in poses if intersects(bounds, item['boundsXZ'])],
                        'dayShadowFrames': [item['id'] for item in poses if projected and intersects(shadow, item['boundsXZ'])],
                        'reviewFrames': [item['id'] for item in poses if intersects(review, item['boundsXZ'])]})
    masks = {key: sorted({frame for record in records for frame in record[key]})
             for key in ('directFrames', 'dayShadowFrames', 'reviewFrames')}
    districts.append({'district': district, 'gameSourceCommit': native['gameSourceCommit'],
                      'dataSha256': native['dataSha256'], 'nativeProofSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                      'poseSourceCommits': sorted({item['gameSourceCommit'] for item in poses}),
                      'lighting': native.get('lighting'), 'atlasFrames': len(poses),
                      'passiveDecks': len(records), 'unresolvedEstimatedTargets': native['stats']['unresolved'],
                      **masks, 'records': records})
result = {'scope': 'Actual emitted passive source bridge and approach quad bounds; source IDs and native estimated elevations retained. No graph or source geometry change.',
          'shadowScope': 'Directional day projection to game zero plane only when actual matching-condition lighting is recorded. Other conditions require their own review. Conservative margin is a capture scheduling bound, not source evidence.',
          'reviewMarginM': a.review_margin, 'districts': districts}
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps([{'district': d['district'], 'atlas': d['atlasFrames'], 'decks': d['passiveDecks'],
                   'direct': len(d['directFrames']), 'dayShadow': len(d['dayShadowFrames']),
                   'review': len(d['reviewFrames'])} for d in districts]))
