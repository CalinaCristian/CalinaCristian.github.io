// ============================================================================
//  Centrul Vechi (Bucharest Old Town): Strada Lipscani with Cărturești Carusel
//  (enterable: the white six-level atrium, 2015 refit of an 1860s bank),
//  Hanul lui Manuc (1808 caravanserai: whitewashed walls, dark timber eaves,
//  wooden galleries round the courtyard), the Curtea Veche ruins + Vlad Țepeș
//  bust + the 1559 church (spot `old-town-lipscani`); Stavropoleos church
//  (1724: carved porch with lobed arches, painted saint medallions, tiled
//  tower), Caru' cu Bere, CEC Palace and the National History Museum on Calea
//  Victoriei (spot `stavropoleos-cec`). Shared-surface cobbles, terraces with
//  awnings in front of every bar, cast-iron lanterns, shop signs from OSM.
//  No photo textures (no freedom of panorama in Romania): all modelled.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, hash2, headingFromBearing, centroid, polyBox, inPoly, offsetPolyline, distPolyline, canvas, canvasTexture, fitDraw, obb, polyArea } from '../kit.js';
import { bucBackdrop, classicFacade, classicWalls, balustradeMaterial, palisade, osmPoly, cityFiller, placeLandmark, signAtlas, oldTownTerraces, facadeToward, floodlight, shopfrontFacade, bucActivity } from '../buc.js';
import { wallGeometry } from '../osm.js';
import { buildSecretWcpBar } from './wcp-secret-bar.js';
import { createVenueActivities } from '../venue-activities.js';
import { collide } from '../walker.js';
import { candleLight } from '../candle-light.js';
import { photoHunt } from '../photo-hunt.js';
import { sourceRecord } from '../source-buildings.js';
import { onActivityCancel } from '../participation.js';
import { buildOldTownNightlife, OLD_TOWN_FOCUS, nightlifeHours } from './old-town-nightlife.js';
import { walkBoundary, markVisitExits } from '../walk-boundary.js';
import {freddoFrontagePlan,oldTownGlazing} from './freddo-look.js';
import {caruselBooks} from './carusel-look.js';

function simplify(pts, tol) { if (pts.length < 4) return pts; const dist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; }; let md = 0, mi = 0; for (let i = 1; i < pts.length - 1; i++) { const dd = dist(pts[i], pts[0], pts[pts.length - 1]); if (dd > md) { md = dd; mi = i; } } if (md <= tol) return [pts[0], pts[pts.length - 1]]; return [...simplify(pts.slice(0, mi + 1), tol).slice(0, -1), ...simplify(pts.slice(mi), tol)]; }
const simplifyRing = (p, tol) => { const s2 = simplify([...p, p[0]], tol); s2.pop(); return s2.length >= 3 ? s2 : p; };
function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const wallSeg = (ctx, ax, az, bx, bz, y0, y1) => ctx.collider({ wall: true, ax, az, bx, bz, y0a: y0, y1a: y1, y0b: y0, y1b: y1, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 });
/** walls of a closed ring as wall colliders, leaving `gaps` [{x, z, w}] open */
function ringWalls(ctx, poly, y0, y1, gaps = []) {
    for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        let segs = [[0, 1]];
        for (const g of gaps) { const t = ((g.x - ax) * (bx - ax) + (g.z - az) * (bz - az)) / (L * L), dd = Math.abs((g.x - ax) * (bz - az) - (g.z - az) * (bx - ax)) / L; if (t < 0 || t > 1 || dd > 2) continue; const h = g.w / 2 / L; segs = segs.flatMap(([s, e]) => (t + h <= s || t - h >= e ? [[s, e]] : [[s, Math.max(s, t - h)], [Math.min(e, t + h), e]].filter(([p, q]) => q - p > 0.02))); }
        for (const [s, e] of segs) wallSeg(ctx, ax + (bx - ax) * s, az + (bz - az) * s, ax + (bx - ax) * e, az + (bz - az) * e, y0, y1);
    }
}

// ---------------------------------------------------------------------------- the street fronts (notes 22 / 24)
// Lipscani, Gabroveni, Șelari, Covaci, Smârdan, Franceză & co.: 2–6-storey 19th-c. eclectic / neoclassical fronts on the OSM
// footprints. Tall shop ground floor (4.4 m) with timber / arched / modern shopfronts on every street side, a moulded string
// course, upper floors of 3.7 m with pilasters, pedimented / arched windows, stucco garlands, wrought-iron balconies (3-D on the
// street side), deep cornices and low zinc / tile roofs; pastel plasters, some restored and some peeling. All procedural.
const OT_NAMES = /Lipscani|Gabroveni|Șelari|Covaci|Smârdan|Franceză|Stavropoleos|Poștei|Șepcari|Sfântul Dumitru|Hanul cu Tei|Blănari|Băcani|Sf\. Gheorghe|Nicolae Șelari/;
const OT_COLS = ['#e9dfca', '#e6d3b3', '#ead9c6', '#d8c9a8', '#e3d6c3', '#cfd3c9', '#e7cfc0', '#d9c2a0', '#f0ebe0', '#c9c0b0', '#dcc9a6', '#e8e0d0', '#bfc6c4', '#d6b8a0', '#c7cbb8', '#e4c9b4'];
const OT_VARIANTS = [
    ['ot-a', [{ t: 'rect', w: 0.34, rail: true, pil: true, orn: true, top: 0.22 }, { t: 'pediment', w: 0.32, pil: true, top: 0.32 }, { t: 'arch', w: 0.3, pil: true, top: 0.3 }, { t: 'small', w: 0.26, dentils: true }], {}],
    ['ot-b', [{ t: 'arch', w: 0.36, pil: 'pair', rail: true, orn: true, top: 0.2 }, { t: 'arch', w: 0.34, pil: 'pair', top: 0.22 }, { t: 'rect', w: 0.3, pil: 'pair', top: 0.3 }, { t: 'small', w: 0.26, dentils: true }], {}],
    ['ot-c', [{ t: 'arch2', w: 0.4, rail: true, top: 0.14 }, { t: 'pediment', w: 0.34, orn: true, top: 0.32 }, { t: 'rect', w: 0.32, top: 0.3 }, { t: 'small', w: 0.28 }], { decay: 0.8 }],
    ['ot-d', [{ t: 'rect', w: 0.36, rail: true, top: 0.24 }, { t: 'rect', w: 0.34, top: 0.26 }, { t: 'rect', w: 0.34, top: 0.28 }, { t: 'small', w: 0.3 }], { decay: 1.4 }],
    ['ot-e', [{ t: 'arch', w: 0.34, rustic: true, rail: true, top: 0.2 }, { t: 'pediment', w: 0.32, pil: true, orn: true, top: 0.32 }, { t: 'arch', w: 0.3, pil: true, dentils: true, top: 0.3 }, { t: 'small', w: 0.26 }], {}],
    ['ot-f', [{ t: 'rect', w: 0.3, pil: 'pair', orn: true, rail: true, top: 0.24 }, { t: 'rect', w: 0.3, pil: 'pair', orn: true, top: 0.26 }, { t: 'arch', w: 0.3, pil: 'pair', top: 0.3 }, { t: 'blank' }], { decay: 0.5 }],
];
let IRON = null;
function ironRailMaterial() { // wrought-iron balcony railing: bars, a scroll band, top rail (alpha-tested)
    if (IRON) return IRON;
    const c = canvas(256, 128), x = c.getContext('2d'); x.clearRect(0, 0, 256, 128); x.strokeStyle = x.fillStyle = '#16181a';
    x.fillRect(0, 0, 256, 7); x.fillRect(0, 121, 256, 7); x.fillRect(0, 88, 256, 4);
    for (let i = 0; i < 16; i++) x.fillRect(i * 16 + 7, 0, 2.5, 128);
    x.lineWidth = 3; for (let i = 0; i < 8; i++) { const cx = i * 32 + 16; x.beginPath(); x.arc(cx - 6, 104, 7, 0, Math.PI * 1.6); x.stroke(); x.beginPath(); x.arc(cx + 6, 104, 7, Math.PI, Math.PI * 2.6); x.stroke(); }
    const t = canvasTexture(c, { repeat: true });
    IRON = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: '#ffffff' }); IRON.name = 'ot-iron'; IRON.userData.shared = true;
    return IRON;
}
function oldTownFronts(ctx, { exclude = [] } = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const ways = d.ways.filter((w) => ['pedestrian', 'living_street', 'footway', 'residential'].includes(w.k) && OT_NAMES.test(w.name || ''));
    const exts = Object.values(d.spots).map((s) => s.extent.polygon);
    const nearWay = (x, z) => { let best = 1e9; for (const w of ways) { const q = distPolyline(x, z, w.pts); if (q.d < best) best = q.d; } return best; };
    const rails = new GeoBatch(), built = [];
    for (let bd of d.buildings) {
        if (bd.part || ctx.skipBuildings.has(bd.id) || /church|roof|kiosk|chapel/.test(bd.k || '') || (bd.h || 0) > 26) continue;
        const p = polyArea(bd.poly) > 0 ? bd.poly : [...bd.poly].reverse(), [cx, cz] = centroid(p);
        // Native source solids/parts/holes/roofs stay in the shared renderer.
        // These optional historic trim details never replace a building.
        if(bd.holes?.length || bd.hasParts) continue;
        if (!exts.some((e) => inPoly(cx, cz, e)) || exclude.some((e) => inPoly(cx, cz, e)) || Math.abs(polyArea(p)) < 25) continue;
        if (!p.some(([x, z]) => nearWay(x, z) < 8)) continue;
        const hs=hash2(cx*.37,cz*.53),record=sourceRecord(bd,0,g),gmax=record.datum,GF=Math.min(4.4,record.height*.5),top=gmax+record.height;
        const lv=Math.max(1,Math.floor((record.height-GF)/3.7)+1),light='#f2ede2';
        // Ornament sizes and balcony repetition are explicit visual estimates;
        // literal source mass/roof heights and every geometry member win.
        if(record.height>7)b.prism(grow(p,.12),gmax+GF-.12,gmax+GF+.08,light,'stone',{noTop:true});
        b.prism(grow(p,.18),top-.22,top,light,'stone',{noTop:true,bottom:true});
        // 3-D balconies with wrought-iron railings on the street side (first floor, where the façade row has a balconette)
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az); if (L < 6.5) continue;
            const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (nearWay(mx, mz) > 9) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux; // outward normal (CCW polygon)
            const n = Math.max(1, Math.round(L / 3.4)), bw = L / n, span = n >= 3 && hash2(mx, mz) < 0.45 ? 3 : 1, c0 = Math.floor((n - span) / 2);
            for (const fl of lv >= 3 && hash2(mz, mx) < 0.5 ? [1, 2] : [1]) {
                if (fl === 2 && span === 3) continue;
                const yb = gmax + GF + (fl - 1) * 3.7 + 0.05, u0 = (c0 + 0.12) * bw, u1 = (c0 + span - 0.12) * bw, w = u1 - u0, uc = (u0 + u1) / 2, D = 0.8;
                const px = ax + ux * uc + nx * D / 2, pz = az + uz * uc + nz * D / 2, yaw = Math.atan2(ux, uz);
                b.box(px + nx * 0.03, yb - 0.14, pz + nz * 0.03, D - 0.04, 0.16, w, light, 'stone', yaw);
                for (const k of [-0.42, 0.42]) b.box(ax + ux * (uc + k * w) + nx * 0.3, yb - 0.5, az + uz * (uc + k * w) + nz * 0.3, 0.45, 0.36, 0.14, light, 'stone', yaw);
                const P = (u, dd, y) => [ax + ux * u + nx * dd, y, az + uz * u + nz * dd];
                rails.quad(P(u0, D, yb), P(u1, D, yb), P(u1, D, yb + 1.0), P(u0, D, yb + 1.0), '#ffffff', 'iron', [0, 0, w / 1.6, 0, w / 1.6, 1, 0, 1]);
                for (const [uu, s] of [[u0, 1], [u1, -1]]) rails.quad(P(uu, 0.02, yb), P(uu, D, yb), P(uu, D, yb + 1.0), P(uu, 0.02, yb + 1.0), '#ffffff', 'iron', [0, 0, D / 1.6, 0, D / 1.6, 1, 0, 1]);
            }
        }
        built.push({ bd, p, inner: grow(p, -0.4), top, gmax, GF, lv });
    }
    ctx.add(b.build('old-town-facade-trim'));
    ctx.add(rails.build('old-town-balconies', { castShadow: true, matOverrides: { iron: ironRailMaterial() } }));
    return { built, ways, decoratedIds:new Set(built.map(x=>x.bd.id)) };
}

