// ============================================================================
//  Dealul Arsenalului (Bucharest): the Palace of the Parliament seen from
//  Piața Constituției (spot `palace-parliament`) and the People's Salvation
//  Cathedral on its piazza behind it (spot `peoples-salvation-cathedral`).
//
//  Palace (Anca Petrescu & team, 1984–97): modelled from the OSM building and
//  its parts (outer wings 29 m, tier ring 58 m, central block 86 m; rel 2230391,
//  ways 283976783 / 232360843) — main front to the EAST on the Bd. Unirii axis:
//  arcaded rusticated base, tiers of arched windows between paired pilasters,
//  balustraded terraces, the central portico with the balcony, terraced front
//  gardens with retaining walls, conical thujas and the flower parterre, three
//  flags (EU · RO · NATO). Romania has no freedom of panorama: everything is
//  modelled (canvas façade tiles drawn procedurally), no photo textures.
//  Square: granite setts used as a car park, the curved 9-storey ministry blocks
//  (arcaded ground floor, loggia top storey), the first Bd. Unirii fountains,
//  the "București 1459" clock, boulevard candelabras. Cathedral: landmarks.js
//  model (bCathedral, read-only import) on its granite piazza with the candle
//  pavilion; Calea 13 Septembrie blocks behind.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { candleLight } from '../candle-light.js';
import { photoHunt } from '../photo-hunt.js';
import { activityBlocked } from '../participation.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, offsetPolyline, distPolyline, canvas, canvasTexture, fitDraw, obb } from '../kit.js';
import { clockFace } from '../props.js';
import { bucBackdrop, classicFacade, classicWalls, balustrade, balustradeMaterial, flagpole, palisade, hedge, osmPoly, cityFiller, placeLandmark, bucActivity } from '../buc.js';
import { addTraffic } from '../cars.js';

const CREAM = '#d9ccb2', CREAM2 = '#e3d8c2', ROOF = '#bdb6a7';
/** x of a roughly N–S polyline at z (null outside its z range) */
function xAtZ(pts, z) { for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; if ((az - z) * (bz - z) <= 0 && az !== bz) return ax + (bx - ax) * (z - az) / (bz - az); } return null; }
/** closed polygon grown outward by d metres */
function grow(poly, d) { const cw = poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + (q[0] - p[0]) * (q[1] + p[1]); }, 0) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }

function palaceGround(ctx) {
    const d = ctx.data, g = ctx.ground;
    const wall = d.ways.find((w) => w.id === 'w94522653_b')?.pts || [];
    const front = wall.filter(([x, z]) => x > -30 && Math.abs(z) < 300);
    const ret = (id, fb) => d.ways.find((w) => w.id === id)?.pts || [[fb, -300], [fb, 300]];
    const w89 = ret('w1444650053', -89), w49 = ret('w1444650060', -49), w13 = ret('w1444650056', -13);
    const YP = 6.2; // palace platform above the square
    const at = (pts, z, fb) => xAtZ(pts, z) ?? fb;
    // note 20: the esplanade outside the fence is flat paved ground at the level of Piața Constituției (no DEM dip
    // between the fence plinth and the square); the first lawn terrace behind the low plinth sits just above it
    const SQY = (x) => 0.2 - Math.max(0, x - 28) * 0.004;
    const terrace = (x, z) => {
        const xf = at(front, z, 20); if (x > xf) return null;
        if (x > at(w13, z, -13)) return 0.8; if (x > at(w49, z, -49)) return 2.9; if (x > at(w89, z, -89)) return 4.5; return YP;
    };
    g.mod((x, z, h) => {
        if (z < -330 || z > 300 || x < -470 || x > 40) return h;
        const t = terrace(x, z); if (t === null) return h;
        if (x < -400) { const k = (x + 470) / 70; return h + (YP - h) * Math.max(0, Math.min(1, k)); }
        return t + 0.0;
    });
    // the square, the ring road, the sidewalk along the fence and the head of Bd. Unirii: one flat plane, gently falling east
    g.mod((x, z, h) => {
        if (x >= 330 || z <= -330 || z >= 330) return h;
        if (x > 28) return SQY(x);
        const xf = xAtZ(front, z); // outside the fence line (toward the square) → square level
        if (xf !== null && x > xf - 0.2) return SQY(x);
        if (xf === null && x > -40 && (z < -295 || z > 285)) return h + (SQY(x) - h) * Math.max(0, Math.min(1, (x + 40) / 40)); // past the fence ends
        return h;
    });
    return { YP, w89, w49, w13, front, wall, terrace };
}

/**
 * note 61 / owner: modelled bays on top of the façade tiles — per storey a projecting cornice band, per bay edge a pair of
 * pilasters, per bay a window surround (jambs, head with keystone / pediment, sill) aligned with the tile's bays (wallGeometry
 * fits a whole number of bays per wall, so bay k of an edge is centred at (k + 0.5) · L / n).
 */
