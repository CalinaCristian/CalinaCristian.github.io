// ============================================================================
//  Romanian Athenaeum: an evening concert in the Great Hall, and when (not) to applaud (owner, 2026-11-15: real
//  activities; framing the portico is not one). The Athenaeum is the home of the George Enescu Philharmonic; tickets
//  are sold online and at the Athenaeum box office (AGERPRES, 12 Sep 2025: 2025/26 season, Tue–Fri 12:00–19:00 and on
//  concert days at weekends), and the symphonic concerts start at 19:00 (usually Thursday and Friday). In the game the
//  doors open from 18:00 to 21:00 by the in-game hour; days of the week are not modelled.
//
//  You take a seat in the stalls; the orchestra tunes, the conductor walks on, and a short three-movement piece is
//  played (an original procedural score, not a recording or a known work). E applauds: welcome the conductor, keep
//  quiet between the movements (the baton stays up), wait for the baton to come down after the last chord, then
//  applaud — keep it going through the bows and you may get an encore. Leave or Esc walks out anytime.
//
//  The hall is a remote interior (like the hidden bar's room) drawn from published descriptions: a round hall under a
//  dome, columns with boxes between them, the fresco band under the dome (Costin Petrescu, 1933–38; drawn here as a
//  procedural impression, not a copy), red stalls, the stage on one side. Sizes and colours are estimates.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { activityFlow } from '../participation.js';
import { timedActivity } from '../park-hours.js';
import { declareInterior } from '../precip-shelter.js';
import { makeCrowd, dressFor } from '../../crowd.js';
import { rng } from '../kit.js';
import { createConcert, ENCORE_CLAPS } from '../concert-etiquette.js';
import { bucActivity } from '../buc.js';

export const CONCERT_HOURS = { open: 18, close: 21, note: 'Symphonic concerts at the Athenaeum start at 19:00 (George Enescu Philharmonic); the box office sells tickets until the start.' };
const X0 = 7200, Z0 = 7200, R = 14;

