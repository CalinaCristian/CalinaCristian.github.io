import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { planInitialVehicleAdmission, initialVehicleConflict } from '../../../../game/src/initial-vehicle-admission.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
if (!args.fixture || !args.out) throw Error('--fixture=EXACT_NATIVE_JSON_OR_GZ --out=NEW_REPORT');
if (fs.existsSync(args.out)) throw Error('Preserve previous results');
const bytes = fs.readFileSync(args.fixture), payload = args.fixture.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes;
const fixtureSha256 = createHash('sha256').update(payload).digest('hex');
assert.equal(fixtureSha256, '99cdc37345694ca7fff252f94dfe1adce7cb7caad63beb27459d37126f6dba0a');
const f = JSON.parse(payload), bodies = f.bodies;
assert.equal(f.actorCount, 484); assert.equal(bodies.length, 484); assert.equal(f.providers.length, 484);
assert(f.livePoseRouteIdentityUnchanged);
const providers = new Map(f.providers.map(p => [p.id, p]));
assert.equal(providers.size, 484);
const rows = new Map(f.providers.map(p => [p.id, new Map(p.candidates.map(c => [c.pose.s, c]))]));
const before = JSON.stringify(bodies), originalIds = bodies.map(v => v.id), refs = bodies.map(v => ({ v, edge: v.edge, route: v.route, hist: v.hist }));
const options = {
    canAdjust: v => v.canAdjust,
    candidates: v => providers.get(v.id).candidates.map(c => c.pose),
    validateCandidate: (v, b) => {
        const row = rows.get(v.id).get(b.s); assert(row, 'Only an actual retained native provider station may be proposed/rechecked');
        for (const k of ['x', 'y', 'z', 'heading', 's', 'pitch', 'roll']) assert.equal(b[k], row.pose[k], k);
        assert.deepEqual(b.verticalInterval, row.pose.verticalInterval);
        assert.equal(b.edge, v.edge); assert.equal(b.dir, v.dir); assert.equal(b.lane, v.lane); assert.equal(b.laneCur, v.laneCur);
        // These outputs are unchanged for nonshared native paths. A true shared
        // section requires a live native planned-context recheck, not this cache.
        if (row.validation.shared.changedContextNeedsNativeRecheck) return { valid: false, reason: 'retained-shared-baseline-needs-native-context-recheck' };
        return row.validation;
    },
};
const random = Math.random; let old, plan, replay, elapsedMs;
Math.random = () => { throw Error('Native fixture planning consumed RNG'); };
try {
    old = planInitialVehicleAdmission(bodies, { ...options, maxSearchDepth: 0 });
    const t = performance.now(); plan = planInitialVehicleAdmission(bodies, options); elapsedMs = performance.now() - t;
    replay = planInitialVehicleAdmission(bodies, options);
} finally { Math.random = random; }
assert.equal(JSON.stringify(bodies), before);
assert.deepEqual(plan, replay, 'The complete native retained plan, records and bounded work must replay deterministically');
assert.deepEqual(plan.originalIds, originalIds); assert.equal(plan.rngDraws, 0); assert.equal(plan.applied, false);
plan.bodies.forEach((b, i) => { assert.equal(b.edge, refs[i].edge); assert.equal(b.route, refs[i].route); assert.equal(b.hist, refs[i].hist); });
plan.updates.forEach(u => { assert.equal(u.vehicle, refs.find(r => r.v.id === u.vehicle.id).v); assert(!rows.get(u.vehicle.id).get(u.pose.s).validation.shared.changedContextNeedsNativeRecheck); });
const result = {
    passed: plan.passed, sourceCommit: 'c4fd6255f928101e27874f37776ed5be8d805827', fixtureSha256,
    fixtureBytes: payload.length, inputArchiveSha256: createHash('sha256').update(bytes).digest('hex'), inputArchiveBytes: bytes.length,
    bodyCount: bodies.length, nativeCandidateCount: f.providers.reduce((n, p) => n + p.candidates.length, 0),
    flat: { passed: old.passed, unresolved: old.unresolved, updates: old.updates.map(u => u.vehicle.id), search: old.search },
    search: plan.search, elapsedMs, updates: plan.updates.map(u => ({ id: u.vehicle.id, edgeId: u.vehicle.edge.id, sourceId: u.vehicle.edge.access?.sourceId, dir: u.vehicle.dir, lane: u.vehicle.lane, laneCur: u.vehicle.laneCur, previous: u.previous, pose: u.pose })),
    unresolved: plan.unresolved, invalidBodies: plan.invalidBodies, unknownHeights: plan.unknownHeights, attempts: plan.attempts,
    originalIds, inputUnchanged: true, rngDraws: 0, deterministicReplay: true,
    scope: 'Exact484 PRE-admission c4 bodies and48,294 native baseline-origin projected candidate poses. Native source/static and nonshared-mouth validation outputs reused only at the exact retained pose. True shared-section candidate outputs are conservatively rejected. Full484 pair checks remain. Runtime native provider regeneration and constructor publication are still required integration gates.',
};
fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, bodyCount: result.bodyCount, nativeCandidateCount: result.nativeCandidateCount, elapsedMs, updates: result.updates.map(u => [u.id, u.pose.s]), unresolved: result.unresolved.map(p => [p.a, p.b]), search: result.search }));
assert(!old.passed, 'The retained old flat-packing counterexample must remain visible');
assert.deepEqual(old.unresolved.map(p => [p.a, p.b]), [[61, 366], [155, 315]]);
assert(plan.passed, 'Every native fixture conflict must be cleared without dropping a body or bypassing validation');
for (let i = 0; i < plan.bodies.length; i++) for (let j = i + 1; j < plan.bodies.length; j++) assert(!initialVehicleConflict(plan.bodies[i], plan.bodies[j], { clearanceM: .05 }).conflict);
