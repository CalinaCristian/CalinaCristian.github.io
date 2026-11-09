import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Pedestrians } from '../src/traffic.js';
import { EdgeIndex } from '../src/nav.js';
import * as THREE from '../vendor/three.module.min.js';

const baselineArg=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
const Base=baselineArg?(await import(pathToFileURL(path.resolve(baselineArg,'game/src/traffic.js')).href)).Pedestrians:null;

const node = (x, z) => ({ x, z, radius: 3, edges: [] });
function edge(a, b, width = 3) {
    const len = Math.hypot(b.x-a.x, b.z-a.z), dirx = (b.x-a.x)/len, dirz = (b.z-a.z)/len;
    const e = { id: edgesSerial++, a, b, len, dirx, dirz, nx: -dirz, nz: dirx, wR: width, wL: width,
        halfW: width, sidewalk: 2.5, type: 'residential', ya: 0, yb: 0, layer: 0 };
    a.edges.push(e); b.edges.push(e); return e;
}
let edgesSerial = 0;
function walkers(edges, vehicles = []) {
    const C = Object.create(Pedestrians.prototype);
    C.t = { world: { district: true, buildings: [], walkTop: () => .13 }, index: new EdgeIndex(edges), stats: {},
        grid: { items: vehicles, query(x,z,r,fn) { for (const v of vehicles) if (Math.hypot(v.x-x,v.z-z)<r) fn(v); } } };
    C.list=[]; C.crowd={ reach: () => .3, set() {}, markDirty() {} };
    C._walkSpace=new Map(); C._side=new Map(); C.obsGrid={query(){}};
    C.grid={query(){}}; C.crossCount=new Map(); C.stats={};
    C.rng=()=>{throw Error('Initial admission must consume zero RNG');};
    return C;
}
const junction=node(0,0), incoming=edge(node(-20,0),junction), crossing=edge(junction,node(0,40));
const C=walkers([incoming,crossing]);
const originalBubble=()=>2.2;
const p={i:401,x:-1,z:4.375,e:incoming,s:19,side:1,dir:-1,state:'walk',legs:[],speed:1.3,phase:.5,scale:1};
Object.defineProperty(p,'bubbleY',{get:originalBubble,enumerable:true}); C.list=[p];
assert.ok(C.roadAt(p.x,p.z),'the initial source sidewalk runs through the adjacent carriageway');
assert.equal(C.admitInitialWalk(p),true);
assert.equal(C.freeWalkPoint(p.x,p.z,C.reach(p)),true);
assert.equal(C.roadAt(p.x,p.z),null);
assert.equal(C.list.length,1); assert.equal(C.list[0],p); assert.equal(p.i,401);
assert.equal(Object.getOwnPropertyDescriptor(p,'bubbleY').get,originalBubble,'pose admission preserves actor accessors');
assert.deepEqual([p.speed,p.phase,p.scale],[1.3,.5,1]);
const safe={x:p.x,z:p.z,e:p.e,s:p.s,side:p.side,dir:p.dir};
assert.equal(C.admitInitialWalk(p),false,'an already clear source pose stays exact');
assert.deepEqual(Object.fromEntries(Object.keys(safe).map(k=>[k,p[k]])),safe);
p.live=true; p.x=-1; p.z=4.375;
assert.equal(C.admitInitialWalk(p),false,'a visible person never receives initial-placement correction');
assert.deepEqual([p.x,p.z],[-1,4.375]);
p.live=false; const count=C.list.length; C.freeWalkPoint=()=>false;
assert.equal(C.admitInitialWalk(p),false,'genuinely exhausted capacity remains an explicit diagnostic');
assert.equal(C.stats.initialWalkUnresolved,1); assert.equal(C.list.length,count); assert.equal(p.hidden,undefined);

