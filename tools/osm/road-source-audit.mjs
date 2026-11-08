#!/usr/bin/env node
// Independent raw OSM → prepared road identity, topology and horizontal-coordinate audit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseFiles} from './parse-osm.mjs';
import {footprintMargin} from './geom.mjs';
const arg=k=>process.argv[process.argv.indexOf(k)+1];
const dataPath=arg('--data'),osmPath=arg('--osm');
if(!process.argv.includes('--data')||!process.argv.includes('--osm'))throw Error('Usage: node tools/osm/road-source-audit.mjs --data FILE --osm XML_OR_DIRECTORY');
const d=JSON.parse(fs.readFileSync(dataPath));
assert.equal(d.roadGeometryPolicy,'source','dataset requires rebuild with precise source road policy');
const files=fs.statSync(osmPath).isDirectory()?fs.readdirSync(osmPath).filter(f=>f.endsWith('.xml')).map(f=>path.join(osmPath,f)):[osmPath];
const {nodes,ways}=parseFiles(files),issues=[],seen=new Map(),p=d.proj;
const project=ll=>[(ll[1]-p.lon0)*p.mPerLon*p.scale,-(ll[0]-p.lat0)*p.mPerLat*p.scale];
const near=(a,b,tol=1e-7)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tol;
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
let privatePhysical=0,shortSourceStubs=0,cutNodes=0,preparedNodes=0;
for(const [ri,row]of d.roads.entries()){
 const s=d.roadSourceGeometry[ri],a=d.roadAccess[ri],raw=ways.get(Number(s?.sourceId?.slice(1)));
 if(!s||!raw){issues.push({ri,reason:'missing source way'});continue;}
 if(a.sourceId!==s.sourceId)issues.push({ri,reason:'access/source identity differs'});
 if(JSON.stringify(s.nodeIds)!==JSON.stringify(raw.nodes)||JSON.stringify(s.tags)!==JSON.stringify(raw.tags))issues.push({ri,reason:'raw source IDs/tags changed'});
 seen.set(s.sourceId,(seen.get(s.sourceId)||0)+1);
 const orig=raw.nodes.map(n=>nodes.get(n)).map(project);
 if(orig.some((q,i)=>!near(q,s.projected[i])))issues.push({ri,reason:'source projected coordinates changed'});
 if(s.wgs84.some((q,i)=>!near(q,nodes.get(raw.nodes[i]),1e-12)))issues.push({ri,reason:'source WGS84 coordinates changed'});
 if(a.publicDrive===false)privatePhysical++;
 const ids=row.slice(10),idsFromNodes=ids.map(i=>d.roadNodeIds[i]);
 if(JSON.stringify(idsFromNodes)!==JSON.stringify(s.preparedNodeIds))issues.push({ri,reason:'graph/source node identity differs'});
 for(const ni of ids){
  const id=d.roadNodeIds[ni],pt=d.roadNodePositions.slice(ni*2,ni*2+2);preparedNodes++;
  if(id>=0){const ll=nodes.get(id);if(!ll||!raw.nodes.includes(id)||!near(pt,project(ll)))issues.push({ri,nodeId:id,reason:'source node moved or invented'});}
  else{cutNodes++;if(id>-2e9||Math.min(...orig.slice(1).map((q,i)=>segmentDistance(pt,orig[i],q)))>.005)issues.push({ri,nodeId:id,reason:'synthetic node is not an exact boundary cut on source segment'});}
 }
}
let expectedWhole=0,wholeSourceVertices=0,missingWhole=0;
for(const [id,w]of ways){
 if(!d.classes.includes(w.tags.highway)||w.tags.area==='yes'||w.nodes.length<2||w.nodes.some(n=>!nodes.has(n)))continue;
 const pts=w.nodes.map(n=>project(nodes.get(n))),allInside=pts.every(q=>footprintMargin([q],d.district.geometry)<=0);
 if(!allInside)continue;expectedWhole++;wholeSourceVertices+=w.nodes.length;
 const prepared=Object.values(d.roadSourceGeometry).filter(r=>r.sourceId==='w'+id).flatMap(r=>r.preparedNodeIds);
 if(!seen.has('w'+id)||w.nodes.some(n=>!prepared.includes(n))){missingWhole++;issues.push({sourceId:'w'+id,reason:'whole core source way or vertex omitted'});}
 const len=pts.slice(1).reduce((v,q,i)=>v+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);if(len<15)shortSourceStubs++;
}
const report={data:path.basename(dataPath),roads:d.roads.length,sourceWays:seen.size,preparedNodes,cutNodes,expectedWhole,wholeSourceVertices,missingWhole,privatePhysical,shortSourceStubs,issues};
console.log(JSON.stringify(report,null,2));process.exitCode=issues.length?1:0;
