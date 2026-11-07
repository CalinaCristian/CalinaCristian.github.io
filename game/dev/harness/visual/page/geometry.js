// ============================================================================
//  Visual QA — geometry detectors (run inside the game page).
//  Everything is read from the live scene / world objects and guarded: a missing
//  API becomes a `vqa-api` note instead of a crash. All positions are game metres.
//
//  Detectors (issue types):
//    ribbon-zfight          two carriageway / junction-pad surfaces of different edges overlap in plan with |Δy| < 0.05 m
//    pad-overlap            an edge's carriageway overlaps a junction pad by more than the pad's own seam (4 mm apart → z-fight at range)
//    ribbon-stacked         two road surfaces overlap with 0.05–2.5 m between them (visible "stacked" ribbons / steps)
//    ribbon-flipped         a carriageway quad is inverted / self-intersecting (bow-tie: its triangles fold over each other)
//    ribbon-gap             consecutive ribbons of the same road do not meet (> 0.3 m apart at their shared node)
//    road-hole              a point of the driven lane is not covered by any carriageway / pad
//    surface-above-road     a ground-mesh surface (kerb strip, sidewalk, pad…) sits 3 cm–2.5 m above another road's carriageway
//    marking-off-road       a road-marking triangle is not on any carriageway
//    marking-on-pad         lane markings continue across a junction pad
//    marking-buried         a marking is under (or within 1.5 cm of) another surface → hidden / z-fighting
//    marking-floating       a marking sits > 4.5 cm above every surface under it
//    tunnel-lid-low         the street-level lid / ceiling of a tunnel is less than 3.8 m above its road (dark slab across the road)
//    bridge-underside-buried a bridge deck's underside / fascia goes below the ground (deck lower than its own structure)
//    object-floating        tree / lamp / landmark / station prop base > 0.3 m above the ground or road under it
//    object-sunk            … > 0.5 m below it
//    building-over-road     a building footprint covers part of a carriageway (at a level the road is drawn)
// ============================================================================

const ROAD_Y = 0.24;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

export function pip(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
}
function distSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2; t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
const polyDist = (x, z, P) => { let d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, distSeg(x, z, P[j][0], P[j][1], P[i][0], P[i][1])); return d; };
const area2 = (P) => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return s / 2; };
const centroid = (P) => { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; };
/** Sutherland–Hodgman: subject polygon clipped by a CONVEX clip polygon (both any winding) */
function clipConvex(subject, clip) {
    if (area2(clip) < 0) clip = clip.slice().reverse();
    let out = subject;
    for (let i = 0; i < clip.length && out.length; i++) {
        const a = clip[i], b = clip[(i + 1) % clip.length];
        const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
        const inter = (p, q) => {
            const A1 = b[1] - a[1], B1 = a[0] - b[0], C1 = A1 * a[0] + B1 * a[1];
            const A2 = q[1] - p[1], B2 = p[0] - q[0], C2 = A2 * p[0] + B2 * p[1];
            const d = A1 * B2 - A2 * B1; if (Math.abs(d) < 1e-12) return p;
            return [(B2 * C1 - B1 * C2) / d, (A1 * C2 - A2 * C1) / d];
        };
        const inp = out; out = [];
        for (let k = 0; k < inp.length; k++) {
            const p = inp[k], q = inp[(k + 1) % inp.length];
            const pi = inside(p), qi = inside(q);
            if (pi) { out.push(p); if (!qi) out.push(inter(p, q)); } else if (qi) out.push(inter(p, q));
        }
    }
    return out;
}
/** overlap area + centroid of two polygons given as triangle lists */
function overlap(trisA, trisB) {
    let A = 0, cx = 0, cz = 0;
    for (const ta of trisA) for (const tb of trisB) {
        const c = clipConvex(ta, tb); if (c.length < 3) continue;
        const a = Math.abs(area2(c)); if (a < 1e-4) continue;
        const m = centroid(c); A += a; cx += m[0] * a; cz += m[1] * a;
    }
    return A > 0 ? { area: A, x: cx / A, z: cz / A } : null;
}
function segCross(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

class Grid {
    constructor(cell) { this.c = cell; this.m = new Map(); }
    key(i, j) { return i * 73856093 ^ j * 19349663; }
    insert(x0, z0, x1, z1, it) {
        const c = this.c;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const k = this.key(i, j); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(it);
        }
    }
    each(x0, z0, x1, z1, cb) {
        const c = this.c, seen = new Set();
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const a = this.m.get(this.key(i, j)); if (!a) continue;
            for (const it of a) { if (seen.has(it)) continue; seen.add(it); cb(it); }
        }
    }
}

