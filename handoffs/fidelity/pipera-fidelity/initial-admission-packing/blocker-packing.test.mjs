import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planInitialVehicleAdmission, initialVehicleConflict } from '../../../../game/src/initial-vehicle-admission.js';

// Explicit synthetic source-station fixtures. Real native projections are a
// separate retained-data control, not inferred from these straight coordinates.
const results = [];
const body = (id, x, length = 2, bus = false) => ({ id, x, y: .24, z: 0, s: x, heading: -Math.PI / 2, length, width: 1,
    bus, long: bus, kind: bus ? 'fixture-bus' : 'fixture-car', dir: 1, lane: 0, laneCur: 0,
    edge: { id: 'fixture-source-' + id, len: 40 }, mesh: { identity: id },
    route: [{ sourceId: 'retained-route-' + id }], hist: [{ sourceId: 'retained-history-' + id }],
    verticalInterval: { min: .2, max: bus ? 3.5 : 1.8, source: 'explicit-synthetic-body-interval' } });
const poses = stations => (v, b) => (stations[v.id] || []).map(x => ({ x, y: b.y, z: b.z, s: x, heading: b.heading }));
function options(stations, fixed = new Set(), validate = () => true) {
    return { candidates: poses(stations), canAdjust: v => !fixed.has(v.id), validateCandidate: (v, b, context) => {
        assert.equal(b.edge, v.edge); assert.equal(b.dir, v.dir); assert.equal(b.lane, v.lane); assert.equal(b.laneCur, v.laneCur);
        assert(stations[v.id]?.includes(b.s), 'Candidate/recheck must retain an explicitly supplied legal source station');
        return validate(v, b, context);
    } };
}
const snapshot = list => JSON.stringify(list);
function unchanged(list, before) { assert.equal(snapshot(list), before); }
function clear(plan) { for (let i = 0; i < plan.bodies.length; i++) for (let j = i + 1; j < plan.bodies.length; j++) assert(!initialVehicleConflict(plan.bodies[i], plan.bodies[j], { clearanceM: .05 }).conflict); }
function noTentativeRecords(plan) { assert(!plan.attempts.some(a => a.reason === 'accepted')); assert.equal(plan.updates.length, 0); }
const at = (plan, id) => plan.bodies.find(b => b.id === id).x;
function test(label, fn) { const detail = fn(); results.push({ label, passed: true, ...detail }); }

test('Old bus-neighbour counterexample: constrained bus candidate needs its flexible car blocker moved first', () => {
    const list = [body(61, 0, 4, true), body(366, 0, 4, true), body(127, 4.5)], before = snapshot(list);
    const opts = options({ 366: [4.5], 127: [8] }, new Set([61]));
    const old = planInitialVehicleAdmission(list, { ...opts, maxSearchDepth: 0 });
    assert(!old.passed); noTentativeRecords(old); assert.equal(old.unresolved.length, 1);
    const plan = planInitialVehicleAdmission(list, opts);
    assert(plan.passed); clear(plan); assert.deepEqual(plan.updates.map(u => u.vehicle.id), [127, 366]);
    assert.equal(at(plan, 366), 4.5); assert.equal(at(plan, 127), 8); unchanged(list, before);
    return { oldFlatUnresolved: old.unresolved.length, updates: plan.updates.map(u => ({ id: u.vehicle.id, pose: u.pose })), search: plan.search };
});

test('Three-body dependency chain retains every third body and respects the explicit depth limit', () => {
    const list = [body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5), body(4, 8)], before = snapshot(list);
    const opts = options({ 2: [4.5], 3: [8], 4: [11.5] }, new Set([1]));
    const short = planInitialVehicleAdmission(list, { ...opts, maxSearchDepth: 1 });
    assert(!short.passed); noTentativeRecords(short); assert.deepEqual(short.bodies, list); assert(short.search.depthPrunes > 0);
    const plan = planInitialVehicleAdmission(list, { ...opts, maxSearchDepth: 2 });
    assert(plan.passed); clear(plan); assert.deepEqual(plan.updates.map(u => u.vehicle.id), [4, 3, 2]);
    assert.equal(plan.search.deepest, 2); assert.equal(plan.search.maxReservedBodies, 3); unchanged(list, before);
    return { search: plan.search };
});

