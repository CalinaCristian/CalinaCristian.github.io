// Shared offline/runtime source roof contract. Heights are metres above the source base.
// A positive height is the complete building, including the roof, never the eaves.
const EPS = 1e-8;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const number = v => typeof v === 'number' ? v : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(v ?? '').trim()) ? +v : NaN;
export function parseMeasure(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const s = String(value ?? '').trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
    const feet = s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:ft|feet|foot|')\s*(?:(\d+(?:\.\d*)?|\.\d+)\s*(?:in|inches|inch|"))?$/);
    if (feet) return +feet[1] * 0.3048 + (+feet[1] < 0 ? -1 : 1) * +(feet[2] || 0) * 0.0254;
    const m = s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(m|metres?|meters?|cm|mm|in|inches|inch|")?$/);
    if (!m) return NaN;
    return +m[1] * (/^(in|inch|inches|")$/.test(m[2]) ? 0.0254 : m[2] === 'cm' ? 0.01 : m[2] === 'mm' ? 0.001 : 1);
}
export function parseRoofDirection(value) {
    const s = String(value ?? '').trim().toUpperCase();
    const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const n = compass.includes(s) ? compass.indexOf(s) * 22.5 : number(s.replace(/\s*°$/, ''));
    return Number.isFinite(n) ? ((n % 360) + 360) % 360 : null;
}
function frame(ring, direction, orientation) {
    let axis = null, best = Infinity;
    if (direction !== null) axis = [Math.sin(direction * Math.PI / 180), -Math.cos(direction * Math.PI / 180)];
    if (!axis) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < EPS) continue;
        const n = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length], q = ring.map(p => p[0] * n[0] + p[1] * n[1]), width = Math.max(...q) - Math.min(...q);
        if (width < best - EPS) { best = width; axis = n; }
    }
    axis ||= [1, 0];
    if (direction === null && orientation === 'across') axis = [-axis[1], axis[0]];
    const q = ring.map(p => p[0] * axis[0] + p[1] * axis[1]);
    return { axis, low: Math.min(...q), high: Math.max(...q) };
}
const supported = new Set(['flat', 'gabled', 'hipped', 'skillion', 'pyramidal', 'mansard', 'dome', 'round']);
export function makeRoofProfile({ tags = {}, ring, holes = [], triangulate, shape = 'flat', height, minHeight = 0, heightSource = 'estimate', heightIsTotal = false }) {
    const issues = [], rawShape = tags['roof:shape'];
    const aliases = { pitched: 'hipped', pyramid: 'pyramidal', lean_to: 'skillion' };
    shape = aliases[rawShape || shape] || rawShape || aliases[shape] || shape;
    if (!supported.has(shape)) { issues.push('unsupported roof:shape=' + shape); shape = aliases[shape] || (shape === 'gambrel' ? 'mansard' : shape === 'half-hipped' ? 'hipped' : shape === 'saltbox' ? 'gabled' : 'hipped'); }
    const direction = parseRoofDirection(tags['roof:direction']), orientation = tags['roof:orientation'];
    if (tags['roof:direction'] != null && direction === null) issues.push('invalid roof:direction=' + tags['roof:direction']);
    if (orientation && !['along', 'across'].includes(orientation)) issues.push('unsupported roof:orientation=' + orientation);
    const { axis, low, high } = frame(ring, direction, orientation), run = (high - low) / (shape === 'skillion' ? 1 : 2);
    const roofHeight = parseMeasure(tags['roof:height']), angle = number(String(tags['roof:angle'] ?? '').replace(/\s*°$/, '')), levels = number(tags['roof:levels']);
    let rise = 0, riseSource = 'flat';
    if (shape !== 'flat') {
        if (roofHeight >= 0) { rise = roofHeight; riseSource = 'OSM roof:height'; }
        else if (angle >= 0 && angle < 90) { rise = Math.tan(angle * Math.PI / 180) * run; riseSource = 'OSM roof:angle'; }
        else if (levels > 0) { rise = levels * 2.6; riseSource = 'roof:levels estimate'; }
        else { rise = clamp(run * (shape === 'skillion' ? 0.18 : shape === 'mansard' ? 0.55 : 0.35), 0.8, shape === 'skillion' ? 3 : 6); riseSource = 'footprint estimate'; }
    } else if (roofHeight > 0) issues.push('flat roof with positive roof:height');
    for (const [key, value, valid] of [['roof:height', roofHeight, roofHeight >= 0], ['roof:angle', angle, angle >= 0 && angle < 90], ['roof:levels', levels, levels >= 0]]) if (tags[key] != null && !valid) issues.push('invalid ' + key + '=' + tags[key]);
    if (triangulate && riseSource === 'OSM roof:angle' && !['gabled', 'skillion'].includes(shape)) {
        const mesh = roofMesh(ring, holes, { shape, axis, low, high, eavesM: 0, riseM: 1 }, triangulate);
        rise = mesh.runM * Math.tan(angle * Math.PI / 180);
    }
    let totalM = heightIsTotal ? height : height + rise, eavesM = heightIsTotal ? height - rise : height;
    if (eavesM < minHeight) { issues.push('roof rise exceeds building height band'); eavesM = minHeight; rise = Math.max(0, totalM - eavesM); }
    // Preserve the literal top. An inconsistent minimum remains an explicit source issue.
    if (minHeight > totalM) issues.push('minimum height exceeds total height');
    else if (totalM > 0 && minHeight === totalM) issues.push('zero vertical source band: minimum height equals total height');
    const raw = Object.fromEntries(['height', 'min_height', 'building:levels', 'building:min_level', 'roof:shape', 'roof:height', 'roof:angle', 'roof:direction', 'roof:orientation', 'roof:levels'].filter(k => tags[k] != null).map(k => [k, tags[k]]));
    return { version: 1, shape, totalM, eavesM, riseM: rise, heightSource, riseSource, axis, low, high, ...(direction !== null ? { direction } : {}), ...(orientation ? { orientation } : {}), ...(angle >= 0 && angle < 90 ? { angle } : {}), raw, ...(tags.__originalDimensions ? { originalOSM: tags.__originalDimensions } : {}), ...(issues.length ? { issues } : {}) };
}
export function validRoofProfile(p, total, minHeight = 0) {
    return p?.version === 1 && supported.has(p.shape) && [p.totalM, p.eavesM, p.riseM, p.low, p.high, ...p.axis || []].every(Number.isFinite) && p.axis?.length === 2 && Math.abs(p.totalM - total) < 0.0002 && p.eavesM >= minHeight - EPS && p.riseM >= 0 && Math.abs(p.eavesM + p.riseM - p.totalM) < 0.0002;
}
export function roofSignature(b) {
    return JSON.stringify(['nativeRoofMesh:2', b.i, b.h, b.minH, b.ring, b.holes || [], b.roofProfile], (key, v) => typeof v === 'number' ? Math.round(v * 1e4) : v);
}
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function distance(p, rings) {
    let best = Infinity;
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], den = dx * dx + dz * dz;
        const t = den ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / den, 0, 1) : 0;
        best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz));
    }
    return best;
}
function split(poly, value, cut, keepPositive) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = value(a) - cut, db = value(b) - cut;
        if (keepPositive ? da >= -EPS : da <= EPS) out.push(a);
        if (da * db < -EPS * EPS) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
}
// All shared triangulation edges use the same midpoint and height. Inner rings remain holes.
// Directional gables/skillion are exact planes; irregular hips use a low-poly boundary-distance surface.
export function roofMesh(ring, holes, profile, triangulate) {
    const { pts, tris } = triangulate(ring, holes), p = profile, q = v => v[0] * p.axis[0] + v[1] * p.axis[1], middle = (p.low + p.high) / 2;
    const along = v => -v[0] * p.axis[1] + v[1] * p.axis[0], us = ring.map(along), u0 = Math.min(...us), u1 = Math.max(...us), half = (p.high - p.low) / 2;
    // Surveyed rectangles often retain extra vertices and centimetre-scale edge jogs.
    // Keep their complete source polygon, but avoid turning each earcut triangle into a hill.
    const area = Math.abs(ring.reduce((sum, v, i) => { const w = ring[(i + 1) % ring.length]; return sum + v[0] * w[1] - w[0] * v[1]; }, 0)) / 2;
    const edgeTolerance = Math.max(0.001, Math.min(p.high - p.low, u1 - u0) * 0.01);
    const rectangle = !holes.length && area >= (p.high - p.low) * (u1 - u0) * 0.99 && ring.every(v => Math.min(Math.abs(q(v) - p.low), Math.abs(q(v) - p.high), Math.abs(along(v) - u0), Math.abs(along(v) - u1)) <= edgeTolerance);
    const exactHip = rectangle && ['hipped', 'pyramidal', 'mansard'].includes(p.shape);
    const simple = ['flat', 'gabled', 'skillion', 'round'].includes(p.shape) || exactHip, triangles = [];
    const curveCuts = p.shape === 'round' ? Array.from({ length: 17 }, (_, i) => p.low + (p.high - p.low) * i / 16) : [];
    const endRun = p.shape === 'pyramidal' ? (u1 - u0) / 2 : Math.min(half, (u1 - u0) / 2);
    const planes = exactHip ? [...[v => (q(v) - p.low) / half, v => (p.high - q(v)) / half, v => (along(v) - u0) / endRun, v => (u1 - along(v)) / endRun].map(f => p.shape === 'mansard' ? v => f(v) * 1.8 : f), () => 1] : [];
    for (const indices of tris) {
        const t = indices.map(i => pts[i]);
        if (exactHip) {
            // Clip each source triangle to the region owned by each roof plane.
            const linear = planes;
            for (let i = 0; i < linear.length; i++) { let poly = t; for (let j = 0; j < linear.length && poly.length; j++) if (i !== j) poly = split(poly, v => linear[j](v) - linear[i](v), 0, true); for (let j = 1; j < poly.length - 1; j++) triangles.push([poly[0], poly[j], poly[j + 1]]); }
        } else if (p.shape === 'round') {
            for (let i = 1; i < curveCuts.length; i++) {
                const poly = split(split(t, q, curveCuts[i - 1], true), q, curveCuts[i], false);
                for (let j = 1; j < poly.length - 1; j++) triangles.push([poly[0], poly[j], poly[j + 1]]);
            }
        } else if (p.shape === 'gabled') {
            for (const positive of [false, true]) { const poly = split(t, q, middle, positive); for (let i = 1; i < poly.length - 1; i++) triangles.push([poly[0], poly[i], poly[i + 1]]); }
        } else if (simple) triangles.push(t);
        else {
            const centre = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
            for (let i = 0; i < 3; i++) { const a = t[i], b = t[(i + 1) % 3], m = midpoint(a, b); triangles.push([a, m, centre], [m, b, centre]); }
        }
    }
    const rings = [ring, ...holes], maxD = simple ? 1 : Math.max(EPS, ...triangles.flat().map(v => distance(v, rings)));
    const at = v => {
        const width = Math.max(EPS, p.high - p.low);
        let f = exactHip ? Math.min(...planes.map(f => f(v))) : p.shape === 'flat' ? 0 : p.shape === 'skillion' ? (p.high - q(v)) / width : p.shape === 'gabled' ? 1 - Math.abs(q(v) - middle) * 2 / width : p.shape === 'round' ? Math.sqrt(Math.max(0, 1 - ((q(v) - middle) * 2 / width) ** 2)) : distance(v, rings) / maxD;
        if (!exactHip && p.shape === 'mansard') f = Math.min(1, f * 1.8);
        if (p.shape === 'dome') f = Math.sqrt(Math.max(0, 1 - (1 - f) ** 2));
        return [v[0], p.eavesM + p.riseM * clamp(f, 0, 1), v[1]];
    };
    const faces = triangles.map(t => t.map(at)), walls = [], wallNormals = [];
    if (simple && p.riseM > EPS) for (const boundary of rings) for (let i = 0; i < boundary.length; i++) {
        const a = boundary[i], b = boundary[(i + 1) % boundary.length], da = q(a) - middle, db = q(b) - middle, line = [a];
        if (p.shape === 'gabled' && da * db < -EPS * EPS) { const t = da / (da - db); line.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
        if (p.shape === 'round') {
            const cuts = curveCuts.slice(1, -1).filter(cut => (q(a) - cut) * (q(b) - cut) < -EPS * EPS).map(cut => (cut - q(a)) / (q(b) - q(a))).sort((a, b) => a - b);
            for (const t of cuts) line.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        if (exactHip) {
            const cuts = [];
            for (let j = 0; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
                const start = planes[j](a) - planes[k](a), end = planes[j](b) - planes[k](b);
                if (start * end < -EPS * EPS) cuts.push(start / (start - end));
            }
            for (const t of [...new Set(cuts)].sort((a, b) => a - b)) line.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        line.push(b);
        const area = boundary.reduce((sum, v, k) => { const w = boundary[(k + 1) % boundary.length]; return sum + v[0] * w[1] - w[0] * v[1]; }, 0), sign = Math.sign(area) * (boundary === ring ? 1 : -1);
        for (let k = 1; k < line.length; k++) { const x = line[k - 1], z = line[k], a3 = at(x), b3 = at(z); if (a3[1] > p.eavesM + EPS || b3[1] > p.eavesM + EPS) { walls.push([[x[0], p.eavesM, x[1]], [z[0], p.eavesM, z[1]], b3, a3]); wallNormals.push([sign * (z[1] - x[1]), 0, -sign * (z[0] - x[0])]); } }
    }
    return { faces: faces.filter(t => triangleArea3(t) > EPS), walls, wallNormals, runM: (exactHip ? half : simple ? (p.high - p.low) / (p.shape === 'skillion' ? 1 : 2) : maxD) / (p.shape === 'mansard' ? 1.8 : 1), heightAt(x, z, radius = 0) {
        for (const [a, b, c] of faces) {
            const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < EPS) continue;
            const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
            if (u >= -EPS && v >= -EPS && u + v <= 1 + EPS) return u * a[1] + v * b[1] + (1 - u - v) * c[1];
        }
        let nearby = null;
        if (radius > 0) for (const triangle of faces) for (let i = 0; i < 3; i++) {
            const a = triangle[i], b = triangle[(i + 1) % 3], dx = b[0] - a[0], dz = b[2] - a[2], den = dx * dx + dz * dz;
            const t = den ? clamp(((x - a[0]) * dx + (z - a[2]) * dz) / den, 0, 1) : 0;
            if (Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz) <= radius) nearby = Math.max(nearby ?? -Infinity, a[1] + (b[1] - a[1]) * t);
        }
        return nearby;
    } };
}

function clip3(poly, value, positive) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = value(a), db = value(b);
        if (positive ? da >= 0 : da <= 0) out.push(a);
        if (da * db < 0) { const t = da / (da - db); out.push(a.map((v, k) => v + (b[k] - v) * t)); }
    }
    return out;
}
const triangleArea3 = ([a, b, c]) => Math.hypot((b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const fan = poly => poly.slice(2).map((p, i) => [poly[0], poly[i + 1], p]).filter(t => triangleArea3(t) > EPS);
// Offline source-solid visibility. Split at actual neighbouring roof planes; source IDs and colliders stay intact.
export function visibleRoofMesh(mesh, owner, neighbours) {
    const occluders = neighbours.flatMap(n => n.mesh.faces.map(face => ({ face, minH: n.minH, i: n.i })));
    function visible(face) {
        let pieces = [face];
        for (const other of occluders) {
            const [a, b, c] = other.face, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
            if (Math.abs(den) < EPS) continue;
            const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]);
            const height = p => { const u = ((b[2] - c[2]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[2] - c[2])) / den, v = ((c[2] - a[2]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[2] - c[2])) / den; return u * a[1] + v * b[1] + (1 - u - v) * c[1]; };
            const next = [];
            for (const piece of pieces) {
                if (piece.every(p => p[0] < x0 - EPS) || piece.every(p => p[0] > x1 + EPS) || piece.every(p => p[2] < z0 - EPS) || piece.every(p => p[2] > z1 + EPS) || piece.every(p => p[1] < other.minH - EPS) || piece.every(p => p[1] - height(p) + (owner.i < other.i ? EPS : -EPS) >= 0)) { next.push(piece); continue; }
                let inside = piece;
                const sign = Math.sign((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
                for (let i = 0; i < 3 && inside.length >= 3; i++) {
                    const u = other.face[i], v = other.face[(i + 1) % 3], side = p => sign * ((v[0] - u[0]) * (p[2] - u[2]) - (v[2] - u[2]) * (p[0] - u[0]));
                    const outside = inside.some(p => side(p) < -EPS) ? clip3(inside, side, false) : []; if (outside.length >= 3) next.push(outside);
                    inside = clip3(inside, side, true);
                }
                if (inside.length >= 3) {
                    const below = clip3(inside, p => p[1] - other.minH + EPS, false); if (below.length >= 3) next.push(below);
                    const above = clip3(inside, p => p[1] - height(p) + (owner.i < other.i ? EPS : -EPS), true); if (above.length >= 3) next.push(above);
                }
            }
            pieces = next;
        }
        return pieces.flatMap(fan);
    }
    return { faces: mesh.faces.flatMap(visible), walls: mesh.walls.flatMap((face, i) => visible(face).map(vertices => ({ vertices, normal: mesh.wallNormals[i] }))) };
}
