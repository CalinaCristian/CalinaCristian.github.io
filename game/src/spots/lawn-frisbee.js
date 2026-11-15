// ============================================================================
//  Frisbee catch on a park lawn with someone from the crowd. A local walks over and plays with you:
//    · your throw: a power gauge swings; aim with the mouse (where you look), E throws. The partner runs for it —
//      a throw that lands within their reach is caught.
//    · their throw: a ring on the grass marks where the disc is headed; walk there (WASD) and press E as it
//      reaches you to catch it. A drop lands on the grass: walk to it and press E to pick it up.
//  Three of your throws caught and three catches of your own complete the game. E / Leave / Esc stop anytime
//  (the partner goes back to where they were).
//
//  lawnFrisbee(ctx, { at: {x, z}, facing, area(x, z) → bool, onDone }) → { start(s), active(), debug() }
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

const REACH = 1.6, PARTNER_RUN = 4.6, GOAL = 3;

export function lawnFrisbee(ctx, { at, facing = 0, area = () => true, onDone = null, rng = Math.random }) {
    const flow = activityFlow(ctx), g = ctx.ground;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.03, 20), new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.45 }));
    disc.name = 'frisbee'; disc.visible = false; disc.userData.noFloor = true; disc.userData.noAudit = true; disc.castShadow = true; ctx.add(disc);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 28), new THREE.MeshBasicMaterial({ color: '#fff3a8', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.visible = false; mark.name = 'frisbee-landing'; mark.userData.noFloor = true; mark.userData.noAudit = true; ctx.add(mark);
    let st = null, last = null;
    const yAt = (x, z) => g.heightAt(x, z);
    // ---- the partner: the nearest free person in the crowd, walked (driven) over to the far end of the pitch
    const recruit = (s, spotX, spotZ) => {
        const peds = s.spot.crowd?.peds || []; let best = null, bd = 1e9;
        for (const p of peds) { if (p.hidden || p.driven || p === s.guide || p.act === 'guide') continue; const d = Math.hypot(p.x - spotX, p.z - spotZ); if (d < bd) { bd = d; best = p; } }
        if (!best) return null;
        const keep = { x: best.x, z: best.z, y: best.y, yaw: best.yaw, tyaw: best.tyaw, act: best.act, speed: best.speed, sayCd: best.sayCd };
        best.driven = true; best.act = 'stand'; best.speed = 0; best.sayCd = 1e9;
        if (bd > 45) { best.x = spotX + 6; best.z = spotZ + 6; best.y = yAt(best.x, best.z); } // (far away: they were already heading over)
        return { p: best, keep };
    };
    const release = (P) => { if (!P) return; const p = P.p; Object.assign(p, P.keep); p.driven = false; p.pose = null; };
    const walkTo = (p, x, z, dt, speed) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.05) { p.speed = 0; return true; } const k = Math.min(1, speed * dt / d); p.x += dx * k; p.z += dz * k; p.y = yAt(p.x, p.z); p.speed = speed; p.phase = (p.phase || 0) + dt * speed * 3.3; p.yaw = p.tyaw = Math.atan2(dx, dz); return d <= speed * dt; };
    const face = (p, x, z) => { p.yaw = p.tyaw = Math.atan2(x - p.x, z - p.z); };
    const handPos = (s) => s.camera.localToWorld(new THREE.Vector3(0.24, -0.28, -0.55));
    const fly = (from, to, secs, arc) => ({ from: from.clone(), to: to.clone(), secs, arc, t: 0 });
    const flyPos = (f, out) => { const q = Math.min(1, f.t / f.secs); out.lerpVectors(f.from, f.to, q); out.y += Math.sin(q * Math.PI) * f.arc; return q; };
    const status = (r, text) => { r.status.textContent = `${text}  ·  your throws caught ${st.good}/${GOAL} · your catches ${st.caught}/${GOAL}${st.drops ? ` · drops ${st.drops}` : ''}`; r.progress.value = (Math.min(GOAL, st.good) + Math.min(GOAL, st.caught)) / (GOAL * 2); };
    const start = (s) => flow.begin(s, {
        title: 'Frisbee on the lawn', action: 'Throw', lockWalker: false,
        help: 'Walk with WASD, aim with the mouse. Throw: E when the gauge is right for the distance. Catch: walk to the ring and press E as the disc reaches you. Three throws caught + three catches wins. Leave or Esc stops.',
        started(s, r) {
            const p = s.ctl.position, fx = -Math.sin(facing), fz = -Math.cos(facing);
            const spot = { x: at.x + fx * 13, z: at.z + fz * 13 };
            const P = recruit(s, spot.x, spot.z);
            st = { P, spot, phase: 'joining', t: 0, power: 0, good: 0, caught: 0, drops: 0, throws: 0, flight: null, lie: null, wait: 0 };
            disc.visible = true; disc.position.copy(handPos(s)); void p;
            r.button.textContent = 'Throw';
            if (!P) { status(r, 'Nobody is free to play right now.'); st.phase = 'aim'; }
            else s.ui.toast('🥏 Frisbee', 'Someone from the lawn is coming over to play.');
        },
        actioned(s, r) {
            if (!st) return;
            const p = s.ctl.position;
            if (st.phase === 'aim' && st.P) { // throw where you look, as far as the gauge says
                const dir = new THREE.Vector3(); s.camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
                const dist = 5 + st.power * 23, tx = p.x + dir.x * dist, tz = p.z + dir.z * dist, to = new THREE.Vector3(tx, yAt(tx, tz) + 1.1, tz);
                st.flight = fly(handPos(s), to, 0.75 + dist / 15, 0.9 + dist * 0.04); st.phase = 'out'; st.throws++; st.target = { x: tx, z: tz };
                s.sound?.play?.('whoosh', 0.3); status(r, 'Nice release…');
            } else if (st.phase === 'in') { // catch: the disc must be at your hands
                const d = disc.position.distanceTo(new THREE.Vector3(p.x, p.y + 1.15, p.z));
                if (d < REACH) { st.caught++; st.phase = 'aim'; st.flight = null; mark.visible = false; s.sound?.play?.('catch', 0.5); s.ui.toast('🥏 Caught!', st.caught >= GOAL && st.good >= GOAL ? 'That\'s the game!' : 'Your throw.'); }
                else { st.early = (st.early || 0) + 1; status(r, d < 4 ? 'Too early — wait for it…' : 'Not in reach — get under the ring!'); }
            } else if (st.phase === 'lie') { // pick a dropped disc up
                if (Math.hypot(st.lie.x - p.x, st.lie.z - p.z) < 1.8) { st.phase = 'aim'; st.lie = null; mark.visible = false; } else status(r, 'Walk to the disc on the grass to pick it up.');
            }
            if (st.phase === 'aim' && st.caught >= GOAL && st.good >= GOAL) flow.complete();
        },
        cancel(s) { stopAll(); },
        complete(s) { const stats = { throws: st?.throws, drops: st?.drops }; stopAll(); onDone?.(s, stats); },
        update(dt, s, r) {
            if (!st) return;
            st.t += dt; const p = s.ctl.position, P = st.P, me = new THREE.Vector3(p.x, p.y + 1.15, p.z);
            if (!P) { flow.cancel('nobody'); s.ui.toast('🥏 Frisbee', 'Nobody on the lawn is free to play right now.'); return; }
            if (Math.hypot(p.x - at.x, p.z - at.z) > 70) { flow.cancel('left'); s.ui.toast('🥏 Game over', 'You walked away from the game.'); return; }
            if (P) { // the partner's own clock; they face the disc or you
                if (st.phase === 'joining') { status(r, 'Your partner is on the way…'); if (walkTo(P.p, st.spot.x, st.spot.z, dt, 3.2) || st.t > 14) { if (st.t > 14) { P.p.x = st.spot.x; P.p.z = st.spot.z; P.p.y = yAt(P.p.x, P.p.z); } P.p.speed = 0; st.phase = 'aim'; face(P.p, p.x, p.z); } }
            }
            if (st.phase === 'aim') {
                st.power = (Math.sin(st.t * 3.2) + 1) / 2; disc.position.copy(handPos(s)); disc.rotation.set(0.2, 0, 0.1);
                r.button.textContent = 'Throw'; if (P) { P.p.speed = 0; face(P.p, p.x, p.z); }
                const d = P ? Math.hypot(P.p.x - p.x, P.p.z - p.z) : 0;
                status(r, `Gauge ${Math.round(5 + st.power * 23)} m — your partner is ${Math.round(d)} m away. E throws`);
                r.progress.value = st.power;
            } else if (st.phase === 'out') { // your throw in the air; the partner runs for the landing spot
                const q = flyPos(st.flight, disc.position); st.flight.t += dt; disc.rotation.y += dt * 18;
                const L = st.target; walkTo(P.p, L.x, L.z, dt, PARTNER_RUN);
                if (q >= 1) {
                    const reached = Math.hypot(P.p.x - L.x, P.p.z - L.z) < 1.4;
                    if (reached) { st.good++; s.ui.toast('🥏 Caught by your partner', st.good >= GOAL ? 'Three of your throws caught.' : 'Good throw!'); st.phase = 'return'; st.wait = 1.0; if (st.caught >= GOAL && st.good >= GOAL) { flow.complete(); return; } }
                    else { st.phase = 'fetch'; st.lie = { x: L.x, z: L.z }; disc.position.set(L.x, yAt(L.x, L.z) + 0.03, L.z); status(r, 'Out of reach — your partner fetches it.'); }
                    P.p.speed = 0;
                }
            } else if (st.phase === 'fetch') { // the partner jogs to the disc, then back to their end
                if (walkTo(P.p, st.lie.x, st.lie.z, dt, 3.4)) { st.phase = 'return'; st.wait = 0.8; st.lie = null; }
            } else if (st.phase === 'return') { // they wind up and throw it back towards you (a few metres off: make the catch)
                disc.position.set(P.p.x + Math.sin(P.p.yaw) * 0.4, P.p.y + 1.2, P.p.z + Math.cos(P.p.yaw) * 0.4); face(P.p, p.x, p.z);
                st.wait -= dt; status(r, 'Get ready to catch…');
                if (st.wait <= 0) {
                    let tx = p.x, tz = p.z; for (let k = 0; k < 12; k++) { const a = rng() * Math.PI * 2, d = 2.5 + rng() * 4; const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (area(x, z)) { tx = x; tz = z; break; } }
                    const from = disc.position.clone(), dist = Math.hypot(tx - from.x, tz - from.z), to = new THREE.Vector3(tx, yAt(tx, tz) + 1.15, tz);
                    st.flight = fly(from, to, 1.7 + dist / 16, 1.2 + dist * 0.03); st.phase = 'in'; st.land = { x: tx, z: tz };
                    mark.position.set(tx, yAt(tx, tz) + 0.04, tz); mark.visible = true; P.p.pose = 'wave'; P.p.poseT = 0.6; s.sound?.play?.('whoosh', 0.3);
                }
            } else if (st.phase === 'in') { // incoming: catch with E inside the window
                const q = flyPos(st.flight, disc.position); st.flight.t += dt; disc.rotation.y += dt * 18; r.button.textContent = 'Catch';
                const d = disc.position.distanceTo(me); status(r, d < REACH ? 'NOW — press E!' : 'Get under the ring…');
                if (q >= 1 && st.flight.t > st.flight.secs + 0.35) { // dropped: it lands on the grass beyond you
                    const L = st.land; disc.position.set(L.x, yAt(L.x, L.z) + 0.03, L.z); disc.rotation.set(0, 0, 0); st.drops++; st.phase = 'lie'; st.lie = { x: L.x, z: L.z }; st.flight = null; r.button.textContent = 'Pick up';
                    s.ui.toast('🥏 Dropped', 'Walk to the disc and press E to pick it up.');
                } else if (q >= 1) { disc.position.y -= dt * 2.4; }
            } else if (st.phase === 'lie') { const L = st.lie, d = Math.hypot(L.x - p.x, L.z - p.z); status(r, d < 1.8 ? 'Press E to pick it up.' : `The disc is ${Math.round(d)} m away.`); r.button.textContent = 'Pick up'; }
            last = { phase: st.phase, good: st.good, caught: st.caught, drops: st.drops, power: st.power, disc: disc.position.toArray(), partner: P && { x: P.p.x, z: P.p.z }, land: st.land, target: st.target };
        },
    });
    const stopAll = () => { if (st) release(st.P); st = null; disc.visible = false; mark.visible = false; last = null; };
    return { start, active: () => !!st, debug: () => st && { ...last, phase: st.phase, good: st.good, caught: st.caught, drops: st.drops, flight: st.flight && { t: st.flight.t, secs: st.flight.secs } }, reach: REACH };
}
