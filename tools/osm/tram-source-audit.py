#!/usr/bin/env python3
"""Independent cached-XML audit of metadata-only tram enrichment; no network/browser/data writes."""
from pathlib import Path
import argparse, collections, hashlib, json, math, subprocess, xml.etree.ElementTree as ET

FIELDS = {'tramSources', 'tramSourceWays', 'tramRoutes', 'tramSourceNodeTags'}
BASE = '8ccab8b8f2e207aed8ceaca7fd6485590f1c7be7'
sha = lambda b: hashlib.sha256(b).hexdigest()

def tram_way(tags):
    status = tags.get('railway')
    return status == 'tram' or (status in {'construction', 'disused', 'abandoned', 'proposed', 'razed'} and 'tram' in (tags.get(status), tags.get(status + ':railway')))

def raw_xml(directory):
    nodes, ways, relations, ledger, conflicts = {}, {}, {}, [], []
    files = sorted(Path(directory).glob('*.xml'))
    assert files, 'No cached XML'
    for file in files:
        data = file.read_bytes(); ledger.append({'file': str(file), 'bytes': len(data), 'sha256': sha(data)})
        for _event, e in ET.iterparse(file, events=('end',)):
            if e.tag not in ('node', 'way', 'relation'): continue
            i = int(e.attrib['id']); tags = {v.attrib['k']: v.attrib['v'] for v in e.findall('tag')}
            if e.tag == 'node': record = {'ll': [float(e.attrib.get('lat', 'nan')), float(e.attrib.get('lon', 'nan'))], 'tags': tags}; target = nodes
            elif e.tag == 'way': record = {'nodeIds': [int(v.attrib['ref']) for v in e.findall('nd')], 'tags': tags}; target = ways
            else: record = {'members': [{'type': v.attrib['type'], 'ref': int(v.attrib['ref']), 'role': v.attrib.get('role', '')} for v in e.findall('member')], 'tags': tags}; target = relations
            if i not in target: target[i] = record
            elif target[i] != record: conflicts.append({'type': e.tag, 'id': i, 'laterFile': str(file)})
            e.clear()
    return nodes, ways, relations, ledger, conflicts

def projected(ll, p):
    lat, lon = ll; dlat = lat - p['lat0']
    if p.get('compress') and lat > p['compress']['above']:
        dlat = p['compress']['above'] - p['lat0'] + (lat - p['compress']['above']) * p['compress']['factor']
    return [(lon - p['lon0']) * p['mPerLon'] * p['scale'], -dlat * p['mPerLat'] * p['scale']]

def delta(points, q):
    out, previous = [], [0, 0]
    for i, point in enumerate(points):
        point = [math.floor(v * q + .5) for v in point]
        out.extend(point if not i else [point[0] - previous[0], point[1] - previous[1]]); previous = point
    return out

def decoded(line):
    points, x, z = [], 0, 0
    for i in range(0, len(line), 2): x += line[i]; z += line[i + 1]; points.append([x, z])
    return points

