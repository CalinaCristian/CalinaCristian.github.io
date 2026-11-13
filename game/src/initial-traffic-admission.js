// Native constructor adapter. Called once after spawnAll, before pedestrians or
// first publication. Preserve all original actors, source assignments and RNG.
import { canTravel, lanesDir } from './nav.js';
import { ambientTrafficAccess } from './road-access.js';
import { collideBuildings } from './world-collide.js';
import {sourceRoadClearance} from './source-road-clearance.js';
import { planInitialVehicleAdmission, ordinaryVehicleStations, vehicleVerticalInterval, vehicleVerticalIntervalAlong, initialVehicleConflict } from './initial-vehicle-admission.js';
import { canTravelTram, tramSectionPoses } from './tram-path.js';
import { validateTramSupportCertificate } from './tram-body-support.js';
import { ordinarySourceSpan, ordinarySourceBodyPlacement } from './initial-ordinary-source-span.js';

const longBody = v => !!(v.long || v.bus || v.tram || v.length >= 8.5);
const bodyPose = v => ({ x: v.x, y: v.y, z: v.z, heading: v.heading, s: v.s });

/** Isolated native preview, not a live vehicle/mesh movement. Native placement
 * owns the lane/source path, including connected-leg long bodies and ramp pitch.
 */
export function previewInitialTrafficPose(T, v, s) {
    let pitch = v.mesh?.rotation?.x || 0, roll = v.mesh?.rotation?.z || 0;
    const mesh = { userData: v.mesh.userData, scale: v.mesh.scale,
        position: { set() {} }, rotation: { set(x, _y, z, order) { if (order !== 'YXZ') throw new Error('Unknown native vehicle rotation order'); pitch = x; roll = z; } } };
    const candidate = { ...v, s, mesh, route: v.route?.slice() || [], hist: v.hist?.slice() };
    T.placeOnLane(candidate, true, 0);
    return { ...bodyPose(candidate), pitch, roll, ...(candidate.edge?.rail ? { railSupport: candidate.railSupport } : {}) };
}

function* rangeStations(origin, lo, hi, spacingM, limit) {
    if (![origin, lo, hi].every(Number.isFinite) || hi < lo) return;
    const center = Math.max(lo, Math.min(hi, origin)), values = [lo, hi, center], seen = new Set();
    for (let i = 1, n = Math.min(limit, Math.ceil((hi - lo) / spacingM)); i <= n; i++) for (const s of [center - i * spacingM, center + i * spacingM]) if (s >= lo && s <= hi) values.push(s);
    values.sort((a, b) => Math.abs(a - origin) - Math.abs(b - origin) || a - b);
    let count = 0;
    for (const s of values) { const key = s.toFixed(9); if (seen.has(key)) continue; seen.add(key); yield s; if (++count >= limit) return; }
}

export function* nativeInitialTrafficCandidates(T, v, { spacingM = 0.25, endMarginM = 0.05, maxCandidates = 256 } = {}) {
    if (v.parked || v.service) return;
    if (v.edge?.rail && (!v.tram || !canTravelTram(v.edge, v.dir))) return;
    const span = longBody(v) ? T.sSpan(v.edge, v.dir, v.length, true) : null;
    const ordinarySpan = !longBody(v) && ordinarySourceSpan(T, v, { endMarginM });
    const stations = longBody(v) ? (span ? rangeStations(v.s, span[0], span[1], spacingM, maxCandidates) : []) : ordinarySpan ? rangeStations(v.s, ordinarySpan.lo, ordinarySpan.hi, spacingM, maxCandidates) : ordinaryVehicleStations(v, { spacingM, endMarginM, maxCandidates });
    for (const s of stations) yield previewInitialTrafficPose(T, v, s);
}

/** Circumscribed discs cover every point of the whole horizontal body rectangle.
 * The overlap outside each small cell is conservative, never an uncovered gap.
 */
export function* initialBodyCover(v, cellM = 0.75) {
    if (!(cellM > 0) || !(v.length > 0) || !(v.width > 0)) throw new Error('Invalid full-body cover');
    // an articulated tram on its rail: each section's own rectangle (vehicles.js sections, tram-path.js poses); `along`
    // stays in the body's frame (section centre + offset in the section) for the pitched vertical test
    const spec = v.edge?.rail ? (v.mesh?.userData?.sections || v.sections) : null, parts = spec ? tramSectionPoses(v, spec, v.width) : null;
    if (parts) {
        for (const q of parts) for (const d of initialBodyCover({ x: q.x, z: q.z, heading: q.heading, length: q.length, width: q.width }, cellM)) yield { ...d, along: q.along + d.along };
        return;
    }
    const nL = Math.max(1, Math.ceil(v.length / cellM)), nW = Math.max(1, Math.ceil(v.width / cellM));
    const dl = v.length / nL, dw = v.width / nW, radius = Math.hypot(dl / 2, dw / 2) + 1e-7;
    const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), rx = -fz, rz = fx;
    for (let i = 0; i < nL; i++) for (let j = 0; j < nW; j++) {
        const along = -v.length / 2 + (i + .5) * dl, across = -v.width / 2 + (j + .5) * dw;
        yield { x: v.x + fx * along + rx * across, z: v.z + fz * along + rz * across, radius, along, across };
    }
}

