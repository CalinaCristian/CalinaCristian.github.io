#!/usr/bin/env python3
"""Read-only OSM bridge/rail evidence, with explicit source-geometry sampling.

This does not run the native world or infer elevations from OSM layer/level.
"""
import argparse
import glob
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inside(q, ring):
    x, z = q
    result = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((x-a[0])*dx + (z-a[1])*dz) / (dx*dx+dz*dz))) if dx or dz else 0
        if math.hypot(x-a[0]-t*dx, z-a[1]-t*dz) < 1e-8:
            return True
        if (a[1] > z) != (b[1] > z) and x < a[0] + dx * (z-a[1]) / dz:
            result = not result
    return result


def intersect(a, b, c, d):
    ux, uz = b[0]-a[0], b[1]-a[1]
    vx, vz = d[0]-c[0], d[1]-c[1]
    den = ux*vz-uz*vx
    if abs(den) < 1e-8:
        return None
    wx, wz = c[0]-a[0], c[1]-a[1]
    t, s = (wx*vz-wz*vx)/den, (wx*uz-wz*ux)/den
    return [a[0]+ux*t, a[1]+uz*t] if 0 < t < 1 and 0 < s < 1 else None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tiles', required=True)
    p.add_argument('--dataset', required=True)
    p.add_argument('--ways', type=int, nargs='+', required=True)
    p.add_argument('--structures', type=int, nargs='+', required=True)
    p.add_argument('--road-names', nargs='*', default=[])
    p.add_argument('--out', required=True)
    args = p.parse_args()
    data = json.loads(Path(args.dataset).read_text())
    nodes, ways, relations, tile_hashes = {}, {}, {}, {}
    for path in sorted(glob.glob(str(Path(args.tiles)/'*.xml'))):
        tile_hashes[Path(path).name] = digest(path)
        for _, e in ET.iterparse(path, events=['end']):
            if e.tag not in ('node', 'way', 'relation'):
                continue
            record = {'id': int(e.attrib['id']), 'tags': {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')},
                      'version': e.get('version'), 'timestamp': e.get('timestamp')}
            if e.tag == 'node':
                record.update(lat=float(e.get('lat')), lon=float(e.get('lon')))
                nodes[record['id']] = record
            elif e.tag == 'way':
                record['nodeIds'] = [int(n.get('ref')) for n in e.findall('nd')]
                ways[record['id']] = record
            else:
                record['members'] = [dict(m.attrib) for m in e.findall('member')]
                relations[record['id']] = record
            e.clear()
    proj = data['proj']
    def xy(n):
        n = nodes[n]
        return [(n['lon']-proj['lon0'])*proj['mPerLon'], (proj['lat0']-n['lat'])*proj['mPerLat']]
    def geometry(w):
        return [xy(n) for n in w['nodeIds'] if n in nodes]
    bridge_relations = [r for r in relations.values() if r['tags'].get('type') == 'bridge' or r['tags'].get('man_made') == 'bridge']
    structures = [{**ways[s], 'points': geometry(ways[s])} for s in args.structures]
    selected = []
    for sid in args.ways:
        w = ways[sid]
        points = geometry(w)
        endpoints = {w['nodeIds'][0], w['nodeIds'][-1]}
        connected = [{**o, 'sharedNodeIds': sorted(endpoints.intersection(o['nodeIds'])), 'points': geometry(o)}
                     for oid, o in ways.items() if oid != sid and o['tags'].get('railway') == 'tram' and endpoints.intersection(o['nodeIds'])]
        crossings = []
        for o in ways.values():
            if 'highway' not in o['tags']:
                continue
            other_points = geometry(o)
            for i, (a, b) in enumerate(zip(points, points[1:])):
                for j, (c, d) in enumerate(zip(other_points, other_points[1:])):
                    q = intersect(a, b, c, d)
                    if q is not None:
                        crossings.append({'railSegment': i, 'otherSourceId': 'w'+str(o['id']), 'otherSegment': j, 'point': q, 'tags': o['tags']})
        supports = []
        for structure in structures:
            samples = []
            for i, (a, b) in enumerate(zip(points, points[1:])):
                length = math.dist(a, b)
                count = max(1, math.ceil(length/.5))
                nx, nz = -(b[1]-a[1])/length, (b[0]-a[0])/length
                for k in range(count+1):
                    t = k/count
                    for offset in [-1.2, 0, 1.2]:
                        q = [a[0]+(b[0]-a[0])*t+nx*offset, a[1]+(b[1]-a[1])*t+nz*offset]
                        samples.append({'segment': i, 't': t, 'offsetM': offset, 'point': q, 'inside': inside(q, structure['points'])})
            failures = [s for s in samples if not s['inside']]
            supports.append({'sourceStructureId': 'w'+str(structure['id']), 'sampleStepMaxM': .5, 'bodyHalfWidthM': 1.2,
                             'sampleCount': len(samples), 'insideCount': len(samples)-len(failures), 'outsideCount': len(failures),
                             'allSamplesContained': not failures, 'outsideSamples': failures if len(points) == 2 else failures[:3]})
        selected.append({**w, 'sourceId': 'w'+str(sid), 'points': points,
                         'lengthM': sum(math.dist(a,b) for a,b in zip(points,points[1:])), 'endpointConnections': connected,
                         'taggedNodes': [nodes[n] for n in w['nodeIds'] if n in nodes and nodes[n]['tags']],
                         'highwayGeometricCrossings': crossings, 'structureSupportSampling': supports,
                         'explicitMetricHeightTags': {k:v for k,v in w['tags'].items() if k in ('ele','height','min_height','incline','maxheight')}})
    all_points = [p for w in selected for p in w['points']]
    x0, z0 = (min(p[k] for p in all_points) for k in [0,1])
    x1, z1 = (max(p[k] for p in all_points) for k in [0,1])
    maxheights = [w for w in ways.values() if 'maxheight' in w['tags'] and any(x0 <= q[0] <= x1 and z0 <= q[1] <= z1 for q in geometry(w))]
    out = {'schema': 1, 'kind': 'source-only-research-not-native-runtime-acceptance',
           'sourceDataset': {'path': str(Path(args.dataset).resolve()), 'sha256': digest(args.dataset), 'proj': proj},
           'rawTilesSha256': tile_hashes, 'rawCounts': {'nodes':len(nodes), 'ways':len(ways), 'relations':len(relations)},
           'selectedWays': selected, 'structures': structures, 'bridgeRelationsInWholeCache': bridge_relations,
           'candidateStructureRoads': [{**source, 'datasetRoadIndex':int(ri)} for ri,source in data.get('roadSourceGeometry',{}).items()
                                      if source.get('tags',{}).get('name') in args.road_names],
           'maxheightWaysWithVertexInSelectedTrackBounds': maxheights,
           'selectedTrackBounds': [x0,z0,x1,z1],
           'limitations': ['Source XY only; no native world construction or browser test.',
                          'Sampled containment is a negative gate, not an exact continuous full-body support proof.',
                          'Geometric crossings create neither connectivity nor absolute elevations.',
                          'OSM layer/level express ordering, not metres.']}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'ways':len(selected), 'bridgeRelations':len(bridge_relations),
                      'crossingMetricMaxheight':sum('maxheight' in c['tags'] for w in selected for c in w['highwayGeometricCrossings']),
                      'support':[{ 'sourceId':w['sourceId'], 'lengthM': w['lengthM'], 'checks': [{k:v for k,v in s.items() if k!='outsideSamples'} for s in w['structureSupportSampling']]} for w in selected]}, indent=2))


if __name__ == '__main__':
    main()
