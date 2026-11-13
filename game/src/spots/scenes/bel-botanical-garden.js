// ============================================================================
//  Bellevue Botanical Garden: hilly Pacific Northwest forest with garden rooms
//  — the Shorts Visitor Center, the Perennial Border, the Yao Japanese garden
//  (raked gravel, stone lanterns, maples) and the Ravine Experience suspension
//  bridge over a ~15 m ravine (it sways gently while you cross).
//  Round 5 (spots-bel): garden rooms placed from the OSM survey (Perennial
//  Border, Yao Garden + gate + koi pond, ponds, Tateuchi pavilion, the Shorts
//  Visitor Center / Aaron Education Center building), Garden d'Lights holiday
//  lights (late Nov – Dec 31, night), activities: cross the ravine bridge,
//  read five plant labels (note 57).
//  ESTIMATE ON RECORD (owner decision, round 3 of the 2026-11 fidelity pass):
//  the parked cars in the visitor lot (OSM amenity=parking r19655198) are
//  kept but are an estimate — OSM maps the lot and its aisles, not its bays or
//  occupancy. Bay pitch (2.75 m), which bays are taken (~50 %, seeded) and the
//  three car models are game choices; Street View only shows the lot in use.
//  Round 3: Aaron Education Center with its two open courtyards, Shorts House
//  with its atrium, Sharp Cabin, and the eight remaining mapped artworks
//  modelled from the garden's own art page / Commons photos; the postcard
//  moved to the Perennial Border so the guided tour reaches it.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, alongPolyline, polylineLength, lerp, smooth, inPoly, polyBox, distPolyline } from '../kit.js';
import { signBoard } from '../props.js';
import { activityBlocked, onActivityCancel } from '../participation.js';
import { makeWaterMaterial } from '../../water.js';
import { addTraffic } from '../cars.js';
import { emitActivity, seasonal, waterPoly, fairyLights, gableRoof, tri, glowText, nightLit, parkPavilions, pitchMarkings, ringPrism } from './bel-common.js';

function suspensionBridge(ctx, pts) {
    const g = ctx.ground, L = polylineLength(pts), A = alongPolyline(pts, 0), B = alongPolyline(pts, L);
    const yA = g.heightAt(A.x, A.z), yB = g.heightAt(B.x, B.z), b = new GeoBatch(), sag = 1.2;
    const yAt = (t) => lerp(yA, yB, t) + 0.1 - sag * Math.sin(Math.PI * t);
    // deep ravine under the span
    g.mod((x, z, h) => { const dx = B.x - A.x, dz = B.z - A.z, LL = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / LL)), cx = A.x + dx * t, cz = A.z + dz * t, d = Math.hypot(x - cx, z - cz); if (t <= 0.05 || t >= 0.95 || d > 24) return h; return Math.min(h, lerp(yAt(t) - 15 * Math.sin(Math.PI * t), h, smooth(6, 24, d))); });
    const deck = new THREE.Group(); deck.name = 'ravine-bridge-deck';
    const yaw = Math.atan2(B.x - A.x, B.z - A.z), nx = Math.cos(yaw), nz = -Math.sin(yaw);
    const N = 40;
    for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N, x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t);
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, L / N - 0.05), new THREE.MeshStandardMaterial({ color: i % 2 ? '#8d9498' : '#858c90', roughness: 0.5, metalness: 0.6 })); // OSM w210457899 surface=metal (grating), not timber planks
        plank.position.set(x, yAt(t), z); plank.rotation.y = yaw; plank.castShadow = true; plank.userData.t = t; deck.add(plank);
        ctx.ground.addBox(x, z, 0.8, L / N / 2 + 0.02, yaw, yAt(t) - 1, yAt(t) + 0.04);
    }
    ctx.add(deck);
    // towers at both ends, main cables, hangers, mesh side rails
    for (const [P, y] of [[A, yA], [B, yB]]) for (const s of [-1, 1]) b.box(P.x + nx * s * 1.1, y - 0.2, P.z + nz * s * 1.1, 0.25, 2.6, 0.25, '#4a4f53', 'steel', yaw);
    for (const s of [-1, 1]) {
        const cable = [], rail = [];
        for (let i = 0; i <= 20; i++) { const t = i / 20, x = lerp(A.x, B.x, t) + nx * s * 1.0, z = lerp(A.z, B.z, t) + nz * s * 1.0; cable.push([x, yAt(t) + 1.15 + sag * 0.4 * (1 - Math.sin(Math.PI * t)), z]); rail.push([x, yAt(t) + 1.05, z]); if (i % 2 === 0) b.rod([x, yAt(t), z], [x, yAt(t) + 1.1, z], 0.015, '#3a3f43', 'steel', 4); }
        b.tube(cable, 0.03, '#2f3437', 'steel', 5); b.tube(rail, 0.025, '#2f3437', 'steel', 5);
        ctx.collider({ wall: true, ax: A.x + nx * s * 0.95, az: A.z + nz * s * 0.95, bx: B.x + nx * s * 0.95, bz: B.z + nz * s * 0.95, y0a: yA - 20, y1a: yA + 2, y0b: yB - 20, y1b: yB + 2, nx: 0, nz: 1 });
    }
    ctx.add(b.build('ravine-bridge'));
    // gentle sway while someone walks on it
    ctx.onUpdate((dt, s, pl) => { if (!pl) return; const on = Math.hypot(pl.x - (A.x + B.x) / 2, pl.z - (A.z + B.z) / 2) < L / 2 + 1; const amp = on ? 0.03 * Math.min(1, pl.speed) : 0.006; for (const p of deck.children) { const t = p.userData.t; p.position.y = yAt(t) + Math.sin(s.t * 3 + t * 6) * amp * Math.sin(Math.PI * t); p.rotation.z = Math.sin(s.t * 2.2) * amp * 0.6; } });
    return { A, B, yaw, yAt };
}

