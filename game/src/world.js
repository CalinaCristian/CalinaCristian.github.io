import { prepareSmallWaterGroups, waterOwnerSurface, landmarkWaterSurfaces, combineUnderpassWaterOwners } from './final-water-topology.js';
import { buildUnderpassOwnerIndex } from './underpass-ground-owner.js';
import { sharedBridgePadSurface } from './bridge-pad-profile.js';

import { shapeDeckSoup } from './bridge-surface-mesh.js';
import * as THREE from '../vendor/three.module.min.js';
import { clamp, distPointSeg, pointInPolygon } from './util.js';
import { triangulate } from './triangulate.js';
import { clipInferredBuildingDetail } from './building-detail-visibility.js';
import { rgb } from './geobuild.js';
import { sourceSidewalkSides, sidewalkWidth } from './sidewalk-source.js';
import { roadMiter, needsRoadBevelPad } from './road-joins.js';
import { buildSourceBoundarySupport } from './district-boundary.js';

import { dropMedianLinkSidewalks } from './sidewalk-overlap.js';
import { assignBridgeWalkways, deckWalkShiftAt, deckWalkSide } from './bridge-walkways.js';
import { Y, convexHull, shoulderOf } from './world-shared.js';
import { buildLandmarkGrounds } from './world-landmark-grounds.js';
import { buildBuildingsLandmarks } from './world-buildings.js';
import { buildSideJoins } from './world-side-joins.js';
import { buildRibbons } from './world-ribbons.js';
import { buildRoadGraphAids } from './world-road-graph.js';
import { buildPaintSetup } from './world-paint-setup.js';
import { buildLevelSolver } from './world-levels.js';
import { buildWallsBarriers } from './world-walls.js';
import { buildWorldApi } from './world-api.js';
import { buildWorldFinish } from './world-finish.js';
import { buildStreetscape } from './world-streetscape.js';
import { buildFacadeDetail } from './world-facade-detail.js';
import { buildPois } from './world-pois.js';
import { makeDressSports } from './world-sports.js';
import { buildRaisedEdges } from './world-raised-edges.js';
import { buildAreasWater } from './world-areas-water.js';
import { buildBridgeTramSignals } from './world-bridge-tram-signals.js';
import { loadDistrictGraph } from './world-district-graph.js';
import { layContraflowLanes } from './contraflow-bus.js';

// ============================================================================
//  WORLD — builds the 3D city from OpenStreetMap data (game/data/<city>-<district>.bin.gz,
//  produced by tools/osm/build-data.mjs; schema documented there and in
//  game/data/README.md).
//
//  Public API (used by main.js / traffic.js / nav.js / minimap.js / player.js):
//    world.group, world.graph {nodes (object by id), edges []}, world.nearestEdge(x,z),
//    world.edgesInBox(x0,z0,x1,z1,cb), world.lightState(nodeId, edge, time, cycle),
//    world.updateLights(time, cycle), world.buildings (collision list with .query),
//    world.pois, world.isWater(x,z), world.isPark(x,z), world.bounds, world.districts,
//    world.areas, world.landmarks, world.sky, world.waterMesh, world.stats
//    world.roadHeight(x, z, { y, edge })  surface height near the body's level (bridges never snap)
//    world.surfacesAt(x, z), world.walls (railings / embankments / trench walls / guard rails / barriers,
//      also in world.buildings; collideBuildings(list, x, z, r, y) gates them by height),
//    world.onRibbon(x, z, r), world.ribbons, world.audit(), world.trafficProfile(hour, {cls, weekend}),
//    world.vegetation {treeCrownMeshes, treeTrunkMeshes, deciduousMask, grassMaterials, groundMaterials, roofMaterials}
// ================================================================================

// (spec 10 load budget) start the build workers now, so they are loaded before the first district is built

