// ============================================================================
//  Landmarks — Bucharest monuments: Dinamo stadium, Antipa museum, statues, Verona fountain, Grozăvești landmarks, water tower, Automatica, metro pavilion, Urseanu dome.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { makeDinamoPaintMesh } from '../landmark-pitch-paint.js';
import { materials, pts, rect, ellipse, offset, M } from './kit.js';
import { statueFigure } from './parts.js';

// ===========================================================================
//  Registry
// ===========================================================================
// [lat, lon, rotation]: anchor = centre of the OSM footprint's minimum-area rectangle,
// rotation = orientation of that rectangle (model +x axis), from the ways cited above.
// Stadionul Dinamo (1951, Șos. Ștefan cel Mare) — the Dinamo București bowl: athletics track round the pitch, terraced
// concrete stands on an embankment, the covered main stand (Tribuna I) on the west side, the long open east stand with
// red-and-white seats, the north curve (Peluza „Cătălin Hildan”), a low open south-west end, four floodlight masts.
// Geometry: OSM way 28212482 (outer outline of the stands), pitch way 427813551 (≈ 103 × 63 m, long axis 8.7° east of
// south), the rest from aerial imagery measurements (track: 400 m, 8 lanes, red tartan; stand depth 25–37 m; seat
// colours by sector; shadows of the NW / SE masts). Heights estimated (≈ 15,000 seats; main stand ≈ 14 m + roof).
// Src: https://en.wikipedia.org/wiki/Stadionul_Dinamo ; OSM ways 28212482, 427813551, 860001496 (Peluza Cătălin Hildan)
export const DIN_OUT = [-81.2,14.2,-82.3,1.4,-82.6,-15.3,-81.7,-30.5,-79.5,-47.1,-75.8,-60.2,-68.4,-74.8,-64.2,-80.7,-59.6,-86.1,-53.1,-92.3,-46.7,-97.1,-39.2,-101.7,-32.8,-104.7,-23.9,-107.8,-14.2,-109.9,-6.7,-110.6,2,-110.6,13,-109.2,10.5,-99.7,17.1,-98,23.4,-95.7,31.4,-91.7,32.7,-91.1,41.5,-84.9,49.5,-77.4,56.1,-69,61.2,-60.2,64.7,-51.8,72.7,-31.1,77.7,-13.5,81.3,10.7,81.6,26.5,81,36.3,79.8,46.7,78,56.5,76.2,66.1,72.8,76.1,68.7,84.3,62.7,93,55.7,100.6,36,114.9,37.2,123.3,23.1,126.3,12.8,127.3,3.2,126.9,-5.6,125.5,-12.3,123.6,-20.9,120.2,-27.6,116.7,-39.3,108.5,-51.9,96.2,-60.2,84.4,-66.6,70.7,-72,56.1,-76.6,39.8,-78.8,29.5];
const DIN_PITCH = [28.5,-48,-33.3,-38.7,-17.7,63.6,44,54.3];
// (fidelity pass round 2, 2026-11-12) "Groapa": the bowl lies in a pit. Street View from Calea Floreasca 33 and Șos. Ștefan
// cel Mare 7 shows no stand above a 2.5 m boundary wall, only the floodlight masts, and the access lane falling from the
// Ștefan cel Mare gate towards the pitch; the model stood 10–14 m above the street. OSM has no height / level / layer tag
// on w28212482 / r9146640. The depth is an estimate: EU-DEM 25 m (a smoothed surface model) has the pitch at 74–77 m and
// Calea Floreasca / Ștefan cel Mare 5–8 m higher, which under-reads a 190 m pit; stands of this size rise ≈ 9–10 m and
// their top rows meet the street. DIN_DEPTH = 9 m: the model is authored from the pitch (y = 0) as before and the whole
// group is lowered, so the pitch frame, the football activity and the collider bands move with it. The ground north and
// east of the real pit is as low as the pitch (the sports park); the game's district is flat, so the pit has a rim all round.
export const DIN_DEPTH = 9;
export function bDinamo(b) {
    const D = DIN_DEPTH; b.baseY = -D; // every height below is measured from the pitch; the street is at y = D
    const out = pts(DIN_OUT), pitchC = pts(DIN_PITCH);
    const cx = pitchC.reduce((s, p) => s + p[0], 0) / 4, cz = pitchC.reduce((s, p) => s + p[1], 0) / 4;
    // stadium frame: u along the pitch's long axis (toward the south end), v across (toward the east)
    const [p0, p1] = [pitchC[1], pitchC[2]], al = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const ux = (p1[0] - p0[0]) / al, uz = (p1[1] - p0[1]) / al, vx = uz, vz = -ux; // u ≈ south, v ≈ east (x east, z south)
    // Shared with the drone football activity: use this model's exact pitch frame.
    b.footballPitch = { center: [cx, 0.16, cz], axis: [ux, uz], halfLength: 52.06, halfWidth: 32.5, goalHalfWidth: 3.66, goalHeight: 2.34 };
    const W = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
    const RED = '#c8102e', WHITE = '#eeeeea', GREY = '#bdbbb5', CON = '#a9a69f', CON2 = '#8f8c85', TRACK = '#b5543f', APRON = '#3f7a68', GRASS = '#3f8a3a', GRASS2 = '#4a9a43';
    // capsule (400 m track) sampled by arc length: half-straight A, radius r; returns [{u, v, nu, nv}]
    const A = 42.195;
    const capsule = (r, step = 3) => {
        const o = [], L = 2 * A * 2 + 2 * Math.PI * r, n = Math.max(24, Math.round(L / step));
        for (let i = 0; i < n; i++) {
            let s = i / n * L; // start: east straight, north end → south end
            if (s < 2 * A) { o.push({ u: -A + s, v: r, nu: 0, nv: 1 }); continue; } s -= 2 * A;
            if (s < Math.PI * r) { const t = s / r; o.push({ u: A + Math.sin(t) * r, v: Math.cos(t) * r, nu: Math.sin(t), nv: Math.cos(t) }); continue; } s -= Math.PI * r;
            if (s < 2 * A) { o.push({ u: A - s, v: -r, nu: 0, nv: -1 }); continue; } s -= 2 * A;
            const t = s / r; o.push({ u: -A - Math.sin(t) * r, v: -Math.cos(t) * r, nu: -Math.sin(t), nv: -Math.cos(t) });
        }
        return o;
    };
    const poly = (cap) => cap.map(q => W(q.u, q.v));
    const RI = 36.5, RO = 36.5 + 8 * 1.22, RA = RO + 3.2; // track inner / outer edge, outer apron
    // ---- ground: apron (green-teal), red track with white lane lines, infield, pitch with mowing stripes and markings
    // (each layer is a ring round the next one — no stacked coplanar faces, which flicker from the air)
    const PL = 52, PW = 32.5, PM = 2;                                                     // half pitch (≈ 104 × 65 m) + grass margin
    const pitchRect = [W(-PL - PM, -PW - PM), W(PL + PM, -PW - PM), W(PL + PM, PW + PM), W(-PL - PM, PW + PM)];
    b.prism(poly(capsule(RA + 2.5)), 0, 0.08, '#7d8a7f', { holes: [poly(capsule(RA))] });  // service ring / concourse floor
    b.prism(poly(capsule(RA)), 0, 0.12, APRON, { holes: [poly(capsule(RO))] });
    b.prism(poly(capsule(RO)), 0, 0.16, TRACK, { holes: [poly(capsule(RI))] });
    for (let k = 0; k <= 8; k++) { const r = RI + k * 1.22; b.prism(poly(capsule(r + 0.05, 4)), 0.16, 0.2, '#f4f1ec', { holes: [poly(capsule(r - 0.05, 4))], top: true }); }
    b.prism(poly(capsule(RI)), 0, 0.15, TRACK, { holes: [pitchRect] });                     // the D zones (jumps, throws)
    for (let i = 0; i < 18; i++) { const u0 = -PL - PM + i * (2 * PL + 2 * PM) / 18, u1 = u0 + (2 * PL + 2 * PM) / 18; b.prism([W(u0, -PW - PM), W(u1, -PW - PM), W(u1, PW + PM), W(u0, PW + PM)], 0, 0.16, i % 2 ? GRASS : GRASS2); }
    // One alpha-coverage quad, with mips, replaces the exact same 57 paint strips.
    // Grass, pitch activity metadata, goals and colliders remain authored geometry.
    b.extras.push(makeDinamoPaintMesh(W, b.hs, materials().paint));
    for (const s of [-1, 1]) { const g = s * PL;
        // goals: posts + crossbar (white), net frame
        for (const v of [-3.66, 3.66]) { const [x, z] = W(g + s * 0.06, v); b.cyl(x, 0.16, z, 0.06, 0.06, 2.44, '#ffffff', 6); }
        // crossbar and net run across the pitch (along v; owner screenshot: they ran along it), the net as a see-through mesh
        const ryV = Math.atan2(vx, vz);
        const [gx, gz] = W(g + s * 0.06, 0); b.box(gx, 2.5, gz, 0.12, 0.12, 7.4, '#ffffff', { ry: ryV });
        for (let v = -3.6; v <= 3.61; v += 0.3) { const [mx, mz] = W(g + s * 1.6, v); b.box(mx, 0.16, mz, 0.025, 2.2, 0.025, '#e4e4e4'); } // back net
        for (let y = 0.4; y < 2.4; y += 0.3) { const [mx, mz] = W(g + s * 1.6, 0); b.box(mx, y, mz, 0.025, 0.025, 7.3, '#e4e4e4', { ry: ryV }); }
        for (const v of [-3.66, 3.66]) for (let t = 0.3; t < 1.6; t += 0.3) { const [mx, mz] = W(g + s * (0.06 + t), v); b.box(mx, 0.16, mz, 0.025, 2.2 + (2.44 - 2.2) * (1 - t / 1.6), 0.025, '#e4e4e4'); } // side nets
        for (const v of [-3.66, 3.66]) { const [ax0, az0] = W(g + s * 0.06, v), [ax1, az1] = W(g + s * 1.6, v); b.strut([ax0, 2.44, az0], [ax1, 2.36, az1], 0.04, 0.04, '#e4e4e4'); } }
    // ---- the bowl: terraces from the apron's outer edge up to the OSM outline, profile by sector
    const inner = capsule(RA + 2.5, 3.2);
    // The open bowl is also a playable ground. World clips only artificial
    // district-edge walls against this ring; physical stands stay collidable.
    b.footballPitch.playArea = poly(inner);
    const standBox = (corners, bands) => {
        const [a, c] = corners, dx = c[0] - a[0], dz = c[1] - a[1], angle = -Math.atan2(dz, dx), co = Math.cos(angle), si = Math.sin(angle);
        const q = corners.map(([x, z]) => [x * co - z * si, x * si + z * co]);
        const x0 = Math.min(...q.map(p => p[0])), x1 = Math.max(...q.map(p => p[0])), z0 = Math.min(...q.map(p => p[1])), z1 = Math.max(...q.map(p => p[1]));
        const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
        b.col(x * co + z * si, -x * si + z * co, (x1 - x0) / 2, (z1 - z0) / 2, angle, bands);
    };
    const rayHit = (px, pz, dx, dz) => { let best = Infinity; for (let i = 0; i < out.length; i++) { const [ax, az] = out[i], [bx, bz] = out[(i + 1) % out.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((ax - px) * ez - (az - pz) * ex) / den, s2 = ((ax - px) * dz - (az - pz) * dx) / den; if (t > 0 && s2 >= 0 && s2 <= 1 && t < best) best = t; } return best; };
    const sector = (q) => {
        if (q.u < -A - 4) return 'N';                                    // north curve: Peluza Cătălin Hildan
        if (q.u > A + 4) return q.v > 8 ? 'SE' : q.v < -8 ? 'SW' : 'S';
        return q.v > 0 ? 'E' : 'W';
    };
    const H = { N: D + 0.6, E: D + 1, W: D + 1.6, SE: D, S: D, SW: D }; // top rows about level with the street (rim 0–1.6 m above it)
    const seatCol = (sec, k, t, T) => {
        if (sec === 'SW' || sec === 'S') return null;                    // grassed embankment
        const blk = Math.floor(k / 5);
        if (sec === 'E') return t === T - 1 ? GREY : blk % 3 === 1 ? WHITE : RED;
        if (sec === 'SE') return blk % 2 ? WHITE : RED;
        if (sec === 'N') return blk % 4 === 0 ? GREY : WHITE;
        return blk % 2 ? RED : '#a01a2b';                                // main stand: red
    };
    const T = 9, prof = [];
    for (let k = 0; k < inner.length; k++) {
        const q = inner[k], [ix, iz] = W(q.u, q.v); const dx = ux * q.nu + vx * q.nv, dz = uz * q.nu + vz * q.nv;
        let d = rayHit(ix, iz, dx, dz); if (!isFinite(d) || d > 45) d = 20; d = Math.max(4, d - 0.4);
        const sec = sector(q); prof.push({ ix, iz, dx, dz, d, sec, h: H[sec] });
    }
    // (2026-11-08, owner: "stadium a bit broken") the sector heights jumped at every joint (steps and back wall broke into
    // ledges): ramp them over ≈ ±19 m with a moving average round the bowl
    { const h0s = prof.map(p => p.h), m = prof.length, Wn = 6; for (let k = 0; k < m; k++) { let sum = 0; for (let j = -Wn; j <= Wn; j++) sum += h0s[(k + j + m) % m]; prof[k].h = sum / (2 * Wn + 1); } }
    const n = prof.length, P = (pr, t, y) => [pr.ix + pr.dx * pr.d * t, y, pr.iz + pr.dz * pr.d * t];
    for (let k = 0; k < n; k++) {
        const a = prof[k], c = prof[(k + 1) % n], h0 = 1.1, ha = a.h, hc = c.h;
        standBox([P(a, 0, 0), P(c, 0, 0), P(c, 1, 0), P(a, 1, 0)].map(p => [p[0], p[2]]), { h: Math.max(ha, hc) + 1.1 });
        const grass = !seatCol(a.sec, k, 0, T);
        if (grass) { // grass embankment with a low wall at the track
            b.quad(P(a, 0, h0 * 0.6), P(c, 0, h0 * 0.6), P(c, 1, hc), P(a, 1, ha), '#5f8a4a', 'm', [0, 1, 0]);
            b.quad(P(a, 0, 0), P(c, 0, 0), P(c, 0, h0 * 0.6), P(a, 0, h0 * 0.6), CON, 'm', [-a.dx, 0, -a.dz]);
        } else for (let t = 0; t < T; t++) {
            const y0a = h0 + (ha - h0) * t / T, y1a = h0 + (ha - h0) * (t + 1) / T, y0c = h0 + (hc - h0) * t / T, y1c = h0 + (hc - h0) * (t + 1) / T;
            b.quad(P(a, t / T, y0a), P(c, t / T, y0c), P(c, t / T, y1c), P(a, t / T, y1a), CON2, 'm', [-a.dx, 0, -a.dz]);           // riser
            b.quad(P(a, t / T, y1a), P(c, t / T, y1c), P(c, (t + 1) / T, y1c), P(a, (t + 1) / T, y1a), seatCol(a.sec, k, t, T), 'm', [0, 1, 0]); // seat row
        }
        if (!grass) b.quad(P(a, 0, 0), P(c, 0, 0), P(c, 0, h0), P(a, 0, h0), '#e8e6e0', 'm', [-a.dx, 0, -a.dz]); // perimeter wall at the track
        // back wall down to the street (concrete with a darker plinth), parapet on top
        b.quad(P(a, 1, D - 0.3), P(c, 1, D - 0.3), P(c, 1, hc + 1.1), P(a, 1, ha + 1.1), CON, 'm', [a.dx, 0, a.dz]); // (only the parapet stands above the street)
        b.quad(P(a, 1, ha), P(c, 1, hc), P(c, 1, hc + 1.1), P(a, 1, ha + 1.1), CON2, 'm', [-a.dx, 0, -a.dz]);
        b.quad(P(a, 1, ha + 1.1), P(c, 1, hc + 1.1), [P(c, 1, 0)[0] + c.dx * 0.3, hc + 1.1, P(c, 1, 0)[2] + c.dz * 0.3], [P(a, 1, 0)[0] + a.dx * 0.3, ha + 1.1, P(a, 1, 0)[2] + a.dz * 0.3], '#cfccc4', 'm', [0, 1, 0]);
        // vomitories (dark openings) every ~25 m on the main sectors
        if (!grass && k % 8 === 3) { const t0 = 0.45; const pa = P(a, t0, h0 + (ha - h0) * t0), pc = P(c, t0, h0 + (hc - h0) * t0); b.quad([pa[0], pa[1] + 0.02, pa[2]], [pc[0], pc[1] + 0.02, pc[2]], [pc[0] + c.dx * 2.5, pc[1] + 0.02, pc[2] + c.dz * 2.5], [pa[0] + a.dx * 2.5, pa[1] + 0.02, pa[2] + a.dz * 2.5], '#2a2a2a', 'm', [0, 1, 0]); }
    }
    // ---- main stand roof (west, Tribuna I): a cantilevered slab over the central ~110 m, on columns at the back
    const west = prof.filter(p => p.sec === 'W');
    if (west.length > 4) {
        const mid = west.slice(Math.floor(west.length * 0.12), Math.ceil(west.length * 0.88));
        for (let i = 0; i < mid.length - 1; i++) {
            const a = mid[i], c = mid[i + 1], yb = a.h + 4.6, yf = a.h + 3.6;
            const back = (p) => [p.ix + p.dx * (p.d + 0.6), 0, p.iz + p.dz * (p.d + 0.6)], front = (p) => [p.ix + p.dx * p.d * 0.22, 0, p.iz + p.dz * p.d * 0.22];
            const ba = back(a), bc = back(c), fa = front(a), fc = front(c);
            standBox([fa, fc, bc, ba].map(p => [p[0], p[2]]), { y0: yf - 0.5, y1: yb });
            b.quad([ba[0], yb, ba[2]], [bc[0], yb, bc[2]], [fc[0], yf, fc[2]], [fa[0], yf, fa[2]], '#d9dcdf', 'm', [0, 1, 0]);
            b.quad([ba[0], yb - 0.5, ba[2]], [fa[0], yf - 0.5, fa[2]], [fc[0], yf - 0.5, fc[2]], [bc[0], yb - 0.5, bc[2]], '#8c9196', 'm', [0, -1, 0]);
            b.quad([fa[0], yf - 0.5, fa[2]], [fa[0], yf, fa[2]], [fc[0], yf, fc[2]], [fc[0], yf - 0.5, fc[2]], RED, 'm', [-a.dx, 0, -a.dz]); // red fascia
            if (i % 3 === 0) { b.box(ba[0], a.h, ba[2], 0.6, yb - a.h, 0.6, '#7d8288'); b.strut([ba[0], yb - 0.4, ba[2]], [fa[0] * 0.5 + ba[0] * 0.5, yb - 0.4 - 0.8, fa[2] * 0.5 + ba[2] * 0.5], 0.25, 0.25, '#7d8288'); }
        }
        // VIP box / press row under the roof (glass band)
        const vb = mid.map(p => [p.ix + p.dx * p.d * 0.92, p.iz + p.dz * p.d * 0.92]);
        for (let i = 0; i < vb.length - 1; i++) b.quad([vb[i][0], mid[i].h - 0.2, vb[i][1]], [vb[i + 1][0], mid[i + 1].h - 0.2, vb[i + 1][1]], [vb[i + 1][0], mid[i + 1].h + 2.4, vb[i + 1][1]], [vb[i][0], mid[i].h + 2.4, vb[i][1]], '#3c4b57', 'g', [-mid[i].dx, 0, -mid[i].dz]);
    }
    // ---- scoreboard on the north curve, facing the pitch
    { const q = prof.reduce((m, p) => (p.sec === 'N' && Math.abs(-(p.ix - cx) * vx - (p.iz - cz) * vz) < Math.abs(-(m.ix - cx) * vx - (m.iz - cz) * vz) ? p : m), prof.find(p => p.sec === 'N') || prof[0]);
      const [sx, sz] = [q.ix + q.dx * q.d * 0.9, q.iz + q.dz * q.d * 0.9], ry = Math.atan2(q.dx, q.dz);
      // (2026-11-08, owner screenshot) on legs above the stand: the real building behind the north curve hid the lower half
      const yb = q.h + 1.2; // (round 2: the bowl is sunk, nothing hides the board any more: short legs)
      b.box(sx, yb, sz, 16, 7, 1.2, '#1e2227', { ry }); b.box(sx - q.dx * 0.62, yb + 0.8, sz - q.dz * 0.62, 14.4, 5.4, 0.05, '#20303a', { ry, mat: 'e' });
      b.text('DINAMO', sx - q.dx * 0.7, yb + 2.4, sz - q.dz * 0.7, ry + Math.PI, 2.2, '#e0302e', { mat: 'e' });
      for (const s of [-1, 1]) { b.box(sx + Math.cos(ry) * s * 6, q.h, sz - Math.sin(ry) * s * 6, 0.8, yb - q.h + 0.2, 0.8, '#6f747a'); b.box(sx + Math.cos(ry) * s * 6, yb - 2.5, sz - Math.sin(ry) * s * 6, 0.4, 0.3, 3.0, '#6f747a', { ry }); } }
    // ---- four floodlight masts outside the corners (lattice-tapered shafts, a tilted lamp frame facing the centre)
    for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const ang = Math.atan2(sv * 0.62, su), qd = { nu: Math.cos(ang), nv: Math.sin(ang) };
        const dx = ux * qd.nu + vx * qd.nv, dz = uz * qd.nu + vz * qd.nv;
        const bx0 = cx + ux * su * (A + 4) + vx * sv * (RA + 2), bz0 = cz + uz * su * (A + 4) + vz * sv * (RA + 2);
        const d = rayHit(bx0, bz0, dx, dz); const mx = bx0 + dx * ((isFinite(d) ? d : 25) - 2.5), mz = bz0 + dz * ((isFinite(d) ? d : 25) - 2.5); // (round 2: on the rim inside the mapped outline; 3 m outside it the north-west mast stood in the Calea Floreasca car park)
        const Hm = 44, ry = Math.atan2(dx, dz);
        b.geo(new THREE.CylinderGeometry(0.55, 1.4, Hm, 4, 1), '#9aa1a8', M(mx, D + Hm / 2, mz, ry + Math.PI / 4)); // (the masts stand on the street-level rim)
        for (let y = 4; y < Hm - 2; y += 4) b.box(mx, D + y, mz, 2.2 - y / Hm * 1.2, 0.12, 0.12, '#7e858c', { ry });
        const hx = mx - dx * 1.2, hz = mz - dz * 1.2;
        b.box(hx, D + Hm, hz, 9, 5.5, 0.5, '#5d636a', { ry, rx: 0 });
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(hx - dx * 0.3 + Math.cos(ry) * (i - 1.5) * 2.1, D + Hm + 0.5 + j * 1.7, hz - dz * 0.3 - Math.sin(ry) * (i - 1.5) * 2.1, 1.6, 1.2, 0.2, '#fff6dd', { ry, mat: 'e' });
        b.col(mx, mz, 1.4, 1.4, 0, { h: D + Hm + 6 });
    }
    // ---- the Șos. Ștefan cel Mare gate (round 2b): OSM n11383452958 (barrier=gate, 44.453207, 26.102647) on the access
    // lane. Panoramas at 44.453094, 26.102688 heading 350 and 44.453095, 26.102558 heading 30 (viewed only): two tall square
    // rendered pillars with a red base band flank the lane. Pillar size and spacing are estimates. The unfinished concrete
    // frame seen west of the lane has no footprint at that place (w387467641 lies 60 m further north) and is not drawn.
    for (const s of [-1, 1]) { const gx = 26.05 + s * 3.9, gz = 213.8; b.box(gx, D, gz, 1.0, 6.4, 1.0, '#d8d3c8'); b.box(gx, D, gz, 1.08, 1.1, 1.08, '#b03a30'); b.box(gx, D + 6.4, gz, 1.25, 0.25, 1.25, '#c9c4b8'); b.col(gx, gz, 0.55, 0.55, 0, { h: D + 6.7 }); }
    b.grounds.push(out); b.coverPolys.push(offset(out, -3)); // no trees in the bowl; OSM buildings inside the outline are the model's own
}

