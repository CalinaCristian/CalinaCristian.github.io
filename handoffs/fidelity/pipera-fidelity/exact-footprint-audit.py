#!/usr/bin/env python3
"""Check every prepared outer/courtyard ring against the raw-source audit."""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--data', required=True)
p.add_argument('--source-audit', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
data_path = Path(a.data)
d = json.loads(data_path.read_text())
audit = json.loads(Path(a.source_audit).read_text())
data_sha = hashlib.sha256(data_path.read_bytes()).hexdigest()
assert audit['dataSha256'] == data_sha

def ring_key(points):
    ring = []
    for point in points:
        point = tuple(round(value, 4) for value in point)
        if not ring or point != ring[-1]:
            ring.append(point)
    if ring and ring[0] == ring[-1]:
        ring.pop()
    return min(tuple(sequence[i:] + sequence[:i])
               for sequence in (ring, list(reversed(ring)))
               for i in range(len(sequence))) if ring else ()

errors, inner_count = [], 0
for record in audit['records']:
    i = record['gameIndex']
    assert d['buildingIds'][i] == record['source']
    if ring_key(d['buildingFootprints'][str(i)]) != ring_key(record['sourceOuter']):
        errors.append({'sourceId': record['source'], 'reason': 'outer ring differs'})
    prepared = d.get('buildingHoleFootprints', {}).get(str(i), [])
    inner_count += len(prepared)
    if sorted(map(ring_key, prepared)) != sorted(map(ring_key, record['sourceHoles'])):
        errors.append({'sourceId': record['source'], 'reason': 'inner rings differ'})
result = {
    'dataSha256': data_sha, 'sourceRecords': len(audit['records']),
    'outerRingsChecked': len(audit['records']), 'innerRingsChecked': inner_count,
    'precisionMetres': 0.0001,
    'method': 'Compare all raw OSM outer/inner vertices to prepared precise rings at their declared 0.1 mm serialization precision. Remove only repeated closing/consecutive points; allow traversal rotation/reversal.',
    'errors': errors, 'passed': not errors,
}
Path(a.out).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
raise SystemExit(bool(errors))
