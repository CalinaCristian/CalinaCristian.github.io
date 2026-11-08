import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

// The caller supplies an existing candle rack, including its surface height.
// Lighting and placing are separate actions; only the placed candle completes.
export function candleLight(ctx, target, { title, onDone }) {
    const flow = activityFlow(ctx), candle = new THREE.Group(); candle.name = 'visitor-candle'; candle.userData.noFloor = true; candle.visible = false;
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(.018, .019, .22, 8), new THREE.MeshStandardMaterial({ color: '#e8c37a', roughness: .85 })); wax.position.y = .11;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .018, 4), new THREE.MeshBasicMaterial({ color: '#322718' })); wick.position.y = .226;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffca61', toneMapped: false })); flame.position.y = .25; flame.scale.set(.015,.035,.015); flame.visible = false;
    candle.add(wax, wick, flame); ctx.add(candle); let placed = false;
    ctx.onUpdate((dt,s) => { if (placed) flame.scale.y = .033 + Math.sin(s.t * 13) * .004; });
    return {
        start(s) { return flow.begin(s, {
            title, focus: target, action: 'Light the candle', help: 'Light your candle, then place it on the rack. Leave or Esc puts an unfinished candle away.',
            started(s,r) { placed = false; candle.visible = true; candle.position.copy(s.camera.localToWorld(new THREE.Vector3(.23, -.35, -.7))); flame.visible = false; r.step = 0; r.status.textContent = 'An unlit candle'; },
            actioned(s,r) { r.busy = true; r.t = 0; if (r.step === 1) r.from = candle.position.clone(); },
            update(dt,s,r) {
                if (r.step === 0 || !r.busy) candle.position.copy(s.camera.localToWorld(new THREE.Vector3(.23, -.35, -.7)));
                if (r.busy) {
                    r.t += dt;
                    if (r.step === 0) { flame.visible = r.t > .35; if (r.t >= .8) { r.step = 1; r.busy = false; r.button.textContent = 'Place the candle'; r.status.textContent = 'Lit · place it gently on the rack'; r.progress.value = .5; } }
                    else { const t = Math.min(1,r.t / 1.3); candle.position.lerpVectors(r.from,target,t); candle.position.y += Math.sin(t * Math.PI) * .15; r.progress.value = .5 + t * .5; if (t === 1) flow.complete(); }
                }
                flame.scale.y = .033 + Math.sin(s.t * 13) * .004;
            },
            cancel() { candle.visible = false; flame.visible = false; },
            complete(s) { placed = true; candle.position.copy(target); flame.visible = true; s.sound.play('chime', .3); onDone(s); },
        }); },
        get placed() { return placed; },
    };
}
