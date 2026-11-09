#!/usr/bin/env python3
"""Read-only integrity of all current atlases and byte-preserved prior collections."""
import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--baseline',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
root=a.root.resolve();base=root/'game/overview/comparison-data';load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args],cwd=root)
tree={}
for line in git('ls-tree','-r',a.baseline,'--','game/overview/comparison-data').decode().splitlines():
 meta,name=line.split('\t',1);tree[name]=meta.split()[2]
mask=load(root/'handoffs/fidelity/structure-atlas-07cc/structure-mask.json');selected={d['id']:set(d['recaptureTiles'])for d in mask['districts']}
assert mask['sourceCommit']==a.baseline and sum(map(len,selected.values()))==29
assert all(not selected[d]for d in ['romana','floreasca','otopeni'])
failures=[];collections=[];archives=[];preserved_nonatlas=0

def verify_collection(file,kind):
 global preserved_nonatlas
 d=load(file);ids=set();sources={};checked=0
 for item in d['items']:
  assert item['id']not in ids;ids.add(item['id'])
  s=item.get('gameSourceCommit',d.get('gameSourceCommit'));sources[s]=sources.get(s,0)+1
  if kind=='current':assert isinstance(s,str)and len(s)==40 and item['heading']==0 and item['pitch']==-90 and item['square']is True
  for field,digest in [('image','sha256'),('thumbnail','thumbnailSha256')]:
   rel=item.get(field)or(item.get('thumb')if field=='thumbnail'else None)
   if not rel:continue
   f=(file.parent/rel).resolve();assert file.parent.resolve()in f.parents and f.is_file(),str(f)
   if item.get(digest):assert sha(f)==item[digest],str(f);checked+=1
 collections.append({'manifest':str(file.relative_to(root)),'kind':kind,'frames':len(d['items']),'verifiedImageHashes':checked,'sourceCounts':sources})
 return d
for place in load(base/'catalog.json')['locations']:
 district=place['id'];target=base/district;file=target/'manifest.json';current=verify_collection(file,'current')
 before_path=str(file.relative_to(root));before=json.loads(git('show',a.baseline+':'+before_path))
 assert current['atlasSourceCounts']==dict(__import__('collections').Counter(i['gameSourceCommit']for i in current['items']))
 if selected[district]:
  archive_file=target/current['review']['priorCompleteReview']['manifest'];archive=archive_file.parent
  assert archive_file.read_bytes()==git('show',a.baseline+':'+before_path)
  prefix='game/overview/comparison-data/'+district+'/';record=[]
  for name,oid in tree.items():
   if not name.startswith(prefix):continue
   rel=name[len(prefix):]
   if rel.startswith('historical/'):
    assert blob((root/name).read_bytes())==oid;continue
   payload=(archive/rel).read_bytes();assert blob(payload)==oid,name
   record.append({'path':rel,'sha256':hashlib.sha256(payload).hexdigest()})
   if rel.startswith(('context/','street-walk/')):assert blob((target/rel).read_bytes())==oid;preserved_nonatlas+=1
  originals={i['id']:i for i in before['items']};untouched=0
  raw=load(target/'retakes'/a.baseline/'manifest.json');fresh={i['id']:i for i in raw['items']};assert set(fresh)==selected[district]
  for row in current['items']:
   if row['id']not in selected[district]:assert row==originals[row['id']];untouched+=1
   else:
    assert row['gameSourceCommit']==a.baseline and row['capturedAt']==fresh[row['id']]['capturedAt']
    assert row['sha256']==fresh[row['id']]['sha256']
    assert all(row[k]==originals[row['id']][k]for k in ['lat','lon','x','z','h','fov','size','boundsXZ','heading','pitch'])
  for key in ['perspectiveCollections','streetWalk']:assert current.get(key)==before.get(key)
  assert current.get('historicalCollections',[])[:len(before.get('historicalCollections',[]))]==before.get('historicalCollections',[])
  archives.append({'district':district,'archiveManifest':str(archive_file.relative_to(root)),'archivedFrames':len(before['items']),'priorCurrentFilesVerifiedByteIdentical':len(record),'untouchedCurrentItemsPreserved':untouched,'files':record})
 else:
  prefix='game/overview/comparison-data/'+district+'/'
  for name,oid in tree.items():
   if name.startswith(prefix):assert blob((root/name).read_bytes())==oid,name
 for hist in current.get('historicalCollections',[]):verify_collection(target/hist['manifest'],'historical')
 for perspective in current.get('perspectiveCollections',[]):verify_collection(target/perspective['manifest'],'perspective')
summary={'baseline':a.baseline,'freshFrames':29,'freshSourceDatesUnchanged':True,'allOriginalGroundPosesPreserved':True,'retainedAffectedItems':sum(r['untouchedCurrentItemsPreserved']for r in archives),'archivedFullPriorFrames':sum(r['archivedFrames']for r in archives),'archivedCurrentFilesVerifiedByteIdentical':sum(r['priorCurrentFilesVerifiedByteIdentical']for r in archives),'currentContextStreetFilesVerifiedUnchanged':preserved_nonatlas,'currentAtlasFrames':sum(c['frames']for c in collections if c['kind']=='current'),'historicalAtlasFrames':sum(c['frames']for c in collections if c['kind']=='historical'),'perspectiveFrames':sum(c['frames']for c in collections if c['kind']=='perspective'),'noRomanFloreascaOtopeniChanges':True,'allExistingHistoriesRetained':True,'failures':failures}
a.out.write_text(json.dumps({'summary':summary,'collections':collections,'archives':archives},indent=2)+'\n');print(json.dumps(summary,indent=2))
