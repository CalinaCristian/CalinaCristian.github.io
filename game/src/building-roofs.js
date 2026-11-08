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
const supported = new Set(['flat', 'gabled', 'hipped', 'skillion', 'pyramidal', 'mansard', 'dome']);
export function makeRoofProfile({ tags = {}, ring, shape = 'flat', height, minHeight = 0, heightSource = 'estimate', heightIsTotal = false }) {
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
        else if (angle > 0 && angle < 90) { rise = Math.tan(angle * Math.PI / 180) * run; riseSource = 'OSM roof:angle'; }
        else if (levels > 0) { rise = levels * 2.6; riseSource = 'roof:levels estimate'; }
        else { rise = clamp(run * (shape === 'skillion' ? 0.18 : shape === 'mansard' ? 0.55 : 0.35), 0.8, shape === 'skillion' ? 3 : 6); riseSource = 'footprint estimate'; }
    } else if (roofHeight > 0) issues.push('flat roof with positive roof:height');
    for (const [key, value, valid] of [['roof:height', roofHeight, roofHeight >= 0], ['roof:angle', angle, angle > 0 && angle < 90], ['roof:levels', levels, levels >= 0]]) if (tags[key] != null && !valid) issues.push('invalid ' + key + '=' + tags[key]);
    let totalM = heightIsTotal ? height : height + rise, eavesM = heightIsTotal ? height - rise : height;
    if (eavesM < minHeight) { issues.push('roof rise exceeds building height band'); eavesM = minHeight; rise = Math.max(0, totalM - eavesM); }
    // Preserve the literal top. An inconsistent minimum remains an explicit source issue.
    if (minHeight > totalM) issues.push('minimum height exceeds total height');
    const raw = Object.fromEntries(['height', 'min_height', 'building:levels', 'building:min_level', 'roof:shape', 'roof:height', 'roof:angle', 'roof:direction', 'roof:orientation', 'roof:levels'].filter(k => tags[k] != null).map(k => [k, tags[k]]));
    return { version: 1, shape, totalM, eavesM, riseM: rise, heightSource, riseSource, axis, low, high, ...(direction !== null ? { direction } : {}), ...(orientation ? { orientation } : {}), ...(angle > 0 && angle < 90 ? { angle } : {}), raw, ...(issues.length ? { issues } : {}) };
}
export function validRoofProfile(p, total, minHeight = 0) {
    return p?.version === 1 && supported.has(p.shape) && [p.totalM, p.eavesM, p.riseM, p.low, p.high, ...p.axis || []].every(Number.isFinite) && p.axis?.length === 2 && Math.abs(p.totalM - total) < 0.0002 && p.eavesM >= minHeight - EPS && p.riseM >= 0 && Math.abs(p.eavesM + p.riseM - p.totalM) < 0.0002;
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
    const simple = ['flat', 'gabled', 'skillion'].includes(p.shape), triangles = [];
    for (const indices of tris) {
        const t = indices.map(i => pts[i]);
        if (p.shape === 'gabled') {
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
        let f = p.shape === 'flat' ? 0 : p.shape === 'skillion' ? (p.high - q(v)) / width : p.shape === 'gabled' ? 1 - Math.abs(q(v) - middle) * 2 / width : distance(v, rings) / maxD;
        if (p.shape === 'mansard') f = Math.min(1, f * 1.8);
        if (p.shape === 'dome') f = Math.sqrt(Math.max(0, 1 - (1 - f) ** 2));
        return [v[0], p.eavesM + p.riseM * clamp(f, 0, 1), v[1]];
    };
    const faces = triangles.map(t => t.map(at)), walls = [];
    if (simple && p.riseM > EPS) for (const boundary of rings) for (let i = 0; i < boundary.length; i++) {
        const a = boundary[i], b = boundary[(i + 1) % boundary.length], da = q(a) - middle, db = q(b) - middle, line = [a];
        if (p.shape === 'gabled' && da * db < -EPS * EPS) { const t = da / (da - db); line.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
        line.push(b);
        for (let k = 1; k < line.length; k++) { const x = line[k - 1], z = line[k], a3 = at(x), b3 = at(z); if (a3[1] > p.eavesM + EPS || b3[1] > p.eavesM + EPS) walls.push([[x[0], p.eavesM, x[1]], [z[0], p.eavesM, z[1]], b3, a3]); }
    }
    return { faces, walls, heightAt(x, z) {
        for (const [a, b, c] of faces) {
            const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < EPS) continue;
            const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
            if (u >= -EPS && v >= -EPS && u + v <= 1 + EPS) return u * a[1] + v * b[1] + (1 - u - v) * c[1];
        }
        return null;
    } };
}
