import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as turns from '../../../../game/src/turn-lanes.js';
import { ambientTrafficAccess } from '../../../../game/src/road-access.js';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const fixtureDir=path.join(here,'fixtures/4621127');
const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(fixtureDir,'fixture.json.gz'))));
const source=(name)=>zlib.gunzipSync(fs.readFileSync(path.join(fixtureDir,name+'.gz'))).toString();
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const name of ['traffic.js','nav.js','util.js'])assert.equal(sha(source(name)),fixture.sourceFiles.find(f=>f.path.endsWith('/'+name)).sha256);
function load(traffic){
    const context={Math,console,ambientTrafficAccess,...turns}; vm.createContext(context);
    const clean=s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
    const util=source('util.js').split('const _HBOX')[0];
    vm.runInContext(clean(util)+'\n'+clean(source('nav.js'))+'\n'+clean(traffic)+'\nglobalThis.N={Traffic,Grid,vvPen,makeRng,laneOffset};',context);
    return context.N;
}
const old=load(source('traffic.js')),candidate=load(fs.readFileSync(path.join(root,'game/src/traffic.js'),'utf8'));
function graph(){
    const edges=new Map(),nodes=new Map();
    const roads=new Map(Object.entries(fixture.worldData.roadSourceGeometry).map(([i,g])=>[g.sourceId,{i:+i,r:fixture.worldData.roads[i],width:fixture.worldData.roadWidths?.[i]}]));
    function node(n){let o=nodes.get(n.id);if(!o)nodes.set(n.id,o={...n,y:n.y??0});return o;}
    for(const e of fixture.recordedEdges){
        const r=roads.get(e.sourceId),w=r.width,raw=r.r;
        const o={...e,a:node(e.a),b:node(e.b),road:r.i,laneW:w?.laneWidthM??raw[5]/10,oneway:!!(raw[8]&1),laneCenterShiftM:w?.laneCenterShiftM||0,
            median:raw[8]&1?-2*e.wL:(w?.medianM??raw[4]/10),type:fixture.worldData.classes?.[raw[1]]||'primary',maxspeed:raw[7]/3.6,busLane:!!(raw[8]&16),main:true};
        edges.set(o.id,o);
    }
    for(const n of nodes.values())n.edges=n.edges.map(e=>edges.get(e.id)||e);
    return{edges,nodes};
}
function vehicle(v,G){
    return {desiredMul:1,speed:0,stuck:0,still:0,honkAt:1e9,honkCd:0,lateralExtra:0,latExtraCur:0,annoyed:0,bubbleCd:0,ghost:0,odo:0,stopTimer:0,laneChangeCd:1e9,blockT:0,latBlend:0,
        ...v,edge:G.edges.get(v.edge.id),route:(v.route||[]).map(r=>({...r,e:G.edges.get(r.edge.id)})),hist:[],
        mesh:{position:{set(){}},rotation:{set(){}}}};
}
function controller(N,G){
    const T=Object.create(N.Traffic.prototype);
    T.world={data:fixture.worldData,graph:{edges:[...G.edges.values()]},nodeLight:{}};
    T.turnLaneRules=turns.buildTurnLaneRules(T.world.data,T.world.graph.edges);
    T.rng=N.makeRng(99);T.buc=true;T.chaos=.5;T.boxes=new Map();T.sharedLanes={entry(){return null;},advance(){}};T.busStops=new Map();
    T.jamMax=0;T._frame=0;T.time=0;T.stats={};T.grid=new N.Grid(16);T.vehicles=[];
    T.peds={obstacleGap(){return Infinity;},crossingAt(){return false;},grid:{query(){}}};
    return T;
}
const tests=[],metrics={};
function test(name,fn){fn();tests.push({name,pass:true});}
const edge=(heading,lanes=3)=>({dirx:Math.sin(heading),dirz:Math.cos(heading),lanesF:lanes,lanesB:lanes,oneway:false,a:{id:0},b:{id:1,edges:[1,2,3]}});
test('explicit turn tokens, slight/through/sharp/reverse and side negatives',()=>{
    for(const[token,degrees]of[['through',0],['through',20],['left',-90],['left',-60],['slight_left',-20],['slight_right',45],['sharp_right',140],['reverse',180]])assert(turns.turnTokenAllows(token,degrees*Math.PI/180),token);
    for(const[token,degrees]of[['through',90],['left',90],['right',-90],['slight_left',-90],['sharp_right',45],['left',180],['reverse',90]])assert(!turns.turnTokenAllows(token,degrees*Math.PI/180),token);
});
test('unmapped/none/unsupported/count-mismatch preserve default',()=>{
    assert.equal(turns.parseTurnLanes('left|right',3),null);assert.equal(turns.parseTurnLanes('',2),null);
    const e=edge(0),n=edge(Math.PI/2),r=new Map([[e,{1:turns.parseTurnLanes('none|through|unknown',3)}]]);
    assert(turns.laneTurnAllowed(r,e,1,0,n,1));assert(turns.laneTurnAllowed(r,e,1,2,n,1));assert(!turns.laneTurnAllowed(r,e,1,1,n,1));
    assert(turns.laneTurnAllowed(new Map(),e,1,1,n,1));
});
test('constructor fleet generation remains byte-identical; pure source policy mutates no inputs/RNG',()=>{
    for(const name of ['spawnAll','spawn','setupTransit'])assert.equal(candidate.Traffic.prototype[name].toString(),old.Traffic.prototype[name].toString());
    const G=graph(),data=JSON.stringify(fixture.worldData),edges=[...G.edges.values()],before=edges.map(e=>({...e}));
    const random=Math.random;Math.random=()=>{throw Error('unexpected RNG');};try{turns.buildTurnLaneRules(fixture.worldData,edges);}finally{Math.random=random;}
    assert.equal(JSON.stringify(fixture.worldData),data);for(let i=0;i<edges.length;i++)assert.deepEqual(edges[i],before[i]);
});
test('direction-specific rules only at source terminal; internal shape points unrestricted',()=>{
    const a={id:0},b={id:1},c={id:2},e={...edge(0,2),a,b,road:0},f={...edge(0,2),a:b,b:c,road:0};
    const r=turns.buildTurnLaneRules({roads:[[0,0,2,2,0,35,0,50,0,0,0,1,2]],strings:['left|right','right|left'],turnLanes:[0,0,1]},[e,f]);
    assert(!r.get(e)?.[1]);assert(r.get(f)?.[1]);assert(r.get(e)?.[-1]);assert(!r.get(f)?.[-1]);
    assert(!turns.laneTurnAllowed(r,f,1,0,edge(-Math.PI/2),1));
});
test('clipped source endpoints do not inherit a distant arrow; prepared reverse one-way exits match raw start',()=>{
    const a={id:0,sourceId:200},b={id:1,sourceId:100},e={...edge(0,2),a,b,road:0,oneway:true};
    const data={roads:[[0,0,2,0,0,35,0,50,1,0,0,1]],strings:['left|right'],turnLanes:[0,0,-1],roadSourceGeometry:{0:{nodeIds:[100,200],tags:{oneway:'-1'}}}};
    assert(turns.buildTurnLaneRules(data,[e]).get(e)?.[1]);
    b.sourceId=150;assert(!turns.buildTurnLaneRules(data,[e]).get(e)?.[1]);
});
test('actual source124 permits hatch lane1 EAST(left), estate lane3 WEST(right)',()=>{
    const G=graph(),T=controller(candidate,G),e=G.edges.get(124),west=G.edges.get(157),east=G.edges.get(142);
    assert.equal(fixture.worldData.roadSourceGeometry[e.road].tags['turn:lanes'],'left|left|left;through|right');
    assert.equal(fixture.worldData.roads[e.road].at(-1),139);
    assert.equal(fixture.worldData.roadSourceGeometry[e.road].nodeIds.at(-1),31404739);
    assert.equal(e.b.id,139);assert.equal(e.b.sourceId,31404739);
    assert(!T.turnLaneRules.get(G.edges.get(123))?.[1]);assert(T.turnLaneRules.get(e)?.[1]);
    assert(!T.turnLaneAllows(e,1,1,{e:west,dir:-1},{}));assert(T.turnLaneAllows(e,1,1,{e:east,dir:1},{}));
    assert(!T.turnLaneAllows(e,1,3,{e:east,dir:1},{}));assert(T.turnLaneAllows(e,1,3,{e:west,dir:-1},{}));
    for(const[id,lane]of[[2,1],[423,3]]){
        const v={id,lane};for(let i=0;i<100;i++){const n=T.chooseNext(e,1,v);assert(n);assert(T.turnLaneAllows(e,1,lane,n,v));}
    }
});
test('actual turns retain their approach lanes; literal straight short segments merge early',()=>{
    const G=graph(),T=controller(candidate,G),e=G.edges.get(124),v={edge:e,dir:1,lane:3,s:11,length:4.69,route:[{e:G.edges.get(157),dir:-1}]};
    assert.equal(T.laneDropMax(v,60),3);
    const a={id:1,edges:[]},b={id:2,edges:[1,2]},c={id:3,edges:[]};
    const first={...edge(0,3),a,b,len:4},second={...edge(.03,1),a:b,b:c,len:5};
    assert.equal(T.laneDropMax({edge:first,dir:1,lane:2,s:0,length:12,route:[{e:second,dir:1}]},60),0);
});
test('route continuation uses predicted 3→1→3 entry lane rather than initial lane2',()=>{
    const G=graph(),T=controller(candidate,G),a={id:10,edges:[]},b={id:11,edges:[]},c={id:12,edges:[]},z={id:13,edges:[]};
    const e={...edge(0,3),a,b,len:4},f={...edge(0,1),a:b,b:c,len:4},g={...edge(0,3),a:c,b:z,len:200};a.edges=[e];b.edges=[e,f];c.edges=[f,g];z.edges=[g];
    const calls=[];T.chooseNext=(e,dir,v,lane)=>{calls.push(lane);return e===g?null:{e:e===f?g:f,dir:1};};
    const v={edge:e,dir:1,lane:2,s:0,route:[]};T.ensureRoute(v);assert.deepEqual(calls,[2,0]);
    assert.equal(T.routeLaneAt(v,g,1),0);assert.equal(T.boxPath(v,f,1,{e:g,dir:1},3).laneIn,0);
});
test('existing route invalidated by a mapped approach lane change before motion',()=>{
    const G=graph(),T=controller(candidate,G),v=vehicle({...fixture.firstPublication.publicResolved.actors.find(v=>v.id===423),route:[{edge:G.edges.get(142),dir:1}]},G);
    T.ensureRoute(v);assert(v.route[0]);assert.notEqual(v.route[0].e.id,142);assert(T.turnLaneAllows(v.edge,v.dir,v.lane,v.route[0],v));
});
test('mapped no-legal-exit cannot fall back to an unpermitted U-turn',()=>{
    const G=graph(),T=controller(candidate,G),a={id:1,edges:[]},b={id:2,edges:[]},e={...edge(0,1),a,b,len:5};a.edges=[e];b.edges=[e];
    T.turnLaneRules=new Map([[e,{1:turns.parseTurnLanes('through',1)}]]);assert.equal(T.chooseNext(e,1,{lane:0}),null);
    T.turnLaneRules=new Map();assert.equal(T.chooseNext(e,1,{lane:0}).uturn,true);
});
test('697 exact recorded native proposed hatch placements reconstruct to floating-point precision',()=>{
    const G=graph(),T=controller(old,G);let max=0;
    for(const s of fixture.observation.vehicleSteps){const q=vehicle(s.after,G);Object.assign(q,{x:s.before.x,z:s.before.z,heading:s.before.heading});T.placeOnLane(q,false,1/30);for(const k of ['x','z','heading'])max=Math.max(max,Math.abs(q[k]-s.after[k]));}
    assert(max<1e-12);metrics.oldPlacementReconstruction={count:fixture.observation.vehicleSteps.length,maxError:max,reconstructedNotRecorded:['latExtraCur=0','lateralExtra=0','empty history on initial edge']};
});
test('right-turn 3→0 node handoff preserves exact path points and bounded body travel',()=>{
    const G=graph(),T=controller(candidate,G),e=G.edges.get(124),v=vehicle({...fixture.firstPublication.publicResolved.actors.find(v=>v.id===423),s:e.len+.001,speed:1,route:[{edge:G.edges.get(157),dir:-1},{edge:G.edges.get(156),dir:-1}]},G);
    const before={};T.pathPoint(v,0,before);const oldLane=v.laneCur;T.advance(v);const after={};T.pathPoint(v,0,after);
    assert.equal(oldLane,3);assert.equal(v.laneCur,0);assert(Math.hypot(after.x-before.x,after.z-before.z)<1e-9);
    assert(Number.isFinite(v.hist[0].lat));metrics.handoffPathDeltaM=Math.hypot(after.x-before.x,after.z-before.z);
    const x=v.x,z=v.z;T.placeOnLane(v,false,1/30);assert(Math.hypot(v.x-x,v.z-z)<=1/30*Math.hypot(1,.45)+1e-9);
});
test('long-body axle path stays continuous at3→0 handoff, and stopped bodies hold',()=>{
    const G=graph(),T=controller(candidate,G),e=G.edges.get(124),v=vehicle({...fixture.firstPublication.publicResolved.actors.find(v=>v.id===423),s:e.len+.001,speed:1,long:true,length:12,route:[{edge:G.edges.get(157),dir:-1},{edge:G.edges.get(156),dir:-1}]},G);
    const before=[-v.length*.36,0,v.length*.36].map(off=>T.pathPoint(v,off,{}));T.advance(v);
    const after=[-v.length*.36,0,v.length*.36].map(off=>T.pathPoint(v,off,{}));
    for(let i=0;i<3;i++)assert(Math.hypot(before[i].x-after[i].x,before[i].z-after[i].z)<1e-9);
    T.placeOnLane(v,false,1/30);v.speed=0;const held=[v.x,v.z,v.heading,v.laneCur];
    for(let i=0;i<100;i++){T.steerLane(v,1/30);T.placeOnLane(v,false,1/30);}assert.deepEqual([v.x,v.z,v.heading,v.laneCur],held);
});
test('future path 3→1→3 does not restore the original lane on the widened leg',()=>{
    const G=graph(),T=controller(candidate,G),e=G.edges.get(124),f=G.edges.get(157),g=G.edges.get(142),v=vehicle({...fixture.firstPublication.publicResolved.actors.find(v=>v.id===423),route:[{edge:f,dir:-1},{edge:g,dir:1}]},G);
    const seen=[],original=T.lanePt;T.lanePt=function(v,c,s,o){seen.push({edge:c.e.id,laneCur:c.laneCur});return original.call(this,v,c,s,o);};
    T.pathPoint(v,e.len+f.len+15,{});assert(seen.some(x=>x.edge===g.id&&x.laneCur===0));
});

