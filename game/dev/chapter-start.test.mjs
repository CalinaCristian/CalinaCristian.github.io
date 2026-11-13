import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterStartPose } from '../src/chapter-start.js';

// world frame: x east, z south; an edge's dir is a → b, n its right-hand normal as the builder stores it
const edge = (id, ax, az, bx, bz, o = {}) => {
    const len = Math.hypot(bx - ax, bz - az), dirx = (bx - ax) / len, dirz = (bz - az) / len;
    return { id, a: { id: id * 2, x: ax, z: az }, b: { id: id * 2 + 1, x: bx, z: bz }, dirx, dirz, nx: -dirz, nz: dirx, len, drivable: true, oneway: false, median: 0, laneW: 3.5, name: 'Bulevardul Test', type: 'primary', ...o };
};

test('a start between two one-way carriageways takes the one that runs the declared way', () => {
    const south = edge(1, 0, 0, 0, 100, { oneway: true }), north = edge(2, 10, 100, 10, 0, { oneway: true });
    // 2 m from the southbound carriageway, 8 m from the northbound one, declared heading north (the Arnia start on Bd. Magheru)
    const p = chapterStartPose([south, north], { x: 2, z: 50 }, { heading: 0, road: /Test/ });
    assert.equal(p.edge, north);
    assert.equal(p.dir, 1);
    assert.ok(Math.abs(p.heading) < 1e-9, 'faces north (game heading 0)');
    assert.ok(Math.abs(p.z - 50) < 1e-9);
    // and south for a southbound chapter from the same point
    const q = chapterStartPose([south, north], { x: 8, z: 50 }, { heading: 180, road: /Test/ });
    assert.equal(q.edge, south);
    assert.ok(Math.abs(Math.abs(q.heading) - Math.PI) < 1e-9);
});

test('a two-way road is entered on the side of the declared heading, first lane beside the median', () => {
    const e = edge(3, 0, 100, 0, 0, { median: 2, laneW: 3 }); // a → b runs north
    const n = chapterStartPose([e], { x: 0, z: 40 }, { heading: 0, road: /Test/ }), s = chapterStartPose([e], { x: 0, z: 40 }, { heading: 180, road: /Test/ });
    assert.equal(n.dir, 1); assert.equal(s.dir, -1);
    assert.ok(Math.abs(n.heading) < 1e-9 && Math.abs(Math.abs(s.heading) - Math.PI) < 1e-9);
    assert.ok(Math.abs(Math.abs(n.x) - 2.5) < 1e-9 && Math.abs(n.x + s.x) < 1e-9, 'median / 2 + half a lane, mirrored for the other direction');
});

test('the named road wins over a nearer other road; the position stays off the junction ends', () => {
    const named = edge(4, 50, 100, 50, 0), other = edge(5, 0, 100, 0, 0, { name: 'Strada Alta' });
    const p = chapterStartPose([other, named], { x: 1, z: 99 }, { heading: 0, road: /Test/ });
    assert.equal(p.edge, named);
    assert.ok(Math.abs(p.t - 0.15) < 1e-9, 'clamped to 15 % of the edge');
    // nothing named within reach: any drivable edge
    assert.equal(chapterStartPose([other], { x: 1, z: 50 }, { heading: 0, road: /Test/ }).edge, other);
    assert.equal(chapterStartPose([], { x: 0, z: 0 }, { heading: 0 }), null);
});