// ---- Romană & Victoriei lane (district fidelity pass, 2026-11-12) ----
// Muzeul Național de Istorie Naturală „Grigore Antipa" (1903-08, Grigore Cerkez), Șos. Kiseleff 1.
// Footprint: OSM way 23610985 (live 2026-11-12), anchor = its bbox centre, x east / z south, metres. The generic building
// was 5.8 m tall (no OSM height / levels); the Street View look from Șos. Kiseleff shows two tall storeys under a cornice,
// a raised central pavilion with a pediment and an engaged-column porch on the Kiseleff (east) front. Heights (13.5 m
// cornice, 18.5 m pavilion), bay spacing and the porch order are estimates; colour #E3D6B8 from research/bucharest-romana.md.
const ANTIPA_RING = [[-26.7,-29.5],[-1.7,-40.2],[5.4,-23.5],[3.9,-22.8],[7.3,-14.8],[9,-15.5],[10.7,-11.6],[11.3,-11.9],[11.5,-11.6],[13.7,-12.6],[14.1,-11.6],[17.7,-3.6],[18.1,-2.6],[15.9,-1.6],[16.1,-1.1],[15.3,-0.7],[17.1,3.4],[15.4,4.1],[18.9,12.4],[19.6,12.1],[26.7,28.8],[-0.2,40.2],[-7.3,23.4],[8.8,16.6],[6.8,12],[-2.5,15.9],[-4.3,11.6],[-12.3,14.9],[-11.6,16.4],[-17.1,18.7],[-26,-2.1],[-20.5,-4.4],[-19.8,-2.8],[-8.4,-7.6],[-10.5,-12.7],[-4.7,-15.1],[-6.1,-18.5],[-19.5,-12.9]];
export function bAntipa(b) {
    const p = ANTIPA_RING, S = '#e3d6b8', T = '#cfc3a6', BASE = '#b9ae96', ROOF = '#8d9093', GL = '#474c52';
    b.wall = S;
    // front line on Kiseleff: origin at the north end of the main front, u along the facade (north → south), n outward (east)
    const F = [5.4, -23.5], u = [0.371, 0.929], n = [0.929, -0.371];
    const at = (s, d) => [F[0] + u[0] * s + n[0] * d, F[1] + u[1] * s + n[1] * d];
    b.prism(p, 0, 1.3, BASE, { top: false });
    b.prism(p, 1.3, 13.5, S, { topCol: ROOF });
    b.windows(p, 1.5, 13.2, 5.8, GL, { bay: 4, wf: 0.42, hf: 0.62, minL: 3.2, mat: 'g' });
    b.cornice(p, 6.9, 0.3, 0.18, T); b.cornice(p, 13.5, 0.7, 0.45, T);
    // raised central pavilion behind the porch (the porch itself is the mapped 10 m projection of the footprint)
    const pav = [at(10.2, 0.35), at(26, 0.35), at(26, -9), at(10.2, -9)];
    b.prism(pav, 13.5, 18.5, S, { topCol: ROOF }); b.cornice(pav, 18.5, 0.6, 0.4, T);
    b.windows(pav, 14.1, 18.2, 4, GL, { bay: 3.9, wf: 0.4, hf: 0.55, minL: 8, mat: 'g' });
    const ry = Math.atan2(-u[1], u[0]), c = at(18.1, -1.6);
    b.pediment(c[0], 19.1, c[1], 16.6, 3, 4.6, T, ry);
    for (const s of [14, 16.7, 19.5, 22.2]) { const q = at(s, 3.85); b.cyl(q[0], 1.3, q[1], 0.42, 0.5, 10.6, '#efe6cf', 8); }
    const e0 = at(13.2, 3.95), e1 = at(23.05, 3.95), e2 = at(23.05, 3.2), e3 = at(13.2, 3.2);
    b.prism([e0, e1, e2, e3], 11.9, 13.5, T);
    for (const s of [15.4, 18.1, 20.8]) { const q = at(s, 3.72); b.box(q[0], 1.3, q[1], 1.5, 3.6, 0.12, '#4a3a2b', { ry }); } // the three porch doors
    b.colPolygon(p, { y1: 13.5 });
}

