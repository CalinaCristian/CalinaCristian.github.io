import assert from 'node:assert/strict';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {Office} from '../../../game/src/office.js';
import {STOPS} from '../../../game/src/data.js';
const draw=new Proxy({measureText:t=>({width:String(t).length*(Number(/(\d+(?:\.\d+)?)px/.exec(draw.font)?.[1])||18)*.52}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={body:{classList:{contains:()=>false}},createElement:()=>({getContext:()=>draw,toDataURL:()=>'',style:{}})};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.innerWidth=1280;globalThis.innerHeight=720;
const input=()=>({keys:new Set(),touch:{},take:()=>false,takeLook:()=>({dx:0,dy:0}),flush(){},releaseLock(){}}),events=new Map(),shared=new Set(),summaries=[];
const track=r=>{if(!r||events.has(r))return;events.set(r,0);r.addEventListener('dispose',()=>events.set(r,events.get(r)+1));};
let externalReleases=0,shadowReleases=0;
for(let repeat=0;repeat<3;repeat++)for(const stop of STOPS){
 const o=new Office({},new THREE.PerspectiveCamera(70,16/9,.1,1000),stop,{panelOpen:false,prompt(){},setHint(){}},input(),{});
 const geometryUses=new Map();o.scene.traverse(n=>{if(n.isMesh)geometryUses.set(n.geometry,(geometryUses.get(n.geometry)||0)+1);});const globalBox=[...geometryUses].sort((a,b)=>b[1]-a[1])[0][0];shared.add(globalBox);track(globalBox);
 for(const mesh of o.crowd.object.children){shared.add(mesh.material);track(mesh.material);shared.add(mesh.customDepthMaterial);track(mesh.customDepthMaterial);}
 const owned=new Set();o.scene.traverse(n=>{if(!n.isMesh||n.userData.shared)return;if(n.geometry!==globalBox)owned.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){owned.add(m);for(const t of Object.values(m))if(t?.isTexture)owned.add(t);}});for(const r of owned)track(r);
 const originalMap=o.windowPane.material.map;assert.ok(owned.has(originalMap));
 const external=new THREE.Texture();external.userData.officeExternal=true;external.addEventListener('dispose',()=>externalReleases++);o.windowPane.material.map=external;
 const shadow=o.scene.children.find(n=>n.isDirectionalLight).shadow;shadow.map=new THREE.WebGLRenderTarget(8,8);shadow.mapPass=new THREE.WebGLRenderTarget(8,8);for(const t of[shadow.map,shadow.mapPass])t.addEventListener('dispose',()=>shadowReleases++);
 o.dispose();o.dispose();
 for(const r of owned)assert.equal(events.get(r),1,stop.id+' owned '+r.type+' must be released once');for(const r of shared)assert.equal(events.get(r),0,'shared primitive/crowd material released');assert.equal(externalReleases,0,'externally attached window target adopted');assert.equal(o.roomResources.disposed,true);assert.ok(Object.values(o.roomResources.remaining).every(n=>n===0));if(o.interiorDetails){assert.equal(o.interiorDetails.ownedMaterials.size,0);assert.equal(o.interiorDetails.ownedTextures.size,0);}
 summaries.push({repeat,stop:stop.id,ownedResources:owned.size,roomSnapshot:o.roomResources.counts,helper:!!o.interiorDetails});
}
assert.equal(shadowReleases,STOPS.length*3*2);assert.equal(externalReleases,0);
console.log(JSON.stringify({scope:'Actual Office construction/dispose events across24rooms; CPU ownership only, not renderer.info, GPU allocation or weak-reference lifetime proof',passed:true,checks:['24 repeated real room constructions release each owned geometry/material/map once','replaced original window map is freed while late external texture is preserved','global BOXG and shared crowd materials survive every room','late allocated directional shadow/mapPass targets are each released once','second dispose is inert and ownership sets clear'],rooms:summaries.length,ownedResourcesReleased:[...events].filter(([r,n])=>n===1).length,sharedResourcesPreserved:shared.size,shadowTargetsReleased:shadowReleases,externalTextureReleases:externalReleases,summaries},null,2));
