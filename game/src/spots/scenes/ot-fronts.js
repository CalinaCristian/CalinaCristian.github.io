// ============================================================================
//  Old Town (buc-old-town): street fronts compared with official Street View panoramas (fidelity pass r3, 2026-11-13).
//  Street View is the visual reference only (no imagery or data taken from it); positions and outlines are OSM.
//
//  caleaVictoriei(ctx)  Calea Victoriei between CEC Palace and the National History Museum (panoramas 2023-08,
//                       44.43181 26.09704 and 44.43238 26.09701): the generated street-tree rows and the residential
//                       "lawn" (landuse=residential paints grass) in front of both palaces become paved sidewalk and the
//                       museum's paved forecourt; the CEC garden boundary (OSM barrier=wall w657976539 / w657976540,
//                       gates n6161874897 / n10862839768) is drawn as it stands: a low stone kerb with a turquoise iron
//                       railing. Railing / kerb heights are visual estimates (OSM gives none).
//  bnrLipscani(ctx)     Old National Bank palace (w1210146218), Lipscani front (panoramas 2022-10, 44.43216 26.09936 and
//                       44.43216 26.09985): no shopfront, the entrance steps in front of the projecting centre bay and the
//                       planted beds behind black iron railings on a stone kerb along the façade. Step count, bed depth
//                       and railing height are estimates; the unmapped conifers in the beds are not added (not in OSM).
//  maccaPortal(ctx)     Pasajul Macca-Vilacrosse, Str. Eugeniu Carada (panorama 2022-10, 44.43299 26.09897): the arched
//                       portal on the face of the passage block (r19924112) where the arcade way w657740103 enters it.
//                       The glazed roof over the passage is not drawn: OSM maps the passage inside the building mass
//                       (tunnel=yes, no roof part), so there is no source volume to open.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, canvas, canvasTexture, distPolyline, inPoly } from '../kit.js';
import { flagpole } from '../buc.js';

