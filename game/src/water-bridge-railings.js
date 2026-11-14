// Street-level bridges over water whose centre line no water polygon covers.
//
// OSM mappers often end the two water polygons at the outline of the bridge structure (Strada Petricani over the
// Colentina between Lacul Tei and Lacul Plumbuita, w8208289: the lake outlines stop 25-30 m from the road's centre line,
// at the man_made=bridge outline w902027552). world.js only fences a bridge whose centre line is over a water polygon
// (`edge.overWater`), so such a bridge was drawn as an ordinary street with open water beside its sidewalks.
// This pass gives every such run a pedestrian railing on the outer edge of both sidewalks, where the real bridge has its
// railing / parapet (reference checked 2026-11-12: steel picket railing behind the east sidewalk). Nothing is moved and
// no deck height is changed: the bridge stays level with the street, as it is in reality.
//
// A run = the consecutive bridge edges of one source road. It qualifies when it is at street level, not already a
// water bridge, and water lies within `reachM` of the centre line on BOTH sides at the middle of the run.
function streetLevelWaterBridgeRuns(edges, isWater, { reachM = 36, maxLevelM = 0.3 } = {}) {
    const byRoad = new Map();
    for (const e of edges) {
        if (!e.bridge || e.virtual || e.tunnel || e.overWater || Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) > maxLevelM) continue;
        if (!byRoad.has(e.road)) byRoad.set(e.road, []);
        byRoad.get(e.road).push(e);
    }
    const runs = [];
    for (const [road, list] of byRoad) {
        const mx = list.reduce((s, e) => s + (e.a.x + e.b.x) / 2, 0) / list.length, mz = list.reduce((s, e) => s + (e.a.z + e.b.z) / 2, 0) / list.length;
        const mid = list.reduce((best, e) => { const d = Math.hypot((e.a.x + e.b.x) / 2 - mx, (e.a.z + e.b.z) / 2 - mz); return !best || d < best.d ? { e, d } : best; }, null).e;
        const side = s => { for (let d = 8; d <= reachM; d += 2) if (isWater(mx + mid.nx * s * d, mz + mid.nz * s * d)) return d; return null; };
        const right = side(1), left = side(-1);
        if (right === null || left === null) continue;
        runs.push({ road, edges: list, waterRightM: right, waterLeftM: left });
    }
    return runs;
}

