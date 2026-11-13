// ============================================================================
//  BRIDGE STRUCTURES — the Basarab overpass structure (deck, piers, bents) and the bridge bents of the other raised decks
//  (moved out of world-facades-guards.js' buildFacadesGuards, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { clamp, pointInPolygon } from './util.js';
import { rgb } from './geobuild.js';
import { BENT_MODEL, planBridgeBents } from './bridge-bents.js';
import { bridgeBeam, buildBasarabStructure } from './basarab-structure.js';
import { raisedRoadTriangles } from './basarab-anchor-clearance.js';
import { BoxGrid, Y, undelta } from './world-shared.js';

export function buildBridgeStructures(ctx) {
    const {
        ASPHALT, asphaltCorners, buildingAt, cellOf, cells, city, coveredByOther, data,
        distId, edgeGrid, edges, group, isWater, onRibbon, pierColl, propColl,
        raised, raisedDeck, retainedDeck, sceneryDeckGrid, surfacesAt, tramDecks, tramGrades, tramPropEnvelope,
        tramSweep, tramSweepConflicts, trams, widthAsphalt, widthSide, yAlong,
    } = ctx;
    // -----------------------------------------------------------------------
    //  BRIDGE BENTS (MODEL estimate; bridge-bents.js): one crosshead carries every parallel deck of a structure
    //  (both carriageways and the tram viaduct between them). Columns stand only on free ground: never on a lower
    //  carriageway, sidewalk, rail, water or building; a bent that cannot stand, or whose crosshead would foul the
    //  clearance of what passes below, is left out, so long spans keep their real long-span structure.
    // -----------------------------------------------------------------------
    let bridgeBents = { bents: [], report: null, chains: [] }, basarabStructure = { report: { active: false, sourcePlatforms: [] }, pieces: [], colliders: [] };
    {
        const basarabDistrict = city.id === 'bucharest' && distId === 'grozavesti';
        const deferredRailSlots = []; let emitSlot = null; // the slot between the two tram slabs, decided once the centre support exists
        const deckEdges = raised.filter(e => e.bridge && !e.virtual && Math.max(e.ya, e.yb) > 0.3 && !retainedDeck(e)); // (retained ramps stand on their walls)
        // elevated rail slabs join the same plan as pseudo-edges (their own half width and exact rendered band)
        const railNodes = new Map(), railNode = p => { const k = Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100); let n = railNodes.get(k); if (!n) railNodes.set(k, n = { x: p[0], z: p[1] }); return n; };
        const railEdgeGrid = new BoxGrid(32), railEdges = [];
        for (const d of tramDecks) {
            if (d.kind !== 'source-tram-deck' || !d.supportA || !(d.y1 > 1.2)) continue;
            const [ax, az] = d.supportA, [bx, bz] = d.supportB, len = Math.hypot(bx - ax, bz - az); if (len < .05) continue;
            const dirx = (bx - ax) / len, dirz = (bz - az) / len, half = Math.abs((d.poly[0][0] - ax) * -dirz + (d.poly[0][1] - az) * dirx);
            const e = { a: railNode(d.supportA), b: railNode(d.supportB), dirx, dirz, len, nx: -dirz, nz: dirx, railDeck: d, half };
            railEdges.push(e); railEdgeGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), e);
        }
        // rails that a column / crosshead must keep clear of: tram tracks (at their own level) and heavy rail at grade
        const railGrid = new BoxGrid(32), railSeg = (ax, az, bx, bz, y) => railGrid.insert(Math.min(ax, bx) - 4, Math.min(az, bz) - 4, Math.max(ax, bx) + 4, Math.max(az, bz) + 4, { ax, az, bx, bz, y });
        const railDeckTop = (x, z) => { let y = 0; sceneryDeckGrid.each(x, z, x, z, d => { if (d.kind === 'source-tram-deck' && pointInPolygon(x, z, d.poly)) y = Math.max(y, d.y1); }); return y; };
        for (const pl of trams) for (let i = 0; i < pl.length - 1; i++) { const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; railSeg(ax, az, bx, bz, railDeckTop((ax + bx) / 2, (az + bz) / 2)); }
        for (const r of data.railways || []) { const t = r.tags || {}; if (t.railway === 'abandoned' || (t.tunnel && t.tunnel !== 'no')) continue; const pts = undelta(r.points, 0); for (let i = 1; i < pts.length; i++) railSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0); }
        const railNear = (x, z, reach, belowY) => { let found = null; railGrid.each(x, z, x, z, s => { if (found || s.y >= belowY) return; const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1, t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1); if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < reach) found = s; }); return found; };
        const lowerEdge = (x, z, margin, belowY, sidewalks) => { let found = null; edgeGrid.each(x - 14, z - 14, x + 14, z + 14, f => {
            if (found || f.virtual || f.lidded || Math.max(f.ya, f.yb) >= belowY) return;
            const s = (x - f.a.x) * f.dirx + (z - f.a.z) * f.dirz; if (s < -margin || s > f.len + margin) return;
            const lat = (x - f.a.x) * f.nx + (z - f.a.z) * f.nz, side = lat >= 0 ? 1 : -1;
            if (Math.abs(lat) < (sidewalks ? widthSide(f, side) : side > 0 ? f.wR : f.wL) + margin) found = f; }); return found; };
        const lowerRibbon = (x, z, r, belowY) => onRibbon(x, z, r, rb => rb.y < belowY);
        const ring = (x, z, r) => [[x, z], [x + r, z], [x - r, z], [x, z + r], [x, z - r]];
        // mapped / measured trees keep their place: a column stands clear of them (inferred trees avoid the columns later)
        const sourceTreeGrid = new BoxGrid(16); for (let i = 0; i + 2 < (data.trees || []).length; i += 3) { const tx = data.trees[i] / 10, tz = data.trees[i + 1] / 10; sourceTreeGrid.insert(tx, tz, tx, tz, [tx, tz]); }
        const sourceTreeNear = (x, z, reach) => { let hit = false; sourceTreeGrid.each(x - reach, z - reach, x + reach, z + reach, t => { if (!hit && Math.hypot(t[0] - x, t[1] - z) < reach) hit = true; }); return hit; };
        const columnFree = (x, z, r, belowY) => {
            if (sourceTreeNear(x, z, r + 1.6)) return false;
            if (ring(x, z, r + .6).some(([px, pz]) => isWater(px, pz) || buildingAt(px, pz))) return false;
            if (lowerRibbon(x, z, r + .3, belowY) || lowerEdge(x, z, r + .3, belowY, true) || railNear(x, z, 1.7 + r + .4, belowY)) return false;
            if (tramSweep?.circle(x, z, r + .1, -1, belowY + 1.5, p => p.y < belowY + 1)) return false; // the swept rigid body of a tram passing below or beside
            { let built = false; for (const [px, pz] of ring(x, z, r + .3)) surfacesAt(px, pz, h => { if (h < belowY) built = true; }); if (built) return false; } // any walked / driven surface
            let deck = false; sceneryDeckGrid.each(x - r, z - r, x + r, z + r, d => { if (!deck && d.h < belowY && ring(x, z, r).some(([px, pz]) => pointInPolygon(px, pz, d.poly))) deck = true; });
            return !deck;
        };
        // the highest thing passing below a crosshead: a lower carriageway with its sidewalks, a pad, a rail, a lower slab
        const lowerSurface = (x, z, belowY) => {
            let y = null, rail = false; const take = (h, isRail) => { if (y === null || h > y + .5) { y = h; rail = isRail; } };
            const track = railNear(x, z, 1.7, belowY); if (track) take(track.y, true);
            const rb = lowerRibbon(x, z, .5, belowY); if (rb) take(rb.y, false);
            const f = lowerEdge(x, z, 0, belowY, true); if (f) take(yAlong(f, x, z), false);
            sceneryDeckGrid.each(x, z, x, z, d => { if (d.h < belowY && pointInPolygon(x, z, d.poly)) take(d.roofHeightAt(x, z), d.kind === 'source-tram-deck'); });
            surfacesAt(x, z, h => { if (h < belowY) take(h, false); }); // also sidewalk hulls round junction corners
            return y === null ? null : { y, rail };
        };
        // ---- one structure, one deck: close the open slot between the parallel slabs of a structure (carriageway |
        //      tram slab | tram slab | carriageway). Only gaps up to the bent model's join gap, between slabs at one
        //      level; a slab that already overlaps its neighbour, or faces open air, is left as it is.
        const infill = { quads: 0, areaM2: 0, maxGapM: 0 };
        {
            const GAP = BENT_MODEL.joinGapM, LEVEL = BENT_MODEL.levelToleranceM, slab = rgb('#96938b'), dark = rgb('#55524d');
            const strips = [];
            for (const e of deckEdges) strips.push({ road: e, id: e.id, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: s2 => widthSide(e, s2),
                topAt: (x, z) => yAlong(e, x, z) + Y.road, soffitAt: (x, z) => { const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); } });
            for (const [i, e] of railEdges.entries()) strips.push({ rail: e.railDeck, id: 1e6 + i, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: () => e.half,
                topAt: (x, z) => e.railDeck.roofHeightAt(x, z), soffitAt: (x, z) => e.railDeck.minHeightAt(x, z) });
            // (owner, 2026-11-11, Grozavesti (112, -197): "HOW?") a street-level bridge over water (Podul Grozavesti over
            // the Dambovita: two carriageways and the tram between them) left the slots between its slabs open, and the
            // river 4.4 m below showed through as water lying at street level. Street-level bridge slabs join the slot
            // infill too, where the slot lies over water (they get no bents: that plan stays elevated-only).
            for (const e of edges) if (e.bridge && !e.virtual && !e.tunnel && Math.max(e.ya, e.yb) <= .3) strips.push({ road: e, low: true, id: e.id, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: s2 => widthSide(e, s2),
                topAt: (x, z) => yAlong(e, x, z) + Y.road, soffitAt: (x, z) => yAlong(e, x, z) + Y.road - .6 });
            for (const [i, d] of tramDecks.entries()) {
                if (d.kind !== 'source-tram-deck' || !d.supportA || d.y1 > 1.2) continue;
                const [ax, az] = d.supportA, [bx, bz] = d.supportB, len = Math.hypot(bx - ax, bz - az); if (len < .05) continue;
                const dirx = (bx - ax) / len, dirz = (bz - az) / len, half = Math.abs((d.poly[0][0] - ax) * -dirz + (d.poly[0][1] - az) * dirx);
                strips.push({ rail: d, low: true, id: 2e6 + i, na: railNode(d.supportA), nb: railNode(d.supportB), a: [ax, az], b: [bx, bz], nx: -dirz, nz: dirx, half: () => half,
                    topAt: (x, z) => d.roofHeightAt(x, z), soffitAt: (x, z) => d.minHeightAt(x, z) });
            }
            const stripGrid = new BoxGrid(32);
            for (const st of strips) {
                const wr = st.half(1), wl = st.half(-1);
                st.poly = [[st.a[0] + st.nx * wr, st.a[1] + st.nz * wr], [st.b[0] + st.nx * wr, st.b[1] + st.nz * wr], [st.b[0] - st.nx * wl, st.b[1] - st.nz * wl], [st.a[0] - st.nx * wl, st.a[1] - st.nz * wl]];
                stripGrid.insert(Math.min(...st.poly.map(q => q[0])), Math.min(...st.poly.map(q => q[1])), Math.max(...st.poly.map(q => q[0])), Math.max(...st.poly.map(q => q[1])), st);
            }
            // nearest neighbouring slab edge along a transverse ray from (ox, oz); null when the point is already on a neighbour
            const reach = (own, ox, oz, dx, dz, level, G = GAP) => {
                let best = null, covered = false;
                stripGrid.each(Math.min(ox, ox + dx * G), Math.min(oz, oz + dz * G), Math.max(ox, ox + dx * G), Math.max(oz, oz + dz * G), st => {
                    if (covered || st === own || st.na === own.na || st.na === own.nb || st.nb === own.na || st.nb === own.nb) return; // itself / its own run continuing
                    if (pointInPolygon(ox, oz, st.poly)) { if (Math.abs(st.topAt(ox, oz) - level) < LEVEL) covered = true; return; }
                    for (let i = 0, j = 3; i < 4; j = i++) {
                        const [x1, z1] = st.poly[j], [x2, z2] = st.poly[i], ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
                        const t = ((x1 - ox) * ez - (z1 - oz) * ex) / den, u = ((x1 - ox) * dz - (z1 - oz) * dx) / den;
                        if (t > .03 && t <= G && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) { const hx = ox + dx * t, hz = oz + dz * t; if (Math.abs(st.topAt(hx, hz) - level) < LEVEL) best = { t, st, x: hx, z: hz, top: st.topAt(hx, hz), soffit: st.soffitAt(hx, hz) }; }
                    }
                });
                return covered ? null : best;
            };
            // (owner L41, Grozavesti (731, -955): sky between the carriageway and the tram deck west of the Basarab station;
            // Street View under the station shows one continuous underside) an elevated tram deck joins a carriageway up to
            // 12 m away. Only the Basarab viaduct has tram decks this high, so nowhere else changes.
            const railJoin = (st, top) => st.rail && top > 8 + Y.road ? 12 : GAP;
            const slotQueue = [], goreQueue = [];
            for (const st of strips) for (const side of [1, -1]) {
                const w = st.half(side), dx = st.nx * side, dz = st.nz * side, ends = [st.a, st.b].map(q => { const ox = q[0] + dx * w, oz = q[1] + dz * w, top = st.topAt(ox, oz); return { ox, oz, top, soffit: st.soffitAt(ox, oz), hit: reach(st, ox, oz, dx, dz, top, st.low ? 10 : railJoin(st, top)) }; }); // (a street-level river bridge: its slabs up to 10 m apart are one deck)
                if (!ends[0].hit !== !ends[1].hit && Math.max(ends[0].top, ends[1].top) > 2.5 && !st.low) goreQueue.push({ st, side, w, dx, dz, ends }); // (one end joined: a split)
                if (!ends[0].hit || !ends[1].hit) continue;
                const overWater = st.low && ends.some(q => isWater((q.ox + q.hit.x) / 2, (q.oz + q.hit.z) / 2)); // (a street-level bridge: only its slots over water)
                if (!(ends[0].top > 2.5 || overWater) || (st.low && !overWater)) continue;
                if (st.road && !(ends[0].hit.st.road && ends[0].hit.st.id > st.id && st.low)) continue; // carriageway pairs: raised ones are the median fill's (above); street-level ones over water here; tram slabs fill toward carriageways
                if (st.rail && ends[0].hit.st.rail && ends[0].hit.st.id < st.id) continue;              // tram pair once
                if (basarabDistrict && st.rail && ends[0].hit.st.rail) { deferredRailSlots.push(ends); continue; } // Basarab: the literal centre support between the two tracks owns that gap where it exists (see below)
                ends.ownRoad = !!st.road; slotQueue.push(ends);
            }
            emitSlot = ends => {
                let [A, B] = ends;
                // (owner, 2026-11-12, Grozavesti (259, -645) "what is this gray spot") a slot whose transverse ray passed under a
                // carriageway at the same level (one not in the strip set) laid its concrete through that carriageway: a grey
                // patch fighting the asphalt. A slot never covers a carriageway.
                for (const f of [.25, .5, .75]) for (const g2 of [.15, .5, .85]) {
                    const L = (p, q, t) => p + (q - p) * t, ax = L(A.ox, A.hit.x, f), az = L(A.oz, A.hit.z, f), bx = L(B.ox, B.hit.x, f), bz = L(B.oz, B.hit.z, f), y = L(L(A.top, A.hit.top, f), L(B.top, B.hit.top, f), g2) - Y.road;
                    if (coveredByOther(L(ax, bx, g2), L(az, bz, g2), null, y, .3, false, .35)) { infill.overRoad = (infill.overRoad || 0) + 1; return; }
                }
                // (owner, 2026-11-12, Grozavesti (249, -617) "this looks random") consecutive slots along a bending pair of slabs met
                // at a point on one side only: a wedge of the ground 11 m below showed through. Each slot overlaps the next by 0.3 m.
                { const lx = B.ox - A.ox, lz = B.oz - A.oz, l = Math.hypot(lx, lz) || 1, ux = lx / l * .3, uz = lz / l * .3, mv = (q, s3) => ({ ...q, ox: q.ox + ux * s3, oz: q.oz + uz * s3, hit: { ...q.hit, x: q.hit.x + ux * s3, z: q.hit.z + uz * s3 } });
                  A = mv(A, -1); B = mv(B, 1); }
                const top = [[A.ox, A.top, A.oz], [B.ox, B.top, B.oz], [B.hit.x, B.hit.top, B.hit.z], [A.hit.x, A.hit.top, A.hit.z]], bottom = [[A.ox, A.soffit, A.oz], [B.ox, B.soffit, B.oz], [B.hit.x, B.hit.soffit, B.hit.z], [A.hit.x, A.hit.soffit, A.hit.z]];
                const up = (top[1][2] - top[0][2]) * (top[2][0] - top[0][0]) - (top[1][0] - top[0][0]) * (top[2][2] - top[0][2]) > 0; // +y normal for this winding?
                const sb = cellOf((A.ox + B.ox) / 2, (A.oz + B.oz) / 2).solid;
                // (owner, 2026-11-11, Grozavesti (549, -831): "why is this cut") a pale concrete strip tapering between a
                // carriageway and the tram slab read as a slice through the deck: next to a carriageway the infill is asphalt
                const topCol = ends.ownRoad && A.hit?.st?.road && B.hit?.st?.road ? rgb(ASPHALT) : slab; // (asphalt only between two carriageways; a tram slab keeps its concrete separator)
                sb.face4(...(up ? top : top.slice().reverse()), topCol, [0, 1, 0]);
                sb.face4(...(up ? bottom.slice().reverse() : bottom), dark, [0, -1, 0]);
                const poly = top.map(q => [q[0], q[2]]), cx = poly.reduce((n, q) => n + q[0], 0) / 4, cz = poly.reduce((n, q) => n + q[1], 0) / 4;
                const plane = (pts) => (x, z) => { // height on the quad's two triangles
                    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) { const a = pts[i], b = pts[j], c = pts[k], den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue; const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den; if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[1] + v * b[1] + (1 - u - v) * c[1]; }
                    return pts.reduce((n, q) => n + q[1], 0) / 4; };
                const deck = { x: cx, z: cz, r: Math.max(...poly.map(q => Math.hypot(q[0] - cx, q[1] - cz))), poly, holes: [], roadDeck: true, kind: 'bridge-slot-infill', estimated: true,
                    y0: Math.min(...bottom.map(q => q[1])), y1: Math.max(...top.map(q => q[1])), h: Math.max(...top.map(q => q[1])), roofHeightAt: plane(top), minHeightAt: plane(bottom) };
                sceneryDeckGrid.insert(cx - deck.r, cz - deck.r, cx + deck.r, cz + deck.r, deck);
                const gap = Math.max(A.hit.t, B.hit.t), len = Math.hypot(B.ox - A.ox, B.oz - A.oz);
                infill.quads++; infill.areaM2 += len * (A.hit.t + B.hit.t) / 2; infill.maxGapM = Math.max(infill.maxGapM, gap);
            };
            for (const ends of slotQueue) emitSlot(ends);
            // a street-level bridge over water is one deck: its carriageways and tram slabs part at the banks and the
            // tram corridor between them has no slab of its own, so the river showed through. One plate (the convex
            // hull of each crossing's slabs, just under their surfaces) closes it.
            {
                const low = strips.filter(st => st.low && (isWater((st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2) || st.poly.some(p => isWater(p[0], p[1])))), parent = low.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
                for (let i = 0; i < low.length; i++) for (let j = i + 1; j < low.length; j++) if (low[i].poly.some(p => low[j].poly.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 10))) parent[find(i)] = find(j);
                const groups = new Map(); low.forEach((st, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(st); });
                for (const g of groups.values()) {
                    if (g.length < 2) continue;
                    const pts = g.flatMap(st => st.poly).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
                    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
                    for (const p of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
                    const hull = lo.slice(0, -1).concat(hi.slice(0, -1)); if (hull.length < 3) continue;
                    const y = Math.min(...g.map(st => st.topAt((st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2))) - .04, yb = y - .9, cx = hull.reduce((n, p) => n + p[0], 0) / hull.length, cz = hull.reduce((n, p) => n + p[1], 0) / hull.length, sb = cellOf(cx, cz).solid;
                    for (let i = 1; i + 1 < hull.length; i++) { const a = hull[0], b = hull[i], c = hull[i + 1]; sb.face4([a[0], y, a[1]], [c[0], y, c[1]], [b[0], y, b[1]], [b[0], y, b[1]], slab, [0, 1, 0]); sb.face4([a[0], yb, a[1]], [b[0], yb, b[1]], [c[0], yb, c[1]], [c[0], yb, c[1]], dark, [0, -1, 0]); }
                    for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; sb.face4([a[0], y, a[1]], [b[0], y, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]], slab, [(b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L]); }
                    infill.riverPlates = (infill.riverPlates || 0) + 1;
                }
            }
            // (owner, 2026-11-11, Grozavesti (731, -955): "why are there holes") where two decks split (the north-east Pasajul
            // branch leaving the main Basarab deck) only one end of a strip side reached the neighbour, so the whole wedge
            // stayed open and the sky showed through between the slabs near the nose. From the joined end, the gore is filled
            // in 1 m steps while the neighbour at the same level is within the join gap; beyond it the decks part.
            let gore = 0;
            for (const { st, side, w, dx, dz, ends } of goreQueue) {
                const k0 = ends[0].hit ? 0 : 1, P0 = k0 ? st.b : st.a, P1 = k0 ? st.a : st.b, L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), n = Math.max(1, Math.ceil(L));
                const hit0 = ends[k0].hit; if (st.road) continue; // (carriageway gores: the median fill)
                let prev = null;
                for (let i = 0; i <= n; i++) {
                    const f = i / n, cx = P0[0] + (P1[0] - P0[0]) * f, cz = P0[1] + (P1[1] - P0[1]) * f, ox = cx + dx * w, oz = cz + dz * w, top = st.topAt(ox, oz);
                    const cur = { ox, oz, top, soffit: st.soffitAt(ox, oz), hit: reach(st, ox, oz, dx, dz, top, railJoin(st, top)) };
                    if (!cur.hit) break;
                    // (owner, 2026-11-12, Grozavesti (387, -720) "flicker": where the two tracks part, this gore fill lay in the plane of
                    // the Basarab centre support between them) a gore between two tram slabs waits for that support, like the slots
                    if (prev) { const pair = [prev, cur]; pair.ownRoad = !!st.road; if (basarabDistrict && st.rail && prev.hit.st.rail && cur.hit.st.rail) deferredRailSlots.push(pair); else emitSlot(pair); gore++; }
                    prev = cur;
                }
            }
            infill.gore = gore;
        }
        // ---- Pasajul Basarab superstructure (basarab-structure.js, integrated from fidelity/basarab-render-r9): platforms,
        //      centre support, station roof, H-frame, stays and river arch. The slot infill above is real deck for its stay
        //      anchors; the stretches its stays and arch carry get no pier below.
        const basarabRoadRegions = basarabDistrict ? raisedRoadTriangles(cells.values()) : [];
        basarabStructure = buildBasarabStructure(data, tramGrades, cellOf, group, edges, { roadRegions: basarabRoadRegions, tramEnvelope: tramPropEnvelope, tramSweep, roadFootprints: basarabDistrict ? edges.filter(e => e.bridge && !e.virtual && !e.tunnel && raisedDeck(e)).map(e => asphaltCorners(e, (f, sd) => widthAsphalt(f, sd) + .4)) : [], supportAt: (x, z, base) => { let top = null; surfacesAt(x, z, h => { if (Math.abs(h - base) < .3 && (top === null || Math.abs(h - base) < Math.abs(top - base))) top = h; }); return top; } });
        const carriedSpans = basarabStructure.report.superstructure?.carriedSpans || [];
        // The slot between the two tram slabs is the centre support's where that exists (station, cable-stayed span).
        // Beyond its ends the slot stayed open: a hole in the deck with the ground visible through it. Closed there now.
        for (const ends of deferredRailSlots) {
            const mid = q => [(q.ox + q.hit.x) / 2, (q.oz + q.hit.z) / 2], [a, b] = ends.map(mid), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            if (basarabStructure.pieces.some(p => [a, b, c].some(m => pointInPolygon(m[0], m[1], p.poly)))) continue;
            // a piece that only reaches into the support at a corner lies 3 cm under it (two faces in one plane flicker)
            const corners = ends.flatMap(q => [[q.ox, q.oz], [q.hit.x, q.hit.z]]).map(m => [m[0] + (c[0] - m[0]) * .12, m[1] + (c[1] - m[1]) * .12]);
            const touches = basarabStructure.pieces.some(p => corners.some(m => pointInPolygon(m[0], m[1], p.poly)));
            emitSlot(touches ? Object.assign(ends.map(q => ({ ...q, top: q.top - .03, hit: { ...q.hit, top: q.hit.top - .03 } })), { ownRoad: ends.ownRoad }) : ends);
        }
        const carried = (x, z) => carriedSpans.some(sp => { const dx = sp.b[0] - sp.a[0], dz = sp.b[1] - sp.a[1], L = Math.hypot(dx, dz) || 1, t = ((x - sp.a[0]) * dx + (z - sp.a[1]) * dz) / L; return t > 6 && t < L - 6 && Math.abs((x - sp.a[0]) * -dz + (z - sp.a[1]) * dx) / L < sp.halfWidthM; });
        bridgeBents = planBridgeBents({
            edges: deckEdges.concat(railEdges),
            halfWidth: (e, side) => e.railDeck ? e.half : widthSide(e, side),
            topAt: (e, x, z) => e.railDeck ? e.railDeck.roofHeightAt(x, z) : yAlong(e, x, z) + Y.road,
            soffitAt: (e, x, z) => { if (e.railDeck) return e.railDeck.minHeightAt(x, z); const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); },
            eachEdge: (x0, z0, x1, z1, cb) => { edgeGrid.each(x0, z0, x1, z1, cb); railEdgeGrid.each(x0, z0, x1, z1, cb); },
            columnFree, lowerSurface, carried,
            model: basarabDistrict ? { ...BENT_MODEL, wideFrame: { maxCantileverM: 12, straddleM: 9, maxSpanM: 32 } } : BENT_MODEL, // (Basarab only: the other districts keep the frames they were reviewed with)
        });
        // a single-deck fallback pier (hammerhead) must keep out of a tram's swept body like every generated structure.
        // (owner, 2026-11-12, Grozavesti (591, -854): "some pillars need to be added ... huge spots where there's no support";
        // 44 hammerheads along Soseaua Orhideelor were dropped, leaving 120-180 m spans) The beam's top is the seat the slab
        // rests on, not 0.1 m above it: a tram riding on the slab it carries no longer counts. A beam end reaching into the
        // sweep of a tram beside it is trimmed back to the free part instead of dropping the pier, while the free beam still
        // holds its columns and 60 % of the deck width.
        if (tramSweep) bridgeBents.bents = bridgeBents.bents.filter(b => {
            if (!b.single) return true;
            const beamHit = (o0, o1) => { const at = o => [b.x + b.nx * (o - (b.lo + b.hi) / 2), b.z + b.nz * (o - (b.lo + b.hi) / 2)]; return !!tramSweep.segment(at(o0), at(o1), BENT_MODEL.beamWidthM / 2 + .1, (b.soffit || 0) - .3, b.seat - .05); };
            let hit = b.columns.some(c => tramSweep.circle(c.x, c.z, BENT_MODEL.columnM * .75, -1, b.seat - .05));
            if (!hit && beamHit(b.lo, b.hi)) {
                const cLo = Math.min(...b.columns.map(c => c.o)) - BENT_MODEL.columnM * .5 - .2, cHi = Math.max(...b.columns.map(c => c.o)) + BENT_MODEL.columnM * .5 + .2;
                let lo = cLo, hi = cHi; if (beamHit(lo, hi)) hit = true;
                while (!hit && lo - .5 >= b.lo && !beamHit(lo - .5, lo)) lo -= .5;
                while (!hit && hi + .5 <= b.hi && !beamHit(hi, hi + .5)) hi += .5;
                if (!hit && hi - lo >= .6 * (b.deckHi - b.deckLo)) { const mid0 = (b.lo + b.hi) / 2, mid = (lo + hi) / 2; b.x += b.nx * (mid - mid0); b.z += b.nz * (mid - mid0); b.lo = lo; b.hi = hi; b.width = hi - lo; bridgeBents.report.hammerheadsTrimmed = (bridgeBents.report.hammerheadsTrimmed || 0) + 1; }
                else hit = true;
            }
            if (hit) { bridgeBents.report.hammerheadsInTramSweep = (bridgeBents.report.hammerheadsInTramSweep || 0) + 1; bridgeBents.report.bents--; }
            return !hit;
        });
        const conc = rgb('#a9a69e'), base = -.4;
        // The guard takes one height interval for a whole pitched tram body: on a ramp its low end reads below the deck
        // under its high end. A pier is under the slab that carries that tram, so its collider ends below that reading;
        // the drawn pier is unchanged and nothing but the tram above could reach the difference.
        const pierTop = (x, z, r, seat) => { const under = tramSweep ? tramSweep.undersideOver(x, z, r, p => p.y >= seat - .5) : Infinity; if (under - .05 < seat - .5) tramSweepConflicts.pierTopsLowered++; return Math.min(seat - .5, under - .05); };
        // A single-column bent with a wide crosshead becomes a V: two inclined legs from the column's own footing. Only
        // where both legs keep the planner's clearance over whatever passes under them (4.7 m road, 5.2 m rail), touch no
        // building, water or mapped tree and stay out of a tram's sweep; otherwise the plain stem stays. ESTIMATE of form.
        const veeLegs = b => {
            if (!basarabStructure.report.active) return null; // (the Basarab district only; other districts keep the plain stems they were reviewed with)
            if (b.kind !== 'crosshead' || b.columns.length !== 1 || b.width < 6 || b.soffit < 3.5) return null;
            const c = b.columns[0], mid = (b.lo + b.hi) / 2, spread = Math.min(b.hi - c.o - .9, c.o - b.lo - .9, Math.max(1.6, b.soffit * .22));
            if (!(spread >= 1.2)) return null;
            const foot = [c.x, .3, c.z], tops = [c.o - spread, c.o + spread].map(o => [b.x + b.nx * (o - mid), b.soffit + .15, b.z + b.nz * (o - mid)]);
            for (const top of tops) for (const t of [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1]) { // (L17 recheck: between five samples a leg leaned 1 cm into a ground tram's body)
                const x = foot[0] + (top[0] - foot[0]) * t, y = foot[1] + (top[1] - foot[1]) * t, z = foot[2] + (top[2] - foot[2]) * t;
                if (buildingAt(x, z) || isWater(x, z) || sourceTreeNear(x, z, 1.3)) return null;
                const under = lowerSurface(x, z, y - .2);
                if (under && y - .7 - under.y < (under.rail ? BENT_MODEL.railClearanceM : BENT_MODEL.roadClearanceM)) return null;
                if (tramSweep?.circle(x, z, .8, y - .9, y + .7, q => q.y < b.seat - .5)) return null;
            }
            return { foot, tops, spread };
        };
        for (const b of bridgeBents.bents) {
            const sb = cellOf(b.x, b.z).solid;
            if (b.kind === 'wall') {
                const w = Math.max(1, b.width - .4);
                sb.box(b.x, base, b.z, w, b.seat - base, .9, b.angle, conc);
                pierColl.push({ x: b.x, z: b.z, hw: w / 2, hd: .45, angle: b.angle, r: Math.hypot(w / 2, .45), poly: null, h: b.seat, prop: true, kind: 'pier', yMax: pierTop(b.x, b.z, Math.hypot(w / 2, .45), b.seat) });
                continue;
            }
            sb.box(b.x, b.soffit, b.z, b.width + .6, BENT_MODEL.beamDepthM, BENT_MODEL.beamWidthM, b.angle, conc);
            for (const p of b.pedestals) sb.box(p.x, p.y0, p.z, p.width, p.y1 - p.y0, 1, b.angle, conc);
            const vee = veeLegs(b);
            if (vee) {
                // one footing, two inclined legs to the crosshead (the single stem of a hammerhead pier, opened into a V)
                const c = b.columns[0];
                sb.box(c.x, base, c.z, 2.4, .7 - base, 1.5, b.angle, conc);
                pierColl.push({ x: c.x, z: c.z, hw: 1.2, hd: .75, angle: b.angle, r: 1.45, poly: null, h: .7, prop: true, kind: 'pier' });
                for (const top of vee.tops) bridgeBeam(cellOf, vee.foot, top, .95, '#a9a69e', pierColl, 'pier');
                b.vee = { spreadM: vee.spread, foot: vee.foot, tops: vee.tops }; bridgeBents.report.veePiers = (bridgeBents.report.veePiers || 0) + 1;
                continue;
            }
            for (const c of b.columns) {
                const m = BENT_MODEL.columnM;
                sb.box(c.x, base, c.z, m, b.soffit - base, m, b.angle, conc);
                pierColl.push({ x: c.x, z: c.z, hw: m / 2, hd: m / 2, angle: b.angle, r: m * .75, poly: null, h: b.soffit, prop: true, kind: 'pier', yMax: pierTop(c.x, c.z, m * .75, b.seat) });
            }
        }
        bridgeBents.report.slotInfill = { riverPlates: infill.riverPlates || 0, quads: infill.quads, areaM2: Math.round(infill.areaM2), maxGapM: +infill.maxGapM.toFixed(2), goreQuads: infill.gore || 0, keptOffCarriageway: infill.overRoad || 0 };
    }
    propColl.push(...basarabStructure.colliders);
    for(const piece of basarabStructure.pieces){propColl.push(piece);tramDecks.push(piece);sceneryDeckGrid.insert(piece.x-piece.r,piece.z-piece.r,piece.x+piece.r,piece.z+piece.r,piece);}
    return {
        basarabStructure, bridgeBents,
    };
}
