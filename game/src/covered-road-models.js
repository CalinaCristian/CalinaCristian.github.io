// Reviewed cover/ground associations are source evidence, not measured road
// elevations. Ordinary tunnel tags alone never enter this reviewed exception.
import { edgeCuts } from './building-passages.js';
import { parseMeasure } from './building-roofs.js';

const no = v => v == null || /^(no|false|0)$/.test(String(v));
const zero = v => v == null || Number(v) === 0;
const plainGround = t => no(t.bridge) && no(t.tunnel) && zero(t.layer) && zero(t.level) && !t.location && t.ele == null && t.incline == null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
};
const sameRing = (a, b) => a?.length === b?.length && a.some((_, offset) => [1, -1].some(dir => a.every((p, i) => distance(p, b[(offset + dir * i + b.length * 2) % b.length]) <= .00011)));

/** Source-centreline sweep, with finite-width mouths and the same0.1mm seam
 * convention as existing source building passages; no new road vertices. */
export function coveredRoadPassageRing(a, b, width) {
    const length = distance(a, b), angle = Math.atan2(b[1] - a[1], b[0] - a[0]), u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], r = width / 2;
    const aa = [a[0] - u[0] * .0001, a[1] - u[1] * .0001], bb = [b[0] + u[0] * .0001, b[1] + u[1] * .0001], ring = [];
    for (const [p, start] of [[bb, angle + Math.PI / 2], [aa, angle - Math.PI / 2]]) for (let k = 0; k <= 12; k++) { const q = start - Math.PI * k / 12; ring.push([p[0] + Math.cos(q) * r, p[1] + Math.sin(q) * r]); }
    return ring;
}

/** Pure reviewed source validator + passage catalogue. No source row, original
 * coordinate, access rule, building outline or unrelated profile is modified. */
