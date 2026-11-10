import assert from 'node:assert/strict';
import {fitTramBodySupport,validateTramSupportCertificate} from '../src/tram-body-support.js';
import {makeVehicle} from '../src/vehicles.js';

const mesh=makeVehicle('tram-v3a','#fff',{instanced:true});
// The actual emitter sits on a complete flat source slab; positive clearance
// and full native support validation remain required on a cache miss.
const piece={id:'source-piece',sourceId:'source-way',modelId:'source-model',a:[-40,0],b:[40,0],poly:[[-40,-4],[40,-4],[40,4],[-40,4]],top:[[-40,2,-4],[40,2,-4],[40,2,4],[-40,2,4]],band:()=>({bottom:1.5,top:2})};
let queries=0,sourceY=2,pathStretch=1;
const supportAt=Object.assign(()=>2,{inBox:()=>{queries++;return[piece];}});
const edge={id:'rail:source-way:0',grade:{modelId:'source-model'}};
const v={edge,dir:1,s:50,x:0,y:2.24,z:0,heading:-Math.PI/2,length:27,width:2.4,speed:.04,mesh};
const samplePath=(v,off=0)=>({x:v.x+off*pathStretch,y:sourceY,z:v.z,edge});
const fit=()=>fitTramBodySupport(v,{samplePath,supportAt,nativePitch:0});
let r=fit();assert(r.known);assert.equal(r.supportLiftM,0);assert.equal(queries,1);
v.railSupport=r;v.y=r.y;mesh.rotation.set(r.pitch,v.heading,0,'YXZ');
assert.equal(validateTramSupportCertificate(v,supportAt).valid,true,'a reused result still meets actual emitted geometry/source-slab clearance');
const count=queries;
v.speed=9;assert.deepEqual(fit(),r);assert.equal(queries,count,'an identical physical pose reuses the full fit regardless of requested speed');
v.x=Number.MIN_VALUE;r=fit();assert(r.known);assert.equal(queries,count+1,'even an adjacent Float64 pose cannot alias through the short diagnostic hash');
v.speed=0;assert.deepEqual(fit(),r);assert.equal(queries,count+1);
v.s+=.000000001;fit();assert.equal(queries,count+2,'source station changes invalidate');
sourceY+=1e-10;fit();assert.equal(queries,count+3,'sampled source height changes invalidate without coordinate rounding');
pathStretch=.999;fit();assert.equal(queries,count+4,'a newly selected source path cannot reuse the old fit just because its sampled heights match');
mesh.scale.z=1.001;fit();assert.equal(queries,count+5,'actual model scale changes invalidate');
mesh.userData._model.geo.attributes.position.needsUpdate=true;fit();assert.equal(queries,count+6,'actual model-buffer revision changes invalidate even when its diagnostic fingerprint remains the same');
const freshProvider=Object.assign(()=>2,{inBox:()=>{queries++;return[piece];}});
const newer=fitTramBodySupport(v,{samplePath,supportAt:freshProvider,nativePitch:0});assert(newer.known);assert.equal(queries,count+7,'a different world/provider cannot reuse the previous certificate');
v.x=.1;const moved=fitTramBodySupport(v,{samplePath,supportAt:freshProvider,nativePitch:0});assert(moved.known);assert.equal(queries,count+8,'a moving pose performs the full support computation');
console.log('PASS: emitted support/clearance, repeated nonzero-speed pose, adjacent Float64/station/grade/scale/model-version/provider/moving invalidation');
