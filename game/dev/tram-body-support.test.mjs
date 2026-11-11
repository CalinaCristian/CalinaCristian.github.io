// node --test game/dev/tram-body-support.test.mjs
// The CPU reduction in tram-body-support.js (cached per-piece catalogue, allocation-free bounds, one comparison for a
// triangle above every slab top) must not change a single result. The oracle is the module as it stood before the
// change (fixtures/tram-body-support-reference.mjs). Synthetic slabs and meshes: this establishes equality of the
// support mathematics only; the playable tram ride is measured in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as live from '../src/tram-body-support.js';
import * as reference from './fixtures/tram-body-support-reference.mjs';

// Mulberry32: fixed inputs on every run
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** A straight rail slab along +x, 3 m wide, in `count` quads; its top follows one quadratic of x (what the renderer splits at). */
function slab({ x0 = 0, count = 8, step = 5, z0 = -1.5, z1 = 1.5, height = x => .02 * x, modelId = 'm', regions = false } = {}) {
    return Array.from({ length: count }, (_, i) => {
        const a = x0 + i * step, b = a + step, band = (x, z) => ({ top: height(x), bottom: height(x) - .5 });
        const piece = { id: `${modelId}:${i}`, sourceId: 'w' + i, modelId, a: [a, 0], b: [b, 0], poly: [[a, z0], [b, z0], [b, z1], [a, z1]],
            top: [[a, height(a), z0], [b, height(b), z0], [b, height(b), z1], [a, height(a), z1]], band, topProfile: null };
        if (regions && i % 2) {
            const mid = (a + b) / 2, raised = (x, z) => ({ top: height(x) + .03, bottom: height(x) - .5 });
            piece.regions = [{ poly: [[a, z0], [mid, z0], [mid, z1], [a, z1]], band, maxTop: Math.max(height(a), height(mid)) },
                { poly: [[mid, z0], [b, z0], [b, z1], [mid, z1]], band: raised, maxTop: Math.max(height(mid), height(b)) + .03 }];
        }
        return piece;
    });
}
/** A closed box mesh plus loose triangles (an under-floor detail), in world coordinates. */
function body({ x = 12, y = 1, z = 0, length = 14, width = 2.4, height = 3, pitch = 0, random = rng(7), loose = 24 } = {}) {
    const points = [], indices = [];
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) points.push([sx * length / 2, sy * height, sz * width / 2]);
    for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    for (let i = 0; i < loose; i++) { const at = points.length; for (let k = 0; k < 3; k++) points.push([(random() - .5) * length, random() * .4 - .1, (random() - .5) * width * 1.4]); indices.push(at, at + 1, at + 2); }
    const c = Math.cos(pitch), s = Math.sin(pitch);
    return { points: points.map(p => [x + c * p[0] - s * p[1], y + s * p[0] + c * p[1], z + p[2]]), indices };
}

test('minimum support lift equals the reference: clear above, grazing, penetrating, pitched, beside and beyond the slab', () => {
    const cases = [];
    for (const regions of [false, true]) for (const height of [x => .02 * x, x => .5 + .0015 * (x - 20) ** 2 * (x < 20 ? 1 : 0), () => .3]) {
        const pieces = slab({ regions, height });
        for (const y of [3, .9, .42, .35, .2, -.4]) for (const pitch of [0, .03, -.05]) for (const [x, z] of [[12, 0], [3, .9], [38, -1.2], [70, 0], [12, 6]])
            cases.push({ pieces, mesh: body({ x, y, z, pitch, random: rng(cases.length + 1) }) });
    }
    let contact = 0, clear = 0;
    for (const { pieces, mesh } of cases) {
        const expected = reference.minimumTramSupportLift(mesh.points, mesh.indices, pieces), actual = live.minimumTramSupportLift(mesh.points, mesh.indices, pieces);
        assert.deepEqual(actual, expected);
        // second call: served from the per-piece cache
        assert.deepEqual(live.minimumTramSupportLift(mesh.points, mesh.indices, pieces), expected);
        if (expected.testedEdges) contact++; else clear++;
    }
    assert.ok(contact > 100 && clear > 100, `both paths exercised: ${contact} with tested edges, ${clear} without`);
});

