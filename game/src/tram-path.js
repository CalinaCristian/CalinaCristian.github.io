// Directed source tram paths. No motor-road topology, offset, actor or RNG writes.
const yes = v => /^(yes|true|1)$/.test(String(v));
const no = v => /^(no|false|0)$/.test(String(v));
const sourceId = (id, prefix = 'w') => String(id).startsWith(prefix) ? String(id) : prefix + id;
const nodeId = id => String(id);
const pair = (a, b) => nodeId(a) + '>' + nodeId(b);
const finitePoint = p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite);

export function decodeTramPoints(delta, q = 10) {
    if (!Array.isArray(delta) || delta.length % 2 || !(q > 0)) return null;
    const points = []; let x = 0, z = 0;
    for (let i = 0; i < delta.length; i += 2) { x += delta[i]; z += delta[i + 1]; points.push([x / q, z / q]); }
    return points.every(finitePoint) ? points : null;
}

function routeDirections(ways, routes) {
    const directions = new Map();
    const add = (id, dir, route) => { let values = directions.get(id); if (!values) directions.set(id, values = []); if (!values.some(v => v.dir === dir && v.route === route)) values.push({ dir, route }); };
    for (const route of routes || []) {
        if (route.tags?.route !== 'tram' || route.tags?.type !== 'route') continue;
        // Missing way members keep their position: never infer adjacency across
        // an absent source way. Stop/platform members are not running rails.
        const members = (route.members || []).filter(m => m.type === 'way' && !/^(platform|stop)/.test(m.role || ''));
        for (let i = 0; i < members.length; i++) {
            const member = members[i], id = sourceId(member.ref), way = ways.get(id), nodes = way?.nodeIds;
            if (!nodes?.length) continue;
            if (member.role === 'forward' || member.role === 'backward') { add(id, member.role === 'forward' ? 1 : -1, route.sourceId); continue; }
            if (member.role) continue;
            const previous = ways.get(sourceId(members[i - 1]?.ref)), next = ways.get(sourceId(members[i + 1]?.ref));
            const first = nodeId(nodes[0]), last = nodeId(nodes.at(-1));
            const ends = w => w?.nodeIds?.length ? new Set([nodeId(w.nodeIds[0]), nodeId(w.nodeIds.at(-1))]) : new Set();
            const before = ends(previous), after = ends(next);
            const forward = before.has(first) || after.has(last), backward = before.has(last) || after.has(first);
            if (forward !== backward) add(id, forward ? 1 : -1, route.sourceId);
        }
    }
    return directions;
}

function legalDirections(way, routeEvidence) {
    const t = way.tags || {}, value = t['oneway:tram'] ?? t.oneway;
    if (yes(value)) return { directions: [1], basis: 'explicit-source-oneway', value };
    if (String(value) === '-1') return { directions: [-1], basis: 'explicit-source-oneway', value };
    if (no(value)) return { directions: [1, -1], basis: 'explicit-source-two-way', value };
    if (value != null) return { directions: [], reason: 'unsupported-source-direction', value };
    const directions = [...new Set((routeEvidence || []).map(v => v.dir))];
    return directions.length ? { directions, basis: 'ordered-source-tram-route', routeEvidence } : { directions: [], reason: 'unresolved-source-rail-direction' };
}

function sourceAccess(way) {
    const t = way.tags || {};
    if (t.railway !== 'tram' || t.disused === 'yes' || t.abandoned === 'yes' || t.construction || t.proposed || t['disused:railway'] || t['abandoned:railway']) return 'inactive-or-non-tram-source';
    if (['yard', 'siding', 'spur'].includes(t.service) || t.usage === 'depot') return 'non-revenue-source-track';
    if (Object.keys(t).some(k => /^(access|vehicle|tram):conditional$/.test(k))) return 'unresolved-conditional-rail-access';
    const access = t.tram ?? t.vehicle ?? t.access;
    if (access != null && !['yes', 'designated', 'permissive'].includes(access)) return 'restricted-source-rail-access';
    return null;
}

function sourceSpeed(tags) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(mph|km\/h|kph)?\s*$/.exec(String(tags?.maxspeed ?? ''));
    return match ? Number(match[1]) * (match[2] === 'mph' ? .44704 : 1 / 3.6) : null;
}

