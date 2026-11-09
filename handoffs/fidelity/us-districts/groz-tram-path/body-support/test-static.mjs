import assert from 'node:assert/strict';
import { fitTramBodySupport, validateTramSupportCertificate } from '../../../../../game/src/tram-body-support.js';
import { initialTrafficStaticClearance, previewInitialTrafficPose } from '../../../../../game/src/initial-traffic-admission.js';
import { makeVehicle } from '../../../../../game/src/vehicles.js';

const hash = text => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
function fixture() {
    const mesh = makeVehicle('tram-imperio', undefined, { city: 'bucharest', instanced: true });
    const v = { edge: { id: 'rail:w-fixture:0', rail: true }, dir: 1, s: 100, x: 0, y: .24, z: 0, heading: -Math.PI / 2, mesh, length: 36, width: 2.4, speed: 0 };
    const piece = { id: 'fixture:w-fixture:0:0:1', sourceId: 'w-fixture', modelId: 'fixture', a: [-100, 0], b: [100, 0], poly: [[-100, -2], [100, -2], [100, 2], [-100, 2]], top: [[-100, .2, -2], [100, .2, -2], [100, .2, 2], [-100, .2, 2]], band: () => ({ top: .2, bottom: -.2 }) };
    const supportAt = () => ({ top: .2, bottom: -.2 }); supportAt.inBox = () => [piece];
    const samplePath = (_v, off) => ({ x: off, z: 0, y: 0, edge: { grade: { modelId: 'fixture' } } });
    v.railSupport = fitTramBodySupport(v, { samplePath, supportAt, nativePitch: 0 });
    const own = { poly: piece.poly, roadDeck: true, railDeck: true, modelId: 'fixture', sourceId: 'w-fixture', supportPieceId: piece.id, y0: -.2, y1: .2, roofHeightAt: () => .2, minHeightAt: () => -.2 };
    return { v, piece, supportAt, samplePath, own, world: { buildings: [own], tramDeckSupportAt: supportAt } };
}
const controls = [], test = (name, fn) => { fn(); controls.push({ name, passed: true }); };
test('identified own slab independently clears actual emitted geometry', () => {
    const { v, world } = fixture(); assert.equal(initialTrafficStaticClearance(world, v).valid, true);
});
test('stationary exact geometry fit and revalidation cache preserve result identity', () => {
    const { v, supportAt, samplePath } = fixture();
    const a = v.railSupport, b = fitTramBodySupport(v, { samplePath, supportAt, nativePitch: 0 }); assert.equal(a, b);
    const x = validateTramSupportCertificate(v, supportAt), y = validateTramSupportCertificate(v, supportAt); assert.equal(x, y);
    v.speed = 1; assert.notEqual(fitTramBodySupport(v, { samplePath, supportAt, nativePitch: 0 }), b);
});
test('forged fresh assertions cannot conceal actual own-slab penetration', () => {
    const { v, world } = fixture(); v.y -= .1;
    // Reproduce the documented pose digest as an adversarial producer. The
    // independent triangle clearance must still reject the real penetration.
    v.railSupport = { ...v.railSupport, y: v.y, poseHash: hash([v.edge.id, v.dir, v.s, v.x, v.y, v.z, v.heading, 0, 0, 1, 1, 1].join('|')) };
    const r = initialTrafficStaticClearance(world, v); assert.equal(r.valid, false); assert.equal(r.hit.exactRailDeck.reason, 'actual-emitted-tram-own-slab-contact'); assert(r.hit.exactRailDeck.requiredLiftM > .05);
});
test('stale pose and altered model catalogue fail independently', () => {
    const { v, supportAt, piece } = fixture(); v.y += .1; assert.equal(validateTramSupportCertificate(v, supportAt).valid, false); v.y = .24;
    const changed = () => null; changed.inBox = () => [{ ...piece, top: piece.top.map(p => [p[0], p[1] + .01, p[2]]) }];
    assert.equal(validateTramSupportCertificate(v, changed).reason, 'stale-tram-support-piece-catalogue');
});
test('unidentified own support piece remains blocked', () => {
    const { v, world, own } = fixture(); delete own.supportPieceId; assert.equal(initialTrafficStaticClearance(world, v).valid, false);
});
test('true pantograph ceiling contact remains blocked', () => {
    const { v, world } = fixture(); world.buildings.push({ poly: [[-25, -3], [25, -3], [25, 3], [-25, 3]], y0: 5.5, y1: 6.5, roofHeightAt: () => 6.5, minHeightAt: () => 5.5, sourceId: 'w-real-ceiling' });
    const r = initialTrafficStaticClearance(world, v); assert.equal(r.valid, false); assert.equal(r.hit.sourceId, 'w-real-ceiling');
});
test('other modeled slab is not granted own-support clearance', () => {
    const { v, world, own } = fixture(); world.buildings = [{ ...own, modelId: 'other', supportPieceId: 'other:0', y0: .8, y1: 1.2, roofHeightAt: () => 1.2, minHeightAt: () => .8 }];
    assert.equal(initialTrafficStaticClearance(world, v).valid, false);
});
test('true post/body contacts and ordinary body behavior remain blocked', () => {
    const { v, world } = fixture(); world.buildings.push({ x: 0, z: 0, r: .5, hw: .5, hd: .5, angle: 0, y0: 0, y1: 3, prop: true, sourceId: 'w-post' });
    assert.equal(initialTrafficStaticClearance(world, v).valid, false); v.edge = { id: 7, rail: false }; assert.equal(initialTrafficStaticClearance(world, v).valid, false);
});
test('unsupported literal bogie span is unresolved', () => {
    const { v, supportAt, samplePath } = fixture(); const r = fitTramBodySupport(v, { samplePath: (v, off) => Math.abs(off) > 10 ? null : samplePath(v, off), supportAt, nativePitch: 0 });
    assert.equal(r.known, false); assert.equal(r.reason, 'unknown-actual-bogie-source-span');
});
test('isolated preview carries fresh source support certificate', () => {
    const { v } = fixture(); const T = { placeOnLane(candidate) { candidate.railSupport = { known: true, poseHash: 'fresh-preview' }; candidate.mesh.rotation.set(.1, candidate.heading, 0, 'YXZ'); } };
    const pose = previewInitialTrafficPose(T, v, v.s + 1); assert.equal(pose.railSupport.poseHash, 'fresh-preview'); assert.equal(v.railSupport.poseHash === 'fresh-preview', false); assert.equal(pose.pitch, .1);
});
console.log(JSON.stringify({ passed: true, controls, scope: 'Actual emitted rigid mesh certificate/admission controls. Synthetic slabs/ceiling/post fixtures; no full native-world acceptance.' }, null, 2));
