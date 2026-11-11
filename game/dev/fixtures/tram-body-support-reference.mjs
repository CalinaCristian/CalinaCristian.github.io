// Equality oracle only: the tram body-support module exactly as it stood before its 2026-11-10 CPU reduction
// (master a5f80d75). game/dev/tram-body-support.test.mjs requires the live module to return the same results.
// Not imported by the game.
import { clipConvex, polygonArea } from '../../src/bridge-profile-geometry.js';
// Rigid tram proxy support over the shared source rail slab. No geometry,
// source path, actor collection, RNG or world mutation. Horizontal source pose
// remains the caller's; only physically required pitch/vertical anchoring fits.
const geometryCache = new WeakMap();
const fitCache = new WeakMap(), validationCache = new WeakMap();
const hashString = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };

function geometryInfo(geometry) {
    const position = geometry?.attributes?.position;
    if (!position?.count) return null;
    const cached = geometryCache.get(geometry);
    if (cached?.position === position && cached.positionVersion === position.version && cached.index === geometry.index && cached.indexVersion === geometry.index?.version) return cached;
    const points = Array.from({ length: position.count }, (_, i) => [position.getX(i), position.getY(i), position.getZ(i)]);
    if (!points.every(p => p.every(Number.isFinite))) return null;
    const minY = Math.min(...points.map(p => p[1])), support = points.filter(p => p[1] === minY);
    const frontZ = Math.min(...support.map(p => p[2])), rearZ = Math.max(...support.map(p => p[2]));
    if (!(rearZ > frontZ)) return null;
    const indices = geometry.index?.array || Uint32Array.from(points.map((_, i) => i));
    const fingerprint = hashString(points.map(p => p.join(',')).join(';') + '|' + indices.join(','));
    const result = { points, indices, minY, frontZ, rearZ, fingerprint, position, positionVersion: position.version, index: geometry.index, indexVersion: geometry.index?.version };
    geometryCache.set(geometry, result);
    return result;
}

const bounds = p => ({ x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), z0: Math.min(...p.map(q => q[2])), z1: Math.max(...p.map(q => q[2])) });
const overlaps = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function worldPoints(vehicle, geometry, y, pitch, roll = 0) {
    const scale = vehicle.mesh.scale || { x: 1, y: 1, z: 1 }, cp = Math.cos(pitch), sp = Math.sin(pitch), ch = Math.cos(vehicle.heading), sh = Math.sin(vehicle.heading), cr = Math.cos(roll), sr = Math.sin(roll);
    return geometry.points.map(p => {
        const xx = p[0] * scale.x, yy = p[1] * scale.y, z = p[2] * scale.z, x = cr * xx - sr * yy, y0 = sr * xx + cr * yy, y1 = cp * y0 - sp * z, z1 = sp * y0 + cp * z;
        return [vehicle.x + ch * x + sh * z1, y + y1, vehicle.z - sh * x + ch * z1];
    });
}
function poseHash(v, y, pitch, roll = 0) {
    const s = v.mesh.scale || { x: 1, y: 1, z: 1 };
    return hashString([v.edge?.id, v.dir, v.s, v.x, y, v.z, v.heading, pitch, roll, s.x, s.y, s.z].join('|'));
}
function nearbyPieces(supportAt, points, modelIds) {
    const box = bounds(points);
    return [...new Set(modelIds.flatMap(modelId => supportAt.inBox(box.x0, box.z0, box.x1, box.z1, { modelId })))];
}
function catalogueHash(pieces) {
    return hashString(pieces.map(p => {
        const x = p.poly.reduce((s, q) => s + q[0], 0) / p.poly.length, z = p.poly.reduce((s, q) => s + q[1], 0) / p.poly.length;
        return p.id + ':' + JSON.stringify([p.poly, p.top, p.band(x, z, 0), p.topProfile || null]);
    }).sort().join('|'));
}

