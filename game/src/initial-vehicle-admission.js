// Before-first-publication vehicle admission. No RNG, source edits, fleet mutation
// or rendering dependencies. The caller supplies exact native candidate poses and
// validates source legality, static bodies and shared-lane/transit reservations.
const finite = Number.isFinite;
const modelYCache = new WeakMap();

/** Actual primary emitted model geometry, transformed by the native vehicle pose.
 * Explicit intervals support externally transformed parents/candidate fixtures.
 * Unknown geometry/height stays observable; no universal floor/height is invented.
 */
export function vehicleVerticalInterval(v) {
    if (v.verticalInterval && finite(v.verticalInterval.min) && finite(v.verticalInterval.max)) {
        return { ...v.verticalInterval, known: v.verticalInterval.max > v.verticalInterval.min, source: v.verticalInterval.source || 'explicit-native-interval' };
    }
    const y = v.y;
    if (!finite(y)) return { known: false, source: 'unknown-world-y' };
    const mesh = v.mesh, geometry = mesh?.userData?._model?.geo, a = geometry?.attributes?.position;
    const pitch = v.pitch ?? mesh?.rotation?.x ?? 0, roll = v.roll ?? mesh?.rotation?.z ?? 0;
    const scale = v.scale || mesh?.scale || { x: 1, y: 1, z: 1 };
    if (a && a.count && typeof a.getX === 'function' && [pitch, roll, scale.x, scale.y, scale.z].every(finite)) {
        // Native makeVehicle groups use YXZ: yaw does not change world Y.
        // Cache local transformed bounds per actual geometry/pitch/roll/scale.
        const key = [pitch, roll, scale.x, scale.y, scale.z].join(','), cache = modelYCache.get(geometry) || new Map();
        let range = cache.get(key);
        if (!range) {
            const cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < a.count; i++) {
                const yy = cx * sz * a.getX(i) * scale.x + cx * cz * a.getY(i) * scale.y - sx * a.getZ(i) * scale.z;
                min = Math.min(min, yy); max = Math.max(max, yy);
            }
            range = { min, max }; cache.set(key, range); modelYCache.set(geometry, cache);
        }
        if (finite(range.min) && finite(range.max) && range.max > range.min) return { min: y + range.min, max: y + range.max, known: true, source: 'emitted-model-vertices-YXZ' };
    }
    const height = v.height ?? mesh?.userData?.height;
    if (finite(height) && height > 0 && pitch === 0 && roll === 0) return { min: y, max: y + height, known: true, source: 'explicit-model-height-unpitched' };
    return { known: false, source: 'missing-emitted-model-height-or-orientation' };
}

/** SAT penetration of the actual drawn-heading length/width rectangles. */
export function vehicleBodyPenetration(a, b) {
    const afx = -Math.sin(a.heading), afz = -Math.cos(a.heading), bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading);
    const dx = b.x - a.x, dz = b.z - a.z;
    let min = Infinity;
    for (const [ux, uz] of [[afx, afz], [-afz, afx], [bfx, bfz], [-bfz, bfx]]) {
        const ra = Math.abs(afx * ux + afz * uz) * a.length / 2 + Math.abs(-afz * ux + afx * uz) * a.width / 2;
        const rb = Math.abs(bfx * ux + bfz * uz) * b.length / 2 + Math.abs(-bfz * ux + bfx * uz) * b.width / 2;
        min = Math.min(min, ra + rb - Math.abs(dx * ux + dz * uz));
    }
    return min;
}

export function initialVehicleConflict(a, b, { clearanceM = 0, interval = vehicleVerticalInterval } = {}) {
    const penetration = vehicleBodyPenetration(a, b), av = interval(a), bv = interval(b);
    const unknownHeight = !av.known || !bv.known;
    const verticalOverlapM = unknownHeight ? null : Math.min(av.max, bv.max) - Math.max(av.min, bv.min);
    return { a: a.id, b: b.id, penetration, verticalOverlapM, unknownHeight, conflict: penetration > -clearanceM && (unknownHeight || verticalOverlapM > 0), aVertical: av, bVertical: bv };
}

