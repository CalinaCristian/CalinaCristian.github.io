import pathlib, json, gzip, collections, shutil, sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(__file__).resolve().parents[1]; out=root/'candidate-r3';out.mkdir(exist_ok=True)
a=json.load(open(p/'original.json'));b=json.load(open(p/'regenerated.json'));r=json.load(open(p/'retention-audit.json'))
S=lambda d,i:d['strings'][i]if i>=0 else''
cnt=lambda k:{'before':len(a.get(k,[])),'after':len(b.get(k,[]))}
metadata={'scope':'Literal expanded foreground versus route context; not mode, grade, binding, physical or native acceptance.','counts':{k:cnt(k)for k in ['trams','tramSources','tramSourceWays','tramSourceNodeTags','tramRoutes','tramSourceCrossings','roadRestrictions','scenery','scenerySourceGeometry','pois','areas']},'preservedOldRecords':{},'newForeground':[]}
for k in ['tramSources','tramSourceWays','roadRestrictions','tramSourceCrossings']:
 old={v['sourceId']:v for v in a[k]};new={v['sourceId']:v for v in b[k]};metadata['preservedOldRecords'][k]={'lost':[s for s in old if s not in new],'changed':[s for s in old if s in new and old[s]!=new[s]],'added':[s for s in new if s not in old]}
metadata['oldForegroundPackedRunsExactSubset']=all(t in b['trams']for t in a['trams'])
oldids={v['sourceId']for v in a['tramSources']}
metadata['surroundingRouteContextWays']={'before':len(a['tramSourceWays'])-len(a['tramSources']),'after':len(b['tramSourceWays'])-len(b['tramSources'])}
for i,v in enumerate(b['tramSources']):
 if v['sourceId']not in oldids:metadata['newForeground'].append({'sourceId':v['sourceId'],'source':v,'preparedPackedGeometry':b['trams'][i],'gradeBasis':'No bridge/tunnel/layer tag on these16new runs; native grade/binding/static checks still required.','directionsBasis':'Literal oneway=yes; runtime independent railDirections still required.'})
oldroutes={v['sourceId']:v for v in a['tramRoutes']};newroutes={v['sourceId']:v for v in b['tramRoutes']}
metadata['oldRouteRelations']=[{'sourceId':s,'tagsUnchanged':v['tags']==newroutes[s]['tags'],'membersUnchanged':v['members']==newroutes[s]['members'],'beforeMissingWayIds':v.get('missingWayIds'),'afterMissingWayIds':newroutes[s].get('missingWayIds')}for s,v in oldroutes.items()]
def pois(d):return collections.Counter(json.dumps([d['poiKinds'][x[0]],x[1],x[2],S(d,x[3]),S(d,x[4]),S(d,x[5]),d['buildingIds'][x[6]]if x[6]>=0 else''])for x in d['pois'])
def furn(d):return collections.Counter((d['furnKinds'][k],x,z)for k,x,z in zip(*[iter(d['furniture'])]*3))
def park(d):return collections.Counter(json.dumps([d['roadSourceGeometry'][str(v[0])]['sourceId'],*[S(d,i)for i in v[1:]]])for v in d['parking'])
def parkpolys(d):return collections.Counter(json.dumps([d['areaSourceIds'][int(i)],polys],sort_keys=True)for i,polys in d.get('parkingFootprints',{}).items())
extra={k:{'missingOldRecords':sum((fn(a)-fn(b)).values()),'beforeRecords':sum(fn(a).values()),'afterRecords':sum(fn(b).values())}for k,fn in [('POIs',pois),('furniture',furn),('parking',park),('parkingFootprints',parkpolys)]}
metadata['otherSourceRetention']=extra
before=json.load(gzip.open(p/'cpu-profiles-before.json.gz','rt'));after=json.load(gzip.open(p/'cpu-profiles-after-routing.json.gz','rt'));historical=[];changes=[];oldUnknown=[];newUnknown=[]
for n,(x,y)in enumerate(zip(before['result']['results'],after['result']['results'])):
 if n>=5515:
  if y['unresolved']:newUnknown.append(y)
  continue
 av={m['roadSurfaceM']for m in x['matches']};bv={m['roadSurfaceM']for m in y['matches']}
 if len(av)!=1 or len(bv)!=1:oldUnknown.append({'before':x,'after':y});continue
 old=next(iter(av));new=next(iter(bv));hist=old-x['beforeRoadSurfaceM']
 if hist:historical.append({'sourceId':x['sourceId'],'station':n,'differenceM':hist,'historicalHeightBasis':x['beforeHeightBasis']})
 if new!=old:changes.append({'station':n,'sourceId':x['sourceId'],'roadClass':x['roadClass'],'sourceSegmentIndex':x['sourceSegmentIndex'],'sourceFraction':x['sourceFraction'],'beforeEdgeFraction':x['beforeEdgeFraction'],'x':x['x'],'z':x['z'],'beforeSurfaceM':old,'afterSurfaceM':new,'deltaM':new-old,'rawSourceTags':x['rawSourceTags']})
profile={'scope':'Exact unchanged World graph/profile prefix CPU replay, NOT fresh native AFTER, mesh, body, terrain or driving acceptance. All raw nonzero differences retained.','oldStations':5515,'newCorridorStations':630,'historicalBeforeNonzero':historical,'historicalBeforeMaxAbsDifferenceM':max([abs(x['differenceM'])for x in historical],default=0),'oldUnresolved':oldUnknown,'changedOldStations':changes,'changesByClass':dict(collections.Counter(x['roadClass']for x in changes)),'oldOrdinaryStationsBitIdentical':4920 if not any(x['roadClass']=='ordinary'for x in changes)else None,'newStationFlags':newUnknown,'newStationFlagClassification':'Both flags are literal shared source node21448879, stored nodeY0 on both incident edges. Edge interpolation evaluates0.2399999999999991 versus0.24 (8.881784197001252e-16m); raw strict ambiguity flags retained. No missing source leg and no tolerance/height change applied.','newStationMissingSourceCount':sum(not x['matches']for x in after['result']['results'][5515:]),'routing':after['routing'],'passiveSceneryProfiles':'Historical passive native profiles not recorded; fresh paired World exports required.'}
for name,obj in [('source-scope.json',metadata),('profile-comparison.json',profile),('build-job.json',json.load(open(p/'job.json')))]: (out/name).write_text(json.dumps(obj,indent=2)+'\n')
for f in ['retention-audit.json','cpu-profiles-before.json.gz','all-profile-queries.json.gz']:
 if f.endswith('.gz'):shutil.copy2(p/f,out/f)
 else:(out/'retention-audit.json.gz').write_bytes(gzip.compress((p/f).read_bytes(),mtime=0))
shutil.copy2(p/'cpu-profiles-after-routing.json.gz',out/'cpu-profiles-after.json.gz')
for f in ['build.log','canopy-append.log']:shutil.copy2(p/f,out/f)
print(json.dumps({'otherRetention':extra,'profileChanges':len(changes),'unknownOldStations':len(oldUnknown),'newMissingStations':profile['newStationMissingSourceCount']}))
