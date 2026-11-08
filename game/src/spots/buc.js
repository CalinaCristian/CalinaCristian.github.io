// ============================================================================
//  Bucharest kit for spot scenes (spec 15): OSM backdrop in the Bucharest look
//  (eclectic stucco / 1980s blocks / interwar, white centre lines, cast-iron
//  lanterns, boulevard candelabras), procedural classical façades for hero
//  buildings (canvas tiles: arcades, arched / pedimented windows, pilasters,
//  cornices, loggias — no photo textures: Romania has no freedom of panorama),
//  see-through stone balustrades, flags (RO / EU / NATO), placed landmark
//  models from landmarks.js (read-only import) and small street props.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { translatedLandmarkCollider } from './landmark-colliders.js';
import { GeoBatch, M, rng, hash2, canvas, canvasTexture, fitDraw, polyArea, centroid, inPoly, polyBox, offsetPolyline, polylineLength, alongPolyline } from './kit.js';
import { wallGeometry, polyCollider } from './osm.js';
import { LANDMARKS, buildLandmark } from '../landmarks.js';

// ---------------------------------------------------------------------------- OSM backdrop, Bucharest look
/** building style for Bucharest OSM buildings (osm.js façade styles) */
export function bucStyle(b) {
    const k = b.k, h = b.h || (b.lv ? b.lv * 3.1 : 0), m = b.mat || '';
    if (/glass/.test(m) || (k === 'office' && h > 34) || h > 55) return 'office';
    if (k === 'house' || k === 'detached' || k === 'villa' || k === 'semidetached_house') return h > 9 || (b.lv || 2) > 2 ? 'interwar' : 'eclectic';
    if (k === 'garage' || k === 'shed' || k === 'kiosk' || k === 'service' || k === 'roof') return 'concrete';
    if (k === 'church' || k === 'chapel' || k === 'cathedral' || k === 'monastery') return 'eclectic';
    if ((b.lv || 0) >= 7 || h >= 21) return (k === 'office' || k === 'government' || k === 'public') && (b.lv || 0) < 9 ? 'interwar' : 'bloc';
    if ((b.lv || 0) >= 5 && /apartments|residential/.test(k)) return hash2(b.poly[0][0], b.poly[0][1]) < 0.5 ? 'interwar' : 'bloc';
    return 'eclectic';
}
/**
 * the standard OSM backdrop in the Bucharest look; o is passed to ctx.osmBackdrop (o.paint merged)
 * lamps: 'lantern' (old town, parks) | 'candelabra' (boulevards) | 'cobra'
 */
export function bucBackdrop(ctx, o = {}) {
    // lamps only near the walkable extents (+ pad), never inside hero exclusions
    const boxes = Object.values(ctx.data.spots).map((s) => polyBox(s.extent?.polygon?.length ? s.extent.polygon : [[-150, -150], [150, 150]]));
    const pad = o.lampPad ?? 60, ex = ctx.exclude;
    const near = (x, z) => boxes.some((b) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) && !ex.some((p) => inPoly(x, z, p));
    ctx.osmBackdrop({
        urban: true, style: o.style || bucStyle, shopStyle: 'bucshop',
        streetTreeOpts: { spacing: 12, prob: 0.7, ...(o.streetTreeOpts || {}) },
        lampOpts: { spacing: 32, inside: near, ...(o.lampOpts || {}) },
        ...o,
        paint: { centre: '#e8e6df', centreSingle: !o.doubleCentre, ...(o.paint || {}) },
    });
    ctx.treeLod = { dist: 45, cap: 3200, ...(o.treeLod || {}) };
    ctx.finishTrees = () => assignSpecies(ctx, o.species); // run by loadSpot after the scene added all its trees
    if (o.treeScale) for (const t of ctx.trees) t.s = (t.s || 0.9) * o.treeScale; // mature boulevard trees (Kiseleff: 15–20 m)
    ctx.lampOpts = { style: o.lampStyle || 'lantern', color: o.lampColor || '#1b1d1e', h: o.lampH || (o.lampStyle === 'candelabra' ? 9 : 4.4) };
}

/** broadleaf trees → species crowns (OSM species where mapped; else plane / linden / chestnut by weights) */
export function assignSpecies(ctx, weights = { plane: 0.4, linden: 0.35, chestnut: 0.25 }) {
    const bySpot = new Map(); for (const [x, z, , sp] of ctx.data.trees) bySpot.set(Math.round(x * 10) + ',' + Math.round(z * 10), sp || '');
    const r = rng(91), W = Object.entries(weights), tot = W.reduce((a, [, w]) => a + w, 0);
    for (const t of ctx.trees) {
        if ((t.kind || 'broad') !== 'broad' || t.c) continue;
        const sp = bySpot.get(Math.round(t.x * 10) + ',' + Math.round(t.z * 10)) || '';
        if (/Platanus/.test(sp)) t.kind = 'plane'; else if (/Tilia/.test(sp)) t.kind = 'linden'; else if (/Aesculus|Quercus|Juglans|Acer/.test(sp)) t.kind = 'chestnut';
        else { let q = r() * tot; for (const [k, w] of W) { q -= w; if (q <= 0) { t.kind = k; break; } } }
        t.s = (t.s || 1) * (0.85 + r() * 0.25) / Math.max(0.8, t.s || 1); // species crowns carry their real size
    }
}

// ---------------------------------------------------------------------------- classical façade tiles
const FAC = new Map();
/**
 * Canvas façade for hero buildings: a tile of 4 bays × 4 bands (bottom → top). Use with wallGeometry(poly, y0, y1,
 * { bay, floor }, vBase, colour) so one tile spans 4 bays × 4 bands. Vertex colour tints the white stucco.
 * rows: 4 band specs { t: 'arcade'|'arch'|'arch2'|'rect'|'pediment'|'small'|'loggia'|'blank'|'columns'|'portal', pil?: bool|'pair',
 *   cornice?: bool, rail?: bool (iron balconette), rustic?: bool, w?: window width frac, top?: frac, bottom?: frac }
 * o: { glass, trim (shadow tone), lit (prob. of a lit window at night), flood: '#hex' → whole façade glows (floodlit) at night }
 */
