import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),out=process.argv[3],base='4787d7d7b6deaac7855a990f530d1ccff4917997';
const file='game/src/spots/source-landmark.js';
const old=execFileSync('git',['show',`${base}:${file}`],{cwd:root,encoding:'utf8'}).replace("'../landmarks.js'",JSON.stringify(pathToFileURL(path.join(root,'game/src/landmarks.js')).href));
const {sourceMountain:before}=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
const {sourceMountain:after}=await import(pathToFileURL(path.join(root,file)));
const THREE=await import(pathToFileURL(path.join(root,'game/vendor/three.module.min.js')));
const data=JSON.parse(fs.readFileSync(path.join(root,'game/data/spots/seattle-center.json')));
const hash=g=>{const h=crypto.createHash('sha256');g.traverse(o=>{if(o.isMesh){for(const key of['position','normal'])h.update(Buffer.from(o.geometry.attributes[key].array.buffer));if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));}});return h.digest('hex');};
const results=[];
for(const id of['rainier','olympics']){
 const updates=[],ctx={data,env:{},scene:new THREE.Scene(),onUpdate:f=>updates.push(f),ll:(lat,lon)=>({x:(lon-data.origin.lon)*data.projection.mLon,z:-(lat-data.origin.lat)*data.projection.mLat})};
 const a=before(ctx,id),b=after(ctx,id);assert.equal(hash(a),hash(b));
 assert(a.position.distanceTo(b.position)<1e-10);assert.equal(a.scale.x,b.scale.x);
 const camera=new THREE.PerspectiveCamera(),tests=[];
 for(const eye of[[0,1.65,0],[15,154.1,8],[-200,-10,100]]){
  camera.position.set(...eye);camera.updateMatrixWorld(true);for(const update of updates)update(0,{camera,r3d:{weather:{visibilityM:120000,cloud:.2}}});
  b.updateMatrixWorld(true);let maxRayError=0,maxDistanceM=0,vertices=0,minOriginalDistanceM=Infinity,maxOriginalDistanceM=0,peak={y:-Infinity};
  b.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
   const local=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
   const truePoint=new THREE.Vector3(local.x+b.userData.sourceProjection.anchor.x,local.y-data.origin.elev,local.z+b.userData.sourceProjection.anchor.z);
   const actual=o.localToWorld(local.clone()).sub(camera.position),expected=truePoint.sub(camera.position).multiplyScalar(b.scale.x);
   maxRayError=Math.max(maxRayError,actual.distanceTo(expected));maxDistanceM=Math.max(maxDistanceM,actual.length());vertices++;
   const oldPoint=local.clone().multiplyScalar(a.scale.x).add(a.position),d=Math.hypot(oldPoint.x,oldPoint.z);
   minOriginalDistanceM=Math.min(minOriginalDistanceM,d);maxOriginalDistanceM=Math.max(maxOriginalDistanceM,d);if(oldPoint.y>peak.y)peak={x:oldPoint.x,y:oldPoint.y,z:oldPoint.z,horizontalDistanceM:d};
  }});
  assert(maxRayError<1e-10);assert(maxDistanceM<ctx.env.backdropFarM);assert.equal(b.visible,true);
  tests.push({eye,vertices,maxRayError,maxDistanceM,minOriginalDistanceM,maxOriginalDistanceM,peak});
 }
 for(const update of updates)update(0,{camera,r3d:{weather:{visibilityM:500,cloud:.9}}});assert.equal(b.visible,false);
 results.push({id,geometryAndNormalsSHA256:hash(b),sourceBuffersUnchanged:true,groundEyeTransformUnchanged:true,finiteFarBoundM:ctx.env.backdropFarM,tests,fogHidden:true});
}
const report={scope:'CPU actual source mountain geometry/normal bytes and all emitted vertex rays at three native camera-height fixtures; fresh public-app rendering/budget remains required',base,sourceFileSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),results};
if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
