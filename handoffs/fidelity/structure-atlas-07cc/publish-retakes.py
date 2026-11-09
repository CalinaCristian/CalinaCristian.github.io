#!/usr/bin/env python3
"""Install an exact-pose reviewed subset across existing atlas metadata schemas.

Only GAME assets/hash ledgers are copied. Every prior current file except the
already archived historical subtree is retained in a new byte-identical archive.
"""
import argparse
from collections import Counter
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil

p=argparse.ArgumentParser()
for key in ['root','retakes','review']:p.add_argument('--'+key,type=Path,required=True)
p.add_argument('--city',required=True);p.add_argument('--district',required=True)
a=p.parse_args();assert re.fullmatch('[a-z0-9-]+',a.city)and re.fullmatch('[a-z0-9-]+',a.district)
load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();dump=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n')
target=a.root/'game/overview/comparison-data'/a.district
raw=(target/'manifest.json').read_bytes();old=load(target/'manifest.json');before=copy.deepcopy(old)
new=load(a.retakes/'manifest.json');mask=load(a.retakes/'recapture-mask.json');review=load(a.review);valid=load(a.retakes/'validation.json');source=load(a.retakes/'source-provenance.json')
assert hashlib.sha256(raw).hexdigest()==mask['originalManifestSha256'],'Planned current collection changed'
if mask['originalPosesSha256']is not None:assert sha(target/'poses.json')==mask['originalPosesSha256']
else:assert not(target/'poses.json').exists()
assert mask['district']==a.district and mask['city']==a.city
assert source['gameSourceCommit']==mask['sourceCommit']==new['gameSourceCommit']==review['sourceCommit']
assert review['visuallyInspected']is True and review['realWorldParityAccepted']is False
assert not valid['failures']and valid['frames']==len(new['items'])
assert all(not new['capture'][k]for k in ['pageErrors','consoleErrors','failedRequests'])
original={i['id']:i for i in old['items']};replace={i['id']:i for i in new['items']};notes={i['id']:i for i in review['items']}
assert len(original)==len(old['items'])==mask['totalFrames']
assert len(replace)==len(new['items'])==len(notes)
assert set(replace)=={i['id']for i in mask['tiles']}
assert review['reviewedIds']==[i['id']for i in new['items']]
for f in source['files']:assert sha(Path(source['sourceRoot'])/f['path'])==f['sha256'],'Served source changed: '+f['path']
data='game/data/'+a.city+'-'+a.district+'.json';data_sha=next(f['sha256']for f in source['files']if f['path']==data);assert sha(a.root/data)==data_sha
for id,row in original.items():
 assert sha(target/row['image'])==row['sha256'];assert sha(target/row['thumbnail'])==row['thumbnailSha256']
 if id not in replace:continue
 fresh=replace[id]
 assert all(fresh[k]==row[k]for k in ['id','lat','lon','x','z','h','size','fov','heading','pitch','square','boundsXZ','scope']),'Exact pose changed: '+id
 assert fresh['gameSourceCommit']==new['gameSourceCommit'];assert fresh['traffic']['enabled']is False
 assert row['sha256']==notes[id]['originalGameSha256']
 assert sha(a.retakes/fresh['image'])==fresh['sha256']==notes[id]['retakeGameSha256']
 assert sha(a.retakes/fresh['thumbnail'])==fresh['thumbnailSha256']
archive_rel=Path('historical')/('full-before-'+new['gameSourceCommit'][:8]+'-'+hashlib.sha256(raw).hexdigest()[:8]);archive=target/archive_rel
retake_rel=Path('retakes')/new['gameSourceCommit'];retake=target/retake_rel
assert not archive.exists()and not retake.exists(),'Preserve earlier installation evidence'
archive.mkdir(parents=True)
for f in list(target.iterdir()):
 if f.name=='historical':continue
 if f.is_dir():shutil.copytree(f,archive/f.name)
 else:shutil.copy2(f,archive/f.name)
assert(archive/'manifest.json').read_bytes()==raw
for r in before['items']:
 assert sha(archive/r['image'])==r['sha256'];assert sha(archive/r['thumbnail'])==r['thumbnailSha256']
shutil.copytree(a.retakes,retake);shutil.copy2(a.review,retake/'paired-review.json')
for id,row in replace.items():
 for key in ['image','thumbnail']:shutil.copy2(a.retakes/row[key],target/row[key])
 row.update({'sourceCaptureManifest':str(retake_rel/'manifest.json'),'reviewSourceManifest':str(retake_rel/'paired-review.json'),'sourceNote':'Exact original-pose structural/separator retake; original complete prior collection is archived byte-identically. Capture source is 07cc3d6b and capturedAt is the actual retake time; this frame is not relabelled as a later release.'})
 original[id]=row
