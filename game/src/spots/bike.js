// ============================================================================
//  Rentable bikes in a spot (owner note 31: Herăstrău / King Michael I Park — bike rental next to the spawn,
//  ride the park paths). A docking station with bikes; E rents one: the walker is parked and the camera rides a
//  city bike (W/S or ↑/↓ pedal / brake, A/D steer, Shift faster, mouse looks around); E again (anywhere walkable)
//  gets off and the bike is docked back at the station. Collides with the scene, never rides into water.
//
//  Scene use:   import { addBikeRental } from '../bike.js';
//               addBikeRental(ctx, { x, z, heading, n: 6, name: 'I\'Velo', colour: '#d7262e' });
//  (x, z, heading: the station, heading = the way the docked bikes face, radians like headingFromBearing)
//  Returns { station, rides: () => number, riding: (s) => boolean }. The session's `riding` flag is true while on a bike.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch } from './kit.js';
import { collide } from './walker.js';

/** a city bike (frame, wheels, saddle, basket) in local coordinates: forward = −z, on the ground at y = 0 */
function bikeBatch(b, x, y, z, ry, colour) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    for (const wz of [-0.52, 0.52]) { // wheels: a thin torus-like ring of rods + hub
        const n = 14; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; b.rod(P(0, 0.34 + Math.cos(a0) * 0.33, wz + Math.sin(a0) * 0.33), P(0, 0.34 + Math.cos(a1) * 0.33, wz + Math.sin(a1) * 0.33), 0.022, '#1b1b1b', 'rubber', 5); }
        b.rod(P(0, 0.34, wz - 0.3), P(0, 0.34, wz + 0.3), 0.006, '#9a9a9a', 'steel', 4); b.rod(P(0, 0.04, wz), P(0, 0.64, wz), 0.006, '#9a9a9a', 'steel', 4);
    }
    const seat = P(0, 0.88, 0.2), head = P(0, 0.95, -0.4), bb = P(0, 0.32, 0.02);
    b.rod(P(0, 0.34, 0.52), seat, 0.022, colour, 'paint', 6); b.rod(seat, bb, 0.026, colour, 'paint', 6); b.rod(bb, head, 0.028, colour, 'paint', 6);
    b.rod(head, P(0, 0.34, -0.52), 0.022, colour, 'paint', 6); b.rod(P(0, 0.34, 0.52), bb, 0.02, colour, 'paint', 6);
    b.rod(head, P(0, 1.08, -0.42), 0.02, '#2a2a2a', 'metal', 6); b.rod(P(-0.27, 1.08, -0.4), P(0.27, 1.08, -0.4), 0.016, '#2a2a2a', 'metal', 6);
    b.boxC(...P(0, 0.93, 0.22), 0.14, 0.05, 0.26, '#1d1d1d', 'rubber', ry); b.boxC(...P(0, 0.88, -0.66), 0.32, 0.2, 0.24, '#2b2b2b', 'metal', ry); // saddle, basket
    b.boxC(...P(0, 0.62, 0.62), 0.12, 0.03, 0.34, colour, 'paint', ry); // rear mudguard plate (the rental colour)
}

