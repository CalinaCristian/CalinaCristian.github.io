import fs from'node:fs';import{loadFixture,compileFixture}from'../shared-bridge-profile/replay-geometry.mjs';import{SHARED_BRIDGE_MODELS}from'../../../game/src/shared-bridge-models.js';import{buildTramGrades}from'../../../game/src/tram-grade.js';
export function newRailContext(newDataFile){const F=loadFixture(),model=structuredClone(SHARED_BRIDGE_MODELS[0]);
F.data=JSON.parse(fs.readFileSync(newDataFile));
const updatedPlan=compileFixture(F,model);
if(!updatedPlan.known)throw Error(JSON.stringify(updatedPlan.report.unresolved));

const bySource=new Map(Object.entries(F.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)]));
const native={data:F.data,allEdges:F.edges.map(e=>({...e,road:bySource.get(e.sourceId)??-1})),sourceCommit:F.source},gradeRoot='current-worker',nativeFile='source-fixture.json.gz',bytes=fs.readFileSync(new URL('../shared-bridge-profile/source-fixture.json.gz',import.meta.url));
// Actual new compiled source geometry; its heights are explicitly prospective
// MODEL0, not an observation of the future native World solver.
const groundSource='w23554680',groundRoad=bySource.get(groundSource);
if(!native.allEdges.some(e=>e.sourceId===groundSource)&&groundRoad!=null){
 const row=native.data.roads[groundRoad],ids=row.slice(10),sourceNodes=new Map(native.allEdges.flatMap(e=>[e.a,e.b]).filter(n=>n.sourceId>0).map(n=>[n.sourceId,n]));let nextId=900000;
 const N=ids.map(i=>{const sourceId=native.data.roadNodeIds[i],x=native.data.roadNodePositions[i*2],z=native.data.roadNodePositions[i*2+1],old=sourceNodes.get(sourceId);if(old){if(Math.abs(old.y)>1e-8||Math.hypot(old.x-x,old.z-z)>1e-6)throw Error('Prospective ground anchor conflicts with old native source node');return old;}const n={id:nextId++,sourceId,x,z,y:0,radius:4,edges:[]};sourceNodes.set(sourceId,n);return n;});
 for(let i=1;i<N.length;i++){const a=N[i-1],b=N[i],len=Math.hypot(b.x-a.x,b.z-a.z),dirx=(b.x-a.x)/len,dirz=(b.z-a.z)/len,e={id:nextId++,a,b,len,dirx,dirz,nx:-dirz,nz:dirx,sourceId:groundSource,road:groundRoad,type:native.data.classes[row[1]],oneway:!!(row[8]&1),bridge:!!(row[8]&2),tunnel:!!(row[8]&4),layer:row[9],lanesF:row[2],lanesB:row[3],laneW:row[5]/10,median:row[4]/10,wR:3.5,wL:3.5,ya:0,yb:0,publicDrive:true,fixtureBasis:'Actual compiled source road geometry with prospective ground0; not native profile'};native.allEdges.push(e);a.edges.push(e);b.edges.push(e);}
}
const grade=buildTramGrades(native.data,{coreEdges:native.allEdges,sharedProfile:updatedPlan}),nodes=[...new Map(native.allEdges.flatMap(e=>[e.a,e.b]).map(n=>[n.id,n])).values()];

return{native,grade,nodes};}