export function buildCoveredRoadModels(data) {
    const report = { estimated: true, models: [], unresolved: [], basis: 'reviewed source cover and literal ground joins; not measured elevation' }, roadIndices = new Set(), passages = new Map(), accepted = [];
    const roadById = new Map();
    for (const [index, source] of Object.entries(data.roadSourceGeometry || {})) {
        if (!roadById.has(source.sourceId)) roadById.set(source.sourceId, []);
        roadById.get(source.sourceId).push({ index: Number(index), source });
    }
    for (const record of data.reviewedCoveredRoads || []) {
        const fail = reason => report.unresolved.push({ modelId: record.id, sourceRoadId: record.sourceRoadId, reason });
        if (record.schemaVersion !== 1 || record.classification !== 'reviewed-source-building-covered-road' || !/^[a-f0-9]{64}$/.test(record.sourceXmlSha256 || '') || !record.evidence?.length || record.evidence.some(u => !String(u).startsWith('https://'))) { fail('invalid-covered-road-review'); continue; }
        const snapshots = new Map((record.sourceWays || []).map(w => [w.sourceId, w])), road = snapshots.get(record.sourceRoadId), rows = roadById.get(record.sourceRoadId), tags = road?.tags || {};
        const requirements = record.contextRequirements, meets = (tags, expected) => expected && Object.entries(expected).every(([key, value]) => tags?.[key] === value);
        const metricNode = w => Object.values(w.nodeTags || {}).some(t => t.ele != null || t.incline != null || !zero(t.layer) || !zero(t.level) || t.location === 'underground' || t.location === 'elevated');
        const matched = w => w && !metricNode(w) && roadById.has(w.sourceId) && roadById.get(w.sourceId).every(({ source }) => same(source.nodeIds, w.nodeIds) && same(source.tags, w.tags) && source.projected.length === w.projected.length && source.projected.every((p, i) => distance(p, w.projected[i]) < 1e-6));
        if (!road || !rows?.length || !matched(road) || !meets(tags, requirements?.road) || !road.nodeIds.every(n => rows.some(r => r.source.preparedNodeIds?.includes(n))) || tags.tunnel !== 'yes' || !no(tags.bridge) || !zero(tags.layer) || !zero(tags.level) || tags.location || tags.ele != null || tags.incline != null || record.model?.estimated !== true || record.model.floorY !== 0 || !(record.model.clearanceM > 0)) { fail('changed-source-covered-road-or-metric-datum'); continue; }
        const bodies = (record.sourceBodies || []).map(body => ({ ...body, index: data.buildingIds?.indexOf(body.sourceId) ?? -1 }));
        const parent = bodies.find(b => b.sourceId === record.sourceBuildingId), parts = bodies.filter(b => (record.sourcePartIds || []).includes(b.sourceId));
        if (!parent || !meets(parent.tags, requirements?.cover) || bodies.length !== 1 + record.sourcePartIds?.length || parts.length !== record.sourcePartIds?.length || !parts.length || bodies.some(b => b.index < 0 || !sameRing(b.projected, data.buildingFootprints?.[b.index]) || !zero(b.tags?.['building:levels:underground']) || b.tags?.ele != null || b.tags?.location === 'underground' || metricNode(b)) || !(Number(parent.tags?.layer) > 0) || parent.tags?.['building:levels:underground'] == null || !parent.tags?.building || parts.some(b => !meets(b.tags, requirements?.part) || b.tags?.['building:part'] !== 'yes' || !(Number(b.tags?.['building:min_level']) > 0))) { fail('changed-source-cover-building-context'); continue; }
        let lengthM = 0, coveredM = 0;
        for (let i = 1; i < road.projected.length; i++) {
            const a = road.projected[i - 1], b = road.projected[i], length = distance(a, b), rings = bodies.map(body => data.buildingFootprints[body.index]);
            lengthM += length;
            const cuts = edgeCuts(a, b, rings.concat(bodies.flatMap(body => data.buildingHoleFootprints?.[body.index] || [])));
            for (let j = 1; j < cuts.length; j++) {
                const t = (cuts[j - 1] + cuts[j]) / 2, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
                if (bodies.every(body => inRing(p, data.buildingFootprints[body.index]) && !(data.buildingHoleFootprints?.[body.index] || []).some(h => inRing(p, h)))) coveredM += (cuts[j] - cuts[j - 1]) * length;
            }
        }
        if (!(lengthM > 1) || Math.abs(lengthM - coveredM) > 1e-5) { fail('source-covered-road-not-completely-contained'); continue; }
        let invalidJoin = record.groundJoins?.length !== 2;
        for (const join of record.groundJoins || []) {
            const anchor = snapshots.get(join.anchorRoadId); let node = join.anchorNodeId;
            if (!matched(anchor) || !plainGround(anchor.tags) || !roadById.get(anchor.sourceId).some(r => r.source.preparedNodeIds?.includes(node)) || !anchor.nodeIds.includes(node) || !road.nodeIds.includes(join.portalNodeId) || !join.ways?.length) { invalidJoin = true; break; }
            for (const [id, dir] of join.ways) {
                const w = snapshots.get(id), ids = dir === 1 ? w?.nodeIds : w?.nodeIds?.slice().reverse();
                if (![1, -1].includes(dir) || !matched(w) || !plainGround(w.tags) || !w.nodeIds.every(n => roadById.get(w.sourceId).some(r => r.source.preparedNodeIds?.includes(n))) || ids[0] !== node) { invalidJoin = true; break; }
                node = ids.at(-1);
            }
            if (node !== join.portalNodeId) invalidJoin = true;
        }
        if (invalidJoin || new Set(record.groundJoins.map(j => j.portalNodeId)).size !== 2 || !record.groundJoins.every(j => [road.nodeIds[0], road.nodeIds.at(-1)].includes(j.portalNodeId))) { fail('incomplete-source-ground-join-chain'); continue; }
        const physical = parseMeasure(tags['maxheight:physical']), legal = parseMeasure(tags.maxheight), explicitWidth = parseMeasure(tags.width);
        let clearanceM = physical > 0 ? physical : legal > 0 ? legal + .2 : record.model.clearanceM, clearanceSource = physical > 0 ? 'OSM maxheight:physical' : legal > 0 ? 'estimate:OSM legal maxheight plus0.2m' : 'MODEL reviewed covered-street clearance; not surveyed';
        // A positive literal source minimum supplies an absolute local ceiling;
        // an estimated opening may not cut above it. Relative levels do not.
        const metricMinima = bodies.map(b => parseMeasure(b.tags?.min_height)).filter(v => v > 0);
        if (metricMinima.length) {
            const cap = Math.min(...metricMinima) - .24 - record.model.floorY;
            if (physical > 0 && physical > cap + 1e-6) { fail('source-metric-clearance-contradiction'); continue; }
            if (clearanceM > cap) { clearanceM = cap; clearanceSource = 'OSM min_height bounds estimated opening above source-connected road model'; }
        }
        if (!(clearanceM > 0) || bodies.some(b => (data.buildingDimensions?.[b.index]?.[0] ?? data.buildings[b.index][1] / 10) <= .24 + clearanceM + .01)) { fail('source-cover-height-incompatible-with-opening'); continue; }
        const widths = rows.map(({ index }) => data.roadWidths?.[index]?.widthM ?? ((data.roads[index][2] + data.roads[index][3]) * data.roads[index][5] / 10 + data.roads[index][4] / 10));
        const widthM = explicitWidth > 0 ? explicitWidth : Math.max(...widths), widthSource = explicitWidth > 0 ? 'OSM width' : 'estimate:unchanged source lane/class road width';
        if (!(widthM > 0) || widthM > 30) { fail('invalid-source-covered-road-width'); continue; }
        const model = { ...record, road, bodies, roadIndices: rows.map(r => r.index), clearanceM, clearanceSource, widthM, widthSource };
        accepted.push(model); for (const { index } of rows) roadIndices.add(index);
        for (let i = 1; i < road.projected.length; i++) {
            const a = road.projected[i - 1], b = road.projected[i]; if (distance(a, b) < .01) continue;
            const passage = { sourceRoadId: road.sourceId, sourceSegment: i - 1, sourceNodeIds: road.nodeIds.slice(i - 1, i + 1), sourceCentreline: [a, b], ring: coveredRoadPassageRing(a, b, widthM),
                roadIndices: model.roadIndices, widthM, widthSource, clearanceM, clearanceSource, tags, evidence: record.evidence, classificationSource: record.classification,
                modelId: record.id, estimated: true, floorModel: record.model, sourceXmlSha256: record.sourceXmlSha256,
                dimensionNote: 'Reviewed covered street under mapped source bodies, with exact ground-node chains. Ground datum and untagged clearance are explicit models, not layer/level metres.' };
            for (const body of bodies) { if (!passages.has(body.index)) passages.set(body.index, []); passages.get(body.index).push(passage); }
        }
        report.models.push({ id: record.id, sourceRoadId: road.sourceId, sourceBuildingIds: bodies.map(b => b.sourceId), roadIndices: model.roadIndices, lengthM, coveredM, floorModel: record.model,
            widthM, widthSource, clearanceM, clearanceSource, sourceGroundJoins: record.groundJoins, sourceXmlSha256: record.sourceXmlSha256, evidence: record.evidence });
    }
    const validateProfile = edges => {
        const invalid = new Set();
        for (const model of accepted) {
            const own = edges.filter(e => !e.virtual && model.roadIndices.includes(e.road)), samples = own.flatMap(e => [e.ya, e.yb]);
            for (const join of model.groundJoins) {
                const indices = new Set((roadById.get(join.anchorRoadId) || []).map(r => r.index));
                const heights = edges.filter(e => !e.virtual && indices.has(e.road)).flatMap(e => [e.a, e.b]).filter(n => n.sourceId === join.anchorNodeId).map(n => n.y);
                if (!heights.length) invalid.add(model.id); samples.push(...heights);
            }
            if (!own.length || samples.some(y => !Number.isFinite(y) || Math.abs(y - model.model.floorY) > 1e-6)) invalid.add(model.id);
            const entry = report.models.find(m => m.id === model.id); entry.profileBoundsM = samples.length ? [Math.min(...samples), Math.max(...samples)] : null; entry.floorModelVerified = !invalid.has(model.id);
            if (invalid.has(model.id)) report.unresolved.push({ modelId: model.id, sourceRoadId: model.sourceRoadId, reason: 'covered-source-ground-model-profile-conflict', profileBoundsM: entry.profileBoundsM });
        }
        // A source-cover classification remains valid independently of the
        // unsupported floor. Never carve a false low opening to conceal it.
        for (const [index, list] of passages) passages.set(index, list.filter(p => !invalid.has(p.modelId)));
        return invalid.size === 0;
    };
    // Called after the normal renderer has built its actual mitred asphalt.
    // The lane/class width estimate does not include the renderer's shoulder;
    // independently sweeping that estimate leaves real asphalt inside solids.
    const useNativeRibbons = ribbons => {
        for (const model of accepted) {
            const entry = report.models.find(m => m.id === model.id), sourceWays = new Map(model.sourceWays.map(w => [w.sourceId, w]));
            // Only the literal reviewed portal chains may complete the mouths;
            // their ground anchors and unrelated nearby roads are not opened.
            const sourceIds = new Set([model.road.sourceId, ...model.groundJoins.flatMap(j => j.ways.map(([id]) => id))]);
            const sourceIndices = new Set([...sourceIds].flatMap(id => (roadById.get(id) || []).map(r => r.index)));
            const selected = ribbons.filter(rb => rb.e && !rb.e.virtual && sourceIndices.has(rb.e.road)), next = [], spans = new Map();
            let reason = entry.floorModelVerified ? null : 'covered-native-ribbon-floor-unverified';
            for (const rb of selected) {
                const e = rb.e;
                const way = sourceWays.get(data.roadSourceGeometry[e.road]?.sourceId);
                if (!way) { reason = 'covered-native-ribbon-source-way-missing'; break; }
                let matched = null;
                for (let i = 1; i < way.projected.length; i++) {
                    const a = way.projected[i - 1], b = way.projected[i], dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
                    if (len2 < 1e-8) continue;
                    const project = n => { const t = ((n.x - a[0]) * dx + (n.z - a[1]) * dz) / len2; return { t, d: Math.hypot(n.x - a[0] - t * dx, n.z - a[1] - t * dz) }; };
                    const aa = project(e.a), bb = project(e.b);
                    if (aa.d < 1e-6 && bb.d < 1e-6 && Math.min(aa.t, bb.t) >= -1e-7 && Math.max(aa.t, bb.t) <= 1 + 1e-7) { matched = { index: i - 1, a, b, lo: Math.min(aa.t, bb.t), hi: Math.max(aa.t, bb.t) }; break; }
                }
                if (!matched || !Array.isArray(rb.poly) || rb.poly.length < 3 || rb.poly.some(p => p.length !== 2 || !p.every(Number.isFinite)) || ![e.ya, e.yb].every(y => Number.isFinite(y) && Math.abs(y - model.model.floorY) <= 1e-6)) { reason = 'covered-native-ribbon-source-or-profile-mismatch'; break; }
                const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, len = Math.hypot(dx, dz), lateral = rb.poly.map(p => (-(p[0] - e.a.x) * dz + (p[1] - e.a.z) * dx) / len), nativeAsphaltWidthM = Math.max(...lateral) - Math.min(...lateral);
                const literalWidth = parseMeasure(way.tags.width);
                if (literalWidth > 0 && nativeAsphaltWidthM > literalWidth + 1e-6) { reason = 'literal-source-width-versus-native-asphalt-contradiction'; break; }
                const original = (passages.get(model.bodies[0].index) || []).find(p => p.modelId === model.id);
                if (!original) { reason = 'covered-native-ribbon-source-passage-missing'; break; }
                next.push({ ...original, sourceRoadId: way.sourceId, sourceSegment: matched.index, sourceNodeIds: way.nodeIds.slice(matched.index, matched.index + 2), sourceCentreline: [matched.a, matched.b], roadIndices: roadById.get(way.sourceId).map(r => r.index), tags: way.tags,
                    ring: rb.poly.map(p => p.slice()), sourcePreparedEdgeId: e.id, nativeAsphaltWidthM, sourceRole: way.sourceId === model.road.sourceId ? 'covered-source-road' : 'reviewed-exact-ground-join', geometryBasis: 'Exact native rendered asphalt ribbon, including existing shoulder and mitred joins; source lane/class estimate retained separately.' });
                const key = way.sourceId + '/' + matched.index;
                if (!spans.has(key)) spans.set(key, []);
                spans.get(key).push([matched.lo, matched.hi]);
            }
            for (const id of sourceIds) for (let i = 1; i < sourceWays.get(id).projected.length; i++) {
                let end = 0;
                for (const [lo, hi] of (spans.get(id + '/' + (i - 1)) || []).sort((a, b) => a[0] - b[0])) { if (lo > end + 1e-7) reason ||= 'covered-native-ribbon-source-span-gap'; end = Math.max(end, hi); }
                if (end < 1 - 1e-7) reason ||= 'covered-native-ribbon-source-span-gap';
            }
            for (const body of model.bodies) passages.set(body.index, (passages.get(body.index) || []).filter(p => p.modelId !== model.id).concat(reason ? [] : next));
            entry.nativePassage = { accepted: !reason, sourceLaneWidthM: model.widthM, nativeAsphaltWidthsM: [...new Set(next.map(p => Math.round(p.nativeAsphaltWidthM * 1e6) / 1e6))], sourceRoadIds: [...sourceIds], preparedEdges: next.map(p => ({ id: p.sourcePreparedEdgeId, sourceRoadId: p.sourceRoadId, sourceSegment: p.sourceSegment, sourceRole: p.sourceRole })), geometryBasis: 'Shared native asphalt polygons; covered source and exact reviewed ground-join chains only, clipped to reviewed parent/part; no extra clearance padding.' };
            if (reason) report.unresolved.push({ modelId: model.id, sourceRoadId: model.road.sourceId, reason });
        }
        return report.unresolved.length === 0;
    };
    return { report, passages, accepted, validateProfile, useNativeRibbons, isCovered: edge => !edge.virtual && roadIndices.has(edge.road) };
}
