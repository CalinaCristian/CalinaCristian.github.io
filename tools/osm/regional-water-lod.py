"""Certified far render-boundary reduction. Raw source and near geometry are untouched."""
import math
import numpy as np
from osgeo import ogr

POLICY={'exactCollarM':12000.,'eyeHorizontalBoundM':1000.,'physicalHeightPx':2160.,'aspectMax':2.4,'fovMinDeg':20.,'fovMaxDeg':90.,'targetAdditionalErrorPx':.4,'acceptancePx':.5,'enuHorizontalLowerScale':.95,'enuLipschitz':1.04,'enuSecondDerivativeBoundPerM':1e-6}

def segment_radii(points):
 a=points[:-1];d=points[1:]-a;den=np.einsum('ij,ij->i',d,d);t=np.zeros(len(d));ok=den>0;t[ok]=np.clip(-np.einsum('ij,ij->i',a[ok],d[ok])/den[ok],0,1)
 return np.linalg.norm(a+d*t[:,None],axis=1)

def chord_errors(points):
 d=points[-1]-points[0];den=float(d@d)
 if den==0:return np.linalg.norm(points-points[0],axis=1)
 t=np.clip((points-points[0])@d/den,0,1);return np.linalg.norm(points-points[0]-t[:,None]*d,axis=1)

def pixel_gain(policy):
 # f*sec²(diagonal half-angle), maximized at an endpoint of the allowed
 # vertical-FOV interval. This includes the off-axis projection derivative.
 return policy['physicalHeightPx']/2*max(1/math.tan(math.radians(f)/2)+(1+policy['aspectMax']**2)*math.tan(math.radians(f)/2)for f in[policy['fovMinDeg'],policy['fovMaxDeg']])

def reduce_chain(points,band,policy,report):
 if band==0:return points
 low=policy['exactCollarM']*2**(band-1);distance=policy['enuHorizontalLowerScale']*low-policy['eyeHorizontalBoundM'];gain=pixel_gain(policy);budget=policy['targetAdditionalErrorPx']*distance/gain
 tolerance=budget/(2*policy['enuLipschitz']);max_span=math.sqrt(4*budget/policy['enuSecondDerivativeBoundPerM']);stack=[(0,len(points)-1)];segments=[]
 while stack:
  lo,hi=stack.pop();path=points[lo:hi+1];errors=chord_errors(path);at=int(errors.argmax());bound=float(errors[at]);roundoff=64*np.finfo(float).eps*max(1.,float(np.abs(path).max()))
  chord_radius=float(segment_radii(path[[0,-1]])[0]);inside=chord_radius<low
  if hi-lo>1 and(bound+roundoff>tolerance or inside):
   if at in(0,len(path)-1):at=len(path)//2
   cut=lo+at;stack.extend([(cut,hi),(lo,cut)]);continue
  # Every original vertex is checked, not sampled. Distance to a fixed chord
  # is convex on each original straight segment, so this bounds every point.
  # The original path joins both chord endpoints; continuity of its projection
  # supplies the reverse Hausdorff bound too, including backtracking paths.
  chord_length=float(np.linalg.norm(path[-1]-path[0]));parts=max(1,math.ceil(chord_length/max_span));curve=policy['enuSecondDerivativeBoundPerM']*(chord_length/parts)**2/8;world=policy['enuLipschitz']*(bound+roundoff)+curve;px=gain*math.asin(min(1.,world/distance));assert px<=policy['acceptancePx']
  report['maxCertifiedAdditionalPixelError']=max(report['maxCertifiedAdditionalPixelError'],px);report['maxContinuousFlatDeviationM']=max(report['maxContinuousFlatDeviationM'],bound+roundoff);report['maxCurvatureChordErrorM']=max(report['maxCurvatureChordErrorM'],curve);report['certifiedChains']+=1
  new=path[0]+np.arange(parts)[:,None]/parts*(path[-1]-path[0]);segments.append((lo,new))
 segments.sort(key=lambda a:a[0]);return np.concatenate([p for _,p in segments]+[points[-1:]])

def ring_lod(ring,policy,report):
 points=np.asarray(ring.GetPoints(),float)[:,:2]
 if len(points)<4:return ring.Clone()
 if np.array_equal(points[0],points[-1]):points=points[:-1]
 n=len(points);closed=np.concatenate((points,points[:1]));radii=segment_radii(closed);bands=np.zeros(n,dtype=int);far=radii>=policy['exactCollarM'];bands[far]=1+np.floor(np.log2(radii[far]/policy['exactCollarM'])).astype(int)
 starts=np.where(bands!=np.roll(bands,1))[0].tolist()
 if not starts:
  other=int(np.linalg.norm(points-points[0],axis=1).argmax());starts=[0,other]if other else[0]
 # Keep three original non-collinear anchors even on tiny rings. A ring may
 # not disappear merely because its entire width is below the pixel budget.
 other=int(np.linalg.norm(points-points[0],axis=1).argmax());direction=points[other]-points[0];area=np.abs(direction[0]*(points[:,1]-points[0,1])-direction[1]*(points[:,0]-points[0,0]));third=int(area.argmax());starts.extend([0,other,third])
 starts=sorted(set(starts));out=[]
 for i,start in enumerate(starts):
  end=starts[(i+1)%len(starts)];length=(end-start)%n
  if length==0:length=n
  ids=(start+np.arange(length+1))%n;chain=points[ids];reduced=reduce_chain(chain,int(bands[start]),policy,report);out.extend(reduced[:-1])
 result=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in out:result.AddPoint_2D(float(x),float(z))
 result.CloseRings();return result

def shape_signature(g):
 if g.GetGeometryName()=='POLYGON':return['POLYGON',g.GetGeometryCount()]
 if g.GetGeometryName()=='MULTIPOLYGON':return['MULTIPOLYGON',[shape_signature(g.GetGeometryRef(i))for i in range(g.GetGeometryCount())]]
 return[g.GetGeometryName()]

def count_points(g):return g.GetPointCount()+sum(count_points(g.GetGeometryRef(i))for i in range(g.GetGeometryCount()))

def simplify_far_water(g,policy=POLICY):
 report={'policy':policy,'sourcePoints':count_points(g),'certifiedChains':0,'maxCertifiedAdditionalPixelError':0.,'maxContinuousFlatDeviationM':0.,'maxCurvatureChordErrorM':0.,'reverted':False}
 def convert(shape):
  typ=shape.GetGeometryName()
  if typ=='POLYGON':
   result=ogr.Geometry(ogr.wkbPolygon)
   for i in range(shape.GetGeometryCount()):result.AddGeometry(ring_lod(shape.GetGeometryRef(i),policy,report))
   return result
  if typ=='MULTIPOLYGON':
   result=ogr.Geometry(ogr.wkbMultiPolygon)
   for i in range(shape.GetGeometryCount()):result.AddGeometry(convert(shape.GetGeometryRef(i)))
   return result
  return shape.Clone()
 result=convert(g)
 if not result.IsValid()or shape_signature(result)!=shape_signature(g):result=g.Clone();report['reverted']=True
 # Exact near collar: all source edges entering it were retained and every
 # accepted replacement chord is outside it. Rings/components remain ordered.
 report['renderPoints']=count_points(result);report['topologySignature']=shape_signature(g);return result,report