rows=[original[r['id']]for r in before['items']];counts=dict(Counter(r['gameSourceCommit']for r in rows));prior_counts=dict(Counter(r['gameSourceCommit']for r in before['items']))
# Retain every existing raw capture-manifest reference and add the exact prior
# current ledger plus this fresh subset. Per-frame sources/dates are authoritative.
ledgers=copy.deepcopy(old.get('sourceCaptureManifests',[]))
ledgers.append({'path':str(archive_rel/'manifest.json'),'sha256':sha(archive/'manifest.json'),'sourceCounts':prior_counts,'frames':len(before['items']),'note':'Previous complete current manifest with actual per-frame source dates; its original raw capture ledger is also archived.'})
ledgers.append({'path':str(retake_rel/'manifest.json'),'sha256':sha(retake/'manifest.json'),'gameSourceCommit':new['gameSourceCommit'],'frames':len(replace)})
snapshot={'gameSourceCommit':new['gameSourceCommit'],'treeSha256':source['treeSha256'],'manifest':str(retake_rel/'manifest.json'),'manifestSha256':sha(retake/'manifest.json'),'sourceProvenance':str(retake_rel/'source-provenance.json'),'sourceProvenanceSha256':sha(retake/'source-provenance.json'),'frames':len(replace)}
snapshots=old.get('sourceSnapshots',[])+[snapshot]
old.update({'items':rows,'gameSourceCommit':None,'publishedBaseline':None,'atlasSourceCounts':counts,'sourceSnapshots':snapshots,'sourceCaptureManifests':ledgers,'sourceCaptureManifest':{'path':'capture-manifest.json','note':'Derived current mixed-source ledger; all exact original and retake capture ledgers remain separately retained.'},'generatedAt':new['generatedAt'],'generatedDate':new['generatedDate']})
old.setdefault('historicalCollections',[]).append({'manifest':str(archive_rel/'manifest.json'),'label':'Full prior current atlas before structural/separator retakes 07cc3d6b','frames':len(rows),'generatedAt':before.get('generatedAt'),'gameSourceCommit':next(iter(prior_counts))if len(prior_counts)==1 else None,'sourceCounts':prior_counts,'captureType':before.get('captureType'),'note':'Entire prior current collection and its GAME images/thumbnails, review, street/context and provenance files are byte-identical. Earlier histories retain their stable paths.'})
old['sourceCompatibility']={'method':'Only the conservative changed rendered-structure/separator mask is replaced. All other current items, source/date/pose metadata and pixels are unchanged. Moving traffic/mirrors are hidden in technical atlas captures. This does not relabel evidence as a later release or assert photographic parity.','mask':str(retake_rel/'recapture-mask.json'),'maskSha256':sha(retake/'recapture-mask.json'),'unchangedDistrictDataSha256':data_sha}
old['capture']={'type':'mixed-source-atlas','source':None,'frameCounts':len(rows),'sourceSnapshots':snapshots,'sourceCaptureManifests':ledgers,'pageErrors':[],'consoleErrors':[],'failedRequests':[],'traffic':False,'mirror':False,'quality':'high','weather':'clear','season':'summer','time':'day','latestRetakeCapture':new['capture'],'note':'Current per-frame source/date is authoritative; prior and fresh raw capture reports remain separate. Technical aerials remove fog/extend depth; native perspective/controller acceptance is separate.','perfMaxima':{'triangles':max(r['perf']['triangles']for r in rows),'drawCalls':max(r['perf']['drawCalls']for r in rows),'note':'Separate static no-traffic/no-mirror atlas maxima, not hardware FPS or native driving-budget acceptance.'}}
old['capture']['validation']={'framesVerified':len(rows),'failures':[],'mixedSourceProvenancePreserved':True}
r=old.setdefault('review',{})
if'entries'in r:
 entries={n['id']:n for n in r['entries']}
 for id in replace:entries[id]=dict(notes[id],gameSha256=replace[id]['sha256'],gameSourceCommit=new['gameSourceCommit'])
 r['entries']=[entries[x['id']]for x in rows]
for key in ['gameSourceCommit']: 
 if key in r:r[key]=None
for key in ['atlasSourceCommit','gameSourceCommits']:
 if key in r:r[key]=list(counts)
