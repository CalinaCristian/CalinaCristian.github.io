#!/usr/bin/env node
// Independent raw OSM → prepared road identity, topology and horizontal-coordinate audit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseFiles} from './parse-osm.mjs';
import {footprintMargin} from './geom.mjs';
import {auditSourcePath} from './road-audit-geometry.mjs';
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
const preparedBySource=new Map();
const sourceDirectionNormalizations=[];
const remember=(sourceId,points)=>preparedBySource.set(sourceId,[...(preparedBySource.get(sourceId)||[]),...points]);
const directedSource=(raw,orig,scope,index,sourceId)=>{
 if(raw.tags.oneway==='-1'){
  sourceDirectionNormalizations.push({sourceId,scope,index,source:'OSM oneway=-1',operation:'Prepared schema follows legal travel direction; original source IDs/coordinates remain unchanged.'});
  return [...orig].reverse();
 }
 return orig;
};
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
 const prepared=ids.map(i=>d.roadNodePositions.slice(i*2,i*2+2));
 const pathIssue=auditSourcePath(prepared,directedSource(raw,orig,'core',ri,s.sourceId),.005);
 if(pathIssue)issues.push({ri,sourceId:s.sourceId,reason:pathIssue});
 remember(s.sourceId,prepared);
}
let sceneryPrivatePhysical=0,sceneryPreparedVertices=0;
const scenerySourceWays=new Set();
for(const [si,row] of (d.scenery||[]).entries()){
 const s=d.scenerySourceGeometry?.[si],a=d.sceneryAccess?.[si],raw=ways.get(Number(s?.sourceId?.slice(1)));
 if(!s||!raw){issues.push({si,reason:'missing scenery source way'});continue;}
 scenerySourceWays.add(s.sourceId);
 if(a?.sourceId!==s.sourceId)issues.push({si,sourceId:s.sourceId,reason:'scenery access/source identity differs'});
 if(JSON.stringify(s.nodeIds)!==JSON.stringify(raw.nodes)||JSON.stringify(s.tags)!==JSON.stringify(raw.tags))issues.push({si,sourceId:s.sourceId,reason:'scenery raw source IDs/tags changed'});
 if(raw.nodes.some(id=>!nodes.has(id))){issues.push({si,sourceId:s.sourceId,reason:'scenery original has missing raw nodes'});continue;}
 const orig=raw.nodes.map(id=>project(nodes.get(id)));
 if(orig.length!==s.projected?.length||orig.some((q,i)=>!s.projected[i]||!near(q,s.projected[i])))issues.push({si,sourceId:s.sourceId,reason:'scenery source projected coordinates changed'});
 if(s.wgs84?.length!==raw.nodes.length||s.wgs84.some((q,i)=>!near(q,nodes.get(raw.nodes[i]),1e-12)))issues.push({si,sourceId:s.sourceId,reason:'scenery source WGS84 coordinates changed'});
 if(a?.publicDrive===false)sceneryPrivatePhysical++;
 const prepared=s.prepared||[];sceneryPreparedVertices+=prepared.length;
 const pathIssue=auditSourcePath(prepared,directedSource(raw,orig,'scenery',si,s.sourceId));
 if(pathIssue)issues.push({si,sourceId:s.sourceId,reason:pathIssue});
 let x=0,z=0;const encoded=[];for(let i=4;i<row.length;i+=2){x+=row[i];z+=row[i+1];encoded.push([x,z]);}
 const expected=prepared.map(q=>[Math.round(q[0]*10),Math.round(q[1]*10)]);
 if(JSON.stringify(encoded)!==JSON.stringify(expected))issues.push({si,sourceId:s.sourceId,reason:'legacy scenery row differs from precise prepared coordinates'});
 remember(s.sourceId,prepared);
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
let expectedVisibleRingWays=0,missingVisibleRingWays=0,requiredVisibleVertices=0,missingVisibleVertices=0;
const excludedCoveredRingWays=[];
for(const [id,w]of ways){
 if(!d.classes.includes(w.tags.highway)||w.tags.area==='yes'||w.nodes.length<2||w.nodes.some(n=>!nodes.has(n)))continue;
 const pts=w.nodes.map(n=>project(nodes.get(n)));
 if(!pts.slice(1).some((q,i)=>footprintMargin([pts[i],q],d.district.geometry)<=600))continue;
 if(w.tags.tunnel&&w.tags.tunnel!=='no'||w.tags.covered==='yes'){excludedCoveredRingWays.push('w'+id);continue;}
 expectedVisibleRingWays++;
 const prepared=preparedBySource.get('w'+id)||[];
 if(!prepared.length){missingVisibleRingWays++;issues.push({sourceId:'w'+id,reason:'visible core/ring source way omitted'});continue;}
 for(let i=0;i<pts.length;i++)if(footprintMargin([pts[i]],d.district.geometry)<=600){
  requiredVisibleVertices++;
  if(!prepared.some(q=>near(q,pts[i]))){missingVisibleVertices++;issues.push({sourceId:'w'+id,nodeId:w.nodes[i],reason:'visible core/ring source vertex omitted'});}
 }
}
const report={data:path.basename(dataPath),roads:d.roads.length,sourceWays:seen.size,preparedNodes,cutNodes,expectedWhole,wholeSourceVertices,missingWhole,privatePhysical,shortSourceStubs,
 scenery:{pieces:d.scenery?.length||0,sourceWays:scenerySourceWays.size,preparedVertices:sceneryPreparedVertices,privatePhysical:sceneryPrivatePhysical},
 visibleRing:{expectedWays:expectedVisibleRingWays,missingWays:missingVisibleRingWays,requiredVertices:requiredVisibleVertices,missingVertices:missingVisibleVertices,excludedCoveredWays:excludedCoveredRingWays,exclusionReason:'Covered/tunnel source ways outside the physical core are not represented as ground scenery; no elevation or open road is invented.'},sourceDirectionNormalizations,issues};
console.log(JSON.stringify(report,null,2));process.exitCode=issues.length?1:0;
