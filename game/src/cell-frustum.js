import * as THREE from '../vendor/three.module.min.js';

const cameraFrusta = new WeakMap();
function cameraFrustum(camera, coordinateSystem) {
    let cached = cameraFrusta.get(camera);
    if (!cached) {
        cached = { projection: new THREE.Matrix4(), inverse: new THREE.Matrix4(), matrix: new THREE.Matrix4(), frustum: new THREE.Frustum(), planes: new Float64Array(24), ready: false };
        cameraFrusta.set(camera, cached);
    }
    if (!cached.ready || cached.coordinateSystem !== coordinateSystem || !cached.projection.equals(camera.projectionMatrix) || !cached.inverse.equals(camera.matrixWorldInverse)) {
        cached.projection.copy(camera.projectionMatrix); cached.inverse.copy(camera.matrixWorldInverse);
        cached.frustum.setFromProjectionMatrix(cached.matrix.multiplyMatrices(cached.projection, cached.inverse), coordinateSystem);
        for (let i = 0; i < 6; i++) { const p = cached.frustum.planes[i], k = i * 4; cached.planes[k] = p.normal.x; cached.planes[k + 1] = p.normal.y; cached.planes[k + 2] = p.normal.z; cached.planes[k + 3] = p.constant; }
        cached.coordinateSystem = coordinateSystem; cached.ready = true;
    }
    return cached.planes;
}

// Same positive-vertex plane test as THREE.Frustum.intersectsBox, using cached
// doubles and reusable masks so frame selection creates no bounds/key arrays.
function intersects(bounds, offset, planes) {
    for (let p = 0; p < 24; p += 4) {
        const nx = planes[p], ny = planes[p + 1], nz = planes[p + 2];
        if (nx * bounds[offset + (nx > 0 ? 3 : 0)] + ny * bounds[offset + (ny > 0 ? 4 : 1)] + nz * bounds[offset + (nz > 0 ? 5 : 2)] + planes[p + 3] < 0) return false;
    }
    return true;
}
function writeBounds(array, offset, box) { box.min.toArray(array, offset); box.max.toArray(array, offset + 3); }

