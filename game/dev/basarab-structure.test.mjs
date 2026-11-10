import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';
import {compileSharedBridgeProfile} from '../src/shared-bridge-profile.js';
import {buildTramGrades} from '../src/tram-grade.js';
import {buildBasarabStructure,bridgePrismCollider} from '../src/basarab-structure.js';
import {collideBuildings} from '../src/world.js';
import {BASARAB_PLATFORMS} from '../src/basarab-source.js';
import {MeshBuilder} from '../src/geobuild.js';
import {clipConvex,polygonArea} from '../src/bridge-profile-geometry.js';
import {emittedTramClearance} from '../src/tram-clearance.js';
import {makeVehicle} from '../src/vehicles.js';
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../handoffs/fidelity/shared-bridge-profile/source-fixture.json.gz',import.meta.url))));
const nodes=new Map();for(const e of f.edges)for(const k of ['a','b']){if(nodes.has(e[k].id))e[k]=nodes.get(e[k].id);else nodes.set(e[k].id,e[k]);}for(const n of nodes.values())n.edges=[];for(const e of f.edges){e.a.edges.push(e);e.b.edges.push(e);}
const profile=compileSharedBridgeProfile(f.data,{coreEdges:f.edges,lanePolygon:e=>f.lanes[e.id]||[],padLanePolygon:n=>f.pads[n.id]||[],padSurfacePolygon:n=>f.roadPads[n.id]||f.pads[n.id]||[]});assert(profile.known);
const roadIndex=new Map(Object.entries(f.data.roadSourceGeometry).map(([i,w])=>[w.sourceId,Number(i)]));
const E=f.edges.map(e=>{e={...e,road:roadIndex.get(e.sourceId)??-1};const g=profile.roadGrades.get(e.id);return g?{...e,ya:g.ya,yb:g.yb,a:{...e.a,y:g.ya},b:{...e.b,y:g.yb},sourceBridgeGrade:g}:e;});
// This older road-profile fixture retained clipped rail runs. Use the current
// complete literal runs for clearance, including the station north of x620.
const nativeData=JSON.parse(fs.readFileSync(new URL('../data/bucharest-grozavesti.json',import.meta.url)));
const gradeData={...f.data,trams:nativeData.trams,tramSources:nativeData.tramSources};
const grades=buildTramGrades(gradeData,{coreEdges:E,sharedProfile:profile});
assert(grades.corridors.some(c=>c.sourceId==='w118416425'&&c.a[0]>700),'clearance includes the complete station rail run');
const envelope=emittedTramClearance(makeVehicle,'bucharest');
const roadHeight=(e,x,z)=>{if(e.sourceBridgeGrade?.known)return.24+e.sourceBridgeGrade.heightAtWorld(x,z);const t=Math.max(0,Math.min(1,((x-e.a.x)*(e.b.x-e.a.x)+(z-e.a.z)*(e.b.z-e.a.z))/e.len**2));return.24+e.ya+(e.yb-e.ya)*t;};
const region=(poly,id,heights)=>({id,poly,minY:Math.min(...heights),maxY:Math.max(...heights),x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),z0:Math.min(...poly.map(p=>p[1])),z1:Math.max(...poly.map(p=>p[1]))});
const roadRegions=E.filter(e=>f.lanes[e.id]).map(e=>{const poly=f.lanes[e.id];return region(poly,'edge:'+e.id,poly.map(p=>roadHeight(e,...p)));}).filter(r=>r.maxY>1);
for(const[id,poly]of Object.entries(f.roadPads||{})){
 const inc=E.filter(e=>e.a.id===Number(id)||e.b.id===Number(id));if(!inc.length)continue;
 const ys=poly.map(([x,z])=>{let best=null,d=Infinity;for(const e of inc){const t=Math.max(0,Math.min(1,((x-e.a.x)*(e.b.x-e.a.x)+(z-e.a.z)*(e.b.z-e.a.z))/e.len**2)),q=Math.hypot(x-e.a.x-(e.b.x-e.a.x)*t,z-e.a.z-(e.b.z-e.a.z)*t);if(q<d){d=q;best=e;}}return roadHeight(best,x,z);});
 const r=region(poly,'pad:'+id,ys);if(r.maxY>1)roadRegions.push(r);
}
// Fixtures retain their native source dataset, including its actual district.
const supportAt=(x,z,base)=>{let top=null;for(const e of E){const t=((x-e.a.x)*e.dirx+(z-e.a.z)*e.dirz)/e.len;if(t<0||t>1)continue;const lat=(x-e.a.x)*e.nx+(z-e.a.z)*e.nz,side=lat>=0?1:-1,shoulder=e.roadWidthSource&&(e.roadWidthSource.source==='OSM width'||e.roadWidthSource.review)?0:/motorway|trunk/.test(e.type)?e.type.endsWith('_link')?.6:1.2:.15,limit=(side>0?e.wR:e.wL)+shoulder+((side>0?e.sidewalkRightM:e.sidewalkLeftM)??e.sidewalk??0);if(Math.abs(lat)>limit)continue;const h=roadHeight(e,x,z);if(Math.abs(h-base)<.3)top=h;}return top;};
const cell={solid:new MeshBuilder()},input={...f.data,city:'bucharest',district:{id:'grozavesti'}},before=JSON.stringify(f.data),result=buildBasarabStructure(input,grades,()=>cell,null,E,{roadRegions,tramEnvelope:envelope,supportAt});
assert.equal(JSON.stringify(f.data),before,'all source records remain exact');assert(result.report.active);assert.equal(result.report.sourcePlatforms.length,2);assert(result.report.gapPieces>0);
for(const piece of result.pieces){assert(piece.triangles.length>0);for(const tri of piece.triangles){const x=tri.reduce((s,p)=>s+p[0],0)/3,z=tri.reduce((s,p)=>s+p[2],0)/3,y=tri.reduce((s,p)=>s+p[1],0)/3;assert(Math.abs(piece.roofHeightAt(x,z)-y)<1e-6,'support height is the actual rendered triangle plane');}}
for(const p of BASARAB_PLATFORMS){const piece=result.pieces.find(q=>q.sourceId===p.sourceId);assert.deepEqual(piece.poly,p.points.map(q=>q.map(Math.fround)),'literal platform outline preserved');}
assert.deepEqual(result.report.superstructure.riverSourceIds,['w458458361','w1552024280']);assert.equal(result.report.superstructure.stays,60);assert.equal(result.report.superstructure.pylonHeightM,80);assert.equal(result.report.superstructure.archSpanM,120);
// Replay the native lane/pad polygons and full emitted tram envelope. Merely
// admitting the initial actor placements missed pylons blocking future routes.
const pylons=result.colliders.filter(c=>c.kind==='basarab-pylon');
assert.equal(pylons.length,2);
for(const c of pylons){
 for(const e of E){const lane=f.lanes[e.id];if(lane)assert(polygonArea(clipConvex(c.poly,lane))<1e-6,'pylon clears the complete native lane polygon '+e.id);}
 for(const [id,pad]of Object.entries(f.roadPads||{}))assert(polygonArea(clipConvex(c.poly,pad))<1e-6,'pylon clears source junction pad '+id);
 assert.equal(grades.excludesInferredObstacle([c.x,c.z],[c.x,c.z],{inferred:true,radiusM:c.r,bodyEnvelope:envelope,y0a:c.y0,y1a:c.y1}),false,'pylon clears the full native tram envelope');
}
// Negative control: the rejected roof-width spacing has9m² of lane conflict
// per leg. Keep that regression visible independently of constructor placement.
const axis=[pylons[1].x-pylons[0].x,pylons[1].z-pylons[0].z],spacing=Math.hypot(...axis),oldOffset=result.report.superstructure.roofWidthM/2+1.8;
for(let i=0;i<2;i++){const c=pylons[i],sign=i?1:-1,delta=oldOffset-spacing/2,poly=c.poly.map(p=>[p[0]+sign*axis[0]/spacing*delta,p[1]+sign*axis[1]/spacing*delta]);assert(E.some(e=>f.lanes[e.id]&&polygonArea(clipConvex(poly,f.lanes[e.id]))>8),'negative control detects the original obstructing pylon');}
const q=Math.SQRT1_2,sloping=bridgePrismCollider([0,12,0],[[q,q,0],[-q,q,0],[0,0,1]],[10,.5,.5],'test-sloped-arch');
assert.equal(collideBuildings([sloping],0,0,.3,.24,2),null,'cars pass below a sloped member instead of hitting its full vertical AABB');
assert(collideBuildings([sloping],0,0,.3,11.8,.4),'a drone touching the same member collides');
assert.equal(collideBuildings([sloping],0,0,.3,14,1),null,'the space above the member is clear');
assert(Math.abs(sloping.roofHeightAt(0,0)-12-.5/q)<1e-7,'vertical solid intersection has the actual sloped upper face');
assert.equal(sloping.roofHeightAt(20,0),null,'a finite member does not create an infinite roof plane');
const glazing=result.colliders.filter(c=>c.kind==='basarab-station-glazing');assert.equal(glazing.length,240,'every visible station glass pane has its own finite physical shell');
for(const c of glazing){const bottom=c.minHeightAt(c.x,c.z),top=c.roofHeightAt(c.x,c.z);assert(top>bottom&&top-bottom<.4);assert(collideBuildings([c],c.x,c.z,.15,(top+bottom)/2,.1),'native collision detects the pane at its actual height');assert.equal(collideBuildings([c],c.x,c.z,.15,bottom-3,1),null,'native collision leaves the space below the pane clear');}
assert(result.colliders.some(c=>c.kind==='basarab-river-arch'));
assert.equal(result.colliders.filter(c=>c.kind==='basarab-stay').length,result.report.superstructure.emittedStays);
assert.equal(result.report.superstructure.emittedStays+result.report.superstructure.anchorUnresolved.length,60,'all source stays are either safely emitted or explicitly unresolved; full acceptance separately requires60/0');
let stationTramChecks=0;
for(const c of grades.corridors.filter(c=>['w118416425','w205971103'].includes(c.sourceId))){for(const t of[0,.25,.5,.75,1]){
 const x=c.a[0]+(c.b[0]-c.a[0])*t,z=c.a[1]+(c.b[1]-c.a[1])*t;if(x<690||x>840||z< -1040||z> -900)continue;
 const y=.24+c.heightAt(t),hit=collideBuildings(result.colliders,x,z,envelope.halfWidthM,y+envelope.tiltedMinY,envelope.tiltedMaxY-envelope.tiltedMinY);
 assert.equal(hit,null,'the station roof/stays leave the complete pitched native tram envelope clear at '+[x,z]);stationTramChecks++;
}}
assert(stationTramChecks>30,'the physical review exercises the entire literal station tram runs');
console.log(JSON.stringify({passed:true,platforms:result.report.sourcePlatforms,gapPieces:result.report.gapPieces,emittedStays:result.report.superstructure.emittedStays,unresolvedAnchors:result.report.superstructure.anchorUnresolved,triangles:cell.solid.ic/3,scope:'Safety/compiler fixture only;60safe stays/0unresolved, native routes, eyes and full physical clearance remain separate acceptance requirements.'}));
