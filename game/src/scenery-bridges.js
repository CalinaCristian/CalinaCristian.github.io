// Source scenery has no traffic graph. This is a passive rendered profile only.
// Heights are runtime MODEL estimates, never surveyed elevations or layer-as-metres.
const EPS = 1e-6, GRADE = .08, DECK_GRADE = .028, CLEARANCE = 5.2, THICKNESS = .4;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const project = (p, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0;
    return { t, d: Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) };
};
const crossing = (a, b, c, d) => {
    const ux = b[0] - a[0], uz = b[1] - a[1], vx = d[0] - c[0], vz = d[1] - c[1], den = ux * vz - uz * vx;
    if (Math.abs(den) < 1e-8) return null;
    const wx = c[0] - a[0], wz = c[1] - a[1], t = (wx * vz - wz * vx) / den, s = (wx * uz - wz * ux) / den;
    return t >= -EPS && t <= 1 + EPS && s >= -EPS && s <= 1 + EPS ? { t: Math.max(0, Math.min(1, t)), s: Math.max(0, Math.min(1, s)), sine: Math.abs(den) / (Math.hypot(ux, uz) * Math.hypot(vx, vz)) } : null;
};
const layerOf = (tags, bridge) => Number.isFinite(Number(tags?.layer)) ? Number(tags.layer) : bridge ? 1 : 0;

