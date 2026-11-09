// Independent read-only source-rail checks. No production path/grade helpers.
const finite = Number.isFinite;
const id = x => x == null ? null : String(x);
const wayId = x => x == null ? null : String(x).startsWith('w') ? String(x) : 'w' + x;
const yes = x => /^(yes|true|1)$/.test(String(x));
const no = x => /^(no|false|0)$/.test(String(x));
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
const sameIds = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));
function decode(delta, q) {
    if (!Array.isArray(delta) || delta.length % 2 || !(q > 0)) return null;
    const out = []; let x = 0, z = 0;
    for (let i = 0; i < delta.length; i += 2) { x += delta[i]; z += delta[i + 1]; if (![x, z].every(finite)) return null; out.push([x / q, z / q]); }
    return out;
}
function sourceDirections(way, ways, routes) {
    const t = way.tags || {}, raw = t['oneway:tram'] ?? t.oneway;
    if (yes(raw)) return [1]; if (String(raw) === '-1') return [-1]; if (no(raw)) return [1, -1]; if (raw != null) return [];
    const found = new Set(), ends = w => w?.nodeIds?.length ? [id(w.nodeIds[0]), id(w.nodeIds.at(-1))] : [];
    for (const route of routes || []) {
        if (route.tags?.type !== 'route' || route.tags?.route !== 'tram') continue;
        const members = (route.members || []).filter(m => m.type === 'way' && !/^(platform|stop)/.test(m.role || ''));
        for (let i = 0; i < members.length; i++) {
            const m = members[i]; if (wayId(m.ref) !== way.sourceId) continue;
            if (m.role === 'forward' || m.role === 'backward') { found.add(m.role === 'forward' ? 1 : -1); continue; }
            if (m.role) continue;
            const before = ends(ways.get(wayId(members[i - 1]?.ref))), after = ends(ways.get(wayId(members[i + 1]?.ref)));
            const forward = before.includes(id(way.nodeIds[0])) || after.includes(id(way.nodeIds.at(-1)));
            const backward = before.includes(id(way.nodeIds.at(-1))) || after.includes(id(way.nodeIds[0]));
            if (forward !== backward) found.add(forward ? 1 : -1);
        }
    }
    return [...found];
}
function sourceDenied(t) {
    if (t.railway !== 'tram' || yes(t.disused) || yes(t.abandoned) || t.construction || t.proposed || t['disused:railway'] || t['abandoned:railway']) return true;
    if (['yard', 'siding', 'spur'].includes(t.service) || t.usage === 'depot') return true;
    if (Object.keys(t).some(k => /^(access|vehicle|tram):conditional$/.test(k))) return true;
    const value = t.tram ?? t.vehicle ?? t.access;
    return value != null && !['yes', 'designated', 'permissive'].includes(value);
}
function inRing(x, z, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, az] = ring[j], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, n = dx * dx + dz * dz;
        const t = n ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / n)) : 0;
        if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1e-7) return true;
        if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) inside = !inside;
    }
    return inside;
}
function gradeHeight(way, a, b, t, ribbons, halfWidth) {
    const tags = way.tags || {}, layer = tags.layer == null ? 0 : Number(tags.layer);
    if (layer === 0 && (tags.bridge == null || no(tags.bridge)) && (tags.tunnel == null || no(tags.tunnel)) && tags.ele == null && tags.incline == null) return { y: 0, basis: 'estimated-native-flat-local-datum' };
    // A source layer is compatibility metadata, never a metre conversion.
    if (!yes(tags.bridge) || tags.layer == null || !finite(layer) || (tags.tunnel != null && !no(tags.tunnel))) return null;
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len, values = [], decks = new Set();
    for (const offset of [-halfWidth, 0, halfWidth]) {
        const x = a[0] + dx * t + nx * offset, z = a[1] + dz * t + nz * offset, heights = [];
        for (const r of ribbons || []) {
            const e = r.edge;
            if (!e?.bridge || e.tunnel || Number(e.layer || 0) !== layer || !r.poly?.length || !inRing(x, z, r.poly)) continue;
            const ex = e.b.x - e.a.x, ez = e.b.z - e.a.z, l2 = ex * ex + ez * ez;
            const q = l2 ? Math.max(0, Math.min(1, ((x - e.a.x) * ex + (z - e.a.z) * ez) / l2)) : 0;
            const ya = e.ya ?? e.a.y, yb = e.yb ?? e.b.y;
            if (!finite(ya) || !finite(yb)) continue;
            heights.push(ya + (yb - ya) * q); decks.add(e.sourceId ?? e.id);
        }
        if (!heights.length || Math.max(...heights) - Math.min(...heights) > .05) return null;
        values.push(heights[0]);
    }
    return Math.max(...values) - Math.min(...values) <= .05 ? { y: values[1], basis: 'relative-native-source-deck-full-width-containment', sourceDeckIds: [...decks] } : null;
}

