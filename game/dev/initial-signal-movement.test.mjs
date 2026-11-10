import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialSignalMovement} from '../src/initial-signal-movement.js';
import {Traffic} from '../src/traffic.js';
import {signalState} from '../src/signals.js';

const raw=JSON.parse(fs.readFileSync(new URL('./fixtures/basarab-initial-signal-movement.json',import.meta.url)));
const cl={nodes:[],phaseCount:4,offset:0},nodes=new Map(),edges=new Map();
for(const row of [raw.car.edge,...raw.car.route.map(r=>r.e),...raw.upstream.map(r=>r.edge)]) {
    for(const p of [row.a,row.b]) if(!nodes.has(p.id)) {
        const n={...p,radius:7.5,edges:[]};delete n.cluster;
        if(p.cluster){n.lightCluster=cl;cl.nodes.push(n);}nodes.set(n.id,n);
    }
    const a=nodes.get(row.a.id),b=nodes.get(row.b.id),e={...row,a,b,nx:-row.dirz,nz:row.dirx,laneW:3.3,halfW:row.lanesF*3.3/2,access:{sourceId:row.source}};
    edges.set(e.id,e);a.edges.push(e);b.edges.push(e);
}
const v={id:194,edge:edges.get(1246),dir:1,s:raw.car.s,odo:0,length:4.69,width:1.83,lane:1,laneCur:2,
    route:raw.car.route.map(r=>({e:edges.get(r.e.id),dir:r.dir}))};
const input=JSON.stringify(raw),pose=()=>[v.edge.id,v.dir,v.s,v.odo,v.lane,v.laneCur,v.route.map(r=>r.e.id)];
const before=pose(),owner=initialSignalMovement(v);
assert.equal(owner.controller,cl);
assert.deepEqual(owner.origins.map(n=>n.id).sort((a,b)=>a-b),[908,938]);
assert.equal(owner.phase,-1,'ambiguous original entry phases do not become a guessed green');
assert.deepEqual(pose(),before);assert.equal(JSON.stringify(raw),input);
for(const change of [{odo:.001},{_moveGeneration:1},{inactive:true},{parked:true},{tram:true},{isPolice:true},{s:NaN},{s:-1},{dir:0}])
    assert.equal(initialSignalMovement({...v,...change}),null,JSON.stringify(change));
assert.equal(initialSignalMovement(v,()=>true,30),null,'overlong upstream source span stays unresolved');
assert.equal(initialSignalMovement({...v,route:[{...v.route[0],uturn:true}]}),null);
assert.equal(initialSignalMovement({...v,route:v.route.slice(1)}),null,'disconnected next leg cannot create ownership');
assert.equal(initialSignalMovement(v,(a,ad,b)=>b.id!==1247),null,'forbidden forward turn is refused');
const head=nodes.get(908);head.lightCluster={};assert.equal(initialSignalMovement(v),null,'another upstream controller is ambiguous');head.lightCluster=cl;
const missing=edges.get(1244),id=missing.access.sourceId;delete missing.access.sourceId;
assert.equal(initialSignalMovement(v),null,'missing literal source provenance is refused');missing.access.sourceId=id;
const branch=nodes.get(939),outside={sourceId:999,edges:[]},entry={a:outside,b:branch,len:10,lanesF:1,oneway:true,access:{sourceId:'w999'}};
outside.edges.push(entry);branch.edges.push(entry);
assert.equal(initialSignalMovement(v),null,'an uncontrolled external entry cannot be treated as already committed');branch.edges.pop();
const approach={...v,edge:edges.get(850),s:0,route:[...raw.upstream.find(r=>r.edge.id===850).path].reverse().slice(1).map(r=>({e:edges.get(r.id),dir:r.dir}))};
assert.equal(initialSignalMovement(approach),null,'a missing complete forward route does not gain admission');
const t=Object.create(Traffic.prototype);Object.assign(t,{world:{lights:cl.nodes.map(node=>({node})),nodeLight:{}},time:0,boxes:new Map()});
const n=v.edge.b,path=t.reservationPath(v,v.edge,v.dir,v.route[0],n,n.radius,cl);
Object.assign(path,{v,t:0,t0:-1,entered:true,phase:-1});t.boxes.set(cl,[path]);
assert.ok(path.internalEdges.has(edges.get(1247))&&path.internalEdges.has(edges.get(1101)));
assert.equal(path.outE,edges.get(1102),'reservation ends beyond the last linked head');
t.syncSignalOccupancy();assert.deepEqual(cl.occupiedPhases,[-1]);
for(let phase=0;phase<4;phase++)assert.equal(signalState(cl,phase,phase*11+1,11),'red','unknown occupied phase holds all new conflicting greens');
assert.equal(t.inBox(path,cl),true,'the initial inside body retains its finite clearance reservation');
assert.ok(Number.isFinite(t.laneDropStop(v,2,9.1,7.5,2)),'an uncommitted wide approach still stops before an unfinished lane drop');
assert.equal(t.laneDropStop(v,2,9.1,7.5,2,true),Infinity,'a committed internal movement can finish its travel-bounded merge; native body guards still apply');
v.odo=path.clearOdo;t.syncSignalOccupancy();t.pruneBoxes();assert.deepEqual(cl.occupiedPhases,[]);assert.equal(t.boxes.size,0);
console.log('PASS: actual Basarab194 literal internal ownership; unknown phase, source/direction/turn/branch/length/relocation refusals; linked rear clearance and phase hold');