/** Default local datum follows the existing flat-world model, explicitly
 * estimated. A tag is never converted from layer/level to metres. */
export function flatTramGrade(way) {
    const t = way.tags || {}, layer = t.layer == null ? 0 : Number(t.layer);
    if (!Number.isFinite(layer) || layer !== 0 || (t.bridge != null && !no(t.bridge)) || (t.tunnel != null && !no(t.tunnel)) || t.ele != null || t.incline != null) return null;
    return { known: true, ya: 0, yb: 0, estimated: true, basis: 'existing-unsurveyed-flat-local-ground-datum' };
}

function pointInRing(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
        if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1e-7) return true;
        if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) inside = !inside;
    }
    return inside;
}

/** Relative model constraint only: a tagged rail bridge may use an existing
 * compatible native deck where its actual body support is contained. There is
 * no nearest-edge search, layer-to-height arithmetic or mutation. */
export function nativeTramGradeResolver(world, { bodyHalfWidthM = 1.2, sampleStepM = .5, heightToleranceM = .05 } = {}) {
    const ribbons = (world?.ribbons || []).filter(r => r.e?.bridge && !r.e.tunnel && r.poly?.length >= 3).map(r => ({ ...r,
        x0: Math.min(...r.poly.map(p => p[0])), x1: Math.max(...r.poly.map(p => p[0])), z0: Math.min(...r.poly.map(p => p[1])), z1: Math.max(...r.poly.map(p => p[1])) }));
    return (way, leg) => {
        const flat = flatTramGrade(way); if (flat) return flat;
        const tags = way.tags || {}, layer = tags.layer == null ? null : Number(tags.layer);
        if (!yes(tags.bridge) || (tags.tunnel != null && !no(tags.tunnel)) || !Number.isFinite(layer)) return { known: false, basis: 'unresolved-source-rail-grade' };
        const dx = leg.b.x - leg.a.x, dz = leg.b.z - leg.a.z, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
        const candidates = ribbons.filter(r => Number(r.e.layer || 0) === layer && r.x1 >= Math.min(leg.a.x, leg.b.x) - bodyHalfWidthM && r.x0 <= Math.max(leg.a.x, leg.b.x) + bodyHalfWidthM && r.z1 >= Math.min(leg.a.z, leg.b.z) - bodyHalfWidthM && r.z0 <= Math.max(leg.a.z, leg.b.z) + bodyHalfWidthM);
        const used = new Set();
        const heightAt = t => {
            const heights = [], x = leg.a.x + dx * t, z = leg.a.z + dz * t;
            for (const offset of [-bodyHalfWidthM, 0, bodyHalfWidthM]) {
                const px = x + nx * offset, pz = z + nz * offset, values = [];
                for (const r of candidates) if (pointInRing(px, pz, r.poly)) {
                    const e = r.e, s = Math.max(0, Math.min(1, ((px - e.a.x) * e.dirx + (pz - e.a.z) * e.dirz) / e.len)), ya = e.ya ?? e.a.y, yb = e.yb ?? e.b.y;
                    if (!Number.isFinite(ya) || !Number.isFinite(yb)) continue;
                    values.push(ya + (yb - ya) * s); used.add(e.access?.sourceId || e.sourceId || e.id);
                }
                if (!values.length || Math.max(...values) - Math.min(...values) > heightToleranceM) return null;
                heights.push(values[0]);
            }
            if (Math.max(...heights) - Math.min(...heights) > heightToleranceM) return null;
            return heights[1];
        };
        const n = Math.max(1, Math.ceil(len / sampleStepM));
        for (let i = 0; i <= n; i++) if (!Number.isFinite(heightAt(i / n))) return { known: false, basis: 'tagged-rail-bridge-body-not-contained-in-consistent-native-source-deck', candidateSourceIds: candidates.map(r => r.e.access?.sourceId || r.e.sourceId || r.e.id) };
        return { known: true, ya: heightAt(0), yb: heightAt(1), heightAt, estimated: true, basis: 'relative-existing-native-source-bridge-deck-containment-not-surveyed', sourceDeckIds: [...used], sourceLayerUsedForCompatibilityOnly: layer, bodyHalfWidthM, sampleStepM };
    };
}

