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
            // A tram on a ramp has a new pitch on every step: without a bound this map grew for as long as it drove.
            if (cache.size >= 256) cache.clear();
            range = { min, max }; cache.set(key, range); modelYCache.set(geometry, cache);
        }
        if (finite(range.min) && finite(range.max) && range.max > range.min) return { min: y + range.min, max: y + range.max, known: true, source: 'emitted-model-vertices-YXZ' };
    }
    const height = v.height ?? mesh?.userData?.height;
    if (finite(height) && height > 0 && pitch === 0 && roll === 0) return { min: y, max: y + height, known: true, source: 'explicit-model-height-unpitched' };
    return { known: false, source: 'missing-emitted-model-height-or-orientation' };
}

const lengthProfiles = new WeakMap();
/** Actual emitted height range of the body between two stations of its own length (metres ahead of its centre), at its
 * pitch. vehicleVerticalInterval gives one range for the whole body: on a ramp that range holds the low end's underside
 * and the high end's roof at once, 1.4 m apart from either on a 36 m tram at 8 %. This is the same vertex data cut by
 * length; a triangle counts in every slice its length extent touches, with its whole height range, so no part of the
 * mesh is left out. Null when it cannot be had (roll, unknown geometry): the caller keeps the whole-body range.
 */
export function vehicleVerticalIntervalAlong(v, alongLo, alongHi) {
    const y = v.y, mesh = v.mesh, geometry = mesh?.userData?._model?.geo, a = geometry?.attributes?.position;
    const pitch = v.pitch ?? mesh?.rotation?.x ?? 0, roll = v.roll ?? mesh?.rotation?.z ?? 0, scale = v.scale || mesh?.scale || { x: 1, y: 1, z: 1 };
    if (v.verticalInterval || !finite(y) || !a?.count || typeof a.getX !== 'function' || roll !== 0 || ![pitch, scale.x, scale.y, scale.z, alongLo, alongHi].every(finite) || !(alongHi >= alongLo)) return null;
    let profile = lengthProfiles.get(geometry);
    if (!profile || profile.position !== a || profile.version !== a.version || profile.index !== geometry.index) {
        const SLICE = .25, index = geometry.index?.array, count = index ? index.length : a.count; let z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i < a.count; i++) { const z = a.getZ(i); if (!finite(z) || !finite(a.getY(i))) return null; z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const n = Math.max(1, Math.ceil((z1 - z0) / SLICE)), lo = new Float64Array(n).fill(Infinity), hi = new Float64Array(n).fill(-Infinity);
        for (let i = 0; i + 2 < count; i += 3) {
            const p = index ? [index[i], index[i + 1], index[i + 2]] : [i, i + 1, i + 2], zs = p.map(k => a.getZ(k)), ys = p.map(k => a.getY(k));
            const yl = Math.min(...ys), yh = Math.max(...ys);
            for (let k = Math.max(0, Math.floor((Math.min(...zs) - z0) / SLICE)), last = Math.min(n - 1, Math.floor((Math.max(...zs) - z0) / SLICE)); k <= last; k++) { if (yl < lo[k]) lo[k] = yl; if (yh > hi[k]) hi[k] = yh; }
        }
        lengthProfiles.set(geometry, profile = { position: a, version: a.version, index: geometry.index, z0, n, SLICE, lo, hi });
    }
    // native models face -z: a station `along` metres ahead of the centre is at local z = -along / scale.z
    const zl = -alongHi / scale.z, zh = -alongLo / scale.z, cx = Math.cos(pitch), sx = Math.sin(pitch);
    let min = Infinity, max = -Infinity;
    for (let k = Math.max(0, Math.floor((zl - profile.z0) / profile.SLICE)), last = Math.min(profile.n - 1, Math.floor((zh - profile.z0) / profile.SLICE)); k <= last; k++) {
        if (!(profile.hi[k] >= profile.lo[k])) continue;
        // same transform as vehicleVerticalInterval (YXZ, roll 0): world dy = cos(pitch) * y - sin(pitch) * z, over this slice's own length
        const za = Math.max(zl, profile.z0 + k * profile.SLICE) * scale.z, zb = Math.min(zh, profile.z0 + (k + 1) * profile.SLICE) * scale.z, a0 = -sx * za, a1 = -sx * zb;
        min = Math.min(min, cx * profile.lo[k] * scale.y + Math.min(a0, a1)); max = Math.max(max, cx * profile.hi[k] * scale.y + Math.max(a0, a1));
    }
    return max > min ? { min: y + min, max: y + max, known: true, source: 'emitted-model-triangles-by-length-YXZ' } : { min: Infinity, max: -Infinity, known: true, empty: true, source: 'no-emitted-model-in-this-stretch' };
}

