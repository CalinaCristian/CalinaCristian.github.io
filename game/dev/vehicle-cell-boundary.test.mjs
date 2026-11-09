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
assert.equal(native.vehicles[0].x,fixture.guard.beforeGuard.actors[0]._x0,'the worsening 593 proposal is now rolled back');
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
console.log('PASS: native 593/609 old-cell miss, actual Grid rebuild, physical rollback and clear-boundary control');
