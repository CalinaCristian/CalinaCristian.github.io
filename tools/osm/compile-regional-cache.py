#!/usr/bin/python3
"""Bake source terrain/water render geometry. No browser, images or physical-body edits."""
import argparse,ctypes,gzip,hashlib,importlib.util,json,math,pathlib,struct,time
import numpy as np
from osgeo import ogr,gdal
p=argparse.ArgumentParser();p.add_argument('--tin',required=True);p.add_argument('--water-index',required=True);p.add_argument('--water-wkb',required=True);p.add_argument('--canonical-native',required=True);p.add_argument('--native',required=True);p.add_argument('--source',required=True);p.add_argument('--extensions',required=True);p.add_argument('--existing',required=True);p.add_argument('--context-source',required=True);p.add_argument('--output',required=True);a=p.parse_args();start=time.monotonic();gdal.UseExceptions();root=pathlib.Path(__file__).resolve().parents[2];digest=lambda b:hashlib.sha256(b).hexdigest()
sourceBytes=gzip.decompress(pathlib.Path(a.source).read_bytes());source=json.loads(sourceBytes);nativeBytes=pathlib.Path(a.native).read_bytes();native=json.loads(nativeBytes);canonical=json.load(open(a.canonical_native));O=native['origin'];P=native['projection'];C=canonical['origin'];Q=canonical['projection'];sx=P['mLon']/Q['mLon'];sz=P['mLat']/Q['mLat'];tx=(C['lon']-O['lon'])*P['mLon'];tz=(O['lat']-C['lat'])*P['mLat']
def rect(x0,z0,x1,z1):
 r=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in[(x0,z0),(x1,z0),(x1,z1),(x0,z1),(x0,z0)]:r.AddPoint_2D(x,z)
 g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(r);return g
def transform(g):
 if g.GetGeometryName()in('POLYGON','MULTIPOLYGON','GEOMETRYCOLLECTION'):
  out=ogr.Geometry(g.GetGeometryType())
  for i in range(g.GetGeometryCount()):out.AddGeometry(transform(g.GetGeometryRef(i)))
  return out
 out=ogr.Geometry(ogr.wkbLinearRing)
 for x,z,*_ in g.GetPoints():out.AddPoint_2D(x*sx+tx,z*sz+tz)
 return out
# Exact source-coordinate transform; numeric height remains a separately retained attribute.
def geographic(points):
 x,z,h=points[:,0],points[:,1],points[:,2];lat=(O['lat']-z/P['mLat'])*np.pi/180;lon=(O['lon']+x/P['mLon'])*np.pi/180;H=h+O['elev'];A=6378137.;f=1/298.257223563;e2=f*(2-f);N=A/np.sqrt(1-e2*np.sin(lat)**2);xyz=np.column_stack(((N+H)*np.cos(lat)*np.cos(lon),(N+H)*np.cos(lat)*np.sin(lon),(N*(1-e2)+H)*np.sin(lat)));fo=O['lat']*np.pi/180;lo=O['lon']*np.pi/180;no=A/np.sqrt(1-e2*np.sin(fo)**2);origin=np.array([(no+O['elev'])*np.cos(fo)*np.cos(lo),(no+O['elev'])*np.cos(fo)*np.sin(lo),(no*(1-e2)+O['elev'])*np.sin(fo)]);d=xyz-origin;enu=np.column_stack((-np.sin(lo)*d[:,0]+np.cos(lo)*d[:,1],np.cos(fo)*np.cos(lo)*d[:,0]+np.cos(fo)*np.sin(lo)*d[:,1]+np.sin(fo)*d[:,2],np.sin(fo)*np.cos(lo)*d[:,0]+np.sin(fo)*np.sin(lo)*d[:,1]-np.cos(fo)*d[:,2]));r=np.hypot(x,z);t=np.clip((r-6000)/6000,0,1);w=t*t*(3-2*t);return points[:,[0,2,1]]*(1-w[:,None])+enu*w[:,None]