// Statue of Lascăr Catargiu (Antonin Mercié, bronze, 1907; reinstalled 2011) on Bd. Lascăr Catargiu.
// Position and plinth outline: OSM way 800350070 (tourism=artwork, artwork_type=statue, material=bronze). Form from
// research/bucharest-romana.md ("bronze standing figure on a stone pedestal"); all heights are estimates.
export function bCatargiu(b) {
    const base = [[-0.6,-4],[-3.9,0.9],[0.5,4],[3.9,-0.9]], k = (f) => base.map(([x, z]) => [x * f, z * f]);
    const ST = '#bdb5a6', ST2 = '#cbc3b4', BR = '#4b4a3d';
    b.prism(k(1), 0, 0.45, ST); b.prism(k(0.78), 0.45, 0.9, ST); b.prism(k(0.36), 0.9, 1.5, ST2);
    b.prism(k(0.28), 1.5, 5.2, ST2); b.cornice(k(0.28), 5.2, 0.3, 0.18, ST); // slim shaft: Street View from Bd. Lascăr Catargiu 22 (2026-11-12)
    // (round 2, panoramas at 44.448932, 26.093057 heading 331 and 44.449226, 26.092807 heading 146, viewed only): a standing
    // bronze man in a long frock coat on the pedestal, facing down the boulevard towards Piața Romană, and a second, smaller
    // bronze figure standing against the pedestal's south-west side, reaching up. They were a cylinder, a box and a ball.
    // Silhouettes only; figure heights are estimates.
    const fx = 0.83, fz = 0.56;
    statueFigure(b, 0, 5.5, 0, Math.atan2(fx, fz), 2.9, BR, { coat: true });
    statueFigure(b, -fz * 1.75, 0.9, fx * 1.75, Math.atan2(fz, -fx), 1.9, BR, { robe: true, reach: true });
    b.colPolygon(k(0.8), { y1: 5 }); b.grounds.push(k(2.3)); // the open traffic island (Street View): no tree crown through the figure
}

