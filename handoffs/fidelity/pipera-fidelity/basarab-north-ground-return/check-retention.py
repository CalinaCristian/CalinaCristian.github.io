from pathlib import Path
import json,hashlib,collections,argparse
parser=argparse.ArgumentParser();parser.add_argument('--accepted-commit',required=True);parser.add_argument('--accepted',type=Path,required=True);parser.add_argument('--candidate',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
newpath=args.candidate;old=json.loads(args.accepted.read_bytes());new=json.loads(newpath.read_bytes())
def nodes(d):return {n:d['roadNodePositions'][i*2:i*2+2]for i,n in enumerate(d['roadNodeIds'])if n>0}
a,b=nodes(old),nodes(new);lostNodes=[n for n in a if n not in b];movedNodes=[n for n in a if n in b and a[n]!=b[n]]
def un(s):
 p=[];x=z=0
 for i in range(0,len(s),2):x+=s[i];z+=s[i+1];p.append([x/10,z/10])
 return p
def buildings(d):
 out={}
 for i,sid in enumerate(d['buildingIds']):
  fp=d['buildingFootprints'].get(str(i))or un(d['buildings'][i][9:]);holes=d.get('buildingHoleFootprints',{}).get(str(i),[])
  key=(sid,json.dumps(fp,separators=(',',':')),json.dumps(holes,separators=(',',':')))
  out.setdefault(key,[]).append(i)
 return out
ob,nb=buildings(old),buildings(new);missingBodies=[{'sourceId':k[0],'oldIndices':v}for k,v in ob.items()if len(nb.get(k,[]))<len(v)]
changedDims=[];changedAppearance=[];changedRoofProfiles=[];changedBuildingSourceTags=[];unknownLevels=0;changedUnknownLevels=[]
for k,ii in ob.items():
 for oi,ni in zip(ii,nb.get(k,[])):
  od=old.get('buildingDimensions',{}).get(str(oi),old['buildings'][oi][1:3]);nd=new.get('buildingDimensions',{}).get(str(ni),new['buildings'][ni][1:3])
  if od!=nd:changedDims.append({'sourceId':k[0],'oldIndex':oi,'newIndex':ni,'old':od,'new':nd})
  oldrow,newrow=old['buildings'][oi],new['buildings'][ni]
  if oldrow[6]==0:
   unknownLevels+=1
   if newrow[6]!=0:changedUnknownLevels.append({'sourceId':k[0],'oldIndex':oi,'newIndex':ni})
  if old.get('buildingRoofProfiles',{}).get(str(oi))!=new.get('buildingRoofProfiles',{}).get(str(ni)):changedRoofProfiles.append({'sourceId':k[0],'oldIndex':oi,'newIndex':ni})
  if old.get('buildingSourceTags',{}).get(str(oi))!=new.get('buildingSourceTags',{}).get(str(ni)):changedBuildingSourceTags.append({'sourceId':k[0],'oldIndex':oi,'newIndex':ni})
  for field in [0,3,6]:
   if oldrow[field]!=newrow[field]:changedAppearance.append({'sourceId':k[0],'oldIndex':oi,'newIndex':ni,'field':field,'old':oldrow[field],'new':newrow[field]})
def tree(d):
 return collections.Counter(tuple(d['trees'][i*3:i*3+3]+d['treeInfo'][i*3:i*3+3]+[d['treeCrownRadii'][i]])for i in range(len(d['trees'])//3))
ot,nt=tree(old),tree(new);missingTrees=[{'packed':list(k[:3]),'record':{'info':list(k[3:6]),'radius':k[6]},'missingCount':v-nt[k]}for k,v in ot.items()if nt[k]<v]
def sources(d):
 out={}
 for s in d['roadSourceGeometry'].values():out[s['sourceId']]={k:s[k]for k in ['sourceId','nodeIds','wgs84','projected','tags']}
 return out
os,ns=sources(old),sources(new);changedSources=[sid for sid,v in os.items()if ns.get(sid)!=v]
def widths(d):
 result={}
 for i,row in enumerate(d['roads']):
  s=d['roadSourceGeometry'][str(i)];sid=s['sourceId'];name=d['strings'][row[0]]if row[0]>=0 else ''
  points=[d['roadNodePositions'][n*2:n*2+2]for n in row[10:]]
  if sum(((b[0]-a[0])**2+(b[1]-a[1])**2)**.5 for a,b in zip(points,points[1:]))<=1e-9:continue
  key=json.dumps([name,*row[1:10],d.get('roadWidths',{}).get(str(i)),d['roadAccess'][str(i)]],sort_keys=True)
  result.setdefault(sid,set()).add(key)
 return result
def zero_stubs(d):
 result=[]
 for i,row in enumerate(d['roads']):
  points=[d['roadNodePositions'][n*2:n*2+2]for n in row[10:]]
  if sum(((b[0]-a[0])**2+(b[1]-a[1])**2)**.5 for a,b in zip(points,points[1:]))<=1e-9:result.append({'sourceId':d['roadSourceGeometry'][str(i)]['sourceId'],'oldRoadIndex':i,'points':points,'flags':row[8]})
 return result
ow,nw=widths(old),widths(new);changedProfiles=[{'sourceId':sid,'oldVariants':len(v),'newVariants':len(nw.get(sid,set())),'old':list(v),'new':list(nw.get(sid,set()))}for sid,v in ow.items()if v!=nw.get(sid,set())]
def mask(d):
 m=d['district']['mask'];bits=[];v=0
 for n in m['rle']:bits.extend([v]*n);v^=1
 return {(m['x0']+(i%m['w'])*m['cell'],m['z0']+(i//m['w'])*m['cell'])for i,v in enumerate(bits)if v}
om,nm=mask(old),mask(new)
def area_records(d):
 return collections.Counter(json.dumps([d['areaSourceIds'][i],d['areaKinds'][r[0]],d['strings'][r[1]]if r[1]>=0 else '',r[2:]],separators=(',',':'))for i,r in enumerate(d['areas']))
oar,nar=area_records(old),area_records(new);changedAreaRecords=[{'record':json.loads(k),'missingCount':v-nar[k]}for k,v in oar.items()if nar[k]<v]
def by_id(rows):return {r['sourceId']:r for r in rows}
oldTrams,newTrams=by_id(old.get('tramSourceWays',[])),by_id(new.get('tramSourceWays',[]));changedTramSources=[sid for sid,row in oldTrams.items()if newTrams.get(sid)!=row]
oldRoutes,newRoutes=by_id(old.get('tramRoutes',[])),by_id(new.get('tramRoutes',[]));changedTramRoutes=[sid for sid,row in oldRoutes.items()if newRoutes.get(sid)!=row]
oldMetric=old.get('roadSourceNodeTags',{});newMetric=new.get('roadSourceNodeTags',{});changedMetricTags=[sid for sid,row in oldMetric.items()if newMetric.get(sid)!=row]
water=[]
for row in new.get('sourceContextPreservation',{}).get('waterAreas',[]):
 sid=row['sourceId'];oi=old['areaSourceIds'].index(sid);ni=new['areaSourceIds'].index(sid)
 water.append({'sourceId':sid,'unchangedRings':old['areas'][oi][2:]==new['areas'][ni][2:]})
report={'scope':'Independent old-to-rebuilt source retention. Synthetic negative boundary cuts may be replaced; all literal positive source nodes, original physical building footprints/courtyards/dimensions, source-road metadata and measured crown records must survive. Native World acceptance remains separate.',
 'oldSourceCommit':args.accepted_commit,'oldDataSha256':hashlib.sha256(args.accepted.read_bytes()).hexdigest(),'candidateDataSha256':hashlib.sha256(newpath.read_bytes()).hexdigest(),
 'positiveNodes':{'old':len(a),'new':len(b),'missing':lostNodes,'moved':movedNodes},
 'sourceBuildings':{'old':len(old['buildings']),'new':len(new['buildings']),'missingExactFootprintOrHoles':missingBodies,'changedDimensions':changedDims,'changedStyleRoofOrLevels':changedAppearance,'changedCompleteRoofProfiles':changedRoofProfiles,'changedRawSourceTags':changedBuildingSourceTags,'priorUnknownStoreyCounts':unknownLevels,'unknownStoreyCountsChangedToKnown':changedUnknownLevels},
 'sourceRoadMetadata':{'old':len(os),'new':len(ns),'missingOrChanged':changedSources,'changedPhysicalProfiles':changedProfiles,'priorZeroLengthStubRecords':zero_stubs(old)},
 'trees':{'old':len(old['trees'])//3,'new':len(new['trees'])//3,'missingOrChanged':missingTrees,'retention':new['treeRetention']},
 'areas':{'old':len(old['areas']),'new':len(new['areas']),'missingSourceIds':sorted(set(old['areaSourceIds'])-set(new['areaSourceIds'])),'carriedWater':water,'missingOrChangedExactRecords':changedAreaRecords},
 'mask':{'oldInsideCells':len(om),'newInsideCells':len(nm),'removedOldInsideCells':len(om-nm),'addedInsideCells':len(nm-om),'cellM':20},
 'unchangedSourceMetadata':{'changedTramSourceWays':changedTramSources,'changedTramRoutes':changedTramRoutes,'changedPriorRoadNodeMetricTags':changedMetricTags},'roadSourceNodeTags':new.get('roadSourceNodeTags'),'roadSourceNodeTagCoverage':new.get('roadSourceNodeTagCoverage')}
args.out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['sourceBuildings','sourceRoadMetadata','roadSourceNodeTags']},indent=2))
print('building dimension changes',len(changedDims),'appearance changes',len(changedAppearance),'profile changes',len(changedProfiles),'missing exact bodies',len(missingBodies),'roadmetadata mismatches',len(changedSources))

assert not(lostNodes or movedNodes or missingBodies or changedDims or changedAppearance or changedRoofProfiles or changedBuildingSourceTags or changedUnknownLevels or changedSources or changedProfiles or missingTrees or om-nm or report['areas']['missingSourceIds'] or changedAreaRecords or changedTramSources or changedTramRoutes or changedMetricTags), 'Source retention gate failed; report preserved'
assert all(a['unchangedRings']for a in water), 'Retained source water changed'
