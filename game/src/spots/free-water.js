// ============================================================================
//  Free-steered water activities: a stand-up paddleboard (W paddle strokes, A / D turn, S back-paddle, Shift harder
//  strokes — turning hard at speed rocks the board and can tip you in) and a swim (W swim strokes, A / D turn).
//  The mouse looks around; E or Leave ends the outing anytime and puts you back at the launch. A course is a list of
//  checkpoints (buoys, a swim float you climb onto) and a finish (the launch / the beach): reach them in order to
//  complete it. The water you may use is the scene's own `allowed(x, z)` test (open water clear of piers, moored
//  boats and the swim area; or inside the swim area's buoy line). Nothing here moves the walker until the ride ends.
//
//  freeWaterRide(ctx, opts) → { start(s), active(), debug() }   (see opts below)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { collide } from './walker.js';

function boardMesh(colour) {
    const sh = new THREE.Shape(), L = 3.2, W = 0.8; // top view: square tail, rounded nose (forward = −z after rotation)
    sh.moveTo(-W * 0.4, L / 2); sh.lineTo(W * 0.4, L / 2); sh.quadraticCurveTo(W / 2, L / 2, W / 2, L * 0.3);
    sh.lineTo(W / 2, -L * 0.1); sh.quadraticCurveTo(W / 2, -L / 2, 0, -L / 2); sh.quadraticCurveTo(-W / 2, -L / 2, -W / 2, -L * 0.1); sh.lineTo(-W / 2, L * 0.3); sh.quadraticCurveTo(-W / 2, L / 2, -W * 0.4, L / 2);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 6 });
    geo.rotateX(Math.PI / 2); geo.translate(0, 0.11, 0);
    const g = new THREE.Group(); g.name = 'paddleboard';
    const board = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5 })); board.castShadow = true; g.add(board);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 1.1), new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.95 })); pad.position.set(0, 0.125, 0.35); g.add(pad);
    g.traverse((o) => { o.userData.noFloor = true; o.userData.noAudit = true; });
    return g;
}
function paddleMesh() {
    const g = new THREE.Group(); g.name = 'sup-paddle';
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.9, 6), new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.5, metalness: 0.4 })); shaft.position.y = -0.55; g.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.02), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6 })); blade.position.y = -1.45; g.add(blade);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), shaft.material); grip.position.y = 0.4; g.add(grip);
    g.traverse((o) => { o.userData.noFloor = true; o.userData.noAudit = true; o.frustumCulled = false; });
    return g;
}

/**
 * @param ctx scene context
 * @param o {
 *   kind: 'sup' | 'swim', title, help, action?, waterY,
 *   start: { x, z, heading },                    where the ride begins (on the water)
 *   exit?: { x, z, y, heading },                 where the walker stands after the ride (default: where they started it)
 *   allowed(x, z) → bool, blockedNote,           the water this ride may use
 *   checkpoints: [{ x, z, r, name, climb?: { y, secs } }], finish: { x, z, r, name }, obstacles?: [{ x, z, r }] (pushed round),
 *   onDone(s, stats), boardColour?
 * }
 */