export function classicFacade(key, rows, o = {}) {
    if (FAC.has(key)) return FAC.get(key);
    // drawn in a 512 px design space; o.res (1 | 2) renders it at 512·res px (sharper close-up, e.g. old-town fronts)
    const T = 512, C = T / 4, RES = o.res || 1, c = canvas(T * RES, T * RES), g = c.getContext('2d'), e = canvas(T * RES, T * RES), ge = e.getContext('2d');
    g.scale(RES, RES); ge.scale(RES, RES);
    const glass = o.glass || '#2b3036', r = rng(key.length * 31 + 5 + (o.seed || 0));
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    if (o.stripes) { // Wallachian banding: courses of red brick between white plaster bands (Curtea Veche church)
        const P = o.stripes.period || 32;
        for (let y = 0; y < T; y += P) { g.fillStyle = o.stripes.brick; g.fillRect(0, y, T, P * 0.45); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let q = y + 4; q < y + P * 0.45; q += 5) g.fillRect(0, q, T, 1); for (let q = 0; q < T; q += 11) g.fillRect(q + ((y / P) % 2) * 5, y, 1, P * 0.45); g.fillStyle = o.stripes.band; g.fillRect(0, y + P * 0.45, T, P * 0.55); }
    }
    const shade = (a) => `rgba(60,50,35,${a})`, light = (a) => `rgba(255,255,250,${a})`;
    const archWin = (x, y, w, h, gl = glass, frame = true) => { // x,y = top-left of the rect part; arch on top
        g.fillStyle = shade(0.28); g.beginPath(); g.moveTo(x - 3, y + h + 3); g.lineTo(x - 3, y); g.arc(x + w / 2, y, w / 2 + 3, Math.PI, 0); g.lineTo(x + w + 3, y + h + 3); g.closePath(); g.fill();
        g.fillStyle = gl; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.arc(x + w / 2, y, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill();
        if (frame) { g.fillStyle = light(0.55); g.fillRect(x + w / 2 - 1, y - w / 2, 2, h + w / 2); g.fillRect(x, y + h * 0.15, w, 2); g.fillStyle = light(0.12); g.fillRect(x + 2, y + 2, w * 0.3, h * 0.5); }
        g.fillStyle = light(0.6); g.fillRect(x + w / 2 - 3, y - w / 2 - 7, 6, 7); // keystone
    };
    const rectWin = (x, y, w, h, gl = glass) => {
        g.fillStyle = light(0.5); g.fillRect(x - 5, y - 5, w + 10, h + 9);
        g.fillStyle = shade(0.3); g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = gl; g.fillRect(x, y, w, h);
        g.fillStyle = light(0.55); g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + h * 0.3, w, 2);
        g.fillStyle = light(0.12); g.fillRect(x + 2, y + 2, w * 0.3, h * 0.45);
        g.fillStyle = shade(0.3); g.fillRect(x - 6, y + h + 4, w + 12, 3); g.fillStyle = light(0.6); g.fillRect(x - 6, y + h + 1, w + 12, 3); // sill
    };
    const lit = (x, y, w, h) => { if (r() < (o.lit ?? 0.3)) { ge.fillStyle = r() < 0.8 ? `rgb(255,${200 + r() * 30},${130 + r() * 40})` : 'rgb(200,220,255)'; ge.fillRect(x, y, w, h); } };
    rows.forEach((R, ri) => {
        const y0 = T - (ri + 1) * C; // band top in canvas px
        for (let fx = 0; fx < 4; fx++) {
            const x0 = fx * C, w = (R.w ?? 0.4) * C, cx = x0 + C / 2;
            if (R.rustic) { g.fillStyle = shade(0.1); for (let q = y0 + 10; q < y0 + C; q += 11) g.fillRect(x0, q, C, 1.5); for (let q = 0; q < C; q += 32) g.fillRect(x0 + q + ((Math.floor((y0) / 11) % 2) * 16), y0, 1, C); }
            if (R.pil) { // pilasters at the bay edges (pairs if 'pair')
                const pw = R.pil === 'pair' ? 7 : 10;
                for (const px of R.pil === 'pair' ? [x0 + 2, x0 + 12, x0 + C - 2 - pw, x0 + C - 12 - pw] : [x0, x0 + C - pw]) { g.fillStyle = light(0.5); g.fillRect(px, y0 + 6, pw, C - 8); g.fillStyle = shade(0.16); g.fillRect(px + pw - 2, y0 + 6, 2, C - 8); g.fillStyle = light(0.65); g.fillRect(px - 2, y0 + 4, pw + 4, 4); }
            }
            const top = y0 + (R.top ?? 0.24) * C, bot = y0 + (1 - (R.bottom ?? 0.12)) * C, h = bot - top;
            switch (R.t) {
                case 'arcade': { const aw = (R.w ?? 0.62) * C; archWin(cx - aw / 2, y0 + 0.08 * C + aw / 2, aw, C * 0.9 - aw / 2, '#2a2826', false); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - aw / 2, y0 + C * 0.55, aw, C * 0.43); lit(cx - aw / 2, y0 + C * 0.4, aw, C * 0.58); break; }
                case 'portal': { const aw = (R.w ?? 0.5) * C; archWin(cx - aw / 2, y0 + 0.12 * C + aw / 2, aw, C * 0.86 - aw / 2, '#3a2e24'); lit(cx - aw / 2, y0 + 0.4 * C, aw, C * 0.5); break; }
                case 'arch': archWin(cx - w / 2, top + w / 2, w, h - w / 2); lit(cx - w / 2, top, w, h); break;
                case 'arch2': { const h1 = h * 0.58; rectWin(cx - w / 2, bot - h1, w, h1); archWin(cx - w * 0.35, top + w * 0.35, w * 0.7, h - h1 - w * 0.35 - 10); lit(cx - w / 2, bot - h1, w, h1); break; }
                case 'rect': rectWin(cx - w / 2, top, w, h); g.fillStyle = light(0.6); g.fillRect(cx - w / 2 - 8, top - 12, w + 16, 5); g.fillStyle = shade(0.25); g.fillRect(cx - w / 2 - 8, top - 7, w + 16, 2); lit(cx - w / 2, top, w, h); break;
                case 'pediment': rectWin(cx - w / 2, top, w, h); g.fillStyle = light(0.65); g.beginPath(); g.moveTo(cx - w / 2 - 10, top - 7); g.lineTo(cx, top - 22); g.lineTo(cx + w / 2 + 10, top - 7); g.closePath(); g.fill(); g.fillStyle = shade(0.28); g.fillRect(cx - w / 2 - 10, top - 7, w + 20, 2); lit(cx - w / 2, top, w, h); break;
                case 'small': rectWin(cx - w / 2, top, w, h * 0.7); lit(cx - w / 2, top, w, h * 0.7); break;
                case 'loggia': { g.fillStyle = '#3a3631'; g.fillRect(x0, top - 6, C, bot - top + 6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, top - 6, C, 10); for (const px of [x0 + 4, x0 + C / 2 - 5]) { g.fillStyle = light(0.95); g.fillRect(px, top - 6, 10, bot - top + 6); g.fillStyle = shade(0.2); g.fillRect(px + 7, top - 6, 3, bot - top + 6); } lit(x0 + 16, top, C / 2 - 24, h); break; }
                case 'columns': { g.fillStyle = '#4a443c'; g.fillRect(x0, y0 + 10, C, C - 14); for (const px of [x0 + 10, x0 + C / 2 + 4]) { g.fillStyle = light(0.95); g.fillRect(px, y0 + 10, 14, C - 14); g.fillStyle = shade(0.3); g.fillRect(px + 10, y0 + 10, 4, C - 14); for (let q = 0; q < 3; q++) { g.fillStyle = shade(0.12); g.fillRect(px + 3 + q * 4, y0 + 12, 1, C - 18); } } break; }
                case 'niches': { const n = R.n || 4, nw = C / n; for (let q = 0; q < n; q++) { const nx = x0 + q * nw + nw * 0.18, ww = nw * 0.64; g.fillStyle = shade(0.22); g.beginPath(); g.moveTo(nx, bot); g.lineTo(nx, top + ww / 2); g.arc(nx + ww / 2, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(nx + ww, bot); g.closePath(); g.fill(); g.fillStyle = light(0.5); g.fillRect(nx - 2, bot, ww + 4, 2); } break; }
                case 'blank': g.fillStyle = shade(0.07); g.fillRect(cx - C * 0.32, y0 + C * 0.22, C * 0.64, C * 0.56); g.fillStyle = light(0.4); g.fillRect(cx - C * 0.32, y0 + C * 0.22, C * 0.64, 3); break;
                default: break;
            }
            if (R.orn && R.t !== 'blank') { // stucco ornament over the window: shell cartouche + garland swags (eclectic fronts)
                const oy = top - (R.t === 'pediment' ? 30 : R.t === 'arch' || R.t === 'arch2' ? w * 0.5 + 16 : 18);
                g.fillStyle = light(0.7); g.beginPath(); g.ellipse(cx, oy, 7, 6, 0, 0, 7); g.fill(); g.fillStyle = shade(0.25); g.beginPath(); g.ellipse(cx, oy + 1.5, 7, 3, 0, 0, Math.PI); g.fill();
                g.strokeStyle = light(0.65); g.lineWidth = 2.2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 8, oy); g.quadraticCurveTo(cx + s * (w * 0.3 + 6), oy + 9, cx + s * (w * 0.5 + 6), oy - 1); g.stroke(); }
                g.strokeStyle = shade(0.18); g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 8, oy + 2); g.quadraticCurveTo(cx + s * (w * 0.3 + 6), oy + 11, cx + s * (w * 0.5 + 6), oy + 1); g.stroke(); }
            }
            if (R.rail) { g.fillStyle = 'rgba(28,28,28,0.9)'; const ry = bot - 14; g.fillRect(cx - w / 2 - 6, ry, w + 12, 2); for (let q = cx - w / 2 - 5; q < cx + w / 2 + 6; q += 4) g.fillRect(q, ry, 1.2, 14); }
            if (R.balus) { const by = y0 + C - 22; g.fillStyle = light(0.85); g.fillRect(x0, by, C, 4); g.fillRect(x0, y0 + C - 4, C, 4); for (let q = x0 + 3; q < x0 + C; q += 8) { g.fillStyle = light(0.85); g.fillRect(q, by + 4, 4, 14); g.fillStyle = shade(0.25); g.fillRect(q + 3, by + 4, 1, 14); } }
        }
        if (R.cornice !== false) { g.fillStyle = light(0.7); g.fillRect(0, y0, T, 5); g.fillStyle = shade(0.3); g.fillRect(0, y0 + 5, T, 3); g.fillStyle = shade(0.1); g.fillRect(0, y0 + 8, T, 3); }
        if (R.dentils) { for (let q = 0; q < T; q += 6) { g.fillStyle = shade(0.22); g.fillRect(q, y0 + 11, 3, 4); } }
    });
    if (o.decay) { // peeling plaster, exposed brick, rain streaks under sills (the unrestored Lipscani fronts)
        const k = o.decay === true ? 1 : o.decay;
        for (let i = 0; i < 26 * k; i++) { const x = r() * T, y = r() * T, rw = 6 + r() * 26, rh = 4 + r() * 16; g.fillStyle = r() < 0.5 ? 'rgba(255,255,248,0.22)' : 'rgba(90,80,64,0.16)'; g.beginPath(); g.ellipse(x, y, rw, rh, r() * 3, 0, 7); g.fill(); if (r() < 0.45) { g.fillStyle = 'rgba(150,82,58,0.55)'; g.beginPath(); g.ellipse(x + r() * 4, y + r() * 3, rw * 0.35, rh * 0.35, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(70,40,30,0.25)'; for (let q = 0; q < 3; q++) g.fillRect(x - rw * 0.3, y - rh * 0.2 + q * 3, rw * 0.6, 1); } }
        for (let i = 0; i < 40 * k; i++) { const x = r() * T, y = r() * T, L = 10 + r() * 50; const gr = g.createLinearGradient(0, y, 0, y + L); gr.addColorStop(0, 'rgba(60,55,45,0.18)'); gr.addColorStop(1, 'rgba(60,55,45,0)'); g.fillStyle = gr; g.fillRect(x, y, 1.5 + r() * 3, L); }
    }
    const map = canvasTexture(c, { repeat: true }), em = canvasTexture(e, { repeat: true });
    const flood = !!o.flood;
    const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.82, emissive: new THREE.Color(o.flood || '#ffffff'), emissiveMap: flood ? map : em, emissiveIntensity: 0 });
    m.name = 'facade-' + key; m.userData.shared = true;
    if (flood) { const k = o.floodK ?? 0.55; m.userData.dayGlow = 0; m.userData.nightGlow = k; m.userData.nightEmissive = k; m.userData.floodlit = true; } else m.userData.nightWindows = true;
    const S = { bay: o.bay || 4, floor: o.floor || 4 };
    const res = { mat: m, S, key: 'f-' + key };
    FAC.set(key, res);
    return res;
}
/** walls with a classic façade into a GeoBatch (material key = fac.key; pass { [fac.key]: fac.mat } as matOverrides at build) */
export function classicWalls(b, fac, poly, y0, y1, colour = '#e4dccb', vBase = y0) {
    b.add(wallGeometry(poly, y0, y1, fac.S, vBase, colour), fac.key, null, colour);
}

