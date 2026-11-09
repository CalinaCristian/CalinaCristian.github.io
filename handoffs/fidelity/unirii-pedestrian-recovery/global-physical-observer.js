// Read-only all-active-actor physical sampling; no controller/hash/clock edits.
import {Pedestrians} from '__BASE__game/src/traffic.js';
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
import {vehicleVerticalInterval} from '__BASE__game/src/initial-vehicle-admission.js';
window.globalQA={models:new Map(),rows:[],population:null,railSourceRequired:false};
const write=Pedestrians.prototype.writeMatrices;
Pedestrians.prototype.writeMatrices=function(dt){
    if(globalQA.population!==this.list){
        globalQA.population=this.list;globalQA.models=new Map();bodyCache.clear();verticalCache.clear();
        const set=this.crowd.set.bind(this.crowd);
        this.crowd.set=function(id,pose){globalQA.models.set(id,{...pose});return set(id,pose);};
    }
    return write.call(this,dt);
};
function buckets(cell){
    const map=new Map(),used=[];
    return {reset(){for(const a of used)a.length=0;used.length=0;},
        add(v,x,z){const key=Math.floor(x/cell)+','+Math.floor(z/cell);let a=map.get(key);if(!a)map.set(key,a=[]);if(!a.length)used.push(a);a.push(v);},
        query(x,z,r,fn){for(let i=Math.floor((x-r)/cell);i<=Math.floor((x+r)/cell);i++)for(let k=Math.floor((z-r)/cell);k<=Math.floor((z+r)/cell);k++){const a=map.get(i+','+k);if(a)for(const v of a)fn(v);}}};
}
const cars=buckets(16),people=buckets(4),bodyCache=new Map(),verticalCache=new Map();
const carState=v=>({id:v.id,kind:v.kind,x:v.x,z:v.z,y:v.y,heading:v.heading,length:v.length,width:v.width,height:v.mesh.userData.height,
    verticalInterval:vehicleVerticalInterval(v),edge:v.edge?.id,sourceId:v.edge?.access?.sourceId,layer:v.layer,dir:v.dir,s:v.s,lane:v.lane,laneCur:v.laneCur,generation:v._moveGeneration||0,respawned:!!v._resp,ghost:v.ghost||0,speed:v.speed});
const pedState=p=>({id:p.i,state:p.state,x:p.x,z:p.z,edge:p.e?.id,sourceId:p.e?.access?.sourceId,onRoad:p.onRoad,live:p.live,model:globalQA.models.get(p.i)});
globalQA.sample=function(dt){
    const T=game.traffic,vs=T.vehicles.filter(v=>!v.inactive),ps=T.peds.list,row={dt,trafficTime:T.time,harnessSim:harness.H.simT,scenarioTime:harness.H.scT,trafficFrame:T._frame,pedestrianFrame:T.peds._fr,
        population:{activeVehicles:vs.length,pooledVehicles:T.pool.length,allVehicleIds:T.vehicles.concat(T.pool).map(v=>v.id).sort((a,b)=>a-b),people:ps.length,pedestrianIds:ps.map(p=>p.i)},
        vehicleBodyContacts:[],peerBodyEnvelopes:[],unknownVehicleHeights:[],unknownPedestrianModels:[],downPedestrians:[],coverageGaps:[]};
    T.group?.updateWorldMatrix?.(true,false);
    const matrix=T.group?.matrixWorld?.elements,identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    row.trafficParent={matrix:matrix?Array.from(matrix):null,identity:!!matrix&&identity.every((v,i)=>Math.abs(matrix[i]-v)<1e-9),intervalDependency:'c4 vehicleVerticalInterval emitted-model YXZ; native identity Traffic parent required'};
    if(!row.trafficParent.identity){row.coverageGaps.push('Missing/nonidentity Traffic parent: local pose/intervals are not certified world bodies');globalQA.rows.push(row);return row;}
    if(globalQA.railSourceRequired){row.railSource=window.railQA?.read(T,{stage:'motion'})||{passed:false,issues:[{type:'missing-rail-source-observer'}]};if(!row.railSource.passed)row.coverageGaps.push('Native rail source binding/pose/direction/grade gate failed; see railSource');}
    cars.reset();let largest=0;
    for(const v of vs){const iv=vehicleVerticalInterval(v);verticalCache.set(v,iv);if(!iv.known)row.unknownVehicleHeights.push(carState(v));let b=bodyCache.get(v);if(!b)bodyCache.set(v,b={});Object.assign(b,vObb(v));cars.add(v,v.x,v.z);largest=Math.max(largest,Math.hypot(v.length,v.width)/2);}
    for(const v of vs){const iv=verticalCache.get(v);if(!iv.known)continue;cars.query(v.x,v.z,Math.hypot(v.length,v.width)/2+largest,o=>{
        const ov=verticalCache.get(o);if(o.id<=v.id||!ov.known)return;
        const vertical=Math.min(iv.max,ov.max)-Math.max(iv.min,ov.min);if(vertical<=0)return;
        const penetration=obbPen(bodyCache.get(v),bodyCache.get(o));if(penetration>1e-6)row.vehicleBodyContacts.push({a:carState(v),b:carState(o),orientedXZPenetrationM:penetration,actualVerticalIntersectionM:vertical});
    });}
    people.reset();
    for(const p of ps){const m=globalQA.models.get(p.i);if(!m||!Number.isFinite(m.y)||!Number.isFinite(m.scale)){row.unknownPedestrianModels.push(p.i);continue;}if(m.down||p.state==='down'){row.downPedestrians.push(pedState(p));continue;}people.add(p,p.x,p.z);}
    for(const p of ps){const m=globalQA.models.get(p.i);if(!m||!Number.isFinite(m.y)||!Number.isFinite(m.scale)||m.down||p.state==='down')continue;people.query(p.x,p.z,.6,q=>{
        if(q.i<=p.i)return;const n=globalQA.models.get(q.i);if(!n)return;
        const d=Math.hypot(p.x-q.x,p.z-q.z);if(d>=.6-1e-6)return;
        const vertical=Math.min(m.y+1.75*m.scale,n.y+1.75*n.scale)-Math.max(m.y,n.y);if(vertical<=0)return;
        row.peerBodyEnvelopes.push({a:pedState(p),b:pedState(q),distanceM:d,bodyEnvelopePenetrationM:.6-d,nativeVerticalBodyEnvelopeIntersectionM:vertical});
    });}
    globalQA.rows.push(row);return row;
};
