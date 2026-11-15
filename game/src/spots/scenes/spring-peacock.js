// ============================================================================
//  Spring Palace: creep up on a peacock in the garden until it fans its tail (owner, 2026-11-15: real activities; the
//  guided house visit is a tour). Peacocks walk free in the residence garden (visitor accounts, e.g. traveltastefeel.com
//  on the Ceaușescu Palace; the scene has had them since round 1). The museum (casaceausescu.ro, "Detalii vizitare") is
//  open Tuesday–Sunday 10:00–17:00, visits are guided; the game opens the garden game 10:00–17:00 by the in-game hour
//  (Mondays are not modelled).
//
//  The rules (spots/peacock-stalk.js): walk up (WASD) while the bird feeds with its head down; when it jerks its head up,
//  freeze — move while it looks round and it runs off (three times and it hides for the day). Never run near it. Stand
//  still a couple of metres from it and it turns to you and fans its tail. Leave or Esc stops anytime.
// ============================================================================
import { activityFlow } from '../participation.js';
import { timedActivity } from '../park-hours.js';
import { createStalk, PEACOCK } from '../peacock-stalk.js';
import { bucActivity } from '../buc.js';

export const SPRING_PALACE_HOURS = { open: 10, close: 17, note: 'The Spring Palace museum is open Tuesday–Sunday 10:00–17:00 (casaceausescu.ro).' };

