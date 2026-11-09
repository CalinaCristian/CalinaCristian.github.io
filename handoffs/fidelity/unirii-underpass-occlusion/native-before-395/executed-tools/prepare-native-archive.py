#!/usr/bin/env python3
import argparse,subprocess,json,pathlib,hashlib,tarfile,io,datetime
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--source',required=True);p.add_argument('--out',required=True);a=p.parse_args();out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=False)
raw=subprocess.check_output(['git','ls-tree','-rz','--full-tree',a.source],cwd=a.repo);rows={}
for item in raw.split(b'\0'):
 if not item:continue
 meta,f=item.split(b'\t',1);mode,typ,blob=meta.decode().split();name=f.decode()
 if typ!='blob':continue
 if name.startswith(('game/src/','game/vendor/','game/assets/','public/','game/dev/harness/page/')) or name in ['game/index.html','game/style.css','game/release.json','package.json','public/telemetry.js'] or name in ['game/data/bucharest-unirii.json','game/data/bucharest-romana.json','game/data/places.json','game/data/dialogue.json']:
  if mode not in ['100644','100755']:raise Exception('Unsupported runtime entry '+name)
  rows[name]=blob
payload=subprocess.check_output(['git','archive','--format=tar',a.source,*rows],cwd=a.repo)
manifest={}
with tarfile.open(fileobj=io.BytesIO(payload)) as t:
 for member in t:
  if not member.isfile():continue
  name=member.name
  if name not in rows:raise Exception('Unexpected archive member '+name)
  b=t.extractfile(member).read();f=out/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b);blob=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();assert blob==rows[name];manifest[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlobSha1':blob}
assert len(manifest)==len(rows)
x={'source':a.source,'tree':subprocess.check_output(['git','rev-parse',a.source+'^{tree}'],cwd=a.repo,text=True).strip(),'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'policy':'Exact immutable tracked game runtime/source assets only; no overview/reference/handoff images; native harness page modules included. Only Unirii+Romană datasets for native initial boot and target district.','files':manifest};(out/'source-manifest.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps({'source':a.source,'files':len(manifest),'bytes':sum(v['bytes'] for v in manifest.values()),'out':str(out)}))
