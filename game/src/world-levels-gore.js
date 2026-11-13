// Level solver: the gore pass (moved from world-levels.js, unchanged). Returns its stats for profileStats0.gore.
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { shoulderOf } from './world-shared.js';

// ---- (round 6) gores: where a deck / ramp merges into (or splits from) a near-parallel road it is connected to,
//      their surfaces touch or overlap for the last metres before the node — no room for a barrier there (the
//      wall-cut rule opens it so neither lane is blocked). If they are at different heights the car drops off one
//      onto the other (audit 'cliff' at Pasajul Basarab / Bretea / Doina Cornea). Same sampling as the audit's
//      cliff check (just beyond one road's edge) plus a sample just inside it (overlapping ribbons): on the other
//      road's surface the heights must agree (one surface; the visual QA flags 0.05–2.5 m as a stacked road).
//      Only lowering: the higher surface comes down to the lower one there (the lower one is usually held by
//      its ground cone), the drop spread back along the graph at the grade limit and never under a clearance
//      floor. The source layer estimate can require a longer shared-level section at a fork: allow up to 4.5 m
//      of lowering and follow connected branches for 120 m, retaining every clearance floor.
export function lowerGores({ MAXG, nodeArr, crossings, yP, CLEAR_MIN, overlaps, asphaltCorners, edges, edgesInBox, shares }) {
    const G = MAXG * 0.97, DROP = 4.5, wA = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e), wS = (e, s) => wA(e, s) + e.sidewalk;
    const live = nodeArr.filter(n => n.edges.some(e => !e.virtual)), y0 = new Map(live.map(n => [n, n.y]));
    // floors: no road comes down more than DROP m (a gore that would need a deeper sag is left as it is), none goes
    // under ground (unless already sunk), and a structure over another road keeps its clearance
    const floor = new Map(), setFloor = (n, v) => floor.set(n, Math.max(floor.get(n) ?? -Infinity, Math.min(y0.get(n) ?? n.y, v)));
    for (const n of live) setFloor(n, Math.max(n.y - DROP, Math.min(n.y, 0)));
    for (const c of crossings) { if (c.u.L <= 0 || Math.abs(c.u.dirx * c.f.dirx + c.u.dirz * c.f.dirz) >= 0.85) continue; const tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1); for (const n of [c.u.a, c.u.b]) setFloor(n, yP(c.f, tf) + CLEAR_MIN); }
    for (const o of overlaps) { const ye = yP(o.e, o.te), yf = yP(o.f, o.tf); if (Math.abs(ye - yf) < 3) continue; const [hi, lo] = ye > yf ? [o.e, yf] : [o.f, ye]; for (const n of [hi.a, hi.b]) setFloor(n, lo + CLEAR_MIN); }
    // Centre-line samples can miss a short overlap at the outside corner of an approach. Preserve separation
    // over the complete asphalt footprints too: their linear height difference reaches its extrema at these
    // intersection vertices. Clamping each floor to its original height keeps this pass lowering-only.
    // (spec 10 load budget) an edge's footprint is read, never changed, and nothing in this pass moves nodes or widths:
    // each edge's corners are made once (they were made again for every pair)
    const cornerMemo = new Map(), corners = e => { let c = cornerMemo.get(e); if (!c) cornerMemo.set(e, c = asphaltCorners(e, wA)); return c; };
    const inside = (p, poly) => pointInPolygon(p[0], p[1], poly) || poly.some((q, i) => { const r = poly[(i + 1) % poly.length]; return distPointSeg(p[0], p[1], q[0], q[1], r[0], r[1]).d < 1e-7; });
    for (const e of edges) {
        if (e.virtual) continue;
        const A = corners(e), pad = Math.max(wA(e, 1), wA(e, -1)) * 2.5 + 17;
        edgesInBox(Math.min(e.a.x, e.b.x) - pad, Math.min(e.a.z, e.b.z) - pad, Math.max(e.a.x, e.b.x) + pad, Math.max(e.a.z, e.b.z) + pad, f => {
            if (f.virtual || f.id <= e.id || shares(e, f)) return;
            const B = corners(f), P = A.filter(p => inside(p, B)).concat(B.filter(p => inside(p, A)));
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
                const a = A[i], b = A[(i + 1) % 4], c = B[j], d = B[(j + 1) % 4], rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
                if (Math.abs(den) < 1e-9) continue;
                const qx = c[0] - a[0], qz = c[1] - a[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
                if (t >= 0 && t <= 1 && u >= 0 && u <= 1) P.push([a[0] + t * rx, a[1] + t * rz]);
            }
            if (!P.length) return;
            const height = (g, p) => yP(g, clamp(((p[0] - g.a.x) * g.dirx + (p[1] - g.a.z) * g.dirz) / g.len, 0, 1));
            const ds = P.map(p => height(e, p) - height(f, p));
            const hi = Math.min(...ds) >= 3 ? e : Math.max(...ds) <= -3 ? f : null;
            if (!hi) return;
            const lo = hi === e ? f : e, h = Math.max(...P.map(p => height(lo, p))) + CLEAR_MIN;
            // An approach may start below this floor outside the overlap. Clamping that end independently
            // would still let the sloping overlap dip below clearance: keep this original piece in that case.
            const keep = Math.min(hi.a.y, hi.b.y) < h;
            for (const n of [hi.a, hi.b]) setFloor(n, keep ? n.y : h);
        });
    }
    const heapCone = (seeds, sgn) => { // sgn −1: min-plus (v + G d), sgn +1: max-plus (v − G d); over every real edge
        const best = new Map(), heap = [], key = (v) => sgn * v; // (max-heap on key: the best value is settled first)
        const push = (n, v) => { heap.push([key(v), v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
        for (const [n, v] of seeds) if (!best.has(n) || key(v) > key(best.get(n))) { best.set(n, v); push(n, v); }
        while (heap.length) { const [, v, n] = pop(); if (v !== best.get(n)) continue; for (const f of n.edges) { if (f.virtual) continue; const o = f.a === n ? f.b : f.a, nv = v - sgn * G * f.len; if (!best.has(o) || key(nv) > key(best.get(o))) { best.set(o, nv); push(o, nv); } } }
        return best;
    };
    const F = heapCone([...floor], 1); // the highest grade-feasible lower bound
    const linked = new Map(); // edge → Set of edges within 120 m along the graph
    const linkSet = (e) => {
        let s = linked.get(e); if (s) return s;
        s = new Set(); const dist = new Map(), q = [[e.a, 0], [e.b, 0]];
        while (q.length) { const [n, d] = q.shift(); if ((dist.get(n) ?? Infinity) <= d) continue; dist.set(n, d); for (const f of n.edges) { if (f.virtual) continue; s.add(f); const o = f.a === n ? f.b : f.a, nd = d + f.len; if (nd <= 120) q.push([o, nd]); } }
        linked.set(e, s); return s;
    };
    let fixes = 0, rounds = 0, pairs = 0;
    // The sample points, the neighbouring edges and their footprints do not change between rounds (only node heights
    // do): the scan is done once and kept as [e, tt, f, ft] quadruples; every round tests the heights only.
    let gore = null;
    const goreScanPairs = () => {
        const out = [];
        for (const e of edges) {
            if (e.virtual || e.len < 0.5) continue;
            const step = Math.max(0.02, 1.5 / e.len);
            // (inside its asphalt edge: overlapping ribbons; just beyond it: the audit's cliff sample; the same for every t)
            const offsets = [[1, wA(e, 1) - 0.5], [-1, wA(e, -1) - 0.5], [1, (e.bridge ? wA(e, 1) + 0.3 : wS(e, 1)) + 0.6], [-1, (e.bridge ? wA(e, -1) + 0.3 : wS(e, -1)) + 0.6]];
            for (let t = 0; t <= 1 + 1e-6; t += step) {
                const tt = Math.min(t, 1);
                for (const [s, off] of offsets) {
                    const x = e.a.x + e.dirx * e.len * tt + e.nx * off * s, z = e.a.z + e.dirz * e.len * tt + e.nz * off * s;
                    edgesInBox(x - 1, z - 1, x + 1, z + 1, (f) => {
                        // (spec 10 load budget) q.d is at least the gap to f's box; wS(f, ·) is at most the wider width + the
                        // largest shoulder (1.2) + its sidewalk: past that the test below returns too
                        if (Math.max(Math.min(f.a.x, f.b.x) - x, x - Math.max(f.a.x, f.b.x), Math.min(f.a.z, f.b.z) - z, z - Math.max(f.a.z, f.b.z)) > Math.max(f.wR, f.wL) + 1.2 + f.sidewalk + 1e-6) return;
                        if (f === e || f.virtual || Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.85) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0 || q.t >= 1) return;
                        const sf = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) >= 0 ? 1 : -1; if (q.d > wS(f, sf)) return;
                        if (!linkSet(e).has(f)) return;
                        out.push(e, tt, f, q.t);
                    });
                }
            }
        }
        return out;
    };
    for (; rounds < 20; rounds++) {
        const caps = new Map(), cap = (n, v) => { if (v < n.y - 0.01 && v < (caps.get(n) ?? Infinity)) caps.set(n, v); };
        pairs = 0;
        gore ||= goreScanPairs();
        for (let i = 0; i < gore.length; i += 4) {
            const e = gore[i], tt = gore[i + 1], f = gore[i + 2], ft = gore[i + 3];
            const he = e.a.y + (e.b.y - e.a.y) * tt, hf = f.a.y + (f.b.y - f.a.y) * ft, dh = he - hf;
            if (Math.abs(dh) <= 0.04 || Math.abs(dh) > 6 || Math.min(he, hf) < -0.5) continue;
            pairs++;
            const [h, th, lo] = dh > 0 ? [e, tt, hf] : [f, ft, he]; // (one surface: the visual QA flags 0.05–2.5 m as a stacked road)
            cap(h.a, lo); cap(h.b, lo); // (both ends: a linear piece is only ≤ lo at th if both are; pieces are ≤ 10 m)
        }
        if (!caps.size) break;
        // y = min(y, max(capCone, floorCone)): lowering only, grade-limited, never under a floor
        const C = heapCone([...caps], -1);
        let changed = 0;
        for (const [n, c] of C) { const ny = Math.min(n.y, Math.max(c, F.get(n) ?? -Infinity)); if (ny < n.y - 0.01) { n.y = ny; changed++; } }
        fixes += changed; if (!changed) break; // (what is left is held by a floor)
    }
    let maxDrop = 0; for (const [n, v] of y0) maxDrop = Math.max(maxDrop, v - n.y);
    return { lowered: fixes, rounds, left: pairs, maxDrop: +maxDrop.toFixed(2) };
}
