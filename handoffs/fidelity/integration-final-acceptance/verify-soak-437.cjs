// Verify immutable 437 source evidence, not later integrated collision/source compatibility.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const dir = path.resolve(process.argv[2] || path.join(__dirname, 'proof/soak-4378317'));
const plain = path.join(dir, 'profile.json'), packed = path.join(dir, 'profile.json.gz');
const allowIncomplete = process.argv.includes('--allow-incomplete');
const raw = JSON.parse(fs.existsSync(plain) ? fs.readFileSync(plain, 'utf8') : zlib.gunzipSync(fs.readFileSync(packed)));
const source = JSON.parse(fs.readFileSync(path.join(dir, 'source-manifest.json'), 'utf8'));
assert.equal(source.commit, '4378317f3fcdccc886d6c7c1ed092ee15d95db8a');
if (!allowIncomplete) assert.equal(raw.complete, true, '437 runner lacks terminal completion; use --allow-incomplete only for explicitly partial assessment');
assert.equal(raw.fatal, undefined);
assert.deepEqual(raw.errors, []); assert.deepEqual(raw.consoleErrors, []); assert.deepEqual(raw.failures, []);
for (const [file, hash] of Object.entries(raw.source)) assert.equal(hash, source.files[file], file + ' source hash');
assert.equal(raw.samples.length, 16); if (!allowIncomplete) assert.ok(raw.wallDurationSeconds >= 900);
assert.ok(Math.abs(raw.samples.at(-1).physicalSimSeconds - 900) < 1e-6);
assert.deepEqual(raw.samples.map(s => s.minute), Array.from({ length: 16 }, (_, i) => i));
const native = raw.populationPreparation.final;
assert.deepEqual(native.counts, { moving: 618, parked: 9, active: 631, pool: 0 });
assert.equal(native.maxVehicles, 480); assert.deepEqual(native.target, { moving: 618, parked: 9 });
assert.equal(new Set(native.activeIds).size, 631);
const frames = [...raw.warmFrames, ...raw.samples.flatMap(s => s.frames), ...raw.refreshes.flatMap(r => r.frames), ...(raw.finalFrame ? [raw.finalFrame] : [])];
assert.ok(raw.warmFrames.length); assert.equal(raw.warmFrames.at(-1).pending, false); assert.equal(raw.warmFrames.at(-1).fade, 1);
for (const f of frames) {
    assert.equal(f.population.people, 560); assert.equal(f.population.vehicles, 631);
    assert.ok(f.population.originalPeople && f.population.originalVehicles);
    assert.equal(f.stats.quality, 'high'); assert.equal(f.stats.auto, false);
    assert.equal(f.stats.pixelRatio, 1); assert.equal(f.stats.shadows, 4096); assert.equal(f.stats.post, 'full');
    assert.ok(f.draws.some(d => d.pass === 'mirror'));
    assert.ok(f.logical.calls <= 400 && f.logical.triangles <= 1500000);
    assert.equal(f.stats.drawCalls, f.before.calls + f.logical.calls);
    assert.equal(f.stats.triangles, f.before.triangles + f.logical.triangles);
}
const firstPeople = raw.samples[0].people.map(p => p.id).sort((a, b) => a - b);
for (const s of raw.samples) {
    assert.deepEqual(s.people.map(p => p.id).sort((a, b) => a - b), firstPeople);
    assert.equal(s.people.length, 560); assert.deepEqual(s.visibleSnaps, []); assert.deepEqual(s.stalledRecoveries, []);
}
if (raw.relocations) assert.ok(raw.relocations.every(r => r.distance <= .4 || (!r.from.visible && !r.to.visible))); else if (!allowIncomplete) assert.fail('Missing terminal relocation audit');
assert.deepEqual(raw.refreshes.map(r => r.trigger), ['sun', 'cloud']);
for (const r of raw.refreshes) {
    assert.ok(r.frames.length >= 30); assert.equal(r.frames[0].pending, true);
    assert.equal(r.frames.at(-1).pending, false); assert.equal(r.frames.at(-1).fade, 1);
}
if (raw.finalFrame) { assert.equal(raw.finalFrame.pending, false); assert.equal(raw.finalFrame.fade, 1); } else if (!allowIncomplete) assert.fail('Missing terminal measured frame');
for (const label of ['minute-0', 'minute-5', 'minute-10', 'minute-15', ...(raw.finalFrame ? ['evolved-final'] : [])]) {
    const row = raw.captures.find(c => c.label === label); assert.ok(row, 'missing capture ' + label);
    assert.ok(fs.statSync(path.join(dir, row.file)).size > 0, 'empty capture ' + label);
}
console.log(JSON.stringify({ sourceCommit: source.commit, sourceRunCompleted: raw.complete === true, terminalFinalFramePresent: !!raw.finalFrame, relocationAuditPresent: !!raw.relocations, partialAssessmentRequested: allowIncomplete, physical900Complete: true, initialReflectionSettled: true,
    sunAndCloudPublicationAndFadeComplete: true, people: 560, vehicles: 631, completeFrames: frames.length,
    maxCalls: Math.max(...frames.map(f => f.logical.calls)), maxTriangles: Math.max(...frames.map(f => f.logical.triangles)),
    finalIntegratedSourceAcceptance: false, reason: 'Later generic mouth rule changes exact Romana wall and solid mesh output; compatibility/retest remains root-owned.' }));
