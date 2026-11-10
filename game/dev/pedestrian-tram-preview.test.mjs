import assert from 'node:assert/strict';
import {Traffic,Pedestrians} from '../src/traffic.js';
import {makeVehicle} from '../src/vehicles.js';

// Actual native placement and emitted27m tram geometry. A present support
// catalogue triggers the fitter even on a source leg outside a raised model.
const a={x:0,z:0,y:0,edges:[],radius:0},b={x:1000,z:0,y:0,edges:[],radius:0};
const edge={id:'rail:source-fixture:0',rail:true,tram:true,usable:true,publicTram:true,throughTram:true,railDirections:[1],a,b,len:1000,dirx:1,dirz:0,nx:0,nz:1,ya:0,yb:0,grade:{known:true,ya:0,yb:0}};
a.edges=[edge];b.edges=[edge];
const T=Object.assign(Object.create(Traffic.prototype),{buc:true,world:{tramDeckSupportAt:()=>null}});
const mesh=makeVehicle('tram-v3a','#fff',{instanced:true});mesh.scale.set(1.02,1,1.02);mesh.rotation.set(0,-1.3,0,'YXZ');
const v={id:492,kind:'tram-v3a',edge,dir:1,s:500,x:500,y:.24,z:0,heading:-1.3,fx:1,fz:0,length:27,width:2.4,speed:0,long:true,tram:true,route:[],hist:[],mesh};
mesh.position.set(v.x,v.y,v.z);
const C=Object.assign(Object.create(Pedestrians.prototype),{t:T,crowd:{reach:()=>.3},stats:{}});
const p={i:19,x:500,z:2,onRoad:true};
const state=()=>({x:v.x,y:v.y,z:v.z,s:v.s,heading:v.heading,speed:v.speed,position:mesh.position.toArray(),rotation:mesh.rotation.toArray(),route:v.route.slice(),hist:v.hist.slice()});
const before=state();
const predicted=C.vehicleStepClearsPerson(v,p,1/30);
assert.equal(C.stats.yieldPreviewRefused,undefined,JSON.stringify(C.stats.lastYieldPreviewRefusal));
assert.equal(predicted,true,'native model-backed tram prediction can release a physically separating side yield');
assert.deepEqual(state(),before,'actual actor, mesh, source route and history remain unchanged');
assert.equal(C._yieldVehicle.mesh.userData._model,mesh.userData._model,'the full actual emitted model is retained read-only');
assert.equal(C._yieldVehicle.mesh.scale,mesh.scale,'actual nonunit model scale is retained');
assert.notEqual(C._yieldVehicle.route,v.route);assert.notEqual(C._yieldVehicle.hist,v.hist);
assert.equal(C.stats.yieldPreviewRefused,undefined,'valid source geometry must succeed rather than merely swallowing the missing-model exception');
const missing={...v,mesh:{userData:{},scale:mesh.scale,rotation:mesh.rotation}};
assert.equal(C.vehicleStepClearsPerson(missing,p,1/30),false,'an unresolved temporary support prediction keeps yielding');
assert.equal(C.stats.yieldPreviewRefused,1);assert.match(C.stats.lastYieldPreviewRefusal.reason,/missing-actual-emitted-tram-support-geometry/);
assert.deepEqual(state(),before);
const front={...p,x:515,z:0};assert.equal(C.vehicleStepClearsPerson(v,front,1/30),false,'a genuine front crossing still stops the tram');
console.log('PASS: actual native tram geometry/scale/support preview, separating side release, live pose/route/history isolation, unresolved-support diagnostic and front crossing');