// ---------------------------------------------------------------------------- iron railing (alpha-tested, vertex tinted)
const RAIL_MATS = {};
function railMaterial(kind) {
    if (RAIL_MATS[kind]) return RAIL_MATS[kind];
    const W = 128, H = 128, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H); g.fillStyle = '#ffffff';
    if (kind === 'spear') { // tall bank railing: bars with spear tips, two rails
        g.fillRect(0, 16, W, 4); g.fillRect(0, H - 12, W, 5);
        for (let i = 0; i < 10; i++) { const x = i * 12.8 + 5; g.fillRect(x, 6, 2.6, H); g.beginPath(); g.moveTo(x - 2.5, 8); g.lineTo(x + 1.3, 0); g.lineTo(x + 5, 8); g.fill(); }
    } else { // low garden railing: top / bottom rail, bars, a ring band
        g.fillRect(0, 0, W, 7); g.fillRect(0, H - 8, W, 6);
        for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 7, 0, 3, H);
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 16 + 15, 28, 6, 0, 7); g.stroke(); }
    }
    const t = canvasTexture(c, { repeat: true });
    const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.45, vertexColors: true });
    m.name = 'ot-railing-' + kind; m.userData.shared = true;
    return (RAIL_MATS[kind] = m);
}
/** split a polyline into runs that keep clear of gaps [{x, z, w}] */
function cutGaps(pts, gaps) {
    if (!gaps.length) return [pts];
    const out = []; let run = [];
    const blocked = (x, z) => gaps.some((q) => Math.hypot(x - q.x, z - q.z) < q.w / 2);
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.5));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
            if (blocked(x, z)) { if (run.length > 1) out.push(run); run = []; } else run.push([x, z]); }
    }
    if (run.length > 1) out.push(run);
    return out.map((r) => r.filter((p, i) => i === 0 || i === r.length - 1 || i % 4 === 0)); // 2 m resample
}
/** iron railing on a stone kerb along a polyline; colliding wall segments */
function railing(ctx, rails, solid, pts, { h = 1.0, plinth = 0.4, colour = '#3f8c83', postCol = colour, plinthCol = '#cfc8b8', post = 2.4, kind = 'low', gaps = [] } = {}) {
    const g = ctx.ground; let seg = 0;
    for (const run of cutGaps(pts, gaps)) {
        const pos = [], uv = [], idx = []; let u = 0;
        for (let i = 1; i < run.length; i++) {
            const [ax, az] = run[i - 1], [bx, bz] = run[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            const ya = g.heightAt(ax, az), yb = g.heightAt(bx, bz), k = pos.length / 3, odd = (seg++ % 2) * 0.03;
            pos.push(ax, ya + plinth, az, bx, yb + plinth, bz, bx, yb + plinth + h, bz, ax, ya + plinth + h, az);
            uv.push(u / (h * 1.1), 0, (u + L) / (h * 1.1), 0, (u + L) / (h * 1.1), 1, u / (h * 1.1), 1); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); u += L;
            // kerb: alternate segments differ by 3 cm so the overlapping joins are never coplanar
            if (plinth > 0) solid.box((ax + bx) / 2, Math.min(ya, yb) - 0.25 - odd, (az + bz) / 2, 0.36 + odd, plinth + 0.25 + Math.abs(ya - yb) + odd, L + 0.04, plinthCol, 'stone', Math.atan2(bx - ax, bz - az));
            const n = Math.max(1, Math.round(L / post));
            for (let q = i > 1 ? 1 : 0; q <= n; q++) { const t = q / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; solid.box(x, g.heightAt(x, z) + plinth, z, 0.09, h + 0.06, 0.09, postCol, 'metal'); }
            ctx.collider({ wall: true, ax, az, bx, bz, y0a: ya - 1, y1a: ya + plinth + h, y0b: yb - 1, y1b: yb + plinth + h, x: (ax + bx) / 2, z: (az + bz) / 2, r: L / 2 + 0.5 });
        }
        if (!idx.length) continue;
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
        rails.add(geo, 'rail-' + kind, null, colour); geo.dispose();
    }
}
const xAtZ = (pts, z) => { // x of a mostly north-south polyline at z (clamped to its ends)
    const s = [...pts].sort((a, b) => a[1] - b[1]); if (z <= s[0][1]) return s[0][0]; if (z >= s[s.length - 1][1]) return s[s.length - 1][0];
    for (let i = 1; i < s.length; i++) if (z <= s[i][1]) { const t = (z - s[i - 1][1]) / ((s[i][1] - s[i - 1][1]) || 1); return s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t; }
    return s[s.length - 1][0];
};
/** strip polygon between two north-south lines x = f(z) and x = h(z) for z0..z1 */
const strip = (f, h, z0, z1, step = 2) => { const a = [], b = []; for (let z = z0; z <= z1 + 1e-6; z += Math.min(step, z1 - z || step)) { a.push([f(z), z]); b.push([h(z), z]); if (z >= z1) break; } return [...a, ...b.reverse()]; };

