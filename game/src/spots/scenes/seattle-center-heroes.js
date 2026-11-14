// ============================================================================
//  Seattle Center — mapped hero shapes that the generic OSM volumes do not carry (r2-sea-spots-b-2).
//  - Olympic Iliad (OSM n3211770187, Alexander Liberman, 1984; Seattle Office of Arts & Culture SC84.088, quoted in
//    the node's tags): "41 monumental-scale bright red rolled steel cylinders ranging in size from 48 to 64 in diameter,
//    piled on top of one another at various angles", H 45' × W 60' × D 30'. Count, diameters and envelope are literal;
//    the individual tube lengths, angles and the pile's arrangement are estimates inside that envelope (deterministic).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { rng } from '../kit.js';
import { buildBuildings } from '../osm.js';
import { signBoard } from '../props.js';

const FT = 0.3048, IN = 0.0254;
export const ILIAD = { ll: [47.6193785, -122.3500573], n: 41, dMin: 48 * IN, dMax: 64 * IN, H: 45 * FT, W: 60 * FT, D: 30 * FT };

/** the tubes as [x, y, z (centre, local; x along the 60 ft length), yaw, tilt (0 = lying), length, diameter].
 *  Street View (panoramas LUaNF3kzF_XhFiy0kx43bA looking 278°, RB_2Feewsyx_qfiPQNLcaA looking 17°): an open arcade you
 *  walk under — upright tubes as legs in two rows along the length, one leaning out at the north end, and a tangle of
 *  lying and tilted tubes with oblique cut ends on top of them. The split (8 legs + 1 leaning + 32 on top), their
 *  heights and angles are estimates read from those views; deterministic. */
export function iliadPile({ seed = 1984 } = {}) {
    const r = rng(seed), out = [], I = ILIAD, d = () => I.dMin + (I.dMax - I.dMin) * r();
    const legH = 6.2;
    for (let i = 0; i < 8; i++) { const row = i % 2 ? 1 : -1, x = -I.W / 2 + 1.6 + (I.W - 4.5) * (Math.floor(i / 2) / 3) + (r() - 0.5) * 1.2, h = legH + (r() - 0.5) * 1.4;
        out.push([x, h / 2, row * (I.D / 2 - 1.6) + (r() - 0.5) * 0.8, 0, Math.PI / 2, h, d()]); }
    { const h = 8.5, lean = 0.42, dd = d(); out.push([I.W / 2 - 1.2 - Math.sin(lean) * h / 2, Math.cos(lean) * h / 2 + Math.sin(lean) * dd / 2, 0.8, 0, Math.PI / 2 - lean, h, dd]); } // the leaning tube at the end
    for (let i = 9; i < I.n; i++) {
        const k = (i - 9) / (I.n - 10), layer = r(), len = 3.5 + 5.5 * r(), dd = d(), tilt = (r() - 0.5) * (0.5 + 1.1 * layer);
        const half = Math.abs(Math.sin(tilt)) * len / 2 + dd / 2, y = Math.min(I.H - half, legH + 0.4 + half + layer * 3.2);
        const x = -I.W / 2 + 1.5 + (I.W - 3) * k + (r() - 0.5) * 2, z = (r() - 0.5) * (I.D - 2.2);
        out.push([x, y, z, (r() - 0.5) * 1.6, tilt, len, dd]);
    }
    return out;
}

function olympicIliad(ctx, { yaw = Math.PI / 2 } = {}) { // (long axis north–south: the panorama from the east sees it end to end)
    const p = ctx.ll(...ILIAD.ll), g = ctx.ground, y0 = g.heightAt(p.x, p.z);
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1, true); geo.rotateZ(Math.PI / 2); // unit tube along x
    const m = new THREE.MeshStandardMaterial({ color: '#c41e24', roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide }); m.name = 'olympic-iliad';
    const pile = iliadPile(), im = new THREE.InstancedMesh(geo, m, pile.length); im.name = 'olympic-iliad'; im.castShadow = true; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = Math.cos(yaw), sn = Math.sin(yaw);
    pile.forEach(([x, y, z, ty, tilt, len, d], i) => {
        const wx = p.x + x * c + z * sn, wz = p.z - x * sn + z * c;
        v.set(wx, y0 + y, wz); q.setFromEuler(e.set(0, ty + yaw, tilt, 'YXZ')); s.set(len, d, d); m4.compose(v, q, s); im.setMatrixAt(i, m4);
        if (tilt > 1.0) ctx.circle(wx, wz, d / 2 + 0.05, y0 + Math.sin(tilt) * len); // the upright legs are solid; you walk under the arcade
    });
    im.computeBoundingSphere(); ctx.add(im);
    return { x: p.x, z: p.z, y0 };
}

