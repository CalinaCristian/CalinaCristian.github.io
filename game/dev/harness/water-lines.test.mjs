import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uncoveredWaterLine } from '../../src/water-lines.js';
import { readDistrictData } from '../../../tools/osm/district-data.mjs';
const rectangle = (x0,z0,x1,z1) => [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const area = (outer,holes=[]) => ({outer,holes,sourceId:'fixture'});
let result=uncoveredWaterLine([0,5],[10,5],[]);assert.equal(result.outside[0].length,10);
result=uncoveredWaterLine([0,5],[10,5],[area(rectangle(3,0,7,10))]);assert.deepEqual(result.outside.map(s=>[s.a,s.b]),[[[0,5],[3,5]],[[7,5],[10,5]]]);assert.ok(Math.abs(result.coveredLength-4)<1e-9);
result=uncoveredWaterLine([0,5],[10,5],[area(rectangle(0,0,10,10),[rectangle(4,4,6,6)])]);assert.deepEqual(result.outside.map(s=>[s.a,s.b]),[[[4,5],[6,5]]]);
result=uncoveredWaterLine([0,0],[10,0],[area(rectangle(0,0,5,5)),area(rectangle(5,0,10,5))]);assert.equal(result.outside.length,0);assert.equal(result.coveredLength,10);
result=uncoveredWaterLine([0,0],[0,0],[area(rectangle(-1,-1,1,1))]);assert.deepEqual(result.outside,[]);
const d=readDistrictData(new URL('../../data/seattle-bellevue.bin.gz',import.meta.url)),decode=ring=>{let x=0,z=0;const out=[];for(let i=0;i<ring.length;i+=2){x+=ring[i];z+=ring[i+1];out.push([x/10,z/10]);}return out;};
const waters=d.areas.flatMap((a,i)=>d.areaKinds[a[0]]==='water'?[{outer:decode(a[2]),holes:a.slice(3).map(decode),sourceId:d.areaSourceIds[i]}]:[]);
for(const l of d.lines.slice(0,5)){const pts=decode(l[3]);for(let i=1;i<pts.length;i++){const r=uncoveredWaterLine(pts[i-1],pts[i],waters);assert.equal(r.outside.length,0,'mapped canal must not acquire a 30m fallback river ribbon');}}
console.log('Unmapped stubs, exact boundary crossings, holes, adjacent areas, collinear banks, zero-length and actual Bellevue canal controls passed.');