// ---------------------------------------------------------------------------- Calea Victoriei: CEC + National History Museum
export function caleaVictoriei(ctx) {
    const d = ctx.data, way = (id) => d.ways.find((w) => w.id === id)?.pts;
    const west = way('w231242707'), east = way('w242569558'), cyc = way('w800127656'), cecE = way('w657976540'), cecN = way('w657976539');
    if (!west || !east || !cyc || !cecE || !cecN) return null;
    const P = ctx.painter, SLAB = '#a7a39b';
    // 1. CEC side: sidewalk from the garden railing to the carriageway's west edge (2 lanes ≈ 7 m: 3.5 m off the centre line)
    const cecLine = [...cecE.filter(([, z]) => z > -104), ...cecN.filter(([, z]) => z < -46 && z > -74)];
    P.poly(strip((z) => xAtZ(cecLine, z) + 0.3, (z) => xAtZ(west, z) - 3.6, -103, -47), SLAB, 'slab');
    // 2. museum side: from the cycle track's east edge to the façade (museum south of Str. Stavropoleos; the block north of it)
    P.poly(strip((z) => xAtZ(cyc, z) + 1.3, (z) => xAtZ(cyc, z) + 14, -63.5, 23), SLAB, 'slab');
    P.poly(strip((z) => xAtZ(cyc, z) + 1.3, (z) => xAtZ(cyc, z) + 9.5, -106, -74), SLAB, 'slab');
    // 3. no generated street trees along this stretch (mapped OSM trees inside the CEC garden stay)
    const mapped = new Set(d.trees.map(([x, z]) => Math.round(x * 10) + ',' + Math.round(z * 10)));
    const lines = [west, east, cyc, way('w231242706')].filter(Boolean);
    const before = ctx.trees.length;
    ctx.trees = ctx.trees.filter((t) => mapped.has(Math.round(t.x * 10) + ',' + Math.round(t.z * 10)) || t.z < -118 || t.z > 30 || !lines.some((l) => distPolyline(t.x, t.z, l).d < 11));
    // 4. CEC garden boundary: stone kerb + turquoise railing, open at the mapped gates and the front path
    const rails = new GeoBatch(), solid = new GeoBatch();
    const gates = [{ x: -200.7, z: -106.5, w: 3.2 }, { x: -213.4, z: -45, w: 3.2 }];
    for (const pts of [cecE, cecN]) railing(ctx, rails, solid, pts, { h: 1.0, plinth: 0.45, colour: '#4f9e93', postCol: '#3f8a80', plinthCol: '#d3cbb9', gaps: gates });
    ctx.add(solid.build('cec-garden-kerb'));
    ctx.add(rails.build('cec-garden-railing', { castShadow: false, matOverrides: { 'rail-low': railMaterial('low') } }));
    // 5. the museum's flagpoles (OSM man_made=flagpole with country=RO / EU, Overpass 2026-11-13; the two untagged poles
    //    stay bare). Pole height 8 m is a visual estimate.
    const flags = [];
    for (const [x, z, k] of [[-182.5, -60.4, 'eu'], [-183.3, -59.1, 'ro'], [-183.6, -57.3, null], [-184, -55.7, 'ro'], [-183.6, -53.7, 'eu'],
        [-196.4, 7.8, 'eu'], [-197.1, 10.4, 'ro'], [-197.3, 12.3, null], [-197.9, 14.3, 'ro'], [-198.6, 16.9, 'eu']]) {
        if (!(d.furniture.flagpole || []).some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 0.3)) continue; // only where the scene data has the node
        const f = flagpole(x, ctx.ground.heightAt(x, z), z, 8, k || 'none', { yaw: 2.6 });
        if (!k) f.group.children.at(-1).visible = false; // bare pole
        ctx.add(f.group); flags.push(f); ctx.circle(x, z, 0.15, 8);
    }
    if (flags.length) ctx.onUpdate((dt, s) => { const w = s.r3d?.weather?.windKmh ?? 12; for (const f of flags) f.update(s.t, w); });
    ctx.extras.caleaVictoriei = { droppedTrees: before - ctx.trees.length, flags: flags.length };
    return ctx.extras.caleaVictoriei;
}

