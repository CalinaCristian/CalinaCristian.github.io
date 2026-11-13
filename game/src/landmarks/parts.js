// ============================================================================
//  Landmarks — Shared parts: aircraft, towers, flags, classical storeys, curtain-wall towers, facades, entrances and statues used by several landmarks.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { signedArea, offset, M } from './kit.js';

// ---------------------------------------------------------------------------
//  Reusable pieces
// ---------------------------------------------------------------------------
/** park an airliner nose-in at fraction t of a terminal outline */
/** narrow-body airliner (A320 / 737 size, ~38 m), nose along local +x. livery = {tail, belly, stripe} */
export function airliner(b, x, z, heading, lv = {}, len = 38) {
    // (after round 6, owner: "planes should look more realistic") A320 / 737-class: lathe-turned fuselage (round nose,
    // upswept tapering tail cone), swept trapezoid wings with dihedral, tailplanes and a raked fin as real planforms,
    // engines on pylons with dark intakes, cabin window line, doors, gear
    const k = len / 38, W = lv.body || '#f4f5f6', T = lv.tail || '#1d3f8f', GR = '#b9bec4', DK = '#2a2f36';
    b.push(M(x, 0, z, heading, k, k, k));
    const y = 3.3, R = 1.98;
    { // fuselage: profile (radius, x) from tail to nose
        const prof = [[0.02, -19.5], [0.45, -18.8], [1.05, -16.5], [1.6, -13.5], [1.94, -10], [R, -8], [R, 10.5], [1.9, 12.4], [1.6, 14.2], [1.1, 15.6], [0.5, 16.6], [0.02, 17.0]];
        const g = new THREE.LatheGeometry(prof.map(([r, xx]) => new THREE.Vector2(r, xx)), 18); g.rotateZ(-Math.PI / 2);
        // upswept tail: lift the tail section so the belly line rises toward the tail
        const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const xx = P.getX(i); if (xx < -8) P.setY(i, P.getY(i) + (-8 - xx) * 0.09); } g.computeVertexNormals();
        b.geo(g, W, M(0, y, 0));
    }
    const slab = (pts, t, col, mat) => { // planform (x, z) extruded t thick, lying flat (top at local y = 0)
        const sh = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, pz))); const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; };
    if (lv.belly) b.geo(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 18.5, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), lv.belly, M(1, y, 0, 0, 1, 1, 1, 0, -Math.PI / 2));
    if (lv.stripe) b.box(0, y + 0.05, 0, 18.4, 0.32, 2 * R + 0.03, lv.stripe);                       // cheat-line
    b.box(0.5, y + 0.62, 0, 21, 0.2, 2 * R * 0.985, DK, { mat: 'g' });                                  // cabin window line
    b.box(13.6, y + 0.78, 0, 1.6, 0.5, 2 * R * 0.86, DK, { mat: 'g' });                                 // cockpit windows
    for (const dx of [11.2, -14.6]) b.box(dx, y - 0.2, 0, 0.9, 1.9, 2 * R * 0.99, '#d9dcdf');             // doors
    for (const s of [-1, 1]) {
        // wing: root chord 6.2 m at the fuselage, tip 1.6 m at 17 m, 25° sweep, dihedral
        const wing = slab([[2.8, 0], [-3.4, 0], [-9.6, s * 16.6], [-8.0, s * 16.6]], 0.42, W);
        wing.rotateX(-s * 0.09); b.geo(wing, W, M(0, y - 1.25, s * 1.6));                                  // (tips up: dihedral)
        b.box(-9.3, y - 1.25 + 16.6 * 0.09, s * 18.15, 1.4, 1.5, 0.12, T, { rz: -0.35 });               // winglet at the tip
        // engine under the wing on a pylon
        b.cylX(1.4, y - 2.15, s * 5.7, 0.98, 3.8, GR, 14, { r2: 0.9 });
        b.cylX(3.32, y - 2.15, s * 5.7, 0.86, 0.08, DK, 14);                                               // intake
        b.cylX(-1.0, y - 2.15, s * 5.7, 0.55, 1.2, '#6c7178', 10, { r2: 0.8 });                             // exhaust
        b.box(0.6, y - 1.6, s * 5.7, 2.6, 0.7, 0.3, GR);                                                    // pylon
        // tailplane
        b.geo(slab([[-15.2, 0], [-18.6, 0], [-20.6, s * 6.4], [-19.2, s * 6.4]], 0.25, W), W, M(0, y + 0.95, s * 0.9));
        b.box(-0.9, 0, s * 2.7, 0.35, 2.2, 0.35, DK); b.cylX(-0.9, 0.55, s * 2.7, 0.55, 0.6, '#1c1f23', 10);    // main gear + wheel
    }
    { // fin: raked trapezoid
        const sh = new THREE.Shape([[-13.4, 0], [-19.8, 0], [-21.4, 6.6], [-18.6, 6.6]].map(([px, py]) => new THREE.Vector2(px, py)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); g.translate(0, 0, -0.15); b.geo(g, T, M(0, y + 1.65, 0));
    }
    b.box(11.4, 0, 0, 0.3, 2.1, 0.3, DK); b.cylX(11.4, 0.45, 0, 0.42, 0.45, '#1c1f23', 10);                    // nose gear
    b.pop();
}
/** simple ATC tower */
export function atcTower(b, x, z, h, o = {}) {
    const c = o.col || '#e6e4de';
    b.cyl(x, 0, z, o.r || 2.6, (o.r || 2.6) * 1.35, h - 7, c, 10);
    b.cyl(x, h - 7, z, 5.6, 3.2, 1.5, c, 10);
    b.cyl(x, h - 5.5, z, 6.2, 5.2, 4, '#3b5468', 10, { mat: 'g' });
    b.cyl(x, h - 1.5, z, 6.6, 6.6, 0.8, c, 10);
    b.cyl(x, h - 0.7, z, 0.25, 0.25, 6, '#d33', 6);
}