export default {
    env: { fogFar: 2600, ambientCity: 0.12, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-botanical-garden');
        const area = (id) => d.areas.find((a) => a.id === id)?.poly, bld = (id) => d.buildings.find((x) => x.id === id)?.poly;
        const cen = (p) => { const b = polyBox(p); return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; };
        // the Ravine Experience: a steep V-shaped creek ravine along the OSM stream (w207683155) — slopes ~40°, rocky bed
        const stream = d.areas.find((x) => x.id === 'w207683155')?.poly || [];
        const sb = polyBox(stream.length ? stream : [[0, 0], [1, 1]]);
        const bedAt = []; for (const [x, z] of stream) bedAt.push(g.heightAt(x, z));
        const bedY = (x, z) => { const q = distPolyline(x, z, stream); let i = 0, best = 1e9; stream.forEach(([px, pz], k) => { const dd = Math.hypot(px - x, pz - z); if (dd < best) { best = dd; i = k; } }); return { d: q.d, y: bedAt[i] }; };
        if (stream.length) g.mod((x, z, h) => { if (x < sb.x0 - 30 || x > sb.x1 + 30 || z < sb.z0 - 30 || z > sb.z1 + 30) return h; const q = bedY(x, z); if (q.d > 26) return h; const floor = q.y - 5.5 + Math.min(q.d, 1.6) * 0.3, wall = floor + Math.pow(Math.max(0, q.d - 1.6) / 24.4, 1.25) * 17; return Math.min(h, wall); });
        const br = d.ways.find((w) => w.id === 'w210457899') || { pts: [[160, 240], [200, 255]] };
        const bridge = suspensionBridge(ctx, br.pts);
        if (stream.length) { // the creek: a narrow ribbon of water on the bed + boulders, ferns along it
            const ribbon = []; for (let i = 0; i < stream.length; i++) { const [x, z] = stream[i], [nx2, nz2] = stream[Math.min(stream.length - 1, i + 1)], [px2, pz2] = stream[Math.max(0, i - 1)], tx = nx2 - px2, tz = nz2 - pz2, tl = Math.hypot(tx, tz) || 1; ribbon.push([[x + tz / tl * 0.9, z - tx / tl * 0.9], [x - tz / tl * 0.9, z + tx / tl * 0.9]]); }
            const poly = [...ribbon.map((q) => q[0]), ...ribbon.map((q) => q[1]).reverse()];
            const creekMat = makeWaterMaterial({ deep: '#2c3a30', shallow: '#566a50', ripple: 1.2, wave: 0.3, flow: [0.3, 0.5] });
            for (let i = 0; i + 1 < stream.length; i++) { const [ax, az] = stream[i], [qx, qz] = stream[i + 1], ya = g.heightAt(ax, az) + 0.12, yb = g.heightAt(qx, qz) + 0.12, L = Math.hypot(qx - ax, qz - az), tx = (qx - ax) / L, tz = (qz - az) / L; const seg = [[ax + tz * 0.9, az - tx * 0.9], [qx + tz * 0.9, qz - tx * 0.9], [qx - tz * 0.9, qz + tx * 0.9], [ax - tz * 0.9, az + tx * 0.9]]; waterPoly(ctx, seg, (ya + yb) / 2, { material: creekMat, cell: 1.2, name: 'creek' }); }
            void poly;
            const rb = new GeoBatch(), rr2 = rng(7); for (const [x, z] of stream) for (let k = 0; k < 4; k++) { const px = x + (rr2() - 0.5) * 5, pz = z + (rr2() - 0.5) * 5, y = g.heightAt(px, pz); rb.sphere(px, y + 0.1, pz, 0.35 + rr2() * 0.4, 0.25 + rr2() * 0.2, 0.35 + rr2() * 0.4, ['#6d6a62', '#5e5c55', '#7a766c'][k % 3], 'stone', 7, 5); }
            ctx.add(rb.build('creek-rocks'));
            for (let i = 0; i < 260; i++) { const k = Math.floor(rng(i + 3)() * stream.length), [x, z] = stream[k], a = i * 2.39, dd = 3 + (i % 9) * 2.2; const px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd; if (distPolyline(px, pz, br.pts).d < 3) continue; ctx.trees.push({ x: px, z: pz, kind: i % 3 ? 'con' : 'broad', s: 1.1 + (i % 5) * 0.15 }); }
        }
        ctx.skipWays.add(br.id || '');
        for (const id of ['r19675678', 'r19659543', 'w32121769', 'r6758706', 'w453135458']) ctx.skipBuildings.add(id); // modelled below (visitor centre, Yao gate, Tateuchi pavilion, Shorts House, Sharp Cabin)
        for (const id of ['w453135450', 'w133513232', 'w480055239']) ctx.skipAreas.add(id);
        ctx.terrainOpts = { bg: '#4f6a34', innerPx: 2048 };
        ctx.treeLod = { cap: Infinity, near: 100, max: 520, force: true }; // ~2 000 forest trees: full crowns near the walker only (the scene drew 1.07 M triangles)
        // Wilburton Hill Park sports ground (OSM pitch w32025468 soccer / artificial turf, track w403375045, basketball
        // w1332124896, bleachers): open ground, no forest on it
        const sports = d.areas.filter((a) => a.leisure === 'pitch' || a.leisure === 'track' || a.leisure === 'bleachers');
        for (const a of sports) ctx.exclude.push(a.poly);
        parkPavilions(ctx); // the shelter by Shorts House (w1433659397): an open roof, not a shop block
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.7, density: 1 / 45 }, streetTreeOpts: { spacing: 12, prob: 0.6 } });
        { const trk = area('w403375045'), sp1 = area('w32025468'), bk = area('w1332124896'), sq = new GeoBatch();
            if (trk) ctx.painter.line([...trk, trk[0]], 3, '#7c7d80', 'asphalt');                               // paved running loop round the field
            if (sp1) { ctx.painter.poly(sp1, '#4e7a3c', 'grass'); pitchMarkings(ctx, sp1, 'soccer'); }
            if (bk) { ctx.painter.poly(bk, '#6f747a', 'asphalt'); pitchMarkings(ctx, bk, 'basketball'); }
            for (const a of sports) if (a.leisure === 'bleachers') { const bb = polyBox(a.poly), y = g.heightAt((bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2), dz = (bb.z1 - bb.z0) / 3; for (let i = 0; i < 3; i++) sq.box((bb.x0 + bb.x1) / 2, y, bb.z0 + dz * (i + 0.5), bb.x1 - bb.x0, 0.45 + (2 - i) * 0.4, dz, '#b9bdc0', 'metal'); ctx.poly(a.poly, { h: 1.3 }); } // aluminium bleachers, rising away from the field
            // floodlight masts (live OSM man_made=mast nodes n13182416639…652, 2026-11-12; 18 m is an estimate)
            if (sp1) for (const [x, z] of [[270.2, 119.9], [218.4, 120.9], [218.4, 44.3], [244.1, 40.1], [269.7, 44.0], [244.4, 123.3]]) { const y = g.heightAt(x, z); sq.cyl(x, y, z, 0.16, 18, '#9a9fa3', 'steel', 8, 0.5); sq.box(x, y + 17.6, z, 2.2, 0.9, 0.25, '#c9cdd0', 'steel', z < 80 ? 0 : Math.PI); ctx.circle(x, z, 0.25, 18); }
            ctx.add(sq.build('wilburton-sports')); }
        const r = rng(33), b = new GeoBatch();
        // ponds (OSM) on the shared water material
        // (2026-11-12 render review) the mapped Basalt Bench n4730801813 (an artwork seat, v3 2025) lies 1.8 m inside the west
        // tip of pond w480055239 (v1 2017, a 12-node outline of a ~100 m pond drawn under the forest canopy: the aerial shows
        // only crowns there), so it stood under water. The coarse pond tip is the wrong side: the water stops
        // SHORE_CLEAR_M short of the bench (cut square to the line bench → pond centre); the bench keeps its mapped point.
        const SHORE_CLEAR_M = 1.8, shorePts = ['Basalt Bench'].map((n) => (d.pois || []).find((q) => q.name === n)).filter(Boolean);
        const clipShore = (p) => { for (const s of shorePts) { if (!inPoly(s.x, s.z, p)) continue; const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cz = p.reduce((a, q) => a + q[1], 0) / p.length, L = Math.hypot(cx - s.x, cz - s.z) || 1, ux = (cx - s.x) / L, uz = (cz - s.z) / L, f = (q) => (q[0] - s.x) * ux + (q[1] - s.z) * uz - SHORE_CLEAR_M, out = [];
            for (let i = 0; i < p.length; i++) { const a = p[i], q = p[(i + 1) % p.length], fa = f(a), fq = f(q); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fq >= 0)) { const t = fa / (fa - fq); out.push([a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t]); } }
            if (out.length >= 3) p = out; } return p; };
        for (const id of ['w453135450', 'w133513232', 'w480055239']) { let p = area(id); if (!p) continue; p = clipShore(p); const y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.25; g.mod((x, z, h) => (inPoly(x, z, p) ? Math.min(h, y - 0.6) : h)); waterPoly(ctx, p, y, { deep: '#26382c', shallow: '#4a5a3c', cell: 1.2, name: 'pond-' + id }); ctx.poly(p, { h: 0.5, intended: true }); }
        // forest (Douglas fir, western red cedar, bigleaf maple) outside the garden rooms
        const rooms = d.areas.filter((a) => a.leisure === 'garden' || a.landuse === 'flowerbed' || a.landuse === 'grass' || a.natural === 'water' || a.landuse === 'meadow' || a.leisure === 'pitch' || a.leisure === 'track' || a.leisure === 'bleachers' || a.leisure === 'playground' || a.amenity === 'parking').map((a) => ({ p: a.poly, b: polyBox(a.poly) }));
        const inRoom = (x, z) => rooms.some((q) => x > q.b.x0 && x < q.b.x1 && z > q.b.z0 && z < q.b.z1 && inPoly(x, z, q.p));
        for (let i = 0; i < 1800; i++) { const x = -190 + r() * 420, z = -200 + r() * 500; if (inRoom(x, z)) continue; if (d.ways.some((w) => w.k !== 'service' && w.pts.length > 1 && distPolyline(x, z, w.pts).d < 3)) continue; if (d.buildings.some((q) => inPoly(x, z, q.poly))) continue; ctx.trees.push({ x, z, kind: r() < 0.62 ? 'con' : r() < 0.6 ? 'broad' : 'shrub', s: r() < 0.62 ? 1.1 + r() * 0.7 : 0.6 + r() * 0.6 }); }
        // flower colour in every named bed (Perennial Border densest) + shrubs
        // (round 3) the Perennial Border itself (OSM r19655849 leisure=garden, garden:style=flower_garden) holds no mapped
        // flowerbed children, so it rendered as bare lawn — the "Perennial" density below was never used. Its ring is two
        // outer ways that share both ends; the extract appended the second one unreversed (a bow-tie outline). Rejoined here
        // (second way reversed) and painted with the beds.
        const rejoin = (p) => { const k = p.findIndex((q, i) => i > 2 && Math.hypot(q[0] - p[0][0], q[1] - p[0][1]) < 0.05); return k > 2 ? [...p.slice(0, k), ...p.slice(k).reverse()] : p; };
        const beds = d.areas.filter((a) => a.landuse === 'flowerbed' && !/Ground Cover|Woodland|Native/.test(a.name || ''));
        { const pbA = d.areas.find((a) => a.id === 'r19655849'), ring = pbA && rejoin(pbA.poly);
            if (ring) { const B = polyBox(ring), rb = rng(19655849), walks = d.ways.filter((w) => ['footway', 'path'].includes(w.k) && w.pts.length > 1), onWalk = (x, z) => walks.some((w) => distPolyline(x, z, w.pts).d < 1.6);
                const cols = ['#b55077', '#d9b24a', '#8a5aa6', '#d47a45', '#e8e4d6', '#c2463a'], dots = [];
                for (let i = 0; i < 9000 && dots.length < 3200; i++) { const x = B.x0 + rb() * (B.x1 - B.x0), z = B.z0 + rb() * (B.z1 - B.z0); if (inPoly(x, z, ring) && !onWalk(x, z)) dots.push([x, z, cols[Math.floor(Math.abs(Math.sin(Math.floor(x / 2.5) * 12.9898 + Math.floor(z / 2.5) * 78.233) * 43758.5453) % 1 * cols.length)]]); }
                ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; x.globalAlpha = 0.75; for (const [px, pz, c] of dots) { const [cx, cy] = T(px, pz); x.fillStyle = c; x.beginPath(); x.arc(cx, cy, Math.max(1, 0.5 * k), 0, 7); x.fill(); } x.globalAlpha = 1; });
                // perennial clumps you can see from the paths (low coloured shrubs); bed layout inside the border is not mapped
                for (let i = 0, n = 0; i < 2000 && n < 150; i++) { const x = B.x0 + rb() * (B.x1 - B.x0), z = B.z0 + rb() * (B.z1 - B.z0); if (!inPoly(x, z, ring) || onWalk(x, z)) continue; n++; ctx.trees.push({ x, z, kind: 'shrub', s: 0.3 + rb() * 0.3, c: ['#5d7340', '#4f6a38', '#7a5a6a', '#6b6a3a', '#46603a', '#806a4a'][n % 6] }); } } }
        const cols = ['#b55077', '#d9b24a', '#8a5aa6', '#d47a45', '#e8e4d6', '#5e7d3a', '#4f6e35'], hashC = (x, z) => { const v = Math.sin(Math.floor(x / 3) * 12.9898 + Math.floor(z / 3) * 78.233) * 43758.5453; return v - Math.floor(v); }; // colour in 3 m clumps
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const a of beds) { const B = polyBox(a.poly), A = Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)), n = Math.min(900, A * (/Perennial/.test(a.name || '') ? 0.8 : 0.35)); for (let i = 0; i < n; i++) { const px = B.x0 + r() * (B.x1 - B.x0), pz = B.z0 + r() * (B.z1 - B.z0); if (!inPoly(px, pz, a.poly)) continue; const [cx, cy] = T(px, pz); const c = cols[Math.floor(hashC(px, pz) * cols.length)]; x.fillStyle = c; x.globalAlpha = 0.7; x.beginPath(); x.arc(cx, cy, Math.max(1, 0.45 * k), 0, 7); x.fill(); x.globalAlpha = 1; } } });
        for (const a of beds) { const B = polyBox(a.poly); for (let i = 0; i < Math.min(16, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 60); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) ctx.trees.push({ x, z, kind: 'shrub', s: 0.4 + r() * 0.35, c: ['#4f6a38', '#5d7340', '#6b5a3a', '#46603a', '#7a6640'][i % 5] }); } }
        // Yao Garden (sister city Yao, Japan): gate, lanterns, maples, raked gravel
        const ygp = area('w32121704'), yg = ygp ? cen(ygp) : { x: 104, z: 18 };
        // (an 18 m ellipse of raked gravel was painted here: no source for one — OSM describes the Yao Garden as a gate, a
        // basalt streambed, boulders, stone lanterns, maples, azaleas and rhododendrons. Removed.)
        const lanterns = [];
        // the stone lanterns stand where OSM maps them (Kasuga n13176039734, Miyoshi n13176039735, Stone Lantern n13179881929)
        const lpos = (d.pois || []).filter((p) => p.tourism === 'artwork' && /Lantern/.test(p.name || '')).map((p) => [p.x - yg.x, p.z - yg.z]);
        { const wb2 = (d.pois || []).find((p) => p.name === 'Kyoto Stone Water Basin'); if (wb2) { const y = g.heightAt(wb2.x, wb2.z); b.cyl(wb2.x, y, wb2.z, 0.38, 0.42, '#7f7b72', 'stone', 10, 1.15); b.cyl(wb2.x, y + 0.4, wb2.z, 0.3, 0.03, '#2c3a36', 'darkglass', 10); ctx.circle(wb2.x, wb2.z, 0.45, 0.5); } } // tsukubai (n13176039736)
        for (const [dx, dz] of (lpos.length ? lpos : [[-10, -6], [8, 10], [-4, 14], [-18, 2]])) { const x = yg.x + dx, z = yg.z + dz, y = g.heightAt(x, z); b.cyl(x, y, z, 0.25, 0.9, '#8a867c', 'stone', 6); b.box(x, y + 0.9, z, 0.7, 0.45, 0.7, '#8a867c', 'stone'); b.cyl(x, y + 1.35, z, 0.55, 0.3, '#7a766c', 'stone', 4, 0.2); ctx.circle(x, z, 0.4, 1.6); lanterns.push([x, y + 1.1, z]); }
        for (let i = 0; i < 9; i++) ctx.trees.push({ x: yg.x + (r() - 0.5) * 30, z: yg.z + (r() - 0.5) * 22, kind: 'broad', s: 0.5 + r() * 0.2, c: ['#b8302a', '#c94a1f', '#8e2a2a'][i % 3] });
        const gate = bld('r19659543'); if (gate) { const c = cen(gate), y = g.heightAt(c.x, c.z), yaw = Math.atan2(gate[1][0] - gate[0][0], gate[1][1] - gate[0][1]); for (const s2 of [-1, 1]) { const px = c.x + Math.cos(yaw) * 1.4 * s2, pz = c.z - Math.sin(yaw) * 1.4 * s2; b.cyl(px, y, pz, 0.14, 2.6, '#5b3a26', 'wood', 8); ctx.circle(px, pz, 0.2, 2.6); } b.box(c.x, y + 2.3, c.z, 3.6, 0.18, 0.3, '#4a2f1f', 'wood', yaw + Math.PI / 2); gableRoof(b, c.x, y + 2.6, c.z, yaw + Math.PI / 2, 4.2, 1.6, 0.7, '#3d3a36', { over: 0.25 }); }
        // Tateuchi Viewing Pavilion (cedar, shingled hip roof) over the pond
        const tv = bld('w32121769'); if (tv) { const c = cen(tv), y = g.heightAt(c.x, c.z); for (const [dx, dz] of [[-2.2, -2.6], [2.2, -2.6], [-2.2, 2.6], [2.2, 2.6]]) { b.cyl(c.x + dx, y, c.z + dz, 0.12, 2.5, '#6b4a30', 'wood', 8); ctx.circle(c.x + dx, c.z + dz, 0.15, 2.5); } b.box(c.x, y, c.z, 5, 0.2, 6, '#7a5a3c', 'wood'); gableRoof(b, c.x, y + 2.5, c.z, 0.1, 6.4, 5, 1.6, '#5a4a3a', { over: 0.6 }); }
        // Shorts Visitor Center / Aaron Education Center (Olson Kundig, opened June 2014: bellevuebotanical.org/history). OSM
        // r19675678 has two inner rings, open courtyards (w1435225256 a planted bed GC03, w1435225279): they are left open
        // (live OSM 2026-11-13; the spot extract keeps outer rings only, so the inner rings are listed here in scene metres).
        // Commons "Bellevue Botanical Garden 04 - Aaron Education Center" (CC BY-SA, the garden side): one storey of pale
        // timber panels between white posts, white multi-pane glazed doors, a thin grey metal roof edge with a deep overhang
        // (it was dark brown wood with dark glass). Wall 4.2 m, overhang 0.9 m and bay pitch are estimates; the planted roof
        // is the research dossier's "green roof elements" and stays behind the grey edge.
        const vcp = bld('r19675678'), VC_HOLES = [[[37, -63.9], [37.1, -57.9], [44.2, -58], [44.1, -64]], [[36, -86.3], [36, -83.6], [36, -81.5], [36.1, -79.3], [45.6, -79.4], [45.6, -81.7], [45.6, -83.7], [45.5, -86.5], [44.8, -86.5]]];
        if (vcp) { const yb = Math.min(...vcp.map(([x, z]) => g.heightAt(x, z))); g.flatten(vcp, yb, 4); const WH = 4.2;
            ringPrism(b, vcp, VC_HOLES, yb - 0.5, yb + WH, '#c7b18c', 'wood'); ringPrism(b, vcp, VC_HOLES, yb + WH, yb + WH + 0.35, '#5d7a3c', 'plant');
            for (const ring of [vcp, ...VC_HOLES]) { const inner = ring !== vcp;
                for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [qx, qz] = ring[(i + 1) % ring.length], L = Math.hypot(qx - ax, qz - az); if (L < 2) continue; const ya = Math.atan2(qx - ax, qz - az), ux = (qx - ax) / L, uz = (qz - az) / L;
                    let nx = uz, nz = -ux; { const mx = (ax + qx) / 2, mz = (az + qz) / 2; const outside = inner ? inPoly(mx + nx * 0.3, mz + nz * 0.3, ring) : !inPoly(mx + nx * 0.3, mz + nz * 0.3, vcp); if (!outside) { nx = -nx; nz = -nz; } } // facing out of the building (into a courtyard for inner rings)
                    const eave = i % 2 ? 0.03 : 0; // grey roof edge strip per side, alternate sides 3 cm apart (no coplanar corner laps)
                    b.box((ax + qx) / 2 + nx * 0.45, yb + WH + 0.3 + eave, (az + qz) / 2 + nz * 0.45, 0.9, 0.12, L + (inner ? -0.2 : 0.9), '#8e9294', 'metal', ya);
                    if (L < 5) continue;
                    for (let t = 2.2; t < L - 2; t += 4.4) { const px = ax + ux * t + nx * 0.05, pz = az + uz * t + nz * 0.05;
                        if (((t / 4.4) | 0) % 3 === 2) { b.box(px, yb + 0.1, pz, 1.2, 3.3, 0.06, '#efefea', 'paint', ya + Math.PI / 2); continue; } // white solid panel between doors
                        b.box(px, yb + 0.05, pz, 2.5, 3.1, 0.07, '#f2f2ee', 'paint', ya + Math.PI / 2);                                         // white door frame
                        b.box(px + nx * 0.06, yb + 0.15, pz + nz * 0.06, 2.3, 2.9, 0.07, '#3c4448', 'darkglass', ya + Math.PI / 2);          // glazing
                        for (const hy of [0.85, 1.6, 2.35]) b.box(px + nx * 0.12, yb + hy, pz + nz * 0.12, 2.3, 0.05, 0.04, '#f2f2ee', 'paint', ya + Math.PI / 2); // sectional-door mullions
                    } } }
            ctx.poly(vcp, { holes: VC_HOLES }); } // (a 30 m lit slab, 'vc-glow', stood free in the garden west of the building — at the bounding box's x0, not on a wall: removed)
        // ---- Shorts House (OSM r6758706 building=retail, the garden shop): the Shorts' 1957 "contemporary home" by Paul Kirk
        // (bellevuebotanical.org/history). Its inner ring (w184864667) is the open atrium (garden-art list: Sheepish Rabbit,
        // "Shorts House Atrium (Bed SH06)"); the garden's photo of the rabbit shows a pale grey wall base with light timber
        // above in the atrium. One storey with a low flat roof and a deep eave: estimates (no level / height / roof tag).
        const shp = bld('r6758706'), SH_HOLE = [[-23.3, -46.2], [-23.3, -42.4], [-20.4, -42.4], [-20.4, -46.2]];
        if (shp) { const yb = Math.min(...shp.map(([x, z]) => g.heightAt(x, z))), yt = Math.max(...shp.map(([x, z]) => g.heightAt(x, z)));
            ringPrism(b, shp, [SH_HOLE], yb - 0.6, yt + 0.9, '#b9b8b2', 'concrete'); ringPrism(b, shp, [SH_HOLE], yt + 0.9, yt + 3.3, '#b8946a', 'wood'); ringPrism(b, shp, [SH_HOLE], yt + 3.3, yt + 3.62, '#55585a', 'roofs');
            for (const ring of [shp, SH_HOLE]) for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [qx, qz] = ring[(i + 1) % ring.length], L = Math.hypot(qx - ax, qz - az); if (L < 3) continue; const ux = (qx - ax) / L, uz = (qz - az) / L, ya = Math.atan2(ux, uz);
                let nx = uz, nz = -ux; { const mx = (ax + qx) / 2, mz = (az + qz) / 2, tx = mx + nx * 0.3, tz = mz + nz * 0.3, facesOut = ring === shp ? !inPoly(tx, tz, shp) : inPoly(tx, tz, ring); if (!facesOut) { nx = -nx; nz = -nz; } } // out of the house, or into the atrium
                for (let t = 1.6; t < L - 1.2; t += 3.6) { const px = ax + ux * t + nx * 0.05, pz = az + uz * t + nz * 0.05; b.box(px, yt + 0.95, pz, 2.2, 1.9, 0.07, '#33393c', 'darkglass', ya + Math.PI / 2); } }
            ctx.poly(shp, { holes: [SH_HOLE] }); }
        // ---- Sharp Cabin (OSM w453135458, building=yes; Commons "Bellevue, WA (2023) - 12" from its north-west, the photo
        // the OSM `image` tag names): a one-storey cottage of khaki lap siding with taupe trim, a steep grey shingle roof with
        // a cross gable, and a recessed porch with a white rail and fretwork brackets in the north gable end, red door.
        // Ridge north–south from the photo; wall 2.9 m, roof rise and porch size are estimates.
        const scp = bld('w453135458');
        if (scp && scp.length >= 5) { const NW = scp[0], NE = scp[1], SE = scp[scp.length - 2], SW = scp[scp.length - 1], cxs = (NW[0] + NE[0] + SE[0] + SW[0]) / 4, czs = (NW[1] + NE[1] + SE[1] + SW[1]) / 4, y = Math.min(...scp.map(([x, z]) => g.heightAt(x, z)));
            const yaw = Math.atan2(NW[0] - SW[0], NW[1] - SW[1]), Lc = Math.hypot(NW[0] - SW[0], NW[1] - SW[1]), Wc = Math.hypot(NE[0] - NW[0], NE[1] - NW[1]), WH = 2.9;
            b.prism(scp, y - 0.5, y + WH, '#b8aa8c', 'wood');
            const s = Math.sin(yaw), c = Math.cos(yaw), Pt = (lu, lv) => [cxs + s * lu - c * lv, czs + c * lu + s * lv]; // lu along the ridge (north = +Lc/2), lv across (east = +)
            // Closed cross-gabled roof (round 3 review: the shared gableRoof kept its eaves at wall-top height, so its gable
            // triangles stopped 0.2 m under the slopes, the one-sided slopes vanished from below and the cross gable's triangle
            // stood out past the main eave). Here every slope passes through the wall-top line and the ridge, the eaves drop
            // below the wall top by the overhang, the gable triangles lie in the slopes' planes and both faces are drawn.
            { const V = (lu, lv, h) => { const [x, z] = Pt(lu, lv); return [x, y + WH + h, z]; }, RC = '#4f514f', GC = '#b8aa8c';
              const q2 = (a, bq, cq, dq, col, key) => { b.quad(a, bq, cq, dq, col, key); b.quad(dq, cq, bq, a, col, key); }, t2 = (a, bq, cq, col, key) => { tri(b, a, bq, cq, col, key); tri(b, cq, bq, a, col, key); };
              const gw = Wc / 2, gl = Lc / 2, ov = 0.35, w = gw + ov, l = gl + ov, H = 2.7, ye = -H * ov / gw;
              const cu = -0.6, hw = Lc * 0.225, Hc = 2.2, ovc = 0.25, yc = -Hc * ovc / hw, v0 = 0.5; // the cross gable to the east (position and rise estimated)
              // east slope: its eave stops at the cross gable (which carries its own), the west slope runs through
              q2(V(-l, w, ye), V(cu - hw, w, ye), V(cu - hw, 0, H), V(-l, 0, H), RC, 'stone'); q2(V(cu + hw, w, ye), V(l, w, ye), V(l, 0, H), V(cu + hw, 0, H), RC, 'stone');
              q2(V(cu - hw, gw, 0), V(cu + hw, gw, 0), V(cu + hw, 0, H), V(cu - hw, 0, H), RC, 'stone');
              q2(V(l, -w, ye), V(-l, -w, ye), V(-l, 0, H), V(l, 0, H), RC, 'stone');
              for (const e of [gl, -gl]) t2(V(e, -gw, 0), V(e, gw, 0), V(e, 0, H), GC, 'paint');
              q2(V(cu + hw + ovc, v0, yc), V(cu + hw + ovc, w, yc), V(cu, w, Hc), V(cu, v0, Hc), RC, 'stone'); q2(V(cu - hw - ovc, w, yc), V(cu - hw - ovc, v0, yc), V(cu, v0, Hc), V(cu, w, Hc), RC, 'stone');
              t2(V(cu - hw, gw, 0), V(cu + hw, gw, 0), V(cu, gw, Hc), GC, 'paint'); }
            { const [px, pz] = Pt(Lc / 2 + 0.06, -Wc * 0.22), [dx, dz] = Pt(Lc / 2 + 0.1, -Wc * 0.3); // porch recess (dark) with rail + posts, the red door inside it
                b.box(px, y + 0.05, pz, Wc * 0.42, 2.45, 0.06, '#6b6458', 'wood', yaw); for (const lv of [-Wc * 0.42, -Wc * 0.02]) { const [qx, qz] = Pt(Lc / 2 + 0.16, lv); b.box(qx, y, qz, 0.14, 2.5, 0.14, '#e9e6dc', 'paint', yaw); }
                { const [rx, rz] = Pt(Lc / 2 + 0.16, -Wc * 0.12); b.box(rx, y + 0.86, rz, Wc * 0.2, 0.07, 0.07, '#e9e6dc', 'paint', yaw); for (let k = -2; k <= 2; k++) { const [bx2, bz2] = Pt(Lc / 2 + 0.16, -Wc * 0.12 + k * Wc * 0.036); b.box(bx2, y + 0.1, bz2, 0.04, 0.76, 0.04, '#e9e6dc', 'paint', yaw); } }
                b.box(dx, y + 0.1, dz, 0.95, 2.1, 0.06, '#9b3b2e', 'paint', yaw); }
            for (const lu of [-Lc * 0.15, Lc * 0.2]) { const [wx, wz] = Pt(lu, -Wc / 2 - 0.11), [fx, fz] = Pt(lu, -Wc / 2 - 0.02); b.box(wx, y + 1.0, wz, 0.06, 1.3, 1.1, '#2f3538', 'darkglass', yaw); b.box(fx, y + 0.94, fz, 0.1, 1.42, 1.24, '#8a7a6a', 'paint', yaw); } // glass 4 cm proud of its frame (no coplanar faces)
            ctx.poly(scp); }
        ctx.add(b.build('garden-structures'));
        const vc = vcp ? { x: polyBox(vcp).x0 - 6, z: polyBox(vcp).z1 + 6 } : (sp.structures.find((s) => s.id === 'visitor-center') || { x: 5, z: -8 });
        // The garden's name sign stands at the Main St entrance, on the east side of the drive (Street View, official
        // panorama on Main St, 2026-11-12): a teal panel between two posts in a mulched bed, facing the street. (A 5.6 m
        // board stood inside the garden by Shorts House: no source for one there.) Size estimated; the name is OSM's.
        { const sx = 68.4, sz = -125.1, sy = g.heightAt(sx, sz), th = Math.PI - 300 * Math.PI / 180, es = new GeoBatch();
            for (const s of [-1.3, 1.3]) es.box(sx + Math.cos(th) * s, sy, sz - Math.sin(th) * s, 0.22, 1.7, 0.22, '#7d8a80', 'wood', th);
            es.box(sx, sy + 0.55, sz, 2.4, 1.05, 0.12, '#2e6f73', 'paint', th); ctx.add(es.build('garden-entrance-sign'));
            const t1 = glowText('Bellevue Botanical Garden', 2.2, 0.36, { fg: '#f3f1e8', bg: '#2e6f73', font: (q) => `600 ${q}px Georgia, serif`, night: 0.5 }); t1.position.set(sx + Math.sin(th) * 0.07, sy + 1.15, sz + Math.cos(th) * 0.07); t1.rotation.y = th; ctx.add(t1);
            ctx.box(sx, sz, 1.4, 0.2, th, { prop: true, h: 1.7 }); ctx.trees = ctx.trees.filter((t) => Math.hypot(t.x - sx, t.z - sz) > 4 && !(t.x > 58 && t.x < sx && Math.abs(t.z - sz) < 5)); } // nothing generated stands between the sign and the drive
        // ---- artworks at their mapped points (live OSM 2026-11-12). Form from the tags, or (round 3, 2026-11-13) from the
        // photo of each piece on the garden's art page — the `source` the OSM nodes cite (bellevuebotanical.org/garden-art) —
        // or the Commons photo an OSM `image` tag names. Sizes without a tag are estimates read against the photos.
        { const ab = new GeoBatch(), ra = rng(4499), P = (n) => (d.pois || []).find((p) => p.name === n), PR = (re) => (d.pois || []).find((p) => re.test(p.name || ''));
            const BRZ = ['#6b5232', '#5e4a30', '#77603e'], VERD = '#7e8f86';
            const sr = P('Sheepish Rabbit'); // n13176504611 material=bronze (Georgia Gerber): a hunched, rounded bronze rabbit, head bowed, on a grey stone drum
            if (sr) { const y = g.heightAt(sr.x, sr.z); ab.cyl(sr.x, y, sr.z, 0.3, 0.62, '#8c8b86', 'stone', 14); ab.sphere(sr.x, y + 0.86, sr.z - 0.03, 0.2, 0.25, 0.27, BRZ[0], 'metal', 12, 8); ab.sphere(sr.x, y + 0.78, sr.z + 0.2, 0.11, 0.12, 0.12, BRZ[2], 'metal', 10, 6);
                for (const s of [-1, 1]) ab.rod([sr.x + s * 0.05, y + 0.84, sr.z + 0.2], [sr.x + s * 0.09, y + 0.98, sr.z + 0.12], 0.035, BRZ[1], 'metal', 5, 0.015); ctx.circle(sr.x, sr.z, 0.32, 1.1); }
            const tc = P('Three Cranes'); // n13176504596 material=metal, gift from sister city Yao (1996): three verdigris cranes on thin legs, one stooping
            if (tc) { const y = g.heightAt(tc.x, tc.z); [[-0.7, -0.3, 1.55, 0.2, false], [0.5, -0.5, 1.45, 2.3, false], [0.1, 0.6, 1.05, 4.2, true]].forEach(([ox, oz, h, a, stoop]) => { const x = tc.x + ox, z = tc.z + oz, fx = Math.sin(a), fz = Math.cos(a);
                for (const s of [-0.08, 0.08]) ab.rod([x + fz * s, y, z - fx * s], [x, y + h * 0.5, z], 0.012, VERD, 'metal', 4);
                ab.sphere(x, y + h * 0.55, z, 0.13, 0.12, 0.3, VERD, 'metal', 8, 6); ab.add(new THREE.ConeGeometry(0.12, 0.35, 6).rotateX(-Math.PI / 2), 'metal', M(x - fx * 0.32, y + h * 0.58, z - fz * 0.32, 0, a, 0), '#6f7f77');
                const nh = stoop ? [x + fx * 0.45, y + h * 0.42, z + fz * 0.45] : [x + fx * 0.12, y + h, z + fz * 0.12]; ab.rod([x + fx * 0.22, y + h * 0.6, z + fz * 0.22], nh, 0.022, VERD, 'metal', 5); ab.rod(nh, [nh[0] + fx * 0.18, nh[1] - (stoop ? 0.08 : 0.01), nh[2] + fz * 0.18], 0.012, '#5c6a63', 'metal', 4);
                ctx.circle(x, z, 0.28, h); });
              ctx.circle(tc.x, tc.z, 1.6, 1.6, { crowdOnly: true, intended: true }); } // (round 3 review: people stood among the three cranes) a crowd blocker over the group
            const sd = P("Sophia's Dream"); // n13176504597 material=stone (Tom Small): a long low dark stone, carved into flowing lobes on top
            if (sd) { const y = g.heightAt(sd.x, sd.z); ab.sphere(sd.x, y + 0.18, sd.z, 1.05, 0.34, 0.36, '#3e4143', 'stone', 14, 8); ab.sphere(sd.x + 0.35, y + 0.36, sd.z, 0.55, 0.16, 0.3, '#4a4d4f', 'stone', 12, 6); ctx.box(sd.x, sd.z, 1.0, 0.33, 0, { prop: true, h: 0.5 }); }
            const ns = P('The Nature of Sitting'); // n13176504599 (Pam Beyette): a cut-out brushed-aluminium leaf with veins standing on a rough granite block
            if (ns) { const y = g.heightAt(ns.x, ns.z); ab.box(ns.x, y - 0.1, ns.z, 0.85, 0.45, 0.4, '#9a9893', 'stone'); const lf = new THREE.Shape(); lf.moveTo(-0.17, 0); lf.lineTo(-0.3, 0.35); lf.quadraticCurveTo(-0.34, 0.85, 0, 1.25); lf.quadraticCurveTo(0.34, 0.85, 0.3, 0.35); lf.lineTo(0.17, 0); lf.closePath();
                const lg = new THREE.ExtrudeGeometry(lf, { depth: 0.02, bevelEnabled: false }); ab.add(lg, 'metal', M(ns.x, y + 0.35, ns.z - 0.01, 0, 0.5, 0), '#c9ccce'); lg.dispose(); ctx.box(ns.x, ns.z, 0.45, 0.22, 0, { prop: true, h: 1.6 }); }
            const lgx = P('Large Galaxy'); // n13101151754 (Andrew Carson, 2018, kinetic; Commons "Bellevue, WA (2023) - 02"): a tall S-curved brushed steel stem carrying a cluster of coloured spinning pieces
            if (lgx) { const y = g.heightAt(lgx.x, lgx.z), stem = [[0, 0, 0], [0.25, 1.3, 0.05], [-0.15, 2.7, 0], [0.2, 4.0, -0.05], [0, 5.0, 0]].map(([dx, dy, dz]) => [lgx.x + dx, y + dy, lgx.z + dz]);
                ab.tube(stem, 0.09, '#b9bec2', 'chrome', 6); for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.25 + (i % 3) * 0.18; ab.sphere(lgx.x + Math.cos(a) * rr, y + 5.05 + (i % 4) * 0.18, lgx.z + Math.sin(a) * rr, 0.14, 0.14, 0.05, ['#2aa6b8', '#e2462e', '#f1c232', '#3b6fd1', '#59b56a'][i % 5], 'plastic', 8, 6); } ctx.circle(lgx.x, lgx.z, 0.15, 5); }
            const gw = P('Goldiwarts'); // n5840671532 material=metal (Lon Brusselback, 2000): a large warty bronze toad squatting beside a bronze leaf
            if (gw) { const y = g.heightAt(gw.x, gw.z); ab.sphere(gw.x, y + 0.3, gw.z, 0.42, 0.32, 0.4, BRZ[1], 'metal', 12, 8); ab.sphere(gw.x, y + 0.6, gw.z + 0.14, 0.27, 0.17, 0.24, BRZ[0], 'metal', 10, 6);
                for (const s of [-1, 1]) { ab.sphere(gw.x + s * 0.14, y + 0.74, gw.z + 0.22, 0.06, 0.06, 0.06, '#8a6a3a', 'metal', 6, 4); ab.sphere(gw.x + s * 0.3, y + 0.08, gw.z + 0.28, 0.11, 0.06, 0.13, BRZ[2], 'metal', 6, 4); }
                ab.add(new THREE.ConeGeometry(0.22, 0.55, 5, 1, true), 'metal', M(gw.x + 0.55, y + 0.27, gw.z + 0.05, 0, 0, -0.35), BRZ[2]); ctx.circle(gw.x, gw.z, 0.5, 0.8); }
            const sh = P('Shaman'); // n13176504593 (Will Robinson, 1993): a tall pointed dark monolith with carved folds
            if (sh) { const y = g.heightAt(sh.x, sh.z); ab.cyl(sh.x, y, sh.z, 0.26, 1.6, '#4c4f50', 'stone', 7, 0.85); ab.cyl(sh.x, y + 1.6, sh.z, 0.22, 0.7, '#4c4f50', 'stone', 7, 0.08); ctx.circle(sh.x, sh.z, 0.28, 2.3); }
            const ow = PR(/^Owl.s Glare$/); // n5745977627 (David Maritz, 2006): a bronze owl landing with raised wings, talons out, on a boulder
            if (ow) { const y = g.heightAt(ow.x, ow.z); ab.sphere(ow.x, y + 0.25, ow.z, 0.55, 0.4, 0.45, '#8c8a83', 'stone', 10, 7); ab.sphere(ow.x, y + 0.95, ow.z, 0.17, 0.24, 0.16, BRZ[0], 'metal', 10, 7); ab.sphere(ow.x, y + 1.22, ow.z + 0.04, 0.13, 0.11, 0.12, BRZ[2], 'metal', 8, 6);
                for (const s of [-1, 1]) ab.add(new THREE.ConeGeometry(0.2, 0.75, 4).rotateZ(s * 0.5), 'metal', M(ow.x + s * 0.22, y + 1.32, ow.z - 0.05, 0, 0, 0, 1, 1, 0.25), BRZ[1]);
                for (const s of [-0.06, 0.06]) ab.rod([ow.x + s, y + 0.78, ow.z], [ow.x + s * 2, y + 0.6, ow.z + 0.12], 0.015, '#4a3a24', 'metal', 4); ctx.circle(ow.x, ow.z, 0.55, 1.5); }
            const fc = P('Friendship Circle'); // n4499338296 "A standing stone circle sculpture" (Roger Hopkins)
            if (fc) { const y = g.heightAt(fc.x, fc.z); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, x = fc.x + Math.cos(a) * 1.9, z = fc.z + Math.sin(a) * 1.9, h = 1.3 + ra() * 0.5; ab.box(x, y - 0.2, z, 0.55 + ra() * 0.2, h + 0.2, 0.32, ['#8a877f', '#7d7a73', '#96928a'][i % 3], 'stone', -a + Math.PI / 2 + (ra() - 0.5) * 0.3); ctx.circle(x, z, 0.35, h); } }
            const nbl = P('Night Blooming'); // n5531375272 material=wood height=4.1 width=3 (Taiji Miyasaka, David Drake, 2014)
            if (nbl) { const y = g.heightAt(nbl.x, nbl.z); ab.cyl(nbl.x, y, nbl.z, 1.5, 3.2, '#3a2e26', 'wood', 12); ab.cyl(nbl.x, y + 3.2, nbl.z, 1.5, 0.9, '#33281f', 'wood', 12, 0.45); ctx.circle(nbl.x, nbl.z, 1.55, 4.1); }
            const bb = P('Basalt Bench'); // n4730801813 material=basalt, backrest=no (Barry Namm, 2006)
            if (bb) { const y = g.heightAt(bb.x, bb.z); ab.box(bb.x, y, bb.z, 1.7, 0.46, 0.5, '#3f4245', 'stone', 0.4); ctx.box(bb.x, bb.z, 0.85, 0.25, 0.4, { prop: true, h: 0.46 }); }
            const st = P('Stacked Stones'); // n13176504583 man_made=cairn material=stone (David Cox, 2005)
            if (st) { const y = g.heightAt(st.x, st.z); let yy = y; for (let i = 0; i < 6; i++) { const rr = 0.42 - i * 0.055, h = 0.26 - i * 0.02; ab.sphere(st.x + (ra() - 0.5) * 0.06, yy + h * 0.5, st.z + (ra() - 0.5) * 0.06, rr, h * 0.62, rr * 0.9, ['#807c74', '#6f6c66', '#8d8980'][i % 3], 'stone', 9, 6); yy += h * 0.92; } ctx.circle(st.x, st.z, 0.45, 1.4); }
            const ww = P('Waterwall'); // n9251586886 amenity=fountain material=slate (+ w1433659335 waterway=weir "Waterwall")
            if (ww) { const y = g.heightAt(ww.x, ww.z); ab.box(ww.x, y, ww.z, 0.35, 1.9, 3.6, '#4a4f55', 'stone'); ab.box(ww.x - 0.5, y, ww.z, 0.7, 0.3, 3.9, '#5a5f64', 'stone'); ab.box(ww.x - 0.19, y + 0.3, ww.z, 0.02, 1.58, 3.3, '#9fc0c8', 'glass'); ctx.box(ww.x - 0.2, ww.z, 0.6, 1.95, 0, { prop: true, h: 1.9 }); ctx.sound('water', ww.x, ww.z, 14, 0.5); }
            ctx.add(ab.build('garden-artworks')); }
        // ---- visitor car park (OSM amenity=parking r19655198, surface; Street View from the drop-off loop shows it in use):
        // parked cars square to the mapped aisles. Bays are not mapped: their pitch (2.75 m) and which are taken are estimates.
        { const lot = d.areas.find((a) => a.id === 'r19655198')?.poly, rp = rng(1965), cars = [];
            if (lot) { const beds = d.areas.filter((a) => a.landuse === 'flowerbed' || a.landuse === 'grass' || a.leisure === 'garden').map((a) => a.poly), aisles = d.ways.filter((w) => w.k === 'service' && w.pts.some(([x, z]) => inPoly(x, z, lot)));
                for (const w of aisles) for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [qx, qz] = w.pts[i], Le = Math.hypot(qx - ax, qz - az); if (Le < 12) continue; const ux = (qx - ax) / Le, uz = (qz - az) / Le;
                    for (const s of [-1, 1]) for (let t = 2.5; t < Le - 2; t += 2.75) { const x = ax + ux * t + uz * 5.6 * s, z = az + uz * t - ux * 5.6 * s; if (rp() > 0.5 || cars.length > 54) continue;
                        if (!inPoly(x, z, lot) || beds.some((p) => inPoly(x, z, p)) || aisles.some((v) => distPolyline(x, z, v.pts).d < 4.6) || cars.some((c) => Math.hypot(c.x - x, c.z - z) < (c.row === `${w.id}:${i}:${s}` ? 2.6 : 5.6))) continue;
                        cars.push({ x, z, row: `${w.id}:${i}:${s}`, kind: ['sedan', 'hatch', 'compact-sedan'][Math.floor(rp() * 3)], yaw: Math.atan2(uz * s, -ux * s) + (rp() < 0.5 ? Math.PI : 0) }); } }
                /* passenger cars only: the default pick includes buses, trams, police cars; of the car models only sedan / hatch / compact-sedan pass the spot audit's coplanar test (estate, crossover, ev-sedan, SUV, pickup, van each add z-fight findings) */
                if (cars.length) addTraffic(ctx, { parked: cars, merge: true, seed: 1965 }); ctx.extras.gardenParked = cars.length; } }
        // Garden d'Lights (late Nov – Dec 31): coloured lights in beds, on paths, round the ponds — night only
        { const pts = []; for (const a of beds) { const B = polyBox(a.poly); for (let i = 0; i < Math.min(260, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 4); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) pts.push([x, g.heightAt(x, z) + 0.3 + r() * 1.2, z]); } }
            for (const w of d.ways) { if (!['footway', 'path'].includes(w.k) || Math.hypot(w.pts[0][0], w.pts[0][1]) > 160) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [qx, qz] = w.pts[i], L = Math.hypot(qx - ax, qz - az); for (let t = 0; t < L; t += 1.4) pts.push([ax + (qx - ax) * t / L + 1.3, g.heightAt(ax, az) + 0.25, az + (qz - az) * t / L]); } }
            let on = false; seasonal(ctx, [11, 28], [12, 31], (v) => { on = v; });
            const half = Math.floor(pts.length / 2);
            fairyLights(ctx, pts.slice(0, half), { color: '#ff7ab8', size: 0.2, on: () => on, name: 'garden-dlights-a' }); fairyLights(ctx, pts.slice(half), { color: '#8fd3ff', size: 0.2, on: () => on, name: 'garden-dlights-b' });
            fairyLights(ctx, lanterns, { color: '#ffd38a', size: 0.5, twinkle: 0.05, name: 'yao-lanterns' }); }
        // ---------------------------------------------------------------- activities (note 57)
        // 1) cross the ravine suspension bridge (end to end)
        let crossing = null, crossed = false;
        onActivityCancel(ctx, () => { crossing = null; });
        const span = Math.hypot(bridge.B.x - bridge.A.x, bridge.B.z - bridge.A.z);
        ctx.extras.botanicalBridge = { A: bridge.A, B: bridge.B, debug: () => crossing && { ...crossing } };
        ctx.onUpdate((dt, s, p) => {
            if (crossed || !p) return;
            const A = bridge.A, B = bridge.B, t = Math.max(0, Math.min(1, ((p.x - A.x) * (B.x - A.x) + (p.z - A.z) * (B.z - A.z)) / (span * span)));
            const dA = Math.hypot(p.x - A.x, p.z - A.z), dB = Math.hypot(p.x - B.x, p.z - B.z);
            if (!s.ctl.active || activityBlocked(s) || Math.abs(p.y - bridge.yAt(t)) > .8 || distPolyline(p.x, p.z, [[A.x, A.z], [B.x, B.z]]).d > 3) { crossing = null; return; }
            if (crossing) {
                const delta = Math.hypot(p.x - crossing.previous.x, p.z - crossing.previous.z);
                if (delta > Math.max(1, dt * 6)) { crossing = null; return; }
                crossing.walked += delta; crossing.previous = { x: p.x, z: p.z };
                if ((crossing.from === 'A' ? dB : dA) < 3 && crossing.walked >= span - 6) {
                    crossed = true; crossing = null;
                    emitActivity(s, 'bel-botanical-garden', 'bridge', '🌉 Across the ravine', 'You walked the modelled suspension bridge continuously from one end to the other.');
                }
            } else if (dA < 3 || dB < 3) crossing = { from: dA < dB ? 'A' : 'B', walked: 0, previous: { x: p.x, z: p.z } };
        });
        ctx.interactables.push({ kind: 'activity', x: bridge.A.x, z: bridge.A.z, r: 3, label: 'Cross the ravine suspension bridge', use: (s) => s.ui.toast('🌉 Ravine Experience', 'Walk across to the far end — it sways a little.') });
        // 2) virtual trail notes at mapped garden rooms. Source names do not
        // establish specimen labels or physical sign hardware at these points.
        const LABELS = [['Perennial Border', 'r19655849', 'Northwest Perennial Alliance border — hardy geraniums, asters, sedums'], ['Yao Garden', 'w32121704', 'Japanese maple (Acer palmatum) — sister city Yao, Japan'], ['Fuchsia Garden', 'r19658437', 'Hardy fuchsias (Fuchsia magellanica)'], ['Rhododendron Glen', 'r19675946', 'Rhododendrons — Washington\'s state flower is the coast rhododendron'], ['Native Discovery Garden', 'r19676251', 'Sword fern (Polystichum munitum) and Oregon grape'], ['Waterwise Garden', 'r19674922', 'Drought-tolerant lavender, rockrose and grasses'], ['Rock Garden', 'r19795610', 'Alpine plants among granite boulders']];
        for (const [name, id, text] of LABELS) { const p = area(id); if (!p) continue; let best = null; for (const w of d.ways) { if (!['footway', 'path'].includes(w.k)) continue; for (const [x, z] of w.pts) if (inPoly(x + 1.2, z, p) || Math.hypot(x - cen(p).x, z - cen(p).z) < 25) { const dd = Math.hypot(x - cen(p).x, z - cen(p).z); if (!best || dd < best.d) best = { x: x + 1.2, z, d: dd }; } } const q = best || cen(p);
            ctx.interactables.push({ kind: 'plant', x: q.x, z: q.z, r: 2, source: id, label: `Virtual garden trail note: ${name}`, use: (s) => s.ui.toast(`🌿 Virtual trail: ${name}`, text) }); }
        // plaques
        const PL = sp.plaques, pbo = area('r19655849') ? cen(area('r19655849')) : { x: -70, z: -17 };
        ctx.plaque(PL[0], vc.x + 4, vc.z + 4, Math.PI); ctx.plaque(PL[1], pbo.x + 14, pbo.z - 8, 0.4); ctx.plaque(PL[2], yg.x - 20, yg.z, -Math.PI / 2); ctx.plaque(PL[3], vc.x - 3, vc.z + 4, Math.PI);
        // Postcard (round 3, r2-tooling-4): the research view of the ravine bridge stands ≈ 300 m from the entry spawn, past the
        // guided tour's 230 m reach, so the tour had no postcard stop. The postcard now frames the Perennial Border (mapped
        // garden r19655849; "described as the largest public perennial garden in America", Wikipedia via the research
        // dossier) along its length from the path at its south end; the bridge stays an activity and on the map.
        { const vx = -62, vz = 26, tx = -70, tz = -6, hb = ((Math.atan2(tx - vx, -(tz - vz)) * 180 / Math.PI) + 360) % 360; ctx.challenge('bel-botanical-garden', { view: [tx, tz], x: vx, z: vz, heading: hb, pitch: -4, r: 10, tol: 35, text: 'Down the Perennial Border, the Northwest Perennial Alliance’s long mixed border' }); }
        ctx.crowdCfg = {
            personas: { local: 5, tech: 2, kid: 1.5, photographer: 1.5, tourist_us: 1.5, tourist_cn: 1, tourist_in: 1.2, tourist_kr: 0.8, tourist_jp: 1, staff: 0.4 },
            walkers: 22, paths: ctx.footLines(),
            groups: [
                { x: pbo.x + 6, z: pbo.z + 6, r: 6, n: 6, act: 'photo', look: [pbo.x, pbo.z], personas: ['photographer', 'local', 'tourist_jp'] },
                { x: yg.x - 12, z: yg.z - 6, r: 3, n: 4, act: 'watch', look: [yg.x, yg.z], personas: ['tourist_jp', 'local', 'tourist_cn'] },
                { x: bridge.A.x - 3, z: bridge.A.z - 2, r: 2, n: 3, act: 'watch', look: [bridge.B.x, bridge.B.z], personas: ['kid', 'local'] },
                { x: vc.x, z: vc.z + 6, r: 2, n: 3, act: 'talk', personas: ['staff', 'local'] },
            ],
        };
        ctx.sound('birds', 0, 120, 300, 1.4); ctx.sound('wind', 150, 240, 140, 0.8); ctx.sound('water', yg.x, yg.z + 20, 30, 0.5);
        // no tree may stand in a mapped pond (a scattered fir stood in the Yao koi pond)
        { const ponds = ['w453135450', 'w133513232', 'w480055239'].map(area).filter(Boolean); for (let i = ctx.trees.length - 1; i >= 0; i--) if (ponds.some((p) => inPoly(ctx.trees[i].x, ctx.trees[i].z, p))) ctx.trees.splice(i, 1); }
        ctx.spawns['bel-botanical-garden'] = { x: sp.spawn.x, z: sp.spawn.z + 3, heading: headingFromBearing(sp.spawn.heading_deg) };
        void M; void glowText;
    },
};
