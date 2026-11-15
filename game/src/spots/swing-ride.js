// ============================================================================
//  A playground swing you can ride and pump: sit on a seat (E), then pump — W as you swing forward, S as you
//  swing back (pumping against the swing slows it). Get the swing up to `goal`° to complete it; E / Leave / Esc
//  hop off anytime. The seats and chains are drawn here (two seats under the scene's frame beam), so the ridden one
//  really swings; the other drifts a little in the wind.
//
//  swingRide(ctx, { x, y, z, beam: 2.4, seats: [-0.6, 0.6], along: 'x', facing: -1, goal: 50, onDone })
//    (x, y, z: the frame's centre on the ground; the beam runs along world x; facing −1 = the rider faces −z)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

const G = 9.81;

export function swingRide(ctx, { x, y, z, beam = 2.4, seat = 0.46, seats = [-0.6, 0.6], facing = -1, goal = 50, onDone = null }) {
    const flow = activityFlow(ctx), L = beam - seat, chainM = new THREE.MeshStandardMaterial({ color: '#7d8186', roughness: 0.4, metalness: 0.7 }), seatM = new THREE.MeshStandardMaterial({ color: '#222426', roughness: 0.85 });
    const pivots = seats.map((sx) => {
        const p = new THREE.Group(); p.name = 'swing-seat'; p.position.set(x + sx, y + beam, z); p.rotation.order = 'YXZ'; p.rotation.y = facing < 0 ? 0 : Math.PI;
        for (const t of [-0.22, 0.22]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 4), chainM); c.position.set(t, -L / 2, 0); p.add(c); }
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), seatM); s.position.y = -L; s.castShadow = true; p.add(s);
        p.traverse((o) => { o.userData.noFloor = true; }); ctx.add(p); return p;
    });
    let st = null, wind = 0;
    ctx.onUpdate((dt, s) => { wind += dt; pivots.forEach((p, i) => { if (st && st.i === i) return; p.rotation.x = Math.sin(wind * 1.9 + i * 2) * 0.03; }); });
    const fz = facing < 0 ? -1 : 1; // forward along z
    const stop = (s) => {
        if (!st) return; const i = st.i; st = null; pivots[i].rotation.x = 0;
        const c = s.ctl, ex = x + seats[i], ez = z + fz * 1.3; c.x = ex; c.z = ez; c.y = ctx.ground.heightAt(ex, ez); c.heading = facing < 0 ? 0 : Math.PI; c.pitch = 0; c.vx = c.vz = 0; c.vel = 0; c.active = true; c.place?.();
    };
    const start = (s) => flow.begin(s, {
        title: 'Swing at Inspiration Playground', action: 'Hop off', cameraRide: true,
        help: `Pump to swing higher: hold W while you swing forward, S while you swing back (pumping the wrong way slows you). Reach ${goal}°. E, Leave or Esc to hop off.`,
        started(s, r) {
            const p = s.ctl.position, i = seats.map((sx, k) => [k, Math.hypot(p.x - (x + sx), p.z - z)]).sort((a, b) => a[1] - b[1])[0][0];
            st = { i, th: 0, w: 0, best: 0, done: false, look: 0, pitch: -0.05, t: 0, pumps: 0 };
            r.progress.max = goal; r.progress.value = 0;
        },
        actioned() { if (st?.done) flow.complete(); else flow.cancel('hop-off'); },
        cancel(s) { stop(s); },
        complete(s) { stop(s); },
        update(dt, s, r) {
            if (!st) return;
            const inp = s.input || {}, keys = inp.keys || new Set();
            const u = ((keys.has('KeyW') || keys.has('ArrowUp') || (inp.throttle ?? 0) > 0.2) ? 1 : 0) - ((keys.has('KeyS') || keys.has('ArrowDown') || (inp.throttle ?? 0) < -0.2) ? 1 : 0);
            // pumping: along the motion adds energy, against it brakes; from rest W kicks off the ground
            const n = 4; for (let k = 0; k < n; k++) { const h = dt / n;
                let a = -(G / L) * Math.sin(st.th) - 0.07 * st.w - 0.05 * st.w * Math.abs(st.w); // (air drag grows with speed: the swing tops out near 80°)
                if (u) { if (Math.abs(st.w) < 0.05 || Math.sign(u) === Math.sign(st.w)) a += 0.3 * u; else a -= 0.18 * Math.sign(st.w); }
                st.w += a * h; st.th += st.w * h; if (Math.abs(st.th) > 1.35) { st.th = Math.sign(st.th) * 1.35; st.w *= -0.3; } }
            if (u && Math.sign(u) === Math.sign(st.w)) st.pumps += dt;
            st.t += dt;
            const deg = Math.abs(st.th) * 180 / Math.PI; st.best = Math.max(st.best, deg);
            r.progress.value = Math.min(goal, st.best);
            if (!st.done && st.best >= goal) { st.done = true; r.button.textContent = 'Hop off'; onDone?.(s, { secs: st.t }); }
            r.status.textContent = st.done ? `Sky high — ${Math.round(deg)}°. Keep swinging, or E to hop off.` : `Swing ${Math.round(deg)}° · best ${Math.round(st.best)}° / ${goal}° · ${Math.abs(st.w) < 0.05 && st.best < 3 ? 'W to kick off' : st.w > 0 ? 'swinging forward: W!' : 'swinging back: S!'}`;
            // ---- ride the seat
            const pv = pivots[st.i]; pv.rotation.x = st.th;
            const e = L - 0.82, ex = pv.position.x, ey = pv.position.y - e * Math.cos(st.th), ez = pv.position.z + fz * e * Math.sin(st.th);
            const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-1.8, Math.min(1.8, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-1, Math.min(0.9, st.pitch - lk.dy * 0.0024));
            const yaw = (facing < 0 ? 0 : Math.PI) + st.look, c = s.ctl;
            c.x = ex; c.z = ez; c.y = y; c.heading = yaw;
            if (c.rig) { c.rig.position.set(ex, ey, ez); c.rig.rotation.set(st.pitch + st.th * 0.55, yaw, 0, 'YXZ'); }
        },
    });
    return { start, active: () => !!st, debug: () => st && { th: st.th, w: st.w, best: st.best, done: st.done, seat: st.i }, seats: seats.map((sx) => ({ x: x + sx, z })) };
}
