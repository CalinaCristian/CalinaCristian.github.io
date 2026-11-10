import assert from 'node:assert/strict';
import {coveredPlatformCanopies} from '../src/covered-platform-canopies.js';
import {BASARAB_PLATFORMS} from '../src/basarab-source.js';
import {buildSpeciesTrees} from '../src/trees.js';
const surveyedRoof={x:744.4,z:-971.2,s:1.4,sh:1.42,species:'oak'},mappedTree={...surveyedRoof,x:744.5},outside={...surveyedRoof,x:600,z:-900};
const trees=[outside,surveyedRoof,mappedTree,{...outside,x:610}],meta=new WeakMap(trees.map((t,i)=>[t,{sourceIndex:i,crownRadiusM:t===mappedTree?0:5}]));
const before=JSON.stringify(trees),result=coveredPlatformCanopies(trees,BASARAB_PLATFORMS,meta);
assert.deepEqual([...result.excluded],[surveyedRoof]);assert.equal(result.conflicts[0].platformSourceId,'w620826243');assert.equal(result.unresolved.length,1,'a mapped/unknown tree is retained instead of silently losing to another source record');assert.equal(JSON.stringify(trees),before,'source positions, crowns and retained dimensions are never edited');
assert.equal(coveredPlatformCanopies(trees,[],meta).excluded.size,0,'other scenes retain their original behavior');
function rng(){let s=19,calls=0;const r=()=>{calls++;return((s=Math.imul(s,1664525)+1013904223>>>0)/2**32);};r.state=()=>({s,calls});return r;}
const a=rng(),b=rng(),baseline=buildSpeciesTrees(trees,{rng:a}),candidate=buildSpeciesTrees(trees,{rng:b,exclude:result.excluded});
assert.deepEqual(a.state(),b.state(),'source exclusions consume the same complete instance RNG stream');assert.equal(candidate.count,baseline.count-1);
function farInstances(model){const map=new Map();for(const m of model.crownMeshes.filter(m=>m.name.endsWith(' far'))){for(let i=0;i<m.count;i++){const matrix=Array.from(m.instanceMatrix.array.subarray(i*16,i*16+16)),colour=Array.from(m.instanceColor.array.subarray(i*3,i*3+3));map.set(matrix[12]+','+matrix[14],{matrix,colour});}}return map;}
const old=farInstances(baseline),current=farInstances(candidate);assert.equal(current.size,trees.length-1);for(const[key,value]of current)assert.deepEqual(value,old.get(key),'every retained actual emitted matrix and colour is identical');assert.equal(JSON.stringify(trees),before);
console.log('Covered-platform canopy source precedence, mapped-tree hold and retained instance/RNG parity pass');