def audit(data_file, osm_dir, repo):
    name = str(Path(data_file).relative_to(repo)); old_bytes = subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=repo)
    new_bytes = Path(data_file).read_bytes(); old, doc = json.loads(old_bytes), json.loads(new_bytes)
    assert set(doc) - set(old) == FIELDS and set(old) - set(doc) == set()
    without_metadata = {k: v for k, v in doc.items() if k not in FIELDS}; assert without_metadata == old
    assert new_bytes.startswith(old_bytes[:old_bytes.rstrip().rfind(b'}')]), 'Old serialized prefix changed'
    assert doc['generated'] == old['generated'] and doc['trams'] == old['trams']
    nodes, ways, relations, ledger, conflicts = raw_xml(osm_dir)
    assert len(doc['tramSources']) == len(doc['trams'])
    largest_error, render_sources = 0., []
    for line, source in zip(doc['trams'], doc['tramSources']):
        assert set(source) == {'sourceId', 'nodeIds', 'tags'}
        way = ways[int(source['sourceId'][1:])]; assert source['tags'] == way['tags']
        expected = decoded(line); assert len(expected) == len(source['nodeIds'])
        ids = [i for i in way['nodeIds'] if i in nodes and all(math.isfinite(v) for v in nodes[i]['ll'])]
        count = len(source['nodeIds'])
        assert any(ids[start:start + count] == source['nodeIds'] for start in range(len(ids) - count + 1)) or any(list(reversed(ids))[start:start + count] == source['nodeIds'] for start in range(len(ids) - count + 1)), 'Clipped IDs not an ordered original-way subsequence'
        for point, node in zip(expected, source['nodeIds']):
            p = projected(nodes[node]['ll'], doc['proj']); quantized = [math.floor(v * doc['q'] + .5) for v in p]
            assert point == quantized, (source['sourceId'], node, point, quantized)
            largest_error = max(largest_error, math.dist([v / doc['q'] for v in point], p))
        render_sources.append(source['sourceId'])
    selected = {int(s[1:]) for s in render_sources}; incident = collections.defaultdict(set)
    for i, way in ways.items():
        if tram_way(way['tags']):
            for n in way['nodeIds']: incident[n].add(i)
    pending = list(selected)
    while pending:
        i = pending.pop()
        for n in ways[i]['nodeIds']:
            for other in incident[n] - selected: selected.add(other); pending.append(other)
    assert {int(w['sourceId'][1:]) for w in doc['tramSourceWays']} == selected
    selected_nodes, missing_nodes = set(), []
    for full in doc['tramSourceWays']:
        raw = ways[int(full['sourceId'][1:])]; assert full['nodeIds'] == raw['nodeIds'] and full['tags'] == raw['tags']; selected_nodes.update(raw['nodeIds'])
        missing = [n for n in raw['nodeIds'] if n not in nodes or not all(math.isfinite(v) for v in nodes[n]['ll'])]
        if missing: assert full['points'] is None and full['missingNodeIds'] == missing; missing_nodes.append(full['sourceId'])
        else: assert full['points'] == delta([projected(nodes[n]['ll'], doc['proj']) for n in raw['nodeIds']], doc['q'])
        assert not (set(full) - {'sourceId', 'nodeIds', 'tags', 'points', 'missingNodeIds'}), 'Unexpected model-height or synthesized source fields'
    tram_relations = {i: r for i, r in relations.items() if r['tags'].get('route') == 'tram' or r['tags'].get('route_master') == 'tram'}
    selected_relations = {i for i, r in tram_relations.items() if any(m['type'] == 'way' and m['ref'] in selected for m in r['members'])}
    changed = True
    while changed:
        more = {i for i, r in tram_relations.items() if any(m['type'] == 'relation' and m['ref'] in selected_relations for m in r['members'])}
        changed = not more.issubset(selected_relations); selected_relations.update(more)
    assert {int(r['sourceId'][1:]) for r in doc['tramRoutes']} == selected_relations
    notes = []
    for route in doc['tramRoutes']:
        raw = tram_relations[int(route['sourceId'][1:])]; assert route['tags'] == raw['tags'] and route['members'] == raw['members']
        missing = list(dict.fromkeys(m['ref'] for m in raw['members'] if m['type'] == 'way' and m['ref'] not in selected)); assert route.get('missingWayIds', []) == missing
        selected_nodes.update(m['ref'] for m in raw['members'] if m['type'] == 'node')
        if any(k in raw['tags'] for k in ('note', 'description', 'state', 'status')): notes.append({'sourceId': route['sourceId'], 'ref': route['tags'].get('ref'), 'tags': {k: v for k, v in raw['tags'].items() if k in ('note', 'description', 'state', 'status')}})
    tagged = {str(n): nodes[n]['tags'] for n in selected_nodes if n in nodes and nodes[n]['tags']}
    assert doc['tramSourceNodeTags'] == tagged
    for source in ledger: assert sha(Path(source['file']).read_bytes()) == source['sha256'], 'Raw cache changed during independent audit'
    selected_conflicts = [c for c in conflicts if (c['type'] == 'way' and c['id'] in selected) or (c['type'] == 'node' and c['id'] in selected_nodes) or (c['type'] == 'relation' and c['id'] in selected_relations)]
    return {'data': name, 'baseCommit': BASE, 'beforeSha256': sha(old_bytes), 'afterSha256': sha(new_bytes), 'allOldFieldsAndSerializedPrefixUnchanged': True, 'generatedUnchanged': True, 'tramsSha256': sha(json.dumps(old['trams'], separators=(',', ':')).encode()), 'renderRuns': len(doc['trams']), 'completeWays': len(selected), 'routes': len(selected_relations), 'taggedNodes': len(tagged), 'maxRenderQuantizationErrorM': largest_error, 'missingCoordinateWays': missing_nodes, 'routeStatusNotesPreserved': notes, 'selectedRawDuplicateConflicts': selected_conflicts, 'renderSources': render_sources, 'ledger': ledger, 'pass': not selected_conflicts}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--data', required=True); parser.add_argument('--osm', required=True); parser.add_argument('--report', required=True); args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]; report = audit(Path(args.data).resolve(), args.osm, repo); report['auditToolSha256'] = sha(Path(__file__).read_bytes())
    out = Path(args.report); out.parent.mkdir(parents=True, exist_ok=True); out.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('data', 'renderRuns', 'completeWays', 'routes', 'taggedNodes', 'maxRenderQuantizationErrorM', 'allOldFieldsAndSerializedPrefixUnchanged', 'selectedRawDuplicateConflicts', 'pass')}))
    assert report['pass'], 'Selected cached source versions conflict; retain report and resolve source provenance explicitly'

if __name__ == '__main__': main()