for key in ['atlasSourceCounts','sourceCounts']:
 if key in r:r[key]=counts
if'freshFramesReviewed'in r:r['freshFramesReviewed']=len(replace)
if'retainedEarlierReviewedFrames'in r:r['retainedEarlierReviewedFrames']=len(rows)-len(replace)
if'originalFullAtlasReview'in r:
 original_sha=before.get('sourceCaptureManifests',[{}])[0].get('gameSourceCommit');r['originalFullAtlasReview']['framesRetainedHere']=counts.get(original_sha,0)
r.update({'structureRetakeReview':str(retake_rel/'paired-review.json'),'structureRetakeSourceCommit':new['gameSourceCommit'],'structureRetakesReviewed':len(replace),'currentAtlasSourceCounts':counts,'priorCompleteReview':{'manifest':str(archive_rel/'manifest.json'),'sha256':sha(archive/'manifest.json'),'note':'Every earlier review/source-specific finding is preserved verbatim in the complete prior collection.'},'status':'Complete retained earlier review coverage plus '+str(len(replace))+' fresh exact-pose structural/separator pairs inspected; genuine source-height, materials, context and imagery-date limits remain.','realWorldParityAccepted':False})

if 'targetedRetakeReview' in before.get('review', {}):
 r['priorTargetedRetakeReview'] = before['review']['targetedRetakeReview']
 r['targetedRetakeReview'] = str(retake_rel/'paired-review.json')
if 'method' in r:
 r['method'] = 'Earlier complete and water-review ledgers retain their original source scope in priorCompleteReview. The latest '+str(len(replace))+' structural/separator retakes were manually reviewed as original/retake/reference triplets; all other current frames keep their earlier actual reviews.'
if 'atlasSourceNote' in r:
 r['atlasSourceNote'] = 'Current source counts: '+', '.join(str(n)+' on '+s[:8] for s,n in counts.items())+'. Earlier source-specific review blocks remain historical to their recorded revisions; the new structural subset has its own linked review.'
r['structureRetakeReviewedAt'] = max(n['reviewedAt'] for n in review['items'])

old['reviewNote']=r['status'];old.setdefault('collectionNotes',{})['atlas']='Current complete mixed-source atlas: '+', '.join(str(n)+' frames on '+s[:8]for s,n in counts.items())+'. Actual per-frame source/date retained; only the conservative structure/separator subset is fresh 07cc3d6b. Full prior current collection archived. Technical aerial settings and separate native limitations remain.'
if'comparisonSourceCommits'in old:old['comparisonSourceCommits']['atlas']=list(counts)
# Source-stamped street walks, perspectives and existing histories are never moved
# or rewritten in the current collection.
for key in ['streetWalk','perspectiveCollections']:
 assert old.get(key)==before.get(key)
dump(target/'manifest.json',old);dump(target/'capture-manifest.json',old);dump(target/'capture-report.json',old['capture'])
dump(target/'source-provenance.json',{'gameSourceCommit':None,'priorCurrentSourceProvenance':{'path':str(archive_rel/'source-provenance.json'),'sha256':sha(archive/'source-provenance.json')},'sourceSnapshots':snapshots,'sourceCaptureManifests':ledgers,'note':'Prior raw source inventories remain immutable in their archives; the new subset carries its actual07cc source tree.'})
if(target/'poses.json').exists():
 poses=load(target/'poses.json')
 for row in poses:
  if row['id']in replace:row['gameSourceCommit']=new['gameSourceCommit']
 dump(target/'poses.json',poses)
plan=load(target/'grid-plan.json');plan.update({'gameSourceCommit':None,'sourceCounts':counts});dump(target/'grid-plan.json',plan)
untouched=0
for row in before['items']:
 current=original[row['id']]
 assert sha(target/current['image'])==current['sha256'];assert sha(target/current['thumbnail'])==current['thumbnailSha256']
 if row['id']not in replace:assert row==current;untouched+=1
result={'district':a.district,'frames':len(rows),'retakesReviewed':len(replace),'untouchedItemsAndBytesPreserved':untouched,'archivedFullFrames':len(rows),'archivedManifestSha256':sha(archive/'manifest.json'),'atlasSourceCounts':counts,'allGroundPosesPreserved':True,'streetWalkAndPerspectiveMetadataUnchanged':True,'failures':[]}
dump(target/'validation.json',result);dump(retake/'publication-validation.json',result);print(json.dumps(result))
