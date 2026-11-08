#!/usr/bin/env node
// Building/courtyard collision behavior, independent of rendering or network.
import assert from 'node:assert/strict';
import { collideBuildings } from '../../src/world.js';

const building = {
    x: 0, z: 0, r: 20, hw: 10, hd: 10, angle: 0, h: 12,
    poly: [[-10, -10], [10, -10], [10, 10], [-10, 10]],
    holes: [[[-4, -4], [4, -4], [4, 4], [-4, 4]]],
};
const hit = (x, z) => collideBuildings([building], x, z, 0.35);
assert.equal(hit(0, 0), null, 'the courtyard centre is open');
assert.equal(hit(3, 0), null, 'a body clear of courtyard walls is free');
assert.ok(hit(5, 0), 'the building wing remains solid');
assert.ok(hit(3.9, 0).px < 0, 'inner wall pushes a nearby body back into the courtyard');
assert.ok(hit(4.1, 0).px < 0, 'the closest escape from the wing can be into the courtyard');
assert.ok(hit(10.1, 0).px > 0, 'outer wall pushes away from the building');
assert.equal(hit(11, 0), null, 'space beyond the outer wall is open');
assert.ok(collideBuildings([{ ...building, holes: [] }], 0, 0, 0.35), 'legacy footprints remain solid');
building.holes.push([[-8, -2], [-6, -2], [-6, 2], [-8, 2]]);
assert.equal(hit(-7, 0), null, 'each mapped courtyard is open, not only the first one');
console.log('9 courtyard collision checks passed');
