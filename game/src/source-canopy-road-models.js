// Individually reviewed source fuel-canopy covers. Relative source ordering
// below an open roof supplies no underground depth in metres.
import { edgeCuts } from './building-passages.js';
import { parseMeasure } from './building-roofs.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const no = v => v == null || /^(no|false|0)$/.test(String(v));
const metric = t => t && (t.ele != null || t.incline != null || t.location || t.level != null && Number(t.level) !== 0);
const nodeMetric = t => metric(t) || t?.layer != null && Number(t.layer) !== 0;
const ground = t => t && no(t.bridge) && no(t.tunnel) && (t.layer == null || Number(t.layer) === 0) && !metric(t);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function inside(p, ring) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
        if (distance(p, [a[0] + dx * t, a[1] + dz * t]) < 1e-7) return true;
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
}
const sameRing = (a, b) => a?.length === b?.length && a.some((_, offset) => [1, -1].some(dir => a.every((p, i) => distance(p, b[(offset + dir * i + b.length * 2) % b.length]) <= .00011)));

/** No geometry, collider, legal restriction, source flag or RNG mutation.
 * The returned floor is only a reviewed local ground model. Its open roof is
 * already emitted by the existing canopy renderer and is never carved here. */
export function buildSourceCanopyRoadModels(data) {
    const accepted = [], unresolved = [];
    const roadById = new Map();
    for (const [index, source] of Object.entries(data.roadSourceGeometry || {})) {
        if (!roadById.has(source.sourceId)) roadById.set(source.sourceId, []);
        roadById.get(source.sourceId).push({ index: Number(index), source });
    }
    for (const record of data.reviewedCoveredRoads || []) {
        if (record.classification !== 'reviewed-source-fuel-canopy-covered-road') continue;
        const fail = reason => unresolved.push({ modelId: record.id, sourceRoadId: record.sourceRoadId, reason });
        if (record.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(record.sourceXmlSha256 || '') || !record.evidence?.length || record.evidence.some(u => !String(u).startsWith('https://')) || record.model?.estimated !== true || record.model.floorY !== 0) { fail('invalid-source-canopy-review'); continue; }
        const snapshots = new Map((record.sourceWays || []).map(w => [w.sourceId, w]));
        const matched = w => w && !Object.values(w.nodeTags || {}).some(nodeMetric) && roadById.has(w.sourceId) && roadById.get(w.sourceId).every(({ source }) => same(source.nodeIds, w.nodeIds) && same(source.tags, w.tags) && source.projected.length === w.projected.length && source.projected.every((p, i) => distance(p, w.projected[i]) < 1e-6)) && w.nodeIds.every(n => roadById.get(w.sourceId).some(r => r.source.preparedNodeIds?.includes(n)));
        const road = snapshots.get(record.sourceRoadId), tags = road?.tags || {}, rows = roadById.get(record.sourceRoadId);
        if (!matched(road) || tags.highway !== 'service' || tags.service !== 'driveway' || tags.covered !== 'yes' || tags.tunnel !== 'yes' || ![-1, 0].includes(Number(tags.layer || 0)) || !no(tags.bridge) || metric(tags)) { fail('changed-source-canopy-road-or-metric-datum'); continue; }
        const canopy = record.sourceCanopy, index = data.buildingIds?.indexOf(record.sourceCanopyId) ?? -1, policy = data.buildingCanopies?.[index], ct = canopy?.tags;
        if (index < 0 || canopy?.sourceId !== record.sourceCanopyId || ct?.building !== 'roof' || ct.amenity !== 'fuel' || !(Number(ct.layer) > Number(tags.layer || 0)) || metric(ct) || !no(ct.tunnel) || ct['building:levels:underground'] != null && Number(ct['building:levels:underground']) !== 0 || Object.values(canopy.nodeTags || {}).some(nodeMetric) || !policy || !sameRing(canopy.projected, data.buildingFootprints?.[index])) { fail('changed-or-unreviewed-source-fuel-canopy'); continue; }
        const ring = data.buildingFootprints[index], holes = data.buildingHoleFootprints?.[index] || [];
        let lengthM = 0, coveredM = 0;
        for (let i = 1; i < road.projected.length; i++) {
            const a = road.projected[i - 1], b = road.projected[i], length = distance(a, b), cuts = edgeCuts(a, b, [ring, ...holes]); lengthM += length;
            for (let j = 1; j < cuts.length; j++) { const t = (cuts[j - 1] + cuts[j]) / 2, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (inside(p, ring) && !holes.some(h => inside(p, h))) coveredM += (cuts[j] - cuts[j - 1]) * length; }
        }
        if (!(lengthM > 1) || Math.abs(lengthM - coveredM) > 1e-5 || ![road.nodeIds[0], road.nodeIds.at(-1)].every(n => canopy.nodeIds.includes(n))) { fail('source-road-not-contained-in-mapped-canopy'); continue; }
        let invalidJoin = record.groundJoins?.length !== 2;
        for (const join of record.groundJoins || []) {
            const anchor = snapshots.get(join.anchorRoadId); let node = join.anchorNodeId;
            if (!matched(anchor) || !ground(anchor.tags) || !anchor.nodeIds.includes(node) || !road.nodeIds.includes(join.portalNodeId) || !join.ways?.length) { invalidJoin = true; break; }
            for (const [id, dir] of join.ways) {
                const w = snapshots.get(id), ids = dir === 1 ? w?.nodeIds : w?.nodeIds?.slice().reverse();
                if (![1, -1].includes(dir) || !matched(w) || !ground(w.tags) || ids[0] !== node) { invalidJoin = true; break; }
                node = ids.at(-1);
            }
            if (node !== join.portalNodeId) invalidJoin = true;
        }
        if (invalidJoin || new Set(record.groundJoins.map(j => j.portalNodeId)).size !== 2) { fail('incomplete-source-canopy-ground-join-chain'); continue; }
        const nativeTopM = data.buildingDimensions?.[index]?.[0] ?? data.buildings[index][1] / 10, nativeUndersideM = data.buildingDimensions?.[index]?.[1] ?? data.buildings[index][2] / 10;
        const legalMaxheightM = parseMeasure(tags.maxheight), physicalMaxheightM = parseMeasure(tags['maxheight:physical']), clearanceM = nativeUndersideM - .24 - record.model.floorY;
        if (!(nativeTopM > nativeUndersideM && clearanceM > 0) || Math.abs(policy.topM - nativeTopM) > 1e-6 || Math.abs(policy.clearanceM - nativeUndersideM) > 1e-6 || legalMaxheightM > clearanceM || physicalMaxheightM > clearanceM) { fail('actual-canopy-band-versus-source-clearance-contradiction'); continue; }
        accepted.push({ ...record, road, roadIndices: rows.map(r => r.index), bodies: [], profileOnly: true, lengthM, coveredM, clearanceM, legalMaxheightM, physicalMaxheightM,
            clearanceSource: 'existing emitted source-canopy underside minus native0.24m road surface; roof dimensions remain explicit estimates',
            canopyIndex: index, nativeUndersideM, nativeTopM, canopyPolicy: policy, dimensionNote: 'Raw layer/tunnel tags preserved. Individually reviewed relative under-canopy ordering with literal ground joins; no layer-to-metre conversion, new ceiling, wall, opening or source-volume removal.' });
    }
    return { accepted, unresolved };
}
