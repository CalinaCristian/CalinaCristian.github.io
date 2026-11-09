import assert from 'node:assert/strict';
import {Harness} from './harness/page/core.js';
function setup({lanes=3,red=false,targetStop=false}={}) {
    const end=red?10:100,a={x:0,z:0,radius:0},b={x:end,z:0,radius:red?7.5:0,hasLight:red};
    const edge={a,b,len:end,dirx:1,dirz:0,nx:0,nz:1,laneW:3.3,lanesF:lanes,lanesB:0,oneway:true,speed:14};
    const P={x:targetStop?99.8:0,z:1.65,y:.24,fx:1,fz:0,heading:-Math.PI/2,speed:0,length:5.78,front:3.42,width:1.8};
    const H=Object.create(Harness.prototype);H.g={player:P,traffic:{lightState:()=>red?'red':'green'}};H.scT=0;H.trace=0;H.notes=[];H.issues=[];H.note=x=>H.notes.push(x);H.press=()=>{};H.setControls=(throttle,steer,brake)=>H.ctl={throttle,steer,brake};H.issue=(type,severity)=>H.issues.push({type,severity});
    const route={legs:[{e:edge,dir:1}],points:[[0,0],[end,0]],cum:[0,end],total:end},path=H.buildPath(route,0);
    H.ap={tx:end,tz:1.65,o:{arriveR:targetStop?.1:9,stop:targetStop,speedMul:.7,lane:0,obeyLights:true},route,path,pi:0,s:0,waitT:0,stallT:0,revT:0,resets:0,laneBias:0,offT:0,lastProgressT:0,bestRem:Infinity,rerouteN:0,honkT:0};
    H.resetCar=()=>{H.ap.resets++;};
    // The body sensor itself has separate production-method geometry controls.
    // Keep this real vehicle obstruction fixed to isolate driver intent.
    H.obstacleAhead=()=>({gap:3.381748331859102,speed:.16049526548627369,what:'compact-sedan',info:{id:345}});
    return H;
}
function run(H,seconds){for(let k=0;k<seconds*30;k++){H.scT+=1/30;H.autopilot(1/30);}}
const blocked=setup();run(blocked,8.2);
assert.equal(blocked.ap.laneBias,1,'a genuine stopped vehicle wait enables the existing legal adjacent-lane plan');
assert.equal(blocked.ap.resets,0);assert.ok(blocked.notes.some(s=>s.includes('switching lane')));
const single=setup({lanes:1});run(single,19);
assert.ok(single.issues.some(i=>i.type==='traffic-blockage'&&i.severity==='medium'),'a genuinely blocked single lane still trips its existing18s watchdog');
assert.equal(single.ap.resets,1);
const red=setup({red:true});run(red,9);
assert.equal(red.ap.laneBias,0);assert.equal(red.ap.waitT,0,'an intentional red-light stop never becomes passing intent');
const target=setup({targetStop:true});run(target,9);
assert.equal(target.ap.laneBias,0);assert.equal(target.ap.waitT,0,'an intentional target approach keeps its planned slow stop');
const ped=setup();ped.obstacleAhead=()=>({gap:3.38,speed:0,what:'pedestrian',info:null});run(ped,9);
assert.equal(ped.ap.laneBias,0);assert.equal(ped.ap.waitT,0,'pedestrian handling is unchanged');
console.log('PASS: real blocked vehicle intent, existing passing/watchdog, red/target stop and pedestrian controls');