// ---------------------------------------------------------------------------- festoon string lights (note 25)
// Lipscani & co. are strung with festoons: warm bulbs on a black cable hung across the lane between wall brackets at a consistent
// height (≈ 5.6 m) with a gentle sag, lit at night. Every line ends on a façade bracket; no line is drawn without walls on both sides.
function rayFacade(blds, px, pz, dx, dz, maxD) {
    let best = null;
    for (const { p, bb } of blds) {
        if (Math.max(px, px + dx * maxD) < bb.x0 - 1 || Math.min(px, px + dx * maxD) > bb.x1 + 1 || Math.max(pz, pz + dz * maxD) < bb.z0 - 1 || Math.min(pz, pz + dz * maxD) > bb.z1 + 1) continue;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], [bx, bz] = p[i], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t > 0.5 && t < maxD && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, x: px + dx * t, z: pz + dz * t };
        }
    }
    return best;
}
function festoons(ctx, ways, { spacing = 5.5, height = 5.6 } = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), bulbs = new GeoBatch(), out = [];
    const blds = d.buildings.filter((x) => !x.part).map((x) => ({ p: x.poly, bb: polyBox(x.poly) }));
    const bulbGeo = new THREE.OctahedronGeometry(0.05, 0);
    for (const w of ways) {
        if (!/Lipscani|Gabroveni|Șelari|Smârdan|Covaci|Franceză|Hanul cu Tei|Stavropoleos|Poștei|Blănari|Băcani/.test(w.name || '') || w.k === 'residential') continue;
        let acc = spacing * 0.5;
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            for (; acc < L; acc += spacing) {
                const cx = ax + ux * acc, cz = az + uz * acc;
                const A = rayFacade(blds, cx, cz, nx, nz, 11), B = rayFacade(blds, cx, cz, -nx, -nz, 11);
                if (!A || !B || A.t + B.t < 3.5 || A.t + B.t > 18) continue;
                const y = g.heightAt(cx, cz) + height, span = A.t + B.t, sag = 0.18 + span * 0.035;
                const pts = []; for (let q = 0; q <= 10; q++) { const t = q / 10; pts.push([A.x + (B.x - A.x) * t, y - Math.sin(t * Math.PI) * sag, A.z + (B.z - A.z) * t]); }
                for (let q = 1; q < pts.length; q++) b.rod(pts[q - 1], pts[q], 0.008, '#121212', 'metal', 3);
                for (const [P, s] of [[A, 1], [B, -1]]) { b.box(P.x - nx * s * 0.12, y - 0.05, P.z - nz * s * 0.12, 0.05, 0.08, 0.24, '#1a1a1a', 'metal', Math.atan2(nx, nz)); }
                const nb = Math.max(4, Math.round(span / 0.55));
                for (let q = 1; q < nb; q++) { const t = q / nb, x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t, yy = y - Math.sin(t * Math.PI) * sag - 0.09; bulbs.add(bulbGeo, 'bulb', M(x, yy, z, 0, 0, 0, 0.9, 1.25, 0.9), '#fff4d6'); b.cyl(x, yy + 0.04, z, 0.012, 0.05, '#121212', 'metal', 4); }
                out.push({ A, B, y });
            }
            acc -= L;
        }
    }
    const bm = new THREE.MeshStandardMaterial({ color: '#fff3d8', emissive: new THREE.Color('#ffc978'), emissiveIntensity: 0.15, roughness: 0.25 }); bm.name = 'festoon-bulbs'; bm.userData.dayGlow = 0.15; bm.userData.nightGlow = 3.2;
    ctx.add(b.build('festoon-cables', { castShadow: false }));
    ctx.add(bulbs.build('festoon-bulbs', { castShadow: false, matOverrides: { bulb: bm } }));
    return out;
}