test('an empty catalogue and a non-finite slab top take the reference path', () => {
    const mesh = body();
    assert.deepEqual(live.minimumTramSupportLift(mesh.points, mesh.indices, []), reference.minimumTramSupportLift(mesh.points, mesh.indices, []));
    const pieces = slab(); pieces[2].top = pieces[2].top.map((p, i) => i ? p : [p[0], NaN, p[2]]);
    assert.deepEqual(live.minimumTramSupportLift(mesh.points, mesh.indices, pieces), reference.minimumTramSupportLift(mesh.points, mesh.indices, pieces));
});

test('a piece whose top, band or regions are replaced is derived again', () => {
    const mesh = body({ y: .3 }), pieces = slab();
    const before = live.minimumTramSupportLift(mesh.points, mesh.indices, pieces);
    const raised = x => .02 * x + .4;
    for (const p of pieces) { p.top = p.top.map(q => [q[0], raised(q[0]), q[2]]); p.band = (x, z) => ({ top: raised(x), bottom: raised(x) - .5 }); }
    const after = live.minimumTramSupportLift(mesh.points, mesh.indices, pieces);
    assert.deepEqual(after, reference.minimumTramSupportLift(mesh.points, mesh.indices, pieces));
    assert.ok(Math.abs(after.liftM - before.liftM - .4) < 1e-9, `${before.liftM} -> ${after.liftM}`);
    pieces[3].regions = [{ poly: pieces[3].poly, band: (x, z) => ({ top: raised(x) + .2, bottom: 0 }), maxTop: raised(pieces[3].b[0]) + .2 }];
    assert.deepEqual(live.minimumTramSupportLift(mesh.points, mesh.indices, pieces), reference.minimumTramSupportLift(mesh.points, mesh.indices, pieces));
});

test('fitted pose and its certificate equal the reference for a tram on a graded slab', () => {
    const height = x => .5 + .03 * x, pieces = slab({ count: 12, height });
    // model space: length along z with the front at -z, wheel-support plane y = 0, under-floor detail above it
    const local = { points: [], indices: [] }, random = rng(11);
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) local.points.push([sx * 1.2, sy * 3, sz * 7]);
    for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) local.indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    for (let i = 0; i < 12; i++) { const at = local.points.length; for (let k = 0; k < 3; k++) local.points.push([(random() - .5) * 2.4, .05 + random() * .4, (random() - .5) * 14]); local.indices.push(at, at + 1, at + 2); }
    const geo = () => ({ attributes: { position: { count: local.points.length, version: 0, getX: i => local.points[i][0], getY: i => local.points[i][1], getZ: i => local.points[i][2] } }, index: { array: Uint32Array.from(local.indices), version: 0 } });
    const supportAt = { inBox: (x0, z0, x1, z1, { modelId } = {}) => pieces.filter(p => p.modelId === modelId && p.b[0] >= x0 && p.a[0] <= x1 && 1.5 >= z0 && -1.5 <= z1) };
    // travelling along +x: heading −π/2 puts the model's −z (its front) toward +x
    const samplePath = (v, ahead = 0) => { const x = v.x + ahead; return { x, y: height(x) - .2, z: 0, edge: { grade: { modelId: 'm' } } }; };
    for (const [x, speed] of [[20, 3], [31.25, 0], [44, 1.2]]) {
        const make = () => ({ x, z: 0, s: x, dir: 1, speed, length: 14, heading: -Math.PI / 2, edge: { id: 5, rail: true }, mesh: { scale: { x: 1, y: 1, z: 1 }, userData: { _model: { geo: geo() } } } });
        const a = make(), b = make(), pitch = Math.atan(.03);
        const expected = reference.fitTramBodySupport(a, { samplePath, supportAt, nativePitch: pitch }), actual = live.fitTramBodySupport(b, { samplePath, supportAt, nativePitch: pitch });
        assert.equal(expected.known, true, expected.reason); assert.ok(expected.pieceCount > 0);
        assert.deepEqual(actual, expected);
        for (const [v, fit] of [[a, expected], [b, actual]]) { v.railSupport = fit; v.y = fit.y; v.pitch = fit.pitch; v.roll = 0; }
        const certified = reference.validateTramSupportCertificate(a, supportAt);
        assert.deepEqual(live.validateTramSupportCertificate(b, supportAt), certified);
        assert.equal(certified.valid, true, certified.reason);
    }
});
