import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from '../vendor/three.module.min.js';
import {Traffic,Pedestrians} from '../src/traffic.js';
import {makeVehicle} from '../src/vehicles.js';
import {evaluateInitialParking,initialParkingSource} from '../src/initial-parking-behavior.js';
import {parkingModel,parkingSupportCatalog} from '../src/initial-parking-support.js';
import {cullMergedCells} from '../src/cell-frustum.js';
let checks=0;const check=(yes,message)=>{assert.ok(yes,message);checks++;};
const sourceFile=new URL('./fixtures/unirii-initial-parked-van484.json',import.meta.url),fixture=JSON.parse(fs.readFileSync(sourceFile));
function edge(){
    const a={id:0,sourceId:10,x:0,z:0,y:0,edges:[],radius:0},b={id:1,sourceId:11,x:0,z:-200,y:0,edges:[],radius:0};
    const e={id:0,road:0,a,b,dirx:0,dirz:-1,nx:1,nz:0,len:200,wR:7,wL:0,laneW:3.5,median:0,lanesF:2,lanesB:0,oneway:true,sidewalk:6,sidewalkRightM:6,sidewalkLeftM:0,type:'residential',drivable:true,publicDrive:true,throughAccess:true,access:{sourceId:'w1'},layer:0};a.edges=[e];b.edges=[e];return e;
}
function support(group,y=.37,x0=7,x1=13){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x0,y,-200,x0,y,0,x1,y,0,x1,y,-200],3));g.setIndex([0,1,2,0,2,3]);const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.name='ground controlled';group.add(mesh);return mesh;
}
function scene(){
    const e=edge(),t=Object.create(Traffic.prototype),group=new THREE.Group();support(group);
    const v={id:484,kind:'van',edge:e,dir:1,lane:1,laneCur:1,s:100,length:4.36,width:1.75,latExtraCur:0,lateralExtra:0,speed:0,route:[],hist:[],parked:false,mesh:makeVehicle('van','#ffffff',{city:'bucharest',instanced:true})};
    Object.assign(t,{time:0,_frame:0,vehicles:[v],world:{district:true,graph:{edges:[e],nodes:[e.a,e.b]},data:{roadSourceGeometry:{0:{sourceId:'w1',nodeIds:[10,11],tags:{highway:'residential',oneway:'yes','parking:right':'on_kerb','parking:right:orientation':'parallel'}}}},group,buildings:[],ribbons:[{e,poly:[[0,0],[7,0],[7,-200],[0,-200]]}],sidewalkWidth:(e,side)=>side>0?e.sidewalkRightM:e.sidewalkLeftM,walkTop:(x,z)=>x>7.02&&x<13&&z<0&&z>-200?.37:null,roadHeight:()=>.24},sharedLanes:{canPlace:()=>true}});
    t.placeOnLane(v,true,0);return{t,v,e};
}
const decide=({t,v})=>{const walker=Object.create(Pedestrians.prototype);walker.t=t;return evaluateInitialParking(t,v,{desiredOffset:1.925,walkOffset:(e,s)=>walker.off(e,s)});};
const ordinary=scene(),before={position:ordinary.v.mesh.position.toArray(),rotation:ordinary.v.mesh.rotation.toArray(),x:ordinary.v.x,z:ordinary.v.z,extra:ordinary.v.latExtraCur};
const good=decide(ordinary);
check(good.valid,'literal broad ordinary street parking has a physically supported, nonblocking candidate');
check(good.offset>1.925,'the original kerb-straddling offset cannot masquerade as nonblocking');
check(good.body.x-good.body.width/2>7,'complete emitted mirrors/body remain outside both legal moving lanes');
check(good.body.x-good.body.width/2>8.6+.4,'the existing native pedestrian line remains clear');
check(good.feet.length>=4&&good.feet.every(p=>Math.abs(p.gapM-.008023071102797985)<1e-7),'actual van tyre facets preserve their native 8.023mm polygonal gap, not metadata height');
check(good.decorativeArchBelowSupportM>.0649,'negative-Y wheel arch detail remains explicitly reported separately from tyre support');
assert.deepEqual({position:ordinary.v.mesh.position.toArray(),rotation:ordinary.v.mesh.rotation.toArray(),x:ordinary.v.x,z:ordinary.v.z,extra:ordinary.v.latExtraCur},before);checks++;
const model=parkingModel(ordinary.v);check(model.width>ordinary.v.width&&model.length>ordinary.v.length,'whole actual model envelope includes mirrors and noncentral overhangs');

