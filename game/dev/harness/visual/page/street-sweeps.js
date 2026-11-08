// Visual fixtures follow real directed roads. They never add graph connections.
const EPS = 1e-5;
const allowed = (e, dir) => !e.virtual && e.publicDrive !== false && (dir > 0 ? (e.lanesF ?? e.lanes ?? 1) : e.oneway ? 0 : (e.lanesB ?? e.lanes ?? 1)) > 0;
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const pose = n => ({ x: n.x, z: n.z, ...(Number.isFinite(n.y) ? { y: n.y } : {}), node: n.sourceId ?? n.id ?? null });
const merge = ranges => {
    const out = [];
    for (const r of ranges.slice().sort((a, b) => a[0] - b[0])) {
        const last = out.at(-1);
        if (last && r[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], r[1]);
        else out.push([...r]);
    }
    return out;
};
const fraction = ranges => merge(ranges).reduce((n, r) => n + r[1] - r[0], 0);

export function sweepSampleDistances(total, every, { from = 0, to = Infinity, max = 2000 } = {}) {
    if (!(total > 0) || !(every > 0)) return [];
    const result = [], start = Math.min(42, total / 2), end = total - Math.min(4, total / 4);
    for (let s = start; s < end; s += every) if (s >= from && s <= Math.min(to, max)) result.push(s);
    return result;
}

/** Cover each legal directed source edge, using only routes verified by the real router.
 * Endpoint epsilon avoids snapping a fixture onto another road at a shared XY junction;
 * this changes camera poses only. The source graph and all source coordinates stay intact.
 */
