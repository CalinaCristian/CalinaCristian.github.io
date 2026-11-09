'use strict';
// Observer assertions only. Native source/constructor production owns the count.
function accountNativeCohort(population, cohort) {
    const actors = cohort.constructor?.actors || [], state = cohort.state || {};
    const moving = actors.filter(v => v.cls === 'moving').length;
    const parked = actors.filter(v => v.parked).length;
    const capParticipants = actors.filter(v => !v.parked && !v.tram).length;
    const checks = {
        highNativeCap: state.maxVehicles === 480,
        nativeConstructorWithinCap: capParticipants > 0 && capParticipants <= 480,
        originalBaseCounts: state.base?.moving === moving && state.base?.parked === parked,
        nativeRushProfile: state.profile?.density === 1.6 && state.profile?.parked === 1 && state.profile?.band === 'rush' && state.profile?.hour === 8.5,
        nativeRushTarget: state.jamExtra === 140 && state.jamBuilt === 140 && state.target?.moving === moving + 140 && state.target?.parked === parked && state.counts?.moving === state.target?.moving && state.counts?.parked === state.target?.parked,
        originalConstructorAndRushTotal: cohort.registrationCount === actors.length + state.jamBuilt,
        everyOriginalObjectAndId: cohort.registrationCount === cohort.registeredObjectCount && cohort.registrationCount === cohort.registeredIdCount && cohort.allOriginalSpawnObjectsPresent && cohort.allCurrentObjectsOriginallySpawned && cohort.constructorObjectsPresent && cohort.allIdsUnique && cohort.originalBirthIdsUnchanged === true,
        exactPublicCohort: cohort.registrationCount === population.combinedVehicleIds.length && new Set(population.combinedVehicleIds).size === cohort.registrationCount && population.activeVehicles === cohort.registrationCount,
        noHiddenOrPooledActors: population.poolVehicles === 0 && Array.isArray(cohort.hiddenActiveIds) && cohort.hiddenActiveIds.length === 0 && Array.isArray(cohort.inactiveActiveIds) && cohort.inactiveActiveIds.length === 0,
        fullNativePedestrians: population.people === 560 && cohort.pedestrianCount === 560 && cohort.pedestrianCrowdCount === 560 && population.pedestrianIds.length === 560 && new Set(population.pedestrianIds).size === 560,
    };
    return { passed: Object.values(checks).every(Boolean), checks, maxVehicles: state.maxVehicles, constructorCapParticipants: capParticipants, constructorTotal: actors.length, jamBuilt: state.jamBuilt, originalSpawnCalls: cohort.registrationCount, actualNativeTotal: population.combinedVehicleIds.length, active: population.activeVehicles, pool: population.poolVehicles, people: population.people,
        scope: 'High/native rush source-derived cohort conservation. 480 is the native constructor cap, not a minimum. Preserve every original constructor object and all140 original native rush spawns; total follows observed original native calls, not historic624. No quality, population, RNG, visibility or placement edits.' };
}
module.exports = { accountNativeCohort };