/** Complete source geometry is retained; only unchanged rendered-run segments
 * are admitted to the modeled graph. Missing metadata never falls back to a
 * nearby motor way. Physical crossing ownership uses equal source node IDs. */
export function buildTramNetwork(data, { motorNodes = [], resolveGrade = null } = {}) {
    const report = { unresolved: [], retainedUnmodeled: [], sourceWays: 0, modeledSegments: 0, admittedSegments: 0, sourceNodeCrossings: [] };
    const graph = { nodes: [], edges: [], allEdges: [], ways: new Map(), bySourceNode: new Map(), report };
    if (!Array.isArray(data?.tramSourceWays) || !Array.isArray(data?.tramSources) || data.tramSources.length !== data.trams?.length) { report.unresolved.push({ reason: 'missing-source-rail-metadata' }); return graph; }
    const ways = graph.ways;
    for (const w of data.tramSourceWays) ways.set(sourceId(w.sourceId ?? w.id), { ...w, sourceId: sourceId(w.sourceId ?? w.id) });
    report.sourceWays = ways.size;
    const directionEvidence = routeDirections(ways, data.tramRoutes), coverage = new Map(), motor = new Map();
    for (const n of motorNodes) if (n.sourceId != null) motor.set(nodeId(n.sourceId), n);
    for (let i = 0; i < data.tramSources.length; i++) {
        const run = data.tramSources[i], id = sourceId(run?.sourceId), points = decodeTramPoints(data.trams[i], data.q || 10), ids = run?.nodeIds;
        if (!ways.has(id) || !Array.isArray(ids) || points?.length !== ids.length) { report.unresolved.push({ sourceId: id, run: i, reason: 'invalid-rendered-source-run' }); continue; }
        let selected = coverage.get(id); if (!selected) coverage.set(id, selected = new Set());
        for (let j = 1; j < ids.length; j++) selected.add(pair(ids[j - 1], ids[j]));
    }
    const getNode = (id, point) => {
        const key = nodeId(id), existing = graph.bySourceNode.get(key);
        if (existing) { if (Math.hypot(existing.x - point[0], existing.z - point[1]) > 1e-6) { existing.sourceCoordinateConflict = true; report.unresolved.push({ nodeId: id, reason: 'inconsistent-source-node-coordinates' }); } return existing; }
        const tags = data.tramSourceNodeTags?.[key] || {}, motorNode = motor.get(key), n = { id: 'rail-node:' + key, sourceId: id, x: point[0], z: point[1], edges: [], tags, radius: motorNode?.radius ?? 0, hasLight: false, motorNode };
        if (motorNode) report.sourceNodeCrossings.push({ sourceNodeId: id, motorNodeId: motorNode.id, motorEdges: motorNode.edges?.map(e => e.id) || motorNode.orderedEdgeIds || [] });
        graph.bySourceNode.set(key, n); graph.nodes.push(n); return n;
    };
    for (const way of ways.values()) {
        const points = decodeTramPoints(way.points, data.q || 10), ids = way.nodeIds, directions = legalDirections(way, directionEvidence.get(way.sourceId)), denied = sourceAccess(way);
        if (!points || !Array.isArray(ids) || ids.length !== points.length || way.missingNodeIds?.length) { report.unresolved.push({ sourceId: way.sourceId, reason: 'incomplete-source-way-geometry', missingNodeIds: way.missingNodeIds || [] }); continue; }
        if (denied || !directions.directions.length) (coverage.has(way.sourceId) ? report.unresolved : report.retainedUnmodeled).push({ sourceId: way.sourceId, reason: denied || directions.reason });
        for (let i = 1; i < points.length; i++) {
            const a = getNode(ids[i - 1], points[i - 1]), b = getNode(ids[i], points[i]), dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), modeled = coverage.get(way.sourceId)?.has(pair(ids[i - 1], ids[i])) || false;
            if (!(len > 1e-7)) { report.unresolved.push({ sourceId: way.sourceId, sourceNodeIds: [ids[i - 1], ids[i]], reason: 'zero-length-source-leg' }); continue; }
            const grade = (resolveGrade?.(way, { a, b, index: i - 1, len }) ?? flatTramGrade(way));
            const known = grade?.known === true && [grade.ya, grade.yb].every(Number.isFinite);
            const usable = modeled && !denied && directions.directions.length > 0 && known;
            const edge = { id: 'rail:' + way.sourceId + ':' + (i - 1), sourceId: way.sourceId, sourceNodeIds: [ids[i - 1], ids[i]], sourceSegment: i - 1, sourceTags: way.tags, a, b, len, dirx: dx / len, dirz: dz / len, nx: -dz / len, nz: dx / len, rail: true, tram: true, tramOnly: true, modeled, usable, railDirections: directions.directions, directionEvidence: directions, grade: known ? grade : { known: false, basis: 'unresolved-source-rail-grade' }, ya: known ? grade.ya : null, yb: known ? grade.yb : null, bridge: way.tags?.bridge != null && !no(way.tags.bridge), tunnel: way.tags?.tunnel != null && !no(way.tags.tunnel), layer: Number(way.tags?.layer || 0), type: 'tram', name: way.tags?.name || '', lanesF: directions.directions.includes(1) ? 1 : 0, lanesB: directions.directions.includes(-1) ? 1 : 0, oneway: !directions.directions.includes(-1), laneW: 0, median: 0, laneCenterShiftM: 0, publicDrive: usable, throughAccess: usable, access: { sourceId: way.sourceId, mode: 'tram', tags: way.tags } };
            const speed = sourceSpeed(way.tags); if (speed != null) edge.maxspeed = speed;
            graph.allEdges.push(edge);
            if (modeled) { report.modeledSegments++; if (!known) report.unresolved.push({ sourceId: way.sourceId, sourceNodeIds: edge.sourceNodeIds, reason: 'unresolved-source-rail-grade' }); }
            if (usable) { graph.edges.push(edge); a.edges.push(edge); b.edges.push(edge); report.admittedSegments++; }
        }
    }
    // Source-connected legs cannot acquire an elevation seam from different
    // assumptions. A conflicting datum stays unresolved rather than snapping.
    for (const n of graph.nodes) {
        const values = n.edges.map(e => e.a === n ? e.ya : e.yb);
        if (Number.isFinite(n.motorNode?.y)) values.push(n.motorNode.y);
        if (n.sourceCoordinateConflict || (values.length && Math.max(...values) - Math.min(...values) > .05)) {
            report.unresolved.push({ sourceNodeId: n.sourceId, reason: 'inconsistent-connected-rail-grade', heights: values });
            for (const e of n.edges) e.usable = e.publicDrive = e.throughAccess = false;
        } else if (values.length) n.y = values[0];
    }
    graph.edges = graph.edges.filter(e => e.usable);
    for (const n of graph.nodes) n.edges = n.edges.filter(e => e.usable);
    report.admittedSegments = graph.edges.length;
    return graph;
}

