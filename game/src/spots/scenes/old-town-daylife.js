// Old Town by day, and more to do at night (owner, 2026-11-11: "figure out activities for daytime too and more
// activities in general for that area"). By day the visit had the Carusel stair and nothing else: Freddo is a club night.
// Every activity here stands at a real OSM place inside the visit area and is what visitors do there; hours, sources and
// what is estimated are in game/research/old-town-daylife.md. Nothing is added to a street or a building: the props are
// held in the visitor's hand, the busker's case lies at the busker the scene already had.
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, distPolyline, inPoly, canvas, canvasTexture, disposeTree } from '../kit.js';
import { facadeToward, bucActivity } from '../buc.js';
import { activityFlow } from '../participation.js';
import { collide } from '../walker.js';
import { photoHunt } from '../photo-hunt.js';
import { coinDrop } from '../coin-drop.js';

const SPOT = 'old-town-lipscani';
/** [opens, closes) in local hours; a range may run past midnight */
export const DAYLIFE_HOURS = { coffee: [8, 16], papanasi: [10, 2], busker: [10, 24], karaoke: [21, 3] };
export const openAt = (hour, [from, to]) => (from < to ? hour >= from && hour < to : hour >= from || hour < to % 24);
const hh = (h) => `${String(h % 24).padStart(2, '0')}:00`;
const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const bell = (u, rise = .35, fall = .3) => smooth(u / rise) * (1 - smooth((u - (1 - fall)) / fall));

// ---------------------------------------------------------------------------- props held in the hand
function propKit() {
    const materials = new Map();
    const mat = (colour, extra = {}) => { const key = colour + JSON.stringify(extra); if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: .7, ...extra })); return materials.get(key); };
    const mesh = (parent, geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.frustumCulled = false; parent.add(m); return m; };
    const cyl = (p, a, b, h, colour, x, y, z, n = 14, extra) => mesh(p, new THREE.CylinderGeometry(a, b, h, n), mat(colour, extra), x, y, z);
    const hand = (parent, x = 0, y = 0, z = 0) => {
        const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
        const arm = cyl(g, .048, .065, .28, '#a87555', 0, -.18, .09, 12); arm.rotation.x = -.6;
        mesh(g, new THREE.SphereGeometry(.066, 10, 6), mat('#c38d68'), 0, -.025, 0).scale.set(.78, 1.2, .65);
        for (let i = 0; i < 4; i++) { const f = cyl(g, .012, .014, .074, '#c38d68', -.033 + i * .021, .012, -.04, 6); f.rotation.x = .55; }
        return g;
    };
    return { mat, mesh, cyl, hand };
}

function coffeeProp(k) {
    // an espresso cup on its saucer, the saucer resting on the hand
    const root = new THREE.Group(); root.name = 'held-coffee'; root.visible = false;
    const cup = new THREE.Group(); root.add(cup); k.hand(cup, 0, -.012, .012);
    const china = { roughness: .32 };
    k.cyl(cup, .072, .05, .012, '#f3efe6', 0, .034, 0, 24, china); // saucer
    k.mesh(cup, new THREE.CylinderGeometry(.04, .028, .054, 20, 1, true), k.mat('#f3efe6', { ...china, side: THREE.DoubleSide }), 0, .068, 0);
    k.cyl(cup, .028, .028, .006, '#f3efe6', 0, .044, 0, 20, china);
    const handle = k.mesh(cup, new THREE.TorusGeometry(.015, .005, 6, 12, Math.PI), k.mat('#f3efe6', china), .04, .068, 0); handle.rotation.z = -Math.PI / 2;
    const coffee = k.mesh(cup, new THREE.CircleGeometry(.037, 20), k.mat('#3a2113', { roughness: .25 }), 0, .09, 0); coffee.rotation.x = -Math.PI / 2;
    const crema = k.mesh(cup, new THREE.RingGeometry(.024, .0365, 20), k.mat('#b98a52', { roughness: .4 }), 0, .0905, 0); crema.rotation.x = -Math.PI / 2;
    const spoon = new THREE.Group(); cup.add(spoon); spoon.position.set(-.045, .045, .03); spoon.rotation.set(0, .6, Math.PI / 2 - .12); // (lying on the saucer)
    k.cyl(spoon, .0025, .0025, .07, '#c9ccd0', 0, 0, 0, 6, { metalness: .8, roughness: .25 });
    k.mesh(spoon, new THREE.SphereGeometry(.009, 10, 6), k.mat('#c9ccd0', { metalness: .8, roughness: .25 }), 0, -.04, 0).scale.set(1, 1.5, .35);
    const steam = [];
    for (let i = 0; i < 3; i++) steam.push(k.mesh(cup, new THREE.SphereGeometry(.011, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), 0, .11, 0));
    return { root, cup, coffee, crema, steam };
}