/** Exact source topology plus final same-source core grade; no nearest-road snapping. */
export function sceneryBridgeProfiles(data, profiles, coreEdges = []) {
    const output = new Map(), stats = { policy: 'MODEL estimate: exact source connectivity; final core ties; 5.2m road clearance, 0.4m slab, 8% approaches / 2.8% decks; river/rail-only bridges at grade', bridgePieces: 0, approachPieces: 0, coreTies: 0, crossings: 0, unresolved: [], pieces: [] };
    if (data.roadGeometryPolicy !== 'source') return { profiles: output, stats };
    const nodes = new Map(), pieces = [], originalEdges = [], byCoreSource = new Map(), coreNodes = new Map();
    for (const e of coreEdges) {
        if (e.virtual) continue;
        const id = data.roadSourceGeometry?.[e.road]?.sourceId;
        if (id) { if (!byCoreSource.has(id)) byCoreSource.set(id, []); byCoreSource.get(id).push(e); }
        for (const n of [e.a, e.b]) if (n.sourceId > 0 && Number.isFinite(n.y)) coreNodes.set(n.sourceId, n);
    }
    const coreTie = (point, sourceId) => {
        for (const e of byCoreSource.get(sourceId) || []) {
            const q = project(point, [e.a.x, e.a.z], [e.b.x, e.b.z]);
            if (q.d < EPS && q.t >= -EPS && q.t <= 1 + EPS) return e.ya + (e.yb - e.ya) * Math.max(0, Math.min(1, q.t));
        }
        return null;
    };
    for (const [index, profile] of profiles.entries()) {
        if (!profile.precise) continue;
        const source = data.scenerySourceGeometry[index], row = data.scenery[index], tags = source.tags || {};
        const piece = { index, profile, source, tags, bridge: !!(row[3] & 1), type: data.classes[row[2]], nodes: [], edges: [] };
        for (const p of profile.points) {
            const sourceIndex = source.projected.findIndex(q => distance(p, q) < EPS), sourceNode = sourceIndex >= 0 ? source.nodeIds[sourceIndex] : null;
            const key = sourceNode > 0 ? 'n' + sourceNode : source.sourceId + ':' + p[0].toFixed(6) + ',' + p[1].toFixed(6);
            if (!nodes.has(key)) nodes.set(key, { key, p, links: [], sourceNode, coreY: null });
            const n = nodes.get(key); piece.nodes.push(n);
            // Same original way, including exact boundary-cut interpolation. Never pick another nearby deck.
            const tied = coreTie(p, source.sourceId); if (tied !== null) n.coreY = tied;
            const cn = coreNodes.get(sourceNode);
            if (n.coreY === null && cn && distance(p, [cn.x, cn.z]) < EPS) n.coreY = cn.y;
        }
        for (let i = 1; i < piece.nodes.length; i++) {
            const a = piece.nodes[i - 1], b = piece.nodes[i], len = distance(a.p, b.p); if (len < EPS) continue;
            const e = { a, b, len, piece, eligible: piece.bridge, cross: [] };
            a.links.push(e); b.links.push(e); piece.edges.push(e); originalEdges.push(e);
        }
        pieces.push(piece);
    }
    // Extend a ramp only along actual source-connected plain continuations or links, up to 300m.
    for (const p of pieces.filter(p => p.bridge)) for (const start of [p.nodes[0], p.nodes.at(-1)]) {
        const queue = [[start, 0]], seen = new Set();
        while (queue.length) {
            const [n, travelled] = queue.shift(); if (seen.has(n) || travelled > 300) continue; seen.add(n);
            for (const e of n.links) {
                if (e.piece.bridge || e.eligible) continue;
                const sameName = p.tags.name && p.tags.name === e.piece.tags.name;
                const plain = n.links.length <= 2 && (!e.piece.tags.name || sameName) && e.piece.type === p.type;
                if (!/_link$/.test(e.piece.type) && !(sameName && n.links.length <= 2) && !plain) continue;
                e.eligible = true;
                queue.push([e.a === n ? e.b : e.a, travelled + e.len]);
            }
        }
    }
    // A bridge over a real lower road needs an estimated clearance. River/rail-only bridges stay at grade.
    for (const e of originalEdges.filter(e => e.piece.bridge)) {
        const upper = layerOf(e.piece.tags, true), candidates = [];
        for (const f of coreEdges) if (!f.virtual && !f.tunnel && data.roadSourceGeometry?.[f.road]?.sourceId !== e.piece.source.sourceId && upper > (f.bridge ? Math.max(1, f.layer || 1) : 0)) {
            candidates.push({ a: [f.a.x, f.a.z], b: [f.b.x, f.b.z], y0: f.ya, y1: f.yb, halfW: Math.max(f.wL, f.wR), id: data.roadSourceGeometry?.[f.road]?.sourceId, sourceNodeIds: [f.a.sourceId, f.b.sourceId], core: true });
        }
        for (const f of originalEdges) if (f.piece.source.sourceId !== e.piece.source.sourceId && upper > layerOf(f.piece.tags, f.piece.bridge) && (!f.piece.tags.tunnel || f.piece.tags.tunnel === 'no')) {
            candidates.push({ a: f.a.p, b: f.b.p, y0: f.a.coreY ?? 0, y1: f.b.coreY ?? 0, halfW: Math.max(f.piece.profile.leftM, f.piece.profile.rightM), id: f.piece.source.sourceId, edge: f });
        }
        for (const f of candidates) {
            const q = crossing(e.a.p, e.b.p, f.a, f.b); if (!q) continue;
            // Existing shared OSM endpoints are junctions, never inferred grade separations.
            if (f.edge && [e.a, e.b].some(n => n === f.edge.a || n === f.edge.b)) continue;
            if (f.sourceNodeIds && [e.a, e.b].some(n => n.sourceNode > 0 && f.sourceNodeIds.includes(n.sourceNode))) continue;
            const top = (1 - q.s) * f.y0 + q.s * f.y1;
            e.cross.push({ ...q, need: top + CLEARANCE + THICKNESS, lowerSourceId: f.id, halfSpan: (f.halfW + Math.max(e.piece.profile.leftM, e.piece.profile.rightM)) / Math.max(.1, q.sine) });
        }
    }
    const graphNodes = [...nodes.values()], links = [], targets = new Map(), caps = new Map();
    for (const n of graphNodes) n.adj = [];
    for (const e of originalEdges.filter(e => e.eligible)) {
        const fractions = new Set([0, 1]);
        const count = Math.ceil(e.len / 10); for (let i = 1; i < count; i++) fractions.add(i / count);
        // Split exactly where the source way enters/exits a core segment, avoiding duplicate deck surfaces.
        for (const core of byCoreSource.get(e.piece.source.sourceId) || []) for (const point of [[core.a.x, core.a.z], [core.b.x, core.b.z]]) { const q = project(point, e.a.p, e.b.p); if (q.d < EPS && q.t > EPS && q.t < 1 - EPS) fractions.add(q.t); }
        for (const c of e.cross) { fractions.add(c.t); fractions.add(Math.max(0, c.t - c.halfSpan / e.len)); fractions.add(Math.min(1, c.t + c.halfSpan / e.len)); }
        const ns = [...fractions].sort((a, b) => a - b).map(t => {
            if (t === 0) return e.a; if (t === 1) return e.b;
            const n = { key: e.piece.source.sourceId + ':render:' + graphNodes.length, p: [e.a.p[0] + (e.b.p[0] - e.a.p[0]) * t, e.a.p[1] + (e.b.p[1] - e.a.p[1]) * t], adj: [], links: [], coreY: null };
            n.coreY = coreTie(n.p, e.piece.source.sourceId);
            graphNodes.push(n); return n;
        });
        e.renderNodes = ns;
        const fs = [...fractions].sort((a, b) => a - b);
        for (let i = 0; i < ns.length; i++) for (const c of e.cross) if (Math.abs(fs[i] - c.t) * e.len <= c.halfSpan + EPS) targets.set(ns[i], Math.max(targets.get(ns[i]) || 0, c.need));
        for (let i = 1; i < ns.length; i++) {
            const link = { a: ns[i - 1], b: ns[i], cost: distance(ns[i - 1].p, ns[i].p) * (e.piece.bridge ? DECK_GRADE : GRADE) };
            link.a.adj.push(link); link.b.adj.push(link); links.push(link);
        }
        stats.crossings += e.cross.length;
    }
    for (const n of graphNodes) if (n.adj.length) {
        if (n.coreY !== null) { targets.set(n, n.coreY); caps.set(n, n.coreY); stats.coreTies++; }
        else if (n.links.some(e => !e.eligible)) caps.set(n, 0);
    }
    // Monotone relaxation of graph cones; finite exact graph, no added road connections.
    const cone = (seeds, upper) => {
        const values = new Map(seeds), queue = [...seeds.keys()], queued = new Set(queue);
        while (queue.length) {
            const n = queue.shift(); queued.delete(n); const value = values.get(n);
            for (const e of n.adj) {
                const m = e.a === n ? e.b : e.a, next = value + (upper ? e.cost : -e.cost), old = values.get(m);
                if (old === undefined || (upper ? next < old - 1e-9 : next > old + 1e-9)) { values.set(m, next); if (!queued.has(m)) { queue.push(m); queued.add(m); } }
            }
        }
        return values;
    };
    const low = cone(targets, false), high = cone(caps, true);
    for (const n of graphNodes) n.y = n.coreY ?? Math.max(0, Math.min(low.get(n) ?? 0, high.get(n) ?? Infinity));
    for (const p of pieces) if (p.edges.some(e => e.eligible)) {
        const points = [], heights = [];
        for (const e of p.edges) {
            const ns = e.renderNodes || [e.a, e.b];
            for (const n of ns) if (!points.length || points.at(-1) !== n.p) { points.push(n.p); heights.push(n.y ?? 0); }
            for (const c of e.cross) {
                const x = e.a.p[0] + (e.b.p[0] - e.a.p[0]) * c.t, z = e.a.p[1] + (e.b.p[1] - e.a.p[1]) * c.t;
                const n = ns.find(n => distance(n.p, [x, z]) < EPS);
                if (n && n.y + .01 < c.need) stats.unresolved.push({ sourceId: p.source.sourceId, lowerSourceId: c.lowerSourceId, x, z, requiredDisplacementM: c.need, actualDisplacementM: n.y, reason: 'exact core/ground ties and grade limit constrain estimated clearance' });
            }
        }
        if (!p.bridge && heights.every(y => Math.abs(y) < 1e-8)) continue; // unchanged at-grade scenery keeps its existing renderer
        const coveredSegments = points.slice(1).map((point, i) => coreTie([(point[0] + points[i][0]) / 2, (point[1] + points[i][1]) / 2], p.source.sourceId) !== null);
        const record = { points, heights, coveredSegments, bridge: p.bridge, sourceId: p.source.sourceId, tags: p.tags, access: data.sceneryAccess?.[p.index], elevationSource: 'MODEL estimate; source topology and final exact core ties', thicknessM: THICKNESS };
        output.set(p.index, record); stats[p.bridge ? 'bridgePieces' : 'approachPieces']++;
        stats.pieces.push({ piece: p.index, sourceId: p.source.sourceId, bridge: p.bridge, minDisplacementM: Math.min(...heights), maxDisplacementM: Math.max(...heights), coreTies: p.nodes.filter(n => n.coreY !== null).length, renderedSegments: coveredSegments.filter(v => !v).length, alreadyRenderedCoreSegments: coveredSegments.filter(Boolean).length, elevationSource: record.elevationSource });
    }
    return { profiles: output, stats };
}

/** Deck top/underside at an actual segment position, shared by rendered and passive collision bands. */
export function sceneryDeckBand(a, b, y0, y1, thicknessM = THICKNESS) {
    const slope = Math.abs(y1 - y0) / (distance(a, b) || 1);
    return (x, z, radius = 0) => { const q = project([x, z], a, b), t = Math.max(0, Math.min(1, q.t)), top = .24 + y0 + (y1 - y0) * t, pad = Math.max(0, radius) * slope; return { bottom: top - thicknessM - pad, top: top + pad }; };
}