function modelledBays(b, poly, y0, nStoreys, floorH, bay, col, { winW = 0.34, arch = [] } = {}) {
    const p = polyArea2(poly) > 0 ? poly : [...poly].reverse(); // same orientation as wallGeometry (positive kit polyArea)
    const light = '#f1ebdd', shade = '#cfc4ae';
    for (let i = 0; i < p.length; i++) {
        const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az); if (L < bay * 0.8) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, yaw = Math.atan2(ux, uz), n = Math.max(1, Math.round(L / bay)), bw = L / n;
        const at = (u, d) => [ax + ux * u + nx * d, az + uz * u + nz * d];
        for (let f = 0; f < nStoreys; f++) {
            const yb = y0 + f * floorH, yt = yb + floorH;
            { const [cx, cz] = at(L / 2, 0.22); b.box(cx, yt - 0.6, cz, 0.44, 0.55, L + 0.4 + (i % 2) * 0.06, light, 'stone', yaw); b.box(cx, yt - 0.8, cz, 0.3, 0.2, L + 0.3 + (i % 2) * 0.06, shade, 'stone', yaw); } // storey cornice band
            for (let k = 0; k < n; k++) {
                for (const s of [-1, 1]) { const [px, pz] = at(k * bw + s * 0.42, 0.16); if (k === 0 && s < 0) continue; b.box(px, yb + 0.1, pz, 0.32, floorH - 0.85, 0.42, light, 'stone', yaw); } // pilaster pair at the bay edge
                const uc = (k + 0.5) * bw, ww = bw * winW + 0.5, wb = yb + floorH * 0.24, wt = yb + floorH * 0.72;
                const [jx0, jz0] = at(uc - ww / 2, 0.12), [jx1, jz1] = at(uc + ww / 2, 0.12), [hx, hz] = at(uc, 0.14), [sx, sz] = at(uc, 0.16);
                b.box(jx0, wb, jz0, 0.24, wt - wb, 0.22, light, 'stone', yaw); b.box(jx1, wb, jz1, 0.24, wt - wb, 0.22, light, 'stone', yaw);
                b.box(sx, wb - 0.16, sz, 0.32, 0.16, ww + 0.5, light, 'stone', yaw); // sill
                if (arch.includes(f)) b.box(hx, wt, hz, 0.3, 0.42, 0.42, light, 'stone', yaw); // keystone of the arched storeys
                else { b.box(hx, wt, hz, 0.28, 0.22, ww + 0.4, light, 'stone', yaw); b.box(hx, wt + 0.22, hz, 0.36, 0.14, ww + 0.7, light, 'stone', yaw); } // lintel + projecting hood
            }
        }
    }
}
function buildPalace(ctx, G) {
    const d = ctx.data, b = new GeoBatch(), YP = G.YP;
    const outerB = d.buildings.find((x) => x.id === 'r2230391'), tier = osmPoly(d, 'w283976783'), cen = osmPoly(d, 'w232360843');
    for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.id === 'r2230391' || (inPoly(cx, cz, outerB.poly) && x.part)) ctx.skipBuildings.add(x.id); }
    const outer = outerB.poly;
    const flood = '#ffcf94';
    const fWing = classicFacade('palace-wing', [
        { t: 'arcade', rustic: true, pil: 'pair', w: 0.48 }, { t: 'arch', pil: 'pair', rail: true, w: 0.34, top: 0.28 },
        { t: 'pediment', pil: 'pair', w: 0.32, top: 0.34 }, { t: 'arch', pil: 'pair', w: 0.3, top: 0.32, dentils: true },
    ], { bay: 6.2, floor: 26.5 / 4, flood, floodK: 1.05, lit: 0.15 });
    const fTier = classicFacade('palace-tier', [
        { t: 'arch', pil: 'pair', w: 0.34, top: 0.26 }, { t: 'rect', pil: 'pair', w: 0.3, top: 0.32 },
        { t: 'arch', pil: 'pair', w: 0.32, rail: true, top: 0.28 }, { t: 'small', pil: 'pair', w: 0.28, top: 0.36, dentils: true },
    ], { bay: 5.6, floor: 28 / 4, flood, floodK: 1.05, lit: 0.15 });
    const fTop = classicFacade('palace-top', [
        { t: 'arch2', pil: 'pair', w: 0.38 }, { t: 'rect', pil: 'pair', w: 0.3, top: 0.3 },
        { t: 'arch', pil: 'pair', w: 0.34, top: 0.26 }, { t: 'arch', pil: 'pair', w: 0.3, top: 0.3, dentils: true },
    ], { bay: 5.2, floor: 27 / 4, flood, floodK: 1.05, lit: 0.15 });
    const y1 = YP + 26.5, y2 = y1 + 28, y3 = y2 + 27;
    // plinth / terrace the palace stands on (stone, slightly larger than the footprint)
    b.prism(grow(outer, 4), YP - 3, YP + 0.6, '#cfc5b2', 'stone');
    classicWalls(b, fWing, outer, YP + 0.6, y1, CREAM, YP + 0.6);
    b.prism(grow(outer, 0.9), y1 - 0.9, y1, CREAM2, 'stone', { noTop: true });
    b.flat(outer, y1, ROOF, 'roofs');
    balustrade(b, grow(outer, 0.5), y1, 1.15, { closed: true, colour: '#efe8da' });
    classicWalls(b, fTier, tier, y1, y2, CREAM, y1);
    b.prism(grow(tier, 0.8), y2 - 0.8, y2, CREAM2, 'stone', { noTop: true });
    b.flat(tier, y2, ROOF, 'roofs');
    balustrade(b, grow(tier, 0.45), y2, 1.15, { closed: true, colour: '#efe8da' });
    classicWalls(b, fTop, cen, y2, y3, CREAM, y2);
    b.prism(grow(cen, 0.9), y3 - 1.1, y3, CREAM2, 'stone', { noTop: true });
    b.flat(cen, y3, ROOF, 'roofs');
    balustrade(b, grow(cen, 0.5), y3, 1.2, { closed: true, colour: '#efe8da' });
    modelledBays(b, outer, YP + 0.6, 4, (y1 - YP - 0.6) / 4, 6.2, CREAM, { arch: [0, 1, 3] });
    modelledBays(b, tier, y1, 4, 7, 5.6, CREAM, { arch: [0, 2] });
    modelledBays(b, cen, y2, 4, 6.75, 5.2, CREAM, { arch: [0, 2, 3] });
    // roof pavilion on the central block + its flagpole
    const [ccx, ccz] = centroid(cen);
    b.box(ccx, y3, ccz, 12, 3.2, 26, CREAM, 'stone'); b.box(ccx, y3 + 3.2, ccz, 13, 0.6, 27, CREAM2, 'stone');
    const roofFlag = flagpole(ccx, y3 + 3.8, ccz, 9, 'ro', { yaw: Math.PI * 0.9 }); ctx.add(roofFlag.group);
    // corner piers of the central block (paired giant pilasters seen from the square)
    for (const [x, z] of cen) b.box(x, y2, z, 2.2, y3 - y2 + 0.35, 2.2, CREAM2, 'stone');
    // ---- the east portico with the balcony (main entrance on the Bd. Unirii axis; OSM steps w178305826)
    const ax = -160, az = -10.5, PW = 54, PD = 15, py = YP + 4.2;
    b.box(ax + PD / 2, YP - 0.2, az, PD, 4.4, PW, '#d3c9b6', 'stone');                       // podium
    for (let i = 0; i < 14; i++) b.box(ax + PD + 0.4 + i * 0.42, YP - 0.2, az, 0.42, 4.4 - i * 0.31, PW * 0.62, '#d8cfbd', 'stone'); // ceremonial stair
    const colX = ax + PD - 1.6, colH = 13.5;
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { // six pairs of giant columns
        const z = az + (i - 2.5) * 8.6 + s * 1.15;
        b.cyl(colX, py, z, 0.95, 1.0, '#e9e2d3', 'stone', 12); b.cyl(colX, py + 1, z, 0.78, colH - 2.2, '#efe9dc', 'stone', 16, 0.9);
        b.box(colX, py + colH - 1.2, z, 2.1, 1.2, 2.1, '#e4dccb', 'stone');
        ctx.circle(colX, z, 0.9, 14, { y: py });
    }
    b.box(ax + PD / 2 + 0.6, py + colH, az, PD + 1.2, 2.6, PW + 2, '#e6dece', 'stone');         // entablature / balcony slab
    b.box(ax + PD / 2 + 0.6, py + colH + 2.6, az, PD + 2, 0.5, PW + 3, '#f0eadf', 'stone');
    balustrade(b, [[ax + PD + 1.4, az - PW / 2 - 1.2], [ax + PD + 1.4, az + PW / 2 + 1.2]], py + colH + 3.1, 1.2, { colour: '#f4efe5' });
    // recessed doors behind the colonnade (dark bronze) + arcade wall
    for (let i = 0; i < 5; i++) b.box(ax + 0.3, py, az + (i - 2) * 8.6, 0.4, 7.5, 4.2, '#3b342b', 'paint');
    ctx.box(ax + PD / 2, az, PD / 2, PW / 2, 0, { y0: YP - 1, y1: py + 20 });
    // side ramps (driveway up to the portico)
    // collisions: palace footprint
    ctx.poly(outer, { y0: YP - 5, y1: y3 + 10 });
    ctx.add(b.build('palace', { matOverrides: { [fWing.key]: fWing.mat, [fTier.key]: fTier.mat, [fTop.key]: fTop.mat, balustrade: balustradeMaterial() } }));
    return { outer, y3, roofFlag, portico: { x: ax + PD, z: az, y: py } };
}

