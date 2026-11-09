// Diagnostic elapsed wrappers call exact original methods and are restored in finally.
// All source/body/population guards remain active. Normal keyboard braking only.
module.exports=function(g,{sourceCommit,stationaryFrames=120}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('Exact source required');
 const P=g.player,W=g.world,T=g.traffic,dt=1/30,undo=[],timings={},counts={},braking=[],stationary=[],events=[];let phase='braking';
 const pose=()=>({x:P.x,y:P.y,z:P.z,speed:P.speed,source:P.supportEdge?.access?.sourceId,edge:P.supportEdge?.id,inside:W.district.inside(P.x,P.z),contacts:P.debug.count,last:P.debug.lastCollider,time:T.time});
 const fleet=()=>({active:T.vehicles.map(v=>({id:v.id,kind:v.kind})),pool:T.pool.map(v=>({id:v.id,kind:v.kind})),pedestrians:T.peds.list.map(p=>p.id)});
 const wrap=(obj,key,name)=>{const fn=obj?.[key];if(typeof fn!=='function')return;const replacement=function(...args){const start=performance.now();try{return fn.apply(this,args)}finally{const key=phase+':'+name;(timings[key]||=[]).push(performance.now()-start);counts[key]=(counts[key]||0)+1}};for(const key of Reflect.ownKeys(fn)){if(['name','length','prototype','caller','arguments'].includes(key))continue;try{Object.defineProperty(replacement,key,Object.getOwnPropertyDescriptor(fn,key));}catch{}}obj[key]=replacement;undo.push(()=>obj[key]=fn);};
 const emit=(code,on)=>{events.push({phase,code,on,time:T.time});window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));};
 const before={pose:pose(),fleet:fleet()},draw=g.drawFrame,contactStart=P.debug.count;
 for(const [o,k,n]of [[g,'updateDrive','updateDrive'],[T,'update','Traffic.update'],[T,'placeOnLane','Traffic.placeOnLane'],[P,'update','Player.update'],[P,'collide','Player.collide'],[P,'ownSurface','Player.ownSurface'],[P,'followSurface','Player.followSurface'],[W,'roadHeight','World.roadHeight']])wrap(o,k,n);
 const grades=new Set(W.allEdges.map(e=>e.sourceBridgeGrade).filter(Boolean));for(const q of grades)wrap(q,'heightAtWorld','sourceBridgeGrade.heightAtWorld');
 g.drawFrame=function(){};let stopped=null,afterBrake;
 try{
  for(const c of ['KeyW','KeyS','KeyA','KeyD'])emit(c,false);emit('Space',true);
  for(let i=0;i<60;i++){g.updateDrive(dt);braking.push(pose());if(P.debug.count>contactStart){stopped='native-braking-contact';break;}if(Math.abs(P.speed)<.05)break;}
  afterBrake=pose();if(!stopped&&Math.abs(P.speed)>=.05)stopped='ordinary-brake-did-not-stop';
  if(!stopped){phase='stationary-player-evolving-traffic';for(let i=0;i<stationaryFrames;i++){g.updateDrive(dt);stationary.push(pose());if(P.debug.count>contactStart){stopped='native-stationary-contact';break;}if(Math.hypot(P.x-afterBrake.x,P.z-afterBrake.z)>.1){stopped='player-no-longer-stationary';break;}}}
 }finally{emit('Space',false);for(const restore of undo.reverse())restore();g.drawFrame=draw;}
 const summary={};for(const[k,a]of Object.entries(timings)){const s=a.slice().sort((a,b)=>a-b);summary[k]={calls:a.length,sumMs:a.reduce((a,b)=>a+b,0),medianMs:s[s.length>>1],p95Ms:s[Math.floor(s.length*.95)],maxMs:s.at(-1)}}
 const result={sourceCommit,scope:'Separate ordinary-key braking then stationary-player/evolving-full-traffic fixed-step profile. Original146s moving drive unchanged. Explicit inclusive elapsed method wrappers; nested sums overlap; software browser/scheduler environment, not hardware FPS or exclusive V8 CPU. No CDP sample captured by this runner.',dt,stationaryFramesRequested:stationaryFrames,phase,stopped,before,afterBrake,after:{pose:pose(),fleet:fleet()},braking,stationary,summary,timings,events,restored:true};window.__nativeStationaryCpu=result;return result;
};
