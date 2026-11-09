// Diagnostic only: literal exported source path guides DOM keyboard events.
// Full native physics/AI/collision caller; no player/actor/source/nav pose or route writes.
module.exports=function nativePolylineDriver(g,{frames=300,points=window.__localBridgePoints,sourceCommit}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('Frozen sourceCommit required before native drive');
 const P=g.player,draw=g.drawFrame,records=[],events=[],keys=new Set(),codes=['KeyW','KeyS','KeyA','KeyD','Space'],dt=1/30,segs=[];let length=0,tick=-1,stopped=null;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);segs.push({a,b,L,start:length,dx:(b[0]-a[0])/L,dz:(b[1]-a[1])/L});length+=L;}
 const emit=(code,on)=>{window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));events.push({i:tick,code,on});};
 const set=want=>{for(const c of codes){const on=want.includes(c);if(on!==keys.has(c)){emit(c,on);if(on)keys.add(c);else keys.delete(c);}}};for(const c of codes)emit(c,false);const initialCount=P.debug.count;
 g.drawFrame=function(){};
 try{for(tick=0;tick<frames;tick++){
  let near=null,best=Infinity;for(const s of segs){const t=Math.max(0,Math.min(s.L,(P.x-s.a[0])*s.dx+(P.z-s.a[1])*s.dz)),x=s.a[0]+s.dx*t,z=s.a[1]+s.dz*t,d=Math.hypot(P.x-x,P.z-z);if(d<best){best=d;near={station:s.start+t};}}
  const ahead=segs.find(s=>near.station+24<=s.start+s.L)||segs.at(-1),here=segs.find(s=>near.station<=s.start+s.L)||segs.at(-1),bend=Math.abs(Math.atan2(here.dx*ahead.dz-here.dz*ahead.dx,here.dx*ahead.dx+here.dz*ahead.dz)),targetSpeed=bend>.15?4:8,look=Math.min(length,near.station+(bend>.15?8:16)),s=segs.find(s=>look<=s.start+s.L)||segs.at(-1),t=look-s.start,tx=s.a[0]+s.dx*t,tz=s.a[1]+s.dz*t,want=Math.atan2(P.x-tx,P.z-tz),delta=Math.atan2(Math.sin(want-P.heading),Math.cos(want-P.heading)),input=[];
  if(Math.abs(P.speed)<targetSpeed)input.push('KeyW');if(Math.abs(P.speed)>targetSpeed+.5)input.push('Space');if(delta>.025)input.push('KeyA');if(delta<-.025)input.push('KeyD');set(input);const x=P.x,z=P.z;g.updateDrive(dt);
  const last=P.debug.lastCollider;if(tick%5===0||P.touching)records.push({i:tick,time:g.traffic.time,x:P.x,y:P.y,z:P.z,heading:P.heading,speed:P.speed,surfY:P.surfY,edgeId:P.supportEdge?.id,sourceId:P.supportEdge?.access?.sourceId,input:{throttle:g.input.throttle,steer:g.input.steer,brake:g.input.brake},station:near.station,pathLength:length,inside:g.world.district.inside(P.x,P.z),touching:P.touching,contactCount:P.debug.count,lastCollider:last?JSON.parse(JSON.stringify(last)):null});
  if(g.state!=='drive'){stopped='native-mode-change';break;}if(Math.hypot(P.x-x,P.z-z)>2){stopped='native-discontinuous-displacement';break;}
  if(P.debug.count>initialCount&&P.touching&&Math.abs(P.speed)<.2&&last&&last.type!=='vehicle'){stopped='actual-native-fixed-contact';break;}if(near.station>length-1){stopped='literal-path-end-reached';break;}
 }}finally{set([]);for(const c of codes)emit(c,false);g.drawFrame=draw;}
 const result={source:sourceCommit,scope:'Native DOM keyboard forward journey on literal exported source chain; no teleport/reset/pose/nav/source change. intermediate draws suppressed.',dt,frames:tick,stopped,records,events};(window.__nativeForwardJourney||=[]).push(result);return{frames:tick,stopped,first:records[0],last:records.at(-1),records:records.length};
};
