import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sceneryBridgeProfiles, sceneryDeckBand } from '../../game/src/scenery-bridges.js';
import { scenerySourceProfile } from '../../game/src/scenery-source.js';
import { collideBuildings, buildingBlocksRoad } from '../../game/src/world.js';
import { pointInCollider, colliderDist } from '../../game/dev/harness/page/util.js';

let checks = 0;
const fixture = (rows, core = []) => {
    const data = { roadGeometryPolicy: 'source', scenery: [], scenerySourceGeometry: {}, sceneryAccess: {}, roadSourceGeometry: {}, classes: ['primary', 'primary_link'], roadWidths: {} }, profiles = [];
    for (const [i, row] of rows.entries()) {
        const { id, points, tags, ids = points.map((p, j) => i * 100 + j + 1), width = 7, cls = 0 } = row;
        data.scenery.push([width * 10, 0, cls, tags.bridge && tags.bridge !== 'no' ? 1 : 0]);
        data.scenerySourceGeometry[i] = { sourceId: id, projected: points, prepared: points, nodeIds: ids, tags };
        data.sceneryAccess[i] = { sourceId: id, publicDrive: tags.access !== 'private' };
        profiles.push({ precise: true, sourceId: id, points, widthM: width, leftM: width / 2, rightM: width / 2 });
    }
    core.forEach((e, i) => data.roadSourceGeometry[e.road ?? i] = { sourceId: e.sourceId });
    return { data, profiles, core };
};
const resolve = f => sceneryBridgeProfiles(f.data, f.profiles, f.core);
let f = fixture([{ id: 'w1', points: [[0, 0], [100, 0]], tags: { bridge: 'yes', layer: '7', name: 'River bridge', access: 'private' } }]);
let out = resolve(f);
assert.equal(out.stats.bridgePieces, 1); assert.ok(out.profiles.get(0).heights.every(y => y === 0)); assert.equal(out.profiles.get(0).access.publicDrive, false); checks += 3;
assert.match(out.stats.policy, /MODEL estimate/); assert.match(out.profiles.get(0).elevationSource, /estimate/); checks += 2;
assert.deepEqual(out.profiles.get(0).points.filter(p => p[0] === 0 || p[0] === 100), f.profiles[0].points); checks++;
assert.equal(resolve({ ...f, data: { ...f.data, roadGeometryPolicy: undefined } }).profiles.size, 0); checks++;

// Only an exact same-source edge or original node identity can supply an existing deck height.
const core = { sourceId: 'w1', road: 0, a: { x: 0, z: 0, y: 6, sourceId: 1 }, b: { x: 100, z: 0, y: 8, sourceId: 2 }, ya: 6, yb: 8, wL: 3.5, wR: 3.5, bridge: true, layer: 1 };
f = fixture([{ id: 'w1', points: [[0, 0], [50, 0], [100, 0]], tags: { bridge: 'yes', layer: '1' }, ids: [1, 3, 2] }], [core]);
out = resolve(f); assert.equal(out.profiles.get(0).heights[0], 6); assert.equal(out.profiles.get(0).heights.at(-1), 8); assert.equal(out.profiles.get(0).heights[out.profiles.get(0).points.findIndex(p => p[0] === 50)], 7); checks += 3;
f.core[0] = { ...core, sourceId: 'w999', a: { ...core.a, sourceId: 901 }, b: { ...core.b, sourceId: 902 } }; f.data.roadSourceGeometry[0].sourceId = 'w999';
out = resolve(f); assert.ok(out.profiles.get(0).heights.every(y => y === 0)); assert.equal(out.stats.coreTies, 0); checks += 2;

