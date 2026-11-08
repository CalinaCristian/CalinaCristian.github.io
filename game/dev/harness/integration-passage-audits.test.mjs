import test from 'node:test';
import assert from 'node:assert/strict';
import { solidFor, colliderDist, pointInCollider } from './page/util.js';

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const outer = rect(-5, -5, 5, 5), posts = [rect(-5, -5, -1, 5), rect(1, -5, 5, 5)];
const body = (y, bodyHeight = 2) => ({ surfY: y, bodyHeight, atLevel: () => false });
const building = (base = 0) => ({ poly: outer, minH: base, y0: base, y1: base + 8,
    passageSolids: [{ y0: base, y1: base + 3, polys: posts }, { y0: base + 3, y1: base + 8, polys: [outer] }] });

test('an opening stays clear while its posts and ceiling remain solid at the same source building', () => {
    const c = building();
    assert.equal(solidFor(body(.24), c, 0, 0), false);
    assert.equal(pointInCollider(c, 0, 0), false);
    assert.equal(colliderDist(c, 0, 0), 1);
    assert.equal(solidFor(body(.24), c, 3, 0), true);
    assert.equal(pointInCollider(c, 3, 0), true);
    assert(colliderDist(c, 3, 0) < 0);
    assert.equal(solidFor(body(.24, 3), c, 0, 0), true);
    assert.equal(solidFor(body(3.24), c, 0, 0), true);
    assert.equal(solidFor(body(.24), c, .5, 0, .6), true);
});

test('above-ground openings carry the body height without accepting an entire building', () => {
    const c = building(4);
    assert.equal(solidFor(body(.24), c, 3, 0), false);
    assert.equal(solidFor(body(4.24), c, 0, 0), false);
    assert.equal(pointInCollider(c, 0, 0, 0, 4.24), false);
    assert.equal(solidFor(body(4.24), c, 3, 0), true);
    assert.equal(pointInCollider(c, 3, 0, 0, 4.24), true);
    assert.equal(solidFor(body(7.24), c, 0, 0), true);
    assert.equal(solidFor(body(12.1), c, 3, 0), false);
});

test('actual roof height and source underside bound point and body checks', () => {
    const c = { poly: outer, minH: 4, y0: 4, y1: 9, roofHeightAt: () => 6 };
    assert.equal(solidFor(body(.24), c, 0, 0), false);
    assert.equal(solidFor(body(3), c, 0, 0), true);
    assert.equal(pointInCollider(c, 0, 0, 0, 5.9), true);
    assert.equal(pointInCollider(c, 0, 0, 0, 6.1), false);
    assert.equal(colliderDist(c, 0, 0, 6.1), Infinity);
});

test('courtyard holes retain their boundary distance and ordinary walls stay audited', () => {
    const c = { poly: outer, holes: [rect(-1, -1, 1, 1)], minH: 0, y1: 8 };
    assert.equal(pointInCollider(c, 0, 0), false);
    assert.equal(colliderDist(c, 0, 0), 1);
    assert.equal(pointInCollider(c, 3, 0), true);
    assert.equal(colliderDist(c, 3, 0), -2);
});
