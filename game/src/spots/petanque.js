// Pétanque on the gravel by the Arc (owner, 2026-11-15: "try the baguette catch is dumb need to be more creative").
// Bucharest's Arcul de Triumf is the city's Paris-style triumphal arch (the "Little Paris" nod); the round is a game
// invention, not an observed local custom. One mène: the jack (cochonnet) lies about 7 m out on the island apron,
// Mihai, a park regular, has thrown his boule; you have three. Aim with the mouse / swipe (the view), time the throw on
// the swinging power meter (the gold marker on the ground shows where it would land), E / Throw. Get one boule closer to
// the jack than his and the point is yours. Under a minute, three inputs, a clear win.
//
//   petanqueGame(ctx, { x, z, floor, onWin }) → { start(s), debug() } · the interactable is the caller's
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { collide } from './walker.js';

const PERIOD = 1.7, MIN = 2.5, MAX = 11, FLIGHT = .85;
/** the swinging power meter, 0..1..0 (pure; tested by the harness) */
export const meter = (t) => { const u = ((t / PERIOD) % 1 + 1) % 1; return u < .5 ? u * 2 : 2 - u * 2; };
/** where a throw at this power lands along the aim (before the short roll) */
export const reach = (power) => MIN + (MAX - MIN) * Math.max(0, Math.min(1, power));

