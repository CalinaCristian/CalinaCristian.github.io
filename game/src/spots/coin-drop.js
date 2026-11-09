import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

// A visible coin travels into an existing, sourced slot. The destination is
// scene-owned; this helper never invents a vendor, box, fee or payment service.
export function coinDrop(ctx, target, { title, onDone, action='Drop the coin', help='Drop the coin into the slot. You can look around; Leave or Esc puts it away.', arc=.25, water=false }) {
    const flow = activityFlow(ctx), coin = new THREE.Mesh(new THREE.CylinderGeometry(.027, .027, .003, 16), new THREE.MeshStandardMaterial({ color: '#d7ad55', metalness: .8, roughness: .28 }));
    coin.name = 'activity-coin'; coin.userData.noFloor = true; coin.visible = false; ctx.add(coin);
    let ripple=null,fade=0;
    if(water){ripple=new THREE.Mesh(new THREE.RingGeometry(.12,.17,24),new THREE.MeshBasicMaterial({color:'#e7e7cd',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ripple.rotation.x=-Math.PI/2;ripple.position.copy(target).y+=.02;ripple.visible=false;ripple.userData.noFloor=true;ripple.name='virtual-coin-ripple';ctx.add(ripple);ctx.onUpdate(dt=>{if(!ripple.visible)return;fade+=dt;ripple.scale.setScalar(1+fade*2.8);ripple.material.opacity=Math.max(0,.7-fade*.5);if(fade>=1.4)ripple.visible=false;});}
    const end = () => { coin.visible = false; };
    return {
        start(s) { return flow.begin(s, {
            title, focus: target, action, help,
            started(s, r) { coin.visible = true; if(ripple)ripple.visible=false;coin.position.copy(s.camera.localToWorld(new THREE.Vector3(.2, -.24, -.65))); r.released = false; r.status.textContent = 'Coin ready'; },
            actioned(s, r) { r.released = true; r.busy = true; r.t = 0; r.from = coin.position.clone(); r.status.textContent = 'Dropping…'; },
            update(dt, s, r) {
                if (!r.released) { coin.position.copy(s.camera.localToWorld(new THREE.Vector3(.2, -.24, -.65))); coin.rotation.set(Math.PI / 2, 0, 0); return; }
                r.t += dt; const t = Math.min(1, r.t / 1.2);
                coin.position.lerpVectors(r.from, target, t); coin.position.y += Math.sin(t * Math.PI) * arc;
                coin.rotation.set(Math.PI / 2 + t * Math.PI * 3, 0, t * Math.PI * 2); r.progress.value = t;
                if (t === 1) flow.complete();
            },
            cancel() {end();if(ripple)ripple.visible=false;}, complete(s) { end();if(ripple){fade=0;ripple.scale.setScalar(1);ripple.material.opacity=.7;ripple.visible=true;}s.sound.play(water?'splat':'coin'); onDone(s); },
        }); },
        get visible() { return coin.visible; },
        debug(){return{visible:coin.visible,position:coin.position.toArray(),rippleVisible:!!ripple?.visible,target:target.toArray()};},
    };
}
