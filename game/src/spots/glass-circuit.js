/** An authored walking challenge on the existing modeled Loupe ring. No player motion or floor is created. */
export function createGlassCircuit({x,z,y,radius=17.6}){
 let state='ready',progress=0,elapsed=0,last=null,offCourse=0,reason=null;
 const start={x,z:z+radius,y},target=()=>{const a=Math.PI/2+Math.min(4,Math.floor(progress/(Math.PI/2))+1)*Math.PI/2;return{x:x+Math.cos(a)*radius,z:z+Math.sin(a)*radius,y};};
 return{
  begin(p){if(state==='running'||Math.hypot(p.x-start.x,p.z-start.z)>2||Math.abs(p.y-y)>.6)return false;state='running';progress=elapsed=offCourse=0;last={...p};reason=null;return true;},
  tick(dt,p){
   if(state!=='running')return;
   if(!Number.isFinite(dt)||dt<=0||dt>.101||![p.x,p.y,p.z].every(Number.isFinite))throw new Error('A bounded physical walking step is required');
   const moved=Math.hypot(p.x-last.x,p.z-last.z),r=Math.hypot(p.x-x,p.z-z);
   if(Math.abs(p.y-y)>.6||moved>6*dt+.16){state='failed';reason='The glass-floor route was interrupted';return;}
   elapsed+=dt;if(Math.abs(r-radius)>1.4){offCourse+=dt;if(offCourse>1.5){state='failed';reason='Return to the marked glass-floor path';}last={...p};return;}
   offCourse=0;const a=Math.atan2(p.z-z,p.x-x),b=Math.atan2(last.z-z,last.x-x),delta=Math.atan2(Math.sin(a-b),Math.cos(a-b));
   progress=Math.max(0,Math.min(Math.PI*2,progress+delta));last={...p};
   if(progress>=Math.PI*2-.03&&Math.hypot(p.x-start.x,p.z-start.z)<1){progress=Math.PI*2;state='complete';return;}
   if(elapsed>180){state='failed';reason='Take a rest and start another circuit';}
  },
  cancel(){if(state==='running')state='cancelled';},
  snapshot(){return{state,progress:progress/(Math.PI*2),elapsed,checkpoints:Math.min(4,Math.floor(progress/(Math.PI/2))),target:target(),reason};}
 };
}