// Real crossing, source-connected approach; unrelated coincident node IDs do not become a junction.
f = fixture([
    { id: 'w1', points: [[0, 0], [100, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '1', name: 'Deck' } },
    { id: 'w2', points: [[-200, 0], [0, 0]], ids: [3, 1], tags: { name: 'Deck' } },
    { id: 'w3', points: [[100, 0], [300, 0]], ids: [2, 4], tags: { name: 'Deck' } },
    { id: 'w4', points: [[50, -50], [50, 50]], ids: [5, 6], tags: { name: 'Lower road' } },
]);
const before = JSON.stringify(f.data); out = resolve(f);
assert.ok(out.stats.crossings > 0); assert.equal(out.stats.unresolved.length, 0); assert.ok(Math.max(...out.profiles.get(0).heights) >= 5.6); checks += 3;
assert.ok(out.stats.approachPieces > 0); assert.equal(JSON.stringify(f.data), before); assert.equal(out.profiles.has(3), false); checks += 3;
for (const p of out.profiles.values()) for (let i = 1; i < p.points.length; i++) { assert.ok(Math.abs(p.heights[i] - p.heights[i - 1]) <= Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]) * .080001); checks++; }

// Exercise the actual production collision function and shared QA queries at every part of a slope.
const band = sceneryDeckBand([0, 0], [100, 0], 2, 10), poly = [[0, -3], [100, -3], [100, 3], [0, 3]];
const deck = { x: 50, z: 0, r: 51, poly, roadDeck: true, y0: 1.84, y1: 10.24, h: 10.24, roofHeightAt: (x, z, r) => band(x, z, r).top, minHeightAt: (x, z, r) => band(x, z, r).bottom };
for (const x of [2, 25, 50, 75, 98]) {
    const local = band(x, 0), under = local.bottom - 2.1, through = local.bottom + .1, above = local.top + .1;
    for (const [y, hit] of [[under, false], [through, true], [above, false], [local.top, false]]) {
        assert.equal(!!collideBuildings([deck], x, 0, .2, y, 2), hit, 'actual deck band at x=' + x + '/y=' + y);
        assert.equal(pointInCollider(deck, x, 0, 0, y, 2), hit, 'QA point band');
        assert.equal(Number.isFinite(colliderDist(deck, x, 0, y, 2, .2)), hit, 'QA distance band'); checks += 3;
    }
    assert.ok(collideBuildings([deck], x, 3.1, .2, through, .7), 'side contact with physical slab');
    assert.equal(collideBuildings([deck], x, 3.3, .2, through, .7), null); checks += 2;
}
assert.equal(buildingBlocksRoad(deck, 50, 0, 6), false); checks++;
const building = { ...deck, roadDeck: false, roofHeightAt: undefined, minHeightAt: undefined, y0: 0, y1: 12, h: 12 };
assert.equal(buildingBlocksRoad(building, 50, 0, .24), true); assert.ok(collideBuildings([building], 50, 0, .2, .24, 2)); checks += 2;

const districts = [];
for (const file of fs.readdirSync('game/data').filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync('game/data/' + file)); if (d.roadGeometryPolicy !== 'source') continue;
    const sourceBefore = JSON.stringify([d.scenery, d.sceneryAccess, d.scenerySourceGeometry]);
    const profiles = d.scenery.map((r, i) => scenerySourceProfile(d, i, []));
    const result = sceneryBridgeProfiles(d, profiles, []), expected = d.scenery.filter(r => r[3] & 1).length;
    assert.equal(result.stats.bridgePieces, expected, file + ': every actual mapped bridge emitted'); checks++;
    for (const [index, p] of result.profiles) {
        assert.equal(p.sourceId, d.scenerySourceGeometry[index].sourceId); assert.ok(p.heights.every(Number.isFinite)); checks += 2;
        for (const sourcePoint of profiles[index].points) { assert.ok(p.points.some(q => Math.hypot(q[0] - sourcePoint[0], q[1] - sourcePoint[1]) < 1e-6), 'retain every mapped vertex'); checks++; }
    }
    assert.equal(JSON.stringify([d.scenery, d.sceneryAccess, d.scenerySourceGeometry]), sourceBefore); checks++;
    districts.push({ district: file.replace('.json', ''), bridgePieces: expected, estimatedApproaches: result.stats.approachPieces, crossings: result.stats.crossings, unresolved: result.stats.unresolved.length });
}
console.log(JSON.stringify({ passed: true, checks, controls: 'All source bridge pieces emitted; exact same-source core ties; no layer-to-metre conversion; no input mutation or invented XY joins; real crossing/ramp grades; actual sloped deck underside/top/side collision and QA agreement; positive actual-building control', districts }, null, 2));
