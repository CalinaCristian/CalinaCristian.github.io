import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { MeshBuilder } from '../src/geobuild.js';
import { splitMeshByTiles } from '../src/mesh-tiles.js';

const tris = (geo) => { const I = geo.index, P = geo.attributes.position, C = geo.attributes.color, out = []; for (let k = 0; k < I.count; k += 3) out.push([0, 1, 2].map(j => { const i = I.getX(k + j); return [P.getX(i), P.getY(i), P.getZ(i), C.getX(i)].map(v => +v.toFixed(5)).join(' '); }).join(' | ')); return out.sort(); };

test('a long strip is split by tiles; every triangle and its vertex data is kept once, the material is shared', () => {
    const mb = new MeshBuilder(false, 16);
    for (let x = 0; x < 600; x += 2.4) mb.wall(x, 0, x + 2.4, 0, 8, 9, 0, 1, [36, 68, 255]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true }); mat.userData.nightEmissive = 2.2;
    const mesh = new THREE.Mesh(mb.build(), mat); mesh.name = 'band'; mesh.castShadow = false;
    const before = tris(mesh.geometry);
    const g = splitMeshByTiles(mesh, 125);
    assert.ok(g.isGroup && g.children.length === 5, `${g.children.length} tiles`);
    assert.equal(g.name, 'band');
    assert.deepEqual(g.children.flatMap(c => tris(c.geometry)).sort(), before);
    for (const c of g.children) { assert.equal(c.material, mat); assert.equal(c.castShadow, false); assert.ok(c.geometry.boundingSphere.radius < 100); }
});

test('a mesh inside one tile is returned as it is', () => {
    const mb = new MeshBuilder(false, 16); mb.wall(1, 1, 5, 1, 0, 1, 0, 1, [1, 2, 3]);
    const mesh = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial());
    assert.equal(splitMeshByTiles(mesh, 125), mesh);
});
