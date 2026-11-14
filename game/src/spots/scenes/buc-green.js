// ============================================================================
//  Shared context helpers for the north-Bucharest tourist scenes (Arcul de
//  Triumf, Herăstrău, Spring Palace), from the 2026-11-12 OSM / Street View
//  fidelity review (game/research/bucharest-spots.md, "Rules shared by the Bucharest scenes"):
//   - parkWoods: the mature canopy of mapped parks / gardens. OSM maps the park
//     polygons but almost none of their trees; the count and the positions are
//     an estimate (deterministic scatter), kept clear of every mapped building,
//     way, pitch, playground, fountain and water body.
//   - dropMedianTrees: generated street trees that land between the two
//     carriageways of a mapped dual road or on a mapped traffic island.
//   - farCanopy: every tree beyond the original near budget as a cheap, chunked, frustum-culled far tree
//     (opt-in `lean`: a one-lump 26-triangle far tree beyond a given distance, round 3).
//   - businessSigns: a plain name board for every mapped, named business /
//     embassy / museum (no invented names; colours are procedural).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { rng, inPoly, polyBox, centroid, hash2 } from '../kit.js';
import { roadWidth, isMotorRoad } from '../osm.js';
import { signAtlas } from '../buc.js';

const FOOT_W = { footway: 2.2, path: 1.6, cycleway: 2.6, steps: 2.4, bridleway: 2, track: 3, pedestrian: 5 };
const HARD_AREA = (a) => a.leisure === 'pitch' || a.leisure === 'stadium' || a.leisure === 'playground' || a.leisure === 'swimming_pool' || a.leisure === 'track' || a.leisure === 'dog_park'
    || a.amenity === 'fountain' || a.amenity === 'parking' || a.amenity === 'theatre' || a.natural === 'water' || a.natural === 'scree' || a.highway === 'pedestrian' || a.area_highway
    || a.leisure === 'outdoor_seating' || a.landuse === 'construction';

function segDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return [Math.hypot(x - ax - dx * t, z - az - dz * t), ax + dx * t, az + dz * t]; }

/** (x, z, margin) → true when the point is clear of every mapped way (its own width), building and hard-surfaced area */
export function greenClearance(d, { roadPad = 3.2, footPad = 1.1, buildingPad = 2.2, extraHard = [] } = {}) {
    const cell = 32, grid = new Map(), key = (i, j) => i * 92821 + j;
    for (const w of d.ways || []) {
        if (!w.pts || w.pts.length < 2 || w.tunnel || w.k === 'fence' || w.k === 'wall') continue;
        const motor = isMotorRoad(w.k); if (!motor && !(w.k in FOOT_W)) continue;
        const hw = motor ? roadWidth(w) / 2 + (w.k === 'service' ? 0.6 : roadPad) : FOOT_W[w.k] / 2 + footPad;
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], seg = [ax, az, bx, bz, hw];
            for (let gi = Math.floor((Math.min(ax, bx) - hw - 4) / cell); gi <= Math.floor((Math.max(ax, bx) + hw + 4) / cell); gi++)
                for (let gj = Math.floor((Math.min(az, bz) - hw - 4) / cell); gj <= Math.floor((Math.max(az, bz) + hw + 4) / cell); gj++) { const k = key(gi, gj); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(seg); }
        }
    }
    const solids = [];
    const solid = (poly, pad) => { const q = polyBox(poly); solids.push({ poly, x0: q.x0 - pad, z0: q.z0 - pad, x1: q.x1 + pad, z1: q.z1 + pad, pad }); };
    for (const b of d.buildings || []) if (b.poly?.length > 2) solid(b.poly, buildingPad);
    for (const a of d.areas || []) if (a.poly?.length > 2 && HARD_AREA(a)) solid(a.poly, 1);
    for (const poly of extraHard) solid(poly, 1);
    const nearEdge = (x, z, poly, pad) => { for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segDist(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1])[0] < pad) return true; return false; };
    return (x, z, margin = 0) => {
        const b = grid.get(key(Math.floor(x / cell), Math.floor(z / cell)));
        if (b) for (const [ax, az, bx, bz, hw] of b) if (segDist(x, z, ax, az, bx, bz)[0] < hw + margin) return false;
        for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && (inPoly(x, z, s.poly) || nearEdge(x, z, s.poly, s.pad))) return false;
        return true;
    };
}

