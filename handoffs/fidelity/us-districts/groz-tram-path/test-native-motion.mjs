// Isolated CPU execution of actual Traffic methods. No native-world/static or
// browser acceptance claim: this fixture explicitly has no other bodies/props.
import assert from 'node:assert/strict';import * as THREE from '../../../../game/vendor/three.module.min.js';
import { Traffic } from '../../../../game/src/traffic.js';import { buildTramNetwork } from '../../../../game/src/tram-path.js';import { makeRng } from '../../../../game/src/util.js';import { SharedLaneGate } from '../../../../game/src/shared-lanes.js';
const data={q:10,trams:[[0,0,500,0,500,0]],tramSources:[{sourceId:'w1',nodeIds:[101,102,103]}],tramSourceWays:[{sourceId:'w1',nodeIds:[101,102,103],points:[0,0,500,0,500,0],tags:{railway:'tram',oneway:'yes'}}],tramRoutes:[],tramSourceNodeTags:{102:{railway:'tram_stop',public_transport:'stop_position',name:'Fixture source stop'}}};
const network=buildTramNetwork(data),T=Object.create(Traffic.prototype),grid={items:[],build(a){this.items=a;},query(_x,_z,_r,fn){for(const v of this.items)fn(v);}};
Object.assign(T,{world:{data,graph:{nodes:[],edges:[]},buildings:[],district:{inside:(x,z)=>x>=0&&x<=100&&Math.abs(z)<=10}},city:{id:'bucharest'},buc:true,chaos:1,rng:makeRng(99),vehicles:[],pool:[],group:new THREE.Group(),grid,police:[],stats:{},_idSeq:0,boxes:new Map(),sharedLanes:new SharedLaneGate([],[]),tramNetwork:network,tramMotorCrossings:new Set(),_frame:0,_dt:1/30,peds:{obstacleGap:()=>Infinity,crossingAt:()=>false,grid:{query(){}}},player:{x:50,z:100,y:.24,fx:0,fz:-1,heading:0,speed:0,width:1.8,length:5.78,front:3.42,rear:2.36,stillT:0}});
const v=T.spawn({edge:network.edges[0],dir:1,lane:0,s:25,kind:'tram-v3a'});grid.build(T.vehicles);v.nextStopOdo=900;const initial=v.x;let firstSpeed,stopSamples=0,firstDwell=null,lastDwell=null,resumed=false,maxFront=0,sourceError=0;
for(let i=0;i<1200;i++){
    T.onHonk=()=>{};T.onSay=()=>{};T._frame++;T.time=i/30;T.stepVehicle(v,1/30);if(i===0)firstSpeed=v.speed;
    if(v.dwell>0){stopSamples++;firstDwell??=i/30;lastDwell=i/30;assert(Math.abs(v.x-50)<.7);}
    if(v.servedRailStop===102&&v.x>55)resumed=true;
    maxFront=Math.max(maxFront,v.x+v.length/2);sourceError=Math.max(sourceError,Math.abs(v.z));assert(T.railBodyInside(v));
}
assert.equal(firstSpeed,.04);assert(v.x>initial+50);assert(stopSamples>=149);assert(resumed);assert(maxFront<=100);assert.equal(sourceError,0);assert.equal(v.edge.sourceId,'w1');assert.equal(v.stopWhy,'rail-source-boundary');
const oldAcceleration=1.2/30,oldCutoffResult=oldAcceleration<.05?0:oldAcceleration;assert.equal(oldCutoffResult,0);
console.log(JSON.stringify({passed:true,firstActualNativeSpeed:firstSpeed,source8ccOldCutoffResult:oldCutoffResult,sourceStopNode:102,firstDwell,lastDwell,stopSamples,resumedAfterMappedStop:resumed,finalSourceStationX:v.x,maxFront,sourceLateralError:sourceError,sourceBoundaryStop:v.stopWhy,browserOpened:false,scope:'Actual Traffic step/place/advance/native model in isolated CPU source fixture, empty static/peer sets. Full-world native publication/static/controller gates remain pending.'},null,2));