/** Candidate ordinary-car stations, nearest first, full body within its unchanged
 * mapped edge. The old 4 m centre margin is a procedural spawn heuristic.
 * Long transit keeps its native connected-leg rules through a caller iterator.
 */
export function* ordinaryVehicleStations(v, { spacingM = 0.25, endMarginM = 0.05, maxCandidates = 256 } = {}) {
    if (v.long || v.bus || v.tram || !v.edge || !(v.edge.len > 0) || !(v.length > 0) || !finite(v.s)) return;
    if (!(spacingM > 0) || !(endMarginM >= 0) || !Number.isInteger(maxCandidates) || maxCandidates < 1) throw new Error('Invalid station search bounds');
    const lo = v.length / 2 + endMarginM, hi = v.edge.len - lo;
    if (hi < lo) return;
    const origin = Math.max(lo, Math.min(hi, v.s)), seen = new Set(); let count = 0;
    const candidates = [lo, hi, origin];
    const n = Math.min(maxCandidates, Math.ceil((hi - lo) / spacingM));
    for (let i = 1; i <= n; i++) for (const s of [origin - i * spacingM, origin + i * spacingM]) if (s >= lo && s <= hi) candidates.push(s);
    candidates.sort((a, b) => Math.abs(a - v.s) - Math.abs(b - v.s) || a - b);
    for (const s of candidates) { const key = s.toFixed(9); if (seen.has(key)) continue; seen.add(key); yield s; if (++count >= maxCandidates) return; }
}

const validBody = v => ['x', 'y', 'z', 'heading', 'length', 'width'].every(k => finite(v[k])) && v.length > 0 && v.width > 0;
const poseKeys = ['x', 'y', 'z', 'heading', 's', 'pitch', 'roll', 'verticalInterval'];
const ordinary = v => !(v.long || v.bus || v.tram || v.service);
const canBeNear = (a, b, margin) => Math.abs(a.x - b.x) <= (a.length + a.width + b.length + b.width) / 2 + margin && Math.abs(a.z - b.z) <= (a.length + a.width + b.length + b.width) / 2 + margin;

/** Return a plan; never move/replace/delete an input object, mutate its mesh,
 * change lane/dir/source edge/fleet dimensions or consume RNG.
 *
 * candidates(vehicle, currentBody, context) yields exact native snapped POSEs.
 * validateCandidate(vehicle, pose, context) MUST validate static/source/shared-
 * lane constraints. context.bodies contains every current planned body.
 * canAdjust defaults to ordinary cars: a constrained long body may instead
 * cause its earlier ordinary peer to move. Callers may enable long-body plans
 * with their native connected-leg candidate/validation semantics.
 *
 * Updates retain the original vehicle reference. Only the caller applies an
 * accepted pose before the first draw, then rebuilds its actual spatial grid.
 */
