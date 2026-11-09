import * as THREE from '../vendor/three.module.min.js';
import { GeoBatch, makeCanvasTexture } from './util.js';

// ============================================================================
//  Street-specific building styles. Each generator returns a list of parts:
//  { kind: 'win'|'plain'|'shop'|'roof', x, y, z (local, centred on lot), w, h, d, color, tex? }
//  Local frame: +z points toward the street (the front), x along the street.
// ============================================================================

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PYR = new THREE.ConeGeometry(0.72, 1, 4); PYR.rotateY(Math.PI / 4); // square pyramid roof, base 1x1

/** Projecting facade slab with outward faces. `back` keeps a balcony parapet a thin plate rather than a solid room.
 *  The building wall hides the rear face when back is at the wall; detached plates also get an inward face.
 *  10 triangles against the wall / 12 for a detached plate, merged into the caller's existing detail mesh. */
export function emitFacadeSlab(mb, frame, s, y, w, h, depth, color, { back = 0.02, ends = true, soffit = true } = {}) {
    const { ax, az, ux, uz, nx, nz } = frame;
    const at = (u, d, yy) => [ax + ux * u + nx * d, yy, az + uz * u + nz * d];
    const a = at(s - w / 2, back, y), b = at(s + w / 2, back, y), c = at(s + w / 2, depth, y), d = at(s - w / 2, depth, y);
    const top = p => [p[0], y + h, p[2]], tint = k => color.map(v => Math.min(255, Math.round(v * k)));
    mb.face4(d, c, top(c), top(d), color, [nx, 0, nz]);
    mb.face4(top(a), top(b), top(c), top(d), tint(1.06), [0, 1, 0]);
    if (soffit) mb.face4(a, b, c, d, tint(0.75), [0, -1, 0]);
    if (ends) {
        mb.face4(a, d, top(d), top(a), tint(0.9), [-ux, 0, -uz]);
        mb.face4(c, b, top(b), top(c), tint(0.9), [ux, 0, uz]);
    }
    if (back > 0.02) mb.face4(b, a, top(a), top(b), color, [-nx, 0, -nz]);
}

export const PALETTE = {
    interwar: ['#e6dccb', '#efe7d8', '#d9cfbd', '#f1ece1', '#cfc5b2', '#e2d6bf'],
    eclectic: ['#e9d9b8', '#d8c6a3', '#efe3cc', '#cbbfa6', '#e4cfa7', '#d6d0c2', '#e8d8c4'],
    civic: ['#efe9db', '#e8e1cf', '#f3eee3', '#e4dccb'],
    bloc: ['#b9b5aa', '#c7c2b6', '#a9a69d', '#d1cdc3', '#bcb3a4', '#aeaaa0'],
    glass: ['#5b86a8', '#6f9bbd', '#4d7593', '#7fa7c4', '#3d5e78', '#86a9bf', '#2f4a60'],
    villa: ['#f1e8d4', '#ebdfc6', '#f6efe0', '#e3d6bd', '#dcd2c0'],
    campus: ['#d9d2c0', '#cfc8b4'],
    retail: ['#e3e3e0', '#d6d8da', '#eeeeee'],
    rural: ['#eae2d0', '#f0e9da', '#d8cfbb', '#cfd6c4'],
    suburb: ['#d8d2c4', '#c9cfd3', '#e6e1d6', '#b7c1c9', '#cbbfae', '#9fb0b8', '#e0d6c3'],
    industrial: ['#9a9ea2', '#8d9194', '#a7abae', '#b5b1a8'],
    tower: ['#4f6d8a', '#3c5570', '#6a8aa6', '#2c3e52', '#7d97ad'],
};
const SHOP_COLORS = ['#c0392b', '#2c3e50', '#16a085', '#f39c12', '#8e44ad', '#2980b9', '#d35400', '#27ae60'];

export function makeTextures() {
    const T = {};
    const tex = (name, draw, w = 256, h = 256) => { const t = makeCanvasTexture(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; T[name] = t; return t; };
    const win = (ctx, w, h, { cols, rows, ww, wh, frame = 'rgba(255,255,255,0.35)', glass = 'rgba(35,55,85,0.78)', sill = true }) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const cw = w / cols, ch = h / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const x = i * cw + cw * (1 - ww) / 2, y = j * ch + ch * (1 - wh) / 2;
            ctx.fillStyle = frame; ctx.fillRect(x - 2, y - 2, cw * ww + 4, ch * wh + 4);
            ctx.fillStyle = glass; ctx.fillRect(x, y, cw * ww, ch * wh);
            ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, cw * ww, ch * wh * 0.18);
            if (sill) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - 3, y + ch * wh, cw * ww + 6, 3); }
        }
    };
    // interwar modernism: wide horizontal windows, strong floor bands
    tex('interwar', (ctx, w, h) => { win(ctx, w, h, { cols: 2, rows: 2, ww: 0.72, wh: 0.42 }); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let j = 0; j < 2; j++) ctx.fillRect(0, j * h / 2 + h / 2 - 6, w, 6); });
    // eclectic / neoclassical: tall narrow windows with frames
    tex('eclectic', (ctx, w, h) => { win(ctx, w, h, { cols: 3, rows: 2, ww: 0.42, wh: 0.6, frame: 'rgba(255,255,255,0.6)' }); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, h / 2 - 5, w, 5); });
    // civic centre: tall windows in pairs, light stone
    tex('civic', (ctx, w, h) => { win(ctx, w, h, { cols: 4, rows: 2, ww: 0.4, wh: 0.62, glass: 'rgba(40,55,80,0.7)', frame: 'rgba(255,255,255,0.5)' }); });
    // communist bloc: small windows, concrete panel seams
    tex('bloc', (ctx, w, h) => { win(ctx, w, h, { cols: 4, rows: 2, ww: 0.5, wh: 0.48, glass: 'rgba(30,40,60,0.8)', frame: 'rgba(255,255,255,0.25)' }); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); } for (let j = 0; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(0, j * h / 2); ctx.lineTo(w, j * h / 2); ctx.stroke(); } });
    // glass curtain wall
    tex('glass', (ctx, w, h) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? 'rgba(20,40,65,0.55)' : 'rgba(40,70,100,0.5)'; ctx.fillRect(i * w / 4 + 2, j * h / 2 + 2, w / 4 - 4, h / 2 - 4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(i * w / 4 + 2, j * h / 2 + 2, w / 4 - 4, 8); } });
    // houses / villas
    tex('house', (ctx, w, h) => { win(ctx, w, h, { cols: 3, rows: 1, ww: 0.42, wh: 0.5, frame: 'rgba(255,255,255,0.7)', glass: 'rgba(50,70,95,0.7)' }); });
    // shopfronts at ground level
    tex('shop', (ctx, w, h) => {
        // (play-test note 10a) four shop units: plain fascia boards in muted materials (no fake white 'text' blanks: named
        // businesses get their real sign from world.js), framed display windows with mullions and a recessed door
        const FASCIA = ['#2f3437', '#3b4a3f', '#2c3a52', '#5a4632', '#4a4a4a', '#6b5b4b', '#33302c', '#40474f'];
        ctx.fillStyle = '#3a3c40'; ctx.fillRect(0, 0, w, h);
        const n = 4, sw = w / n;
        for (let i = 0; i < n; i++) {
            const x0 = i * sw;
            ctx.fillStyle = FASCIA[(i * 3 + 1) % FASCIA.length]; ctx.fillRect(x0 + 2, 0, sw - 4, 18);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0 + 2, 0, sw - 4, 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + 2, 16, sw - 4, 2);
            const g = ctx.createLinearGradient(0, 22, 0, h - 10); g.addColorStop(0, 'rgba(150,180,205,0.75)'); g.addColorStop(0.5, 'rgba(70,90,110,0.8)'); g.addColorStop(1, 'rgba(40,50,60,0.85)');
            const door = i % 2 === 0 ? x0 + sw * 0.66 : x0 + sw * 0.08, dw = sw * 0.24;
            ctx.fillStyle = g; ctx.fillRect(x0 + 6, 22, sw - 12, h - 32);
            ctx.fillStyle = 'rgba(25,28,32,0.95)'; ctx.fillRect(door, 24, dw, h - 26);                    // recessed door
            ctx.fillStyle = 'rgba(120,140,160,0.5)'; ctx.fillRect(door + 4, 30, dw - 8, h - 46);           // its glass
            ctx.fillStyle = '#22252a';                                                                   // mullions + sill
            for (const f of [0.33, 0.5]) { const mx = x0 + 6 + (sw - 12) * f; if (mx < door - 3 || mx > door + dw + 3) ctx.fillRect(mx - 1.5, 22, 3, h - 32); }
            ctx.fillRect(x0 + 6, h - 12, sw - 12, 4); ctx.fillRect(x0 + 6, 22, sw - 12, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0 + 10, h - 14); ctx.lineTo(x0 + sw * 0.35, 25); ctx.lineTo(x0 + sw * 0.45, 25); ctx.lineTo(x0 + 22, h - 14); ctx.fill(); // reflection streak
        }
    }, 512, 128);
    return T;
}

const rnd = (rng, a, b) => a + (b - a) * rng();

/** Generate parts for one building on a lot of frontage `w` (along street) and depth `d`. */
export function generateBuilding(style, w, d, rng, opts = {}) {
    const parts = [];
    const P = (kind, x, y, z, bw, bh, bd, color, extra = {}) => parts.push({ kind, x, y, z, w: bw, h: bh, d: bd, color, ...extra });
    const pal = PALETTE[style] || PALETTE.interwar;
    const col = () => rng.pick(pal);
    let h;
    switch (style) {
        case 'interwar': { // Magheru / Bălcescu: 8–10 floors, bands, set-back penthouse, shops below
            const floors = rng.int(7, 10), fh = 3.3; h = floors * fh; const c = col();
            P('shop', 0, 2.2, 0, w, 4.4, d, '#ffffff');
            P('win', 0, 4.4 + (h - 4.4) / 2, 0, w, h - 4.4, d, c, { tex: 'interwar', floorH: fh });
            for (let f = 2; f < floors; f++) P('plain', 0, f * fh - 0.1, d / 2 + 0.12, w, 0.25, 0.25, shade(c, 0.78)); // floor bands on the front
            P('plain', 0, h + 0.3, 0, w + 0.5, 0.6, d + 0.5, shade(c, 0.7));
            if (rng.chance(0.6)) { P('win', rnd(rng, -1, 1), h + 0.6 + 1.5, -1.2, w - 4, 3, d - 3, c, { tex: 'interwar', floorH: fh }); }
            else P('roof', 0, h + 0.65, 0, w - 1, 0.1, d - 1, '#8a8075');
            break;
        }
        case 'eclectic': { // Calea Victoriei: 4–6 floors, cornices, mansard roofs, shops
            const floors = rng.int(4, 6), fh = 3.7; h = floors * fh; const c = col();
            P('shop', 0, 2.3, 0, w, 4.6, d, '#ffffff');
            P('win', 0, 4.6 + (h - 4.6) / 2, 0, w, h - 4.6, d, c, { tex: 'eclectic', floorH: fh });
            P('plain', 0, 4.6, d / 2 + 0.15, w, 0.35, 0.3, shade(c, 0.75));
            P('plain', 0, h + 0.3, 0, w + 0.9, 0.7, d + 0.9, shade(c, 0.72)); // cornice
            P('plain', 0, h + 0.65 + 1.4, 0, w - 0.6, 2.8, d - 0.6, rng.pick(['#4b4f57', '#5a4a41', '#3f444c'])); // mansard
            P('plain', 0, h + 3.5, 0, w - 2, 0.3, d - 2, '#3a3d44');
            if (rng.chance(0.5)) for (let i = -1; i <= 1; i += 2) P('plain', i * (w / 2 - 1.2), 2.4, d / 2 + 0.25, 0.6, 4.8, 0.5, shade(c, 0.85)); // pilasters
            break;
        }
        case 'civic': { // Bd. Unirii: Ceaușescu civic centre, 8–10 floors, colonnade, uniform
            const floors = rng.int(8, 10), fh = 3.4; h = floors * fh; const c = col();
            P('win', 0, 6 + (h - 6) / 2, 0, w, h - 6, d, c, { tex: 'civic', floorH: fh });
            P('plain', 0, 3, -1.5, w, 6, d - 3, shade(c, 0.9)); // recessed ground floor behind the colonnade
            for (let x = -w / 2 + 2; x < w / 2 - 1; x += 4) P('plain', x, 3, d / 2 - 0.6, 1.0, 6, 1.0, shade(c, 1.02)); // columns
            P('plain', 0, 6.2, 0, w + 0.3, 0.5, d + 0.3, shade(c, 0.8));
            P('plain', 0, h + 0.4, 0, w + 0.6, 0.8, d + 0.6, shade(c, 0.78));
            P('plain', 0, h + 1.6, 0, w - 2, 1.6, d - 2, shade(c, 0.95)); // attic
            break;
        }
        case 'bloc': { // communist panel blocks: long slabs with balconies
            const floors = rng.int(8, 10), fh = 2.8; h = floors * fh; const c = col();
            P('win', 0, h / 2, 0, w, h, d, c, { tex: 'bloc', floorH: fh });
            const bc = rng.pick(['#9a9288', '#a79f94', '#8d8a85']);
            for (let x = -w / 2 + 3; x < w / 2 - 2; x += 6) for (let f = 1; f < floors; f++) P('plain', x, f * fh + 0.5, d / 2 + 0.6, 3, 1.0, 1.2, bc); // balconies
            P('plain', 0, h + 0.25, 0, w + 0.2, 0.5, d + 0.2, '#6f6c67');
            P('plain', rnd(rng, -w / 4, w / 4), h + 1.5, 0, 4, 2.5, 3, '#8a8782'); // stair/lift box
            break;
        }
        case 'glass': { // Pipera / Floreasca offices
            const floors = rng.int(8, 22), fh = 3.6; h = floors * fh; const c = col();
            P('win', 0, h / 2, 0, w, h, d, c, { tex: 'glass', floorH: fh });
            for (let x = -w / 2; x <= w / 2; x += w / Math.max(2, Math.round(w / 6))) P('plain', x, h / 2, d / 2 + 0.08, 0.25, h, 0.16, shade(c, 0.55)); // mullions
            P('plain', 0, h + 0.3, 0, w + 0.2, 0.6, d + 0.2, '#2b3a48');
            P('plain', rnd(rng, -w / 4, w / 4), h + 1.8, rnd(rng, -d / 4, d / 4), w * 0.4, 3, d * 0.4, '#3a4652'); // mechanical
            P('plain', 0, 2.3, d / 2 + 1.2, Math.min(w * 0.6, 10), 0.3, 2.4, '#2b3a48'); // canopy
            break;
        }
        case 'tower': { // skyline towers
            const floors = rng.int(18, 60), fh = 3.6; h = floors * fh; const c = col();
            P('win', 0, h / 2, 0, w, h, d, c, { tex: 'glass', floorH: fh });
            P('plain', 0, h + 0.4, 0, w + 0.3, 0.8, d + 0.3, '#1f2a36');
            if (rng.chance(0.5)) P('plain', 0, h + 3, 0, w * 0.5, 5, d * 0.5, '#2b3a48');
            if (rng.chance(0.3)) P('plain', 0, h + 12, 0, 0.6, 16, 0.6, '#9aa3ad'); // antenna
            break;
        }
        case 'villa': { // Kiseleff / Aviatorilor / Primăverii villas
            const floors = rng.int(2, 3), fh = 3.4; h = floors * fh; const c = col();
            const bw = w * rnd(rng, 0.6, 0.8), bd = d * rnd(rng, 0.55, 0.75);
            P('win', 0, h / 2, 0, bw, h, bd, c, { tex: 'house', floorH: fh });
            P('plain', 0, h + 0.2, 0, bw + 0.8, 0.4, bd + 0.8, shade(c, 0.75));
            P('roof', 0, h + 0.4, 0, bw + 0.6, 3.2, bd + 0.6, rng.pick(['#8a4b36', '#6d5a4e', '#5a5e63', '#9c5a3c']));
            P('plain', 0, 0.6, d / 2 - 0.1, w, 1.2, 0.15, '#5c5247'); // fence
            if (rng.chance(0.7)) P('plain', bw / 2 + 1.5, 1.4, bd / 2 - 2, 2.6, 2.8, 4, shade(c, 0.9)); // annex / garage
            break;
        }
        case 'campus': { // university slabs
            const floors = rng.int(3, 5), fh = 3.6; h = floors * fh; const c = col();
            P('win', 0, h / 2, 0, w, h, d, c, { tex: 'bloc', floorH: fh });
            P('plain', 0, h + 0.3, 0, w + 0.4, 0.6, d + 0.4, '#7d786f');
            break;
        }
        case 'retail': { // malls, big boxes
            h = rnd(rng, 9, 13); const c = col();
            P('plain', 0, h / 2, 0, w, h, d, c);
            P('plain', 0, h + 0.2, 0, w + 0.2, 0.4, d + 0.2, '#9a9a98');
            P('plain', 0, h * 0.72, d / 2 + 0.2, Math.min(w * 0.5, 18), 2.2, 0.3, rng.pick(SHOP_COLORS)); // big sign
            P('plain', 0, 3.5, d / 2 + 2, Math.min(w * 0.7, 24), 0.4, 4, '#55585c'); // entrance canopy
            break;
        }
        case 'rural': case 'suburb': { // houses with pitched roofs
            const floors = style === 'rural' ? rng.int(1, 2) : rng.int(1, 2), fh = 3.0; h = floors * fh; const c = col();
            const bw = Math.min(w, rnd(rng, 8, 12)), bd = Math.min(d, rnd(rng, 7, 11));
            P('win', 0, h / 2, 0, bw, h, bd, c, { tex: 'house', floorH: fh });
            P('roof', 0, h, 0, bw + 0.8, rnd(rng, 2.4, 3.4), bd + 0.8, rng.pick(style === 'rural' ? ['#8a4b36', '#9c5a3c', '#6f5a4a'] : ['#4a4e55', '#5e5a55', '#3f4348', '#6b5f55']));
            if (style === 'suburb' && rng.chance(0.6)) P('plain', bw / 2 + 2.2, 1.4, 1, 3.6, 2.8, 5.5, shade(c, 0.92)); // garage
            if (style === 'rural') P('plain', 0, 0.5, d / 2 - 0.1, w, 1.0, 0.12, '#7a6a55');
            break;
        }
        case 'industrial': {
            h = rnd(rng, 7, 12); const c = col();
            P('plain', 0, h / 2, 0, w, h, d, c);
            P('plain', 0, h + 0.3, 0, w + 0.2, 0.6, d + 0.2, '#6b6f73');
            for (let x = -w / 2 + 3; x < w / 2 - 2; x += 5) P('plain', x, h + 1.2, 0, 3, 1.4, d * 0.8, '#7c8084'); // sawtooth-ish roof lights
            break;
        }
        default: { h = 12; P('win', 0, 6, 0, w, 12, d, col(), { tex: 'interwar', floorH: 3.3 }); }
    }
    return { parts, h };
}

