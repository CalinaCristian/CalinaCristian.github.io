// Shared read-only geometry encoding. The factory is serializable into page.evaluate.
module.exports = function geometryKernel() {
    const geometries = {}, refs = new WeakMap(); let serial = 0, epoch = 0;
    function typed(array) {
        if (!ArrayBuffer.isView(array)) return null;
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let base64;
        if (typeof Buffer !== 'undefined') base64 = Buffer.from(bytes).toString('base64');
        else { const chunks = []; for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384))); base64 = btoa(chunks.join('')); }
        return { type: array.constructor.name, length: array.length, byteLength: array.byteLength, base64, byteOrder: new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 'little-endian' : 'big-endian' };
    }
    function attribute(a) {
        if (!a) return null;
        return { itemSize: a.itemSize, count: a.count, normalized: !!a.normalized, usage: a.usage ?? a.data?.usage ?? null, version: a.version ?? a.data?.version ?? null,
            interleaved: !!a.isInterleavedBufferAttribute, stride: a.isInterleavedBufferAttribute ? a.data.stride : a.itemSize, offset: a.isInterleavedBufferAttribute ? a.offset : 0,
            nativeAttributeType: a.constructor.name, isFloat16BufferAttribute: !!a.isFloat16BufferAttribute,
            meshPerAttribute: a.meshPerAttribute ?? a.data?.meshPerAttribute ?? null, array: typed(a.isInterleavedBufferAttribute ? a.data.array : a.array) };
    }
    function geometry(g) {
        if (!g) return null;
        const previous = refs.get(g); if (previous?.epoch === epoch) return previous.id;
        const record = { type: g.type, name: g.name, isInstancedBufferGeometry: !!g.isInstancedBufferGeometry, instanceCount: Number.isFinite(g.instanceCount) ? g.instanceCount : null,
            attributes: Object.fromEntries(Object.entries(g.attributes || {}).map(([k, a]) => [k, attribute(a)])), index: attribute(g.index), groups: (g.groups || []).map(v => ({ ...v })),
            drawRange: { start: g.drawRange?.start ?? 0, count: Number.isFinite(g.drawRange?.count) ? g.drawRange.count : null, countIsUnbounded: !Number.isFinite(g.drawRange?.count) },
            morphAttributes: Object.fromEntries(Object.entries(g.morphAttributes || {}).map(([k, list]) => [k, list.map(attribute)])), morphTargetsRelative: !!g.morphTargetsRelative,
            nativeBoundingBox: g.boundingBox ? safe({ min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() }) : null,
            nativeBoundingSphere: g.boundingSphere ? safe({ center: g.boundingSphere.center.toArray(), radius: g.boundingSphere.radius }) : null };
        if (previous && JSON.stringify(previous.record) === JSON.stringify(record)) { previous.epoch = epoch; return previous.id; }
        const id = (g.uuid || 'geometry') + '@capture-' + (++serial); refs.set(g, { id, epoch, record }); geometries[id] = { id, ...record };
        return id;
    }
    const transform = (p, m) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
    function frame(o) {
        return { uuid: o.uuid, name: o.name, type: o.type, parentUuid: o.parent?.uuid || null, position: o.position.toArray(), quaternion: o.quaternion.toArray(), rotation: o.rotation.toArray(), scale: o.scale.toArray(),
            matrix: o.matrix.toArray(), matrixWorld: o.matrixWorld.toArray(), matrixAutoUpdate: o.matrixAutoUpdate, visible: o.visible, layers: o.layers.mask };
    }
    function parents(o) { const list = []; for (let p = o; p; p = p.parent) list.push(frame(p)); return list; }
    function mesh(o) {
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        return { ...frame(o), parentChain: parents(o), geometryId: geometry(o.geometry), isInstancedMesh: !!o.isInstancedMesh, count: o.count ?? null,
            instanceMatrix: attribute(o.instanceMatrix), instanceColor: attribute(o.instanceColor), castShadow: o.castShadow, receiveShadow: o.receiveShadow, frustumCulled: o.frustumCulled, renderOrder: o.renderOrder,
            materials: list.map(m => ({ uuid: m.uuid, name: m.name, type: m.type, visible: m.visible, side: m.side, transparent: m.transparent, opacity: m.opacity, depthTest: m.depthTest, depthWrite: m.depthWrite, wireframe: !!m.wireframe })),
            morphTargetInfluences: o.morphTargetInfluences ? [...o.morphTargetInfluences] : null, isSkinnedMesh: !!o.isSkinnedMesh,
            skeleton: o.skeleton ? { boneMatrices: typed(o.skeleton.boneMatrices), bones: o.skeleton.bones.map(frame), bindMatrix: o.bindMatrix.toArray(), bindMatrixInverse: o.bindMatrixInverse.toArray() } : null };
    }
    function safe(value, seen = new WeakMap(), path = '$') {
        if (value === undefined) return { $undefined: true };
        if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
        if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
        if (typeof value === 'function') return { $function: String(value) };
        if (typeof value !== 'object') return { $type: typeof value, value: String(value) };
        if (seen.has(value)) return { $ref: seen.get(value) }; seen.set(value, path);
        if (value.isObject3D) return { $object3D: value.uuid, name: value.name, type: value.type };
        if (value.isBufferGeometry) return { $geometry: geometry(value) };
        if (ArrayBuffer.isView(value)) return { $typed: typed(value) };
        if (value instanceof Map) return { $map: [...value].map(([k, v], i) => [safe(k, seen, path + '.key' + i), safe(v, seen, path + '.value' + i)]) };
        if (value instanceof Set) return { $set: [...value].map((v, i) => safe(v, seen, path + '.' + i)) };
        if (Array.isArray(value)) return value.map((v, i) => safe(v, seen, path + '.' + i));
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v, seen, path + '.' + k)]));
    }
    function bounds(g, matrix) {
        const p = g?.attributes?.position; if (!p?.count) return { known: false, reason: 'missing-or-empty-position' };
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let finite = true;
        for (let i = 0; i < p.count; i++) { const q = transform([p.getX(i), p.getY(i), p.getZ(i)], matrix); for (let j = 0; j < 3; j++) { finite &&= Number.isFinite(q[j]); min[j] = Math.min(min[j], q[j]); max[j] = Math.max(max[j], q[j]); } }
        return { known: finite, min, max, vertices: p.count };
    }
    return { typed, attribute, geometry, geometries, transform, frame, parents, mesh, safe, bounds, nextEpoch: () => { epoch++; } };
};