// ===========================================================================
//  BUILD
// ===========================================================================
export async function buildWorld(city, renderer, opts = {}) {
    // (district graph: world-district-graph.js)
    const {
        EG, US, buildPool, country, data, distCfg, distId, earlyAtlas,
        edgeGrid, edges, env, group, inDistrictLL, nodeArr, nodes, researchTrees,
        rng, roads, sceneryDeckGrid, str, t0,
    } = await loadDistrictGraph({
        city, opts,
    });
    let surfCells = null;
    // (world road graph: world-road-graph.js)
    const __buildRoadGraphAids = buildRoadGraphAids({
        EG, data, distCfg, edgeGrid, edges, nodeArr, str,
    });
    const {
        CLEAR, GRADE, coveredRoadModels, crossings, edgesInBox, laneTapers, nearestEdge, sideExtra,
        trams,
    } = __buildRoadGraphAids; // {u (upper), f (lower), x, z}
    let profileStats = null, profileStats0 = null, blocksLane = null; const wallCut = { n: 0 }; // (wallCut: pieces cut out of walls, a counter object)
    // (world levels: world-levels.js)
    const __buildLevelSolver = buildLevelSolver({
        CLEAR, GRADE, asphaltCorners, city, corner, crossings, data, distId,
        edges, edgesInBox, nodeArr, profileStats0, profileStats,
    });
    profileStats0 = __buildLevelSolver.profileStats0;
    profileStats = __buildLevelSolver.profileStats;
    // (bridge profiles, tram grades, signals: world-bridge-tram-signals.js)
    const __buildBridgeTramSignals = buildBridgeTramSignals({
        asphaltCorners, city, corner, coveredRoadModels, data, edges, nodeArr, nodes,
        profileStats, rng,
    });
    const {
        basarabBlue, bridgeJunctionAudit, bridgeJunctionDecks, clusters, deckAudit, deckJobs, padHeightAt, railRoadside,
        railRoadsideCaps, sharedBridgeMeshAudit, sharedBridgeProfile, sourceBridgeDescents, tramDecks, tramGrades, tramPropEnvelope, yAlong,
    } = __buildBridgeTramSignals;
    // (areas and water: world-areas-water.js)
    const __buildAreasWater = await buildAreasWater({
        US, city, data, distCfg, distId, edges, env, nodes,
        str, tramGrades,
    });
    const {
        CHAN, areaColors, areas, bigWater, bounds, builderEpoch, bx0, bx1,
        bz0, bz1, cellOf, cells, channelAreas, channelCuts, convexApart, coveredWater,
        cutTrenches, fountainBasinColl, graph, groundCutsAt, inArea, isPark, isWater, landmarkPits,
        meadowFills, nearWater, pad, signMB, sweptOut, tramSweep, tramSweepConflicts, trenchQuads,
        waterChannelAudit, waterGrid, waterOutlineAudit,
    } = __buildAreasWater;
    // (pipera-2) the land inside a narrowed coarse water outline is the meadow OSM maps there: one grass layer under the
    // mapped grass / meadow polygons, cut over the river band like any ground layer (sunken-lakes.js)
    for (const ring of meadowFills) {
        let { pts, tris } = triangulate(ring, []); ({ pts, tris } = cutTrenches(pts, tris)); if (!tris.length) continue;
        let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x / ring.length; cz += z / ring.length; }
        cellOf(cx, cz).grass.flatPoly(pts, tris, Y.grass - 0.004, rgb(areaColors.grass), 0.1);
    }
    // sports grounds (2026-11-08): line markings, goals, tennis nets and court fences, basketball hoops, pool copings on
    // the pitch / turf / clay / hard / pool areas — they were flat coloured patches. The court is fitted with the
    // smallest-area rectangle of its outline (skipped when the outline is not rectangular enough); everything is visual.
    let pitchesDressed = 0;
    const sportAreaLog = []; // (sport-areas.js: grounds dressed by their own OSM sport tag)
    const sportsColl = [];
    // (world paint setup: world-paint-setup.js)
    const __buildPaintSetup = await buildPaintSetup({
        CHAN, US, areas, cellOf, channelAreas, city, cutTrenches, data,
        distId, env, groundCutsAt, inArea, nodeArr, waterGrid,
    });
    const {
        ASPHALT, asphaltBase, asphaltEnds, ballastCol, concreteCol, isConcrete, kerbCol, layerY,
        padAsphalt, railCol, sideCol, waterLineAudit, white, yellow,
    } = __buildPaintSetup;
    function isPadNode(n) {
        if (n.shortBendPad) return true;
        if (n.edges.length !== 2) return n.edges.length >= 3;
        const [e1, e2] = n.edges;
        const d1x = e1.b === n ? e1.dirx : -e1.dirx, d1z = e1.b === n ? e1.dirz : -e1.dirz; // e1 travelling into n
        const d2x = e2.a === n ? e2.dirx : -e2.dirx, d2z = e2.a === n ? e2.dirz : -e2.dirz; // e2 leaving n
        return d1x * d2x + d1z * d2z < 0.35 || needsRoadBevelPad(e1, e2, n, (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e) + sideExtra(e, s, e.a === n ? 0 : e.len)); // sharp turn / infeasible width transition → bevel pad
    }
    for (const n of nodeArr) n.pad = n.edges.length ? isPadNode(n) : false;
    // (owner, 2026-11-15, Grozavesti, the Basarab overpass: "lines should be continouse") a pad where one road only goes on
    // (two edges, nothing else meeting, a bend under ~45°: a width change or a short bend) is no junction for the paint:
    // lane and edge lines run on to the node instead of stopping short of the pad (up to 45% of each 9 m piece was bare)
    for (const n of nodeArr) {
        n.passPad = false; if (!n.pad || n.edges.length !== 2 || (n.allEdges && n.allEdges.length !== 2)) continue;
        const [e1, e2] = n.edges;
        const d1x = e1.b === n ? e1.dirx : -e1.dirx, d1z = e1.b === n ? e1.dirz : -e1.dirz, d2x = e2.a === n ? e2.dirx : -e2.dirx, d2z = e2.a === n ? e2.dirz : -e2.dirz;
        n.passPad = d1x * d2x + d1z * d2z >= 0.7 && !e1.virtual && !e2.virtual;
    }
    // (owner, 2026-11-15, Bellevue: "lanes, roads") a driveway is no junction for the through road's paint either: where only
    // service ways (garage / parking entrances) meet a road that goes straight on, with no signal, stop or crossing there,
    // the lane and edge lines run on to the node (world-edge-ribbons.js breaks the edge line across the driveway mouth).
    // NE 8th St had bare stretches between garage entrances: (-231 … -255, -331) 24 m with no line at all, 40 m elsewhere.
    const linkPass = !!distCfg?.junctionFills;
    for (const n of nodeArr) {
        n.drivewayPass = null; if (!n.pad || n.passPad || n.edges.length < 3 || n.hasLight || n.stop || n.giveWay || n.zebra || n.crossing) continue;
        if (n.edges.some(e => e.virtual)) continue;
        // (owner backlog, 2026-11-15, Bellevue, NE 8th St at the I-405 ramps (544, -306 / -320): 25 m of each carriageway bare
        // where the ramps leave and join) a district with `junctionFills` (cities.js) treats a ramp (a *_link way) leaving or
        // joining a road that goes straight on, with no signal, stop or crossing there, as such a mouth too
        const side = e => e.type === 'service' || (linkPass && /_link$/.test(e.type || ''));
        const through = n.edges.filter(e => !side(e)), drives = n.edges.filter(side);
        if (through.length !== 2 || !drives.length) continue;
        const [e1, e2] = through, into = (e) => e.b === n ? [e.dirx, e.dirz] : [-e.dirx, -e.dirz];
        const [d1x, d1z] = into(e1), [d2x, d2z] = into(e2);
        if (-(d1x * d2x + d1z * d2z) < 0.8 || e1.oneway !== e2.oneway) continue; // straight on (e2 travelled out of n)
        n.drivewayPass = { through, drives };
    }
    function retract(e, n) { return ((n.pad ?? isPadNode(n)) && (n.allEdges || n.edges).length >= 2 ? Math.min(n.radius, e.len * 0.45) : 0); }
    /**
     * corner point of edge e at node n on side s (+1 = right of a→b, -1 = left) at lateral distance w (≥0) from the centreline;
     * at degree-2 nodes the corner is mitred with the other edge (whose matching width is wOther).
     */
    // Hoisted: the profile clearance floor and rendered pavement use the same mitred footprint.
    function corner(e, n, s, w, wOtherFn) {
        w += sideExtra(e, s, e.a === n ? 0 : e.len); // (a lane-drop taper: see laneTapers)
        const out = e.a === n ? 1 : -1;
        const r = retract(e, n);
        const bx = n.x + e.dirx * out * r, bz = n.z + e.dirz * out * r;
        const px = bx + e.nx * s * w, pz = bz + e.nz * s * w;
        if ((n.pad ?? isPadNode(n)) || n.edges.length !== 2) return [px, pz];
        const f = n.edges[0] === e ? n.edges[1] : n.edges[0];
        const same = (e.b === n && f.a === n) || (e.a === n && f.b === n);
        const sf = same ? s : -s;
        // (bridge-walkways.js) a deck walkway that does not go on along the next edge ends square at the node: neither its
        // outline nor the next edge's is mitred with the other (only widths that include the walkway: the asphalt still is)
        if ((deckWalkSide(e, s) > 0) !== (deckWalkSide(f, sf) > 0) && (deckWalkSide(e, s) > 0 ? w - (s > 0 ? e.wR : e.wL) - shoulderOf(e) - sideExtra(e, s, e.a === n ? 0 : e.len) : wOtherFn(f, sf) - (sf > 0 ? f.wR : f.wL) - shoulderOf(f)) > .5) return [px, pz];
        const wf = wOtherFn(f, sf) + sideExtra(f, sf, f.a === n ? 0 : f.len);
        const qx = n.x + f.nx * sf * wf, qz = n.z + f.nz * sf * wf;
        const join = roadMiter(e, f, n, [px, pz], [qx, qz], Math.max(w, wf));
        // Asphalt infeasibility is handled by the shared pad above, retaining
        // full source cross-sections. Wider sidewalk bands retain their bevel.
        return join.feasible ? join.point : [(px + qx) / 2, (pz + qz) / 2];
    }
    function asphaltCorners(e, width) {
        const aR = corner(e, e.a, 1, width(e, 1), width), aL = corner(e, e.a, -1, width(e, -1), width);
        const bR = corner(e, e.b, 1, width(e, 1), width), bL = corner(e, e.b, -1, width(e, -1), width);
        for (const [P, Q] of [[aR, bR], [aL, bL]]) if ((Q[0] - P[0]) * e.dirx + (Q[1] - P[1]) * e.dirz < 1e-7) { const mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2; P[0] = Q[0] = mx; P[1] = Q[1] = mz; }
        return [aR, bR, bL, aL];
    }
    for (const e of edges) {
        e.sidewalkSource = sourceSidewalkSides(data, e);
        e.sidewalkRightM = e.sidewalkSource.rightM; e.sidewalkLeftM = e.sidewalkSource.leftM;
    }
    const medianLinkSidewalks = dropMedianLinkSidewalks(edges, edgesInBox, shoulderOf); // (r3 bellevue-3: no inferred walkway on a median turn lane, sidewalk-overlap.js)
    // (owner, 2026-11-12, Grozavesti (194, -453): the Orhideelor entry ramp's retaining wall stood 1.5 m inside the street's
    // lane; Street View at 44.44529, 26.06167: the ramp's barrier stands at the street's edge, no walkway on that side) a
    // raised carriageway running parallel beside a street at grade, closer than their two widths, loses the walkway on that
    // side and narrows that side (lanes down to 2.6 m) so its wall stands at the street's edge
    {
        let narrowed = 0, splitWalkways = 0; const rampTaperRecs = distCfg?.rampTapers ? [] : null, giveWay = rampTaperRecs ? [] : null;
        for (const e of edges) {
            if (e.virtual || e.tunnel || !(Math.max(e.ya, e.yb) > .3) || (e.ya + e.yb) / 2 > 4.5 || e.roadWidthSource) continue; // (low enough to stand on its walls: a higher deck passes over the street)
            for (const sd of [1, -1]) {
                let gap = Infinity, splitGap = Infinity, gapF = null, gapFs = 0;
                for (const t of [.2, .5, .8]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t, raisedHere = e.ya + (e.yb - e.ya) * t > .3;
                    edgesInBox(x - 12, z - 12, x + 12, z + 12, f => {
                        if (f === e || f.virtual || f.tunnel || f.bridge || Math.max(Math.abs(f.ya), Math.abs(f.yb)) > .3 || Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) < .9) return;
                        const partner = f.a === e.a || f.a === e.b || f.b === e.a || f.b === e.b;
                        if (partner && !raisedHere) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= .02 || q.t >= .98) return;
                        if (((q.cx - x) * e.nx + (q.cz - z) * e.nz) * sd <= 0) return; // (on this side)
                        const fSide = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? f.wR : f.wL;
                        if (partner) splitGap = Math.min(splitGap, q.d - fSide - shoulderOf(f)); else if (q.d - fSide - shoulderOf(f) < gap) { gap = q.d - fSide - shoulderOf(f); gapF = f; gapFs = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? 1 : -1; }
                    });
                }
                const key = sd > 0 ? 'wR' : 'wL', have = e[key] + shoulderOf(e) + sidewalkWidth(e, sd);
                // (owner, 2026-11-15, Grozăvești (495, -653) "looks odd": the Calea Plevnei ramp up to the Basarab overpass splits
                // from the street at one node and rises beside it; its inferred 3.5 m walkway lay over the street's left lane, a
                // pale raised strip with a kerb and a retaining wall standing in the lane) a street sharing the split node is
                // measured too, but only where the ramp is already raised; it takes the walkway on that side, never the lanes
                // (beside the split the two always touch)
                if (!(gap < have - .05)) {
                    if (splitGap < have - .05 && sidewalkWidth(e, sd) > 0 && !e.sidewalkSource?.explicit) { if (sd > 0) e.sidewalkRightM = 0; else e.sidewalkLeftM = 0; splitWalkways++; }
                    continue;
                }
                if (sd > 0) e.sidewalkRightM = 0; else e.sidewalkLeftM = 0;
                const lanes = Math.max(1, e.lanesF + e.lanesB), other = sd > 0 ? e.wL : e.wR, minSide = Math.max(1.3, 2.6 * lanes - other);
                const nw = Math.max(minSide, gap - shoulderOf(e));
                if (giveWay && gapF && gapF.oneway && gapF.type === 'motorway_link' && gapF.dirx * e.dirx + gapF.dirz * e.dirz > 0 && !gapF.roadWidthSource && gap - shoulderOf(e) < minSide - .05) giveWay.push({ f: gapF, sd: gapFs, rem: minSide + shoulderOf(e) - gap, e });
                if (nw < e[key] - .05) { if (rampTaperRecs) rampTaperRecs.push({ e, sd, to: nw }); e[key] = nw; e.laneW = Math.min(e.laneW, (e.wL + e.wR) / lanes); if (e.oneway) e.median = -2 * e.wL; layContraflowLanes(e); e.halfW = Math.max(e.wL, e.wR); }
                narrowed++;
            }
        }
        // (owner, 2026-11-15, SeaTac (-953, 995): "borders in th emiddle of the road", "lanes are drawn badly") each edge of a
        // ramp is narrowed by its own three samples, so Exit → Return To Terminal (w369422790), leaving Arrivals Drive at a
        // narrow split, went 3.7, 1.5, 2.4, 3.7 m on its right edge by edge: the kerb, its wall and every lane line stepped at
        // each node. A district with `rampTapers` (cities.js) narrows such a ramp once. From a split (the ramp's at-grade
        // first edges overlap the street even more) it keeps the narrowest width any edge needed, never wider than a later
        // edge allows; elsewhere it closes in over the 10 m before the first narrowed edge. After the last one it widens
        // back over at least 10 m. The width varies along an edge as a lane-drop taper does (e.taperR; the lane lines follow
        // it, world-edge-ribbons.js). Only a right-hand side (taperR); a left-hand one keeps the per-edge widths.
        if (rampTaperRecs?.length) {
            const recOf = new Map(); for (const r of rampTaperRecs) if (r.sd > 0) recOf.set(r.e, r);
            const lanesOf = e => Math.max(1, e.lanesF + e.lanesB);
            const along = (e, dir) => { const n = dir > 0 ? e.b : e.a, es = n.edges.filter(g => !g.virtual); if (es.length !== 2) return null; const g = es[0] === e ? es[1] : es[0]; return g.road === e.road && (dir > 0 ? g.a === n : g.b === n) ? g : null; };
            const done = new Set(); let tapered = 0;
            for (const r of rampTaperRecs) {
                if (r.sd < 0 || done.has(r.e)) continue;
                let first = r.e; for (let p = along(first, -1); p && recOf.has(p) && !done.has(p); p = along(first, -1)) first = p;
                const run = []; for (let c = first; c && recOf.has(c) && !done.has(c); c = along(c, 1)) run.push(c);
                for (const c of run) done.add(c);
                // the at-grade start of the ramp back to its split (at most 30 m); else the edges it closes in over; the edges it widens back over
                const head = []; let headM = 0; for (let p = along(first, -1); p && Math.max(p.ya, p.yb) <= .3 && !recOf.has(p) && headM + p.len <= 30; p = along(p, -1)) { head.unshift(p); headM += p.len; }
                if (head.length && (head[0].a.edges.filter(g => !g.virtual).length < 3)) head.length = 0; // (only from a split / junction)
                const lead = []; let leadM = 0; if (!head.length) for (let p = along(first, -1); p && !recOf.has(p) && leadM < 10; p = along(p, -1)) { lead.unshift(p); leadM += p.len; }
                const tail = []; let tailM = 0; for (let c = along(run[run.length - 1], 1); c && !recOf.has(c) && tailM < 10; c = along(c, 1)) { tail.push(c); tailM += c.len; }
                const chain = [...lead, ...head, ...run, ...tail];
                if (!tail.length || (!head.length && !lead.length) || chain.some(c => c.taperR || c.roadWidthSource || !c.oneway)) continue;
                const k0 = lead.length, k1 = k0 + head.length + run.length;
                // node k (the start of chain[k]) takes the narrowest width a narrowed edge beside it allows, and none further on
                // is narrower; the lead closes in to it and the tail widens back to the full width
                const wAt = [];
                for (let k = 0; k <= k1; k++) wAt.push(Math.min(...[chain[k - 1], chain[k]].filter(c => c && recOf.has(c)).map(c => c.wR)));
                for (let k = k1 - 1; k >= k0; k--) wAt[k] = Math.min(wAt[k], wAt[k + 1]);
                if (k0) { const from = lead[0].wR; let s = 0; for (let k = 0; k < k0; k++) { wAt[k] = from + (wAt[k0] - from) * s / leadM; s += lead[k].len; } }
                const full = tail[tail.length - 1].wR;
                let s = 0; for (let k = k1; k < chain.length; k++) { s += chain[k].len; wAt.push(wAt[k1] + (full - wAt[k1]) * Math.min(1, s / tailM)); }
                for (let k = 0; k < chain.length; k++) {
                    const c = chain[k], wa = Math.min(c.wR, wAt[k]), wb = Math.min(c.wR, wAt[k + 1]), base = Math.min(wa, wb);
                    c.wR = base; c.taperR = Math.max(wa, wb) - base > 1e-3 ? [wa - base, wb - base] : null; c.rampTaper = true; if (k >= k0 && k < k1) c.sidewalkRightM = 0;
                    c.laneW = Math.min(c.laneW, (c.wL + c.wR) / lanesOf(c)); if (c.oneway) c.median = -2 * c.wL; layContraflowLanes(c); c.halfW = Math.max(c.wL, c.wR + (c.taperR ? Math.max(...c.taperR) : 0));
                }
                tapered++;
            }
            if (tapered) { narrowed = narrowed || tapered; __buildRoadGraphAids.sccInfo.rampTapers = tapered; }
        }
        // (owner backlog, 2026-11-15, SeaTac: "Ramp w31928834 overlaps w31928843 by ~1 m") where the raised ramp is already at
        // its narrowest (lanes 3.15 m) and still stands on the ramp beside it at grade, going the same way (w31928834 coming down
        // beside w31928843: their ways run 5.6–5.8 m apart over 40 m, which leaves room for 1 + 2 lanes and no shoulders
        // between them), the street gives way for the rest: its facing side narrows by what is left (lanes down to 2.6 m) on
        // that segment and on to where the two roads meet, together, and the step where that begins is tapered (world.js
        // `kerbTapers`, which takes such a road in). MODEL: lane widths and shoulders are estimates; no mapped width is changed.
        if (giveWay?.length) {
            const want = new Map(); for (const g of giveWay) { const k = g.f; const w = want.get(k); if (!w || g.rem > w.rem) want.set(k, g); }
            for (const { f, sd, rem, e } of want.values()) {
                const key = sd > 0 ? 'wR' : 'wL', meets = n => n.edges.some(h => h.road === e.road);
                for (let c = f, k = 0; c && k < 12; k++) {
                    const lanes = Math.max(1, c.lanesF + c.lanesB), other = sd > 0 ? c.wL : c.wR, nw = Math.max(1.3, 2.6 * lanes - other, c[key] - rem);
                    if (nw < c[key] - .05) { c[key] = nw; c.laneW = Math.min(c.laneW, (c.wL + c.wR) / lanes); if (c.oneway) c.median = -2 * c.wL; layContraflowLanes(c); c.halfW = Math.max(c.wL, c.wR); c.gaveWay = true; narrowed++; }
                    if (meets(c.b)) break;
                    const nx = c.b.edges.filter(h => h !== c && !h.virtual && h.a === c.b && h.road === c.road); c = nx.length === 1 ? nx[0] : null;
                }
            }
            __buildRoadGraphAids.sccInfo.gaveWayBesideRamp = [...want.values()].map(g => ({ sourceId: data.roadSourceGeometry?.[g.f.road]?.sourceId, besideOf: data.roadSourceGeometry?.[g.e.road]?.sourceId, m: +g.rem.toFixed(2) }));
        }
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.raisedBesideStreet = narrowed; }
        if (splitWalkways) __buildRoadGraphAids.sccInfo.raisedBesideSplitStreet = splitWalkways;
    }
    // (owner, 2026-11-15, Pipera (-1284, 9, 85) "lanes missplaced? conflicting") a divided road OSM maps as two one-way ways
    // closer than their modelled widths (Șos. Pipera w8063802 / w1443263022: centre lines 5.9 m apart, 2 lanes each, drawn
    // 2 × 3.5 m) overlapped by a metre: each carriageway's edge line ran inside the other's lane, under its cars. The two
    // facing sides are narrowed to meet on the line midway between the ways (lanes down to 2.6 m), so paint, lanes and traffic
    // stay on each way's own half. MODEL: lane widths are estimates; a way with a mapped or reviewed width is left alone.
    {
        let narrowed = 0; const touched = new Set();
        for (const e of edges) {
            if (!e.oneway || e.virtual || e.tunnel || e.bridge || Math.max(Math.abs(e.ya), Math.abs(e.yb)) > .3 || e.roadWidthSource) continue;
            for (const sd of [1, -1]) {
                let half = Infinity;
                for (const t of [.2, .5, .8]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
                    edgesInBox(x - 12, z - 12, x + 12, z + 12, f => {
                        if (f === e || !f.oneway || f.virtual || f.tunnel || f.bridge || Math.max(Math.abs(f.ya), Math.abs(f.yb)) > .3 || f.dirx * e.dirx + f.dirz * e.dirz > -.9) return;
                        if (f.a === e.a || f.a === e.b || f.b === e.a || f.b === e.b) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= .02 || q.t >= .98) return;
                        if (((q.cx - x) * e.nx + (q.cz - z) * e.nz) * sd <= 0) return; // (on this side)
                        const fSide = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? f.wR : f.wL;
                        if (q.d < (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + fSide + shoulderOf(f) - .05) half = Math.min(half, q.d / 2 - shoulderOf(e));
                    });
                }
                const key = sd > 0 ? 'wR' : 'wL';
                if (!(half < e[key] - .05)) continue;
                const lanes = Math.max(1, e.lanesF + e.lanesB), other = sd > 0 ? e.wL : e.wR, nw = Math.max(Math.max(1.3, 2.6 * lanes - other), half);
                if (!(nw < e[key] - .05)) continue;
                e[key] = nw; e.laneW = Math.min(e.laneW, (e.wL + e.wR) / lanes); e.median = -2 * e.wL; layContraflowLanes(e); e.halfW = Math.max(e.wL, e.wR); touched.add(e.a).add(e.b); narrowed++;
            }
        }
        if (narrowed) { for (const n of touched) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.dividedPairNarrowed = narrowed; }
    }
    // (owner, 2026-11-15, Bellevue: "bellevue needs some rework too on the buildings, lanes, roads") a one-way carriageway
    // with an OSM lane count (NE 8th St, 112th Ave NE, Bellevue Way NE) keeps its real width: lanes × the road's lane width
    // (3.5 m, inside Bellevue's 11–12 ft arterial standard, Transportation Design Manual 2024 Table 3-7). The lane alignment
    // (world-road-graph.js) holds the left kerb where the narrowest neighbouring segment puts it, so a 4–5-lane stretch
    // opened all its extra lanes on the right, into the footprints there, and the footprint pass then narrowed those lanes
    // to 2.6–2.75 m (NE 8th westbound between 106th and 108th: 4 lanes in 11 m), while the gap to the opposite carriageway
    // stayed up to 5 m of bare paving. OSM maps a carriageway along its middle (the separately mapped sidewalks stand
    // 7.4–9.5 m from the 4–5-lane ways) and the turn pockets those lanes are (turn:lanes=left|left|…) open into the median:
    // the full width comes back, and each run of same-lane-count segments moves its left kerb toward the opposite
    // carriageway, together, up to 0.6 m from it; what does not fit there stays on the right (a footprint still standing
    // on the carriageway is clipped to the kerb: world-buildings.js). MODEL: widths are the city's lane width; a way with a
    // mapped or reviewed width is left alone.
    if (US) {
        const roadLaneW = new Map(roads.map(rd => [rd.index, rd.laneW]));
        const T = e => (e.lanesF + e.lanesB) * (roadLaneW.get(e.road) ?? e.laneW);
        const flat = e => Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) < .3;
        const own = e => e.oneway && !e.virtual && !e.tunnel && !e.bridge && !e.roadWidthSource && !e.contraflowBus && !e.madeTwoWay && e.type !== 'service' && flat(e) && e.name && data.roadSourceGeometry?.[e.road]?.tags?.lanes != null;
        const short = e => e.wL + e.wR < T(e) - .05;
        const nextOf = e => e.b.edges.filter(f => f !== e && f.a === e.b && own(f) && f.name === e.name && f.lanesF === e.lanesF);
        const prevOf = e => e.a.edges.filter(f => f !== e && f.b === e.a && own(f) && f.name === e.name && f.lanesF === e.lanesF);
        // the carriageways beside each edge on its left (parallel, at grade): [{ f, d: distance from e's centre line to f's
        // facing edge }] at three points along it (none: no room on the left)
        const leftOf = e => {
            const out = [];
            for (const t of [.2, .5, .8]) {
                const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
                edgesInBox(x - 22, z - 22, x + 22, z + 22, f => {
                    if (f === e || f.virtual || f.tunnel || f.bridge || !flat(f) || f.type === 'service' || (f.lanesF + f.lanesB) < 1) return;
                    const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= .02 || q.t >= .98 || q.d > 20) return;
                    if (((q.cx - x) * e.nx + (q.cz - z) * e.nz) >= 0) return; // (on the left)
                    if (Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) < .9) return;
                    const fSide = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? f.wR : f.wL;
                    out.push({ f, d: q.d - fSide - shoulderOf(f) - shoulderOf(e) });
                });
            }
            return out;
        };
        const seen = new Set(), runs = [];
        for (const e of edges) {
            if (seen.has(e) || !own(e) || !short(e)) continue;
            const run = [e]; seen.add(e);
            for (let f = e, k = 0; k < 12; k++) { const n2 = prevOf(f); if (n2.length !== 1 || seen.has(n2[0])) break; f = n2[0]; run.unshift(f); seen.add(f); }
            for (let f = e, k = 0; k < 12; k++) { const n2 = nextOf(f); if (n2.length !== 1 || seen.has(n2[0])) break; f = n2[0]; run.push(f); seen.add(f); }
            if (run.some(f => f.footprintNarrowed)) runs.push(run); // (narrowed to clear footprints; other narrowings — a divided pair, a ramp beside — keep theirs)
        }
        // how far each edge's left kerb may go, from the widths as they stand: up to 0.6 m from the opposite carriageway, or
        // to the middle of the gap less 0.3 m when that carriageway is restored too (both pockets share the median)
        const cand = new Set(runs.flat()), avail = new Map();
        for (const e of cand) { const L = leftOf(e); let a = L.length ? Infinity : e.wL; for (const { f, d } of L) a = Math.min(a, cand.has(f) ? e.wL + (d - e.wL) / 2 - .3 : d - .6); avail.set(e, a); } // (no carriageway on the left: no median to open into)
        const touched = new Set(), audit = [];
        for (const run of runs) {
            const want = Math.max(...run.map(e => T(e))), Rnow = Math.min(...run.map(e => e.wR));
            // the run's left kerb: as far as the footprint side needs (its right side keeps the width the footprints left it),
            // limited by the room beside its narrowed segments; one value along the run keeps its lane lines continuous, a
            // segment with less room beside it (a junction approach) takes what it has
            const narrowed = run.filter(e => e.footprintNarrowed), wRun = Math.min(want - Rnow, ...narrowed.map(e => avail.get(e)));
            for (const e of run) {
                const before = [e.wL, e.wR], wL = Math.max(e.wL, Math.min(wRun, avail.get(e)));
                e.wL = wL; e.wR = want - wL; e.laneW = want / Math.max(1, e.lanesF + e.lanesB); e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); e.realWidthRestored = true;
                touched.add(e.a).add(e.b);
                audit.push({ edge: e.id, road: data.roadSourceGeometry?.[e.road]?.sourceId ?? e.road, name: e.name, lanes: e.lanesF, before: before.map(v => +v.toFixed(2)), after: [+e.wL.toFixed(2), +e.wR.toFixed(2)] });
            }
        }
        for (const n of touched) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5;
        __buildRoadGraphAids.sccInfo.realWidthRestored = audit;
    }
    // (owner, 2026-11-12, Grozavesti: "fences are not continuous on the bridge still in many places") along 100 m of the Basarab
    // decks the tram on the slab beside a carriageway overhangs that carriageway's edge by 0.3-0.6 m (OSM centre lines and
    // modelled widths leave no room between them), so the railing between road and track could not stand: a tram would run
    // through it. That side of the carriageway is narrowed (lanes down to 2.75 m) until its railing line is clear of the
    // tram's swept body. MODEL: widths are estimates; a way with a reviewed or mapped width is left alone.
    if (tramSweep && data.city === 'bucharest' && data.district?.id === 'grozavesti') {
        let narrowed = 0;
        for (const e of edges) {
            if (!e.bridge || e.virtual || e.tunnel || !(Math.min(e.ya, e.yb) > .15) || e.roadWidthSource) continue;
            for (const sd of [1, -1]) {
                const key = sd > 0 ? 'wR' : 'wL', w0 = e[key], lanes = Math.max(1, e.lanesF + e.lanesB), other = sd > 0 ? e.wL : e.wR, minSide = Math.max(1.3, 2.75 * lanes - other);
                const hit = w => { const o = (w + shoulderOf(e) + .3) * sd, a = [e.a.x + e.nx * o, e.a.z + e.nz * o], b = [e.b.x + e.nx * o, e.b.z + e.nz * o], ya = Y.road + yAlong(e, a[0], a[1]), yb = Y.road + yAlong(e, b[0], b[1]); return !!tramSweep.segment(a, b, .05, Math.min(ya, yb) - .6, Math.max(ya, yb) + 1.1); };
                if (!hit(w0)) continue;
                let nw = null; for (const d of [.2, .4, .6, .8, 1, 1.2]) { if (w0 - d < minSide - 1e-9) break; if (!hit(w0 - d)) { nw = w0 - d; break; } }
                if (nw === null) continue;
                e[key] = nw; e.laneW = Math.min(e.laneW, (e.wL + e.wR) / lanes); if (e.oneway) e.median = -2 * e.wL; layContraflowLanes(e); e.halfW = Math.max(e.wL, e.wR); narrowed++;
            }
        }
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.narrowedBesideTram = narrowed; }
    }
    // (owner backlog, 2026-11-15, Bellevue: "lane lines jump up to ~3.5 m where a restored one-way run meets a different lane
    // count") each segment of a one-way keeps its own cross-section (the lane alignment's left kerb, a restored run's real
    // width, a lane added or dropped), so at every node where that changes both kerbs and every lane line stepped sideways:
    // NE 8th St, 112th and 108th Ave NE, Bellevue Way. A district with `kerbTapers` (cities.js) walks each named one-way
    // chain (consecutive segments of one name, each the only way on from the last) and turns every step of either kerb
    // into a taper: the narrower side widens to meet the wider one, over 10 m per metre of step (15–45 m), on the segments
    // before a node that widens and after one that narrows; where those cannot carry it, the wider side starts at the narrower
    // width and opens out (a lane opening). Never on a deck, a raised ramp or a segment with a mapped width. Each
    // segment keeps its own lanes and width (traffic, kerbs away from a step); the extra width is linear along a segment
    // (e.taperL / e.taperR, world-road-graph.js sideExtra) and the lane lines are laid from the tapered left kerb
    // (world-edge-ribbons.js), so they run on through the node and spread or close in with the kerbs.
    if (distCfg?.kerbTapers) {
        const only = distCfg.kerbTapers === 'motorway' ? 'motorway' : null; // (SeaTac: the Airport Expressway only, below)
        const gaveWay = new Set(edges.filter(e => e.gaveWay).map(e => e.road)); // (and a road that gave way to a ramp beside it, above)
        const ok = e => e.oneway && !e.virtual && !e.tunnel && !e.madeTwoWay && !e.contraflowBus && e.type !== 'service' && !!e.name && (!only || e.type === only || gaveWay.has(e.road));
        const carries = e => !e.bridge && Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) < .3 && !e.roadWidthSource && !e.taperR && !e.taperL && !e.rampTaper && !e.busLane;
        const nextOf = e => {
            const n = e.b, outs = n.edges.filter(f => f !== e && f.a === n && ok(f) && f.name === e.name); if (outs.length !== 1) return null;
            const f = outs[0]; if (n.edges.filter(g => g !== f && g.b === n && ok(g) && g.name === f.name).length !== 1) return null;
            return e.dirx * f.dirx + e.dirz * f.dirz > .5 ? f : null;
        };
        const prev = new Map(); for (const e of edges) if (ok(e)) { const f = nextOf(e); if (f) prev.set(f, e); }
        const done = new Set(), touched = new Set(); let tapered = 0, steps = 0, recentred = 0, kept = 0;
        for (const e0 of edges) {
            if (!ok(e0) || done.has(e0)) continue;
            let s = e0; const back = new Set([s]); while (prev.has(s) && !back.has(prev.get(s)) && !done.has(prev.get(s))) { s = prev.get(s); back.add(s); }
            const chain = []; for (let c = s; c && !done.has(c); c = nextOf(c)) { done.add(c); chain.push(c); }
            if (chain.length < 2) continue;
            // (owner backlog, 2026-11-15, SeaTac: "the Airport Expressway 3-lane parts sit 1.85 m off their mapped line") the
            // one-kerb rule (world-road-graph.js `kerbRuns`) holds a chain's left kerb half a lane out where it spans 3 to 5
            // lanes, so the 3-lane parts (w31928831, w1165460001) lay 1.85 m left of their ways and the 4th lane opened on
            // the right, while OSM brings it in from the left (link w428003842 joins at 47.4440, -122.2966). On a motorway
            // chain (`kerbTapers: 'motorway'`) each run of one lane count goes back onto its own way, centred as OSM maps a
            // carriageway, where every step at its ends can be tapered (one side of the node is at grade); the kerb steps
            // that leaves are tapered below like any other
            if (only) {
                const runs = []; for (const c of chain) { const r = runs[runs.length - 1]; if (r && r[0].lanesF === c.lanesF) r.push(c); else runs.push([c]); }
                runs.forEach((r, i) => {
                    const total = r[0].wL + r[0].wR; if (r.some(c => Math.abs(c.wL + c.wR - total) > .05 || Math.abs((c.wR - c.wL) / 2) < .05 || c.taperR || c.rampTaper || c.roadWidthSource)) return;
                    const endOk = (a, b) => !a || !b || ((carries(a) || carries(b)) && ![a, b].some(c => c.taperR || c.rampTaper)); // (a lane-drop taper beside it was laid for its present kerb)
                    if (!endOk(runs[i - 1]?.at(-1), r[0]) || !endOk(r.at(-1), runs[i + 1]?.[0])) return;
                    for (const c of r) { c.wL = c.wR = total / 2; c.median = -2 * c.wL; c.halfW = c.wL; touched.add(c.a).add(c.b); recentred++; }
                });
            }
            const S = [0]; for (const c of chain) S.push(S[S.length - 1] + c.len);
            const ext = {};
            for (const key of ['wL', 'wR']) {
                const T = chain.map(c => c[key]), raise = [], lower = [], claim = new Map(); // (segment index → the node whose taper it carries)
                // (a segment that already has a taper, a lane drop or a ramp's, meets its neighbours at its tapered width)
                const pre = (c, end) => { const t = key === 'wR' ? c.taperR : c.taperL; return t ? t[end] : 0; }, Ta = T.map((v, j) => v + pre(chain[j], 0)), Tb = T.map((v, j) => v + pre(chain[j], 1));
                // (a segment's extra width is linear, so it carries the taper of one node only: a 98 m segment between a lane drop
                // and a lane add would otherwise be widened along its whole length)
                // (a kerb side narrowed to clear building footprints, world-road-graph.js, is never widened back toward them)
                // (a taper runs from its node up to the next node where this side steps again, at most)
                const roomOf = (k, dir, widen) => { let m = 0; for (let j = dir < 0 ? k - 1 : k; j >= 0 && j < chain.length && carries(chain[j]) && !(widen && key === 'wR' && chain[j].footprintNarrowed) && (!claim.has(j) || claim.get(j) === k); j += dir) { m += chain[j].len; const nx = j + dir; if (nx >= 0 && nx < chain.length && Math.abs(dir > 0 ? Tb[j] - Ta[nx] : Ta[j] - Tb[nx]) > .05) break; } return m; };
                const take = (k, dir, L) => { let m = 0; for (let j = dir < 0 ? k - 1 : k; j >= 0 && j < chain.length && m < L; j += dir) { claim.set(j, k); m += chain[j].len; } };
                for (let k = 1; k < chain.length; k++) {
                    const lo = Math.min(Tb[k - 1], Ta[k]), hi = Math.max(Tb[k - 1], Ta[k]); if (hi - lo < .05) continue;
                    const toNarrow = Ta[k] > Tb[k - 1] ? -1 : 1, L0 = clamp(10 * (hi - lo), 15, 45); // (-1: the narrower segments are those before the node)
                    const rn = roomOf(k, toNarrow, true), rw = roomOf(k, -toNarrow, false);
                    // the narrower side widens toward the node; where it cannot (a deck, a ramp beside, a segment carrying another
                    // node's taper), the wider side starts at the narrower width and opens over the taper instead (a lane opening)
                    if (rn >= Math.min(L0, rw) && rn >= 1) { const L = Math.min(rn, L0); raise.push({ k, S: S[k], v: hi, slope: (hi - lo) / L, dir: toNarrow }); take(k, toNarrow, L); }
                    else if (rw >= 1) { const L = Math.min(rw, L0); lower.push({ k, S: S[k], v: lo, slope: (hi - lo) / L, dir: -toNarrow }); take(k, -toNarrow, L); }
                    else continue; // (nothing to carry it: the step stays)
                    steps++;
                }
                // the side's width at x on segment j: the segment's own, held down toward a narrower neighbour by an opening
                // taper, or raised toward a wider one
                const at = (x, j) => {
                    let v = T[j];
                    for (const r of lower) { const d = (x - r.S) * r.dir; if (d >= -1e-9 && claim.get(j) === r.k) v = Math.min(v, r.v + r.slope * d); }
                    for (const r of raise) { const d = (x - r.S) * r.dir; if (d >= -1e-9 && claim.get(j) === r.k) v = Math.max(v, r.v - r.slope * d); }
                    return v;
                };
                ext[key] = chain.map((c, j) => carries(c) ? [at(S[j], j) - T[j], at(S[j + 1], j) - T[j]] : [0, 0]);
                // (never a step bigger than the one it replaces: such a chain side keeps its widths)
                for (let k = 1; k < chain.length; k++) if (Math.abs(Tb[k - 1] + ext[key][k - 1][1] - Ta[k] - ext[key][k][0]) > Math.abs(Tb[k - 1] - Ta[k]) + .05) { ext[key] = chain.map(() => [0, 0]); kept++; break; }
            }
            chain.forEach((c, j) => {
                const xl = ext.wL[j], xr = ext.wR[j], big = x => Math.max(...x.map(Math.abs)) > 1e-3; if (!big(xl) && !big(xr)) return;
                c.taperL = big(xl) ? xl : null; c.taperR = big(xr) ? xr : null; c.kerbTaper = true;
                c.halfW = Math.max(c.wL + Math.max(0, ...xl), c.wR + Math.max(0, ...xr)); touched.add(c.a).add(c.b); tapered++;
            });
        }
        if (tapered || recentred) { for (const n of touched) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.kerbTapers = { edges: tapered, steps, recentred, kept }; }
    }
    // (owner backlog, 2026-11-15, Bellevue, 112th Ave NE × NE 8th St (295 … 308, -330 … -303)) where two divided roads cross,
    // OSM closes the junction with a ring of short ways between four junction nodes; each node's pad is the hull of its own
    // approaches, so between the four pads a sliver of the median's grass showed inside the junction, and the short ways
    // kept stubs of lane and edge lines (and an inferred walkway) in the middle of it. A district with `junctionFills`
    // (cities.js) takes such a ring (junction nodes joined by ways under 25 m at grade, closing a loop) as one junction:
    // its inside is paved (world-side-joins.js) and its ways carry no lane, edge line or walkway on the inside.
    const junctionFills = [];
    if (distCfg?.junctionFills) {
        const deg = n => n.edges.filter(f => !f.virtual).length;
        const inner = e => !e.virtual && !e.bridge && !e.tunnel && e.len < 25 && e.a.pad && e.b.pad && deg(e.a) >= 3 && deg(e.b) >= 3 && e.type !== 'service' && !/_link$/.test(e.type || '') && Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) < .3;
        const par = new Map(), find = n => { while (par.get(n) !== n) { par.set(n, par.get(par.get(n))); n = par.get(n); } return n; };
        const ins = edges.filter(inner); for (const e of ins) for (const n of [e.a, e.b]) if (!par.has(n)) par.set(n, n);
        for (const e of ins) par.set(find(e.a), find(e.b));
        const comps = new Map(); for (const e of ins) { const r = find(e.a); let c = comps.get(r); if (!c) comps.set(r, c = { nodes: new Set(), edges: [] }); c.nodes.add(e.a).add(e.b); c.edges.push(e); }
        for (const { nodes: ns, edges: es } of comps.values()) {
            if (ns.size < 3 || es.length < ns.size) continue; // (a loop: a chain of short ways is no closed junction)
            const poly = convexHull([...ns].map(n => [n.x, n.z])); let area = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
            if (Math.abs(area) / 2 < 20) continue;
            const cx = poly.reduce((m, p) => m + p[0], 0) / poly.length, cz = poly.reduce((m, p) => m + p[1], 0) / poly.length;
            for (const e of es) { e.junctionInterior = true; const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2; if ((cx - mx) * e.nx + (cz - mz) * e.nz > 0) e.sidewalkRightM = 0; else e.sidewalkLeftM = 0; }
            junctionFills.push({ nodes: [...ns], poly, edges: es });
        }
        if (junctionFills.length) __buildRoadGraphAids.sccInfo.junctionFills = junctionFills.map(j => ({ at: [Math.round(j.poly.reduce((m, p) => m + p[0], 0) / j.poly.length), Math.round(j.poly.reduce((m, p) => m + p[1], 0) / j.poly.length)], nodes: j.nodes.length, ways: j.edges.length }));
    }
    const widthAsphalt = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e);
    const widthSide = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e) + sidewalkWidth(e, s);
    const widthKerb = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e) + 0.28;
    // a sidewalk OSM maps as its own footway on a raised deck: its strip on the deck, beside the carriageway (bridge-walkways.js)
    const bridgeWalkways = assignBridgeWalkways(`${city.id}-${distId}`, edges, (la, lo) => city.proj(la, lo), widthAsphalt, sidewalkWidth);
    // the deck walkway as drawn: its kerb is mitred with the next carriageway's where the width steps; the crowd walks it there
    // (e.deckWalkShift[side] = [at a, at b], metres outward of the nominal kerb, read by the crowd's taper)
    if (bridgeWalkways) for (const e of edges) if (e.deckWalk && e.bridge) for (const s of [1, -1]) {
        if (!(deckWalkSide(e, s) > 0)) continue;
        const lat = p => ((p[0] - e.a.x) * e.nx + (p[1] - e.a.z) * e.nz) * s, wk = widthKerb(e, s);
        (e.deckWalkShift || (e.deckWalkShift = {}))[s] = [lat(corner(e, e.a, s, wk, widthKerb)) - wk - sideExtra(e, s, 0), lat(corner(e, e.b, s, wk, widthKerb)) - wk - sideExtra(e, s, e.len)];
    }
    const sharedPadSurfaces=new Map();
    if(sharedBridgeProfile.known||sourceBridgeDescents.known)for(const n of nodeArr){
        if(!n.pad||!n.edges.some(e=>e.sourceBridgeGrade?.known))continue;
        const es=n.edges.filter(e=>!e.virtual),hull=convexHull(es.flatMap(e=>[corner(e,n,1,widthAsphalt(e,1),widthAsphalt),corner(e,n,-1,widthAsphalt(e,-1),widthAsphalt)])),surface=sharedBridgePadSurface(n,hull,es,(e,p)=>yAlong(e,...p));
        if(surface){sharedPadSurfaces.set(n.id,surface);sharedBridgeProfile.bindPadSurface?.(n,surface);sourceBridgeDescents.bindPadSurface?.(n,surface);}
    }
    // (spec 10 load budget) the deck height models as data for the build workers (bridge-height-models.js): they shape the
    // decks' ground ribbons (displace, finishDeckJobs) with the same functions
    if (buildPool && (sharedBridgeProfile.known || sourceBridgeDescents.known)) try {
        buildPool.deckModels({ shared: sharedBridgeProfile.known ? sharedBridgeProfile.workerSpec : null, descents: [...(sourceBridgeDescents.workerSpecs || new Map()).values()],
            pads: [...sharedPadSurfaces].map(([id, s]) => [id, { P: s.poly, triangles: s.topTriangles, baseM: s.baseM }]) });
        __buildBridgeTramSignals.deckWorkers = true;
    } catch (err) { console.warn('[world] deck models for the workers', err); }
    // (world ribbons: world-ribbons.js)
    const __buildRibbons = buildRibbons({
        US, asphaltBase, asphaltCorners, asphaltEnds, ballastCol, buildPool, cellOf, city,
        concreteCol, convexApart, corner, data, deckAudit, deckJobs, deckWorkers: __buildBridgeTramSignals.deckWorkers, edgeGrid,
        edges, edgesInBox, isConcrete, kerbCol, laneTapers, layerY, nodeArr, padHeightAt,
        railRoadside, researchTrees, retract, rng, roads, sharedBridgeMeshAudit, sideCol, sideExtra,
        str, tramGrades, white, widthAsphalt, widthKerb, widthSide, yAlong, yellow,
    });
    const {
        DY_SIDE, SIDE_BACK, convexRing, cornerGrid, cornerPolys, cornerSkips, coveredByOther, displace,
        foldDeckAudit, insetRing, lampSpots, padCorners, parapetOwnership, polyDist, raised, raisedEdge,
        retainedDeck, ribPoly, ribbons, sideJoins, surfGrid, surfList, treeSpots,
    } = __buildRibbons;
    // (raised / sunken edges: world-raised-edges.js)
    const __buildRaisedEdges = await buildRaisedEdges({
        bigWater, cellOf, cells, city, corner, data, displace, distId,
        edges, finishDeckJobs, nodeArr, railRoadside, railRoadsideCaps, raised, ribbons, sideCol,
        str, tramGrades, tramPropEnvelope, widthSide, yAlong,
    });
    const {
        deferredUnderpassDown, hallFurnitureStats, onOtherCarriageway, pasajMedianBarrier, pasajPortals, pasajStats, pierColl, pierSpots,
        sharedHallRoad, sharedTrenchSide, tramHallPieces, trenchGoreCuts, underpassColl, underpassCollEdges, underpassCover, underpassGroundOwners,
        underpassOwnerOptions, underpassRoofAudit,
    } = __buildRaisedEdges;
    // (world side joins: world-side-joins.js)
    const {
        RIB_ONLY, clearOf, kerbSpot, liftOnSide, medianFill, medianGrid, obbPoly, onRibbon,
        polyOnRibbon, raisedDeck, raisedTop, ribGrid, ribbonsAtLevel, segsCross, walls,
    } = buildSideJoins({
        ASPHALT, DY_SIDE, SIDE_BACK, US, asphaltCorners, bridgeJunctionAudit, bridgeJunctionDecks, cellOf,
        cornerGrid, cornerPolys, cornerSkips, coveredByOther, data, distCfg, edgeGrid, edges, kerbCol,
        layerY, padAsphalt, padCorners, padHeightAt, pierColl, pierSpots, polyDist, railRoadside,
        raised, raisedEdge, retainedDeck, ribbons, sceneryDeckGrid, sharedPadSurfaces, sideCol, sideExtra,
        sideJoins, widthAsphalt, widthSide, yAlong, junctionFills,
    });
    // (world walls and barriers: world-walls.js)
    const __buildWallsBarriers = buildWallsBarriers({
        cellOf, data, distCfg, edgeGrid, edges, medianGrid, onOtherCarriageway, padHeightAt,
        parapetOwnership, polyDist, raisedDeck, retract, ribGrid, ribPoly, ribbons, segsCross,
        sharedTrenchSide, surfacesAt, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, wallCut, walls,
        widthAsphalt, widthSide, yAlong, blocksLane, barrierHidden: pasajMedianBarrier,
    });
    blocksLane = __buildWallsBarriers.blocksLane;
    for (const w of railRoadsideCaps) { // exact render-matched new fascia; no invented barrier thickness
        // The slab is cut at the literal body width; the guard's cover reaches 0.18 m further and a rigid body more on a
        // bend. Collider pieces of this inferred face inside that sweep are left out. The drawn face is unchanged.
        const runs = tramSweep ? tramSweep.freeRuns([w.ax, w.az], [w.bx, w.bz], { r: .02, y0a: w.y0a - .3, y1a: w.y1a, y0b: w.y0b - .3, y1b: w.y1b, pieceM: .25 }) : [[0, 1]];
        if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1) { walls.push(w); continue; }
        const lerp = (a, b, t) => a + (b - a) * t, len = Math.hypot(w.bx - w.ax, w.bz - w.az), kept = runs.reduce((n, q) => n + q[1] - q[0], 0);
        tramSweepConflicts.wallPiecesCut['rail-roadside-cap'] = (tramSweepConflicts.wallPiecesCut['rail-roadside-cap'] || 0) + len * (1 - kept);
        for (const [f0, f1] of runs) { const ax = lerp(w.ax, w.bx, f0), az = lerp(w.az, w.bz, f0), bx = lerp(w.ax, w.bx, f1), bz = lerp(w.az, w.bz, f1);
            walls.push({ ...w, ax, az, bx, bz, y0a: lerp(w.y0a, w.y0b, f0), y0b: lerp(w.y0a, w.y0b, f1), y1a: lerp(w.y1a, w.y1b, f0), y1b: lerp(w.y1a, w.y1b, f1), x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 }); }
    }
    // The builder retains whole source bridge chains beyond its original core.
    // Their actual road/pad support and the cockpit's complete body must share
    // the same finite mask, bounds, inside query and synthetic wall outline.
    const sourceCoreEdge = e => !!e && !e.virtual && !e.rail &&
        /^w\d+$/.test(data.roadSourceGeometry?.[e.road]?.sourceId || '');
    const sourceBoundaryPolygons = ribbons.flatMap(rb => {
        const ownerEdges = rb.e ? sourceCoreEdge(rb.e) ? [rb.e] : [] : (rb.node?.edges || []).filter(sourceCoreEdge);
        if (!ownerEdges.length) return [];
        const poly = rb.poly.map(([x, z], i) => [x, Y.road + (rb.e ? yAlong(rb.e, x, z) : rb.hs?.[i] ?? padHeightAt(rb.node, x, z)), z]);
        return [{ poly, ownerEdges, sourceId: rb.e ? data.roadSourceGeometry[rb.e.road].sourceId : 'source-junction-pad' }];
    });
    const boundarySupport = buildSourceBoundarySupport(sourceBoundaryPolygons);
    __buildAreasWater.dmask = boundarySupport.extendMask(__buildAreasWater.dmask);
    // (world buildings: world-buildings.js)
    const {
        LANDMARKS, assemblyAudit, assemblyRejected, bDropped, bGrid, bRecs, bShrunk, buildLandmarkFn,
        buildingAt, buildingIndex, buildingPassageAudit, carParkOutlines, clearanceAudit, coveredOutlines, entranceCanopies, heightFixes,
        landmarkSourceReplacements, landmarkSurfaceMats, landmarks, mapEnds, outlineParts, overlapCuts, roofPrefetch, roofProfileAudit,
        tramDeckSupportAt,
    } = await buildBuildingsLandmarks({
        US, ballastCol, boundarySupport, bounds, buildPool, cellOf, city, coveredRoadModels,
        data, distCfg, distId, dmask: __buildAreasWater.dmask, edgesInBox, inDistrictLL, nearestEdge, nodeArr,
        pad, polyOnRibbon, railCol, ribGrid, ribbons, sceneryDeckGrid, sharedHallRoad, str,
        tramDecks, tramGrades, tramHallPieces, trams, walls, yAlong,
    });
    // (world landmark grounds: world-landmark-grounds.js)
    const {
        clipBuildingDetails, collisionBoxes, floatingSupport, inferredDetailAudit, landmarkFences, landmarkWaterFootprints, lazyRoofMesh, lmGrounds,
        lmGroup, pendingDetailClips, physicalUnionAudit, physicalUnionRejected, sceneryStopEdge, sceneryStreetNear, specFaces, stopMarginM,
        unflatFaces,
    } = buildLandmarkGrounds({
        LANDMARKS, US, bGrid, bRecs, buildLandmarkFn, buildPool, bx0, bx1,
        bz0, bz1, cellOf, city, data, edges, group, isWater,
        landmarkSourceReplacements, landmarks, onRibbon, surfacesAt,
    });
    /** the clipped detail ranges, per builder (in builder order), for spliceDetailRanges; the audit is filled here */
    async function detailClipItems() {
        buildPool?.flush();
        const byBuilder = new Map();
        if (!pendingDetailClips.length) return byBuilder;
        const results = await Promise.all(pendingDetailClips.map(j => j.promise ? j.promise.catch(e => (console.warn('[world] build worker failed, clipping here', e), null)) : null));
        pendingDetailClips.forEach((j, n) => {
            let r = results[n], replace = null;
            if (r) replace = r.faces;
            else { // no worker result (unsupported roof data or a failed worker): the same function, here
                r = clipInferredBuildingDetail(unflatFaces(j.flat, 12), j.owner, j.neighbours.map(n => (n.spec ? { i: n.i, sourceId: n.sourceId, minH: n.minH, mesh: { faces: specFaces(n.spec) } } : { i: n.i, sourceId: n.sourceId, minH: n.minH })), { inferred: true });
                if (r.clippedAreaM2 > 1e-10) { replace = new Float64Array(r.faces.length * 36); let k = 0; for (const f of r.faces) { if (f.length !== 3) throw new Error('detail clip: non-triangle face'); for (const p of f) { if (p.length !== 12) throw new Error('detail clip: point attributes'); replace.set(p, k); k += 12; } } }
            }
            inferredDetailAudit.ranges++; inferredDetailAudit.clippedAreaM2 += r.clippedAreaM2;
            for (const issue of r.issues) if (inferredDetailAudit.issues.length < 100) inferredDetailAudit.issues.push({ owner: j.owner.sourceId, ...issue });
            if (r.clippedAreaM2 > 1e-10) { let l = byBuilder.get(j.builder); if (!l) byBuilder.set(j.builder, l = []); l.push({ ...j, replace }); }
        });
        pendingDetailClips.length = 0;
        return byBuilder;
    }
    /** replace the vertex / index ranges of `items` (in builder order) by their clipped faces, as builder.v / builder.tri
     *  would have emitted them at that point, and shift the indices of everything after */
    /** the decks shaped in the build workers: their results replace their ranges (in call order per builder), and their
     *  audits join sharedBridgeMeshAudit in call order. A failed job is shaped here from the same input. */
    /** the deck ranges of the builders `only` (all when null) shaped, per builder (in builder order); audits filled */
    async function deckItems(only = null) {
        const byBuilder = new Map();
        const jobs = deckJobs.filter(j => !only || only.has(j.builder));
        if (jobs.length) {
            for (let k = deckJobs.length - 1; k >= 0; k--) if (!only || only.has(deckJobs[k].builder)) deckJobs.splice(k, 1);
            const results = await Promise.all(jobs.map(j => j.promise.catch(err => (console.warn('[world] deck worker failed, shaping here', err), null))));
            jobs.forEach((j, n) => {
                let r = results[n];
                if (!r) r = shapeDeckSoup(j.input, j.fn, j.withTile);
                j.entry.a = r.stats;
                const o = r, count = o.count;
                let l = byBuilder.get(j.builder); if (!l) byBuilder.set(j.builder, l = []);
                l.push({ sv: j.sv, ev: j.ev, si: j.si, ei: j.ei, count, fill: (p, nn, u, c, t, at) => { p.set(o.p, at * 3); nn.set(o.n, at * 3); u.set(o.u, at * 2); c.set(o.c, at * 3); if (t) { if (o.t) t.set(o.t, at); else t.fill(-1, at, at + count); } } });
            });
        }
        foldDeckAudit();
        return byBuilder;
    }
    /** the deck ranges of `only` (all when null) spliced into their builders now */
    async function finishDeckJobs(only = null) { for (const [B, items] of await deckItems(only)) spliceDetailRanges(B, items); }
    /** every pending range (decks, then the building loop's detail clips: later in each builder) spliced in */
    async function finishPendingRanges() {
        const byBuilder = await deckItems();
        for (const [B, items] of await detailClipItems()) { const l = byBuilder.get(B); if (l) l.push(...items); else byBuilder.set(B, items); }
        for (const [B, items] of byBuilder) spliceDetailRanges(B, items);
    }
    function spliceDetailRanges(B, items) {
        // an item gives its faces as `replace` (12 numbers per point) or as `count` points written by `fill`
        const countOf = it => it.fill ? it.count : it.replace.length / 12;
        let nv = B.vc, ni = B.ic;
        for (const it of items) { const n = countOf(it); nv += n - (it.ev - it.sv); ni += n - (it.ei - it.si); }
        const p = new Float32Array(Math.max(1, nv) * 3), nn = new Float32Array(Math.max(1, nv) * 3), u = new Float32Array(Math.max(1, nv) * 2), c = new Uint8Array(Math.max(1, nv) * 3), t = B.t ? new Float32Array(Math.max(1, nv)) : null, ix = new Uint32Array(Math.max(1, ni));
        // old vertex → new: shifted by the size change of every replaced range before it; a reference into a replaced range is an error
        const ends = [], deltas = []; let d = 0;
        for (const it of items) { d += countOf(it) - (it.ev - it.sv); ends.push(it.ev); deltas.push(d); }
        const map = x => { let lo = 0, hi = items.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ends[m] <= x) lo = m + 1; else hi = m; } if (lo < items.length && x >= items[lo].sv) throw new Error('detail splice: index into a clipped range'); return x + (lo ? deltas[lo - 1] : 0); };
        const copyV = (from, to, at) => { p.set(B.p.subarray(from * 3, to * 3), at * 3); nn.set(B.n.subarray(from * 3, to * 3), at * 3); u.set(B.u.subarray(from * 2, to * 2), at * 2); c.set(B.c.subarray(from * 3, to * 3), at * 3); if (t) t.set(B.t.subarray(from, to), at); };
        const copyI = (from, to, at) => { for (let q = from; q < to; q++) ix[at++] = map(B.i[q]); return at; };
        let ov = 0, oi = 0, av = 0, ai = 0;
        for (const it of items) {
            copyV(ov, it.sv, av); av += it.sv - ov; ai = copyI(oi, it.si, ai);
            if (it.fill) { it.fill(p, nn, u, c, t, av); for (let q = 0; q < it.count; q++) ix[ai++] = av++; ov = it.ev; oi = it.ei; continue; }
            const f = it.replace, n = f.length / 12;
            for (let q = 0; q < n; q++) { const k = q * 12, a3 = av * 3; p[a3] = f[k]; p[a3 + 1] = f[k + 1]; p[a3 + 2] = f[k + 2]; nn[a3] = f[k + 3]; nn[a3 + 1] = f[k + 4]; nn[a3 + 2] = f[k + 5]; u[av * 2] = f[k + 6]; u[av * 2 + 1] = f[k + 7]; c[a3] = f[k + 8]; c[a3 + 1] = f[k + 9]; c[a3 + 2] = f[k + 10]; if (t) t[av] = f[k + 11]; ix[ai++] = av++; }
            ov = it.ev; oi = it.ei;
        }
        copyV(ov, B.vc, av); av += B.vc - ov; ai = copyI(oi, B.ic, ai);
        if (av !== nv || ai !== ni) throw new Error('detail splice: size mismatch');
        B.p = p; B.n = nn; B.u = u; B.c = c; if (t) B.t = t; B.i = ix; B.vc = nv; B.ic = ni;
    }
    // landmarks that model their own water (the Unirii fountains: basins drained Nov–Apr by landmarks.js's
    // fountainSchedule) replace the OSM water polygons inside them: those are collapsed (no doubled / always-full basins)
    {
        const OWN_WATER = new Set(['fountains']);
        const box = new THREE.Box3();
        for (const lm of landmarks) {
            if (!OWN_WATER.has(lm.id) || !lm.mesh) continue;
            box.setFromObject(lm.mesh); box.expandByScalar(3);
            for (const a of areas) {
                if (a.kind !== 'water' || !a.waterMesh || a.size > 30000) continue;
                const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
                if (cx < box.min.x || cx > box.max.x || cz < box.min.z || cz > box.max.z) continue;
                const { mb, v0, v1 } = a.waterMesh; for (let i = v0; i < v1; i++) { mb.p[i * 3] = mb.p[v0 * 3]; mb.p[i * 3 + 1] = -50; mb.p[i * 3 + 2] = mb.p[v0 * 3 + 2]; }
                a.ownedBy = lm.id;
            }
        }
    }
    // All raw water edits (including landmark-owned pool collapse) are complete.
    // The cap-sensitive grouped topology is prepared once and later consumed by
    // normal final assembly only after exact source-buffer equality.
    if (deferredUnderpassDown.length) {
        try {
            __buildRaisedEdges.WATER_API = await import('./water.js');
            __buildRaisedEdges.preparedSmallWater = prepareSmallWaterGroups(cells, { subdivide: __buildRaisedEdges.WATER_API.subdivideWater, covered: coveredWater });
        } catch (error) { console.warn('Final water owner preparation unavailable; raw water remains unresolved', error); }
        if (__buildRaisedEdges.preparedSmallWater) {
            const retainedWater = [...__buildRaisedEdges.preparedSmallWater.values()].map(entry => waterOwnerSurface(entry.geometry, 'water-final:' + entry.key));
            retainedWater.push(...landmarkWaterSurfaces(landmarks));
            __buildRaisedEdges.underpassOwners = combineUnderpassWaterOwners(underpassGroundOwners, buildUnderpassOwnerIndex(retainedWater, underpassOwnerOptions));
        }
        for (const emitDown of deferredUnderpassDown) emitDown();
    }
    // landmark collision boxes must not reach into a carriageway (e.g. the squashed SeaTac / OTP terminals over their drives)
    let lmTrim = 0, lmDrop = 0;
    for (let i = collisionBoxes.length - 1; i >= 0; i--) {
        const b = collisionBoxes[i]; b.kind = 'landmark';
        if (b.poly) continue; // exact source walls/courtyards must not be shrunk as a coarse OBB
        let k = 0;
        while (k < 8 && polyOnRibbon(obbPoly(b))) {
            // shrink the side that overlaps: try each axis alone first, then both
            const hw = b.hw, hd = b.hd;
            b.hw = hw * 0.85; if (!polyOnRibbon(obbPoly(b))) { k++; break; }
            b.hw = hw; b.hd = hd * 0.85; if (!polyOnRibbon(obbPoly(b))) { k++; break; }
            b.hw = hw * 0.85; k++;
        }
        b.r = Math.hypot(b.hw, b.hd);
        if (polyOnRibbon(obbPoly(b)) || b.hw < 0.5 || b.hd < 0.5) { collisionBoxes.splice(i, 1); lmDrop++; } else if (k) lmTrim++;
    }
    // (sports grounds: world-sports.js)
    const {
        dressSports,
    } = makeDressSports({
        areas, buildingAt, cellOf, landmarks, lmGrounds, onRibbon, sportAreaLog, sportsColl,
        __live: {
            get pitchesDressed() { return pitchesDressed; }, set pitchesDressed(v) { pitchesDressed = v; },
        },
    });
    dressSports();
    // (pois: world-pois.js)
    const {
        poiDoorGuides, poiGroup, pois, signs,
    } = buildPois({
        LANDMARKS, bGrid, buildingAt, city, group, inDistrictLL, landmarks, nearestEdge,
        nodeArr, polyDist, retract,
    });
    // (facade detail: world-facade-detail.js)
    const __buildFacadeDetail = await buildFacadeDetail({
        ASPHALT, DY_SIDE, LANDMARKS, US, areas, asphaltCorners, bGrid, bRecs,
        basarabBlue, bridgeJunctionDecks, buildPool, builderEpoch, buildingAt, buildingIndex, carParkOutlines, cellOf,
        cells, city, clipBuildingDetails, convexRing, country, coveredByOther, coveredOutlines, data,
        distCfg, distId, edgeGrid, edges, edgesInBox, floatingSupport, fountainBasinColl, group, inDistrictLL,
        insetRing, isPark, isWater, landmarkFences, landmarks, lazyRoofMesh, liftOnSide, lmGroup,
        medianFill, medianGrid, nearestEdge, obbPoly, onRibbon, padHeightAt, pasajPortals, pasajStats,
        pierColl, pois, polyDist, polyOnRibbon, raised, raisedDeck, raisedTop, retainedDeck,
        roofPrefetch, roofProfileAudit, sceneryDeckGrid, sceneryStopEdge, sceneryStreetNear, segsCross, signMB, signs,
        sportsColl, stopMarginM, str, surfGrid, surfList, surfacesAt, tramDecks, tramGrades,
        tramPropEnvelope, tramSweep, tramSweepConflicts, trams, walls, widthAsphalt, widthSide, yAlong,
        __live: {
            get solidMat() { return solidMat; },
        },
    });
    const {
        P, addPropColl, addSignQuad, basarabStructure, bridgeBents, collision, facadeBoards, fasciaLayoutAudit,
        fenceSegs, fuelForecourts, fuelLog, guardCompletion, propColl, railingDrops, railingNetwork, reviewedBridgeRailings,
        roofAdList, roofAds, signedSpots, tramRailings, transitShelterAudit, treeClear, vacantUnits, waterBridgeRailings,
    } = __buildFacadeDetail;
    // (streetscape: world-streetscape.js)
    const __buildStreetscape = await buildStreetscape({
        ASPHALT, DY_SIDE, P, SIDE_BACK, US, addPropColl, addSignQuad, areas,
        bGrid, basarabStructure, boundarySupport, builderEpoch, buildingAt, cellOf, cells, channelAreas,
        city, clearOf, clusters, cornerPolys, data, distId, dmask: __buildAreasWater.dmask, earlyAtlas,
        edges, finishPendingRanges, group, inArea, isWater, kerbSpot, lampSpots, landmarkWaterFootprints,
        liftOnSide, lmGrounds, mapEnds, medianFill, nearWater, nearestEdge, nodeArr, obbPoly,
        onRibbon, pierColl, pois, polyDist, polyOnRibbon, propColl, raisedEdge, raisedTop,
        retract, ribGrid, rng, sceneryDeckGrid, signs, str, surfacesAt, sweptOut,
        tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, treeClear, treeSpots, underpassCover, walls,
        widthAsphalt, yAlong,
    });
    const {
        LAMP_COL, LAMP_Y, __buildStreetFurniture, atlas, basarabLamps, channelM, closures, deckLamps,
        elevatedDataset, elevatedPlan, fillLamps, furnCount, groundMat, lampGrid, lampHeadMesh, lampMesh,
        lampNear, lampPostMesh, lamps, lampsMoved, lights, marksMat, nearDoor, nodeLight,
        noise, padMat, parked, parkedLots, parkingClearance, roadMat, solidMat, spillMat,
        tmpM, treeAdditions, treeBuildingClearance, treeCount, treeDeckClearance, treeList, treeNear, treesOSM,
        treesRows, useInst, vegetation, waterTreeConflicts,
    } = __buildStreetscape;
    try { const W2 = __buildRaisedEdges.WATER_API = __buildRaisedEdges.WATER_API || await import('./water.js'); __buildStreetscape.waterMat = W2.makeWaterMaterial({ deep: US ? '#1d3340' : '#2b3a33', shallow: US ? '#3a5563' : '#46564a', flow: [0.25, 0.08] }); __buildStreetscape.waterMat.depthWrite = false; } catch (err) { console.warn('water.js unavailable', err); }
    if (!__buildStreetscape.waterMat) __buildStreetscape.waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, depthWrite: false });
    // (world finish: world-finish.js)
    const {
        allColl, allEdges, collGrid, districts, fallbackReady, flightBoundary, insideDistrict, sky,
        spawn, stats, waterMesh,
    } = buildWorldFinish({
        ASPHALT, LANDMARKS, US, WATER_API: __buildRaisedEdges.WATER_API, __buildPaintSetup, __buildRibbons, __buildRoadGraphAids, __buildStreetFurniture,
        addPropColl, areas, assemblyAudit, assemblyRejected, atlas, bDropped, bGrid, bRecs,
        bShrunk, basarabLamps, bigWater, boundarySupport, bounds, bridgeBents, bridgeJunctionAudit, bridgeWalkways, buildPool,
        buildingAt, buildingPassageAudit, cellOf, cells, channelCuts, channelM, city, clearanceAudit,
        collision, collisionBoxes, cornerPolys, cornerSkips, country, coveredOutlines, coveredRoadModels, coveredWater,
        crossings, data, deckLamps, distCfg, distId, dmask: __buildAreasWater.dmask, edges, elevatedDataset,
        elevatedPlan, entranceCanopies, env, facadeBoards, fasciaLayoutAudit, fenceSegs, fillLamps, floatingSupport,
        fuelForecourts, fuelLog, furnCount, graph, groundMat, group, guardCompletion, hallFurnitureStats,
        heightFixes, inArea, inferredDetailAudit, isPark, isWater, lampNear, lamps, lampsMoved,
        landmarkPits, landmarkSourceReplacements, landmarkSurfaceMats, landmarkWaterFootprints, landmarks, liftOnSide, lights, lmDrop,
        lmTrim, mapEnds, marksMat, medianFill, medianLinkSidewalks, nearDoor, nearWater, nearestEdge,
        nodeArr, nodes, noise, obbPoly, onRibbon, opts, outlineParts, overlapCuts,
        padMat, parked, parkedLots, parkingClearance, pasajPortals, pasajStats, physicalUnionAudit, physicalUnionRejected,
        pierColl, poiDoorGuides, poiGroup, pois, polyDist, polyOnRibbon, preparedSmallWater: __buildRaisedEdges.preparedSmallWater, profileStats,
        propColl, railRoadside, railingDrops, railingNetwork, raisedTop, retract, reviewedBridgeRailings, ribGrid,
        rng, roadMat, roofAdList, roofAds, roofProfileAudit, sceneryDeckGrid, sideJoins, signedSpots,
        signs, solidMat, spillMat, sportAreaLog, str, surfacesAt, sweptOut, t0,
        tramGrades, tramPropEnvelope, tramRailings, tramSweep, tramSweepConflicts, transitShelterAudit, treeAdditions, treeBuildingClearance,
        treeClear, treeCount, treeDeckClearance, treeNear, treesOSM, treesRows, trenchGoreCuts, trenchQuads,
        underpassColl, underpassCollEdges, underpassCover, underpassOwners: __buildRaisedEdges.underpassOwners, underpassRoofAudit, useInst, vacantUnits, vegetation,
        wallCut, walls, waterBridgeRailings, waterChannelAudit, waterLineAudit, waterMat: __buildStreetscape.waterMat, waterOutlineAudit, waterTreeConflicts,
        yAlong,
        __live: {
            get pitchesDressed() { return pitchesDressed; },
            get signCount() { return __buildStreetscape.signCount; },
            get trenchCutTris() { return __buildAreasWater.trenchCutTris; },
            get unitSigns() { return __buildFacadeDetail.unitSigns; },
            get world() { return world; },
        },
    });

    /** calls cb(height) for every drivable surface (carriageway + shoulder + sidewalk, junction pads) covering (x, z) */
    function surfacesAt(x, z, cb, prefer = null, carriagewayOnly = false, exclude = null) {
        let seen = null; // (made for the first edge near enough: four in five that the grid cells hold are not)
        sceneryDeckGrid.each(x, z, x, z, deck => { if (pointInPolygon(x, z, deck.poly)) cb(deck.roofHeightAt(x, z),false,deck); });
        if (!carriagewayOnly && cornerPolys.length) { // a raised junction corner: the only surface there (cb(h, raised))
            let hc = null, hcDeck = false; cornerGrid.each(x, z, x, z, (cp) => { if (hc === null && x >= cp.x0 && x <= cp.x1 && z >= cp.z0 && z <= cp.z1 && pointInPolygon(x, z, cp.p)) { hc = Y.road + Y.kerb + padHeightAt(cp.n, x, z); hcDeck = !!cp.deck; } });
            if (hc !== null && !onRibbon(x, z, 0, hcDeck ? ribbonsAtLevel(x, z, hc - Y.road - Y.kerb) : RIB_ONLY)) { cb(hc, true); return; }
        }
        // (spec 10 load budget) the edge grid's cells as flat arrays (surfCells): the same cells and edges in the same order
        // as edgeGrid.each(x - 2, z - 2, x + 2, z + 2), each edge's first test read from numbers instead of the edge
        if (!surfCells) surfCells = surfCellsOf();
        const gc = edgeGrid.cell, i1 = Math.floor((x + 2) / gc), j0 = Math.floor((z - 2) / gc), j1 = Math.floor((z + 2) / gc);
        for (let i = Math.floor((x - 2) / gc); i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const cellE = surfCells.get(edgeGrid.k(i, j)); if (!cellE) continue;
            const { list, box } = cellE;
            for (let k = 0; k < list.length; k++) {
                const o = 7 * k; if (box[o + 6]) continue; // (virtual)
                const e = list[k]; if (e === exclude) continue;
                // the distance below is at least the gap to the edge's box; lim is at most the wider width + the largest
                // shoulder (1.2) + the wider sidewalk + SIDE_BACK (+ 1.5 preferred): past that bound it returns anyway. The
                // test is a pure function of the edge and the point, so it comes before the duplicate check (same answers)
                const gap = Math.max(box[o] - x, x - box[o + 1], box[o + 2] - z, z - box[o + 3]), reach = carriagewayOnly ? box[o + 5] : box[o + 4];
                if (gap > (e === prefer ? reach + 1.5 : reach) + 1e-6) continue;
                if (!seen) seen = new Set(); else if (seen.has(e)) continue;
                seen.add(e);
                const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
                const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1;
                const walkShift = e.deckWalkShift && !carriagewayOnly ? deckWalkShiftAt(e, side, q.t) : 0; // (a deck walkway as drawn, bridge-walkways.js)
                const lim = (side > 0 ? e.wR : e.wL) + shoulderOf(e) + (carriagewayOnly ? 0 : sidewalkWidth(e, side) + (raisedEdge(e, side) ? SIDE_BACK : 0.05)) + (e === prefer ? 1.5 : 0) + walkShift;
                if (q.d > lim) continue;
                if ((q.t <= 0 || q.t >= 1) && Math.hypot(x - (q.t <= 0 ? e.a.x : e.b.x), z - (q.t <= 0 ? e.a.z : e.b.z)) > (q.t <= 0 ? e.a : e.b).radius + (carriagewayOnly ? 0 : 1)) continue;
                const h = Y.road + yAlong(e,x,z);
                if (!carriagewayOnly && q.t > 0 && q.t < 1 && raisedEdge(e, side) && q.d > widthAsphalt(e, side) + walkShift + 0.02 && !onRibbon(x, z, 0, e.deckWalk && e.bridge ? ribbonsAtLevel(x, z, h - Y.road, e) : RIB_ONLY)) { const sh = railRoadside.surface(e, x, z, h + Y.kerb); if (sh !== null) cb(sh, sh > h + .01); continue; } // source-rail flush paving follows rendered h
                let adjusted = railRoadside.surface(e, x, z, h);
                if (adjusted === null && !carriagewayOnly) adjusted = railRoadside.surface(e, x, z, h + Y.side - Y.road);
                if (adjusted !== null) cb(adjusted);
            }
        }
    }
    /** surfacesAt's flat edge cells: per cell of edgeGrid its edge list and, per edge, 7 numbers: its box (x0, x1, z0, z1),
     *  its reach with and without the sidewalk (wider width + 1.2 (+ wider sidewalk + SIDE_BACK)) and 1 when virtual.
     *  Made at the first query: edge widths, sidewalks and node positions are final by then, and the grid is never added to. */
    function surfCellsOf() {
        const out = new Map();
        for (const [key, list] of edgeGrid.map) {
            const box = new Float64Array(list.length * 7);
            list.forEach((e, k) => {
                const o = 7 * k, base = Math.max(e.wR, e.wL) + 1.2;
                box[o] = Math.min(e.a.x, e.b.x); box[o + 1] = Math.max(e.a.x, e.b.x); box[o + 2] = Math.min(e.a.z, e.b.z); box[o + 3] = Math.max(e.a.z, e.b.z);
                box[o + 4] = base + (Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) + SIDE_BACK) + (e.deckWalkShift ? Math.max(0, ...Object.values(e.deckWalkShift).flat()) : 0); box[o + 5] = base + 0; box[o + 6] = e.virtual ? 1 : 0;
            });
            out.set(key, { list, box });
        }
        return out;
    }
    // (world api: world-api.js)
    const {
        world,
    } = buildWorldApi({
        LAMP_COL, LAMP_Y, __buildRoadGraphAids, allColl, allEdges, areas, basarabStructure, blocksLane,
        boundarySupport, bounds, bridgeBents, bx0, bx1, bz0, bz1, city,
        closures, collGrid, data, distCfg, distId, districts, dmask: __buildAreasWater.dmask, edges,
        edgesInBox, flightBoundary, graph, group, insideDistrict, isPark, isWater, lampGrid,
        lampHeadMesh, lampMesh, lampPostMesh, lamps, landmarkPits, landmarks, lights, mapEnds,
        nearestEdge, nodeArr, nodeLight, obbPoly, onRibbon, parapetOwnership, pois, polyOnRibbon,
        raisedTop, ribbons, segsCross, sharedBridgeMeshAudit, sharedBridgeProfile, sideExtra, sky, spawn,
        stats, surfacesAt, tmpM, tramDeckSupportAt, tramDecks, tramGrades, trams, treeList,
        vegetation, walls, waterMesh, widthAsphalt, widthSide, yAlong,
    });
    void renderer;
    world.ready = fallbackReady.then(fallback => { stats.fallbackGround = fallback.report; });
    if (!opts.deferGround) await world.ready;
    return world;
}

export { buildingBlocksRoad, collisionBounds, collideOne, collideBuildings } from './world-collide.js';
