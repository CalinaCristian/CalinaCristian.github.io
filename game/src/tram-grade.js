import { decodeTramPoints, flatTramGrade } from './tram-path.js';
import { TRAM_BRIDGE_MODELS } from './tram-grade-models.js';

const key = (id, index) => id + ':' + index;
const no = v => v == null || /^(no|false|0)$/.test(String(v));
const groundTags = t => no(t.bridge) && no(t.tunnel) && (t.layer == null || Number(t.layer) === 0) && (t.level == null || Number(t.level) === 0) && t.ele == null && t.incline == null;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function closestSegments(a, b, c, d) {
    const dx = b[0] - a[0], dz = b[1] - a[1], ux = d[0] - c[0], uz = d[1] - c[1], den = dx * uz - dz * ux;
    if (Math.abs(den) > 1e-10) {
        const x = c[0] - a[0], z = c[1] - a[1], t = (x * uz - z * ux) / den, u = (x * dz - z * dx) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { t, u, distance: 0 };
    }
    let best = null;
    const project = (p, q, r) => { const x = r[0] - q[0], z = r[1] - q[1]; return Math.max(0, Math.min(1, ((p[0] - q[0]) * x + (p[1] - q[1]) * z) / (x * x + z * z || 1))); };
    for (const t of [0, 1]) {
        const p = [a[0] + dx * t, a[1] + dz * t], u = project(p, c, d), dist = distance(p, [c[0] + ux * u, c[1] + uz * u]);
        if (!best || dist < best.distance) best = { t, u, distance: dist };
    }
    for (const u of [0, 1]) {
        const p = [c[0] + ux * u, c[1] + uz * u], t = project(p, a, b), dist = distance(p, [a[0] + dx * t, a[1] + dz * t]);
        if (!best || dist < best.distance) best = { t, u, distance: dist };
    }
    return best;
}