// ---------------------------------------------------------------------------- old-town shopfronts (ground floors)
/**
 * Ground-floor shopfronts of the 19th-c. commercial streets (Lipscani & co.): a canvas tile of 4 bays × 4 rows; each ROW is a
 * shopfront type, so a building picks its type with vBase = yBase − row · floor (wallGeometry v). Row 0 timber shopfronts
 * (painted wooden frames, stall risers, transoms, a door), row 1 round-arched openings between rusticated piers, row 2 modern
 * café glazing in black steel, row 3 closed fronts (barred windows, double timber door). A plain fascia band runs along the top
 * of every row (shop signs are placed there, see oldTownTerraces). Plaster is white (tinted by the vertex colour); displays
 * are warm interiors (albedo ≈ 0.1–0.2), lit at night. Use with { bay: 3.4, floor: GF } (S of the result).
 */
export function shopfrontFacade(key = 'ot-shop', { res = 2, bay = 3.4, floor = 4.4 } = {}) {
    if (FAC.has(key)) return FAC.get(key);
    const T = 512, C = T / 4, c = canvas(T * res, T * res), g = c.getContext('2d'), e = canvas(T * res, T * res), ge = e.getContext('2d'), r = rng(77);
    g.scale(res, res); ge.scale(res, res);
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    const WOOD = ['#3b2a1e', '#23392e', '#5a1e22', '#1f2a3a', '#4a3a2a', '#2b2b2b', '#6b4a2e', '#30402f'];
    const interior = (x, y, w, h, lit = 0.85) => { // display / café interior seen through the glass
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#5d5448'); gr.addColorStop(0.55, '#3e3329'); gr.addColorStop(1, '#2a221c'); g.fillStyle = gr; g.fillRect(x, y, w, h);
        for (let q = 0; q < 2; q++) { const yy = y + h * (0.45 + q * 0.25); g.fillStyle = 'rgba(190,160,120,0.25)'; g.fillRect(x + 4, yy, w - 8, 1); for (let k = x + 5; k < x + w - 5; k += 4 + r() * 7) { if (r() < 0.4) continue; g.fillStyle = `hsla(${r() * 360},${15 + r() * 25}%,${30 + r() * 25}%,0.55)`; g.fillRect(k, yy - 2 - r() * 3, 1.5, 2 + r() * 3); } }
        for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(25,20,16,0.45)'; const px = x + w * (0.25 + k * 0.45); g.beginPath(); g.ellipse(px, y + h * 0.82, 4, 7, 0, 0, 7); g.fill(); g.beginPath(); g.arc(px, y + h * 0.68, 2.6, 0, 7); g.fill(); } // people inside
        const rf = g.createLinearGradient(0, y, 0, y + h); rf.addColorStop(0, 'rgba(170,185,195,0.42)'); rf.addColorStop(0.45, 'rgba(150,165,175,0.12)'); rf.addColorStop(1, 'rgba(120,130,140,0.05)'); g.fillStyle = rf; g.fillRect(x, y, w, h); // sky reflection
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x + w * 0.15, y); g.lineTo(x + w * 0.35, y); g.lineTo(x + w * 0.1, y + h); g.lineTo(x - w * 0.1, y + h); g.closePath(); g.fill();
        if (r() < lit) { const ge2 = ge.createLinearGradient(0, y, 0, y + h); ge2.addColorStop(0, 'rgb(255,214,150)'); ge2.addColorStop(1, 'rgb(150,100,60)'); ge.fillStyle = ge2; ge.fillRect(x, y, w, h); }
    };
    const fascia = (x0, y0, col) => { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x0, y0 + 2, C, C * 0.2); g.fillStyle = col; g.fillRect(x0 + 6, y0 + C * 0.04, C - 12, C * 0.14); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0 + 6, y0 + C * 0.04, C - 12, 1.5); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0 + 6, y0 + C * 0.18 - 1.5, C - 12, 1.5); };
    for (let row = 0; row < 4; row++) {
        const y0 = T - (row + 1) * C;
        g.fillStyle = 'rgba(80,70,55,0.25)'; g.fillRect(0, y0, T, 3); // cornice line under the first floor
        for (let col = 0; col < 4; col++) {
            const x0 = col * C, wood = WOOD[(row * 4 + col * 3) % WOOD.length], top = y0 + C * 0.22, bot = y0 + C;
            if (row === 0) { // timber shopfront: piers, frame, stall riser, transom, door in column 1
                fascia(x0, y0, wood);
                g.fillStyle = wood; g.fillRect(x0 + 10, top, C - 20, bot - top);
                if (col === 1) { interior(x0 + 34, top + 18, C - 68, bot - top - 22, 0.9); g.fillStyle = wood; g.fillRect(x0 + 34, top + C * 0.45, C - 68, 2.5); g.fillStyle = '#c9a24e'; g.fillRect(x0 + C - 44, top + C * 0.5, 2, 6); interior(x0 + 14, top + 6, 16, C * 0.5); interior(x0 + C - 30, top + 6, 16, C * 0.5); }
                else { interior(x0 + 15, top + 16, C - 30, (bot - top) * 0.62); g.fillStyle = wood; for (const k of [0.33, 0.66]) g.fillRect(x0 + 15 + (C - 30) * k - 1, top + 16, 2.5, (bot - top) * 0.62); interior(x0 + 15, top + 4, C - 30, 9); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 15, bot - (bot - top) * 0.2, C - 30, 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + 18, bot - (bot - top) * 0.17, C - 36, (bot - top) * 0.13); }
                g.fillStyle = 'rgba(255,250,240,0.6)'; g.fillRect(x0 + 2, top - 4, 8, bot - top + 4); g.fillRect(x0 + C - 10, top - 4, 8, bot - top + 4);
            } else if (row === 1) { // round-arched openings between rusticated piers
                g.fillStyle = 'rgba(80,70,55,0.14)'; for (let q = y0 + 8; q < bot; q += 10) g.fillRect(x0, q, C, 1.5);
                const aw = C * 0.7, ax = x0 + (C - aw) / 2, ay = y0 + C * 0.22 + aw / 2;
                g.fillStyle = 'rgba(70,60,45,0.35)'; g.beginPath(); g.moveTo(ax - 4, bot); g.lineTo(ax - 4, ay); g.arc(ax + aw / 2, ay, aw / 2 + 4, Math.PI, 0); g.lineTo(ax + aw + 4, bot); g.fill();
                g.save(); g.beginPath(); g.moveTo(ax, bot); g.lineTo(ax, ay); g.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); g.lineTo(ax + aw, bot); g.closePath(); g.clip(); interior(ax, ay - aw / 2, aw, bot - ay + aw / 2, 0.9); g.restore();
                g.strokeStyle = wood; g.lineWidth = 3; g.beginPath(); g.arc(ax + aw / 2, ay, aw / 2 - 1, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + aw, ay); g.stroke();
                for (let k = 1; k < 4; k++) { const a = Math.PI + k * Math.PI / 4; g.beginPath(); g.moveTo(ax + aw / 2, ay); g.lineTo(ax + aw / 2 + Math.cos(a) * aw / 2, ay + Math.sin(a) * aw / 2); g.stroke(); }
                g.fillStyle = wood; g.fillRect(ax + aw / 2 - 1.5, ay, 3, bot - ay); if (col % 2) g.fillRect(ax, bot - 18, aw, 18);
                g.fillStyle = '#efe9dc'; g.fillRect(ax + aw / 2 - 5, ay - aw / 2 - 9, 10, 10); // keystone
            } else if (row === 2) { // modern café glazing in black steel (restored ground floors)
                fascia(x0, y0, ['#111214', '#1d2a24', '#3b2a1e', '#5a1e22'][col]);
                g.fillStyle = '#18191b'; g.fillRect(x0 + 6, top, C - 12, bot - top);
                interior(x0 + 9, top + 3, C - 18, bot - top - 3, 0.95);
                g.fillStyle = '#18191b'; g.fillRect(x0 + C / 2 - 1, top, 2, bot - top); g.fillRect(x0 + 9, top + (bot - top) * 0.2, C - 18, 2);
                for (let k = 0; k < 3; k++) { const tx = x0 + 18 + k * 34; g.fillStyle = 'rgba(20,16,12,0.7)'; g.fillRect(tx, bot - 26, 14, 2); g.fillRect(tx + 6, bot - 26, 2, 26); }
            } else { // closed fronts: rendered plinth, barred windows, a double timber door in column 3, a roll shutter in column 0
                g.fillStyle = 'rgba(80,70,55,0.14)'; for (let q = y0 + 8; q < bot; q += 10) g.fillRect(x0, q, C, 1.5);
                if (col === 3) { g.fillStyle = 'rgba(70,60,45,0.35)'; g.fillRect(x0 + 30, top - 4, C - 60, bot - top + 4); g.fillStyle = wood; g.fillRect(x0 + 34, top, C - 68, bot - top); g.fillStyle = 'rgba(255,255,255,0.12)'; for (const k of [0.25, 0.75]) { g.fillRect(x0 + 34 + (C - 68) * k - 10, top + 8, 20, 30); g.fillRect(x0 + 34 + (C - 68) * k - 10, top + 46, 20, 40); } g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x0 + C / 2 - 1, top, 2, bot - top); }
                else if (col === 0) { g.fillStyle = '#8d8f8c'; g.fillRect(x0 + 14, top, C - 28, bot - top); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let q = top; q < bot; q += 4) g.fillRect(x0 + 14, q, C - 28, 1.2); g.fillStyle = 'rgba(40,40,60,0.35)'; g.fillRect(x0 + 30, top + 20, 40, 18); /* tag graffiti */ }
                else { const wx = x0 + 32, wy = top + 14, ww = C - 64, wh = (bot - top) * 0.5; g.fillStyle = 'rgba(255,255,250,0.5)'; g.fillRect(wx - 5, wy - 5, ww + 10, wh + 10); interior(wx, wy, ww, wh, 0.5); g.fillStyle = '#1b1c1d'; for (let k = wx + 4; k < wx + ww; k += 7) g.fillRect(k, wy, 1.6, wh); g.fillRect(wx, wy + wh * 0.5, ww, 1.6); }
            }
        }
    }
    const map = canvasTexture(c, { repeat: true }), em = canvasTexture(e, { repeat: true });
    const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: em, emissiveIntensity: 0.06 });
    m.name = 'facade-' + key; m.userData.shared = true; m.userData.nightWindows = true; m.userData.dayWindows = 0.06;
    const res2 = { mat: m, S: { bay, floor }, key: 'f-' + key };
    FAC.set(key, res2);
    return res2;
}

