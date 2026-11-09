import fs from 'node:fs';import zlib from 'node:zlib';import {createRequire}from'node:module';
import path from'node:path';
import * as THREE from '../../../../game/vendor/three.module.min.js';
const folder=path.resolve(process.argv[3]||new URL('./native-fixture/',import.meta.url).pathname),require=createRequire(import.meta.url),D=require(folder+'/decode-geometry.cjs');
const raw=fs.existsSync(folder+'/native-blocker-fixture.json')?fs.readFileSync(folder+'/native-blocker-fixture.json'):zlib.gunzipSync(fs.readFileSync(folder+'/native-blocker-fixture.json.gz')),native=JSON.parse(raw);
const actor=id=>native.actors.find(a=>a.id===id),toV=p=>new THREE.Vector3(...p),box=tri=>new THREE.Box3().setFromPoints(tri);
function body(a,pose=null){
 let matrix=a.mesh.matrixWorld;if(pose){const m=new THREE.Matrix4().compose(new THREE.Vector3(pose.x,pose.y,pose.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,pose.heading,pose.roll,'YXZ')),new THREE.Vector3(...a.mesh.scale));matrix=m.toArray();}
 const part=D.geometryPart(native.geometryCatalog[a.primaryGeometryId],matrix),tris=[...D.triangles(part)].map(t=>({...t,vertices:t.vertices.map(toV)}));for(const t of tris)t.box=box(t.vertices);return {a,pose,tris,bounds:new THREE.Box3().setFromPoints(tris.flatMap(t=>t.vertices))};
}
const point=new THREE.Vector3(),direction=new THREE.Vector3(),ray=new THREE.Ray();
function intersect(a,b){for(const[edges,target]of[[a,b],[b,a]])for(let i=0;i<3;i++){const p=edges[i],q=edges[(i+1)%3],length=direction.subVectors(q,p).length();if(length<1e-8)continue;ray.set(p,direction.clone().multiplyScalar(1/length));const hit=ray.intersectTriangle(...target,false,point);if(hit&&hit.distanceTo(p)>1e-7&&hit.distanceTo(p)<length-1e-7)return hit.toArray()}return null}
function contacts(a,targets,max=12){const out=[];let tests=0;for(const b of a.tris)for(const t of targets){if(!b.box.intersectsBox(t.box))continue;tests++;const point=intersect(b.vertices,t.vertices);if(point){out.push({bodyTriangle:b.triangle,targetTriangle:t.triangle,targetMesh:t.mesh??null,point,targetVertices:t.vertices.map(v=>v.toArray())});if(out.length>=max)return{contacts:out,tests,stoppedAfterPositiveLimit:true};}}return{contacts:out,tests,stoppedAfterPositiveLimit:false}}
const report={sourceCommit:native.sourceCommit,scope:'Independent actual captured primary vertices/full native group matrices. Positive surface-triangle edge crossings prove actual mesh intersections; no-edge-hit result is not a containment/global-clearance certificate. Proposal poses are captured original native previews, not applied live.',nativeTime:native.nativeTime,actorsUnchanged:native.actorsUnchanged,pairs:[],sourceRailProposals:[]};
for(const[ia,ib]of[[326,484],[455,472]]){const a=body(actor(ia)),b=body(actor(ib));report.pairs.push({a:ia,b:ib,aBounds:{min:a.bounds.min.toArray(),max:a.bounds.max.toArray()},bBounds:{min:b.bounds.min.toArray(),max:b.bounds.max.toArray()},...contacts(a,b.tris)});}
const proposals=native.proposals.map(p=>({p,b:body(actor(p.actorId),p.pose)})),focus=new THREE.Box3();for(const r of proposals)focus.union(r.b.bounds);
const scene=JSON.parse(zlib.gunzipSync(fs.readFileSync(folder+'/native-canonical-scene.json.gz'))),rows=[];let scanned=0,canonical=0;const selected=[];
for(const o of scene.objects){if(!/^(solid|detail|roof|road|pad) /.test(o.name)||!o.geometryId)continue;let g=scene.geometries[o.geometryId];if(!g)throw Error('Missing geometry');const bb=g.nativeBoundingBox;
 if(bb){const bounds=new THREE.Box3(new THREE.Vector3(...bb.min),new THREE.Vector3(...bb.max)).applyMatrix4(new THREE.Matrix4().fromArray(o.matrixWorld));if(!bounds.intersectsBox(focus))continue;}
 if(o.canonical?.required){if(!o.canonical.canonicalIndex)throw Error('Missing canonical static index '+o.name);const index=o.canonical.canonicalIndex;g={...g,index:{itemSize:1,count:o.canonical.sourceIndices,array:index},drawRange:{start:0,count:null,countIsUnbounded:true}};canonical++;}
 const parts=D.meshParts({geometries:{...scene.geometries,[o.geometryId]:g}},o);let kept=0;
 for(const part of parts)for(const t of D.triangles(part)){scanned++;const vertices=t.vertices.map(toV),bounds=box(vertices);if(bounds.intersectsBox(focus)){rows.push({...t,vertices,box:bounds,mesh:o.name});kept++;}}
 selected.push({name:o.name,canonical:!!o.canonical?.required,kept});
}
for(const{p,b}of proposals)report.sourceRailProposals.push({actorId:p.actorId,source:p.source,segment:p.segment,s:p.s,nativeStatic:p.physical,bodyBounds:{min:b.bounds.min.toArray(),max:b.bounds.max.toArray()},...contacts(b,rows)});
report.context={scannedTriangles:scanned,canonicalMeshes:canonical,retainedNearTriangles:rows.length,selected};
fs.writeFileSync(process.argv[2]||'/tmp/drivecv-actual-native-bodies.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pairs:report.pairs.map(p=>({a:p.a,b:p.b,positive:p.contacts.length,tests:p.tests})),proposals:report.sourceRailProposals.map(p=>({actorId:p.actorId,source:p.source,segment:p.segment,positive:p.contacts.length,tests:p.tests,first:p.contacts[0]})),context:report.context},null,2));
