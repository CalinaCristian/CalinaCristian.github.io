import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from '../../game/vendor/three.module.min.js';
import {LANDMARKS,buildLandmark} from '../../game/src/landmarks.js';
import {US_FOOTPRINTS as U} from '../../game/src/landmark-us-source.js';
import {collideBuildings} from '../../game/src/world.js';
import {DEPARTURES_CURB,GARAGE_STRUCTURE,SKYBRIDGE_STRUCTURE} from '../../game/src/landmark-seatac-structure.js';
import { readDistrictData } from '../osm/district-data.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const garageLm=LANDMARKS.find(x=>x.id==='seagarage'),terminalLm=LANDMARKS.find(x=>x.id==='seatac');
const garage=buildLandmark(garageLm,{realScale:true}),terminal=buildLandmark(terminalLm,{realScale:true});
for(const m of [garage,terminal]){m.mesh.updateMatrixWorld(true);for(const c of m.collision)c.r=Math.hypot(c.hw,c.hd);}
const close=(a,b,n)=>assert(Math.abs(a-b)<1e-6,n),hit=(c,x,z,y,r=.1)=>collideBuildings([c],x,z,r,y,2);
const decks=garage.collision.filter(c=>c.structureKind==='garage-deck');assert.equal(decks.length,8);
const outer=U.r15763840.find(x=>x.role==='outer').poly,holes=U.r15763840.filter(x=>x.role==='inner').map(x=>x.poly);
for(const c of decks){assert.deepEqual(c.poly,outer);assert.deepEqual(c.holes,holes);assert(c.minH>=0);assert(c.y1>c.minH);assert.equal(c.y0,undefined);}
close(decks.at(-1).y1,21.4,'Existing roof level retained');
const source=readDistrictData(new URL('../../game/data/seattle-seatac.bin.gz',import.meta.url)),baseline=JSON.parse(fs.readFileSync(new URL('../../handoffs/fidelity/us-districts/native-c78a5f4/seatac-block-classification/report.json',import.meta.url)));
const proj=source.proj,toLocal=(lm,x,z)=>{const dx=x-(lm.lon-proj.lon0)*proj.mPerLon,dz=z+(lm.lat-proj.lat0)*proj.mPerLat;return[dx,dz];};
const rawGarage=baseline.classification.findings.filter(x=>x.sourceRoadId!=='w37017723');
const pointResults=rawGarage.map(x=>{const [a,b]=toLocal(garageLm,x.exactReproducedPoint.x,x.exactReproducedPoint.z);return{id:x.rawId,blocked:!!collideBuildings(garage.collision,a,b,.05,x.exactReproducedPoint.expectedSourceEdgeFootY-.12,2)};});
// Full capsule reachability is independently tested by the native browser runner.
assert(pointResults.filter(x=>!x.blocked).length>50,'Open garage structure must clear the interior source aisle points');
const post=garage.collision.find(c=>c.structureKind==='garage-visible-post');assert(hit(post,post.x,post.z,.12),'Rendered exterior post remains solid');
const testPoint=rawGarage[0].exactReproducedPoint,[gx,gz]=toLocal(garageLm,testPoint.x,testPoint.z),deck=decks[1];
assert(hit(deck,gx,gz,deck.minH-2+.01),'Whole body reaches the slab from below');
assert.equal(hit(deck,gx,gz,deck.minH-2-.01),null,'Whole body clears below the slab');
assert(hit(deck,gx,gz,deck.minH+.01),'Inside slab stays solid');assert.equal(hit(deck,gx,gz,deck.y1+.01),null,'Above slab is clear');
// Every lower parking interval preserves full official entrance vehicle clearance.
for(let i=1;i<GARAGE_STRUCTURE.floorDatumsM.length;i++){const delta=GARAGE_STRUCTURE.floorDatumsM[i]-GARAGE_STRUCTURE.floorDatumsM[i-1],sp=i<=3?GARAGE_STRUCTURE.lowerSpandrelDepthM:GARAGE_STRUCTURE.spandrelDepthM;assert(delta-Math.max(sp,GARAGE_STRUCTURE.deckThicknessM)-.12>=GARAGE_STRUCTURE.operationalEntranceLimitM,'Slab/spandrel full vehicle headroom');}
const bridgeControls=[];
for(const q of SKYBRIDGE_STRUCTURE.profiles){
 const all=garage.collision.filter(c=>c.sourceId===q.sourceId&&c.structureKind?.startsWith('skybridge-'));assert(all.length>0);assert.deepEqual([q.garage,q.terminal].sort(),U[q.sourceId].slice().sort(),'Mapped source bridge endpoints unchanged');close(q.garageFloorM,GARAGE_STRUCTURE.level4WalkSurfaceM,'Bridge connects to actual fourth model deck surface');assert(q.gradient>=0&&q.gradient<.03,'Bounded modest estimated gradient');assert(q.lowerArrivalsClearanceM>3.6576,'Full12ft lower arrivals vehicle clearance');
 const dx=q.terminal[0]-q.garage[0],dz=q.terminal[1]-q.garage[1],nx=-dz/q.lengthM,nz=dx/q.lengthM;
 for(const t of [.1,.5,.9]){const x=q.garage[0]+dx*t,z=q.garage[1]+dz*t,y=q.garageFloorM+(q.terminalFloorM-q.garageFloorM)*t;assert.equal(collideBuildings(all,x,z,.2,y+.03,2.2),null,'Full2.2m pedestrian clears the physical interior');assert(collideBuildings(all,x,z,.2,y-.1,.3),'Physical floor is solid');assert(collideBuildings(all,x,z,.2,y+2.25,.2),'Physical roof is solid above the stated headroom');assert(collideBuildings(all,x+nx*3.25,z+nz*3.25,.15,y+.1,1.7),'Visible side pane/frame is solid');assert.equal(collideBuildings(all,x,z,.2,y+2.55,.2),null,'Above the roof is clear');}
 bridgeControls.push({sourceId:q.sourceId,garageFloorM:q.garageFloorM,terminalFloorM:q.terminalFloorM,gradient:q.gradient,clearInteriorM:SKYBRIDGE_STRUCTURE.clearInteriorM,lowerArrivalsClearanceM:q.lowerArrivalsClearanceM,fullBodyControls:15});
}
const originalTerminal=baseline.classification.findings.filter(x=>x.sourceRoadId==='w37017723');
for(const f of originalTerminal){const [x,z]=toLocal(terminalLm,f.exactReproducedPoint.x,f.exactReproducedPoint.z);const old=terminal.collision.filter(c=>c.sourceId==='w23772634');assert.equal(collideBuildings(old,x,z,.05,f.exactReproducedPoint.expectedSourceEdgeFootY-.12,2),null,'Original terminal point is an actual covered curb opening');}
const lower=terminal.collision.find(c=>c.structureKind==='terminal-below-covered-curb'),upper=terminal.collision.find(c=>c.structureKind==='terminal-above-covered-curb'),f=originalTerminal[0].exactReproducedPoint,[tx,tz]=toLocal(terminalLm,f.x,f.z);
assert(hit(lower,tx,tz,lower.y1-.1),'Complete source footprint remains solid below the covered curb');
assert(hit(upper,tx,tz,upper.minH+.01),'Complete source footprint remains solid above the covered curb');
assert.equal(hit(upper,tx,tz,upper.minH-2-.01),null,'Full body below terminal canopy is clear');assert(hit(upper,tx,tz,upper.minH-2+.01),'Headroom contact with canopy is solid');assert.equal(hit(upper,tx,tz,upper.y1+.01),null,'Above upper terminal band is clear');
const curbPost=terminal.collision.find(c=>c.structureKind==='terminal-covered-curb-post');assert(curbPost&&hit(curbPost,curbPost.x,curbPost.z,DEPARTURES_CURB.modelRoadSurfaceLocalM),'Covered curb post remains solid');
for(const m of [garage,terminal]){const bounds=new THREE.Box3().setFromObject(m.mesh);close(bounds.min.y,0,'No building lift or buried substitute');}
close(new THREE.Box3().setFromObject(garage.mesh).max.y,24.55,'Garage complete existing roof-core envelope retained');
close(new THREE.Box3().setFromObject(terminal.mesh).max.y,36.5,'Terminal/IAF literal overall envelope retained');
assert.deepEqual(terminalLm.sourceIds,['w23772634','w23772637','w734002404','w869951038']);
const baselineRoot=process.argv.find(x=>x.startsWith('--baseline-root='))?.slice('--baseline-root='.length),legacy=[];
if(baselineRoot){const old=await import(pathToFileURL(baselineRoot+'/game/src/landmarks.js'));for(const lm of LANDMARKS.filter(x=>!['seatac','seagarage'].includes(x.id))){const before=old.buildLandmark(old.LANDMARKS.find(x=>x.id===lm.id),{realScale:true}),after=buildLandmark(lm,{realScale:true});assert.deepEqual(after.collision,before.collision,lm.id+' legacy collider unchanged');legacy.push({id:lm.id,collisionSha256:hash(after.collision)});}}
console.log(JSON.stringify({passed:true,garage:{sourceOuterHash:hash(outer),holes:holes.length,decks:decks.length,sourceAislePoints:pointResults,colliders:garage.collision.length,triangles:garage.triangles,profile:GARAGE_STRUCTURE},terminal:{sourceRoad:DEPARTURES_CURB.sourceRoadId,originalPointsCleared:originalTerminal.length,colliders:terminal.collision.length,triangles:terminal.triangles,modelSoffitLocalM:DEPARTURES_CURB.modelSoffitLocalM,dimensionStatus:'Bounded model estimates, not surveyed.'},skybridgeControls:bridgeControls,legacyColliderControls:legacy},null,2));
