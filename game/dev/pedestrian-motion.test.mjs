import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic,Pedestrians} from '../src/traffic.js';
import {EdgeIndex} from '../src/nav.js';
import {collideBuildings} from '../src/world.js';

class EmptyTraffic extends Traffic {setupTransit(){} buildBusStops(){} spawnAll(){}}
function scene(Impl=Pedestrians) {
    const empty=new EmptyTraffic({graph:{edges:[],nodes:[]},buildings:[],walkTop:()=>.13},{id:'seattle'},new THREE.Scene(),{maxPeds:0});
    const a={id:0,x:0,z:0,radius:2,edges:[]},b={id:1,x:200,z:0,radius:2,edges:[]};
    const e={id:1,a,b,len:200,dirx:1,dirz:0,nx:0,nz:1,wR:3,wL:3,halfW:3,sidewalk:3,type:'residential',ya:0,yb:0};a.edges=[e];b.edges=[e];
    const C=Object.create(Impl.prototype);
    Object.assign(C,{t:{world:{district:true,buildings:[],walkTop:()=>.13},index:new EdgeIndex([e]),stats:{},grid:{items:null}},list:[],crowd:{reach:()=>.3,set(){}},grid:empty.peds.grid,obsGrid:empty.peds.obsGrid,
        stats:{},_fr:0,_walkSpace:new Map(),_side:new Map(),crossCount:new Map(),rng:()=>{throw Error('The focused physical controls must add no RNG call');}});
    C.obs=[];
    const person=(id,s,dir=1,speed=1.6)=>({i:id,x:s,z:4.6,e,s,side:1,dir,state:'walk',legs:[],heading:-dir*Math.PI/2,speed,phase:0,scale:1,live:true,waitT:0,walkOff:0});
    return {C,e,person};
}
function run(C,steps){let minimum=Infinity,maxStep=0;for(let i=0;i<steps;i++){const old=C.list.map(p=>[p.x,p.z]);C.buildGrid();C.update(1/30);for(let a=0;a<C.list.length;a++){maxStep=Math.max(maxStep,Math.hypot(C.list[a].x-old[a][0],C.list[a].z-old[a][1]));for(let b=a+1;b<C.list.length;b++)minimum=Math.min(minimum,Math.hypot(C.list[a].x-C.list[b].x,C.list[a].z-C.list[b].z));}}return{minimum,maxStep};}
const head=scene();head.C.list=[head.person(1,10),head.person(2,13,-1)];
const h=run(head.C,240);
assert.ok(h.minimum>=.6-1e-6,'head-on source walkers never admit a new body-envelope contact');
assert.ok(head.C.list[0].x>13&&head.C.list[1].x<10,'both head-on walkers physically pass and keep making progress');
assert.ok(h.maxStep<.13,'passing uses bounded physical steps');
const following=scene();following.C.list=[following.person(1,10,1,1.8),following.person(2,11.1,1,.7)];
const f=run(following.C,240);assert.ok(f.minimum>=.6-1e-6);assert.ok(following.C.list[0].x>17,'the faster follower keeps physical progress while passing');

const legs=scene(),leg=legs.person(1,10),opposite=legs.person(2,13,-1);
leg.state='legs';leg.legs=[{x:14,z:4.6}];leg.next={e:legs.e,dir:1,side:1,s:14};legs.C.list=[leg,opposite];
const l=run(legs.C,240);assert.ok(l.minimum>=.6-1e-6);assert.ok(leg.x>14&&opposite.x<10,'a blocked leg keeps its target and resumes after physical passing');assert.ok(l.maxStep<.13);
const recovery=scene(),recovering=recovery.person(1,10),standing=recovery.person(2,11.1);
recovering.state='legs';recovering.recovery={x:14,z:4.6,state:'walk',onRoad:false,legs:[]};standing.state='stand';recovery.C.list=[recovering,standing];
const r=run(recovery.C,240);assert.ok(r.minimum>=.6-1e-6);assert.ok(recovering.x>13.8,'a recovery target is reached around a standing body without a warp');assert.ok(r.maxStep<.13);
assert.deepEqual([standing.x,standing.z],[11.1,4.6],'an already clear waiting person retains the source pose');

