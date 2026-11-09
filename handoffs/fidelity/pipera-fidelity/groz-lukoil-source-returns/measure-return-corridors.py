"""Read-only bounds and donor coverage for literal OSM return paths.

The analytic margin and distance to the union of occupied native RLE cells are
1-Lipschitz. Samples at <=0.25m bound each continuous maximum by sampleMax+0.125m.
No candidate road width is inferred from these clearance measurements.
"""
from pathlib import Path
import gzip, hashlib, json, math, re
import numpy as np

ROOT=Path('/workspace/reality-pass/groz-lukoil-nav')
native=Path('/workspace/integration-qa-evidence/preview-ff6b2bff-native/grozavesti-world.json.gz')
raw=gzip.decompress(native.read_bytes()); world=json.loads(raw); data=world['data']
source=json.loads((ROOT/'source-gap-certificate.json').read_text())
geom=data['district']['geometry']; mask=data['district']['mask']; proj=data['proj']
assert not geom['polys'], 'This independent certificate currently supports this exact capsule/circle core.'
bits=[]; v=0
for n in mask['rle']: bits.extend([v]*n); v^=1
grid=np.asarray(bits).reshape(mask['h'],mask['w'])
j,i=np.where(grid==1); rects=np.stack([mask['x0']+i*mask['cell'],mask['z0']+j*mask['cell']],axis=1)

def margin(points):
    result=np.full(len(points),np.inf)
    for piece in geom['pieces']:
        for a,b in zip(piece['pts'],piece['pts'][1:]):
            a,b=np.asarray(a),np.asarray(b); d=b-a
            t=np.clip(((points-a)*d).sum(axis=1)/(d*d).sum(),0,1)
            result=np.minimum(result,np.linalg.norm(points-a-t[:,None]*d,axis=1)-piece['r'])
    for c in geom['circles']:
        result=np.minimum(result,np.linalg.norm(points-[c['x'],c['z']],axis=1)-c['r'])
    return result

def mask_distance(points):
    out=[]
    for start in range(0,len(points),200):
        p=points[start:start+200,None,:]
        d=np.maximum(np.maximum(rects[None,:,:]-p,p-(rects+mask['cell'])[None,:,:]),0)
        out.extend(np.sqrt((d*d).sum(axis=2)).min(axis=1))
    return np.asarray(out)

def ll_bounds(bounds):
    x0,z0,x1,z1=bounds
    return [proj['lat0']-z1/proj['mPerLat'],proj['lon0']+x0/proj['mPerLon'],
            proj['lat0']-z0/proj['mPerLat'],proj['lon0']+x1/proj['mPerLon']]

def segment_covered(a,b,segments):
    a,b=np.asarray(a),np.asarray(b); d=b-a; length=np.linalg.norm(d); u=d/length; intervals=[]
    for p,q in segments:
        p,q=np.asarray(p),np.asarray(q)
        if max(abs(u[0]*(p-a)[1]-u[1]*(p-a)[0]),abs(u[0]*(q-a)[1]-u[1]*(q-a)[0]))>1e-6: continue
        lo,hi=sorted([float(np.dot(p-a,u)/length),float(np.dot(q-a,u)/length)])
        if hi>0 and lo<1: intervals.append([max(0,lo),min(1,hi)])
    cursor=covered=0
    for lo,hi in sorted(intervals):
        if hi>cursor: covered+=hi-max(lo,cursor); cursor=max(cursor,hi)
    return min(1,covered)

donors={}
for s in data['scenerySourceGeometry'].values():
    donors.setdefault(s['sourceId'],[]).extend(zip(s['prepared'],s['prepared'][1:]))
for s in data['roadSourceGeometry'].values():
    ids=s['preparedNodeIds']; index={sid:i for i,sid in enumerate(data['roadNodeIds'])}
    points=[data['roadNodePositions'][index[n]*2:index[n]*2+2]for n in ids]
    donors.setdefault(s['sourceId'],[]).extend(zip(points,points[1:]))

raw_routes=json.loads((ROOT/'raw-osm-routes.json').read_text())
tile_bounds=[]
for f in raw_routes['files']:
    values=list(map(float,re.search(r'_([\d.]+)_([\d.]+)_([\d.]+)_([\d.]+)\.xml$',f['path']).groups()))
    tile_bounds.append(values)
