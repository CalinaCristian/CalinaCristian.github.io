// CPU-only source-method controls. No live world, browser, planner or patch.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [root,input,out,oldRoot]=process.argv.slice(2),F=JSON.parse(fs.readFileSync(input));
const {Harness}=await import(pathToFileURL(root+'/game/dev/harness/page/core.js'));
const {Player}=await import(pathToFileURL(root+'/game/src/player.js'));
const {makeVehicle}=await import(pathToFileURL(root+'/game/src/vehicles.js'));
const V={...F.vehicle2,mesh:makeVehicle(F.vehicle2.kind,'#ffffff',{instanced:true})};
const path={pts:F.path.pts,cum:F.path.cum,total:F.path.total,legOf:F.path.legs.map(l=>({e:l.edge,dir:l.dir}))};
function setup(){const H=Object.create(Harness.prototype),a=F.beforeResetStep.caller.ap,P={...F.beforeResetStep.player};P.length=P.front+P.rear;
 H.g={player:P,traffic:{near:()=>[V],nearPeds:()=>[],lightState:()=> 'green'}};H.ap={...a,o:{...a.options},path};H.scT=F.actualReset.caller.scenarioTime;H.trace=0;H.ctl={...F.beforeResetStep.caller.controls};H.note=()=>{};H.press=()=>{};H.issue=()=>{};H.resetCar=()=>{};H.setControls=(throttle,steer,brake)=>{H.ctl={throttle,steer,brake};};return H;}
const H=setup(),original=H.obstacleAhead.bind(H);let exact;
H.obstacleAhead=function(...args){const result=original(...args);exact={s:args[1],look:args[2],steering:args[3],result};return result;};H.autopilot(1/30);
assert.equal(exact.result.info.id,2);assert.equal(exact.result.info.bodyCorridor,true);
assert.ok(Math.abs(exact.result.gap-F.actualReset.caller.ap.gap)<1e-9,'isolated native source reproduces recorded current-body gap exactly');
let oldPathOnly=null;if(oldRoot){const {Harness:Old}=await import(pathToFileURL(oldRoot+'/game/dev/harness/page/core.js'));oldPathOnly=Old.prototype.obstacleAhead.call(setup(),path,exact.s,exact.look);}
const displaced={...path,pts:path.pts.map(([x,z])=>[x+100,z])};
const steeringControls=[-1,-.1,0,exact.steering,1].map(steering=>{const h=setup();return {steering,unchangedRecordedTargetPath:h.obstacleAhead(path,exact.s,55,steering),isolatedBodyOnly:h.obstacleAhead(displaced,exact.s,55,steering)};});
function travel(control,actors=[V]){const s=setup().g.player,{fx,fz,touching,...state}=s,P=Object.assign(Object.create(Player.prototype),state);Object.assign(P,{maxSpeed:36,steerVisual:0,collisionCd:0,shake:0,bob:0,followSurface(){},collidePeds(){},updateRig(){}});let contacts=0,maxPen=0,distance=0,steps=0;const hitIds=new Set();P.collide=function(){for(const actor of actors){const hit=this.satVehicle(actor);if(hit){contacts++;maxPen=Math.max(maxPen,hit.pen);hitIds.add(actor.id);}}};const start={x:P.x,z:P.z};for(;steps<300&&distance<8;steps++){const x=P.x,z=P.z;P.update(1/30,{throttle:1,steer:control,brake:false},{grip:1});distance+=Math.hypot(P.x-x,P.z-z);}return{steering:control,steps,simSeconds:steps/30,distance,contacts,maxPen,hitIds:[...hitIds],testedVehicleBodies:actors.length,from:start,to:{x:P.x,z:P.z,heading:P.heading,speed:P.speed},scope:'Actual native Player.update/SAT on a planar CPU course with directly recorded vehicle bodies held fixed. All tested heights are conservatively retained in XY. Static geometry, pedestrians and native NPC evolution are not simulated; this is not route acceptance.'};}
const motion=[0,-.1,exact.steering,1].map(control=>travel(control));
assert.ok(motion.find(x=>x.steering===exact.steering).contacts>0,'following the recorded steering into hatch2 is a real body-path obstruction');
assert.ok(motion.some(x=>x.contacts===0&&x.distance>=8),'a different physically reachable isolated steering course genuinely progresses without contact');
const frozenBodyControls=[-.1,1].map(steering=>travel(steering,F.exactFrozenVehicleBodies));
const result={sourceCommit:F.sourceCommit,inputSha256:createHash('sha256').update(fs.readFileSync(input)).digest('hex'),nativeCallerExact:exact,recordedCaller:F.actualReset.caller,oldPathOnly,steeringControls,motion,frozenBodyControls,passed:true,scope:'Exact native sensor gap on directly recorded AP/path/player/NPC2 state. Steering and fixed-obstacle controls are CPU counterfactuals, not a production recommendation or full-world clear-route proof. Actual native AP records emitted vertex Y; isolated same-grade source controls use recorded dimensions with missing cockpit geometry conservatively retained.'};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({exact,oldPathOnly,motion,frozenBodyControls},null,2));
