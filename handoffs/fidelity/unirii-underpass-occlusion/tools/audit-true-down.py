#!/usr/bin/env python3
"""Actual immutable native canonical geometry, not an inferred roof oracle."""
import argparse,gzip,json,pathlib,base64,hashlib,numpy as np
p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--graph',required=True);p.add_argument('--out',required=True);a=p.parse_args();raw=pathlib.Path(a.world).read_bytes();w=json.loads(gzip.decompress(raw));g=json.load(gzip.open(a.graph));types={'Float32Array':'<f4','Float64Array':'<f8','Uint16Array':'<u2','Uint32Array':'<u4','Uint8Array':'u1'}
def dec(d):
 v=np.frombuffer(base64.b64decode(d['data']),dtype=types[d['type']]);assert len(v)==d['length'];return v
tri=[];meta=[];buffers=[]
for m in w['meshes']:
 if m['name'].split(' ')[0] not in ['ground','solid','area','grass','pave','road','junction']:continue
 pos=dec(m['position']).reshape(-1,m['position']['itemSize'])[:,:3].astype(float);M=np.array(m['matrixWorld']).reshape(4,4).T;pos=pos@M[:3,:3].T+M[:3,3];c=m.get('canonical');ind=dec(c['canonicalIndex'] if c else m['index']) if(c or m['index'])else np.arange(len(pos));dr=c['canonicalDrawRange']if c else m['drawRange'];start=dr['start'];count=dr.get('count');ind=ind[start:None if count is None else start+count];t=pos[ind.reshape(-1,3)];lo=t.min(axis=1);hi=t.max(axis=1);mask=(hi[:,0]>=-475)&(lo[:,0]<=-345)&(hi[:,2]>=-70)&(lo[:,2]<=650)
 if c:assert c['canonicalCapture']['restored'] and c['canonicalCapture']['captured']
 for k in np.where(mask)[0]:tri.append(t[k]);meta.append({'objectId':m['id'],'name':m['name'],'triangle':int(k+start//3),'side':m['material'][0]['side'],'depthWrite':m['material'][0]['depthWrite'],'renderOrder':m['renderOrder']})
 buffers.append({'objectId':m['id'],'name':m['name'],'canonical':bool(c),'sourceTriangles':len(ind)//3,'localTriangles':int(mask.sum())})
T=np.array(tri);A=T[:,0,:];B=T[:,1,:]-A;C=T[:,2,:]-A;den=B[:,0]*C[:,2]-B[:,2]*C[:,0];ny=-den;lo=T.min(axis=1);hi=T.max(axis=1)
def query(x,z):
 ids=np.where((lo[:,0]<=x+1e-10)&(hi[:,0]>=x-1e-10)&(lo[:,2]<=z+1e-10)&(hi[:,2]>=z-1e-10)&(np.abs(den)>1e-12))[0];q=[]
 for i in ids:
  u=((x-A[i,0])*C[i,2]-(z-A[i,2])*C[i,0])/den[i];v=(B[i,0]*(z-A[i,2])-B[i,2]*(x-A[i,0]))/den[i]
  if u>=-1e-10 and v>=-1e-10 and u+v<=1+1e-10:q.append({**meta[i],'y':float(A[i,1]+u*B[i,1]+v*C[i,1]),'normalY':float(ny[i]),'vertices':T[i].tolist()})
 return q
samples=[];bad=[];inversions=[];edges=[e for e in g['allEdges'] if e['road']in[12,13,213]]
for e in edges:
 for u in [0,.02,.1,.5,.9,.98,1]:
  for lateral in [-1.75,1.75]:
   x=e['a']['x']+(e['b']['x']-e['a']['x'])*u+e['nx']*lateral;z=e['a']['z']+(e['b']['z']-e['a']['z'])*u+e['nz']*lateral;y=.24+e['ya']+(e['yb']-e['ya'])*u;hs=query(x,z);ceil=sorted([h for h in hs if h['name'].startswith('solid ') and h['normalY']<0 and h['y']>y+1.36],key=lambda h:h['y']);lids=[h for h in hs if h['name'].startswith('ground ') and h['normalY']>0 and abs(h['y']-.06)<1e-6];ground=[h for h in hs if h['name'].split(' ')[0] in ['grass','pave','area'] and h['normalY']>0 and -.3<h['y']<.5];s={'edgeId':e['id'],'road':e['road'],'u':u,'lateralM':lateral,'x':x,'z':z,'roadY':y,'eyeY':y+1.36,'lidded':e.get('lidded'),'ceiling':ceil[:1],'lids':lids,'flatSourceGround':ground};samples.append(s)
   if not ceil or not lids:bad.append(s)
   if ceil and lids and ceil[0]['y']>min(h['y']for h in lids):inversions.append(s)
report={'source':'395071c21079fb14c25af194a9903a5ae5d87b26','geometryGzipSha256':hashlib.sha256(raw).hexdigest(),'graphSource':'Exact395 full native graph;112 true Pasaj profiles independently verified identical in fresh71.','scope':'Actual native emitted canonical solid/ground/flat-land geometry, two real source-lane centres at7stations/edge. This is offline geometry coverage, not a public driven passage or whole-body/camera visual pass. Private water-big topology and instanced actor geometry are explicitly outside this kernel.','edgeCount':len(edges),'samples':len(samples),'noCeilingOrLid':bad,'invertedCeilingAboveLid':inversions,'allSamples':samples,'buffers':buffers};pathlib.Path(a.out).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'edgeCount':len(edges),'sampleCount':len(samples),'noCeilingOrLid':len(bad),'invertedCeilingAboveLid':len(inversions),'missingEdgeIds':sorted(set(s['edgeId']for s in bad)),'invertedEdgeIds':sorted(set(s['edgeId']for s in inversions))}))
