import assert from 'node:assert/strict';
import * as THREE from '../../game/vendor/three.module.min.js';
import { makeWaterMaterial, setWaterEnv, disposeWater } from '../../game/src/water.js';
import { disposeTree } from '../../game/src/spots/kit.js';

const retired=makeWaterMaterial(),live=makeWaterMaterial(),first=new THREE.Texture(),next=new THREE.Texture();
setWaterEnv(first,.4);
const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4,4),retired));
disposeTree(scene); // Actual tourist disposal path, without the district-specific wrapper.
const version=retired.version;
setWaterEnv(next,.7);
assert.equal(retired.version,version,'Disposed spot water does not receive future program invalidations');
assert.equal(retired.envMap,first,'Disposed material leaves the shared water update registry');
assert.equal(live.envMap,next,'Live water still receives the environment');
assert.equal(live.envMapIntensity,.7);
disposeWater(live);const liveVersion=live.version;
setWaterEnv(null,.2);assert.equal(live.version,liveVersion,'District disposal also unregisters');
first.dispose();next.dispose();
console.log(JSON.stringify({passed:true,touristDirectDisposal:true,districtDisposal:true,liveEnvironmentControl:true}));
