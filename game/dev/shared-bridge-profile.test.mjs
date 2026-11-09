import assert from 'node:assert/strict';
import fs from 'node:fs'; import zlib from 'node:zlib';
import {compileSharedBridgeProfile} from '../src/shared-bridge-profile.js';
import {buildTramGrades,tramGradeRenderPieces} from '../src/tram-grade.js';
import {minimumTramSupportLift} from '../src/tram-body-support.js';
import {polygonArea} from '../src/bridge-profile-geometry.js';
const F=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../handoffs/fidelity/shared-bridge-profile/source-fixture.json.gz',import.meta.url))));
export function fixture(){const f=structuredClone(F),nodes=new Map();for(const e of f.edges)for(const k of ['a','b']){if(nodes.has(e[k].id))e[k]=nodes.get(e[k].id);else nodes.set(e[k].id,e[k]);}for(const n of nodes.values())n.edges=[];for(const e of f.edges){e.a.edges.push(e);e.b.edges.push(e);}return f;}
export function compile(f){return compileSharedBridgeProfile(f.data,{coreEdges:f.edges,lanePolygon:e=>f.lanes[e.id]||[],padLanePolygon:n=>f.pads[n.id]||[],padSurfacePolygon:n=>f.roadPads[n.id]||f.pads[n.id]||[]});}
const snapshot=f=>JSON.stringify({data:f.data,edges:f.edges.map(e=>({...e,a:{...e.a,edges:undefined},b:{...e.b,edges:undefined}}))});
const f=fixture(),before=snapshot(f),p=compile(f);assert.equal(p.known,true,JSON.stringify(p.report.unresolved));assert.equal(snapshot(f),before,'source geometry and original native profiles are immutable compiler inputs');
let maximumGrade=0;
for(const e of f.edges){const g=p.roadGrades.get(e.id);if(!g)continue;let old=g.heightAt(0);for(let i=1;i<=1000;i++){const y=g.heightAt(i/1000);maximumGrade=Math.max(maximumGrade,Math.abs(y-old)/e.len*1000);old=y;}}
assert(maximumGrade<=.08000001,'continuous centreline grade remains <=8%');
for(const cells of [...Object.values(p.overlaps),p.internalOverlaps,p.approachOverlaps])for(const c of cells)for(const pt of c.poly){const a=p.roadGrades.get(c.e.id),b=p.roadGrades.get(c.f.id);assert(a&&b);assert(Math.abs(a.heightAtWorld(...pt)-b.heightAtWorld(...pt))<1e-7,'actual protected fork overlaps share one surface');}
for(const makeBad of [f=>delete f.data.roadSourceNodeTagCoverage,f=>f.data.roadSourceNodeTags[984551993]={ele:'9'},f=>f.data.roadSourceNodeTags[984551993]={incline:'4%'},f=>f.data.roadSourceNodeTags[984551993]={level:'-1w'},f=>delete f.data.tramSourceNodeTags[5865238769],f=>f.edges.find(e=>e.a.sourceId===6261926625).a.y=1,f=>{const w=Object.values(f.data.roadSourceGeometry).find(w=>w.sourceId==='w119235186');w.projected[0][0]+=.1;}]){const bad=fixture();makeBad(bad);assert.equal(compile(bad).known,false,'unknown/changed source context must remain unresolved');}
// The shared support reader must use a lateral affine field, including an
// interior crest absent from the actual triangle vertices.
const poly=[[0,0],[10,0],[10,2],[0,2]],height=(x,z)=>1.2-((x+z)-5)**2/25;
const pieces=[{id:'2d-control',a:[0,0],b:[10,0],poly,top:[[0,height(0,0),0],[10,height(10,0),0],[10,height(10,2),2],[0,height(0,2),2]],modelId:'test',sourceId:'w-test',band:()=>{throw Error('unpartitioned 2D band must not be sampled')},regions:[{poly,maxTop:1.2,band:(x,z)=>({top:height(x,z)})}]}];
const fit=minimumTramSupportLift([[0,.3,0],[10,.3,0],[0,.3,1]],[0,1,2],pieces);assert(fit.known);assert(Math.abs(fit.liftM-.9)<1e-10);
const roadIndex=new Map(Object.entries(f.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)]));const E=f.edges.map(e=>({...e,road:roadIndex.get(e.sourceId)??-1}));
const g=buildTramGrades(f.data,{coreEdges:E,sharedProfile:p});
let piecesChecked=0,maxPolynomialError=0,maxRegionAreaError=0,changedRailLegs=0;
for(const [id,grade]of g.grades){if(!grade.sourceBridgeModelId)continue;changedRailLegs++;const split=id.lastIndexOf(':'),way=f.data.tramSourceWays.find(w=>w.sourceId===id.slice(0,split)),index=Number(id.slice(split+1)); const {decodeTramPoints}=await import('../src/tram-path.js');const xy=decodeTramPoints(way.points,f.data.q);
 for(const piece of tramGradeRenderPieces(xy[index],xy[index+1],grade)){const ar=polygonArea(piece.top.map(v=>[v[0],v[2]])),sum=piece.regions.reduce((s,r)=>s+polygonArea(r.poly),0);maxRegionAreaError=Math.max(maxRegionAreaError,Math.abs(ar-sum));assert(Math.abs(ar-sum)<1e-5,'complete continuous field region coverage');for(const r of piece.regions){for(const pt of r.poly){const exact=grade.heightAtWorld(...pt)+.2,actual=r.band(...pt).top;maxPolynomialError=Math.max(maxPolynomialError,Math.abs(exact-actual));}}piecesChecked++; }
}
assert(changedRailLegs>0);assert(maxPolynomialError<1e-7);
console.log(JSON.stringify({passed:true,source:F.source,changedRoadEdges:p.roadGrades.size,changedRailLegs,piecesChecked,maximumGrade,maxPolynomialError,maxRegionAreaError,model:p.report,scope:'Exact immutable native lane/pad/source fixture and continuous support algebra only; no new native render/drive or all-fleet physical acceptance.'},null,2));
