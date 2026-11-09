// Read the native retained flat-surface triangles. Nothing here mutates,
// deletes, lifts or recolors source geometry.
import { clipConvex, polygonArea } from './bridge-profile-geometry.js';
import { subtractTramTrench } from './tram-trench.js';
const EPS = 1e-9;
const bounds = p => ({ x0: Math.min(...p.map(v => v[0])), x1: Math.max(...p.map(v => v[0])), z0: Math.min(...p.map(v => v[1])), z1: Math.max(...p.map(v => v[1])) });
const overlaps = (a, b) => a.x1 >= b.x0 && a.x0 <= b.x1 && a.z1 >= b.z0 && a.z0 <= b.z1;

export function buildUnderpassOwnerIndex(surfaces, { fallbackM, size = 64, regions = null } = {}) {
    const cells = new Map(); let triangles = 0, malformed = 0;
    for (const { mesh, id, water = false } of surfaces) {
        if (!mesh || !Number.isFinite(mesh.ic) || !mesh.p || !mesh.i) { malformed++; continue; }
        for (let k = 0; k < mesh.ic; k += 3) {
            const vertices = [0, 1, 2].map(j => Array.from(mesh.p.subarray(mesh.i[k + j] * 3, mesh.i[k + j] * 3 + 3)));
            if (!vertices.flat().every(Number.isFinite)) { malformed++; continue; }
            const [a, b, c] = vertices, den = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
            // Only upward-facing native skins supply an overhead ground band.
            if (den >= -EPS) continue;
            const poly = vertices.map(p => [p[0], p[2]]), box = bounds(poly);
            if (regions && !regions.some(r => overlaps(box, r))) continue;
            const row = { id: `${id}:${k / 3}`, vertices, poly, box, water,
                heightAt: (x, z) => { const u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / den,
                    v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / den;
                    return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]); } };
            // A sunken carriageway is not its own earth cover.
            if (!water && Math.min(...vertices.map(p => p[1])) < fallbackM - EPS) continue;
            triangles++;
            for (let i = Math.floor(box.x0 / size); i <= Math.floor(box.x1 / size); i++) for (let j = Math.floor(box.z0 / size); j <= Math.floor(box.z1 / size); j++) {
                const key = i + ',' + j; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(row);
            }
        }
    }
    const forPolygon = poly => {
        if (!poly?.length || !poly.flat().every(Number.isFinite) || !Number.isFinite(fallbackM)) return { known: false, reason: 'invalid-native-ground-footprint' };
        if (malformed) return { known: false, reason: 'malformed-native-surface-data', malformed };
        const box = bounds(poly), nearby = new Set();
        for (let i = Math.floor(box.x0 / size); i <= Math.floor(box.x1 / size); i++) for (let j = Math.floor(box.z0 / size); j <= Math.floor(box.z1 / size); j++) for (const row of cells.get(i + ',' + j) || []) if (overlaps(box, row.box)) nearby.add(row);
        let remaining = [poly.map(p => [p[0], 0, p[1]])], topM = Infinity; const bands = [], waters = [];
        for (const row of nearby) {
            const intersection = clipConvex(poly, row.poly); if (intersection.length < 3 || polygonArea(intersection) <= EPS) continue;
            const heights = intersection.map(p => row.heightAt(...p));
            if (row.water) { waters.push({ id: row.id, minY: Math.min(...heights), maxY: Math.max(...heights), intersection }); continue; }
            topM = Math.min(topM, ...heights);
            bands.push({ id: row.id, minY: Math.min(...heights), maxY: Math.max(...heights), areaM2: polygonArea(intersection) });
            remaining = remaining.flatMap(p => subtractTramTrench(p, row.poly));
            if (remaining.length > 256) return { known: false, reason: 'native-ground-union-complexity', bands, waters };
        }
        // The final water renderer changes/subdivides/drops raw water skins.
        // Without its final retained topology, never put an opaque roof above
        // transparent water based on renderOrder or a guessed height shift.
        if (waters.length) return { known: false, reason: 'retained-water-topology-unresolved', bands, waters };
        const fallbackAreaM2 = remaining.reduce((sum, p) => sum + polygonArea(p.map(v => [v[0], v[2]])), 0);
        if (fallbackAreaM2 > EPS || !Number.isFinite(topM)) topM = Math.min(topM, fallbackM);
        return { known: true, topM, bands, fallbackAreaM2, fallbackM,
            basis: 'minimum actual native overlapping overhead skin band; uncovered remainder uses the unchanged emitted groundPlane datum, not surveyed earth' };
    };
    return { forPolygon, report: { nativeTriangles: triangles, malformed, fallbackM, regions: regions?.length ?? null, waterTopology: 'raw native water skins conservatively unresolved until final retained export' } };
}
