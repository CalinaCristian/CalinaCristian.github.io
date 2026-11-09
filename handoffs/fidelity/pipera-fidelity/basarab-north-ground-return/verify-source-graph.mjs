// Actual Navigator over the prepared positive-source graph only. No virtual
// OUT, negative boundary cut, proximity join, grade or live actor is supplied.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Navigator } from '../../../../game/src/nav.js';
import { makeVehicle } from '../../../../game/src/vehicles.js';
import { assessRoadClearance } from '../../../../game/src/source-road-clearance.js';
const base = '/workspace/reality-pass/basarab-north-ground-return', root = new URL('../../../..', import.meta.url).pathname;
function graph(data) {
    const nodes = new Map(), edges = [], rejected = [];
    const node = i => { const sourceId = data.roadNodeIds[i]; if (!(sourceId > 0)) return null;
        if (!nodes.has(sourceId)) nodes.set(sourceId, { sourceId, id: sourceId, x: data.roadNodePositions[i * 2], z: data.roadNodePositions[i * 2 + 1], edges: [] }); return nodes.get(sourceId); };
    for (const [i, row] of data.roads.entries()) {
        const access = data.roadAccess[i], source = data.roadSourceGeometry[i]; if (!source || !access?.publicDrive || !access.throughAccess) continue;
        for (let j = 11; j < row.length; j++) {
            const a = node(row[j - 1]), b = node(row[j]); if (!a || !b) continue;
            const adjacent = source.nodeIds.some((n, k) => n === a.sourceId && source.nodeIds[k + 1] === b.sourceId || n === b.sourceId && source.nodeIds[k + 1] === a.sourceId);
            if (!adjacent) { rejected.push({ sourceId: source.sourceId, from: a.sourceId, to: b.sourceId }); continue; }
            const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); if (len < 1e-9) continue;
            const e = { id: edges.length, a, b, len, dirx: dx / len, dirz: dz / len, nx: -dz / len, nz: dx / len,
                road: i, name: row[0] >= 0 ? data.strings[row[0]] : '', type: data.classes[row[1]], lanesF: row[2], lanesB: row[3],
                oneway: !!(row[8] & 1), publicDrive: true, throughAccess: true, access, sourceId: source.sourceId, maxspeed: row[7] / 3.6, virtual: false };
            edges.push(e); a.edges.push(e); b.edges.push(e);
        }
    }
    assert.deepEqual(rejected, [], 'no skipped raw source vertex may create a new graph connection');
    return { nodes: [...nodes.values()], edges };
}
function inspect(data) {
    const g = graph(data), world = { data, graph: g }, nav = new Navigator(world);
    // A real current-source emitted fleet-sedan is a CPU clearance control,
    // never a replacement for native Player/grade/physical driving acceptance.
    nav.sourceVehicle = { mesh: makeVehicle('sedan', '#ffffff', { city: 'bucharest', instanced: true }) };
    const ids = [[6262162596, 1397135743], [1397135743, 32933928], [1397135743, 981547574], [981547574, 1397135743]], paths = [];
    for (const [from, to] of ids) {
        const a = g.nodes.find(n => n.sourceId === from), b = g.nodes.find(n => n.sourceId === to);
        const r = a && b ? nav.compute(a.x, a.z, b.x, b.z) : null;
        const legs = r?.legs || [], points = r?.points || [];
        const edgeRecord = e => ({ sourceId: e.access.sourceId, from: e.a.sourceId, to: e.b.sourceId, main: e.main, type: e.type,
            lanesF: e.lanesF, lanesB: e.lanesB, oneway: e.oneway, publicDrive: e.publicDrive, throughAccess: e.throughAccess,
            clearance: assessRoadClearance(nav.sourceClearance, e, nav.lastSourceClearance.dimensions, { mode: 'motorcar' }) });
        const hitRecord = hit => hit && ({ distanceM: hit.d, t: hit.t, x: hit.cx, z: hit.cz, selectedEdge: edgeRecord(hit.edge) });
        paths.push({ from, to, found: !!r, lengthM: r?.total ?? r?.length ?? null,
            // Literal endpoint incidence is also checked separately from the
            // Navigator's normal nearest-edge endpoint snapping below.
            startSnapDistanceM: points.length ? Math.hypot(points[0][0] - a.x, points[0][1] - a.z) : null,
            goalSnapDistanceM: points.length ? Math.hypot(points.at(-1)[0] - b.x, points.at(-1)[1] - b.z) : null,
            goalEndpointClassification: b && { x: b.x, z: b.z, incidents: b.edges.map(edgeRecord), nearestPublic: hitRecord(nav.index.nearest(b.x, b.z)),
                nearestMainClearanceEligible: hitRecord(nav.index.nearest(b.x, b.z, 600, e => e.main !== false && assessRoadClearance(nav.sourceClearance, e, nav.lastSourceClearance.dimensions, { mode: 'motorcar' }).eligible === true)),
                scope: 'Actual Navigator SCC/endpoint selection on this positive-source-only CPU fixture. Negative cut legs/mapEnd nodes and virtual outside are deliberately absent, so a fresh native World SCC may differ.' },
            points, legs: legs.map(l => ({ sourceId: l.e.access?.sourceId, dir: l.dir, from: (l.dir > 0 ? l.e.a : l.e.b).sourceId, to: (l.dir > 0 ? l.e.b : l.e.a).sourceId })) });
    }
    const reach = (from, to) => { const seen = new Set([from]), stack = [from]; while (stack.length) { const id = stack.pop(); if (id === to) return true; const n = g.nodes.find(n => n.sourceId === id); if (!n) continue;
        for (const e of n.edges) { const dir = e.a === n ? 1 : -1; if (dir < 0 && e.oneway || (dir > 0 ? e.lanesF : e.lanesB) <= 0) continue; const next = dir > 0 ? e.b : e.a; if (!seen.has(next.sourceId)) { seen.add(next.sourceId); stack.push(next.sourceId); } } } return false; };
    return { sourceGraph: { nodes: g.nodes.length, edges: g.edges.length, positiveSourceIdsOnly: true, virtualOutEdges: 0 }, navigatorMain: nav.mainStats,
        exactIncidenceReachability: ids.map(([from, to]) => ({ from, to, reachable: reach(from, to) })), paths,
        unresolvedRawRestrictions: nav.motorTurnRestrictions.report.unresolved.map(r => ({ sourceId: r.sourceId, reasons: r.reasons })) };
}
const before = fs.readFileSync(base + '/base-b8f33f2d.json'), after = fs.readFileSync(root + '/game/data/bucharest-grozavesti.json'), sha = b => createHash('sha256').update(b).digest('hex');
const report = { scope: 'CPU source topology and actual Navigator control with emitted native-builder fleet sedan. No OUT/negative cuts or fabricated joins. No road grade, native Player, actual world geometry, spawned cohorts or driving acceptance. General malformed restriction records remain unresolved.', beforeSha256: sha(before), candidateSha256: sha(after), before: inspect(JSON.parse(before)), candidate: inspect(JSON.parse(after)) };
fs.writeFileSync(process.argv[2] || base + '/source-graph-navigator.json', JSON.stringify(report, (key, value) => ['a', 'b', 'edges', 'edge', 'e', 'parent', 'prev'].includes(key) && value && typeof value === 'object' ? undefined : value, 2) + '\n');
console.log(JSON.stringify({ before: report.before.exactIncidenceReachability, candidate: report.candidate.exactIncidenceReachability, navBefore: report.before.paths.map(p => ({ from: p.from, to: p.to, found: p.found })), navCandidate: report.candidate.paths.map(p => ({ from: p.from, to: p.to, found: p.found })) }, null, 2));
