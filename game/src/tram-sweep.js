// Swept cover of the rigid tram bodies along every usable source rail leg, at world-build time.
//
// The rail guard (Traffic.stepVehicle -> initialTrafficStaticClearance) refuses any tram step whose full-body disc cover
// meets a static body. A tram body is one rigid 27 m / 36 m box: its centre rides the source path and its heading is the
// chord between the path points 0.36 L ahead and behind, so on a bend its ends swing outside the straight rail corridor.
// Generated objects were kept out of the straight corridor only; a bollard row 2.4 m from the centreline still held a tram
// for good. This module reproduces those poses and that cover so that whatever the builder itself adds can stay out of
// them. A tram with sections (vehicles.js) is articulated: each section is posed and covered on its own, so on a bend
// the cover follows the rail (2026-11-12: one rigid 36 m box swung 1.3 m over the Basarab deck's railing line).
// It reads the source rail network and the emitted tram meshes; it moves no rail, no actor and no source object.
import { buildTramNetwork, sampleTramPath, tramContinuations, canTravelTram } from './tram-path.js';

export const TRAM_SWEEP_MODEL = {
    basis: 'MODEL: rigid tram body poses along the source rail (centre on the path, heading along the 0.36 L chord), covered as the rail guard covers them',
    stationM: .5,            // pose spacing along the path
    axleFraction: .36,       // Traffic.placeOnLane: heading chord of a long body
    anchorM: .24,            // body anchor above the rail path
    coverCellM: .75,         // initialBodyCover cell
    stationSlackM: .27,      // half a station of travel plus the heading change inside it
    lateralSlackM: .03,
    belowM: .05, aboveM: .25, // the fitted pose may sit up to the bogie chord above the centre anchor on a sag
};

const travels = (e, dir) => e.usable === true && e.publicTram !== false && e.throughTram !== false && e.railDirections.includes(dir);
const heightOn = (e, t) => e.grade?.heightAt ? e.grade.heightAt(t) : e.ya + (e.yb - e.ya) * t;

/** Every point `s` metres along the travel direction from the start of (edge, dir); all branches of a fork. */
export function tramPathPoints(edge, dir, s, out = [], depth = 0) {
    if (depth > 64) return out;
    if (s >= 0 && s <= edge.len) {
        const t = dir > 0 ? s / edge.len : 1 - s / edge.len, y = heightOn(edge, t);
        if (Number.isFinite(y)) out.push({ x: edge.a.x + (edge.b.x - edge.a.x) * t, z: edge.a.z + (edge.b.z - edge.a.z) * t, y });
    } else if (s > edge.len) {
        const node = dir > 0 ? edge.b : edge.a;
        for (const e of node.edges) if (e !== edge) { const d = e.a === node ? 1 : -1; if (travels(e, d)) tramPathPoints(e, d, s - edge.len, out, depth + 1); }
    } else {
        const node = dir > 0 ? edge.a : edge.b;
        for (const e of node.edges) if (e !== edge) { const d = e.b === node ? 1 : -1; if (travels(e, d)) tramPathPoints(e, d, s + e.len, out, depth + 1); }
    }
    return out;
}

/** Reach of the guard's disc cover beyond the body rectangle (initialBodyCover: circumscribed discs of each cell). */
export function coverReach(lengthM, widthM, cellM = TRAM_SWEEP_MODEL.coverCellM) {
    const nL = Math.max(1, Math.ceil(lengthM / cellM)), nW = Math.max(1, Math.ceil(widthM / cellM)), dl = lengthM / nL, dw = widthM / nW, radius = Math.hypot(dl / 2, dw / 2) + 1e-7;
    return { alongM: radius - dl / 2, acrossM: radius - dw / 2, radiusM: radius };
}

