// ============================================================================
//  WORLD SIDE JOINS — sidewalk joins, ribbon grid, raised tops, raised decks, median fill, walls
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { distPointSeg, pointInPolygon } from './util.js';
import { rgb, shadeRgb } from './geobuild.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { deckWalkShiftAt } from './bridge-walkways.js';
import { bridgeJunctionSlab, uncoveredBridgePadBoundary } from './bridge-junction.js';
import { BENT_MODEL } from './bridge-bents.js';
import { basarabEdge } from './basarab-structure.js';
import { BoxGrid, Y, convexHull, shoulderOf } from './world-shared.js';

export function buildSideJoins(ctx) {
    const {
        ASPHALT, DY_SIDE, SIDE_BACK, US, asphaltCorners, bridgeJunctionAudit, bridgeJunctionDecks, cellOf,
        cornerGrid, cornerPolys, cornerSkips, coveredByOther, data, edgeGrid, edges, kerbCol,
        layerY, padAsphalt, padCorners, padHeightAt, pierColl, pierSpots, polyDist, railRoadside,
        raised, raisedEdge, retainedDeck, ribbons, sceneryDeckGrid, sharedPadSurfaces, sideCol, sideExtra,
        sideJoins, widthAsphalt, widthSide, yAlong,
    } = ctx;
    // raised junction corners: between two neighbouring sidewalk ends round a pad, a quad from one end (asphalt
    // corner → property-line corner) to the next, at the kerb's height, with a kerb face toward the pad and a back face
    for (const [n, R] of sideJoins) {
        if (R.length < 2) continue;
        const ang = (r) => Math.atan2((r.asph[1] + r.outer[1]) / 2 - n.z, (r.asph[0] + r.outer[0]) / 2 - n.x);
        const S2 = R.map(r => ({ ...r, a: ang(r) })).sort((p, q) => p.a - q.a), c = cellOf(n.x, n.z), mb = c.ground;
        const cross = (p, q, r2, s2) => { const d = (q[0] - p[0]) * (s2[1] - r2[1]) - (q[1] - p[1]) * (s2[0] - r2[0]); if (Math.abs(d) < 1e-9) return false;
            const t = ((r2[0] - p[0]) * (s2[1] - r2[1]) - (r2[1] - p[1]) * (s2[0] - r2[0])) / d, u = ((r2[0] - p[0]) * (q[1] - p[1]) - (r2[1] - p[1]) * (q[0] - p[0])) / d; return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999; };
        for (let i = 0; i < S2.length; i++) {
            const r1 = S2[i], r2 = S2[(i + 1) % S2.length]; if (r1.e === r2.e) continue;
            const skip = (why) => { if (cornerSkips.length < 60) cornerSkips.push({ x: Math.round(n.x), z: Math.round(n.z), why }); };
            let gap = r2.a - r1.a; if (gap <= 0) gap += Math.PI * 2; if (gap > Math.PI * 1.25) { skip('gap ' + Math.round(gap * 57.3)); continue; }
            const q = [r1.asph, r1.outer, r2.outer, r2.asph];
            if (cross(q[0], q[1], q[2], q[3]) || cross(q[1], q[2], q[3], q[0])) { skip('self-crossing'); continue; }
            let ar = 0; for (let k = 0; k < 4; k++) ar += q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1]; if (Math.abs(ar) / 2 < 0.4 || Math.abs(ar) / 2 > 400) { skip('area ' + Math.round(Math.abs(ar) / 2)); continue; }
            const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cz = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
            // (two ends of one deck walkway, bridge-walkways.js: the walkway goes on round the pad, at the deck's edge)
            const deck = !!(r1.e.deckWalk && r1.e.bridge && r2.e.deckWalk && r2.e.bridge);
            if (!deck && r1.e.name && r1.e.name === r2.e.name && Math.abs(r1.e.dirx * r2.e.dirx + r1.e.dirz * r2.e.dirz) > 0.9) { skip('median'); continue; } // (the two halves of a dual carriageway)
            const inP = (p, f = 0.3) => { const l = Math.hypot(cx - p[0], cz - p[1]) || 1; return [p[0] + (cx - p[0]) / l * f, p[1] + (cz - p[1]) / l * f]; };
            const smp = [[cx, cz], ...q.map(v => inP(v)), ...q.map((v, k) => inP([(v[0] + q[(k + 1) % 4][0]) / 2, (v[1] + q[(k + 1) % 4][1]) / 2]))];
            if (smp.some(([x, z]) => coveredByOther(x, z, null, padHeightAt(n, x, z), 0.02))) { skip('covered'); continue; }
            const hy = (x, z) => Y.road + Y.kerb + padHeightAt(n, x, z), base = mb.vc;
            for (const [x, z] of q) mb.v(x, hy(x, z), z, 0, 1, 0, x * 0.25, z * 0.25, sideCol);
            mb.triUp(base, base + 1, base + 2); mb.triUp(base, base + 2, base + 3);
            const tn = (a, b, away) => { const mx = (a[0] + b[0]) / 2 - n.x, mz = (a[1] + b[1]) / 2 - n.z, l = Math.hypot(mx, mz) || 1; return away ? [mx / l, mz / l] : [-mx / l, -mz / l]; };
            { const [nx, nz] = tn(q[3], q[0], false); mb.wall(q[3][0], q[3][1], q[0][0], q[0][1], Y.road - 0.01 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(kerbCol, 0.85)); }   // kerb face toward the pad
            if (deck) { const [nx, nz] = tn(q[1], q[2], true); mb.wall(q[1][0], q[1][1], q[2][0], q[2][1], Y.road - 0.45 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(sideCol, 0.8)); } // (the deck's edge: the railing stands on it)
            else { const [nx, nz] = tn(q[1], q[2], true), f1 = [q[1][0] + nx * 2.4, q[1][1] + nz * 2.4], f2 = [q[2][0] + nx * 2.4, q[2][1] + nz * 2.4], yg = Y.landuse + 0.01 + padHeightAt(n, cx, cz); // back: a 2.4 m slope (a face where it would land on a road)
              if (![f1, f2].some(([x, z]) => coveredByOther(x, z, null, padHeightAt(n, x, z), 0.02))) mb.face4([q[1][0], hy(q[1][0], q[1][1]), q[1][1]], [q[2][0], hy(q[2][0], q[2][1]), q[2][1]], [f2[0], yg, f2[1]], [f1[0], yg, f1[1]], sideCol, [nx * 0.34, 2.4, nz * 0.34]);
              else mb.wall(q[1][0], q[1][1], q[2][0], q[2][1], Y.landuse - 0.02 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(sideCol, 0.8)); }
            const cp = { p: q, n, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) };
            if (deck) { cp.deck = true; cp.e = r1.e; (n.deckWalkCorners || (n.deckWalkCorners = [])).push(cp); }
            cornerPolys.push(cp); cornerGrid.insert(cp.x0, cp.z0, cp.x1, cp.z1, cp);
        }
    }
    // junction pads
    for (const [n, o] of padCorners) {
        const c = cellOf(n.x, n.z), bridgePadRoadStart = c.pad.ic, bridgePadSideStart = c.ground.ic;
        const ly = Math.max(0, Math.min(...n.edges.map(layerY)));
        if (o.side.length >= 3) { // (sloped like the pad: a flat sidewalk hull would poke through a pad on a grade)
            const hull = convexHull(o.side), road = convexHull(o.road), mb = c.ground;
            // The two hulls use different triangulations on a grade. Even a nominally lower sidewalk can then
            // project through the carriageway. Keep its complete exterior, clipping only its overlap with the pad.
            const clipSide = (P, a, b, keepInside) => {
                const d = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), Q = [];
                for (let j = 0; j < P.length; j++) {
                    const p = P[j], q = P[(j + 1) % P.length], dp = d(p), dq = d(q), ip = keepInside ? dp >= 0 : dp <= 0, iq = keepInside ? dq >= 0 : dq <= 0;
                    if (ip) Q.push(p);
                    if (ip !== iq) { const t = dp / (dp - dq); Q.push(p.map((v, i) => v + (q[i] - v) * t)); }
                }
                return Q;
            };
            const emit = P => { if (P.length < 3) return; const base = mb.vc; for (const [x, z, y] of P) mb.v(x, y, z, 0, 1, 0, x * 0.25, z * 0.25, sideCol); for (let j = 1; j < P.length - 1; j++) mb.triUp(base, base + j, base + j + 1); };
            const pts = hull.map(([x, z]) => [x, z, Y.side + ly - 0.004 + padHeightAt(n, x, z)]);
            let area = 0; for (let j = 0; j < road.length; j++) area += road[j][0] * road[(j + 1) % road.length][1] - road[(j + 1) % road.length][0] * road[j][1];
            if (area < 0) road.reverse();
            for (let k = 1; k < pts.length - 1; k++) {
                let P = [pts[0], pts[k], pts[k + 1]];
                if (road.length >= 3) for (let j = 0; j < road.length && P.length; j++) { const a = road[j], b = road[(j + 1) % road.length]; emit(clipSide(P, a, b, false)); P = clipSide(P, a, b, true); }
                else emit(P);
            }
        }
        if (o.road.length >= 3) {
            // (2026-11-07, world-visual) each pad corner takes the height of the approach it belongs to (a junction on
            // a grade is not a flat shelf with a 0.3–0.9 m step at every sloping mouth: the step made the rim barriers
            // across the Bellevue 13B loop / NE 8th lanes); flat junctions are unchanged
            const hull = convexHull(o.road), col = padAsphalt(n), mb = c.pad, u = 0.15, base = mb.vc;
            const hs = hull.map(([x, z]) => padHeightAt(n, x, z));
            const shared=sharedPadSurfaces.get(n.id);
            if(shared)for(const tri of shared.topTriangles)mb.face3(...tri,col,[0,1,0],-1,tri.map(p=>[p[0]*u,p[2]*u]));
            else {hull.forEach(([x, z], k) => mb.v(x, Y.road + ly + hs[k], z, 0, 1, 0, x * u, z * u, col));
            for (let k = 1; k < hull.length - 1; k++) mb.triUp(base, base + k, base + k + 1);}
            ribbons.push({ node: n, poly: hull, hs });
        }
        const sourceForkEdges = n.edges.filter(e => !e.virtual);
        const modeledEmbankment=sourceForkEdges.length>=3&&sourceForkEdges.every(e=>!e.bridge&&!e.tunnel&&e.sourceBridgeGrade?.known&&Math.min(e.ya,e.yb)>.3);
        if (n.sourceId > 0 && sourceForkEdges.length >= 3 && (modeledEmbankment||sourceForkEdges.every(e => e.bridge && !e.tunnel && Math.min(e.ya, e.yb) > .3))) {
            const triangles = (mb, start) => { const result = []; for (let i = start; i < mb.ic; i += 3) result.push([0, 1, 2].map(k => Array.from(mb.p.subarray(mb.i[i + k] * 3, mb.i[i + k] * 3 + 3)))); return result; };
            const topTriangles = triangles(c.pad, bridgePadRoadStart);
            const poly = convexHull(o.road); // exact existing road pad; no invented outer sidewalk slab
            const slab = bridgeJunctionSlab({ node: n, poly, topTriangles, edges: sourceForkEdges,supportKind:modeledEmbankment?'modeled-embankment':'bridge',
                mouths: sourceForkEdges.map(e => asphaltCorners(e, widthSide)),
                sourceIds: sourceForkEdges.map(e => data.roadSourceGeometry?.[e.road]?.sourceId || e.access?.sourceId),
                bottomHeightAt: (x, z) => { if(modeledEmbankment)return 0;const y = padHeightAt(n, x, z); return Y.road + y - Math.min(1.1, Math.max(.05, y)); } });
            if (slab.known) {
                for (const tri of slab.underside) c.solid.face3(...tri, rgb('#55524d'), [0, -1, 0]);
                for (const face of slab.fascia) c.solid.face4(...face.vertices, rgb('#a9a69e'), face.outward);
                sceneryDeckGrid.insert(slab.deck.x - slab.deck.r, slab.deck.z - slab.deck.r, slab.deck.x + slab.deck.r, slab.deck.z + slab.deck.r, slab.deck);
                bridgeJunctionDecks.push(slab.deck);
                bridgeJunctionAudit.sourceForks.push({ sourceNodeId: n.sourceId, sourceIds: slab.deck.sourceIds, poly, topTriangles, bottomTriangles: slab.underside, fascia: slab.fascia });
                bridgeJunctionAudit.undersideTriangles += slab.underside.length; bridgeJunctionAudit.fasciaTriangles += slab.fascia.length * 2;
            } else bridgeJunctionAudit.unresolved.push({ sourceNodeId: n.sourceId, reason: slab.reason });
            if (slab.known) continue;
        }
        // (owner, 2026-11-12, Grozavesti (354, -718), (877, -1118), (836, -1061): "see through") every other junction pad up
        // on a bridge (two segments of one carriageway meeting at a bend, a pad shared by two carriageways side by side, a
        // node whose source fork is not modelled) had a top skin only: from the street below the sky showed through it. Its
        // own pad and sidewalk skins get the edge decks' underside (same depth rule) and a fascia where no mouth meets them.
        if (sourceForkEdges.length && o.road.length >= 3 && sourceForkEdges.every(e => e.bridge && !e.tunnel && Math.min(e.ya, e.yb) > .3)) {
            const tris = (mb, start) => { const result = []; for (let i = start; i < mb.ic; i += 3) result.push([0, 1, 2].map(k => Array.from(mb.p.subarray(mb.i[i + k] * 3, mb.i[i + k] * 3 + 3)))); return result; };
            const top = tris(c.pad, bridgePadRoadStart).concat(tris(c.ground, bridgePadSideStart)); if (!top.length) continue;
            const depth = y => y - Math.min(1.1, Math.max(.05, y - Y.road)), dark = rgb('#55524d'), conc = rgb('#a9a69e');
            // (owner, 2026-11-12, Grozavesti (933, -1180): "see through") between two retained ramp segments (standing on their walls
            // down to the ground) the pad's side reaches the ground too: a 1.1 m fascia left a slot under the pad's corner.
            const foot = sourceForkEdges.every(retainedDeck) ? () => .02 : depth;
            const hull = convexHull(top.flat().map(q => [q[0], q[2]])), mouths = sourceForkEdges.map(e => asphaltCorners(e, widthSide));
            // (the underside reaches 0.3 m past the skin, from the hull centre: the mitred edge decks meet it without hairline sky wedges)
            const hx = hull.reduce((m, q) => m + q[0], 0) / hull.length, hz = hull.reduce((m, q) => m + q[1], 0) / hull.length, out = q => { const l = Math.hypot(q[0] - hx, q[2] - hz) || 1; return [q[0] + (q[0] - hx) / l * .3, depth(q[1]), q[2] + (q[2] - hz) / l * .3]; };
            for (const tri of top) c.solid.face3(...tri.slice().reverse().map(out), dark, [0, -1, 0]);
            const yOn = (x, z) => { let y = null; for (const [a, b, d] of top) { const den = (b[2] - d[2]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[2] - d[2]); if (Math.abs(den) < 1e-12) continue; const u = ((b[2] - d[2]) * (x - d[0]) + (d[0] - b[0]) * (z - d[2])) / den, v = ((d[2] - a[2]) * (x - d[0]) + (a[0] - d[0]) * (z - d[2])) / den; if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) continue; const h = u * a[1] + v * b[1] + (1 - u - v) * d[1]; if (y === null || h > y) y = h; } return y; };
            let sign = 0; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; sign += a[0] * b[1] - a[1] * b[0]; } sign = Math.sign(sign);
            for (let i = 0; i < hull.length; i++) {
                const a = hull[i], b = hull[(i + 1) % hull.length];
                for (const [lo, hi] of uncoveredBridgePadBoundary(a, b, mouths)) {
                    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], A = at(lo), B = at(hi), ya = yOn(...A), yb = yOn(...B); if (ya === null || yb === null) continue;
                    { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ox = sign * (b[1] - a[1]) / L * .4, oz = sign * (a[0] - b[0]) / L * .4, mx = (A[0] + B[0]) / 2 + ox, mz = (A[1] + B[1]) / 2 + oz;
                      if (coveredByOther(mx, mz, null, (ya + yb) / 2 - Y.road, 0, false, .5)) continue; } // (another deck carries on at this level: no face inside it)
                    c.solid.face4([A[0], foot(ya), A[1]], [B[0], foot(yb), B[1]], [B[0], yb, B[1]], [A[0], ya, A[1]], foot === depth ? conc : rgb('#8f8c86'), [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])]); // (the retaining walls' concrete where it reaches the ground)
                }
            }
            bridgeJunctionAudit.padUndersides = (bridgeJunctionAudit.padUndersides || 0) + 1;
        }
    }
    // ---- ribbon index: is (x, z) (± r) on a carriageway / junction pad? (tunnel ribbons do not block the surface)
    const ribGrid = new BoxGrid(24);
    for (const rb of ribbons) {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of rb.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        Object.assign(rb, { x0, z0, x1, z1, block: rb.e ? !rb.e.lidded : rb.node.y > -4.5, y: rb.e ? Math.max(rb.e.ya, rb.e.yb) : rb.node.y });
        ribGrid.insert(x0, z0, x1, z1, rb);
    }
    /** the ribbon (carriageway or junction pad) that a circle (x, z, r) touches, or null */
    const onRibbon = (x, z, r = 0, filter = null) => {
        let hit = null;
        ribGrid.each(x - r, z - r, x + r, z + r, (rb) => {
            if (hit || !rb.block || x < rb.x0 - r || x > rb.x1 + r || z < rb.z0 - r || z > rb.z1 + r) return;
            if (filter && !filter(rb)) return;
            if (pointInPolygon(x, z, rb.poly) || (r > 0 && polyDist(x, z, rb.poly) < r)) hit = rb;
        });
        if (hit || filter) return hit;
        // also the straight lane strip of every edge from node to node (what traffic / the harness consider the lanes)
        edgeGrid.each(x - r - 12, z - r - 12, x + r + 12, z + r + 12, (e) => {
            if (hit || e.virtual || e.lidded) return;
            const s = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz; if (s < 0.3 || s > e.len - 0.3) return;
            const lat = (x - e.a.x) * e.nx + (z - e.a.z) * e.nz;
            if (Math.abs(lat) < (lat >= 0 ? e.wR : e.wL) + r + 0.25) hit = { e, strip: true, y: Math.max(e.ya, e.yb) };
        });
        return hit;
    };
    const clearOf = (x, z, r = 0.3) => !onRibbon(x, z, r);
    // bridge piers: never on the road below (only where they clear every lower carriageway)
    for (const p of pierSpots) {
        const e = p.e;
        if (onRibbon(p.x, p.z, 1.0, (rb) => rb.e !== e && rb.node !== e.a && rb.node !== e.b && rb.y < p.y - 0.5)) continue;
        p.sb.box(p.x, 0, p.z, 1.3, p.y, 1.3, p.ang, p.col);
        pierColl.push({ x: p.x, z: p.z, hw: 0.65, hd: 0.65, angle: p.ang, r: 0.95, poly: null, h: p.y, prop: true, kind: 'pier', yMax: p.y - 0.5 });
    }
    const segsCross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    /** does polygon `poly` overlap any blocking ribbon? */
    const polyOnRibbon = (poly, filter = null) => {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = null;
        ribGrid.each(x0, z0, x1, z1, (rb) => {
            if (hit || !rb.block || rb.x1 < x0 || rb.x0 > x1 || rb.z1 < z0 || rb.z0 > z1 || (filter && !filter(rb))) return;
            if (poly.some(p => pointInPolygon(p[0], p[1], rb.poly)) || rb.poly.some(p => pointInPolygon(p[0], p[1], poly))) { hit = rb; return; }
            for (let i = 0, j = poly.length - 1; i < poly.length && !hit; j = i++) for (let k = 0, l = rb.poly.length - 1; k < rb.poly.length; l = k++) if (segsCross(poly[j], poly[i], rb.poly[l], rb.poly[k])) { hit = rb; break; }
        });
        return hit;
    };
    /** top of the raised sidewalk at (x, z): a sidewalk band of a raised edge (between its asphalt edge and the
     *  property line, + tol: fences / hedges standing on the back edge) or a raised junction corner, never on a carriageway /
     *  pad → height (with the street's profile) or null */
    const RIB_ONLY = () => true;
    /** the ribbon filter for a deck walkway at road level y (yAlong) above (x, z): only carriageways at its level, other than
     *  the walkway's own (a walkway over a road passing below is still a walkway, and its own carriageway's mitred end at a
     *  width step reaches under it; bridge-walkways.js) */
    const ribbonsAtLevel = (x, z, y, own = null) => rb => rb.e !== own && Math.abs((rb.e ? yAlong(rb.e, x, z) : rb.node ? padHeightAt(rb.node, x, z) : 0) - y) < 1.5;
    const raisedTop = (x, z, tol = 0) => {
        let top = null, deckY = null, deckE = null;
        cornerGrid.each(x - tol, z - tol, x + tol, z + tol, (cp) => {
            if (top !== null || x < cp.x0 - tol || x > cp.x1 + tol || z < cp.z0 - tol || z > cp.z1 + tol) return;
            if (pointInPolygon(x, z, cp.p) || (tol > 0 && polyDist(x, z, cp.p) < tol)) { top = Y.road + Y.kerb + padHeightAt(cp.n, x, z); if (cp.deck) deckY = padHeightAt(cp.n, x, z); }
        });
        if (top === null) edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (top !== null || !raisedEdge(e)) return;
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z); if (q.t <= 0 || q.t >= 1) return;
            const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1, wa = widthAsphalt(e, side) + sideExtra(e, side, q.t * e.len) + (e.deckWalkShift ? deckWalkShiftAt(e, side, q.t) : 0);
            if (!raisedEdge(e, side) || q.d < wa + 0.02 || q.d > wa + sidewalkWidth(e, side) + SIDE_BACK + tol) return;
            top = railRoadside.surface(e, x, z, Y.road + Y.kerb + yAlong(e,x,z));
            if (top !== null && e.deckWalk && e.bridge) { deckY = yAlong(e, x, z); deckE = e; }
        });
        if (top !== null && onRibbon(x, z, 0, deckY === null ? RIB_ONLY : ribbonsAtLevel(x, z, deckY, deckE))) return null;
        return top;
    };
    /** vertices added to a cell's solid / detail builders since (v0s, v0d) lifted onto the raised sidewalk when (x, z) is on one */
    const liftOnSide = (c, v0s, v0d, x, z, tol = 0) => {
        if (raisedTop(x, z, tol) === null) return false;
        for (let i = v0s; i < c.solid.vc; i++) c.solid.p[i * 3 + 1] += DY_SIDE;
        if (v0d != null) for (let i = v0d; i < c.detail.vc; i++) c.detail.p[i * 3 + 1] += DY_SIDE;
        return true;
    };
    const obbPoly = (b) => { const c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const lx = u * b.hw, lz = v * b.hd; return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; }); };
    /** outer edge of the sidewalk on side s of edge e at distance `along` from e.a (where lamps / signs / trees go) */
    const kerbSpot = (e, along, s, inset = 0.45) => {
        const w = (s > 0 ? e.wR : e.wL) + shoulderOf(e) + sideExtra(e, s, along);
        const o = e.sidewalk >= 1.2 ? w + Math.max(0.55, e.sidewalk - inset) : w + 0.7;
        return { x: e.a.x + e.dirx * along + e.nx * o * s, z: e.a.z + e.dirz * along + e.nz * o * s, o };
    };

    // ---- medians between raised carriageways (owner, 2026-11-11, Grozavesti (70, 128) "This is in SO many places",
    //      (88, -117) "Lane is completely broken"; Street View along Pasajul Basarab: one embankment / one deck carries both
    //      carriageways, with a grass median on the ramps and a kerbed concrete median on the arch, no railing between
    //      them). Two raised carriageways side by side at one level (within 1.5 m) and at most 6 m apart had the gap
    //      between them open down to the ground, with a guard rail on each side of it. The gap is filled at deck level
    //      (grass on ramps up to 9 m, a kerbed concrete median above, asphalt where it is a sliver) and registered as a
    //      surface, so no guard is generated along it. Pairs with a tram slab are left to the slot infill further on.
    // (owner, 2026-11-12, Grozavesti (770, -1001) "also this random thing", (763, -1019) "still seeing missing pieces") the
    // Bretea slip ramps leave and join the Basarab deck on their own bridges; only edges named Pasajul Basarab had the
    // continuous guard, so the ramps kept the grey pad-rim barrier pieces (one stood in the carriageway where a ramp meets
    // the deck). Every raised bridge edge connected to the Basarab deck through raised bridge edges is one structure.
    // (owner, 2026-11-13, SeaTac: "bridges with borders that don't connect properly", Bellevue: "fences do not connect")
    // the per-edge railings left the same gaps and stray pieces at every other interchange: every raised bridge
    // carriageway of every district now takes the one guard rule (the outline of the union of the raised carriageways).
    let raisedDeckSet = null;
    const raisedDeck = e => {
        if (!raisedDeckSet) raisedDeckSet = new Set(edges.filter(f => basarabEdge(data, f) || (f.bridge && !f.virtual && !f.tunnel && Math.max(f.ya, f.yb) > .3)));
        return raisedDeckSet.has(e);
    };
    const medianFill = { quads: 0, areaM2: 0, decks: [] }, medianGrid = new BoxGrid(32);
    {
        const GAP = BENT_MODEL.joinGapM, LEVEL = BENT_MODEL.levelToleranceM, grass = rgb('#5d7a3c'), conc = rgb('#9a978f'), dark = rgb('#55524d');
        const strips = [];
        for (const e of raised) if (!e.virtual && !e.tunnel && Math.max(e.ya, e.yb) > .3) strips.push({ e, id: e.id, na: e.a, nb: e.b, a: [e.a.x, e.a.z], b: [e.b.x, e.b.z], nx: e.nx, nz: e.nz, half: s2 => widthSide(e, s2), topAt: (x, z) => yAlong(e, x, z) + Y.road });
        const grid = new BoxGrid(32);
        for (const st of strips) { const wr = st.half(1), wl = st.half(-1); st.poly = [[st.a[0] + st.nx * wr, st.a[1] + st.nz * wr], [st.b[0] + st.nx * wr, st.b[1] + st.nz * wr], [st.b[0] - st.nx * wl, st.b[1] - st.nz * wl], [st.a[0] - st.nx * wl, st.a[1] - st.nz * wl]]; grid.insert(Math.min(...st.poly.map(q => q[0])), Math.min(...st.poly.map(q => q[1])), Math.max(...st.poly.map(q => q[0])), Math.max(...st.poly.map(q => q[1])), st); }
        // (owner L41, Grozavesti (731, -955): sky through the deck where the north-east branch leaves the main deck; Street
        // View there shows one continuous underside) the first segments of two carriageways leaving one split node share
        // that node, and a shared node meant "its own run continuing": the gore between them was never filled. A different
        // road leaving the same node in nearly the same direction is a gore partner, not a continuation.
        const goreMate = (a, b) => a.e.road !== b.e.road && Math.abs(a.e.dirx * b.e.dirx + a.e.dirz * b.e.dirz) > 0.9;
        const reach = (own, ox, oz, dx, dz, level) => {
            let best = null, covered = false;
            grid.each(Math.min(ox, ox + dx * GAP), Math.min(oz, oz + dz * GAP), Math.max(ox, ox + dx * GAP), Math.max(oz, oz + dz * GAP), st => {
                if (covered || st === own || ((st.na === own.na || st.na === own.nb || st.nb === own.na || st.nb === own.nb) && !goreMate(st, own))) return;
                if (pointInPolygon(ox, oz, st.poly)) { if (Math.abs(st.topAt(ox, oz) - level) < LEVEL) covered = true; return; }
                for (let i = 0, j = 3; i < 4; j = i++) {
                    const [x1, z1] = st.poly[j], [x2, z2] = st.poly[i], ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
                    const t = ((x1 - ox) * ez - (z1 - oz) * ex) / den, u = ((x1 - ox) * dz - (z1 - oz) * dx) / den;
                    if (t > .03 && t <= GAP && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) { const hx = ox + dx * t, hz = oz + dz * t, top = st.topAt(hx, hz); if (Math.abs(top - level) < LEVEL) best = { t, st, x: hx, z: hz, top }; }
                }
            });
            return covered ? null : best;
        };
        const emit = (A, B) => {
            const gap = Math.max(A.hit.t, B.hit.t), maxTop = Math.max(A.top, B.top, A.hit.top, B.hit.top) - Y.road;
            // (r2, SeaTac Airport Expressway 47.45097, -122.30067: the gore between a US ramp and its carriageway is painted asphalt)
            const usGore = US && (/_link$/.test(A.st.e.type) || /_link$/.test(A.hit.st.e.type));
            const kind = gap <= 1.2 || usGore ? 'asphalt' : maxTop <= 9 ? 'grass' : 'concrete', rise = kind === 'asphalt' ? 0 : .15;
            const top = [[A.ox, A.top + rise, A.oz], [B.ox, B.top + rise, B.oz], [B.hit.x, B.hit.top + rise, B.hit.z], [A.hit.x, A.hit.top + rise, A.hit.z]];
            const up = (top[1][2] - top[0][2]) * (top[2][0] - top[0][0]) - (top[1][0] - top[0][0]) * (top[2][2] - top[0][2]) > 0, Q = up ? top : top.slice().reverse();
            const cx = (A.ox + B.ox + A.hit.x + B.hit.x) / 4, cz = (A.oz + B.oz + A.hit.z + B.hit.z) / 4, cell = cellOf(cx, cz);
            if (kind === 'grass') cell.ground.face4(...Q, grass, [0, 1, 0], -1, Q.map(p => [p[0] * .125, p[2] * .125]));
            else cell.solid.face4(...Q, kind === 'asphalt' ? rgb(ASPHALT) : conc, [0, 1, 0]);
            const thick = q => Math.min(1.1, Math.max(.05, q[1] - Y.road)), bottom = top.map(q => [q[0], q[1] - rise - thick(q), q[2]]);
            cell.solid.face4(...(up ? bottom.slice().reverse() : bottom), dark, [0, -1, 0]);
            if (rise) for (const [p, q] of [[top[0], top[1]], [top[2], top[3]]]) { const lo = v => [v[0], v[1] - rise, v[2]], L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1; cell.solid.face4(lo(p), lo(q), q, p, conc, [(q[2] - p[2]) / L, 0, -(q[0] - p[0]) / L]); cell.solid.face4(p, q, lo(q), lo(p), conc, [-(q[2] - p[2]) / L, 0, (q[0] - p[0]) / L]); } // (kerb faces, both ways)
            const poly = top.map(q => [q[0], q[2]]), plane = pts => (x, z) => { for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) { const a = pts[i], b = pts[j], c = pts[k], den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue; const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den; if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[1] + v * b[1] + (1 - u - v) * c[1]; } return pts.reduce((n, q) => n + q[1], 0) / 4; };
            const deck = { x: cx, z: cz, r: Math.max(...poly.map(q => Math.hypot(q[0] - cx, q[1] - cz))), poly, holes: [], roadDeck: true, kind: 'median-fill', medianKind: kind, estimated: true, edge: A.hit.st.e, caps: [[top[1], top[2]], [top[3], top[0]]],
                y0: Math.min(...bottom.map(q => q[1])), y1: Math.max(...top.map(q => q[1])), h: Math.max(...top.map(q => q[1])), roofHeightAt: plane(top), minHeightAt: plane(bottom) };
            sceneryDeckGrid.insert(cx - deck.r, cz - deck.r, cx + deck.r, cz + deck.r, deck); medianGrid.insert(cx - deck.r, cz - deck.r, cx + deck.r, cz + deck.r, deck); medianFill.decks.push(deck);
            medianFill.quads++; medianFill.areaM2 += Math.hypot(B.ox - A.ox, B.oz - A.oz) * (A.hit.t + B.hit.t) / 2;
        };
        for (const st of strips) for (const side of [1, -1]) {
            const w = st.half(side), dx = st.nx * side, dz = st.nz * side, at = q => { const ox = q[0] + dx * w, oz = q[1] + dz * w, top = st.topAt(ox, oz); return { st, ox, oz, top, hit: reach(st, ox, oz, dx, dz, top) }; };
            const ends = [at(st.a), at(st.b)];
            if (ends[0].hit && ends[1].hit) {
                // (owner, 2026-11-12, Grozavesti (80, -90) "random piece": one quad per segment cut straight across where the
                // neighbour's side steps in or out at a node, so a wedge between the fill and that carriageway stayed open
                // and the guard stood along it) the fill follows the neighbour's side in 2 m steps
                const L = Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]), n = Math.max(1, Math.ceil(L / 2)), rows = [ends[0]];
                for (let i = 1; i <= n; i++) { const f = i / n; rows.push(i === n ? ends[1] : at([st.a[0] + (st.b[0] - st.a[0]) * f, st.a[1] + (st.b[1] - st.a[1]) * f])); }
                // a ray that passes through the wedge between two of the neighbour's segments at a bend finds nothing: up to
                // three such rows between two that reach it take the line between those two
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i].hit) continue; let j = i; while (j < rows.length && !rows[j].hit) j++;
                    if (j < rows.length && j - i <= 3) for (let m = i; m < j; m++) { const f = (m - i + 1) / (j - i + 1), a = rows[i - 1].hit, b = rows[j].hit; rows[m].hit = { t: a.t + (b.t - a.t) * f, st: a.st, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, top: a.top + (b.top - a.top) * f }; }
                    i = j;
                }
                for (let i = 1; i < rows.length; i++) { const prev = rows[i - 1], cur = rows[i]; if (prev.hit && cur.hit && prev.hit.st.id > st.id && cur.hit.st.id > st.id) emit(prev, cur); }
                continue;
            }
            if (!ends[0].hit && !ends[1].hit) continue;
            // one end joined (two carriageways parting, or one ending beside the other): fill in 1 m steps while the neighbour is in reach
            const k0 = ends[0].hit ? 0 : 1, P0 = k0 ? st.b : st.a, P1 = k0 ? st.a : st.b, L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), n = Math.max(1, Math.ceil(L));
            // (r2, US districts: the neighbour reached first may be a short segment with a lower id while the rest of the run
            //  faces a long one with a higher id: the open slot between the Airport Expressway and its ramp. Per step there.)
            if (ends[k0].hit.st.id < st.id && !US) continue; // (each pair once, from its lower id)
            let prev = null;
            for (let i = 0; i <= n; i++) { const f = i / n, cur = at([P0[0] + (P1[0] - P0[0]) * f, P0[1] + (P1[1] - P0[1]) * f]); if (!cur.hit) break; if (prev && (!US || (prev.hit.st.id > st.id && cur.hit.st.id > st.id))) emit(prev, cur); prev = cur; }
        }
        medianFill.areaM2 = Math.round(medianFill.areaM2);
    }
    // ---- invisible collision walls: bridge railings, embankments, trench / tunnel retaining walls, motorway guard
    //      rails and median barriers. {ax, az, bx, bz, y0a, y1a, y0b, y1b, nx, nz, kind, edge}: the wall blocks a body
    //      whose height is within [y0, y1] (interpolated along the wall); (nx, nz) points toward the carriageway.
    const walls = [];
    return {
        RIB_ONLY, clearOf, kerbSpot, liftOnSide, medianFill, medianGrid, obbPoly, onRibbon,
        polyOnRibbon, raisedDeck, raisedTop, ribGrid, ribbonsAtLevel, segsCross, walls,
    };
}
