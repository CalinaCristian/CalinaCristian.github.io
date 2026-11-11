// node --test game/dev/source-context-consumers.test.mjs
// The Seattle source-context render cache (game/data/spots/seattle-context-render.bin.gz) records the SHA-256 of every
// script whose geometry it was built with; at load, source-context.js refuses the cache when one differs, and Pike Place
// and the Space Needle then fail with "Could not open the spot". The generator is not in this repository, so a change to
// one of those scripts breaks both spots until the cache is rebuilt. This test fails first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('game/data/spots/seattle-context-manifest.json', root), 'utf8'));

test('scripts hashed into the Seattle source-context cache are unchanged', () => {
    const hashes = manifest.nativeGeometryConsumerHashes;
    assert.ok(hashes && Object.keys(hashes).length >= 5);
    for (const [path, expected] of Object.entries(hashes)) {
        const actual = createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
        assert.equal(actual, expected, `${path} differs from the version the Seattle context cache was built with (Pike Place and the Space Needle would not open)`);
    }
});
