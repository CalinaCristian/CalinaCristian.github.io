// Read-only literal source search. The actual compiler separately validates
// every reviewed segment, turn lane, source restriction and domain envelope.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseFiles } from '../../../../tools/osm/parse-osm.mjs';
import { resolveRoadAccess } from '../../../../game/src/road-access.js';
import { buildMotorTurnRestrictions, motorTurnAllowed } from '../../../../game/src/motor-turn-restrictions.js';
const tiles = process.argv[2] || '/workspace/reality-pass/grozavesti/tiles';
const nativePath = process.argv[3] || '/workspace/integration-qa-evidence/basarab-shared-3f8f86be-native/native-world.json.gz';
const output = process.argv[4] || '/tmp/basarab-north-return-paths.json';
const files = fs.readdirSync(tiles).filter(f => f.endsWith('.xml')).sort().map(f => path.join(tiles, f)), raw = parseFiles(files), n = JSON.parse(zlib.gunzipSync(fs.readFileSync(nativePath)));
const data = JSON.parse(fs.readFileSync(new URL('../../../../game/data/bucharest-grozavesti.json', import.meta.url))), p = data.proj;
const classes = new Set(data.classes), nodes = new Map([...raw.nodes].map(([id, [lat, lon]]) => [id, { sourceId: id, x: (lon - p.lon0) * p.mPerLon, z: (p.lat0 - lat) * p.mPerLat, edges: [] }]));
const edges = [], adj = new Map(), add = leg => { let list = adj.get(leg.from); if (!list) adj.set(leg.from, list = []); list.push(leg); };
for (const [id, way] of raw.ways) {
    const t = way.tags, access = resolveRoadAccess(t);
    if (!classes.has(t.highway) || t.area === 'yes' || !access.publicDrive || !access.throughAccess || way.nodes.some(id => !nodes.has(id))) continue;
    const oneway = ['yes', 'true', '1', '-1'].includes(t.oneway) || ['roundabout', 'circular'].includes(t.junction) && t.oneway !== 'no' || ['motorway', 'motorway_link'].includes(t.highway) && t.oneway !== 'no';
    const order = t.oneway === '-1' ? [...way.nodes].reverse() : way.nodes;
    for (let i = 1; i < order.length; i++) {
        const a = nodes.get(order[i - 1]), b = nodes.get(order[i]), lengthM = Math.hypot(b.x - a.x, b.z - a.z);
        const e = { a, b, sourceId: 'w' + id, access: { ...access, sourceId: 'w' + id }, oneway, lanesF: 1, lanesB: oneway ? 0 : 1, lengthM }; edges.push(e);
        add({ from: a.sourceId, to: b.sourceId, sourceId: e.sourceId, e, dir: 1, lengthM });
        if (!oneway) add({ from: b.sourceId, to: a.sourceId, sourceId: e.sourceId, e, dir: -1, lengthM });
    }
}
const allRelations = [...raw.rels].filter(([, r]) => r.tags.type === 'restriction').map(([id, r]) => ({ sourceId: 'r' + id, tags: r.tags, members: r.members }));
const policy = buildMotorTurnRestrictions({ roadRestrictions: allRelations }, edges);
const universal = allRelations.filter(r => r.tags.restriction === 'only_straight_on' && !r.members.some(m => m.role === 'from') && r.members.filter(m => m.role === 'via' && m.type === 'node').length === 1 && r.members.filter(m => m.role === 'to' && m.type === 'way').length === 1 && r.members.length === 2);
function permitted(last, leg) {
    if (last && (leg.to === last.from || !motorTurnAllowed(policy, last.e, last.dir, leg.e, leg.dir, { mode: 'motorcar' }))) return false;
    if (universal.some(r => r.members.find(m => m.role === 'via').ref === leg.from && 'w' + r.members.find(m => m.role === 'to').ref !== leg.sourceId)) return false;
    return true;
}
// Heap Dijkstra over incoming-edge states; no invented reversal/near join.
function route(starts, goals, { initialIncoming = null, forbiddenWays = new Set() } = {}) {
    const goal = new Set(goals), dist = new Map(), heap = [], records = new Map();
    const push = row => { heap.push(row); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j].cost <= row.cost) break; heap[i] = heap[j]; i = j; } heap[i] = row; };
    const pop = () => { const out = heap[0], last = heap.pop(); if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let k = i * 2 + 1; if (k + 1 < heap.length && heap[k + 1].cost < heap[k].cost) k++; if (heap[k].cost >= last.cost) break; heap[i] = heap[k]; i = k; } heap[i] = last; } return out; };
    for (const start of starts) { const row = { node: start, last: initialIncoming, cost: 0, prior: null, key: start + '/' + (initialIncoming?.sourceId || '') + '/' + (initialIncoming?.from || '') }; dist.set(row.key, 0); records.set(row.key, row); push(row); }
    while (heap.length) {
        const row = pop(); if (row.cost !== dist.get(row.key)) continue;
        if (goal.has(row.node)) { const legs = []; let at = row; while (at.prior) { legs.push(at.last); at = records.get(at.prior); } return { found: true, lengthM: row.cost, legs: legs.reverse().map(({ e, dir, ...leg }) => leg) }; }
        for (const leg of adj.get(row.node) || []) {
            if (forbiddenWays.has(leg.sourceId) || !permitted(row.last, leg)) continue;
            const key = leg.to + '/' + leg.sourceId + '/' + leg.from, cost = row.cost + leg.lengthM;
            if (cost >= (dist.get(key) ?? Infinity)) continue;
            const next = { node: leg.to, last: leg, cost, prior: row.key, key }; dist.set(key, cost); records.set(key, next); push(next);
        }
    } return { found: false };
}
const main = [...new Set(n.allEdges.filter(e => n.graphEdgeIds.includes(e.id)).flatMap(e => [e.a.sourceId, e.b.sourceId]).filter(id => id > 0))];
const incoming = (adj.get(14161960361) || []).find(l => l.to === 1397135743 && l.sourceId === 'w668700424');
const bridgeWays = new Set([...raw.ways].filter(([, w]) => w.tags.bridge && w.tags.bridge !== 'no').map(([id]) => 'w' + id));
const paths = {
    groundJoinToCore: route([1397135743], main, { initialIncoming: incoming }),
    coreToGroundJoin: route(main, [1397135743]),
    groundOnlyJoinToCore: route([1397135743], main, { initialIncoming: incoming, forbiddenWays: bridgeWays }),
    groundOnlyCoreToJoin: route(main, [1397135743], { forbiddenWays: bridgeWays }),
};
for (const result of Object.values(paths)) if (result.found) {
    result.wayRuns = [];
    for (const leg of result.legs) { let run = result.wayRuns.at(-1); if (run?.sourceId !== leg.sourceId) { run = { sourceId: leg.sourceId, from: leg.from, to: leg.to, lengthM: 0 }; result.wayRuns.push(run); } run.to = leg.to; run.lengthM += leg.lengthM; }
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { scope: 'Read-only exact raw directed motorcar routes, incoming-way restrictions and no immediate reversal. Actual compiler remains authority for all touching malformed/conditional/via-way restrictions, terminal turn lanes and physical envelope. Historical3f native public core goals; no physical/grade/native acceptance.', sourceFiles: files.map(file => ({ file, sha256: sha(fs.readFileSync(file)) })), counts: { rawRoadSegments: edges.length, nativeCoreNodes: main.length }, restrictionReport: policy.report, paths };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
for (const [id, r] of Object.entries(paths)) console.log(id, JSON.stringify({ found: r.found, lengthM: r.lengthM, legs: r.legs?.length, wayRuns: r.wayRuns }));
