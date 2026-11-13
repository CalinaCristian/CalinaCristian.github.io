// ============================================================================
//  Landmarks — Bucharest district-era landmarks (P2 footprints): GTS, Rosetti, BOB, The Bridge, Politehnica, The Landmark, Europe House, Hala Traian, Globalworth.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import { facadePanels, facadePiers } from '../facade-panels.js';
import * as THREE from '../../vendor/three.module.min.js';
import { pts, centroid, offset, M } from './kit.js';
import { P2 } from './footprints.js';
import { flag, facadeQuad, edgeN, faceEdge, curtainTower, nearestFacade, entrance } from './parts.js';

// Calea Călărașilor 101 (GTS Global Intelligence, 2015 CV stop) — OSM w245117704: listed (LMI B-II-m-B-18379) single-storey
// eclectic (Beaux-Arts) town house, ≈ 10 m street frontage x 30 m deep, N side of the street. From game/research/cv-buildings.md
// and the Commons photos "101 Calea Călărașilor, Bucharest (01)/(03)" (2023, CC BY-SA 4.0): warm off-white render #E6DCCD
// with rustication grooves, grey rendered plinth; three tall round-arched windows on the street front with stucco garland
// arches, scroll keystones and baluster panels; modillion cornice with a garland frieze; weathered grey zinc mansard with an
// arched dormer and oculi; the entrance is NOT on the street: a black wrought-iron gate on the WEST side opens onto a paved
// courtyard drive, the white panelled double door (glazed, transom) is on the long west façade up three steps, with an iron
// lantern and small company plates on the jamb (no billboard, owner note 39). Anchor = 8 m in front of the footprint centre.
// Src: game/research/cv-buildings.md (GTS) ; OSM w245117704 ; LMI B-II-m-B-18379
export function bGTS(b) {
    b.shift(0, -8);
    const [p] = P2.gts.map(pts), R = '#e8dfd0', TR = '#f0e9dc', ST = '#d8ccb6', PL = '#a9a39a', ZN = '#b3b7b2', ZD = '#9a9f9b', WF = '#f4f2ec', GL = '#4a5058', IR = '#16181a';
    b.wall = R;
    b.prism(p, 0, 5.6, R, { top: false });
    b.prism(offset(p, 0.06), 0, 0.85, PL, { top: false });                                   // grey plinth
    for (let k = 0; k < 5; k++) b.cornice(p, 1.25 + k * 0.62, 0.04, 0.03, '#d6ccbc');          // rustication grooves
    b.cornice(p, 4.55, 0.2, 0.1, ST); b.cornice(p, 4.75, 0.42, 0.16, TR);                    // architrave + garland frieze band
    b.cornice(p, 5.17, 0.43, 0.5, TR); b.piers(offset(p, 0.3), 5.0, 5.18, 0.75, ST, false, 0.35);   // modillion cornice
    // weathered zinc mansard: steep, slightly bowed lower slope, shallow upper slope, flat top
    const rings = [[offset(p, 0.35), 5.6], [offset(p, 0.05), 6.6], [offset(p, -0.3), 7.5], [offset(p, -0.75), 8.2], [offset(p, -2.3), 8.8]];
    for (let r = 0; r + 1 < rings.length; r++) { const [lo, y0] = rings[r], [hi, y1] = rings[r + 1], col = r === 3 ? ZD : ZN;
        for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; b.quad([lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]], [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]], col, 'm', [lo[i][0] - hi[i][0], 0.4 + r * 0.5, lo[i][1] - hi[i][1]]); } }
    b.cap(rings[4][0], 8.8, '#8f9490'); b.lip(p, rings[0][0], 5.6, ZN, 1);
    b.ring(offset(p, 0.4), 5.55, 5.75, '#6c7072');                                         // gutter
    // ---- frames
    const fa = [-7, 14], fc = [3.5, 15], fl = Math.hypot(fc[0] - fa[0], fc[1] - fa[1]), ux = (fc[0] - fa[0]) / fl, uz = (fc[1] - fa[1]) / fl, sn = [-uz, ux];   // street front, outward = south
    const wa = [-7, 14], wb = [-2.5, -15], wl = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]), wx = (wb[0] - wa[0]) / wl, wz = (wb[1] - wa[1]) / wl, wn = [wz, -wx];   // west facade, outward = west
    // ornate arched window: white frame with fanlight bars, stucco garland arch with festoon drops, scroll cartouche keystone, sill + baluster panel
    const win = (x, z, nx, nz, w = 1.25, h = 2.55, rich = true) => {
        const ry = Math.atan2(nx, nz);
        b.push(M(x + nx * 0.12, 0, z + nz * 0.12, ry));
        b.archWall(w + 0.34, h + w / 2 + 0.22, 0.1, [{ x: 0, w, h: h + w / 2 }], WF, M(0, 1.4, 0));
        b.box(0, 1.4, -0.07, w, h + w / 2, 0.04, GL, { mat: 'g' });
        b.box(0, 1.4, 0.0, 0.06, h + w / 2 - 0.05, 0.05, WF); b.box(0, 1.4 + h * 0.66, 0.0, w, 0.06, 0.05, WF); b.box(0, 1.4 + h, 0.0, w, 0.05, 0.05, WF);
        for (const d of [-1, 1]) b.box(d * w * 0.25, 1.4 + h, 0.0, 0.04, w * 0.42, 0.05, WF, { rz: d * 0.6 });   // fanlight bars
        if (rich) {
            b.geo(new THREE.TorusGeometry(w / 2 + 0.3, 0.11, 4, 12, Math.PI), ST, M(0, 1.4 + h, 0.08));       // garland arch
            for (const d of [-1, 1]) for (let k = 0; k < 3; k++) b.box(d * (w / 2 + 0.3), 1.4 + h - 0.25 - k * 0.32, 0.08, 0.16, 0.26, 0.14, ST);   // festoon drops
            const ky = 1.4 + h + w / 2 + 0.15; b.box(0, ky, 0.1, 0.42, 0.75, 0.16, ST); b.cyl(0, ky + 0.75, 0.12, 0.17, 0.17, 0.16, ST, 8, { rx: Math.PI / 2 });   // scroll cartouche
            b.box(0, 1.25, 0.08, w + 0.44, 0.12, 0.24, ST);                                                       // sill
            b.box(0, 0.75, 0.04, w + 0.3, 0.5, 0.08, ST); for (let k = -3; k <= 3; k++) b.cyl(k * (w + 0.1) / 7, 0.78, 0.1, 0.045, 0.06, 0.42, TR, 5);   // baluster panel
        }
        b.pop();
    };
    for (const t of [3.4, 6.0, 8.6]) win(fa[0] + ux * t, fa[1] + uz * t, sn[0], sn[1]);
    for (const t of [3.6, 15.5, 18.5, 22.5, 25.5]) win(wa[0] + wx * t, wa[1] + wz * t, wn[0], wn[1], 1.05, 2.3, t > 5 && t < 20);
    // canted corner (footprint cut at 45°): narrow arched window + cartouche on the chamfer, hipped corner pavilion roof
    { const ca = [-6.82, 12.81], cb = [-5.81, 14.11], mx = (ca[0] + cb[0]) / 2, mz = (ca[1] + cb[1]) / 2, dx = cb[0] - ca[0], dz = cb[1] - ca[1], dl = Math.hypot(dx, dz), cn = [-dz / dl, dx / dl], ry = Math.atan2(cn[0], cn[1]);
        win(mx, mz, cn[0], cn[1], 0.55, 2.5, false);
        b.box(mx + cn[0] * 0.12, 4.55, mz + cn[1] * 0.12, 0.42, 0.65, 0.16, ST, { ry });
        // pavilion roof: straight slopes to a short point, slight bell at the eaves (4-sided, aligned with the chamfer)
        const px = mx - cn[0] * 2.1, pz = mz - cn[1] * 2.1;
        b.geo(new THREE.LatheGeometry([[2.5, 0], [2.38, 0.3], [2.15, 1.9], [1.2, 2.9], [0.4, 3.35], [0.01, 3.4]].map(([a, c]) => new THREE.Vector2(a, c)), 4), ZN, M(px, 5.6, pz, ry + Math.PI / 4), 'm');
        b.cone(px, 8.95, pz, 0.09, 0.6, '#6c7072', 5);
    }
    // rusticated quoins at the street-east corner
    for (let k = 0; k < 7; k++) { const x = fc[0] - ux * 0.35 + sn[0] * 0.05, z = fc[1] - uz * 0.35 + sn[1] * 0.05; b.box(x, 0.9 + k * 0.52, z, k % 2 ? 0.55 : 0.8, 0.46, 0.12, TR, { ry: Math.atan2(sn[0], sn[1]) }); }
    { const ry = Math.atan2(sn[0], sn[1]), x = fa[0] + ux * 1.6 + sn[0] * 0.08, z = fa[1] + uz * 1.6 + sn[1] * 0.08; b.box(x, 3.0, z, 0.36, 0.24, 0.03, '#1d4f91', { ry }); b.text('101', x + sn[0] * 0.02, 3.05, z + sn[1] * 0.02, ry, 0.12, '#ffffff', { d: 0.005 }); }
    // oculi in the mansard (street: above the window piers; west: three) — on the steep lower slope
    const ocul = (x, z, nx, nz) => b.geo(new THREE.TorusGeometry(0.34, 0.11, 5, 12), '#7f8582', M(x + nx * 0.18, 7.0, z + nz * 0.18, Math.atan2(nx, nz), 1, 1, 1, -0.25));
    for (const t of [4.7, 7.3]) ocul(fa[0] + ux * t, fa[1] + uz * t, sn[0], sn[1]);
    for (const t of [11, 17, 23]) ocul(wa[0] + wx * t, wa[1] + wz * t, wn[0], wn[1]);
    // arched dormer on the west slope near the corner (front flush with the wall line)
    { const t = 5.6, x = wa[0] + wx * t + wn[0] * 0.05, z = wa[1] + wz * t + wn[1] * 0.05, ry = Math.atan2(wn[0], wn[1]);
        b.push(M(x, 0, z, ry)); b.box(0, 5.6, -0.6, 1.35, 1.7, 1.3, TR); b.box(0, 5.85, 0.06, 0.62, 1.2, 0.04, '#3f4246', { mat: 'g' });
        b.geo(new THREE.CylinderGeometry(0.68, 0.68, 1.3, 10, 1, false, -Math.PI / 2, Math.PI), TR, M(0, 7.3, -0.6, 0, 1, 1, 1, Math.PI / 2, 0)); b.pop(); }
    // entrance on the long west facade: projecting bay, white panelled double door + transom, three steps, lantern, thujas, jamb plates
    { const t = 9.6, x = wa[0] + wx * t, z = wa[1] + wz * t, ry = Math.atan2(wn[0], wn[1]);
        b.box(x + wn[0] * 0.25, 0.85, z + wn[1] * 0.25, 2.1, 3.9, 0.35, TR, { ry });
        entrance(b, { x: x + wn[0] * 0.42, z: z + wn[1] * 0.42, nx: wn[0], nz: wn[1] }, { y: 0.9, w: 1.4, h: 2.55, frame: WF, door: '#eeeae2', doorMat: 'm',
            plate: { w: 0.32, h: 0.4, y: 0.9, side: 1, bg: '#c9a85a', lines: [['GTS', 0.09, '#1f2a3a'], ['GLOBAL', 0.035, '#1f2a3a'], ['INTELLIGENCE', 0.035, '#1f2a3a']] } });
        b.box(x + wn[0] * 0.45, 3.45, z + wn[1] * 0.45, 1.4, 0.5, 0.05, '#8fa0a8', { ry, mat: 'g' });
        for (const d of [-0.36, 0.36]) { b.box(x + wn[0] * 0.66 + wx * d, 2.2, z + wn[1] * 0.66 + wz * d, 0.5, 1.15, 0.03, '#7f939b', { ry, mat: 'g' }); b.box(x + wn[0] * 0.66 + wx * d, 1.15, z + wn[1] * 0.66 + wz * d, 0.42, 0.42, 0.03, '#dcd7cd', { ry, rz: Math.PI / 4 }); }   // glazed upper panels + diamond lower panels
        for (let k = 0; k < 3; k++) b.box(x + wn[0] * (0.9 + k * 0.35), 0, z + wn[1] * (0.9 + k * 0.35), 2.2, 0.9 - k * 0.3, 0.36, '#c8c2b6', { ry });
        b.box(x + wn[0] * 0.55 - wx * 1.4, 3.6, z + wn[1] * 0.55 - wz * 1.4, 0.22, 0.34, 0.22, IR);
        const px = x + wn[0] * 2.2 + wx * 1.6, pz = z + wn[1] * 2.2 + wz * 1.6; b.cyl(px, 0, pz, 0.04, 0.05, 1.6, '#b98d78', 6); b.box(px, 1.6, pz, 0.22, 0.3, 0.22, '#b98d78');
        for (const d of [-1.9, 1.9]) b.cone(x + wn[0] * 0.9 + wx * d, 0, z + wn[1] * 0.9 + wz * d, 0.45, 3.2, '#9da544', 6); }
    // black wrought-iron gate on the west side at the street line: fence panel, pedestrian gate, arched double gate, stone pier
    { const ry = Math.atan2(sn[0], sn[1]), o = [fa[0] - ux * 0.95, fa[1] - uz * 0.95];   // start just west of the corner bay
        const P = (t) => [o[0] - ux * t, o[1] - uz * t];
        const span = (t0, t1, h0, arch, finials = true) => {
            const n = Math.round((t1 - t0) / 0.13);
            for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n, h = h0 + arch * Math.sin(Math.PI * k / n), [x, z] = P(t);
                b.box(x, 0.12, z, 0.03, h - 0.12, 0.03, IR, { ry }); if (finials && k % 2 === 0) b.cone(x, h, z, 0.05, 0.16, IR, 4); }
            for (const y of [0.15, 0.75, h0 - 0.1]) { const [x, z] = P((t0 + t1) / 2); b.box(x, y, z, t1 - t0, 0.05, 0.04, IR, { ry }); }
            if (arch > 0) for (let k = 0; k < 8; k++) { const ta = t0 + (t1 - t0) * (k + 0.5) / 8, h = h0 + arch * Math.sin(Math.PI * (k + 0.5) / 8) - 0.05, [x, z] = P(ta), sl = arch * Math.PI / (t1 - t0) * Math.cos(Math.PI * (k + 0.5) / 8); b.box(x, h, z, (t1 - t0) / 8 + 0.02, 0.05, 0.05, IR, { ry, rz: -Math.atan(sl) }); }
            for (const k of [0.33, 0.67]) { const [x, z] = P(t0 + (t1 - t0) * k); b.geo(new THREE.TorusGeometry(0.18, 0.02, 3, 10), IR, M(x, 1.15, z, ry)); }   // scrolls
        };
        const post = (t, h = 2.5) => { const [x, z] = P(t); b.box(x, 0, z, 0.12, h, 0.12, IR); b.sphere(x, h + 0.08, z, 0.09, IR, { detail: 0 }); };
        b.box(...(([x, z]) => [x, 0, z])(P(0.6)), 1.3, 0.45, 0.3, '#cfc8bb', { ry }); span(0, 1.2, 1.9, 0, true);              // fence panel on a low plinth
        post(1.25); span(1.3, 2.4, 2.0, 0.35); post(2.45, 2.7); span(2.5, 6.1, 2.1, 0.75); post(6.15, 2.7);
        const [qx, qz] = P(6.6); b.box(qx, 0, qz, 0.6, 2.7, 0.6, '#d2cbbd'); b.box(qx, 2.7, qz, 0.75, 0.15, 0.75, '#c4bcad');   // stone gate pier
    }
    b.colPolygon(p, { y1: 5.6 });
}