/** C1 quadratic/linear/quadratic ramp. The explicit cap is a MODEL choice. */
/** station (from `south`) along a source path where its distance to a branch polyline first reaches `spacing` (0 when never) */
function clearOfBranch(path, south, lo, branchXY, spacing) {
    const dist = p => { let d = Infinity; for (let i = 1; i < branchXY.length; i++) { const [ax, az] = branchXY[i - 1], [bx, bz] = branchXY[i], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / L)); d = Math.min(d, Math.hypot(p[0] - ax - dx * u, p[1] - az - dz * u)); } return d; };
    const nodes = path.ids.map((id, i) => ({ s: path.station.get(id), p: path.points[i] })).filter(n => Number.isFinite(n.s) && n.s >= south - 1e-6 && n.s <= lo).sort((a, b) => a.s - b.s);
    for (let i = 1; i < nodes.length; i++) {
        const A = nodes[i - 1], B = nodes[i], n = Math.max(1, Math.ceil(B.s - A.s));
        for (let k = 1; k <= n; k++) { const f = k / n, q = [A.p[0] + (B.p[0] - A.p[0]) * f, A.p[1] + (B.p[1] - A.p[1]) * f]; if (dist(q) >= spacing) return A.s + (B.s - A.s) * f - south; }
    }
    return 0;
}
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
        const way = ways.get(id); if (!way || way.metricNodeDatum || way.tags?.ele != null || way.tags?.incline != null || !no(way.tags?.tunnel)) return null;
        if (no(way.tags?.bridge) && !groundTags(way.tags || {})) return null;
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
export function buildTramGrades(data, { coreEdges = [], models = TRAM_BRIDGE_MODELS, extraGrades = null, extraReport = null, sharedProfile = null } = {}) {
    const report = { estimated: true, models: [...(extraReport?.models || [])], unresolved: [...(extraReport?.unresolved || [])], renderedDeckPieces: 0, renderedTriangles: 0,
        inferredObstacleExclusions: { count: 0, byKind: {}, samples: [], policy: 'Only inferred emission candidates; actual source rails and emitted fleet clearance, compatible absolute model height. Mapped barriers are untouched.' } }, grades = new Map(), ways = new Map();
    for (const [id, grade] of extraGrades || []) {
        if (grade.known && (![grade.ya, grade.yb].every(Number.isFinite) || !(grade.deckHalfWidthM > 0) || !(grade.thicknessM > 0))) {
            report.unresolved.push({ sourceSegment: id, reason: 'invalid-additional-source-grade' }); continue;
        }
        grades.set(id, grade.known ? { ...grade, sourceSegment: Number(id.slice(id.lastIndexOf(':') + 1)), breaks: grade.breaks || [], heightAt: grade.heightAt || (t => grade.ya + (grade.yb - grade.ya) * Math.max(0, Math.min(1, t))) } : grade);
    }
    for (const source of data.tramSourceWays || []) {
        const xy = decodeTramPoints(source.points, data.q || 10);
        const metricNodeDatum = source.nodeIds?.some(n => { const tags = data.tramSourceNodeTags?.[n]; return tags?.ele != null || tags?.incline != null; });
        if (xy?.length === source.nodeIds?.length) ways.set(source.sourceId, { ...source, xy, metricNodeDatum });
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
        const grade = { known: true, ya: heightAt(0), yb: heightAt(1), heightAt, sourceSegment: index, estimated: true, basis: model.basis, modelId: model.id,
            sourceDeckIds: [way.sourceId], sourceAnchorIds: extra.sourceAnchorIds || [], provenance: extra.provenance || [],
            deckHalfWidthM: model.deckHalfWidthM, thicknessM: model.thicknessM, bridge: !no(way.tags?.bridge), breaks, ...extra };
        if (![grade.ya, grade.yb].every(Number.isFinite) || !(len > 0)) return;
        grades.set(key(way.sourceId, index), grade);
    };
    for (const model of models) {
        if (!model.bridgeWays.some(id => (data.tramSources || []).some(r => r.sourceId === id))) continue;
        const fail = reason => report.unresolved.push({ modelId: model.id, sourceIds: model.bridgeWays, reason });
        if (model.bridgeWays.some(id => { const way = ways.get(id), t = way?.tags; return !t || way.metricNodeDatum || no(t.bridge) || !no(t.tunnel) || Number(t.layer) !== model.sourceLayer || t.ele != null || t.incline != null; })) { fail('missing-or-changed-source-bridge'); continue; }
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
            // (owner L17: the climbing track's slab started at the fork node, on the flat branch's track) the climb is held at grade
            // until this track is clear of the flat branch (centre spacing ≥ southClearSpacingM: deck half width + a tram's half
            // width + margin), measured on the source geometry; then it rises to the bridge entry
            const holdM = model.southClearSpacingM && branch?.xy ? clearOfBranch(path, south, lo, branch.xy, model.southClearSpacingM) : 0;
            const entry = model.bridgeEntryHeightM ?? height, ramp = smoothTramRamp(lo - south - holdM, entry, holdM > 0 && model.southMaxGrade ? { ...model, maxGrade: model.southMaxGrade } : model), down = smoothTramRamp(north - hi, height, model);
            const up = ramp && (holdM > 0 ? { ...ramp, length: ramp.length + holdM, holdM, at: s => s <= holdM ? 0 : ramp.at(s - holdM), breaks: [0, ...ramp.breaks.map(s => s + holdM)] } : ramp);
            const rise = smoothTramRamp(Math.min(model.bridgeRiseLengthM ?? station - lo, station - lo), height - entry, { ...model, maxGrade: model.maxDeckGrade ?? model.maxGrade });
            const deckPeak = rise?.peakGrade;
            if (anchors.some(a => !a) || !up || !down || !rise || !(south < lo && lo < station && station < hi && hi < north)) { invalid = true; break; }
            const at = s => {
                if (s < lo) return up.at(s - south);
                if (s > hi) return height - down.at(s - hi);
                return entry + rise.at(s - lo);
            };
            prepared.push({ path, at, anchors, up, down, rise, lo, hi, south, north, station, entry, deckPeak });
        }
        if (invalid) { fail('source-ground-anchor-or-smooth-grade-cap-unresolved'); continue; }
        for (const p of prepared) for (const leg of p.path.legs) {
            const breaks = [p.south, p.lo, p.station, p.hi, p.north, ...p.up.breaks.map(s => p.south + s), ...p.rise.breaks.map(s => p.lo + s), ...p.down.breaks.map(s => p.hi + s)].map(s => (s - leg.s0) / (leg.s1 - leg.s0)).filter(t => t > 0 && t < 1);
            addLeg(model, ways.get(leg.sourceId), leg.index, t => p.at(leg.s0 + (leg.s1 - leg.s0) * t), breaks,
                { sourceAnchorIds: p.anchors.map(a => a.nodeId).concat(model.stationNodes), provenance: model.evidence,
                    maxGrade: model.maxGrade, pathStationAt: t => leg.s0 + (leg.s1 - leg.s0) * t,
                    aOffset: p.path.offsets.get(ways.get(leg.sourceId).nodeIds[leg.index]).map(n => n * Math.sign(leg.s1 - leg.s0)),
                    bOffset: p.path.offsets.get(ways.get(leg.sourceId).nodeIds[leg.index + 1]).map(n => n * Math.sign(leg.s1 - leg.s0)) });
        }
        report.models.push({ id: model.id, heightM: height, basis: model.basis, stationEvidence,
            paths: prepared.map(p => ({ southGround: p.anchors[0], northGround: p.anchors[1], southApproachM: p.up.length, northApproachM: p.down.length,
                southEaseM: p.up.easeM, northEaseM: p.down.easeM, bridgeEntryHeightM: p.entry, bridgeRiseLengthM: p.rise.length, deckPeakGrade: p.deckPeak,
                maxGrade: Math.max(p.up.peakGrade, p.down.peakGrade, p.rise.peakGrade), bridgeIntervalM: [p.lo, p.hi], groundIntervalM: [p.south, p.north] })) });
    }
    if (sharedProfile?.known) for (const [id, grade] of grades) { const split=id.lastIndexOf(':'),way=ways.get(id.slice(0,split)); if(way)grades.set(id,sharedProfile.adaptRailGrade(way,Number(id.slice(split+1)),grade)); }
    const resolveGrade = (way, leg) => grades.get(key(way.sourceId, leg.index)) || null;
    const forRun = (run, segment) => {
        const source = data.tramSources?.[run], way = ways.get(source?.sourceId); if (!way) return null;
        const a = source.nodeIds[segment], b = source.nodeIds[segment + 1], index = way.nodeIds.findIndex((n, i) => n === a && way.nodeIds[i + 1] === b);
        const grade = index >= 0 ? grades.get(key(way.sourceId, index)) : null;
        return grade?.known ? grade : null;
    };
    const corridors = [];
    for (const [run, source] of (data.tramSources || []).entries()) {
        const way = ways.get(source.sourceId), points = decodeTramPoints(data.trams?.[run], data.q || 10), tags = way?.tags || {}, gauge = Number(tags.gauge);
        if (!points || points.length !== source.nodeIds.length || tags.railway !== 'tram' || tags.disused === 'yes' || tags.construction || !(gauge > 0)) continue;
        for (let i = 1; i < points.length; i++) {
            const grade = forRun(run, i - 1) || ((tags.level == null || Number(tags.level) === 0) ? flatTramGrade(way) : null);
            if (!grade?.known) continue;
            const a = points[i - 1], b = points[i];
            // Reviewed grade functions are piecewise quadratic. Endpoints and
            // midpoint of every declared polynomial interval prove a flat leg;
            // a model-wide grade cap alone does not mean this leg is sloped.
            const heightAt = grade.heightAt || (t => grade.ya + (grade.yb - grade.ya) * t);
            const breaks = [...new Set([0, 1, ...(grade.breaks || [])])].filter(t => t >= 0 && t <= 1).sort((a, b) => a - b);
            const groundLevel = breaks.every(t => Math.abs(heightAt(t)) < 1e-8) && breaks.slice(1).every((t, k) => Math.abs(heightAt((t + breaks[k]) / 2)) < 1e-8);
            const halfWidthM = Math.max(gauge / 2000, 1.2) + .5;
            corridors.push({ a, b, sourceId: source.sourceId, sourceNodeIds: source.nodeIds.slice(i - 1, i + 1), gaugeM: gauge / 1000,
                heightAt, groundLevel, sourceBridgeModelId:grade.sourceBridgeModelId, halfWidthM, maxGrade: grade.maxGrade || 0,
                x0: Math.min(a[0], b[0]) - halfWidthM, x1: Math.max(a[0], b[0]) + halfWidthM, z0: Math.min(a[1], b[1]) - halfWidthM, z1: Math.max(a[1], b[1]) + halfWidthM });
        }
    }
    const excludesInferredObstacle = (a, b, { inferred = false, y0a, y1a, y0b = y0a, y1b = y1a, radiusM = .35, kind = 'inferred', sourceId = null, bodyEnvelope = null, sourceBridgeModelId = null } = {}) => {
        if (!inferred) return false;
        for (const c of corridors) {
            if(sourceBridgeModelId&&c.sourceBridgeModelId!==sourceBridgeModelId)continue;
            if (Math.max(a[0], b[0]) < c.x0 - radiusM || Math.min(a[0], b[0]) > c.x1 + radiusM || Math.max(a[1], b[1]) < c.z0 - radiusM || Math.min(a[1], b[1]) > c.z1 + radiusM) continue;
            const halfWidthM = bodyEnvelope ? Math.max(c.gaugeM / 2, bodyEnvelope.halfWidthM) : c.halfWidthM;
            const q = closestSegments(a, b, c.a, c.b); if (q.distance > halfWidthM + radiusM) continue;
            const base = .24 + c.heightAt(q.u), low = y0a + (y0b - y0a) * q.t, high = y1a + (y1b - y1a) * q.t;
            // Literal fleet envelope at the8% cap: the36m low body can reach
            //1.44m below its anchor; its5.79m pantograph is only4.3m off centre,
            //so the true upper pitch reach is<.35m, not another1.44m.
            const lower = bodyEnvelope ? (c.maxGrade ? bodyEnvelope.tiltedMinY : bodyEnvelope.minY) : -1.44, upper = bodyEnvelope ? (c.maxGrade ? bodyEnvelope.tiltedMaxY : bodyEnvelope.maxY) : 5.79 + .35;
            if (![base, low, high, lower, upper].every(Number.isFinite) || base + lower > high || base + upper < low) continue;
            const stats = report.inferredObstacleExclusions; stats.count++; stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
            if (stats.samples.length < 200) stats.samples.push({ kind, inferredRoadSourceId: sourceId, railSourceId: c.sourceId, railSourceNodeIds: c.sourceNodeIds,
                a, b, closestDistanceM: q.distance, literalGaugeHalfM: c.gaugeM / 2, vehicleCorridorHalfM: halfWidthM, railBaseY: base, actualBodyEnvelope: bodyEnvelope ? [lower, upper] : null, obstacleBandM: [low, high] });
            return true;
        }
        return false;
    };
    const support = buildTramDeckSupport(data, { forRun });
    return { resolveGrade, forRun, report, grades, corridors, excludesInferredObstacle, support };
}