// ---------------------------------------------------------------------------
//  Palette
// ---------------------------------------------------------------------------
export const C = {
    cream: '#e8dec6', cream2: '#ded2b6', stone: '#d9d0bc', stoneDk: '#c4b9a2', white: '#f0eee8', conc: '#cfccc4',
    win: '#4a4d52', winWarm: '#5d564a', glass: '#55768f', glassDk: '#2c3a46', roof: '#7f7c78', slate: '#5f6469',
    gold: '#c9a13b', copper: '#6f9483', bronze: '#6e5a3c', red: '#b5352c', green: '#5f8f4a', water: '#7fb3d0',
    spray: '#eef6fb', tarmac: '#6d6f71', black: '#1f2326',
};

// ===========================================================================
//  BUCHAREST (1:1)
// ===========================================================================

/** Romanian tricolour (vertical blue-yellow-red) hanging from a mast top at (x, y, z), flag length L */
export function flag(b, x, y, z, L) { const h = L * 0.66, w = L / 3; ['#002b7f', '#fcd116', '#ce1126'].forEach((c, i) => b.box(x + w * (i + 0.5), y - h, z, w, h, 0.05, c)); }

/**
 * Classical block: walls of polygon p from y0 with a list of storeys [height, winWidthFrac, winHeightFrac, arched?],
 * window grid per storey (outer edges only, holes get plain walls), optional string course every storey, a
 * cornice on top and an optional balustrade/attic parapet. Returns the top height.
 */
export function storeys(b, p, y0, spec, o = {}) {
    const wall = o.wall || C.cream, win = o.win || C.winWarm, bay = o.bay || 4.2, holes = o.holes || [];
    let y = y0;
    const H = spec.reduce((a, s) => a + s[0], 0);
    b.prism(p, y0, y0 + H, wall, { holes, topCol: o.roofCol || '#cbc5b8' });
    spec.forEach(([h, wf, hf, arch], i) => {
        if (wf > 0) b.windows(p, y, y + h, h, win, { bay, wf, hf, start: h * (1 - hf) * (o.sillFrac ?? 0.45), arch, minL: o.minL ?? bay * 1.5, skip: o.skip ? (e, j, f, k) => o.skip(e, j, i, k) : null, mat: o.winMat });
        y += h;
        if (o.courses && i < spec.length - 1 && (o.courses === true || o.courses.includes(i))) b.cornice(p, y - 0.25, 0.35, 0.22, o.trim || wall);
    });
    if (o.pilasters) b.pilasters(p, y0 + (o.pilasterFrom ?? 0), y, bay * (o.pilasterEvery || 1), o.pilasterW || 0.9, 0.35, o.trim || wall, { inner: false });
    if (o.cornice !== false) b.cornice(p, y, o.corniceH || 1.1, o.corniceOut || 0.9, o.trim || wall, { holes });
    if (o.parapet) { const q = offset(p, -0.3); b.ring(q, y + 1.1, y + 1.1 + o.parapet, o.trim || wall); y += o.parapet; }
    return y + (o.corniceH || 1.1);
}

