"""Read-only source/width and full emitted-body audit. No rendering/browser."""
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
native = json.loads(gzip.decompress((BASE / 'fixtures/native-subset.json.gz').read_bytes()))
body = json.loads(gzip.decompress((BASE / 'fixtures/actual-body-vertices.json.gz').read_bytes()))
raw = json.loads((BASE / 'fixtures/raw-osm.json').read_text())
measurements = json.loads((BASE / 'reference-measurements.json').read_text())
assert native['nativeExportSha256'] == body['nativeExportSha256']
roads = [e for e in native['allEdges'] if e['sourceId'] in
         {'w1552024280', 'w1552024281', 'w1552024282'}]


def nearest(point):
    result = None
    for e in roads:
        dx, dz = point[0] - e['a']['x'], point[2] - e['a']['z']
        s = max(0, min(e['len'], dx * e['dirx'] + dz * e['dirz']))
        x, z = e['a']['x'] + s * e['dirx'], e['a']['z'] + s * e['dirz']
        distance = math.hypot(point[0] - x, point[2] - z)
        if result is None or distance < result['distanceM']:
            result = {'distanceM': distance, 'lateralM': (point[0] - x) * e['nx'] + (point[2] - z) * e['nz'],
                      'edgeId': e['id'], 'sourceId': e['sourceId']}
    return result


results = []
for case in body['result']:
    p = case['actualNativePose']
    values = [nearest(v) for v in case['worldVertices']]
    assert len(values) == case['emittedVertices']
    assert all(math.isfinite(v['lateralM']) for v in values)
    maximum = max(v['lateralM'] for v in values)
    assert maximum < 0  # Every emitted vertex is on the road's rail/left side.
    center = nearest([p['x'], p['y'], p['z']])
    results.append({'fixture': case['fixture'], 'kind': case['kind'], 'actualNativePose': p,
                    'emittedVertices': len(values), 'emittedBounds': case['emittedBounds'],
                    'nearestRoadAtCentre': center, 'mostRoadwardVertexLateralM': maximum,
                    'maximumUniformLeftExtentWithoutFootprintIntrusionM': -maximum,
                    'currentNativeTriangleContactsAtLeast': len(case['contacts']),
                    'contactEvidenceTruncatedAt': 30,
                    'bodyNearestSourceIds': sorted({v['sourceId'] for v in values})})

source = []
for way in ['1552024280', '1552024281', '1552024282', '458458361']:
    osm = raw['ways'][way]
    es = [e for e in native['allEdges'] if e['sourceId'] == 'w' + way]
    source.append({'sourceId': 'w' + way, 'rawTags': osm['tags'],
                   'rawWidthTagPresent': 'width' in osm['tags'],
                   'rawPlacementTagPresent': any(k.startswith('placement') for k in osm['tags']),
                   'nativeRoadIndices': sorted({e['road'] for e in es}),
                   'nativeWidths': sorted({(e['wL'], e['wR'], e['laneW'], e['laneCenterShiftM']) for e in es}),
                   'nativeWidthSourceRecorded': any(e.get('roadWidthSource') for e in es)})

profiles = []
for p in measurements['profiles']:
    profiles.append({'id': p['id'], 'railSourceSegment': p['sourceSegment'],
                     'nativeRoadEdge': p['nativeRoadEdge'], 'readings': p['manualReadings'],
                     'registrationUncertaintyM': measurements['sourceRegistrationUncertaintyM']})

report = {'scope': 'Independent source tags, calibrated manual aerial ranges and actual emitted CPU body geometry; no production change or whole-scene negative clearance claim.',
          'bodyModelScope': 'Historical pre-100m-rise grade model. These pinned body poses must not be relabelled as the later 100m-rise plateau poses.',
          'sourceNativeCommit': native['sourceCommit'], 'nativeExportSha256': native['nativeExportSha256'],
          'consumedBodySourcesSha256': body['consumedSourcesSha256'], 'sourceRoads': source,
          'bodyCases': results, 'measuredProfiles': profiles, 'acquisitionDate': 'unknown',
          'findings': [
              'No audited road has an OSM width or placement tag. The three w155202428x roads explicitly have two lanes; w458458361 does not.',
              'Native audited carriageways use estimated centered 7m widths with zero lateral shift.',
              'Visible asphalt edges are asymmetric around the literal OSM line; a centered narrower total is not the only possible source-backed width interpretation.',
              'Seg20 measured inner edge may remove the footprint overlap, but image registration and whole-body uncertainty prevent a clearance certificate.',
              'Seg27 measured inner edge still overlaps the most roadward emitted vertices before registration uncertainty. Width alone does not certify this case.',
              'The pinned pre-100m-rise mesh intersections are positive proof for that model. A source-backed footprint or later grade correction requires a new body/support check.',
              'Common layer/bridge tags do not prove one common deck height; preserve independent carriageway/rail profiles until physical support is associated.'],
          'noSourceGeometryEdited': True, 'noBrowserStarted': True}
if len(sys.argv) > 1:
    dest = Path(sys.argv[1])
    if dest.exists():
        raise SystemExit('Output must be new')
    dest.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'sourceRoads': len(source), 'bodyCases': [
    {'segment': c['fixture']['segment'], 'kind': c['kind'], 'bodyLeftExtentLimitM': c['maximumUniformLeftExtentWithoutFootprintIntrusionM']}
    for c in results], 'noBrowserStarted': True}, indent=2))
