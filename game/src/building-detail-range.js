import { clipInferredBuildingDetail } from './building-detail-visibility.js';

// Call only around an inferred emitter. Read the actual emitted Float32 positions
// and preserve normals, UVs, colours and tile IDs through the same planar splits.
// Earlier source faces and other buildings' index/attribute prefixes stay exact.
export function clipBuildingDetailRange(builder, start, owner, neighbours) {
    if (builder.ic === start.ic) return { clippedAreaM2: 0, issues: [], triangles: 0 };
    const read = k => [...builder.p.subarray(k * 3, k * 3 + 3), ...builder.n.subarray(k * 3, k * 3 + 3), ...builder.u.subarray(k * 2, k * 2 + 2), ...builder.c.subarray(k * 3, k * 3 + 3), builder.t ? builder.t[k] : -1];
    const faces = [];
    for (let i = start.ic; i < builder.ic; i += 3) faces.push([read(builder.i[i]), read(builder.i[i + 1]), read(builder.i[i + 2])]);
    const others = typeof neighbours === 'function' ? neighbours(faces) : neighbours;
    const result = clipInferredBuildingDetail(faces, owner, others, { inferred: true });
    if (result.clippedAreaM2 > 1e-10) {
        builder.ic = start.ic; builder.vc = start.vc;
        for (const face of result.faces) {
            const ids = face.map(p => builder.v(...p.slice(0, 8), p.slice(8, 11), p[11]));
            builder.tri(...ids);
        }
    }
    return { clippedAreaM2: result.clippedAreaM2, issues: result.issues, triangles: (builder.ic - start.ic) / 3 };
}
