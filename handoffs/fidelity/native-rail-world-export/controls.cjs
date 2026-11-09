const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const THREE = require('../../../game/vendor/three.module.min.js'), factory = require('./geometry-kernel.cjs'), D = require('./decode-geometry.cjs');
const checks = [], test = (name, fn) => { fn(); checks.push({ name, pass: true }); console.log('PASS ' + name); };
const geo = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); return g; };
const identity = new THREE.Matrix4().toArray();
test('typed storage preserves exact native bytes including negative zero and nonfinite evidence', () => {
    const k = factory(), a = new Float32Array([-0, NaN, Infinity, -Infinity, .137]); const rec = k.typed(a), b = D.decodeTyped(rec);
    assert.deepEqual(Buffer.from(a.buffer), Buffer.from(b.buffer)); assert.ok(Object.is(b[0], -0));
});
test('nonindexed triangle uses full nonidentity parent world transform', () => {
    const k = factory(), parent = new THREE.Group(), mesh = new THREE.Mesh(geo()); parent.position.set(4, 5, 6); parent.rotation.y = .7; parent.scale.set(2, 3, 4); mesh.position.set(1, 2, 3); parent.add(mesh); parent.updateMatrixWorld(true);
    const record = k.mesh(mesh), scene = { geometries: k.geometries }, tri = [...D.triangles(D.meshParts(scene, record)[0])][0];
    for (let i = 0; i < 3; i++) { const p = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray(); for (let j = 0; j < 3; j++) assert.ok(Math.abs(tri.vertices[i][j] - p[j]) < 1e-12); }
    assert.equal(record.parentChain.length, 2);
});
test('indexed geometry keeps topology, groups and actual draw range separately from full buffer', () => {
    const k = factory(), g = geo(); g.setIndex([0, 1, 2, 2, 1, 0]); g.addGroup(0, 3, 0); g.addGroup(3, 3, 1); g.setDrawRange(3, 3);
    const id = k.geometry(g), part = D.geometryPart(k.geometries[id], identity); assert.equal([...D.triangles(part)].length, 2); const visible = [...D.triangles(part, { respectDrawRange: true })]; assert.equal(visible.length, 1); assert.equal(visible[0].triangle, 1); assert.equal(part.groups.length, 2);
});
test('interleaved native position offset and stride decode without repacking guesses', () => {
    const k = factory(), g = new THREE.BufferGeometry(), b = new THREE.InterleavedBuffer(new Float32Array([99, 0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0]), 4);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(b, 3, 1)); const id = k.geometry(g); assert.deepEqual([...D.triangles(D.geometryPart(k.geometries[id], identity))][0].vertices, [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
});
test('instances respect native active count and compose instance with parent world matrix', () => {
    const k = factory(), mesh = new THREE.InstancedMesh(geo(), new THREE.MeshBasicMaterial(), 4); mesh.count = 2; mesh.position.set(8, 0, 0);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 4, 0)); mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, 5)); mesh.updateMatrixWorld(true);
    const r = k.mesh(mesh), parts = D.meshParts({ geometries: k.geometries }, r); assert.equal(parts.length, 2); assert.deepEqual([...D.triangles(parts[0])][0].vertices[0], [8, 4, 0]); assert.deepEqual([...D.triangles(parts[1])][0].vertices[0], [8, 0, 5]);
});
test('changed geometry without a version bump creates a fresh immutable evidence record', () => {
    const k = factory(), g = geo(), first = k.geometry(g); k.nextEpoch(); assert.equal(k.geometry(g), first); g.attributes.position.array[0] = 7; k.nextEpoch(); const second = k.geometry(g); assert.notEqual(first, second);
    assert.equal(D.attribute(k.geometries[first].attributes.position).get(0)[0], 0); assert.equal(D.attribute(k.geometries[second].attributes.position).get(0)[0], 7);
});
test('pose changes preserve geometry identity while recording fresh matrices', () => {
    const k = factory(), mesh = new THREE.Mesh(geo()); mesh.updateMatrixWorld(true); const a = k.mesh(mesh); mesh.position.y = 9; mesh.updateMatrixWorld(true); k.nextEpoch(); const b = k.mesh(mesh);
    assert.equal(a.geometryId, b.geometryId); assert.equal(a.matrixWorld[13], 0); assert.equal(b.matrixWorld[13], 9);
});
test('malformed buffers, normalized position and half/skinned deformation stay explicit', () => {
    const k = factory(), g = geo(), id = k.geometry(g), r = k.geometries[id];
    assert.throws(() => D.decodeTyped({ ...r.attributes.position.array, byteLength: 1 }), /length mismatch/);
    assert.throws(() => D.geometryPart({ ...r, attributes: { position: { ...r.attributes.position, normalized: true } } }, identity), /Unsupported/);
    assert.throws(() => D.attribute({ ...r.attributes.position, isFloat16BufferAttribute: true }), /Float16/);
    assert.throws(() => D.meshParts({ geometries: k.geometries }, { geometryId: id, isSkinnedMesh: true }), /deformation audit/);
});
test('cycles, functions and unknown numeric metadata remain serialized evidence', () => {
    const k = factory(), a = { value: Infinity, missing: undefined, fn: x => x }; a.self = a; const r = k.safe(a); assert.deepEqual(r.value, { $number: 'Infinity' }); assert.deepEqual(r.self, { $ref: '$' }); assert.equal(typeof r.fn.$function, 'string'); assert.ok(JSON.stringify(r));
});
test('buffer integrity hashes exact bytes independently of producer certificate metadata', () => {
    const k = factory(), g = geo(); k.geometry(g); const records = D.integrity({ geometries: k.geometries }); assert.equal(records.length, 1);
    assert.equal(records[0].sha256, crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'));
});
test('deep native graph references stay explicit IDs instead of overflowing transport depth', () => {
    const k = factory(), nodes = Array.from({ length: 1200 }, (_, id) => ({ id, sourceId: id + 5000, x: id, z: 0, edges: [] }));
    const edges = nodes.slice(1).map((b, i) => { const e = { id: i, a: nodes[i], b, len: 1 }; e.a.edges.push(e); e.b.edges.push(e); return e; });
    const result = k.safe({ ends: [{ node: nodes[0], edge: edges[0] }] }); assert.equal(result.ends[0].node.$nativeNodeRef.id, 0); assert.equal(result.ends[0].edge.$nativeEdgeRef.id, 0); assert.ok(JSON.stringify(result).length < 1000);
});
test('safe local repeated polygon point resolves within the property root and preserves functions as metadata', () => {
    const k = factory(), first = [1, 2], polygon = [first, [4, 2], [3, 5], first], encoded = k.safe(polygon), decoded = D.rehydrateSafeLocal(encoded);
    assert.equal(encoded[3].$ref, '$.0'); assert.deepEqual(decoded, polygon); assert.strictEqual(decoded[0], decoded[3]);
    assert.deepEqual(D.rehydrateSafeLocal({ $function: 'closure is unavailable' }), { $function: 'closure is unavailable' });
});
test('unknown or ambiguous safe references fail explicitly without guessing a closure or graph', () => {
    assert.throws(() => D.rehydrateSafeLocal([{ $ref: '$.99' }]), /Unknown or ambiguous/);
    assert.throws(() => D.rehydrateSafeLocal({ 'a.b': [1], a: { b: [2] }, ref: { $ref: '$.a.b' } }), /Unknown or ambiguous/);
});
const report = { complete: true, controls: checks, browserLaunched: false, networkUsed: false, scope: 'Lossless native geometry encoding/independent decoding CPU controls. No regenerated-world or physical support acceptance.' };
if (process.argv[2]) { fs.mkdirSync(path.dirname(path.resolve(process.argv[2])), { recursive: true }); fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n'); }
console.log('PASS ' + checks.length + ' pure geometry controls; no browser/network');
