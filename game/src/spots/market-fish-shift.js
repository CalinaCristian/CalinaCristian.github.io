const copy=p=>({x:p.x,y:p.y,z:p.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function fishFlightPoint(from,to,t,arc=1.7){
 const k=Math.max(0,Math.min(1,t));
 return{x:from.x+(to.x-from.x)*k,y:from.y+(to.y-from.y)*k+Math.sin(Math.PI*k)*arc-Math.max(0,t-1)*3,z:from.z+(to.z-from.z)*k};
}
/** Three real catches AND returns. Targets freeze at release; misses cannot home in on the player. */
export function createMarketFishShift({throws=3}={}){
 if(!Number.isSafeInteger(throws)||throws<1)throw new RangeError('A positive shift length is required');
 let phase='idle',delivered=0,elapsed=0,from=null,to=null,point=null,duration=1.5;
 const startFlight=(next,a,b,seconds)=>{phase=next;elapsed=0;from=copy(a);to=copy(b);point=copy(a);duration=seconds;};
 return{
  get phase(){return phase;},get delivered(){return delivered;},get total(){return throws;},
  get point(){return point&&copy(point);},get progress(){return phase==='incoming'||phase==='returning'?Math.min(1,elapsed/duration):0;},
  begin(){if(phase!=='idle'&&phase!=='done')return false;phase='ready';delivered=0;point=null;return true;},
  request(monger,hands){if(!['ready','missed'].includes(phase))return false;startFlight('incoming',monger,hands,Math.max(.9,1.65-delivered*.16));return true;},
  catch(hands){
   if(phase!=='incoming'||elapsed/duration<.72||elapsed/duration>1.13||distance(point,hands)>.9)return false;
   phase='holding';point=copy(hands);return true;
  },
  returnTo(hands,monger){if(phase!=='holding')return false;startFlight('returning',hands,monger,1.1);return true;},
  tick(dt,hands){
   if(!Number.isFinite(dt)||dt<0)throw new RangeError('A finite positive step is required');
   if(phase==='holding'){point=copy(hands);return null;}
   if(phase!=='incoming'&&phase!=='returning')return null;
   elapsed+=dt;point=fishFlightPoint(from,to,elapsed/duration,phase==='incoming'?1.55+delivered*.2:1.2);
   if(phase==='incoming'&&elapsed/duration>1.13){phase='missed';point=null;return'missed';}
   if(phase==='returning'&&elapsed>=duration){delivered++;phase=delivered===throws?'done':'ready';point=null;return phase==='done'?'complete':'delivered';}
   return null;
  },
  cancel(){phase='idle';point=null;delivered=0;elapsed=0;},
  debug(){return{phase,delivered,total:throws,elapsed,duration,from:from&&copy(from),to:to&&copy(to),point:point&&copy(point)};}
 };
}
