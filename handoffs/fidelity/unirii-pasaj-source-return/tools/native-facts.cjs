// Independent read-only facts. Producer admission summaries are diagnostics;
// emitted model vertices and literal rail poses are recomputed separately.
module.exports=function nativeFacts(){
 const g=window.game,T=g.traffic,W=g.world,THREE=window.U.THREE,unknown=[];
 const pose=v=>{
  const m=v.mesh,a=m?.userData?._model?.geo?.attributes?.position,chain=[],parents=[];for(let p=m;p;p=p.parent)chain.unshift(p);
  const matrix=new THREE.Matrix4();for(const p of chain){const local=p.matrixAutoUpdate?new THREE.Matrix4().compose(p.position,p.quaternion,p.scale):p.matrix;matrix.multiply(local);if(p!==m)parents.push({id:p.id,name:p.name,matrix:local.toArray()});}
  let min=Infinity,max=-Infinity;const q=new THREE.Vector3();if(a)for(let i=0;i<a.count;i++){q.set(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(matrix);min=Math.min(min,q.y);max=Math.max(max,q.y);}
  const known=!!a&&Number.isFinite(min)&&Number.isFinite(max)&&max>min;if(!known)unknown.push(v.id);
  return {id:v.id,kind:v.kind,x:v.x,z:v.z,y:v.y,heading:v.heading,s:v.s,dir:v.dir,lane:v.lane,length:v.length,width:v.width,speed:v.speed,tram:!!v.tram,edgeId:v.edge?.id,sourceId:v.edge?.sourceId||W.data.roadSourceGeometry?.[v.edge?.road]?.sourceId,
   interval:{known,min:known?min:null,max:known?max:null,vertices:a?.count??0,basis:'actual primary emitted vertices through recomposed native local/parent matrices; no metadata height fallback'},matrixWorld:matrix.toArray(),parents,railSupport:v.railSupport??null};
 };
 const actors=T.vehicles.map(pose),pairs=[];
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j];if(Math.hypot(a.x-b.x,a.z-b.z)>(a.length+b.length+a.width+b.width)/2)continue;
  const ax=-Math.sin(a.heading),az=-Math.cos(a.heading),bx=-Math.sin(b.heading),bz=-Math.cos(b.heading),dx=b.x-a.x,dz=b.z-a.z;let pen=Infinity;
  for(const[ux,uz]of[[ax,az],[-az,ax],[bx,bz],[-bz,bx]])pen=Math.min(pen,Math.abs(ax*ux+az*uz)*a.length/2+Math.abs(-az*ux+ax*uz)*a.width/2+Math.abs(bx*ux+bz*uz)*b.length/2+Math.abs(-bz*ux+bx*uz)*b.width/2-Math.abs(dx*ux+dz*uz));
  if(pen<=0)continue;const known=a.interval.known&&b.interval.known,dy=known?Math.min(a.interval.max,b.interval.max)-Math.max(a.interval.min,b.interval.min):null;
  pairs.push({a:a.id,b:b.id,penetrationM:pen,actualVerticalIntersectionM:dy,heightKnown:known,deepContact:pen>.05&&(!known||dy>0)});
 }
 const railActors=T.vehicles.filter(v=>v.tram||v.edge?.rail).map(v=>{
  const e=v.edge,rail=!!e?.rail,t=rail?(v.dir>0?v.s/e.len:1-v.s/e.len):null,x=rail?e.a.x+(e.b.x-e.a.x)*t:null,z=rail?e.a.z+(e.b.z-e.a.z)*t:null;
  return{id:v.id,kind:v.kind,rail,sourceId:e?.sourceId,sourceNodeIds:e?.sourceNodeIds,sourceTags:e?.sourceTags,sourceXY:rail?{x,z}:null,actualXY:{x:v.x,z:v.z},sourceXYErrorM:rail?Math.hypot(v.x-x,v.z-z):null,dir:v.dir,railDirections:e?.railDirections,legalDirection:rail&&Array.isArray(e.railDirections)&&e.railDirections.includes(v.dir),modeSafe:rail&&e.publicDrive===false&&e.throughAccess===false&&e.publicTram===true&&e.throughTram===true,grade:e?.grade?Object.fromEntries(['known','basis','estimated','ya','yb','modelId'].map(k=>[k,e.grade[k]])):null,sourceSignalNodes:rail?[e.a,e.b].map(n=>({id:n.id,sourceId:n.sourceId,hasLight:n.hasLight,sourceSignal:n.sourceSignal?{unresolved:n.sourceSignal.unresolved,nodeId:n.sourceSignal.node?.id,approachId:n.sourceSignal.approach?.id,phase:n.sourceSignal.phase}:null,controllerId:T.boxController(n)?.id,state:T.lightState(n,e)})):[]};
 });
 const railFailures=railActors.filter(v=>!v.rail||!v.legalDirection||!v.modeSafe||!v.grade?.known||v.sourceXYErrorM>1e-6);
 return {scope:'Actual after-story-entry/pre-observer-warm natural scene. Producer summaries retained as diagnostics; body Y and rail centre/direction/mode recomputed independently. Not whole-body slab/static/roof/crowd or full-path acceptance.',
  counts:{active:T.vehicles.length,pool:T.pool.length,peds:T.peds.list.length},cohort:{active:T.vehicles.map(v=>v.id),pool:T.pool.map(v=>v.id),peds:T.peds.list.map(v=>v.i)},actors,pool:T.pool.map(v=>({id:v.id,kind:v.kind,inactive:v.inactive,x:v.x,y:v.y,z:v.z})),peds:T.peds.list.map(p=>({id:p.i,x:p.x,y:p.y,z:p.z,heading:p.heading,state:p.state,onRoad:p.onRoad,e:p.e?.id,sourceRoad:p.e?.road,side:p.side,s:p.s,dir:p.dir})),unknownModelHeightIds:unknown,vehiclePairs:pairs,deepVehicleContacts:pairs.filter(p=>p.deepContact),railActors,railFailures,
  initialAdmission:T.initialAdmission,initialBinding:T.initialTramBinding,tramSourceSignals:T.tramSourceSignals,sourceStats:{foregroundRuns:W.data.trams?.length,fullRailWays:W.data.tramSourceWays?.length,crossings:W.data.tramSourceCrossings?.length,restrictions:W.data.roadRestrictions?.length,tramNetwork:T.tramNetwork?.report},
  acceptedForBoundedDrive:T.initialAdmission?.passed===true&&T.initialTramBinding?.passed===true&&!unknown.length&&!pairs.some(p=>p.deepContact)&&!railFailures.length};
};
