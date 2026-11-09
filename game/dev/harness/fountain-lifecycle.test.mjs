import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../../vendor/three.module.min.js';
import { disposeDistrictScene } from '../../src/sceneResources.js';
const url = new URL('../../src/landmarks.js', import.meta.url);
const source = (await fs.readFile(url, 'utf8')).replace(/from '([^']+)'/g, (_, p) => `from '${new URL(p, url).href}'`) + '\nexport { FOUNTAIN_WATER };';
const { LANDMARKS, buildLandmark, FOUNTAIN_WATER, FOUNTAIN_STATE } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('retiring a real fountain releases its animation registry entry and preserves the other scene', () => {
    const lm = LANDMARKS.find(l => l.id === 'fountains'); assert(lm);
    const a = buildLandmark(lm, { realScale: true }), b = buildLandmark(lm, { realScale: true });
    const first = [...FOUNTAIN_WATER].filter(m => a.mesh.getObjectById(m.id));
    const second = [...FOUNTAIN_WATER].filter(m => b.mesh.getObjectById(m.id));
    assert(first.length > 0 && second.length > 0);
    const scene = new THREE.Scene(); scene.add(a.mesh);
    let materialDisposals = 0; first[0].material.addEventListener('dispose', () => materialDisposals++);
    const otherGeometry = second.map(m => m.geometry.attributes.position.array.slice());
    disposeDistrictScene(scene, { landmarks: [a] });
    for (const m of first) assert.equal(FOUNTAIN_WATER.has(m), false, 'disposed basin cannot retain its scene');
    for (const m of second) assert.equal(FOUNTAIN_WATER.has(m), true, 'other scene remains registered');
    assert.equal(materialDisposals, 0, 'shared fountain material survives district disposal');
    for (const m of first) m.geometry.dispose();
    assert.equal(FOUNTAIN_WATER.size, second.length, 'repeat geometry disposal is idempotent');
    const perf = globalThis.performance, mode = FOUNTAIN_STATE.mode;
    try {
        let now = 2000; globalThis.performance = { now: () => now };
        FOUNTAIN_STATE.mode = 'off'; second[0].onBeforeRender({ info: { render: { frame: 101 } } });
        assert(second.every(m => !m.visible), 'surviving basins still follow drained condition');
        now += 2000; FOUNTAIN_STATE.mode = 'on'; second[0].onBeforeRender({ info: { render: { frame: 102 } } });
        assert(second.every(m => m.visible), 'surviving basins restore when running');
        second.forEach((m, i) => assert.deepEqual(m.geometry.attributes.position.array, otherGeometry[i]));
    } finally { globalThis.performance = perf; FOUNTAIN_STATE.mode = mode; }
    const scene2 = new THREE.Scene(); scene2.add(b.mesh); disposeDistrictScene(scene2, { landmarks: [b] });
    assert.equal(FOUNTAIN_WATER.size, 0);
});
