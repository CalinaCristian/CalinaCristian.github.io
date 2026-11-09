#!/usr/bin/python3
"""Admit modeled NHD water outside detailed OSM coverage, preserving existing water."""
import argparse,hashlib,json,pathlib
from osgeo import ogr,gdal
p=argparse.ArgumentParser();p.add_argument('--water-index',required=True);p.add_argument('--water-wkb',required=True);p.add_argument('--canonical-native',required=True);p.add_argument('--native',required=True);p.add_argument('--existing',required=True);p.add_argument('--coverage',required=True);p.add_argument('--output',required=True);a=p.parse_args();gdal.UseExceptions()
n=json.load(open(a.native));c=json.load(open(a.canonical_native));existing=json.load(open(a.existing));west,south,east,north=json.loads(a.coverage);O=n['origin'];P=n['projection'];C=c['origin'];Q=c['projection'];sx=P['mLon']/Q['mLon'];sz=P['mLat']/Q['mLat'];tx=(C['lon']-O['lon'])*P['mLon'];tz=(O['lat']-C['lat'])*P['mLat']
def polygon(poly,holes=[]):
 g=ogr.Geometry(ogr.wkbPolygon)
 for points in [poly]+holes:
  r=ogr.Geometry(ogr.wkbLinearRing)
  for x,z in points:r.AddPoint_2D(x,z)
  if points[0]!=points[-1]:r.AddPoint_2D(*points[0])
  g.AddGeometry(r)
 return g
def rect(x0,z0,x1,z1):return polygon([[x0,z0],[x1,z0],[x1,z1],[x0,z1]])
def transform(g):
 if g.GetGeometryName()in('POLYGON','MULTIPOLYGON','GEOMETRYCOLLECTION'):
  out=ogr.Geometry(g.GetGeometryType())
  for i in range(g.GetGeometryCount()):out.AddGeometry(transform(g.GetGeometryRef(i)))
  return out
 out=ogr.Geometry(ogr.wkbLinearRing)
 for x,z,*_ in g.GetPoints():out.AddPoint_2D(x*sx+tx,z*sz+tz)
 return out
box=rect(-4000,-3600,4000,3600);coverage={'x0':(west-O['lon'])*P['mLon'],'x1':(east-O['lon'])*P['mLon'],'z0':(O['lat']-north)*P['mLat'],'z1':(O['lat']-south)*P['mLat']};keep=rect(coverage['x0'],coverage['z0'],coverage['x1'],coverage['z1']);mask=ogr.Geometry(ogr.wkbMultiPolygon)
for r in existing['waterRecords']:mask.AddGeometry(polygon(r['poly'],r['holes']))
old=mask.UnionCascaded();assert old.IsValid();records=[];blob=pathlib.Path(a.water_wkb).read_bytes();overlap=0
for m in json.load(open(a.water_index)):
 if m.get('ftype')in(312,445,493):continue # original OSM directed coast already closes the complete near frame
 g=transform(ogr.CreateGeometryFromWkb(blob[m['offset']:m['offset']+m['bytes']])).Intersection(box).Difference(keep)
 if g.IsEmpty()or g.GetArea()==0:continue
 overlap+=g.Intersection(old).GetArea();g=g.Difference(old)
 parts=[g]if g.GetGeometryName()=='POLYGON'else[g.GetGeometryRef(i)for i in range(g.GetGeometryCount())]
 for i,part in enumerate(parts):
  if part.GetGeometryName()!='POLYGON'or part.GetArea()==0:continue
  assert part.IsValid();rings=[[[x,z]for x,z,*_ in part.GetGeometryRef(k).GetPoints()][:-1]for k in range(part.GetGeometryCount())]
  records.append({'id':f'regional:{m["id"]}:{i}','sourceIds':[m['id']],'poly':rings[0],'holes':rings[1:],'y':m['level']-O['elev'],'heightBasis':m.get('basis','Explicit source-water model; see regional source ledger; level is an estimate'),'estimated':True,'regionalExtension':True,'mergeGroup':'regional-source-extension'})
r={'scene':n['id'],'detailedOSMCoverage':[west,south,east,north],'nativeDetailedCoverage':coverage,'records':records,'sourceIds':sorted({i for r in records for i in r['sourceIds']}),'existingWaterPrecedenceAreaM2':overlap,'existingSHA256':hashlib.sha256(pathlib.Path(a.existing).read_bytes()).hexdigest(),'basis':'NHD outside detailed OSM coverage only; all pre-existing water polygons/levels retain priority; no unknown geometry is classified dry.'};pathlib.Path(a.output).write_text(json.dumps(r,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in r.items()if k not in('records','sourceIds')},indent=2));print('records',len(records),'sources',r['sourceIds'])
