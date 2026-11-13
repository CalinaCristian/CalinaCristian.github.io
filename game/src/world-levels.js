// ============================================================================
//  WORLD LEVELS — bridge / tunnel anchors, the cone solver and constraint relaxation of road heights
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { reviewedGradeK } from './grade-review.js';
import { BoxGrid, shoulderOf, undelta } from './world-shared.js';

export function buildLevelSolver(ctx) {
    const {
        CLEAR, GRADE, asphaltCorners, city, corner, crossings, data, distId,
        edges, edgesInBox, nodeArr,
    } = ctx;
    let { profileStats0, profileStats } = ctx; // (updated here, handed back: see the return)
    {
        for (const e of edges) { e.L = e.virtual || e.coveredRoadModel ? 0 : Math.max(-2, Math.min(3, e.bridge ? Math.max(1, e.layer) : e.tunnel ? Math.min(-1, e.layer) : 0)); e.over = null; e.anchorH = 0; }
        for (const e of edges) { const k = reviewedGradeK(city.id + '-' + distId, data.roadSourceGeometry?.[e.road]?.sourceId); if (k) e.gradeK = k; } // (reviewed approach-ramp length: grade-review.js)
        const near = (e) => { const s = new Set([e.a, e.b]); for (const n of [e.a, e.b]) for (const f of n.edges) { s.add(f.a); s.add(f.b); } return s; };
        const segX = (e, f) => { // centreline intersection → {t, u} or null
            const rx = e.b.x - e.a.x, rz = e.b.z - e.a.z, sx = f.b.x - f.a.x, sz = f.b.z - f.a.z;
            const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
            const qx = f.a.x - e.a.x, qz = f.a.z - e.a.z;
            const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
            return t > 0 && t < 1 && u > 0 && u < 1 ? { t, u } : null;
        };
        for (const u of edges) {
            if (u.L === 0 || u.virtual) continue;
            const nb = near(u);
            const pad = u.halfW + 12;
            edgesInBox(Math.min(u.a.x, u.b.x) - pad, Math.min(u.a.z, u.b.z) - pad, Math.max(u.a.x, u.b.x) + pad, Math.max(u.a.z, u.b.z) + pad, (f) => {
                if (f === u || f.virtual || nb.has(f.a) || nb.has(f.b)) return;
                if (u.L > 0 ? (f.L >= u.L || f.tunnel) : f.L <= u.L) return; // bridges look down, tunnels look up
                let hit = null;
                const X = segX(u, f);
                if (X) hit = { x: u.a.x + (u.b.x - u.a.x) * X.t, z: u.a.z + (u.b.z - u.a.z) * X.t };
                else { // stacked (parallel) roads, e.g. SeaTac departures drive above the arrivals drive
                    for (let s = Math.min(u.len / 2, u.a.radius + 2); s <= u.len - Math.min(u.len / 2, u.b.radius + 2) && !hit; s += 4) {
                        const x = u.a.x + u.dirx * s, z = u.a.z + u.dirz * s;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.t > 0.02 && q.t < 0.98 && q.d < Math.min(f.halfW, 6) + Math.min(u.halfW, 6) * 0.5) hit = { x, z };
                    }
                }
                if (hit && Math.hypot(hit.x - u.a.x, hit.z - u.a.z) > 1.5 && Math.hypot(hit.x - u.b.x, hit.z - u.b.z) > 1.5) {
                    (u.over || (u.over = [])).push(f);
                    crossings.push({ u, f, x: hit.x, z: hit.z });
                }
            });
        }
        // anchors: bridges that pass over something (lower bridges first), all tunnels
        const anchorEdges = edges.filter(e => (e.L > 0 && e.over) || e.L < 0).sort((p, q) => p.L - q.L);
        for (const e of anchorEdges) {
            if (e.L < 0) { e.anchorH = e.L * CLEAR; continue; }
            let base = 0; for (const f of e.over) if (f.L > 0 && f.anchorH > 0) base = Math.max(base, f.anchorH);
            e.anchorH = base + CLEAR;
        }
        const extraPins = new Map(); // node → height: ramps may not dive while they still overlap another road
        const solve = () => {
            for (const n of nodeArr) { n.y = 0; n.yFixed = false; n.yPin = false; }
            for (const [n, v] of extraPins) { n.y = v; n.yPin = true; }
            for (const e of anchorEdges) for (const n of [e.a, e.b]) {
                if (e.L < 0 && n.edges.some(f => !f.virtual && !f.tunnel)) continue; // tunnel portals open at street level (the ramp is inside)
                if (!n.yFixed || Math.abs(e.anchorH) > Math.abs(n.y)) n.y = e.anchorH;
                n.yFixed = true;
            }
            // pin the roads that are passed over / under (unless they are anchored themselves)
            for (const c of crossings) if (!c.f.anchorH && !(c.f.bridge && c.f.L > 1)) for (const n of [c.f.a, c.f.b]) if (!n.yFixed) n.yPin = true;
            // max-of-cones propagation (separately up and down)
            for (const sgn of [1, -1]) {
                const best = new Map(); const heap = [];
                const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                for (const n of nodeArr) if (n.yFixed && n.y * sgn > 0) { best.set(n, n.y * sgn); push(n, n.y * sgn); }
                while (heap.length) {
                    const [v, n] = pop(); if (v < best.get(n)) continue;
                    for (const e of n.edges) {
                        if (e.virtual) continue;
                        const o = e.a === n ? e.b : e.a; if (o.yFixed || o.yPin) continue;
                        const nv = v - GRADE * e.len * (e.bridge ? (e.L >= 2 ? 0.1 : 0.35) : (e.gradeK || 1)); // decks stay up (layer ≥ 2: viaducts)
                        if (nv > 0.02 && nv > (best.get(o) ?? 0)) { best.set(o, nv); push(o, nv); }
                    }
                }
                for (const [n, v] of best) if (!n.yFixed && v > Math.abs(n.y)) n.y = v * sgn;
            }
            for (const e of edges) { e.ya = e.a.y; e.yb = e.b.y; }
        };
        solve();
        // ---- constraint relaxation (projections, Gauss-Seidel) on top of the cone solution:
        //   C  clearance: a structure passing over (under) a road stays ≥ CLEAR_MIN above (below) it at the crossing
        //   O  overlap: two carriageways that overlap in plan (not at a junction) are either at the same height
        //      (a ramp may not dive while it still overlaps the street beside it) or clearly separated (≥ SEP),
        //      never 0.4–3 m apart (the car would snap between them)
        //   S  grade: |Δy| ≤ MAXG · length on every edge (ramps are extended instead of stepped)
        //   H  hard nodes: minor streets (residential / service / living / unclassified) stay at grade, floating /
        //      river bridges stay just above the water, roads passed over keep their level
        const MAXG = 0.08, CLEAR_MIN = 5.2, SEP = 4.2, USE_O = false;
        const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
        const MINOR = /^(residential|living_street|unclassified|service)$/;
        // water polygons straight from the data (the area meshes are built later)
        const wGrid = new BoxGrid(200), wPolys = [];
        for (const a of data.areas) {
            if (data.areaKinds[a[0]] !== 'water') continue;
            const outer = undelta(a[2], 0); if (outer.length < 3) continue;
            let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
            const p = { outer, x0, z0, x1, z1 }; wPolys.push(p); wGrid.insert(x0, z0, x1, z1, p);
        }
        const overWater = (x, z) => { let w = false; wGrid.each(x, z, x, z, (p) => { if (!w && x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && pointInPolygon(x, z, p.outer)) w = true; }); return w; };
        for (const e of edges) e.overWater = !e.virtual && e.bridge && !e.over && overWater((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2) && overWater(e.a.x * 0.75 + e.b.x * 0.25, e.a.z * 0.75 + e.b.z * 0.25);
        const hard = new Map(); // node → height
        for (const n of nodeArr) {
            const es = n.edges.filter(e => !e.virtual); if (!es.length) continue;
            if (es.every(e => MINOR.test(e.type) && !e.bridge && !e.tunnel)) hard.set(n, 0);
            else if (es.every(e => e.overWater)) hard.set(n, 0.3);
        }
        for (const c of crossings) if (!c.f.anchorH && !c.f.bridge && !c.f.tunnel) for (const n of [c.f.a, c.f.b]) if (!hard.has(n) && Math.abs(n.y) < 0.05) hard.set(n, 0);
        for (const [n, v] of hard) n.y = v;
        // overlap samples (carriageways overlapping in plan, away from shared junctions)
        const overlaps = [];
        {
            const crossed = new Set(crossings.map(c => c.u.id + ':' + c.f.id));
            for (const e of edges) {
                if (e.virtual) continue;
                for (let s = Math.min(1, e.len / 2); s <= e.len - Math.min(1, e.len / 2); s += Math.min(3, Math.max(0.5, e.len - 2) / 2)) {
                    const x = e.a.x + e.dirx * s, z = e.a.z + e.dirz * s;
                    const reachE = Math.min(e.halfW, 6) * 0.7;
                    edgesInBox(x - 14, z - 14, x + 14, z + 14, (f) => {
                        // (spec 10 load budget) q.d below is at least the gap to f's box, and the limit at most the wider width
                        // + the largest shoulder (1.2) + reachE: past that every test below returns too
                        if (Math.max(Math.min(f.a.x, f.b.x) - x, x - Math.max(f.a.x, f.b.x), Math.min(f.a.z, f.b.z) - z, z - Math.max(f.a.z, f.b.z)) > Math.max(f.wR, f.wL) + 1.2 + reachE + 1e-6) return;
                        if (f === e || f.virtual || f.id < e.id || shares(e, f) || ((crossed.has(e.id + ':' + f.id) || crossed.has(f.id + ':' + e.id)) && Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.8)) return; // (a near-parallel 'crossing' — a ramp running over the street — stays an overlap)
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.t <= 0.01 || q.t >= 0.99) return;
                        const side = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) >= 0 ? 1 : -1;
                        if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + Math.min(e.halfW, 6) * 0.7) return;
                        if ((e.tunnel && f.tunnel) || (e.L < 0) !== (f.L < 0) && Math.min(e.ya, e.yb, f.ya, f.yb) < -4) return; // a covered tunnel under a street is fine
                        overlaps.push({ e, te: s / e.len, f, tf: q.t, sep: null });
                    });
                }
            }
        }
        const yP = (e, t) => e.a.y + (e.b.y - e.a.y) * t;
        // overlapping carriageways that are already ≥ 1 m apart are a grade separation: keep them ≥ CLEAR_MIN apart
        // (otherwise a car would snap from one to the other)
        {
            const seenPair = new Set();
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = ye - yf;
                if (Math.abs(dh) < 1.0 || Math.abs(dh) >= CLEAR_MIN) continue;
                const [u, f, tu] = dh > 0 ? [o.e, o.f, o.te] : [o.f, o.e, o.tf];
                if (u.L <= 0 && !u.bridge) continue;
                const k = u.id + ':' + f.id; if (seenPair.has(k)) continue; seenPair.add(k);
                crossings.push({ u, f, x: u.a.x + (u.b.x - u.a.x) * tu, z: u.a.z + (u.b.z - u.a.z) * tu, overlap: true });
                if (!u.L) u.L = 1;
            }
        }
        // move the height of edge e at param t by d (minimal change of its free endpoints)
        const moveAt = (e, t, d) => {
            const fa = !hard.has(e.a), fb = !hard.has(e.b);
            if (!Number.isFinite(d)) return false;
            d = clamp(d, -1.5, 1.5); // damped: many constraints share nodes
            const wa = fa ? 1 - t : 0, wb = fb ? t : 0, n2 = wa * wa + wb * wb; if (n2 < 0.09) return false; // the point sits on a hard end
            e.a.y += d * wa / n2; e.b.y += d * wb / n2; return true;
        };
        // decide per pair: overlapping carriageways that start < 2.4 m apart are merged to one level; the others are
        // grade-separated already (the crossing constraints keep them apart)
        { const pair = new Map(); for (const o of overlaps) { const k = o.e.id + ':' + o.f.id; const dh = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); pair.set(k, Math.max(pair.get(k) ?? 0, dh)); }
          for (const o of overlaps) o.sep = pair.get(o.e.id + ':' + o.f.id) < 2.4 ? 0 : null; }
        const stepC = () => {
            for (const c of crossings) {
                const tu = clamp(((c.x - c.u.a.x) * c.u.dirx + (c.z - c.u.a.z) * c.u.dirz) / c.u.len, 0, 1), tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1);
                const gap = (yP(c.u, tu) - yP(c.f, tf)) * (c.u.L > 0 ? 1 : -1);
                if (gap < CLEAR_MIN) { if (!moveAt(c.u, tu, (CLEAR_MIN - gap) * (c.u.L > 0 ? 1 : -1))) moveAt(c.f, tf, -(CLEAR_MIN - gap) * (c.u.L > 0 ? 1 : -1)); }
            }
        };
        const stepO = () => {
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = ye - yf;
                if (o.sep === null) continue;
                if (o.sep === 0) { if (Math.abs(dh) > 0.25) { const [hi, th, lo, tl] = Math.abs(ye) > Math.abs(yf) ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te]; if (!moveAt(hi, th, yP(lo, tl) - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - yP(lo, tl)); } }
                else if (dh * o.sep < SEP) {
                    const v = SEP - dh * o.sep; // the upper one must go up by v, or the lower one down by v
                    const [up, tu, lo, tl] = o.sep > 0 ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                    if (Math.abs(yP(up, tu)) >= Math.abs(yP(lo, tl))) { if (!moveAt(up, tu, v)) moveAt(lo, tl, -v); }
                    else if (!moveAt(lo, tl, -v)) moveAt(up, tu, v);
                }
            }
        };
        const stepS = (honourHard) => {
            let worst = 0;
            for (const e of edges) {
                if (e.virtual) continue;
                const lim = MAXG * e.len, dy = e.b.y - e.a.y; if (Math.abs(dy) <= lim + 1e-4) continue;
                worst = Math.max(worst, Math.abs(dy) - lim);
                const ex = Math.abs(dy) - lim, s = Math.sign(dy);
                // move the endpoint nearer to the ground (extends the ramp away from the structure); else the other one
                const aNear = Math.abs(e.a.y) < Math.abs(e.b.y);
                const ha = honourHard && hard.has(e.a), hb = honourHard && hard.has(e.b);
                if (ha && hb) continue;
                if (aNear && !ha) e.a.y += s * ex; else if (!aNear && !hb) e.b.y -= s * ex;
                else if (ha) e.b.y -= s * ex; else e.a.y += s * ex;
            }
            return worst;
        };
        let nanAt = null; const nanCheck = (tag) => { for (const n of nodeArr) if (!Number.isFinite(n.y)) { nanAt = nanAt || tag + ':' + n.id; return true; } return false; };
        nanCheck('init');
        // heights stay within what a city has (a road crossing under its own ramp within a few metres is infeasible:
        // without a cap the constraints would chase each other upward)
        const capY = () => { for (const n of nodeArr) { const lim = hard.has(n) ? 0.3 : 14; if (n.y > lim) n.y = Math.max(lim, Math.min(n.y, 14)); if (n.y < -7.5) n.y = -7.5; if (hard.has(n) && Math.abs(n.y - hard.get(n)) > 1e-6) n.y = hard.get(n); } };
        for (let it = 0; it < 160; it++) { stepC(); if (nanCheck("C" + it)) break; if (USE_O) stepO(); stepS(true); capY(); }
        for (let it = 0; it < 60; it++) { stepC(); capY(); if (stepS(true) < 0.01 && it > 10) break; }
        // grade wins over everything else: the smallest MAXG-Lipschitz envelope (max of cones from every node, exact
        // Dijkstra), applied to the raised and the sunken parts separately
        const envelope = (val) => {
            const best = new Map(); const heap = [];
            const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
            const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
            for (const n of nodeArr) { const v = val(n); if (v > 0.001) { best.set(n, v); push(n, v); } }
            while (heap.length) {
                const [v, n] = pop(); if (v < best.get(n)) continue;
                for (const e of n.edges) { const o = e.a === n ? e.b : e.a; const nv = v - MAXG * e.len; if (nv > 0.001 && nv > (best.get(o) ?? 0)) { best.set(o, nv); push(o, nv); } } // (virtual U-turn links too: traffic drives them)
            }
            return best;
        };
        const resid = () => { let r = 0; for (const e of edges) r = Math.max(r, Math.abs(e.b.y - e.a.y) - MAXG * e.len); return r; };
        const gradeFix = () => {
        {
            const up = envelope(n => Math.max(0, n.y)), dn = envelope(n => Math.max(0, -n.y));
            for (const n of nodeArr) { const u = up.get(n) ?? 0, d = dn.get(n) ?? 0; n.y = u >= d ? u : -d; }
        }
        // remaining conflicts (a sunken part right next to a raised one): signed Lipschitz smoothing — L = max-envelope,
        // U = min-envelope of the current heights; nodes in conflict move to (L+U)/2 until consistent
        var _dummy;
        const signedEnv = (sgn) => { // sgn 1: max_m (y_m − G·d), sgn −1: min_m (y_m + G·d)
            const best = new Map(); const heap = [];
            const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
            const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
            for (const n of nodeArr) if (n.edges.length) { best.set(n, n.y * sgn); push(n, n.y * sgn); }
            while (heap.length) {
                const [v, n] = pop(); if (v < best.get(n)) continue;
                for (const e of n.edges) { const o = e.a === n ? e.b : e.a; const nv = v - MAXG * e.len; if (nv > best.get(o) + 1e-6) { best.set(o, nv); push(o, nv); } }
            }
            return best;
        };
        for (let pass = 0; pass < 60 && resid() > 0.01; pass++) {
            const L = signedEnv(1), U = signedEnv(-1);
            for (const n of nodeArr) if (n.edges.length) n.y = (L.get(n) + (-U.get(n))) / 2;
        }
        };
        gradeFix();
        // overlapping carriageways: never 0.45–4 m apart (the car would snap between them) — merge or separate, then
        // re-establish the grades; a few rounds
        const stepO2 = () => {
            let bad = 0;
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = Math.abs(ye - yf);
                if (dh <= 0.45 || dh >= 4) continue;
                bad++;
                const [hi, th, lo, tl] = Math.abs(ye) > Math.abs(yf) ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                const target = dh < 2.2 ? yP(lo, tl) : yP(lo, tl) + Math.sign(yP(hi, th) - yP(lo, tl)) * 4.2;
                if (!moveAt(hi, th, target - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - (dh < 2.2 ? 0 : Math.sign(yP(hi, th) - yP(lo, tl)) * 4.2) - yP(lo, tl));
            }
            return bad;
        };
        // (2026-11-07, world-visual) a few merge-or-separate rounds for overlapping carriageways 0.45–4 m apart (ramps
        // lying 1–4 m above the street beside / under them, review #15c / #18), each followed by the grade fix; kept
        // only when it reduces those overlaps without adding clearance violations at crossings
        {
            const tuOf = (c, e) => clamp(((c.x - e.a.x) * e.dirx + (c.z - e.a.z) * e.dirz) / e.len, 0, 1);
            const score = () => {
                let cb = 0, ob = 0;
                for (const c of crossings) if ((yP(c.u, tuOf(c, c.u)) - yP(c.f, tuOf(c, c.f))) * (c.u.L > 0 ? 1 : -1) < 4.5) cb++;
                for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 4) ob++; }
                return { cb, ob };
            };
            const keep = nodeArr.map(n => n.y), s0 = score();
            if (s0.ob) {
                for (let r = 0; r < 8; r++) { if (!stepO2()) break; capY(); gradeFix(); }
                const s1 = score();
                if (s1.cb > s0.cb || s1.ob >= s0.ob || resid() > 0.05) nodeArr.forEach((n, i) => { n.y = keep[i]; });
                else profileStats0 = { overlapsBefore: s0.ob, overlapsAfter: s1.ob, crossBefore: s0.cb, crossAfter: s1.cb };
            }
            // (QA round 2) separate-or-dip: overlaps still 0.45–5 m apart (Pasajul Basarab over Orhideelor, Podul Barbu
            // Văcărescu over Șos. Pipera) are pulled to ≥ 5.2 m: the deck rises where its grade allows, otherwise the
            // street under it dips (an underpass, as Orhideelor really does under Basarab); < 1.2 m apart → one surface.
            // Kept when the 0.45–5 m count drops and crossing clearances do not get worse.
            // decks: every bridge / raised edge sampled every 3 m against the ribbons of the streets under it (the overlap list
            // above only takes centre lines closer than ~70 % of the widths: a ramp lying half over a street was missed)
            const ovS = [];
            for (const e of edges) {
                if (e.virtual || !(e.bridge || e.L > 0)) continue;
                for (let s2 = 1; s2 < e.len - 1; s2 += 3) {
                    const x = e.a.x + e.dirx * s2, z = e.a.z + e.dirz * s2;
                    edgesInBox(x - 16, z - 16, x + 16, z + 16, (f) => {
                        if (f === e || f.virtual || f.bridge || f.L > 0 || shares(e, f)) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0.02 || q.t >= 0.98) return;
                        if (q.d > Math.max(f.wR, f.wL) + shoulderOf(f) + Math.max(e.wR, e.wL) * 0.9) return;
                        ovS.push({ e, te: s2 / e.len, f, tf: q.t });
                    });
                }
            }
            const OV = overlaps.concat(ovS);
            const score5 = () => { let n = 0; for (const o of OV) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 5) n++; } return n; };
            const stepSep = () => {
                let bad = 0;
                for (const o of OV) {
                    const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = Math.abs(ye - yf);
                    if (dh <= 0.45 || dh >= 5) continue;
                    bad++;
                    const [hi, th, lo, tl] = ye > yf ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                    if (dh < 1.2) { if (!moveAt(hi, th, yP(lo, tl) - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - yP(lo, tl)); continue; }
                    const need = 5.2 - dh;
                    const before = yP(hi, th);
                    if (hi.bridge || hi.L > 0) moveAt(hi, th, need * 0.6);
                    const got = yP(hi, th) - before;
                    if (!lo.bridge && lo.L <= 0) moveAt(lo, tl, -(need - got));
                }
                return bad;
            };
            const keep2 = nodeArr.map(n => n.y), a0 = score5(), c0 = score().cb;
            if (a0 && globalThis.__sepPass === true) { // (off: on the upb / db routes it made the visual-QA stacked count worse — 17 → 19, 6 → 27)
                for (let r = 0; r < 24; r++) { if (!stepSep()) break; capY(); gradeFix(); }
                const a1 = score5(), c1 = score().cb;
                const rej = (c1 > c0 + (a1 < a0 * 0.75 ? 1 : 0)) || a1 >= a0 || resid() > 0.05; // (one crossing a little under 4.5 m is worth a large stacked-deck reduction)
                if (rej) nodeArr.forEach((n, i) => { n.y = keep2[i]; });
                profileStats0 = { ...(profileStats0 || {}), sepBefore: a0, sepAfter: a1, sepKept: !rej, sepCross: [c0, c1] };
            }
        }
        // (2026-11-07, world-visual) gores: a node of a ramp that still lies on the carriageway of the near-parallel road it
        // leaves / joins (sharing no node with it: the overlap list skips those pairs) takes that road's height, so the
        // ramp stays on the deck / street while the two overlap and only climbs / dives once it is clear of it (no ramp
        // slab 0.1–4.5 m above or below the road beside it: review #11 / #18). Kept only without new clearance violations.
        {
            const tuOf = (c, e) => clamp(((c.x - e.a.x) * e.dirx + (c.z - e.a.z) * e.dirz) / e.len, 0, 1);
            const crossBad = () => { let cb = 0; for (const c of crossings) if ((yP(c.u, tuOf(c, c.u)) - yP(c.f, tuOf(c, c.f))) * (c.u.L > 0 ? 1 : -1) < 4.5) cb++; return cb; };
            const goreScan = (apply) => {
                let n0 = 0;
                for (const n of nodeArr) {
                    if (!n.edges.length || hard.has(n)) continue;
                    // only a ramp next to the road it leaves / joins (connected within 4 edges): a street that merely
                    // runs beside / under a viaduct keeps its own level (Șos. Pipera under Podul Barbu Văcărescu)
                    if (!n.edges.some(e => /_link$/.test(e.type))) continue;
                    const near = new Set(); { let fr = [n]; const seenN = new Set([n]); for (let d = 0; d < 4; d++) { const nf = []; for (const m of fr) for (const e of m.edges) { near.add(e); const o = e.a === m ? e.b : e.a; if (!seenN.has(o)) { seenN.add(o); nf.push(o); } } fr = nf; } }
                    let best = null;
                    for (const e of n.edges) {
                        if (e.virtual) continue;
                        edgesInBox(n.x - 24, n.z - 24, n.x + 24, n.z + 24, (f) => {
                            if (f === e || f.virtual || f.a === n || f.b === n || (e.tunnel !== f.tunnel) || !near.has(f)) return;
                            if (Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.8) return;
                            const q = distPointSeg(n.x, n.z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0.02 || q.t >= 0.98) return;
                            const side = ((n.x - q.cx) * f.nx + (n.z - q.cz) * f.nz) >= 0 ? 1 : -1;
                            if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + e.halfW * 0.6) return;
                            const dh = yP(f, q.t) - n.y; if (Math.abs(dh) < 0.1 || Math.abs(dh) > 4.5) return;
                            if (!best || Math.abs(dh) < Math.abs(best)) best = dh;
                        });
                    }
                    if (best !== null) { n0++; if (apply) n.y += best; }
                }
                return n0;
            };
            const keep = nodeArr.map(n => n.y), g0 = goreScan(false), c0 = crossBad();
            if (g0) {
                for (let r = 0; r < 8; r++) { if (!goreScan(true)) break; capY(); gradeFix(); }
                const g1 = goreScan(false), c1 = crossBad();
                if (c1 > c0 || g1 >= g0 || resid() > 0.05) nodeArr.forEach((n, i) => { n.y = keep[i]; });
                profileStats0 = { ...(profileStats0 || {}), goreBefore: g0, goreAfter: g1 >= g0 || c1 > c0 ? g0 : g1, goreCross: [c0, c1] };
            }
        }
        // ---- (2026-11-07, world-visual) decks by OSM layer (data.roadInfo raw layer): a bridge chain that passes over a
        //      street is lifted to ≈ 5.5 m per level (Pasajul Basarab's upper level ≈ 11 m, Podul Barbu Văcărescu ≈ 5.5 m),
        //      the climb spread over the whole chain + the approach ramps (≤ 8 %); at-grade junction nodes stay at grade.
        //      y = min(max-of-cones from the deck targets, min-of-cones from the ground nodes): Lipschitz by construction.
        let deckStats = null;
        if (data.roadInfo) {
            const RI = data.roadInfo, rawLayer = (e) => { const v = RI[e.road * 6]; return Number.isFinite(v) ? v : e.layer; };
            const G = MAXG * 0.98, PER = 5.5;
            // deck chains: connected bridge edges with raw layer ≥ 1; a chain counts when any of its edges passes over a road
            const isDeck = (e) => !e.virtual && e.bridge && rawLayer(e) >= 1;
            const chainOf = new Map(); let nc = 0;
            for (const e of edges) {
                if (!isDeck(e) || chainOf.has(e)) continue;
                const st = [e]; chainOf.set(e, nc);
                while (st.length) { const f = st.pop(); for (const n of [f.a, f.b]) for (const g of n.edges) if (isDeck(g) && !chainOf.has(g)) { chainOf.set(g, nc); st.push(g); } }
                nc++;
            }
            const live = new Set(); for (const e of edges) if (chainOf.has(e) && (e.over?.length || crossings.some(c => c.u === e))) live.add(chainOf.get(e));
            for (const o of overlaps) for (const [u, f] of [[o.e, o.f], [o.f, o.e]]) if (chainOf.has(u) && !f.bridge && !f.tunnel) live.add(chainOf.get(u));
            const target = new Map();
            for (const [e, k] of chainOf) { if (!live.has(k)) continue; const t = Math.min(3, rawLayer(e)) * PER; for (const n of [e.a, e.b]) target.set(n, Math.max(target.get(n) ?? 0, t)); }
            if (target.size) {
                // ground nodes: junctions with an at-grade street (non-bridge, non-link, raw layer 0, not a tunnel), and
                // nodes that are hard (minor streets, river bridges)
                const atGrade = (e) => !e.virtual && !e.bridge && !e.tunnel && !/_link$/.test(e.type) && rawLayer(e) <= 0;
                const ground = [];
                for (const n of nodeArr) {
                    if (!n.edges.length || target.has(n)) continue;
                    const g = n.edges.filter(atGrade).length;
                    if ((g >= 1 && n.edges.length >= 3) || (g >= 2 && n.edges.every(atGrade)) || hard.has(n)) ground.push(n);
                }
                const dijk = (seeds, sgn) => { // max-plus (sgn 1: max(t − G d)) or min-plus (sgn −1: min(G d))
                    const best = new Map(), heap = [];
                    const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                    for (const [n, v] of seeds) { best.set(n, v * sgn); push(n, v * sgn); }
                    while (heap.length) { const [v, n] = pop(); if (v < best.get(n)) continue; for (const e of n.edges) { if (e.virtual) continue; const o = e.a === n ? e.b : e.a, nv = v - G * e.len; if (sgn > 0 && nv <= 0) continue; if (nv > (best.get(o) ?? -Infinity)) { best.set(o, nv); push(o, nv); } } }
                    return best;
                };
                const up = dijk([...target], 1), lim = dijk(ground.map(n => [n, 0]), -1); // lim: −G·d
                let raised = 0, maxY = 0;
                for (const [n, u] of up) {
                    if (ground.includes(n)) continue;
                    const cap = lim.has(n) ? -lim.get(n) : Infinity, y = Math.min(u, cap);
                    if (y > n.y + 0.05) { n.y = y; raised++; maxY = Math.max(maxY, y); }
                }
                deckStats = { chains: live.size, targets: target.size, ground: ground.length, raised, maxY: +maxY.toFixed(1) };
                profileStats0 = { ...(profileStats0 || {}), deck: deckStats };
            }
        }
        // ---- (2026-11-07, world-visual, play-test round 4) final profile sanity: only bridge decks and their own ramps may
        //      leave the ground. Earlier passes (cone ramps through the graph, constraint relaxation, overlap merge) also
        //      lifted at-grade streets (Calea Giulești to 14 m, Orhideelor 4.9 m) and left decks sloping into lanes. Here:
        //      ramps = *_link ways and same-name continuations of a deck through plain (degree-2) nodes, ≤ 300 m; every
        //      other street node is at grade (tunnels keep their depth); deck / ramp heights are recomputed as
        //      min(max-of-cones from the deck targets, G·distance to the nearest ground node) along deck + ramp edges.
        let finalStats = null; const deckTarget = new Map(); // (node → deck height target of the final pass; the gore pass keeps decks gentle)
        {
            const RI = data.roadInfo || [], rawLayer = (e) => { const v = RI[e.road * 6]; return Number.isFinite(v) ? v : e.layer; };
            const G = MAXG * 0.97, PER = 5.5;
            const isDeck = (e) => !e.virtual && e.bridge;
            const elig = new Set();
            { // ramps
                const q = []; const dist = new Map();
                for (const n of nodeArr) if (n.edges.some(isDeck)) { dist.set(n, 0); q.push(n); }
                while (q.length) {
                    const n = q.shift(), d0 = dist.get(n), approaches = n.edges.filter(e => isDeck(e) || elig.has(e)), deckNames = new Set(approaches.map(e => e.name));
                    const plain = n.edges.filter(f => !f.virtual).length <= 2;
                    for (const e of n.edges) {
                        if (e.virtual || isDeck(e) || e.tunnel || elig.has(e)) continue;
                        const link = /_link$/.test(e.type), same = e.name && deckNames.has(e.name) && plain;
                        // OSM often leaves a bridge's approach unnamed (Basarab's entry from Orhideelor). The bridge
                        // tag marks the structure, not the start of its climb: follow the unchanged carriageway back
                        // through plain nodes, stopping when it reaches a named street or a different carriageway.
                        const continuation = !e.name && plain && approaches.some(f => f !== e && f.type === e.type && f.oneway === e.oneway && f.lanesF === e.lanesF && f.lanesB === e.lanesB && Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) > 0.94);
                        if (!link && !same && !continuation) continue;
                        const o = e.a === n ? e.b : e.a, d = d0 + e.len; if (d > 300) continue;
                        elig.add(e); if (!dist.has(o) || dist.get(o) > d) { dist.set(o, d); q.push(o); }
                    }
                }
            }
            const region = (e) => isDeck(e) || elig.has(e);
            // live decks (pass over a road) and their targets
            const chainOf = new Map(); let nc = 0;
            for (const e of edges) { if (!isDeck(e) || chainOf.has(e)) continue; const st = [e]; chainOf.set(e, nc); while (st.length) { const f = st.pop(); for (const n of [f.a, f.b]) for (const g of n.edges) if (isDeck(g) && !chainOf.has(g)) { chainOf.set(g, nc); st.push(g); } } nc++; }
            const live = new Set(); for (const e of edges) if (chainOf.has(e) && (e.over?.length || crossings.some(c => c.u === e))) live.add(chainOf.get(e));
            for (const o of overlaps) for (const [u, f] of [[o.e, o.f], [o.f, o.e]]) if (chainOf.has(u) && !f.bridge && !f.tunnel) live.add(chainOf.get(u));
            const target = new Map();
            for (const [e, k] of chainOf) { if (!live.has(k)) continue; const t = Math.max(1, Math.min(3, rawLayer(e))) * PER; for (const n of [e.a, e.b]) target.set(n, Math.max(target.get(n) ?? 0, t)); }
            // ground nodes: touch any street that is neither deck nor ramp (tunnels aside)
            const groundN = new Set();
            for (const n of nodeArr) if (n.edges.some(e => !e.virtual && !region(e) && !e.tunnel)) groundN.add(n);
            const cone = (seeds, sgn) => {
                const best = new Map(), heap = [];
                const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                for (const [n, v] of seeds) { best.set(n, v * sgn); push(n, v * sgn); }
                while (heap.length) { const [v, n] = pop(); if (v < best.get(n)) continue; for (const e of n.edges) { if (!region(e)) continue; const o = e.a === n ? e.b : e.a, nv = v - G * e.len; if (nv > (best.get(o) ?? -Infinity)) { best.set(o, nv); push(o, nv); } } }
                return best;
            };
            for (const [n, v] of target) deckTarget.set(n, v);
            const up = cone([...target], 1), lim = cone([...groundN].map(n => [n, 0]), -1);
            let lowered = 0, raised = 0, maxY = 0;
            for (const n of nodeArr) {
                if (!n.edges.length) continue;
                const inRegion = n.edges.some(region), tunnelN = n.edges.some(e => e.tunnel && !e.virtual);
                if (tunnelN && n.y < 0) continue; // trenches / tunnels keep their depth
                let y;
                if (groundN.has(n) || !inRegion) y = Math.min(n.y, 0); // (only lifts are removed: trench approaches keep their dip)
                else { const u = up.get(n) ?? 0, cap = lim.has(n) ? -lim.get(n) : Infinity; y = Math.max(0, Math.min(u, cap)); }
                if (y < n.y - 0.05) lowered++; else if (y > n.y + 0.05) raised++;
                n.y = y; maxY = Math.max(maxY, y);
            }
            // An approach can run below another deck before its own bridge starts. Extending its climb must preserve
            // that overhead clearance too (the unnamed Basarab entry runs beside / below the through viaduct).
            // Carry the cap back and forward at the same grade as the ground cone, rather than adding a local step.
            const overhead = new Map(), UNDER_DECK_MAX_M = 1;
            for (const e of elig) {
                const steps = Math.max(1, Math.ceil(e.len / 2));
                for (let i = 0; i <= steps; i++) for (const off of [0, e.wR + shoulderOf(e), -e.wL - shoulderOf(e)]) {
                    const t = i / steps, x = e.a.x + e.dirx * e.len * t + e.nx * off, z = e.a.z + e.dirz * e.len * t + e.nz * off;
                    edgesInBox(x - 16, z - 16, x + 16, z + 16, f => {
                        if (f.virtual || !f.bridge || shares(e, f) || rawLayer(f) <= rawLayer(e)) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z), side = (x - q.cx) * f.nx + (z - q.cz) * f.nz;
                        if (q.t <= 0.01 || q.t >= 0.99 || q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + 0.25) return;
                        const he = e.a.y + (e.b.y - e.a.y) * t, hf = f.a.y + (f.b.y - f.a.y) * q.t;
                        if (hf < CLEAR_MIN || he >= hf || he <= hf - CLEAR_MIN) return;
                        // (owner, 2026-11-12, Grozavesti (194, -453) "why is it like that?"; Street View at 44.44529, 26.06167: the Orhideelor
                        // entry ramp passes under the Basarab viaduct about 1 m above the street, behind a concrete barrier, and climbs
                        // after it) an approach under another deck stays low there (at most 1 m), not just below its clearance
                        for (const n of [e.a, e.b]) overhead.set(n, Math.min(overhead.get(n) ?? Infinity, hf - CLEAR_MIN, UNDER_DECK_MAX_M));
                    });
                }
            }
            if (overhead.size) {
                const caps = cone([...overhead], -1);
                for (const [n, v] of caps) if (n.y > -v && n.y > 0) n.y = Math.max(0, -v);
            }
            finalStats = { ramps: elig.size, liveDecks: live.size, ground: groundN.size, lowered, raised, overheadCaps: overhead.size, maxY: +maxY.toFixed(1) };
            profileStats0 = { ...(profileStats0 || {}), final: finalStats };
        }
        // A source tunnel can continue through an untagged, already depressed approach. Its overlapping ground
        // carriageway still needs headroom; the bridge-only crossing pass cannot classify this layer-zero ramp.
        {
            const region = new Set(edges.filter(e => !e.virtual && e.tunnel)), queue = [...region].flatMap(e => [e.a, e.b]);
            const visited = new Set();
            while (queue.length) {
                const n = queue.pop(); if (visited.has(n)) continue; visited.add(n);
                const real = n.edges.filter(e => !e.virtual); if (real.length > 2) continue;
                for (const e of real) {
                    if (region.has(e) || e.bridge || Math.max(e.a.y, e.b.y) >= -0.05) continue;
                    region.add(e); queue.push(e.a === n ? e.b : e.a);
                }
            }
            const caps = new Map(), width = (e, side) => (side > 0 ? e.wR : e.wL) + shoulderOf(e);
            // A very short mapped bend can have intersecting inner mitres. Build a real, flat turning pad
            // across that local bend, with the approach grade carried back through the existing trench.
            // Independent per-edge corner collapse otherwise leaves both a crack and two different surfaces.
            const tight = new Set();
            for (const e of region) {
                if (e.tunnel || e.a.sourceId == null || e.b.sourceId == null) continue;
                for (const side of [1, -1]) {
                    const a = corner(e, e.a, side, width(e, side), width), b = corner(e, e.b, side, width(e, side), width);
                    if ((b[0] - a[0]) * e.dirx + (b[1] - a[1]) * e.dirz >= 0.05) continue;
                    for (const n of [e.a, e.b]) if (n.edges.filter(f => !f.virtual).length === 2) { tight.add(n); n.shortBendPad = true; }
                }
            }
            const bendGroups = [];
            for (const n of tight) {
                const nodes = new Set();
                for (const e of n.edges) if (region.has(e)) { nodes.add(e.a); nodes.add(e.b); }
                for (let i = bendGroups.length - 1; i >= 0; i--) if ([...nodes].some(p => bendGroups[i].has(p))) {
                    for (const p of bendGroups.splice(i, 1)[0]) nodes.add(p);
                }
                bendGroups.push(nodes);
            }
            const footprint = e => asphaltCorners(e, width);
            const contains = (p, P) => pointInPolygon(p[0], p[1], P) || P.some((a, i) => { const b = P[(i + 1) % P.length]; return distPointSeg(p[0], p[1], a[0], a[1], b[0], b[1]).d < 1e-7; });
            const height = (e, p) => yP(e, clamp(((p[0] - e.a.x) * e.dirx + (p[1] - e.a.z) * e.dirz) / e.len, 0, 1));
            let constraints = 0;
            for (const e of region) {
                if (e.tunnel) continue;
                const A = footprint(e), pad = Math.max(width(e, 1), width(e, -1)) * 2.5 + 17;
                edgesInBox(Math.min(e.a.x, e.b.x) - pad, Math.min(e.a.z, e.b.z) - pad, Math.max(e.a.x, e.b.x) + pad, Math.max(e.a.z, e.b.z) + pad, f => {
                    if (f.virtual || region.has(f) || f.bridge || shares(e, f) || Math.min(f.a.y, f.b.y) < -0.05) return;
                    const B = footprint(f), P = A.filter(p => contains(p, B)).concat(B.filter(p => contains(p, A)));
                    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
                        const a = A[i], b = A[(i + 1) % 4], c = B[j], d = B[(j + 1) % 4], rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
                        if (Math.abs(den) < 1e-9) continue;
                        const qx = c[0] - a[0], qz = c[1] - a[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
                        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) P.push([a[0] + t * rx, a[1] + t * rz]);
                    }
                    if (P.length < 3 || P.every(p => height(f, p) - height(e, p) >= CLEAR_MIN)) return;
                    constraints++;
                    const ceiling = Math.min(...P.map(p => height(f, p))) - CLEAR_MIN;
                    for (const n of [e.a, e.b]) caps.set(n, Math.min(caps.get(n) ?? Infinity, ceiling));
                });
            }
            for (const nodes of bendGroups) {
                const level = Math.min(...[...nodes].map(n => Math.min(n.y, caps.get(n) ?? Infinity)));
                for (const n of nodes) caps.set(n, level);
            }
            const before = new Map([...region].flatMap(e => [e.a, e.b]).map(n => [n, n.y]));
            const pending = [...caps];
            while (pending.length) {
                const [n, cap] = pending.pop(); if (n.y <= cap) continue; n.y = cap;
                for (const e of n.edges) if (region.has(e)) { const o = e.a === n ? e.b : e.a, limit = cap + MAXG * e.len; if (o.y > limit) pending.push([o, limit]); }
            }
            let residual = 0, lowered = 0, maxDrop = 0;
            for (const e of edges) if (!e.virtual) residual = Math.max(residual, Math.abs(e.a.y - e.b.y) - MAXG * e.len);
            for (const [n, y] of before) { if (n.y < y - 0.001) lowered++; maxDrop = Math.max(maxDrop, y - n.y); }
            const kept = residual < 0.001;
            if (!kept) { for (const [n, y] of before) n.y = y; for (const n of tight) delete n.shortBendPad; }
            profileStats0 = { ...(profileStats0 || {}), tunnelApproach: { constraints, turningPads: kept ? tight.size : 0, lowered: kept ? lowered : 0, maxDrop: kept ? maxDrop : 0, kept } };
        }
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
        {
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
            profileStats0 = { ...(profileStats0 || {}), gore: { lowered: fixes, rounds, left: pairs, maxDrop: +maxDrop.toFixed(2) } };
        }
        let residual = 0; for (const e of edges) if (!e.virtual) residual = Math.max(residual, Math.abs(e.b.y - e.a.y) - MAXG * e.len);
        for (const e of edges) { e.ya = e.a.y; e.yb = e.b.y; }
        let cBad = 0, oBad = 0;
        for (const c of crossings) { const tu = clamp(((c.x - c.u.a.x) * c.u.dirx + (c.z - c.u.a.z) * c.u.dirz) / c.u.len, 0, 1), tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1); if ((yP(c.u, tu) - yP(c.f, tf)) * (c.u.L > 0 ? 1 : -1) < 3) cBad++; }
        for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 2.6) oBad++; }
        profileStats = { merge: profileStats0, crossings: crossings.length, overlaps: overlaps.length, clearanceViolations: cBad, overlapSteps: oBad, gradeResidual: +residual.toFixed(3), hardNodes: hard.size, nanAt };
        function yAt(e, x, z) { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.a.y + (e.b.y - e.a.y) * t; }
        // ramps (embankments / trenches) have at most a narrow service walkway: their walls stand right at the kerb
        for (const e of edges) if (!e.bridge && Math.max(Math.abs(e.ya), Math.abs(e.yb)) > 0.3) e.sidewalk = Math.min(e.sidewalk, 0.5);
        // (QA r2) ramps / bridge approaches that pass over a street with < 5 m clearance carry no sidewalk: their walkways
        // lay 1–2 m above the street's carriageway (Pasajul Basarab, Podul Barbu Văcărescu)
        for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.3 && d < 5) { const hi = yP(o.e, o.te) > yP(o.f, o.tf) ? o.e : o.f; hi.sidewalk = Math.min(hi.sidewalk, 0.3); } }
        { // (round 6) the pieces of one OSM segment (profile points) share its narrowest walkway, as the whole edge did
            const seg = new Map(); for (const e of edges) if (e.seg !== undefined) seg.set(e.seg, Math.min(seg.get(e.seg) ?? Infinity, e.sidewalk));
            for (const e of edges) if (e.seg !== undefined) e.sidewalk = seg.get(e.seg);
        }
    }
    return {
        profileStats0: profileStats0, profileStats: profileStats,
    };
}