/**
 * mature trees inside mapped green polygons. polys: [[x, z], …][]; density(x, z) → trees per m² (0 = none);
 * `min` keeps the trunks apart. Returns the tree records (not yet pushed to ctx.trees).
 */
export function parkWoods(ctx, polys, { density = () => 1 / 120, seed = 41, conifer = 0.08, scale = [1.15, 1.85], min = 5.5, clear = null, inside = null, bounds = null, max = 6000 } = {}) {
    const r = rng(seed), out = [], cell = min, occ = new Map(), key = (i, j) => i * 92821 + j, free = clear || greenClearance(ctx.data);
    const peak = 1 / (min * min * 1.1);
    for (const poly of polys) {
        if (!poly || poly.length < 3) continue;
        let q = polyBox(poly); if (bounds) q = { x0: Math.max(q.x0, bounds.x0), z0: Math.max(q.z0, bounds.z0), x1: Math.min(q.x1, bounds.x1), z1: Math.min(q.z1, bounds.z1) };
        if (q.x1 <= q.x0 || q.z1 <= q.z0) continue;
        const n = Math.round((q.x1 - q.x0) * (q.z1 - q.z0) * peak);
        for (let i = 0; i < n && out.length < max; i++) {
            const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0), keep = r(), kind = r(), s = r();
            if (keep > density(x, z) / peak || !inPoly(x, z, poly) || (inside && !inside(x, z)) || !free(x, z)) continue;
            const gi = Math.floor(x / cell), gj = Math.floor(z / cell); let hit = false;
            for (let a = -1; a <= 1 && !hit; a++) for (let b = -1; b <= 1 && !hit; b++) { const o = occ.get(key(gi + a, gj + b)); if (o && Math.hypot(o[0] - x, o[1] - z) < min) hit = true; }
            if (hit) continue; occ.set(key(gi, gj), [x, z]);
            out.push({ x, z, kind: kind < conifer ? 'con' : 'broad', s: scale[0] + s * (scale[1] - scale[0]), woods: true });
        }
    }
    return out;
}

/**
 * remove generated trees that stand between two carriageways of a mapped dual road (within `reach` of both kerbs, on
 * opposite sides of the trunk), on a mapped traffic island, or on an unmapped junction island ringed by carriageways. `keep(t)` protects source trees. Returns the count removed.
 */
export function dropMedianTrees(ctx, { reach = 7.5, island = 34, keep = () => false } = {}) {
    const d = ctx.data, roads = d.ways.filter((w) => isMotorRoad(w.k) && w.k !== 'service' && w.oneway === 'yes' && !w.tunnel && w.pts?.length > 1).map((w) => ({ w, hw: roadWidth(w) / 2, q: polyBox(w.pts) }));
    const islands = d.areas.filter((a) => a.area_highway === 'traffic_island' && a.poly?.length > 2).map((a) => a.poly);
    const before = ctx.trees.length;
    ctx.trees = ctx.trees.filter((t) => {
        if (keep(t)) return true;
        if (islands.some((p) => inPoly(t.x, t.z, p))) return false;
        // an unmapped junction island: carriageway in (nearly) every direction within the island radius
        if (island > 0) { let hit = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); for (let q = 2; q <= island; q += 1.5) if (ctx.onRoad(t.x + c * q, t.z + sn * q, 0)) { hit++; break; } } if (hit >= 14) return false; }
        const near = [];
        for (const { w, hw, q } of roads) {
            const R = hw + reach; if (t.x < q.x0 - R || t.x > q.x1 + R || t.z < q.z0 - R || t.z > q.z1 + R) continue;
            let best = null; for (let i = 1; i < w.pts.length; i++) { const s = segDist(t.x, t.z, w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1]); if (!best || s[0] < best[0]) best = s; }
            if (best && best[0] < R && best[0] > 1e-3) near.push([(best[1] - t.x) / best[0], (best[2] - t.z) / best[0]]);
        }
        for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) if (near[i][0] * near[j][0] + near[i][1] * near[j][1] < -0.5) return false;
        return true;
    });
    return before - ctx.trees.length;
}

