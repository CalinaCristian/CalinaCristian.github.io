// CPU-only native-method fixture. No browser; static world is explicitly empty
// here, so this verifies source/pose/identity, not native static acceptance.
import fs from 'node:fs';import assert from 'node:assert/strict';
import { Traffic } from '../../../../game/src/traffic.js';
import { makeVehicle } from '../../../../game/src/vehicles.js';
import { sampleTramPath, canTravelTram } from '../../../../game/src/tram-path.js';
const [fixtureFile,dataFile,out]=process.argv.slice(2),F=JSON.parse(fs.readFileSync(fixtureFile)),D=JSON.parse(fs.readFileSync(dataFile));
const nodes=F.nativeGraph.nodes.map(n=>({...n,edges:[]})),byNode=new Map(nodes.map(n=>[n.id,n]));
const edges=F.nativeGraph.edges.map(e=>({...e,a:byNode.get(e.a.id),b:byNode.get(e.b.id)})),byEdge=new Map(edges.map(e=>[e.id,e]));for(const e of edges){e.a.edges.push(e);e.b.edges.push(e);}
const motorSnapshot=()=>JSON.stringify({nodes:nodes.map(({edges,...n})=>({...n,edgeIds:edges.map(e=>e.id)})),edges:edges.map(({a,b,...e})=>({...e,a:a.id,b:b.id}))}),motorBefore=motorSnapshot(),actors=F.bodies.map(v=>({...v,edge:byEdge.get(v.edge.id),mesh:v.tram?makeVehicle(v.kind,undefined,{city:'bucharest',instanced:true}):null,route:[],hist:[]})),actorRefs=actors.slice();
const mask=D.district.mask,bits=new Uint8Array(mask.w*mask.h);let k=0,value=0;for(const n of mask.rle){bits.fill(value,k,k+n);k+=n;value^=1;}
const inside=(x,z)=>{const i=Math.floor((x-mask.x0)/mask.cell),j=Math.floor((z-mask.z0)/mask.cell);return i>=0&&j>=0&&i<mask.w&&j<mask.h&&bits[j*mask.w+i]===1;};
const T=Object.create(Traffic.prototype);Object.assign(T,{world:{graph:{nodes,edges},data:D,buildings:[],district:{inside}},vehicles:actors,pool:[],grid:{build(){}},rng:()=>{throw Error('Rail source rebinding consumed Traffic RNG');}});
const meshes=actors.filter(v=>v.tram).map(v=>v.mesh),binding=T.bindSourceTrams();assert.equal(binding.passed,true,JSON.stringify(binding.unresolved));assert.equal(binding.bindings.length,6);assert.equal(T.vehicles.length,263);assert(T.vehicles.every((v,i)=>v===actorRefs[i]));assert(actors.filter(v=>v.tram).every((v,i)=>v.mesh===meshes[i]));assert.equal(motorSnapshot(),motorBefore);
const checks=[];
for(const v of actors.filter(v=>v.tram)){
    assert(canTravelTram(v.edge,v.dir));const p=sampleTramPath(v);assert(Math.hypot(v.x-p.x,v.z-p.z)<1e-9);assert(T.railBodyInside(v));
    const expected=[257,260,261].includes(v.id)?'w128304860':'w660918285';assert.equal(v.edge.sourceId,expected);T.ensureRoute(v);
    const before={x:v.x,z:v.z};v.s+=.5;v.odo=(v.odo||0)+.5;while(v.s>=v.edge.len)T.advance(v);T.ensureRoute(v);T.placeOnLane(v,true,0);
    assert(Math.hypot(v.x-before.x,v.z-before.z)>.45);assert(Math.hypot(v.x-sampleTramPath(v).x,v.z-sampleTramPath(v).z)<1e-9);assert(T.railBodyInside(v));checks.push({id:v.id,sourceId:v.edge.sourceId,dir:v.dir,sourceNodeIds:v.edge.sourceNodeIds,sourcePoseNative:true,wholeBodyInsideBareNativeMask:true,sourceForwardMovementM:Math.hypot(v.x-before.x,v.z-before.z)});
}
const crossing=T.tramNetwork.nodes.find(n=>n.motorNode&&n.edges.length);assert(crossing);assert.equal(T.boxController(crossing),T.boxController(crossing.motorNode));assert(T.isJunction(crossing.motorNode));assert.equal(crossing.motorNode.edges.length,2);
const result={passed:true,fixtureFile,dataFile,actorCount:actors.length,bindings:binding.bindings,unresolvedSourceGrades:binding.source.unresolved,checks,sourceCrossingPhysicalKeyShared:true,motorSourceGraphUnchanged:true,allActorAndTramMeshIdentitiesPreserved:true,trafficRngDraws:0,browserOpened:false,staticScope:'Empty static world for isolated source/native-pose CPU control; full static/body/ped/native acceptance remains pending.'};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,bindings:binding.bindings.map(b=>({id:b.id,source:b.after.sourceId,moveM:b.distanceM})),checks:checks.length,unresolvedSourceGrades:binding.source.unresolved.length,staticScope:result.staticScope},null,2));
