// Read-only prospective reconstruction from exact native54 data. No browser or
// live actor/world mutation. Primitive positives remain valid independently of
// omitted serialized closures; any unknown closure prevents a negative claim.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import * as THREE from '../../../../game/vendor/three.module.min.js';
import { Traffic } from '../../../../game/src/traffic.js';
import { buildTramNetwork, nearestTramSource, projectTramStations } from '../../../../game/src/tram-path.js';
import { buildTramGrades } from '../../../../game/src/tram-grade.js';
import { buildTramTunnelGrades } from '../../../../game/src/tram-tunnel-grade.js';
import { previewInitialTrafficPose, initialTrafficStaticClearance } from '../../../../game/src/initial-traffic-admission.js';
import { collideBuildings } from '../../../../game/src/world.js';

const [directory, district, output] = process.argv.slice(2), require = createRequire(import.meta.url), decoder = require(directory + '/decode-geometry.cjs');
const read = name => { const bytes = zlib.gunzipSync(fs.readFileSync(directory + '/' + district + '-' + name + '.json.gz')); return { json: JSON.parse(bytes), sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; };
const w = read('world'), f = read('constructor-facts'), W = w.json, F = f.json;
function revive(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.$undefined) return undefined;
    if (value.$number) return Number(value.$number);
    if (Array.isArray(value)) return value.map(revive);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
}
const nodes = W.graphNodes.map(n => ({ ...revive(n), edges: [] })), byNode = new Map(nodes.map(n => [n.id, n]));
const edges = W.allEdges.map(e => ({ ...revive(e), a: byNode.get(e.a.id) || { ...e.a, edges: [] }, b: byNode.get(e.b.id) || { ...e.b, edges: [] } }));
for (const edge of edges) { edge.a.edges.push(edge); edge.b.edges.push(edge); }
const tunnel = buildTramTunnelGrades(W.data, { coreEdges: edges }), grades = buildTramGrades(W.data, { coreEdges: edges, extraGrades: tunnel.grades, extraReport: tunnel.report });
const network = buildTramNetwork(W.data, { motorNodes: nodes, resolveGrade: grades.resolveGrade });
const capturedNetwork = F.snapshots.find(s => s.phase === 'after-original-source-binding-before-initial-admission').tramNetwork;
for (const n of capturedNetwork.nodes) { const actual = network.bySourceNode.get(String(n.sourceId)); if (actual) { actual.hasLight = n.hasLight; actual.radius = n.radius; if (n.sourceSignal) actual.sourceSignal = n.sourceSignal; } }
const mask = W.data.district.mask, bits = new Uint8Array(mask.w * mask.h); let count = 0, bit = 0;
for (const run of mask.rle) { bits.fill(bit, count, count + run); count += run; bit ^= 1; }
const inside = (x, z) => { const i = Math.floor((x - mask.x0) / mask.cell), j = Math.floor((z - mask.z0) / mask.cell); return i >= 0 && j >= 0 && i < mask.w && j < mask.h && bits[j * mask.w + i] === 1; };
const colliders = W.colliders.map(revive), cells = new Map(), gridKey = (i, j) => i * 73856093 ^ j * 19349663, pieces = new Map(grades.support.pieces.map(p => [p.id, p])), restoredOwnSlabCallbacks = [];
for (const c of colliders) if (c.railDeck && c.supportPieceId && pieces.has(c.supportPieceId)) {
    const p = pieces.get(c.supportPieceId);
    c.roofHeightAt = (x, z, radius) => p.band(x, z, radius).top;
    c.minHeightAt = (x, z, radius) => p.band(x, z, radius).bottom;
    restoredOwnSlabCallbacks.push(c.colliderIndex);
}
for (const c of colliders) for (let i = Math.floor((c.x - c.r) / 32); i <= Math.floor((c.x + c.r) / 32); i++) for (let j = Math.floor((c.z - c.r) / 32); j <= Math.floor((c.z + c.r) / 32); j++) { const key = gridKey(i, j); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(c); }
let unknowns = [];
Object.defineProperty(colliders, 'query', { value: (x, z, radius, callback) => {
    const seen = new Set();
    for (let i = Math.floor((x - radius) / 32); i <= Math.floor((x + radius) / 32); i++) for (let j = Math.floor((z - radius) / 32); j <= Math.floor((z + radius) / 32); j++) for (const c of cells.get(gridKey(i, j)) || []) if (!seen.has(c)) {
        seen.add(c);
        if (c.roofHeightAt?.$function || c.minHeightAt?.$function || c.wall && (c.y0a?.$number || c.y1a?.$number)) { unknowns.push(c.colliderIndex); continue; }
        callback(c);
    }
} });
const T = Object.create(Traffic.prototype); T.world = { data: W.data, graph: { nodes, edges }, buildings: colliders, district: { inside }, tramDeckSupportAt: grades.support.at };
const before = F.snapshots.find(s => s.phase === 'after-original-spawnAll-before-binding'), results = [];
function emittedContact(body, collider, geometry) {
    if (!collider) return null;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(body.x, body.y, body.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(body.pitch, body.heading, body.roll || 0, 'YXZ')), body.mesh.scale);
    const positions = geometry.attributes.position, vertices = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix)), index = geometry.index?.array || vertices.map((_, i) => i), ray = new THREE.Ray(), point = new THREE.Vector3(), direction = new THREE.Vector3();
    if (!collider.wall && collider.prop && collider.hw === collider.r) {
        ray.set(new THREE.Vector3(collider.x, collider.y0 || 0, collider.z), new THREE.Vector3(0, 1, 0));
        for (let i = 0; i < index.length; i += 3) { const hit = ray.intersectTriangle(vertices[index[i]], vertices[index[i + 1]], vertices[index[i + 2]], false, point); if (hit && hit.y < (collider.y1 ?? collider.h ?? Infinity) && hit.y > (collider.y0 || 0)) return { genuineEmittedTriangleContact: true, method: 'vertical primitive center-axis intersects exact emitted mesh triangle within actual collider height', triangle: i / 3, point: point.toArray(), colliderIndex: collider.colliderIndex }; }
    }
    if (collider.wall) {
        const walls = [], quad = q => walls.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
        if (collider.kind === 'barrier') {
            // Literal World54 rendered separation barrier: ±.15m sides, base
            // native wall.y0+.45 and top +.9. Do not confuse its lowered
            // collision band with the actual rendered concrete surface.
            const length = Math.hypot(collider.bx - collider.ax, collider.bz - collider.az), px = -(collider.bz - collider.az) / length * .15, pz = (collider.bx - collider.ax) / length * .15, ya = collider.y0a + .45, yb = collider.y0b + .45;
            const q = (sd, top) => [new THREE.Vector3(collider.ax + px * sd, ya + top, collider.az + pz * sd), new THREE.Vector3(collider.bx + px * sd, yb + top, collider.bz + pz * sd)];
            for (const sd of [1, -1]) { const lo = q(sd, 0), hi = q(sd, .9); quad([lo[0], lo[1], hi[1], hi[0]]); }
            const a = q(1, .9), b = q(-1, .9); quad([a[0], a[1], b[1], b[0]]);
        } else {
            quad([new THREE.Vector3(collider.ax, collider.y0a, collider.az), new THREE.Vector3(collider.bx, collider.y0b, collider.bz), new THREE.Vector3(collider.bx, collider.y1b, collider.bz), new THREE.Vector3(collider.ax, collider.y1a, collider.az)]);
        }
        const intersects = (a, b) => { for (let i = 0; i < 3; i++) { const p = a[i], end = a[(i + 1) % 3], length = direction.subVectors(end, p).length(); if (length < 1e-8) continue; ray.set(p, direction.clone().divideScalar(length)); const hit = ray.intersectTriangle(...b, false, point); if (hit && hit.distanceTo(p) > 1e-7 && hit.distanceTo(p) < length - 1e-7) return point.toArray(); } return null; };
        for (let i = 0; i < index.length; i += 3) { const triangle = [vertices[index[i]], vertices[index[i + 1]], vertices[index[i + 2]]]; for (const w of walls) { const hit = intersects(triangle, w) || intersects(w, triangle); if (hit) return { genuineEmittedTriangleContact: true, method: collider.kind === 'barrier' ? 'exact emitted mesh triangle intersects literal World54 rendered separation barrier triangles' : 'exact emitted mesh triangle intersects native wall quad', triangle: i / 3, point: hit, colliderIndex: collider.colliderIndex }; } }
    }
    return { genuineEmittedTriangleContact: null, reason: 'No positive exact intersection in this bounded primitive test; not a geometric clearance pass' };
}
for (const raw of before.active.filter(v => v.tram)) {
    const geometry = F.geometryCatalog[raw.model.primaryGeometryId], p = decoder.attribute(geometry.attributes.position), index = decoder.attribute(geometry.index), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(Array.from({ length: p.count }, (_, i) => p.get(i)).flat()), 3));
    if (index) geo.setIndex(new THREE.BufferAttribute(index.array, 1));
    const mesh = new THREE.Object3D(); mesh.userData._model = { geo }; mesh.scale.fromArray(raw.meshPose.scale);
    const v = { ...revive(raw), edge: edges.find(e => e.id === raw.edge.id), mesh, route: [], hist: [] }, nearest = nearestTramSource(network, v.x, v.z, v.heading), candidates = projectTramStations(network, v.x, v.z, v.heading, v.length, { anchorEdge: nearest.e }), attempts = [];
    for (const c of candidates) {
        if (c.distance > Math.max(v.length, (v.edge.wL || 0) + (v.edge.wR || 0))) { attempts.push({ sourceId: c.e.sourceId, segment: c.e.sourceSegment, distanceM: c.distance, reason: 'local-distance-limit', remainingNotAttempted: true }); break; }
        const plan = { ...v, edge: c.e, dir: c.dir, s: c.s, lane: 0, laneCur: 0, latExtraCur: 0, lateralExtra: 0, latBlend: 0, route: [], hist: [] };
        let body;
        try { body = { ...plan, ...previewInitialTrafficPose(T, plan, c.s) }; }
        catch (error) { attempts.push({ sourceId: c.e.sourceId, segment: c.e.sourceSegment, distanceM: c.distance, reason: 'preview-exception', error: String(error.message) }); continue; }
        const bodyInsideBareMask = T.railBodyInside(body); unknowns = [];
        const physical = initialTrafficStaticClearance(T.world, body), collider = physical.hit && colliders.find(c => {
            if (c.kind !== physical.hit.kind || (c.sourceId || c.osmId || c.edge?.access?.sourceId || null) !== physical.hit.sourceId || (c.edge?.id ?? null) !== physical.hit.edgeId || !physical.hit.sample) return false;
            const band = physical.hit.colliderBand, lo = Math.max(physical.hit.interval.min, band.min), hi = Math.min(physical.hit.interval.max, band.max), y = lo + Math.min(1e-5, (hi - lo) / 2);
            return !!collideBuildings([c], physical.hit.sample.x, physical.hit.sample.z, physical.hit.sample.radius, y, hi - y);
        });
        attempts.push({ sourceId: c.e.sourceId, sourceNodeIds: c.e.sourceNodeIds, segment: c.e.sourceSegment, station: c.s, dir: c.dir, distanceM: c.distance, pose: { x: body.x, y: body.y, z: body.z, heading: body.heading, pitch: body.pitch }, bodyInsideBareMask, physical, guaranteedPrimitiveReject: !physical.valid, omittedClosureColliderIndices: [...new Set(unknowns)], actualCollider: collider, emittedGeometryContact: emittedContact(body, collider, geo) });
    }
    results.push({ id: v.id, kind: v.kind, before: { x: v.x, y: v.y, z: v.z, heading: v.heading, sourceId: raw.edge.sourceId, edgeId: raw.edge.id }, nearest: { sourceId: nearest.e.sourceId, sourceSegment: nearest.e.sourceSegment, nodeIds: nearest.e.sourceNodeIds, distanceM: nearest.distance, grade: nearest.e.grade.basis }, totalSourceCandidates: candidates.length, attempts });
}
const report = { sourceCommit: '54c044421640cfe3569bfc3f72159d2169f87581', worldSha256: w.sha256, factsSha256: f.sha256, scope: 'CPU prospective exact native actor/model buffers and source54 methods. Own identified rail slab callbacks reconstructed by exact production54 shared catalogue/piece IDs; other serialized roof closures explicitly omitted. Positive rejection witnesses remain causal, but absence of a hit is not a static pass. Bare-mask positives prove native inside; bare-mask negatives may still be in landmark extension.', restoredOwnSlabCallbacks, network: { modeled: network.report.modeledSegments, admitted: network.report.admittedSegments, unresolved: network.report.unresolved }, results };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ id: r.id, nearest: r.nearest.sourceId, candidates: r.totalSourceCandidates, attempts: r.attempts.map(a => ({ source: a.sourceId, segment: a.segment, distance: a.distanceM, inside: a.bodyInsideBareMask, kind: a.physical?.hit?.kind, blockerSource: a.physical?.hit?.sourceId, possibleCollider: a.possibleCollider?.colliderIndex, omittedClosures: a.omittedClosureColliderIndices?.length, reason: a.reason })) })), null, 2));
