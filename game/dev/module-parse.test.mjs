// node --test game/dev/module-parse.test.mjs
// The game has no build step, and `node --check` on these files does not catch every syntax error (it parsed a broken
// shader string in landmarks.js as fine on 2026-11-11; the browser then failed to load the whole game). Importing the
// modules does. These carry long inline shader strings that are easy to break.
import test from 'node:test';
import assert from 'node:assert/strict';

for (const path of ['../src/facade-detail.js', '../src/landmarks.js', '../src/world.js', '../src/render.js', '../src/spots/index.js', '../src/spots/willow.js', '../src/spots/scenes/freddo-look.js', '../src/spots/scenes/cismigiu.js', '../src/spots/scenes/seattle-center.js'])
    test(`${path} parses and loads`, async () => { await assert.doesNotReject(import(path)); });

test('the facade detail shader routine is shared and well-formed', async () => {
    const { FACADE_DETAIL_GLSL, spotFacadeKind } = await import('../src/facade-detail.js');
    assert.match(FACADE_DETAIL_GLSL, /vec3 facadeDetail\(vec3 c, float kind/);
    assert.equal((FACADE_DETAIL_GLSL.match(/\{/g) || []).length, (FACADE_DETAIL_GLSL.match(/\}/g) || []).length);
    assert.equal(spotFacadeKind('bloc'), 3); assert.equal(spotFacadeKind('eclectic'), 0); assert.equal(spotFacadeKind('brick'), 4);
});