// ---------------------------------------------------------------------------- Climate Pledge Arena (OSM w25123756)
// Round 3. OSM: building=stadium, height 35 (the total top), and its building:parts: the roof w411521517 (white,
// roof:shape=pyramidal, min_height 8, height 33), the east buttress w1352666990 (skillion, 11 m), the south atria
// w1352647807 / w1352647810 (skillion, glass), w1352647812 (8 m, white), the Alaska Airlines Atrium w1270549342. The
// parent outline was drawn as a 35 m box of apartment windows that hid every part. Official panoramas (2026-11-13):
// xLh7PyEOCxKVuesNWAzPBw on 1st Ave N looking 270°: a glass curtain wall under a thin white roof fascia, a white sloped
// concrete A-frame (the mapped skillion buttress) at the middle of the east side; jLP72IlkxVljWg52cvsHAA on Thomas St
// looking 10° / 60°: the south side green-tinted glass with white mullions. Now: the parts are drawn as mapped (untagged
// colours white, glass parts as glass), the parent outline as the glass wall up to the roof part's min_height (8 m) with a
// white fascia; the parent's three narrow spurs (east x > −290.5, west x < −414.5, north z < −239.5: the buttress feet)
// are left to the parts. Mullion spacing and the fascia depth are estimates.
export const ARENA = 'w25123756';
export function arenaParts(d) { const bd = d.buildings.find((q) => q.id === ARENA); if (!bd) return new Set(); const out = new Set();
    for (const b of d.buildings) { if (!b.part || !b.poly?.length) continue; let x = 0, z = 0; for (const p of b.poly) { x += p[0] / b.poly.length; z += p[1] / b.poly.length; } if (inPolyXZ(x, z, bd.poly)) out.add(b.id); }
    return out; }
