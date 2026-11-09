#!/usr/bin/python3
"""Independent raw response/raster/PROJ audit; no runtime geometry modification."""
import argparse,base64,gzip,hashlib,importlib.util,json,pathlib
import numpy as np
from PIL import Image
from osgeo import ogr,osr
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--context-source',required=True);p.add_argument('--raw-dir',required=True);p.add_argument('--output',required=True);opts=p.parse_args();raw=pathlib.Path(opts.raw_dir);sourceBytes=gzip.decompress(pathlib.Path(opts.source).read_bytes());source=json.loads(sourceBytes);contextBytes=pathlib.Path(opts.context_source).read_bytes();context=json.loads(contextBytes);sha=lambda b:hashlib.sha256(b).hexdigest();assert sha(contextBytes)==source['sourceContextDataSHA256'];spec=importlib.util.spec_from_file_location('codec',pathlib.Path(__file__).with_name('region-source-codec.py'));codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec);requests=source['sourceRequests'];loaded={};features=0;points=0;checks=[]
for feature,rings in codec.water_rings(source):
 i=feature['sourceRequest'];req=requests[i];path=raw/req['file']
 if i not in loaded:
  body=path.read_bytes();assert sha(body)==req['sha256'];d=json.loads(body);loaded[i]={r['attributes']['OBJECTID']:r for r in d['features']}
 original=loaded[i][feature['objectId']];assert original['attributes']==feature['attributes'];assert len(original['geometry']['rings'])==len(rings)
 for before,after in zip(original['geometry']['rings'],rings):
  originalBits=np.asarray(before,dtype='<f8').view('<u8');assert originalBits.shape==after.view('<u8').shape;assert np.array_equal(originalBits,after.view('<u8'));points+=len(before)
 features+=1
checks.append({'name':'Every retained NHD coordinate bit, ring order, attribute and supplying response SHA matches raw official response','features':features,'points':points,'passed':True})
for g in source['elevationGrids']:
 req=requests[g['sourceRequest']];b=(raw/req['file']).read_bytes();assert sha(b)==g['sourceSHA256']==req['sha256'];im=Image.open(raw/req['file']);h=np.asarray(im,dtype='<f4');stored=np.frombuffer(base64.b64decode(g['heights']),dtype='<f4').reshape(g['nz'],g['nx']);assert np.array_equal(h.view('<u4'),stored.view('<u4'));scale=im.tag_v2[33550];tie=im.tag_v2[33922];assert g['westPixelCentre']==tie[3]+scale[0]/2 and g['northPixelCentre']==tie[4]-scale[1]/2;assert g['lonStep']==scale[0]and g['latStep']==scale[1];checks.append({'name':'Original returned GeoTIFF Float32 bits and actual PixelIsArea centres','id':g['id'],'samples':h.size,'passed':True})
origin=source['frame']['origin'];proj=source['frame']['projection'];w,s,e,n=source['detailedOSMCoverage'];outside=[]
for t in context['trees']:
 i=t['n']*3;lat=context['nodes'][i+1]/1e7;lon=context['nodes'][i+2]/1e7
 if not(w<=lon<=e and s<=lat<=n):outside.append(t['id'])
assert not outside;checks.append({'name':'All existing mapped trees are inside detailed OSM coverage, excluded from regional extensions','sourceTrees':len(context['trees']),'outsideDetailedCoverage':0,'passed':True})
# Independent PROJ geographic-to-geocentric implementation, then the standard
# orthonormal local tangent rotation. Numeric input heights are not datum-converted.
geo=osr.SpatialReference();geo.ImportFromEPSG(4979);ecef=osr.SpatialReference();ecef.ImportFromEPSG(4978)
for srs in[geo,ecef]:srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
tr=osr.CoordinateTransformation(geo,ecef);A=6378137.;f=1/298.257223563;e2=f*(2-f)
def formula(lat,lon,h):
 p,l=np.deg2rad([lat,lon]);N=A/np.sqrt(1-e2*np.sin(p)**2);return np.array([(N+h)*np.cos(p)*np.cos(l),(N+h)*np.cos(p)*np.sin(l),(N*(1-e2)+h)*np.sin(p)])
errors=[]
for lat in np.linspace(46.25,48.35,13):
 for lon in np.linspace(-124.2,-120.8,13):
  for h in[-2,0,4375.7841796875]:errors.append(np.linalg.norm(formula(lat,lon,h)-tr.TransformPoint(float(lon),float(lat),h)))
assert max(errors)<1e-7;checks.append({'name':'Independent installed PROJ EPSG4979→4978 vs consumer WGS84 formula','fixtures':len(errors),'maxPositionDifferenceM':max(errors),'verticalDatumConversion':False,'passed':True})
for scene in['seattle-center','pike-place']:
 path=raw/(scene+'-extensions-r3.json');ext=json.load(open(path));coverage=ext['nativeDetailedCoverage'];ring=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in[(coverage['x0'],coverage['z0']),(coverage['x1'],coverage['z0']),(coverage['x1'],coverage['z1']),(coverage['x0'],coverage['z1']),(coverage['x0'],coverage['z0'])]:ring.AddPoint_2D(x,z)
 keep=ogr.Geometry(ogr.wkbPolygon);keep.AddGeometry(ring);area=0
 for r in ext['records']:
  g=ogr.Geometry(ogr.wkbPolygon)
  for p in[r['poly']]+r['holes']:
   ring=ogr.Geometry(ogr.wkbLinearRing)
   for x,z in p:ring.AddPoint_2D(x,z)
   ring.CloseRings();g.AddGeometry(ring)
  assert g.IsValid();area+=g.Intersection(keep).GetArea()
 assert area==0;checks.append({'name':'Exact regional extension polygon intersection with original detailed OSM coverage','scene':scene,'records':len(ext['records']),'intersectionAreaM2':area,'passed':True})
report={'scope':'Raw source, exact coverage and independent geodesy controls; no native visual, water-level survey or performance acceptance','sourceUncompressedSHA256':sha(sourceBytes),'sourceCompressedSHA256':sha(pathlib.Path(opts.source).read_bytes()),'sourceFeatures':features,'sourcePoints':points,'unresolvedGeometries':len(source['unresolvedWaterFeatures']),'passed':True,'checks':checks};pathlib.Path(opts.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