// Liceul Teoretic "C.A. Rosetti" (Str. Gen. Giuseppe Garibaldi 11, 2009 CV stop) — OSM w28240279: 3-level school
// block, U-shaped (wings to the west, base along Garibaldi). Research (bucharest-floreasca.md rosetti): 1950s-60s
// rendered masonry, cream #E8DDB8, white window frames, regular grid of tall windows, flat roof; gate on the W side
// of one-way (northbound) Garibaldi. Entrance with a canopy and the blue Romanian school name plate + flag.
// Src: game/research/bucharest-floreasca.md (rosetti, w28240279 row) ; OSM w28240279
export function bRosetti(b) {
    // (round 5) public photo of the school (bucharest.ro listing; viewed only, not kept): 3 storeys, beige textured render,
    // wide white PVC windows, low red standing-seam hipped roof with eaves, small entrance porch with a flat canopy.
    // (2026-11-08, owner: "use Street View and model it perfectly", compared side by side on Garibaldi / Bizet / Verdi)
    // the facade reads as horizontal bands: wide white windows in rows, muted salmon spandrels between the rows and under
    // the ground-floor windows, cream piers and frieze; a steel fire-escape stair on the Garibaldi face.
    const [p] = P2.rosetti.map(pts), W = '#e9e0c6', SA = '#f0cfbd', FR = '#f6f6f2', GL = '#4c5660', RF = '#b8333a', ST = '#b4babb';
    b.wall = W;
    b.prism(p, 0, 11.3, W, { top: false });
    b.prism(offset(p, 0.06), 0, 0.55, '#a7a49b', { top: false });                             // plinth
    for (const [y0, y1] of [[0.55, 1.2], [3.15, 4.8], [6.75, 8.4]]) b.prism(offset(p, 0.04), y0, y1, SA, { top: false });   // salmon spandrels
    b.windows(p, 1.2, 11.3, 3.6, FR, { bay: 3.2, wf: 0.8, hf: 0.54, start: 0, minL: 4, off: 0.08 });            // white frames
    b.windows(p, 1.2, 11.3, 3.6, GL, { bay: 3.2, wf: 0.74, hf: 0.48, start: 0.1, minL: 4, off: 0.11, mat: 'g' }); // glazing
    b.windows(p, 1.2, 11.3, 3.6, FR, { bay: 1.07, wf: 0.07, hf: 0.48, start: 0.1, minL: 4, off: 0.13 });         // mullions (3 lights per window)
    // low red standing-seam hipped roof with eaves (over the U plan)
    const lo = offset(p, 0.6), hi = offset(p, -4.6), y0 = 11.3, y1 = 13.4;
    for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; b.quad([lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]], [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]], RF, 'm', [lo[i][0] - hi[i][0], 1.5, lo[i][1] - hi[i][1]]); }
    b.cap(hi, y1, '#a52d33'); b.lip(p, lo, y0, '#d9d4c8', -1);
    const f = nearestFacade(p, 40, 7.4);                                                    // on the Garibaldi (east) face, level with the address node
    { const x = f.x + f.nx * 1.6, z = f.z + f.nz * 1.6, ry = Math.atan2(f.nx, f.nz); b.box(x, 0, z, 4.2, 3.4, 3.2, W, { ry }); b.box(x + f.nx * 0.2, 3.4, z + f.nz * 0.2, 4.8, 0.25, 3.8, '#e9e6de', { ry }); }   // entrance porch
    entrance(b, { x: f.x + f.nx * 3.2, z: f.z + f.nz * 3.2, nx: f.nx, nz: f.nz }, { w: 1.8, h: 2.5, frame: '#ece9e2', door: '#7a8a92', plate: { w: 0.9, h: 0.5, y: 1.25, gap: 0.25, bg: '#1d4f91', border: '#e8eef6', lines: [['LICEUL TEORETIC', 0.06, '#ffffff'], ['C.A. ROSETTI', 0.09, '#ffffff']] } }); // (owner: "sign goes outside": inside the porch face)
    { // the national flag on a pole slanting out from the facade above the porch canopy (owner: "flag goes in building": from
      // the porch front the pole ran up through the canopy's edge); bracket on the wall at 5.2 m, top 1.2 m out at 6.6 m
        const tx = -f.nz, tz = f.nx, B = [f.x + f.nx * 0.1 + tx * 1.55, 5.2, f.z + f.nz * 0.1 + tz * 1.55], T = [B[0] + f.nx * 1.2, 6.6, B[2] + f.nz * 1.2];
        b.box(B[0] - f.nx * 0.04, 5.0, B[2] - f.nz * 0.04, 0.14, 0.32, 0.12, '#b9bcbe'); b.strut(B, T, 0.025, 0.02, '#d9dcde');
        // (owner's sketch) the flag hangs from the top of the pole and runs away from it at right angles: its hoist along the
        // pole's top 0.62 m, blue at the pole, then yellow, then red
        const dl = Math.hypot(T[0] - B[0], T[1] - B[1], T[2] - B[2]), D = [(T[0] - B[0]) / dl, (T[1] - B[1]) / dl, (T[2] - B[2]) / dl];
        const hD = Math.hypot(D[0], D[2]), F = [D[0] / hD * D[1], -hD, D[2] / hD * D[1]];                       // ⟂ to the pole, outward and down
        const H = 0.62, Lf = 0.95, at = (u, v) => [T[0] - D[0] * (0.04 + u) + F[0] * v, T[1] - D[1] * (0.04 + u) + F[1] * v, T[2] - D[2] * (0.04 + u) + F[2] * v];
        ['#002b7f', '#fcd116', '#ce1126'].forEach((col, i) => { const v0 = i * Lf / 3, v1 = v0 + Lf / 3, a = at(0, v0), c2 = at(0, v1), d2 = at(H, v1), e2 = at(H, v0);
            b.quad(a, c2, d2, e2, col, 'm', [-tz, 0, tx]); b.quad(e2, d2, c2, a, col, 'm', [tz, 0, -tx]); }); }
    // steel fire-escape stair on the Garibaldi face, north of the entrance: landings at each floor, flights between, cage rails
    { const e = nearestFacade(p, 30, -6), ry = Math.atan2(e.nx, e.nz), tx = -e.nz, tz = e.nx, o = 1.25;
        const at = (u, v) => [e.x + e.nx * v + tx * u, e.z + e.nz * v + tz * u];
        for (const t of [0.04, 0.96]) { for (const u of [-1.3, 1.3]) { const [x, z] = at(u, o + (t - 0.5) * 2.3); b.box(x, 0, z, 0.07, 11.1, 0.07, ST, { ry }); } }
        for (let k = 1; k <= 3; k++) { const y = k * 3.6 - 0.1, [x, z] = at(0, o); b.box(x, y, z, 2.7, 0.08, 2.3, ST, { ry }); const [rx, rz] = at(0, o + 1.12); b.box(rx, y + 1.0, rz, 2.7, 0.05, 0.05, ST, { ry }); }
        for (let k = 0; k < 3; k++) { const ya = k * 3.6, yb = ya + 3.5, u0 = k % 2 ? 1.2 : -1.2, [x, z] = at(0, o - 0.45), sl = Math.atan2(yb - ya, 2.4);
            b.box(x, (ya + yb) / 2 - 0.05, z, 2.4 / Math.cos(sl), 0.08, 0.9, ST, { ry, rz: (u0 > 0 ? 1 : -1) * sl });
            const [hx, hz] = at(0, o - 0.02); b.box(hx, (ya + yb) / 2 + 0.95, hz, 2.4 / Math.cos(sl), 0.05, 0.05, ST, { ry, rz: (u0 > 0 ? 1 : -1) * sl }); } }   // flights + handrails
    b.colPolygon(p, { y1: 11.3 });
    // the school's sports hall (OSM w545176891, building=yes without tags; the world hides that footprint): one tall
    // volume measured on the aerial imagery (south facade seen obliquely: ≈ 12.5 m, scaled on the school's 11.3 m wall;
    // dark flat roof #52615c; yellow cladding over a grey band), a salmon single-storey entrance block on the yard side.
    { const [h] = P2.rosettiHall.map(pts), HY = '#e2c64a', HG = '#c9cbc6', HL = '#8e9494';
        b.prism(h, 0, 12.3, HG, { top: false });
        b.prism(offset(h, 0.05), 7.4, 12.1, HY, { top: false });                                 // yellow cladding
        for (let y = 4.4; y < 7.2; y += 0.32) b.prism(offset(h, 0.06), y, y + 0.12, HL, { top: false });   // louvre slats
        b.prism(offset(h, 0.12), 12.1, 12.5, '#a9adab', { top: false }); b.cap(h, 12.45, '#52615c');   // flashing + dark flat roof
        for (let i = 0; i < h.length; i++) { const [ax, az] = h[i], [bx, bz] = h[(i + 1) % h.length], L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 1.2);   // cladding seams
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, ry = Math.atan2(ux, uz);
            for (let k = 1; k < n; k++) { const x = ax + ux * L * k / n + nx * 0.1, z = az + uz * L * k / n + nz * 0.1; b.box(x, 7.4, z, 0.04, 4.7, 0.04, '#cdb23d', { ry }); } }
        const g = nearestFacade(h, 40, -60), ry = Math.atan2(g.nx, g.nz), tx = -g.nz, tz = g.nx;   // east face (the yard on Garibaldi)
        { const x = g.x + g.nx * 2.4, z = g.z + g.nz * 2.4; b.box(x, 0, z, 13, 4.2, 4.8, SA, { ry }); b.box(x, 4.2, z, 13.4, 0.3, 5.1, '#d9d4c8', { ry });
            b.box(x + g.nx * 2.42, 0.6, z + g.nz * 2.42, 12.2, 2.0, 0.04, '#4f5a60', { ry, mat: 'g' }); }   // salmon entrance block with its glazing
        entrance(b, { x: g.x + g.nx * 4.85 + tx * 3.5, z: g.z + g.nz * 4.85 + tz * 3.5, nx: g.nx, nz: g.nz }, { w: 1.8, h: 2.4, frame: '#e9e6de', door: '#5f6b72' });
        b.colPolygon(h, { y1: 12.5 }); }
    // the school gym west of the north wing (OSM w544207404, untagged; the world drew a 4-storey block): one hall measured
    // on the aerial — a long dark low-pitched roof, short shadow ≈ 6.5 m; plastered walls, a band of high windows, a door
    // toward the yard (2026-11-08, owner: "isn't the left building the gym?")
    { const [g] = P2.rosettiGym.map(pts), GW = '#e4dccb', y1 = 6.2;
        b.prism(g, 0, y1, GW, { top: false }); b.prism(offset(g, 0.05), 0, 0.5, '#a7a49b', { top: false });
        b.windows(g, 3.9, y1, 2.0, '#f2f2ee', { bay: 3.0, wf: 0.8, hf: 0.62, start: 0, minL: 6, off: 0.06 });          // high window band (frames)
        b.windows(g, 3.9, y1, 2.0, '#4c5660', { bay: 3.0, wf: 0.74, hf: 0.52, start: 0.1, minL: 6, off: 0.09, mat: 'g' });
        const lo = offset(g, 0.45), [c0, c1] = [g[0], g[1]], long01 = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > Math.hypot(g[2][0] - c1[0], g[2][1] - c1[1]);
        const [p0, p1, p2, p3] = long01 ? lo : [lo[1], lo[2], lo[3], lo[0]], yr = y1 + 1.4;        // low gable roof along the long side
        const r0 = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], r1 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], RC = '#45423b';
        b.quad([p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [r1[0], yr, r1[1]], [r0[0], yr, r0[1]], RC, 'm', [p0[0] - r0[0], 2, p0[1] - r0[1]]);
        b.quad([p2[0], y1, p2[1]], [p3[0], y1, p3[1]], [r0[0], yr, r0[1]], [r1[0], yr, r1[1]], RC, 'm', [p2[0] - r1[0], 2, p2[1] - r1[1]]);
        const gp = long01 ? [g[1], g[2], g[3], g[0]] : g;                                         // gable ends: plastered triangles
        for (const [a, c2] of [[gp[0], gp[1]], [gp[2], gp[3]]]) { const m2 = [(a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2]; b.quad([a[0], y1, a[1]], [c2[0], y1, c2[1]], [m2[0], yr - 0.05, m2[1]], [m2[0], yr - 0.05, m2[1]], GW, 'm', [m2[0] - (g[0][0] + g[2][0]) / 2, 0, m2[1] - (g[0][1] + g[2][1]) / 2]); }
        const d = nearestFacade(g, -20, -15); entrance(b, { x: d.x + d.nx * 0.12, z: d.z + d.nz * 0.12, nx: d.nx, nz: d.nz }, { w: 1.8, h: 2.4, frame: '#e9e6de', door: '#6b7a82' });
        b.colPolygon(g, { y1: 6.2 }); }
    b.covers.push([-41, -17]);                                                               // the gym's OSM footprint
    b.covers.push([-3.3, -60.7]);                                                            // the hall's OSM footprint
    // school grounds (OSM w253216276): drawn by the world (it knows the streets), always kept on the grounds' side of a street
    // (OSM draws the east edge on the Garibaldi centre line; 2026-11-08, owner: "the fence is on the street"). Compared with
    // Street View: welded-mesh panels on Garibaldi and Verdi, black bars on a painted plinth along Bizet; the gate on Garibaldi
    // in front of the entrance. The invented asphalt court is gone (the hall stands there).
    const G = pts([-32.1, 33.3, -29.3, 20.5, -61.1, 12.4, -56.6, -5.2, -78.1, -10.1, -71.1, -37, -45.8, -31.2, -34.3, -74.7, -28.7, -94.3, -8.8, -89.6, -1.2, -121.5, 53.8, -156.9, 67.7, -154.4, 60.2, -119.4, 24.1, 46]);
    const gx = f.x + f.nx * 12, gz = f.z + f.nz * 12, M = [50.5, -75]; // the gate: where the entrance axis meets the fence; M: Garibaldi, level with the hall
    b.fences.push({ line: [G[9], G[10], G[11], G[12], G[13], M], inside: G, style: 'mesh', h: 3.6 });                 // tall: round the sports ground
    b.fences.push({ line: [M, G[14]], inside: G, gates: [{ x: gx, z: gz, w: 5 }], style: 'mesh' });                     // the school front
    b.fences.push({ line: [G[14], G[0]], inside: G, style: 'bars', plinth: 'arches' });                                // Bizet
    b.fences.push({ line: G.slice(0, 10), inside: G, style: 'mesh' });                                                 // the neighbours
    // the sports ground between the hall and Verdi (not mapped in OSM; measured on the aerial mosaic, 2026-11-08): a blue
    // tartan surround, an artificial-turf mini-football pitch (≈ 22 × 39 m) with a red court at its north end, and a second
    // red court to the west of it
    { const lineQ = (a, c, w, y, col) => { const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
            b.quad([a[0] + nx, y, a[1] + nz], [c[0] + nx, y, c[1] + nz], [c[0] - nx, y, c[1] - nz], [a[0] - nx, y, a[1] - nz], col, 'm', [0, 1, 0]); };
        const outline = (q, y, col, w = 0.1) => { for (let i = 0; i < q.length; i++) lineQ(q[i], q[(i + 1) % q.length], w, y, col); };
        const mid = (a, c, t = 0.5) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const turf = pts([28.8, -127.7, 50.9, -122.6, 43.3, -84.8, 21.2, -89.9]), north = pts([30.8, -143.6, 55.3, -137.2, 50.9, -122.6, 28.8, -127.7]);
        const west = pts([0.8, -119, 19.8, -115.6, 19.4, -91, 0.4, -94.6]);
        const track = offset([north[0], north[1], turf[2], turf[3]], 3.2);
        b.cap(track, 0.06, '#3f6fb0'); b.cap(turf, 0.09, '#3f8a3a'); b.cap(north, 0.09, '#c4553d'); b.cap(west, 0.07, '#c4553d');
        const tin = offset(turf, -0.9); outline(tin, 0.12, '#f2f2ee');
        const h0 = mid(tin[0], tin[3]), h1 = mid(tin[1], tin[2]); lineQ(h0, h1, 0.1, 0.12, '#f2f2ee');                    // halfway line
        { const cx = (h0[0] + h1[0]) / 2, cz = (h0[1] + h1[1]) / 2; for (let k = 0; k < 20; k++) { const a0 = k / 20 * Math.PI * 2, a1 = (k + 1) / 20 * Math.PI * 2; lineQ([cx + 3 * Math.cos(a0), cz + 3 * Math.sin(a0)], [cx + 3 * Math.cos(a1), cz + 3 * Math.sin(a1)], 0.1, 0.12, '#f2f2ee'); } }
        for (const [e0, e1, s0, s1] of [[tin[0], tin[1], tin[3], tin[2]], [tin[3], tin[2], tin[0], tin[1]]]) {             // penalty areas (6 m deep, 12 m wide)
            const L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), a = mid(e0, e1, 0.5 - 6 / L), c = mid(e0, e1, 0.5 + 6 / L), d0 = mid(e0, s0, 6 / Math.hypot(s0[0] - e0[0], s0[1] - e0[1])), dz = [d0[0] - e0[0], d0[1] - e0[1]];
            const a2 = [a[0] + dz[0], a[1] + dz[1]], c2 = [c[0] + dz[0], c[1] + dz[1]]; lineQ(a, a2, 0.1, 0.12, '#f2f2ee'); lineQ(a2, c2, 0.1, 0.12, '#f2f2ee'); lineQ(c2, c, 0.1, 0.12, '#f2f2ee');
            const gm = mid(e0, e1), ux = (e1[0] - e0[0]) / L, uz = (e1[1] - e0[1]) / L, ry = Math.atan2(ux, uz);           // a small goal on the goal line
            for (const sg of [-1, 1]) b.box(gm[0] + ux * sg * 1.5, 0.09, gm[1] + uz * sg * 1.5, 0.08, 2.0, 0.08, '#f4f4f4');
            b.box(gm[0], 2.05, gm[1], 0.08, 0.08, 3.08, '#f4f4f4', { ry }); }
        for (const q of [north, west]) { const qi = offset(q, -1.2); outline(qi, 0.11, '#f2f2ee'); lineQ(mid(qi[0], qi[3]), mid(qi[1], qi[2]), 0.1, 0.11, '#f2f2ee'); }
        // basketball hoops at the ends of the red courts (2026-11-08, owner: "the hoops are gone from Rosetti"): a pole 1.2 m
        // behind the end line, an arm, the white backboard with its target square, an orange rim and a net; none at an end
        // that runs into the football pitch
        const inQ = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
        b.basketballCourt = { courts: [] };
        for (const q of [north, west]) {
            const L01 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), L12 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
            const ends = L01 > L12 ? [mid(q[1], q[2]), mid(q[3], q[0])] : [mid(q[0], q[1]), mid(q[2], q[3])];
            const cx = (ends[0][0] + ends[1][0]) / 2, cz = (ends[0][1] + ends[1][1]) / 2;
            const court = { polygon: q, center: [cx, q === west ? 0.07 : 0.09, cz], hoops: [] };
            b.basketballCourt.courts.push(court);
            for (const E of ends) {
                const dx = cx - E[0], dz = cz - E[1], dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl, ry = Math.atan2(ux, uz);
                if (inQ(E[0] - ux * 1.2, E[1] - uz * 1.2, turf) || inQ(E[0] + ux * 1.5, E[1] + uz * 1.5, turf)) continue;
                const P = (t) => [E[0] + ux * t, E[1] + uz * t], [px, pz] = P(0), [ax, az] = P(1.2), [bx, bz] = P(2.4), [rx, rz] = P(2.65), [tx, tz] = P(2.43);
                // Gameplay reads these same authored metres through the model's world transform.
                court.hoops.push({ rim: [rx, 3.045, rz], radius: 0.23, wire: 0.015,
                    board: [bx, 3.125, bz], normal: [ux, uz], width: 1.8, height: 1.05, thickness: 0.05 });
                b.cyl(px, 0.09, pz, 0.07, 0.085, 3.35, '#3a3d42', 8);
                b.box(ax, 3.2, az, 0.1, 0.1, 2.4, '#3a3d42', { ry });                                       // arm
                b.box(bx, 2.6, bz, 1.8, 1.05, 0.05, '#f2f2f0', { ry });                                     // backboard
                for (const [w2, h2, y2, o2] of [[0.59, 0.04, 2.9, 0], [0.59, 0.04, 3.31, 0], [0.04, 0.45, 2.9, -0.275], [0.04, 0.45, 2.9, 0.275]])
                    b.box(tx - uz * o2, y2, tz + ux * o2, w2, h2, 0.02, '#c2410c', { ry });                 // target square
                b.box(bx + ux * 0.1, 3.0, bz + uz * 0.1, 0.06, 0.06, 0.2, '#e8590c', { ry });               // rim bracket
                b.cyl(rx, 3.03, rz, 0.23, 0.23, 0.03, '#e8590c', 14, { open: true });                        // rim
                b.cyl(rx, 2.62, rz, 0.22, 0.14, 0.41, '#ededea', 8, { open: true });                         // net
            }
        }
        b.grounds.push(track, west); }
}