/** front gardens: retaining walls, the forecourt drive, flower parterre, hedges, flags, fence along Bd. Libertății */
function buildGardens(ctx, G, P) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    for (const [pts, hi] of [[G.w89, 6.3], [G.w49, 4.6], [G.w13, 3.0]]) for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2, a = Math.atan2(bx - ax, bz - az), yt = g.heightAt(cx - 1.2, cz);
        b.box(cx, yt - 3.2, cz, 0.7, 3.2 + 0.55, L + 0.15, '#d6ccb9', 'stone', a); void hi;
    }
    // forecourt drive loop (asphalt) + parterre in its centre
    const loop = d.ways.find((w) => w.id === 'w178305821')?.pts;
    if (loop) ctx.painter.line(loop, 7, '#7d7a74', 'asphalt');
    const parterre = osmPoly(d, 'w1444641325');
    if (parterre) {
        ctx.painter.poly(parterre, '#5f8240', 'grass');
        const [cx, cz] = centroid(parterre), bb = polyBox(parterre), hw = (bb.z1 - bb.z0) * 0.42, hd = (bb.x1 - bb.x0) * 0.32;
        ctx.painter.custom((x, T, k, isMask) => { // the "embroidered" parterre: lobes of red / gold / violet flowers edged in white
            if (isMask) return;
            const lobes = [[-0.62, '#c8323a'], [-0.31, '#d9b13a'], [0, '#c8323a'], [0.31, '#d9b13a'], [0.62, '#c8323a']];
            for (const [u, col] of lobes) {
                const [px, py] = T(cx, cz + u * hw * 1.55); const rz = hw * (u === 0 ? 0.36 : 0.27), rx = hd * 0.9;
                x.fillStyle = '#f2ecd9'; x.beginPath(); x.ellipse(px, py, (rx + 0.6) * k, (rz + 0.6) * k, 0, 0, 7); x.fill();
                x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx * k, rz * k, 0, 0, 7); x.fill();
                const r = rng(Math.round(u * 100) + 7); for (let q = 0; q < 180; q++) { const a = r() * 6.28, rr = Math.sqrt(r()); x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'; x.fillRect(px + Math.cos(a) * rx * rr * k, py + Math.sin(a) * rz * rr * k, Math.max(1, 0.2 * k), Math.max(1, 0.2 * k)); }
            }
        });
    }
    // floodlight projectors on the lawns (the palace is floodlit at night)
    for (const z of [-60, -30, 10, 40, 80]) { const x = -120, y = g.heightAt(x, z); b.box(x, y, z, 1.6, 0.4, 1.6, '#cfc8bb', 'stone'); for (let i = 0; i < 3; i++) b.cyl(x - 0.5 + i * 0.5, y + 0.4, z, 0.16, 0.3, '#2a2d30', 'metal', 8); }
    // hedges (OSM) near the front
    for (const w of d.ways) if (w.barrier === 'hedge' || w.k === 'hedge') { if (w.pts.some(([x, z]) => x > -200 && x < 40 && Math.abs(z) < 300)) hedge(ctx, b, w.pts, { h: 1.0, w: 0.8, colour: '#3a5a2c' }); }
    // three flags on the lawn facing the boulevard (EU · RO · NATO)
    const flags = [];
    for (const [z, k] of [[-31, 'eu'], [-10.5, 'ro'], [10, 'nato']]) { const x = -24, f = flagpole(x, g.heightAt(x, z), z, 26, k, { yaw: Math.PI * 0.85 }); ctx.add(f.group); flags.push(f); ctx.circle(x, z, 0.3, 26); }
    // the grounds' wall: stone plinth + iron palisade along Bd. Libertății (and around the park)
    const mats = palisade(ctx, b, G.wall, { h: 1.9, plinth: 0.6, post: 4.5 });
    ctx.add(b.build('palace-gardens', { matOverrides: { ...mats } }));
    return { flags };
}

/** the two curved 9-storey government blocks wrapping the square (arcaded ground floor, loggia on the top storey) */
function buildMinistries(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const fGF = classicFacade('min-arcade', [{ t: 'arcade', rustic: true, w: 0.56 }, { t: 'arcade', rustic: true, w: 0.56 }, { t: 'arcade', w: 0.56 }, { t: 'arcade', w: 0.56 }], { bay: 4.6, floor: 6.4, lit: 0.6 });
    const fMid = classicFacade('min-mid', [{ t: 'rect', w: 0.36, rail: true, pil: true }, { t: 'pediment', w: 0.34, top: 0.36, pil: true }, { t: 'rect', w: 0.36, pil: true }, { t: 'arch', w: 0.34, rail: true, pil: true }], { bay: 4.6, floor: 3.25, lit: 0.35 });
    const fTop = classicFacade('min-loggia', [{ t: 'loggia' }, { t: 'loggia' }, { t: 'loggia' }, { t: 'loggia' }], { bay: 4.6, floor: 3.6, lit: 0.3 });
    const blocks = [];
    for (const id of ['w41474365', 'w207162869']) {
        const bd = d.buildings.find((x) => x.id === id); if (!bd) continue; ctx.skipBuildings.add(id);
        const p = bd.poly; let y0 = 1e9; for (const [x, z] of p) y0 = Math.min(y0, g.heightAt(x, z)); y0 -= 0.3;
        const col = '#e3dccb';
        classicWalls(b, fGF, p, y0, y0 + 6.4, col, y0);
        classicWalls(b, fMid, p, y0 + 6.4, y0 + 29.4, col, y0 + 6.4);
        b.prism(grow(p, 0.6), y0 + 29.0, y0 + 29.6, '#ece6d8', 'stone', { noTop: true });
        classicWalls(b, fTop, p, y0 + 29.6, y0 + 33.2, col, y0 + 29.6);
        b.prism(grow(p, 0.9), y0 + 33.2, y0 + 34.2, '#ece6d8', 'stone', { noTop: true });
        b.flat(p, y0 + 34.2, '#a9a397', 'roofs');
        ctx.poly(p, { y0, y1: y0 + 35 });
        blocks.push(bd);
    }
    ctx.add(b.build('ministries', { matOverrides: { [fGF.key]: fGF.mat, [fMid.key]: fMid.mat, [fTop.key]: fTop.mat } }));
    return blocks;
}

