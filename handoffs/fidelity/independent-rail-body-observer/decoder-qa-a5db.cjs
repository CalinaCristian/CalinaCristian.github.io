// Independent consumption of exact native buffers. No runtime rail/fit/helper imports.
const crypto = require('node:crypto');
const types = { Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array };
function decodeTyped(record) {
    if (!record || !types[record.type]) throw Error('Unsupported native typed array ' + record?.type);
    const bytes = Buffer.from(record.base64, 'base64'), T = types[record.type];
    if (bytes.byteLength !== record.byteLength || bytes.byteLength !== record.length * T.BYTES_PER_ELEMENT) throw Error('Native typed-array length mismatch');
    const hostLittle = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
    if ((record.byteOrder === 'little-endian') !== hostLittle && T.BYTES_PER_ELEMENT > 1) throw Error('Unsupported native byte order');
    const copy = Uint8Array.from(bytes); return new T(copy.buffer, 0, record.length);
}
function attribute(record) {
    if (!record?.array) return null; if (record.isFloat16BufferAttribute) throw Error('Float16 native attribute needs explicit decoding');
    const array = decodeTyped(record.array), stride = record.stride || record.itemSize, offset = record.offset || 0;
    if (record.count && (record.count - 1) * stride + offset + record.itemSize > array.length) throw Error('Native attribute range exceeds backing buffer');
    return { array, count: record.count, itemSize: record.itemSize, get: i => Array.from({ length: record.itemSize }, (_, j) => array[i * stride + offset + j]),
        normalized: record.normalized, interleaved: record.interleaved, stride, offset };
}
const transform = (p, m) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
function multiply(a, b) { const c = Array(16).fill(0); for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) c[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]; return c; }
function geometryPart(g, matrixWorld) {
    const positions = attribute(g.attributes.position), index = attribute(g.index);
    if (!positions || positions.itemSize < 3 || positions.normalized) throw Error('Unsupported/missing native position attribute');
    return { positions, indices: index ? index.array : null, drawRange: g.drawRange, groups: g.groups, matrixWorld, geometryId: g.id };
}
function* triangles(part, { respectDrawRange = false } = {}) {
    const total = part.indices ? part.indices.length : part.positions.count, start = respectDrawRange ? part.drawRange.start : 0;
    const end = respectDrawRange && !part.drawRange.countIsUnbounded ? Math.min(total, start + part.drawRange.count) : total;
    if (start % 3 || (end - start) % 3) throw Error('Unsupported non-triangle-aligned native draw range');
    for (let i = start; i + 2 < end; i += 3) yield { triangle: i / 3, vertices: [0, 1, 2].map(j => transform(part.positions.get(part.indices ? part.indices[i + j] : i + j), part.matrixWorld)) };
}
function meshParts(scene, object) {
    const g = scene.geometries[object.geometryId]; if (!g) throw Error('Missing exact native geometry ' + object.geometryId);
    if (object.isSkinnedMesh || object.morphTargetInfluences?.some(x => x !== 0)) throw Error('Skinned/active-morph native geometry needs explicit deformation audit');
    if (!object.isInstancedMesh) return [geometryPart(g, object.matrixWorld)];
    const instance = attribute(object.instanceMatrix), out = [];
    for (let i = 0; i < object.count; i++) out.push({ ...geometryPart(g, multiply(object.matrixWorld, instance.get(i))), instance: i });
    return out;
}
function integrity(scene) {
    return Object.values(scene.geometries).flatMap(g => [...Object.entries(g.attributes), ['index', g.index]].filter(([, a]) => a).map(([name, a]) => {
        const bytes = Buffer.from(a.array.base64, 'base64'); decodeTyped(a.array); return { geometryId: g.id, attribute: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    }));
}
module.exports = { decodeTyped, attribute, transform, multiply, geometryPart, triangles, meshParts, integrity };
