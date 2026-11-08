import assert from 'node:assert/strict';
import { sourceTreeCentrePolicy, treeCentreDuplicate, treeCentreWater } from '../../src/source-tree-centres.js';

const water = (x, z) => x >= 0 && x <= 10 && z >= 0 && z <= 20;
const buffered = (x, z, m) => water(x, z) || water(x + m, z) || water(x - m, z) || water(x, z + m) || water(x, z - m);
const source = sourceTreeCentrePolicy('osm', { policy: 'all-measured' });
const legacy = sourceTreeCentrePolicy('osm', undefined);
assert.equal(source, true);
assert.equal(sourceTreeCentrePolicy('street', { policy: 'all-measured' }), false);
// A real bank-side centre remains dry, even though the old 2m planting setback touches water.
assert.equal(treeCentreWater(11, 8, source, water, buffered), false);
assert.equal(treeCentreWater(11, 8, legacy, water, buffered), true);
assert.equal(treeCentreWater(9, 8, source, water, buffered), true, 'a centre actually in mapped water still rejects');
// Distinct source centres can occupy one coarse planting cell. Exact duplicates still reject.
const coarse = new Set(['1,1']), exact = new Set(['1,1']);
assert.equal(treeCentreDuplicate(1.4, 1.4, source, coarse, exact), false);
assert.equal(treeCentreDuplicate(1.4, 1.4, legacy, coarse, exact), true);
assert.equal(treeCentreDuplicate(1, 1, source, coarse, exact), true);
assert.equal(sourceTreeCentrePolicy('osm', { policy: 'legacy-ring-thinning' }), false, 'legacy input policy remains unchanged');
console.log('Source-bank, coarse-cell, exact-water, exact-duplicate and legacy controls passed.');
