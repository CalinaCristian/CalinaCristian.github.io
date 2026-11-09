import assert from 'node:assert/strict';
import fs from 'node:fs';
import { perspectiveItems, perspectiveTitle } from '../../../game/overview/perspective-viewer.js';
const data = JSON.parse(fs.readFileSync(new URL('../../../game/overview/comparison-data/bellevue/street-walk/retakes/aabd17ad/manifest.json', import.meta.url)));
assert.equal(perspectiveItems(data.items).length, 3);
assert.equal(perspectiveItems(data.items).reduce((n, group) => n + group.requests.length, 0), 4);
assert.equal(perspectiveTitle(data.items[1]), '103rd Avenue Northeast · looking north');
for (const [key, value] of [['imageSha256', 'f'.repeat(64)], ['capturedAt', '2020-01-01'], ['gameSourceCommit', 'f'.repeat(40)]]) {
  const copy = structuredClone(data.items); copy[3][key] = value; assert.equal(perspectiveItems(copy).length, 4);
}
assert.equal(perspectiveItems([{ id: 'same', imageSha256: 'a' }, { id: 'same', imageSha256: 'b' }]).length, 2);
console.log(JSON.stringify({ passed: true, rawRequests: 4, displayedExactCaptures: 3, pixelDateSourceMismatchesRetained: true, unrelatedDuplicateIdsRetained: true, readableCompassCaption: true }, null, 2));