// Reviewed street-level bridges over mapped water (edge.overWater) whose outer sidewalk railing was seen on a panorama
// (bridge-guards.js rows with `outer`): the railing stands on the outer edge of each sidewalk, like the inferred one above.
// 'picket-posts' (Podul Grozăvești, panorama 44.443114, 26.060816 h80, 2026-11-13): square concrete posts with grey steel
// picket panels between them. Post spacing, picket pitch and heights are estimates from the panorama, not measurements.
// Everything is in the near-only detail layer (no shadow pass); pedestrians are held by overlapping prop colliders.
export function emitReviewedStreetBridgeRailings({ edges, rowOf, widthSide, topAt, cellOf, addCollider, rgb }) {
    const out = { pieces: 0, lengthM: 0, ways: [] };
    for (const e of edges) {
        if (!e.bridge || !e.overWater || e.virtual || e.tunnel || Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) > 0.3) continue;
        const row = rowOf(e); if (row?.outer !== 'picket-posts') continue;
        const steel = rgb(row.railColour || '#8a9096'), post = rgb(row.postColour || '#b9b5ac');
        for (const s of [1, -1]) {
            const off = widthSide(e, s) - 0.15, ax = e.a.x + e.nx * s * off, az = e.a.z + e.nz * s * off, bx = e.b.x + e.nx * s * off, bz = e.b.z + e.nz * s * off;
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
            const nx = e.nx * s, nz = e.nz * s, ang = Math.atan2(bx - ax, bz - az), bays = Math.max(1, Math.round(L / 2.5));
            const at = t => { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, topAt(x, z, e, s), z]; };
            const strip = (c, p, q, y0, y1) => { const A = [p[0], p[1] + y0, p[2]], B = [q[0], q[1] + y0, q[2]], C = [q[0], q[1] + y1, q[2]], D = [p[0], p[1] + y1, p[2]]; c.detail.face4(A, B, C, D, steel, [nx, 0, nz]); c.detail.face4(A, D, C, B, steel, [-nx, 0, -nz]); };
            for (let i = 0; i < bays; i++) {
                const p = at(i / bays), q = at((i + 1) / bays), c = cellOf((p[0] + q[0]) / 2, (p[2] + q[2]) / 2), bl = L / bays;
                strip(c, p, q, 0.98, 1.04); strip(c, p, q, 0.12, 0.17);
                const n = Math.max(2, Math.round(bl / 0.16));
                for (let k = 1; k < n; k++) { const f0 = (i + k / n) / bays - 0.01 / L, f1 = (i + k / n) / bays + 0.01 / L; strip(c, at(f0), at(f1), 0.17, 0.98); }
                c.detail.box(p[0], p[1], p[2], 0.22, 1.15, 0.22, ang, post);
                for (let t = 0; t < bl; t += 0.6) { const r = at((i + t / bl) / bays); addCollider(r[0], r[2], 0.35); }
                if (i === bays - 1) { c.detail.box(q[0], q[1], q[2], 0.22, 1.15, 0.22, ang, post); addCollider(q[0], q[2], 0.35); }
            }
            out.pieces++; out.lengthM += L; if (!out.ways.includes(row.way)) out.ways.push(row.way);
        }
    }
    out.lengthM = +out.lengthM.toFixed(1);
    return out;
}

// Railing: posts every 2 m (1.1 m), top / middle / bottom rails as thin two-sided strips (no shadow pass, no boxes).
// `review(e, s)` (optional, round 3): a reviewed side of a source bridge (bridge-guards.js `atGrade` rows) — { colour, postColour,
// pickets, wBeam }: the railing in the seen colour / picket pitch, and a W-beam guard rail at the carriageway edge (`roadEdge(e, s)`).
export function emitStreetLevelWaterBridgeRailings({ edges, isWater, widthSide, topAt, cellOf, addCollider, colour, postColour, review = null, roadEdge = null }) {
    const runs = streetLevelWaterBridgeRuns(edges, isWater), records = [];
    for (const run of runs) for (const e of run.edges) for (const s of [1, -1]) {
        const rv = review?.(e, s) || null, col = rv?.colour || colour, pcol = rv?.postColour || postColour, picks = rv?.pickets || 5;
        if (rv?.wBeam && roadEdge) emitWBeam(e, s, roadEdge(e, s), { topAt, cellOf, addCollider, colour: rv.wBeamColour });
        const off = widthSide(e, s) - 0.12, ox = e.nx * s * off, oz = e.nz * s * off;
        const ax = e.a.x + ox, az = e.a.z + oz, bx = e.b.x + ox, bz = e.b.z + oz, len = Math.hypot(bx - ax, bz - az); if (len < 0.2) continue;
        const n = Math.max(1, Math.round(len / 2)), nx = e.nx * s, nz = e.nz * s;
        const at = t => { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, topAt(x, z, e, s), z]; };
        for (let i = 0; i < n; i++) {
            const p = at(i / n), q = at((i + 1) / n), c = cellOf((p[0] + q[0]) / 2, (p[2] + q[2]) / 2);
            for (const [y0, y1] of [[1.04, 1.1], [0.56, 0.6], [0.12, 0.16]]) {
                const A = [p[0], p[1] + y0, p[2]], B = [q[0], q[1] + y0, q[2]], C = [q[0], q[1] + y1, q[2]], D = [p[0], p[1] + y1, p[2]];
                c.detail.face4(A, B, C, D, col, [nx, 0, nz]); c.detail.face4(A, D, C, B, col, [-nx, 0, -nz]);
            }
            // pickets between the bottom and the top rail, 4 per bay (reviewed: `pickets` - 1), as one-quad strips
            for (let k = 1; k < picks; k++) {
                const t0 = (i + k / picks - 0.012) / n, t1 = (i + k / picks + 0.012) / n, a = at(t0), b = at(t1);
                const A = [a[0], a[1] + 0.16, a[2]], B = [b[0], b[1] + 0.16, b[2]], C = [b[0], b[1] + 1.04, b[2]], D = [a[0], a[1] + 1.04, a[2]];
                c.detail.face4(A, B, C, D, col, [nx, 0, nz]); c.detail.face4(A, D, C, B, col, [-nx, 0, -nz]);
            }
            c.solid.box(p[0], p[1], p[2], 0.07, 1.12, 0.07, Math.atan2(e.dirx, e.dirz), pcol);
            addCollider(p[0], p[2], 0.3); addCollider((p[0] + q[0]) / 2, (p[2] + q[2]) / 2, 0.3);
            if (i === n - 1) { c.solid.box(q[0], q[1], q[2], 0.07, 1.12, 0.07, Math.atan2(e.dirx, e.dirz), pcol); addCollider(q[0], q[2], 0.3); }
        }
        records.push({ road: run.road, edgeId: e.id, side: s, lengthM: +len.toFixed(2), ...(rv ? { reviewed: rv.way || true, wBeam: !!rv.wBeam } : {}) });
    }
    return { runs: runs.map(r => ({ road: r.road, edges: r.edges.length, waterRightM: r.waterRightM, waterLeftM: r.waterLeftM })), pieces: records.length,
        lengthM: +records.reduce((sum, r) => sum + r.lengthM, 0).toFixed(1), scope: 'Inferred pedestrian railing on street-level bridges with mapped water on both sides; no source barrier record' };
}

