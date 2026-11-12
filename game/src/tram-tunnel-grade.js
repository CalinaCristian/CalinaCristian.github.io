import { decodeTramPoints } from './tram-path.js';

// Reviewed source topology, with explicit MODEL dimensions. Neither layer nor
// level supplies metres. The source tunnel endpoints do not define plateaus or
// surveyed portal locations; the roof spans the source tunnel=yes ways.
export const ROMANA_TRAM_TUNNEL_MODEL = {
    id: 'victoria-tram-underpass', depthM: 7.6, maxGrade: .08, easeM: 20,
    stationHalfPlateauM: 30, tunnelRampInsetM: 15, deckHalfWidthM: 2.8, thicknessM: .35,
    roofBottomM: -.3, roofTopM: 0,
    basis: 'MODEL independent Victoria tram underpass; literal source-node ground joins and underground stops; depth, ramps and roof extent estimated, not surveyed',
    paths: [
        { ways: [['w241374323', -1], ['w241374326', -1], ['w243476552', -1], ['w920117610', -1]], tunnelWay: 'w241374326',
            westGround: 2927621025, westGroundWay: 'w40503646', eastGround: 296077845, eastGroundWay: 'w920117610', stationNode: 8544117695 },
        { ways: [['w920117611', 1], ['w920117619', 1], ['w920117620', 1]], tunnelWay: 'w920117619',
            westGround: 8544126334, westGroundWay: 'w920117625', eastGround: 8544117714, eastGroundWay: 'w920117620', stationNode: 8544117694 },
    ],
};

const no = v => v == null || /^(no|false|0)$/.test(String(v));
const yes = v => /^(yes|true|1)$/.test(String(v));
const ground = t => no(t.bridge) && no(t.tunnel) && (t.layer == null || Number(t.layer) === 0) && (t.level == null || Number(t.level) === 0) && t.ele == null && t.incline == null;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const revenue = t => t.railway === 'tram' && !['yard', 'siding', 'spur'].includes(t.service) && t.usage !== 'depot' && !t.disused && !t.abandoned && !t.construction && !t.proposed;

/** C1 zero-slope-end ramp. Null means the literal source length cannot meet the
 * model grade cap; no invented length, coordinate movement or steep fallback. */
export function smoothTunnelRamp(length, height, maxGrade = .08, easeM = 20) {
    if (!(height > 0 && maxGrade > 0 && length > height / maxGrade)) return null;
    const ease = Math.min(easeM, length / 3, (length - height / maxGrade) * .999), peakGrade = height / (length - ease);
    if (!(ease > 0) || peakGrade > maxGrade + 1e-10) return null;
    const at = s => s <= 0 ? 0 : s >= length ? height : s < ease ? peakGrade * s * s / (2 * ease)
        : s > length - ease ? height - peakGrade * (length - s) ** 2 / (2 * ease) : peakGrade * (s - ease / 2);
    return { at, length, peakGrade, easeM: ease, breaks: [0, ease, length - ease, length] };
}

function orderedPath(ways, definition) {
    const nodes = [], points = [], legs = [], stations = new Map(); let total = 0;
    for (const [id, dir] of definition.ways) {
        const way = ways.get(id); if (!way) return null;
        const indexes = way.nodeIds.map((_, i) => i); if (dir < 0) indexes.reverse();
        if (nodes.length && (nodes.at(-1) !== way.nodeIds[indexes[0]] || distance(points.at(-1), way.xy[indexes[0]]) > 1e-6)) return null;
        for (let k = 0; k < indexes.length; k++) {
            const i = indexes[k], point = way.xy[i], node = way.nodeIds[i];
            if (k) {
                const j = indexes[k - 1], start = total, length = distance(way.xy[j], point); if (!(length > 1e-7)) return null;
                total += length; legs.push({ sourceId: id, index: Math.min(i, j), s0: dir > 0 ? start : total, s1: dir > 0 ? total : start });
            }
            if (!nodes.length || nodes.at(-1) !== node) { nodes.push(node); points.push(point); }
            if (stations.has(node) && Math.abs(stations.get(node) - total) > 1e-6) return null;
            stations.set(node, total);
        }
    }
    const offsets = new Map();
    for (let i = 0; i < points.length; i++) {
        const p = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const unit = (a, b) => { const l = distance(a, b); return l ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : null; };
        const a = unit(before, p) || unit(p, after), b = unit(p, after) || a, den = 1 + a[0] * b[0] + a[1] * b[1];
        if (den < .1) return null;
        offsets.set(nodes[i], [-(a[1] + b[1]) / den, (a[0] + b[0]) / den]);
    }
    return { nodes, points, legs, stations, offsets, total };
}

