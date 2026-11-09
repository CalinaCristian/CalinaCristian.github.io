// Read-only observer loaded before the actual district constructor. __BASE__ is
// replaced with the snapshot's served URL by the Node runner.
import {Pedestrians} from '__BASE__game/src/traffic.js';
import {collideBuildings} from '__BASE__game/src/world.js';
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
window.admissionQA={beforeActors:null,repairs:[],vehicleConstructorAdmission:null};
function readVehicles(T) {
    const edge=e=>e?{id:e.id,sourceId:e.access?.sourceId,access:e.access,name:e.name,type:e.type,layer:e.layer,ya:e.ya,yb:e.yb,
        a:{id:e.a.id,sourceId:e.a.sourceId,x:e.a.x,z:e.a.z},b:{id:e.b.id,sourceId:e.b.sourceId,x:e.b.x,z:e.b.z}}:null;
    const actors=T.vehicles.concat(T.pool||[]).map(v=>({id:v.id,kind:v.kind,x:v.x,z:v.z,y:v.y,heading:v.heading,
        length:v.length,width:v.width,modelHeight:v.mesh.userData.height,inactive:!!v.inactive,parked:!!v.parked,service:!!v.service,
        edge:edge(v.edge),dir:v.dir,s:v.s,lane:v.lane,laneCur:v.laneCur}));
    const overlaps=[],unclassifiedModels=actors.filter(v=>!Number.isFinite(v.modelHeight));
    for(let i=0;i<actors.length;i++)for(let k=i+1;k<actors.length;k++){
        const a=actors[i],b=actors[k];if(a.inactive||b.inactive||!Number.isFinite(a.modelHeight)||!Number.isFinite(b.modelHeight))continue;
        const vertical=Math.min(a.y+a.modelHeight,b.y+b.modelHeight)-Math.max(a.y,b.y);if(vertical<=0)continue;
        if(Math.hypot(a.x-b.x,a.z-b.z)>(a.length+b.length+a.width+b.width)/2)continue;
        const penetration=obbPen(vObb(a),vObb(b));if(penetration>1e-6)overlaps.push({ids:[a.id,b.id],orientedXZPenetrationM:penetration,actualVerticalIntersectionM:vertical});
    }
    return{stage:'After constructor vehicle admission and before pedestrian admission/first visible actor matrix',actors,overlaps,unclassifiedModels};
}
function read(p) {
    const W=this.t.world,reach=this.reach(p),y=(W.walkTop?.(p.x,p.z)??.2)+.01,colliders=[];
    const check=c=>{
        const carried=collideBuildings([c],p.x,p.z,reach,y,2),body=collideBuildings([c],p.x,p.z,.3,y,2);
        if(!carried&&!body)return;
        colliders.push({bodyHit:!!body,carriedHit:!!carried,push:body?{x:body.px,z:body.pz}:null,
            collider:Object.fromEntries(['x','z','r','hw','hd','angle','prop','kind','sourceId','h','minH','yMax','y0','y1','y0a','y1a','y0b','y1b','wall','poly','holes'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]))});
    };
    if(W.buildings?.query)W.buildings.query(p.x,p.z,reach+2,check);else for(const c of W.buildings||[])check(c);
    const peers=this.list.filter(q=>q!==p&&!q.hidden&&Math.hypot(q.x-p.x,q.z-p.z)<reach+this.reach(q)+.35)
        .map(q=>({id:q.i,state:q.state,x:q.x,z:q.z,reach:this.reach(q),distance:Math.hypot(q.x-p.x,q.z-p.z),nativeBodyPenetrationM:.6-Math.hypot(q.x-p.x,q.z-p.z)}));
    const stop=p.state==='stand'?this.stops[p.i%this.stops.length]:null;
    const stopNear=stop?this.t.index.nearest(stop.x??stop.doorX,stop.z??stop.doorZ,12,e=>this.ok(e)):null;
    const e=stopNear?.edge,lat=e?((stop.x??stop.doorX)-e.a.x)*e.nx+((stop.z??stop.doorZ)-e.a.z)*e.nz:null;
    return {id:p.i,x:p.x,z:p.z,state:p.state,edge:p.e?.id,side:p.side,s:p.s,dir:p.dir,speed:p.speed,phase:p.phase,scale:p.scale,
        reach,feetY:y,nativeCollisionHeight:2,live:!!p.live,stop:stop?{id:stop.id,x:stop.x,z:stop.z,doorX:stop.doorX,doorZ:stop.doorZ}:null,
        stopSourceSidewalk:e?{edge:e.id,a:{x:e.a.x,z:e.a.z},b:{x:e.b.x,z:e.b.z},wL:e.wL,wR:e.wR,halfW:e.halfW,sidewalk:e.sidewalk,sourceStopLateral:lat,sideEncoded:Math.abs(lat)>((lat>=0?e.wR:e.wL)??e.halfW??6)}:null,
        roadAt:!!this.roadAt(p.x,p.z),freeWalkingBody:this.freeWalkPoint(p.x,p.z,reach),freeVehicleBody:this.freeVehiclePoint(p.x,p.z,Math.max(reach,.7)),colliders,peers};
}
for(const name of ['admitInitialWalk','admitInitialStand']) {
    const original=Pedestrians.prototype[name];
    Pedestrians.prototype[name]=function(p){
        if(!admissionQA.beforeActors){admissionQA.vehicleConstructorAdmission=readVehicles(this.t);admissionQA.beforeActors=this.list.map(q=>read.call(this,q));}
        const before=read.call(this,p),result=original.call(this,p);
        if(result)admissionQA.repairs.push({method:name,before,after:read.call(this,p)});
        return result;
    };
}
const write=Pedestrians.prototype.writeMatrices;
Pedestrians.prototype.writeMatrices=function(dt){
    if(this.list.length&&this.list.every(p=>!p.live))admissionQA.initial={stats:{...this.stats},beforeActors:admissionQA.beforeActors,repairs:admissionQA.repairs,actors:this.list.map(p=>read.call(this,p))};
    return write.call(this,dt);
};