// ---------------------------------------------------------------------------- National Bank, Lipscani front
export function bnrLipscani(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((b) => b.id === 'w1210146218'); if (!bd) return null;
    const P = bd.poly, find = (x, z) => P.findIndex(([px, pz]) => Math.abs(px - x) < 0.05 && Math.abs(pz - z) < 0.05);
    const chain = (a, b) => { const i0 = find(...a), i1 = find(...b); if (i0 < 0 || i1 < 0) return null; const out = []; for (let i = i0; ; i = (i + 1) % P.length) { out.push(P[i]); if (i === i1) break; } return out; };
    // the Lipscani face runs (in ring order) from the west corner at Str. Eugeniu Carada to the corner at Smârdan
    const westFace = chain([-51.2, -125], [-22.6, -114.7]), bay = chain([-23.4, -112.6], [-10.7, -107.5]), eastFace = chain([-9.8, -109.7], [17.6, -97.8]);
    if (!westFace || !bay || !eastFace) return null;
    // outward normal of the face (toward Lipscani): the ring is clockwise in x/z here, so the normal is (−uz, ux) of a →
    const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return [-dz / L, dx / L]; };
    const off = (pts, dd) => pts.map(([x, z], i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], [nx, nz] = nrm(a, b); return [x + nx * dd, z + nz * dd]; });
    const sideOut = (() => { const [nx, nz] = nrm(eastFace[0], eastFace.at(-1)); return nz > 0 ? 1 : -1; })(); // Lipscani lies toward +z
    const O = (pts, dd) => off(pts, dd * sideOut);
    const solid = new GeoBatch(), rails = new GeoBatch(), STONE = '#d9d0bd';
    // 1. entrance steps: 7 treads in front of the projecting centre bay (rise 0.17 m, tread 0.45 m), the bay's width
    const [b0, b1] = [bay[0], bay.at(-1)], [nx, nz] = nrm(b0, b1).map((v) => v * sideOut), ux = (b1[0] - b0[0]), uz = (b1[1] - b0[1]), BW = Math.hypot(ux, uz);
    const cx = (b0[0] + b1[0]) / 2, cz = (b0[1] + b1[1]) / 2, yaw = Math.atan2(ux, uz), y0 = Math.min(g.heightAt(b0[0], b0[1]), g.heightAt(b1[0], b1[1]));
    // the bay itself projects; the steps start at its front line
    const front = Math.max(...bay.map(([x, z]) => (x - b0[0]) * nx + (z - b0[1]) * nz));
    // nested treads: each one runs from just inside the bay front out to its nosing; ends, backs and bottoms are
    // staggered by 1–2 cm so no two faces are coplanar
    const N = 7, T = 0.45, run = N * T;
    // (each tread is a solid block under its own exposed run only: neighbours share a face with opposite normals)
    for (let s = 0; s < N; s++) { const nose = front + (N - s) * T, back = s === N - 1 ? front - 0.05 : nose - T, w = nose - back, dd = (back + nose) / 2;
        solid.box(cx + nx * dd, y0 - 0.25, cz + nz * dd, w, 0.25 + (s + 1) * 0.17, BW - 1.52, STONE, 'stone', yaw); }
    // stone cheeks either side of the flight
    for (const sgn of [-1, 1]) { const ex = cx + ux / BW * sgn * (BW / 2 - 0.45), ez = cz + uz / BW * sgn * (BW / 2 - 0.45), dd = front + run / 2 - 0.03;
        solid.box(ex + nx * dd, y0 - 0.27, ez + nz * dd, run + 0.1, 1.5, 0.5, '#d2c8b3', 'stone', yaw); }
    { const e = (k, dd) => [cx + ux / BW * k * BW / 2 + nx * dd, cz + uz / BW * k * BW / 2 + nz * dd];
      ctx.poly([e(-1, front), e(1, front), e(1, front + run), e(-1, front + run)], { y0: y0 - 1, y1: y0 + 1.3 }); }
    // 2. planted beds along the façade behind a black iron railing on a stone kerb (east bed stops short of the
    //    Hanul Șerban Vodă glass cover, w658220780, which lies 3.6 m off the façade)
    const beds = [{ face: westFace, depth: 3.2 }, { face: eastFace, depth: 2.8 }];
    const bedPolys = [];
    for (const { face, depth } of beds) {
        // the bed returns to the wall 0.6 m in from each end of its face, clear of the bay sides and the stair cheeks
        const along = (p, q, dd) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (q[0] - p[0]) * dd / L, p[1] + (q[1] - p[1]) * dd / L]; };
        const f2 = [along(face[0], face[1], 0.6), ...face.slice(1, -1), along(face.at(-1), face.at(-2), 0.6)];
        const line = O(f2, depth), poly = [...f2, ...[...line].reverse()]; bedPolys.push(poly);
        ctx.painter.poly(poly, '#55703a', 'grass');
        const edge = [f2[0], ...line, f2.at(-1)];
        railing(ctx, rails, solid, edge, { h: 1.55, plinth: 0.45, colour: '#22262a', postCol: '#1b1e21', plinthCol: '#d3cab6', post: 2.2, kind: 'spear' });
        // low clipped shrubs in the bed (planting: a visual estimate of the beds seen in the panoramas)
        for (let i = 1; i < f2.length; i++) { const [ax, az] = f2[i - 1], [bx, bz] = f2[i], L = Math.hypot(bx - ax, bz - az), [fx, fz] = nrm(f2[i - 1], f2[i]).map((v) => v * sideOut);
            for (let t = 1.2; t < L - 1; t += 2.6) { const x = ax + (bx - ax) * t / L + fx * depth * 0.5, z = az + (bz - az) * t / L + fz * depth * 0.5, s = 0.75 + ((t * 7.3) % 1) * 0.35;
                solid.sphere(x, g.heightAt(x, z) + 0.45 * s, z, 0.75 * s, 0.6 * s, 0.75 * s, (i + Math.round(t)) % 3 ? '#3f5f2c' : '#4b6b33', 'plant', 8, 5); } }
    }
    ctx.add(solid.build('bnr-lipscani'));
    ctx.add(rails.build('bnr-lipscani-railing', { castShadow: false, matOverrides: { 'rail-spear': railMaterial('spear') } }));
    // generated trees never stand in the beds or on the steps
    ctx.trees = ctx.trees.filter((t) => !bedPolys.some((p) => inPoly(t.x, t.z, p)));
    return { beds: bedPolys, steps: { x: cx, z: cz } };
}
/**
 * name boards for mapped shops that open onto a courtyard / passage inside a multipolygon building (poiSigns only knows
 * outer walls): on the hole edge nearest the node, facing into the passage, 3.9 m up. OSM names only.
 */