// ---------------------------------------------------------------------------- balustrades (alpha-tested, see-through)
let BAL = null;
export function balustradeMaterial() {
    if (BAL) return BAL;
    const W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f2ede2'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 9, W, 9); // rail + plinth
    for (let i = 0; i < 8; i++) { // vase-shaped balusters
        const cx = (i + 0.5) * W / 8; g.beginPath(); g.moveTo(cx - 6, H - 9); g.bezierCurveTo(cx - 13, H - 24, cx - 3, H - 34, cx - 4, H - 44); g.lineTo(cx - 6, 10); g.lineTo(cx + 6, 10); g.lineTo(cx + 4, H - 44); g.bezierCurveTo(cx + 3, H - 34, cx + 13, H - 24, cx + 6, H - 9); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 8, W, 2);
    const t = canvasTexture(c, { repeat: true });
    BAL = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, vertexColors: true, emissive: new THREE.Color('#ffe2b0'), emissiveMap: t, emissiveIntensity: 0 });
    BAL.name = 'balustrade'; BAL.userData.shared = true; BAL.userData.dayGlow = 0; BAL.userData.nightGlow = 0.35;
    return BAL;
}
/** balustrade strip along a polyline (closed: back to the start) at height y (number or fn(x,z)), h metres tall */
export function balustrade(b, pts, y, h = 1.05, { closed = false, colour = '#ffffff', unit = 2.4 } = {}) {
    const P = closed ? [...pts, pts[0]] : pts, pos = [], uv = [], idx = []; let u = 0;
    const Y = typeof y === 'function' ? y : () => y;
    for (let i = 1; i < P.length; i++) {
        const [ax, az] = P[i - 1], [bx, bz] = P[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const k = pos.length / 3, ya = Y(ax, az), yb = Y(bx, bz);
        pos.push(ax, ya, az, bx, yb, bz, bx, yb + h, bz, ax, ya + h, az);
        uv.push(u / unit, 0, (u + L) / unit, 0, (u + L) / unit, 1, u / unit, 1); u += L;
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    b.add(g, 'balustrade', null, colour); g.dispose();
}

// ---------------------------------------------------------------------------- flags
const FLAGS = {};
function flagTexture(kind) {
    if (FLAGS[kind]) return FLAGS[kind];
    const c = canvas(192, 128), g = c.getContext('2d');
    if (kind === 'ro') { ['#002b7f', '#fcd116', '#ce1126'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 64, 0, 64, 128); }); }
    else if (kind === 'eu') { g.fillStyle = '#003399'; g.fillRect(0, 0, 192, 128); g.fillStyle = '#ffcc00'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; star(g, 96 + Math.cos(a) * 38, 64 + Math.sin(a) * 38, 6); } }
    else if (kind === 'nato') { g.fillStyle = '#004990'; g.fillRect(0, 0, 192, 128); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(96, 64, 26, 0, 7); g.stroke(); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(96, 64); g.lineTo(96 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.lineTo(96 + Math.cos(a + 0.35) * 12, 64 + Math.sin(a + 0.35) * 12); g.closePath(); g.fill(); } }
    else { g.fillStyle = '#fff'; g.fillRect(0, 0, 192, 128); }
    return (FLAGS[kind] = canvasTexture(c));
}
function star(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
/**
 * flagpole with a waving flag; returns { group, update(t, windKmh) }. kind: 'ro' | 'eu' | 'nato'. yaw: wind direction (radians)
 */
export function flagpole(x, y, z, h, kind = 'ro', { w = null, yaw = 0, pole = '#d9dcdf' } = {}) {
    const grp = new THREE.Group(); grp.name = 'flag:' + kind;
    const pm = new THREE.MeshStandardMaterial({ color: pole, metalness: 0.7, roughness: 0.35 });
    const pg = new THREE.CylinderGeometry(0.05 + h * 0.002, 0.09 + h * 0.004, h, 8); pg.translate(0, h / 2, 0);
    const p = new THREE.Mesh(pg, pm); p.castShadow = true; grp.add(p);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12 + h * 0.003, 8, 6), new THREE.MeshStandardMaterial({ color: '#d8b44a', metalness: 0.9, roughness: 0.3 })); ball.position.y = h + 0.1; grp.add(ball);
    const fw = w || Math.max(1.2, h * 0.16), fh = fw * 2 / 3;
    const fg = new THREE.PlaneGeometry(fw, fh, 10, 2); fg.translate(fw / 2, 0, 0);
    const base = fg.attributes.position.array.slice();
    const fm = new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 0.85 });
    const f = new THREE.Mesh(fg, fm); f.position.y = h - fh / 2 - 0.15; f.castShadow = true;
    const holder = new THREE.Group(); holder.rotation.y = yaw; holder.add(f); grp.add(holder);
    grp.position.set(x, y, z);
    const ph = hash2(x, z) * 6;
    return {
        group: grp,
        update(t, wind = 12) {
            const P = fg.attributes.position.array, k = Math.min(1, wind / 25) * 0.9 + 0.1;
            for (let i = 0; i < P.length; i += 3) { const u = base[i] / fw; P[i + 2] = Math.sin(base[i] * 2.2 - t * (3 + k * 4) + ph) * 0.18 * u * fw * 0.25 * k; P[i + 1] = base[i + 1] - u * (1 - k) * fh * 0.35; P[i] = base[i] * (0.75 + 0.25 * k); }
            fg.attributes.position.needsUpdate = true; fg.computeVertexNormals();
        },
    };
}

