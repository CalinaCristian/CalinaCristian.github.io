import { inPoly, distPolyline } from './kit.js';

// OSM landing nodes may be a few metres inside the water polygon. The public
// interaction belongs on the dry bank opposite that node, never in the lake.
export function dryLanding(poly, landing, clearance = 3) {
    if (!inPoly(landing.x, landing.z, poly)) return { x: landing.x, z: landing.z };
    const q = distPolyline(landing.x, landing.z, [...poly, poly[0]]), d = q.d || 1;
    return { x: q.cx + (q.cx - landing.x) / d * clearance, z: q.cz + (q.cz - landing.z) / d * clearance };
}

// A paddle loop through open water: from the landing through each waypoint in turn and back, every leg found on a
// safe grid (8-neighbour A*, `step` m), string-pulled to straight runs where the whole run is safe, then rounded
// (Chaikin) only where the rounded run stays safe, and resampled to ≤ 2 m. Every sample and segment stays in the
// water polygon with `clearance` from the shore and outside `avoid`. Null when a leg finds no safe water.
export function waterLoop(poly, landing, waypoints, { clearance = 1.2, avoid = () => false, step = 1.5, maxNodes = 60000 } = {}) {
    if (!poly?.length || !waypoints?.length) return null;
    const shore = [...poly, poly[0]], memo = new Map();
    const safe = (x, z) => { const k = Math.round(x * 20) + ',' + Math.round(z * 20); let v = memo.get(k); if (v === undefined) { v = inPoly(x, z, poly) && distPolyline(x, z, shore).d >= clearance && !avoid(x, z); memo.set(k, v); } return v; };
    const segOk = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .4)); for (let k = 0; k <= n; k++) if (!safe(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) return false; return true; };
    let first = null;
    search: for (let r = 1; r <= 20; r += .5) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = landing.x + Math.cos(a) * r, z = landing.z + Math.sin(a) * r; if (safe(x, z)) { first = [x, z]; break search; } }
    if (!first) return null;
    const leg = (a, b) => { // grid A* from a to b on cells anchored at a
        const key = (i, j) => i + ',' + j, gi = Math.round((b[0] - a[0]) / step), gj = Math.round((b[1] - a[1]) / step), P = (i, j) => [a[0] + i * step, a[1] + j * step];
        const open = [{ i: 0, j: 0, g: 0, f: Math.hypot(gi, gj) * step }], came = new Map([[key(0, 0), null]]), gs = new Map([[key(0, 0), 0]]); let n = 0, hit = null;
        while (open.length && n++ < maxNodes) {
            let bi = 0; for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k; const q = open[bi]; open[bi] = open[open.length - 1]; open.pop();
            if (q.g > gs.get(key(q.i, q.j))) continue;
            if (Math.abs(q.i - gi) <= 1 && Math.abs(q.j - gj) <= 1 && segOk(P(q.i, q.j), b)) { hit = q; break; }
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const i = q.i + di, j = q.j + dj, k = key(i, j), g = q.g + Math.hypot(di, dj) * step; if (g >= (gs.get(k) ?? Infinity)) continue;
                if (!segOk(P(q.i, q.j), P(i, j))) continue;
                gs.set(k, g); came.set(k, key(q.i, q.j)); open.push({ i, j, g, f: g + Math.hypot(gi - i, gj - j) * step });
            }
        }
        if (!hit) return null;
        const out = [b]; for (let k = key(hit.i, hit.j); k; k = came.get(k)) { const [i, j] = k.split(',').map(Number); out.push(P(i, j)); }
        return out.reverse();
    };
    for (const w of waypoints) if (!safe(w[0], w[1])) return null;
    // each leg string-pulled on its own (the waypoints stay anchors: a closed loop must never collapse onto its start):
    // from each kept point jump to the farthest point of the leg it sees in one safe straight run
    const pulled = [first];
    for (const [a, b] of [first, ...waypoints].map((p, k, all) => [p, all[k + 1] || first])) {
        const L = leg(a, b); if (!L) return null;
        for (let i = 0; i < L.length - 1;) { let j = L.length - 1; while (j > i + 1 && !segOk(L[i], L[j])) j--; pulled.push(L[j]); i = j; }
    }
    // rounding: Chaikin corner cuts, each kept only where both new segments stay safe
    let path = pulled;
    for (let it = 0; it < 3; it++) { const o = [path[0]]; for (let i = 1; i < path.length - 1; i++) { const p = path[i - 1], c = path[i], n = path[i + 1], q = [c[0] * .75 + p[0] * .25, c[1] * .75 + p[1] * .25], r = [c[0] * .75 + n[0] * .25, c[1] * .75 + n[1] * .25];
        if (segOk(o[o.length - 1], q) && segOk(q, r) && segOk(r, n)) o.push(q, r); else o.push(c); } o.push(path[path.length - 1]); path = o; }
    const res = [path[0]]; for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 1; k <= n; k++) res.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    res[res.length - 1] = res[0]; // closed: ends where it starts
    for (let i = 1; i < res.length; i++) if (!segOk(res[i - 1], res[i])) return null;
    return res;
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