# GEOS constrained triangulation retains actual polygon holes and boundary vertices.
lib=ctypes.CDLL('libgeos_c.so.1');V=ctypes.c_void_p;S=ctypes.c_size_t
lib.GEOS_init_r.restype=V;ctx=lib.GEOS_init_r();lib.GEOSGeomFromWKB_buf_r.argtypes=[V,V,S];lib.GEOSGeomFromWKB_buf_r.restype=V;lib.GEOSConstrainedDelaunayTriangulation_r.argtypes=[V,V];lib.GEOSConstrainedDelaunayTriangulation_r.restype=V;lib.GEOSGeomToWKB_buf_r.argtypes=[V,V,ctypes.POINTER(S)];lib.GEOSGeomToWKB_buf_r.restype=V;lib.GEOSGeom_destroy_r.argtypes=[V,V];lib.GEOSFree_r.argtypes=[V,V]
def triangles(g):
 if g.IsEmpty()or g.GetArea()==0:return []
 raw=bytes(g.ExportToWkb());buf=ctypes.create_string_buffer(raw);src=lib.GEOSGeomFromWKB_buf_r(ctx,buf,len(raw));tri=lib.GEOSConstrainedDelaunayTriangulation_r(ctx,src)
 if not tri:raise RuntimeError('GEOS constrained source triangulation failed')
 size=S();ptr=lib.GEOSGeomToWKB_buf_r(ctx,tri,ctypes.byref(size));out=ogr.CreateGeometryFromWkb(ctypes.string_at(ptr,size.value));lib.GEOSFree_r(ctx,ptr);lib.GEOSGeom_destroy_r(ctx,tri);lib.GEOSGeom_destroy_r(ctx,src)
 return[np.array(out.GetGeometryRef(i).GetGeometryRef(0).GetPoints(),float)[:3,:2]for i in range(out.GetGeometryCount())]
npz=np.load(a.tin);vertices=npz['vertices'];geo=npz['geographic'];faces=npz['faces'];lo=vertices[:,:2].min(axis=0);hi=vertices[:,:2].max(axis=0);frame=rect(lo[0],lo[1],hi[0],hi[1]);inner=rect(-4000,-3600,4000,3600)
spec=importlib.util.spec_from_file_location('water_lod',pathlib.Path(__file__).with_name('regional-water-lod.py'));waterLOD=importlib.util.module_from_spec(spec);spec.loader.exec_module(waterLOD);lodReports=[]
models=[];blob=pathlib.Path(a.water_wkb).read_bytes()
existing=json.load(open(a.existing));coastBox=existing['regionalOSMCoastFrame'];coastPriority=rect(coastBox['x0'],coastBox['z0'],coastBox['x1'],coastBox['z1']);osmMulti=ogr.Geometry(ogr.wkbMultiPolygon)
for r in existing['regionalOSMWaterRecords']:
 poly=ogr.Geometry(ogr.wkbPolygon)
 for points in [r['poly']]+r['holes']:
  ring=ogr.Geometry(ogr.wkbLinearRing)
  for x,z in points:ring.AddPoint_2D(float(np.float32(x)),float(np.float32(z)))
  ring.CloseRings();poly.AddGeometry(ring)
 osmMulti.AddGeometry(poly);g=poly.Intersection(frame).Difference(inner)
 if not g.IsEmpty()and g.GetArea()>0:models.append({'id':r['id'],'level':r['y']+O['elev'],'geometry':g,'priority':0})
osmMask=osmMulti.UnionCascaded();assert osmMask.IsValid()
west,south,east,north=source['detailedOSMCoverage'];detailedPriority=rect((west-O['lon'])*P['mLon'],(O['lat']-north)*P['mLat'],(east-O['lon'])*P['mLon'],(O['lat']-south)*P['mLat'])
for item in json.load(open(a.water_index)):
 g=transform(ogr.CreateGeometryFromWkb(blob[item['offset']:item['offset']+item['bytes']])).Intersection(frame).Difference(inner)
 # Each native apron is shifted. Detailed OSM coverage can extend beyond its
 # edge (Pike's north strip), and remains authoritative there as well.
 g=g.Difference(detailedPriority)
 if item.get('ftype')in(312,445,493):g=g.Difference(coastPriority)
 g=g.Difference(osmMask)
 if not g.IsEmpty()and g.GetArea()>0:
  assert abs(item['level'])<=4500;g,proof=waterLOD.simplify_far_water(g);lodReports.append({'id':item['id'],**proof});models.append({'id':item['id'],'level':item['level'],'geometry':g,'priority':1})
models.sort(key=lambda x:(x['priority'],-x['geometry'].GetArea(),x['id']));multi=ogr.Geometry(ogr.wkbMultiPolygon)
for m in models:
 g=m['geometry']
 if g.GetGeometryName()=='POLYGON':multi.AddGeometry(g)
 elif g.GetGeometryName()=='MULTIPOLYGON':
  for k in range(g.GetGeometryCount()):multi.AddGeometry(g.GetGeometryRef(k))
