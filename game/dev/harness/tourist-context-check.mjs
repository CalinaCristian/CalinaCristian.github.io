// Real regressions: inherited non-floor semantics, vehicle initialization and
// mapped outdoor seating. No browser or source imagery needed for these cases.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three.module.min.js';
import { floorProbe } from '../../src/spots/index.js';
import { oldTownTerraces } from '../../src/spots/buc.js';

const scene = new THREE.Scene();
const box = (y, name = '') => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, .2, 2)); mesh.name = name; mesh.position.y = y; return mesh; };
const vehicle = new THREE.Group(); vehicle.name = 'car-sedan'; vehicle.add(box(1)); scene.add(vehicle);
assert.equal(floorProbe(scene).lift(0, 0, 0), 0, 'unnamed car body is never a floor');
vehicle.name = ''; vehicle.userData.noFloor = true;
assert.equal(floorProbe(scene).lift(0, 0, 0), 0, 'noFloor applies to descendants');
vehicle.userData.noFloor = false; vehicle.visible = false;
assert.equal(floorProbe(scene).lift(0, 0, 0), 0, 'invisible ancestor is not a floor');
vehicle.removeFromParent(); scene.add(box(.3, 'entry-step'));
assert.ok(Math.abs(floorProbe(scene).lift(0, 0, 0) - .4) < 1e-6, 'real entry step remains a floor');

const data = JSON.parse(await readFile(new URL('../../data/spots/buc-old-town.json', import.meta.url)));
const sourceRecords = () => JSON.stringify(data.buildings.map(({ _bb, ...source }) => source));
const before = sourceRecords();
const t = oldTownTerraces({ data, ground: { heightAt: () => 0 }, box() {} }, { seed: 3, prioritySources: ['n1731040881', 'n10775253367'] });
assert.ok(t.signs.some(s => s.source === 'n10775253367' && s.text === 'Shoteria'), 'mapped Shoteria frontage retained');
assert.ok(t.signs.some(s => s.source === 'n1731040881'), 'mapped Dristor frontage retained');
assert.ok(!t.terraces.some(s => s.source === 'n10775253367'), 'OSM outdoor_seating=no forbids Shoteria terrace');
assert.ok(t.terraces.some(s => s.source === 'n1731040881'), 'Dristor outdoor_seating=yes retained');
assert.ok(t.terraces.every(s => data.pois.find(p => p.id === s.source)?.outdoor_seating === 'yes'), 'all terraces have affirmative OSM evidence');
assert.equal(sourceRecords(), before, 'no building source record or footprint changed');
console.log('10 tourist context regression checks pass');
