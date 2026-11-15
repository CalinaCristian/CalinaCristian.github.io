// ============================================================================
//  Pike Place Fish Market (86 Pike St, OSM n2397497121): the flying fish, at the market's main entrance under the
//  PUBLIC MARKET CENTER clock. How the real toss goes and the opening hours: fish-toss.js.
//   • the iced display is the fish stall row under the canopy in front of the Main Arcade (pike-place.js buildArcade);
//   • two fishmongers stand out front on the customers' side of the ice and take turns throwing; behind the counter
//     a third monger catches and wraps (the everyday show, every 7–13 s while the market is open);
//   • "Catch fish with the crew": the crew wave you behind the counter into the catcher's place and throw you five
//     salmon over the ice; look at the fish and press E / Catch! as it reaches you. Three catches win.
//  Only while Pike Place Fish is open (daily 7 am – 5 pm, in-game local hour); closed, the mongers are gone.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, alongPolyline, distPolyline, lerp } from '../kit.js';
import { fishMesh } from '../props.js';
import { activityFlow, activityBlocked } from '../participation.js';
import { createFishToss, fishOpen, FISH_HOURS } from '../fish-toss.js';

const SIDE = ['left', 'right'];
const shout = (order) => `One ${order}, flyin'!`;

/**
 * @param ctx scene context
 * @param {{ line:number[][], seaActivity:Function }} o  line: the Pike Place centreline (the stall's frontage)
 * @returns {{ throwers:{x,z,yaw}[], catcher:{x,z}, crew:{x,z,yaw}, poi:{x,z}, s0:number }}
 */