mask=multi.UnionCascaded();assert mask.IsValid();prepared=mask.CreatePreparedGeometry();modelPrepared=[(m,m['geometry'].CreatePreparedGeometry(),m['geometry'].GetEnvelope())for m in models]
modelCells={};cellM=8000
for i,(_,_,box) in enumerate(modelPrepared):
 for x in range(math.floor(box[0]/cellM),math.floor(box[1]/cellM)+1):
  for z in range(math.floor(box[2]/cellM),math.floor(box[3]/cellM)+1):modelCells.setdefault((x,z),[]).append(i)
localModelCache={};maskCellCache={}
def localModel(modelId,cells):
 parts=[]
 for cx,cz in cells:
  key=(modelId,cx,cz)
  if key not in localModelCache:localModelCache[key]=models[modelId]['geometry'].Intersection(rect(cx*cellM,cz*cellM,(cx+1)*cellM,(cz+1)*cellM))
  g=localModelCache[key]
  if not g.IsEmpty():parts.append(g)
 if not parts:return ogr.Geometry(ogr.wkbPolygon)
 out=parts[0]
 for g in parts[1:]:out=out.Union(g)
 return out
class Builder:
 def __init__(self,water,shore=False):self.water=water;self.shore=shore;self.vertices=[];self.alt=[];self.raw=[];self.indices=[];self.lookup={};self.dropped=0;self.weldMaxM=0
 def emit(self,xy,pos,alt):
  p=np.asarray(pos,dtype='<f4');r=np.asarray(xy,dtype='<f4');at=[]
  for i in range(3):
   key=(r[i].tobytes(),float(alt[i])if self.water or self.shore else None);k=self.lookup.get(key)
   if k is None:k=len(self.vertices);self.lookup[key]=k;self.vertices.append(p[i]);self.alt.append(float(alt[i]));self.raw.append(r[i])
   else:self.weldMaxM=max(self.weldMaxM,float(np.linalg.norm(p[i]-self.vertices[k])))
   at.append(k)
  pp=np.asarray([self.vertices[k]for k in at]);normal=np.cross(pp[1]-pp[0],pp[2]-pp[0]);
  if len(set(at))<3 or np.linalg.norm(normal)==0 or normal[1]==0 and not self.shore:self.dropped+=1;return
  if normal[1]<0:at[1],at[2]=at[2],at[1]
  self.indices.extend(at)
 def arrays(self):
  position=np.asarray(self.vertices,dtype='<f4');index=np.asarray(self.indices,dtype='<u4');normal=np.zeros(position.shape,dtype=np.float64);I=index.reshape(-1,3);cross=np.cross(position[I[:,1]].astype(float)-position[I[:,0]],position[I[:,2]].astype(float)-position[I[:,0]])
  for k in range(3):np.add.at(normal,I[:,k],cross)
  length=np.linalg.norm(normal,axis=1);normal[length>0]/=length[length>0,None];normal[length==0]=[0,1,0];attrs={'position':(position.ravel(),3),'normal':(normal.astype('<f4').ravel(),3),'sourceTerrainAltitude':(np.asarray(self.alt,dtype='<f4'),1)}
  if self.water:attrs['uv']=(np.asarray(self.raw,dtype='<f4').ravel()/12,2)
  else:
   h=np.asarray(self.alt)+O['elev'];rgb=np.empty((len(h),3));pal=[('#546c4d',-np.inf),('#758273',1400),('#8c979d',2200),('#edf2f7',2400)]
   for color,bound in pal:
    value=np.array([int(color[k:k+2],16)/255 for k in[1,3,5]]);value=np.where(value<=.04045,value/12.92,((value+.055)/1.055)**2.4);rgb[h>=bound]=value
   attrs['color']=(rgb.astype('<f4').ravel(),3)
  return attrs,index
land=Builder(False);water=Builder(True);shore=Builder(False,True);counts={'dry':0,'wet':0,'boundary':0};bodyFaces=faces.shape[0]
def lines(g):
 if g.IsEmpty():return
 if g.GetGeometryName()in('LINESTRING','LINEARRING'):
  p=np.asarray(g.GetPoints())[:,:2]
  for i in range(len(p)-1):yield p[i:i+2]
 else:
  for i in range(g.GetGeometryCount()):yield from lines(g.GetGeometryRef(i))