// Bus-stop groups retain their stop and standing state. Repair physical bench
// or peer contacts, but a clear group and an overhead shelter stay exact.
const stopEdge=edge(node(0,0),node(40,0));
const S=walkers([stopEdge]); S.stops=[{x:10,z:4.375}];
const waiter={i:0,x:10,z:4.375,state:'stand',heading:.7,scale:1}; S.list=[waiter];
S.t.world.buildings=[{x:10,z:4.375,r:1,hw:.6,hd:.3,angle:0,prop:true,kind:'bench',h:.8}];
assert.equal(S.admitInitialStand(waiter),true,'an initial physical bench contact moves to a source-sidewalk slot at the same stop');
assert.equal(waiter.state,'stand'); assert.equal(waiter.heading,.7);
assert.ok(Math.hypot(waiter.x-10,waiter.z-4.375)<=8);
assert.equal(S.freeWalkPoint(waiter.x,waiter.z,.3),true);
const standingPose={x:waiter.x,z:waiter.z};
S.list.push({i:1,x:waiter.x+.7,z:waiter.z,state:'stand'});
assert.equal(S.admitInitialStand(waiter),false,'a physically clear waiting group is retained');
assert.deepEqual({x:waiter.x,z:waiter.z},standingPose);
S.list[1].x=waiter.x; assert.equal(S.admitInitialStand(waiter),true,'a real peer-body overlap is repaired before visibility');
waiter.live=true; S.list[1].x=waiter.x; S.list[1].z=waiter.z;
assert.equal(S.admitInitialStand(waiter),false,'no later standing teleport');
const roof=walkers([stopEdge]); roof.stops=S.stops;
const underRoof={i:0,x:10,z:4.375,state:'stand',heading:0};roof.list=[underRoof];
roof.t.world.buildings=[{x:10,z:4.375,r:2,hw:2,hd:1,angle:0,prop:true,minH:3,h:3.2,kind:'shelter-roof'}];
assert.equal(roof.admitInitialStand(underRoof),false,'the native height-aware collider permits open air under an overhead shelter');
assert.deepEqual([underRoof.x,underRoof.z],[10,4.375]);
const platform=walkers([stopEdge]);platform.stops=[{x:100,z:100}];platform.crowd.reach=()=>.38;
const atPlatform={i:0,x:100,z:100,state:'stand',heading:0};platform.list=[atPlatform];
platform.t.world.buildings=[{x:101.1,z:100,r:.75,hw:.75,hd:.75,angle:0,prop:true,kind:'busstop',h:3}];
assert.equal(platform.freeWalkPoint(100,100,.3),true,'native body is clear at the source platform');
assert.equal(platform.freeWalkPoint(100,100,.38),false,'the carried bag contacts the stop pole');
assert.equal(platform.admitInitialStand(atPlatform),true,'a stop platform can clear a small carried contact without a nearby traffic-graph road');
assert.ok(Math.hypot(atPlatform.x-100,atPlatform.z-100)<=1.5);
assert.equal(platform.freeWalkPoint(atPlatform.x,atPlatform.z,.38),true);

// Reproduce a committed crossing already blocked for three seconds by a stopped
// sedan. The native update must keep prospective body rejection while its
// existing timeout returns to the starting kerb, without a position snap.
const street=edge(node(-30,0),node(30,0));
const sedan={id:264,x:0,z:0,y:.24,heading:-Math.PI/2,length:4.85,width:1.84,speed:0,layer:0};
const D=walkers([street],[sedan]);
const crossingStart=()=>({i:252,x:0,z:-1.7,e:street,s:30,side:-1,dir:1,state:'legs',onRoad:true,live:true,speed:1.6,phase:0,scale:1,
    blockT:3,crossT:3,legs:[{cross:true,started:true,x:0,z:4.375,sx:0,sz:-4.375,len:8.75}],next:{e:street,side:1,dir:1,s:30}});
const q=crossingStart();
D.list=[q]; let maxStep=0, returned=false;
for(let i=0;i<100;i++) {
    const old={x:q.x,z:q.z}; D.update(1/30);
    maxStep=Math.max(maxStep,Math.hypot(q.x-old.x,q.z-old.z));
    assert.ok(!(Math.abs(q.x)<sedan.length/2+.3&&Math.abs(q.z)<sedan.width/2+.3),'the physical pedestrian radius stays clear of the stopped body');
    returned ||= !!q.legs[0]?.back;
}
assert.equal(returned,true,'the blocked native crossing still turns back');
assert.ok(q.z < -3.8,'it physically reaches the starting kerb');
assert.ok(maxStep < .12,'all visible movement remains bounded physical steps');
assert.equal(D.list.length,1);
if(Base) {
    const prior=walkers([street],[sedan]), before=crossingStart();
    prior.list=[before]; prior.update=Base.prototype.update;
    let intrusions=0,minClearance=Infinity;
    for(let i=0;i<100;i++) {
        prior.update(1/30);
        minClearance=Math.min(minClearance,Math.abs(before.z)-sedan.width/2);
        if(Math.abs(before.x)<sedan.length/2+.3&&Math.abs(before.z)<sedan.width/2+.3)intrusions++;
    }
    assert.ok(intrusions>0,'the previous native caller lets the physical pedestrian radius enter the stopped body: '+minClearance);
}

// An already-overlapped crossing that is making safe outward progress must
// not keep ageing its blocked timer and turn back into the same obstacle.
const outward=walkers([street],[sedan]), escaping=crossingStart();
escaping.z=.1; escaping.blockT=3; outward.list=[escaping]; let reversed=false;
for(let i=0;i<100;i++) {
    const old={x:escaping.x,z:escaping.z}; outward.update(1/30);
    reversed ||= !!escaping.legs[0]?.back;
    assert.ok(Math.hypot(escaping.x-old.x,escaping.z-old.z)<.12);
}
assert.equal(reversed,false,'safe penetration-reducing progress does not trigger a blocked-crossing reversal');
assert.ok(escaping.z>3.8,'the native caller actually escapes to the clear far kerb');