test('Later blocker failure backtracks an earlier blocker choice and removes its speculative accepted record', () => {
    const list = [body(1, 0, 8, true), body(2, 0, 8, true), body(3, 8), body(4, 12)], before = snapshot(list);
    const plan = planInitialVehicleAdmission(list, options({ 2: [10], 3: [16, 20], 4: [16] }, new Set([1])));
    assert(plan.passed); clear(plan); assert.equal(at(plan, 3), 20); assert.equal(at(plan, 4), 16);
    assert(!plan.attempts.some(a => a.id === 3 && a.s === 16 && a.reason === 'accepted'));
    assert.equal(plan.updates.find(u => u.vehicle.id === 3).previous.x, 8); unchanged(list, before);
    return { search: plan.search };
});

test('Held-body cycles and an immovable third body remain unresolved with complete rollback', () => {
    const list = [body(61, 0, 4, true), body(366, 0, 4, true), body(127, 4.5), body(500, 8)], before = snapshot(list);
    const plan = planInitialVehicleAdmission(list, options({ 366: [4.5], 127: [4.5, 0, 8] }, new Set([61, 500])));
    assert(!plan.passed); noTentativeRecords(plan); assert.deepEqual(plan.bodies, list); assert(plan.search.cyclePrunes > 0);
    assert.equal(at(plan, 500), 8); unchanged(list, before);
    return { unresolved: plan.unresolved.map(p => [p.a, p.b]), search: plan.search };
});

test('Multiple sibling blockers share the same finite reservation-depth bound', () => {
    const list = [body(1, 0, 8, true), body(2, 0, 8, true), body(3, 8), body(4, 12)], before = snapshot(list);
    const plan = planInitialVehicleAdmission(list, { ...options({ 2: [10], 3: [20], 4: [16] }, new Set([1])), maxSearchDepth: 1 });
    assert(!plan.passed); noTentativeRecords(plan); assert.deepEqual(plan.bodies, list);
    assert(plan.search.maxReservedBodies <= 2); assert(plan.search.depthPrunes > 0); unchanged(list, before);
    return { search: plan.search };
});

test('Final full-context source/shared validation can backtrack a geometrically clear blocker choice', () => {
    const list = [body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5)], before = snapshot(list), observations = [];
    const plan = planInitialVehicleAdmission(list, options({ 2: [4.5], 3: [8, 11] }, new Set([1]), (v, b, c) => {
        observations.push({ id: v.id, s: b.s, reservedBus: c.bodies[1].s });
        return v.id === 2 && c.bodies[2].s === 8 ? { valid: false, reason: 'shared-reservation-control' } : true;
    }));
    assert(plan.passed); clear(plan); assert.equal(at(plan, 3), 11);
    assert(observations.some(o => o.id === 3 && o.reservedBus === 4.5));
    assert(!plan.attempts.some(a => a.id === 3 && a.s === 8 && a.reason === 'accepted'));
    assert.deepEqual(plan.updates.map(u => u.vehicle.id), [3, 2]); unchanged(list, before);
    return { validations: observations.length, search: plan.search };
});

test('A failed final validator rolls back parent/child updates and records together', () => {
    const list = [body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5)], before = snapshot(list);
    const plan = planInitialVehicleAdmission(list, options({ 2: [4.5], 3: [8] }, new Set([1]), (v, _b, c) => !(v.id === 2 && c.bodies[2].s === 8)));
    assert(!plan.passed); noTentativeRecords(plan); assert.deepEqual(plan.bodies, list); unchanged(list, before);
    return { search: plan.search };
});

test('A failed later local transaction preserves an earlier committed direct repair', () => {
    const list = [body(10, -100, 4, true), body(11, -100), body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5), body(4, 8)];
    const before = snapshot(list), plan = planInitialVehicleAdmission(list, options({ 11: [-95], 2: [4.5], 3: [8] }, new Set([10, 1, 4])));
    assert(!plan.passed); assert.deepEqual(plan.updates.map(u => u.vehicle.id), [11]); assert.equal(at(plan, 11), -95);
    assert.deepEqual(plan.attempts.filter(a => a.reason === 'accepted').map(a => a.id), [11]);
    for (const id of [1, 2, 3, 4]) assert.equal(at(plan, id), list.find(b => b.id === id).x);
    unchanged(list, before); return { search: plan.search };
});

