// Literal public-transport geometry. A stop_position is a vehicle location,
// not a shelter footprint. Keep associations and model placement separate.
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const relevant = t => t && (['platform', 'stop_position'].includes(t.public_transport) || ['tram_stop', 'platform'].includes(t.railway) || ['bus_stop', 'platform'].includes(t.highway) || t.amenity === 'shelter');
const platform = t => t.public_transport === 'platform' || t.railway === 'platform' || t.highway === 'platform';

export function snapshotPublicTransportSources(osm) {
    const nodes = [...osm.ntags].filter(([, tags]) => relevant(tags)).map(([id, tags]) => ({ sourceId: 'n' + id, nodeIds: [id], ll: [osm.nodes.get(id)], tags: { ...tags } }));
    const ways = [...osm.ways].filter(([, w]) => relevant(w.tags)).map(([id, w]) => ({ sourceId: 'w' + id, nodeIds: [...w.nodes], ll: w.nodes.map(id => osm.nodes.get(id)), tags: { ...w.tags } }));
    const stopAreas = [...osm.rels].filter(([, r]) => r.tags.public_transport === 'stop_area' || r.tags.public_transport === 'stop_area_group').map(([id, r]) => ({ sourceId: 'r' + id, tags: { ...r.tags }, members: r.members.map(m => ({ ...m })) }));
    return { features: nodes.concat(ways), stopAreas };
}

export function publicTransportCatalogue(data, snapshot, sourceFiles, { poiSourceIds = null } = {}) {
    if (!sourceFiles?.length || sourceFiles.some(f => !f.file || !/^[a-f\d]{64}$/.test(f.sha256))) throw Error('Public transport requires a hashed tile ledger');
    const p = data.proj, project = ([lat, lon]) => {
        const dlat = p.compress && lat > p.compress.above ? p.compress.above - p.lat0 + (lat - p.compress.above) * p.compress.factor : lat - p.lat0;
        return [(lon - p.lon0) * p.mPerLon * p.scale, -dlat * p.mPerLat * p.scale];
    };
    const complete = snapshot.features.filter(f => f.ll.every(v => v?.every(Number.isFinite))).map(f => ({ sourceId: f.sourceId, nodeIds: f.nodeIds, points: f.ll.map(project), tags: f.tags }));
    const poiSources = {}, unresolved = [];
    for (const [i, row] of data.pois.entries()) {
        if (data.poiKinds[row[0]] !== 'busstop') continue;
        const expected = poiSourceIds?.[i]?.replace(/^node\//, 'n').replace(/^way\//, 'w');
        const sub = data.strings[row[5]], candidates = complete.filter(f => {
            if (expected) return f.sourceId === expected;
            if (f.points.length !== 1) return false; // legacy centroid output has no unambiguous source reference
            const [x, z] = f.points[0], t = f.tags;
            return Math.round(x * 10) === row[1] && Math.round(z * 10) === row[2] &&
                (sub === 'tram_stop' ? t.railway === 'tram_stop' : t.highway === 'bus_stop' || platform(t));
        });
        if (candidates.length === 1) poiSources[i] = candidates[0];
        else unresolved.push({ poiIndex: i, reason: candidates.length ? 'ambiguous-source-match' : 'source-match-unavailable', candidateSourceIds: candidates.map(f => f.sourceId) });
    }
    const anchors = Object.values(poiSources).flatMap(f => f.points);
    // A local source catalogue, not an inferred district-wide platform inventory.
    const platforms = complete.filter(f => platform(f.tags) && f.points.some(a => anchors.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 160)));
    const ids = new Set([...Object.values(poiSources), ...platforms].map(f => f.sourceId));
    const stopAreas = snapshot.stopAreas.filter(r => r.members.some(m => ids.has((m.type === 'node' ? 'n' : m.type === 'way' ? 'w' : 'r') + m.ref)));
    return { publicTransportSources: { schema: 1, poiSources, platforms, stopAreas, coverage: {
        scope: 'Literal matched prepared bus/tram POIs, platform features with a vertex within 160m of a matched POI, and touching stop_area/group relations from these cached tiles. Open platform lines do not establish shelter width, roof footprint or along-platform station. No absent association or shelter is inferred.',
        sourceFiles: sourceFiles.map(f => ({ ...f })), sourceSetSha256: hash({ poiSources, platforms, stopAreas }),
        counts: { rawFeatures: snapshot.features.length, incompleteFeatures: snapshot.features.length - complete.length, matchedPois: Object.keys(poiSources).length, platforms: platforms.length, stopAreas: stopAreas.length }, unresolved,
    } } };
}
