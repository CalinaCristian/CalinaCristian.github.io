import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Traffic} from '../src/traffic.js';

// Exact native395 van244 source lengths/pose. Other traffic is deliberately
// absent in this isolated controller test; this is not a fresh native drive.
function fixture({planned=1,physical=.994926841964071,turn=true,red=false,bus=false}={}) {
 const a={id:495,x:181.08101024550712,z:-272.11781520011357,y:-.48995285008462885,radius:4,edges:[]};
 const b={id:496,x:189.31666267155583,z:-278.6968296004015,y:0,radius:7.5,hasLight:true,edges:[]};
 const c={id:606,x:186.75693286346342,z:-283.0865436003735,y:0,radius:4,edges:[]};
 const d={id:605,x:185.13524068686414,z:-285.86484360046575,y:0,radius:4,edges:[]};
 function edge(id,a,b,lanes,oneway=true){const len=Math.hypot(b.x-a.x,b.z-a.z),fx=(b.x-a.x)/len,fz=(b.z-a.z)/len,e={id,a,b,len,dirx:fx,dirz:fz,nx:-fz,nz:fx,laneW:3.5,median:oneway?-lanes*3.5:0,lanesF:lanes,lanesB:oneway?0:lanes,oneway,type:'primary',speed:13,road:id===441?114:135};a.edges.push(e);b.edges.push(e);return e;}
 const e=edge(441,a,b,2),one=edge(559,c,b,1,false),two=edge(558,d,c,1,false);
 if(!turn){c.x=b.x+e.dirx*one.len;c.z=b.z+e.dirz*one.len;d.x=c.x+e.dirx*two.len;d.z=c.z+e.dirz*two.len;for(const q of [one,two])Object.assign(q,{dirx:-e.dirx,dirz:-e.dirz,nx:e.dirz,nz:-e.dirx});a.x-=20*e.dirx;a.z-=20*e.dirz;e.len+=20;}
 const v={id:244,kind:'delivery-van',x:187.34143509448919,z:-275.95389795639625,y:.09711012485354381,heading:-.40330598230003206,fx:e.dirx,fz:e.dirz,rx:e.nx,rz:e.nz,speed:0,length:5.93,width:2.02,dir:1,s:7.466712004358849,lane:planned,laneCur:physical,edge:e,route:[{e:one,dir:-1},{e:two,dir:-1}],hist:[],odo:36.37575253061805,stuck:1,still:1,transition:0,latExtraCur:0,lateralExtra:0,latBlend:0,ghost:0,desiredMul:1,laneChangeCd:100,dwell:0,honkAt:12,honkCd:100,bubbleCd:100,annoyed:0,bus,mesh:{position:{set(){}},rotation:{set(){}}}};
 const t=Object.create(Traffic.prototype);Object.assign(t,{world:{},vehicles:[v],_frame:1,buc:true,jamMax:0,weatherMul:1,chaos:0,player:null,stats:{},grid:{query(){}},peds:{obstacleGap:()=>Infinity,crossingAt:()=>false},ensureRoute(){},boxController:n=>n,boxes:new Map(),lightState:()=>red?'red':'green',boxCheck:()=> 'clear',boxClaim(){},busStopAhead:()=>Infinity,rng:()=>{throw Error('No fixture RNG expected');}});
 return {t,v,e,one,two};
}
const basePath=process.argv.find(s=>s.startsWith('--baseline='))?.slice(11);
if(basePath){const Base=(await import(pathToFileURL(path.resolve(basePath,'game/src/traffic.js')))).Traffic,f=fixture();Base.prototype.stepVehicle.call(f.t,f.v,1/30);assert.equal(f.v.stopWhy,'lanedrop');assert.ok(Math.abs(f.v.stopD+.309351489267657)<1e-9,'original full control loop reproduces exact native false stop');}
const f=fixture(),originalRoute=f.v.route.slice(),sourceLengths=[f.e.len,f.one.len,f.two.len];f.t.stepVehicle(f.v,1/30);
assert.equal(f.v.stopWhy,null,'a one-lane source continuation cannot repeat a previously projected two-to-one drop');
assert.equal(f.v.stopD,Infinity);assert.ok(f.v.speed>0,'the unchanged controller may accelerate when no real stop exists');
assert.deepEqual(f.v.route,originalRoute);assert.deepEqual([f.e.len,f.one.len,f.two.len],sourceLengths,'no route/source geometry rewrite');
const real=fixture({turn:false});real.v.s=15;real.t.stepVehicle(real.v,1/30);
assert.equal(real.v.stopWhy,'lanedrop2','a genuine straight two-to-one drop retains the unfinished lateral-body wait');
assert.ok(Number.isFinite(real.v.stopD));
const merged=fixture({turn:false,planned:0,physical:0});merged.v.s=15;merged.t.stepVehicle(merged.v,1/30);assert.equal(merged.v.stopWhy,null,'a completed merge does not wait at the drop');
const blocked=fixture({turn:false});blocked.v.s=15;blocked.t.laneFree=()=>false;blocked.t.stepVehicle(blocked.v,1/30);assert.equal(blocked.v.stopWhy,'lanedrop','a target lane still blocked retains its pre-merge stop');
const red=fixture({turn:false,red:true});red.v.s=15;red.t.stepVehicle(red.v,1/30);assert.equal(red.v.stopWhy,'light');assert.equal(red.v.waitRed,true);assert.equal(red.v.redQ,true,'real red queues are preserved');
const bus=fixture({bus:true});bus.t.stepVehicle(bus.v,1/30);assert.equal(bus.v.stopWhy,null,'native bus rightmost-lane projection also removes repeated drops');
const future=fixture({planned:0});future.one.lanesF=future.one.lanesB=2;future.t.stepVehicle(future.v,1/30);assert.equal(future.v.stopWhy,'lanedrop2','a genuine future two-to-one drop still sees unfinished fractional steering on its two-lane approach');
const T=Traffic.prototype;
// An already admitted bus can have its integer future lane projected back to
// the right edge of a short four-lane shape leg before a two-lane exit. Both
// the integer and fractional tests must let that same movement finish.
for(const entered of [false,true]) {
 const q=fixture({planned:1,physical:1,bus:true,turn:false});q.v.s=q.e.len-8;
 q.one.lanesF=q.one.lanesB=4;q.two.lanesF=q.two.lanesB=2;
 const cl={};q.one.a.lightCluster=cl;q.one.b.lightCluster=cl;
 q.t.boxController=n=>n.lightCluster||n;
 const r={v:q.v,entered,generation:0,inE:q.e,entryRad:7.5,internalEdges:new Set([q.one]),clearOdo:1e6,t0:0};if(entered)q.t.boxes.set(cl,[r]);
 q.t.stepVehicle(q.v,1/30);
 assert.equal(q.v.stopWhy,entered?null:'lanedrop','only an actually entered movement avoids the repeated integer bus-lane stop');
 if(entered)assert.ok(q.v.speed>0,'an admitted bus gets a real forward step for its bounded steering');
}
assert.equal(T.laneDropStop({laneCur:1},1,7,4,1),1.5,'current physical unfinished merge still stops');
assert.equal(T.laneDropStop({laneCur:1},1,7,4,0),Infinity,'future lane projection does not reuse the old fractional index');
assert.equal(T.laneDropStop({laneCur:1},1,-5.420880099136436,4,1),Infinity,'committed body clearance remains unchanged');
console.log('PASS: exact244 legacy false-stop reproduction; projected ordinary/bus lanes; true drop, unfinished/blocked merge, red queue, source/route preservation and committed-body controls');
