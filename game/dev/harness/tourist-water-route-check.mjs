import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shortWaterRoute, dryLanding } from '../../src/spots/water-route.js';
import { inPoly, distPolyline, polylineLength } from '../../src/spots/kit.js';
const verify = (poly, route, avoid = () => false) => {
 assert.ok(route && polylineLength(route) >= 20);
 assert.deepEqual(route[0], route.at(-1));
 for(let i=1;i<route.length;i++) for(let t=0;t<=1;t+=.1){const a=route[i-1],b=route[i],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert.ok(inPoly(x,z,poly));assert.ok(distPolyline(x,z,[...poly,poly[0]]).d>=1.099);assert.ok(!avoid(x,z));}
};
const bay = [[0,0],[60,0],[60,20],[20,20],[20,60],[0,60]];
verify(bay, shortWaterRoute(bay,{x:1,z:1}));
assert.equal(shortWaterRoute([[0,0],[1,0],[1,1],[0,1]],{x:0,z:0}),null);
const barrier=(x,z)=>x>10&&x<14;
verify(bay,shortWaterRoute(bay,{x:2,z:2},{avoid:barrier}),barrier);
const d=JSON.parse(fs.readFileSync(new URL('../../data/spots/cismigiu.json',import.meta.url))),lake=d.areas.find(a=>a.id==='w16292044').poly,landing=d.pois.find(p=>p.id==='n473428602');
const bridges=d.ways.filter(w=>w.bridge&&w.bridge!=='no'),avoid=(x,z)=>bridges.some(w=>distPolyline(x,z,w.pts).d<4),route=shortWaterRoute(lake,landing,{avoid});
verify(lake,route,avoid);assert.equal(polylineLength(route),48);
const dry=dryLanding(lake,landing);assert.ok(!inPoly(dry.x,dry.z,lake));assert.ok(Math.hypot(dry.x-landing.x,dry.z-landing.z)<7);
assert.deepEqual(landing,{id:'n473428602',x:-10.2,z:97.7,name:'Debarcader',tourism:'attraction'});
console.log('Water courses: concave banks, bridge exclusion, too-small water, real 48 m Debarcader return, dry shore, source preservation passed.');
