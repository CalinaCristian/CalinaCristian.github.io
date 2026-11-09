#!/usr/bin/env python3
"""Independent ElementTree/source-incidence audit; cached XML only, no browser."""
import hashlib, json, math, pathlib, subprocess, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[3]
CACHES = {'grozavesti': 'grozavesti/tiles', 'pipera': 'pipera/tiles', 'romana': 'romana/tiles', 'unirii': 'original-districts-refresh/tiles'}
sha = lambda b: hashlib.sha256(b).hexdigest()
report = {'passed': False, 'base': '81c78e35167ef871d8e48f49be8e29118a1a2ec2', 'networkUsed': False, 'browserOpened': False, 'districts': []}
for name, cache in CACHES.items():
    rel = f'game/data/bucharest-{name}.json'
    before = subprocess.check_output(['git', 'show', f'81c78e35:{rel}'], cwd=ROOT)
    current = (ROOT / rel).read_bytes(); doc = json.loads(current); prior = json.loads(before)
    stripped = {k: v for k, v in doc.items() if k != 'tramSourceCrossings'}
    assert stripped == prior and current.startswith(before[:before.rfind(b'}')]), name + ': pre-existing bytes/values changed'
    files = sorted(pathlib.Path('/workspace/reality-pass', cache).glob('*.xml'))
    nodes, tags, ways, ledger = {}, {}, {}, []
    for file in files:
        raw = file.read_bytes(); ledger.append({'path': str(file), 'sha256': sha(raw), 'bytes': len(raw)})
        for _, elem in ET.iterparse(file, events=('end',)):
            if elem.tag not in ('node', 'way', 'relation'): continue
            key = int(elem.attrib['id'])
            rawtags = {t.attrib['k']: t.attrib['v'] for t in elem.findall('tag')}
            if elem.tag == 'node':
                nodes.setdefault(key, [float(elem.attrib['lat']), float(elem.attrib['lon'])])
                if rawtags: tags.setdefault(key, rawtags)
            elif elem.tag == 'way':
                ways.setdefault(key, {'nodeIds': [int(n.attrib['ref']) for n in elem.findall('nd')], 'tags': rawtags})
            elem.clear()
    rail = {n for r in doc['tramSources'] for n in r['nodeIds']}
    candidates = [(wid, w) for wid, w in ways.items() if (w['tags'].get('highway') == 'footway' or w['tags'].get('footway') == 'crossing') and rail.intersection(w['nodeIds'])]
    candidate_nodes = {n for _, w in candidates for n in w['nodeIds']}
    road_by_node, ignored = {}, []
    for index, geom in doc['roadSourceGeometry'].items():
        prepared = {doc['roadNodeIds'][n] for n in doc['roads'][int(index)][10:]}
        if not (set(geom['nodeIds']) & prepared & candidate_nodes):
            if int(geom['sourceId'][1:]) not in ways: ignored.append(geom['sourceId'])
            continue
        raw = ways[int(geom['sourceId'][1:])]
        for n in prepared.intersection(raw['nodeIds']):
            if geom['sourceId'] not in road_by_node.setdefault(n, []): road_by_node[n].append(geom['sourceId'])
    p, q = doc['proj'], doc['q']
    def project(lat, lon):
        delta = lat - p['lat0']; compress = p.get('compress')
        if compress and lat > compress['above']: delta = compress['above'] - p['lat0'] + (lat - compress['above']) * compress['factor']
        return [math.floor((lon - p['lon0']) * p['mPerLon'] * p['scale'] * q + .5), math.floor(-delta * p['mPerLat'] * p['scale'] * q + .5)]
    expected = []
    for wid, w in candidates:
        refs = w['nodeIds']; rids = [n for n in refs if n in rail]
        incidence = [{'nodeId': n, 'sourceId': s} for n in refs for s in road_by_node.get(n, [])]
        if not incidence: continue
        missing = [n for n in refs if n not in nodes]
        points = None
        if not missing:
            points, previous = [], [0, 0]
            for n in refs:
                position = project(*nodes[n]); points.extend([position[0] - previous[0], position[1] - previous[1]]); previous = position
        item = {'sourceId': f'w{wid}', 'nodeIds': refs, 'tags': w['tags'], 'points': points, 'nodeTags': {str(n): tags.get(n, {}) for n in refs}, 'railNodeIds': rids, 'roadIncidences': incidence}
        if missing: item['missingNodeIds'] = missing
        expected.append(item)
    expected.sort(key=lambda c: int(c['sourceId'][1:]))
    assert expected == doc['tramSourceCrossings'], name + ': literal context/selection differs from independent cached source'
    for entry in ledger: assert sha(pathlib.Path(entry['path']).read_bytes()) == entry['sha256']
    report['districts'].append({'district': name, 'beforeSha256': sha(before), 'afterSha256': sha(current), 'allExistingValuesAndPrefixBytesUnchanged': True, 'generated': prior['generated'], 'preExistingRailFieldHashes': {k: sha(json.dumps(prior[k], separators=(',', ':'), ensure_ascii=False).encode()) for k in ['tramSources', 'tramSourceWays', 'tramRoutes', 'tramSourceNodeTags', 'trams']}, 'crossingWays': len(expected), 'crossingSourceIds': [c['sourceId'] for c in expected], 'missingNodeWays': [c['sourceId'] for c in expected if c.get('missingNodeIds')], 'uncachedUnrelatedPreparedRoadsIgnored': sorted(set(ignored)), 'ledger': ledger})
    print(name, 'PASS', len(expected), 'literal source ways; unchanged existing bytes/fields/date')
report['passed'] = True
(ROOT / 'handoffs/fidelity/source-controlled-crossing/independent-metadata-audit.json').write_text(json.dumps(report, indent=2) + '\n')