/** Pure source grade catalogue for composition by the shared renderer/support
 * builder. coreEdges are deliberately not a nearest-road height fallback. */
export function buildTramTunnelGrades(data, { coreEdges = [] } = {}) {
    const model = ROMANA_TRAM_TUNNEL_MODEL, grades = new Map(), report = { models: [], unresolved: [] };
    if (!model.paths.some(p => (data.tramSources || []).some(r => r.sourceId === p.tunnelWay))) return { grades, report };
    const fail = reason => { report.unresolved.push({ modelId: model.id, sourceIds: model.paths.map(p => p.tunnelWay), reason }); return { grades, report }; };
    const ways = new Map();
    for (const source of data.tramSourceWays || []) {
        const xy = decodeTramPoints(source.points, data.q || 10);
        if (xy?.length === source.nodeIds?.length && !source.missingNodeIds?.length) ways.set(source.sourceId, { ...source, xy });
    }
    const required = new Set(model.paths.flatMap(p => p.ways.map(w => w[0]).concat(p.westGroundWay, p.eastGroundWay)));
    for (const id of required) {
        const w = ways.get(id), t = w?.tags;
        if (!t || !revenue(t) || !yes(t.oneway) || Number(t.gauge) !== 1435 || !no(t.bridge) || t.ele != null || t.incline != null
            || w.nodeIds.some(n => { const tags = data.tramSourceNodeTags?.[n]; return tags?.ele != null || tags?.incline != null; })) return fail('missing-or-changed-source-tram-path');
        const tunnel = model.paths.some(p => p.tunnelWay === id);
        if (tunnel ? !yes(t.tunnel) || Number(t.layer) !== -1 || Number(t.level) !== -1 : !no(t.tunnel) || (t.layer != null && Number(t.layer) !== 0)) return fail('missing-or-changed-source-tunnel-context');
    }
    const prepared = [];
    for (const definition of model.paths) {
        const path = orderedPath(ways, definition); if (!path) return fail('incomplete-literal-source-node-path');
        const anchors = [['west', definition.westGround, definition.westGroundWay], ['east', definition.eastGround, definition.eastGroundWay]].map(([end, node, id]) => {
            const w = ways.get(id), pointIndex = w?.nodeIds.indexOf(node), pathIndex = path.nodes.indexOf(node);
            if (pointIndex < 0 || pathIndex < 0 || !ground(w.tags) || distance(w.xy[pointIndex], path.points[pathIndex]) > 1e-6) return null;
            return { end, nodeId: node, sourceId: id, modelY: 0, basis: 'equal literal source rail node in existing unsurveyed flat ground rail continuation' };
        });
        const station = path.stations.get(definition.stationNode), tags = data.tramSourceNodeTags?.[definition.stationNode];
        const west = path.stations.get(definition.westGround), east = path.stations.get(definition.eastGround), lo = station - model.stationHalfPlateauM, hi = station + model.stationHalfPlateauM;
        const tunnelLegs = path.legs.filter(l => l.sourceId === definition.tunnelWay), tunnelStart = Math.min(...tunnelLegs.flatMap(l => [l.s0, l.s1])), tunnelEnd = Math.max(...tunnelLegs.flatMap(l => [l.s0, l.s1]));
        // The native source ground roads cross most of the mapped tunnel span.
        // A ramp drawn all the way to the stop would put the real pantograph
        // through those roads. Keep a deep core with explicit estimated 15m
        // inner transitions; the source tag endpoints themselves remain sloped.
        const floorLo = tunnelStart + model.tunnelRampInsetM, floorHi = tunnelEnd - model.tunnelRampInsetM;
        if (anchors.some(a => !a) || tags?.railway !== 'tram_stop' || tags.public_transport !== 'stop_position' || Number(tags.level) !== -1 || !(west < floorLo && floorLo <= lo && lo < hi && hi <= floorHi && floorHi < east)) return fail('source-ground-join-or-underground-stop-unconfirmed');
        const down = smoothTunnelRamp(floorLo - west, model.depthM, model.maxGrade, model.easeM), up = smoothTunnelRamp(east - floorHi, model.depthM, model.maxGrade, model.easeM);
        if (!down || !up) return fail('source-length-cannot-meet-model-grade-cap');
        const at = s => s < floorLo ? -down.at(s - west) : s <= floorHi ? -model.depthM : -model.depthM + up.at(s - floorHi);
        // An extra revenue branch at a depressed source node needs its own
        // reviewed profile. A nearby line never creates or erases such a seam.
        const selected = new Set(definition.ways.map(w => w[0]));
        for (const w of ways.values()) if (!selected.has(w.sourceId) && revenue(w.tags || {})) for (const n of w.nodeIds) {
            if (path.stations.has(n) && Math.abs(at(path.stations.get(n))) > 1e-8) return fail('unmodeled-revenue-branch-at-depressed-source-node');
        }
        // An actual identical native motor node would constrain the datum. The
        // current rail paths have none; preserve conflicts instead of snapping.
        for (const e of coreEdges) for (const n of [e.a, e.b]) if (path.stations.has(n?.sourceId) && Number.isFinite(n.y) && Math.abs(n.y - at(path.stations.get(n.sourceId))) > .05) return fail('conflicting-identical-source-motor-node-height');
        prepared.push({ definition, path, anchors, station, west, east, lo, hi, floorLo, floorHi, down, up, at });
    }
    for (const p of prepared) for (const leg of p.path.legs) {
        const w = ways.get(leg.sourceId), ds = leg.s1 - leg.s0, local = s => (s - leg.s0) / ds;
        const breaks = [p.lo, p.hi, ...p.down.breaks.map(s => p.west + s), ...p.up.breaks.map(s => p.floorHi + s)].map(local).filter(t => t > 0 && t < 1).sort((a, b) => a - b);
        // (owner, 2026-11-12, Romana (-545, -430) "I can still see underground from the top") the roof covers the whole way
        // OSM tags tunnel=yes, portal to portal (the same extent as the two Pasajul Victoria carriageways beside it, already
        // roofed from their own tunnel tags). Roofing only 30 m either side of the stop left 240 m of open slot across the
        // square. The floor is at least 7.3 m down over that whole length, so the roof clears the tram everywhere.
        const intervals = yes(w.tags.tunnel) ? [[0, 1]] : [];
        const heightAt = t => p.at(leg.s0 + ds * Math.max(0, Math.min(1, t)));
        grades.set(leg.sourceId + ':' + leg.index, { known: true, ya: heightAt(0), yb: heightAt(1), heightAt, estimated: true, basis: model.basis, modelId: model.id,
            sourceDeckIds: [leg.sourceId], sourceAnchorIds: p.anchors.map(a => a.nodeId).concat(p.definition.stationNode), provenance: ['OpenStreetMap source ways/nodes/tags retained in district data; explicit unsurveyed model'],
            deckHalfWidthM: model.deckHalfWidthM, thicknessM: model.thicknessM, maxGrade: model.maxGrade, peakGrade: Math.max(p.down.peakGrade, p.up.peakGrade), breaks,
            tunnel: yes(w.tags.tunnel), sourceTunnel: yes(w.tags.tunnel), pathStationAt: t => leg.s0 + ds * t,
            aOffset: p.path.offsets.get(w.nodeIds[leg.index]).map(v => v * Math.sign(ds)), bOffset: p.path.offsets.get(w.nodeIds[leg.index + 1]).map(v => v * Math.sign(ds)),
            roof: { known: true, bottomM: model.roofBottomM, topM: model.roofTopM, intervals, estimated: true,
                basis: 'source tunnel=yes extent, portal to portal; roof level and thickness are MODEL estimates' } });
    }
    report.models.push({ id: model.id, basis: model.basis, depthM: model.depthM, maxGradeCap: model.maxGrade, deckHalfWidthM: model.deckHalfWidthM, thicknessM: model.thicknessM,
        roof: { bottomM: model.roofBottomM, topM: model.roofTopM, coveredMPerTrack: prepared.map(p => { const legs = p.path.legs.filter(l => l.sourceId === p.definition.tunnelWay); return Math.max(...legs.flatMap(l => [l.s0, l.s1])) - Math.min(...legs.flatMap(l => [l.s0, l.s1])); }), estimated: true, policy: 'the whole source-tagged tunnel way is covered' },
        paths: prepared.map(p => ({ sourceWays: p.definition.ways, anchors: p.anchors, stationNode: p.definition.stationNode, stationM: p.station, stationPlateauM: [p.lo, p.hi], floorPlateauM: [p.floorLo, p.floorHi], floorCoreTransitionInsetM: model.tunnelRampInsetM, groundIntervalM: [p.west, p.east],
            westApproachM: p.down.length, eastApproachM: p.up.length, westEaseM: p.down.easeM, eastEaseM: p.up.easeM, peakGrade: Math.max(p.down.peakGrade, p.up.peakGrade) })) });
    return { grades, report };
}