export function planInitialVehicleAdmission(vehicles, {
    candidates, validateCandidate, canAdjust = ordinary, interval = vehicleVerticalInterval,
    clearanceM = 0.05, maxCandidatesPerVehicle = 256, maxPasses = 2,
} = {}) {
    if (typeof candidates !== 'function' || typeof validateCandidate !== 'function') throw new Error('Exact native candidates and static/source/shared-lane validator required');
    if (!(clearanceM >= 0) || !Number.isInteger(maxCandidatesPerVehicle) || maxCandidatesPerVehicle < 1 || !Number.isInteger(maxPasses) || maxPasses < 1) throw new Error('Invalid admission bounds');
    const ids = new Set(vehicles.map(v => v.id)); if (ids.size !== vehicles.length) throw new Error('Every original vehicle needs a unique ID');
    const bodies = vehicles.map(v => ({ ...v })), updates = new Map(), attempts = [], initial = [];
    const invalidBodies = vehicles.filter(v => !validBody(v)).map(v => ({ id: v.id, reason: 'missing-or-invalid-native-body-pose-or-dimensions' }));
    const conflict = (a, b) => initialVehicleConflict(a, b, { clearanceM, interval });
    function pairs() {
        const result = [];
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
            if (!canBeNear(bodies[i], bodies[j], clearanceM)) continue;
            const hit = conflict(bodies[i], bodies[j]); if (hit.conflict) result.push({ i, j, ...hit });
        }
        return result;
    }
    initial.push(...pairs());
    function adjust(index, peerIndex) {
        const vehicle = vehicles[index], before = bodies[index]; if (!canAdjust(vehicle)) return false;
        const context = { bodies, index, peerIndex, conflict: conflict(before, bodies[peerIndex]) };
        let tested = 0;
        for (const proposed of candidates(vehicle, before, context) || []) {
            if (++tested > maxCandidatesPerVehicle) break;
            const pose = {}; for (const key of poseKeys) if (proposed[key] !== undefined) pose[key] = proposed[key];
            const validPose = ['x', 'y', 'z', 'heading', 's'].every(k => finite(pose[k] ?? before[k]));
            // A callback cannot replace source identity, lane/direction, fleet ID or dimensions.
            const changesContract = ['edge', 'dir', 'lane', 'laneCur', 'id', 'kind', 'length', 'width'].some(k => proposed[k] !== undefined && proposed[k] !== before[k]);
            if (!validPose || changesContract) { attempts.push({ id: vehicle.id, s: pose.s, reason: 'invalid-pose-or-source-fleet-contract-change' }); continue; }
            const body = { ...before, ...pose }, validation = validateCandidate(vehicle, body, context);
            const ok = validation === true || validation?.valid === true;
            if (!ok) { attempts.push({ id: vehicle.id, s: body.s, reason: typeof validation?.reason === 'string' ? validation.reason : 'source-static-or-reservation-rejected' }); continue; }
            let blocker = null;
            for (let k = 0; k < bodies.length; k++) if (k !== index && canBeNear(body, bodies[k], clearanceM)) {
                const hit = conflict(body, bodies[k]); if (hit.conflict) { blocker = hit; break; }
            }
            if (blocker) { attempts.push({ id: vehicle.id, s: body.s, reason: 'another-planned-body', blocker }); continue; }
            if (!interval(body).known) { attempts.push({ id: vehicle.id, s: body.s, reason: 'unknown-model-height' }); continue; }
            bodies[index] = body; updates.set(vehicle.id, { vehicle, pose, previous: updates.get(vehicle.id)?.previous || { x: before.x, y: before.y, z: before.z, heading: before.heading, s: before.s } });
            attempts.push({ id: vehicle.id, s: body.s, reason: 'accepted' }); return true;
        }
        return false;
    }
    for (let pass = 0; pass < maxPasses; pass++) {
        let changed = false;
        for (const pair of pairs()) {
            if (!conflict(bodies[pair.i], bodies[pair.j]).conflict) continue;
            // Later ordinary body first; a constrained bus/tram may stay while
            // its earlier flexible peer uses an exact source-legal station.
            changed = adjust(pair.j, pair.i) || adjust(pair.i, pair.j) || changed;
        }
        if (!changed) break;
    }
    const unresolved = pairs(), unknownHeights = bodies.filter(v => !interval(v).known).map(v => ({ id: v.id, interval: interval(v) }));
    return { passed: unresolved.length === 0 && unknownHeights.length === 0 && invalidBodies.length === 0, invalidBodies, updates: [...updates.values()], bodies, initialConflicts: initial, unresolved, unknownHeights, attempts, originalIds: vehicles.map(v => v.id), rngDraws: 0, applied: false };
}