// ---------------------------------------------------------------------------- landmark models (landmarks.js, read-only)
/**
 * place a landmarks.js model at its own lat/lon (1:1); y = base height. Adds colliders (oriented boxes) to ctx.
 * @returns {{ mesh, x, z }} or null
 */
export function placeLandmark(ctx, id, { y = null, collide = true, colliderH = 60 } = {}) {
    const lm = LANDMARKS.find((l) => l.id === id); if (!lm) return null;
    const r = buildLandmark(lm, { THREE, realScale: true }); if (!r) return null;
    const p = ctx.ll(lm.lat, lm.lon), yy = y ?? ctx.ground.heightAt(p.x, p.z);
    r.mesh.position.set(p.x, yy, p.z); ctx.add(r.mesh);
    r.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (collide) for (const c of r.collision) ctx.collider(translatedLandmarkCollider(c, p, yy, colliderH, id));
    return { mesh: r.mesh, x: p.x, z: p.z, y: yy, lm, tris: r.triangles };
}

// ---------------------------------------------------------------------------- small helpers
/** polygon of an OSM building / area by id (data) */
export const osmPoly = (d, id) => (d.buildings.find((b) => b.id === id) || d.areas.find((a) => a.id === id))?.poly || null;
let PAL = null;
function palisadeMaterial() {
    if (PAL) return PAL;
    const W = 128, H = 128, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H); g.fillStyle = '#1d2321';
    g.fillRect(0, 6, W, 4); g.fillRect(0, H - 14, W, 4); // rails
    for (let i = 0; i < 8; i++) { const x = i * 16 + 7; g.fillRect(x, 0, 3, H); g.beginPath(); g.moveTo(x - 3, 2); g.lineTo(x + 1.5, -6); g.lineTo(x + 6, 2); g.fill(); } // bars + spear tips
    const t = canvasTexture(c, { repeat: true });
    PAL = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5, vertexColors: true });
    PAL.name = 'palisade'; PAL.userData.shared = true;
    return PAL;
}
/** iron palisade (alpha-tested bars + posts every `post` m, optional stone plinth) along a polyline; collides as wall segments.
 *  Add { palisade: palisadeMat() } to the batch's matOverrides (or use the returned matOverrides). */
export function palisade(ctx, b, pts, { h = 2.2, colour = '#ffffff', post = 3, y = null, plinth = 0, plinthCol = '#cfc6b4', postCol = '#1d2321', collide = true } = {}) {
    const g = ctx.ground, Y = (x, z) => (y ?? g.heightAt(x, z));
    const pos = [], uv = [], idx = []; let u = 0;
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
        const ya = Y(ax, az) + plinth, yb = Y(bx, bz) + plinth, k = pos.length / 3;
        pos.push(ax, ya, az, bx, yb, bz, bx, yb + h, bz, ax, ya + h, az); uv.push(u / 2, 0, (u + L) / 2, 0, (u + L) / 2, 1, u / 2, 1); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); u += L;
        const n = Math.max(1, Math.round(L / post));
        for (let q = i > 1 ? 1 : 0; q <= n; q++) { const t = q / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, yy = Y(x, z) + plinth; b.box(x, yy, z, 0.14, h + 0.12, 0.14, postCol, 'metal'); b.sphere(x, yy + h + 0.18, z, 0.08, 0.1, 0.08, '#a8893a', 'bronze', 6, 4); }
        if (plinth > 0) { const cx = (ax + bx) / 2, cz = (az + bz) / 2; b.box(cx, Math.min(ya, yb) - plinth - 0.3 - (i % 2) * 0.03, cz, 0.45 + (i % 2) * 0.04, plinth + 0.3 + Math.abs(ya - yb) + (i % 2) * 0.03, L + 0.3, plinthCol, 'stone', Math.atan2(bx - ax, bz - az)); } // alternate segments differ by 2–4 cm: no coplanar overlap at the joins
        if (collide) ctx.collider({ wall: true, ax, az, bx, bz, y0a: ya - plinth - 1, y1a: ya + h, y0b: yb - plinth - 1, y1b: yb + h, x: (ax + bx) / 2, z: (az + bz) / 2, r: L / 2 + 0.5 });
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    b.add(geo, 'palisade', null, colour); geo.dispose();
    return { palisade: palisadeMaterial() };
}
export const palisadeMat = () => palisadeMaterial();
/** low hedge along a polyline (box segments, green, collides) */
export function hedge(ctx, b, pts, { h = 1.1, w = 0.9, colour = '#3f5f2f' } = {}) {
    const g = ctx.ground;
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2, a = Math.atan2(bx - ax, bz - az);
        b.box(cx, g.heightAt(cx, cz) - 0.05, cz, w, h, L + 0.2, colour, 'plant', a);
        ctx.box(cx, cz, w / 2, L / 2 + 0.1, a, { prop: true, h });
    }
}
export { polyCollider, polyArea, centroid, inPoly, polyBox, offsetPolyline, polylineLength, alongPolyline, M, fitDraw };

// ---------------------------------------------------------------------------- city filler beyond the OSM extract
import { facadeMaterial, facadeStyle } from './osm.js';
/**
 * low-cost city blocks in a ring around the OSM coverage (so the horizon reads as Bucharest, not grass):
 * jittered grid of 4–14-storey blocks with façade textures, none inside `avoid` polygons or near the data.
 * o: { ring = 650, spacing = 46, avoid = [], seed, tall = 0.25 }
 */
