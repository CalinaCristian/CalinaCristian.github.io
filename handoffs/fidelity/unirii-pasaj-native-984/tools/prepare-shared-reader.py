#!/usr/bin/env python3
"""Detached exact-Git reader; never write/chmod a shared source snapshot."""
import argparse,datetime,hashlib,json,os,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--source',required=True);p.add_argument('--shared',required=True);p.add_argument('--shared-manifest',required=True);p.add_argument('--out',required=True);a=p.parse_args()
repo=pathlib.Path(a.repo);shared=pathlib.Path(a.shared);out=pathlib.Path(a.out);assert not out.exists()
source=subprocess.check_output(['git','rev-parse',a.source+'^{commit}'],cwd=repo,text=True).strip();base=json.loads(pathlib.Path(a.shared_manifest).read_text());assert (base.get('commit') or base.get('source'))==source
tree={}
for row in subprocess.check_output(['git','ls-tree','-rz','--full-tree',source],cwd=repo).split(b'\0'):
 if not row:continue
 meta,name=row.split(b'\t',1);mode,kind,blob=meta.decode().split()
 if kind=='blob':tree[name.decode()]={'mode':mode,'blob':blob}
selected=set(base['files'])|{name for name in tree if name.startswith('game/dev/harness/page/')}|{'game/data/bucharest-unirii.json'}
out.mkdir(parents=True);files={};reused=0;added=0
def record(b):return{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlobSha1':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()}
for name in sorted(selected):
 assert name in tree and tree[name]['mode'] in ['100644','100755'];dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True)
 if name in base['files']:
  original=shared/name;b=original.read_bytes();rec=record(b);assert rec==base['files'][name] and rec['gitBlobSha1']==tree[name]['blob'];os.link(original,dest);reused+=1
 else:
  b=subprocess.check_output(['git','cat-file','blob',tree[name]['blob']],cwd=repo);rec=record(b);assert rec['gitBlobSha1']==tree[name]['blob'];dest.write_bytes(b);added+=1
 assert record(dest.read_bytes())==rec;files[name]=rec
manifest={'source':source,'tree':subprocess.check_output(['git','rev-parse',source+'^{tree}'],cwd=repo,text=True).strip(),'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'policy':'Read-only exact Git reader. Hardlink hash-verified immutable Bridge source; add only missing Unirii dataset/native harness page Git blobs. No writes or chmod to shared snapshot.','sharedSource':str(shared),'sharedManifestSHA256':hashlib.sha256(pathlib.Path(a.shared_manifest).read_bytes()).hexdigest(),'hardlinks':reused,'newFiles':added,'files':files}
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'source':source,'files':len(files),'hardlinks':reused,'newFiles':added,'newBytes':sum(files[n]['bytes'] for n in files if n not in base['files']),'bytes':sum(r['bytes'] for r in files.values()),'out':str(out)}))
