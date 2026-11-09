// Independent read-only source/body support trace; no producer certificate pass.
module.exports=function nativeSupportTrace(){
 const g=game,W=g.world,T=g.traffic,P=g.player,U=window.U,THREE=U.THREE;
 const cache=U.supportIntervals||(U.supportIntervals=new WeakMap());
 const matrixOf=mesh=>{const chain=[];for(let n=mesh;n;n=n.parent)chain.unshift(n);const m=new THREE.Matrix4();for(const n of chain)m.multiply(n.matrixAutoUpdate?new THREE.Matrix4().compose(n.position,n.quaternion,n.scale):n.matrix);return m;};
 const actual=v=>{
  const geo=v.mesh?.userData?._model?.geo,p=geo?.attributes?.position;if(!p?.count||p.normalized)return{known:false,reason:'missing-actual-primary-model'};
  const m=matrixOf(v.mesh),e=m.elements,key=[e[1],e[5],e[9],p.version,p.count].join(','),old=cache.get(geo);let local=old?.position===p?old:null;
  if(!local){local={position:p,poses:new Map()};cache.set(geo,local);}let range=local.poses.get(key);
  if(!range){let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const y=e[1]*p.getX(i)+e[5]*p.getY(i)+e[9]*p.getZ(i);lo=Math.min(lo,y);hi=Math.max(hi,y);}range={lo,hi};if(local.poses.size>=32)local.poses.clear();local.poses.set(key,range);}
  return{known:Number.isFinite(range.lo)&&Number.isFinite(range.hi),min:range.lo+e[13],max:range.hi+e[13],vertices:p.count,meshPitch:v.mesh.rotation.x,meshRoll:v.mesh.rotation.z,matrixWorld:m.toArray(),basis:'actual primary emitted model vertices through recomposed actual native parent chain; exact Y-row cache, no metadata height fallback'};
 };
 const source=e=>e?.sourceId||W.data.roadSourceGeometry?.[e?.road]?.sourceId;
 const support=(v)=>{const e=v.edge,sourceSurfaceY=e?W.roadHeight(v.x,v.z,e):null,footprintWithinStation=e?Math.min(v.s,e.len-v.s)>=v.length/2:null;
  return{id:v.id,kind:v.kind,parked:!!v.parked,x:v.x,y:v.y,z:v.z,heading:v.heading,edgeId:e?.id,sourceId:source(e),s:v.s,dir:v.dir,lane:v.lane,laneCur:v.laneCur,latExtraCur:v.latExtraCur,lateralExtra:v.lateralExtra,sourceSurfaceY,originVsSourceSurfaceM:Number.isFinite(sourceSurfaceY)?v.y-sourceSurfaceY:null,footprintWithinStation,connectedLegSupportRequired:!footprintWithinStation,model:actual(v)};
 };
 const e=P.supportEdge,roadY=e?W.roadHeight(P.x,P.z,e):null;
 return{simT:harness.H.simT,trafficTime:T.time,player:{x:P.x,y:P.y,z:P.z,surfY:P.surfY,pitch:P.pitch,heading:P.heading,speed:P.speed,edgeId:e?.id,sourceId:source(e),sourceSurfaceY:roadY,surfVsSourceSurfaceM:Number.isFinite(roadY)?P.surfY-roadY:null},actors:T.vehicles.map(support),pool:T.pool.map(v=>({id:v.id,kind:v.kind,inactive:!!v.inactive})),peds:T.peds.list.map(p=>p.i),scope:'Continuous actual model-Y/source-centre support observations. Full-body connected-leg/static/roof/ground contact classification is separate; no invented continuation or nearest-layer pass.'};
};
