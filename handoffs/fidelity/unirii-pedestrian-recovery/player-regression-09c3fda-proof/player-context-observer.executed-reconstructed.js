// Read-only physical attribution for contacts and a queue before native reset.
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
const keys=(o,names)=>Object.fromEntries(names.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const road=e=>e?{...keys(e,['id','name','type','len','wL','wR','sidewalk','layer','ya','yb','access']),a:keys(e.a,['id','sourceId','x','z','radius']),b:keys(e.b,['id','sourceId','x','z','radius'])}:null;
const leg=l=>({...keys(l,['x','z','cross','started','sx','sz','back','len','escape','recovery']),node:l.node?.id});
nativeQA.context=()=>{
    const P=game.player,T=game.traffic,H=harness.H,co=((P.front??2.2)-(P.rear??2.2))/2;
    const box={x:P.x+P.fx*co,z:P.z+P.fz*co,fx:P.fx,fz:P.fz,length:P.length,width:P.width};
    const actors=T.vehicles.filter(v=>Math.hypot(v.x-P.x,v.z-P.z)<85).map(v=>({
        ...keys(v,['id','kind','x','z','y','heading','fx','fz','speed','dir','s','lane','laneCur','latExtraCur','lateralExtra','length','width','layer','ghost','revT','ovT','knotT','knotN','stuck','still','blockT','stopD','stopWhy','zeroWhy','waitRed','parked','inactive','_f','_x0','_z0','_h0','_s0']),
        playerBodyPenetrationM:obbPen(vObb(v),box),edge:road(v.edge),previousEdge:v._e0?.id,
        leader:v.leader===P?'player':typeof v.leader==='object'?{id:v.leader?.id,kind:v.leader?.kind}:v.leader,
        route:v.route?.slice(0,4).map(l=>({edge:l.e.id,dir:l.dir}))}));
    const peds=T.peds.list.filter(p=>Math.hypot(p.x-P.x,p.z-P.z)<85).map(p=>({
        ...keys(p,['i','x','z','y','state','onRoad','live','dir','side','s','speed','blockT','crossT','progressT','progressX','progressZ','legBest','legStall','roadHits','onDodge']),
        edge:road(p.e),legs:p.legs?.map(leg),recovery:p.recovery?{...keys(p.recovery,['x','z','state','onRoad']),legs:p.recovery.legs?.map(leg)}:null,
        next:p.next?{edge:p.next.e?.id,...keys(p.next,['side','dir','s'])}:null}));
    const ap=H.ap,obstacle=ap?.path?H.obstacleAhead(ap.path,ap.s,30):null;
    return {wallClockMs:performance.now(),harnessSim:H.simT,scenarioTime:H.scT,trafficTime:T.time,frame:game.frame,
        player:{...keys(P,['x','z','y','surfY','heading','fx','fz','speed','front','rear','length','width','contactAge']),body:box,currentEdge:P.currentEdge?.id,
            touching:P.touching,lastCollider:keys(P.debug?.lastCollider||{},['type','id','kind','x','z','parked']),hits:P.debug?.hits.map(h=>keys(h,['type','id','kind','x','z','parked']))},
        input:keys(game.input.touch,['throttle','steer','brake']),ap:ap?{...keys(ap,['s','pi','waitT','stallT','revT','resets','laneBias','latShift','lastProgressT','bestRem','remaining','rerouteN','dev']),obstacle}:null,
        trafficStats:{...T.stats},actors,peds};
};
nativeQA.preResets=[];
const reset=harness.H.resetCar.bind(harness.H);
harness.H.resetCar=function(why){
    const row={why,state:nativeQA.context()};
    this.renderFrame();row.canvas=game.renderer.domElement.toDataURL('image/png');
    nativeQA.preResets.push(row);return reset(why);
};
