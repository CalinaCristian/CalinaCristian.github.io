import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceSnapshot } from './source-snapshot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const actual = sourceSnapshot(root);
const unique = (items, label) => assert.equal(new Set(items).size, items.length, `duplicate ${label}`);

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.snapshot.baseCommit, '7349ab481f87acefb59ff9d260d671e0aacb0907');
assert.deepEqual(manifest.snapshot.registryHashes, actual.hashes, 'registry source changed: inventory snapshot needs review/refresh');
for (const kind of ['districts', 'landmarks', 'spots', 'scenes']) {
    const id = (item) => kind === 'districts' ? `${item.city}/${item.id}` : item.id;
    const rows = manifest[kind];
    unique(rows.map(id), `${kind} ID`);
    assert.deepEqual(rows.map(id), actual[kind].map(id), `${kind} coverage or order differs`);
    for (let i = 0; i < rows.length; i++) {
        for (const key of Object.keys(actual[kind][i])) assert.deepEqual(rows[i][key], actual[kind][i][key], `${kind}/${id(rows[i])}.${key}`);
        assert.ok(rows[i].task && rows[i].checks && rows[i].currentGoalChecks === 'pending', `missing honest check record for ${kind}/${id(rows[i])}`);
        assert.notEqual(rows[i].status, 'done');
        assert.ok(rows[i].sourceEvidence.every((key) => manifest.evidence[key]), 'unknown source evidence');
        assert.ok(rows[i].reviewEvidence.every((key) => manifest.evidence[key]), 'unknown review evidence');
    }
}
const counts = manifest.snapshot.counts;
assert.equal(counts.districts, actual.districts.length);
assert.equal(counts.landmarks, actual.landmarks.length);
assert.equal(counts.landmarkBuilderFunctions, new Set(actual.landmarks.map((lm) => lm.sourceFunction)).size);
assert.equal(counts.touristSpots, actual.spots.length);
assert.equal(counts.sharedScenes, actual.scenes.length);
assert.equal(counts.registryReadySpots, actual.spots.filter((spot) => spot.ready).length);
assert.equal(counts.devSpots, actual.spots.filter((spot) => spot.registry === 'DEV_SPOTS').length);
unique(manifest.tasks.map((task) => task.id), 'task ID');
unique(manifest.tasks.map((task) => task.branch), 'proposed branch');
unique(manifest.tasks.map((task) => task.worktree), 'proposed worktree');
const tasks = new Map([...manifest.tasks, ...manifest.reservedTasks].map((task) => [task.id, task]));
for (const kind of ['districts', 'landmarks', 'spots', 'scenes']) {
    for (const row of manifest[kind]) assert.ok(tasks.has(row.task), `unassigned ${kind}/${row.id}`);
}
const visit = (id, chain = []) => {
    assert.ok(tasks.has(id), `missing dependency ${id}`);
    assert.ok(!chain.includes(id), `dependency cycle: ${[...chain, id].join(' -> ')}`);
    for (const dep of tasks.get(id).dependsOn || []) visit(dep, [...chain, id]);
};
for (const task of manifest.tasks) {
    visit(task.id);
    assert.ok(manifest.acceptanceProfiles[task.acceptanceProfile], `missing acceptance profile ${task.id}`);
    assert.equal(task.owner, null, `proposed task claims a live owner: ${task.id}`);
    assert.equal(task.checksStatus, 'not_run_for_proposed_task');
}
const functionOwners = new Map();
for (const lm of manifest.landmarks) {
    const owner = functionOwners.get(lm.sourceFunction);
    assert.ok(!owner || owner === lm.task, `shared function assigned twice: ${lm.sourceFunction}`);
    functionOwners.set(lm.sourceFunction, lm.task);
}
for (const scene of manifest.scenes) {
    assert.ok(fs.existsSync(path.join(root, scene.file)), `missing scene file ${scene.file}`);
    assert.equal(scene.members.length, manifest.spots.filter((spot) => spot.scene === scene.id).length);
    assert.ok(scene.members.every((id) => manifest.spots.find((spot) => spot.id === id).task === scene.task));
}
for (const profile of Object.values(manifest.acceptanceProfiles)) {
    for (const inherited of profile.extends || []) assert.ok(manifest.acceptanceProfiles[inherited]);
}
assert.equal(manifest.execution.maxWorkers, 6);
assert.equal(manifest.execution.integrationOwnerCount, 1);
for (const file of fs.readdirSync(here)) assert.ok(/\.(json|md|mjs)$/.test(file), `unexpected inventory artifact: ${file}`);
console.log(`Inventory verified: ${actual.districts.length} districts, ${actual.landmarks.length} landmarks (${functionOwners.size} builders), ${actual.spots.length} spots / ${actual.scenes.length} scenes; ${manifest.tasks.length} unique proposed tasks, ${manifest.reservedTasks.length} reservations; dependency graph and source hashes match.`);
