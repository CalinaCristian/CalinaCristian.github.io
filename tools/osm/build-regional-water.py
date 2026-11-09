import argparse,base64,ctypes,gzip,hashlib,importlib.util,json,math,pathlib,time
import numpy as np
from scipy.spatial import cKDTree
from osgeo import ogr,gdal
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--context-source',required=True);p.add_argument('--native',required=True);p.add_argument('--output-prefix',required=True);a=p.parse_args();prefix=pathlib.Path(a.output_prefix);spec=importlib.util.spec_from_file_location('region_codec',pathlib.Path(__file__).with_name('region-source-codec.py'));codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
source=json.loads(gzip.decompress(pathlib.Path(a.source).read_bytes()));native=json.load(open(a.native));origin=native['origin'];proj=native['projection'];rows=list(codec.water_rings(source));groups={};stats={'features':len(rows),'invalid':[],'unsupportedLevel':[],'outsideRender':[],'levels':[]};model=[];gdal.PushErrorHandler('CPLQuietErrorHandler')
for i,(f,rings) in enumerate(rows):
 wkid=f['spatialReference'].get('latestWkid',f['spatialReference'].get('wkid'));groups.setdefault(wkid,[]).append({'attributes':{'SID':i},'geometry':{'rings':[r.tolist() for r in rings]}})
def convert_geo(g,wkid):
 typ=g.GetGeometryType()
 if typ in (ogr.wkbPolygon,ogr.wkbMultiPolygon):
  o=ogr.Geometry(typ)
  for k in range(g.GetGeometryCount()):o.AddGeometry(convert_geo(g.GetGeometryRef(k),wkid))
  return o
 if typ==ogr.wkbLinearRing or g.GetGeometryName()=='LINEARRING':
  a=np.array(g.GetPoints(),dtype=float)[:,:2]
  if wkid in(3857,102100):a=np.column_stack((a[:,0]/6378137*180/np.pi,(2*np.arctan(np.exp(a[:,1]/6378137))-np.pi/2)*180/np.pi))
  a=np.column_stack(((a[:,0]-origin['lon'])*proj['mLon'],(origin['lat']-a[:,1])*proj['mLat']));o=ogr.Geometry(ogr.wkbLinearRing)
  for x,z in a:o.AddPoint_2D(float(x),float(z))
  return o
 raise RuntimeError(('geometrytype',g.GetGeometryName()))
# Retained priority DEM sample cloud, independent of the rendered terrain LOD.
old=json.load(open(a.context_source));grids=[old['terrain'],source['elevationGrids'][1],source['elevationGrids'][0]];cloud=[];boxes=[]
for g in grids:
 h=np.frombuffer(base64.b64decode(g['heights']),dtype='<f4').reshape(g['nz'],g['nx']);xs=(g['westPixelCentre']+np.arange(g['nx'])*g['lonStep']-origin['lon'])*proj['mLon'];zs=(origin['lat']-(g['northPixelCentre']-np.arange(g['nz'])*g['latStep']))*proj['mLat'];xx,zz=np.meshgrid(xs,zs);valid=np.ones(xx.shape,bool)
 for a,b,c,d in boxes:valid&=~((xx>=a)&(xx<=c)&(zz>=b)&(zz<=d))
 cloud.append(np.column_stack((xx[valid],zz[valid],h[valid])));boxes.append((xs[0],zs[0],xs[-1],zs[-1]))
cloud=np.concatenate(cloud);tree=cKDTree(cloud[:,:2]);bounds=boxes[-1]
def rect(a,b,c,d):
 r=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in [(a,b),(c,b),(c,d),(a,d),(a,b)]:r.AddPoint_2D(x,z)
 p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(r);return p
frame=rect(*bounds);inner=rect(-4000,-3600,4000,3600)
for wkid,features in groups.items():
 obj={'geometryType':'esriGeometryPolygon','spatialReference':{'wkid':wkid},'fields':[{'name':'SID','type':'esriFieldTypeInteger'}],'features':features};file=f'/vsimem/regional-{wkid}.json';gdal.FileFromMemBuffer(file,json.dumps(obj,separators=(',',':')).encode());ds=gdal.OpenEx(file,gdal.OF_VECTOR,allowed_drivers=['ESRIJSON']);assert ds
 for row in ds.GetLayer(0):
  f=rows[row.GetField('SID')][0];whole=convert_geo(row.GetGeometryRef(),wkid);geo=whole
  if not geo.IsValid():stats['invalid'].append(f['id']);continue
  geo=geo.Intersection(frame).Difference(inner)
  if geo.IsEmpty()or geo.GetArea()==0:stats['outsideRender'].append(f['id']);continue
  env=geo.GetEnvelope();x0,x1,z0,z1=env
  if f['attributes']['FTYPE'] in (312,445,493):level=1.;basis='Existing game mean-sea 1m estimate; no measured tide/datum conversion';samples=0;span=None
  else:
   ids=tree.query_ball_point([(x0+x1)/2,(z0+z1)/2],math.hypot(x1-x0,z1-z0)/2);keep=[]
   for j in ids:
    x,z,h=cloud[j]
    if not(x0<x<x1 and z0<z<z1):continue
    point=ogr.Geometry(ogr.wkbPoint);point.AddPoint_2D(x,z)
    if geo.Contains(point):keep.append(h)
   if not keep:stats['unsupportedLevel'].append(f['id']);continue
   level=float(np.median(keep));basis='Median retained USGS interior samples; unmeasured water-level estimate';samples=len(keep);span=float(max(keep)-min(keep))
  stats['levels'].append({'id':f['id'],'name':f['attributes'].get('GNIS_NAME'),'heightM':level,'basis':basis,'samples':samples,'sampleSpanM':span});model.append({'id':f['id'],'level':level,'basis':basis,'ftype':f['attributes']['FTYPE'],'geometry':whole})
 ds=None;gdal.Unlink(file)
# Clip modeled overlaps once; every raw source record remains in the source asset.
model.sort(key=lambda x:(-x['geometry'].GetArea(),x['id']));mask=ogr.Geometry(ogr.wkbMultiPolygon)
for m in model:
 g=m['geometry']
 if g.GetGeometryType()==ogr.wkbPolygon:mask.AddGeometry(g)
 elif g.GetGeometryType()==ogr.wkbMultiPolygon:
  for i in range(g.GetGeometryCount()):mask.AddGeometry(g.GetGeometryRef(i))
mask=mask.UnionCascaded();assert mask and mask.IsValid();pathlib.Path(str(prefix)+'-union.wkb').write_bytes(bytes(mask.ExportToWkb()));stats.update(modeled=len(model),unionAreaM2=mask.GetArea(),unionGeometryType=mask.GetGeometryName(),sourcePixelSamples=len(cloud),renderFrame=list(bounds),rawElevationTagUnits='NHD ELEVATION attributes retained verbatim; units not verified or interpreted as metres',producerSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest());pathlib.Path(str(prefix)+'-report.json').write_text(json.dumps(stats,indent=2)+'\n')
# Save ordered model geometry with source identity/level; this is derived cache, not raw source.
blob=b'';meta=[]
for m in model:
 b=bytes(m['geometry'].ExportToWkb());meta.append({'id':m['id'],'level':m['level'],'basis':m['basis'],'ftype':m['ftype'],'offset':len(blob),'bytes':len(b)});blob+=b
pathlib.Path(str(prefix)+'.wkb').write_bytes(blob);pathlib.Path(str(prefix)+'-index.json').write_text(json.dumps(meta,separators=(',',':'))+'\n');print({k:v if not isinstance(v,list) else len(v) for k,v in stats.items()})
