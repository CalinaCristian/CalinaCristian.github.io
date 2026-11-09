// Read-only observer loaded before the actual district constructor. __BASE__ is
// replaced with the snapshot's served URL by the Node runner.
import {Pedestrians} from '__BASE__game/src/traffic.js';
import {collideBuildings} from '__BASE__game/src/world.js';
window.admissionQA={beforeActors:null,repairs:[]};
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
    return {id:p.i,x:p.x,z:p.z,state:p.state,edge:p.e?.id,side:p.side,s:p.s,dir:p.dir,speed:p.speed,phase:p.phase,scale:p.scale,
        reach,feetY:y,nativeCollisionHeight:2,live:!!p.live,stop:stop?{id:stop.id,x:stop.x,z:stop.z,doorX:stop.doorX,doorZ:stop.doorZ}:null,
        roadAt:!!this.roadAt(p.x,p.z),freeWalkingBody:this.freeWalkPoint(p.x,p.z,reach),freeVehicleBody:this.freeVehiclePoint(p.x,p.z,Math.max(reach,.7)),colliders,peers};
}
for(const name of ['admitInitialWalk','admitInitialStand']) {
    const original=Pedestrians.prototype[name];
    Pedestrians.prototype[name]=function(p){
        if(!admissionQA.beforeActors)admissionQA.beforeActors=this.list.map(q=>read.call(this,q));
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