test('source-legal 2/423 native stepVehicle trajectories, actual624 frozen body controls',()=>{
    const trials=[];
    for(const westId of [157,158]){
        const G=graph(),T=controller(candidate,G),all=fixture.firstPublication.publicResolved.actors;
        T.vehicles=all.map(v=>({...v,edge:G.edges.get(v.edge.id)||v.edge,layer:v.edge.layer||0,speed:0,route:[],fx:-Math.sin(v.heading),fz:-Math.cos(v.heading),parked:!!v.parked}));
        const initial=Object.fromEntries([2,423].map(id=>[id,all.find(v=>v.id===id)]));
        const targets=[2,423].map(id=>vehicle(initial[id],G));
        targets[0].route=[{e:G.edges.get(142),dir:1},{e:G.edges.get(143),dir:1},{e:G.edges.get(144),dir:1}];
        targets[1].route=[{e:G.edges.get(westId),dir:westId===157?-1:1}];
        for(const v of targets)T.vehicles[T.vehicles.findIndex(o=>o.id===v.id)]=v;
        // Fixed exact source legs make this a bounded motion-method control,
        // independent of uncaptured distant graph/routing and moving peers.
        T.ensureRoute=()=>{};
        let pairMax=-Infinity,allMax=-Infinity,contacts=0,maxStep=0,steps=0;const bodyContacts=new Map();
        for(let k=0;k<240;k++){
            T._frame++;T._dt=1/30;T.time+=1/30;T.grid.build(T.vehicles);
            for(const v of targets){const x=v.x,z=v.z;T.stepVehicle(v,1/30);maxStep=Math.max(maxStep,Math.hypot(v.x-x,v.z-z));}
            T.overlapGuard();steps++;
            pairMax=Math.max(pairMax,candidate.vvPen(targets[0],targets[1]));
            for(const v of targets)for(const o of T.vehicles){if(o===v||Math.abs(o.y-v.y)>2)continue;const pen=candidate.vvPen(v,o);allMax=Math.max(allMax,pen);if(pen>0){contacts++;const key=v.id+':'+o.id,r=bodyContacts.get(key)||{id:v.id,other:o.id,kind:o.kind,samples:0,maxPenM:0};r.samples++;r.maxPenM=Math.max(r.maxPenM,pen);bodyContacts.set(key,r);}}
            if(targets.some(v=>v.s+1>=v.edge.len&&v.route.length===0))break;
        }
        const trial={westId,steps,pairMaxPenM:pairMax,allKnownBodyMaxPenM:allMax,positiveTargetContactSamples:contacts,maxStepM:maxStep,guard:T.stats.guard||0,
            positiveContacts:[...bodyContacts.values()],targets:targets.map(v=>({id:v.id,edge:v.edge.id,lane:v.lane,laneCur:v.laneCur,odo:v.odo,centerProgressM:Math.hypot(v.x-initial[v.id].x,v.z-initial[v.id].z),x:v.x,z:v.z,heading:v.heading}))};
        trials.push(trial);
        assert(pairMax<=0,JSON.stringify(trial));assert(allMax<=.05,JSON.stringify(trial));assert(maxStep<.25,JSON.stringify(trial));
        assert(targets.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.z)));
    }
    metrics.nativeStepControls={scope:'Exact624 publication body poses; only2/423 move through native stepVehicle/overlapGuard, native source legs fixed explicitly. Nominal no-hotspot test, pedestrians/static/signals outside captured local graph are not certified; moving-fleet acceptance requires native replay.',trials};
});

const report={sourceBase:'f320b747436ad98d6ac6624ce587d5666178e4df',nativeCounterexampleSource:fixture.sourceCommit,raw:fixture.raw,pass:true,tests,metrics,
    scope:'Pure source policy and native CPU method controls. Full native evolving all-population replay remains required; no browser started.'};
const out=process.argv.find(s=>s.startsWith('--out='))?.slice(6);if(out){if(fs.existsSync(out))throw Error('Output must be new');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