/** Render-only subdivisions preserve every original source segment/vertex.
 * This same geometry catalogue supplies CPU and native physical support. */
export function tramGradeRenderPieces(a, b, grade, baseM = .2) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < .05) return [];
    const nx = -dz / len, nz = dx / len, fractions = new Set([0, 1, ...grade.breaks, ...(grade.roof?.intervals || []).flat()]);
    const step = Math.abs(grade.ya - grade.yb) > 1e-8 || grade.breaks.length ? 1.5 : 10;
    for (let k = 1, count = Math.ceil(len / step); k < count; k++) fractions.add(k / count);
    const ts = [...fractions].sort((a, b) => a - b), pieces = [];
    for (let i = 1; i < ts.length; i++) {
        const t0 = ts[i - 1], t1 = ts[i]; if ((t1 - t0) * len < 1e-6) continue;
        const p = [a[0] + dx * t0, a[1] + dz * t0], q = [a[0] + dx * t1, a[1] + dz * t1], y0 = grade.heightAt(t0), y1 = grade.heightAt(t1);
        const n0 = t0 === 0 && grade.aOffset ? grade.aOffset : [nx, nz], n1 = t1 === 1 && grade.bOffset ? grade.bOffset : [nx, nz];
        const quad = (width, h0, h1) => [[p[0] + n0[0] * width, h0, p[1] + n0[1] * width], [q[0] + n1[0] * width, h1, q[1] + n1[1] * width], [q[0] - n1[0] * width, h1, q[1] - n1[1] * width], [p[0] - n0[0] * width, h0, p[1] - n0[1] * width]].map((v,k)=>grade.heightAtWorld?[v[0],v[1]+grade.heightAtWorld(v[0],v[2])-(k===0||k===3?y0:y1),v[2]]:v);
        const local = { ...grade, heightAt: t => grade.heightAt(t0 + (t1 - t0) * Math.max(0, Math.min(1, t))) };
        const h0 = baseM + y0, h1 = baseM + y1, hm = baseM + local.heightAt(.5);
        // All reviewed ramps are piecewise quadratic, with every derivative
        // break included above. Export coefficients for an independent replay.
        const topProfile = { basis: 'quadratic-local-u', coefficients: [2 * (h0 + h1 - 2 * hm), 4 * hm - 3 * h0 - h1, h0],
            parameter: 'clamped projection onto piece a→b', domain: [0, 1], thicknessM: grade.thicknessM };
        const top=quad(grade.deckHalfWidthM,baseM+y0,baseM+y1), regions=grade.surfaceRegions?.(top.map(v=>[v[0],v[2]])).map(r=>({...r,maxTop:baseM+r.maxHeightM,band:(x,z)=>({top:baseM+r.heightAtWorld(x,z),bottom:baseM+r.heightAtWorld(x,z)-grade.thicknessM})}));
        if(regions) {topProfile.basis='quadratic-affine-source-regions';topProfile.regions=regions.map(({poly,stationCoefficients,stationIntervalM,heightCoefficients})=>({poly,stationCoefficients,stationIntervalM,heightCoefficients,baseM}));}
        const sharedBand=grade.heightAtWorld?sharedTramDeckBand(top,grade,baseM):null;
        pieces.push({ a: p, b: q, t0, t1, y0, y1, nx, nz, quad, top, regions,
            topProfile,
            roof: grade.roof?.known && grade.roof.intervals.some(([lo, hi]) => (t0 + t1) / 2 >= lo && (t0 + t1) / 2 <= hi) ? grade.roof : null,
            supported: grade.bridge || grade.tunnel || Math.max(Math.abs(y0), Math.abs(y1), Math.abs(grade.heightAt((t0 + t1) / 2))) > 1e-8, band: sharedBand || tramDeckBand(p, q, local, baseM) });
    }
    return pieces;
}