// ---------------------------------------------------------------------------- Cărturești Carusel (Lipscani 55)
// OSM way 658009149: 27.4 × 13.4 m, the narrow front faces Lipscani (south). Street front: rusticated white stucco, a giant
// arch over two storeys filled with a three-light arched window, the "cărturești" band over the shop window, an attic
// aedicule with urn finials and the glass mansard roof. Inside: six white levels round an oval atrium with undulating
// balustrades, bookshelves on every wall, the bistro on the top floor (levels reached by walking the modeled stair).
function buildCarusel(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'w658009149'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const p = bd.poly, o = obb(p), y0 = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) + 0.05;
    // front edge = the edge facing Lipscani (largest z)
    let fi = 0, fz = -1e9; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], mz = (p[i][1] + q[1]) / 2; if (mz > fz && Math.hypot(q[0] - p[i][0], q[1] - p[i][1]) > 8) { fz = mz; fi = i; } }
    const A = p[fi], B = p[(fi + 1) % p.length], fx = (A[0] + B[0]) / 2, fzz = (A[1] + B[1]) / 2, FW = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / FW, uz = (B[1] - A[1]) / FW; let nx = uz, nz = -ux; if (nz < 0) { nx = -nx; nz = -nz; } // outward normal (toward the street)
    const yaw = Math.atan2(nx, nz), H = 19.5, b = new GeoBatch(), WH = '#e9e2d2';
    const fac = classicFacade('carusel-side', [{ t: 'blank', rustic: true }, { t: 'rect', w: 0.3 }, { t: 'rect', w: 0.3 }, { t: 'small', w: 0.26 }], { bay: 3.4, floor: 4.9, lit: 0.5 });
    // The custom front elevation owns this exact face. Keep the other source
    // faces in the shell, so an opaque duplicate cannot cover the open door.
    const sides=wallGeometry(p,y0,y0+H,fac.S,y0,WH), vertices=sides.attributes.position, kept=[];
    for(let i=0;i<sides.index.count;i+=3){const tri=[sides.index.getX(i),sides.index.getX(i+1),sides.index.getX(i+2)];
        if(tri.every(j=>Math.abs((vertices.getX(j)-fx)*nx+(vertices.getZ(j)-fzz)*nz)<.01))continue;kept.push(...tri);}
    sides.setIndex(kept);b.add(sides,fac.key,null,WH);sides.dispose();
    // the street front: a canvas elevation (no photo): rustication, giant arch with 3 arched lights, sign band, door
    const fc = canvas(512, 768), x = fc.getContext('2d'), S = 512 / FW, PX = (m) => m * S, PY = (m) => 768 - m * (768 / (H + 0.5));
    x.fillStyle = '#ebe5d8'; x.fillRect(0, 0, 512, 768);
    x.fillStyle = 'rgba(80,70,55,0.18)'; for (let yy = PY(H); yy < 768; yy += 9) x.fillRect(0, yy, 512, 1.6); // rustication
    // giant arch (2 storeys), moulded archivolt with beads
    const ax0 = PX(1.6), ax1 = PX(FW - 1.6), aTop = PY(14.2), aw = ax1 - ax0;
    x.fillStyle = '#e2dccd'; x.beginPath(); x.moveTo(ax0 - 18, PY(0.4)); x.lineTo(ax0 - 18, aTop + aw / 2 * 0.62); x.quadraticCurveTo(256, aTop - 46, ax1 + 18, aTop + aw / 2 * 0.62); x.lineTo(ax1 + 18, PY(0.4)); x.fill();
    x.strokeStyle = 'rgba(120,108,88,0.6)'; x.lineWidth = 3; x.stroke();
    for (let i = 0; i < 26; i++) { const t = i / 25, px = ax0 - 9 + (aw + 18) * t, py = aTop + aw / 2 * 0.62 - Math.sin(t * Math.PI) * (aw * 0.31 + 23); x.fillStyle = '#d6cfbf'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    x.fillStyle = '#b9b29f'; x.fillRect(ax0, aTop + 30, aw, PY(0.4) - aTop - 30); // grey frame
    const gl = (gx, gy, gw, gh) => { const gr = x.createLinearGradient(0, gy, 0, gy + gh); gr.addColorStop(0, '#9fb3bf'); gr.addColorStop(1, '#46525a'); x.fillStyle = gr; x.beginPath(); x.moveTo(gx, gy + gh); x.lineTo(gx, gy + gw / 2); x.arc(gx + gw / 2, gy + gw / 2, gw / 2, Math.PI, 0); x.lineTo(gx + gw, gy + gh); x.fill(); x.fillStyle = 'rgba(70,72,70,0.9)'; x.fillRect(gx, gy + gh * 0.55, gw, 3); };
    gl(ax0 + aw * 0.05, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6)); gl(ax0 + aw * 0.44, PY(12.0), aw * 0.12, PY(6.4) - PY(12.0)); gl(ax0 + aw * 0.59, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6));
    x.fillStyle = '#f7f6f2'; x.fillRect(ax0 + aw * 0.02, PY(6.3), aw * 0.96, PY(5.0) - PY(6.3)); // sign band
    fitDraw(x, 'cărturești', ax0 + aw * 0.06, PY(6.25), aw * 0.6, (PY(5.45) - PY(6.25)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#2f6b3a', align: 'left' });
    fitDraw(x, 'carte, ceai, muzică, dichis', ax0 + aw * 0.06, PY(5.5), aw * 0.6, (PY(5.05) - PY(5.5)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#333', align: 'left' });
    x.fillStyle = '#3d8b3d'; x.fillRect(ax0 + aw * 0.78, PY(6.2), aw * 0.1, PY(5.1) - PY(6.2));
    gl(ax0 + aw * 0.04, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9)); gl(ax0 + aw * 0.6, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9));
    x.fillStyle = '#2a2a28'; x.fillRect(ax0 + aw * 0.44, PY(4.0), aw * 0.12, PY(0.4) - PY(4.0)); // door
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(256, aTop - 4, 22, 0, 7); x.fill(); x.fillStyle = '#8a3a2a'; x.fillRect(244, aTop - 2, 24, 8); // cartouche
    x.fillStyle = 'rgba(90,80,65,0.5)'; x.fillRect(0, PY(H - 0.4), 512, 6); // cornice shadow
    // Match the existing physical entrance gap with a visibly open central
    // doorway. Its detailed size is an estimate, not a surveyed portal plan.
    x.clearRect(PX(FW/2-1.15),PY(3.1),PX(2.3),PY(0)-PY(3.1)+2);
    // The two ground-floor shop windows transmit the modeled interior; only
    // these existing glazed openings lose opaque paint, not the source piers.
    x.globalCompositeOperation='destination-out';
    for(const start of [.04,.6]){const gx=ax0+aw*start,gy=PY(4.9),gw=aw*.36,gh=PY(.5)-PY(4.9);x.beginPath();x.moveTo(gx,gy+gh);x.lineTo(gx,gy+gw/2);x.arc(gx+gw/2,gy+gw/2,gw/2,Math.PI,0);x.lineTo(gx+gw,gy+gh);x.closePath();x.fill();}
    x.globalCompositeOperation='source-over';
    const ft = canvasTexture(fc);
    const fm = new THREE.MeshStandardMaterial({ map: ft, alphaTest:.5, side:THREE.DoubleSide, roughness: 0.75, emissive: new THREE.Color('#ffe7c2'), emissiveMap: ft, emissiveIntensity: 0 }); fm.userData.dayGlow = 0; fm.userData.nightGlow = 0.45;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(FW, H + 0.5), fm); front.position.set(fx + nx * 0.06, y0 + (H + 0.5) / 2, fzz + nz * 0.06); front.rotation.y = yaw; front.name = 'carusel-front'; ctx.add(front);
    const glazing=new GeoBatch(),glassMat=new THREE.MeshStandardMaterial({color:'#a4c3c8',transparent:true,opacity:.13,roughness:.16,metalness:.04,depthWrite:false,side:THREE.DoubleSide});
    for(const start of [.04,.6]){const centre=(1.6+((FW-3.2)*start)+(FW-3.2)*.18)-FW/2,px=fx+ux*centre+nx*.025,pz=fzz+uz*centre+nz*.025,w=(FW-3.2)*.36;
        glazing.quad([px-ux*w/2,y0+.5,pz-uz*w/2],[px+ux*w/2,y0+.5,pz+uz*w/2],[px+ux*w/2,y0+4.9,pz+uz*w/2],[px-ux*w/2,y0+4.9,pz-uz*w/2],'#ffffff','caruselGlass');}
    ctx.add(glazing.build('carusel-source-front-glazing',{castShadow:false,matOverrides:{caruselGlass:glassMat}}));
    for(const side of [-1,1])b.box(fx+ux*side*1.2,y0,fzz+uz*side*1.2,.1,3.15,.15,'#34332d','wood',yaw);
    b.box(fx,y0+3.1,fzz,2.5,.12,.15,'#34332d','wood',yaw);
    ctx.extras.caruselDoor={x:fx,z:fzz,y:y0,nx,nz,width:2.3,estimatedPortal:true};
    // cornice, attic aedicule with urns, glass mansard
    b.box(fx + nx * 0.3, y0 + H - 0.2, fzz + nz * 0.3, 0.9, 0.9, FW + 0.6, '#f1ece2', 'stone', yaw + Math.PI / 2);
    b.box(fx - nx * 0.6, y0 + H + 0.7, fzz - nz * 0.6, 1.2, 5.6, 4.2, WH, 'stone', yaw + Math.PI / 2);
    b.add(new THREE.ConeGeometry(2.9, 1.6, 3), 'stone', M(fx - nx * 0.2, y0 + H + 7.1, fzz - nz * 0.2, 0, yaw, Math.PI / 2, 1, 1, 0.45), '#f1ece2');
    for (const s of [-1, 1]) { const qx = fx + ux * s * (FW / 2 - 0.6), qz = fzz + uz * s * (FW / 2 - 0.6); b.box(qx, y0 + H + 0.7, qz, 1, 1.4, 1, WH, 'stone'); b.sphere(qx, y0 + H + 2.6, qz, 0.5, 0.7, 0.5, '#efe9dc', 'stone', 10, 8); }
    b.sphere(fx - nx * 0.3, y0 + H + 8.3, fzz - nz * 0.3, 0.45, 0.6, 0.45, '#efe9dc', 'stone', 10, 8);
    const roofP = grow(p, -0.3), oc = o;
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.7, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), 'darkglass', M(oc.cx, y0 + H + 2.3, oc.cz, 0, -oc.angle, 0, oc.len - 0.6, 4.6, oc.wid - 0.6), '#3b4148');
    const roofPoint=(u,v,y)=>[oc.cx+oc.ux*u+oc.uz*v,y,oc.cz+oc.uz*u-oc.ux*v];
    for(const su of [-1,1])for(const sv of [-1,1])b.rod(roofPoint(su*(oc.len-.6)/2,sv*(oc.wid-.6)/2,y0+H+.02),roofPoint(su*(oc.len-.6)*.35,sv*(oc.wid-.6)*.35,y0+H+4.62),.03,'#59605a','metal',5);
    void roofP;
    // ---- interior: levels, atrium, balustrades, shelves
    const LV = [0, 4.6, 8.4, 12.2, 16.0], stair={x:oc.cx-oc.ux*oc.len*.38,z:oc.cz-oc.uz*oc.len*.38}, stairWell=Array.from({length:32},(_,i)=>[stair.x+Math.cos(i/32*Math.PI*2)*2.45,stair.z+Math.sin(i/32*Math.PI*2)*2.45]), innerP = grow(p, -0.35), ecx = oc.cx + (fx - oc.cx) * 0.08, ecz = oc.cz + (fzz - oc.cz) * 0.08;
    const along = Math.atan2(oc.ux, oc.uz); // long axis direction
    const ell = (k, rxK = 1) => { const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, wob = 1 + 0.07 * Math.sin(a * 5 + k * 1.3), rx = (3.1 - k * 0.1) * wob * rxK, rz = (8.2 - k * 0.35) * wob * rxK; const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz; pts.push([ecx + lx * Math.cos(along) + lz * Math.sin(along), ecz - lx * Math.sin(along) + lz * Math.cos(along)]); } return pts; };
    const iw = new GeoBatch(), WHITE = '#f6f5f1';
    const shelf=caruselBooks();
    const shelves = new GeoBatch();
    for (let k = 0; k < LV.length; k++) {
        const ly = y0 + LV[k];
        if (k > 0) { // slab with the atrium hole (white, slightly self-lit so the interior reads bright)
            const sh = new THREE.Shape(innerP.map(([a, c]) => new THREE.Vector2(a, -c))); sh.holes.push(new THREE.Path(ell(k).map(([a, c]) => new THREE.Vector2(a, -c))));sh.holes.push(new THREE.Path(stairWell.map(([a,c])=>new THREE.Vector2(a,-c))));
            const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 4 }); sg.rotateX(-Math.PI / 2); sg.translate(0, ly - 0.2, 0);
            iw.add(sg, 'paint', null, WHITE, { emissive: '#ffffff', emissiveIntensity: 0.08, roughness: 0.58 }); sg.dispose();
            // undulating balustrade round the hole + walk surface + wall collider at this level
            const e=ell(k),railColour=k===2?'#242a27':WHITE;
            // Open, fine white rails instead of a metre-high solid opaque band.
            for(let i=0;i<e.length;i++){const a=e[i],c=e[(i+1)%e.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]),h0=1.03+.1*Math.sin(i/e.length*Math.PI*10+k),h1=1.03+.1*Math.sin((i+1)/e.length*Math.PI*10+k);
                iw.rod([a[0],ly+h0,a[1]],[c[0],ly+h1,c[1]],.026,railColour,'paint',6);iw.rod([a[0],ly+.09,a[1]],[c[0],ly+.09,c[1]],.014,railColour,'paint',5);
                const n=Math.max(1,Math.ceil(L/.23));for(let j=0;j<n;j++){const t=j/n,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t; iw.rod([x,ly+.08,z],[x,ly+h0+(h1-h0)*t,z],.011,railColour,'paint',5);}
                wallSeg(ctx,a[0],a[1],c[0],c[1],ly-.2,ly+1.1);
            }
            const holeE = ell(k);
            g.surfaces.push({ kind: 'carusel', x: oc.cx, z: oc.cz, r: oc.len / 2 + 2, bottom: ly - 0.6, contains: (px, pz) => inPoly(px, pz, innerP) && !inPoly(px, pz, holeE) && !inPoly(px,pz,stairWell), top: () => ly });
        }
        // White bookcase joinery, six shelves, bindings at0.03–0.08m scale.
        for(let i=0;i<innerP.length;i++){const [ax,az]=innerP[i],[bx,bz]=innerP[(i+1)%innerP.length],L=Math.hypot(bx-ax,bz-az);if(L<6)continue;const mx=(ax+bx)/2,mz=(az+bz)/2;if(Math.hypot(mx-fx,mz-fzz)<3)continue;
            const a=Math.atan2(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz,nz=ux,margin=.35,w=L-margin*2,P=(u,y)=>[ax+ux*u+nx*.225,y,az+uz*u+nz*.225];
            iw.box(mx,ly,mz,.4,3.12,L-.65,WHITE,'paint',a);
            shelves.quad(P(margin,ly+.12),P(L-margin,ly+.12),P(L-margin,ly+2.96),P(margin,ly+2.96),'#ffffff','shelf',[0,0,w/1.4,0,w/1.4,1,0,1]);
            for(let j=0;j<=6;j++)iw.box(mx+nx*.015,ly+.1+j*2.86/6,mz+nz*.015,.43,.035,L-.65,WHITE,'paint',a);
            for(let u=margin;u<L-margin;u+=1.4)iw.box(ax+ux*u,ly,az+uz*u,.43,3.12,.035,WHITE,'paint',a);
        }
    }
    // Slender gallery supports; their positions are reconstruction estimates.
    for(const t of [-5.5,0,4.2])for(const side of [-1,1]){const x=oc.cx+oc.ux*t-oc.uz*side*4.45,z=oc.cz+oc.uz*t+oc.ux*side*4.45;
        iw.cyl(x,y0,z,.2,16.1,WHITE,'paint',16);iw.cyl(x,y0,z,.23,.18,WHITE,'paint',16);for(const h of LV.slice(1)){iw.cyl(x,y0+h-.35,z,.24,.2,WHITE,'paint',16);iw.cyl(x,y0+h-.15,z,.31,.1,WHITE,'paint',16);iw.box(x,y0+h-.05,z,.64,.08,.64,WHITE,'paint');for(let j=0;j<8;j++){const a=j*Math.PI/4;iw.sphere(x+Math.cos(a)*.235,y0+h-.22,z+Math.sin(a)*.235,.07,.1,.07,WHITE,'paint',5,4);}}ctx.circle(x,z,.23,16.1,{y:y0});}
    // ground floor tables of books + the white stair
    const r = rng(8);
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6 - 0.5, px = oc.cx + oc.ux * t * oc.len * 0.6, pz = oc.cz + oc.uz * t * oc.len * 0.6; iw.box(px + (r() - 0.5), y0, pz, 1.3, 0.8, 0.8, '#d8d2c4', 'wood', along); ctx.box(px, pz, 0.7, 0.45, along, { prop: true, h: 0.8 }); }
    // Continuous walkable version of the existing estimated stair. The real
    // bookstore has stairs and galleries; this reconstruction's exact curve,
    // tread sizes and landings are estimates, not a measured interior plan.
    const stairPath=[];
    for(let k=0;k<LV.length-1;k++){
        const rise=LV[k+1]-LV[k];
        for(let j=0;j<10;j++){
            const a=(k+j/10)*Math.PI,x=stair.x+Math.cos(a)*1.7,z=stair.z+Math.sin(a)*1.7,top=y0+LV[k]+rise*(j+1)/10;
            iw.box(x,top-.18,z,1.2,.18,.62,WHITE,'paint',-a);
            g.addBox(x,z,.6,.31,-a,top-.18,top,{kind:'carusel-stair'});stairPath.push({x,z,y:top});
            for(const rr of [1.06,2.34])if(j>0&&j<8){const p0=[stair.x+Math.cos(a)*rr,top+1,stair.z+Math.sin(a)*rr],a1=a+Math.PI/10,p1=[stair.x+Math.cos(a1)*rr,top+rise/10+1,stair.z+Math.sin(a1)*rr];iw.rod(p0,p1,.035,WHITE,'paint',6);wallSeg(ctx,p0[0],p0[2],p1[0],p1[2],top-.1,top+1);}
        }
        const a=(k+.9)*Math.PI,x=stair.x+Math.cos(a)*2.3,z=stair.z+Math.sin(a)*2.3,top=y0+LV[k+1];
        iw.box(x,top-.18,z,1.5,.18,1.05,WHITE,'paint',-a);g.addBox(x,z,.75,.525,-a,top-.18,top,{kind:'carusel-landing'});
    }
    // walls (enter through the shop door): wall colliders round the outline with a door gap on the front
    ringWalls(ctx, p, y0 - 1, y0 + H + 6, [{ x: fx, z: fzz, w: 2.3 }]);
    ctx.extras.caruselFloor = () => ctx.painter.poly(innerP, '#9b8062', 'wood');
    ctx.add(iw.build('carusel-interior', { castShadow: false }));
    ctx.add(shelves.build('carusel-shelves', { castShadow: false, matOverrides: { shelf } }));
    const roofGlass=new THREE.MeshStandardMaterial({color:'#b9ced0',transparent:true,opacity:.2,roughness:.16,metalness:.06,depthWrite:false,side:THREE.DoubleSide});roofGlass.name='carusel-skylight-glass';
    const shell=b.build('carusel', { matOverrides: { [fac.key]: fac.mat,darkglass:roofGlass } });
    // The same estimated shell encloses the modeled interior. Its real walls
    // and roof must remain visible from the galleries as well as the street.
    const insideMaterials=new Map();shell.traverse(o=>{if(!o.isMesh)return;const inward=m=>{if(m===roofGlass)return m;if(!insideMaterials.has(m)){const copy=m.clone();copy.side=THREE.DoubleSide;copy.userData={...m.userData,shared:true};insideMaterials.set(m,copy);}return insideMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(inward):inward(o.material);});ctx.add(shell);
    // The inward clones own their material programs; their cached facade maps
    // remain shared. Generic scene disposal must not discard those shared maps.
    (ctx.extras.sceneCleanups||=[]).push(()=>{for(const m of insideMaterials.values())m.dispose();});
    // Upper-storey fixtures must not become tall outdoor lamps whose pooled
    // ground spill shines through every gallery and burns out the shop floor.
    // One bounded reading light supplements the self-lit estimated interior.
    const readingLight=new THREE.PointLight('#fff1db',24,7,2);readingLight.name='carusel-reading-light';readingLight.position.set(ecx,y0+3.1,ecz);ctx.add(readingLight);
    const climb={previous:null,distance:0,ascent:0,done:false};
    onActivityCancel(ctx, () => { climb.previous = null; climb.distance = 0; climb.ascent = 0; });
    ctx.onUpdate((dt,s,pl)=>{if(!pl||climb.done)return;const previous=climb.previous;climb.previous={x:pl.x,y:pl.y,z:pl.z};if(!previous)return;
        const d=Math.hypot(pl.x-previous.x,pl.z-previous.z),dy=pl.y-previous.y;
        if(!s.ctl.active||d>Math.max(.8,dt*6)||Math.abs(dy)>.75){climb.distance=0;climb.ascent=0;return;}
        if(!inPoly(pl.x,pl.z,innerP)){climb.distance=0;climb.ascent=0;return;}
        climb.distance+=d;climb.ascent+=Math.max(0,dy);
        if(pl.y>=y0+LV.at(-1)-.15&&climb.distance>=18&&climb.ascent>=14){climb.done=true;bucActivity(s,'old-town-lipscani','carusel','📚 Carusel stair climb','Top gallery reached. Enjoy the view down into the bookshop atrium.');}
    });
    ctx.interactables.push({kind:'stairs',x:stairPath[0].x,z:stairPath[0].z,y:y0,r:2.2,tourAvailable:()=>false,label:'Walk the visible stairs to the top gallery',use:s=>s.ui.toast('📚 Walk up the stairs','Follow the visible treads and galleries to the top. Keep climbing to complete the stair walk.')});
    ctx.extras.caruselStairs={path:stairPath,climb,well:stairWell,estimatedLayout:true};
    return { front: { x: fx, z: fzz, nx, nz, yaw }, y0, LV, ecx, ecz, along, stair,poly:p };
}