// ---------------------------------------------------------------- an original procedural score (WebAudio; CC0)
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCORE = {
    tuning: (t) => [[0, 'oboe', [69], 2.6], [0.6, 'pad', [57, 64, 69], 2.4, 0.25]],
    m1: (t) => { const out = [], ch = [[50, 57, 62, 66], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66], [47, 54, 59, 62], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66]]; ch.forEach((c, k) => { out.push([k * 1.1, 'pad', c, 1.15, 0.5]); for (let q = 0; q < 4; q++) out.push([k * 1.1 + q * 0.275, 'lead', [c[(q % 3) + 1] + 12], 0.25, 0.55]); }); return out; },
    m2: (t) => { const out = [], ch = [[47, 54, 59, 62], [43, 50, 55, 59], [50, 57, 62, 66], [42, 49, 54, 61]]; ch.forEach((c, k) => { out.push([k * 2.2, 'pad', c, 2.3, 0.45]); out.push([k * 2.2 + 0.3, 'lead', [c[3] + 12], 1.6, 0.4]); out.push([k * 2.2 + 1.3, 'lead', [c[2] + 12], 0.8, 0.35]); }); return out; },
    m3: (t) => { const out = [], ch = [[50, 57, 62, 66], [55, 59, 62, 67], [52, 57, 61, 64], [57, 61, 64, 69], [50, 57, 62, 66], [55, 59, 62, 67], [57, 61, 64, 69]]; ch.forEach((c, k) => { out.push([k * 1.0, 'pad', c, 1.05, 0.55]); for (let q = 0; q < 6; q++) out.push([k * 1.0 + q * 0.166, 'lead', [c[(q % 3) + 1] + 12 + (q % 2 ? 0 : 7)], 0.15, 0.45]); if (k % 2 === 0) out.push([k * 1.0, 'timp', [38], 0.6, 0.6]); });
        out.push([7.1, 'pad', [38, 50, 57, 62, 66, 74], 2.6, 0.9]); for (let q = 0; q < 10; q++) out.push([7.1 + q * 0.07, 'timp', [38], 0.3, 0.5]); return out; },
    encore: (t) => { const out = [], ch = [[55, 62, 67, 71], [60, 64, 67, 72], [62, 66, 69, 74], [55, 62, 67, 71]]; ch.forEach((c, k) => { out.push([k * 0.8, 'pad', c, 0.85, 0.5]); for (let q = 0; q < 4; q++) out.push([k * 0.8 + q * 0.2, 'lead', [c[(q + k) % 4] + 12], 0.18, 0.5]); }); out.push([3.4, 'pad', [43, 55, 62, 67, 71], 1.8, 0.8]); return out; },
};
function concertAudio(sound) {
    const ac = sound?.ctx; if (!ac || !sound.out) return null;
    const bus = ac.createGain(); bus.gain.value = 0.55; bus.connect(sound.out); const hall = ac.createBiquadFilter(); hall.type = 'lowpass'; hall.frequency.value = 3200; hall.connect(bus);
    const nodes = new Set(), keep = (n, end) => { nodes.add(n); n.onended = () => nodes.delete(n); n.stop(end); };
    const voice = (type, f, t0, dur, gain, detune = 0) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(gn); gn.connect(hall);
        gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.25, dur * 0.3)); gn.gain.setValueAtTime(gain, t0 + dur * 0.7); gn.gain.exponentialRampToValueAtTime(0.0005, t0 + dur + 0.5); o.start(t0); keep(o, t0 + dur + 0.6); };
    // applause: a looped buffer of many short hand claps
    const clapBuf = (() => { const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let k = 0; k < 520; k++) { const at = Math.floor(Math.random() * (n - 800)), a = 0.2 + Math.random() * 0.5; for (let i = 0; i < 600; i++) d[at + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / 90); } return b; })();
    let applause = null;
    return {
        play(name) { const plan = SCORE[name]?.(); if (!plan) return; const t = ac.currentTime + 0.05;
            for (const [at, kind, notes, dur, v = 0.5] of plan) for (const n of notes) {
                if (kind === 'pad') { voice('sawtooth', midi(n), t + at, dur, 0.018 * v, -6); voice('sawtooth', midi(n), t + at, dur, 0.018 * v, 7); }
                else if (kind === 'lead') voice('triangle', midi(n), t + at, dur, 0.05 * v);
                else if (kind === 'oboe') { voice('square', midi(n), t + at, dur, 0.012); voice('triangle', midi(n), t + at, dur, 0.03); }
                else if (kind === 'timp') { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(midi(n) * 1.4, t + at); o.frequency.exponentialRampToValueAtTime(midi(n), t + at + 0.1); o.connect(gn); gn.connect(hall); gn.gain.setValueAtTime(0.25 * v, t + at); gn.gain.exponentialRampToValueAtTime(0.0005, t + at + dur); o.start(t + at); keep(o, t + at + dur + 0.05); }
            } },
        applause(level) { // 0 … 1, ramps
            if (!applause && level > 0) { const src = ac.createBufferSource(), gn = ac.createGain(), f = ac.createBiquadFilter(); src.buffer = clapBuf; src.loop = true; f.type = 'highpass'; f.frequency.value = 700; src.connect(f); f.connect(gn); gn.connect(bus); gn.gain.value = 0; src.start(); applause = { src, gn }; nodes.add(src); }
            if (applause) applause.gn.gain.setTargetAtTime(level * 0.9, ac.currentTime, 0.25);
        },
        clap() { const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = clapBuf; src.connect(gn); gn.connect(bus); gn.gain.value = 1.2; const off = Math.random() * 1.5; src.start(ac.currentTime, off, 0.06); nodes.add(src); },
        stop() { bus.gain.setTargetAtTime(0, ac.currentTime, 0.15); setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* done */ } } nodes.clear(); bus.disconnect(); }, 600); },
    };
}

