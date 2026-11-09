import base64,json,pathlib,gzip,hashlib,argparse,numpy as np
p=argparse.ArgumentParser();p.add_argument("--world",required=True);p.add_argument("--out",required=True);args=p.parse_args()
source=pathlib.Path(args.world);raw=source.read_bytes();w=json.loads(gzip.decompress(raw));types={'Float32Array':'<f4','Uint16Array':'<u2','Uint32Array':'<u4','Float64Array':'<f8','Uint8Array':'u1'}
def dec(d): return np.frombuffer(base64.b64decode(d['data']),dtype=types[d['type']])
out=[];excluded=[]
for m in w['meshes']:
 layer=m['name'].split(' ')[0]
 if layer not in ['area','grass','pave','sport','ground','road','junction','water']or m['name']=='ground':continue
 c=m.get('canonical');
 if c: assert c['canonicalCapture']['captured'] and c['canonicalCapture']['restored']
 P=dec(m['position']).reshape(-1,m['position']['itemSize'])[:,:3].astype(float);ix=dec(c['canonicalIndex'])if c else dec(m['index'])if m['index']else np.arange(len(P));dr=c['canonicalDrawRange']if c else m['drawRange'];start=dr['start'];count=dr.get('count');ix=ix[start:None if count is None else start+count];M=np.array(m['matrixWorld']).reshape(4,4).T;P=P@M[:3,:3].T+M[:3,3];T=P[ix.reshape(-1,3)];lo=T.min(1);hi=T.max(1);near=(hi[:,0]>=-475)&(lo[:,0]<=-345)&(hi[:,2]>=-50)&(lo[:,2]<=650)
 rows=[]
 for k in np.where(near)[0]:
  t=T[k];normal=np.cross(t[1]-t[0],t[2]-t[0])
  if normal[1]<=1e-9:continue
  if layer=='ground'and np.all(np.abs(t[:,1]-.06)<1e-6):excluded.append({'objectId':m['id'],'triangle':int(k+start//3),'basis':'historical generated gray lid; new owner index is constructed before these lids are emitted'});continue
  if layer!='water'and t[:,1].min()<-.3-1e-9:continue
  rows.append({'triangle':int(k+start//3),'vertices':t.tolist()})
 if rows:out.append({'objectId':m['id'],'name':m['name'],'canonical':bool(c),'water':layer=='water','triangles':rows})
f={'source':'395071c21079fb14c25af194a9903a5ae5d87b26','geometryGzipSHA256':hashlib.sha256(raw).hexdigest(),'scope':'Actual canonical overhead source skins in retained historical Pasaj corridor. Generated old gray lids excluded by exact production feature/height; source geometry itself is not mutated. Private water-big full retained topology is unavailable and not claimed. Runtime owner index reads native pre-roof builders, so no retrospective lid filter exists in production.','meshes':out,'historicalGeneratedLidsExcluded':excluded,'unknown':'Private water-big retained topology not present; native final-world water/source gate remains open.'};payload=(json.dumps(f,separators=(',',':'))+'\n').encode();target=pathlib.Path(args.out);target.write_bytes(gzip.compress(payload,mtime=0));print({'nativeMeshes':len(out),'nativeTriangles':sum(len(m['triangles'])for m in out),'oldGeneratedLidsExcluded':len(excluded),'gzipBytes':target.stat().st_size,'rawSHA256':hashlib.sha256(payload).hexdigest()})