/** quad on the outside of segment a->b (outward normal n = [nx, nz]) from y0 to y1, pushed out by off */
export function facadeQuad(b, a, c, y0, y1, col, mat, n, off = 0.1) {
    const ox = n[0] * off, oz = n[1] * off;
    b.quad([a[0] + ox, y0, a[1] + oz], [c[0] + ox, y0, c[1] + oz], [c[0] + ox, y1, c[1] + oz], [a[0] + ox, y1, a[1] + oz], col, mat, [n[0], 0, n[1]]);
}
/** outward normal of edge i of polygon p */
export function edgeN(p, i) { const s = signedArea(p) > 0 ? 1 : -1, a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; return [s * (c[1] - a[1]) / L, -s * (c[0] - a[0]) / L]; }
/** index of the polygon edge whose outward normal is closest to direction d (e.g. [-1, 0] = west face) and that is at least minL long */
export function faceEdge(p, d, minL = 6) { let best = 0, bd = -2; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; if (Math.hypot(c[0] - a[0], c[1] - a[1]) < minL) continue; const n = edgeN(p, i), k = n[0] * d[0] + n[1] * d[1]; if (k > bd) { bd = k; best = i; } } return best; }

/**
 * Modern curtain-wall tower: spandrel-coloured prism with one glass ribbon per floor (2 tris per edge per floor),
 * optional vertical mullion fins and a parapet/crown screen. o = { glass, spandrel, mullion, pitch, fh, frac, crown, crownH, top }
 */
export function curtainTower(b, p, y0, y1, o = {}) {
    const fh = o.fh || 3.9;
    b.prism(p, y0, y1, o.spandrel || '#c8ced3', { topCol: o.top || '#9ca3a8' });
    b.bands(p, y0, y1 - 0.4, fh, o.glass || '#7f97ad', { frac: o.frac ?? 0.62, off: 0.07, mat: o.glassMat || 'g', start: o.start ?? fh * 0.25, wall: null });
    if (o.mullion) b.pilasters(p, y0, y1, o.pitch || 4.5, o.mw || 0.22, o.md || 0.22, o.mullion, {});
    if (o.crown) {
        const h = o.crownH || 6;
        b.ring(offset(p, 0.05), y1, y1 + h, o.crown, { mat: o.crownMat || 'm' });
        b.ring(offset(p, -0.25), y1, y1 + h, o.crown, { mat: o.crownMat || 'm', inward: true });
        if (o.louvres) for (let y = y1 + 0.8; y < y1 + h - 0.4; y += o.louvres) b.ring(offset(p, 0.18), y, y + 0.22, o.louvreCol || '#7c7f81');
    }
}

// ---- CV-stop helpers: a real entrance (door, surround, optional canopy) on the facade point nearest (px, pz), and a
// small tenant plate beside it (lines of 5x7 text) — door signs / plaques, never billboards (owner note 39).
export function nearestFacade(p, px, pz) {
    let best = null;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], c = p[(i + 1) % p.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 2) continue;
        const t = Math.max(1.5, Math.min(L - 1.5, ((px - a[0]) * dx + (pz - a[1]) * dz) / L)), x = a[0] + dx / L * t, z = a[1] + dz / L * t, d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) { const n = edgeN(p, i); best = { d, x, z, nx: n[0], nz: n[1], ux: dx / L, uz: dz / L }; }
    }
    return best;
}
export function entrance(b, f, o = {}) {
    const { x, z, nx, nz } = f, ux = -nz, uz = nx, ry = Math.atan2(nx, nz), w = o.w ?? 2.4, h = o.h ?? 2.9, y = o.y ?? 0;
    const at = (u, n) => [x + ux * u + nx * n, z + uz * u + nz * n];
    { const [cx, cz] = at(0, 0.1); b.box(cx, y, cz, w + 0.5, h + 0.35, 0.22, o.frame || '#3c3f42', { ry }); }
    { const [cx, cz] = at(0, 0.2); b.box(cx, y, cz, w, h, 0.08, o.door || '#7e959e', { ry, mat: o.doorMat || 'g' }); }
    if (o.canopy) { const [cx, cz] = at(0, o.canopy / 2); b.box(cx, y + h + 0.35, cz, w + 1.6, 0.25, o.canopy, o.canopyCol || '#3c3f42', { ry }); if (o.canopyText) { const [tx, tz] = at(0, o.canopy + 0.02); b.text(o.canopyText, tx, y + h + 0.37, tz, ry, o.canopyTextH || 0.2, o.canopyTextCol || '#f2f2f2', { d: 0.01 }); } }
    if (o.plate) {
        const pw = o.plate.w ?? 0.8, ph = o.plate.h ?? 0.55, side = o.plate.side ?? 1, u = side * (w / 2 + (o.plate.gap ?? 0.55) + pw / 2), yb = y + (o.plate.y ?? 1.35);
        const [cx, cz] = at(u, 0.04); b.box(cx, yb, cz, pw, ph, 0.05, o.plate.bg || '#1f3350', { ry });
        // (2026-11-08, owner: "still overlaps and is ugly") every line fits the plate (5×7 glyphs: width = n·6·h/7 − h/7), the
        // block is centred vertically, an optional thin border inset
        const pad = 0.06, fit = o.plate.lines.map(([t, th, tc]) => { const n = [...t].length; return [t, Math.min(th, (pw - 2 * pad) * 7 / Math.max(1, 6 * n - 1)), tc]; });
        let tot = fit.reduce((a2, [, th]) => a2 + th * 1.45, 0) - fit[fit.length - 1][1] * 0.45; const k = Math.min(1, (ph - 2 * pad) / tot);
        if (k < 1) { for (const f2 of fit) f2[1] *= k; tot *= k; }
        let yy = yb + ph / 2 + tot / 2;
        for (const [t, th, tc] of fit) { yy -= th; const [tx, tz] = at(u, 0.07); b.text(t, tx, yy, tz, ry, th, tc || '#f4f4f4', { d: 0.005 }); yy -= th * 0.45; }
        if (o.plate.border) { const bc = o.plate.border, [bx, bz] = at(u, 0.068), t2 = 0.012, i2 = 0.03;
            for (const [du, dy, ww, hh] of [[0, i2, pw - 2 * i2, t2], [0, ph - i2 - t2, pw - 2 * i2, t2], [-(pw / 2 - i2), i2, t2, ph - 2 * i2], [pw / 2 - i2, i2, t2, ph - 2 * i2]])
                b.box(bx + ux * side * 0 + ux * du, yb + dy, bz + uz * du, ww, hh, 0.006, bc, { ry }); }
    }
    return { x, z, nx, nz, ry };
}

