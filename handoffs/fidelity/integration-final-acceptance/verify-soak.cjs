const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const dir = path.join(__dirname, 'proof/soak-4198996');
const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'profile.json.gz'))));
const assessed = JSON.parse(fs.readFileSync(path.join(dir, 'assessment.json')));
assert.equal(raw.complete, true); assert.equal(raw.fatal, undefined);
assert.deepEqual(raw.errors, []); assert.deepEqual(raw.consoleErrors, []); assert.deepEqual(raw.failures, []);
assert.equal(raw.samples.length, 16); assert.ok(raw.wallDurationSeconds >= 900);
assert.ok(Math.abs(raw.samples.at(-1).physicalSimSeconds - 900) < 1e-6);
const native = raw.populationPreparation.final;
assert.deepEqual(native.counts, { moving: 618, parked: 9, active: 631, pool: 0 });
assert.equal(native.maxVehicles, 480); assert.deepEqual(native.target, { moving: 618, parked: 9 });
assert.equal(new Set(native.activeIds).size, 631);
const frames = [...raw.warmFrames, ...raw.samples.flatMap(s => s.frames), ...raw.refreshes.flatMap(r => r.frames), raw.finalFrame];
for (const f of frames) {
    assert.equal(f.population.people, 560); assert.equal(f.population.vehicles, 631);
    assert.ok(f.population.originalPeople && f.population.originalVehicles);
    assert.equal(f.stats.quality, 'high'); assert.equal(f.stats.auto, false);
    assert.equal(f.stats.pixelRatio, 1); assert.equal(f.stats.shadows, 4096); assert.equal(f.stats.post, 'full');
    assert.ok(f.draws.some(d => d.pass === 'mirror')); assert.ok(f.logical.calls <= 400 && f.logical.triangles <= 1500000);
    assert.equal(f.stats.drawCalls, f.before.calls + f.logical.calls); assert.equal(f.stats.triangles, f.before.triangles + f.logical.triangles);
}
for (const s of raw.samples) { assert.equal(s.people.length, 560); assert.deepEqual(s.visibleSnaps, []); assert.deepEqual(s.stalledRecoveries, []); }
assert.ok(raw.relocations.every(r => r.distance <= .4 || (!r.from.visible && !r.to.visible)));
assert.deepEqual(raw.refreshes.map(r => r.trigger), ['sun', 'cloud']);
for (const r of raw.refreshes) { assert.equal(r.frames.length, 35); assert.equal(r.frames.at(-1).pending, false); }
assert.ok(raw.finalFrame.fade < 1); assert.equal(assessed.finalReleaseAcceptance, false);
assert.equal(assessed.physical900Complete, true);
console.log('419 before-source proof: physical 900 s / 560 people / 631 vehicles; full high+mirror max 373 calls / 1,402,964 triangles. Final blend coverage explicitly incomplete.');
