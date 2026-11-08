#!/usr/bin/env node
// Inspect source segment connectivity without loading unrelated render geometry.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { SharedLaneGate } from '../src/shared-lanes.js';
const input = process.argv[2];
if (!input) throw new Error('Usage: node game/dev/shared-lanes-topology.mjs <district.json>');
const raw = fs.readFileSync(input), data = JSON.parse(raw), nodes = [], edges = [], pairs = new Set();
for (let i = 0; i < data.nodes.length; i += 2) nodes.push({ id: i / 2, sourceId: data.roadNodeIds?.[i / 2], x: data.roadNodePositions?.[i] ?? data.nodes[i] / 10, z: data.roadNodePositions?.[i + 1] ?? data.nodes[i + 1] / 10, edges: [] });
for (const id of data.district?.ends || []) nodes[id].mapEnd = true;
for (const [road, row] of data.roads.entries()) for (let j = 10; j < row.length - 1; j++) {
    const a = nodes[row[j]], b = nodes[row[j + 1]], pair = [a.id, b.id].sort((a, b) => a - b).join(':'), len = Math.hypot(b.x - a.x, b.z - a.z);
    if (a === b || pairs.has(pair) || len < .05) continue;
    pairs.add(pair);
    const edge = { a, b, road, len, oneway: !!(row[8] & 1), sharedLane: !!data.sharedLanes?.[road], sharedLaneSource: data.sharedLanes?.[road], sourceId: data.roadAccess?.[road]?.sourceId || data.sharedLanes?.[road]?.sourceId, publicDrive: data.roadAccess?.[road]?.publicDrive !== false, throughAccess: data.roadAccess?.[road]?.throughAccess !== false, name: data.strings[row[0]] || '' };
    edges.push(edge); a.edges.push(edge); b.edges.push(edge);
}
const gate = new SharedLaneGate(edges), narrow = edges.filter(e => e.sharedLane), visited = new Set();
let previousGroupCount = 0;
for (const first of narrow) {
    if (visited.has(first)) continue;
    previousGroupCount++; const pending = [first];
    while (pending.length) {
        const edge = pending.pop(); if (visited.has(edge)) continue; visited.add(edge);
        for (const node of [edge.a, edge.b]) if (node.edges.filter(e => !e.virtual && e.drivable !== false).length === 2) for (const next of node.edges) if (next.sharedLane && !visited.has(next)) pending.push(next);
    }
}
const report = {
    input, inputSha256: crypto.createHash('sha256').update(raw).digest('hex'), geometryPolicy: data.roadGeometryPolicy || 'legacy', scope: 'source road segments before renderer height subdivision and SCC classification',
    sharedRoads: Object.entries(data.sharedLanes || {}).map(([road, source]) => ({ road: +road, name: data.strings[data.roads[road][0]] || '', ...source })),
    previousGroupCount, connectedGroupCount: gate.groups.length,
    groups: gate.groups.map(g => ({ exclusive: g.exclusive, lengthM: g.edges.reduce((sum, e) => sum + e.len, 0), segmentCount: g.edges.length, sources: [...new Set(g.edges.map(e => e.sourceId))],
        sideEntries: [...new Set(g.edges.flatMap(e => [e.a, e.b]))].filter(n => n.edges.filter(e => e.sharedLane).length >= 2 && n.edges.some(e => !e.sharedLane)).map(n => ({ node: n.id, sourceId: n.sourceId, x: n.x, z: n.z, branches: n.edges.filter(e => !e.sharedLane).map(e => ({ sourceId: e.sourceId, name: e.name, publicDrive: e.publicDrive, throughAccess: e.throughAccess })) })) }))
};
console.log(JSON.stringify(report, null, 2));
