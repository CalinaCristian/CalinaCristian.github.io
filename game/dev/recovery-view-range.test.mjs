// node game/dev/recovery-view-range.test.mjs
// "In view" guards every automatic vehicle recovery (deadlock relocation, stuck respawn). It was the camera frustum with
// no depth limit short of the 5 km far plane: measured on Grozăvești with the player facing the district, 305 of 311
// vehicles counted as in view (219 of them more than 400 m away), so no stalled queue was ever recovered and total
// vehicle travel fell by about 98 % in seven simulated minutes. The actual production method on a real camera.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { Traffic } from '../src/traffic.js';

class EmptyTraffic extends Traffic { setupTransit() { } buildBusStops() { } spawnAll() { } }
const t = new EmptyTraffic({ graph: { edges: [], nodes: [] }, buildings: [], walkTop: () => .13 }, { id: 'bucharest' }, new THREE.Scene(), { maxPeds: 0 });
const camera = new THREE.PerspectiveCamera(72, 16 / 9, .2, 5000);
camera.position.set(0, 1.6, 0); camera.lookAt(0, 1.6, -100); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
t.player = { x: 0, z: 0, y: .24, fx: 0, fz: -1, mirrorEnabled: false };
const saved = globalThis.game; globalThis.game = { traffic: t, camera };
try {
    const car = (x, z) => ({ x, z, y: .24, length: 4.4, width: 1.8 });
    let frame = 0; const seen = v => { t._frame = ++frame; return t.inView(v); };
    assert.equal(seen(car(0, -40)), true, 'close ahead');
    assert.equal(seen(car(30, 40)), true, 'within 70 m in any direction');
    assert.equal(seen(car(0, -200)), true, 'ahead within 230 m');
    assert.equal(seen(car(0, -500)), true, 'in the frustum at 500 m: still a visible car');
    assert.equal(seen(car(0, -680)), true, 'in the frustum just inside the limit');
    assert.equal(seen(car(0, -760)), false, 'in the frustum beyond 700 m: under 10 px, recoverable');
    assert.equal(seen(car(0, -2000)), false, 'in the frustum 2 km away: this used to block every recovery');
    assert.equal(seen(car(0, 300)), false, 'behind the camera');
    assert.equal(seen(car(900, -300)), false, 'far outside the frustum');
    // a raised camera (drone) is measured from the camera, not from the car left on the ground
    camera.position.set(0, 120, -1500); camera.lookAt(0, 0, -1600); camera.updateMatrixWorld(true);
    assert.equal(seen(car(0, -1600)), true, 'near the active camera even though 1.6 km from the car');
    console.log('PASS: recovery view test keeps the near rules and the frustum, bounded at 700 m from the active camera');
} finally { globalThis.game = saved; }
