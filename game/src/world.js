import { prepareSmallWaterGroups, waterOwnerSurface, landmarkWaterSurfaces, combineUnderpassWaterOwners } from './final-water-topology.js';
import { buildUnderpassOwnerIndex } from './underpass-ground-owner.js';
import { sharedBridgePadSurface } from './bridge-pad-profile.js';

import { shapeDeckSoup } from './bridge-surface-mesh.js';
import * as THREE from '../vendor/three.module.min.js';
import { distPointSeg, pointInPolygon } from './util.js';
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
        EG, data, edgeGrid, edges, nodeArr, str,
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
        let narrowed = 0;
        for (const e of edges) {
            if (e.virtual || e.tunnel || !(Math.max(e.ya, e.yb) > .3) || (e.ya + e.yb) / 2 > 4.5 || e.roadWidthSource) continue; // (low enough to stand on its walls: a higher deck passes over the street)
            for (const sd of [1, -1]) {
                let gap = Infinity;
                for (const t of [.2, .5, .8]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
                    edgesInBox(x - 12, z - 12, x + 12, z + 12, f => {
                        if (f === e || f.virtual || f.tunnel || f.bridge || Math.max(Math.abs(f.ya), Math.abs(f.yb)) > .3 || Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) < .9) return;
                        if (f.a === e.a || f.a === e.b || f.b === e.a || f.b === e.b) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= .02 || q.t >= .98) return;
                        if (((q.cx - x) * e.nx + (q.cz - z) * e.nz) * sd <= 0) return; // (on this side)
                        const fSide = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? f.wR : f.wL;
                        gap = Math.min(gap, q.d - fSide - shoulderOf(f));
                    });
                }
                const key = sd > 0 ? 'wR' : 'wL', have = e[key] + shoulderOf(e) + sidewalkWidth(e, sd);
                if (!(gap < have - .05)) continue;
                if (sd > 0) e.sidewalkRightM = 0; else e.sidewalkLeftM = 0;
                const lanes = Math.max(1, e.lanesF + e.lanesB), other = sd > 0 ? e.wL : e.wR, minSide = Math.max(1.3, 2.6 * lanes - other);
                const nw = Math.max(minSide, gap - shoulderOf(e));
                if (nw < e[key] - .05) { e[key] = nw; e.laneW = Math.min(e.laneW, (e.wL + e.wR) / lanes); if (e.oneway) e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); }
                narrowed++;
            }
        }
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.raisedBesideStreet = narrowed; }
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
                e[key] = nw; e.laneW = Math.min(e.laneW, (e.wL + e.wR) / lanes); if (e.oneway) e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); narrowed++;
            }
        }
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; __buildRoadGraphAids.sccInfo.narrowedBesideTram = narrowed; }
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
        cornerGrid, cornerPolys, cornerSkips, coveredByOther, data, edgeGrid, edges, kerbCol,
        layerY, padAsphalt, padCorners, padHeightAt, pierColl, pierSpots, polyDist, railRoadside,
        raised, raisedEdge, retainedDeck, ribbons, sceneryDeckGrid, sharedPadSurfaces, sideCol, sideExtra,
        sideJoins, widthAsphalt, widthSide, yAlong,
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
        distId, edgeGrid, edges, edgesInBox, floatingSupport, fountainBasinColl, group, inDistrictLL,
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
