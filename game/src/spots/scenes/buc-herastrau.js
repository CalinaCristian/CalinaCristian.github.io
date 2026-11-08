// ============================================================================
//  Herăstrău (Bucharest): King Michael I Park — the alley of busts, the
//  Sleeping Nymph and the south tip of Lake Herăstrău, the Japanese garden
//  (spot `herastrau-park`) — and the Dimitrie Gusti National Village Museum
//  next door (spot `village-museum`): real peasant households from every
//  region (whitewashed walls and porches in the south, log walls and steep
//  shingle roofs in the north), wattle fences, wells with sweeps, wayside
//  crosses and the 1722 wooden church from Dragomirești (Maramureș) with its
//  needle spire. Water level and shore from OSM (lake multipolygon with its
//  islands). All modelled from descriptions; sculptors credited on plaques.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, obb, polyArea, offsetPolyline, distPolyline, prismGeometry } from '../kit.js';
import { bucBackdrop, osmPoly, cityFiller, palisade, signAtlas, bucActivity, boatRide } from '../buc.js';
import { railing } from '../props.js';
import { addBikeRental } from '../bike.js';

function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const NORTH = /Maramureș|Maramures|Bistrița|Hunedoara|Harghita|Suceava|Neamț|Neamt|Alba|Cluj|Sălaj|Mureș|Brașov|Sibiu|Covasna|Bihor|Satu Mare|Bucovina/;

/** hipped roof whose eave rectangle (len × wid, centred on (cx, cz), axis (ux, uz)) starts at y; ridge along the long axis.
 *  shingles: horizontal courses as colour bands; a fascia board under the eave so the roof never reads paper-thin */
function hipRoofOn(b, o, y, len, wid, h, col, { courses = 0.22, fascia = '#3e2f22', key = 'roofs' } = {}) {
    const hl = len / 2, hw = wid / 2, ridge = Math.max(0, hl - hw * 0.85);
    const P = (u, v, yy) => [o.cx + o.ux * u - o.uz * v, yy, o.cz + o.uz * u + o.ux * v];
    const A = P(-hl, -hw, y), B = P(hl, -hw, y), C = P(hl, hw, y), D = P(-hl, hw, y), R1 = P(-ridge, 0, y + h), R2 = P(ridge, 0, y + h);
    const shade = new THREE.Color(col).multiplyScalar(0.72), base = new THREE.Color(col);
    const cf = (px, py) => (Math.floor((py - y) / courses) % 2 ? shade : base);
    const tri = (a, b2, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b2, ...c], 3)); g.computeVertexNormals(); b.add(g, key, null, cf); g.dispose(); };
    tri(A, R2, B); tri(A, R1, R2); tri(C, R1, D); tri(C, R2, R1); tri(B, R2, C); tri(D, R1, A);   // outer faces (ridge up)
    tri(A, B, R2); tri(A, R2, R1); tri(C, D, R1); tri(C, R1, R2); tri(B, C, R2); tri(D, A, R1);   // soffit side (seen from under the eaves)
    for (const [p, q] of [[A, B], [B, C], [C, D], [D, A]]) { const L = Math.hypot(q[0] - p[0], q[2] - p[2]); b.box((p[0] + q[0]) / 2, y - 0.16, (p[2] + q[2]) / 2, 0.06, 0.18, L, fascia, 'wood', Math.atan2(q[0] - p[0], q[2] - p[2])); }
}
/** a carved porch post (stâlp): square shaft with turned rings, a flared capital and corner brackets under the beam */
function carvedPost(b, x, y, z, h, col, yaw) {
    b.box(x, y, z, 0.16, h, 0.16, col, 'wood', yaw);
    for (const t of [0.18, 0.5, 0.72]) b.cyl(x, y + h * t, z, 0.12, 0.08, col, 'wood', 8);
    b.cyl(x, y + h - 0.28, z, 0.15, 0.28, col, 'wood', 6, 1.5);
    for (const s of [-1, 1]) b.rod([x + Math.sin(yaw) * s * 0.06, y + h - 0.6, z + Math.cos(yaw) * s * 0.06], [x + Math.sin(yaw) * s * 0.55, y + h - 0.04, z + Math.cos(yaw) * s * 0.55], 0.04, col, 'wood', 4);
}
/** a peasant house from its OSM footprint (note 30): walls on the real footprint (whitewash on a painted plinth, or log courses),
 *  the porch (prispă: clay platform, carved posts, beam) on the front long side under the same roof, framed windows with shutters,
 *  a plank door, and a steep hipped roof (shingle in the north, reed / shingle in the south) that SITS on the walls with a 0.6 m eave */
