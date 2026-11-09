import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [baseline,candidate,out]=process.argv.slice(2),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(dir,name)=>{const b=fs.readFileSync(path.join(dir,name));return{hash:sha(b),value:JSON.parse(name.endsWith('.gz')?zlib.gunzipSync(b):b)};};
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if(distance(p,a,b)<1e-6)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const sourceFields=e=>{const o={};for(const k of ['id','road','access','name','type','len','ya','yb','layer','bridge','tunnel','wL','wR','laneW','median','lanesF','lanesB','oneway','roadWidthSource'])o[k]=e[k];o.a=[e.a.id,e.a.sourceId,e.a.x,e.a.y,e.a.z];o.b=[e.b.id,e.b.sourceId,e.b.x,e.b.y,e.b.z];return o;};
const result={scope:'Actual native source/road-footprint comparison and recorded static frame counters. No actor drive, all8, canonical complete mesh, or global physical pass.',districts:[],passed:true};
for(const district of ['seatac','bellevue']){
    const A=read(baseline,district+'-native.json.gz'),B=read(candidate,district+'-native.json.gz'),a=A.value,b=B.value;
    assert.deepEqual(a.data,b.data,'Source data changed');assert.deepEqual(a.edges.map(sourceFields),b.edges.map(sourceFields),'Source edge identity/profile/width changed');assert.deepEqual(a.profile,b.profile,'Native profile report changed');assert.deepEqual(a.traffic.ids,b.traffic.ids,'Native cohort IDs changed');assert.equal(a.traffic.pedestrians,b.traffic.pedestrians);
    const degenerate=d=>d.ribbons.filter(r=>r.e!==undefined&&r.e!==null&&area(r.poly)<1e-7).map(r=>r.e);
    const q={district,baselineSha256:A.hash,candidateSha256:B.hash,sourceDataEqual:true,sourceRoadFieldsAndProfileEqual:true,nativePopulationIdsEqual:true,active:b.traffic.active,pool:b.traffic.pool,pedestrians:b.traffic.pedestrians,initialAdmissionPassed:b.traffic.initialAdmissionPassed,initialTramBindingPassed:b.traffic.initialTramBindingPassed,baselineDegenerate:degenerate(a),candidateDegenerate:degenerate(b),nonAffinePaintFallbacks:b.edges.reduce((s,e)=>s+(e._mkFragmentFallback||0),0)};
    const beforeNodes=new Map(a.edges.flatMap(e=>[[e.a.id,e.a],[e.b.id,e.b]])),afterNodes=new Map(b.edges.flatMap(e=>[[e.a.id,e.a],[e.b.id,e.b]]));
    q.nativeBevelJoinCases=[...afterNodes.values()].filter(n=>n.pad&&!beforeNodes.get(n.id)?.pad).map(n=>({node:n,beforeNode:beforeNodes.get(n.id),sourceLegs:b.edges.filter(e=>e.a.id===n.id||e.b.id===n.id).map(e=>({id:e.id,road:e.road,sourceId:e.access?.sourceId,tags:b.data.roadSourceGeometry?.[e.road]?.tags,widthL:e.wL,widthR:e.wR,lengthM:e.len,layer:e.layer,bridge:e.bridge,asphaltBefore:a.ribbons.filter(r=>r.e===e.id).map(r=>r.poly),asphaltAfter:b.ribbons.filter(r=>r.e===e.id).map(r=>r.poly)})),nativePadPolygons:b.ribbons.filter(r=>r.node===n.id).map(r=>r.poly)}));
    q.bevelCenterlineChecks={scope:'Actual native 2D asphalt/pad continuity at every newly beveled source join; not vehicle-body/grade acceptance',samples:0,gaps:[]};
    for(const c of q.nativeBevelJoinCases){assert.ok(c.nativePadPolygons.length>0,'Missing native bevel pad '+c.node.id);for(const leg of c.sourceLegs){const e=b.edges.find(e=>e.id===leg.id);if(e.virtual)continue;const atA=e.a.id===c.node.id,polys=[...leg.asphaltAfter,...c.nativePadPolygons];for(let i=0;i<=12;i++){const s=Math.min(e.len,Math.min(c.node.radius,e.len*.45)*1.1)*i/12,station=atA?s:e.len-s,p=[e.a.x+e.dirx*station,e.a.z+e.dirz*station];q.bevelCenterlineChecks.samples++;if(!polys.some(poly=>inside(p,poly)))q.bevelCenterlineChecks.gaps.push({nodeId:c.node.id,edgeId:e.id,stationM:station});}}}assert.deepEqual(q.bevelCenterlineChecks.gaps,[],'Native new-join continuity gap');
    assert.deepEqual(q.candidateDegenerate,[]);assert.equal(q.initialAdmissionPassed,true);assert.equal(q.initialTramBindingPassed,true);
    if(district==='seatac'){
        q.focus=[];
        for(const id of [24,25,26,27,28]){
            const e=b.edges.find(e=>e.id===id),own=b.ribbons.filter(r=>r.e===id),joins=b.ribbons.filter(r=>r.node===e.a.id||r.node===e.b.id),polys=[...own,...joins].filter(r=>area(r.poly)>1e-8),missing=[];
            for(let i=0;i<=Math.ceil(e.len/.25);i++){const s=e.len*i/Math.ceil(e.len/.25),p=[e.a.x+e.dirx*s,e.a.z+e.dirz*s];if(!polys.some(r=>inside(p,r.poly)))missing.push(s);}
            q.focus.push({id,sourceId:e.access?.sourceId,nativeOwnAsphaltAreaM2:own.reduce((s,r)=>s+area(r.poly),0),sourceCenterlineSamples:Math.ceil(e.len/.25)+1,uncoveredCenterlineStationsM:missing});assert.deepEqual(missing,[],'Source continuity gap '+id);
        }
    }
    result.districts.push(q);
}
const ar=read(baseline,'report.json'),br=read(candidate,'report.json');assert.equal(br.value.complete,true);assert.deepEqual(br.value.errors,[]);assert.deepEqual(br.value.consoleErrors,[]);assert.deepEqual(br.value.httpErrors,[]);
result.candidateSource=br.value.source;result.browserClosedUtc=br.value.browserClosedUtc;result.toolSha256=br.value.toolSha256;result.copiedFilesBefore=br.value.copiedFilesBefore;result.copiedFilesAfter=br.value.copiedFilesAfter;result.servedFiles=Object.keys(br.value.servedFiles).length;
result.recordedFrames=[];
for(const s of br.value.stages){const before=ar.value.stages.find(x=>x.district===s.district);assert.ok(s.captures.length>0);const expected=br.value.requestedCaptureIds?before.captures.filter(c=>br.value.requestedCaptureIds.includes(c.id)):before.captures;assert.equal(s.captures.length,expected.length);for(const c of s.captures){const p=before.captures.find(x=>x.id===c.id);for(const k of ['x','y','z','tx','ty','tz'])assert.equal(c[k],p[k]);result.recordedFrames.push({district:s.district,id:c.id,cameraMatched:true,drawCalls:c.nativeView.renderStats.drawCalls,triangles:c.nativeView.renderStats.triangles});}}
result.maxRecordedDrawCalls=Math.max(...result.recordedFrames.map(x=>x.drawCalls));result.maxRecordedTriangles=Math.max(...result.recordedFrames.map(x=>x.triangles));result.frameCounterScope='Actual native Render3D.stats from each requested High static draw, with normal mirror invocation immediately before frame(0). Pass-composition/hardware FPS not certified.';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,source:result.candidateSource,districts:result.districts.map(x=>({district:x.district,degenerate:x.candidateDegenerate,admission:x.initialAdmissionPassed,unknownHeightPolicyFallbacks:x.nonAffinePaintFallbacks})),maxRecordedDrawCalls:result.maxRecordedDrawCalls,maxRecordedTriangles:result.maxRecordedTriangles}));
