#!/usr/bin/env node
// A compiler replay of one proposed pose. No world/browser/runtime acceptance.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import crypto from 'node:crypto';import {createRequire}from'node:module';import{pathToFileURL}from'node:url';
import {triangleContact} from './body-checks.js';
const args={};for(let i=2;i<process.argv.length;i++)if(process.argv[i].startsWith('--'))args[process.argv[i].slice(2)]=process.argv[++i];
if(!args.dir||!args.sweep||!args.compiler||!args.out)throw Error('--dir QA_EXPORT --sweep GROZ_SWEEP --compiler CANDIDATE_WORKTREE --out NEW_REPORT required');
if(fs.existsSync(args.out))throw Error('Refuse to overwrite replay');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),inputs=[],require=createRequire(import.meta.url),decoder=require(path.resolve(args.dir,'decode-geometry.cjs'));
function load(file){const b=fs.readFileSync(file);inputs.push({path:file,sha256:sha(b)});return JSON.parse(file.endsWith('.gz')?zlib.gunzipSync(b):b);}
const world=load(path.join(args.dir,'grozavesti-world.json.gz')),scene=load(path.join(args.dir,'grozavesti-scene.json.gz')),facts=load(path.join(args.dir,'grozavesti-facts.json.gz')),sweep=load(args.sweep);
const r=sweep.rows.find(r=>r.sourceId==='w128304860'&&r.segment===11&&r.kind==='tram-v3a'&&r.dir===1&&Math.abs(r.s-14.884602409499855)<1e-9),g=r.groups.find(g=>g.solidName==='ground 0,-1'),snapshot=facts.snapshots.at(-1),rail=snapshot.tramNetwork.edges.find(e=>e.id===r.edgeId),edge=world.allEdges.find(e=>e.id===77),v=[...snapshot.active,...snapshot.pool].find(v=>v.kind===r.kind);
if(r.branchUncertainty.length||Math.abs(r.pose.y-.24)>1e-8||Math.abs(r.pose.pitch)>1e-8||edge.sidewalkSource.explicit||edge.roadWidthSource)throw Error('Fixture source/grade/inferred-dimension premise changed');
const decoderPart=decoder.geometryPart(scene.geometries[v.model.primaryGeometryId],v.mesh.matrixWorld),points=Array.from({length:decoderPart.positions.count},(_,i)=>decoderPart.positions.get(i)),idx=decoderPart.indices;
if(!idx)throw Error('Fixture primary geometry must retain its native index');
const ch=Math.cos(r.pose.heading),sh=Math.sin(r.pose.heading),cp=Math.cos(r.pose.pitch),sp=Math.sin(r.pose.pitch),scale=v.meshPose.scale;
const posed=points.map(p=>{const x=p[0]*scale[0],y=p[1]*scale[1],z=p[2]*scale[2],Z=z*cp-y*sp;return[r.pose.x+ch*x+sh*Z,r.pose.y+y*cp+z*sp,r.pose.z-sh*x+ch*Z];});
const body=g.bodyTriangles.map(triangle=>({triangle,vertices:[0,1,2].map(k=>posed[idx[triangle*3+k]])}));
const stations=posed.map(p=>(p[0]-rail.a.x)*rail.dirx+(p[2]-rail.a.z)*rail.dirz);
if(Math.min(...stations)<0||Math.max(...stations)>rail.len)throw Error('Actual emitted body does not fit the single source leg');
const object=scene.objects.find(o=>o.uuid===g.solidId),triangles=[];
for(const part of decoder.meshParts(scene,object))for(const t of decoder.triangles(part,{respectDrawRange:false}))triangles.push(t.vertices);
const raw=g.nativeTriangles.map(nativeTriangle=>({nativeTriangle,vertices:triangles[nativeTriangle]}));
const compilerFile=path.resolve(args.compiler,'game/src/rail-roadside.js'),builderFile=path.resolve(args.compiler,'game/src/geobuild.js'),{buildRailRoadsideClearance}=await import(pathToFileURL(compilerFile)),{MeshBuilder}=await import(pathToFileURL(builderFile));
const fleet=[...snapshot.active,...snapshot.pool].filter(v=>v.tramDetected),fleetPoints=fleet.flatMap(v=>{const p=decoder.geometryPart(scene.geometries[v.model.primaryGeometryId],v.mesh.matrixWorld);return Array.from({length:p.positions.count},(_,i)=>p.positions.get(i));});
const envelope={halfWidthM:Math.max(...fleetPoints.map(p=>Math.abs(p[0]))),minY:Math.min(...fleetPoints.map(p=>p[1])),maxY:Math.max(...fleetPoints.map(p=>p[1]))};
const C=buildRailRoadsideClearance({corridors:[{a:[rail.a.x,rail.a.z],b:[rail.b.x,rail.b.z],groundLevel:true,gaugeM:1.435,sourceId:rail.sourceId,sourceNodeIds:rail.sourceNodeIds}]},envelope),protectedCarriageway=world.ribbons.find(r=>r.edge?.id===77).poly;
// The exported asphalt ribbon includes the .15m shoulder. Protecting it is
// conservative relative to the runtime's exact 3.5m lane polygon; it is not a
// claim that this is the complete freshly generated runtime lane-corner state.
C.register(edge,protectedCarriageway,raw.flatMap(t=>t.vertices.map(p=>[p[0],p[2]])));
let before=0,after=0;const compiled=[];
for(const t of raw){const m=new MeshBuilder(),ids=t.vertices.map(p=>m.v(...p,0,1,0,p[0],p[2],[120,130,140]));m.tri(...ids);C.apply(m,0,edge);const out=[];for(let i=0;i<m.ic;i+=3)out.push([0,1,2].map(k=>Array.from(m.p.subarray(m.i[i+k]*3,m.i[i+k]*3+3))));compiled.push({nativeTriangle:t.nativeTriangle,before:t.vertices,after:out});for(const b of body){if(triangleContact(b.vertices,t.vertices))before++;for(const q of out)if(triangleContact(b.vertices,q))after++;}}
if(before!==g.pairs)throw Error('Exact native triangle-pair reproduction mismatch: '+before+' != '+g.pairs);
const result={passed:after===0,scope:'Offline 87fe compiler replay of one independently proposed same-leg flat source pose. Not a new native World capture, actual driven route, source-wide corridor acceptance or replacement for fresh native spawn retest.',sourceCommit:sweep.sourceCommit,compilerCandidate:'87fe582541b828c7caa6f9649449f208ca24463c',compilerSha256:sha(fs.readFileSync(compilerFile)),builderSha256:sha(fs.readFileSync(builderFile)),inputs,proposal:{sourceId:r.sourceId,segment:r.segment,dir:r.dir,s:r.s,pose:r.pose,kind:r.kind,branchUncertainty:r.branchUncertainty,actualMeshStationBoundsM:[Math.min(...stations),Math.max(...stations)],sourceLegLengthM:rail.len},owner:{edgeId:edge.id,source:world.data.roadSourceGeometry[String(edge.road)],sidewalkSource:edge.sidewalkSource,protectedCarriageway,basis:'Conservative exported asphalt ribbon including inferred .15m shoulder; unchanged exact lane polygon is strictly inside this protection for the attributed primitive.'},envelope,nativePairs:before,compiledPairs:after,bodyTriangles:body,compiled,report:C.report,freshNativeRequired:true};fs.writeFileSync(args.out,JSON.stringify(result));console.log(JSON.stringify({passed:result.passed,nativePairs:before,compiledPairs:after,bodyTriangles:body.length,worldTriangles:raw.length,compilerSha256:result.compilerSha256}));
