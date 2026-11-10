import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{CITIES}from'../src/cities.js';import{LANDMARKS}from'../src/landmarks.js';import{distanceToDistrictCore,districtLandmarkCoverage}from'../src/landmark-visibility.js';
test('range context follows the stored allowed area and does not fabricate line of sight',()=>{
 const data={proj:{lat0:0,lon0:0,mPerLat:1,mPerLon:1,scale:1},district:{geometry:{pieces:[{pts:[[0,0],[10,0]],r:2}],circles:[{x:20,z:0,r:3}],polys:[]}}};
 assert.equal(distanceToDistrictCore(5,0,data),0);assert.equal(distanceToDistrictCore(20,0,data),0);
 const landmarks=[0,100,2000,6000].map((z,i)=>({id:String(i),city:'x',lat:-z,lon:5,radiusM:0})),district={bbox:[-10,-10,10,10],landmarks:['0','1'],scenery:['1']},before=JSON.stringify({landmarks,district,data});
 const rows=districtLandmarkCoverage({landmarks,cityId:'x',district,data});assert.deepEqual(rows.map(r=>r.range),['close','nearby','distant','distant']);assert.equal(rows[2].missing,true);assert.equal(rows[3].potentiallyVisible,false);assert.equal(JSON.stringify({landmarks,district,data}),before);
});
test('all eight district lists retain every catalogue candidate inside their current view envelope',()=>{
 let districts=0;
 for(const[cityId,city]of Object.entries(CITIES))for(const[id,district]of Object.entries(city.districts)){
  const data=JSON.parse(fs.readFileSync(new URL(`../data/${cityId}-${id}.json`,import.meta.url))),rows=districtLandmarkCoverage({landmarks:LANDMARKS,cityId,district,data});
  assert.deepEqual(rows.filter(r=>r.missing).map(r=>r.id),[],id);assert(rows.every(r=>r.distanceM!==null),id);districts++;
 }
 assert.equal(districts,8);
});