function colliderBand(c, x, z, r) {
    if (c.wall) {
        const dx = c.bx - c.ax, dz = c.bz - c.az, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / (l2 || 1)));
        return { min: c.y0a + (c.y0b - c.y0a) * t - .3, max: c.y1a + (c.y1b - c.y1a) * t, source: 'native-wall-band-with-native-base-margin' };
    }
    const base = c.y ?? c.base ?? 0;
    let min = Math.max(base, c.y0 ?? -Infinity, c.minH ?? -Infinity), max = Math.min(c.top ?? (base + (c.h ?? Infinity)), c.y1 ?? Infinity, c.yMax ?? Infinity);
    if (c.minHeightAt) { const bottom = c.minHeightAt(x, z, r); if (bottom === null) return null; min = Math.max(min, bottom); }
    if (c.roofHeightAt) { const top = c.roofHeightAt(x, z, r); if (top === null) return null; max = Math.min(max, top); }
    return { min, max, source: 'native-explicit-base-top-passage-roof-band' };
}

/** Native static collision queries over a conservative full-body cover and actual
 * emitted vertical extent. Native wall/explicit-y0 queries test foot height only;
 * choose an actual intersecting level rather than missing a head/side intrusion.
 */
export function initialTrafficStaticClearance(world, body, { cellM = 0.75 } = {}) {
    const interval = vehicleVerticalInterval(body);
    if (!interval.known) return { valid: false, reason: 'unknown-model-vertical-interval', interval };
    if (!world?.buildings) return { valid: false, reason: 'missing-native-static-collider-set' };
    let samples = 0, hit = null, railCertificate = null;
    // A pitched tram: the whole-body range above holds its low end's underside and its high end's roof together. Each
    // disc is tested against the actual range of the stretch of the body it covers (never wider than the whole-body range).
    const pitched = !!body.edge?.rail && Math.abs(body.pitch ?? body.mesh?.rotation?.x ?? 0) > 1e-9;
    for (const sample of initialBodyCover(body, cellM)) {
        samples++;
        const local = pitched ? vehicleVerticalIntervalAlong(body, sample.along - sample.radius, sample.along + sample.radius) : null;
        const range = local?.known ? { min: Math.max(interval.min, local.min), max: Math.min(interval.max, local.max) } : interval;
        const check = c => {
            if (hit) return;
            if (body.edge?.rail && c.railDeck && c.modelId && body.railSupport?.modelIds?.includes(c.modelId)) {
                // The global Y interval below conservatively spans a pitched
                // body's low rear and high front at every disc. For its own
                // identified slab only, recheck the complete actual emitted
                // triangle envelope at this fresh pose/catalogue instead.
                railCertificate ??= validateTramSupportCertificate(body, world.tramDeckSupportAt);
                const b = railCertificate.bounds, outsideActualBounds = b && c.poly?.length &&
                    (Math.max(...c.poly.map(p => p[0])) < b.x0 || Math.min(...c.poly.map(p => p[0])) > b.x1 || Math.max(...c.poly.map(p => p[1])) < b.z0 || Math.min(...c.poly.map(p => p[1])) > b.z1);
                if (railCertificate.valid && c.supportPieceId && (railCertificate.pieceIds.includes(c.supportPieceId) || outsideActualBounds)) return;
                hit = { kind: c.kind || 'source-tram-deck', sourceId: c.sourceId || null, edgeId: null, reason: c.supportPieceId ? railCertificate.reason : 'missing-native-tram-support-piece-id', exactRailDeck: railCertificate };
                return;
            }
            const band = colliderBand(c, sample.x, sample.z, sample.radius); if (!band) return;
            const lo = Math.max(range.min, band.min), hi = Math.min(range.max, band.max);
            if (!(hi > lo)) return;
            // Same support rule as native collideOne: an exact road-deck roof
            // under this vehicle's native ground anchor is a support surface.
            if (c.roadDeck && c.roofHeightAt) {
                const support = c.roofHeightAt(sample.x, sample.z, 0);
                if (support !== null && body.y >= support - 1e-4) return;
            }
            const y = lo + Math.min(1e-5, (hi - lo) / 2);
            if (collideBuildings([c], sample.x, sample.z, sample.radius, y, hi - y)) hit = { kind: c.kind || (c.wall ? 'wall' : c.prop ? 'prop' : 'body'), sourceId: c.sourceId || c.osmId || c.edge?.access?.sourceId || null, edgeId: c.edge?.id ?? null, sample, interval, colliderBand: band };
        };
        if (world.buildings.query) world.buildings.query(sample.x, sample.z, sample.radius + 2, check); else for (const c of world.buildings) check(c);
        if (hit) return { valid: false, reason: 'native-full-body-static-contact', samples, hit };
    }
    return { valid: true, samples, interval, scope: 'Conservative disc cover of native body rectangle and actual emitted vertical interval; accepted candidate only' };
}