/**
 * thin ctx.trees to `budget` evenly over the whole scene instead of letting the loader's cap drop everything beyond a
 * hard rectangle round the spot extents: deterministic per-tree hash; trees outside `core(x, z)` keep `far` × the core share;
 * `keep(t)` trees always stay. Returns { before, after }.
 */
export function thinTrees(ctx, { budget = 3200, core = () => true, far = 0.55, keep = () => false } = {}) {
    const before = ctx.trees.length; if (before <= budget) return { before, after: before };
    let fixed = 0, nc = 0, nf = 0; for (const t of ctx.trees) { if (keep(t)) fixed++; else if (core(t.x, t.z)) nc++; else nf++; }
    const pc = Math.min(1, (budget - fixed) / (nc + far * nf || 1)), pf = pc * far;
    ctx.trees = ctx.trees.filter((t) => keep(t) || hash2(t.x * 0.37 + 11.3, t.z * 0.41 - 7.9) < (core(t.x, t.z) ? pc : pf));
    return { before, after: ctx.trees.length };
}

const SIGN_KIND = (p) => (p.diplomatic || p.office === 'diplomatic' || /^(Ambasada|Consulatul|Embassy)/i.test(p.name || '') ? 'embassy' : /^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten)$/.test(p.amenity || '') ? 'food'
    : p.tourism === 'museum' || p.tourism === 'gallery' || p.amenity === 'theatre' ? 'culture' : p.tourism === 'hotel' || p.shop || p.office ? 'trade' : null);
/** façade point of the building that contains (px, pz) on the ray toward the street point (qx, qz); buildings outside the
 *  walkable extent (`backdrop`) count too: an embassy across the street still carries its name */
function facadeOf(d, px, pz, qx, qz) {
    for (const b of d.buildings) {
        if (b.part || !b.poly || b.poly.length < 3) continue; const q = b._bb || (b._bb = polyBox(b.poly));
        if (px < q.x0 || px > q.x1 || pz < q.z0 || pz > q.z1 || !inPoly(px, pz, b.poly)) continue;
        let best = null; const p = b.poly, dx = qx - px, dz = qz - pz;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], ex = p[i][0] - ax, ez = p[i][1] - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t >= 0 && t <= 60 && u >= 0 && u <= 1 && (!best || t < best.t)) { const L = Math.hypot(ex, ez); best = { t, x: px + dx * t, z: pz + dz * t, ex: ex / L, ez: ez / L, ax, az, L, s: u * L }; }
        }
        if (!best) return null;
        let nx = best.ez, nz = -best.ex; if ((qx - best.x) * nx + (qz - best.z) * nz < 0) { nx = -nx; nz = -nz; }
        return { x: best.x, z: best.z, nx, nz, b, ax: best.ax, az: best.az, ex: best.ex, ez: best.ez, L: best.L, s: best.s };
    }
    return null;
}
/** keep a board of width w on its wall: slide its centre along the hit edge (and narrow it on a short edge) so it never
 *  hangs past a corner (r3-builder-spots-3: the Kuwait embassy board hung half past the villa's west corner) */
function boardOnWall(f, w, margin = 0.25) {
    const room = f.L - 2 * margin; if (room <= 0.6) return { x: f.x, z: f.z, w: Math.min(w, Math.max(0.6, f.L)) };
    const ww = Math.min(w, room), s = Math.min(Math.max(f.s, margin + ww / 2), f.L - margin - ww / 2);
    return { x: f.ax + f.ex * s, z: f.az + f.ez * s, w: ww };
}
const SIGN_LOOK = { embassy: { bg: '#8a6f3a', fg: '#fbf3dc', h: 0.5, y: 2.1 }, food: { bg: '#27352d', fg: '#f3e9cf', h: 0.62, y: 3.05 }, culture: { bg: '#e9e4d6', fg: '#2a2622', h: 0.62, y: 3.05 }, trade: { bg: '#2a2f38', fg: '#eef0f2', h: 0.56, y: 3.05 } };

/**
 * name boards for the mapped, named businesses / embassies / museums: on the façade of their building that faces the
 * nearest mapped road or path. Unnamed and façade-less (open-air) entries get nothing. Returns the placed records.
 */
