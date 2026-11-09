import { decodeTramPoints } from './tram-path.js';
import { TRAM_BRIDGE_MODELS } from './tram-grade-models.js';

const key = (id, index) => id + ':' + index;
const no = v => v == null || /^(no|false|0)$/.test(String(v));
const groundTags = t => no(t.bridge) && no(t.tunnel) && (t.layer == null || Number(t.layer) === 0) && (t.level == null || Number(t.level) === 0) && t.ele == null && t.incline == null;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** C1 quadratic/linear/quadratic ramp. The explicit cap is a MODEL choice. */
export function smoothTramRamp(length, height, { maxGrade = .08, easeM = 20 } = {}) {
    if (!(height >= 0) || !(length > height / maxGrade + 1e-6)) return null;
    const ease = Math.min(easeM, length / 3, (length - height / maxGrade) * .999), peak = height / (length - ease);
    if (!(ease > 0) || peak > maxGrade + 1e-10) return null;
    const at = s => s <= 0 ? 0 : s >= length ? height : s < ease ? peak * s * s / (2 * ease) : s > length - ease ? height - peak * (length - s) ** 2 / (2 * ease) : peak * (s - ease / 2);
    return { at, length, height, easeM: ease, peakGrade: peak, breaks: [0, ease, length - ease, length] };
}

function orderedPath(ways, definition) {
    const points = [], ids = [], legs = [], station = new Map(); let total = 0;
    for (const [id, dir] of definition.ways) {
        const way = ways.get(id); if (!way) return null;
        const indexes = way.nodeIds.map((_, i) => i); if (dir < 0) indexes.reverse();
        if (ids.length && (ids.at(-1) !== way.nodeIds[indexes[0]] || distance(points.at(-1), way.xy[indexes[0]]) > 1e-6)) return null;
        for (let k = 0; k < indexes.length; k++) {
            const i = indexes[k], p = way.xy[i], nid = way.nodeIds[i];
            if (k) {
                const previous = indexes[k - 1], start = total; total += distance(way.xy[previous], p);
                legs.push({ sourceId: id, index: Math.min(i, previous), s0: dir > 0 ? start : total, s1: dir > 0 ? total : start });
            }
            if (!ids.length || ids.at(-1) !== nid) { points.push(p); ids.push(nid); }
            if (station.has(nid) && Math.abs(station.get(nid) - total) > 1e-6) return null;
            station.set(nid, total);
        }
    }
    const offsets = new Map();
    for (let i = 0; i < points.length; i++) {
        const before = i ? points[i - 1] : points[i], after = i + 1 < points.length ? points[i + 1] : points[i];
        const vector = (a, b) => { const l = distance(a, b); return l ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : null; };
        const u = vector(before, points[i]) || vector(points[i], after), v = vector(points[i], after) || u, den = 1 + u[0] * v[0] + u[1] * v[1];
        if (den < .1) return null;
        offsets.set(ids[i], [-(u[1] + v[1]) / den, (u[0] + v[0]) / den]);
    }
    return { points, ids, legs, station, total, offsets };
}

function stationSection(point, normal, edges) {
    const hits = [];
    for (const e of edges) {
        const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, den = normal[0] * dz - normal[1] * dx;
        if (Math.abs(den) < 1e-8) continue;
        const x = e.a.x - point[0], z = e.a.z - point[1], s = (x * normal[1] - z * normal[0]) / den;
        if (s < -1e-7 || s > 1 + 1e-7) continue;
        const t = (x * dz - z * dx) / den, y = e.ya + (e.yb - e.ya) * s;
        if (!hits.some(h => Math.abs(h.t - t) < 1e-6)) hits.push({ t, y, sourceId: e.sourceId, edgeId: e.id });
    }
    return hits.length === 1 ? hits[0] : null;
}

/** Returns one displacement resolver for renderer and Traffic. Registry entries
 * select reviewed structures; source node IDs alone create path connections. */
