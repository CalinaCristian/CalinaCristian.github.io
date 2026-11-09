import pathlib,json,subprocess,hashlib,math
repo=pathlib.Path(__file__).resolve().parents[3]
path=repo/'game/research/cv-window-bindings.json';d=json.loads(path.read_text());checks=[]
def check(condition,label):
 assert condition,label
 checks.append(label)
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(value):return sha(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode())
cache={}
for p,expected in d['sourceInputs'].items():
 raw=subprocess.check_output(['git','show',expected['commit']+':'+p],cwd=repo)
 assert sha(raw)==expected['sha256'] and len(raw)==expected['bytes'],p
 assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=repo,text=False).decode().strip()==expected['gitBlob'],p
 if p.startswith('game/data/'):cache[p]=json.loads(raw)
check(len(d['sourceInputs'])==14,'all14source inputs exactly match retained Git blobs/bytes/SHA256; no source snapshot required')
check(sorted(r['id'] for r in d['rooms'])==sorted(['upb','luxoft','uipath-buc','arnia','gts','rosetti','db','uipath-bel']),'exactly all8legacy CV room IDs retain geographic bindings')
parts=edges=courtyard_edges=0
for r in d['rooms']:
 check(all(r['actualRoom'][k] is None for k in ['numberedFloor','floorBaseWorldY','windowOutwardBearingDegrees','sourceId','facadeEdgeIndex','sourceApertureWorldCorners']) and r['fallbackSelection'] is None,r['id']+': no invented room floor/bearing/aperture or automatic fallback')
 src=cache[r['districtSource']['path']];p=src['proj'];a=r['anchor'];x,z=a['districtXZ']
 assert abs((p['lat0']-z/(p['mPerLat']*p.get('scale',1)))-a['lat'])<1e-11
 assert abs((p['lon0']+x/(p['mPerLon']*p.get('scale',1)))-a['lon'])<1e-11
 assert r['districtSource']['groundDatumY'] is None and p.get('scale',1)==1
 for b in r['bindings']:
  i=b['districtBuildingIndex'];ring=src['buildingFootprints'][str(i)];assert src['buildingIds'][i]==b['sourceId']
  assert ring==b['outerRingXZ'] and digest(ring)==b['outerRingSHA256']
  assert src.get('buildingHoleFootprints',{}).get(str(i),[])==b['holeRingsXZ']
  points=ring[:-1] if ring[0]==ring[-1] else ring
  expected=[j for j,a in enumerate(points) if math.dist(a,points[(j+1)%len(points)])>=1e-8]
  assert [e['edgeIndex'] for e in b['facadeEdgeCandidates']]==expected
  area=sum(a[0]*points[(j+1)%len(points)][1]-points[(j+1)%len(points)][0]*a[1] for j,a in enumerate(points))/2
  assert abs(area-b['signedAreaM2'])<1e-7 and b['selectedFacadeEdge'] is None
  for e in b['facadeEdgeCandidates']:
   j=e['edgeIndex'];a=points[j];c=points[(j+1)%len(points)];assert e['aXZ']==a and e['bXZ']==c
   dx,dz=c[0]-a[0],c[1]-a[1];nx,nz=e['outwardXZ'];assert abs(math.hypot(nx,nz)-1)<1e-10
   assert abs(dx*nx+dz*nz)<1e-7
   assert (dx*nz-dz*nx)*area<0
   assert abs((math.degrees(math.atan2(nx,-nz))%360)-e['outwardCompassBearingDegrees'])<1e-7
  for hi,h in enumerate(b['holeRingsXZ']):
   hp=h[:-1] if h[0]==h[-1] else h;ha=sum(a[0]*hp[(j+1)%len(hp)][1]-hp[(j+1)%len(hp)][0]*a[1] for j,a in enumerate(hp))/2
   he=[e for e in b['courtyardFacadeEdgeCandidates'] if e['holeIndex']==hi];assert len(he)==len(hp)
   for e in he:
    j=e['edgeIndex'];a=hp[j];c=hp[(j+1)%len(hp)];nx,nz=e['outwardXZ'];dx,dz=c[0]-a[0],c[1]-a[1]
    assert e['aXZ']==a and e['bXZ']==c and abs(math.hypot(nx,nz)-1)<1e-10 and abs(dx*nx+dz*nz)<1e-7 and (dx*nz-dz*nx)*ha>0
    courtyard_edges+=1
  parts+=1;edges+=len(expected)
check(parts==15 and edges==163,'all15native source parts preserve exact outer/hole rings and all163nonzero facade edges, including short edges')
check(courtyard_edges==4,'all4retained Hermes courtyard facade edges preserve geometry and face the source void, not into solid building')
check(True,'all8anchor projection/inverse controls preserve source metre scale; no worldY inferred from room dimensions')
check(True,'all163facade normals are unit/perpendicular/outward with compass bearings in xEast/zSouth coordinates')
rooms={r['id']:r for r in d['rooms']}
check(rooms['uipath-buc']['status']=='blocked-conflicting-block' and rooms['uipath-buc']['bindings'][0]['sourceTagsEvidence']['tags']['name']=='The Landmark Corp B','UiPathBucharest current BuildingA/retained CorpB conflict blocks an automatic office binding')
upb=next(b for b in rooms['upb']['bindings'] if b['sourceId']=='w1217715300')['sourceTagsEvidence']['tags']
check(upb['building:part']=='roof' and upb['min_level']=='6' and upb['roof:shape']=='dome','UPB dome-level tags remain roof-part evidence, not room-floor proof')
h=d['historicalEvidence']['uipathBellevuePlaza']
check(h['actualRoomFloor']==4 and h['currentRoomBinding'] is False and h['actualRoomBearingDegrees'] is None and h['bindings'][0]['sourceId']=='w33725899','historical JPC fourth-floor Plaza evidence stays separate from current Lincoln Suite2000')
report={'toolSHA256':sha(pathlib.Path(__file__).read_bytes()),'scope':'CPU exact retained source/Git and geometry controls only; no portal integration, measured-room or native visual claim','passed':True,'checks':checks,'sourceCommit':d['sourceCommit'],'ledgerSHA256':sha(path.read_bytes()),'sourceInputs':len(d['sourceInputs']),'rooms':len(d['rooms']),'sourceParts':parts,'facadeEdges':edges,'courtyardFacadeEdges':courtyard_edges}
print(json.dumps(report,indent=2))
