import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { planInitialVehicleAdmission as plan, initialVehicleConflict } from '../../../../../game/src/initial-vehicle-admission.js';
import { planInitialVehicleAdmission as beforePriority } from './fixtures/helper-before-priority.mjs';

const own = new URL('./', import.meta.url), read = name => fs.readFileSync(new URL(name, own));
const bytes = read('fixtures/native-groz-c2acc8d/fixture.json.gz'), payload = zlib.gunzipSync(bytes);
const sha = b => createHash('sha256').update(b).digest('hex');
assert.equal(sha(payload), '8f6cb9e27941445c0d8515a79a1fb715797f6b86ab2af2e1952473aa8cf8ee9c');
const fixture = JSON.parse(payload), negative = JSON.parse(read('fixtures/native-failure.json'));
assert.equal(fixture.actorCount, 263); assert.equal(fixture.bodies.length, 263);
assert(fixture.livePoseRouteIdentityUnchanged);
const providers = new Map(fixture.providers.map(p => [p.id, p]));
const rows = new Map(fixture.providers.map(p => [p.id, new Map(p.candidates.map(c => [c.pose.s, c]))]));
const options = {
    canAdjust: v => v.canAdjust,
    candidates: v => providers.get(v.id).candidates.map(c => c.pose),
    validateCandidate: (v, b) => {
        const c = rows.get(v.id).get(b.s); assert(c);
        for (const k of ['x', 'y', 'z', 's', 'heading', 'pitch', 'roll']) assert.equal(b[k], c.pose[k]);
        assert.deepEqual(b.verticalInterval, c.pose.verticalInterval);
        for (const k of ['edge', 'lane', 'laneCur', 'dir', 'id', 'kind', 'length', 'width']) assert.equal(b[k], v[k]);
        if (!c.validation.source.valid) return c.validation.source;
        if (c.validation.shared.changedContextNeedsNativeRecheck) return { valid: false, reason: 'cached-shared-context-needs-native-recheck' };
        if (!c.validation.shared.valid) return { valid: false, reason: 'native-shared-lane-reservation' };
        return c.validation.physical;
    },
};
const input = JSON.stringify(fixture.bodies), random = Math.random;
let old, current, replay, elapsedMs;
Math.random = () => { throw Error('Priority search consumed RNG'); };
try {
    old = beforePriority(fixture.bodies, options);
    const t = performance.now(); current = plan(fixture.bodies, options); elapsedMs = performance.now() - t;
    replay = plan(fixture.bodies, options);
} finally { Math.random = random; }
assert.deepEqual(old.search, negative.search); assert.deepEqual(old.attempts, negative.attempts);
assert.deepEqual(old.updates, []); assert.equal(old.search.work, 8192);
assert(current.passed); assert.deepEqual(current, replay); assert.equal(JSON.stringify(fixture.bodies), input);
assert.equal(current.search.maxWork, old.search.maxWork); assert.equal(current.search.maxDepth, old.search.maxDepth);
assert(current.search.work < current.search.maxWork); assert(!current.search.workLimitReached);
assert(!current.updates.some(u => u.vehicle.id === 260), 'The source-rejected reverse tram must not be moved by weakening its gate');
for (let i = 0; i < current.bodies.length; i++) for (let j = i + 1; j < current.bodies.length; j++) assert(!initialVehicleConflict(current.bodies[i], current.bodies[j], { clearanceM: .05 }).conflict);
current.bodies.forEach((b, i) => { for (const k of ['edge', 'route', 'hist']) assert.equal(b[k], fixture.bodies[i][k]); });
assert.deepEqual(current.originalIds, fixture.bodies.map(b => b.id)); assert.equal(current.rngDraws, 0); assert.equal(current.applied, false);

// Observe the frozen old helper in memory only. Count visits/validations and
// reservation cycles without changing any planning decisions or production file.
const frozen = read('fixtures/helper-before-priority.mjs').toString();
assert.equal(sha(Buffer.from(frozen)), '7d3a81bebbcaeaabed1f964843f1d958534e5ca312ae9ccc433725355edc2ba0');
let observed = frozen + '\nexport const diagnostics = { candidates: {}, validations: {}, nodes: [], cycles: {} };\n';
for (const [site, replacement] of [
    ['search.candidateTests++;', 'search.candidateTests++; diagnostics.candidates[vehicle.id] = (diagnostics.candidates[vehicle.id] || 0) + 1;'],
    ['search.validationCalls++;', 'search.validationCalls++; diagnostics.validations[vehicles[index].id] = (diagnostics.validations[vehicles[index].id] || 0) + 1;'],
    ['const depth = held.size;', 'const depth = held.size; diagnostics.nodes.push({ id: vehicles[index].id, held: [...held].map(k => ({ id: vehicles[k].id, s: bodies[k].s })), work: search.work });'],
    ['if (lockedBodies.has(blocker.index)) search.cyclePrunes++;', "if (lockedBodies.has(blocker.index)) { search.cyclePrunes++; const key = vehicles[index].id + '>' + vehicles[blocker.index].id; diagnostics.cycles[key] = (diagnostics.cycles[key] || 0) + 1; }"],
]) { assert.equal(observed.split(site).length, 2); observed = observed.replace(site, replacement); }
const observer = await import('data:text/javascript;base64,' + Buffer.from(observed).toString('base64'));
assert.deepEqual(observer.planInitialVehicleAdmission(fixture.bodies, options), old);
assert.equal(observer.diagnostics.candidates[231], 2645); assert.equal(observer.diagnostics.validations[231], 5212);
assert.deepEqual(observer.diagnostics.cycles, { '231>261': 2567 });

