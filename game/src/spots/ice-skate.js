// ============================================================================
//  Public skating on a seasonal ice rink: W pushes a stride (hold it to keep striding, Shift for longer strides),
//  A / D lean into a turn, S digs the edges in to stop, the mouse looks around. You glide — speed carries you, and
//  the boards bounce you back; hit them too fast and you fall. Skate `laps` laps with the flow (anticlockwise, as
//  public sessions run) to complete it. E / Leave / Esc step off the ice anytime.
//
//  iceSkate(ctx, { poly, y, gate: { x, z }, laps: 3, onDone }) → { start(s), active(), debug() }
//    (poly: the rink outline; y: the ice top; gate: where you stand when you step off)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { inPoly } from './kit.js';

const TAU = Math.PI * 2;

export function iceSkate(ctx, { poly, y, gate, laps = 3, onDone = null }) {
    const flow = activityFlow(ctx);
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const inner = poly.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); return [x - dx / d * 1.1, z - dz / d * 1.1]; }); // a metre in from the boards
    const edgeNormal = (x, z) => { let best = null; for (let i = 0; i < inner.length; i++) { const [ax, az] = inner[i], [bx, bz] = inner[(i + 1) % inner.length], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez), t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (L * L))), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz); if (!best || d < best.d) { let nx = -ez / L, nz = ex / L; if ((cx - px) * nx + (cz - pz) * nz < 0) { nx = -nx; nz = -nz; } best = { d, nx, nz }; } } return best; };
    const apothem = Math.min(...inner.map(([ax, az], i) => { const [bx, bz] = inner[(i + 1) % inner.length], L = Math.hypot(bx - ax, bz - az); return Math.abs((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / L; })); // centre → nearest board
    const minR = apothem * 0.35; // laps count only away from the middle (no spinning on the spot)
    let st = null;
    const stop = (s) => { if (!st) return; st = null; const c = s.ctl; c.x = gate.x; c.z = gate.z; c.y = ctx.ground.heightAt(gate.x, gate.z); c.heading = Math.atan2(-(cx - gate.x), -(cz - gate.z)) + Math.PI; c.pitch = 0; c.vx = c.vz = 0; c.vel = 0; c.active = true; c.place?.(); };
    const start = (s) => flow.begin(s, {
        title: 'Public skate at the rink', action: 'Step off the ice (E)', cameraRide: true, ride: true,
        help: `Hold W to stride (Shift: longer strides), A / D to turn, S to stop. You glide — mind the boards. Skate ${laps} laps anticlockwise, with the flow. E, Leave or Esc to step off.`,
        started(s, r) {
            const gx = gate.x - cx, gz = gate.z - cz, gl = Math.hypot(gx, gz) || 1, sx = cx + gx / gl * minR * 1.6, sz = cz + gz / gl * minR * 1.6;
            const a = Math.atan2(sz - cz, sx - cx); // facing along the anticlockwise flow: tangent (sin a, −cos a)
            st = { x: sx, z: sz, vx: 0, vz: 0, yaw: Math.atan2(-Math.sin(a), Math.cos(a)), look: 0, pitch: -0.1, stride: 0, strides: 0, leg: 1, acc: 0, lastA: a, falls: 0, down: 0, t: 0, lean: 0, wrongT: 0, distance: 0 };
            r.progress.max = laps; r.progress.value = 0;
        },
        actioned() { flow.cancel('step-off'); },
        cancel(s) { stop(s); },
        complete(s) { const stats = { secs: st?.t, falls: st?.falls, strides: st?.strides }; stop(s); onDone?.(s, stats); },
        update(dt, s, r) {
            if (!st) return; st.t += dt;
            const inp = s.input || {}, keys = inp.keys || new Set();
            const fwd = (keys.has('KeyW') || keys.has('ArrowUp') || (inp.throttle ?? 0) > 0.2) ? 1 : 0, brake = (keys.has('KeyS') || keys.has('ArrowDown') || (inp.throttle ?? 0) < -0.2) ? 1 : 0;
            const steer = inp.steer ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)), hard = !!inp.shift;
            const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
            let sp = Math.hypot(st.vx, st.vz);
            if (st.down > 0) { st.down -= dt; st.vx *= 1 - Math.min(1, dt * 3); st.vz *= 1 - Math.min(1, dt * 3); if (st.down <= 0) r.status.textContent = 'Back on your skates.'; }
            else {
                if (fwd) { st.stride += dt / (hard ? 0.75 : 0.6); if (st.stride >= 1) { st.stride -= 1; st.strides++; st.leg = -st.leg; const vmax = hard ? 7 : 5.2; if (sp < vmax) { const k = Math.min(hard ? 1.1 : 0.8, vmax - sp); st.vx += fx * k; st.vz += fz * k; } } }
                else st.stride = 0;
                if (brake) { const k = Math.max(0, 1 - dt * 2.6); st.vx *= k; st.vz *= k; }
                st.yaw -= steer * dt * (1.1 + 0.9 / (1 + sp));
                // the blades carve: velocity swings towards where the skates point (a little sideways slip remains)
                sp = Math.hypot(st.vx, st.vz);
                if (sp > 0.05) { const want = Math.max(0, st.vx * fx + st.vz * fz) || sp * 0.6, k = Math.min(1, dt * 2.4); st.vx += (fx * want - st.vx) * k; st.vz += (fz * want - st.vz) * k; }
                const fr = Math.max(0, 1 - dt * 0.1); st.vx *= fr; st.vz *= fr;
            }
            let nx = st.x + st.vx * dt, nz = st.z + st.vz * dt;
            if (!inPoly(nx, nz, inner)) { // the boards: bounce back, fall when the hit is hard
                const n = edgeNormal(nx, nz), vn = st.vx * n.nx + st.vz * n.nz;
                if (vn < 0) { st.vx -= 1.45 * vn * n.nx; st.vz -= 1.45 * vn * n.nz; }
                if (-vn > 3.4 && st.down <= 0) { st.down = 1.6; st.falls++; s.sound?.play?.('thump', 0.6); s.ui.toast('⛸️ Oof!', 'Into the boards. Up you get — ease off before the wall.'); }
                nx = st.x; nz = st.z;
            }
            st.distance += Math.hypot(nx - st.x, nz - st.z); st.x = nx; st.z = nz;
            // laps: angle swept round the rink centre, anticlockwise on the map (x east, z south) counts up
            const a = Math.atan2(st.z - cz, st.x - cx); let da = a - st.lastA; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; st.lastA = a;
            if (Math.hypot(st.x - cx, st.z - cz) > minR) st.acc -= da;
            const done = Math.max(0, Math.floor(st.acc / TAU)); r.progress.value = Math.min(laps, Math.max(0, st.acc / TAU));
            if (st.acc < -0.6) st.wrongT += dt; else st.wrongT = 0;
            if (st.down <= 0) r.status.textContent = st.wrongT > 0 ? 'Wrong way! Public skate runs anticlockwise — turn round.' : `Lap ${Math.min(laps, done + 1)} of ${laps} · ${(Math.hypot(st.vx, st.vz) * 3.6).toFixed(0)} km/h${st.falls ? ` · falls ${st.falls}` : ''}`;
            if (done >= laps) { flow.complete(); return; }
            // ---- camera on the skater
            sp = Math.hypot(st.vx, st.vz); st.lean += ((-steer * Math.min(1, sp / 4)) * 0.16 - st.lean) * Math.min(1, dt * 4);
            const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-2.2, Math.min(2.2, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-1, Math.min(0.8, st.pitch - lk.dy * 0.0024));
            const eye = st.down > 0 ? 0.55 : 1.7 + Math.sin(st.stride * Math.PI) * 0.03 * fwd, c = s.ctl;
            c.x = st.x; c.z = st.z; c.y = y; c.heading = st.yaw + st.look; if ('vel' in c) c.vel = sp;
            if (c.rig) { c.rig.position.set(st.x + Math.cos(st.yaw) * st.leg * 0.04 * fwd, y + eye, st.z - Math.sin(st.yaw) * st.leg * 0.04 * fwd); c.rig.rotation.set(st.pitch + (st.down > 0 ? 0.3 : 0), st.yaw + st.look, st.lean + (st.down > 0 ? 0.4 : 0), 'YXZ'); }
        },
    });
    return { start, active: () => !!st, debug: () => st && { x: st.x, z: st.z, v: Math.hypot(st.vx, st.vz), laps: st.acc / TAU, falls: st.falls, yaw: st.yaw }, centre: { x: cx, z: cz }, inner, minR, apothem };
}
void THREE;
