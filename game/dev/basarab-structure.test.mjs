import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';
import {compileSharedBridgeProfile} from '../src/shared-bridge-profile.js';
import {buildTramGrades} from '../src/tram-grade.js';
import {buildBasarabStructure} from '../src/basarab-structure.js';
import {BASARAB_PLATFORMS} from '../src/basarab-source.js';
import {MeshBuilder} from '../src/geobuild.js';
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../handoffs/fidelity/shared-bridge-profile/source-fixture.json.gz',import.meta.url))));
const nodes=new Map();for(const e of f.edges)for(const k of ['a','b']){if(nodes.has(e[k].id))e[k]=nodes.get(e[k].id);else nodes.set(e[k].id,e[k]);}for(const n of nodes.values())n.edges=[];for(const e of f.edges){e.a.edges.push(e);e.b.edges.push(e);}
const profile=compileSharedBridgeProfile(f.data,{coreEdges:f.edges,lanePolygon:e=>f.lanes[e.id]||[],padLanePolygon:n=>f.pads[n.id]||[],padSurfacePolygon:n=>f.roadPads[n.id]||f.pads[n.id]||[]});assert(profile.known);
const roadIndex=new Map(Object.entries(f.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)]));
const E=f.edges.map(e=>{e={...e,road:roadIndex.get(e.sourceId)??-1};const g=profile.roadGrades.get(e.id);return g?{...e,ya:g.ya,yb:g.yb,a:{...e.a,y:g.ya},b:{...e.b,y:g.yb},sourceBridgeGrade:g}:e;});
const grades=buildTramGrades(f.data,{coreEdges:E,sharedProfile:profile});
// Fixtures retain their native source dataset, including its actual district.
const cell={solid:new MeshBuilder()},input={...f.data,city:'bucharest',district:{id:'grozavesti'}},before=JSON.stringify(f.data),result=buildBasarabStructure(input,grades,()=>cell);
assert.equal(JSON.stringify(f.data),before,'all source records remain exact');assert(result.report.active);assert.equal(result.report.sourcePlatforms.length,2);assert(result.report.gapPieces>0);
for(const piece of result.pieces){assert(piece.triangles.length>0);for(const tri of piece.triangles){const x=tri.reduce((s,p)=>s+p[0],0)/3,z=tri.reduce((s,p)=>s+p[2],0)/3,y=tri.reduce((s,p)=>s+p[1],0)/3;assert(Math.abs(piece.roofHeightAt(x,z)-y)<1e-6,'support height is the actual rendered triangle plane');}}
for(const p of BASARAB_PLATFORMS){const piece=result.pieces.find(q=>q.sourceId===p.sourceId);assert.deepEqual(piece.poly,p.points.map(q=>q.map(Math.fround)),'literal platform outline preserved');}
assert.equal(result.report.superstructure.stays,60);assert.equal(result.report.superstructure.pylonHeightM,80);assert.equal(result.report.superstructure.archSpanM,120);
console.log(JSON.stringify({passed:true,platforms:result.report.sourcePlatforms,gapPieces:result.report.gapPieces,triangles:cell.solid.ic/3,scope:'Geometry/compiler fixture only; native route, eyes and full physical clearance remain unaccepted.'}));
