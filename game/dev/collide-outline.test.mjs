// node --test game/dev/collide-outline.test.mjs
// collideOne on a large outline now reads a row index instead of walking every edge (and rejects far outlines by their
// bounding box). The oracle is the full walk as it was: inside test over all edges, nearest edge over all edges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { collideOne } from '../src/world.js';
import { pointInPolygon, distPointSeg } from '../src/util.js';

function fullWalk(b, x, z, radius) {
    const poly = b.poly, holes = b.holes || [], inside = pointInPolygon(x, z, poly) && !holes.some(h => pointInPolygon(x, z, h));
    let bd = Infinity, bnx = 0, bnz = 0;
    for (const boundary of [poly, ...holes]) for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const r = distPointSeg(x, z, boundary[j][0], boundary[j][1], boundary[i][0], boundary[i][1]);
        if (r.d < bd) { bd = r.d; if (r.d > 1e-5) { bnx = (x - r.cx) / r.d; bnz = (z - r.cz) / r.d; } else { bnx = 0; bnz = 0; } }
    }
    if (inside) return { nx: -bnx, nz: -bnz, pen: radius + bd };
    if (bd < radius) return { nx: bnx, nz: bnz, pen: radius - bd };
    return null;
}
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ring = (cx, cz, n, r0, r1, phase = 0, reverse = false) => { const pts = Array.from({ length: n }, (_, i) => { const a = phase + i / n * Math.PI * 2, r = i % 2 ? r1 : r0; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; }); return reverse ? pts.reverse() : pts; };
const body = (poly, holes) => ({ poly, holes, x: 0, z: 0, r: 400, h: 12, kind: 'landmark' });

test('a large outline with holes: the indexed result equals the full walk at every probe', () => {
    const shapes = [
        body(ring(-1189, 833, 408, 140, 96, .1), []),                                                    // a terminal-sized comb
        body(ring(40, -20, 164, 90, 82, .3), [ring(40, -20, 24, 20, 17, 0, true), ring(85, 5, 40, 9, 7, .2, true), ring(0, -60, 44, 12, 12, 0, true), ring(40, 40, 44, 6, 10, .5, true)]),
        body(ring(5, 5, 48, 30, 30), undefined),                                                        // just over the index threshold, no holes
        body(ring(-3, 7, 12, 14, 9), [ring(-3, 7, 6, 3, 3, 0, true)]),                                    // small: the plain walk
    ];
    let inside = 0, touching = 0, clear = 0;
    for (const [k, b] of shapes.entries()) {
        const random = rng(k + 3), xs = b.poly.map(p => p[0]), zs = b.poly.map(p => p[1]), x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, z0 = Math.min(...zs) - 6, z1 = Math.max(...zs) + 6, probes = [];
        for (let i = 0; i < 5000; i++) probes.push([x0 + random() * (x1 - x0), z0 + random() * (z1 - z0)]);
        for (const boundary of [b.poly, ...(b.holes || [])]) for (let i = 0; i < boundary.length; i++) { const p = boundary[i], q = boundary[(i + 1) % boundary.length]; probes.push([p[0], p[1]]); for (const t of [.3, .7]) for (const off of [-.4, -.05, .05, .4, 1.1]) { const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1; probes.push([p[0] + dx * t - dz / L * off, p[1] + dz * t + dx / L * off]); } }
        for (let z = Math.floor(z0 / 2) * 2; z <= z1; z += 2) probes.push([x0 + random() * (x1 - x0), z], [(x0 + x1) / 2, z + 1e-9], [(x0 + x1) / 2, z - 1e-9]); // row boundaries
        for (const radius of [.3, 1.2]) for (const [x, z] of probes) {
            const expected = fullWalk(b, x, z, radius), actual = collideOne(b, x, z, radius, .24);
            assert.deepEqual(actual, expected, `shape ${k} radius ${radius} at ${x}, ${z}`);
            if (!expected) clear++; else if (expected.pen > radius) inside++; else touching++;
        }
    }
    assert.ok(inside > 2000 && touching > 2000 && clear > 2000, `${inside} inside, ${touching} touching, ${clear} clear`);
});