export function courtyardSigns(ctx, buildingId, ids, taken = []) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((b) => b.id === buildingId), out = [];
    if (!bd?.holes?.length) return out;
    const COLS = [['#1d2a24', '#f1e6c8'], ['#2a1d1a', '#e8c870'], ['#23303a', '#e8e0cc']];
    for (const [k, id] of ids.entries()) {
        const p = d.pois.find((q) => q.id === id); if (!p?.name) continue;
        let best = null;
        for (const h of bd.holes) for (let i = 0; i < h.length; i++) {
            const [ax, az] = h[i], [bx, bz] = h[(i + 1) % h.length], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez); if (L < 2.5) continue;
            const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (L * L))), dd = Math.hypot(p.x - ax - ex * t, p.z - az - ez * t);
            if (!best || dd < best.dd) { let nx = ez / L, nz = -ex / L; const mx = ax + ex * t, mz = az + ez * t; if (!inPoly(mx + nx * 0.5, mz + nz * 0.5, h)) { nx = -nx; nz = -nz; } best = { dd, ax, az, ux: ex / L, uz: ez / L, L, u: t * L, nx, nz }; }
        }
        if (!best || best.dd > 8) continue;
        const text = String(p.name).trim(), w = Math.min(best.L - 0.4, 1.2 + text.length * 0.28, 5.5), u = Math.max(w / 2 + 0.2, Math.min(best.L - w / 2 - 0.2, best.u));
        const x = best.ax + best.ux * u, z = best.az + best.uz * u, y = g.heightAt(x, z) + 3.9;
        if ([...taken, ...out].some((q) => Math.hypot(q.x - x, q.z - z) < ((q.w || 3) + w) / 2 + 0.25 && Math.abs((q.y ?? y) - y) < 0.7)) continue;
        const [bg, fg] = COLS[k % COLS.length];
        out.push({ source: p.id, x: x + best.nx * 0.14, y, z: z + best.nz * 0.14, yaw: Math.atan2(best.nx, best.nz), w, h: 0.62, text, bg, fg });
    }
    return out;
}
/** buildings drawn without a ground-floor shopfront for the whole backdrop call (copies; source records untouched) */
export function withoutShopfront(ctx, ids, fn) {
    const d0 = ctx.data, set = new Set(ids);
    ctx.data = { ...d0, buildings: d0.buildings.map((b) => (set.has(b.id) ? { ...b, k: 'building' } : b)) };
    try { return fn(); } finally { ctx.data = d0; }
}