function papanasiProp(k) {
    // two papanași on a plate: a fried ring, a small ball on top, sour cream and sour-cherry jam over both
    const root = new THREE.Group(); root.name = 'held-papanasi'; root.visible = false;
    const plate = new THREE.Group(); root.add(plate); k.hand(plate, 0, -.012, .012);
    k.cyl(plate, .105, .07, .014, '#f1ede4', 0, .034, 0, 28, { roughness: .32 });
    k.cyl(plate, .082, .082, .003, '#e7e2d6', 0, .0425, 0, 28, { roughness: .4 });
    const dough = k.mat('#c9853e', { roughness: .8 }), cream = k.mat('#f7f4ea', { roughness: .45 }), jam = k.mat('#7d1630', { roughness: .3 });
    const pieces = [-1, 1].map((side) => {
        const g = new THREE.Group(); g.position.set(side * .04, .044, side * .004); plate.add(g);
        const ring = k.mesh(g, new THREE.TorusGeometry(.021, .015, 8, 16), dough, 0, .014, 0); ring.rotation.x = Math.PI / 2;
        k.mesh(g, new THREE.SphereGeometry(.03, 12, 8), cream, 0, .028, 0).scale.set(1, .45, 1);
        k.mesh(g, new THREE.SphereGeometry(.017, 12, 8), dough, 0, .052, 0);
        k.mesh(g, new THREE.SphereGeometry(.019, 10, 8), jam, .004, .041, .012).scale.set(1.25, .4, 1);
        k.mesh(g, new THREE.SphereGeometry(.012, 8, 6), jam, -.018, .036, .014).scale.set(1, .4, 1.3);
        return g;
    });
    const fork = new THREE.Group(); plate.add(fork); fork.position.set(0, .05, .075); fork.rotation.set(0, .5, Math.PI / 2 - .08);
    k.cyl(fork, .0028, .0028, .1, '#c9ccd0', 0, 0, 0, 6, { metalness: .8, roughness: .25 });
    k.mesh(fork, new THREE.BoxGeometry(.016, .03, .002), k.mat('#c9ccd0', { metalness: .8, roughness: .25 }), 0, -.062, 0);
    return { root, plate, pieces };
}

function micProp(k) {
    const root = new THREE.Group(); root.name = 'held-microphone'; root.visible = false;
    const mic = new THREE.Group(); root.add(mic); k.hand(mic, 0, -.03, .012);
    k.cyl(mic, .017, .013, .17, '#1c1d20', 0, .04, 0, 12, { roughness: .4, metalness: .5 });
    k.mesh(mic, new THREE.SphereGeometry(.03, 14, 10), k.mat('#8d9197', { roughness: .35, metalness: .85 }), 0, .15, 0);
    k.cyl(mic, .019, .019, .012, '#c9a85a', 0, .125, 0, 12, { metalness: .7, roughness: .3 });
    return { root, mic };
}

// ---------------------------------------------------------------------------- a few steps with a held prop
// Each step runs its animation to the end before the next one is offered (as the Freddo shot does).
function heldSteps(ctx, flow, parking, s, o) {
    const put = () => { o.prop.root.visible = false; parking.add(o.prop.root); };
    return flow.begin(s, {
        title: o.title, help: o.help, action: o.steps[0].label,
        started(_s, r) { r.step = 0; r.t = 0; r.anim = false; r.intro = .4; r.progress.max = o.steps.length; r.status.textContent = o.intro; o.prop.root.visible = true; s.camera.add(o.prop.root); o.started?.(s, r); o.pose(r, 0); },
        key: o.key,
        actioned(_s, r) { if (r.anim || r.intro > 0 || (o.ready && !o.ready(r))) return; r.anim = true; r.t = 0; r.busy = true; r.status.textContent = o.steps[r.step].doing; },
        update(dt, _s, r) {
            r.intro = Math.max(0, r.intro - dt); r.clock = (r.clock || 0) + dt; let u = 0;
            if (r.anim) {
                r.t += dt; u = Math.min(1, r.t / o.steps[r.step].time);
                if (u >= 1) {
                    const done = o.steps[r.step].done; r.anim = false; r.busy = false; r.step++; u = 0;
                    if (r.step === o.steps.length) { flow.complete(); return; }
                    r.status.textContent = `${r.step}/${o.steps.length} · ${done}`; r.button.textContent = o.steps[r.step].label;
                }
            }
            o.prop.root.position.y = -.3 * (1 - smooth(1 - r.intro / .4)); o.pose(r, u); r.progress.value = r.step + u;
        },
        cancel() { put(); }, complete(_s) { put(); o.complete(_s); },
    });
}