// Previous-pose comparison deliberately permits progress out of an existing
// overlap. It does not require one step to clear the whole car body.
const E=walkers([street],[sedan]);
const escape={i:1,x:0,z:.18,state:'legs',live:true,vehiclePushLeft:0,vehiclePushFrame:1}; E._fr=1;
assert.equal(E.avoidVehicles(escape,0,.15,true),false);
assert.equal(escape.z,.18,'monotonic escape still proceeds while partly overlapped');
const inward={i:2,x:0,z:.1,state:'legs',live:true,vehiclePushLeft:0,vehiclePushFrame:1};
assert.equal(E.avoidVehicles(inward,0,.15,true),true);
assert.equal(inward.z,.15,'a deeper step is refused rather than teleported through');
const closing=walkers([street],[{...sedan,z:.1}]); closing._fr=1; closing._stepDt=1/30;
const pushed={i:9,x:0,z:1.25,state:'legs',live:true};
closing.avoidVehicles(pushed,0,1.25,false);
assert.ok(pushed.z>1.25&&pushed.z-1.25<=1.45/30+1e-9,'an already closing vehicle pushes at bounded walking pace');
const once=pushed.z; closing.avoidVehicles(pushed,pushed.x,pushed.z,false);
assert.equal(pushed.z,once,'repeated callers share one physical-step push budget');
// The collision uses the actual turning model heading, rather than its road axis.
const bus={...sedan,id:8,length:12,width:2.5,heading:0};
const F=walkers([street],[bus]); F._fr=1;
const atBus={i:3,x:1.85,z:0,state:'legs',live:true,vehiclePushLeft:0,vehiclePushFrame:1};
assert.equal(F.avoidVehicles(atBus,2.05,0,true),true);
assert.equal(atBus.x,2.05);
const upper={...sedan,y:8,layer:1};
const G=walkers([street],[upper]); G._fr=1;
const below={i:4,x:0,z:0,state:'legs',live:true,vehiclePushLeft:0,vehiclePushFrame:1};
assert.equal(G.avoidVehicles(below,0,-.1,true),false,'a real other-level vehicle does not block a ground walker');

// Construct every native actor on an intersecting source-like street grid.
// The admission pass must preserve actor IDs and future RNG values, including
// when geometry needs initial repairs. No renderer or population cap is mocked.
function gridTraffic(buc) {
    const nodes=Array.from({length:11},(_,j)=>Array.from({length:11},(_,i)=>node(i*24,j*24))),edges=[];
    for(let j=0;j<11;j++)for(let i=0;i<11;i++) { if(i<10)edges.push(edge(nodes[j][i],nodes[j][i+1])); if(j<10)edges.push(edge(nodes[j][i],nodes[j+1][i])); }
    return {buc,city:{id:buc?'bucharest':'seattle'},group:new THREE.Group(),stats:{},
        world:{district:true,graph:{edges,nodes:nodes.flat()},pois:[],buildings:[],walkTop:()=>.13},
        index:new EdgeIndex(edges),grid:{items:[],query(){}}};
}
for(const [buc,count] of [[true,560],[false,180]]) {
    const fixed=new Pedestrians(gridTraffic(buc),count);
    assert.equal(fixed.list.length,count); assert.equal(fixed.crowd.count,count);
    assert.deepEqual(fixed.list.map(p=>p.i),Array.from({length:count},(_,i)=>i));
    assert.ok(fixed.list.every(p=>p.live&&!p.hidden));
    assert.ok((fixed.stats.initialWalkRepairs||0)>0,'the constructor fixture actually exercises previsible repairs');
    assert.equal(fixed.stats.initialWalkUnresolved||0,0,'the grid fixture has sufficient real clear capacity for every repair');
    // Retained c78 constructor stream fixtures, including all original unused
    // colour draws. Physical admission must not change the future logic stream.
    const future=Array.from({length:32},()=>fixed.rng());
    const expected=buc?'8dd7a4860eb532c7ff7da0f19c3a9c227dba325192e74ec27ab52b0b3b218d3b':'16a04a8c238aba4ff7deb0115a2da0327e3b4d41241ebafd1e3fedabb75e408f';
    assert.equal(createHash('sha256').update(JSON.stringify(future)).digest('hex'),expected);
    if(Base) {
        const base=new Base(gridTraffic(buc),count);
        assert.deepEqual(fixed.list.map(p=>[p.i,p.speed,p.phase,p.scale]),base.list.map(p=>[p.i,p.speed,p.phase,p.scale]));
        assert.deepEqual(future,Array.from({length:32},()=>base.rng()),'future logic RNG values remain byte-exact');
        base.dispose();
    }
    fixed.dispose();
}
console.log('PASS: initial corner admission, live-pose protection, full actors/RNG, stopped crossing, monotonic escape, turning body and other-level controls');
