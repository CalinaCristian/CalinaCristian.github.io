import * as THREE from '../vendor/three.module.min.js';

// Merged static meshes keep their original cell spans. Reject only complete
// spans outside the current camera, preserving every attribute and index order.
export function cullMergedCells(mesh, parts, { blockTriangles = 0 } = {}) {
    if (parts.length < 2 || !mesh.geometry.index || mesh.geometry.groups.length) return null;
    const geometry = mesh.geometry, sourceIndex = geometry.index, canonical = sourceIndex.array, sourceRange = { ...geometry.drawRange };
    const output = new THREE.BufferAttribute(canonical.slice(), 1).setUsage(THREE.DynamicDrawUsage);
    const blockSize = Number.isFinite(blockTriangles) && blockTriangles > 0 ? Math.max(256, Math.floor(blockTriangles)) : 0;
    const chunks = [], point = new THREE.Vector3(), maxIndices = blockSize * 3;
    const cells = parts.map(part => ({
        start: part.start, count: part.count,
        box: new THREE.Box3(new THREE.Vector3(...part.bounds.slice(0, 3)), new THREE.Vector3(...part.bounds.slice(3))).expandByScalar(0.01),
    }));
    let childBoxes = 0;
    for (const cell of cells) {
        cell.first = chunks.length;
        if (maxIndices > 0 && cell.count > maxIndices) {
            // Static preprocessing only: bounded contiguous index blocks retain
            // every original triangle and its order. No per-triangle frame work.
            for (let start = cell.start; start < cell.start + cell.count; start += maxIndices) {
                const count = Math.min(maxIndices, cell.start + cell.count - start), bounds = new THREE.Box3();
                for (let i = start; i < start + count; i++) bounds.expandByPoint(point.fromBufferAttribute(geometry.attributes.position, canonical[i]));
                chunks.push({ start, count, box: bounds.expandByScalar(0.01) }); childBoxes++;
            }
        } else chunks.push(cell);
        cell.end = chunks.length;
    }
    geometry.setIndex(output);
    const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), box = new THREE.Box3();
    const debug = mesh.userData.cellFrustum = { sourceIndices: canonical.length, sourceComponents: cells.length, components: chunks.length, childBoxes, blockTriangles: blockSize, visibleIndices: canonical.length, updates: 0 };
    let previous = '';
    const select = (renderer, camera) => {
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection, renderer.coordinateSystem);
        const visible = Array(chunks.length).fill(false);
        for (const cell of cells) {
            if (!frustum.intersectsBox(box.copy(cell.box).applyMatrix4(mesh.matrixWorld))) continue;
            for (let i = cell.first; i < cell.end; i++) visible[i] = chunks[i] === cell || frustum.intersectsBox(box.copy(chunks[i].box).applyMatrix4(mesh.matrixWorld));
        }
        const key = visible.map(v => v ? '1' : '0').join('');
        let count = 0;
        if (key !== previous) {
            for (let i = 0; i < chunks.length; i++) if (visible[i]) {
                const part = chunks[i];
                output.array.set(canonical.subarray(part.start, part.start + part.count), count); count += part.count;
            }
            if (count) { output.clearUpdateRanges(); output.addUpdateRange(0, count); output.needsUpdate = true; }
            previous = key; debug.updates++;
        } else for (let i = 0; i < chunks.length; i++) if (visible[i]) count += chunks[i].count;
        geometry.setDrawRange(0, count); debug.visibleIndices = count;
    };
    mesh.onBeforeRender = (renderer, scene, camera) => select(renderer, camera);
    mesh.onBeforeShadow = (renderer, object, camera, shadowCamera) => select(renderer, shadowCamera);
    // Physical queries (including an off-camera drone roof) use the complete
    // canonical mesh, independent of whichever render camera selected last.
    const raycast = mesh.raycast;
    mesh.raycast = function (raycaster, intersections) {
        const selectedIndex = geometry.index, selectedRange = { ...geometry.drawRange };
        geometry.setIndex(sourceIndex); geometry.setDrawRange(sourceRange.start, sourceRange.count);
        try { raycast.call(this, raycaster, intersections); }
        finally { geometry.setIndex(selectedIndex); geometry.setDrawRange(selectedRange.start, selectedRange.count); }
    };
    return debug;
}