for(const [name,mutate,expected]of[
    ['no sidewalk',s=>{s.e.sidewalkRightM=0;},'parking-own-side-support-absent'],
    ['literal prohibition',s=>{s.t.world.data.roadSourceGeometry[0].tags['parking:right']='no';},'literal-parking-prohibition-or-unresolved-condition'],
    ['unknown designation',s=>{delete s.t.world.data.roadSourceGeometry[0].tags['parking:right'];},'parking-not-literally-designated'],
    ['private access',s=>{s.t.world.data.roadSourceGeometry[0].tags.access='private';},'parking-source-access-or-structure'],
    ['perpendicular',s=>{s.t.world.data.roadSourceGeometry[0].tags['parking:right:orientation']='perpendicular';},'parking-orientation-not-parallel'],
    ['conditional',s=>{s.t.world.data.roadSourceGeometry[0].tags['parking:right:restriction:conditional']='no_parking @ (08:00-18:00)';},'literal-parking-prohibition-or-unresolved-condition'],
    ['literal height',s=>{s.t.world.data.roadSourceGeometry[0].tags.maxheight='1.5';},'parking-literal-vehicle-dimensions'],
    ['inclined approach',s=>{s.t.world.data.roadSourceGeometry[0].tags.incline='down';},'parking-support-grade-unresolved'],
    ['unmodeled grade',s=>{s.e.b.y=.1;},'parking-support-grade-unresolved'],
    ['unknown parking lane width',s=>{s.t.world.data.roadSourceGeometry[0].tags['parking:right']='lane';},'parking-lane-physical-width-unresolved'],
    ['missing direction',s=>{s.e.a.sourceId=-1;},'parking-source-direction-unresolved'],
    ['tunnel',s=>{s.e.tunnel=true;},'parking-source-access-or-structure'],
    ['narrow sidewalk',s=>{s.e.sidewalkRightM=2;},'no-legal-supported-nonblocking-parking-pose'],
    ['actual support absent',s=>{s.t.world.group.clear();},'no-legal-supported-nonblocking-parking-pose'],
    ['live actor',s=>{s.t.time=1;},'initial-parking-after-admission-forbidden'],
]){const s=scene();mutate(s);const result=decide(s);check(!result.valid&&result.reason===expected,name+' rejects the parked behavior');}
const wall=scene();wall.t.world.buildings=[{wall:true,ax:7.3,az:-110,bx:12.7,bz:-90,nx:1,nz:0,y0a:0,y0b:0,y1a:3,y1b:3}];check(!decide(wall).valid,'a retaining wall cannot be accepted by moving the offset farther out');
const roof=scene();roof.t.world.buildings=[{x:10,z:-100,hw:3,hd:5,r:6,angle:0,y:1.5,h:.5,prop:true,kind:'ceiling'}];check(!decide(roof).valid,'actual full-body headroom is checked rather than only wheel support');
const band=scene();band.t.world.walkTop=(x,z)=>x>7.02&&x<13&&z<0&&z>-200?(x<10?.5:.37):null;const bandResult=decide(band);check(!bandResult.valid&&bandResult.attempts.some(a=>a.reason==='parking-tyres-straddle-unsupported-height-bands'),'different actual foot-support bands cannot be averaged into a floating parked pose');
const noRoom=scene(),foreign=edge();foreign.id=2;foreign.a.x=foreign.b.x=7;noRoom.t.world.graph.edges.push(foreign);check(!decide(noRoom).valid,'empty static space occupied by another legal moving-lane corridor is not parking room');
const peer=scene();const o={...peer.v,id:2,x:good.body.x,z:good.body.z,y:.37,mesh:makeVehicle('van','#ffffff',{city:'bucharest',instanced:true})};peer.t.vehicles.push(o);check(!decide(peer).valid,'a static-clear pose cannot overlap another native actual model');
const control=scene();control.e.a.hasLight=true;control.v.s=10;control.t.placeOnLane(control.v,true,0);check(!decide(control).valid,'whole body stays outside real control/portal margins');
const cold=scene(),mesh=cold.t.world.group.children[0];cullMergedCells(mesh,[{start:0,count:3,bounds:[7,.37,-200,13,.37,0]},{start:3,count:3,bounds:[7,.37,-200,13,.37,0]}]);check(decide(cold).valid,'cold pre-camera full support index remains usable');mesh.userData.cellFrustum.updates=1;check(!decide(cold).valid,'a camera-selected private index cannot manufacture whole support');

