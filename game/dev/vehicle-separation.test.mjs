import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Traffic } from '../src/traffic.js';
import { obbPen, vObb } from './harness/page/util.js';
import * as THREE from '../vendor/three.module.min.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-short-edge-pair.json',import.meta.url)));
function vehicle(v) {return {id:0,x:0,z:0,y:.24,heading:-Math.PI/2,length:4,width:1.8,s:10,odo:0,speed:0,layer:0,ghost:0,
    edge:{len:40},...v,mesh:{position:new THREE.Vector3(v.x??0,v.y??.24,v.z??0),rotation:new THREE.Euler(0,v.heading??-Math.PI/2,0)}};}
function traffic(vehicles) {
    const t=Object.create(Traffic.prototype);t.vehicles=vehicles;t._frame=1;t._dt=1/30;t.stats={};t.world={};
    t.grid={query(x,z,r,fn){for(const v of vehicles)if(Math.hypot(v.x-x,v.z-z)<r+v.length/2)fn(v);}};
    return t;
}
const penetration=(a,b)=>obbPen(vObb(a),vObb(b));
const actual=traffic(fixture.vehicles.map(vehicle)),old=penetration(...actual.vehicles);
const baselineArg=process.argv.find(s=>s.startsWith('--baseline='))?.slice(11);
if(baselineArg) {
    const Base=(await import(pathToFileURL(path.resolve(baselineArg,'game/src/traffic.js')).href)).Traffic;
    const previous=traffic(fixture.vehicles.map(vehicle));
    Base.prototype.overlapGuard.call(previous);
    const worse=penetration(...previous.vehicles);
    assert.ok(worse>old+.1,'the old production guard reproduces the native worsening forward correction');
    console.log(JSON.stringify({nativeShortEdgeBaselinePenetration:old,previousGuardAfter:worse}));
}
actual.overlapGuard();
assert.ok(penetration(...actual.vehicles)<=old+1e-9,'the actual short-edge recovery must not increase rendered-body penetration');
assert.equal(actual.vehicles.length,2);assert.deepEqual(actual.vehicles.map(v=>v.id),[148,461]);

const rear=vehicle({id:1}),front=vehicle({id:2,x:3.8,s:15}),back=traffic([rear,front]);
const p0=penetration(rear,front);back.overlapGuard();
assert.ok(penetration(rear,front)<p0,'a real back-out step keeps separating');
assert.ok(Math.hypot(rear.x,rear.z)<=.8/30+1e-9,'visible recovery remains a bounded physical step');
assert.ok(rear.x<0);assert.equal(rear.speed,0);

const trapped=vehicle({id:1}),ahead=vehicle({id:2,x:3.8,s:15}),third=vehicle({id:3,x:-4,s:5});
const blocked=traffic([trapped,ahead,third]);
assert.equal(blocked.separateVehicleStep(trapped,ahead,-.02),false,'separating from one car cannot introduce a new third-body contact');
assert.equal(trapped.x,0);
third.y=8;
assert.equal(blocked.separateVehicleStep(trapped,ahead,-.02),true,'a real other-level body does not block the separating step');

const turn=vehicle({id:1,fx:0,fz:-1}),other=vehicle({id:2,x:3.8}),turning=traffic([turn,other]);
assert.equal(turning.separateVehicleStep(turn,other,-.02),true,'a turning rendered heading determines outward motion, not the source axis');
assert.ok(turn.x<0);assert.ok(Math.abs(turn.z)<1e-12);
assert.equal(turning.separateVehicleStep(turn,other,.02),false,'a worsening forward correction is refused');

const nearPed=vehicle({id:1}),pedCar=vehicle({id:2,x:3.8}),pedTraffic=traffic([nearPed,pedCar]);
pedTraffic.peds={grid:{query(x,z,r,fn){fn({x:-2.31,z:0});}}};
assert.equal(pedTraffic.separateVehicleStep(nearPed,pedCar,-.02),false,'a correction cannot enter a pedestrian body');
pedTraffic.peds=null;pedTraffic.player={x:-4.21,z:0,y:.24,fx:1,fz:0,length:4.4,width:1.8};
assert.equal(pedTraffic.separateVehicleStep(nearPed,pedCar,-.02),false,'a correction cannot enter the player body');

// Repeated yield/ghost timers cannot turn an existing solid car passable.
const moving=vehicle({id:1,x:0,ghost:4}),solid=vehicle({id:2,x:4.1,parked:true});
const guarded=traffic([moving,solid]);
for(let i=0;i<70;i++) {
    moving._f=guarded._frame; moving._x0=-.2;moving._z0=0;moving._h0=-Math.PI/2;
    moving._e0=moving.edge;moving._d0=1;moving._ln0=0;moving._ly0=0;moving._y0=.24;
    moving._s0=10;moving._odo0=0; moving.x=.2;moving.z=0;moving.s=10.4;moving.heading=-Math.PI/2;
    guarded.overlapGuard();
    assert.equal(moving.x,-.2,'even an actor carrying a legacy ghost flag cannot step into the solid car');
    assert.ok(penetration(moving,solid)<=0);
}
assert.equal(guarded.stats.revGhost,undefined,'waiting never forces ghost passage');
console.log('PASS: actual short-edge body, back-out, new third contact, turn, pedestrian/player, height and timed-ghost controls');
