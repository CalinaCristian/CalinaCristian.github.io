// node --test game/dev/tram-pitched-clearance.test.mjs
// A pitched tram in the rail guard. The guard used one height range for the whole body, so a 36 m tram on an 8 % ramp
// read 1.4 m lower at its high end and 1.4 m higher at its low end than it is: a deck parapet 0.3 m clear of the roof
// below it stopped every tram on the Basarab ramp for good. Each cover disc now takes the actual height range of the
// stretch of the body it covers. Synthetic body and walls; the built district is audited by harness/tram-sweep-audit.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleVerticalInterval, vehicleVerticalIntervalAlong } from '../src/initial-vehicle-admission.js';
import { initialTrafficStaticClearance } from '../src/initial-traffic-admission.js';

// model space as the native trams: front at -z, floor at y = 0.01, roof at 3.4, a pantograph to 5.79 at 4.3 m ahead of centre
function tramGeometry(L = 36) {
    const points = [], indices = [], box = (x0, x1, y0, y1, z0, z1) => {
        const at = points.length; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) points.push([x, y, z]);
        for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) indices.push(at + q[0], at + q[1], at + q[2], at + q[0], at + q[2], at + q[3]);
    };
    box(-1.2, 1.2, .01, 3.4, -L / 2, L / 2); box(-.8, .8, 3.4, 5.79, -5.3, -3.3);
    return { points, attributes: { position: { count: points.length, version: 0, getX: i => points[i][0], getY: i => points[i][1], getZ: i => points[i][2] } }, index: { array: Uint32Array.from(indices), version: 0 } };
}
const tram = ({ x = 0, z = 0, y = 4, heading = -Math.PI / 2, pitch = 0, length = 36 } = {}) => ({ x, z, y, heading, pitch, roll: 0, length, width: 2.4, edge: { rail: true }, mesh: { scale: { x: 1, y: 1, z: 1 }, userData: { _model: { geo: tramGeometry(length) } } } });
const wall = (ax, az, bx, bz, y0, y1) => ({ wall: true, ax, az, bx, bz, y0a: y0, y1a: y1, y0b: y0, y1b: y1, nx: 0, nz: 1, kind: 'rail', x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: y1 - y0 });
const world = colliders => ({ buildings: Object.assign(colliders, { query: (x, z, r, cb) => { for (const c of colliders) if (Math.hypot(c.x - x, c.z - z) < r + c.r) cb(c); } }) });

test('the range of a stretch contains every vertex of that stretch and never leaves the whole-body range', () => {
    for (const pitch of [0, .03, -.05, Math.atan(.08), -Math.atan(.08)]) {
        const v = tram({ pitch }), whole = vehicleVerticalInterval(v), g = v.mesh.userData._model.geo;
        let lo = Infinity, hi = -Infinity;
        for (let along = -18; along < 18; along += 1) {
            const local = vehicleVerticalIntervalAlong(v, along, along + 1);
            assert.ok(local.known && local.min >= whole.min - .03 && local.max <= whole.max + .03, `${pitch} ${along} ${JSON.stringify(local)} in ${JSON.stringify(whole)}`);
            for (const p of g.points) if (-p[2] >= along && -p[2] <= along + 1) { const y = v.y + Math.cos(pitch) * p[1] - Math.sin(pitch) * p[2]; assert.ok(y >= local.min - 1e-9 && y <= local.max + 1e-9); }
            lo = Math.min(lo, local.min); hi = Math.max(hi, local.max);
        }
        assert.ok(lo <= whole.min + 1e-9 && hi >= whole.max - 1e-9, 'together the stretches cover the whole body');
    }
    const flat = tram(), roof = vehicleVerticalIntervalAlong(flat, -10, -9), panto = vehicleVerticalIntervalAlong(flat, 4, 4.6);
    assert.ok(Math.abs(roof.max - 7.4) < 1e-9 && Math.abs(panto.max - 9.79) < 1e-9 && Math.abs(roof.min - 4.01) < 1e-9);
    assert.equal(vehicleVerticalIntervalAlong({ ...tram(), roll: .01 }, 0, 1), null);
    assert.equal(vehicleVerticalIntervalAlong(flat, 40, 41).empty, true);
});

test('on a ramp the two ends no longer share one range', () => {
    const pitch = Math.atan(.08), v = tram({ pitch }), whole = vehicleVerticalInterval(v);
    const a = vehicleVerticalIntervalAlong(v, 17, 18), b = vehicleVerticalIntervalAlong(v, -18, -17), low = a.max < b.max ? a : b, high = a.max < b.max ? b : a;
    assert.ok(whole.max - whole.min > 5.78 + 1.6, 'whole body: more than 1.6 m beyond its own height (low end underside to the pantograph)');
    assert.ok(high.min - low.min > 2.5 && high.max - low.max > 2.5);
    assert.ok(low.max < whole.max - 2 && high.min > whole.min + 2.5);
});

test('guard: a parapet clear of the roof under it no longer stops a pitched tram; one in the roof still does', () => {
    // travelling +x, pitched; which end is high follows the model's own pitch sign
    const pitch = Math.atan(.08), v = tram({ pitch }), whole = vehicleVerticalInterval(v);
    const rear = vehicleVerticalIntervalAlong(v, -17.5, -16.5), front = vehicleVerticalIntervalAlong(v, 16.5, 17.5), lowAlong = rear.max < front.max ? -17 : 17, low = rear.max < front.max ? rear : front;
    const over = (along, y0) => world([wall(along, -3, along, 3, y0 + .3, y0 + 3)]); // (the guard takes 0.3 m below a wall's base)
    assert.ok(low.max + .3 < whole.max - 1.5);
    assert.equal(initialTrafficStaticClearance(over(lowAlong, low.max + .3), v).valid, true, 'clear of the low end by 0.3 m');
    assert.equal(initialTrafficStaticClearance(over(lowAlong, low.max - .3), v).valid, false, 'in the roof of the low end');
    assert.equal(initialTrafficStaticClearance(over(-lowAlong, low.max + .3), v).valid, false, 'the same height at the high end is in the body');
    // a level tram keeps the whole-body rule: the wall over the roof but under the raised pantograph height still refuses
    const level = tram();
    assert.equal(initialTrafficStaticClearance(over(-10, 8.5), level).valid, false);
    assert.equal(initialTrafficStaticClearance(over(-10, 10), level).valid, true);
});
