import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture, clamp, damp, angleLerp } from './util.js';
import { drawFitText } from './canvasText.js';
import { makeCrowd } from './crowd.js';
import {buildArniaInterior,buildDBInterior,buildRosettiInterior,buildUPBInterior,makeUPBFloor} from './office-interior-details.js';
import {captureOfficeResources} from './office-resources.js';

const SANS = (w) => (px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const BOLD = SANS('bold'), REG = SANS('normal');

/** lobby sign (1024×256): company (≤ 2 lines) + "role · period" (≤ 2 lines), both fitted */
export function drawLobbySign(ctx, s, accent) {
    const hex = '#' + new THREE.Color(accent).getHexString();
    ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, 1024, 256); ctx.fillStyle = hex; ctx.fillRect(0, 236, 1024, 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    const a = drawFitText(ctx, s.company, 512, 78, 940, { maxSize: 84, minSize: 30, maxLines: 2, maxHeight: 128, lineHeight: 1.05, font: BOLD, label: `lobby sign ${s.id} company` });
    ctx.fillStyle = '#cbd5e1';
    const top = 78 + a.height / 2 + 8, bottom = 226;
    const b = drawFitText(ctx, `${s.role} · ${s.period}`, 512, (top + bottom) / 2, 940, { maxSize: 44, minSize: 20, maxLines: 2, maxHeight: bottom - top, lineHeight: 1.12, font: REG, label: `lobby sign ${s.id} subtitle` });
    return [a, b];
}
/** station screen (512×320): title (≤ 3 lines) + hint */
export function drawStationScreen(ctx, st, accent, stop = {}) {
    const hex = '#' + new THREE.Color(accent).getHexString();
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = hex; ctx.fillRect(0, 0, 512, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    const a = drawFitText(ctx, st.title, 256, 132, 456, { maxSize: 44, minSize: 20, maxLines: 3, maxHeight: 200, lineHeight: 1.15, font: BOLD, label: `station ${stop.id || ''} "${st.title}"` });
    ctx.fillStyle = '#93c5fd';
    const b = drawFitText(ctx, 'Press E to read', 256, 272, 440, { maxSize: 26, minSize: 14, font: REG, label: 'station hint' });
    return [a, b];
}
export function drawExitMat(ctx) {
    ctx.fillStyle = '#334155'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    return [drawFitText(ctx, 'EXIT ▸', 128, 64, 220, { maxSize: 44, minSize: 16, maxHeight: 100, font: BOLD, label: 'exit mat' })];
}
/**
 * Draw every office canvas text for the given stops off-screen and report what needed shrinking/wrapping.
 * Returns [{ stop, what, text, size, lines, fits }]; logs the ones that needed > 2 lines or did not fit.
 */
export function auditOfficeTexts(stops) {
    const c = document.createElement('canvas'), ctx = c.getContext('2d'), out = [];
    const add = (stop, what, res, text) => out.push({ stop: stop.id, what, text, size: res.size, lines: res.lines.length, fits: res.fits });
    for (const s of stops) {
        c.width = 1024; c.height = 256;
        const [a, b] = drawLobbySign(ctx, s, s.color || '#f97316');
        add(s, 'sign company', a, s.company); add(s, 'sign subtitle', b, `${s.role} · ${s.period}`);
        c.width = 512; c.height = 320;
        for (const st of s.stations || []) add(s, 'station title', drawStationScreen(ctx, st, s.color || '#f97316', s)[0], st.title);
    }
    const bad = out.filter((r) => r.lines > 2 || !r.fits);
    if (bad.length) console.info('[office] texts needing > 2 lines / not fitting:', bad);
    return out;
}

// ============================================================================
//  INTERIORS (note 14): one recognisable room per CV stop — era props, the company's colours, a painted view of the
//  real street outside the windows, colleagues (instanced crowd), a room tone. Built from a few primitives so every
//  room stays a handful of draw calls.
// ============================================================================
const C3 = (c) => new THREE.Color(c);
const BOXG = new THREE.BoxGeometry(1, 1, 1);
/** the outside conditions for the painted view (after round 6: "windows should reflect the time, weather and every
 *  condition"): night 0..1, dusk 0..1 (low sun), overcast 0..1, rain / snow flags — from the renderer when there is one */
function viewConditions() {
    const r = globalThis.game?.r3d, el = r?.sunElevation ?? 30, k = String(r?.weather?.kind || '').toLowerCase(), cl = r?.weather?.cloud ?? 0.3;
    const sm = (a, b2, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b2 - a))); return t * t * (3 - 2 * t); };
    return { night: sm(3, -7, el), dusk: Math.max(0, 1 - Math.abs(el - 2) / 9), overcast: Math.max(sm(0.55, 1, cl), /rain|drizzle|storm|snow|fog|overcast/.test(k) ? 0.75 : 0), rain: /rain|drizzle|storm|shower/.test(k), snow: /snow/.test(k) };
}
/** painted view out of the window (1024×512): sky, the city's skyline type, street trees — lit for the time of day and
 *  the weather (dusk / night sky with stars, lit windows and street lamps at night, grey veil + streaks in rain, snow) */
