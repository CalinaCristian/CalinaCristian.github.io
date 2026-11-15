// ============================================================================
//  Pioneer Square: a game of ping pong in Occidental Square (owner, 2026-11-15: real activities; the Underground Tour is
//  a guided walk). Seattle Parks lists "bocce courts and ping pong tables" in Occidental Square, open 6 am – 10 pm, with
//  park concierges who hand out games (seattle.gov/parks/allparks/occidental-square); OSM maps the table as node
//  14005376908 (leisure=pitch, sport=table_tennis); the scene already draws the concrete table there (pioneer-square-fronts.js,
//  its east–west orientation an estimate). You play from its west end, looking into the square.
//
//  A first-to-five game against a regular from the square (the engine is spots/table-tennis.js): A / D slide you along
//  your end, the mouse aims the return across his half, E swings as the ball reaches you (and serves on your serves).
//  Leave or Esc stops anytime; the regular goes back to what he was doing.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { activityFlow } from '../participation.js';
import { timedActivity } from '../park-hours.js';
import { createRally, TT } from '../table-tennis.js';
import { seaActivity } from './sea-common.js';

export const OCCIDENTAL_HOURS = { open: 6, close: 22, note: 'Occidental Square is open 6 am – 10 pm (Seattle Parks).' };
const NODE = [47.6002742, -122.3334565]; // OSM n14005376908

