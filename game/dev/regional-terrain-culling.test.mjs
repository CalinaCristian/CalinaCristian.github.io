import test from'node:test';import assert from'node:assert/strict';import * as THREE from'../vendor/three.module.min.js';
import{terrainIndexChunks,selectTerrainIndices}from'../src/spots/source-terrain-visibility.js';
const positions=new Float32Array([0,1,-50,1,1,-50,0,2,-50,5000,1,-50,5001,1,-50,5000,2,-50]),indices=new Uint32Array([0,1,2,3,4,5]);
const camera=new THREE.PerspectiveCamera(60,1,.1,10000);camera.position.set(0,1,0);camera.updateMatrixWorld();const matrix=()=>new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
test('smaller cells remove a fully offscreen source triangle without changing any source bit or draw batch',()=>{
 const beforeP=positions.slice(),beforeI=indices.slice(),coarse=terrainIndexChunks(positions,indices,{chunkM:8000}),fine=terrainIndexChunks(positions,indices,{chunkM:1000}),output=new Uint32Array(6);
 assert.equal(selectTerrainIndices(coarse,matrix(),output).count,6);assert.equal(selectTerrainIndices(fine,matrix(),output).count,3);assert.deepEqual([...output.slice(0,3)],[0,1,2]);
 assert.equal(fine.reduce((n,c)=>n+c.index.length,0),6);assert.deepEqual(positions,beforeP);assert.deepEqual(indices,beforeI);
});
test('unchanged visibility reuses the index upload; a real view change updates it',()=>{
 const chunks=terrainIndexChunks(positions,indices),output=new Uint32Array(6),cache={};camera.rotation.y=0;camera.updateMatrixWorld();
 assert.equal(selectTerrainIndices(chunks,matrix(),output,cache).changed,true);const before=output.slice();assert.equal(selectTerrainIndices(chunks,matrix(),output,cache).changed,false);assert.deepEqual(output,before);
 camera.rotation.y=-Math.PI/2;camera.updateMatrixWorld();const changed=selectTerrainIndices(chunks,matrix(),output,cache);assert.equal(changed.changed,true);assert.equal(changed.count,3);assert.deepEqual([...output.slice(0,3)],[3,4,5]);
});