// ---------------------------------------------------------------------------- Hanul lui Manuc
function buildManuc(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'r19803024'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const outer = bd.poly, hole = bd.holes?.[0] || null, y0 = Math.min(...outer.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 9.2;
    const fac = classicFacade('manuc', [{ t: 'rect', w: 0.28, top: 0.3, bottom: 0.2, cornice: false }, { t: 'rect', w: 0.3, top: 0.22, cornice: false }, { t: 'rect', w: 0.28, cornice: false }, { t: 'rect', w: 0.3, cornice: false }], { bay: 3.4, floor: 4.6, lit: 0.6 });
    const b = new GeoBatch(), WALL = '#f2efe7', WOOD = '#3b2a1e';
    classicWalls(b, fac, outer, y0, y0 + H, WALL, y0);
    if (hole) classicWalls(b, fac, [...hole].reverse(), y0, y0 + H, WALL, y0);
    // deep dark timber eave + roof (ring roof: two slopes to a ridge between the outer wall and the courtyard)
    const eo = grow(outer, 1.3); b.prism(eo, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true, bottom: true });
    if (hole) { const ei = grow(hole, -1.3); b.prism(hole, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true }); void ei; }
    const so = simplifyRing(outer, 2.5), eoS = grow(so, 1.3), ridgeO = grow(so, -5.8), roofCol = '#6b5a4c';
    const strip = (A, Bp, ya, yb) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; b.quad([A[i][0], ya, A[i][1]], [A[j][0], ya, A[j][1]], [Bp[j][0], yb, Bp[j][1]], [Bp[i][0], yb, Bp[i][1]], roofCol, 'roofs'); b.quad([A[j][0], ya, A[j][1]], [A[i][0], ya, A[i][1]], [Bp[i][0], yb, Bp[i][1]], [Bp[j][0], yb, Bp[j][1]], roofCol, 'roofs'); } };
    strip(eoS, ridgeO, y0 + H + 0.35, y0 + H + 4.2);
    if (hole) { const sh = simplifyRing(hole, 2.5), hi = grow(sh, -1.4), ridgeI = grow(sh, 5.8); strip(hi, ridgeI, y0 + H + 0.35, y0 + H + 4.2); }
    // courtyard galleries: wooden posts + upper balustrade round the courtyard
    if (hole) { const gi = grow(hole, -2.2); for (let i = 0; i < gi.length; i++) { const [ax, az] = gi[i], [bx, bz] = gi[(i + 1) % gi.length], L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 2.8)); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; b.box(x, y0, z, 0.24, H, 0.24, WOOD, 'wood'); ctx.circle(x, z, 0.16, 3); } b.rod([ax, y0 + 4.6 + 1.0, az], [bx, y0 + 4.6 + 1.0, bz], 0.06, WOOD, 'wood', 4); b.rod([ax, y0 + 4.6, az], [bx, y0 + 4.6, bz], 0.18, WOOD, 'wood', 4); for (let k = 0; k <= n * 4; k++) { const t = k / (n * 4); b.box(ax + (bx - ax) * t, y0 + 4.6, az + (bz - az) * t, 0.05, 1.0, 0.05, WOOD, 'wood'); } } }
    // the gate on Str. Franceză (north wing) + "HANUL MANUC" letters
    // the gate: on the outer wall edge nearest Str. Franceză at x ≈ 200 (north wing), passage straight through to the courtyard
    let gate = { x: 199.5, z: 167.5 }, gn = { x: 0, z: -1 }, bestD = 1e9;
    for (let i = 0; i < outer.length; i++) { const [ax, az] = outer[i], [bx, bz] = outer[(i + 1) % outer.length], L = Math.hypot(bx - ax, bz - az); if (L < 4) continue; const t = Math.max(0.1, Math.min(0.9, ((200 - ax) * (bx - ax) + (150 - az) * (bz - az)) / (L * L))), px = ax + (bx - ax) * t, pz = az + (bz - az) * t, dd = Math.hypot(px - 200, pz - 150); if (dd < bestD) { bestD = dd; gate = { x: px, z: pz }; gn = { x: (bz - az) / L, z: -(bx - ax) / L }; if (gn.z > 0) { gn.x = -gn.x; gn.z = -gn.z; } } }
    const gate2 = { x: gate.x - gn.x * 17, z: gate.z - gn.z * 17 }, gyaw = Math.atan2(gn.x, gn.z);
    { // the arched gateway (dark passage), timber doors folded back
        const gc = canvas(256, 256), gx = gc.getContext('2d'); gx.fillStyle = '#f2efe7'; gx.fillRect(0, 0, 256, 256); gx.fillStyle = '#d9d2c2'; gx.beginPath(); gx.moveTo(40, 256); gx.lineTo(40, 90); gx.arc(128, 90, 88, Math.PI, 0); gx.lineTo(216, 256); gx.fill(); gx.fillStyle = '#1e1813'; gx.beginPath(); gx.moveTo(56, 256); gx.lineTo(56, 96); gx.arc(128, 96, 72, Math.PI, 0); gx.lineTo(200, 256); gx.fill();
        const gm = new THREE.MeshStandardMaterial({ map: canvasTexture(gc), roughness: 0.8 }), gp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), gm); gp.position.set(gate.x + gn.x * 0.05, y0 + 2.3, gate.z + gn.z * 0.05); gp.rotation.y = gyaw; gp.name = 'manuc-gate'; ctx.add(gp);
    }
    const sg = signAtlas([{ x: gate.x + gn.x * 0.1, y: y0 + 5.4, z: gate.z + gn.z * 0.1, yaw: gyaw, w: 5.4, h: 0.8, text: 'HANUL MANUC', bg: '#f2efe7', fg: '#3b2a1e', border: false, font: (q) => `700 ${q}px Georgia, serif` }], { name: 'manuc-sign', night: 0.6 });
    if (sg) ctx.add(sg);
    // collisions: outer + inner ring walls with the gate passage open
    ringWalls(ctx, outer, y0 - 1, y0 + H + 4, [{ x: gate.x, z: gate.z, w: 3.6 }]);
    if (hole) ringWalls(ctx, hole, y0 - 1, y0 + H + 4, [{ x: gate2.x, z: gate2.z, w: 3.6 }]);
    for (const s of [-1, 1]) wallSeg(ctx, gate.x - gn.z * s * 1.8, gate.z + gn.x * s * 1.8, gate2.x - gn.z * s * 1.8, gate2.z + gn.x * s * 1.8, y0 - 1, y0 + H);
    ctx.add(b.build('manuc', { matOverrides: { [fac.key]: fac.mat } }));
    // courtyard: stone pavers, terrace tables under umbrellas
    if (hole) { ctx.painter.poly(hole, '#9a9286', 'cobble'); const t = new GeoBatch(), r = rng(4), bb = polyBox(hole); for (let i = 0; i < 16; i++) { const x = bb.x0 + 5 + r() * (bb.x1 - bb.x0 - 10), z = bb.z0 + 5 + r() * (bb.z1 - bb.z0 - 10); if (!inPoly(x, z, grow(hole, -3))) continue; t.cyl(x, y0 + 0.2, z, 0.05, 0.75, '#2a2a2a', 'metal', 6); t.cyl(x, y0 + 0.95, z, 0.45, 0.04, '#6b4a32', 'wood', 10); t.cyl(x, y0 + 0.2, z, 0.035, 2.4, '#d8d0c0', 'wood', 5); t.add(new THREE.ConeGeometry(1.5, 0.6, 8), 'fabric', M(x, y0 + 2.75, z), r.pick(['#efe7d4', '#7a2230', '#2f5a3a'])); ctx.circle(x, z, 0.8, 1); } ctx.add(t.build('manuc-yard')); }
    return { gate, gn, y0, hole };
}