// ---------------------------------------------------------------------------- Pasajul Macca-Vilacrosse portal (Str. Eugeniu Carada)
export function maccaPortal(ctx, { sourceTop = null } = {}) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((b) => b.id === 'r19924112'); if (!bd) return null;
    const a = [-53.7, -197.6], b = [-56.9, -189.1], i0 = bd.poly.findIndex(([x, z]) => Math.abs(x - a[0]) < 0.05 && Math.abs(z - a[1]) < 0.05);
    if (i0 < 0) return null;
    const FW = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / FW, uz = (b[1] - a[1]) / FW;
    let nx = uz, nz = -ux; if (nx < 0) { nx = -nx; nz = -nz; } // outward: toward Str. Eugeniu Carada (+x)
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, y0 = Math.min(g.heightAt(a[0], a[1]), g.heightAt(b[0], b[1]));
    const H = Math.max(7.5, Math.min(13, (sourceTop ?? y0 + 12) - y0 - 0.3)); // never above the drawn source mass
    const c = canvas(512, Math.round(512 * H / FW)), x = c.getContext('2d'), CW = c.width, CH = c.height, S = CW / FW, PY = (m) => CH - m * S;
    x.fillStyle = '#d8ccb4'; x.fillRect(0, 0, CW, CH);
    x.fillStyle = 'rgba(90,75,55,0.22)'; for (let yy = PY(H); yy < CH; yy += 0.42 * S) x.fillRect(0, yy, CW, 1.4); // rustication
    for (const xx of [0.55, FW - 1.55]) { x.fillStyle = '#e2d7c1'; x.fillRect(xx * S, PY(H - 0.6), 1.0 * S, (H - 0.6) * S); x.fillStyle = 'rgba(80,66,48,0.35)'; x.fillRect(xx * S, PY(H - 0.6), 3, (H - 0.6) * S); }
    // the round-arched opening: 5.4 m wide, springing at 5.6 m (crown 8.3 m)
    const ow = 5.4, ox0 = (FW - ow) / 2 * S, ox1 = ox0 + ow * S, spring = Math.min(5.6, H - 3.4), r = ow / 2 * S;
    x.fillStyle = '#e6dcc6'; x.beginPath(); x.moveTo(ox0 - 0.45 * S, CH); x.lineTo(ox0 - 0.45 * S, PY(spring)); x.arc(CW / 2, PY(spring), r + 0.45 * S, Math.PI, 0); x.lineTo(ox1 + 0.45 * S, CH); x.fill();
    const grd = x.createLinearGradient(0, PY(spring + ow / 2), 0, CH); grd.addColorStop(0, '#2b2a27'); grd.addColorStop(1, '#171614');
    x.fillStyle = grd; x.beginPath(); x.moveTo(ox0, CH); x.lineTo(ox0, PY(spring)); x.arc(CW / 2, PY(spring), r, Math.PI, 0); x.lineTo(ox1, CH); x.fill();
    // iron-and-glass fanlight in the arch, glazed screen with a transom below (the lit passage seen through it)
    x.save(); x.beginPath(); x.arc(CW / 2, PY(spring), r - 2, Math.PI, 0); x.closePath(); x.clip();
    x.fillStyle = 'rgba(190,200,190,0.35)'; x.fillRect(ox0, PY(spring + ow / 2), ow * S, ow / 2 * S);
    x.strokeStyle = '#1c1c1a'; x.lineWidth = 3; for (let k = 1; k < 8; k++) { const ang = Math.PI + k * Math.PI / 8; x.beginPath(); x.moveTo(CW / 2, PY(spring)); x.lineTo(CW / 2 + Math.cos(ang) * r, PY(spring) + Math.sin(ang) * r); x.stroke(); }
    x.beginPath(); x.arc(CW / 2, PY(spring), r * 0.45, Math.PI, 0); x.stroke(); x.restore();
    x.fillStyle = '#1c1c1a'; x.fillRect(ox0, PY(spring) - 3, ow * S, 6);
    x.fillStyle = 'rgba(120,124,112,0.55)'; x.fillRect(ox0 + 0.4 * S, PY(spring - 0.6), (ow - 0.8) * S, (spring - 3.4) * S); // glazing above the doors (the passage behind)
    x.strokeStyle = '#1c1c1a'; x.lineWidth = 3; for (let k = 1; k < 4; k++) { const xx = ox0 + ow * S * k / 4; x.beginPath(); x.moveTo(xx, PY(spring)); x.lineTo(xx, CH); x.stroke(); }
    x.fillRect(ox0, PY(3.0) - 2, ow * S, 4);
    // keystone, cornice band and the two figures over the arch (caryatid / atlas silhouettes)
    x.fillStyle = '#efe6d2'; x.fillRect(CW / 2 - 0.35 * S, PY(spring + ow / 2 + 0.55), 0.7 * S, 0.8 * S);
    const top = Math.min(H - 0.3, spring + ow / 2 + 1.0); x.fillStyle = '#e9dfc9'; x.fillRect(0, PY(top + 0.5), CW, 0.5 * S); x.fillStyle = 'rgba(70,58,42,0.4)'; x.fillRect(0, PY(top), CW, 3);
    for (const fx of [ox0 - 0.9 * S, ox1 + 0.9 * S]) { const fy = PY(spring + 0.2), hh = (spring - 3.0) * S; x.fillStyle = '#cdbf9f';
        x.beginPath(); x.ellipse(fx, fy - hh * 0.92, 0.22 * S, 0.27 * S, 0, 0, 7); x.fill(); x.fillRect(fx - 0.28 * S, fy - hh * 0.82, 0.56 * S, hh * 0.55); x.fillRect(fx - 0.2 * S, fy - hh * 0.3, 0.4 * S, hh * 0.3); x.fillStyle = '#e3d8c2'; x.fillRect(fx - 0.45 * S, fy, 0.9 * S, 0.35 * S); }
    const tex = canvasTexture(c);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: new THREE.Color('#ffd79a'), emissiveMap: tex, emissiveIntensity: 0 });
    m.userData.dayGlow = 0; m.userData.nightGlow = 0.35;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FW - 0.1, H), m); mesh.name = 'macca-vilacrosse-portal';
    mesh.position.set(cx + nx * 0.06, y0 + H / 2, cz + nz * 0.06); mesh.rotation.y = Math.atan2(nx, nz); ctx.add(mesh);
    // a projecting stone surround (pilasters + cornice) so the portal reads in relief
    const s = new GeoBatch(), yawS = Math.atan2(ux, uz);
    for (const sg of [-1, 1]) s.box(cx + ux * sg * (FW / 2 - 1.05) + nx * 0.2, y0, cz + uz * sg * (FW / 2 - 1.05) + nz * 0.2, 0.4, H - 0.6, 1.0, '#e2d7c1', 'stone', yawS);
    s.box(cx + nx * 0.25, y0 + top, cz + nz * 0.25, 0.5, 0.5, FW - 0.4, '#e9dfc9', 'stone', yawS);
    ctx.add(s.build('macca-vilacrosse-portal-surround'));
    return { x: cx, z: cz, nx, nz, w: FW, h: H };
}