for fi,F in enumerate(faces):
 if fi%2000==0:print(fi,bodyFaces,counts,round(time.monotonic()-start,2),flush=True)
 raw=vertices[F];xy=raw[:,:2];triGeom=rect(0,0,1,1);ring=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in list(xy)+[xy[0]]:ring.AddPoint_2D(float(x),float(z))
 triGeom=ogr.Geometry(ogr.wkbPolygon);triGeom.AddGeometry(ring)
 if not prepared.Intersects(triGeom):land.emit(xy,geo[F],raw[:,2]);counts['dry']+=1;continue
 den=np.cross(xy[1]-xy[0],xy[2]-xy[0]);assert den!=0
 def bary(t):
  u=((t[:,0]-xy[0,0])*(xy[2,1]-xy[0,1])-(t[:,1]-xy[0,1])*(xy[2,0]-xy[0,0]))/den;v=((xy[1,0]-xy[0,0])*(t[:,1]-xy[0,1])-(xy[1,1]-xy[0,1])*(t[:,0]-xy[0,0]))/den;return np.column_stack((1-u-v,u,v))
 fullyWet=prepared.Contains(triGeom)
 if fullyWet:counts['wet']+=1
 else:counts['boundary']+=1
 # Assign overlap to the first (largest) real source body; record original IDs/levels separately.
 left=triGeom;env=triGeom.GetEnvelope();candidates=set();cells=[]
 for cx in range(math.floor(env[0]/cellM),math.floor(env[1]/cellM)+1):
  for cz in range(math.floor(env[2]/cellM),math.floor(env[3]/cellM)+1):cells.append((cx,cz));candidates.update(modelCells.get((cx,cz),[]))
 hits=[i for i in sorted(candidates)if modelPrepared[i][1].Intersects(triGeom)]
 if fullyWet and hits and modelPrepared[hits[0]][1].Contains(triGeom):
  m=models[hits[0]];base=raw.copy();base[:,2]=m['level']-O['elev'];water.emit(xy,geographic(base),np.full(3,m['level']-O['elev']));continue
 if len(cells)>4:
  # A flat-ocean LOD triangle can span many tiles. Use the original exact
  # indexed union there rather than reconstructing it from hundreds of cuts.
  local={i:models[i]['geometry']for i in hits};localMask=mask
 else:
  local={i:localModel(i,cells)for i in hits};localMask=None
  for cx,cz in cells:
   key=(cx,cz)
   if key not in maskCellCache:maskCellCache[key]=mask.Intersection(rect(cx*cellM,cz*cellM,(cx+1)*cellM,(cz+1)*cellM))
   g=maskCellCache[key];localMask=g if localMask is None else localMask.Union(g)
 if not fullyWet:
  for t in triangles(triGeom.Difference(localMask)):
   weights=bary(t);land.emit(t,weights@geo[F],weights@raw[:,2])
 shoreline=localMask.Boundary().Intersection(triGeom).Difference(triGeom.Boundary())if not fullyWet else None
 for modelId in hits:
  m,mp,box=modelPrepared[modelId]
  if box[0]>env[1]or box[1]<env[0]or box[2]>env[3]or box[3]<env[2]or not mp.Intersects(left):continue
  if left is triGeom and mp.Contains(triGeom):
   base=raw.copy();base[:,2]=m['level']-O['elev'];water.emit(xy,geographic(base),np.full(3,m['level']-O['elev']));break
  part=left.Intersection(local[modelId])
  if not part.IsEmpty()and part.GetArea()>0:
   base=raw.copy();base[:,2]=m['level']-O['elev'];wg=geographic(base)
   for t in triangles(part):water.emit(t,geographic(np.column_stack((t,np.full(3,m['level']-O['elev'])))),np.full(3,m['level']-O['elev']))
   if shoreline is not None:
    for line in lines(shoreline.Intersection(part)):
     weights=bary(line);upper=weights@geo[F];alt=weights@raw[:,2];level=m['level']-O['elev'];lower=geographic(np.column_stack((line,np.full(2,level))));quad=np.asarray([upper[0],upper[1],lower[1],lower[0]]);rawQuad=np.asarray([line[0],line[1],line[1],line[0]]);heights=np.asarray([alt[0],alt[1],level,level])
     for face in[[0,1,2],[0,2,3]]:shore.emit(rawQuad[face],quad[face],heights[face])
  left=left.Difference(local[modelId])
  if left.IsEmpty()or left.GetArea()==0:break