export function canTravelTram(edge, dir) { return edge?.rail === true && edge.usable === true && edge.railDirections.includes(dir); }

export function tramContinuations(edge, dir) {
    const node = dir > 0 ? edge.b : edge.a;
    return node.edges.filter(e => e !== edge).map(e => ({ e, dir: e.a === node ? 1 : -1 })).filter(r => canTravelTram(r.e, r.dir));
}

/** A literal connected-leg sample. No junction chord, lane offset or extension
 * past missing source geometry. Route forks need an actual selected source leg. */
export function sampleTramPath(vehicle, off = 0) {
    let edge = vehicle.edge, dir = vehicle.dir, s = vehicle.s + off, ri = 0, hi = (vehicle.hist?.length || 0) - 1;
    if (!canTravelTram(edge, dir)) return null;
    for (let guard = 0; guard < 256; guard++) {
        if (s >= 0 && s <= edge.len) {
            const t = dir > 0 ? s / edge.len : 1 - s / edge.len, y = edge.grade.heightAt ? edge.grade.heightAt(t) : edge.ya + (edge.yb - edge.ya) * t;
            if (!Number.isFinite(y)) return null;
            return { x: edge.a.x + (edge.b.x - edge.a.x) * t, z: edge.a.z + (edge.b.z - edge.a.z) * t, y, fx: edge.dirx * dir, fz: edge.dirz * dir, edge, dir, s };
        }
        if (s > edge.len) {
            const choices = tramContinuations(edge, dir), selected = vehicle.route?.[ri++] || (choices.length === 1 ? choices[0] : null);
            if (!selected || !choices.some(c => c.e === selected.e && c.dir === selected.dir)) return null;
            s -= edge.len; edge = selected.e; dir = selected.dir;
        } else {
            const start = dir > 0 ? edge.a : edge.b, history = vehicle.hist?.[hi--];
            let previous = history && (history.dir > 0 ? history.e.b : history.e.a) === start && canTravelTram(history.e, history.dir) ? history : null;
            if (!previous) { const choices = start.edges.filter(e => e !== edge).map(e => ({ e, dir: e.b === start ? 1 : -1 })).filter(r => canTravelTram(r.e, r.dir)); if (choices.length === 1) previous = choices[0]; }
            if (!previous) return null;
            edge = previous.e; dir = previous.dir; s += edge.len;
        }
    }
    return null;
}