// Sutherland-Hodgman clipping retains interpolated actual triangle height.
function clipTriangle(triangle, polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sign = Math.sign(area); if (!sign) return [];
    let result = triangle;
    for (let i = 0; i < polygon.length && result.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], value = p => sign * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
        const next = [];
        for (let j = 0; j < result.length; j++) {
            const p = result[j], q = result[(j + 1) % result.length], fp = value(p), fq = value(q);
            if (fp >= 0) next.push(p);
            if ((fp >= 0) !== (fq >= 0)) next.push(mix(p, q, fp / (fp - fq)));
        }
        result = next;
    }
    return result;
}

/** Maximum slab top minus actual triangle height along a clipped edge. Shared
 * C1 profiles are split at every quadratic/linear boundary by the renderer.
 * The quartile controls refuse a different unsupported function, not silently
 * approximate it. Roundoff tolerances validate algebra; no lift epsilon exists.
 */
function edgeMaximum(a, b, piece) {
    const dx = piece.b[0] - piece.a[0], dz = piece.b[1] - piece.a[1], l2 = dx * dx + dz * dz;
    const projection = p => ((p[0] - piece.a[0]) * dx + (p[2] - piece.a[1]) * dz) / l2;
    const u0 = projection(a), u1 = projection(b), fractions = [0, 1], candidates = [];
    // Mitered polygon ends can extend past the leg's perpendicular endpoint
    // planes; split at those clamp boundaries too.
    if (u0 !== u1) for (const u of [0, 1]) { const t = (u - u0) / (u1 - u0); if (t > 0 && t < 1) fractions.push(t); }
    fractions.sort((x, y) => x - y);
    for (let i = 1; i < fractions.length; i++) {
        const start = fractions[i - 1], span = fractions[i] - start;
        const at = t => { const p = mix(a, b, start + span * t); return { value: piece.band(p[0], p[2], 0).top - p[1], point: p }; };
        const lo = at(0), hi = at(1), mid = at(.5), A = 2 * (lo.value + hi.value - 2 * mid.value), B = hi.value - lo.value - A;
        const polynomial = t => (A * t + B) * t + lo.value;
        for (const t of [.25, .75]) if (Math.abs(at(t).value - polynomial(t)) > 1e-8) return null;
        candidates.push(lo, hi);
        if (A < 0) { const t = -B / (2 * A); if (t > 0 && t < 1) candidates.push(at(t)); }
    }
    return candidates.reduce((p, q) => q.value > p.value ? q : p);
}

/** Exact emitted triangle/slab overlap for the approved piecewise quadratic
 * support catalogue. Extrema lie on clipped edges (an interior stationary line
 * of a one-dimensional quadratic also meets the polygon boundary). */