function peasantHouse(b, ctx, bd, r) {
    const g = ctx.ground, o = obb(bd.poly); if (!o || o.len < 2) return null;
    if (o.wid > o.len) { [o.len, o.wid] = [o.wid, o.len]; [o.ux, o.uz] = [-o.uz, o.ux]; o.angle = Math.atan2(-o.uz, o.ux); }
    const north = NORTH.test(bd.name || '') || (bd.mat === 'wood') || r() < 0.35, small = o.len * o.wid < 22;
    const y = Math.min(...bd.poly.map(([x, z]) => g.heightAt(x, z))) - 0.05;
    const wallH = small ? 2.0 : 2.3 + r() * 0.3, porch = !small && o.wid > 4.2 ? Math.min(1.6, o.wid * 0.28) : 0;
    const wall = north ? (r() < 0.5 ? '#6e553c' : '#7d6448') : r.pick(['#f1eee6', '#ece8dc', '#f3f0e8', '#e8e2d2']);
    const roofC = north ? r.pick(['#5c4a38', '#66533f', '#4f4134']) : r.pick(['#a08c5e', '#8c7a55', '#6b5f50', '#5c4a38']);
    const P = (u, v) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v], yawL = Math.atan2(o.ux, o.uz);
    const hl = o.len / 2, hw = o.wid / 2, v0 = -hw + porch; // walls from v0 (porch side −v) to +hw
    const core = [P(-hl, v0), P(hl, v0), P(hl, hw), P(-hl, hw)];
    if (north) { // log courses: round logs stacked, ends crossing at the corners
        b.prism(core, y, y + wallH, wall, 'wood');
        for (let k = 0.12; k < wallH; k += 0.26) { for (const [u0, v0b, u1, v1b] of [[-hl - 0.15, v0, hl + 0.15, v0], [-hl - 0.15, hw, hl + 0.15, hw], [-hl, v0 - 0.15, -hl, hw + 0.15], [hl, v0 - 0.15, hl, hw + 0.15]]) { const [ax, az] = P(u0, v0b), [bx, bz] = P(u1, v1b); b.rod([ax, y + k, az], [bx, y + k, bz], 0.12, k % 0.52 < 0.26 ? '#5e4733' : '#6b523b', 'wood', 6); } }
    } else {
        const pc = new THREE.Color(r.pick(['#3f5f8a', '#8a6a3a', '#7a7a72', '#5a7a8a'])), wc = new THREE.Color(wall);
        { const gq = prismGeometry(core, y, y + wallH); b.add(gq, 'concrete', null, (px, py) => (py < y + 0.52 ? pc : wc)); gq.dispose(); } // painted plinth band = vertex colour (no coplanar layer)
    }
    // windows with frames + shutters on the porch side and the back, a plank door in the middle of the porch side
    const winU = o.len > 6 ? [-hl * 0.55, hl * 0.55] : [hl * 0.4];
    for (const [v, s] of [[v0, -1], [hw, 1]]) {
        for (const u of winU) { const [x, z] = P(u, v + s * 0.04); b.boxC(x, y + wallH * 0.55, z, 0.9, 0.85, 0.06, '#5a4632', 'wood', yawL + Math.PI / 2); const [x2, z2] = P(u, v + s * 0.07); b.boxC(x2, y + wallH * 0.55, z2, 0.66, 0.62, 0.04, '#26303a', 'glass', yawL + Math.PI / 2); for (const q of [-1, 1]) { const [x3, z3] = P(u + q * 0.62, v + s * 0.06); b.boxC(x3, y + wallH * 0.55, z3, 0.32, 0.8, 0.04, north ? '#4a3626' : '#3f6a8a', 'wood', yawL + Math.PI / 2); } }
        if (s < 0) { const [x, z] = P(o.len > 6 ? 0 : -hl * 0.35, v - 0.05); b.box(x, y + (porch ? 0.4 : 0), z, 0.9, 1.75, 0.08, '#4a3626', 'wood', yawL + Math.PI / 2); }
    }
    let roofW = o.wid + 1.2, roofL = o.len + 1.2;
    if (porch) { // prispă: clay platform + carved posts + beam, under the main roof
        const plat = [P(-hl, -hw), P(hl, -hw), P(hl, v0), P(-hl, v0)]; b.prism(plat, y - 0.1, y + 0.4, north ? '#7a6248' : '#d8cfbd', north ? 'wood' : 'concrete'); ctx.ground.addPoly(plat, y + 0.4, y - 1);
        const n = Math.max(2, Math.round(o.len / 1.9)); for (let k = 0; k <= n; k++) { const [x, z] = P(-hl + 0.12 + (o.len - 0.24) * k / n, -hw + 0.12); carvedPost(b, x, y + 0.4, z, wallH - 0.4, '#5a4632', yawL); ctx.circle(x, z, 0.1, wallH); }
        const [bx0, bz0] = P(0, -hw + 0.12); b.box(bx0, y + wallH - 0.04, bz0, 0.16, 0.2, o.len, '#5a4632', 'wood', yawL);
        if (!north) for (let k = 0; k < n; k++) { const [x, z] = P(-hl + (o.len) * (k + 0.5) / n, -hw + 0.12); b.box(x, y + 0.4, z, 0.04, 0.55, o.len / n - 0.3, '#5a4632', 'wood', yawL); } // low railing
    }
    const roofH = north ? Math.min(5.2, roofW * 0.85) : Math.min(3.6, roofW * 0.5);
    hipRoofOn(b, o, y + wallH, roofL, roofW, roofH, roofC, { courses: north ? 0.2 : 0.35 });
    { const [kx, kz] = P(0, (v0 + hw) / 2); ctx.box(kx, kz, o.len / 2, (hw - v0) / 2, -o.angle, { y0: y - 1, y1: y + wallH + roofH }); }
    return { o, y, north, porch, P };
}
/** Dobrogea wooden windmill (Village Museum): octagonal plank tower, conical cap turned to the wind, six lattice sails */
function windmill(b, ctx, x, z, yaw) {
    const y = ctx.ground.heightAt(x, z) - 0.1;
    b.cyl(x, y, z, 2.0, 0.6, '#9a8e7c', 'stone', 8);
    b.cyl(x, y + 0.6, z, 1.8, 6.4, '#7a6650', 'wood', 8, 0.75);
    for (let k = 1; k < 6; k++) b.cyl(x, y + 0.6 + k * 1.1, z, 1.82 - k * 0.08, 0.06, '#5e4b38', 'wood', 8);
    b.add(new THREE.ConeGeometry(1.75, 2.0, 10), 'roofs', M(x, y + 8.0, z), '#5c4a38');
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hx = x + fx * 1.6, hz = z + fz * 1.6, hy = y + 6.8;
    b.rod([x, hy, z], [hx, hy, hz], 0.14, '#4a3a2a', 'wood', 6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, sx = Math.cos(yaw) * Math.cos(a), sz = -Math.sin(yaw) * Math.cos(a), sy = Math.sin(a), L = 5.6;
        b.rod([hx, hy, hz], [hx + sx * L, hy + sy * L, hz + sz * L], 0.06, '#5a4632', 'wood', 4);
        for (const t of [0.35, 0.6, 0.85]) { const px = hx + sx * L * t, py = hy + sy * L * t, pz = hz + sz * L * t; b.boxC(px, py, pz, 0.04, 0.9, 0.04, '#5a4632', 'wood', yaw, 0, -a); }
        b.boxC(hx + sx * L * 0.62, hy + sy * L * 0.62, hz + sz * L * 0.62, 0.02, 3.4, 0.8, '#d8cdb5', 'fabric', yaw, 0, Math.PI / 2 - a); }
    b.box(x + fx * 1.75, y + 0.6, z + fz * 1.75, 0.9, 1.9, 0.08, '#4a3626', 'wood', yaw + Math.PI / 2);
    ctx.circle(x, z, 2.0, 9);
}

