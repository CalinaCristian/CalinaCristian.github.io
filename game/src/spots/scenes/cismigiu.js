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

const WRITERS = ['Mihai Eminescu', 'Ion Creangă', 'Ion Luca Caragiale', 'Vasile Alecsandri', 'George Coșbuc', 'Alexandru Vlahuță', 'Barbu Ștefănescu Delavrancea', 'Duiliu Zamfirescu', 'Titu Maiorescu', 'Nicolae Bălcescu', 'Alexandru Odobescu', 'Ștefan Octavian Iosif'];

export default {
    env: { fogFar: 2600, ambientCity: 0.2, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('cismigiu'), r = rng(41);
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.5);
        const lake = osmPoly(d, 'w16292044');
        const landing = d.pois.find(p => p.id === 'n473428602');
        let level = T0 - 1.3;
        const winterSeason = s => s.r3d?.weather?.season ? s.r3d.weather.season === 'winter' : [12,1,2].includes(+new Intl.DateTimeFormat('en', {timeZone:'Europe/Bucharest',month:'numeric'}).format(s.r3d?.simDate || s.host.date || new Date()));
        if (lake) { ctx.skipAreas.add('w16292044'); let s = 0; for (const [x, z] of lake) s += g.heightAt(x, z); level = s / lake.length - 1.1; ctx.water(level, polyBox(lake), [lake], { color: '#3f5a52', depth: 1.6 }); }
        const b = new GeoBatch(), signs = [];
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
        // lake edge: low railing (posts + rails) with openings at bridge heads and paths reaching the shore; weeping willows
        if (lake) { const L = [...lake, lake[0]];
            const lw = offsetPolyline(L, polyArea(lake) > 0 ? -1.4 : 1.4);
            const open = (x, z) => (landing && Math.hypot(x - landing.x, z - landing.z) < 8) || bridges.some((w) => distPolyline(x, z, w.pts).d < 2.6) || shorePaths.some((w) => { const e0 = w.pts[0], e1 = w.pts[w.pts.length - 1]; return [e0, e1].some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 2.2) && distPolyline(x, z, w.pts).d < 1.8; });
            let run = []; const flush = () => { if (run.length >= 2) { railing(b, run, (x, z) => g.heightAt(x, z), { h: 0.7, post: 2.6, color: '#2a2e2c', r: 0.025 }); for (let i = 1; i < run.length; i++) { const [ax, az] = run[i - 1], [bx, bz] = run[i]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: level - 3, y1a: level + 4, y0b: level - 3, y1b: level + 4, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); } } run = []; };
            for (let i = 0; i < lw.length; i++) { const [x, z] = lw[i]; if (open(x, z)) { flush(); continue; } if (i > 0 && open((x + lw[i - 1][0]) / 2, (z + lw[i - 1][1]) / 2)) flush(); run.push([x, z]); }
            flush();
            for (let i = 0; i < L.length; i += 6) { const [x, z] = L[i], o = offsetPolyline(L.slice(Math.max(0, i - 1), i + 2), polyArea(lake) > 0 ? -4.5 : 4.5)[Math.min(1, i)] || [x, z]; if (r() < 0.55 && !bridges.some((w) => distPolyline(o[0], o[1], w.pts).d < 5)) ctx.trees.push({ x: o[0], z: o[1], kind: 'broad', s: 1.3 + r() * 0.4, sy: 0.85, sx: 1.25, c: r.pick(['#8aa04a', '#94a852', '#7d9640']) }); }
        }
        // rowing boats (summer) moored at the landing + drifting; in winter the rink is up (OSM ice_rink area)
        const boats = [];
        if (lake) { const bb = polyBox(lake); for (let i = 0; i < 9; i++) { let x = 0, z = 0; for (let k = 0; k < 40; k++) { x = bb.x0 + r() * (bb.x1 - bb.x0); z = bb.z0 + r() * (bb.z1 - bb.z0); if (inPoly(x, z, lake) && distPolyline(x, z, [...lake, lake[0]]).d > 6) break; } const m = new THREE.Group(); const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: r.pick(['#e8e2d2', '#2f5a7a', '#c8323a', '#e8e2d2']), roughness: 0.6 })); hull.scale.set(0.75, 0.42, 2.0); hull.rotation.x = Math.PI; hull.position.y = 0.05; hull.rotation.x = 0; m.add(hull); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: '#7a5a3c' })); seat.position.y = -0.05; m.add(seat); m.position.set(x, level + 0.02, z); m.rotation.y = r() * 6.28; ctx.add(m); boats.push({ m, a: r() * 6.28, cx: x, cz: z }); }
            ctx.onUpdate((dt, s) => { const winter = winterSeason(s); for (const q of boats) { q.m.visible = !winter; if (winter) continue; q.a += dt * 0.05; const nx = q.cx + Math.cos(q.a) * 5, nz = q.cz + Math.sin(q.a) * 5; if (inPoly(nx, nz, lake)) { q.m.position.x = nx; q.m.position.z = nz; q.m.rotation.y = -q.a; } q.m.position.y = level + 0.02 + Math.sin(s.t * 1.3 + q.a * 3) * 0.03; } }); }
        const rink = osmPoly(d, 'w1508293151');
        if (rink) { const yy = g.heightAt(...centroid(rink)), ice = new GeoBatch(); ice.flat(rink, yy + .08, '#dfe9ee', 'glass'); const rinkMesh = ice.build('winter-rink'); rinkMesh.visible = false; ctx.add(rinkMesh); ctx.onUpdate((dt,s) => { rinkMesh.visible = winterSeason(s); }); }
        // the Writers' Rotunda: 12 busts on plinths round a paved circle
        const rot = d.pois.find((p) => p.id === 'n473428600') || { x: -162.6, z: 27.1 };
        { const y = g.heightAt(rot.x, rot.z); ctx.painter.custom((x, T, k) => { const [px, py] = T(rot.x, rot.z); x.fillStyle = '#b8b0a2'; x.beginPath(); x.arc(px, py, 13 * k, 0, 7); x.fill(); x.fillStyle = '#6c8a44'; x.beginPath(); x.arc(px, py, 5 * k, 0, 7); x.fill(); });
            WRITERS.forEach((nm, i) => { const a = i / 12 * Math.PI * 2, x = rot.x + Math.cos(a) * 10.5, z = rot.z + Math.sin(a) * 10.5, yaw = Math.atan2(rot.x - x, rot.z - z); b.box(x, y, z, 0.7, 1.75, 0.7, '#d8d4cb', 'stone', yaw); b.box(x, y + 1.75, z, 0.82, 0.1, 0.82, '#e4e0d7', 'stone', yaw); b.sphere(x, y + 2.02, z, 0.42, 0.2, 0.24, '#f1efe9', 'stone', 10, 6); b.cyl(x, y + 2.1, z, 0.08, 0.16, '#f1efe9', 'stone', 8); b.sphere(x, y + 2.42, z, 0.15, 0.19, 0.17, '#f1efe9', 'stone', 10, 8); ctx.circle(x, z, 0.5, 2.8); signs.push({ x: x + Math.sin(yaw) * 0.42, y: y + 1.05, z: z + Math.cos(yaw) * 0.42, yaw, w: 0.78, h: 0.24, text: nm.toUpperCase(), bg: '#d8d4cb', fg: '#2a2a2a', border: false }); });
            for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; bench(b, rot.x + Math.cos(a) * 12.6, y, rot.z + Math.sin(a) * 12.6, Math.atan2(rot.x - (rot.x + Math.cos(a)), rot.z - (rot.z + Math.sin(a))), '#6e5a42', '#2e3236'); } }
        // "La Șahiști": concrete chess tables, players, onlookers
        const ch = d.pois.find((p) => p.id === 'n473428599') || { x: -134.5, z: 78.6 };
        const chessTables = [];
        { const y = g.heightAt(ch.x, ch.z); for (let i = 0; i < 6; i++) { const x = ch.x + (i % 3) * 3.4 - 3.4, z = ch.z + Math.floor(i / 3) * 3.6 - 1.8; b.cyl(x, y, z, 0.22, 0.72, '#b8b3a8', 'concrete', 8); b.box(x, y + 0.72, z, 0.95, 0.08, 0.95, '#cfcac0', 'concrete'); b.box(x, y + 0.805, z, 0.6, 0.01, 0.6, '#3a3a3a', 'paint'); for (let q = 0; q < 8; q++) b.box(x - 0.26 + (q % 4) * 0.15 + (Math.floor(q / 4) % 2) * 0.075, y + 0.816, z - 0.26 + Math.floor(q / 4) * 0.3, 0.075, 0.003, 0.075, '#e8e4d8', 'paint'); for (const s of [-1, 1]) { b.box(x + s * 0.95, y, z, 0.4, 0.45, 0.4, '#b8b3a8', 'concrete'); } ctx.box(x, z, 0.55, 0.55, 0, { prop: true, h: 0.8 }); chessTables.push([x, z]); } }
        // French Heroes monument, Sissi Stefanidi spring, the pole clock at the Regina Elisabeta gate
        const fh = d.pois.find((p) => p.id === 'n473428601'); if (fh) { const y = g.heightAt(fh.x, fh.z); b.box(fh.x, y, fh.z, 3.2, 1.0, 3.2, '#bdb6a8', 'stone'); b.box(fh.x, y + 1, fh.z, 2.2, 3.2, 1.6, '#d6cfc0', 'stone'); b.sphere(fh.x, y + 4.8, fh.z, 0.55, 0.9, 0.5, '#3f4a3c', 'bronze', 10, 8); ctx.box(fh.x, fh.z, 1.6, 1.6, 0, { y0: y - 1, y1: y + 6 }); }
        const ck = d.pois.find((p) => p.id === 'n10864971740'); if (ck) { const y = g.heightAt(ck.x, ck.z); b.cyl(ck.x, y, ck.z, 0.12, 4.2, '#25332c', 'metal', 8); b.box(ck.x, y + 4.2, ck.z, 0.9, 0.9, 0.9, '#25332c', 'metal'); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = clockFace(0.78, { timeZone: 'Europe/Bucharest', ink: '#1d1d1d', ring: '#1d1d1d' }); c.position.set(ck.x + Math.sin(a) * 0.46, y + 4.65, ck.z + Math.cos(a) * 0.46); c.rotation.y = a; ctx.add(c); } signs.push({ x: ck.x, y: y + 5.45, z: ck.z + 0.46, yaw: 0, w: 1.2, h: 0.28, text: 'CIȘMIGIU', bg: '#25332c', fg: '#e8d9a8', border: false }); ctx.circle(ck.x, ck.z, 0.2, 5); }
        ctx.add(b.build('cismigiu'));
        const SA = signAtlas(signs, { name: 'cismigiu-signs', night: 0.3 }); if (SA) ctx.add(SA);
        // ground, dense old trees, lamps, benches (OSM benches + rows along the lake)
        ctx.terrainOpts = { bg: '#6a8444', bgMask: 'grass', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 600 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#22262a', lampH: 4.2, lampPad: 5, treeLod: { cap: 1800, max: 380 }, lampOpts: { spacing: 26, kinds: ['footway', 'path', 'pedestrian'] }, streetTreeOpts: { kinds: ['secondary', 'tertiary'], prob: 0.6 }, areaTreeOpts: { kinds: ['wood', 'forest', 'park'], density: 1 / 140, conifer: 0.08 } });
        const park = osmPoly(d, 'w16291869');
        if (park) { for (const w of d.ways) { if (!['footway', 'path'].includes(w.k) || !w.pts.some(([x, z]) => inPoly(x, z, park))) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L; for (let t = r() * 10; t < L; t += 9 + r() * 5) for (const sd of [-1, 1]) { if (r() < 0.35) continue; const x = ax + (bx - ax) * t / L + nx * sd * (3.6 + r() * 2), z = az + (bz - az) * t / L + nz * sd * (3.6 + r() * 2); if (lake && (inPoly(x, z, lake) || distPolyline(x, z, [...lake, lake[0]]).d < 2.5)) continue; if (Math.hypot(x - rot.x, z - rot.z) < 15 || Math.hypot(x - ch.x, z - ch.z) < 7) continue; ctx.trees.push({ x, z, kind: r() < 0.08 ? 'con' : 'broad', s: 1.2 + r() * 0.6 }); } } } }
        ctx.trees = ctx.trees.filter((t) => !(lake && inPoly(t.x, t.z, lake)));
        // keep the alleys clear (no trunks on the paths) and the postcard view along the lake open
        const paths = d.ways.filter((w) => ['footway', 'path', 'pedestrian', 'cycleway', 'service'].includes(w.k));
        ctx.trees = ctx.trees.filter((t) => !paths.some((w) => distPolyline(t.x, t.z, w.pts).d < 2.6));
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
        ctx.plaque(PL[3], rot.x + 14.5, rot.z + 2, Math.PI / 2, { style: 'bronze', credit: 'Writers\' Rotunda (1943); busts by several sculptors.' });
        ctx.plaque(PL[4], -40, 40, Math.PI / 2, { style: 'park' });
        ctx.interactables.push({ x: ch.x + 4.5, z: ch.z, r: 3, label: 'Watch a chess game at "La Șahiști"', use: (s) => { const lines = ['„Nu muta calul acolo, domnule!" — "Don\'t move the knight there, sir!"', '„Șah! Și mat în trei." — "Check! And mate in three."', '„Pe vremea mea se juca șah adevărat." — "In my day we played real chess."']; bucActivity(s, 'cismigiu', 'chess', '♟ La Șahiști', lines[Math.floor(Math.random() * lines.length)]); } });
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
        { const seen = new Set(); ctx.onUpdate((dt, s) => { const p = s.position; if (Math.hypot(p.x - rot.x, p.z - rot.z) > 14 || seen.size >= 12) return; WRITERS.forEach((nm, i) => { const a = i / 12 * Math.PI * 2; if (Math.hypot(p.x - (rot.x + Math.cos(a) * 9.2), p.z - (rot.z + Math.sin(a) * 9.2)) < 1.6 && !seen.has(nm)) { seen.add(nm); if (seen.size === 12) bucActivity(s, 'cismigiu', 'rotunda', '📖 Twelve writers', 'You stood before every bust in the Rotunda — Eminescu to Iosif.'); } }); }); }
        ctx.challenge('cismigiu', { x: ctx.extras.shore.x, z: ctx.extras.shore.z, r: 12, tol: 30 });
        // crowd
        ctx.crowdCfg = {
            personas: { local_elder: 3.5, local_young: 3, local_parent: 2, kid: 1.4, tourist_fr: 1, tourist_it: 1 },
            walkers: 40, paths: ctx.footLines(),
            groups: [
                ...chessTables.slice(0, 4).flatMap(([x, z]) => [{ x: x - 0.95, z, r: 0.05, n: 1, act: 'sit', yaw: Math.PI / 2, personas: ['local_elder'] }, { x: x + 0.95, z, r: 0.05, n: 1, act: 'sit', yaw: -Math.PI / 2, personas: ['local_elder'] }]),
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
