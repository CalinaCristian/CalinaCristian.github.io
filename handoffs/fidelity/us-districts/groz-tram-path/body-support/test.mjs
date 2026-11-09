import assert from 'node:assert/strict';
import { minimumTramSupportLift, fitTramBodySupport } from '../../../../../game/src/tram-body-support.js';
import { makeVehicle } from '../../../../../game/src/vehicles.js';

const pieces = (at, breaks = [-100, 100]) => breaks.slice(1).map((end, i) => {
    const start = breaks[i];
    return { id: 'fixture:' + start + ':' + end, a: [start, 0], b: [end, 0], poly: [[start, -2], [end, -2], [end, 2], [start, 2]], top: [[start, at(start), -2], [end, at(end), -2], [end, at(end), 2], [start, at(start), 2]], modelId: 'fixture', sourceId: 'w-fixture', band: (x, _z) => ({ top: at(Math.max(start, Math.min(end, x))) }) };
});
const result = [], test = (name, fn) => { fn(); result.push({ name, passed: true }); };
test('triangle interior crest cannot hide between emitted vertices', () => {
    const top = x => 1.2 - (x - 5) ** 2 / 25, p = [[0, .3, -.5], [10, .3, -.5], [0, .3, .5]];
    assert(p.every(v => top(v[0]) < v[1]));
    const fit = minimumTramSupportLift(p, [0, 1, 2], pieces(top, [0, 5, 10]));
    assert(fit.known); assert(Math.abs(fit.liftM - .9) < 1e-12);
});
test('unsupported nonquadratic support is explicit', () => {
    const fit = minimumTramSupportLift([[0, .1, -.5], [10, .1, -.5], [0, .1, .5]], [0, 1, 2], pieces(x => .2 + x ** 4 / 10000, [0, 10]));
    assert.equal(fit.known, false);
});
for (const kind of ['tram-v3a', 'tram-imperio']) for (const slope of [0, .04, -.04]) test(kind + ' flat/linear shared slab preserves native pose at slope ' + slope, () => {
    const mesh = makeVehicle(kind, undefined, { city: 'bucharest', instanced: true });
    const v = { mesh, heading: -Math.PI / 2, x: 0, z: 0, length: mesh.userData.length };
    const samplePath = (_v, off) => ({ x: off, z: 0, y: slope * off, edge: { grade: { modelId: 'fixture' } } });
    const supportAt = () => null; supportAt.inBox = () => pieces(x => .2 + slope * x);
    const fit = fitTramBodySupport(v, { samplePath, supportAt, nativePitch: Math.atan(slope) });
    assert(fit.known); assert.equal(fit.verticalOffsetM, 0); assert(Math.abs(fit.pitch - Math.atan(slope)) < 1e-14); assert.equal(fit.y, .24);
    assert(fit.actualSupport.vertices > 3000);
});
test('missing emitted geometry is unresolved, with no declared-height fallback', () => {
    const fit = fitTramBodySupport({ mesh: { userData: { height: 3.5 } } }, { samplePath: () => ({ y: 0 }), supportAt() {}, nativePitch: 0 });
    assert.equal(fit.known, false);
});
console.log(JSON.stringify({ passed: true, controls: result, browserOpened: false, scope: 'Exact synthetic geometry extrema and actual emitted 27/36 m flat/linear pose controls; no native-world acceptance.' }, null, 2));
