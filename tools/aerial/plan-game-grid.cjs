#!/usr/bin/env node
// Plan contiguous north-up game captures using the immutable source district and its runtime drive mask.
// No aerial imagery is requested, stored, or derived by this tool.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const root = path.resolve(args.root || '.'), out = path.resolve(args.out || '/tmp/game-grid');
const city = args.city || 'bucharest', district = args.district || 'floreasca';
const size = +(args.size || 250), ring = +(args.ring || 600), sha = args.commit;
if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('--commit requires the immutable 40-character source SHA');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = f => fs.readFileSync(path.join(root, f));
const write = (f, obj) => fs.writeFileSync(path.join(out, f), JSON.stringify(obj, null, 2) + '\n');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const cityBytes=read('game/src/cities.js'), dataBytes=read(`game/data/${city}-${district}.json`);
  const mod=await import('data:text/javascript;base64,'+cityBytes.toString('base64'));
  const cfg=mod.CITIES[city].districts[district],data=JSON.parse(dataBytes),p=data.proj;
  const {projectDistrictGeometry,geometryBounds,rectangleMargin}=await import('./game-grid-geometry.mjs');
  if(p.scale!==1||p.compress)throw new Error('This grid requires a 1:1 uncompressed district projection');
  const project=(lat,lon)=>[(lon-p.lon0)*p.mPerLon,-(lat-p.lat0)*p.mPerLat];
  const inverse=(x,z)=>({lat:p.lat0-z/p.mPerLat,lon:p.lon0+x/p.mPerLon});
  const geometry=projectDistrictGeometry(cfg,data,project),pieces=geometry.pieces||[],circles=geometry.circles||[],polys=geometry.polys||[];
  const mask=data.district.mask,cells=[];let bit=0,k=0;
  for(const run of mask.rle){for(let n=0;n<run;n++,k++)if(bit){const x=mask.x0+(k%mask.w)*mask.cell,z=mask.z0+Math.floor(k/mask.w)*mask.cell;cells.push([x,z,x+mask.cell,z+mask.cell]);}bit^=1;}
  if(k!==mask.w*mask.h)throw new Error('Invalid mask run length');
  // Exact rectangle-to-band/circle/polygon distance from the source builder. No chamfer/raster approximation is used for the 600 m source ring.
  const margin=b=>rectangleMargin(b,geometry);
  const intersect=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
  const geomBounds=geometryBounds(geometry);
  const x0=Math.floor((geomBounds[0]-ring)/size)*size,z0=Math.floor((geomBounds[1]-ring)/size)*size;
  const nx=Math.ceil((geomBounds[2]+ring-x0)/size),nz=Math.ceil((geomBounds[3]+ring-z0)/size),poses=[];
  const poseAt=(i,j)=>{
    const x=x0+(i+.5)*size,z=z0+(j+.5)*size,b=[x-size/2,z-size/2,x+size/2,z+size/2];
    const core=cells.some(c=>intersect(b,c)),distance=margin(b),scope=core?'core-touches':distance<=ring+1e-7?'ring-touches':'outside-ring';
    const ll=inverse(x,z),s=size/2/Math.tan(Math.PI/6);
    return {id:`aerial-r${String(j+1).padStart(2,'0')}-c${String(i+1).padStart(2,'0')}`,label:`Row ${j+1} · Column ${i+1}`,row:j+1,column:i+1,...ll,x,z,h:s,size,fov:60,heading:0,pitch:-90,square:true,scope,sourceRingMinDistanceM:distance,boundsXZ:b,gameSourceCommit:sha};
  };
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const v=poseAt(i,j);if(v.scope!=='outside-ring')poses.push(v);}
  // A compact optional outer context: corner cells and skyline anchors; it never dominates the full ring survey.
  const farCandidates=[[0,0,'northwest'],[nx-1,0,'northeast'],[0,nz-1,'southwest'],[nx-1,nz-1,'southeast']];
  const locations=args.locations?JSON.parse(fs.readFileSync(path.resolve(args.locations),'utf8')):[];
  for(const l of locations.filter(l=>l.kind==='skyline')){const [x,z]=project(l.lat,l.lon);farCandidates.push([Math.floor((x-x0)/size),Math.floor((z-z0)/size),l.id,l.label,l]);}
  for(const [i,j,tag,label,location] of farCandidates){const v=poseAt(i,j);if(v.scope==='outside-ring'&&!poses.some(p=>p.x===v.x&&p.z===v.z)){
    v.id=`context-${tag}`;v.label=label||`Distant context · ${tag}`;
    if(location){const [x,z]=project(location.lat,location.lon);Object.assign(v,{lat:location.lat,lon:location.lon,x,z,boundsXZ:[x-size/2,z-size/2,x+size/2,z+size/2],gridAligned:false,row:null,column:null});v.sourceRingMinDistanceM=margin(v.boundsXZ);}
    poses.push(v);
  }}
  for(const l of locations){const [x,z]=project(l.lat,l.lon);l.tileId=poses.find(p=>x>=p.boundsXZ[0]&&x<p.boundsXZ[2]&&z>=p.boundsXZ[1]&&z<p.boundsXZ[3])?.id||null;}
  const counts=poses.reduce((a,p)=>(a[p.scope]=(a[p.scope]||0)+1,a),{});
  // Preserve every occupied drive cell as exact Polygon geometry, avoiding interpolated outlines.
  const driveGeoJSON={type:'Feature',properties:{source:'data.district.mask',cellMetres:mask.cell,coordinateSystem:'WGS84 longitude/latitude, inverse of source game projection'},geometry:{type:'MultiPolygon',coordinates:cells.map(b=>[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(q=>{const p=inverse(...q);return [p.lon,p.lat];})])}};
  const boundary={gameSourceCommit:sha,city,district,bbox:cfg.bbox,projection:p,sourceIdentity:{citiesPath:'game/src/cities.js',citiesSha256:hash(cityBytes),dataPath:`game/data/${city}-${district}.json`,dataSha256:hash(dataBytes),dataGenerated:data.generated},analyticCore:{pieces,circles,polys},runtimeMask:mask,runtimeDriveCells:driveGeoJSON,ringMetres:ring,classification:'core-touches: positive-area square intersection with exact runtime drive cells. ring-touches: no drive cell intersection, but square minimum distance to source analytic bands/circles/polygons <= 600 m. outside-ring: optional distant context.',coverage:'Every 250 m grid cell intersecting the runtime playable mask or exact analytic 600 m ring is included. This describes capture coverage only; it is not a fidelity score.'};
  write('boundary-source.json',boundary);write('poses.json',poses);
  write('grid-plan.json',{gameSourceCommit:sha,city,district,grid:{x0,z0,columns:nx,rows:nz,sizeMetres:size},counts,locations,coverage:boundary.coverage});
  console.log(JSON.stringify({count:poses.length,counts,grid:{x0,z0,nx,nz},locations},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
