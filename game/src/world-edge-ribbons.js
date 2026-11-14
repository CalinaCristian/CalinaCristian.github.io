// ============================================================================
//  EDGE RIBBONS — per edge: carriageway, shoulders, raised sidewalks and junction corners, parapets, lane markings, turn arrows
//  (moved out of world-ribbons.js' buildRibbons, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { buildGeneratedParapetOwnership } from './generated-parapet-ownership.js';
import { displaceBandedSurface } from './bridge-surface-band.js';
import { clamp, distPointSeg, makeRng, pointInPolygon } from './util.js';
import { MeshBuilder, rgb, shadeRgb } from './geobuild.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { basarabEdge } from './basarab-structure.js';
import { clipMarkingHalfPlane } from './road-markings.js';
import { subtractConvex } from './building-overlap.js';
import { BoxGrid, Y, isMotorwayTrunk, shoulderOf, signedArea } from './world-shared.js';

export function buildEdgeRibbons(ctx) {
    const {
        RETAIN_H, US, asphaltBase, asphaltEnds, ballastCol, band, cellOf, city,
        concreteCol, convexApart, convexOverlap, corner, coveredByOther, dash, dashLine, data,
        displace, edgeGrid, edges, edgesInBox, isConcrete, kerbCol, lampSpots, laneTapers,
        layerY, markProxy, nodeArr, pushPad, railRoadside, raised, raisedEdge, researchTrees,
        retainedDeck, retract, ribPoly, ribbons, rng, roads, sharedBridgeMeshAudit, sideCol,
        sideExtra, solidLine, str, surfGrid, tramGrades, treeSpots, white, widthAsphalt,
        widthKerb, widthSide, yAlong, yellow, zebraRects,
    } = ctx;
    const DY_SIDE = Y.road + Y.kerb - Y.side; // props stand at Y.side (+ profile): raised by this on a raised sidewalk
    const sideJoins = new Map(); // pad node → [{ e, asph, outer }] sidewalk ends meeting at a junction
    const cornerPolys = [], cornerGrid = new BoxGrid(24); // raised junction corners {p, n, x0..z1}
    let raisedPieces = 0; const cornerSkips = []; // (stats: why a junction corner was left low)
    const SIDE_BACK = 0.3; // the raised top runs this far past the property line (fences / hedges there stand on it)
    const parapetOwnership = buildGeneratedParapetOwnership();
    for (const e of edges) {
        if (e.virtual) continue; // invisible U-turn connectors
        const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
        const c = cellOf(mx, mz);
        const v0g = c.ground.vc, v0m = c.marks.vc, v0s = c.solid.vc, v0p = c.road.vc;
        const i0g = c.ground.ic, i0s = c.solid.ic, i0p = c.road.ic, i0m = c.marks.ic;
        const bridgeGuardSourceId = data.roadSourceGeometry?.[e.road]?.sourceId;
        const bridgeGuard = e.bridge && /^w\d+$/.test(bridgeGuardSourceId || '') ? new MeshBuilder() : null;
        const elevated = Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01;
        if (elevated) raised.push(e);
        const ly = layerY(e);
        const yR = Y.road + ly, yS = Y.side + ly, yM = Y.road + ly + Y.mark;
        const [aR, bR, bL, aL] = ribPoly.get(e);
        { const [ca, cb] = asphaltEnds(e); const mb = c.road, u = 0.15;
          const i0 = mb.v(aR[0], yR, aR[1], 0, 1, 0, aR[0] * u, aR[1] * u, ca), i1 = mb.v(bR[0], yR, bR[1], 0, 1, 0, bR[0] * u, bR[1] * u, cb);
          const i2 = mb.v(bL[0], yR, bL[1], 0, 1, 0, bL[0] * u, bL[1] * u, cb), i3 = mb.v(aL[0], yR, aL[1], 0, 1, 0, aL[0] * u, aL[1] * u, ca);
          mb.triUp(i0, i1, i2); mb.triUp(i0, i2, i3); }
        for (const poly of railRoadside.footprint(e, [aR, bR, bL, aL])) ribbons.push({ e, poly });
        // sidewalks
        const hasSide = Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) > 0.3;
        if ((!hasSide || e.deckWalk) && (e.bridge || elevated) && !e.tunnel) {
            // (round 6 note 52) decks / ramps without a walkway: a concrete edge strip from the asphalt to under the barrier
            // (it stands 0.3 m out) — the gap showed the ground / the void below the deck as a black band
            // per side, and only where the strip would not lie over another road (a gore with a ramp at another height)
            const wE = (ed, sd) => widthAsphalt(ed, sd) + 0.45, wI = (ed, sd) => Math.max(0.1, widthAsphalt(ed, sd) - 0.05);
            for (const sd of [1, -1]) {
                if (e.deckWalk && sidewalkWidth(e, sd) > .3) continue; // (the deck walkway's own side)
                let clear = true;
                for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
                    const px = e.a.x + (e.b.x - e.a.x) * t + e.nx * wE(e, sd) * sd, pz = e.a.z + (e.b.z - e.a.z) * t + e.nz * wE(e, sd) * sd, py = yAlong(e,px,pz);
                    edgesInBox(px - 1, pz - 1, px + 1, pz + 1, (f) => { if (!clear || f === e || f.virtual) return; const q = distPointSeg(px, pz, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.d < Math.max(f.wL, f.wR) + shoulderOf(f) && Math.abs(yAlong(f,px,pz) - py) > 0.05) clear = false; });
                    if (!clear) break;
                }
                if (!clear) continue;
                const oa = corner(e, e.a, sd, wE(e, sd), wE), ob = corner(e, e.b, sd, wE(e, sd), wE), ia = corner(e, e.a, sd, wI(e, sd), wI), ib = corner(e, e.b, sd, wI(e, sd), wI);
                c.ground.flatQuad(ia[0], ia[1], ib[0], ib[1], ob[0], ob[1], oa[0], oa[1], yR - 0.02, shadeRgb(sideCol, 0.82), 0.25);
            }
        }
        if (hasSide) {
            const sa = corner(e, e.a, 1, widthSide(e, 1), widthSide), sb = corner(e, e.b, 1, widthSide(e, 1), widthSide);
            const ta = corner(e, e.a, -1, widthSide(e, -1), widthSide), tb = corner(e, e.b, -1, widthSide(e, -1), widthSide);
            // (owner, 2026-11-12, Grozavesti (770, -1016) "lane gets tiny", (352, -726): grey strips across the lanes where two
            // decks merge) a bridge's walkway band lying on another carriageway at its level is left out: the band is cut
            // in 1 m pieces there. An edge none of whose pieces is covered keeps its one quad.
            const sideCol2 = e.bridge ? shadeRgb(sideCol, 0.9) : sideCol, lpS = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
            const sidePieces = [];
            if (e.bridge && elevated && !e.tunnel) for (const [oa, ob, ia, ib, right] of [[sa, sb, aR, bR, true], [ta, tb, aL, bL, false]]) {
                const k = Math.max(1, Math.ceil(Math.hypot(ob[0] - oa[0], ob[1] - oa[1])));
                for (let j = 0; j < k; j++) {
                    const o0 = lpS(oa, ob, j / k), o1 = lpS(oa, ob, (j + 1) / k), i0 = lpS(ia, ib, j / k), i1 = lpS(ia, ib, (j + 1) / k), mx2 = (o0[0] + o1[0] + i0[0] + i1[0]) / 4, mz2 = (o0[1] + o1[1] + i0[1] + i1[1]) / 4;
                    const q = right ? [o0, o1, i1, i0] : [i0, i1, o1, o0], covered = coveredByOther(mx2, mz2, e, yAlong(e, mx2, mz2), 0.02, false, 0.6);
                    // (round 3, r2-perf-1: a piece whose centre was clear still lay 0.56 m over the Exit → Giulești carriageway at
                    // the gore (410.9, -759.7)) the whole piece is tested: the part over another carriageway / pad 0.15 - 1 m above or below is cut away
                    let frags = null;
                    if (!covered) { const xs = q.map(p => p[0]), zs = q.map(p => p[1]);
                        surfGrid.each(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), o => { if (o.e === e) return; const cur0 = frags || [q]; if (cur0.every(f => convexApart(f, o.poly))) return;
                            // (its level where it meets the piece: a corner of the piece inside it, else its own centre; sourced profiles throw outside their section;
                            //  a level neighbour, under 0.15 m apart, keeps the old centre test: the frame budget)
                            const at = q.find(p => pointInPolygon(p[0], p[1], o.poly)) || [o.poly.reduce((s, p) => s + p[0], 0) / o.poly.length, o.poly.reduce((s, p) => s + p[1], 0) / o.poly.length];
                            let dy; try { dy = o.h(at[0], at[1]) - yAlong(e, at[0], at[1]); } catch (err) { return; } if (!(Math.abs(dy) >= 0.15 && Math.abs(dy) <= 1.0)) return; const cur = frags || [q]; if (cur.every(f => convexApart(f, o.poly))) return; frags = cur.flatMap(f => convexApart(f, o.poly) ? [f] : subtractConvex(f, o.poly)).filter(f => Math.abs(signedArea(f)) > 0.01); }); }
                    sidePieces.push({ q, covered: covered || (frags !== null && !frags.length), frags });
                }
            }
            if (!sidePieces.some(p => p.covered || p.frags)) c.ground.flatQuad(sa[0], sa[1], sb[0], sb[1], tb[0], tb[1], ta[0], ta[1], yS, sideCol2, 0.25);
            else for (const { q, covered, frags } of sidePieces) if (frags) { for (const f of frags) c.ground.flatFan(f, yS, sideCol2, 0.25); } else if (!covered) c.ground.flatQuad(q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1], yS, sideCol2, 0.25);
            if (e.a.pad) { if (sidewalkWidth(e, 1) > .3) pushPad(e.a, 'side', sa); if (sidewalkWidth(e, -1) > .3) pushPad(e.a, 'side', ta); }
            if (e.b.pad) { if (sidewalkWidth(e, 1) > .3) pushPad(e.b, 'side', sb); if (sidewalkWidth(e, -1) > .3) pushPad(e.b, 'side', tb); }
            // kerbs: raised strip + vertical face along both edges
            if ((!isMotorwayTrunk(e.type) || e.deckWalk) && !e.tunnel) {
                for (const s of [1, -1]) {
                    if (sidewalkWidth(e, s) <= .3) continue;
                    const ia = s > 0 ? aR : aL, ib = s > 0 ? bR : bL;
                    const oa = corner(e, e.a, s, widthKerb(e, s), widthKerb), ob = corner(e, e.b, s, widthKerb(e, s), widthKerb);
                    const top = yR + Y.kerb;
                    // in ~4 m pieces; a piece that would stand on another carriageway / pad (a touching dual carriageway,
                    // a slip lane, a junction) is left out: the kerb never cuts across asphalt
                    const L = Math.max(Math.hypot(ib[0] - ia[0], ib[1] - ia[1]), Math.hypot(ob[0] - oa[0], ob[1] - oa[1]));
                    const k = Math.max(1, Math.ceil(L / 4));
                    const lp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
                    // (a piece with a corner on another surface is split in 1 m pieces, each tested on all four corners:
                    //  no kerb strip reaches into a crossing carriageway — review #8)
                    const cov = (p) => coveredByOther(p[0], p[1], e, yAlong(e, p[0], p[1]), 0.02);
                    // (2026-11-08) the sidewalk itself at the kerb's height: its top from the kerb strip to the
                    // property line + a face down to the ground at its back (the paving used to lie 0.22 m below the kerb top)
                    const raise = raisedEdge(e, s), wbk = (f, sf) => widthSide(f, sf) + (sidewalkWidth(f, sf) > .3 ? SIDE_BACK : 0);
                    const sa2 = raise ? corner(e, e.a, s, wbk(e, s), wbk) : null, sb2 = raise ? corner(e, e.b, s, wbk(e, s), wbk) : null;
                    const piece = (i0, i1, o0, o1) => {
                        c.ground.flatQuad(i0[0], i0[1], i1[0], i1[1], o1[0], o1[1], o0[0], o0[1], top, kerbCol, 0.25);
                        c.ground.wall(i0[0], i0[1], i1[0], i1[1], yR - 0.01, top, -e.nx * s, -e.nz * s, shadeRgb(kerbCol, 0.85));
                    };
                    for (let j = 0; j < k; j++) {
                        const i0 = lp(ia, ib, j / k), i1 = lp(ia, ib, (j + 1) / k), o0 = lp(oa, ob, j / k), o1 = lp(oa, ob, (j + 1) / k);
                        const cx = (i0[0] + i1[0] + o0[0] + o1[0]) / 4, cz = (i0[1] + i1[1] + o0[1] + o1[1]) / 4;
                        if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), 0.05)) continue;
                        if (!cov(i0) && !cov(i1) && !cov(o0) && !cov(o1)) { piece(i0, i1, o0, o1); continue; }
                        const m = Math.max(1, Math.ceil(Math.hypot(i1[0] - i0[0], i1[1] - i0[1])));
                        for (let q = 0; q < m; q++) {
                            const a0 = lp(i0, i1, q / m), a1 = lp(i0, i1, (q + 1) / m), b0 = lp(o0, o1, q / m), b1 = lp(o0, o1, (q + 1) / m);
                            if (!cov(a0) && !cov(a1) && !cov(b0) && !cov(b1)) piece(a0, a1, b0, b1);
                        }
                    }
                    if (raise) { // the raised sidewalk top, kerb strip → property line + SIDE_BACK: sampled densely (a side street,
                        //          a driveway, a median, a pad between two corners is never paved over), 0.8 m pieces near them
                        const swq = (o0, o1, w0, w1) => {
                            c.ground.flatQuad(o0[0], o0[1], o1[0], o1[1], w1[0], w1[1], w0[0], w0[1], top, sideCol, 0.25);
                            // (owner: "not smooth at all the transition") a 1 m slope down to the ground behind, not a 0.34 m ledge
                            // (a vertical face where the slope would land on another surface)
                            // (owner, again: "still feels like it's floating") 2.4 m long (≈ 8°), the sidewalk's own paving colour
                            const SL = 2.4, f0 = [w0[0] + e.nx * s * SL, w0[1] + e.nz * s * SL], f1 = [w1[0] + e.nx * s * SL, w1[1] + e.nz * s * SL];
                            // A ramp's back slope cannot project over the street below it: use its retaining face.
                            // The usual 1 m level filter is for kerbs / markings, not for this apron footprint.
                            const backCov = p => coveredByOther(p[0], p[1], e, yAlong(e, p[0], p[1]), 0.02, false, elevated ? Infinity : 1);
                            if (e.deckWalk && e.bridge) { // a deck walkway ends at the deck edge: its outer face down to the deck, the railing stands on it
                                c.ground.wall(w0[0], w0[1], w1[0], w1[1], yR - 0.45, top, e.nx * s, e.nz * s, shadeRgb(sideCol, 0.8)); raisedPieces++; return; }
                            if (!backCov(f0) && !backCov(f1) && !backCov(lp(f0, f1, 0.5)) && !backCov(lp(w0, f0, 0.5)) && !backCov(lp(w1, f1, 0.5))) c.ground.face4([w0[0], top, w0[1]], [w1[0], top, w1[1]], [f1[0], Y.landuse + 0.01, f1[1]], [f0[0], Y.landuse + 0.01, f0[1]], sideCol, [e.nx * s * 0.34, SL, e.nz * s * 0.34]);
                            else c.ground.wall(w0[0], w0[1], w1[0], w1[1], Y.landuse - 0.02, top, e.nx * s, e.nz * s, shadeRgb(sideCol, 0.8));
                            raisedPieces++;
                        };
                        const clear = (o0, o1, w0, w1, fs) => { for (const f of fs) { const p1 = lp(o0, o1, f), p2 = lp(w0, w1, f); if (cov(p1) || cov(p2) || cov(lp(p1, p2, 0.5))) return false; } return true; };
                        const F5 = [0, 0.25, 0.5, 0.75, 1], F3 = [0, 0.5, 1]; let covered = 0;
                        for (let j = 0; j < k; j++) {
                            const o0 = lp(oa, ob, j / k), o1 = lp(oa, ob, (j + 1) / k), w0 = lp(sa2, sb2, j / k), w1 = lp(sa2, sb2, (j + 1) / k);
                            if (clear(o0, o1, w0, w1, F5)) { swq(o0, o1, w0, w1); continue; }
                            const m = Math.max(1, Math.ceil(Math.hypot(o1[0] - o0[0], o1[1] - o0[1]) / 0.8));
                            for (let q = 0; q < m; q++) { const a0 = lp(o0, o1, q / m), a1 = lp(o0, o1, (q + 1) / m), b0 = lp(w0, w1, q / m), b1 = lp(w0, w1, (q + 1) / m); if (clear(a0, a1, b0, b1, F3)) swq(a0, a1, b0, b1); else if (e.deckWalk) covered += 1 / (k * m); }
                        }
                        // (bridge-walkways.js) how much of a deck walkway another carriageway at its level covers: the crowd keeps off one mostly covered
                        if (e.deckWalk) (e.deckWalkCovered || (e.deckWalkCovered = {}))[s] = Math.round(covered * 100) / 100;
                    }
                    if (raise) for (const n of [e.a, e.b]) { // a raised sidewalk that just stops (dead end, map edge): close its end
                        if (n.pad || n.edges.filter(f => !f.virtual).length !== 1) continue;
                        const [ki, wo] = n === e.a ? [oa, sa2] : [ob, sb2], ri = n === e.a ? ia : ib, out = n === e.a ? -1 : 1;
                        c.ground.wall(ri[0], ri[1], wo[0], wo[1], Y.landuse - 0.02, top, e.dirx * out, e.dirz * out, shadeRgb(sideCol, 0.8));
                    }
                    if (raise && e.deckWalk && e.bridge) for (const n of [e.a, e.b]) { // a deck walkway the next edge does not carry on: its end face (bridge-walkways.js)
                        const next = n.pad ? null : n.edges.find(f => f !== e && !f.virtual); if (n.pad || (next && raisedEdge(next, (next.a === n) === (e.b === n) ? s : -s))) continue;
                        const [ki, wo] = n === e.a ? [oa, sa2] : [ob, sb2], out = n === e.a ? -1 : 1;
                        c.ground.wall(ki[0], ki[1], wo[0], wo[1], yR - 0.45, top, e.dirx * out, e.dirz * out, shadeRgb(sideCol, 0.8));
                    }
                    if (raise) for (const n of [e.a, e.b]) if (n.pad) { // corner pieces at the junction (drawn with the pads)
                        let L2 = sideJoins.get(n); if (!L2) sideJoins.set(n, L2 = []);
                        L2.push({ e, asph: n === e.a ? ia : ib, outer: n === e.a ? sa2 : sb2 });
                    }
                }
            }
        }
        if (e.a.pad) { pushPad(e.a, 'road', aR); pushPad(e.a, 'road', aL); }
        if (e.b.pad) { pushPad(e.b, 'road', bR); pushPad(e.b, 'road', bL); }
        // ---- markings
        const s0 = retract(e, e.a), s1 = e.len - retract(e, e.b);
        const sourceMarks=markProxy(c.marks,e),pendingLongitudinal=[],longM={flatQuad(...q){pendingLongitudinal.push(q);}};
        let longStart=-Infinity,longEnd=Infinity;
        const reserveControl=(end,sa,sb)=>{if(end===e.a)longStart=Math.max(longStart,sa,sb);else longEnd=Math.min(longEnd,sa,sb);};
        if (s1 - s0 > 1 && !e.unpaved && e.type !== 'service') {
            const m = sourceMarks, hw = 0.07;
            const minor = e.type === 'residential' || e.type === 'living_street' || e.type === 'unclassified' || e.type === 'service';
            const med2 = e.median / 2, shift = e.laneCenterShiftM || 0;
            // a one-way carriageway built wider than its lane count is marked evenly over its real width (see the dividers)
            const Wc = e.wL + e.wR, nEff = e.oneway ? Math.round(Wc / e.laneW) : 0, evenLanes = e.oneway && nEff > e.lanesF && Wc - e.lanesF * e.laneW > e.laneW * 0.7;
            // bus lanes (outermost lane each way)
            if (e.busLane && !isMotorwayTrunk(e.type)) {
                { // (2026-11-08, Street View walk of Calea Floreasca) plain asphalt behind a wide solid line, not red paint (red only on the boulevards that have it)
                    const wl = rgb('#ecebe6');
                    if (evenLanes) { const o = -e.wL + Wc * (nEff - 1) / nEff; band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); } // (on the last divider of the evenly marked lanes)
                    else if (e.lanesF > 1) { const o = shift + med2 + e.laneW * (e.lanesF - 1); band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                    if (e.lanesB > 1) { const o = shift - (med2 + e.laneW * (e.lanesB - 1)); band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                }
            }
            // surface texture: transverse joints on concrete motorways (US, ~4.6 m panels); patched asphalt (repair
            // patches: Bucharest many, darker / lighter rectangles; Seattle a few dark sealed ones)
            if (isConcrete(e)) {
                const jc = shadeRgb(concreteCol, 0.72);
                for (let s = s0 + 2.3; s < s1 - 0.5; s += 4.6) band(m, e, s - 0.03, s + 0.03, -e.wL + 0.05, e.wR - 0.05, yM - 0.008, jc);
            } else if (!e.tunnel && e.len > 8) {
                const pr = makeRng(e.id * 7919 + 101), per = US ? 90 : minor ? 22 : 34;
                const n = Math.floor((s1 - s0) / per + pr());
                for (let q = 0; q < n; q++) {
                    const L = pr.range(1.2, US ? 4 : 7), sa = pr.range(s0 + 0.5, Math.max(s0 + 0.6, s1 - L - 0.5));
                    const wR2 = e.wR - 0.3, wL2 = -(e.wL - 0.3); if (wR2 - wL2 < 2) break;
                    const W = Math.min(wR2 - wL2, pr.range(0.9, e.laneW * 1.1)), o = pr.range(wL2, wR2 - W);
                    const pc = shadeRgb(asphaltBase, US ? 0.72 : pr.chance(0.6) ? 0.74 : 1.12);
                    band(m, e, sa, sa + L, o, o + W, yM - 0.0095 + Math.min(q, 9) * 0.0007 + (e.id % 3) * 0.0002, pc); // (owner register #3, Floreasca: overlapping patches at one height flickered: each its own height, all below the lines)
                }
            }
            // lane dividers
            // (2026-11-08, owner: "some roads still don't have proper lines", Calea Floreasca by PAUL) a one-way carriageway
            // built wider than its lane count (lanes tag < the real width) left a whole unmarked lane: mark the lanes evenly
            // over the real width instead
            if (evenLanes) {
                for (let i = 1; i < nEff; i++) if (!(e.busLane && i === nEff - 1)) dashLine(longM, e, s0, s1, -e.wL + Wc * i / nEff, yM, white, dash[0], dash[1], hw);
            } else if (!minor || e.lanesF > 1 || e.lanesB > 1) {
                for (let i = 1; i < e.lanesF; i++) dashLine(longM, e, s0, s1, shift + med2 + e.laneW * i, yM, white, dash[0], dash[1], hw * (/motorway/.test(e.type) ? 1.4 : 1));
                for (let i = 1; i < e.lanesB; i++) dashLine(longM, e, s0, s1, shift - (med2 + e.laneW * i), yM, white, dash[0], dash[1], hw);
            }
            // centre
            if (!e.oneway && !e.sharedLane) {
                const cc = US ? yellow : white;
                if (e.median > 0.5) {
                    // median: tram bed or concrete divider
                    band(longM, e, s0, s1, shift - med2 + 0.15, shift + med2 - 0.15, yM - 0.006, e.tramMedian ? ballastCol : rgb('#8d8a84'));
                    solidLine(longM, e, s0, s1, shift + med2, yM, cc, hw); solidLine(longM, e, s0, s1, shift - med2, yM, cc, hw);
                } else if (US && !minor) { solidLine(longM, e, s0, s1, shift + (0.13), yM, cc, 0.06); solidLine(longM, e, s0, s1, shift + (-0.13), yM, cc, 0.06); }
                else if (!US && !minor) {
                    if (e.lanesF + e.lanesB >= 4) { solidLine(longM, e, s0, s1, shift + (0.12), yM, cc, 0.06); solidLine(longM, e, s0, s1, shift + (-0.12), yM, cc, 0.06); }
                    else if (e.lanesF + e.lanesB >= 3) solidLine(longM, e, s0, s1, shift + (0), yM, cc, hw);
                    else dashLine(longM, e, s0, s1, shift + (0), yM, cc, dash[0], dash[1], hw);
                }
            }
            // edge lines
            // (owner, 2026-11-12, Grozavesti (423, -745) "lines look wrong", (898, -1136) "lines seem odd") where a ramp merges
            // with a carriageway at one level, the ramp's edge line ran on across the other road's lanes (a few millimetres
            // higher, so the paint priority kept it). An edge line inside another carriageway at its level marks nothing: it is
            // laid in 1 m pieces and a piece whose middle lies inside another level carriageway is left out.
            if (!minor) {
                const edgeM = { flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, ...rest) { const cx = (x0 + x1 + x2 + x3) / 4, cz = (z0 + z1 + z2 + z3) / 4; if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), .3, false, .15)) return; longM.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, ...rest); } };
                if (s1 - s0 > .2) {
                    if (e.taperR) { const n = Math.max(1, Math.ceil(s1 - s0)); for (let i = 0; i < n; i++) { const sa = s0 + (s1 - s0) * i / n, sb = s0 + (s1 - s0) * (i + 1) / n, oa = e.wR - 0.15 + sideExtra(e, 1, sa), ob = e.wR - 0.15 + sideExtra(e, 1, sb), P = (q, o) => [e.a.x + e.dirx * q + e.nx * o, e.a.z + e.dirz * q + e.nz * o], A = P(sa, oa - 0.08), B = P(sb, ob - 0.08), C = P(sb, ob + 0.08), D = P(sa, oa + 0.08); edgeM.flatQuad(A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1], yM, white, 0); } } // (a lane-drop taper: the line closes in with the kerb)
                    else dashLine(edgeM, e, s0, s1, e.wR - 0.15, yM, white, Math.min(1, s1 - s0), 0, 0.08);
                    // (owner, 2026-11-13: "lanes are drawn badly on both seattle and bellevue") US: the left edge line of every one-way
                    // roadway is yellow (MUTCD 3B.06: divided highways, one-way roadways and ramps), not only on motorways / trunks;
                    // International Blvd's and NE 8th St's carriageways had a white line along their median side
                    dashLine(edgeM, e, s0, s1, -(e.wL - 0.15), yM, (US && e.oneway) ? yellow : white, Math.min(1, s1 - s0), 0, 0.08);
                }
            }
            // stop lines at lights / stop signs
            for (const end of [e.a, e.b]) {
                if (!(end.hasLight || end.stop || end.giveWay) || end.edges.length < 2) continue;
                const atA = end === e.a;
                const incoming = atA ? !e.oneway : true;
                if (!incoming) continue;
                const r = retract(e, end) + 0.8;
                const s = atA ? r : e.len - r;
                reserveControl(end,s-.25,s+.25);
                const wIn = atA ? -e.wL : e.wR;
                const o0 = shift + (atA ? -Math.max(0, med2) : (e.oneway ? med2 : Math.max(0, med2)));
                if (end.giveWay && !end.hasLight) { for (let k = 0; k < 6; k++) { const oo = o0 + (wIn - o0) * (k + 0.5) / 6; band(m, e, s - 0.25, s + 0.25, oo - 0.25, oo + 0.25, yM + 0.002, white); } }
                else band(m, e, s - 0.25, s + 0.25, o0, wIn, yM + 0.002, white);
            }
            // zebra crossings at signalised junctions (in front of the stop line) and at marked crossings
            for (const end of [e.a, e.b]) {
                const atA = end === e.a;
                if (end.hasLight && end.edges.length >= 3) {
                    const r = retract(e, end) + 2.0;
                    // skewed approaches: a crossing that would overlap another approach's crossing steps back (≤ 3 m) or is left out
                    let sc = null;
                    for (const back of [0, 1.5, 3]) {
                        const s2 = atA ? r + 1.3 + back : e.len - r - 1.3 - back;
                        if (s2 < 1 || s2 > e.len - 1) break;
                        const P = (s, o) => [e.a.x + e.dirx * s + e.nx * o, e.a.z + e.dirz * s + e.nz * o];
                        const rect = [P(s2 - 1.5, -e.wL), P(s2 + 1.5, -e.wL), P(s2 + 1.5, e.wR), P(s2 - 1.5, e.wR)];
                        if (zebraRects.some(z => z.e !== e && convexOverlap(z.rect, rect))) continue;
                        zebraRects.push({ e, rect }); sc = s2; break;
                    }
                    if (sc === null) continue;
                    reserveControl(end,sc-1.5,sc+1.5);
                    for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(m, e, sc - 1.4, sc + 1.4, k, k + 0.5, yM + 0.004, white);
                }
            }
        }
        // zebra at degree-2 crossing nodes (drawn once by the edge leaving the node)
        if (e.a.zebra && e.a.edges.length === 2 && e.a.edges[0] === e && !e.unpaved) { // (on this edge's own ribbon: markings are clipped to it)
            const z0 = e.len > 4 ? 0.1 : -1.4, z1 = e.len > 4 ? 2.9 : 1.4;
            reserveControl(e.a,z0,z1);
            for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(sourceMarks, e, z0, z1, k, k + 0.5, yM + 0.004, white);
        }
        // Preserve the actual stop/zebra envelope, including its chosen setback.
        // The source-connected dash phase must never run through these controls.
        for(const q of pendingLongitudinal){
            let polygon=[[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]];
            const station=p=>(p[0]-e.a.x)*e.dirx+(p[1]-e.a.z)*e.dirz;
            if(Number.isFinite(longStart))polygon=clipMarkingHalfPlane(polygon,p=>station(p)-longStart);
            if(Number.isFinite(longEnd))polygon=clipMarkingHalfPlane(polygon,p=>longEnd-station(p));
            if(polygon.length)sourceMarks.flatPolygon(polygon,q[8],q[9],q[10]);
        }
        // bridges: railings
        // (a parapet piece is "soft"-dropped where it stands over another carriageway at its level or at street level)
        const guardSoft = (f, A, B) => { const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2; return coveredByOther(mx, mz, f, yAlong(f, mx, mz), 0.1, false, 0.3) || (!f.overWater && Math.max(yAlong(f, ...A), yAlong(f, ...B)) < 0.6); };
        // the same road continuing through a node: its 3 m parapet pieces nearest the node on the matching side, keep flags
        const guardNeighbour = (n, s0) => {
            const f = (n.allEdges || n.edges || []).find(q => q !== e && q.bridge && q.road === e.road && !q.virtual && !basarabEdge(data, q)); if (!f) return [];
            const sameDir = (f.dirx * e.dirx + f.dirz * e.dirz) > 0, sf = sameDir ? s0 : -s0;
            const qa = corner(f, f.a, sf, widthAsphalt(f, sf) + 0.3, widthAsphalt), qb = corner(f, f.b, sf, widthAsphalt(f, sf) + 0.3, widthAsphalt);
            const L2 = Math.hypot(qb[0] - qa[0], qb[1] - qa[1]), k2 = Math.max(1, Math.ceil(L2 / 3)), at = j => [qa[0] + (qb[0] - qa[0]) * j / k2, qa[1] + (qb[1] - qa[1]) * j / k2];
            const nearA = f.a === n, out = [];
            for (let i = 0; i < Math.min(4, k2); i++) { const j = nearA ? i : k2 - 1 - i; out.push(!guardSoft(f, at(j), at(j + 1))); }
            return out; // nearest the node first
        };
        if (false && e.bridge && !basarabEdge(data,e)) { // (2026-11-11, L45: drawn from the final collision rails instead, below)
            const sb = bridgeGuard || c.solid;
            for (const s of [1, -1]) {
                const pa = corner(e, e.a, s, widthAsphalt(e, s) + 0.3, widthAsphalt), pb = corner(e, e.b, s, widthAsphalt(e, s) + 0.3, widthAsphalt);
                // in ~3 m pieces; a piece standing on another deck / carriageway at this level (two ways mapped side by
                // side on one viaduct, a merging ramp) is left out — no parapet fins across a deck (upb route, Basarab)
                const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), k = Math.max(1, Math.ceil(L / 3)), piece = [];
                for (let j = 0; j < k; j++) {
                    const A = [pa[0] + (pb[0] - pa[0]) * j / k, pa[1] + (pb[1] - pa[1]) * j / k], B = [pa[0] + (pb[0] - pa[0]) * (j + 1) / k, pa[1] + (pb[1] - pa[1]) * (j + 1) / k];
                    const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
                    // (owner, 2026-11-11, Grozavesti (-28, 59)) no parapet on a stretch at street level; bridges over water keep theirs
                    const soft = guardSoft(e, A, B);
                    const hard = tramGrades.excludesInferredObstacle(A, B, { inferred: true, y0a: Y.road + yAlong(e, ...A), y1a: Y.road + yAlong(e, ...A) + 1.1,
                        y0b: Y.road + yAlong(e, ...B), y1b: Y.road + yAlong(e, ...B) + 1.1, kind: 'bridge-guard-visual', sourceId: data.roadSourceGeometry?.[e.road]?.sourceId });
                    piece.push({ A, B, keep: !soft && !hard, hard });
                }
                // (owner, 2026-11-11, Grozavesti (286, -776): "still broken") each piece used to be decided on its own, so a
                // low ramp beside a parallel road (Exit to Giulesti) got a barrier in chunks with gaps. One continuous run per
                // side: gaps of up to four pieces (12 m) between kept pieces are filled (never across the tram sweep), lone pieces dropped.
                // (owner, 2026-11-11, L45: the median barrier still broke where its gap spanned two edges) the run looks four
                // pieces into the same road's neighbouring edges, so a gap across an edge boundary is filled too
                const before = guardNeighbour(e.a, s).reverse().map(keep => ({ keep, hard: false, ghost: true })), after = guardNeighbour(e.b, s).map(keep => ({ keep, hard: false, ghost: true }));
                const run = [...before, ...piece, ...after], off = before.length, K = run.length;
                for (let j = 0; j < K; j++) if (!run[j].keep && !run[j].hard) {
                    let a = j - 1; while (a >= 0 && !run[a].keep && j - a <= 4) a--;
                    let b = j + 1; while (b < K && !run[b].keep && b - j <= 4) b++;
                    if (a >= 0 && b < K && run[a].keep && run[b].keep && b - a - 1 <= 4 && run.slice(a + 1, b).every(q => !q.hard)) for (let q = a + 1; q < b; q++) run[q].fill = true;
                }
                void off;
                for (let j = 0; j < k; j++) if (piece[j].fill) piece[j].keep = true;
                for (let j = off; j < off + k; j++) if (run[j].keep && !(run[j - 1]?.keep) && !(run[j + 1]?.keep) && K > 2) run[j].keep = false;
                for (const { A, B, keep } of piece) {
                    if (!keep) continue;
                    sb.wall(A[0], A[1], B[0], B[1], yR, yR + 1.1, e.nx * s, e.nz * s, rgb('#9aa3ad'));
                    sb.wall(A[0], A[1], B[0], B[1], yR, yR + 1.1, -e.nx * s, -e.nz * s, rgb('#8a939d'));
                    sb.flatQuad(A[0], A[1], B[0], B[1], B[0] + e.nx * s * 0.3, B[1] + e.nz * s * 0.3, A[0] + e.nx * s * 0.3, A[1] + e.nz * s * 0.3, yR + 1.1, rgb('#b0b8c0'), 0, -1);
                }
            }
        }
        // Ground-road guards are emitted from their final cut collision segments below.
        // street furniture spots (lamps on the outer edge of the sidewalk, trees in pits on wide sidewalks)
        const big = /^(trunk|primary|secondary)$/.test(e.type) && !e.tunnel;
        const treeStreet = city.treeStreets && city.treeStreets.test(e.name);
        // (2026-11-08) Bucharest district worlds: residential streets are lit too (concrete poles with a bracket lamp, one
        // side, ≈ 32 m) — OSM maps neither the lamps nor lit=yes on most of Floreasca's streets
        const resLamp = !US && /^(residential|unclassified|living_street)$/.test(e.type);
        const lampRoad = !e.tunnel && !e.unlit && (e.lit || big || (/tertiary/.test(e.type) && !US) || resLamp);
        if (e.len > 12) {
            const ra = retract(e, e.a) + 5, rb = e.len - retract(e, e.b) - 5;
            if (lampRoad && (!/motorway/.test(e.type) || e.lit)) {
                const step = big ? 34 : resLamp ? 32 : 28, hh = big || isMotorwayTrunk(e.type) ? 8 : 6;
                for (let s = ra + ((e.id * 7) % step); s < rb; s += step) {
                    for (const sd of (resLamp ? [((e.road * 7) % 2) ? 1 : -1] : e.oneway && e.lanesF <= 1 ? [1] : [1, -1])) {
                        if (e.sidewalkSource.explicit && sidewalkWidth(e, sd) <= .3 && !e.bridge) continue;
                        const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e);
                        const yl = yAlong(e,e.a.x+e.dirx*s,e.a.z+e.dirz*s);
                        const sw = sidewalkWidth(e, sd), o = e.bridge || Math.abs(yl) > 0.3 ? w + 0.35 : sw >= 1.2 ? w + Math.max(0.55, sw - 0.45) : w + 1.0; // (on ramps / in trenches: on the deck edge, inside the walls)
                        lampSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, Math.atan2(e.nz * sd, -e.nx * sd), yAlong(e,e.a.x+e.dirx*s+e.nx*o*sd,e.a.z+e.dirz*s+e.nz*o*sd), hh, e, sd]);
                    }
                }
            }
            // procedural street-tree rows where OSM maps few trees (tree coverage is very uneven between districts):
            // research notes first, then the city's known tree-lined streets, then defaults by road class: Bucharest
            // boulevards and residential / tertiary streets with ≥ 3 m sidewalks, Seattle / Bellevue downtown tree pits.
            // Rows keep clear of junction sight lines (12 m from the pad); the OSM trees nearby win (placeTree dedups).
            const rt = researchTrees.get(e.name);
            const dtUS = US && (e.sidewalk >= 2.5) && /^(primary|secondary|tertiary|residential)$/.test(e.type);
            const roRes = !US && /^(tertiary|residential|unclassified)$/.test(e.type) && e.sidewalk >= 3 && (((e.road * 2654435761) >>> 0) % 100) < 60;
            const rowOK = !e.bridge && !elevated && e.sidewalk >= 2.2 && !rt?.none && (rt || treeStreet || (big && e.sidewalk >= 3 && !US) || roRes || dtUS);
            if (rowOK) {
                const step = rt || treeStreet ? rng.range(7, 9) : roRes ? rng.range(8, 11) : dtUS ? 9 : 10;
                const sp = rt?.species?.length ? rt.species[((e.road * 40503) >>> 0) % rt.species.length] : null;
                const s0 = retract(e, e.a) + 12, s1 = e.len - retract(e, e.b) - 12;
                for (let s = s0 + 2; s < s1; s += step * rng.range(0.9, 1.1)) for (const sd of [1, -1]) {
                    const scale = rng.range(0.8, 1.2); // preserve the shared RNG stream even when a source side is absent
                    if (sidewalkWidth(e, sd) < 2.2) continue;
                    const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + clamp(sidewalkWidth(e, sd) * 0.45, 1.0, 2.2);
                    treeSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, scale, 'street', e.road, sp]);
                }
            }
        }
        // painted bike lanes (on the carriageway, outermost 1.5 m) and cycle tracks (on the sidewalk)
        if ((e.bikeLane || e.cycleTrack) && !e.tunnel && e.len > 4) {
            const s0b = retract(e, e.a), s1b = e.len - retract(e, e.b);
            const bc = rgb(US ? '#3f7f52' : '#9e4a3e');
            for (const sd of (e.oneway ? [1] : [1, -1])) {
                const w = sd > 0 ? e.wR : e.wL;
                if (e.bikeLane && w > 4.5) band(c.marks, e, s0b, s1b, sd * (w - 1.6), sd * (w - 0.2), yM - 0.003, bc);
                else if (e.cycleTrack && sidewalkWidth(e, sd) >= 2.2) { const o = w + shoulderOf(e), sw = sidewalkWidth(e, sd); band(c.marks, e, s0b, s1b, sd * (o + sw - 1.7), sd * (o + sw - 0.3), raisedEdge(e, sd) ? Y.road + Y.kerb + 0.006 : yS + 0.01, shadeRgb(bc, 1.1)); }
            }
        }
        if (elevated) { const f = (x, z) => yAlong(e, x, z);
            // the sidewalk rides with the ramp; on an embankment ramp the verge beyond it stays on the ground, under the skirt
            const wPos = widthSide(e, 1), wNeg = widthSide(e, -1); // (the edge does not change while it is displaced)
            const fg = e.bridge || e.tunnel ? f : (x, z) => { const lat = (x - e.a.x) * e.nx + (z - e.a.z) * e.nz; return Math.abs(lat) <= (lat >= 0 ? wPos : wNeg) + 0.05 ? f(x, z) : Math.min(0, f(x, z)); };
            // (a rule that jumps at the band edge cannot be met by adaptive subdivision: cut on the line instead, bridge-surface-band.js)
            if (!(e.bridge || e.tunnel) && e.sourceBridgeGrade?.known) displaceBandedSurface(c.ground, v0g, i0g, { ax: e.a.x, az: e.a.z, nx: e.nx, nz: e.nz, limit: sd => (sd > 0 ? wPos : wNeg) + 0.05, inside: f, outside: (x, z) => Math.min(0, f(x, z)) }, sharedBridgeMeshAudit, { edgeId: e.id, sourceId: e.access?.sourceId || e.sourceId });
            else displace(c.ground, v0g, fg, e, i0g, { verge: e.bridge || e.tunnel ? null : { ax: e.a.x, az: e.a.z, nx: e.nx, nz: e.nz, wPos, wNeg } });
            // (owner, 2026-11-11, Grozavesti (68.5, 203): "looks odd", "not smooth", "let's simulate real life") the verge of a
            // raised ramp ended in a stepped cliff above the grass (each segment's strip ends square-on). Street-level reference
            // (game/research/bucharest-grozavesti.md, Pasajul Basarab): the Basarab and Pasajul ramps stand on vertical concrete
            // retaining walls beside the streets. Each side of an embankment ramp (not a bridge) is one continuous wall from the
            // mitred sidewalk edge straight down to the ground (a 2 % batter), weathered concrete with the ground's texture.
            if ((!e.bridge || retainedDeck(e)) && !e.tunnel && Math.max(e.ya, e.yb) > 0.25) for (const sd of [1, -1]) {
                const W0 = widthSide(e, sd), ca = corner(e, e.a, sd, W0, widthSide), cb = corner(e, e.b, sd, W0, widthSide), L = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]), k = Math.max(1, Math.ceil(L / 2.5));
                const ol = Math.hypot(ca[0] - e.a.x, ca[1] - e.a.z) || 1, ox = (ca[0] - e.a.x) / ol, oz = (ca[1] - e.a.z) / ol, wallCol = rgb('#8f8c86'), uvOf = p => [(p[0] + p[2]) * 0.125, p[1] * 0.125];
                // a road crossing beneath a retained deck (not one running beside it): the wall stays open, the deck spans it
                const under = (x, z, h) => { let hit = false; edgeGrid.each(x - 1, z - 1, x + 1, z + 1, f => { if (hit || f === e || f.virtual || f.road === e.road || Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) > .8) return; const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0 || q.t >= 1 || q.d > Math.max(f.wL, f.wR) + f.sidewalk + .6) return; if (yAlong(f, x, z) < h - 2.4) hit = true; }); return hit; };
                const row = t => { const x = ca[0] + (cb[0] - ca[0]) * t, z = ca[1] + (cb[1] - ca[1]) * t, h = Math.max(0, yAlong(e, x, z)), reach = h * 0.02;
                    if (e.bridge && under(x - ox * .8, z - oz * .8, h)) return { top: [x, Y.side + h, z], bottom: [x, Y.side + h, z], h: 0 };
                    return { top: [x, Y.side + h, z], bottom: [x + ox * reach, Math.min(Y.side, 0.02), z + oz * reach], h }; };
                let prev = row(0);
                for (let j = 1; j <= k; j++) { const cur = row(j / k);
                    if (prev.h > 0.05 || cur.h > 0.05) { const cs = cellOf((prev.top[0] + cur.top[0]) / 2, (prev.top[2] + cur.top[2]) / 2).ground; // (the ground's own grass texture and light)
                        const q1 = [prev.top, cur.top, cur.bottom, prev.bottom], q2 = [prev.bottom, cur.bottom, cur.top, prev.top];
                        cs.face4(...q1, wallCol, [ox, 0, oz], -1, q1.map(uvOf)); cs.face4(...q2, wallCol, [-ox, 0, -oz], -1, q2.map(uvOf)); }
                    prev = cur; }
            }
            // abutment: a retained ramp meeting the open viaduct of its own road closes the space under the deck
            if (retainedDeck(e)) for (const end of [e.a, e.b]) {
                if (!(end.y > 1) || !(end.allEdges || end.edges || []).some(q => q !== e && !q.virtual && q.bridge && q.road === e.road && !retainedDeck(q) && Math.max(q.ya, q.yb) > RETAIN_H)) continue;
                const pl = corner(e, end, 1, widthSide(e, 1), widthSide), pr = corner(e, end, -1, widthSide(e, -1), widthSide), h = end.y, cs = cellOf(end.x, end.z).ground, wallCol = rgb('#8f8c86');
                const q1 = [[pl[0], Y.side + h, pl[1]], [pr[0], Y.side + h, pr[1]], [pr[0], .02, pr[1]], [pl[0], .02, pl[1]]], uv = q1.map(p => [(p[0] + p[2]) * .125, p[1] * .125]);
                cs.face4(...q1, wallCol, [e.dirx, 0, e.dirz], -1, uv); cs.face4(...q1.slice().reverse(), wallCol, [-e.dirx, 0, -e.dirz], -1, uv.slice().reverse());
            }
            displace(c.road, v0p, f, e, i0p); displace(c.marks, v0m, f, e, i0m, {}); displace(c.solid, v0s, f, e, i0s, {}); } // (the road here: it is read before the Basarab structure, and light)
        railRoadside.apply(c.ground, i0g, e); railRoadside.apply(c.road, i0p, e); railRoadside.apply(c.solid, i0s, e);
        if(bridgeGuard){
            if(elevated)displace(bridgeGuard,0,(x,z)=>yAlong(e,x,z),e,0);
            railRoadside.apply(bridgeGuard,0,e);
            parapetOwnership.addBuilderCaps(bridgeGuard,{heightM:1.1,owner:{emitter:'bridge-parapet',inferred:true,sourceId:bridgeGuardSourceId,edgeId:e.id}});
            c.solid.append(bridgeGuard); // same cell/material batch, unchanged earlier guard geometry
        }
    }
    // ---- turn arrows (OSM turn:lanes) painted in each lane 9 m before the junction a way ends at (R11.3)
    {
        const tl = data.turnLanes || [];
        const arrow = (mb, e, s, lat, dirSign, kinds, y) => {
            // local frame: forward f (travel), right r; arrow 4.5 m long, ending at s (travel direction dirSign)
            const fx = e.dirx * dirSign, fz = e.dirz * dirSign, rx = -fz, rz = fx; // (n of the travel direction: right-hand)
            const bx0 = e.a.x + e.dirx * s + e.nx * lat, bz0 = e.a.z + e.dirz * s + e.nz * lat; // arrow tip end
            const P2 = (a, b) => [bx0 + fx * a + rx * b, bz0 + fz * a + rz * b]; // a along travel (≤ 0 behind the tip), b to the right
            const quad = (p, q, r2, t) => mb.flatQuad(p[0], p[1], q[0], q[1], r2[0], r2[1], t[0], t[1], y, white, 0);
            const thr = kinds.includes('through'), lft = kinds.includes('left') || kinds.includes('slight_left'), rgt = kinds.includes('right') || kinds.includes('slight_right');
            quad(P2(-4.5, -0.08), P2(thr ? -1.1 : -2.0, -0.08), P2(thr ? -1.1 : -2.0, 0.08), P2(-4.5, 0.08)); // stem
            if (thr) quad(P2(-1.3, -0.38), P2(0, 0), P2(0, 0), P2(-1.3, 0.38));
            for (const sd of [lft ? -1 : 0, rgt ? 1 : 0]) {
                if (!sd) continue;
                quad(P2(-2.15, 0), P2(-1.95, 0), P2(-1.95, sd * 0.85), P2(-2.15, sd * 0.85)); // arm
                quad(P2(-2.55, sd * 0.85), P2(-2.05, sd * 1.4), P2(-2.05, sd * 1.4), P2(-1.55, sd * 0.85)); // head
            }
        };
        // a merge arrow in the lane that ends, 10 m and 30 m before the lane line stops (Street View at 44.44100, 26.06002: one large arrow)
        for (const t of laneTapers) {
            const e = t.from, lane = e.lanesF - 1;
            for (const want of [10, 30]) {
                let g = e, d = want; // walk back along the same road while the edge is too short
                for (let k = 0; k < 4 && d > g.len - 2; k++) { const prev = g.a.edges.filter(h => !h.virtual && h.b === g.a && h.road === g.road && h.lanesF === g.lanesF); if (prev.length !== 1) { g = null; break; } d -= g.len; g = prev[0]; }
                if (!g || d > g.len - 2 || d < 0) continue;
                const s = g.len - d, lat = (g.laneCenterShiftM || 0) + g.median / 2 + g.laneW * (lane + 0.5), c = cellOf(g.a.x + g.dirx * s, g.a.z + g.dirz * s), mb = markProxy(c.marks, g), v0 = c.marks.vc, y = Y.road + Y.mark + 0.003;
                const P2 = (a, b) => [g.a.x + g.dirx * (s + a) + g.nx * (lat + b), g.a.z + g.dirz * (s + a) + g.nz * (lat + b)], quad = (p, q, r2, u) => mb.flatQuad(p[0], p[1], q[0], q[1], r2[0], r2[1], u[0], u[1], y, white, 0);
                // (a along travel, b to the right) the stem slants toward the lane that goes on, on the left
                const A = [-4.6, 0.75], B = [-1.5, -0.35], L = Math.hypot(B[0] - A[0], B[1] - A[1]), dx = (B[0] - A[0]) / L, dz = (B[1] - A[1]) / L, px = -dz, pz = dx, T = [B[0] + dx * 1.5, B[1] + dz * 1.5];
                quad(P2(A[0] + px * .09, A[1] + pz * .09), P2(B[0] + px * .09, B[1] + pz * .09), P2(B[0] - px * .09, B[1] - pz * .09), P2(A[0] - px * .09, A[1] - pz * .09));
                quad(P2(B[0] + px * .42, B[1] + pz * .42), P2(T[0], T[1]), P2(T[0], T[1]), P2(B[0] - px * .42, B[1] - pz * .42));
                if (Math.abs(g.ya) > 0.01 || Math.abs(g.yb) > 0.01) displace(c.marks, v0, (x, z) => yAlong(g, x, z), g);
            }
        }
        const roadEdges = new Map(); for (const e of edges) if (!e.virtual) { let l = roadEdges.get(e.road); if (!l) roadEdges.set(e.road, l = []); l.push(e); }
        for (let i = 0; i + 2 < tl.length; i += 3) {
            const ri = tl[i], fw = str(tl[i + 1]).split('|'), bw = str(tl[i + 2]).split('|'), rd = roads[ri], es = roadEdges.get(ri); if (!rd || !es) continue;
            const last = nodeArr[rd.ids[rd.ids.length - 1]], first = nodeArr[rd.ids[0]];
            for (const [end, lanes, fwd] of [[last, fw, true], [first, bw, false]]) {
                if (!lanes.some(l => /left|right/.test(l)) || end.mapEnd || (end.allEdges || end.edges).length < 3) continue;
                const e = es.find(f => f.b === end || f.a === end); if (!e || e.type === 'service' || e.sharedLane) continue;
                const dirSign = e.b === end ? 1 : -1; // travel toward `end`
                const n = dirSign > 0 ? e.lanesF : e.lanesB; if (!n || lanes.length !== n) continue;
                const sStop = dirSign > 0 ? e.len - retract(e, e.b) - 9 : retract(e, e.a) + 9; if (sStop < 6 || sStop > e.len - 6) continue;
                const c = cellOf(e.a.x + e.dirx * sStop, e.a.z + e.dirz * sStop), mb = markProxy(c.marks, e), v0 = c.marks.vc;
                const med2 = e.median / 2;
                lanes.forEach((k, j) => { // j = 0 is the leftmost lane in the travel direction
                    const lat = (e.laneCenterShiftM || 0) + (dirSign > 0 ? med2 + e.laneW * (j + 0.5) : -(Math.max(0, med2) + e.laneW * (j + 0.5)));
                    if (k && k !== 'none') arrow(mb, e, sStop, lat, dirSign, k.split(';'), Y.road + Y.mark + 0.003);
                });
                if (Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01) displace(c.marks, v0, (x, z) => yAlong(e, x, z), e);
            }
        }
    }
    return {
        DY_SIDE,
        SIDE_BACK,
        cornerGrid,
        cornerPolys,
        cornerSkips,
        parapetOwnership,
        sideJoins,
        get raisedPieces() { return raisedPieces; }, set raisedPieces(v) { raisedPieces = v; },
    };
}
