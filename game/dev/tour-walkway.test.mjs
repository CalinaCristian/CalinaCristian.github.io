// The guide's route planner (spots/tour.js) across a narrow public walkway: a 2 m lock-gate deck between railings
// leaves a band about 1.3 m wide for a 0.34 m walker, which a 1.5 m search grid can step over (Ballard Locks,
// sea-spots-b-4). The planner must find the walkway and every leg of its route must stay on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findWalkPath, walkSegment, pathLength } from '../src/spots/tour.js';

// two 8 m landings joined by a walkway whose walkable band is BAND wide, turned by ANGLE (radians) off the grid
function scene(BAND, ANGLE) {
    const ux = Math.cos(ANGLE), uz = Math.sin(ANGLE), L = 34;
    const onDeck = (x, z) => {
        if (Math.abs(x) <= 4 && Math.abs(z) <= 4) return true;                     // west landing
        const ex = L * ux, ez = L * uz; if (Math.abs(x - ex) <= 4 && Math.abs(z - ez) <= 4) return true; // east landing
        const s = x * ux + z * uz, n = -x * uz + z * ux;
        return s >= 0 && s <= L && Math.abs(n) <= BAND / 2;                          // where a walker's centre may stand
    };
    const ground = { heightAt: () => -10, groundAt: (x, z) => (onDeck(x, z) ? 0 : NaN), waterY: null };
    // the goal stands in a corner of the east landing, so no straight line from the start stays on the deck
    return { ground, goal: [L * ux - 3.5 * uz, L * uz + 3.5 * ux] };
}

test('a narrow walkway off the grid axes is found (0.75 m fallback) and every leg stays on it', () => {
    const { ground, goal } = scene(1.3, 0.37);
    const coarse = findWalkPath(ground, [], 0, 0, goal[0], goal[1], { radius: 1, maxLength: 120, cell: 1.5 });
    const path = findWalkPath(ground, [], 0, 0, goal[0], goal[1], { radius: 1, maxLength: 120 });
    assert.ok(path, 'route found');
    assert.ok(pathLength(path) < 40, `short route (${pathLength(path).toFixed(1)} m)`);
    for (let i = 1; i < path.length; i++) assert.ok(walkSegment(ground, [], path[i - 1], path[i]), `leg ${i} walkable`);
    // documents why the fallback exists: the coarse grid alone does not see this walkway
    assert.equal(coarse, null);
});

test('no walkway: still no route, and no straight line is substituted', () => {
    const ground = { heightAt: () => -10, groundAt: (x, z) => (Math.abs(x) <= 4 && Math.abs(z) <= 4) || (Math.abs(x - 30) <= 4 && Math.abs(z) <= 4) ? 0 : NaN, waterY: null };
    assert.equal(findWalkPath(ground, [], 0, 0, 30, 0, { radius: 1, maxLength: 120 }), null);
});