// ---------------------------------------------------------------- the hall
function frescoTexture() {
    const c = document.createElement('canvas'); c.width = 4096; c.height = 256; const x = c.getContext('2d'), r = rng(1933);
    const sky = x.createLinearGradient(0, 0, 0, 256); sky.addColorStop(0, '#c9b98f'); sky.addColorStop(1, '#8f7a55'); x.fillStyle = sky; x.fillRect(0, 0, 4096, 256);
    for (let i = 0; i < 26; i++) { x.fillStyle = `hsla(${30 + r() * 30}, 30%, ${55 + r() * 15}%, 0.5)`; x.fillRect(i * 158 + r() * 30, 60 + r() * 40, 120 + r() * 60, 150); } // (landscape and architecture patches)
    for (let i = 0; i < 160; i++) { const px = r() * 4096, h = 70 + r() * 70, w = h * 0.28; x.fillStyle = ['#6b3b2a', '#3e4a5c', '#7a6a3a', '#5a2f3a', '#2f4a3a', '#8a5a3a'][Math.floor(r() * 6)];
        x.beginPath(); x.ellipse(px, 236 - h * 0.45, w / 2, h * 0.42, 0, 0, 7); x.fill(); x.fillStyle = '#d9b48c'; x.beginPath(); x.arc(px, 236 - h * 0.92, w * 0.28, 0, 7); x.fill(); } // figures in procession
    x.fillStyle = '#c8a24a'; x.fillRect(0, 0, 4096, 10); x.fillRect(0, 246, 4096, 10);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function domeTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f6ead0'); gr.addColorStop(1, '#d9c39a'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 256);
    x.fillStyle = '#c49a3e'; for (let i = 0; i < 24; i++) x.fillRect(i * 1024 / 24 - 4, 0, 8, 256); for (let i = 0; i < 24; i++) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(i * 1024 / 24 + 21, 40 + k * 55, 9, 0, 7); x.fill(); } // gilded ribs and rosettes
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function athenaeumConcert(ctx, { door }) {
    const g = ctx.ground, flow = activityFlow(ctx), Y = g.heightAt(X0, Z0) + 0.03;
    const room = new THREE.Group(); room.name = 'athenaeum-great-hall'; room.visible = false; ctx.add(room);
    const P = (x, z, y = 0) => new THREE.Vector3(X0 + x, Y + y, Z0 + z); // hall frame: the stage to the north (−z)
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: c, emissiveIntensity: 0.35, ...o });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.copy(P(x, z, y)); room.add(m); return m; };
    add(new THREE.CircleGeometry(R, 64).rotateX(-Math.PI / 2), M('#6a1f22', { roughness: 0.95 }), 0, 0, 0);
    add(new THREE.CylinderGeometry(R, R, 12, 72, 1, true), M('#efe3c8', { side: THREE.BackSide }), 0, 6, 0);
    add(new THREE.CylinderGeometry(R - 0.06, R - 0.06, 3, 96, 1, true), M('#ffffff', { map: frescoTexture(), side: THREE.BackSide, emissiveIntensity: 0.25, emissive: '#806848' }), 0, 10.5, 0);
    const dome = add(new THREE.SphereGeometry(R, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffffff', { map: domeTexture(), side: THREE.BackSide, emissive: '#7a6a50', emissiveIntensity: 0.35 }), 0, 12, 0); dome.scale.y = 0.5;
    add(new THREE.CircleGeometry(2.4, 32).rotateX(Math.PI / 2), M('#fff4d8', { emissive: '#fff0c8', emissiveIntensity: 1.1 }), 0, 12 + R * 0.5 - 0.08, 0);
    // columns (pink marble, gilded capitals) round the hall with the boxes between them, except behind the stage
    const colM = M('#d8b0a2', { roughness: 0.35 }), gold = M('#c9a24a', { metalness: 0.6, roughness: 0.35, emissiveIntensity: 0.3 }), red = M('#7a1f26');
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, x = Math.sin(a) * (R - 0.5), z = Math.cos(a) * (R - 0.5); if (z < -7) continue; add(new THREE.CylinderGeometry(0.28, 0.32, 7.2, 14), colM, x, 4.6, z); add(new THREE.BoxGeometry(0.8, 0.35, 0.8), gold, x, 8.35, z); }
    for (const [y, h] of [[3.6, 1.0], [6.3, 0.9]]) { const front = add(new THREE.CylinderGeometry(R - 1.4, R - 1.4, h, 72, 1, true, -Math.PI * 0.62, Math.PI * 1.24), red, 0, y, 0); front.material = red.clone(); front.material.side = THREE.DoubleSide; add(new THREE.CylinderGeometry(R - 1.38, R - 1.38, 0.1, 72, 1, true, -Math.PI * 0.62, Math.PI * 1.24), gold, 0, y + h / 2, 0); }
    // the chandelier
    add(new THREE.SphereGeometry(0.7, 16, 10), gold, 0, 10.4, 0); { const bulbs = M('#fff2c4', { emissive: '#ffe6a0', emissiveIntensity: 2 }); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; add(new THREE.SphereGeometry(0.11, 8, 6), bulbs, Math.sin(a) * 1.6, 9.9, Math.cos(a) * 1.6); } }
    // the stage (a half disc to the north) with a red backdrop
    const stage = add(new THREE.CylinderGeometry(8.6, 8.6, 1.0, 48, 1, false, Math.PI / 2, Math.PI), M('#5a3a24', { roughness: 0.5 }), 0, 0.5, -4.6);
    add(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 8, 48, 1, true, Math.PI * 0.72, Math.PI * 0.56), M('#5a1820', { side: THREE.BackSide }), 0, 4, 0); void stage;
    add(new THREE.BoxGeometry(0.9, 0.3, 0.9), M('#3a2a1e'), 0, 1.15, -5.0); // the podium
    // seats in the stalls: arcs facing the stage; the player's seat is kept free (row 4, centre)
    const seats = [], seatAt = { x: 0, z: 0 };
    for (let rI = 0; rI < 9; rI++) { const rr = 5.2 + rI * 1.0, n = Math.floor(rr * 2.0 / 0.62); for (let k = 0; k <= n; k++) { const a = -1.0 + 2.0 * k / n, x = Math.sin(a) * rr, z = -4.6 + Math.cos(a) * rr; if (Math.hypot(x, z) > R - 1.8 || Math.abs(x) < 0.5 && Math.abs(a) < 0.04 && rI === 3) { if (rI === 3 && Math.abs(x) < 0.5) { seatAt.x = x; seatAt.z = z; seatAt.yaw = Math.atan2(-x, -(z + 4.6)); seatAt.view = Math.atan2(x, z + 4.6); } continue; } seats.push({ x, z, yaw: Math.atan2(-x, -(z + 4.6)) }); } }
    { const velvet = M('#8a1f2a', { roughness: 0.9 }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), all = [...seats, seatAt];
        for (const [geo, back, y] of [[new THREE.BoxGeometry(0.52, 0.42, 0.5), 0, 0.21], [new THREE.BoxGeometry(0.52, 0.55, 0.08), 0.28, 0.62]]) { // cushion and backrest
            const im = new THREE.InstancedMesh(geo, velvet, all.length); all.forEach((s2, i) => { const bx = -Math.sin(s2.yaw) * back, bz = -Math.cos(s2.yaw) * back; m4.compose(P(s2.x + bx, s2.z + bz, y), q.setFromEuler(e.set(0, s2.yaw, 0)), one); im.setMatrixAt(i, m4); }); im.name = 'athenaeum-stalls'; room.add(im); } }
    // people: the audience (most seats), the orchestra on stage, the conductor
    const r = rng(1888), people = makeCrowd({ max: 260, city: 'bucharest', season: 'winter', rng: r, castShadow: false }); room.add(people.object);
    const aud = seats.filter(() => r() < 0.82).map((s2) => ({ ...s2, stand: r() < 0.45 })), band = [];
    for (const [rad, n] of [[2.0, 7], [3.1, 10], [4.2, 12], [5.3, 9]]) for (let k = 0; k < n; k++) { const a = -1.2 + 2.4 * k / (n - 1), x = Math.sin(a) * rad, z = -5.0 - Math.cos(a) * rad; band.push({ x, z, yaw: Math.atan2(x, z + 5.0) }); } // (crowd yaw: facing the conductor)
    const conductor = { x: 0, z: -5.0 };
    let k = 0; const dress = (black) => { const o = dressFor('bucharest', 'winter', null, r); o.flags = 0; if (black) { o.top = '#14161a'; o.bottom = '#14161a'; } return o; };
    aud.forEach((a) => { a.i = k++; people.dress(a.i, dress(false)); }); band.forEach((b) => { b.i = k++; people.dress(b.i, dress(true)); }); conductor.i = k++; people.dress(conductor.i, dress(true)); people.count = k;
    { const brown = M('#6a3a1e', { roughness: 0.5 }); band.forEach((b, i) => { if (b.x > 1.2 && Math.hypot(b.x, b.z + 5) > 2.5 && i % 2) add(new THREE.BoxGeometry(0.4, 1.1, 0.22), brown, b.x + 0.3, 1.55, b.z); }); for (const x of [-1.2, 0, 1.2]) add(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 16), M('#b06a2a', { metalness: 0.7, roughness: 0.3 }), x, 1.3, -11.2); }
    const posePeople = (snap, t) => {
        const st2 = snap?.state, cheering = st2 === 'ovation' || st2 === 'bows';
        for (const a of aud) people.set(a.i, { x: P(a.x, a.z).x, y: Y, z: P(a.x, a.z).z, yaw: a.yaw + Math.PI, pose: cheering && a.stand && st2 === 'bows' ? 'cheer' : 'sit', scale: 0.98 });
        for (const b of band) people.set(b.i, { x: P(b.x, b.z).x, y: Y + 1.0, z: P(b.x, b.z).z, yaw: b.yaw, pose: snap?.music ? 'play' : 'sit', phase: t * 3 + b.i });
        const on = st2 && st2 !== 'tuning', faceHall = cheering || st2 === 'end';
        people.set(conductor.i, { x: P(0, on ? conductor.z : -7.8).x, y: Y + 1.3, z: P(0, on ? conductor.z : -7.8).z, yaw: faceHall ? Math.PI : 0, pose: st2 === 'bows' ? 'wave' : (snap?.music || st2 === 'pause1' || st2 === 'pause2' || st2 === 'hold') ? 'point' : 'stand', scale: 1.02 });
    };
    posePeople(null, 0);
    for (const [x, y, z, k2] of [[0, 9.5, 2, 60], [0, 6, -6, 40], [-6, 6, 3, 25], [6, 6, 3, 25]]) { const l = new THREE.PointLight('#ffe9c6', k2, 22, 1.4); l.position.copy(P(x, z, y)); room.add(l); }
    declareInterior(ctx, { box: { x0: X0 - R, z0: Z0 - R, x1: X0 + R, z1: Z0 + R }, y0: Y - 1, y1: Y + 20, pad: 1, name: 'athenaeum-hall' });
    // ---------------------------------------------------------------- the visit
    let st = null, last = null;
    const WORDS = { tuning: 'The oboe gives the A; the orchestra tunes.', entrance: 'The conductor walks on.', m1: 'I. Allegro', pause1: 'The baton stays up…', m2: 'II. Adagio', pause2: 'The baton stays up…', m3: 'III. Finale', hold: 'The last chord dies away; the baton is still up…', ovation: 'The baton comes down.', bows: 'Bows.', encore: 'An encore!', end: '' };
    const FAUX = { between: 'Shhh! — between movements: the piece isn\'t over.', during: 'Shhh! — the orchestra is playing.', 'too-soon': 'Shhh! — too soon: wait for the baton to come down.' };
    const say = (r, text) => { r.status.textContent = text; };
    const stop = (s) => { if (!st) return; st.audio?.stop(); st = null; room.visible = false; s.ctl.enter(door.x, door.z, door.heading ?? 0, door.y); s.returnFocus?.(); };
    const restart = (r) => { st.audio?.stop(); st.audio = concertAudio(st.s.sound); st.concert = createConcert(); st.audio?.play('tuning'); r.button.textContent = 'Applaud (E)'; r.busy = false; say(r, WORDS.tuning); };
    const start = (s) => flow.begin(s, {
        title: '🎻 A concert at the Athenaeum', action: 'Applaud (E)', cameraRide: true,
        help: 'You have a seat in the stalls. E applauds: welcome the conductor, stay quiet between the movements (the baton stays up), wait for the baton to come down after the last chord, then applaud — and keep it going through the bows. Leave or Esc walks out.',
        started(s2, r) { room.visible = true; st = { s: s2, look: 0, pitch: 0.06, t: 0 }; r.progress.max = 1; restart(r); },
        actioned(s2, r) {
            if (!st) return;
            const sn = st.concert.snapshot();
            if (sn.state === 'end') { restart(r); return; }
            const v = st.concert.clap(); st.audio?.clap(); st.clapT = 0.3;
            if (FAUX[v]) { st.fauxT = st.t; s2.ui.toast('🤫 Shhh!', FAUX[v].replace(/^Shhh! — /, '')); say(r, FAUX[v]); }
            else if (v === 'welcome') say(r, 'You welcome the conductor with the hall.');
            else if (v === 'bravo') say(r, sn.endClaps + 1 >= ENCORE_CLAPS ? 'Bravo! The hall won\'t stop — maybe an encore…' : 'Bravo!');
        },
        update(dt, s2, r) {
            if (!st) return;
            st.t += dt; const ev = st.concert.tick(dt), sn = st.concert.snapshot();
            if (ev) { if (WORDS[ev] !== undefined && !(sn.faux.length && FAUX[sn.faux.at(-1)] && st.t - (st.fauxT || 0) < 1.5)) say(r, WORDS[ev] + (ev === 'ovation' ? ' Applaud now (E)!' : ev === 'bows' ? ' Keep applauding…' : ''));
                if (['m1', 'm2', 'm3', 'encore'].includes(ev)) st.audio?.play(ev); }
            st.audio?.applause(sn.state === 'entrance' ? 0.5 * Math.min(1, sn.time / 0.6) * (sn.left > 0.8 ? 1 : sn.left / 0.8) : sn.state === 'ovation' ? Math.min(1, Math.max(0, sn.time - 0.7) / 0.6) : sn.state === 'bows' ? (sn.encore ? 1 : 0.8) * Math.min(1, sn.left / 1.2 + 0.2) : 0);
            if (ev === 'end') {
                const res = st.concert.snapshot();
                if (res.perfect) { flow.complete(); return; }
                r.button.textContent = 'Listen again (E)';
                say(r, res.faux.length ? `The concert is over — but you applauded ${res.faux.map((f) => ({ between: 'between movements', during: 'during the music', 'too-soon': 'before the baton came down' })[f]).filter((f, i, a) => a.indexOf(f) === i).join(' and ')}. E to hear it again.` : 'The concert is over — you never applauded the orchestra. E to hear it again.');
            }
            r.progress.value = Math.min(1, st.concert.snapshot().state === 'end' ? 1 : (['tuning', 'entrance', 'm1', 'pause1', 'm2', 'pause2', 'm3', 'hold', 'ovation', 'bows', 'encore'].indexOf(sn.state) + 1) / 11);
            posePeople(sn, st.t);
            // seated in the stalls: the mouse looks round the hall
            const inp = s2.input || {}, lk = inp.takeLook?.() || { dx: 0, dy: 0 }; st.look = Math.max(-1.6, Math.min(1.6, st.look - lk.dx * 0.0024)); st.pitch = Math.max(-0.5, Math.min(1.2, st.pitch - lk.dy * 0.0024));
            const eye = P(seatAt.x, seatAt.z, 1.3), c = s2.ctl, yaw = seatAt.view + st.look;
            c.x = door.x; c.z = door.z; c.y = door.y; c.heading = yaw; c.pitch = st.pitch;
            if (c.rig) { c.rig.position.copy(eye); c.rig.rotation.set(st.pitch, yaw, 0, 'YXZ'); }
            last = sn;
        },
        cancel(s2) { stop(s2); },
        complete(s2) { const sn = st?.concert.snapshot(); stop(s2); bucActivity(s2, 'athenaeum-revolution', 'concert', '🎻 Bravo!', `You heard the concert in the Athenaeum's Great Hall and applauded at the right moments${sn?.encore ? ' — and the orchestra gave an encore' : ''}.`); },
    });
    timedActivity(ctx, CONCERT_HOURS, { kind: 'concert', x: door.x, z: door.z, r: 2.6, title: '🎻 Athenaeum concert', label: 'Go to the evening concert at the Athenaeum', cond: () => !st, start });
    const api = { start, active: () => !!st, debug: () => st && last, door, room, seat: seatAt };
    ctx.extras.athenaeumConcert = api;
    return api;
}