function inPolyXZ(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function climatePledgeArena(ctx) {
    const d = ctx.data, bd = d.buildings.find((q) => q.id === ARENA); if (!bd) return null;
    const g = ctx.ground, parts = arenaParts(d), roofPart = d.buildings.find((q) => q.id === 'w411521517');
    const y0 = Math.min(...bd.poly.map(([x, z]) => g.heightAt(x, z))), EAVE = roofPart?.minH ?? 8;
    // the parts, natively (source plan), untagged colours white
    const clone = { ...d, buildings: d.buildings.map((q) => (parts.has(q.id) && !q.c ? { ...q, c: '#e9e7e1' } : q)) };
    const B = buildBuildings(clone, g, { skip: new Set([...ctx.skipBuildings].filter((id) => id !== ARENA)), urban: false, filter: (q) => parts.has(q.id), /* the parent's skip would take its member parts with it */ style: (q) => (/glass/.test(q.mat || '') ? 'office' : 'concrete') });
    ctx.add(B.group); ctx.colliders.push(...B.colliders);
    // the buttresses and other solid parts are plain white concrete (no window tiles on a solid A-frame)
    const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }); plain.name = 'arena-concrete';
    for (const m of B.group.children) if (/:f-concrete$/.test(m.name)) m.material = plain;
    const spur = ([x, z]) => x > -290.5 || x < -414.5 || z < -239.5, P = bd.poly.filter((p) => !spur(p)), n = P.length;
    const glass = new THREE.MeshStandardMaterial({ color: '#4d5f60', roughness: 0.1, metalness: 0.5, envMapIntensity: 1.3, side: THREE.DoubleSide }); glass.name = 'arena-glass';
    const white = new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.7, side: THREE.DoubleSide }); white.name = 'arena-white';
    const wpos = [], fpos = [], mull = [];
    const partEdges = d.buildings.filter((q) => parts.has(q.id) && (q.minH || 0) < 1).flatMap((q) => q.poly.map((p, i) => [p, q.poly[(i + 1) % q.poly.length]]));
    const onPart = (x, z) => partEdges.some(([A, C]) => { const dx = C[0] - A[0], dz = C[1] - A[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / L2)); return Math.hypot(x - A[0] - dx * t, z - A[1] - dz * t) < 0.6; });
    let skipped = 0;
    for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        if (onPart((ax + bx) / 2, (az + bz) / 2)) { skipped++; continue; } // a ground-level part (the glass atria) draws this wall itself
        wpos.push(ax, y0 - 0.5, az, bx, y0 - 0.5, bz, bx, y0 + EAVE - 0.9, bz, ax, y0 - 0.5, az, bx, y0 + EAVE - 0.9, bz, ax, y0 + EAVE - 0.9, az);
        fpos.push(ax, y0 + EAVE - 0.9, az, bx, y0 + EAVE - 0.9, bz, bx, y0 + EAVE + 0.3, bz, ax, y0 + EAVE - 0.9, az, bx, y0 + EAVE + 0.3, bz, ax, y0 + EAVE + 0.3, az);
        for (let t = 1.6; t < L; t += 1.6) mull.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); }
    const mk = (pos, m, name) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, m); me.name = name; me.castShadow = true; me.receiveShadow = true; ctx.add(me); return me; };
    mk(wpos, glass, 'arena-glass-wall'); mk(fpos, white, 'arena-fascia');
    const mg = new THREE.BoxGeometry(0.14, EAVE - 0.9, 0.14); mg.translate(0, (EAVE - 0.9) / 2, 0); const mi = new THREE.InstancedMesh(mg, white, mull.length); mi.name = 'arena-mullions';
    const m4 = new THREE.Matrix4(); mull.forEach(([x, z], i) => { m4.makeTranslation(x, y0 - 0.2, z); mi.setMatrixAt(i, m4); }); ctx.add(mi);
    ctx.poly(P, { y0: y0 - 30, y1: y0 + EAVE + 0.3 });
    const aFrames = arenaAFrames(ctx, bd, y0), lettering = arenaLettering(ctx, P, y0, EAVE);
    return { aFrames, lettering, sourceId: ARENA, parts: [...parts], rendered: B.sourceMembers.map((m) => m.source), heroSkip: B.sourceGeometry.heroReplacements, wallTop: EAVE, mullions: mull.length, wallsLeftToParts: skipped, basis: 'parent outline and parts literal (OSM, untagged colours white); glass wall and fascia from panoramas' };
}