// Exact rejected native ramp van. Its old parked flag is evidence, not an
// instruction to teleport it to a wall or invent a parking lot connector.
const native=scene(),raw=fixture.vehicle,e={...native.e,...raw.edge,lanesF:2,lanesB:0,laneW:3.5,median:-7,oneway:true,access:{sourceId:'w4045772'}};
e.a={...raw.edge.a,edges:[e]};e.b={...raw.edge.b,edges:[e]};native.t.world.graph.edges=[e];native.t.world.data.roadSourceGeometry={6:fixture.sourceRoad};Object.assign(native.v,raw,{edge:e,parked:false,lateralExtra:0,latExtraCur:0,mesh:native.v.mesh});native.t.placeOnLane(native.v,true,0);
check(native.t.parkOk(e,1),'the exact source ramp satisfies the historic broad double-park heuristic');
const fixed=decide(native);check(!fixed.valid&&fixed.reason==='parking-support-grade-unresolved','literal actual down-ramp refuses generated parked behavior');
check(Math.hypot(native.v.x-raw.x,native.v.z-raw.z)<1e-8&&native.v.edge===e&&native.v.s===raw.s&&native.v.parked===false,'refusal retains the exact new ordinary actor/source station without a warp');

// Execute the complete historic spawn loop, including parked-loop termination
// and later tram generation, with the exact Git baseline method.
const baseline=gunzipSync(fs.readFileSync(new URL('./fixtures/traffic-57db-parking-baseline.js.gz',import.meta.url))).toString('utf8'),temp=new URL('../src/.parking-before-'+process.pid+'.mjs',import.meta.url);
assert.equal(createHash('sha256').update(baseline).digest('hex'),'b76ade370d5f0f89bae39fea6ed04d3fbd473b7e319cb706258fd4eef077ba6d');checks++;
let old;
try{fs.writeFileSync(temp,baseline,{flag:'wx'});old=(await import(temp.href)).Traffic;}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
const previousDocument=globalThis.document;
// Texture lettering alone is mocked in this CPU fixture. All fleet geometry,
// source placement, RNG and collision/admission methods remain native.
globalThis.document={createElement(type){assert.equal(type,'canvas');return{width:0,height:0,getContext(){return new Proxy({measureText:text=>({width:String(text).length*8})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});}};}};
function seeded(Base,positive=false){
    const edges=Array.from({length:12},(_,i)=>{const e=edge();e.id=i;e.road=i;e.a.id=i*2;e.b.id=i*2+1;e.a.x=e.b.x=i*50;e.access={sourceId:'w'+i};return e;});
    edges[11].tram=true;edges[11].b.z=-1200;edges[11].len=1200;
    const group=new THREE.Group();if(positive)for(const e of edges)support(group,.37,e.a.x+7,e.a.x+13);
    const world={group,district:true,graph:{edges,nodes:edges.flatMap(e=>[e.a,e.b])},buildings:[],pois:[],bounds:{minX:0,maxX:600,minZ:-1200,maxZ:0},sidewalkWidth:(e,s)=>s>0?e.sidewalkRightM:0,walkTop:(x,z)=>edges.some(e=>x>e.a.x+7.02&&x<e.a.x+13&&z<0&&z>-200)?.37:null,ribbons:edges.map(e=>({e,poly:[[e.a.x,0],[e.a.x+7,0],[e.a.x+7,e.b.z],[e.a.x,e.b.z]]})),data:{roadSourceGeometry:Object.fromEntries(edges.map(e=>[e.road,{sourceId:e.access.sourceId,nodeIds:[e.a.sourceId,e.b.sourceId],tags:{highway:'residential',oneway:'yes',...(positive?{'parking:right':'on_kerb'}:{})}}]))}};
    let captured;const stop={};class AtSpawn extends Base{spawnAll(){super.spawnAll();captured=this;throw stop;}}
    try{new AtSpawn(world,{id:'bucharest',traffic:{density:.2,parkedChance:2,trams:true}},new THREE.Scene(),{maxVehicles:24,maxPeds:0});}catch(error){if(error!==stop)throw error;}
    return captured;
}
const original=seeded(old),candidate=seeded(Traffic),signature=t=>t.vehicles.map(v=>[v.id,v.kind,v.edge.id,v.dir,v.lane,v.s,v.x,v.y,v.z,v.desiredMul,v.honkAt,v.busLaneOk,v.laneChangeCd,v.mesh.userData._paint?.getHex()]);
assert.deepEqual(signature(candidate),signature(original));checks++;
assert.deepEqual(Array.from({length:64},()=>candidate.rng()),Array.from({length:64},()=>original.rng()));checks++;
const slots=original.vehicles.filter(v=>v.parked);check(slots.length>0&&candidate.initialParking.attempted===slots.length,'historic attempted parked slot count/termination preserved');
check(candidate.initialParking.refused===slots.length&&candidate.initialParking.admitted===0,'unsupported generated parked behaviors become the same ordinary actors');
check(candidate.vehicles.filter(v=>v.tram).length>0&&candidate.vehicles.filter(v=>v.tram).length===original.vehicles.filter(v=>v.tram).length,'subsequent native tram generation retains its original draws and nonempty cohort');
check(candidate.initialParking.records.every(r=>!r.parked&&candidate.vehicles.find(v=>v.id===r.original.id)?.latExtraCur===0),'refusal keeps the original zero offsets rather than a partially applied candidate');
const positive=seeded(Traffic,true),oldPositive=seeded(old,true);
check(positive.initialParking.admitted>0,'production creation actually admits genuine supported source parking, not a blanket parked-flag removal');
check(positive.vehicles.filter(v=>v.parked).every(v=>v.latExtraCur===v.lateralExtra&&v.hazard&&v.mesh.userData.parked&&v.mesh.position.y===v.y),'accepted source parking commits current/desired offsets and actual support together');
assert.deepEqual(Array.from({length:64},()=>positive.rng()),Array.from({length:64},()=>oldPositive.rng()));checks++;
if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
console.log(JSON.stringify({passed:true,checks,baselineSHA256:createHash('sha256').update(baseline).digest('hex'),nativeFixture:fixture.source,actors:candidate.vehicles.length,attemptedSlots:candidate.initialParking.attempted,admitted:candidate.initialParking.admitted,refused:candidate.initialParking.refused,laterTrams:candidate.vehicles.filter(v=>v.tram).length,scope:'CPU native methods/actual emitted models; source be12 negative retained; new full native cohort and drive remain pending'}));