export function cityFiller(ctx, o = {}) {
    const d = ctx.data, r = rng(o.seed || 77), b = new GeoBatch(), mats = {};
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const bd of d.buildings) for (const [x, z] of bd.poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const ring = o.ring ?? 650, sp = o.spacing ?? 46, avoid = o.avoid || [];
    const cols = { bloc: ['#d9d3c5', '#cfc8b8', '#e2dccd', '#bdb7aa', '#d8cdb5', '#c7cdc9'], eclectic: ['#e4dccb', '#dccfb4', '#d9c3a5', '#e6d3c3', '#cfc7b8'], office: ['#8fa3b6', '#6c7f92', '#a6b4c0'] };
    for (let gx = x0 - ring; gx < x1 + ring; gx += sp) for (let gz = z0 - ring; gz < z1 + ring; gz += sp) {
        if (gx > x0 - 30 && gx < x1 + 30 && gz > z0 - 30 && gz < z1 + 30) continue;
        if (r() < 0.22) continue; // streets, squares, parks
        const cx = gx + (r() - 0.5) * sp * 0.4, cz = gz + (r() - 0.5) * sp * 0.4;
        if (avoid.some((p) => inPoly(cx, cz, p))) continue;
        const dist = Math.max(x0 - cx, cx - x1, z0 - cz, cz - z1);
        const style = r() < (o.tall ?? 0.25) * (dist > 250 ? 1.4 : 0.8) ? 'bloc' : r() < 0.85 ? 'eclectic' : 'office';
        const lv = style === 'bloc' ? 8 + Math.floor(r() * 3) * (r() < 0.3 ? 1.5 : 1) : style === 'office' ? 10 + Math.floor(r() * 12) : 3 + Math.floor(r() * 4);
        const h = lv * (style === 'bloc' ? 2.75 : style === 'office' ? 3.6 : 3.8), w = style === 'bloc' ? 36 + r() * 30 : 14 + r() * 22, dd = style === 'bloc' ? 11 + r() * 3 : 12 + r() * 14;
        const a = (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.25, c = Math.cos(a), s = Math.sin(a);
        const poly = [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]].map(([u, v]) => [cx + u * c - v * s, cz + u * s + v * c]);
        const y0 = ctx.ground.heightAt(cx, cz) - 0.5, col = r.pick(cols[style]);
        b.add(wallGeometry(poly, y0, y0 + h, facadeStyle(style), y0, col), 'f-' + style, null, col); mats['f-' + style] = facadeMaterial(style);
        b.flat(poly, y0 + h, '#8a8580', 'roofs');
    }
    const g = b.build('city-filler', { castShadow: false, matOverrides: mats }); ctx.add(g);
    return g;
}

// ---------------------------------------------------------------------------- shop signs (one atlas = one draw call)
/**
 * signs: [{ x, y, z, yaw, w, h, text, bg?, fg?, font?, sub? }] → one mesh (canvas atlas, 2 columns × N rows); lit at night.
 * yaw: the sign faces +z rotated by yaw (same as plaques).
 */
export function signAtlas(signs, { name = 'signs', night = 0.9 } = {}) {
    const n = signs.length; if (!n) return null;
    const CW = 1024, RH = 96, cols = 2, rows = Math.ceil(n / cols), H = Math.min(4096, 2 ** Math.ceil(Math.log2(rows * RH)));
    const rh = Math.min(RH, Math.floor(H / rows)), c = canvas(CW * cols, H), g = c.getContext('2d');
    const pos = [], uv = [], idx = [], nor = [];
    signs.forEach((s, i) => {
        const cx = (i % cols) * CW, cy = Math.floor(i / cols) * rh, cw = Math.min(CW, Math.round(rh * s.w / s.h));
        g.fillStyle = s.bg || '#1d2a24'; g.fillRect(cx, cy, cw, rh);
        if (s.border !== false) { g.strokeStyle = s.border || 'rgba(220,200,150,0.8)'; g.lineWidth = 3; g.strokeRect(cx + 4, cy + 4, cw - 8, rh - 8); }
        fitDraw(g, s.text, cx + rh * 0.18, cy + rh * (s.sub ? 0.08 : 0.14), cw - rh * 0.36, rh * (s.sub ? 0.56 : 0.72), { font: s.font || ((q) => `700 ${q}px Georgia, serif`), color: s.fg || '#f1e6c8' });
        if (s.sub) fitDraw(g, s.sub, cx + rh * 0.2, cy + rh * 0.64, cw - rh * 0.4, rh * 0.26, { font: (q) => `500 ${q}px Helvetica, Arial, sans-serif`, color: s.fg || '#f1e6c8' });
        const u0 = cx / (CW * cols), u1 = (cx + cw) / (CW * cols), v1 = 1 - cy / H, v0 = 1 - (cy + rh) / H;
        const C = Math.cos(s.yaw), S = Math.sin(s.yaw), hw = s.w / 2, k = pos.length / 3;
        // plane facing +z rotated by yaw: right vector (cos, 0, -sin)
        for (const [u, v, a, bb] of [[-hw, -s.h / 2, u0, v0], [hw, -s.h / 2, u1, v0], [hw, s.h / 2, u1, v1], [-hw, s.h / 2, u0, v1]]) { pos.push(s.x + C * u, s.y + v, s.z - S * u); uv.push(a, bb); nor.push(S, 0, C); }
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const t = canvasTexture(c);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.05 });
    m.userData.dayGlow = 0.05; m.userData.nightGlow = night;
    const mesh = new THREE.Mesh(geo, m); mesh.name = name;
    return mesh;
}

// ---------------------------------------------------------------------------- old-town terraces (pergolas, awnings, tables)
/** façade point of the building containing (px, pz) toward the street point (qx, qz): { x, z, nx, nz } or null */
export function facadeToward(data, px, pz, qx, qz) {
    for (const b of data.buildings) {
        if (b.part || b.backdrop) continue; const bb = b._bb || (b._bb = polyBox(b.poly));
        if (px < bb.x0 || px > bb.x1 || pz < bb.z0 || pz > bb.z1 || !inPoly(px, pz, b.poly)) continue;
        let best = null; const p = b.poly;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], [bx, bz] = p[i], dx = qx - px, dz = qz - pz, ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t >= 0 && t <= 1.5 && u >= 0 && u <= 1 && (!best || t < best.t)) { const L = Math.hypot(ex, ez); best = { t, x: px + dx * t, z: pz + dz * t, ex: ex / L, ez: ez / L }; }
        }
        if (!best) return null;
        let nx = best.ez, nz = -best.ex; if ((qx - best.x) * nx + (qz - best.z) * nz < 0) { nx = -nx; nz = -nz; }
        return { x: best.x, z: best.z, nx, nz, b };
    }
    return null;
}
/**
 * terraces in front of bars / restaurants / cafés (POIs) along pedestrian streets: pergola posts, canvas awning, tables + chairs,
 * planters; a shop sign above the door. Returns { group, signs[], lamps[] } (signs → signAtlas, lamps → ctx.lampPoints).
 * o: { inside(x,z), streets: ways to consider, maxDepth, colours }
 */
