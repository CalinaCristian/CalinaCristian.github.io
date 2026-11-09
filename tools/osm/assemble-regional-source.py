import argparse,base64,datetime,gzip,hashlib,importlib.util,json,pathlib,re,urllib.parse
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--raw-dir',required=True);p.add_argument('--context-source',required=True);p.add_argument('--output',required=True);opts=p.parse_args();raw=pathlib.Path(opts.raw_dir);sha=lambda b:hashlib.sha256(b).hexdigest();requests=[]
for p in sorted(list(raw.glob('*ledger.json'))+list((raw/'hydro').glob('*.ledger'))+list(raw.glob('*.json.ledger'))+[raw/'query-pair-check.json']):
 if not p.exists():continue
 d=json.load(open(p));requests.extend(d if isinstance(d,list) else [d])
unique={}
for r in requests:
 key=(r.get('file'),r.get('url'),r.get('sha256'),r.get('error'));unique[key]=r
requests=list(unique.values());needed={9:set(json.load(open(raw/'regional-ocean-ids.json'))['objectIds']),12:set(json.load(open(raw/'near-lakes-ids.json'))['objectIds'])};features={};alternates={};conflicts=[]
for ri,r in enumerate(requests):
 if r.get('error')or not r.get('sha256'):continue
 p=raw/r.get('file','')
 if not p.is_file():continue
 body=p.read_bytes();assert sha(body)==r['sha256'],str(p)
 if p.suffix!='.json':continue
 try:d=json.loads(body)
 except:continue
 if not d.get('features'):continue
 m=re.search(r'/MapServer/(9|12)/',r.get('url',''))
 if not m:continue
 layer=int(m.group(1));sr=d.get('spatialReference',{});wkid=sr.get('latestWkid',sr.get('wkid'));assert wkid in (4326,3857,102100),wkid
 for f in d['features']:
  a=f['attributes'];oid=a['OBJECTID']
  if oid not in needed[layer]:continue
  assert 'rings'in f['geometry'];key=(layer,oid);record={'id':f'nhd:{layer}:{oid}','layer':layer,'objectId':oid,'permanentId':a.get('PERMANENT_IDENTIFIER'),'attributes':a,'spatialReference':sr,'rings':f['geometry']['rings'],'sourceRequest':ri}
  if key in features:
   old=features[key]
   if old['attributes']!=a:conflicts.append({'id':record['id'],'kind':'attribute-conflict','requests':[old['sourceRequest'],ri]})
   alternates.setdefault(record['id'],[]).append(ri)
   if wkid!=4326:continue
  features[key]=record
assert not conflicts,conflicts
src=json.load(open(opts.context_source));source={'schemaVersion':1,'status':'Regional source/cache candidate; not native visual or physical acceptance','frame':src['frame'],'sourceContextDataSHA256':sha(pathlib.Path(opts.context_source).read_bytes()),'sourceContextAsset':'seattle-context.json.gz','elevationGrids':[],'waterCoverage':{'oceanBayWGS84':[-124.2,46.25,-120.8,48.35],'lakeReservoirEstuaryWGS84':[-123,47.1,-121.9,48],'classes':{'9':[312,445],'12':[390,436,493]},'selectionBasis':'Official NHD water classes within explicit source envelopes. Rivers, wetlands and ice are outside this water-surface selection.'},'waterFeatures':sorted(features.values(),key=lambda x:(x['layer'],x['objectId'])),'unresolvedWaterFeatures':[{'id':f'nhd:{l}:{oid}','layer':l,'objectId':oid,'reason':'Official feature query failed; no geometry invented'} for l in needed for oid in sorted(needed[l]-{k[1] for k in features if k[0]==l})],'sourceRequests':requests,'alternateFeatureRequests':alternates,'notes':['Numeric public-domain USGS DEM/NHD sources only; no source-provider image pixels.','Literal source coordinates/elevations/rings/attributes retained; no vertical datum conversion applied.','Existing detailed local OSM and close-up physical source remain authoritative.','Source FDATE is retained verbatim and is not the retrieval date or a claim of a current survey.','NHD ELEVATION fields are retained; absent/unsupported surface levels remain model estimates or unresolved.','Geographic projection, LOD, rendered boundaries and derived fragments are separately measured render products.']}
for file in ['regional-513.tif','rainier-257.tif']:
 im=Image.open(raw/file);a=np.asarray(im,dtype='<f4');scale=im.tag_v2[33550];tie=im.tag_v2[33922];keys=im.tag_v2[34735];assert any(keys[i]==1025 and keys[i+3]==1 for i in range(4,len(keys),4));req=next(i for i,r in enumerate(requests) if r.get('file')==file and r.get('sha256')==sha((raw/file).read_bytes()));source['elevationGrids'].append({'id':file.removesuffix('.tif'),'nx':a.shape[1],'nz':a.shape[0],'westPixelCentre':tie[3]+scale[0]/2,'northPixelCentre':tie[4]-scale[1]/2,'lonStep':scale[0],'latStep':scale[1],'format':'float32-le-base64','pixelInterpretation':'Actual returned GeoTIFF PixelIsArea cell centres','verticalUnits':'metres','verticalDatum':'USGS3DEP numeric elevations; no local vertical datum conversion applied','sourceRequest':req,'sourceSHA256':sha((raw/file).read_bytes()),'heights':base64.b64encode(a.tobytes()).decode()})
source['detailedOSMCoverage']=src['sourceCoverage'];spec=importlib.util.spec_from_file_location('region_codec',pathlib.Path(__file__).with_name('region-source-codec.py'));codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec);source=codec.pack_water_coordinates(source)
b=json.dumps(source,separators=(',',':'),ensure_ascii=False).encode();target=pathlib.Path(opts.output);target.write_bytes(gzip.compress(b,compresslevel=9,mtime=0));summary={'sourceAsset':target.name,'compressedBytes':target.stat().st_size,'compressedSHA256':sha(target.read_bytes()),'uncompressedBytes':len(b),'uncompressedSHA256':sha(b),'elevationGrids':[{k:v for k,v in g.items() if k!='heights'}for g in source['elevationGrids']],'waterFeatures':len(features),'waterVertices':sum(sum(len(r)for r in f['rings'])for f in features.values()),'unresolvedWaterFeatures':len(source['unresolvedWaterFeatures']),'neededWaterFeatures':sum(map(len,needed.values())),'requestRecords':len(requests),'attributeConflicts':conflicts,'producerSHA256':sha(pathlib.Path(__file__).read_bytes())};target.with_suffix(target.suffix+'.report.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