// Refusing the endpoint must precede node planning and leg/recovery consumption.
// Check both the blocked frame and the later frames for a delayed pose jump.
const nodeCase=scene(),end=nodeCase.person(1,199.985),nodeWait=nodeCase.person(2,200.59);
nodeWait.state='stand';nodeCase.C.list=[end,nodeWait];let nodePlans=0;
nodeCase.C.planNode=()=>{nodePlans++;};nodeCase.C.buildGrid();nodeCase.C.update(1/30);
assert.equal(nodePlans,0,'a blocked endpoint does not consume or choose its next node route');
assert.equal(end.state,'walk');assert.equal(end.e,nodeCase.e);
assert.ok(Math.abs(end.s-end.x)<1e-9,'along-source progress matches the retained physical pose');
assert.ok(Math.abs(end.walkOff-(end.z-4.6))<1e-9,'lateral progress matches the actual sidestep');
const connected=scene();connected.e.len=20;connected.e.b.x=20;
const beyond={id:2,x:100,z:0,radius:2,edges:[]},second={...connected.e,id:2,a:connected.e.b,b:beyond,len:80};
connected.e.b.edges=[connected.e,second];beyond.edges=[second];connected.C.t.index=new EdgeIndex([connected.e,second]);
connected.C.rng=()=>.5;const arrival=connected.person(1,19.985),cornerWait=connected.person(2,20.59);cornerWait.state='stand';connected.C.list=[arrival,cornerWait];
const connectedResult=run(connected.C,360);
assert.ok(connectedResult.minimum>=.6-1e-6);assert.ok(connectedResult.maxStep<.13,'actual node planning/next-edge adoption preserves the physical pose on later frames');
assert.ok(arrival.x>24&&arrival.e===second,'native node/leg planning resumes onto the real connected edge after passing');
const endpoint=scene(),near=endpoint.person(1,13.39),targetWait=endpoint.person(2,14);
near.state='legs';near.legs=[{x:13.44,z:4.6}];near.next={e:endpoint.e,dir:1,side:1,s:13.44};targetWait.state='stand';endpoint.C.list=[near,targetWait];
const next=near.next,legTarget=near.legs[0];endpoint.C.buildGrid();endpoint.C.update(1/30);
assert.equal(near.state,'legs');assert.equal(near.next,next);assert.equal(near.legs[0],legTarget,'a blocked arrival retains the exact pending leg');
assert.deepEqual([legTarget.x,legTarget.z],[13.44,4.6]);
const transition=run(endpoint.C,180);assert.ok(transition.minimum>=.6-1e-6);assert.ok(transition.maxStep<.13,'the eventual leg-state transition has no delayed snap');

const baseline=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
if(baseline){const Old=(await import(pathToFileURL(path.resolve(baseline,'game/src/traffic.js')).href)).Pedestrians,old=scene(Old);old.C.list=[old.person(1,10),old.person(2,13,-1)];const r=run(old.C,240);assert.ok(r.minimum<.4,'the old actual production motion reproduces a true head-on body incursion');console.log(JSON.stringify({legacyHeadOnMinimum:r.minimum,candidateHeadOnMinimum:h.minimum,candidateFollowingMinimum:f.minimum}));}

// The exact retained native4m cell crossing: both people switch buckets before
// separation. Verify the real Grid miss, then the safe dirty-index fallback.
const native=JSON.parse(fs.readFileSync(new URL('./fixtures/unirii-peer-cell-86-199.json',import.meta.url))),n=scene();
n.C.list=native.actors.map((p,i)=>({...p,i:p.id,x:native.indexed[i].x,z:native.indexed[i].z,live:true,scale:p.scale||1}));n.C.buildGrid();
n.C.list.forEach((p,i)=>Object.assign(p,{x:native.actors[i].x,z:native.actors[i].z}));
n.C.grid.fixed=false; // retained negative control: legacy queries read the moved cell from the body
let seen=false;n.C.grid.query(n.C.list[0].x,n.C.list[0].z,1.1,p=>{if(p.i===199)seen=true;});assert.equal(seen,false,'the actual old-cell hash omits native199');
n.C.grid.fixed=true; // production queries retain the indexed cell until a safe rebuild
n.C.list.forEach((p,i)=>n.C.notePeerMove(p,native.indexed[i].x,native.indexed[i].z));
assert.equal(n.C.peerClearStep(n.C.list[0],n.C.list[0].x,n.C.list[0].z,native.indexed[0].x,native.indexed[0].z),false,'dirty membership cannot admit a worsening native contact');
n.C.ensurePeerGrid();seen=false;n.C.grid.query(n.C.list[0].x,n.C.list[0].z,1.1,p=>{if(p.i===199)seen=true;});assert.equal(seen,true);

// A bounded recovery from an existing contact remains possible, while a third
// body must not gain a contact from the correction.
const escape=scene(),p=escape.person(1,10),q=escape.person(2,10.4);p.state=q.state='stand';escape.C.list=[p,q];escape.C.buildGrid();
p.x=9.98;assert.equal(escape.C.guardPeerStep(p,10,4.6,1/30),true);assert.equal(p.x,9.98);
const third=escape.person(3,9.36);third.state='stand';escape.C.list.push(third);escape.C.buildGrid();p.x=9.95;
assert.equal(escape.C.guardPeerStep(p,9.98,4.6,1/30),false,'outward recovery cannot introduce a new third-body contact');assert.equal(p.x,9.98);

