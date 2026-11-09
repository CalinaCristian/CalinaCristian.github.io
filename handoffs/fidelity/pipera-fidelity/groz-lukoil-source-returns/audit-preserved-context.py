from pathlib import Path
import json,math,hashlib
ROOT=Path('/workspace/reality-pass/groz-lukoil-nav')
WT=Path('/workspace/fidelity-workers/ordinary-source-span')
old=json.loads((ROOT/'original-406a-grozavesti.json').read_bytes());new=json.loads((WT/'game/data/bucharest-grozavesti.json').read_bytes())
surveyPath=WT/'game/research/trees-bucharest-grozavesti.json';survey=json.loads(surveyPath.read_bytes());p=new['proj']
rnd=lambda x:math.floor(x+.5)
project=lambda lat,lon:[(lon-p['lon0'])*p['mPerLon'],(p['lat0']-lat)*p['mPerLat']]
O={tuple(old['trees'][i:i+3]):i//3 for i in range(0,len(old['trees']),3)}
N={tuple(new['trees'][i:i+3])for i in range(0,len(new['trees']),3)}
lost=O.keys()-N;lookup={}
for i,(lat,lon,cr)in enumerate(survey['trees']):
 x,z=project(lat,lon);h=max(5,min(22,2.3*cr+2.5));key=(rnd(x*10),rnd(z*10),rnd(h*10)*2)
 if key in lost:lookup.setdefault(key,[]).append({'surveyIndex':i,'rawSurveyCrown':[lat,lon,cr],'exactXZ':[x,z]})
def distance(q,a,b):
 dx,dz=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/(dx*dx+dz*dz or 1)))
 return math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dz)
segments=[]
for ri,row in enumerate(new['roads']):
 if row[8]&4:continue
 width=row[5]/10;median=row[4]/10;oneway=bool(row[8]&1)
 wr=wl=row[2]*width/2+.3
 if not oneway:wr=median/2+row[2]*width+.3;wl=median/2+row[3]*width+.3
 ids=row[10:];pts=[new['roadNodePositions'][i*2:i*2+2]for i in ids]
 for a,b in zip(pts,pts[1:]):segments.append((ri,new['roadAccess'][str(ri)]['sourceId'],a,b,wr,wl))
scenery=[]
for si,row in enumerate(new['scenery']):
 if row[0]is None:continue
 pts=new['scenerySourceGeometry'][str(si)]['prepared']
 for a,b in zip(pts,pts[1:]):scenery.append((si,new['sceneryAccess'][str(si)]['sourceId'],a,b,row[0]/20))
rows=[]
for key in sorted(lost):
 oi=O[key];matches=lookup.get(key,[]);q=matches[0]['exactXZ']if matches else[key[0]/10,key[1]/10]
 witnesses=[]
 for ri,sid,a,b,wr,wl in segments:
  right=(q[0]-a[0])*(-b[1]+a[1])+(q[1]-a[1])*(b[0]-a[0])>0;d=distance(q,a,b);limit=(wr if right else wl)+.9
  if d<limit:witnesses.append({'filter':'builder core carriageway','road':ri,'sourceId':sid,'distanceM':d,'existingFilterLimitM':limit})
 for si,sid,a,b,hw in scenery:
  d=distance(q,a,b)
  if d<hw+.6:witnesses.append({'filter':'builder passive scenery street','scenery':si,'sourceId':sid,'distanceM':d,'existingFilterLimitM':hw+.6})
 rows.append({'oldIndex':oi,'packed':list(key),'treeInfo':old['treeInfo'][3*oi:3*oi+3],'crownRadiusDm':old['treeCrownRadii'][oi],'sourceSurveyMatches':matches,'roadFilterWitnesses':witnesses,'status':'Retained source crown; builder filter is not a certified trunk/asphalt intersection or deletion authority. Other filter causes not inferred.'})
areas=[]
for i,sid in enumerate(old['areaSourceIds']):
 if sid not in new['areaSourceIds']:
  row=old['areas'][i];assert old['areaKinds'][row[0]]=='water'
  areas.append({'sourceId':sid,'kind':'water','name':old['strings'][row[1]]if row[1]>=0 else '', 'ringsDm':row[2:],'oldAreaIndex':i})
report={'sourceDataCommit':'406a53f1f1f1397a1667ea1bc77df78289a5667a','sourceDataSha256':hashlib.sha256((ROOT/'original-406a-grozavesti.json').read_bytes()).hexdigest(),'surveySha256':hashlib.sha256(surveyPath.read_bytes()).hexdigest(),'missingOldTrees':len(rows),'sourceSurveyMatched':sum(bool(r['sourceSurveyMatches'])for r in rows),'roadFilterWitnesses':sum(bool(r['roadFilterWitnesses'])for r in rows),'trees':rows,'waterAreas':areas}
(ROOT/'source-context-preservation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['trees','waterAreas']},indent=2))
