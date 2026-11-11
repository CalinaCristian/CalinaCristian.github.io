import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../game/vendor/three.module.min.js';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { BELLEVUE_SQUARE_PROFILE as P } from '../../game/src/landmark-bellevue-square.js';
import { ringArea, footprintCells } from '../../game/src/building-parts.js';

const sourceBuildings=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const lm=LANDMARKS.find(l=>l.id==='bellevuesq');
const model=buildLandmark(lm,{realScale:true,sourceBuildings});
const audit=model.mesh.userData.sourceMassAudit.bellevueSquare;
assert.deepEqual(audit.outline,sourceBuildings.w29234887[0].ring,'Every native parent vertex retained');
assert.deepEqual(audit.macys,sourceBuildings.w497739259[0].ring,'Every native part vertex retained');
const cells=footprintCells(audit.macys,[audit.outline]);
const outside=cells.filter(c=>!c.covered.length).reduce((a,c)=>a+Math.abs(ringArea(c.ring)),0);
assert.ok(outside<1e-6,'Part must be entirely inside the shared physical envelope');
assert.deepEqual(lm.sourceIds,['w29234887','w497739259'],'Only exact source identities replace generic copies');
assert.equal(model.collision[0].poly.length,audit.outline.length);
assert.equal(model.collision[0].y1,P.bodyHeightM);
const c=Math.cos(lm.rotation),s=Math.sin(lm.rotation),rotate=([x,z])=>[x*c+z*s,-x*s+z*c];
assert.deepEqual(model.collision[0].poly,audit.outline.map(rotate),'Collision uses the identical whole mapped outline');
model.mesh.updateMatrixWorld(true);
const local=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(model.mesh.matrixWorld);
const probes=[];
// A reader east of the recess sees both complete name lines, including the ends.
for(const [word,y] of [['BELLEVUE',17.1],['SQUARE',15.9]])for(const dx of [-3,0,3]) {
 const target=local(P.entranceX+dx,y,P.entranceFrontZ-.15),eye=local(P.entranceX,1.7,P.entranceFrontZ-30),delta=target.clone().sub(eye);
 const hit=new THREE.Raycaster(eye,delta.clone().normalize(),0,delta.length()-.2).intersectObject(model.mesh,true)[0];
 assert.equal(hit,undefined,'Source wings and gallery must not stand in front of lettering');probes.push({word,dx,clear:true});
}
const bounds=new THREE.Box3().setFromObject(model.mesh);
assert.ok(bounds.max.y<22&&bounds.max.y>20,'Roof-supported gable, no inferred 57.6m tower');
assert.ok(model.triangles<15000,'Bounded facade detail');
console.log(JSON.stringify({passed:true,parentVertices:audit.outline.length,partVertices:audit.macys.length,sourcePartOutsideM2:outside,collisionPieces:model.collision.length,triangles:model.triangles,signApproachProbes:probes,modelHeightM:bounds.max.y,scope:'Source preservation, full outline collision and sign approach. Heights remain model estimates; native original-camera review still required.'},null,2));