/** Body sizes and the (height, length) outline of each emitted tram model, from its actual mesh vertices. */
function tramBodyProfiles(makeVehicle, city = 'bucharest', kinds = ['tram-v3a', 'tram-imperio']) {
    return kinds.map(kind => {
        const group = makeVehicle(kind, '#ffffff', { city }); group.updateMatrixWorld(true);
        const yz = [];
        group.traverse(part => {
            const p = part.geometry?.attributes?.position; if (!p) return;
            const m = part.matrixWorld.elements;
            for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); yz.push([m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]); }
        });
        // only the extreme heights of each length slice can be extreme under a pitch
        const slices = new Map();
        for (const [y, z] of yz) { const k = Math.round(z * 4), s = slices.get(k); if (!s) slices.set(k, [y, y, z, z]); else { if (y < s[0]) { s[0] = y; s[2] = z; } if (y > s[1]) { s[1] = y; s[3] = z; } } }
        const outline = []; for (const s of slices.values()) outline.push([s[0], s[2]], [s[1], s[3]]);
        return { kind, lengthM: group.userData.length, widthM: group.userData.width, outline, sections: group.userData.sections || null };
    }).filter(b => b.lengthM > 0 && b.widthM > 0 && b.outline.length);
}

// one number per grid cell (unique within ±786 km of the origin at 24 m cells), cheaper to look up than an 'i,j' string
const cellKey = (i, j) => (i + 32768) * 65536 + (j + 32768);
// the part [t0, t1] of a segment (offset o, change d along one axis) within ±h of the axis, or null when it is empty
const slabOut = [0, 0];
function slab(o, d, h, t0, t1) {
    if (Math.abs(d) < 1e-12) { if (Math.abs(o) >= h) return null; slabOut[0] = t0; slabOut[1] = t1; return slabOut; }
    let e = (-h - o) / d, l = (h - o) / d; if (e > l) { const q = e; e = l; l = q; }
    t0 = Math.max(t0, e); t1 = Math.min(t1, l); if (t0 >= t1) return null;
    slabOut[0] = t0; slabOut[1] = t1; return slabOut;
}

/**
 * @param network buildTramNetwork(...) result (or { edges })
 * @param bodies  [{ lengthM, widthM, outline: [[y, z], ...] }]
 */
