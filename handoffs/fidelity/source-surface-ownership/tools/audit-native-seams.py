#!/usr/bin/env python3
"""Independent intersection of recorded ACTUAL native canonical triangles."""
import argparse,json,math,pathlib,struct
p=argparse.ArgumentParser();p.add_argument('--reports',nargs='+',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);a=p.parse_args()
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return[a[0]-b[0],a[1]-b[1]]
def area(p):return sum(cross(p[i],p[(i+1)%len(p)])for i in range(len(p)))/2 if len(p)>=3 else 0

def intersect(poly,clip):
 sign=1 if area(clip)>0 else -1
 for i in range(3):
  lo,hi=clip[i],clip[(i+1)%3];d=sub(hi,lo);result=[]
  for j in range(len(poly)):
   u,v=poly[j],poly[(j+1)%len(poly)];x=sign*cross(d,sub(u,lo));y=sign*cross(d,sub(v,lo));inside=x>=-1e-10;nextin=y>=-1e-10
   if inside:result.append(u)
   if inside!=nextin:
    f=x/(x-y);result.append([u[k]+(v[k]-u[k])*f for k in range(2)])
  poly=result
  if len(poly)<3:return[]
 return poly

def inside(p,ring):
 yes=False
 for i,v in enumerate(ring):
  u=ring[i-1]
  if(u[1]>p[1])!=(v[1]>p[1])and p[0]<(v[0]-u[0])*(p[1]-u[1])/(v[1]-u[1])+u[0]:yes=not yes
 return yes

def distance(p,ring):
 out=math.inf
 for i,v in enumerate(ring):
  u=ring[i-1];d=sub(v,u);q=sub(p,u);t=max(0,min(1,(q[0]*d[0]+q[1]*d[1])/(d[0]**2+d[1]**2)));out=min(out,math.dist(p,[u[k]+t*d[k]for k in range(2)]))
 return out
f32=lambda n:struct.unpack('f',struct.pack('f',n))[0]
data=json.loads(pathlib.Path(a.data).read_text());bodies=[{'sourceId':data['buildingIds'][i],'ring':[[f32(v)for v in p]for p in data['buildingFootprints'][str(i)]]}for i in [380,381]]
A=[48.140499,-728.470276];B=[140.685898,-759.576111];dx,dz=B[0]-A[0],B[1]-A[1];L=math.hypot(dx,dz)
out={'scope':'Independent positive-area intersections of actual emitted canonical source triangles in2confirmed source seams. Diagnostic threshold1e-8m², no acceptance tolerance. Complete raw selected triangles and native restoration witnesses retained in input reports. Not whole-district/full-path/flicker acceptance.','sources':[]}
for name in a.reports:
 report=json.loads(pathlib.Path(name).read_text())
 for test in report['tests']:
  if not test.get('nativeSurfaces'):continue
  summary={'label':test['label'],'source':test['source'],'scopes':{}}
  for scope in ['campus-cf-ck-roof-seam','belvedere-shared-source-wall']:
   rows=[r for r in test['nativeSurfaces']['rows']if r['scope']==scope];pairs=[]
   project=lambda row:[[p[0],p[2]]if scope.startswith('campus')else[((p[0]-A[0])*dx+(p[2]-A[1])*dz)/L,p[1]]for p in row['vertices']]
   for i,one in enumerate(rows):
    ap=project(one)
    for two in rows[i+1:]:
     bp=project(two)
     if area(ap)*area(bp)<=0:continue # opposite-facing surfaces retained separately in raw
     poly=intersect(ap,bp);size=abs(area(poly))
     if size<=1e-8:continue
     pair={'a':{'mesh':one['mesh'],'triangle':one['triangle'],'vertices':one['vertices']},'b':{'mesh':two['mesh'],'triangle':two['triangle'],'vertices':two['vertices']},'overlapAreaM2':size,'projectedIntersection':poly}
     if scope.startswith('campus'):
      centre=[sum(p[k]for p in poly)/len(poly)for k in [0,1]]
      pair['physicalSourceContainsWitness']=[b['sourceId']for b in bodies if inside(centre,b['ring'])]
      pair['nearestSourceBoundaryM']=min(distance(centre,b['ring'])for b in bodies)
      pair['classification']='inferred-detail-pair'if one['mesh'].startswith('detail')and two['mesh'].startswith('detail')else'actual-roof-detail-pair'
     pairs.append(pair)
   summary['scopes'][scope]={'recordedTriangles':len(rows),'positiveSameFacingPairs':len(pairs),'totalPairIntersectionM2':sum(p['overlapAreaM2']for p in pairs),'pairs':pairs}
  out['sources'].append(summary)
pathlib.Path(a.out).write_text(json.dumps(out,indent=2)+'\n')
for s in out['sources']:print(s['label'],{k:(v['positiveSameFacingPairs'],v['totalPairIntersectionM2'])for k,v in s['scopes'].items()})
