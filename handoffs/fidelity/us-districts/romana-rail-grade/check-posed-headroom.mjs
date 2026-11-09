import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { buildTramTunnelGrades, ROMANA_TRAM_TUNNEL_MODEL } from '../../../../game/src/tram-tunnel-grade.js';

const [nativeFile, gradeRoot, runtimeRoot, out, stepArg = '5', limitArg, widthArg] = process.argv.slice(2);
if (!out) throw new Error('Pass immutable native JSON, shared grade root, actual Traffic runtime root, output JSON, optional step/limit');
const modulePaths = ['game/src/traffic.js', 'game/src/tram-body-support.js', 'game/src/tram-path.js', 'game/src/vehicles.js'].map(p => path.join(runtimeRoot, p)).concat(path.join(gradeRoot, 'game/src/tram-grade.js'), path.join(gradeRoot, 'game/src/tram-trench.js'), new URL('../../../../game/src/tram-tunnel-grade.js', import.meta.url).pathname);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), initialHashes = Object.fromEntries(modulePaths.map(p => [p, hash(p)]));
const load = (root, file) => import(pathToFileURL(path.join(root, file)));
const [THREE, { Traffic }, { makeVehicle }, rail, { buildTramGrades }, { uncoveredTramTrenchWall }] = await Promise.all([
    load(runtimeRoot, 'game/vendor/three.module.min.js'), load(runtimeRoot, 'game/src/traffic.js'), load(runtimeRoot, 'game/src/vehicles.js'), load(runtimeRoot, 'game/src/tram-path.js'), load(gradeRoot, 'game/src/tram-grade.js'), load(gradeRoot, 'game/src/tram-trench.js'),
]);
const bytes = fs.readFileSync(nativeFile), native = JSON.parse(bytes), tunnel = buildTramTunnelGrades(native.data, { coreEdges: native.allEdges });
const halfWidthOverrideM = Number(widthArg) || null;
if (halfWidthOverrideM) for (const g of tunnel.grades.values()) g.deckHalfWidthM = halfWidthOverrideM;
const grade = buildTramGrades(native.data, { coreEdges: native.allEdges, models: [], extraGrades: tunnel.grades, extraReport: tunnel.report });
const nodes = [...new Map(native.allEdges.flatMap(e => [e.a, e.b]).map(n => [n.id, n])).values()];
const net = rail.buildTramNetwork(native.data, { motorNodes: nodes, resolveGrade: grade.resolveGrade });
const traffic = Object.create(Traffic.prototype); traffic.world = { tramDeckSupportAt: grade.support.at };
const meshes = ['tram-v3a', 'tram-imperio'].map(kind => ({ kind, mesh: makeVehicle(kind, undefined, { city: 'bucharest', instanced: true }) }));
const actualGeometry = meshes.map(({ kind, mesh }) => {
    const attr = mesh.userData._model.geo.attributes.position, local = Array.from({ length: attr.count }, (_, i) => [attr.getX(i), attr.getY(i), attr.getZ(i)]), actor = native.snapshots[0].active.find(v => v.kind === kind && (v.id === 489 || v.id === 490));
    const min = [0, 1, 2].map(k => Math.min(...local.map(p => p[k]))), max = [0, 1, 2].map(k => Math.max(...local.map(p => p[k])));
    assert.equal(attr.count, actor.geometry.vertices); assert.deepEqual(min, actor.geometry.localMin); assert.deepEqual(max, actor.geometry.localMax);
    return { kind, vertices: attr.count, localMin: min, localMax: max, historicalNativeActorId: actor.id, matchesActualNativeConstructorGeometry: true };
});
const box = poly => ({ x0: Math.min(...poly.map(p => p[0])), x1: Math.max(...poly.map(p => p[0])), z0: Math.min(...poly.map(p => p[2])), z1: Math.max(...poly.map(p => p[2])) });
const overlap = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;
function clip(triangle, polygon) {
    const sign = Math.sign(polygon.reduce((s, p, i) => { const q = polygon[(i + 1) % polygon.length]; return s + p[0] * q[1] - p[1] * q[0]; }, 0));
    let result = triangle;
    for (let k = 0; k < polygon.length && result.length; k++) {
        const a = polygon[k], b = polygon[(k + 1) % polygon.length], value = p => sign * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), output = [];
        for (let i = 0; i < result.length; i++) {
            const p = result[i], q = result[(i + 1) % result.length], u = value(p), v = value(q);
            if (u >= -1e-9) output.push(p);
            if ((u >= 0) !== (v >= 0)) { const t = u / (u - v); output.push(p.map((x, j) => x + (q[j] - x) * t)); }
        }
        result = output;
    }
    return result;
}
const surfaces = [];
const walls = [];
const carTubeSources = new Set(['w27008403', 'w241374324', 'w241374325', 'w241374327', 'w669751868', 'w669751870', 'w669751871']);
for (const p of grade.support.pieces) {
    if (Math.min(p.y0, p.y1) >= -1e-8) continue;
    const upper = p.roof ? p.roof.bottomM : 0;
    for (const [ia, ib, side] of [[0, 1, 1], [3, 2, -1]]) {
        const a = p.top[ia], b = p.top[ib], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz), outward = [-dz / length * side, dx / length * side];
        for (const [lo, hi] of uncoveredTramTrenchWall(a, b, outward, grade.support, p.modelId)) {
            const start = a.map((v, i) => v + (b[i] - v) * lo), end = a.map((v, i) => v + (b[i] - v) * hi);
            walls.push({ id: p.id + ':wall:' + side + ':' + lo + ':' + hi, a: start, b: end, upper, sourceId: p.sourceId, bounds: box([start, end]) });
        }
    }
}
function triangleWallIntersection(triangle, wall) {
    const [a, b] = [wall.a, wall.b], dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz, distance = p => dx * (p[2] - a[2]) - dz * (p[0] - a[0]);
    const values = triangle.map(distance); if (values.every(v => v > 1e-8) || values.every(v => v < -1e-8)) return null;
    const points = [];
    for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3, u = values[i], v = values[j];
        if (Math.abs(u) < 1e-8) points.push(triangle[i]);
        if ((u < 0) !== (v < 0)) { const t = u / (u - v); points.push(triangle[i].map((x, k) => x + (triangle[j][k] - x) * t)); }
    }
    if (!points.length) return null;
    const p = points[0], q = points.find(r => Math.hypot(...r.map((v, k) => v - p[k])) > 1e-8) || p, station = r => ((r[0] - a[0]) * dx + (r[2] - a[2]) * dz) / l2;
    let lo = 0, hi = 1;
    const constraints = [r => station(r), r => 1 - station(r), r => r[1] - a[1] - (b[1] - a[1]) * station(r), r => wall.upper - r[1]];
    for (const value of constraints) {
        const u = value(p), v = value(q); if (u < -1e-8 && v < -1e-8) return null;
        if ((u < 0) !== (v < 0)) { const t = u / (u - v); if (u < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); }
    }
    return hi >= lo ? p.map((v, i) => v + (q[i] - v) * (lo + hi) / 2) : null;
}
const sourcePaths = ROMANA_TRAM_TUNNEL_MODEL.paths.map(def => {
    const segments = [];
    for (const [id] of def.ways) {
        const way = native.data.tramSourceWays.find(w => w.sourceId === id), xy = rail.decodeTramPoints(way.points, native.data.q || 10);
        for (let i = 1; i < xy.length; i++) segments.push({ a: xy[i - 1], b: xy[i], sourceId: id, index: i - 1 });
    }
    return { ids: new Set(def.ways.map(w => w[0])), segments };
});
for (const [i, r] of native.ribbons.entries()) {
    const e = r.edge; if (!e || e.virtual || r.poly?.length < 3) continue;
    const topAt = p => { const t = Math.max(0, Math.min(1, ((p[0] - e.a.x) * e.dirx + (p[2] - e.a.z) * e.dirz) / e.len)); return .24 + e.ya + (e.yb - e.ya) * t; };
    surfaces.push({ kind: 'native-road', id: 'road-ribbon:' + i, sourceId: e.sourceId, edgeId: e.id, poly: r.poly, bounds: box(r.poly.map(p => [p[0], 0, p[1]])), maxY: .24 + Math.max(e.ya, e.yb),
        topAt, ceilingAt: p => topAt(p) - .54, basis: 'native rendered road top; conservative MODEL underside 0.54m lower, matching -0.3m underside below zero ground datum' });
}
for (const p of grade.support.pieces) if (p.roof) surfaces.push({ kind: 'modeled-rail-roof', id: p.id + ':roof', sourceId: p.sourceId, poly: p.poly, bounds: box(p.top), maxY: p.roof.bottomM,
    topAt: () => p.roof.bottomM, ceilingAt: () => p.roof.bottomM, basis: p.roof.basis });