// ---------------------------------------------------------------------------- Curtea Veche: ruins, bust, 1559 church
function buildCurteaVeche(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const ru = osmPoly(d, 'w658220894');let ruinsGround=null;
    if (ru) { ctx.skipBuildings.add('w658220894'); const y = Math.min(...ru.map(([x, z]) => g.heightAt(x, z)));ruinsGround=y;
        // excavated brick walls (low, ragged) on the outline + cross walls, a grassy pit, iron railing round it
        for (let i = 0; i < ru.length; i++) { const [ax, az] = ru[i], [bx, bz] = ru[(i + 1) % ru.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; const n = Math.ceil(L / 2); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, h = 1.1 + Math.abs(Math.sin(i * 3.1 + k * 1.7)) * 1.6; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2; b.box(cx, y - 1.4 - ((i + k) % 3) * 0.03, cz, 1.0 - (k % 2) * 0.06, h + 1.4, L / n + 0.05, '#a65a3a', 'brick', Math.atan2(bx - ax, bz - az)); } }
        const o = obb(ru); for (let k = -2; k <= 2; k++) { const cx = o.cx + o.ux * k * o.len * 0.18, cz = o.cz + o.uz * k * o.len * 0.18; b.box(cx, y - 1.5, cz, 0.9, 1.9 + (k % 2 ? 0.8 : 0), o.wid * 0.8, '#9e5536', 'brick', Math.atan2(o.ux, o.uz) + Math.PI / 2); }
        g.mod((x, z, h) => (inPoly(x, z, ru) ? h - 1.4 : h)); ctx.painter.poly(ru, '#6f7d48', 'grass');
        const mats = palisade(ctx, b, [...grow(ru, 1.2), grow(ru, 1.2)[0]], { h: 1.1, post: 2.4 });
        ctx.extras.ruinMats = mats;
    }
    // Vlad Țepeș bust (OSM n6164270296): bronze bust on a stone plinth
    const vb = d.pois.find((p) => p.id === 'n6164270296') || { x: 135.8, z: 152.1 };
    { const y = g.heightAt(vb.x, vb.z); b.box(vb.x, y, vb.z, 1.3, 1.6, 1.0, '#c9c2b4', 'stone'); b.box(vb.x, y + 1.6, vb.z, 1.1, 0.2, 0.85, '#d6cfc0', 'stone'); b.sphere(vb.x, y + 2.25, vb.z, 0.55, 0.38, 0.4, '#3d3426', 'bronze', 12, 8); b.sphere(vb.x, y + 2.75, vb.z, 0.24, 0.3, 0.27, '#3d3426', 'bronze', 12, 9); b.cyl(vb.x, y + 2.95, vb.z, 0.26, 0.2, '#3a3122', 'bronze', 10, 0.8); b.box(vb.x, y + 2.62, vb.z + 0.24, 0.3, 0.12, 0.08, '#3a3122', 'bronze'); ctx.circle(vb.x, vb.z, 0.75, 2); }
    // the church (Buna Vestire / Sf. Anton, 1559): bands of red brick and white plaster, blind arcades, grey tower roof
    const ch = d.buildings.find((x) => x.id === 'w150803286');
    let church = null;
    if (ch) { ctx.skipBuildings.add(ch.id);
        const p = ch.poly, y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.2, o = obb(p);
        const fac = classicFacade('curtea-veche-church', [{ t: 'arch', w: 0.2, top: 0.36, cornice: false }, { t: 'niches', n: 3, top: 0.2, bottom: 0.3 }, { t: 'blank', cornice: false }, { t: 'blank' }], { bay: 2.6, floor: 3.4, stripes: { brick: '#9e4b33', band: '#ede6d6' }, lit: 0.2 });
        classicWalls(b, fac, p, y, y + 8.6, '#ffffff', y);
        b.prism(grow(p, 0.5), y + 8.4, y + 8.8, '#ede6d6', 'stone', { noTop: true });
        b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.25, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'metal', M(o.cx, y + 10.2, o.cz, 0, -o.angle, 0, o.len + 1, 2.8, o.wid + 1), '#5c5f60');
        const tx = o.cx - o.ux * o.len * 0.12, tz = o.cz - o.uz * o.len * 0.12, tw = 4.4;
        b.add(wallGeometry([[tx - tw / 2, tz - tw / 2], [tx + tw / 2, tz - tw / 2], [tx + tw / 2, tz + tw / 2], [tx - tw / 2, tz + tw / 2]], y + 8.8, y + 15, fac.S, y, '#ffffff'), fac.key, null, '#ffffff');
        b.add(new THREE.ConeGeometry(tw * 0.78, 6.5, 8), 'metal', M(tx, y + 18.2, tz), '#5c5f60'); b.box(tx, y + 21.4, tz, 0.15, 1.8, 0.15, '#c9a24e', 'bronze'); b.box(tx, y + 22.6, tz, 0.9, 0.12, 0.12, '#c9a24e', 'bronze');
        ctx.poly(p, { y0: y - 1, y1: y + 22 });
        church = { x: o.cx, z: o.cz, fac, tower:{x:tx,z:tz,y:y+18.2} };
    }
    ctx.add(b.build('curtea-veche', { matOverrides: { ...(church ? { [church.fac.key]: church.fac.mat } : {}), ...(ctx.extras.ruinMats || {}) } }));
    return { bust: vb, church, ruinsGround };
}

