// frame-budget.js fills THREE.BatchedMesh's own geometry records by hand (zero-copy city context). This pins the vendored
// three.js layout it relies on, and checks the lossless material-group merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { batchedInternals, compactMaterialGroups, dynamicIndexMesh, boxDistanceHide } from '../src/spots/frame-budget.js';

test('boxDistanceHide keeps a merged decoration mesh while the camera is near any part of it (r2-sea-spots-b-5)', () => {
    // two baskets 200 m apart in ONE mesh: a walker beside either one must get the mesh; a camera 90 m over them must not
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 4, 0, 0.4, 4, 0, 0, 4.4, 0, 200, 4, 0, 200.4, 4, 0, 200, 4.4, 0], 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial()), mask = m.layers.mask, lod = boxDistanceHide([m], 70), cam = new THREE.PerspectiveCamera();
    const at = (x, y, z) => { cam.position.set(x, y, z); cam.updateMatrixWorld(); lod.update(cam); return m.layers.mask; };
    assert.equal(at(2, 1.6, 3), mask, 'beside the first basket');
    assert.equal(at(198, 1.6, -3), mask, 'beside the second basket (200 m from the mesh centre)');
    assert.equal(at(100, 30, 40), mask, 'between them, 26 m up');
    assert.equal(at(100, 95, 0), 0, '90 m over them: not submitted');
    assert.equal(lod.stats.hidden, 1);
    assert.equal(at(5, 3, 0), mask, 'back at street level');
});

test('without multi-draw, the packed dynamic index draws exactly the cells in view and not hidden (r2-sea-spots-b-4)', () => {
    // three unit triangles, one per cell, at x = -50 (left of the view), 0 (ahead), 50 (right of the view)
    const pos = [], idx = []; for (const [k, x] of [-50, 0, 50].entries()) { pos.push(x, 0, -20, x + 1, 0, -20, x, 1, -20); idx.push(k * 3, k * 3 + 1, k * 3 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const box = (x) => new THREE.Box3(new THREE.Vector3(x, 0, -20), new THREE.Vector3(x + 1, 1, -20));
    const cells = [-50, 0, 50].map((x, k) => ({ start: k * 3, count: 3, it: { box: box(x) } }));
    const m = dynamicIndexMesh({ geometry: g, material: new THREE.MeshBasicMaterial(), name: 'city', userData: {} }, cells);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    m.onBeforeRender(null, null, cam);
    assert.equal(m.geometry.drawRange.count, 3, 'only the cell ahead is drawn');
    assert.deepEqual([...m.geometry.index.array.slice(0, 3)], [3, 4, 5]);
    cells[1].it.vis = false; m.onBeforeRender(null, null, cam); // the skyline culler hid it
    assert.equal(m.geometry.drawRange.count, 0);
    cells[1].it.vis = true; cam.fov = 170; cam.updateProjectionMatrix(); m.onBeforeRender(null, null, cam);
    assert.equal(m.geometry.drawRange.count, 9, 'a wide view draws all three');
    assert.equal(m.userData.auditGeometry, g, 'the audit reads the whole source geometry');
});

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