// „Nobil Dac” (Str. Mendeleev × Str. George Enescu, Romană): OSM w1170480716 (tourism=artwork, artwork_type=statue,
// material=marble; a 1.5 m square outline = the plinth). Panoramas at 44.44681, 26.094523 heading 158 and 44.446652,
// 26.094859 heading 285 (viewed only): a grey-weathered marble standing figure wrapped in a long cloak, facing east, on a
// plain square stone plinth with a plaque on the front and a low base, in the small parking square. Plinth and figure
// heights are estimates.
export function bNobilDac(b) {
    const o = [[-0.8, -0.6], [-0.7, 0.7], [0.8, 0.6], [0.7, -0.7]], k = f => o.map(([x, z]) => [x * f, z * f]), ST = '#b3aea3', MB = '#b9b6ad';
    b.prism(k(1.3), 0, 0.3, '#a39e93'); b.prism(k(1), 0.3, 2.2, ST); b.cornice(k(1), 2.05, 0.15, 0.08, '#beb9ae');
    b.box(0.79, 1.0, 0, 0.04, 0.7, 0.8, '#5b5a55');                                                // plaque (east face)
    statueFigure(b, 0, 2.2, 0, Math.PI / 2, 2.3, MB, { robe: true });
    b.colPolygon(k(1.3), { y1: 2.2 }); b.grounds.push(k(3));
}

