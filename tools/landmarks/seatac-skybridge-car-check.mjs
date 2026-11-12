// Compare actual recorded car traces with exact rendered skybridge glass triangles.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import { readDistrictData } from '../osm/district-data.mjs';
const arg=(k,d)=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const root=path.resolve(arg('root','.')),sha=arg('source-commit',''),tracePath=arg('trace',''),output=arg('out',''),expected=arg('expect','clear');
if(!/^[0-9a-f]{40}$/.test(sha)||!tracePath||!output)throw Error('Exact source, trace and output required');
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs={};
for(const f of ['game/src/landmarks.js','game/src/landmark-seatac-structure.js','game/src/landmark-us-source.js','game/src/vehicles.js','game/src/world.js','game/data/seattle-seatac.bin.gz']){const b=fs.readFileSync(path.join(root,f));if(!b.equals(execFileSync('git',['show',sha+':'+f],{maxBuffer:32*1024*1024})))throw Error('Source mismatch '+f);inputs[f]=hash(b);}
const THREE=await import(pathToFileURL(root+'/game/vendor/three.module.min.js')),{LANDMARKS,buildLandmark}=await import(pathToFileURL(root+'/game/src/landmarks.js'));
const report=JSON.parse(fs.readFileSync(tracePath)),data=readDistrictData(root+'/game/data/seattle-seatac.bin.gz'),lm=LANDMARKS.find(l=>l.id==='seagarage'),model=buildLandmark(lm,{realScale:true}),p=data.proj;
model.mesh.position.set((lm.lon-p.lon0)*p.mPerLon,.12,-(lm.lat-p.lat0)*p.mPerLat);model.mesh.updateMatrixWorld(true);
const extent=fs.readFileSync(root+'/game/src/vehicles.js','utf8').match(/g\.userData\.extent\s*=\s*\{\s*front:\s*([\d.]+),\s*rear:\s*([\d.]+),\s*half:\s*([\d.]+)/);
if(!extent)throw Error('Native cockpit extent missing');const [front,rear,half]=extent.slice(1).map(Number),height=2;
const wanted=new THREE.Color('#7f9fb3'),triangles=[];
model.mesh.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,col=o.geometry.attributes.color,index=o.geometry.index;
 for(let j=0;j<(index?index.count:pos.count);j+=3){const ids=[0,1,2].map(k=>index?index.getX(j+k):j+k);if(!col||Math.abs(col.getX(ids[0])-wanted.r)>1e-5||Math.abs(col.getY(ids[0])-wanted.g)>1e-5||Math.abs(col.getZ(ids[0])-wanted.b)>1e-5)continue;triangles.push(ids.map(i=>new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld)));}
});
const box=new THREE.Box3(new THREE.Vector3(-half,0,-rear),new THREE.Vector3(half,height,front)),hits=[];let frames=0;
for(const row of report.cases)for(const pose of row.trace){frames++;const fx=-Math.sin(pose.heading),fz=-Math.cos(pose.heading),rx=-fz,rz=fx;let count=0;
 for(const vertices of triangles){const v=vertices.map(q=>{const dx=q.x-pose.x,dz=q.z-pose.z;return new THREE.Vector3(dx*rx+dz*rz,q.y-pose.y,dx*fx+dz*fz);});if(box.intersectsTriangle(new THREE.Triangle(...v)))count++;}
 if(count)hits.push({case:row.id,t:pose.t,x:pose.x,z:pose.z,y:pose.y,heading:pose.heading,sourceEdge:pose.supportEdge,sourceRoad:pose.supportSource,meshTriangleContacts:count});
}
const passed=expected==='overlap'?hits.length>0:hits.length===0;
const result={passed,expected,modelSourceCommit:sha,traceSourceCommit:report.sourceCommit,traceSha256:hash(fs.readFileSync(tracePath)),inputHashes:inputs,method:'Exact rendered source skybridge glass-colour triangles transformed into the actual recorded native cockpit footprint. THREE.Box3.intersectsTriangle tests full3D mesh/body overlap. Different model/trace SHAs are explicitly a counterfactual replay, never a recaptured native trace.',bodyExtent:{front,rear,width:half*2,height},renderedSkybridgeGlassTriangles:triangles.length,frames,hits};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed,frames,triangleCount:triangles.length,overlapFrames:hits.length,modelSourceCommit:sha,traceSourceCommit:report.sourceCommit}));if(!passed)process.exitCode=1;
