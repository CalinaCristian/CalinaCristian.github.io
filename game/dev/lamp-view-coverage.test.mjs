import assert from 'node:assert/strict';
import {lampViewCoverage} from '../src/lamp-view-coverage.js';
const angle=20*Math.PI/180,d={x:0,y:-Math.sin(angle),z:-Math.cos(angle)};
assert.deepEqual(lampViewCoverage({x:20,y:1.6,z:40},d),{x:20,z:40,range:150,aerial:false},'ground camera keeps its existing range and origin');
assert.deepEqual(lampViewCoverage({x:20,y:31.6,z:40},d,30),{x:20,z:40,range:150,aerial:false},'driving on an elevated road keeps the same policy');
const air=lampViewCoverage({x:20,y:147,z:40},d),hitZ=40-147/Math.tan(angle);
assert(Math.abs(air.z-hitZ)<1e-8&&air.range===444,'a high drone selects the ground at the view centre');
assert(Math.abs(hitZ-40)>150,'negative control: the old circle excludes that viewed ground');
for(const y of [0,12,12.01,30,45,147,10000])for(const dy of[-1,-.05,0,.8]){const c=lampViewCoverage({x:-10,y,z:70},{x:0,y:dy,z:Math.sqrt(1-dy*dy)});assert(Object.values(c).every(v=>typeof v==='boolean'||Number.isFinite(v)));assert(c.range>=150&&c.range<=600);assert(Math.hypot(c.x+10,c.z-70)<=450+1e-8);}
assert.equal(lampViewCoverage({x:1,y:80,z:2},{x:0,y:-1,z:0}).x,1,'vertical view remains centred under the camera');
console.log('Lamp coverage: ground/elevated-driver controls, high-view negative control and finite horizon bounds pass');