export function businessSigns(ctx, { inside = null, skip = new Set(), name = 'business-signs' } = {}) {
    const d = ctx.data, g = ctx.ground, signs = [], placed = [], seen = new Set();
    const streets = d.ways.filter((w) => (isMotorRoad(w.k) || w.k === 'pedestrian' || w.k === 'footway') && !w.tunnel && w.pts?.length > 1);
    const nearestStreet = (x, z) => { let best = null; for (const w of streets) for (let i = 1; i < w.pts.length; i++) { const s = segDist(x, z, w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1]); if (!best || s[0] < best[0]) best = s; } return best; };
    const put = (id, text, kind, x, z) => {
        const label = String(text || '').trim(); if (!label || seen.has(label) || skip.has(id) || ctx.skipBuildings.has(id) || (inside && !inside(x, z))) return;
        const st = nearestStreet(x, z); if (!st || st[0] > 90) return;
        const f = facadeOf(d, x, z, st[1], st[2]); if (!f || ctx.skipBuildings.has(f.b.id)) return;
        const L = SIGN_LOOK[kind], q = boardOnWall(f, Math.min(7, Math.max(1.6, label.length * 0.26 + 0.8))), w = q.w;
        signs.push({ x: q.x + f.nx * 0.09, y: g.heightAt(q.x + f.nx * 0.5, q.z + f.nz * 0.5) + L.y, z: q.z + f.nz * 0.09, yaw: Math.atan2(f.nx, f.nz), w, h: L.h, text: label, bg: L.bg, fg: L.fg, border: kind === 'embassy' ? 'rgba(255,240,200,0.7)' : false });
        seen.add(label); placed.push({ id, name: label, kind, x: q.x, z: q.z });
    };
    for (const b of d.buildings) {
        const kind = b.name && !b.part && SIGN_KIND(b); if (!kind) continue;
        let [x, z] = centroid(b.poly); if (!inPoly(x, z, b.poly)) { x = (b.poly[0][0] + b.poly[1][0]) / 2 * 0.97 + x * 0.03; z = (b.poly[0][1] + b.poly[1][1]) / 2 * 0.97 + z * 0.03; }
        put(b.id, b.name, kind, x, z);
    }
    for (const p of d.pois) { const kind = p.name && SIGN_KIND(p); if (kind) put(p.id, p.name, kind, p.x, p.z); }
    const mesh = signAtlas(signs, { name, night: 0.5 }); if (mesh) ctx.add(mesh);
    return placed;
}

