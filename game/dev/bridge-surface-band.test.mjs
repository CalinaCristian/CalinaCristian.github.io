import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshBuilder } from '../src/geobuild.js';
import { displaceBridgeSurface } from '../src/bridge-surface-mesh.js';
import { displaceBandedSurface } from '../src/bridge-surface-band.js';

// an edge running north from (0, 0): lateral = x. A 12 m sidewalk strip from x = 3 to x = 6.3 (band limit 6.05):
// its outer 0.25 m lies outside the band, as the raised sidewalk's SIDE_BACK does in world.js.
const strip = () => {
    const mb = new MeshBuilder(false, 16), col = [150, 150, 140];
    for (let z = 0; z < 12; z += 4) {
        const a = mb.v(3, 0.37, -z, 0, 1, 0, 0, 0, col), b = mb.v(6.3, 0.37, -z, 0, 1, 0, 1, 0, col), c = mb.v(6.3, 0.37, -z - 4, 0, 1, 0, 1, 1, col), d = mb.v(3, 0.37, -z - 4, 0, 1, 0, 0, 1, col);
        mb.tri(a, b, c); mb.tri(a, c, d);
    }
    return mb;
};
const ramp = (x, z) => 0.05 * -z + 0.0004 * z * z; // a graded ramp with a vertical curve
const LIMIT = 6.05, band = { ax: 0, az: 0, nx: 1, nz: 0, limit: () => LIMIT, inside: ramp, outside: (x, z) => Math.min(0, ramp(x, z)) };
const tris = (mb) => { const out = []; for (let k = 0; k < mb.ic; k += 3) out.push([0, 1, 2].map(j => { const i = mb.i[k + j]; return [mb.p[i * 3], mb.p[i * 3 + 1], mb.p[i * 3 + 2]]; })); return out; };

test('the jumping rule alone drives the adaptive subdivision to its depth limit', () => {
    const mb = strip(), step = (x, z) => Math.abs(x) <= LIMIT ? ramp(x, z) : Math.min(0, ramp(x, z));
    const a = displaceBridgeSurface(mb, 0, 0, step, { maxDepth: 12 }); // (18 in the game: about 8 times more again)
    const b = displaceBandedSurface(strip(), 0, 0, band);
    assert.ok(a.depthLimit > 0 && a.outputTriangles > 500 && a.outputTriangles > 10 * b.outputTriangles, `${a.outputTriangles} triangles from 6 (cut on the line: ${b.outputTriangles})`);
});

test('cut on the band line: same surface, a few triangles, one vertical face for the jump', () => {
    const mb = strip(), a = displaceBandedSurface(mb, 0, 0, band);
    assert.equal(a.depthLimit, 0);
    assert.ok(a.outputTriangles < 400, `${a.outputTriangles} triangles`);
    assert.ok(a.maxLeafControlErrorM <= 0.002);
    let flat = 0, wall = 0;
    for (const t of tris(mb)) {
        const xs = t.map(p => p[0]), lo = Math.min(...xs), hi = Math.max(...xs);
        const area = Math.abs((t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[2][0] - t[0][0]) * (t[1][2] - t[0][2])) / 2;
        if (hi - lo < 1e-4) { // the step face: on the line, from the ground strip up to the ramp
            assert.ok(Math.abs(lo - LIMIT) < 1e-4); wall++;
            for (const p of t) assert.ok(p[1] > 0.37 - 1e-4 && p[1] < 0.37 + ramp(0, p[2]) + 1e-3);
            continue;
        }
        flat += area;
        assert.ok(hi <= LIMIT + 1e-4 || lo >= LIMIT - 1e-4, 'no triangle straddles the line');
        for (const p of t) { const want = 0.37 + (hi <= LIMIT + 1e-4 ? ramp(p[0], p[2]) : 0); assert.ok(Math.abs(p[1] - want) < 0.0021, `height ${p[1]} vs ${want}`); }
    }
    assert.ok(Math.abs(flat - 12 * 3.3) < 1e-3, 'the plan area is kept: ' + flat);
    assert.ok(wall >= 2 && wall === a.stepFaces);
});

test('a range that does not reach the line is displaced as before; earlier geometry is untouched', () => {
    const mb = new MeshBuilder(false, 16), col = [1, 2, 3];
    const k = [mb.v(100, 5, 100, 0, 1, 0, 0, 0, col), mb.v(101, 5, 100, 0, 1, 0, 0, 0, col), mb.v(100, 5, 101, 0, 1, 0, 0, 0, col)]; mb.tri(...k);
    const v0 = mb.vc, i0 = mb.ic;
    const a = mb.v(1, 0.2, 0, 0, 1, 0, 0, 0, col), b = mb.v(4, 0.2, 0, 0, 1, 0, 0, 0, col), c = mb.v(4, 0.2, -3, 0, 1, 0, 0, 0, col); mb.tri(a, b, c);
    const ref = new MeshBuilder(false, 16); ref.tri(ref.v(1, 0.2, 0, 0, 1, 0, 0, 0, col), ref.v(4, 0.2, 0, 0, 1, 0, 0, 0, col), ref.v(4, 0.2, -3, 0, 1, 0, 0, 0, col));
    const audit = { inputTriangles: 0, outputTriangles: 0, maxLeafControlErrorM: 0, depthLimit: 0, limitSamples: [], worstControl: null };
    const s = displaceBandedSurface(mb, v0, i0, band, audit, { edgeId: 7 }), r = displaceBridgeSurface(ref, 0, 0, ramp);
    assert.equal(s.cutTriangles, 0); assert.equal(s.stepFaces, 0);
    assert.equal(s.outputTriangles, r.outputTriangles);
    assert.deepEqual(Array.from(mb.p.subarray(v0 * 3, mb.vc * 3)), Array.from(ref.p.subarray(0, ref.vc * 3)));
    assert.deepEqual([mb.p[0], mb.p[1], mb.p[2]], [100, 5, 100]);
    assert.equal(audit.inputTriangles, 1); assert.equal(audit.outputTriangles, s.outputTriangles);
});
