// Compare against the immutable pre-decal geometry; no browser or DOM required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as THREE from '../../game/vendor/three.module.min.js';
import { LANDMARKS, buildLandmark, landmarkSurfaceMaterials } from '../../game/src/landmarks.js';
import { DINAMO_PAINT, dinamoPaintSegments, paintPolygon } from '../../game/src/landmark-pitch-paint.js';
import { disposeDistrictScene } from '../../game/src/sceneResources.js';
const baseline = '338300a95a79a2cabf3d7256ff745c6a1bac0372', url = new URL('../../game/src/landmarks.js', import.meta.url);
const source = execFileSync('git', ['show', baseline + ':game/src/landmarks.js'], { cwd: new URL('../..', import.meta.url) }).toString()
    .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`);
const before = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const hash = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const geometry = mesh => { const rows = []; mesh.traverse(o => { if (!o.isMesh) return; rows.push({ name: o.name, material: o.material.name, index: o.geometry.index ? hash(o.geometry.index.array) : null,
    attributes: Object.fromEntries(Object.entries(o.geometry.attributes).map(([k, v]) => [k, hash(v.array)])) }); }); return rows; };
let checks = 0, current, old;
for (const lm of LANDMARKS) {
    const a = before.buildLandmark(before.LANDMARKS.find(l => l.id === lm.id), { realScale: true }), b = buildLandmark(lm, { realScale: true });
    for (const key of ['clear', 'clearM', 'authoredScale', 'collision', 'fences', 'covers', 'grounds', 'coverPolys']) { assert.deepEqual(b[key], a[key], lm.id + ': ' + key); checks++; }
    assert.deepEqual(b.mesh.userData, a.mesh.userData, lm.id + ': football/model metadata'); checks++;
    if (lm.id !== 'dinamo') { assert.deepEqual(geometry(b.mesh), geometry(a.mesh), lm.id + ': unchanged geometry'); checks++; }
    else { current = b; old = a; }
}
const oldM = old.mesh.children.find(o => o.material.name === 'landmark-floodlit'), newM = current.mesh.children.find(o => o.material.name === 'landmark-floodlit');
const keep = [], positions = oldM.geometry.attributes.position.array, colors = oldM.geometry.attributes.color.array, white = new THREE.Color('#f7f7f2');
let removed = 0;
for (let i = 0; i < positions.length; i += 9) {
    const paint = [1, 4, 7].every(j => Math.abs(positions[i + j] - .18) < 1e-7) && [0, 3, 6].every(j => Math.abs(colors[i + j] - white.r) < 1e-7 && Math.abs(colors[i + j + 1] - white.g) < 1e-7 && Math.abs(colors[i + j + 2] - white.b) < 1e-7);
    if (paint) removed++; else keep.push(i);
}
assert.equal(removed, 114); checks++;
for (const key of ['position', 'normal', 'color']) {
    const a = oldM.geometry.attributes[key].array, filtered = new Float32Array(keep.flatMap(i => Array.from(a.slice(i, i + 9))));
    assert.equal(hash(filtered), hash(newM.geometry.attributes[key].array), 'Entire non-paint masonry remains byte-identical: ' + key); checks++;
}
const extra = current.mesh.children.find(o => o.name === 'dinamo-pitch-paint'), material = extra.material, texture = material.alphaMap;
assert.deepEqual(geometry(current.mesh).filter(o => o.material !== 'landmark-floodlit' && o.name !== extra.name), geometry(old.mesh).filter(o => o.material !== 'landmark-floodlit')); checks++;
assert.equal(current.triangles, old.triangles - 114 + 2); assert.equal(extra.geometry.index.count, 6); checks += 2;
const p = extra.geometry.attributes.position.array, cross = new THREE.Vector3().fromArray(p, 3).sub(new THREE.Vector3().fromArray(p)).cross(new THREE.Vector3().fromArray(p, 6).sub(new THREE.Vector3().fromArray(p)));
assert(cross.y > 0); assert.equal(extra.castShadow, false); assert.equal(extra.receiveShadow, true); checks += 3;
assert(landmarkSurfaceMaterials().includes(material)); assert.equal(material.depthWrite, false); assert(material.transparent); checks += 3;
for (const key of ['nightEmissive', 'nightGlow', 'dayGlow', 'floodlit']) { assert.equal(material.userData[key], oldM.material.userData[key]); checks++; }
assert.equal(material.emissive.getHex(), oldM.material.emissive.getHex()); assert.equal(material.vertexColors, true); checks += 2;
assert.equal(texture.format, THREE.RGFormat); assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter); assert(texture.generateMipmaps); checks += 3;
assert.equal(texture.image.data.length, DINAMO_PAINT.width * DINAMO_PAINT.height * 2); checks++;
let mipBytes = 0; for (let n = 1024; n >= 1; n /= 2) mipBytes += n * n * 2;
assert.equal(mipBytes, DINAMO_PAINT.mipBytes); checks++;
const lines = dinamoPaintSegments(); assert.equal(lines.length, 57); checks++;
let physicalArea = 0;
for (const line of lines) {
    const q = paintPolygon(line); assert.equal(line[4], .12); assert(Math.abs(Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) - .12) < 1e-12);
    physicalArea += Math.hypot(line[2] - line[0], line[3] - line[1]) * .12; checks += 2;
}
let coverage = 0; const alpha = texture.image.data; for (let i = 1; i < alpha.length; i += 2) coverage += alpha[i] / 255;
const filteredArea = coverage * 108 * 69 / 1024 ** 2;
// Union loses the legitimate strip intersections; sampling must not expand ink.
assert(filteredArea < physicalArea * 1.01 && filteredArea > physicalArea * .98); checks++;
let disposedGeometry = 0, disposedMaterial = 0, disposedTexture = 0;
extra.geometry.addEventListener('dispose', () => disposedGeometry++); material.addEventListener('dispose', () => disposedMaterial++); texture.addEventListener('dispose', () => disposedTexture++);
const scene = new THREE.Scene(); scene.add(current.mesh); disposeDistrictScene(scene, { landmarks: [{ mesh: current.mesh }] });
assert.equal(disposedGeometry, 1); assert.equal(disposedMaterial, 0); assert.equal(disposedTexture, 0); checks += 3;
const again = buildLandmark(LANDMARKS.find(l => l.id === 'dinamo'), { realScale: true }); assert.equal(again.mesh.children.find(o => o.name === extra.name).material, material); checks++;
console.log(JSON.stringify({ passed: true, baseline, checks, unchangedOtherModels: 60, exactNonPaintGeometry: true, exactFootballMetadataAndCollision: true, paintSegments: lines.length, widthM: .12, physicalStripAreaM2: physicalArea, filteredUnionAreaM2: filteredArea, trianglesBefore: old.triangles, trianglesAfter: current.triangles, addedMainDraws: 1, addedShadowDraws: 0, textureMipBytes: mipBytes, assetBytes: (await fs.stat(new URL('../../game/src/landmark-pitch-paint-coverage.js', import.meta.url))).size }, null, 2));
