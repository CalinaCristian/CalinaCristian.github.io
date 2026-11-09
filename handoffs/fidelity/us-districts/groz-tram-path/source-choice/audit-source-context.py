#!/usr/bin/env python3
"""Read-only, cached-source audit. No network, renderer, or dataset writes."""
import argparse, hashlib, json, math, pathlib, xml.etree.ElementTree as ET

p = argparse.ArgumentParser()
p.add_argument('--data', required=True)
p.add_argument('--support', required=True)
p.add_argument('--raw', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
sha = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
D = json.load(open(a.data))
S = json.load(open(a.support))
osm = ET.parse(a.raw).getroot()
tags = lambda e: {t.attrib['k']: t.attrib['v'] for t in e.findall('tag')}
nodes = {int(n.attrib['id']): {'lat': float(n.attrib['lat']), 'lon': float(n.attrib['lon']), 'tags': tags(n)} for n in osm.findall('node')}
ways = {int(w.attrib['id']): {'sourceId': 'w' + w.attrib['id'], 'nodeIds': [int(n.attrib['ref']) for n in w.findall('nd')], 'tags': tags(w)} for w in osm.findall('way')}
proj = D['proj']
def xy(n):
    q = nodes[n]
    return [(q['lon'] - proj['lon0']) * proj['mPerLon'], (proj['lat0'] - q['lat']) * proj['mPerLat']]
def unit(a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    return [dx / length, dz / length]
foot = ways[665913378]
rail_nodes = [6234008736, 6234008735]
road_node = 6234008741
native_edges = [e for e in S['allEdges'] if road_node in [e['a'].get('sourceId'), e['b'].get('sourceId')]]
native_node = next(n for e in native_edges for n in [e['a'], e['b']] if n.get('sourceId') == road_node)
motor_incoming = []
for e in native_edges:
    if e['b'].get('sourceId') == road_node and e['lanesF']:
        motor_incoming.append({'edgeId': e['id'], 'sourceId': e.get('sourceId'), 'dir': 1, 'unit': [e['dirx'], e['dirz']], 'sourceNodeIds': e['sourceNodeIds']})
    if e['a'].get('sourceId') == road_node and e['lanesB']:
        motor_incoming.append({'edgeId': e['id'], 'sourceId': e.get('sourceId'), 'dir': -1, 'unit': [-e['dirx'], -e['dirz']], 'sourceNodeIds': e['sourceNodeIds']})
incidences = []
for rail_node in rail_nodes:
    for w in ways.values():
        if w['tags'].get('railway') != 'tram' or rail_node not in w['nodeIds']:
            continue
        i = w['nodeIds'].index(rail_node)
        directions = [1] if w['tags'].get('oneway') == 'yes' else [-1] if w['tags'].get('oneway') == '-1' else []
        for direction in directions:
            prev = i - direction
            if not 0 <= prev < len(w['nodeIds']):
                continue
            u = unit(xy(w['nodeIds'][prev]), xy(rail_node))
            matches = [{'motorEdgeId': m['edgeId'], 'dot': sum(x*y for x,y in zip(u,m['unit'])), 'axisAngleDeg': math.degrees(math.acos(min(1, abs(sum(x*y for x,y in zip(u,m['unit']))))))} for m in motor_incoming]
            incidences.append({'railNodeId': rail_node, 'sourceId': w['sourceId'], 'sourceTags': w['tags'], 'sourceNodeIds': [w['nodeIds'][prev], rail_node], 'dir': direction, 'incomingUnit': u, 'motorAxisComparisons': matches})
result = {
    'scope': 'Cached literal source incidence and native6cb/world8cc road approach audit, no browser or production writes; parallel axis permits a shared synthetic game phase only, not measured real-world phase timing.',
    'inputs': [{'path': a.data, 'sha256': sha(a.data)}, {'path': a.support, 'sha256': sha(a.support), 'sourceCommit': S['sourceCommit']}, {'path': a.raw, 'sha256': sha(a.raw)}],
    'crossingFootway': {**foot, 'points': [xy(n) for n in foot['nodeIds']], 'nodeTags': {str(n): nodes[n]['tags'] for n in foot['nodeIds']}},
    'railNodeIds': rail_nodes,
    'roadIncidences': [{'nodeId': road_node, 'sourceId': 'w106797416', 'nativeNodeId': native_node['id']}],
    'rawRoadWay': ways[106797416],
    'nativeRoadNode': native_node,
    'nativeIncomingMotorApproaches': motor_incoming,
    'incomingRailApproaches': incidences,
    'neighborCrossingNotFloodMerged': ways[665913379],
    'controllerFinding': {'bit8Retained': bool(native_node['flags'] & 8), 'signal': native_node.get('signal'), 'hasLight': native_node['hasLight'], 'railControllerCurrentlyLinked': False, 'noNearestLightOrProximityJoin': True},
    'proposedField': 'tramSourceCrossings: [{sourceId,nodeIds,tags,points:q10_delta,nodeTags,railNodeIds,roadIncidences:[{nodeId,sourceId}]}]',
    'unknowns': ['Actual real signal phases and timings are not encoded by this source.', 'Current raw tags do not specify a separate tram signal indication or priority request phase.']
}
pathlib.Path(a.out).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'output': a.out, 'nativeNodeId': native_node['id'], 'nativeFlags': native_node['flags'], 'parallelAxesDeg': [[q['axisAngleDeg'] for q in r['motorAxisComparisons']] for r in incidences], 'sourceFootway': foot['sourceId']}))
