import assert from 'node:assert/strict';
import { Ground } from '../../src/spots/ground.js';

const flat = value => new Ground({ x0: -10, z0: -10, d: 20, nx: 2, nz: 2, h: [value, value, value, value] });
const water = flat(-5); water.waterY = 0;
assert.equal(water.groundAt(0, 0, 10), 60, 'the deep-water walker barrier remains');
for (let y = 0; y < 50000; y += 50.6) assert.equal(water.flightHeightAt(0, 0, y), 0, 'water support never feeds aircraft altitude back into itself');
water.addBox(0, 0, 2, 2, 0, 7, 8);
assert.equal(water.flightHeightAt(0, 0, 0), 0, 'an overhead deck is not a floor from below');
assert.equal(water.flightHeightAt(0, 0, 10), 8, 'a real deck remains physical support from above');
assert.equal(water.flightHeightAt(5, 5, 10), 0, 'the deck does not fill unrelated water');
const sculpture = flat(0);
sculpture.surfaces.push({ x: 0, z: 0, r: 2, bottom: 0, contains: () => true, top: () => 3, steepAt: () => true });
assert.equal(sculpture.groundAt(0, 0, 0), 50, 'steep-cell walking collision remains');
assert.equal(sculpture.flightHeightAt(0, 0, 0), 3, 'aircraft use the actual sculpture surface');
const dry = flat(-3);
assert.equal(dry.flightHeightAt(0, 0, 100), dry.groundAt(0, 0, 100), 'ordinary terrain retains its physical altitude');
console.log('Aircraft ground support retains water, real decks and steep surfaces without walker-sentinel altitude feedback.');
