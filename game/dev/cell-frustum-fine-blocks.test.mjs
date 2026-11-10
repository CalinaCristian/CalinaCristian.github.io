import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {cullMergedCells} from '../src/cell-frustum.js';
// One original cell contains both near-visible and remote geometry. Subdivision
// is conservative at its contiguous-block boundary, including a crossing leaf.
const g=new THREE.BufferGeometry(),p=[],ix=[];
for(let i=0;i<400;i++){const x=i<200?-20:20;p.push(x-1,3,-11,x,3,-9,x+1,3,-11);ix.push(i*3,i*3+1,i*3+2);}
for(let i=0;i<64;i++){p.push(99,3,-11,100,3,-9,101,3,-11);ix.push(1200+i*3,1201+i*3,1202+i*3);}
g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
const originalIndex=g.index,originalPositions=g.attributes.position.array.slice(),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
const debug=cullMergedCells(mesh,[{start:0,count:1200,bounds:[-21,3,-11,21,3,-9]},{start:1200,count:192,bounds:[99,3,-11,101,3,-9]}],{blockTriangles:64});
const renderer={coordinateSystem:THREE.WebGLCoordinateSystem},camera=x=>{const c=new THREE.PerspectiveCamera(30,1,.1,200);c.position.set(x,3,0);c.updateMatrixWorld();return c;},left=camera(-20),right=camera(20);
const selected=()=>Array.from(g.index.array.subarray(0,g.drawRange.count));
mesh.onBeforeRender(renderer,null,left);let values=selected();assert(values.length<1200);assert(values.slice(0,600).every((v,i)=>v===i),'all visible source triangles retain exact indices and order');
const updates=debug.updates,version=g.index.version;mesh.onBeforeRender(renderer,null,left);assert.equal(debug.updates,updates);assert.equal(g.index.version,version,'unchanged fine visibility does not upload again');
mesh.onBeforeShadow(renderer,mesh,left,right);values=selected();for(let i=600;i<1200;i++)assert(values.includes(i),'the actual shadow camera retains every remote visible triangle');
mesh.onBeforeRender(renderer,null,left);const index=g.index,range=g.drawRange.count,ray=new THREE.Raycaster(new THREE.Vector3(20,100,-10.5),new THREE.Vector3(0,-1,0)),hits=ray.intersectObject(mesh);assert(hits.length>0,'physical rays still find a culled roof');assert.equal(g.index,index);assert.equal(g.drawRange.count,range);
mesh.position.x=40;mesh.updateMatrixWorld();mesh.onBeforeRender(renderer,null,right);assert(selected().slice(0,600).every((v,i)=>v===i),'transformed source bounds follow their mesh');
mesh.position.x=0;mesh.updateMatrixWorld();const wide=camera(40);wide.fov=175;wide.updateProjectionMatrix();mesh.onBeforeRender(renderer,null,wide);assert.deepEqual(selected(),ix,'wide view restores the complete original topology');assert.deepEqual(Array.from(originalIndex.array),ix);assert.deepEqual(g.attributes.position.array,originalPositions);
const singleGeometry=new THREE.BufferGeometry();singleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));singleGeometry.setIndex(ix);const single=new THREE.Mesh(singleGeometry,new THREE.MeshBasicMaterial());single.updateMatrixWorld();const one=cullMergedCells(single,[{start:0,count:ix.length,bounds:[-21,3,-11,101,3,-9]}],{blockTriangles:64});assert(one&&one.components>1,'one large original batch can be partitioned conservatively');single.onBeforeRender(renderer,null,left);assert(singleGeometry.drawRange.count<ix.length);assert.deepEqual(Array.from(singleGeometry.index.array.subarray(0,600)),ix.slice(0,600));assert(new THREE.Raycaster(new THREE.Vector3(20,100,-10.5),new THREE.Vector3(0,-1,0)).intersectObject(single).length>0,'off-camera support survives single-batch selection');
console.log(JSON.stringify({passed:true,sourceTriangles:464,components:debug.components,typedMetadataBytes:debug.typedMetadataBytes,scope:'Fine-block source/order/shadow/transform/off-camera physical support controls; native pixels and budgets remain separate.'}));
