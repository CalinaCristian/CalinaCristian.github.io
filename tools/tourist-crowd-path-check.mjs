// Physical public-walk regression: moving bodies stay present and block routes,
// while a read-only navigation overlay preserves native static-index queries.
import assert from 'node:assert/strict';
import {withMovingBodies,findWalkPath,walkSegment,pathLength} from '../game/src/spots/tour.js';
import {colliderIndex,collide} from '../game/src/spots/walker.js';
const ground={heightAt:()=>0,groundAt:()=>0},ped={},guide={};
const wall={x:8,z:6,hw:1,hd:2,r:3},source=colliderIndex([wall]);
const bodies=Array.from({length:9},(_,i)=>({x:4,z:i*.48-1.92,fx:0,fz:1,width:.5,length:.34,y:0,ped:i?{}:ped}));
bodies.push({x:0,z:0,fx:0,fz:1,width:.5,length:.34,y:0,ped:guide});
const original=JSON.stringify(bodies),nav=withMovingBodies(source,bodies,guide);
assert.equal(walkSegment(ground,source,[0,0],[10,0]),true);
assert.equal(walkSegment(ground,nav,[0,0],[10,0]),false);
const path=findWalkPath(ground,nav,0,0,10,0,{maxLength:25});
assert.ok(path&&pathLength(path)>10);
assert.ok(path.slice(1).every((p,i)=>walkSegment(ground,nav,path[i],p)));
assert.equal(JSON.stringify(bodies),original,'navigation mutated actual crowd bodies');
assert.equal(bodies.length,10,'navigation removed people');
for(let i=0;i<20;i++){
  assert.ok(collide(source,8,6,.3,0),'native wall vanished after overlay queries');
  assert.ok(collide(nav,8,6,.3,0),'overlay wall vanished after native queries');
}
const high=withMovingBodies([], [{x:4,z:0,fx:0,fz:1,width:1,length:1,y:5,ped}]);
assert.equal(walkSegment(ground,high,[0,0],[10,0]),true,'person on elevated deck blocked lower ground');
const ignored=withMovingBodies(source,[bodies.at(-1)],guide);
assert.equal(ignored,source,'guide should not block its own starting point');
assert.equal(findWalkPath(ground,nav,0,0,10,0,{maxLength:10}),null,'crowd detour escaped short-walk budget');
const moved=withMovingBodies(source,bodies.map(b=>({...b,z:b.z+20})),guide);
assert.equal(walkSegment(ground,moved,[0,0],[10,0]),true,'moved crowd left stale blocking geometry');
console.log(JSON.stringify({passed:true,crowdBodies:bodies.length,routeMetres:pathLength(path),checks:30}));
