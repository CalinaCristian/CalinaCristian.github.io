import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic} from '../src/traffic.js';
function fixture(other={}) {
    const a={id:0,x:0,z:0,y:0,radius:3,edges:[]},b={id:1,x:200,z:0,y:0,radius:3,edges:[]};
    const e={id:1,a,b,len:200,dirx:1,dirz:0,nx:0,nz:1,lanesF:1,lanesB:1,laneW:3.3,wL:3.5,wR:3.5,halfW:3.5,type:'residential',speed:10};a.edges=[e];b.edges=[e];
    const v={id:1,kind:'sedan',x:40,z:1.65,y:.24,heading:-Math.PI/2,fx:1,fz:0,rx:0,rz:1,edge:e,dir:1,s:40,odo:0,layer:0,length:4.34,width:1.8,speed:4,desiredMul:1,
        route:[],hist:[],lane:0,laneCur:0,latExtraCur:0,lateralExtra:0,latBlend:0,transition:0,laneChangeCd:100,ghost:1,stuck:0,still:0,blockT:0,dwell:0,bubbleCd:100,annoyed:0,honkCd:100,honkAt:12,
        mesh:{position:new THREE.Vector3(40,.24,1.65),rotation:new THREE.Euler(0,-Math.PI/2,0)}};
    const o={id:2,kind:'sedan',x:50,z:1.65,y:.24,heading:-Math.PI/2,fx:1,fz:0,rx:0,rz:1,layer:0,length:4.85,width:1.84,speed:0,leader:null,...other};
    const t=Object.create(Traffic.prototype);Object.assign(t,{world:{},vehicles:[v,o],_frame:1,weatherMul:1,jamMax:0,buc:false,chaos:0,stats:{},player:null,peds:{obstacleGap:()=>Infinity},ensureRoute(){},
        grid:{query(x,z,r,fn){fn(o);}},rng:()=>{throw Error('The focused physical scan must consume no RNG');}});
    return {t,v,o};
}
const {t,v,o}=fixture();t.stepVehicle(v,1/30);
assert.equal(v.leader,o,'a legacy ghost flag cannot blind solid-vehicle following');
assert.ok(v.speed<4,'the actual production control brakes for the stopped body');
const turning=fixture({x:50,z:5,heading:0,fx:1,fz:0,length:12,width:2.55});turning.v.ghost=0;turning.t.stepVehicle(turning.v,1/30);
assert.equal(turning.v.leader,turning.o,'the other turning vehicle uses its rendered longitudinal extent');
const clear=fixture({x:50,z:5,heading:-Math.PI/2,fx:0,fz:1,rx:-1,rz:0,length:12,width:2.55});clear.v.ghost=0;clear.t.stepVehicle(clear.v,1/30);
assert.equal(clear.v.leader,null,'a parallel body outside the lane is not confused with its old road axis');
const crossingWait=fixture({x:43,z:5,heading:0,fx:0,fz:-1,rx:1,rz:0,length:12,width:2.55});
crossingWait.v.speed=0;crossingWait.v.ghost=0;crossingWait.v.stuck=14.1;
crossingWait.t.player={x:10,z:1.65,y:.24,fx:1,fz:0,speed:0,stillT:0,length:5.78,width:1.8};
crossingWait.t.stepVehicle(crossingWait.v,1/30);
assert.equal(crossingWait.v.ghost,0,'a crossing wait cannot switch solid sensing off with a timer');
assert.ok(crossingWait.v.stuck>14.1,'the physical stopped duration is not hidden by resetting its timer');
const arg=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
if(arg){const Base=(await import(pathToFileURL(path.resolve(arg,'game/src/traffic.js')).href)).Traffic,old=fixture();Base.prototype.stepVehicle.call(old.t,old.v,1/30);assert.equal(old.v.leader,null);assert.ok(old.v.speed>4,'the old actual caller reproduces blind acceleration while ghost is set');}

const visible=Object.create(Traffic.prototype),camera=new THREE.PerspectiveCamera(75,16/9,.2,5000);
camera.position.set(0,2.6,0);camera.lookAt(-200,1,0);camera.updateMatrixWorld(true);
Object.assign(visible,{_frame:1,world:{},player:{x:0,z:0,fx:1,fz:0},stats:{}});
const car={id:4,x:-200,z:0,y:.24,length:4.6,width:1.8,still:30,odo:0,mesh:{visible:true,userData:{_model:{radius:2.6}}}};
const previous=globalThis.game;globalThis.game={traffic:visible,camera};
try {
    assert.equal(visible.inView(car),true,'a body in the actual backward-looking camera is protected beyond the heading heuristic');
    visible.vehicles=[car];visible.rng=()=>{throw Error('A visible body must not enter any relocation search');};
    assert.equal(visible.respawn(car),false,'actual respawn refuses a visible source pose before consuming RNG');
    visible.resolveDeadlocks();assert.equal(car.still,30);assert.equal(car.ghost,undefined);assert.equal(visible.stats.deadlockGhosts,undefined);
    camera.lookAt(200,1,0);camera.updateMatrixWorld(true);visible._frame++;
    assert.equal(visible.inView(car),false,'the same body may be considered for recovery when it is genuinely outside all views');
    visible.player.mirrorEnabled=true;visible.player.mirrorCam=camera.clone();visible.player.mirrorCam.lookAt(-200,1,0);visible.player.mirrorCam.updateMatrixWorld(true);visible._frame++;
    assert.equal(visible.inView(car),true,'the actual mirror also protects a visible body');
} finally {if(previous===undefined)delete globalThis.game;else globalThis.game=previous;}
console.log('PASS: actual stepVehicle always sees solid bodies, rendered extents, no RNG and camera/mirror recovery gates');
