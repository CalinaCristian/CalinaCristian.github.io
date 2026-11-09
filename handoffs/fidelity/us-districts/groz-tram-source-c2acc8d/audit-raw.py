"""Read-only cached OSM/native tram alignment audit. No network/browser/source writes."""
from pathlib import Path
import json,sys,math,hashlib,xml.etree.ElementTree as ET,collections
tiles,fixture,source,out=map(Path,sys.argv[1:5]);out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
F=json.loads(fixture.read_bytes());D=json.loads((source/'game/data/bucharest-grozavesti.json').read_bytes());P=D['proj'];assert P['scale']==1 and P['compress']is None
N={};W={};R={};locations=collections.defaultdict(list);conflicts=[];ledger=[]
for p in sorted(tiles.glob('*.xml')):
    raw=p.read_bytes();ledger.append({'name':p.name,'bytes':len(raw),'sha256':sha(raw)});root=ET.fromstring(raw)
    for e in root:
        kind=e.tag
        if kind not in ('node','way','relation'):continue
        id=int(e.attrib['id']);tags={t.attrib['k']:t.attrib['v']for t in e.findall('tag')};record={'id':id,'tags':tags,'metadata':dict(e.attrib)}
        if kind=='node':record.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
        elif kind=='way':record['nodeIds']=[int(t.attrib['ref'])for t in e.findall('nd')]
        else:record['members']=[dict(t.attrib)for t in e.findall('member')]
        dst={'node':N,'way':W,'relation':R}[kind]
        if id in dst and dst[id]!=record:conflicts.append({'kind':kind,'id':id,'tiles':locations[kind,id]+[p.name]})
        dst[id]=record;locations[kind,id].append(p.name)
def xy(n):return[(n['lon']-P['lon0'])*P['mPerLon'],(P['lat0']-n['lat'])*P['mPerLat']]
def way(w):
    return w|{'points':[xy(N[n])for n in w['nodeIds']if n in N],'missingNodeIds':[n for n in w['nodeIds']if n not in N],'tiles':locations['way',w['id']]}
rails=[way(w)for w in W.values()if w['tags'].get('railway')=='tram'];roads=[way(W[id])for id in (80013062,277315765)]
def nearest(p,pl):
    best=None
    for i,(a,b)in enumerate(zip(pl,pl[1:])):
        dx=b[0]-a[0];dz=b[1]-a[1];l2=dx*dx+dz*dz
        if not l2:continue
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2));q=[a[0]+t*dx,a[1]+t*dz];d=math.dist(p,q);L=math.sqrt(l2)
        if best is None or d<best['distance']:best={'distance':d,'point':q,'segmentIndex':i,'segmentT':t,'tangent':[dx/L,dz/L]}
    return best
actors=[v for v in F['bodies']if v.get('tram')];selected=set();metrics=[]
for v in actors:
    fx=-math.sin(v['heading']);fz=-math.cos(v['heading']);rx=-fz;rz=fx;center=[v['x'],v['z']];rank=[]
    for w in rails:
        n=nearest(center,w['points'])
        if n:rank.append({'wayId':w['id'],'tags':w['tags'],**n,'headingDot':n['tangent'][0]*fx+n['tangent'][1]*fz})
    rank.sort(key=lambda q:q['distance']);selected.update(q['wayId']for q in rank[:4]);line=[]
    for j in range(25):
        s=-v['length']/2+j*v['length']/24;p=[center[0]+fx*s,center[1]+fz*s];near=min(({'wayId':w['id'],**nearest(p,w['points'])}for w in rails if len(w['points'])>=2),key=lambda q:q['distance']);line.append({'bodyStationM':s,'point':p,'nearestRail':near})
    corners=[[center[0]+fx*s+rx*l,center[1]+fz*s+rz*l]for s,l in[(-v['length']/2,-v['width']/2),(-v['length']/2,v['width']/2),(v['length']/2,v['width']/2),(v['length']/2,-v['width']/2)]]
    metrics.append({'id':v['id'],'kind':v['kind'],'nativeMotorEdge':v['edge']['id'],'nativeRoadSource':v['edge']['sourceId'],'nativeDir':v['dir'],'lengthM':v['length'],'widthM':v['width'],'center':center,'bodyForward':[fx,fz],'nativeY':v['y'],'nativeVerticalInterval':v['verticalInterval'],'nearestRailsAtCenter':rank[:4],'centerlineSamples':line,'minimumNearestRailDistanceM':min(q['nearestRail']['distance']for q in line),'maximumNearestRailDistanceM':max(q['nearestRail']['distance']for q in line),'bodyCorners':corners})
selectedRails=[w for w in rails if w['id']in selected];relations=[]
for r in R.values():
    members=[(i,m)for i,m in enumerate(r['members'])if m['type']=='way'and int(m['ref'])in selected]
    if members:relations.append(r|{'selectedRailMembers':[{'index':i,**m}for i,m in members],'tiles':locations['relation',r['id']]})
result={'sourceCommit':'c2acc8d59cab1ca5f8da4f1f44bbdc5706f56f76','fixturePath':str(fixture),'fixtureBytes':fixture.stat().st_size,'fixtureSha256':sha(fixture.read_bytes()),'dataSha256':sha((source/'game/data/bucharest-grozavesti.json').read_bytes()),'projection':P,'tileLedger':ledger,'rawCounts':{'nodes':len(N),'ways':len(W),'relations':len(R),'tramWays':len(rails)},'duplicateObjectConflicts':conflicts,'motorRoads':roads,'nativeActors':actors,'actorAlignment':metrics,'selectedTramWays':selectedRails,'relations':relations,'scope':'Source-only XY centerline/body audit. OSM gauge is distance between rails, not track-bed/body width. Native Y is recorded, source absolute rail/deck elevations may be unmeasured. Direction inference must use actual way tags/route order, not motor-road oneway or node order alone.'}
(out/'raw-audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');(out/'all-tram-source-ways.json').write_text(json.dumps(rails,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'rawCounts':result['rawCounts'],'conflicts':len(conflicts),'actors':[{'id':q['id'],'nearest':[(a['wayId'],round(a['distance'],3),round(a['headingDot'],4))for a in q['nearestRailsAtCenter'][:3]],'bodyMinM':q['minimumNearestRailDistanceM'],'bodyMaxM':q['maximumNearestRailDistanceM']}for q in metrics],'selectedRails':[(w['id'],w['tags'])for w in selectedRails],'relations':[(r['id'],r['tags'],r['selectedRailMembers'])for r in relations]},indent=2,ensure_ascii=False))
