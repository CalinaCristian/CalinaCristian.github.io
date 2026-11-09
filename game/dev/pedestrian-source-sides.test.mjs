import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Traffic, Pedestrians } from '../src/traffic.js';
import { EdgeIndex } from '../src/nav.js';
import * as THREE from '../vendor/three.module.min.js';
const baseline = process.argv.find(v => v.startsWith('--baseline='))?.slice(11);
const Base = baseline ? await import(pathToFileURL(baseline + '/game/src/traffic.js')) : null;
let serial = 0;
const node = (x, z) => ({ x, z, radius: 0, edges: [] });
function edge(a, b, right = 2.5, left = 0) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len;
    const e = { id: serial++, a, b, len, dirx, dirz, nx: -dirz, nz: dirx, wR: 3, wL: 3, halfW: 3, sidewalk: 2.5,
        sidewalkRightM: right, sidewalkLeftM: left, type: 'residential', ya: 0, yb: 0, layer: 0 };
    a.edges.push(e); b.edges.push(e); return e;
}
function traffic(edges, buc = true) {
    return { buc, city: { id: buc ? 'bucharest' : 'seattle' }, group: new THREE.Group(), stats: {},
        world: { district: true, graph: { edges, nodes: [...new Set(edges.flatMap(e => [e.a, e.b]))] }, pois: [], buildings: [], walkTop: () => .13,
            sidewalkWidth: (e, s) => s > 0 ? e.sidewalkRightM : e.sidewalkLeftM },
        index: new EdgeIndex(edges), grid: { items: [], query() {} } };
}
function grid() {
    const ns = Array.from({ length: 11 }, (_, j) => Array.from({ length: 11 }, (_, i) => node(i * 24, j * 24))), es = [];
    for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) { if (i < 10) es.push(edge(ns[j][i], ns[j][i + 1])); if (j < 10) es.push(edge(ns[j][i], ns[j + 1][i])); }
    es[0].sidewalkLeftM = es[0].sidewalkRightM = 0; return traffic(es);
}
const T = grid(), peds = new Pedestrians(T, 560);
assert.equal(peds.list.length, 560); assert.equal(peds.crowd.count, 560);
assert.ok(peds.list.every(p => p.live && !p.hidden && p.side === 1 && p.e !== T.world.graph.edges[0]));
assert.equal(peds.walkSpace(T.world.graph.edges[1], -1).cells.length, 0, 'an absent median has no walking cells even over free grass');
assert.equal(peds.ok(T.world.graph.edges[0]), false, 'only roads with no side are excluded before the weighted pick');
if (Base) {
    const old = new Base.Pedestrians(grid(), 560);
    assert.ok(old.list.some(p => p.side === -1), 'the literal old constructor reproduces wrong-side walkers');
    assert.deepEqual(peds.list.map(p => [p.i, p.speed, p.phase, p.scale]), old.list.map(p => [p.i, p.speed, p.phase, p.scale]));
    assert.deepEqual(Array.from({ length: 32 }, () => peds.rng()), Array.from({ length: 32 }, () => old.rng()), 'full original constructor RNG sequence retained');
    old.dispose();
}
const e = T.world.graph.edges[1], narrow = { ...e, sidewalkRightM: .8 };
assert.ok(peds.off(narrow, 1) >= narrow.wR + .35 && peds.off(narrow, 1) <= narrow.wR + .45 + 1e-9);
assert.ok(peds.off(narrow, 1) + peds.maxOut(narrow, 1) <= narrow.wR + .8 - .35 + 1e-9);
assert.equal(peds.maxOut({ ...narrow, sidewalkRightM: .2 }, 1), 0);
const legacy = Object.create(Pedestrians.prototype); legacy.t = { world: { district: true } };
assert.equal(legacy.maxOut({ a: {}, b: {}, halfW: 3 }, 1), 3, 'missing scalar width retains the original legacy drift fallback');
assert.equal(legacy.width({ sidewalk: 3, sidewalkLeftM: 0 }, -1), 0, 'explicit edge widths work without a World callback');
legacy.t.world.sidewalkWidth = () => undefined;
assert.equal(legacy.off({ sidewalk: .8, wR: 3 }, 1), 3.9, 'an unresolved callback retains the exact legacy scalar line');
const wetTraffic = traffic([edge(node(0, 0), node(100, 0))]); wetTraffic.world.isWater = (x, z) => x < 20 && z > 0;
const wet = new Pedestrians(wetTraffic, 16);
assert.equal(wet.list.length, 16); assert.ok(wet.list.every(p => p.side === 1 && !wet.inWater(p.x, p.z)), 'water recovery never flips into an absent opposite side'); wet.dispose();
const C = Object.create(Pedestrians.prototype), line = edge(node(0, 0), node(100, 0));
Object.assign(C, { t: traffic([line]), list: [], crowd: { reach: () => .3 }, _walkSpace: new Map(), _side: new Map(), obsGrid: { query() {} }, stats: {}, rng: () => { throw Error('Initial admission adds no RNG'); } });
const wrong = { i: 1, e: line, side: -1, dir: 1, s: 50, x: 50, z: -4.375, state: 'walk', legs: [], scale: 1 };
C.list = [wrong]; assert.equal(C.freeWalkPoint(wrong.x, wrong.z), true);
line.sidewalkLeftM = 2.5; C.t.world.sidewalkWidth = (e, side) => side > 0 ? 2.5 : 0;
assert.equal(C.width(line, -1), 0, 'World source policy has precedence over explicit edge fallback');
assert.equal(C.admitInitialWalk(wrong), true); assert.equal(wrong.side, 1);
const live = { ...wrong, x: 50, z: -4.375, side: -1, live: true, legs: [] }; C.list = [live];
C.placeWalk(live); assert.deepEqual([live.x, live.z], [50, -4.375], 'wrong-side live recovery preserves the actual current pose'); assert.equal(live.state, 'legs');
// Crossings need real sidewalk endpoints on both sides of the crossed road.
const joint = node(0, 0), incoming = edge(node(-40, 0), joint), outgoing = edge(node(40, 0), joint); joint.crossing = true;
const R = Object.create(Pedestrians.prototype); Object.assign(R, { t: traffic([incoming, outgoing]), list: [], crowd: { reach: () => .3 }, _walkSpace: new Map(), _side: new Map(), obsGrid: { query() {} }, stats: {}, rng: () => .99 });
R.kerbClamp = R.obsClamp = () => false;
const routePed = () => ({ i: 3, e: incoming, side: 1, dir: 1, s: incoming.len, x: 0, z: 4.375, state: 'walk', legs: [] });
const routed = routePed(); R.planNode(routed, joint); assert.equal(routed.state, 'walk'); assert.equal(routed.dir, -1); assert.ok(!routed.legs.some(l => l.cross));
if (Base) { const old = routePed(); Base.Pedestrians.prototype.planNode.call(R, old, joint); assert.ok(old.legs.some(l => l.cross), 'the literal old planner enters the missing incoming median endpoint'); }
const P = Object.create(Traffic.prototype); P.buc = true; P.world = C.t.world; P.index = C.t.index;
assert.equal(P.assessParking({ x: 50, z: -4.5, y: .24, heading: 0 }).reasons.includes('sidewalk'), false, 'no ghost median parking ticket');
assert.equal(P.assessParking({ x: 50, z: 4.5, y: .24, heading: 0 }).reasons.includes('sidewalk'), true, 'actual sidewalk parking remains illegal');
peds.dispose();
console.log('PASS: actual 560 constructor IDs/styles/RNG, source cells/admission, live recovery, narrow widths, crossing endpoints and parking side legality');
