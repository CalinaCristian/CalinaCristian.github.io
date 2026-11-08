import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import { frameOfficeSign } from './visual/page/office-sign-frame.js';

// Independent projection controls: actual authored planes, transformed parent rigs,
// portrait width and tall signs. These fail the former fixed forward-wall pose.
for (const [name, width, height, yaw, scale, aspect] of [
    ['back-wall desktop', 5.6, 1.4, 0, 1, 16 / 9],
    ['Rosetti side-wall', 5.6, 1.4, Math.PI / 2, .45, 16 / 9],
    ['portrait width', 5.6, 1.4, 0, 1, 390 / 844],
    ['tall portrait sign', 1.4, 5.6, -.7, .8, 390 / 844],
]) test(name + ' uses the sign front, fits both dimensions and restores the camera', () => {
    const scene = new THREE.Scene(), signMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height));
    signMesh.position.set(-5, 2.6, -6); signMesh.rotation.y = yaw; signMesh.scale.setScalar(scale); scene.add(signMesh);
    const rig = new THREE.Group(); rig.position.set(3, 1, 4); rig.rotation.set(.1, .6, -.08); scene.add(rig);
    const camera = new THREE.PerspectiveCamera(73, aspect, .1, 40); camera.position.set(.2, .4, .6); camera.rotation.set(-.2, .4, .1); camera.zoom = 1.2; rig.add(camera);
    const before = { p: camera.position.toArray(), q: camera.quaternion.toArray(), fov: camera.fov, zoom: camera.zoom, far: camera.far, rig: rig.matrix.toArray() };
    const framed = frameOfficeSign({ scene, signMesh, camera });
    assert.equal(framed.proof.fits, true);
    const actualNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(signMesh.quaternion);
    assert.ok(new THREE.Vector3().fromArray(framed.proof.eye).sub(new THREE.Vector3().fromArray(framed.proof.centre)).dot(actualNormal) > 0);
    // THREE's independent frustum query must include every actual plane corner.
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) assert.ok(frustum.containsPoint(new THREE.Vector3(x, y, 0).applyMatrix4(signMesh.matrixWorld)));
    assert.ok(framed.proof.projected.every(p => Math.abs(p[0]) <= 1 / 1.15 + 1e-10 && Math.abs(p[1]) <= 1 / 1.15 + 1e-10));
    framed.restore(); framed.restore();
    assert.deepEqual(camera.position.toArray(), before.p); assert.deepEqual(camera.quaternion.toArray(), before.q);
    assert.equal(camera.fov, before.fov); assert.equal(camera.zoom, before.zoom); assert.equal(camera.far, before.far);
    assert.deepEqual(rig.position.toArray(), [3, 1, 4]); assert.deepEqual(rig.rotation.toArray(), [.1, .6, -.08, 'XYZ']);
});

test('the former Rosetti forward-wall pose cannot face the actual side-wall sign', () => {
    const camera = new THREE.PerspectiveCamera(73, 16 / 9, .1, 100);
    camera.position.set(0, 1.75, -9); camera.updateMatrixWorld(true);
    const toSign = new THREE.Vector3(-5.87, 2.6, -1).sub(camera.position);
    assert.ok(toSign.dot(camera.getWorldDirection(new THREE.Vector3())) < 0);
});

test('missing sign fails explicitly without changing the camera', () => {
    const camera = new THREE.PerspectiveCamera(); camera.position.set(1, 2, 3);
    assert.throws(() => frameOfficeSign({ scene: new THREE.Scene(), camera }), /Missing actual office sign/);
    assert.deepEqual(camera.position.toArray(), [1, 2, 3]);
});

test('portrait framing stays inside the opposite actual room boundary', () => {
    const scene = new THREE.Scene(), signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4));
    signMesh.position.set(0, 2.8, -5.88); scene.add(signMesh);
    const camera = new THREE.PerspectiveCamera(73, 390 / 844, .1, 100); scene.add(camera);
    const bounds = { minX: -5.5, maxX: 5.5, minZ: -5.5, maxZ: 5.5 };
    const fixedLensDistance = 5.6 * 1.15 / (2 * Math.tan(THREE.MathUtils.degToRad(50) / 2) * camera.aspect);
    assert.ok(signMesh.position.z + fixedLensDistance > bounds.maxZ, 'old fixed lens would place the camera behind the opposite wall');
    const framed = frameOfficeSign({ scene, signMesh, camera, bounds });
    assert.equal(framed.proof.fits, true); assert.ok(framed.proof.fov > 50);
    const eye = camera.getWorldPosition(new THREE.Vector3());
    assert.ok(eye.x > bounds.minX && eye.x < bounds.maxX && eye.z > bounds.minZ && eye.z < bounds.maxZ);
    framed.restore(); assert.equal(camera.fov, 73);
});

test('an actual room partition selects a closer clear view without hiding it', () => {
    const scene = new THREE.Scene(), signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4));
    signMesh.position.set(0, 2.15, -6.88); scene.add(signMesh);
    const partition = new THREE.Mesh(new THREE.BoxGeometry(.1, 3, 4)); partition.position.set(1.5, 1.5, -2); scene.add(partition);
    const camera = new THREE.PerspectiveCamera(73, 390 / 844, .1, 100); scene.add(camera);
    scene.updateMatrixWorld(true);
    const target = new THREE.Vector3(2.52, 2.15, -6.88), ray = new THREE.Raycaster();
    const oldEye = new THREE.Vector3(0, 2.15, 3.824); ray.set(oldEye, target.clone().sub(oldEye).normalize());
    assert.equal(ray.intersectObject(scene, true)[0].object, partition, 'a frame bounded only by the room crosses the partition');
    const framed = frameOfficeSign({ scene, signMesh, camera, bounds: { minX: -6.5, maxX: 6.5, minZ: -6.5, maxZ: 6.5 } });
    assert.equal(framed.proof.fits, true); assert.equal(framed.proof.clearRays, 9);
    const eye = camera.getWorldPosition(new THREE.Vector3()); ray.set(eye, target.clone().sub(eye).normalize());
    assert.equal(ray.intersectObject(scene, true)[0].object, signMesh);
    assert.ok(eye.z < oldEye.z); assert.ok(framed.proof.fov > 70); assert.equal(partition.visible, true);
    framed.restore(); assert.equal(camera.fov, 73);
});
