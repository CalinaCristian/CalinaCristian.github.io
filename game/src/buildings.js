import * as THREE from '../vendor/three.module.min.js';
import { GeoBatch, makeCanvasTexture } from './util.js';

// ============================================================================
//  Street-specific building styles. Each generator returns a list of parts:
//  { kind: 'win'|'plain'|'shop'|'roof', x, y, z (local, centred on lot), w, h, d, color, tex? }
//  Local frame: +z points toward the street (the front), x along the street.
// ============================================================================

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PYR = new THREE.ConeGeometry(0.72, 1, 4); PYR.rotateY(Math.PI / 4); // square pyramid roof, base 1x1

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
