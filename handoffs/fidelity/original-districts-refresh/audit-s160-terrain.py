#!/usr/bin/env python3
"""Evidence-only coverage audit; does not infer or modify a road/terrain height."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'game/data/seattle-seatac.json'
EVIDENCE = Path(__file__).parent / 'proof/scenery-bridge-ordering/seatac-s160-usgs-terrain.json'
NODE = 430536585
data, evidence = json.loads(DATA.read_text()), json.loads(EVIDENCE.read_text())
measured = {p['sourceNodeId']: p for p in evidence['points'] if 'sourceNodeId' in p}
rise = evidence['interpretation']['junctionMinusCrossingM']
distance = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
arms = []
for piece, source in data['scenerySourceGeometry'].items():
    if NODE not in source['nodeIds']:
        continue
    index = source['nodeIds'].index(NODE)
    for direction in (-1, 1):
        adjacent = index + direction
        if not 0 <= adjacent < len(source['nodeIds']):
            continue
        nodes, travelled, previous = [], 0, source['projected'][index]
        for i in range(adjacent, len(source['nodeIds']) if direction > 0 else -1, direction):
            point, node = source['projected'][i], source['nodeIds'][i]
            travelled += distance(previous, point)
            sample = measured.get(node)
            nodes.append({'sourceNodeId': node, 'x': point[0], 'z': point[1], 'distanceAlongWayM': travelled,
                          'bareEarthM': float(sample['response']['value']) if sample else None})
            previous = point
        first = nodes[0]
        arms.append({'piece': int(piece), 'sourceId': source['sourceId'], 'tags': source['tags'],
                     'sourceNodeCountBeyondJunction': len(nodes),
                     'measuredSourceNodeCountBeyondJunction': sum(p['bareEarthM'] is not None for p in nodes),
                     'distanceToWayEndpointM': travelled,
                     'blindJunctionOnlyLiftGradeToUnchangedFirstNode': rise / first['distanceAlongWayM'],
                     'nodes': nodes})
assert len(arms) == 4, 'The exact incident source topology changed; review instead of reusing this audit'
result = {
    'scope': 'Evidence-only exact incident-arm and bare-earth sample coverage; no new terrain, deck or clearance estimate.',
    'sourceData': {'path': str(DATA.relative_to(ROOT)), 'sha256': sha(DATA)},
    'terrainEvidence': {'path': str(EVIDENCE.relative_to(ROOT)), 'sha256': sha(EVIDENCE),
                        'acquisitionDate': evidence['interpretation']['acquisitionDate'],
                        'resolutionM': evidence['interpretation']['rasterResolutionM'],
                        'deckMeasurement': False, 'roadClearanceMeasurement': False},
    'junctionSourceNodeId': NODE, 'incidentArms': arms,
    'junctionMinusExpresswayCrossingBareEarthM': rise,
    'minimumDistanceForThisRiseAt8PercentM': rise / .08,
    'runtimeCorrectionSupported': False,
    'openNativeContact': {'sourceCommit': '143dca860f4d1e2e8b947f3579e18359f474064e',
                          'upperSourceId': 'w37017434', 'lowerSourceId': 'w124272629',
                          'clearanceM': 1.9290135352777604, 'bodyHeightM': 2,
                          'productionBodyQueryBlocked': True},
    'gaps': [
        'No bare-earth samples beyond the junction on the actual motorway link w104034223.',
        'Only two of the 28 service-way nodes beyond this junction have bare-earth samples.',
        'The eastern throughroad endpoint remains 3.126937867 m above the expressway crossing bare earth; its continuation terrain and junction ties are unmeasured.',
        'The current source data has no terrain height field. Raising only the bridge cap would leave incident road surfaces and adjacent ground/objects inconsistent.',
        'Bare earth under a bridge omits its deck. These samples cannot establish the actual bridge profile or clearance.',
    ],
    'requiredNextEvidence': 'A continuous local terrain model covering all four actual incident arms, their source junction continuations and adjacent ground/objects; retain exact XY, access, widths and fixed core grades. Independently validate the deck rather than treating bare earth as a deck survey.',
}
print(json.dumps(result, indent=2))