export function pioneerPingPong(ctx) {
    const g = ctx.ground, flow = activityFlow(ctx), T = ctx.ll(...NODE), gy = g.heightAt(T.x, T.z), top = gy + 0.76;
    // the table itself is drawn by pioneer-square-fronts.js (occidentalSquareProps: long side east–west, top 0.76 m)
    const A = { x: 1, z: 0 }, V = { x: 0, z: 1 }; // u (along the table, your end at u < 0: the west end) runs east; v (across) south
    const W = (u, v, y = 0) => new THREE.Vector3(T.x + A.x * u + V.x * v, top + y, T.z + A.z * u + V.z * v);
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    // ---- ball, your paddle (in hand), his paddle
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff9a3c', roughness: 0.5, emissive: '#3a1a00' }));
    ball.name = 'ping-pong-ball'; ball.visible = false; ball.userData.noFloor = true; ball.userData.noAudit = true; ctx.add(ball);
    const paddle = (col) => { const p = new THREE.Group(); const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 18), M(col, { roughness: 0.6 })); blade.rotation.x = Math.PI / 2; blade.position.y = 0.1; const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.022), M('#b8915c')); p.add(blade, grip); p.visible = false; p.userData.noFloor = true; p.userData.noAudit = true; return p; };
    const myPaddle = paddle('#b5262b'), hisPaddle = paddle('#202426'); hisPaddle.name = 'ping-pong-his-paddle'; ctx.add(hisPaddle);
    const parking = new THREE.Group(); parking.visible = false; ctx.add(parking); parking.add(myPaddle);
    // ---- the regular: someone free from the crowd, walked to the far end (as the lawn frisbee does)
    const recruit = (s) => {
        const far = W(TT.half + 0.6, 0); let best = null, bd = 1e9;
        for (const p of s.spot.crowd?.peds || []) { if (p.hidden || p.driven || p === s.guide || p.act === 'guide' || p.look?.scale < 0.85) continue; const d = Math.hypot(p.x - far.x, p.z - far.z); if (d < bd) { bd = d; best = p; } }
        if (!best) return null;
        const keep = { x: best.x, z: best.z, y: best.y, yaw: best.yaw, tyaw: best.tyaw, act: best.act, speed: best.speed, sayCd: best.sayCd, pose: best.pose };
        best.driven = true; best.act = 'stand'; best.speed = 0; best.sayCd = 1e9; if (bd > 40) { best.x = far.x + 4; best.z = far.z - 4; best.y = gy; }
        return { p: best, keep };
    };
    const release = (P) => { if (!P) return; Object.assign(P.p, P.keep); P.p.driven = false; P.p.pose = P.keep.pose || null; };
    const stand = W(-TT.half - 0.75, 0);
    let st = null, last = null;
    const say = (r, text) => { const sn = st.game.snapshot(); r.status.textContent = `${text}  ·  you ${sn.me} – ${sn.opp} him (first to ${TT.toWin})`; r.progress.value = sn.me / TT.toWin; };
    const WHY = { early: 'Too early — wait for the ball to come to you.', late: 'Too late — it got past you.', reach: 'Out of reach — slide over with A / D.', missed: 'You didn\'t swing (E).', out: 'Your return went off the table.', winner: 'A winner! He couldn\'t reach it.', error: 'He netted it.' };
    const stop = (s) => { if (!st) return; release(st.P); st = null; ball.visible = false; myPaddle.visible = false; hisPaddle.visible = false; parking.add(myPaddle);
        const c = s.ctl; c.x = stand.x; c.z = stand.z; c.y = gy; c.heading = Math.atan2(-A.x, -A.z); c.pitch = 0; c.vx = c.vz = 0; c.place?.(); };
    const start = (s) => flow.begin(s, {
        title: '🏓 Ping pong · Occidental Square', action: 'Swing (E)', cameraRide: true,
        help: 'A regular from the square plays you, first to five. A / D slide along your end, the mouse aims your return across his half, E swings as the ball reaches you (and serves on your serves). Serve changes every two points. Leave or Esc stops.',
        started(s2, r) {
            const P = recruit(s2);
            st = { P, game: createRally(), look: 0, pitch: -0.32, swingT: 0, joinT: 0, joined: !P };
            r.progress.max = 1; s2.camera.add(myPaddle); myPaddle.visible = true; myPaddle.position.set(0.24, -0.32, -0.5); hisPaddle.visible = true; ball.visible = true;
            say(r, P ? 'A regular picks up a paddle and walks over.' : 'Nobody is free right now.');
        },
        actioned(s2, r) {
            if (!st || !st.joined) return;
            const sn = st.game.snapshot();
            if (sn.state === 'won' || sn.state === 'lost') { st.game = createRally(); say(r, 'New game. He serves.'); r.button.textContent = 'Swing (E)'; return; }
            const res = st.game.swing(Math.max(-1, Math.min(1, -st.look / 0.3)));
            if (res) { st.swingT = 0.25; s2.sound?.play?.(res === 'hit' || res === 'serve' ? 'catch' : 'whoosh', 0.25); }
            if (res === 'hit') say(r, 'Good return!'); else if (res === 'serve') say(r, 'Your serve is in play.'); else if (res) say(r, WHY[res]);
        },
        update(dt, s2, r) {
            if (!st) return;
            const P = st.P;
            if (!P) { flow.cancel('nobody'); s2.ui.toast('🏓 Ping pong', 'Nobody in the square is free to play right now.'); return; }
            const inp = s2.input || {}, keys = inp.keys || new Set();
            const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
            const far = W(TT.half + 0.6, st.game.snapshot().ov);
            if (!st.joined) { // the regular walks over (or appears after 8 s)
                st.joinT += dt; const dx = far.x - P.p.x, dz = far.z - P.p.z, d = Math.hypot(dx, dz);
                if (d < 0.3 || st.joinT > 8) { P.p.x = far.x; P.p.z = far.z; P.p.y = gy; P.p.speed = 0; st.joined = true; say(r, 'He serves first.'); }
                else { const k = Math.min(1, 3 * dt / d); P.p.x += dx * k; P.p.z += dz * k; P.p.y = g.heightAt(P.p.x, P.p.z); P.p.speed = 3; P.p.phase = (P.p.phase || 0) + dt * 9; P.p.yaw = P.p.tyaw = Math.atan2(dx, dz); }
            } else {
                const ev = st.game.tick(dt, side), sn = st.game.snapshot();
                P.p.x = far.x; P.p.z = far.z; P.p.y = gy; P.p.speed = 0; P.p.yaw = P.p.tyaw = Math.atan2(-A.x, -A.z); P.p.pose = sn.state === 'out' && sn.flight && sn.flight.T - sn.time < 0.25 ? 'point' : null;
                if (ev === 'oppServe') say(r, 'His serve…'); else if (ev === 'oppHit') say(r, 'He gets it back!');
                else if (ev && WHY[sn.last?.why] && ['missed', 'winner', 'oppError', 'myOut'].includes(ev)) say(r, WHY[sn.last.why]);
                else if (ev === 'next') say(r, sn.state === 'serve' ? 'Your serve: aim with the mouse, E serves.' : 'His serve.');
                else if (ev === 'won') { flow.complete(); return; }
                else if (ev === 'lost') { r.button.textContent = 'Play again (E)'; say(r, 'He wins this one. E plays again, Leave stops.'); }
                if (sn.state === 'in' && sn.inWindow && Math.abs(sn.pv - sn.flight.vEnd) <= TT.reach) r.status.dataset.now = '1'; else delete r.status.dataset.now;
                // the ball: in flight, in your hand to serve, or his
                const b = st.game.ball();
                if (b) ball.position.copy(W(b.u, b.v, b.y + 0.02)); else if (sn.state === 'serve') ball.position.copy(s2.camera.localToWorld(new THREE.Vector3(-0.2, -0.25, -0.55))); else ball.position.copy(W(TT.half + 0.35, sn.ov - 0.25, 0.25));
                hisPaddle.position.copy(W(TT.half + 0.42, sn.ov - 0.3, 0.2)); hisPaddle.rotation.set(0, Math.atan2(A.x, A.z), 0.4);
            }
            // the camera: behind your end, slid along it; the mouse looks (and aims)
            const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-0.9, Math.min(0.9, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-0.9, Math.min(0.5, st.pitch - lk.dy * 0.0024));
            const pv = st.game.snapshot().pv, eye = W(-TT.half - 0.55, pv, 0.78), c = s2.ctl, yaw = Math.atan2(-A.x, -A.z) + st.look;
            c.x = eye.x; c.z = eye.z; c.y = gy; c.heading = yaw; c.pitch = st.pitch;
            if (c.rig) { c.rig.position.copy(eye); c.rig.rotation.set(st.pitch, yaw, 0, 'YXZ'); }
            st.swingT = Math.max(0, st.swingT - dt); const sw = st.swingT / 0.25; myPaddle.position.set(0.24 - Math.sin(sw * Math.PI) * 0.2, -0.32 + sw * 0.06, -0.5 - Math.sin(sw * Math.PI) * 0.15); myPaddle.rotation.set(0.3, 0, -0.6 + sw * 1.1);
            last = st.joined ? st.game.snapshot() : { state: 'joining' };
        },
        cancel(s2) { stop(s2); },
        complete(s2) { const sn = st?.game.snapshot(); stop(s2); seaActivity(s2, 'ping-pong', 'pioneer-square', '🏓 Game, Occidental Square', `You beat a regular ${sn?.me}–${sn?.opp} at the square's ping pong table${sn?.best > 3 ? ` (longest rally: ${sn.best} returns)` : ''}.`); },
    });
    timedActivity(ctx, OCCIDENTAL_HOURS, { kind: 'ping-pong', x: stand.x, z: stand.z, r: 2, title: '🏓 Ping pong table', label: 'Play ping pong in Occidental Square', source: 'n14005376908', cond: () => !st, start });
    const api = { start, active: () => !!st, debug: () => st && last, table: { x: T.x, z: T.z, top }, W };
    ctx.extras.pioneerPingPong = api;
    return api;
}
