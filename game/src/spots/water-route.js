import { inPoly, distPolyline } from './kit.js';

// OSM landing nodes may be a few metres inside the water polygon. The public
// interaction belongs on the dry bank opposite that node, never in the lake.
export function dryLanding(poly, landing, clearance = 3) {
    if (!inPoly(landing.x, landing.z, poly)) return { x: landing.x, z: landing.z };
    const q = distPolyline(landing.x, landing.z, [...poly, poly[0]]), d = q.d || 1;
    return { x: q.cx + (q.cx - landing.x) / d * clearance, z: q.cz + (q.cz - landing.z) / d * clearance };
}

// A short gameplay course inside a sourced shoreline. Samples and every segment
// stay in water with hull clearance; no straight shortcut across a bank/bridge.
export function shortWaterRoute(poly, landing, { reach = 24, clearance = 1.1, avoid = () => false } = {}) {
    if (!poly?.length) return null;
    const shore = [...poly, poly[0]], safe = (x, z) => inPoly(x, z, poly) && distPolyline(x, z, shore).d >= clearance && !avoid(x, z);
    let first = null;
    search: for (let r = 1.5; r <= 20; r += .75) for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2, x = landing.x + Math.cos(a) * r, z = landing.z + Math.sin(a) * r;
        if (safe(x, z)) { first = [x, z]; break search; }
    }
    if (!first) return null;
    const step = 2, queue = [{ x: 0, z: 0, parent: -1, length: 0 }], seen = new Set(['0,0']); let end = 0;
    const segment = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .5); for (let k = 1; k <= n; k++) if (!safe(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) return false; return true; };
    for (let i = 0; i < queue.length && queue.length < 1600; i++) {
        const q = queue[i]; if (q.length > queue[end].length) end = i;
        if (q.length >= reach) { end = i; break; }
        for (const [dx, dz] of [[1,0], [0,1], [-1,0], [0,-1]]) {
            const x = q.x + dx, z = q.z + dz, key = x + ',' + z; if (seen.has(key)) continue;
            seen.add(key); const a = [first[0] + q.x * step, first[1] + q.z * step], b = [first[0] + x * step, first[1] + z * step];
            if (segment(a, b)) queue.push({ x, z, parent: i, length: q.length + step });
        }
    }
    if (queue[end].length < 10) return null;
    const out = []; for (let i = end; i >= 0; i = queue[i].parent) { const q = queue[i]; out.push([first[0] + q.x * step, first[1] + q.z * step]); }
    out.reverse(); return [...out, ...out.slice(0, -1).reverse()];
}
