import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

// A visible coin travels into an existing, sourced slot. The destination is
// scene-owned; this helper never invents a vendor, box, fee or payment service.
export function coinDrop(ctx, target, { title, onDone }) {
    const flow = activityFlow(ctx), coin = new THREE.Mesh(new THREE.CylinderGeometry(.027, .027, .003, 16), new THREE.MeshStandardMaterial({ color: '#d7ad55', metalness: .8, roughness: .28 }));
    coin.name = 'activity-coin'; coin.userData.noFloor = true; coin.visible = false; ctx.add(coin);
    const end = () => { coin.visible = false; };
    return {
        start(s) { return flow.begin(s, {
            title, focus: target, action: 'Drop the coin', help: 'Drop the coin into the slot. You can look around; Leave or Esc puts it away.',
            started(s, r) { coin.visible = true; coin.position.copy(s.camera.localToWorld(new THREE.Vector3(.2, -.24, -.65))); r.released = false; r.status.textContent = 'Coin ready'; },
            actioned(s, r) { r.released = true; r.busy = true; r.t = 0; r.from = coin.position.clone(); r.status.textContent = 'Dropping…'; },
            update(dt, s, r) {
                if (!r.released) { coin.position.copy(s.camera.localToWorld(new THREE.Vector3(.2, -.24, -.65))); coin.rotation.set(Math.PI / 2, 0, 0); return; }
                r.t += dt; const t = Math.min(1, r.t / 1.2);
                coin.position.lerpVectors(r.from, target, t); coin.position.y += Math.sin(t * Math.PI) * .25;
                coin.rotation.set(Math.PI / 2 + t * Math.PI * 3, 0, t * Math.PI * 2); r.progress.value = t;
                if (t === 1) flow.complete();
            },
            cancel: end, complete(s) { end(); s.sound.play('coin'); onDone(s); },
        }); },
        get visible() { return coin.visible; },
    };
}
