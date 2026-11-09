#!/usr/bin/env python3
"""Retain every captured source road station; do not invent an AFTER profile."""
import argparse, pathlib, json, gzip, math, hashlib
p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--out',required=True);a=p.parse_args()
raw=pathlib.Path(a.before).read_bytes();w=json.loads(gzip.decompress(raw));rows=[];unresolved=[]
for e in w['allEdges']:
 source=w['roadSources'].get(str(e['road']))
 if not source or not source.get('sourceId') or len(source.get('projected',[]))<2:
  unresolved.append({'beforeEdgeId':e['id'],'reason':'missing-literal-source-way'});continue
 for t in [0,.25,.5,.75,1]:
  x=e['a']['x']+(e['b']['x']-e['a']['x'])*t;z=e['a']['z']+(e['b']['z']-e['a']['z'])*t
  distances=[]
  for k,(b,c)in enumerate(zip(source['projected'],source['projected'][1:])):
   dx=c[0]-b[0];dz=c[1]-b[1];L=dx*dx+dz*dz
   if not L:continue
   u=max(0,min(1,((x-b[0])*dx+(z-b[1])*dz)/L));d=math.hypot(x-b[0]-dx*u,z-b[1]-dz*u);distances.append((d,k,u))
  d,k,u=min(distances)
  if d>1e-6:
   unresolved.append({'beforeEdgeId':e['id'],'t':t,'sourceId':source['sourceId'],'reason':'captured-point-not-on-literal-source','distanceM':d});continue
  node=e['a']if t==0 else e['b']if t==1 else None
  rows.append({'sourceId':source['sourceId'],'sourceSegmentIndex':k,'sourceFraction':u,'x':x,'z':z,
   'beforeEdgeId':e['id'],'beforeEdgeFraction':t,'sourceNodeId':node.get('sourceId')if node and node.get('sourceId',0)>0 else None,
   'beforeModelDepthM':e['ya']+(e['yb']-e['ya'])*t,'beforeRoadSurfaceM':.24+e['ya']+(e['yb']-e['ya'])*t,
   'beforeHeightBasis':'actual captured native endpoint'if t in[0,1]else'derived linear segment between captured native endpoints; not a new native query',
   'roadClass':'pasaj-main'if e['road']in[12,13,213]else'pasaj-ramp'if e['road']in[5,14,82,131]else'other-tunnel'if e.get('tunnel')else'bridge'if e.get('bridge')else'ordinary',
   'rawSourceTags':source['tags']})
out={'beforeSource':w['source'],'beforeNativeGzipSHA256':w['nativeWorldGzipSHA256'],'inputFixtureGzipSHA256':hashlib.sha256(raw).hexdigest(),
 'scope':'All retained core-source edges, including ordinary streets. Fresh paired native source queries are required for current BEFORE/AFTER and passive scenery; no missing source is filled with zero. No nearest other road/level is permitted.',
 'queries':rows,'unresolved':unresolved,'passiveSceneryGap':'Historical export has core allEdges only; fresh paired World exports must retain passive scenery profiles/grade provenance as well.'}
b=(json.dumps(out,separators=(',',':'))+'\n').encode();pathlib.Path(a.out).write_bytes(gzip.compress(b,mtime=0));print(json.dumps({'queries':len(rows),'unresolved':len(unresolved),'categories':{k:sum(r['roadClass']==k for r in rows)for k in sorted(set(r['roadClass']for r in rows))}}))