export function shade(hex, k) {
    const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString();
}

/** Appends generated parts to the batch set, transformed by (x, z, angle). */
export function emitBuilding(batches, gen, x, z, angle, T) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (const p of gen.parts) {
        v.set(p.x, 0, p.z).applyQuaternion(q);
        const wx = x + v.x, wz = z + v.z;
        if (p.kind === 'roof') {
            m.compose(new THREE.Vector3(wx, p.y + p.h / 2, wz), q, new THREE.Vector3(p.w, p.h, p.d));
            batches.plain.add(PYR, m, new THREE.Color(p.color));
            continue;
        }
        m.compose(new THREE.Vector3(wx, p.y, wz), q, new THREE.Vector3(p.w, p.h, p.d));
        if (p.kind === 'win') {
            const key = 'win_' + p.tex;
            if (!batches[key]) batches[key] = new GeoBatch();
            const g = boxWithUV(p.w, p.h, p.d, p.floorH || 3.4, p.tex === 'glass' ? 2.2 : 3.2);
            batches[key].add(g, m, new THREE.Color(p.color)); g.dispose();
        } else if (p.kind === 'shop') {
            const g = boxWithUV(p.w, p.h, p.d, p.h, 5);
            batches.shop.add(g, m, new THREE.Color(p.color)); g.dispose();
        } else batches.plain.add(BOX, m, new THREE.Color(p.color));
    }
}

export function boxWithUV(w, h, d, floorH, bayW = 3.4) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv;
    const floors = Math.max(1, Math.round(h / floorH));
    for (let f = 0; f < 6; f++) {
        const horiz = f === 0 || f === 1 ? d : w;
        for (let i = 0; i < 4; i++) {
            const k = f * 4 + i;
            if (f === 2 || f === 3) uv.setXY(k, 0.5, 0.5);
            else uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(horiz / bayW)), uv.getY(k) * floors);
        }
    }
    return g;
}

/** Build meshes from the batch set. */
export function finalizeBatches(batches, T) {
    const meshes = [];
    for (const [key, b] of Object.entries(batches)) {
        if (b.empty) continue;
        let mat;
        if (key.startsWith('win_')) mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: T[key.slice(4)] });
        else if (key === 'shop') mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: T.shop });
        else mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const m = new THREE.Mesh(b.build(), mat); m.castShadow = true; m.receiveShadow = true; meshes.push(m);
    }
    return meshes;
}

