// The generic shelter UNIT has no source roof geometry. Vehicle stop positions
// cannot locate it. This decision never owns/removes a mapped source object.
const sourceRef = m => m && ['node', 'way', 'relation'].includes(m.type) ? (m.type === 'node' ? 'n' : m.type === 'way' ? 'w' : 'r') + m.ref : null;
const negative = t => t?.shelter === 'no';
const point = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
export function sourceTransitShelterDecision(data, poiIndex) {
    const catalogue = data.publicTransportSources, source = catalogue?.poiSources?.[poiIndex];
    const legacy = reason => ({ emitInferred: true, status: 'legacy-unreviewed', poiIndex, sourceId: source?.sourceId || null, reason,
        ownership: 'This decision controls only the unmapped generic shelter unit; mapped source geometry remains independently owned.' });
    if (!source) return legacy('source-metadata-unavailable');
    const coverage = catalogue.coverage, row = data.pois?.[poiIndex];
    if (catalogue.schema !== 1 || !Array.isArray(coverage?.sourceFiles) || !coverage.sourceFiles.length || coverage.sourceFiles.some(f => !f?.file || !/^[a-f\d]{64}$/.test(f.sha256 || '')) || !/^[a-f\d]{64}$/.test(coverage.sourceSetSha256 || '')) return legacy('source-provenance-unverified');
    if (!row || data.poiKinds?.[row[0]] !== 'busstop' || !/^n\d+$/.test(source.sourceId || '') || !Array.isArray(source.nodeIds) || source.nodeIds.length !== 1 || source.sourceId !== 'n' + source.nodeIds[0] || !Array.isArray(source.points) || source.points.length !== 1 || !point(source.points[0]) || Math.round(source.points[0][0] * 10) !== row[1] || Math.round(source.points[0][1] * 10) !== row[2] || !source.tags || typeof source.tags !== 'object') return legacy('source-poi-anchor-unverified');
    const tags = source.tags, vehicle = tags.public_transport === 'stop_position' || tags.railway === 'tram_stop';
    if (!vehicle && !negative(tags)) return legacy('ordinary-passenger-stop-generic-model-unreviewed');
    const associations = [], platforms = Array.isArray(catalogue.platforms) ? catalogue.platforms : [], stopAreas = Array.isArray(catalogue.stopAreas) ? catalogue.stopAreas : [];
    for (const area of stopAreas) {
        if (!['stop_area', 'stop_area_group'].includes(area?.tags?.public_transport) || !Array.isArray(area.members) || !area.members.some(m => sourceRef(m) === source.sourceId)) continue;
        for (const m of area.members) {
            const platform = platforms.find(p => p?.sourceId === sourceRef(m));
            if (platform) associations.push({ platformSourceId: platform.sourceId, association: 'literal-stop-area-member', relationSourceId: area.sourceId, shelter: platform.tags?.shelter ?? null,
                geometry: 'Platform geometry is retained, not a validated shelter roof footprint/station/dimensions.' });
        }
    }
    // Nearby same-name platforms are reported, never used as a roof station.
    if (tags.name) for (const platform of platforms) {
        if (platform?.tags?.name !== tags.name || !Array.isArray(platform.points) || !platform.points.some(p => point(p) && Math.hypot(p[0] - source.points[0][0], p[1] - source.points[0][1]) <= 160) || associations.some(a => a.platformSourceId === platform.sourceId)) continue;
        associations.push({ platformSourceId: platform.sourceId, association: 'nearby-same-name-association-unverified', shelter: platform.tags?.shelter ?? null,
            geometry: 'No nearest-platform, centroid or half-arclength placement is adopted.' });
    }
    return { emitInferred: false, status: negative(tags) ? 'literal-no-shelter' : 'unknown-shelter-geometry', poiIndex, sourceId: source.sourceId,
        sourcePoint: [...source.points[0]], sourceSetSha256: coverage.sourceSetSha256,
        sourcePurpose: vehicle ? 'vehicle-stop-position' : 'literal-passenger-stop-negative', literalShelter: tags.shelter ?? null,
        shelterExistence: negative(tags) ? 'literal-no' : tags.shelter === 'yes' ? 'literal-yes-geometry-unknown' : associations.some(a => a.shelter === 'yes') ? 'nearby-or-associated-platform-yes-see-association-certainty' : 'unknown',
        associations, reason: negative(tags) ? 'literal-shelter-no' : 'vehicle-stop-does-not-locate-generic-shelter-roof-or-pole',
        withheldUnit: ['roof', 'glass', 'bench', 'pole', 'sign', 'matching-inferred-colliders'],
        ownership: 'No mapped shelter/roof/building/platform/stop geometry is owned or removed here. Validated dedicated geometry must be emitted by its separate source owner.',
        limits: 'Unknown real shelter geometry is not absence, a real-world clearance certificate, a constructor/cohort pass or a route fix.' };
}