export function oldTownTerraces(ctx, o = {}) {
    const d = ctx.data, b = new GeoBatch(), r = rng(o.seed || 21), out = { signs: [], lamps: [], terraces: [], seats: [] };
    const streets = o.streets || d.ways.filter((w) => ['pedestrian', 'living_street'].includes(w.k));
    const awn = o.colours || ['#e9e1c8', '#2f5a3a', '#7a2230', '#d9cfb3', '#3b4a5a', '#c9b48a', '#5a3a2a'];
    const placed = [], signPlaced = [];
    // A mapped venue is evidence for its name, not for a terrace. Reserve the
    // activity frontages first so a neighbouring venue cannot erase their sign.
    const priority = new Set(o.prioritySources || []);
    const pois = [...d.pois].sort((a, c) => Number(priority.has(c.id)) - Number(priority.has(a.id)));
    for (const p of pois) {
        const shop = !!p.shop, eat = ['restaurant', 'bar', 'cafe', 'pub', 'fast_food', 'ice_cream', 'biergarten'].includes(p.amenity);
        if (!(eat || shop) || !p.name) continue;
        if (o.inside && !o.inside(p.x, p.z)) continue;
        let best = null; for (const w of streets) { const q = distPolylineK(p.x, p.z, w.pts); if (!best || q.d < best.d) best = { ...q, w }; }
        if (!best || best.d > 28) continue;
        const f = facadeToward(d, p.x, p.z, best.cx, best.cz); if (!f) continue;
        const half = Math.hypot(best.cx - f.x, best.cz - f.z); if (half > 16) continue;
        const y = ctx.ground.heightAt(f.x, f.z), tx = -f.nz, tz = f.nx, yaw = Math.atan2(f.nx, f.nz);
        // sign above the door (on the façade)
        const signW = Math.min(5.5, 1.2 + p.name.length * 0.28);
        if (!signPlaced.some(q => Math.hypot(q.x - f.x, q.z - f.z) < (q.w + signW) / 2 + .2)) {
            out.signs.push({ source: p.id, x: f.x + f.nx * 0.12, y: y + 3.9, z: f.z + f.nz * 0.12, yaw, w: signW, h: 0.62, text: p.name, bg: r.pick(['#1d2a24', '#2a1d1a', '#1a2230', '#3b2a1e', '#0f0f10', '#5a1e22']), fg: r.pick(['#f1e6c8', '#e8c870', '#ffffff']) });
            signPlaced.push({ ...f, w: signW });
        }
        if (!eat || p.outdoor_seating !== 'yes' || half < 2.2) continue;
        if (placed.some((q) => Math.hypot(q.x - f.x, q.z - f.z) < 7)) continue;
        placed.push(f);
        const depth = Math.min(o.maxDepth ?? 3.4, half * 0.62), W = 5.5 + r() * 3, col = r.pick(awn), cx = f.x + f.nx * depth / 2, cz = f.z + f.nz * depth / 2;
        // pergola: 4 posts, beams, canvas roof sloping to the street, side valance
        const P = (u, v) => [f.x + tx * u + f.nx * v, f.z + tz * u + f.nz * v];
        for (const [u, v] of [[-W / 2, depth - 0.15], [W / 2, depth - 0.15], [-W / 2, 0.3], [W / 2, 0.3]]) { const [x, z] = P(u, v); b.box(x, y, z, 0.1, 2.75, 0.1, '#2b2724', 'metal'); }
        const [ax, az] = P(-W / 2, 0.15), [bx, bz] = P(W / 2, 0.15), [cx2, cz2] = P(W / 2, depth), [dx2, dz2] = P(-W / 2, depth);
        b.quad([dx2, y + 2.6, dz2], [cx2, y + 2.6, cz2], [bx, y + 3.05, bz], [ax, y + 3.05, az], col, 'fabric');
        b.quad([ax, y + 3.03, az], [bx, y + 3.03, bz], [cx2, y + 2.58, cz2], [dx2, y + 2.58, dz2], col, 'fabric'); // underside, 2 cm below (no coplanar faces)
        { const [vx, vz] = P(0, depth); b.box(vx, y + 2.3, vz, 0.03, 0.3, W, col, 'fabric', yaw + Math.PI / 2); }
        // furniture at real size (note 22): round bistro tables with two slatted chairs facing each other, a cushioned rattan
        // sofa along the façade on some terraces, bamboo planters at the ends, a patio heater, a menu A-board at the street end
        const nT = Math.max(1, Math.floor(W / 2.1)), chairCol = r.pick(['#3a2c22', '#6b4a32', '#22262a', '#8a6a48']), sofa = depth >= 2.8 && r() < 0.5;
        const chair = (qx, qz, fyaw) => { // fyaw: direction the sitter faces
            const fx = Math.sin(fyaw), fz = Math.cos(fyaw), sx = Math.cos(fyaw), sz = -Math.sin(fyaw);
            for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(qx + sx * a * 0.18 + fx * c * 0.18, y, qz + sz * a * 0.18 + fz * c * 0.18, 0.035, 0.44, 0.035, '#1e1f21', 'metal', fyaw);
            b.box(qx, y + 0.44, qz, 0.44, 0.05, 0.42, chairCol, 'wood', fyaw);
            const bx = qx - fx * 0.2, bz = qz - fz * 0.2;
            for (const a of [-1, 1]) b.box(bx + sx * a * 0.18, y + 0.44, bz + sz * a * 0.18, 0.035, 0.46, 0.035, '#1e1f21', 'metal', fyaw);
            for (const hh of [0.62, 0.78]) b.box(bx, y + hh, bz, 0.42, 0.08, 0.025, chairCol, 'wood', fyaw);
        };
        for (let i = 0; i < nT; i++) { const u = -W / 2 + (i + 0.5) * W / nT, [x, z] = P(u, depth * (sofa ? 0.62 : 0.55)); b.cyl(x, y, z, 0.22, 0.03, '#1e1f21', 'metal', 8); b.cyl(x, y, z, 0.03, 0.73, '#1e1f21', 'metal', 6); b.cyl(x, y + 0.73, z, 0.33, 0.035, r.pick(['#d8d2c4', '#6b4a32', '#2a2a2a', '#efe9dc']), 'wood', 12);
            for (const s of [-1, 1]) { const [qx, qz] = P(u + s * 0.55, depth * (sofa ? 0.62 : 0.55)); const fyaw = Math.atan2(-s * tx, -s * tz); chair(qx, qz, fyaw); out.seats.push({ x: qx - s * tx * 0.04, z: qz - s * tz * 0.04, y, yaw: fyaw }); } }
        if (sofa) { // rattan sofa with grey cushions against the pergola's façade side, facing the street
            const [sx0, sz0] = P(0, 0.62), cush = r.pick(['#8c8f93', '#d8d0c0', '#5a6a5a', '#7a2230']);
            b.box(sx0, y, sz0, W - 0.8, 0.42, 0.75, '#7a5a3a', 'wood', yaw + Math.PI / 2); b.box(sx0, y + 0.425, sz0, W - 0.9, 0.12, 0.7, cush, 'fabric', yaw + Math.PI / 2);
            const [bk, bkz] = P(0, 0.2); b.box(bk, y + 0.42, bkz, W - 0.8, 0.5, 0.14, '#7a5a3a', 'wood', yaw + Math.PI / 2); b.box(bk + f.nx * 0.18, y + 0.5, bkz + f.nz * 0.18, W - 1.0, 0.34, 0.12, cush, 'fabric', yaw + Math.PI / 2); // offsets keep every face ≥ 3 cm from its neighbours (audit z-fight)
            for (let u = -W / 2 + 0.9; u < W / 2 - 0.5; u += 1.2) { const [qx, qz] = P(u, 0.72); out.seats.push({ x: qx, z: qz, y, yaw }); }
        }
        for (const s of [-1, 1]) { const [x, z] = P(s * (W / 2 + 0.35), depth * 0.5); b.box(x, y, z, 0.5, 0.55, 0.5, '#3b3a36', 'concrete', yaw); for (let q = 0; q < 5; q++) { const ox = (r() - 0.5) * 0.3, oz = (r() - 0.5) * 0.3; b.cyl(x + ox, y + 0.55, z + oz, 0.015, 1.2 + r() * 0.6, '#7d8a4a', 'plant', 4); b.sphere(x + ox, y + 1.5 + r() * 0.4, z + oz, 0.18, 0.32, 0.18, '#4f7a3a', 'plant', 6, 4); } }
        if (r() < 0.6) { const [x, z] = P(W / 2 - 0.5, depth - 0.45); b.cyl(x, y, z, 0.22, 0.06, '#2b2d30', 'metal', 10); b.cyl(x, y, z, 0.05, 2.1, '#5c5f63', 'steel', 8); b.cyl(x, y + 2.05, z, 0.34, 0.1, '#5c5f63', 'steel', 12, 0.4); }
        { const [x, z] = P(-W / 2 - 0.2, depth + 0.35), a = yaw + Math.PI / 2; b.box(x, y, z, 0.55, 1.05, 0.06, '#1b1c1d', 'wood', a, 0.12); b.box(x, y, z, 0.55, 1.05, 0.06, '#1b1c1d', 'wood', a, -0.12); b.box(x + f.nx * 0.07, y + 0.25, z + f.nz * 0.07, 0.45, 0.6, 0.02, '#e9e4d6', 'paint', a + Math.PI / 2 * 0, 0.12); }
        // Local x follows the facade tangent; local z follows its outward normal.
        ctx.box(cx, cz, W / 2 + 0.6, depth / 2, yaw, { prop: true, h: 0.8 });
        out.lamps.push({ x: cx, z: cz, h: 2.6, noPost: true });
        out.terraces.push({ source: p.id, x: cx, z: cz, yaw, W, depth, name: p.name, f });
    }
    out.group = b.build('terraces');
    return out;
}
function distPolylineK(px, pz, pts) { let best = { d: 1e9 }; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const cx = ax + dx * t, cz = az + dz * t, d2 = Math.hypot(px - cx, pz - cz); if (d2 < best.d) best = { d: d2, cx, cz }; } return best; }
/** floodlit at night: clone the meshes' materials and give them a warm emissive driven by the session's night factor */
export function floodlight(root, colour = '#ffd9a0', k = 0.35) {
    root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const m = o.material.clone(); m.userData = { ...o.material.userData, shared: false, dayGlow: 0, nightGlow: k };
        if (m.emissive) { m.emissive = new THREE.Color(colour); m.emissiveIntensity = 0; if (m.map && !m.emissiveMap) m.emissiveMap = m.map; }
        o.material = m;
    });
}