// ---------------------------------------------------------------------------- Stavropoleos (1724)
function friezeTexture() {
    const c = canvas(1024, 128), x = c.getContext('2d'), r = rng(17);
    x.fillStyle = '#c99a4e'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#2b4a6b'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 118, 1024, 10);
    for (let i = 0; i < 8; i++) { const cx = 64 + i * 128; x.fillStyle = '#e8d7a8'; x.beginPath(); x.arc(cx, 64, 50, 0, 7); x.fill(); x.fillStyle = '#7a2f22'; x.beginPath(); x.arc(cx, 64, 45, 0, 7); x.fill(); x.fillStyle = '#2d4c6e'; x.beginPath(); x.arc(cx, 64, 40, 0, 7); x.fill();
        x.fillStyle = '#e5c364'; x.beginPath(); x.arc(cx, 50, 16, 0, 7); x.fill(); x.fillStyle = '#d9b48c'; x.beginPath(); x.arc(cx, 52, 10, 0, 7); x.fill(); // halo + face
        x.fillStyle = r() < 0.5 ? '#8a3324' : '#3f5f3a'; x.beginPath(); x.moveTo(cx - 22, 104); x.quadraticCurveTo(cx, 54, cx + 22, 104); x.fill();
        x.strokeStyle = '#6d4a20'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(cx + 54 + k * 2, 14); x.lineTo(cx + 54 + k * 2, 114); x.stroke(); }
        x.fillStyle = '#e8d7a8'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + 64, 20 + k * 22, 4, 0, 7); x.fill(); } }
    return canvasTexture(c, { repeat: true });
}
function porchTexture() { // the carved stone porch: five lobed (trefoil) arches on carved columns, foliate spandrels
    const c = canvas(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#d8c7a2'; x.fillRect(0, 0, 1024, 512);
    const n = 5, w = 1024 / n;
    for (let i = 0; i < n; i++) { const cx = i * w + w / 2, top = 120, bot = 512, aw = w * 0.74;
        x.fillStyle = '#2f2a24'; x.beginPath(); x.moveTo(cx - aw / 2, bot); x.lineTo(cx - aw / 2, top + 70); x.arc(cx - aw / 4, top + 70, aw / 4, Math.PI, Math.PI * 1.5); x.arc(cx, top + 30, aw / 4.2, Math.PI * 1.15, Math.PI * 1.85); x.arc(cx + aw / 4, top + 70, aw / 4, Math.PI * 1.5, 0); x.lineTo(cx + aw / 2, bot); x.fill();
        x.strokeStyle = '#a8895a'; x.lineWidth = 6; x.stroke();
        for (let k = 0; k < 7; k++) { x.fillStyle = 'rgba(120,90,50,0.35)'; x.beginPath(); x.arc(i * w + 6 + (k % 2) * 6, 30 + k * 14, 8, 0, 7); x.fill(); } }
    x.fillStyle = '#b8955a'; x.fillRect(0, 0, 1024, 18);
    return canvasTexture(c);
}
function buildStavropoleos(ctx) {
    const d = ctx.data, g = ctx.ground, ch = d.buildings.find((x) => x.id === 'w78444014'); if (!ch) return null;
    ctx.skipBuildings.add(ch.id);
    const p = ch.poly, o = obb(p), y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.1, b = new GeoBatch();
    const fac = classicFacade('stavropoleos', [{ t: 'arch', w: 0.24, top: 0.3, bottom: 0.18, cornice: false }, { t: 'niches', n: 2, cornice: false }, { t: 'blank' }, { t: 'blank' }], { bay: 2.8, floor: 2.9, lit: 0.25 });
    const WALL = '#e7d8b8';
    classicWalls(b, fac, p, y, y + 5.6, WALL, y);
    // painted frieze of saint medallions all round under the eaves
    const fm = new THREE.MeshStandardMaterial({ map: friezeTexture(), roughness: 0.8 }); fm.map.repeat.set(1, 1);
    const fz = new GeoBatch(); fz.add(wallGeometry(p, y + 5.6, y + 7.1, { bay: 1.5 / 4 * 8 / 4 * 2, floor: 1.5 / 4 }, y + 5.6, '#ffffff'), 'frieze', null, '#ffffff');
    // deep eaves + red clay-tile hipped roof
    b.prism(grow(p, 1.2), y + 7.1, y + 7.45, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.35, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'roofs', M(o.cx, y + 7.45 + 1.4, o.cz, 0, -o.angle, 0, o.len + 2.4, 2.8, o.wid + 2.4), '#8a4a33');
    // tower over the nave: octagonal drum with painted panels, tiled helmet roof, cross
    const tx = o.cx + o.ux * o.len * 0.05, tz = o.cz + o.uz * o.len * 0.05;
    const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; oct.push([tx + Math.cos(a) * 2.6, tz + Math.sin(a) * 2.6]); }
    classicWalls(b, fac, oct, y + 8.2, y + 11.0, WALL, y + 8.2);
    fz.add(wallGeometry(oct, y + 11.0, y + 12.2, { bay: 0.3, floor: 0.3 }, y + 11, '#ffffff'), 'frieze', null, '#ffffff');
    b.prism(grow(oct, 0.8), y + 12.2, y + 12.5, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'roofs', M(tx, y + 12.5, tz, 0, 0, 0, 3.0, 2.4, 3.0), '#8a4a33');
    b.cyl(tx, y + 14.9, tz, 0.3, 0.6, '#9a4a2c', 'roofs', 8, 0.6); b.box(tx, y + 15.4, tz, 0.12, 1.8, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 16.5, tz, 0.9, 0.1, 0.1, '#c9a24e', 'bronze');
    // the porch (west end): open, five lobed arches on carved columns — a carved canvas on the west face + real columns
    const wx = o.cx - o.ux * o.len / 2, wz = o.cz - o.uz * o.len / 2, wyaw = Math.atan2(-o.ux, -o.uz);
    const pm = new THREE.MeshStandardMaterial({ map: porchTexture(), roughness: 0.75 });
    const porch = new THREE.Mesh(new THREE.PlaneGeometry(o.wid * 0.98, 5.6), pm); porch.position.set(wx - o.ux * 0.08, y + 2.8, wz - o.uz * 0.08); porch.rotation.y = wyaw; ctx.add(porch);
    for (let i = 0; i <= 5; i++) { const t = -0.5 + i / 5, cx = wx - o.ux * 0.35 + (-o.uz) * t * o.wid * 0.94, cz = wz - o.uz * 0.35 + o.ux * t * o.wid * 0.94; b.cyl(cx, y, cz, 0.24, 0.5, '#cdb68a', 'stone', 8); b.cyl(cx, y + 0.5, cz, 0.17, 3.0, '#d8c7a2', 'stone', 10); b.cyl(cx, y + 3.5, cz, 0.3, 0.45, '#cdb68a', 'stone', 8, 1.4); }
    ctx.poly(p, { y0: y - 1, y1: y + 18 });
    ctx.add(fz.build('stavropoleos-frieze', { matOverrides: { frieze: fm } }));
    // courtyard wall: low stone wall, pillars with urn finials, black iron grilles (OSM: churchyard around the church)
    const yard = grow(p, 4.5), wb = new GeoBatch();
    for (let i = 0; i < yard.length; i++) { const [ax, az] = yard[i], [bx, bz] = yard[(i + 1) % yard.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const n = Math.max(1, Math.round(L / 3.2)); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, yy = g.heightAt(x, z); wb.box(x, yy, z, 0.55, 1.75, 0.55, '#d6c9ad', 'stone'); wb.cyl(x, yy + 1.75, z, 0.2, 0.25, '#cbbd9e', 'stone', 8); wb.sphere(x, yy + 2.15, z, 0.2, 0.26, 0.2, '#cbbd9e', 'stone', 6, 4); } }
    const gm = palisade(ctx, wb, [...yard, yard[0]], { h: 1.0, plinth: 0.7, post: 3.2, postCol: '#d6c9ad' });
    // entrance gap: remove nothing visually, but the gate in the north wall is drawn open (the wall collider stays: enter by the gate interaction)
    ctx.add(wb.build('stavropoleos-yard', { matOverrides: gm }));
    ctx.painter.poly(yard, '#a9a49a', 'slab');
    ctx.add(b.build('stavropoleos', { matOverrides: { [fac.key]: fac.mat } }));
    return { x: o.cx, z: o.cz, y, west: { x: wx, z: wz }, yard, o };
}