export function tramSpan(edge, dir, length) {
    if (!canTravelTram(edge, dir) || !(length > 0)) return null;
    const distance = forward => {
        let e = edge, d = dir, n = forward ? (d > 0 ? e.b : e.a) : (d > 0 ? e.a : e.b), total = 0;
        for (let guard = 0; guard < 256 && total < length; guard++) {
            const choices = n.edges.filter(q => q !== e).map(q => ({ e: q, dir: forward ? (q.a === n ? 1 : -1) : (q.b === n ? 1 : -1) })).filter(r => canTravelTram(r.e, r.dir));
            if (choices.length !== 1 || n.motorNode || n.tags?.railway === 'signal' || n.tags?.highway === 'traffic_signals') break;
            e = choices[0].e; d = choices[0].dir; total += e.len; n = forward ? (d > 0 ? e.b : e.a) : (d > 0 ? e.a : e.b);
        }
        return total;
    };
    const lo = Math.max(.05, length / 2 - distance(false)), hi = Math.min(edge.len - .05, edge.len - length / 2 + distance(true));
    return hi > lo ? [lo, hi] : null;
}

/** Reservation geometry retains each literal source bend, including short
 * legs inside a pad. The returned pieces never shortcut a mapped vertex. */
export function tramPathPolyline(vehicle, startOff, endOff) {
    if (!(endOff >= startOff)) return null;
    const segments = []; let cursor = startOff, p = sampleTramPath(vehicle, cursor);
    if (!p) return null;
    for (let guard = 0; guard < 256 && cursor < endOff - 1e-9; guard++) {
        const distance = Math.min(endOff - cursor, p.edge.len - p.s), nextOff = cursor + distance;
        const q = { x: p.x + p.fx * distance, z: p.z + p.fz * distance };
        if (distance > 1e-9) segments.push({ p0x: p.x, p0z: p.z, p1x: q.x, p1z: q.z, sourceEdge: p.edge });
        cursor = nextOff;
        if (cursor >= endOff - 1e-9) return segments;
        const probe = sampleTramPath(vehicle, cursor + 1e-7); if (!probe || probe.edge === p.edge) return null;
        // Epsilon chooses the next source leg only; its exact shared endpoint
        // supplies the geometry, so no epsilon gap or invented vertex remains.
        const node = probe.dir > 0 ? probe.edge.a : probe.edge.b;
        p = { ...probe, x: node.x, z: node.z, s: 0 };
    }
    return cursor >= endOff - 1e-9 ? segments : null;
}

export function projectTramStations(graph, x, z, heading, length) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading), candidates = [];
    for (const e of graph.edges) for (const dir of e.railDirections) {
        if (e.dirx * dir * fx + e.dirz * dir * fz <= 0) continue;
        const span = tramSpan(e, dir, length); if (!span) continue;
        const raw = ((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz), s = Math.max(span[0], Math.min(span[1], dir > 0 ? raw : e.len - raw)), p = sampleTramPath({ edge: e, dir, s, route: [], hist: [] });
        if (p) candidates.push({ e, dir, s, distance: Math.hypot(p.x - x, p.z - z), span });
    }
    return candidates.sort((a, b) => a.distance - b.distance || String(a.e.id).localeCompare(String(b.e.id)) || a.dir - b.dir);
}
