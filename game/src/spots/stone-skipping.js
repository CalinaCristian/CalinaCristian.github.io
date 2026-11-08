import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

// Temporary game props on an existing shore. Release timing controls the number
// of visible skips; a toast alone never counts as participation.
export function stoneSkipping(ctx, { from, target, waterY, onDone }) {
    const flow=activityFlow(ctx),stone=new THREE.Mesh(new THREE.SphereGeometry(.11,8,5),new THREE.MeshStandardMaterial({color:'#d0c7b9',roughness:.9}));
    stone.name='skipping-stone';stone.scale.y=.3;stone.visible=false;stone.userData.noFloor=true;ctx.add(stone);
    const rippleMaterial=new THREE.MeshBasicMaterial({color:'#dce8df',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}),ripples=[];
    for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.15,.21,20),rippleMaterial.clone());m.rotation.x=-Math.PI/2;m.visible=false;m.userData.noFloor=true;ctx.add(m);ripples.push(m);}
    let debug=null;const hide=()=>{stone.visible=false;ripples.forEach(m=>m.visible=false);debug=null;};
    return {debug:()=>debug,start:s=>flow.begin(s,{
        title:'Stone skipping practice',action:'Release the stone',focus:target,
        help:'This is virtual shore practice. Release near the middle of the moving gauge for a flatter throw and more skips. Watch three complete throws; Leave or Esc cancels.',
        started(s,r){r.throws=0;r.skips=0;r.aimT=0;r.phase='ready';stone.visible=true;},
        actioned(s,r){r.phase='flight';r.t=0;r.busy=true;r.from=stone.position.clone();r.count=1+Math.round((1-Math.abs(Math.sin(r.aimT*2.2)))*3);r.hit=-1;r.status.textContent=`Throw ${r.throws+1}: watch the stone`;},
        update(dt,s,r){
            if(r.phase==='ready'){r.aimT+=dt;stone.position.copy(s.camera.localToWorld(new THREE.Vector3(.22,-.3,-.65)));stone.rotation.set(0,r.aimT,0);r.progress.value=(Math.sin(r.aimT*2.2)+1)/2;r.status.textContent=`${r.throws} / 3 throws · ${r.skips} skips · release near the gauge centre`;debug={phase:'ready',throws:r.throws,skips:r.skips,stone:stone.position.toArray()};return;}
            r.t+=dt;const first=.65,hop=.42,total=first+Math.max(0,r.count-1)*hop,t=Math.min(r.t,total),dx=target.x-from.x,dz=target.z-from.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
            let hit=-1;if(t<first){const q=t/first;stone.position.lerpVectors(r.from,target,q);stone.position.y+=Math.sin(q*Math.PI)*.7;}
            else {const stage=Math.min(r.count-2,Math.floor((t-first)/hop)),q=(t-first)/hop-stage,base=new THREE.Vector3(target.x+ux*stage*3,waterY+.03,target.z+uz*stage*3),end=new THREE.Vector3(base.x+ux*3,waterY+.03,base.z+uz*3);stone.position.lerpVectors(base,end,q);stone.position.y+=Math.sin(q*Math.PI)*Math.max(.08,.35-stage*.08);hit=Math.min(r.count-1,Math.floor((t-first)/hop));}
            stone.rotation.z+=dt*13;
            if(hit>r.hit){r.hit=hit;s.sound?.play?.('splat',.2);const m=ripples[Math.max(0,hit)];m.position.set(target.x+ux*Math.max(0,hit)*3,waterY+.035,target.z+uz*Math.max(0,hit)*3);m.scale.setScalar(.6);m.material.opacity=.75;m.visible=true;}
            ripples.forEach(m=>{if(m.visible){m.scale.multiplyScalar(1+dt*2);m.material.opacity=Math.max(0,m.material.opacity-dt*.7);if(m.material.opacity===0)m.visible=false;}});
            debug={phase:'flight',throws:r.throws,skips:r.skips,throwSkips:r.count,stone:stone.position.toArray(),ripples:ripples.filter(m=>m.visible).length};
            if(r.t>=total){r.throws++;r.skips+=r.count;if(r.throws>=3){flow.complete();return;}r.phase='ready';r.busy=false;r.aimT=0;}
        },cancel:hide,complete(s){hide();onDone?.(s);},
    })};
}
