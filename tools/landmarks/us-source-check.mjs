import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../../game/vendor/three.module.min.js';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { collideBuildings } from '../../game/src/world.js';
import { US_FOOTPRINTS as U } from '../../game/src/landmark-us-source.js';
const ledger=JSON.parse(await fs.readFile(new URL('../../game/research/us-landmarks-source.json',import.meta.url)));
const sea=LANDMARKS.filter(l=>l.city==='seattle'),models=new Map();let checks=0;
assert.equal(sea.length,24);checks++;
for(const lm of sea){
    const row=ledger.landmarks.find(r=>r.id===lm.id);assert(row);assert.deepEqual(lm.sourceIds,row.sourceIds);
    assert.equal(new Set(lm.sourceIds).size,lm.sourceIds.length);checks+=3;
    const model=buildLandmark(lm,{realScale:true});model.mesh.updateMatrixWorld(true);models.set(lm.id,model);
    const bounds=new THREE.Box3().setFromObject(model.mesh);assert(Number.isFinite(bounds.max.y));checks++;
    for(const c of model.collision)c.r=Math.hypot(c.hw,c.hd);
}
const maxY=id=>new THREE.Box3().setFromObject(models.get(id).mesh).max.y;
for(const [id,h]of [['spaceneedle',184],['smith',148],['seatower',71],['bellevuetowers',137],['bellevue600',183],['columbia',286]]){assert(Math.abs(maxY(id)-h)<.02,`${id} total height includes its roof/crown, got ${maxY(id)}`);checks++;}
assert(maxY('greatwheel')>=52&&maxY('greatwheel')<=53.5,'Wheel complete gondola envelope matches surveyed 53 m');checks++;
assert(Math.abs(maxY('spheres')-27.5)<.02,'Largest Sphere respects tagged 27.5 m height');checks++;
const garage=models.get('seagarage'),courts=U.r15763840.filter(q=>q.role==='inner');assert.equal(courts.length,8);checks++;
for(const c of courts){const x=c.poly.reduce((v,q)=>v+q[0],0)/c.poly.length,z=c.poly.reduce((v,q)=>v+q[1],0)/c.poly.length;assert.equal(collideBuildings(garage.collision,x,z,.3,1),null,'Mapped garage lightwell remains open');checks++;}
assert(collideBuildings(garage.collision,-45,0,.3,1),'Solid garage deck approach still collides');checks++;
assert.equal(collideBuildings(models.get('lumen').collision,-2,4.5,.3,1),null,'No invisible rectangle fills the Lumen pitch');checks++;
const lm=sea.find(l=>l.id==='greatwheel');assert(!lm.sourceIds.includes('w429553385'),'Real separate ticket booth must survive the ride model');checks++;
for(const id of ['murroww','murrowe','mtbaker','rainier','olympics']){assert.equal(sea.find(l=>l.id===id).sourceIds.length,0,'Context-only structures must not replace unrelated buildings');checks++;}
// Independent mapped highway endpoints, not centres derived from the facade.
const portal=sea.find(l=>l.id==='mtbaker');
for(const [lat,lon]of [[47.5904232,-122.2885833],[47.5900628,-122.2885891],[47.589892,-122.2885849]]) {
    const x=(lon-portal.lon)*111320*Math.cos(portal.lat*Math.PI/180),z=-(lat-portal.lat)*111132;
    assert.equal(collideBuildings(models.get('mtbaker').collision,x,z,1,1),null,'All three mapped road mouths remain clear');checks++;
}
assert(collideBuildings(models.get('mtbaker').collision,0,-16,.3,1),'Inter-bore concrete pier retains collision');checks++;
const known=new Map();for(const lm of sea)for(const id of lm.sourceIds){assert(!known.has(id),`${id} owned twice`);known.set(id,lm.id);checks++;}
console.log(JSON.stringify({passed:true,checks,landmarks:24,sourceIdentities:known.size,heights:Object.fromEntries([...models.keys()].map(id=>[id,maxY(id)])),notes:['No claim of measured hardware FPS.','Three isolated views are model studies, not matched Street View comparisons.']},null,2));
