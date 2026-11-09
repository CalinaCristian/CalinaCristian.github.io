// Inject this read-only function into a future exact-source native page.
// Query the explicitly identified source edge, never nearest/lowest road.
module.exports = function sampleNativeProfiles(world, queries) {
    const bySource = new Map();
    for (const e of world.allEdges) {
        const source = world.data.roadSourceGeometry?.[e.road]; if (!source?.sourceId) continue;
        if (!bySource.has(source.sourceId)) bySource.set(source.sourceId, []);
        bySource.get(source.sourceId).push(e);
    }
    const result = [];
    for (const query of queries) {
        const matches = [];
        for (const e of bySource.get(query.sourceId) || []) {
            if (!Number.isFinite(e.len) || e.len <= 0) continue; // explicit-edge World API must not fall back to nearest
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L = dx * dx + dz * dz;
            if (!(L > 0)) continue;
            const t = ((query.x - e.a.x) * dx + (query.z - e.a.z) * dz) / L;
            if (t < -1e-9 || t > 1 + 1e-9 || Math.hypot(query.x - e.a.x - t * dx, query.z - e.a.z - t * dz) > 1e-6) continue;
            // At a loop/crossing preserve every same-source candidate and its
            // height. Do not choose the closest value to the old model.
            const roadSurfaceM = world.roadHeight(query.x, query.z, e);
            matches.push({ edgeId: e.id, roadSurfaceM, modelDepthM: roadSurfaceM - .24,
                sourceNodeIds: [e.a.sourceId ?? null, e.b.sourceId ?? null],
                sourceTags: world.data.roadSourceGeometry[e.road].tags, sourceBridgeGrade: e.sourceBridgeGrade?.known ? { modelId: e.sourceBridgeGrade.modelId, basis: e.sourceBridgeGrade.basis } : null,
                coveredRoadModel: e.coveredRoadModel ? { id: e.coveredRoadModel.id, floorY: e.coveredRoadModel.floorY } : null });
        }
        result.push({ ...query, matches, unresolved: !matches.length ? 'literal-source-station-not-retained' : matches.some(r => !Number.isFinite(r.roadSurfaceM)) ? 'nonfinite-native-source-height' : new Set(matches.map(r => r.roadSurfaceM)).size > 1 ? 'ambiguous-native-source-level' : null });
    }
    return { scope: 'Actual native world.roadHeight(x,z,explicitEdge); no nearest-road fallback, interpolation substitute, source/profile/actor/clock mutation or zero fill', results: result };
};
