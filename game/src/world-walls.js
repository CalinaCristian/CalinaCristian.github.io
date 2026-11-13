// ============================================================================
//  WORLD WALLS AND BARRIERS — wall grid, surface heights, barriers, retaining walls
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { emitOwnedSeparationQuad } from './generated-parapet-ownership.js';
import { exactMemo3 } from './bridge-surface-mesh.js';
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { rgb, shadeRgb } from './geobuild.js';
import { GUARD_CONCRETE, bridgeGuardRow, emitBridgeGuard, emitGuardScreen, emitGuardSteel, guardBlockH } from './bridge-guards.js';
import { BoxGrid, Y } from './world-shared.js';

export function buildWallsBarriers(ctx) {
    const {
        cellOf, data, distCfg, edgeGrid, edges, medianGrid, onOtherCarriageway, padHeightAt,
        parapetOwnership, polyDist, raisedDeck, retract, ribGrid, ribPoly, ribbons, segsCross,
        sharedTrenchSide, surfacesAt, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, wallCut, walls,
        widthAsphalt, widthSide, yAlong,
    } = ctx;
    let { blocksLane } = ctx; // (updated here, handed back: see the return)
    {
        const wallGrid = [];
        const surfaceAt = (x, z, own) => { // heights of the other ribbons under (x, z)
            const hs = [];
            medianGrid.each(x, z, x, z, d => { if (pointInPolygon(x, z, d.poly)) { const h = d.roofHeightAt(x, z) - Y.road; hs.push(h); (hs.items || (hs.items = [])).push([h, false]); } }); // (a filled median: no guard along it)
            ribGrid.each(x, z, x, z, (rb) => { if (rb.e === own || (rb.e && (rb.e.a === own.a || rb.e.b === own.b || rb.e.a === own.b || rb.e.b === own.a)) || (rb.node && (rb.node === own.a || rb.node === own.b))) return; if (x < rb.x0 || x > rb.x1 || z < rb.z0 || z > rb.z1 || !pointInPolygon(x, z, rb.poly)) return; const h = rb.e ? yAlong(rb.e,x,z) : padHeightAt(rb.node, x, z); hs.push(h); hs.tol = Math.max(hs.tol || 0, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85 ? 0 : 1); (hs.items || (hs.items = [])).push([h, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85]); }); return hs; };
        const add = (e, s, offset, kind, tFrom, tTo, force = false) => {
            // sub-divide into ~6 m pieces so the wall can be cut where it would cross another carriageway (junction mouths)
            const offAt = typeof offset === 'function' ? offset : () => offset; // (a lateral offset may vary along the edge: the line between two carriageways)
            const yAtT = (t) => { const off = offAt(t); return Y.road + yAlong(e,e.a.x+e.dirx*e.len*t+e.nx*off*s,e.a.z+e.dirz*e.len*t+e.nz*off*s); };
            // trench walls reach street level (cars up there must not fall in) — except under a tunnel's roof
            const range = (y) => kind === 'rail' ? [y > 2.6 ? y - 2.2 : -1.5, y + 1.1] : kind === 'embank' ? [-1.5, y + 1.1] : kind === 'trench' ? [y - 1.5, (e.lidded || (e.tunnel && y < -4.2)) ? Math.min(1.0, y + 4.6) : 1.0] : [y - 1.0, y + 0.85];
            const n = Math.max(1, Math.ceil((tTo - tFrom) * e.len / (e.sourceBridgeGrade?.known?1.5:3)));
            let last = null;
            for (let k = 0; k < n; k++) {
                const t0 = tFrom + (tTo - tFrom) * k / n, t1 = tFrom + (tTo - tFrom) * (k + 1) / n;
                const offA = offAt(t0), offB = offAt(t1);
                let ax = e.a.x + e.dirx * e.len * t0 + e.nx * offA * s, az = e.a.z + e.dirz * e.len * t0 + e.nz * offA * s;
                let bx = e.a.x + e.dirx * e.len * t1 + e.nx * offB * s, bz = e.a.z + e.dirz * e.len * t1 + e.nz * offB * s;
                const mx = (ax + bx) / 2, mz = (az + bz) / 2, ym = yAtT((t0 + t1) / 2) - Y.road;
                // another road continues the surface just beyond the wall at the same level (junction mouth, merging
                // ramp, the adjacent carriageway): leave it open. A road at a different level (a ramp diving next to a
                // street) or a gap keeps the wall.
                let open = false;
                for (const f of [0.03, 0.25, 0.5, 0.75, 0.97]) for (const o of [0, 0.7]) if (!open) {
                    const px = ax + (bx - ax) * f + e.nx * s * o, pz = az + (bz - az) * f + e.nz * s * o;
                    const yy = yAtT(t0 + (t1 - t0) * f) - Y.road; open = (surfaceAt(px, pz, e).items || []).some(([h, par]) => Math.abs(h - yy) < (par ? 0.3 : 0.45));
                }
                if ((open && !force) || (kind === 'trench' && (onOtherCarriageway(e, mx, mz) || sharedTrenchSide(e, mx, mz, e.nx * s, e.nz * s, ym)))) { last = null; continue; } // (#59: no trench wall across the other ramp at a gore; one shared wall between two sunken ramps)
                const ra = range(yAtT(t0)), rbb = range(yAtT(t1));
                if (kind === 'rail' && tramGrades.excludesInferredObstacle([ax, az], [bx, bz], { inferred: true, y0a: ra[0], y1a: ra[1], y0b: rbb[0], y1b: rbb[1], kind: 'bridge-guard-collision', sourceId: data.roadSourceGeometry?.[e.road]?.sourceId })) { last = null; continue; }
                let skirtRaised = false;
                if (kind === 'rail' && tramSweep) {
                    // This guard's collision band hangs 2.2 m below the deck surface, deeper than the slab. Where a tram passes
                    // below, the band starts above the tram's swept body instead (the guard reads 0.3 m below a wall's base);
                    // the parapet on the deck keeps its whole height. A parapet a tram really reaches is left as it is.
                    const base = Math.min(ra[0], rbb[0]), top = Math.max(ra[1], rbb[1]);
                    if (tramSweep.segment([ax, az], [bx, bz], .05, base - .3, top)) for (const lift of [1.1, 1.9]) {
                        if (tramSweep.segment([ax, az], [bx, bz], .05, base + lift - .3, top)) continue;
                        ra[0] += lift; rbb[0] += lift; skirtRaised = true; tramSweepConflicts.guardSkirtsRaised = (tramSweepConflicts.guardSkirtsRaised || 0) + 1; break;
                    }
                }
                if (skirtRaised) last = null; // (its own piece: the raised base is not blended along a longer wall)
                if (!e.sourceBridgeGrade?.known && last && Math.hypot(bx - last.ax, bz - last.az) < 24) { // extend the previous piece (the band is linear along the edge)
                    Object.assign(last, { bx, bz, y0b: rbb[0], y1b: rbb[1], x: (last.ax + bx) / 2, z: (last.az + bz) / 2, r: Math.hypot(bx - last.ax, bz - last.az) / 2 + 0.3, yr: (last.y0a + rbb[0]) / 2 + 0 * ym });
                    last.yr = undefined; continue;
                }
                last = { wall: true, ax, az, bx, bz, y0a: ra[0], y1a: ra[1], y0b: rbb[0], y1b: rbb[1], yr: undefined, nx: -e.nx * s, nz: -e.nz * s, kind, edge: e, x: mx, z: mz, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1, ta: t0, tb: t1 };
                walls.push(last); if (skirtRaised) last = null;
            }
        };
        void wallGrid;
        for (const e of edges) {
            if (e.virtual) continue;
            const t0 = 0, t1 = 1; // the whole edge: junction mouths are opened by the lane-cut rule below
            const yA = e.ya, yB = e.yb;
            const plainMw = /^(motorway|trunk)$/.test(e.type) && !e.a.pad && !e.b.pad && e.a.edges.length === 2 && e.b.edges.length === 2 && !e.bridge && !e.tunnel;
            // portion of [t0, t1] where the profile is beyond a threshold
            const sub = (pred, thr) => {
                const f = (t) => e.sourceBridgeGrade?.known?e.sourceBridgeGrade.heightAt(t):yA + (yB - yA) * t;
                if (pred(f(t0), thr) && pred(f(t1), thr)) return [t0, t1];
                if (!pred(f(t0), thr) && !pred(f(t1), thr)) return null;
                let tc = clamp((thr - yA) / ((yB - yA) || 1e-9), t0, t1);
                if(e.sourceBridgeGrade?.known){let lo=t0,hi=t1;for(let i=0;i<50;i++){const t=(lo+hi)/2;if((f(t)<thr)===(f(t0)<thr))lo=t;else hi=t;}tc=(lo+hi)/2;}
                return pred(f(t0), thr) ? [t0, tc] : [tc, t1];
            };
            for (const s of [1, -1]) {
                if (e.bridge && e.overWater) { add(e, s, widthAsphalt(e, s) + 0.3, 'rail', t0, t1); continue; }
                if (e.bridge) { // (owner, 2026-11-11, Grozavesti (70, 128): no railing where the ramp is still at street level; a kerb and the wall below)
                    const hi = sub((y, t) => y > t, 1.0); if (hi) add(e, s, widthAsphalt(e, s) + 0.3, 'rail', hi[0], hi[1]);
                    const lo = sub((y, t) => y > t, 0.35); if (lo && (!hi || lo[0] < hi[0] - 1e-6 || lo[1] > hi[1] + 1e-6)) { const parts = hi ? [[lo[0], hi[0]], [hi[1], lo[1]]].filter(([a, b]) => b - a > 1e-4) : [lo]; for (const [a, b] of parts) add(e, s, widthSide(e, s), 'embank', a, b); }
                    continue;
                }
                const up = sub((y, t) => y > t, 0.35); if (up) add(e, s, widthSide(e, s), 'embank', up[0], up[1]);
                // (owner register #45, Pipera: "walls and barriers cross streets beneath bridge") a road dipping less than 1 m is a
                // slope, not a trench: no retaining wall (they stood across the junction mouths under Podul Barbu Vacarescu)
                const dn = e.tunnel || e.lidded ? sub((y, t) => y < t, -0.35) : sub((y, t) => y < t, -1.0); if (dn) add(e, s, widthSide(e, s), 'trench', dn[0], dn[1]);
                // (round 3, otopeni-8: DN1 at 44.56865, 26.069899 has a kerb, sidewalk and bus stop, no guard) a trunk road with a
                // mapped sidewalk of 1.2 m or more keeps its kerb (district worlds; only DN1 in Otopeni qualifies on 2026-11-13)
                if (!up && !dn && plainMw && !(e.type === 'trunk' && (e.sidewalk || 0) >= 1.2)) {
                    const first = walls.length;
                    add(e, s, widthAsphalt(e, s) + 0.2, 'guard', t0, t1);
                    for (let i = first; i < walls.length; i++) walls[i].generatedRoadGuard = true;
                }
            }
            // median barrier on two-way motorways / trunk roads with a central reservation
            if (/^(motorway|trunk)$/.test(e.type) && !e.oneway && e.median > 0.5 && !e.tramMedian && t1 - t0 > 0.05) {
                const first = walls.length;
                add(e, 1, e.laneCenterShiftM || 0, 'guard', t0, t1);
                for (let i = first; i < walls.length; i++) walls[i].generatedMedian = true;
            }
            // (fidelity pass 2026-11-12, Otopeni: DN1 was six lanes of open asphalt) a dual carriageway mapped as two one-way
            // trunk / motorway ways whose ribbons meet has no reservation for the rule above, and the side guards take the
            // other carriageway for a road that continues the surface. One concrete barrier stands on the line between the
            // two (reference checked on DN1 at 44.5595 / 44.5672 / 44.5687: a continuous New Jersey barrier). A district
            // opts in (cities.js `dualCarriagewayBarrier`); only the carriageway heading north / east emits it, and junction
            // mouths or median openings are cut by the lane rule below like any other guard.
            if (distCfg?.dualCarriagewayBarrier && /^(motorway|trunk)$/.test(e.type) && e.oneway && !e.bridge && !e.tunnel && e.dirx * 0.001 - e.dirz > 0 && Math.abs(yA) < 0.35 && Math.abs(yB) < 0.35) {
                const n = Math.max(1, Math.ceil(e.len / 15)), wE = widthAsphalt(e, -1), offs = [];
                for (let k = 0; k <= n; k++) {
                    const tm = k / n, px = e.a.x + e.dirx * e.len * tm, pz = e.a.z + e.dirz * e.len * tm; let off = null;
                    edgeGrid.each(px - 30, pz - 30, px + 30, pz + 30, (f) => {
                        if (f === e || f.virtual || !f.oneway || f.bridge || f.tunnel || !/^(motorway|trunk)$/.test(f.type) || e.dirx * f.dirx + e.dirz * f.dirz > -0.9) return;
                        const q = distPointSeg(px, pz, f.a.x, f.a.z, f.b.x, f.b.z), wF = widthAsphalt(f, -1);
                        if (Math.abs((q.cx - px) * e.dirx + (q.cz - pz) * e.dirz) > 2 || (q.cx - px) * e.nx + (q.cz - pz) * e.nz >= 0) return; // (abreast of this point, on its left)
                        if (q.d - wE - wF < 0.7) { const v = q.d * wE / (wE + wF); if (off === null || v < off) off = v; }
                    });
                    offs.push(off);
                }
                const offAt = (t) => { const u = clamp(t * n, 0, n), k = Math.min(n - 1, Math.floor(u)), a = offs[k], b = offs[k + 1]; return a + (b - a) * (u - k); };
                for (let k = 0; k < n; k++) {
                    if (offs[k] === null) continue; let m = k; while (m < n && offs[m + 1] !== null) m++; if (m === k) continue; // a run of sampled stations with the other carriageway abreast
                    const first = walls.length; add(e, -1, offAt, 'guard', k / n, m / n, true);
                    for (let i = first; i < walls.length; i++) walls[i].generatedMedian = walls[i].dualMedian = true;
                    k = m;
                }
            }
        }
        // final rule: no wall piece may stand on another carriageway / junction pad at its own height band (junction
        // mouths, merging ramps, overlapping ribbons stay open). Walls are cut into 1.5 m pieces and re-joined.
        blocksLane = (w, x, z, f) => {
            const mg = w.kind === 'barrier' || !w.edge ? 0 : 0.3, y0 = w.y0a + (w.y0b - w.y0a) * f - mg, y1 = w.y1a + (w.y1b - w.y1a) * f + mg;
            let hit = false;
            ribGrid.each(x - 0.6, z - 0.6, x + 0.6, z + 0.6, (rb) => {
                if (hit || (w.edge && rb.e === w.edge)) return;
                // (spec 10 load budget) every hit below needs (x, z) inside rb.poly, whose exact bounds these are (the test
                // that stood further down, now first: the cheaper rejection for the ribbons a grid cell merely shares)
                if (x < rb.x0 - 0.6 || x > rb.x1 + 0.6 || z < rb.z0 - 0.6 || z > rb.z1 + 0.6) return;
                if (w.dualMedian) { // the barrier between two carriageways: their shoulders lap its line; only a road that crosses the median opens it
                    if (rb.e && rb.e.oneway && /^(motorway|trunk)$/.test(rb.e.type) && Math.abs(w.edge.dirx * rb.e.dirx + w.edge.dirz * rb.e.dirz) > 0.9) return;
                    if (rb.node) {
                        const sg = rb.node === w.edge.a || rb.node === w.edge.b ? -1 : 1; // (own junction: a branch to the left; the other carriageway's: a branch towards this one)
                        if (!(rb.node.allEdges || rb.node.edges).some(g => { if (g.virtual) return false; const o = g.a === rb.node ? g.b : g.a, vx = o.x - rb.node.x, vz = o.z - rb.node.z; return sg * (vx * w.edge.nx + vz * w.edge.nz) / (Math.hypot(vx, vz) || 1) > 0.35; })) return;
                    }
                }
                if (!w.edge) {
                    // Source rail compartments have no fabricated motor edge.
                    // Audit their actual vertical band against the road body.
                    if (pointInPolygon(x, z, rb.poly)) {
                        const h = Y.road + (rb.e ? yAlong(rb.e, x, z) : padHeightAt(rb.node, x, z));
                        if (h < y1 && h + 2 > y0) hit = true;
                    }
                    return;
                }
                if (w.node && (rb.node === w.node || (rb.e && (rb.e.a === w.node || rb.e.b === w.node)))) return; // a pad-rim barrier vs its own junction / approaches
                if (rb.node && !w.node && (rb.node === w.edge.a || rb.node === w.edge.b)) { // its own junction: keep the wall along the edge proper
                    const e = w.edge, sAl = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz;
                    if (sAl > retract(e, e.a) + 0.3 && sAl < e.len - retract(e, e.b) - 0.3 && (rb.node.allEdges || rb.node.edges).filter(f => !f.virtual).length <= 2) return; // (a real junction's pad is used by the other approaches)
                }
                if (x < rb.x0 - 0.6 || x > rb.x1 + 0.6 || z < rb.z0 - 0.6 || z > rb.z1 + 0.6) return;
                // An exact source junction opens across the full incoming pavement. A wall's round collision
                // end can otherwise close its last few centimetres; a rising approach can also meet a barrier
                // with its body while its wheels are still below that barrier's narrow height band.
                const meets = (a, b, n) => (b.a === n || b.b === n) && Math.abs((a.a === n ? a.ya : a.yb) - (b.a === n ? b.ya : b.yb)) < 0.3;
                const n = [w.edge.a, w.edge.b].find(n => n.sourceId > 0 && n.pad && (rb.node === n
                    ? (n.allEdges || n.edges).some(e => e !== w.edge && !e.virtual && meets(w.edge, e, n))
                    : rb.e && (meets(w.edge, rb.e, n) || (n.allEdges || n.edges).some(e => {
                        const q = e.a === n ? e.b : e.a;
                        return e !== w.edge && !e.virtual && e.len <= retract(w.edge, n) && q.sourceId > 0 && meets(w.edge, e, n) && meets(e, rb.e, q);
                    })))); // a short exact-source approach can end inside the same junction mouth
                const along = n ? ((x - n.x) * w.edge.dirx + (z - n.z) * w.edge.dirz) * (w.edge.a === n ? 1 : -1) : Infinity;
                const mouth = n && along >= -0.3 && along <= retract(w.edge, n) + 0.3;
                if (!pointInPolygon(x, z, rb.poly) || (!mouth && polyDist(x, z, rb.poly) < 0.3)) return;
                if (mouth) {
                    const h = Y.road + (rb.e ? yAlong(rb.e, x, z) : padHeightAt(n, x, z));
                    if (h < y1 && h + 2 > y0) { hit = true; return; } // same 2 m driving body as collideBuildings
                }
                if (w.kind !== 'barrier') { hit = true; return; } // wide-band walls (embankment / trench / rail / guard) never stand in a lane
                // at a split / merge the sibling ramp (sharing a node with the wall's edge) is driven through the gore: a barrier
                // standing in its lanes is always cut (the wall across 'Exit → Westfield Southcenter', QA round 2)
                const sib = rb.e && w.edge && ((/_link$/.test(rb.e.type) && /_link$/.test(w.edge.type)) || rb.e.bridge || w.edge.bridge) && (rb.e.a === w.edge.a || rb.e.a === w.edge.b || rb.e.b === w.edge.a || rb.e.b === w.edge.b);
                if (sib) { const n = (rb.e.a === w.edge.a || rb.e.a === w.edge.b) ? rb.e.a : rb.e.b;
                    const hS = Y.road + yAlong(rb.e,x,z), own = (y0 + y1) / 2;
                    if (Math.hypot(x - n.x, z - n.z) < ((rb.e.bridge || w.edge.bridge) ? 40 : 15) && Math.abs(hS - own) < 1.6 && polyDist(x, z, rb.poly) > 0.5) { hit = true; return; } } // (a deck leaving its street at a split: no barrier in the street's lane — play-test note 12)
                // narrow separation barriers: only where the lane continues on both sides (a lane merely ending at the line keeps it)
                if (!pointInPolygon(x + w.nx * 0.9, z + w.nz * 0.9, rb.poly) || !pointInPolygon(x - w.nx * 0.9, z - w.nz * 0.9, rb.poly)) return;
                // and a car pushed through the gap would really land on a surface at this level (same test as roadHeight)
                let cont = false; surfacesAt(x - w.nx * 0.6, z - w.nz * 0.6, (hh) => { if (hh + 2 > y0 && hh < y1) cont = true; }, null, false, w.edge);
                if (!cont) return;
                const h = Y.road + (rb.e ? yAlong(rb.e,x,z) : padHeightAt(rb.node, x, z));
                if (h + 2 > y0 && h < y1) hit = true; // full native driving body, as in the exact-junction branch above
            });
            return hit;
        };
        // (spec 10 load budget) a wall the last cut kept whole, whose copy has the very same ends and heights, would be
        // sampled again at the same points with the same answers (blocksLane reads no wall; the sweeps between the cuts
        // only add walls): it is kept whole again without the samples
        const settled = new WeakSet();
        const cutWalls = () => {
        const kept = []; let cutPieces = 0;
        for (const w of walls) {
            const L = Math.hypot(w.bx - w.ax, w.bz - w.az), n = Math.max(1, Math.ceil(L / 1.0));
            let run = null;
            const emit = (f0, f1) => {
                const lerp = (a, b, f) => a + (b - a) * f;
                const ax = lerp(w.ax, w.bx, f0), az = lerp(w.az, w.bz, f0), bx = lerp(w.ax, w.bx, f1), bz = lerp(w.az, w.bz, f1);
                const p = { ...w, ax, az, bx, bz, y0a: lerp(w.y0a, w.y0b, f0), y1a: lerp(w.y1a, w.y1b, f0), y0b: lerp(w.y0a, w.y0b, f1), y1b: lerp(w.y1a, w.y1b, f1), x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3 };
                kept.push(p);
                if (f0 === 0 && f1 === 1 && p.ax === w.ax && p.az === w.az && p.bx === w.bx && p.bz === w.bz && p.y0a === w.y0a && p.y1a === w.y1a && p.y0b === w.y0b && p.y1b === w.y1b) settled.add(p);
            };
            if (settled.has(w)) { emit(0, 1); continue; } // (the samples' run: [0, n / n])
            for (let k = 0; k < n; k++) {
                const f0 = k / n, f1 = (k + 1) / n;
                let bad = false;
                for (let q = 0; q <= 4; q++) { const f = f0 + (f1 - f0) * q / 4; if (!bad) bad = blocksLane(w, w.ax + (w.bx - w.ax) * f, w.az + (w.bz - w.az) * f, f); }
                if (bad) { cutPieces++; if (run) { emit(run[0], run[1]); run = null; } }
                else if (run) run[1] = f1; else run = [f0, f1];
            }
            if (run) emit(run[0], run[1]);
        }
        walls.length = 0; for (const w of kept) if (Math.hypot(w.bx - w.ax, w.bz - w.az) > 0.4) walls.push(w);
        wallCut.n += cutPieces;
        };
        cutWalls();
        // separation barriers: where a road's edge borders another carriageway at a different level (a ramp diving /
        // climbing right next to a street — OSM geometry squeezed by the map scale), a car leaving the road there would
        // drop / jump onto it. Put a visible concrete barrier on that edge instead of an invisible cliff.
        let wg = null; const rebuildWg = () => { wg = new BoxGrid(16); for (const w of walls) wg.insert(Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz), w); };
        // (spec 10 load budget) the barrier sweeps ask about the same points again (two thirds of the questions): land is
        // a pure function of (x, z, y) while they run (they add walls; surfacesAt reads none), so its answers are kept
        const land = exactMemo3((x, z, y) => { let best = null, bd = Infinity; surfacesAt(x, z, (h) => { const d = Math.abs(h - y); if (d <= 2.5 && d < bd) { bd = d; best = h; } }); return best ?? Y.road; });
        const blocked = (x0, z0, x1, z1, y) => { let f = false; wg.each(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (w) => {
            if (f) return; if (!segsCross([x0, z0], [x1, z1], [w.ax, w.az], [w.bx, w.bz]) && distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).d > 1.0) return;
            const t = distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).t; if (y >= w.y0a + (w.y0b - w.y0a) * t - 0.3 && y <= w.y1a + (w.y1b - w.y1a) * t) f = true; }); return f; };
        const barrierCol = rgb('#b9b6ae');
        // (spec 10 load budget) an edge's centre-line height at its samples is the same for both sides and every sweep (the
        // same t sequence, yAlong a pure function of the point): kept per edge and sample
        const ownAt = new Map();
        const genBarriers = () => {
        rebuildWg();
        for (const e of edges) {
            if (e.virtual) continue;
            const t0 = 0, t1 = 1; // the whole edge: junction mouths are opened by the lane-cut rule below
            const step = Math.max(0.02, 1.5 / e.len);
            let ownv = ownAt.get(e); if (!ownv) ownAt.set(e, ownv = []);
            for (const s of [1, -1]) {
                const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s));
                let run = null;
                const flush = () => {
                    if (!run) return;
                    const { ta, tb } = run; run = null;
                    const P2 = (t) => [e.a.x + e.dirx * e.len * t + e.nx * off * s, e.a.z + e.dirz * e.len * t + e.nz * off * s];
                    const pieces=e.sourceBridgeGrade?.known?Math.max(1,Math.ceil((tb-ta)*e.len/1.5)):1;
                    for(let piece=0;piece<pieces;piece++){
                        const aT=ta+(tb-ta)*piece/pieces,bT=ta+(tb-ta)*(piece+1)/pieces;
                    const [ax, az] = P2(aT), [bx, bz] = P2(bT); const ya = Y.road + yAlong(e,ax,az), yb = Y.road + yAlong(e,bx,bz);
                    const w = { wall: true, inferred: true, ax, az, bx, bz, y0a: ya - 0.45, y1a: ya + 0.45, y0b: yb - 0.45, y1b: yb + 0.45, nx: -e.nx * s, nz: -e.nz * s, kind: 'barrier', edge: e, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                    }
                };
                for (let t = t0, k = 0; t <= t1 + 1e-6; t += step, k++) {
                    const tt = Math.min(t, t1);
                    let own = ownv[k]; if (own === undefined) own = ownv[k] = Y.road + yAlong(e,e.a.x+e.dirx*e.len*tt,e.a.z+e.dirz*e.len*tt);
                    const x = e.a.x + e.dirx * e.len * tt + e.nx * (off + 0.6) * s, z = e.a.z + e.dirz * e.len * tt + e.nz * (off + 0.6) * s;
                    const ix = e.a.x + e.dirx * e.len * tt + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * tt + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                    // (owner register #59: the drop beside a sunken ramp hovering about 0.45 m switched the barrier on and off in
                    // 2-5 m pieces) a run starts at a 0.45 m drop and goes on while the drop stays over 0.25 m
                    const bad = Math.abs(land(x, z, own) - own) > (run ? 0.25 : 0.45) && !blocked(ix, iz, x, z, own);
                    if (bad) { if (!run) run = { ta: Math.max(t0, tt - step * 0.6), tb: Math.min(t1, tt + step * 0.6) }; else run.tb = Math.min(t1, tt + step * 0.6); }
                    else flush();
                }
                flush();
            }
        }
        // the same along the exposed rim of junction pads (elevated / sunken junctions)
        for (const rb of ribbons) {
            if (!rb.node || rb.poly.length < 3) continue;
            const n = rb.node, own = Y.road + n.y, P = rb.poly;
            let cx = 0, cz = 0; for (const [x, z] of P) { cx += x; cz += z; } cx /= P.length; cz /= P.length;
            for (let k = 0; k < P.length; k++) {
                const p = P[k], q = P[(k + 1) % P.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.3) continue;
                let ox = (q[1] - p[1]) / L, oz = -(q[0] - p[0]) / L; if ((p[0] + q[0]) / 2 * ox + (p[1] + q[1]) / 2 * oz - (cx * ox + cz * oz) < 0) { ox = -ox; oz = -oz; }
                const steps = Math.max(1, Math.ceil(L / 1.5)); let run = null;
                const mouth = (x, z) => n.edges.some(e => { if (e.virtual) return false; const rp = ribPoly.get(e); return rp && (pointInPolygon(x, z, rp) || polyDist(x, z, rp) < 0.4); });
                const flush = () => {
                    if (!run) return; const a0 = run[0], b0 = run[1]; run = null;
                    const ax = p[0] + (q[0] - p[0]) * a0, az = p[1] + (q[1] - p[1]) * a0, bx = p[0] + (q[0] - p[0]) * b0, bz = p[1] + (q[1] - p[1]) * b0;
                    const oa = Y.road + padHeightAt(n, ax, az), ob = Y.road + padHeightAt(n, bx, bz);
                    const w = { wall: true, inferred: true, ax, az, bx, bz, y0a: oa - 0.45, y1a: oa + 0.45, y0b: ob - 0.45, y1b: ob + 0.45, nx: -ox, nz: -oz, kind: 'barrier', edge: n.edges[0], node: n, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                };
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t, ownH = Y.road + padHeightAt(n, x, z);
                    // (a rim sample whose outside point is on one of this junction's own approaches is a mouth: open)
                    const bad = !mouth(x + ox * 0.6, z + oz * 0.6) && Math.abs(land(x + ox * 0.6, z + oz * 0.6, ownH) - ownH) > 0.45 && !blocked(n.x, n.z, x + ox * 0.6, z + oz * 0.6, ownH);
                    if (bad) { if (!run) run = [Math.max(0, t - 0.5 / steps), Math.min(1, t + 0.5 / steps)]; else run[1] = Math.min(1, t + 0.5 / steps); } else flush();
                }
                flush();
            }
        }
        };
        genBarriers(); cutWalls(); genBarriers(); cutWalls();
        genBarriers(); cutWalls(); // last sweep: barriers only where a car would still drop / step, and never standing in a lane
        // The inferred barrier is built pad by pad, and each piece stops 0.3-0.6 m short of its pad's end: along a deck that
        // left a see-through slot at every source node (233 on Grozavesti). Two pieces of one line, at one height, whose
        // ends are less than 1.4 m apart are joined at the middle of the gap, unless a surface continues at their level
        // just beyond it (a real mouth stays open).
        const barrierJoins = walls.barrierJoins = { joined: 0, keptOpen: 0 }; // (read again for the build statistics)
        for (let round = 0, before = -1; round < 4 && barrierJoins.joined !== before; round++) { // (pieces of the three sweeps overlap: an end can be taken by another pair first)
            before = barrierJoins.joined;
            const ends = [], eg = new BoxGrid(8), unit = w => { const L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1; return [(w.bx - w.ax) / L, (w.bz - w.az) / L]; };
            // (owner register #15, Grozavesti: "upper ramp parapet gaps") bridge rails cut into 1-2 m pieces left 0.3-1 m slots that the
            // drawn guard showed as a broken railing: they are joined the same way (compared at their tops: the collision bands hang differently)
            for (const w of walls) if ((w.kind === 'barrier' && w.inferred === true) || (w.kind === 'rail' && w.edge?.bridge && !w.tramDeckRailing)) for (const end of [0, 1]) { const rail = w.kind === 'rail', q = { w, end, x: end ? w.bx : w.ax, z: end ? w.bz : w.az, y0: rail ? (end ? w.y1b : w.y1a) - 1.55 : end ? w.y0b : w.y0a, y1: end ? w.y1b : w.y1a, done: false }; ends.push(q); eg.insert(q.x, q.z, q.x, q.z, q); }
            for (const a of ends) {
                if (a.done) continue; let best = null; const da = unit(a.w);
                // (owner register #59, SeaTac: drop barriers at the sunken ramps beside the helix stood in 2-5 m pieces with 1-3 m
                // gaps) inferred concrete barriers join across up to 3 m; bridge rails keep 1.4 m
                const reachM = a.w.kind === 'barrier' ? 3 : 1.4;
                eg.each(a.x - reachM, a.z - reachM, a.x + reachM, a.z + reachM, b => {
                    if (b.w === a.w || b.done || b.w.kind !== a.w.kind) return; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), db = unit(b.w);
                    if (d < .02 || d > reachM || (best && d >= best.d) || Math.abs(da[0] * db[0] + da[1] * db[1]) < .94 || Math.abs(dx * da[1] - dz * da[0]) > .35 || Math.abs(a.y0 - b.y0) > .3) return;
                    // the gap lies beyond this end, not back along the piece
                    if ((dx * da[0] + dz * da[1]) * (a.end ? 1 : -1) < 0) return;
                    best = { d, b };
                });
                if (!best) continue;
                const b = best.b, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, own = (a.y0 + b.y0) / 2 + .45 - Y.road;
                if ((surfaceAt(mx - a.w.nx * .6, mz - a.w.nz * .6, a.w.edge).items || []).some(([h, par]) => Math.abs(h - own) < (par ? .3 : .45))) { barrierJoins.keptOpen++; continue; }
                for (const q of [a, b]) { const w = q.w; if (q.end) { w.bx = mx; w.bz = mz; } else { w.ax = mx; w.az = mz; } w.x = (w.ax + w.bx) / 2; w.z = (w.az + w.bz) / 2; w.r = Math.hypot(w.bx - w.ax, w.bz - w.az) / 2 + .3; q.done = true; }
                barrierJoins.joined++;
            }
        }
        // These barriers are inferred, not source barrier records. Clip only
        // bounded pieces conflicting with a known source rail's actual fleet.
        const railClearWalls = [];
        for (const w of walls) {
            const conflict = (a, b, f0, f1) => tramGrades.excludesInferredObstacle(a, b, { inferred: true, bodyEnvelope: tramPropEnvelope, radiusM: .15,
                y0a: w.y0a + (w.y0b - w.y0a) * f0, y1a: w.y1a + (w.y1b - w.y1a) * f0 + .45,
                y0b: w.y0a + (w.y0b - w.y0a) * f1, y1b: w.y1a + (w.y1b - w.y1a) * f1 + .45,
                kind: 'inferred-separation-barrier', sourceId: data.roadSourceGeometry?.[w.edge?.road]?.sourceId })
                || !!tramSweep?.segment(a, b, .15, Math.min(w.y0a + (w.y0b - w.y0a) * f0, w.y0a + (w.y0b - w.y0a) * f1) - .3, Math.max(w.y1a + (w.y1b - w.y1a) * f0, w.y1a + (w.y1b - w.y1a) * f1));
            // (tram sweep, Pasajul Basarab west start: a ramp's embankment wall stood 5 cm inside a tram running beside it) an
            // embankment collision wall touching a tram's swept path moves toward its own carriageway by up to 1 m; the
            // drawn retaining wall is unchanged
            if (w.kind === 'embank' && tramPropEnvelope) { const hit = (dx, dz) => conflict([w.ax + dx, w.az + dz], [w.bx + dx, w.bz + dz], 0, 1);
                if (hit(0, 0)) for (const d of [.1, .2, .3, .4, .5, .6, .8, 1]) if (!hit(w.nx * d, w.nz * d)) { w.ax += w.nx * d; w.az += w.nz * d; w.bx += w.nx * d; w.bz += w.nz * d; w.x += w.nx * d; w.z += w.nz * d; tramSweepConflicts.embankWallsInset = (tramSweepConflicts.embankWallsInset || 0) + 1; break; } }
            if (w.kind !== 'barrier' || w.inferred !== true || !tramPropEnvelope || !conflict([w.ax, w.az], [w.bx, w.bz], 0, 1)) { railClearWalls.push(w); continue; }
            const count = Math.max(1, Math.ceil(Math.hypot(w.bx - w.ax, w.bz - w.az))); let run = null;
            const emit = () => {
                if (!run) return; const [f0, f1] = run, lerp = (a, b, t) => a + (b - a) * t;
                const ax = lerp(w.ax, w.bx, f0), az = lerp(w.az, w.bz, f0), bx = lerp(w.ax, w.bx, f1), bz = lerp(w.az, w.bz, f1);
                railClearWalls.push({ ...w, ax, az, bx, bz, y0a: lerp(w.y0a, w.y0b, f0), y0b: lerp(w.y0a, w.y0b, f1), y1a: lerp(w.y1a, w.y1b, f0), y1b: lerp(w.y1a, w.y1b, f1),
                    x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + .3 }); run = null;
            };
            for (let i = 0; i < count; i++) {
                const f0 = i / count, f1 = (i + 1) / count, a = [w.ax + (w.bx - w.ax) * f0, w.az + (w.bz - w.az) * f0], b = [w.ax + (w.bx - w.ax) * f1, w.az + (w.bz - w.az) * f1];
                if (conflict(a, b, f0, f1)) emit(); else if (run) run[1] = f1; else run = [f0, f1];
            }
            emit();
        }
        walls.length = 0; walls.push(...railClearWalls);
        // draw the concrete separation barriers that survived
        for (const w of walls) {
            if(w.kind==='rail'&&w.edge&&raisedDeck(w.edge)){} // (drawn after the guard completion, its joins and the width-step tapers: see there)
            // (owner, 2026-11-11, Grozavesti (286, -776): "still broken", barriers on the Exit to Giulesti ramp in chunks) the
            // parapet of every other bridge is drawn exactly along its final collision rail: one continuous run wherever the
            // deck has an edge to guard, open exactly where the rail is open (junction mouths, merging decks)
            else if (w.kind === 'rail' && w.edge && w.edge.bridge && !w.tramDeckRailing) {
                const L = Math.hypot(w.bx - w.ax, w.bz - w.az), gc = cellOf((w.ax + w.bx) / 2, (w.az + w.bz) / 2);
                if (emitBridgeGuard(gc.solid, gc.detail, w, bridgeGuardRow(data.roadSourceGeometry?.[w.edge.road]?.sourceId))) {} // (reviewed guard class: bridge-guards.js)
                else if (L > .05) {
                    const sb = cellOf((w.ax + w.bx) / 2, (w.az + w.bz) / 2).solid, ta = w.y1a, tb = w.y1b, ba = ta - 1.1, bb = tb - 1.1, ox = -w.nx * .3, oz = -w.nz * .3;
                    const A0 = [w.ax, ba, w.az], B0 = [w.bx, bb, w.bz], B1 = [w.bx, tb, w.bz], A1 = [w.ax, ta, w.az], A2 = [w.ax + ox, ta, w.az + oz], B2 = [w.bx + ox, tb, w.bz + oz], A3 = [w.ax + ox, ba, w.az + oz], B3 = [w.bx + ox, bb, w.bz + oz];
                    sb.face4(A0, B0, B1, A1, rgb('#8a939d'), [w.nx, 0, w.nz]); sb.face4(B3, A3, A2, B2, rgb('#9aa3ad'), [-w.nx, 0, -w.nz]); sb.face4(A1, B1, B2, A2, rgb('#b0b8c0'), [0, 1, 0]);
                    sb.face4(A3, A0, A1, A2, rgb('#9aa3ad'), [-(w.bx - w.ax) / L, 0, -(w.bz - w.az) / L]); sb.face4(B0, B3, B2, B1, rgb('#9aa3ad'), [(w.bx - w.ax) / L, 0, (w.bz - w.az) / L]);
                }
            }
            if (w.generatedMedian || w.generatedRoadGuard) {
                // Exactly the final surviving collision intervals, including
                // openings at pads and crossing ribbons. Real OSM barriers use
                // their separate existing source-emission path.
                const L = Math.hypot(w.bx-w.ax,w.bz-w.az), px = -(w.bz-w.az)/L*.3, pz = (w.bx-w.ax)/L*.3, ya = w.y1a-.85, yb = w.y1b-.85, c = cellOf(w.x,w.z);
                const a=[w.ax+px,ya,w.az+pz],b=[w.bx+px,yb,w.bz+pz],d=[w.ax-px,ya,w.az-pz],q=[w.bx-px,yb,w.bz-pz],up=p=>[p[0],p[1]+(w.generatedMedian ? .8 : .85),p[2]];
                c.solid.face4(a,b,up(b),up(a),barrierCol,[px,0,pz]);c.solid.face4(q,d,up(d),up(q),barrierCol,[-px,0,-pz]);
                c.solid.face4(up(a),up(b),up(q),up(d),rgb('#cfccc4'),[0,1,0]);
                c.solid.face4(d,a,up(a),up(d),barrierCol,[-w.edge.dirx,0,-w.edge.dirz]);c.solid.face4(b,q,up(q),up(b),barrierCol,[w.edge.dirx,0,w.edge.dirz]);
                continue;
            }
            if (w.kind !== 'barrier') continue;
            // (owner, 2026-11-11: "why are we mixing fences with borders?" / "missing chunks and overlapping chunks") On the
            // elevated Basarab decks an edge was guarded by the white rail where the guard builder ran and by these grey
            // concrete pieces where the pad-rim rule did, piece by piece around every node. They are not drawn there and
            // their walls are removed; the guard completion fences those edges with one continuous white rail.
            if (w.inferred === true && w.edge && raisedDeck(w.edge)) continue; // (owner, 2026-11-12, (77, 112): grey piece on a 2.4 m ramp too) // (replaced by the continuous guard: see the guard completion below)
            const ya = w.y0a + 0.45, yb = w.y0b + 0.45, L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1, px = -(w.bz - w.az) / L * 0.15, pz = (w.bx - w.ax) / L * 0.15;
            const c = cellOf(w.x, w.z);
            const metadata={inferred:w.inferred===true,emitter:'separation-barrier',sourceId:data.roadSourceGeometry?.[w.edge?.road]?.sourceId,edgeId:w.edge?.id};
            // (reviewed guard class of a bridge way, bridge-guards.js: the concrete part keeps this owned emission at the class's height, the steel part is added above it)
            const gRow = w.inferred === true && w.edge?.bridge ? bridgeGuardRow(metadata.sourceId) : null, gH = gRow && guardBlockH(gRow) != null ? guardBlockH(gRow) - .25 : .9, gCol = gH !== .9 ? GUARD_CONCRETE : barrierCol;
            for (const sd of [1, -1]) emitOwnedSeparationQuad(c.solid,[[w.ax + px * sd, ya, w.az + pz * sd], [w.bx + px * sd, yb, w.bz + pz * sd], [w.bx + px * sd, yb + gH, w.bz + pz * sd], [w.ax + px * sd, ya + gH, w.az + pz * sd]],shadeRgb(gCol,sd>0?1:.9),[px*sd,0,pz*sd],metadata,parapetOwnership);
            emitOwnedSeparationQuad(c.solid,[[w.ax + px, ya + gH, w.az + pz], [w.bx + px, yb + gH, w.bz + pz], [w.bx - px, yb + gH, w.bz - pz], [w.ax - px, ya + gH, w.az - pz]],shadeRgb(gCol,1.08),[0,1,0],metadata,parapetOwnership);
            if (gH !== .9) { emitGuardSteel(c.detail, w.ax, w.az, w.bx, w.bz, ya - .25, yb - .25, gRow); emitGuardScreen(c.detail, w.ax, w.az, w.bx, w.bz, ya - .25, yb - .25, gRow, w); } // (round 3: noise screens, pipera-1)
        }
    }
    return {
        blocksLane: blocksLane,
    };
}
