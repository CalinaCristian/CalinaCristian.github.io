#!/usr/bin/env python3
"""Identity-first Pipera source ledger, including the small records omitted by the legacy audit.

No imagery is read. Geometry is OSM and the district's analytic boundary, in game metres.
"""
import argparse
import glob
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    ap.add_argument('--osm', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    root = Path(a.root)
    spec = importlib.util.spec_from_file_location('building_audit', root / 'tools/osm/building-audit.py')
    geom = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(geom)
    data_path = root / 'game/data/bucharest-pipera.json'
    d = json.loads(data_path.read_text())
    p = d['proj']
    project = lambda ll: ((ll[1] - p['lon0']) * p['mPerLon'], -(ll[0] - p['lat0']) * p['mPerLat'])
    nodes, ways, relations, manifests = {}, {}, {}, []
    for filename in sorted(glob.glob(str(Path(a.osm) / '*.xml'))):
        b = Path(filename).read_bytes()
        manifests.append({'file': Path(filename).name, 'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b)})
        for _, el in ET.iterparse(filename, events=('end',)):
            if el.tag == 'node':
                nodes[el.get('id')] = (float(el.get('lat')), float(el.get('lon')))
                el.clear()
            elif el.tag in ('way', 'relation'):
                t = {x.get('k'): x.get('v') for x in el.iter('tag')}
                if el.tag == 'way':
                    ways[el.get('id')] = ([x.get('ref') for x in el.iter('nd')], t)
                else:
                    relations[el.get('id')] = ([(m.get('ref'), m.get('role')) for m in el.iter('member') if m.get('type') == 'way'], t)
                el.clear()
    by_id = {}
    for i, source in enumerate(d.get('buildingIds', [])):
        by_id.setdefault(source, []).append(i)
    records, skips = [], []

    def record(source, refs, t, holes=None):
        if len(refs) < 4 or refs[0] != refs[-1] or any(n not in nodes for n in refs):
            skips.append({'source': source, 'reason': 'unclosed-or-incomplete-source-way'})
            return
        poly = [project(nodes[n]) for n in refs[:-1]]
        issue = geom.source_ring_issue(poly)
        if issue:
            skips.append({'source': source, 'reason': issue})
            return
        holes = holes or []
        margin = geom.geometry_footprint_margin(poly, d['district']['geometry'], holes)
        if margin > 600 + 1e-7:
            return
        source_area = abs(geom.area(poly)) - sum(abs(geom.area(h)) for h in holes)
        candidates = by_id.get(source, [])
        centre = geom.centroid(poly)
        i = min(candidates, key=lambda i: math.dist(centre, geom.centroid(geom.undelta(d['buildings'][i], 9)))) if candidates else None
        rec = {'source': source, 'zone': 'core' if margin <= 0 else 'ring', 'marginM': round(margin, 4),
               'sourceAreaM2': round(source_area, 4), 'sourceOuter': poly, 'sourceHoles': holes, 'tags': t,
               'gameIndex': i, 'identityPresent': i is not None}
        if i is not None:
            row = d['buildings'][i]
            prepared = d.get('buildingFootprints', {}).get(str(i)) or geom.undelta(row, 9)
            gh = d.get('buildingHoleFootprints', {}).get(str(i)) or [geom.undelta(h, 0) for h in d.get('buildingHoles', {}).get(str(i), [])]
            prepared_area = abs(geom.area(prepared)) - sum(abs(geom.area(h)) for h in gh)
            height, minimum = d.get('buildingDimensions', {}).get(str(i), [row[1] * .1, row[2] * .1])
            height_tag = geom.measure(t.get('height'))
            min_tag = geom.measure(t.get('min_height'))
            rec.update({'preparedAreaM2': round(prepared_area, 4), 'areaRatio': round(prepared_area / source_area, 5) if source_area else None,
                        'heightM': height, 'minimumM': minimum, 'roof': d['roofs'][row[3]], 'storeys': row[6],
                        'heightSourceCode': d['buildingInfo'][i * 5 + 4], 'holeCount': len(gh),
                        'literalHeightMatches': height_tag is None or height_tag <= 0 or abs(height - height_tag) < .011,
                        'literalMinimumMatches': min_tag is None or min_tag <= 0 or abs(minimum - min_tag) < .011})
        records.append(rec)

    def positive(value):
        return value is not None and str(value) != '' and str(value).lower() not in ('no', 'false', '0')

    for wid, (refs, t) in ways.items():
        if positive(t.get('building')) or positive(t.get('building:part')):
            record('w' + wid, refs, t)
    for rid, (members, t) in relations.items():
        if t.get('type') != 'multipolygon' or not (positive(t.get('building')) or positive(t.get('building:part'))):
            continue
        outers = geom.assemble_rings([ways[w][0] for w, role in members if role != 'inner' and w in ways])
        inners = geom.assemble_rings([ways[w][0] for w, role in members if role == 'inner' and w in ways])
        holes = [[project(nodes[n]) for n in h[:-1]] for h in inners if all(n in nodes for n in h)]
        for outer in outers:
            if not all(n in nodes for n in outer):
                continue
            poly = [project(nodes[n]) for n in outer[:-1]]
            record('r' + rid, outer, t, [h for h in holes if all(geom.pip(*v, poly) for v in h)])
    summary = {'sourceSolidRecords': len(records), 'exactIdentitiesPresent': sum(r['identityPresent'] for r in records),
               'missing': [r['source'] for r in records if not r['identityPresent']],
               'areaBelow95Percent': [r['source'] for r in records if r.get('areaRatio', 1) < .95],
               'literalHeightMismatch': [r['source'] for r in records if not r.get('literalHeightMatches', True)],
               'literalMinimumMismatch': [r['source'] for r in records if not r.get('literalMinimumMatches', True)],
               'smallSourceRecordsBelow25M2': sum(r['sourceAreaM2'] < 25 for r in records),
               'aircraftSourceRecords': sum(r['tags'].get('historic') == 'aircraft' for r in records),
               'sourceParts': sum(bool(r['tags'].get('building:part')) for r in records)}
    output = {'method': 'Exact source identity; whole source solid intersects analytic core or 600m ring. No minimum-area omission; unclosed/incomplete geometry excluded. OSM tags first. No imagery.',
              'dataSha256': hashlib.sha256(data_path.read_bytes()).hexdigest(), 'sourceTiles': manifests,
              'summary': summary, 'records': records, 'sourceSkips': skips}
    Path(a.out).write_text(json.dumps(output, separators=(',', ':')) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