/** Shared renderer/support identity uses original source segment and exact
 * deterministic subdivision parameters, independently of catalogue order. */
export function tramSupportPieceId(sourceId, sourceSegment, piece, modelId) {
    return `${modelId}:${sourceId}:${sourceSegment}:${piece.t0.toPrecision(17)}:${piece.t1.toPrecision(17)}`;
}

function pointInRing(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j], b = poly[i];
        if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}

export function buildTramDeckSupport(data, grades) {
    const pieces = [], cells = new Map(), size = 16;
    for (const [run, delta] of (data.trams || []).entries()) {
        const points = decodeTramPoints(delta, data.q || 10); if (!points) continue;
        for (let i = 1; i < points.length; i++) {
            const grade = grades.forRun(run, i - 1); if (!grade) continue;
            for (const piece of tramGradeRenderPieces(points[i - 1], points[i], grade)) {
                if (!piece.supported) continue;
                const sourceId = data.tramSources[run].sourceId, poly = piece.top.map(p => [p[0], p[2]]), p = { ...piece, poly, modelId: grade.modelId, sourceId, sourceSegment: grade.sourceSegment,
                    id: tramSupportPieceId(sourceId, grade.sourceSegment, piece, grade.modelId) };
                pieces.push(p);
                for (let x = Math.floor(Math.min(...poly.map(v => v[0])) / size); x <= Math.floor(Math.max(...poly.map(v => v[0])) / size); x++) for (let z = Math.floor(Math.min(...poly.map(v => v[1])) / size); z <= Math.floor(Math.max(...poly.map(v => v[1])) / size); z++) {
                    const key = x + ',' + z; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(p);
                }
            }
        }
    }
    const at = (x, z, { modelId } = {}) => {
        if (!modelId) return null;
        let top = -Infinity, bottom = Infinity; const sourceIds = new Set(), pieceIds = new Set();
        for (const p of cells.get(Math.floor(x / size) + ',' + Math.floor(z / size)) || []) {
            if (p.modelId !== modelId || !pointInRing(x, z, p.poly)) continue;
            const band = p.band(x, z, 0); top = Math.max(top, band.top); bottom = Math.min(bottom, band.bottom); sourceIds.add(p.sourceId); pieceIds.add(p.id);
        }
        return sourceIds.size ? { top, bottom, modelId, sourceIds: [...sourceIds], supportPieceIds: [...pieceIds], estimated: true, deckBaseM: .2, actorBaseM: .24,
            basis: 'exact containing source rail slab; no motor-road or upper-deck selection' } : null;
    };
    const inBox = (x0, z0, x1, z1, { modelId } = {}) => {
        if (!modelId) return [];
        const found = new Set();
        for (let x = Math.floor(x0 / size); x <= Math.floor(x1 / size); x++) for (let z = Math.floor(z0 / size); z <= Math.floor(z1 / size); z++) for (const p of cells.get(x + ',' + z) || []) {
            if (p.modelId === modelId && Math.max(...p.poly.map(v => v[0])) >= x0 && Math.min(...p.poly.map(v => v[0])) <= x1 && Math.max(...p.poly.map(v => v[1])) >= z0 && Math.min(...p.poly.map(v => v[1])) <= z1) found.add(p);
        }
        return [...found];
    };
    at.inBox = inBox;
    return { pieces, at, inBox };
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

/** The actual chord mesh and the continuous shared field both constrain support.
 * A radius expands by the declared Lipschitz grade bound, never a clearance epsilon. */
function sharedTramDeckBand(top,grade,baseM){
 const rendered=(x,z)=>{for(const ids of [[0,1,2],[0,2,3]]){const [a,b,c]=ids.map(i=>top[i]),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return u*a[1]+v*b[1]+(1-u-v)*c[1];}return baseM+grade.heightAtWorld(x,z);};
 return(x,z,radius=0)=>{const a=baseM+grade.heightAtWorld(x,z),b=rendered(x,z),pad=Math.max(0,radius)*(grade.maxGrade||.08);return{top:Math.max(a,b)+pad,bottom:Math.min(a,b)-pad-grade.thicknessM};};
}