// ---------------------------------------------------------------------------- cheap far canopy
const FAR_BROAD = ['#4f8a3c', '#5d9440', '#679c48', '#4a7f39', '#5a8f3e', '#6f9e4a', '#55893f'], FAR_CON = ['#2f5d3a', '#356640', '#2b5434', '#3a6a45'];
let FAR_GEO = null, FAR_LEAN = null;
function farGeos(lean = false) {
    if (lean) return FAR_LEAN || (FAR_LEAN = leanGeos());
    if (FAR_GEO) return FAR_GEO;
    // two lumpy icosahedra like the stock far crown (40 triangles), vertices nudged by a fixed hash so it does not read as a gem
    const lump = (sx, sy, sz, x, y, z) => { const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (hash2(p.getX(i) * 3.1 + sx, p.getY(i) * 2.7 + p.getZ(i) * 1.9) - 0.5) * 0.3; p.setXYZ(i, p.getX(i) * k * sx + x, p.getY(i) * k * sy + y, p.getZ(i) * k * sz + z); } return g; };
    const crown = (() => { const a = lump(3.1, 2.7, 3.1, 0, 5.6, 0), b = lump(2.1, 1.8, 2.1, 0.5, 7.3, 0.2), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3)); a.dispose(); b.dispose(); return g; })();
    const cone = new THREE.ConeGeometry(2.6, 9.6, 5, 1, true); cone.translate(0, 6.6, 0);                                   // 5 triangles
    const trunk = new THREE.CylinderGeometry(0.14, 0.24, 4.6, 3, 1, true); trunk.translate(0, 2.3, 0);                      // 6 triangles
    // crown + trunk in one geometry (one draw call per chunk): white crown vertices take the instance colour; the trunk's
    // vertex colour turns the instance green into bark brown
    const join = (a, b) => { const out = new THREE.BufferGeometry(), pos = [], nor = [], col = []; for (const [g0, c] of [[a, [1, 1, 1]], [b, [1.35, 0.42, 0.7]]]) { const g = g0.toNonIndexed(); g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(...c); g.dispose(); }
        out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.computeBoundingSphere(); return out; };
    FAR_GEO = { broad: join(crown, trunk), con: join(cone, trunk) }; for (const g of [crown, cone, trunk]) g.dispose();
    return FAR_GEO;
}
// opt-in lean far crown (round 3): ONE lumpy icosahedron sized over the two-lump outline (20 + 6 triangles instead of
// 40 + 6), so a scene can keep its whole estimated park density beyond the near trees at about the old frame cost
function leanGeos() {
    const base = farGeos(false), g0 = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), p = g0.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (hash2(p.getX(i) * 3.1 + 3.3, p.getY(i) * 2.7 + p.getZ(i) * 1.9) - 0.5) * 0.3; p.setXYZ(i, p.getX(i) * k * 3.3, p.getY(i) * k * 3.2 + 6.1, p.getZ(i) * k * 3.3); }
    const trunk = new THREE.CylinderGeometry(0.14, 0.24, 4.6, 3, 1, true); trunk.translate(0, 2.3, 0);
    const out = new THREE.BufferGeometry(), pos = [], nor = [], col = [];
    for (const [g1, c] of [[g0, [1, 1, 1]], [trunk.toNonIndexed(), [1.35, 0.42, 0.7]]]) { g1.computeVertexNormals(); pos.push(...g1.attributes.position.array); nor.push(...g1.attributes.normal.array); for (let i = 0; i < g1.attributes.position.count; i++) col.push(...c); g1.dispose(); }
    trunk.dispose(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.computeBoundingSphere();
    return { broad: out, con: base.con };
}
/**
 * The stock tree builder draws every tree every frame (its LOD meshes are not frustum-culled) at about 100 triangles
 * plus the shadow pass. Keep only the `near` trees closest to the walkable extents there (the original budget) and
 * draw all the others as cheap far canopy: one 40-triangle crown (5 for a conifer) + a 6-triangle trunk, in one mesh, instanced per
 * `cell`-metre chunk so that whole chunks frustum-cull, no shadow casting. Crowns are named `treeCrowns…`, so the
 * renderer gives them the same season / weather treatment. Trunk colliders are kept. Call it last in the scene build.
 * Returns { near, far, chunks }.
 */
