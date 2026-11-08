const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const dir = path.join(__dirname, 'proof'), summary = JSON.parse(fs.readFileSync(path.join(dir, 'native-summary.json')));
assert.equal(summary.length, 9);
for (const row of summary) {
    const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, row.name + '.json.gz')));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), row.sha256);
    const { first, final, errors } = JSON.parse(raw);
    assert.deepEqual(errors, []); assert.equal(first.frame, 300); assert.equal(final.frame, 2400);
    for (const key of ['contacts', 'playerContacts', 'offRoad', 'conflicts', 'teleports', 'stoppedSlides', 'ghosts', 'redCrossings']) assert.deepEqual(final[key], [], row.name + ' ' + key);
    assert(Object.values(final.traversed).every(Boolean), 'every body exits: ' + row.name);
    if (final.mode === 'batch') assert(final.clearFrames.east < final.clearFrames.late && final.compatibleFrames > 30);
    if (final.mode === 'light') assert(final.lightWaitFrames > 30);
    if (final.mode === 'platoon') assert(final.clearFrames.east < final.clearFrames.follower);
}
const poses = JSON.parse(fs.readFileSync(path.join(dir, 'poses.json')));
assert.equal(poses.rows.length, 12); assert(poses.rows.every(row => row.pass)); assert.deepEqual(poses.errors, []);
console.log('PASS: nine native Traffic cases, complete fleet traversal, fairness/light/body controls, and 12 actual Game pose/reset cases.');
