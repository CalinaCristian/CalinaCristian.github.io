#!/usr/bin/env node
// Classification only: never converts proposed triangle intersections to
// observed collisions, nor removes/relabels the immutable sweep records.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const args={};for(let i=2;i<process.argv.length;i++)if(process.argv[i].startsWith('--'))args[process.argv[i].slice(2)]=process.argv[++i];
if(!args.dir||!args.sweeps||!args.out)throw Error('--dir QA_EXPORT --sweeps SWEEP_DIRECTORY --out NEW_REPORT required');
if(fs.existsSync(args.out))throw Error('Refuse to overwrite classification');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),inputs=[],require=createRequire(import.meta.url),decoder=require(path.resolve(args.dir,'decode-geometry.cjs'));
function load(file){const b=fs.readFileSync(file);inputs.push({path:file,sha256:sha(b)});return JSON.parse(file.endsWith('.gz')?zlib.gunzipSync(b):b);}
const result={scope:'Offline classification of retained proposed-pose intersections, not observed native motion, collision resolution, visible rendering or whole-path acceptance. Source-centre legality alone does not prove a complete legal whole-body carriageway envelope through joins. All raw pairs remain unchanged.',districts:[]};
for(const district of ['grozavesti','romana']){
  const world=load(path.join(args.dir,district+'-world.json.gz')),scene=load(path.join(args.dir,district+'-scene.json.gz')),facts=load(path.join(args.dir,district+'-facts.json.gz')),sweep=load(path.join(args.sweeps,district+'-source-sweep.json'));
  if(!sweep.complete)throw Error('Incomplete sweep: '+district);
  const snapshot=facts.snapshots.at(-1),objects=new Map(scene.objects.map(o=>[o.uuid,o])),edges=new Map(snapshot.tramNetwork.edges.map(e=>[e.id,e])),models=new Map();
  for(const v of [...snapshot.active,...snapshot.pool].filter(v=>v.tramDetected))if(!models.has(v.kind)){
    const p=decoder.geometryPart(scene.geometries[v.model.primaryGeometryId],v.mesh.matrixWorld),vertices=Array.from({length:p.positions.count},(_,i)=>p.positions.get(i));
    models.set(v.kind,{vertices,length:v.length,width:v.width,scale:v.meshPose?.scale||[1,1,1]});
  }
  const counts={},rows=[];
  for(const r of sweep.rows){
    if(r.status!=='contact')continue;
    const e=edges.get(r.edgeId),m=models.get(r.kind),p=r.pose,ch=Math.cos(p.heading),sh=Math.sin(p.heading),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),stations=[],lateral=[];
    for(const v of m.vertices){const x=v[0]*m.scale[0],y=v[1]*m.scale[1],z=v[2]*m.scale[2],tz=z*cp-y*sp,X=p.x+ch*x+sh*tz,Z=p.z-sh*x+ch*tz;stations.push((X-e.a.x)*e.dirx+(Z-e.a.z)*e.dirz);lateral.push((X-e.a.x)*e.nx+(Z-e.a.z)*e.nz);}
    const bounds={stationM:[Math.min(...stations),Math.max(...stations)],lateralM:[Math.min(...lateral),Math.max(...lateral)]};
    const groups=r.groups.map(g=>{
      const o=objects.get(g.solidId);if(!o)throw Error('Missing native object '+g.solidId);
      let classification='opaque-mixed-world-geometry; source-owner/collider/grade/whole-body-envelope attribution required';
      if(o.materials.some(m=>m.name==='groundPlane'))classification='render-only horizon backdrop; depthWrite=false/renderOrder=-20; geometric intersection is not a physical-collider failure';
      else if(/ far$/.test(o.name))classification='alternative far LOD geometry; near/far active-at-proposed-camera and matching physical tree attribution unobserved';
      else if(/^signs( |$)/.test(o.name))classification='sign render faces; mapped ownership/physical support and texture coverage unclassified';
      else if(/^detail( |$)/.test(o.name))classification='thin detail render faces; actual prop/physical collider ownership unclassified';
      else if(/^road( |$)/.test(o.name))classification='mixed road/support/ballast render surface; own-slab overlay versus carriageway attribution required';
      else if(/^ground( |$)/.test(o.name))classification='mixed raised-ground/kerb/flat render surface; inferred ownership versus mapped surface attribution required';
      counts[classification]=(counts[classification]||0)+1;
      return{solidId:g.solidId,solidName:g.solidName,pairs:g.pairs,nativeTriangles:g.nativeTriangles,bodyTriangles:g.bodyTriangles,classification,nativeVisibility:o.visible,parentVisibility:o.parentChain.map(p=>({name:p.name,visible:p.visible})),renderOrder:o.renderOrder,materials:o.materials,first:g.first};
    });
    rows.push({sourceId:r.sourceId,segment:r.segment,edgeId:r.edgeId,dir:r.dir,s:r.s,kind:r.kind,pose:r.pose,branchUncertainty:r.branchUncertainty,sourceGrade:e.grade,actualMeshProjection:bounds,entireMeshProjectsWithinSingleOriginalLeg:bounds.stationM[0]>=-1e-7&&bounds.stationM[1]<=e.len+1e-7,wholeBodyCarriagewayEnvelope:'not asserted: raw rail source has no surveyed full-body corridor width; joins/native path choice and interaction with adjoining carriageways require separate attribution',groups});
  }
  result.districts.push({district,sourceCommit:sweep.sourceCommit,complete:sweep.complete,total:sweep.total,rawGeometricClear:sweep.clearSamples,rawIntersections:sweep.contactSamples,unknown:sweep.unknownSamples,branchChoiceUncertainty:sweep.branchSamples,groupClassifications:counts,rows});
}
result.inputs=inputs;fs.writeFileSync(args.out,JSON.stringify(result));console.log(JSON.stringify({out:args.out,districts:result.districts.map(({district,total,rawIntersections,unknown,groupClassifications})=>({district,total,rawIntersections,unknown,groupClassifications}))}));
