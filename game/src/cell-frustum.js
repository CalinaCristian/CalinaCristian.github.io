import * as THREE from '../vendor/three.module.min.js';

// Merged static meshes keep their original cell spans. Reject only complete
// spans outside the current camera, preserving every attribute and index order.
export function cullMergedCells(mesh, parts) {
    if (parts.length < 2 || !mesh.geometry.index || mesh.geometry.groups.length) return null;
    const geometry = mesh.geometry, sourceIndex = geometry.index, canonical = sourceIndex.array, sourceRange = { ...geometry.drawRange };
    const output = new THREE.BufferAttribute(canonical.slice(), 1).setUsage(THREE.DynamicDrawUsage);
    const cells = parts.map(part => ({
        start: part.start, count: part.count,
        box: new THREE.Box3(new THREE.Vector3(...part.bounds.slice(0, 3)), new THREE.Vector3(...part.bounds.slice(3))).expandByScalar(0.01),
    }));
    geometry.setIndex(output);
    const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), box = new THREE.Box3();
    const debug = mesh.userData.cellFrustum = { sourceIndices: canonical.length, components: cells.length, visibleIndices: canonical.length, updates: 0 };
    let previous = '';
    const select = (renderer, camera) => {
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection, renderer.coordinateSystem);
        const visible = cells.map(part => frustum.intersectsBox(box.copy(part.box).applyMatrix4(mesh.matrixWorld)));
        const key = visible.map(v => v ? '1' : '0').join('');
        let count = 0;
        if (key !== previous) {
            for (let i = 0; i < cells.length; i++) if (visible[i]) {
                const part = cells[i];
                output.array.set(canonical.subarray(part.start, part.start + part.count), count); count += part.count;
            }
            if (count) { output.clearUpdateRanges(); output.addUpdateRange(0, count); output.needsUpdate = true; }
            previous = key; debug.updates++;
        } else for (let i = 0; i < cells.length; i++) if (visible[i]) count += cells[i].count;
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
