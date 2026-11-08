import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../game/vendor/three.module.min.js';
import { canopyGeometry } from '../../game/src/building-canopies.js';
import { makeRoofProfile } from '../../game/src/building-roofs.js';
import { collideBuildings } from '../../game/src/world.js';
const triangulate=(outer,holes=[])=>({pts:outer.concat(...holes),tris:THREE.ShapeUtils.triangulateShape(outer.map(p=>new THREE.Vector2(...p)),holes.map(r=>r.map(p=>new THREE.Vector2(...p))))});
const area=ring=>Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const projected=faces=>faces.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2,0);
const close=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const rectangle=[[0,0],[20,0],[20,10],[0,10]],court=[[0,0],[20,0],[20,20],[0,20]],hole=[[6,6],[6,14],[14,14],[14,6]];
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-round-canopy.json',import.meta.url)));
assert.equal(fixture.rawTags['roof:shape'],'round');assert.equal(fixture.rawTags.height,'4');assert.equal(fixture.rawTags.min_height,undefined);
const records=[{id:fixture.sourceId,ring:fixture.ring,holes:fixture.holes,h:fixture.height,minH:fixture.minimum,roofProfile:fixture.profile}];
for(const[shape,ring,holes,h,minH]of[['flat',rectangle,[],6,5],['gabled',rectangle,[],6,3],['gabled',court,[hole],7,4],['round',court,[hole],7,4]])records.push({id:shape+(holes.length?'-court':''),ring,holes,h,minH,roofProfile:makeRoofProfile({tags:{height:String(h),'roof:shape':shape,'roof:height':shape==='flat'?'0':'1.5','roof:direction':'N'},ring,holes,height:h,minHeight:minH,heightIsTotal:true})});
for(const b of records){
 const input=JSON.stringify(b),g=canopyGeometry(b,triangulate);assert(g.native,`${b.id}: native roof missing`);assert.equal(JSON.stringify(b),input,`${b.id}: source input changed`);
 close(projected(g.roofFaces),area(b.ring)-b.holes.reduce((s,h)=>s+area(h),0));close(projected(g.underside),projected(g.roofFaces));
 const ys=g.roofFaces.flat().map(v=>v[1]);close(Math.max(...ys),b.h);assert(Math.min(...ys)>=b.minH-1e-8);
 for(const face of g.underside)for(const p of face)close(p[1],b.minH);
 if(b.roofProfile.shape!=='flat')assert(Math.max(...ys)-Math.min(...ys)>.5,`${b.id}: source shape flattened`);else close(Math.min(...ys),b.h);
 const collider={x:10,z:10,r:2000,poly:b.ring,holes:b.holes,minH:b.minH,h:b.h,y0:b.minH,y1:b.h,roofHeightAt:g.native.heightAt};
 const point=b.id===fixture.sourceId?[-831,(fixture.profile.low+fixture.profile.high)/2]:[2,2];
 assert.equal(collideBuildings([collider],...point,.2,b.minH-1,.4),null,`${b.id}: open clearance blocked`);
 assert(collideBuildings([collider],...point,.2,b.minH-.1,.4),`${b.id}: underside not solid`);
 if(b.holes.length){assert.equal(g.native.heightAt(10,10),null);assert.equal(collideBuildings([collider],10,10,.2,b.minH,.4),null,`${b.id}: courtyard blocked`);assert.equal(g.walls.length,8,`${b.id}: courtyard edge walls missing`);}
}
const legacy={ring:rectangle,holes:[],h:6,minH:5};const g=canopyGeometry(legacy,triangulate);assert.equal(g.native,null);close(Math.min(...g.roofFaces.flat().map(v=>v[1])),6);close(projected(g.underside),200);
console.log('Canopy source fixtures passed: actual Unirii round tag, literal slab, gabled/round courtyards, open underside, complete footprints, native height collision and legacy flat fallback.');