function paintView(ctx, w, h, kind, C = viewConditions()) {
    const mix = (a, b2, t) => { const A = C3(a), B = C3(b2); return '#' + A.lerp(B, Math.max(0, Math.min(1, t))).getHexString(); };
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    let top = kind === 'bellevue' ? '#7fa6cf' : '#8fb8e6', hor = kind === 'bellevue' ? '#d9e4ee' : '#e8eef4';
    top = mix(top, '#8a929c', C.overcast); hor = mix(hor, '#c4c8cc', C.overcast);
    top = mix(top, '#3b4a7a', C.dusk * (1 - C.night)); hor = mix(hor, '#f2a36b', C.dusk * (1 - C.night) * (1 - C.overcast * 0.6));
    top = mix(top, '#070b1c', C.night); hor = mix(hor, '#1d2440', C.night);
    sky.addColorStop(0, top); sky.addColorStop(1, hor);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    let seed = kind.length * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (C.night > 0.5 && C.overcast < 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 90; i++) ctx.fillRect(rnd() * w, rnd() * h * 0.45, 1.5, 1.5); }
    const blocks = []; // [x, y, w, h, glass] for the lit windows at night
    if (kind === 'bellevue') { // Cascades on the horizon + glass towers + trees
        ctx.fillStyle = C.snow ? '#e4e8ee' : '#9fb0c4'; ctx.beginPath(); ctx.moveTo(0, h * 0.55);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * (0.5 - 0.06 * Math.abs(Math.sin(x * 0.011)) - 0.03 * rnd())); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        for (let i = 0; i < 9; i++) {
            const bw = 60 + rnd() * 80, bx = rnd() * (w - bw), bh = h * (0.35 + rnd() * 0.45), by = h * 0.8 - bh;
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#5f7894'); g.addColorStop(1, '#8aa3bd');
            ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = by + 6; y < by + bh; y += 10) ctx.fillRect(bx, y, bw, 2);
            blocks.push([bx, by, bw, bh, true]);
        }
    } else {
        // Bucharest: socialist-era blocks (rosetti / upb / gts), glass office towers (pipera), mixed (romana)
        const towers = kind === 'pipera', mixed = kind === 'romana';
        for (let i = 0; i < 12; i++) {
            const glass = towers ? rnd() < 0.8 : mixed ? rnd() < 0.35 : false;
            const bw = 70 + rnd() * 90, bx = rnd() * (w - bw), bh = h * (glass ? 0.35 + rnd() * 0.45 : 0.2 + rnd() * 0.3), by = h * 0.82 - bh;
            ctx.fillStyle = glass ? '#6f8aa6' : ['#c9b9a2', '#b8ab96', '#d6cbb8', '#a99a86'][i % 4]; ctx.fillRect(bx, by, bw, bh);
            if (glass) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let y = by + 5; y < by + bh; y += 9) ctx.fillRect(bx, y, bw, 2); }
            else { ctx.fillStyle = 'rgba(40,45,55,0.55)'; for (let y = by + 10; y < by + bh - 8; y += 18) for (let x = bx + 8; x < bx + bw - 10; x += 16) ctx.fillRect(x, y, 9, 10); }
            if (C.snow) { ctx.fillStyle = '#f2f4f7'; ctx.fillRect(bx - 2, by - 3, bw + 4, 4); }
            blocks.push([bx, by, bw, bh, glass]);
        }
    }
    const treeY = kind === 'bellevue' ? 0.86 : 0.8, treeC = kind === 'bellevue' ? '#2f4a32' : '#3f6b3a';
    const month = (globalThis.game?.nowDate?.() || new Date()).getMonth(), bare = month === 11 || month <= 1, autumn = month >= 9 && month <= 10;
    ctx.fillStyle = C.snow ? '#e8ecf0' : bare ? '#6b5a48' : autumn ? '#b0782f' : treeC;
    for (let x = 0; x < w; x += kind === 'bellevue' ? 18 : 22) { ctx.beginPath(); ctx.arc(x + rnd() * 12, h * treeY + rnd() * 12, (bare ? 12 : 20) + rnd() * 12, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.snow ? '#d9dde2' : C.rain ? '#4a4d50' : '#6a6d70'; ctx.fillRect(0, h * 0.88, w, h * 0.12);
    if (kind !== 'bellevue') { ctx.fillStyle = '#d9d9d2'; for (let x = 0; x < w; x += 60) ctx.fillRect(x, h * 0.94, 30, 3); }
    // weather veil, then night: everything darkened, lit windows, street lamps, car lights on the wet / dry road
    if (C.overcast > 0) { ctx.fillStyle = `rgba(150,156,162,${0.22 * C.overcast})`; ctx.fillRect(0, 0, w, h); }
    if (C.night > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mix('#ffffff', '#1a2140', C.night); ctx.fillRect(0, h * 0.25, w, h * 0.75); ctx.restore();
        ctx.globalAlpha = C.night;
        for (const [bx, by, bw, bh, glass] of blocks) for (let y = by + 8; y < by + bh - 8; y += glass ? 10 : 18) for (let x = bx + 6; x < bx + bw - 8; x += glass ? 12 : 16) if (rnd() < 0.32) { ctx.fillStyle = rnd() < 0.8 ? '#ffd58a' : '#bcd4ff'; ctx.fillRect(x, y, glass ? 10 : 9, glass ? 6 : 10); }
        for (let x = 30; x < w; x += 120) { const gl = ctx.createRadialGradient(x, h * 0.86, 0, x, h * 0.86, 46); gl.addColorStop(0, 'rgba(255,200,120,0.55)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 46, h * 0.8, 92, h * 0.2); ctx.fillStyle = '#fff1c9'; ctx.fillRect(x - 3, h * 0.84, 6, 3); }
        for (let i = 0; i < 6; i++) { const x = rnd() * w; ctx.fillStyle = rnd() < 0.5 ? '#fff6d8' : '#ff3b30'; ctx.fillRect(x, h * 0.915, 5, 2.5); ctx.fillRect(x + 12, h * 0.915, 5, 2.5); }
        ctx.globalAlpha = 1;
    }
    if (C.rain) { ctx.strokeStyle = `rgba(210,220,235,${0.28 + 0.2 * (1 - C.night)})`; ctx.lineWidth = 1; for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke(); } }
    if (C.snow) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 220; i++) { ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 0, 7); ctx.fill(); } }
}
const tex = (w, h, draw) => { const t = makeCanvasTexture(w, h, draw); return t; };
const parquet = (base = '#8a5a34') => tex(256, 256, (ctx) => {
    for (let r = 0; r < 16; r++) for (let c = -1; c < 4; c++) { const l = 0.82 + (((r * 7 + c * 13) % 9) + 9) % 9 / 40; const col = C3(base).multiplyScalar(l); ctx.fillStyle = '#' + col.getHexString(); ctx.fillRect(c * 64 + (r % 2) * 32, r * 16, 64, 16); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(c * 64 + (r % 2) * 32, r * 16, 1, 16); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let r = 0; r < 16; r++) ctx.fillRect(0, r * 16 + 15, 256, 1);
});
const stone = (base, vein = 'rgba(255,255,255,0.18)', tile = 64) => tex(256, 256, (ctx) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    ctx.strokeStyle = vein; ctx.lineWidth = 1.2; for (let i = 0; i < 14; i++) { ctx.beginPath(); let x = rnd() * 256, y = rnd() * 256; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += rnd() * 40; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i <= 256; i += tile) { ctx.fillRect(i, 0, 1, 256); ctx.fillRect(0, i, 256, 1); }
});
const carpet = (base) => tex(128, 128, (ctx) => { ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.04)`; ctx.fillRect((i * 37) % 128, (i * 91) % 128, 2, 2); } });

/** per-stop theme: room size, surfaces, view, NPC persona + look, colleagues, props builder name */
const THEMES = {
    rosetti: { W: 10, D: 10, H: 3.4, photoLed:true, floor: () => carpet('#a6adab'), wallLow: '#90999a', wall: '#eef0ea', ceil: '#f1f3ed', view: 'bucharest', props: 'classroom',
        npc: { title: 'Form teacher', persona: 'teacher', look: { top: '#5a4636', bottom: '#2f3237', skin: '#e8bc9a', hair: '#5a4030' }, at: [-2.6, -3.6], yaw: 0.35 },
        // Virtual classmates occupy the paired desks of the estimated photo-led room.
        mates: [[-3.5, 0.65, 'sit', 0], [-2.7, 2.25, 'sit', 0], [2.9, 2.25, 'sit', 0], [4.4, 4.0, 'phone', -0.4]], tone: 'room' },
    upb: { W: 18, D: 22, H: 7, photoLed:true, floorRoughness:.48, floor:makeUPBFloor, wallLow: '#aaa49a', wall: '#e6e3da', ceil: '#eeeee7', view: 'bucharest', props: 'rectorat',
        npc: { title: 'Professor', persona: 'professor', look: { top: '#3a3d44', bottom: '#2f3237', skin: '#e8bc9a', hair: '#9a9a96' }, at: [2.5, -6], yaw: -0.4 },
        mates: [[-4, -2, 'talk'], [-3.2, -1.2, 'talk'], [5, 3, 'phone'], [-6, 5, 'walk']], tone: 'hall' },
    gts: { W: 9, D: 9, H: 2.9, floor: () => parquet('#b39470'), wallLow: '#f2f2ef', wall: '#f2f2ef', ceil: '#f7f7f5', view: 'bucharest', props: 'startup',
        npc: { title: 'Team lead', persona: 'lead', look: { top: '#1f2937', bottom: '#2c3e5c', skin: '#e8bc9a', hair: '#3b2a1e' }, at: [2.2, -2.6], yaw: -0.5 },
        mates: [[-2.6, -1.6, 'sit'], [-2.6, 0.9, 'sit'], [2.6, 0.9, 'sit']], tone: 'office' },
    luxoft: { W: 16, D: 18, H: 5, floor: () => stone('#3b3f46', 'rgba(255,255,255,0.08)', 128), wallLow: '#e9edf1', wall: '#f4f6f8', ceil: '#f4f6f8', view: 'pipera', props: 'lobby',
        npc: { title: 'Team lead', persona: 'lead', look: { top: '#1f2a44', bottom: '#2f3237', skin: '#e8bc9a', hair: '#1a1410' }, at: [3, -3.5], yaw: -0.3 },
        mates: [[-4, 2, 'phone'], [5, -6, 'walk'], [-5.5, -5, 'talk']], tone: 'lobby' },
    db: { W: 16, D: 18, H: 3.8, photoLed: true, floor: () => carpet('#747a7b'), wallLow: '#deded7', wall: '#eeeee8', ceil: '#252b2d', view: 'pipera', props: 'bank',
        npc: { title: 'Engineering manager', persona: 'manager', look: { top: '#16181c', bottom: '#16181c', skin: '#e8bc9a', hair: '#3b2a1e' }, at: [-3, -3.5], yaw: 0.3 },
        mates: [[4, 1, 'phone'], [-5, 3, 'talk'], [-4.3, 3.6, 'talk']], tone: 'lobby' },
    arnia: { W: 14, D: 14, H: 3.2, photoLed: true, floor: () => carpet('#8f9698'), wallLow: '#eeeee7', wall: '#eeeee7', ceil: '#f0f0e9', view: 'romana', props: 'agency',
        npc: { title: 'Delivery manager', persona: 'manager', look: { top: '#9a7652', bottom: '#2c3e5c', skin: '#e8bc9a', hair: '#5a4030' }, at: [0.5, -3.2], yaw: 0 },
        mates: [[-4, -1, 'sit'], [-4, 1.6, 'sit'], [4, -1, 'sit'], [4, 3.5, 'talk']], tone: 'office' },
    'uipath-buc': { W: 18, D: 16, H: 3.6, floor: () => carpet('#3a3d44'), wallLow: '#fa4616', wall: '#f4f4f2', ceil: '#f6f6f4', view: 'romana', props: 'robots',
        npc: { title: 'Engineering manager', persona: 'manager', look: { top: '#fa4616', bottom: '#1c1d21', skin: '#e8bc9a', hair: '#1a1410' }, at: [0, -3.5], yaw: 0 },
        mates: [[-5, -1, 'sit'], [-5, 1.8, 'sit'], [5, -1, 'sit'], [5, 1.8, 'phone'], [-2, 4, 'talk']], tone: 'office' },
    'uipath-bel': { W: 20, D: 16, H: 8, floor: () => stone('#cfc9bf', 'rgba(120,110,100,0.2)', 128), wallLow: '#6b4f3a', wall: '#e9e5de', ceil: '#f1eee8', view: 'bellevue', props: 'tower',
        npc: { title: 'Director of engineering', persona: 'manager', look: { top: '#2f3237', bottom: '#1c1d21', skin: '#e5b896', hair: '#3b2a1e' }, at: [-2.5, -3.5], yaw: 0.35 },
        mates: [[5, 2, 'phone'], [-6, 3, 'walk'], [6, -4, 'talk']], tone: 'lobby' },
};
const DEFAULT_THEME = THEMES.gts;

const PERSONA = {
    teacher: { hi: ['Good morning! Come in, sit wherever you like.', 'You are asking about Cristian? One of ours.'], bye: 'Good luck — and do your homework!', lead: ['Well,', 'Let me think.', 'Ah, yes.'] },
    professor: { hi: ['Welcome to the Rectorat.', 'Cristian? Yes, I remember the class.'], bye: 'Good day. Mind the stairs.', lead: ['Indeed.', 'Let me see.', 'Well.'] },
    lead: { hi: ['Hey, welcome!', 'You want to know about Cristian? Grab a coffee.'], bye: 'Cool, see you around!', lead: ['So,', 'Right,', 'Okay so,'] },
    manager: { hi: ['Hi, welcome in.', 'Happy to tell you about Cristian.'], bye: 'Thanks for stopping by!', lead: ['Sure.', 'Good question.', 'Right.'] },
    host: { hi: ['Welcome!'], bye: 'Have a good flight!', lead: ['Sure.'] },
};
/** small flat portrait (256×256) for the dialogue panel */
function portraitURL(look, persona) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, '#24314a'); bg.addColorStop(1, '#101724'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
    x.fillStyle = look.top; x.beginPath(); x.ellipse(128, 262, 112, 96, 0, Math.PI, 0); x.fill();            // shoulders
    if (persona === 'manager' || persona === 'professor') { x.fillStyle = '#e9e7e2'; x.beginPath(); x.moveTo(108, 170); x.lineTo(128, 214); x.lineTo(148, 170); x.fill(); }
    x.fillStyle = look.skin; x.fillRect(112, 140, 32, 34);                                                     // neck
    x.beginPath(); x.ellipse(128, 112, 48, 58, 0, 0, 7); x.fill();                                             // face
    x.fillStyle = look.hair; x.beginPath(); x.ellipse(128, 82, 52, 36, 0, Math.PI, 0); x.fill(); x.fillRect(76, 80, 12, 34); x.fillRect(168, 80, 12, 34);
    x.fillStyle = '#2a2420'; x.beginPath(); x.arc(110, 112, 4.5, 0, 7); x.arc(146, 112, 4.5, 0, 7); x.fill();   // eyes
    x.strokeStyle = '#8a5a48'; x.lineWidth = 3; x.beginPath(); x.arc(128, 136, 14, 0.2, Math.PI - 0.2); x.stroke(); // smile
    if (persona === 'professor' || persona === 'teacher') { x.strokeStyle = '#1a1a1a'; x.lineWidth = 3; x.strokeRect(96, 102, 26, 20); x.strokeRect(134, 102, 26, 20); x.beginPath(); x.moveTo(122, 112); x.lineTo(134, 112); x.stroke(); }
    return c.toDataURL();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/**
 * Walkable CV-stop interior with a linear host story. E starts/resumes; Enter, Space or Continue
 * advances every CV section in source order. Esc pauses; the final Continue finishes the chapter visit.
 * Compatible with the old screen API: `read` (Set of fully presented story-section indices), `done`, `stations[]` ({data, x, z, index}),
 * `exitZ`. Each fully presented section dispatches `window` event `cv-answer` {stop, index, title, part} and calls `onAnswer(detail)`.
 */
export class Office {
    constructor(renderer, camera, stop, hud, input, audio) {
        this.renderer = renderer; this.camera = camera; this.stop = stop; this.hud = hud; this.input = input; this.audio = audio;
        this.theme = THEMES[stop.id] || DEFAULT_THEME;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1a1d24');
        this.done = false;
        this.read = new Set(); this.part = {}; this.conversationComplete = false;
        this.onAnswer = null;
        this.x = 0; this.z = 0; this.heading = 0; this.pitch = 0; this.vel = 0; this.vx = 0; this.vz = 0;
        this.jumpY = 0; this.vy = 0;
        this.stations = [];
        this.boxes = [];
        this.talking = false;
        this.build();
        this.roomResources=captureOfficeResources(this.scene,{sharedGeometries:new Set([BOXG]),helperMaterials:this.interiorDetails?.ownedMaterials,helperTextures:this.interiorDetails?.ownedTextures});
        this.camRig = new THREE.Group(); this.camRig.rotation.order = 'YXZ'; this.camRig.add(camera); this.scene.add(this.camRig);
        camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
        this.t = 0;
        this.startTone();
    }

    build() {
        const s = this.stop, T = this.theme, { W, D, H } = T;
        const accent = new THREE.Color(s.color || '#f97316');
        this.bounds = { minX: -W / 2 + 0.5, maxX: W / 2 - 0.5, minZ: -D / 2 + 0.5, maxZ: D / 2 - 0.5 };
        const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
        const box = (w, h, d, x, y, z, m, coll = false, ry = 0) => { const b = new THREE.Mesh(BOXG, m); b.scale.set(w, h, d); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; this.scene.add(b); if (coll) this.addBox(x, z, ry ? d : w, ry ? w : d); return b; };
        this.box = box; this.mat = mat;
        // floor / ceiling / walls (lower band + upper)
        const ft = T.floor(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W / 3, D / 3);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: ft, roughness: T.floorRoughness ?? (T.photoLed ? .93 : .45), metalness: T.photoLed?0:.05 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(T.ceil, { roughness: 0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.scene.add(ceil);
        const wallM = mat(T.wall, { roughness: 0.9 }), lowM = mat(T.wallLow, { roughness: 0.6 });
        const low = Math.min(1.2, H * 0.32);
        const wall = (w, x, z, ry) => { box(w, H - low, 0.2, x, low + (H - low) / 2, z, wallM, false, ry); box(w, low, 0.22, x, low / 2, z, lowM, false, ry); };
        wall(W, 0, -D / 2, 0); wall(W, 0, D / 2, 0); wall(D, -W / 2, 0, Math.PI / 2);
        // right wall = windows onto the street (painted view behind mullions)
        const viewT = tex(1024, 512, (ctx, w, h) => paintView(ctx, w, h, T.view));
        const winH = Math.min(H - 1.2, 2.2 + (H > 5 ? H * 0.4 : 0)), winY = 0.95 + winH / 2;
        const view = new THREE.Mesh(new THREE.PlaneGeometry(D - 1, winH), new THREE.MeshBasicMaterial({ map: viewT, toneMapped: true }));
        view.position.set(W / 2 + 0.25, winY, 0); view.rotation.y = -Math.PI / 2; view.name='office-live-window-pane'; this.windowPane=view; this.scene.add(view);
        box(0.2, 0.95, D, W / 2, 0.47, 0, lowM); box(0.2, H - winY - winH / 2, D, W / 2, H - (H - winY - winH / 2) / 2, 0, wallM);
        const frameM = mat('#2b2e33', { roughness: 0.5, metalness: 0.4 });
        for (let z = -D / 2 + 0.5; z <= D / 2 - 0.4; z += 2.2) box(0.1, winH, 0.08, W / 2 - 0.02, winY, z, frameM);
        box(0.1, 0.06, D - 1, W / 2 - 0.02, winY - winH / 2, 0, frameM); box(0.1, 0.06, D - 1, W / 2 - 0.02, winY + winH / 2, 0, frameM);
        // lights: soft hemisphere + window key light + ceiling fixtures
        this.scene.add(new THREE.HemisphereLight('#f4f1ea', '#5b5650', 1.25));
        const sun = new THREE.DirectionalLight('#fff3df', 1.7); sun.position.set(W, H * 2, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -W, right: W, top: D, bottom: -D }); this.scene.add(sun);
        for (let z = -D / 2 + 3; z < D / 2 - 1; z += Math.max(4, D / 3)) for (const x of W > 12 ? [-W / 4, W / 4] : [0]) {
            const l = new THREE.PointLight('#fff2dd', H > 5 ? 90 : 35, H * 4, 1.6); l.position.set(x, H - 0.25, z); this.scene.add(l);
            if(!T.photoLed)box(1.2, 0.04, 0.3, x, H - 0.03, z, new THREE.MeshBasicMaterial({ color: '#fffaf0' }));
        }
        // company sign (fitted text) on the back wall + accent stripe
        // (round 6 note 12) the sign fits: below the ceiling, above the wainscot stripe, and narrower than the gap to the
        // meeting rooms / feature walls at the sides (it ran into the ceiling and under the glass of UiPath Bucharest)
        let sw = Math.min(5.6, W * 0.5), sh = sw / 4;
        const sTop = H - 0.35, sBot = low + 0.3; if (sh > sTop - sBot) { sh = sTop - sBot; sw = sh * 4; }
        const sy = clamp(2.4 + (H - 3) * 0.4, sBot + sh / 2, sTop - sh / 2);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(1024, 256, (ctx) => drawLobbySign(ctx, s, accent)) }));
        sign.position.set(0, sy, -D / 2 + 0.12); this.scene.add(sign); this.signMesh = sign;
        if (T.props !== 'classroom' && !T.photoLed) box(W, 0.06, 0.04, 0, low + 0.04, -D / 2 + 0.12, new THREE.MeshBasicMaterial({ color: accent }));
        // themed props
        this.interiorDetails=(PROPS[T.props] || PROPS.startup)(this, { W, D, H, accent, s })||null;
        // NPC + colleagues (instanced crowd: 2 draw calls)
        const city = s.city || 'bucharest';
        this.crowd = makeCrowd({ max: 8, city, rng: makeRngLite(s.id.length * 31) });
        this.scene.add(this.crowd.object);
        const n = T.npc; this.npc = { x: n.at[0], z: n.at[1], yaw: n.yaw, title: n.title, persona: n.persona };
        this.crowd.dress(0, { ...n.look, acc: '#111214', flags: 0 });
        T.mates.forEach(([x, z, pose, yaw0], i) => { const ps = pose === 'walk' ? 'stand' : pose; this.crowd.set(i + 1, { x, y: pose === 'sit' ? 0 : 0, z, yaw: yaw0 ?? (i % 2 ? 0.6 : -0.6), pose: ps, prop: ps === 'phone' ? 'phone' : null, scale: 0.94 + (i % 3) * 0.04 }); this.addBox(x, z, 0.7, 0.7); });
        this.crowd.count = 1 + T.mates.length;
        this.addBox(n.at[0], n.at[1], 0.6, 0.6);
        // stations (compat): every CV station is a topic of the conversation, located at the NPC
        (s.stations || []).forEach((st, i) => this.stations.push({ data: st, x: n.at[0], z: n.at[1], index: i, mesh: null, glow: { intensity: 0 } }));
        this.portrait = portraitURL(n.look, n.persona);
        // exit mat by the door (front wall)
        const exit = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(256, 128, (ctx) => drawExitMat(ctx)) }));
        exit.rotation.x = -Math.PI / 2; exit.rotation.z = Math.PI; exit.position.set(0, 0.02, D / 2 - 0.9); this.scene.add(exit);
        box(1.6, 2.3, 0.08, 0, 1.15, D / 2 - 0.08, mat('#3b3f46', { roughness: 0.4, metalness: 0.3 })); // door
        // Full jambs/header in front of the wall make the exit edge legible.
        const doorTrim=mat('#bbbdb8',{roughness:.75}),doorZ=D/2-.16;
        box(.10,2.42,.10,-.85,1.21,doorZ,doorTrim);box(.10,2.42,.10,.85,1.21,doorZ,doorTrim);
        box(1.8,.10,.10,0,2.37,doorZ,doorTrim);box(.035,.22,.055,.59,1.12,doorZ-.07,mat('#d3d8dc',{metalness:.7,roughness:.25}));
        this.exitZ = D / 2 - 0.9;
        this.x = 0; this.z = D / 2 - 2; this.heading = 0;
    }

    addBox(x, z, w, d) { this.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }
    collide(r = 0.3) {
        for (const b of this.boxes) {
            const cx = clamp(this.x, b.x0, b.x1), cz = clamp(this.z, b.z0, b.z1);
            const dx = this.x - cx, dz = this.z - cz, d = Math.hypot(dx, dz);
            if (d >= r) continue;
            if (d > 1e-4) { this.x = cx + dx / d * r; this.z = cz + dz / d * r; }
            else { const opts = [[b.x0 - r - this.x, 0], [b.x1 + r - this.x, 0], [0, b.z0 - r - this.z], [0, b.z1 + r - this.z]]; const m = opts.reduce((a, o) => (Math.abs(o[0]) + Math.abs(o[1]) < Math.abs(a[0]) + Math.abs(a[1]) ? o : a)); this.x += m[0]; this.z += m[1]; }
        }
        this.x = clamp(this.x, this.bounds.minX, this.bounds.maxX); this.z = clamp(this.z, this.bounds.minZ, this.bounds.maxZ);
    }

    update(dt) {
        dt = Math.min(dt, 0.05);
        this.t += dt;
        const inp = this.input, panel = this.hud.panelOpen;
        inp.lookAllowed = !panel;
        if (panel || this._panelWas) inp.flush();
        if (this._panelWas && !panel && this.talking) this.endTalk(false);
        this._panelWas = panel;
        if (panel && inp.locked) inp.releaseLock();
        if (!panel) {
            const lk = inp.takeLook();
            this.heading -= lk.dx * 0.0024; this.pitch = clamp(this.pitch - lk.dy * 0.0024, -1.2, 1.2);
            const mouse = inp.lookHeld || inp.locked;
            let fwd = 0, side = 0, turn = 0;
            if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) fwd += 1;
            if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) fwd -= 1;
            if (!inp.keys.size && inp.touch.throttle) fwd = inp.touch.throttle;
            const a = inp.keys.has('KeyA'), d = inp.keys.has('KeyD');
            if (mouse) side = (d ? 1 : 0) - (a ? 1 : 0); else turn += (d ? 1 : 0) - (a ? 1 : 0);
            turn += (inp.keys.has('ArrowRight') ? 1 : 0) - (inp.keys.has('ArrowLeft') ? 1 : 0);
            if (!inp.keys.size && inp.touch.steer) turn = inp.touch.steer;
            this.heading -= turn * 1.9 * dt;
            if (!mouse && !turn && Math.abs(fwd) > 0) this.pitch = damp(this.pitch, 0, 2, dt);
            const run = inp.shift ? 2 : 1, sp = 3.2 * run;
            const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading), rx = -fz, rz = fx;
            let wx = fx * fwd + rx * side, wz = fz * fwd + rz * side; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
            const k = 1 - Math.exp(-(this.jumpY > 0 ? 2 : 10) * dt);
            this.vx += (wx * sp - this.vx) * k; this.vz += (wz * sp - this.vz) * k;
            this.vel = Math.hypot(this.vx, this.vz);
            this.x += this.vx * dt; this.z += this.vz * dt;
            this.collide();
            if (inp.take('Space') && this.jumpY <= 0) { this.vy = 3.4; this.audio.blip?.(330, 0.04, 0.04); }
        }
        if (this.vy !== 0 || this.jumpY > 0) { this.vy -= 9.8 * dt; this.jumpY += this.vy * dt; if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; } }
        const bob = this.jumpY > 0 ? 0 : Math.sin(this.t * 7 * (this.vel > 4 ? 1.4 : 1)) * 0.02 * Math.min(1.6, this.vel / 3);
        if (this.talking && this.frame) { // conversation framing: ~2.2 m from the NPC, eye level, NPC above / left of the dialogue box
            const f = this.frame, k = f.snap ? 1 : 1 - Math.exp(-5 * dt); f.snap = false; // cut to the conversation shot, then hold
            this.x += (f.x - this.x) * k; this.z += (f.z - this.z) * k;
            this.heading = angleLerp(this.heading, f.heading, k); this.pitch += (f.pitch - this.pitch) * k; this.vx = this.vz = 0;
        }
        this.camRig.position.set(this.x, 1.62 + this.jumpY + bob, this.z);
        this.camRig.rotation.set(this.pitch, this.heading, 0, 'YXZ');
        this.camera.fov = damp(this.camera.fov, 70, 5, dt); this.camera.updateProjectionMatrix();
        // NPC: idle / talking, turns toward the player when near
        const n = this.npc, dN = Math.hypot(this.x - n.x, this.z - n.z);
        if (dN < 4) n.yaw = angleLerp(n.yaw, Math.atan2(-(this.x - n.x), -(this.z - n.z)), this.talking ? 1 : 1 - Math.exp(-4 * dt)); // face the visitor (people face −z rotated by yaw)
        this.crowd.set(0, { x: n.x, y: 0, z: n.z, yaw: n.yaw, pose: this.talking ? 'talk' : 'stand', phase: this.t });
        const near = dN < 3.4; // generous: E anywhere around the NPC opens the talk
        const atExit = this.z > this.exitZ - 1.2 && Math.abs(this.x) < 1.6;
        const N = this.stations.length;
        if (panel) this.hud.prompt(null);
        else if (near) { this.hud.prompt(`<kbd>E</kbd> Talk to the ${n.title.toLowerCase()} ${this.read.size ? `<small>(${this.read.size}/${N} story sections)</small>` : ''}`); if (inp.take('KeyE')) { inp.releaseLock(); this.talk(); } }
        else if (atExit) { this.hud.prompt(`<kbd>E</kbd> Leave ${this.stop.short} ${!this.conversationComplete ? `<small>(Story paused · finish it to continue)</small>` : '✓'}`); if (inp.take('KeyE')) this.done = true; }
        else this.hud.prompt(null);
        if (inp.take('Escape') && !panel) this.done = true;
        const touch = document.body.classList.contains('touch');
        const lookHint = touch ? 'drag to look' : inp.lookMode === 'lock' ? (inp.locked ? 'mouse look · Esc frees the cursor' : 'click to look around') : 'A/D turn';
        this.hud.setHint(`${this.read.size}/${N} story sections · walk to the ${n.title.toLowerCase()} and press E · W/S walk · ${lookHint} · Esc leave${this.windowViewLabel ? ` · ${this.windowViewLabel()}` : ''}`);
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  dialogue
    // ---------------------------------------------------------------------------------------------------------------
    /** where the camera goes for the conversation: 2.2 m in front of the NPC on the player's side, clear of furniture */
    convFrame() {
        const n = this.npc; let dx = this.x - n.x, dz = this.z - n.z; let l = Math.hypot(dx, dz); if (l < 0.01) { dx = 0; dz = 1; l = 1; }
        dx /= l; dz /= l;
        let best = null;
        for (const a of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) for (const d of [2.3, 2.0, 1.7]) {
            const c = Math.cos(a), s2 = Math.sin(a), ux = dx * c - dz * s2, uz = dx * s2 + dz * c, x = n.x + ux * d, z = n.z + uz * d;
            if (x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ) continue;
            if (this.boxes.some(b => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3)) continue;
            best = { x, z }; break;
        }
        if (!best) best = { x: this.x, z: this.z };
        const portrait = innerHeight > innerWidth;
        const look = Math.atan2(-(n.x - best.x), -(n.z - best.z));
        // landscape: turn right so the NPC stands left of the (right-aligned) dialogue box; portrait: centred, above the box
        return { x: best.x, z: best.z, heading: look - (portrait ? 0 : 0.36), pitch: portrait ? -0.3 : -0.12, snap: true };
    }
    talk() {
        this.frame = this.convFrame();
        this.talking = true; this.audio.blip?.(660, 0.06, 0.06);
        const P = PERSONA[this.npc.persona] || PERSONA.manager, s = this.stop;
        this.hud.panel('<div class="dlg"></div>', { closable: false });
        this._keyH = (e) => this.onKey(e); window.addEventListener('keydown', this._keyH, true);
        // The host tells the chapter in source order; paused talks resume at the first unfinished section.
        this.greet = `${esc(P.hi[0])} ${esc(P.hi[1] || '')} He was here ${esc(s.period.replace(' – ', ' to '))} — ${esc(s.role)}.`;
        this.answer([...Array(this.stations.length).keys()].find(i => !this.read.has(i)) ?? (this.conversationComplete ? 0 : this.stations.length - 1), 0, true);
    }
    // Legacy callers may start/resume the story, but cannot choose a topic.
    open() { if (!this.talking) this.talk(); else this.advance(); }
    options() {
        const final = this.cur === this.stations.length - 1 && this.part[this.cur] === 2;
        return [{ label: final ? 'Finish chapter →' : 'Continue →', act: () => this.advance() }];
    }
    advance() {
        if (!this.talking) return;
        if (this.part[this.cur] === 1) this.answer(this.cur, 1);
        else if (this.cur + 1 < this.stations.length) this.answer(this.cur + 1, 0);
        else { this.conversationComplete = true; this.endTalk(true); this.done = true; }
    }
    show(text, sub = '') {
        const el = this.hud.el?.panel?.querySelector('.dlg') || document.querySelector('#panel .dlg'); if (!el) return;
        const N = this.stations.length, s = this.stop;
        this.opts = this.options();
        el.innerHTML = `<div class="dlg-head"><img class="dlg-portrait" alt="" src="${this.portrait}"><div><div class="dlg-name">${esc(this.npc.title)}</div><div class="dlg-where" style="color:${s.color}">${s.icon || ''} ${esc(s.company)} · ${esc(s.period)}</div></div><div class="dlg-count">Story ${this.cur + 1}/${N}</div></div>`
            + `<div class="dlg-text">${text}</div>${sub ? `<div class="dlg-sub">${sub}</div>` : ''}`
            + `<div class="dlg-opts dlg-linear"><button data-opt="0"><kbd>↵</kbd>${esc(this.opts[0].label)}</button></div><div class="dlg-help">Enter / Space or tap Continue · Esc pauses the story</div>`;
        el.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); this.pick(+b.dataset.opt); }));
    }
    pick(i) { const o = this.opts?.[i]; if (o) { this.audio.blip?.(880, 0.03, 0.04); o.act(); } }
    onKey(e) {
        if (!this.talking) return;
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
            e.preventDefault(); e.stopPropagation(); if (!e.repeat) this.pick(0);
        } else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.endTalk(true); }
    }

    answer(i, part, greet = false) {
        const st = this.stations[i]; if (!st) return;
        const d = st.data, P = PERSONA[this.npc.persona] || PERSONA.manager;
        this.cur = i;
        let body;
        if (d.chips) { this.part[i] = 2; body = `${P.lead[i % P.lead.length]} he worked with ${d.chips.slice(0, -1).map(esc).join(', ')}${d.chips.length > 1 ? ' and ' : ''}${esc(d.chips[d.chips.length - 1])}.`; }
        else {
            const lines = d.lines || [], cut = lines.length > 2 ? 2 : lines.length;
            const show = part === 0 ? lines.slice(0, cut) : lines.slice(cut);
            body = `${part === 0 ? P.lead[i % P.lead.length] + ' ' : ''}${show.map(esc).join(' ')}`;
            this.part[i] = part === 0 && lines.length > cut ? 1 : 2;
        }
        const first = !this.read.has(i);
        if (this.part[i] === 2) this.read.add(i);
        const detail = { stop: this.stop.id, index: i, title: d.title, part, first };
        if (this.part[i] === 2) {
            try { this.onAnswer?.(detail); } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('cv-answer', { detail })); } catch { /* ignore */ }
        }
        this.show(`${greet ? `<p class="dlg-greet">${this.greet}</p>` : ''}<b class="dlg-q">${esc(d.title)}</b>${body}`, this.cur === this.stations.length - 1 && this.part[this.cur] === 2 ? 'The chapter story is complete. Finish to continue your journey.' : '');
    }
    endTalk(close) {
        if (!this.talking) return;
        this.talking = false;
        window.removeEventListener('keydown', this._keyH, true);
        if (close) { const P = PERSONA[this.npc.persona] || PERSONA.manager; this.hud.closePanel(); this.hud.toast?.(`💬 ${this.npc.title}`, P.bye); }
        this.input.flush();
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  room tone (WebAudio, quiet): hall reverb-ish hum, office HVAC + far keyboard clicks, classroom murmur
    // ---------------------------------------------------------------------------------------------------------------
    startTone() {
        const ac = this.audio?.ctx; if (!ac || !this.audio.master) return;
        try {
            const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
            let b = 0; for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; ch[i] = b * 3.5; }
            const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
            const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = { hall: 380, lobby: 520, office: 700, room: 900 }[this.theme.tone] || 600;
            const g = ac.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.05, ac.currentTime + 1.2);
            src.connect(f).connect(g).connect(this.audio.master); src.start();
            this._tone = { src, g };
            if (this.theme.tone === 'office') this._clicks = setInterval(() => { if (Math.random() < 0.6) this.audio.blip?.(1800 + Math.random() * 600, 0.008, 0.012); }, 260);
        } catch { /* ignore */ }
    }
    stopTone() { try { this._tone?.g.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.2); this._tone?.src.stop(this.audio.ctx.currentTime + 1); } catch { /* ignore */ } clearInterval(this._clicks); }

    render() { this.renderer.render(this.scene, this.camera); }
    dispose() {
        if(this._disposed)return;this._disposed=true;
        if (this.talking) this.endTalk(false);
        this.stopTone();
        this.input.releaseLock(); this.camRig.remove(this.camera);
        this.crowd?.dispose();
        this.interiorDetails?.dispose();
        this.roomResources.dispose();
    }
}
function makeRngLite(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------------------------------------------------------------------------------------------------------------------
//  prop sets per interior
// ---------------------------------------------------------------------------------------------------------------------
const PROPS = {
    /** Privately compared Rosetti school tour; exact2009room appearance is unknown. */
    classroom(o,d) { return buildRosettiInterior(o,d); },
    /** Official tour's Rectorat cupola ground-hall character; layout remains estimated. */
    rectorat(o,d) { return buildUPBInterior(o,d); },
    /** small startup office near Hala Traian: four desks with laptops + LCDs, whiteboard with sticky notes, bean bag, kitchenette */
    startup(o, { W, D, H, accent }) {
        const { box, mat } = o, white = mat('#f4f4f2', { roughness: 0.5 }), leg = mat('#9aa0a6', { metalness: 0.6, roughness: 0.4 });
        for (const [x, z] of [[-2.6, -2.2], [-2.6, 0.3], [2.6, 0.3], [2.6, -2.2]]) {
            box(1.6, 0.04, 0.8, x, 0.74, z, white, true); for (const dx of [-0.75, 0.75]) box(0.04, 0.72, 0.7, x + dx, 0.37, z, leg);
            box(0.55, 0.34, 0.03, x, 1.1, z - 0.3, mat('#111214')); box(0.5, 0.3, 0.01, x, 1.1, z - 0.284, new THREE.MeshBasicMaterial({ color: '#244a7a' }));
            box(0.34, 0.02, 0.24, x + 0.45, 0.77, z + 0.05, mat('#c9cdd2', { metalness: 0.6, roughness: 0.3 }));
        }
        const wb = makeCanvasTexture(512, 256, (ctx) => { ctx.fillStyle = '#fbfbf9'; ctx.fillRect(0, 0, 512, 256); const c = ['#ffe66b', '#ff9ecb', '#9fe0ff', '#b6f29a']; ctx.fillStyle = '#334'; ctx.font = '600 18px sans-serif'; ['TODO', 'DOING', 'DONE'].forEach((t, i) => ctx.fillText(t, 20 + i * 170, 26)); for (let i = 0; i < 14; i++) { ctx.fillStyle = c[i % 4]; ctx.fillRect(20 + (i % 3) * 170 + (i % 2) * 40, 40 + Math.floor(i / 3) * 42, 46, 36); } ctx.strokeStyle = '#99a'; for (const x of [168, 338]) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 250); ctx.stroke(); } });
        const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: wb, roughness: 0.3 })); b.position.set(-W / 2 + 0.13, 1.55, -0.8); b.rotation.y = Math.PI / 2; o.scene.add(b);
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mat(accent, { roughness: 0.9 })); bag.scale.set(1, 0.6, 1); bag.position.set(-2.8, 0.3, 2.8); o.scene.add(bag); o.addBox(-2.8, 2.8, 0.9, 0.9);
        box(2.2, 0.9, 0.6, 2.9, 0.45, D / 2 - 0.6, white, true); box(0.3, 0.38, 0.3, 2.3, 1.08, D / 2 - 0.6, mat('#1c1d21')); // kitchenette + coffee machine
        void H;
    },
    /** corporate lobby (Hermes Business Campus): reception, turnstile gates, glass partition, sofas */
    lobby(o, d) { lobbyCommon(o, d, '#7cc4e8', false); },
    /** bank tower lobby (BOB Tower): darker palette, deep-blue feature wall, turnstiles */
    bank(o, d) { return buildDBInterior(o,d); },
    /** Europe House/TECTO: photo-led selected workplace, all room dimensions estimated. */
    agency(o,d) { return buildArniaInterior(o,d); },
    /** UiPath Bucharest: the orange brand world — orange walls, robot figures, glass meeting rooms, bean bags */
    robots(o, { W, D, H, accent }) {
        const { box, mat } = o, desk = mat('#f6f6f4', { roughness: 0.5 }), or = mat('#fa4616', { roughness: 0.6 });
        box(0.15, H - 0.3, D - 2, -W / 2 + 0.15, (H - 0.3) / 2, 0, or);
        for (const side of [-1, 1]) for (let r = 0; r < 3; r++) { const x = side * 5, z = -1.6 + r * 2.8; box(3, 0.04, 0.9, x, 0.74, z, desk, true); for (const dx of [-0.6, 0.6]) { box(0.6, 0.36, 0.03, x + dx, 1.12, z - 0.3, mat('#111214')); box(0.55, 0.32, 0.01, x + dx, 1.12, z - 0.284, new THREE.MeshBasicMaterial({ color: '#2b3d55' })); } }
        for (let i = 0; i < 4; i++) robot(o, -W / 2 + 1.2, -4 + i * 2.2, 0.9 + (i % 2) * 0.25);
        meetingRoom(o, 5.5, -D / 2 + 2.6, 5, 3.2, H, accent);
        for (const [x, z] of [[-1.5, 5.5], [0, 6], [1.5, 5.5]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), or); b.scale.set(1, 0.6, 1); b.position.set(x, 0.29, z); o.scene.add(b); o.addBox(x, z, 0.8, 0.8); }
        box(W - 0.4, 0.05, 0.05, 0, H - 0.1, -D / 2 + 0.2, new THREE.MeshBasicMaterial({ color: '#ff7a45' })); // (at the ceiling line: it crossed the sign — note 12)
    },
    /** Lincoln Square North lobby: wood-panelled atrium, elevator bank, reception, tall windows onto downtown Bellevue */
    tower(o, { W, D, H, accent }) {
        const { box, mat } = o, wood = mat('#7a5a40', { roughness: 0.55 }), steel = mat('#b9bec4', { metalness: 0.85, roughness: 0.25 });
        box(0.2, H, D - 2, -W / 2 + 0.2, H / 2, 0, wood);
        for (let i = 0; i < 4; i++) {
            const z = -4.5 + i * 2.6;
            box(0.1, 2.6, 1.3, -W / 2 + 0.36, 1.3, z, steel); box(0.12, 2.8, 0.1, -W / 2 + 0.36, 1.4, z, mat('#2b2e33'));
            const ind = makeCanvasTexture(128, 32, (ctx) => { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 32); ctx.fillStyle = '#ffb347'; ctx.font = 'bold 22px monospace'; ctx.fillText(`▲ ${[12, 3, 27, 1][i]}`, 20, 24); });
            const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: ind })); p.position.set(-W / 2 + 0.42, 2.85, z); p.rotation.y = Math.PI / 2; o.scene.add(p);
        }
        box(4.5, 1.1, 1, 3, 0.55, -4, mat('#efe9df', { roughness: 0.35 }), true); box(4.6, 0.05, 1.1, 3, 1.12, -4, mat('#2b2e33', { roughness: 0.2, metalness: 0.3 }));
        for (const x of [-6.5, 6.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.6, 12), mat('#3a3d44')); p.position.set(x, 0.3, 4); o.scene.add(p); const t = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), mat('#3f7a3f')); t.position.set(x, 1.1, 4); o.scene.add(t); o.addBox(x, 4, 0.8, 0.8); }
        box(2.2, 0.45, 0.9, 5.5, 0.23, 3, mat('#5a5f66'), true);
        void accent;
    },
};
function lobbyCommon(o, { W, D, H, accent }, feature, dark) {
    const { box, mat } = o;
    box(0.2, H - 0.4, 6, -W / 2 + 0.2, (H - 0.4) / 2, -3, mat(feature, { roughness: 0.4 }));
    box(4.5, 1.1, 1, 3, 0.55, -4.5, mat(dark ? '#1b1f27' : '#f1f3f5', { roughness: 0.3 }), true); box(4.6, 0.05, 1.1, 3, 1.12, -4.5, mat('#dfe3e8', { roughness: 0.2, metalness: 0.5 }));
    // turnstile gates across the hall (gap in the middle for the visitor)
    for (let i = -3; i <= 3; i++) { if (i === 0) continue; const x = i * 1.0; box(0.18, 1.0, 1.2, x, 0.5, -0.5, mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }), true); const g = new THREE.Mesh(BOXG, new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, transparent: true, opacity: 0.35 })); g.scale.set(0.7, 0.8, 0.02); g.position.set(x + 0.45, 0.85, -0.5); o.scene.add(g); }
    box(1.2, 0.02, 0.4, 0, 0.01, -0.5, new THREE.MeshBasicMaterial({ color: accent }));
    for (const z of [3, 5]) box(2.2, 0.45, 0.9, -W / 2 + 2, 0.23, z, mat('#4a4f57'), true);
    meetingRoom(o, W / 2 - 3, -D / 2 + 2.6, 4, 3, Math.min(H, 3.2), accent);
}
function meetingRoom(o, x, z, w, d, h, accent) {
    const g = new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22 });
    for (const [px, pz, sw, sd] of [[x, z + d / 2, w, 0.04], [x - w / 2, z, 0.04, d]]) { const p = new THREE.Mesh(BOXG, g); p.scale.set(sw, h - 0.1, sd); p.position.set(px, (h - 0.1) / 2, pz); o.scene.add(p); }
    o.addBox(x, z, w, d);
    o.box(w - 1, 0.05, d - 1.4, x, 0.74, z, o.mat('#e8e4dc'));
    o.box(0.04, 0.06, d, x - w / 2, h - 0.15, z, new THREE.MeshBasicMaterial({ color: accent }));
}
function robot(o, x, z, s) {
    const { box, mat } = o, w = mat('#f4f4f2', { roughness: 0.35 }), or = mat('#fa4616', { roughness: 0.5 });
    box(0.9, 0.9, 0.5, x, 0.45, z, mat('#3a3d44'), true); // plinth
    box(0.42 * s, 0.5 * s, 0.32 * s, x, 0.9 + 0.25 * s, z, w); box(0.36 * s, 0.3 * s, 0.3 * s, x, 0.9 + 0.68 * s, z, w);
    box(0.24 * s, 0.07 * s, 0.01, x + 0.16 * s, 0.9 + 0.7 * s, z, or, false, Math.PI / 2); box(0.06 * s, 0.06 * s, 0.31 * s, x, 0.9 + 0.88 * s, z, or);
}