/** Optional existing crowd: native pedestrian radius .3m. Without an explicit
 * measured interval, an XY contact is conservatively rejected across grades;
 * it is never hidden by an invented generic height exemption. Constructor's
 * normal first call precedes pedestrian creation. */
export function initialTrafficPedestrianClearance(T, body) {
    const people = T.peds?.list;
    if (!people?.length) return { valid: true, checked: 0 };
    const iv = vehicleVerticalInterval(body), fx = -Math.sin(body.heading), fz = -Math.cos(body.heading);
    for (const p of people) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return { valid: false, reason: 'unknown-existing-pedestrian-body', pedestrian: p.i };
        const dx = p.x - body.x, dz = p.z - body.z, along = dx * fx + dz * fz, across = -dx * fz + dz * fx;
        const d = Math.hypot(Math.max(0, Math.abs(along) - body.length / 2), Math.max(0, Math.abs(across) - body.width / 2));
        if (d >= .3) continue;
        const pv = p.verticalInterval;
        if (iv.known && pv && Number.isFinite(pv.min) && Number.isFinite(pv.max) && (pv.min >= iv.max || pv.max <= iv.min)) continue;
        return { valid: false, reason: 'existing-native-pedestrian-disc-contact', pedestrian: p.i, footY: p._fy ?? p.y ?? null, verticalScope: pv ? 'explicit-interval' : 'unknown-height-conservatively-retained' };
    }
    return { valid: true, checked: people.length };
}

function sourcePlacement(T, v, b, endMarginM) {
    const e = b.edge;
    const legal = e.rail ? v.tram && canTravelTram(e, b.dir) : canTravel(e, b.dir) && ambientTrafficAccess(e);
    if (e !== v.edge || b.dir !== v.dir || b.lane !== v.lane || b.laneCur !== v.laneCur || !legal || e.a.mapEnd || e.b.mapEnd || (v.tram && !e.tram)) return { valid: false, reason: 'source-edge-direction-lane-access' };
    const clearance=sourceRoadClearance(T.world?.data,e,{...v,...b});
    if(clearance.eligible!==true)return{valid:false,reason:'source-clearance-access',clearance};
    if (!(b.laneCur >= 0 && b.laneCur < lanesDir(e, b.dir))) return { valid: false, reason: 'source-lane-index' };
    if (longBody(v)) {
        const span = T.sSpan(e, b.dir, b.length, true);
        return span && b.s >= span[0] - 1e-7 && b.s <= span[1] + 1e-7 ? { valid: true } : { valid: false, reason: 'native-long-source-leg-span' };
    }
    const span = ordinarySourceSpan(T, v, { endMarginM });
    if (span) return ordinarySourceBodyPlacement(span, b);
    const along = (b.x - e.a.x) * e.dirx + (b.z - e.a.z) * e.dirz, fx = -Math.sin(b.heading), fz = -Math.cos(b.heading);
    const extent = Math.abs(fx * e.dirx + fz * e.dirz) * b.length / 2 + Math.abs(-fz * e.dirx + fx * e.dirz) * b.width / 2;
    return along - extent >= endMarginM - 1e-7 && along + extent <= e.len - endMarginM + 1e-7 ? { valid: true } : { valid: false, reason: 'whole-ordinary-body-source-edge-containment' };
}

/** Apply accepted before-first-draw station repairs; return every unresolved
 * case. No hiding, pool cuts, new objects/IDs/mesh instances or RNG calls.
 */