// George Enescu (Bd. Magheru × Str. George Enescu, Romană): OSM w1171605516 (tourism=artwork, artwork_type=statue; a
// 4.4 m square outline = the base). Panorama at 44.443605, 26.098132 heading 312 (viewed only): a dark bronze man seated
// on a rough block, on two low grey granite steps in the paved corner of the square, facing west-south-west towards the
// boulevard. Step and figure heights are estimates.
export function bEnescu(b) {
    const o = [[-2.8, -1.3], [-1.3, 2.8], [2.8, 1.3], [1.3, -2.8]], k = f => o.map(([x, z]) => [x * f, z * f]), GR = '#a7a59f', BR = '#3f4639';
    b.prism(k(1), 0, 0.32, GR); b.prism(k(0.68), 0.32, 0.66, '#b3b1ab');
    statueFigure(b, 0, 0.66, 0, Math.atan2(-0.94, 0.34), 2.1, BR, { seated: true, seat: '#4a4f44' });
    b.colPolygon(k(1), { y1: 1.6 }); b.grounds.push(k(1.6));
}

// Fântâna Arteziană Arthur Verona (Str. Pictor Arthur Verona, beside Bd. Magheru): decorative round basin.
// Outline: OSM way 1183885625 (amenity=fountain, fountain=decorative), missing from the district data (built before it was
// mapped). Street View shows a low round stone rim at pavement level; rim height and the nozzle block are estimates.
export function bVeronaFountain(b) {
    const o = [[-3.3,-3.3],[-4.1,-2.1],[-4.6,-0.7],[-4.6,0.9],[-4,2.3],[-3.1,3.4],[-1.8,4.2],[-0.4,4.6],[1.1,4.5],[2.5,3.8],[3.6,2.8],[4.4,1.4],[4.6,-0.1],[4.3,-1.6],[3.5,-2.9],[2.4,-4],[0.9,-4.5],[-0.6,-4.6],[-2,-4.2]];
    const i = o.map(([x, z]) => [x * 0.88, z * 0.88]), ST = '#b9b2a4';
    b.ring(o, 0, 0.5, ST); b.ring(i, 0.3, 0.5, ST, { inward: true }); b.cap(o, 0.5, '#c6bfb1', [i]);
    b.cap(i, 0.34, '#5f93aa', [], 1, 'w'); b.cyl(0, 0.3, 0, 0.22, 0.3, 0.5, ST, 8);
    b.colPolygon(o, { y1: 0.6 }); b.grounds.push(o);
}

