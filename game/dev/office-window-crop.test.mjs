import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { projectedOfficeAperture, officeWindowCrop } from '../src/office-window-service.js';
import { configureOffAxisWindow } from '../src/office-window-math.js';

test('a near-glass view spends its target on the visible subsection, not the whole pane',()=>{
 const pane=new THREE.Mesh(new THREE.PlaneGeometry(8,3));pane.position.z=-4;
 const camera=new THREE.PerspectiveCamera(70,16/9,.05,1000);camera.position.set(1,.4,-3.7);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const r=projectedOfficeAperture(pane,camera,1920,1080);
 assert(r);assert(Math.abs(r.width-1920)<.001);assert(Math.abs(r.height-1080)<.001);
 assert(r.u1-r.u0<.1);assert(r.v1-r.v0<.16);
 const b={lowerLeft:new THREE.Vector3(-4,-1.5,-4),lowerRight:new THREE.Vector3(4,-1.5,-4),upperLeft:new THREE.Vector3(-4,1.5,-4)},crop=officeWindowCrop(b,r),external=new THREE.PerspectiveCamera();
 configureOffAxisWindow(external,{eye:camera.position,...crop,far:1000});
 for(const [u,v]of[[r.u0,r.v0],[r.u1,r.v1],[(r.u0+r.u1)/2,(r.v0+r.v1)/2]]){
  const source=new THREE.Vector3(-4+8*u,-1.5+3*v,-4).project(external),sample=[u*crop.repeat[0]+crop.offset[0],v*crop.repeat[1]+crop.offset[1]];
  assert(Math.abs((source.x+1)/2-sample[0])<1e-9);assert(Math.abs((source.y+1)/2-sample[1])<1e-9);
 }
 assert.equal(pane.scale.x,1);assert.equal(pane.position.z,-4);
});

test('oblique and partial-edge crops remain finite and entirely behind the source pane',()=>{
 const pane=new THREE.Mesh(new THREE.PlaneGeometry(8,3));pane.position.z=-4;
 for(const x of [-3.9,0,3.9])for(const distance of [.2,.8,4]){
  const camera=new THREE.PerspectiveCamera(70,9/16,.05,1000);camera.position.set(x,.7,-4+distance);camera.lookAt(x+.15,.4,-4);camera.updateMatrixWorld();
  const r=projectedOfficeAperture(pane,camera,390,844);assert(r);
  assert(r.u0>=0&&r.v0>=0&&r.u1<=1&&r.v1<=1);assert(r.u1>r.u0&&r.v1>r.v0);
 }
});