export function farCanopy(ctx, { near = 1400, cell = 224, keep = () => false, size = 1.45, lean = false } = {}) {
    const boxes = Object.values(ctx.data.spots).map((s) => polyBox(s.extent?.polygon?.length ? s.extent.polygon : [[-150, -150], [150, 150]]));
    const dist = (t) => Math.min(...boxes.map((b) => Math.hypot(Math.max(0, b.x0 - t.x, t.x - b.x1), Math.max(0, b.z0 - t.z, t.z - b.z1))));
    const plain = (t) => !keep(t) && !t.c && !t.sy && (!t.kind || t.kind === 'broad' || t.kind === 'con');
    // inside the extents (distance 0) the trees round the spawns and postcard poses stay in the stock builder first
    const focus = [...Object.values(ctx.spawns), ...ctx.challenges].filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.z));
    const pull = (t) => (focus.length ? Math.min(...focus.map((p) => Math.hypot(p.x - t.x, p.z - t.z))) * 0.3 : 0);
    const order = ctx.trees.filter(plain).map((t) => [dist(t) + pull(t), t]).sort((a, b) => a[0] - b[0]);
    const fixed = ctx.trees.length - order.length, far = new Set(order.slice(Math.max(0, near - fixed)).map((e) => e[1]));
    if (!far.size) return { near: ctx.trees.length, far: 0, chunks: 0 };
    ctx.trees = ctx.trees.filter((t) => !far.has(t));
    // lean: false | true (every far tree) | metres beyond the walkable extents from which the one-lump crown is used
    const G = farGeos(false), GL = lean === false ? null : farGeos(true), leanFrom = lean === true ? 0 : +lean, grp = new THREE.Group(); grp.name = 'far-canopy';
    let nLean = 0;
    const mats = { broad: new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), con: new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }) };
    mats.broad.name = mats.con.name = 'treeCrowns';
    const cells = new Map();
    for (const t of far) {
        if (ctx.onRoad(t.x, t.z, 0.2)) continue;
        const thin = GL && t.kind !== 'con' && dist(t) >= leanFrom; if (thin) nLean++;
        const k = Math.floor(t.x / cell) + ':' + Math.floor(t.z / cell) + ':' + (t.kind === 'con' ? 'con' : thin ? 'lean' : 'broad'); let L = cells.get(k); if (!L) cells.set(k, L = []); L.push(t);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let n = 0;
    for (const [k, L] of cells) {
        const con = k.endsWith(':con'), crown = new THREE.InstancedMesh(con ? G.con : k.endsWith(':lean') ? GL.broad : G.broad, con ? mats.con : mats.broad, L.length);
        crown.name = 'treeCrowns far ' + (con ? 'conifer' : 'broad'); crown.userData.conifer = con;
        L.forEach((t, i) => {
            const h = hash2(t.x, t.z), s = con ? (t.s || 1) : size * (0.86 + h * 0.26), y = ctx.ground.heightAt(t.x, t.z) - 0.05;
            m4.compose(new THREE.Vector3(t.x, y, t.z), q.setFromAxisAngle(up, h * 6.28), new THREE.Vector3(s * (0.9 + hash2(t.z, t.x) * 0.25), s, s));
            crown.setMatrixAt(i, m4); crown.setColorAt(i, col.set((con ? FAR_CON : FAR_BROAD)[Math.floor(h * 97) % (con ? FAR_CON : FAR_BROAD).length]));
            ctx.circle(t.x, t.z, 0.3 * s, 6);
        });
        for (const m of [crown]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.computeBoundingBox(); m.castShadow = false; m.receiveShadow = false; m.frustumCulled = true; grp.add(m); }
        n += L.length;
    }
    ctx.add(grp);
    return { near: ctx.trees.length, far: n, chunks: cells.size, ...(GL ? { lean: nLean, leanFrom } : {}) };
}

/**
 * drop zero-area triangles (and repair zero-length normals) in every mesh under `root`: the canonical Casa Presei
 * landmark model carries 4 degenerate triangles that the spot audit reports as bad geometry. Returns the count removed.
 */
export function dropDegenerateTriangles(root) {
    let removed = 0;
    root.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return;
        const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, P = src.attributes.position, keep = [];
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), faceN = [];
        for (let i = 0; i < P.count; i += 3) { a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2); n.crossVectors(b.sub(a), c.sub(a)); if (n.length() > 1e-9) { keep.push(i); faceN.push(n.clone().normalize()); } }
        const N = src.attributes.normal; let zero = false;
        if (N) for (let i = 0; i < N.count && !zero; i++) if (Math.hypot(N.getX(i), N.getY(i), N.getZ(i)) < 1e-6) zero = true;
        if (keep.length * 3 === P.count && !zero) { if (src !== o.geometry) src.dispose(); return; }
        const g = new THREE.BufferGeometry();
        for (const [name, at] of Object.entries(src.attributes)) { const sz = at.itemSize, arr = new at.array.constructor(keep.length * 3 * sz); keep.forEach((i, k) => { for (let v = 0; v < 3; v++) for (let q = 0; q < sz; q++) arr[(k * 3 + v) * sz + q] = at.array[(i + v) * sz + q]; }); g.setAttribute(name, new THREE.BufferAttribute(arr, sz, at.normalized)); }
        const GN = g.attributes.normal; if (GN) for (let i = 0; i < GN.count; i++) if (Math.hypot(GN.getX(i), GN.getY(i), GN.getZ(i)) < 1e-6) { const f = faceN[Math.floor(i / 3)]; GN.setXYZ(i, f.x, f.y, f.z); }
        removed += P.count / 3 - keep.length; if (src !== o.geometry) src.dispose(); o.geometry.dispose(); o.geometry = g;
    });
    return removed;
}