// BOB / "BOB Tower" (Globalworth, Bd. Dimitrie Pompeiu 6A, 2008; DB Global Technology 2017 CV stop) — OSM w55450549;
// research (bucharest-pipera.md db): GF + 6 floors (≈ 28 m), blue-green curtain wall #6F8C99 with grey spandrels,
// flat roof; on the south side of Pompeiu opposite Hermes; OSM entrance nodes on the north face (≈ -11.5, -30).
// Signage: building name on the entrance canopy + a small tenant plate (no rooftop logo found in research).
// Src: game/research/bucharest-pipera.md (db, w55450549 row; Globalworth BOB particulars) ; OSM w55450549
export function bBOB(b, ctx = {}) {
    // (round 5) landlord photos (globalworth.com / bob.globalworth.com; viewed only, not kept): GF + 6 glass block with
    // DARK horizontal spandrel bands, acute "prow" corners clad in white aluminium, a white projecting slab over a dark
    // granite ground floor with tall glazed entrances, thin projecting roof edge; lobby with a "DB Global Technology" desk.
    const source=ctx.sourceBuildings?.w55450549?.[0],p=source?.ring||P2.bob.map(pts)[0],GL='#6f9aa3',SP='#2c3336',WH='#e8eaea';
    const total=source?.h??28, roof=total-2.5, upper=roof-.5;
    b.prism(p, 0, 4.8, '#5a4d47', { top: false });                                            // dark granite ground floor
    b.windows(p, 0, 4.8, 4.8, '#3d4c52', { bay: 7.2, wf: 0.55, hf: 0.82, start: 0.1, minL: 6, mat: 'g', off: 0.06 });
    b.cornice(p, 4.8, 0.45, 2.4, WH, { solid: true });                                        // white projecting slab
    const bands=[],fh=(upper-5.25)/6;
    for(let y=5.8;y+fh*.7<=upper-.7;y+=fh)bands.push({lo:y,hi:y+fh*.7,colour:GL,material:'g'});
    facadePanels(p,5.25,upper,{wall:SP,bands,strips:(i,length)=>{
        const corners=[];
        if(i===0||i===2)corners.push({lo:0,hi:Math.min(3,length*.3),colour:WH});
        if((i+1)%p.length===0||(i+1)%p.length===2)corners.push({lo:length-Math.min(3,length*.3),hi:length,colour:WH});
        return [...corners,...facadePiers(length,1.6,.08,.12,'#3c4447')];
    }},(quad,colour,material,normal)=>b.quad(...quad,colour,material,normal));
    b.cap(p,upper,'#9ca3a8');
    b.cornice(p, upper, 0.5, 0.25, WH, { solid: true });                                        // thin projecting roof edge
    { const t = offset(p, -12); b.prism(t, roof, total, '#a3a7a8'); b.colPolygon(t,{y0:roof,y1:total}); }                        // plant enclosure
    const f = nearestFacade(p, -11.5, -30.2);
    entrance(b, f, { w: 4.8, h: 3.9, canopyText: null, plate: { w: 0.7, h: 0.5, y: 1.3, bg: '#ffffff', lines: [['DB', 0.14, '#0018a8'], ['GLOBAL', 0.05, '#0018a8'], ['TECHNOLOGY', 0.05, '#0018a8']] } });
    { const x = f.x + f.nx * 2.45 - f.nz * 4.2, z = f.z + f.nz * 2.45 + f.nx * 4.2, ry = Math.atan2(f.nx, f.nz); b.text('BOB', x, 4.95, z, ry, 0.5, '#2c3336', { d: 0.02 }); }   // building name on the slab edge
    b.colPolygon(p, { holes: source?.holes || [], y1: roof });
}