// ---------------------------------------------------------------------------- activities (note 57; contract 01 *Activities*)
/** report a finished spot activity (achievements listen to `dmcv:activity`) and show its toast */
export function bucActivity(s, spot, id, title, body) {
    s._bucDone = s._bucDone || new Set(); s._bucDone.add(spot + ':' + id);
    try {
        if (typeof window.game?.emit === 'function') window.game.emit('activity', { spot, id });
        else window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot, id } }));
    } catch { /* no host */ }
    window.cvTelemetry?.track?.('spot_activity', { spot, id });
    if (title) s.ui.toast(title, body || '');
}
/**
 * Player-powered strokes along a validated water course. The camera rides the
 * animated boat/oars; no input means drag brings it to rest. Completion needs
 * the full course; cancelling restores the exact shore pose without an award.
 * path: [[x, z]…] (metres), y: water level, speed m/s. Returns { start(s), active() }.
 */
export function boatRide(ctx, boat, path, y, { speed = 1.6, eye = 0.72, title = 'Rowing boat', action = 'Row the oars', onDone = null, outfit = true, paddle = 'oars', help = null, floatHeight = .25, initialPitch = -.4 } = {}) {
    const L = polylineLength(path), flow = activityFlow(ctx); let ride = null;
    boat.userData.noFloor = true; boat.position.y = y + floatHeight;
    // The original hemisphere hull was one-sided: from the seated camera its
    // entire inner surface vanished. A narrow rim and inner floor remain in
    // view while looking across the water and make the strokes readable.
    boat.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.side = THREE.DoubleSide; });
    if (outfit) { const inside = new THREE.MeshStandardMaterial({ color: '#b39366', roughness: .8 });
        const floor = new THREE.Mesh(new THREE.BoxGeometry(1.05, .045, 2.5), inside); floor.position.y = -.19; boat.add(floor);
        const rimCurve = new THREE.Curve(); rimCurve.getPoint = (t, v = new THREE.Vector3()) => v.set(Math.sin(t * Math.PI * 2) * .75, .025, Math.cos(t * Math.PI * 2) * 1.9);
        boat.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve, 40, .035, 5, true), inside)); }
    const paddles = [];
    const wood = new THREE.MeshStandardMaterial({ color: '#8c643f', roughness: .85 });
    if (paddle === 'kayak') { const pivot = new THREE.Group(); pivot.name = 'kayak-paddle'; pivot.position.set(0,.35,.4);
        const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,2.1,6),wood);shaft.rotation.z=Math.PI/2;pivot.add(shaft);
        const bladeMaterial=new THREE.MeshStandardMaterial({color:'#f2c230',roughness:.7});for(const side of [-1,1]){const blade=new THREE.Mesh(new THREE.BoxGeometry(.42,.035,.18),bladeMaterial);blade.position.x=side*1.08;pivot.add(blade);}boat.add(pivot);paddles.push({pivot,side:1,kayak:true});
    } else for (const side of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.name = 'rowing-oar'; pivot.position.set(side * .7, .15, 1.0);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.65, 6), wood); shaft.rotation.z = Math.PI / 2; shaft.position.x = side * .7;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(.5, .055, .18), wood); blade.position.x = side * 1.35;
        pivot.add(shaft, blade); boat.add(pivot); paddles.push({ pivot, side });
    }
    function restore(s) {
        if (!ride) return;
        boat.position.copy(ride.home.p); boat.rotation.copy(ride.home.r); boat.visible = ride.home.visible;
        paddles.forEach(({ pivot }) => pivot.rotation.set(0, 0, 0));
        s.ctl.y = ride.back.y; s.ctl.teleport(ride.back.x, ride.back.z, ride.back.heading); s.ctl.place?.(); ride = null;
    }
    return {
        active: () => !!ride, debug: () => ride && { distance: ride.distance, length: L, velocity: ride.velocity, strokes: ride.strokes, paddleAngles: paddles.map(p=>[p.pivot.rotation.x,p.pivot.rotation.y,p.pivot.rotation.z]) },
        start(s) {
            if (!(L > 2) || ride) return false;
            return flow.begin(s, { title, action, cameraRide: true, help: help || 'Each stroke moves the boat. Follow the short water course back to the landing. Look around freely; Leave or Esc returns ashore.',
                started(s, r) { const p = s.position; ride = { distance: 0, velocity: 0, strokes: 0, t: 0, look: 0, pitch: initialPitch, back: { x: p.x, z: p.z, y: p.y, heading: s.ctl.heading }, home: { p: boat.position.clone(), r: boat.rotation.clone(), visible: boat.visible } }; boat.visible = true; r.status.textContent = '0 m · take a stroke to set off'; },
                actioned(s, r) { r.busy = true; r.t = 0; ride.strokes++; },
                update(dt, s, r) {
                    if (!ride) return;
                    ride.t += dt;
                    if (r.busy) { const before = r.t; r.t += dt; if (before < .3 && r.t >= .3) { ride.velocity = Math.min(speed * 1.5, ride.velocity + speed * 1.2); s.sound?.play?.('splat', .2); } if (r.t >= .9) r.busy = false; }
                    const phase = r.busy ? Math.sin(Math.min(1, r.t / .9) * Math.PI * 2) : 0;
                    paddles.forEach(({ pivot, side, kayak }) => { pivot.rotation.y = side * phase * .55; pivot.rotation.z = kayak ? phase * .65 : -side * Math.sin(Math.min(1, r.t / .9) * Math.PI) * .22; });
                    ride.velocity *= Math.exp(-.65 * dt); if (ride.velocity < .025) ride.velocity = 0;
                    ride.distance = Math.min(L, ride.distance + ride.velocity * dt);
                    const p = alongPolyline(path, ride.distance), ahead = alongPolyline(path, Math.min(L, ride.distance + .7));
                    const targetYaw = Math.hypot(ahead.x - p.x, ahead.z - p.z) > .01 ? Math.atan2(ahead.x - p.x, ahead.z - p.z) : ride.yaw || 0;
                    if (ride.yaw === undefined) ride.yaw = targetYaw;
                    const turn = Math.atan2(Math.sin(targetYaw - ride.yaw), Math.cos(targetYaw - ride.yaw));
                    ride.yaw += Math.max(-2.8 * dt, Math.min(2.8 * dt, turn));
                    const yaw = ride.yaw, bob = Math.sin(ride.t * 1.6) * .025;
                    boat.position.set(p.x, y + floatHeight + bob, p.z); boat.rotation.set(phase * .015, yaw, phase * .025);
                    const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.look -= lk.dx * .0024; ride.pitch = Math.max(-.9, Math.min(.9, ride.pitch - lk.dy * .0024));
                    s.ctl.rig.position.set(p.x, y + eye + bob, p.z); s.ctl.rig.rotation.set(ride.pitch, yaw + Math.PI + ride.look, 0, 'YXZ');
                    r.progress.value = ride.distance / L; r.status.textContent = `${Math.round(ride.distance)} / ${Math.round(L)} m · ${ride.strokes} strokes`;
                    if (ride.distance >= L - .1 && ride.strokes >= 2) flow.complete();
                }, cancel: restore, complete(s) { restore(s); onDone?.(s); },
            });
        },
    };
}
