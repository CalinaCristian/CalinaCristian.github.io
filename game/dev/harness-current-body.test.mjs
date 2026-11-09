import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Harness} from './harness/page/core.js';
import {Player} from '../src/player.js';
import {makeVehicle} from '../src/vehicles.js';
const F=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-harness-214.json',import.meta.url)));
const baselineArg=process.argv.find(s=>s.startsWith('--baseline='));
const Old=baselineArg?(await import(pathToFileURL(baselineArg.slice(11)+'/game/dev/harness/page/core.js'))).Harness:null;
const cumulative=pts=>{const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return cum;};
function setup(player,actors,pts,Impl=Harness){
 const H=Object.create(Impl.prototype),P={...player,length:player.front+player.rear},cum=cumulative(pts),path={pts,cum,total:cum.at(-1),legOf:pts.slice(1).map((_,i)=>({e:{name:'fixture route',speed:50/3.6,lanesF:i<3?4:3,oneway:true,b:{hasLight:false}},dir:1}))};
 H.g={player:P,traffic:{near:()=>actors,nearPeds:()=>[]}};H.scT=0;H.trace=0;H.note=()=>{};H.issue=()=>{};H.press=()=>{};H.resetCar=()=>{throw Error('Focused caller fixture must not reset');};H.setControls=(throttle,steer,brake)=>{H.ctl={throttle,steer,brake};};
 H.ap={tx:pts.at(-1)[0],tz:pts.at(-1)[1],path,pi:1,s:0,o:{arriveR:9,stop:false,speedMul:.7,lane:0,obeyLights:true},waitT:0,stallT:0,revT:0,resets:0,laneBias:0,offT:0,lastProgressT:0,bestRem:Infinity,honkT:0};return H;
}
for(const sample of F.samples){
 const truck={...sample.truck,mesh:makeVehicle('truck','#ffffff',{instanced:true})},H=setup(sample.player,[truck],F.reconstructedPath.points);H.scT=sample.t;
 assert.equal(Player.prototype.satVehicle.call(H.g.player,truck),null,'recorded approach sample is physically clear before the first contact');
 H.autopilot(1/30);assert.equal(H.ctl.brake,true,'actual214 current-body corridor starts braking before contact');assert.ok(H.ap.leaderInfo.bodyCorridor);
 if(Old){const before=setup(sample.player,[truck],F.reconstructedPath.points,Old);before.scT=sample.t;before.autopilot(1/30);assert.equal(before.ctl.brake,false);assert.equal(before.ctl.throttle,1,'exact old caller still accelerates toward recorded214 on the tightly reconstructed target-lane path');}
}
assert.ok(Math.abs(Player.prototype.satVehicle.call({...F.firstPreSolveContact.player,length:F.firstPreSolveContact.player.front+F.firstPreSolveContact.player.rear},F.firstPreSolveContact.truck).pen-F.firstPreSolveContact.expectedNativeSATPenetration)<1e-10,'native SAT reproduces the actual first pre-solve contact positive');
const occupied=setup(F.firstPreSolveContact.player,[F.firstPreSolveContact.truck],F.reconstructedPath.points);assert.equal(occupied.obstacleAhead(occupied.ap.path,50.94151062638489,55).gap,0,'the actual asymmetric body is sensed even when the target path excludes its existing contact');
const base={x:0,z:0,y:.24,heading:-Math.PI/2,fx:1,fz:0,speed:4,steer:0,front:3.42,rear:2.36,width:1.8};
const straight=[[0,3.5],[100,3.5]],actor=(x,z,heading=-Math.PI/2)=>({id:1,kind:'car',x,z,y:.24,heading,fx:1,fz:0,length:4.4,width:1.8,speed:0});
assert.equal(setup(base,[actor(8,-3.5)],straight).obstacleAhead({pts:straight,cum:[0,100]},0,30,.5).gap,Infinity,'clear adjacent lane stays clear during steering');
assert.equal(setup(base,[actor(-8,0)],straight).obstacleAhead({pts:straight,cum:[0,100]},0,30,.5).gap,Infinity,'body entirely behind cannot produce a forward stop');
const turning=actor(5,2,0);turning.length=5.5;assert.ok(Number.isFinite(setup(base,[turning],straight).obstacleAhead({pts:straight,cum:[0,100]},0,30,0).gap),'rendered perpendicular body is sensed despite a different road direction');
// A transformed known-height model must use emitted roof vertices, not the
// metadata height or a fixed difference between two road-surface heights.
const upper={...base,y:3.4,speed:0},rig=new THREE.Group(),cockpit=new THREE.Group();rig.add(cockpit);const roof=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.8,5.78));roof.position.y=.9;cockpit.add(roof);upper.rig=rig;upper.cockpit=cockpit;
const bus={...actor(8,0),kind:'bus',length:12,width:2.55,mesh:makeVehicle('bus','#ffffff',{instanced:true})};
const levelPath={pts:[[0,0],[40,0]],cum:[0,40]};
const height=setup(upper,[bus],levelPath.pts);height.ap.pi=0;assert.ok(Number.isFinite(height.obstacleAhead(levelPath,0,30).gap),'actual emitted bus roof can intersect a body more than3m above its surface');height.g.player.y=4.5;assert.equal(height.obstacleAhead(levelPath,0,30).gap,Infinity,'truly separate emitted vertical intervals do not stop each other');
// Actual native kinematics/SAT on a planar controlled lane-change course.
// This is a bounded CPU progress control, not a full-world native route claim.
const truck={...actor(22,0),id:214,kind:'truck',length:8.9,width:2.45},H=setup(base,[truck],straight),{fx,fz,...state}=H.g.player,P=Object.assign(Object.create(Player.prototype),state);
Object.assign(P,{maxSpeed:36,steerVisual:0,collisionCd:0,shake:0,bob:0,contactAge:9,followSurface(){},collidePeds(){},updateRig(){}});H.g.player=P;H.ap.pi=0;let contacts=0,minimum=Infinity;
P.collide=function(){const hit=this.satVehicle(truck);if(hit)contacts++;minimum=Math.min(minimum,Math.hypot(this.x-truck.x,this.z-truck.z));};
for(let i=0;i<600&&!H.ap.done;i++){H.scT+=1/30;H.autopilot(1/30);P.update(1/30,H.ctl,{grip:1});}
assert.equal(contacts,0,'a physically clear curved lane change keeps zero native body contacts');assert.ok(P.x>35&&P.z>2.7,'supplemental sensing allows real forward and lateral progress, rather than permanent braking');assert.equal(H.ap.resets,0);
console.log('PASS: exact214 pre-contact braking/old acceleration, actual SAT positive, rendered orientation, adjacent/behind/emitted-height negatives, native curved lane-change progress');