export default {
    env: { fogFar: 3000, ambientCity: 0.65, groundAlbedo: 0.15 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, spL = ctx.spot('old-town-lipscani'), spS = ctx.spot('stavropoleos-cec');
        // A short visit at real scale: Lipscani 28–71 and upper Smârdan.
        // All prepared streets/buildings remain in the 600 m scenery context.
        const focused=(x,z)=>inPoly(x,z,OLD_TOWN_FOCUS), plaque=ctx.plaque.bind(ctx), challenge=ctx.challenge.bind(ctx);
        ctx.plaque=(p,x,z,...args)=>focused(x,z)?plaque(p,x,z,...args):null;
        ctx.challenge=(id,o={})=>id==='old-town-lipscani' && focused(o.x??spL.photo.iconic.x,o.z??spL.photo.iconic.z)?challenge(id,o):null;
        // a flat old town (bare-earth grid) — smooth the DEM noise
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.35);
        // most old-town buildings have no height in OSM: 2–5 storeys (uneven skyline), lantern-lit ground floors
        for (const bd of d.buildings) if (!bd.part && !bd.h && !bd.lv && bd.k !== 'church' && bd.k !== 'roof') { const hsh = Math.abs(Math.sin(bd.poly[0][0] * 12.9898 + bd.poly[0][1] * 78.233) * 43758.5453) % 1; bd.estimatedLevels = 2 + Math.floor(hsh * 4); }
        const CA = buildCarusel(ctx), MA = buildManuc(ctx), CV = buildCurteaVeche(ctx), ST = buildStavropoleos(ctx);
        // CEC Palace + Post Palace (History Museum) from landmarks.js
        for (const [lmId, osmId] of [['cec', 'w973712798'], ['mnir', 'r19919941']]) { const bd = d.buildings.find((x) => x.id === osmId); if (!bd) continue; ctx.skipBuildings.add(osmId); const L2 = placeLandmark(ctx, lmId); for(const sourceId of L2?.lm.sourceIds||[])ctx.skipBuildings.add(sourceId);
            // r13104229 is one real relation with two prepared outer records.
            // Canonical CEC now includes both exact outer volumes and all holes.
            if(lmId==='cec')for(const sourceId of ['r13104229_0','r13104229_1'])ctx.skipBuildings.add(sourceId);
            // placeLandmark supplies exact per-solid polygons/holes/vertical
            // bands. A second filled parent body would close real courtyards.
        }
        // Caru' cu Bere (Str. Stavropoleos 5): neo-Gothic front, sign, queue
        const caruB = d.buildings.find((x) => x.id === 'w1456401783');
        if (caruB) { ctx.skipBuildings.add(caruB.id); const b = new GeoBatch(), y = Math.min(...caruB.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; const fac = classicFacade('caru', [{ t: 'arch', w: 0.36, top: 0.1, bottom: 0.06, rustic: true }, { t: 'arch2', w: 0.34, pil: true }, { t: 'arch', w: 0.26, pil: true, top: 0.3 }, { t: 'small', w: 0.24 }], { bay: 3.2, floor: 4.2, lit: 0.85 }); classicWalls(b, fac, caruB.poly, y, y + 15.5, '#c9b79a', y); b.flat(caruB.poly, y + 15.5, '#6b5f55', 'roofs'); const o = obb(caruB.poly); b.add(new THREE.ConeGeometry(4.5, 5, 4), 'roofs', M(-111, y + 18, -73.5, 0, Math.PI / 4, 0, 1, 1, 0.35), '#5a4f46'); ctx.poly(caruB.poly, { y0: y - 1, y1: y + 22 }); ctx.add(b.build('caru-cu-bere', { matOverrides: { [fac.key]: fac.mat } })); void o; }
        const OT = oldTownFronts(ctx);
        const WB = buildSecretWcpBar(ctx, CA);
        const FRONT=freddoFrontagePlan(ctx);ctx.extras.freddoFrontage=FRONT;
        // ground: shared-surface grey granite setts over every pedestrian street (no kerbs), slab bands
        ctx.terrainOpts = { bg: '#8f8b84', bgMask: 'cobble', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        bucBackdrop(ctx, { wallOpenings:FRONT?[FRONT.opening]:[],lampStyle: 'lantern', lampColor: '#191b1c', lampH: 4.4, lampPad: 15, treeLod: { cap: 1600, max: 400 }, lampOpts: { spacing: 24, kinds: ['pedestrian', 'living_street'] }, streetTreeOpts: { kinds: ['primary', 'secondary', 'tertiary'], prob: 0.5 }, style: (bd) => (OT.decoratedIds.has(bd.id) || bd.k === 'church' ? 'eclectic' : undefined) });
        oldTownGlazing(ctx,FRONT);
        for (const w of d.ways) if (['pedestrian', 'living_street'].includes(w.k) && !w.tunnel) ctx.painter.line(w.pts, 11, '#7f7c76', 'cobble');
        // the inn passages (Hanul cu Tei, Pasajul Gabroveni, Intrarea Nicolae Șelari) are paved courtyards between the façades, not lawns
        for (const w of d.ways) if (w.k === 'footway' && /Hanul cu Tei|Pasajul Gabroveni|Nicolae Șelari/.test(w.name || '')) ctx.painter.line(w.pts, 18, '#86827b', 'cobble');
        ctx.extras.caruselFloor?.();
        { const lanes = d.ways.filter((w) => w.k === 'pedestrian' && /Lipscani|Șelari|Smârdan|Gabroveni|Franceză|Stavropoleos|Covaci|Poștei|Șepcari/.test(w.name || '')); const near = (t) => lanes.some((w) => { for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / L2)); if (Math.hypot(t.x - ax - dx * u, t.z - az - dz * u) < 7) return true; } return false; }); ctx.trees = ctx.trees.filter((t) => !near(t)); }
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const w of d.ways) { if (w.k !== 'pedestrian') continue; x.strokeStyle = 'rgba(205,200,190,0.55)'; x.lineWidth = Math.max(1, 0.9 * k); x.beginPath(); w.pts.forEach(([a, c], i) => { const [px, py] = T(a, c); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); } });
        // terraces + shop signs from OSM (bars, restaurants, cafés, shops along the pedestrian lanes)
        const inside = (x, z) => Object.values(d.spots).some((s) => inPoly(x, z, s.extent.polygon));
        const TR = oldTownTerraces(ctx, { inside, seed: 3, prioritySources: ['n1416523788', 'n7613023091', 'n10775260925'],canopies:{n1416523788:{colour:'#30382f',glass:true}} });
        TR.signs=TR.signs.filter(s=>s.source!=='n1416523788');
        ctx.extras.sourceFrontages = { signs: TR.signs, terraces: TR.terraces };
        ctx.add(TR.group); ctx.lampPoints.push(...TR.lamps.filter((_, i) => i % 2 === 0));
        // Real OSM POIs, on their existing street-facing footprint. Camera-held props only:
        // no invented kiosk/interior, source footprint, terrace or collision changes.
        const VA = createVenueActivities(ctx);
        const NIGHTLIFE = buildOldTownNightlife(ctx, VA);
        for (const [source, kind, address, label] of [
            ['n1731040881', 'shaorma', 'Strada Franceză 17', 'Eat a shaorma at Dristor Kebap'],
            ['n10775253367', 'shot', 'Strada Șelari 17', 'Pour a shot at Shoteria'],
        ]) {
            const poi = d.pois.find(p => p.id === source); if (!poi) continue;
            let street = null;
            for (const w of d.ways) { if (!['pedestrian', 'living_street'].includes(w.k)) continue; const q = distPolyline(poi.x, poi.z, w.pts); if (!street || q.d < street.d) street = q; }
            const f = street && facadeToward(d, poi.x, poi.z, street.cx, street.cz); if (!f) continue;
            // Find the clear street approach beyond existing terrace collision, without
            // changing any footprint or moving its furniture. Both sources face Șelari.
            let approach = null;
            for (let distance = 5.2; distance <= 8; distance += .4) {
                const x = f.x + f.nx * distance, z = f.z + f.nz * distance;
                if (!collide(ctx.colliders, x, z, .45, g.heightAt(x, z) + .3)) { approach = { x, z }; break; }
            }
            if (!approach) continue;
            const { x, z } = approach;
            ctx.interactables.push({ x, z, y: g.heightAt(x, z), r: 2.6, label, source,
                cond: s => !VA.active && s.spot.id === 'old-town-lipscani',
                use: s => VA.start(s, kind, { name: poi.name, address }) });
        }
        const signs = [...TR.signs];
        if (caruB) signs.push({ x: -111, y: g.heightAt(-111, -71.5) + 5.4, z: -71.4, yaw: 0, w: 6.2, h: 1.0, text: "CARU' CU BERE", bg: '#2a1d14', fg: '#e8c870', font: (q) => `700 ${q}px "Times New Roman", serif` });
        // Hanul cu Tei (Lipscani 63–65 → Blănari 14, 1833): the arched gateways of the inn's passage, painted lettering over the arch
        { const blds = d.buildings.filter((x) => !x.part).map((x) => ({ p: x.poly, bb: polyBox(x.poly) })), hb = new GeoBatch();
          for (const [px, pz, sz] of [[208.2, -56, -1], [212.8, -127, 1]]) {
            const A = rayFacade(blds, px, pz, 1, 0, 6), B = rayFacade(blds, px, pz, -1, 0, 6); if (!A || !B) continue;
            const y = g.heightAt(px, pz), x0 = B.x, x1 = A.x, w = x1 - x0, cxm = (x0 + x1) / 2, zf = pz + sz * 0.4, rr = w / 2 - 0.35;
            for (const xx of [x0 + 0.2, x1 - 0.2]) hb.box(xx, y - 0.2, zf, 0.7, 3.4, 0.9, '#efe6d2', 'stone');
            const arch = new THREE.TorusGeometry(rr, 0.32, 6, 16, Math.PI); hb.add(arch, 'stone', M(cxm, y + 3.2, zf), '#efe6d2'); arch.dispose();
            hb.box(cxm, y + 3.2 + rr, zf, w + 0.6, 1.5, 0.9, '#efe6d2', 'stone'); hb.box(cxm, y + 4.7 + rr, zf, w + 1.0, 0.25, 1.1, '#f6f1e6', 'stone');
            signs.push({ x: cxm, y: y + 3.95 + rr, z: zf + sz * 0.47, yaw: sz < 0 ? Math.PI : 0, w: Math.min(w + 0.2, 4.6), h: 0.62, text: 'HANUL CU TEI', bg: '#efe6d2', fg: '#3b2a1e', border: false, font: (q) => `700 ${q}px Georgia, serif` });
            ctx.lampPoints.push({ x: cxm, z: zf, h: 3.0, noPost: true });
          }
          ctx.add(hb.build('hanul-cu-tei')); }
        const SA = signAtlas(signs.slice(0, 96), { name: 'shop-signs' }); if (SA) ctx.add(SA);
        // festoon string lights strung between façade brackets (note 25: replaces the loose overhead cables)
        festoons(ctx, OT.ways);
        cityFiller(ctx, { ring: 600 });
        // plaques
        const PL = spL.plaques, PS = spS.plaques, gy = (x, z) => g.heightAt(x, z);
        if (CA) { const f = CA.front; ctx.plaque(PL[5], f.x + f.nz * 9.5 + f.nx * 1.2, f.z - f.nx * 9.5 + f.nz * 1.2, f.yaw, { style: 'city', credit: '2015 refit: architects Square One (Ana Petrescu & Ramona Iliescu); the 1860s building restored by the Cărturești chain.' }); }
        ctx.plaque(PL[0], 108, -58, Math.PI, { style: 'city' }); ctx.plaque(PL[1], 76, -40, -Math.PI / 2, { style: 'city' });
        if (MA) ctx.plaque(PL[2], MA.gate.x + MA.gn.x * 1.6 - MA.gn.z * 4.2, MA.gate.z + MA.gn.z * 1.6 + MA.gn.x * 4.2, Math.atan2(MA.gn.x, MA.gn.z), { style: 'city' });
        ctx.plaque(PL[3], CV.bust.x + 2.2, CV.bust.z - 1.6, Math.PI, { style: 'bronze' });
        if (CV.church) ctx.plaque(PL[4], CV.church.x - 14, CV.church.z - 4, -Math.PI / 2, { style: 'city' });
        if (ST) { ctx.plaque(PS[0], ST.west.x - 6.5, -64.5 + 3.5, Math.PI, { style: 'bronze' }); ctx.plaque(PS[1], ST.x + 9, -66.5, Math.PI, { style: 'bronze' }); }
        if (caruB) ctx.plaque(PS[2], -104, -67.5, Math.PI, { style: 'city' });
        ctx.plaque(PS[3], -212, -82, -Math.PI / 2, { style: 'city', credit: 'Architect Paul Gottereau (1897–1900).' });
        ctx.plaque(PS[4], -212, -32, -Math.PI / 2, { style: 'city', credit: 'Post Palace (1894–1900), architect Alexandru Săvulescu.' });
        // Public outdoor details require actual look/capture inputs. An exterior
        // source footprint does not establish present-day access to the ruins.
        if(CV.church){const ru=d.buildings.find(b=>b.id==='w658220894'),edge=ru?distPolyline(CV.bust.x+4,CV.bust.z+4,[...ru.poly,ru.poly[0]]):null;
            const targets=[{label:'Vlad III bust',x:CV.bust.x,y:gy(CV.bust.x,CV.bust.z)+2.65,z:CV.bust.z,radius:.4},
                {label:'Old Court church tower',...CV.church.tower,radius:1.6,surfaceTolerance:4}];
            if(edge)targets.push({label:'Old Court brick remains',x:edge.cx,y:CV.ruinsGround+1.2,z:edge.cz,radius:1.2});
            ctx.extras.curteaVecheVisit=photoHunt(ctx,{x:CV.bust.x+4,z:CV.bust.z+4,title:'Frame the Old Court details',targets,
                unavailable:'Explore these historic details from the public street. Current access inside the excavations has not been verified.',
                onDone:s=>bucActivity(s,'old-town-lipscani','curtea-veche','🏛 Old Court details framed','You framed the bust, church and mapped court remains from outside. This does not claim admission inside the excavations.')});}
        if (ST) {const candle=candleLight(ctx,new THREE.Vector3(),{title:'A virtual candle at Stavropoleos',portable:true,focus:new THREE.Vector3(ST.x,gy(ST.x,ST.z)+6,ST.z),
            onDone:s=>bucActivity(s,'stavropoleos-cec','stavropoleos','🕯 Candle practice completed','You lit and placed a temporary virtual candle in a handheld holder. This does not locate a real rack or imply current interior access.')});
            ctx.extras.stavropoleosCandle=candle;
            ctx.interactables.push({kind:'candle',x:ST.west.x-3.5,z:-64.5+1.2,r:2.4,label:'Light and place a virtual candle',use:s=>candle.start(s)});}
        if (CA) ctx.challenge('old-town-lipscani', { x: CA.ecx + (CA.front.x - CA.ecx) * 0.75, z: CA.ecz + (CA.front.z - CA.ecz) * 0.75, heading: (Math.atan2(CA.ecx - CA.front.x, -(CA.ecz - CA.front.z)) * 180 / Math.PI + 360) % 360, r: 6, tol: 40, text: 'Cărturești Carusel: the white atrium and its stacked balconies (best from the level-2 balcony)' });
        if (MA) ctx.challenge('old-town-lipscani', { x: MA.gate.x + MA.gn.x * 14, z: MA.gate.z + MA.gn.z * 14, heading: (Math.atan2(-MA.gn.x, MA.gn.z) * 180 / Math.PI + 360) % 360, r: 7, tol: 30, text: "Hanul lui Manuc's gate on Str. Franceză" });
        ctx.challenge('stavropoleos-cec', { view: ST ? [ST.x, ST.z] : null, r: 7, tol: 30 });
        // crowd: busy lanes, waiters at every terrace, a tour at Stavropoleos, the Caru' cu Bere queue
        const groups = [...WB.groups];
        // waiters at the terraces nearest the arrival points, turned toward their tables (talking, not standing stiff)
        const SP0 = { x: 128, z: -56.5 }, dist0 = (q) => Math.min(Math.hypot(q.x - SP0.x, q.z - SP0.z), Math.hypot(q.x + 92, q.z + 67.5));
        [...TR.terraces].sort((a, b) => dist0(a) - dist0(b)).slice(0, 16).forEach((t) => { groups.push({ x: t.x + Math.sin(t.yaw) * (t.depth / 2 + 0.5), z: t.z + Math.cos(t.yaw) * (t.depth / 2 + 0.5), r: 0.2, n: 1, act: 'talk', yaw: t.yaw + Math.PI, personas: ['waiter'] }); });
        // sitters: the terraces near the arrival points are busy (≈ 2 of 3 seats taken), one person per seat, facing the table
        [...TR.seats].sort((a, b) => dist0(a) - dist0(b)).slice(0, 130).forEach((q, i) => { if (i % 3 !== 2) groups.push({ x: q.x, z: q.z, r: 0.01, n: 1, act: 'sit', yaw: q.yaw, y: q.y, fixedYaw: true, personas: ['local_young', 'tourist_uk', 'tourist_it', 'tourist_us', 'local_parent', 'local_elder'] }); });
        if (ST) groups.push({ x: ST.x + 4, z: -67.5, r: 2.6, n: 8, act: 'photo', look: [ST.x, ST.z], personas: ['tourist_de', 'tourist_fr', 'tourist_us'] }, { x: ST.x + 8.5, z: -66.5, r: 0.3, n: 1, act: 'guide', look: [ST.x + 4, -67.5], personas: ['tour_guide'] });
        if (caruB) groups.push({ line: [[-111, -70.2], [-105, -69.6], [-99, -69.2], [-93, -68.8]], n: 9, act: 'queue', personas: ['tourist_de', 'tourist_us', 'local_young', 'tourist_fr', 'tourist_uk'] });
        if (CA) groups.push({ x: CA.front.x + CA.front.nx * 4, z: CA.front.z + CA.front.nz * 4, r: 2.5, n: 5, act: 'photo', look: [CA.front.x, CA.front.z], personas: ['tourist_it', 'tourist_us', 'local_young'] }, { x: CA.ecx, z: CA.ecz, r: 3, n: 5, act: 'watch', personas: ['local_young', 'tourist_uk', 'tourist_fr'] });
        groups.push({ x: CV.bust.x - 3, z: CV.bust.z - 3.5, r: 0.3, n: 1, act: 'watch', personas: ['vendor'] }, { x: CV.bust.x + 2, z: CV.bust.z - 4, r: 2, n: 4, act: 'photo', look: [CV.bust.x, CV.bust.z], personas: ['tourist_uk', 'tourist_it', 'tourist_us'] });
        groups.push({ x: 60, z: -66, r: 0.3, n: 1, act: 'perform', personas: ['busker'], prop: 'guitar' }, { x: 62, z: -62, r: 2.5, n: 4, act: 'watch', look: [60, -66], personas: ['local_young', 'tourist_uk'] });
        if (MA) groups.push({ x: MA.gate.x + MA.gn.x * 2.5 + MA.gn.z * 2.6, z: MA.gate.z + MA.gn.z * 2.5 - MA.gn.x * 2.6, r: 0.3, n: 1, act: 'watch', yaw: Math.atan2(MA.gn.x, MA.gn.z), personas: ['waiter'] });
        // Keep the native street crowd concentrated on the selected source ways.
        // Path points are unscaled source points; splitting the walking itinerary
        // does not alter or delete a road in the prepared dataset.
        const paths=[];
        for(const way of d.ways.filter(w=>['pedestrian','footway','living_street'].includes(w.k))){let run=[];for(const p of way.pts){if(focused(...p))run.push(p);else{if(run.length>1)paths.push(run);run=[];}}if(run.length>1)paths.push(run);}
        const party=[];
        for(const path of paths)for(let i=1;i<path.length;i++){const [ax,az]=path[i-1],[bx,bz]=path[i],L=Math.hypot(bx-ax,bz-az);if(L<1)continue;
            for(let u=1;u<L;u+=4.5)for(const side of [-1,1]){const x=ax+(bx-ax)*u/L+(bz-az)/L*side*2.1,z=az+(bz-az)*u/L-(bx-ax)/L*side*2.1;
                if(party.length>=64||!focused(x,z)||collide(ctx.colliders,x,z,.45,g.heightAt(x,z)+.3)||party.some(p=>Math.hypot(p.x-x,p.z-z)<1.1)||NIGHTLIFE&&Math.hypot(x-NIGHTLIFE.entry.x,z-NIGHTLIFE.entry.z)<2.2)continue;
                party.push({x,z,r:0,n:1,act:'talk',party:true,fixedYaw:true,personas:['local_young','tourist_uk','tourist_it','tourist_us']});}}
        ctx.crowdCfg = {
            spots: ['old-town-lipscani', 'stavropoleos-cec'],
            personas: { local_young: 4, tourist_uk: 2.5, tourist_it: 1.8, tourist_us: 1.8, tourist_de: 1.5, tourist_fr: 1.2, local_elder: 1, local_parent: 0.8, kid: 0.4 },
            walkers: 92, paths, groups:groups.filter(q=>q.wcpFan||focused(q.x??q.line?.[0]?.[0],q.z??q.line?.[0]?.[1])).concat(party),
        };
        let partyPeople=null;
        ctx.onUpdate((dt,s)=>{if(!partyPeople&&s.spot.crowd?.cr)partyPeople=s.spot.crowd.peds.map((p,i)=>({p,i})).filter(({p})=>p.group?.party);
            if(!partyPeople||!nightlifeHours(s.spot.crowd.cond?.hour??12).party)return;
            for(const {p,i} of partyPeople){const phase=s.t*Math.PI*2.1+p.phase;s.spot.crowd.cr.set(i,{x:p.x,y:p.y+Math.max(0,Math.sin(phase))*.035,z:p.z,yaw:p.yaw+Math.sin(phase*.5)*.16,phase,scale:p.look.scale,amp:.45,pose:i%3?'talk':'cheer',prop:null});}});
        ctx.interactables=ctx.interactables.filter(it=>it.hidden||focused(it.x,it.z)||it.x>7000);
        // ambience
        ctx.sound('crowd', 120, -60, 60, 1); ctx.sound('crowd', 200, 120, 50, 0.8); ctx.sound('crowd', -60, -66, 40, 0.6);
        ctx.sound('bell', CV.church?.x ?? 205, CV.church?.z ?? 134, 260, 0.45); ctx.sound('traffic', -240, -60, 120, 0.7); ctx.sound('traffic', 300, 0, 120, 0.5);
        // spawns
        ctx.spawns['old-town-lipscani'] = NIGHTLIFE ? { x:NIGHTLIFE.entry.x+3,z:NIGHTLIFE.entry.z+2.5,heading:headingFromBearing(300) } : { x:128,z:-56.5,heading:headingFromBearing(78) };
        // Legacy ID remains loadable, with the same compact arrival and saves intact.
        ctx.spawns['stavropoleos-cec'] = { ...ctx.spawns['old-town-lipscani'] };
        ctx.extras.walkBoundary=walkBoundary(()=>[OLD_TOWN_FOCUS,
            ...(NIGHTLIFE?.room.visible?[NIGHTLIFE.polygon]:[]),
            ...(ctx.extras.wcpRoom?.room.visible?[[[7994.2,7999.5],[8005.8,7999.5],[8005.8,8011],[7994.2,8011]]]:[])]);
        ctx.extras.visitExits=markVisitExits(ctx,OLD_TOWN_FOCUS);
        void balustradeMaterial; void fitDraw;
    },
};