export function minimumTramSupportLift(points, indices, pieces) {
    let required = -Infinity, witness = null, tested = 0;
    const catalogue = pieces.flatMap(piece => [[0, 1, 2], [0, 2, 3]].flatMap(index => {
        const top = index.map(i => piece.top[i]), poly=top.map(p=>[p[0],p[2]]),maxTop=Math.max(...piece.top.map(p=>p[1]));
        if(!piece.regions)return [{piece,top,poly,bounds:bounds(top),maxTop}];
        return piece.regions.map(region=>({piece:{...piece,band:region.band},top,poly:clipConvex(poly,region.poly),bounds:bounds(top),maxTop:Math.max(maxTop,region.maxTop)})).filter(e=>polygonArea(e.poly)>1e-10);
    }));
    for (let i = 0; i < indices.length; i += 3) {
        const triangle = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]], box = bounds(triangle), minY = Math.min(...triangle.map(p => p[1]));
        for (const entry of catalogue) {
            if (minY > entry.maxTop || !overlaps(box, entry.bounds)) continue;
            const clipped = clipTriangle(triangle, entry.poly); if (!clipped.length) continue;
            const [a, b, c] = entry.top, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
            for (let j = 0; j < clipped.length; j++) {
                const p = clipped[j], u = ((b[2] - c[2]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[2] - c[2])) / den, w = ((c[2] - a[2]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[2] - c[2])) / den;
                const renderedTop = u * a[1] + w * b[1] + (1 - u - w) * c[1], renderedNeed = renderedTop - p[1];
                if (renderedNeed > required) { required = renderedNeed; witness = { triangle: i / 3, point: p, slabTop: renderedTop, sourceId: entry.piece.sourceId, modelId: entry.piece.modelId, constraint: 'actual-rendered-slab-triangle' }; }
                const maximum = edgeMaximum(clipped[j], clipped[(j + 1) % clipped.length], entry.piece);
                if (!maximum) return { known: false, reason: 'unsupported-nonquadratic-shared-tram-support' };
                tested++;
                if (maximum.value > required) { required = maximum.value; witness = { triangle: i / 3, point: maximum.point, slabTop: maximum.point[1] + maximum.value, sourceId: entry.piece.sourceId, modelId: entry.piece.modelId, constraint: 'exact-continuous-slab-band' }; }
            }
        }
    }
    return { known: true, liftM: Math.max(0, required), rawClearanceM: Number.isFinite(required) ? -required : null, witness, testedEdges: tested };
}

export function fitTramBodySupport(vehicle, { samplePath, supportAt, nativePitch, actorBaseM = .24 } = {}) {
    const center = samplePath(vehicle, 0);
    if (!center) return { known: false, reason: 'unknown-center-source-tram-grade' };
    const baselineY = center.y + actorBaseM;
    if (!supportAt) return { known: true, y: baselineY, pitch: nativePitch, verticalOffsetM: 0, basis: 'unchanged-native-source-pose-no-shared-slab' };
    const geometry = geometryInfo(vehicle.mesh?.userData?._model?.geo);
    if (!geometry) return { known: false, reason: 'missing-actual-emitted-tram-support-geometry' };
    const scale = vehicle.mesh.scale || { x: 1, y: 1, z: 1 };
    if (![scale.x, scale.y, scale.z].every(v => Number.isFinite(v) && v > 0)) return { known: false, reason: 'unsupported-tram-model-scale' };
    const front = samplePath(vehicle, -geometry.frontZ * scale.z), rear = samplePath(vehicle, -geometry.rearZ * scale.z);
    const extremes = [samplePath(vehicle, vehicle.length / 2), samplePath(vehicle, -vehicle.length / 2)];
    if (!front || !rear || extremes.some(p => !p)) return { known: false, reason: 'unknown-actual-bogie-source-span' };
    const modelIds = [...new Set([center, front, rear, ...extremes].map(p => p.edge.grade.modelId).filter(Boolean))];
    if (!modelIds.length) return { known: true, y: baselineY, pitch: nativePitch, verticalOffsetM: 0, basis: 'unchanged-native-source-pose-outside-shared-slab-model' };
    if (typeof supportAt.inBox !== 'function') return { known: false, reason: 'missing-shared-tram-support-piece-query' };
    // Worlds/source catalogues are immutable after construction. Weak keys keep
    // no retired vehicle/world alive; moving actors always recompute exactly.
    const cacheKey = [geometry.fingerprint, poseHash(vehicle, baselineY, nativePitch), front.y, rear.y, ...extremes.map(p => p.y), ...modelIds].join('|'), cached = fitCache.get(vehicle);
    if (vehicle.speed === 0 && cached?.key === cacheKey && cached.supportAt === supportAt) return cached.result;
    const pitch = Math.atan2(front.y - rear.y, Math.hypot(front.x - rear.x, front.z - rear.z));
    const weight = geometry.rearZ / (geometry.rearZ - geometry.frontZ), bogieChordY = rear.y + (front.y - rear.y) * weight + actorBaseM;
    const anchorY = Math.max(baselineY, bogieChordY), points = worldPoints(vehicle, geometry, anchorY, pitch), pieces = nearbyPieces(supportAt, points, modelIds);
    if (pieces.some(p => !p.id)) return { known: false, reason: 'missing-shared-tram-support-piece-identities' };
    const fitted = minimumTramSupportLift(points, geometry.indices, pieces);
    if (!fitted.known) return fitted;
    const y = anchorY + fitted.liftM, pieceIds = pieces.map(p => p.id).sort();
    const result = { known: true, y, pitch, baselineY, bogieChordY, verticalOffsetM: y - baselineY, supportLiftM: fitted.liftM, rawClearanceM: fitted.rawClearanceM, witness: fitted.witness, testedEdges: fitted.testedEdges, pieceCount: pieces.length, pieceIds, piecesHash: catalogueHash(pieces), geometryFingerprint: geometry.fingerprint, poseHash: poseHash(vehicle, y, pitch), modelIds, actualSupport: { localMinY: geometry.minY, frontZ: geometry.frontZ, rearZ: geometry.rearZ, vertices: geometry.points.length }, basis: 'actual emitted lowest wheel-support chord and minimum rigid mesh vertical anchor over exact shared source rail slab; not an articulated model or measured suspension' };
    if (vehicle.speed === 0) fitCache.set(vehicle, { key: cacheKey, supportAt, result });
    return result;
}

