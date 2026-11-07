import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture, clamp, damp, angleLerp } from './util.js';
import { drawFitText } from './canvasText.js';
import { makeCrowd } from './crowd.js';

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
/** painted view out of the window (1024×512): sky, the city's skyline type, street trees */
function paintView(ctx, w, h, kind) {
    const night = false; void night;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    if (kind === 'bellevue') { sky.addColorStop(0, '#7fa6cf'); sky.addColorStop(1, '#d9e4ee'); }
    else { sky.addColorStop(0, '#8fb8e6'); sky.addColorStop(1, '#e8eef4'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    let seed = kind.length * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (kind === 'bellevue') { // Cascades on the horizon + glass towers + trees
        ctx.fillStyle = '#9fb0c4'; ctx.beginPath(); ctx.moveTo(0, h * 0.55);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * (0.5 - 0.06 * Math.abs(Math.sin(x * 0.011)) - 0.03 * rnd())); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        for (let i = 0; i < 9; i++) {
            const bw = 60 + rnd() * 80, bx = rnd() * (w - bw), bh = h * (0.35 + rnd() * 0.45), by = h * 0.8 - bh;
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#5f7894'); g.addColorStop(1, '#8aa3bd');
            ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = by + 6; y < by + bh; y += 10) ctx.fillRect(bx, y, bw, 2);
        }
        ctx.fillStyle = '#2f4a32'; for (let x = 0; x < w; x += 18) { ctx.beginPath(); ctx.arc(x + rnd() * 10, h * 0.86 + rnd() * 10, 16 + rnd() * 10, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#5b6066'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
        return;
    }
    // Bucharest: socialist-era blocks (rosetti / upb / gts), glass office towers (pipera), mixed (romana)
    const towers = kind === 'pipera', mixed = kind === 'romana';
    for (let i = 0; i < 12; i++) {
        const glass = towers ? rnd() < 0.8 : mixed ? rnd() < 0.35 : false;
        const bw = 70 + rnd() * 90, bx = rnd() * (w - bw), bh = h * (glass ? 0.35 + rnd() * 0.45 : 0.2 + rnd() * 0.3), by = h * 0.82 - bh;
        ctx.fillStyle = glass ? '#6f8aa6' : ['#c9b9a2', '#b8ab96', '#d6cbb8', '#a99a86'][i % 4]; ctx.fillRect(bx, by, bw, bh);
        if (glass) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let y = by + 5; y < by + bh; y += 9) ctx.fillRect(bx, y, bw, 2); }
        else { ctx.fillStyle = 'rgba(40,45,55,0.55)'; for (let y = by + 10; y < by + bh - 8; y += 18) for (let x = bx + 8; x < bx + bw - 10; x += 16) ctx.fillRect(x, y, 9, 10); }
    }
    ctx.fillStyle = '#3f6b3a'; for (let x = 0; x < w; x += 22) { ctx.beginPath(); ctx.arc(x + rnd() * 12, h * 0.8 + rnd() * 12, 20 + rnd() * 12, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#6a6d70'; ctx.fillRect(0, h * 0.88, w, h * 0.12); ctx.fillStyle = '#d9d9d2'; for (let x = 0; x < w; x += 60) ctx.fillRect(x, h * 0.94, 30, 3);
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
    rosetti: { W: 10, D: 10, H: 3.4, floor: () => parquet('#8a5a34'), wallLow: '#5f7f5a', wall: '#ede3cc', ceil: '#f2efe6', view: 'bucharest', props: 'classroom',
        npc: { title: 'Form teacher', persona: 'teacher', look: { top: '#5a4636', bottom: '#2f3237', skin: '#e8bc9a', hair: '#5a4030' }, at: [-2.6, -3.6], yaw: 0.35 },
        mates: [[-1.3, -0.6, 'sit'], [1.3, 0.8, 'sit'], [3.2, 2.2, 'sit'], [-3.2, 2.2, 'phone']], tone: 'room' },
    upb: { W: 18, D: 22, H: 7, floor: () => stone('#d8d4cc', 'rgba(120,110,100,0.25)', 128), wallLow: '#b9b2a6', wall: '#e6e0d4', ceil: '#efe9df', view: 'bucharest', props: 'rectorat',
        npc: { title: 'Professor', persona: 'professor', look: { top: '#3a3d44', bottom: '#2f3237', skin: '#e8bc9a', hair: '#9a9a96' }, at: [2.5, -6], yaw: -0.4 },
        mates: [[-4, -2, 'talk'], [-3.2, -1.2, 'talk'], [5, 3, 'phone'], [-6, 5, 'walk']], tone: 'hall' },
    gts: { W: 9, D: 9, H: 2.9, floor: () => parquet('#b39470'), wallLow: '#f2f2ef', wall: '#f2f2ef', ceil: '#f7f7f5', view: 'bucharest', props: 'startup',
        npc: { title: 'Team lead', persona: 'lead', look: { top: '#1f2937', bottom: '#2c3e5c', skin: '#e8bc9a', hair: '#3b2a1e' }, at: [2.2, -2.6], yaw: -0.5 },
        mates: [[-2.6, -1.6, 'sit'], [-2.6, 0.9, 'sit'], [2.6, 0.9, 'sit']], tone: 'office' },
    luxoft: { W: 16, D: 18, H: 5, floor: () => stone('#3b3f46', 'rgba(255,255,255,0.08)', 128), wallLow: '#e9edf1', wall: '#f4f6f8', ceil: '#f4f6f8', view: 'pipera', props: 'lobby',
        npc: { title: 'Team lead', persona: 'lead', look: { top: '#1f2a44', bottom: '#2f3237', skin: '#e8bc9a', hair: '#1a1410' }, at: [3, -3.5], yaw: -0.3 },
        mates: [[-4, 2, 'phone'], [5, -6, 'walk'], [-5.5, -5, 'talk']], tone: 'lobby' },
    db: { W: 16, D: 18, H: 6, floor: () => stone('#22262d', 'rgba(255,255,255,0.07)', 128), wallLow: '#1c2a4a', wall: '#dfe4ec', ceil: '#e9edf2', view: 'pipera', props: 'bank',
        npc: { title: 'Engineering manager', persona: 'manager', look: { top: '#16181c', bottom: '#16181c', skin: '#e8bc9a', hair: '#3b2a1e' }, at: [-3, -3.5], yaw: 0.3 },
        mates: [[4, 1, 'phone'], [-5, 3, 'talk'], [-4.3, 3.6, 'talk']], tone: 'lobby' },
    arnia: { W: 14, D: 14, H: 3.2, floor: () => carpet('#4a4f57'), wallLow: '#f3f1ec', wall: '#f3f1ec', ceil: '#f6f5f2', view: 'romana', props: 'agency',
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

// questions per CV station title (the answers are the station's own lines / chips: CV content only)
function questionFor(title) {
    const t = title.toLowerCase();
    if (/^high school/.test(t)) return 'What did he study here?';
    if (/first code/.test(t)) return 'Where did he write his first code?';
    if (/^degree/.test(t)) return 'What did he graduate in?';
    if (/hackathon trophy/.test(t)) return 'I heard there was a trophy?';
    if (/^the job/.test(t)) return 'What did he work on here?';
    if (/learned here/.test(t)) return 'What did he learn here?';
    if (/^stack/.test(t)) return 'Which technologies did he use?';
    if (/teaching/.test(t)) return 'Did he teach or interview people?';
    if (/^hackathons/.test(t)) return 'Any hackathons?';
    if (/side quest|freelanc/.test(t)) return 'Did he do anything on the side?';
    if (/^then/.test(t)) return 'Why did he move on?';
    if (/off the clock/.test(t)) return 'What does he do off the clock?';
    if (/client/.test(t)) return `Tell me about the ${title.replace(/ — .*/, '')}.`;
    if (/engineer|principal|senior/.test(t)) return `What did he do as ${title.replace(/\s*\(.*\)/, '')}?`;
    return `Tell me about "${title}".`;
}
const PERSONA = {
    teacher: { hi: ['Good morning! Come in, sit wherever you like.', 'You are asking about Cristian? One of ours.'], more: 'And there is more…', bye: 'Good luck — and do your homework!', lead: ['Well,', 'Let me think.', 'Ah, yes.'] },
    professor: { hi: ['Welcome to the Rectorat.', 'Cristian? Yes, I remember the class.'], more: 'Since you ask…', bye: 'Good day. Mind the stairs.', lead: ['Indeed.', 'Let me see.', 'Well.'] },
    lead: { hi: ['Hey, welcome!', 'You want to know about Cristian? Grab a coffee.'], more: 'Oh, and also…', bye: 'Cool, see you around!', lead: ['So,', 'Right,', 'Okay so,'] },
    manager: { hi: ['Hi, welcome in.', 'Happy to tell you about Cristian.'], more: 'There is more to it:', bye: 'Thanks for stopping by!', lead: ['Sure.', 'Good question.', 'Right.'] },
    host: { hi: ['Welcome!'], more: 'Also:', bye: 'Have a good flight!', lead: ['Sure.'] },
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
 * Walkable CV-stop interior with an in-character NPC (note 37): walk up to them, E (or tap) to talk; questions A–D
 * (keys 1–4 / A–D, mouse, touch), answers are the CV lines of that stop only; "Thanks, bye" (Esc / D) ends the talk.
 * Compatible with the old screen API: `read` (Set of answered topic indices), `done`, `stations[]` ({data, x, z, index}),
 * `exitZ`. Every answer dispatches `window` event `cv-answer` {stop, index, title, part} and calls `onAnswer(detail)`.
 */
export class Office {
    constructor(renderer, camera, stop, hud, input, audio) {
        this.renderer = renderer; this.camera = camera; this.stop = stop; this.hud = hud; this.input = input; this.audio = audio;
        this.theme = THEMES[stop.id] || DEFAULT_THEME;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1a1d24');
        this.done = false;
        this.read = new Set();
        this.onAnswer = null;
        this.x = 0; this.z = 0; this.heading = 0; this.pitch = 0; this.vel = 0; this.vx = 0; this.vz = 0;
        this.jumpY = 0; this.vy = 0;
        this.stations = [];
        this.boxes = [];
        this.talking = false;
        this.build();
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
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.45, metalness: 0.05 }));
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
        view.position.set(W / 2 + 0.25, winY, 0); view.rotation.y = -Math.PI / 2; this.scene.add(view);
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
            box(1.2, 0.04, 0.3, x, H - 0.03, z, new THREE.MeshBasicMaterial({ color: '#fffaf0' }));
        }
        // company sign (fitted text) on the back wall + accent stripe
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8, W * 0.55), Math.min(8, W * 0.55) / 4), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(1024, 256, (ctx) => drawLobbySign(ctx, s, accent)) }));
        sign.position.set(0, Math.min(H - 1, 2.4 + (H - 3) * 0.4), -D / 2 + 0.12); this.scene.add(sign); this.signMesh = sign;
        if (T.props !== 'classroom') box(W, 0.06, 0.04, 0, low + 0.04, -D / 2 + 0.12, new THREE.MeshBasicMaterial({ color: accent }));
        // themed props
        (PROPS[T.props] || PROPS.startup)(this, { W, D, H, accent, s });
        // NPC + colleagues (instanced crowd: 2 draw calls)
        const city = s.city || 'bucharest';
        this.crowd = makeCrowd({ max: 8, city, rng: makeRngLite(s.id.length * 31) });
        this.scene.add(this.crowd.object);
        const n = T.npc; this.npc = { x: n.at[0], z: n.at[1], yaw: n.yaw, title: n.title, persona: n.persona };
        this.crowd.dress(0, { ...n.look, acc: '#111214', flags: 0 });
        T.mates.forEach(([x, z, pose], i) => { const ps = pose === 'walk' ? 'stand' : pose; this.crowd.set(i + 1, { x, y: pose === 'sit' ? 0 : 0, z, yaw: Math.atan2(x - n.at[0], z - n.at[1]) * 0 + (i % 2 ? 0.6 : -0.6), pose: ps, prop: ps === 'phone' ? 'phone' : null, scale: 0.94 + (i % 3) * 0.04 }); this.addBox(x, z, 0.7, 0.7); });
        this.crowd.count = 1 + T.mates.length;
        this.addBox(n.at[0], n.at[1], 0.6, 0.6);
        // stations (compat): every CV station is a topic of the conversation, located at the NPC
        (s.stations || []).forEach((st, i) => this.stations.push({ data: st, x: n.at[0], z: n.at[1], index: i, mesh: null, glow: { intensity: 0 } }));
        this.portrait = portraitURL(n.look, n.persona);
        // exit mat by the door (front wall)
        const exit = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: makeCanvasTexture(256, 128, (ctx) => drawExitMat(ctx)) }));
        exit.rotation.x = -Math.PI / 2; exit.position.set(0, 0.02, D / 2 - 0.9); this.scene.add(exit);
        box(1.6, 2.3, 0.08, 0, 1.15, D / 2 - 0.08, mat('#3b3f46', { roughness: 0.4, metalness: 0.3 })); // door
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
        this.camRig.position.set(this.x, 1.62 + this.jumpY + bob, this.z);
        this.camRig.rotation.set(this.pitch, this.heading, 0, 'YXZ');
        this.camera.fov = damp(this.camera.fov, 70, 5, dt); this.camera.updateProjectionMatrix();
        // NPC: idle / talking, turns toward the player when near
        const n = this.npc, dN = Math.hypot(this.x - n.x, this.z - n.z);
        if (dN < 4) n.yaw = angleLerp(n.yaw, Math.atan2(-(this.x - n.x), -(this.z - n.z)) + Math.PI, 1 - Math.exp(-4 * dt));
        this.crowd.set(0, { x: n.x, y: 0, z: n.z, yaw: n.yaw, pose: this.talking ? 'talk' : 'stand', phase: this.t });
        const near = dN < 2.6;
        const atExit = this.z > this.exitZ - 1.2 && Math.abs(this.x) < 1.6;
        const N = this.stations.length;
        if (panel) this.hud.prompt(null);
        else if (near) { this.hud.prompt(`<kbd>E</kbd> Talk to the ${n.title.toLowerCase()} ${this.read.size ? `<small>(${this.read.size}/${N} answers heard)</small>` : ''}`); if (inp.take('KeyE')) { inp.releaseLock(); this.talk(); } }
        else if (atExit) { this.hud.prompt(`<kbd>E</kbd> Leave ${this.stop.short} ${this.read.size < N ? `<small>(${N - this.read.size} questions left)</small>` : '✓'}`); if (inp.take('KeyE')) this.done = true; }
        else this.hud.prompt(null);
        if (inp.take('Escape') && !panel) this.done = true;
        const touch = document.body.classList.contains('touch');
        const lookHint = touch ? 'drag to look' : inp.lookMode === 'lock' ? (inp.locked ? 'mouse look · Esc frees the cursor' : 'click to look around') : 'A/D turn';
        this.hud.setHint(`${this.read.size}/${N} answers heard · walk to the ${n.title.toLowerCase()} and press E · W/S walk · ${lookHint} · Esc leave`);
    }

    // ---------------------------------------------------------------------------------------------------------------
    //  dialogue
    // ---------------------------------------------------------------------------------------------------------------
    /** open the conversation (also the harness entry point: `o.open(o.stations[i])` asks topic i directly) */
    talk(first = null) {
        this.talking = true; this.part = {}; this.audio.blip?.(660, 0.06, 0.06);
        const P = PERSONA[this.npc.persona] || PERSONA.manager, s = this.stop;
        this.hud.panel('<div class="dlg"></div>', { closable: false });
        this._keyH = (e) => this.onKey(e); window.addEventListener('keydown', this._keyH, true);
        // the greeting introduces him with the first topic, so even a short chat counts (answer events fire)
        this.greet = `${esc(P.hi[0])} ${esc(P.hi[1] || '')} He was here ${esc(s.period.replace(' – ', ' to '))} — ${esc(s.role)}.`;
        this.answer(first != null ? first : ([...Array(this.stations.length).keys()].find(i => !this.read.has(i)) ?? 0), 0, true);
    }
    open(st) { if (!this.talking) this.talk(st.index); else this.answer(st.index, 0); }
    options() {
        const opts = [], N = this.stations.length;
        if (this.cur != null && this.part[this.cur] === 1) opts.push({ label: (PERSONA[this.npc.persona] || PERSONA.manager).more.replace(/…|:$/, '') + ' — tell me more', act: () => this.answer(this.cur, 1) });
        for (let i = 0; i < N && opts.length < 3; i++) if (!this.read.has(i)) opts.push({ label: questionFor(this.stations[i].data.title), act: () => this.answer(i, 0) });
        for (let i = 0; i < N && opts.length < 3; i++) if (this.read.has(i) && i !== this.cur) opts.push({ label: '↺ ' + questionFor(this.stations[i].data.title), act: () => this.answer(i, 0), again: true });
        opts.push({ label: 'Thanks, bye', act: () => this.endTalk(true), bye: true });
        return opts;
    }
    show(text, sub = '') {
        const el = this.hud.el?.panel?.querySelector('.dlg') || document.querySelector('#panel .dlg'); if (!el) return;
        const N = this.stations.length, s = this.stop;
        this.opts = this.options();
        el.innerHTML = `<div class="dlg-head"><img class="dlg-portrait" alt="" src="${this.portrait}"><div><div class="dlg-name">${esc(this.npc.title)}</div><div class="dlg-where" style="color:${s.color}">${s.icon || ''} ${esc(s.company)} · ${esc(s.period)}</div></div><div class="dlg-count">${this.read.size}/${N}</div></div>`
            + `<div class="dlg-text">${text}</div>${sub ? `<div class="dlg-sub">${sub}</div>` : ''}`
            + `<ol class="dlg-opts">${this.opts.map((o, i) => `<li><button data-opt="${i}" class="${o.bye ? 'bye' : ''}${o.again ? ' again' : ''}"><kbd>${'ABCD'[i]}</kbd>${esc(o.label)}</button></li>`).join('')}</ol>`;
        el.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); this.pick(+b.dataset.opt); }));
    }
    pick(i) { const o = this.opts?.[i]; if (o) { this.audio.blip?.(880, 0.03, 0.04); o.act(); } }
    onKey(e) {
        if (!this.talking) return;
        const k = e.code, map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
        if (k in map) { e.preventDefault(); e.stopPropagation(); this.pick(Math.min(map[k], this.opts.length - 1 === map[k] ? map[k] : map[k])); }
        else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); this.endTalk(true); }
    }
    answer(i, part, greet = false) {
        const st = this.stations[i]; if (!st) return;
        const d = st.data, P = PERSONA[this.npc.persona] || PERSONA.manager;
        this.cur = i;
        let body;
        if (d.chips) body = `${P.lead[i % P.lead.length]} he worked with ${d.chips.slice(0, -1).map(esc).join(', ')}${d.chips.length > 1 ? ' and ' : ''}${esc(d.chips[d.chips.length - 1])}.`;
        else {
            const lines = d.lines || [], cut = lines.length > 2 ? 2 : lines.length;
            const show = part === 0 ? lines.slice(0, cut) : lines.slice(cut);
            body = `${part === 0 ? P.lead[i % P.lead.length] + ' ' : ''}${show.map(esc).join(' ')}`;
            this.part[i] = part === 0 && lines.length > cut ? 1 : 2;
        }
        const first = !this.read.has(i);
        this.read.add(i);
        const detail = { stop: this.stop.id, index: i, title: d.title, part, first };
        try { this.onAnswer?.(detail); } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('cv-answer', { detail })); } catch { /* ignore */ }
        this.show(`${greet ? `<p class="dlg-greet">${this.greet}</p>` : ''}<b class="dlg-q">${esc(questionFor(d.title))}</b>${body}`, this.read.size === this.stations.length && first ? '✓ You have heard everything about this stop.' : '');
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
        if (this.talking) this.endTalk(false);
        this.stopTone();
        this.input.releaseLock(); this.camRig.remove(this.camera);
        this.crowd?.dispose();
        this.scene.traverse(o => { if (o.geometry && o.geometry !== BOXG && !o.userData.shared) o.geometry.dispose(); });
    }
}
function makeRngLite(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------------------------------------------------------------------------------------------------------------------
//  prop sets per interior
// ---------------------------------------------------------------------------------------------------------------------
const PROPS = {
    /** 2009 classroom: chalkboard, teacher's desk, double school desks + chairs, notice board, beige CRT, radiator */
    classroom(o, { W, D, H, accent }) {
        const { box, mat } = o, wood = mat('#a0703f', { roughness: 0.6 }), metal = mat('#3d4148', { roughness: 0.5, metalness: 0.5 });
        const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshStandardMaterial({ roughness: 0.9, map: makeCanvasTexture(1024, 320, (ctx) => {
            ctx.fillStyle = '#20402e'; ctx.fillRect(0, 0, 1024, 320); ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 1024, Math.random() * 320, 80, 3);
            ctx.fillStyle = '#ece9e0'; ctx.textAlign = 'center';
            drawFitText(ctx, 'Matematică-Informatică · 2009', 512, 90, 900, { maxSize: 64, minSize: 24, font: (sz) => `italic ${sz}px "Comic Sans MS", "Segoe Print", cursive`, label: 'chalkboard title' });
            drawFitText(ctx, 'f(x) = x² − 4x + 3   ·   program p; begin writeln(\'Hello\'); end.', 512, 210, 960, { maxSize: 40, minSize: 16, font: (sz) => `${sz}px "Courier New", monospace`, label: 'chalkboard code' });
        }) }));
        board.position.set(0, 1.75, -D / 2 + 0.12); o.scene.add(board);
        box(4.4, 0.08, 0.08, 0, 1.08, -D / 2 + 0.16, wood); box(4.5, 1.5, 0.04, 0, 1.75, -D / 2 + 0.1, wood);
        o.signMesh.position.set(-W / 2 + 0.13, 2.6, -1); o.signMesh.rotation.y = Math.PI / 2; o.signMesh.scale.setScalar(0.45); // school name on the side wall
        box(1.4, 0.06, 0.7, -2.6, 0.76, -3.1, wood, true); box(1.3, 0.7, 0.04, -2.6, 0.4, -2.78, wood);
        for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c++) {
            const x = c * 3.2, z = -1.4 + r * 1.6;
            box(1.25, 0.04, 0.5, x, 0.74, z, wood, true); for (const dx of [-0.55, 0.55]) box(0.04, 0.72, 0.45, x + dx, 0.37, z, metal);
            for (const dx of [-0.3, 0.3]) { box(0.38, 0.04, 0.38, x + dx, 0.44, z + 0.45, wood); box(0.38, 0.4, 0.03, x + dx, 0.68, z + 0.65, wood); }
        }
        const notice = makeCanvasTexture(512, 256, (ctx) => { ctx.fillStyle = '#b08a5a'; ctx.fillRect(0, 0, 512, 256); const cols = ['#fff7c2', '#ffffff', '#cde8ff', '#ffd9d9']; for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[i % 4]; ctx.save(); ctx.translate(30 + (i % 5) * 96, 30 + Math.floor(i / 5) * 110); ctx.rotate((i % 3 - 1) * 0.05); ctx.fillRect(0, 0, 80, 96); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(40, 6, 5, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 22; y < 90; y += 10) ctx.fillRect(8, y, 64, 2); ctx.restore(); } });
        const nb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: notice, roughness: 0.9 })); nb.position.set(0, 1.7, D / 2 - 0.12); nb.rotation.y = Math.PI; o.scene.add(nb);
        box(0.5, 0.42, 0.45, -W / 2 + 0.6, 1.0, 2.6, mat('#d9d2bd')); box(0.5, 0.05, 0.6, -W / 2 + 0.6, 0.76, 2.6, wood, true); // beige CRT on a side table
        box(0.44, 0.32, 0.02, -W / 2 + 0.86, 1.02, 2.6, new THREE.MeshBasicMaterial({ color: '#2a4d6b' }), false, Math.PI / 2);
        box(0.12, 0.6, 3.6, W / 2 - 0.3, 0.55, 0, mat('#e6e6e0')); // radiator under the windows
        void H; void accent;
    },
    /** Rectorat hall: columns, benches, glass case with the BEST hackathon trophy, notice board of the faculty */
    rectorat(o, { W, D, H, accent }) {
        const { box, mat } = o, col = mat('#ece6da', { roughness: 0.5 }), wood = mat('#6e4a2c', { roughness: 0.5 });
        for (const x of [-W / 2 + 3, W / 2 - 3]) for (let z = -D / 2 + 4; z < D / 2 - 2; z += 5) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, H, 16), col); c.position.set(x, H / 2, z); c.castShadow = true; o.scene.add(c); o.addBox(x, z, 1, 1); box(1.2, 0.3, 1.2, x, 0.15, z, col); }
        for (let r = 0; r < 3; r++) box(6, 0.45, 0.6, -2, 0.23 + r * 0.3, 4 + r * 1.2, wood, true); // tiered benches
        box(1.2, 1.0, 1.2, 4, 0.5, -3, mat('#2b2e33'), true);
        const glass = new THREE.Mesh(BOXG, new THREE.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25 })); glass.scale.set(1.1, 1.0, 1.1); glass.position.set(4, 1.5, -3); o.scene.add(glass);
        const cup = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.05, 0.08], [0.04, 0.3], [0.16, 0.5], [0.18, 0.66], [0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y)), 18), mat('#d4a62a', { roughness: 0.25, metalness: 0.9 }));
        cup.position.set(4, 1.02, -3); o.scene.add(cup);
        const lbl = makeCanvasTexture(512, 128, (ctx) => { ctx.fillStyle = '#1b1d22'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = '#e8d9a8'; ctx.textAlign = 'center'; drawFitText(ctx, 'BEST Engineering Marathon · 1st place · 2017', 256, 64, 480, { maxSize: 34, minSize: 14, font: (sz) => `600 ${sz}px Georgia, serif`, label: 'trophy plaque' }); });
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.27), new THREE.MeshBasicMaterial({ map: lbl })); pl.position.set(4, 0.7, -2.38); o.scene.add(pl);
        for (let z = -D / 2 + 4; z < D / 2 - 2; z += 6) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff0c8', emissiveIntensity: 1.2 })); ch.position.set(0, H - 1.2, z); o.scene.add(ch); }
        box(W - 2, 0.12, 0.3, 0, H - 0.6, -D / 2 + 0.25, mat('#cbb68a', { metalness: 0.5, roughness: 0.4 })); // gilt cornice
        void accent;
    },
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
    bank(o, d) { lobbyCommon(o, d, '#1d4ed8', true); },
    /** Arnia (Europe House): open space, amber feature wall, glass meeting room, dual monitors */
    agency(o, { W, D, H, accent }) {
        const { box, mat } = o, desk = mat('#e8e4dc', { roughness: 0.5 });
        box(0.15, H - 0.3, 4, -W / 2 + 0.15, (H - 0.3) / 2, -2, mat(accent, { roughness: 0.6 }));
        for (const side of [-1, 1]) for (let r = 0; r < 3; r++) { const x = side * 4, z = -1.6 + r * 2.4; box(2.6, 0.04, 0.9, x, 0.74, z, desk, true); for (const dx of [-0.45, 0.45]) { box(0.6, 0.36, 0.03, x + dx, 1.12, z - 0.3, mat('#111214')); box(0.55, 0.32, 0.01, x + dx, 1.12, z - 0.284, new THREE.MeshBasicMaterial({ color: '#2b4c6f' })); } }
        meetingRoom(o, 3.5, -D / 2 + 2.6, 4, 3, H, accent);
        void W;
    },
    /** UiPath Bucharest: the orange brand world — orange walls, robot figures, glass meeting rooms, bean bags */
    robots(o, { W, D, H, accent }) {
        const { box, mat } = o, desk = mat('#f6f6f4', { roughness: 0.5 }), or = mat('#fa4616', { roughness: 0.6 });
        box(0.15, H - 0.3, D - 2, -W / 2 + 0.15, (H - 0.3) / 2, 0, or);
        for (const side of [-1, 1]) for (let r = 0; r < 3; r++) { const x = side * 5, z = -1.6 + r * 2.8; box(3, 0.04, 0.9, x, 0.74, z, desk, true); for (const dx of [-0.6, 0.6]) { box(0.6, 0.36, 0.03, x + dx, 1.12, z - 0.3, mat('#111214')); box(0.55, 0.32, 0.01, x + dx, 1.12, z - 0.284, new THREE.MeshBasicMaterial({ color: '#2b3d55' })); } }
        for (let i = 0; i < 4; i++) robot(o, -W / 2 + 1.2, -4 + i * 2.2, 0.9 + (i % 2) * 0.25);
        meetingRoom(o, 5.5, -D / 2 + 2.6, 5, 3.2, H, accent);
        for (const [x, z] of [[-1.5, 5.5], [0, 6], [1.5, 5.5]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), or); b.scale.set(1, 0.6, 1); b.position.set(x, 0.29, z); o.scene.add(b); o.addBox(x, z, 0.8, 0.8); }
        box(W - 0.4, 0.05, 0.05, 0, H - 0.4, -D / 2 + 0.2, new THREE.MeshBasicMaterial({ color: '#ff7a45' }));
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
        for (const x of [-3, 0]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.6, 12), mat('#3a3d44')); p.position.set(x, 0.3, 4); o.scene.add(p); const t = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), mat('#3f7a3f')); t.position.set(x, 1.1, 4); o.scene.add(t); o.addBox(x, 4, 0.8, 0.8); }
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