// Merged static meshes keep their original cell spans. Reject only complete
// spans outside the current camera, preserving every attribute and index order.
export function cullMergedCells(mesh, parts, { blockTriangles = 0 } = {}) {
    if (!parts.length || (parts.length < 2 && !(blockTriangles > 0 && parts[0].count > Math.max(64, blockTriangles) * 3)) || !mesh.geometry.index || mesh.geometry.groups.length) return null;
    const geometry = mesh.geometry, sourceIndex = geometry.index, canonical = sourceIndex.array, sourceRange = { ...geometry.drawRange };
    const output = new THREE.BufferAttribute(canonical.slice(), 1).setUsage(THREE.DynamicDrawUsage);
    const blockSize = Number.isFinite(blockTriangles) && blockTriangles > 0 ? Math.max(64, Math.floor(blockTriangles)) : 0;
    const maxIndices = blockSize * 3, leafCount = parts.reduce((n, p) => n + (maxIndices && p.count > maxIndices ? Math.ceil(p.count / maxIndices) : 1), 0);
    const ranges = new Uint32Array(leafCount * 2), localCoarse = new Float64Array(parts.length * 6);
    const localFine = leafCount === parts.length ? localCoarse : new Float64Array(leafCount * 6);
    const cells = [], point = new THREE.Vector3(), box = new THREE.Box3();
    let childBoxes = 0, leaf = 0;
    for (let p = 0; p < parts.length; p++) {
        const part = parts[p], first = leaf;
        box.min.fromArray(part.bounds); box.max.fromArray(part.bounds, 3); box.expandByScalar(0.01); writeBounds(localCoarse, p * 6, box);
        if (maxIndices > 0 && part.count > maxIndices) {
            // Static preprocessing only: bounded contiguous index blocks retain
            // every original triangle and its order. No per-triangle frame work.
            for (let start = part.start; start < part.start + part.count; start += maxIndices) {
                const count = Math.min(maxIndices, part.start + part.count - start); box.makeEmpty();
                for (let i = start; i < start + count; i++) box.expandByPoint(point.fromBufferAttribute(geometry.attributes.position, canonical[i]));
                writeBounds(localFine, leaf * 6, box.expandByScalar(0.01)); ranges[leaf * 2] = start; ranges[leaf * 2 + 1] = count; leaf++; childBoxes++;
            }
        } else { if (localFine !== localCoarse) writeBounds(localFine, leaf * 6, box); ranges[leaf * 2] = part.start; ranges[leaf * 2 + 1] = part.count; leaf++; }
        cells.push({ first, end: leaf });
    }
    const worldCoarse = new Float64Array(localCoarse.length), worldFine = localFine === localCoarse ? worldCoarse : new Float64Array(localFine.length), boundsMatrix = mesh.matrixWorld.clone();
    const updateWorldBounds = () => {
        for (const [local, world] of localFine === localCoarse ? [[localCoarse, worldCoarse]] : [[localCoarse, worldCoarse], [localFine, worldFine]]) {
            for (let i = 0; i < local.length; i += 6) { box.min.fromArray(local, i); box.max.fromArray(local, i + 3); writeBounds(world, i, box.applyMatrix4(mesh.matrixWorld)); }
        }
        boundsMatrix.copy(mesh.matrixWorld);
    };
    updateWorldBounds();
    geometry.setIndex(output);
    const visible = new Uint8Array(leafCount), previous = new Uint8Array(leafCount);
    const localBoundsBytes = localCoarse.byteLength + (localFine === localCoarse ? 0 : localFine.byteLength), worldBoundsBytes = worldCoarse.byteLength + (worldFine === worldCoarse ? 0 : worldFine.byteLength);
    const debug = mesh.userData.cellFrustum = { sourceIndices: canonical.length, sourceComponents: cells.length, components: leafCount, childBoxes, worldBoxes: worldBoundsBytes / 48, blockTriangles: blockSize, localBoundsBytes, worldBoundsBytes, typedMetadataBytes: localBoundsBytes + worldBoundsBytes + ranges.byteLength + visible.byteLength + previous.byteLength, visibleIndices: canonical.length, updates: 0 };
    let previousValid = false, selectedCount = 0;
    const select = (renderer, camera) => {
        const planes = cameraFrustum(camera, renderer.coordinateSystem);
        if (!boundsMatrix.equals(mesh.matrixWorld)) updateWorldBounds();
        visible.fill(0);
        for (let c = 0; c < cells.length; c++) {
            if (!intersects(worldCoarse, c * 6, planes)) continue;
            const cell = cells[c];
            for (let i = cell.first; i < cell.end; i++) visible[i] = cell.end - cell.first === 1 || intersects(worldFine, i * 6, planes) ? 1 : 0;
        }
        let changed = !previousValid;
        if (!changed) for (let i = 0; i < leafCount; i++) if (visible[i] !== previous[i]) { changed = true; break; }
        if (changed) {
            selectedCount = 0;
            let runStart = -1, runEnd = 0;
            for (let i = 0; i < leafCount; i++) if (visible[i]) {
                const start = ranges[i * 2], count = ranges[i * 2 + 1];
                if (runStart >= 0 && start === runEnd) runEnd += count;
                else {
                    if (runStart >= 0) { output.array.set(canonical.subarray(runStart, runEnd), selectedCount); selectedCount += runEnd - runStart; }
                    runStart = start; runEnd = start + count;
                }
            }
            if (runStart >= 0) { output.array.set(canonical.subarray(runStart, runEnd), selectedCount); selectedCount += runEnd - runStart; }
            if (selectedCount) { output.clearUpdateRanges(); output.addUpdateRange(0, selectedCount); output.needsUpdate = true; }
            previous.set(visible); previousValid = true; debug.updates++;
        }
        geometry.setDrawRange(0, selectedCount); debug.visibleIndices = selectedCount;
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
