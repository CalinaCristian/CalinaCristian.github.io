import {Traffic} from '__BASE__game/src/traffic.js';
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
const keys=(o,names)=>Object.fromEntries(names.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const road=e=>e?{...keys(e,['id','name','len','type','lanesF','lanesB','wL','wR','layer','ya','yb','access']),a:keys(e.a,['id','x','z','radius']),b:keys(e.b,['id','x','z','radius'])}:null;
const state=v=>({...keys(v,['id','kind','x','z','y','heading','fx','fz','s','dir','lane','laneCur','speed','ghost','revT','ovT','stopWhy','stopD','still','stuck','_x0','_z0','_h0','_s0']),length:v.length,width:v.width,edge:road(v.edge),hist:v.hist?.map(l=>({edge:l.e.id,dir:l.dir})),route:v.route?.slice(0,5).map(l=>({edge:l.e.id,dir:l.dir}))});
nativeQA.guardProposals=[];
const original=Traffic.prototype.overlapGuard;
Traffic.prototype.overlapGuard=function(){
    const v=this.vehicles.find(v=>v.id===57),row=v?{trafficTime:this.time,frame:this._frame,proposed:state(v),contacts:[]}:null;
    if(v)for(const o of this.vehicles){if(o===v||Math.abs(o.y-v.y)>2||Math.hypot(o.x-v.x,o.z-v.z)>v.length/2+o.length/2+4)continue;
        const old={...v,x:v._x0,z:v._z0,heading:v._h0},p=obbPen(vObb(v),vObb(o)),p0=obbPen(vObb(old),vObb(o));
        if(p>-.2)row.contacts.push({other:state(o),proposedPenetrationM:p,previousPenetrationM:p0});
    }
    const result=original.call(this);
    if(row){row.after=state(v);if(row.contacts.length||v.stuck>2)nativeQA.guardProposals.push(row);}
    return result;
};