export function freeWaterRide(ctx, o) {
    const flow = activityFlow(ctx), sup = o.kind === 'sup', Y = o.waterY;
    const board = sup ? boardMesh(o.boardColour || '#e9eef0') : null, paddle = sup ? paddleMesh() : null;
    if (board) { board.visible = false; ctx.add(board); }
    if (paddle) { paddle.visible = false; ctx.add(paddle); }
    // the next target: a floating ring that bobs round the checkpoint
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.visible = false; ring.name = 'water-course-marker'; ring.userData.noFloor = true; ring.userData.noAudit = true; ctx.add(ring);
    const splashMat = new THREE.MeshBasicMaterial({ color: '#e6efee', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }), splashes = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 20), splashMat.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.noFloor = true; m.userData.noAudit = true; ctx.add(m); splashes.push(m); }
    let splashI = 0; const splash = (x, z, k = 1) => { const m = splashes[splashI++ % splashes.length]; m.position.set(x, Y + 0.03, z); m.scale.setScalar(k); m.material.opacity = 0.75; m.visible = true; };
    ctx.onUpdate((dt) => { for (const m of splashes) if (m.visible) { m.scale.multiplyScalar(1 + dt * 1.8); m.material.opacity = Math.max(0, m.material.opacity - dt * 0.6); if (!m.material.opacity) m.visible = false; } });
    let st = null;
    const cps = [...o.checkpoints, { ...o.finish, finish: true }];
    const stop = (s) => {
        if (!st) return;
        s.riding = false; if (board) board.visible = false; if (paddle) paddle.visible = false; ring.visible = false;
        const c = s.ctl, e = o.exit || st.exit; c.x = e.x; c.z = e.z; c.y = Number.isFinite(e.y) ? e.y : s.spot.ground.heightAt(e.x, e.z); // (back where the ride began: the dock / the sand)
        c.heading = e.heading ?? st.yaw; c.pitch = 0; c.vx = c.vz = 0; c.vel = 0; c.active = true; c.place?.(); st = null;
    };
    const rel = (s, x, z) => { const dx = x - st.x, dz = z - st.z, d = Math.hypot(dx, dz), a = Math.atan2(-dx, -dz) - st.yaw, w = Math.atan2(Math.sin(a), Math.cos(a)); return `${Math.round(d)} m ${Math.abs(w) < 0.35 ? 'ahead' : Math.abs(w) > 2.6 ? 'behind you' : w > 0 ? 'to your left' : 'to your right'}`; };
    const start = (s) => flow.begin(s, {
        title: o.title, action: o.action || 'Back to shore', cameraRide: true,
        help: o.help,
        started(s, r) {
            const w0 = s.ctl.position; st = { exit: { x: w0.x, z: w0.z, y: w0.y, heading: s.ctl.heading }, x: o.start.x, z: o.start.z, yaw: o.start.heading ?? s.ctl.heading, v: 0, look: 0, pitch: sup ? -0.3 : -0.05, stroke: 0, strokes: 0, side: 1, wobble: 0, roll: 0, falls: 0, fall: 0, climb: 0, next: 0, distance: 0, blockedT: 0, t: 0 };
            s.riding = true; if (board) board.visible = true; if (paddle) paddle.visible = true; ring.visible = true;
            r.progress.max = cps.length; r.progress.value = 0;
        },
        actioned() { flow.cancel('leave'); },
        cancel(s) { stop(s); },
        complete(s) { const stats = { strokes: st?.strokes || 0, falls: st?.falls || 0, secs: st?.t || 0, distance: st?.distance || 0 }; stop(s); o.onDone?.(s, stats); },
        update(dt, s, r) {
            if (!st) return;
            st.t += dt;
            const inp = s.input || {}, keys = inp.keys || new Set();
            const fwd = (keys.has('KeyW') || keys.has('ArrowUp') || (inp.throttle ?? 0) > 0.2) ? 1 : 0, back = (keys.has('KeyS') || keys.has('ArrowDown') || (inp.throttle ?? 0) < -0.2) ? 1 : 0;
            const steer = inp.steer ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)), hard = !!inp.shift;
            const cp = cps[st.next];
            // ---- fallen in (paddleboard): a short dunk, then back on the board, stopped
            if (st.fall > 0) {
                st.fall -= dt; st.v = 0;
                if (st.fall <= 0) { st.wobble = 0; st.roll = 0; r.status.textContent = 'Back on the board — steady strokes, gentle turns.'; }
            } else if (st.climb > 0) { // ---- resting on a swim float
                st.climb -= dt; st.v = 0; r.status.textContent = `On ${cps[st.next - 1]?.name || 'the float'} — catch your breath…`;
                if (st.climb <= 0) { const prev = cps[st.next - 1], to = cps[st.next]; const a = Math.atan2(to.x - prev.x, to.z - prev.z), off = (prev.climb?.off ?? 3.4); st.x = prev.x + Math.sin(a) * off; st.z = prev.z + Math.cos(a) * off; st.yaw = Math.atan2(-(to.x - st.x), -(to.z - st.z)); splash(st.x, st.z, 1.6); s.sound?.play?.('splat', 0.4); }
            } else {
                // ---- strokes: holding W paddles / swims in a rhythm; each stroke is an impulse (Shift: harder, faster)
                const period = sup ? (hard ? 0.72 : 0.9) : (hard ? 0.8 : 1.0), vmax = sup ? (hard ? 3.0 : 2.4) : (hard ? 1.7 : 1.25);
                if (fwd || back) { st.stroke += dt / period; if (st.stroke >= 1) { st.stroke -= 1; st.strokes++; st.side = -st.side; if (fwd) st.v = Math.min(vmax, st.v + (sup ? 0.75 : 0.65)); else st.v = Math.max(-0.6, st.v - 0.5);
                    if (sup && !steer) st.yaw += st.side * 0.025; // one stroke a side: the board noses a little each way
                    const sx = st.x + Math.cos(st.yaw) * st.side * 0.55, sz = st.z - Math.sin(st.yaw) * st.side * 0.55; splash(sx, sz, sup ? 0.8 : 1.1); } }
                else st.stroke = Math.max(0, st.stroke - dt);
                st.v -= st.v * (sup ? 0.32 : 0.7) * dt; if (Math.abs(st.v) < 0.02 && !fwd && !back) st.v = 0;
                const turn = steer * dt * (sup ? 0.55 + 0.25 * Math.min(1, Math.abs(st.v)) : 0.9); st.yaw -= turn;
                if (sup) { // balance: turning hard while moving fast rocks the board; standing still it settles
                    st.wobble += (Math.abs(steer) * Math.max(0, Math.abs(st.v) - 1.5) * 0.55 + (hard && fwd ? 0.06 : 0)) * dt;
                    st.wobble = Math.max(0, st.wobble - 0.3 * dt);
                    if (st.wobble >= 1) { st.fall = 1.8; st.falls++; splash(st.x, st.z, 2.2); s.sound?.play?.('splat', 0.7); r.status.textContent = 'Splash! You fell in. Climbing back on…'; }
                }
            }
            st.roll = sup ? Math.sin(st.t * 5.5) * 0.12 * st.wobble + (st.fall > 0 ? 0.6 : 0) : Math.sin(st.t * 3.1) * 0.05;
            // ---- move on the allowed water; the shore, piers, boats and the buoy line stop you
            const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
            let nx = st.x + fx * st.v * dt, nz = st.z + fz * st.v * dt;
            if (!o.allowed(nx, nz)) { // glance off: slide along the edge when one axis is free, else bump back
                st.blockedT = 2.5;
                if (o.allowed(nx, st.z) && Math.abs(nx - st.x) > Math.abs(st.v * dt) * 0.25) { nz = st.z; st.v *= 0.92; }
                else if (o.allowed(st.x, nz) && Math.abs(nz - st.z) > Math.abs(st.v * dt) * 0.25) { nx = st.x; st.v *= 0.92; }
                else { st.v = -st.v * 0.25; nx = st.x; nz = st.z; }
            }
            for (const ob of o.obstacles || []) { const dx = nx - ob.x, dz = nz - ob.z, d = Math.hypot(dx, dz); if (d < ob.r && d > 1e-6) { nx = ob.x + dx / d * ob.r; nz = ob.z + dz / d * ob.r; st.v *= 0.85; } } // (buoys: you glance round them)
            const hit = collide(s.spot.colliders || [], nx, nz, sup ? 0.5 : 0.4, Y + 0.3);
            if (hit) { nx += hit.px; nz += hit.pz; st.v *= 0.4; if (!o.allowed(nx, nz)) { nx = st.x; nz = st.z; } }
            st.distance += Math.hypot(nx - st.x, nz - st.z); st.x = nx; st.z = nz; st.blockedT -= dt;
            // ---- course: checkpoints in order, then the finish
            if (cp && st.fall <= 0 && st.climb <= 0 && Math.hypot(st.x - cp.x, st.z - cp.z) < cp.r) {
                st.next++; r.progress.value = st.next; s.sound?.play?.('coin', 0.25);
                if (cp.finish) { flow.complete(); return; }
                if (cp.climb) { st.climb = cp.climb.secs ?? 2.5; st.x = cp.x; st.z = cp.z; st.v = 0; }
                s.ui.toast(`${sup ? '🏄 Round ' : '🏊 Made it to '}${cp.name}`, st.next < cps.length - 1 ? `Next: ${cps[st.next].name}.` : `Now back to ${o.finish.name}.`);
            }
            const tgt = cps[st.next];
            if (tgt) { ring.visible = true; ring.position.set(tgt.x, (tgt.climb ? tgt.climb.y + 0.06 : Y + 0.12) + Math.sin(st.t * 2) * 0.05, tgt.z); ring.scale.setScalar(tgt.climb ? 3.4 : Math.max(1.1, tgt.r * 0.55)); } // (round a float: on its deck edge)
            if (st.fall <= 0 && st.climb <= 0 && tgt) r.status.textContent = st.blockedT > 0 ? (o.blockedNote || 'You can\'t go that way.') : `${tgt.finish ? 'Back to ' : 'Next: '}${tgt.name} · ${rel(s, tgt.x, tgt.z)}${sup ? ` · falls ${st.falls}${st.wobble > 0.45 ? ' · wobbling — ease the turn!' : ''}` : ''}`;
            // ---- camera, board, paddle; the walker follows (sound, crowd) without moving the camera
            const onFloat = st.climb > 0 ? (cps[st.next - 1]?.climb?.y ?? Y + 0.4) - Y : 0;
            const eye = st.fall > 0 ? 0.25 : onFloat ? onFloat + 0.95 : sup ? 1.62 + 0.12 : 0.42, bob = sup ? Math.sin(st.t * 2.2) * 0.02 : Math.sin(st.t * 4.4 + st.stroke * 6) * 0.05;
            const lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-2.4, Math.min(2.4, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-1.0, Math.min(0.8, st.pitch - lk.dy * 0.0024));
            const c = s.ctl; c.x = st.x; c.z = st.z; c.y = Y; c.heading = st.yaw + st.look; if ('vel' in c) c.vel = st.v;
            if (c.rig) { c.rig.position.set(st.x, Y + eye + bob, st.z); c.rig.rotation.set(st.pitch, st.yaw + st.look, st.roll * 0.5, 'YXZ'); }
            if (board) { board.position.set(st.x, Y - 0.05 + Math.sin(st.t * 2.2) * 0.015, st.z); board.rotation.set(0, st.yaw, st.roll, 'YXZ'); }
            if (paddle) { // held in front, sweeping down one side per stroke
                const ph = (fwd || back) && st.fall <= 0 ? st.stroke : 0, sw = Math.sin(ph * Math.PI);
                paddle.visible = st.fall <= 0 && st.climb <= 0;
                paddle.position.copy(s.camera.localToWorld(new THREE.Vector3(0.28 * st.side, -0.35, -0.55 + (fwd ? ph * 0.5 : -ph * 0.3))));
                paddle.rotation.set(-0.35 + sw * (fwd ? 0.8 : -0.5), st.yaw + st.look, 0.25 * st.side, 'YXZ');
            }
        },
    });
    return { start, active: () => !!st, debug: () => st && { x: st.x, z: st.z, yaw: st.yaw, v: st.v, blocked: st.blockedT > 0, next: st.next, of: cps.length, falls: st.falls, wobble: st.wobble, strokes: st.strokes, distance: st.distance, climb: st.climb, fall: st.fall }, course: cps };
}
