import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../../src/geobuild.js';
import { clipBuildingDetailRange } from '../../src/building-detail-range.js';
import { roofMesh } from '../../src/building-roofs.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../../handoffs/fidelity/campus-building-parts/cf-ck-native-fixture.json',import.meta.url)));
const triangulate=(outer,holes=[])=>({pts:outer.concat(...holes),tris:THREE.ShapeUtils.triangulateShape(outer.map(p=>new THREE.Vector2(...p)),holes.map(h=>h.map(p=>new THREE.Vector2(...p))))});
const bodies=fixture.sourceBodies.map(b=>({...b,mesh:roofMesh(b.ring,b.holes,b.roofProfile,triangulate)}));
let nativePairs=0;
for(const pair of fixture.nativePairs){
    const mb=new MeshBuilder(true),owner=bodies.find(b=>b.i===fixture.ownerByDetailTriangle[pair.a.triangle]);
    mb.wall(100,100,110,100,0,4,0,1,[201,109,73],2,7,3,8,6);
    const start={ic:mb.ic,vc:mb.vc},prefix={i:[...mb.i.slice(0,mb.ic)],p:[...mb.p.slice(0,mb.vc*3)],n:[...mb.n.slice(0,mb.vc*3)],u:[...mb.u.slice(0,mb.vc*2)],c:[...mb.c.slice(0,mb.vc*3)],t:[...mb.t.slice(0,mb.vc)]};
    const ids=pair.a.vertices.map(([x,y,z])=>mb.v(x,y,z,0,1,0,x,z,[100,130,170],-1));mb.tri(...ids);
    const result=clipBuildingDetailRange(mb,start,owner,bodies.filter(b=>b!==owner));
    assert(result.clippedAreaM2+1e-7>=pair.overlapAreaM2);assert.equal(result.issues.length,0);
    for(const [key,values]of Object.entries(prefix))assert.deepEqual([...mb[key].slice(0,values.length)],values,`${key} source prefix changed`);
    for(let k=start.vc;k<mb.vc;k++){assert.equal(mb.p[k*3],mb.u[k*2]);assert.equal(mb.p[k*3+2],mb.u[k*2+1]);assert.deepEqual([...mb.c.slice(k*3,k*3+3)],[100,130,170]);assert.equal(mb.t[k],-1);assert.deepEqual([...mb.n.slice(k*3,k*3+3)],[0,1,0]);}
    nativePairs++;
}
const mb=new MeshBuilder(true);mb.wall(0,0,10,0,0,10,0,-1,[50,100,150],0,2,0,3,7);const start={ic:mb.ic,vc:mb.vc};mb.wall(20,20,30,20,0,10,0,-1,[50,100,150],0,2,0,3,7);const before={i:[...mb.i.slice(0,mb.ic)],p:[...mb.p.slice(0,mb.vc*3)]};const result=clipBuildingDetailRange(mb,start,{i:1,sourceId:'w1'},[]);assert.equal(result.clippedAreaM2,0);assert.deepEqual([...mb.i.slice(0,mb.ic)],before.i);assert.deepEqual([...mb.p.slice(0,mb.vc*3)],before.p);
console.log(JSON.stringify({passed:true,nativeCampusRangePairs:nativePairs,controls:['source-index-and-all-attribute-prefixes','new-UV-colour-normal-tile-interpolation','no-op-native-indices-unchanged'],browserOpened:false}));
