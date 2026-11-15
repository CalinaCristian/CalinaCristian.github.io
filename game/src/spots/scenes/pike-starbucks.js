// A coffee at the Original Starbucks, 1912 Pike Place (owner, 2026-11-15: "in pike place we should have an activity for
// drinking a coffee at first starbucks"). The store has been at this address since 1976 (Wikipedia, "Original
// Starbucks"). Hours: a daily 6:00–20:00 is listed by travel guides; Starbucks' own 2026 story on the reimagined store
// ("1912 Pike Place Experience", about.starbucks.com) adds timed reservations and gives no hours, so 6–20 local is the
// game's reading, not a verified schedule. Position: OSM node n2397461017 (Starbucks) at the storefront buildStarbucks draws.
// Same shape as "Have a coffee on Lipscani": a prompt at the door, order → first sip → finish, each step's animation runs to
// its end before the next is offered; a paper cup with the 1971 brown-ring look is held in the hand.
import * as THREE from '../../../vendor/three.module.min.js';
import { activityFlow } from '../participation.js';
import { seaActivity } from './sea-common.js';

export const STARBUCKS_HOURS = [6, 20];
export const starbucksOpen = (hour) => hour >= STARBUCKS_HOURS[0] && hour < STARBUCKS_HOURS[1];

function cupProp() {
    const root = new THREE.Group(); root.name = 'held-starbucks-cup'; root.visible = false;
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o }), add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.frustumCulled = false; root.add(o); return o; };
    const arm = add(new THREE.CylinderGeometry(.048, .065, .28, 12), M('#a87555'), .02, -.2, .1); arm.rotation.x = -.6;
    add(new THREE.SphereGeometry(.066, 10, 6), M('#c38d68'), .0, -.04, 0).scale.set(.9, 1.1, .7);
    add(new THREE.CylinderGeometry(.045, .034, .14, 20), M('#f2eee6'), 0, .03, 0);                      // the paper cup
    add(new THREE.CylinderGeometry(.0465, .044, .045, 20), M('#7a5230', { roughness: .85 }), 0, .03, 0); // the brown sleeve with the ring logo
    add(new THREE.CylinderGeometry(.049, .047, .016, 20), M('#ece9e2', { roughness: .4 }), 0, .107, 0);  // lid
    const steam = [0, 1, 2].map(() => add(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), 0, .13, 0));
    return { root, steam };
}

/** (x, z): the storefront (buildStarbucks); (fx, fz): unit vector from the shop out to Pike Place */
export function addStarbucksCoffee(ctx, { x, z, fx, fz }) {
    const flow = activityFlow(ctx), prop = cupProp(), parking = new THREE.Group(); parking.name = 'starbucks-cup-parking'; parking.visible = false; ctx.add(parking); parking.add(prop.root);
    const ix = x + fx * 1.7, iz = z + fz * 1.7, iy = ctx.ground.heightAt(ix, iz);
    const STEPS = [
        { label: 'Order a Pike Place Roast (E)', doing: 'The barista calls your name: grande, black.', done: 'Hot, and in the original brown cup.', time: 2.2 },
        { label: 'First sip (E)', doing: 'Careful, it is hot…', done: 'Roasty. The market starts its day.', time: 1.8 },
        { label: 'Finish the coffee (E)', doing: 'The last of it, looking down Pike Place…', done: '', time: 2.2 },
    ];
    const pose = (r, u) => {
        const lift = Math.sin(Math.min(1, u) * Math.PI), sip = r.anim && r.step > 0, side = .16;
        prop.root.position.set(side - (sip ? .12 * lift : 0), -.34 + (sip ? .22 * lift : r.step > 0 ? .02 : 0), -.62 + (sip ? .2 * lift : 0));
        prop.root.rotation.set(sip ? .9 * lift : 0, 0, sip ? -.15 * lift : 0);
        prop.root.visible = r.step > 0 || (r.anim && u > .6);
        prop.steam.forEach((p, i) => { const t = ((r.clock || 0) * .6 + i / 3) % 1; p.position.set(Math.sin(t * 9 + i) * .012, .13 + t * .1, 0); p.material.opacity = r.step < 3 ? .3 * (1 - t) : 0; });
    };
    const hourNow = (s) => s._conditions?.().hour ?? 12;
    ctx.interactables.push({ x: ix, z: iz, y: iy, r: 2.6, source: 'n2397461017', activity: 'starbucks-coffee',
        label: (s) => (starbucksOpen(hourNow(s)) ? 'Have a coffee at the first Starbucks' : `Original Starbucks · closed · opens at 0${STARBUCKS_HOURS[0]}:00`),
        tourAvailable: (s) => starbucksOpen(hourNow(s)),
        cond: () => !flow.active,
        use(s) {
            if (!starbucksOpen(hourNow(s))) { s.ui.toast('☕ The Original Starbucks is closed', 'Open about 6:00 to 20:00 (guide listing; check the store before you go).'); return; }
            flow.begin(s, {
                title: '☕ Original Starbucks · 1912 Pike Place', action: STEPS[0].label,
                help: 'The first Starbucks has been at this address since 1976. Order, sip, finish: three small actions; look around while you drink.',
                started(_s, r) { r.step = 0; r.t = 0; r.anim = false; r.progress.max = 3; r.status.textContent = 'The queue moves fast. What will it be?'; s.camera.add(prop.root); pose(r, 0); },
                actioned(_s, r) { if (r.anim) return; r.anim = true; r.t = 0; r.busy = true; r.status.textContent = STEPS[r.step].doing; },
                update(dt, _s, r) {
                    r.clock = (r.clock || 0) + dt; let u = 0;
                    if (r.anim) { r.t += dt; u = Math.min(1, r.t / STEPS[r.step].time);
                        if (u >= 1) { const done = STEPS[r.step].done; r.anim = false; r.busy = false; r.step++; u = 0;
                            if (r.step === STEPS.length) { flow.complete(); return; }
                            r.status.textContent = `${r.step}/3 · ${done}`; r.button.textContent = STEPS[r.step].label; } }
                    pose(r, u); r.progress.value = r.step + u;
                },
                cancel() { prop.root.visible = false; parking.add(prop.root); },
                complete(s2) { prop.root.visible = false; parking.add(prop.root); seaActivity(s2, 'starbucks-coffee', 'pike-place', '☕ Where it all started', 'A Pike Place Roast at the Original Starbucks, 1912 Pike Place, at this address since 1976.'); },
            });
        } });
    return { x: ix, z: iz };
}
