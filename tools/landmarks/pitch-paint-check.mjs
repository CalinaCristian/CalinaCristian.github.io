// Present-tense pitch-paint invariants; no browser or DOM required. (Round 3, 2026-11-13: the first version compared every
// landmark with the pre-decal commit 338300a9, which only held for the commit that added the decal; every later landmark
// change failed it. The decal-specific checks below are unchanged; the historical comparison is replaced by invariants
// that hold for the current tree: the paint exists on Dinamo only and no 12 cm white strip is drawn twice in the masonry.)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../../game/vendor/three.module.min.js';
import { LANDMARKS, buildLandmark, landmarkSurfaceMaterials } from '../../game/src/landmarks.js';
import { DINAMO_PAINT, dinamoPaintSegments, paintPolygon } from '../../game/src/landmark-pitch-paint.js';
import { disposeDistrictScene } from '../../game/src/sceneResources.js';
const baseline = null;
let checks = 0, current;
for (const lm of LANDMARKS) {
    const b = buildLandmark(lm, { realScale: true });
    let paint = 0; b.mesh.traverse(o => { if (o.isMesh && (o.name === 'dinamo-pitch-paint' || o.material?.alphaMap?.image?.data?.length === DINAMO_PAINT.width * DINAMO_PAINT.height * 2)) paint++; });
    assert.equal(paint, lm.id === 'dinamo' ? 1 : 0, lm.id + ': pitch paint is drawn on Dinamo only'); checks++;
    if (lm.id === 'dinamo') current = b;
}
const newM = current.mesh.children.find(o => o.material.name === 'landmark-floodlit');
{ // the decal replaced the 12 cm white masonry strips at the paint height: none of them is drawn as geometry as well
    const positions = newM.geometry.attributes.position.array, colors = newM.geometry.attributes.color.array, white = new THREE.Color('#f7f7f2');
    let strips = 0;
    for (let i = 0; i < positions.length; i += 9) {
        const paint = [1, 4, 7].every(j => Math.abs(positions[i + j] - .18) < 1e-7) && [0, 3, 6].every(j => Math.abs(colors[i + j] - white.r) < 1e-7 && Math.abs(colors[i + j + 1] - white.g) < 1e-7 && Math.abs(colors[i + j + 2] - white.b) < 1e-7);
        if (paint) strips++;
    }
    assert.equal(strips, 0, 'no painted strip geometry left in the masonry'); checks++;
}
const tri = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
const extra = current.mesh.children.find(o => o.name === 'dinamo-pitch-paint'), material = extra.material, texture = material.alphaMap;
{ let t = 0; current.mesh.traverse(o => { if (o.isMesh) t += tri(o.geometry); }); assert.equal(current.triangles, t); } assert.equal(extra.geometry.index.count, 6); checks += 2;
const p = extra.geometry.attributes.position.array, cross = new THREE.Vector3().fromArray(p, 3).sub(new THREE.Vector3().fromArray(p)).cross(new THREE.Vector3().fromArray(p, 6).sub(new THREE.Vector3().fromArray(p)));
assert(cross.y > 0); assert.equal(extra.castShadow, false); assert.equal(extra.receiveShadow, true); checks += 3;
assert(landmarkSurfaceMaterials().includes(material)); assert.equal(material.depthWrite, false); assert(material.transparent); checks += 3;
for (const key of ['nightEmissive', 'nightGlow', 'dayGlow', 'floodlit']) { assert.equal(material.userData[key], newM.material.userData[key]); checks++; }
assert.equal(material.emissive.getHex(), newM.material.emissive.getHex()); assert.equal(material.vertexColors, true); checks += 2;
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
console.log(JSON.stringify({ passed: true, baseline, checks, modelsWithoutPaint: LANDMARKS.length - 1, paintStripsInMasonry: 0, paintSegments: lines.length, widthM: .12, physicalStripAreaM2: physicalArea, filteredUnionAreaM2: filteredArea, trianglesAfter: current.triangles, addedMainDraws: 1, addedShadowDraws: 0, textureMipBytes: mipBytes, assetBytes: (await fs.stat(new URL('../../game/src/landmark-pitch-paint-coverage.js', import.meta.url))).size }, null, 2));
