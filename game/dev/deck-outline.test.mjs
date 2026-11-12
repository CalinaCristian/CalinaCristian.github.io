// The deck-outline rule: a guard line stands where no other surface takes its place, runs end exactly where two
// converging lines meet, near ends are welded and stray groups are found.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openRuns, weldEnds, strayPieces } from '../src/deck-outline.js';

test('a line with nothing on it is one whole run', () => {
    assert.deepEqual(openRuns([0, 0], [10, 0], () => false), [[0, 1]]);
    assert.deepEqual(openRuns([0, 0], [10, 0], () => true), []);
});

test('a run ends at the covered stretch, placed to 2 cm', () => {
    const runs = openRuns([0, 0], [20, 0], x => x > 7.3 && x < 12.6);
    assert.equal(runs.length, 2);
    assert.ok(Math.abs(runs[0][1] * 20 - 7.3) < .02, 'first run ends at 7.3, got ' + runs[0][1] * 20);
    assert.ok(Math.abs(runs[1][0] * 20 - 12.6) < .02, 'second run starts at 12.6, got ' + runs[1][0] * 20);
    assert.equal(runs[0][0], 0); assert.equal(runs[1][1], 1);
});

test('two guard lines of parting carriageways end at one nose', () => {
    // carriageway A along z = 0 (guard at z = 3.8), carriageway B leaving it at 10 degrees (guard on its far side)
    const c = Math.cos(10 * Math.PI / 180), s = Math.sin(10 * Math.PI / 180);
    const insideA = (x, z) => Math.abs(z) < 3.8 - .05, insideB = (x, z) => Math.abs(-x * s + z * c) < 3.8 - .05;
    const a = openRuns([0, 3.8], [80, 3.8], insideB), bLine = [[-3.8 * -s, 3.8 * c], [80 * c + 3.8 * s, 80 * s + 3.8 * c]];
    assert.equal(a.length, 1); assert.ok(a[0][0] === 0 || a[0][1] === 1);
    // B's inner guard (the side facing A): covered while it runs inside A's guard line
    const inner = openRuns([3.8 * s, -3.8 * c], [80 * c + 3.8 * s, 80 * s - 3.8 * c], insideA);
    assert.equal(inner.length, 1);
    const start = inner[0][0], px = 3.8 * s + (80 * c) * start, pz = -3.8 * c + 80 * s * start;
    assert.ok(Math.abs(pz - 3.75) < .03, 'B\'s inner guard starts where it leaves A\'s guard line, z = ' + pz);
    assert.ok(px > 0 && bLine.length === 2);
});

test('ends that nearly meet are welded: a corner at the crossing point, a seam at the middle', () => {
    const corner = [{ a: [0, 0], b: [9.8, 0], ya: 5, yb: 5 }, { a: [10, .3], b: [10, 8], ya: 5, yb: 5 }];
    assert.equal(weldEnds(corner), 1);
    assert.deepEqual(corner[0].b.map(v => +v.toFixed(6)), [10, 0]); assert.deepEqual(corner[1].a.map(v => +v.toFixed(6)), [10, 0]);
    const seam = [{ a: [0, 0], b: [5, 0], ya: 5, yb: 5 }, { a: [5.4, 0], b: [9, 0], ya: 5, yb: 5 }];
    assert.equal(weldEnds(seam), 1);
    assert.deepEqual(seam[0].b, [5.2, 0]); assert.deepEqual(seam[1].a, [5.2, 0]);
});

test('ends at different levels or too far apart stay as they are', () => {
    const levels = [{ a: [0, 0], b: [5, 0], ya: 5, yb: 5 }, { a: [5.2, 0], b: [9, 0], ya: 7, yb: 7 }];
    assert.equal(weldEnds(levels), 0);
    const far = [{ a: [0, 0], b: [5, 0], ya: 5, yb: 5 }, { a: [6, 0], b: [9, 0], ya: 5, yb: 5 }];
    assert.equal(weldEnds(far), 0); assert.deepEqual(far[0].b, [5, 0]);
});

test('a short group that joins nothing is stray; one joined to a long run is not', () => {
    const cage = [{ a: [0, 0], b: [2, 1] }, { a: [2, 1], b: [0, 2] }], long = { a: [20, 0], b: [60, 0] }, tail = { a: [60, 0], b: [61, 1] };
    const stray = strayPieces([...cage, long, tail], { minM: 8 });
    assert.deepEqual(stray, cage);
});