export function buildTramGrades(data, { coreEdges = [], models = TRAM_BRIDGE_MODELS } = {}) {
    const report = { estimated: true, models: [], unresolved: [], renderedDeckPieces: 0, renderedTriangles: 0 }, grades = new Map(), ways = new Map();
    for (const source of data.tramSourceWays || []) {
        const xy = decodeTramPoints(source.points, data.q || 10);
        if (xy?.length === source.nodeIds?.length) ways.set(source.sourceId, { ...source, xy });
    }
    const edges = coreEdges.map(e => ({ ...e, sourceId: data.roadSourceGeometry?.[e.road]?.sourceId || e.access?.sourceId || e.sourceId }));
    const sourceGround = (node, road) => {
        const core = edges.filter(e => e.sourceId === road && groundTags(data.roadSourceGeometry?.[e.road]?.tags || {}) && [e.a, e.b].some(n => n.sourceId === node));
        if (core.length) {
            const heights = core.flatMap(e => [e.a, e.b].filter(n => n.sourceId === node).map(n => n.y));
            if (heights.every(y => Number.isFinite(y) && Math.abs(y) < 1e-8)) return { sourceId: road, nodeId: node, modelY: 0, basis: 'equal original source node in native ground motor profile' };
            return null;
        }
        const scenery = Object.values(data.scenerySourceGeometry || {}).find(s => s.sourceId === road && s.nodeIds.includes(node) && groundTags(s.tags || {}));
        return scenery ? { sourceId: road, nodeId: node, modelY: 0, basis: 'equal original source node in explicit flat ground source scenery; not measured' } : null;
    };
    const addLeg = (model, way, index, at, breaks = [], extra = {}) => {
        const a = way.xy[index], b = way.xy[index + 1], len = distance(a, b);
        const heightAt = t => at(Math.max(0, Math.min(1, t)));
        const grade = { known: true, ya: heightAt(0), yb: heightAt(1), heightAt, estimated: true, basis: model.basis, modelId: model.id,
            sourceDeckIds: [way.sourceId], sourceAnchorIds: extra.sourceAnchorIds || [], provenance: extra.provenance || [],
            deckHalfWidthM: model.deckHalfWidthM, thicknessM: model.thicknessM, bridge: !no(way.tags?.bridge), breaks, ...extra };
        if (![grade.ya, grade.yb].every(Number.isFinite) || !(len > 0)) return;
        grades.set(key(way.sourceId, index), grade);
    };
    for (const model of models) {
        if (!model.bridgeWays.some(id => (data.tramSources || []).some(r => r.sourceId === id))) continue;
        const fail = reason => report.unresolved.push({ modelId: model.id, sourceIds: model.bridgeWays, reason });
        if (model.bridgeWays.some(id => { const t = ways.get(id)?.tags; return !t || no(t.bridge) || !no(t.tunnel) || Number(t.layer) !== model.sourceLayer || t.ele != null || t.incline != null; })) { fail('missing-or-changed-source-bridge'); continue; }
        if (model.kind === 'level') {
            const support = model.roadSources.map(id => edges.filter(e => e.sourceId === id && e.bridge && !e.tunnel));
            if (support.some(es => !es.length) || support.flat().some(e => Math.abs(e.ya) > 1e-8 || Math.abs(e.yb) > 1e-8)) { fail('lower-source-road-profile-not-confirmed-zero'); continue; }
            for (const id of model.bridgeWays) { const way = ways.get(id); for (let i = 0; i < way.xy.length - 1; i++) addLeg(model, way, i, () => 0, [], { sourceAnchorIds: model.roadSources, provenance: [model.sourceStructureId] }); }
            report.models.push({ id: model.id, heightM: 0, sourceAnchorIds: model.roadSources, sourceStructureId: model.sourceStructureId, basis: model.basis }); continue;
        }
        const paths = model.paths.map(p => orderedPath(ways, p));
        if (paths.some(p => !p)) { fail('incomplete-source-connected-path'); continue; }
        const stationEvidence = []; let invalid = false;
        for (let k = 0; k < model.stationNodes.length; k++) {
            const node = model.stationNodes[k], path = paths[k], i = path.ids.indexOf(node), tags = data.tramSourceNodeTags?.[node];
            if (i <= 0 || i >= path.points.length - 1 || tags?.public_transport !== 'stop_position' || tags?.railway !== 'tram_stop') { invalid = true; break; }
            const a = path.points[i - 1], p = path.points[i], b = path.points[i + 1], da = distance(a, p), db = distance(p, b);
            const dx = (p[0] - a[0]) / da + (b[0] - p[0]) / db, dz = (p[1] - a[1]) / da + (b[1] - p[1]) / db, length = Math.hypot(dx, dz), normal = [-dz / length, dx / length];
            const hits = model.stationRoadSources.map(id => stationSection(p, normal, edges.filter(e => e.sourceId === id && e.bridge && !e.tunnel)));
            if (hits.some(h => !h) || hits[0].t * hits[1].t >= 0 || Math.abs(hits[0].y - hits[1].y) > .05) { invalid = true; break; }
            stationEvidence.push({ nodeId: node, point: p, sourceStationM: path.station.get(node), hits, modelY: (hits[0].y + hits[1].y) / 2 });
        }
        if (invalid || stationEvidence.length !== paths.length || Math.max(...stationEvidence.map(s => s.modelY)) - Math.min(...stationEvidence.map(s => s.modelY)) > .05) { fail('common-source-cable-station-profile-unconfirmed'); continue; }
        const height = stationEvidence.reduce((s, p) => s + p.modelY, 0) / stationEvidence.length, prepared = [];
        for (let k = 0; k < paths.length; k++) {
            const path = paths[k], def = model.paths[k], south = path.station.get(def.southGround), north = path.station.get(def.northGround);
            const bridgeLegs = path.legs.filter(l => model.bridgeWays.includes(l.sourceId)), lo = Math.min(...bridgeLegs.flatMap(l => [l.s0, l.s1])), hi = Math.max(...bridgeLegs.flatMap(l => [l.s0, l.s1]));
            const branch = ways.get(def.southFlatBranch), reference = sourceGround(def.southGroundReference, def.southRoad);
            const southAnchor = branch?.nodeIds.includes(def.southGround) && groundTags(branch.tags || {}) && reference && path.station.get(def.southGroundReference) < south
                ? { nodeId: def.southGround, sourceId: def.southFlatBranch, modelY: 0, basis: 'MODEL preserves existing flat source rail branch at its real source-node fork; no new branch bridge', referenceGround: reference }
                : sourceGround(def.southGround, def.southRoad);
            const anchors = [southAnchor, sourceGround(def.northGround, def.northRoad)], station = path.station.get(model.stationNodes[k]);
            const entry = model.bridgeEntryHeightM ?? height, up = smoothTramRamp(lo - south, entry, model), down = smoothTramRamp(north - hi, height, model);
            const deckPeak = 1.5 * Math.abs(height - entry) / (station - lo);
            if (anchors.some(a => !a) || !up || !down || !(south < lo && lo < station && station < hi && hi < north) || deckPeak > (model.maxDeckGrade ?? model.maxGrade)) { invalid = true; break; }
            const at = s => {
                if (s < lo) return up.at(s - south);
                if (s > hi) return height - down.at(s - hi);
                const t = Math.max(0, Math.min(1, (s - lo) / (station - lo)));
                return entry + (height - entry) * t * t * (3 - 2 * t);
            };
            prepared.push({ path, at, anchors, up, down, lo, hi, south, north, station, entry, deckPeak });
        }
        if (invalid) { fail('source-ground-anchor-or-smooth-grade-cap-unresolved'); continue; }
        for (const p of prepared) for (const leg of p.path.legs) {
            const breaks = [p.south, p.lo, p.station, p.hi, p.north, ...p.up.breaks.map(s => p.south + s), ...p.down.breaks.map(s => p.hi + s)].map(s => (s - leg.s0) / (leg.s1 - leg.s0)).filter(t => t > 0 && t < 1);
            addLeg(model, ways.get(leg.sourceId), leg.index, t => p.at(leg.s0 + (leg.s1 - leg.s0) * t), breaks,
                { sourceAnchorIds: p.anchors.map(a => a.nodeId).concat(model.stationNodes), provenance: model.evidence,
                    maxGrade: model.maxGrade, pathStationAt: t => leg.s0 + (leg.s1 - leg.s0) * t,
                    aOffset: p.path.offsets.get(ways.get(leg.sourceId).nodeIds[leg.index]).map(n => n * Math.sign(leg.s1 - leg.s0)),
                    bOffset: p.path.offsets.get(ways.get(leg.sourceId).nodeIds[leg.index + 1]).map(n => n * Math.sign(leg.s1 - leg.s0)) });
        }
        report.models.push({ id: model.id, heightM: height, basis: model.basis, stationEvidence,
            paths: prepared.map(p => ({ southGround: p.anchors[0], northGround: p.anchors[1], southApproachM: p.up.length, northApproachM: p.down.length,
                southEaseM: p.up.easeM, northEaseM: p.down.easeM, bridgeEntryHeightM: p.entry, deckPeakGrade: p.deckPeak,
                maxGrade: Math.max(p.up.peakGrade, p.down.peakGrade), bridgeIntervalM: [p.lo, p.hi], groundIntervalM: [p.south, p.north] })) });
    }
    const resolveGrade = (way, leg) => grades.get(key(way.sourceId, leg.index)) || null;
    const forRun = (run, segment) => {
        const source = data.tramSources?.[run], way = ways.get(source?.sourceId); if (!way) return null;
        const a = source.nodeIds[segment], b = source.nodeIds[segment + 1], index = way.nodeIds.findIndex((n, i) => n === a && way.nodeIds[i + 1] === b);
        return index >= 0 ? grades.get(key(way.sourceId, index)) || null : null;
    };
    return { resolveGrade, forRun, report, grades };
}

/** Conservative physical band uses the same exact continuous displacement. */
export function tramDeckBand(a, b, grade, baseM = .2) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    return (x, z, radius = 0) => {
        const t = ((x - a[0]) * dx + (z - a[1]) * dz) / (len * len), pad = Math.max(0, radius) / len;
        const values = [grade.heightAt(t - pad), grade.heightAt(t), grade.heightAt(t + pad)];
        return { top: baseM + Math.max(...values), bottom: baseM + Math.min(...values) - grade.thicknessM };
    };
}
