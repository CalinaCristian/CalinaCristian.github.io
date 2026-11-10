import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedPointHeight } from '../src/point-height-cache.js';

test('exact height and null queries survive collisions, revisits and adjacent doubles',()=>{
 let calls=0;
 const source=(x,z)=>{calls++;return x+z>0?Math.sin(x)+z:null},cached=cachedPointHeight(source,4);
 for(let i=0;i<10000;i++){
  const x=(i%113-56)*.3000000000001,z=(i%71-35)*.7;
  const expected=x+z>0?Math.sin(x)+z:null;
  assert.equal(cached(x,z),expected);const before=calls;assert.equal(cached(x,z),expected);assert.equal(calls,before);
 }
 const fine=cachedPointHeight(x=>x,1);
 assert.equal(fine(1,0),1);assert.equal(fine(1+Number.EPSILON,0),1+Number.EPSILON);assert.equal(fine(1,0),1);
});