/** the wooden church from Dragomirești (1722): log nave, double shingle roof, west tower with an open belfry and a needle spire */
function woodenChurch(b, ctx, bd) {
    const g = ctx.ground, o = obb(bd.poly), y = Math.min(...bd.poly.map(([x, z]) => g.heightAt(x, z))) - 0.1;
    const W = '#4e3a2a', SH = '#7a6a52', SHL = '#a89a7e';
    const core = [[-o.len / 2, -o.wid / 2], [o.len / 2, -o.wid / 2], [o.len / 2, o.wid / 2], [-o.len / 2, o.wid / 2]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v]);
    b.prism(grow(core, 0.4), y - 0.2, y + 0.5, '#9a9284', 'stone');
    b.prism(core, y + 0.5, y + 4.2, W, 'wood'); for (let k = 0.8; k < 4.2; k += 0.34) b.prism(grow(core, 0.03), y + k, y + k + 0.07, '#3a2a1e', 'wood', { noTop: true });
    // lower skirt roof + tall main roof (shingle), shingle shades by height
    const roof = (yy, h, ex, top) => { const rg = new THREE.CylinderGeometry(Math.SQRT1_2 * top, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); b.add(rg, 'roofs', M(o.cx, yy + h / 2, o.cz, 0, -o.angle, 0, o.len + ex, h, o.wid + ex), (px, py) => (py > yy + h * 0.7 ? SHL : SH)); rg.dispose(); };
    roof(y + 2.4, 1.4, 3.2, 0.75); roof(y + 4.2, 6.8, 1.6, 0.12);
    // west tower (on the long axis' west end): square shaft through the roof, open belfry gallery, flared cap, needle spire
    const sgn = o.ux < 0 ? 1 : -1, tx = o.cx + o.ux * sgn * o.len * 0.32, tz = o.cz + o.uz * sgn * o.len * 0.32, tw = 2.6;
    b.box(tx, y + 4.2, tz, tw, 9.8, tw, W, 'wood', -o.angle);
    b.box(tx, y + 14, tz, tw + 1.0, 2.2, tw + 1.0, '#3c2c20', 'wood', -o.angle);
    for (let i = 0; i < 4; i++) for (let k = -1; k <= 1; k++) { const a = -o.angle + i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), px = tx + s * (tw / 2 + 0.52) + c * k * 0.9, pz = tz + c * (tw / 2 + 0.52) - s * k * 0.9; b.box(px, y + 14, pz, 0.12, 2.2, 0.12, '#2a1e16', 'wood'); }
    const cap = new THREE.CylinderGeometry(0.3, 2.6, 2.0, 4).rotateY(Math.PI / 4); b.add(cap, 'roofs', M(tx, y + 17.2, tz, 0, -o.angle, 0), SH); cap.dispose();
    const spire = new THREE.ConeGeometry(0.85, 13, 8); b.add(spire, 'roofs', M(tx, y + 24.6, tz), (px, py) => (py > y + 26 ? SHL : SH)); spire.dispose();
    b.box(tx, y + 31, tz, 0.12, 2.2, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 31.8, tz, 1.0, 0.1, 0.1, '#c9a24e', 'bronze');
    ctx.box(o.cx, o.cz, o.len / 2 + 0.4, o.wid / 2 + 0.4, -o.angle, { y0: y - 1, y1: y + 32 });
    return { x: o.cx, z: o.cz, tx, tz, y };
}
/** stone/bronze bust on a plinth with a name plate (returns the sign entry) */
function bust(b, ctx, p, r) {
    const y = ctx.ground.heightAt(p.x, p.z), stone = r() < 0.6, col = stone ? '#d6d1c6' : '#3f4a3c', a = r() * 6.28;
    b.box(p.x, y, p.z, 0.9, 1.7, 0.9, '#bdb6a8', 'stone', a); b.box(p.x, y + 1.7, p.z, 1.0, 0.12, 1.0, '#cfc8ba', 'stone', a);
    b.sphere(p.x, y + 1.95, p.z, 0.44, 0.2, 0.25, col, stone ? 'stone' : 'bronze', 10, 6); b.cyl(p.x, y + 2.03, p.z, 0.08, 0.16, col, stone ? 'stone' : 'bronze', 8); b.sphere(p.x, y + 2.35, p.z, 0.15, 0.19, 0.17, col, stone ? 'stone' : 'bronze', 10, 8);
    ctx.circle(p.x, p.z, 0.55, 2.9);
    return { x: p.x + Math.sin(a) * 0.47, y: y + 1.1, z: p.z + Math.cos(a) * 0.47, yaw: a, w: 0.85, h: 0.26, text: (p.name || '').replace(/ (bust|statue)$/i, ''), bg: '#d8d2c4', fg: '#2a2a2a', border: false };
}

