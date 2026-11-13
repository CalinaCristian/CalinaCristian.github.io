// Reviewed physical tree exclusions: a source crown (aerial measurement compiled into the district pack as `kind: 'osm'`
// without an OSM tree node) that a street-level review shows does not stand where it was measured. The source record stays
// in the pack; the generated tree is listed and left out after generation, like the basin / tram conflicts in world.js, so
// every retained tree keeps its rotation, colour and random stream. Each entry names its evidence (official panorama pose,
// looked at only; nothing stored or traced). Match: the nearest source crown within `radiusM` of the reviewed point.
export const REVIEWED_TREE_EXCLUSIONS = [
    // (r3-landmarks-4) Statuia Lascăr Catargiu, Bd. Lascăr Catargiu: the measured crown ≈ 11 m south-east of the statue stood on
    // the open paved island in front of it and hid the figure; the official panorama at 44.448932, 26.093057 heading 331 shows
    // the island open (no tree between the camera and the statue). The street trees along the island edges are kept.
    { district: 'romana', lat: 44.449049, lon: 26.093009, radiusM: 2, kind: 'osm', review: 'official panorama 44.448932, 26.093057 h331 (r3-landmarks-4)' },
];

/** the trees of treeList (objects with x, z, kind) that a reviewed exclusion removes, for district distId */
export function reviewedTreeExclusions(treeList, proj, distId) {
    const out = new Set();
    for (const r of REVIEWED_TREE_EXCLUSIONS) {
        if (r.district !== distId) continue;
        const p = proj(r.lat, r.lon); let best = null, bd = r.radiusM;
        for (const t of treeList) { if (r.kind && t.kind !== r.kind) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d <= bd) { bd = d; best = t; } }
        if (best) out.add(best);
    }
    return out;
}
