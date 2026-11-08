#!/usr/bin/env python3
"""Summarize the independent, all-positive-area source audit without hiding rows."""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--audit-dir', required=True)
p.add_argument('--source-root', required=True)
p.add_argument('--commit', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
audit, root = Path(a.audit_dir), Path(a.source_root)
reports = {}
for district in ('floreasca', 'romana', 'grozavesti'):
    raw = audit / (district + '.json')
    rows = json.loads(raw.read_text())
    data_file = root / ('game/data/bucharest-' + district + '.json')
    data = json.loads(data_file.read_text())
    groups = {}
    for kind in ('way', 'relation'):
        for zone in ('inside', 'ring'):
            records = [r for r in rows if r['zone'] == zone and (r['osm'].startswith('r')) == (kind == 'relation')]
            matched = [r for r in records if r.get('identityPresent')]
            groups[kind + '-' + zone] = {
                'sourceRecords': len(records), 'identitiesPresent': len(matched),
                'topologyMatches': sum(bool(r.get('topologyMatches')) for r in matched),
                'literalHeightMismatches': [r['osm'] for r in matched if r.get('literalHeightMatches') is False],
                'storeysMismatches': [r['osm'] for r in matched if r.get('storeysMatch') is False],
                'missingIds': [r['osm'] for r in records if not r.get('identityPresent')],
                'geometryMismatches': [r['osm'] for r in matched if not r.get('topologyMatches')],
                'courtyardInteriorFailures': [r['osm'] for r in matched if r.get('courtyardInteriorsClear') is False],
            }
    reports[district] = {
        'dataSha256': hashlib.sha256(data_file.read_bytes()).hexdigest(),
        'rawAuditSha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
        'sourceRecords': len(data['buildings']), 'buildingGeometryPolicy': data.get('buildingGeometryPolicy'),
        'roadGeometryPolicy': data.get('roadGeometryPolicy'),
        'preciseFootprints': len(data.get('buildingFootprints', {})),
        'courtyardBuildings': len(data.get('buildingHoles', {})),
        'courtyardRings': sum(map(len, data.get('buildingHoles', {}).values())),
        'trees': len(data['trees']) // 3, 'treeRetention': data.get('treeRetention'),
        'railways': len(data.get('railways', [])), 'groups': groups,
    }
Path(a.out).write_text(json.dumps({'gameSourceCommit': a.commit, 'districts': reports}, indent=2) + '\n')
