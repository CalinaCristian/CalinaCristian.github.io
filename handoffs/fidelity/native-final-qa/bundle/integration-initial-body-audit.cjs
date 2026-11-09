// Read-only initial body observer. Factory is serialized unchanged into the browser and CPU-tested below.
// No production admission helper is reused: geometry/poses are observed independently before publication.
function createInitialBodyAuditToolkit() {
 const thresholds=Object.freeze({xyPenetrationM:.05,verticalIntersectionM:0,rawXYPositiveM:0});
 const geometryCache=new WeakMap();
 const finite=Number.isFinite, clean=v=>finite(v)?v:null;
 function plain(value){const ancestors=new Map();function copy(v,where){if(v===undefined)return null;if(typeof v==='function')return{$function:true};if(typeof v==='number')return finite(v)?v:null;if(!v||typeof v!=='object')return v;if(ancestors.has(v))return{$cycle:ancestors.get(v)};ancestors.set(v,where);const out=Array.isArray(v)?v.map((item,i)=>copy(item,where+'.'+i)):Object.fromEntries(Object.entries(v).map(([k,item])=>[k,copy(item,where+'.'+k)]));ancestors.delete(v);return out;}return copy(value,'$');}
 const vec=o=>({x:clean(o?.x),y:clean(o?.y),z:clean(o?.z)});
 const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function multiply(a,b){const out=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
 function localMatrix(o){
  const p=o.position||{x:0,y:0,z:0},q=o.quaternion||{x:0,y:0,z:0,w:1},s=o.scale||{x:1,y:1,z:1};
  if(![p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z].every(finite))throw Error('nonfinite native transform');
  const x=q.x,y=q.y,z=q.z,w=q.w,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return[(1-(yy+zz))*s.x,(xy+wz)*s.x,(xz-wy)*s.x,0,(xy-wz)*s.y,(1-(xx+zz))*s.y,(yz+wx)*s.y,0,(xz+wy)*s.z,(yz-wx)*s.z,(1-(xx+yy))*s.z,0,p.x,p.y,p.z,1];
 }
 function worldMatrix(mesh){const chain=[],seen=new Set();for(let o=mesh;o;o=o.parent){if(seen.has(o)||chain.length>64)throw Error('invalid native parent chain');seen.add(o);chain.push(o);}let m=identity();for(let i=chain.length-1;i>=0;i--)m=multiply(m,localMatrix(chain[i]));return m;}
 function vertices(geo){
  if(!geo)return null;if(geometryCache.has(geo))return geometryCache.get(geo);
  const p=geo.attributes?.position;if(!p||!finite(p.count)||p.count<1)return null;
  const data=new Float64Array(p.count*3);for(let i=0;i<p.count;i++){const point=typeof p.getX==='function'?[p.getX(i),p.getY(i),p.getZ(i)]:[p.array?.[i*(p.itemSize||3)],p.array?.[i*(p.itemSize||3)+1],p.array?.[i*(p.itemSize||3)+2]];for(let k=0;k<3;k++){if(!finite(point[k]))throw Error('nonfinite actual model vertex');data[i*3+k]=point[k];}}
  geometryCache.set(geo,data);return data;
 }
 function verticalInterval(v,m=worldMatrix(v.mesh)){
  const geo=v.mesh?.userData?._model?.geo||v.mesh?.geometry,data=vertices(geo);let min=Infinity,max=-Infinity,method='actual-model-vertices',count=0;
  if(data){for(let i=0;i<data.length;i+=3){const y=m[1]*data[i]+m[5]*data[i+1]+m[9]*data[i+2]+m[13];min=Math.min(min,y);max=Math.max(max,y);}count=data.length/3;}
  else if(geo?.boundingBox&&[geo.boundingBox.min.x,geo.boundingBox.min.y,geo.boundingBox.min.z,geo.boundingBox.max.x,geo.boundingBox.max.y,geo.boundingBox.max.z].every(finite)){
   method='actual-model-bounding-box';for(const x of[geo.boundingBox.min.x,geo.boundingBox.max.x])for(const y of[geo.boundingBox.min.y,geo.boundingBox.max.y])for(const z of[geo.boundingBox.min.z,geo.boundingBox.max.z]){const h=m[1]*x+m[5]*y+m[9]*z+m[13];min=Math.min(min,h);max=Math.max(max,h);}
  }else{
   const h=v.mesh?.userData?.height,L=v.length,W=v.width;
   if(![h,L,W].every(n=>finite(n)&&n>0))return{known:false,method:'unknown',reason:'no actual model geometry or explicit model dimensions'};
   method='explicit-model-dimensions-fallback';for(const x of[-W/2,W/2])for(const y of[0,h])for(const z of[-L/2,L/2]){const top=m[1]*x+m[5]*y+m[9]*z+m[13];min=Math.min(min,top);max=Math.max(max,top);}
  }
  return{known:finite(min)&&finite(max)&&max>min,min:clean(min),max:clean(max),method,vertices:count,declaredModelHeight:clean(v.mesh?.userData?.height)};
 }
 function sat(a,b){let min=Infinity;const dx=b.x-a.x,dz=b.z-a.z;for(const[ux,uz]of[[a.fx,a.fz],[-a.fz,a.fx],[b.fx,b.fz],[-b.fz,b.fx]]){
  const ra=Math.abs(a.fx*ux+a.fz*uz)*a.length/2+Math.abs(-a.fz*ux+a.fx*uz)*a.width/2;
  const rb=Math.abs(b.fx*ux+b.fz*uz)*b.length/2+Math.abs(-b.fz*ux+b.fx*uz)*b.width/2;
  min=Math.min(min,ra+rb-Math.abs(dx*ux+dz*uz));}return min;
 }
 function vehicle(v,collection){
  const record={id:v.id,collection,kind:v.kind,inactive:!!v.inactive,meshVisible:v.mesh?.visible,native:{x:clean(v.x),y:clean(v.y),z:clean(v.z),heading:clean(v.heading),length:clean(v.length),width:clean(v.width),speed:clean(v.speed),lane:v.lane,s:clean(v.s),layer:v.layer,edgeId:v.edge?.id,wayId:v.edge?.wayId,from:v.edge?.a?.id,to:v.edge?.b?.id},mesh:{position:vec(v.mesh?.position),rotation:vec(v.mesh?.rotation),scale:vec(v.mesh?.scale),quaternion:v.mesh?.quaternion?{x:clean(v.mesh.quaternion.x),y:clean(v.mesh.quaternion.y),z:clean(v.mesh.quaternion.z),w:clean(v.mesh.quaternion.w)}:null},valid:false};
  try{
   if(!v.mesh)throw Error('missing actual vehicle mesh');const m=worldMatrix(v.mesh),fx=-m[8],fz=-m[10],n=Math.hypot(fx,fz),length=v.length*Math.hypot(m[8],m[9],m[10]),width=v.width*Math.hypot(m[0],m[1],m[2]);
   if(![m[12],m[14],length,width,n].every(finite)||length<=0||width<=0||n<=0)throw Error('invalid actual drawn body rectangle');
   record.body={x:m[12],z:m[14],fx:fx/n,fz:fz/n,length,width,heading:Math.atan2(-fx/n,-fz/n)};record.vertical=verticalInterval(v,m);record.valid=record.vertical.known&&record.vertical.method==='actual-model-vertices';
   if(!record.valid)record.invalidReason=record.vertical.reason||'initial acceptance requires actual emitted model vertices; fallback retained for diagnosis';
  }catch(e){record.invalidReason=String(e.message||e);record.vertical={known:false,method:'unknown',reason:record.invalidReason};}
  record.source={edgeId:v.edge?.id,sourceId:v.edge?.sourceId||v.edge?.access?.sourceId||null,sourceNodeIds:plain(v.edge?.sourceNodeIds),rail:!!v.edge?.rail,railDirections:Array.isArray(v.edge?.railDirections)?v.edge.railDirections.slice():null,dir:v.dir,lane:v.lane,laneCur:clean(v.laneCur),s:clean(v.s),route:plain((v.route||[]).map(e=>typeof e==='object'?e?.id:e)),hist:plain((v.hist||[]).map(e=>typeof e==='object'?e?.id:e))};
  record.railSupport=plain(v.railSupport);
  return record;
 }
 function pairs(records){const rawXYPositives=[],genuineIntersections=[],unknownHeightPairs=[];let tested=0;
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
   const a=records[i],b=records[j];if(!a.body||!b.body)continue;tested++;const xy=sat(a.body,b.body);if(!(xy>thresholds.rawXYPositiveM))continue;
   const y=a.vertical?.known&&b.vertical?.known?Math.min(a.vertical.max,b.vertical.max)-Math.max(a.vertical.min,b.vertical.min):null;
   const row={a:a.id,b:b.id,xyPenetrationM:xy,verticalIntersectionM:y,bodyA:a.body,bodyB:b.body,verticalA:a.vertical,verticalB:b.vertical};rawXYPositives.push(row);
   if(y===null)unknownHeightPairs.push(row);else if(xy>thresholds.xyPenetrationM&&y>thresholds.verticalIntersectionM)genuineIntersections.push(row);
  }return{tested,rawXYPositives,genuineIntersections,unknownHeightPairs};
 }
 function playerVertical(P){let min=Infinity,max=-Infinity,parts=0;const stack=P.cockpit?[P.cockpit]:[];while(stack.length){const mesh=stack.pop();if(mesh.geometry?.attributes?.position){const interval=verticalInterval({mesh});if(interval.known){min=Math.min(min,interval.min);max=Math.max(max,interval.max);parts++;}}for(const child of mesh.children||[])stack.push(child);}if(parts)return{known:true,min,max,method:'actual-player-cockpit-geometry',parts};const bottom=P.surfY??P.y,height=P.bodyHeight;return finite(bottom)&&finite(height)&&height>0?{known:true,min:bottom,max:bottom+height,method:'explicit-native-player-collision-body-height'}:{known:false,method:'unknown-player-body-height'};}
 function snapshot(g,phase,request,serial){
  const T=g.traffic,active=(T?.vehicles||[]).map(v=>vehicle(v,'active')),pool=(T?.pool||[]).map(v=>vehicle(v,'pool')),people=(T?.peds?.list||[]).map(p=>({id:p.i,x:clean(p.x),z:clean(p.z),footY:clean(p._fy),heading:clean(p.heading),scale:clean(p.scale),state:p.state,onRoad:!!p.onRoad,edgeId:p.e?.id,from:p.e?.a?.id,to:p.e?.b?.id,dir:p.dir,side:p.side,s:clean(p.s),animX:clean(p.animX),animZ:clean(p.animZ)}));
  const ids=[...active,...pool].map(v=>v.id),pedIds=people.map(p=>p.id),invalidState=[];
  if(!T||!Array.isArray(T.vehicles)||!Array.isArray(T.pool)||!Array.isArray(T.peds?.list))invalidState.push('missing native traffic/actor arrays');
  const publication={trafficTime:clean(T?.time),initialTramBinding:plain(T?.initialTramBinding),initialAdmission:plain(T?.initialAdmission),sourceSignals:plain(T?.tramSourceSignals)};
  if(T?.initialTramBinding?.passed!==true)invalidState.push('native initialTramBinding missing or failed');
  if(T?.initialAdmission?.passed!==true)invalidState.push('native initialAdmission missing or failed');
  const policyEdges=Array.isArray(g.world?.graph?.edges)?g.world.graph.edges:[];
  const worldPolicy={sidewalkMethodAvailable:typeof g.world?.sidewalkWidth==='function',edges:policyEdges.map(e=>({id:e.id,sourceId:e.access?.sourceId||e.sourceId||null,sidewalkLeftM:clean(e.sidewalkLeftM),sidewalkRightM:clean(e.sidewalkRightM),sidewalkSource:plain(e.sidewalkSource),directLeftM:typeof g.world.sidewalkWidth==='function'?clean(g.world.sidewalkWidth(e,-1)):null,directRightM:typeof g.world.sidewalkWidth==='function'?clean(g.world.sidewalkWidth(e,1)):null,railDirections:Array.isArray(e.railDirections)?e.railDirections.slice():null})),coveredRoads:plain(g.world?.stats?.coveredRoads)};
  if(ids.some(id=>id===undefined)||new Set(ids).size!==ids.length)invalidState.push('missing/duplicate active+pool vehicle IDs');
  if(pedIds.some(id=>id===undefined)||new Set(pedIds).size!==pedIds.length||people.some(p=>p.x===null||p.z===null))invalidState.push('missing/duplicate pedestrian IDs or physical XZ');
  const invalidActiveBodies=active.filter(v=>!v.valid),pairAudit=pairs(active),P=g.player;let player=null;
  if(P&&[P.x,P.z,P.fx,P.fz,P.front,P.rear,P.width].every(finite)){
   const offset=(P.front-P.rear)/2,body={x:P.x+P.fx*offset,z:P.z+P.fz*offset,fx:P.fx,fz:P.fz,length:P.front+P.rear,width:P.width};
   const vertical=playerVertical(P);
   const rawXYPositives=active.filter(v=>v.body&&sat(v.body,body)>0).map(v=>({id:v.id,xyPenetrationM:sat(v.body,body),vertical:v.vertical,verticalIntersectionM:vertical.known&&v.vertical.known?Math.min(vertical.max,v.vertical.max)-Math.max(vertical.min,v.vertical.min):null}));
   player={x:P.x,y:clean(P.y),z:P.z,heading:clean(P.heading),front:P.front,rear:P.rear,width:P.width,body,vertical,rawXYPositives,genuineIntersections:rawXYPositives.filter(v=>v.xyPenetrationM>thresholds.xyPenetrationM&&v.verticalIntersectionM>0),unclassifiedIntersections:rawXYPositives.filter(v=>v.xyPenetrationM>thresholds.xyPenetrationM&&v.verticalIntersectionM===null)};
  }
  return{serial,phase,request:request?{...request}:null,at:typeof performance==='undefined'?null:performance.now(),district:g.district||g.world?.district?.id,city:g.city?.id,gameState:g.state,thresholds,scope:'All native active body OBBs with actual transformed emitted-model Y intervals; no layer exemptions. Pooled poses retained but not published-pair tested. Mesh mirrors/extras outside nominal L/W are outside the body-OBB scope.',publication,worldPolicy,native:{configuredQuality:g.quality,touch:g.touch,maxVehicles:T?.maxVehicles,profile:T?.profile?{...T.profile}:null,target:T?.target?{...T.target}:null,counts:T?.counts?{...T.counts}:null,activeIds:active.map(v=>v.id),poolIds:pool.map(v=>v.id),pedestrianIds:pedIds},active,pool,pedestrians:people,player,pairAudit,invalidState,invalidActiveBodies:invalidActiveBodies.map(v=>({id:v.id,reason:v.invalidReason})),heightFallbacks:active.filter(v=>v.vertical?.method!=='actual-model-vertices').map(v=>({id:v.id,vertical:v.vertical})),pass:invalidState.length===0&&invalidActiveBodies.length===0&&pairAudit.genuineIntersections.length===0&&(!player||(player.genuineIntersections.length===0&&player.unclassifiedIntersections.length===0))};
 }
 function install(g,emit){
  const state={records:[],errors:[],request:null,thresholds},seen=new WeakSet();let serial=0;
  function observe(receiver,phase){try{const record=snapshot(receiver,phase,state.request,++serial);state.records.push(record);emit(record);}catch(e){const failure={serial:++serial,phase,request:state.request?{...state.request}:null,auditError:String(e.stack||e),pass:false};state.errors.push(failure);state.records.push(failure);emit(failure);}}
  const attach=g.attachWorldRender,renderer=g.renderer,render=renderer?.render;if(typeof attach!=='function'||typeof render!=='function')throw Error('initial audit requires actual attachWorldRender and renderer.render pointers');
  g.attachWorldRender=function(...args){observe(this,'before-attachWorldRender');return attach.apply(this,args);};
  renderer.render=function(...args){if(args[0]===g.scene&&g.world&&args[0]&&typeof args[0]==='object'&&!seen.has(args[0])){seen.add(args[0]);observe(g,'before-first-world-draw');}return render.apply(this,args);};
  return state;
 }
 return{thresholds,worldMatrix,verticalInterval,sat,vehicle,pairs,snapshot,install};
}
exports.createInitialBodyAuditToolkit=createInitialBodyAuditToolkit;
