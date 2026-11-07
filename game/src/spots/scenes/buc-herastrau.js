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
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, obb, polyArea, offsetPolyline } from '../kit.js';
import { bucBackdrop, osmPoly, cityFiller, palisade, signAtlas } from '../buc.js';
import { railing } from '../props.js';

function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const NORTH = /Maramureș|Maramures|Bistrița|Hunedoara|Harghita|Suceava|Neamț|Neamt|Alba|Cluj|Sălaj|Mureș|Brașov|Sibiu|Covasna|Bihor|Satu Mare|Bucovina/;

/** a peasant house from its OSM footprint: walls (whitewash or logs), porch, steep hipped roof (shingle / reed) */
function peasantHouse(b, ctx, bd, r) {
    const g = ctx.ground, o = obb(bd.poly); if (!o || o.len < 2) return null;
    const north = NORTH.test(bd.name || '') || (bd.mat === 'wood'), small = o.len * o.wid < 30;
    const y = Math.min(...bd.poly.map(([x, z]) => g.heightAt(x, z))) - 0.1;
    const wallH = small ? 2.1 : 2.6 + r() * 0.5, roofH = (north ? 1.25 : 0.85) * Math.min(o.wid, 8) * (0.75 + r() * 0.2);
    const wall = north ? (r() < 0.5 ? '#6e553c' : '#7d6448') : r.pick(['#f1eee6', '#ece8dc', '#f3f0e8', '#e8e2d2']);
    const roof = north ? r.pick(['#5c5246', '#6b5f50', '#4f463c']) : r.pick(['#8c7a55', '#7d6b4a', '#6b5f50', '#9a8a62']);
    const inset = 0.6, core = [[-o.len / 2 + inset, -o.wid / 2 + inset], [o.len / 2 - inset, -o.wid / 2 + inset], [o.len / 2 - inset, o.wid / 2 - inset], [-o.len / 2 + inset, o.wid / 2 - inset]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v]);
    b.prism(core, y, y + wallH, wall, north ? 'wood' : 'concrete');
    if (north) for (let k = 0.3; k < wallH; k += 0.32) b.prism(grow(core, 0.03), y + k, y + k + 0.06, '#4f3d2b', 'wood', { noTop: true }); // log courses
    else b.prism(grow(core, 0.02), y, y + 0.45, '#9a8e7c', 'stone', { noTop: true }); // plinth
    // small windows (dark) on the long sides + a door
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k += 2) { const u = k * o.len * 0.22, v = s * (o.wid / 2 - inset + 0.03); b.box(o.cx + o.ux * u - o.uz * v, y + wallH * 0.45, o.cz + o.uz * u + o.ux * v, 0.7, 0.75, 0.06, '#2c3036', 'paint', o.angle === undefined ? 0 : -o.angle); }
    // porch (prispă) along the front long side: posts + roof overhang
    const pv = o.wid / 2 + 0.5;
    if (!small) for (let k = -2; k <= 2; k++) { const u = k * o.len * 0.2, x = o.cx + o.ux * u + o.uz * pv, z = o.cz + o.uz * u - o.ux * pv; b.box(x, y, z, 0.16, wallH, 0.16, '#5a4632', 'wood'); }
    // steep hipped roof (frustum with a short ridge), deep eaves
    const rg = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.18, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
    b.add(rg, 'roofs', M(o.cx, y + wallH + roofH / 2, o.cz, 0, -o.angle, 0, o.len + 1.4, roofH, o.wid + 1.6), roof); rg.dispose();
    ctx.box(o.cx, o.cz, o.len / 2, o.wid / 2, -o.angle, { y0: y - 1, y1: y + wallH + roofH });
    return { o, y, north };
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
            const inLake = (x, z) => { if (x < bbL.x0 || x > bbL.x1 || z < bbL.z0 || z > bbL.z1 || !inPoly(x, z, lake.poly)) return false; for (let i = 0; i < holes.length; i++) { const q = hb[i]; if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && inPoly(x, z, holes[i])) return false; } return true; };
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
        for (const h of houses.slice(0, 40)) {
            const { o, y } = h, fw = o.len / 2 + 4, fd = o.wid / 2 + 4;
            const ring = [[-fw, -fd], [fw, -fd], [fw, fd], [-fw, fd], [-fw, -fd]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v]);
            for (let i = 1; i < ring.length; i++) { if (i === 3) continue; const [ax, az] = ring[i - 1], [bx, bz] = ring[i], L = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2; b.box(cx, g.heightAt(cx, cz) - 0.05, cz, 0.12, 1.1, L, '#7a6448', 'wood', Math.atan2(bx - ax, bz - az)); ctx.collider({ wall: true, ax, az, bx, bz, y0a: y - 1, y1a: y + 1.1, y0b: y - 1, y1b: y + 1.1, x: cx, z: cz, r: L / 2 + 0.5 }); }
            if (r() < 0.3) { const wx = o.cx + o.uz * (fd - 1.8), wz = o.cz - o.ux * (fd - 1.8), wy = g.heightAt(wx, wz); b.cyl(wx, wy, wz, 0.55, 0.8, '#6b5a44', 'wood', 8); b.box(wx + 1.6, wy, wz, 0.2, 3.6, 0.2, '#5a4632', 'wood'); b.rod([wx - 2.2, wy + 4.6, wz], [wx + 3.6, wy + 2.4, wz], 0.07, '#5a4632', 'wood', 5); b.rod([wx - 2.2, wy + 4.6, wz], [wx - 2.2, wy + 1.2, wz], 0.02, '#3a2a1e', 'metal', 3); ctx.circle(wx, wz, 0.6, 1); }
        }
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
        for (const p of d.pois) { if (p.tourism !== 'artwork' || !/bust|statue/.test(p.artwork_type || '') || !p.name) continue; if (mus && inPoly(p.x, p.z, mus)) continue; if (Math.abs(p.x) > 520 || p.z < -320 || p.z > 420) continue; signs.push(bust(b, ctx, p, r)); }
        const nymph = d.pois.find((p) => p.id === 'n1342884103') || { x: 236.3, z: 109.8 };
        { const y = g.heightAt(nymph.x, nymph.z); b.box(nymph.x, y, nymph.z, 3.4, 0.9, 1.6, '#cfc9bc', 'stone', 0.4); b.sphere(nymph.x, y + 1.2, nymph.z, 1.4, 0.32, 0.45, '#ece9e2', 'stone', 12, 8); b.sphere(nymph.x - 1.2, y + 1.35, nymph.z + 0.4, 0.22, 0.25, 0.22, '#ece9e2', 'stone', 10, 8); b.sphere(nymph.x + 0.2, y + 1.45, nymph.z, 0.5, 0.3, 0.42, '#ece9e2', 'stone', 10, 8); ctx.box(nymph.x, nymph.z, 1.7, 0.8, 0.4, { prop: true, h: 1.6 }); }
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
        if (lake) { const rb = new GeoBatch(); let run = []; const flush = () => { if (run.length > 1) { railing(rb, offsetPolyline(run, 1.2), (x, z) => g.heightAt(x, z), { h: 1.0, post: 2.4, color: '#2b3330' }); for (let i = 1; i < run.length; i++) { const [ax, az] = run[i - 1], [bx, bz] = run[i]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: level - 3, y1a: level + 3, y0b: level - 3, y1b: level + 3, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); } } run = []; };
            for (const p of lake.poly) { if (p[0] > -60 && p[0] < 520 && p[1] > -420 && p[1] < 60 && !(mus && inPoly(p[0], p[1], mus))) run.push(p); else flush(); } flush(); ctx.add(rb.build('lake-railing')); }
        // ---- ground, park trees (dense old parkland), lamps
        ctx.terrainOpts = { bg: '#6a8444', bgMask: 'grass', innerPx: 2048, innerStep: 4, outerStep: 16, outerPad: 800 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#24282a', lampH: 4.2, lampPad: 10, treeLod: { cap: 2400, max: 360 }, lampOpts: { spacing: 32, kinds: ['footway', 'path', 'pedestrian', 'cycleway'] }, streetTreeOpts: { kinds: ['primary', 'secondary'], prob: 0.8 }, areaTreeOpts: { kinds: ['wood', 'forest', 'park'], density: 1 / 260, conifer: 0.15, exclude: [...(jg ? [jg] : [])] } });
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
        ctx.interactables.push({ x: 30, z: -26, r: 4, label: 'Feed the ducks', use: (s) => { s.ui.toast('🦆 Quack', 'Ducks gather at the south tip of the lake.'); s.sound.play('splat', 0.4); } });
        if (church) ctx.interactables.push({ x: church.x + 6, z: church.z + 6, r: 3, label: 'Strike the toaca (wooden semantron)', use: (s) => { s.sound.play('thump', 0.8); setTimeout(() => s.sound.play('thump', 0.6), 260); setTimeout(() => s.sound.play('thump', 0.9), 520); s.ui.toast('Toaca', 'The wooden board calls to service on feast days.'); } });
        // postcards: the church spire from the lawn (research pose); the nymph with the lake behind
        if (church) { const ic = spV.photo.iconic, dx = ic.x - church.x, dz = ic.z - church.z, L = Math.hypot(dx, dz) || 1, px = church.x + dx / L * 30, pz = church.z + dz / L * 30; ctx.challenge('village-museum', { x: px, z: pz, heading: (Math.atan2(church.x - px, -(church.z - pz)) * 180 / Math.PI + 360) % 360, pitch: 22, r: 10, tol: 28 }); }
        else ctx.challenge('village-museum', { r: 10, tol: 28 });
        ctx.challenge('herastrau-park', { x: nymph.x - 2, z: nymph.z + 24, heading: 355, r: 10, tol: 28, text: 'The Sleeping Nymph with Lake Herăstrău behind' });
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
        ctx.spawns['village-museum'] = { x: spV.spawn.x, z: spV.spawn.z, heading: headingFromBearing(40) };
    },
};
