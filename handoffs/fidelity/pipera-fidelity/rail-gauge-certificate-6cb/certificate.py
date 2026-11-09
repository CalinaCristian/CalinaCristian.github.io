"""CPU certificate: an inferred native wall lies inside literal source gauge."""
import json
import math
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / 'inputs.json').read_text())
projection = data['projection']
points = sorted({(v[0], v[2]) for t in data['triangles'] for v in t['vertices']})
heights = [v[1] for t in data['triangles'] for v in t['vertices']]
assert len(points) == 2
assert {t['triangle'] for t in data['triangles']} == {648, 649}
wall_low, wall_high = min(heights), max(heights)


def closest(point, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dz * dz
    assert length2 > 0
    raw_t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length2
    t = max(0, min(1, raw_t))
    at = [a[0] + t * dx, a[1] + t * dz]
    return {'t': t, 'unclampedT': raw_t, 'closestPointXZ': at,
            'distanceM': math.hypot(point[0] - at[0], point[1] - at[1]),
            'signedLateralM': ((point[0] - a[0]) * -dz + (point[1] - a[1]) * dx) / math.sqrt(length2)}


def polyline_result(rail_points, node_ids):
    results = []
    for point in points:
        index, result = min(((i, closest(point, a, b)) for i, (a, b) in
                             enumerate(zip(rail_points, rail_points[1:]))), key=lambda r: r[1]['distanceM'])
        results.append({'wallPointXZ': point, 'sourceSegment': index,
                        'sourceNodeIds': node_ids[index:index + 2], **result})
    return results


raw_results, native_results = {}, {}
for way_id, way in data['rawRails'].items():
    p = [((lon - projection['lon0']) * projection['mPerLon'],
          (projection['lat0'] - lat) * projection['mPerLat']) for lat, lon in way['wgs84']]
    raw_results['w' + way_id] = polyline_result(p, way['nodeIds'])
for way in data['nativeRails']:
    native_results[way['sourceId']] = polyline_result(
        [(v['x'], v['z']) for v in way['sourceVertices']], way['nodeIds'])

gauge = float(data['rawRails']['205971103']['tags']['gauge']) / 1000
assert gauge == 1.435
half = gauge / 2
for source in [raw_results, native_results]:
    rows = source['w205971103']
    assert all(r['sourceSegment'] == 20 and 0 < r['unclampedT'] < 1 for r in rows)
    assert all([str(n) for n in r['sourceNodeIds']] == ['6187848807', '6187848833'] for r in rows)
    assert max(r['distanceM'] for r in rows) < half
    assert min(r['distanceM'] for r in source['w118416425']) > half

# The fixed source segment is convex. Both perpendicular projections remain
# interior; projection parameters interpolate linearly along the wall. Signed
# distance is affine, so its absolute maximum occurs at an endpoint. This is
# a certificate for the whole wall segment, not a midpoint-only observation.
current_grade = data['currentGradeObservation']
assert current_grade['known'] and current_grade['estimated']
rail_heights = [s['renderedRailHeadY'] for s in current_grade['samples']]
assert min(rail_heights) == max(rail_heights) == 11.276
assert wall_low < min(rail_heights) < wall_high

# Negative controls: the other actual track is outside this gauge; a parallel
# wall shifted three metres is outside it; a ground-level wall has no vertical
# overlap with this modeled elevated running height.
way = data['rawRails']['205971103']
p = [((lon - projection['lon0']) * projection['mPerLon'],
      (projection['lat0'] - lat) * projection['mPerLat']) for lat, lon in way['wgs84']]
a, b = p[20:22]
length = math.dist(a, b)
normal = (-(b[1] - a[1]) / length, (b[0] - a[0]) / length)
shifted = [[v[0] + normal[0] * 3, v[1] + normal[1] * 3] for v in points]
assert min(closest(v, a, b)['distanceM'] for v in shifted) > half
assert not 0 <= rail_heights[0] <= 1.1

report = {
    'scope': 'Exact CPU source-gauge/height certificate for inferred native solid1,-2 triangles648/649. No aerial widths, body sweep, browser, production edits or new source assignment.',
    'nativeCommit': data['nativeCommit'], 'nativeExportSha256': data['nativeExportSha256'],
    'wall': {'mesh': data['mesh'], 'triangles': [648, 649], 'endpointsXZ': points,
             'lengthM': math.dist(*points), 'verticalBandM': [wall_low, wall_high]},
    'sourceGaugeM': gauge, 'sourceGaugeHalfM': half,
    'rawPreciseSource': raw_results, 'retainedNativeSource': native_results,
    'entireWallInsideRunningGauge': True,
    'rawMinimumGaugeMarginM': half - max(r['distanceM'] for r in raw_results['w205971103']),
    'nativeMinimumGaugeMarginM': half - max(r['distanceM'] for r in native_results['w205971103']),
    'wholeSegmentProof': 'Both endpoints project inside the same literal rail segment; affine projection and signed distance certify the entire intervening wall segment inside the convex gauge strip.',
    'height': {'modelDisplacementY': 11, 'renderedRailHeadY': 11.276,
               'railHeadInsideWallBand': True, 'estimatedNotSurveyed': True,
               'consumedSourcesSha256': current_grade['consumedSourcesSha256']},
    'inferredEmissionOrigin': data['emissionProvenance'],
    'mappedBarrierAudit': data['rawBarrierAudit'],
    'negativeControls': {'otherLiteralTrackOutsideGauge': True,
                         'threeMetreShiftOutsideGauge': True,
                         'groundWallNoElevatedHeightOverlap': True},
    'interpretation': [
        'The default wall occupies the space between the mapped rails at their modeled running height, independently of long-vehicle sweep.',
        'This does not claim that the wall directly touches a steel railhead: it lies inside the running gauge between the two rails.',
        'Bridge-default origin is established by the emission block, not by absence of a nearby OSM barrier.',
        'The certificate supports an inferred-only physical clearance exclusion. It does not authorize deleting mapped barriers or altering source centerlines, widths or grade.',
        'Height compatibility uses the current known100m-rise MODEL profile. OSM layers are not measured elevations.']}
if len(sys.argv) > 1:
    output = Path(sys.argv[1])
    if output.exists():
        raise SystemExit('Output must be new')
    output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'wholeWallInsideGauge': True, 'rawMarginM': report['rawMinimumGaugeMarginM'],
                  'nativeMarginM': report['nativeMinimumGaugeMarginM'],
                  'modeledRailHeadY': 11.276, 'wallBandM': [wall_low, wall_high],
                  'negativeControls': report['negativeControls']}, indent=2))