/**
 * Statue silhouette (round 2): a standing figure (o.coat: long coat, o.robe: draped to the feet, o.reach: one arm raised)
 * or a seated one (o.seated, on a block of o.seat colour). h = overall height, front = local +z turned by ry. Boxes,
 * tapered cylinders and one low-poly head only: a silhouette class, not a likeness.
 */
export function statueFigure(b, x, y, z, ry, h, col, o = {}) {
    b.push(M(x, y, z, ry));
    if (o.seated) {
        const u = h / 1.45;                                                                       // seated height ≈ 1.45 units
        b.box(0, 0, -0.1 * u, 0.75 * u, 0.5 * u, 0.8 * u, o.seat || col);                         // seat block / rock
        b.box(0, 0.5 * u, 0.12 * u, 0.56 * u, 0.2 * u, 0.62 * u, col);                             // thighs
        for (const s of [-1, 1]) b.box(s * 0.16 * u, 0, 0.42 * u, 0.2 * u, 0.52 * u, 0.2 * u, col); // lower legs
        b.box(0, 0.62 * u, -0.14 * u, 0.5 * u, 0.56 * u, 0.3 * u, col, { rx: 0.14 });               // torso, leaning forward a little
        for (const s of [-1, 1]) b.box(s * 0.31 * u, 0.66 * u, 0.02 * u, 0.13 * u, 0.42 * u, 0.36 * u, col, { rx: 0.5 }); // arms on the knees
        b.sphere(0, 1.3 * u, 0.0, 0.15 * u, col, { detail: 1 });
    } else {
        const body = o.robe ? [0.2, 0.11, 0.6] : o.coat ? [0.17, 0.12, 0.56] : [0.13, 0.11, 0.5];   // hem radius, waist radius, height (× h)
        b.cyl(0, 0, 0, body[1] * h, body[0] * h, body[2] * h, col, 8);
        b.box(0, body[2] * h, 0, 0.27 * h, (0.84 - body[2]) * h, 0.15 * h, col);                   // chest and shoulders
        b.box(-0.165 * h, 0.5 * h, 0.01 * h, 0.07 * h, 0.33 * h, 0.09 * h, col);
        if (o.reach) b.box(0.17 * h, 0.78 * h, 0.03 * h, 0.07 * h, 0.34 * h, 0.08 * h, col, { rz: -0.35 });
        else b.box(0.165 * h, 0.5 * h, 0.01 * h, 0.07 * h, 0.33 * h, 0.09 * h, col);
        b.cyl(0, 0.84 * h, 0, 0.035 * h, 0.04 * h, 0.04 * h, col, 6);
        b.sphere(0, 0.935 * h, 0, 0.065 * h, col, { detail: 1 });
    }
    b.pop();
}
