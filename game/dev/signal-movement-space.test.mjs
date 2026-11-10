import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Traffic } from '../src/traffic.js';
import { nextControllerRouteEnd, signalMovementBlocked } from '../src/signal-movement-space.js';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/basarab-signal-exit-queue.json', import.meta.url)));
const cl = { nodes: [] }, nodes = new Map(), edges = new Map();
for (const row of [raw.incoming, raw.vehicle.edge, ...raw.vehicle.route]) {
    for (const r of [row.a, row.b]) if (!nodes.has(r.id)) {
        const n = { ...r, radius: r.r, hasLight: r.light, edges: [] };
        if (r.cluster) { n.lightCluster = cl; cl.nodes.push(n); }
        nodes.set(r.id, n);
    }
    const a = nodes.get(row.a.id), b = nodes.get(row.b.id), dx = b.x - a.x, dz = b.z - a.z;
    const e = { ...row, ...raw.laneFields.find(e => e.id === row.id), a, b, dirx: dx / row.len, dirz: dz / row.len, nx: -dz / row.len, nz: dx / row.len };
    edges.set(e.id, e); a.edges.push(e); b.edges.push(e);
}
const v = { ...raw.vehicle, edge: edges.get(849), dir: 1, s: 32, lane: 1, laneCur: 1, y: .24, odo: 0, _moveGeneration: 0 };
v.route = [{ e: edges.get(850), dir: 1 }, ...raw.vehicle.route.map(r => ({ e: edges.get(r.id), dir: r.dir }))];
// The raw vehicle is already on850; its route starts1242. Keep every recorded
// node/edge and direction. The admission pose is an isolated pre-entry control.
const entry = nodes.get(938), t = Object.create(Traffic.prototype);
Object.assign(t, { world: { nodeLight: { 938: { approaches: [{ edge: v.edge, phase: 1 }] } } }, time: 0, boxes: new Map(), vehicles: [] });
assert.equal(nodes.get(939).lightCluster, undefined, 'actual unlit branch node is retained');
assert.equal(nextControllerRouteEnd(v.route, 0, cl, 100, entry), 6, 'same controller reappears only after the complete source connection');
const before = JSON.stringify(raw);
let path = t.reservationPath(v, v.edge, 1, v.route[0], entry, 4);
assert.ok(path.internalEdges.has(edges.get(1242)) && path.internalEdges.has(edges.get(1246)), 'reservation covers the connecting lane across unlit branch and shape nodes');
assert.notEqual(path.exitNode.id, 938, 'reservation no longer stops at the first unlit branch');
const peers = raw.peers.map(p => ({ ...p, heading: p.h, length: p.id === 194 ? 4.69 : 4.36, width: p.id === 194 ? 1.83 : 1.73, y: .24 }));
assert.ok(signalMovementBlocked(v, path, peers), 'native stopped source queue blocks the admitted swept lane');
t.vehicles = peers;
assert.equal(t.boxCheck(v, v.edge, 1, v.route[0], entry, 4), 'wait', 'full controller admission waits before entry');
t.vehicles = [];
assert.notEqual(t.boxCheck(v, v.edge, 1, v.route[0], entry, 4), 'wait', 'empty literal movement can enter');
t.boxClaim(v, entry, path); path.entered = true; t.vehicles = peers;
assert.notEqual(t.boxCheck(v, v.edge, 1, v.route[0], entry, 4), 'wait', 'a committed movement keeps its clearance path');
assert.equal(JSON.stringify(raw), before, 'literal source fixture remains unchanged');

const straight = { segments: [{ p0x: 0, p0z: -5, p1x: 0, p1z: 30 }] }, body = { x: 0, z: 20, y: .24, heading: 0, width: 2, length: 5, speed: 0 };
assert.ok(signalMovementBlocked({ width: 2, y: .24 }, straight, [body]), 'body fully enclosing a path interval is occupied');
assert.ok(signalMovementBlocked({ width: 2, y: .24 }, straight, [{ ...body, heading: Math.PI / 2, x: 2 }]), 'turned stopped body reaches the swept lane');
assert.equal(signalMovementBlocked({ width: 2, y: .24 }, straight, [{ ...body, x: 5 }]), false, 'clear adjacent lane is not blocked');
assert.equal(signalMovementBlocked({ width: 2, y: .24 }, straight, [{ ...body, y: 8 }]), false, 'another road level does not fill the movement');
assert.equal(signalMovementBlocked({ width: 2, y: .24 }, straight, [{ ...body, speed: 4 }]), false, 'moving traffic keeps its existing following and collision checks');
const r = v.route[0], firstEnd = r.e.b, oldCluster = firstEnd.lightCluster;
firstEnd.lightCluster = {};
assert.equal(nextControllerRouteEnd(v.route, 0, cl, 100, entry), -1, 'another controller cannot be crossed');
firstEnd.lightCluster = oldCluster;
assert.equal(nextControllerRouteEnd(v.route, 0, cl, 10, entry), -1, 'long unresolved connection does not gain admission');
assert.equal(nextControllerRouteEnd([{ ...r, uturn: true }, ...v.route.slice(1)], 0, cl, 100, entry), -1, 'a U-turn does not create a through movement');
assert.equal(nextControllerRouteEnd(v.route, 0, cl, 100, {}), -1, 'a disconnected first leg is refused');
assert.equal(nextControllerRouteEnd([r, ...v.route.slice(2)], 0, cl, 100, entry), -1, 'missing intermediate literal leg is refused');
console.log('PASS: native linked-controller queue, full source route reservation, admission/committed/adjacent/level controls and no fabricated joins');