/** Snapshot fields are plain copies of source data, native graph and actors.
 * Publication checks initial source assignment; motion permits legal advances.
 * Source coverage gaps stay distinct from an individually legal actor pose.
 */
export function auditRailBinding(S, { stage = 'publication', toleranceM = 1e-5, toleranceRad = 1e-5, requireFinalModes = false } = {}) {
    const issues = [], coverageGaps = [], checks = [], binding = S.binding, actors = S.actors || [], expectedIds = S.constructorTramIds || [];
    const fail = (type, fields = {}) => issues.push({ type, ...fields });
    if (!binding || typeof binding.passed !== 'boolean') fail('missing-initial-tram-binding');
    else {
        if (!binding.passed) fail('initial-tram-binding-failed', { unresolved: binding.unresolved || [] });
        if (binding.rngDraws !== 0) fail('tram-binding-rng-coverage', { rngDraws: binding.rngDraws });
        if (binding.unresolved?.length) fail('unresolved-tram-binding', { unresolved: binding.unresolved });
    }
    const currentIds = actors.map(v => v.id), boundIds = (binding?.bindings || []).map(v => v.id);
    if (!sameIds(expectedIds, currentIds) || !sameIds(expectedIds, boundIds)) fail('tram-identity-or-binding-cardinality', { constructorIds: expectedIds, currentIds, boundIds });
    if (requireFinalModes) {
        if (!Array.isArray(S.admissionMode?.invalidRailModes)) fail('missing-rail-mode-admission-record');
        else if (S.admissionMode.invalidRailModes.length) fail('invalid-rail-mode-admission-record', { invalidRailModes: S.admissionMode.invalidRailModes });
        if (!Array.isArray(S.allActorModes)) fail('missing-all-actor-mode-snapshot');
        for (const v of S.allActorModes || []) {
            if (!v.tram && v.rail) fail('ordinary-vehicle-on-source-rail', { id: v.id, edgeId: v.edgeId });
            if (v.tram && (!v.rail || v.publicTram !== true || v.throughTram !== true || v.publicDrive !== false || v.throughAccess !== false || !v.railDirections?.includes(v.dir))) fail('invalid-tram-source-mode-assignment', { id: v.id, edgeId: v.edgeId, dir: v.dir });
        }
        for (const e of S.graph?.edges || []) if (e.rail && (e.publicTram !== true || e.throughTram !== true || e.publicDrive !== false || e.throughAccess !== false)) fail('source-rail-exposes-motor-navigation-mode', { edgeId: e.id, sourceId: e.sourceId });
        if (S.data?.trams?.length && (!Array.isArray(S.data.tramSourceWays) || !Array.isArray(S.data.tramSources) || S.data.tramSources.length !== S.data.trams.length || !Array.isArray(S.data.tramRoutes) || !S.data.tramSourceNodeTags)) fail('missing-source-rail-metadata');
    }
    if (!actors.length && !expectedIds.length && !boundIds.length) return { passed: !issues.length, stage, issues, coverageGaps, checks, noTrams: true, scope: 'No native tram actors; no rail graph or source pose inferred' };
    const D = S.data || {}, graph = S.graph || {}, edges = new Map((graph.edges || []).map(e => [id(e.id), e]));
    if (!Array.isArray(D.tramSourceWays) || !Array.isArray(D.tramSources) || !Array.isArray(D.trams) || D.tramSources.length !== D.trams.length || !Array.isArray(D.tramRoutes) || !D.tramSourceNodeTags) {
        fail('missing-source-rail-metadata'); return { passed: false, stage, issues, coverageGaps, checks };
    }
    if (requireFinalModes) {
        if (!Array.isArray(graph.nodes) || !Array.isArray(S.motorGraph?.nodes) || !Array.isArray(S.tramMotorCrossings)) fail('missing-native-source-crossing-topology');
        const motorById = new Map((S.motorGraph?.nodes || []).map(n => [id(n.id), n]));
        const motorBySource = new Map((S.motorGraph?.nodes || []).filter(n => n.sourceId != null).map(n => [id(n.sourceId), n]));
        for (const n of graph.nodes || []) {
            const expected = motorBySource.get(id(n.sourceId)), motor = motorById.get(id(n.motorNodeId));
            if (n.motorSourceNodeId != null && (!motor || id(n.motorSourceNodeId) !== id(n.sourceId) || id(motor.sourceId) !== id(n.sourceId) || Math.hypot(n.x - motor.x, n.z - motor.z) > Math.SQRT2 / (2 * (D.q || 10)) + toleranceM)) fail('wrong-source-rail-motor-crossing-identity', { sourceNodeId: n.sourceId, motorNodeId: n.motorNodeId });
            if (expected && n.orderedEdgeIds?.length && (!motor || id(motor.id) !== id(expected.id) || !S.tramMotorCrossings.some(x => id(x) === id(expected.id)))) fail('source-rail-crossing-not-registered-with-motor-controller', { sourceNodeId: n.sourceId, motorNodeId: expected.id });
        }
    }
    const ways = new Map(D.tramSourceWays.map(w => [wayId(w.sourceId ?? w.id), { ...w, sourceId: wayId(w.sourceId ?? w.id) }])), coverage = new Map();
    for (let i = 0; i < D.tramSources.length; i++) {
        const run = D.tramSources[i], points = decode(D.trams[i], D.q || 10), nodes = run.nodeIds;
        if (!points || !Array.isArray(nodes) || points.length !== nodes.length) { coverageGaps.push({ type: 'invalid-rendered-source-rail-run', run: i }); continue; }
        let pairs = coverage.get(wayId(run.sourceId)); if (!pairs) coverage.set(wayId(run.sourceId), pairs = new Map());
        for (let j = 1; j < nodes.length; j++) pairs.set(id(nodes[j - 1]) + '>' + id(nodes[j]), [points[j - 1], points[j]]);
    }
    const cache = new Map();
    function legal(e) {
        if (!e) return null;
        if (cache.has(id(e.id))) return cache.get(id(e.id));
        const source = ways.get(wayId(e.sourceId)), points = source && decode(source.points, D.q || 10), nodes = source?.nodeIds, segment = e.sourceSegment;
        let reason = null;
        if (!source || !points || !nodes || nodes.length !== points.length || source.missingNodeIds?.length || !Number.isInteger(segment) || segment < 0 || segment >= nodes.length - 1) reason = 'incomplete-or-unknown-source-way-leg';
        else if (!e.rail || !e.tramOnly || !e.modeled || !e.usable || sourceDenied(source.tags || {})) reason = 'motor-or-inactive-unmodeled-track-assignment';
        else if (id(e.sourceNodeIds?.[0]) !== id(nodes[segment]) || id(e.sourceNodeIds?.[1]) !== id(nodes[segment + 1]) || id(e.a?.sourceId) !== id(nodes[segment]) || id(e.b?.sourceId) !== id(nodes[segment + 1])) reason = 'wrong-source-track-node-order';
        const directions = source ? sourceDirections(source, ways, D.tramRoutes).sort() : [];
        if (!reason && (!directions.length || JSON.stringify([...(e.railDirections || [])].sort()) !== JSON.stringify(directions))) reason = 'unsupported-or-reverse-source-track-direction';
        if (!reason) {
            const a = points[segment], b = points[segment + 1], selected = coverage.get(source.sourceId)?.get(id(nodes[segment]) + '>' + id(nodes[segment + 1]));
            if (!selected || Math.hypot(e.a.x - a[0], e.a.z - a[1], e.b.x - b[0], e.b.z - b[1]) > toleranceM || selected.some((p, i) => Math.hypot(p[0] - [a, b][i][0], p[1] - [a, b][i][1]) > toleranceM)) reason = 'source-track-coordinate-or-rendered-run-mismatch';
            else {
                const ga = gradeHeight(source, a, b, 0, S.ribbons, e.grade?.bodyHalfWidthM || 1.2), gb = gradeHeight(source, a, b, 1, S.ribbons, e.grade?.bodyHalfWidthM || 1.2);
                if (!e.grade?.known || !ga || !gb || ![e.ya, e.yb, e.grade.ya, e.grade.yb].every(finite) || Math.max(Math.abs(e.ya - ga.y), Math.abs(e.yb - gb.y), Math.abs(e.grade.ya - ga.y), Math.abs(e.grade.yb - gb.y)) > toleranceM) reason = 'unsupported-or-wrong-native-source-rail-grade';
            }
        }
        if (reason) { const result = { invalid: reason }; cache.set(id(e.id), result); return result; }
        const result = { source, points, directions, a: points[segment], b: points[segment + 1] }; cache.set(id(e.id), result); return result;
    }
    function sample(v, offset) {
        let edge = edges.get(id(v.edgeId)), dir = v.dir, station = v.s + offset, next = 0, previous = (v.hist || []).length - 1;
        for (let guard = 0; guard < 256; guard++) {
            const check = legal(edge); if (!check || check.invalid || !check.directions.includes(dir)) return null;
            const length = Math.hypot(check.b[0] - check.a[0], check.b[1] - check.a[1]); if (!(length > 0)) return null;
            if (station >= -1e-8 && station <= length + 1e-8) {
                const t = dir > 0 ? station / length : 1 - station / length, grade = gradeHeight(check.source, check.a, check.b, t, S.ribbons, v.width / 2);
                if (!grade || !edge.grade?.known) return null;
                return { x: check.a[0] + (check.b[0] - check.a[0]) * t, z: check.a[1] + (check.b[1] - check.a[1]) * t, y: grade.y, edgeId: edge.id, dir, station, grade };
            }
            const forward = station > length, endpoint = id(forward ? (dir > 0 ? edge.b.sourceId : edge.a.sourceId) : (dir > 0 ? edge.a.sourceId : edge.b.sourceId));
            const choices = [...edges.values()].filter(e => e !== edge).flatMap(e => [1, -1].map(d => ({ edge: e, dir: d }))).filter(r => {
                const c = legal(r.edge); return c && !c.invalid && c.directions.includes(r.dir) && id(forward ? (r.dir > 0 ? r.edge.a.sourceId : r.edge.b.sourceId) : (r.dir > 0 ? r.edge.b.sourceId : r.edge.a.sourceId)) === endpoint;
            });
            const saved = forward ? v.route?.[next++] : v.hist?.[previous--], match = saved && choices.find(r => id(r.edge.id) === id(saved.edgeId) && r.dir === saved.dir);
            const selected = match || (!saved && choices.length === 1 ? choices[0] : null); if (!selected) return null;
            if (forward) station -= length;
            else { const c = legal(selected.edge); station += Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]); }
            edge = selected.edge; dir = selected.dir;
        }
        return null;
    }
    for (const v of actors) {
        const e = edges.get(id(v.edgeId)), check = legal(e), row = { id: v.id, sourceId: e?.sourceId, edgeId: v.edgeId, dir: v.dir, station: v.s, stop: v.stop };
        checks.push(row);
        if (!check || check.invalid) { fail(check?.invalid || 'missing-native-rail-edge', { id: v.id, edgeId: v.edgeId }); continue; }
        if (!check.directions.includes(v.dir)) { fail('illegal-source-tram-direction', { id: v.id, dir: v.dir, allowed: check.directions }); continue; }
        if (![v.x, v.y, v.z, v.heading, v.pitch, v.s, v.length, v.width].every(finite) || !(v.length > 0) || !(v.width > 0)) { fail('unknown-native-tram-pose', { id: v.id }); continue; }
        if (Math.abs(v.roll || 0) > toleranceRad) fail('unsupported-source-tram-body-bank', { id: v.id, roll: v.roll });
        const length = Math.hypot(check.b[0] - check.a[0], check.b[1] - check.a[1]);
        if (v.s < -toleranceM || v.s > length + toleranceM) { fail('tram-centre-outside-literal-source-leg', { id: v.id, station: v.s, length }); continue; }
        const centre = sample(v, 0), front = sample(v, v.length * .36), rear = sample(v, -v.length * .36);
        if (!centre || !front || !rear) { fail('unresolved-source-connected-body-span-or-grade', { id: v.id }); continue; }
        row.expected = { x: centre.x, y: centre.y + .24, z: centre.z, heading: Math.atan2(-(front.x - rear.x), -(front.z - rear.z)), pitch: Math.atan2(front.y - rear.y, Math.hypot(front.x - rear.x, front.z - rear.z)) };
        row.errors = { centreM: Math.hypot(v.x - row.expected.x, v.y - row.expected.y, v.z - row.expected.z), headingRad: Math.abs(wrap(v.heading - row.expected.heading)), pitchRad: Math.abs(wrap(v.pitch - row.expected.pitch)) };
        if (row.errors.centreM > toleranceM || row.errors.headingRad > toleranceRad || row.errors.pitchRad > toleranceRad) fail('tram-off-source-centre-or-axle-pose', { id: v.id, errors: row.errors, expected: row.expected });
        const stop = v.stop?.servedSourceNodeId;
        const tags = D.tramSourceNodeTags[id(stop)] || {};
        if (stop != null && tags.railway !== 'tram_stop' && tags.public_transport !== 'stop_position') fail('unmapped-served-tram-stop', { id: v.id, sourceNodeId: stop });
        const b = (binding?.bindings || []).find(b => b.id === v.id);
        if (b) {
            if (![b.before?.x, b.before?.z, b.after?.x, b.after?.y, b.after?.z, b.after?.heading, b.distanceM].every(finite)) fail('incomplete-tram-binding-correction-record', { id: v.id });
            else if (Math.abs(Math.hypot(b.after.x - b.before.x, b.after.z - b.before.z) - b.distanceM) > toleranceM) fail('tram-binding-correction-distance-mismatch', { id: v.id });
            if (stage === 'publication' && (id(b.after?.edgeId) !== id(v.edgeId) || b.after?.dir !== v.dir || wayId(b.after?.sourceId) !== wayId(e.sourceId))) fail('initial-tram-binding-source-assignment-changed', { id: v.id });
        }
    }
    if (binding?.source?.unresolved?.length) coverageGaps.push(...binding.source.unresolved.map(x => ({ type: 'unresolved-native-source-rail-coverage', ...x })));
    return { passed: !issues.length && !coverageGaps.length, stage, issues, coverageGaps, checks, bindingPassed: binding?.passed === true, constructorTramIds: expectedIds, sourceCoverageResolved: !coverageGaps.length, scope: 'Independent source tags/ordered nodes/geometry/grade/axle pose; native physical/static/publication/stop/crossing gates remain separate' };
}
