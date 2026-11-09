// Read-only native binding/source/motion capture. Original methods keep their
// receiver, arguments, return values and physical scheduling.
import {Traffic} from '__BASE__game/src/traffic.js';
import {auditRailBinding} from '__RAIL_CHECKS_URL__';
const initial = new WeakMap(), caches = new WeakMap();
const plain = x => x == null ? null : JSON.parse(JSON.stringify(x));
const node = n => ({id:n.id,sourceId:n.sourceId,x:n.x,z:n.z,y:n.y,radius:n.radius,flags:n.flags,mapEnd:!!n.mapEnd,hasLight:!!n.hasLight,orderedEdgeIds:(n.edges||[]).map(e=>e.id),motorSourceNodeId:n.motorNode?.sourceId,motorNodeId:n.motorNode?.id,clusterSourceNodes:n.nodes?.map(q=>({id:q.id,sourceId:q.sourceId,x:q.x,z:q.z,y:q.y}))});
const edge = e => ({id:e.id,sourceId:e.sourceId??e.access?.sourceId,road:e.road,name:e.name,type:e.type,access:e.access,sourceSegment:e.sourceSegment,sourceNodeIds:e.sourceNodeIds,sourceTags:e.sourceTags,
    rail:!!e.rail,tramOnly:!!e.tramOnly,modeled:e.modeled,usable:e.usable,railDirections:e.railDirections,directionEvidence:e.directionEvidence,grade:e.grade?Object.fromEntries(Object.entries(e.grade).filter(([,v])=>typeof v!=='function')):null,
    a:node(e.a),b:node(e.b),len:e.len,dirx:e.dirx,dirz:e.dirz,nx:e.nx,nz:e.nz,ya:e.ya,yb:e.yb,layer:e.layer,bridge:!!e.bridge,tunnel:!!e.tunnel,median:e.median,laneW:e.laneW,laneCenterShiftM:e.laneCenterShiftM,lanesF:e.lanesF,lanesB:e.lanesB,wL:e.wL,wR:e.wR,oneway:e.oneway,publicDrive:e.publicDrive,throughAccess:e.throughAccess,publicTram:e.publicTram,throughTram:e.throughTram});
const actor = v => ({id:v.id,kind:v.kind,edgeId:v.edge.id,nativeEdge:edge(v.edge),dir:v.dir,s:v.s,x:v.x,y:v.y,z:v.z,heading:v.heading,pitch:v.mesh.rotation.x,roll:v.mesh.rotation.z,length:v.length,width:v.width,speed:v.speed,odo:v.odo,layer:v.layer,inactive:!!v.inactive,
    lane:v.lane,laneCur:v.laneCur,latExtraCur:v.latExtraCur,lateralExtra:v.lateralExtra,latBlend:v.latBlend,route:(v.route||[]).map(r=>({edgeId:r.e.id,sourceId:r.e.sourceId??r.e.access?.sourceId,dir:r.dir,uturn:r.uturn})),hist:(v.hist||[]).map(r=>({edgeId:r.e.id,sourceId:r.e.sourceId??r.e.access?.sourceId,dir:r.dir})),
    stop:{servedSourceNodeId:v.servedRailStop,servedOdo:v.servedRailStopOdo,dwell:v.dwell,stopWhy:v.stopWhy,stopDistance:v.stopD,zeroWhy:v.zeroWhy}});
window.railQA={sources:[],initialTrams:[],auditRailBinding};
railQA.captureConstructor=function(T){const actors=T.vehicles.filter(v=>v.tram).map(actor),ids=actors.map(v=>v.id);initial.set(T,ids);railQA.initialTrams.push({district:game.district,city:game.city?.id,trafficTime:T.time||0,ids,actors,stage:'PRE source rail binding; motor placements remain historical input, not publication acceptance'});return ids;};
const spawn=Traffic.prototype.spawnAll;
Traffic.prototype.spawnAll=function(...args){
    const result=spawn.apply(this,args);railQA.captureConstructor(this);
    return result;
};
function sourceSnapshot(T){
    let source=caches.get(T);if(source)return source;
    const D=T.world.data||{},G=T.tramNetwork;
    source=plain({id:railQA.sources.length,district:game.district,city:game.city?.id,data:Object.fromEntries(['q','trams','tramSources','tramSourceWays','tramRoutes','tramSourceNodeTags'].map(k=>[k,D[k]])),
        graph:{nodes:(G?.nodes||[]).map(node),edges:(G?.edges||[]).map(edge),allEdges:(G?.allEdges||[]).map(edge),report:G?.report},
        ribbons:(T.world.ribbons||[]).filter(r=>r.e?.bridge&&!r.e.tunnel&&r.poly?.length).map(r=>({poly:r.poly,edge:edge(r.e)})),
        motorGraph:{nodes:Object.values(T.world.graph.nodes).map(node),edges:T.world.graph.edges.map(edge)},tramMotorCrossings:[...(T.tramMotorCrossings||[])].map(n=>n.id)});
    caches.set(T,source);railQA.sources.push(source);return source;
}
railQA.read=function(T,{stage='publication'}={}){
    const constructorTramIds=initial.get(T),actors=T.vehicles.concat(T.pool||[]).filter(v=>v.tram).map(actor);
    if(stage==='pre-binding')return{stage,passed:null,constructorTramIds:constructorTramIds||actors.map(v=>v.id),actors,scope:'Expected prerepair source assignments; never a final source-fidelity gate'};
    // Cache only once the native source network exists; the spawnAll hook runs
    // before that network is created and must not poison the publication cache.
    const source=sourceSnapshot(T),binding=plain(T.initialTramBinding),allActorModes=T.vehicles.concat(T.pool||[]).map(v=>({id:v.id,tram:!!v.tram,edgeId:v.edge.id,sourceId:v.edge.sourceId??v.edge.access?.sourceId,rail:!!v.edge.rail,dir:v.dir,publicTram:v.edge.publicTram,throughTram:v.edge.throughTram,publicDrive:v.edge.publicDrive,throughAccess:v.edge.throughAccess,railDirections:v.edge.railDirections}));
    const admissionMode=plain({passed:T.initialAdmission?.passed,invalidRailModes:T.initialAdmission?.invalidRailModes}),snapshot={...source,binding,constructorTramIds:constructorTramIds||[],actors,allActorModes,admissionMode};
    const result=auditRailBinding(snapshot,{stage,requireFinalModes:true});
    if(!constructorTramIds){result.passed=false;result.issues.push({type:'missing-pre-binding-identity-capture'});}
    const crossingClaims=[];
    for(const [controller,claims]of T.boxes||[]){
        const relevant=claims.filter(r=>r.v?.tram);if(!relevant.length)continue;
        crossingClaims.push({controller:node(controller),claims:relevant.map(r=>({id:r.v.id,sourceId:r.inE?.sourceId,fromEdge:r.inE?.id,toEdge:r.outE?.id,outDir:r.outDir,phase:r.phase,entered:r.entered,t:r.t,t0:r.t0,clearOdo:r.clearOdo,
            segments:(r.segments||[]).map(q=>({p0x:q.p0x,p0z:q.p0z,p1x:q.p1x,p1z:q.p1z,sourceEdge:q.sourceEdge?.id,from:q.inE?.id,to:q.outE?.id}))}))});
    }
    return{...result,sourceSnapshotId:source.id,trafficTime:T.time,trafficFrame:T._frame,binding,actors,admissionMode,allActorModes,crossingClaims};
};
