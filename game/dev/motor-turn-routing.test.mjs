import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Navigator} from '../src/nav.js';
import {Traffic} from '../src/traffic.js';
import {buildMotorTurnRestrictions} from '../src/motor-turn-restrictions.js';
const node=(sourceId,x,z)=>({sourceId,id:sourceId,x,z,radius:3,edges:[]});
function edge(id,a,b,sourceId,{oneway=true}={}){const len=Math.hypot(b.x-a.x,b.z-a.z),e={id,a,b,len,dirx:(b.x-a.x)/len,dirz:(b.z-a.z)/len,oneway,lanesF:1,lanesB:oneway?0:1,type:'primary',maxspeed:10,speed:10,access:{sourceId},name:''};e.nx=-e.dirz;e.nz=e.dirx;a.edges.push(e);b.edges.push(e);return e;}
function fixture(restrictions=true){
 const S=node(1,-20,0),A=node(10,-10,0),V=node(20,0,0),G=node(30,20,0),D=node(40,-10,10),B=node(50,0,-20);
 const se=edge(0,S,A,'w9'),cheap=edge(1,A,V,'w1'),goal=edge(2,V,G,'w3'),d1=edge(3,A,D,'w4'),d2=edge(4,D,V,'w4'),required=edge(5,V,B,'w2');
 const rel={sourceId:'r100',tags:{type:'restriction',restriction:'only_straight_on'},members:[{type:'way',ref:1,role:'from'},{type:'node',ref:20,role:'via'},{type:'way',ref:2,role:'to'}]};
 const world={graph:{nodes:[S,A,V,G,D,B],edges:[se,cheap,goal,d1,d2,required]},data:{roadRestrictions:restrictions?[rel]:[]}};
 return{world,nav:new Navigator(world),se,cheap,goal,d1,d2,required,A,V};
}
const ids=r=>r?.legs.map(l=>l.e.access.sourceId),same=r=>JSON.stringify({points:r.points,legs:r.legs.map(l=>[l.e.id,l.dir])});
const f=fixture(),route=f.nav.compute(-18,0,18,0,-Math.PI/2);
assert(route);assert(ids(route).includes('w4'),'a second incoming-edge state survives after a cheaper forbidden arrival');assert(!ids(route).includes('w1'),'GPS avoids the forbidden incoming approach to its final partial target edge');
const old=fixture(false),oldRoute=old.nav.compute(-18,0,18,0,-Math.PI/2);assert(ids(oldRoute).includes('w1'),'no catalogue preserves legacy direct approach');
f.nav.walking=true;assert(ids(f.nav.compute(-18,0,18,0)).includes('w1'),'walking keeps its independent legacy routing');f.nav.walking=false;
const end=f.nav.compute(-18,0,0,0,-Math.PI/2);assert(end&&end.points.at(-1)[0]===0,'ending at the via node does not require an imaginary prohibited exit');
assert(f.nav.compute(-18,0,-12,0),'same-edge direct motor travel remains available');
const irrelevant=fixture();irrelevant.world.data.roadRestrictions[0].members[1].ref=999;const otherNav=new Navigator(irrelevant.world),unrelated=otherNav.compute(-18,0,18,0,-Math.PI/2);assert.equal(same(unrelated),same(oldRoute),'unrelated literal via ID does not change this route');
const busOnly=fixture();delete busOnly.world.data.roadRestrictions[0].tags.restriction;busOnly.world.data.roadRestrictions[0].tags['restriction:bus']='only_straight_on';const busNav=new Navigator(busOnly.world);assert.equal(same(busNav.compute(-18,0,18,0,-Math.PI/2)),same(oldRoute),'a bus-only catalogue leaves private-car routing on the legacy algorithm');
// Dead-end required edge is bidirectional: expanded edge states must not turn a
// restriction into a short backtrack at an ordinary source shape node.
f.required.oneway=false;f.required.lanesB=1;const noWiggle=f.nav.compute(-18,0,18,0,-Math.PI/2);assert(ids(noWiggle).includes('w4'));for(let i=1;i<noWiggle.legs.length;i++)assert(!(noWiggle.legs[i].e===noWiggle.legs[i-1].e&&noWiggle.legs[i].dir===-noWiggle.legs[i-1].dir),'no new unsigned immediate reversal');
// NPC continuation consumes exactly the existing weighted draw and never
// changes source lanes/geometry or uses the old reversal fallback to evade it.
const t=Object.create(Traffic.prototype);let draws=0;Object.assign(t,{motorTurnRestrictions:buildMotorTurnRestrictions(f.world.data,f.world.graph.edges),turnLaneRules:new Map(),rng:()=>{draws++;return .5;},world:f.world,vehicles:[],buc:false});
const v={id:7,kind:'sedan',edge:f.cheap,dir:1,lane:0,laneCur:0,s:1,length:4.4,route:[],long:false};
const next=t.chooseNext(v.edge,v.dir,v);assert.equal(next.e,f.required);assert.equal(draws,1,'pure source filtering adds no random draws');
v.route=[{e:f.goal,dir:1}];const before=JSON.stringify({id:v.id,lane:v.lane,s:v.s});t.vehicles=[v];const audit=t.auditMotorRouteTurns();assert.equal(audit.passed,false);assert.equal(audit.invalid.length,1);assert.equal(audit.rngDraws,0);assert.equal(JSON.stringify({id:v.id,lane:v.lane,s:v.s}),before,'constructor audit does not hide/warp actors');
v.s=9;assert.equal(t.auditMotorRouteTurns().invalid[0].bodyPadMayInfluencePose,true,'an invalid nearby turn exposes possible body/pad influence before publication');v.s=1;
t.ensureRoute(v);assert.equal(v.route[0].e,f.required,'invalid planned suffix is replaced before motion');assert.equal(v.id,7);
const blocked=fixture();blocked.V.edges=blocked.V.edges.filter(e=>e!==blocked.required);const stop=Object.create(Traffic.prototype);Object.assign(stop,{motorTurnRestrictions:buildMotorTurnRestrictions(blocked.world.data,blocked.world.graph.edges),turnLaneRules:new Map(),rng:()=>{throw Error('No legal candidate must not draw RNG');}});assert.equal(stop.chooseNext(blocked.cheap,1,{kind:'sedan',long:false}),null,'an absent required only exit cannot fall back to a prohibited U-turn');
const clear=fixture(false),a=Object.create(Traffic.prototype);Object.assign(a,{vehicles:[{...v,route:[]}],motorTurnRestrictions:buildMotorTurnRestrictions(clear.world.data,clear.world.graph.edges)});const clean=a.auditMotorRouteTurns();assert(clean.passed&&clean.transitions===0,'ordinary constructor empty routes are explicitly scoped, not invented turns');
const baseline=process.argv.find(s=>s.startsWith('--baseline='))?.slice(11);
if(baseline){const Base=(await import(pathToFileURL(path.resolve(baseline,'game/src/traffic.js')))).Traffic;for(const name of ['spawnAll','spawn']){assert.equal(Traffic.prototype[name].toString(),Base.prototype[name].toString(),name+' fleet-generation method is byte-identical to the frozen native source');assert(!/ensureRoute|chooseNext/.test(Traffic.prototype[name].toString()),'ordinary construction performs no new route-choice RNG');}}
console.log('PASS incoming-edge A*, final partial/via endpoint, same-edge/walking/legacy, no backtrack shortcut, NPC choice/fallback/suffix and constructor audit controls');