/** the first Bd. Unirii fountains (basins with ceramic-tiled rims and jets) + the "București 1459" clock */
function buildSquareProps(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), jets = [];
    for (const id of ['w1177217420', 'w1177217423']) {
        const p = osmPoly(d, id); if (!p) continue; ctx.skipAreas.add(id);
        const y = Math.min(...p.map(([x, z]) => g.heightAt(x, z)));
        const rim = grow(p, 0.5);
        b.prism(rim, y - 0.2, y + 0.75, '#d9cfb8', 'stone'); // rim (water drawn on top)
        b.flat(p, y + 0.55, '#3d6470', 'water');
        const bb = polyBox(p);
        for (let x = bb.x0 + 2; x < bb.x1 - 1; x += 3.2) for (const z of [(bb.z0 + bb.z1) / 2]) jets.push([x, y + 0.55, z]);
        ctx.poly(rim, { y0: y - 1, y1: y + 0.75, prop: true });
    }
    const jetGeo = new THREE.CylinderGeometry(0.04, 0.18, 1, 6, 1, true); jetGeo.translate(0, 0.5, 0);
    const jm = new THREE.MeshStandardMaterial({ color: '#e9f4f7', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
    const jet = new THREE.InstancedMesh(jetGeo, jm, Math.max(1, jets.length)); jet.name = 'fountain-jets';
    const m4 = new THREE.Matrix4();
    const setJets = (t) => { jets.forEach(([x, y, z], i) => { const h = 2.6 + Math.sin(t * 1.3 + i * 0.7) * 0.6; m4.makeScale(1, h, 1).setPosition(x, y, z); jet.setMatrixAt(i, m4); }); jet.instanceMatrix.needsUpdate = true; };
    setJets(0); ctx.add(jet);
    ctx.onUpdate((dt, s) => setJets(s.t));
    // the pole clock "București 1459" at the east edge of the square (OSM n6049432585)
    const cp = d.pois.find((p) => p.id === 'n6049432585') || { x: 161.7, z: 11.8 };
    { const y = g.heightAt(cp.x, cp.z); b.cyl(cp.x, y, cp.z, 0.35, 0.8, '#2b3a34', 'metal', 10); b.cyl(cp.x, y + 0.8, cp.z, 0.13, 3.6, '#2b3a34', 'metal', 10); b.box(cp.x, y + 4.4, cp.z, 1.25, 1.25, 1.25, '#2b3a34', 'metal'); b.cyl(cp.x, y + 5.65, cp.z, 0.08, 0.5, '#c6a14a', 'bronze', 8, 0.2);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = clockFace(1.05, { timeZone: 'Europe/Bucharest', ink: '#1d1d1d', ring: '#1d1d1d' }); c.position.set(cp.x + Math.sin(a) * 0.64, y + 5.03, cp.z + Math.cos(a) * 0.64); c.rotation.y = a; ctx.add(c); }
        ctx.circle(cp.x, cp.z, 0.4, 5); }
    ctx.add(b.build('square-props'));
    return { clock: cp };
}

