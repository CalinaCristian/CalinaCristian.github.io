import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {buildSpeciesTrees} from '../src/trees.js';
const trees=[{x:-100,z:-100,s:1,species:'linden'},{x:0,z:-100,s:1,species:'linden'},{x:100,z:-100,s:1,species:'linden'},{x:0,z:100,s:1,species:'conifer'}];
const make=cullFar=>{let state=231,calls=0;const rng=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};return {t:buildSpeciesTrees(trees,{rng,chunk:750,near:20,maxNear:10,farLayer:2,cullFar}),rng:()=>({state,calls})};};
const old=make(false),candidate=make(true),t=candidate.t,far=t.crownMeshes.concat(t.trunkMeshes).filter(m=>m.name.endsWith(' far'));
assert.deepEqual(candidate.rng(),old.rng(),'selection consumes no random values');assert.equal(t.count,trees.length);assert.equal(old.t.selectFar,undefined,'other callers keep their original behavior');
const before=far.map(m=>({m,matrix:m.instanceMatrix,colour:m.instanceColor,capacity:m.instanceMatrix.count,values:m.instanceMatrix.array.slice(),colours:m.instanceColor?.array.slice(),count:m.count}));
for(let i=0;i<far.length;i++){const source=old.t.crownMeshes.concat(old.t.trunkMeshes).find(m=>m.name===far[i].name);assert.deepEqual(far[i].instanceMatrix.array,source.instanceMatrix.array);if(source.instanceColor)assert.deepEqual(far[i].instanceColor.array,source.instanceColor.array);}
const cam=new THREE.PerspectiveCamera(20,1,.1,1000);cam.position.set(0,7,0);cam.updateMatrixWorld();t.group.updateMatrixWorld();t.selectFar(cam);
const count=()=>far.filter(m=>m.name.startsWith('treeCrowns')).reduce((n,m)=>n+m.count,0);
assert.equal(count(),1,'narrow view retains the central crown, not a whole coarse chunk');
const versions=far.map(m=>m.instanceMatrix.version);t.selectFar(cam);assert.deepEqual(far.map(m=>m.instanceMatrix.version),versions,'same view reuses the existing upload');
cam.rotation.y=Math.PI;cam.updateMatrixWorld();t.selectFar(cam);assert.equal(count(),1,'turning back restores the source conifer behind the first view');
cam.rotation.y=0;cam.fov=175;cam.updateProjectionMatrix();cam.updateMatrixWorld();t.selectFar(cam);assert.equal(count(),3);
t.update(0,-100);t.selectFar(cam);assert.equal(count(),2,'near LOD replaces its far instance without retaining a duplicate');
t.update(500,500);t.selectFar(cam);assert.equal(count(),3,'a near-to-far transition restores its canonical instance');
// Views in opposite directions together recover every source instance. No
// source transform or colour is reconstructed from a previously compacted slot.
for(const row of before){if(!row.m.name.includes('0,0')){assert.equal(row.m.count,row.count);assert.deepEqual(row.m.instanceMatrix.array.subarray(0,row.count*16),row.values);if(row.colours)assert.deepEqual(row.m.instanceColor.array.subarray(0,row.count*3),row.colours);}}
for(let i=0;i<40;i++){cam.rotation.y=i*Math.PI/10;cam.updateMatrixWorld();t.selectFar(cam);}
for(const r of before){assert.equal(r.m.instanceMatrix,r.matrix);assert.equal(r.m.instanceColor,r.colour);assert.equal(r.m.instanceMatrix.count,r.capacity);assert.equal(r.m.userData.treeView.sourceInstances,r.count);assert.equal(r.m.castShadow,false);assert.equal(r.m.layers.mask,4);}
assert.equal(t.count,trees.length);assert.deepEqual(candidate.rng(),old.rng());
// A whole source batch translated after construction remains visible from its
// translated camera; bounds cannot stay behind at the original coordinates.
t.group.position.x=500;t.group.updateMatrixWorld(true);cam.position.x=500;cam.rotation.y=0;cam.updateMatrixWorld();t.selectFar(cam);assert.equal(count(),3);
console.log(JSON.stringify({passed:true,sourceTrees:t.count,farBatches:far.length,scope:'Actual emitted far tree buffers, source/RNG/order, angle/transform, near replacement and repeated-view capacity controls; native pixels/resources remain separate.'}));
