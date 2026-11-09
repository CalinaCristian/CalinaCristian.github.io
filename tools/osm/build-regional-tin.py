import argparse,base64,gzip,hashlib,json,math,pathlib,sys,time
import numpy as np
from PIL import Image
from scipy.spatial import Delaunay
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--context-source',required=True);p.add_argument('--native',required=True);p.add_argument('--boundary',required=True);p.add_argument('--output',required=True);opts=p.parse_args();source=json.load(open(opts.context_source));regional=json.loads(gzip.decompress(pathlib.Path(opts.source).read_bytes()));native=json.load(open(opts.native));scene=native['id'];origin=native['origin'];proj=native['projection'];boundaryKernel=json.load(open(opts.boundary))
def grid(g):return{'h':np.frombuffer(base64.b64decode(g['heights']),dtype='<f4').reshape(g['nz'],g['nx']).astype(float),'west':g['westPixelCentre'],'north':g['northPixelCentre'],'dx':g['lonStep'],'dz':g['latStep'],'id':g['id']}
t=source['terrain'];fine={'h':np.frombuffer(base64.b64decode(t['heights']),dtype='<f4').reshape(t['nz'],t['nx']).astype(float),'west':t['westPixelCentre'],'north':t['northPixelCentre'],'dx':t['lonStep'],'dz':t['latStep'],'id':'existing-surround'}
grids=[fine,grid(regional['elevationGrids'][1]),grid(regional['elevationGrids'][0])]
for g in grids:
 h=g['h'];g['xs']=(g['west']+np.arange(h.shape[1])*g['dx']-origin['lon'])*proj['mLon'];g['zs']=(origin['lat']-(g['north']-np.arange(h.shape[0])*g['dz']))*proj['mLat'];g['bbox']=(g['xs'][0],g['zs'][0],g['xs'][-1],g['zs'][-1])
def sample(x,z):
 for g in grids:
  a,b,c,d=g['bbox']
  if not(a<=x<=c and b<=z<=d):continue
  h=g['h'];u=np.clip((x-a)/(c-a)*(h.shape[1]-1),0,h.shape[1]-1);v=np.clip((z-b)/(d-b)*(h.shape[0]-1),0,h.shape[0]-1);i=min(h.shape[1]-2,int(u));j=min(h.shape[0]-2,int(v));u-=i;v-=j
  return (h[j,i]*(1-u)+h[j,i+1]*u)*(1-v)+(h[j+1,i]*(1-u)+h[j+1,i+1]*u)*v-origin['elev']
 raise ValueError(('unknown',x,z))

def geographic(p):
 lat=(origin['lat']-p[:,1]/proj['mLat'])*np.pi/180;lon=(origin['lon']+p[:,0]/proj['mLon'])*np.pi/180;h=p[:,2]+origin['elev'];A=6378137.;f=1/298.257223563;e2=f*(2-f);n=A/np.sqrt(1-e2*np.sin(lat)**2)
 xyz=np.column_stack(((n+h)*np.cos(lat)*np.cos(lon),(n+h)*np.cos(lat)*np.sin(lon),(n*(1-e2)+h)*np.sin(lat)))
 f0=origin['lat']*np.pi/180;l0=origin['lon']*np.pi/180;n0=A/np.sqrt(1-e2*np.sin(f0)**2);o=np.array([(n0+origin['elev'])*np.cos(f0)*np.cos(l0),(n0+origin['elev'])*np.cos(f0)*np.sin(l0),(n0*(1-e2)+origin['elev'])*np.sin(f0)]);delta=xyz-o
 enu=np.column_stack((-np.sin(l0)*delta[:,0]+np.cos(l0)*delta[:,1],np.cos(f0)*np.cos(l0)*delta[:,0]+np.cos(f0)*np.sin(l0)*delta[:,1]+np.sin(f0)*delta[:,2],np.sin(f0)*np.cos(l0)*delta[:,0]+np.sin(f0)*np.sin(l0)*delta[:,1]-np.cos(f0)*delta[:,2]))
 r=np.hypot(p[:,0],p[:,1]);t=np.clip((r-6000)/6000,0,1);w=t*t*(3-2*t);flat=p[:,[0,2,1]];return flat*(1-w[:,None])+enu*w[:,None]