tilebox=[min(v[0]for v in tile_bounds),min(v[1]for v in tile_bounds),max(v[2]for v in tile_bounds),max(v[3]for v in tile_bounds)]
# The 16 tiles form a complete 4x4 rectangle; check area instead of assuming no gaps.
area=sum((v[2]-v[0])*(v[3]-v[1])for v in tile_bounds)
assert math.isclose(area,(tilebox[2]-tilebox[0])*(tilebox[3]-tilebox[1]),abs_tol=1e-12)
reports=[]
for route in source['routes']:
    points=[]; leg_coverage=[]; max_gap=0
    for leg in route['legs']:
        a,b=np.asarray(leg['fromXZ']),np.asarray(leg['toXZ']); n=max(1,math.ceil(np.linalg.norm(b-a)/.25))
        max_gap=max(max_gap,float(np.linalg.norm(b-a)/n))
        points.extend(a+(b-a)*t/n for t in range(n+1))
        coverage=segment_covered(a,b,donors.get(leg['way'],[]))
        leg_coverage.append({'way':leg['way'],'from':leg['from'],'to':leg['to'],'fraction':coverage,'whole':coverage>=1-1e-7})
    points=np.asarray(points); margins=margin(points); md=mask_distance(points)
    im=int(np.argmax(margins)); ir=int(np.argmax(md))
    bounds=[float(points[:,0].min()),float(points[:,1].min()),float(points[:,0].max()),float(points[:,1].max())]
    ring_bounds=[bounds[0]-600,bounds[1]-600,bounds[2]+600,bounds[3]+600]
    ring_ll=ll_bounds(ring_bounds); domain_ring_ll=ll_bounds([bounds[0]-640,bounds[1]-640,bounds[2]+640,bounds[3]+640]); survey=data['treeCoverage']
    native_onroute=[]
    for leg in route['legs']:
        for e in world['allEdges']:
            if e.get('access',{}).get('sourceId')==leg['way']:
                native_onroute.append(e)
    profileMax=max((max(e.get('wL',0),e.get('wR',0))for e in native_onroute),default=0)
    reports.append({'label':route['label'],'lengthM':route['rawNonservicePathLengthM'],
      'samples':len(points),'maxSampleSpacingM':max_gap,
      'analyticCoreExcursionM':{'lower':max(0,float(margins[im])),'upper':max(0,float(margins[im]))+max_gap/2,'witnessXZ':points[im].tolist()},
      'distanceOutsideCurrentMaskM':{'lower':float(md[ir]),'upper':float(md[ir])+max_gap/2,'witnessXZ':points[ir].tolist()},
      'entireSourceCentrelineWithinOld600mDetailRing':float(margins.max())+max_gap/2<600,
      'remainingOld600mRingMarginM':600-float(margins.max())-max_gap/2,
      'currentPreparedSourceRoadCoverage':{'wholeLegs':sum(l['whole']for l in leg_coverage),'totalLegs':len(leg_coverage),'missingOrPartial':[l for l in leg_coverage if not l['whole']]},
      'boundsXZ':bounds,'centrelinePlus600mBoundingBoxLL':ring_ll,'reviewed40mDomainPlus600mBoundingBoxLL':domain_ring_ll,'reviewed40mDomainPlus600mWithinCachedTilesAndCanopySurvey':all(domain_ring_ll[k]>=box[k] if k<2 else domain_ring_ll[k]<=box[k] for box in [tilebox,survey]for k in range(4)),
      'fullNew600mRingWithinCachedRawTileRectangle':ring_ll[0]>=tilebox[0] and ring_ll[1]>=tilebox[1] and ring_ll[2]<=tilebox[2]and ring_ll[3]<=tilebox[3],
      'fullNew600mRingWithinMeasuredCanopySurveyRectangle':ring_ll[0]>=survey[0]and ring_ll[1]>=survey[1]and ring_ll[2]<=survey[2]and ring_ll[3]<=survey[3],
      'maxNativeOnSourceRoadHalfWidthM':profileMax,
      'new600mRingExistingDetailStatus':'Not certified: the new route is inside the old source ring, but its own 600m neighbourhood extends outside the old ring. Rebuild source coverage; do not claim scenery donors provide driving profiles.'})

result={'scope':'CPU exact source route geometry versus archived ff6 analytic core and RLE cell union. No runtime edits, no accepted legal/driven route. Positive-node native coordinate match is exact; path restriction/grade/body/World acceptance remain separate.',
 'nativeWorldRawSha256':hashlib.sha256(raw).hexdigest(),'routeCertificateSha256':hashlib.sha256((ROOT/'source-gap-certificate.json').read_bytes()).hexdigest(),
 'method':'Each continuous maximum lies within reported interval because both fields are 1-Lipschitz and every source segment has samples no more than 0.25m apart. Scenery+core coverage uses collinear interval union of exact prepared source geometry.',
 'cachedTileRectangleLL':tilebox,'cachedTileCount':len(tile_bounds),'measuredCanopyRectangleLL':data['treeCoverage'],'treeRetention':data['treeRetention'],'routes':reports}
(ROOT/'return-corridor-coverage.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