export default {
    env: { fogFar: 3400, ambientCity: 0.15, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, spH = ctx.spot('herastrau-park'), spV = ctx.spot('village-museum');
        // ---- the lake (OSM multipolygon with its islands): water plane, shore carved, not walkable
        const lake = d.areas.find((a) => a.id === 'r1130828');
        let level = g.heightAt(24, -45) - 1.4;
        if (lake) {
            ctx.skipAreas.add(lake.id);
            const holes = lake.holes || [], bbL = polyBox(lake.poly), hb = holes.map(polyBox);
            // the DEM (EU-DEM, opened) slopes far into the water; the real banks stand ~1.5 m above the lake: keep land above
            // the water level and carve the lake bed below it
            level = g.heightAt(24, -30) - 1.6;
            const inLake = ctx.extras.inLake = (x, z) => { if (x < bbL.x0 || x > bbL.x1 || z < bbL.z0 || z > bbL.z1 || !inPoly(x, z, lake.poly)) return false; for (let i = 0; i < holes.length; i++) { const q = hb[i]; if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && inPoly(x, z, holes[i])) return false; } return true; };
            g.mod((x, z, h) => (inLake(x, z) ? Math.min(h, level - 2.2) : Math.max(h, level + 1.2 + Math.max(0, h - level) * 0.0)));
            // shore: land next to the water sits a little above it
            ctx.water(level, { x0: -1400, z0: -2400, x1: 1400, z1: 100 }, [], { color: '#3b5560' });
        }
        // ---- village museum: households, the wooden church, fences, wells, crosses
        const mus = osmPoly(d, 'w29701978'), b = new GeoBatch(), r = rng(19), signs = [];
        let church = null;
        const houses = [];
        if (mus) for (const bd of d.buildings) {
            const [cx, cz] = centroid(bd.poly); if (bd.part || !inPoly(cx, cz, mus) || bd.id === 'w44037354' || bd.id === 'w102780052') continue;
            ctx.skipBuildings.add(bd.id);
            if (bd.id === 'w277782593' || bd.k === 'church') { const cb = new GeoBatch(); church = woodenChurch(cb, ctx, bd); ctx.add(cb.build('wooden-church')); continue; }
            const h = peasantHouse(b, ctx, bd, r); if (h) houses.push({ ...h, bd });
        }
        // wattle fences round the households near the church + wells with sweeps + wayside crosses (OSM crosses)
        // (round 6 note 16: the rings overlapped each other and cut the museum's lanes — a fence piece is now built only
        //  where it is clear of every footpath (2 m) and of the other households' yards, so the lanes stay walkable)
        const lanes = mus ? d.ways.filter((w) => /footway|path|pedestrian|service|track|steps/.test(w.k || '') && w.pts.some(([x, z]) => inPoly(x, z, mus))).map((w) => w.pts) : [];
        const yards = houses.slice(0, 40).map((h) => { const o = h.o; return { o, fw: o.len / 2 + 2.6, fd: o.wid / 2 + 2.6 }; });
        const inYard = (x, z, self) => yards.some((Y) => { if (Y.o === self) return false; const dx = x - Y.o.cx, dz = z - Y.o.cz, u = dx * Y.o.ux + dz * Y.o.uz, v = -dx * Y.o.uz + dz * Y.o.ux; return Math.abs(u) < Y.fw + 0.4 && Math.abs(v) < Y.fd + 0.4; });
        const fenceFree = (x, z, self) => !lanes.some((pts) => distPolyline(x, z, pts).d < 2) && !inYard(x, z, self) && !houses.some((h2) => h2.o !== self && inPoly(x, z, h2.bd.poly));
        for (const h of houses.slice(0, 40)) {
            const { o, y } = h, fw = o.len / 2 + 2.6, fd = o.wid / 2 + 2.6;
            const ring = [[-fw, -fd], [fw, -fd], [fw, fd], [-fw, fd], [-fw, -fd]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v]);
            for (let i = 1; i < ring.length; i++) { if (i === 1) { if (h.north && r() < 0.6) { const [gx, gz] = [(ring[0][0] + ring[1][0]) / 2, (ring[0][1] + ring[1][1]) / 2], gy = g.heightAt(gx, gz), ya = Math.atan2(o.ux, o.uz) + Math.PI / 2, ex = Math.sin(ya) * 1.7, ez = Math.cos(ya) * 1.7; for (const s of [-1, 1]) carvedPost(b, gx + ex * s, gy, gz + ez * s, 3.4, '#5e4733', ya); b.box(gx, gy + 3.4, gz, 0.3, 0.3, 4.2, '#5e4733', 'wood', ya - Math.PI / 2 + Math.PI / 2); hipRoofOn(b, { cx: gx, cz: gz, ux: Math.sin(ya), uz: Math.cos(ya) }, gy + 3.7, 4.6, 1.2, 0.9, '#4f4134', { courses: 0.15 }); } continue; } const [ax, az] = ring[i - 1], [bx, bz] = ring[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.5));
                let run = -1; const put = (k0, k1) => { const t0 = k0 / n, t1 = k1 / n, sx = ax + (bx - ax) * t0, sz = az + (bz - az) * t0, ex2 = ax + (bx - ax) * t1, ez2 = az + (bz - az) * t1, l = Math.hypot(ex2 - sx, ez2 - sz), cx = (sx + ex2) / 2, cz = (sz + ez2) / 2; if (l < 1) return; b.box(cx, g.heightAt(cx, cz) - 0.05, cz, 0.12, 1.1, l, '#7a6448', 'wood', Math.atan2(bx - ax, bz - az)); ctx.collider({ wall: true, ax: sx, az: sz, bx: ex2, bz: ez2, y0a: y - 1, y1a: y + 1.1, y0b: y - 1, y1b: y + 1.1, x: cx, z: cz, r: l / 2 + 0.5 }); };
                for (let k = 0; k <= n; k++) { const t = (k + 0.5) / n, ok = k < n && fenceFree(ax + (bx - ax) * t, az + (bz - az) * t, o); if (ok && run < 0) run = k; else if (!ok && run >= 0) { put(run, k); run = -1; } } }
            if (r() < 0.3) { const wx = o.cx + o.uz * (fd - 1.8), wz = o.cz - o.ux * (fd - 1.8), wy = g.heightAt(wx, wz); b.cyl(wx, wy, wz, 0.55, 0.8, '#6b5a44', 'wood', 8); b.box(wx + 1.6, wy, wz, 0.2, 3.6, 0.2, '#5a4632', 'wood'); b.rod([wx - 2.2, wy + 4.6, wz], [wx + 3.6, wy + 2.4, wz], 0.07, '#5a4632', 'wood', 5); b.rod([wx - 2.2, wy + 4.6, wz], [wx - 2.2, wy + 1.2, wz], 0.02, '#3a2a1e', 'metal', 3); ctx.circle(wx, wz, 0.6, 1); }
        }
        if (mus) { const wr = rng(5), bbm = polyBox(mus); let placed = 0; for (let k = 0; k < 400 && placed < 3; k++) { const x = bbm.x0 + wr() * (bbm.x1 - bbm.x0), z = bbm.z0 + wr() * (bbm.z1 - bbm.z0); if (!inPoly(x, z, grow(mus, -15)) || houses.some((h) => Math.hypot(h.o.cx - x, h.o.cz - z) < 16) || (church && Math.hypot(church.x - x, church.z - z) < 30) || d.ways.some((w) => ['footway', 'path', 'service'].includes(w.k) && distPolyline(x, z, w.pts).d < 5)) continue; windmill(b, ctx, x, z, 0.6 + placed); placed++; ctx.trees = ctx.trees.filter((t) => Math.hypot(t.x - x, t.z - z) > 7); } }
        // activity (note 57, research `lm-village-passport`): a village passport — step onto the porch of five households from
        // different regions (E at the door: a stamp + what the house is); the fifth stamp completes "village-museum:farmhouse"
        { const named = houses.filter((h) => h.porch && h.bd.name), pick = [], regions = new Set();
          for (const h of named) { const reg = (h.bd.name.match(/din ([^,(]+)/) || [, h.bd.name])[1].trim(); if (regions.has(reg)) continue; regions.add(reg); pick.push(h); if (pick.length >= 8) break; }
          const stamps = new Set();
          for (const h of pick) { const [x, z] = h.P(h.o.len > 6 ? 0 : -h.o.len * 0.175, -h.o.wid / 2 + 0.6); ctx.interactables.push({ x, z, r: 2.2, label: () => (stamps.has(h.bd.id) ? `${h.bd.name} (stamped)` : `Step into the house: ${h.bd.name}`), use: (s) => { if (stamps.has(h.bd.id)) return; stamps.add(h.bd.id); if (stamps.size >= 5) bucActivity(s, 'village-museum', 'farmhouse', '🏡 Village passport complete', `Five households from five regions — the last: ${h.bd.name}. The houses were moved here whole, with their furniture, from 1936 on.`); else s.ui.toast(`🏡 Stamp ${stamps.size} / 5`, `${h.bd.name}: a clay-floored main room, painted dowry chest, woven rugs on the walls, the bread oven by the door.`); } }); } }
        for (const [x, z] of d.furniture.cross || []) { if (mus && !inPoly(x, z, mus)) continue; const y = g.heightAt(x, z); b.box(x, y, z, 0.18, 2.2, 0.18, '#5a4632', 'wood'); b.box(x, y + 1.6, z, 1.1, 0.16, 0.16, '#5a4632', 'wood'); b.box(x, y + 2.15, z, 0.7, 0.2, 0.5, '#4a3a2a', 'wood'); ctx.circle(x, z, 0.15, 2.2); }
        // museum fence (ticketed site) with the entrance by Kiseleff and a gate toward the park
        if (mus) {
            const near = (px, pz) => { let bi = 0, bd2 = 1e9; mus.forEach(([x, z], i) => { const dd = Math.hypot(x - px, z - pz); if (dd < bd2) { bd2 = dd; bi = i; } }); return bi; };
            const gateA = near(-374, 40), gateB = near(31, -10), pts = [];
            for (let i = 0; i <= mus.length; i++) { const k = i % mus.length; if (k === gateA || k === gateB) { if (pts.length > 1) palisadeRun(pts.splice(0)); pts.length = 0; continue; } pts.push(mus[k]); }
            if (pts.length > 1) palisadeRun(pts);
            function palisadeRun(run) { const mats = palisade(ctx, b, run, { h: 1.8, post: 4, plinth: 0.3 }); ctx.extras.palMats = mats; }
        }
        // ---- park: busts and statues along the alleys (OSM artworks), the Sleeping Nymph, Japanese garden
        for (const p of d.pois) { if (p.tourism !== 'artwork' || !/bust|statue/.test(p.artwork_type || '') || !p.name) continue; if (mus && inPoly(p.x, p.z, mus)) continue; if (Math.abs(p.x) > 520 || p.z < -320 || p.z > 420 || p.id === 'n1342884103') continue; signs.push(bust(b, ctx, p, r)); }
        const nymph = d.pois.find((p) => p.id === 'n1342884103') || { x: 236.3, z: 109.8 };
        { // the Sleeping Nymph: a reclining marble figure on a low plinth (smooth volumes: torso, hip, legs, arm under the head)
            const y = g.heightAt(nymph.x, nymph.z), yaw = 0.4, c = Math.cos(yaw), sn = Math.sin(yaw), P = (u, v) => [nymph.x + u * c + v * sn, nymph.z - u * sn + v * c], W = '#ecebe6';
            b.box(nymph.x, y, nymph.z, 3.6, 0.8, 1.7, '#bdb7ab', 'stone', yaw); b.box(nymph.x, y + 0.8, nymph.z, 3.3, 0.12, 1.45, '#d4cfc4', 'stone', yaw);
            const Y = y + 0.92, seg = (u0, h0, u1, h1, r0, r1) => { const [ax, az] = P(u0, 0), [bx, bz] = P(u1, 0); b.rod([ax, Y + h0, az], [bx, Y + h1, bz], r0, W, 'stone', 12, r1); b.sphere(bx, Y + h1, bz, r1, r1, r1, W, 'stone', 10, 8); };
            seg(-1.15, 0.42, -0.35, 0.3, 0.2, 0.26); seg(-0.35, 0.3, 0.15, 0.24, 0.26, 0.24); seg(0.15, 0.24, 0.85, 0.16, 0.16, 0.12); seg(0.85, 0.16, 1.4, 0.1, 0.12, 0.07); seg(0.2, 0.32, 0.8, 0.28, 0.14, 0.1);
            const [hx, hz] = P(-1.35, 0.05); b.sphere(hx, Y + 0.55, hz, 0.15, 0.17, 0.15, W, 'stone', 12, 10); const [ax2, az2] = P(-1.45, -0.15); b.rod([ax2, Y + 0.2, az2], [hx, Y + 0.45, hz], 0.07, W, 'stone', 8);
            const [dx, dz] = P(0, 0.35); b.box(dx, Y, dz, 2.6, 0.08, 0.5, '#e4e2dc', 'stone', yaw); // drapery
            ctx.box(nymph.x, nymph.z, 1.8, 0.85, yaw, { prop: true, h: 1.6 }); }
        const jg = osmPoly(d, 'w28342074');
        if (jg) { const [jx, jz] = centroid(jg), y = g.heightAt(jx, jz);
            // red arched bridge over a pond, stone lanterns, cherries
            const pond = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pond.push([jx + Math.cos(a) * 14, jz + Math.sin(a) * 8]); }
            g.mod((x, z, h) => (inPoly(x, z, pond) ? Math.min(h, y - 1.2) : h)); b.flat(pond, y - 0.45, '#3d5a5e', 'water');
            for (let i = 0; i <= 12; i++) { const t = i / 12, x = jx - 4 + 8 * t, yy = y + Math.sin(t * Math.PI) * 1.1; b.box(x, yy, jz, 0.7, 0.14, 2.0, '#8a3a2a', 'wood'); if (i % 2 === 0) for (const s of [-1, 1]) b.box(x, yy, jz + s, 0.08, 0.9, 0.08, '#9a3a2a', 'paint'); }
            g.addPoly([[jx - 4.2, jz - 1.1], [jx + 4.2, jz - 1.1], [jx + 4.2, jz + 1.1], [jx - 4.2, jz + 1.1]], (x) => y + Math.sin(Math.max(0, Math.min(1, (x - jx + 4) / 8)) * Math.PI) * 1.1 + 0.07, y - 2);
            for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, x = jx + Math.cos(a) * 18, z = jz + Math.sin(a) * 12, yy = g.heightAt(x, z); b.box(x, yy, z, 0.6, 0.6, 0.6, '#9a958a', 'stone'); b.box(x, yy + 0.6, z, 0.25, 0.7, 0.25, '#9a958a', 'stone'); b.box(x, yy + 1.3, z, 0.6, 0.45, 0.6, '#a8a396', 'stone'); b.add(new THREE.ConeGeometry(0.6, 0.4, 4), 'stone', M(x, yy + 1.95, z, 0, Math.PI / 4), '#8c877c'); ctx.circle(x, z, 0.35, 2); }
            for (let i = 0; i < 12; i++) { const a = r() * 6.28, rr = 16 + r() * 18, x = jx + Math.cos(a) * rr, z = jz + Math.sin(a) * rr * 0.7; if (inPoly(x, z, jg)) ctx.trees.push({ x, z, kind: 'broad', s: 0.55 + r() * 0.2, c: r.pick(['#e9b7c6', '#f0c8d4', '#d98fa6']) }); }
            ctx.extras.jg = { x: jx, z: jz, y };
        }
        ctx.add(b.build('herastrau', { matOverrides: { ...(ctx.extras.palMats || {}) } }));
        const SA = signAtlas(signs, { name: 'bust-names', night: 0.2 }); if (SA) ctx.add(SA);
        // lakeshore railing round the south tip (inside the park, outside the museum)
        if (lake) { const rb = new GeoBatch(); let run = []; const flush = () => { if (run.length > 1) { railing(rb, offsetPolyline(run, 1.2), (x, z) => g.heightAt(x, z), { h: 1.0, post: 4.2, color: '#2b3330' }); for (let i = 1; i < run.length; i++) { const [ax, az] = run[i - 1], [bx, bz] = run[i]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: level - 3, y1a: level + 3, y0b: level - 3, y1b: level + 3, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); } } run = []; };
            for (const p of lake.poly) { if (p[0] > -60 && p[0] < 520 && p[1] > -420 && p[1] < 60 && !(mus && inPoly(p[0], p[1], mus))) run.push(p); else flush(); } flush(); ctx.add(rb.build('lake-railing')); }
        // ---- ground, park trees (dense old parkland), lamps
        ctx.terrainOpts = { bg: '#6a8444', bgMask: 'grass', innerPx: 2048, innerStep: 4, outerStep: 16, outerPad: 800 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#24282a', lampH: 4.2, lampPad: 10, treeLod: { cap: 1400, max: 240 }, lampOpts: { spacing: 58, kinds: ['footway', 'path', 'pedestrian', 'cycleway'] }, streetTreeOpts: { kinds: ['primary', 'secondary'], prob: 0.8 }, areaTreeOpts: { kinds: ['wood', 'forest', 'park'], density: 1 / 260, conifer: 0.15, exclude: [...(jg ? [jg] : [])] } });
        // the museum: dense canopy along the alleys, clearings round the houses
        if (mus) { const bb = polyBox(mus); for (let i = 0; i < 700; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); if (!inPoly(x, z, mus) || g.heightAt(x, z) < level + 0.3 || houses.some((h) => Math.hypot(h.o.cx - x, h.o.cz - z) < h.o.len / 2 + 6) || (church && Math.hypot(church.x - x, church.z - z) < 16)) continue; ctx.trees.push({ x, z, kind: r() < 0.12 ? 'con' : 'broad', s: 0.9 + r() * 0.7 }); } }
        if (church) ctx.trees.push({ x: church.tx + 7, z: church.tz - 5, kind: 'con', s: 1.6, sy: 1.3 }); // the tall spruce next to the church
        // old parkland: lindens / chestnuts / planes lining the alleys (OSM maps few trees here)
        { const box = Object.values(d.spots).map((q) => polyBox(q.extent.polygon)); const inside = (x, z) => box.some((q) => x > q.x0 - 80 && x < q.x1 + 80 && z > q.z0 - 80 && z < q.z1 + 80);
            for (const w of d.ways) { if (!['footway', 'path', 'cycleway', 'pedestrian'].includes(w.k)) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const nx = -(bz - az) / L, nz = (bx - ax) / L; for (let t = r() * 9; t < L; t += 8 + r() * 4) for (const sd of [-1, 1]) { if (r() < 0.25) continue; const x = ax + (bx - ax) * t / L + nx * sd * (4 + r() * 2), z = az + (bz - az) * t / L + nz * sd * (4 + r() * 2); if (!inside(x, z) || (jg && inPoly(x, z, jg)) || Math.hypot(x - nymph.x, z - nymph.z) < 16) continue; ctx.trees.push({ x, z, kind: r() < 0.08 ? 'con' : 'broad', s: 1.25 + r() * 0.6 }); } } } }
        ctx.trees = ctx.trees.filter((t) => g.heightAt(t.x, t.z) > level + 0.4);
        { const ic = spV.photo.iconic; if (church && ic) { const dx = church.x - ic.x, dz = church.z - ic.z, L = Math.hypot(dx, dz); ctx.trees = ctx.trees.filter((t) => { const u = ((t.x - ic.x) * dx + (t.z - ic.z) * dz) / L; if (u < -2 || u > L + 4) return true; const v = Math.abs((t.x - ic.x) * dz - (t.z - ic.z) * dx) / L; return v > 4 + u * 0.35; }); } }
        cityFiller(ctx, { ring: 650, avoid: lake ? [lake.poly] : [] });
        // plaques
        const PH = spH.plaques, PV = spV.plaques;
        PH.forEach((pl, i) => ctx.plaque(pl, nymph.x - 14 + i * 7, nymph.z + 10, Math.PI, { style: 'park' }));
        if (church) PV.forEach((pl, i) => { const a = Math.PI * 0.75 + i * 0.28, x = church.x + Math.cos(a) * 18, z = church.z + Math.sin(a) * 18; ctx.plaque(pl, x, z, Math.atan2(church.x - x, church.z - z) + Math.PI, { style: 'park', credit: i === 0 ? 'Founded by sociologist Dimitrie Gusti (1936).' : null }); });
        // fun: feed the ducks, ring the toaca, draw water
        // activity (note 57): a boat out on Lake Herăstrău from the south landing (rentals April–October), out and back
        if (ctx.extras.inLake) { const inL = ctx.extras.inLake; let st = null; for (let k = 0; k < 40 && !st; k++) { const x = 30 + (k % 2 ? 1 : -1) * k * 2, z = -32 - k * 1.5; if (inL(x, z)) st = [x, z]; }
            if (st) { const out = [st]; for (let k = 1; k < 60; k++) { const x = st[0] + Math.sin(k * 0.09) * 26, z = st[1] - k * 6; if (!inL(x, z) || !inL(x + 8, z) || !inL(x - 8, z)) break; out.push([x, z]); }
                if (out.length > 6) { const bt = new THREE.Group(); const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.5 })); hull.scale.set(0.95, 0.5, 2.3); bt.add(hull); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: '#2f5a7a' })); seat.position.y = -0.04; bt.add(seat); bt.position.set(st[0], level + 0.02, st[1]); ctx.add(bt);
                    const path = [...out, ...out.slice(0, -1).reverse()], ride = boatRide(ctx, bt, path, level + 0.02, { speed: 2.2, onDone: (s) => bucActivity(s, 'herastrau-park', 'boat', '⛵ Lake Herăstrău', 'Out past the Japanese garden and back — boats and pedal boats are rented at the landings from spring to autumn.') });
                    ctx.interactables.push({ x: 37, z: -24, r: 3, label: 'Rent a boat (out on the lake and back, Esc to stop)', cond: () => !ride.active(), use: (s) => { const m = new Date().getMonth(); if (m < 3 || m > 9) { s.ui.toast('⛵ Boats are seasonal', 'Boat and pedal-boat rentals run from April to October.'); return; } ride.start(s); } }); } } }
        ctx.interactables.push({ x: 30, z: -26, r: 4, label: 'Feed the ducks', use: (s) => { s.ui.toast('🦆 Quack', 'Ducks gather at the south tip of the lake.'); s.sound.play('splat', 0.4); } });
        if (church) ctx.interactables.push({ x: church.x + 6, z: church.z + 6, r: 3, label: 'Strike the toaca (wooden semantron)', use: (s) => { s.sound.play('thump', 0.8); setTimeout(() => s.sound.play('thump', 0.6), 260); setTimeout(() => s.sound.play('thump', 0.9), 520); s.ui.toast('Toaca', 'The wooden board calls to service on feast days.'); } });
        // postcards: the church spire from the lawn (research pose); the nymph with the lake behind
        if (church) { const ic = spV.photo.iconic, dx = ic.x - church.x, dz = ic.z - church.z, L = Math.hypot(dx, dz) || 1, px = church.x + dx / L * 16, pz = church.z + dz / L * 16; ctx.challenge('village-museum', { view: [church.x, church.z], x: px, z: pz, heading: (Math.atan2(church.x - px, -(church.z - pz)) * 180 / Math.PI + 360) % 360, pitch: 32, r: 10, tol: 28 }); }
        else ctx.challenge('village-museum', { r: 10, tol: 28 });
        ctx.challenge('herastrau-park', { view: [nymph.x, nymph.z], x: nymph.x - 0.8, z: nymph.z + 4.2, heading: 350, pitch: -12, r: 8, tol: 30, text: 'The Sleeping Nymph with the park and Lake Herăstrău behind' });
        // crowd
        ctx.crowdCfg = {
            spots: ['herastrau-park', 'village-museum'],
            personas: { local_parent: 2.5, local_elder: 2.5, local_young: 3, kid: 1.4, tourist_it: 1, tourist_uk: 1, tourist_de: 1, tourist_us: 0.8 },
            walkers: 42, paths: ctx.footLines(),
            groups: [
                { x: nymph.x + 3, z: nymph.z + 7, r: 3, n: 4, act: 'photo', look: [nymph.x, nymph.z], personas: ['tourist_it', 'tourist_uk', 'local_young'] },
                { x: 32, z: -22, r: 3, n: 5, act: 'watch', look: [24, -45], personas: ['kid', 'local_parent', 'local_elder'] },
                ...(church ? [{ x: church.x - 14, z: church.z + 12, r: 3, n: 7, act: 'photo', look: [church.tx, church.tz], personas: ['tourist_de', 'tourist_us', 'tourist_it', 'local_parent', 'kid'] }, { x: church.x - 10, z: church.z + 16, r: 0.3, n: 1, act: 'guide', look: [church.x - 14, church.z + 12], personas: ['tour_guide'] }, { x: church.x + 8, z: church.z + 12, r: 0.3, n: 1, act: 'watch', personas: ['guard'] }, { x: church.x - 26, z: church.z - 4, r: 0.3, n: 1, act: 'watch', personas: ['vendor'] }] : []),
                ...(ctx.extras.jg ? [{ x: ctx.extras.jg.x + 2, z: ctx.extras.jg.z + 4, r: 3, n: 4, act: 'photo', look: [ctx.extras.jg.x, ctx.extras.jg.z], personas: ['local_young', 'tourist_it'] }] : []),
                { x: 200, z: 60, r: 2, n: 3, act: 'sit', personas: ['local_elder'] },
            ],
        };
        ctx.sound('birds', 150, 80, 160, 1); ctx.sound('birds', -150, -40, 160, 1); ctx.sound('water', 24, -50, 60, 0.6); ctx.sound('crows', -100, 0, 200, 0.6); ctx.sound('traffic', -380, 40, 160, 0.5); ctx.sound('wind', 0, 0, 300, 0.4);
        ctx.spawns['herastrau-park'] = { x: nymph.x - 4, z: nymph.z + 30, heading: headingFromBearing(350) };
        // note 31: a bike-share dock next to the spawn (E rents a bike, E again gets off) — ride the park alleys round the lake
        addBikeRental(ctx, { x: nymph.x + 0.5, z: nymph.z + 33, heading: headingFromBearing(80), n: 6, name: 'Bike rental (I\'Velo)', colour: '#2f8f46' });
        ctx.spawns['village-museum'] = { x: spV.spawn.x, z: spV.spawn.z, heading: headingFromBearing(40) };
    },
};