// The Bridge 1 (BCR headquarters), Soseaua Orhideelor 15D — OSM w661134293 (building=office, 11 levels, height 52, 2017).
// (owner, 2026-11-11: "BCR is famous landmark near the bridge, I want accurate representation of the building 1to1")
// Street View at 44.4452, 26.0608 (reference only, nothing kept): a glass office box on the literal OSM footprint, its
// ground floor set back behind a row of dark columns, ten glazed storeys behind a regular dark-grey mullion grid with
// dark floor bands, a flat roof edge; BCR's blue band with white lettering at the top corner and a blue canopy over the
// entrance on the Orhideelor side. Storey height, bay width and sign sizes are estimates.
export function bTheBridge1(b, ctx = {}) {
    const source = ctx.sourceBuildings?.w661134293?.[0], p = source?.ring; if (!p) return;
    const total = source.h ?? 52, gf = 5.2, roof = total - .6, GL = '#5f7f93', MU = '#3a4146', BL = '#1f5fbf', WH = '#ffffff';
    const inner = offset(p, -1.8);
    b.prism(inner, 0, gf, '#41494e', { top: false });                                                  // recessed ground floor
    b.windows(inner, 0, gf, gf, '#6d8a99', { bay: 3.6, wf: .78, hf: .86, start: .05, minL: 5, mat: 'g', off: .05 });
    b.pilasters(p, 0, gf, 7.2, .7, .7, MU, {});                                                       // the colonnade
    b.cornice(p, gf, .55, .2, MU, { solid: true });
    const fh = (roof - gf) / 10, bands = [];
    for (let i = 0; i < 10; i++) bands.push({ lo: gf + i * fh + .45, hi: gf + (i + 1) * fh - .05, colour: GL, material: 'g' });
    facadePanels(p, gf, roof, { wall: MU, bands, strips: (i, length) => facadePiers(length, 1.5, .09, .14, MU) }, (quad, colour, material, normal) => b.quad(...quad, colour, material, normal));
    b.cap(p, roof, '#8d9398');
    b.cornice(p, roof, .6, .15, MU, { solid: true });
    { const t = offset(p, -9); b.prism(t, roof, total + 1.6, '#9a9fa3'); }                               // plant screen
    // BCR: blue band with white letters at the top of the Orhideelor facade's corner, and the entrance canopy below
    const f = nearestFacade(p, 80, -80), ux = -f.nz, uz = f.nx, ry = Math.atan2(f.nx, f.nz);
    { const cx = f.x + ux * 14 + f.nx * .35, cz = f.z + uz * 14 + f.nz * .35; b.box(cx, roof - 3.4, cz, 18, 3.2, .3, BL, { ry }); b.text('BCR', cx + f.nx * .18, roof - 2.9, cz + f.nz * .18, ry, 2.2, WH, { d: .04 }); }
    entrance(b, { x: f.x + ux * 12, z: f.z + uz * 12, nx: f.nx, nz: f.nz }, { w: 5.2, h: 4.2, canopy: 2.4, canopyCol: BL, frame: MU });
    b.colPolygon(p, { holes: source.holes || [], y1: total });
}