export function addBikeRental(ctx, { x, z, heading = 0, n = 6, name = 'Bike rental', colour = '#d7262e', speed = 5.5, fast = 8 } = {}) {
    const g = ctx.ground, y0 = g.heightAt(x, z), fx = -Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
    // ---- docking station: a row of stands + a pay terminal with the operator's colour
    const b = new GeoBatch();
    const slots = [];
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.8, sx = x + rx * o, sz = z + rz * o; slots.push({ x: sx, z: sz }); b.box(sx - fx * 0.75, y0, sz - fz * 0.75, 0.1, 0.8, 0.1, '#5b6066', 'metal', heading); bikeBatch(b, sx, y0, sz, heading, colour); }
    const tx = x + rx * ((n + 1) / 2 * 0.8), tz = z + rz * ((n + 1) / 2 * 0.8);
    b.box(tx, y0, tz, 0.45, 1.7, 0.3, '#30353a', 'metal', heading); b.boxC(tx - fx * 0.16, y0 + 1.45, tz - fz * 0.16, 0.42, 0.42, 0.02, colour, 'paint', heading);
    const dock = b.build('bike-dock'); ctx.add(dock);
    ctx.box(x, z, (n * 0.8) / 2 + 0.2, 0.9, heading, { prop: true, h: 1.1, y: y0 }); ctx.circle(tx, tz, 0.3, 1.7);
    ctx.lampPoints?.push?.({ x: tx, z: tz, noPost: true, h: 2 });
    // ---- the ridden bike (one mesh, shown while riding)
    const rb = new GeoBatch(); bikeBatch(rb, 0, 0, 0, 0, colour); const ride = rb.build('bike-ridden'); ride.visible = false; ctx.add(ride);
    let st = null, rides = 0;
    const stationIt = { kind: 'bike', x: x + fx * 1.4, z: z + fz * 1.4, r: 2.4, label: (s) => (st ? 'Return the bike' : `Rent a bike — ${name}`), use: (s) => (st ? stop(s) : start(s)) };
    ctx.interactables.push(stationIt);
    const start = (s) => {
        const p = s.ctl.position;
        st = { x: x + fx * 2.2, z: z + fz * 2.2, y: g.groundAt(x + fx * 2.2, z + fz * 2.2, p.y), yaw: heading, v: 0, look: 0, pitch: -0.12, lean: 0, back: { x: p.x, z: p.z, heading: s.ctl.heading } };
        s.ctl.active = false; s.riding = true; ride.visible = true; rides++;
        s.ui?.toast?.('🚲 ' + name, 'W / ↑ pedal · S brake · A / D steer · Shift faster · E get off');
        try { window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot: s.spot.id, id: 'bike' } })); } catch { /* no host */ }
    };
    const stop = (s, here = false) => {
        if (!st) return; ride.visible = false; s.riding = false;
        const ex = here ? st.x + Math.cos(st.yaw) * 0.9 : st.back.x, ez = here ? st.z - Math.sin(st.yaw) * 0.9 : st.back.z;
        s.ctl.active = true; s.ctl.teleport(ex, ez, here ? st.yaw : st.back.heading); st = null;
    };
    ctx.onUpdate((dt, s) => {
        if (!st) return;
        const inp = s.input || {}, keys = inp.keys || new Set();
        if (inp.take?.('KeyE')) { // get off: at the station → docked, elsewhere → park it there (it rolls back to the dock)
            stop(s, Math.hypot(st.x - x, st.z - z) > 4); return;
        }
        const thr = inp.throttle ?? ((keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : 0), brk = (keys.has('KeyS') || keys.has('ArrowDown') || (inp.throttle ?? 0) < 0 || inp.brake) ? 1 : 0, steer = inp.steer ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0));
        const vmax = inp.shift ? fast : speed;
        st.v += (thr > 0 ? Math.min(2.2, (vmax - st.v) * 1.2) : 0) * dt; if (brk) st.v -= 5 * dt; st.v -= st.v * 0.18 * dt; st.v = Math.max(0, Math.min(vmax, st.v));
        const turn = steer * dt * (0.9 + 1.4 / (1 + st.v)) * Math.min(1, 0.4 + st.v / 3); st.yaw -= turn; st.lean += ((-steer * Math.min(1, st.v / 4)) * 0.22 - st.lean) * Math.min(1, dt * 4);
        const dfx = -Math.sin(st.yaw), dfz = -Math.cos(st.yaw); let nx = st.x + dfx * st.v * dt, nz = st.z + dfz * st.v * dt;
        let ny = g.groundAt(nx, nz, st.y + 0.5);
        if (!(ny < st.y + 0.6) || (g.waterY != null && ny < g.waterY - 0.3)) { st.v = 0; nx = st.x; nz = st.z; ny = st.y; } // a wall / steps up / water: stop
        const hit = s.spot.colliders?.length ? collide(s.spot.colliders, nx, nz, 0.45, ny + 0.3) : null;
        if (hit) { nx += hit.px; nz += hit.pz; st.v *= 0.3; ny = g.groundAt(nx, nz, st.y + 0.5); if (!(ny < st.y + 0.6)) { nx = st.x; nz = st.z; ny = st.y; } }
        st.x = nx; st.z = nz; st.y += (ny - st.y) * Math.min(1, dt * 12);
        // the walker follows (crowd reactions, interactions, sound) without moving the camera
        const c = s.ctl; c.x = st.x; c.z = st.z; c.y = st.y; c.heading = st.yaw; if ('vel' in c) c.vel = st.v; else if (!Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), 'speed')?.get) c.speed = st.v;
        ride.position.set(st.x, st.y, st.z); ride.rotation.set(0, st.yaw, st.lean, 'YXZ');
        const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-2.2, Math.min(2.2, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-0.9, Math.min(0.7, st.pitch - lk.dy * 0.0024));
        if (Math.abs(lk.dx) < 0.01) st.look *= Math.max(0, 1 - dt * 0.6); // the view drifts back to the road
        const bob = Math.sin(s.t * 7) * 0.012 * Math.min(1, st.v / 3);
        if (c.rig) { c.rig.position.set(st.x - dfx * 0.12, st.y + 1.62 + bob, st.z - dfz * 0.12); c.rig.rotation.set(st.pitch, st.yaw + st.look, st.lean * 0.5, 'YXZ'); }
    });
    return { station: dock, rides: () => rides, riding: () => !!st, slots };
}
