import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildTramTunnelGrades } from '../../../../game/src/tram-tunnel-grade.js';

const input = process.argv[2], builder = process.argv[3];
if (!input || !builder) throw new Error('Pass immutable native constructor-facts.json and shared tram-grade.js path');
const { buildTramGrades } = await import(pathToFileURL(builder));
const bytes = fs.readFileSync(input), native = JSON.parse(bytes), tunnel = buildTramTunnelGrades(native.data, { coreEdges: native.allEdges });
const halfWidthOverrideM = Number(process.argv[4]) || null;
if (halfWidthOverrideM) for (const grade of tunnel.grades.values()) grade.deckHalfWidthM = halfWidthOverrideM;
const model = buildTramGrades(native.data, { coreEdges: native.allEdges, models: [], extraGrades: tunnel.grades, extraReport: tunnel.report });
const area2 = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0);
function clip(subject, boundary) {
    let poly = subject.slice(); const sign = Math.sign(area2(boundary));
    for (let k = 0; k < boundary.length && poly.length; k++) {
        const a = boundary[k], b = boundary[(k + 1) % boundary.length], value = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
        const output = [];
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], u = value(p), v = value(q);
            if (u >= -1e-8) output.push(p);
            if ((u >= 0) !== (v >= 0)) { const t = u / (u - v); output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
        }
        poly = output;
    }
    return poly;
}
const overlaps = [], intersections = [], motorCorridorOverlaps = [], carTubes = new Set(['w27008403', 'w241374324', 'w241374325', 'w241374327', 'w669751868', 'w669751870', 'w669751871']);
for (const piece of model.support.pieces) for (const ribbon of native.ribbons) {
    const edge = ribbon.edge; if (!edge || edge.virtual || !ribbon.poly?.length) continue;
    const poly = clip(piece.poly, ribbon.poly); if (poly.length < 3 || Math.abs(area2(poly)) < 1e-7) continue;
    const a = piece.a, b = piece.b, dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const gaps = poly.map(([x, z]) => {
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), y = .2 + piece.y0 + (piece.y1 - piece.y0) * t;
        const u = Math.max(0, Math.min(1, ((x - edge.a.x) * edge.dirx + (z - edge.a.z) * edge.dirz) / edge.len)), roadY = .24 + edge.ya + (edge.yb - edge.ya) * u;
        return { x, z, floorTop: y, floorBottom: y - .35, roadY, roadMinusFloorTopM: roadY - y };
    });
    const low = Math.min(...gaps.map(g => g.roadMinusFloorTopM)), high = Math.max(...gaps.map(g => g.roadMinusFloorTopM));
    const record = { railSourceId: piece.sourceId, roadSourceId: edge.sourceId, edgeId: edge.id, areaM2: Math.abs(area2(poly)) / 2, gapRangeM: [low, high], vertices: gaps };
    overlaps.push(record);
    // Exact positive-area overlap and crossing of the rendered slab's complete
    // vertical band. Ground ballast is the pre-existing source rail datum.
    if (low < -1e-7 && high > -.35 + 1e-7) intersections.push(record);
    if (carTubes.has(edge.sourceId)) motorCorridorOverlaps.push(record);
}
const report = { scope: 'CPU intersection of composed literal rail floor quads and immutable native road ribbon polygons/profiles; no browser or current-root acceptance',
    nativeSourceCommit: '6cbf82b61de8267f662bf50239c37ccc1764635c', nativeInputSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    sharedBuilderSha256: crypto.createHash('sha256').update(fs.readFileSync(builder)).digest('hex'), halfWidthOverrideM, sourceModel: tunnel.report,
    floorPieces: model.support.pieces.length, roadPositiveAreaOverlaps: overlaps.length, slabRoadSurfaceIntersections: intersections.length, adjacentCarTubePositiveAreaOverlaps: motorCorridorOverlaps.length,
    intersections, adjacentCarTubeOverlaps: motorCorridorOverlaps, allOverlaps: overlaps };
console.log(JSON.stringify(report, null, 2));
// Horizontal overlap can be a lower rail bed beneath retained motor asphalt.
// Keep every overlap visible; actual mesh/corridor clearance is checked by the
// separate posed-body tool, rather than declaring that XY alone is contact.
if (intersections.length) process.exitCode = 1;