export function buildTramSweep(network, bodies, model = TRAM_SWEEP_MODEL, { keep = null } = {}) {
    const M = model, cell = 24, cells = new Map(), poses = [];
    const report = { basis: M.basis, stationM: M.stationM, bodies: bodies.map(b => ({ kind: b.kind, lengthM: b.lengthM, widthM: b.widthM })), legs: 0, poses: 0, openEnded: 0, outsideDomain: 0,
        coverHalfWidthM: Math.max(0, ...bodies.map(b => b.widthM / 2 + coverReach(b.lengthM, b.widthM, M.coverCellM).acrossM + M.lateralSlackM)) };
    const interval = (body, pitch) => {
        const c = Math.cos(pitch), s = Math.sin(pitch); let lo = Infinity, hi = -Infinity;
        for (const [y, z] of body.outline) { const a = y * c - z * s, b = y * c + z * s; lo = Math.min(lo, a, b); hi = Math.max(hi, a, b); }
        return [lo - M.belowM, hi + M.aboveM];
    };
    const add = (body, reach, C, F, R) => {
        const hx = F.x - R.x, hz = F.z - R.z, h = Math.hypot(hx, hz); if (h < 1e-6) return;
        const pitch = Math.atan2(F.y - R.y, h), [lo, hi] = interval(body, pitch), y = C.y + M.anchorM;
        const p = { x: C.x, z: C.z, fx: hx / h, fz: hz / h, hl: body.lengthM / 2 + reach.alongM + M.stationSlackM, hw: body.widthM / 2 + reach.acrossM + M.lateralSlackM, lo: y + lo, hi: y + hi, y, body };
        if (keep && !keep(p)) { report.outsideDomain++; return; }
        const ex = Math.abs(p.fx) * p.hl + Math.abs(p.fz) * p.hw, ez = Math.abs(p.fz) * p.hl + Math.abs(p.fx) * p.hw;
        for (let i = Math.floor((p.x - ex) / cell); i <= Math.floor((p.x + ex) / cell); i++) for (let j = Math.floor((p.z - ez) / cell); j <= Math.floor((p.z + ez) / cell); j++) {
            const k = cellKey(i, j); let list = cells.get(k); if (!list) cells.set(k, list = []); list.push(p);
        }
        poses.push(p);
    };
    // an articulated body (vehicles.js sections): every section posed as the guard poses it (tram-path.js
    // tramSectionPoses: centre on the rail, heading along 0.36 of its own length), along each concrete route a tram can
    // be on through a fork, never one branch ahead mixed with another behind
    const sectionBodies = new Map(bodies.filter(b => b.sections?.length).map(b => [b, b.sections.map(q => {
        const z0 = -q.along - q.length / 2 - .3, z1 = -q.along + q.length / 2 + .3, outline = b.outline.filter(([, z]) => z >= z0 && z <= z1).map(([y, z]) => [y, z + q.along]);
        return { q, body: { kind: b.kind, lengthM: q.length, widthM: b.widthM, outline: outline.length ? outline : b.outline, section: true } };
    })]));
    const reachOf = Math.max(0, ...[...sectionBodies.values()].flat().map(({ q }) => Math.abs(q.along) + q.length * .36)) + 1;
    const routes = (edge, dir, need, depth = 0) => { // forward choices past the end of (edge, dir), as Traffic route entries
        if (need <= 0 || depth > 12) return [[]];
        const out = [], ch = tramContinuations(edge, dir); if (!ch.length) return [[]];
        for (const c of ch) for (const r of routes(c.e, c.dir, need - c.e.len, depth + 1)) { out.push([c, ...r]); if (out.length >= 16) return out; }
        return out;
    };
    const hists = (edge, dir, need, depth = 0) => { // backward legs before the start of (edge, dir), last = the one right behind
        if (need <= 0 || depth > 12) return [[]];
        const start = dir > 0 ? edge.a : edge.b, out = [];
        const ch = start.edges.filter(e => e !== edge).map(e => ({ e, dir: e.b === start ? 1 : -1 })).filter(r => canTravelTram(r.e, r.dir)); if (!ch.length) return [[]];
        for (const c of ch) for (const h of hists(c.e, c.dir, need - c.e.len, depth + 1)) { out.push([...h, c]); if (out.length >= 16) return out; }
        return out;
    };
    for (const edge of network?.edges || []) {
        if (edge.usable !== true) continue; report.legs++;
        for (const dir of [1, -1]) {
            if (!travels(edge, dir)) continue;
            const count = Math.max(1, Math.ceil(edge.len / M.stationM));
            const combos = sectionBodies.size ? routes(edge, dir, reachOf).flatMap(route => hists(edge, dir, reachOf).map(hist => ({ route, hist }))) : [];
            for (const body of bodies) {
                const parts = sectionBodies.get(body);
                if (parts) {
                    for (const { q, body: sb } of parts) {
                        const reach = coverReach(q.length, body.widthM, M.coverCellM), d = q.length * M.axleFraction;
                        for (let i = 0; i <= count; i++) for (const { route, hist } of combos) {
                            const probe = { edge, dir, s: edge.len * i / count, route, hist };
                            let C, F, R; try { C = sampleTramPath(probe, q.along); F = sampleTramPath(probe, q.along + d); R = sampleTramPath(probe, q.along - d); } catch { C = null; }
                            if (!C || !F || !R) { report.openEnded++; continue; }
                            add(sb, reach, C, F, R);
                        }
                    }
                    report.articulated = true;
                    continue;
                }
                const reach = coverReach(body.lengthM, body.widthM, M.coverCellM), d = body.lengthM * M.axleFraction;
                for (let i = 0; i <= count; i++) {
                    const s = edge.len * i / count, C = tramPathPoints(edge, dir, s)[0], Fs = tramPathPoints(edge, dir, s + d), Rs = tramPathPoints(edge, dir, s - d);
                    if (!C || !Fs.length || !Rs.length) { report.openEnded++; continue; } // the guard has no pose there either
                    for (const F of Fs) for (const R of Rs) add(body, reach, C, F, R);
                }
            }
        }
    }
    report.poses = poses.length;
    const near = (x0, z0, x1, z1, fn) => {
        const seen = x1 - x0 > cell || z1 - z0 > cell ? new Set() : null;
        for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
            const list = cells.get(cellKey(i, j)); if (!list) continue;
            for (const p of list) { if (seen) { if (seen.has(p)) continue; seen.add(p); } if (fn(p)) return p; }
        }
        return null;
    };
    /** first pose whose cover a vertical cylinder (x, z, r) over [y0, y1] meets, or null; `pick` narrows the poses */
    const circle = (x, z, r = 0, y0 = -Infinity, y1 = Infinity, pick = null) => near(x - r, z - r, x + r, z + r, p => {
        if (!(y1 > p.lo && y0 < p.hi) || (pick && !pick(p))) return false;
        const dx = x - p.x, dz = z - p.z;
        return Math.abs(dx * p.fx + dz * p.fz) < p.hl + r && Math.abs(dz * p.fx - dx * p.fz) < p.hw + r;
    });
    /** first pose whose cover a wall segment a-b (thickness r) over [y0, y1] meets, or null */
    const segment = (a, b, r = 0, y0 = -Infinity, y1 = Infinity) => near(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, p => {
        if (!(y1 > p.lo && y0 < p.hi)) return false;
        const ua = (a[0] - p.x) * p.fx + (a[1] - p.z) * p.fz, va = (a[1] - p.z) * p.fx - (a[0] - p.x) * p.fz, ub = (b[0] - p.x) * p.fx + (b[1] - p.z) * p.fz, vb = (b[1] - p.z) * p.fx - (b[0] - p.x) * p.fz;
        // the slab test along the pose's length, then across it (written out: no arrays per pose, the same arithmetic)
        const span = slab(ua, ub - ua, p.hl + r, 0, 1); if (!span) return false;
        return !!slab(va, vb - va, p.hw + r, span[0], span[1]);
    });
    /** parts [f0, f1] of a wall that stay outside every cover; heights may vary linearly along it */
    const freeRuns = (a, b, { r = 0, y0a = -Infinity, y1a = Infinity, y0b = y0a, y1b = y1a, pieceM = .5 } = {}) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.ceil(len / pieceM)), runs = []; let run = null;
        for (let i = 0; i < count; i++) {
            const f0 = i / count, f1 = (i + 1) / count, p = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], q = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
            const lo = Math.min(y0a + (y0b - y0a) * f0, y0a + (y0b - y0a) * f1), hi = Math.max(y1a + (y1b - y1a) * f0, y1a + (y1b - y1a) * f1);
            if (segment(p, q, r, lo, hi)) { if (run) { runs.push(run); run = null; } } else if (run) run[1] = f1; else run = [f0, f1];
        }
        if (run) runs.push(run);
        return runs;
    };
    /** lowest body underside of any pose whose cover holds (x, z, r): what stands below it there is under the tram */
    const undersideOver = (x, z, r = 0, pick = null) => { let lo = Infinity; near(x - r, z - r, x + r, z + r, p => { const dx = x - p.x, dz = z - p.z; if ((!pick || pick(p)) && Math.abs(dx * p.fx + dz * p.fz) < p.hl + r && Math.abs(dz * p.fx - dx * p.fz) < p.hw + r) lo = Math.min(lo, p.lo); return false; }); return lo; };
    return { poses, report, circle, segment, freeRuns, undersideOver };
}

/** The sweep of a district: source rail network (every usable leg, a superset of what traffic admits) and emitted fleet. */
export function districtTramSweep(data, { resolveGrade, makeVehicle, city, inside = null }) {
    if (!(data?.trams || []).length || typeof makeVehicle !== 'function') return null;
    const network = buildTramNetwork(data, { resolveGrade }), bodies = tramBodyProfiles(makeVehicle, city);
    if (!network.edges.length || !bodies.length) return null;
    // The guard refuses a body that is not wholly inside the district, and a tram plans its stop before that (Traffic.
    // railDistrictLimit). A pose whose centre or either end is outside is never taken: nothing has to make room for it.
    // (Keeping poses with one point inside cut the road-closed barriers at the district edge down to half a road.)
    const keep = inside ? p => [0, 1, -1].every(k => inside(p.x + p.fx * k * p.body.lengthM / 2, p.z + p.fz * k * p.body.lengthM / 2)) : null;
    return buildTramSweep(network, bodies, TRAM_SWEEP_MODEL, { keep });
}