// Rectoratul Universității Politehnica București (1970s) — OSM w28240552 (5 levels) + dome part. From the Commons refs
// (game/research/refs/grozavesti: "RO B Politehnica university rectorate", "Politehnica University of Bucharest 0x"):
// brick recessed lower floor, three red-panel storeys behind pale concrete fins and sills, a projecting slab, a recessed
// glazed top storey, a wide projecting roof slab and the big dark saucer dome (aula) on a
// glazed drum with the flag; blue-lit dome rim at night (research). Entrance on the north forecourt: canopy, flags,
// "RECTORAT" plate. Src: game/research/bucharest-grozavesti.md (upb, w28240552 row) ; OSM w28240552
export function bPolitehnica(b) {
    // Independent facade source: Mister rf's January 2024 Commons photos, including the oblique _04 view.
    // The main storeys have red infill, pale sills and vertical concrete fins; the recessed upper storey is glazing.
    // Heights and bay dimensions remain authoring estimates (OSM supplies five levels, no metre height).
    const [p] = P2.rectorat.map(pts), CON = '#b3afa6', FIN = '#dedbd0', BR = '#9b624b', RED = '#b52c35', GL = '#536b78', SL = '#dedbd0';
    const ground = offset(p, -1.2);
    b.prism(ground, 0, 3.8, BR, { top: false });
    b.windows(ground, 0, 3.8, 3.8, GL, { bay: 2.5, wf: 0.44, hf: 0.7, start: 0.65, mat: 'g' });
    b.prism(p, 3.8, 14.6, RED, { top: false });
    b.windows(p, 3.8, 14.6, 3.6, GL, { bay: 1.7, wf: 0.71, hf: 0.72, start: 0.66, mat: 'g', off: 0.08 });
    for (const y of [3.8, 7.4, 11.0, 14.25]) b.bands(p, y, y + 0.5, 0.5, FIN, { start: 0, frac: 0.36, off: 0.18 });
    b.pilasters(p, 0, 14.6, 1.7, 0.42, 1.0, FIN, {});                                       // dense vertical fins
    b.cornice(p, 14.6, 0.8, 1.6, SL, { solid: true });                                     // projecting slab
    const up = offset(p, -2.2);
    b.prism(up, 15.4, 19.8, RED, { topCol: CON }); b.bands(up, 15.4, 19.8, 4.4, GL, { frac: 0.68, start: 0.7, mat: 'g', wall: FIN, pitch: 0.65, pierW: 0.13 });
    b.cornice(p, 19.8, 0.7, 2.2, SL, { solid: true });                                     // wide roof slab
    const [cx, cz] = centroid(p);
    b.cyl(cx, 20.5, cz, 13.5, 13.5, 1.6, '#566470', 24, { mat: 'g' });                      // glazed drum
    b.geo(new THREE.LatheGeometry([[0.01, 5.6], [6, 5.2], [12, 3.9], [16.6, 2.2], [19.6, 0.6], [19.2, 0], [13.5, -0.2]].map(([a, c]) => new THREE.Vector2(a, c)), 32), '#80878a', M(cx, 22.1, cz), 'g');   // saucer dome
    b.geo(new THREE.TorusGeometry(19.45, 0.22, 4, 48), '#4f7fc7', M(cx, 22.65, cz, 0, 1, 1, 1, Math.PI / 2), 'nb');   // dome rim (blue-lit at night)
    b.cyl(cx, 27.7, cz, 3.2, 3.4, 1.2, '#6a7072', 12); b.cyl(cx, 28.9, cz, 0.06, 0.08, 6, '#d8d8d8', 5); flag(b, cx, 34.6, cz, 2.4);
    const f = nearestFacade(p, 0, -40);                                                    // north forecourt
    entrance(b, f, { w: 6, h: 3.4, canopy: 3, canopyCol: SL, plate: { w: 1.2, h: 0.5, y: 1.4, bg: '#e9e6df', lines: [['UNIVERSITATEA POLITEHNICA', 0.045, '#1b3f73'], ['RECTORAT', 0.13, '#1b3f73']] } });
    for (const [k, col] of [[-1, 'ro'], [0, 'eu'], [1, 'upb']]) {
        const x = f.x + f.nx * 9 - f.nz * k * 3, z = f.z + f.nz * 9 + f.nx * k * 3; b.cyl(x, 0, z, 0.07, 0.1, 9, '#e3e3e3', 6);
        if (col === 'ro') flag(b, x, 8.8, z, 2.2); else b.box(x + 1.1, 7.3, z, 2.2, 1.45, 0.05, col === 'eu' ? '#003399' : '#1b3f73');
    }
    b.colPoly([p], 14);
}


