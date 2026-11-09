#!/usr/bin/python3
"""Classify axis-coverage misses against actual whole native/cache triangles."""
import argparse,gzip,hashlib,json,pathlib,struct
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--cache',required=True);p.add_argument('--boundary',required=True);p.add_argument('--audit',required=True);p.add_argument('--output',required=True);opts=p.parse_args();raw=gzip.decompress(pathlib.Path(opts.cache).read_bytes());n=struct.unpack_from('<I',raw,12)[0];m=json.loads(raw[16:16+n]);base=16+(n+3)//4*4;b=next(b for b in m['batches']if b['key']=='terrain');d=b['attributes']['position'];P=np.frombuffer(raw,'<f4',d['count'],base+d['byteOffset']).reshape(-1,3);d=b['index'];I=np.frombuffer(raw,'<u4',d['count'],base+d['byteOffset']).reshape(-1,3);T=P[I].astype(float);lo=T.min(axis=1);hi=T.max(axis=1);boundary=json.load(open(opts.boundary));audit=json.load(open(opts.audit));reports=[]
def closest(point,triangle):
 a,b,c=triangle;ab=b-a;ac=c-a;n=np.cross(ab,ac);den=n@n
 if den:
  q=point-n*((point-a)@n)/den;d=q-a;D=(ab@ab)*(ac@ac)-(ab@ac)**2
  if D:
   v=((ac@ac)*(d@ab)-(ab@ac)*(d@ac))/D;w=((ab@ab)*(d@ac)-(ab@ac)*(d@ab))/D
   if v>=0 and w>=0 and v+w<=1:return q
 hits=[]
 for a,b in[(a,b),(b,c),(c,a)]:
  d=b-a;den=d@d;q=a+(np.clip((point-a)@d/den,0,1)if den else 0)*d;hits.append(q)
 return min(hits,key=lambda q:np.linalg.norm(point-q))
for gap in audit['seam']['uncovered']:
 side=gap['side'];axis=2 if side in('west','east')else 0;fixed=0 if axis==2 else 2;value={'west':-4000,'east':4000,'north':-3600,'south':3600}[side];seg=next(s for s in boundary['drySegments']if s['side']==side and min(q[axis]for q in s['points'])<=gap['lo'] and max(q[axis]for q in s['points'])>=gap['hi']);A,B=sorted(seg['points'],key=lambda q:q[axis]);ends=[]
 for v in[gap['lo'],gap['hi']]:
  q=np.asarray(A,float).copy();q[axis]=v;q[1]=A[1]+(B[1]-A[1])*(v-A[axis])/(B[axis]-A[axis]);ends.append(q)
 guard=audit['seam']['calculatedSerializationBoundM'];ids=np.where((lo[:,fixed]<=value+guard)&(hi[:,fixed]>=value-guard)&(lo[:,axis]<=gap['hi']+guard)&(hi[:,axis]>=gap['lo']-guard))[0];best=None
 for i in ids:
  hit=[closest(q,T[i])for q in ends];dist=max(np.linalg.norm(q-r)for q,r in zip(ends,hit))
  if best is None or dist<best['maxEndpointDistanceM']:best={'triangle':int(i),'vertices':T[i].tolist(),'closestEndpoints':[q.tolist()for q in hit],'maxEndpointDistanceM':float(dist)}
 reports.append({'gap':gap,'nearSegmentEndpoints':[q.tolist()for q in ends],'candidateTriangles':len(ids),'actualSurfaceWitness':best,'convexDistanceBoundsWholeSegment':True,'withinCalculatedSerializationBound':best is not None and best['maxEndpointDistanceM']<=guard})
r={'scope':'Actual cache triangles vs actual native kernel segment; convex point-to-triangle distance bounds the complete segment. No geometry adjustment or widened clearance.','cacheSHA256':hashlib.sha256(pathlib.Path(opts.cache).read_bytes()).hexdigest(),'oldAlongAxisCoverageFailureRetained':True,'segments':reports,'passed':all(r['withinCalculatedSerializationBound']for r in reports)};pathlib.Path(opts.output).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
