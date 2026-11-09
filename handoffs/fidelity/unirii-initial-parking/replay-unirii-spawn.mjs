// Exact original/new Traffic.spawnAll loops over the actual unchanged World
// graph/profile prefix. No native scene/geometry/pedestrian/drive acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
const base='57dbb99ef150dd8ec1c8eeeeb6008785bf9585a3',dataBytes=fs.readFileSync(path.join(root,'game/data/bucharest-unirii.json')),data=JSON.parse(dataBytes);
assert.equal(sha(dataBytes),'e94dc563fc82efe0f6dac21e7e20ac8e34ea5a7e20eb38bf97e829abebe9657d');
const source=execFileSync('git',['show',base+':game/src/world.js'],{cwd:root,encoding:'utf8'}),marker='    //  CELLS (chunked static geometry)',cut=source.indexOf(marker),helpersStart=source.indexOf('    function isPadNode(n) {'),helpersEnd=source.indexOf('    for (const e of edges) {\n        e.sidewalkSource',helpersStart);
assert.ok(cut>0&&helpersStart>cut&&helpersEnd>helpersStart);
const hoisted=source.slice(helpersStart,helpersEnd).replace('    for (const n of nodeArr) n.pad = n.edges.length ? isPadNode(n) : false;\n','');
const isolated=source.slice(0,cut)+hoisted+`
    for(const n of nodeArr)n.pad=n.edges.length?isPadNode(n):false;
    for(const e of edges){e.sidewalkSource=sourceSidewalkSides(data,e);e.sidewalkRightM=e.sidewalkSource.rightM;e.sidewalkLeftM=e.sidewalkSource.leftM;}
    const dmask=decodeDistrictMask(data.district?.mask),[bx0,bz0,bx1,bz1]=data.bounds.map(v=>v*.1),bounds={minX:bx0-40,maxX:bx1+40,minZ:bz0-40,maxZ:bz1+40};
    if(dmask)Object.assign(bounds,{minX:dmask.x0-40,minZ:dmask.z0-40,maxX:dmask.x0+dmask.w*dmask.cell+40,maxZ:dmask.z0+dmask.h*dmask.cell+40});
    // Exact later source-end classification affects closedEdge/spawn RNG.
    // Reproduce its flag-only portion; no closure geometry/pixel claim.
    const endIdx=new Set(data.district.ends||[]);
    nodeArr.forEach((n,i)=>{if(!n||endIdx.has(i))return;const real=n.edges.filter(f=>!f.virtual&&f.publicDrive!==false);if(real.length!==1)return;const e=real[0];if(/service|living_street|track|path|footway|pedestrian|parking/.test(e.type||'')||(e.len||0)<25)return;endIdx.add(i);});
    for(const i of endIdx){const n=nodeArr[i],real=n?n.edges.filter(f=>!f.virtual&&f.publicDrive!==false):[];if(real.length===1)n.mapEnd=true;}
    graph.edges=edges.filter(e=>e.drivable);graph.edges.forEach((e,i)=>e.id=i);edges.filter(e=>!e.drivable).forEach((e,i)=>e.id=graph.edges.length+i);for(const n of nodeArr){n.allEdges=n.edges;n.edges=n.edges.filter(e=>e.drivable);}
    for(const k of Object.keys(nodes))if(!nodes[k].drivable)delete nodes[k];
    return{data,graph,allEdges:edges,district:{id:'unirii'},bounds,pois:[],buildings:[],sidewalkWidth:(e,s)=>s>0?e.sidewalkRightM:e.sidewalkLeftM};
}
`;
const oldSource=execFileSync('git',['show',base+':game/src/traffic.js'],{cwd:root,encoding:'utf8'}),prefixFile=path.join(root,'game/src','.parking-world-'+process.pid+'.mjs'),oldFile=path.join(root,'game/src','.parking-old-'+process.pid+'.mjs'),fetchBefore=globalThis.fetch,documentBefore=globalThis.document;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'game/dev/fixtures/unirii-initial-parked-van484.json')));
try{
    fs.writeFileSync(prefixFile,isolated,{flag:'wx'});fs.writeFileSync(oldFile,oldSource,{flag:'wx'});
    globalThis.fetch=async url=>{assert.ok(String(url).endsWith('/data/bucharest-unirii.json'));return{json:async()=>structuredClone(data)};};
    const {buildWorld}=await import(pathToFileURL(prefixFile)),{BUCHAREST}=await import(pathToFileURL(path.join(root,'game/src/cities.js'))),{Traffic}=await import(pathToFileURL(path.join(root,'game/src/traffic.js'))),Old=(await import(pathToFileURL(oldFile))).Traffic,THREE=await import(pathToFileURL(path.join(root,'game/vendor/three.module.min.js')));
    const worlds=[await buildWorld({...BUCHAREST},null,{district:'unirii'}),await buildWorld({...BUCHAREST},null,{district:'unirii'})];
    globalThis.document={createElement(type){assert.equal(type,'canvas');return{width:0,height:0,getContext(){return new Proxy({measureText:text=>({width:String(text).length*8})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});}};}};
    function spawn(Base,world){let captured;const stop={};class BeforeAdmission extends Base{spawnAll(){super.spawnAll();captured=this;throw stop;}}try{new BeforeAdmission(world,{...BUCHAREST,activeDistrict:'unirii'},new THREE.Scene(),{maxVehicles:480,maxPeds:0});}catch(error){if(error!==stop)throw error;}return captured;}
    const original=spawn(Old,worlds[0]),candidate=spawn(Traffic,worlds[1]);
    const state=t=>t.vehicles.map(v=>({id:v.id,kind:v.kind,sourceId:t.world.data.roadSourceGeometry[v.edge.road]?.sourceId,edgeId:v.edge.id,dir:v.dir,lane:v.lane,laneCur:v.laneCur,s:v.s,x:v.x,y:v.y,z:v.z,heading:v.heading,desiredMul:v.desiredMul,honkAt:v.honkAt,busLaneOk:v.busLaneOk,laneChangeCd:v.laneChangeCd,paint:v.mesh.userData._paint?.getHex()}));
    assert.deepEqual(state(candidate),state(original));
    const futureA=Array.from({length:128},()=>original.rng()),futureB=Array.from({length:128},()=>candidate.rng());assert.deepEqual(futureB,futureA);
    const slots=original.vehicles.filter(v=>v.parked),van=original.vehicles.find(v=>v.id===484),cv=candidate.vehicles.find(v=>v.id===484);
    assert.equal(slots.length,candidate.initialParking.attempted);assert.equal(candidate.initialParking.admitted,0);assert.equal(candidate.initialParking.refused,slots.length);
    assert.equal(van.kind,fixture.vehicle.kind);assert.equal(van.edge.access.sourceId,fixture.sourceRoad.sourceId);
    for(const k of ['x','y','z','s','heading','lane','dir'])assert.ok(Math.abs(van[k]-fixture.vehicle[k])<1e-8,'native van484 source '+k+' matches the actual be12 record');
    assert.ok(van.parked&&!cv.parked&&cv.latExtraCur===0&&cv.lateralExtra===0);
    const output={passed:true,base,datasetSHA256:sha(dataBytes),worldSHA256:sha(source),executedPrefixSHA256:sha(isolated),baselineTrafficSHA256:sha(oldSource),candidateTrafficSHA256:sha(fs.readFileSync(path.join(root,'game/src/traffic.js'))),actors:original.vehicles.length,originalIds:original.vehicles.map(v=>v.id),allActorStateSHA256:sha(JSON.stringify(state(original))),exactActorStateParity:true,next128RngSHA256:sha(JSON.stringify(futureA)),exactFutureRng:true,originalParked:slots.map(v=>({id:v.id,kind:v.kind,edgeId:v.edge.id,sourceId:v.edge.access.sourceId,s:v.s,x:v.x,y:v.y,z:v.z})),candidateParking:candidate.initialParking,actualNativeVan484Matched:true,scope:'CPU exact Traffic.spawnAll methods on actual source World graph/profile prefix, stopping before bind/general admission/pedestrians. Canvas taxi lettering mocked; graph/profile/source geometry native, no renderer. All original actors/IDs/kinds/source stations/scalars/paint and next128 RNG exact. New natural native cohort, evolving traffic/drive/static/budget acceptance remains open.'};
    const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:true,actors:output.actors,slots:slots.length,admitted:0,refused:slots.length,nativeVan484Matched:true,exactActorStateParity:true,exactFutureRng:true,out}));
}finally{globalThis.fetch=fetchBefore;if(documentBefore===undefined)delete globalThis.document;else globalThis.document=documentBefore;for(const f of [prefixFile,oldFile])if(fs.existsSync(f))fs.unlinkSync(f);}