// CET Grozăvești (fidelity pass 2026-11-12): the four natural-draught cooling towers and the steel stacks of the power
// station, seen from Șoseaua Grozăvești / Pasajul Basarab / the Dâmbovița quays. OSM: w188102855, w188102865, w188102870,
// w188102882 (man_made=tower, tower:type=cooling, material=concrete, height=50; mean radii 15.9–17.2 m) and w905217275/6/7,
// w905217281, w905217307/8/9 (man_made=chimney, material=metal, height=50, r 2.4 m). They were drawn as round apartment
// blocks with windows; the stacks were missing. The hyperboloid profile is a model estimate (street-level reference:
// waisted grey concrete shells with a darker rim). Also the weir across the Dâmbovița west of Podul Grozăvești
// (OSM w902058419, waterway=weir): a low concrete sill at the model's channel water level.
export function bCetGrozavesti(b) {
    const CON = '#a8a297', RIM = '#7f796f', ST = '#8d9297', H = 50;
    const prof = [[0, 1], [.14, .9], [.32, .78], [.52, .69], [.72, .64], [.9, .64], [1, .67]];
    for (const [x, z, r] of [[-23.8, 0, 16.2], [28.8, 6.8, 17.2], [3.2, 39.8, 15.9], [-7.3, -47.6, 16.9]]) {
        for (let i = 0; i + 1 < prof.length; i++) { const [t0, k0] = prof[i], [t1, k1] = prof[i + 1]; b.cyl(x, t0 * H, z, r * k1, r * k0, (t1 - t0) * H, i === prof.length - 2 ? RIM : CON, 24); }
        b.col(x, z, r, r, 0, { y0: 0, y1: H });
    }
    for (const [x, z] of [[45.5, 61.3], [52.2, 53], [59.1, 44.1], [66.7, 35.3], [-190.9, 157.5], [-187.7, 139], [97.4, -33]]) { b.cyl(x, 0, z, 1.9, 2.4, H, ST, 10); b.col(x, z, 2.4, 2.4, 0, { y0: 0, y1: H }); }
    b.box(-280.1, -4.75, -357.4, 30.1, .7, 1.6, '#b3afa4', { ry: 1.322 });
}