export function admitInitialTraffic(T, { clearanceM = .05, spacingM = .25, endMarginM = .05, maxCandidates = 256, maxPasses = 2, staticCellM = .75 } = {}) {
    if ((T.time || 0) > 0 || (T._frame || 0) > 0) return { passed: false, applied: false, reason: 'initial-admission-after-physical-simulation-forbidden', updates: [], unresolved: [], scope: 'No live traffic re-admission or warps' };
    const vehicleArray = T.vehicles, poolArray = T.pool, original = T.vehicles.slice(), pool = T.pool?.slice() || [], states = original.map(v => ({ v, edge: v.edge, dir: v.dir, lane: v.lane, laneCur: v.laneCur, kind: v.kind, mesh: v.mesh, length: v.length, width: v.width }));
    const invalidRailModes = original.filter(v => (v.edge?.rail && (!v.tram || !canTravelTram(v.edge, v.dir))) || (v.tram && T.tramNetwork && !v.edge?.rail)).map(v => ({ id: v.id, sourceId: v.edge?.sourceId || v.edge?.access?.sourceId, dir: v.dir, reason: 'invalid-source-rail-mode-or-direction' }));
    let staticCandidates = 0, staticSamples = 0;
    const plan = planInitialVehicleAdmission(T.vehicles, {
        clearanceM, maxCandidatesPerVehicle: maxCandidates, maxPasses,
        canAdjust: v => !v.parked && !v.service,
        candidates: (v, b) => nativeInitialTrafficCandidates(T, { ...v, ...b }, { spacingM, endMarginM, maxCandidates }),
        validateCandidate: (v, b, context) => {
            const source = sourcePlacement(T, v, b, endMarginM); if (!source.valid) return source;
            if (!T.sharedLanes?.canPlace) return { valid: false, reason: 'missing-native-shared-lane-gate' };
            if (!T.sharedLanes.canPlace(b.edge, b.dir, context.bodies, context.bodies[context.index], b)) return { valid: false, reason: 'native-shared-lane-reservation' };
            const pedestrians = initialTrafficPedestrianClearance(T, b); if (!pedestrians.valid) return pedestrians;
            const physical = initialTrafficStaticClearance(T.world, b, { cellM: staticCellM }); staticCandidates++; staticSamples += physical.samples || 0; return physical;
        },
    });
    const applied = [];
    for (const update of plan.updates) {
        const v = update.vehicle; v.s = update.pose.s; T.placeOnLane(v, true, 0);
        applied.push({ id: v.id, edgeId: v.edge.id, sourceId: v.edge.access?.sourceId || null, before: update.previous, after: bodyPose(v), planned: update.pose });
    }
    T.grid.build(T.vehicles);
    const identityPreserved = T.vehicles === vehicleArray && T.pool === poolArray && T.vehicles.length === original.length && T.vehicles.every((v, i) => v === original[i]) && (T.pool?.length || 0) === pool.length && pool.every((v, i) => T.pool[i] === v) && states.every(s => ['edge', 'dir', 'lane', 'laneCur', 'kind', 'mesh', 'length', 'width'].every(k => s.v[k] === s[k]));
    const exactApplied = applied.every(a => ['x', 'y', 'z', 'heading', 's'].every(k => Math.abs(a.after[k] - a.planned[k]) < 1e-7));
    const actualUnresolved = [];
    for (let i = 0; i < T.vehicles.length; i++) for (let j = i + 1; j < T.vehicles.length; j++) {
        const a = T.vehicles[i], b = T.vehicles[j], span = (a.length + a.width + b.length + b.width) / 2 + clearanceM;
        if (Math.abs(a.x - b.x) > span || Math.abs(a.z - b.z) > span) continue;
        const conflict = initialVehicleConflict(a, b, { clearanceM }); if (conflict.conflict) actualUnresolved.push(conflict);
    }
    const invalidSourceClearance=T.vehicles.map(v=>({id:v.id,kind:v.kind,edgeId:v.edge?.id,clearance:sourceRoadClearance(T.world?.data,v.edge,v)})).filter(r=>r.clearance.eligible!==true);
    return { passed: plan.passed && identityPreserved && exactApplied && actualUnresolved.length === 0 && invalidRailModes.length === 0 && invalidSourceClearance.length===0, applied: true, updates: applied, initialConflicts: plan.initialConflicts, unresolved: actualUnresolved, plannedUnresolved: plan.unresolved, invalidRailModes, invalidSourceClearance, unknownHeights: plan.unknownHeights, invalidBodies: plan.invalidBodies, attempts: plan.attempts, originalIds: plan.originalIds, identityPreserved, exactApplied, rngDraws: 0, search: plan.search, staticCandidates, staticSamples, scope: 'Before-first-publication source-station repair; complete fleet pair/source-clearance audit, native static/source/shared-lane validation of accepted candidates. Existing untouched static contacts are not globally certified.' };
}
