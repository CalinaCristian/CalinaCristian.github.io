import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sourceTerrainField,decodeSourceContext } from '../../game/src/spots/source-context-data.js';
import { Ground } from '../../game/src/spots/ground.js';
const encode=a=>Buffer.from(new Float32Array(a).buffer).toString('base64');
const terrain={format:'float32-le-base64',nx:2,nz:2,westPixelCentre:0,northPixelCentre:1,lonStep:1,latStep:1,heights:encode([10,20,30,40])};
const frame={origin:{lat:1,lon:0,elev:5},projection:{mLat:1,mLon:1}};
const f=sourceTerrainField(terrain,frame.origin,frame.projection);
assert.equal(f.atLL(1,0),10);assert.equal(f.atLL(0,1),40);assert.equal(f.atLL(.5,.5),25);assert.equal(f.heightAt(.5,.5),20);
assert.equal(f.atLL(1.000001,0),null);assert.equal(f.atLL(0,1.000001),null);
assert.throws(()=>sourceTerrainField({...terrain,heights:encode([NaN,20,30,40])},frame.origin,frame.projection));
const input={schemaVersion:1,id:'fixture',nodes:[10,10000000,0,11,10000000,10000000,12,0,10000000,13,0,0],tags:[{building:'yes',height:'30 ft',min_height:'10 ft','building:levels':'3','roof:shape':'flat',layer:'2'},{highway:'service',width:'6 ft',tunnel:'no'},{natural:'water',water:'lake'}],buildings:[{id:'w1',n:[0,1,2,3,0],t:0}],ways:[{id:'w2',n:[0,1],t:1}],areas:[{id:'r3',n:[0,1,2,3,0],holes:[[0,1,2,0]],t:2}],coastlines:[],trees:[],terrain};
const saved=JSON.stringify(input),d=decodeSourceContext(input,frame);
assert.equal(d.buildings[0].h,9.144);assert.equal(d.buildings[0].minH,3.048);assert.equal(d.buildings[0].layer,2);assert.equal(d.buildings[0].lv,3);
assert.equal(d.ways[0].width,1.8288000000000002);assert.equal(d.ways[0].tunnel,undefined);assert.equal(d.ways[0].rawTags.tunnel,'no');assert.equal(d.areas[0].holes.length,1);assert.equal(d.buildings[0].poly.length,4);assert.equal(JSON.stringify(input),saved);
const oldGrid={x0:0,z0:0,d:10,nx:3,nz:3,h:[1,2,3,4,5,6,7,8,9]},a=new Ground(oldGrid),b=new Ground(oldGrid);
b.sourceTerrain={heightAt:(x,z)=>20+x*.1+z*.05,transitionM:10};
let samples=0;for(let z=0;z<=20;z+=.25)for(let x=0;x<=20;x+=.25){assert.equal(a.raw(x,z),b.raw(x,z));samples++;}
assert(Math.abs(b.raw(20.000001,10)-a.raw(20,10))<1e-10);assert.equal(b.raw(30,10),23.5);
b.sourceTerrain.heightAt=()=>null;assert.equal(a.raw(100,100),b.raw(100,100));
const wet=new Ground(oldGrid);wet.waterY=99;wet.sourceTerrain={heightAt:()=>0,waterAt:(x,z)=>x>30?40:null};
assert.equal(wet.flightHeightAt(40,10),40);assert.equal(wet.groundAt(40,10,0),50);assert(wet.flightHeightAt(10,10)<40);
wet.addBox(40,10,2,2,0,39,45);assert.equal(wet.groundAt(40,10,45),45);assert.equal(wet.flightHeightAt(40,10,40),45);
const legacy=new Ground(oldGrid);legacy.waterY=99;assert.equal(legacy.flightHeightAt(10,10),99);
const result={syntheticControlsPassed:24,unchangedFineDemSamples:samples,sourceLayerDoesNotSupplyMetres:true,literalFeetPriority:true,sourceHolesAndClosedOrder:true,noInputMutation:true,sourceMaskedWaterAndDeckControls:true,legacyUnmaskedWaterUnchanged:true};
if(process.argv[2]){
 const source=JSON.parse(fs.readFileSync(process.argv[2])),native=JSON.parse(fs.readFileSync('game/data/spots/seattle-center.json')),field=sourceTerrainField(source.terrain,native.origin,native.projection);
 let pixels=0,maxErrorM=0;
 for(let j=0;j<source.terrain.nz;j+=17)for(let i=0;i<source.terrain.nx;i+=17){const expected=field.samples[j*source.terrain.nx+i],actual=field.atLL(source.terrain.northPixelCentre-j*source.terrain.latStep,source.terrain.westPixelCentre+i*source.terrain.lonStep);assert(actual!=null);maxErrorM=Math.max(maxErrorM,Math.abs(actual-expected));assert(Math.abs(actual-expected)<1e-7);pixels++;}
 result.actualSource={sampledOriginalPixels:pixels,maxErrorM,totalOriginalFloat32Pixels:field.samples.length};
}
console.log(JSON.stringify(result,null,2));
