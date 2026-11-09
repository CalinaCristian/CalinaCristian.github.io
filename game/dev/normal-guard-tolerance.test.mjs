import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic} from '../src/traffic.js';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-guard-57.json',import.meta.url)));
function scene() {
    const t=Object.create(Traffic.prototype);t._frame=f.frame;t._dt=1/30;t.stats={};t.world={};
    t.vehicles=f.vehicles.map(v=>({...v,odo:0,ovT:0,revT:0,layer:0,_f:f.frame,_e0:v.edge,_d0:v.dir,_ln0:v.lane,_ly0:0,_y0:v.y,_lc0:v.laneCur,_le0:0,_odo0:0,_hl0:v.hist.length,
        mesh:{position:new THREE.Vector3(v.x,v.y,v.z),rotation:new THREE.Euler(0,v.heading,0)}}));
    t.grid={query(x,z,r,fn){for(const v of t.vehicles)fn(v);}};return t;
}
assert.ok(f.proposedPenetrationM>0&&f.proposedPenetrationM<.05);
const t=scene(),pose=[t.vehicles[0].x,t.vehicles[0].z,t.vehicles[0].heading];t.overlapGuard();
assert.deepEqual([t.vehicles[0].x,t.vehicles[0].z,t.vehicles[0].heading],pose,'the actual5.693mm normal corner step retains the established5cm tolerance');
const before=[t.vehicles[0].x,t.vehicles[0].z];
assert.equal(t.separateVehicleStep(t.vehicles[0],t.vehicles[1],.02),false,'recovery still refuses a worsening translation even within the normal-motion tolerance');
assert.deepEqual([t.vehicles[0].x,t.vehicles[0].z],before);
const arg=process.argv.find(x=>x.startsWith('--strict-source='))?.slice(16);
if(arg) {
    const Strict=(await import(pathToFileURL(path.resolve(arg,'game/src/traffic.js')).href)).Traffic,old=scene();
    Strict.prototype.overlapGuard.call(old);
    assert.notEqual(old.vehicles[0].x,pose[0],'source96 actually reproduces the over-strict normal rollback');
}
console.log('PASS: actual source931 normal tolerance and strict monotonic recovery remain distinct');