// Static clearance cannot undo safe peer separation. The live correction has a
// shared per-frame speed budget and can use a partial outward route around a
// pole when the direct push would enter the waiting peer.
const solid=scene(),s=solid.person(1,10),wait=solid.person(2,10.62);s.state=wait.state='stand';solid.C.list=[s,wait];
const pole={x:9.75,z:4.6,r:.15,hw:.15,hd:.15,prop:true,kind:'pole',h:2};solid.C.t.world.buildings=[pole];solid.C.buildObstacles();solid.C.buildGrid();
const oldDepth=solid.C.obsDepth(s.x,s.z);solid.C._stepDt=1/30;solid.C._fr=1;
solid.C.clearObstacles(s);const first={x:s.x,z:s.z};solid.C.clearObstacles(s);
assert.ok(Math.hypot(s.x-10,s.z-4.6)<=1.45/30+1e-6,'all live static corrections share a single physical-step budget');
assert.ok(Math.hypot(s.x-wait.x,s.z-wait.z)>=.6-1e-6,'static correction never moves into the standing peer');
assert.ok(solid.C.obsDepth(s.x,s.z)<oldDepth,'a blocked direct push still makes partial physical escape around the peer');
assert.ok(Math.hypot(first.x-10,first.z-4.6)>0);

// Exercise the actual pedestrian obstacle index independently of the world's
// building list: both the circle and the rotated OBB must block a separation.
for (const obstacle of [
    {x:3.54,z:4.6,r:.15,box:false},
    {x:3.56,z:4.6,r:.2,box:true,hw:.1,hd:.08,c:Math.cos(.4),s:Math.sin(.4)}
]) {
    const props=scene(),a=props.person(1,4.01),b=props.person(2,4.4);a.state=b.state='stand';props.C.list=[a,b];
    props.C.obs=[obstacle];props.C.obsGrid.build(props.C.obs);props.C.buildGrid();
    assert.equal(props.C.obsDepth(a.x,a.z),0);assert.ok(props.C.obsDepth(a.x-.04,a.z)>0);
    props.C.sepPush(a,-.04,0,b);
    assert.deepEqual([a.x,a.z],[4.01,4.6],'separation cannot enter the indexed prop while world.buildings is empty');
    assert.equal(props.C.obsDepth(a.x,a.z),0);
}
const indexedEscape=scene(),ie=indexedEscape.person(1,4),ib=indexedEscape.person(2,3.7);ie.state=ib.state='stand';indexedEscape.C.list=[ie,ib];
indexedEscape.C.obs=[{x:3.6,z:4.6,r:.15,box:false}];indexedEscape.C.obsGrid.build(indexedEscape.C.obs);indexedEscape.C.buildGrid();
const indexedDepth=indexedEscape.C.obsDepth(ie.x,ie.z);assert.ok(indexedDepth>0);
indexedEscape.C.sepPush(ie,.02,0,ib);assert.ok(ie.x>4);assert.ok(indexedEscape.C.obsDepth(ie.x,ie.z)<indexedDepth,'an already overlapping indexed prop still permits partial outward escape');

const wall=scene();wall.C.list=[wall.person(1,10),wall.person(2,13,-1)];
const slab={x:20,z:5.8,r:30,poly:[[0,5.4],[100,5.4],[100,6.5],[0,6.5]],h:3};wall.C.t.world.buildings=[slab];
const w=run(wall.C,240);assert.ok(w.minimum>=.6-1e-6);
assert.ok(wall.C.list.every(p=>!collideBuildings([slab],p.x,p.z,.3,.14)),'passing remains outside the source facade');
assert.ok(wall.C.list[0].x>13&&wall.C.list[1].x<10,'one blocked passing side does not create permanent gridlock');
console.log('PASS: actual pedestrian head-on/following progress, native cell crossing, partial recovery/third body, shared static correction and facade clearance');

// Broad-phase union versus an independent complete population scan, with
// multiple cell crossings during an outstanding query and mixed heights.
const moving=scene(),random=(()=>{let x=441;return()=>((x=Math.imul(x,1664525)+1013904223>>>0)/4294967296)})();
moving.C.list=Array.from({length:560},(_,i)=>({...moving.person(i,random()*160),z:random()*40,state:i%7?'walk':'stand'}));
moving.C.t.world.walkTop=(x,z)=>x>80&&z>20?5:.13;
const scan=Object.create(Pedestrians.prototype);Object.assign(scan,{list:moving.C.list,t:moving.C.t,grid:{items:null},_peerGridDirty:true});
for(let frame=0;frame<40;frame++){
 moving.C.buildGrid();
 for(let i=0;i<100;i++){
  const q=moving.C.list[Math.floor(random()*560)],ox=q.x,oz=q.z;
  q.x+=random()*24-12;q.z+=random()*24-12;moving.C.notePeerMove(q,ox,oz);
 }
 for(let i=0;i<100;i++){
  const p=moving.C.list[Math.floor(random()*560)],ox=p.x,oz=p.z,x=ox+random()*1.4-.7,z=oz+random()*1.4-.7;
  assert.equal(moving.C.peerClearStep(p,x,z,ox,oz),scan.peerClearStep(p,x,z,ox,oz),'all560-body query parity, including movers that entered from an unqueried cell');
 }
}
console.log('PASS: 4000 exact moving-grid/full-population contact decisions');
