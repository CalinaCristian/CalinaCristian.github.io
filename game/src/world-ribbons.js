// ============================================================================
//  WORLD RIBBONS — junction pads, lamp / tree spots, road ribbons, deck folds, raised sidewalks and corners
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { displaceBridgeSurface } from './bridge-surface-mesh.js';
import { distPointSeg, pointInPolygon } from './util.js';
import { insetFootprint } from './building-parts.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { deckWalkSide } from './bridge-walkways.js';
import { buildMarkingStations, clipAffineMarkingRange, clipMarkingConvex, markingArea, markingDashIntervals, subtractMarkingConvex } from './road-markings.js';
import { BoxGrid, CLASS_RANK, convexHull, isMotorwayTrunk } from './world-shared.js';
import { buildEdgeRibbons } from './world-edge-ribbons.js';

export function buildRibbons(ctx) {
    const {
        US, asphaltBase, asphaltCorners, asphaltEnds, ballastCol, buildPool, cellOf, city,
        concreteCol, convexApart, corner, data, deckAudit, deckJobs, deckWorkers, edgeGrid,
        edges, edgesInBox, isConcrete, kerbCol, laneTapers, layerY, nodeArr, padHeightAt,
        railRoadside, researchTrees, retract, rng, roads, sharedBridgeMeshAudit, sideCol, sideExtra,
        str, tramGrades, white, widthAsphalt, widthKerb, widthSide, yAlong, yellow,
    } = ctx;
    const padCorners = new Map(); // node -> {road:[], side:[]}
    const pushPad = (n, kind, p) => { let o = padCorners.get(n); if (!o) padCorners.set(n, o = { road: [], side: [], y: 0 }); o[kind].push(p); };
    const markingStations = buildMarkingStations(edges, e => data.roadSourceGeometry?.[e.road]?.sourceId || e.access?.sourceId);

    const dashLine = (mb, e, s0, s1, off, y, col, dash, gap, hw) => {
        const step = dash + gap;
        const spans = gap > 0 ? markingDashIntervals(s0, s1, dash, gap, markingStations.get(e)) : Array.from({length:Math.ceil((s1-s0)/step)}, (_, i) => [s0+i*step, Math.min(s1,s0+i*step+dash)]);
        for (const [s, sEnd] of spans) {
            if (sEnd - s < 1e-7) continue;
            let ax = e.a.x + e.dirx * s + e.nx * off, az = e.a.z + e.dirz * s + e.nz * off;
            let bx = e.a.x + e.dirx * sEnd + e.nx * off, bz = e.a.z + e.dirz * sEnd + e.nz * off;
            // continuous lines follow the mitred strip: at a plain bend (degree-2, no pad) end on the mitre line
            if (gap === 0) {
                const mit = (n) => !n.pad && n.edges.length === 2 ? corner(e, n, off >= 0 ? 1 : -1, Math.abs(off), () => Math.abs(off)) : null;
                if (s < 0.05) { const q = mit(e.a); if (q) { ax = q[0]; az = q[1]; } }
                if (sEnd > e.len - 0.05) { const q = mit(e.b); if (q) { bx = q[0]; bz = q[1]; } }
            }
            mb.flatQuad(ax + e.nx * hw, az + e.nz * hw, bx + e.nx * hw, bz + e.nz * hw, bx - e.nx * hw, bz - e.nz * hw, ax - e.nx * hw, az - e.nz * hw, y, col, 0);
        }
    };
    const solidLine = (mb, e, s0, s1, off, y, col, hw) => { if (s1 - s0 > 0.2) dashLine(mb, e, s0, s1, off, y, col, Math.min(4, s1 - s0), 0, hw); }; // (4 m pieces: each is checked against other surfaces)
    const band = (mb, e, s0, s1, o0, o1, y, col) => {
        if (s1 - s0 < 0.2) return;
        const p = (s, o) => [e.a.x + e.dirx * s + e.nx * o, e.a.z + e.dirz * s + e.nz * o];
        const k = Math.max(1, Math.ceil((s1 - s0) / 6));
        for (let j = 0; j < k; j++) {
            const sa = s0 + (s1 - s0) * j / k, sb = s0 + (s1 - s0) * (j + 1) / k;
            const A = p(sa, o0), B = p(sb, o0), C = p(sb, o1), D = p(sa, o1);
            mb.flatQuad(A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1], y, col, 0);
        }
    };

    const lampSpots = [];
    const treeSpots = [];
    const zebraRects = []; // signalised-junction crossings drawn so far {e, rect}
    const convexOverlap = (A, B) => { // separating axis test, convex polygons [[x, z]…]
        for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
            const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], nx = bz - az, nz = ax - bx;
            let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
            for (const [x, z] of A) { const v = x * nx + z * nz; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
            for (const [x, z] of B) { const v = x * nx + z * nz; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
            if (a1 <= b0 || b1 <= a0) return false;
        }
        return true;
    };
    const ribbons = []; // carriageway polygons (asphalt incl. shoulder) of every edge + junction pads → definitive clearance checks
    const dash = US ? [3, 9] : [3, 5];
    // (spec 10 load budget) deck shaping results enter sharedBridgeMeshAudit in call order (foldDeckAudit), also those
    // shaped in the build workers (deferred: the range stays in its builder until finishDeckJobs splices the result in)
    const foldDeckAudit = () => {
        let n = 0;
        for (; n < deckAudit.length && deckAudit[n].a; n++) { const { a, context } = deckAudit[n];
            sharedBridgeMeshAudit.inputTriangles+=a.inputTriangles;sharedBridgeMeshAudit.outputTriangles+=a.outputTriangles;if(a.maxLeafControlErrorM>sharedBridgeMeshAudit.maxLeafControlErrorM)sharedBridgeMeshAudit.worstControl={...a.worstControl,...context};sharedBridgeMeshAudit.maxLeafControlErrorM=Math.max(sharedBridgeMeshAudit.maxLeafControlErrorM,a.maxLeafControlErrorM);sharedBridgeMeshAudit.depthLimit+=a.depthLimit;for(const sample of a.limitSamples)if(sharedBridgeMeshAudit.limitSamples.length<32)sharedBridgeMeshAudit.limitSamples.push({...sample,...context}); }
        deckAudit.splice(0, n);
    };
    const displace = (mb, from, fn, edge=null, fromIndex=null, worker=null) => {
        if(edge?.sourceBridgeGrade?.known){
            if(fromIndex===null){fromIndex=mb.ic;for(let k=0;k<mb.ic;k+=3)if(mb.i[k]>=from||mb.i[k+1]>=from||mb.i[k+2]>=from){fromIndex=k;break;}}
            const context={edgeId:edge.id,sourceId:edge.access?.sourceId||edge.sourceId};
            // in a worker: a deck whose triangles nothing reads before the join (no rail-roadside cut on its edge; a builder
            // without tiles), from the same input triangles and the same height model made from its spec
            if (worker && deckWorkers && edge.sourceBridgeGrade.workerSpec && !railRoadside.active(edge) && mb.ic > fromIndex) {
                const n = mb.ic - fromIndex, input = new Float64Array(n * 12), T = mb.t;
                for (let q = 0; q < n; q++) { const v = mb.i[fromIndex + q], k = q * 12; input[k] = mb.p[v * 3]; input[k + 1] = mb.p[v * 3 + 1]; input[k + 2] = mb.p[v * 3 + 2]; input[k + 3] = mb.n[v * 3]; input[k + 4] = mb.n[v * 3 + 1]; input[k + 5] = mb.n[v * 3 + 2]; input[k + 6] = mb.u[v * 2]; input[k + 7] = mb.u[v * 2 + 1]; input[k + 8] = mb.c[v * 3]; input[k + 9] = mb.c[v * 3 + 1]; input[k + 10] = mb.c[v * 3 + 2]; input[k + 11] = T ? T[v] : -1; }
                const job = { builder: mb, sv: from, ev: mb.vc, si: fromIndex, ei: mb.ic, input, fn, withTile: !!T, entry: { a: null, context } };
                job.promise = buildPool.deck(input, edge.sourceBridgeGrade.workerSpec, worker.verge ?? null, !!T, worker.scaleY ?? null);
                deckJobs.push(job); deckAudit.push(job.entry); return;
            }
            deckAudit.push({ a: displaceBridgeSurface(mb,from,fromIndex,fn), context }); foldDeckAudit(); return;
        }
        for (let i = from; i < mb.vc; i++) mb.p[i * 3 + 1] += fn(mb.p[i * 3], mb.p[i * 3 + 2]);
    };
    const raised = [];
    // (owner, 2026-11-11, Grozavesti (971, -1196) "seethrough", (939, -1179), "WITH PROPER BORDER/FENCE, NO SEETRHOUGH"; Street
    // View at 87 and 92 Soseaua Nicolae Titulescu and along the Pasajul west ramp: the low ends of the Basarab ramps stand on
    // solid concrete retaining walls, not on piers) a bridge-tagged ramp no higher than RETAIN_H and not over water is
    // retained fill: retaining walls on both sides down to the ground, an abutment where it meets the open viaduct, no
    // bents. Where a road really crosses beneath it, the walls stay open and the deck spans.
    // (owner, 2026-11-12, Grozavesti (933, -1180) "see through": the next ramp segment, 3.6-4.0 m up, was still an open viaduct
    // with under 3 m of clearance and the street behind showed through the slot below it; nothing passes beneath it.)
    const RETAIN_H = 4.5; // (Street View at 44.45084, 26.07040: the Basarab ramps are open viaducts with parking beneath at about 5-6 m; below about 4.5 m the deck stands on its walls)
    const retainedDeck = e => e.bridge && !e.virtual && !e.tunnel && !e.overWater && Math.max(e.ya, e.yb) > .25 && Math.max(e.ya, e.yb) <= RETAIN_H;
    const convexRing = (r) => { let sg = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b2 = r[(i + 1) % r.length], c2 = r[(i + 2) % r.length]; const cr = (b2[0] - a[0]) * (c2[1] - b2[1]) - (b2[1] - a[1]) * (c2[0] - b2[0]); if (Math.abs(cr) < 1e-6) continue; const t = cr > 0 ? 1 : -1; if (sg && t !== sg) return false; sg = t; } return true; };
    /** the outline offset inward by d (mitred), shrinking d until it is a clean polygon: { p, d } or null */
    const insetCache = new WeakMap();
    const insetRing = (r, area) => {
        if (!insetCache.has(r)) insetCache.set(r, insetFootprint(r, area));
        return insetCache.get(r);
    };
    const polyDist = (x, z, poly) => { let d = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distPointSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d); return d; };
    // ---- pass 1: every carriageway polygon (mitred at degree-2 nodes, cut back to the pad at junctions) and every
    //      junction pad (hull of the incoming ribbon corners), so pass 2 can keep kerbs / markings off any OTHER
    //      surface (dual carriageways that touch, slip lanes, pads): one visible surface per spot, no marking over it
    const ribPoly = new Map(), surfGrid = new BoxGrid(24), surfList = [];
    {
        const padPts = new Map();
        for (const e of edges) {
            if (e.virtual) continue;
            const [aR, bR, bL, aL] = asphaltCorners(e, widthAsphalt);
            const poly = [aR, bR, bL, aL]; ribPoly.set(e, poly);
            railRoadside.register(e, asphaltCorners(e, (f, sd) => sd > 0 ? f.wR : f.wL), asphaltCorners(e, widthSide));
            for (const [n, p, q] of [[e.a, aR, aL], [e.b, bR, bL]]) if (n.pad) { let o = padPts.get(n); if (!o) padPts.set(n, o = []); o.push(p, q); }
        }
        const ins = (o, poly) => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } Object.assign(o, { poly, x0, z0, x1, z1 }); surfGrid.insert(x0, z0, x1, z1, o); surfList.push(o); };
        for (const [e, poly] of ribPoly) ins({ e, h: (x, z) => yAlong(e, x, z) }, poly);
        for (const [n, pts] of padPts) if (pts.length >= 3) ins({ node: n, h: (x, z) => padHeightAt(n, x, z) }, convexHull(pts));
    }
    /** is (x, z) at height y well inside a road surface other than edge e's own ribbon? (inset m from its rim) */
    // prio (markings): where two carriageways overlap in plan (a ramp along its motorway at a split / merge, the two
    // directions of a road mapped too close), only the higher-class one (then the lower id) keeps its markings, so the
    // overlap reads as one road with one set of lines instead of a slab with none (review #3 / #4); pads always win
    const markWins = (e, f) => { if (Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.94) return false; const re = CLASS_RANK[e.type] || 0, rf = CLASS_RANK[f.type] || 0; return re !== rf ? re > rf : e.id < f.id; }; // (near-parallel overlaps only: a road crossing at grade keeps its mouth clear)
    const coveredByOther = (x, z, e, y, inset = 0.25, prio = false, maxDY = 1) => {
        let hit = false;
        surfGrid.each(x, z, x, z, (o) => {
            if (hit || o.e === e || x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) return;
            const dy = o.h(x, z) - y;
            if (Math.abs(dy) > maxDY || !pointInPolygon(x, z, o.poly) || polyDist(x, z, o.poly) < inset) return;
            // Paint belongs to the visible pavement. Class/id priority only decides nearly level overlaps;
            // a lower ribbon cannot win that priority and leave its paint buried in the upper surface.
            if (prio && o.e && (dy < -0.01 || (dy <= 0.01 && markWins(e, o.e)))) return;
            hit = true;
        });
        return hit;
    };
    // Retain the prior point policy for non-affine pad/profile exceptions. The
    // usual affine or flat surfaces below are clipped as polygons, so a centre
    // outside the ribbon cannot discard the valid end of a line or zebra stripe.
    const onOwn = (e, x, z, tol = 0.05) => { const p = ribPoly.get(e); return !p || pointInPolygon(x, z, p) || polyDist(x, z, p) < tol; };
    const legacyMarkProxy = (mb, e) => ({
        flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS, depth = 0) {
            const cx = (x0 + x1 + x2 + x3) / 4, cz = (z0 + z1 + z2 + z3) / 4;
            const qa = depth ? 0 : Math.abs((x2 - x0) * (z3 - z1) - (x3 - x1) * (z2 - z0)) / 2; if (qa) e._mkAll = (e._mkAll || 0) + qa; // (stats: share dropped per edge)
            if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), 0.15, true)) { if (qa) e._mkDrop = (e._mkDrop || 0) + qa; return; }
            const ok = (x, z) => onOwn(e, x, z) && !coveredByOther(x, z, e, yAlong(e, x, z), 0.15, true);
            if (!(ok(x0, z0) && ok(x1, z1) && ok(x2, z2) && ok(x3, z3))) {
                const dropQ = () => { e._mkOut = (e._mkOut || 0) + Math.abs((x2 - x0) * (z3 - z1) - (x3 - x1) * (z2 - z0)) / 2; };
                if (!onOwn(e, cx, cz) && depth > 0) { dropQ(); return; }
                if (depth >= 3 || Math.hypot(x1 - x0, z1 - z0) < 0.5) { dropQ(); return; }
                const ax = (x0 + x1) / 2, az = (z0 + z1) / 2, bx = (x2 + x3) / 2, bz = (z2 + z3) / 2;
                this.flatQuad(x0, z0, ax, az, bx, bz, x3, z3, y, col, uvS, depth + 1);
                this.flatQuad(ax, az, x1, z1, x2, z2, bx, bz, y, col, uvS, depth + 1);
                return;
            }
            mb.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS);
        },
    });
    // the reach of clipMarkingHalfPlane's tolerance (1e-10 of edge length × distance) around a surface polygon, with room
    const surfMargins = new WeakMap(), surfMargin = o => { let m = surfMargins.get(o); if (m === undefined) { let L = Infinity; for (let i = 0; i < o.poly.length; i++) { const a = o.poly[i], b = o.poly[(i + 1) % o.poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l >= 1e-10) L = Math.min(L, l); } m = Number.isFinite(L) ? Math.max(1e-6, 4e-10 / L) : Infinity; surfMargins.set(o, m); } return m; };
    const markProxy = (mb, e) => ({
        flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS) {
            this.flatPolygon([[x0,z0],[x1,z1],[x2,z2],[x3,z3]],y,col,uvS);
        },
        flatPolygon(input,y,col,uvS) {
            const own=ribPoly.get(e), area=markingArea(input);
            const kept=own?clipMarkingConvex(input,own):input, ownedArea=markingArea(kept), blockers=[]; let seen=null;
            if(kept.length){
                const xs=kept.map(p=>p[0]),zs=kept.map(p=>p[1]);let unsupported=false;
                const kx0=Math.min(...xs),kz0=Math.min(...zs),kx1=Math.max(...xs),kz1=Math.max(...zs);
                surfGrid.each(kx0,kz0,kx1,kz1,o=>{
                    if(o.e===e)return;
                    // (spec 10 load budget) the clip keeps only points within its tolerance of every edge of o.poly (shrunk by
                    // the inset): bounds farther apart than that tolerance leave no region, as clipMarkingConvex finds. A pure
                    // test of o, so it comes before the duplicate check (the Set is made for the first surface that passes)
                    const m=surfMargin(o);if(kx0>o.x1+m||kx1<o.x0-m||kz0>o.z1+m||kz1<o.z0-m)return;
                    if(!seen)seen=new Set();else if(seen.has(o))return;seen.add(o);
                    const region=clipMarkingConvex(kept,o.poly,o.e ? .15 : 0);if(!region.length)return;
                    const low=o.e?(markWins(e,o.e) ? .01 : -.01):-1;
                    const blocked=clipAffineMarkingRange(region,p=>o.h(p[0],p[1])-yAlong(e,p[0],p[1]),low,1);
                    if(blocked===null)unsupported=true;else if(blocked.length)blockers.push(blocked);
                });
                if(unsupported){e._mkFragmentFallback=(e._mkFragmentFallback||0)+1;const legacy=legacyMarkProxy(mb,e);for(let i=1;i<input.length-1;i++){const[a,b,q]=[input[0],input[i],input[i+1]];legacy.flatQuad(...a,...b,...q,...q,y,col,uvS);}return;}
            }
            let fragments=kept.length?[kept]:[];
            for(const blocker of blockers)fragments=fragments.flatMap(p=>subtractMarkingConvex(p,blocker));
            const emittedArea=fragments.reduce((sum,p)=>sum+markingArea(p),0);
            e._mkAll=(e._mkAll||0)+area;e._mkOut=(e._mkOut||0)+Math.max(0,area-ownedArea);e._mkDrop=(e._mkDrop||0)+Math.max(0,ownedArea-emittedArea);
            for(const polygon of fragments)mb.flatFan(polygon,y,col,uvS);
        },
    });
    // (2026-11-08, owner: "parked cars look sunk", then "do the sidewalks") sidewalks at the kerb's height
    // (Y.road + Y.kerb) instead of 0.22 m below it — the top of every sidewalk band, the junction corners between them, the
    // physics (surfacesAt → walkers, the car mounting a kerb), the crowd and everything standing on a sidewalk (DY_SIDE)
    // (a deck walkway, bridge-walkways.js: the sidewalk a mapped footway puts on a raised deck is raised too, on any road class)
    const raisedEdge = (e, side = null) => !e.virtual && (side == null ? Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) : sidewalkWidth(e, side)) > 0.3 && !e.tunnel && (e.deckWalk ? side == null || deckWalkSide(e, side) > 0 : !isMotorwayTrunk(e.type) && !e.bridge);
    // (edge ribbons: world-edge-ribbons.js)
    const __buildEdgeRibbons = buildEdgeRibbons({
        RETAIN_H, US, asphaltBase, asphaltEnds, ballastCol, band, cellOf, city,
        concreteCol, convexApart, convexOverlap, corner, coveredByOther, dash, dashLine, data,
        displace, edgeGrid, edges, edgesInBox, isConcrete, kerbCol, lampSpots, laneTapers,
        layerY, markProxy, nodeArr, pushPad, railRoadside, raised, raisedEdge, researchTrees,
        retainedDeck, retract, ribPoly, ribbons, rng, roads, sharedBridgeMeshAudit, sideCol,
        sideExtra, solidLine, str, surfGrid, tramGrades, treeSpots, white, widthAsphalt,
        widthKerb, widthSide, yAlong, yellow, zebraRects,
    });
    const {
        DY_SIDE, SIDE_BACK, cornerGrid, cornerPolys, cornerSkips, parapetOwnership, sideJoins,
    } = __buildEdgeRibbons;
    return {
        DY_SIDE, SIDE_BACK, convexRing, cornerGrid, cornerPolys, cornerSkips, coveredByOther, displace,
        foldDeckAudit, insetRing, lampSpots, padCorners, parapetOwnership, polyDist, raised, raisedEdge,
        retainedDeck, ribPoly, ribbons, sideJoins, surfGrid, surfList, treeSpots, get raisedPieces() { return __buildEdgeRibbons.raisedPieces; },
    };
}
