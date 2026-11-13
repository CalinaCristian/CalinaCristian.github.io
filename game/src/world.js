import { fitFacadeSign, facadeSignBoard } from './facade-sign-layout.js';
import { sourceWaterTreeConflicts } from './source-water-tree-conflicts.js';
import { reviewedTreeExclusions } from './tree-reviews.js';
import { emitOvalDormers } from './reviewed-dormers.js';
import { emitHallFurniture, HALL_FURNITURE_MODEL } from './hall-furniture.js';
import { reviewedLampForm, CANDELABRA_MODEL } from './lamp-reviews.js';
import { emitPlaygrounds } from './playgrounds.js';
import { emitCarParkFronts } from './car-park-fronts.js';
import { emitStreetLevelWaterBridgeRailings, emitReviewedStreetBridgeRailings } from './water-bridge-railings.js';
import { emitPedestrianBridges, PEDESTRIAN_BRIDGES } from './pedestrian-bridges.js';
import { trenchParapetRow, emitTrenchBalustrade } from './trench-parapets.js';
import { nonShopWindowBands } from './facade-window-bands.js';
import { sourceTransitShelterDecision } from './source-transit-shelter.js';
import { projectCoveredWater, coveredWaterHulls, prepareFinalWaterGeometry, prepareSmallWaterGroups, consumePreparedSmallWater, waterOwnerSurface, landmarkWaterSurfaces, combineUnderpassWaterOwners } from './final-water-topology.js';
import { buildUnderpassOwnerIndex } from './underpass-ground-owner.js';
import { underpassRoofModel, underpassRoofFaces, underpassRoofCollider, UNDERPASS_COVER_POLICY } from './underpass-roof.js';
import { sharedBridgePadSurface } from './bridge-pad-profile.js';
import { compileSharedBridgeProfile } from './shared-bridge-profile.js';
import { buildGeneratedParapetOwnership, emitOwnedSeparationQuad } from './generated-parapet-ownership.js';

import { compileSourceBridgeDescents } from './source-bridge-descents.js';
import { displaceBridgeSurface, shapeDeckSoup, exactMemo3 } from './bridge-surface-mesh.js';
import { displaceBandedSurface } from './bridge-surface-band.js';
import { splitMeshByTiles } from './mesh-tiles.js';
import * as THREE from '../vendor/three.module.min.js';
import { makeRng, distPointSeg, pointInPolygon, clamp, makeCanvasTexture, landmarkHelpers } from './util.js';
import { buildingBlocksRoad, collisionBounds } from './world-collide.js';
import { makeAtlas, nightAtlas, solidMaterial, noiseTexture, SignAtlas } from './world-materials.js';
import { emitFacadeSlab } from './buildings.js';
import { footprintCells, insetFootprint, assemblySignature, geometryRing, geometrySurface } from './building-parts.js';
import { validRoofProfile, roofMesh, roofSignature } from './building-roofs.js';
import { districtFile, fetchDistrictPack, parseDistrictPackText, signatureMatches, signatureMatcher } from './district-pack.js';
import { triangulate } from './triangulate.js';
import { sharedBuildPool } from './build-pool.js';
import { sourceSurfaceEligible, validateSourceSurface } from './building-surface-cache.js';
import { clipBuildingDetailRange } from './building-detail-range.js';
import { clipInferredBuildingDetail } from './building-detail-visibility.js';
import { sourceTreeCentrePolicy, treeCentreDuplicate, treeCentreWater } from './source-tree-centres.js';
import { canopyGeometry } from './building-canopies.js';
import { makeVehicle, CAR_COLORS, makeParkedCars, vehicleSize, VEHICLE_KINDS } from './vehicles.js';
import { projector, CHAPTERS } from './cities.js';
import { STOPS } from './data.js';
import { MeshBuilder, rgb, shadeRgb, mergeProps, bakeProp } from './geobuild.js';
import { treeGeometries, SPECIES, defaultSpecies, buildSpeciesTrees, speciesFromOSM } from './trees.js';
import { assignSignalPhases, signalState } from './signals.js';
import { aircraftBody } from './building-aircraft.js';
import { resolveParkingLayout, parkingRowPose, parkingPolygonsOverlap, parkingBodyOverlap } from './parking-layout.js';
import { passageSolids, clipPassageWall, passageInterior, passageBaseUnknown } from './building-passages.js';
import { scenerySourceProfile } from './scenery-source.js';
import { sceneryBridgeProfiles, sceneryDeckBand } from './scenery-bridges.js';
import { batchWaterChunks } from './water-batch.js';
import { cullMergedCells } from './cell-frustum.js';
import { fallbackGroundApertures, buildFallbackGround, buildFallbackGroundParallel } from './fallback-ground.js';
import { backdropSourceOwner } from './backdrop-source-owner.js';
import { waterChannelDecision } from './water-channel.js';
import { uncoveredWaterLine } from './water-lines.js';
import { buildTramGrades, tramGradeRenderPieces, tramSupportPieceId } from './tram-grade.js';
import { TRAM_BRIDGE_MODELS } from './tram-grade-models.js';
import { buildTramTunnelGrades } from './tram-tunnel-grade.js';
import { buildTramTrenchCutter, uncoveredTramTrenchWall } from './tram-trench.js';
import { sourceSidewalkSides, sidewalkWidth } from './sidewalk-source.js';
import { emittedTramClearance } from './tram-clearance.js';
import { inferredRoadSignUnit } from './inferred-road-sign.js';
import { bridgeJunctionSlab, inferredBridgeFasciaUpstand, uncoveredBridgePadBoundary } from './bridge-junction.js';
import { planBridgeBents, BENT_MODEL } from './bridge-bents.js';
import { basarabEdge, buildBasarabStructure, drawBasarabGuard, bridgeBeam, basarabGuardPlace, BASARAB_GUARD_STEEL } from './basarab-structure.js';
import { coveredPlatformCanopies } from './covered-platform-canopies.js';
import { BASARAB_PLATFORMS } from './basarab-source.js';
import { raisedRoadTriangles } from './basarab-anchor-clearance.js';
import { buildRailRoadsideClearance } from './rail-roadside.js';
import { districtTramSweep } from './tram-sweep.js';
import { planOverlapCuts, planOverlapCutsParallel } from './building-overlap.js';
import { buildCoveredRoadModels } from './covered-road-models.js';
import { roadMiter, needsRoadBevelPad } from './road-joins.js';
import { markingArea, clipMarkingHalfPlane, clipMarkingConvex, subtractMarkingConvex, clipAffineMarkingRange, buildMarkingStations, markingDashIntervals } from './road-markings.js';
import { decodeDistrictMask, buildSourceBoundarySupport, normalizeSourceMapEnds, districtMaskSegments } from './district-boundary.js';

