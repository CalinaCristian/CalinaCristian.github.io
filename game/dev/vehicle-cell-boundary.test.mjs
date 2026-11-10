import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic} from '../src/traffic.js';
import {obbPen,vObb} from './harness/page/util.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-cell-boundary-593-609.json',import.meta.url)));
// Keep the production Grid and guard. This subclass only avoids constructing
// an unrelated fleet while obtaining the real spatial index from Traffic.
class EmptyTraffic extends Traffic {setupTransit(){} buildBusStops(){} spawnAll(){}}
function scene() {
    const t=new EmptyTraffic({graph:{edges:[],nodes:[]},buildings:[],walkTop:()=>.13},{id:'seattle'},new THREE.Scene(),{maxPeds:0});
    Object.assign(t,{_frame:fixture.frame,_dt:fixture.dt,world:{},stats:{}});
    t.vehicles=fixture.guard.beforeGuard.actors.map((a,i)=>{
        const old=fixture.step.before.actors[i];
        return {...a,x:old.x,z:old.z,odo:0,layer:0,hist:[],route:[],
            _e0:a.edge,_d0:old.dir,_ln0:old.lane,_ly0:0,_y0:old.y,_lb0:old.latBlend,
            _odo0:0,_lc0:old.laneCur,_le0:old.latExtraCur,_hl0:0,
            _fx0:old.fx,_fz0:old.fz,_rx0:-old.fz,_rz0:old.fx,
            mesh:{position:new THREE.Vector3(old.x,old.y,old.z),rotation:new THREE.Euler(0,old.heading,0)}};
    });
    t.grid.build(t.vehicles);
    t.vehicles.forEach((v,i)=>Object.assign(v,fixture.guard.beforeGuard.actors[i],{hist:[],route:[]}));
    return t;
}
const penetration=t=>obbPen(...t.vehicles.map(vObb));
const native=scene(),initial=penetration(native);
assert.equal(Math.floor(fixture.step.before.actors[1].x/16),3);
assert.equal(Math.floor(native.vehicles[1].x/16),4);
let missed=true;native.grid.query(native.vehicles[0].x,native.vehicles[0].z,12,v=>{if(v.id===609)missed=false;});
assert.equal(missed,true,'the actual old-position hash reproduces the missed native cell-boundary query');
native.overlapGuard();
// The worsening proposal is rolled back. The restored pose is itself an established contact, so the same guard
// pass may then back that car off along its own axis by at most 0.8 m/s: never forward, never past the proposal.
{
    const v=native.vehicles[0],o=native.vehicles[1],start=fixture.guard.beforeGuard.actors[0],proposed=fixture.guard.beforeGuard.actors[0];
    const moved=Math.hypot(v.x-start._x0,v.z-start._z0),restored=obbPen({...vObb(v),x:start._x0,z:start._z0},vObb(o));
    assert.ok(moved<=.8*fixture.dt+1e-9,'the worsening 593 proposal is rolled back (only a bounded back-off may follow)');
    assert.ok(Math.hypot(v.x-proposed.x,v.z-proposed.z)>1e-6,'the proposed worsening pose is not kept');
    assert.ok(penetration(native)<=restored+1e-9,'a back-off after the rollback never deepens the restored contact');
}
assert.ok(penetration(native)<initial,'the native pair does not accumulate the unchecked worsening step');
assert.deepEqual(native.vehicles.map(v=>v.id),[593,609]);

const baseline=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
if(baseline) {
    const Old=(await import(pathToFileURL(path.resolve(baseline,'game/src/traffic.js')).href)).Traffic,t=scene();
    Old.prototype.overlapGuard.call(t);
    assert.equal(t.vehicles[0].x,fixture.guard.beforeGuard.actors[0].x,'source067 reproduces the missed worsening proposal');
    assert.ok(penetration(t)>penetration(native));
    console.log(JSON.stringify({nativeProposed:initial,oldAfter:penetration(t),candidateAfter:penetration(native)}));
}

// A genuinely clear proposal across the same boundary remains ordinary motion.
const clear=scene();clear.vehicles[1].z+=20;
const proposed=clear.vehicles.map(v=>[v.x,v.z,v.heading]);clear.overlapGuard();
assert.deepEqual(clear.vehicles.map(v=>[v.x,v.z,v.heading]),proposed);

function threeBodies() {
    const t=scene();t._frame=1;
    const body=(id,x,old=x,parked=false)=>{
        const edge={len:100};return {id,x,z:0,y:.24,s:x,odo:0,speed:0,heading:-Math.PI/2,fx:1,fz:0,rx:0,rz:1,length:4,width:1.8,layer:0,parked,edge,dir:1,lane:0,laneCur:0,latBlend:0,latExtraCur:0,hist:[],route:[],
            _f:1,_resp:false,_x0:old,_z0:0,_h0:-Math.PI/2,_e0:edge,_d0:1,_ln0:0,_ly0:0,_y0:.24,_lb0:0,_s0:old,_odo0:0,_lc0:0,_le0:0,_hl0:0,_fx0:1,_fz0:0,_rx0:0,_rz0:1,
            mesh:{position:new THREE.Vector3(x,.24,0),rotation:new THREE.Euler(0,-Math.PI/2,0)}};
    };
    t.vehicles=[body(1,64.01,63.99),body(2,67.9,67.9,true),body(3,60.1,59.9)];t.grid.build(t.vehicles);return t;
}
const trio=threeBodies();
assert.ok(obbPen({...vObb(trio.vehicles[0]),x:63.99},{...vObb(trio.vehicles[2]),x:59.9})<0,'the later pair starts physically clear');
trio.overlapGuard();
assert.ok(obbPen(vObb(trio.vehicles[0]),vObb(trio.vehicles[2]))<=0,'a cross-cell rollback cannot blind a later third-body guard');
let found=false;trio.grid.query(60.1,0,12,v=>{if(v.id===1)found=true;});assert.equal(found,true);
const entrySource=process.argv.find(x=>x.startsWith('--entry-source='))?.slice(15);
if(entrySource) {
    const Entry=(await import(pathToFileURL(path.resolve(entrySource,'game/src/traffic.js')).href)).Traffic,old=threeBodies();
    // Bind all old correction methods: the fixture must exercise that immutable
    // source, rather than dispatching to this candidate's membership refresh.
    old.revert=Entry.prototype.revert;old.separateVehicleStep=Entry.prototype.separateVehicleStep;
    Entry.prototype.overlapGuard.call(old);
    assert.ok(obbPen(vObb(old.vehicles[0]),vObb(old.vehicles[2]))>.1,'entry rebuild alone reproduces a new third-body contact after cross-cell rollback');
}

const recovery=threeBodies();recovery.vehicles.length=2;recovery.grid.build(recovery.vehicles);
let rebuilds=0;const build=recovery.grid.build.bind(recovery.grid);recovery.grid.build=items=>{rebuilds++;return build(items);};
assert.equal(recovery.separateVehicleStep(recovery.vehicles[0],recovery.vehicles[1],-.02),true);
assert.equal(rebuilds,1,'a real cross-cell separating correction refreshes membership');
let recovered=false;recovery.grid.query(60,0,12,v=>{if(v.id===1)recovered=true;});assert.equal(recovered,true);
recovery._frame++;assert.equal(recovery.separateVehicleStep(recovery.vehicles[0],recovery.vehicles[1],-.01),true);
assert.equal(rebuilds,1,'a correction inside the same cell adds no rebuild');
console.log('PASS: native 593/609 proposal, cross-cell rollback/third body, recovery membership, sparse refresh and clear-boundary controls');
