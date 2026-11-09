from pathlib import Path
import json,gzip,math,hashlib
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
worldPath=Path('/workspace/integration-qa-evidence/preview-ff6b2bff-native/grozavesti-world.json.gz');worldBytes=gzip.decompress(worldPath.read_bytes());w=json.loads(worldBytes);r=json.load(open('/workspace/reality-pass/groz-lukoil-nav/raw-osm-routes.json'));P=w['data']['proj'];M=w['data']['district']['mask']
def xy(ll):lat,lon=ll;return[(lon-P['lon0'])*P['mPerLon'],(P['lat0']-lat)*P['mPerLat']]
bits=[];v=0
for n in M['rle']:bits.extend([v]*n);v^=1
assert len(bits)==M['w']*M['h']
def inside(x,z):i=math.floor((x-M['x0'])/M['cell']);j=math.floor((z-M['z0'])/M['cell']);return 0<=i<M['w']and 0<=j<M['h']and bits[j*M['w']+i]==1
native={};native_pairs={};native_nodes={}
for e in w['allEdges']:
 for n in [e['a'],e['b']]:
  if isinstance(n.get('sourceId'),(int,float)):native_nodes[n['sourceId']]=[n['x'],n['z']]
 for d in [1,-1]:
  if e.get('virtual')or e.get('publicDrive')is False or(d==-1 and e.get('oneway'))or(e.get('lanesF',e.get('lanes',1))if d==1 else e.get('lanesB',e.get('lanes',1)))<=0:continue
  a,b=(e['a'],e['b'])if d==1 else(e['b'],e['a']);native[(e.get('access',{}).get('sourceId'),a.get('sourceId'),b.get('sourceId'))]=e['id'];native_pairs.setdefault((a.get('sourceId'),b.get('sourceId')),[]).append({'edge':e['id'],'source':e.get('access',{}).get('sourceId')})
closures=[]
for c in w['district']['ends']:
 e=c['edge'].get('$nativeEdgeRef',{});closures.append({'x':c['x'],'z':c['z'],'source':e.get('sourceId'),'edgeId':e.get('id'),'node':c['node'].get('$nativeNodeRef',{})})
def geometry_coverage(leg,a,b):
 dx,dz=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dz);ux,uz=dx/L,dz/L;intervals=[]
 for e in w['allEdges']:
  if e.get('access',{}).get('sourceId')!=leg['way']or e.get('virtual')or e.get('publicDrive')is False:continue
  for d in [1,-1]:
   if d==-1 and e.get('oneway'):continue
   if (e.get('lanesF',e.get('lanes',1))if d==1 else e.get('lanesB',e.get('lanes',1)))<=0:continue
   p,q=(e['a'],e['b'])if d==1 else(e['b'],e['a'])
   if (q['x']-p['x'])*ux+(q['z']-p['z'])*uz<=0:continue
   if max(abs((n['x']-a[0])*uz-(n['z']-a[1])*ux)for n in [p,q])>1e-5:continue
   lo=((p['x']-a[0])*ux+(p['z']-a[1])*uz)/L;hi=((q['x']-a[0])*ux+(q['z']-a[1])*uz)/L
   if hi>=0 and lo<=1:intervals.append((max(0,lo),min(1,hi),e['id']))
 cursor=0;covered=0
 for lo,hi,_ in sorted(intervals):
  if hi<=cursor:continue
  covered+=max(0,hi-max(cursor,lo));cursor=max(cursor,hi)
 return {'wholeLegCovered':covered>=1-1e-7,'coveredFraction':min(1,covered),'missingMetres':max(0,1-covered)*L,'nativeEdgeIntervals':intervals}