import { subtractConvex } from './building-overlap.js';
import { emitMonuments } from './monuments.js';
import { AREA_SPORT, emitBankedTrack, emitRugbyLeague } from './sport-areas.js';
import { emitParkWalls } from './park-walls.js';
import { emitDeckLamps } from './deck-lamps.js';
import { emitFacadeBands } from './facade-bands.js';
import { placeTreeAdditions } from './tree-additions.js';
import { channelProfile } from './water-channel-review.js';
import { carParkOf, carParkLevels, emitCarParkWall, reviewedCarParkHeight } from './car-parks.js';
import { emitFuelForecourt } from './fuel-forecourt.js';
import { fuelStationRow, fuelLookFor, fasciaQuads } from './fuel-look.js';
import { reviewBrands } from './brand-review.js';
import { emitWeirs } from './weirs.js';
import { dropMedianLinkSidewalks } from './sidewalk-overlap.js';
import { emitBellevueGuideway, WILBURTON_STATION } from './bellevue-guideway.js';
import { emitSeatacGuideway } from './seatac-guideway.js';
import { garageDeckRoads } from './garage-decks.js';
import { buildElevatedSources, planElevatedSources } from './elevated-sources.js';
import { openRuns, weldEnds } from './deck-outline.js';
import { applyBuildingReview } from './building-review.js';
import { emitWorshipOpenings, worshipHasTowerTag } from './worship.js';
import { pavedReviewAreas } from './ground-review.js';
import { reviewedGradeK } from './grade-review.js';
import { emitAirportForecourt } from './airport-forecourt.js';
import { emitAreaFences } from './area-fences.js';
import { applyEntranceCanopies, emitUnderpassMouths } from './underpass-mouths.js';
import { applyFuelCanopyReview } from './fuel-canopy-review.js';
import { PEDESTRIAN_FRONTS } from './pedestrian-fronts.js';
import { bridgeGuardRow, emitBridgeGuard, guardBlockH, emitGuardSteel, emitGuardScreen, GUARD_CONCRETE } from './bridge-guards.js';
import { AREA_Y, AWNING, BoxGrid, CELL, CLASS_RANK, FOUNTAIN_COPING, GRASSY, KIND_STYLE, PALETTES, PAVED, PHASES, ROOF_COL, SPORT_KINDS, STOP_POLE_ONLY, TILE, TILE_GRID, TRAFFIC_MUL, VILLA_PAL, Y, archetypesModule, brandStyle, buildSky, carProps, centroid, convexHull, isMotorwayTrunk, landmarksModule, mixRgb, polysCross, props, setProgress, setRESEARCHBRANDS, shadeHex, shoulderOf, signedArea, tick, undelta } from './world-shared.js';
import { buildScenery } from './world-scenery.js';
import { buildStreetFurniture } from './world-furniture.js';
import { buildRoofAdsFuel } from './world-roofads-fuel.js';
import { buildRailingNetwork } from './world-railing-network.js';
import { buildFacadesGuards } from './world-facades-guards.js';
import { buildLandmarkGrounds } from './world-landmark-grounds.js';
import { buildBuildingsLandmarks } from './world-buildings.js';
import { buildSideJoins } from './world-side-joins.js';
import { buildRibbons } from './world-ribbons.js';
import { buildRoadGraphAids } from './world-road-graph.js';
import { buildFinalMeshes } from './world-final-meshes.js';
import { buildParkingLights } from './world-parking-lights.js';
import { buildTreesLamps } from './world-trees-lamps.js';
import { buildPaintSetup } from './world-paint-setup.js';

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
    const t0 = performance.now();
    setProgress('Loading OpenStreetMap data…');
    // buildWorld(city, renderer, { district, start }) builds one chapter district from game/data/<city>-<district>.bin.gz
    // (real 1:1 scale; the whole-city corridor maps are gone, spec 22)
    const distId = opts.district, distCfg = (city.districts || {})[distId];
    if (!distCfg) throw new Error(`unknown district ${city.id}:${distId}`);
    const inDistrictLL = (lat, lon, m = 0.0015) => (lat >= distCfg.bbox[0] - m && lat <= distCfg.bbox[2] + m && lon >= distCfg.bbox[1] - m * 1.4 && lon <= distCfg.bbox[3] + m * 1.4);
    // a lossless binary pack (game/src/district-pack.js, spec 10 size / load budget)
    const url = new URL(`../data/${districtFile(city.id, distId)}`, import.meta.url).href;
    // (spec 10 load budget) workers for the pure passes; null without module workers: then all runs here.
    // A worker fetches the pack and writes its JSON text; JSON.parse here gives the same object as fetchDistrictPack.
    const buildPool = sharedBuildPool();
    buildPool?.reset();
    let data = null;
    const packText = buildPool ? buildPool.packText(url) : null;
    // (spec 10 load budget) the facade atlas and its night data do not depend on the place: they are painted while the
    // worker decodes the pack (canvas textures only; the materials are made where they were)
    const earlyAtlas = (() => { try { const atlas = makeAtlas(); let night = null; try { night = nightAtlas(atlas); } catch (e) { /* solidMaterial reports it */ } return { atlas, night }; } catch (e) { return null; } })();
    // and the traffic's vehicle models (vehicles.js keeps one per kind and city, built the same whenever it is asked first)
    if (packText) try { for (const kind of VEHICLE_KINDS) vehicleSize(kind, city.id); } catch (e) { /* made where they were */ }
    if (packText) try { data = parseDistrictPackText(await packText); } catch (e) { console.warn('[world] pack worker failed, decoding here', e); }
    if (!data) data = await fetchDistrictPack(url);
    // field research (spec 20): street-tree notes per street, baked by tools/osm into data.streetTrees
    // ({street name: [species keys]}, [] = researched as treeless) — no runtime fetch of the research dossier
    const researchTrees = new Map(); // street name → { species: [...], none }
    for (const [name, out] of Object.entries(data.streetTrees || {})) researchTrees.set(name, { species: out, none: !out.length });
    setRESEARCHBRANDS(reviewBrands(city.id + '-' + distId, data.brands || {})); // (r3: sign colours corrected at the street, brand-review.js)
    setProgress('Building the road network…'); await tick();

    // projection (header is authoritative)
    city.proj = projector(data.proj);
    const US = city.id === 'seattle' || /US/i.test(city.country || '');
    const country = US ? 'US' : 'RO';
    const rng = makeRng(city.id === 'bucharest' ? 1337 : 4242);
    const env = city.env;
    const group = new THREE.Group();
    group.name = 'world';
    const sceneryDeckGrid = new BoxGrid(32); // surfacesAt is also called before scenery geometry is emitted
    const S = data.strings;
    const str = (i) => (i >= 0 ? S[i] : '');

    // -----------------------------------------------------------------------
    //  GRAPH
    // -----------------------------------------------------------------------
    const nodes = {};
    const nodeArr = [];
    for (let i = 0; i < data.nodes.length; i += 2) {
        const n = { id: i / 2, sourceId: data.roadNodeIds?.[i / 2], x: data.roadNodePositions?.[i] ?? data.nodes[i] * 0.1, z: data.roadNodePositions?.[i + 1] ?? data.nodes[i + 1] * 0.1, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0 };
        nodeArr.push(n);
    }
    for (let i = 0; i < data.nodeFlags.length; i += 2) {
        const n = nodeArr[data.nodeFlags[i]], f = data.nodeFlags[i + 1];
        n.flags = f; n.signal = !!(f & 1) || !!(f & 8); n.crossing = !!(f & 2); n.zebra = !!(f & 4) || !!(f & 8); n.stop = !!(f & 16); n.giveWay = !!(f & 32);
        n.busStop = !!(f & 64); n.tramStop = !!(f & 128); n.speedCamera = !!(f & 256); n.redLightCamera = !!(f & 1024);
    }
    const edges = [];
    const seenPair = new Set();
    const roads = data.roads.map((r, ri) => {
        const cls = data.classes[r[1]];
        const flags = r[8];
        const shared = data.sharedLanes?.[ri], width = data.roadWidths?.[ri];
        return {
            index: ri, name: str(r[0]), type: cls, lanesF: r[2], lanesB: r[3], median: shared ? 0 : width ? ((flags & 1) ? -width.widthM : width.medianM) : r[4] / 10, laneW: shared ? shared.widthM / 2 : width?.laneWidthM ?? r[5] / 10, sidewalk: r[6] / 10,
            sharedLane: !!shared, sharedLaneWidthM: shared?.widthM, sharedLaneSource: shared,
            roadWidthSource: width || null, laneCenterShiftM: width?.laneCenterShiftM || 0, access: data.roadAccess?.[ri] || null,
            maxspeed: r[7] / 3.6, flags, layer: r[9], ids: r.slice(10),
            oneway: !!(flags & 1), bridge: !!(flags & 2), tunnel: !!(flags & 4), roundabout: !!(flags & 8), busLane: !!(flags & 16),
            tram: !!(flags & 32), toll: !!(flags & 64), unpaved: !!(flags & 128), tramMedian: !!(flags & 256),
            bikeLane: !!(flags & 512), cycleTrack: !!(flags & 1024), lit: !!(flags & 2048), unlit: !!(flags & 4096),
        };
    });
    const unnamed = US ? '' : '';
    const garageDecks = garageDeckRoads(data); // (h-seatac-garage: car-park deck aisles, garage-decks.js)
    for (const rd of roads) {
        if (garageDecks.has(rd.index)) continue;
        for (let i = 0; i < rd.ids.length - 1; i++) {
            const a = nodeArr[rd.ids[i]], b = nodeArr[rd.ids[i + 1]];
            if (a === b) continue;
            const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
            if (seenPair.has(key)) continue; seenPair.add(key);
            const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
            if (len < 0.05) continue;
            const dirx = dx / len, dirz = dz / len;
            const median = rd.median;
            const wR = rd.roadWidthSource?.rightM ?? median / 2 + rd.lanesF * rd.laneW;
            const wL = rd.roadWidthSource?.leftM ?? (rd.oneway ? rd.lanesF * rd.laneW / 2 : median / 2 + rd.lanesB * rd.laneW);
            const e = {
                id: edges.length, a, b, dirx, dirz, len, nx: -dirz, nz: dirx,
                name: rd.name || unnamed, type: rd.type, road: rd.index,
                lanesF: rd.lanesF, lanesB: rd.oneway ? 0 : rd.lanesB, lanes: Math.max(rd.lanesF, rd.oneway ? 0 : rd.lanesB), oneway: rd.oneway,
                laneW: rd.laneW, median, wR, wL, halfW: Math.max(wR, wL), sidewalk: rd.sidewalk,
                sharedLane: rd.sharedLane, sharedLaneWidthM: rd.sharedLaneWidthM, sharedLaneSource: rd.sharedLaneSource,
                roadWidthSource: rd.roadWidthSource, laneCenterShiftM: rd.laneCenterShiftM, access: rd.access, publicDrive: rd.access?.publicDrive !== false, throughAccess: rd.access?.throughAccess !== false,
                maxspeed: rd.maxspeed, speed: rd.maxspeed, tram: rd.tram, tramMedian: rd.tramMedian, bridge: rd.bridge, tunnel: rd.tunnel, toll: rd.toll,
                busLane: rd.busLane, roundabout: rd.roundabout, unpaved: rd.unpaved, layer: rd.layer, trafficMul: TRAFFIC_MUL[rd.type] ?? 0.5,
                bikeLane: rd.bikeLane, cycleTrack: rd.cycleTrack, lit: rd.lit, unlit: rd.unlit,
            };
            edges.push(e); a.edges.push(e); b.edges.push(e);
        }
    }
    // unnamed connector pieces (junction links of dual carriageways…) borrow a neighbour's name
    for (let pass = 0; pass < 3; pass++) for (const e of edges) {
        if (e.name || e.len > 80 || (CLASS_RANK[e.type] || 0) <= 2) continue;
        for (const n of [e.a, e.b]) { const o = n.edges.find(f => f !== e && f.name && (CLASS_RANK[f.type] || 0) >= (CLASS_RANK[e.type] || 0) - 1); if (o) { e.name = o.name; break; } }
    }
    // ---- (round 6) profile resolution: road heights live on nodes and are linear along an edge, so a 150 m deck edge
    //      (Doina Cornea's flyover) could only be one straight slope — its last 25 m lay 1–2 m above the street it merges
    //      into. Bridges and tunnels are cut into ≤ 10 m pieces (plain degree-2 nodes, like OSM's own) so the
    //      profile can bend where a ramp meets its street (gore pass below).
    {
        const PIECE = 10, src = edges.slice();
        let split = 0;
        for (const e of src) {
            if (e.len <= PIECE * 1.4 || !(e.bridge || e.tunnel)) continue; // (at-grade links stay whole: traffic queues / merges there)
            const k = Math.ceil(e.len / PIECE), b = e.b, plen = e.len / k;
            b.edges.splice(b.edges.indexOf(e), 1);
            let prev = e.a;
            for (let i = 1; i <= k; i++) {
                const n = i < k ? { id: nodeArr.length, x: e.a.x + e.dirx * plen * i, z: e.a.z + e.dirz * plen * i, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0, profilePt: true } : b;
                if (i < k) nodeArr.push(n);
                if (i === 1) e.seg = e.id;
                const p = i === 1 ? e : { ...e, id: edges.length };
                p.a = prev; p.b = n; p.len = plen;
                if (i === 1) { n.edges.push(e); } else { edges.push(p); prev.edges.push(p); n.edges.push(p); split++; }
                prev = n;
            }
        }
        if (split) console.info('[world] profile points: +' + split + ' edge pieces');
    }
    for (const n of nodeArr) {
        if (!n.edges.length) continue;
        n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5;
        nodes[n.id] = n;
    }

    // ---- edge spatial index
    const EG = 40;
    const edgeGrid = new BoxGrid(EG);
    for (const e of edges) edgeGrid.insert(Math.min(e.a.x, e.b.x), Math.min(e.a.z, e.b.z), Math.max(e.a.x, e.b.x), Math.max(e.a.z, e.b.z), e);
    let surfCells = null;
    // (world road graph: world-road-graph.js)
    const __buildRoadGraphAids = buildRoadGraphAids({
        EG, data, edgeGrid, edges, nodeArr, str,
    });
    const {
        CLEAR, GRADE, coveredRoadModels, crossings, edgesInBox, laneTapers, nearestEdge, sideExtra,
        trams,
    } = __buildRoadGraphAids; // {u (upper), f (lower), x, z}
    let profileStats = null, profileStats0 = null, wallCut = 0, blocksLane = null;
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
    const sharedBridgeProfile = compileSharedBridgeProfile(data, { coreEdges: edges,
        lanePolygon: e => asphaltCorners(e, (f, sd) => sd > 0 ? f.wR : f.wL),
        padLanePolygon: (n, incident) => convexHull(incident.flatMap(e => [corner(e,n,1,e.wR,(f,sd)=>sd>0?f.wR:f.wL),corner(e,n,-1,e.wL,(f,sd)=>sd>0?f.wR:f.wL)])),
        padSurfacePolygon:(n,incident)=>convexHull(incident.flatMap(e=>[corner(e,n,1,e.wR+shoulderOf(e),(f,sd)=>(sd>0?f.wR:f.wL)+shoulderOf(f)),corner(e,n,-1,e.wL+shoulderOf(e),(f,sd)=>(sd>0?f.wR:f.wL)+shoulderOf(f))])) });
    if (sharedBridgeProfile.known) {
        for (const e of edges) { const grade=sharedBridgeProfile.roadGrades.get(e.id); if(!grade)continue;e.sourceBridgeGrade=grade;e.a.y=grade.ya;e.b.y=grade.yb; }
        for (const e of edges) {e.ya=e.a.y;e.yb=e.b.y;}
    }
    const sourceBridgeDescents = compileSourceBridgeDescents(data, { coreEdges: edges,
        lanePolygon: e => asphaltCorners(e, (f, sd) => sd > 0 ? f.wR : f.wL),
        structuralPolygon: e => asphaltCorners(e, (f, sd) => (sd > 0 ? f.wR : f.wL) + shoulderOf(f) + sidewalkWidth(f,sd)),
        padLanePolygon: (n, incident) => convexHull(incident.flatMap(e => [corner(e,n,1,e.wR,(f,sd)=>sd>0?f.wR:f.wL),corner(e,n,-1,e.wL,(f,sd)=>sd>0?f.wR:f.wL)])) });
    if(sourceBridgeDescents.known){
        for(const e of edges){const grade=sourceBridgeDescents.roadGrades.get(e.id);if(!grade)continue;e.sourceBridgeGrade=grade;e.a.y=grade.ya;e.b.y=grade.yb;}
        for(const e of edges){e.ya=e.a.y;e.yb=e.b.y;}
    }
    sharedBridgeProfile.report.sourceDescents = sourceBridgeDescents.report;
    const deckAudit = [], deckJobs = []; let deckWorkers = false; // (deck shaping in the build workers: see displace)
    const sharedBridgeMeshAudit={inputTriangles:0,outputTriangles:0,maxLeafControlErrorM:0,depthLimit:0,limitSamples:[],worstControl:null};
    if(profileStats)profileStats.sharedBridge=sharedBridgeProfile.report;
    // (owner, 2026-11-12, Grozavesti (770, -1016) "lane gets tiny": the two Grivitei slip ramps left the 11 m deck level at
    // the fork node, but in plan their carriageways stay on the main deck for another 20-45 m, so the ramp ran up to 1.3 m
    // under the deck it joins and its lane vanished under that deck's edge. Their descent models now hold the crown level
    // to the source vertex where the two carriageways part: crownHoldSourceNode in source-bridge-descent-models.js.)
    const yAlong = (e, x, z) => { if(e.sourceBridgeGrade?.known)return e.sourceBridgeGrade.heightAtWorld(x,z); const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.ya + (e.yb - e.ya) * t; };
    coveredRoadModels.validateProfile(edges);
    const tunnelGrades = buildTramTunnelGrades(data, { coreEdges: edges });
    const tramGrades = buildTramGrades(data, { coreEdges: edges, extraGrades: tunnelGrades.grades, extraReport: tunnelGrades.report, sharedProfile: sharedBridgeProfile }), tramDecks = [];
    const tramPropEnvelope = (data.trams || []).length ? emittedTramClearance(makeVehicle, city.id) : null;
    const railRoadside = buildRailRoadsideClearance(tramGrades, tramPropEnvelope), railRoadsideCaps = [];
    const basarabBlue = new MeshBuilder(); // the blue band along the Basarab deck edges, repeated for the night lighting (see below)
    const bridgeJunctionDecks = [], bridgeJunctionAudit = { sourceForks: [], unresolved: [], undersideTriangles: 0, fasciaTriangles: 0 };
    /** height of junction n's pad at (x, z): the profile of the nearest approach there (n.y on flat junctions) */
    const padHeightAt = (n, x, z) => { const descent=sourceBridgeDescents.padHeightAt?.(n,x,z);if(descent!=null)return descent;const shared=sharedBridgeProfile.known&&sharedBridgeProfile.padHeightAt(n,x,z);if(shared!==false&&shared!=null)return shared; let best = null, bd = Infinity; for (const e of n.edges) { if (e.virtual) continue; const d = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z).d; if (d < bd) { bd = d; best = e; } } return best ? yAlong(best, x, z) : n.y; };

    // ---- traffic lights: move stop-line signals onto the junction they control, then cluster
    for (const n of nodeArr) {
        if (!n.signal || !n.edges.length) continue;
        if (n.edges.some(e => /motorway/.test(e.type))) continue;
        if (n.edges.length >= 3) { n.hasLight = true; continue; }
        if (n.flags & 8) { n.hasLight = true; continue; } // mapped controlled pedestrian crossing keeps its own controller
        // BFS along the graph up to 32 m for a junction
        let found = null; const seen = new Set([n]); let frontier = [[n, 0]];
        while (frontier.length && !found) {
            const nf = [];
            for (const [m, d] of frontier) for (const e of m.edges) {
                const o = e.a === m ? e.b : e.a; const dd = d + e.len;
                if (seen.has(o) || dd > 32) continue; seen.add(o);
                if (o.edges.length >= 3) { found = o; break; }
                nf.push([o, dd]);
            }
            frontier = nf;
        }
        if (found) { found.hasLight = true; n.crossing = true; n.zebra = true; }
        else n.hasLight = true; // stand-alone pedestrian light
    }
    // cluster nearby light nodes so complex junctions (dual carriageways) share one controller
    const lightNodes = nodeArr.filter(n => n.hasLight);
    const parent = new Map(lightNodes.map(n => [n, n]));
    const find = (n) => { while (parent.get(n) !== n) { parent.set(n, parent.get(parent.get(n))); n = parent.get(n); } return n; };
    {
        const g = new BoxGrid(70);
        for (const n of lightNodes) g.insert(n.x, n.z, n.x, n.z, n);
        // Wide divided junctions can put their stop-line nodes >38 m apart. Coordinate
        // them on the same level; a bridge above a signal is a different controller.
        for (const n of lightNodes) g.each(n.x - 65, n.z - 65, n.x + 65, n.z + 65, (m) => { if (m !== n && Math.abs(m.y - n.y) < 1.5 && Math.hypot(m.x - n.x, m.z - n.z) < 65) parent.set(find(m), find(n)); });
    }
    const clusters = new Map();
    for (const n of lightNodes) { const r = find(n); let c = clusters.get(r); if (!c) clusters.set(r, c = { nodes: [], offset: rng.range(0, 20) }); c.nodes.push(n); }
    for (const c of clusters.values()) {
        for (const n of c.nodes) n.lightCluster = c;
        // Profile/OSM shape nodes between the stop lines are inside the same box.
        // Retain source signal locations; these intermediate nodes gain no lamp.
        for (const n of c.nodes) for (const first of n.edges) {
            let e = first, m = e.a === n ? e.b : e.a, path = [], dist = e.len;
            while (dist < 100 && !m.hasLight && m.edges.length === 2 && path.length < 24) {
                path.push(m); e = m.edges.find(x => x !== e); dist += e.len; m = e.a === m ? e.b : e.a;
            }
            if (m.lightCluster === c) for (const p of path) p.lightCluster = c;
        }
    }
    // the node at Piața Victoriei keeps its historic id (main.js achievement)
    if (city.id === 'bucharest') {
        const pv = city.proj(44.4522, 26.0859);
        let best = null, bd = 60;
        for (const n of nodeArr) if (n.edges.length >= 3) { const d = Math.hypot(n.x - pv.x, n.z - pv.z); if (d < bd) { bd = d; best = n; } }
        if (best) { delete nodes[best.id]; best.id = 'victoriei'; nodes.victoriei = best; }
    }
    const graph = { nodes, edges };

    // -----------------------------------------------------------------------
    //  CELLS (chunked static geometry)
    // -----------------------------------------------------------------------
    const cells = new Map();
    let builderEpoch = 0; // (counts the cells' builders made: the map-end pass keeps its list of them until it changes)
    const cellOf = (x, z) => {
        const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = i * 10007 + j;
        let c = cells.get(k);
        if (!c) builderEpoch++;
        if (!c) cells.set(k, c = { i, j, solid: new MeshBuilder(true), roof: new MeshBuilder(), ground: new MeshBuilder(), area: new MeshBuilder(), grass: new MeshBuilder(), pave: new MeshBuilder(), sport: new MeshBuilder(), marks: new MeshBuilder(), road: new MeshBuilder(), pad: new MeshBuilder(), water: new MeshBuilder(), backdrop: new MeshBuilder(), detail: new MeshBuilder(true), signs: [] });
        return c;
    };
    const signMB = (c, page) => c.signs[page] || (builderEpoch++, c.signs[page] = new MeshBuilder());

    // bounds
    const [bx0, bz0, bx1, bz1] = data.bounds.map(v => v * 0.1);
    const pad = 40;
    const bounds = { minX: bx0 - pad, maxX: bx1 + pad, minZ: bz0 - pad, maxZ: bz1 + pad };
    // district inside-mask (20 m cells, RLE rows): where the player may drive; boundary walls follow its outline
    let dmask = decodeDistrictMask(data.district?.mask);
    // A tram body is one rigid 27 m / 36 m box and the rail guard covers it with discs, so on a bend it reaches outside
    // the straight literal corridor. Whatever this builder adds itself stays out of that sweep (tram-sweep.js); mapped
    // trees found inside it are recorded as source conflicts. No rail, actor or guard rule is changed.
    const tramSweep = districtTramSweep(data, { resolveGrade: tramGrades.resolveGrade, makeVehicle, city: city.id, inside: dmask ? (x, z) => !!dmask.at(x, z) : null });
    const tramSweepConflicts = { droppedGenerated: {}, wallPiecesCut: {}, closures: [], trees: [], pierTopsLowered: 0 };
    const sweptOut = (kind, hit) => { if (hit) tramSweepConflicts.droppedGenerated[kind] = (tramSweepConflicts.droppedGenerated[kind] || 0) + 1; return !!hit; };
    if (dmask) Object.assign(bounds, { minX: dmask.x0 - pad, minZ: dmask.z0 - pad, maxX: dmask.x0 + dmask.w * dmask.cell + pad, maxZ: dmask.z0 + dmask.h * dmask.cell + pad });

    // -----------------------------------------------------------------------
    //  AREAS (landuse, parks, water, parking)
    // -----------------------------------------------------------------------
    setProgress('Parks, rivers and lakes…'); await tick();
    const areaColors = {
        water: env.water, park: env.grass, grass: shadeHex(env.grass, 1.08), forest: shadeHex(env.grass, 0.78), scrub: '#7c8a58', pitch: '#5e9b4a', cemetery: '#71865f',
        residential: shadeHex(env.ground, 1.08), industrial: '#8e8a86', commercial: '#a39896', retail: '#a6999a', railway: '#857d74', construction: '#9c8e78',
        parking: '#5f6064', apron: '#8b8c8e', runway: '#505256', track: '#a7a39a', clay: '#c06a45', // (velodrome concrete; clay courts / tartan)
        turf: '#3f7f3c', hard: '#4f7f8f', pool: '#4fb0d6', yard: '#9a978c', // (artificial turf; acrylic / asphalt courts; outdoor pools; school / hospital / sports grounds)
    };
    const areas = [];
    const waterGrid = new BoxGrid(200), parkGrid = new BoxGrid(200);
    for (let areaIndex = 0; areaIndex < data.areas.length; areaIndex++) {
        const a = data.areas[areaIndex], kind = data.areaKinds[a[0]];
        const rings = kind === 'parking' && data.parkingFootprints?.[areaIndex] || a.slice(2).map(r => undelta(r, 0));
        const outer = rings[0]; if (!outer || outer.length < 3) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const area = { kind, areaIndex, sourceId: data.areaSourceIds?.[areaIndex] || '', parkingLayout: data.parkingLayouts?.[areaIndex] || null, name: str(a[1]), rings, outer, holes: rings.slice(1), x0, z0, x1, z1, size: Math.abs(signedArea(outer)) };
        areas.push(area);
        if (kind === 'water') waterGrid.insert(x0, z0, x1, z1, area);
        if (kind === 'park' || kind === 'forest' || kind === 'grass' || kind === 'cemetery') parkGrid.insert(x0, z0, x1, z1, area);
    }
    const inArea = (a, x, z) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && pointInPolygon(x, z, a.outer) && !a.holes.some(h => pointInPolygon(x, z, h));
    const isWater = (x, z) => { let w = false; waterGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    // nothing stands in water / fountain basins (play-test note 17): `m` = margin for the basin rim / coping
    const nearWater = (x, z, m = 1.5) => isWater(x, z) || (m > 0 && (isWater(x + m, z) || isWater(x - m, z) || isWater(x, z + m) || isWater(x, z - m)));
    const isPark = (x, z) => { let w = false; parkGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    const bigWater = new MeshBuilder();
    const waterChannelAudit = [];
    // (play-test note 11) the Dâmbovița runs in a straight concrete channel: water ≈ 4.4 m below the Splai, a lower
    // service bank (≈ 2 m) above the waterline, a sloped / vertical concrete wall up to the quay, a parapet + railing
    const CHAN = { water: -4.4, bank: -3.2, bankW: 2.0, slope: 0.9 }, channelAreas = [];
    // flat ground layers do not write depth (drawn first, in this order) → no z-fighting, sunken roads stay visible
    const AREA_ORDER = ['residential', 'industrial', 'commercial', 'retail', 'railway', 'construction', 'yard', 'cemetery', 'grass', 'scrub', 'forest', 'park', 'track', 'pitch', 'turf', 'clay', 'hard', 'pool', 'parking', 'apron', 'runway', 'water'];
    areas.sort((p, q) => AREA_ORDER.indexOf(p.kind) - AREA_ORDER.indexOf(q.kind));
    // (owner, 2026-11-11, Unirii (-425, -27): "car drives under grass") The ground layers keep their depth so vehicles in
    // covered tunnels cannot show through; but a grass / landuse / paved polygon mapped across an OPEN trench (a road
    // sunk below the street, not a tunnel) then covered the trench, its road and its traffic. Those layers are cut out of
    // every open sunken carriageway corridor (the carriageway plus 0.6 m each side). Tunnels stay covered.
    const trenchQuads = [];
    for (const e of edges) {
        if (e.virtual || e.tunnel || !(Math.min(e.ya ?? 0, e.yb ?? 0) < -0.4)) continue;
        const wl = (e.wL ?? 4) + 0.6, wr = (e.wR ?? 4) + 0.6, ex = e.dirx * 0.3, ez = e.dirz * 0.3;
        const q = [[e.a.x - ex + e.nx * wr, e.a.z - ez + e.nz * wr], [e.b.x + ex + e.nx * wr, e.b.z + ez + e.nz * wr], [e.b.x + ex - e.nx * wl, e.b.z + ez - e.nz * wl], [e.a.x - ex - e.nx * wl, e.a.z - ez - e.nz * wl]];
        const xs = q.map(v => v[0]), zs = q.map(v => v[1]);
        trenchQuads.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
    }
    // (owner, 2026-11-12, Grozăvești (102, -229): "i can randomly see water through the ground") A sunken water channel is
    // an opening of the same kind: its water lies 4.4 m below the street, under every flat ground layer. Flat water is
    // the top ground layer and shows through whatever is mapped across it; the sunken river did not, so a park or
    // landuse polygon mapped across it, and above all the aerial green raster (which reads the algae-green river as
    // lawn), covered the water and left it showing only through the raster's gaps. The channel decision is taken here,
    // before the layers are built, and the channel's own water triangles are cut out of them like the trenches.
    // Not where the river is covered (the Unirii slab: its water is dropped from the final mesh by triangle centre, so
    // the ground stays whole to 4 m past the covered line, the reach of a 6 m water triangle whose centre is inside).
    const convexApart = (p, q) => { // a separating axis among the edge normals of two convex polygons
        for (const poly of [p, q]) for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], nx = b[1] - a[1], nz = a[0] - b[0];
            let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
            for (const v of p) { const d = v[0] * nx + v[1] * nz; if (d < p0) p0 = d; if (d > p1) p1 = d; }
            for (const v of q) { const d = v[0] * nx + v[1] * nz; if (d < q0) q0 = d; if (d > q1) q1 = d; }
            if (p1 <= q0 + 1e-9 || q1 <= p0 + 1e-9) return true;
        }
        return false;
    };
    const coveredWater = projectCoveredWater(city, { us: US }), coveredHulls = coveredWaterHulls(coveredWater, 4);
    const waterTris = new Map(), channelCuts = [];
    for (const a of areas) {
        if (a.kind !== 'water') continue;
        // Literal mapped water type precedes the legacy estimated channel classification.
        a.channelDecision = waterChannelDecision(a, { us: US, tags: data.areaSourceTags?.[a.sourceId] || {} });
        if (!a.channelDecision.channel) continue;
        const t = triangulate(a.outer, a.holes); waterTris.set(a, t);
        for (const tri of t.tris) {
            let open = [tri.map(k => t.pts[k])];
            for (const hull of coveredHulls) open = open.flatMap(q => convexApart(q, hull) ? [q] : subtractConvex(q, hull));
            for (const q of open) {
                const xs = q.map(v => v[0]), zs = q.map(v => v[1]);
                if (Math.abs(signedArea(q)) < 1e-6) continue;
                channelCuts.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
            }
        }
    }
    // (fidelity pass round 2, Stadionul Dinamo) A landmark sunk below the street is an opening of the same kind: the flat
    // ground layers and the green raster are cut over its pit, and the horizon ground gets an aperture there (below).
    const landmarkPits = [];
    try {
        for (const pit of (await import('./landmarks.js')).landmarkGroundPits?.(city.id, distCfg?.landmarks) || []) {
            const o = city.proj(pit.lat, pit.lon), ring = pit.ring.map(([x, z]) => [o.x + x * data.proj.scale, o.z + z * data.proj.scale]), t = triangulate(ring);
            const tris = t.tris.map(tri => tri.map(k => t.pts[k]));
            landmarkPits.push({ id: pit.id, ring, tris, floorY: pit.floorY });
            for (const q of tris) { const xs = q.map(v => v[0]), zs = q.map(v => v[1]); if (Math.abs(signedArea(q)) > 1e-6) channelCuts.push({ q, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }); }
        }
    } catch (err) { console.warn('landmark pits', err); }
    const groundCuts = trenchQuads.concat(channelCuts);
    // (a river polygon's triangles are long slivers with large boxes: the exact test keeps the ground beside them whole)
    const groundCutsAt = (poly, x0, z0, x1, z1) => groundCuts.filter(h => h.x1 > x0 && h.x0 < x1 && h.z1 > z0 && h.z0 < z1 && !convexApart(poly, h.q));
    let trenchCutTris = 0;
    const cutTrenches = (pts, tris) => { // pts [[x, z]], tris [[i, j, k]] (flatPoly orients each triangle up itself)
        if (!groundCuts.length) return { pts, tris };
        const P = pts.slice(), T = [];
        for (const t of tris) {
            const tri = t.map(k => P[k]);
            const x0 = Math.min(tri[0][0], tri[1][0], tri[2][0]), x1 = Math.max(tri[0][0], tri[1][0], tri[2][0]), z0 = Math.min(tri[0][1], tri[1][1], tri[2][1]), z1 = Math.max(tri[0][1], tri[1][1], tri[2][1]);
            const hits = groundCutsAt(tri, x0, z0, x1, z1);
            if (!hits.length) { T.push(t); continue; }
            let pieces = [tri];
            for (const h of hits) { pieces = pieces.flatMap(pc => subtractConvex(pc, h.q)); if (!pieces.length) break; }
            trenchCutTris++;
            for (const pc of pieces) { const base = P.length; P.push(...pc.map(v => [v[0], v[1]])); for (let k = 1; k < pc.length - 1; k++) T.push([base, base + k, base + k + 1]); }
        }
        return { pts: P, tris: T };
    };
    const fountainBasinColl = []; // (round 3: fountain basins, see below)
    for (const a of areas) {
        let { pts, tris } = waterTris.get(a) || triangulate(a.outer, a.holes);
        if (a.kind !== 'water' && tris.length) ({ pts, tris } = cutTrenches(pts, tris));
        if (!tris.length) continue;
        const y = AREA_Y[a.kind] ?? Y.landuse;
        const col = rgb(areaColors[a.kind] || env.ground);
        if (a.kind === 'water') {
            const target = (a.x1 - a.x0 > CELL * 2 || a.z1 - a.z0 > CELL * 2) ? bigWater : cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).water;
            const channel = a.channelDecision, chan = channel.channel;
            const chanP = channelProfile(distId, a.sourceId, CHAN); if (chan) a.chanProfile = chanP; // (r2: reviewed section per water polygon, water-channel-review.js)
            waterChannelAudit.push({ sourceId: a.sourceId, name: a.name, ...channel, surfaceM: chan ? chanP.water : y, surfaceSource: chan && chanP.source || 'model estimate' });
            // (round 3, r2-builder-fountain-outlines) a fountain basin mapped as an outline (areaSourceTags amenity=fountain,
            // tools/osm/add-areas.mjs) holds its water inside a low stone coping (≈ 0.45 m, an estimate), not at ground level
            // (round 3 review, Unirii Colțea garden w1180500523/4, w1180503225: natural=water only, 13–16 m², flat water at grass
            // level) an ornamental basin is also water=reflecting_pool|fountain, or a natural=water with no water=* type of at
            // most 30 m² (a mapped body of water that small in a city is a built basin, not a pond: the smallest mapped ponds in
            // the eight districts are 38 m² and up)
            const wt = data.areaSourceTags?.[a.sourceId], ornamental = !!wt && (wt.amenity === 'fountain' || /^(reflecting_pool|fountain)$/.test(wt.water || '') || (wt.natural === 'water' && !wt.water && a.size <= 30));
            const basin = !chan && ornamental, wy = basin ? 0.36 : y;
            const v0 = target.vc; target.flatPoly(pts, tris, chan ? chanP.water : wy, chan ? rgb('#3c4a42') : col, 0.02); a.waterMesh = { mb: target, v0, v1: target.vc };
            if (basin) { // coping: outer face, top (0.3 m wide), inner face down to the water, along the outer ring
                const sb = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).solid, stone = rgb(FOUNTAIN_COPING[a.sourceId] || '#b9b2a5'), R = a.outer, ccw = signedArea(R) > 0, top = 0.45, base = 0;
                for (let k = 0; k < R.length; k++) {
                    const [ax, az] = R[k], [bx, bz] = R[(k + 1) % R.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
                    let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } // (outward)
                    const ix = -nx * 0.3, iz = -nz * 0.3, Y0 = Math.min(base, wy - 0.1);
                    sb.face4([ax, Y0, az], [bx, Y0, bz], [bx, top + base, bz], [ax, top + base, az], stone, [nx, 0, nz]);
                    sb.face4([ax, top + base, az], [bx, top + base, bz], [bx + ix, top + base, bz + iz], [ax + ix, top + base, az + iz], stone, [0, 1, 0]);
                    sb.face4([bx + ix, wy - 0.05, bz + iz], [ax + ix, wy - 0.05, az + iz], [ax + ix, top + base, az + iz], [bx + ix, top + base, bz + iz], stone, [-nx, 0, -nz]);
                }
                fountainBasinColl.push({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, r: Math.max(0.6, Math.min(a.x1 - a.x0, a.z1 - a.z0) / 2) }); // (collider added once addPropColl exists)
            }
            if (chan) { a.channel = true; channelAreas.push(a); }
        } else {
            const cc = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2);
            (SPORT_KINDS.has(a.kind) ? cc.sport : GRASSY.has(a.kind) ? cc.grass : PAVED.has(a.kind) ? cc.pave : cc.area).flatPoly(pts, tris, y, col, 0.1); // (sports grounds: own layer + weather)
        }
    }
    // sports grounds (2026-11-08): line markings, goals, tennis nets and court fences, basketball hoops, pool copings on
    // the pitch / turf / clay / hard / pool areas — they were flat coloured patches. The court is fitted with the
    // smallest-area rectangle of its outline (skipped when the outline is not rectangular enough); everything is visual.
    let pitchesDressed = 0;
    const sportAreaLog = []; // (sport-areas.js: grounds dressed by their own OSM sport tag)
    const sportsColl = []; // (colliders of the sports dressing: it runs before propColl exists — merged in below)
    const dressSports = () => { // (run after the landmarks are built: a ground inside a landmark — the Dinamo pitch — is the model's own)
        const W = rgb('#f4f4ef'), POST = rgb('#ededea'), FENCE = rgb('#2f4a3a'), NET = rgb('#2a2d30');
        const minRect = (pts) => {
            let best = null;
            for (let k = 0; k < pts.length; k++) {
                const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of pts) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                const A = (a1 - a0) * (c1 - c0); if (!best || A < best.A) best = { A, ux, uz, a0, a1, c0, c1 };
            }
            if (!best) return null;
            let { ux, uz, a0, a1, c0, c1 } = best; const pm = (a0 + a1) / 2, qm = (c0 + c1) / 2;
            let hl = (a1 - a0) / 2, hw = (c1 - c0) / 2;
            if (hw > hl) { [hl, hw] = [hw, hl]; [ux, uz] = [-uz, ux]; } // u = long axis
            return { cx: pm * best.ux - qm * best.uz, cz: pm * best.uz + qm * best.ux, ux, uz, hl, hw, A: best.A };
        };
        // (2026-11-08, owner: "this one seems broken") OSM maps a sports ground as one big pitch polygon with the real pitches /
        // courts inside it: the container stays plain (no stripes, lines, goals laid across the pitches inside it)
        const SPORT = /^(pitch|turf|clay|hard)$/, sportAreas = areas.filter(o => SPORT.test(o.kind) && o.size >= 60);
        const holdsOthers = (a) => sportAreas.some(o => o !== a && o.size < a.size * 0.85 && pointInPolygon((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, a.outer));
        const DECK = rgb('#d6d0c3'), LIP = rgb('#ebe7de');
        for (const a of areas) {
            // (round 3 review, Otopeni Ramada w1322339467 / w706499892: small pools were flat cyan decals with no rim; only
            // rectangular pools of 60 m² and more had a painted coping) every mapped pool gets, along its own outline, a
            // stone lip (0.25 m wide, 0.1 m high) and a plain deck band (0.9 m) round it; widths and height are estimates
            // (in the near-LOD detail layer, no shadow pass: Grozăvești's worst sweep frame is at the 1.5 M budget, and a
            // 10 cm lip is invisible from beyond ≈ 150 m anyway)
            if (a.kind === 'pool' && a.size >= 4 && a.size <= 20000 && !landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) {
                const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y.pool, R0 = a.outer, n = R0.length, ccw = signedArea(R0) > 0;
                const nrm = (k) => { const [ax, az] = R0[k], [bx, bz] = R0[(k + 1) % n], L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } return [nx, nz]; }; // outward
                const off = (k, d) => { const [px, pz] = nrm((k - 1 + n) % n), [qx, qz] = nrm(k); let mx = px + qx, mz = pz + qz; const ml = Math.hypot(mx, mz); if (ml < 1e-3) { mx = qx; mz = qz; } else { mx /= ml; mz /= ml; } const cs = Math.max(0.5, mx * qx + mz * qz); return [R0[k][0] + mx * d / cs, R0[k][1] + mz * d / cs]; };
                const lip = R0.map((_, k) => off(k, 0.25)), deck = R0.map((_, k) => off(k, 1.15)), top = base + 0.1;
                for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, [ax, az] = R0[k], [bx, bz] = R0[k1]; if (Math.hypot(bx - ax, bz - az) < 0.05) continue; const [nx, nz] = nrm(k);
                    c.detail.flatQuad(lip[k][0], lip[k][1], lip[k1][0], lip[k1][1], deck[k1][0], deck[k1][1], deck[k][0], deck[k][1], base + 0.03, DECK, 0.1);
                    c.detail.face4([ax, top, az], [bx, top, bz], [lip[k1][0], top, lip[k1][1]], [lip[k][0], top, lip[k][1]], LIP, [0, 1, 0]);
                    c.detail.face4([bx, base - 0.05, bz], [ax, base - 0.05, az], [ax, top, az], [bx, top, bz], LIP, [-nx, 0, -nz]);
                    c.detail.face4([lip[k][0], base, lip[k][1]], [lip[k1][0], base, lip[k1][1]], [lip[k1][0], top, lip[k1][1]], [lip[k][0], top, lip[k][1]], LIP, [nx, 0, nz]); }
                const R = a.size >= 60 ? minRect(a.outer) : null;
                if (R && a.size / R.A >= 0.8) { const P = (u, v) => [R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v], { hl: HL, hw: HW } = R;
                    const strip = (u0, v0, u1, v1, k) => { const L = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / L * k / 2, nv = (u1 - u0) / L * k / 2, [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); c.sport.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, base + 0.016, W, 0.1); };
                    // the painted coping of rectangular pools (as before this pass) stays for the far view, where the detail-layer lip is culled
                    for (const [u0, v0, u1, v1] of [[-HL, -HW, HL, -HW], [-HL, HW, HL, HW], [-HL, -HW, -HL, HW], [HL, -HW, HL, HW]]) strip(u0, v0, u1, v1, 0.6);
                    if (HL > 10) for (let v = -HW + 2.5; v < HW - 1.5; v += 2.5) strip(-HL + 1, v, HL - 1, v, 0.08); } // lane ropes on long rectangular pools
                pitchesDressed++; continue;
            }
            // (backlog floreasca-2) Velodromul Dinamo: a sport=cycling track is a banked concrete bank, not a flat band (sport-areas.js)
            const sportTag = AREA_SPORT[a.sourceId];
            const groundOf = (q) => lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) });
            if (sportTag === 'cycling' && a.kind === 'track') {
                const infield = areas.find(o => o !== a && /^(pitch|turf)$/.test(o.kind) && pointInPolygon((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, a.outer)), R = minRect(a.outer);
                if (infield && R) sportAreaLog.push({ id: a.sourceId, sport: sportTag, ...emitBankedTrack({ track: a, infield, rect: R, cell: cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base: AREA_Y.track, rgb, ground: groundOf,
                    addFence: (ax, az, bx, bz, h) => { const L = Math.hypot(bx - ax, bz - az); sportsColl.push({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: 0.2, hd: L / 2, angle: Math.atan2(bx - ax, bz - az), r: Math.hypot(0.2, L / 2), poly: null, h, prop: true, kind: 'fence' }); } }) });
                continue;
            }
            if (!/^(pitch|turf|clay|hard|pool)$/.test(a.kind) || a.size < 60 || a.size > 20000) continue;
            if (landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) continue;
            if (a.kind !== 'pool' && holdsOthers(a)) continue;
            const R = minRect(a.outer); if (!R || a.size / R.A < 0.8) continue;
            if (/^rugby/.test(sportTag || '') && (a.kind === 'pitch' || a.kind === 'turf')) { // (backlog floreasca-2) rugby league lines and H posts, not football (sport-areas.js)
                const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y[a.kind] ?? Y.pitch, P = (u, v) => [R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v], POSTC = rgb('#f6f6f4');
                const q4 = (u0, v0, u1, v1, y, col) => { const [x0, z0] = P(u0, v0), [x1, z1] = P(u1, v0), [x2, z2] = P(u1, v1), [x3, z3] = P(u0, v1); c.sport.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, 0.1); };
                const line = (u0, v0, u1, v1, w = 0.1) => { const L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.05) return; const nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2, [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); c.sport.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, base + 0.016, W, 0.1); };
                const s1 = rgb('#5d9a45'), s2 = rgb('#528d3d');
                sportAreaLog.push({ id: a.sourceId, sport: sportTag, ...emitRugbyLeague({ area: a, rect: R, base, line, P, ang: Math.atan2(R.ux, R.uz), ground: groundOf,
                    stripe: (u0, u1, hw, k) => q4(u0, -hw, u1, hw, base + 0.003, k % 2 ? s1 : s2),
                    post: (x, z, h, r) => c.detail.geo(props().cylY, x, base + h / 2, z, 0, r, h, r, POSTC),
                    crossbar: (x, z, y, len, an, r) => c.detail.geo(props().cylZ, x, base + y, z, an, r, r, len, POSTC),
                    addPost: (x, z) => sportsColl.push({ x, z, r: 0.12, hw: 0.12, hd: 0.12, angle: 0, poly: null, h: 3, prop: true, kind: 'post' }) }) });
                pitchesDressed++; continue;
            }
            // (fidelity pass 2026-11-12, Velodromul Dinamo, OSM way/362465818 inside track way/37899329) a rounded outline —
            // the infield of a velodrome / running track is a capsule — is not its bounding rectangle: the marked pitch is
            // shortened until its corners lie inside the mapped outline (its stripes covered the track's curves)
            if ((a.kind === 'pitch' || a.kind === 'turf') && a.size / R.A < 0.97) {
                const cornersIn = (h) => [[h, R.hw * 0.97], [h, -R.hw * 0.97], [-h, R.hw * 0.97], [-h, -R.hw * 0.97]].every(([u, v]) => pointInPolygon(R.cx + R.ux * u - R.uz * v, R.cz + R.uz * u + R.ux * v, a.outer));
                if (!cornersIn(R.hl)) { let lo = R.hw, hi = R.hl; for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (cornersIn(mid)) lo = mid; else hi = mid; } R.hl = lo; }
            }
            const { cx, cz, ux, uz, hl, hw } = R, vx = -uz, vz = ux;
            const P = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
            const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y[a.kind] ?? Y.pitch, yL = base + 0.016; // (lines 1.2 cm over the mowing stripes: 3 mm z-fought them away at a distance) // (same cell = same mesh as the area polygon: the lines draw after it)
            const layer = c.sport; // (its own ground layer, drawn after all grass / paving: see 'sport' below)
            const line = (u0, v0, u1, v1, w = 0.1) => { const L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.05) return; const nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2; const [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); layer.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, yL, W, 0.1); };
            const rect = (hu, hv) => { line(-hu, -hv, hu, -hv); line(-hu, hv, hu, hv); line(-hu, -hv, -hu, hv); line(hu, -hv, hu, hv); };
            const ang = Math.atan2(ux, uz);
            if (a.kind === 'pool') { // coping all round, lane ropes on long pools
                const k = 0.6; for (const [u0, v0, u1, v1] of [[-hl, -hw, hl, -hw], [-hl, hw, hl, hw], [-hl, -hw, -hl, hw], [hl, -hw, hl, hw]]) line(u0, v0, u1, v1, k);
                if (hl > 10) for (let v = -hw + 2.5; v < hw - 1.5; v += 2.5) line(-hl + 1, v, hl - 1, v, 0.08);
                pitchesDressed++; continue;
            }
            const tennis = (a.kind === 'clay' || a.kind === 'hard') && hl >= 11 && hw >= 5.5 && !(a.kind === 'hard' && hl < 13);
            if (tennis) { // a grid of courts (23.77 × 10.97 m inside 36 × 18 m run-offs), nets, a fence round the plot
                const nu = Math.max(1, Math.round(hl * 2 / 36)), nv = Math.max(1, Math.round(hw * 2 / 18)), su = hl * 2 / nu, sv = hw * 2 / nv;
                for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
                    const u0 = -hl + su * (i + 0.5), v0 = -hw + sv * (j + 0.5), HL = Math.min(11.885, su / 2 - 1.5), HW = Math.min(5.485, sv / 2 - 1), HS = HW * 4.115 / 5.485;
                    const L2 = (a0, b0, a1, b1) => line(u0 + a0, v0 + b0, u0 + a1, v0 + b1, 0.06);
                    L2(-HL, -HW, HL, -HW); L2(-HL, HW, HL, HW); L2(-HL, -HW, -HL, HW); L2(HL, -HW, HL, HW); L2(-HL, -HS, HL, -HS); L2(-HL, HS, HL, HS);
                    L2(-6.4, -HS, -6.4, HS); L2(6.4, -HS, 6.4, HS); L2(-6.4, 0, 6.4, 0);
                    const [nx0, nz0] = P(u0, v0 - HW - 0.9), [nx1, nz1] = P(u0, v0 + HW + 0.9);
                    c.detail.wall(nx0, nz0, nx1, nz1, base + 0.05, base + 0.95, ux, uz, NET); c.detail.wall(nx1, nz1, nx0, nz0, base + 0.05, base + 0.95, -ux, -uz, NET);
                    for (const [px, pz] of [[nx0, nz0], [nx1, nz1]]) c.detail.box(px, base, pz, 0.08, 1.07, 0.08, 0, POST);
                }
                const corners = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                for (let k = 0; k < 4; k++) { const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], L = Math.hypot(bx - ax, bz - az);
                    for (let t = 0; t <= L; t += 3) { const f = t / L; c.detail.box(ax + (bx - ax) * f, base, az + (bz - az) * f, 0.06, 3, 0.06, 0, FENCE); }
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, an = Math.atan2(bx - ax, bz - az);
                    c.detail.box(mx, base + 2.95, mz, 0.05, 0.05, L, an, FENCE); c.detail.box(mx, base + 1.5, mz, 0.04, 0.04, L, an, FENCE);
                    c.solid.box(mx, base, mz, 0.04, 0.12, L, an, FENCE);
                    sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: L / 2, angle: an, r: Math.hypot(0.1, L / 2), poly: null, h: 3, prop: true, kind: 'fence' }); } // (solid)
                pitchesDressed++; continue;
            }
            if (a.kind === 'hard') { // basketball / multi-sport: outline, centre line and circle, hoops at both ends
                rect(hl - 1, hw - 1); line(0, -hw + 1, 0, hw - 1);
                const n = 24, r = Math.min(1.8, hw * 0.25); for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0.06); }
                for (const sg of [-1, 1]) { // pole behind the end line, arm, backboard (with its target square), orange rim and a net
                    const [px, pz] = P(sg * (hl + 0.2), 0), [bx, bz] = P(sg * (hl - 1.2), 0), [ax2, az2] = P(sg * (hl - 0.5), 0);
                    c.solid.box(px, base, pz, 0.14, 3.5, 0.14, ang, rgb('#3a3d42')); sportsColl.push({ x: px, z: pz, r: 0.1, hw: 0.1, hd: 0.1, angle: 0, poly: null, h: 3, prop: true, kind: 'post' });
                    c.solid.box(ax2, base + 3.3, az2, 0.1, 0.1, 1.4, ang, rgb('#3a3d42'));
                    c.solid.box(bx, base + 2.9, bz, 0.06, 1.05, 1.8, ang + Math.PI / 2, rgb('#f2f2f0'));
                    const [qx, qz] = P(sg * (hl - 1.24), 0); c.detail.box(qx, base + 3.05, qz, 0.02, 0.45, 0.59, ang + Math.PI / 2, rgb('#c2410c'));
                    const [rx, rz] = P(sg * (hl - 1.48), 0), R = 0.23;
                    for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI * 2, a1 = (k + 1) / 10 * Math.PI * 2, cx2 = rx + (Math.cos(a0) + Math.cos(a1)) / 2 * R, cz2 = rz + (Math.sin(a0) + Math.sin(a1)) / 2 * R;
                        c.detail.box(cx2, base + 3.05, cz2, 0.03, 0.03, 2 * R * Math.sin(Math.PI / 10) + 0.02, Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)), rgb('#e8590c'));
                        if (k % 2 === 0) c.detail.box(rx + Math.cos(a0) * R * 0.8, base + 2.65, rz + Math.sin(a0) * R * 0.8, 0.012, 0.4, 0.012, 0, rgb('#f2f2f0')); } // net strands
                }
                pitchesDressed++; continue;
            }
            // football (grass / artificial turf): touch + goal lines, halfway line, centre circle, boxes, goals
            if (hl < 12 || hw < 6) continue;
            const m = Math.min(1.5, hw * 0.06), HL = hl - m, HW = hw - m;
            // (2026-11-08, owner: "football fields need a bit more love") mowing stripes across the whole pitch in two greens
            // (they also cover the aerial green-raster / yard patches that showed through), no trees on it, corner flags,
            // dugouts at halfway, ball-stop fences behind the goals, deeper goals with side nets
            { const turf = a.kind === 'turf', c1 = rgb(turf ? '#4f9a4c' : '#5d9a45'), c2 = rgb(turf ? '#468d43' : '#528d3d'), ns = Math.max(4, Math.round(hl * 2 / 5.5));
                for (let k = 0; k < ns; k++) { const u0 = -hl + hl * 2 * k / ns, u1 = -hl + hl * 2 * (k + 1) / ns, [x0, z0] = P(u0, -hw), [x1, z1] = P(u1, -hw), [x2, z2] = P(u1, hw), [x3, z3] = P(u0, hw);
                    layer.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, base + 0.003, k % 2 ? c1 : c2, 0.1); }
                const q = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) });
                for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { // corner flags: a pole with the flag hanging from its top, the 1 m arc
                    const [fx, fz] = P(su * HL, sv * HW); c.detail.geo(props().cylY, fx, base + 0.75, fz, 0, 0.022, 1.5, 0.022, POST);
                    const dl = Math.SQRT1_2, dx = (ux * -su + vx * -sv) * dl, dz = (uz * -su + vz * -sv) * dl, FL = rgb('#e8b923'); // (toward the pitch, diagonally)
                    const q = [[fx, base + 1.5, fz], [fx + dx * 0.45, base + 1.47, fz + dz * 0.45], [fx + dx * 0.45, base + 1.17, fz + dz * 0.45], [fx, base + 1.2, fz]];
                    c.detail.face4(q[0], q[1], q[2], q[3], FL, [-dz, 0, dx]); c.detail.face4(q[0], q[3], q[2], q[1], FL, [dz, 0, -dx]);
                    for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI / 2, a1 = (k + 1) / 8 * Math.PI / 2; line(su * (HL - Math.cos(a0)), sv * (HW - Math.sin(a0)), su * (HL - Math.cos(a1)), sv * (HW - Math.sin(a1))); }
                }
                // dugouts (2026-11-08, owner: "more love on the benches"): a concrete pad, a smoked back wall, tinted side panels
                // under a curved roof, a row of bucket seats in the team colour on a rail. Long side along the touchline, on the
                // side of the pitch that is clear (no other pitch / court, building or road under it); none when neither is
                if (hw > 15) {
                    const LEN = 4.4, DEP = 1.7, gap = 1.2, us = [-6.5, 6.5];
                    const free = (s) => us.every(u0 => { for (let du = -2.5; du <= 2.5; du += 1.25) for (let dv = 0; dv <= DEP + 0.3; dv += 0.5) {
                        const [x, z] = P(u0 + du, s * (hw + gap + dv));
                        if (buildingAt(x, z) || onRibbon(x, z, 0.4) || sportAreas.some(o => o !== a && x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && pointInPolygon(x, z, o.outer))) return false; }
                        return true; });
                    const side = [-1, 1].find(free);
                    if (side) for (const u0 of us) {
                        const s = side, vF = s * (hw + gap), vB = s * (hw + gap + DEP), vC = (vF + vB) / 2;
                        const B = (lay, u, v, y, lu, h, lv, col) => { const [x, z] = P(u, v); lay.box(x, base + y, z, lv, h, lu, ang, col); };
                        const V = (u, v, y) => { const [x, z] = P(u, v); return [x, base + y, z]; };
                        const quad2 = (lay, q, col) => { // both faces of a quad
                            const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
                            const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
                            lay.face4(q[0], q[1], q[2], q[3], col, n); lay.face4(q[0], q[3], q[2], q[1], col, [-n[0], -n[1], -n[2]]); };
                        const FR = rgb('#3a3f45'), PAN = rgb('#8fa8b6'), ROOF = rgb('#5c86a8'), SEAT = rgb(u0 < 0 ? '#b8322f' : '#2a62a8');
                        B(c.solid, u0, vC + s * 0.15, 0, LEN + 0.4, 0.08, DEP + 0.6, rgb('#c3c5c6'));            // pad
                        B(c.solid, u0, vB - s * 0.03, 0.08, LEN, 2.12, 0.06, rgb('#3d4a54'));                     // back wall
                        const hF = 1.95, hB = 2.2, roofY = (t) => hB + (hF - hB) * t + Math.sin(t * Math.PI) * 0.12; // curved roof profile back → front
                        for (const eu of [-LEN / 2, LEN / 2]) { // side panels (tapered) + frame posts
                            quad2(c.solid, [V(u0 + eu, vB, 0.08), V(u0 + eu, vF + s * 0.25, 0.08), V(u0 + eu, vF + s * 0.25, roofY(0.85)), V(u0 + eu, vB, hB)], PAN);
                            B(c.detail, u0 + eu, vF + s * 0.1, 0.08, 0.06, hF, 0.06, FR); B(c.detail, u0 + eu, vB - s * 0.05, 0.08, 0.06, hB, 0.06, FR); }
                        const NS = 5; for (let k = 0; k < NS; k++) { // roof, back → front with a small overhang
                            const t0 = k / NS, t1 = (k + 1) / NS, v0 = vB + (vF - s * 0.3 - vB) * t0, v1 = vB + (vF - s * 0.3 - vB) * t1;
                            quad2(c.solid, [V(u0 - LEN / 2 - 0.05, v0, roofY(t0)), V(u0 + LEN / 2 + 0.05, v0, roofY(t0)), V(u0 + LEN / 2 + 0.05, v1, roofY(t1)), V(u0 - LEN / 2 - 0.05, v1, roofY(t1))], ROOF); }
                        B(c.detail, u0, vF - s * 0.3, roofY(1) - 0.06, LEN + 0.1, 0.08, 0.05, FR);               // roof front edge
                        B(c.detail, u0, vB - s * 0.45, 0.32, LEN - 0.3, 0.06, 0.08, FR);                         // seat rail
                        for (const eu of [-1.6, 0, 1.6]) B(c.detail, u0 + eu, vB - s * 0.45, 0.08, 0.06, 0.26, 0.06, FR);
                        const nS = 7, sw = (LEN - 0.5) / nS;
                        for (let k = 0; k < nS; k++) { const su = u0 - (LEN - 0.5) / 2 + sw * (k + 0.5);   // bucket seats: pan + back
                            B(c.detail, su, vB - s * 0.5, 0.38, sw - 0.08, 0.05, 0.42, SEAT);
                            B(c.detail, su, vB - s * 0.24, 0.43, sw - 0.08, 0.42, 0.05, SEAT); }
                        const [cx2, cz2] = P(u0, vC); sportsColl.push({ x: cx2, z: cz2, hw: DEP / 2 + 0.1, hd: LEN / 2 + 0.1, angle: ang, r: Math.hypot(DEP / 2, LEN / 2) + 0.1, poly: null, h: 2.2, prop: true, kind: 'furniture' });
                        const qd = [P(u0 - LEN / 2 - 1, vF), P(u0 + LEN / 2 + 1, vF), P(u0 + LEN / 2 + 1, vB + s), P(u0 - LEN / 2 - 1, vB + s)];
                        lmGrounds.push({ p: qd, x0: Math.min(...qd.map(v => v[0])), x1: Math.max(...qd.map(v => v[0])), z0: Math.min(...qd.map(v => v[1])), z1: Math.max(...qd.map(v => v[1])) }); // (no trees in it)
                    }
                }
                if (hl > 22) for (const sg of [-1, 1]) { const fu = sg * (hl + 0.3), fw = Math.min(hw, 24); // ball-stop fence behind the goal: posts + a few wires
                    for (let v = -fw; v <= fw + 0.01; v += 4) { const [px, pz] = P(fu, v); c.detail.box(px, base, pz, 0.08, 6, 0.08, 0, FENCE); }
                    for (const y of [1, 2.5, 4, 5.9]) { const [mx, mz] = P(fu, 0); c.detail.box(mx, base + y, mz, 0.03, 0.03, fw * 2, ang + Math.PI / 2, FENCE); }
                    { const [mx, mz] = P(fu, 0), an2 = ang + Math.PI / 2; sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: fw, angle: an2, r: Math.hypot(0.1, fw), poly: null, h: 6, prop: true, kind: 'fence' }); } }
            }
            rect(HL, HW); line(0, -HW, 0, HW);
            const rc = Math.min(9.15, HW * 0.27), n = 36; for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * rc, Math.sin(a0) * rc, Math.cos(a1) * rc, Math.sin(a1) * rc); }
            const bd = Math.min(16.5, HL * 0.3), bw = Math.min(20.16, HW * 0.6), gw = HL > 40 ? 3.66 : HL > 22 ? 2.5 : 1.5, gh = HL > 40 ? 2.44 : 2;
            // goals (2026-11-08, owner: "a bit more details on goal post"): round white posts and crossbar, a net that runs
            // from the crossbar back over a short top and slopes to a ground bar (≈ 2 m deep), side nets, rear stanchions,
            // a fine thin mesh (two-sided strips in the detail layer)
            const POSTC = rgb('#f6f6f4'), NETC = rgb('#e6e8e8'), PR = gh > 2.3 ? 0.06 : 0.05;
            const V3 = (u, v, y) => { const [x, z] = P(u, v); return [x, base + y, z]; };
            const strand = (a, b2, side, w = 0.018) => { // a thin quad from a to b2, widened along `side` (unit, in the net's plane), both faces
                const sx = side[0] * w / 2, sy = side[1] * w / 2, sz = side[2] * w / 2;
                const q = [[a[0] - sx, a[1] - sy, a[2] - sz], [b2[0] - sx, b2[1] - sy, b2[2] - sz], [b2[0] + sx, b2[1] + sy, b2[2] + sz], [a[0] + sx, a[1] + sy, a[2] + sz]];
                const dx = b2[0] - a[0], dy = b2[1] - a[1], dz = b2[2] - a[2], nx = dy * side[2] - dz * side[1], ny = dz * side[0] - dx * side[2], nz = dx * side[1] - dy * side[0];
                c.detail.face4(q[0], q[1], q[2], q[3], NETC, [nx, ny, nz]); c.detail.face4(q[0], q[3], q[2], q[1], NETC, [-nx, -ny, -nz]);
            };
            const goal = (g, sg) => {
                const top = 0.8, D = Math.min(2.0, gh * 0.85), uT = g + sg * top, uB = g + sg * D; // net: crossbar → top (0.8 m) → slope → ground bar at D
                const VD = [vx, 0, vz], ryV = Math.atan2(vx, vz);
                for (const v of [-gw, gw]) { const [px, , pz] = V3(g + sg * PR, v, 0); c.detail.geo(props().cylY, px, base + gh / 2, pz, 0, PR, gh, PR, POSTC); }
                { const [tx, , tz] = V3(g + sg * PR, 0, 0); c.detail.geo(props().cylZ, tx, base + gh - PR, tz, ryV, PR, PR, gw * 2 + PR * 2, POSTC); }
                { const [bx, , bz] = V3(uB, 0, 0); c.detail.geo(props().cylZ, bx, base + 0.03, bz, ryV, 0.025, 0.025, gw * 2, POSTC); }   // ground bar
                for (const v of [-gw, gw]) { // rear stanchion (crossbar end → top corner → ground) + ground side bar
                    const a = V3(g + sg * PR, v, gh - 0.05), m2 = V3(uT, v, gh - 0.1), f = V3(uB, v, 0.03), gf = V3(g, v, 0.03);
                    const sd = [0, 0, 0]; const UD = [ux, 0, uz];
                    strand(a, m2, [0, 1, 0], 0.05); strand(m2, f, VD, 0.05); strand(gf, f, [0, 1, 0], 0.04); void sd; void UD; }
                // back net: across (v) every 0.12 m, the top + slope as strands along the net, rungs across every 0.15 m
                const slopeL = Math.hypot(D - top, gh - 0.1), nS = Math.round(slopeL / 0.15), nT = Math.round(top / 0.15);
                const SL = [ux * sg * (D - top) / slopeL, -(gh - 0.1) / slopeL, uz * sg * (D - top) / slopeL];
                for (let v = -gw; v <= gw + 0.001; v += 0.12) { strand(V3(g + sg * PR, v, gh - 0.08), V3(uT, v, gh - 0.1), VD); strand(V3(uT, v, gh - 0.1), V3(uB, v, 0.03), VD); }
                for (let k = 1; k <= nT; k++) { const u = g + sg * top * k / nT; strand(V3(u, -gw, gh - 0.09), V3(u, gw, gh - 0.09), [ux, 0, uz]); }
                for (let k = 1; k < nS; k++) { const t = k / nS, u = uT + sg * (D - top) * t, y = gh - 0.1 - (gh - 0.13) * t; strand(V3(u, -gw, y), V3(u, gw, y), SL); }
                for (const v of [-gw, gw]) { // side nets: verticals every 0.15 m under the top / slope, horizontals every 0.15 m
                    for (let u2 = 0.15; u2 < D; u2 += 0.15) { const yTop = u2 <= top ? gh - 0.1 : gh - 0.1 - (gh - 0.13) * (u2 - top) / (D - top); strand(V3(g + sg * u2, v, 0.03), V3(g + sg * u2, v, yTop), [ux, 0, uz]); }
                    for (let y = 0.15; y < gh - 0.1; y += 0.15) { const uEnd = y >= gh - 0.1 ? top : top + (D - top) * (gh - 0.1 - y) / (gh - 0.13); strand(V3(g + sg * PR, v, y), V3(g + sg * Math.min(D, uEnd), v, y), [0, 1, 0]); }
                }
            };
            for (const sg of [-1, 1]) {
                const g = sg * HL; line(g, -bw, g - sg * bd, -bw); line(g - sg * bd, -bw, g - sg * bd, bw); line(g - sg * bd, bw, g, bw);
                if (HL > 22) { const b6 = Math.min(9.16, gw + 5.5), d6 = Math.min(5.5, bd * 0.33); line(g, -b6, g - sg * d6, -b6); line(g - sg * d6, -b6, g - sg * d6, b6); line(g - sg * d6, b6, g, b6); } // goal area
                goal(g, sg);
                for (const v of [-gw, gw]) { const [px, pz] = P(g + sg * 0.05, v); sportsColl.push({ x: px, z: pz, r: 0.08, hw: 0.08, hd: 0.08, angle: 0, poly: null, h: 3, prop: true, kind: 'post' }); }
            }
            pitchesDressed++;
        }
    };
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
        deckWorkers = true;
    } catch (err) { console.warn('[world] deck models for the workers', err); }
    // (world ribbons: world-ribbons.js)
    const __buildRibbons = buildRibbons({
        US, asphaltBase, asphaltCorners, asphaltEnds, ballastCol, buildPool, cellOf, city,
        concreteCol, convexApart, corner, data, deckAudit, deckJobs, deckWorkers, edgeGrid,
        edges, edgesInBox, isConcrete, kerbCol, laneTapers, layerY, nodeArr, padHeightAt,
        railRoadside, researchTrees, retract, rng, roads, sharedBridgeMeshAudit, sideCol, sideExtra,
        str, tramGrades, white, widthAsphalt, widthKerb, widthSide, yAlong, yellow,
    });
    const {
        DY_SIDE, SIDE_BACK, convexRing, cornerGrid, cornerPolys, cornerSkips, coveredByOther, displace,
        foldDeckAudit, insetRing, lampSpots, padCorners, parapetOwnership, polyDist, raised, raisedEdge,
        retainedDeck, ribPoly, ribbons, sideJoins, surfGrid, surfList, treeSpots,
    } = __buildRibbons;
    // structures under / beside elevated and sunken roads
    const pierSpots = [], pierColl = [], underpassColl = [], underpassCollEdges = [], underpassRoofAudit = [], underpassCover = new MeshBuilder();
    for (const e of edges) e.lidded = !!e.tunnel && !e.coveredRoadModel && !e.virtual && Math.max(e.ya, e.yb) < -4.5;
    const districtCutNodes = new Set((data.district?.ends || []).map(i => nodeArr[i]).filter(Boolean)); // (R24 tunnel end walls)
    const underpassRegions = edges.filter(e => e.tunnel && !e.virtual && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2).map(e => {
        const width = (f, side) => widthSide(f, side) + .3, points = [1, -1].flatMap(side => [e.a, e.b].map(n => corner(e, n, side, width(e, side), width)));
        return { x0: Math.min(...points.map(p => p[0])), x1: Math.max(...points.map(p => p[0])), z0: Math.min(...points.map(p => p[1])), z1: Math.max(...points.map(p => p[1])) };
    });
    const underpassOwnerOptions = { fallbackM: -.3, regions: underpassRegions }; // exact unchanged emitted groundPlane datum
    if (underpassRegions.length) await finishDeckJobs(); // (the index reads every ground triangle: the decks first)
    const underpassGroundOwners = buildUnderpassOwnerIndex(underpassRegions.length ? [
        ...[...cells].flatMap(([key, c]) => ['area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad'].map(layer => ({ mesh: c[layer], id: layer + ':' + key }))),
        { mesh: bigWater, id: 'water-big', water: true },
    ] : [], underpassOwnerOptions);
    let underpassOwners = combineUnderpassWaterOwners(underpassGroundOwners, buildUnderpassOwnerIndex(underpassRegions.length ?
        [...cells].map(([key, c]) => ({ mesh: c.water, id: 'water:' + key, water: true })) : [], underpassOwnerOptions));
    const deferredUnderpassDown = [];
    // shared underpass hall (2026-11-12 fidelity pass): roofed tram-station pieces and the deep covered carriageways beside them
    const tramHallPieces = []; let hallRoads = null; const hallFurnitureStats = { posts: 0, benches: 0, lamps: 0 }, hallLampRuns = new Set();
    const hallTramStops = (data.pois || []).filter(r => data.poiKinds?.[r[0]] === 'busstop' && str(r[5]) === 'tram_stop').map(r => [r[1] / 10, r[2] / 10]);
    const hallStopNear = (x, z) => hallTramStops.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < HALL_FURNITURE_MODEL.stopReachM);
    const sharedHallTram = (x, z, ox, oz) => { let best = null;
        for (const p of tramHallPieces) { const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], L2 = dx * dx + dz * dz || 1, t = ((x - p.a[0]) * dx + (z - p.a[1]) * dz) / L2; if (t < -.1 || t > 1.1) continue;
            const d = (p.a[0] + dx * t - x) * ox + (p.a[1] + dz * t - z) * oz; if (d > .5 && d < 12 && (!best || d - p.half < best.gap)) best = { gap: d - p.half }; }
        return best; };
    const sharedHallRoad = (x, z, ox, oz) => { hallRoads = hallRoads || edges.filter(e => e.tunnel && !e.virtual && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2);
        return hallRoads.some(e => { const t = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz; if (t < -1 || t > e.len + 1) return false;
            const d = (e.a.x + e.dirx * t - x) * ox + (e.a.z + e.dirz * t - z) * oz; return d > .5 && d < 12 && e.ya + (e.yb - e.ya) * clamp(t / e.len, 0, 1) < -4.2; }); };
    // (owner register #59, SeaTac: "barrier pieces read broken") where two sunken ramps part, each one's trench wall and
    // rim parapet ran on through the other's carriageway (an X of walls at the gore). A trench wall stops where its line
    // lies on another road's carriageway — not the same road's own continuation (that is the wall going on).
    const carriagewayIndex = new BoxGrid(24);
    for (const rb of ribbons) if (rb.e && !rb.e.virtual && !(rb.e.tunnel && rb.e.lidded)) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of rb.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } carriagewayIndex.insert(x0, z0, x1, z1, { rb, x0, z0, x1, z1 }); }
    // (the other road is in the cut too: a wall between a sunken ramp and a street at grade always stays)
    const otherSunkenAt = (e, x, z) => { let lo = null; carriagewayIndex.each(x, z, x, z, (q) => { if (q.rb.e === e || q.rb.e.road === e.road || x < q.x0 || x > q.x1 || z < q.z0 || z > q.z1 || !pointInPolygon(x, z, q.rb.poly)) return; const h = yAlong(q.rb.e, x, z); if (h < -0.35 && (lo === null || h < lo)) lo = h; }); return lo; };
    const onOtherCarriageway = (e, x, z) => otherSunkenAt(e, x, z) !== null;
    // Two sunken ramps side by side share one wall: the lower road's (it retains the higher one and, rising to street
    // level, guards it too). The higher road, or both when they run level, leave that side open — before, each drew its
    // own wall and parapet, a doubled, stepped pair of barriers with a gap between (#59).
    const sharedTrenchSide = (e, x, z, ox, oz, y) => { const h = otherSunkenAt(e, x + ox * 1.2, z + oz * 1.2); return h !== null && h <= y + 0.45; };
    /** parts [t0, t1] of edge e's wall line at offset o that are clear of other carriageways (1 m samples) */
    const trenchWallRuns = (e, o) => {
        const n = Math.max(2, Math.ceil(e.len)), runs = [], sg = Math.sign(o) || 1; let start = null;
        for (let i = 0; i <= n; i++) { const t = i / n, x = e.a.x + e.dirx * e.len * t + e.nx * o, z = e.a.z + e.dirz * e.len * t + e.nz * o, free = !onOtherCarriageway(e, x, z) && !sharedTrenchSide(e, x, z, e.nx * sg, e.nz * sg, e.ya + (e.yb - e.ya) * t);
            if (free && start === null) start = i === 0 ? 0 : (i - 0.5) / n; if (!free && start !== null) { runs.push([start, (i - 0.5) / n]); start = null; } }
        if (start !== null) runs.push([start, 1]);
        return runs;
    };
    const clipRuns = (runs, a, b) => runs.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y - x > 1e-4);
    let trenchGoreCuts = 0;
    let WATER_API = null, preparedSmallWater = null;
    for (const e of raised) {
        const c = cellOf((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
        const sb = c.solid, roadsideSolidStart = sb.ic, roadsideSolidVertexStart = sb.vc;
        const conc = rgb('#a9a69e'), dark = rgb('#55524d');
        const wr = widthSide(e, 1), wl = widthSide(e, -1);
        const P = (s2, o, y) => [e.a.x + e.dirx * s2 + e.nx * o, y, e.a.z + e.dirz * s2 + e.nz * o];
        // the same at the ends, mitred with the next edge (decks, walls and lids join without gaps / overlaps at bends)
        const Pm = (end, o, y) => { const sd = o >= 0 ? 1 : -1, ex = Math.abs(o) - widthSide(e, sd); const q = corner(e, end ? e.b : e.a, sd, Math.abs(o), (f, sf) => widthSide(f, sf) + ex); return [q[0], y, q[1]]; };
        const yA = e.ya + Y.road, yB = e.yb + Y.road;
        const up = Math.max(e.ya, e.yb) > 0.3, down = Math.min(e.ya, e.yb) < (e.tunnel || e.lidded ? -0.3 : -1.0); // (register #45: a dip under 1 m is a slope, no trench walls)
        if (up && e.bridge) {
            // deck fascia + underside + piers
            // (the fascia / underside thins to nothing where the deck meets the ground: no slab through the street)
            const shared=!!e.sourceBridgeGrade?.known,topA=shared?Y.road:yA,topB=shared?Y.road:yB;
            const dA = shared?Y.road-1.1:yA - Math.min(1.1, Math.max(0.05, e.ya)), dB = shared?Y.road-1.1:yB - Math.min(1.1, Math.max(0.05, e.yb));
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) {const A=Pm(0,o,0),B=Pm(1,o,0),lip=inferredBridgeFasciaUpstand(e,[A[0],A[2]],[B[0],B[2]],{grades:tramGrades,envelope:tramPropEnvelope});sb.face4(Pm(0, o, dA), Pm(1, o, dB), Pm(1, o, topB + lip), Pm(0, o, topA + lip), conc, [e.nx * sgn, 0, e.nz * sgn]);}
            sb.face4(Pm(0, wr, dA), Pm(1, wr, dB), Pm(1, -wl, dB), Pm(0, -wl, dA), dark, [0, -1, 0]);
            // (piers: one planned pass over whole deck chains, once the tram decks and buildings exist: see BRIDGE BENTS)
            if(shared)displace(sb,roadsideSolidVertexStart,(x,z)=>yAlong(e,x,z),e,roadsideSolidStart,{});
            railRoadside.apply(sb, roadsideSolidStart, e);
            const outer = [Pm(0, wr, 0), Pm(1, wr, 0), Pm(1, -wl, 0), Pm(0, -wl, 0)].map(p => [p[0], p[2]]);
            const bottomAt = (x, z) => { const y = yAlong(e, x, z); return y + Y.road - Math.min(1.1, Math.max(.05, y)); };
            railRoadsideCaps.push(...railRoadside.caps(sb, e, outer, bottomAt, (x, z) => yAlong(e, x, z) + Y.road, conc));
        } else if (up) {
            // ramp on an embankment: retaining walls down to the ground
            const shared=!!e.sourceBridgeGrade?.known,topA=shared?Y.road:Math.max(0,yA),topB=shared?Y.road:Math.max(0,yB);
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(Pm(0, o, 0), Pm(1, o, 0), Pm(1, o, topB), Pm(0, o, topA), conc, [e.nx * sgn, 0, e.nz * sgn]);
            if(shared)displace(sb,roadsideSolidVertexStart,(x,z,y)=>yAlong(e,x,z)*clamp(y/Y.road,0,1),e,roadsideSolidStart,{scaleY:Y.road});
        }
        if (down) {
            const emitDown = () => {
            const source = data.roadSourceGeometry?.[e.road];
            let roof = source?.sourceId && source.tags?.tunnel && source.tags.tunnel !== 'no' ? underpassRoofModel(e, { sourceTags: source.tags }) : { known: false, reason: 'source-tunnel-context-missing' };
            const roofPoint = (t, o, y) => { const a = Pm(0, o, y), b = Pm(1, o, y); return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t]; };
            const roofFootprint = roof.known ? [roofPoint(roof.span[0], wr + .3, 0), roofPoint(roof.span[1], wr + .3, 0), roofPoint(roof.span[1], -wl - .3, 0), roofPoint(roof.span[0], -wl - .3, 0)].map(p => [p[0], p[2]]) : null;
            const owner = roofFootprint ? underpassOwners.forPolygon(roofFootprint) : null;
            if (owner?.known) roof = underpassRoofModel(e, { sourceTags: source?.tags || {}, topM: owner.topM });
            const roofFaces = roof.known && owner?.known ? underpassRoofFaces(roof, { pointAt: roofPoint, rightM: wr, leftM: wl,
                portals: [true, true] /* close buried slab steps too; never a street-height parapet */ }) : null;
            const closedRoof = roofFaces?.known;
            if (e.tunnel && !e.coveredRoadModel && Math.min(e.ya, e.yb) < -4.2) underpassRoofAudit.push({ edge: e, sourceId: source?.sourceId, known: !!closedRoof, reason: owner?.reason || roofFaces?.reason || roof.reason, groundOwner: owner,
                estimated: true, minClearanceM: roof.minClearanceM, legalMaxheightM: roof.legalMaxheightM, span: roof.span, topM: roof.topM, minThicknessM: roof.minThicknessM });
            if (closedRoof) {
                for (const q of roofFaces.bottom) sb.face4(...q, dark, [0, -1, 0]);
                for (const face of roofFaces.fascia) sb.face4(...face.vertices, conc, face.out);
                for (const q of roofFaces.top) underpassCover.face4(...q, conc, [0, 1, 0]);
                const collider = underpassRoofCollider(roof, roofFaces, source?.sourceId);
                if (collider) { underpassColl.push(collider); underpassCollEdges.push(e); }
            }
            // The covered wall meets its actual underside, not a floating street-
            // level strip. Uncovered ramp retaining walls keep their prior rim.
            const wallStations = closedRoof ? [...new Set([0, ...roof.stations, 1])].sort((a, b) => a - b) : [0, 1];
            const sideRuns = closedRoof ? null : new Map([[wr, trenchWallRuns(e, wr)], [-wl, trenchWallRuns(e, -wl)]]);
            if (sideRuns) for (const r of sideRuns.values()) if (r.length !== 1 || r[0][0] > 0 || r[0][1] < 1) trenchGoreCuts++;
            for (let k = 1; k < wallStations.length; k++) {
                const a = wallStations[k - 1], b = wallStations[k], mid = (a + b) / 2;
                const covered = closedRoof && mid >= roof.span[0] && mid <= roof.span[1];
                const top = t => covered ? roof.ceilingAt(t) : .4;
                // (fidelity pass, street-level look 2024) Pasajul Unirii: dark perforated-metal cladding on the open ramps, pale
                // mesh panels inside the covered box; every other underpass keeps the plain concrete
                const wallCol = source?.tags?.name === 'Pasajul Unirii' ? rgb(covered ? '#c3c5c1' : '#4d5154') : conc;
                for (const [o, sgn] of [[wr, -1], [-wl, 1]]) for (const [a2, b2] of sideRuns ? clipRuns(sideRuns.get(o), a, b) : [[a, b]]) {
                    const yf = t => Math.min(yA + (yB - yA) * t, 0), pm = roofPoint((a2 + b2) / 2, o, 0);
                    const hall = covered ? sharedHallTram(pm[0], pm[2], -e.nx * sgn, -e.nz * sgn) : null;
                    if (!hall) { sb.face4(roofPoint(a2, o, yf(a2)), roofPoint(b2, o, yf(b2)), roofPoint(b2, o, top(b2)), roofPoint(a2, o, top(a2)), wallCol, [e.nx * sgn, 0, e.nz * sgn]); continue; }
                    // shared hall (2026-11-12 fidelity pass, Pasajul Victoria): a covered carriageway beside the roofed tram
                    // station is one hall in reality — a raised platform strip and a pier row instead of a wall (estimated sizes)
                    const so = Math.sign(o), o2 = o + so * Math.max(0, hall.gap), pf = .25, up = [0, 1, 0], inn = [e.nx * sgn, 0, e.nz * sgn];
                    sb.face4(roofPoint(a2, o, yf(a2)), roofPoint(b2, o, yf(b2)), roofPoint(b2, o, yf(b2) + pf), roofPoint(a2, o, yf(a2) + pf), conc, inn);
                    sb.face4(roofPoint(a2, o, yf(a2) + pf), roofPoint(b2, o, yf(b2) + pf), roofPoint(b2, o2, yf(b2) + pf), roofPoint(a2, o2, yf(a2) + pf), conc, up);
                    sb.face4(roofPoint(a2, o, top(a2)), roofPoint(b2, o, top(b2)), roofPoint(b2, o2, top(b2)), roofPoint(a2, o2, top(a2)), dark, [0, -1, 0]);
                    for (const nrm of [[-inn[0], 0, -inn[2]], inn]) sb.face4(roofPoint(a2, o2, top(a2)), roofPoint(b2, o2, top(b2)), roofPoint(b2, o2, -.02), roofPoint(a2, o2, -.02), dark, nrm); // soffit step up to the tram roof
                    if (a2 <= .5 && b2 >= .5 && hall.gap > .9) {
                        const dt = Math.min(1.3, e.len * .3) / e.len, t0 = .5 - dt, t1 = .5 + dt, p0 = o + so * .25, p1 = o + so * Math.min(hall.gap, 1.45), red = rgb('#c23a2e');
                        const q = (t, off, y) => roofPoint(t, off, y), along = [e.dirx, 0, e.dirz], back = [-e.dirx, 0, -e.dirz], out = [-inn[0], 0, -inn[2]];
                        sb.face4(q(t0, p0, yf(t0) + pf), q(t1, p0, yf(t1) + pf), q(t1, p0, top(t1)), q(t0, p0, top(t0)), conc, inn);
                        sb.face4(q(t0, p1, yf(t0) + pf), q(t1, p1, yf(t1) + pf), q(t1, p1, top(t1)), q(t0, p1, top(t0)), conc, out);
                        sb.face4(q(t0, p0, yf(t0) + pf), q(t0, p1, yf(t0) + pf), q(t0, p1, top(t0)), q(t0, p0, top(t0)), conc, back);
                        sb.face4(q(t1, p0, yf(t1) + pf), q(t1, p1, yf(t1) + pf), q(t1, p1, top(t1)), q(t1, p0, top(t1)), conc, along);
                        const pb = o + so * .22; sb.face4(q(t0, pb, yf(t0) + pf + .35), q(t1, pb, yf(t1) + pf + .35), q(t1, pb, yf(t1) + pf + .8), q(t0, pb, yf(t0) + pf + .8), red, inn); // warning band on the pier foot
                    }
                    { // (romana-1) fence between the piers, tram-stop benches / pole on the platform, sodium lamps under the soffit (hall-furniture.js)
                        const pdt = Math.min(1.3, e.len * .3) / e.len, pier = a2 <= .5 && b2 >= .5 && hall.gap > .9 ? [.5 - pdt, .5 + pdt] : null;
                        const f = emitHallFurniture({ q: (t, off, y) => roofPoint(t, off, y), floor: t => yf(t) + pf, ceil: top, a2, b2, o, so, gap: hall.gap, len: e.len, pier, inn, along: [e.dirx, 0, e.dirz],
                            face4: (...v) => sb.face4(...v), rgb, lampOffset: hallLampRuns.has(e.id + ':' + a2) ? null : (hallLampRuns.add(e.id + ':' + a2), (wr - wl) / 2), nearStop: hallStopNear }); // (lamps once per run: the first hall side drawn)
                        hallFurnitureStats.posts += f.posts; hallFurnitureStats.benches += f.benches; hallFurnitureStats.lamps += f.lamps;
                    }
                }
                if (covered && wallCol !== conc) for (const [o, sgn] of [[wr, -1], [-wl, 1]]) { // yellow accent panels ≈ every 14 m and the light line along the wall head
                    const oi = o + sgn * 0.03, fl = t => Math.min(yA + (yB - yA) * t, 0), n = [e.nx * sgn, 0, e.nz * sgn];
                    sb.face4(roofPoint(a, oi, top(a) - 0.4), roofPoint(b, oi, top(b) - 0.4), roofPoint(b, oi, top(b) - 0.22), roofPoint(a, oi, top(a) - 0.22), rgb('#f7f6ea'), n);
                    for (let s = Math.ceil(a * e.len / 14) * 14; s + 3 < b * e.len; s += 14) { const p = s / e.len, q = (s + 3) / e.len; sb.face4(roofPoint(p, oi, fl(p) + 0.5), roofPoint(q, oi, fl(q) + 0.5), roofPoint(q, oi, top(q) - 0.6), roofPoint(p, oi, top(p) - 0.6), rgb('#e3bd1c'), n); }
                }
            }
            // parapet on the trench rim where the collision wall stands above street level (to 1.0 m; play-test note 46: the
            // 1 m trench wall beside Bd. Iancu de Hunedoara was invisible from the street side) — open / uncovered part only
            if (!e.lidded) {
                const fY = (t) => e.ya + (e.yb - e.ya) * t, tAt = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1);
                let p0 = 0, p1 = 1;
                const cut = (thr, keepBelow) => { if (fY(0) < thr === fY(1) < thr) return (fY(0) < thr) === keepBelow; const tc = tAt(thr); if ((fY(0) < thr) === keepBelow) p1 = Math.min(p1, tc); else p0 = Math.max(p0, tc); return true; };
                if (cut(-0.35, true) && (!e.tunnel || cut(-4.2, false)) && p1 - p0 > 0.01) {
                    const Pt = (t, o, y) => P(t * e.len, o, y), cap = rgb('#b4b0a8');
                    for (const [o, sgn] of [[wr, -1], [-wl, 1]]) for (const [q0, q1] of sideRuns ? clipRuns(sideRuns.get(o), p0, p1) : [[p0, p1]]) {
                        const oo = o + 0.25 * -sgn;
                        if (trenchParapetRow(`${city.id}-${distId}`, e.name)) { emitTrenchBalustrade(sb, c.detail, Pt, q0, q1, o, oo, [e.nx * sgn, 0, e.nz * sgn], e.len); continue; } // (round 3: reviewed rim class, trench-parapets.js)
                        sb.face4(Pt(q0, o, 0.4), Pt(q1, o, 0.4), Pt(q1, o, 1.0), Pt(q0, o, 1.0), conc, [e.nx * sgn, 0, e.nz * sgn]);
                        sb.face4(Pt(q1, oo, 0), Pt(q0, oo, 0), Pt(q0, oo, 1.0), Pt(q1, oo, 1.0), conc, [-e.nx * sgn, 0, -e.nz * sgn]);
                        sb.face4(Pt(q0, oo, 1.0), Pt(q1, oo, 1.0), Pt(q1, o, 1.0), Pt(q0, o, 1.0), cap, [0, 1, 0]);
                    }
                }
            }
            if (!closedRoof && e.tunnel && !e.coveredRoadModel && !e.lidded && Math.min(e.ya, e.yb) < -4.2) { // (play-test note 45) partly deep tunnel edge: the
                // covered part (deeper than 4.2 m) gets its lid / ceiling and a portal where it opens (the hole in Piața Victoriei)
                const tY = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1), t4 = tY(-4.2);
                const [t0, t1] = e.ya < e.yb ? [0, t4] : [t4, 1];
                const Pt = (t, o, y) => P(t * e.len, o, y);
                const y0c = e.ya + (e.yb - e.ya) * t0 + Y.road + 5.2, y1c = e.ya + (e.yb - e.ya) * t1 + Y.road + 5.2;
                sb.face4(Pt(t0, wr, y0c), Pt(t1, wr, y1c), Pt(t1, -wl, y1c), Pt(t0, -wl, y0c), dark, [0, -1, 0]);
                c.ground.face4(Pt(t0, wr + 0.3, 0.06), Pt(t1, wr + 0.3, 0.06), Pt(t1, -wl - 0.3, 0.06), Pt(t0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]);
                const tp = e.ya < e.yb ? t1 : t0, yp = (tp === t1 ? y1c : y0c), out = e.ya < e.yb ? 1 : -1;
                sb.face4(Pt(tp, wr + 0.5, yp), Pt(tp, -wl - 0.5, yp), Pt(tp, -wl - 0.5, 1.2), Pt(tp, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
            }
            if (!closedRoof && e.tunnel && e.lidded) { // (shallow 'tunnels' < 4.5 m deep stay open trenches: a lid would lie on the street)
                const ca = yA + 5.2, cb = yB + 5.2;
                sb.face4(Pm(0, wr, ca), Pm(1, wr, cb), Pm(1, -wl, cb), Pm(0, -wl, ca), dark, [0, -1, 0]); // ceiling
                c.ground.face4(Pm(0, wr + 0.3, 0.06), Pm(1, wr + 0.3, 0.06), Pm(1, -wl - 0.3, 0.06), Pm(0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]); // lid at street level (paved, like the square above)
                // portal facade where the tunnel opens onto a non-tunnel road
                for (const n of [e.a, e.b]) {
                    if (n.edges.every(f => f === e || f.virtual || f.lidded)) continue;
                    const s2 = n === e.a ? 0 : e.len, yc = (n === e.a ? ca : cb);
                    const out = n === e.a ? -1 : 1;
                    sb.face4(P(s2, wr + 0.5, yc), P(s2, -wl - 0.5, yc), P(s2, -wl - 0.5, 1.2), P(s2, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
                }
            }
            // (R24, Pipera (-762, 178): the Promenada Mall garage aisle cut by the district edge ran out into daylight) a lidded
            // tunnel that dead-ends is closed by a concrete end wall, floor to ceiling, 1 m in (the district edge clips what
            // stands on it). Only at the district boundary cut: some source tunnels (SeaTac Air Cargo Road) are unjoined pieces.
            if (e.lidded) for (const n of [e.a, e.b]) if (districtCutNodes.has(n) && n.edges.every(f => f === e || f.virtual)) {
                const atA = n === e.a, d = Math.min(1, e.len / 2), t = atA ? d / e.len : 1 - d / e.len, s2 = t * e.len,
                    yf = yA + (yB - yA) * t, yc = closedRoof ? roof.ceilingAt(t) : yf + 5.2, out = atA ? -1 : 1;
                sb.face4(P(s2, -wl, yf - 0.1), P(s2, wr, yf - 0.1), P(s2, wr, yc), P(s2, -wl, yc), conc, [-e.dirx * out, 0, -e.dirz * out]);
            }
            };
            const sourceTunnel = data.roadSourceGeometry?.[e.road]?.tags?.tunnel;
            if (e.tunnel && sourceTunnel && sourceTunnel !== 'no') deferredUnderpassDown.push(emitDown); else emitDown();
        }
    }
    // (world side joins: world-side-joins.js)
    const {
        RIB_ONLY, clearOf, kerbSpot, liftOnSide, medianFill, medianGrid, obbPoly, onRibbon,
        polyOnRibbon, raisedDeck, raisedTop, ribGrid, segsCross, walls,
    } = buildSideJoins({
        ASPHALT, DY_SIDE, SIDE_BACK, US, asphaltCorners, bridgeJunctionAudit, bridgeJunctionDecks, cellOf,
        cornerGrid, cornerPolys, cornerSkips, coveredByOther, data, edgeGrid, edges, kerbCol,
        layerY, padAsphalt, padCorners, padHeightAt, pierColl, pierSpots, polyDist, railRoadside,
        raised, raisedEdge, retainedDeck, ribbons, sceneryDeckGrid, sharedPadSurfaces, sideCol, sideExtra,
        sideJoins, widthAsphalt, widthSide, yAlong,
    });
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
        wallCut += cutPieces;
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
    dmask = boundarySupport.extendMask(dmask);
    // (world buildings: world-buildings.js)
    const {
        LANDMARKS, assemblyAudit, assemblyRejected, bDropped, bGrid, bRecs, bShrunk, buildLandmarkFn,
        buildingAt, buildingIndex, buildingPassageAudit, carParkOutlines, clearanceAudit, coveredOutlines, entranceCanopies, heightFixes,
        landmarkSourceReplacements, landmarkSurfaceMats, landmarks, mapEnds, outlineParts, overlapCuts, roofPrefetch, roofProfileAudit,
        tramDeckSupportAt,
    } = await buildBuildingsLandmarks({
        US, ballastCol, boundarySupport, bounds, buildPool, cellOf, city, coveredRoadModels,
        data, distCfg, distId, dmask, edgesInBox, inDistrictLL, nearestEdge, nodeArr,
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
            WATER_API = await import('./water.js');
            preparedSmallWater = prepareSmallWaterGroups(cells, { subdivide: WATER_API.subdivideWater, covered: coveredWater });
        } catch (error) { console.warn('Final water owner preparation unavailable; raw water remains unresolved', error); }
        if (preparedSmallWater) {
            const retainedWater = [...preparedSmallWater.values()].map(entry => waterOwnerSurface(entry.geometry, 'water-final:' + entry.key));
            retainedWater.push(...landmarkWaterSurfaces(landmarks));
            underpassOwners = combineUnderpassWaterOwners(underpassGroundOwners, buildUnderpassOwnerIndex(retainedWater, underpassOwnerOptions));
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

    dressSports(); // (sports-ground markings / goals / nets — after the landmarks, so their own grounds are skipped)
    // CV POIs (offices, schools, airports)
    const pois = [], poiDoorGuides = new MeshBuilder();
    const poiGroup = new THREE.Group(); poiGroup.name = 'pois'; group.add(poiGroup);
    const drivable = (e) => e.drivable && !/motorway|trunk_link/.test(e.type) && !e.tunnel && e.type !== 'service';
    const kerbPoint = (x, z, re, radius = 350, anyRoad = false) => {
        let ne = re ? nearestEdge(x, z, (e) => drivable(e) && re.test(e.name), radius) : null;
        if (!ne && !anyRoad) ne = nearestEdge(x, z, drivable, 90);
        if (!ne) ne = nearestEdge(x, z, (e) => e.drivable && !e.virtual && !/motorway/.test(e.type) && !e.tunnel); // campus / access service roads
        const e = ne.edge;
        const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        const off = (side > 0 ? e.wR : e.wL) + 1.0;
        // never in a junction: keep the door ≥ 4 m clear of the pads at both ends (when the street is long enough)
        const r0 = retract(e, e.a) + 4, r1 = e.len - retract(e, e.b) - 4;
        if (r1 > r0) { const sAl = clamp(ne.t * e.len, r0, r1); ne.cx = e.a.x + e.dirx * sAl; ne.cz = e.a.z + e.dirz * sAl; }
        return { x: ne.cx + e.nx * off * side, z: ne.cz + e.nz * off * side, edge: e, side, cx: ne.cx, cz: ne.cz };
    };
    const signs = new SignAtlas();

    for (const p of city.pois || []) {
        if (!inDistrictLL(p.lat, p.lon)) continue; // a district only has its own stops
        let q = city.proj(p.lat, p.lon);
        const kind = p.kind;
        if (p.junction) { // anchor on the named street corner nearest to the given point (e.g. Călărașilor × Traian)
            let best = null, bd = 700;
            for (const n of nodeArr) {
                if (n.edges.length < 3 || !p.junction.every(re => n.edges.some(e => re.test(e.name)))) continue;
                const d = Math.hypot(n.x - q.x, n.z - q.z); if (d < bd) { bd = d; best = n; }
            }
            if (best) {
                // step 18 m off the corner along the first street, on the side of the original point
                const e = best.edges.find(f => p.junction[0].test(f.name));
                const out = e.a === best ? 1 : -1;
                q = { x: best.x + e.dirx * out * 18, z: best.z + e.dirz * out * 18 };
            }
        }
        let b = buildingAt(q.x, q.z);
        if (b && b.area > 15000 && kind !== 'airport') b = null; // campus-sized outlines: use the address point instead
        const inLandmark = landmarks.find(l => l.radius > 0 && Math.hypot(l.x - q.x, l.z - q.z) < l.radius);
        if (!b && kind !== 'airport' && !inLandmark) { let bd = 45; bGrid.each(q.x - 45, q.z - 45, q.x + 45, q.z + 45, (o) => { if (o.skip || o.area < 150) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (kind === 'airport' && !b && !inLandmark) { let bd = 160; bGrid.each(q.x - 160, q.z - 160, q.x + 160, q.z + 160, (o) => { if (o.skip || o.area < 2000) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        let anchor = b ? { x: b.c[0], z: b.c[1] } : { x: q.x, z: q.z };
        let door = kerbPoint(kind === 'airport' ? anchor.x : (anchor.x + q.x) / 2, kind === 'airport' ? anchor.z : (anchor.z + q.z) / 2, p.road, p.roadRadius || 350, kind === 'airport'); // airports: the terminal loop (service roads)
        // the address street is further than the building we found (geocode slightly off): use the building fronting that street
        if (p.road && kind !== 'airport' && !inLandmark && Math.hypot(anchor.x - door.x, anchor.z - door.z) > 35) {
            let nb = null, bd = 40;
            bGrid.each(door.x - 45, door.z - 45, door.x + 45, door.z + 45, (o) => { if (o.skip || o.area < 120 || o.area > 15000) return; const d = Math.hypot(o.c[0] - door.x, o.c[1] - door.z); if (d < bd) { bd = d; nb = o; } });
            if (nb) { b = nb; anchor = { x: nb.c[0], z: nb.c[1] }; door = kerbPoint(anchor.x, anchor.z, p.road, 120); }
        }
        if (p.doorAlong && door.edge) { // slide the door along its street (e.g. GTS: before the busy Traian junction, not after it)
            const e = door.edge, br = (p.doorAlong.bearing ?? 270) * Math.PI / 180, dir = (e.dirx * Math.sin(br) - e.dirz * Math.cos(br)) >= 0 ? 1 : -1;
            const ne2 = nearestEdge(door.cx + e.dirx * dir * p.doorAlong.m, door.cz + e.dirz * dir * p.doorAlong.m, (f) => drivable(f) && (!p.road || p.road.test(f.name)), 60);
            if (ne2) { const f = ne2.edge, sd = door.side * Math.sign(f.nx * e.nx + f.nz * e.nz || 1), off = (sd > 0 ? f.wR : f.wL) + 1.0; door = { x: ne2.cx + f.nx * off * sd, z: ne2.cz + f.nz * off * sd, edge: f, side: sd, cx: ne2.cx, cz: ne2.cz }; }
        }
        const stop = STOPS.find(s => s.poi === p.id);
        if (stop && !p.color) p.color = stop.color;
        const poi = { id: p.id, kind, label: p.label, brand: '', address: p.address || '', x: anchor.x, z: anchor.z, doorX: door.x, doorZ: door.z, color: p.color || null, icon: p.icon || null, visited: false, h: 20, w: 26, d: 22, cv: !p.passing, interactive: !p.passing, passing: !!p.passing, caption: p.caption || null };
        if (b) {
            b.cv = poi; poi.h = b.h; poi.w = b.x1 - b.x0; poi.d = b.z1 - b.z0;
            // (landmarks Request) a CV-stop landmark that models its own signage (ownSign) gets no generic CV panel
            const ownSign = LANDMARKS.some(l => l.ownSign && (l.cvStop === p.id || (stop && l.cvStop === stop.id)));
            if (!ownSign) { b.name = p.label; b.flags |= 2; b.cvSign = true; }
        } else if (inLandmark) {
            poi.h = 25; poi.landmark = inLandmark.id;
        } else { poi.h = kind === 'airport' ? 18 : 20; } // retain the sourced stop and door without fabricating a building
        // floating marker
        const marker = new THREE.Group();
        const pin = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12), new THREE.MeshBasicMaterial({ color: p.color || '#f97316' }));
        pin.rotation.x = Math.PI; marker.add(pin);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 2.4; marker.add(ring);
        { // over the building itself (the centroid of an L / U-shaped footprint can lie over the street)
            let mx = poi.x, mz = poi.z;
            if (b && b.ring && !pointInPolygon(mx, mz, b.ring)) {
                let bd = Infinity; const st = Math.max(1, Math.min(b.x1 - b.x0, b.z1 - b.z0) / 12);
                for (let x = b.x0; x <= b.x1; x += st) for (let z = b.z0; z <= b.z1; z += st) {
                    if (!pointInPolygon(x, z, b.ring) || polyDist(x, z, b.ring) < 2) continue;
                    const d = Math.hypot(x - poi.x, z - poi.z); if (d < bd) { bd = d; mx = x; mz = z; }
                }
            } else if (!b && !inLandmark) { mx = door.x; mz = door.z; } // no footprint: above the door
            marker.position.set(mx, poi.h + 8, mz);
        }
        marker.userData.pin = pin;
        poiGroup.add(marker);
        poi.marker = marker; if (p.passing) marker.visible = false; // a passing landmark (caption) has no stop marker / door mat
        // door mat / entrance plaza at the kerb
        if (!p.passing) poiDoorGuides.flatFan([[door.x - 1.2, door.z - 1.2], [door.x + 1.2, door.z - 1.2], [door.x + 1.2, door.z + 1.2], [door.x - 1.2, door.z + 1.2]], Y.road + Y.mark + 0.01, rgb(p.color || '#f97316'));
        pois.push(poi);
    }
    // (world facades and deck guards: world-facades-guards.js)
    const {
        ARCH, DROP, basarabStructure, bridgeBents, collision, facadeBoards, fasciaLayoutAudit, ghostRails,
        guardCompletion, lmSignColl, palette, propColl, railingDrops, roofCols, tramRailings,
    } = await buildFacadesGuards({
        ASPHALT, LANDMARKS, US, addSignQuad, asphaltCorners, bGrid, bRecs, bridgeJunctionDecks,
        buildingAt, buildingIndex, cellOf, cells, city, country, coveredByOther, coveredOutlines,
        data, distId, edgeGrid, edges, floatingSupport, group, isWater, landmarks,
        lmGroup, medianFill, medianGrid, nearestEdge, onRibbon, padHeightAt, pierColl, pois,
        polyDist, raised, raisedDeck, retainedDeck, sceneryDeckGrid, signMB, signs, surfGrid,
        surfList, surfacesAt, tramDecks, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts, trams,
        walls, widthAsphalt, widthSide, yAlong,
    });
    // (world railing network: world-railing-network.js)
    const {
        addPropColl, fenceSegs, railingNetwork, reviewedBridgeRailings, treeClear, waterBridgeRailings,
    } = buildRailingNetwork({
        DROP, DY_SIDE, bRecs, basarabBlue, basarabStructure, buildingAt, buildingIndex, cellOf,
        coveredByOther, data, edges, fountainBasinColl, ghostRails, group, isWater, landmarkFences,
        liftOnSide, lmSignColl, nearestEdge, onRibbon, propColl, raisedTop, segsCross, sportsColl,
        str, surfacesAt, tramSweep, walls, widthAsphalt, widthSide, yAlong,
    });
    let wallTris = 0;
    // (spec 10 load budget) a source building's roof signature (and its hash) is made once for this loop, which changes no
    // field the signature reads (i, h, minH, ring, holes, roofProfile): a building is the source of several roof surfaces
    const roofsReady = roofPrefetch ? await roofPrefetch : null;
    /** the worker's roof of b (its faces, walls and wall normals; heightAt made here on first use), or null */
    const prefetchedRoof = (b, roofLazy) => {
        const r = roofsReady?.get(b); if (!r || r.ring !== b.ring || r.holes !== b.holes || r.profile !== b.roofProfile) return null;
        return { faces: r.faces, walls: r.walls, wallNormals: r.wallNormals, heightAt: (...a) => roofLazy().heightAt(...a) };
    };
    const roofSignatureMatches = new Map(), roofSignatureMatch = (source) => { let m = roofSignatureMatches.get(source); if (!m) roofSignatureMatches.set(source, m = signatureMatcher(roofSignature(source))); return m; };
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        if (b.aircraft) {
            const body = aircraftBody(b.ring, b.h);
            if (!body) continue;
            const col = rgb(b.colour || '#8b9390'), dark = shadeRgb(col, .7), ring = b.ring;
            const {pts,tris} = triangulate(ring,b.holes);
            if (tris.length) c.roof.flatPoly(pts,tris,body.wingTopM,col,.1,-1);
            for (const tri of tris) mb.face3(...tri.map(i=>[pts[i][0],body.wingBaseM,pts[i][1]]),dark,[0,-1,0]);
            for(let i=0;i<ring.length;i++){const a=ring[i],p=ring[(i+1)%ring.length],L=Math.hypot(p[0]-a[0],p[1]-a[1]);if(L>.01)mb.wall(a[0],a[1],p[0],p[1],body.wingBaseM,body.wingTopM,(p[1]-a[1])/L,-(p[0]-a[0])/L,col);}
            for(const f of body.faces)mb.face3(...f,col);
            c.detail.face3(...body.tail,col);c.detail.face3(...body.tail.slice().reverse(),dark);
            const box={x:b.c[0],z:b.c[1],r:Math.max(...ring.map(p=>Math.hypot(p[0]-b.c[0],p[1]-b.c[1]))),sourceId:data.buildingIds?.[b.i],aircraft:true,estimated:true,angle:0};
            collision.push({...box,poly:ring,holes:b.holes,minH:body.wingBaseM,h:body.wingTopM,y1:body.wingTopM});
            collision.push({...box,poly:body.footprint,holes:[],minH:body.bodyBaseM,h:body.bodyTopM,y1:body.bodyTopM});
            collision.push({...box,poly:body.tailFootprint,holes:[],minH:b.h*.48,h:b.h,y1:b.h});
            for(const [x,z] of body.gear){mb.box(x,.13,z,.22,Math.max(.05,body.bodyBaseM-.13),.18,0,dark);propColl.push({x,z,r:.16,hw:.11,hd:.09,angle:0,poly:null,h:body.bodyBaseM,prop:true,kind:'aircraft-gear',sourceId:box.sourceId,estimated:true});}
            continue;
        }
        if (b.canopy) {
            // Explicitly reviewed open roof: preserve its full mapped plan and its vertical collision band.
            // Dimension/support provenance stays in data.buildingCanopies; estimates are not OSM clearance tags.
            const ring = b.ring, roofCol = rgb(b.roofColour || '#a7a8a2');
            // (r3) a fuel canopy's brand: the source POI on it, else the canopy review row's OSM brand; look per station (fuel-look.js)
            const fuelPoi = data.pois.find(r => r[6] === b.i && data.poiKinds[r[0]] === 'fuel' && (str(r[4]) || str(r[3]))), fuelText = fuelPoi ? (str(fuelPoi[4]) || str(fuelPoi[3])) : (b.canopy.brand || (fuelStationRow(city.id + '-' + distId, data.buildingIds?.[b.i])?.brand) || ''); // (r3-look-3: a reviewed canopy row names the brand of an untagged canopy)
            const fuelLk = fuelText ? fuelLookFor(fuelText, fuelStationRow(city.id + '-' + distId, data.buildingIds?.[b.i])) : null;
            const sideCol = rgb(fuelLk?.soffit || '#d6d5ce');
            const canopy = canopyGeometry(b, triangulate), sourceRoof = canopy.native;
            const canopyAudit = roofProfileAudit.canopies ||= { native: [], legacyFlat: [] };
            canopyAudit[sourceRoof ? 'native' : 'legacyFlat'].push({ sourceId: data.buildingIds?.[b.i] || b.i, shape: sourceRoof ? b.roofProfile.shape : 'flat', totalM: b.h, eavesM: canopy.eavesM, minimumM: b.minH });
            const cached = sourceRoof && data.buildingRoofSurfaces?.[b.i];
            const valid = cached?.sources?.every(s => { const source = bRecs[s.i]; return source && !source.skip && roofSignatureMatch(source)(s.signature); });
            if (cached) { if (valid) roofProfileAudit.surfacesApplied++; else roofProfileAudit.surfacesRejected.push(data.buildingIds?.[b.i] || b.i); }
            const unpack = face => data.buildingRoofGeometryPoints ? face.map(i => data.buildingRoofGeometryPoints[i]) : face;
            if (sourceRoof) for (const face of valid ? cached.faces.map(unpack) : canopy.roofFaces) c.roof.face3(...face, roofCol, [0, 1, 0]);
            else c.roof.flatPoly(canopy.triangulation.pts, canopy.triangulation.tris, b.h, roofCol, .1, -1);
            for (const face of canopy.underside) mb.face3(...face, sideCol, [0, -1, 0]);
            // (fidelity pass 2026-11-12, Pipera Petrom w241976323 / Lukoil w547396767) a mapped fuel canopy with an OSM brand has its
            // fascia in the brand's colours and the brand name on its two longest faces; no pumps / pylon are guessed
            const fuelBrand = fuelLk ? fuelLk.sign : fuelText ? brandStyle(fuelText) : null;
            const fasciaCol = fuelLk ? rgb(fuelLk.fascia) : fuelBrand ? rgb(fuelBrand[0]) : sideCol;
            for (const wall of canopy.walls) for (const q of fasciaQuads(wall, fuelLk)) mb.face4(...q.v, q.col ? rgb(q.col) : fasciaCol, wall.normal);
            if (fuelBrand && canopy.eavesM - b.minH >= 0.3) {
                const fs = signs.get((fuelLk?.text || fuelText).slice(0, 18), fuelBrand[0], fuelBrand[1], fuelBrand[2]), sh = Math.min(0.75, (canopy.eavesM - b.minH) * 0.84);
                if (fs) for (const wall of canopy.walls.map(wl => ({ wl, L: Math.hypot(wl.vertices[1][0] - wl.vertices[0][0], wl.vertices[1][2] - wl.vertices[0][2]) })).sort((p, q) => q.L - p.L).slice(0, 2)) {
                    const [p0, p1] = wall.wl.vertices, n = wall.wl.normal, sw = Math.min(wall.L * 0.8, sh * fs.aspect);
                    (b.brandBoardFaces ||= []).push({ nx: n[0], nz: n[2] }); // (the POI pass adds no second board on these faces)
                    addSignQuad(c, (p0[0] + p1[0]) / 2 + n[0] * 0.03, (p0[2] + p1[2]) / 2 + n[2] * 0.03, Math.atan2(n[0], n[2]), 1, sw, sw / fs.aspect, b.minH + (canopy.eavesM - b.minH - sw / fs.aspect) / 2, fs, 0.02);
                }
            }
            if (valid) for (const wall of cached.walls) mb.face3(...unpack(wall.vertices), sideCol, wall.normal);
            else if (sourceRoof) for (const [i, wall] of sourceRoof.walls.entries()) mb.face4(...wall, sideCol, sourceRoof.wallNormals[i]);
            // Structural supports are an explicit authoring estimate, placed only where their complete square is clear.
            const width = b.canopy.supportWidthM || 0.35, supports = [];
            if (b.canopy.estimateSupports) for (const p of ring) {
                const dx = b.c[0] - p[0], dz = b.c[1] - p[1], L = Math.hypot(dx, dz); if (L < 1.2) continue;
                const x = p[0] + dx / L, z = p[1] + dz / L;
                if (supports.some(q => Math.hypot(q[0] - x, q[1] - z) < 3)) continue;
                const fp = obbPoly({ x, z, hw: width / 2, hd: width / 2, angle: 0 });
                if (!fp.every(q => pointInPolygon(q[0], q[1], ring) && !b.holes.some(h => pointInPolygon(q[0], q[1], h))) || polyOnRibbon(fp)) continue;
                let blocked = false;
                bGrid.each(x - width, z - width, x + width, z + width, o => { if (o !== b && !o.skip && (fp.some(q => pointInPolygon(q[0], q[1], o.ring)) || o.ring.some(q => pointInPolygon(q[0], q[1], fp)) || polysCross(fp, o.ring))) blocked = true; });
                if (blocked) continue;
                mb.box(x, Y.side, z, width, Math.max(0.01, b.minH - Y.side), width, 0, rgb(fuelLk?.column || '#b8b9b4'));
                propColl.push({ x, z, r: width * Math.SQRT1_2, hw: width / 2, hd: width / 2, angle: 0, poly: fp, h: b.minH, prop: true, kind: 'canopy-support', sourceId: data.buildingIds?.[b.i], estimated: true });
                supports.push([x, z]);
            }
            b.canopySupports = supports.length;
            collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(p => Math.hypot(p[0] - b.c[0], p[1] - b.c[1]))), poly: ring, holes: b.holes, sourceId: data.buildingIds?.[b.i], minH: b.minH, h: b.h, ...(sourceRoof ? { y0: b.minH, y1: b.h, roofHeightAt: sourceRoof.heightAt } : {}), angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, canopy: true });
            continue;
        }
        const surface = b.sourceSurface || b.assemblySurface;
        const seedI = b.overlapCut ? b.derivedFrom : b.i; // (the pieces of a cut building keep its one colour and style)
        const brng = makeRng(seedI * 7919 + 13);
        const carParkOutline = carParkOutlines.length ? carParkOutlines.find(o => o.i === (b.derivedFrom ?? b.i)) || carParkOutlines.find(o => o.skip && b.c[0] >= o.x0 && b.c[0] <= o.x1 && b.c[1] >= o.z0 && b.c[1] <= o.z1 && pointInPolygon(b.c[0], b.c[1], o.ring)) : null;
        const carPark = carParkOutline ? carParkOf(data.buildingIds?.[carParkOutline.i], data.buildingSourceTags) : null; // (fidelity pass r2) open parking decks: car-parks.js
        const AR = !carPark && !b.roofProfile && !b.assembly && !b.sourceSurface && !b.holes.length && !b.passages?.length && b.arch && ARCH ? ARCH.emit(b, c, makeRng(seedI * 7919 + 17)) : null; // archetype roofs do not yet support courtyards
        // (2026-11-08) Bucharest villas keep the interwar facade tiles but the villa quarter's warmer plasters (cream, ochre,
        // pale yellow, salmon, off-white, sage — Floreasca / Dorobanți), not the interwar blocks' greys
        const pal = (b.villa && VILLA_PAL) || palette[b.style] || palette.plain;
        // OSM / research colour first, but the research estimates are mostly the same pale beige: a pale, unsaturated
        // tagged colour only sets the tone, the hue comes from the city / style / era palette (per-building variety)
        const palPick = rgb(pal[Math.floor(brng() * pal.length)]);
        let wallCol = palPick;
        if (b.colour && (b.style !== 'glass' || b.reviewedColour)) { // (backlog r3-landmarks-1: a reviewed glass colour is kept, Agora's silver-grey wall rendered dark blue)
            const tc = rgb(b.colour), mx = Math.max(...tc), mn = Math.min(...tc), sat = mx ? (mx - mn) / mx : 0;
            // (fidelity pass, Hanul lui Manuc: OSM building:colour=white came out ochre) a literal source colour tag is not a
            // research estimate: it wins outright wherever the raw source tags are retained (data.buildingSourceTags)
            const literalColour = !!b.reviewedColour || !!data.buildingSourceTags?.[data.buildingIds?.[b.derivedFrom ?? b.i]]?.['building:colour']; // (reviewedColour: building-review.js)
            wallCol = literalColour || sat > 0.3 || mx < 120 ? tc : mixRgb(tc, palPick, 0.85); // (research estimates: tone only)
        }
        { // per-building hue / value jitter
            const j = 0.9 + brng() * 0.16, w = (brng() - 0.5) * 0.08;
            wallCol = [clamp(Math.round(wallCol[0] * j * (1 + w)), 0, 255), clamp(Math.round(wallCol[1] * j), 0, 255), clamp(Math.round(wallCol[2] * j * (1 - w)), 0, 255)];
            if (b.style !== 'glass') { const l = (wallCol[0] + wallCol[1] + wallCol[2]) / 3, k = 1.35; wallCol = wallCol.map(v => clamp(Math.round(l + (v - l) * k), 0, 255)); } // (AgX desaturates pale plasters)
        }
        if (b.cv) wallCol = shadeRgb(rgb('#f4f1ea'), 1);
        // very dark researched / tagged facades (dark glass, black cladding: linear luminance < 0.05) read as flat black
        // blocks in shade: lift them to dark-grey glass and give them the curtain-wall tile
        const lum = (0.2126 * wallCol[0] + 0.7152 * wallCol[1] + 0.0722 * wallCol[2]) / 255;
        let darkGlass = false;
        if (lum < 0.05) { wallCol = lum > 0.004 ? shadeRgb(wallCol, 0.07 / lum) : [17, 19, 22]; darkGlass = true; }
        // facade texture: base tile or its variant (atlas rows 2–3), slightly varied bay width per building
        const tile = (darkGlass ? TILE.glass : (TILE[b.style] ?? 7)) + (brng() < 0.5 ? 8 : 0);
        let floorH = b.style === 'bloc' ? 2.9 : b.style === 'glass' ? 3.6 : b.style === 'eclectic' || b.style === 'church' ? 3.7 : 3.2;
        if (b.levels > 0 && b.style !== 'church') floorH = clamp(((b.roofProfile?.eavesM ?? b.h) - Math.max(0, b.minH)) / b.levels, 2.6, 5.5); // real floor count from building:levels
        const bayW = (b.style === 'glass' ? 2.4 : b.style === 'house' ? 3.6 : 3.3) * (0.88 + brng() * 0.24);
        const ring = b.ring;
        const ccw = signedArea(ring) > 0; // counter-clockwise (x right, z up) → outward normal = (dz, -dx)
        const h = b.roofProfile?.eavesM ?? b.h, y0 = b.minH > 0 ? b.minH : Math.min(0.18, h);
        // (after round 6) whole storeys: the wall holds an integer number of window rows, so the top row is never sliced
        // by the eaves / roof line. Church facades use the same atlas and need whole rows too.
        if (h - y0 > 2) { const n = Math.max(1, Math.round((h - y0) / floorH)); floorH = (h - y0) / n; }
        const shop = (b.flags & 1) && b.minH <= 0 && h > 6 && !carPark && b.style !== 'church' && !b.reviewedNoShopfront;
        if (shop && !b.shopFaces) b.shopFaces = streetFacing(b, signedArea(b.ring) > 0); // (district worlds: shopfronts on the street faces only)
        if (shop && b.shopFaces && b.shopFaceAt) { // (building-review row `shopFaceAt`: the reviewed shop opens on the face nearest its OSM node only; r3-look-12)
            const p = city.proj(b.shopFaceAt[0], b.shopFaceAt[1]); let kBest = -1, dBest = Infinity;
            for (let k = 0; k < b.ring.length; k++) { const a = b.ring[k], q = b.ring[(k + 1) % b.ring.length], dd = distPointSeg(p.x, p.z, a[0], a[1], q[0], q[1]).d; if (dd < dBest) { dBest = dd; kBest = k; } }
            b.shopFaces = b.shopFaces.map((v, k) => !!v && k === kBest);
        }
        const yShop = y0 + (b.gfh || 4.2); // (researched ground-floor height)
        const pitched = b.roof === 'gabled' || b.roof === 'pyramid';
        const wallTop = h;
        // (2026-11-08, owner: "this building still has weird windows at the roof") the facade tile repeats one window row per
        // storey from the top of the shopfront: the storeys above a shop must also be whole, or the last row is sliced by the roof
        if (shop && b.style !== 'church' && h - yShop > 2) { const n = Math.max(1, Math.round((h - yShop) / floorH)); floorH = (h - yShop) / n; }
        let perim = 0;
        if (!AR) for (let k = 0; k < ring.length; k++) { // (archetype buildings: walls from archetypes.js)
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            if (wallTop <= y0) continue;
            // outward normal: for signedArea<0 (counter-clockwise on screen with z down) the right-hand normal points out
            let nx = (bz - az) / L, nz = -(bx - ax) / L;
            if (!ccw) { nx = -nx; nz = -nz; }
            const [gc, gr] = TILE_GRID[tile] || [1, 1];
            if (carPark) { // spandrel / open-band decks on the unchanged source wall faces (passages stay open)
                const cp = b.carParkCols ||= (() => { const lv = carParkLevels(carPark, b.levels, wallTop - y0), con = carPark.wallColour ? rgb(carPark.wallColour) : b.colour ? wallCol : rgb('#b9b6ae'), lou = rgb(carPark.louvreColour || '#4b5058'); (roofProfileAudit.carParks ||= []).push({ sourceId: data.buildingIds?.[b.derivedFrom ?? b.i], levels: lv.levels, levelsSource: lv.source, baseM: y0, topM: wallTop, facade: carPark.facade || 'open' }); return { levels: lv.levels, base: y0, top: wallTop, concrete: con, dark: rgb('#2c2e31'), pier: shadeRgb(con, 1.06), facade: carPark.facade || 'open', louvre: lou, slat: shadeRgb(lou, 1.35) }; })();
                for (const face of clipPassageWall([ax, az], [bx, bz], surface ? surface.walls[k] : [{ t0: 0, t1: 1, y0, y1: wallTop }], b.passages || []))
                    emitCarParkWall(mb, ax + (bx - ax) * face.t0, az + (bz - az) * face.t0, ax + (bx - ax) * face.t1, az + (bz - az) * face.t1, face.y0, face.y1, cp.base, cp.top, cp.levels, nx, nz, cp);
                perim += L; continue;
            }
            // (after round 6) whole window bays per wall, restarting at every corner: windows were sliced at the corners of
            // narrow houses (the bays ran on round the perimeter); a wall too short for a bay shows plain wall
            const nbay = Math.round(L / bayW), u0 = k * 5, u1 = nbay > 0 ? u0 + nbay / gc : u0 + 0.02 / gc;
            const sourceWall=surface?.walls[k], wholeSourceWall=sourceWall?.length===1&&sourceWall[0].t0===0&&sourceWall[0].t1===1&&Math.abs(sourceWall[0].y0-y0)<1e-7&&Math.abs(sourceWall[0].y1-wallTop)<1e-7;
            if (surface && (!b.sourceSurface || !wholeSourceWall) || b.passages?.length) {
                const faces=clipPassageWall([ax,az],[bx,bz],surface?surface.walls[k]:[{t0:0,t1:1,y0,y1:wallTop}],b.passages||[]);
                for (const face of faces) {
                    const lerp = t => [ax + (bx - ax) * t, az + (bz - az) * t];
                    const a = lerp(face.t0), p = lerp(face.t1);
                    if (b.sourceSurface && !b.assembly && shop && !(b.shopFaces && !b.shopFaces[k])) {
                        const split=Math.min(face.y1,yShop);
                        if(split>face.y0)mb.wall(a[0],a[1],p[0],p[1],face.y0,split,nx,nz,distId?mixRgb(wallCol,[255,255,255],.45):rgb('#ffffff'),(perim+L*face.t0)/16,(perim+L*face.t1)/16,(face.y0-y0)/(yShop-y0),(split-y0)/(yShop-y0),TILE.shop+(b.i%2)*8);
                        const lower=Math.max(face.y0,yShop);
                        if(face.y1>lower)mb.wall(a[0],a[1],p[0],p[1],lower,face.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,(lower-yShop)/(floorH*gr),(face.y1-yShop)/(floorH*gr),tile);
                    } else if (b.sourceSurface && !b.assembly && shop) {
                        for (const band of nonShopWindowBands(face.y0,face.y1,y0,yShop,floorH,gr))
                            mb.wall(a[0],a[1],p[0],p[1],band.y0,band.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,band.v0,band.v1,tile);
                    } else mb.wall(a[0],a[1],p[0],p[1],face.y0,face.y1,nx,nz,wallCol,u0+(u1-u0)*face.t0,u0+(u1-u0)*face.t1,(face.y0-y0)/(floorH*gr),(face.y1-y0)/(floorH*gr),tile);
                }
                if(b.sourceSurface&&!b.assembly)perim += L;
                continue;
            }
            if (shop && !(b.shopFaces && !b.shopFaces[k])) { // (researched shopfronts: street faces only)
                // (district worlds: the shopfront's frame / piers take a light tint of the building's plaster, so a unit in
                //  an old house reads as windows in a rendered wall, not an aluminium curtain)
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, mixRgb(wallCol, [255, 255, 255], 0.45), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (seedI % 2) * 8);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / (floorH * gr), tile);
                // night light spill on the sidewalk in front of the shop window (additive decal, 0 by day)
                if (L > 2.5) {
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, D = 3.0;
                    const ne = nearestEdge(mx + nx * 3, mz + nz * 3, (e) => !e.virtual && e.type !== 'service', 30);
                    // only shopfronts on a street (its carriageway within ≈ 12 m: a sidewalk), never fronts on a square / plaza
                    const wallToRoad = ne ? Math.max(0, ne.d + 3 - (((mx + nx * 3 - ne.cx) * ne.edge.nx + (mz + nz * 3 - ne.cz) * ne.edge.nz) >= 0 ? ne.edge.wR : ne.edge.wL)) : Infinity;
                    if (ne && wallToRoad < 12 && !buildingAt(mx + nx * 1.5, mz + nz * 1.5) && !isPark(mx + nx * 2, mz + nz * 2)) {
                        const sb = c.spill || (builderEpoch++, c.spill = new MeshBuilder()), w0 = [255, 255, 255], yS2 = (raisedTop(mx + nx * 1.5, mz + nz * 1.5) !== null ? Y.road + Y.kerb : Y.side) + 0.02;
                        // inset 0.3 m at both ends; stop at the kerb (never on the carriageway)
                        const ux = (bx - ax) / L, uz = (bz - az) / L, p0x = ax + ux * 0.3, p0z = az + uz * 0.3, p1x = bx - ux * 0.3, p1z = bz - uz * 0.3;
                        let d = Math.min(D, wallToRoad - 0.4); const offRoad = (dd) => { for (const f of [0, 0.25, 0.5, 0.75, 1]) { const px = p0x + (p1x - p0x) * f + nx * dd, pz = p0z + (p1z - p0z) * f + nz * dd; if (onRibbon(px, pz, 0.25)) return false; } return true; }; while (d > 0.8 && !offRoad(d)) d -= 0.4;
                        if (d > 0.8) {
                            const i0 = sb.v(p0x, yS2, p0z, 0, 1, 0, 0.5, 1, w0), i1 = sb.v(p1x, yS2, p1z, 0, 1, 0, 0.5, 1, w0);
                            const i2 = sb.v(p1x + nx * d, yS2, p1z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0), i3 = sb.v(p0x + nx * d, yS2, p0z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0);
                            sb.triUp(i0, i1, i2); sb.triUp(i0, i2, i3);
                        }
                    }
                }
            } else if (shop) {
                for (const band of nonShopWindowBands(y0,wallTop,y0,yShop,floorH,gr))
                    mb.wall(ax,az,bx,bz,band.y0,band.y1,nx,nz,wallCol,u0,u1,band.v0,band.v1,tile);
            } else mb.wall(ax,az,bx,bz,y0,wallTop,nx,nz,wallCol,u0,u1,0,(wallTop-y0)/(floorH*gr),tile);
            if (!shop && L > 2 && b.style !== 'glass' && b.style !== 'house' && wallTop > 6) mb.wall(ax + nx * 0.04, az + nz * 0.04, bx + nx * 0.04, bz + nz * 0.04, y0, y0 + 0.9, nx, nz, shadeRgb(wallCol, 0.68)); // darker plinth
            wallTris += shop ? 4 : 2;
            perim += L;
        }
        if (b.style === 'church' && !AR && !carPark && !b.passages?.length) emitWorshipOpenings(mb, ring, ccw, y0, wallTop, wallCol); // (places of worship: tall arched openings, no window grid)
        if (!AR && !carPark && !b.assembly && !b.passages?.length) { const target=h>40?mb:c.detail,start={ic:target.ic,vc:target.vc}; addDetail(b,target,brng,wallCol,h,y0,shop,yShop,floorH,ccw); clipBuildingDetails(target,start,b); } // (cornices / balconies / mullions: near LOD only, except towers' silhouettes)
        for (const [holeIndex, hole] of b.holes.entries()) {
            const ccwHole = signedArea(hole) > 0;
            for (let i = 0; i < hole.length; i++) {
                const a = hole[i], p = hole[(i + 1) % hole.length], length = Math.hypot(p[0] - a[0], p[1] - a[1]);
                if (length < 0.05) continue;
                const sign = ccwHole ? -1 : 1, nx = sign * (p[1] - a[1]) / length, nz = -sign * (p[0] - a[0]) / length;
                const [columns, rows] = TILE_GRID[tile] || [1, 1];
                for(const face of clipPassageWall(a,p,surface?.holeWalls?.[holeIndex]?.[i]||[{t0:0,t1:1,y0,y1:wallTop}],b.passages||[])){
                    const lo=[a[0]+(p[0]-a[0])*face.t0,a[1]+(p[1]-a[1])*face.t0],hi=[a[0]+(p[0]-a[0])*face.t1,a[1]+(p[1]-a[1])*face.t1];
                    if (b.carParkCols) emitCarParkWall(mb, lo[0], lo[1], hi[0], hi[1], face.y0, face.y1, b.carParkCols.base, b.carParkCols.top, b.carParkCols.levels, nx, nz, b.carParkCols); else
                    mb.wall(lo[0],lo[1],hi[0],hi[1],face.y0,face.y1,nx,nz,wallCol,0,Math.max(1,Math.round(length/bayW))/columns,0,(face.y1-face.y0)/(floorH*rows),tile);
                }
            }
        }
        // (2026-11-08, owner: the Piața Floreasca service lane ran into a blank wall) where a large named building's own
        // service lane meets its wall: a dark portal (loading bay / building passage) with a concrete frame
        if ((b.flags & 64) && !b.passages?.length) edgesInBox(b.x0 - 2, b.z0 - 2, b.x1 + 2, b.z1 + 2, (e) => {
            if (e.type !== 'service' || e.virtual) return;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
                const d1x = e.b.x - e.a.x, d1z = e.b.z - e.a.z, d2x = bx - ax, d2z = bz - az, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-6) continue;
                const t = ((ax - e.a.x) * d2z - (az - e.a.z) * d2x) / den, u = ((ax - e.a.x) * d1z - (az - e.a.z) * d1x) / den;
                if (t < 0 || t > 1 || u < 0 || u > 1) continue;
                const px = e.a.x + d1x * t, pz = e.a.z + d1z * t, ux = d2x / L, uz = d2z / L;
                let nx = uz, nz = -ux; if (!ccw) { nx = -nx; nz = -nz; }
                const hw = Math.min(L / 2 - 0.3, Math.max(e.wR, e.wL) + 0.9), hp = Math.min(4.3, h - y0 - 0.8); if (hw < 1.2 || hp < 2.4) continue;
                const p0x = px - ux * hw + nx * 0.06, p0z = pz - uz * hw + nz * 0.06, p1x = px + ux * hw + nx * 0.06, p1z = pz + uz * hw + nz * 0.06;
                mb.wall(p0x, p0z, p1x, p1z, y0, y0 + hp, nx, nz, rgb('#1d1f22'));                                            // the opening
                (b.portals ||= []).push({ px, pz, hw: hw + 0.35, top: y0 + hp + 0.45 }); // (signs over it go above the lintel)
                c.solid.box(px + nx * 0.18, y0 + hp, pz + nz * 0.18, 0.35, 0.45, hw * 2 + 0.7, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75)); // lintel
                for (const sg of [-1, 1]) c.solid.box(px + ux * sg * (hw + 0.17) + nx * 0.18, y0, pz + uz * sg * (hw + 0.17) + nz * 0.18, 0.35, hp, 0.35, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75));
            }
        });
        // roof (own mesh / material: world.vegetation.roofMaterials, so weather can tint it, e.g. snow)
        const rmb = c.roof;
        const flatRoofCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.flat[Math.floor(brng() * roofCols.flat.length)]);
        const pitchCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.pitched[Math.floor(brng() * roofCols.pitched.length)]);
        const quad4 = ring.length === 4 || (ring.length === 5 && Math.hypot(ring[0][0] - ring[4][0], ring[0][1] - ring[4][1]) < 0.3);
        if (surface) for (const underside of surface.underside) {
            const { pts, tris } = triangulate(underside);
            for (const tri of tris) mb.face3(...tri.map(i => [pts[i][0], b.minH, pts[i][1]]), shadeRgb(wallCol, 0.75), [0, -1, 0]);
        }
        // (spec 10 load budget) a valid prepared roof surface is drawn from the pack; the roof mesh is then only read by the
        // collider's roofHeightAt, so it is computed on its first use there (from the same ring, holes and profile)
        const roofLazy = b.roofProfile ? lazyRoofMesh(b, ring) : null;
        const cached = b.roofProfile ? data.buildingRoofSurfaces?.[b.i] : undefined, valid = cached?.sources?.every(s => { const source = bRecs[s.i]; return source && !source.skip && roofSignatureMatch(source)(s.signature); });
        const sourceRoof = b.roofProfile ? (valid ? { heightAt: (...a) => roofLazy().heightAt(...a) } : prefetchedRoof(b, roofLazy) ?? roofLazy()) : null;
        if (sourceRoof) {
            if (cached) { if (valid) roofProfileAudit.surfacesApplied++; else roofProfileAudit.surfacesRejected.push(data.buildingIds?.[b.i] || b.i); }
            const unpack = face => data.buildingRoofGeometryPoints ? face.map(i => data.buildingRoofGeometryPoints[i]) : face;
            const visibleFaces = valid ? cached.faces.map(unpack) : sourceRoof.faces;
            for (const face of visibleFaces) rmb.face3(...face, b.roofProfile.shape === 'flat' ? flatRoofCol : pitchCol, [0, 1, 0]);
            if (valid) for (const face of cached.walls) mb.face3(...unpack(face.vertices), wallCol, face.normal);
            else for (const [i, face] of sourceRoof.walls.entries()) {
                mb.face4(...face, wallCol, sourceRoof.wallNormals[i]);
            }
            if (b.dormers === 'oval') emitOvalDormers({ ring, eavesM: b.roofProfile.eavesM, heightAt: (x, z) => sourceRoof.heightAt(x, z), cols: { wall: wallCol, slate: pitchCol, glass: rgb('#2b3036') }, // (reviewed-dormers.js, building-review row `dormers`)
                box: (x, y, z, w, hh, d, rot, col) => mb.box(x, y, z, w, hh, d, rot, col), ellipsoid: (x, y, z, rot, sx, sy, sz, col) => rmb.geo(props().sphere, x, y, z, rot, sx, sy, sz, col) });
            if (!surface && b.minH > 0) {
                const underside = triangulate(ring, b.holes);
                for (const tri of underside.tris) mb.face3(...tri.map(i => [underside.pts[i][0], b.minH, underside.pts[i][1]]), shadeRgb(wallCol, 0.75), [0, -1, 0]);
            }
        } else if (surface && b.roof === 'flat') {
            for (const roof of surface.roof) {
                const { pts, tris } = triangulate(roof);
                if (tris.length) rmb.flatPoly(pts, tris, h, flatRoofCol, 0.1, -1);
            }
        } else if (b.holes.length) {
            // Preserve the source courtyard before applying any generic roof style:
            // neither a centroid fan nor rooftop clutter may bridge its opening.
            const { pts, tris } = triangulate(ring, b.holes);
            if (tris.length) rmb.flatPoly(pts, tris, h, b.roofColour ? rgb(b.roofColour) : flatRoofCol, 0.1, -1);
        } else if (AR && !AR.roof) { /* (archetypes.js: flat roof, parapet, plant) */ } else if ((b.roof === 'hipped' || b.roof === 'skillion') && quad4 && convexRing(ring)) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const P = (p, y = h) => [p[0], y, p[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - b.c[0], cy - h + 0.01, cz - b.c[1]]; };
            const depth = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            if (b.roof === 'hipped') {
                const rise = clamp(depth * 0.32, 1.2, 5);
                const m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], m30 = [(p3[0] + p0[0]) / 2, (p3[1] + p0[1]) / 2];
                const len = Math.hypot(m12[0] - m30[0], m12[1] - m30[1]) || 1, ux = (m12[0] - m30[0]) / len, uz = (m12[1] - m30[1]) / len;
                const inset = Math.min(depth / 2, len * 0.45);
                const r1 = [m12[0] - ux * inset, h + rise, m12[1] - uz * inset], r0 = [m30[0] + ux * inset, h + rise, m30[1] + uz * inset];
                rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
                rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
                rmb.face3(P(p1), P(p2), r1, shadeRgb(pitchCol, 0.92), outOf([P(p1), P(p2), r1]));
                rmb.face3(P(p3), P(p0), r0, shadeRgb(pitchCol, 0.92), outOf([P(p3), P(p0), r0]));
            } else { // skillion: one slope rising toward p2–p3
                const rise = clamp(depth * 0.18, 0.8, 3);
                rmb.face4(P(p0), P(p1), P(p2, h + rise), P(p3, h + rise), pitchCol, [0, 1, 0]);
                const nb = [p3[0] - p0[0], 0, p3[1] - p0[1]];
                mb.face4(P(p2), P(p3), P(p3, h + rise), P(p2, h + rise), wallCol, nb); // (skillion upstand: plain)
                mb.face3(P(p1), P(p2), P(p2, h + rise), wallCol, outOf([P(p1), P(p2)]));
                mb.face3(P(p3), P(p0), P(p3, h + rise), wallCol, outOf([P(p3), P(p0)]));
            }
        } else if (b.roof === 'gabled' && ring.length === 4) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const rise = clamp(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.35, 1.2, 4.5);
            const r1 = [(p1[0] + p2[0]) / 2, h + rise, (p1[1] + p2[1]) / 2], r0 = [(p3[0] + p0[0]) / 2, h + rise, (p3[1] + p0[1]) / 2];
            const P = (p) => [p[0], h, p[1]];
            const mid = [b.c[0], h + rise * 0.5, b.c[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - mid[0], cy - mid[1] + 0.01, cz - mid[2]]; };
            rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
            rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
            mb.face3(P(p1), P(p2), r1, wallCol, outOf([P(p1), P(p2), r1])); // (gable end: plain plaster — the window tile put windows in the roof triangle)
            mb.face3(P(p3), P(p0), r0, wallCol, outOf([P(p3), P(p0), r0]));
        } else if ((pitched || b.roof === 'hipped') && ring.length <= 10 && convexRing(ring)) {
            const rise = clamp(Math.sqrt(b.area) * 0.32, 1.2, 6);
            const apex = [b.c[0], h + rise, b.c[1]];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], bb = ring[(k + 1) % ring.length];
                const pa = [a[0], h, a[1]], pb = [bb[0], h, bb[1]];
                rmb.face3(pa, pb, apex, pitchCol, [(a[0] + bb[0]) / 2 - b.c[0], 0.5, (a[1] + bb[1]) / 2 - b.c[1]]);
            }
        } else if ((pitched || b.roof === 'hipped') && insetRing(ring, b.area)) {
            // (2026-11-08, owner: "multiple roofs seem incomplete") an L / T / U footprint: the centroid fan crossed itself
            // (holes, backwards faces). A hip roof that rises from the eaves to an inset copy of the outline, flat between.
            const inner = insetRing(ring, b.area), d = inner.d, rise = d * 0.62;
            for (let q = 0; q < ring.length; q++) {
                const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner.p[q], i1 = inner.p[(q + 1) % ring.length];
                const ex = a1[0] - a0[0], ez = a1[1] - a0[1], el = Math.hypot(ex, ez) || 1, sg = signedArea(ring) > 0 ? 1 : -1;
                rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], q % 2 ? pitchCol : shadeRgb(pitchCol, 0.94), [sg * ez / el, 1.2, -sg * ex / el]);
            }
            const { pts, tris } = triangulate(inner.p);
            if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(pitchCol, 0.9), 0.1, -1);
        } else if ((pitched || b.roof === 'hipped') && !insetRing(ring, b.area)) {
            // A very short/re-entrant source edge can prevent a valid mitred
            // inset. Subdivide the footprint triangulation and lift its interior
            // by distance to the true eaves; all shared edges stay watertight.
            const { pts, tris } = triangulate(ring);
            const P = p => [p[0], h + Math.min(6, polyDist(p[0], p[1], ring) * 0.62), p[1]];
            for (const tri of tris) {
                const points = tri.map(i => pts[i]), centre = [points.reduce((s, p) => s + p[0], 0) / 3, points.reduce((s, p) => s + p[1], 0) / 3];
                for (let j = 0; j < 3; j++) {
                    const a = points[j], z = points[(j + 1) % 3], mid = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2];
                    rmb.face3(P(a), P(mid), P(centre), pitchCol, [0, 1, 0]);
                    rmb.face3(P(mid), P(z), P(centre), pitchCol, [0, 1, 0]);
                }
            }
        } else {
            const mansard = ((b.roof === 'mansard' && b.area < 6000) || (b.roof === 'flat' && !(b.flags & 16) && b.style === 'eclectic' && b.area > 120 && b.area < 2500 && h > 10)) && insetRing(ring, b.area);
            if (mansard) { // slate mansard roof: sloped ring up to an inset flat top
                const inner = mansard.p, rise = Math.min(2.6, mansard.d * 1.2), sg = signedArea(ring) > 0 ? 1 : -1;
                const slate = b.roofColour ? rgb(b.roofColour) : rgb(brng() < 0.5 ? '#4b4f57' : '#5a4a41');
                for (let q = 0; q < ring.length; q++) {
                    const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner[q], i1 = inner[(q + 1) % ring.length];
                    const ex = a1[0] - a0[0], ez = a1[1] - a0[1], len = Math.hypot(ex, ez) || 1;
                    rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], slate, [sg * ez / len, 1.2, -sg * ex / len]);
                }
                const { pts, tris } = triangulate(inner);
                if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(slate, 0.85), 0.1, -1);
            } else {
            const { pts, tris } = triangulate(ring);
            if (tris.length) rmb.flatPoly(pts, tris, h, b.style === 'glass' && !b.roofColour ? rgb('#3b4a57') : flatRoofCol, 0.1, -1);
            }
            // parapet line + rooftop clutter on large flat roofs
            if (b.area > 250 && h > 9 && b.style !== 'house') {
                const s = Math.sqrt(b.area) * 0.18;
                const x = b.c[0] + (brng() - 0.5) * s, z = b.c[1] + (brng() - 0.5) * s, w = clamp(s, 2, 7), d = clamp(s * 0.8, 2, 6), angle = brng() * 3;
                if (pointInPolygon(x, z, ring) && polyDist(x, z, ring) > Math.hypot(w, d) / 2) mb.box(x, h, z, w, 2.2, d, angle, shadeRgb(flatRoofCol, 1.15));
            }
            if (b.roof === 'dome') { const r = clamp(Math.sqrt(b.area) * 0.28, 3, 14); rmb.geo(props().sphere, b.c[0], h, b.c[1], 0, r, r * 0.9, r, rgb(b.style === 'church' ? '#7a8a8f' : '#8c9aa3')); }
        }
        if (!b.roofProfile && b.style === 'church' && b.area > 120 && !b.holes.length && worshipHasTowerTag(data.buildingSourceTags?.[data.buildingIds?.[b.derivedFrom ?? b.i]])) { // (a cupola only where the source tags a tower / dome) // a generic centroid cupola cannot span a courtyard
            const r = clamp(Math.sqrt(b.area) * 0.12, 1.5, 4);
            mb.box(b.c[0], h, b.c[1], r * 2, r * 2.4, r * 2, 0, wallCol, tile);
            mb.geo(props().sphere, b.c[0], h + r * 2.4, b.c[1], 0, r * 1.05, r * 1.4, r * 1.05, rgb('#6f8f86'));
        }
        if (!b.assembly && !b.passages?.length && h >= 5 && b.style !== 'church' && !AR && !carPark && !(b.flags & 32)) { const start={ic:c.detail.ic,vc:c.detail.vc}; addNearDetail(b,c.detail,brng,wallCol,h,y0,shop,yShop,floorH,bayW,ccw,flatRoofCol); clipBuildingDetails(c.detail,start,b); } // (flags 32: the scenery ring outside the playable area — no street-level clutter)
        // collision
        collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(([x, z]) => Math.hypot(x - b.c[0], z - b.c[1]))), poly: ring, holes: b.holes, passageSolids: b.passageSolids, sourceId: data.buildingIds?.[b.derivedFrom ?? b.i], derived: b.derivedFrom !== undefined, minH: b.minH, angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, h: sourceRoof ? b.h : h, ...(sourceRoof ? { y0: b.minH, y1: b.h, roofHeightAt: sourceRoof.heightAt } : {}), poi: b.cv || undefined });
        // facade sign
        // (2026-11-12: none on OSM building=construction — Automatica Ford, way/39348916, is a wrapped building site, its historic name is not a sign)
        // (fidelity pass: the Unirea car park was signed "Spălătorie Unirea Etaj 7") a business named for an upper floor is not the building's street sign
        if ((b.flags & 2) && b.name && (b.cvSign || b.area < 20000) && !AR?.signed && b.poiSign == null && str(data.buildingInfo?.[b.i * 5] ?? -1) !== 'construction' && !/\betaj(ul)?\s*[1-9]/i.test(b.name)) addFacadeSign(b, h, shop, wallCol);
    }
    buildPool?.flush(); // (the last clip jobs of the loop go out now; their results are spliced in below)
    // (spec 10 load budget) the clipped detail ranges are spliced in just before the map-end closure, the first pass that
    // reads those builders' contents: until then (passages, shops, trees) the builders are only appended to, and the
    // splice shifts what was appended after each range, as it did here
    {
        const sourceBodies=bRecs.filter(b=>!b.skip&&b.passages?.length),unique=new Map();
        for(const b of sourceBodies)for(const p of b.passages)unique.set(p.key,p);
        const interior=passageInterior([...unique.values()],sourceBodies.map(b=>({...b,h:b.roofProfile?.eavesM??b.h})));
        for(const w of interior.walls){const c=cellOf((w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2);c.solid.wall(...w.a,...w.b,w.y0,w.y1,...w.normal,rgb('#8e9190'));}
        for(const roof of interior.ceilings){const c0=centroid(roof.ring),c=cellOf(...c0),{pts,tris}=triangulate(roof.ring);for(const t of tris)c.solid.face3(...t.map(i=>[pts[i][0],roof.y,pts[i][1]]),rgb('#a3a5a3'),[0,-1,0]);}
    }
    // archetype facades: one mesh per 500 m super-cell, the city's facade shader on the archetype atlas (shutters follow
    // the city's shop-closing share); stats in world.group.userData.archetypes
    if (ARCH) { try { const archG = new THREE.Group(); archG.name = 'archetypes'; for (const m of ARCH.finish(solidMaterial, () => solidMat.userData.uClosed.value)) archG.add(m); group.add(archG); group.userData.archetypes = ARCH.stats; } catch (err) { console.warn('[arch] meshes failed', err); } }

    // ---- facade detail (cornices, bands, balconies, colonnades, mullions, awnings)
    function streetFacing(b, ccw) {
        const ring = b.ring, out = new Array(ring.length).fill(false);
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2 + nx * 2, mz = (az + bz) / 2 + nz * 2;
            const ne = nearestEdge(mx, mz, null, 40);
            if (ne && ne.d < 35 && ((ne.cx - mx) * nx + (ne.cz - mz) * nz) > 0) out[k] = true;
        }
        return out;
    }
    /**
     * near-LOD facade / roof geometry (own 500 m super-cell meshes, drawn within ≈ 300 m; beyond, the facade atlas alone):
     * eclectic window surrounds + pediments, pilasters, rusticated ground floor; interwar floor bands; bloc balconies with
     * mixed enclosures, AC units, satellite dishes; glass spandrel bands + podium canopies; rooftop parapets, HVAC units,
     * water tanks (RO), elevator overruns, antennas. Window positions follow the facade atlas grid (TILE_GRID).
     */
    function addNearDetail(b, db, brng, wallCol, h, y0, shop, yShop, floorH, bayW, ccw, roofCol) {
        const st = b.style, ring = b.ring, n = ring.length, pitched = b.roof !== 'flat' && b.roof !== 'dome' && b.roof !== 'mansard';
        const faces = streetFacing(b, ccw);
        const yTop = h, yFirst = shop ? yShop : y0;
        const floors = Math.max(0, Math.floor((yTop - yFirst - 0.6) / floorH));
        const trim = st === 'eclectic' || st === 'civic' ? mixRgb(wallCol, [236, 230, 218], 0.6) : shadeRgb(wallCol, 0.82), deep = shadeRgb(wallCol, 0.62);
        let perim = 0;
        for (let k = 0; k < n; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az);
            const p0 = perim; perim += L;
            if (L < 4 || !faces[k]) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const ux = (bx - ax) / L, uz = (bz - az) / L, ang = Math.atan2(ux, uz);
            const P = (s2, o) => [ax + ux * s2 + nx * o, az + uz * s2 + nz * o];
            // cheap projecting element: front face + top (+ ends when deep): 4–8 triangles instead of a 12-triangle box
            const slab = (s2, y, w, hh, d, col, ends = d > 0.3) => {
                const lo=Math.max(0,s2-w/2),hi=Math.min(L,s2+w/2);if(hi<=lo)return;
                const [x0, z0] = P(lo, d), [x1, z1] = P(hi, d), [b0x, b0z] = P(lo, 0.02), [b1x, b1z] = P(hi, 0.02);
                db.wall(x0, z0, x1, z1, y, y + hh, nx, nz, col);
                db.flatQuad(b0x, b0z, b1x, b1z, x1, z1, x0, z0, y + hh, shadeRgb(col, 1.06), 0, -1);
                if (ends) { db.wall(b0x, b0z, x0, z0, y, y + hh, -ux, -uz, shadeRgb(col, 0.9)); db.wall(x1, z1, b1x, b1z, y, y + hh, ux, uz, shadeRgb(col, 0.9)); }
            };
            // window centres along this edge: the atlas puts one window column per bay, centred at (i + 0.5) bays
            const cols = []; for (let i = Math.ceil(p0 / bayW - 0.5); (i + 0.5) * bayW - p0 < L - 0.6; i++) { const s2 = (i + 0.5) * bayW - p0; if (s2 > 0.6) cols.push(s2); }
            if (st === 'eclectic' || st === 'civic') {
                for (let f = 0; f < Math.min(floors, 5); f++) { // (surrounds on the lower five storeys: what a driver sees)
                    const yb = yFirst + f * floorH, wTop = yb + floorH * 0.8, wBot = yb + floorH * 0.2;
                    for (const s2 of cols) {
                        slab(s2, wTop, bayW * 0.56, 0.28, 0.32, trim, false);                                // lintel / cornice over the window
                        if (f === 0 && st === 'eclectic') slab(s2, wTop + 0.28, bayW * 0.4, 0.34, 0.2, shadeRgb(trim, 0.95), false); // pediment
                        slab(s2, wBot - 0.12, bayW * 0.56, 0.12, 0.24, trim, false);                           // sill
                    }
                }
                if (cols.length > 3) for (let i = 1; i < cols.length; i += 2) { // pilasters between bays
                    slab((cols[i - 1] + cols[i]) / 2, yFirst, 0.45, Math.max(0.5, yTop - 0.8 - yFirst), 0.16, trim, false);
                }
                if (!shop && y0 + 3.6 < yTop) for (let y = y0 + 0.5; y < y0 + 3.6; y += 0.55) { // rusticated ground floor
                    const [x0, z0] = P(0, 0.05), [x1, z1] = P(L, 0.05); db.wall(x0, z0, x1, z1, y, y + 0.06, nx, nz, deep);
                }
            } else if (st === 'interwar') {
                for (let f = 0; f <= floors; f++) { // continuous parapet bands under the ribbon windows
                    const y = yFirst + f * floorH + floorH * 0.12; if (y > yTop - 0.8) break;
                    const [x0, z0] = P(0, 0.25), [x1, z1] = P(L, 0.25);
                    db.wall(x0, z0, x1, z1, y - 0.35, y, nx, nz, mixRgb(wallCol, [245, 242, 236], 0.5)); db.flatQuad(ax, az, bx, bz, x1, z1, x0, z0, y, [240, 238, 232], 0, -1);
                }
                if (!b.roofProfile && brng() < 0.25 && L > 10) { const [x, z] = P(L * 0.5, 0.3); db.box(x, yTop, z, 0.06, 4, 0.06, 0, rgb('#cfcfcf')); } // flag pole
            } else if (st === 'bloc') {
                const ACC = ['#c0564a', '#4f7fa8', '#d99a3a', '#6c9a5a', '#8d6a9e', '#d7d2c4', '#3f6f78'].map(rgb);
                const accent = ACC[Math.floor(brng() * ACC.length)];
                // (play-test note 10c) balconies read as balconies: real blocks stack the same balcony type up a bay column
                // (open slab + parapet, or enclosed by the owners: glazed / clad), with one parapet colour per building;
                // AC units hang on the balcony fronts / under windows, small and white, with a dark grille
                const neutral = shadeRgb(wallCol, 0.86), encl = [rgb('#c9d0cf'), rgb('#b8b2a3'), neutral];
                const colType = cols.map(() => { const r = brng(); return r < 0.55 ? 'open' : r < 0.85 ? 'glazed' : 'clad'; });
                // (2026-11-08, Street View walk of Str. Garibaldi) the low 1950s–60s blocks of the district worlds' villa
                // quarter (≤ 5 storeys) have plain balconies: no coloured parapet accents
                const colAcc = cols.map(() => brng() < (floors <= 5 ? 0 : 0.35));
                for (let f = 1; f < Math.min(floors, 9); f++) {
                    const yb = yFirst + f * floorH;
                    for (let i = 0; i < cols.length; i++) {
                        const s2 = cols[i], r = brng();
                        if (i % 2 === 0) {
                            const t = r < 0.12 ? (colType[i] === 'open' ? 'glazed' : 'open') : colType[i]; // (a few owners differ)
                            const front = colAcc[i] ? accent : t === 'clad' ? encl[i % encl.length] : neutral;
                            if (h <= 40) { // taller blocks retain the existing far silhouette in addDetail
                                emitFacadeSlab(db, { ax, az, ux, uz, nx, nz, length:L }, s2, yb - 0.1, bayW * 0.9, 0.12, 1.1, neutral); // floor incl. soffit / side edges
                                emitFacadeSlab(db, { ax, az, ux, uz, nx, nz, length:L }, s2, yb + 0.02, bayW * 0.9, 0.95, 1.1, front, { back: 1.02, soffit: false }); // thin parapet plate
                                // Balcony guards return to the facade at both ends;
                                // capping only the thin front plate left these sides open.
                                const left=Math.max(0,s2-bayW*.45),right=Math.min(L,s2+bayW*.45);
                                if(right-left>.16)for(const end of [left+.04,right-.04]) {
                                    emitFacadeSlab(db,{ax,az,ux,uz,nx,nz,length:L},end,yb+.02,.08,.95,1.02,front,{soffit:false});
                                    if(t!=='open')emitFacadeSlab(db,{ax,az,ux,uz,nx,nz,length:L},end,yb+.97,.08,floorH-1.15,1.02,t==='glazed'?rgb('#71879a'):shadeRgb(front,.92),{soffit:false});
                                }
                                if (t === 'glazed') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.02, rgb('#71879a'));     // glazed upper part
                                else if (t === 'clad') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.04, shadeRgb(front, 0.92));
                            }
                            if (r > 0.82) { slab(s2 + bayW * 0.25, yb + 0.25, 0.75, 0.5, 1.32, rgb('#ececea')); slab(s2 + bayW * 0.25, yb + 0.33, 0.5, 0.32, 1.34, rgb('#55585c'), false); } // AC on the front
                        } else if (r < 0.1) { slab(s2, yb + 0.15, 0.75, 0.5, 0.3, rgb('#ececea')); slab(s2, yb + 0.23, 0.5, 0.32, 0.32, rgb('#55585c'), false); } // AC under a window
                        else if (r < 0.13) slab(s2, yb + floorH * 0.7, 0.55, 0.55, 0.14, rgb('#d6d6d0'), false); // dish
                    }
                }
                const [x0, z0] = P(0, 0.03), [x1, z1] = P(L, 0.03); // prefab panel joints (horizontal)
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.03; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.05, nx, nz, deep); }
            } else if (st === 'glass') {
                const sp = rgb(US ? '#3d4b57' : '#4a5965');
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let y = yFirst + floorH; y < yTop - 1; y += floorH) db.wall(x0, z0, x1, z1, y - 0.45, y + 0.25, nx, nz, sp); // spandrels
                if (h > 30) { const [c0x, c0z] = P(0, 2.2), [c1x, c1z] = P(L, 2.2); db.flatQuad(ax, az, bx, bz, c1x, c1z, c0x, c0z, y0 + 4.6, rgb('#3a3f45'), 0, -1); db.flatQuad(ax, az, c0x, c0z, c1x, c1z, bx, bz, y0 + 4.58, rgb('#2a2e33'), 0, -1); } // podium canopy
            } else if (US && (st === 'interwar' || st === 'bloc') && h < 25) { // brick low-rise: stone trim bands
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.15; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.18, nx, nz, rgb('#d8d2c4')); }
            }
        }
        // rooftop: parapet + plant (flat roofs only)
        if (!b.roofProfile && !pitched && b.area > 60) {
            const pc = shadeRgb(wallCol, 0.92);
            for (let k = 0; k < n; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; if (Math.hypot(bx - ax, bz - az) < 0.5) continue; db.wall(ax, az, bx, bz, yTop, yTop + 0.9, 0, 1, pc); db.wall(bx, bz, ax, az, yTop, yTop + 0.9, 0, 1, shadeRgb(pc, 0.8)); }
            const nUnits = Math.min(6, Math.floor(b.area / 250));
            for (let u = 0; u < nUnits; u++) {
                const x = b.c[0] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45, z = b.c[1] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45;
                if (!pointInPolygon(x, z, ring)) continue;
                // Keep the entire largest plant box on a courtyard building's roof wings.
                // A centre-only test leaves HVAC floating over an inner opening.
                if (polyDist(x, z, ring) < 2.1 || b.holes.some(hole => pointInPolygon(x, z, hole) || polyDist(x, z, hole) < 2.1)) continue;
                const r = brng();
                if (r < 0.45) db.box(x, yTop, z, 1.8, 1.2, 1.2, brng() * 3, rgb('#a9adb1'));                      // HVAC
                else if (r < 0.6 && !US && st === 'bloc') db.box(x, yTop, z, 2.2, 2.6, 2.2, 0, rgb('#8d8f8c'));   // water tank / machine room
                else if (r < 0.8) db.box(x, yTop, z, 3.2, 2.8, 2.6, brng() * 3, shadeRgb(roofCol, 1.1));          // elevator overrun
                else db.box(x, yTop, z, 0.08, 4.5, 0.08, 0, rgb('#8a8a8a'));                                         // antenna
            }
        }
    }
    function addDetail(b, mb, brng, wallCol, h, y0, shop, yShop, floorH, ccw) {
        const st = b.style;
        const ring = b.ring, n = ring.length;
        const edgeN = (k) => { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } return { ax, az, bx, bz, L, nx, nz, ux: (bx - ax) / L, uz: (bz - az) / L }; };
        let faces = null;
        if (st === 'house' || st === 'plain' || b.roof !== 'flat' && b.roof !== 'dome' || h < 6) {
            if (shop) awnings();
            return;
        }
        if (st === 'bloc' || st === 'civic' || st === 'interwar' || shop) faces = streetFacing(b, ccw);
        // projecting strip along every edge: front face + top
        const strip = (y, hh, out, col, onlyFaces = null) => {
            for (let k = 0; k < n; k++) {
                if (onlyFaces && !onlyFaces[k]) continue;
                const E = edgeN(k); if (E.L < 1) continue;
                const ox = E.nx * out, oz = E.nz * out;
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y, y + hh, E.nx, E.nz, col);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y + hh, shadeRgb(col, 1.08), 0, -1);
            }
        };
        const dark = shadeRgb(wallCol, 0.78);
        if (st !== 'glass') strip(h - 0.75, 0.75, st === 'eclectic' ? 0.5 : 0.32, dark); // cornice
        if (st === 'interwar') { for (let y = y0 + (shop ? 4.2 : floorH * 2); y < h - 3; y += floorH * 2) strip(y, 0.22, 0.14, dark, faces); }
        if (st === 'eclectic' && h > 8) strip(y0 + 4.4, 0.35, 0.22, dark);
        if (st === 'civic') { // colonnade under a projecting slab on street fronts
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                const off = 1.6;
                for (let s2 = 2; s2 < E.L - 1.5; s2 += 4) mb.box(E.ax + E.ux * s2 + E.nx * off, y0, E.az + E.uz * s2 + E.nz * off, 0.8, 6, 0.8, Math.atan2(E.ux, E.uz), shadeRgb(wallCol, 1.04));
                const ox = E.nx * (off + 0.6), oz = E.nz * (off + 0.6);
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y0 + 6, y0 + 6.6, E.nx, E.nz, dark);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y0 + 6.6, dark, 0, -1);
            }
        }
        if (st === 'bloc' && (h > 40 || (b.flags & 32))) { // distant silhouettes; lower buildings get one complete set in addNearDetail
            const floors = Math.min(12, Math.floor((h - y0) / floorH));
            const bc = shadeRgb(wallCol, 0.86);
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                for (let f = (shop ? 2 : 1); f < floors; f++) {
                    const y = y0 + f * floorH;
                    for (let s2 = 1.2; s2 + 2.8 < E.L - 0.8; s2 += 6.2) {
                        emitFacadeSlab(mb, E, s2 + 1.4, y - 0.12, 2.8, 0.12, 0.95, bc);
                        emitFacadeSlab(mb, E, s2 + 1.4, y, 2.8, 1.0, 0.95, bc, { back: 0.87, soffit: false });
                    }
                }
            }
        }
        if (st === 'glass') { // vertical mullions + roof crown
            const fin = shadeRgb(wallCol, 0.55);
            for (let k = 0; k < n; k++) {
                const E = edgeN(k); if (E.L < 3) continue;
                for (let s2 = 1.5; s2 < E.L - 0.5; s2 += 3) {
                    const x = E.ax + E.ux * s2 + E.nx * 0.12, z = E.az + E.uz * s2 + E.nz * 0.12;
                    mb.wall(x - E.ux * 0.14, z - E.uz * 0.14, x + E.ux * 0.14, z + E.uz * 0.14, y0, h, E.nx, E.nz, fin);
                }
            }
            strip(h - 0.2, b.roofProfile ? 0.2 : 1.2, 0.05, rgb('#2b3a48'));
        }
        if (shop) awnings();
        function awnings() {
            if (!shop) return;
            const fc = faces || streetFacing(b, ccw);
            // (2026-11-08, Street View walk of Calea Floreasca) district worlds: most small shops in the old houses / blocks
            // have no awning — one front in three gets one, deterministic per building
            if (((b.i * 2654435761) >>> 0) % 3 !== 0) return;
            for (let k = 0; k < ring.length; k++) {
                if (!fc[k]) continue;
                const E = edgeN(k); if (E.L < 5) continue;
                const col = AWNING[(b.i + k) % AWNING.length];
                for (let s2 = 0.8; s2 + 3.6 < E.L - 0.5; s2 += 5.4) {
                    const x0 = E.ax + E.ux * s2, z0 = E.az + E.uz * s2, x1 = x0 + E.ux * 3.6, z1 = z0 + E.uz * 3.6;
                    // (2026-11-08, owner: an awning across the "Implant Dent" fascia) the awning hangs under the fascia band
                    // (signs take the top ≈ 0.9 m of the shop storey), never in front of it
                    const yt = yShop - 1.0, yb = yt - 0.6, ox = E.nx * 1.2, oz = E.nz * 1.2; if (yb - y0 < 2.3) return;
                    mb.face4([x0, yt, z0], [x1, yt, z1], [x1 + ox, yb, z1 + oz], [x0 + ox, yb, z0 + oz], col, [E.nx, 1, E.nz]);
                    mb.face4([x0, yt - 0.02, z0], [x1, yt - 0.02, z1], [x1 + ox, yb - 0.02, z1 + oz], [x0 + ox, yb - 0.02, z0 + oz], shadeRgb(col, 0.6), [0, -1, 0]);
                }
            }
        }
    }

    /** (play-test note 10a) a business inside a building: its own ground-floor fascia (brand colours + name) over its
     *  unit, on the street wall nearest to the mapped point, + a projecting blade sign; lit at night with the signs */
    let unitSigns = 0, vacantUnits = 0;
    // (2026-11-12 render review) a fascia name never ends mid-word ("Mosto - Natural Wine Bar & Bistró" read "…& Bistr"):
    // a long name keeps its lead part before a " - " / " | " / ", " qualifier, else it is shortened at a word boundary
    // (a dangling "&" / "and" / "și" / "-" dropped)
    const fasciaText = (t, max = 32) => {
        t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= max) return t;
        const lead = t.split(/\s+[-–—|]\s+|,\s+/)[0].trim(); if (lead.length >= 3 && lead.length <= max) return lead;
        const words = t.split(' '); let out = '';
        for (const w of words) { if ((out ? out.length + 1 : 0) + w.length > max) break; out = out ? out + ' ' + w : w; }
        out = out.replace(/(\s+(&|and|si|și|de|la|du|des|of|the|[-–—|,]))+$/i, '').trim();
        return out || t.slice(0, max);
    };
    const normName = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    // (r2) pedestrian streets / footways from OSM (pedestrian-fronts.js): a business front on one is a street front too
    let pedGrid = null;
    const pedStreetNear = (x, z, maxR) => {
        if (!pedGrid) { pedGrid = new BoxGrid(32); for (const [, , pts] of PEDESTRIAN_FRONTS[city.id + '-' + distId] || []) { const P = pts.map(([la, lo]) => { const q = city.proj(la, lo); return [q.x, q.z]; }); for (let i = 0; i + 1 < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; pedGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]); } } }
        let best = null; pedGrid.each(x - maxR, z - maxR, x + maxR, z + maxR, ([ax, az, bx, bz]) => { const d = distPointSeg(x, z, ax, az, bx, bz).d; if (d <= maxR && (!best || d < best.d)) best = { d, pedestrian: true }; });
        return best;
    };
    // (r2, Pipera Kaufland w1198250017) a large store mapped as one point deep inside its footprint says nothing about which
    // side carries the sign: there the face with the store's own OSM car park in front of it is the entrance front
    const parkFront = (px, pz, nx, nz) => { let n = 0; for (const dd of [8, 20]) { const qx = px + nx * dd, qz = pz + nz * dd; if (areas.some(a => a.kind === 'parking' && qx >= a.x0 && qx <= a.x1 && qz >= a.z0 && qz <= a.z1 && pointInPolygon(qx, qz, a.rings[0]))) n++; } return n; };
    // (round 3 review, Romană Cărturești / F.M. Medident / Xerox: boards 15–25 m from their OSM entrance node) an anchored
    // sign (data.poiSignAnchors: an entrance node on the outline, or a point on the address-street face) takes the facade
    // span nearest to the anchor: the whole-store / central-store face heuristics and the street-distance term (which
    // let a primary-street face win) do not apply, and the anchor's own edge counts as a front even without a street
    // within reach of the normal test (it still may not face an adjoining building)
    function addUnitSign(b, x, z, text, kind, poiIndex = -1, anchored = false) {
        if ((b.skip && !b.landmarkUnitSigns) || b.cv || (b.minH || 0) > 0.5 || b.h < 3) return;
        // (r3-look-6, Parcare Unirea w184169515: "Spălătorie Unirea Etaj 7" drew two stacked boards at street level) a business
        // named for an upper floor has no street-level fascia; the building sign names the building
        if (/\betaj(ul)?\s*[1-9]/i.test(text || '')) return;
        // (2026-11-08, owner: "Poke House duplicated") the building's own name sign already names this business
        // (2026-11-12: unless this POI owns that sign — b.poiSign — and places it here, over its own street front)
        if ((b.flags & 2) && b.name && !(poiIndex >= 0 && b.poiSign === poiIndex)) { const a = normName(b.name), c2 = normName(text); if (a && c2 && (a.includes(c2) || c2.includes(a) || a.split(' ')[0] === c2.split(' ')[0])) return; }
        const ring = b.ring, ccw = signedArea(ring) > 0;
        const central = !anchored && kind === 'shop' && Math.abs(signedArea(ring)) >= 1500 && ring.every((p, k) => { const q = ring[(k + 1) % ring.length]; return distPointSeg(x, z, p[0], p[1], q[0], q[1]).d >= 10; });
        // (2026-11-12 render review, Romstal Otopeni w219767593) a store that IS the whole mapped building (its name is the
        // building's) is mapped at the centroid, which says nothing about its front: the board went on the blank wall facing
        // a lawn. Such a store signs the face toward the most important street (and its own car park), not the nearest wall.
        const wholeStore = !anchored && kind === 'shop' && !!b.name && normName(b.name) === normName(text) && Math.abs(signedArea(ring)) >= 400;
        const streetRank = (e) => !e ? 0 : /^(trunk|primary)/.test(e.type) ? 30 : /^secondary/.test(e.type) ? 20 : /^tertiary/.test(e.type) ? 10 : e.type === 'service' ? -8 : 0;
        let best = null, bd = Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1), px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
            const ne = nearestEdge(px + nx * 4, pz + nz * 4, (e) => !e.virtual && e.drivable, 30) || ((b.flags & 32) ? sceneryStreetNear(px + nx * 4, pz + nz * 4, 30) : null) || pedStreetNear(px + nx * 3, pz + nz * 3, 9);
            const own = anchored && Math.hypot(px - x, pz - z) < 1.5; // (the anchor's own edge)
            // (an entrance node is often a vertex: test the ground in front of the span beside it, not at the corner, where a
            // neighbour touching that corner read as "a building in front" — Romană Xerox)
            const tq = anchored ? clamp(t * L, Math.min(1.2, L / 2), Math.max(L / 2, L - 1.2)) / L : t, fx = ax + (bx - ax) * tq + nx * 1.5, fz = az + (bz - az) * tq + nz * 1.5;
            if ((!ne && !own) || buildingAt(fx, fz)) continue; // (a street front; scenery-ring buildings: a scenery street; r2: a mapped pedestrian street)
            const pf = (central || wholeStore) && L >= 12 ? parkFront(ax + (bx - ax) * .5, az + (bz - az) * .5, nx, nz) : 0;
            const d = anchored ? Math.hypot(px - x, pz - z)
                : wholeStore ? Math.hypot(px - x, pz - z) * 0.2 + ne.d * 0.5 - streetRank(ne.edge) - 30 * pf + (L < 8 ? 20 : 0)
                : Math.hypot(px - x, pz - z) + ne.d * 0.3 - (central && L >= 12 ? 60 * pf : 0);
            if (d < bd) { bd = d; best = { ax, az, bx, bz, L, nx, nz, t: (central || wholeStore) && L >= 12 && (pf || wholeStore) ? .5 : t }; }
        }
        if (!best) return;
        const bs = (kind === 'vacant' ? ['#f2f2ef', '#b91c1c', null] : null) || brandStyle(text) || (kind === 'pharmacy' ? ['#15803d', '#ffffff', null] : kind === 'bank' ? ['#1e3a8a', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(fasciaText((bs[3] || text).replace(/\s*\([^)]*\)/g, '').trim() || text), bs[0], bs[1], bs[2], false, true); if (!s) return; // (data.brands[k][3] = logo text; 32: "Trattoria Il Calcio Floreasca", "Mega Image Maison des Chefs" were cut mid-word at 24; a long name sets on two lines to stay readable)
        const { ax, az, bx, bz, L, nx, nz } = best, tx = (bx - ax) / L, tz = (bz - az) / L;
        let w = Math.min(6.5, L - 0.8), hh = Math.min(0.7, w / s.aspect); w = Math.min(w, hh * s.aspect);
        const shop = (b.flags & 1) && b.h > 6, proud = shop ? 0.14 : 0.36; // (r2-builder) no shopfront band: the board stands proud of the window surrounds (0.32 m), which cut through the name
        let tc = clamp(best.t * L, w / 2 + 0.4, L - w / 2 - 0.4), mx = ax + tx * tc + nx * proud, mz = az + tz * tc + nz * proud;
        let y = b.signY != null ? b.signY - hh / 2 : shop ? (b.gfh || 4.2) - hh - 0.1 : Math.min(3.0, b.h - hh - 0.3); // (archetypes: their fascia height)
        // (round 3 review, Floreasca Farmacia Dona at the Piața Floreasca car-park passage; panorama NWuTtHcsu_MBJEKTpucUsA @1
        // shows the unit and its board beside the portal) a unit board that would sit over a building passage on its own
        // wall slides along the wall to the portal's side nearer to the business, when the wall has room there; only
        // otherwise is it lifted over the portal (clearPortal)
        let slid = null;
        { // a carriageway entering the wall under the board (a car-park ramp / passage drawn as a road, not a facade portal)
            const hit = (u) => onRibbon(ax + tx * u + nx * 0.6, az + tz * u + nz * 0.6, 0) && onRibbon(ax + tx * u - nx * 1.0, az + tz * u - nz * 1.0, 0), over = (c) => { for (let u = c - w / 2; u <= c + w / 2 + 1e-6; u += 0.5) if (hit(u)) return true; return false; };
            if (over(tc)) { const lo = w / 2 + 0.4, hi = L - w / 2 - 0.4, pref = best.t * L >= tc ? 1 : -1; let to = null;
                for (let d = 0.5; d <= Math.max(6, w + 2) && to === null; d += 0.5) for (const sg of [pref, -pref]) { const c = tc + sg * d; if (c >= lo && c <= hi && !over(c)) { to = c; break; } }
                if (to !== null) { slid = { reason: 'carriageway-into-wall', fromM: +tc.toFixed(2), toM: +to.toFixed(2) }; tc = to; mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud; } }
        }
        for (const pt of b.portals || []) {
            const ps = (pt.px - ax) * tx + (pt.pz - az) * tz, off = Math.abs((pt.px - ax) * nx + (pt.pz - az) * nz); if (off > 1.5 || y >= pt.top + 0.1) continue;
            if (Math.abs(ps - tc) >= w / 2 + pt.hw + 0.3) continue;
            const right = ps + pt.hw + 0.3 + w / 2, left = ps - pt.hw - 0.3 - w / 2, okR = right <= L - w / 2 - 0.4, okL = left >= w / 2 + 0.4, pref = best.t * L >= ps;
            const from = tc; if (okR && (pref || !okL)) tc = right; else if (okL) tc = left; if (tc !== from) slid = { reason: 'portal', fromM: +from.toFixed(2), toM: +tc.toFixed(2) };
            mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud;
        }
        y = clearPortal(b, mx, mz, w, y);
        const fitted = fitFacadeSign(best, { centre: tc, width: w, minWidth: Math.min(w, s.aspect * 0.3), y0: y - 0.1, y1: y + hh + 0.1 }, facadeBoards);
        if (!fitted) { fasciaLayoutAudit.push({ text, building: b.i, status: 'no-clear-inferred-fascia-span', x, z }); return; }
        const original = { x: mx, z: mz, width: w };
        tc = fitted.centre; w = fitted.width; hh = Math.min(hh, w / s.aspect);
        mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud;
        fasciaLayoutAudit.push({ text, building: b.i, status: 'placed', original, x: mx, z: mz, width: w, height: hh, y, ...(slid ? { slid } : {}), ...(anchored ? { anchored: true } : {}) });
        facadeBoards.push(facadeSignBoard(mx, mz, tx, tz, w + 0.5, y - 0.1, y + hh + 0.1, text));
        const cc = cellOf(mx, mz), white = [255, 255, 255], mbS = signMB(cc, s.page);
        const lx = mx - tx * w / 2, lz = mz - tz * w / 2, rx = mx + tx * w / 2, rz = mz + tz * w / 2;
        // viewer outside looks along -n; their right-hand vector is (nz, -nx) = +t when the ring is ccw-out
        const [Lx, Lz, Rx, Rz] = (nz * tx - nx * tz) > 0 ? [lx, lz, rx, rz] : [rx, rz, lx, lz];
        const i0 = mbS.v(Lx, y, Lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(Rx, y, Rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(Rx, y + hh, Rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(Lx, y + hh, Lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
        cc.solid.box(mx - nx * (shop ? 0.07 : 0.17), y - 0.1, mz - nz * (shop ? 0.07 : 0.17), shop ? 0.1 : 0.32, hh + 0.2, w + 0.5, Math.atan2(tx, tz), rgb(bs[0])); // fascia board
        if (tc + w / 2 + 1.3 < L && (b.flags & 1)) { // projecting blade sign (both faces), on a bracket — shopfronts only (owner: a stray plate on a blank wall)
            // (2026-11-12 render review, BRD by ING at Grozăvești: the blade hung below a separate bracket box, 0.5 m out with
            // one face, and read as a detached plate at an angle) the blade now stands 0.12 m off the wall, faces both ways
            // and hangs from a flat arm along its top edge that runs from the wall; the arm is two quads, not a 12-triangle box
            const cross = kind === 'pharmacy' ? signs.get('✚', '#15803d', '#ffffff', null, true) : null; // (category style: green cross)
            const bw = cross ? 0.8 : 1.1, bh = cross ? 0.8 : Math.max(0.28, 1.1 / s.aspect), by = y + hh + 0.4, off = 0.12 + bw / 2;
            const wx = mx - nx * proud + tx * (w / 2 + 0.7), wz = mz - nz * proud + tz * (w / 2 + 0.7), ex = wx + nx * off, ez = wz + nz * off;
            const ay0 = by + bh / 2 + 0.01, ay1 = ay0 + 0.05, out = 0.12 + bw + 0.06, arm = rgb('#2b2b2b');
            const A = (o, yy) => [wx + nx * o, yy, wz + nz * o];
            cc.solid.face4(A(0, ay0), A(out, ay0), A(out, ay1), A(0, ay1), arm, [tx, 0, tz]); cc.solid.face4(A(out, ay0), A(0, ay0), A(0, ay1), A(out, ay1), arm, [-tx, 0, -tz]);
            for (const sd of [1, -1]) addSignQuad(cc, ex, ez, Math.atan2(tx, tz), sd, bw, bh, by, cross || s, 0.012);
        }
        signedSpots.push([mx, mz, y]); unitSigns++;
    }
    const signedSpots = [];
    /** (2026-11-08, owner: "still broken sign there") a sign whose span [mx ± w/2] crosses a service portal of its building
     *  sits above the portal's lintel instead of behind it */
    function clearPortal(b, mx, mz, w, y) {
        for (const pt of b.portals || []) if (Math.hypot(pt.px - mx, pt.pz - mz) < w / 2 + pt.hw + 0.3 && y < pt.top + 0.1) y = pt.top + 0.15;
        return y;
    }
    function addFacadeSign(b, h, shop, wallCol) {
        // a hotel's own sign faces its address street (OSM addr:street) when that street is beside it, not a service lane behind it
        const addressEdge = b.signStreet ? nearestEdge(b.c[0], b.c[1], (e) => e.name === b.signStreet, 120) : null;
        const ne = addressEdge && addressEdge.d <= 90 ? addressEdge : nearestEdge(b.c[0], b.c[1]);
        if (!ne || ne.d > 90) return;
        // wall whose outward normal faces the road and is closest to it
        const ring = b.ring; const ccw = signedArea(ring) > 0;
        let best = -1, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2;
            const tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const score = (tx * nx + tz * nz) / tl * 2 - tl / 40 + Math.min(L, 12) / 12;
            if (score > bs) { bs = score; best = k; }
        }
        if (best < 0) return;
        const [ax, az] = ring[best], [bx, bz] = ring[(best + 1) % ring.length];
        const L = Math.hypot(bx - ax, bz - az);
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
        const brand = brandStyle(b.name);
        const cvp = b.cv;
        const st = cvp ? ['#111827', '#ffffff', cvp._color || '#f97316'] : brand || (b.flags & 8 ? ['#b91c1c', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(b.name, st[0], st[1], st[2]);
        if (!s) return;
        let w = Math.min(L * 0.8, cvp ? 18 : (b.flags & 8 ? 7 : 9)); let hh = w / s.aspect;
        // (play-test note 10a) businesses sign at ground floor: a fascia over the shop window (≤ 0.75 m high) or a board
        // over the door — never a box on an upper floor; only the CV buildings keep their big sign higher up
        const hMax = cvp ? 2.4 : shop ? 0.72 : 0.85;
        if (hh > hMax) { hh = hMax; w = hh * s.aspect; } if (w > L * 0.9) { w = L * 0.9; hh = w / s.aspect; }
        const y0b = b.minH || 0;
        let y = cvp ? Math.max(4, Math.min(h - hh - 1.5, 14)) : b.signY != null ? b.signY - hh / 2 : shop ? y0b + (b.gfh || 4.2) - hh - 0.08 : y0b + Math.min(3.0, Math.max(2.4, h - hh - 0.4));
        if (y < 1) y = 1;
        const mx = (ax + bx) / 2 + nx * 0.12, mz = (az + bz) / 2 + nz * 0.12;
        if (!cvp) y = clearPortal(b, mx, mz, w, y);
        // viewer outside looks along -n; their right-hand vector is (nz, -nx)
        const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
        const mbS = signMB(cellOf(b.c[0], b.c[1]), s.page);
        const white = [255, 255, 255];
        const i0 = mbS.v(lx, y, lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(rx, y, rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(rx, y + hh, rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(lx, y + hh, lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3); // (i0,i1,i2) normal = n by construction
        if (!cvp) { // fascia board in the brand colour behind the letters + a projecting (blade) sign at the end of the front
            const sb = cellOf(b.c[0], b.c[1]).solid, bg = rgb(st[0]), pad = 0.12, tx = -nz, tz = nx; // tx/tz: along the wall
            const cx0 = (ax + bx) / 2 + nx * 0.06, cz0 = (az + bz) / 2 + nz * 0.06, bw2 = Math.min(L * 0.96, w + 0.8);
            sb.box(cx0, y - pad, cz0, 0.1, hh + pad * 2, bw2, Math.atan2(tx, tz), bg);
            facadeBoards.push(facadeSignBoard(cx0, cz0, tx, tz, bw2, y - pad, y + hh + pad, b.name));
            if (L > bw2 + 2 && shop) { // (2026-11-08, owner: "still broken signs") shopfronts only, and the bracket only with its blade
                const ex = (ax + bx) / 2 + tx * (bw2 / 2 + 0.6) + nx * 0.55, ez = (az + bz) / 2 + tz * (bw2 / 2 + 0.6) + nz * 0.55;
                const bh = 0.75, by = y + hh + 0.35;
                const bladeS = signs.get(b.name.slice(0, 14), st[0], st[1], st[2]);
                if (bladeS) { sb.box(ex - nx * 0.45, by + bh / 2 - 0.03, ez - nz * 0.45, 0.04, 0.04, 1.0, Math.atan2(nx, nz), rgb('#2b2b2b')); addSignQuad(cellOf(b.c[0], b.c[1]), ex, ez, Math.atan2(tx, tz), 1, 0.8, Math.min(0.8, 0.8 / bladeS.aspect * 1.6), by, bladeS, 0.06); }
            }
        }
        if (cvp) { // coloured band at the top of the CV building
            const mb = cellOf(b.c[0], b.c[1]).solid;
            const col = rgb(cvp._color || '#f97316');
            for (let k = 0; k < ring.length; k++) {
                const [px, pz] = ring[k], [qx, qz] = ring[(k + 1) % ring.length]; const LL = Math.hypot(qx - px, qz - pz); if (LL < 0.05) continue;
                let ox = (qz - pz) / LL, oz = -(qx - px) / LL; if (!ccw) { ox = -ox; oz = -oz; }
                mb.wall(px + ox * 0.08, pz + oz * 0.08, qx + ox * 0.08, qz + oz * 0.08, h - 1.0, h + 0.4, ox, oz, col);
            }
        }
    }
    // (world roof ads and fuel: world-roofads-fuel.js)
    const {
        P, fuelForecourts, fuelLog, roofAdList, roofAds, transitShelterAudit,
    } = await buildRoofAdsFuel({
        US, addPropColl, addSignQuad, addUnitSign, bGrid, bRecs, buildingAt, buildingIndex,
        cellOf, city, data, distId, edgeGrid, inDistrictLL, liftOnSide, nearestEdge,
        obbPoly, onRibbon, pois, polyDist, polyOnRibbon, propColl, raisedTop, sceneryStopEdge,
        signs, stopMarginM, str, surfacesAt, tramSweep, treeClear,
    });
    // vacant shop units (data.vacant, world-data Request): a plain 'DE ÎNCHIRIAT' / 'FOR LEASE' board over the unit
    { const V = data.vacant || []; let vac = 0;
      for (let i = 0; i + 2 < V.length; i += 3) { const bi = buildingIndex(V[i + 2], V[i] / 10, V[i + 1] / 10); if (bi >= 0 && bRecs[bi]) { addUnitSign(bRecs[bi], V[i] / 10, V[i + 1] / 10, US ? 'FOR LEASE' : 'DE ÎNCHIRIAT', 'vacant'); vac++; } }
      vacantUnits = vac; }
    /** a double/single sided sign quad at (x,z) rotated `ang` (local +z = facing), centre height y */
    function addSignQuad(c, x, z, ang, sd, w, h, y, s, thick = 0.1) {
        const fx = Math.sin(ang) * sd, fz = Math.cos(ang) * sd; // facing direction
        const cx = x + fx * thick, cz = z + fz * thick;
        const mbS = signMB(c, s.page), W = [255, 255, 255];
        // viewer in front looks along -f; their right-hand vector is (fz, -fx)
        const Lx = cx - fz * w / 2, Lz = cz + fx * w / 2, Rx = cx + fz * w / 2, Rz = cz - fx * w / 2;
        const y0 = y - h / 2, y1 = y + h / 2;
        const i0 = mbS.v(Lx, y0, Lz, fx, 0, fz, s.u0, s.v0, W), i1 = mbS.v(Rx, y0, Rz, fx, 0, fz, s.u1, s.v0, W);
        const i2 = mbS.v(Rx, y1, Rz, fx, 0, fz, s.u1, s.v1, W), i3 = mbS.v(Lx, y1, Lz, fx, 0, fz, s.u0, s.v1, W);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
    }

    // -----------------------------------------------------------------------
    //  TREES, LAMPS, PARKED CARS
    // -----------------------------------------------------------------------
    setProgress('Planting trees…'); await tick();
    // every tree / lamp / prop below is checked against the carriageway ribbons (onRibbon) before it is placed
    const maxTrees = city.id === 'bucharest' ? 32000 : 28000;
    const treeList = [], treeBodies = new WeakMap(), treeSourceMetadata = new WeakMap();
    // (world trees and lamps: world-trees-lamps.js)
    const {
        __buildStreetFurniture, basarabLamps, channelM, closures, deckLamps, elevatedDataset, elevatedPlan, furnCount,
        lampGrid, lampNear, lamps, lampsMoved, treeAdditions, treeBuildingClearance, treeCount, treeDeckClearance,
        treeNear, treesOSM, treesRows, vegetation, waterTreeConflicts,
    } = await buildTreesLamps({
        US, addPropColl, areas, bGrid, basarabStructure, buildingAt, cellOf, channelAreas,
        city, clearOf, data, distId, edges, finishPendingRanges, inArea, isWater,
        kerbSpot, lampSpots, landmarkWaterFootprints, liftOnSide, lmGrounds, maxTrees, medianFill, nearWater,
        nearestEdge, onRibbon, pierColl, polyDist, propColl, raisedTop, ribGrid, rng,
        sceneryDeckGrid, str, surfacesAt, sweptOut, tramGrades, tramPropEnvelope, tramSweep, tramSweepConflicts,
        treeBodies, treeClear, treeList, treeSourceMetadata, treeSpots, walls, yAlong,
    });
    if (mapEnds.length) {
        const P = props();
        const coneG = P._cone || (P._cone = mergeProps([bakeProp(new THREE.ConeGeometry(0.18, 0.7, 8), { y: 0.35, color: '#ff6a13' }), bakeProp(new THREE.CylinderGeometry(0.115, 0.13, 0.12, 8), { y: 0.42, color: '#f4f4f4' }), bakeProp(new THREE.BoxGeometry(0.42, 0.04, 0.42), { y: 0.02, color: '#222222' })]));
        const drumG = P._drum || (P._drum = mergeProps([0, 1, 2, 3].map(i => bakeProp(new THREE.CylinderGeometry(0.29, 0.3, 0.24, 10), { y: 0.12 + i * 0.24, color: i % 2 ? '#f4f4f4' : '#ff6a13' })).concat([bakeProp(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), { y: 0.03, color: '#222222' })])));
        const jerseyG = P._jersey || (P._jersey = mergeProps([bakeProp(new THREE.BoxGeometry(0.6, 0.35, 2.0), { y: 0.17, color: '#c9c6bd' }), bakeProp(new THREE.BoxGeometry(0.3, 0.5, 2.0), { y: 0.6, color: '#d3d0c8' })]));
        const red = rgb('#c62828'), whiteB = rgb('#f2f2f2'), orange = rgb('#ff6a13'), postCol = rgb('#6b6b6b'), yellowM = rgb('#f2b705'), dark = rgb('#222428');
        const others = Object.entries(city.districts || {}).filter(([id]) => id !== distId).map(([id, d]) => { const q = city.proj(d.center.lat, d.center.lon); return { id, x: q.x, z: q.z }; });
        const post = (c, x, z, y, h) => c.solid.box(x, y, z, 0.08, h, 0.08, 0, postCol);
        const sign = (c, x, z, y, ang, text, bg, fg, accent, w = 1.6) => { const sg = signs.get(text, bg, fg, accent, true); if (!sg) return; post(c, x, z, y, 1.4 + 0.25); addSignQuad(c, x, z, ang, 1, w, w / sg.aspect * 1.0, y + 1.4 + w / sg.aspect / 2, sg, 0.05); };
        // (spec 10 load budget) every builder of every cell, in this order, made again only when a builder was added
        let cbList = null, cbIndex = null, cbEpoch = -1;
        const closureBuilders = () => { if (cbEpoch !== builderEpoch) { cbList = [...cells.values()].flatMap(c => [...Object.values(c), ...(c.signs || [])]).filter(mb => mb && typeof mb.ic === 'number' && typeof mb.v === 'function'); cbIndex = new Map(cbList.map((mb, k) => [mb, k])); cbEpoch = builderEpoch; } return cbList; };
        mapEnds.forEach((m, k) => {
            const { ix, iz, px, pz, y, kind, edge: e } = m, c = cellOf(m.x, m.z), ang = Math.atan2(px, pz), face = Math.atan2(ix, iz); // signs face the driver coming toward the edge
            // each builder's index count now, by its place in the list as it is now (as wholePrimitive below; a Map of every
            // builder per map end cost more than the closure): one made since starts from 0
            const startList = closureBuilders(), startIndex = cbIndex, startIc = new Int32Array(startList.length), sourceScene = true;
            for (let k = 0; k < startList.length; k++) startIc[k] = startList[k].ic;
            const clipOptions = { ownerEdges: m.ownerEdges, floorY: y };
            const discrete = (mb, emit, x, z, radius, collidable = true) => {
                const vi = mb.vc, ii = mb.ic; emit();
                let lower = Infinity, upper = -Infinity;
                for (let i = ii; i < mb.ic; i++) { const yy = mb.p[mb.i[i] * 3 + 1]; lower = Math.min(lower, yy); upper = Math.max(upper, yy); }
                const clear = boundarySupport.clearMeshRange(mb, ii, clipOptions) &&
                    boundarySupport.clearCircle(x, z, radius, { ownerEdges: m.ownerEdges, y0: lower - .3, y1: upper });
                if (!clear) { mb.vc = vi; mb.ic = ii; boundarySupport.report.rejectedDiscreteProps++; return false; }
                if (collidable) {
                    if (!sourceScene) addPropColl(x, z, radius, 'closure');
                    else propColl.push({ x, z, r: radius, hw: radius, hd: radius, angle: 0, poly: null, prop: true, kind: 'closure',
                        y: lower, top: upper, h: upper - lower, y0: lower - .3, y1: upper, normalizedSourceBoundary: true });
                }
                return true;
            };
            // A readable sign and its post are one discrete object. Clipping
            // its glyph quad into pieces can leave misleading partial words.
            const wholePrimitive = emit => {
                // (each builder's counts before, by its place in the list as it was then; one made since counts from 0)
                const list0 = closureBuilders(), index0 = cbIndex, vcs = new Int32Array(list0.length), ics = new Int32Array(list0.length);
                for (let k = 0; k < list0.length; k++) { vcs[k] = list0[k].vc; ics[k] = list0[k].ic; }
                const before = mb => { const k = index0.get(mb); return k === undefined ? null : k; };
                emit();
                const touched = closureBuilders().filter(mb => { const k = before(mb); return mb.ic > (k === null ? 0 : ics[k] || 0); });
                if (touched.every(mb => { const k = before(mb); return boundarySupport.clearMeshRange(mb, k === null ? 0 : ics[k] || 0, clipOptions); })) return true;
                for (const mb of touched) { const k = before(mb); mb.vc = k === null ? 0 : vcs[k] || 0; mb.ic = k === null ? 0 : ics[k] || 0; }
                boundarySupport.report.rejectedDiscreteProps++; return false;
            };
            const closureSign = (...args) => wholePrimitive(() => sign(...args));
            // (R24) an end inside a lidded tunnel (a garage aisle cut by the district edge) keeps its stop wall and turn-around
            // prompt; it ends at the tunnel's concrete end wall, without street roadworks, signs or a crew
            if (e.lidded) { closures.push({ x: m.x, z: m.z, y, top: y + m.barrierHeight, heading: m.heading, edge: e, node: m.node, kind, leadsTo: null,
                l0: m.l0, l1: m.l1, half: m.half, bundleId: m.bundleId, bundlePrimary: m.bundlePrimary, worker: false, underground: true }); return; }
            // Immutable spans are shared by the physical wall and every visible
            // barrier; source scenery supplies the real continuation beyond it.
            const half = (m.l1 - m.l0) / 2, lc = (m.l0 + m.l1) / 2;
            const at = (d, l) => [m.x + ix * d + px * (lc + l), m.z + iz * d + pz * (lc + l)];
            // the road visibly continues past the closure (note 6): a dug-up roadworks strip, then plain asphalt with kerbs and a
            // dashed centre line running out of the district (≈ 400 m, until it would re-enter the map) into the backdrop city
            if (!sourceScene && m.bundlePrimary) { const asp = rgb(ASPHALT), kerbC = rgb('#a7a39b'), dug = rgb('#6b5a48'), dash = rgb('#d9d9d4'), wS = Math.max(1.5, m.edge.sidewalk || 2);
              const strip = (d0, d1, l0, l1, col, yy) => { const [ax, az] = at(-d0, l0), [bx, bz] = at(-d1, l0), [cx2, cz2] = at(-d1, l1), [dx, dz] = at(-d0, l1); cellOf((ax + cx2) / 2, (az + cz2) / 2).solid.face4([ax, yy, az], [bx, yy, bz], [cx2, yy, cz2], [dx, yy, dz], col, [0, 1, 0]); };
              let dEnd = 0;
              const dMax = (data.scenery || []).length ? 30 : 400; // (district scenery streets carry the real road on beyond the dug strip)
              let outS = false; for (let d = 2; d < dMax; d += 10) { const [qx, qz] = at(-(d + 10), 0), ins = dmask && dmask.at(qx, qz); if (!ins) outS = true; if ((ins && (outS || d > 60)) || buildingAt(qx, qz) || isWater(qx, qz)) break; dEnd = d + 10; } // (the coarse mask still reads 'inside' just past the edge)
              for (let d = 0.6; d < dEnd; d += 20) {
                  const d1 = Math.min(dEnd, d + 20);
                  strip(d, d1, -half, half, asp, y - 0.02 + (k % 8) * 0.002); // (two strips crossing outside the map: no z-fight)
                  strip(d, d1, -half - wS, -half, kerbC, y + 0.1); strip(d, d1, half, half + wS, kerbC, y + 0.1);
                  if (d < 25) { /* the work site behind the barrier: workSite() below */ }
                  else if (kind !== 'small') for (let q = d; q < d1 - 3; q += 9) strip(q, q + 3, -0.08, 0.08, dash, y - 0.01);
              }
              // (2026-11-08, owner: "work zones look bad" — a flat brown strip and four cones) the work site: a trench cut in the
              // asphalt (dark edges, soil at the bottom), the spoil heaped along it, a pallet of kerbstones, all inside an orange
              // safety mesh on steel rods with a cone at each corner
              if (dEnd > 30) {
                  const exc = !US && kind !== 'highway' && (e.id * 7 + k) % 3 === 0; // (the excavator closures: it digs the trench)
                  const L0 = -half * 0.85, L1 = half * 0.45, D0 = 2.6, D1 = Math.min(20, dEnd - 1), tw = clamp((L1 - L0) * 0.3, 0.6, 1.3), T0 = L0 + Math.min(0.5, half * 0.25), T1 = T0 + tw;
                  const V = (d, l, yy) => { const [x, z] = at(-d, l); return [x, yy, z]; }, cs = cellOf(m.x - ix * 10, m.z - iz * 10);
                  const nUp = (a, b2, c2) => { const e1 = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], e2 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n; };
                  const q4 = (lay, a, b2, c2, d2, col) => { const n = nUp(a, b2, c2); lay.face4(a, b2, c2, d2, col, n); lay.face4(a, d2, c2, b2, col, [-n[0], -n[1], -n[2]]); };
                  strip(D0 + 0.4, D1 - 0.4, T0 - 0.12, T1 + 0.12, rgb('#3a3936'), y - 0.004);                          // saw-cut asphalt edge
                  strip(D0 + 0.5, D1 - 0.5, T0, T1, rgb('#4b3d31'), y - 0.002);                                        // soil in the trench
                  // spoil heap: a ridge with a ragged crest along the trench, on the side away from the kerb
                  const S0 = T1 + 0.15, S1 = Math.min(L1 - 0.15, S0 + 1.5), sk = Math.min(1, (S1 - S0) / 1.3), soil = rgb('#6e5a45'), soilD = rgb('#5d4a38');
                  const SA = D0 + 2.6, SB = exc ? D1 - 5.5 : D1 - 1;
                  if (S1 - S0 > 0.45 && SB - SA > 3) { const nR = Math.max(3, Math.round((SB - SA) / 2.5)); for (let r = 0; r < nR; r++) {
                      const da = SA + (SB - SA) * r / nR, db = SA + (SB - SA) * (r + 1) / nR, ha = sk * (0.35 + 0.25 * Math.abs(Math.sin(r * 2.1 + k))), hb = sk * (0.35 + 0.25 * Math.abs(Math.sin((r + 1) * 2.1 + k))), mid = (S0 + S1) / 2;
                      const ea = r === 0 ? 0.05 : ha, eb = r === nR - 1 ? 0.05 : hb;
                      q4(cs.solid, V(da, S0, y), V(db, S0, y), V(db, mid, y + eb), V(da, mid, y + ea), soil);
                      q4(cs.solid, V(da, mid, y + ea), V(db, mid, y + eb), V(db, S1, y), V(da, S1, y), soilD); } }
                  // a pallet of kerbstones and a stack of concrete pipes near the barrier end
                  { const [x, z] = at(-(D0 + 1.2), (S0 + S1) / 2); cs.solid.box(x, y, z, 1.0, 0.14, 1.2, ang, rgb('#9a7b55'));
                    for (let r = 0; r < 3; r++) for (let j = -1; j <= 1; j++) { const sx = x + px * j * 0.3, sz = z + pz * j * 0.3; // kerbstones, 3 × 3, with gaps
                        cs.solid.box(sx, y + 0.14 + r * 0.27, sz, 1.0, 0.25, 0.26, ang, rgb((r + j) % 2 ? '#a9a69e' : '#bdbab2')); }
                    addPropColl(x, z, 0.75, 'closure'); }
                  // orange safety mesh on rods round the site: a top and a bottom band, a diamond weave between
                  const ORG = rgb('#ff6d1a'), ROD = rgb('#34363a'), H = 1.0;
                  const ring = [[D0, L0], [D1, L0], [D1, L1], [D0, L1]];
                  for (let q = 0; q < 4; q++) { const [da, la] = ring[q], [db, lb] = ring[(q + 1) % 4], len = Math.hypot(db - da, lb - la), n = Math.max(1, Math.round(len / 2));
                      for (let j = 0; j < n; j++) { const f0 = j / n, f1 = (j + 1) / n, dA = da + (db - da) * f0, lA = la + (lb - la) * f0, dB = da + (db - da) * f1, lB = la + (lb - la) * f1;
                          for (const yb of [0.12, H - 0.06]) q4(cs.detail, V(dA, lA, y + yb), V(dB, lB, y + yb), V(dB, lB, y + yb + 0.07), V(dA, lA, y + yb + 0.07), ORG);
                          const nw = 5; for (let w = 0; w < nw; w++) { const g0 = w / nw, g1 = (w + 1) / nw, pd = (g) => dA + (dB - dA) * g, pl = (g) => lA + (lB - lA) * g, yl = y + 0.15, yh = y + H - 0.02;
                              const st = (g, yy, h2, y2) => { const a2 = V(pd(g), pl(g), yy), b3 = V(pd(h2), pl(h2), y2), sx = 0.02; q4(cs.detail, a2, b3, [b3[0], b3[1] + sx * 1.5, b3[2]], [a2[0], a2[1] + sx * 1.5, a2[2]], ORG); };
                              st(g0, yl, g1, yh); st(g0, yh, g1, yl); }
                          const [rx, , rz] = V(dA, lA, 0); cs.detail.box(rx, y, rz, 0.035, H + 0.1, 0.035, 0, ROD); }
                      const [mx2, , mz2] = V((da + db) / 2, (la + lb) / 2, 0); addPropColl(mx2, mz2, 0.3, 'closure'); }
                  if (exc) { // a mini excavator at the far end of the trench, facing the barrier, its bucket down in the trench
                      const ex0 = D1 - 2.6, el = (L0 + L1) / 2 + 0.15, YEL = rgb('#f2b705'), DK = rgb('#26282b'), GL = rgb('#2c3a44');
                      const E3 = (f, l, yy) => V(ex0 - f, el + l, y + yy); // f: forward (toward the barrier), l: lateral
                      const B = (f, l, yy, wl, h, df, col) => { const [x, , z] = E3(f, l, 0); cs.solid.box(x, y + yy, z, df, h, wl, ang + Math.PI / 2, col); };
                      const beam = (A, Bp, w, col) => { const dx = Bp[0] - A[0], dy = Bp[1] - A[1], dz = Bp[2] - A[2], L = Math.hypot(dx, dy, dz);
                          let sx = -dz, sz = dx; const sl = Math.hypot(sx, sz) || 1; sx = sx / sl * w / 2; sz = sz / sl * w / 2; // side (horizontal) and up vectors
                          const ux2 = -(dy * dx) / L, uy2 = (dx * dx + dz * dz) / L, uz2 = -(dy * dz) / L, ul = Math.hypot(ux2, uy2, uz2) || 1, U = [ux2 / ul * w / 2, uy2 / ul * w / 2, uz2 / ul * w / 2];
                          const c4 = (p, a, b2) => [p[0] + a * sx + b2 * U[0], p[1] + b2 * U[1], p[2] + a * sz + b2 * U[2]];
                          for (const [a1, b1, a2, b2] of [[1, 1, -1, 1], [-1, -1, 1, -1], [1, -1, 1, 1], [-1, 1, -1, -1]]) q4(cs.solid, c4(A, a1, b1), c4(Bp, a1, b1), c4(Bp, a2, b2), c4(A, a2, b2), col); };
                      for (const sl of [-0.7, 0.7]) B(0, sl, 0, 0.42, 0.45, 2.4, DK);                       // tracks
                      B(0, 0, 0.3, 1.0, 0.3, 1.6, rgb('#3a3c40'));                                           // undercarriage
                      B(-0.15, 0, 0.6, 1.8, 0.75, 1.9, YEL);                                                 // upper house
                      B(-1.05, 0, 0.6, 1.7, 0.55, 0.3, DK);                                                  // counterweight
                      B(0.1, 0.45, 1.35, 0.85, 1.05, 0.95, GL); B(0.1, 0.45, 2.4, 0.95, 0.07, 1.05, YEL);    // cab (glass) + roof
                      const lt = (T0 + T1) / 2 - el, A0 = E3(0.85, lt, 1.1), A1 = E3(2.2, lt, 2.3), A2 = E3(3.2, lt, 0.55);
                      beam(A0, A1, 0.3, YEL); beam(A1, A2, 0.22, YEL); beam(A2, E3(3.05, lt, 0.05), 0.5, DK); // boom, arm, bucket
                      const [cx3, , cz3] = E3(0, 0, 0); addPropColl(cx3, cz3, 1.3, 'closure');
                  }
                  for (const [dd, ll] of ring) { const [x, , z] = V(dd + (dd === D0 ? -0.5 : 0.5), ll + (ll === L0 ? -0.45 : 0.45), 0); c.solid.geo(coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]); addPropColl(x, z, 0.22, 'closure'); }
              }
            }
            // the closing barrier line (RO red-white boards / US type III barricade: orange-white rails)
            const segs = Math.max(2, Math.round(half * 2 / 1.2)), cA = US ? orange : red;
            for (let j = 0; j < segs; j++) {
                const f = (j + 0.5) / segs - 0.5, [x, z] = at(0, f * half * 2);
                for (let r = 0; r < (US ? 3 : 2); r++) c.solid.box(x, y + 0.45 + r * 0.38, z, half * 2 / segs, 0.22, 0.08, ang + Math.PI / 2, (j + r) % 2 ? whiteB : cA);
            }
            for (let j = 0; j <= segs; j += Math.max(1, Math.floor(segs / 3))) { const [x, z] = at(0, (j / segs - 0.5) * half * 2); post(c, x, z, y, US ? 1.35 : 1.2);
                c.solid.box(x, y, z, 0.7, 0.07, 0.16, ang, dark); c.solid.box(x, y, z, 0.16, 0.12, 0.3, ang, dark); } // (a foot under every post)
            for (const sg of [-0.5, 0.5]) { const [x, z] = at(0, sg * half * 2); c.solid.box(x, y + (US ? 1.35 : 1.2), z, 0.16, 0.16, 0.12, ang, yellowM); } // warning lamps at the ends
            // cones / drums tapering across the lanes in front of it
            const nT = kind === 'small' ? 4 : 7;
            if (m.bundlePrimary) for (let j = 0; j < nT; j++) { const f = j / (nT - 1), [x, z] = at(3 + f * (kind === 'small' ? 5 : 14), (f - 0.5) * half * 1.6);
                discrete(c.solid, () => c.solid.geo(US && kind !== 'small' ? drumG : coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]), x, z, US ? .35 : .22); }
            if (kind !== 'small' && m.bundlePrimary) { // one arrow board per local street bundle
                for (let j = -1; j <= 1; j++) { const [x, z] = at(1.0, j * 2.05 - half * 0.35);
                    discrete(c.solid, () => c.solid.geo(jerseyG, x, y, z, ang, 1, 1, 1, [255, 255, 255]), x, z, 1.05, false); }
                wholePrimitive(() => {
                    const [bx, bz] = at(-0.6, half * 0.5); c.solid.box(bx, y, bz, 0.1, 1.2, 0.1, 0, postCol); c.solid.box(bx, y + 1.25, bz, 2.2, 1.1, 0.12, ang + Math.PI / 2, dark);
                    const ab = signs.get(US ? '<<<<' : '◄◄◄', '#141414', '#ffb300', null, true); if (ab) addSignQuad(c, bx, bz, face, 1, 2.0, 0.9, y + 1.8, ab, 0.08);
                });
            }
            // signs on the kerb
            const [sx, sz] = at(5, half + 0.7), [tx, tz] = at(9, -(half + 0.7)); // (on the kerb, just off the asphalt)
            if (US) {
                closureSign(c, sx, sz, y, face, 'ROAD CLOSED', '#ffffff', '#111111', null, 1.8);
                closureSign(c, tx, tz, y, face, kind === 'highway' ? 'RAMP CLOSED' : k % 2 ? 'LOCAL TRAFFIC ONLY' : 'DETOUR →', kind === 'highway' ? '#ff6a13' : k % 2 ? '#ffffff' : '#ff6a13', '#111111', null, 1.7);
                if (kind === 'highway') { const [hx, hz] = at(12, half + 0.7); closureSign(c, hx, hz, y, face, 'CLOSED FOR BRIDGE MAINTENANCE', '#ff6a13', '#111111', null, 2.6); }
            } else {
                closureSign(c, sx, sz, y, face, 'DRUM ÎNCHIS', '#ffffff', '#c62828', '#c62828', 1.6);
                closureSign(c, tx, tz, y, face, k % 2 ? 'DEVIERE →' : 'LUCRĂRI', '#f5c400', '#111111', null, 1.5);
            }
            // one character prop per closure (deterministic): excavator / police car (RO), flagger (US)
            const pick = (e.id * 7 + k) % 3;
            if (!US && kind !== 'highway' && pick === 0) { /* the excavator digs in the work site (above) */
            } else if (!US && kind !== 'small' && pick === 1 && m.bundlePrimary) { // one paired rendered/colliding car
                const [qx, qz] = at(6, half * 0.45);
                // (owner, 2026-11-11, Grozavesti (1030, -869): "car stuck") the car stands 6 m from the barrier: on a graded
                // road (a ramp foot) it takes the road height where it stands, not the barrier's, and sits level on a slope of
                // at most 3 % (steeper: no car, it would hang over the asphalt or sink into it)
                const dy = yAlong(e, qx, qz) - yAlong(e, m.x, m.z), slope = Math.abs(dy) / 6;
                if (slope <= 0.03) discrete(c.solid, () => { c.solid.geo(carProps('sedan', '#e8e8e8'), qx, y + dy - .12, qz, ang, 1, 1, 1, [255, 255, 255]);
                    c.solid.box(qx, y + dy + 1.5, qz, .9, .12, .25, ang, rgb('#1e5bff')); }, qx, qz, 1.9);
            } else if (US && pick !== 2 && m.bundlePrimary) { // flagger with a STOP paddle
                const [fx, fz] = at(7, half - 1.2), vest = rgb('#d7ff1f');
                if (boundarySupport.clearCircle(fx, fz, .85, { ownerEdges: m.ownerEdges, y0: y - .3, y1: y + 2.1 })) {
                c.solid.box(fx, y, fz, 0.35, 0.85, 0.25, ang, rgb('#2b3442')); c.solid.box(fx, y + 0.85, fz, 0.45, 0.65, 0.3, ang, vest); c.solid.box(fx, y + 1.5, fz, 0.22, 0.25, 0.22, ang, rgb('#b98a6a'));
                c.solid.box(fx, y + 1.78, fz, 0.32, 0.12, 0.32, ang, rgb('#f2f2f2')); post(c, fx + px * 0.35, fz + pz * 0.35, y + 0.6, 1.0);
                const st = signs.get('STOP', '#c62828', '#ffffff', null, true); if (st) addSignQuad(c, fx + px * 0.35, fz + pz * 0.35, face, 1, 0.5, 0.5, y + 1.85, st, 0.05);
                propColl.push({ x: fx, z: fz, r: .35, hw: .35, hd: .35, angle: 0, poly: null, prop: true, kind: 'closure', y, h: 2.1, top: y + 2.1, y0: y - .3, y1: y + 2.1, normalizedSourceBoundary: true });
                }
            }
            // which district this road heads toward (a later chapter's district → "opens in Chapter n")
            let leadsTo = null, best = Math.cos(45 * Math.PI / 180);
            for (const o of others) { const dx = o.x - m.x, dz = o.z - m.z, L = Math.hypot(dx, dz) || 1, cs = (-ix * dx - iz * dz) / L; if (cs > best) { best = cs; leadsTo = o.id; } }
            // roadworks crew spot (gameplay places the instanced worker there): behind the barrier on the closed asphalt, off the
            // driver's sight line to the kerb signs (the sign plate no longer sits in front of the worker's head — note 6)
            const [wx, wz] = at(-1.4, half * 0.7); // (between the barrier and the work-site mesh)
            const worker = m.bundlePrimary && boundarySupport.clearCircle(wx, wz, .6, { ownerEdges: m.ownerEdges, y0: y - .3, y1: y + 2 }) ? { x: wx, z: wz, y, yaw: Math.atan2(ix, iz) } : false;
            closures.push({ x: m.x, z: m.z, y, top: y + m.barrierHeight, heading: m.heading, edge: e, node: m.node, kind, leadsTo,
                l0: m.l0, l1: m.l1, half: m.half, bundleId: m.bundleId, bundlePrimary: m.bundlePrimary, worker });
            const now = closureBuilders(), startOf = (mb, k) => (now === startList ? startIc[k] : (k = startIndex.get(mb)) === undefined ? 0 : startIc[k]);
            for (let k = 0; k < now.length; k++) { const mb = now[k], s0 = startOf(mb, k); if (mb.ic > s0) boundarySupport.applyMesh(mb, s0, clipOptions); }
        });
    }
    // road signs: speed limits where the limit changes, one-way at one-way entries, no-entry at one-way exits
    let signCount = 0;
    {
        const signRailAudit = tramGrades.report.inferredRoadSigns = { checked: 0, refused: 0, bySource: {}, samples: [], scope: 'Complete inferred post/front/back-plate unit only; mapped signs unchanged; unknown source grades not certified.' };
        const kmh = (e) => Math.round(e.maxspeed * 3.6);
        const label = (e) => US ? Math.round(kmh(e) / 1.609 / 5) * 5 : Math.round(kmh(e) / 10) * 10;
        const placeSign = (e, along, sd, faceSign, icon) => { // faceSign: +1 faces along +dir, -1 against
            const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e);
            const sw = sidewalkWidth(e, sd), o = sw >= 1.2 ? w + Math.min(0.6, sw * 0.4) : w + 0.7;
            const x = e.a.x + e.dirx * along + e.nx * o * sd, z = e.a.z + e.dirz * along + e.nz * o * sd;
            if (onRibbon(x, z, 0.2) || buildingAt(x, z)) return false;
            const y0 = 0.15 + yAlong(e, x, z) + (raisedTop(x, z) !== null ? DY_SIDE : 0), ang = Math.atan2(e.dirx * faceSign, e.dirz * faceSign);
            const unit = inferredRoadSignUnit({ grades:tramGrades, envelope:tramPropEnvelope, x, z, angle:ang, baseY:y0, width:icon.w||.75, height:icon.h||.75, sourceId:data.roadSourceGeometry?.[e.road]?.sourceId||e.access?.sourceId||null });
            signRailAudit.checked++;
            const signSource = data.roadSourceGeometry?.[e.road]?.sourceId||e.access?.sourceId||null, sourceAudit = signRailAudit.bySource[signSource||'unattributed'] ||= { checked:0, refused:0 };
            sourceAudit.checked++;
            if (!unit.allowed) { signRailAudit.refused++; sourceAudit.refused++; if(signRailAudit.samples.length<200)signRailAudit.samples.push({ sourceId:signSource, edgeId:e.id, along, side:sd, icon:icon.key, x, z, baseY:y0, ...unit }); return false; }
            const s = signs.icon(icon.key, icon.draw); if (!s) return false;
            const c = cellOf(x, z);
            c.solid.box(x, y0, z, 0.07, 2.3, 0.07, ang, rgb('#8d939a'));
            addSignQuad(c, x, z, ang, 1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, s, 0.06);
            const back = signs.icon('back', (ctx, X, Y2, S2) => { ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 2, 0, 7); ctx.fill(); });
            if (back) addSignQuad(c, x, z, ang, -1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, back, 0.04);
            addPropColl(x, z, 0.1, 'sign'); signCount++;
            return true;
        };
        const speedIcon = (v) => US
            ? { key: 'mph' + v, w: 0.6, h: 0.75, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#111'; ctx.fillRect(X + 6, Y2, S2 - 12, S2); ctx.fillStyle = '#fff'; ctx.fillRect(X + 9, Y2 + 3, S2 - 18, S2 - 6); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 9px Arial'; ctx.fillText('SPEED', X + S2 / 2, Y2 + 14); ctx.fillText('LIMIT', X + S2 / 2, Y2 + 24); ctx.font = 'bold 26px Arial'; ctx.fillText(String(v), X + S2 / 2, Y2 + 52); } }
            : { key: 'kmh' + v, draw: (ctx, X, Y2, S2) => { const c2 = [X + S2 / 2, Y2 + S2 / 2]; ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 8, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${v >= 100 ? 20 : 26}px Arial`; ctx.fillText(String(v), c2[0], c2[1] + 1); } };
        const noEntry = { key: 'noentry', draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(X + 12, Y2 + S2 / 2 - 6, S2 - 24, 12); } };
        const oneWay = { key: 'oneway', w: 0.9, h: 0.5, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = US ? '#111' : '#1d4ed8'; ctx.fillRect(X, Y2 + 14, S2, S2 - 28); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X + 8, Y2 + 28); ctx.lineTo(X + 40, Y2 + 28); ctx.lineTo(X + 40, Y2 + 21); ctx.lineTo(X + 57, Y2 + 32); ctx.lineTo(X + 40, Y2 + 43); ctx.lineTo(X + 40, Y2 + 36); ctx.lineTo(X + 8, Y2 + 36); ctx.closePath(); ctx.fill(); } };
        const cont = (n, e) => { // the edge continuing e through node n (same name preferred, best aligned)
            let best = null, bs = -Infinity;
            for (const f of n.edges) { if (f === e || f.virtual) continue; const out = f.a === n ? 1 : -1, inn = e.b === n ? 1 : -1; const d = (f.dirx * out) * (e.dirx * inn) + (f.dirz * out) * (e.dirz * inn); const sc = d + (f.name && f.name === e.name ? 1 : 0); if (sc > bs) { bs = sc; best = f; } }
            return bs > 0.6 ? best : null;
        };
        for (const e of edges) {
            if (e.virtual || e.tunnel || !e.drivable || e.type === 'service' || e.len < 20) continue;
            const mw = /motorway/.test(e.type);
            for (const dir of e.oneway ? [1] : [1, -1]) {
                const n = dir > 0 ? e.a : e.b; // node where traffic in direction `dir` enters e
                const f = cont(n, e);
                if (!f || label(f) === label(e) || (mw && !/motorway/.test(f.type))) continue;
                const r = retract(e, n) + 6; if (r > e.len - 6) continue;
                placeSign(e, dir > 0 ? r : e.len - r, dir, -dir, speedIcon(label(e)));
            }
            if (!e.oneway || mw || e.roundabout || /_link/.test(e.type)) continue;
            if (e.a.edges.length >= 3) placeSign(e, retract(e, e.a) + 3, 1, -1, oneWay);
            if (e.b.edges.length >= 3) { const r = e.len - retract(e, e.b) - 2.5; if (r > 3) { placeSign(e, r, 1, 1, noEntry); placeSign(e, r, -1, 1, noEntry); } }
        }
    }
    // instanced posts + heads (filled with the lamps near the viewer, see the culling hook below)
    const postGeo = new THREE.BufferGeometry(), headGeo = new THREE.BufferGeometry();
    {
        const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 5);
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        toGeo(mergeProps([bakeProp(pole, { y: 4, sy: 8 }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 0.9, y: 7.9, sx: 1.9, sy: 0.12, sz: 0.12 })]), postGeo);
        toGeo(bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 1.8, y: 7.78, sx: 0.75, sy: 0.16, sz: 0.34 }), headGeo);
    }
    const arcPostGeo = new THREE.BufferGeometry(), arcHeadGeo = new THREE.BufferGeometry();
    {
        // unit height 8 like the street lamp (scaled by h / 8): a straight post to 5.6, then three chords curving in to 2.1 m
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        const pts = [[0, 5.6], [.3, 6.7], [.95, 7.5], [1.95, 7.9]], parts = [bakeProp(new THREE.CylinderGeometry(0.075, 0.12, 1, 5), { y: 2.8, sy: 5.6 })];
        for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0); parts.push(bakeProp(new THREE.BoxGeometry(L + .06, .13, .13), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rz: Math.atan2(y1 - y0, x1 - x0) })); }
        toGeo(mergeProps(parts), arcPostGeo);
        toGeo(bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 2.3, y: 7.84, sx: 0.8, sy: 0.14, sz: 0.34 }), arcHeadGeo);
    }
    const candPostGeo = new THREE.BufferGeometry(), candHeadGeo = new THREE.BufferGeometry();
    { // (r3-look-13) candelabra: dark post on a plinth, a cross of arms and a cluster of globes (unit height 8, CANDELABRA_MODEL)
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        const C = CANDELABRA_MODEL, a = C.armHalfM;
        toGeo(mergeProps([bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 0.45, sx: 0.55, sy: 0.9, sz: 0.55 }), bakeProp(new THREE.CylinderGeometry(0.1, 0.16, 1, 6), { y: 3.9, sy: 6.0 }),
            bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 6.95, sx: a * 2 + 0.1, sy: 0.1, sz: 0.1 }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { y: 6.95, sx: 0.1, sy: 0.1, sz: a * 2 + 0.1 }),
            bakeProp(new THREE.CylinderGeometry(0.07, 0.09, 1, 5), { y: 7.35, sy: 0.8 })]), candPostGeo);
        const globe = (x, y, z) => bakeProp(new THREE.IcosahedronGeometry(C.globeR, 1), { x, y, z });
        toGeo(mergeProps([globe(0, 7.85, 0), globe(a, 7.3, 0), globe(-a, 7.3, 0), globe(0, 7.3, a), globe(0, 7.3, -a)]), candHeadGeo);
    }
    const CAND_MAX = lamps.filter(l => l.candelabra).length || 1;
    const ARC_MAX = lamps.filter(l => l.arc).length || 1;
    const LAMP_MAX = Math.min(lamps.length, 6000) || 1;
    const lampPostMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#4a4f57' }), LAMP_MAX);
    const lampHeadMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#000000', emissiveIntensity: 1, roughness: 0.4 }), LAMP_MAX);
    lampPostMesh.name = 'lampPosts'; lampHeadMesh.name = 'lampHeads';
    lampPostMesh.castShadow = true; lampPostMesh.frustumCulled = false; lampHeadMesh.frustumCulled = false;
    lampPostMesh.count = lampHeadMesh.count = 0;
    group.add(lampPostMesh, lampHeadMesh);
    const arcPostMesh = new THREE.InstancedMesh(arcPostGeo, new THREE.MeshLambertMaterial({ color: '#dfe4e3' }), ARC_MAX), arcHeadMesh = new THREE.InstancedMesh(arcHeadGeo, lampHeadMesh.material, ARC_MAX);
    arcPostMesh.name = 'lampArcPosts'; arcHeadMesh.name = 'lampArcHeads'; arcPostMesh.castShadow = true; arcPostMesh.frustumCulled = false; arcHeadMesh.frustumCulled = false;
    arcPostMesh.count = arcHeadMesh.count = 0;
    if (lamps.some(l => l.arc)) group.add(arcPostMesh, arcHeadMesh);
    const candPostMesh = new THREE.InstancedMesh(candPostGeo, new THREE.MeshLambertMaterial({ color: '#2b2f33' }), CAND_MAX), candHeadMesh = new THREE.InstancedMesh(candHeadGeo, lampHeadMesh.material, CAND_MAX);
    candPostMesh.name = 'lampCandelabraPosts'; candHeadMesh.name = 'lampCandelabraHeads'; candPostMesh.castShadow = true; candPostMesh.frustumCulled = false; candHeadMesh.frustumCulled = false;
    candPostMesh.count = candHeadMesh.count = 0;
    if (lamps.some(l => l.candelabra)) group.add(candPostMesh, candHeadMesh);
    const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(), _ly = new THREE.Vector3(0, 1, 0);
    const fillLamps = (vx, vz, R) => {
        let n = 0, na = 0, nc = 0;
        lampGrid.each(vx - R, vz - R, vx + R, vz + R, (l) => {
            if (Math.abs(l.x - vx) > R || Math.abs(l.z - vz) > R || (l.arc ? na >= ARC_MAX : l.candelabra ? nc >= CAND_MAX : n >= LAMP_MAX)) return;
            const k = l.h / 8;
            _lm.compose(_lp.set(l.x, l.y, l.z), _lq.setFromAxisAngle(_ly, l.rot), _ls.set(k, k, k));
            if (l.arc) { arcPostMesh.setMatrixAt(na, _lm); arcHeadMesh.setMatrixAt(na, _lm); na++; }
            else if (l.candelabra) { candPostMesh.setMatrixAt(nc, _lm); candHeadMesh.setMatrixAt(nc, _lm); nc++; }
            else { lampPostMesh.setMatrixAt(n, _lm); lampHeadMesh.setMatrixAt(n, _lm); n++; }
        });
        lampPostMesh.count = lampHeadMesh.count = n; arcPostMesh.count = arcHeadMesh.count = na; candPostMesh.count = candHeadMesh.count = nc;
        candPostMesh.instanceMatrix.needsUpdate = true; candHeadMesh.instanceMatrix.needsUpdate = true;
        lampPostMesh.instanceMatrix.needsUpdate = true; lampHeadMesh.instanceMatrix.needsUpdate = true;
        arcPostMesh.instanceMatrix.needsUpdate = true; arcHeadMesh.instanceMatrix.needsUpdate = true;
    };
    void P;
    // (world parking and lights: world-parking-lights.js)
    const {
        LAMP_COL, LAMP_Y, atlas, groundMat, lampMesh, lights, marksMat, nearDoor,
        nodeLight, noise, padMat, parked, parkedLots, parkingClearance, roadMat, solidMat,
        spillMat, tmpM, useInst,
    } = await buildParkingLights({
        DY_SIDE, P, SIDE_BACK, US, addPropColl, areas, bGrid, buildingAt,
        cellOf, city, clusters, cornerPolys, data, dmask, earlyAtlas, edges,
        group, inArea, nearWater, nodeArr, obbPoly, onRibbon, pois, polyOnRibbon,
        propColl, raisedEdge, raisedTop, retract, rng, tramSweep, underpassCover, widthAsphalt,
    });
    // shared water material from render's water.js (Fresnel env reflection, ripples, flow, night light streaks — note 11);
    // the old flat vertex-colour material stays as the fallback if the module is missing
    let waterMat = null;
    try { const W2 = WATER_API = WATER_API || await import('./water.js'); waterMat = W2.makeWaterMaterial({ deep: US ? '#1d3340' : '#2b3a33', shallow: US ? '#3a5563' : '#46564a', flow: [0.25, 0.08] }); waterMat.depthWrite = false; } catch (err) { console.warn('water.js unavailable', err); }
    if (!waterMat) waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, depthWrite: false });
    // shoreline foam / shallow tint / wet edges (water.js): every water mesh is re-tessellated (≤ 6 m edges) and gets
    // its per-vertex distance to the shore; all-or-nothing, since the shared material then expects `aShore` everywhere
    let shoreTris = 0;
    const sourceShoreSampler = WATER_API?.makeSourceShoreSampler?.(areas.filter(a => a.kind === 'water'), { maxD: 30 });
    const waterShoreAudit = [];
    const shoreFoam = (m, prepared = null) => {
        if (!WATER_API || !m.geometry) { if (prepared) throw Error('Prepared water lost its final assembly API'); return; }
        try { const g2 = prepared ? consumePreparedSmallWater(prepared, m.geometry) : prepareFinalWaterGeometry(m.geometry, { subdivide: WATER_API.subdivideWater, covered: coveredWater }); const sd = WATER_API.computeShoreDistance(g2, { maxD: 30, material: waterMat, sourceSampler: sourceShoreSampler });
            // (after round 6) a big lake that hit the triangle cap keeps only shore vertices: distance 0 everywhere read as
            // salt-and-pepper foam over the whole of Lake Floreasca — such a mesh gets calm open water instead
            if (!sourceShoreSampler) { let near = 0; for (let i = 0; i < sd.length; i++) if (sd[i] < 1.5) near++; if (near > sd.length * 0.6 && sd.length > 200) sd.fill(30); }
            if (g2.userData.sourceShoreAudit) waterShoreAudit.push({ mesh: m.name, ...g2.userData.sourceShoreAudit });
            m.geometry.dispose(); m.geometry = g2; shoreTris += g2.attributes.position.count / 3; }
        catch (err) { if (prepared) throw err; console.warn('shore foam failed', err); }
    };
    // Compose native opaque ground in its existing painter order, then retain
    // the final surface depth so later vehicles below it cannot show through.
    const areaMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); areaMat.name = 'landuse';
    const paveMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); paveMat.name = 'paved-areas';
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); grassMat.name = 'grass';
    const sportMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth });
    // (t: world-scenery.js)
    const __buildScenery = buildScenery({
        ASPHALT, LANDMARKS, US, addPropColl, atlas, bGrid, bRecs, bounds,
        buildingAt, cellOf, city, country, data, distCfg, distId, edges,
        elevatedDataset, elevatedPlan, env, fenceSegs, group, isPark, isWater, landmarks,
        liftOnSide, nearWater, nearestEdge, obbPoly, onRibbon, polyDist, polyOnRibbon, propColl,
        raisedTop, retract, rng, sceneryDeckGrid, signs, sportMat, str, surfacesAt,
        sweptOut, tramGrades, tramSweep,
    });
    const {
        areaFences, backdropCount, backdropInLandmark, backdropMat, backdropSourceOwnership, bollards, carParkFronts, cellsGroup,
        elevatedSources, facadeBands, fallbackApertures, horizon, monuments, parkWalls, pedestrianBridges, playgrounds,
        railStats, roofMat, scenerySourceAudit, sceneryStreets, signMats, signTex, underpassMouths, weirs,
    } = __buildScenery;
    // (world final meshes: world-final-meshes.js)
    const __buildFinalMeshes = buildFinalMeshes({
        US, areaMat, areas, backdropMat, bigWater, buildingAt, cells, cellsGroup,
        city, data, edges, fallbackApertures, grassMat, groundMat, horizon, inArea,
        lampNear, landmarkPits, mapEnds, marksMat, nearDoor, nearWater, obbPoly, padMat,
        parkedLots, paveMat, poiDoorGuides, poiGroup, pois, polyOnRibbon, preparedSmallWater, propColl,
        raisedTop, retract, roadMat, roofMat, shoreFoam, signMats, solidMat, spillMat,
        sportMat, str, tramGrades, treeClear, treeNear, underpassCover, useInst, vegetation,
        waterMat,
    });
    const {
        _v, cullR, kerbParked, tramTrench, waterMesh,
    } = __buildFinalMeshes;
    let viewerCam = null, lastCull = null;
    // shops closing at night: the share of shutters down follows the district's local hour (render's simulated clock;
    // a fixed 'night' look counts as 23:00, 'dusk' as 19:00): 0 until 21:00, ~55 % at 23:00, ~70 % 00–06, open by 07:30
    let closedT = 0;
    const closedShare = () => {
        const r3 = globalThis.game?.r3d, ov = r3?.clock?.override;
        let h = null;
        if (ov) h = { night: 23, dusk: 19, sunset: 18.5, dawn: 6.5, day: 12 }[ov] ?? 12;
        else { const d = r3?.simDate || new Date(); try { const f = new Intl.DateTimeFormat('en-GB', { timeZone: city.timeZone || 'UTC', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d); h = +f.find(x => x.type === 'hour').value + +f.find(x => x.type === 'minute').value / 60; } catch { h = d.getHours(); } }
        if (h >= 21) return clamp((h - 21) / 2, 0, 1) * 0.55 + clamp((h - 23) / 1, 0, 1) * 0.15;
        if (h < 6) return 0.7;
        if (h < 7.5) return 0.7 * (1 - (h - 6) / 1.5);
        return 0;
    };
    cellsGroup.updateMatrixWorld = function (force) {
        { const now = performance.now(); if (now - closedT > 2000) { closedT = now; solidMat.userData.uClosed.value = closedShare(); } }
        const cam = world.camera || viewerCam || (viewerCam = findCamera(this));
        if (cam) {
            cam.getWorldPosition(_v);
            if (!lastCull || Math.abs(_v.x - lastCull.x) + Math.abs(_v.z - lastCull.z) > 20) {
                lastCull = { x: _v.x, z: _v.z };
                fillLamps(_v.x, _v.z, Math.min(cullR, 1100));
                vegetation.update?.(_v.x, _v.z);
                for (const m of this.children) if (!m.userData.always) m.visible = Math.hypot(m.userData.cx - _v.x, m.userData.cz - _v.z) < (m.userData.cull || cullR);
            }
        }
        THREE.Group.prototype.updateMatrixWorld.call(this, force);
    };
    function findCamera(obj) {
        let root = obj; while (root.parent) root = root.parent;
        if (!root.isScene) return null;
        let best = null; root.traverse(o => { if (o.isPerspectiveCamera && (!best || o.fov > best.fov)) best = o; });
        return best;
    }
    // ground plane
    const W = bounds.maxX - bounds.minX, H = bounds.maxZ - bounds.minZ;
    // (the plane reaches 30 km past the map: its edge was visible at ~3 km on clear days with render's 15–20 km visibility)
    const GPAD = 60000;
    const fallbackOpts={x0:bounds.minX-GPAD/2,x1:bounds.maxX+GPAD/2,z0:bounds.minZ-GPAD/2,z1:bounds.maxZ+GPAD/2};
    // (spec 10 load budget) with the build workers the fallback ground is walked there while the rest of the build and the
    // caller's setup go on: the plane's mesh and material are made here, in their place, and get the geometry, depth write,
    // culling and report when the walk is done (world.ready; buildWorld waits for it unless opts.deferGround).
    const fallbackJob=buildPool?buildFallbackGroundParallel(fallbackApertures,fallbackOpts,buildPool):null;
    const groundPlaneMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(env.ground).multiplyScalar(0.72), map: noise }); groundPlaneMat.name = 'groundPlane';
    const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundPlaneMat);
    vegetation.grassMaterials.push(grassMat);
    vegetation.groundMaterials.push(groundPlaneMat, areaMat, paveMat);
    vegetation.roofMaterials.push(roofMat);
    vegetation.sportMaterials = [sportMat, ...landmarkSurfaceMats];
    const placeGround=fallback=>{
        fallbackApertures.cuts.length=0;
        let groundGeo=fallback.geometry;
        if(!groundGeo){
            groundGeo=new THREE.PlaneGeometry(W+GPAD,H+GPAD,1,1);groundGeo.rotateX(-Math.PI/2);
            const uv=groundGeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(W+GPAD)/12,uv.getY(i)*(H+GPAD)/12);
        }
        groundPlaneMat.depthWrite=fallback.report.known;
        ground.geometry.dispose(); ground.geometry=groundGeo;
        if(!fallback.report.known)ground.position.set((bounds.minX + bounds.maxX) / 2, -0.3, (bounds.minZ + bounds.maxZ) / 2);
        else cullMergedCells(ground,fallback.parts,{blockTriangles:64});
        ground.userData.fallbackGround=fallback.report;
        return fallback;
    };
    const fallbackReady=fallbackJob?fallbackJob.then(placeGround):Promise.resolve(placeGround(buildFallbackGround(fallbackApertures,fallbackOpts)));
    ground.renderOrder = -20; // far horizon filler only; the city's ground is per cell
    ground.receiveShadow = true; ground.name = 'ground';
    group.add(ground);

    // sky dome (render.js may hide it and draw its own)
    const sky = buildSky(env);
    group.add(sky);

    // Mapped stadium interiors must not be cut by the artificial driving-mask boundary.
    const landmarkPlayAreas = [];
    for (const lm of landmarks) if (lm.id === 'dinamo') lm.mesh?.traverse(source => {
        const area = source.userData.footballPitch?.playArea; if (!area?.length) return;
        landmarkPlayAreas.push(area.map(([x, z]) => { const p = source.localToWorld(new THREE.Vector3(x, 0, z)); return [p.x, p.z]; }));
    });
    if (landmarkPlayAreas.length) {
        const retained = [];
        for (const w of walls) {
            if (w.kind !== 'boundary') { retained.push(w); continue; }
            const dx = w.bx - w.ax, dz = w.bz - w.az, cuts = [0, 1];
            for (const poly of landmarkPlayAreas) for (let i = 0; i < poly.length; i++) {
                const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
                if (Math.abs(den) < 1e-9) continue;
                const rx = a[0] - w.ax, rz = a[1] - w.az, t = (rx * ez - rz * ex) / den, u = (rx * dz - rz * dx) / den;
                if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
            }
            cuts.sort((a, b) => a - b);
            for (let i = 1; i < cuts.length; i++) {
                const a = cuts[i - 1], b = cuts[i], m = (a + b) / 2; if (b - a < 1e-7) continue;
                if (landmarkPlayAreas.some(p => pointInPolygon(w.ax + dx * m, w.az + dz * m, p))) continue;
                const ax = w.ax + dx * a, az = w.az + dz * a, bx = w.ax + dx * b, bz = w.az + dz * b;
                const lerp = (v0, v1, t) => v0 + (v1 - v0) * t;
                retained.push({ ...w, ax, az, bx, bz, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3,
                    y0a: lerp(w.y0a, w.y0b, a), y0b: lerp(w.y0a, w.y0b, b), y1a: lerp(w.y1a, w.y1b, a), y1b: lerp(w.y1a, w.y1b, b) });
            }
        }
        walls.splice(0, walls.length, ...retained);
    }
    // Flight includes the complete stadium model; the walking/driving opening remains the pitch play area.
    const landmarkFlightAreas = [];
    for (const lm of landmarks) if (lm.id === 'dinamo' && lm.mesh) {
        lm.mesh.updateWorldMatrix(true, true);
        const extent = new THREE.Box3().setFromObject(lm.mesh);
        if (!extent.isEmpty() && [extent.min.x, extent.min.z, extent.max.x, extent.max.z].every(Number.isFinite)) {
            landmarkFlightAreas.push({ id: lm.id, poly: [[extent.min.x, extent.min.z], [extent.max.x, extent.min.z], [extent.max.x, extent.max.z], [extent.min.x, extent.max.z]] });
        }
    }
    // ---- collision list with spatial query
    const insideDistrict = (x, z) => dmask ? !!(dmask.at(x, z) || landmarkPlayAreas.some(p => pointInPolygon(x, z, p))) : true;
    const flightBoundary = dmask ? {
        inside: (x, z) => insideDistrict(x, z) || landmarkFlightAreas.some(a => pointInPolygon(x, z, a.poly)),
        landmarkAreas: landmarkFlightAreas,
        segments: walls.filter(w => w.kind === 'boundary').map(({ ax, az, bx, bz }) => ({ ax, az, bx, bz }))
            .concat([...landmarkPlayAreas, ...landmarkFlightAreas.map(a => a.poly)].flatMap(poly => poly.map((a, i) => {
                const b = poly[(i + 1) % poly.length]; return { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
            }))),
    } : null;
    const allColl = collision.concat(collisionBoxes, propColl, pierColl, underpassColl, walls);
    const collGrid = new BoxGrid(16), collisionQueryBounds = new WeakMap();
    // Index the actual footprint. A long thin wall's bounding-circle square
    // formerly occupied whole city blocks and was visited by every walker.
    for (const b of allColl) { const box=collisionBounds(b);collisionQueryBounds.set(b,box);collGrid.insert(...box,b); }
    // A body spans several grid cells: each is reported once per query. A fresh Set per query was 6 % of the traffic step
    // (every walker asks twice a step). A query mark on the body does the same; a query started inside another one's
    // callback keeps the Set, so the outer marks are never disturbed.
    // "Is any body's box within r of this point?" Every walker asks before each step; the full query visited every body
    // of the cells around it to answer yes or no. This stops at the first one. Same answer as query() calling back at all.
    Object.defineProperty(allColl, 'anyBoxNear', { value: (x, z, r) => { // (not `some`: a plain array of bodies has that name already)
        const c = collGrid.cell, x0 = x - r, x1 = x + r, z0 = z - r, z1 = z + r;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const list = collGrid.cell_(i, j); if (!list) continue;
            for (let k = 0; k < list.length; k++) { const box = collisionQueryBounds.get(list[k]); if (box[2] >= x0 && box[0] <= x1 && box[3] >= z0 && box[1] <= z1) return true; }
        }
        return false;
    }, enumerable: false });
    let collQueryMark = 0, collQueryDepth = 0; const collQueryMarkable = allColl.every(b => Object.isExtensible(b)); // (a frozen body cannot carry the mark)
    Object.defineProperty(allColl, 'query', { value: (x, z, r, cb) => {
        if (collQueryDepth > 0 || !collQueryMarkable) { const seen = new Set(); collGrid.each(x - r, z - r, x + r, z + r, (b) => { const box=collisionQueryBounds.get(b);if (!seen.has(b) && box[2]>=x-r && box[0]<=x+r && box[3]>=z-r && box[1]<=z+r) { seen.add(b); cb(b); } }); return; }
        const mark = ++collQueryMark; collQueryDepth++;
        try { collGrid.each(x - r, z - r, x + r, z + r, (b) => { if (b._collQuery === mark) return; const box=collisionQueryBounds.get(b); if (box[2]>=x-r && box[0]<=x+r && box[3]>=z-r && box[1]<=z+r) { b._collQuery = mark; cb(b); } }); }
        finally { collQueryDepth--; }
    }, enumerable: false });

    // ---- districts / labels
    const districts = data.places.map(([n, x, z, rank]) => ({ name: str(n), x: x / 10, z: z / 10, rank }));

    // ---- spawn
    let spawn = null;
    // district: the chapter start (opts.start, else the first chapter played here) {lat, lon, heading°, road}
    const startLL = (() => { const st = opts.start || (CHAPTERS.find(c => c.city === city.id && c.district === distId) || {}).start; return st ? { lat: st.lat, lon: st.lon, road: st.road, bearing: st.heading ?? st.bearing } : null; })();
    if (startLL) {
        const sp = startLL; const q = city.proj(sp.lat, sp.lon);
        const brW = (sp.bearing ?? 0) * Math.PI / 180, wantX = Math.sin(brW), wantZ = -Math.cos(brW);
        const legalDir = (e) => sp.bearing == null || !e.oneway || e.dirx * wantX + e.dirz * wantZ > 0.2; // a one-way carriageway must run the way the chapter faces
        const flt = (e) => e.drivable && legalDir(e) && (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : sp.road ? true : !/motorway/.test(e.type)) && e.len > 15;
        const ne = nearestEdge(q.x, q.z, flt, 1500) || nearestEdge(q.x, q.z, (e) => e.drivable && e.len > 10);
        const e = ne.edge;
        const br = (sp.bearing ?? 0) * Math.PI / 180; const want = [Math.sin(br), -Math.cos(br)];
        let dir = (e.dirx * want[0] + e.dirz * want[1]) >= 0 ? 1 : -1;
        if (e.oneway) dir = 1;
        const t = clamp(ne.t, 0.15, 0.85);
        city.spawn = { edge: [e.a.id, e.b.id], t, dir };
        const lat = (e.sharedLane ? 0 : (e.median / 2 + e.laneW * 0.5) * dir) + (e.laneCenterShiftM || 0);
        spawn = { x: e.a.x + e.dirx * e.len * t + e.nx * lat, z: e.a.z + e.dirz * e.len * t + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
        spawn.y = Y.road + yAlong(e, spawn.x, spawn.z); // road surface at the spawn (the SeaTac departures drive is an elevated deck)
    }

    // ---- expose only the main strongly-connected network to routing / traffic (everything stays rendered)
    const allEdges = edges;
    const driv = edges.filter(e => e.drivable), rest = edges.filter(e => !e.drivable);
    driv.forEach((e, i) => { e.id = i; }); rest.forEach((e, i) => { e.id = driv.length + i; });
    underpassColl.forEach((c, i) => { c.sourceEdgeId = underpassCollEdges[i].id; });
    for (const n of nodeArr) if (n.edges.length) { n.allEdges = n.edges; n.edges = n.edges.filter(e => e.drivable); }
    for (const id of Object.keys(nodes)) if (!nodes[id].drivable) delete nodes[id];
    graph.edges = driv;

    setProgress(''); const phases = PHASES.splice(0);
    const stats = { hallFurniture: hallFurnitureStats, waterBridgeRailings, reviewedBridgeRailings, fasciaLayout: { records: fasciaLayoutAudit, boards: facadeBoards, scope: 'Inferred coplanar fascia boards on existing source walls; source POIs and names unchanged' }, sourceWaterTreeConflicts: { records: waterTreeConflicts.records, sourceRecordsRetained: true, marginM: 0, scope: 'Physical trunk bodies intersect detailed basins and their rendered granite rims; not canopy thinning or road/traffic change' }, parkingClearance, phases, railways: railStats, network: __buildRoadGraphAids.sccInfo, edges: edges.length, walls: walls.length, wallPiecesCut: wallCut, piers: pierColl.length, bridgeBents: bridgeBents.report, treeDeckClearance, furniture: furnCount, roadSigns: signCount, roofAds, roofAdList, backdrop: backdropCount, backdropSourceOwnership, sceneryStreets, kerbParked, marksDropped: edges.filter(e => (e._mkAll || 0) > 4 && ((e._mkDrop || 0) + (e._mkOut || 0)) / e._mkAll > 0.2).sort((p, q) => ((q._mkDrop || 0) + (q._mkOut || 0)) / q._mkAll - ((p._mkDrop || 0) + (p._mkOut || 0)) / p._mkAll).slice(0, 30).map(e => ({ name: e.name, type: e.type, id: e.id, lanes: [e.lanesF, e.lanesB], oneway: e.oneway, x: Math.round((e.a.x + e.b.x) / 2), z: Math.round((e.a.z + e.b.z) / 2), len: Math.round(e.len), cover: +((e._mkDrop || 0) / e._mkAll).toFixed(2), out: +((e._mkOut || 0) / e._mkAll).toFixed(2) })), raisedSidewalk: { pieces: __buildRibbons.raisedPieces, corners: cornerPolys.length, joins: sideJoins.size, skipped: cornerSkips }, greenQuads: __buildPaintSetup.greenQuads, fenceM: Math.round(__buildScenery.fenceM), bollards, pitchesDressed, sportAreas: sportAreaLog, fuel: fuelLog,
        buildingRoofProfiles: roofProfileAudit, profile: profileStats, buildingPassages: buildingPassageAudit, treesOSM, treesRows, heightFixes: heightFixes.length, heightFixSamples: heightFixes.slice(0, 30), buildingsShrunk: bShrunk, buildingClearance: clearanceAudit, buildingsDropped: bDropped, buildingsCovered: coveredOutlines, buildingAssemblies: assemblyAudit, buildingAssembliesRejected: assemblyRejected, buildingUnions: physicalUnionAudit, buildingUnionsRejected: physicalUnionRejected, inferredBuildingDetails: inferredDetailAudit, landmarkSourceReplacements, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, lampsInWater: __buildStreetFurniture.lampsWet, shoreTris: Math.round(shoreTris), vacantUnits, channelM: Math.round(channelM), unitSigns, unitSignSpots: signedSpots.slice(0, 40).map(q => q.map(v => Math.round(v))), crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(__buildFinalMeshes.tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    stats.scenerySource = scenerySourceAudit;
    stats.backdropInLandmark = backdropInLandmark;
    stats.treeBuildingClearance = treeBuildingClearance;
    stats.floatingSupport = { parts: floatingSupport.parts, columns: floatingSupport.columns, grounded: floatingSupport.grounded || 0 };
    stats.medianFill = { quads: medianFill.quads, areaM2: medianFill.areaM2, grass: medianFill.decks.filter(d => d.medianKind === 'grass').length, concrete: medianFill.decks.filter(d => d.medianKind === 'concrete').length, asphalt: medianFill.decks.filter(d => d.medianKind === 'asphalt').length };
    stats.fallbackGround=null; // (set when the fallback ground is placed: world.ready)
    stats.districtBoundary = boundarySupport.report;
    stats.transitShelters = { schema: 1, records: transitShelterAudit, withheldUnknown: transitShelterAudit.filter(r => r.status === 'unknown-shelter-geometry').length, literalNo: transitShelterAudit.filter(r => r.status === 'literal-no-shelter').length, legacyUnreviewed: transitShelterAudit.filter(r => r.status === 'legacy-unreviewed').length, limits: 'Inferred generic-unit decisions only; no real shelter absence, mapped geometry removal or constructor/route clearance acceptance.' };
    stats.waterShore = waterShoreAudit;
    stats.waterChannels = waterChannelAudit;
    stats.waterLines = waterLineAudit;
    stats.tramGrades = tramGrades.report;
    stats.railRoadside = railRoadside.report;
    stats.bridgeJunctions = bridgeJunctionAudit;
    stats.tramTrench = tramTrench.report;
    stats.tramPropEnvelope = tramPropEnvelope;
    stats.tramSweep = tramSweep ? { ...tramSweep.report, conflicts: tramSweepConflicts } : null;
    stats.tramRailings = tramRailings;
    stats.monuments = monuments; stats.playgrounds = playgrounds; stats.carParkFronts = carParkFronts; stats.parkWalls = parkWalls; stats.deckLamps = deckLamps; stats.facadeBands = facadeBands; stats.treeAdditions = treeAdditions; stats.weirs = weirs; stats.medianLinkSidewalks = medianLinkSidewalks;
    stats.fuelForecourts = fuelForecourts;
    stats.landmarkWaterFootprints = landmarkWaterFootprints;
    stats.trenchGroundCuts = { corridors: trenchQuads.length, channelWaterTriangles: channelCuts.length, triangles: trenchCutTris }; // (ground layers cut out of open trenches and sunken water channels)
    stats.trenchGoreCuts = trenchGoreCuts; // (#59: trench wall sides stopped at another sunken ramp)
    stats.buildingOverlapCuts = overlapCuts; // (world-space basin outlines: audits of what stands in or over them)
    stats.buildingOutlineParts = outlineParts; // (style-estimated outlines left undrawn in favour of the tagged volumes inside them)
    stats.bridgeGuardCompletion = guardCompletion; stats.railingNetwork = railingNetwork; stats.railingDrops = railingDrops;
    stats.elevatedSources = elevatedSources.report; stats.areaFences = areaFences; stats.underpassMouths = underpassMouths; stats.entranceCanopies = entranceCanopies; stats.pedestrianBridges = pedestrianBridges;
    stats.basarabLamps = basarabLamps;
    stats.barrierJoins = walls.barrierJoins || null;
    stats.coveredRoadModels = coveredRoadModels.report;
    stats.underpassRoofs = { estimated: true, ownerIndex: underpassOwners.report, roofTriangles: underpassCover.ic / 3, colliders: underpassColl.length,
        models: underpassRoofAudit.map(({ edge, ...record }) => ({ ...record, edgeId: edge.id })) };
    stats.sidewalkSource = { explicitEdges: edges.filter(e => e.sidewalkSource.explicit).length,
        directionalEdges: edges.filter(e => e.sidewalkRightM !== e.sidewalkLeftM).length,
        unresolved: edges.filter(e => e.sidewalkSource.unresolved).map(e => ({ edge: e.id, sourceId: e.sidewalkSource.sourceId, reason: e.sidewalkSource.unresolved })) };
    console.info('[world]', city.id, stats);

    /** calls cb(height) for every drivable surface (carriageway + shoulder + sidewalk, junction pads) covering (x, z) */
    function surfacesAt(x, z, cb, prefer = null, carriagewayOnly = false, exclude = null) {
        let seen = null; // (made for the first edge near enough: four in five that the grid cells hold are not)
        sceneryDeckGrid.each(x, z, x, z, deck => { if (pointInPolygon(x, z, deck.poly)) cb(deck.roofHeightAt(x, z),false,deck); });
        if (!carriagewayOnly && cornerPolys.length) { // a raised junction corner: the only surface there (cb(h, raised))
            let hc = null; cornerGrid.each(x, z, x, z, (cp) => { if (hc === null && x >= cp.x0 && x <= cp.x1 && z >= cp.z0 && z <= cp.z1 && pointInPolygon(x, z, cp.p)) hc = Y.road + Y.kerb + padHeightAt(cp.n, x, z); });
            if (hc !== null && !onRibbon(x, z, 0, RIB_ONLY)) { cb(hc, true); return; }
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
                const lim = (side > 0 ? e.wR : e.wL) + shoulderOf(e) + (carriagewayOnly ? 0 : sidewalkWidth(e, side) + (raisedEdge(e, side) ? SIDE_BACK : 0.05)) + (e === prefer ? 1.5 : 0);
                if (q.d > lim) continue;
                if ((q.t <= 0 || q.t >= 1) && Math.hypot(x - (q.t <= 0 ? e.a.x : e.b.x), z - (q.t <= 0 ? e.a.z : e.b.z)) > (q.t <= 0 ? e.a : e.b).radius + (carriagewayOnly ? 0 : 1)) continue;
                const h = Y.road + yAlong(e,x,z);
                if (!carriagewayOnly && q.t > 0 && q.t < 1 && raisedEdge(e, side) && q.d > widthAsphalt(e, side) + 0.02 && !onRibbon(x, z, 0, RIB_ONLY)) { const sh = railRoadside.surface(e, x, z, h + Y.kerb); if (sh !== null) cb(sh, sh > h + .01); continue; } // source-rail flush paving follows rendered h
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
                box[o + 4] = base + (Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) + SIDE_BACK); box[o + 5] = base + 0; box[o + 6] = e.virtual ? 1 : 0;
            });
            out.set(key, { list, box });
        }
        return out;
    }

    const world = {
        camera: null, // optional: set to the main camera for distance culling (auto-detected otherwise)
        group, graph, buildings: allColl, pois, lights, nodeLight, bounds, nearestEdge, edgesInBox, isWater, isPark, waterMesh, sky,
        districts, areas, landmarks, trams, stats, data, spawn, city, allEdges,
        tramGrade: tramGrades.resolveGrade, tramDecks, tramDeckSupportAt, bridgeBents: bridgeBents.bents, basarabStructure: basarabStructure.report, sidewalkWidth, sourceBridgeProfile:sharedBridgeProfile.report, sourceBridgeMeshAudit:sharedBridgeMeshAudit,
        sideExtra, // extra right-side carriageway width at a distance along an edge (lane-drop tapers): the sidewalk lies that much further out
        generatedParapetOwnership:{report:parapetOwnership.report,caps:parapetOwnership.pieces.map(({id,top,heightM,owner,box})=>({id,top,heightM,owner,box}))},
        /** placed trees {x, z, species, con, kind} (read-only; QA detectors) */
        treeSpots: treeList,
        /** chapters: the loaded district {id, name, label, bbox, center, landmarks, congestion, areaKm2, ends:[{x,z,node,edge}] (road-closed
         *  barriers where roads leave the map; node.mapEnd = true), inside(x, z) (the drivable area)} */
        district: { id: distId, ...distCfg, areaKm2: data.district?.areaKm2, ends: mapEnds, mask: dmask, inside: insideDistrict, flightBoundary },
        /** district edge closures (spec R10.9) {x, z, heading, edge, node, kind: 'small'|'boulevard'|'highway', leadsTo: districtId|null}; also walls of kind 'closure' (soft) */
        closures,
        /** x/z scale of the world relative to reality (Bucharest 0.7, Seattle 0.5); lane widths, heights, vehicles are real size */
        scale: data.proj.scale,
        /** street lamps {x, z, h, rot, y, osm} and the instanced meshes (heads: MeshStandardMaterial, emissive turned on at night by render.js) */
        lamps, lampPostMesh, lampHeadMesh,
        /** dev check: edges whose ribbon runs into a building footprint, and dead ends that stop within 15 m of another road */
        devCheck() {
            const blocked = [], deadEnds = [];
            for (const e of allEdges) {
                if (e.tunnel || e.layer < 0 || e.virtual) continue; // virtual U-turn connectors have no carriageway
                for (let t = 0.1; t < 0.95; t += 0.2) for (const o of [0, e.wR * 0.7, -e.wL * 0.7]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                    const roadY = Y.road + yAlong(e,x,z);
                    let hit = null; allColl.query(x, z, 0.5, (c) => { if (!hit && buildingBlocksRoad(c, x, z, roadY)) hit = c; });
                    if (hit) { blocked.push({ edge: e.id, name: e.name, x: Math.round(x), z: Math.round(z) }); t = 2; break; }
                }
            }
            for (const n of nodeArr) {
                if (!n.drivable || n.edges.length !== 1) continue;
                if (n.x < bx0 + 150 || n.x > bx1 - 150 || n.z < bz0 + 150 || n.z > bz1 - 150) continue; // map border
                const own = n.edges[0];
                const ne = nearestEdge(n.x, n.z, (e) => e !== own && e.a !== n && e.b !== n && e.a !== (own.a === n ? own.b : own.a) && e.b !== (own.a === n ? own.b : own.a), 15);
                if (ne && ne.d < 15) deadEnds.push({ node: n.id, name: own.name, d: +ne.d.toFixed(1), x: Math.round(n.x), z: Math.round(n.z) });
            }
            return { network: __buildRoadGraphAids.sccInfo, blocked: blocked.length, deadEnds: deadEnds.length, samples: { blocked: blocked.slice(0, 10), deadEnds: deadEnds.slice(0, 10) } };
        },
        /**
         * Height (metres) of the drivable surface top at (x, z): 0.24 + the vertical profile (bridges / ramps / tunnels).
         *   roadHeight(x, z)                    → the LOWEST road surface at (x, z) (ground 0.24 off-road)
         *   roadHeight(x, z, { y, edge })       → only surfaces within 2.5 m of `y` (the body's current height) count, the
         *                                         closest one wins (a car under a bridge never snaps up onto it, a car on
         *                                         the deck never drops through it); off-road / no match → 0.24
         *   roadHeight(x, z, edge)              → legacy: that edge's profile at (x, z)
         * The surface includes sidewalks and junction pads.
         */
        /** top of the raised sidewalk at (x, z) or null — where walkers' feet go (traffic crowd) */
        // Exact-coordinate bounded cache, populated only after construction.
        // Static sidewalk geometry has no time/weather dependence.
        // (cached by x, then z: Map keys compare as the former 'x,z' string keys did; the last 4096 points are kept)
        walkTop: (()=>{const cache=new Map(),kx=new Float64Array(4096),kz=new Float64Array(4096),used=new Uint8Array(4096);let next=0;return(x,z)=>{let row=cache.get(x);if(row!==undefined){const cached=row.get(z);if(cached!==undefined)return cached;}const top=raisedTop(x,z);if(used[next]){const r=cache.get(kx[next]);if(r!==undefined){r.delete(kz[next]);if(!r.size)cache.delete(kx[next]);}}kx[next]=x;kz[next]=z;used[next]=1;next=(next+1)&4095;row=cache.get(x);if(row===undefined)cache.set(x,row=new Map());row.set(z,top);return top;};})(),
        /** floor of a sunk landmark's pit at (x, z) (negative metres), or 0 outside every pit */
        pitFloorAt(x, z) { for (const pit of landmarkPits) if (pointInPolygon(x, z, pit.ring)) return pit.floorY; return 0; },
        roadHeight(x, z, opts = null) {
            if (opts && opts.a && opts.b && opts.len) return Y.road + yAlong(opts, x, z); // legacy (edge)
            const y = opts && typeof opts.y === 'number' ? opts.y : null;
            let best = null, bd = Infinity;
            surfacesAt(x, z, (h) => {
                if (y === null) { if (h < bd) { bd = h; best = h; } return; }
                const d = Math.abs(h - y); if (d <= 2.5 && d < bd) { bd = d; best = h; }
            }, opts && opts.edge);
            return best ?? Y.road;
        },
        /** all drivable surface heights at (x, z) (array, ascending) */
        surfacesAt(x, z) { const hs = []; surfacesAt(x, z, (h) => hs.push(h)); return hs.sort((p, q) => p - q); },
        /** invisible collision walls {ax, az, bx, bz, y0a, y1a, y0b, y1b, nx, nz, kind: rail|embank|trench|guard, edge} (also in world.buildings) */
        walls,
        /** carriageway polygons {e | node, poly}, and the ribbon test used by every placement: onRibbon(x, z, r) → ribbon | null */
        ribbons, onRibbon, boundarySupport,
        /**
         * Traffic density multiplier for a local hour (0–24, fractional ok), from the city's daily curve
         * (city.traffic.hourly, TomTom-style: RO peaks 07–10 / 16–19 ×1.6, 22–05 ×0.25; US lower).
         * opts: { cls: highway class → per-class weight (city.traffic.classWeights), weekend: true → weekend curve }.
         */
        trafficProfile(hourLocal, opts = {}) {
            const T = city.traffic || {};
            const tab = (opts.weekend && T.hourlyWeekend) || T.hourly; if (!tab) return 1;
            const h = ((hourLocal % 24) + 24) % 24, i = Math.floor(h), f = h - i;
            const m = tab[i] * (1 - f) + tab[(i + 1) % 24] * f;
            const w = opts.cls ? (T.classWeights?.[opts.cls] ?? 1) : 1;
            return Math.max(0.05, 1 + (m - 1) * w);
        },
        /** seasons / weather hooks: tree crown InstancedMeshes (+ per-instance deciduousMask, instanceColor), own material instances */
        vegetation,
        /**
         * Automated checks for the harness. Returns counts + samples (positions in world metres):
         *   props      collision props (trees, lamps, posts, shelters, furniture, parked cars, piers, landmark boxes, backdrop) on a carriageway
         *   buildings  footprints overlapping a carriageway / junction pad
         *   walls      wall pieces that cut across another carriageway at the same level
         *   lamps      lamp posts standing in the carriageway
         *   cliffs     (a) two drivable surfaces overlapping with a 0.4–4.5 m step, (b) raised / sunken carriageway edges without a wall
         *   doors      CV / interactive POI doors farther than 4 m from a drivable carriageway
         */
        audit(opts = {}) {
            const max = opts.max ?? 25;
            const out = { props: [], buildings: [], walls: [], lamps: [], cliffs: [], doors: [] };
            const R = (v) => Math.round(v * 10) / 10;
            for (const b of allColl) {
                if (b.roadDeck) continue; // passive source road surface, not a building or road obstruction
                if (b.wall) {
                    if (b.kind === 'closure' || b.kind === 'boundary') continue; // map edge: across the road on purpose
                    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
                        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
                        if (blocksLane(b, x, z, t)) { const rb = onRibbon(x, z, 0, (r) => r.e !== b.edge); out.walls.push({ kind: b.kind, road: b.edge?.name || b.sourceId || b.kind, x: R(x), z: R(z), other: rb?.e ? rb.e.name : 'junction' }); break; }
                        continue;
                        const yw = Y.road + yAlong(b.edge,x,z); // its road's level here
                        // (a wall between two parallel carriageways at different levels is a separation / median wall: fine)
                        const wl = Math.hypot(b.bx - b.ax, b.bz - b.az) || 1, wdx = (b.bx - b.ax) / wl, wdz = (b.bz - b.az) / wl;
                        const rb = onRibbon(x, z, 0.05, (r) => {
                            if (r.e === b.edge || r.node === b.edge.a || r.node === b.edge.b || (r.e && (r.e.a === b.edge.a || r.e.b === b.edge.b || r.e.a === b.edge.b || r.e.b === b.edge.a))) return false;
                            const dh = Math.abs((r.e ? yAlong(r.e,x,z) : r.node.y) + Y.road - yw);
                            const parallel = r.e && Math.abs(r.e.dirx * wdx + r.e.dirz * wdz) > 0.85;
                            return dh < 0.3 || (dh < 0.45 && !parallel);
                        });
                        if (rb) { out.walls.push({ kind: b.kind, road: b.edge.name, x: R(x), z: R(z), other: rb.e ? rb.e.name : 'junction' }); break; }
                    }
                } else if (b.poly) {
                    const rb = polyOnRibbon(b.poly);
                    if (rb) out.buildings.push({ x: R(b.x), z: R(b.z), road: rb.e ? rb.e.name : 'junction', poi: b.poi?.id });
                } else {
                    if (b.kind === 'closure') continue; // district-edge roadworks: on the road on purpose
                    const rb = b.hw === b.r ? onRibbon(b.x, b.z, b.r) : polyOnRibbon(obbPoly(b), b.yMax !== undefined ? (r) => r.y < b.yMax - 0.5 : null);
                    if (rb) out.props.push({ kind: b.kind || 'prop', x: R(b.x), z: R(b.z), r: R(b.r), road: rb.e ? rb.e.name : 'junction' });
                }
            }
            for (const l of lamps) if (onRibbon(l.x, l.z, 0.12)) out.lamps.push({ x: R(l.x), z: R(l.z), osm: l.osm });
            // cliffs: walk along both edges of every drivable ribbon; just outside it, emulate a car leaving the road
            // (roadHeight with y = this road's height). If the surface it lands on differs by > 0.45 m and no wall
            // stops it there, it is a cliff (a drop off a deck / into a trench, or a step onto a parallel road).
            const wallBetween = (x0, z0, x1, z1, y) => { // a wall (active at height y) crossing the segment p0 → p1
                let f = false;
                collGrid.each(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (w) => {
                    if (f || !w.wall) return;
                    if (!segsCross([x0, z0], [x1, z1], [w.ax, w.az], [w.bx, w.bz]) && distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).d > 1.0) return;
                    const t = distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).t;
                    if (y >= w.y0a + (w.y0b - w.y0a) * t - 0.3 && y <= w.y1a + (w.y1b - w.y1a) * t) f = true;
                });
                return f;
            };
            for (const e of edges) {
                if (e.virtual || !e.drivable) continue;
                const t0 = 0, t1 = 1;
                let found = false;
                for (let t0i = t0; t0i <= t1 + 1e-6 && !found; t0i += Math.max(0.02, 1.5 / e.len)) {
                    const t = Math.min(t0i, t1);
                    const own = Y.road + yAlong(e,e.a.x+e.dirx*e.len*t,e.a.z+e.dirz*e.len*t);
                    for (const s of [1, -1]) {
                        const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s)) + 0.6;
                        const x = e.a.x + e.dirx * e.len * t + e.nx * off * s, z = e.a.z + e.dirz * e.len * t + e.nz * off * s;
                        const land = this.roadHeight(x, z, { y: own });
                        const ix = e.a.x + e.dirx * e.len * t + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * t + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                        if (Math.abs(land - own) <= 1.0 || wallBetween(ix, iz, x, z, own)) continue; // ≤ 1 m: a bump the car's surface smoothing takes
                        out.cliffs.push({ kind: Math.abs(own - Y.road) > 0.45 ? 'edge' : 'step', road: e.name, from: R(own), to: R(land), x: R(x), z: R(z) }); found = true; break;
                    }
                }
            }
            for (const p of pois) {
                if (!p.interactive || p.doorX === undefined) continue;
                const ne = nearestEdge(p.doorX, p.doorZ, (e) => e.drivable && !e.virtual, 200);
                const lim = ne ? (((p.doorX - ne.cx) * ne.edge.nx + (p.doorZ - ne.cz) * ne.edge.nz) >= 0 ? ne.edge.wR : ne.edge.wL) + 4 : 0;
                if (!ne || ne.d > lim) out.doors.push({ id: p.id, x: R(p.doorX), z: R(p.doorZ), d: ne ? R(ne.d) : null });
            }
            const res = { ok: !out.props.length && !out.buildings.length && !out.walls.length && !out.lamps.length && !out.cliffs.length && !out.doors.length, counts: {} };
            for (const k in out) { res.counts[k] = out[k].length; res[k] = out[k].slice(0, max); }
            res.counts.wallsTotal = walls.length; res.counts.collisionItems = allColl.length;
            return res;
        },
        lampsNear(x, z, r, cb) { lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (Math.hypot(l.x - x, l.z - z) <= r) cb(l); }); },
        /** phase state helper: returns 'green' | 'yellow' | 'red' for an approach edge entering node */
        lightState(nodeId, edge, time, cycle) {
            const l = nodeLight[nodeId]; if (!l) return 'green';
            const ap = l.approaches.find(a => a.edge === edge); if (!ap) return 'red';
            return signalState(l.node.lightCluster, ap.phase, time, cycle);
        },
        updateLights(time, cycle) {
            let dirty = false;
            for (const l of lights) {
                for (const ap of l.approaches) {
                    const st = this.lightState(l.node.id, ap.edge, time, cycle);
                    if (st === ap.state) continue;
                    ap.state = st; dirty = true;
                    tmpM.makeTranslation(ap.x, ap.y + LAMP_Y[st], ap.z);
                    lampMesh.setMatrixAt(ap.lamp, tmpM); lampMesh.setColorAt(ap.lamp, LAMP_COL[st]);
                }
            }
            if (dirty) { lampMesh.instanceMatrix.needsUpdate = true; if (lampMesh.instanceColor) lampMesh.instanceColor.needsUpdate = true; }
        },
    };
    void renderer;
    world.ready = fallbackReady.then(fallback => { stats.fallbackGround = fallback.report; });
    if (!opts.deferGround) await world.ready;
    return world;
}

export { buildingBlocksRoad, collisionBounds, collideOne, collideBuildings } from './world-collide.js';
