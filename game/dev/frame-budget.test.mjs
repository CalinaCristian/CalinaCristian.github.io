// frame-budget.js fills THREE.BatchedMesh's own geometry records by hand (zero-copy city context). This pins the vendored
// three.js layout it relies on, and checks the lossless material-group merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { batchedInternals, compactMaterialGroups } from '../src/spots/frame-budget.js';

test('vendored BatchedMesh has the r170 record layout batchSourceContext writes', () => {
    assert.equal(THREE.REVISION, '170', 'three.js was updated: re-check batchSourceContext() against the new BatchedMesh, then this test');
    assert.equal(batchedInternals(), true);
});

test('compactMaterialGroups merges groups that share a material without losing indices', () => {
    const g = new THREE.BoxGeometry(1, 1, 1), before = [...g.index.array].sort((a, b) => a - b);
    const side = new THREE.MeshBasicMaterial(), face = new THREE.MeshBasicMaterial();
    const m = new THREE.Mesh(g, [side, side, side, side, face, side]), root = new THREE.Group(); root.add(m);
    const st = compactMaterialGroups(root);
    assert.equal(g.groups.length, 2);
    assert.deepEqual(st, { meshes: 1, before: 6, after: 2 });
    assert.deepEqual([...g.index.array].sort((a, b) => a - b), before);
    assert.equal(g.groups.reduce((n, gr) => n + gr.count, 0), g.index.count);
});