// Centrul Comercial Orhideea (OSM w23557062) with the Carrefour hypermarket inside (OSM w925593033, brand=Carrefour): the
// blue roof-edge lettering and the red fascia band of the façade towards Șoseaua Orhideelor (street-level reference
// 2026-11-12). The building itself stays the source footprint; only its sign and band are added, on the mapped west wall
// (230.5, −320.9) → (256.6, −437.9) in district metres.
export function bOrhideeaSign(b) {
    const ry = -1.7906, nx = -.976, nz = -.218;
    b.box(nx * .12, 0, nz * .12, 112, 6.6, .2, '#eeeeea', { ry }); // (round 2, panorama 44.444372, 26.061485 heading 70: a white panel wall with a broad red band, not a dark windowed front)
    b.box(nx * .2, 2.3, nz * .2, 112, 1.9, .3, '#c8102e', { ry });
    b.box(nx * .2, 6.6, nz * .2, 112, 1.1, .3, '#c8102e', { ry });
    b.box(nx * .25, 8, nz * .25, 27, 4, .25, '#f4f4f1', { ry });
    b.text('Carrefour', nx * .42, 8.6, nz * .42, ry, 2.8, '#1e4fa3', { d: .04 });
}

// Turnul de apă, Belvedere cigarette factory (Grozăvești): OSM w678037221 (man_made=water_tower, historic, height=30,
// building:levels=8, roof:shape=cone). It was the generic round building with eight rows of windows all round. Official
// panorama 44.447216, 26.061955 heading 19 (Calea Giulești, viewed only, round 3 2026-11-13): a weathered grey-beige
// rendered shaft with flat pilasters and one vertical row of small windows, under a wider tank head with round windows
// and a cornice. The mapped outline (r 5.6 m, traced from above) is the tank head and is kept exactly; the shaft radius
// (0.75 of the head, from the panorama's proportions) and every band height are estimates; the 30 m top is OSM's.
const TOWER_RING = [[3.21,4.61],[1.53,5.4],[-0.3,5.61],[-2.12,5.21],[-3.69,4.24],[-4.87,2.82],[-5.53,1.1],[-5.59,-0.75],[-5.05,-2.52],[-3.96,-4.02],[-2.39,-5.11],[-0.6,-5.59],[1.24,-5.49],[2.96,-4.78],[4.35,-3.57],[5.27,-1.97],[5.62,-0.16],[5.37,1.67],[4.53,3.32]];
export function bWaterTower(b) {
    const ST = '#b7ae9c', ST2 = '#a69d8b', TR = '#c6bead', WIN = '#3a3833', r = 4.2, sh = 21.6;
    b.cyl(0, 0, 0, r, r * 1.04, sh, ST, 20);
    // (single quads and one pilaster per edge: the Grozăvești frame budget has no headroom)
    const pan = (a, rr, y, w, h, col) => { const c = Math.cos(a), s = Math.sin(a), tx = -s * w / 2, tz = c * w / 2, x = c * rr, z = s * rr;
        b.quad([x - tx, y, z - tz], [x + tx, y, z + tz], [x + tx, y + h, z + tz], [x - tx, y + h, z - tz], col, 'm', [c, 0, s]); };
    b.pilasters(ellipse(0, 0, r * 1.02, r * 1.02, 8), 0.6, sh, 2 * r * 1.02 * Math.sin(Math.PI / 8), 0.55, 0.16, ST2, { every: 2 });
    for (let y = 2.4; y < sh - 1; y += 2.75) { pan(Math.PI / 2, r + 0.03, y, 0.62, 1.3, WIN); pan(Math.PI, r + 0.03, y + 1.2, 0.5, 1.0, WIN); } // one row of small windows
    b.cyl(0, sh, 0, 5.15, r * 1.04, 1.4, TR, 20);                                     // corbel out to the tank head
    const k = TOWER_RING.map(([x, z]) => [x * 0.985, z * 0.985]);
    b.prism(TOWER_RING, sh + 1.4, 28.4, ST); b.cornice(TOWER_RING, sh + 1.4, 0.4, 0.12, TR);
    b.cornice(TOWER_RING, 28.4, 0.5, 0.2, TR); b.prism(k, 28.9, 29.3, ST2);              // crown parapet
    for (let i = 0; i < 10; i++) pan(i / 10 * Math.PI * 2 + 0.3, 5.66, 25.1, 1.0, 1.0, WIN); // round windows of the head (square quads)
    b.cone(0, 28.9, 0, 5.0, 1.1, '#8d877c', 16);                                     // low cone roof behind the parapet (OSM roof:shape=cone)
    b.col(0, 0, r, r, 0, { y0: 0, y1: sh }); b.colPolygon(TOWER_RING, { y0: sh, y1: 30 });
}

