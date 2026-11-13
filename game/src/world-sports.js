// ============================================================================
//  SPORTS GROUNDS — pitch / court markings, goals, nets and hoops of the OSM sport grounds (dressSports runs after the landmarks)
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build;
//  names world.js still owns or assigns later are read / written through `__live`)
// ============================================================================
import { pointInPolygon } from './util.js';
import { rgb } from './geobuild.js';
import { AREA_SPORT, emitBankedTrack, emitRugbyLeague } from './sport-areas.js';
import { AREA_Y, Y, props, signedArea } from './world-shared.js';

export function makeDressSports(ctx) {
    const {
        areas, buildingAt, cellOf, landmarks, lmGrounds, onRibbon, sportAreaLog, sportsColl,
    } = ctx;
    const __live = ctx.__live;
 // (colliders of the sports dressing: it runs before propColl exists — merged in below)
    const dressSports = () => { // (run after the landmarks are built: a ground inside a landmark — the Dinamo pitch — is the model's own)
        const W = rgb('#f4f4ef'), POST = rgb('#ededea'), FENCE = rgb('#2f4a3a'), NET = rgb('#2a2d30');
        const minRect = (pts) => {
            let best = null;
            for (let k = 0; k < pts.length; k++) {
                const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of pts) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                const A = (a1 - a0) * (c1 - c0); if (!best || A < best.A) best = { A, ux, uz, a0, a1, c0, c1 };
            }
            if (!best) return null;
            let { ux, uz, a0, a1, c0, c1 } = best; const pm = (a0 + a1) / 2, qm = (c0 + c1) / 2;
            let hl = (a1 - a0) / 2, hw = (c1 - c0) / 2;
            if (hw > hl) { [hl, hw] = [hw, hl]; [ux, uz] = [-uz, ux]; } // u = long axis
            return { cx: pm * best.ux - qm * best.uz, cz: pm * best.uz + qm * best.ux, ux, uz, hl, hw, A: best.A };
        };
        // (2026-11-08, owner: "this one seems broken") OSM maps a sports ground as one big pitch polygon with the real pitches /
        // courts inside it: the container stays plain (no stripes, lines, goals laid across the pitches inside it)
        const SPORT = /^(pitch|turf|clay|hard)$/, sportAreas = areas.filter(o => SPORT.test(o.kind) && o.size >= 60);
        const holdsOthers = (a) => sportAreas.some(o => o !== a && o.size < a.size * 0.85 && pointInPolygon((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, a.outer));
        const DECK = rgb('#d6d0c3'), LIP = rgb('#ebe7de');
        for (const a of areas) {
            // (round 3 review, Otopeni Ramada w1322339467 / w706499892: small pools were flat cyan decals with no rim; only
            // rectangular pools of 60 m² and more had a painted coping) every mapped pool gets, along its own outline, a
            // stone lip (0.25 m wide, 0.1 m high) and a plain deck band (0.9 m) round it; widths and height are estimates
            // (in the near-LOD detail layer, no shadow pass: Grozăvești's worst sweep frame is at the 1.5 M budget, and a
            // 10 cm lip is invisible from beyond ≈ 150 m anyway)
            if (a.kind === 'pool' && a.size >= 4 && a.size <= 20000 && !landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) {
                const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y.pool, R0 = a.outer, n = R0.length, ccw = signedArea(R0) > 0;
                const nrm = (k) => { const [ax, az] = R0[k], [bx, bz] = R0[(k + 1) % n], L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } return [nx, nz]; }; // outward
                const off = (k, d) => { const [px, pz] = nrm((k - 1 + n) % n), [qx, qz] = nrm(k); let mx = px + qx, mz = pz + qz; const ml = Math.hypot(mx, mz); if (ml < 1e-3) { mx = qx; mz = qz; } else { mx /= ml; mz /= ml; } const cs = Math.max(0.5, mx * qx + mz * qz); return [R0[k][0] + mx * d / cs, R0[k][1] + mz * d / cs]; };
                const lip = R0.map((_, k) => off(k, 0.25)), deck = R0.map((_, k) => off(k, 1.15)), top = base + 0.1;
                for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, [ax, az] = R0[k], [bx, bz] = R0[k1]; if (Math.hypot(bx - ax, bz - az) < 0.05) continue; const [nx, nz] = nrm(k);
                    c.detail.flatQuad(lip[k][0], lip[k][1], lip[k1][0], lip[k1][1], deck[k1][0], deck[k1][1], deck[k][0], deck[k][1], base + 0.03, DECK, 0.1);
                    c.detail.face4([ax, top, az], [bx, top, bz], [lip[k1][0], top, lip[k1][1]], [lip[k][0], top, lip[k][1]], LIP, [0, 1, 0]);
                    c.detail.face4([bx, base - 0.05, bz], [ax, base - 0.05, az], [ax, top, az], [bx, top, bz], LIP, [-nx, 0, -nz]);
                    c.detail.face4([lip[k][0], base, lip[k][1]], [lip[k1][0], base, lip[k1][1]], [lip[k1][0], top, lip[k1][1]], [lip[k][0], top, lip[k][1]], LIP, [nx, 0, nz]); }
                const R = a.size >= 60 ? minRect(a.outer) : null;
                if (R && a.size / R.A >= 0.8) { const P = (u, v) => [R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v], { hl: HL, hw: HW } = R;
                    const strip = (u0, v0, u1, v1, k) => { const L = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / L * k / 2, nv = (u1 - u0) / L * k / 2, [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); c.sport.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, base + 0.016, W, 0.1); };
                    // the painted coping of rectangular pools (as before this pass) stays for the far view, where the detail-layer lip is culled
                    for (const [u0, v0, u1, v1] of [[-HL, -HW, HL, -HW], [-HL, HW, HL, HW], [-HL, -HW, -HL, HW], [HL, -HW, HL, HW]]) strip(u0, v0, u1, v1, 0.6);
                    if (HL > 10) for (let v = -HW + 2.5; v < HW - 1.5; v += 2.5) strip(-HL + 1, v, HL - 1, v, 0.08); } // lane ropes on long rectangular pools
                __live.pitchesDressed++; continue;
            }
            // (backlog floreasca-2) Velodromul Dinamo: a sport=cycling track is a banked concrete bank, not a flat band (sport-areas.js)
            const sportTag = AREA_SPORT[a.sourceId];
            const groundOf = (q) => lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) });
            if (sportTag === 'cycling' && a.kind === 'track') {
                const infield = areas.find(o => o !== a && /^(pitch|turf)$/.test(o.kind) && pointInPolygon((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, a.outer)), R = minRect(a.outer);
                if (infield && R) sportAreaLog.push({ id: a.sourceId, sport: sportTag, ...emitBankedTrack({ track: a, infield, rect: R, cell: cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base: AREA_Y.track, rgb, ground: groundOf,
                    addFence: (ax, az, bx, bz, h) => { const L = Math.hypot(bx - ax, bz - az); sportsColl.push({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: 0.2, hd: L / 2, angle: Math.atan2(bx - ax, bz - az), r: Math.hypot(0.2, L / 2), poly: null, h, prop: true, kind: 'fence' }); } }) });
                continue;
            }
            if (!/^(pitch|turf|clay|hard|pool)$/.test(a.kind) || a.size < 60 || a.size > 20000) continue;
            if (landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) continue;
            if (a.kind !== 'pool' && holdsOthers(a)) continue;
            const R = minRect(a.outer); if (!R || a.size / R.A < 0.8) continue;
            if (/^rugby/.test(sportTag || '') && (a.kind === 'pitch' || a.kind === 'turf')) { // (backlog floreasca-2) rugby league lines and H posts, not football (sport-areas.js)
                const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y[a.kind] ?? Y.pitch, P = (u, v) => [R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v], POSTC = rgb('#f6f6f4');
                const q4 = (u0, v0, u1, v1, y, col) => { const [x0, z0] = P(u0, v0), [x1, z1] = P(u1, v0), [x2, z2] = P(u1, v1), [x3, z3] = P(u0, v1); c.sport.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, 0.1); };
                const line = (u0, v0, u1, v1, w = 0.1) => { const L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.05) return; const nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2, [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); c.sport.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, base + 0.016, W, 0.1); };
                const s1 = rgb('#5d9a45'), s2 = rgb('#528d3d');
                sportAreaLog.push({ id: a.sourceId, sport: sportTag, ...emitRugbyLeague({ area: a, rect: R, base, line, P, ang: Math.atan2(R.ux, R.uz), ground: groundOf,
                    stripe: (u0, u1, hw, k) => q4(u0, -hw, u1, hw, base + 0.003, k % 2 ? s1 : s2),
                    post: (x, z, h, r) => c.detail.geo(props().cylY, x, base + h / 2, z, 0, r, h, r, POSTC),
                    crossbar: (x, z, y, len, an, r) => c.detail.geo(props().cylZ, x, base + y, z, an, r, r, len, POSTC),
                    addPost: (x, z) => sportsColl.push({ x, z, r: 0.12, hw: 0.12, hd: 0.12, angle: 0, poly: null, h: 3, prop: true, kind: 'post' }) }) });
                __live.pitchesDressed++; continue;
            }
            // (fidelity pass 2026-11-12, Velodromul Dinamo, OSM way/362465818 inside track way/37899329) a rounded outline —
            // the infield of a velodrome / running track is a capsule — is not its bounding rectangle: the marked pitch is
            // shortened until its corners lie inside the mapped outline (its stripes covered the track's curves)
            if ((a.kind === 'pitch' || a.kind === 'turf') && a.size / R.A < 0.97) {
                const cornersIn = (h) => [[h, R.hw * 0.97], [h, -R.hw * 0.97], [-h, R.hw * 0.97], [-h, -R.hw * 0.97]].every(([u, v]) => pointInPolygon(R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v, a.outer));
                if (!cornersIn(R.hl)) { let lo = R.hw, hi = R.hl; for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (cornersIn(mid)) lo = mid; else hi = mid; } R.hl = lo; }
            }
            const { cx, cz, ux, uz, hl, hw } = R, vx = -uz, vz = ux;
            const P = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
            const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y[a.kind] ?? Y.pitch, yL = base + 0.016; // (lines 1.2 cm over the mowing stripes: 3 mm z-fought them away at a distance) // (same cell = same mesh as the area polygon: the lines draw after it)
            const layer = c.sport; // (its own ground layer, drawn after all grass / paving: see 'sport' below)
            const line = (u0, v0, u1, v1, w = 0.1) => { const L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.05) return; const nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2; const [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); layer.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, yL, W, 0.1); };
            const rect = (hu, hv) => { line(-hu, -hv, hu, -hv); line(-hu, hv, hu, hv); line(-hu, -hv, -hu, hv); line(hu, -hv, hu, hv); };
            const ang = Math.atan2(ux, uz);
            if (a.kind === 'pool') { // coping all round, lane ropes on long pools
                const k = 0.6; for (const [u0, v0, u1, v1] of [[-hl, -hw, hl, -hw], [-hl, hw, hl, hw], [-hl, -hw, -hl, hw], [hl, -hw, hl, hw]]) line(u0, v0, u1, v1, k);
                if (hl > 10) for (let v = -hw + 2.5; v < hw - 1.5; v += 2.5) line(-hl + 1, v, hl - 1, v, 0.08);
                __live.pitchesDressed++; continue;
            }
            const tennis = (a.kind === 'clay' || a.kind === 'hard') && hl >= 11 && hw >= 5.5 && !(a.kind === 'hard' && hl < 13);
            if (tennis) { // a grid of courts (23.77 × 10.97 m inside 36 × 18 m run-offs), nets, a fence round the plot
                const nu = Math.max(1, Math.round(hl * 2 / 36)), nv = Math.max(1, Math.round(hw * 2 / 18)), su = hl * 2 / nu, sv = hw * 2 / nv;
                for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
                    const u0 = -hl + su * (i + 0.5), v0 = -hw + sv * (j + 0.5), HL = Math.min(11.885, su / 2 - 1.5), HW = Math.min(5.485, sv / 2 - 1), HS = HW * 4.115 / 5.485;
                    const L2 = (a0, b0, a1, b1) => line(u0 + a0, v0 + b0, u0 + a1, v0 + b1, 0.06);
                    L2(-HL, -HW, HL, -HW); L2(-HL, HW, HL, HW); L2(-HL, -HW, -HL, HW); L2(HL, -HW, HL, HW); L2(-HL, -HS, HL, -HS); L2(-HL, HS, HL, HS);
                    L2(-6.4, -HS, -6.4, HS); L2(6.4, -HS, 6.4, HS); L2(-6.4, 0, 6.4, 0);
                    const [nx0, nz0] = P(u0, v0 - HW - 0.9), [nx1, nz1] = P(u0, v0 + HW + 0.9);
                    c.detail.wall(nx0, nz0, nx1, nz1, base + 0.05, base + 0.95, ux, uz, NET); c.detail.wall(nx1, nz1, nx0, nz0, base + 0.05, base + 0.95, -ux, -uz, NET);
                    for (const [px, pz] of [[nx0, nz0], [nx1, nz1]]) c.detail.box(px, base, pz, 0.08, 1.07, 0.08, 0, POST);
                }
                const corners = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                for (let k = 0; k < 4; k++) { const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], L = Math.hypot(bx - ax, bz - az);
                    for (let t = 0; t <= L; t += 3) { const f = t / L; c.detail.box(ax + (bx - ax) * f, base, az + (bz - az) * f, 0.06, 3, 0.06, 0, FENCE); }
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, an = Math.atan2(bx - ax, bz - az);
                    c.detail.box(mx, base + 2.95, mz, 0.05, 0.05, L, an, FENCE); c.detail.box(mx, base + 1.5, mz, 0.04, 0.04, L, an, FENCE);
                    c.solid.box(mx, base, mz, 0.04, 0.12, L, an, FENCE);
                    sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: L / 2, angle: an, r: Math.hypot(0.1, L / 2), poly: null, h: 3, prop: true, kind: 'fence' }); } // (solid)
                __live.pitchesDressed++; continue;
            }
            if (a.kind === 'hard') { // basketball / multi-sport: outline, centre line and circle, hoops at both ends
                rect(hl - 1, hw - 1); line(0, -hw + 1, 0, hw - 1);
                const n = 24, r = Math.min(1.8, hw * 0.25); for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0.06); }
                for (const sg of [-1, 1]) { // pole behind the end line, arm, backboard (with its target square), orange rim and a net
                    const [px, pz] = P(sg * (hl + 0.2), 0), [bx, bz] = P(sg * (hl - 1.2), 0), [ax2, az2] = P(sg * (hl - 0.5), 0);
                    c.solid.box(px, base, pz, 0.14, 3.5, 0.14, ang, rgb('#3a3d42')); sportsColl.push({ x: px, z: pz, r: 0.1, hw: 0.1, hd: 0.1, angle: 0, poly: null, h: 3, prop: true, kind: 'post' });
                    c.solid.box(ax2, base + 3.3, az2, 0.1, 0.1, 1.4, ang, rgb('#3a3d42'));
                    c.solid.box(bx, base + 2.9, bz, 0.06, 1.05, 1.8, ang + Math.PI / 2, rgb('#f2f2f0'));
                    const [qx, qz] = P(sg * (hl - 1.24), 0); c.detail.box(qx, base + 3.05, qz, 0.02, 0.45, 0.59, ang + Math.PI / 2, rgb('#c2410c'));
                    const [rx, rz] = P(sg * (hl - 1.48), 0), R = 0.23;
                    for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI * 2, a1 = (k + 1) / 10 * Math.PI * 2, cx2 = rx + (Math.cos(a0) + Math.cos(a1)) / 2 * R, cz2 = rz + (Math.sin(a0) + Math.sin(a1)) / 2 * R;
                        c.detail.box(cx2, base + 3.05, cz2, 0.03, 0.03, 2 * R * Math.sin(Math.PI / 10) + 0.02, Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)), rgb('#e8590c'));
                        if (k % 2 === 0) c.detail.box(rx + Math.cos(a0) * R * 0.8, base + 2.65, rz + Math.sin(a0) * R * 0.8, 0.012, 0.4, 0.012, 0, rgb('#f2f2f0')); } // net strands
                }
                __live.pitchesDressed++; continue;
            }
            // football (grass / artificial turf): touch + goal lines, halfway line, centre circle, boxes, goals
            if (hl < 12 || hw < 6) continue;
            const m = Math.min(1.5, hw * 0.06), HL = hl - m, HW = hw - m;
            // (2026-11-08, owner: "football fields need a bit more love") mowing stripes across the whole pitch in two greens
            // (they also cover the aerial green-raster / yard patches that showed through), no trees on it, corner flags,
            // dugouts at halfway, ball-stop fences behind the goals, deeper goals with side nets
            { const turf = a.kind === 'turf', c1 = rgb(turf ? '#4f9a4c' : '#5d9a45'), c2 = rgb(turf ? '#468d43' : '#528d3d'), ns = Math.max(4, Math.round(hl * 2 / 5.5));
                for (let k = 0; k < ns; k++) { const u0 = -hl + hl * 2 * k / ns, u1 = -hl + hl * 2 * (k + 1) / ns, [x0, z0] = P(u0, -hw), [x1, z1] = P(u1, -hw), [x2, z2] = P(u1, hw), [x3, z3] = P(u0, hw);
                    layer.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, base + 0.003, k % 2 ? c1 : c2, 0.1); }
                const q = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) });
                for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { // corner flags: a pole with the flag hanging from its top, the 1 m arc
                    const [fx, fz] = P(su * HL, sv * HW); c.detail.geo(props().cylY, fx, base + 0.75, fz, 0, 0.022, 1.5, 0.022, POST);
                    const dl = Math.SQRT1_2, dx = (ux * -su + vx * -sv) * dl, dz = (uz * -su + vz * -sv) * dl, FL = rgb('#e8b923'); // (toward the pitch, diagonally)
                    const q = [[fx, base + 1.5, fz], [fx + dx * 0.45, base + 1.47, fz + dz * 0.45], [fx + dx * 0.45, base + 1.17, fz + dz * 0.45], [fx, base + 1.2, fz]];
                    c.detail.face4(q[0], q[1], q[2], q[3], FL, [-dz, 0, dx]); c.detail.face4(q[0], q[3], q[2], q[1], FL, [dz, 0, -dx]);
                    for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI / 2, a1 = (k + 1) / 8 * Math.PI / 2; line(su * (HL - Math.cos(a0)), sv * (HW - Math.sin(a0)), su * (HL - Math.cos(a1)), sv * (HW - Math.sin(a1))); }
                }
                // dugouts (2026-11-08, owner: "more love on the benches"): a concrete pad, a smoked back wall, tinted side panels
                // under a curved roof, a row of bucket seats in the team colour on a rail. Long side along the touchline, on the
                // side of the pitch that is clear (no other pitch / court, building or road under it); none when neither is
                if (hw > 15) {
                    const LEN = 4.4, DEP = 1.7, gap = 1.2, us = [-6.5, 6.5];
                    const free = (s) => us.every(u0 => { for (let du = -2.5; du <= 2.5; du += 1.25) for (let dv = 0; dv <= DEP + 0.3; dv += 0.5) {
                        const [x, z] = P(u0 + du, s * (hw + gap + dv));
                        if (buildingAt(x, z) || onRibbon(x, z, 0.4) || sportAreas.some(o => o !== a && x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && pointInPolygon(x, z, o.outer))) return false; }
                        return true; });
                    const side = [-1, 1].find(free);
                    if (side) for (const u0 of us) {
                        const s = side, vF = s * (hw + gap), vB = s * (hw + gap + DEP), vC = (vF + vB) / 2;
                        const B = (lay, u, v, y, lu, h, lv, col) => { const [x, z] = P(u, v); lay.box(x, base + y, z, lv, h, lu, ang, col); };
                        const V = (u, v, y) => { const [x, z] = P(u, v); return [x, base + y, z]; };
                        const quad2 = (lay, q, col) => { // both faces of a quad
                            const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
                            const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
                            lay.face4(q[0], q[1], q[2], q[3], col, n); lay.face4(q[0], q[3], q[2], q[1], col, [-n[0], -n[1], -n[2]]); };
                        const FR = rgb('#3a3f45'), PAN = rgb('#8fa8b6'), ROOF = rgb('#5c86a8'), SEAT = rgb(u0 < 0 ? '#b8322f' : '#2a62a8');
                        B(c.solid, u0, vC + s * 0.15, 0, LEN + 0.4, 0.08, DEP + 0.6, rgb('#c3c5c6'));            // pad
                        B(c.solid, u0, vB - s * 0.03, 0.08, LEN, 2.12, 0.06, rgb('#3d4a54'));                     // back wall
                        const hF = 1.95, hB = 2.2, roofY = (t) => hB + (hF - hB) * t + Math.sin(t * Math.PI) * 0.12; // curved roof profile back → front
                        for (const eu of [-LEN / 2, LEN / 2]) { // side panels (tapered) + frame posts
                            quad2(c.solid, [V(u0 + eu, vB, 0.08), V(u0 + eu, vF + s * 0.25, 0.08), V(u0 + eu, vF + s * 0.25, roofY(0.85)), V(u0 + eu, vB, hB)], PAN);
                            B(c.detail, u0 + eu, vF + s * 0.1, 0.08, 0.06, hF, 0.06, FR); B(c.detail, u0 + eu, vB - s * 0.05, 0.08, 0.06, hB, 0.06, FR); }
                        const NS = 5; for (let k = 0; k < NS; k++) { // roof, back → front with a small overhang
                            const t0 = k / NS, t1 = (k + 1) / NS, v0 = vB + (vF - s * 0.3 - vB) * t0, v1 = vB + (vF - s * 0.3 - vB) * t1;
                            quad2(c.solid, [V(u0 - LEN / 2 - 0.05, v0, roofY(t0)), V(u0 + LEN / 2 + 0.05, v0, roofY(t0)), V(u0 + LEN / 2 + 0.05, v1, roofY(t1)), V(u0 - LEN / 2 - 0.05, v1, roofY(t1))], ROOF); }
                        B(c.detail, u0, vF - s * 0.3, roofY(1) - 0.06, LEN + 0.1, 0.08, 0.05, FR);               // roof front edge
                        B(c.detail, u0, vB - s * 0.45, 0.32, LEN - 0.3, 0.06, 0.08, FR);                         // seat rail
                        for (const eu of [-1.6, 0, 1.6]) B(c.detail, u0 + eu, vB - s * 0.45, 0.08, 0.06, 0.26, 0.06, FR);
                        const nS = 7, sw = (LEN - 0.5) / nS;
                        for (let k = 0; k < nS; k++) { const su = u0 - (LEN - 0.5) / 2 + sw * (k + 0.5);   // bucket seats: pan + back
                            B(c.detail, su, vB - s * 0.5, 0.38, sw - 0.08, 0.05, 0.42, SEAT);
                            B(c.detail, su, vB - s * 0.24, 0.43, sw - 0.08, 0.42, 0.05, SEAT); }
                        const [cx2, cz2] = P(u0, vC); sportsColl.push({ x: cx2, z: cz2, hw: DEP / 2 + 0.1, hd: LEN / 2 + 0.1, angle: ang, r: Math.hypot(DEP / 2, LEN / 2) + 0.1, poly: null, h: 2.2, prop: true, kind: 'furniture' });
                        const qd = [P(u0 - LEN / 2 - 1, vF), P(u0 + LEN / 2 + 1, vF), P(u0 + LEN / 2 + 1, vB + s), P(u0 - LEN / 2 - 1, vB + s)];
                        lmGrounds.push({ p: qd, x0: Math.min(...qd.map(v => v[0])), x1: Math.max(...qd.map(v => v[0])), z0: Math.min(...qd.map(v => v[1])), z1: Math.max(...qd.map(v => v[1])) }); // (no trees in it)
                    }
                }
                if (hl > 22) for (const sg of [-1, 1]) { const fu = sg * (hl + 0.3), fw = Math.min(hw, 24); // ball-stop fence behind the goal: posts + a few wires
                    for (let v = -fw; v <= fw + 0.01; v += 4) { const [px, pz] = P(fu, v); c.detail.box(px, base, pz, 0.08, 6, 0.08, 0, FENCE); }
                    for (const y of [1, 2.5, 4, 5.9]) { const [mx, mz] = P(fu, 0); c.detail.box(mx, base + y, mz, 0.03, 0.03, fw * 2, ang + Math.PI / 2, FENCE); }
                    { const [mx, mz] = P(fu, 0), an2 = ang + Math.PI / 2; sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: fw, angle: an2, r: Math.hypot(0.1, fw), poly: null, h: 6, prop: true, kind: 'fence' }); } }
            }
            rect(HL, HW); line(0, -HW, 0, HW);
            const rc = Math.min(9.15, HW * 0.27), n = 36; for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * rc, Math.sin(a0) * rc, Math.cos(a1) * rc, Math.sin(a1) * rc); }
            const bd = Math.min(16.5, HL * 0.3), bw = Math.min(20.16, HW * 0.6), gw = HL > 40 ? 3.66 : HL > 22 ? 2.5 : 1.5, gh = HL > 40 ? 2.44 : 2;
            // goals (2026-11-08, owner: "a bit more details on goal post"): round white posts and crossbar, a net that runs
            // from the crossbar back over a short top and slopes to a ground bar (≈ 2 m deep), side nets, rear stanchions,
            // a fine thin mesh (two-sided strips in the detail layer)
            const POSTC = rgb('#f6f6f4'), NETC = rgb('#e6e8e8'), PR = gh > 2.3 ? 0.06 : 0.05;
            const V3 = (u, v, y) => { const [x, z] = P(u, v); return [x, base + y, z]; };
            const strand = (a, b2, side, w = 0.018) => { // a thin quad from a to b2, widened along `side` (unit, in the net's plane), both faces
                const sx = side[0] * w / 2, sy = side[1] * w / 2, sz = side[2] * w / 2;
                const q = [[a[0] - sx, a[1] - sy, a[2] - sz], [b2[0] - sx, b2[1] - sy, b2[2] - sz], [b2[0] + sx, b2[1] + sy, b2[2] + sz], [a[0] + sx, a[1] + sy, a[2] + sz]];
                const dx = b2[0] - a[0], dy = b2[1] - a[1], dz = b2[2] - a[2], nx = dy * side[2] - dz * side[1], ny = dz * side[0] - dx * side[2], nz = dx * side[1] - dy * side[0];
                c.detail.face4(q[0], q[1], q[2], q[3], NETC, [nx, ny, nz]); c.detail.face4(q[0], q[3], q[2], q[1], NETC, [-nx, -ny, -nz]);
            };
            const goal = (g, sg) => {
                const top = 0.8, D = Math.min(2.0, gh * 0.85), uT = g + sg * top, uB = g + sg * D; // net: crossbar → top (0.8 m) → slope → ground bar at D
                const VD = [vx, 0, vz], ryV = Math.atan2(vx, vz);
                for (const v of [-gw, gw]) { const [px, , pz] = V3(g + sg * PR, v, 0); c.detail.geo(props().cylY, px, base + gh / 2, pz, 0, PR, gh, PR, POSTC); }
                { const [tx, , tz] = V3(g + sg * PR, 0, 0); c.detail.geo(props().cylZ, tx, base + gh - PR, tz, ryV, PR, PR, gw * 2 + PR * 2, POSTC); }
                { const [bx, , bz] = V3(uB, 0, 0); c.detail.geo(props().cylZ, bx, base + 0.03, bz, ryV, 0.025, 0.025, gw * 2, POSTC); }   // ground bar
                for (const v of [-gw, gw]) { // rear stanchion (crossbar end → top corner → ground) + ground side bar
                    const a = V3(g + sg * PR, v, gh - 0.05), m2 = V3(uT, v, gh - 0.1), f = V3(uB, v, 0.03), gf = V3(g, v, 0.03);
                    const sd = [0, 0, 0]; const UD = [ux, 0, uz];
                    strand(a, m2, [0, 1, 0], 0.05); strand(m2, f, VD, 0.05); strand(gf, f, [0, 1, 0], 0.04); void sd; void UD; }
                // back net: across (v) every 0.12 m, the top + slope as strands along the net, rungs across every 0.15 m
                const slopeL = Math.hypot(D - top, gh - 0.1), nS = Math.round(slopeL / 0.15), nT = Math.round(top / 0.15);
                const SL = [ux * sg * (D - top) / slopeL, -(gh - 0.1) / slopeL, uz * sg * (D - top) / slopeL];
                for (let v = -gw; v <= gw + 0.001; v += 0.12) { strand(V3(g + sg * PR, v, gh - 0.08), V3(uT, v, gh - 0.1), VD); strand(V3(uT, v, gh - 0.1), V3(uB, v, 0.03), VD); }
                for (let k = 1; k <= nT; k++) { const u = g + sg * top * k / nT; strand(V3(u, -gw, gh - 0.09), V3(u, gw, gh - 0.09), [ux, 0, uz]); }
                for (let k = 1; k < nS; k++) { const t = k / nS, u = uT + sg * (D - top) * t, y = gh - 0.1 - (gh - 0.13) * t; strand(V3(u, -gw, y), V3(u, gw, y), SL); }
                for (const v of [-gw, gw]) { // side nets: verticals every 0.15 m under the top / slope, horizontals every 0.15 m
                    for (let u2 = 0.15; u2 < D; u2 += 0.15) { const yTop = u2 <= top ? gh - 0.1 : gh - 0.1 - (gh - 0.13) * (u2 - top) / (D - top); strand(V3(g + sg * u2, v, 0.03), V3(g + sg * u2, v, yTop), [ux, 0, uz]); }
                    for (let y = 0.15; y < gh - 0.1; y += 0.15) { const uEnd = y >= gh - 0.1 ? top : top + (D - top) * (gh - 0.1 - y) / (gh - 0.13); strand(V3(g + sg * PR, v, y), V3(g + sg * Math.min(D, uEnd), v, y), [0, 1, 0]); }
                }
            };
            for (const sg of [-1, 1]) {
                const g = sg * HL; line(g, -bw, g - sg * bd, -bw); line(g - sg * bd, -bw, g - sg * bd, bw); line(g - sg * bd, bw, g, bw);
                if (HL > 22) { const b6 = Math.min(9.16, gw + 5.5), d6 = Math.min(5.5, bd * 0.33); line(g, -b6, g - sg * d6, -b6); line(g - sg * d6, -b6, g - sg * d6, b6); line(g - sg * d6, b6, g, b6); } // goal area
                goal(g, sg);
                for (const v of [-gw, gw]) { const [px, pz] = P(g + sg * 0.05, v); sportsColl.push({ x: px, z: pz, r: 0.08, hw: 0.08, hd: 0.08, angle: 0, poly: null, h: 3, prop: true, kind: 'post' }); }
            }
            __live.pitchesDressed++;
        }
    };
    return {
        dressSports,
    };
}