reports=[]
for route in r['routes']:
 path=route['nonserviceRoute'];out=[];errs=[]
 for leg in path['legs']:
  a,b=xy(leg['fromLL']),xy(leg['toLL']);steps=max(1,math.ceil(leg['length']/5));outside=[a[0]+(b[0]-a[0])*i/steps for i in []]
  samples=[[a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps]for i in range(steps+1)];off=[p for p in samples if not inside(*p)]
  for id,p in [(leg['from'],a),(leg['to'],b)]:
   if id in native_nodes:errs.append(math.dist(p,native_nodes[id]))
  coverage=geometry_coverage(leg,a,b);nativeId=native.get((leg['way'],leg['from'],leg['to']));aliases=native_pairs.get((leg['from'],leg['to']),[])
  row={**leg,'fromXZ':a,'toXZ':b,'nativeGeometryCoverage':coverage,'nativeExactDirectedEdgeId':nativeId,'nativeSameNodePairOtherSource':aliases,'outsideMask':bool(off),'outsideSamples':len(off),'sampleCount':len(samples)}
  if not coverage['wholeLegCovered']:
   row['nearestNativeClosure']=min(closures,key=lambda c:math.dist(a,[c['x'],c['z']]))
   row['nearestClosureDistanceM']=math.dist(a,[row['nearestNativeClosure']['x'],row['nearestNativeClosure']['z']])
  out.append(row)
 reports.append({'label':route['label'],'rawNonservicePathLengthM':path['metres'],'unsupportedRestrictionsTouchingRoute':path['unsupportedRestrictionsTouchingRoute'],'sourceWaysInOrder':list(dict.fromkeys(l['way']for l in out)),'nativeMatchedSourceNodeMaxErrorM':max(errs,default=0),'missingNativeDirectedLegs':sum(not l['nativeGeometryCoverage']['wholeLegCovered']for l in out),'outsideMaskLegs':sum(l['outsideMask']for l in out),'firstMissingNative':next((l for l in out if not l['nativeGeometryCoverage']['wholeLegCovered']),None),'legs':out})
fuel=next(f for f in r['Lukoil']if f['id']=='w256806132');poly=[xy(p)for p in fuel['nodeLL']];A=sum(a[0]*b[1]-b[0]*a[1]for a,b in zip(poly,poly[1:]))/2;cx=sum((a[0]+b[0])*(a[0]*b[1]-b[0]*a[1])for a,b in zip(poly,poly[1:]))/(6*A);cz=sum((a[1]+b[1])*(a[0]*b[1]-b[0]*a[1])for a,b in zip(poly,poly[1:]))/(6*A)
result={'scope':'CPU source-only directed/access connectivity and exact current mask/source-cut diagnosis; no production edits or accepted driving corridor. Source points, native directions, gas identity and boundary walls are retained. Original tagged via-node restrictions and no-immediate-U-turn apply; no unsupported restriction touches the selected nonservice paths. Grade/collision/wholebody and current native GO remain separate.','worldRawSha256':hashlib.sha256(worldBytes).hexdigest(),'maskDefinition':{k:v for k,v in M.items()if k!='rle'},'fuel':{**fuel,'sourceCentroidXZ':[cx,cz],'nativeRoundedPoiXZ':[112.9,-573.8],'centroidToNativePoiM':math.dist([cx,cz],[112.9,-573.8])},'routes':reports}
out=Path('/workspace/reality-pass/groz-lukoil-nav/source-gap-certificate.json');out.write_text(json.dumps(result,indent=2)+'\n')
fig,ax=plt.subplots(figsize=(9,10));grid=np.array(bits).reshape(M['h'],M['w']);ax.imshow(grid,extent=[M['x0'],M['x0']+M['w']*M['cell'],M['z0']+M['h']*M['cell'],M['z0']],cmap='Greys',alpha=.18,interpolation='nearest')
for e in w['allEdges']:
 if e.get('drivable'):ax.plot([e['a']['x'],e['b']['x']],[e['a']['z'],e['b']['z']],color='#808080',lw=.65,alpha=.45)
for i,report in enumerate(reports):
 pts=[report['legs'][0]['fromXZ']]+[l['toXZ']for l in report['legs']];ax.plot(*zip(*pts),color=['#0068b4','#bd561b'][i],lw=2,label=report['label']+' raw-source candidate')
 for l in report['legs']:
  if not l['nativeGeometryCoverage']['wholeLegCovered']:ax.plot([l['fromXZ'][0],l['toXZ'][0]],[l['fromXZ'][1],l['toXZ'][1]],color='#d7191c',lw=2.5)
ax.scatter([112.9],[-573.8],s=90,marker='*',color='green',label='Mapped Lukoil w256806132');ax.text(127,-573.8,'Lukoil',color='green')
ax.set_aspect('equal');ax.grid(alpha=.15);ax.set_xlabel('Native X east (m)');ax.set_ylabel('Native Z south (m)');ax.set_title('Raw mapped return roads vs native playable mask\nRed = raw leg not wholly covered by compiled directed roads; no route accepted');ax.legend(fontsize=8);fig.tight_layout();fig.savefig('/workspace/reality-pass/groz-lukoil-nav/source-route-mask.png',dpi=150)
print(json.dumps({'fuelSource':fuel['id'],'centroidErrorM':result['fuel']['centroidToNativePoiM'],'routes':[{k:q[k]for k in ['label','rawNonservicePathLengthM','missingNativeDirectedLegs','outsideMaskLegs','nativeMatchedSourceNodeMaxErrorM','firstMissingNative']}for q in reports]}))
