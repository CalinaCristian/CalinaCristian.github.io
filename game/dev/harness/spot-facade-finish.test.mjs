// Spot context façades (spots/facade-finish.js): whole storeys to the eaves, whole bays along a gently curving front,
// plain gables, and the seed attribute the night-window shader keys on. Node only (no renderer).
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import { finishContextFacades } from '../../src/spots/facade-finish.js';

const S = { floor: 3, bay: 3.2, win: [0.18, 0.25, 0.82, 0.8] };
const pos = [], uv = [], idx = [];
// walls as osm.js maps them: v = (y − base) / (4 · floor) from the base, u restarted and rounded per edge
const wall = (ring, y0, y1, base) => { let u = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = pos.length / 3, ua = Math.round(u / S.bay) * S.bay, span = Math.max(S.bay, Math.round(L / S.bay) * S.bay);
    pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]); uv.push(ua / (S.bay * 4), (y0 - base) / (S.floor * 4), (ua + span) / (S.bay * 4), (y0 - base) / (S.floor * 4), (ua + span) / (S.bay * 4), (y1 - base) / (S.floor * 4), ua / (S.bay * 4), (y1 - base) / (S.floor * 4));
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2); u += L; } };
// a curved front of 8 short edges turning 10° each, then three cornered edges; eaves 10 m above the base (3.33 storeys)
const curve = []; for (let i = 0; i <= 8; i++) { const a = i * 10 * Math.PI / 180; curve.push([40 * Math.sin(a), 40 - 40 * Math.cos(a)]); }
curve.push([curve[8][0] - 10, curve[8][1] + 10], [-10, 10]);
wall(curve, -0.6, 10.4, 0.4);
// a box touching nothing, eaves 7 m above its base, and its gable triangle
wall([[100, 0], [110, 0], [110, 10], [100, 10]], -0.2, 7.0, 0.0);
const gable = pos.length / 3; pos.push(100, 7, 0, 110, 7, 0, 105, 10, 0); uv.push(0.1, 0.5, 0.3, 0.5, 0.2, 0.7); idx.push(gable, gable + 1, gable + 2);
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
const tex = () => new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(200), 4, 4);
const m = new THREE.MeshStandardMaterial({ map: tex(), emissiveMap: tex() }); m.name = 'facade-apartment'; m.userData.style = S;
const mesh = new THREE.Mesh(g, m); mesh.name = 'osm-buildings:f-apartment';
const hero = new THREE.Mesh(g.clone(), m); hero.name = 'hero-front:f-apartment'; // not context: left as authored
const root = new THREE.Group(); root.add(mesh, hero);
const before = hero.geometry.attributes.uv.array.slice();
const st = finishContextFacades(root);
assert.equal(st.quads, 15); assert.equal(st.buildings, 2); assert.equal(st.plainFaces, 3);
const U = g.attributes.uv.array, top = (q) => U[(q * 4 + 2) * 2 + 1] * 4;
for (let q = 0; q < 15; q++) assert.ok(Math.abs(top(q) - Math.round(top(q))) < 1e-4, `wall ${q}: the eaves end a whole storey (${top(q)})`);
assert.ok(Math.abs(top(0) - 3) < 1e-4 && Math.abs(top(11) - 2) < 1e-4, '10 m → 3 storeys, 7 m → 2 storeys');
for (let q = 0; q < 7; q++) assert.ok(Math.abs(U[(q * 4 + 1) * 2] - U[(q + 1) * 4 * 2]) < 1e-5, `u runs on across the gentle bend ${q}`);
const bays = U[(7 * 4 + 1) * 2] * 4; assert.ok(Math.abs(bays - Math.round(bays)) < 1e-4, 'the curved run holds whole bays');
assert.ok(U[(8 * 4) * 2] === 0, 'a bend over 15° starts a new run');
assert.ok(Math.abs(U[gable * 2] - 0.18 * 0.5 / 4) < 1e-6 && U[gable * 2 + 2] === U[gable * 2] && U[gable * 2 + 4] === U[gable * 2], 'the gable is plain wall');
assert.ok(U[1] < 0, 'below the base v stays negative (a plain plinth in the shader)');
const seed = g.attributes.facadeSeed.array; assert.ok(seed[0] > 0 && seed[1] > 0 && seed[0] !== seed[11 * 8], 'per-building seeds');
assert.deepEqual([...hero.geometry.attributes.uv.array], [...before], 'non-context façades keep their mapping');
assert.ok(m.customProgramCacheKey().includes('facade-finish'), 'the façade material carries the night-window / far patch');
// a later visit that wraps the same arrays (the Seattle source-context packet) keeps the first result
const after = [...U];
const again = new THREE.Mesh(new THREE.BufferGeometry(), m); again.name = 'source-context:f-apartment:0,0';
for (const k of ['position', 'uv']) again.geometry.setAttribute(k, new THREE.BufferAttribute(g.attributes[k].array, g.attributes[k].itemSize));
again.geometry.setIndex(new THREE.BufferAttribute(g.index.array, 1));
const st2 = finishContextFacades(again);
assert.equal(st2.reused, 1); assert.deepEqual([...U], after, 'idempotent on a reused packet');
assert.equal(again.geometry.attributes.facadeSeed.array, g.attributes.facadeSeed.array, 'the same seeds');
console.log('Whole storeys, whole bays along runs, plain gables, seeds and the material patch passed.', JSON.stringify(st));
