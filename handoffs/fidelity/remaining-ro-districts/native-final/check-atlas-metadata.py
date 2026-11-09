#!/usr/bin/env python3
"""Audit every dated aerial item; keep native freeze acceptance scoped separately."""
import argparse,collections,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--capture-source',type=Path,required=True);p.add_argument('--native-source',type=Path,required=True);p.add_argument('--native-commit',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
report={'schemaVersion':1,'captureCommit':'0775fdaf15442a46c3fe98f4e6875c9c09046a99','nativeCommit':a.native_commit,'meaning':'All aerial frames retain their actual 0775 capture source, time, camera and gaps. This dependency audit does not turn them into c78 native captures or architectural parity. Native acceptance is limited to the separate actual controller/render cases.','districts':[],'runtimeDifferences':[],'runtimeEqualFiles':0,'items':[],'failures':[]}
for district in ['unirii','otopeni']:
 q=a.repo/'game/overview/comparison-data'/district;m=json.loads((q/'manifest.json').read_text());capture=json.loads((q/'capture-manifest.json').read_text());plan=json.loads((q/'poses.json').read_text());v=json.loads((q/'validation.json').read_text());review=json.loads((a.repo/'handoffs/fidelity'/('d-'+district)/'atlas-paired-review-0775fda.json').read_text())
 assert [x['id'] for x in m['items']]==[x['id'] for x in capture['items']]==[x['id'] for x in plan]==[x['id'] for x in review['rows']]
 assert len(m['items'])==len({x['id'] for x in m['items']})==v['frames']==review['pairedFramesInspected'];assert not v['failures'];assert v['manifestSha256']==sha(q/'capture-manifest.json')==review['captureManifestSha256'];assert m['gameSourceCommit']==report['captureCommit']
 before=a.capture_source/'game/data'/('bucharest-'+district+'.json');after=a.native_source/'game/data'/before.name;assert before.read_bytes()==after.read_bytes()
 report['districts'].append({'id':district,'frames':len(m['items']),'sourceFilesPreviouslyValidated':v['sourceFilesVerified'],'sourceDatasetByteIdentical':True,'sourceDatasetSha256':sha(after),'reviewLimitations':review['limitations'],'manifestSha256':sha(q/'manifest.json')})
 for item,raw,pose,r in zip(m['items'],capture['items'],plan,review['rows']):
  assert item['sha256']==raw['sha256']==r['gameSha256']==sha(q/item['image']);assert item['thumbnailSha256']==sha(q/item['thumbnail']);assert item['gameSourceCommit']==r['gameSourceCommit']==report['captureCommit'];assert item['capturedAt']==r['capturedAt'];assert r['referenceAvailable'] and item['width']==item['height']==640
  for key in ['id','lat','lon','scope','boundsXZ','h','size','fov','heading','pitch']:assert item[key]==pose[key]
  # The capture reprojects the planned WGS84 centre into runtime XZ.
  # Preserve its actual floats and verify only this floating-point round trip.
  assert max(abs(item[k]-pose[k]) for k in ['x','z'])<1e-7
  report['items'].append({'district':district,'id':item['id'],'scope':item['scope'],'gameSourceCommit':item['gameSourceCommit'],'capturedAt':item['capturedAt'],'imageSha256':item['sha256'],'thumbnailSha256':item['thumbnailSha256'],'pose':{k:item[k] for k in ['lat','lon','x','z','h','cameraBaseY','cameraY','size','fov','boundsXZ','boundsWgs84','heading','pitch']},'conditions':{k:item[k] for k in ['weather','season','time','traffic','renderer']},'pairedReferenceInspected':True,'referenceDateKnown':False,'reviewSheet':r['contactSheet'],'nativeFreezeCapture':False,'reviewStatus':'reviewed-with-gaps'})
for before in sorted((a.capture_source/'game/src').rglob('*')):
 if not before.is_file():continue
 relative=before.relative_to(a.capture_source);after=a.native_source/relative
 if not after.exists():report['runtimeDifferences'].append({'path':str(relative),'captureSha256':sha(before),'nativeSha256':None});continue
 old,new=sha(before),sha(after)
 if old==new:report['runtimeEqualFiles']+=1
 else:report['runtimeDifferences'].append({'path':str(relative),'captureSha256':old,'nativeSha256':new})
for after in sorted((a.native_source/'game/src').rglob('*')):
 if after.is_file() and not (a.capture_source/after.relative_to(a.native_source)).exists():
  report['runtimeDifferences'].append({'path':str(after.relative_to(a.native_source)),'captureSha256':None,'nativeSha256':sha(after)})
report['aerialFramesAudited']=len(report['items']);assert report['aerialFramesAudited']==205
report['scopeCounts']=dict(collections.Counter(x['scope'] for x in report['items']));a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'frames':205,'runtimeEqualFiles':report['runtimeEqualFiles'],'runtimeChangedFiles':len(report['runtimeDifferences']),'sourceDatasetsByteIdentical':True,'output':str(a.out),'sha256':sha(a.out)}))
