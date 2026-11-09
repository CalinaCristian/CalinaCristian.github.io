import assert from 'node:assert/strict';
import {loadFixture,compileFixture,corners,shoulder} from '../../handoffs/fidelity/shared-bridge-profile/replay-geometry.mjs';
import {sharedBridgePadSurface} from '../src/bridge-pad-profile.js';
import {displaceBridgeSurface} from '../src/bridge-surface-mesh.js';
import {MeshBuilder} from '../src/geobuild.js';
import {polygonArea} from '../src/bridge-profile-geometry.js';
import {inferredBridgeFasciaUpstand,bridgeJunctionSlab} from '../src/bridge-junction.js';
import {buildTramGrades} from '../src/tram-grade.js';
import {emittedTramClearance} from '../src/tram-clearance.js';
import {Traffic} from '../src/traffic.js';
import {makeVehicle} from '../src/vehicles.js';
const F=loadFixture(),plan=compileFixture(F);assert(plan.known,JSON.stringify(plan.report.unresolved));
for(const e of F.edges){const g=plan.roadGrades.get(e.id);if(g){e.sourceBridgeGrade=g;e.a.y=g.ya;e.b.y=g.yb;}}
for(const e of F.edges){e.ya=e.a.y;e.yb=e.b.y;}
const along=(e,p)=>e.sourceBridgeGrade?.heightAtWorld(...p)??e.ya+(e.yb-e.ya)*Math.max(0,Math.min(1,((p[0]-e.a.x)*e.dirx+(p[1]-e.a.z)*e.dirz)/e.len));
let padCount=0,maxNodeError=0,maxAreaError=0;const padRows=[];
for(const [id,P]of Object.entries(F.roadPads)){const es=F.edges.filter(e=>e.a.id==id||e.b.id==id),n=es[0]?.a.id==id?es[0].a:es[0]?.b;if(!n||!es.some(e=>e.sourceBridgeGrade))continue;const field=sharedBridgePadSurface(n,P,es,along);assert(field);const expected=n.y;plan.bindPadSurface(n,field);if(field.sourceNodeInside)maxNodeError=Math.max(maxNodeError,Math.abs(field.heightAtWorld(n.x,n.z)-expected));const ar=field.topTriangles.reduce((a,t)=>a+polygonArea(t.map(p=>[p[0],p[2]])),0);maxAreaError=Math.max(maxAreaError,Math.abs(ar-polygonArea(P)));assert(maxNodeError<2e-5);assert(Math.abs(ar-polygonArea(P))<.001,JSON.stringify({node:n.sourceId,nativeId:n.id,fanArea:ar,hullArea:polygonArea(P),delta:ar-polygonArea(P),poly:P}));padRows.push({sourceNodeId:n.sourceId,hullAreaM2:polygonArea(P),triangles:field.topTriangles.length,sourceModelHeightM:n.y});padCount++;}
assert(padCount>=7);
let inputTriangles=0,outputTriangles=0,maxControlErrorM=0,depthLimit=0;
for(const e of F.edges){if(!e.sourceBridgeGrade)continue;const poly=corners(e,(f,s)=>(s>0?f.wR:f.wL)+shoulder(f)),mb=new MeshBuilder();mb.flatQuad(-100,-100,-99,-100,-99,-99,-100,-99,.24,[80,80,80]);const prefixP=Array.from(mb.p.subarray(0,mb.vc*3)),prefixI=Array.from(mb.i.subarray(0,mb.ic)),v0=mb.vc,i0=mb.ic;mb.flatQuad(...poly.flat(),.24,[90,90,90]);const a=displaceBridgeSurface(mb,v0,i0,(x,z)=>e.sourceBridgeGrade.heightAtWorld(x,z));assert.deepEqual(Array.from(mb.p.subarray(0,prefixP.length)),prefixP);assert.deepEqual(Array.from(mb.i.subarray(0,prefixI.length)),prefixI);inputTriangles+=a.inputTriangles;outputTriangles+=a.outputTriangles;maxControlErrorM=Math.max(maxControlErrorM,a.maxLeafControlErrorM);depthLimit+=a.depthLimit;}
// A deliberately insufficient finite subdivision budget must stay a reported
// failure, including exact serialized vertices and material records.
const limitedEdge=F.edges.find(e=>e.id===999),limitedMesh=new MeshBuilder();limitedMesh.flatQuad(...corners(limitedEdge,(f,s)=>(s>0?f.wR:f.wL)+shoulder(f)).flat(),.24,[9,8,7]);const limited=displaceBridgeSurface(limitedMesh,0,0,(x,z)=>limitedEdge.sourceBridgeGrade.heightAtWorld(x,z),{maxDepth:2});assert(limited.depthLimit>0&&limited.limitSamples.length>0&&limited.maxLeafControlErrorM>.002);assert(limited.limitSamples.every(s=>s.vertices.length===3&&s.vertices.every(v=>v.color.length===3&&v.position.every(Number.isFinite))));
assert.equal(depthLimit,0);assert(maxControlErrorM<=.002+1e-12);
const dataIndex=new Map(Object.entries(F.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)])),G=buildTramGrades(F.data,{coreEdges:F.edges.map(e=>({...e,road:dataIndex.get(e.sourceId)??-1})),sharedProfile:plan}),envelope=emittedTramClearance(makeVehicle);
const fasciaEdge=F.edges.find(e=>e.id===1509),fasciaPoly=corners(fasciaEdge,(f,s)=>(s>0?f.wR:f.wL)+shoulder(f)+(s>0?f.sidewalkRightM:f.sidewalkLeftM)),options={grades:G,envelope},lipResults=[[0,1],[2,3]].map(([a,b])=>inferredBridgeFasciaUpstand(fasciaEdge,fasciaPoly[a],fasciaPoly[b],options));
assert(lipResults.includes(0),'confirmed actual mesh lip contact is flushed');
for(const patch of [{roadWidthSource:{source:'OSM width',raw:'7'}},{sidewalkSource:{explicit:true}},{sourceBridgeGrade:null}]){const e={...fasciaEdge,...patch};assert.equal(inferredBridgeFasciaUpstand(e,fasciaPoly[0],fasciaPoly[1],options),.05,'mapped dimensions or missing source model retain default');}
assert.equal(inferredBridgeFasciaUpstand(fasciaEdge,fasciaPoly[0].map(v=>v+1000),fasciaPoly[1].map(v=>v+1000),options),.05,'unrelated actual outer edges retain lip');
const field=plan.padHeightAt(F.edges.find(e=>e.a.sourceId===6261926625).a,467.8774,-662.5134);assert(Math.abs(field-1.4)<1e-5,'shared splitter query follows actual rendered fan');
// Retracted mouths use their own XY field height, not source-node endpoint Y.
const retracted=F.edges.find(e=>e.sourceId==='w119235186'&&e.b.pad&&e.sourceBridgeGrade),Pmouth=corners(retracted,(e,s)=>(s>0?e.wR:e.wL)+shoulder(e));
let structuralErrorM=0;for(const base of [.24,-.86]){const m=new MeshBuilder();m.flatQuad(...Pmouth.flat(),base,[80,80,80]);displaceBridgeSurface(m,0,0,(x,z)=>retracted.sourceBridgeGrade.heightAtWorld(x,z));for(let i=0;i<m.vc;i++){const x=m.p[i*3],z=m.p[i*3+2],error=Math.abs(m.p[i*3+1]-base-retracted.sourceBridgeGrade.heightAtWorld(x,z));structuralErrorM=Math.max(structuralErrorM,error);}}assert(structuralErrorM<2e-6,'slab/pad mouth heights consume the same field after retraction');
// Actual ordinary fleet placement consumes a lateral 2D field only when marked;
// the scalar-only native road pose and every horizontal pose remain unchanged.
const T=Object.create(Traffic.prototype),mesh=makeVehicle('truck',undefined,{city:'bucharest',instanced:true}),edge=F.edges.find(e=>e.id===767),vehicle=()=>({edge,dir:1,s:14,mesh,kind:'truck',long:true,length:mesh.userData.length,width:mesh.userData.width,route:[],hist:[],speed:0,lane:1,laneCur:1,latExtraCur:0,lateralExtra:0,latBlend:0,y:.24});
const a=vehicle();T.placeOnLane(a,true,0);const oldPose={x:a.x,y:a.y,z:a.z,heading:a.heading,pitch:mesh.rotation.x};assert.equal(a.y,.24);assert.equal(mesh.rotation.x,0);
edge.sourceBridgeGrade={known:true,modelId:'2d-reader-control',heightAtWorld:(x,z)=>.04*x+.02*z};T.world={roadHeight:(x,z)=>.24+.04*x+.02*z};const b=vehicle();T.placeOnLane(b,true,0);assert.equal(b.x,oldPose.x);assert.equal(b.z,oldPose.z);assert.equal(b.heading,oldPose.heading);assert(Math.abs(b.y-(.24+.04*b.x+.02*b.z))<1e-12);const Fp=T.pathPoint(b,b.length*.36,{}),Rp=T.pathPoint(b,-b.length*.36,{}),expectedPitch=Math.atan((.04*(Fp.x-Rp.x)+.02*(Fp.z-Rp.z))/Math.hypot(Fp.x-Rp.x,Fp.z-Rp.z));assert(Math.abs(mesh.rotation.x-expectedPitch)<1e-12);delete edge.sourceBridgeGrade;
console.log(JSON.stringify({passed:true,padCount,maxNodeError,maxAreaError,padRows,inputTriangles,outputTriangles,maxControlErrorM,depthLimit,legacyOrdinaryPose:oldPose,lipResults,structuralErrorM,scope:'Exact source pad/miter fixture, Float32 mesh/query fan and bounded sampled chord controls; actual ordinary Traffic2D reader. Fresh native constructor/fullworld/drive/images remain required.'},null,2));