/** SAT penetration of the actual drawn-heading length/width rectangles. */
function vehicleBodyPenetration(a, b) {
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
 * Direct repairs retain their existing candidate order. If none is clear, a
 * bounded transaction reserves a candidate and recursively repairs its flexible
 * blockers. Reservations prevent cycles; continuations backtrack earlier blocker
 * choices when a later body cannot fit. Failed branches roll back planned bodies,
 * updates and tentative records. No input/live body is applied during the search.
 *
 * Updates retain the original vehicle reference. Only the caller applies an
 * accepted pose before the first draw, then rebuilds its actual spatial grid.
 */
export function planInitialVehicleAdmission(vehicles, {
    candidates, validateCandidate, canAdjust = ordinary, interval = vehicleVerticalInterval,
    clearanceM = 0.05, maxCandidatesPerVehicle = 256, maxPasses = 2,
    maxSearchDepth = 6, maxSearchWork = 8192,
} = {}) {
    if (typeof candidates !== 'function' || typeof validateCandidate !== 'function') throw new Error('Exact native candidates and static/source/shared-lane validator required');
    if (!(clearanceM >= 0) || !Number.isInteger(maxCandidatesPerVehicle) || maxCandidatesPerVehicle < 1 || !Number.isInteger(maxPasses) || maxPasses < 1 || !Number.isInteger(maxSearchDepth) || maxSearchDepth < 0 || !Number.isInteger(maxSearchWork) || maxSearchWork < 1) throw new Error('Invalid admission bounds');
    const ids = new Set(vehicles.map(v => v.id)); if (ids.size !== vehicles.length) throw new Error('Every original vehicle needs a unique ID');
    const bodies = vehicles.map(v => ({ ...v })), updates = new Map(), attempts = [], initial = [];
    const invalidBodies = vehicles.filter(v => !validBody(v)).map(v => ({ id: v.id, reason: 'missing-or-invalid-native-body-pose-or-dimensions' }));
    const search = { maxDepth: maxSearchDepth, maxWork: maxSearchWork, work: 0, candidateTests: 0, validationCalls: 0, pairTests: 0, deepest: 0, maxReservedBodies: 0, transactions: 0, committedTransactions: 0, rolledBackBranches: 0, cyclePrunes: 0, depthPrunes: 0, workLimitReached: false };
    const conflict = (a, b) => { search.pairTests++; return initialVehicleConflict(a, b, { clearanceM, interval }); };
    function pairs() {
        const result = [];
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
            if (!canBeNear(bodies[i], bodies[j], clearanceM)) continue;
            const hit = conflict(bodies[i], bodies[j]); if (hit.conflict) result.push({ i, j, ...hit });
        }
        return result;
    }
    initial.push(...pairs());
    const trail = [], validationPeers = new Map();
    const checkpoint = () => ({ trail: trail.length, records: attempts.length });
    function reserve(index, body) {
        trail.push({ kind: 'body', index, body: bodies[index] });
        bodies[index] = body;
    }
    function recordUpdate(index, pose, previous, peerIndex) {
        const vehicle = vehicles[index], id = vehicle.id;
        trail.push({ kind: 'update', id, update: updates.get(id), hadUpdate: updates.has(id), peer: validationPeers.get(id), hadPeer: validationPeers.has(id) });
        updates.set(id, { vehicle, pose, previous: updates.get(id)?.previous || previous });
        validationPeers.set(id, peerIndex);
    }
    function rollback(mark) {
        while (trail.length > mark.trail) {
            const old = trail.pop();
            if (old.kind === 'body') bodies[old.index] = old.body;
            else {
                if (old.hadUpdate) updates.set(old.id, old.update); else updates.delete(old.id);
                if (old.hadPeer) validationPeers.set(old.id, old.peer); else validationPeers.delete(old.id);
            }
        }
        attempts.length = mark.records; search.rolledBackBranches++;
    }
    function work() {
        if (search.work >= maxSearchWork) { search.workLimitReached = true; return false; }
        search.work++; return true;
    }
    const contextFor = (index, peerIndex) => ({ bodies, index, peerIndex, conflict: conflict(bodies[index], bodies[peerIndex]) });
    function validate(index, body, peerIndex) {
        if (!work()) return { valid: false, reason: 'search-work-limit' };
        search.validationCalls++;
        return validateCandidate(vehicles[index], body, contextFor(index, peerIndex));
    }
    const accepted = validation => validation === true || validation?.valid === true;
    const rejection = validation => typeof validation?.reason === 'string' ? validation.reason : 'source-static-or-reservation-rejected';
    function firstBlocker(index, body, held) {
        let blocker = null;
        for (let k = 0; k < bodies.length; k++) if (k !== index && canBeNear(body, bodies[k], clearanceM)) {
            const hit = conflict(body, bodies[k]); if (!hit.conflict) continue;
            // A held collision cannot be repaired within this transaction.
            // Otherwise try the longer body first: resolving an easy short
            // neighbour must not repeatedly hide a constrained long blocker.
            // Equal lengths retain original fleet order; all candidates still
            // use the same complete native validation and rollback path.
            const locked = held.has(k), previousLocked = blocker && held.has(blocker.index);
            if (!blocker || (locked && !previousLocked) || (locked === previousLocked && bodies[k].length > bodies[blocker.index].length)) blocker = { index: k, hit };
        }
        return blocker;
    }
    function revalidateUpdates() {
        for (const [id] of updates) {
            const index = vehicles.findIndex(v => v.id === id);
            if (!accepted(validate(index, bodies[index], validationPeers.get(id)))) return false;
        }
        return true;
    }
    function relocate(index, peerIndex, held, finish) {
        const depth = held.size;
        if (held.has(index)) { search.cyclePrunes++; return false; }
        if (depth > maxSearchDepth) { search.depthPrunes++; return false; }
        const vehicle = vehicles[index], before = bodies[index]; if (!canAdjust(vehicle)) return false;
        search.deepest = Math.max(search.deepest, depth);
        const blocked = [], context = contextFor(index, peerIndex);
        function tryPose(pose, body, allowBlockers) {
            const mark = checkpoint(); reserve(index, body);
            const locked = new Set(held); locked.add(index); search.maxReservedBodies = Math.max(search.maxReservedBodies, locked.size);
            function clear(lockedBodies) {
                const blocker = firstBlocker(index, body, lockedBodies);
                if (blocker) {
                    if (!allowBlockers || lockedBodies.has(blocker.index)) { if (lockedBodies.has(blocker.index)) search.cyclePrunes++; return false; }
                    return relocate(blocker.index, index, lockedBodies, clear);
                }
                recordUpdate(index, pose, { x: before.x, y: before.y, z: before.z, heading: before.heading, s: before.s }, peerIndex);
                attempts.push({ id: vehicle.id, s: body.s, reason: 'accepted' });
                return finish(lockedBodies);
            }
            try { if (clear(locked)) return true; }
            catch (error) { rollback(mark); throw error; }
            rollback(mark); return false;
        }
        let tested = 0;
        for (const proposed of candidates(vehicle, before, context) || []) {
            if (++tested > maxCandidatesPerVehicle || !work()) break;
            search.candidateTests++;
            const pose = {}; for (const key of poseKeys) if (proposed[key] !== undefined) pose[key] = proposed[key];
            const validPose = ['x', 'y', 'z', 'heading', 's'].every(k => finite(pose[k] ?? before[k]));
            // A callback cannot replace source identity, lane/direction, fleet ID or dimensions.
            const changesContract = ['edge', 'dir', 'lane', 'laneCur', 'id', 'kind', 'length', 'width'].some(k => proposed[k] !== undefined && proposed[k] !== before[k]);
            if (!validPose || changesContract) { attempts.push({ id: vehicle.id, s: pose.s, reason: 'invalid-pose-or-source-fleet-contract-change' }); continue; }
            const body = { ...before, ...pose }, validation = validate(index, body, peerIndex);
            if (!accepted(validation)) { attempts.push({ id: vehicle.id, s: body.s, reason: rejection(validation) }); continue; }
            const blocker = firstBlocker(index, body, held);
            if (blocker) { attempts.push({ id: vehicle.id, s: body.s, reason: 'another-planned-body', blocker: blocker.hit }); blocked.push({ pose, body }); continue; }
            if (!interval(body).known) { attempts.push({ id: vehicle.id, s: body.s, reason: 'unknown-model-height' }); continue; }
            if (tryPose(pose, body, false)) return true;
        }
        // Prefer the existing direct repair before enlisting any neighbour.
        // Revisit blocked exact candidates in their original deterministic order.
        if (depth < maxSearchDepth) for (const { pose, body } of blocked) {
            if (!interval(body).known) continue;
            const validation = validate(index, body, peerIndex);
            if (!accepted(validation)) continue;
            if (tryPose(pose, body, true)) return true;
        }
        else if (blocked.length) search.depthPrunes++;
        return false;
    }
    function adjust(index, peerIndex) {
        search.transactions++;
        const result = relocate(index, peerIndex, new Set(), revalidateUpdates);
        if (result) search.committedTransactions++;
        trail.length = 0;
        return result;
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
    return { passed: unresolved.length === 0 && unknownHeights.length === 0 && invalidBodies.length === 0, invalidBodies, updates: [...updates.values()], bodies, initialConflicts: initial, unresolved, unknownHeights, attempts, search, originalIds: vehicles.map(v => v.id), rngDraws: 0, applied: false };
}