// ---------------------------------------------------------------------------- the People's Salvation Cathedral
// Heights from the 2013 section drawing (Vanel Exim, chief designer Constantin Amaiei; Commons ref
// "Catedrala Mântuirii Neamului ... profil față înălțime"): walls 41.4 m, nave block 51.8–62.8 m, crossing 71.8 m,
// Pantocrator drum 71.8–97.8 m, ribbed gilded dome to 121 m, lantern to 127 m, cross to 133 m; footprint and parts
// from OSM (way 232332568 + building:parts 128273…/128328…). White stone, gilded ribbed domes, arched windows
// framed by colonnettes, neo-Brâncovenesc niches; west bell tower over the porch.
const GOLD = '#c9a24e', WHITE = '#ece8df', WHITE2 = '#f4f1ea';
function goldDome(b, cx, y, cz, r, h, { seg = 24, half = null, ribs = true, neck = 0.06 } = {}) {
    const prof = [[0.001, 0], [1.02, 0], [1.04, 0.05], [1.0, 0.12], [0.97, 0.3], [0.88, 0.52], [0.7, 0.74], [0.45, 0.9], [0.2 + neck, 0.98], [0.001, 1]].map(([a, c]) => new THREE.Vector2(a * r, c * h));
    const g = half === null ? new THREE.LatheGeometry(prof, seg) : new THREE.LatheGeometry(prof, seg / 2, half - Math.PI / 2, Math.PI);
    const n = seg;
    b.add(g, 'bronze', M(cx, y, cz), ribs ? (x, yy, z) => { const a = Math.atan2(z - cz, x - cx), f = Math.abs(((a / (Math.PI * 2)) * n % 1 + 1) % 1 - 0.5); return f < 0.08 ? '#8f6f2c' : (yy - y) / h > 0.96 ? '#d8b866' : GOLD; } : GOLD, { roughness: 0.32, metalness: 0.9 });
    g.dispose();
}
function cross(b, x, y, z, h) { b.box(x, y, z, 0.35, h, 0.35, '#d9b862', 'bronze'); b.box(x, y + h * 0.66, z, h * 0.5, 0.3, 0.3, '#d9b862', 'bronze'); b.box(x, y + h * 0.42, z, h * 0.32, 0.25, 0.25, '#d9b862', 'bronze', 0.3); }
function ringPoly(cx, cz, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; }
function frustumRoof(b, poly, y, h, col = GOLD) { const o = obb(poly); if (!o) return; const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.55, Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); b.add(g, 'bronze', M(o.cx, y + h / 2, o.cz, 0, -o.angle, 0, o.len, h, o.wid), col, { roughness: 0.35, metalness: 0.85 }); g.dispose(); }
function buildCathedralModel(ctx, PY) {
    const d = ctx.data, b = new GeoBatch(), part = (id) => osmPoly(d, id);
    // walls 41.4 m = 3 bands of 13.8 m: tall arched ground windows, tall arched windows between pilasters, a frieze of
    // blind niches (ocnițe) under the gilded cornice; drums = 2 bands of 13 m: small windows, tall arches with colonnettes
    const fWall = classicFacade('cath-wall', [
        { t: 'arch', w: 0.3, top: 0.18, bottom: 0.06, pil: true }, { t: 'arch', w: 0.26, top: 0.1, bottom: 0.12, pil: 'pair' },
        { t: 'niches', n: 4, top: 0.3, bottom: 0.2 }, { t: 'blank' },
    ], { bay: 7.2, floor: 13.8, flood: '#ffe0a8', floodK: 0.5, lit: 0.1 });
    const fDrum = classicFacade('cath-drum', [
        { t: 'small', w: 0.26, top: 0.42, pil: 'pair' }, { t: 'arch', w: 0.38, pil: 'pair', top: 0.12, bottom: 0.1 },
        { t: 'niches', n: 3 }, { t: 'blank' },
    ], { bay: 5.4, floor: 13, flood: '#ffe0a8', floodK: 0.55, lit: 0.1 });
    const fTower = classicFacade('cath-tower', [
        { t: 'niches', n: 3, top: 0.4 }, { t: 'arch', w: 0.34, pil: 'pair', top: 0.12, bottom: 0.08 }, { t: 'blank' }, { t: 'arch', w: 0.3, pil: true, top: 0.2 },
    ], { bay: 5.2, floor: 7.2, flood: '#ffe0a8', floodK: 0.5, lit: 0.1 });
    const main = part('w232332568'), Y = (h) => PY + h;
    // stylobate + walls to 41.4 m
    b.prism(grow(main, 2.2), PY - 1.5, PY + 0.9, '#cfc8ba', 'stone');
    classicWalls(b, fWall, main, Y(0.9), Y(41.4), WHITE, Y(0.9));
    b.prism(grow(main, 1.0), Y(40.4), Y(41.4), '#dcc48a', 'stone', { noTop: true });  // gilded cornice band
    b.flat(main, Y(41.4), '#d9d4c8', 'roofs');
    // nave and crossing blocks with gilded mansard roofs
    for (const [id, top, roof] of [['w1282747246', 55.8, 7], ['w1282747249', 65.6, 6.2]]) { const p = part(id); if (!p) continue; classicWalls(b, fTower, p, Y(41.4), Y(top), WHITE, Y(41.4)); b.prism(grow(p, 0.7), Y(top - 0.8), Y(top), WHITE2, 'stone', { noTop: true }); frustumRoof(b, p, Y(top), roof); }
    // Pantocrator tower: drum, ribbed dome, lantern, cross
    const dp = part('w1282747250'), [mx, mz] = dp ? centroid(dp) : [-639, 162];
    const drum = ringPoly(mx, mz, 14, 16);
    classicWalls(b, fDrum, drum, Y(71.8), Y(97.8), WHITE, Y(71.8));
    b.prism(ringPoly(mx, mz, 15.2, 16), Y(70.6), Y(71.8), '#dcc48a', 'stone'); b.prism(ringPoly(mx, mz, 15, 16), Y(97.8), Y(99.2), WHITE2, 'stone');
    b.prism(ringPoly(mx, mz, 14.6, 24), Y(99.2), Y(100.2), '#c9a24e', 'bronze');
    goldDome(b, mx, Y(100.2), mz, 14.4, 21, { seg: 32 });
    classicWalls(b, fTower, ringPoly(mx, mz, 2.9, 10), Y(121), Y(125.6), WHITE, Y(121));
    goldDome(b, mx, Y(125.6), mz, 3.1, 2.6, { seg: 12, ribs: false }); cross(b, mx, Y(128), mz, 5.2);
    // west bell tower over the porch (OSM part 78 m), two flanking towers (71 m), six corner turrets (72 m)
    const bt = part('w1282739666');
    if (bt) { // square base to the nave cornice, a narrower belfry stage with tall openings, octagonal drum, gilded dome
        const [bx, bz] = centroid(bt), sq = (h) => [[bx - h, bz - h], [bx + h, bz - h], [bx + h, bz + h], [bx - h, bz + h]];
        classicWalls(b, fTower, bt, Y(41.4), Y(50.5), WHITE, Y(41.4)); b.prism(grow(bt, 0.8), Y(50.5), Y(51.6), WHITE2, 'stone');
        classicWalls(b, fDrum, sq(8.5), Y(51.6), Y(64.6), WHITE, Y(51.6) - 13); b.prism(sq(9.4), Y(64.6), Y(65.8), '#dcc48a', 'stone');
        classicWalls(b, fDrum, ringPoly(bx, bz, 6.4, 8), Y(65.8), Y(71.6), WHITE, Y(65.8)); b.prism(ringPoly(bx, bz, 7.0, 8), Y(71.6), Y(72.4), WHITE2, 'stone');
        goldDome(b, bx, Y(72.4), bz, 6.8, 6.6, { seg: 16 }); cross(b, bx, Y(79), bz, 4.2);
    }
    const turrets = [];
    for (const id of ['w1282739667', 'w1282747245']) { const p = part(id); if (p) turrets.push([...centroid(p), 4.6, 56, 63.6, 7]); }
    for (const id of ['w1283287481', 'w1283287482', 'w1283287485', 'w1283287486', 'w1283287487', 'w1283287488']) { const p = part(id); if (!p) continue; const [cx, cz] = centroid(p); const rr = Math.max(3.2, Math.sqrt(Math.abs(polyArea2(p)) / Math.PI)); turrets.push([cx, cz, rr, 41.4, 62.8, 8.4]); }
    for (const [cx, cz, rr, y0, y1, dh] of turrets) { classicWalls(b, fDrum, ringPoly(cx, cz, rr, 10), Y(y0), Y(y1), WHITE, Y(y0)); b.prism(ringPoly(cx, cz, rr + 0.6, 10), Y(y1), Y(y1 + 0.8), WHITE2, 'stone'); goldDome(b, cx, Y(y1 + 0.8), cz, rr + 0.2, dh, { seg: 16 }); cross(b, cx, Y(y1 + 0.8 + dh), cz, 3.2); }
    // transept ends + east apse: half drums with gilded semi-domes
    const [ccx, ccz] = centroid(main);
    for (const [id, top, dh] of [['w1282747247', 52, 9], ['w1282747248', 52, 9], ['w1283287489', 47, 11]]) {
        const p = part(id); if (!p) continue; const [cx, cz] = centroid(p); classicWalls(b, fTower, p, Y(41.4), Y(top), WHITE, Y(41.4)); b.prism(grow(p, 0.6), Y(top - 0.7), Y(top), WHITE2, 'stone', { noTop: true });
        const bb = polyBox(p), rr = Math.min(bb.x1 - bb.x0, bb.z1 - bb.z0) * 0.5; const dir = Math.atan2(cz - ccz, cx - ccx);
        b.flat(p, Y(top), '#d9d4c8', 'roofs'); goldDome(b, cx, Y(top), cz, rr * 0.92, dh, { seg: 20, half: -dir }); cross(b, cx, Y(top + dh), cz, 2.6);
    }
    // open west porch (pridvor): arcade of white columns under a gilded roof, in front of the bell tower
    if (bt) { const bb = polyBox(bt), x = bb.x0 - 6.5, zc = (bb.z0 + bb.z1) / 2, W = bb.z1 - bb.z0 + 6;
        b.box(x + 3, PY, zc, 9, 0.9, W, '#d8d1c3', 'stone');
        for (let i = 0; i <= 6; i++) { const z = zc - W / 2 + 1 + i * (W - 2) / 6; b.cyl(x - 0.6, Y(0.9), z, 0.7, 1.0, WHITE2, 'stone', 10); b.cyl(x - 0.6, Y(1.9), z, 0.55, 11, WHITE2, 'stone', 12); b.box(x - 0.6, Y(12.9), z, 1.6, 0.8, 1.6, '#e9e2d2', 'stone'); ctx.circle(x - 0.6, z, 0.6, 13, { y: PY }); }
        b.box(x + 2.5, Y(13.7), zc, 8.5, 1.8, W + 1, WHITE, 'stone'); frustumRoof(b, [[x - 2, zc - W / 2 - 0.5], [x + 6.8, zc - W / 2 - 0.5], [x + 6.8, zc + W / 2 + 0.5], [x - 2, zc + W / 2 + 0.5]], Y(15.5), 3.2);
        // the main portal + Ascension stained-glass window above it (west face)
        b.box(bb.x0 - 0.3, Y(0.9), zc, 0.4, 9.5, 6.5, '#5a4a36', 'paint'); b.box(bb.x0 - 0.35, Y(19), zc, 0.3, 11, 4.2, '#2e3e55', 'glass'); b.box(bb.x0 - 0.45, Y(30.2), zc, 0.3, 1.2, 5.2, '#dcc48a', 'stone');
    }
    ctx.add(b.build('cathedral', { matOverrides: { [fWall.key]: fWall.mat, [fDrum.key]: fDrum.mat, [fTower.key]: fTower.mat } }));
    return { x: mx, z: mz };
}
function polyArea2(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; }

