import { pointInPolygon, distPointSeg } from './util.js';

// The detailed rendered basin and the coarse landuse water may differ.
// Resolve actual trunk bodies against the rendered basin, including its granite rim.
// Keep the source records and report each physical conflict independently of LOD.
export function sourceWaterTreeConflicts(trees, footprints, bodyForTree = () => null) {
    const basins = footprints.map(a => ({ ...a, x0: Math.min(...a.ring.map(p => p[0])), x1: Math.max(...a.ring.map(p => p[0])), z0: Math.min(...a.ring.map(p => p[1])), z1: Math.max(...a.ring.map(p => p[1])) }));
    const excluded = new Set(), records = [];
    for (const tree of trees) {
        const radiusM = Math.max(0, bodyForTree(tree)?.r || 0);
        const owners = basins.filter(a => tree.x + radiusM >= a.x0 && tree.x - radiusM <= a.x1 && tree.z + radiusM >= a.z0 && tree.z - radiusM <= a.z1 &&
            (pointInPolygon(tree.x, tree.z, a.ring) || a.ring.some((p, i) => {
                const q = a.ring[(i + 1) % a.ring.length];
                return distPointSeg(tree.x, tree.z, p[0], p[1], q[0], q[1]).d <= radiusM;
            })));
        if (!owners.length) continue;
        excluded.add(tree);
        records.push({ x: tree.x, z: tree.z, kind: tree.kind, radiusM, sourceIds: owners.map(a => a.sourceId), reason: 'trunk-body-intersects-rendered-source-basin' });
    }
    return { excluded, records };
}
