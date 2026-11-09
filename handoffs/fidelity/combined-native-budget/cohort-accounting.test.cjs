'use strict';
const assert = require('node:assert/strict');
const { accountNativeCohort } = require('./cohort-accounting.cjs');
function native(moving, parked) {
    const actors = [...Array.from({ length: moving }, () => ({ cls: 'moving' })), ...Array.from({ length: 2 }, () => ({ cls: 'fixed' })), ...Array.from({ length: parked }, () => ({ cls: 'parked', parked: true }))];
    const total = actors.length + 140;
    return { population: { activeVehicles: total, poolVehicles: 0, people: 560, combinedVehicleIds: Array.from({ length: total }, (_, i) => i), pedestrianIds: Array.from({ length: 560 }, (_, i) => i) }, cohort: { constructor: { actors }, state: { maxVehicles: 480, base: { moving, parked }, profile: { density: 1.6, parked: 1, band: 'rush', hour: 8.5 }, target: { moving: moving + 140, parked }, counts: { moving: moving + 140, parked }, jamExtra: 140, jamBuilt: 140 }, registrationCount: total, registeredObjectCount: total, registeredIdCount: total, allOriginalSpawnObjectsPresent: true, allCurrentObjectsOriginallySpawned: true, constructorObjectsPresent: true, allIdsUnique: true, originalBirthIdsUnchanged: true, hiddenActiveIds: [], inactiveActiveIds: [], pedestrianCount: 560, pedestrianCrowdCount: 560 } };
}
const high54 = native(477, 3), historic = native(478, 4);
assert.equal(accountNativeCohort(high54.population, high54.cohort).passed, true);
assert.equal(accountNativeCohort(high54.population, high54.cohort).actualNativeTotal, 622);
assert.equal(accountNativeCohort(historic.population, historic.cohort).actualNativeTotal, 624);
assert.equal(accountNativeCohort(historic.population, historic.cohort).passed, true);
const mutations = [
    x => x.cohort.state.maxVehicles = 170,
    x => x.cohort.state.base.moving--,
    x => x.cohort.state.profile.density = 1,
    x => x.cohort.state.jamBuilt--,
    x => x.cohort.allOriginalSpawnObjectsPresent = false,
    x => x.cohort.originalBirthIdsUnchanged = false,
    x => x.population.combinedVehicleIds[0] = 1,
    x => x.population.poolVehicles = 1,
    x => x.cohort.hiddenActiveIds.push(2),
    x => x.cohort.inactiveActiveIds.push(2),
    x => x.cohort.pedestrianCrowdCount = 180,
    x => x.population.pedestrianIds[0] = 1,
];
for (const mutate of mutations) { const x = native(477, 3); mutate(x); assert.equal(accountNativeCohort(x.population, x.cohort).passed, false); }
console.log(JSON.stringify({ passed: true, controls: 14, scope: 'Synthetic observer conservation controls: native cap versus minimum, historic/current native totals, lower settings, missed spawns, hidden/pool/object/ID/pedestrian failures. Does not change or certify production admission.' }));