/** corridor test: is (x,z) within r of the surveyed path? */
export function makeCorridor(points, r) {
    const g = new Grid(Math.max(20, r));
    for (const p of points) g.insert(p[0], p[1], p[0], p[1], p);
    const r2_ = r * r;
    return {
        r, points,
        near(x, z, rr = r) { let f = false; const q = rr * rr; g.each(x - rr, z - rr, x + rr, z + rr, (p) => { if (!f && (p[0] - x) ** 2 + (p[1] - z) ** 2 < q) f = true; }); return f; },
        nearBox(x0, z0, x1, z1) { let f = false; g.each(x0 - r, z0 - r, x1 + r, z1 + r, (p) => { if (!f && p[0] > x0 - r && p[0] < x1 + r && p[1] > z0 - r && p[1] < z1 + r) f = true; }); return f; },
        all: !points.length, _r2: r2_,
    };
}

/** ribbons of the world inside the corridor, with triangles, height function and a grid */
export function ribbonModel(world, corridor) {
    const list = [];
    const grid = new Grid(16);
    for (const rb of world.ribbons || []) {
        const P = rb.poly; if (!P || P.length < 3) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        if (!corridor.all && !corridor.nearBox(x0, z0, x1, z1)) continue;
        const e = rb.e || null, n = rb.node || null;
        const tris = P.length === 4 ? [[P[0], P[1], P[2]], [P[0], P[2], P[3]]] : P.slice(1, -1).map((p, i) => [P[0], p, P[i + 2]]);
        const h = e ? (x, z) => ROAD_Y + e.ya + (e.yb - e.ya) * clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1)
            : (() => { const y = ROAD_Y + 0.004 + (n.y || 0); return () => y; })();
        const it = { rb, e, n, P, tris, h, x0, z0, x1, z1, id: list.length, tunnelDeep: e ? (e.tunnel && Math.max(e.ya, e.yb) < -2) : (n.y || 0) < -2 };
        list.push(it); grid.insert(x0, z0, x1, z1, it);
    }
    const at = (x, z, cb) => grid.each(x, z, x, z, (it) => { if (x >= it.x0 && x <= it.x1 && z >= it.z0 && z <= it.z1 && pip(x, z, it.P)) cb(it); });
    return { list, grid, at };
}

const nameOf = (e) => !e ? '' : (e.name || e.ref || (e.type ? `(${e.type})` : 'unnamed'));
const ribLabel = (it) => it.e ? `${nameOf(it.e)} [edge ${it.e.id}${it.e.bridge ? ', bridge' : ''}${it.e.tunnel ? ', tunnel' : ''}]` : `junction pad (node ${it.n.id}, ${(it.n.allEdges || it.n.edges || []).map(nameOf).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 3).join(' × ')})`;
/** the colour family world.js gives a ribbon (asphaltOf / padAsphalt): unpaved, concrete (US motorway), blend (US ramps fade), tunnel, asphalt */
const surfKey = (it, US, x = null, z = null) => {
    const k0 = (e) => e.unpaved ? 'unpaved' : (US && e.type === 'motorway') ? 'concrete' : (US && e.type === 'motorway_link') ? 'blend' : e.tunnel ? 'tunnel' : 'asphalt';
    // a US ramp fades concrete → asphalt: at the end it shares with a street it is asphalt, at a motorway end concrete
    const k = (e) => {
        const c = k0(e); if (c !== 'blend' || x == null || e.tunnel) return c;
        const n = Math.hypot(e.a.x - x, e.a.z - z) < Math.hypot(e.b.x - x, e.b.z - z) ? e.a : e.b;
        const ks = (n.edges || []).filter(f => f !== e && !f.virtual).map(k0);
        return ks.includes('concrete') ? 'concrete' : ks.includes('asphalt') ? 'asphalt' : 'blend';
    };
    if (it.e) return k(it.e);
    const es = (it.n.edges || []).filter(f => !f.virtual); if (!es.length) return 'asphalt';
    const ks = es.map(k); if (ks.includes('blend')) return 'blend'; if (ks.filter(x => x === 'concrete').length * 2 >= ks.length) return 'concrete';
    return ks.every(x => x === 'tunnel') ? 'tunnel' : 'asphalt';
};
const sharesNode = (a, b) => {
    const na = a.e ? [a.e.a, a.e.b] : [a.n], nb = b.e ? [b.e.a, b.e.b] : [b.n];
    return na.some(x => nb.includes(x));
};