points=[]
for gi,g in enumerate(grids):
 xx,zz=np.meshgrid(g['xs'],g['zs']);valid=np.ones(xx.shape,dtype=bool)
 for prior in grids[:gi]:
  a,b,c,d=prior['bbox'];valid&=~((xx>=a)&(xx<=c)&(zz>=b)&(zz<=d))
 points.append(np.column_stack((xx[valid],zz[valid],g['h'][valid]-origin['elev'])))
points=np.concatenate(points);a,b,c,d=grids[-1]['bbox'];axesx=[a,-4000,4000,c];axesz=[b,-3600,3600,d]
all_vertices=[];all_geographic=[];all_faces=[];reports=[];start=time.monotonic()
for j in range(3):
 for i in range(3):
  if i==1 and j==1:continue
  x0,x1=axesx[i:i+2];z0,z1=axesz[j:j+2];mask=(points[:,0]>=x0)&(points[:,0]<=x1)&(points[:,1]>=z0)&(points[:,1]<=z1);local=points[mask];boundary={}
  def add(x,z):boundary[(float(x),float(z))]=[x,z,sample(x,z)]
  for x in [x0,x1]:
   add(x,z0);add(x,z1)
   for g in grids:
    if g['bbox'][0]<=x<=g['bbox'][2]:
     for z in g['zs']:
      if z0<z<z1:add(x,z)
   if x in [-4000,4000]:
    for z in range(-3600,3601,40):
     if z0<=z<=z1:add(x,z)
  for z in [z0,z1]:
   for g in grids:
    if g['bbox'][1]<=z<=g['bbox'][3]:
     for x in g['xs']:
      if x0<x<x1:add(x,z)
   if z in [-3600,3600]:
    for x in range(-4000,4001,40):
     if x0<=x<=x1:add(x,z)
  # Retain every actual Float32 near-frame edge knot. Derived boundary heights
  # follow the exact emitted near triangle edge, not a second curved query.
  for x,h,z in boundaryKernel['outerBoundaryVertices']:
   if x0<=x<=x1 and z0<=z<=z1 and(x in(x0,x1)or z in(z0,z1)):boundary[(float(x),float(z))]=[x,z,h]
  for key,pnt in boundary.items():
   x,z,_=pnt
   if not(x in(-4000,4000)or z in(-3600,3600)):continue
   for seg in boundaryKernel['drySegments']:
    A,B=seg['points'];axis=2 if A[0]==B[0] else 0;fixed=0 if axis==2 else 2;v=z if axis==2 else x;f=x if fixed==0 else z
    if f==A[fixed]==B[fixed] and min(A[axis],B[axis])<=v<=max(A[axis],B[axis]):
     q=(v-A[axis])/(B[axis]-A[axis]);pnt[2]=float(np.float32(A[1]+q*(B[1]-A[1])));break
  boundary=np.array(list(boundary.values()));local=local[(local[:,0]>x0)&(local[:,0]<x1)&(local[:,1]>z0)&(local[:,1]<z1)];candidates=np.concatenate((boundary,local));xy=candidates[:,:2];unit=(xy-np.array([x0,z0]))/np.array([x1-x0,z1-z0]);height=candidates[:,2];reference=geographic(candidates);sel=list(range(len(boundary)));tolerance=np.maximum(1.0,np.minimum(np.hypot(xy[:,0],xy[:,1]),np.hypot(reference[:,0],reference[:,2]))-1000)*.0005;remaining=np.ones(len(candidates),bool);remaining[sel]=False
  # Add the actual global peak and low point before error-driven refinement.
  for q in [int(height.argmax()),int(height.argmin())]:
   if remaining[q]:sel.append(q);remaining[q]=False
  iterations=0
  while True:
   tri=Delaunay(unit[sel]);at=tri.find_simplex(unit);assert np.all(at[remaining]>=0), (i,j,xy[(at<0)&remaining][:5],unit[(at<0)&remaining][:5]);at[~remaining]=0
   transform=tri.transform[at];uv=np.einsum('nij,nj->ni',transform[:,:2],unit-transform[:,2]);weights=np.column_stack((uv,1-uv.sum(axis=1)));estimate=np.einsum('nij,ni->nj',reference[np.asarray(sel)[tri.simplices[at]]],weights);error=np.linalg.norm(estimate-reference,axis=1);error[~remaining]=0;maxerror=float(error.max())
   ratio=error/tolerance
   if float(ratio.max())<=1:break
   take=np.where(ratio>1)[0];take=take[np.argsort(ratio[take])[-min(512,len(take)):]];sel.extend(map(int,take));remaining[take]=False;iterations+=1
   if iterations>200:raise RuntimeError('Refinement budget exhausted')
  vertices=candidates[sel];faces=tri.simplices.copy()
  # Recover literal collinear boundary samples omitted by Qhull, without jitter.
  for axis,value in [(0,x0),(0,x1),(1,z0),(1,z1)]:
   other=1-axis;ordered=sorted((k for k in range(len(boundary)) if vertices[k,axis]==value),key=lambda k:vertices[k,other]);recovered=[]
   for face in faces:
    edge=[int(v) for v in face if vertices[v,axis]==value]
    if len(edge)!=2:recovered.append(face);continue
    left,right=sorted(edge,key=lambda k:vertices[k,other]);between=[k for k in ordered if vertices[left,other]<vertices[k,other]<vertices[right,other]]
    if not between:recovered.append(face);continue
    opposite=next(int(v) for v in face if int(v)not in edge);chain=[left]+between+[right]
    for u,v in zip(chain,chain[1:]):recovered.append([opposite,u,v])
   faces=np.asarray(recovered)
  used=set(faces.ravel());assert set(range(len(boundary)))<=used, ('omitted boundary',len(set(range(len(boundary)))-used))
  # Normalize winding after the exact boundary recovery.
  areas=np.cross(vertices[faces[:,1],:2]-vertices[faces[:,0],:2],vertices[faces[:,2],:2]-vertices[faces[:,0],:2]);assert np.all(areas!=0)
  neg=areas<0;faces[neg]=faces[neg][:,[0,2,1]]
  offset=sum(len(x) for x in all_vertices);all_vertices.append(vertices);all_geographic.append(reference[sel]);all_faces.append(faces+offset);report={'tile':[i,j],'sourceCandidates':len(candidates),'boundaryPoints':len(boundary),'retainedVertices':len(sel),'triangles':len(faces),'sourceSampleMaxErrorM':maxerror,'sourceSampleAngleErrorRad':float((error/np.maximum(1.0,np.minimum(np.hypot(xy[:,0],xy[:,1]),np.hypot(reference[:,0],reference[:,2]))-1000)).max()),'iterations':iterations};reports.append(report);print(json.dumps(report),flush=True)
vertices=np.concatenate(all_vertices);faces=np.concatenate(all_faces);np.savez(opts.output,vertices=vertices,geographic=np.concatenate(all_geographic),faces=faces);r={'scene':scene,'sourceCandidates':len(points),'vertices':len(vertices),'triangles':len(faces),'sourceSampleAngleErrorBoundRad':.0005,'errorScope':'Retained source sample residual before collinear boundary recovery; not an all-interior geodesy bound or native visual acceptance','eyeHorizontalBoundM':1000,'elapsedSeconds':time.monotonic()-start,'producerSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'boundarySHA256':hashlib.sha256(pathlib.Path(opts.boundary).read_bytes()).hexdigest(),'tiles':reports};pathlib.Path(opts.output+'.report.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