// ---------------------------------------------------------------------------- karaoke
// "Lipscani refrain" (2026), an original eight-bar tune written for the game, CC0-1.0: no lyrics, no known melody.
// [semitones above A3, beats]; null is a breath.
export const KARAOKE_BEAT = 60 / 92;
export const KARAOKE_TUNE = [[0, 2], [4, 2], [7, 3], [null, 1], [9, 2], [7, 2], [4, 3], [null, 1], [5, 2], [9, 2], [12, 3], [null, 1], [9, 1], [7, 1], [4, 2], [2, 1], [0, 2], [null, 1]];
const KARAOKE_BASS = [110, 92.5, 146.83, 82.41], LEAD_IN = 4, PASS = .6, TOLERANCE = 1.6, LOW = -2, HIGH = 14;
const TUNE_BEATS = KARAOKE_TUNE.reduce((n, [, b]) => n + b, 0);
/** the note sounding at a beat counted from the first note (null in a breath, undefined outside the tune) */
export function karaokeNote(beat) { if (beat < 0) return undefined; let at = 0; for (const [note, beats] of KARAOKE_TUNE) { if (beat < at + beats) return note; at += beats; } return undefined; }
function karaokeVoice(sound) {
    if (!sound?.started || !sound.ctx || !sound.out) return null;
    const c = sound.ctx, out = c.createGain(); out.gain.value = .0001; out.connect(sound.out);
    const part = (type) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; g.gain.value = 0; o.connect(g); g.connect(out); o.start(); return { o, g }; };
    const lead = part('triangle'), guide = part('sine'), bass = part('sine'); let stopped = false;
    out.gain.setTargetAtTime(.55, c.currentTime, .05);
    return {
        set(pitch, note, bar, vibrato) {
            if (stopped) return; const now = c.currentTime, f = (p) => 220 * 2 ** (p / 12);
            lead.o.frequency.setTargetAtTime(f(pitch) * (1 + vibrato * .012), now, .02); lead.g.gain.setTargetAtTime(note == null ? 0 : .17, now, .04);
            if (note != null) guide.o.frequency.setTargetAtTime(f(note) * 2, now, .01); guide.g.gain.setTargetAtTime(note == null ? 0 : .045, now, .04);
            bass.o.frequency.setTargetAtTime(KARAOKE_BASS[Math.max(0, Math.min(3, bar))], now, .03); bass.g.gain.setTargetAtTime(.12, now, .08);
        },
        stop() { if (stopped) return; stopped = true; out.gain.setTargetAtTime(0, c.currentTime, .04); setTimeout(() => { for (const p of [lead, guide, bass]) { try { p.o.stop(); } catch { /* already stopped */ } p.o.disconnect(); p.g.disconnect(); } out.disconnect(); }, 250); },
    };
}

// ---------------------------------------------------------------------------- the scene's part
/**
 * @param ctx the Old Town scene context
 * @param {{ focused: (x: number, z: number) => boolean, carusel?: object, busker?: { x: number, z: number, crowd: [number, number] }, photoStart?: { x: number, z: number }, festoons?: { A: object, B: object, y: number }[] }} o
 */
