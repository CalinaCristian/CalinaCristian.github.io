#!/usr/bin/env python3
"""Independent ElementTree audit of literal context IDs, tags and source order."""
import sys, json, pathlib, hashlib, math
import xml.etree.ElementTree as ET
tiles, prepared, output = map(pathlib.Path, sys.argv[1:4])
nodes, ways, relations, conflicts, ledger = {}, {}, {}, [], []
for file in sorted(list(tiles.glob('*.xml')) + list(tiles.glob('*.osm'))):
    ledger.append({'file':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    for event, el in ET.iterparse(file, events=['end']):
        if el.tag not in ('node','way','relation'): continue
        identity=int(el.attrib['id']); tags={t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}
        if el.tag=='node': target=nodes; value={'lat':float(el.attrib['lat']),'lon':float(el.attrib['lon']),'tags':tags}
        elif el.tag=='way': target=ways; value={'nodes':[int(n.attrib['ref']) for n in el.findall('nd')],'tags':tags}
        else: target=relations; value={'members':[[m.attrib['type'],int(m.attrib['ref']),m.attrib.get('role','')] for m in el.findall('member')],'tags':tags}
        if identity in target and target[identity]!=value: conflicts.append({'type':el.tag,'id':identity,'file':file.name})
        else: target[identity]=value
        el.clear()
data=json.loads(prepared.read_bytes()); failures=[]; count=0
for i in range(0,len(data['nodes']),3):
    identity,lat,lon=data['nodes'][i:i+3]; n=nodes.get(identity)
    if not n or [math.floor(n['lat']*1e7+.5),math.floor(n['lon']*1e7+.5)]!=[lat,lon]: failures.append({'id':identity,'reason':'node-coordinate'})
for key in ('buildings','ways','areas','coastlines'):
    for r in data[key]:
        count+=1; source=r.get('sourceId',r['id']).split(':')[0]; tags=data['tags'][r['t']]
        if source.startswith('w'):
            w=ways.get(int(source[1:])); refs=[data['nodes'][i*3] for i in r['n']]
            if not w or w['nodes']!=refs or w['tags']!=tags: failures.append({'id':r['id'],'reason':'literal-way-order-or-tags'})
        else:
            rel=relations.get(int(source[1:]));
            if not rel or rel['tags']!=tags: failures.append({'id':r['id'],'reason':'literal-relation-tags'})
            edges=set()
            for typ,ref,role in rel['members']:
                if typ=='way' and ref in ways:
                    for a,b in zip(ways[ref]['nodes'],ways[ref]['nodes'][1:]): edges.add(tuple(sorted((a,b))))
            for ring in [r['n']]+r.get('holes',[]):
                refs=[data['nodes'][i*3] for i in ring]
                for a,b in zip(refs,refs[1:]):
                    if tuple(sorted((a,b))) not in edges: failures.append({'id':r['id'],'reason':'invented-relation-edge','nodes':[a,b]})
for r in data['relations']:
    rel=relations.get(int(r['id'][1:]))
    if not rel or rel['members']!=r['members'] or rel['tags']!=data['tags'][r['t']]: failures.append({'id':r['id'],'reason':'ordered-relation-members-or-tags'})
for r in data['trees']:
    identity=data['nodes'][r['n']*3]; n=nodes.get(identity)
    if r['id']!='n'+str(identity) or not n or n['tags']!=data['tags'][r['t']]: failures.append({'id':r['id'],'reason':'tree-identity-or-tags'})
result={'preparedSHA256':hashlib.sha256(prepared.read_bytes()).hexdigest(),'independentParser':'Python ElementTree; no production parser/decoder import','rawInputs':ledger,'rawCounts':{'nodes':len(nodes),'ways':len(ways),'relations':len(relations)},'rawConflicts':conflicts,'literalGeometryRecordsChecked':count,'retainedNodesChecked':len(data['nodes'])//3,'relationMemberListsChecked':len(data['relations']),'treesChecked':len(data['trees']),'failures':failures,'unresolvedSourceClosure':data['unresolvedSourceClosure']}
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('rawInputs','unresolvedSourceClosure')},separators=(',',':')))
if failures or conflicts: sys.exit(1)
