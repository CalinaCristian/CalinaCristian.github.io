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
export function streetLevelWaterBridgeRuns(edges, isWater, { reachM = 36, maxLevelM = 0.3 } = {}) {
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

// Railing: posts every 2 m (1.1 m), top / middle / bottom rails as thin two-sided strips (no shadow pass, no boxes).
export function emitStreetLevelWaterBridgeRailings({ edges, isWater, widthSide, topAt, cellOf, addCollider, colour, postColour }) {
    const runs = streetLevelWaterBridgeRuns(edges, isWater), records = [];
    for (const run of runs) for (const e of run.edges) for (const s of [1, -1]) {
        const off = widthSide(e, s) - 0.12, ox = e.nx * s * off, oz = e.nz * s * off;
        const ax = e.a.x + ox, az = e.a.z + oz, bx = e.b.x + ox, bz = e.b.z + oz, len = Math.hypot(bx - ax, bz - az); if (len < 0.2) continue;
        const n = Math.max(1, Math.round(len / 2)), nx = e.nx * s, nz = e.nz * s;
        const at = t => { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, topAt(x, z, e, s), z]; };
        for (let i = 0; i < n; i++) {
            const p = at(i / n), q = at((i + 1) / n), c = cellOf((p[0] + q[0]) / 2, (p[2] + q[2]) / 2);
            for (const [y0, y1] of [[1.04, 1.1], [0.56, 0.6], [0.12, 0.16]]) {
                const A = [p[0], p[1] + y0, p[2]], B = [q[0], q[1] + y0, q[2]], C = [q[0], q[1] + y1, q[2]], D = [p[0], p[1] + y1, p[2]];
                c.detail.face4(A, B, C, D, colour, [nx, 0, nz]); c.detail.face4(A, D, C, B, colour, [-nx, 0, -nz]);
            }
            // pickets between the bottom and the top rail, 4 per bay, as one-quad strips
            for (let k = 1; k < 5; k++) {
                const t0 = (i + k / 5 - 0.012) / n, t1 = (i + k / 5 + 0.012) / n, a = at(t0), b = at(t1);
                const A = [a[0], a[1] + 0.16, a[2]], B = [b[0], b[1] + 0.16, b[2]], C = [b[0], b[1] + 1.04, b[2]], D = [a[0], a[1] + 1.04, a[2]];
                c.detail.face4(A, B, C, D, colour, [nx, 0, nz]); c.detail.face4(A, D, C, B, colour, [-nx, 0, -nz]);
            }
            c.solid.box(p[0], p[1], p[2], 0.07, 1.12, 0.07, Math.atan2(e.dirx, e.dirz), postColour);
            addCollider(p[0], p[2], 0.3); addCollider((p[0] + q[0]) / 2, (p[2] + q[2]) / 2, 0.3);
            if (i === n - 1) { c.solid.box(q[0], q[1], q[2], 0.07, 1.12, 0.07, Math.atan2(e.dirx, e.dirz), postColour); addCollider(q[0], q[2], 0.3); }
        }
        records.push({ road: run.road, edgeId: e.id, side: s, lengthM: +len.toFixed(2) });
    }
    return { runs: runs.map(r => ({ road: r.road, edges: r.edges.length, waterRightM: r.waterRightM, waterLeftM: r.waterLeftM })), pieces: records.length,
        lengthM: +records.reduce((sum, r) => sum + r.lengthM, 0).toFixed(1), scope: 'Inferred pedestrian railing on street-level bridges with mapped water on both sides; no source barrier record' };
}