export function buildOldTownDaylife(ctx, { focused, carusel, busker, photoStart, festoons = [] }) {
    const d = ctx.data, g = ctx.ground, flow = activityFlow(ctx), k = propKit();
    const parking = new THREE.Group(); parking.name = 'old-town-held-props'; ctx.add(parking);
    const props = { coffee: coffeeProp(k), papanasi: papanasiProp(k), mic: micProp(k) };
    for (const p of Object.values(props)) parking.add(p.root);
    let hour = 12, clockT = 0; const voices = new Set();
    ctx.onUpdate((dt, s) => { clockT -= dt; if (clockT <= 0) { hour = s._conditions().hour; clockT = 1; } });
    (ctx.extras.sceneCleanups ||= []).push(() => { for (const v of voices) v.stop(); voices.clear(); for (const p of Object.values(props)) { if (p.root.parent !== parking) { p.root.removeFromParent(); disposeTree(p.root); } } });

    /** the clear spot on the street in front of a real place: its facade toward the nearest pedestrian lane, then outward */
    const approach = (id) => {
        const poi = d.pois.find((p) => p.id === id); if (!poi) return null;
        let street = null;
        for (const w of d.ways) { if (!['pedestrian', 'living_street'].includes(w.k)) continue; const q = distPolyline(poi.x, poi.z, w.pts); if (!street || q.d < street.d) street = q; }
        const f = street && facadeToward(d, poi.x, poi.z, street.cx, street.cz); if (!f) return null;
        for (let distance = 2.4; distance <= 8; distance += .4) {
            const x = f.x + f.nx * distance, z = f.z + f.nz * distance;
            if (focused(x, z) && !collide(ctx.colliders, x, z, .45, g.heightAt(x, z) + .3)) return { poi, x, z, y: g.heightAt(x, z), facade: f };
        }
        return null;
    };
    const venue = (id, key, o) => {
        const a = approach(id); if (!a) return null;
        const open = () => openAt(hour, DAYLIFE_HOURS[key]);
        ctx.interactables.push({ x: a.x, z: a.z, y: a.y, r: 2.6, source: id, activity: o.activity,
            label: () => (open() ? o.label : `${o.name} · closed · opens at ${hh(DAYLIFE_HOURS[key][0])}`),
            cond: (s) => !flow.active && !ctx.extras.venueActivities?.active && s.spot.id === SPOT, tourAvailable: open,
            use(s) { if (!open()) { s.ui.toast(`${o.name} is closed`, `${o.closed} Open ${hh(DAYLIFE_HOURS[key][0])}–${hh(DAYLIFE_HOURS[key][1])}.`); return; } o.start(s, a); } });
        return a;
    };
    const places = {};

    // -- a coffee on Lipscani (the two cafés OSM lists further east, Coffee & Travel and Ted's, have closed)
    places.coffee = venue('n6324709232', 'coffee', { name: 'Gregory\'s', activity: 'lipscani-coffee', label: 'Have a coffee · Gregory\'s', closed: 'The café closes in the afternoon.',
        start: (s) => heldSteps(ctx, flow, parking, s, {
            prop: props.coffee, title: '☕ Gregory\'s · Strada Lipscani 27', help: 'A coffee on Lipscani, the way the street starts its day. Three small actions; you can look around.',
            intro: 'Hot, with a ring of crema.',
            steps: [{ label: 'Blow on it (E)', doing: 'Too hot yet…', done: 'Cool enough to drink.', time: 1.8 }, { label: 'Take a sip (E)', doing: 'Lift, sip… and lower.', done: 'Half left. Lipscani walks past.', time: 2.2 }, { label: 'Finish it (E)', doing: 'The last of it.', done: '', time: 2.2 }],
            pose(r, u) {
                const p = props.coffee, level = r.step < 1 ? 1 : r.step === 1 ? 1 - .5 * smooth((u - .35) / .3) : .5 - .46 * smooth((u - .35) / .3);
                const lift = r.anim ? bell(u) : 0, sip = r.step > 0 ? lift : lift * .55, narrow = s.camera.aspect < .75 ? .05 : .15;
                p.cup.position.set(narrow - narrow * .85 * sip, -.42 + .24 * sip, -.72 + .24 * sip); p.cup.rotation.set((r.step > 0 ? .55 : .12) * lift, 0, 0);
                p.coffee.position.y = p.crema.position.y = .05 + .04 * level; p.coffee.scale.setScalar(.78 + .22 * level); p.crema.scale.setScalar(.78 + .22 * level); p.crema.visible = r.step < 2;
                // steam: thick while it is too hot, blown away during the first step, a wisp afterwards
                const hot = r.step === 0 ? 1 - .75 * smooth(u / .8) : .25, blown = r.step === 0 && r.anim ? Math.sin(u * Math.PI) : 0;
                p.steam.forEach((m, i) => { const t = ((r.clock || 0) * .45 + i / 3) % 1; m.position.set(Math.sin(t * 5 + i * 2) * .012, .1 + t * .1, Math.cos(t * 4 + i) * .01 - blown * t * .12); m.scale.setScalar(.7 + t * 1.8); m.material.opacity = level > .2 ? .34 * hot * Math.sin(t * Math.PI) : 0; });
            },
            complete: (s2) => bucActivity(s2, SPOT, 'lipscani-coffee', '☕ O cafea, vă rog', 'A coffee finished at Gregory\'s, Strada Lipscani 27.'),
        }) });

    // -- papanași at Jack's Pub: the dessert every Old Town menu ends with
    places.papanasi = venue('n1416626264', 'papanasi', { name: 'Jack\'s Pub', activity: 'jacks-papanasi', label: 'Eat papanași · Jack\'s Pub', closed: 'The kitchen is shut for the night.',
        start: (s) => heldSteps(ctx, flow, parking, s, {
            prop: props.papanasi, title: '🍩 Jack\'s Pub · Strada Lipscani 45', help: 'Papanași: fried cheese doughnuts under sour cream and sour-cherry jam, always served in pairs. Three forkfuls; you can look around.',
            intro: 'Two, still warm. Smântână and sour-cherry jam.',
            steps: [{ label: 'Take a forkful (E)', doing: 'Mmm…', done: 'One left, and a half.', time: 1.9 }, { label: 'Another (E)', doing: 'Cream, jam, warm dough.', done: 'One left.', time: 1.9 }, { label: 'Finish the plate (E)', doing: 'The last one.', done: '', time: 2.1 }],
            pose(r, u) {
                const p = props.papanasi, lift = r.anim ? bell(u) : 0, narrow = s.camera.aspect < .75 ? .04 : .14, eaten = r.step + (r.anim ? smooth((u - .35) / .3) : 0);
                p.plate.position.set(narrow - narrow * .7 * lift, -.42 + .17 * lift, -.72 + .2 * lift); p.plate.rotation.set(.28 + .22 * lift, 0, 0);
                p.pieces[1].scale.setScalar(Math.max(.001, 1 - Math.min(1, eaten / 1.5))); p.pieces[0].scale.setScalar(Math.max(.001, 1 - Math.max(0, eaten - 1.5) / 1.5));
            },
            complete: (s2) => bucActivity(s2, SPOT, 'jacks-papanasi', '🍩 Poftă bună!', 'Two papanași finished at Jack\'s Pub, Strada Lipscani 45.'),
        }) });

    // -- karaoke at Mojo
    places.karaoke = venue('n1731040985', 'karaoke', { name: 'Mojo Music Club', activity: 'mojo-karaoke', label: 'Sing karaoke · Mojo Music Club', closed: 'Karaoke starts at 21:00, every night.',
        start: (s) => {
            const p = props.mic; let voice = null;
            const end = () => { p.root.visible = false; parking.add(p.root); if (voice) { voice.stop(); voices.delete(voice); voice = null; } };
            return flow.begin(s, {
                title: '🎤 Mojo Music Club · Strada Lipscani 69', action: 'Start singing (E)',
                help: 'Keep your voice on the gold notes: W / S or ↑ / ↓, or hold the arrows. Stay in tune for most of the tune. The karaoke floor upstairs is not modelled: you sing from the door.',
                started(_s, r) {
                    r.phase = 'ready'; r.pitch = 4; r.up = r.down = false; r.hit = r.sung = 0; r.beat = -LEAD_IN; r.clock = 0;
                    p.root.visible = true; s.camera.add(p.root); r.status.textContent = 'Eight bars. The gold line shows where the tune goes.';
                    const lane = canvas(340, 110); lane.style.cssText = 'display:block;width:100%;height:auto;margin:8px 0;border-radius:8px;background:#11161b'; r.ui.querySelector('nav').before(lane); r.lane = lane.getContext('2d');
                    const nav = r.ui.querySelector('nav');
                    for (const [dir, text] of [['up', '▲ Higher'], ['down', '▼ Lower']]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.pitch = dir;
                        const set = (v) => (e) => { e.preventDefault(); r[dir] = v; }; b.addEventListener('pointerdown', set(true)); for (const type of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(type, set(false));
                        nav.insertBefore(b, nav.querySelector('[data-leave]')); }
                },
                key(e, r) { const dir = ['KeyW', 'ArrowUp'].includes(e.code) ? 'up' : ['KeyS', 'ArrowDown'].includes(e.code) ? 'down' : null; if (!dir) return false; r[dir] = e.type === 'keydown'; return true; },
                actioned(_s, r) { if (r.phase !== 'ready') return; r.phase = 'sing'; r.button.textContent = 'Singing…'; r.beat = -LEAD_IN; r.hit = r.sung = 0; r.busy = true; if (!voice) { voice = karaokeVoice(s.sound); if (voice) voices.add(voice); } r.status.textContent = 'Four beats in…'; },
                update(dt, _s, r) {
                    r.clock += dt; r.pitch = Math.max(LOW, Math.min(HIGH, r.pitch + ((r.up ? 1 : 0) - (r.down ? 1 : 0)) * 15 * dt));
                    let note; const singing = r.phase === 'sing';
                    if (singing) {
                        r.beat += dt / KARAOKE_BEAT; note = karaokeNote(r.beat);
                        if (note != null) { r.sung += dt; if (Math.abs(r.pitch - note) <= TOLERANCE) r.hit += dt; }
                        voice?.set(r.pitch, r.beat < 0 ? null : note ?? null, Math.floor(Math.max(0, r.beat) / 8), Math.sin(r.clock * 34));
                        if (r.beat >= 0) r.status.textContent = `${Math.round(100 * r.hit / Math.max(.01, r.sung))}% in tune`;
                        r.progress.value = Math.max(0, r.beat) / TUNE_BEATS;
                        if (r.beat >= TUNE_BEATS) {
                            const score = r.hit / Math.max(.01, r.sung); r.score = score; voice?.stop(); voices.delete(voice); voice = null;
                            if (score >= PASS) { flow.complete(); return; }
                            r.phase = 'ready'; r.busy = false; r.beat = -LEAD_IN; r.button.textContent = 'Sing it again (E)'; r.status.textContent = `${Math.round(score * 100)}% in tune: the room wants ${Math.round(PASS * 100)}%. Once more?`;
                        }
                    }
                    // the lane: the next six beats scroll toward the white line; the dot is your voice
                    const c = r.lane, W = 340, H = 110, X0 = 70, PX = 42, Y = (v) => H - 10 - (v - LOW) / (HIGH - LOW) * (H - 20); c.clearRect(0, 0, W, H);
                    c.fillStyle = '#1b232b'; for (let i = 0; i < 8; i++) c.fillRect(0, Y(i * 2) - .5, W, 1);
                    let at = 0; for (const [n, beats] of KARAOKE_TUNE) { const x = X0 + (at - r.beat) * PX, w = beats * PX - 4; if (n != null && x + w > 0 && x < W) { c.fillStyle = singing && r.beat >= at && r.beat < at + beats ? '#ffd36b' : '#8f7a45'; c.beginPath(); c.roundRect(x, Y(n) - 6, w, 12, 6); c.fill(); } at += beats; }
                    c.fillStyle = '#ffffff55'; c.fillRect(X0 - 1, 0, 2, H);
                    const on = note != null && Math.abs(r.pitch - note) <= TOLERANCE; c.fillStyle = on ? '#9bffbe' : '#ffffff'; c.beginPath(); c.arc(X0, Y(r.pitch), on ? 8 : 6, 0, 7); c.fill();
                    if (singing && r.beat < 0) { c.fillStyle = '#ffd36b'; c.font = '700 26px system-ui'; c.fillText(String(Math.ceil(-r.beat)), 18, 38); }
                    const sway = singing && note != null ? Math.sin(r.clock * 5) * .012 : 0, narrow = s.camera.aspect < .75 ? .07 : .17;
                    p.mic.position.set(narrow, -.4 + (singing ? .1 : 0) + sway, -.68 + (singing ? .08 : 0)); p.mic.rotation.set(-.3, 0, -.2);
                },
                cancel() { end(); },
                complete(s2) { end(); bucActivity(s2, SPOT, 'mojo-karaoke', '🎤 Bis! Bis!', 'You held the tune at Mojo Music Club, Strada Lipscani 69. The room wants another.'); },
            });
        } });

    // -- a coin for the busker: the guitar case lies open in front of the busker the lane already had
    if (busker && focused(busker.x, busker.z)) {
        const [wx, wz] = busker.crowd, L = Math.hypot(wx - busker.x, wz - busker.z) || 1, ux = (wx - busker.x) / L, uz = (wz - busker.z) / L;
        const cx = busker.x + ux * 1.15, cz = busker.z + uz * 1.15, y = g.heightAt(cx, cz), yaw = Math.atan2(ux, uz) + Math.PI / 2, b = new GeoBatch();
        b.box(cx, y, cz, .36, .09, 1.02, '#1d1b1a', 'plastic', yaw); b.box(cx, y + .09, cz, .3, .012, .96, '#7a2230', 'fabric', yaw);
        b.box(cx - ux * .3, y, cz - uz * .3, .04, .34, 1.02, '#1d1b1a', 'plastic', yaw); // (the lid, standing open behind)
        for (let i = 0; i < 7; i++) { const along = (i - 3) * .11, across = ((i * 37) % 5 - 2) * .04; b.cyl(cx - uz * along + ux * across, y + .102, cz + ux * along + uz * across, .013, .004, i % 2 ? '#d7ad55' : '#c9ccd0', 'metal', 10); }
        ctx.add(b.build('busker-guitar-case', { castShadow: false }));
        const open = () => openAt(hour, DAYLIFE_HOURS.busker);
        const toss = coinDrop(ctx, new THREE.Vector3(cx, y + .11, cz), { title: '🎸 A coin for the busker', action: 'Toss the coin (E)', arc: .5,
            help: 'Street musicians are a familiar sight on Lipscani. Toss a coin into the open guitar case; Leave or Esc keeps it.',
            onDone: (s) => bucActivity(s, SPOT, 'lipscani-busker', '🎸 Mulțumesc!', 'A coin in the guitar case on Strada Lipscani. The busker nods and keeps playing.') });
        const ix = cx + ux * 1.3, iz = cz + uz * 1.3;
        ctx.interactables.push({ x: ix, z: iz, y: g.heightAt(ix, iz), r: 2.4, activity: 'lipscani-busker', label: 'Toss a coin to the busker', tourAvailable: open,
            cond: (s) => open() && !flow.active && !ctx.extras.venueActivities?.active && s.spot.id === SPOT, use: (s) => toss.start(s) });
        places.busker = { x: ix, z: iz, case: { x: cx, z: cz, y }, toss };
    }

    // -- a photo walk: three details that are really there, framed from the lanes
    {
        const targets = [];
        const fr = ctx.extras.freddoFrontage;
        if (fr && Number.isFinite(fr.baseY)) targets.push({ label: 'Freddo · the glazed front on Smârdan', x: fr.a[0] + fr.ux * fr.L / 2 + fr.nx * .1, y: fr.baseY + 2.3, z: fr.a[1] + fr.uz * fr.L / 2 + fr.nz * .1, radius: 2.4, surfaceTolerance: 4 });
        if (carusel) { const f = carusel.front; targets.push({ label: 'Cărturești Carusel · the giant arch', x: f.x + f.nx * .1, y: carusel.sourceDatum + 10.5, z: f.z + f.nz * .1, radius: 2.6, surfaceTolerance: 4 }); }
        // (the Hanul cu Tei gateway would be the third, but the scene does not build it at present: its group is empty)
        const mid = (q) => [(q.A.x + q.B.x) / 2, (q.A.z + q.B.z) / 2], line = festoons.filter((q) => focused(...mid(q))).sort((a, c) => Math.hypot(mid(a)[0] - 140, mid(a)[1] + 58) - Math.hypot(mid(c)[0] - 140, mid(c)[1] + 58))[0];
        if (line) { const span = Math.hypot(line.B.x - line.A.x, line.B.z - line.A.z); targets.push({ label: 'The string lights over Lipscani', x: mid(line)[0], y: line.y - .27 - span * .035, z: mid(line)[1], radius: 1.7, minDistance: 4 }); }
        const start = photoStart || { x: 128, z: -56.5 };
        if (targets.length >= 2) places.photo = { targets, hunt: photoHunt(ctx, { x: start.x, z: start.z, r: 2.6, spot: SPOT, title: 'Photo walk · Old Town details', targets,
            unavailable: 'Three details of the old merchants\' quarter, all seen from the street.',
            onDone: (s) => bucActivity(s, SPOT, 'lipscani-photo-walk', '📸 Three frames of Lipscani', 'You framed Freddo’s glazed front, the Carusel arch and the string lights over Lipscani from the public lanes.') }) };
    }
    ctx.extras.oldTownDaylife = { places, props, flow, get hour() { return hour; }, hours: DAYLIFE_HOURS };
    return ctx.extras.oldTownDaylife;
}
