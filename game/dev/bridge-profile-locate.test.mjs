// node --test game/dev/bridge-profile-locate.test.mjs
// sourceFrames().locate is asked for every height on the shared bridge profile. It now looks only at the cells of one grid
// square instead of all of them; this compares it with the plain scan over every cell, point by point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFrames } from '../src/bridge-profile-geometry.js';

const EPS = 1e-7, cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const bary = (p, poly) => { const [a, b, c] = poly, v = [b[0] - a[0], b[1] - a[1]], w = [c[0] - a[0], c[1] - a[1]], r = [p[0] - a[0], p[1] - a[1]], den = cross(v, w); if (Math.abs(den) < 1e-12) return null; const u = cross(r, w) / den, vv = cross(v, r) / den; return [1 - u - vv, u, vv]; };
function scanAll(frames, point) {
    const hits = [];
    for (const cell of frames.cells) { const q = bary(point, cell.poly); if (!q || q.some(v => v < -EPS || v > 1 + EPS)) continue; const s = q.reduce((sum, v, i) => sum + v * cell.stations[i], 0), segment = cell.segment, t = (s - frames.cumulative[segment]) / (frames.cumulative[segment + 1] - frames.cumulative[segment]); if (!hits.some(h => Math.abs(h.s - s) < 1e-5)) hits.push({ s, segment, t }); }
    return hits.length === 1 ? hits[0] : null;
}
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

test('locate equals a scan over every cell: inside, on shared boundaries, on vertices and outside', () => {
    const lines = [
        [[0, 0], [40, 0], [90, 12], [150, 40], [210, 44], [300, 10]],
        [[-520.5, 811.25], [-498.2, 790.1], [-470, 772.3], [-431.9, 760], [-400, 761.5]],
        [[5, 5], [5, 60], [9, 130]],
    ];
    let located = 0, outside = 0;
    for (const [k, points] of lines.entries()) for (const half of [6, 25]) {
        const frames = sourceFrames(points, half), random = rng(k * 7 + half);
        assert.ok(frames, 'frames');
        const xs = points.map(p => p[0]), zs = points.map(p => p[1]), x0 = Math.min(...xs) - half - 8, x1 = Math.max(...xs) + half + 8, z0 = Math.min(...zs) - half - 8, z1 = Math.max(...zs) + half + 8;
        const probes = [];
        for (let i = 0; i < 6000; i++) probes.push([x0 + random() * (x1 - x0), z0 + random() * (z1 - z0)]);
        for (const cell of frames.cells) { probes.push(...cell.poly.map(p => [p[0], p[1]])); for (let i = 0; i < 3; i++) { const a = cell.poly[i], b = cell.poly[(i + 1) % 3]; for (const t of [.25, .5, .75]) probes.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
        for (let gx = Math.floor(x0 / 12) * 12; gx <= x1; gx += 12) for (let z = z0; z <= z1; z += 3.7) probes.push([gx, z], [gx - 1e-9, z], [z0 + (z - z0), gx]); // grid lines themselves
        for (const p of probes) { const expected = scanAll(frames, p); assert.deepEqual(frames.locate(p), expected, JSON.stringify(p)); if (expected) located++; else outside++; }
    }
    assert.ok(located > 5000 && outside > 5000, `${located} located, ${outside} not`);
});
