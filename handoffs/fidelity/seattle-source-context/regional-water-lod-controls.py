#!/usr/bin/python3
import importlib.util,json,pathlib
import numpy as np
from osgeo import ogr,gdal
gdal.UseExceptions();root=pathlib.Path(__file__).resolve().parents[3];spec=importlib.util.spec_from_file_location('lod',root/'tools/osm/regional-water-lod.py');lod=importlib.util.module_from_spec(spec);spec.loader.exec_module(lod);checks=[]
def polygon(points,holes=[]):
 g=ogr.Geometry(ogr.wkbPolygon)
 for pts in[points]+holes:
  r=ogr.Geometry(ogr.wkbLinearRing)
  for x,z in pts:r.AddPoint_2D(x,z)
  r.CloseRings();g.AddGeometry(r)
 return g
near=polygon([[100+np.sin(i),i]for i in range(100)]+[[110,99],[110,0]])
before=bytes(near.ExportToWkb());out,report=lod.simplify_far_water(near);assert bytes(out.ExportToWkb())==before;assert bytes(near.ExportToWkb())==before;checks.append('Exact near collar and original source bytes unchanged')
far=polygon([[30000+np.sin(i)*.1,i*2]for i in range(400)]+[[31000,798],[31000,0]],[[[30200,100],[30200,200],[30300,200],[30300,100]]]);out,r=lod.simplify_far_water(far);assert out.IsValid()and lod.shape_signature(out)==lod.shape_signature(far);assert r['renderPoints']<r['sourcePoints'];assert r['maxCertifiedAdditionalPixelError']<.5;checks.append('Far reduction retains ordered components/holes and continuous <=.5px certificate')
cross=polygon([[10000,0],[13000,1],[15000,0],[15000,100],[13000,101],[10000,100]]);out,r=lod.simplify_far_water(cross);ring=out.GetGeometryRef(0);pts=set((x,z)for x,z,*_ in ring.GetPoints());assert(10000.,0.)in pts and(13000.,1.)in pts and(10000.,100.)in pts;checks.append('Original source edges entering the collar remain, no replacement chord cuts through collar')
backtrack=np.array([[20000.,0],[20100.,.01],[20050.,-.01],[20200.,0]]);r={'maxCertifiedAdditionalPixelError':0.,'maxContinuousFlatDeviationM':0.,'maxCurvatureChordErrorM':0.,'certifiedChains':0};q=lod.reduce_chain(backtrack,1,lod.POLICY,r);assert len(q)==2 and r['maxCertifiedAdditionalPixelError']<.5;checks.append('Reverse Hausdorff guarantee includes a backtracking original chain')
spike=np.array([[20000.,0],[20100.,10],[20200.,0]]);r={'maxCertifiedAdditionalPixelError':0.,'maxContinuousFlatDeviationM':0.,'maxCurvatureChordErrorM':0.,'certifiedChains':0};q=lod.reduce_chain(spike,1,lod.POLICY,r);assert any(np.array_equal(p,spike[1])for p in q);checks.append('A genuine unsampled-between-endpoints spike is retained')
long=np.array([[100000.,0],[105000.,0]]);r={'maxCertifiedAdditionalPixelError':0.,'maxContinuousFlatDeviationM':0.,'maxCurvatureChordErrorM':0.,'certifiedChains':0};q=lod.reduce_chain(long,4,lod.POLICY,r);assert len(q)>2 and r['maxCurvatureChordErrorM']>0;checks.append('Long straight source chain receives curvature-bounded render subdivision')
multi=ogr.Geometry(ogr.wkbMultiPolygon);multi.AddGeometry(far);island=polygon([[40000,0],[40001,0],[40000,1]]);multi.AddGeometry(island);out,r=lod.simplify_far_water(multi);assert out.GetGeometryCount()==2 and lod.shape_signature(out)==lod.shape_signature(multi);checks.append('Small separate island is retained; invalid topology would revert the full feature')
print(json.dumps({'scope':'CPU continuous-boundary/error/topology controls; native source-camera/material/frame gates remain open','passed':True,'checks':len(checks),'results':checks,'policy':lod.POLICY},indent=2))