const fixtures = [], step = Number(stepArg);
for (const edge of net.edges.filter(e => e.grade.modelId === 'victoria-tram-underpass')) {
    const count = Math.ceil(edge.len / step), fractions = new Set([0, 1, ...edge.grade.breaks]);
    for (let i = 1; i < count; i++) fractions.add(i / count);
    for (const t of [...fractions].sort((a, b) => a - b)) for (const m of meshes) fixtures.push({ edge, t, ...m, label: 'full-source-sweep' });
}
for (const actor of native.snapshots[0].active.filter(v => v.id === 489 || v.id === 490)) {
    const selected = rail.nearestTramSource(net, actor.x, actor.z, actor.heading), m = meshes.find(m => m.kind === actor.kind);
    if (!selected?.e?.usable) throw new Error('Actual historical actor nearest source is unresolved: ' + actor.id);
    fixtures.unshift({ edge: selected.e, t: selected.dir > 0 ? selected.s / selected.e.len : 1 - selected.s / selected.e.len, ...m, id: actor.id, nativeOrigin: { x: actor.x, z: actor.z, heading: actor.heading }, label: 'actual-historical-constructor-source-projection' });
}
const results = [], begin = performance.now(), vector = new THREE.Vector3(), limit = limitArg ? Number(limitArg) : fixtures.length;
for (const fixture of fixtures.slice(0, limit)) {
    const { edge, t, mesh, kind } = fixture, dir = edge.railDirections[0], station = (dir > 0 ? t : 1 - t) * edge.len;
    const v = { id: fixture.id, edge, dir, s: station, kind, tram: true, long: true, length: mesh.userData.length, width: mesh.userData.width, mesh, route: [], hist: [], speed: 0, lane: 0, laneCur: 0, latExtraCur: 0, lateralExtra: 0, latBlend: 0, y: .24 };
    let current = { e: edge, dir }, covered = 0; const seen = new Set([edge.id]);
    while (covered < v.length && v.hist.length < 256) {
        const node = current.dir > 0 ? current.e.a : current.e.b, choices = node.edges.filter(e => e !== current.e && !seen.has(e.id)).map(e => ({ e, dir: e.b === node ? 1 : -1 })).filter(p => rail.canTravelTram(p.e, p.dir));
        choices.sort((a, b) => Number(b.e.sourceId === current.e.sourceId) - Number(a.e.sourceId === current.e.sourceId) || String(a.e.id).localeCompare(String(b.e.id)));
        if (!choices.length) break;
        current = choices[0]; v.hist.unshift(current); seen.add(current.e.id); covered += current.e.len;
    }
    const detail = { label: fixture.label, id: fixture.id, nativeOrigin: fixture.nativeOrigin, kind, sourceId: edge.sourceId, sourceSegment: edge.sourceSegment, sourceNodeIds: edge.sourceNodeIds, t, station, dir };
    try {
        traffic.ensureRoute(v);
        if (!rail.sampleTramPath(v, v.length / 2) || !rail.sampleTramPath(v, -v.length / 2)) { results.push({ ...detail, passed: null, reason: 'whole emitted body span exceeds literal modeled source path; boundary controller remains required' }); continue; }
        traffic.placeOnLane(v, true, 0); mesh.updateMatrixWorld(true);
    } catch (error) { results.push({ ...detail, passed: false, reason: String(error.message) }); continue; }
    const geo = mesh.userData._model.geo, attr = geo.attributes.position, points = Array.from({ length: attr.count }, (_, i) => vector.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld).toArray()), bodyBox = box(points), index = geo.index?.array || points.map((_, i) => i);
    const ownPath = sourcePaths.find(p => p.ids.has(edge.sourceId)); let maximumBelowRimLateralReachM = 0, lateralWitness = null;
    for (const p of points) if (p[1] < .4) {
        let closest = null;
        for (const segment of ownPath.segments) {
            const dx = segment.b[0] - segment.a[0], dz = segment.b[1] - segment.a[1], t = Math.max(0, Math.min(1, ((p[0] - segment.a[0]) * dx + (p[2] - segment.a[1]) * dz) / (dx * dx + dz * dz)));
            const distance = Math.hypot(p[0] - segment.a[0] - dx * t, p[2] - segment.a[1] - dz * t);
            if (!closest || distance < closest.distance) closest = { distance, segment, t };
        }
        const g = tunnel.grades.get(closest.segment.sourceId + ':' + closest.segment.index);
        if (!g || (!g.tunnel && Math.abs(g.heightAt(closest.t)) < 1e-8)) continue;
        if (closest.distance > maximumBelowRimLateralReachM) { maximumBelowRimLateralReachM = closest.distance; lateralWitness = { point: p, distanceM: closest.distance, sourceId: closest.segment.sourceId, sourceSegment: closest.segment.index, t: closest.t }; }
    }
    const candidates = surfaces.filter(s => overlap(bodyBox, s.bounds) && s.maxY > v.y + 1);
    const carCandidates = surfaces.filter(s => s.kind === 'native-road' && carTubeSources.has(s.sourceId) && overlap(bodyBox, s.bounds));
    let carProjectedTriangleOverlaps = 0, carProjectionWitness = null;
    const wallCandidates = walls.filter(w => overlap(bodyBox, w.bounds)); let wallIntersectionCount = 0, wallWitness = null;
    let minimum = Infinity, minimumRoadTop = Infinity, minimumRoadUnderside = Infinity, minimumRailRoof = Infinity, witness = null, testedTriangles = 0, testedSurfaces = new Set();
    for (let i = 0; i < index.length; i += 3) {
        const triangle = [points[index[i]], points[index[i + 1]], points[index[i + 2]]], triangleBox = box(triangle);
        for (const surface of carCandidates) if (overlap(triangleBox, surface.bounds)) {
            const clipped = clip(triangle, surface.poly), area = clipped.reduce((s, p, k) => { const q = clipped[(k + 1) % clipped.length]; return s + p[0] * q[2] - p[2] * q[0]; }, 0) / 2;
            if (Math.abs(area) > 1e-8) { carProjectedTriangleOverlaps++; carProjectionWitness ||= { sourceId: surface.sourceId, edgeId: surface.edgeId, triangle: i / 3, clipped }; }
        }
        for (const wall of wallCandidates) if (overlap(triangleBox, wall.bounds)) {
            const p = triangleWallIntersection(triangle, wall); if (p) { wallIntersectionCount++; wallWitness ||= { wallId: wall.id, sourceId: wall.sourceId, triangle: i / 3, point: p }; }
        }
        for (const surface of candidates) {
            if (!overlap(triangleBox, surface.bounds)) continue;
            const clipped = clip(triangle, surface.poly); if (!clipped.length) continue;
            testedTriangles++; testedSurfaces.add(surface.id);
            for (const p of clipped) {
                const gap = surface.ceilingAt(p) - p[1];
                if (surface.kind === 'native-road') minimumRoadTop = Math.min(minimumRoadTop, surface.topAt(p) - p[1]);
                if (surface.kind === 'native-road') minimumRoadUnderside = Math.min(minimumRoadUnderside, gap);
                else minimumRailRoof = Math.min(minimumRailRoof, gap);
                if (gap < minimum) { minimum = gap; witness = { kind: surface.kind, id: surface.id, sourceId: surface.sourceId, edgeId: surface.edgeId, triangle: i / 3, point: p, ceilingY: surface.ceilingAt(p), gapM: gap, basis: surface.basis }; }
            }
        }
    }
    const source = rail.sampleTramPath(v), sourceErrorM = Math.hypot(source.x - v.x, source.z - v.z);
    results.push({ ...detail, passed: minimum >= -1e-7 && sourceErrorM < 1e-10 && !wallIntersectionCount, wallIntersectionCount, wallWitness, carProjectedTriangleOverlaps, carProjectionWitness, minimumOverheadClearanceM: Number.isFinite(minimum) ? minimum : null, minimumNativeRoadTopClearanceM: Number.isFinite(minimumRoadTop) ? minimumRoadTop : null,
        minimumConservativeRoadUndersideClearanceM: Number.isFinite(minimumRoadUnderside) ? minimumRoadUnderside : null, minimumModeledRailRoofClearanceM: Number.isFinite(minimumRailRoof) ? minimumRailRoof : null,
        maximumBelowRimLateralReachM, lateralWitness,
        witness, actualPose: { x: v.x, y: v.y, z: v.z, heading: v.heading, pitch: mesh.rotation.x }, actualBounds: { min: [bodyBox.x0, Math.min(...points.map(p => p[1])), bodyBox.z0], max: [bodyBox.x1, Math.max(...points.map(p => p[1])), bodyBox.z1] },
        sourceErrorM, support: v.railSupport, testedTriangles, testedSurfaces: testedSurfaces.size });
    if (results.length % 100 === 0) console.error(JSON.stringify({ completed: results.length, total: Math.min(limit, fixtures.length), elapsedMs: performance.now() - begin }));
}
const afterHashes = Object.fromEntries(modulePaths.map(p => [p, hash(p)])), unchangedModules = JSON.stringify(initialHashes) === JSON.stringify(afterHashes);
const passed = results.filter(r => r.passed === true), failed = results.filter(r => r.passed === false), excluded = results.filter(r => r.passed === null), checked = passed.filter(r => r.minimumOverheadClearanceM != null);
const report = { passed: !failed.length && unchangedModules && results.length === fixtures.length, scope: 'CPU actual Traffic rigid fitting, primary emitted mesh triangle clipping versus all native road ribbons and explicit rail roof polygons; no browser or current-root static/native acceptance',
    nativeInputSha256: crypto.createHash('sha256').update(bytes).digest('hex'), halfWidthOverrideM, outerWallSegments: walls.length, stepM: step, partialDiagnosticLimit: limitArg || null, unchangedModules, moduleSha256: initialHashes, afterModuleSha256: afterHashes,
    actualGeometry, sourceModel: tunnel.report, network: { modeled: net.report.modeledSegments, admitted: net.report.admittedSegments, unresolved: net.report.unresolved },
    summary: { fixtures: fixtures.length, actualPoses: passed.length, failed: failed.length, excludedUnknownWholeSourceSpan: excluded.length, checkedOverheadPoses: checked.length,
        minimumOverheadClearanceM: checked.length ? Math.min(...checked.map(r => r.minimumOverheadClearanceM)) : null, maximumSupportOffsetM: Math.max(0, ...passed.map(r => r.support.verticalOffsetM || 0)),
        maximumBelowRimLateralReachM: Math.max(0, ...passed.map(r => r.maximumBelowRimLateralReachM)), posesWithCarProjectedTriangleOverlaps: passed.filter(r => r.carProjectedTriangleOverlaps > 0).length, cpuMs: performance.now() - begin }, results };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, unchangedModules, ...report.summary, firstFailure: failed[0] }, null, 2));
if (failed.length || !unchangedModules) process.exitCode = 1;