/** the cathedral piazza (granite slabs on the hill), the landmarks.js model, candle pavilion, bell sounds */
const placeLandmarkNote = 'landmarks.js bCathedral is not used here: its drum windows read as blue glass up close (spec 12 Request)';
function buildCathedral(ctx) {
    const d = ctx.data, g = ctx.ground;
    const cat = d.buildings.find((x) => x.id === 'w232332568'); if (!cat) return null;
    // Canonical source IDs and the shared whole-footprint membership rule
    // determine replacements; a nearby part's centroid cannot erase it.
    ctx.skipBuildings.add(cat.id);
    const piazzaSource=d.areas.find(a=>a.id==='r16698908');
    const piazza=piazzaSource?.poly||[[-768,96],[-570,96],[-570,216],[-768,216]];
    // The western building w1223607029 is outside the mapped esplanade. It
    // remains a source building; the former rectangle incorrectly erased it.
    ctx.extras.cathedralContext={piazzaSource:piazzaSource?.source||null,piazza,removedUnverifiedCandlePavilion:true};
    const yc = g.heightAt(-654, 158);
    const PY = Math.round(yc * 10) / 10; void placeLandmarkNote;
    g.flatten(piazza, PY, 18);
    const paintPiazza = () => {
        ctx.painter.poly(piazza, '#c8c2b6', 'slab');
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; x.save(); x.beginPath(); piazza.forEach(([px,pz],i)=>{const [sx,sy]=T(px,pz);if(i)x.lineTo(sx,sy);else x.moveTo(sx,sy);});x.closePath();x.clip(); x.strokeStyle = 'rgba(120,112,100,0.35)'; x.lineWidth = Math.max(1, 0.12 * k); for (let q = -768; q <= -570; q += 6) { const [a, b0] = T(q, 96), [, b1] = T(q, 216); x.beginPath(); x.moveTo(a, b0); x.lineTo(a, b1); x.stroke(); } for (let q = 96; q <= 216; q += 6) { const [a0, bb] = T(-768, q), [a1] = T(-570, q); x.beginPath(); x.moveTo(a0, bb); x.lineTo(a1, bb); x.stroke(); } x.restore(); });
    };
    ctx.exclude.push(piazza);
    // landmarks.js bCathedral (fixed 2026-11-07: white drums, ribbed gilded domes, floodlit) reads better than the spot's
    // own model (kept below as buildCathedralModel for reference / fallback)
    const L0 = placeLandmark(ctx, 'cathedral', { y: PY, colliderH: 140 }), lm = L0 ? { x: L0.x, z: L0.z } : buildCathedralModel(ctx, PY);
    for (const id of L0?.lm.sourceIds || []) ctx.skipBuildings.add(id);
    ctx.poly(cat.poly, { y0: PY - 2, y1: PY + 140 });
    const walls = new GeoBatch();
    // Retaining-wall positions come from six mapped ways. Keep their source
    // gaps open. Wall height/material remain estimates; no invented rectangle.
    for(const w of d.ways.filter(w=>/^w122360703[0-5]$/.test(w.id)))for(let i=1;i<w.pts.length;i++){
        const [ax,az]=w.pts[i-1],[bx,bz]=w.pts[i],ya=g.heightAt(ax,az),yb=g.heightAt(bx,bz);
        walls.quad([ax,ya-.3,az],[bx,yb-.3,bz],[bx,yb+1,bz],[ax,ya+1,az],'#bdb6a8','stone');
        ctx.collider({wall:true,ax,az,bx,bz,y0a:ya-.3,y1a:ya+1,y0b:yb-.3,y1b:yb+1,source:w.id});
    }
    const wallMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide });
    ctx.add(walls.build('cathedral-source-retaining-walls', { matOverrides: { stone: wallMaterial } }));
    // No source establishes the former permanent pavilion/racks. The optional
    // candle exercise uses a temporary handheld prop on the mapped forecourt.
    return { PY, x: lm?.x ?? -654, z: lm?.z ?? 158, candle: { x: -726, z: 170 }, paintPiazza };
}

