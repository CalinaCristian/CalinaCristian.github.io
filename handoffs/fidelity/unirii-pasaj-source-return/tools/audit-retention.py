import json,pathlib,collections,hashlib,sys
p=pathlib.Path(sys.argv[1]);a=json.loads((p/'original.json').read_text());b=json.loads((p/'regenerated.json').read_text())
def undelta(row,start=0):
 x=z=0;pts=[]
 for k in range(start,len(row)-1,2):
  if k==start:x,z=row[k:k+2]
  else:x+=row[k];z+=row[k+1]
  pts.append([x/10,z/10])
 return pts
def fields(d,i):
 r=d['buildings'][i];dim=d.get('buildingDimensions',{}).get(str(i),[r[1]/10,r[2]/10]);ring=d.get('buildingFootprints',{}).get(str(i),undelta(r,9));holes=d.get('buildingHoleFootprints',{}).get(str(i),[undelta(h)for h in d.get('buildingHoles',{}).get(str(i),[])]);S=lambda k:d['strings'][k]if k>=0 else''
 return {'geometry':[ring,holes],'dimensions':dim,'style':d['styles'][r[0]],'roof':d['roofs'][r[3]],'name':S(r[4]),'flags':r[5],'levels':r[6],'colour':S(r[7]),'roofColour':S(r[8]),'canopy':d.get('buildingCanopies',{}).get(str(i)),'roofProfile':d.get('buildingRoofProfiles',{}).get(str(i))}
B=collections.defaultdict(list)
for i,s in enumerate(b['buildingIds']):B[s].append(i)
missing=[];geo=[];dims=[];appearance=[];flags=[];roofs=[]
for i,s in enumerate(a['buildingIds']):
 old=fields(a,i);candidates=B.get(s,[])
 if not candidates:missing.append({'sourceId':s,'oldIndex':i});continue
 matches=[j for j in candidates if fields(b,j)['geometry']==old['geometry']]
 if not matches:geo.append({'sourceId':s,'oldIndex':i,'newIndices':candidates});continue
 new=fields(b,matches[0]);base={'sourceId':s,'oldIndex':i,'newIndex':matches[0]}
 if old['dimensions']!=new['dimensions']:dims.append({**base,'before':old['dimensions'],'after':new['dimensions'],'levels':old['levels'],'oldFlags':old['flags'],'newFlags':new['flags'],'rawSource':a.get('buildingSourceTags',{}).get(str(i))})
 diff={k:[old[k],new[k]]for k in ['style','roof','name','levels','colour','roofColour','canopy']if old[k]!=new[k]}
 if diff:appearance.append({**base,'changes':diff})
 if old['flags']!=new['flags']:flags.append({**base,'before':old['flags'],'after':new['flags']})
 if old['roofProfile']!=new['roofProfile']:roofs.append({**base,'before':old['roofProfile'],'after':new['roofProfile']})
# Source node identity, not array index or synthetic negative cut ids.
def nodes(d):return{n:[d['roadNodePositions'][2*i],d['roadNodePositions'][2*i+1]]for i,n in enumerate(d['roadNodeIds'])if n>0}
A,N=nodes(a),nodes(b);lostNodes=[n for n in A if n not in N];movedNodes=[{'sourceNodeId':n,'before':A[n],'after':N[n]}for n in A if n in N and A[n]!=N[n]]
# Full source geometry/raw tags do not change when a way is unclipped.
G=collections.defaultdict(list)
for i,g in b['roadSourceGeometry'].items():G[g['sourceId']].append((int(i),g))
roadLost=[];roadChanged=[];params=[]
for i,g in a['roadSourceGeometry'].items():
 src=g['sourceId'];c=G.get(src,[])
 if not c:roadLost.append(src);continue
 same=[(j,h)for j,h in c if all(g[k]==h[k]for k in ['nodeIds','wgs84','projected','tags'])]
 if not same:roadChanged.append(src);continue
 r=a['roads'][int(i)];old=[r[2:10],a['roadInfo'][int(i)*6:int(i)*6+6],a.get('roadWidths',{}).get(i),a['roadAccess'].get(i)]
 variants=[]
 for j,h in same:
  q=b['roads'][j];v=[q[2:10],b['roadInfo'][j*6:j*6+6],b.get('roadWidths',{}).get(str(j)),b['roadAccess'].get(str(j))];variants.append(v)
 if old not in variants:params.append({'sourceId':src,'oldIndex':int(i),'before':old,'after':variants})
def tree(d,i):
 s=d['treeInfo'][i*3:i*3+3];tax=d['strings'][s[0]]if s[0]>=0 else''
 return tuple(d['trees'][i*3:i*3+3]+[d['treeCrownRadii'][i],tax,*s[1:]])
oldTrees=collections.Counter(tree(a,i)for i in range(len(a['trees'])//3));newTrees=collections.Counter(tree(b,i)for i in range(len(b['trees'])//3));missingTrees=list((oldTrees-newTrees).elements())
def areas(d):return collections.Counter(json.dumps([d['areaSourceIds'][i],d['areaKinds'][r[0]],d['strings'][r[1]]if r[1]>=0 else'',r[2:]],separators=(',',':'))for i,r in enumerate(d['areas']))
missingAreas=list((areas(a)-areas(b)).elements());r={'source':'2696df66fd0331fc645f7c003cbcca7a5410740b','review':'Explicit source-domain candidate retention audit. No native acceptance.','counts':{'oldBuildings':len(a['buildings']),'newBuildings':len(b['buildings']),'oldTrees':len(a['trees'])//3,'newTrees':len(b['trees'])//3,'oldRoads':len(a['roads']),'newRoads':len(b['roads']),'oldCoreAreaKm2':a['district']['areaKm2'],'newCoreAreaKm2':b['district']['areaKm2']},'missingBuildings':missing,'changedFootprints':geo,'changedDimensions':dims,'changedAppearance':appearance,'changedFlags':flags,'changedRoofProfiles':roofs,'lostPositiveSourceNodes':lostNodes,'movedPositiveSourceNodes':movedNodes,'lostSourceWays':sorted(set(roadLost)),'changedSourceWays':sorted(set(roadChanged)),'changedRoadModels':params,'missingOldTreeRecords':missingTrees,'missingOldAreas':missingAreas,'runtimeOrNativeAcceptance':False};(p/'retention-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({**r['counts'],'missingBuildings':len(missing),'changedFootprints':len(geo),'changedDimensions':len(dims),'appearanceChanges':len(appearance),'changedFlags':len(flags),'roofProfileChanges':len(roofs),'lostPositiveNodes':len(lostNodes),'movedPositiveNodes':len(movedNodes),'lostWays':len(set(roadLost)),'changedWays':len(set(roadChanged)),'changedRoadModels':len(params),'missingTrees':len(missingTrees),'missingAreas':len(missingAreas)}))
