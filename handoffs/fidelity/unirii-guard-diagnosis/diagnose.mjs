import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const here=path.dirname(new URL(import.meta.url).pathname);
const source=process.argv[2]||'/workspace/reality-pass/unirii-underpass/source-395071c2';
const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(here,'native-395-fixture.json.gz'))));
const provenance=JSON.parse(fs.readFileSync(path.join(here,'provenance.json')));
for(const p of provenance.inputs.filter(p=>p.gitBlob)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,p.path))).digest('hex'),p.sha256,p.path);
const {Traffic}=await import(pathToFileURL(path.join(source,'game/src/traffic.js')));
const {buildTurnLaneRules}=await import(pathToFileURL(path.join(source,'game/src/turn-lanes.js')));
const {lanesDir}=await import(pathToFileURL(path.join(source,'game/src/nav.js')));
const T=Traffic.prototype;
// Independent full four-axis SAT. Keep negative separation values rather than
// prematurely returning on one axis: this is a body-proxy diagnostic only.
function penetration(a,b){
 const af=[-Math.sin(a.heading),-Math.cos(a.heading)],ar=[-af[1],af[0]],bf=[-Math.sin(b.heading),-Math.cos(b.heading)],br=[-bf[1],bf[0]],d=[b.x-a.x,b.z-a.z];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
 return Math.min(...[af,ar,bf,br].map(u=>Math.abs(dot(af,u))*a.length/2+Math.abs(dot(ar,u))*a.width/2+Math.abs(dot(bf,u))*b.length/2+Math.abs(dot(br,u))*b.width/2-Math.abs(dot(d,u))));
}
const nodes=new Map(),edges=new Map();
for(const r of fixture.allEdges) for(const n of [r.a,r.b]) if(!nodes.has(n.id))nodes.set(n.id,{...n,edges:[]});
for(const r of fixture.allEdges){
 const row=fixture.data.roads[r.road],flags=row?.[8]||0,width=fixture.data.roadWidths?.[r.road],shared=fixture.data.sharedLanes?.[r.road];
 const e={...r,a:nodes.get(r.a.id),b:nodes.get(r.b.id),lanesF:row?.[2],lanesB:flags&1?0:row?.[3],oneway:!!(flags&1),laneW:shared?shared.widthM/2:width?.laneWidthM??row?.[5]/10,median:shared?0:width?(flags&1?-width.widthM:width.medianM):row?.[4]/10,laneCenterShiftM:width?.laneCenterShiftM||0,access:fixture.data.roadAccess?.[r.road]};
 edges.set(e.id,e);e.a.edges.push(e);e.b.edges.push(e);
}
for(const dep of fixture.dependencies) for(const n of dep.nodes)Object.assign(nodes.get(n.id)||{},n);
const traffic=Object.create(T);traffic.turnLaneRules=buildTurnLaneRules(fixture.data,[...edges.values()]);
function actor(raw,transition=0){return {...raw,edge:edges.get(raw.edge.id),route:raw.route.map(r=>({...r,e:edges.get(r.edgeId)})),hist:raw.hist.map(r=>({...r,e:edges.get(r.edgeId)})),rx:raw.edge.nx*raw.dir,rz:raw.edge.nz*raw.dir,latBlend:0,transition,mesh:{position:{set(){}},rotation:{set(){}}}};}
function summary(v){return Object.fromEntries(['id','kind','x','z','heading','speed','s','lane','laneCur','stuck','still','zeroWhy','gap','stopD','stopWhy','leader','waitRed','redQ'].map(k=>[k,v[k]]));}
const dep0=fixture.dependencies[0],estate=dep0.vehicles.find(v=>v.id===35),all=dep0.vehicles.filter(v=>v.id!==35&&Math.abs(v.y-estate.y)<=2);
const near=all.map(o=>({id:o.id,kind:o.kind,penetrationM:penetration(estate,o)})).sort((a,b)=>b.penetrationM-a.penetrationM).slice(0,8);
const steps=[];
for(const transition of [0,1])for(const speed of [.1,.2,.5,1,2]){
 const v=actor(estate,transition),before=summary(v);v.speed=speed;v.s+=speed/30;v.odo+=speed/30;T.placeOnLane.call(traffic,v,false,1/30);
 const hits=all.map(o=>{const p0=penetration(estate,o),p=penetration(v,o);const apart=p0>.05&&p<p0+.04&&Math.hypot(v.x-o.x,v.z-o.z)>Math.hypot(estate.x-o.x,estate.z-o.z)+.005;return {id:o.id,p0,p,apart,guardReject:p>.05&&p>p0+.002&&!apart};}).filter(x=>x.guardReject||x.p>0);
 steps.push({transition,speed,before,after:summary(v),distanceM:Math.hypot(v.x-estate.x,v.z-estate.z),headingDeltaRad:v.heading-estate.heading,hits});
}
const dep1=fixture.dependencies[1],van=actor(dep1.vehicles.find(v=>v.id===244));
const drop=[];let e=van.edge,dir=van.dir,D=e.len-van.s-van.length/2;
for(let k=-1;k<van.route.length&&D<70;k++){
 const n=dir>0?e.b:e.a,next=van.route[k+1];if(!next)break;
 const nl=Math.max(1,lanesDir(next.e,next.dir)),stop=D-(n.radius??6)-1.5;
 drop.push({k,edgeId:e.id,sourceId:e.access?.sourceId,nodeId:n.id,nodeSourceId:n.sourceId,nextEdgeId:next.e.id,nextSourceId:next.e.access?.sourceId,nextDirection:next.dir,currentLanes:lanesDir(e,dir),nextLanes:nl,retainedOriginalLane:van.lane,distanceM:D,radiusM:n.radius,stopM:stop,keepsTurnLane:traffic.keepsTurnLane(e,dir,next),branch:van.lane>nl-1?'lanedrop':'lanedrop2',legacyStops:!traffic.keepsTurnLane(e,dir,next)&&van.lane>nl-1&&stop>-.5&&van.stuck<3});
 D+=next.e.len;e=next.e;dir=next.dir;
}
const projected=[];let lane=van.lane;e=van.edge;dir=van.dir;
for(const next of van.route.slice(0,4)){const outgoing=traffic.laneOnNext(van,lane,next.e,next.dir);projected.push({edgeId:e.id,nextEdgeId:next.e.id,incomingLane:lane,outgoingLane:outgoing,incomingLanes:lanesDir(e,dir),outgoingLanes:lanesDir(next.e,next.dir)});lane=outgoing;e=next.e;dir=next.dir;}
const result={source:fixture.source,scope:fixture.method,coverageGaps:['No fresh native replay; detached exact395 placeOnLane method plus independently calculated SAT.','Transient transition omitted by original observer; both0and1 branches bracketed. Initial latBlend assumed0 at s>12 where native clears it.','Native edge export omitted lane parameters; reconstructed from exact prepared source rows and width policy; no alternative actual mutable lane alignment claimed.','Original null gap/stopD were JSON Infinity or missing; no conversion to finite0.','No per-tick guard hit/old pose exported, so no assertion that the replay exactly reproduces the original rejected tick.'],estate:{time:dep0.state.simT,original:summary(estate),near,steps},van:{time:dep1.state.simT,original:summary(van),drop,projected,nativeNodes:dep1.nodes.filter(n=>[495,496,606,605,604].includes(n.id))}};
assert(near[0].id===47&&near[0].penetrationM>0&&near[0].penetrationM<.05);
assert(steps.every(s=>s.hits.some(h=>h.id===47&&h.guardReject)));
assert(drop.some(r=>r.edgeId===559&&r.nextEdgeId===558&&r.legacyStops&&Math.abs(r.stopM-van.stopD)<1e-9));
assert.equal(projected[1].incomingLane,0);assert.equal(projected[1].outgoingLane,0);
fs.writeFileSync(path.join(here,'findings.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({estateNearest:near[0],firstStep:steps[0],vanDuplicate:drop.find(r=>r.legacyStops),projected,checks:'4causal assertions PASS'},null,2));