// The Landmark (Str. Vasile Alecsandri 4 / Căderea Bastiliei, 2016-17) — UiPath's Bucharest HQ (2020 CV stop) in
// "Corp B" (OSM w546500235, 7 levels, the address node Vasile Alecsandri 4 lies inside it); the sister block "Corp C"
// (w583612401, 7 levels) is left to the generic OSM buildings. Class-A offices: light stone / fibre-cement panels #D8D3C8 with regular vertical window bands, dark grey
// aluminium frames #3C3F42, glass #6F8A94, glazed ground floor with cafés (Ted's Coffee, Friddi), recessed top floor.
// Vasile Alecsandri is one-way southbound; the UiPath door is on its east side (west face of Corp B, ≈ 44.4499, 26.0944).
// Height: 7 levels ≈ 26 m (research table). No published exterior tenant signage -> street number only.
// Src: game/research/bucharest-romana.json/.md (uipath-buc, w546500235 row) ; OSM w546500235 / w583612401
export function bTheLandmark(b) {
    // (round 5) news photo of the campus (economica.net; viewed only, not kept): Corp B = four storeys of light-stone grid
    // with deep window reveals, topped by a cantilevered three-storey glass box with dark horizontal bands and a rooftop
    // metal mesh screen; glazed ground floor; landscaped courtyard with a pool between the blocks.
    const ps = P2.thelandmark.map(pts), ST = '#ddd6c8', FR = '#3c3f42', GL = '#6f8a94';
    // (round 2, panoramas at 44.450288, 26.094312 heading 143 and 44.449916, 26.094312 heading 66, viewed only): the
    // Vasile Alecsandri fronts are limestone to the top of the fifth upper storey, tall windows in deep reveals between
    // stone piers on every storey, a glazed ground floor BETWEEN the same piers, and one set-back glazed storey under the
    // roof screen. The model had its windows 0.25 m inside the wall (invisible: a blank stone block), a glass skirt
    // standing proud of the wall and three glass storeys. Storey heights stay estimates (OSM: 7 levels).
    const stoneTop = 4.2 + 5 * 3.75;
    for (const p of ps) {
        b.prism(p, 0, stoneTop, ST, { topCol: '#cfc8ba' });
        b.windows(p, 0, 4.2, 4.2, '#5f7780', { bay: 5.2, wf: 0.8, hf: 0.82, start: 0.15, mat: 'g', minL: 3, off: 0.06 });   // glazed ground floor between the piers
        b.windows(p, 4.2, stoneTop, 3.75, '#4a575e', { bay: 2.6, wf: 0.56, hf: 0.74, start: 0.5, mat: 'g', minL: 3, off: 0.06 });
        b.pilasters(p, 0, stoneTop, 5.2, 0.6, 0.3, ST, {});
        b.cornice(p, 4.2, 0.3, 0.2, ST); b.cornice(p, stoneTop - 0.3, 0.3, 0.25, ST);
        const top = offset(p, -1.2);                                                           // set-back glazed top storey
        curtainTower(b, top, stoneTop, 26.6, { glass: GL, spandrel: '#2f3438', mullion: '#8d9599', pitch: 1.5, mw: 0.08, md: 0.1, fh: 3.65, frac: 0.78, start: 0.3 });
        const sc = offset(p, -1.5); b.ring(sc, 26.6, 29.4, '#6c7175'); b.ring(offset(sc, -0.1), 26.6, 29.4, '#6c7175', { inward: true });   // rooftop mesh screen
    }
    // UiPath door on Vasile Alecsandri (west face of Corp B at the address point 44.4499, 26.0944): canopy + street number
    const dz = 12.4;
    b.box(-21.2, 4.4, dz, 3.4, 0.3, 6, FR); b.box(-19.6, 0, dz, 0.2, 3, 2.4, '#8fa3ad', { mat: 'g' });
    b.text('4', -19.82, 3.3, dz + 2.3, -Math.PI / 2, 0.8, '#f2f2f2');
    entrance(b, { x: -19.5, z: dz, nx: -1, nz: 0 }, { w: 2.2, h: 3, plate: { w: 0.6, h: 0.42, y: 1.3, side: 1, bg: '#ffffff', lines: [['UIPATH', 0.12, '#fa4616'], ['THE LANDMARK', 0.045, '#3c3f42']] } });
    for (const q of ps) b.colPolygon(q, { y1: 26.6 });
}

