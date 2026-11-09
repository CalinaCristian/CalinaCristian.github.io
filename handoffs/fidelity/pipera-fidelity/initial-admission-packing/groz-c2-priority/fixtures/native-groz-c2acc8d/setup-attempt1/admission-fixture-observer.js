// Read-only constructor fixture. All projections use an isolated Traffic view.
import {Traffic} from '__BASE__game/src/traffic.js';
import {nativeInitialTrafficCandidates,initialTrafficStaticClearance} from '__BASE__game/src/initial-traffic-admission.js';
import {vehicleVerticalInterval} from '__BASE__game/src/initial-vehicle-admission.js';
import {canTravel,lanesDir} from '__BASE__game/src/nav.js';
import {ambientTrafficAccess} from '__BASE__game/src/road-access.js';
window.admissionFixtureQA={fixture:null};
const link=r=>({edgeId:r.e.id,dir:r.dir,uturn:!!r.uturn});
const node=n=>({id:n.id,sourceId:n.sourceId,x:n.x,z:n.z,y:n.y,radius:n.radius,mapEnd:!!n.mapEnd,hasLight:!!n.hasLight,crossing:!!n.crossing,zebra:!!n.zebra,stop:!!n.stop,flags:n.flags,orderedEdgeIds:n.edges.map(e=>e.id)});
const edge=e=>({id:e.id,road:e.road,access:e.access,sourceId:e.access?.sourceId,name:e.name,type:e.type,len:e.len,dirx:e.dirx,dirz:e.dirz,nx:e.nx,nz:e.nz,wL:e.wL,wR:e.wR,median:e.median,laneW:e.laneW,laneCenterShiftM:e.laneCenterShiftM,sidewalk:e.sidewalk,lanesF:e.lanesF,lanesB:e.lanesB,sharedLane:!!e.sharedLane,sharedLaneWidthM:e.sharedLaneWidthM,sharedLaneSource:e.sharedLaneSource,roadWidthSource:e.roadWidthSource,oneway:!!e.oneway,publicDrive:e.publicDrive,throughAccess:e.throughAccess,maxspeed:e.maxspeed,mapEnds:!!(e.a.mapEnd||e.b.mapEnd),tram:!!e.tram,bridge:!!e.bridge,tunnel:!!e.tunnel,layer:e.layer,ya:e.ya,yb:e.yb,
 a:node(e.a),b:node(e.b)});
const record=v=>({id:v.id,kind:v.kind,x:v.x,y:v.y,z:v.z,heading:v.heading,s:v.s,length:v.length,width:v.width,metadataHeight:v.mesh.userData.height,verticalInterval:vehicleVerticalInterval(v),pitch:v.mesh.rotation.x,roll:v.mesh.rotation.z,dir:v.dir,lane:v.lane,laneCur:v.laneCur,latBlend:v.latBlend,latExtraCur:v.latExtraCur,lateralExtra:v.lateralExtra,layer:v.layer,long:!!v.long,bus:!!v.bus,tram:!!v.tram,parked:!!v.parked,service:!!v.service,canAdjust:!v.parked&&!v.service,edge:edge(v.edge),route:v.route.map(link),hist:v.hist?.map(link)||[]});
const sourceValid=(T,v,b)=>{
 const e=b.edge,long=v.long||v.bus||v.tram||v.length>=8.5;
 if(e!==v.edge||b.dir!==v.dir||b.lane!==v.lane||b.laneCur!==v.laneCur||!canTravel(e,b.dir)||!ambientTrafficAccess(e)||e.a.mapEnd||e.b.mapEnd||(v.tram&&!e.tram)||!(b.laneCur>=0&&b.laneCur<lanesDir(e,b.dir)))return{valid:false,reason:'source-edge-direction-lane-access'};
 if(long){const span=T.sSpan(e,b.dir,b.length,true);return{valid:!!span&&b.s>=span[0]-1e-7&&b.s<=span[1]+1e-7,span,scope:'native-long-source-leg-span'};}
 const along=(b.x-e.a.x)*e.dirx+(b.z-e.a.z)*e.dirz,fx=-Math.sin(b.heading),fz=-Math.cos(b.heading),extent=Math.abs(fx*e.dirx+fz*e.dirz)*b.length/2+Math.abs(-fz*e.dirx+fx*e.dirz)*b.width/2;
 return{valid:along-extent>=.05-1e-7&&along+extent<=e.len-.05+1e-7,along,extent,scope:'whole-native-ordinary-source-edge-containment'};
};
const spawn=Traffic.prototype.spawnAll;
Traffic.prototype.spawnAll=function(...args){
 const result=spawn.apply(this,args);if(admissionFixtureQA.fixture)return result;
 const original=this.vehicles.map(record),view=Object.create(this),forbid=()=>{throw Error('Fixture preview attempted RNG');};
 for(const name of ['range','int','pick','chance'])forbid[name]=forbid;view.rng=forbid;
 for(const name of ['_t','_pf','_pr','_pc','_pa','_pb'])view[name]=undefined;
 const providers=[];
 for(const v of this.vehicles){
  const entries=[];for(const pose of nativeInitialTrafficCandidates(view,v)){
   const body={...v,...pose},source=sourceValid(view,v,body),physical=source.valid?initialTrafficStaticClearance(this.world,body):{valid:false,reason:'source-rejected-before-static'},shared=source.valid&&this.sharedLanes.canPlace(v.edge,v.dir,this.vehicles,v,body);
   entries.push({pose:{...pose,verticalInterval:vehicleVerticalInterval(body)},validation:{valid:source.valid&&physical.valid&&shared,source,physical,shared:{valid:shared,against:`complete original${this.vehicles.length} bodies`,changedContextNeedsNativeRecheck:!!v.edge.sharedLane}}});
  }
  providers.push({id:v.id,edgeId:v.edge.id,long:!!(v.long||v.bus||v.tram||v.length>=8.5),nativeSpan:(v.long||v.bus||v.tram||v.length>=8.5)?view.sSpan(v.edge,v.dir,v.length,true):null,candidates:entries});
 }
 const after=this.vehicles.map(record);
 admissionFixtureQA.fixture={stage:'Exact PRE-admission spawnAll input at physicaltime0; no pose updates applied',actorCount:original.length,bodies:original,providers,nativeGraph:{nodes:this.nodes.map(node),edges:this.world.graph.edges.map(edge)},
  livePoseRouteIdentityUnchanged:JSON.stringify(original)===JSON.stringify(after),rngChannels:'All isolated native preview RNG entry points throw; no call occurred',scope:`Static/source outputs are immutable native validations. Shared-lane output is native base-population validation; only nonshared-edge results remain invariant when bodies move. Planner must retain complete${original.length} collision checks and source/dir/lane/identity. Native graph preserves exact ordered adjacency, source widths/alignment, geometry and heights; no graph joins are added.`};
 return result;
};
