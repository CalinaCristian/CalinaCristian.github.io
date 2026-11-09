import fs from 'node:fs';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import * as THREE from '../../../../game/vendor/three.module.min.js';
import {triangleContact} from './contact-kernel.mjs';
const require=createRequire(import.meta.url),D=require('./native-raw-decoder.cjs'),[dir,out]=process.argv.slice(2),inputs=[];
if(!dir||!out||fs.existsSync(out))throw Error('INPUT_DIRECTORY NEW_OUTPUT required');
const hash=b=>createHash('sha256').update(b).digest('hex'),load=(name)=>{const b=fs.readFileSync(dir+'/'+name),raw=name.endsWith('.gz')?zlib.gunzipSync(b):b;inputs.push({name,bytes:b.length,sha256:hash(b),rawBytes:raw.length,rawSHA256:hash(raw)});return JSON.parse(raw);};
const scene=load('native-canonical-before-drive.json.gz'),facts=load('constructor-facts.json.gz'),reasons=load('tram490-all-source-candidate-reasons.json'),world=load('native-world-before-drive.json.gz');
const snapshot=facts.snapshots.at(-1),actor=snapshot.active.concat(snapshot.pool).find(v=>v.id===490),candidate=reasons.rows.find(r=>r.nativeAttempted),pose=candidate.pose;
const matrix=new THREE.Matrix4().compose(new THREE.Vector3(pose.x,pose.y,pose.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,pose.heading,pose.roll,'YXZ')),new THREE.Vector3().fromArray(actor.meshPose.scale));
const bodyPart=D.geometryPart(facts.geometryCatalog[actor.model.primaryGeometryId],matrix.toArray()),body=[...D.triangles(bodyPart)];
const pole=candidate.matchingQueriedColliders.find(c=>c.index===30374).primitive,center=[pole.x,1.5,pole.z],radius=.7;
const bbox=vs=>({min:[0,1,2].map(i=>Math.min(...vs.map(v=>v[i]))),max:[0,1,2].map(i=>Math.max(...vs.map(v=>v[i])))}),near=vs=>{const b=bbox(vs);return b.min[0]<=pole.x+radius&&b.max[0]>=pole.x-radius&&b.min[2]<=pole.z+radius&&b.max[2]>=pole.z-radius&&b.min[1]<=3.5&&b.max[1]>=0;};
const bodyNear=body.filter(t=>near(t.vertices)),native=[],unknown=[],canonical=[];
for(const object of scene.objects){
 if(object.isInstancedMesh||!object.geometryId||!/^((solid|signs|detail|ground|road|junction|roof) )/.test(object.name))continue;
 const g=scene.geometries[object.geometryId],cc=object.canonical;let geometry=g;
 if(cc?.required){
  if(!cc.canonicalCapture?.captured||!cc.canonicalCapture?.restored||!Object.values(cc.canonicalCapture.restoration||{}).every(Boolean)){unknown.push({object:object.name,reason:'unknown-native-canonical-topology'});continue;}
  const record=cc.canonicalIndex;if(record.length!==cc.canonicalCapture.sourceIndices)throw Error('Canonical count mismatch');
  geometry={...g,index:{array:record,itemSize:1,count:record.length,normalized:false},drawRange:cc.canonicalDrawRange};canonical.push({object:object.name,sourceIndices:record.length,restored:true});
 }
 const part=D.geometryPart(geometry,object.matrixWorld);
 for(const t of D.triangles(part,{respectDrawRange:true}))if(near(t.vertices))native.push({...t,object:object.name,objectUuid:object.uuid,geometryId:object.geometryId,materials:object.materials,renderOrder:object.renderOrder});
}
const contacts=[];
for(const w of native)for(const b of bodyNear){const hit=triangleContact(w.vertices,b.vertices);if(hit)contacts.push({object:w.object,objectUuid:w.objectUuid,geometryId:w.geometryId,nativeTriangle:w.triangle,bodyTriangle:b.triangle,point:hit.point,coplanar:hit.coplanar,worldVertices:w.vertices,bodyVertices:b.vertices,materials:w.materials,renderOrder:w.renderOrder});}
const worldKeys=Object.keys(world),edges=world.allEdges||world.edges||world.graph?.edges||[],primitive=[];
const all=Array.isArray(edges)?edges:[];
for(const e of all){
 if(!e.a||!e.b||![e.dirx,e.dirz,e.nx,e.nz,e.len,e.wL,e.wR].every(Number.isFinite))continue;
 const along=(pole.x-e.a.x)*e.dirx+(pole.z-e.a.z)*e.dirz,lat=(pole.x-e.a.x)*e.nx+(pole.z-e.a.z)*e.nz;
 const tags=world.data?.roadSourceGeometry?.[e.road]?.tags||{},width=e.roadWidthSource||{},shoulder=width.source==='OSM width'||width.review?0:/motorway|trunk/.test(e.type)?e.type.endsWith('_link')?.6:1.2:.15;
 for(const side of [1,-1]){const w=(side>0?e.wR:e.wL)+shoulder,o=e.sidewalk>=1.2?w+Math.min(.6,e.sidewalk*.4):w+.7,error=Math.abs(lat-side*o);if(error>1e-6||along<0||along>e.len)continue;
  primitive.push({edgeId:e.id,road:e.road,sourceId:world.data?.roadSourceGeometry?.[e.road]?.sourceId,name:e.name,alongM:along,side,errorM:error,x:e.a.x+e.dirx*along+e.nx*o*side,z:e.a.z+e.dirz*along+e.nz*o*side,offsetM:o,dirx:e.dirx,dirz:e.dirz,nx:e.nx,nz:e.nz,sidewalkScalar:e.sidewalk,nativeSidewalkWidth:e.nativeSidewalkWidth,sidewalkLeftM:e.sidewalkLeftM,sidewalkRightM:e.sidewalkRightM,sidewalkSource:e.sidewalkSource,sourceTags:tags,a:e.a,b:e.b,len:e.len,wL:e.wL,wR:e.wR,type:e.type,oneway:e.oneway});
 }
}
const owner=primitive.find(p=>p.oneway&&p.b.edgeIds?.length>=3&&Math.abs(p.alongM-(p.len-Math.min(p.b.radius,p.len*.45)-2.5))<1e-7);
let unit=null;
if(owner){
 const ang=Math.atan2(owner.dirx,owner.dirz),y0=.15,post=[];
 for(const x of [-.035,.035])for(const y of [y0,y0+2.3])for(const z of [-.035,.035])post.push([Math.fround(pole.x+Math.cos(ang)*x+Math.sin(ang)*z),Math.fround(y),Math.fround(pole.z-Math.sin(ang)*x+Math.cos(ang)*z)]);
 const plates=[];for(const[side,thick]of[[1,.06],[-1,.04]]){const fx=Math.sin(ang)*side,fz=Math.cos(ang)*side,cx=pole.x+fx*thick,cz=pole.z+fz*thick,points=[];for(const across of [-.375,.375])for(const y of [y0+2-.375,y0+2+.375])points.push([Math.fround(cx+fz*across),Math.fround(y),Math.fround(cz-fx*across)]);plates.push({side,thick,points});}
 const matches=(triangle,points)=>triangle.vertices.every(v=>points.some(p=>v.every((n,i)=>Math.abs(n-p[i])<1e-6)));
 const selected=native.filter(t=>matches(t,post)||plates.some(p=>matches(t,p.points)));
 unit={creator:'World.placeSign procedural road-sign unit',sourceId:owner.sourceId,edgeId:owner.edgeId,road:owner.road,icon:'no-entry',call:{along:owner.alongM,side:-1,faceSign:1},nativeSidewalkWidth:owner.nativeSidewalkWidth,rawSidewalk:owner.sourceTags.sidewalk,post:{baseY:y0,topY:y0+2.3,width:.07,depth:.07,expectedFloat32Corners:post},plates:{width:.75,height:.75,centreY:y0+2,frontOffset:.06,backOffset:.04,expectedFloat32:plates},exactUnitTriangles:selected.map(t=>({object:t.object,triangle:t.triangle,vertices:t.vertices,materials:t.materials})),postTriangles:selected.filter(t=>matches(t,post)).length,plateTriangles:selected.filter(t=>plates.some(p=>matches(t,p.points))).length};
}
const result={sourceCommit:reasons.sourceCommit,scope:'Independent CPU actual preview Imperio primary triangles versus fresh canonical emitted world triangles around the recorded first rejected sign collider. This is candidate rejection attribution, not admitted motion/publication, whole-world collision acceptance or source removal authority.',inputs,candidate:{sourceId:candidate.sourceId,edgeId:candidate.edgeId,nodeIds:candidate.sourceNodeIds,dir:candidate.dir,s:candidate.s,pose,grade:candidate.grade},body:{kind:actor.kind,vertices:bodyPart.positions.count,triangles:body.length,nearTriangles:bodyNear.length,geometryId:actor.model.primaryGeometryId,scale:actor.meshPose.scale,parentChain:actor.parentChain.map(p=>({type:p.type,name:p.name,position:p.position,quaternion:p.quaternion,scale:p.scale}))},collider:{index:30374,...pole},actualNearbyTriangles:native.length,nativeNearbyTriangles:native,sourceUnit:unit,canonical,unknown,contacts,signSourceCandidates:primitive,worldKeys,edgeCount:all.length};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,bodyTriangles:body.length,bodyNear:bodyNear.length,nativeNear:native.length,contacts:contacts.length,groups:[...new Set(contacts.map(r=>r.object))],sourceMatches:primitive.map(p=>({edge:p.edgeId,sourceId:p.sourceId,along:p.alongM,side:p.side})),unknown}));