// Europe House (Bd. Lascăr Catargiu 47-53, 2001-02, CA Immo) — Arnia Software's office (2019 CV stop): one of
// Bucharest's first glass office buildings: blue-green reflective curtain wall #5E7F8C with grey aluminium mullions
// #9EA3A6 over a stone / grey-panelled base #B9B4AA, flat roof with plant room; ground + 10 floors (C&W listing; OSM
// says 14 levels incl. plant floors) ≈ 45 m. Footprint OSM w246115249 (slab along Lascăr Catargiu).
// Src: game/research/bucharest-romana.md (arnia — Europe House: europe_house_caimmo / _cw / _zf) ; OSM w246115249
export function bEuropeHouse(b) {
    // (round 5) news photos (officerentinfo.ro / bursa.ro; viewed only, not kept): long slab in DARK blue-grey reflective glass
    // with fine horizontal lines, a taller charcoal wedge-shaped volume at one end with the lit "Orange" rooftop sign (Orange
    // Romania offices are in the building), a light-grey panelled end box with small square windows and "EUROPE HOUSE"
    // lettering, shops on the ground floor. Which end carries the wedge is not certain from the photos (NW end assumed).
    // (round 3, official panorama 44.450804, 26.088191 heading 315, viewed only): the glass reads a lighter blue than the dark
    // slate it was, and the south-east end over Bd. Lascăr Catargiu is a rounded volume of grey bands between ribbon windows
    // (was a plain light-grey panelled box). Band pitch is an estimate; the rounding is not modelled.
    const [p] = P2.europehouse.map(pts), GL = '#56778f', FR = '#6d7880', BASE = '#8d8c88';
    b.prism(p, 0, 5.5, BASE, { top: false }); b.bands(p, 0.4, 5, 4.6, '#3f4f58', { frac: 0.8, wall: BASE, pitch: 4.8, start: 0.4 });
    curtainTower(b, p, 5.5, 44, { glass: GL, spandrel: '#2f3b46', mullion: FR, pitch: 1.6, mw: 0.08, md: 0.12, fh: 3.4, frac: 0.82, start: 0.3 });
    b.cornice(p, 5.4, 0.5, 0.35, FR);
    // charcoal wedge at the NW end (along the slab axis), rising to ≈ 56 m with a sloped top
    const ax = [36.5 - -34.5, 29.5 - -23.5], L = Math.hypot(...ax), ux = ax[0] / L, uz = ax[1] / L, nx = -uz, nz = ux;
    const c0 = [-31 + ux * 6, -26 + uz * 6], ry = Math.atan2(ux, uz);
    b.box(c0[0], 0, c0[1], 12, 46, 11, '#26292c', { ry: ry + Math.PI / 2 });
    b.geo((() => { const sh = new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(6, 0), new THREE.Vector2(-6, 10)]); const g = new THREE.ExtrudeGeometry(sh, { depth: 11, bevelEnabled: false }); g.translate(0, 0, -5.5); return g; })(), '#26292c', M(c0[0], 46, c0[1], ry - Math.PI / 2));
    // lit "Orange" sign on the wedge (real tenant signage)
    for (const sg of [-1, 1]) { const x = c0[0] + nx * sg * 5.6 - ux * 3.5, z = c0[1] + nz * sg * 5.6 - uz * 3.5, r2 = Math.atan2(nx * sg, nz * sg); b.box(x, 50.5, z, 4.2, 1.6, 0.1, '#ff7900', { ry: r2, mat: 'e' }); b.text('ORANGE', x + nx * sg * 0.06, 50.85, z + nz * sg * 0.06, r2, 0.8, '#ffffff', { mat: 'e', d: 0.01 }); }
    // south-east end volume: grey bands between ribbon windows (the real end is rounded; drawn square on the old end box)
    const c1 = [33 - ux * 4, 29 - uz * 4];
    b.box(c1[0], 5.5, c1[1], 9, 38.5, 9, '#8f9395', { ry: ry + Math.PI / 2 });
    for (let y = 6.6; y < 43; y += 3.4) b.box(c1[0], y, c1[1], 9.12, 1.9, 9.12, '#6f8ea3', { ry: ry + Math.PI / 2, mat: 'g' });
    { const t = offset(p, -3.5); b.prism(t, 44, 46, '#8e9396'); }
    { const [qx, qz] = centroid(p); b.box(qx, 46, qz, 10, 2.5, 6, '#9a9c9c'); }
    // Arnia (2019 CV stop): main door on Lascăr Catargiu nearest the address point, building name on the canopy, tenant plate
    entrance(b, nearestFacade(p, 20, 2.7), { w: 3.2, h: 3.4, canopy: 2.4, canopyCol: '#9ea3a6', canopyText: 'EUROPE HOUSE', canopyTextH: 0.18, canopyTextCol: '#20343d', plate: { w: 0.6, h: 0.36, y: 1.35, bg: '#ffffff', lines: [['ARNIA', 0.12, '#e2232a'], ['SOFTWARE', 0.05, '#3c3f42']] } });
    b.colPolygon(p, { y1: 44 });
}

