#!/usr/bin/env python3
"""Independent native typed-buffer/world-matrix audit. No producer certificates."""
import argparse,base64,gzip,json,pathlib,hashlib
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--review',required=True);p.add_argument('--out',required=True);a=p.parse_args();raw=pathlib.Path(a.world).read_bytes();w=json.loads(gzip.decompress(raw));review=json.load(open(a.review));ring=review['sourceCanopy']['projected'];rooflo=np.min(ring,axis=0);roofhi=np.max(ring,axis=0)
dtypes={'Float32Array':'<f4','Float64Array':'<f8','Uint16Array':'<u2','Uint32Array':'<u4','Int16Array':'<i2','Uint8Array':'u1'}
def decode(r):
 v=np.frombuffer(base64.b64decode(r['data']),dtype=dtypes[r['type']]);assert len(v)==r['length'];return v
alltris=[];roof=[];integrity=[]
for m in w['meshes']:
 if not m['name'].split(' ')[0] in ['solid','ground','grass','pave','area','road','junction','roofs']:continue
 pos=decode(m['position']).reshape(-1,m['position']['itemSize'])[:,:3].astype(np.float64);M=np.array(m['matrixWorld']).reshape(4,4).T;pos=pos@M[:3,:3].T+M[:3,3]
 c=m.get('canonical');ind=decode(c['canonicalIndex'] if c else m['index']) if (c or m['index']) else np.arange(len(pos));ran=c['canonicalDrawRange'] if c else m['drawRange'];start=ran['start'];count=ran.get('count');ind=ind[start:None if count is None else start+count];assert len(ind)%3==0
 if c:assert c['canonicalCapture']['captured'] and c['canonicalCapture']['restored']
 t=pos[ind.reshape(-1,3)];lo=t.min(axis=1);hi=t.max(axis=1);mask=(hi[:,0]>=40)&(lo[:,0]<=220)&(hi[:,2]>=-310)&(lo[:,2]<=-140)
 for fi in np.where(mask)[0]:
  tri=t[fi];n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);entry={'objectId':m['id'],'name':m['name'],'triangle':int(fi+start//3),'vertices':tri.tolist(),'normal':n.tolist(),'side':m['material'][0]['side'],'depthWrite':m['material'][0]['depthWrite'],'renderOrder':m['renderOrder']};alltris.append(entry)
  if np.all(np.abs(tri[:,1]-4.8)<1e-5) and n[1]<0 and np.all(tri[:,0]>=rooflo[0]-1e-4) and np.all(tri[:,0]<=roofhi[0]+1e-4) and np.all(tri[:,2]>=rooflo[1]-1e-4) and np.all(tri[:,2]<=roofhi[1]+1e-4):roof.append(entry)
 integrity.append({'objectId':m['id'],'name':m['name'],'canonical':bool(c),'sourceTriangles':len(ind)//3,'localTriangles':int(mask.sum()),'positionBytesSha256':hashlib.sha256(base64.b64decode(m['position']['data'])).hexdigest()})
def heights(x,z):
 hits=[]
 for t in alltris:
  A,B,C=t['vertices'];ax,az=B[0]-A[0],B[2]-A[2];bx,bz=C[0]-A[0],C[2]-A[2];den=ax*bz-az*bx
  if abs(den)<1e-12:continue
  u=((x-A[0])*bz-(z-A[2])*bx)/den;v=(ax*(z-A[2])-az*(x-A[0]))/den
  if u < -1e-10 or v < -1e-10 or u+v>1+1e-10:continue
  y=A[1]+u*(B[1]-A[1])+v*(C[1]-A[1]);hits.append({**{k:t[k] for k in ['objectId','name','triangle','side','depthWrite','renderOrder']},'y':y,'normalY':t['normal'][1]})
 return sorted(hits,key=lambda h:h['y'],reverse=True)
samples=[]
for e in w['allEdges']:
 if e['id'] not in [788,789,790,791,440,441]:continue
 for u in [.2,.5,.8]:
  x=e['a']['x']+(e['b']['x']-e['a']['x'])*u;z=e['a']['z']+(e['b']['z']-e['a']['z'])*u;y=.24+e['ya']+(e['yb']-e['ya'])*u;hs=heights(x,z);above=[h for h in hs if h['y']>y+1.36 and (h['normalY']<0 or h['side']==2)];earth=[h for h in hs if h['y']<3 and h['y']>-.3 and (h['normalY']>0 or h['side']==2)]
  samples.append({'edgeId':e['id'],'sourceRoad':w['data']['roadSourceGeometry'][str(e['road'])]['sourceId'],'u':u,'x':x,'z':z,'roadSurfaceY':y,'driverEyeY':y+1.36,'earthAbove':earth,'earthAboveDriverEye':[h for h in earth if h['y']>y+1.36],'earthAboveRoad':[h for h in earth if h['y']>y],'frontFacingCeilingAbove':above,'allVerticalFaces':hs})
area=lambda poly:abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))/2)
out={'source':json.load(open(pathlib.Path(a.world).parent/'report.json'))['source'],'worldGzipSha256':hashlib.sha256(raw).hexdigest(),'method':'Independent Float32 canonical/native source indices, actual full mesh matrices, triangle winding/material-side/depthWrite and vertical barycentric intersections; no producer support certificate used. Ray-grid samples are geometry witnesses, not a completed drive.', 'nativeCanopy':{'sourceId':review['sourceCanopyId'],'bottomTriangles':roof,'actualUndersideY':sorted(set(t['vertices'][i][1] for t in roof for i in range(3))),'actualAreaM2':sum(abs(t['normal'][1])/2 for t in roof),'sourceAreaM2':area(ring),'roadSurfaceY':.24,'legalMaxheightM':4.25,'modelPhysicalOpeningM':4.8-.24,'dimensionConfidence':'Existing canopy5.2/4.8m dimensions are researched authoring estimates; actual emitted Float32 vertices checked independently.'},'coposuSamples':samples,'bufferIntegrity':integrity,'notCompleted':'Native rush journey stopped on ordinary traffic before reaching Coposu; no cockpit descent/passage acceptance.'};pathlib.Path(a.out).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'samples':len(samples),'localTriangles':len(alltris),'undersideTriangles':len(roof),'actualUndersideAreaM2':out['nativeCanopy']['actualAreaM2'],'sourceCanopyAreaM2':out['nativeCanopy']['sourceAreaM2'],'canopyY':out['nativeCanopy']['actualUndersideY'],'earthDepthWriteFalseSamples':sum(any(not h['depthWrite'] for h in s['earthAbove']) for s in samples),'noFrontFacingCeilingSamples':sum(not s['frontFacingCeilingAbove'] for s in samples)}))