// (r3-sea-spots-b-4) The other A-frames. Only the east buttress is a mapped part (w1352666990: skillion, 11 m, 4.6 m wide,
// foot 15.5 m outside the glass wall, top 10.1 m inside it); the parent outline maps the feet of the west and north ones as
// the same 4.6 m spurs (west x < −413.6, north z < −239.1). Those two are drawn here with the east part's section: a white
// concrete wedge from the ground at the spur's outer end up to 11 m, 10.1 m inside the wall line. The south side has no
// spur (the atria cover it). Section copied from the east part; the inner end is an estimate.
function arenaAFrames(ctx, bd, y0) {
    const east = ctx.data.buildings.find((q) => q.id === 'w1352666990'), H = east?.h ?? 11, INNER = 10.1, P = bd.poly, out = [];
    const spur = (sel) => { const pts = P.filter(sel); if (pts.length < 4) return null; const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };
    const geo = new THREE.BufferGeometry(), pos = [];
    // wedge: foot (outer end, ground) → top (inner end, H); w = width across, (fx, fz) foot centre, (ux, uz) toward the building
    const wedge = (fx, fz, ux, uz, len, w) => { const vx = -uz * w / 2, vz = ux * w / 2, tx = fx + ux * len, tz = fz + uz * len, yb = y0 - 0.3, yt = y0 + H;
        const A = [fx + vx, yb, fz + vz], B = [fx - vx, yb, fz - vz], C = [tx - vx, yb, tz - vz], D = [tx + vx, yb, tz + vz], E = [tx - vx, yt, tz - vz], F = [tx + vx, yt, tz + vz];
        const q = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d), t = (a, b, c) => pos.push(...a, ...b, ...c);
        q(A, B, E, F); /* sloped face */ t(A, F, D); t(B, C, E); /* sides */ q(C, D, F, E); /* inner end */
        ctx.poly([[A[0], A[2]], [B[0], B[2]], [C[0], C[2]], [D[0], D[2]]], { y0: y0 - 1, y1: y0 + H }); };
    const w = spur((p) => p[0] < -415), n = spur((p) => p[1] < -241); // the spur vertices only (the walls wander ±0.5 m)
    if (w) { const W = w.z1 - w.z0, len = (-413.6 + INNER) - w.x0; wedge(w.x0, (w.z0 + w.z1) / 2, 1, 0, len, W); out.push({ side: 'west', foot: [+w.x0.toFixed(1), +((w.z0 + w.z1) / 2).toFixed(1)], len: +len.toFixed(1), width: +W.toFixed(1) }); }
    if (n) { const W = n.x1 - n.x0, len = (-239.1 + INNER) - n.z0; wedge((n.x0 + n.x1) / 2, n.z0, 0, 1, len, W); out.push({ side: 'north', foot: [+((n.x0 + n.x1) / 2).toFixed(1), +n.z0.toFixed(1)], len: +len.toFixed(1), width: +W.toFixed(1) }); }
    if (!pos.length) return out;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#e9e7e1', roughness: 0.75, side: THREE.DoubleSide }); m.name = 'arena-aframe';
    const me = new THREE.Mesh(geo, m); me.name = 'arena-aframes'; me.castShadow = true; me.receiveShadow = true; ctx.add(me);
    return out;
}
// (r3-sea-spots-b-4) "CLIMATE PLEDGE ARENA" lettering: noted as missing in the panorama review (seattle-spots.md), without
// its place. Put on the white fascia of the longest east-facing glass wall (1st Ave N, the side the review looked at),
// dark green letters filling the fascia band. Face, letter colour and size are estimates.
function arenaLettering(ctx, P, y0, EAVE) {
    let best = null; const n = P.length, A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 20) continue; const nx = A * (bz - az) / L, nz = -A * (bx - ax) / L; if (nx < 0.9) continue; if (!best || L > best.L) best = { L, mx: (ax + bx) / 2, mz: (az + bz) / 2, nx, nz }; }
    if (!best) return null;
    const w = Math.min(26, best.L * 0.7), sg = signBoard('CLIMATE PLEDGE ARENA', w, 1.0, { bg: '#eceae4', fg: '#1f4d3b', font: (s) => `800 ${s}px "Helvetica Neue", Arial, sans-serif`, frame: '#eceae4', depth: 0.06 });
    sg.position.set(best.mx + best.nx * 0.05, y0 + EAVE - 0.3, best.mz + best.nz * 0.05); sg.rotation.y = Math.atan2(best.nx, best.nz); ctx.add(sg);
    return { at: [+best.mx.toFixed(1), +best.mz.toFixed(1)], width: +w.toFixed(1) };
}

export function seattleCenterHeroes(ctx) {
    const iliad = olympicIliad(ctx), arena = climatePledgeArena(ctx);
    ctx.extras.seattleCenterHeroes = { arena, iliad: { sourceId: 'n3211770187', ...iliad, envelope: [ILIAD.W, ILIAD.D, ILIAD.H], tubes: ILIAD.n, basis: 'count, diameters, envelope literal (OSM tags); arrangement estimated' } };
    return { groups: [{ x: iliad.x + 14, z: iliad.z + 6, r: 3, n: 3, act: 'photo', look: [iliad.x, iliad.z], personas: ['tourist_us', 'tourist_de', 'photographer'] }] };
}