export function buildFishToss(ctx, { line, seaActivity }) {
    const g = ctx.ground, poi = ctx.data.pois.find((p) => p.name === 'Pike Place Fish Market') || { x: -64.6, z: 37.6 };
    // the stall's station along Pike Place, and points across the frontage (d > 0: towards the market)
    const q = distPolyline(poi.x, poi.z, line); let s0 = 0; for (let i = 1; i <= q.i; i++) s0 += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); s0 += Math.hypot(q.cx - line[q.i][0], q.cz - line[q.i][1]);
    const at = (s, d) => { const p = alongPolyline(line, s); return { x: p.x + p.tz * d, z: p.z - p.tx * d, tx: p.tx, tz: p.tz }; };
    const face = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
    // (the catcher's place is centred on the display just north of the canopy post at the stall's address, 1.3 m on:
    // the post stood in the middle of the catcher's view)
    const sc = s0 + 1.3, catcher = at(sc, 8.4), crew = at(sc + 2.4, 8.5), wrap = at(sc, 9.75);
    const throwers = [at(sc - 1.2, 4.8), at(sc + 1.2, 4.8)].map((p) => ({ ...p, yaw: face(p, catcher) }));
    crew.yaw = face(crew, throwers[0]);
    // the wrapping counter against the back wall: white paper, the scale
    { const b = new GeoBatch(), yaw = Math.atan2(wrap.tx, wrap.tz) + Math.PI / 2, y = g.heightAt(wrap.x, wrap.z);
        b.box(wrap.x, y, wrap.z, 0.8, 0.92, 3.6, '#d9d6cf', 'steel', yaw); b.box(wrap.x, y + 0.92, wrap.z, 0.82, 0.03, 3.62, '#f4f1e8', 'paint', yaw);
        b.box(wrap.x - wrap.tx * 0.9, y + 0.95, wrap.z - wrap.tz * 0.9, 0.35, 0.25, 0.35, '#c9ccce', 'metal', yaw);
        ctx.add(b.build('fish-wrap-counter')); ctx.box(wrap.x, wrap.z, 0.4, 1.8, yaw, { prop: true, h: 0.95 }); }

    const flow = activityFlow(ctx), fish = fishMesh(); fish.visible = false; fish.name = 'flying-fish'; ctx.add(fish);
    let open = true, hourT = 0, mongers = null, ambient = { t: 4, k: -1, from: null, to: null, dur: 1, turn: 0 }, game = null, held = 0, drop = null, firstCatch = true;
    const head = (p, y) => ({ x: p.x, z: p.z, y });
    const hand = (p, s) => ({ x: p.x + Math.sin(p.yaw) * 0.35, z: p.z + Math.cos(p.yaw) * 0.35, y: s.spot.ground.groundAt(p.x, p.z, 10) + 1.55 });
    const say = (s, p, text) => { const c = s.spot.crowd, m = p && mongers?.[p]; if (c && m && !m.hidden) s.ui.bubbles.say(c._headRef(m), text, '', 'friendly'); };
    const pose = (m, name, t) => { if (m) { m.pose = name; m.poseT = t; } };
    const place = (from, to, k, arc, spin) => {
        const x = lerp(from.x, to.x, k), z = lerp(from.z, to.z, k), y = lerp(from.y, to.y, k) + Math.sin(Math.PI * k) * arc;
        fish.position.set(x, y, z); fish.lookAt(to.x, y + (k < 0.5 ? arc * 0.5 : -arc * 0.5), to.z); fish.rotateZ(spin);
    };
    const findMongers = (s) => {
        const c = s.spot.crowd; if (!c) return null;
        const near = (p) => c.peds.filter((m) => m.persona === 'fishmonger').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null;
        return { t0: near(throwers[0]), t1: near(throwers[1]), crew: near(crew) };
    };
    // the fish arrives at the player's hands: half a metre in front of the chest, towards the thrower, a little to one side
    const playerTarget = (s, lateral, T) => { const p = s.position, y = s.spot.ground.groundAt(catcher.x, catcher.z, p.y + 1), dx = T.x - catcher.x, dz = T.z - catcher.z, L = Math.hypot(dx, dz) || 1;
        return { x: catcher.x + dx / L * 0.5 + catcher.tx * lateral * 0.5, z: catcher.z + dz / L * 0.5 + catcher.tz * lateral * 0.5, y: y + 1.3 }; };
    // aim: facing the monger who threw it (the two stand ~37° apart from the catcher's place: looking between them fails)
    const aimOk = (s, T) => { const f = s.camera.getWorldDirection(new THREE.Vector3()), e = s.camera.getWorldPosition(new THREE.Vector3()), a = Math.atan2(T.x - e.x, T.z - e.z) - Math.atan2(f.x, f.z); return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 16 * Math.PI / 180; };

    function begin(s) {
        if (!open) { s.ui.toast('🐟 Pike Place Fish is closed', `Open daily ${FISH_HOURS.open} am – ${FISH_HOURS.close - 12} pm. Come back in the daytime to catch a salmon.`); return; }
        const engine = createFishToss(); let started = null;
        const ok = flow.begin(s, {
            title: 'Pike Place Fish · catch!', action: 'Catch!',
            help: 'The crew wave you behind the counter, into the catcher\'s spot. The two mongers out front take turns: each shouts the order, the crew shouts it back, and a salmon flies over the ice to you. Look at the fish and press E / Catch! as it reaches your hands. Catch 3 of 5. Leave or Esc to step out.',
            started(_s, r) {
                started = { ...r.start }; game = engine; ambient.k = -1; fish.visible = false;
                const mid = { x: (throwers[0].x + throwers[1].x) / 2, z: (throwers[0].z + throwers[1].z) / 2 };
                s.ctl.teleport(catcher.x, catcher.z, Math.atan2(-(mid.x - catcher.x), -(mid.z - catcher.z))); s.ctl.pitch = 0.08; s.ctl.place?.();
                say(s, 'crew', 'Come on back! Hands up, eyes on the fish!'); s.sound.play('calls', 1);
            },
            actioned(_s, r) {
                const res = engine.action(aimOk(s, throwers[engine.snapshot().thrower])); if (!res) return;
                const q = engine.snapshot();
                if (res === 'catch') { held = 1.0; s.sound.play('catch'); pose(mongers?.crew, 'cheer', 1.1); s.progress.fish = (s.progress.fish || 0) + 1; if (firstCatch) { firstCatch = false; seaActivity(s, 'lm-pike-fish', 'pike-place'); } }
                else { drop = { y0: fish.position.y, x: fish.position.x, z: fish.position.z, t: 0 }; s.sound.play('splat'); }
                r.status.textContent = res === 'catch' ? `Caught it! ${q.catches}/${q.need}` : res === 'look' ? 'You looked away: the fish slapped onto the floor.' : 'Too early! Wait until the fish reaches your hands.';
            },
            update(dt, _s, r) {
                const ev = engine.tick(dt), q = engine.snapshot(), T = throwers[q.thrower], M = q.thrower ? mongers?.t1 : mongers?.t0;
                r.progress.value = q.catches / q.need; r.busy = q.state !== 'flight';
                if (ev === 'next' || (q.state === 'call' && q.time <= dt + 1e-6 && q.thrown === 0)) { say(s, q.thrower ? 't1' : 't0', shout(q.order)); pose(M, 'point', 1.3); s.sound.play('calls', 1); }
                if (ev === 'throw') { say(s, 'crew', shout(q.order).toUpperCase()); pose(M, 'cheer', 0.5); }
                if (q.state === 'flight') { const from = hand({ ...T, yaw: T.yaw }, s), to = playerTarget(s, q.lateral, T); fish.visible = true; place(from, to, Math.min(1.08, q.time / q.dur), q.arc, q.time * 8); }
                else if (held > 0) { held -= dt; const cam = s.camera, e = cam.getWorldPosition(new THREE.Vector3()), f = cam.getWorldDirection(new THREE.Vector3()); fish.position.copy(e).addScaledVector(f, 0.55); fish.position.y -= 0.3; fish.lookAt(e.x + f.z, fish.position.y, e.z - f.x); fish.visible = true; }
                else if (drop) { drop.t += dt; const fy = s.spot.ground.groundAt(drop.x, drop.z, drop.y0) + 0.05; fish.position.set(drop.x, Math.max(fy, drop.y0 - 9.8 * drop.t * drop.t / 2), drop.z); fish.rotation.set(Math.PI / 2, 0, drop.t * 3); fish.visible = drop.t < 1.1; if (drop.t >= 1.1) drop = null; }
                else fish.visible = false;
                if (ev === 'late') { drop = { y0: fish.position.y, x: fish.position.x, z: fish.position.z, t: 0 }; s.sound.play('splat'); r.status.textContent = 'Too late: it slid out of your hands.'; }
                if (q.state === 'call') r.status.textContent = `${q.thrown + 1}/${q.throws} · the monger on the ${SIDE[q.thrower]} calls the order… (${q.catches}/${q.need} caught)`;
                else if (q.state === 'flight') r.status.textContent = q.catchNow ? 'Catch NOW!' : 'Here it comes… eyes on the fish';
                if (q.state === 'won') { flow.complete(); return; }
                if (q.state === 'lost') { s.ui.toast('🐟 Back to the ice', `${q.catches} of ${q.throws} caught. The crew wave you back for another try any time.`); flow.cancel('lost'); }
            },
            complete() {
                game = null; fish.visible = false; held = 0; drop = null;
                seaActivity(s, 'lm-pike-fish-crew', 'pike-place', '🎣 Honorary fishmonger', 'Three salmon caught over the ice. The crew have thrown fish to their wrappers since the 1980s, up to 200 tosses a day.');
                say(s, 'crew', 'Nice hands! Welcome to the crew!'); pose(mongers?.t0, 'cheer', 1.5); pose(mongers?.t1, 'cheer', 1.5);
                if (started) s.ctl.teleport(started.x, started.z, started.heading);
            },
            cancel() { engine.cancel(); game = null; fish.visible = false; held = 0; drop = null; if (started) s.ctl.teleport(started.x, started.z, started.heading); },
        });
        if (!ok) game = null;
    }
    const inter = { kind: 'fish', x: (throwers[0].x + throwers[1].x) / 2 - (catcher.x - throwers[0].x) * 0.3, z: (throwers[0].z + throwers[1].z) / 2 - (catcher.z - throwers[0].z) * 0.3, r: 4.2, source: poi.id,
        tourActivityIds: ['fish', 'fish-crew'], tourAvailable: () => open,
        label: () => (open ? 'Catch fish with the Pike Place Fish crew' : `Pike Place Fish · closed · open daily ${FISH_HOURS.open} am–${FISH_HOURS.close - 12} pm`),
        use: (s) => { if (!activityBlocked(s)) begin(s); } };
    ctx.interactables.push(inter);

    ctx.onUpdate((dt, s) => {
        if (!mongers) mongers = findMongers(s);
        hourT -= dt; if (hourT <= 0) { hourT = 1; const h = s._conditions?.().hour; open = h === undefined ? true : fishOpen(h);
            for (const m of Object.values(mongers || {})) if (m) { if (m._fishHidden === undefined) m._fishHidden = !!m.hidden; m.hidden = m._fishHidden || !open; } }
        if (game || !open) { if (!game) fish.visible = false; return; }
        // the everyday show: an order, the crew's echo, the fish over the ice to the wrapper behind the counter
        if (ambient.k < 0) {
            ambient.t -= dt; if (ambient.t > 0) return;
            ambient.turn ^= 1; const T = throwers[ambient.turn], M = ambient.turn ? mongers?.t1 : mongers?.t0, order = ['wild king salmon', 'Copper River sockeye', 'silver salmon'][Math.floor(Math.random() * 3)];
            say(s, ambient.turn ? 't1' : 't0', shout(order)); pose(M, 'point', 1.2); s.sound.play('calls', 1);
            ambient.from = hand(T, s); ambient.to = { ...hand(crew, s), y: s.spot.ground.groundAt(crew.x, crew.z, 10) + 1.4 }; ambient.dur = 1.0; ambient.k = -2; ambient.t = 1.2; ambient.echo = order; return;
        }
        if (ambient.k === -2) { ambient.t -= dt; if (ambient.t > 0) return; ambient.k = 0; say(s, 'crew', shout(ambient.echo).toUpperCase()); }
        ambient.k += dt / ambient.dur; fish.visible = true; place(ambient.from, ambient.to, Math.min(1, ambient.k), 1.6, ambient.k * 8);
        if (ambient.k >= 1) { fish.visible = false; ambient.k = -1; ambient.t = 7 + Math.random() * 6; pose(mongers?.crew, 'cheer', 0.6); }
    });
    ctx.extras.fishToss = { get open() { return open; }, get game() { return game?.snapshot() || null; }, throwers, catcher, crew, poi, s0, interactable: inter };
    return { throwers, catcher, crew, poi, s0 };
}
