import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three.module.min.js';
import { createOfficeWindowService } from '../src/office-window-service.js';
import { boundedOfficeWindowSize, retainedOfficeWindowCapacity } from '../src/office-window-target.js';
import { createOfficeBubbleScope } from '../src/office-bubble-scope.js';

test('a temporary jump outside the window envelope recovers without replacing the live world', () => {
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.7,0);camera.updateMatrixWorld();
 const originalCamera={},observer={},world={camera:originalCamera},traffic={observerCamera:observer,peds:{}},pane=new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial()),originalMap=pane.material.map;
 const office={camera,windowPane:pane,bounds:{minX:-3,maxX:3,minZ:-3,maxZ:3}},binding={known:true,ring:[[-3,-3],[3,-3],[3,3],[-3,3]],holes:[],mapPoint:p=>p.clone(),lowerLeft:new THREE.Vector3(-2,0,-5),lowerRight:new THREE.Vector3(2,0,-5),upperLeft:new THREE.Vector3(-2,3,-5)};
 const service=createOfficeWindowService({renderer:{capabilities:{isWebGL2:true},extensions:{has:()=>true}},r3d:{advanceEnvironment(){},visibilityFar:()=>500},world,scene:{},traffic,office,entryCamera:camera,binding});
 assert.equal(service.prepare(1/60),true);
 camera.position.y=3;assert.equal(service.prepare(1/60),false);assert.match(service.reason,/envelope/);
 camera.position.y=1.7;assert.equal(service.prepare(1/60),true);assert.equal(service.reason,null);
 assert.equal(world.camera,service.camera);assert.equal(traffic.observerCamera,service.camera);
 service.dispose();service.dispose();assert.equal(world.camera,originalCamera);assert.equal(traffic.observerCamera,observer);assert.equal(pane.material.map,originalMap);
 pane.geometry.dispose();pane.material.dispose();
});

test('walking past a window retains a bounded render target capacity', () => {
 let capacity=null,changes=0;
 for(let i=0;i<1000;i++){
  const next=retainedOfficeWindowCapacity(900+Math.sin(i)*100,500+Math.cos(i)*50,capacity);
  if(JSON.stringify(next)!==JSON.stringify(capacity))changes++;
  capacity=next;const actual=boundedOfficeWindowSize(capacity.width,capacity.height,1,{maxPixels:1000000,maxDimension:2048});
  assert(actual.pixels<=1000000);assert(actual.width<=2048&&actual.height<=2048);
 }
 assert(changes<=2,'ordinary parallax must not recreate the framebuffer each frame');
});

test('office speech keeps shared HUD panel state and expires only its own visit', () => {
 const street={el:{remove(){this.removed=true;}}},hud={bubbles:[street],panelOpen:false,say(v,text){this.bubbles.push({v,text,el:{remove(){this.removed=true;}}});},panel(){this.panelOpen=true;}};
 const visit=createOfficeBubbleScope(hud);visit.hud.say({x:0,z:0},'Welcome');const speech=hud.bubbles[1];
 assert.equal(visit.accepts(street),false);assert.equal(visit.accepts(speech),true);
 visit.hud.panel();assert.equal(hud.panelOpen,true);visit.hud.panelOpen=false;assert.equal(hud.panelOpen,false);
 visit.dispose();assert.deepEqual(hud.bubbles,[street]);assert.equal(speech.el.removed,true);
 visit.hud.say({},'stale');assert.equal(hud.bubbles.length,1);
});
