// Native lifecycle attribution. Preserve original receiver/arguments/return.
import {Traffic} from '__BASE__game/src/traffic.js';
import {vehicleVerticalInterval} from '__BASE__game/src/initial-vehicle-admission.js';
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
window.publicationQA={target:null,preAdmission:[],beforeAttach:[],firstWorld:[],firstMain:[]};
const plain=o=>o==null?null:JSON.parse(JSON.stringify(o));
const edge=e=>e?{id:e.id,sourceId:e.access?.sourceId,access:e.access,name:e.name,type:e.type,layer:e.layer,ya:e.ya,yb:e.yb,len:e.len,wL:e.wL,wR:e.wR,lanesF:e.lanesF,lanesB:e.lanesB,
    a:{id:e.a.id,sourceId:e.a.sourceId,x:e.a.x,z:e.a.z},b:{id:e.b.id,sourceId:e.b.sourceId,x:e.b.x,z:e.b.z}}:null;
const car=v=>({id:v.id,kind:v.kind,x:v.x,z:v.z,y:v.y,heading:v.heading,pitch:v.mesh.rotation.x,roll:v.mesh.rotation.z,length:v.length,width:v.width,metadataHeight:v.mesh.userData.height,
    verticalInterval:vehicleVerticalInterval(v),edge:edge(v.edge),dir:v.dir,s:v.s,lane:v.lane,laneCur:v.laneCur,parked:!!v.parked,service:!!v.service,inactive:!!v.inactive,generation:v._moveGeneration||0});
