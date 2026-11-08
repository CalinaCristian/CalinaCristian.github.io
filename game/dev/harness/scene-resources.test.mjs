// node --test game/dev/harness/scene-resources.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import { disposeDistrictScene } from '../../src/sceneResources.js';
import { makeWaterMaterial, setWaterEnv } from '../../src/water.js';

function disposals(object) {
    let n = 0;
    object.addEventListener('dispose', () => n++);
    return () => n;
}

test('district disposal preserves the cockpit and cached landmark material, but frees its own maps', () => {
    const scene = new THREE.Scene(), cockpit = new THREE.Group();
    const retained = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    cockpit.add(retained); scene.add(cockpit);
    const retainedGeometry = disposals(retained.geometry), retainedMaterial = disposals(retained.material);
    const atlas = new THREE.Texture(), night = new THREE.Texture();
    const districtMaterial = new THREE.MeshBasicMaterial({ map: atlas });
    districtMaterial.userData.ownedTextures = [night];
    const district = new THREE.Mesh(new THREE.BoxGeometry(), districtMaterial); scene.add(district);
    const districtGeometry = disposals(district.geometry), material = disposals(districtMaterial);
    const atlasCount = disposals(atlas), nightCount = disposals(night);
    const landmark = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); scene.add(landmark);
    const landmarkGeometry = disposals(landmark.geometry), landmarkMaterial = disposals(landmark.material);

    disposeDistrictScene(scene, { retained: [cockpit], landmarks: [{ mesh: landmark }] });
    assert.equal(retainedGeometry(), 0); assert.equal(retainedMaterial(), 0);
    assert.equal(districtGeometry(), 1); assert.equal(material(), 1);
    assert.equal(atlasCount(), 1); assert.equal(nightCount(), 1);
    assert.equal(landmarkGeometry(), 1); assert.equal(landmarkMaterial(), 0);
    assert.equal(cockpit.parent, null); assert.equal(scene.children.length, 0);
});

test('fleet and crowd wrappers release instance attributes without disposing cached model attributes', () => {
    for (const kind of ['fleet', 'crowd']) {
        const scene = new THREE.Scene(), base = new THREE.BoxGeometry(), geometry = new THREE.BufferGeometry();
        for (const [key, attribute] of Object.entries(base.attributes)) geometry.setAttribute(key, attribute);
        geometry.setIndex(base.index);
        const paint = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
        geometry.setAttribute('aPaint', paint);
        const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
        if (kind === 'fleet') mesh.userData.fleet = true;
        else { mesh.name = 'crowd-near'; mesh.userData.shared = true; }
        scene.add(mesh);
        let attributesAtDisposal;
        geometry.addEventListener('dispose', () => { attributesAtDisposal = Object.keys(geometry.attributes); });
        const instanceCount = disposals(mesh), baseCount = disposals(base), materialCount = disposals(mesh.material);
        disposeDistrictScene(scene);
        assert.deepEqual(attributesAtDisposal, ['aPaint']);
        assert.equal(geometry.attributes.aPaint, paint); assert.equal(geometry.index, null);
        assert.equal(base.attributes.position.count, 24); assert.equal(base.index.count, 36);
        assert.equal(instanceCount(), 1); assert.equal(baseCount(), 0); assert.equal(materialCount(), 0);
    }
});

test('tree templates survive, while instance buffers and the water registry are released', () => {
    const scene = new THREE.Scene(), tree = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
    tree.name = 'treeCrowns near linden'; scene.add(tree);
    const template = disposals(tree.geometry), instance = disposals(tree), material = disposals(tree.material);
    const water = makeWaterMaterial(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), water));
    const waterCount = disposals(water);
    disposeDistrictScene(scene);
    assert.equal(template(), 0); assert.equal(instance(), 1); assert.equal(material(), 1); assert.equal(waterCount(), 1);
    const env = new THREE.Texture(); setWaterEnv(env);
    assert.notEqual(water.envMap, env);
    setWaterEnv(null); env.dispose();
});