/** birds: from peacocks() in spring-palace.js; free(x, z): their ground (the lawn, off the buildings); at: the E point (in the garden by the gate) */
export function springPeacock(ctx, { birds, free, at }) {
    const g = ctx.ground, flow = activityFlow(ctx);
    let st = null, last = null;
    // where a far-off bird comes to: open lawn 9–13 m from the E point with a clear line to it (off the buildings)
    const meet = (() => { let best = null; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; for (const d of [11, 9, 13]) { const x = at.x + Math.sin(a) * d, z = at.z + Math.cos(a) * d; let ok = free(x, z); for (let q = 1; q < d && ok; q += 0.5) ok = free(at.x + Math.sin(a) * q, at.z + Math.cos(a) * q) || q < 3; if (ok && (!best || Math.abs(d - 11) < Math.abs(best.d - 11))) best = { x, z, d }; } } return best; })();
    const SAY = { feed: 'It is feeding, head down — creep closer.', alert: 'It jerks its head up…', look: 'FREEZE! It is looking round.', flee: 'It ran off! Wait for it to settle, then try again.', fan: 'It turns to you…' };
    const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    const letGo = (b) => { b.held = false; b.neck.rotation.x = 0; };
    const stop = () => { if (!st) return; letGo(st.b); st = null; };
    const start = (s) => flow.begin(s, {
        title: '🦚 Creep up on a peacock', action: 'Stop (E)', lockWalker: false,
        help: 'Walk up (WASD) while it feeds with its head down. When it jerks its head up, freeze — move while it looks round and it runs off. Never run (Shift) near it. Stand still a couple of metres from it and it fans its tail. Three scares and it hides. E, Leave or Esc stops.',
        started(s2, r) {
            const p = s2.ctl.position; let b = birds[0]; for (const q of birds) if (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z)) b = q;
            b.held = true; b.show = 0; b.fan.visible = false; b.train.visible = true;
            // a bird out of reach (behind the residence, far down the garden) struts over to the open lawn first
            const arrive = meet && Math.hypot(b.x - p.x, b.z - p.z) > 16 ? { x: meet.x, z: meet.z } : null;
            if (arrive) { const ux = (meet.x - at.x) / meet.d, uz = (meet.z - at.z) / meet.d; let k = 6; while (k > 0 && !free(meet.x + ux * k, meet.z + uz * k)) k -= 1; b.x = meet.x + ux * k; b.z = meet.z + uz * k; } // (from the far side of the lawn)
            st = { b, game: createStalk(), prev: { x: p.x, z: p.z }, speed: 0, wander: arrive, strut: !!arrive, t: 0, flee: null };
            r.progress.max = 1; r.status.textContent = SAY.feed;
        },
        actioned() { flow.cancel('stop'); },
        update(dt, s2, r) {
            if (!st) return;
            const p = s2.ctl.position, b = st.b; st.t += dt;
            const v = Math.hypot(p.x - st.prev.x, p.z - st.prev.z) / Math.max(dt, 1e-3); st.prev = { x: p.x, z: p.z }; st.speed += (Math.min(v, 8) - st.speed) * Math.min(1, dt * 8);
            const dist = Math.hypot(b.x - p.x, b.z - p.z);
            if (dist > 45) { flow.cancel('left'); s2.ui.toast('🦚 Peacock', 'You walked away from the peacocks.'); return; }
            const ev = st.game.tick(dt, dist, st.speed), sn = st.game.snapshot();
            if (ev === 'spooked') { const away = Math.atan2(b.x - p.x, b.z - p.z); st.flee = { a: away }; s2.sound?.play?.('calls', 0.5); s2.ui.toast('🦚 It ran off', sn.last === 'ran' ? 'You ran — walk slowly near a peacock.' : 'You moved while it was looking round. Freeze when its head comes up.'); }
            if (ev === 'gone') { r.status.textContent = 'Scared three times, it hides in the shrubs. E or Leave, then try again.'; s2.ui.toast('🦚 Gone', 'The peacock has had enough of you for now.'); b.held = false; b.show = 0; flow.cancel('gone'); return; }
            if (ev === 'fanned') { flow.complete(); return; }
            // the bird: feeds and wanders, looks up, turns to you, flees, fans
            let walk = 0;
            if (sn.state === 'feed') { if (!st.strut && (!st.wander || Math.hypot(st.wander.x - b.x, st.wander.z - b.z) < 0.2)) { for (let k = 0; k < 12; k++) { const nx = b.x + (Math.random() - 0.5) * 4, nz = b.z + (Math.random() - 0.5) * 4; if (free(nx, nz)) { st.wander = { x: nx, z: nz }; break; } } }
                if (st.wander) { const dx = st.wander.x - b.x, dz = st.wander.z - b.z, L = Math.hypot(dx, dz); if (st.strut && L < 0.3) st.strut = false; if (L > 0.05) { const k = Math.min(L, dt * (st.strut ? 0.9 : 0.25)) / L; b.x += dx * k; b.z += dz * k; b.yaw = lerpAngle(b.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3)); walk = 0.5; } }
                b.neck.rotation.x += (1.15 - b.neck.rotation.x) * Math.min(1, dt * 4); }
            else if (sn.state === 'alert' || sn.state === 'look') { b.neck.rotation.x += (-0.12 - b.neck.rotation.x) * Math.min(1, dt * 12); if (sn.state === 'look') b.yaw = lerpAngle(b.yaw, Math.atan2(p.x - b.x, p.z - b.z) + Math.sin(st.t * 2.2) * 0.5, Math.min(1, dt * 2)); }
            else if (sn.state === 'flee' && st.flee) { const nx = b.x + Math.sin(st.flee.a) * 3 * dt, nz = b.z + Math.cos(st.flee.a) * 3 * dt; if (free(nx, nz)) { b.x = nx; b.z = nz; } else st.flee.a += dt * 3; b.yaw = st.flee.a; walk = 2.5; b.neck.rotation.x += (-0.25 - b.neck.rotation.x) * Math.min(1, dt * 8); }
            else if (sn.state === 'fan') { b.yaw = lerpAngle(b.yaw, Math.atan2(p.x - b.x, p.z - b.z), Math.min(1, dt * 3)); b.neck.rotation.x += (-0.2 - b.neck.rotation.x) * Math.min(1, dt * 6); if (sn.time > 0.6) { b.fan.visible = true; b.train.visible = false; } }
            b.ph += dt * 7 * walk; b.legs[0].rotation.x = Math.sin(b.ph) * 0.45 * Math.min(1, walk); b.legs[1].rotation.x = -Math.sin(b.ph) * 0.45 * Math.min(1, walk);
            b.g.position.set(b.x, g.heightAt(b.x, b.z) + Math.abs(Math.sin(b.ph)) * 0.02 * Math.min(1, walk), b.z); b.g.rotation.y = b.yaw;
            const close = dist <= PEACOCK.near, stillNow = st.speed <= PEACOCK.stillSpeed;
            r.status.textContent = `${sn.state === 'feed' && close ? (stillNow ? 'Stay still…' : 'Close enough — now stand still.') : SAY[sn.state] || ''}  ·  ${dist.toFixed(1)} m${sn.spooks ? ` · scared ${sn.spooks}/${PEACOCK.spooks}` : ''}`;
            r.progress.value = sn.state === 'fan' ? 1 : Math.max(0, Math.min(0.95, close ? 0.6 + 0.35 * sn.still / PEACOCK.still : 0.6 * (1 - (dist - PEACOCK.near) / 20)));
            last = { ...sn, dist, speed: st.speed, bird: { x: b.x, z: b.z }, watching: sn.watching };
        },
        cancel() { stop(); },
        complete(s2) { const b = st?.b, spooks = st?.game.snapshot().spooks; if (b) { letGo(b); b.show = 8; b.fan.visible = true; b.train.visible = false; } st = null; bucActivity(s2, 'spring-palace', 'peacock', '🦚 The full fan', `A Spring Palace peacock fanned its tail for you${spooks ? ` (after ${spooks} false start${spooks > 1 ? 's' : ''})` : ', first try'}.`); },
    });
    timedActivity(ctx, SPRING_PALACE_HOURS, { kind: 'peacock', x: at.x, z: at.z, r: 2.4, title: '🦚 Peacocks in the garden', label: 'Creep up on a peacock in the garden', cond: () => !st, start });
    const api = { start, active: () => !!st, debug: () => st && last, birds, at, meet };
    ctx.extras.springPeacock = api;
    return api;
}
