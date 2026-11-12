// ============================================================================
//  Grădina Cișmigiu (Bucharest): the oldest public garden (1847–54, Wilhelm
//  Mayer). The winding lake (OSM way 16292044) with rowing boats in summer and
//  the skating rink in winter, weeping willows, footbridges, the boat landing,
//  the Writers' Rotunda (12 busts round a ring), the chess players "La
//  Șahiști", the French Heroes monument, the 4-faced "Cișmigiu" pole clock at
//  the Regina Elisabeta gate, wooden benches everywhere.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, polyArea, offsetPolyline, distPolyline } from '../kit.js';
import { bucBackdrop, osmPoly, cityFiller, signAtlas, bucActivity, boatRide } from '../buc.js';
import { bench } from '../osm.js';
import { clockFace, railing } from '../props.js';
import { shortWaterRoute, dryLanding } from '../water-route.js';
import { backgammonGame } from '../backgammon-game.js';
import { addBikeRental } from '../bike.js';
import { bust, standingFigure } from '../buc-streetscape.js';

// Signed distance to a ring (m; > 0 outside, < 0 inside), sampled on a grid round it and read back bilinearly. Beyond the
// grid, `far` (positive: outside). Rows use a scanline for inside/outside.
function ringDistance(ring, { pad = 14, res = 0.75, far = 1e3 } = {}) {
    const bb = polyBox(ring), x0 = bb.x0 - pad, z0 = bb.z0 - pad, nx = Math.ceil((bb.x1 - bb.x0 + 2 * pad) / res) + 1, nz = Math.ceil((bb.z1 - bb.z0 + 2 * pad) / res) + 1;
    const D = new Float32Array(nx * nz), n = ring.length, seg = [];
    for (let k = 0; k < n; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n], ex = bx - ax, ez = bz - az; seg.push([ax, az, ex, ez, ex * ex + ez * ez || 1e-9]); }
    for (let j = 0; j < nz; j++) {
        const z = z0 + j * res, xs = [];
        for (const [ax, az, ex, ez] of seg) { const bz = az + ez; if ((az > z) !== (bz > z)) xs.push(ax + ex * (z - az) / ez); }
        xs.sort((a, b) => a - b);
        for (let i = 0, c = 0; i < nx; i++) {
            const x = x0 + i * res; while (c < xs.length && xs[c] < x) c++;
            let best = 1e18; for (const [ax, az, ex, ez, l2] of seg) { const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)), dx = x - ax - ex * t, dz = z - az - ez * t, d2 = dx * dx + dz * dz; if (d2 < best) best = d2; }
            D[i + j * nx] = Math.sqrt(best) * (c % 2 ? -1 : 1);
        }
    }
    return (x, z) => {
        const u = (x - x0) / res, v = (z - z0) / res; if (u < 0 || v < 0 || u >= nx - 1 || v >= nz - 1) return far;
        const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = i + j * nx;
        return (D[k] * (1 - fu) + D[k + 1] * fu) * (1 - fv) + (D[k + nx] * (1 - fu) + D[k + nx + 1] * fu) * fv;
    };
}
/** a closed ring offset by d (> 0 outward), per vertex along the bisector of its two edges */
function ringOffset(ring, d) {
    const n = ring.length, out = polyArea(ring) < 0 ? 1 : -1;
    return ring.map((p, i) => { const a = ring[(i + n - 1) % n], b = ring[(i + 1) % n], [px, pz] = p;
        let t1x = px - a[0], t1z = pz - a[1], t2x = b[0] - px, t2z = b[1] - pz; const l1 = Math.hypot(t1x, t1z) || 1, l2 = Math.hypot(t2x, t2z) || 1; t1x /= l1; t1z /= l1; t2x /= l2; t2z /= l2;
        const n1x = -t1z * out, n1z = t1x * out, n2x = -t2z * out, n2z = t2x * out; let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const k = d / Math.max(0.5, mx * n1x + mz * n1z); return [px + mx * k, pz + mz * k]; });
}

const WRITERS = ['Mihai Eminescu', 'Ion Creangă', 'Ion Luca Caragiale', 'Vasile Alecsandri', 'George Coșbuc', 'Alexandru Vlahuță', 'Bogdan Petriceicu Hasdeu', 'Duiliu Zamfirescu', 'Titu Maiorescu', 'Nicolae Bălcescu', 'Alexandru Odobescu', 'Ștefan Octavian Iosif'];

