import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic,Pedestrians} from '../src/traffic.js';
const F=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-pedestrian-325-87.json',import.meta.url)));
const edges=new Map();
function edge(raw){if(edges.has(raw.id))return edges.get(raw.id);const e={...raw,laneW:3.5,laneCenterShiftM:0,median:2*(raw.wR-raw.lanesF*3.5),a:{...raw.a},b:{...raw.b}};edges.set(e.id,e);return e;}
const V={...F.vehicle87,edge:edge(F.vehicle87.edge),route:F.vehicle87.route.map(r=>({e:edge(r.edge),dir:r.dir})),hist:[],latExtraCur:0};V.mesh=new THREE.Group();V.mesh.position.set(V.x,V.y,V.z);V.mesh.rotation.set(0,V.heading,0,'YXZ');
const P=structuredClone(F.pedestrian325),T=Object.create(Traffic.prototype);T.buc=true;T.rng=()=>{throw Error('No preview RNG');};T._t={sentinel:true};
const C=Object.create(Pedestrians.prototype);Object.assign(C,{t:T,crowd:{reach:()=>.3},grid:{query(x,z,r,fn){fn(P);}}});
const pose=v=>[v.x,v.y,v.z,v.s,v.heading,v.speed,v.laneCur,v.mesh.position.x,v.mesh.rotation.y];
const old=pose(V),route=V.route.slice();
assert.equal(C.obstacleGap(V,F.actualGapCallback.look),Infinity,'native curved placement clears exact87/325 negative-gap side yield');
assert.deepEqual(pose(V),old,'preview never edits live body or mesh');assert.deepEqual(V.route,route);assert.deepEqual(T._t,{sentinel:true},'native path scratch is isolated');
assert.ok(C._yieldVehicle.x!==V.x||C._yieldVehicle.z!==V.z,'test challenges actual native placement');
const baselineArg=process.argv.find(s=>s.startsWith('--baseline='));
if(baselineArg){const{Pedestrians:Old}=await import(pathToFileURL(baselineArg.slice(11)+'/game/src/traffic.js'));assert.equal(Old.prototype.obstacleGap.call(C,V,F.actualGapCallback.look),F.actualGapCallback.result,'exact old road cone reproduces recorded negative gap');}
// Keep the unchanged .7m pedestrian comfort margin: the recorded return step
// is correctly refused until the vehicle's physical movement creates room.
const leg=P.legs[0],d=Math.hypot(leg.x-P.x,leg.z-P.z),step=P.speed*1.25/30,q={...P,x:P.x+(leg.x-P.x)/d*step,z:P.z+(leg.z-P.z)/d*step};
T.grid={items:[V],query(x,z,r,fn){fn(V);}};C._fr=1;C._stepDt=1/30;C.stats={pushes:0};
assert.equal(C.avoidVehicles(q,P.x,P.z,true),true);assert.deepEqual([q.x,q.z],[P.x,P.z]);
function simple({x=0,z=0,heading=-Math.PI/2,fx=1,fz=0}={}){const a={x:-20,z:0,y:0,edges:[],radius:0},b={x:100,z:0,y:0,edges:[],radius:0},e={a,b,dirx:1,dirz:0,nx:0,nz:1,len:120,laneW:3.5,median:-3.5,lanesF:1,lanesB:0,oneway:true};a.edges=[e];b.edges=[e];return{x,z,y:.24,heading,fx,fz,rx:-fz,rz:fx,length:4.36,width:1.73,edge:e,s:x+20,dir:1,lane:0,laneCur:0,latExtraCur:0,latBlend:0,speed:0,route:[],hist:[],mesh:new THREE.Group()};}
const forward=simple(),front={i:1,x:2.5,z:0,onRoad:true};C.grid.query=(x,z,r,fn)=>fn(front);
assert.ok(C.obstacleGap(forward,20)<0,'a true negative-gap front crossing still stops the car');
const side={i:2,x:.5,z:1.3,onRoad:true};C.grid.query=(x,z,r,fn)=>fn(side);
assert.equal(C.vehicleStepClearsPerson(forward,side,1/30),false,'a parallel side body with no increasing clearance is not waived');
const overlap={...side,z:.9};assert.equal(C.vehicleStepClearsPerson(forward,overlap,1/30),false,'actual body-envelope overlap never qualifies');
const toward=simple({heading:-1.4});const towardPerson={i:3,x:1,z:1.3,onRoad:true};
assert.equal(C.vehicleStepClearsPerson(toward,towardPerson,1/30),false,'native heading recovery sweeping toward the side cannot be released');
assert.equal(C.vehicleStepClearsPerson({...V,y:-5.76},P,1/30),false,'another grade cannot acquire this street-level release');
C.crowd.reach=()=>1;assert.equal(C.vehicleStepClearsPerson(V,P,1/30),false,'carried-body reach remains part of physical clearance');C.crowd.reach=()=>.3;
console.log('PASS: native87/325 forward separation, unchanged comfort refusal, preview isolation, front/side/turn/overlap/grade/carried controls');
