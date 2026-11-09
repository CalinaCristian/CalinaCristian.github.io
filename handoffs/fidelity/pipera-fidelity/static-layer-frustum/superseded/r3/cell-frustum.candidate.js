import * as THREE from '../vendor/three.module.min.js';

const cameraFrusta = new WeakMap();
function cameraFrustum(camera, coordinateSystem) {
    let cached = cameraFrusta.get(camera);
    if (!cached) {
        cached = { projection: new THREE.Matrix4(), inverse: new THREE.Matrix4(), matrix: new THREE.Matrix4(), frustum: new THREE.Frustum(), ready: false };
        cameraFrusta.set(camera, cached);
    }
    if (!cached.ready || cached.coordinateSystem !== coordinateSystem || !cached.projection.equals(camera.projectionMatrix) || !cached.inverse.equals(camera.matrixWorldInverse)) {
        cached.projection.copy(camera.projectionMatrix); cached.inverse.copy(camera.matrixWorldInverse);
        cached.frustum.setFromProjectionMatrix(cached.matrix.multiplyMatrices(cached.projection, cached.inverse), coordinateSystem);
        cached.coordinateSystem = coordinateSystem; cached.ready = true;
    }
    return cached.frustum;
}

// Merged static meshes keep their original cell spans. Reject only complete
// spans outside the current camera, preserving every attribute and index order.
export function cullMergedCells(mesh, parts, { blockTriangles = 0 } = {}) {
    if (parts.length < 2 || !mesh.geometry.index || mesh.geometry.groups.length) return null;
    const geometry = mesh.geometry, sourceIndex = geometry.index, canonical = sourceIndex.array, sourceRange = { ...geometry.drawRange };
    const output = new THREE.BufferAttribute(canonical.slice(), 1).setUsage(THREE.DynamicDrawUsage);
    const blockSize = Number.isFinite(blockTriangles) && blockTriangles > 0 ? Math.max(64, Math.floor(blockTriangles)) : 0;
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
    const boundsMatrix = mesh.matrixWorld.clone();
    const updateWorldBounds = () => {
        for (const cell of cells) {
            (cell.worldBox ||= new THREE.Box3()).copy(cell.box).applyMatrix4(mesh.matrixWorld);
            if (chunks[cell.first] !== cell) for (let i = cell.first; i < cell.end; i++) (chunks[i].worldBox ||= new THREE.Box3()).copy(chunks[i].box).applyMatrix4(mesh.matrixWorld);
        }
        boundsMatrix.copy(mesh.matrixWorld);
    };
    updateWorldBounds();
    geometry.setIndex(output);
    const debug = mesh.userData.cellFrustum = { sourceIndices: canonical.length, sourceComponents: cells.length, components: chunks.length, childBoxes, worldBoxes: cells.length + childBoxes, blockTriangles: blockSize, visibleIndices: canonical.length, updates: 0 };
    let previous = '';
    const select = (renderer, camera) => {
        const frustum = cameraFrustum(camera, renderer.coordinateSystem);
        if (!boundsMatrix.equals(mesh.matrixWorld)) updateWorldBounds();
        const visible = Array(chunks.length).fill(false);
        for (const cell of cells) {
            if (!frustum.intersectsBox(cell.worldBox)) continue;
            for (let i = cell.first; i < cell.end; i++) visible[i] = chunks[i] === cell || frustum.intersectsBox(chunks[i].worldBox);
        }
        const key = visible.map(v => v ? '1' : '0').join('');
        let count = 0;
        if (key !== previous) {
            let runStart = -1, runEnd = 0;
            const flush = () => {
                if (runStart < 0) return;
                output.array.set(canonical.subarray(runStart, runEnd), count); count += runEnd - runStart; runStart = -1;
            };
            for (let i = 0; i < chunks.length; i++) if (visible[i]) {
                const part = chunks[i];
                if (runStart >= 0 && part.start === runEnd) runEnd += part.count;
                else { flush(); runStart = part.start; runEnd = part.start + part.count; }
            }
            flush();
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
