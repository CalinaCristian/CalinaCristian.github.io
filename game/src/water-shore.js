// Attribute-only shoreline measurements. Source rings, vertex/index order and
// tessellation are never changed. Mesh subdivision edges are not shorelines.
export function makeSourceShoreSampler(areas, { maxD = 30, cell = 32 } = {}) {
    const grid = new Map(), long = [], sources = [], issues = [];
    let segments = 0;
    // (spec 10 load budget) numeric cell keys; a cell outside their range sends the segment to `long` (always measured)
    const CK = 1 << 20, cellKey = (x, z) => (x + CK) * 2 * CK + (z + CK), inKeys = (x0, x1, z0, z1) => x0 >= -CK && x1 < CK && z0 >= -CK && z1 < CK;
    const put = (x, z, segment) => { const key = cellKey(x, z); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(segment); };
    for (const [i, area] of areas.entries()) {
        const id = area.sourceId || 'prepared-area:' + (area.areaIndex ?? i);
        sources.push(id);
        for (const ring of [area.outer, ...(area.holes || [])]) {
            if (!Array.isArray(ring) || ring.length < 3) { issues.push({ sourceId: id, reason: 'invalid shoreline ring' }); continue; }
            for (let j = 0; j < ring.length; j++) {
                const a = ring[j], b = ring[(j + 1) % ring.length];
                if (![...a, ...b].every(Number.isFinite)) { issues.push({ sourceId: id, reason: 'nonfinite shoreline segment', segment: j }); continue; }
                if (a[0] === b[0] && a[1] === b[1]) continue;
                const s = [a[0], a[1], b[0], b[1]], x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell);
                const z0 = Math.floor(Math.min(a[1], b[1]) / cell), z1 = Math.floor(Math.max(a[1], b[1]) / cell);
                if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096 || !inKeys(x0, x1, z0, z1)) long.push(s);
                else for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, z, s);
                segments++;
            }
        }
    }
    const distanceTo = (x, z, s) => {
        const dx = s[2] - s[0], dz = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t);
    };
    const inside = (x, z, ring) => { let yes = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; } return yes; };
    return {
        maxD, segments, sourceIds: [...new Set(sources)], issues,
        distance(x, z) {
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell), r = Math.ceil(maxD / cell); let best = maxD;
            // a segment whose bounds lie more than best (+1 µm) away along one axis is farther than best: min keeps best
            if (inKeys(cx - r, cx + r, cz - r, cz + r)) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const l = grid.get(cellKey(cx + a, cz + b)); if (l) for (const s of l) { const m = best + 1e-6; if (Math.min(s[0], s[2]) - x > m || x - Math.max(s[0], s[2]) > m || Math.min(s[1], s[3]) - z > m || z - Math.max(s[1], s[3]) > m) continue; best = Math.min(best, distanceTo(x, z, s)); } }
            else for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const l = inKeys(cx + a, cx + a, cz + b, cz + b) && grid.get(cellKey(cx + a, cz + b)); if (l) for (const s of l) best = Math.min(best, distanceTo(x, z, s)); }
            for (const s of long) best = Math.min(best, distanceTo(x, z, s));
            return best;
        },
        sourcesAt(x, z) { return areas.flatMap((a, i) => Array.isArray(a.outer) && inside(x, z, a.outer) && !(a.holes || []).some(h => inside(x, z, h)) ? [a.sourceId || 'prepared-area:' + (a.areaIndex ?? i)] : []); },
    };
}

export function sourceShoreAttribute(position, index, sampler, { coarseEdgeM = 8 } = {}) {
    const distances = new Float32Array(position.count), foamReliable = new Float32Array(position.count).fill(1), cache = new Map();
    // cache by x, then z (Map keys compare as the old string keys did: -0 is 0, NaN is NaN)
    const sample = (x, z) => { let row = cache.get(x); if (!row) cache.set(x, row = new Map()); let d = row.get(z); if (d === undefined) row.set(z, d = sampler.distance(x, z)); return d; };
    for (let i = 0; i < position.count; i++) distances[i] = sample(position.getX(i), position.getZ(i));
    const faces = (index?.count ?? position.count) / 3, ranges = [], fallbackBySource = {};
    let fallbackFaces = 0, indexedUnreliableFaces = 0;
    for (let face = 0; face < faces; face++) {
        const ids = [0, 1, 2].map(k => index ? index.getX(face * 3 + k) : face * 3 + k);
        const points = ids.map(i => [position.getX(i), position.getZ(i)]);
        const mean = ids.reduce((s, i) => s + distances[i] / 3, 0);
        if (mean >= .9 || !points.some((p, i) => Math.hypot(p[0] - points[(i + 1) % 3][0], p[1] - points[(i + 1) % 3][1]) > coarseEdgeM)) continue;
        const x = points.reduce((s, p) => s + p[0] / 3, 0), z = points.reduce((s, p) => s + p[1] / 3, 0);
        if (sample(x, z) <= Math.max(1.5, mean + 1)) continue;
        // An indexed face might share its samples with a reliable neighbour.
        // District subdivision is nonindexed; other callers retain this explicit issue.
        if (index) { indexedUnreliableFaces++; continue; }
        for (const i of ids) foamReliable[i] = 0;
        fallbackFaces++;
        const last = ranges.at(-1); if (last && last[0] + last[1] === face) last[1]++; else ranges.push([face, 1]);
        const owners = sampler.sourcesAt(x, z);
        for (const id of owners.length ? owners : ['unassigned-source']) fallbackBySource[id] = (fallbackBySource[id] || 0) + 1;
    }
    return {
        distances, foamReliable,
        audit: { method: 'bounded distance to exact prepared source outer and inner shoreline rings', sourceIds: sampler.sourceIds, sourceSegments: sampler.segments, vertices: position.count, faces, maxDistanceM: sampler.maxD,
            coarseFoamOmittedFaces: fallbackFaces, coarseFoamOmittedFaceRanges: ranges, fallbackBySource, indexedUnreliableFaces, sourceIssues: sampler.issues,
            fallback: 'Only coarse faces whose source centroid is interior but whose shoreline-only samples would interpolate false foam omit inferred foam. True vertex shore distances remain exact; other faces retain foam.' },
    };
}
