#!/usr/bin/env python3
"""A missing source must not be 'found' in a neighbouring real building."""
import json
from pathlib import Path
import subprocess
import tempfile
import importlib.util
import math

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('audit', ROOT / 'tools/osm/building-audit.py')
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)
for value, expected in [('5 ft',1.524),("5' 10\"",1.778),('90cm',.9),('18mm',.018),('12 inches',.3048),('12-15m',None),('3;4',None),('unknown',None),(0,0)]:
    actual = audit_module.measure(value)
    assert actual is None if expected is None else math.isclose(actual, expected, abs_tol=1e-10), f'strict source units: {value}'
assert audit_module.source_ring_issue([(0,0),(4,4),(0,4),(3,0)]) == 'self-intersecting-source-ring'
assert audit_module.source_ring_issue([(0,0),(2,0),(1,0),(1,1),(0,1)]) == 'self-intersecting-source-ring'
assert audit_module.source_ring_issue([(0,0),(.04,0),(.04,1),(0,1)]) is None
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    # Metres use a synthetic uncompressed projection, avoiding geodetic rounding.
    data = {'version': 2, 'strings': [], 'proj': {'lat0': 0, 'lon0': 0, 'mPerLat': 1, 'mPerLon': 1, 'scale': 1},
            'roofs': ['flat'], 'buildings': [[0,18,0,0,-1,0,0,-1,-1,0,0,20,0,0,10,-20,0]],
            'buildingRoofProfiles': {'0': {'eavesM': 1.2, 'totalM': 1.8}}, 'buildingIds': ['w2'], 'buildingInfo': [-1,0,-1,-1,0], 'district': {
                'mask': {'w': 1, 'h': 1, 'cell': 20, 'x0': -10, 'z0': -10, 'rle': [0,1]},
                'geometry': {'circles': [{'x': 0, 'z': 0, 'r': 10}]}}}
    (tmp / 'district.json').write_text(json.dumps(data))
    (tmp / 'source.xml').write_text('''<osm version="0.6">
      <node id="1" lat="0" lon="0"/><node id="2" lat="0" lon="2"/>
      <node id="3" lat="-1" lon="2"/><node id="4" lat="-1" lon="0"/>
      <way id="1"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="yes"/></way>
      <way id="2"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="yes"/><tag k="height" v="1.8"/></way>
      <way id="3"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building:part" v="yes"/><tag k="height" v="0.2"/></way>
      <way id="4"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
    </osm>''')
    def audit():
        subprocess.run(['python3', '-I', str(ROOT / 'tools/osm/building-audit.py'), '--data', str(tmp / 'district.json'), '--osm', str(tmp / 'source.xml'), '--out', str(tmp / 'audit')], check=True, stdout=subprocess.DEVNULL)
        return {r['osm']: r for r in json.loads((tmp / 'audit.json').read_text())}
    rows = audit()
    assert set(rows) == {'w1', 'w2', 'w3'}, 'small buildings and an untyped part are audited; unclosed geometry is explicit'
    assert not rows['w1']['identityPresent'] and 'game' not in rows['w1'], 'an identical neighbouring building cannot replace a missing ID'
    assert rows['w2']['identityPresent'] and rows['w2']['topologyMatches'] and rows['w2']['literalHeightMatches']
    assert rows['w2']['hGame'] == 1.8 and rows['w2']['hEavesGame'] == 1.2, 'literal source height remains total while levels estimates compare the effective wall/eaves band'
    assert not rows['w3']['identityPresent'], 'the missing sub-metre part remains a missing source'
    assert json.loads((tmp / 'audit-source-skips.json').read_text()) == [{'osm': 'w4', 'reason': 'unclosed-or-incomplete-source-way'}]
    data['buildingFootprints'] = {'0': [[.3,0],[2.3,0],[2.3,1],[.3,1]]}
    (tmp / 'district.json').write_text(json.dumps(data))
    assert not audit()['w2']['topologyMatches'], 'a matching ID cannot hide moved geometry'
print('identity audit: small source, mapped part, missing ID, wrong geometry and explicit invalid-source controls passed')