const hit = (a, b) => initialVehicleConflict(a, b, { clearanceM: .05 });
const validBodies = id => providers.get(id).candidates.filter(c => c.validation.valid && !c.validation.shared.changedContextNeedsNativeRecheck).map(c => ({ ...fixture.bodies.find(b => b.id === id), ...c.pose }));
const tram = fixture.bodies.find(b => b.id === 261), busChoices = validBodies(231);
assert.equal(busChoices.length, 115); assert(busChoices.every(b => hit(b, tram).conflict));
const tramChoices = validBodies(261), firstFeasible = tramChoices.findIndex(t => busChoices.some(b => !hit(b, t).conflict));
assert.equal(firstFeasible, 3); assert.equal(tramChoices[3].s, tram.s - .5);
let shortPairClear = 0;
for (const a of validBodies(188)) for (const b of validBodies(223)) {
    if (!hit(a, b).conflict && [a, b].every(v => fixture.bodies.every(o => o.id === 188 || o.id === 223 || !hit(v, o).conflict))) shortPairClear++;
}
assert.equal(shortPairClear, 49, 'Literal short-edge containment has clear solutions; do not weaken it');
assert.equal(providers.get(260).candidates.length, 121);
assert(providers.get(260).candidates.every(c => !c.validation.source.valid && c.validation.source.reason === 'source-edge-direction-lane-access'));

// Small pure counterexample: an easy short blocker must not repeatedly consume
// the same finite budget retrying a long blocker pinned by the held root.
const make = (id, x, length) => ({ id, x, y: 0, z: 0, s: x, heading: -Math.PI / 2, length, width: 1, edge: { id, len: 100 }, dir: 1, lane: 0, laneCur: 0, verticalInterval: { min: 0, max: 3, source: 'synthetic-interval' } });
const small = [make(64, -19, 4), make(231, 1, 12), make(261, 0, 36)];
const stations = { 64: [-20.5, -21, -21.5, -22, -22.5, -23, -23.5, -24, -24.5, -25], 231: [21, 22, 23], 261: [0, -1, -2] };
const bounded = { maxSearchWork: 96, candidates: (v, b) => stations[v.id].map(x => ({ x, y: b.y, z: b.z, s: x, heading: b.heading })), validateCandidate: () => true };
const smallBefore = JSON.stringify(small), smallOld = beforePriority(small, bounded), smallNew = plan(small, bounded);
assert(!smallOld.passed && smallOld.search.workLimitReached); assert(smallNew.passed); assert(smallNew.search.work <= 96); assert.equal(JSON.stringify(small), smallBefore);

const result = {
    passed: true, sourceCommit: negative.sourceCommit, fixtureSha256: sha(payload), fixtureGzipSha256: sha(bytes),
    bodies: 263, projectedCandidates: fixture.providers.reduce((n, p) => n + p.candidates.length, 0),
    originalNativeReplayMatchesSearchAndAttempts: true, originalSearch: old.search, attribution: observer.diagnostics,
    originalFixedTramBusDomain: { heldTram: 261, station: tram.s, bus: 231, choices: 115, everyChoiceBlocked: true, minimumPenetrationM: Math.min(...busChoices.map(b => hit(b, tram).penetration)), firstFeasibleTramCandidateIndex: firstFeasible, firstFeasibleTramStation: tramChoices[firstFeasible].s },
    shortPairSourceValidClearCombinations: shortPairClear, sourceRejectedReverseTramCandidates: 121,
    prioritySearch: current.search, elapsedMs, deterministicReplay: true, rngDraws: 0, inputUnchanged: true,
    updates: current.updates.map(u => ({ id: u.vehicle.id, edgeId: u.vehicle.edge.id, sourceId: u.vehicle.edge.access?.sourceId, dir: u.vehicle.dir, lane: u.vehicle.lane, previous: u.previous, pose: u.pose })), unresolved: current.unresolved,
    boundedSynthetic: { oldPassed: smallOld.passed, oldSearch: smallOld.search, newPassed: smallNew.passed, newSearch: smallNew.search },
    scope: 'Pure order/pruning response with unchanged work/depth/clearance/source/long-body gates. Cached native source/static validation only for exact poses and context-independent nonshared mouth checks. All263 bodies retained. Does not certify source rail alignment/legal transit assignments or replace native provider regeneration/publication.',
};
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6); if (!out || fs.existsSync(out)) throw Error('Use --out=NEW_REPORT');
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, bodies: 263, projectedCandidates: result.projectedCandidates, originalWork: old.search.work, newSearch: current.search, elapsedMs, unresolved: current.unresolved.length, shortPairClear, boundedSynthetic: { old: smallOld.passed, new: smallNew.passed, newWork: smallNew.search.work } }));