// W-beam steel guard rail at the carriageway edge of a reviewed at-grade bridge: galvanised posts every 2 m and the beam
// as one two-sided strip (0.45 - 0.77 m); overlapping colliders hold cars and walkers (near-only detail layer).
function emitWBeam(e, s, off, { topAt, cellOf, addCollider, colour }) {
    const ox = e.nx * s * off, oz = e.nz * s * off, ax = e.a.x + ox, az = e.a.z + oz, bx = e.b.x + ox, bz = e.b.z + oz, len = Math.hypot(bx - ax, bz - az); if (len < 0.2) return;
    const nx = e.nx * s, nz = e.nz * s, n = Math.max(1, Math.round(len / 2)), ang = Math.atan2(e.dirx, e.dirz);
    const at = t => { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, topAt(x, z, e, s, true), z]; };
    for (let i = 0; i < n; i++) {
        const p = at(i / n), q = at((i + 1) / n), c = cellOf((p[0] + q[0]) / 2, (p[2] + q[2]) / 2);
        const A = [p[0], p[1] + 0.45, p[2]], B = [q[0], q[1] + 0.45, q[2]], C = [q[0], q[1] + 0.77, q[2]], D = [p[0], p[1] + 0.77, p[2]];
        c.detail.face4(A, B, C, D, colour, [-nx, 0, -nz]); c.detail.face4(A, D, C, B, colour, [nx, 0, nz]);
        c.detail.box(p[0] + nx * 0.12, p[1], p[2] + nz * 0.12, 0.1, 0.75, 0.14, ang, colour);
        for (const f of [0, 0.35, 0.7]) addCollider(p[0] + (q[0] - p[0]) * f, p[2] + (q[2] - p[2]) * f, 0.25);
        if (i === n - 1) { c.detail.box(q[0] + nx * 0.12, q[1], q[2] + nz * 0.12, 0.1, 0.75, 0.14, ang, colour); addCollider(q[0], q[2], 0.25); }
    }
}