test('Work exhaustion never leaks a partly solved dependency chain', () => {
    const list = [body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5), body(4, 8)], before = snapshot(list);
    const opts = options({ 2: [4.5], 3: [8], 4: [11.5] }, new Set([1]));
    const observations = [];
    for (const limit of [1, 2, 4, 6, 8, 10, 12]) {
        const plan = planInitialVehicleAdmission(list, { ...opts, maxSearchWork: limit });
        assert(plan.search.work <= limit);
        if (!plan.passed) { noTentativeRecords(plan); assert.deepEqual(plan.bodies, list); }
        else clear(plan);
        observations.push({ limit, passed: plan.passed, work: plan.search.work });
    }
    unchanged(list, before); return { observations };
});

test('Recursive candidates cannot replace source edges, IDs, lanes, directions or body dimensions', () => {
    const list = [body(1, 0, 4, true), body(2, 0, 4, true), body(3, 4.5)], before = snapshot(list);
    const opts = options({ 2: [4.5], 3: [8] }, new Set([1])), exact = opts.candidates;
    opts.candidates = (v, b, c) => [...exact(v, b, c)].map(p => v.id === 3 ? { ...p, edge: { ...v.edge }, id: 999, lane: 2, dir: -1, width: .01 } : p);
    const plan = planInitialVehicleAdmission(list, opts);
    assert(!plan.passed); noTentativeRecords(plan); assert.deepEqual(plan.bodies, list); unchanged(list, before);
    return { search: plan.search };
});

test('Repeated planning is deterministic, consumes no RNG and preserves every input/source/model identity', () => {
    const list = [body(1, 0, 8, true), body(2, 0, 8, true), body(3, 8), body(4, 12)], before = snapshot(list);
    const opts = options({ 2: [10], 3: [16, 20], 4: [16] }, new Set([1]));
    const random = Math.random; let a, b;
    Math.random = () => { throw Error('Planner consumed RNG'); };
    try { a = planInitialVehicleAdmission(list, opts); b = planInitialVehicleAdmission(list, opts); }
    finally { Math.random = random; }
    assert(a.passed && b.passed); assert.deepEqual(a, b); unchanged(list, before);
    assert.deepEqual(a.originalIds, list.map(v => v.id)); assert.equal(a.rngDraws, 0); assert.equal(a.applied, false);
    a.bodies.forEach((v, i) => { for (const key of ['edge', 'mesh', 'route', 'hist']) assert.equal(v[key], list[i][key]); });
    a.updates.forEach(u => assert(list.includes(u.vehicle)));
    return { search: a.search };
});

test('Long bodies keep connected-leg candidate semantics instead of ordinary one-edge containment', () => {
    const list = [body(1, 0, 12, true), body(2, 0, 12, true), body(3, 13)], before = snapshot(list);
    list[1].edge.len = 4; const original = snapshot(list);
    const plan = planInitialVehicleAdmission(list, options({ 2: [13], 3: [21] }, new Set([1])));
    assert(plan.passed); clear(plan); assert.equal(plan.bodies[1].edge.len, 4); assert.equal(plan.bodies[1].s, 13);
    assert.equal(plan.bodies[1].route, list[1].route); assert.equal(plan.bodies[1].hist, list[1].hist); unchanged(list, original);
    assert.notEqual(before, original); return { search: plan.search };
});

test('Explicit candidate and search bounds reject invalid configuration without mutation', () => {
    const list = [body(1, 0), body(2, 0)], before = snapshot(list), opts = options({ 1: [4], 2: [8] });
    for (const extra of [{ maxSearchDepth: -1 }, { maxSearchDepth: .5 }, { maxSearchWork: 0 }, { maxSearchWork: Infinity }]) assert.throws(() => planInitialVehicleAdmission(list, { ...opts, ...extra }), /Invalid admission bounds/);
    unchanged(list, before); return {};
});

const report = { passed: true, scope: 'Synthetic pure source-station, transactional packing and rollback controls. Does not substitute for actual native static/shared validation or constructor publication.', controls: results.length, tests: results };
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (out) { if (fs.existsSync(out)) throw Error('Preserve prior results'); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report));