// Automatica Ford (Calea Floreasca 159): OSM w39348916 (building=construction, historic=building, start_date=1938,
// building:levels=2). It was drawn as a finished white hall. Official panorama 44.464086, 26.101630 heading 270 (May 2024,
// viewed only; OSM check_date 2026-04-08 still `construction`): the site is wrapped in white scaffold netting on a grid of
// scaffold tubes, behind a dark navy site hoarding along Calea Floreasca. The two mapped storeys are kept (10 m: storey height
// of a 1938 industrial hall is an estimate); hoarding height and tube spacing are estimates; no hoarding text is drawn (the
// banners are advertising). The hoarding stands on the mapped outline: the real line on the pavement is not mapped.
const FORD_RING = [[32,-66.5],[12.54,72.7],[-32,66.5],[-12.53,-72.7]];
export function bAutomatica(b) {
    const NET = '#dcdedb', TUBE = '#8b8e90', HO = '#1e2a55', H = 10;
    b.prism(FORD_RING, 0, H, NET, { topCol: '#a9aca8' });
    b.pilasters(FORD_RING, 0, H + 0.6, 2.6, 0.07, 0.12, TUBE);
    b.bands(FORD_RING, 2, H, 2, TUBE, { h: 0.08, out: 0.1 });
    b.ring(offset(FORD_RING, 0.18), 0, 2.6, HO);                                       // site hoarding all round
    b.colPolygon(FORD_RING, { y1: H });
}

// Metrou Grozăvești, west entrance (OSM n610921621 railway=subway_entrance, Metrorex). No OSM building. Official panorama
// 44.442913, 26.060332 heading 256 (viewed only, round 3 2026-11-13): a low glazed pavilion with grey metal frames and a
// shallow white roof, the blue Metrorex "M" on its east front. Footprint 10 x 6 m, heights and its position 3 m west of
// the mapped door node are estimates from that panorama.
export function bGrozMetro(b) {
    const FR = '#8a9196', GL = '#4f6068', RF = '#e8e9e6', w = 3, d = 5;
    b.shift(-3, 0);                                                                    // pavilion centre 3 m west of the door node
    b.prism(rect(-d / 2 - 0.5, -w - 2, d / 2, w + 2), 0, 0.15, '#9a9a94');
    b.prism(rect(-d / 2, -w - 2, d / 2, w + 2), 0.15, 2.9, GL, { mat: 'g' });
    for (const x of [-d / 2 - 0.03, d / 2 + 0.03]) for (let z = -w - 2; z <= w + 2.01; z += 1.66) b.quad([x, 0.15, z - 0.07], [x, 0.15, z + 0.07], [x, 2.9, z + 0.07], [x, 2.9, z - 0.07], FR, 'm', [Math.sign(x), 0, 0]); // mullions: single quads (frame budget)
    for (const z of [-w - 2.03, w + 2.03]) for (let x = -d / 2; x <= d / 2 + 0.01; x += 1.25) b.quad([x - 0.07, 0.15, z], [x + 0.07, 0.15, z], [x + 0.07, 2.9, z], [x - 0.07, 2.9, z], FR, 'm', [0, 0, Math.sign(z)]);
    b.prism(rect(-d / 2 - 0.4, -w - 2.4, d / 2 + 0.4, w + 2.4), 2.9, 3.15, RF);
    b.hip(0, 3.15, 0, 2 * w + 4.8, d + 0.8, 0.45, RF, { ry: Math.PI / 2 });
    b.box(d / 2 + 0.1, 2.2, 1.2, 0.08, 0.66, 0.66, '#1d4fa0'); b.text('M', d / 2 + 0.15, 2.3, 1.2, Math.PI / 2, 0.46, '#ffffff', { d: 0.02 });
    b.col(0, 0, d / 2 + 0.1, w + 2.1, 0, { y1: 3.3 });
    b.shift(0, 0);
}

// Round east tower and observatory dome of the Observatorul Astronomic „Amiral Vasile Urseanu” (OSM w79139872
// man_made=observatory, observatory:type=astronomical). The tower is OSM w1220336122 (building:part=yes, no height, r 3.3 m),
// which the data drew as a 25.6 m blank default cylinder; this model replaces that part only. Official panorama 44.448503,
// 26.093125 heading 275 (round 3, viewed only): a cream rounded corner bay with iron balconies, level with the three-storey
// villa (13.5 m, an estimate from the storey count); the roof is blurred there, so the dome's form is the usual hemispherical
// observatory dome: radius, rise and the grey metal finish are estimates.
const URSEANU_TOWER = [[-2.5,-2.4],[-3.1,-1.5],[-3.4,-0.4],[-3.4,0.7],[-3,1.7],[-2.3,2.5],[-1.3,3.1],[-0.2,3.3],[0.9,3.1],[1.7,2.7],[2.3,2.2],[2.9,1.3],[3.1,0.3],[3.1,-0.6],[2.8,-1.5],[2.3,-2.2],[1.6,-2.8],[0.6,-3.2],[-0.5,-3.3],[-1.6,-3]];
export function bUrseanuDome(b) {
    const S = '#efe7d6', TR = '#e2d8c4', H = 13.5;
    b.wall = S; b.prism(URSEANU_TOWER, 0, H, S, { topCol: TR });
    b.windows(URSEANU_TOWER, 0.9, H - 1, 3.9, '#4c4a45', { bay: 1.6, wf: 0.6, hf: 0.6, start: 0.9, minL: 0.9 });
    for (const y of [4.6, 8.5]) b.cornice(URSEANU_TOWER, y, 0.14, 0.45, '#3e3f40');   // balcony slabs with dark iron rails (thin band)
    b.cornice(URSEANU_TOWER, H - 0.5, 0.5, 0.3, TR);
    b.cyl(0, H, 0, 2.75, 2.85, 0.5, '#d9d2c2', 16);
    b.dome(0, H + 0.5, 0, 2.6, 2.4, '#aab0b5', 16);
    b.box(0, H + 0.7, 2.1, 0.9, 2.1, 0.5, '#5d6368', { rx: -0.45 });                    // shutter slit (south)
    b.colPolygon(URSEANU_TOWER, { y1: H });
}