/**
 * Run every geometry detector. `issue(type, severity, msg, {x, z, ...data})` records a finding.
 * opts: { corridor, scene, world, player, maxPerType }
 */
export function geometryDetectors(G, opts) {
    const { world: W, corridor, issue } = opts;
    const US = (G?.city?.id ?? W.cityId ?? W.city?.id) === 'seattle' || !!W.US;
    const T0 = performance.now();
    const counts = {};
    const add = (type, sev, msg, data) => { counts[type] = (counts[type] || 0) + 1; issue(type, sev, msg, data); };
    const model = ribbonModel(W, corridor);
    const R = model.list;
    // ---------------------------------------------------------------- ribbons: flipped / bow-tie quads
    for (const it of R) {
        if (!it.e) continue;
        const e = it.e, [aR, bR, bL, aL] = it.P;
        const dR = (bR[0] - aR[0]) * e.dirx + (bR[1] - aR[1]) * e.dirz, dL = (bL[0] - aL[0]) * e.dirx + (bL[1] - aL[1]) * e.dirz;
        const bow = segCross(aR, bR, bL, aL) || segCross(aR, aL, bR, bL);
        if (dR < -0.05 || dL < -0.05 || bow) {
            const [x, z] = centroid(it.P);
            add('ribbon-flipped', (Math.min(dR, dL) < -1 || bow) ? 'high' : 'medium', `carriageway quad of ${ribLabel(it)} is ${bow ? 'self-intersecting (bow-tie)' : 'inverted'}: its ${dR < dL ? 'right' : 'left'} side runs ${r1(-Math.min(dR, dL))} m backwards (edge ${r1(e.len)} m long; the junction retraction / mitre at its ends is longer than the edge)`, { x, z, edge: e.id, len: r1(e.len), dR: r2(dR), dL: r2(dL) });
        }
    }
    // ---------------------------------------------------------------- ribbons: overlaps (z-fight / stacked)
    const done = new Set();
    for (const a of R) {
        model.grid.each(a.x0, a.z0, a.x1, a.z1, (b) => {
            if (b.id <= a.id || a.x1 < b.x0 || b.x1 < a.x0 || a.z1 < b.z0 || b.z1 < a.z0) return;
            if (a.tunnelDeep !== b.tunnelDeep && (a.tunnelDeep || b.tunnelDeep)) { /* still check heights below */ }
            const k = a.id + ':' + b.id; if (done.has(k)) return; done.add(k);
            const ov = overlap(a.tris, b.tris); if (!ov || ov.area < 0.25) return;
            const ha = a.h(ov.x, ov.z), hb = b.h(ov.x, ov.z), dy = Math.abs(ha - hb);
            if (dy >= 4) return; // a bridge over a road (spec 11: ≥ 5 m clearance; 0.05–4 m is "stacked")
            const adj = sharesNode(a, b);
            const padPair = (!a.e && b.e) || (a.e && !b.e);
            const where = { x: ov.x, z: ov.z, area: r1(ov.area), dy: r2(dy), a: ribLabel(a), b: ribLabel(b), edgeA: a.e?.id, edgeB: b.e?.id, nodeA: a.n?.id, nodeB: b.n?.id };
            if (dy < 0.05) {
                if (padPair && adj) { if (ov.area > 1.5) add('pad-overlap', 'low', `${ribLabel(a.e ? a : b)} runs ${r1(ov.area)} m² into its own junction pad (4 mm apart → z-fight at range)`, where); return; }
                if (adj && a.e && b.e && ov.area < 3) return; // mitre slivers between consecutive pieces of the same road
                // round 2: every carriageway class of one family shares one asphalt colour + world-space UVs, and markings
                // have one owner per overlap → a same-colour overlap is invisible; keep it as low, keep different surfaces graded
                const ka = surfKey(a, US, ov.x, ov.z), kb = surfKey(b, US, ov.x, ov.z), same = ka === kb && ka !== 'blend';
                where.surfaces = `${ka}/${kb}`;
                add('ribbon-zfight', same ? 'low' : ov.area > 6 ? 'high' : ov.area > 1.5 ? 'medium' : 'low', `${ribLabel(a)} and ${ribLabel(b)} overlap over ${r1(ov.area)} m² at the same height (Δy ${r2(dy)} m) → ${same ? 'same asphalt colour (invisible unless markings cross)' : 'different surfaces z-fight (' + where.surfaces + '), the markings of one run across the other'}`, where);
            } else {
                add('ribbon-stacked', ov.area > 4 && dy > 0.12 ? 'high' : 'medium', `${ribLabel(a)} and ${ribLabel(b)} overlap over ${r1(ov.area)} m² with only ${r2(dy)} m between them (spec R11.4: share one surface or ≥ 5 m clearance) → a visible stacked / stepped road surface`, where);
            }
        });
    }
    // ---------------------------------------------------------------- ribbons: gaps between consecutive ribbons of the same road
    const byEdge = new Map(); for (const it of R) if (it.e) byEdge.set(it.e, it);
    const seenNode = new Set();
    for (const it of R) {
        if (!it.e) continue;
        for (const n of [it.e.a, it.e.b]) {
            if (seenNode.has(n) || n.pad) continue;
            const es = (n.allEdges || n.edges || []).filter(f => !f.virtual);
            if (es.length !== 2) continue;
            seenNode.add(n);
            const [e, f] = es, A = byEdge.get(e), B = byEdge.get(f); if (!A || !B) continue;
            const ends = (X, ed) => ed.b === n ? { R: X.P[1], L: X.P[2] } : { R: X.P[0], L: X.P[3] };
            const ea = ends(A, e), fb = ends(B, f);
            const same = (e.b === n && f.a === n) || (e.a === n && f.b === n);
            const pairs = same ? [[ea.R, fb.R], [ea.L, fb.L]] : [[ea.R, fb.L], [ea.L, fb.R]];
            const d = Math.max(...pairs.map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1])));
            if (d > 0.3) {
                const inside = pairs.some(([p]) => pip(p[0], p[1], B.P)) || pairs.some(([, q]) => pip(q[0], q[1], A.P));
                add(inside ? 'ribbon-zfight' : 'ribbon-gap', d > 1.5 ? 'high' : 'medium', inside
                    ? `consecutive ribbons of ${nameOf(e)} / ${nameOf(f)} overlap at node ${n.id}: their corners are ${r1(d)} m apart (mitre fallback) → doubled asphalt + crossing markings`
                    : `gap of ${r1(d)} m between consecutive ribbons of ${nameOf(e)} and ${nameOf(f)} at node ${n.id} (grass / sidewalk shows through the road)`, { x: n.x, z: n.z, node: n.id, edgeA: e.id, edgeB: f.id, gap: r2(d) });
            }
        }
    }
    // ---------------------------------------------------------------- the driven lane must be covered by a surface
    const ends = []; try { for (const n of Object.values(W.graph?.nodes || {})) if (n.mapEnd) ends.push(n); for (const e of W.allEdges || []) for (const n of [e.a, e.b]) if (n.mapEnd && !ends.includes(n)) ends.push(n); } catch { /* ignore */ }
    const nearEnd = (x, z) => ends.some(n => Math.hypot(n.x - x, n.z - z) < 30);
    for (const path of opts.paths || []) {
        let last = -1e9;
        for (let i = 0; i < path.length; i++) {
            const [x, z, y] = path[i];
            let hit = false; model.at(x, z, (it) => { if (!hit && Math.abs(it.h(x, z) - (y ?? it.h(x, z))) < 1.0) hit = true; });
            if (!hit && i - last > 10) { last = i; const me = nearEnd(x, z); add('road-hole', me ? 'low' : 'high', me ? `the surveyed lane runs past the district's map end here (route planned through the end-of-map barrier)` : `the driven lane is not covered by any carriageway or junction pad here (hole in the road: ground / sky shows through)`, { x, z, y: y != null ? r2(y) : null, mapEnd: me }); }
        }
    }
    // ---------------------------------------------------------------- ground / marks meshes of the corridor
    const cells = [];
    W.group.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && /^(ground|marks|solid) /.test(m.name || '') && m.geometry?.attributes?.position) { const ud = m.userData; if (corridor.all || corridor.near(ud.cx ?? 0, ud.cz ?? 0, corridor.r + 190)) cells.push(m); } });
    const tunnelPortal = []; // (unused, kept for future portal checks)
    void tunnelPortal;
    let triN = 0;
    const lumOf = (c, i) => (0.2126 * c[i * 3] + 0.7152 * c[i * 3 + 1] + 0.0722 * c[i * 3 + 2]) / 255;
    for (const m of cells) {
        const kind = m.name.split(' ')[0];
        const pos = m.geometry.attributes.position.array, col = m.geometry.attributes.color?.array, idx = m.geometry.index?.array;
        if (!idx || kind === 'solid') continue;
        for (let t = 0; t < idx.length; t += 3) {
            const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
            const y0 = pos[i0 * 3 + 1], y1 = pos[i1 * 3 + 1], y2 = pos[i2 * 3 + 1];
            if (Math.max(y0, y1, y2) - Math.min(y0, y1, y2) > 0.6) continue; // walls / faces, not flat surfaces
            const ax = pos[i0 * 3], az = pos[i0 * 3 + 2], bx = pos[i1 * 3], bz = pos[i1 * 3 + 2], cx = pos[i2 * 3], cz = pos[i2 * 3 + 2];
            const ar = Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
            if (ar < 0.02) continue;
            const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, my = (y0 + y1 + y2) / 3;
            if (!corridor.all && !corridor.near(mx, mz)) continue;
            triN++;
            // sample points: centroid + three points half-way to the corners (large ribbon triangles partly overlap)
            const pts = [[mx, mz]]; if (ar > 2) pts.push([(mx + ax) / 2, (mz + az) / 2], [(mx + bx) / 2, (mz + bz) / 2], [(mx + cx) / 2, (mz + cz) / 2]);
            const yAt = (x, z) => { // plane through the triangle
                const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) return my;
                const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
                return w0 * y0 + w1 * y1 + (1 - w0 - w1) * y2;
            };
            if (kind === 'marks') {
                const lum = col ? lumOf(col, i0) : 1;
                for (const [x, z] of pts.slice(0, 1)) {
                    const y = yAt(x, z);
                    const hosts = []; model.at(x, z, (it) => hosts.push({ it, h: it.h(x, z) }));
                    if (!hosts.length) {
                        // markings slightly past the asphalt edge (edge lines / mitred inner corners): measure how far
                        let near = Infinity; model.grid.each(x - 3, z - 3, x + 3, z + 3, (it) => { near = Math.min(near, polyDist(x, z, it.P)); });
                        if (near > 0.25 && y > 0.2 && lum > 0.25) add('marking-off-road', near > 1.5 ? 'high' : 'medium', `road marking ${near === Infinity ? 'far from any' : r1(near) + ' m outside the nearest'} carriageway (painted on the sidewalk / grass)`, { x, z, y: r2(y), off: near === Infinity ? null : r2(near) });
                        continue;
                    }
                    const host = hosts.filter(o => y - o.h >= 0.012 && y - o.h <= 0.05);
                    const above = hosts.filter(o => o.h > y - 0.012 && o.h - y < 0.6);
                    if (above.length) { const o = above[0]; add('marking-buried', 'medium', `road marking at y=${r2(y)} is ${o.h >= y ? 'under' : 'level with'} ${ribLabel(o.it)} (surface y=${r2(o.h)}) → hidden / flickering markings`, { x, z, y: r2(y), surf: r2(o.h), other: ribLabel(o.it) }); continue; }
                    if (!host.length) { const top = Math.max(...hosts.map(o => o.h)); if (y - top > 0.05 && y - top < 3) add('marking-floating', y - top > 0.3 ? 'high' : 'medium', `road marking floats ${r2(y - top)} m above the road surface under it (${ribLabel(hosts.find(o => o.h === top).it)})`, { x, z, y: r2(y), surf: r2(top) }); continue; }
                    const pad = host.find(o => !o.it.e);
                    if (pad && host.every(o => !o.it.e) && polyDist(x, z, pad.it.P) > 0.4 && lum > 0.4) add('marking-on-pad', 'low', `road marking painted inside ${ribLabel(pad.it)} (lane lines / stop lines continue across the junction)`, { x, z, node: pad.it.n.id });
                }
            } else if (my > 0.1) {
                // ground surfaces (asphalt / sidewalk / kerb / pads): anything 3 cm–2.5 m above ANOTHER road's carriageway is visible
                for (const [x, z] of pts) {
                    const y = yAt(x, z);
                    let worst = null;
                    model.at(x, z, (it) => {
                        const h = it.h(x, z), d = y - h;
                        if (d > 0.03 && d < 2.5 && (!worst || d > worst.d)) worst = { it, d, h };
                    });
                    if (worst) {
                        const lum = col ? lumOf(col, i0) : 0.5;
                        const what = Math.abs(worst.d - 0.13) < 0.02 ? 'kerb strip' : Math.abs(worst.d - 0.004) < 0.01 ? 'junction pad' : lum > 0.3 ? 'sidewalk / light surface' : 'asphalt / dark surface';
                        add('surface-above-road', worst.d > 0.25 ? 'high' : 'medium', `a ${what} (y=${r2(y)}) lies ${r2(worst.d)} m above ${ribLabel(worst.it)} (y=${r2(worst.h)}) → a strip / slab across the carriageway`, { x, z, y: r2(y), surf: r2(worst.h), what });
                        break;
                    }
                }
            }
        }
    }
    // ---------------------------------------------------------------- tunnels / bridges structure vs. their road
    const edgesSeen = new Set();
    for (const it of R) {
        const e = it.e; if (!e || edgesSeen.has(e)) continue; edgesSeen.add(e);
        if (e.tunnel && e.lidded !== false) { // (world builds a lid / ceiling only on `lidded` tunnels > 4.5 m deep; shallow ones are open trenches)
            // world.js draws a lid at street level (y 0.06) over the whole tunnel edge and a ceiling at road + 5.2 m
            for (let t = 0.05; t <= 0.95; t += 0.15) {
                const yRoad = ROAD_Y + e.ya + (e.yb - e.ya) * t;
                const clear = 0.06 - yRoad;
                if (clear < 3.8 && clear > -0.3) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
                    add('tunnel-lid-low', clear < 2 ? 'high' : 'medium', `tunnel ${nameOf(e)} [edge ${e.id}] is only ${r2(-yRoad + ROAD_Y)} m below street level here: its street-level lid (dark ground slab) is ${r2(clear)} m above the road → the lid / ceiling cuts across the view / the road looks black`, { x, z, edge: e.id, roadY: r2(yRoad), clearance: r2(clear) });
                    break;
                }
            }
        }
        if (e.bridge && Math.max(e.ya, e.yb) > 0.3) {
            const lo = Math.min(e.ya, e.yb) + ROAD_Y - 1.1;
            if (lo < -0.05) add('bridge-underside-buried', lo < -0.6 ? 'medium' : 'low', `bridge ${nameOf(e)} [edge ${e.id}] starts at ${r2(Math.min(e.ya, e.yb))} m: its 1.1 m deck fascia / underside goes ${r2(-lo)} m into the ground (concrete slab sticking through the street at the bridge ends)`, { x: e.ya < e.yb ? e.a.x : e.b.x, z: e.ya < e.yb ? e.a.z : e.b.z, edge: e.id });
        }
    }
    // ---------------------------------------------------------------- objects: floating / sunk bases
    const groundRef = (x, z, base) => {
        const cands = [0.02, 0.15, ROAD_Y];
        try { for (const h of W.surfacesAt(x, z)) cands.push(h); } catch { /* ignore */ }
        model.at(x, z, (it) => cands.push(it.h(x, z)));
        let best = cands[0]; for (const c of cands) if (Math.abs(c - base) < Math.abs(best - base)) best = c;
        return best;
    };
    const checkBase = (what, x, z, base, extra = {}) => {
        if (!corridor.all && !corridor.near(x, z)) return;
        const g = groundRef(x, z, base), d = base - g;
        if (d > 0.3) add('object-floating', d > 1 ? 'high' : 'medium', `${what} floats ${r2(d)} m above the surface under it (base y=${r2(base)}, ground/road y=${r2(g)})`, { x, z, base: r2(base), ground: r2(g), ...extra });
        else if (d < -0.5) add('object-sunk', d < -1.5 ? 'high' : 'medium', `${what} is sunk ${r2(-d)} m into the surface under it (base y=${r2(base)}, ground/road y=${r2(g)})`, { x, z, base: r2(base), ground: r2(g), ...extra });
    };
    const THREE = opts.THREE;
    const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    let objN = 0;
    // tree trunks (instanced, per cell)
    for (const m of W.vegetation?.treeTrunkMeshes || []) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const minY = m.geometry.boundingBox.min.y;
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.decompose(V, Q, S); objN++; checkBase('tree', V.x, V.z, V.y + minY * S.y, { kind: 'tree' }); }
    }
    // street lamps (world.lamps: post base at l.y)
    for (const l of W.lamps || []) { if (l && l.y !== undefined) { objN++; checkBase(`street lamp${l.osm ? ' (OSM)' : ''}`, l.x, l.z, l.y, { kind: 'lamp' }); } }
    // landmarks, POI props, stations, cameras: every top-level object's world box base vs ground at its centre
    const B = new THREE.Box3();
    const groups = [];
    W.group.traverse((o) => { if (o.parent && /^(landmarks|pois)$/.test(o.parent.name || '')) groups.push([o, o.parent.name]); });
    for (const o of opts.extraGroups || []) for (const c of o.children || []) groups.push([c, 'props']);
    for (const [o, gname] of groups) {
        try {
            B.setFromObject(o); if (B.isEmpty()) continue;
            const x = (B.min.x + B.max.x) / 2, z = (B.min.z + B.max.z) / 2;
            if (B.max.x - B.min.x > 400) continue;
            objN++; checkBase(`${gname === 'landmarks' ? 'landmark' : 'prop'} "${o.name || o.userData?.id || o.type}"`, x, z, B.min.y, { kind: gname, name: o.name || null, size: [r1(B.max.x - B.min.x), r1(B.max.y - B.min.y), r1(B.max.z - B.min.z)] });
        } catch { /* ignore */ }
    }
    // ---------------------------------------------------------------- buildings covering a carriageway
    let bN = 0;
    for (const c of W.buildings || []) {
        if (!c.poly || c.wall) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of c.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        if (!corridor.all && !corridor.nearBox(x0, z0, x1, z1)) continue;
        bN++;
        const hits = new Map();
        model.grid.each(x0, z0, x1, z1, (it) => {
            if (it.tunnelDeep || it.x1 < x0 || it.x0 > x1 || it.z1 < z0 || it.z0 > z1) return;
            const sx0 = Math.max(x0, it.x0), sx1 = Math.min(x1, it.x1), sz0 = Math.max(z0, it.z0), sz1 = Math.min(z1, it.z1);
            const st = 0.6; let n = 0, px = 0, pz = 0;
            for (let x = sx0 + st / 2; x < sx1; x += st) for (let z = sz0 + st / 2; z < sz1; z += st) {
                if (!pip(x, z, it.P) || !pip(x, z, c.poly)) continue;
                const h = it.h(x, z); if (c.h !== undefined && h > c.h + 0.5) continue; // road deck above the roof
                n++; px += x; pz += z;
            }
            if (n * st * st >= 0.7) hits.set(it, { a: n * st * st, x: px / n, z: pz / n });
        });
        for (const [it, o] of hits) add('building-over-road', o.a > 6 ? 'high' : 'medium', `${c.poi ? 'CV building' : 'building'} footprint (h ${r1(c.h ?? 0)} m) covers ${r1(o.a)} m² of ${ribLabel(it)}`, { x: o.x, z: o.z, area: r1(o.a), road: ribLabel(it) });
    }
    return { counts, ms: Math.round(performance.now() - T0), ribbons: R.length, triangles: triN, objects: objN, buildings: bN, cells: cells.length };
}