export default {
    env: { fogFar: 2600, ambientCity: 0.2, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('cismigiu'), r = rng(41);
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.5);
        const lake = osmPoly(d, 'w16292044');
        const landing = d.pois.find(p => p.id === 'n473428602');
        let level = T0 - 1.3, lakeD = null, shoreY = T0;
        const winterSeason = s => s.r3d?.weather?.season ? s.r3d.weather.season === 'winter' : [12,1,2].includes(+new Intl.DateTimeFormat('en', {timeZone:'Europe/Bucharest',month:'numeric'}).format(s.r3d?.simDate || s.host.date || new Date()));
        // (owner, 2026-11-11: "cismigiu gardens still look terrible ... a FULL visual refresh") The lake was a flat sheet over a
        // terrain pushed down inside the outline, drawn by 3 m grid cells as a jagged stepped bank, water spilling past the
        // railing. Now: the lawns ease down to one shore height, the terrain is cut exactly along the mapped outline, and a
        // granite kerb edges the water 0.4 m below it, as round the real lake. Shore height and kerb sizes are estimates.
        if (lake) {
            ctx.skipAreas.add('w16292044');
            const outside = ringOffset(lake, 2.5); let s = 0; for (const [x, z] of outside) s += g.heightAt(x, z);
            shoreY = s / outside.length; level = shoreY - 0.42; lakeD = ringDistance(lake);
            const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
            g.mod((x, z, h) => { const sd = lakeD(x, z); if (sd >= 12) return h; if (sd >= 0) return shoreY + (h - shoreY) * smooth(1.2, 12, sd); return sd > -0.4 ? shoreY + (level - 1.4 - shoreY) * (-sd / 0.4) : level - 1.4; });
            const w = ctx.water(level, polyBox(lake), [], { color: '#3d5a50' }), wr = ringOffset(lake, 0.12), wg = new THREE.BufferGeometry();
            const tris = THREE.ShapeUtils.triangulateShape(wr.map(([x, z]) => new THREE.Vector2(x, z)), []), wp = [];
            for (const [x, z] of wr) wp.push(x, 0, z);
            const idx = []; for (const [a, b2, c] of tris) { const ax = wr[a], bx = wr[b2], cx = wr[c], up = (bx[0] - ax[0]) * (cx[1] - ax[1]) - (bx[1] - ax[1]) * (cx[0] - ax[0]); idx.push(...(up < 0 ? [a, b2, c] : [a, c, b2])); }
            wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(idx); wg.computeVertexNormals();
            w.geometry.dispose(); w.geometry = wg; w.position.set(0, level, 0);
        }
        const b = new GeoBatch(), signs = [];
        // (owner, 2026-11-11: "the bike functionality that was in Herăstrău added back for Cișmigiu") A docking station on a
        // paved pad beside the arrival alley (OSM way 39305680), on the side away from the lake. No station is mapped here:
        // its place, size and name are estimates.
        const bikeDock = (() => {
            const w = d.ways.find((w) => w.id === 'w39305680'); if (!w) return null;
            const X = -7.6, Z = -78.4, q = distPolyline(X, Z, w.pts), [ax, az] = w.pts[q.i], [bx, bz] = w.pts[q.i + 1], L = Math.hypot(bx - ax, bz - az) || 1, tx = (bx - ax) / L, tz = (bz - az) / L;
            let nx = -tz, nz = tx; if ((X - q.cx) * nx + (Z - q.cz) * nz < 0) { nx = -nx; nz = -nz; } // (n: from the alley to the dock)
            const x = q.cx + nx * 3.3, z = q.cz + nz * 3.3, P = (u, v) => [q.cx + tx * u + nx * v, q.cz + tz * u + nz * v];
            return { x, z, heading: Math.atan2(nx, nz), n: 6, pad: [P(-3.6, 1.4), P(3.6, 1.4), P(3.6, 4.7), P(-3.6, 4.7)] };
        })();
        // footbridges over the lake (OSM bridge ways), note 35: smooth arched decks (walkable surface follows the arch), white
        // stone fascia girders, continuous cast-iron railings; the lakeside railing opens where a bridge or a path meets the shore
        const bridges = lake ? d.ways.filter((w) => w.bridge && w.bridge !== 'no' && ['footway', 'path', 'pedestrian'].includes(w.k) && w.pts.some(([x, z]) => inPoly(x, z, lake) || distPolyline(x, z, [...lake, lake[0]]).d < 8)) : [];
        const shorePaths = d.ways.filter((w) => ['footway', 'path', 'pedestrian', 'steps'].includes(w.k) && !(w.bridge && w.bridge !== 'no'));
        for (const w of bridges) {
            const pts = w.pts, Ltot = (() => { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return L; })(); if (Ltot < 2) continue;
            const ya = g.heightAt(...pts[0]), yb = g.heightAt(...pts[pts.length - 1]), rise = Math.min(1.6, 0.5 + Ltot * 0.06), W = 2.8;
            const samp = []; { let acc = 0; for (let k = 1; k < pts.length; k++) { const [ax, az] = pts[k - 1], [bx, bz] = pts[k], L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / 0.6)); for (let q = (k === 1 ? 0 : 1); q <= n; q++) { const t = q / n; samp.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, s: acc + L * t }); } acc += L; } }
            const yAtS = (sv) => { const t = Math.max(0, Math.min(1, sv / Ltot)); return ya + (yb - ya) * t + Math.sin(t * Math.PI) * rise + 0.06; };
            samp.forEach((q, k) => { const a = samp[Math.max(0, k - 1)], c = samp[Math.min(samp.length - 1, k + 1)], dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz) || 1; q.nx = -dz / L; q.nz = dx / L; q.y = yAtS(q.s); });
            // deck ribbon (top + both fascias down to a shallow arch soffit)
            for (let k = 1; k < samp.length; k++) {
                const A = samp[k - 1], B = samp[k], hw = W / 2;
                const P = (q, sd, dy) => [q.x + q.nx * sd * hw, q.y + dy, q.z + q.nz * sd * hw];
                b.quad(P(A, 1, 0), P(B, 1, 0), P(B, -1, 0), P(A, -1, 0), '#b9ada0', 'stone'); b.quad(P(A, -1, 0), P(B, -1, 0), P(B, 1, 0), P(A, 1, 0), '#b9ada0', 'stone');
                const dA = 0.35 + (1 - Math.sin(Math.max(0, Math.min(1, A.s / Ltot)) * Math.PI)) * 0.25, dB = 0.35 + (1 - Math.sin(Math.max(0, Math.min(1, B.s / Ltot)) * Math.PI)) * 0.25;
                for (const sd of [-1, 1]) { const a0 = P(A, sd * 1.04, 0.08), b0 = P(B, sd * 1.04, 0.08), a1 = P(A, sd * 1.04, -dA), b1 = P(B, sd * 1.04, -dB); b.quad(a1, b1, b0, a0, '#eeeae1', 'stone'); b.quad(a0, b0, b1, a1, '#eeeae1', 'stone'); }
                b.quad(P(A, -1.04, -dA), P(B, -1.04, -dB), P(B, 1.04, -dB), P(A, 1.04, -dA), '#cfc8bb', 'stone');
            }
            for (const sd of [-1, 1]) {
                const rp = samp.map((q) => [q.x + q.nx * sd * (W / 2 - 0.08), q.z + q.nz * sd * (W / 2 - 0.08)]), yOf = (x, z) => { let bi = 0, bd = 1e9; rp.forEach(([px, pz], k) => { const dd = (px - x) ** 2 + (pz - z) ** 2; if (dd < bd) { bd = dd; bi = k; } }); return samp[bi].y; };
                railing(b, rp, yOf, { h: 1.05, post: 1.2, color: '#1f2a26', r: 0.025 });
                for (let k = 1; k < rp.length; k++) { const [ax, az] = rp[k - 1], [bx, bz] = rp[k]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: samp[k - 1].y - 0.3, y1a: samp[k - 1].y + 1.1, y0b: samp[k].y - 0.3, y1b: samp[k].y + 1.1, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); }
            }
            const deck = [...samp.map((q) => [q.x + q.nx * (W / 2 - 0.1), q.z + q.nz * (W / 2 - 0.1)]), ...samp.map((q) => [q.x - q.nx * (W / 2 - 0.1), q.z - q.nz * (W / 2 - 0.1)]).reverse()];
            g.addPoly(deck, (x, z) => { let bi = 0, bd = 1e9; samp.forEach((q, k) => { const dd = (q.x - x) ** 2 + (q.z - z) ** 2; if (dd < bd) { bd = dd; bi = k; } }); return samp[bi].y; }, level - 2);
            w._samp = samp;
        }
        // lake edge: a granite kerb (0.45 m coping, a vertical face down into the water, darker below the waterline) on a dark
        // lake bed; a low cast-iron railing on the coping, open at the landing, the bridge heads and paths reaching the shore;
        // weeping willows on the banks, leaning over the water
        if (lake) {
            const n = lake.length, Oc = ringOffset(lake, 0.45), yTop = shoreY + 0.07, yBed = level - 1.25, kerb = new GeoBatch();
            for (let i = 0; i < n; i++) {
                const P0 = lake[i], P1 = lake[(i + 1) % n], O0 = Oc[i], O1 = Oc[(i + 1) % n], V = ([x, z], y) => [x, y, z];
                kerb.quad(V(P0, yTop), V(P1, yTop), V(O1, yTop), V(O0, yTop), '#bdb6a8', 'stone'); kerb.quad(V(O0, yTop), V(O1, yTop), V(P1, yTop), V(P0, yTop), '#bdb6a8', 'stone');
                for (const [ya, yb, c] of [[yTop, level + 0.1, '#a9a294'], [level + 0.1, yBed, '#4c4b40']]) { kerb.quad(V(P0, ya), V(P1, ya), V(P1, yb), V(P0, yb), c, 'stone'); kerb.quad(V(P0, yb), V(P1, yb), V(P1, ya), V(P0, ya), c, 'stone'); }
                kerb.quad(V(O0, yTop), V(O1, yTop), V(O1, shoreY - 0.3), V(O0, shoreY - 0.3), '#a59e90', 'stone'); kerb.quad(V(O0, shoreY - 0.3), V(O1, shoreY - 0.3), V(O1, yTop), V(O0, yTop), '#a59e90', 'stone');
            }
            kerb.flat(lake, yBed, '#2c362d', 'stone');
            ctx.add(kerb.build('cismigiu-lake-kerb', { castShadow: false }));
            ctx.extras.lakeShore = { level, shoreY, kerbTop: yTop };
            // the Debarcader (boat landing, OSM node 473428602): a timber landing stage on piles out from the kerb, with three
            // rowing boats moored along it. Its size and build are estimates.
            if (landing) {
                const q = distPolyline(landing.x, landing.z, [...lake, lake[0]]), [ax, az] = lake[q.i], [bx, bz] = lake[(q.i + 1) % n], el = Math.hypot(bx - ax, bz - az) || 1;
                const ux = (bx - ax) / el, uz = (bz - az) / el; let nx = -uz, nz = ux; if (lakeD(q.cx + nx, q.cz + nz) > 0) { nx = -nx; nz = -nz; } // (n: into the water)
                const st = new GeoBatch(), yD = yTop + 0.02, D = 3.2, Wd = 7, P = (u, v, y) => [q.cx + ux * u + nx * v, y, q.cz + uz * u + nz * v], yaw = Math.atan2(ux, uz);
                for (let k = 0; k < 14; k++) { const u0 = -Wd / 2 + k * Wd / 14 + .02, u1 = u0 + Wd / 14 - .04; const c = k % 3 ? '#8a6a48' : '#7c5d3e'; st.quad(P(u0, -.3, yD), P(u0, D, yD), P(u1, D, yD), P(u1, -.3, yD), c, 'wood'); st.quad(P(u1, -.3, yD), P(u1, D, yD), P(u0, D, yD), P(u0, -.3, yD), c, 'wood'); st.box(...P((u0 + u1) / 2, D / 2 - .15, yD - .12), D + .3, .12, u1 - u0, '#5e4630', 'wood', yaw); }
                for (const u of [-Wd / 2 + .2, 0, Wd / 2 - .2]) for (const v of [1.1, D - .15]) { const [x, , z] = P(u, v, 0); st.cyl(x, level - 1.2, z, .11, yD - level + 1.15, '#4b3a2a', 'wood', 8); }
                st.box(...P(0, D - .08, yD - .22), .16, .2, Wd, '#6b5236', 'wood', yaw);
                for (const u of [-Wd / 2 + .2, Wd / 2 - .2]) { const [x, , z] = P(u, D - .15, 0); st.cyl(x, yD, z, .07, .55, '#3c3026', 'wood', 8); }
                ctx.add(st.build('cismigiu-debarcader'));
                g.addPoly([P(-Wd / 2, -.3, 0), P(Wd / 2, -.3, 0), P(Wd / 2, D, 0), P(-Wd / 2, D, 0)].map(([x, , z]) => [x, z]), yD, level - 2);
                for (let k = 0; k < 3; k++) { const [x, , z] = P(-2.2 + k * 2.2, D + 1.05, 0), m = new THREE.Group(), hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: ['#e8e2d2', '#2f5a7a', '#e8e2d2'][k], roughness: 0.6 })); hull.scale.set(0.75, 0.42, 2.0); m.add(hull);
                    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: '#7a5a3c' })); seat.position.y = -0.05; m.add(seat); m.position.set(x, level + .02, z); m.rotation.y = Math.atan2(nx, nz) + (k - 1) * .06; ctx.add(m);
                    ctx.onUpdate((dt, s2) => { m.visible = !winterSeason(s2); m.position.y = level + .02 + Math.sin(s2.t * 1.1 + k) * .02; }); }
            }
            const lw = ringOffset(lake, 0.24); lw.push(lw[0]);
            const open = (x, z) => (landing && Math.hypot(x - landing.x, z - landing.z) < 8) || bridges.some((w) => distPolyline(x, z, w.pts).d < 2.6) || shorePaths.some((w) => { const e0 = w.pts[0], e1 = w.pts[w.pts.length - 1]; return [e0, e1].some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 2.2) && distPolyline(x, z, w.pts).d < 1.8; });
            let run = []; const flush = () => { if (run.length >= 2) { railing(b, run, () => yTop, { h: 0.75, post: 2.4, color: '#22292a', r: 0.022 }); for (let i = 1; i < run.length; i++) { const [ax, az] = run[i - 1], [bx, bz] = run[i]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: level - 3, y1a: level + 4, y0b: level - 3, y1b: level + 4, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); } } run = []; };
            for (let i = 0; i < lw.length; i++) { const [x, z] = lw[i]; if (open(x, z)) { flush(); continue; } if (i > 0 && open((x + lw[i - 1][0]) / 2, (z + lw[i - 1][1]) / 2)) flush(); run.push([x, z]); }
            flush();
            // willows: about every 14 m of bank, 2.2-3.4 m back from the kerb (their curtains hang out over the water)
            const ends = shorePaths.flatMap(w => [w.pts[0], w.pts[w.pts.length - 1]]), back0 = ringOffset(lake, 1);
            for (let acc = 0, i = 0; i < n; i++) { const [x, z] = lake[i], [x2, z2] = lake[(i + 1) % n]; acc += Math.hypot(x2 - x, z2 - z); if (acc < 14) continue; acc = r() * 4;
                const back = 2.2 + r() * 1.2, tx = x + (back0[i][0] - x) * back, tz = z + (back0[i][1] - z) * back;
                if (lakeD(tx, tz) < 1.8 || bridges.some((w) => distPolyline(tx, tz, w.pts).d < 6) || (landing && Math.hypot(tx - landing.x, tz - landing.z) < 10) || ends.some(([ex2, ez2]) => Math.hypot(ex2 - tx, ez2 - tz) < 4)) continue;
                ctx.trees.push({ x: tx, z: tz, kind: 'willow', willow: true, s: 0.9 + r() * 0.3, c: r.pick(['#9cb457', '#a5bb5e', '#92ad50', '#aac163']) }); }
        }
        // rowing boats (summer) moored at the landing + drifting; in winter the rink is up (OSM ice_rink area)
        const boats = [];
        if (lake) { const bb = polyBox(lake); for (let i = 0; i < 9; i++) { let x = 0, z = 0; for (let k = 0; k < 40; k++) { x = bb.x0 + r() * (bb.x1 - bb.x0); z = bb.z0 + r() * (bb.z1 - bb.z0); if (inPoly(x, z, lake) && distPolyline(x, z, [...lake, lake[0]]).d > 6) break; } const m = new THREE.Group(); const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: r.pick(['#e8e2d2', '#2f5a7a', '#c8323a', '#e8e2d2']), roughness: 0.6 })); hull.scale.set(0.75, 0.42, 2.0); hull.rotation.x = Math.PI; hull.position.y = 0.05; hull.rotation.x = 0; m.add(hull); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: '#7a5a3c' })); seat.position.y = -0.05; m.add(seat); m.position.set(x, level + 0.02, z); m.rotation.y = r() * 6.28; ctx.add(m); boats.push({ m, a: r() * 6.28, cx: x, cz: z }); }
            ctx.onUpdate((dt, s) => { const winter = winterSeason(s); for (const q of boats) { q.m.visible = !winter; if (winter) continue; q.a += dt * 0.05; const nx = q.cx + Math.cos(q.a) * 5, nz = q.cz + Math.sin(q.a) * 5; if (inPoly(nx, nz, lake)) { q.m.position.x = nx; q.m.position.z = nz; q.m.rotation.y = -q.a; } q.m.position.y = level + 0.02 + Math.sin(s.t * 1.3 + q.a * 3) * 0.03; } }); }
        const rink = osmPoly(d, 'w1508293151');
        if (rink) { const yy = g.heightAt(...centroid(rink)), ice = new GeoBatch(); ice.flat(rink, yy + .08, '#dfe9ee', 'glass'); const rinkMesh = ice.build('winter-rink'); rinkMesh.visible = false; ctx.add(rinkMesh); ctx.onUpdate((dt,s) => { rinkMesh.visible = winterSeason(s); }); }
        // the Writers' Rotunda: 12 busts on plinths round a paved circle
        const rot = d.pois.find((p) => p.id === 'n473428600') || { x: -162.6, z: 27.1 };
        // (fidelity pass 2026-11-12) OSM maps the twelve busts one by one (nodes 10877381995–10877399406): they stand on a ring
        // of about 21 m radius, not 10.5 m, and the twelfth writer is B. P. Hasdeu (the scene had Delavrancea). Each bust now
        // stands on its mapped node under its mapped name; ring paving and bench places are estimates.
        const rotBusts = (() => { const m = d.pois.filter((q) => q.artwork_type === 'bust' && q.name && Math.hypot(q.x - rot.x, q.z - rot.z) < 34); return m.length === 12 ? m.map((q) => ({ name: q.name, x: q.x, z: q.z })) : WRITERS.map((name, i) => { const a = i / 12 * Math.PI * 2; return { name, x: rot.x + Math.cos(a) * 21, z: rot.z + Math.sin(a) * 21 }; }); })();
        const rotR = rotBusts.reduce((t, q) => t + Math.hypot(q.x - rot.x, q.z - rot.z), 0) / 12;
        { const y = g.heightAt(rot.x, rot.z); ctx.painter.custom((x, T, k) => { const [px, py] = T(rot.x, rot.z); x.fillStyle = '#b8b0a2'; x.beginPath(); x.arc(px, py, (rotR + 3) * k, 0, 7); x.fill(); x.fillStyle = '#6c8a44'; x.beginPath(); x.arc(px, py, (rotR - 4.5) * k, 0, 7); x.fill(); });
            rotBusts.forEach(({ name: nm, x, z }) => { const yaw = Math.atan2(rot.x - x, rot.z - z); b.box(x, y, z, 0.7, 1.75, 0.7, '#d8d4cb', 'stone', yaw); b.box(x, y + 1.75, z, 0.82, 0.1, 0.82, '#e4e0d7', 'stone', yaw); b.sphere(x, y + 2.02, z, 0.42, 0.2, 0.24, '#f1efe9', 'stone', 10, 6); b.cyl(x, y + 2.1, z, 0.08, 0.16, '#f1efe9', 'stone', 8); b.sphere(x, y + 2.42, z, 0.15, 0.19, 0.17, '#f1efe9', 'stone', 10, 8); ctx.circle(x, z, 0.5, 2.8); signs.push({ x: x + Math.sin(yaw) * 0.42, y: y + 1.05, z: z + Math.cos(yaw) * 0.42, yaw, w: 0.78, h: 0.24, text: nm.toUpperCase(), bg: '#d8d4cb', fg: '#2a2a2a', border: false }); });
            const angs = rotBusts.map((q) => Math.atan2(q.z - rot.z, q.x - rot.x)).sort((m, n) => m - n);
            for (let i = 0; i < 12; i++) { const a0 = angs[i], a1 = i < 11 ? angs[i + 1] : angs[0] + Math.PI * 2; if (a1 - a0 < 0.3) continue; const a = (a0 + a1) / 2; bench(b, rot.x + Math.cos(a) * (rotR + 0.6), y, rot.z + Math.sin(a) * (rotR + 0.6), Math.atan2(-Math.cos(a), -Math.sin(a)), '#6e5a42', '#2e3236'); } }
        // "La Șahiști": concrete chess tables, players, onlookers
        const ch = d.pois.find((p) => p.id === 'n473428599') || { x: -134.5, z: 78.6 };
        const chessTables = [];
        {
            const y = g.heightAt(ch.x, ch.z);
            for (let i = 0; i < 6; i++) {
                const x = ch.x + (i % 3) * 3.4 - 3.4, z = ch.z + Math.floor(i / 3) * 3.6 - 1.8;
                b.cyl(x,y,z,.22,.72,'#b8b3a8','concrete',8);b.box(x,y+.72,z,.95,.08,.95,'#cfcac0','concrete');
                // Table2 keeps its source concrete base and two seats; the
                // scene-owned full backgammon board replaces its chess paint.
                if(i!==2){b.box(x,y+.805,z,.6,.01,.6,'#3a3a3a','paint');for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++)if((rank+file)%2===0)b.box(x+(file-3.5)*.075,y+.816,z+(rank-3.5)*.075,.075,.003,.075,'#e8e4d8','paint');}
                for(const s of [-1,1])b.box(x+s*.95,y,z,.4,.45,.4,'#b8b3a8','concrete');
                ctx.box(x,z,.55,.55,0,{prop:true,h:.8});chessTables.push([x,z]);
            }
        }
        // French Heroes monument, Sissi Stefanidi spring, the pole clock at the Regina Elisabeta gate
        const fh = d.pois.find((p) => p.id === 'n473428601'); if (fh) { const y = g.heightAt(fh.x, fh.z); b.box(fh.x, y, fh.z, 3.2, 1.0, 3.2, '#bdb6a8', 'stone'); b.box(fh.x, y + 1, fh.z, 2.2, 3.2, 1.6, '#d6cfc0', 'stone'); b.sphere(fh.x, y + 4.8, fh.z, 0.55, 0.9, 0.5, '#3f4a3c', 'bronze', 10, 8); ctx.box(fh.x, fh.z, 1.6, 1.6, 0, { y0: y - 1, y1: y + 6 }); }
        const ck = d.pois.find((p) => p.id === 'n10864971740'); if (ck) { const y = g.heightAt(ck.x, ck.z); b.cyl(ck.x, y, ck.z, 0.12, 4.2, '#25332c', 'metal', 8); b.box(ck.x, y + 4.2, ck.z, 0.9, 0.9, 0.9, '#25332c', 'metal'); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = clockFace(0.78, { timeZone: 'Europe/Bucharest', ink: '#1d1d1d', ring: '#1d1d1d' }); c.position.set(ck.x + Math.sin(a) * 0.46, y + 4.65, ck.z + Math.cos(a) * 0.46); c.rotation.y = a; ctx.add(c); } signs.push({ x: ck.x, y: y + 5.45, z: ck.z + 0.46, yaw: 0, w: 1.2, h: 0.28, text: 'CIȘMIGIU', bg: '#25332c', fg: '#e8d9a8', border: false }); ctx.circle(ck.x, ck.z, 0.2, 5); }
        // (fidelity pass 2026-11-12) the other mapped busts, statues and memorials of the garden, each at its OSM node with a
        // name plate (stylised volumes; makers are not credited: no sourced text). Each faces the nearest alley.
        { const alleys = d.ways.filter((w) => ['footway', 'path', 'pedestrian'].includes(w.k)), face = (q) => { let m = null; for (const w of alleys) { const c = distPolyline(q.x, q.z, w.pts); if (!m || c.d < m.d) m = c; } return m ? Math.atan2(m.cx - q.x, m.cz - q.z) : 0; };
            const plate = (q, yaw, hy, w = 0.9) => signs.push({ x: q.x + Math.sin(yaw) * 0.36, y: g.heightAt(q.x, q.z) + hy, z: q.z + Math.cos(yaw) * 0.36, yaw, w, h: 0.22, text: q.name.toUpperCase(), bg: '#d8d4cb', fg: '#2a2a2a', border: false });
            for (const q of d.pois) { if (!q.name || rotBusts.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < 0.5) || q.id === 'n473428601') continue; const yaw = face(q);
                if (q.artwork_type === 'bust') { bust(b, ctx, q.x, q.z, yaw, { plinth: 1.8 }); plate(q, yaw, 1.05, 0.6); }
                else if (q.artwork_type === 'statue' || (q.historic === 'memorial' && q.memorial === 'statue')) { standingFigure(b, ctx, q.x, q.z, yaw, q.historic ? { h: 3.4, plinth: 2.6, pw: 1.8 } : { h: 1.9, plinth: 0.8, pw: 1.0, metal: '#e9e6dd', mat: 'stone' }); }
                else if (q.historic === 'memorial' && ['stele', 'war_memorial'].includes(q.memorial)) { const y = g.heightAt(q.x, q.z); b.box(q.x, y, q.z, 1.6, 0.3, 1.0, '#bdb6a8', 'stone', yaw); b.box(q.x, y + 0.3, q.z, 1.1, 2.3, 0.5, '#d6cfc0', 'stone', yaw); ctx.box(q.x, q.z, 0.8, 0.5, yaw, { y0: y - 1, y1: y + 2.8 }); plate({ ...q, x: q.x - Math.sin(yaw) * 0.1, z: q.z - Math.cos(yaw) * 0.1 }, yaw, 1.5, 0.9); }
                else if (q.amenity === 'fountain') { const y = g.heightAt(q.x, q.z); b.box(q.x, y, q.z, 1.8, 0.5, 1.2, '#bdb6a8', 'stone', yaw); b.box(q.x - Math.sin(yaw) * 0.35, y + 0.5, q.z - Math.cos(yaw) * 0.35, 1.5, 1.5, 0.45, '#d6cfc0', 'stone', yaw); b.box(q.x + Math.sin(yaw) * 0.2, y + 0.5, q.z + Math.cos(yaw) * 0.2, 1.0, 0.06, 0.5, '#4d6a70', 'water', yaw); ctx.box(q.x, q.z, 0.9, 0.6, yaw, { y0: y - 1, y1: y + 2 }); plate(q, yaw, 1.7, 1.2); } }
        }
        ctx.add(b.build('cismigiu'));
        const SA = signAtlas(signs, { name: 'cismigiu-signs', night: 0.3 }); if (SA) ctx.add(SA);
        // ground, dense old trees, lamps, benches (OSM benches + rows along the lake)
        ctx.terrainOpts = { bg: '#6a8444', bgMask: 'grass', innerPx: 2048, innerStep: 2, outerStep: 16, outerPad: 600, cutouts: lake ? [lake] : [] };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#22262a', lampH: 4.2, lampPad: 5, treeLod: { cap: 1800, max: 380 }, lampOpts: { spacing: 26, kinds: ['footway', 'path', 'pedestrian'] }, streetTreeOpts: { kinds: ['secondary', 'tertiary'], prob: 0.6 }, areaTreeOpts: { kinds: ['wood', 'forest', 'park'], density: 1 / 140, conifer: 0.08 } });
        const park = osmPoly(d, 'w16291869');
        // (owner, 2026-11-11, spot pass: plain grey path strips, one flat green) Lawns mottled in greens and straw; the alleys
        // redrawn by their mapped surface (asphalt, paving stones, setts) with a stone kerb, at estimated widths (untagged in
        // OSM: asphalt 3 m, paving 2.6 m, setts 2.4 m); low green hoop borders along the lawn edges, as in Bucharest parks.
        if (park) {
            const pr = rng(77), pb = polyBox(park);
            ctx.painter.custom((x, T, k) => { x.save(); x.beginPath(); park.forEach(([wx, wz], i) => { const [px, py] = T(wx, wz); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.closePath(); x.clip();
                for (let i = 0; i < 2600; i++) { const wx = pb.x0 + pr() * (pb.x1 - pb.x0), wz = pb.z0 + pr() * (pb.z1 - pb.z0), [px, py] = T(wx, wz), rr = (2 + pr() * 7) * k;
                    x.fillStyle = pr() < 0.55 ? `rgba(48,74,30,${0.05 + pr() * 0.07})` : pr() < 0.6 ? `rgba(150,150,80,${0.05 + pr() * 0.06})` : `rgba(110,140,60,${0.05 + pr() * 0.06})`; x.beginPath(); x.ellipse(px, py, rr, rr * (0.5 + pr() * 0.5), pr() * 3, 0, 7); x.fill(); }
                x.restore(); });
            const parkWays = d.ways.filter((w) => ['footway', 'path', 'pedestrian'].includes(w.k) && !(w.bridge && w.bridge !== 'no') && w.pts.length > 1 && w.pts.some(([x, z]) => inPoly(x, z, park)));
            const look = (w) => w.surface === 'sett' ? { W: 2.4, c: '#8a847a', m: 'cobble' } : /paving|concrete/.test(w.surface || '') ? { W: 2.6, c: '#aaa497', m: 'slab' } : w.surface === 'dirt' ? { W: 1.6, c: '#9c8a6c', m: 'dirt' } : { W: 3.0, c: '#5d5d58', m: 'asphalt' };
            for (const w of parkWays) { const L2 = look(w); ctx.painter.line(w.pts, L2.W + 0.36, '#bdb7aa', 'slab'); }
            for (const w of parkWays) { const L2 = look(w); ctx.painter.line(w.pts, L2.W, L2.c, L2.m); }
            if (bikeDock) ctx.painter.poly(bikeDock.pad, '#aaa497', 'slab');
            // hoop borders: a strip of overlapping low hoops (alpha-tested), 0.45 m off the kerb, broken where another alley,
            // a bridge or the lake comes close
            const hoopTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.clearRect(0, 0, 256, 64); x.strokeStyle = '#ffffff'; x.lineWidth = 3.2;
                for (let i = -1; i < 9; i++) { x.beginPath(); x.arc(i * 32 + 16, 64, 30, Math.PI, 2 * Math.PI); x.stroke(); }
                const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
            const hoopMat = new THREE.MeshStandardMaterial({ map: hoopTex, color: '#2e4a34', alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
            const segs = new Map(), cell = 8, key = (i, j) => i + ',' + j;
            for (const w of d.ways) { if (!['footway', 'path', 'pedestrian', 'cycleway', 'service', 'steps'].includes(w.k)) continue; const hw = (w.k === 'footway' || w.k === 'path' || w.k === 'pedestrian' ? look(w).W : 4) / 2;
                for (let i = 1; i < w.pts.length; i++) { const a = w.pts[i - 1], c2 = w.pts[i]; for (let ci = Math.floor(Math.min(a[0], c2[0]) / cell) - 1; ci <= Math.floor(Math.max(a[0], c2[0]) / cell) + 1; ci++) for (let cj = Math.floor(Math.min(a[1], c2[1]) / cell) - 1; cj <= Math.floor(Math.max(a[1], c2[1]) / cell) + 1; cj++) { const k2 = key(ci, cj); if (!segs.has(k2)) segs.set(k2, []); segs.get(k2).push([a, c2, hw, w]); } } }
            const clearOf = (x, z, own) => { for (const [a, c2, hw, w] of segs.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []) { if (w === own) continue; const ex = c2[0] - a[0], ez = c2[1] - a[1], l2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)); if (Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t) < hw + 0.6) return false; } return true; };
            const hb = new GeoBatch(); let hoopM = 0;
            for (const w of parkWays) { if (w.surface === 'dirt') continue; const off = look(w).W / 2 + 0.18 + 0.45;
                for (const sd of [-1, 1]) { const line = offsetPolyline(w.pts, sd * off); let run = [];
                    const flush = () => { for (let i = 1; i < run.length; i++) { const [ax, az] = run[i - 1], [bx, bz] = run[i], l = Math.hypot(bx - ax, bz - az), ya = g.heightAt(ax, az), yb = g.heightAt(bx, bz); hoopM += l; hb.quad([ax, ya, az], [bx, yb, bz], [bx, yb + 0.32, bz], [ax, ya + 0.32, az], '#ffffff', 'hoop', [0, 0, l / 0.5, 0, l / 0.5, 1, 0, 1]); } run = []; };
                    for (let i = 1; i < line.length; i++) { const [ax, az] = line[i - 1], [bx, bz] = line[i], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / 1)); for (let q = (i === 1 ? 0 : 1); q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n;
                        const ok = inPoly(x, z, park) && clearOf(x, z, w) && !(lakeD && lakeD(x, z) < 1.5) && !bridges.some((bw) => distPolyline(x, z, bw.pts).d < 4) && !(bikeDock && Math.hypot(x - bikeDock.x, z - bikeDock.z) < 4.6);
                        if (ok) run.push([x, z]); else flush(); } }
                    flush(); } }
            if (hoopM) { ctx.add(hb.build('cismigiu-hoop-borders', { castShadow: false, matOverrides: { hoop: hoopMat } })); ctx.extras.hoopBordersM = Math.round(hoopM); }
        }
        if (park) { for (const w of d.ways) { if (!['footway', 'path'].includes(w.k) || !w.pts.some(([x, z]) => inPoly(x, z, park))) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L; for (let t = r() * 10; t < L; t += 9 + r() * 5) for (const sd of [-1, 1]) { if (r() < 0.35) continue; const x = ax + (bx - ax) * t / L + nx * sd * (3.6 + r() * 2), z = az + (bz - az) * t / L + nz * sd * (3.6 + r() * 2); if (lake && (inPoly(x, z, lake) || distPolyline(x, z, [...lake, lake[0]]).d < 2.5)) continue; if (Math.hypot(x - rot.x, z - rot.z) < rotR + 4 || Math.hypot(x - ch.x, z - ch.z) < 7) continue; ctx.trees.push({ x, z, kind: r() < 0.08 ? 'con' : 'broad', s: 1.2 + r() * 0.6 }); } } } }
        ctx.trees = ctx.trees.filter((t) => !(lake && inPoly(t.x, t.z, lake)));
        // keep the alleys clear (no trunks on the paths) and the postcard view along the lake open
        const paths = d.ways.filter((w) => ['footway', 'path', 'pedestrian', 'cycleway', 'service'].includes(w.k));
        ctx.trees = ctx.trees.filter((t) => !paths.some((w) => distPolyline(t.x, t.z, w.pts).d < 2.6));
        if (bikeDock) ctx.trees = ctx.trees.filter((t) => Math.hypot(t.x - bikeDock.x, t.z - bikeDock.z) > 4.5);
        const ic = sp.photo.iconic; let shore = { x: ic.x, z: ic.z };
        if (lake) { const q = distPolyline(ic.x, ic.z, [...lake, lake[0]]), [lx, lz] = centroid(lake), inside = inPoly(ic.x, ic.z, lake); const ox = q.cx - lx, oz = q.cz - lz, L = Math.hypot(ox, oz) || 1; shore = { x: q.cx + ox / L * 3.2, z: q.cz + oz / L * 3.2 }; void inside; }
        const view = (t) => { const a = (320 * Math.PI) / 180, fx = Math.sin(a), fz = -Math.cos(a), u = (t.x - shore.x) * fx + (t.z - shore.z) * fz; if (u < -3 || u > 120) return true; const v = Math.abs((t.x - shore.x) * fz - (t.z - shore.z) * fx); return v > 3 + u * 0.18; };
        ctx.trees = ctx.trees.filter(view);
        ctx.extras.shore = shore;
        // benches in pairs along the lake path
        if (lake) { const bb2 = new GeoBatch(), L = offsetPolyline([...lake, lake[0]], polyArea(lake) > 0 ? -4.2 : 4.2); for (let i = 3; i < L.length; i += 9) { const [x, z] = L[i], [x2, z2] = L[i - 1], a = Math.atan2(x2 - x, z2 - z) + Math.PI / 2, y = g.heightAt(x, z); if (Math.hypot(x - ch.x, z - ch.z) < 8) continue; bench(bb2, x, y, z, a); ctx.box(x, z, 0.9, 0.3, a, { prop: true, h: 0.45 }); } ctx.add(bb2.build('lake-benches')); }
        cityFiller(ctx, { ring: 600 });
        // plaques, fun, postcard
        const PL = sp.plaques;
        if (ck) ctx.plaque(PL[0], ck.x + 3, ck.z - 3, Math.PI, { style: 'park', credit: 'Laid out by Wilhelm Mayer (from 1847), completed by Franz Harrer.' });
        ctx.plaque(PL[1], -110.4 + 2.5, -11.4 + 1.5, 0, { style: 'park' });
        if (rink) { const [rx, rz] = centroid(rink); ctx.plaque(PL[2], rx - 18, rz, -Math.PI / 2, { style: 'park' }); }
        ctx.plaque(PL[3], rot.x + rotR + 4.5, rot.z + 2, Math.PI / 2, { style: 'bronze', credit: 'Writers\' Rotunda (1943); busts by several sculptors.' });
        ctx.plaque(PL[4], -40, 40, Math.PI / 2, { style: 'park' });
        { const [x,z]=chessTables[2];backgammonGame(ctx,{x,z,y:g.heightAt(ch.x,ch.z)+.8,source:ch.id,onDone:s=>bucActivity(s,'cismigiu','backgammon','🎲 A match at La Șahiști','You bore off all fifteen checkers and beat Doru, a park regular.')}); }
        if (bikeDock) { ctx.extras.bikeRental = addBikeRental(ctx, { x: bikeDock.x, z: bikeDock.z, heading: bikeDock.heading, n: bikeDock.n, name: 'Cișmigiu bike stand', colour: '#2f8f46' }); ctx.extras.bikeRentalSource = { sourced: false, estimatedLayout: true, x: bikeDock.x, z: bikeDock.z, displayedBikes: bikeDock.n }; }
        // activity (note 57): row round the lake from the landing (boats April–October; the rink replaces them in winter)
        if (lake) {
            const loop = landing && shortWaterRoute(lake, landing, { avoid: (x, z) => bridges.some(w => distPolyline(x, z, w.pts).d < 4) });
            const rb = new THREE.Group(); { const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8e2d2', roughness: 0.6 })); hull.scale.set(0.75, 0.42, 2.0); rb.add(hull); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: '#7a5a3c' })); seat.position.y = -0.05; rb.add(seat); }
            if (loop) {
                // The real Debarcader POI is the shore access, not the former
                // invented trigger 250 m away. Only a short, validated course
                // near this landing is used; all of the lake remains scenery.
                rb.position.set(loop[0][0], level + .02, loop[0][1]); ctx.add(rb);
                const ride = boatRide(ctx, rb, loop, level + .02, { speed: 1.5, title: 'Row on Lake Cișmigiu', onDone: s => bucActivity(s, 'cismigiu', 'rowboat', '🚣 Rowed in Cișmigiu', 'You rowed the short course and returned to Debarcader. Rowing on the lake is a warm-season activity.') });
                const inSeason = s => { const date = s.r3d?.simDate || s.host.date || new Date(), m = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Bucharest', month: 'numeric' }).format(date); return +m >= 4 && +m <= 10 && s.r3d?.weather?.season !== 'winter'; };
                const approach = dryLanding(lake, landing);
                ctx.extras.rowboat = { ride, path: loop, source: landing.id, landing, approach };
                ctx.interactables.push({ x: approach.x, z: approach.z, source: landing.id, r: 3, label: 'Row a boat from Debarcader (warm season)', tourAvailable: inSeason, cond: () => !ride.active(), use: s => { if (!inSeason(s)) { s.ui.toast('🚣 Boats are seasonal', 'Rowing is a warm-season activity. Current rental hours are not confirmed.'); return; } ride.start(s); } });
            }
        }
        // the Writers' Rotunda: read all twelve names (walk past each bust)
        { const seen = new Set(); ctx.onUpdate((dt, s) => { const p = s.position; if (Math.hypot(p.x - rot.x, p.z - rot.z) > rotR + 6 || seen.size >= 12) return; rotBusts.forEach(({ name: nm, x: bx, z: bz }) => { const k = 1 - 1.5 / rotR; if (Math.hypot(p.x - (rot.x + (bx - rot.x) * k), p.z - (rot.z + (bz - rot.z) * k)) < 1.9 && !seen.has(nm)) { seen.add(nm); if (seen.size === 12) bucActivity(s, 'cismigiu', 'rotunda', '📖 Twelve writers', 'You stood before every bust in the Rotunda — Eminescu to Iosif.'); } }); }); }
        ctx.challenge('cismigiu', { x: ctx.extras.shore.x, z: ctx.extras.shore.z, r: 12, tol: 30 });
        // crowd
        ctx.crowdCfg = {
            personas: { local_elder: 3.5, local_young: 3, local_parent: 2, kid: 1.4, tourist_fr: 1, tourist_it: 1 },
            walkers: 40, paths: ctx.footLines(),
            groups: [
                ...chessTables.slice(0, 4).filter((_,i)=>i!==2).flatMap(([x, z]) => [{ x: x - 0.95, z, r: 0.05, n: 1, act: 'sit', yaw: Math.PI / 2, personas: ['local_elder'] }, { x: x + 0.95, z, r: 0.05, n: 1, act: 'sit', yaw: -Math.PI / 2, personas: ['local_elder'] }]),
                { x: ch.x, z: ch.z + 4, r: 2.5, n: 6, act: 'watch', look: [ch.x, ch.z], personas: ['local_elder', 'local_elder', 'local_young'] },
                { x: rot.x + 6, z: rot.z - 5, r: 3, n: 4, act: 'photo', look: [rot.x, rot.z], personas: ['tourist_fr', 'tourist_it', 'local_young'] },
                { x: -40, z: 30, r: 3, n: 5, act: 'watch', look: [-60, 20], personas: ['kid', 'local_parent'] },
                { x: -10, z: 120, r: 0.3, n: 1, act: 'watch', personas: ['vendor'] },
            ],
        };
        ctx.sound('birds', -60, 0, 160, 1); ctx.sound('water', -60, 20, 70, 0.4); ctx.sound('crowd', ch.x, ch.z, 25, 0.5); ctx.sound('traffic', 30, 230, 120, 0.6); ctx.sound('crows', -100, -100, 160, 0.5);
        // spawn on the lakeside alley nearest the postcard point, facing along it (the direction closest to the 320° view)
        { const sh = ctx.extras.shore; let best = null; for (const w of d.ways) { if (!['footway', 'path', 'pedestrian'].includes(w.k) || w.bridge) continue; const q = distPolyline(sh.x, sh.z, w.pts); if (q.d > 4 && (!best || q.d < best.q.d)) best = { q, w }; }
            if (best) { const [ax, az] = best.w.pts[best.q.i], [bx, bz] = best.w.pts[best.q.i + 1]; let br = Math.atan2(bx - ax, -(bz - az)) * 180 / Math.PI; const df = (a) => Math.abs(((a - 320) % 360 + 540) % 360 - 180); if (df(br + 180) < df(br)) br += 180; ctx.spawns['cismigiu'] = { x: best.q.cx, z: best.q.cz, heading: headingFromBearing(br) }; }
            else ctx.spawns['cismigiu'] = { x: sh.x + 4, z: sh.z + 5, heading: headingFromBearing(320) }; }
    },
};
