import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {makeVehicle,makeCockpit} from '../src/vehicles.js';
import {sourceVehicleDimensions} from '../src/source-vehicle-dimensions.js';
import {parseSourceClearance,roadClearancePolicy,assessRoadClearance,sourceRoadClearance} from '../src/source-road-clearance.js';
import {Navigator} from '../src/nav.js';
import {Traffic} from '../src/traffic.js';
import {admitInitialTraffic} from '../src/initial-traffic-admission.js';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const mesh=kind=>makeVehicle(kind,undefined,{instanced:true,city:'bucharest'}),hatch={kind:'hatch',mesh:mesh('hatch')},trolley={kind:'trolleybus',bus:true,trolley:true,mesh:mesh('trolleybus')};
const hd=sourceVehicleDimensions(hatch),td=sourceVehicleDimensions(trolley);
check(Math.abs(hd.height-1.5849999785423279)<1e-8,'actual negative wheel bottom is included rather than declared1.46');
check(Math.abs(td.height-5.695000112056732)<1e-8&&trolley.mesh.userData.height===3,'actual extended trolley poles are included rather than declared3');
check(hd.width>hatch.mesh.userData.width&&td.width>trolley.mesh.userData.width,'complete emitted mirrors/body width, not narrow collision OBB');
trolley.mesh.rotation.set(.3,1,.1);trolley.mesh.position.set(14,20,30);const held={position:trolley.mesh.position.toArray(),rotation:trolley.mesh.rotation.toArray(),matrix:trolley.mesh.matrix.toArray()};
const tilted=sourceVehicleDimensions(trolley);check(Math.abs(tilted.height-td.height)<1e-8,'source upright dimensions do not grow with current road pitch');check(JSON.stringify(held)===JSON.stringify({position:trolley.mesh.position.toArray(),rotation:trolley.mesh.rotation.toArray(),matrix:trolley.mesh.matrix.toArray()}),'measurement never updates actor pose or matrices');
const extra=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2));extra.position.y=7;trolley.mesh.add(extra);check(sourceVehicleDimensions(trolley).height>7.1,'additional model hierarchy cannot be omitted');trolley.mesh.remove(extra);extra.geometry.dispose();
const parent=new THREE.Group();parent.scale.set(2,1,1);parent.add(trolley.mesh);check(!sourceVehicleDimensions(trolley).known,'unsupported parent scaling stays unknown');parent.remove(trolley.mesh);
trolley.mesh.matrixAutoUpdate=false;check(!sourceVehicleDimensions(trolley).known,'manual-root transform cannot manufacture an upright basis');trolley.mesh.matrixAutoUpdate=true;
check(!sourceVehicleDimensions({height:1.5,width:1.8}).known,'declared metadata cannot manufacture actual model dimensions');
const random=Math.random;try{Math.random=()=>{throw Error('Dimension measurement must not draw RNG');};check(sourceVehicleDimensions(trolley).known,'geometry dimensions consume no RNG');}finally{Math.random=random;}
for(const[raw,metres]of [['3.5',3.5],['2 m',2],['12\'0"',3.6576],['11\'0"',3.3528],['6\'10"',2.0828],['13\'0"',3.9624]])check(Math.abs(parseSourceClearance(raw).metres-metres)<1e-9,'literal units '+raw);
check(parseSourceClearance('none').unbounded,'none is explicit unbounded');for(const raw of ['default','no','3;4','0',"6'14\"",'3.5 @ (wet)','9'.repeat(400)])check(!parseSourceClearance(raw).known,'unresolved literal '+raw);
const tags=[{maxheight:'3.5'},{maxwidth:'2'},{maxheight:'none'},{maxheight:'default'},{maxheight:'4.25','maxheight:signed':'no'},{maxheight:'6\'10"'},{'maxheight:physical':'3'},{maxheight:'3.5','maxheight:bus':'none'},{'maxheight:conditional':'3.5 @ (wet)'},{'maxheight:forward':'2'}];
const data={roadSourceGeometry:Object.fromEntries(tags.map((tags,i)=>[i,{sourceId:'w'+(i+100),tags}]))},rawData=JSON.stringify(data),policy=roadClearancePolicy(data),e=i=>({road:i,access:{sourceId:'w'+(i+100)}});
check(assessRoadClearance(policy,e(0),td).eligible===false,'actual trolley rejected by3.5m source');check(assessRoadClearance(policy,e(0),hd).eligible===true,'actual hatch fits3.5m source');check(assessRoadClearance(policy,e(1),hd).eligible===false,'actual emitted width is applied');
check(assessRoadClearance(policy,e(2),null).eligible===true,'none needs no invented dimension');check(assessRoadClearance(policy,e(3),td).eligible===true&&!assessRoadClearance(policy,e(3),td).known,'unknown default retains legacy access without measured acceptance');
check(assessRoadClearance(policy,e(4),td).eligible===false,'signed=no never removes an actual numeric source limit');check(assessRoadClearance(policy,e(0),null).eligible===null,'finite sign with unknown model stays unresolved');check(assessRoadClearance(policy,e(6),td).eligible===false,'physical clearance is independently restrictive');
check(assessRoadClearance(policy,e(7),td,{mode:'bus'}).eligible===true&&assessRoadClearance(policy,e(7),td,{mode:'motorcar'}).eligible===false,'explicit actor-mode precedence');check(!assessRoadClearance(policy,e(8),hd).known&&!assessRoadClearance(policy,e(9),hd).known,'conditional/direction selector context is not guessed');check(JSON.stringify(data)===rawData,'source tags/data remain byte-equivalent');
// Actual cockpit geometry. Canvas paint is a CPU-only no-op; geometry is the
// unchanged production factory, never a native visual acceptance fixture.
const oldDocument=globalThis.document,noop=()=>{},gradient={addColorStop:noop};
try{
 globalThis.document={createElement(type){assert.equal(type,'canvas');const c={width:0,height:0,style:{}};const ctx=new Proxy({canvas:c,measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});c.getContext=()=>ctx;return c;}};
 const rig=new THREE.Group(),cockpit=makeCockpit();rig.add(cockpit);const d=sourceVehicleDimensions({rig,cockpit});check(d.known&&d.height>2.14&&d.geometryHeight<1.86,'actual cockpit roof includes supportdatum0 below its missing rendered wheels');check(assessRoadClearance(policy,e(5),d).eligible===false,'2.14m actual cockpit does not get a false6ft10in permission');
 const taxi={kind:'taxi',mesh:mesh('taxi')},taxiDimensions=sourceVehicleDimensions(taxi);check(taxiDimensions.known&&taxiDimensions.parts.some(p=>p.basis==='native-detached-template-matrix'),'instanced taxi dimensions include its actual detached sign template');
}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
// Real Navigator/NPC consumers: low direct street versus unbounded detour.
const n=(id,x,z)=>({id,sourceId:id,x,z,edges:[]}),S=n(1,0,0),A=n(2,10,0),B=n(3,20,0),G=n(4,30,0),D=n(5,15,10);
function link(id,a,b,road){const len=Math.hypot(b.x-a.x,b.z-a.z),q={id,a,b,road,len,dirx:(b.x-a.x)/len,dirz:(b.z-a.z)/len,lanesF:1,lanesB:0,oneway:true,type:'primary',speed:10,maxspeed:10,access:{sourceId:'w'+(road+100)}};q.nx=-q.dirz;q.nz=q.dirx;a.edges.push(q);b.edges.push(q);return q;}
const start=link(0,S,A,10),low=link(1,A,B,0),d1=link(2,A,D,11),d2=link(3,D,B,12),end=link(4,B,G,13),world={data,graph:{nodes:[S,A,B,G,D],edges:[start,low,d1,d2,end]}};
const nav=new Navigator(world);nav.sourceVehicle=hatch;check(nav.compute(1,0,29,0).legs.some(l=>l.e===low),'GPS actual small model uses signed road');nav.sourceVehicle=trolley;check(!nav.compute(1,0,29,0).legs.some(l=>l.e===low),'GPS actual oversized model uses legal alternative');nav.walking=true;check(nav.compute(1,0,29,0).legs.some(l=>l.e===low),'walking does not inherit vehicle clearance limits');
const t=Object.create(Traffic.prototype);Object.assign(t,{world,turnLaneRules:new Map(),rng:()=>.5});check(t.chooseNext(start,1,{...trolley,long:true,lane:0}).e===d1,'NPC source continuation rejects low clearance');
const future={...trolley,long:true,lane:0,edge:start,dir:1,s:1,route:[{e:low,dir:1},{e:end,dir:1}]};t.ensureRoute(future);check(future.route[0].e===d1&&!future.route.some(r=>r.e===low),'an invalid supplied future suffix is replaced before motion without changing source actors');
// A lone untouched illegal source assignment has no pair requiring a repair.
// The final admission source audit must still fail without hiding that actor.
const v={...trolley,id:1,edge:low,dir:1,lane:0,laneCur:0,s:5,x:15,y:.24,z:0,heading:-Math.PI/2,length:12,width:2.55,route:[],hist:[]};v.mesh.rotation.set(0,v.heading,0);
const fleet=[v],pool=[],T={world:{data,buildings:[]},vehicles:fleet,pool,grid:{build(){}},sharedLanes:{canPlace:()=>true}};
const result=admitInitialTraffic(T);check(!result.passed&&result.invalidSourceClearance.length===1,'no-pair original oversize cannot silently pass admission');check(T.vehicles===fleet&&T.vehicles[0]===v&&T.pool===pool&&result.updates.length===0,'failure preserves exact fleet objects/counts/pose and never hides the actor');
// Contrast a repairable physical pair against exactly the same source marked
// below the unchanged actual car height. The candidate guard, not only the
// unconditional final audit, must reject all illegal station proposals.
function pairTraffic(maxheight){
 const e={id:10,road:0,a:{x:0,z:0,y:0,edges:[]},b:{x:20,z:0,y:0,edges:[]},len:20,dirx:1,dirz:0,nx:0,nz:1,lanesF:1,lanesB:0,oneway:true,type:'primary',access:{sourceId:'w100'}};e.a.edges=[e];e.b.edges=[e];
 const cars=[8,9].map((s,i)=>{const m=mesh('hatch');m.rotation.set(0,-Math.PI/2,0,'YXZ');return{id:i+10,kind:'hatch',mesh:m,edge:e,dir:1,lane:0,laneCur:0,s,x:s,z:1.65,y:.24,heading:-Math.PI/2,length:m.userData.length,width:m.userData.width,route:[],hist:[],latExtraCur:0,latBlend:0};});
 const q=Object.create(Traffic.prototype);Object.assign(q,{world:{data:{roadSourceGeometry:{0:{sourceId:'w100',tags:{maxheight}}}},buildings:[]},vehicles:cars,pool:[],grid:{build(){}},sharedLanes:{canPlace:()=>true},rng:()=>{throw Error('Admission consumed RNG');}});return q;
}
const fit=admitInitialTraffic(pairTraffic('3.5'));check(fit.passed&&fit.updates.length>0,'unchanged native station adapter still repairs an eligible source pair');
const illegalPair=pairTraffic('1.5'),pairBefore=illegalPair.vehicles.map(v=>[v.s,v.x,v.z]),blocked=admitInitialTraffic(illegalPair);check(!blocked.passed&&blocked.updates.length===0&&blocked.attempts.some(a=>a.reason==='source-clearance-access'),'sourcePlacement rejects each oversized repair candidate before shared/static acceptance');check(JSON.stringify(pairBefore)===JSON.stringify(illegalPair.vehicles.map(v=>[v.s,v.x,v.z])),'illegal source repair failure does not move or remove the original pair');
console.log('PASS '+checks+' actual-model/source-unit/mode/unknown/GPS/NPC/untouched-initial-admission controls');