// Hala Traian (Calea Călărașilor 133 × Str. Traian, 1896, arch. Giulio Magni; LMI B-II-m-A-18393) — one of the last
// two 19th-century market halls of Bucharest, now a Mega Image supermarket (red fascia on the historic hall). Two
// storeys, cream render with red-and-cream banded piers, a tall central gable to Calea Călărașilor (north) with a big
// arched iron-and-glass window and a pediment lettered "HALA TRAIAN", corner pavilions with finials, metal roof with a
// glazed monitor. Footprint OSM w35147215.
// Src: game/research/bucharest-unirii.json/.md (hala_traian, hala_traian_mega) ; OSM w35147215 ; refs/unirii/Bucharest_-_Hala_Traian_01.jpg,
//      Entrance_of_Hala_Traian_from_the_Calea_C_l_ra_i_in_Bucharest_Romania_.jpg (reference only)
export function bHalaTraian(b) {
    const [p] = P2.halatraian.map(pts), CR = '#ece3cf', RD = '#b8483a', WIN = '#40464b', H = 11.5;
    b.wall = CR;
    b.prism(p, 0, H, CR, { topCol: '#8d9295' });
    b.windows(p, 5.4, H - 0.8, 4.6, WIN, { bay: 3.4, wf: 0.4, hf: 0.62, start: 0.9, minL: 5 });       // first-floor windows
    b.prism(offset(p, 0.08), 0, 4.6, '#3a4248', { mat: 'g', top: false });                             // shopfronts
    b.cornice(p, 4.7, 0.5, 0.35, CR); b.cornice(p, H - 0.4, 0.8, 0.55, CR);
    // banded piers: red/cream stripes every 0.75 m on piers at ~5 m pitch
    for (let i = 0; i < p.length; i++) {
        const a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = edgeN(p, i), k = Math.max(1, Math.round(L / 5));
        for (let j = 0; j <= k; j++) {
            const t = j / k, x = a[0] + (c[0] - a[0]) * t + n[0] * 0.25, z = a[1] + (c[1] - a[1]) * t + n[1] * 0.25, ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
            const dx = (c[0] - a[0]) / L * 0.55, dz = (c[1] - a[1]) / L * 0.55, A2 = [x - dx, z - dz], B2 = [x + dx, z + dz];
            b.box(x, 0, z, 1.1, H - 0.5, 0.5, CR, { ry });
            for (let y = 0.75; y < H - 0.5; y += 1.5) facadeQuad(b, A2, B2, y, y + 0.75, RD, 'm', n, 0.26);
        }
    }
    // pitched metal roof with a glazed monitor along the hall (ridge N-S)
    const [cx, cz] = centroid(p);
    b.hip(cx, H + 0.4, cz, 34, 22, 4.2, '#878d91', { ry: Math.PI / 2 + 0.07 });
    b.box(cx, H + 3.4, cz, 4, 1.6, 26, '#9fb3bd', { mat: 'g', ry: 0.07 });
    // north gable on Calea Călărașilor: tall central pavilion, arched window, pediment + lettering, corner finials
    const gA = p[0], gB = p[4], gx = (gA[0] + gB[0]) / 2, gz = (gA[1] + gB[1]) / 2 - 0.6, gry = -Math.atan2(gB[1] - gA[1], gB[0] - gA[0]);
    b.push(M(gx, 0, gz, gry));
    b.box(0, 0, 0, 10, 15.5, 1.6, CR);
    for (let y = 0, s = 0; y < 15; y += 0.75, s++) for (const sx of [-4.4, 4.4]) b.box(sx, y, -0.95, 1.3, 0.75, 0.4, s % 2 ? RD : CR);
    b.archWall(6.4, 10.5, 0.3, [{ x: 0, w: 5.2, h: 10 }], CR, M(0, 1.2, -0.9));
    b.box(0, 1.2, -0.75, 5.2, 7.4, 0.12, '#5a6d78', { mat: 'g' });
    b.pediment(0, 15.5, -0.2, 11, 3.2, 1.8, CR, Math.PI);
    for (const sx of [-5.2, 5.2]) { b.box(sx, 15.5, 0, 1.4, 1.6, 1.4, CR); b.cone(sx, 17.1, 0, 0.75, 1.2, '#7f8589', 4); }
    b.pop();
    b.text('HALA TRAIAN', gx - 0.85 * Math.sin(gry), 13.2, gz - 0.85 * Math.cos(gry), gry + Math.PI, 0.7, '#6d6457');
    // Mega Image fascia on the Str. Traian side (east)
    const ei = faceEdge(p, [1, 0]), ea = p[ei], ec = p[(ei + 1) % p.length], en = edgeN(p, ei), ery = Math.atan2(en[0], en[1]);
    const mx = (ea[0] + ec[0]) / 2 + en[0] * 0.6, mz = (ea[1] + ec[1]) / 2 + en[1] * 0.6;
    b.box(mx, 3.6, mz, Math.hypot(ec[0] - ea[0], ec[1] - ea[1]) * 0.7, 1.2, 0.5, '#e2231a', { ry: -Math.atan2(ec[1] - ea[1], ec[0] - ea[0]) });
    b.text('MEGA IMAGE', mx + en[0] * 0.27, 3.85, mz + en[1] * 0.27, ery, 0.75, '#ffffff');
    b.colPolygon(p, { y1: H });
}

// Globalworth Tower (Bd. Barbu Văcărescu, 2016) — 120 m, 26-27 floors (OSM w547396774: height 120, 27 levels), the
// skyline marker of the Pipera / Floreasca office cluster next to Sky Tower. Glass curtain wall with vertical mullions
// (facade colours estimated, low confidence — no photo in refs).
// Src: game/research/bucharest-pipera.json landmarks[globalworth_tower] (wp_globalworth_tower: 118-120 m, 26 floors) ; OSM w547396774
export function bGlobalworth(b) {
    const [p] = P2.globalworth.map(pts);
    // (round 2, panoramas at 44.479318, 26.103249 heading 263 and 44.47893, 26.10196 heading 72, viewed only): the base
    // is a white-framed, double-height glazed podium (it was a navy block) and the shaft is grey-blue glass
    b.prism(offset(p, 0.3), 0, 11.5, '#e3e5e3', { top: false });
    b.windows(offset(p, 0.3), 0, 11.5, 5.75, '#5d7888', { bay: 4.6, wf: 0.84, hf: 0.86, start: 0.35, mat: 'g', minL: 4, off: 0.07 });
    b.cornice(offset(p, 0.3), 11.1, 0.4, 0.5, '#eceeec');
    curtainTower(b, p, 11.5, 114, { glass: '#66819a', spandrel: '#7890a2', mullion: '#c7cfd5', pitch: 3.2, mw: 0.16, md: 0.3, fh: 4.08, frac: 0.8, start: 0.3 });
    b.ring(offset(p, 0.05), 114, 120, '#6f8fa6', { mat: 'g' }); b.cap(offset(p, -0.3), 115.5, '#8e9498');
    b.colPolygon(p, { y1: 120 });
}