export default {
    env: { fogFar: 5200, ambientCity: 0.3, groundAlbedo: 0.15 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, spP = ctx.spot('palace-parliament'), spC = ctx.spot('peoples-salvation-cathedral');
        const G = palaceGround(ctx);
        const C = buildCathedral(ctx);
        const P = buildPalace(ctx, G);
        const GD = buildGardens(ctx, G, P);
        buildMinistries(ctx);
        const SQ = buildSquareProps(ctx);
        // square: granite setts (OSM parking area w219710325)
        const sq = osmPoly(d, 'w219710325');
        ctx.terrainOpts = { bg: '#7c8a55', bgMask: 'grass', innerPx: 2048, innerStep: 5, outerStep: 16, outerPad: 900 };
        bucBackdrop(ctx, { treeLod: { cap: 1400, max: 240 }, lampPad: 25, lampStyle: 'candelabra', lampColor: '#2c2f2c', lampOpts: { spacing: 50, kinds: ['primary'] }, streetTreeOpts: { spacing: 10, prob: 0.8, kinds: ['primary', 'secondary', 'tertiary', 'residential'] } });
        C?.paintPiazza();
        if (sq) {
            ctx.painter.poly(sq, '#8e8a84', 'cobble');
            ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; x.strokeStyle = 'rgba(240,238,230,0.55)'; x.lineWidth = Math.max(1, 0.12 * k); const bb = polyBox(sq); for (let px = bb.x0 + 6; px < bb.x1 - 4; px += 5.4) { for (let pz = bb.z0 + 8; pz < bb.z1 - 8; pz += 12) { if (!inPoly(px, pz, sq) || Math.abs(pz + 10) < 9) continue; const [a, c0] = T(px, pz), [, c1] = T(px, pz + 5); x.beginPath(); x.moveTo(a, c0); x.lineTo(a, c1); x.stroke(); } } });
        }
        // trees: species-specific shapes (clipped thuja cones on the palace slopes, firs), no trees on the square
        ctx.trees = ctx.trees.filter((t) => !(sq && inPoly(t.x, t.z, sq)) && !inPoly(t.x, t.z, P.outer));
        // the view down the axis from the clock / Bd. Unirii head to the palace stays open (median gardens: low planting only)
        ctx.trees = ctx.trees.filter((t) => !(t.x > -20 && t.x < 290 && Math.abs(t.z + 8) < 26));
        for (const [x, z, , sp] of d.trees) { if (!/Thuja|Juniperus|Taxus|Abies|Picea|Pinus/.test(sp)) continue; const t = ctx.trees.find((q) => Math.abs(q.x - x) < 0.01 && Math.abs(q.z - z) < 0.01); if (!t) continue; t.kind = 'con'; if (/Thuja|Juniperus|Taxus/.test(sp)) { t.s = 0.42 + ((x * 7 + z * 3) % 1 + 1) % 1 * 0.12; t.sy = 1.35; t.c = '#2f5233'; } }
        // parked cars on the square (rows, most of the year it is a car park)
        const parked = [], r = rng(31);
        if (sq) { const bb = polyBox(sq); for (let px = bb.x0 + 10; px < bb.x1 - 8; px += 11) for (let pz = bb.z0 + 12; pz < bb.z1 - 12; pz += 2.6) { if (!inPoly(px, pz, sq) || !inPoly(px + 6, pz, sq) || Math.abs(pz + 10) < 9 || r() > 0.55) continue; for (const k of [0, 5.6]) if (r() < 0.8) parked.push({ x: px + k, z: pz + (r() - 0.5) * 0.3, yaw: Math.PI / 2 + (k ? Math.PI : 0) + (r() - 0.5) * 0.08 }); } }
        // traffic: the ring around the square + Bd. Unirii
        const way = (id) => d.ways.find((w) => w.id === id)?.pts || [];
        const ring = [...way('w666686367'), ...way('w1138494722')].length ? [[30, 300], [24, 120], [28, -10], [34, -114], [52, -194], [56, -263]] : [];
        cityFiller(ctx, { ring: 700 });
        addTraffic(ctx, { merge: true, parked: parked.filter((q, i) => i % 2 === 0).slice(0, 60), lanes: [
            { pts: ring, n: 4, speed: 11 }, { pts: [[60, -263], [56, -194], [52, -113], [106, -88], [151, -10], [151, 32], [106, 92], [48, 124], [20, 300]], n: 4, speed: 10 },
            { pts: [[150, 40], [300, 50], [520, 52], [790, 60]], n: 4, speed: 13 }, { pts: [[790, -8], [520, -12], [300, -12], [152, -12]], n: 4, speed: 13 },
            { pts: [[18, 330], [-250, 308], [-462, 291], [-650, 275], [-905, 232]], n: 3, speed: 12 }, { pts: [[-908, 251], [-649, 275], [-465, 291], [7, 309]].map(([x, z]) => [x, z - 5]), n: 3, speed: 12 },
        ] });
        // flags + flag on the roof wave in the real wind
        ctx.onUpdate((dt, s) => { const w = s.r3d.weather?.windKmh ?? 12; for (const f of GD.flags) f.update(s.t, w); P.roofFlag.update(s.t, w); });
        // plaques: palace (along the square's west edge facing the palace) and cathedral (piazza)
        const PL = spP.plaques;
        PL.forEach((pl, i) => ctx.plaque(pl, 44 + (i % 2) * 0.1, -60 + i * 22, -Math.PI / 2, { style: 'park', credit: i === 1 ? 'Chief architect Anca Petrescu (1950–2013) with a team of about 700 architects.' : null }));
        const CPL = spC.plaques;
        if (C) CPL.forEach((pl, i) => ctx.plaque(pl, -730, 130 + i * 11, -Math.PI / 2, { style: 'park', y: C.PY }));
        // Pace a game course along the public east frontage. The endpoints
        // are UI waypoints; no unsourced permanent marker posts are added.
        const mA = { x: 30, z: -150 }, mB = { x: 22, z: 140 }, paceMetres = Math.hypot(mB.x - mA.x, mB.z - mA.z); let pace = null;
        ctx.extras.palacePace = { start: mA, end: mB, debug: () => pace && { ...pace, previous: { ...pace.previous } } };
        ctx.onUpdate((dt, s, p) => {
            if (!pace) return;
            if (!p || s.spot.entry.id !== 'palace-parliament' || !s.ctl.active || activityBlocked(s)) { pace = null; return; }
            const delta = Math.hypot(p.x - pace.previous.x, p.z - pace.previous.z);
            if (delta > Math.max(1, dt * 6) || distPolyline(p.x, p.z, [[mA.x, mA.z], [mB.x, mB.z]]).d > 18) { pace = null; return; }
            pace.walked += delta; pace.previous = { x: p.x, z: p.z };
        });
        ctx.interactables.push({ x: mA.x, z: mA.z, r: 2, cond: s => s.spot.entry.id === 'palace-parliament', label: 'Pace the Palace: start the public frontage course', use: s => {
            pace = { t: s.t, walked: 0, previous: { x: s.position.x, z: s.position.z } };
            s.ui.toast('⏱ Pace the Palace', `Walk the public frontage to the other waypoint, about ${Math.round(paceMetres)} game metres. Travel, leaving the route or opening another mode cancels the course.`);
        } });
        ctx.interactables.push({ x: mB.x, z: mB.z, r: 2, cond: s => s.spot.entry.id === 'palace-parliament', label: () => pace ? 'Pace the Palace: finish the walk' : 'Pace the Palace: begin at the north waypoint', use: s => {
            if (!pace || pace.walked < paceMetres - 5) return;
            const sec = s.t - pace.t, metres = Math.round(pace.walked); pace = null;
            bucActivity(s, 'palace-parliament', 'pace', `⏱ ${sec.toFixed(0)} s for ${metres} game metres`, 'You walked continuously along the public east frontage. This course is a game exercise, not a surveyed building dimension.');
        } });
        // Balcony geometry remains; a visitor does not teleport through the
        // unmodelled halls. The public square supplies three real facade views.
        {const pt=P.portico;photoHunt(ctx,{x:44,z:-16,title:'Frame the Palace facade',unavailable:'Interior and balcony access require an organised visit; they are unavailable in this scene.',targets:[
            {label:'The central balcony over the boulevard',x:pt.x,y:pt.y+17,z:pt.z,radius:4},
            {label:'The north wing',x:pt.x-18,y:pt.y+18,z:pt.z-78,radius:5},
            {label:'The south wing',x:pt.x-18,y:pt.y+18,z:pt.z+78,radius:5},
        ],onDone:s=>bucActivity(s,'palace-parliament','balcony','📷 Three Palace details','You framed the balcony and both wings from the public square.')});}
        // cathedral: light a candle
        if (C) {
            const candle = candleLight(ctx, new THREE.Vector3(), { title: 'A virtual candle at the cathedral', portable: true, focus: new THREE.Vector3(C.x, C.PY + 30, C.z), onDone: s => bucActivity(s, 'peoples-salvation-cathedral', 'candle', '🕯 Candle practice completed', 'You lit and placed a virtual candle in a handheld holder. The real lumânărar location is unverified; this does not represent a permanent rack on the piazza.') });
            ctx.extras.cathedralCandle = candle;
            ctx.interactables.push({ kind: 'candle', x: C.candle.x, z: C.candle.z, r: 2.4, label: 'Light and place a virtual candle', use: s => candle.start(s) });
        }
        // postcards
        // postcard: the frontal view across Piața Constituției on the Bd. Unirii axis (the Bd. Libertății sidewalk, ≈ 190 m from the east front)
        ctx.challenge('palace-parliament', { view: [-160, -10.5], x: 31, z: -10.5, heading: 270, pitch: 14, r: 18, tol: 26 });
        ctx.challenge('peoples-salvation-cathedral', { view: [C?.x ?? -654, C?.z ?? 158], x: -731, z: 165, heading: 85, pitch: 28, r: 6, tol: 28, text: 'From the mapped west forecourt, outside the church inner ring and the western source building, looking toward the main portal and bell tower.' });
        // crowd
        const cl = SQ.clock, cat = C || { x: -654, z: 158, PY: 14 };
        ctx.crowdCfg = {
            spots: ['palace-parliament', 'peoples-salvation-cathedral'],
            personas: { tourist_uk: 2, tourist_de: 2, tourist_us: 1.5, tourist_bg: 1.5, local_young: 3, local_elder: 2, local_parent: 1.5, kid: 0.8 },
            walkers: 46, paths: ctx.footLines().filter((l) => !l.some(([x, z]) => x < 12 && x > -480 && z > -320 && z < 292)),
            groups: [
                { x: cl.x - 12, z: cl.z + 2, r: 4, n: 9, act: 'photo', look: [-200, -10], personas: ['tourist_uk', 'tourist_de', 'tourist_us', 'tourist_bg'] },
                { x: cl.x - 6, z: cl.z + 6, r: 0.3, n: 1, act: 'guide', look: [cl.x - 12, cl.z + 2], personas: ['tour_guide'], prop: 'umbrella' },
                { x: 60, z: -12, r: 3, n: 4, act: 'photo', look: [-160, -10], personas: ['tourist_bg', 'tourist_us', 'local_young'] },
                { x: 36, z: -42, r: 0.4, n: 1, act: 'watch', look: [-100, -42], personas: ['guard'] },
                { x: 36, z: 46, r: 0.4, n: 1, act: 'watch', look: [-100, 46], personas: ['guard'] },
                { x: cat.x - 70, z: cat.z + 34, r: 5, n: 8, act: 'watch', look: [cat.x, cat.z], personas: ['local_elder', 'local_parent', 'tourist_bg', 'tourist_us'], y: cat.PY },
                { x: -742, z: 194, r: 2, n: 4, act: 'watch', look: [-742, 190], personas: ['local_elder', 'local_elder', 'local_parent'], y: cat.PY },
                { x: cat.x - 95, z: cat.z + 10, r: 0.4, n: 1, act: 'guide', look: [cat.x - 70, cat.z + 34], personas: ['tour_guide'], y: cat.PY },
                { x: cat.x - 40, z: cat.z + 46, r: 0.5, n: 1, act: 'watch', look: [cat.x, cat.z], personas: ['guard'], y: cat.PY },
            ],
        };
        ctx.sound('traffic', 30, 0, 140, 1); ctx.sound('traffic', 150, -10, 110, 0.8); ctx.sound('wind', 95, 0, 160, 0.6); ctx.sound('water', 200, 14, 40, 0.6);
        ctx.sound('crowd', cl.x - 10, cl.z, 30, 0.4); ctx.sound('traffic', -500, 285, 160, 0.7); ctx.sound('bell', cat.x, cat.z, 400, 0.6); ctx.sound('wind', cat.x, cat.z, 120, 0.5);
        // spawns: the square by the clock looking at the palace; the piazza's south-west corner looking at the west front
        ctx.spawns['palace-parliament'] = { x: cl.x - 4, z: cl.z - 3, heading: headingFromBearing(268) };
        ctx.spawns['peoples-salvation-cathedral'] = { x: -732, z: 169, heading: headingFromBearing(85) };
        void distPolyline; void canvas; void canvasTexture; void fitDraw;
    },
};
