#!/usr/bin/env python3
"""PRIVATE original/retake/reference triplets using existing local reference pixels.

Only its hash ledger may be copied to the public repository. No network request.
"""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--base',type=Path,required=True);a=p.parse_args()
load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
repo=a.root.resolve();outbase=a.base.resolve();assert repo not in outbase.parents
prior=Path('/workspace/reality-pass')
for district in ['seatac','bellevue','grozavesti','pipera','unirii']:
 cap=outbase/('retakes-'+district);current=load(cap/'manifest.json');old=load(repo/'game/overview/comparison-data'/district/'manifest.json');original={i['id']:i for i in old['items']}
 out=outbase/('private-review-'+district);out.mkdir(exist_ok=False);(out/'triplets').mkdir();(out/'sheets').mkdir();(out/'references').mkdir()
 mosaics=[]
 if district in ['seatac','bellevue']:
  refdir=prior/'us-districts'/district/'atlas-reference-c78a5f4';refmanifest=refdir/'report.json';refs={r['id']:r for r in load(refmanifest)['captures']}
 elif district=='pipera':
  refdir=prior/'pipera/final-grid-reference-review';refmanifest=refdir/'manifest.json';refs={r['id']:r for r in load(refmanifest)['items']}
 elif district=='unirii':
  refdir=prior/'remaining-ro/unirii/atlas-0775fda';refmanifest=refdir/'private-pair-index.json';refs={r['id']:r for r in load(refmanifest)['rows']}
 else:
  refmanifest=prior/'original-districts-refresh/water-overlap-bbaffc/private-pairs-grozavesti/comparison-manifest.json';refs={}
  for s in load(refmanifest)['sources']:
   f=Path(s['path']);assert sha(f)==s['sha256'];im=Image.open(f).convert('RGB');mosaics.append((im,s['metadata'],Image.new('L',im.size,255)))
 def pixel(lat,lon,m):
  n=256*2**m['z'];return((lon+180)/360*n-m['px0'],(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n-m['py0'])
 rows=[]
 for i,item in enumerate(current['items']):
  id=item['id'];before=original[id];assert sha(repo/'game/overview/comparison-data'/district/before['image'])==before['sha256'];assert sha(cap/item['image'])==item['sha256']
  if district in ['seatac','bellevue']:
   record=refs[id];ref=refdir/record['image'];assert sha(ref)==record['sha256'];assert record['sizeGroundM']==item['size'];image=Image.open(ref).convert('RGB');coverage=1.;method='Existing private official Esri square export for the identical atlas ID/ground size; original request bounds retained in the reference ledger.'
  elif district=='pipera':
   record=refs[id];ref=refdir/'reference'/(id+'.jpg');assert sha(ref)==record['referenceSha256'];assert max(abs(x-y)for x,y in zip(item['boundsXZ'],record['groundBoundsXZ']))<1e-6;image=Image.open(ref).convert('RGB');coverage=record['referenceCoverageFraction'];method='Existing private georeferenced mosaic crop; exact original ground bounds checked.'
  elif district=='unirii':
   record=refs[id];ref=refdir/'private-aerial'/(id+'.jpg');assert sha(ref)==record['referenceCropSha256'];assert record['referenceAvailable'];image=Image.open(ref).convert('RGB');coverage=1. if(record['referenceInsideMeasuredMosaic']or record['supplementalOfficialExport'])else 0.;method='Existing private Unirii mosaic/supplement crop for the unchanged atlas ground square.'
  else:
   image=Image.new('RGB',(640,640),'#5a214b');mask=Image.new('L',(640,640),0);south,west,north,east=item['boundsWgs84']
   for im,m,source_mask in reversed(mosaics):
    x0,y0=pixel(north,west,m);x1,y1=pixel(south,east,m);box=(x0,y0,x1,y1);clip=source_mask.transform((640,640),Image.Transform.EXTENT,box,resample=Image.Resampling.NEAREST,fillcolor=0);crop=im.transform((640,640),Image.Transform.EXTENT,box,resample=Image.Resampling.BICUBIC,fillcolor=0);image.paste(crop,(0,0),clip);mask.paste(255,(0,0),clip)
   coverage=sum(mask.histogram()[1:])/(640*640);record={'id':id,'boundsWgs84':item['boundsWgs84']};method='Same native existing private Esri mosaics and exact ground-to-pixel transform; purple marks uncovered reference.'
  assert image.size==(640,640);refcopy=out/'references'/(id+'.jpg');image.save(refcopy,quality=94)
  triplet=Image.new('RGB',(1920,672),'#15191d');draw=ImageDraw.Draw(triplet)
  for col,(pic,label)in enumerate([(Image.open(repo/'game/overview/comparison-data'/district/before['image']).convert('RGB'),'ORIGINAL '+before['gameSourceCommit'][:8]),(Image.open(cap/item['image']).convert('RGB'),'RETAKE '+item['gameSourceCommit'][:8]),(image,'ESRI / acquisition unknown')]):
   triplet.paste(pic,(col*640,32));draw.text((col*640+6,5),id+' | '+label,fill='white')
  f=out/'triplets'/(id+'.jpg');triplet.save(f,quality=92)
  rows.append({'id':id,'originalGameSha256':before['sha256'],'originalSourceCommit':before['gameSourceCommit'],'retakeGameSha256':item['sha256'],'gameSourceCommit':item['gameSourceCommit'],'referenceCropSha256':sha(refcopy),'referenceCoverageFraction':coverage,'referenceManifestSha256':sha(refmanifest),'referenceRecord':record,'referenceMethod':method,'triplet':'triplets/'+id+'.jpg','tripletSha256':sha(f),'sheet':'sheets/comparison-'+f'{i//4+1:02}'+'.jpg'})
 for start in range(0,len(rows),4):
  selected=rows[start:start+4];sheet=Image.new('RGB',(1920,math.ceil(len(selected)/2)*336),'#15191d')
  for i,row in enumerate(selected):sheet.paste(Image.open(out/row['triplet']).resize((960,336),Image.Resampling.LANCZOS),((i%2)*960,(i//2)*336))
  sheet.save(out/'sheets'/f'comparison-{start//4+1:02}.jpg',quality=92)
 report={'sourceCommit':current['gameSourceCommit'],'district':district,'pairs':rows,'referenceAcquisitionDate':None,'referenceProvider':'Esri World Imagery','privateOnly':True,'method':'Original/retake/reference triplets; private reference pixels and private sheets never published. Perspective roof displacement, unknown imagery date and source estimates remain explicit.'}
 (out/'comparison-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(district,len(rows),'coverage',[r['referenceCoverageFraction']for r in rows],flush=True)
