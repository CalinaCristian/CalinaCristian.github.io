import fs from'node:fs';import path from'node:path';import zlib from'node:zlib';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{CITIES}from'../../game/src/cities.js';import{LANDMARKS}from'../../game/src/landmarks.js';import{MENU_AVAILABLE}from'../../game/src/spot-availability.js';import{districtLandmarkCoverage,LANDMARK_VIEW_DISTANCE_M}from'../../game/src/landmark-visibility.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),read=p=>fs.readFileSync(path.join(root,p)),sourceSha=process.argv.find(a=>a.startsWith('--source='))?.slice(9)||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hash=b=>createHash('sha256').update(b).digest('hex');
const inputs=['game/src/cities.js','game/src/world.js','game/src/landmarks.js','game/src/landmark-visibility.js','game/src/drone-boundary.js','game/src/spot-availability.js'];
for(const p of inputs)if(hash(read(p))!==hash(execFileSync('git',['show',sourceSha+':'+p],{cwd:root,maxBuffer:10000000})))throw Error('Commit coverage input before generating range metadata: '+p);
const file='game/overview/inventory.json',inventory=JSON.parse(read(file)),contexts=new Map(LANDMARKS.map(l=>[l.id,[]])),districtRecords=[];
for(const[cityId,city]of Object.entries(CITIES))for(const[id,d]of Object.entries(city.districts)){
 const dataFile=`game/data/${cityId}-${id}.json`,data=JSON.parse(read(dataFile)),coverage=districtLandmarkCoverage({landmarks:LANDMARKS,cityId,district:d,data});inputs.push(dataFile);
 districtRecords.push({id,city:cityId,configured:d.landmarks.length,missing:coverage.filter(c=>c.missing).map(c=>c.id)});
 for(const c of coverage)if(c.configured)contexts.get(c.id).push({kind:'district',id,name:d.name,range:c.range,distanceM:c.distanceM,scenery:c.scenery,nativeBuildVerified:false});
}
const globalContext=JSON.parse(zlib.gunzipSync(read('game/data/spots/seattle-context.json.gz'))),globalIds=new Set(globalContext.buildings.map(b=>b.sourceId||b.id));inputs.push('game/data/spots/seattle-context.json.gz');
const pointIn=(x,z,P)=>{let inside=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,t=L?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
const primary={arcul:'arcul-de-triumf',spaceneedle:'space-needle'};
for(const visit of inventory.spots.filter(s=>MENU_AVAILABLE.has(s.id))){
 const possible=[visit.scene,visit.id].map(s=>`game/data/spots/${s}.json`),dataFile=possible.find(p=>fs.existsSync(path.join(root,p)));if(!dataFile)continue;
 const data=JSON.parse(read(dataFile));if(!data.spots?.[visit.id])continue;inputs.push(dataFile);
 const ids=new Set((data.buildings||[]).map(b=>b.id)),extent=data.spots[visit.id].extent?.polygon||[],origin=data.origin,projection=data.projection,regional=['pike-place','space-needle'].includes(visit.id);
 if(!origin||!projection||![origin.lat,origin.lon,projection.mLat,projection.mLon].every(Number.isFinite))throw Error('Visit projection is unresolved: '+visit.id);
 for(const lm of LANDMARKS){if(lm.city!==visit.city)continue;
  const local=(lm.sourceIds||[]).some(id=>ids.has(id)),context=regional&&(lm.sourceIds||[]).some(id=>globalIds.has(id));
  if(!local&&!context&&primary[lm.id]!==visit.id&&!(lm.backdrop&&visit.city==='seattle'))continue;
  const x=(lm.lon-origin.lon)*projection.mLon,z=(origin.lat-lm.lat)*projection.mLat;
  let distanceM=extent.length&&pointIn(x,z,extent)?0:extent.length?Math.min(...extent.map((p,i)=>segmentDistance(x,z,p,extent[(i+1)%extent.length]))):Math.hypot(x,z);
  if(primary[lm.id]===visit.id)distanceM=0;
  const range=lm.backdrop||distanceM>600?'distant':distanceM>1?'nearby':'close';
  contexts.get(lm.id).push({kind:'visit',id:visit.id,name:visit.id==='space-needle'?'Seattle Center visit':visit.name,range,distanceM,modelScope:'Tourist scenes use their own models/source geometry; the catalogue study is separate.'});
 }
}
for(const lm of inventory.landmarks)lm.rangeContexts=contexts.get(lm.id)||[];
inventory.landmarkRanges={schemaVersion:1,sourceSha,displayTimeZone:'America/Los_Angeles',drawDistanceM:LANDMARK_VIEW_DISTANCE_M,flightMarginM:150,scope:'Staging intended view ranges from the stored playable areas and selected tourist source geometry. Actual camera direction, terrain/building occlusion and weather determine visibility. Native district construction/performance verification remains pending.',districts:districtRecords,inputHashes:Object.fromEntries([...new Set(inputs)].map(p=>[p,hash(read(p))]))};
fs.writeFileSync(path.join(root,file),JSON.stringify(inventory,null,2)+'\n');console.log(JSON.stringify({landmarks:inventory.landmarks.length,withContexts:inventory.landmarks.filter(l=>l.rangeContexts.length).length,contexts:[...contexts.values()].reduce((n,a)=>n+a.length,0),districts:districtRecords.length,missingPairs:districtRecords.reduce((n,d)=>n+d.missing.length,0)}));