export function petanqueGame(ctx, { x, z, floor, onWin }) {
    const g = ctx.ground, flow = activityFlow(ctx), group = new THREE.Group(); group.name = 'petanque-round'; group.visible = false; ctx.add(group);
    const steel = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: .9, roughness: .3 }), bronze = new THREE.MeshStandardMaterial({ color: '#6d5434', metalness: .8, roughness: .35 });
    const ball = (r, m) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), m); b.castShadow = true; b.userData.noFloor = true; group.add(b); return b; };
    const jack = ball(.03, new THREE.MeshStandardMaterial({ color: '#e0812a', roughness: .6 })), rival = ball(.038, bronze), mine = [0, 1, 2].map(() => ball(.038, steel));
    const held = new THREE.Mesh(new THREE.SphereGeometry(.038, 16, 10), steel); held.name = 'petanque-held-boule'; held.visible = false; held.position.set(.17, -.3, -.6);
    const mark = new THREE.Mesh(new THREE.RingGeometry(.14, .2, 24), new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }));
    mark.rotation.x = -Math.PI / 2; mark.userData.noFloor = true; mark.name = 'petanque-aim'; group.add(mark);
    const ground = (px, pz) => { const y = g.groundAt(px, pz, floor + .4); return Number.isFinite(y) ? y : floor; };
    const clear = (px, pz) => { const y = g.groundAt(px, pz, floor + .4); return Number.isFinite(y) && Math.abs(y - floor) < .35 && !ctx.onRoad?.(px, pz, .5) && !collide(ctx.colliders, px, pz, .25, y + .2); };
    // the pitch: the clearest direction from the throwing circle (a run of free apron at least 9 m long)
    let dir = 0, best = -1;
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; let n = 0; for (let d = 1; d <= 11; d += .5) { if (!clear(x + Math.sin(a) * d, z + Math.cos(a) * d)) break; n = d; } if (n > best) { best = n; dir = a; } }
    const J = Math.min(7, Math.max(4, best - 1.5)), jx = x + Math.sin(dir) * J, jz = z + Math.cos(dir) * J;
    const place = (m, px, pz) => { m.position.set(px, ground(px, pz) + m.geometry.parameters.radius, pz); };
    let round = null, seed = 1936;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const end = () => { group.visible = false; held.visible = false; held.removeFromParent(); };
    return {
        pitch: { x, z, jack: { x: jx, z: jz }, length: best },
        debug: () => round && { thrown: round.thrown, best: round.best, rival: round.rival, power: round.power, flying: !!round.fly },
        start(s) {
            return flow.begin(s, {
                title: '🎯 Pétanque by the Arc', action: 'Throw (E)', focus: { x: jx, y: floor + .2, z: jz },
                help: 'One round against Mihai, a park regular. Aim with the mouse or a swipe, throw when the gold marker sits on the little orange jack. Closer than his bronze boule wins the point. Three boules.',
                started(s, r) {
                    group.visible = true; place(jack, jx, jz);
                    const ra = rnd() * Math.PI * 2, rd = .35 + rnd() * .7; place(rival, jx + Math.sin(ra) * rd, jz + Math.cos(ra) * rd);
                    for (const m of mine) m.visible = false;
                    round = { thrown: 0, best: Infinity, rival: Math.hypot(rival.position.x - jx, rival.position.z - jz), t: 0, power: 0, fly: null, done: false };
                    s.camera.add(held); held.visible = true;
                    r.status.textContent = `Mihai's boule lies ${round.rival.toFixed(2)} m from the jack. Beat it.`;
                },
                actioned(s, r) {
                    if (!round || round.fly || round.done || round.thrown >= 3) return;
                    const aim = s.ctl.heading, fx = -Math.sin(aim), fz = -Math.cos(aim), d = reach(round.power), side = (rnd() - .5) * .5 * (.4 + round.power);
                    const lx = s.position.x + fx * d - fz * side, lz = s.position.z + fz * d + fx * side, roll = .25 + rnd() * .35;
                    const m = mine[round.thrown]; m.visible = true; held.visible = false; r.busy = true;
                    round.fly = { m, t: 0, from: s.camera.localToWorld(new THREE.Vector3(.17, -.3, -.6)), land: { x: lx, z: lz }, end: { x: lx + fx * roll, z: lz + fz * roll } };
                    round.thrown++; s.sound?.play?.('chime', .08);
                },
                update(dt, s, r) {
                    if (!round) return;
                    round.t += dt; if (!round.fly) round.power = meter(round.t);
                    r.progress.value = round.fly ? r.progress.value : round.power;
                    const aim = s.ctl.heading, d = reach(round.power); mark.visible = !round.fly && !round.done;
                    if (mark.visible) { const mx = s.position.x - Math.sin(aim) * d, mz = s.position.z - Math.cos(aim) * d; mark.position.set(mx, ground(mx, mz) + .03, mz); }
                    const f = round.fly; if (!f) return;
                    f.t += dt; const u = Math.min(1, f.t / FLIGHT), y0 = ground(f.land.x, f.land.z) + .038;
                    if (u < 1) { f.m.position.set(f.from.x + (f.land.x - f.from.x) * u, f.from.y + (y0 - f.from.y) * u + Math.sin(u * Math.PI) * 1.4, f.from.z + (f.land.z - f.from.z) * u); return; }
                    const v = Math.min(1, (f.t - FLIGHT) / .55), e = 1 - (1 - v) * (1 - v), px = f.land.x + (f.end.x - f.land.x) * e, pz = f.land.z + (f.end.z - f.land.z) * e;
                    place(f.m, px, pz); if (v < 1) return;
                    const dist = Math.hypot(px - jx, pz - jz); round.best = Math.min(round.best, dist); round.fly = null;
                    if (dist < round.rival) { round.done = true; r.status.textContent = `${dist.toFixed(2)} m from the jack against his ${round.rival.toFixed(2)} m: the point is yours!`; setTimeout(() => { if (flow.run?.opts.title === '🎯 Pétanque by the Arc') flow.complete(); }, 900); return; }
                    if (round.thrown >= 3) { round.done = true; r.status.textContent = `Your best: ${round.best.toFixed(2)} m. Mihai keeps the point (${round.rival.toFixed(2)} m). Leave and try again.`; r.button.disabled = true; r.busy = true; return; }
                    r.busy = false; held.visible = true; round.t = 0;
                    r.status.textContent = `${dist.toFixed(2)} m from the jack (Mihai: ${round.rival.toFixed(2)} m) · ${3 - round.thrown} boule${round.thrown === 2 ? '' : 's'} left`;
                },
                cancel() { round = null; end(); },
                complete(s) { round = null; end(); onWin?.(s); },
            });
        },
    };
}