export function planStreetSweeps({ name, edges, route, sourceId = e => e.id }) {
    const legal = edges.filter(e => allowed(e, 1) || allowed(e, -1));
    const excluded = edges.filter(e => !legal.includes(e)).map(e => ({ edge: e.id, sourceRoadId: sourceId(e), reason: e.virtual ? 'virtual graph connection' : 'no legal public motorcar direction' }));
    const edgeNumber = new Map(legal.map((e, i) => [e, i])), units = new Map(), covered = new Map();
    for (const e of legal) for (const dir of [1, -1]) if (allowed(e, dir)) units.set(edgeNumber.get(e) + ':' + dir, { e, dir });
    const ns = [...new Set(legal.flatMap(e => [e.a, e.b]))], ids = new Map(ns.map((n, i) => [n, i]));
    const cache = new Map(), rejected = [];
    function inspect(a, b) {
        const key = a.x + ',' + a.z + ',' + a.y + '/' + b.x + ',' + b.z + ',' + b.y;
        if (cache.has(key)) return cache.get(key);
        let r = null, reason = null;
        try { r = route(a, b); } catch (error) { reason = String(error.message || error); }
        const ranges = new Map(); let total = 0, onStreet = 0;
        if (!r?.points || r.points.length < 2 || !r.legs?.length) reason ||= 'router returned no physical route';
        else for (let i = 0; i < r.legs.length; i++) {
            const leg = r.legs[i], e = leg.e, a = r.points[i], b = r.points[i + 1];
            if (!e || !a || !b || !allowed(e, leg.dir)) { reason = 'route uses an illegal or virtual direction'; break; }
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]); total += len;
            if (!edgeNumber.has(e) || len <= 1e-9) continue;
            const t = p => Math.max(0, Math.min(1, ((p[0] - e.a.x) * e.dirx + (p[1] - e.a.z) * e.dirz) / e.len));
            const lo = Math.min(t(a), t(b)), hi = Math.max(t(a), t(b));
            const key = edgeNumber.get(e) + ':' + leg.dir;
            if (!units.has(key)) { reason = 'route direction conflicts with requested source edge'; break; }
            const list = ranges.get(key) || []; list.push([lo, hi]); ranges.set(key, list);
            onStreet += (hi - lo) * e.len;
        }
        if (!reason && (!total || onStreet / total < .6)) reason = 'verified route does not survey the requested street';
        const answer = { route: r, ranges, reachable: !!r?.legs?.length, accepted: !reason, reason, total, onStreet };
        cache.set(key, answer); return answer;
    }
    let farthest = null;
    const originalNodes = [...new Set(edges.flatMap(e => [e.a, e.b]))];
    for (let i = 0; i < originalNodes.length; i++) for (let j = i + 1; j < originalNodes.length; j++) {
        const span = distance(originalNodes[i], originalNodes[j]); if (!farthest || span > farthest.span) farthest = { a: originalNodes[i], b: originalNodes[j], span };
    }
    const describe = result => ({ reachable: result.reachable, accepted: result.accepted, reason: result.reason, routeMetres: result.total, requestedStreetMetres: result.onStreet });
    const originalFarthestPair = farthest ? { from: pose(farthest.a), to: pose(farthest.b), spanMetres: farthest.span, forward: describe(inspect(farthest.a, farthest.b)), reverse: describe(inspect(farthest.b, farthest.a)) } : null;
    // Components share actual source nodes. Opposite carriageways do not become connected
    // merely because the router's boundary SCC uses the same virtual outside component.
    const parent = ns.map((_, i) => i);
    const find = n => { let i = ids.get(n); while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (const e of legal) parent[find(e.a)] = find(e.b);
    const groups = new Map();
    for (const e of legal) { const key = find(e.a), group = groups.get(key) || []; group.push(e); groups.set(key, group); }
    const components = [...groups.values()].sort((a, b) => b.reduce((s, e) => s + e.len, 0) - a.reduce((s, e) => s + e.len, 0));
    const runs = [], componentReports = [];
    function complete(keys) { return keys.every(key => fraction(covered.get(key) || []) >= 1 - EPS); }
    for (const [ci, component] of components.entries()) {
        const keys = [...units].filter(([, u]) => component.includes(u.e)).map(([key]) => key);
        const nodes = [...new Set(component.flatMap(e => [e.a, e.b]))], degree = new Map(nodes.map(n => [n, 0]));
        for (const e of component) { degree.set(e.a, degree.get(e.a) + 1); degree.set(e.b, degree.get(e.b) + 1); }
        const candidates = new Set(nodes.filter(n => degree.get(n) !== 2));
        for (const axis of ['x', 'z']) for (const sign of [1, -1]) candidates.add(nodes.reduce((a, b) => sign * b[axis] > sign * a[axis] ? b : a));
        const endpoints = [...candidates], pairs = [];
        for (const a of endpoints) for (const b of endpoints) if (a !== b) pairs.push({ a, b, span: distance(a, b) });
        pairs.sort((a, b) => b.span - a.span);
        // If a branch or a router snap prevented an endpoint pair from covering a source
        // edge, retain it as an explicit small verified run, rather than lose its view.
        for (const e of component) for (const dir of [1, -1]) if (allowed(e, dir)) {
            const point = t => ({ x: e.a.x + (e.b.x - e.a.x) * t, z: e.a.z + (e.b.z - e.a.z) * t, ...(Number.isFinite(e.ya) && Number.isFinite(e.yb) ? { y: e.ya + (e.yb - e.ya) * t } : {}), sourceEdge: e.id, sourceFraction: t });
            pairs.push({ a: point(dir > 0 ? 1e-6 : 1 - 1e-6), b: point(dir > 0 ? 1 - 1e-6 : 1e-6), span: e.len, fallback: true });
        }
        const before = runs.length;
        for (const pair of pairs) {
            if (complete(keys)) break;
            const checked = inspect(pair.a, pair.b);
            if (!checked.accepted) { rejected.push({ component: ci + 1, from: pose(pair.a), to: pose(pair.b), reason: checked.reason }); continue; }
            let gain = 0;
            for (const [key, ranges] of checked.ranges) {
                if (!keys.includes(key)) continue;
                gain += (fraction([...(covered.get(key) || []), ...ranges]) - fraction(covered.get(key) || [])) * units.get(key).e.len;
            }
            if (gain <= 1e-6) continue;
            for (const [key, ranges] of checked.ranges) if (keys.includes(key)) covered.set(key, merge([...(covered.get(key) || []), ...ranges]));
            runs.push({ from: pose(pair.a), to: pose(pair.b), component: ci + 1, route: checked.route, routeMetres: checked.total, requestedStreetMetres: checked.onStreet, sourceRoadIds: [...new Set([...checked.ranges.keys()].filter(key => keys.includes(key)).map(key => sourceId(units.get(key).e)))], endpointInset: !!pair.fallback });
        }
        componentReports.push({ component: ci + 1, sourceRoadIds: [...new Set(component.map(sourceId))], physicalEdges: component.length, requiredDirectedEdges: keys.length, plannedRuns: runs.length - before, complete: complete(keys) });
    }
    const uncovered = [...units].filter(([key]) => !complete([key])).map(([key, u]) => ({ edge: u.e.id, sourceRoadId: sourceId(u.e), direction: u.dir, coveredFraction: fraction(covered.get(key) || []), from: pose(u.dir > 0 ? u.e.a : u.e.b), to: pose(u.dir > 0 ? u.e.b : u.e.a) }));
    return { runs, diagnostics: { name, status: !legal.length ? 'no-legal-public-edges' : uncovered.length ? 'incomplete' : 'complete', method: 'Verified real-router paths per source-node component and legal directed edge; no graph edits. Camera endpoint insets are 0.0001% of an existing edge when needed to disambiguate junction snaps.', coverageToleranceFraction: EPS, requestedPhysicalEdges: edges.length, requiredDirectedEdges: units.size, coveredDirectedEdges: units.size - uncovered.length, excluded, originalFarthestPair, components: componentReports, unreachableCandidates: rejected, uncovered } };
}
