// Independent controller, source, footprint and collider evidence checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const before = path.resolve(process.argv[2] || path.join(__dirname, 'proof/before'));
const after = path.resolve(process.argv[3] || path.join(__dirname, 'proof/after'));
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json')));
const bd = read(before, 'drive'), ad = read(after, 'drive');
assert.equal(ad.length, 10);
assert(bd.find(r => r.name === 'Bretea merge').hits.length > 0, 'baseline reproduces the physical barrier defect');
for (const r of ad) {
    assert(r.done && r.progress >= r.required - 1.01, 'actual controller completes ' + r.name);
    assert.equal(r.hits.length, 0, 'no static contact on ' + r.name);
    assert(r.maxDY < .03, 'continuous controller height on ' + r.name);
    assert(r.maxDev < .5, 'source lane is followed on ' + r.name);
}
const sourceB = read(before, 'source'), sourceA = read(after, 'source');
assert.equal(sourceB.data, sourceA.data, 'source XY, width, lane and access data remain byte-identical');
assert.notEqual(sourceB.world, sourceA.world);
assert.deepEqual(sourceB.errors, []); assert.deepEqual(sourceA.errors, []);
assert.equal(read(after, 'inspect').profile.gradeResidual, 0);
const bo = read(before, 'overlaps'), ao = read(after, 'overlaps');
assert.equal(ao.seams.length, bo.seams.length, 'same complete target road-pair intersections are measured');
assert(ao.seams.some(q => q.road === 165 && q.roadF === 242) && ao.seams.some(q => q.road === 167 && q.roadF === 243));
assert(Math.max(...bo.seams.flatMap(q => q.heightDifference.map(Math.abs))) > 1, 'baseline contains the fork step');
for (const q of ao.seams) assert(Math.max(...q.heightDifference.map(Math.abs)) < .015, 'target asphalt surfaces share a level');
for (const q of ao.clearances.filter(q => q.bridge)) assert(Math.min(...q.clear) >= 5.2 - 1e-6, 'the earlier approach retains true upper-deck clearance');
const pair = q => [q.e, q.f].sort((a, b) => a - b).join(':');
const inventory = new Map(ao.separations.map(q => [pair(q), q]));
assert(bo.separations.length > 50 && ao.separations.length > 50, 'whole-world footprint separation inventory is present');
for (const q of bo.separations.filter(q => q.minClearance >= 5.2)) {
    const afterPair = inventory.get(pair(q));
    assert(afterPair && afterPair.minClearance >= 5.2 - 1e-6, 'previously clear road footprints stay clear: ' + pair(q));
}
for (const dir of [before, after]) {
    const walls = read(dir, 'walls');
    assert(walls.checks.length >= 4);
    for (const q of walls.checks) {
        assert(q.active, 'retained guard blocks at its physical height');
        assert(!q.under && !q.over && !q.side, 'guard rejects vertical and lateral negative controls');
    }
}
const bg = read(before, 'geometry'), ag = read(after, 'geometry');
const near = (a, b) => a.type === b.type && a.x === b.x && a.z === b.z;
const newHigh = ag.issues.filter(q => q.severity === 'high' && !bg.issues.some(b => near(b, q)));
assert.deepEqual(newHigh, [], 'no new high geometry finding');
for (const [x, z] of [[432.5, -745.2], [410.6, -759.1]]) assert(!ag.issues.some(q => q.severity === 'high' && Math.hypot(q.x - x, q.z - z) < 3), 'assigned high seam removed');
for (const pose of read(after, 'poses')) {
    assert(pose.quality === 'high' && pose.mirrorEnabled && pose.traffic.vehicles > 0);
    const steady = pose.samples.at(-1); // first sample retains setup counters; never reset inside a complete frame
    assert(steady.drawCalls <= 400 && steady.triangles <= 1500000);
}
const newMedium = ag.issues.filter(q => q.severity === 'medium' && !bg.issues.some(b => near(b, q)));
assert.deepEqual(newMedium, [], 'no new medium geometry finding at exact type/location');
console.log(JSON.stringify({ pass: true, controllerRoutes: ad.length, beforeBreteaContactsCapped: bd.find(r => r.name === 'Bretea merge').hits.length,
    sourcePreserved: sourceA.data, previouslyClearFootprintPairs: bo.separations.filter(q => q.minClearance >= 5.2).length,
    guardPositiveNegativeGroups: read(after, 'walls').checks.length, newMediumFindings: newMedium }, null, 2));
