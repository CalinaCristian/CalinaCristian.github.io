// Read-only attribution around the actual guard; no state/clock/input edits.
import {Traffic} from '__BASE__game/src/traffic.js';
import {obbPen,vObb} from '__BASE__game/dev/harness/page/util.js';
const keys=(o,names)=>Object.fromEntries(names.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const road=e=>e?{...keys(e,['id','name','len','type','lanesF','lanesB','wL','wR','sharedLane','oneway','layer','ya','yb','access']),a:keys(e.a,['id','sourceId','x','z','radius']),b:keys(e.b,['id','sourceId','x','z','radius'])}:null;
const state=v=>v?({...keys(v,['id','kind','x','z','y','heading','fx','fz','s','dir','lane','laneCur','speed','ghost','revT','ovT','stopWhy','stopD','still','stuck','transition','latBlend','latExtraCur','lateralExtra','parked','service','inactive','_moveGeneration','_resp','_f','_x0','_z0','_h0','_s0','_y0']),length:v.length,width:v.width,height:v.mesh.userData.height,edge:road(v.edge),hist:v.hist?.map(l=>({edge:l.e.id,dir:l.dir})),route:v.route?.slice(0,5).map(l=>({edge:l.e.id,dir:l.dir,uturn:l.uturn}))}):null;
nativeQA.servicePair=[];
const original=Traffic.prototype.overlapGuard;
Traffic.prototype.overlapGuard=function(){
    const find=id=>this.vehicles.find(v=>v.id===id)||this.pool.find(v=>v.id===id),a=find(593),b=find(609);
    const read=()=>({actors:[state(a),state(b)],penetrationM:a&&b?obbPen(vObb(a),vObb(b)):null});
    const row={trafficTime:this.time,frame:this._frame,beforeGuard:read()};
    const result=original.call(this);row.afterGuard=read();nativeQA.servicePair.push(row);return result;
};
