import { pointInPolygon } from './util.js';

// The detailed rendered basin and the coarse landuse water may differ.
// Resolve trunk centres against the detailed source ring without a bank buffer.
// Keep the source records and report each physical conflict independently of LOD.
export function sourceWaterTreeConflicts(trees, footprints) {
    const basins = footprints.map(a => ({ ...a, x0: Math.min(...a.ring.map(p => p[0])), x1: Math.max(...a.ring.map(p => p[0])), z0: Math.min(...a.ring.map(p => p[1])), z1: Math.max(...a.ring.map(p => p[1])) }));
    const excluded = new Set(), records = [];
    for (const tree of trees) {
        const owners = basins.filter(a => tree.x >= a.x0 && tree.x <= a.x1 && tree.z >= a.z0 && tree.z <= a.z1 && pointInPolygon(tree.x, tree.z, a.ring));
        if (!owners.length) continue;
        excluded.add(tree);
        records.push({ x: tree.x, z: tree.z, kind: tree.kind, sourceIds: owners.map(a => a.sourceId), reason: 'trunk-centre-inside-detailed-source-basin' });
    }
    return { excluded, records };
}