// ============================================================================
//  BUILDING_SPECS — the per-building research specs of the non-residential buildings in each chapter district
//  (game/research/buildings-<city>-<district>.json, research lane 2026-11-07, 615 buildings), baked into a compact
//  table for archetypes.js (the game does not fetch game/research at runtime). A district JSON may carry the same
//  rows as data.buildingSpec (world-data Request in spec 12), which then takes precedence.
//  Row: [lat, lon, footprint m², archetype, storeys (0 = ?), ground-floor height m, facade hex, flags, material,
//        era/style, roof, shop units, name, street it fronts, year built, building-name sign "text|e" (entrance) / "|t" (roof)]
//  archetype: sr shopfront row · mx shops under housing · ob office block · cw curtain-wall office · cv civic · ho hotel ·
//        un university · sc school · ch church · in industrial shed · su supermarket · ml mall · pk parking · bk bank ·
//        dt drive-thru · fu fuel station · cvs CV-stop building
//  flags: 1 on a chapter route · 2 storeys from OSM / research (not an estimate) · 4 facade photo-researched / OSM ·
//        8 rooftop plant · 16 entrance canopy · 32 landmark / CV stop (hand-modelled elsewhere)
//  material: pl plaster · cw curtain wall · st stone · sp sandwich panels · mc metal cladding · us US brick/panel storefront ·
//        cf concrete frame · cc exposed concrete · pn panels · rb brick · fu canopy
//  era/style: v villa · m modern office · c communist-era · a annex · p post-1990 · i interwar · e pre-1919 eclectic
//  roof: f flat · p pitched / unknown · h hipped · g gabled · y pyramid · m mansard · d dome (landmark)
// ============================================================================
export const BUILDING_SPECS = {"bucharest-floreasca":[
[44.463303,26.102924,324,"sc",2,3.8,"#E4D2B0",1,"pl","","p",0,"","Strada Mihail Ivanovici Glinka",0,""],
[44.456598,26.100401,191,"sr",2,4.2,"#D8C7A8",1,"pl","","p",1,"","Calea Floreasca",0,""],
[44.461599,26.10149,123,"sr",2,4.2,"#E9E0CF",1,"pl","","p",2,"","Strada Căpitan Gheorghe Bulugea",0,""],
[44.458375,26.100863,419,"sr",2,4.2,"#D9C9B4",1,"pl","","p",1,"","Strada Aviator Muntenescu",0,""],
[44.461364,26.100942,592,"ob",6,4.2,"#DAD3C4",9,"pl","","f",3,"Nusco Floreasca 1","Strada Puțul lui Zamfir",0,""],
[44.457501,26.100879,452,"sr",2,4.2,"#E9E0CF",1,"pl","","p",1,"","",0,""],
[44.459278,26.100488,747,"mx",5,3.8,"#DAD3C4",3,"pl","","f",2,"","Calea Floreasca",0,""],
[44.461739,26.10097,273,"cw",5,5,"#C8C8C4",15,"cw","","f",1,"Nusco Floreasca 2","Calea Floreasca",0,""],
[44.467216,26.1042,134,"sr",2,4.2,"#D9C9B4",3,"pl","v","p",0,"Books Express","Strada Grădiștea Floreștilor",0,""],
[44.465445,26.103222,517,"mx",4,3.8,"#E8E1D3",1,"pl","","p",1,"","Strada Serghei Vasilievici Rahmaninov",0,""],
[44.457105,26.100228,707,"cw",6,5,"#6F8A94",11,"cw","m","f",0,"Grand Offices","Calea Floreasca",0,"Grand Offices|e"],
[44.456725,26.100253,607,"sr",2,4.2,"#D8C7A8",1,"pl","","p",1,"","Calea Floreasca",0,""],
[44.462632,26.101685,555,"mx",4,3.8,"#DAD3C4",3,"pl","","p",2,"Bl. 2/3","Strada Béla Bartók",0,""],
[44.458294,26.100137,157,"sr",2,4.2,"#E9E0CF",1,"pl","","p",1,"","Strada Cornescu",0,""],
[44.46687,26.103712,844,"ho",0,5,"#D8C7A8",9,"pl","","f",1,"Hotel Johann Strauss","Strada Serghei Vasilievici Rahmaninov",0,""],
[44.467191,26.106071,1338,"cvs",3,0,"#E8DDB8",39,"pl","","f",0,"","Strada General Giuseppe Garibaldi",0,""],
[44.459566,26.100269,334,"sr",2,4.2,"#E9E0CF",1,"pl","","p",3,"","Strada Bălănescu Rosetti",0,""],
[44.462845,26.101291,281,"ob",5,4.2,"#DAD3C4",9,"pl","","f",1,"Souk","Calea Floreasca",0,""],
[44.460519,26.100345,6275,"ml",2,5.5,"#E4D2B0",9,"pn","","f",19,"Piața Floreasca","Strada Banul Antonache",0,""],
[44.455734,26.100012,245,"ho",2,5,"#E9E0CF",9,"pl","","f",2,"","Strada Albac",0,""],
[44.455041,26.100448,223,"sr",2,4.2,"#D8C7A8",0,"pl","","p",2,"","Strada Chile",0,""],
[44.45943,26.099994,845,"sr",2,4.2,"#D8C7A8",0,"pl","","p",0,"","Strada Banul Antonache",0,""],
[44.461391,26.100306,1011,"cv",6,4.5,"#6F8A94",2,"pl","m","p",0,"40 Banu Antonache Office Center","Strada Puțul lui Zamfir",0,""],
[44.454855,26.10047,226,"sr",2,4.2,"#EDE3D2",0,"pl","","p",1,"","Strada Chile",0,""],
[44.456967,26.099483,193,"sr",2,4.2,"#E4D2B0",0,"pl","","p",0,"","Strada Naum Râmniceanu",0,""],
[44.456794,26.099426,113,"mx",2,3.8,"#E4D2B0",2,"pl","v","h",0,"","Strada Naum Râmniceanu",0,""],
[44.465934,26.105171,338,"sr",2,4.2,"#E9E0CF",0,"pl","","p",1,"","Strada Aghireș",0,""],
[44.466714,26.102745,418,"cv",5,4.5,"#DAD3C4",2,"pl","","p",0,"","Strada Ghiță Pădureanu",0,""],
[44.458899,26.09932,167,"ob",2,4.2,"#E4D2B0",8,"pl","","f",0,"","Strada Banul Antonache",0,""],
[44.460922,26.099703,185,"sr",2,4.2,"#EDE3D2",0,"pl","","p",0,"","Strada Puțul lui Zamfir",0,""],
[44.461013,26.099713,210,"sr",2,4.2,"#E9E0CF",0,"pl","","p",0,"","Strada Puțul lui Zamfir",0,""],
[44.460048,26.0995,330,"sr",2,4.2,"#EDE3D2",0,"pl","","p",0,"","Strada Banul Antonache",0,""],
[44.461436,26.099723,412,"mx",5,3.8,"#E8E1D3",2,"pl","","p",0,"","Strada Constantin Aricescu",0,""],
[44.458915,26.099209,123,"ob",2,4.2,"#EDE3D2",8,"pl","","f",0,"","Strada Banul Antonache",0,""],
[44.462253,26.0998,215,"mx",5,3.8,"#C7C1B5",2,"pl","p","p",0,"","Strada George Călinescu",2020,""],
[44.454504,26.101067,618,"cv",7,4.5,"#E8E1D3",2,"pl","","p",0,"Spitalul Euroclinic - Regina Maria","Calea Floreasca",0,""],
[44.459661,26.099279,186,"cv",4,4.5,"#DAD3C4",2,"pl","","p",0,"","Intrarea Tudor Ștefan",0,""],
[44.465642,26.105633,390,"mx",4,3.8,"#CFC8B8",2,"pl","","p",3,"","Strada Aghireș",0,""],
[44.464442,26.105285,997,"sr",3,4.2,"#EDE3D2",2,"pl","","p",0,"Școala Gimnazială Maria Rosetti","Strada General Giuseppe Garibaldi",0,""],
[44.454211,26.101098,268,"cv",5,4.5,"#CFC8B8",0,"pl","","p",0,"","Calea Floreasca",0,""],
[44.454098,26.101009,416,"cv",5,4.5,"#CFC8B8",0,"pl","","p",0,"","Calea Floreasca",0,""],
[44.454252,26.099686,1195,"mx",7,3.8,"#E8E1D3",2,"pl","","f",0,"","Strada Axinte Uricariul",0,""],
[44.464206,26.10117,6320,"mx",2,3.8,"#DAD3C4",2,"pl","i","p",0,"Automatica Ford","Strada Banul Antonache",1938,""],
[44.465233,26.101194,1477,"cv",16,4.5,"#6F8A94",6,"cw","m","p",1,"One Tower","Calea Floreasca",0,""],
[44.465698,26.101071,904,"cw",11,5,"#6F8A94",10,"cw","m","f",0,"Eliade Tower","Bulevardul Mircea Eliade",0,"Eliade Tower|e"],
[44.464742,26.100445,710,"mx",16,3.8,"#BDB5A6",2,"pl","c","p",0,"T2","",0,""]],
"bucharest-grozavesti":[
[44.446995,26.060374,463,"sr",1,4.2,"#D8CDB8",3,"pl","v","p",1,"Fabrica Grivița","Bulevardul Regiei",0,""],
[44.441292,26.05929,573,"cw",6,5,"#7D93A0",11,"cw","m","f",0,"","Bulevardul Doina Cornea",2010,""],
[44.441797,26.059729,482,"cw",7,5,"#7D93A0",11,"cw","m","f",0,"","Strada Economu Cezărescu",0,""],
[44.442,26.059759,291,"ob",7,4.2,"#D9D2C3",9,"pl","","f",0,"","Bulevardul Doina Cornea",0,""],
[44.446382,26.060594,205,"fu",0,5,"#F2F2F2",1,"fu","a","f",2,"Lukoil","Șoseaua Orhideelor",0,""],
[44.441171,26.058897,469,"ob",5,4.2,"#7D93A0",11,"pl","","f",0,"","Bulevardul Doina Cornea",0,""],
[44.446238,26.060664,103,"sr",1,4.2,"#D8CDB8",3,"pl","v","p",1,"Lukoil","Șoseaua Orhideelor",0,""],
[44.447387,26.061309,1202,"in",1,6,"#B9BCBE",3,"mc","v","f",0,"","Șoseaua Orhideelor",0,""],
[44.441368,26.058983,668,"cw",6,5,"#7D93A0",11,"cw","m","f",0,"Ayash Center","Strada Economu Cezărescu",0,"Ayash Center|e"],
[44.43996,26.058646,620,"un",5,4.2,"#D9D2C3",3,"pl","","p",0,"","Bulevardul Doina Cornea",0,""],
[44.446119,26.060801,461,"cv",2,4.5,"#D8CDB8",3,"pl","v","p",0,"Poliția Locală Sector 6","Șoseaua Orhideelor",0,""],
[44.440275,26.057701,266,"ob",4,4.2,"#D8CDB8",9,"pl","","f",0,"Enel","Bulevardul Doina Cornea",0,"Enel|e"],
[44.440814,26.059638,459,"cw",6,5,"#7D93A0",11,"cw","m","f",0,"","Bulevardul Doina Cornea",0,""],
[44.448361,26.063826,118,"ob",5,4.2,"#7D93A0",11,"pl","","f",0,"","Șoseaua Orhideelor",0,""],
[44.438365,26.056647,752,"fu",2,5,"#F2F2F2",1,"fu","","f",1,"OMV","Bulevardul Doina Cornea",0,""],
[44.446339,26.059691,1364,"mx",13,3.8,"#C9C4B8",3,"pl","p","p",1,"","Bulevardul Regiei",2015,""],
[44.446752,26.061771,929,"mx",11,3.8,"#D3CEC2",3,"pl","c","p",1,"","Pasajul Basarab",0,""],
[44.448761,26.064739,2990,"mx",1,3.8,"#D9D2C3",1,"pl","","p",0,"The Arc","Șoseaua Orhideelor",0,""],
[44.444797,26.059963,3301,"cw",11,5,"#7D93A0",15,"cw","m","f",5,"The Bridge 1","Șoseaua Orhideelor",2017,""],
[44.440116,26.059018,606,"un",3,4.2,"#D9D2C3",3,"pl","","p",0,"","Bulevardul Doina Cornea",0,""],
[44.438963,26.057611,842,"cv",2,4.5,"#D8CDB8",3,"pl","v","p",0,"","Bulevardul Doina Cornea",0,""],
[44.446579,26.06145,443,"ho",6,5,"#7D93A0",11,"pl","m","f",1,"Sir Orhideea","Pasajul Basarab",0,""],
[44.447766,26.064923,214,"sr",2,4.2,"#D8CDB8",3,"pl","v","p",1,"","Calea Plevnei",0,""],
[44.447905,26.062284,98,"ob",8,4.2,"#BDB7AA",11,"pl","","y",0,"Turnul de apă","Calea Giulești",0,"Turnul de apă|e"],
[44.439013,26.057765,7650,"cv",0,4.5,"#D8CDB8",0,"pl","","p",0,"Detașamentul de Pompieri Grozavești","Bulevardul Doina Cornea",0,""],
[44.440387,26.05945,648,"un",4,4.2,"#D9D2C3",2,"pl","","p",0,"","Șoseaua Grozăvești",0,""],
[44.445852,26.059574,2489,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",0,"One Club","Strada Sergent Constantin Ghercu",0,""],
[44.441705,26.058975,573,"ho",8,5,"#7D93A0",10,"pl","m","f",0,"Hotel Yesterday","Strada Economu Cezărescu",2009,"Hotel Yesterday|t"],
[44.438364,26.056981,86,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"","",0,""],
[44.444048,26.059843,2709,"cw",16,5,"#7D93A0",10,"cw","m","f",2,"","Șoseaua Orhideelor",2018,""],
[44.44774,26.061179,75,"in",0,6,"#B9BCBE",0,"mc","a","f",0,"","",0,""],
[44.442284,26.061101,163,"in",1,6,"#B9BCBE",2,"mc","v","f",0,"","Splaiul Independenței",0,""],
[44.447676,26.060868,75,"in",0,6,"#B9BCBE",0,"mc","a","f",0,"","",0,""],
[44.449163,26.0656,4850,"su",2,6,"#D9D6CF",10,"sp","","f",0,"IDM Basarab","Șoseaua Orhideelor",0,""],
[44.447731,26.061013,75,"in",0,6,"#B9BCBE",0,"mc","a","f",0,"","",0,""],
[44.442562,26.06131,392,"sr",2,4.2,"#D8CDB8",2,"pl","v","p",0,"","Splaiul Independenței",0,""],
[44.440398,26.057064,1285,"un",4,4.2,"#D9D2C3",2,"pl","","p",0,"","",0,""],
[44.448041,26.066239,1741,"mx",13,3.8,"#D3CEC2",2,"pl","","p",0,"Bl. Luther","Șoseaua Orhideelor",0,""],
[44.442223,26.061294,298,"in",1,6,"#B9BCBE",2,"mc","v","f",0,"","",0,""],
[44.439987,26.056336,674,"mx",9,3.8,"#B8B2A6",2,"pl","","p",0,"Cămin Artifex","",0,""],
[44.447456,26.06521,85,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",0,"","Strada Fluviului",0,""],
[44.441961,26.061334,144,"ch",1,0,"#E8E0CF",0,"st","v","d",0,"Biserica Ortodoxă \"Cărămidarii de Sus\"","",1805,""],
[44.445429,26.059168,215,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"","Strada Sergent Constantin Ghercu",0,""],
[44.44802,26.061222,285,"ob",2,4.2,"#D8CDB8",10,"pl","v","g",0,"","",0,""],
[44.444746,26.059286,1864,"cv",11,4.5,"#7D93A0",2,"pl","m","p",0,"The Bridge 2","Strada Sergent Constantin Ghercu",2019,""],
[44.441582,26.058171,142,"mx",2,3.8,"#D8CDB8",0,"pl","v","p",0,"","Strada Economu Cezărescu",0,""],
[44.440792,26.060698,124,"in",0,6,"#D9D2C3",0,"mc","","f",0,"","Pasajul Basarab",0,""],
[44.44868,26.06283,541,"cv",5,4.5,"#D9D2C3",0,"pl","","p",0,"","Calea Giulești",0,""],
[44.442141,26.058618,303,"mx",5,3.8,"#D9D2C3",2,"pl","","p",0,"","Strada Sublocotenent Alexandru Borneanu",0,""],
[44.440768,26.06092,117,"in",0,6,"#D9D2C3",0,"mc","","f",0,"","",0,""],
[44.448187,26.066804,615,"sr",4,4.2,"#D9D2C3",2,"pl","","p",0,"Siloz Orzărie","",0,""],
[44.446022,26.058772,863,"mx",6,3.8,"#D9D2C3",2,"pl","","p",0,"P27","Bulevardul Regiei",0,""],
[44.448375,26.061822,7754,"ml",0,5.5,"#D9D2C3",8,"pn","","f",1,"Brico Dépôt","Calea Giulești",0,""],
[44.439536,26.055191,1455,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"Sala Sport","",0,""],
[44.438788,26.053742,1217,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"Corp JH","",0,""],
[44.439435,26.054061,350,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"","",0,""],
[44.438542,26.053113,2095,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"Corp JG","",0,""],
[44.439211,26.053732,1650,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"Corp JD","",0,""],
[44.438693,26.052593,1114,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"Corp JF","",0,""],
[44.43848,26.051453,2238,"cvs",5,0,"#EDEDE8",38,"cf","","f",0,"Rectorat Universitatea Politehnica din București","",0,""],
[44.438666,26.050695,5016,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"Corp AN","",0,""]],
"bucharest-unirii":[
[44.433381,26.116306,170,"mx",3,3.8,"#E2D8C4",3,"pl","","h",2,"","Calea Călărașilor",0,""],
[44.433163,26.114255,165,"sr",1,4.2,"#D9C3A0",3,"pl","v","p",1,"","Strada Alexandru Sihleanu",0,""],
[44.433365,26.117733,155,"mx",2,3.8,"#D9C3A0",3,"pl","v","p",2,"","Calea Călărașilor",0,""],
[44.426301,26.10118,52,"in",0,6,"#B9BCBE",1,"mc","a","f",0,"","Piața Unirii",0,""],
[44.43308,26.117612,182,"sr",1,4.2,"#D9C3A0",1,"pl","v","p",2,"","Calea Călărașilor",1900,""],
[44.433087,26.116491,73,"ho",5,5,"#E2D8C4",9,"pl","","f",0,"","Calea Călărașilor",0,""],
[44.433486,26.115819,170,"ch",1,0,"#D9D2C3",1,"st","","d",0,"Biserica „Sfântul Ștefan” - Călărași","Piața Sfântul Ștefan",1768,""],
[44.433492,26.117628,272,"cvs",1,0,"#E3D3B8",39,"pl","v","g",0,"","Calea Călărașilor",0,""],
[44.431739,26.111115,313,"ob",5,4.2,"#D9D2C3",9,"pl","","f",0,"","Bulevardul Corneliu Coposu",0,""],
[44.431645,26.11094,350,"fu",1,5,"#F2F2F2",1,"fu","a","f",1,"MOL","Bulevardul Corneliu Coposu",0,""],
[44.429398,26.104806,269,"sr",2,4.2,"#CFC1A8",1,"pl","","p",3,"","Strada Patriei",0,""],
[44.433054,26.112215,389,"mx",6,3.8,"#CFC8B8",1,"pl","","p",1,"","Strada Mântuleasa",0,""],
[44.43092,26.109546,1104,"cw",19,5,"#6F8A94",11,"cw","m","f",2,"Unirii View","Strada Matei Basarab",2018,""],
[44.429523,26.105068,216,"sr",2,4.2,"#CFC1A8",1,"pl","","p",1,"","Bulevardul Corneliu Coposu",0,""],
[44.431235,26.110214,393,"fu",1,5,"#F2F2F2",1,"fu","a","f",1,"OMV","Strada Matei Basarab",0,""],
[44.433019,26.116119,345,"ob",5,4.2,"#D8CDB8",11,"pl","","f",0,"Ibiza Business Center","Strada Remus",0,"Ibiza Business Center|e"],
[44.431381,26.109154,801,"mx",4,3.8,"#D9D2C3",3,"pl","","h",3,"","Bulevardul Hristo Botev",0,""],
[44.429232,26.104337,559,"mx",5,3.8,"#BDB5A6",1,"pl","c","f",2,"","Strada Patriei",1986,""],
[44.432997,26.116685,315,"sr",1,4.2,"#E6CFC0",3,"pl","v","p",1,"","Calea Călărașilor",1910,""],
[44.431085,26.108492,1463,"mx",9,3.8,"#C9B99A",3,"pl","c","f",2,"Bl. 104","Strada Bălcești",0,""],
[44.425574,26.102386,1420,"mx",11,3.8,"#C9B99A",3,"pl","c","f",4,"","Strada Bibescu Vodă",1987,""],
[44.432996,26.116603,302,"sr",1,4.2,"#E6CFC0",3,"pl","v","p",1,"","Calea Călărașilor",0,""],
[44.432962,26.117763,353,"sr",1,4.2,"#E6CFC0",1,"pl","","p",1,"","Strada Fetițelor",0,""],
[44.430066,26.106169,1316,"sr",2,4.2,"#CFC1A8",1,"pl","","p",7,"","Strada Bărăției",0,""],
[44.430713,26.10757,1447,"mx",6,3.8,"#E2D8C4",3,"pl","","p",7,"Bl. 103","Strada Bălcești",0,""],
[44.43035,26.10858,1332,"mx",9,3.8,"#C9B99A",3,"pl","c","f",10,"Bl. 105A","Strada Vasile Adamache",0,""],
[44.429981,26.107796,1086,"mx",8,3.8,"#BDB5A6",3,"pl","c","p",4,"Bl. 105B","Bulevardul Corneliu Coposu",0,""],
[44.429113,26.105791,919,"sr",3,4.2,"#CFC8B8",3,"pl","","p",2,"","Bulevardul Corneliu Coposu",0,""],
[44.431655,26.109515,453,"sr",1,4.2,"#E8D9BE",1,"pl","","p",1,"","Bulevardul Hristo Botev",0,""],
[44.431117,26.110252,259,"ob",7,4.2,"#CFC8B8",9,"pl","","f",0,"","Strada Matei Basarab",0,""],
[44.425444,26.103504,707,"ho",10,5,"#D8CDB5",11,"pl","c","f",5,"","Bulevardul Dimitrie Cantemir",1989,""],
[44.429845,26.105454,77,"sr",2,4.2,"#D9C3A0",1,"pl","v","p",1,"","Strada Bărăției",1824,""],
[44.430482,26.106892,937,"mx",6,3.8,"#E2D8C4",3,"pl","","p",5,"Bl. 102","Strada Sfânta Vineri",0,""],
[44.429545,26.104711,231,"sr",2,4.2,"#E3D3B8",1,"pl","","p",1,"","Strada Patriei",0,""],
[44.429409,26.104363,354,"ch",8,0,"#E3D3B8",1,"st","","d",0,"Biserica Ortodoxă  \"Sfântul Ioan Piaţă\"","Strada Patriei",0,""],
[44.432308,26.112552,266,"mx",2,3.8,"#D9C3A0",3,"pl","v","p",1,"","Strada Gheorghe Ionescu-Gion",0,""],
[44.425411,26.102332,494,"mx",6,3.8,"#E2D8C4",3,"pl","i","f",3,"","Strada Bibescu Vodă",1925,""],
[44.432306,26.1105,194,"ch",2,0,"#CFC8B8",1,"st","","d",0,"Biserica Ortodoxă Sfântul Mina - Vergu","Strada Constantin F. Robescu",1725,""],
[44.43286,26.111495,402,"mx",7,3.8,"#E2D8C4",3,"pl","","p",3,"Bl. CC","Piața Corneliu Coposu",0,""],
[44.433778,26.116548,182,"ob",1,4.2,"#CFC1A8",9,"pl","","f",0,"","Piața Sfântul Ștefan",0,""],
[44.433117,26.111815,1066,"mx",6,3.8,"#D9D2C3",3,"pl","","f",2,"","Strada Mântuleasa",0,""],
[44.429243,26.106505,6856,"mx",5,3.8,"#D9D2C3",3,"pl","","p",0,"Hala Unirii","Bulevardul Corneliu Coposu",0,""],
[44.432769,26.111216,442,"mx",8,3.8,"#C9B99A",3,"pl","c","f",1,"","Strada Constantin F. Robescu",0,""],
[44.429892,26.105191,95,"sr",2,4.2,"#E2D8C4",0,"pl","i","p",0,"","Strada Bărăției",1935,""],
[44.431639,26.109035,234,"sr",1,4.2,"#E6CFC0",2,"pl","v","p",0,"HRISTO BOTEV NR 44","Bulevardul Hristo Botev",1903,""],
[44.429919,26.105245,42,"sr",2,4.2,"#D9C3A0",0,"pl","","p",0,"","Strada Bărăției",0,""],
[44.432611,26.110854,365,"cv",2,4.5,"#CFC1A8",0,"pl","","p",0,"","Strada Constantin F. Robescu",0,""],
[44.431031,26.10771,129,"ho",2,5,"#E8D9BE",8,"pl","","f",0,"","Strada Bălcești",0,""],
[44.425301,26.101859,290,"mx",7,3.8,"#D9D2C3",0,"pl","i","p",1,"","Strada Bibescu Vodă",1935,""],
[44.43055,26.10964,176,"mx",5,3.8,"#CFC8B8",0,"pl","","p",1,"Avbs Broker Credite","Strada Doctor Iuliu Barasch",0,""],
[44.42797,26.104715,12522,"ml",6,5.5,"#C8C1B3",14,"pn","","f",13,"Unirea Shopping Center","Bulevardul Corneliu Coposu",0,""],
[44.43095,26.110509,371,"cw",7,5,"#6F8A94",10,"cw","m","f",0,"","Strada Matei Basarab",0,""],
[44.42959,26.104226,180,"ob",8,4.2,"#E8D9BE",8,"pl","","f",0,"","Strada Patriei",0,""],
[44.427372,26.100654,385,"mx",9,3.8,"#BDB5A6",2,"pl","c","p",1,"Bl. 14","Piața Unirii",0,""],
[44.431138,26.107612,114,"ho",2,5,"#E3D3B8",8,"pl","","f",0,"","Strada Bălcești",0,""],
[44.429215,26.103214,499,"mx",5,3.8,"#D8CDB5",0,"pl","c","p",1,"","Strada Covaci",1988,""],
[44.426362,26.104984,226,"sr",1,4.2,"#D9C3A0",2,"pl","v","p",1,"Exotique Lounge","Bulevardul Unirii",0,""],
[44.425111,26.103649,312,"mx",9,3.8,"#BDB5A6",2,"pl","c","p",1,"","Strada Bibescu Vodă",1989,""],
[44.430014,26.105003,207,"ob",6,4.2,"#E8D9BE",8,"pl","","f",0,"","Strada Patriei",0,""],
[44.430382,26.105838,197,"sr",2,4.2,"#CFC8B8",0,"pl","i","p",1,"","Strada Baia de Fier",1930,""],
[44.432523,26.11574,464,"sr",1,4.2,"#E8D9BE",0,"pl","","p",0,"SC UNICON SA","Strada Profesor Valaori Iuliu",0,""],
[44.425292,26.100917,1287,"mx",7,3.8,"#CBBFA6",2,"pl","c","p",0,"","Strada Ienăchiță Văcărescu",1987,""],
[44.43117,26.111206,391,"mx",3,3.8,"#D9D2C3",2,"pl","","h",1,"","Bulevardul Mircea Vodă",0,""],
[44.42533,26.104902,1965,"mx",10,3.8,"#BDB5A6",2,"pl","c","f",1,"Bl. B2","Strada Radu Vodă",0,""],
[44.429691,26.104121,459,"mx",5,3.8,"#D8CDB5",0,"pl","c","p",0,"","Strada Patriei",1956,""],
[44.428729,26.106029,2627,"su",2,6,"#D9C3A0",26,"sp","v","f",1,"Carrefour","Aleea Alexandru Brătescu-Voinești",0,""],
[44.429388,26.103324,50,"mx",8,3.8,"#CBBFA6",2,"pl","c","p",1,"","Pasajul Unirii",0,""],
[44.430476,26.105932,249,"sr",2,4.2,"#D9C3A0",0,"pl","","p",1,"","Strada Baia de Fier",0,""],
[44.425962,26.099848,810,"mx",9,3.8,"#C9B99A",2,"pl","c","f",0,"","Aleea Dealul Mitropoliei",0,""],
[44.430581,26.110156,188,"cw",7,5,"#6F8A94",10,"cw","m","f",0,"","Strada Matei Basarab",0,""],
[44.433652,26.112364,187,"sr",2,4.2,"#CFC1A8",0,"pl","","p",0,"","Strada Popa Soare",0,""],
[44.431239,26.107489,382,"ho",2,5,"#E6CFC0",8,"pl","","f",0,"","Strada Bălcești",0,""],
[44.431027,26.107015,489,"sr",2,4.2,"#D9C3A0",0,"pl","","p",0,"","Strada Stelea Spătarul",0,""],
[44.429455,26.103268,142,"ob",8,4.2,"#C9B99A",10,"pl","","f",2,"","Strada Covaci",0,""],
[44.430938,26.110972,408,"ho",2,5,"#E6CFC0",8,"pl","","f",2,"Hotel Dacia","Strada Matei Basarab",0,""],
[44.43056,26.110255,171,"cw",7,5,"#6F8A94",10,"cw","m","f",0,"","Strada Matei Basarab",0,""],
[44.431005,26.111217,178,"ho",3,5,"#E2D8C4",10,"pl","","g",2,"Hotel Marina","Bulevardul Mircea Vodă",0,""],
[44.431295,26.111778,696,"cv",2,4.5,"#D9C3A0",0,"pl","","p",0,"Casa Eliad","Bulevardul Mircea Vodă",0,""],
[44.427389,26.100052,579,"mx",9,3.8,"#C9B99A",2,"pl","c","p",3,"Bl. 13","",0,""],
[44.434036,26.114693,923,"sr",2,4.2,"#E3D3B8",0,"pl","","p",0,"Arhiva Ministerului de Interne","Strada Romulus",0,""],
[44.424961,26.102619,120,"sr",3,4.2,"#D9D2C3",2,"pl","i","p",1,"24A","Strada Sfânta Ecaterina",1929,""],
[44.426787,26.102451,219,"mx",0,3.8,"#D8CDB8",0,"pl","a","p",0,"","",0,""],
[44.432384,26.109562,226,"sr",1,4.2,"#CFC1A8",0,"pl","","p",0,"","Strada Constantin F. Robescu",0,""],
[44.424964,26.101661,2271,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"","Strada Sfânta Ecaterina",0,""],
[44.429247,26.102842,169,"ob",8,4.2,"#D9C3A0",8,"pl","","f",3,"","Strada Covaci",0,""],
[44.432354,26.116633,349,"ch",1,0,"#E2D8C4",0,"st","","d",0,"Biserica Baptistă Sfânta Treime","Intrarea Valaori Iuliu",0,""],
[44.431028,26.106684,619,"ch",2,0,"#CFC1A8",0,"st","v","d",0,"Templul Coral","Strada Sfânta Vineri",1866,""],
[44.429433,26.108216,1054,"mx",8,3.8,"#CBBFA6",2,"pl","c","p",2,"Bl. 105C","Strada Cluceru Udricani",0,""],
[44.430893,26.111212,191,"mx",1,3.8,"#CFC8B8",0,"pl","","p",1,"","Bulevardul Mircea Vodă",0,""],
[44.429561,26.108564,576,"ch",2,0,"#E8D9BE",0,"st","v","d",0,"Sinagoga Mare","Strada Cluceru Udricani",1845,""],
[44.428801,26.106873,1858,"sr",2,4.2,"#E6CFC0",2,"pl","v","f",0,"","Strada Mămulari",0,""],
[44.428492,26.106183,672,"sr",3,4.2,"#E2D8C4",2,"pl","","p",0,"","Aleea Alexandru Brătescu-Voinești",0,""],
[44.432436,26.109439,157,"sr",1,4.2,"#E6CFC0",0,"pl","","p",0,"","Strada Constantin F. Robescu",0,""],
[44.424825,26.102736,246,"sr",2,4.2,"#CFC1A8",2,"pl","v","p",1,"","Strada Bibescu Vodă",1896,""],
[44.432766,26.110026,336,"sr",2,4.2,"#D9C3A0",0,"pl","","p",0,"","Strada Constantin F. Robescu",0,""],
[44.430779,26.105895,273,"mx",6,3.8,"#E2D8C4",0,"pl","","p",1,"","Strada Baia de Fier",0,""],
[44.429284,26.102685,341,"ob",8,4.2,"#E6CFC0",8,"pl","","f",5,"","Strada Covaci",0,""],
[44.434337,26.11673,300,"sr",2,4.2,"#D9C3A0",0,"pl","","p",1,"","Piața Sfântul Ștefan",0,""],
[44.42823,26.105697,3983,"pk",10,3.2,"#CBBFA6",2,"cc","","f",1,"Parcare Unirea","Aleea Alexandru Brătescu-Voinești",0,""],
[44.426362,26.105536,93,"sr",1,4.2,"#CFC1A8",2,"pl","v","f",1,"The Clique Bistro","",0,""],
[44.433463,26.111141,724,"sc",5,3.8,"#CFC8B8",0,"pl","","p",0,"Liceul Tehnologic Unirea","Strada Calotești",0,""],
[44.434422,26.116038,364,"sr",2,4.2,"#CFC1A8",0,"pl","","p",0,"","Piața Sfântul Ștefan",0,""],
[44.424712,26.10287,432,"sr",3,4.2,"#E6CFC0",0,"pl","","p",0,"","Calea Șerban Vodă",0,""],
[44.424736,26.104715,362,"sr",2,4.2,"#D9C3A0",0,"pl","","p",1,"","Strada Radu Vodă",0,""],
[44.429037,26.107771,51,"in",1,6,"#B9BCBE",0,"mc","a","f",0,"","Strada Sfânta Vineri",0,""],
[44.42743,26.099567,378,"mx",9,3.8,"#D8CDB5",2,"pl","c","p",2,"Bl. 12","Strada Sfinții Apostoli",0,""],
[44.432725,26.119264,167,"ob",3,4.2,"#D9D2C3",10,"pl","","h",0,"S.C. Ascensorul Romservice Company S.A.","Strada Profesor Constantinescu Mitriță",0,"S.C. Ascensorul Romservice Company S.A.|e"],
[44.428051,26.100681,1569,"mx",9,3.8,"#CBBFA6",2,"pl","c","p",11,"Bl. 15","Splaiul Independenței",0,""],
[44.433312,26.119549,123,"sr",1,4.2,"#E8D9BE",0,"pl","","p",0,"","Strada Profesor Constantinescu Mitriță",0,""],
[44.432996,26.119735,337,"mx",5,3.8,"#D9D2C3",0,"pl","","p",1,"","Strada Profesor Constantinescu Mitriță",0,""],
[44.432716,26.119624,103,"ob",5,4.2,"#CFC8B8",8,"pl","","f",0,"Knox Design S.R.L.","Strada Profesor Constantinescu Mitriță",0,"Knox Design S.R.L.|e"],
[44.434125,26.119458,130,"sr",2,4.2,"#E3D3B8",0,"pl","","p",0,"Dan (George) SPĂTARU","Strada Prof. Dr. Mihail Georgescu",0,""],
[44.43167,26.11763,203,"ch",2,0,"#E2D8C4",0,"st","","d",0,"","Strada Preot Vasile Lucaciu",0,""],
[44.433252,26.119945,202,"mx",3,3.8,"#D9D2C3",2,"pl","","p",0,"","Calea Călărașilor",0,""],
[44.433669,26.11991,252,"sr",2,4.2,"#E8D9BE",0,"pl","","p",0,"","Strada Prof. Dr. Mihail Georgescu",0,""],
[44.434003,26.119853,290,"sr",2,4.2,"#D9C3A0",0,"pl","","p",0,"","Strada Prof. Dr. Mihail Georgescu",0,""]],
"bucharest-pipera":[
[44.47924,26.099432,100,"sr",2,4.2,"#D8CDB8",3,"pl","","p",1,"","Strada Țintea",0,""],
[44.479052,26.096281,57,"sr",0,4.2,"#D8CDB8",1,"pl","","p",2,"","Strada Moeciu",0,""],
[44.478573,26.106512,905,"cw",9,5,"#6F8C99",11,"cw","m","f",0,"Nova Building","Bulevardul Dimitrie Pompeiu",2008,"Nova Building|e"],
[44.47944,26.116281,1135,"cw",7,5,"#6F8C99",11,"cw","m","f",1,"MG 2","Strada George Constantinescu",0,""],
[44.480112,26.101658,162,"sr",2,4.2,"#D8CDB8",1,"pl","","p",1,"","Șoseaua Pipera",0,""],
[44.479498,26.096793,325,"mx",5,3.8,"#D8CDB8",3,"pl","","p",2,"Bl. 3C","Șoseaua Pipera",0,""],
[44.479046,26.098972,51,"sr",1,4.2,"#D8CDB8",3,"pl","","p",1,"Rental Car Center","Strada Cerceilor",0,""],
[44.479763,26.102317,3401,"su",2,6,"#D9D6CF",27,"sp","v","f",4,"Mega Image","Șoseaua Pipera",0,""],
[44.479763,26.102317,3401,"mx",1,3.8,"#D8CDB8",1,"pl","a","p",4,"","Șoseaua Pipera",0,""],
[44.47895,26.096162,259,"sr",0,4.2,"#D8CDB8",1,"pl","","p",1,"","Strada Moeciu",0,""],
[44.479067,26.099469,88,"sr",1,4.2,"#D8CDB8",3,"pl","","p",2,"Cabinet Veterinar Aviației","Strada Țintea",0,""],
[44.477654,26.117411,473,"mx",3,3.8,"#C7C3BA",3,"pl","p","p",1,"","Șoseaua Fabrica de Glucoză",2021,""],
[44.479089,26.099624,110,"mx",1,3.8,"#D8CDB8",3,"pl","","p",1,"Express Pub&Grill","Strada Țintea",0,""],
[44.479587,26.098667,423,"fu",0,5,"#F2F2F2",1,"fu","","f",2,"Petrom","Șoseaua Pipera",0,""],
[44.479822,26.111544,889,"cv",2,4.5,"#D8CDB8",1,"pl","","p",1,"Centrul naturist de sănătate Santo Raphael","Bulevardul Dimitrie Pompeiu",0,""],
[44.479345,26.112208,1083,"sr",2,4.2,"#D8CDB8",1,"pl","","p",0,"Clădirea D","Bulevardul Dimitrie Pompeiu",0,""],
[44.477793,26.118769,410,"mx",3,3.8,"#D9D6CF",3,"pl","p","p",2,"","Strada Marin Preda",2021,""],
[44.478288,26.117148,718,"sr",2,4.2,"#D8CDB8",1,"pl","","p",0,"Grup Feroviar Roman","Strada George Constantinescu",0,""],
[44.478834,26.107169,914,"un",12,4.2,"#D9D2C3",1,"pl","","p",0,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.478988,26.12435,5208,"sr",0,4.2,"#D8CDB8",1,"pl","","p",2,"Mobexpert","Șoseaua Fabrica de Glucoză",0,""],
[44.479416,26.110066,890,"sr",2,4.2,"#D8CDB8",1,"pl","","p",1,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.480293,26.101881,206,"fu",1,5,"#F2F2F2",1,"fu","a","f",1,"Lukoil","Șoseaua Pipera",0,""],
[44.477924,26.120126,464,"mx",3,3.8,"#E3E4E1",3,"pl","p","p",1,"G9","Șoseaua Fabrica de Glucoză",2019,""],
[44.477965,26.120581,475,"mx",3,3.8,"#E3E4E1",3,"pl","p","p",1,"G10","Șoseaua Fabrica de Glucoză",2019,""],
[44.478047,26.121568,450,"mx",3,3.8,"#C7C3BA",3,"pl","p","p",2,"","Șoseaua Fabrica de Glucoză",2018,""],
[44.479923,26.100542,357,"mx",5,3.8,"#D8CDB8",3,"pl","","p",2,"Bl. 5A","Șoseaua Pipera",0,""],
[44.480001,26.100844,463,"mx",5,3.8,"#D8CDB8",3,"pl","","p",3,"Bl. 5B","Șoseaua Pipera",0,""],
[44.479497,26.095903,345,"mx",5,3.8,"#D8CDB8",3,"pl","","p",4,"Bl. 2F","Șoseaua Pipera",0,""],
[44.478959,26.099449,88,"mx",1,3.8,"#D8CDB8",3,"pl","","p",1,"","Strada Țintea",0,""],
[44.479674,26.098615,211,"sr",0,4.2,"#D8CDB8",1,"pl","","p",2,"My Auchan","Strada Măguricea",0,""],
[44.479644,26.097957,656,"mx",5,3.8,"#D8CDB8",3,"pl","","p",3,"Bl. 3E","Strada Măguricea",0,""],
[44.48024,26.103945,2180,"cw",20,5,"#6F8C99",11,"cw","m","f",4,"Nusco Tower","Strada Gara Herăstrău",2010,""],
[44.478853,26.09865,171,"ch",2,0,"#E8E0CF",3,"st","","d",0,"Biserica Teocentric","Strada Cerceilor",0,""],
[44.478033,26.107109,1083,"ho",14,5,"#6F8C99",11,"pl","m","f",1,"Courtyard by Marriott Bucharest","Bulevardul Dimitrie Pompeiu",2019,""],
[44.478144,26.116066,2595,"mx",17,3.8,"#E3E4E1",3,"pl","c","p",2,"Bl. C","Șoseaua Fabrica de Glucoză",0,""],
[44.478681,26.11972,1515,"cv",10,4.5,"#E3E4E1",3,"pl","","p",0,"Medicover Pipera","Șoseaua Fabrica de Glucoză",0,""],
[44.478409,26.117461,970,"sr",2,4.2,"#D8CDB8",1,"pl","","p",0,"Amerilex","Șoseaua Fabrica de Glucoză",0,""],
[44.479889,26.104541,2308,"cw",15,5,"#6F8C99",11,"cw","m","f",0,"Globalworth Square","Strada Gara Herăstrău",2021,"Globalworth Square|e"],
[44.478778,26.106054,987,"cw",12,5,"#6F8C99",11,"cw","m","f",0,"","Strada Gara Herăstrău",2016,""],
[44.478919,26.122108,1194,"sr",2,4.2,"#D8CDB8",1,"pl","","p",0,"Diamedix Diagnostica","Șoseaua Fabrica de Glucoză",0,""],
[44.479429,26.113021,1700,"sr",2,4.2,"#D8CDB8",1,"pl","","p",0,"Clădirea B+C","Bulevardul Dimitrie Pompeiu",0,""],
[44.480733,26.113878,3938,"cvs",9,0,"#E3E4E1",39,"pn","m","f",0,"Clădirea A","Bulevardul Dimitrie Pompeiu",0,""],
[44.480353,26.101592,551,"sr",2,4.2,"#D8CDB8",1,"pl","","p",1,"Tunel Carwash","Strada Avionului",0,""],
[44.479902,26.099753,864,"mx",5,3.8,"#D8CDB8",3,"pl","","p",5,"","Strada Aviației",0,""],
[44.478789,26.099084,114,"sr",3,4.2,"#D8CDB8",3,"pl","","p",0,"","Strada Țintea",0,""],
[44.480065,26.116426,2300,"cw",13,5,"#6F8C99",11,"cw","m","f",2,"Globalworth Campus B","Strada George Constantinescu",2018,""],
[44.481049,26.114587,1428,"cvs",2,0,"#D8CDB8",32,"pl","","p",0,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.479162,26.101391,739,"cw",14,5,"#6F8C99",10,"cw","m","f",1,"Floreasca Tower","Calea Floreasca",0,""],
[44.479703,26.110323,143,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"BBQ & Grill","",0,""],
[44.477963,26.12316,77,"ob",5,4.2,"#D9D2C3",8,"pl","","f",0,"Kaufland Grill","",0,"Kaufland Grill|e"],
[44.481018,26.115893,136,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",2,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.479276,26.107748,514,"un",5,4.2,"#D9D2C3",0,"pl","","p",0,"","",0,""],
[44.477472,26.118939,767,"mx",12,3.8,"#E3E4E1",2,"pl","p","p",2,"Bl. 8","Strada Marin Preda",2021,""],
[44.477746,26.121699,987,"mx",12,3.8,"#E3E4E1",2,"pl","p","p",2,"Bl. 13","Strada Marin Preda",2018,""],
[44.47865,26.117696,1807,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"M247","Șoseaua Fabrica de Glucoză",0,""],
[44.477608,26.120173,989,"mx",12,3.8,"#E3E4E1",2,"pl","p","p",1,"Bl. 10","Șoseaua Fabrica de Glucoză",2019,""],
[44.477654,26.120681,987,"mx",12,3.8,"#D9D6CF",2,"pl","p","p",1,"Bl. 11","Strada Marin Preda",2019,""],
[44.480238,26.100476,376,"mx",4,3.8,"#D8CDB8",2,"pl","","p",1,"Bl. 5D","Strada Aviației",0,""],
[44.479055,26.095375,54,"sr",0,4.2,"#D8CDB8",0,"pl","","p",1,"","Șoseaua Pipera",0,""],
[44.47853,26.110864,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.479852,26.095946,1230,"mx",5,3.8,"#D8CDB8",2,"pl","","p",1,"Bl. 2G","Strada Elena Caragiani",0,""],
[44.47969,26.114608,8370,"cvs",7,0,"#6F8C99",38,"cw","","f",0,"BOB Tower","Strada George Constantinescu",0,""],
[44.480914,26.102565,1330,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",0,"Tiriac Auto - Jaguar Land Rover","Șoseaua Pipera",0,""],
[44.478769,26.118165,1827,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"Fan Courier","",0,""],
[44.478395,26.110418,53,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"IAR-93","",0,""],
[44.4792,26.113194,3092,"ob",5,4.2,"#D9D2C3",8,"pl","","f",0,"Clădirea A","",0,"Clădirea A|e"],
[44.478945,26.112377,2319,"ob",5,4.2,"#D9D2C3",8,"pl","","f",0,"Clădirea E","",0,"Clădirea E|e"],
[44.479239,26.122722,4510,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"Intrarom","Șoseaua Fabrica de Glucoză",0,""],
[44.480024,26.098628,914,"mx",5,3.8,"#D8CDB8",2,"pl","","p",0,"Bl. 4A","Strada Măguricea",0,""],
[44.479284,26.102462,1913,"cw",27,5,"#6F8C99",10,"cw","m","f",1,"Globalworth Tower","Calea Floreasca",0,""],
[44.478406,26.110688,75,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-29 SNIPER","",0,""],
[44.477969,26.104729,1310,"cv",37,4.5,"#3960DA",6,"cw","m","f",1,"Sky Tower","Strada Barbu Văcărescu",2012,""],
[44.480547,26.1165,1781,"cv",1,4.5,"#D8CDB8",2,"pl","v","p",0,"M2: Pipera","Bulevardul Dimitrie Pompeiu",0,""],
[44.479149,26.121133,5093,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"ComputerLand","Șoseaua Fabrica de Glucoză",0,""],
[44.478459,26.111178,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.478305,26.110491,53,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"IAR-93","",0,""],
[44.478997,26.114978,7292,"ob",5,4.2,"#D9D2C3",8,"pl","","f",0,"Upground","Strada George Constantinescu",0,"Upground|e"],
[44.47967,26.095292,601,"mx",5,3.8,"#D8CDB8",2,"pl","","p",3,"Bl. 2E","",0,""],
[44.480466,26.104497,359,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",0,"","Șoseaua Pipera",0,""],
[44.480149,26.09882,319,"sr",0,4.2,"#D8CDB8",0,"pl","","p",0,"Punct Termic","Strada Măguricea",0,""],
[44.478521,26.1115,42,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-19","",0,""],
[44.478548,26.099953,255,"sr",2,4.2,"#D8CDB8",2,"pl","","p",0,"Magic Castle","Strada Caierului",0,""],
[44.47889,26.117861,11410,"ob",2,4.2,"#D8CDB8",8,"pl","","f",0,"","",0,""],
[44.479341,26.106797,742,"un",12,4.2,"#D9D2C3",0,"pl","","p",0,"","",0,""],
[44.479889,26.109511,685,"ob",6,4.2,"#D9D2C3",10,"pl","","f",0,"Yoga MISA","",0,"Yoga MISA|e"],
[44.481167,26.116258,366,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",5,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.478357,26.098588,280,"sr",0,4.2,"#D8CDB8",0,"pl","","p",0,"La Radu Voința","Strada Cerceilor",0,""],
[44.478373,26.111203,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.478211,26.110553,53,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"IAR-93","",0,""],
[44.477437,26.105072,2545,"cw",7,5,"#6F8C99",10,"cw","m","f",0,"FCC Office Building","Strada Barbu Văcărescu",0,"FCC Office Building|e"],
[44.478435,26.111588,42,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-19","",0,""],
[44.478303,26.111239,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.478056,26.110233,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.478162,26.115175,2512,"mx",17,3.8,"#E3E4E1",2,"pl","c","p",2,"Bl. B","Șoseaua Fabrica de Glucoză",0,""],
[44.477429,26.12246,5755,"su",2,6,"#D9D6CF",8,"sp","","f",0,"Kaufland","Strada Marin Preda",0,""],
[44.478198,26.111046,38,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-17","",0,""],
[44.478241,26.111275,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.479439,26.094845,350,"mx",5,3.8,"#D8CDB8",2,"pl","","p",2,"Bl. 2D","Șoseaua Pipera",0,""],
[44.479783,26.107973,1178,"sc",3,3.8,"#D9D2C3",2,"pl","","p",0,"Liceul Teoretic Bilingv \"Ita Wegman\"","",0,""],
[44.478209,26.099036,656,"sr",0,4.2,"#D8CDB8",0,"pl","","p",0,"","Strada Cerceilor",0,""],
[44.480756,26.11685,76,"sr",1,4.2,"#D8CDB8",2,"pl","v","p",1,"Matei","",0,""],
[44.481208,26.102084,403,"sr",0,4.2,"#D8CDB8",0,"pl","","p",1,"Vianor Autozone","Strada Căpitan Aviator Alexandru Șerbănescu",0,""],
[44.478177,26.111329,43,"sr",2,4.2,"#D8CDB8",0,"pl","","p",0,"MiG-21","",0,""],
[44.48073,26.100402,416,"mx",5,3.8,"#D8CDB8",2,"pl","","p",0,"Bl. 5F","Strada Aviației",0,""],
[44.481245,26.116648,278,"sr",2,4.2,"#D8CDB8",2,"pl","v","p",3,"","Bulevardul Dimitrie Pompeiu",0,""],
[44.479004,26.094654,264,"ob",0,4.2,"#D8CDB8",8,"pl","","f",1,"Aurel Vlaicu Office Building","Șoseaua Pipera",0,""],
[44.478863,26.094651,190,"sr",0,4.2,"#D8CDB8",0,"pl","","p",1,"","Strada Zăgazului",0,""],
[44.478735,26.113682,2359,"ob",14,4.2,"#E3E4E1",10,"pl","","f",0,"Clădirea F","",0,"Clădirea F|e"],
[44.479436,26.094132,338,"mx",5,3.8,"#D8CDB8",2,"pl","","p",1,"Bl. 1F","Strada Smaranda Brăescu",0,""],
[44.478792,26.094099,1373,"mx",10,3.8,"#D8CDB8",2,"pl","","p",1,"Bl. C+D","Strada Zăgazului",0,""],
[44.478932,26.093874,185,"cv",3,4.5,"#D8CDB8",2,"pl","","p",1,"","Șoseaua Pipera",0,""],
[44.479494,26.093671,569,"mx",5,3.8,"#D8CDB8",2,"pl","","p",0,"","Șoseaua Pipera",0,""],
[44.478774,26.09367,1368,"mx",10,3.8,"#D8CDB8",2,"pl","","p",1,"Bl. A+B","Șoseaua Pipera",0,""]],
"bucharest-romana":[
[44.451429,26.094179,321,"sr",3,4.2,"#E6D3B3",1,"pl","","p",1,"","Strada Vasile Alecsandri",0,""],
[44.450285,26.094136,185,"sr",2,4.2,"#C9B79C",1,"pl","","p",1,"","Strada Vasile Alecsandri",0,""],
[44.452004,26.088993,468,"mx",3,3.8,"#CFC8B8",1,"pl","","p",1,"Bl. H4","Bulevardul Iancu de Hunedoara",0,""],
[44.451647,26.093448,108,"sr",3,4.2,"#D8C3A5",1,"pl","","p",1,"","Strada Grigore Alexandrescu",0,""],
[44.450154,26.091002,130,"ob",3,4.2,"#E2D3B5",11,"pl","","f",0,"","Strada Clopotarii Vechi",0,""],
[44.451342,26.09348,129,"sr",1,4.2,"#E7D8C9",3,"pl","v","p",1,"Zen Sushi","Strada Grigore Alexandrescu",0,""],
[44.44345,26.09882,582,"mx",7,3.8,"#E2D3B5",3,"pl","","p",4,"","Bulevardul General Gheorghe Magheru",0,""],
[44.443752,26.098688,389,"mx",7,3.8,"#E8E1D3",1,"pl","","p",2,"","Bulevardul General Gheorghe Magheru",0,""],
[44.45138,26.090921,547,"cv",3,4.5,"#BFB8A8",3,"pl","","f",0,"Clinică de Arsuri și Chirurgie Plastică","Strada Grigore Alexandrescu",0,""],
[44.451377,26.088609,172,"mx",3,3.8,"#CFC8B8",3,"pl","","h",1,"","Bulevardul Lascăr Catargiu",0,""],
[44.451508,26.09192,196,"cv",2,4.5,"#D8C3A5",1,"pl","","p",0,"","",0,""],
[44.448295,26.094735,266,"mx",4,3.8,"#CFC8B8",3,"pl","i","p",0,"Fischer International","Bulevardul Lascăr Catargiu",1938,""],
[44.451506,26.090136,1140,"ob",5,4.2,"#CFC8B8",11,"pl","","f",0,"Electrica","Strada Clopotarii Vechi",0,"Electrica|e"],
[44.451454,26.09135,533,"cv",1,4.5,"#E6D3B3",3,"pl","v","h",0,"Ambulator","Strada Grigore Alexandrescu",0,""],
[44.449951,26.094002,936,"sc",7,3.8,"#E8E1D3",1,"pl","","p",0,"Școala Națională de Studii Politice și Administrative","Strada Vasile Alecsandri",0,""],
[44.442474,26.099322,910,"mx",10,3.8,"#D9D2C3",3,"pl","i","p",5,"Bl. ARO/Patria","Bulevardul General Gheorghe Magheru",1931,""],
[44.451018,26.094613,397,"sr",2,4.2,"#E6D3B3",1,"pl","","p",0,"","Strada Vasile Alecsandri",0,""],
[44.448656,26.094087,691,"mx",2,3.8,"#E7D8C9",3,"pl","v","p",1,"","Bulevardul Lascăr Catargiu",0,""],
[44.451277,26.093372,45,"sr",3,4.2,"#C9B79C",1,"pl","","p",1,"","Strada Grigore Alexandrescu",0,""],
[44.452045,26.090049,812,"cw",10,5,"#5E7F8C",11,"cw","m","f",1,"","Strada Clopotarii Vechi",0,""],
[44.44909,26.093255,293,"sr",2,4.2,"#E7D8C9",1,"pl","","p",1,"","Strada Povernei",0,""],
[44.448952,26.093528,313,"cv",2,4.5,"#E6D3B3",1,"pl","","p",0,"Secția 1","Bulevardul Lascăr Catargiu",0,""],
[44.447519,26.096357,487,"mx",2,3.8,"#E9E0CF",7,"pl","v","h",2,"Casa Gheorghe Petrașcu","Strada Căderea Bastiliei",0,""],
[44.448224,26.094997,351,"sr",2,4.2,"#D8C3A5",1,"pl","v","p",0,"Casa Dinu Lipatti","Strada Visarion",1902,""],
[44.445842,26.097755,1441,"mx",9,3.8,"#A9A49B",3,"pl","c","p",14,"","Bulevardul General Gheorghe Magheru",0,""],
[44.44406,26.098642,256,"mx",8,3.8,"#C7C1B5",3,"pl","c","p",2,"","Strada Jules Michelet",0,""],
[44.450599,26.090305,374,"ob",5,4.2,"#E8E1D3",9,"pl","","f",0,"","Strada Clopotarii Vechi",0,""],
[44.451343,26.088827,263,"cv",2,4.5,"#BFB8A8",1,"pl","","p",0,"","Bulevardul Lascăr Catargiu",0,""],
[44.450013,26.094657,1191,"cvs",7,0,"#D8D3C8",39,"pn","m","f",3,"The Landmark Corp B","Strada Vasile Alecsandri",0,""],
[44.44199,26.099641,1112,"ho",2,5,"#C9B79C",9,"pl","","f",2,"Hotel Ambasador","Bulevardul General Gheorghe Magheru",0,""],
[44.450911,26.090219,599,"cv",5,4.5,"#5E7F8C",3,"pl","","p",1,"","Strada Clopotarii Vechi",0,""],
[44.455246,26.083742,1102,"sc",4,3.8,"#BFB8A8",3,"pl","","g",0,"","Strada Monetăriei",0,""],
[44.445218,26.098128,759,"mx",6,3.8,"#E8E1D3",3,"pl","","f",3,"","Bulevardul General Gheorghe Magheru",0,""],
[44.451185,26.089228,720,"mx",6,3.8,"#CFC8B8",3,"pl","","p",1,"Bl. H1","Strada Grigore Alexandrescu",0,""],
[44.451108,26.087685,1684,"cvs",0,0,"#5E7F8C",39,"cw","m","f",2,"Europe House","Strada Grigore Alexandrescu",0,""],
[44.451425,26.087015,671,"mx",15,3.8,"#BDB5A6",3,"cc","c","f",3,"Bl. D5","Calea Victoriei",0,""],
[44.449802,26.091998,81,"sr",3,4.2,"#E2D3B5",3,"pl","","p",0,"","Bulevardul Lascăr Catargiu",0,""],
[44.446558,26.097483,1160,"mx",9,3.8,"#C7C1B5",3,"pl","c","f",11,"","Bulevardul Dacia",0,""],
[44.443174,26.09913,601,"mx",8,3.8,"#C7C1B5",3,"pl","c","f",2,"","Bulevardul General Gheorghe Magheru",0,""],
[44.444838,26.098344,487,"mx",10,3.8,"#BDB5A6",3,"pl","c","f",3,"","Strada Tache Ionescu",0,""],
[44.451757,26.092931,334,"cv",6,4.5,"#E2D3B5",3,"pl","","p",0,"Pediatrie Intoxicații O.R.L.","Strada Grigore Alexandrescu",0,""],
[44.451868,26.093777,934,"ob",5,4.2,"#5E7F8C",11,"pl","","f",0,"HQ Victoriei","",0,"HQ Victoriei|e"],
[44.444467,26.098537,848,"mx",9,3.8,"#A9A49B",3,"pl","c","f",6,"","Strada George Enescu",0,""],
[44.451678,26.092226,165,"cv",1,4.5,"#E9E0CF",3,"pl","v","p",0,"Anatomie Patologică","",0,""],
[44.444429,26.098577,112,"mx",4,3.8,"#D9D2C3",3,"pl","","p",1,"","Strada George Enescu",0,""],
[44.444942,26.097333,528,"mx",4,3.8,"#BFB8A8",3,"pl","","h",1,"","Bulevardul General Gheorghe Magheru",0,""],
[44.446106,26.096757,1098,"mx",5,3.8,"#CFC8B8",1,"pl","","p",8,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.447327,26.095354,239,"mx",5,3.8,"#BFB8A8",3,"pl","i","p",1,"","Bulevardul Lascăr Catargiu",1935,""],
[44.447411,26.095174,408,"mx",5,3.8,"#BFB8A8",3,"pl","i","p",2,"","Strada Visarion",1920,""],
[44.448529,26.092943,302,"cv",2,4.5,"#A9A49B",3,"pl","c","d",0,"Observatorul Astronomic Municipal \"Amiral Vasile Urseanu\" Bucuresti","Strada Amiral Vasile Urseanu",1956,""],
[44.450306,26.089419,156,"mx",6,3.8,"#E2D3B5",1,"pl","","p",2,"","Bulevardul Lascăr Catargiu",0,""],
[44.452238,26.090878,70,"sr",1,4.2,"#E9E0CF",3,"pl","v","p",1,"Farmacia Santia","Bulevardul Iancu de Hunedoara",0,""],
[44.445949,26.096825,315,"mx",5,3.8,"#E2D3B5",3,"pl","","h",2,"","Bulevardul General Gheorghe Magheru",0,""],
[44.447015,26.095933,289,"sr",4,4.2,"#E6D3B3",3,"pl","v","p",0,"","Bulevardul Dacia",1890,""],
[44.450997,26.092288,194,"sr",2,4.2,"#D8C3A5",1,"pl","","p",1,"","Strada General Constantin Coandă",0,""],
[44.44566,26.096949,510,"mx",9,3.8,"#C7C1B5",3,"pl","c","f",2,"Bl. A","Strada Biserica Amzei",0,""],
[44.447309,26.095335,993,"sr",4,4.2,"#E9E0CF",1,"pl","","p",2,"","Strada Visarion",0,""],
[44.449196,26.093338,153,"sr",2,4.2,"#D8C3A5",1,"pl","","p",1,"","Strada Viișoarei",0,""],
[44.444649,26.097429,700,"mx",8,3.8,"#C7C1B5",3,"pl","c","f",1,"","Bulevardul General Gheorghe Magheru",0,""],
[44.446024,26.097853,110,"mx",8,3.8,"#BFB8A8",1,"pl","","p",1,"","Bulevardul General Gheorghe Magheru",0,""],
[44.445338,26.097082,660,"mx",7,3.8,"#D9D2C3",3,"pl","","p",2,"","Bulevardul General Gheorghe Magheru",0,""],
[44.450397,26.089163,395,"mx",6,3.8,"#E2D3B5",1,"pl","","p",1,"","Strada Puțul de Piatră",0,""],
[44.450206,26.089537,216,"mx",4,3.8,"#D9D2C3",3,"pl","i","p",1,"","Bulevardul Lascăr Catargiu",1939,""],
[44.447767,26.096227,351,"sc",2,3.8,"#BFB8A8",1,"pl","","p",2,"","Strada Căderea Bastiliei",0,""],
[44.450988,26.092504,390,"sr",3,4.2,"#D8C3A5",1,"pl","","p",1,"","Strada General Constantin Coandă",0,""],
[44.45183,26.089683,130,"ob",2,4.2,"#E9E0CF",9,"pl","","f",0,"","Bulevardul Iancu de Hunedoara",0,""],
[44.45069,26.088551,163,"sr",2,4.2,"#C9B79C",3,"pl","v","h",1,"","Strada Grigore Alexandrescu",0,""],
[44.45113,26.09359,217,"sr",3,4.2,"#E6D3B3",3,"pl","","p",1,"","Strada General Constantin Coandă",0,""],
[44.444226,26.097593,635,"mx",14,3.8,"#C7C1B5",3,"pl","c","f",10,"","Bulevardul General Gheorghe Magheru",0,""],
[44.444159,26.098835,425,"mx",1,3.8,"#D8C3A5",3,"pl","v","p",3,"","Strada George Enescu",0,""],
[44.447009,26.095787,227,"ho",2,5,"#C9B79C",9,"pl","","f",1,"","Bulevardul Dacia",0,""],
[44.44774,26.094347,822,"mx",7,3.8,"#D9D2C3",3,"pl","i","p",0,"","Strada Visarion",1939,""],
[44.448189,26.095483,220,"sr",2,4.2,"#E9E0CF",1,"pl","","p",1,"","Strada Visarion",0,""],
[44.452538,26.088667,318,"cw",8,4.2,"",15,"cw","m","f",0,"Louis Blanc Offices","Strada Louis Blanc",0,"Louis Blanc Offices|e"],
[44.449926,26.089982,474,"cv",3,4.5,"#D8C3A5",1,"pl","","p",0,"Ambasada Republicii Islamice Iran","Strada Gina Patrichi",0,""],
[44.451078,26.09349,92,"sr",3,4.2,"#E9E0CF",1,"pl","","p",1,"","Intrarea Blaj",0,""],
[44.44942,26.090958,532,"sr",3,4.2,"#E6D3B3",3,"pl","","p",1,"","Bulevardul Lascăr Catargiu",0,""],
[44.451691,26.091302,456,"cv",1,4.5,"#D8C3A5",3,"pl","v","p",0,"","",0,""],
[44.450163,26.093689,286,"un",5,4.2,"#BFB8A8",1,"pl","","p",0,"SNSPA","Strada Vasile Alecsandri",0,""],
[44.441481,26.099062,972,"ho",7,5,"#5E7F8C",11,"pl","m","h",1,"Hotel Lido","Strada Benjamin Franklin",0,""],
[44.442961,26.099472,1019,"mx",1,3.8,"#D8C3A5",3,"pl","v","h",1,"bookstore","Strada Pictor Arthur Verona",0,""],
[44.45088,26.092215,130,"sr",2,4.2,"#E9E0CF",1,"pl","","p",1,"","Strada Povernei",0,""],
[44.44788,26.096218,327,"sr",4,4.2,"#CFC8B8",3,"pl","","p",1,"","Strada Căderea Bastiliei",0,""],
[44.444424,26.097379,247,"ch",2,0,"#E9E0CF",1,"st","v","d",0,"Sinagoga Eșua Tova","Strada Tache Ionescu",1827,""],
[44.449687,26.09265,211,"ob",6,4.2,"#CFC8B8",11,"pl","","f",1,"","Strada Povernei",0,""],
[44.451581,26.089754,252,"ob",5,4.2,"#D8C3A5",9,"pl","","f",0,"Punct Termic","",0,"Punct Termic|e"],
[44.444292,26.098876,149,"mx",2,3.8,"#E6D3B3",3,"pl","v","p",1,"","Strada George Enescu",0,""],
[44.453116,26.084646,2093,"cv",2,4.2,"#E3D6B8",7,"st","v","f",0,"Muzeul Național de Istorie Naturală \"Grigore Antipa\"","Piața Victoriei",1908,""],
[44.45107,26.087287,410,"mx",11,3.8,"#C7C1B5",3,"pl","c","f",5,"Bl. D6","Calea Victoriei",0,""],
[44.449305,26.091035,1037,"ho",8,5,"#5E7F8C",11,"pl","m","f",2,"Hotel Minerva","Strada General Gheorghe Manu",0,""],
[44.447152,26.097475,383,"sr",3,4.2,"#D8C3A5",1,"pl","","p",2,"","Bulevardul Dacia",0,""],
[44.454812,26.085202,2040,"cv",2,4.2,"#A9A49B",1,"pl","p","y",0,"Muzeul Național Geologic","Șoseaua Pavel Dimitrievici Kiseleff",1990,""],
[44.447842,26.093915,231,"sr",2,4.2,"#C9B79C",1,"pl","","p",0,"Serviciul public comunitar pentru eliberarea și evidența pașapoartelor simple","Strada Nicolae Iorga",0,""],
[44.450485,26.093587,361,"sc",2,3.8,"#E9E0CF",1,"pl","","p",0,"Școala Internațională Italiană „Aldo Moro” din București","Intrarea Blaj",0,""],
[44.441579,26.099831,2140,"ob",7,4.2,"#E2D3B5",11,"pl","i","f",0,"Garajul Ciclop","Bulevardul General Gheorghe Magheru",1923,"Garajul Ciclop|e"],
[44.450643,26.088324,217,"sr",1,4.2,"#E6D3B3",3,"pl","v","m",1,"","Strada Grigore Alexandrescu",0,""],
[44.451984,26.092749,691,"cv",1,4.5,"#E6D3B3",2,"pl","v","p",0,"","",0,""],
[44.455008,26.083479,85,"sc",2,3.8,"#D8C3A5",2,"pl","v","p",0,"Grădinița Ion Heliade Rădulescu","Strada Monetăriei",0,""],
[44.447107,26.097569,312,"mx",4,3.8,"#CFC8B8",2,"pl","i","p",4,"","Strada Stanislav Cihoschi",1930,""],
[44.449599,26.094937,1201,"cvs",7,0,"#D8D3C8",38,"pl","m","p",0,"The Landmark Corp C","Strada Constantin Daniel",0,""],
[44.450862,26.087511,342,"mx",11,3.8,"#BDB5A6",2,"pl","c","f",1,"Bl. D7","Strada Grigore Alexandrescu",0,""],
[44.443764,26.097566,1437,"mx",7,3.8,"#E8E1D3",0,"pl","","p",1,"","Strada George Enescu",0,""],
[44.44933,26.094413,911,"mx",2,3.8,"#C9B79C",0,"pl","v","p",0,"Compania Națională de Investiții S.A.","Strada Constantin Daniel",0,""],
[44.455226,26.083307,302,"ch",6,0,"#D9D2C3",0,"st","","d",0,"Biserica Voievodală \"Izvorul Tămăduirii\" Mavrogheni","Strada Monetăriei",1786,""],
[44.447401,26.094583,172,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Visarion",0,""],
[44.450636,26.088132,222,"ob",5,4.2,"#BFB8A8",10,"pl","","f",1,"","Strada Grigore Alexandrescu",0,""],
[44.449546,26.090298,825,"cv",3,4.5,"#E9E0CF",0,"pl","","p",0,"Ambasada Indoneziei","Strada Gina Patrichi",0,""],
[44.451862,26.091284,3493,"cv",2,4.5,"#E7D8C9",2,"pl","v","p",0,"","Strada Clopotarii Vechi",0,""],
[44.450847,26.093273,114,"cv",3,4.5,"#E9E0CF",0,"pl","","p",0,"","Intrarea Blaj",0,""],
[44.450858,26.093402,129,"cv",3,4.5,"#C9B79C",0,"pl","","p",0,"","Intrarea Blaj",0,""],
[44.452846,26.08934,170,"sr",3,4.2,"#E9E0CF",2,"pl","","p",0,"Kineto Consult","Strada Argentina",0,""],
[44.446689,26.097941,433,"mx",7,3.8,"#BFB8A8",2,"pl","","f",2,"","Bulevardul Dacia",0,""],
[44.443687,26.099421,886,"mx",7,3.8,"#D9D2C3",0,"pl","","p",0,"","Strada Jules Michelet",0,""],
[44.448544,26.095365,114,"ch",2,0,"#CFC8B8",0,"st","","d",0,"Biserica „Sf. Visarion Vechi“","Strada Visarion",1797,""],
[44.449369,26.093747,195,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Viișoarei",0,""],
[44.452788,26.088654,171,"cv",2,4.5,"#D8C3A5",0,"pl","","p",0,"Ambasada Spaniei","Strada Louis Blanc",0,""],
[44.450787,26.093163,138,"ho",3,5,"#E7D8C9",8,"pl","","f",0,"","Intrarea Blaj",0,""],
[44.446945,26.095272,189,"sr",2,4.2,"#D8C3A5",0,"pl","","p",1,"","Bulevardul Dacia",0,""],
[44.451245,26.085837,5860,"mx",14,3.8,"#C7C1B5",2,"pl","c","p",8,"Bl. D1","Calea Victoriei",0,""],
[44.448957,26.091259,456,"ho",6,5,"#E8E1D3",10,"pl","","f",1,"","Strada General Gheorghe Manu",0,""],
[44.44662,26.095893,950,"sr",2,4.2,"#C9B79C",0,"pl","","p",1,"","Bulevardul Dacia",0,""],
[44.441956,26.100267,675,"un",0,4.2,"#D8CDB8",0,"pl","","p",0,"UB - Facultatea de Limbi și Literaturi Străine","Strada Pitar Moș",0,""],
[44.452916,26.089395,115,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Argentina",0,""],
[44.448169,26.096222,230,"cv",2,4.5,"#E6D3B3",2,"pl","v","f",0,"","Strada Căderea Bastiliei",0,""],
[44.452067,26.092061,237,"cv",1,4.5,"#D8C3A5",2,"pl","v","p",0,"Laborator Clinic","",0,""],
[44.448315,26.092433,139,"sr",2,4.2,"#E6D3B3",2,"pl","v","p",0,"","Strada Henri Coandă",0,""],
[44.450567,26.087705,293,"ob",5,4.2,"#D9D2C3",10,"pl","","f",0,"Salrom","Strada Grigore Alexandrescu",0,"Salrom|e"],
[44.452176,26.092632,1114,"cv",6,4.5,"#BFB8A8",2,"pl","","p",0,"","Bulevardul Iancu de Hunedoara",0,""],
[44.452264,26.094889,358,"ob",15,4.2,"#C9B79C",8,"pl","","f",0,"Search Corporation","Strada Macarie Cântarețul",0,"Search Corporation|e"],
[44.446915,26.095161,167,"sr",2,4.2,"#C9B79C",0,"pl","","p",1,"","Bulevardul Dacia",0,""],
[44.443931,26.097195,475,"cv",2,3.8,"#C9B79C",2,"pl","v","f",0,"Sediul Central \"Mihail Sadoveanu\" - Biblioteca Metropolitană București","Strada Tache Ionescu",0,""],
[44.44492,26.096704,283,"ho",7,5,"#D9D2C3",8,"pl","","f",0,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.450531,26.091923,119,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Povernei",0,""],
[44.447078,26.097929,397,"sr",3,4.2,"#D9D2C3",2,"pl","","f",2,"","Strada Stanislav Cihoschi",0,""],
[44.448662,26.095396,336,"ch",2,0,"#E6D3B3",0,"st","v","d",0,"Biserica Ortodoxă „Sfântul Visarion Nou\"","Strada Visarion",1913,""],
[44.445908,26.096182,356,"sr",2,4.2,"#E9E0CF",0,"pl","","p",0,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.446625,26.098185,666,"cw",7,5,"#5E7F8C",10,"cw","m","f",1,"","Bulevardul Dacia",0,""],
[44.44701,26.094882,969,"sr",2,4.2,"#C9B79C",0,"pl","","p",1,"","Bulevardul Dacia",0,""],
[44.450228,26.09541,1363,"ob",5,4.2,"#5E7F8C",10,"pl","","f",0,"","Strada Căderea Bastiliei",0,""],
[44.452333,26.093349,325,"sr",2,4.2,"#E6D3B3",0,"pl","","p",1,"","Bulevardul Iancu de Hunedoara",0,""],
[44.449051,26.09474,619,"sr",2,4.2,"#E9E0CF",0,"pl","","p",0,"","Strada Constantin Daniel",0,""],
[44.442324,26.100308,1859,"mx",2,3.8,"#D8CDB8",2,"pl","","g",0,"","Strada Pictor Arthur Verona",0,""],
[44.443511,26.097266,213,"mx",10,3.8,"#202020",4,"pl","","p",1,"","Strada George Enescu",0,""],
[44.450704,26.095501,312,"sr",2,4.2,"#E6D3B3",0,"pl","","p",1,"","Strada Căderea Bastiliei",0,""],
[44.452824,26.087382,4930,"cv",0,4.5,"#D9CDB4",6,"st","","f",0,"Palatul Victoria","Bulevardul Iancu de Hunedoara",0,""],
[44.441802,26.100495,1691,"un",3,4.2,"#D8CDB8",2,"pl","","p",0,"Centrul de Limbi Străine Ariel","Strada Pitar Moș",0,""],
[44.448831,26.091057,808,"ho",7,5,"#BFB8A8",10,"pl","","f",1,"","Strada General Gheorghe Manu",0,""],
[44.448929,26.095182,193,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Visarion",0,""],
[44.446551,26.095515,460,"cw",6,5,"#5E7F8C",10,"cw","m","f",1,"Romană Offices","Bulevardul Dacia",0,""],
[44.452271,26.092121,403,"cv",2,4.5,"#C9B79C",2,"pl","v","p",0,"Chirurgie - Urologie","Bulevardul Iancu de Hunedoara",0,""],
[44.447081,26.098136,70,"sr",1,4.2,"#D8C3A5",2,"pl","v","p",1,"","Bulevardul Dacia",0,""],
[44.451992,26.095514,1022,"ob",15,4.2,"#C9B79C",8,"pl","","f",0,"Allianz-Țiriac Sediu Central","Strada Căderea Bastiliei",0,"Allianz-Țiriac Sediu Central|e"],
[44.455451,26.085462,768,"cv",3,4.2,"#D8C3A5",2,"pl","","y",0,"Institutul de Istorie „Nicolae Iorga”","Bulevardul Aviatorilor",0,""],
[44.448861,26.095455,249,"ch",2,0,"#BFB8A8",0,"st","","d",0,"","Strada Visarion",0,""],
[44.443373,26.097179,339,"sr",2,4.2,"#FBBE99",4,"pl","","p",3,"","Strada George Enescu",0,""],
[44.444198,26.096775,346,"mx",7,3.8,"#E2D3B5",2,"pl","","p",0,"Palace Atena","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.45167,26.095679,196,"sr",2,4.2,"#E9E0CF",0,"pl","","p",1,"","Strada Căderea Bastiliei",0,""],
[44.447922,26.097356,493,"un",5,4.2,"#BFB8A8",0,"pl","","p",0,"Clădirea Stanislas Cihoschi","Strada Stanislav Cihoschi",0,""],
[44.448445,26.096338,155,"sc",2,3.8,"#E2D3B5",0,"pl","","p",0,"Grădiniţa Nr. 50","Strada Căderea Bastiliei",0,""],
[44.443843,26.096903,624,"mx",3,3.8,"#E2D3B5",2,"pl","","h",0,"","Strada Tache Ionescu",0,""],
[44.45062,26.086951,709,"mx",11,3.8,"#BDB5A6",2,"pl","c","f",2,"Bl. D4","Strada Sevastopol",0,""],
[44.447804,26.09278,1157,"sr",2,4.2,"#D8C3A5",0,"pl","","p",0,"","Strada Henri Coandă",0,""],
[44.445113,26.099258,238,"mx",2,3.8,"#E9E0CF",2,"pl","v","p",2,"","Strada Tache Ionescu",0,""],
[44.445205,26.096171,265,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.448755,26.090823,552,"ob",5,4.2,"#E9E0CF",8,"pl","","f",0,"","Strada General Gheorghe Manu",0,""],
[44.44087,26.099436,619,"cw",8,5,"#5E7F8C",10,"cw","m","f",5,"","Strada C. A. Rosetti",0,""],
[44.444989,26.096238,162,"sr",2,4.2,"#D8C3A5",0,"pl","","p",0,"Casa Ștefan Luchian","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.449979,26.08834,818,"ob",8,4.2,"#C7C1B5",10,"pl","","f",2,"","Calea Victoriei",0,""],
[44.454688,26.082893,104,"ob",6,4.2,"#E6D3B3",8,"pl","","f",0,"","Strada Monetăriei",0,""],
[44.451367,26.095819,385,"sr",2,4.2,"#C9B79C",0,"pl","","p",0,"","Strada Căderea Bastiliei",0,""],
[44.440965,26.09998,424,"cw",7,5,"#5E7F8C",10,"cw","m","f",1,"Scala","Strada C. A. Rosetti",0,""],
[44.447385,26.093434,367,"cv",2,4.5,"#E9E0CF",0,"pl","","p",0,"","Strada Nicolae Iorga",0,""],
[44.445341,26.09602,668,"sr",2,4.2,"#D8C3A5",2,"pl","v","p",0,"","Strada Biserica Amzei",0,""],
[44.44702,26.09414,359,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Nicolae Iorga",0,""],
[44.445233,26.099315,370,"mx",3,3.8,"#E7D8C9",2,"pl","v","p",1,"Creart","Strada Tache Ionescu",0,""],
[44.448089,26.097297,940,"sr",3,4.2,"#E7D8C9",0,"pl","","p",0,"Sala de Sport ASE","Strada Stanislav Cihoschi",0,""],
[44.44117,26.098118,429,"mx",7,3.8,"#BFB8A8",0,"pl","","p",0,"","Strada Nicolae Golescu",0,""],
[44.443012,26.097119,212,"sr",2,4.2,"#595959",4,"pl","","p",1,"","Strada Nicolae Golescu",0,""],
[44.442861,26.097153,171,"cv",2,4.5,"#D8C3A5",0,"pl","","p",1,"","Strada Nicolae Golescu",0,""],
[44.446905,26.094258,197,"cv",2,4.5,"#D8C3A5",0,"pl","","p",0,"","Bulevardul Dacia",0,""],
[44.450134,26.095887,158,"ho",4,5,"#E8E1D3",10,"pl","","f",1,"","Strada Ion Slătineanu",0,""],
[44.443488,26.096838,501,"mx",7,3.8,"#CFC8B8",0,"pl","","p",1,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.444817,26.096191,440,"sc",2,3.8,"#E7D8C9",0,"pl","","p",0,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.442777,26.100575,387,"mx",0,3.8,"#D8CDB8",0,"pl","","p",0,"Casa Ion Mincu","Strada Pitar Moș",0,""],
[44.44973,26.088598,315,"sr",1,4.2,"#D8C3A5",2,"pl","v","g",1,"","Calea Victoriei",0,""],
[44.443655,26.096719,112,"sr",2,4.2,"#E6D3B3",0,"pl","","p",0,"","Strada Dimitri Ivanovici Mendeleev",0,""],
[44.441013,26.100383,758,"mx",8,3.8,"#D8CDB8",2,"pl","","p",1,"","Strada C. A. Rosetti",0,""],
[44.441795,26.100966,509,"ob",7,4.2,"#D8CDB8",10,"pl","","f",0,"","Strada Pitar Moș",0,""],
[44.44154,26.100916,699,"in",5,6,"#B9BCBE",2,"mc","","f",0,"","Strada Pitar Moș",0,""],
[44.450237,26.087103,553,"cv",2,4.2,"#E7D8C9",2,"pl","v","h",0,"Casa Filipescu-Cesianu","Strada Sevastopol",0,""],
[44.449702,26.096051,124,"sr",2,4.2,"#C9B79C",0,"pl","","p",1,"","Strada Căderea Bastiliei",0,""],
[44.449541,26.088677,550,"mx",8,3.8,"#BDB5A6",2,"pl","c","p",1,"","Calea Victoriei",0,""],
[44.440665,26.10039,670,"mx",10,3.8,"#D8CDB8",2,"pl","","p",2,"Bl. Scala","Strada C. A. Rosetti",0,""],
[44.44121,26.101195,268,"ho",3,5,"#D8CDB8",10,"pl","","h",0,"Scala Boutique Hotel","Strada C. A. Rosetti",0,"Scala Boutique Hotel|t"],
[44.440496,26.100222,153,"mx",0,3.8,"#D8CDB8",0,"pl","","p",1,"","Bulevardul Nicolae Bălcescu",0,""],
[44.450245,26.096556,365,"cv",2,4.5,"#D8C3A5",0,"pl","","p",0,"","Strada Ion Slătineanu",0,""],
[44.440304,26.099124,256,"ch",2,0,"#D9D2C3",0,"st","","d",0,"Biserica Ortodoxă \"Boteanu-Ienii\"","Strada Boteanu",0,""],
[44.44947,26.08795,793,"cw",11,5,"#5E7F8C",10,"cw","m","f",2,"Victoria Center","Calea Victoriei",0,""],
[44.449614,26.096602,152,"mx",2,3.8,"#E7D8C9",0,"pl","v","p",0,"","Strada Căderea Bastiliei",0,""],
[44.440229,26.098463,310,"ob",8,4.2,"#C9B79C",8,"pl","","f",1,"","Strada C. A. Rosetti",0,""],
[44.44025,26.100339,446,"mx",8,3.8,"#D8CDB8",2,"pl","","p",1,"","Bulevardul Nicolae Bălcescu",0,""],
[44.440143,26.098597,189,"sr",2,4.2,"#D8C3A5",0,"pl","","p",1,"","Strada Boteanu",0,""],
[44.439901,26.099526,1843,"mx",9,3.8,"#BDB5A6",2,"pl","c","p",3,"","Strada C. A. Rosetti",0,""],
[44.440026,26.100527,454,"mx",8,3.8,"#D8CDB8",2,"pl","","p",0,"","Bulevardul Nicolae Bălcescu",0,""],
[44.439881,26.10063,453,"mx",8,3.8,"#D8CDB8",2,"pl","","p",0,"","Bulevardul Nicolae Bălcescu",0,""]],
"bucharest-otopeni":[
[44.55826,26.069648,139,"fu",1,5,"#F2F2F2",1,"fu","a","f",2,"Gazprom","Calea Bucureștilor",0,""],
[44.569174,26.077014,2317,"mx",1,3.8,"#D8CDB8",3,"pl","v","p",0,"","",0,""],
[44.560787,26.069815,201,"fu",1,5,"#F2F2F2",1,"fu","a","f",2,"Rompetrol","Calea Bucureștilor",0,""],
[44.567086,26.070224,419,"fu",1,5,"#F2F2F2",1,"fu","a","f",2,"OMV","Calea Bucureștilor",0,""],
[44.558272,26.069825,157,"sr",1,4.2,"#D8CDB8",3,"pl","v","p",1,"Gazprom","Calea Bucureștilor",0,""],
[44.569056,26.075383,3063,"cv",2,4.5,"#D7D5CF",3,"pl","p","g",0,"Aeroport Henri Coandă","Monumentul Eroilor Jandarmi",2020,""],
[44.560992,26.068953,177,"mx",1,3.8,"#D8CDB8",1,"pl","a","p",1,"Speli-Singur.ro","Strada Nicolae Grigorescu",0,""],
[44.55942,26.069982,1505,"sr",2,4.2,"#D8CDB8",3,"pl","v","p",1,"","Strada Zborului",0,""],
[44.557988,26.069934,1394,"sr",2,4.2,"#D8CDB8",1,"pl","","p",1,"Ferremo Trendy","Calea Bucureștilor",0,""],
[44.560789,26.070048,241,"sr",1,4.2,"#D8CDB8",3,"pl","v","g",1,"hei","",0,""],
[44.567107,26.07038,323,"sr",1,4.2,"#D8CDB8",3,"pl","v","g",1,"Viva","",0,""],
[44.560297,26.070053,1440,"ho",5,5,"#D8CDB8",11,"pl","","f",1,"Ramada","Calea Bucureștilor",0,""],
[44.556888,26.068689,976,"ob",5,4.2,"#D8CDB8",9,"pl","","f",0,"Maxigel","Calea Bucureștilor",0,"Maxigel|e"],
[44.561356,26.068873,212,"fu",1,5,"#F2F2F2",1,"fu","a","f",1,"Rompetrol","Strada Nicolae Grigorescu",0,""],
[44.561786,26.070176,801,"ho",4,5,"#BFC2C4",11,"pl","p","f",1,"Ibis Styles","Calea Bucureștilor",2023,""],
[44.569152,26.07656,5639,"pk",2,3.2,"#A9A69F",3,"cc","v","f",0,"","",0,""],
[44.561397,26.068695,218,"sr",1,4.2,"#D8CDB8",2,"pl","v","g",0,"hei","Strada Nicolae Grigorescu",0,""],
[44.555509,26.069741,927,"su",2,6,"#D9D6CF",24,"sp","","f",1,"Mega Image","Strada Mărășești",0,""],
[44.567871,26.069004,1747,"ho",6,5,"#5F7F8E",10,"pl","m","f",1,"Vienna House Easy Airport Bucharest","Drumul Gării Odăii",0,""],
[44.566493,26.068369,2425,"ob",4,4.2,"#D8CDB8",10,"pl","","f",0,"Novomatic Romania","",0,"Novomatic Romania|e"],
[44.56722,26.068397,2222,"sr",4,4.2,"#D8CDB8",2,"pl","","p",2,"Airport Plaza","Drumul Gării Odăii",0,""],
[44.569149,26.069476,355,"ho",2,5,"#D8CDB8",10,"pl","v","h",1,"Casa Românească","Calea Bucureștilor",0,""],
[44.569017,26.069227,189,"sr",2,4.2,"#D8CDB8",2,"pl","v","g",1,"Casa Românească","Calea Bucureștilor",0,""],
[44.571145,26.076938,609,"mx",2,3.8,"#D8CDB8",2,"pl","v","p",0,"","",0,""]],
"seattle-bellevue":[
[47.617522,-122.200666,295,"sr",0,4.8,"#B7AC9C",1,"us","","f",0,"","Northeast 8th Street",0,""],
[47.617692,-122.199606,593,"bk",2,4.5,"#B7AC9C",3,"us","","f",1,"Chase","Northeast 8th Street",0,""],
[47.617742,-122.201312,2132,"sr",4,4.8,"#B7AC9C",3,"us","","f",3,"Bellevue Place","Bellevue Way Northeast",0,""],
[47.617747,-122.197417,3074,"sr",3,4.8,"#B7AC9C",1,"us","","f",1,"","Northeast 8th Street",0,""],
[47.617718,-122.191529,1930,"cw",9,5,"#6F8A94",11,"cw","","f",2,"Plaza East","112th Avenue Northeast",0,""],
[47.617069,-122.191332,2083,"cw",13,5,"#6F8A94",11,"cw","","f",3,"Bravern 1","112th Avenue Northeast",0,""],
[47.617083,-122.191926,434,"sr",1,4.8,"#B7AC9C",1,"us","","f",1,"","Northeast 8th Street",0,""],
[47.617807,-122.19579,1344,"cw",10,5,"#6F8A94",11,"cw","","f",1,"U.S. Bank","Northeast 8th Street",0,""],
[47.617831,-122.198308,1183,"sr",1,4.8,"#B7AC9C",1,"us","","f",1,"","Northeast 8th Street",0,""],
[47.617831,-122.194025,2068,"cw",16,5,"#6F8A94",43,"cw","","f",2,"Plaza Center","Northeast 9th Street",0,""],
[47.616945,-122.201061,10404,"ml",3,5.5,"#CFCAC0",43,"pn","","f",9,"Lincoln Square","Bellevue Way Northeast",0,""],
[47.617864,-122.192535,2081,"mx",12,4.5,"#B7AC9C",3,"us","","f",1,"Alley 111","Northeast 9th Street",0,""],
[47.617046,-122.198023,3460,"sr",3,4.8,"#B7AC9C",1,"us","","f",0,"The Artise","Northeast 8th Street",0,""],
[47.616967,-122.19287,2939,"ob",3,4.2,"#B7AC9C",9,"us","","f",1,"Bravern 2","110th Avenue Northeast",0,""],
[47.616917,-122.193974,317,"ob",3,4.2,"#B7AC9C",9,"us","","f",0,"Yuen Lui","110th Avenue Northeast",0,"Yuen Lui|e"],
[47.617981,-122.194863,5103,"pk",4,3.2,"#A9A69F",3,"cc","","f",0,"","109th Avenue Northeast",0,""],
[47.616949,-122.199927,1461,"ob",4,4.2,"#B7AC9C",11,"us","","f",0,"Paccar","Northeast 8th Street",0,"Paccar|e"],
[47.616922,-122.19689,2447,"cw",25,5,"#6F8A94",10,"cw","","f",1,"Symetra Center","Northeast 8th Street",0,""],
[47.615873,-122.200781,3051,"ho",2,5,"#B7AC9C",10,"us","","f",3,"Westin Bellevue","Bellevue Way Northeast",0,""],
[47.618087,-122.201401,313,"sr",2,4.8,"#B7AC9C",2,"us","","f",1,"","Bellevue Way Northeast",0,""],
[47.618093,-122.200606,116,"mx",0,4.5,"#B7AC9C",0,"us","","f",0,"","",0,""],
[47.617085,-122.202725,4835,"sr",3,4.8,"#B7AC9C",0,"us","","f",9,"Bellevue Square Mall","Bellevue Way Northeast",0,""],
[47.616634,-122.202744,5823,"pk",6,3.2,"#A9A69F",2,"cc","","f",0,"Northeast Parking Garage","Northeast 8th Street",0,""],
[47.618113,-122.202189,1679,"sr",2,4.8,"#B7AC9C",2,"us","","f",2,"","Bellevue Way Northeast",0,""],
[47.618192,-122.200483,11177,"ho",6,5,"#B7AC9C",10,"us","","f",8,"Bellevue Place","Bellevue Way Northeast",0,""],
[47.615359,-122.201364,1518,"sr",3,4.8,"#B7AC9C",0,"us","","f",0,"Bellevue Art Museum","Northeast 6th Street",0,""],
[47.618251,-122.196023,121,"mx",0,4.5,"#B7AC9C",0,"us","","f",0,"US Bank Drive-Thru","108th Avenue Northeast",0,""],
[47.618265,-122.197669,1670,"sr",0,4.8,"#B7AC9C",0,"us","","f",0,"","Northeast 9th Place",0,""],
[47.616681,-122.199634,1164,"cw",13,5,"#6F8A94",10,"cw","","f",0,"Paccar Building","106th Avenue Northeast",0,"Paccar Building|e"],
[47.618298,-122.196826,2271,"cw",19,5,"#6F8A94",10,"cw","","f",1,"","108th Avenue Northeast",0,""],
[47.617967,-122.202813,2989,"ho",26,5,"#B7AC9C",10,"us","","f",2,"","Avenue Square Northeast",0,""],
[47.616779,-122.186302,322,"dt",0,4.5,"#B7AC9C",0,"us","","f",1,"Chick-fil-A","116th Avenue Northeast",0,""],
[47.616481,-122.192778,5139,"sr",2,4.8,"#B7AC9C",2,"us","","f",3,"The Shops at Bravern","110th Avenue Northeast",0,""],
[47.616515,-122.195804,924,"sr",0,4.8,"#B7AC9C",0,"us","","f",0,"Bradford Center","108th Avenue Northeast",0,""],
[47.618377,-122.191305,1893,"mx",13,4.5,"#B7AC9C",2,"us","","f",2,"Elements Too","112th Avenue Northeast",0,""],
[47.618464,-122.202329,1082,"sr",2,4.8,"#B7AC9C",2,"us","","f",0,"","Avenue Square Northeast",0,""],
[47.61851,-122.19336,1040,"mx",6,4.5,"#B7AC9C",2,"us","","f",1,"","Northeast 9th Street",0,""],
[47.618498,-122.191799,1065,"mx",23,4.5,"#B7AC9C",2,"us","","f",0,"Elements Too","111th Avenue Northeast",0,""],
[47.618094,-122.203218,3658,"cw",25,5,"#6F8A94",10,"cw","","f",0,"","103rd Avenue Northeast",0,""],
[47.618589,-122.19152,485,"mx",3,4.5,"#B7AC9C",2,"us","","f",1,"Elements Too","112th Avenue Northeast",0,""],
[47.618646,-122.199672,494,"ob",0,4.2,"#B7AC9C",8,"us","","f",0,"Redwood Building","106th Avenue Northeast",0,"Redwood Building|e"],
[47.617864,-122.203859,1198,"sr",2,4.8,"#B7AC9C",2,"us","","f",5,"McAusland Building","102nd Avenue Northeast",0,""],
[47.618852,-122.202492,4756,"mx",2,4.5,"#B7AC9C",2,"us","","f",2,"Avalon Towers Bellevue","103rd Avenue Northeast",0,""]],
"seattle-seatac":[
[47.46262,-122.289764,240,"cv",2,4.5,"#B7AC9C",0,"us","","f",0,"Washington State Patrol - South King Detachment","International Boulevard",0,""],
[47.462294,-122.292103,2053,"in",1,6,"#B9BCBE",0,"mc","","f",0,"","",0,""],
[47.456382,-122.299112,5875,"ob",2,4.2,"#B7AC9C",8,"us","","f",0,"Gate Gourmet Flight Kitchen","",0,"Gate Gourmet Flight Kitchen|e"],
[47.459119,-122.300029,862,"sr",0,4.8,"#B7AC9C",0,"us","","f",0,"Pump House","South 161st Street",0,""],
[47.464152,-122.288246,2459,"sr",2,4.8,"#CCCCCC",4,"us","","f",0,"","",0,""],
[47.456731,-122.301768,6457,"in",0,6,"#B9BCBE",0,"mc","","f",0,"Alaska Airlines Cargo","Air Cargo Road",0,""],
[47.460922,-122.293247,34059,"pk",4,3.2,"#A9A69F",2,"cc","","f",1,"Seatac Rental Car Facility","",0,""]]};
