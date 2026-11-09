import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildTramSourceSignals,tramSourceSignalState} from '../../../game/src/tram-source-signals.js';
const F=JSON.parse(fs.readFileSync(new URL('./actual-four-fixture.json',import.meta.url))),cases=[];
const test=(name,fn)=>{const detail=fn();cases.push({name,detail});console.log('PASS '+name);};
function fixture(){
    const f=structuredClone(F),nodes=f.nodes.map(n=>{const x={...n,edges:[],hasLight:false};delete x.sourceSignal;return x;}),bySourceNode=new Map(nodes.map(n=>[String(n.sourceId),n])),endpoints=new Map(nodes.map(n=>[n.id,n]));
    const vertex=n=>{if(!endpoints.has(n.id))endpoints.set(n.id,{...n,edges:[]});return endpoints.get(n.id);};
    for(const raw of f.railEdges){const edge={...raw,a:vertex(raw.a),b:vertex(raw.b),railDirections:[1,-1]};edge.a.edges.push(edge);edge.b.edges.push(edge);}
    const motors=new Map(),roadEdges=[];
    const motor=n=>{if(!motors.has(n.id))motors.set(n.id,{...n,edges:[]});return motors.get(n.id);};
    for(const r of f.roads){for(const n of r.nativeNodes)motor(n);for(const raw of r.nativeEdges){const e={...raw,a:motor(raw.a),b:motor(raw.b)};e.a.edges.push(e);e.b.edges.push(e);roadEdges.push(e);}}
    const data={q:f.q,tramSourceCrossings:[f.crossing],tramSourceNodeTags:f.crossing.nodeTags},network={nodes,bySourceNode},world={graph:{nodes:[...motors.values()],edges:roadEdges},nodeLight:{}};
    return{data,network,world,nodes};
}
const plan=f=>buildTramSourceSignals(f.data,f.network,f.world);
const head=(f,tags)=>{Object.assign(f.nodes[0].tags,tags);Object.assign(f.data.tramSourceCrossings[0].nodeTags[String(f.nodes[0].sourceId)],tags);};
test('actual four signalized tram_crossing nodes preserve pedestrian control without requiring an uncontrolled road controller',()=>{
    const f=fixture(),before=JSON.stringify(f.data),r=plan(f);assert.equal(r.passed,true,JSON.stringify(r.unresolved));assert.equal(r.pedestrianControlled.length,4);assert.equal(r.associations.length,0);assert.equal(r.bindings.length,0);assert.equal(r.unresolved.length,0);
    assert.deepEqual(r.pedestrianControlled.map(p=>p.railSourceNodeId).sort(),[14189436067,14189436068,14189436069,14189436070]);
    for(const p of r.pedestrianControlled){assert.equal(p.sourceId,'w1559923424');assert.equal(p.tags.railway,'tram_crossing');assert.equal(p.tags.crossing,'traffic_signals');assert.equal(p.vehicleControl,'not mapped');assert.equal(p.pedestrianHeadRendering,'not verified');assert.deepEqual(p.nodeIds,F.crossing.nodeIds);assert.deepEqual(p.roadIncidences,F.crossing.roadIncidences);}
    assert.equal(JSON.stringify(f.data),before);assert(f.nodes.every(n=>!n.hasLight&&!n.sourceSignal));assert(f.world.graph.nodes.filter(n=>n.id===904||n.id===765).every(n=>n.flags===6&&!n.hasLight));
    return r.pedestrianControlled;
});
test('explicit railway signal head tags cannot become pedestrian-only or silently green',()=>{
    for(const tags of[{railway:'signal'},{'railway:signal:main':'RO:main'},{'railway:signal:direction':'forward'},{traffic_signals:'tram'},{traffic_signals:'tram_priority'}]){
        const f=fixture();head(f,tags);const r=plan(f);assert.equal(r.passed,false);assert.equal(r.pedestrianControlled.filter(p=>p.railSourceNodeId===f.nodes[0].sourceId).length,0);assert(r.unresolved.some(i=>i.railSourceNodeId===f.nodes[0].sourceId));
    }
});
test('an explicit tram head retained only in source-node metadata still blocks pedestrian-only classification',()=>{const f=fixture();f.data.tramSourceNodeTags=structuredClone(f.data.tramSourceNodeTags);f.data.tramSourceNodeTags[String(f.nodes[0].sourceId)]['railway:signal:main']='RO:main';const r=plan(f);assert.equal(r.passed,false);assert(r.unresolved.some(i=>i.railSourceNodeId===f.nodes[0].sourceId));});
test('missing literal crossing context retains the original source-coverage guard',()=>{const f=fixture();f.data.tramSourceCrossings=[];const r=plan(f);assert.equal(r.passed,false);assert.equal(r.pedestrianControlled.length,0);assert.equal(r.unresolved.length,4);assert(r.unresolved.every(i=>i.reason==='missing-controlled-source-crossing-context'));});
test('unavailable coordinates, wrong source IDs and shifted source node cannot masquerade as complete context',()=>{
    for(const mutate of[f=>{f.data.tramSourceCrossings[0].points=null;},f=>{f.data.tramSourceCrossings[0].roadIncidences.forEach(i=>i.sourceId='wOTHER');},f=>{f.nodes[0].x+=1;}]){const f=fixture();mutate(f);const r=plan(f);assert.equal(r.passed,false);assert(r.unresolved.length>0);}
});
test('ordinary railway crossing semantics and missing vehicle controller guards are unchanged',()=>{const f=fixture();for(const n of f.nodes){n.tags.railway='crossing';f.data.tramSourceCrossings[0].nodeTags[String(n.sourceId)].railway='crossing';}const r=plan(f);assert.equal(r.passed,false);assert.equal(r.pedestrianControlled.length,0);assert.equal(r.unresolved.length,4);});
test('contradictory explicit head in another same-node raw context is never masked by earlier pedestrian context',()=>{const f=fixture(),second=structuredClone(f.data.tramSourceCrossings[0]);second.sourceId='wCONTROLLED_TEST';second.nodeTags[String(f.nodes[0].sourceId)]['railway:signal:main']='RO:main';f.data.tramSourceCrossings.push(second);const r=plan(f);assert.equal(r.passed,false);assert(!r.pedestrianControlled.some(p=>p.railSourceNodeId===f.nodes[0].sourceId));});
test('read-only pedestrian report adds no signal head, timing, priority or vehicle state',()=>{const f=fixture(),r=plan(f);for(const n of f.nodes)assert.equal(tramSourceSignalState(f.world,n,n.edges[0],0,11),null);for(const p of r.pedestrianControlled){assert.equal(p.phase,undefined);assert.equal(p.node,undefined);assert.equal(p.controller,undefined);assert.equal(p.vehiclePriority,undefined);assert.equal(p.headLocation,undefined);}});
const report={passed:true,controls:cases.length,cases,browserOpened:false,productionTrafficEdited:false,sourceFixture:'actual cached raw way1559923424 + native54 node/road/controller geometry; controlled fixture direction arrays only, not native54 declarations',scope:'Pure source-semantic classification and existing source/vehicle guard controls; native publication, pedestrian head rendering and tram/ped crossing motion remain separate gates.'};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,controls:cases.length,browserOpened:false}));
