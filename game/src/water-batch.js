import * as THREE from '../vendor/three.module.min.js';

// Keep the original water component spheres and opaque ordering, while submitting
// their exact visible triangles through one indexed draw on every WebGL2 browser.
export function batchWaterChunks(group) {
    const sources = group.children.slice();
    if (sources.length < 2) return null;
    const first = sources[0], names = Object.keys(first.geometry?.attributes || {}).sort();
    if (!first.isMesh || Array.isArray(first.material) || first.material?.transparent || !names.includes('position')) return null;
    const signature = a => [a.itemSize, a.normalized, a.array.constructor.name].join(':');
    const layout = names.map(k => signature(first.geometry.attributes[k]));
    for (const source of sources) {
        const g = source.geometry;
        if (!source.isMesh || source.isInstancedMesh || source.isSkinnedMesh || source.material !== first.material || !source.visible || !source.frustumCulled ||
            source.castShadow !== first.castShadow || source.receiveShadow !== first.receiveShadow || source.renderOrder !== first.renderOrder ||
            source.layers.mask !== first.layers.mask || !source.matrix.equals(first.matrix) || g.groups.length || Object.keys(g.morphAttributes).length ||
            Object.keys(g.attributes).sort().join('|') !== names.join('|') || names.some((k, i) => g.attributes[k].isInterleavedBufferAttribute || signature(g.attributes[k]) !== layout[i]) ||
            source.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || source.onAfterRender !== THREE.Object3D.prototype.onAfterRender) return null;
    }
    const parts = [], geometry = new THREE.BufferGeometry();
    let vertices = 0, indices = 0;
    for (const source of sources) {
        const g = source.geometry, count = g.index?.count ?? g.attributes.position.count;
        const start = Math.max(0, g.drawRange.start), end = Math.min(count, start + g.drawRange.count);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start % 3 || (end - start) % 3) return null;
        if (!g.boundingSphere) g.computeBoundingSphere();
        parts.push({ name: source.name, order: source.id, sphere: g.boundingSphere.clone(), vertexStart: vertices, indexStart: indices, indexCount: end - start, sourceStart: start });
        vertices += g.attributes.position.count; indices += end - start;
    }
    for (const name of names) {
        const original = first.geometry.attributes[name], array = new original.array.constructor(vertices * original.itemSize);
        let offset = 0;
        for (const source of sources) { const a = source.geometry.attributes[name].array; array.set(a, offset); offset += a.length; }
        geometry.setAttribute(name, new THREE.BufferAttribute(array, original.itemSize, original.normalized));
    }
    const canonical = new Uint32Array(indices);
    for (let p = 0; p < parts.length; p++) {
        const part = parts[p], index = sources[p].geometry.index;
        for (let i = 0; i < part.indexCount; i++) canonical[part.indexStart + i] = part.vertexStart + (index ? index.getX(part.sourceStart + i) : part.sourceStart + i);
        delete part.vertexStart; delete part.sourceStart;
    }
    const output = new THREE.BufferAttribute(canonical.slice(), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(output); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = 'water-big visible batch'; mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask; mesh.matrix.copy(first.matrix); mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // Each unchanged component sphere is tested below, separately for each render camera.
    const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere(), projected = new THREE.Vector4();
    const debug = mesh.userData.waterBatch = { version: 1, sourceChunks: parts.length, sourceVertices: vertices, sourceIndices: indices, components: parts.map(p => ({ name: p.name, indices: p.indexCount })), selected: [], updates: 0 };
    group.userData.waterBatch = debug;
    let previous = '';
    mesh.onBeforeRender = (renderer, scene, camera) => {
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection, renderer.coordinateSystem);
        const visible = [];
        for (const part of parts) {
            sphere.copy(part.sphere).applyMatrix4(mesh.matrixWorld);
            if (!frustum.intersectsSphere(sphere)) continue;
            // r170 sorts opaque render items by clip-space z (Vector4), before
            // perspective division. Behind-camera sphere centres must keep that order too.
            projected.copy(part.sphere.center).applyMatrix4(mesh.matrixWorld).applyMatrix4(projection);
            visible.push({ ...part, z: projected.z });
        }
        visible.sort((a, b) => a.z - b.z || a.order - b.order);
        const key = visible.map(p => p.order).join(',');
        let count = 0;
        if (key !== previous) {
            for (const part of visible) { output.array.set(canonical.subarray(part.indexStart, part.indexStart + part.indexCount), count); count += part.indexCount; }
            if (count) { output.clearUpdateRanges(); output.addUpdateRange(0, count); output.needsUpdate = true; }
            previous = key; debug.updates++;
        } else for (const part of visible) count += part.indexCount;
        geometry.setDrawRange(0, count);
        debug.selected = visible.map(p => p.name); debug.visibleIndices = count;
    };
    const oldGeometries = new Set();
    for (const source of sources) { oldGeometries.add(source.geometry); source.removeFromParent(); }
    group.add(mesh);
    for (const g of oldGeometries) g.dispose();
    sources.length = 0;
    return mesh;
}