/** Static admission rechecks actual geometry and the fresh exact catalogue;
 * certificate assertions alone cannot grant clearance. Other solids/ceilings
 * and other model IDs remain the caller's ordinary static checks. */
export function validateTramSupportCertificate(vehicle, supportAt) {
    const certificate = vehicle.railSupport, geometry = geometryInfo(vehicle.mesh?.userData?._model?.geo), pitch = vehicle.pitch ?? vehicle.mesh?.rotation?.x, roll = vehicle.roll ?? vehicle.mesh?.rotation?.z ?? 0;
    if (!certificate?.known || !geometry || !certificate.modelIds?.length || typeof supportAt?.inBox !== 'function') return { known: false, valid: false, reason: 'missing-actual-tram-support-certificate' };
    if (certificate.geometryFingerprint !== geometry.fingerprint || certificate.poseHash !== poseHash(vehicle, vehicle.y, pitch, roll)) return { known: false, valid: false, reason: 'stale-tram-support-geometry-or-pose' };
    const cacheKey = [certificate.poseHash, geometry.fingerprint, certificate.piecesHash, JSON.stringify(certificate.pieceIds), JSON.stringify(certificate.modelIds)].join('|'), cached = validationCache.get(vehicle);
    if (vehicle.speed === 0 && cached?.certificate === certificate && cached.key === cacheKey && cached.supportAt === supportAt) return cached.result;
    const points = worldPoints(vehicle, geometry, vehicle.y, pitch, roll), pieces = nearbyPieces(supportAt, points, certificate.modelIds), ids = pieces.map(p => p.id).sort();
    if (pieces.some(p => !p.id) || certificate.piecesHash !== catalogueHash(pieces) || JSON.stringify(certificate.pieceIds) !== JSON.stringify(ids)) return { known: false, valid: false, reason: 'stale-tram-support-piece-catalogue' };
    const clearance = minimumTramSupportLift(points, geometry.indices, pieces);
    const result = { known: clearance.known, valid: clearance.known && clearance.liftM <= 1e-7, reason: clearance.known ? (clearance.liftM <= 1e-7 ? 'actual-emitted-tram-geometry-above-own-slab' : 'actual-emitted-tram-own-slab-contact') : clearance.reason, geometryFingerprint: geometry.fingerprint, poseHash: certificate.poseHash, piecesHash: certificate.piecesHash, pieceIds: ids, bounds: bounds(points), requiredLiftM: clearance.liftM, witness: clearance.witness };
    if (vehicle.speed === 0) validationCache.set(vehicle, { certificate, key: cacheKey, supportAt, result });
    return result;
}
