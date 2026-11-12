import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sceneryBridgeProfiles, sceneryDeckBand } from '../../game/src/scenery-bridges.js';
import { scenerySourceProfile } from '../../game/src/scenery-source.js';
import { collideBuildings, buildingBlocksRoad } from '../../game/src/world.js';
import { pointInCollider, colliderDist } from '../../game/dev/harness/page/util.js';
import { readDistrictData } from './district-data.mjs';

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

// A degree-three link merge cannot ground-cap the middle of the same actual source way.
const mergeRows = [
    { id: 'w1', points: [[0, 0], [100, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '1', name: 'Deck' } },
    { id: 'w2', points: [[-200, 0], [-50, 0], [0, 0]], ids: [3, 4, 1], tags: { name: 'Deck' } },
    { id: 'w3', points: [[-50, -100], [-50, 0]], ids: [5, 4], tags: {}, cls: 1 },
    { id: 'w4', points: [[20, -50], [20, 50]], ids: [6, 7], tags: { name: 'Lower road' } },
];
out = resolve(fixture(mergeRows));
assert.equal(out.stats.unresolved.length, 0); assert.ok(out.stats.continuations.some(c => c.kind === 'same source way through merge' && c.sourceNodeId === 4)); checks += 2;
// A real named transverse cross-street still supplies the original ground cap at this junction.
out = resolve(fixture(mergeRows.map((r, i) => i === 2 ? { ...r, cls: 0, tags: { name: 'Actual cross street' } } : r)));
assert.ok(out.stats.unresolved.length > 0); checks++;

// A bridge alias may differ from the two mapped, parallel carriageway approach names.
const forkRows = [
    { id: 'w1', points: [[0, 0], [100, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '1', name: 'River bridge' } },
    { id: 'w2', points: [[-150, -8], [0, 0]], ids: [3, 1], tags: { name: 'Main Street', oneway: 'yes' } },
    { id: 'w3', points: [[0, 0], [-150, 8]], ids: [1, 4], tags: { name: 'Main Street', oneway: 'yes' } },
    { id: 'w4', points: [[20, -50], [20, 50]], ids: [5, 6], tags: { name: 'Lower road' } },
];
out = resolve(fixture(forkRows));
assert.equal(out.stats.unresolved.length, 0); assert.equal(out.stats.continuations.filter(c => c.kind.includes('parallel approach fork')).length, 2); checks += 2;
// The actual SR99 four-arm topology also contains an already eligible motorway-link merge.
out = resolve(fixture([...forkRows, { id: 'w5', points: [[0, 0], [40, 50]], ids: [1, 8], tags: {}, cls: 1 }]));
assert.equal(out.stats.unresolved.length, 0); assert.equal(out.stats.continuations.filter(c => c.kind.includes('parallel approach fork')).length, 2); checks += 2;
// A different ordinary road at the same four-arm mouth remains a real ground cap.
out = resolve(fixture([...forkRows, { id: 'w5', points: [[0, 0], [40, 50]], ids: [1, 8], tags: { name: 'Cross street' }, cls: 0 }]));
assert.ok(out.stats.unresolved.length > 0); assert.equal(out.stats.continuations.some(c => c.kind.includes('parallel approach fork')), false); checks += 2;
// Neither different names, a transverse arm, another class nor an elevated approach proves a fork.
for (const replacement of [
    { tags: { name: 'Side Street' } },
    { points: [[0, 0], [0, 150]] },
    { cls: 1 },
    { tags: { name: 'Main Street', layer: '2' } },
]) {
    out = resolve(fixture(forkRows.map((r, i) => i === 2 ? { ...r, ...replacement } : r)));
    assert.ok(out.stats.unresolved.length > 0); assert.equal(out.stats.continuations.some(c => c.kind.includes('parallel approach fork')), false); checks += 2;
}
// Literal core source constraints retain precedence even when the real fork is recognised.
const fixed = { sourceId: 'w1', road: 0, a: { x: 0, z: 0, y: 0, sourceId: 1 }, b: { x: 100, z: 0, y: 0, sourceId: 2 }, ya: 0, yb: 0, wL: 3.5, wR: 3.5, bridge: true, layer: 1 };
out = resolve(fixture(forkRows, [fixed]));
assert.ok(out.profiles.get(0).heights.every(y => y === 0)); assert.ok(out.stats.unresolved.length > 0); checks += 2;

// Exact positive source-layer service/floor connections are not literal ground-height evidence.
const elevatedRows = [
    { id: 'w1', points: [[0, 0], [100, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '1' } },
    { id: 'w2', points: [[-150, -8], [0, 0]], ids: [3, 1], tags: { layer: '1', level: '5' } },
    { id: 'w3', points: [[0, 0], [-150, 8]], ids: [1, 4], tags: { layer: '1', level: '5' } },
    { id: 'w4', points: [[20, -50], [20, 50]], ids: [5, 6], tags: {} },
];
out = resolve(fixture(elevatedRows));
assert.equal(out.stats.unresolved.length, 0); assert.ok(out.stats.continuations.some(c => c.kind.includes('positive source layer'))); checks += 2;
out = resolve(fixture(elevatedRows.map((r, i) => i === 2 ? { ...r, tags: { layer: '0', name: 'Actual ground street' } } : r)));
assert.ok(out.stats.unresolved.length > 0); checks++;

// A short mapped entry ends at an actual source building vertex, without claiming a floor height.
f = fixture([
    { id: 'w1', points: [[0, 0], [20, 0], [100, 0]], ids: [1, 8, 2], tags: { bridge: 'yes', layer: '1' } },
    { id: 'w2', points: [[20, 0], [20, 8]], ids: [8, 9], tags: {}, cls: 2 },
    { id: 'w3', points: [[50, -50], [50, 50]], ids: [3, 4], tags: {} },
]);
f.data.classes.push('service'); f.data.buildingIds = ['w123']; f.data.buildingFootprints = { 0: [[20, 8], [25, 8], [25, 15]] };
out = resolve(f);
assert.equal(out.stats.unresolved.length, 0); assert.ok(out.stats.continuations.some(c => c.sourceBuildingId === 'w123' && /unknown/.test(c.kind))); checks += 2;
f.data.buildingFootprints = { 0: [[21, 8], [25, 8], [25, 15]] };
out = resolve(f); assert.ok(out.stats.unresolved.length > 0); checks++;

// Stacked decks must clear the solved lower deck, not the lower road's initial zero estimate.
const stackedRows = [
    { id: 'w1', points: [[-100, 0], [100, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '2' } },
    { id: 'w2', points: [[0, -100], [0, 100]], ids: [3, 4], tags: { bridge: 'yes', layer: '1' } },
    { id: 'w3', points: [[-100, 50], [100, 50]], ids: [5, 6], tags: {} },
];
out = resolve(fixture(stackedRows));
const at = (p, x, z) => p.heights[p.points.findIndex(v => Math.hypot(v[0] - x, v[1] - z) < 1e-6)];
assert.ok(out.stats.ordering.converged); assert.ok(out.stats.ordering.iterations >= 2); assert.ok(at(out.profiles.get(0), 0, 0) - .4 - at(out.profiles.get(1), 0, 0) >= 5.2 - 1e-7); checks += 3;
const literalUpper = { sourceId: 'w1', road: 0, a: { x: -100, z: 0, y: 4, sourceId: 1 }, b: { x: 100, z: 0, y: 4, sourceId: 2 }, ya: 4, yb: 4, wL: 3.5, wR: 3.5, bridge: true, layer: 2 };
out = resolve(fixture(stackedRows, [literalUpper]));
assert.ok(out.profiles.get(0).heights.every(y => y === 4)); assert.ok(out.stats.unresolved.some(c => c.sourceId === 'w1' && c.requiredDisplacementM > 5.6)); checks += 2;

// An impossible short connected grade cycle cannot make unconstrained decks rise indefinitely.
out = resolve(fixture([
    { id: 'w1', points: [[-2, 0], [2, 0]], ids: [1, 2], tags: { bridge: 'yes', layer: '2', name: 'Deck' } },
    { id: 'w2', points: [[0, -2], [0, 2]], ids: [3, 4], tags: { bridge: 'yes', layer: '1', name: 'Deck' } },
    { id: 'w3', points: [[-2, 0], [0, -2]], ids: [1, 3], tags: { name: 'Deck' } },
    { id: 'w4', points: [[2, 0], [0, 2]], ids: [2, 4], tags: { name: 'Deck' } },
]));
assert.equal(out.stats.ordering.converged, false); assert.ok(out.stats.unresolved.length > 0); assert.ok(Math.max(...[...out.profiles.values()].flatMap(p => p.heights)) < 10); checks += 3;

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
for (const file of fs.readdirSync('game/data').filter(f => /^[a-z]+(-[a-z]+)?\.(json|bin\.gz)$/.test(f))) {
    const d = readDistrictData('game/data/' + file); if (d.roadGeometryPolicy !== 'source') continue;
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