blocks=[];size=0;batches=[]
def retain(array):
 global size
 array=np.ascontiguousarray(array);b=array.tobytes();r={'type':'Float32Array'if array.dtype.kind=='f'else'Uint32Array','count':array.size,'byteOffset':size,'byteLength':len(b)};blocks.append(b);size+=(len(b)+3)//4*4;return r
for key,b in[('terrain',land),('water',water),('shore',shore)]:
 if not b.indices:continue
 attrs,index=b.arrays();batches.append({'key':key,'attributes':{k:{**retain(v),'itemSize':n}for k,(v,n)in attrs.items()},'index':retain(index)})
consumer=['game/src/spots/source-regional-terrain.js','game/src/spots/source-terrain-projection.js','game/src/spots/source-terrain-visibility.js','game/src/spots/source-geographic-frame.js','game/src/spots/context-array-codec.js','game/src/spots/source-context-landscape.js','game/src/spots/source-context-surface.js','game/src/spots/ground.js'];ext=json.load(open(a.extensions));cache={'schemaVersion':1,'container':'dmcv-source-context-v1','renderPolicy':'regional-source-terrain-v1','sourceDataSHA256':digest(sourceBytes),'sourceContextDataSHA256':digest(pathlib.Path(a.context_source).read_bytes()),'nativeSceneDataSHA256':digest(nativeBytes),'sourceConsumerHashes':{n:digest((root/n).read_bytes())for n in consumer},'producerSHA256':digest(pathlib.Path(__file__).read_bytes()),'inputHashes':{name:digest(pathlib.Path(getattr(a,name)).read_bytes())for name in['tin','water_index','water_wkb','existing','extensions']},'frame':{'origin':O,'projection':P},'projectionPolicy':{'linearM':6000,'tailM':6000,'geographicNearM':6000,'geographicFullM':12000,'ellipsoid':'WGS84','verticalDatumConversion':False},'eyeBounds':{'min':[-1000,-100,-1000],'max':[1000,500,1000]},'eyeHorizontalBoundM':1000,'waterExtensionRecords':ext['records'],'detailedOSMCoverage':ext['detailedOSMCoverage'],'existingOSMCoastPriorityFrame':coastBox,'batches':batches,'unresolvedGeometry':len(source['unresolvedWaterFeatures']),'waterModelBasis':'Retained NHD geometry; original OSM water/level priority. Unknown source geometry/levels remain unresolved, not classified dry. Original sea model 1m is not surveyed.','renderOnly':True,'measurements':{'sourceTinTriangles':bodyFaces,'classified':counts,'landDroppedSerialization':land.dropped,'waterDroppedSerialization':water.dropped,'landMaximumWeldDifferenceM':land.weldMaxM,'waterMaximumWeldDifferenceM':water.weldMaxM}}
cache['waterBoundaryLOD']={'policy':waterLOD.POLICY,'helperSHA256':digest(pathlib.Path(__file__).with_name('regional-water-lod.py').read_bytes()),'reports':lodReports,'sourcePoints':sum(r['sourcePoints']for r in lodReports),'renderPoints':sum(r['renderPoints']for r in lodReports),'revertedFeatures':sum(r['reverted']for r in lodReports),'maxCertifiedAdditionalPixelError':max((r['maxCertifiedAdditionalPixelError']for r in lodReports),default=0),'scope':'Additional far shoreline LOD only, exact 12km collar and original OSM retained; not a combined DEM or native quality certificate'}
meta=json.dumps(cache,separators=(',',':')).encode();body=16+(len(meta)+3)//4*4;buffer=bytearray(body+size);buffer[:8]=b'DMCCACHE';struct.pack_into('<II',buffer,8,1,len(meta));buffer[16:16+len(meta)]=meta;at=body
for b in blocks:buffer[at:at+len(b)]=b;at+=(len(b)+3)//4*4
output=pathlib.Path(a.output);output.write_bytes(gzip.compress(buffer,9,mtime=0));report={'output':str(output),'compressedBytes':output.stat().st_size,'compressedSHA256':digest(output.read_bytes()),'uncompressedBytes':len(buffer),'uncompressedSHA256':digest(buffer),'elapsedSeconds':time.monotonic()-start,'triangles':{b['key']:b['index']['count']//3 for b in batches},'measurements':cache['measurements']};output.with_suffix(output.suffix+'.report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