publicationQA.read=function(T,stage,owner=game){
    T.group.updateWorldMatrix(true,false);const matrix=Array.from(T.group.matrixWorld.elements),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1].every((x,i)=>Math.abs(matrix[i]-x)<1e-9);
    const actors=T.vehicles.concat(T.pool||[]).map(car),active=actors.filter(v=>!v.inactive),pairs=[],unknown=active.filter(v=>!v.verticalInterval.known);
    for(let i=0;i<active.length;i++)for(let k=i+1;k<active.length;k++){
        const a=active[i],b=active[k],span=(a.length+a.width+b.length+b.width)/2;if(Math.abs(a.x-b.x)>span||Math.abs(a.z-b.z)>span)continue;
        if(!a.verticalInterval.known||!b.verticalInterval.known)continue;
        const y=Math.min(a.verticalInterval.max,b.verticalInterval.max)-Math.max(a.verticalInterval.min,b.verticalInterval.min);if(y<=0)continue;
        const p=obbPen(vObb(a),vObb(b));if(p>1e-6)pairs.push({ids:[a.id,b.id],orientedXZPenetrationM:p,actualVerticalIntersectionM:y});
    }
    const people=(T.peds?.list||[]).map(p=>({id:p.i,x:p.x,z:p.z,state:p.state,live:p.live,edge:p.e?.id,sourceId:p.e?.access?.sourceId,model:globalQA.models.get(p.i)})),peers=[],pedVehicles=[],unknownPeople=people.filter(p=>!p.model),playerPairs=[];
    let minPeer=Infinity;
    for(let i=0;i<people.length;i++)for(let k=i+1;k<people.length;k++){
        const a=people[i],b=people[k],d=Math.hypot(a.x-b.x,a.z-b.z);minPeer=Math.min(minPeer,d);if(d>=.6-1e-6||!a.model||!b.model||a.model.down||b.model.down)continue;
        const y=Math.min(a.model.y+1.75*a.model.scale,b.model.y+1.75*b.model.scale)-Math.max(a.model.y,b.model.y);if(y>0)peers.push({ids:[a.id,b.id],distanceM:d,bodyEnvelopePenetrationM:.6-d,actualModelBodyEnvelopeVerticalM:y});
    }
    for(const p of people){if(!p.model||p.model.down)continue;for(const v of active){const span=(v.length+v.width)/2+.3;if(Math.abs(p.x-v.x)>span||Math.abs(p.z-v.z)>span||!v.verticalInterval.known)continue;
        const vertical=Math.min(p.model.y+1.75*p.model.scale,v.verticalInterval.max)-Math.max(p.model.y,v.verticalInterval.min);if(vertical<=0)continue;
        const fx=-Math.sin(v.heading),fz=-Math.cos(v.heading),dx=p.x-v.x,dz=p.z-v.z,d=Math.hypot(Math.max(0,Math.abs(dx*fx+dz*fz)-v.length/2),Math.max(0,Math.abs(-dx*fz+dz*fx)-v.width/2));
        if(d<.3-1e-6)pedVehicles.push({pedestrian:p.id,vehicle:v.id,discPenetrationM:.3-d,actualVerticalM:vertical});
    }}
    const P=owner.player;
    let player=null;if(P&&T===owner.traffic){const co=((P.front||2.2)-(P.rear||2.2))/2,box={x:P.x+P.fx*co,z:P.z+P.fz*co,fx:P.fx,fz:P.fz,length:P.length,width:P.width};
        player={x:P.x,z:P.z,surfaceY:P.surfY,heading:P.heading,front:P.front,rear:P.rear,width:P.width,sourceEdge:P.currentEdge?.id??P.supportEdge?.id,bodyBox:box};
        for(const v of active){const p=obbPen(vObb(v),box);if(p>1e-6)playerPairs.push({vehicle:v.id,orientedXZPenetrationM:p,npcVertical:v.verticalInterval,playerGroundAnchor:P.surfY,scope:'Actual asymmetric native player footprint; player full emitted vertical body is audited separately by QA'});}
    }
    return{stage,district:owner.district,city:owner.city?.id,trafficTime:T.time,trafficFrame:T._frame||0,state:owner.state,
        trafficParent:{identity,matrix,dependency:'vehicleVerticalInterval emitted primary vertices YXZ; native identity Traffic parent'},admission:plain(T.initialAdmission),actors,
        population:{activeVehicles:active.length,pooledVehicles:T.pool?.length||0,allVehicleIds:actors.map(v=>v.id).sort((a,b)=>a-b),people:people.length,pedestrianIds:people.map(p=>p.id)},
        vehicleBodyContacts:pairs,unknownVehicleModels:unknown,people,peerBodyEnvelopes:peers,pedestrianVehicleBodies:pedVehicles,unknownPeople,minimumPeerCentresM:Number.isFinite(minPeer)?minPeer:null,player,playerOBBXZProxies:playerPairs};
};
const spawn=Traffic.prototype.spawnAll;
Traffic.prototype.spawnAll=function(...args){const result=spawn.apply(this,args);publicationQA.preAdmission.push(publicationQA.read(this,'PRE-admission spawnAll input; expected original conflicts are not final failures'));return result;};
const attach=game.attachWorldRender;
game.attachWorldRender=function(...args){if(this.district===publicationQA.target&&this.traffic?.world===this.world)publicationQA.beforeAttach.push(publicationQA.read(this.traffic,'AFTER admission/profile/hot additions and final source spawn, before renderer attach',this));return attach.apply(this,args);};
const firstWorld=new WeakSet(),firstMain=new WeakSet(),render=game.renderer.render;
game.renderer.render=function(scene,camera,...args){const g=game,T=g.traffic;if(g.district===publicationQA.target&&T?.world===g.world&&scene===g.scene){
    if(!firstWorld.has(T)){firstWorld.add(T);publicationQA.firstWorld.push({...publicationQA.read(T,'ACTUAL first submitted world render'),pass:camera===g.camera?'main':camera===g.player?.mirrorCam?'mirror':'other/reflection'});}
    if(camera===g.camera&&!firstMain.has(T)){firstMain.add(T);publicationQA.firstMain.push(publicationQA.read(T,'ACTUAL first submitted main-camera world render'));}
}return render.call(this,scene,camera,...args);};
