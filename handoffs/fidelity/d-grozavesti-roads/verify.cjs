// Verify the independent before/after physical and geometry evidence produced by run-targeted.cjs.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const before = path.resolve(process.argv[2] || path.join(__dirname, 'proof/before'));
const after = path.resolve(process.argv[3] || path.join(__dirname, 'proof/after'));
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json')));
const b = read(before, 'inspect'), a = read(after, 'inspect');
for (const [i, minimum] of [[1, 5.2], [2, 5.2]]) {
    assert(Math.max(...b.points[i].hs) - .24 < 2, 'before fixture reproduces ramp stacking');
    assert(Math.max(...a.points[i].hs) - .24 >= minimum, 'ramp clears lower street');
    assert(a.points[i].hs.some(h => Math.abs(h - .24) < 1e-8), 'ground street remains at grade');
}
assert.equal(a.stats.gradeResidual, 0, 'all real edges preserve the 8% grade constraint');
for (const q of read(after, 'overlaps')) {
    if (q.bridge && q.area > .05) assert(Math.min(...q.clear) >= 5.2 - 1e-6, 'all exact approach/upper-deck overlap vertices retain clearance');
}
for (const r of read(after, 'drive')) {
    assert(r.done, 'actual Player.update completes ' + r.name);
    assert(r.progress >= r.required - 1.01, 'trajectory reaches its endpoint');
    assert(r.maxDY < .03, 'no controller height jump');
    assert(r.maxDev < .5, 'car remains on its lane');
    assert.equal(r.hits.length, 0, 'no static collision on ' + r.name);
}
for (const dir of [before, after]) {
    const walls = read(dir, 'walls');
    assert(walls.checks.length >= 2, 'both source ramp sides keep guard walls');
    for (const q of walls.checks) {
        assert.equal(q.under, false); assert.equal(q.active, true);
        assert.equal(q.over, false); assert.equal(q.side, false);
    }
    assert.equal(walls.virtual.closures.length, 2, 'both legal map-end closures remain');
}
const key = i => `${i.type}|${i.x}|${i.z}`;
const bg = read(before, 'geometry'), ag = read(after, 'geometry');
const old = new Set(bg.issues.map(key));
assert.equal(ag.issues.filter(i => i.severity !== 'low' && !old.has(key(i))).length, 0, 'no new high or medium geometry finding');
for (const [x, z] of [[191.2, -448.4], [196.8, -464.7], [205.8, -488]]) {
    assert(!ag.issues.some(i => i.type === 'ribbon-stacked' && i.x === x && i.z === z));
}
assert(ag.issues.some(i => i.type === 'phantom-wall'), 'raw virtual-route finding is retained, not filtered');
const bs = read(before, 'source'), as = read(after, 'source');
assert.equal(bs.data, as.data, 'no source data or source width changed');
assert.notEqual(bs.world, as.world, 'road patch is present');
assert.deepEqual(as.errors, []);
const summary = read(path.join(__dirname, 'proof'), 'full-visual-comparison');
assert.equal(summary.addedHighMedium.length, 0);
assert(summary.afterPerformance.trafficTriangles <= 1500000 && summary.afterPerformance.trafficCalls <= 400);
const warm = read(path.join(__dirname, 'proof'), 'warm-traffic-comparison');
for (const side of ['before', 'after']) {
    const q = warm[side];
    assert(q.mirrorEnabled && q.quality === 'high');
    assert(q.trafficVisibility.vehicles && q.trafficVisibility.peds);
    assert.equal(q.warmedSamples.length, 3);
    for (const f of q.warmedSamples) assert(f.triangles <= 1500000 && f.drawCalls <= 400);
}
console.log('Grozavesti roads: target clearance, exact upper-deck overlaps, six controller trajectories, guard height/side counterexamples, retained closures, source integrity, and no new high/medium geometry findings PASS.');
