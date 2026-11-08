import assert from 'node:assert/strict';
import { chapterWaypointReached } from '../../src/chapter-waypoint.js';

// Actual SeaTac projected objective and the unrelated 154 m manual-arrival probe.
const objective = { x: -1149.644183850554, z: -444.5535381487944, waypoint: true };
const game = { ch: { waypoint: true }, objective, chapterDone: false, navManual: false };
const manualArrival = { x: -1091.7484258047868, z: 877.7621581784335 };
const oldManualResult = { destination: { ...manualArrival }, manual: true, info: { arrived: true, remaining: 14 } };
assert.ok(Math.hypot(objective.x - manualArrival.x, objective.z - manualArrival.z) > 1300);
assert.equal(chapterWaypointReached(game, manualArrival, oldManualResult), false, 'clearing manual navigation cannot reuse its short remaining distance for the chapter');
assert.equal(chapterWaypointReached(game, manualArrival, { ...oldManualResult, manual: false }), false, 'an unrelated destination never completes the chapter even when marked automatic');
assert.equal(chapterWaypointReached(game, manualArrival, { destination: objective, manual: false, info: { remaining: 1800 } }), false, 'restored story route still requires arrival');
assert.equal(chapterWaypointReached(game, { x: objective.x + 20, z: objective.z }, null), true, 'actual waypoint proximity completes without a route');
assert.equal(chapterWaypointReached(game, manualArrival, { destination: objective, manual: false, info: { remaining: 14 } }), true, 'verified story destination permits the existing legal road endpoint arrival');
assert.equal(chapterWaypointReached({ ...game, freeRoam: {} }, objective), false, 'free roam does not complete a chapter');
assert.equal(chapterWaypointReached({ ...game, chapterDone: true }, objective), false, 'completed chapters stay completed');
assert.equal(chapterWaypointReached({ ...game, ch: { stop: 'uipath-bel' } }, objective), false, 'office chapters retain their office interaction');
assert.equal(chapterWaypointReached({ ...game, objective: { ...objective, waypoint: false } }, objective), false);
console.log('SeaTac manual arrival, actual waypoint, verified route, free roam and chapter guards: 9 passed');
