import { fitFacadeSign, facadeSignBoard } from './facade-sign-layout.js';
import { sourceWaterTreeConflicts } from './source-water-tree-conflicts.js';
import { emitStreetLevelWaterBridgeRailings } from './water-bridge-railings.js';
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
import { makeTextures, emitFacadeSlab } from './buildings.js';
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
import { makeVehicle, CAR_COLORS, makeParkedCars, vehicleSize } from './vehicles.js';
import { projector, CHAPTERS } from './cities.js';
import { STOPS } from './data.js';
import { MeshBuilder, rgb, shadeRgb, prep, mergeProps, bakeProp, UNIT_BOX } from './geobuild.js';
import { treeGeometries, SPECIES, defaultSpecies, buildSpeciesTrees, speciesFromOSM } from './trees.js';
import { assignSignalPhases, signalState } from './signals.js';
import { aircraftBody } from './building-aircraft.js';
import { resolveParkingLayout, parkingRowPose, parkingPolygonsOverlap, parkingBodyOverlap } from './parking-layout.js';
import { passageSolids, clipPassageWall, passageInterior, passageBaseUnknown } from './building-passages.js';
import { scenerySourceProfile } from './scenery-source.js';
import { sceneryBridgeProfiles, sceneryDeckBand } from './scenery-bridges.js';
import { batchWaterChunks } from './water-batch.js';
import { cullMergedCells } from './cell-frustum.js';
import {fallbackGroundApertures,buildFallbackGround,buildFallbackGroundParallel} from './fallback-ground.js';
import {backdropSourceOwner} from './backdrop-source-owner.js';
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
import { basarabEdge, buildBasarabStructure, drawBasarabGuard, bridgeBeam } from './basarab-structure.js';
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
import { FACADE_DETAIL_GLSL } from './facade-detail.js';
import { subtractConvex } from './building-overlap.js';
import { emitMonuments } from './monuments.js';
import { channelProfile } from './water-channel-review.js';
import { carParkOf, carParkLevels, emitCarParkWall, reviewedCarParkHeight } from './car-parks.js';
import { emitFuelForecourt } from './fuel-forecourt.js';
import { emitBellevueGuideway } from './bellevue-guideway.js';
import { emitSeatacGuideway } from './seatac-guideway.js';
import { buildElevatedSources, planElevatedSources } from './elevated-sources.js';
import { openRuns, weldEnds } from './deck-outline.js';
import { applyBuildingReview } from './building-review.js';
import { emitWorshipOpenings, worshipHasTowerTag } from './worship.js';
import { pavedReviewAreas } from './ground-review.js';
import { reviewedGradeK } from './grade-review.js';
import { emitAirportForecourt } from './airport-forecourt.js';
import { applyFuelCanopyReview } from './fuel-canopy-review.js';
import { PEDESTRIAN_FRONTS } from './pedestrian-fronts.js';
import { bridgeGuardRow, emitBridgeGuard, guardBlockH, emitGuardSteel, GUARD_CONCRETE } from './bridge-guards.js';
// (spec 10 load budget) start the build workers now, so they are loaded before the first district is built
try { if (typeof window !== 'undefined') sharedBuildPool(); } catch (e) { /* no workers: buildWorld runs everything here */ }
// (spec 10 load budget) the modules buildWorld imports on demand are fetched and compiled while the page is idle; a build
// awaits the same import (a failed prefetch is retried there, as before)
const lazyModule = (load) => { let p = null; if (typeof window !== 'undefined') { p = load(); p.catch(() => {}); } return () => (p ? p.catch(load) : load()); };
const landmarksModule = lazyModule(() => import('./landmarks.js')), archetypesModule = lazyModule(() => import('./archetypes.js'));

// ============================================================================
//  WORLD — builds the 3D city from OpenStreetMap data (game/data/<city>.json,
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

const CELL = 250;
// layering heights (metres) — every flat layer has its own height to avoid z-fighting
const Y = { landuse: 0.02, grass: 0.045, forest: 0.06, park: 0.07, pitch: 0.095, parking: 0.095, water: 0.11, ballast: 0.2, side: 0.15, road: 0.24, layer: 0.09, mark: 0.03, kerb: 0.13 };
const TILE = { interwar: 0, eclectic: 1, civic: 2, bloc: 3, glass: 4, house: 5, shop: 6, plain: 7, church: 7 }; // (church: plain wall, the tall arched openings are geometry: worship.js)
/** window grid (columns × rows) drawn in each facade atlas tile: wall UVs are divided by it so one window column = one
 *  bay (≈ 2.4–3.6 m) and one window row = one storey (the tiles hold 2 storeys and 2–4 bays: without this the windows
 *  came out at half / a quarter of their real size — the "tiny window dots") */
const TILE_GRID = { 0: [2, 2], 1: [3, 2], 2: [4, 2], 3: [4, 2], 4: [4, 2], 5: [3, 1], 6: [1, 1], 7: [1, 1], 8: [3, 2], 9: [3, 2], 10: [2, 2], 11: [4, 2], 12: [2, 4], 13: [2, 1], 14: [1, 1], 15: [4, 1] };
const GRASSY = new Set(['park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'turf']);
const SPORT_KINDS = new Set(['pitch', 'turf', 'clay', 'hard', 'track']); // (drawn in the 'sport' ground layer)
const PAVED = new Set(['parking', 'apron', 'runway', 'clay', 'hard', 'pool']); // (courts / pools over the park or yard they sit in; track stays in the first-drawn area layer, under its infield pitch)
const AREA_Y = { track: Y.pitch - 0.012, clay: Y.pitch + 0.004, turf: Y.pitch, hard: Y.pitch + 0.004, pool: Y.pitch + 0.006, yard: Y.landuse + 0.01, residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
const TRAFFIC_MUL = { motorway: 0.6, motorway_link: 0.3, trunk: 1.2, trunk_link: 0.35, primary: 1.8, primary_link: 0.4, secondary: 1.3, secondary_link: 0.3, tertiary: 0.9, tertiary_link: 0.25, residential: 0.3, unclassified: 0.35, living_street: 0.08, service: 0.04 };
const CLASS_RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, motorway_link: 4, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3, unclassified: 2, residential: 2, living_street: 1 };

const PALETTES = {
    RO: {
        interwar: ['#ecebe6', '#e7dfca', '#d2d0cb', '#f1ece1', '#dcd6c8', '#e2d6bf', '#c9c6be'],
        // 19th-c. plasters: cream, ochre, pale yellow, salmon / pink, light grey, sage, weathered white
        eclectic: ['#e8d7b0', '#d9b46a', '#ecd98e', '#e3a98c', '#e0b2a8', '#c9c7c2', '#b9c2a3', '#e6e2d8', '#d7c09a', '#cf9c7c'],
        civic: ['#efe9db', '#e8e1cf', '#f3eee3', '#e4dccb'],
        // grey / beige panels, about a third repainted in pastel thermal insulation (ochre, peach, light green, blue)
        bloc: ['#b9b5aa', '#c7c2b6', '#a9a69d', '#d1cdc3', '#bcb3a4', '#d8cfb8', '#c9b79c', '#d9b25f', '#e8b394', '#b9cf9a', '#a9c3d6', '#e3c98a'],
        glass: ['#5b86a8', '#6f9bbd', '#4d7593', '#6e9a96', '#3d5e78', '#8fa3ad', '#2f4a60', '#7d8f99'],
        house: ['#f1e8d4', '#ebdfc6', '#f6efe0', '#e3d6bd', '#dcd2c0', '#efd9b5', '#e8c9a8'],
        shop: ['#e3e3e0', '#d6d8da', '#eeeeee', '#e8e2d4'],
        plain: ['#a8a59f', '#9a9ea2', '#b5b1a8', '#c2bdb2', '#8d9194'],
        church: ['#efe6d2', '#e8dcc4', '#f4eee2'],
    },
    US: {
        interwar: ['#9e4f3a', '#8c4a36', '#b0654a', '#c9c3b8', '#a9a49b', '#7f4634'], // brick low-rise + concrete
        eclectic: ['#b98d6a', '#a7795a', '#c7a07f', '#9e4f3a'],
        civic: ['#d8d4cc', '#c9c5bd'],
        bloc: ['#c8c2b4', '#a9b4b8', '#d9cfb9', '#9fb0b8', '#b7a99a', '#e0d6c3', '#8e9ea6'],
        glass: ['#5b7f99', '#6a8a8a', '#45657d', '#9aa6ad', '#3a556b', '#7f9a96', '#2c4356', '#8d9399'], // blue-green, grey, silver
        house: ['#d8d2c4', '#c9cfd3', '#e6e1d6', '#b7c1c9', '#cbbfae', '#9fb0b8', '#e0d6c3', '#a7b59c', '#c4a98a'],
        shop: ['#d9d4c8', '#cfd2d4', '#e6e2da', '#b9b1a3'],
        plain: ['#9a9ea2', '#8d9194', '#a7abae', '#b5b1a8'],
        church: ['#d8d2c4', '#c9c3b8'],
    },
};
const VILLA_PAL = ['#ead9b0', '#e6c98a', '#f0e3c2', '#e8c3a4', '#e2b9a8', '#efe9dc', '#d8d0bc', '#dcc79a', '#f2ead6', '#c9d2b8', '#e9d29c', '#f3efe6'];
const ROOF_COL = { RO: { pitched: ['#8a4b36', '#9c5a3c', '#6d5a4e', '#7a3f2e', '#5a5e63'], flat: ['#6f6c67', '#7a7670', '#8a8075', '#5f5d59', '#3d3b39', '#8c8f92'] }, US: { pitched: ['#4a4e55', '#5e5a55', '#3f4348', '#6b5f55', '#53504c'], flat: ['#6b6f73', '#5c6062', '#7a7d80'] } };

// brand → [background, foreground, accent]
const BRANDS = {
    "mcdonald's": ['#da291c', '#ffc72c', '#ffc72c'], 'kfc': ['#a3080c', '#ffffff', '#ffffff'], 'starbucks': ['#00704a', '#ffffff', '#ffffff'],
    'mega image': ['#e4572e', '#ffffff', '#ffd200'], 'shop&go': ['#e30613', '#ffffff', '#ffffff'], 'carrefour': ['#004e9f', '#ffffff', '#e2001a'],
    'lidl': ['#0050aa', '#fff000', '#e60a14'], 'kaufland': ['#e10915', '#ffffff', '#ffffff'], 'profi': ['#e2001a', '#ffffff', '#ffffff'],
    'penny': ['#cd1414', '#fff200', '#fff200'], 'auchan': ['#e2001a', '#ffffff', '#5ab031'],
    'petrom': ['#004b93', '#ffd200', '#ffd200'], 'omv': ['#00539f', '#ffffff', '#009a44'], 'mol': ['#e2001a', '#ffffff', '#00843d'],
    'rompetrol': ['#f39200', '#ffffff', '#1d3c82'], 'lukoil': ['#e30613', '#ffffff', '#ffffff'], 'socar': ['#0057a8', '#ffffff', '#e30613'],
    'catena': ['#e2001a', '#ffffff', '#ffffff'], 'sensiblu': ['#0e7a3c', '#ffffff', '#ffffff'], 'dr. max': ['#00529c', '#ffffff', '#e30613'],
    'help net': ['#e30613', '#ffffff', '#ffffff'], 'bcr': ['#00468c', '#ffffff', '#ffffff'], 'brd': ['#111111', '#ffffff', '#e2001a'],
    'ing': ['#ff6200', '#ffffff', '#ffffff'], 'raiffeisen': ['#fff200', '#111111', '#111111'], 'banca transilvania': ['#003d7c', '#ffffff', '#fcd116'],
    'cec bank': ['#00543c', '#ffffff', '#ffffff'], 'unicredit': ['#e2001a', '#ffffff', '#ffffff'], "ted's coffee": ['#5a3825', '#ffffff', '#c8a26b'],
    '5 to go': ['#ffde00', '#111111', '#111111'], 'subway': ['#008c15', '#ffc600', '#ffc600'], 'burger king': ['#d62300', '#f5ebdc', '#ffaa00'],
    'shell': ['#ffd500', '#dd1d21', '#dd1d21'], 'chevron': ['#0054a4', '#ffffff', '#e2231a'], '76': ['#f47920', '#0055a5', '#0055a5'],
    'arco': ['#0068b4', '#ffffff', '#e2231a'], 'safeway': ['#e31837', '#ffffff', '#ffffff'], 'qfc': ['#003da5', '#ffffff', '#e31837'],
    'costco': ['#e31837', '#ffffff', '#005daa'], 'amazon': ['#232f3e', '#ff9900', '#ff9900'], 'whole foods': ['#00674b', '#ffffff', '#ffffff'],
    'bank of america': ['#012169', '#ffffff', '#e31837'], 'chase': ['#117aca', '#ffffff', '#ffffff'], 'wells fargo': ['#d71e28', '#ffcd41', '#ffcd41'],
    'walgreens': ['#e31837', '#ffffff', '#ffffff'], 'cvs': ['#cc0000', '#ffffff', '#ffffff'], 'bartell': ['#c8102e', '#ffffff', '#ffffff'],
    'target': ['#cc0000', '#ffffff', '#ffffff'], "trader joe's": ['#c8102e', '#ffffff', '#ffffff'], 'taco bell': ['#702082', '#ffffff', '#ffffff'],
    "wendy's": ['#e2203d', '#ffffff', '#ffffff'], 'jack in the box': ['#e30613', '#ffffff', '#ffffff'], 'dutch bros': ['#00468b', '#ffffff', '#ffffff'],
    'bp': ['#007f00', '#ffffff', '#ffe600'], 'valero': ['#003c71', '#ffffff', '#f7a800'], 'dm': ['#002878', '#ffffff', '#ffd600'],
    'orange': ['#111111', '#ff7900', '#ff7900'], 'vodafone': ['#e60000', '#ffffff', '#ffffff'], 'luca': ['#7a1e2c', '#ffffff', '#e8c07a'],
    'paul': ['#111111', '#ffffff', '#c8a26b'], 'mesopotamia': ['#7a1e2c', '#ffffff', '#ffffff'], 'spartan': ['#0b4f2c', '#ffffff', '#ffffff'],
};
const KIND_STYLE = {
    fuel: { bg: '#1f2937', fg: '#ffffff', icon: '⛽', color: '#0ea5e9' }, food: { bg: '#b91c1c', fg: '#ffffff', icon: '🍔', color: '#ef4444' },
    shop: { bg: '#ea580c', fg: '#ffffff', icon: '🛒', color: '#f97316' }, bank: { bg: '#1e3a8a', fg: '#ffffff', icon: '🏦', color: '#3b82f6' },
    pharmacy: { bg: '#15803d', fg: '#ffffff', icon: '💊', color: '#22c55e' }, metro: { bg: '#1d4ed8', fg: '#ffffff', icon: 'Ⓜ', color: '#2563eb' },
    busstop: { bg: '#0f766e', fg: '#ffffff', icon: '🚌', color: '#14b8a6' }, hospital: { bg: '#dc2626', fg: '#ffffff', icon: '🏥', color: '#dc2626' },
    landmark: { bg: '#44403c', fg: '#ffffff', icon: '🏛', color: '#78716c' }, park: { bg: '#166534', fg: '#ffffff', icon: '🌳', color: '#16a34a' },
    hotel: { bg: '#4b5563', fg: '#ffffff', icon: '🏨', color: '#6b7280' }, school: { bg: '#5b21b6', fg: '#ffffff', icon: '🎓', color: '#8b5cf6' },
    airport: { bg: '#111827', fg: '#ffffff', icon: '✈', color: '#111827' }, office: { bg: '#1f2937', fg: '#ffffff', icon: '🏢', color: '#f97316' },
};
let RESEARCH_BRANDS = {}; // per loaded map: data.brands (sign colours from the field research)
const brandStyle = (name) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (RESEARCH_BRANDS[k]) return RESEARCH_BRANDS[k];
    // whole-word match (research Request: 'Mega' ≠ 'Megaron'); BRANDS is fixed, so its patterns and answers are kept
    if (BRAND_HITS.has(k)) return BRAND_HITS.get(k);
    BRAND_RES ||= brandPatterns();
    let hit = null; for (const [re, style] of BRAND_RES) if (re.test(k)) { hit = style; break; }
    BRAND_HITS.set(k, hit); return hit;
};
let BRAND_RES = null; const BRAND_HITS = new Map();
function brandPatterns() { return Object.keys(BRANDS).map(b => [new RegExp('(^|[^\\p{L}\\p{N}])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'u'), BRANDS[b]]); }
// (spec 10 load budget) the brand patterns (Unicode property classes: slow to compile, and V8 compiles a pattern on its
// first test) are made and run once while the page is idle; the same patterns, in the same order
if (typeof window !== 'undefined') setTimeout(() => { try { BRAND_RES ||= brandPatterns(); for (const [re] of BRAND_RES) re.test(''); } catch (e) { /* made on first use instead */ } }, 0);

// (spec 10 load budget) the motorway / trunk test per road type, kept (a regular expression per call before)
const MOTORWAY_TRUNK = new Map(), isMotorwayTrunk = (t) => { let v = MOTORWAY_TRUNK.get(t); if (v === undefined) MOTORWAY_TRUNK.set(t, v = /motorway|trunk/.test(t)); return v; };
const shoulderOf = (e) => (e.roadWidthSource && (e.roadWidthSource.source === 'OSM width' || e.roadWidthSource.review)) ? 0 : (isMotorwayTrunk(e.type) ? (e.type.endsWith('_link') ? 0.6 : 1.2) : 0.15);
const AWNING = ['#b91c1c', '#1f4e79', '#14532d', '#7c2d12', '#374151', '#6b21a8', '#0f766e', '#a16207'].map(rgb);
const PHASES = [];
let _phaseT = 0, _phaseName = '';
const setProgress = (msg) => {
    const now = performance.now(); if (_phaseName) PHASES.push([_phaseName, Math.round(now - _phaseT)]); _phaseT = now; _phaseName = msg; if (!msg) return; try { const el = document.querySelector('#loading p'); if (el) el.textContent = msg; } catch (e) { /* no DOM */ } };
const tick = () => new Promise(r => setTimeout(r, 0));

// ---------------------------------------------------------------------------
//  Data helpers
// ---------------------------------------------------------------------------
function undelta(arr, start, q = 0.1) {
    const pts = [];
    let x = 0, z = 0;
    for (let i = start; i + 1 < arr.length; i += 2) {
        if (i === start) { x = arr[i]; z = arr[i + 1]; } else { x += arr[i]; z += arr[i + 1]; }
        pts.push([x * q, z * q]);
    }
    return pts;
}
const signedArea = (pts) => { let s = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return s / 2; };
function centroid(pts) {
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a += f; cx += (pts[j][0] + pts[i][0]) * f; cz += (pts[j][1] + pts[i][1]) * f; }
    if (Math.abs(a) < 1e-6) { let sx = 0, sz = 0; for (const p of pts) { sx += p[0]; sz += p[1]; } return [sx / pts.length, sz / pts.length]; }
    return [cx / (3 * a), cz / (3 * a)];
}
function convexHull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
}
/** do two polygons' edges cross (proper segment intersections)? */
function polysCross(A, B) {
    const cr = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    for (let i = 0; i < A.length; i++) {
        const [ax, az] = A[i], [bx, bz] = A[(i + 1) % A.length];
        for (let j = 0; j < B.length; j++) {
            const [cx, cz] = B[j], [dx, dz] = B[(j + 1) % B.length];
            const d1 = cr(ax, az, bx, bz, cx, cz), d2 = cr(ax, az, bx, bz, dx, dz), d3 = cr(cx, cz, dx, dz, ax, az), d4 = cr(cx, cz, dx, dz, bx, bz);
            if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
        }
    }
    return false;
}

/** Uniform grid keyed by cell → array of items (items inserted by bbox). */
class BoxGrid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    k(i, j) { return i * 73856093 ^ j * 19349663; }
    insert(x0, z0, x1, z1, item) {
        const c = this.cell;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const key = this.k(i, j); let a = this.map.get(key); if (!a) this.map.set(key, a = []); a.push(item);
        }
    }
    cell_(i, j) { return this.map.get(this.k(i, j)); }
    /** items in cells overlapping the box (may contain duplicates) */
    each(x0, z0, x1, z1, cb) {
        const c = this.cell;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const a = this.map.get(this.k(i, j)); if (a) for (const it of a) cb(it);
        }
    }
}

// ---------------------------------------------------------------------------
//  Materials / textures
// ---------------------------------------------------------------------------
function makeAtlas() {
    // 4x4 tiles of 256 px: tiles 0-7 = buildings.js facade textures, 8-15 = variants drawn here
    const T = makeTextures();
    const S = 256;
    const win = (ctx, x, y, { cols, rows, ww, wh, frame = 'rgba(255,255,255,0.45)', glass = 'rgba(35,55,85,0.8)', lit = 0, arch = false, shutters = null, band = 0 }) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);
        const cw = S / cols, ch = S / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const wx = x + i * cw + cw * (1 - ww) / 2, wy = y + j * ch + ch * (1 - wh) / 2, w = cw * ww, h = ch * wh;
            ctx.fillStyle = frame; ctx.fillRect(wx - 3, wy - 3, w + 6, h + 6);
            ctx.fillStyle = Math.random() < lit ? 'rgba(90,110,130,0.75)' : glass;
            if (arch) { ctx.beginPath(); ctx.moveTo(wx, wy + h); ctx.lineTo(wx, wy + w / 2); ctx.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); ctx.lineTo(wx + w, wy + h); ctx.closePath(); ctx.fill(); }
            else ctx.fillRect(wx, wy, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(wx, wy + (arch ? w / 2 : 0), w, h * 0.12);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(wx + w / 2 - 1, wy, 2, h); // mullion
            if (shutters) { ctx.fillStyle = shutters; ctx.fillRect(wx - w * 0.28, wy, w * 0.24, h); ctx.fillRect(wx + w * 1.04, wy, w * 0.24, h); }
            ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(wx - 4, wy + h + 3, w + 8, 4); // sill shadow
        }
        if (band) { ctx.fillStyle = `rgba(0,0,0,${band})`; for (let j = 0; j < rows; j++) ctx.fillRect(x, y + j * ch, S, 5); }
    };
    const tex = makeCanvasTexture(4 * S, 4 * S, (ctx) => {
        const order = ['interwar', 'eclectic', 'civic', 'bloc', 'glass', 'house', 'shop', 'plain'];
        const at = (k) => [(k % 4) * S, (3 - Math.floor(k / 4)) * S]; // flipY: uv row r → canvas row 3-r
        order.forEach((name, k) => {
            const [x, y] = at(k);
            if (name === 'plain') {
                ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y, S, S);
                for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(x + Math.random() * S, y + Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4); }
                ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + S - 6, S, 6);
            } else ctx.drawImage(T[name].image, x, y, S, S);
        });
        // variants
        let [x, y] = at(8); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.62, wh: 0.5, band: 0.12 });                                   // interwar: square windows, strong bands
        [x, y] = at(9); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.36, wh: 0.66, arch: true, frame: 'rgba(255,255,255,0.7)' });       // eclectic: arched
        [x, y] = at(10); win(ctx, x, y, { cols: 2, rows: 2, ww: 0.5, wh: 0.7, frame: 'rgba(0,0,0,0.12)', glass: 'rgba(30,45,70,0.75)' }); // civic: tall
        [x, y] = at(11); win(ctx, x, y, { cols: 4, rows: 2, ww: 0.6, wh: 0.42, glass: 'rgba(25,35,55,0.8)', lit: 0.2, band: 0.08 }); // bloc: wide panes
        [x, y] = at(12); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);                                                       // glass: blue-green curtain wall
        for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 3 ? 'rgba(30,70,90,0.6)' : 'rgba(50,95,110,0.5)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, S / 4 - 4); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, 5); }
        [x, y] = at(13); win(ctx, x, y, { cols: 2, rows: 1, ww: 0.4, wh: 0.45, shutters: 'rgba(90,60,40,0.8)', frame: 'rgba(255,255,255,0.8)' }); // house: shutters
        [x, y] = at(14); ctx.drawImage(T.shop.image, x, y, S, S); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, S, S);  // shop (lighter)
        [x, y] = at(15); ctx.fillStyle = '#e9e6df'; ctx.fillRect(x, y, S, S); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * S / 4, y); ctx.lineTo(x + i * S / 4, y + S); ctx.stroke(); } // plain: panels
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    for (const t of Object.values(T)) t.dispose();
    return tex;
}

/** night-window data atlas, same layout as the facade atlas: R = window glass mask, G = per-window random, B = shopfront
 *  (always lit). Built from the facade atlas pixels (dark bluish glass), windows = 4-connected components. */
/** night / window data atlases, same layout as the facade atlas. nightMap: R = window glass, G = per-window random,
 *  B = shopfront (255) / brand band (128). winMap: RG = window rectangle origin in tile texels (v up), BA = rectangle size; zero width = non-glass.
 *  Windows = connected glass pixels of the facade atlas, filled to their bounding rectangle (the per-pixel colour test
 *  left noisy holes that read as "TV static" reflections); specks under 24 px are dropped. */
function nightAtlas(atlas) {
    const src = atlas.image, W = src.width, H = src.height;
    const sctx = src.getContext('2d', { willReadFrequently: true }), d = sctx.getImageData(0, 0, W, H).data;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); return { c, x, im: x.createImageData(W, H) }; };
    const N = mk(), o = N.im.data, u = new Uint8Array(W * H * 4);
    const glass = new Uint8Array(W * H), comp = new Int32Array(W * H).fill(-1), S = W / 4;
    const tileAt = (x, y) => (x / S | 0) + (3 - (y / S | 0)) * 4; // canvas row 0 = uv row 3 (flipY)
    for (let k = 0, p = 0; k < W * H; k++, p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2], t = tileAt(k % W, k / W | 0), shop = t === 6 || t === 14;
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        const fy = ((k / W | 0) % S) / S; // (0 = top of the cell: the shop texture's coloured sign band is the top ~14 %)
        glass[k] = shop ? (fy < 0.15 && lum > 40 ? 3 : b > r + 25 && lum > 60 ? 2 : 0) : (lum < 150 && b >= r + 4 ? 1 : 0);
    }
    for (let k = 0; k < W * H; k++) o[k * 4 + 3] = 255;
    const stack = [];
    for (let k = 0; k < W * H; k++) {
        if (!glass[k] || comp[k] >= 0) continue;
        const kind = glass[k], px = []; comp[k] = 1; stack.push(k);
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        while (stack.length) {
            const q = stack.pop(), x = q % W, y = q / W | 0; px.push(q);
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (n >= 0 && glass[n] === kind && comp[n] < 0) { comp[n] = 1; stack.push(n); }
        }
        if (px.length < 24 && kind === 1) continue;
        const rv = ((x0 * 73 + y0 * 151 + x1 * 199 + y1 * 47) >>> 0) % 255;
        if (kind === 1) { // fill the window rectangle
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const p = (y * W + x) * 4; o[p] = 255; o[p + 1] = rv; o[p + 2] = 0;
                // Constant metadata keeps a room attached to one opening. Interpolating quantised local positions made
                // floor / furniture edges step as the camera moved, and a 4x4 UV seed split wider windows into rooms.
                u[p] = x0 % S; u[p + 1] = S - 1 - y1 % S; u[p + 2] = x1 - x0 + 1; u[p + 3] = y1 - y0 + 1;
            }
        } else for (const q of px) { const p = q * 4; o[p] = kind === 3 ? 0 : 255; o[p + 1] = rv; o[p + 2] = kind === 2 ? 255 : 128; }
    }
    N.x.putImageData(N.im, 0, 0);
    const tex = (c, nearest) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter; t.generateMipmaps = !nearest; t.anisotropy = 4; return t; };
    // Canvas alpha premultiplication corrupts rectangle bytes when A stores height. Upload the bytes directly.
    const rect = new THREE.DataTexture(u, W, H); rect.flipY = true; rect.needsUpdate = true;
    rect.minFilter = rect.magFilter = THREE.NearestFilter; rect.generateMipmaps = false;
    return { night: tex(N.c, false), win: rect };
}

function solidMaterial(atlas, preparedNight = null) {
    // (2026-11-07, world-visual) PBR so glass curtain walls pick up the sky probe / environment (tiles 4 / 12: metalness
    // 0.55, roughness 0.16; everything else matte), and lit windows at night: render.js eases emissiveIntensity from 0
    // by day to userData.nightEmissive at night (contract 01 → Render); ~42 % of windows lit, warm 2700–4000 K, a few
    // TV-blue, shopfronts always lit and brighter. One material, no extra draw calls.
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.92, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 });
    m.userData.nightEmissive = 1.2;
    m.userData.uClosed = { value: 0 }; // share of shops closed (shutters down), set by world from the local hour
    let night = null, win = null; try { ({ night, win } = preparedNight || nightAtlas(atlas)); } catch (e) { console.warn('[world] night atlas', e); }
    m.userData.ownedTextures = [night, win].filter(Boolean); // shader-closure textures belong to this district material
    m.onBeforeCompile = (sh) => {
        sh.uniforms.winTexel = { value: 4 / atlas.image.width }; sh.uniforms.nightMap = { value: night }; sh.uniforms.winMap = { value: win }; sh.uniforms.uClosed = m.userData.uClosed;
        sh.vertexShader = 'attribute float tile;\nvarying float vTileRaw;\nvarying float vWY;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTileRaw = tile;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = FACADE_DETAIL_GLSL + '\nconst vec2 FD_GRID[16] = vec2[16](vec2(2.,2.),vec2(3.,2.),vec2(4.,2.),vec2(4.,2.),vec2(4.,2.),vec2(3.,1.),vec2(1.,1.),vec2(1.,1.),vec2(3.,2.),vec2(3.,2.),vec2(2.,2.),vec2(4.,2.),vec2(2.,4.),vec2(2.,1.),vec2(1.,1.),vec2(4.,1.));\nconst float FD_KIND[16] = float[16](2.,2.,1.,3.,-1.,0.,-1.,0.,2.,2.,1.,3.,-1.,0.,-1.,4.);\n' + 'varying float vTileRaw;\nvarying float vWY;\nuniform sampler2D nightMap;\nuniform sampler2D winMap;\nuniform float winTexel;\nuniform float uClosed;\nfloat fh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat fvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh1(i), fh1(i + vec2(1, 0)), f.x), mix(fh1(i + vec2(0, 1)), fh1(i + vec2(1, 1)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    float isGlass = 0.0, winFar = 1.0, glassOpen = 0.0; vec3 roomCol = vec3(0.0);
#ifdef USE_MAP
    // Derivatives are evaluated before divergent window branches, in the current draw camera's view frame.
    vec3 facadeDx = dFdx(-vViewPosition), facadeDy = dFdy(-vViewPosition);
    vec2 uvDx = dFdx(vMapUv), uvDy = dFdy(vMapUv);
    if (vTile > -0.5) {
        vec2 cellSz = vec2(0.25, 0.25);
        vec2 cellId = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 f = fract(vMapUv);
        vec2 auv = (cellId + 0.006 + f * 0.988) * cellSz;
        vec4 sampledDiffuseColor = textureGrad(map, auv, dFdx(vMapUv) * cellSz, dFdy(vMapUv) * cellSz);
        diffuseColor *= sampledDiffuseColor;
        bool shopT = abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1, glassT = abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1;
        float px = max(length(dFdx(vMapUv)), length(dFdy(vMapUv)));
        winFar = smoothstep(0.06, 0.22, px); // window cells of ≲ 15 px: the flat atlas look
        vec4 rect = texture(winMap, auv) * (255.0 * winTexel);
        vec2 windowUV = (fract(vMapUv) * 0.988 + 0.006 - rect.xy) / max(rect.zw, vec2(winTexel));
        isGlass = (shopT || glassT) ? 0.0 : step(winTexel * 0.5, rect.z);
        if (isGlass > 0.5 && winFar < 0.999) {
            // One stable room per connected window and repeated atlas tile. A window may span a quarter-tile boundary.
            vec2 key = floor(vMapUv) + rect.xy * 31.0 + vec2(vTile * 7.0, vTile);
            float r1 = fh1(key), r2 = fh1(key + 7.3), r3 = fh1(key + 13.1), r4 = fh1(key + 21.7);
            // Recover increasing-U / increasing-V axes and their metre scales from the facade itself. Cross(up,N)
            // reverses U on the opposite footprint winding; fixed room dimensions also make props slide in world space.
            float det = uvDx.x * uvDy.y - uvDx.y * uvDy.x;
            float invDet = 1.0 / (abs(det) > 1e-12 ? det : (det < 0.0 ? -1e-12 : 1e-12));
            vec3 dPdu = (facadeDx * uvDy.y - facadeDy * uvDx.y) * invDet;
            vec3 dPdv = (facadeDy * uvDx.x - facadeDx * uvDy.x) * invDet;
            vec3 Nv = normalize(vNormal), Tv = normalize(dPdu), Bv = normalize(dPdv);
            vec3 dir = -normalize(vViewPosition);
            vec3 dd = vec3(dot(dir, Tv), dot(dir, Bv), max(1e-3, dot(dir, -Nv)));
            float RW = max(0.1, length(dPdu) * rect.z / 0.988), RH = max(0.1, length(dPdv) * rect.w / 0.988), RD = 2.6 + 2.4 * r1;
            vec3 p0 = vec3(windowUV * vec2(RW, RH), 0.0);
            float tx = dd.x > 0.0 ? (RW - p0.x) / max(dd.x, 1e-4) : -p0.x / min(dd.x, -1e-4);
            float ty = dd.y > 0.0 ? (RH - p0.y) / max(dd.y, 1e-4) : -p0.y / min(dd.y, -1e-4);
            float tz = RD / dd.z, t = min(tx, min(ty, tz));
            vec3 hp = p0 + dd * t;
            vec3 wallC = mix(vec3(0.78, 0.72, 0.62), r2 < 0.5 ? vec3(0.62, 0.66, 0.7) : vec3(0.82, 0.76, 0.66), r3);
            vec3 c;
            if (t == tz) { c = wallC; if (hp.y < RH * 0.42 && fract(hp.x / RW * 1.7 + r2) > 0.45) c = vec3(0.24, 0.17, 0.12); // furniture silhouette
                           else if (hp.y > RH * 0.55 && hp.y < RH * 0.85 && fract(hp.x / RW * 2.3 + r4) > 0.7) c = vec3(0.35, 0.3, 0.26); } // picture / shelf
            else if (t == ty) c = dd.y < 0.0 ? vec3(0.36, 0.26, 0.18) : vec3(0.88, 0.86, 0.82);
            else c = wallC * 0.82;
            c *= mix(1.0, 0.5, hp.z / RD); // light falls off into the room
            // curtains / blinds (fabric on the glass plane, top down to a random height); a few open windows
            float cl = r4 < 0.55 ? 1.0 - (0.15 + 0.6 * r3) : 2.0;
            vec3 fabric = mix(vec3(0.9, 0.88, 0.82), r2 < 0.3 ? vec3(0.62, 0.52, 0.42) : vec3(0.82, 0.8, 0.74), r1);
            if (windowUV.y > cl) { c = fabric * (0.85 + 0.15 * sin(windowUV.x * 40.0)); glassOpen = 0.5; }
            if (r1 > 0.96 && r2 > 0.5) glassOpen = 1.0;
            roomCol = c;
            // reveal shadow along the top / one side of the opening
            float rev = 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.08, 1.0 - windowUV.y)) - 0.3 * (1.0 - smoothstep(0.0, 0.06, windowUV.x));
            diffuseColor.rgb = mix(c * 0.34 * rev, diffuseColor.rgb, winFar); // (rooms are darker than the street by day)
        }
        if (!shopT && !glassT && isGlass < 0.5) { // weathering: grime near the ground, rain streaks, plaster patches
            float g = 1.0 - 0.16 * (1.0 - smoothstep(0.2, 1.8, vWY));
            float streak = fvn(vec2(vMapUv.x * 9.0, 0.5)) * smoothstep(0.55, 1.0, fvn(vec2(vMapUv.x * 23.0, vMapUv.y * 0.6)));
            g *= 1.0 - 0.07 * streak;
            bool old = abs(vTile - 1.0) < 0.1 || abs(vTile - 9.0) < 0.1 || abs(vTile - 3.0) < 0.1 || abs(vTile - 11.0) < 0.1;
            if (old) g *= 0.94 + 0.12 * smoothstep(0.35, 0.75, fvn(vMapUv * vec2(1.7, 2.3) + vTile));
            diffuseColor.rgb *= mix(g, 1.0, winFar * 0.6);
            // stone, rusticated base, panel joints, plaster tone by facade type (facade-detail.js; owner, 2026-11-11: "improve
            // all buildings"). Metres along / up the wall from the facade's own UV derivatives (taken above, outside branches).
            int fdT = int(vTile + 0.5); float fdK = (fdT >= 0 && fdT < 16) ? FD_KIND[fdT] : -1.0;
            if (fdK > -0.5) {
                vec2 fdG = FD_GRID[fdT];
                float fdDet = uvDx.x * uvDy.y - uvDx.y * uvDy.x, fdInv = 1.0 / (abs(fdDet) > 1e-12 ? fdDet : 1e-12);
                float mU = length((facadeDx * uvDy.y - facadeDy * uvDx.y) * fdInv), mV = length((facadeDy * uvDx.x - facadeDx * uvDy.x) * fdInv);
                vec2 fdW = abs(uvDx) + abs(uvDy);
                diffuseColor.rgb = facadeDetail(diffuseColor.rgb, fdK, vMapUv.x * mU, vMapUv.y * mV, fdW.x * mU, fdW.y * mV, vMapUv.x * fdG.x, fdW.x * fdG.x, vMapUv.y * fdG.y, fdW.y * fdG.y);
            }
        }
        if (uClosed > 0.001 && (abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1)) { // closed shops: roller shutters over the glass
            // the whole shop opening below the sign band (not the per-pixel glass mask, which aliased into vertical
            // streaks): horizontal roller-shutter slats every ~19 cm, a darker housing box at the top
            float sid = floor(vMapUv.x * 4.0), fu = fract(vMapUv.x * 4.0), fv = fract(vMapUv.y);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            if (hc < uClosed && fv < 0.85 && fv > 0.03 && fu > 0.04 && fu < 0.96) {
                float slat = 0.82 + 0.18 * smoothstep(0.35, 0.5, fract(vMapUv.y * 22.0)) * (1.0 - smoothstep(0.85, 1.0, fract(vMapUv.y * 22.0)));
                diffuseColor.rgb = vec3(0.36, 0.37, 0.38) * (fv > 0.78 ? 0.6 : slat);
            }
        }
    }
#endif`).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
    if (vTile > -0.5 && (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1)) { metalnessFactor = 0.55; roughnessFactor = 0.16; }
#ifdef USE_MAP
    else if (isGlass > 0.5) { // window panes: calm sky reflection over the fake room (curtains / open windows reflect less)
        float gl = 1.0 - glassOpen;
        metalnessFactor = mix(metalnessFactor, 0.35, gl); roughnessFactor = mix(roughnessFactor, 0.12, gl);
    }
#endif`).replace('#include <emissivemap_fragment>', `
#ifdef USE_MAP
    if (vTile > -0.5 && totalEmissiveRadiance.r > 0.001) {
        vec2 cellSz2 = vec2(0.25, 0.25);
        vec2 cellId2 = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 auv2 = (cellId2 + 0.006 + fract(vMapUv) * 0.988) * cellSz2;
        vec3 nm = textureGrad(nightMap, auv2, dFdx(vMapUv) * cellSz2, dFdy(vMapUv) * cellSz2).rgb;
        // lit in runs (2–3 neighbouring bays of one floor share a state, like real offices / flats), and distance-stable:
        // once a facade tile covers only a few pixels, the per-window pattern fades to its average glow (no speckle)
        vec2 cellK = vec2(floor(vMapUv.x / 2.5), floor(vMapUv.y));
        float h = fract(sin(dot(cellK + vec2(floor(nm.g * 2.99) * 7.0, vTile), vec2(12.9898, 78.233))) * 43758.5453);
        float shop = step(0.75, nm.b), sign = step(0.25, nm.b) * (1.0 - shop), lit = max(shop, step(h, 0.42));
        float h2 = fract(h * 13.7);
        vec3 col = h2 > 0.93 ? vec3(0.55, 0.68, 1.0) : mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.82, 0.58), h2);
        if (shop + sign > 0.5) { // shops: interior tint per shop (supermarket cool white, café warm, pharmacy green, bank blue, …)
            float sid = floor(vMapUv.x * 4.0);
            float hs = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(127.1, 311.7))) * 43758.5453);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            vec3 tint = hs < 0.25 ? vec3(0.68, 0.78, 0.88) : hs < 0.5 ? vec3(1.0, 0.58, 0.28) : hs < 0.62 ? vec3(0.55, 1.0, 0.62) : hs < 0.74 ? vec3(0.5, 0.66, 1.0) : vec3(1.0, 0.8, 0.6);
            float closed = step(hc, uClosed);
            col = shop * tint * (0.85 + 0.3 * fract(hs * 7.3)) * (1.0 - 0.96 * closed)
                + sign * texture(map, auv2).rgb * 1.5 * (1.0 - 0.6 * closed); // brand band brighter than the glass
            lit = 1.0; nm.r = 1.0;
        }
        float far = smoothstep(0.12, 0.45, max(length(dFdx(vMapUv)), length(dFdy(vMapUv)))); // facade tiles per pixel
        float mask = mix(step(0.5, nm.r), nm.r, far);
        lit = mix(lit, mix(0.42, 1.0, max(shop, sign)), far);
        col = mix(col, shop + sign > 0.5 ? col : vec3(1.0, 0.74, 0.47), far);
        if (isGlass > 0.5) col *= mix(vec3(0.75), roomCol * 0.9 + 0.06, (1.0 - winFar) * (1.0 - far)); // (lit room, not a white card)
        if (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1) { // curtain walls: lit office floors in runs, dim cool light, never per-pane tiles
            float fl = floor(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0)), run = floor(vMapUv.x / 3.0);
            float hf = fract(sin(dot(vec2(fl, run * 0.37 + floor(vMapUv.x / 9.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float fv = fract(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0));
            lit = step(hf, 0.28) * smoothstep(0.08, 0.2, fv) * (1.0 - smoothstep(0.8, 0.92, fv));
            // (after round 6: lit floors read as solid white slabs) panes between mullions, some with blinds down or dark
            // desks, ceiling lights brighter at the top of the floor, dimmer overall
            { float px2 = vMapUv.x * 4.0, pf = fract(px2), pid = fract(sin(dot(vec2(floor(px2), fl), vec2(39.3, 11.7))) * 24634.63);
              float mull = smoothstep(0.02, 0.07, pf) * (1.0 - smoothstep(0.93, 0.98, pf));
              lit *= mull * (pid < 0.18 ? 0.15 : pid < 0.35 ? 0.55 : 1.0) * (0.55 + 0.45 * smoothstep(0.3, 0.85, fv)); }
            col = mix(vec3(0.78, 0.84, 0.92), vec3(1.0, 0.82, 0.6), step(0.6, fract(hf * 9.1))) * 0.26;
            mask = 1.0; lit = mix(lit, 0.24, far) + 0.03;
        }
        totalEmissiveRadiance *= mask * lit * col;
    } else totalEmissiveRadiance *= 0.0;
#else
    totalEmissiveRadiance *= 0.0;
#endif`);
    };
    { const ob = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { ob(sh, r);
        // (the tile id is an interpolated varying: 7.99999 picked the wrong atlas cell on some pixels — the 'TV static' on
        //  windows; round it once per fragment)
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n\tfloat vTile = floor(vTileRaw + 0.5);'); }; }
    m.customProgramCacheKey = () => 'osm-solid-atlas-pbr5-anchored-rooms-facade-detail';
    return m;
}

function noiseTexture() {
    const t = makeCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < img.data.length; i += 4) { const v = 235 + Math.random() * 20 - (Math.random() < 0.03 ? 30 : 0); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
        ctx.putImageData(img, 0, 0);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 0, 7); ctx.fill(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
}

/** Sign atlas: pages of 2048x2048 with 256x64 cells */
class SignAtlas {
    constructor() { this.pages = []; this.map = new Map(); this.cols = 8; this.rows = 32; }
    get(text, bg = '#1f2937', fg = '#ffffff', accent = null, force = false, twoLine = false) {
        const key = text + '|' + bg + '|' + fg + '|' + accent + (twoLine ? '|2' : '');
        let r = this.map.get(key); if (r) return r;
        let page = this.pages[this.pages.length - 1];
        if (!page || page.n >= this.cols * this.rows) {
            if (this.pages.length >= (force ? 7 : 6)) return null; // road-sign pictograms may use one extra page
            const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
            page = { canvas: c, ctx: c.getContext('2d'), n: 0, tex: null };
            this.pages.push(page);
        }
        const i = page.n++, col = i % this.cols, row = Math.floor(i / this.cols);
        const W = 256, H = 64, x = col * W, y = row * H, ctx = page.ctx;
        ctx.fillStyle = bg; ctx.fillRect(x, y, W, H);
        if (accent) { ctx.fillStyle = accent; ctx.fillRect(x, y + H - 7, W, 7); }
        ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let size = 40; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        while (ctx.measureText(text).width > W - 16 && size > 14) { size -= 2; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; }
        // (2026-11-12 render review, fascias) twoLine: a name that only fits a 256 px cell in small type ("Minimarket Bobtig
        // Non-Stop" at ~16 px) is set on two balanced lines in larger type instead
        let lines = null;
        if (twoLine && size < 26 && text.includes(' ')) {
            const sp = [...text.matchAll(/ /g)].map(m => m.index), mid = text.length / 2, cut = sp.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
            const L2 = [text.slice(0, cut), text.slice(cut + 1)], usable = H - (accent ? 10 : 6);
            let s2 = Math.min(28, Math.floor(usable / 2.1)); const f2 = (q) => `bold ${q}px "Helvetica Neue", Arial, sans-serif`; ctx.font = f2(s2);
            while (Math.max(...L2.map(l => ctx.measureText(l).width)) > W - 16 && s2 > 14) { s2 -= 1; ctx.font = f2(s2); }
            if (s2 > size) { lines = L2; size = s2; } else ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        }
        if (lines) { const cy = y + H / 2 - (accent ? 3 : 0), dy = size * 0.55; ctx.fillText(lines[0], x + W / 2, cy - dy, W - 12); ctx.fillText(lines[1], x + W / 2, cy + dy, W - 12); }
        else ctx.fillText(text, x + W / 2, y + H / 2 - (accent ? 3 : 0), W - 12);
        const pi = this.pages.indexOf(page), tw = lines ? Math.max(...lines.map(l => ctx.measureText(l).width)) : ctx.measureText(text).width;
        r = { page: pi, u0: (x + 1) / 2048, u1: (x + W - 1) / 2048, v0: 1 - (y + H - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: Math.min(4, Math.max(1.6, tw / H + 0.6)) };
        this.map.set(key, r); return r;
    }
    /** a 64×64 pictogram (road signs) drawn by draw(ctx, x, y, size); four per atlas cell */
    icon(key, draw) {
        const k = 'icon|' + key;
        let r = this.map.get(k); if (r) return r;
        if (!this.sq || this.sq.k >= 4) {
            const cell = this.get('\u0000' + (this.nIcon = (this.nIcon || 0) + 1), 'rgba(0,0,0,0)', '#000', null, true); if (!cell) return null;
            const page = this.pages[cell.page];
            const x = Math.round(cell.u0 * 2048 - 1), y = Math.round((1 - cell.v1) * 2048 - 1);
            page.ctx.clearRect(x, y, 256, 64);
            this.sq = { page: cell.page, x, y, k: 0 };
        }
        const S2 = 64, x = this.sq.x + this.sq.k * 64, y = this.sq.y, ctx = this.pages[this.sq.page].ctx;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, S2, S2); ctx.clip(); draw(ctx, x, y, S2); ctx.restore();
        this.sq.k++;
        r = { page: this.sq.page, u0: (x + 1) / 2048, u1: (x + S2 - 1) / 2048, v0: 1 - (y + S2 - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: 1 };
        this.map.set(k, r); return r;
    }
    textures() {
        return this.pages.map(p => { const t = new THREE.CanvasTexture(p.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
    }
}

// ---------------------------------------------------------------------------
//  Prop geometries (prepared once)
// ---------------------------------------------------------------------------
let PROPS = null;
function props() {
    if (PROPS) return PROPS;
    const crown = new THREE.IcosahedronGeometry(1, 0);
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1, 5);
    const tree = mergeProps([bakeProp(trunk, { y: 1.6, sy: 3.2, color: '#6b4a2f' }), bakeProp(crown, { y: 4.6, sx: 2.6, sy: 2.4, sz: 2.6, color: '#4f8a3c' })]);
    const tree2 = mergeProps([bakeProp(trunk, { y: 1.5, sy: 3, color: '#5e4330' }), bakeProp(crown, { y: 4.0, sx: 2.0, sy: 2.6, sz: 2.0, color: '#5d9440' }), bakeProp(crown, { y: 5.6, sx: 1.4, sy: 1.5, sz: 1.4, color: '#679c48' })]);
    const cone = new THREE.ConeGeometry(1, 1, 6);
    const conifer = mergeProps([bakeProp(trunk, { y: 1, sy: 2, color: '#5b4030' }), bakeProp(cone, { y: 4.5, sx: 2.3, sy: 6, sz: 2.3, color: '#2f5d3a' }), bakeProp(cone, { y: 7.6, sx: 1.6, sy: 4, sz: 1.6, color: '#356640' })]);
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 6);
    const lamp = mergeProps([bakeProp(pole, { y: 4, sy: 8, color: '#4a4f57' }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 0.9, y: 7.9, sx: 1.9, sy: 0.12, sz: 0.12, color: '#4a4f57' }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 1.8, y: 7.8, sx: 0.7, sy: 0.18, sz: 0.32, color: '#fff3c4' })]);
    const box = new THREE.BoxGeometry(1, 1, 1);
    // traffic light pole + housing (housing faces +x = toward incoming traffic after rotation)
    const tlight = mergeProps([bakeProp(pole, { y: 2.4, sy: 4.8, sx: 1.4, sz: 1.4, color: '#2f3237' }), bakeProp(box, { y: 4.1, x: 0.1, sx: 0.36, sy: 1.25, sz: 0.48, color: '#1c1e22' }),
        ...[0, 1, 2].map(i => bakeProp(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8), { x: 0.3, y: 4.5 - i * 0.38, rz: Math.PI / 2, color: '#3a3d42' }))]);
    const cylY = prep(new THREE.CylinderGeometry(1, 1, 1, 8)), cylZ = prep(new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2)); // (unit, centred; cylZ lies along z)
    PROPS = { tree, tree2, conifer, lamp, tlight, box: UNIT_BOX, sphere: prep(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), cylY, cylZ };
    return PROPS;
}

const carPropCache = new Map();
function carProps(kind, color) {
    const key = kind + color;
    let p = carPropCache.get(key); if (p) return p;
    const grp = makeVehicle(kind, color, { lod: 'parked' }); // (static props: the ~250-tri parked model)
    grp.updateMatrixWorld(true);
    const list = [];
    grp.traverse(o => {
        if (!o.isMesh || !o.geometry?.attributes?.normal) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const mc = mats[0]?.color ? '#' + mats[0].color.getHexString() : '#ffffff';
        const pr = prep(g, g.attributes.color ? null : mc);
        if (g.attributes.color && mats[0]?.color) { const c = rgb('#' + mats[0].color.getHexString()); for (let i = 0; i < pr.col.length; i += 3) { pr.col[i] = pr.col[i] * c[0] / 255; pr.col[i + 1] = pr.col[i + 1] * c[1] / 255; pr.col[i + 2] = pr.col[i + 2] * c[2] / 255; } }
        list.push(pr);
    });
    p = list.length ? mergeProps(list) : UNIT_BOX;
    carPropCache.set(key, p);
    return p;
}

// ===========================================================================
//  BUILD
// ===========================================================================
export async function buildWorld(city, renderer, opts = {}) {
    const t0 = performance.now();
    setProgress('Loading OpenStreetMap data…');
    // chapters: buildWorld(city, renderer, { district, start }) loads game/data/<city>-<district>.json (real 1:1 scale);
    // without a district the old corridor map (game/data/<city>.json) is loaded
    const distId = opts.district || city.activeDistrict || null, // (city.activeDistrict: lets main.js's loadCity pick a district without a signature change)
        distCfg = distId ? (city.districts || {})[distId] : null;
    if (distId && !distCfg) throw new Error(`unknown district ${city.id}:${distId}`);
    const inDistrictLL = (lat, lon, m = 0.0015) => !distCfg || (lat >= distCfg.bbox[0] - m && lat <= distCfg.bbox[2] + m && lon >= distCfg.bbox[1] - m * 1.4 && lon <= distCfg.bbox[3] + m * 1.4);
    // districts: a lossless binary pack (game/src/district-pack.js, spec 10 size / load budget); legacy maps: JSON
    const url = new URL(`../data/${districtFile(city.id, distId)}`, import.meta.url).href;
    // (spec 10 load budget) workers for the pure passes (districts); null without module workers: then all runs here.
    // A worker fetches the pack and writes its JSON text; JSON.parse here gives the same object as fetchDistrictPack.
    const buildPool = distId ? sharedBuildPool() : null;
    buildPool?.reset();
    let data = null;
    const packText = buildPool ? buildPool.packText(url) : null;
    // (spec 10 load budget) the facade atlas and its night data do not depend on the place: they are painted while the
    // worker decodes the pack (canvas textures only; the materials are made where they were)
    const earlyAtlas = (() => { try { const atlas = makeAtlas(); let night = null; try { night = nightAtlas(atlas); } catch (e) { /* solidMaterial reports it */ } return { atlas, night }; } catch (e) { return null; } })();
    if (packText) try { data = parseDistrictPackText(await packText); } catch (e) { console.warn('[world] pack worker failed, decoding here', e); }
    if (!data) data = distId ? await fetchDistrictPack(url) : await (await fetch(url)).json();
    const realPass = !!data.scenery; // (2026-11-08) a district rebuilt by the reality pass (scenery ring, aerial roofs / trees / green): street-level dressing on
    // field research (spec 20): street-tree notes per street, baked by tools/osm into data.streetTrees
    // ({street name: [species keys]}, [] = researched as treeless) — no runtime fetch of the research dossier
    const researchTrees = new Map(); // street name → { species: [...], none }
    for (const [name, out] of Object.entries(data.streetTrees || {})) researchTrees.set(name, { species: out, none: !out.length });
    RESEARCH_BRANDS = data.brands || {};
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
    for (const rd of roads) {
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
    const nearestEdge = (x, z, filter = null, maxR = 3000) => {
        const ix = Math.floor(x / EG), iz = Math.floor(z / EG);
        let best = null, bd = Infinity, bt = 0, bcx = 0, bcz = 0;
        const K = Math.ceil(maxR / EG);
        for (let k = 0; k <= K; k++) {
            for (let i = ix - k; i <= ix + k; i++) for (let j = iz - k; j <= iz + k; j++) {
                if (Math.max(Math.abs(i - ix), Math.abs(j - iz)) !== k) continue;
                const arr = edgeGrid.cell_(i, j); if (!arr) continue;
                for (const e of arr) {
                    if (filter && !filter(e)) continue;
                    const r = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
                    if (r.d < bd) { bd = r.d; best = e; bt = r.t; bcx = r.cx; bcz = r.cz; }
                }
            }
            if (best && bd <= k * EG) break;
        }
        return best ? { edge: best, d: bd, t: bt, cx: bcx, cz: bcz } : null;
    };
    const edgesInBox = (x0, z0, x1, z1, cb) => { const seen = new Set(); edgeGrid.each(x0, z0, x1, z1, (e) => { if (!seen.has(e)) { seen.add(e); cb(e); } }); };

    // ---- dual carriageways cut by the map border (or by a mapping gap) end in a one-way "sink" next to a
    //      one-way "source" going the other way: join them with an invisible U-turn so they stay routable
    if (data.roadGeometryPolicy !== 'source') {
        const sinks = [], sources = [];
        for (const n of nodeArr) {
            if (n.edges.length !== 1 || !n.edges[0].oneway) continue;
            (n.edges[0].b === n ? sinks : sources).push(n);
        }
        const g = new BoxGrid(50); for (const n of sources) g.insert(n.x, n.z, n.x, n.z, n);
        let added = 0;
        for (const a of sinks) {
            let best = null, bd = 60;
            g.each(a.x - 60, a.z - 60, a.x + 60, a.z + 60, (b) => { if (b.edges.length !== 1) return; const d = Math.hypot(b.x - a.x, b.z - a.z); if (d < bd && d > 0.5) { bd = d; best = b; } });
            if (!best) continue;
            const src = a.edges[0];
            const dx = best.x - a.x, dz = best.z - a.z, len = Math.hypot(dx, dz);
            const e = { ...src, id: edges.length, a, b: best, dirx: dx / len, dirz: dz / len, len, nx: -dz / len, nz: dx / len, lanesF: 1, lanesB: 0, lanes: 1, median: -src.laneW, wR: src.laneW / 2, wL: src.laneW / 2, halfW: src.laneW / 2, maxspeed: 8, speed: 8, trafficMul: 0, virtual: true, tram: false, bridge: false, tunnel: false };
            edges.push(e); a.edges.push(e); best.edges.push(e); added++;
        }
        if (added) console.info('[world] u-turn connectors', added);
    }

    // ---- strongly connected components (one-way aware): only the main SCC is drivable / routable
    let sccInfo;
    // district maps: roads cut at the boundary (map ends) all lead to / come from "the rest of the city", so for
    // connectivity they are joined through one virtual outside node (a one-way street entering the map is not a trap)
    for (const i of data.district?.ends || []) if (nodeArr[i]) nodeArr[i].mapEnd = true;
    const computeSCC = () => {
        const N = nodeArr.length + 1, OUT = nodeArr.length;
        const out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
        for (const e of edges) { if (e.publicDrive === false) continue; out[e.a.id].push(e.b.id); inn[e.b.id].push(e.a.id); if (!e.oneway) { out[e.b.id].push(e.a.id); inn[e.a.id].push(e.b.id); } }
        for (const n of nodeArr) if (n.mapEnd && n.edges.some(e => e.publicDrive !== false)) { out[n.id].push(OUT); inn[OUT].push(n.id); out[OUT].push(n.id); inn[n.id].push(OUT); }
        // Kosaraju (iterative)
        const order = [], seen = new Uint8Array(N);
        for (let s0 = 0; s0 < N; s0++) {
            if (seen[s0] || (s0 < OUT && !nodeArr[s0].edges.length) || (s0 === OUT && !out[OUT].length)) continue;
            const stack = [[s0, 0]]; seen[s0] = 1;
            while (stack.length) {
                const top = stack[stack.length - 1]; const [u, k] = top;
                if (k < out[u].length) { top[1]++; const v = out[u][k]; if (!seen[v]) { seen[v] = 1; stack.push([v, 0]); } }
                else { order.push(u); stack.pop(); }
            }
        }
        const comp = new Int32Array(N).fill(-1); let nc = 0; const sizes = [];
        for (let i = order.length - 1; i >= 0; i--) {
            const s0 = order[i]; if (comp[s0] >= 0) continue;
            const st = [s0]; comp[s0] = nc; let sz = 0;
            while (st.length) { const u = st.pop(); sz++; for (const v of inn[u]) if (comp[v] < 0) { comp[v] = nc; st.push(v); } }
            sizes.push(sz); nc++;
        }
        let main = 0; for (let c = 1; c < nc; c++) if (sizes[c] > sizes[main]) main = c;
        let off = 0;
        for (const n of nodeArr) { n.comp = comp[n.id]; n.drivable = comp[n.id] === main; }
        for (const e of edges) { e.drivable = e.publicDrive !== false && e.a.drivable && e.b.drivable; if (!e.drivable) off++; }
        // weakly connected components (for the report)
        const par = new Int32Array(N).map((_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        for (const e of edges) par[f(e.a.id)] = f(e.b.id);
        const wcc = new Set(); for (const n of nodeArr) if (n.edges.length) wcc.add(f(n.id));
        sccInfo = { scc: nc, mainNodes: sizes[main], nodesOutside: nodeArr.filter(n => n.edges.length && !n.drivable).length, edgesOff: off, weakComponents: wcc.size };
    };
    computeSCC();
    // one-way streets around the CV stops that are traps (not in the main network) become two-way,
    // so every stop's own street is reachable (e.g. Str. Vasile Alecsandri at UiPath HQ)
    if (data.roadGeometryPolicy !== 'source') {
        let flipped = 0;
        for (const p of city.pois || []) {
            if (!inDistrictLL(p.lat, p.lon)) continue;
            const q = city.proj(p.lat, p.lon);
            edgesInBox(q.x - 180, q.z - 180, q.x + 180, q.z + 180, (e) => {
                if (e.publicDrive === false || e.drivable || !e.oneway || /motorway|trunk|primary/.test(e.type)) return;
                e.oneway = false; e.lanesB = 1; e.median = 0; e.lanes = Math.max(e.lanesF, 1);
                e.wR = e.lanesF * e.laneW; e.wL = e.laneW; e.halfW = Math.max(e.wR, e.wL); e.madeTwoWay = true;
                flipped++;
            });
        }
        if (flipped) {
            for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5;
            computeSCC();
            sccInfo.twoWayFixups = flipped;
        }
    }

    // (2026-11-08, owner: "markings seem wrong here", Calea Floreasca) OSM changes a one-way street's lane count every few
    // dozen metres (3, 4, 3, 3, 4 …) and every segment was centred on the way: at each change both kerbs and every lane line
    // jumped 1.75 m sideways. District worlds: along a named one-way chain the left kerb stays where the narrowest
    // neighbouring segment puts it and the extra lanes widen the right side (a turn bay); lane i keeps its position
    // (traffic lanes are counted from the left: median/2 + laneW·(i + ½)).
    if (distId) {
        let aligned = 0;
        const nextOf = (e) => e.b.edges.filter(f => f !== e && f.a === e.b && f.oneway && !f.virtual && f.name === e.name);
        const prevOf = (e) => e.a.edges.filter(f => f !== e && f.b === e.a && f.oneway && !f.virtual && f.name === e.name);
        for (const e of edges) {
            if (!e.oneway || e.virtual || !e.name || e.madeTwoWay || e.roadWidthSource?.leftM != null) continue;
            let base = e.lanesF, f = e;
            for (let k = 0; k < 4; k++) { const n2 = prevOf(f); if (n2.length !== 1) break; f = n2[0]; base = Math.min(base, f.lanesF); }
            f = e; for (let k = 0; k < 4; k++) { const n2 = nextOf(f); if (n2.length !== 1) break; f = n2[0]; base = Math.min(base, f.lanesF); }
            if (base >= e.lanesF || Math.abs(e.laneW * e.lanesF - (e.wL + e.wR)) > 0.05) continue;
            e.wL = base * e.laneW / 2; e.wR = e.lanesF * e.laneW - e.wL; e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); aligned++;
        }
        if (aligned) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.laneAligned = aligned; }
    }
    // (owner, 2026-11-12, Grozavesti (69, 19): "the road looks wrong here -- lane collapse suddenly"; OSM w665896755 lanes=2,
    // turn:lanes=merge_to_right|, then w665896756 lanes=1; Street View at 44.44100, 26.06002: two lanes, a merge arrow in the
    // lane that ends, then a taper of some 30-40 m into one lane) where a one-way street drops a lane at a plain node, the
    // carriageway stepped from two lanes to one there: half the step on the last edge before the node, half on the first
    // after it, with the edge line and the sidewalk left on the nominal line. A MAPPED merge (turn:lanes merge_to_*) now
    // keeps its full width to the node, where the lane line ends, and the outer edge closes in evenly over the edges that
    // follow, up to the first node at least 25 m on. e.taperR = [extra right-side width at a, at b]; corner() carries it
    // into every strip built from corners (asphalt, kerb, sidewalk). EXCEPTION to the source: the game keeps the left
    // kerb and ends the right-hand lane whichever lane the tag names (lanes are counted from the left).
    const laneTapers = [], sideExtra = (e, side, along) => side > 0 && e.taperR ? e.taperR[0] + (e.taperR[1] - e.taperR[0]) * clamp(along / e.len, 0, 1) : 0;
    if (distId) {
        const tl = data.turnLanes || [], merges = new Set(); for (let i = 0; i + 2 < tl.length; i += 3) if (/merge_to_/.test(str(tl[i + 1]))) merges.add(tl[i]);
        const plain = e => e.oneway && !e.virtual && !e.bridge && !e.tunnel && !e.madeTwoWay && !e.roadWidthSource;
        for (const e of edges) {
            if (!plain(e) || !merges.has(e.road)) continue;
            const N = e.b, out = N.edges.filter(f => !f.virtual); if (out.length !== 2) continue;
            const f = out.find(g => g !== e); if (!f || f.a !== N || !plain(f) || f.lanesF !== e.lanesF - 1 || Math.abs(f.wL - e.wL) > .05) continue;
            const D = e.wR - f.wR; if (!(D > 1.5 && D < 5)) continue;
            const chain = []; let cur = f, total = 0;
            for (;;) {
                chain.push(cur); total += cur.len; if (total >= 25) break;
                const next = cur.b.edges.filter(g => !g.virtual); if (next.length !== 2) break;
                const g = next.find(h => h !== cur); if (!g || g.a !== cur.b || !plain(g) || g.lanesF !== f.lanesF || Math.abs(g.wR - f.wR) > .05 || Math.abs(g.wL - f.wL) > .05) break;
                cur = g;
            }
            if (total < 12 || total > 90) continue; // (too short to read as a taper; or one long edge with nowhere to end it)
            let at = 0; for (const g of chain) { g.taperR = [D * (1 - at / total), D * (1 - (at + g.len) / total)]; at += g.len; }
            laneTapers.push({ from: e, node: N, lengthM: total, widthM: D, edges: chain.length });
        }
        if (laneTapers.length) sccInfo.laneTapers = laneTapers.map(t => ({ at: [Math.round(t.node.x), Math.round(t.node.z)], lengthM: Math.round(t.lengthM), widthM: t.widthM, edges: t.edges, sourceId: data.roadSourceGeometry?.[t.from.road]?.sourceId }));
    }

    // refine tram flag per edge using the actual tram geometry
    const trams = data.trams.map(t => undelta(t, 0));
    {
        const tg = new BoxGrid(40);
        for (const pl of trams) for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; tg.insert(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]); }
        for (const e of edges) {
            if (!e.tram) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            let d = Infinity; tg.each(mx - 10, mz - 10, mx + 10, mz + 10, ([a, b]) => { d = Math.min(d, distPointSeg(mx, mz, a[0], a[1], b[0], b[1]).d); });
            // (owner, 2026-11-11, Grozavesti (863, -1109): "the tram path is still going on the street") on a bridge the trams
            // run on their own slab beside the carriageway (Pasajul Basarab: 5-7 m from a 3.5 m half width); rails are drawn
            // into a deck carriageway only where the tram line lies within its asphalt. At grade the mapping tolerance stays.
            e.tram = d < e.halfW + (e.bridge ? 0.5 : 4);
        }
        // (owner, 2026-11-11, Grozavesti: "the tram path is still going on the street") on the Basarab deck a tram line runs
        // 3-5 m from the mapped centre line of a carriageway drawn 3.5 m to each side, so the asphalt reached over the tracks.
        // The mapped line and the far edge stay; on a bridge carriageway the tram-facing side is narrowed to keep 2.2 m clear
        // of the track (at least 1.75 m) and the lanes share the narrower width (widening the far side pushed the deck into
        // neighbouring ramps).
        // (owner, 2026-11-12, Grozavesti: "fences are not continuous on the bridge still in many places") the nearest tram line
        // can be a street tram crossing below: at the Grozăvești end (335..386, -708..-739) one 0-1 m from the deck's centre
        // line hid the deck tram 3.6-4.5 m beside it, so the wrong side was narrowed or none, the asphalt reached over the deck
        // track and 60 m of railing between them was left out. Where an elevated tram line (a reviewed elevated way of
        // TRAM_BRIDGE_MODELS with its ramps, or one tagged bridge / layer > 0) runs beside the deck, it decides the side
        // (the narrower width when both agree); elsewhere the nearest line, as before.
        const elevatedWays = new Set(TRAM_BRIDGE_MODELS.flatMap(m => [...(m.bridgeWays || []), ...(m.paths || []).flatMap(p => p.ways.map(w => w[0]))]));
        const tgUp = new BoxGrid(40);
        trams.forEach((pl, i) => { const src = data.tramSources?.[i], t = src?.tags || {}; if (!src || (!elevatedWays.has(src.sourceId) && !(t.bridge && t.bridge !== 'no') && !(+t.layer > 0))) return; for (let k = 0; k < pl.length - 1; k++) { const a = pl[k], b = pl[k + 1]; tgUp.insert(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]); } });
        let tramShifted = 0;
        for (const e of edges) {
            if (e.virtual || !e.bridge || !e.oneway) continue;
            const nearestOf = grid => { let d = Infinity, sgn = 0; for (const f of [0.1, 0.5, 0.9]) { const x = e.a.x + (e.b.x - e.a.x) * f, z = e.a.z + (e.b.z - e.a.z) * f;
                grid.each(x - 10, z - 10, x + 10, z + 10, ([a, b]) => { const q = distPointSeg(x, z, a[0], a[1], b[0], b[1]); if (q.d < d) { d = q.d; sgn = Math.sign((q.cx - x) * e.nx + (q.cz - z) * e.nz) || 1; } }); } return { d, sgn }; };
            const want = ({ d, sgn }) => !(d < e.halfW + 2.2) || d < 1.2 ? null : { near: sgn > 0 ? 'wR' : 'wL', nw: Math.max(1.75, d - 2.2) };
            const up = want(nearestOf(tgUp)), any = want(nearestOf(tg)), pick = up ? (any && any.near === up.near ? { near: up.near, nw: Math.min(up.nw, any.nw) } : up) : any;
            if (!pick) continue;
            const { near, nw } = pick, far = near === 'wR' ? 'wL' : 'wR', total = e.wL + e.wR;
            if (nw >= e[near] - 0.05) continue;
            e[near] = nw; e.laneW = (e.wL + e.wR) / Math.max(1, e.lanesF + e.lanesB); if (!e.roadWidthSource) e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); e.tramClearShift = true; // (owner, 2026-11-12, Grozavesti (931, -1147), (603, -877): the lanes kept starting at the old left edge, so the outer lane ran onto the tram slab / into the railing; one-way lanes start at the narrowed edge) e.tram = false; tramShifted++; void far; void total;
        }
        if (tramShifted) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.tramClearShift = tramShifted; }
        // (owner register #50 Romana: "building intersects street", #22 / #35 Unirii, L8) the default width of a street can be wider than
        // the space between real OSM footprints (Strada Caderea Bastiliei: 1.3 m into a building). The footprint is the source; a
        // street side that runs into ground-level footprints along more than a quarter of its length narrows to 0.3 m off the wall,
        // never below 2.6 m per lane on that side. Bridges, tunnels and edges without a building beside them are unchanged.
        {
            const BO = (data.version || 1) >= 2 ? 9 : 6, fps = [], fg = new BoxGrid(24);
            for (const [i, b] of (data.buildings || []).entries()) {
                const minH = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10; if (minH > 2.5) continue; // (an overhang or a passage over the street)
                const ring = data.buildingFootprints?.[i] || undelta(b, BO); if (!ring || ring.length < 3) continue;
                const xs = ring.map(q => q[0]), zs = ring.map(q => q[1]); fg.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), ring); fps.push(ring);
            }
            const inFp = (x, z) => { let hit = false; fg.each(x, z, x, z, r => { if (!hit && pointInPolygon(x, z, r)) hit = true; }); return hit; };
            let narrowed = 0;
            for (const e of edges) {
                if (e.virtual || e.bridge || e.tunnel || e.len < 4) continue;
                const lanesSide = sd => e.oneway ? Math.max(1, e.lanesF + e.lanesB) : Math.max(1, sd > 0 ? e.lanesF : e.lanesB); let changed = false;
                for (const sd of [1, -1]) {
                    const key = sd > 0 ? 'wR' : 'wL', w = e[key]; let n = 0, hits = 0, need = w;
                    for (let st = 1; st < e.len - 1; st += 1.5) {
                        n++; const x0 = e.a.x + e.dirx * st, z0 = e.a.z + e.dirz * st;
                        if (!inFp(x0 + e.nx * sd * w, z0 + e.nz * sd * w)) continue;
                        if (inFp(x0, z0)) continue; // (the centre line itself inside a footprint there: a covered way, not a width question)
                        hits++; let lo = 0, hi = w; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (inFp(x0 + e.nx * sd * m, z0 + e.nz * sd * m)) hi = m; else lo = m; }
                        need = Math.min(need, lo);
                    }
                    if (hits < 0 || !n || (hits / n < .25 && hits * 1.5 < 3)) continue; // (a quarter of the side, or 3 m of it)
                    const other = sd > 0 ? e.wL : e.wR, minSide = e.oneway ? Math.max(1.3, 2.6 * lanesSide(sd) - other) : 2.6 * lanesSide(sd); // (one-way lanes span both sides)
                    const nw = Math.max(minSide, need - .3);
                    if (nw < w - .15) { e[key] = nw; narrowed++; changed = true; }
                }
                if (changed) { e.laneW = Math.min(e.laneW, (e.wL + e.wR) / Math.max(1, e.lanesF + e.lanesB)); if (e.oneway && !e.roadWidthSource) e.median = -2 * e.wL; e.halfW = Math.max(e.wL, e.wR); e.footprintNarrowed = true; }
            }
            if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5; sccInfo.footprintNarrowed = narrowed; }
        }
    }

    // ---- vertical profile. Only real grade separations are lifted / lowered:
    //      * a bridge is raised only where it actually passes over (crosses or is stacked above) another road
    //        that does not share a junction with it — river / rail bridges stay at grade (OSM tags them layer=1,
    //        which used to lift them 6 m and drag the riverside roads up with them: the "slab" across Splaiul
    //        Independenței at Grozăvești);
    //      * tunnels are lowered (−6 m per layer);
    //      * the roads they pass over / under are pinned at their own level;
    //      * ramps are the "max of cones" around the anchors, along the connected graph (9 % grade on the
    //        approaches, ~3 % along bridge decks so viaducts stay up between the roads they cross).
    //      node.y / edge.ya / edge.yb are the vertical displacement of the road surface (asphalt top = 0.24 + y).
    const CLEAR = 6, GRADE = 0.09;
    const coveredRoadModels = buildCoveredRoadModels(data);
    for (const e of edges) if (coveredRoadModels.isCovered(e)) {
        e.coveredRoadModel = coveredRoadModels.accepted.find(m => m.roadIndices.includes(e.road)).id;
        e.modelLayer = 0; // source tunnel=yes still means cover; no underground metre datum
    }
    // (owner, 2026-11-11, Grozavesti (886, -1090) "WTF?", "SAME FOR UNDERGROUND PASSAGES"; Street View at 44.45084, 26.07040:
    // Soseaua Nicolae Titulescu runs at street level under the Basarab viaduct) OSM tunnel=passage / building_passage on
    // layer 0 is a way at street level under a structure (here a service drive under the viaduct, w1295846860), not a dug
    // tunnel: taken as a tunnel it was anchored 6 m down and dragged both Titulescu carriageways into a 5 m trench.
    // The same for a tunnel explicitly mapped on layer 0 (register #45, Pipera: a covered drive, tunnel=yes covered=yes layer=0,
    // w1284446130, pulled Soseaua Pipera and the Calea Floreasca junction 1.2-4 m down under Podul Barbu Vacarescu, where Street
    // View at 44.47973, 26.10135 shows them at street level): a covered way at street level.
    for (const e of edges) { const t = data.roadSourceGeometry?.[e.road]?.tags; if (e.tunnel && t && (/^(passage|building_passage)$/.test(t.tunnel) ? !(Number(t.layer) < 0) : t.layer !== undefined && Number(t.layer) === 0)) { e.tunnel = false; e.sourcePassage = true; } }
    // (owner, 2026-11-12, Otopeni (-89, -499) "underpass leads to a dead end"; OSM w1395443535: a service way tagged tunnel=yes
    // layer=-1 whose two ends are nodes of the airport station building w813193384, building on layer 1 with min_height=5,
    // between two untagged ground-level service ways) a tunnel way that lies wholly under one building raised at least 4 m
    // off the ground is the street-level passage under that building, not a dug tunnel: anchored 6 m down it sank the whole
    // service road into a pit with no way out.
    {
        const BO = (data.version || 1) >= 2 ? 9 : 6, rg = new BoxGrid(48); let any = false;
        for (const [i, b] of (data.buildings || []).entries()) {
            const minH = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10; if (!(minH >= 4)) continue;
            const ring = data.buildingFootprints?.[i] || undelta(b, BO); if (!ring || ring.length < 3) continue;
            const xs = ring.map(q => q[0]), zs = ring.map(q => q[1]); rg.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), ring); any = true;
        }
        if (any) {
            const byRoad = new Map();
            for (const e of edges) if (e.tunnel && !e.virtual && !e.coveredRoadModel) { if (!byRoad.has(e.road)) byRoad.set(e.road, []); byRoad.get(e.road).push(e); }
            for (const es of byRoad.values()) {
                let common = null; // the raised footprints that cover every sample of the way
                for (const e of es) for (const t of [.15, .5, .85]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t, here = new Set();
                    rg.each(x, z, x, z, r => { if (pointInPolygon(x, z, r)) here.add(r); });
                    common = common ? new Set([...common].filter(r => here.has(r))) : here;
                }
                if (common?.size) for (const e of es) { e.tunnel = false; e.sourcePassage = true; }
            }
        }
    }
    const crossings = []; // {u (upper), f (lower), x, z}
    let profileStats = null, profileStats0 = null, wallCut = 0, blocksLane = null;
    {
        for (const e of edges) { e.L = e.virtual || e.coveredRoadModel ? 0 : Math.max(-2, Math.min(3, e.bridge ? Math.max(1, e.layer) : e.tunnel ? Math.min(-1, e.layer) : 0)); e.over = null; e.anchorH = 0; }
        if (distId) for (const e of edges) { const k = reviewedGradeK(city.id + '-' + distId, data.roadSourceGeometry?.[e.road]?.sourceId); if (k) e.gradeK = k; } // (reviewed approach-ramp length: grade-review.js)
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
                    edgesInBox(x - 14, z - 14, x + 14, z + 14, (f) => {
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
                    for (let t = 0; t <= 1 + 1e-6; t += step) {
                        const tt = Math.min(t, 1);
                        // (inside its asphalt edge: overlapping ribbons; just beyond it: the audit's cliff sample)
                        for (const [s, off] of [[1, wA(e, 1) - 0.5], [-1, wA(e, -1) - 0.5], [1, (e.bridge ? wA(e, 1) + 0.3 : wS(e, 1)) + 0.6], [-1, (e.bridge ? wA(e, -1) + 0.3 : wS(e, -1)) + 0.6]]) {
                            const x = e.a.x + e.dirx * e.len * tt + e.nx * off * s, z = e.a.z + e.dirz * e.len * tt + e.nz * off * s;
                            edgesInBox(x - 1, z - 1, x + 1, z + 1, (f) => {
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
    const pad = distId ? 40 : (city.bounds?.pad ?? 300);
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
            if (!distId) continue; // (1:1 districts only: the legacy compressed world keeps its flat ground)
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
            const v0 = target.vc; target.flatPoly(pts, tris, chan ? chanP.water : y, chan ? rgb('#3c4a42') : col, 0.02); a.waterMesh = { mb: target, v0, v1: target.vc };
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
        for (const a of areas) {
            if (!/^(pitch|turf|clay|hard|pool)$/.test(a.kind) || a.size < 60 || a.size > 20000) continue;
            if (landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) continue;
            if (a.kind !== 'pool' && holdsOthers(a)) continue;
            const R = minRect(a.outer); if (!R || a.size / R.A < 0.8) continue;
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
    // green ground (district worlds, 2026-11-08): gardens, lawns, courtyards and the ground under the crowns, measured on
    // aerial imagery (data.green raster, build-data / tools/aerial/trees.py), as grass quads under everything paved —
    // the quarter's private gardens were bare grey ground. Runs merged across rows into rectangles.
    let greenQuads = 0;
    if (data.green?.rle) {
        const G = data.green, base = rgb(shadeHex(env.grass, 0.94)), gr = makeRng(4421);
        const open = new Map(); // "c:n" → {c, n, r0}
        const flush = (o, r1) => {
            const x0 = G.x0 + o.c * G.cx, x1 = G.x0 + (o.c + o.n) * G.cx, z0 = G.z0 + o.r0 * G.cz, z1 = G.z0 + r1 * G.cz;
            const k = 0.9 + gr() * 0.16, col = [Math.round(base[0] * k), Math.round(base[1] * (k + 0.02)), Math.round(base[2] * k)];
            const gq = cellOf((x0 + x1) / 2, (z0 + z1) / 2).grass;
            // (the aerial green raster also sees grass on the banks of open trenches, and lawn in the green water of a
            // sunken river channel: cut it out of them like the areas)
            const quad = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
            if (groundCutsAt(quad, x0, z0, x1, z1).length) { const cut = cutTrenches(quad, [[0, 1, 2], [0, 2, 3]]); if (cut.tris.length) gq.flatPoly(cut.pts, cut.tris, Y.grass + 0.004, col, 0.1); }
            else gq.flatQuad(x0, z0, x1, z0, x1, z1, x0, z1, Y.grass + 0.004, col, 0.1);
            greenQuads++;
        };
        let r = 0, c = 0, cur = 0; let rowRuns = [];
        // (owner, 2026-11-12, Unirii: "random green patches on the water") from the air a river is as green as a lawn, and
        // the raster marks cells on the Dâmbovița. No green cell is drawn on mapped water: the columns of a row that a
        // water polygon touches (on the cell row's top, middle or bottom line) are taken out of its runs.
        const waterAreas = areas.filter(a => a.kind === 'water').concat(pavedReviewAreas(city.id + '-' + distId, (la, lo) => city.proj(la, lo))); // (+ squares reviewed as paved: ground-review.js)
        let rowWater = null;
        const waterCols = () => { // sorted, merged [c0, c1) column spans of row r on water
            const spans = [];
            for (const f of [0.02, 0.5, 0.98]) {
                const z = G.z0 + (r + f) * G.cz;
                for (const a of waterAreas) {
                    if (z < a.z0 || z > a.z1) continue;
                    const xs = [];
                    for (const ring of a.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                        const [xi, zi] = ring[i], [xj, zj] = ring[j];
                        if ((zi > z) !== (zj > z)) xs.push(xi + (xj - xi) * (z - zi) / (zj - zi));
                    }
                    xs.sort((p, q) => p - q);
                    for (let k = 0; k + 1 < xs.length; k += 2) spans.push([Math.floor((xs[k] - G.x0) / G.cx), Math.floor((xs[k + 1] - G.x0) / G.cx) + 1]);
                }
            }
            spans.sort((p, q) => p[0] - q[0]);
            const merged = [];
            for (const s of spans) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([s[0], s[1]]); }
            return merged;
        };
        const pushRun = (c0, n) => {
            if (waterAreas.length) {
                rowWater ??= waterCols();
                let a = c0; const end = c0 + n;
                for (const [w0, w1] of rowWater) {
                    if (w1 <= a) continue; if (w0 >= end) break;
                    if (w0 > a) rowRuns.push([a, w0 - a]);
                    a = Math.max(a, w1); if (a >= end) return;
                }
                if (a < end) rowRuns.push([a, end - a]);
            } else rowRuns.push([c0, n]);
        };
        const endRow = () => {
            const seen = new Set();
            for (const [c2, n2] of rowRuns) { const key = c2 + ':' + n2; seen.add(key); if (!open.has(key)) open.set(key, { c: c2, n: n2, r0: r }); }
            for (const [key, o] of open) if (!seen.has(key)) { flush(o, r); open.delete(key); }
            rowRuns = []; rowWater = null; r++; c = 0; cur = 0;
        };
        for (const v of G.rle) { if (v < 0) { endRow(); continue; } if (cur && v > 0) pushRun(c, v); c += v; cur ^= 1; }
        for (const o of open.values()) flush(o, r);
    }
    // Exact mapped water banks take precedence over fallback centreline widths.
    const waterLineAudit = [];
    for (const [lineIndex, l] of data.lines.entries()) {
        const source = data.lineSources?.[lineIndex], kind = data.lineKinds[l[0]], w = source?.widthM > 0 ? source.widthM : l[1] / 10, pts = source?.points?.length >= 2 ? source.points : undelta(l[3], 0);
        const airfield = kind === 'runway' || kind === 'taxiway';
        const audit = airfield ? null : { lineIndex, sourceId: source?.sourceId || `prepared-line:${lineIndex}`, kind, preparedWidthM: w, widthSource: source?.widthSource || 'legacy prepared width; raw provenance unavailable', sourceLengthM: 0, coveredByMappedWaterM: 0, renderedFallbackM: 0, unresolvedBoundaryM: 0, mappedSources: [] };
        if (audit) waterLineAudit.push(audit);
        const col = rgb(kind === 'runway' ? '#4f5156' : kind === 'taxiway' ? '#5d5f63' : env.water);
        const y = kind === 'runway' || kind === 'taxiway' ? Y.parking + 0.012 : Y.water - 0.005;
        for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
            const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
            const tgt = kind === 'runway' || kind === 'taxiway' ? cellOf(ax, az).pave : cellOf(ax, az).water;
            const inChan = channelAreas.length && kind !== 'runway' && kind !== 'taxiway' && channelAreas.find(c2 => inArea(c2, (ax + bx) / 2, (az + bz) / 2)); // (the river line inside the sunken channel)
            let spans = [{ a: [ax, az], b: [bx, bz], length: L }];
            if (audit) {
                const candidates = new Set(); waterGrid.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), area => candidates.add(area));
                const selection = uncoveredWaterLine([ax, az], [bx, bz], [...candidates]); spans = selection.outside;
                // A known bank plus an explicitly unmeasured width cannot justify
                // painting land at a conflicting source endpoint. Keep the source
                // line and report that unresolved span, using the mapped surface.
                if (selection.covered.length && source?.widthSource?.startsWith('estimate:')) { audit.unresolvedBoundaryM += spans.reduce((sum, span) => sum + span.length, 0); spans = []; }
                audit.sourceLengthM += L; audit.coveredByMappedWaterM += selection.coveredLength;
                audit.renderedFallbackM += spans.reduce((sum, span) => sum + span.length, 0);
                for (const source of selection.covered.flatMap(span => span.sourceIds)) if (!audit.mappedSources.includes(source)) audit.mappedSources.push(source);
            }
            for (const span of spans) { const [x0, z0] = span.a, [x1, z1] = span.b; tgt.flatQuad(x0 + nx, z0 + nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, x0 - nx, z0 - nz, inChan ? (inChan.chanProfile || CHAN).water - 0.01 : y, col, 0.05); }
            if (kind === 'runway') for (let s = 10; s < L - 10; s += 50) { const ux = (bx - ax) / L, uz = (bz - az) / L; const cx = ax + ux * s, cz = az + uz * s; const hw = 0.5, hl = 15; cellOf(cx, cz).marks.flatQuad(cx - uz * hw, cz + ux * hw, cx - uz * hw + ux * hl * 2, cz + ux * hw + uz * hl * 2, cx + uz * hw + ux * hl * 2, cz - ux * hw + uz * hl * 2, cx + uz * hw, cz - ux * hw, y + 0.02, rgb('#e8e8e8')); }
        }
    }

    // -----------------------------------------------------------------------
    //  ROADS
    // -----------------------------------------------------------------------
    setProgress('Paving the streets…'); await tick();
    // asphalt albedo (linear vertex colour): weathered asphalt is ≈ 0.09–0.15, so the road reads mid-grey in shade
    // and does not wash out in sun under ACES. Bucharest: lighter, sun-bleached, patched; Seattle: darker, wetter
    // asphalt, and Portland-cement concrete panels on the motorway main lines (I-5 / I-405 / SR-518).
    // (env.asphalt, the old near-black [7, 8, 9] in Seattle, is no longer used for carriageways)
    const ASPHALT = US ? '#535250' : '#5d5c5a', CONCRETE = '#7c7a76'; // (render's AgX + SH ambient target: albedo ≈ 0.08–0.12) // (slightly warm: the sky-lit shade is blue)
    const asphaltBase = rgb(ASPHALT), concreteCol = rgb(CONCRETE);
    const sideCol = shadeRgb(rgb(env.sidewalk), 0.8); // (QA r2: sidewalks read snow-white under AgX; paving albedo ≈ 0.3)
    const kerbCol = shadeRgb(rgb(env.sidewalk), 1.18);
    const white = rgb('#e9e9e6'), yellow = rgb('#e3b341'), busCol = rgb('#8a3b34'), railCol = rgb('#55524e'), ballastCol = rgb('#6d6861');
    const layerY = () => 0; // real heights are applied per vertex (node.y), see displace()
    const isConcrete = (e) => US && e.type === 'motorway';
    // US ramps: concrete where they leave / join the motorway (they overlap it at the gore), fading to asphalt over
    // 40–120 m along the ramp, so neither the gore nor the ramp terminal shows a two-colour slab (review #2)
    // distance along the ramps from the motorway (dM) and from the street network (dA): concrete at the motorway end,
    // asphalt at the street end, a smooth blend between (no light slab where an off-ramp meets an arterial deck)
    const rampDist = (seed) => {
        const dist = new Map(), q = [];
        for (const n of nodeArr) if (n.edges.some(seed)) { dist.set(n, 0); q.push(n); }
        while (q.length) {
            const n = q.shift(), d0 = dist.get(n);
            for (const e of n.edges) { if (e.type !== 'motorway_link' || e.virtual) continue; const o = e.a === n ? e.b : e.a, d = d0 + e.len; if (d < (dist.get(o) ?? Infinity) && d < 400) { dist.set(o, d); q.push(o); } }
        }
        return dist;
    };
    const dMot = US ? rampDist(isConcrete) : new Map(), dArt = US ? rampDist(e => !e.virtual && !/^motorway/.test(e.type)) : new Map();
    const mixCol = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    const nodeSurf = (n) => {
        const m = dMot.get(n); if (m == null) return asphaltBase;
        const a = dArt.get(n) ?? 400, t = clamp((m - 25) / Math.max(1, m + a - 50), 0, 1);
        return mixCol(concreteCol, asphaltBase, t * t * (3 - 2 * t));
    };
    const asphaltOf = (e) => { // (one shade per class family: overlapping ribbons of one colour cannot flicker)
        if (e.unpaved) return rgb('#6b645b');
        if (isConcrete(e)) return e.tunnel ? shadeRgb(concreteCol, 0.85) : concreteCol;
        return e.tunnel ? shadeRgb(asphaltBase, 0.85) : asphaltBase;
    };
    /** [colour at a, colour at b] of a carriageway (ramps fade) */
    const asphaltEnds = (e) => (US && e.type === 'motorway_link' && !e.tunnel) ? [nodeSurf(e.a), nodeSurf(e.b)] : [asphaltOf(e), asphaltOf(e)];
    const padAsphalt = (n) => { const es = n.edges.filter(f => !f.virtual); const cc = es.filter(isConcrete).length; if (cc * 2 >= es.length && cc) return concreteCol; if (es.length && es.every(f => f.tunnel)) return shadeRgb(asphaltBase, 0.85); return es.some(f => f.type === 'motorway_link') ? nodeSurf(n) : asphaltBase; };
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
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; sccInfo.raisedBesideStreet = narrowed; }
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
        if (narrowed) { for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + .5; sccInfo.narrowedBesideTram = narrowed; }
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
            const kept=own?clipMarkingConvex(input,own):input, ownedArea=markingArea(kept), blockers=[], seen=new Set();
            if(kept.length){
                const xs=kept.map(p=>p[0]),zs=kept.map(p=>p[1]);let unsupported=false;
                const kx0=Math.min(...xs),kz0=Math.min(...zs),kx1=Math.max(...xs),kz1=Math.max(...zs);
                surfGrid.each(kx0,kz0,kx1,kz1,o=>{
                    if(o.e===e||seen.has(o))return;seen.add(o);
                    // (spec 10 load budget) the clip keeps only points within its tolerance of every edge of o.poly (shrunk by
                    // the inset): bounds farther apart than that tolerance leave no region, as clipMarkingConvex finds
                    const m=surfMargin(o);if(kx0>o.x1+m||kx1<o.x0-m||kz0>o.z1+m||kz1<o.z0-m)return;
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
    // (2026-11-08, owner: "parked cars look sunk", then "do the sidewalks") realPass districts: sidewalks at the kerb's height
    // (Y.road + Y.kerb) instead of 0.22 m below it — the top of every sidewalk band, the junction corners between them, the
    // physics (surfacesAt → walkers, the car mounting a kerb), the crowd and everything standing on a sidewalk (DY_SIDE)
    const raisedEdge = (e, side = null) => realPass && !e.virtual && (side == null ? Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) : sidewalkWidth(e, side)) > 0.3 && !isMotorwayTrunk(e.type) && !e.tunnel && !e.bridge;
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
        const bridgeGuard = e.bridge && data.roadGeometryPolicy === 'source' && /^w\d+$/.test(bridgeGuardSourceId || '') ? new MeshBuilder() : null;
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
        if (!hasSide && (e.bridge || elevated) && !e.tunnel) {
            // (round 6 note 52) decks / ramps without a walkway: a concrete edge strip from the asphalt to under the barrier
            // (it stands 0.3 m out) — the gap showed the ground / the void below the deck as a black band
            // per side, and only where the strip would not lie over another road (a gore with a ramp at another height)
            const wE = (ed, sd) => widthAsphalt(ed, sd) + 0.45, wI = (ed, sd) => Math.max(0.1, widthAsphalt(ed, sd) - 0.05);
            for (const sd of [1, -1]) {
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
                    sidePieces.push({ q: right ? [o0, o1, i1, i0] : [i0, i1, o1, o0], covered: coveredByOther(mx2, mz2, e, yAlong(e, mx2, mz2), 0.02, false, 0.6) });
                }
            }
            if (!sidePieces.some(p => p.covered)) c.ground.flatQuad(sa[0], sa[1], sb[0], sb[1], tb[0], tb[1], ta[0], ta[1], yS, sideCol2, 0.25);
            else for (const { q, covered } of sidePieces) if (!covered) c.ground.flatQuad(q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1], yS, sideCol2, 0.25);
            if (e.a.pad) { if (sidewalkWidth(e, 1) > .3) pushPad(e.a, 'side', sa); if (sidewalkWidth(e, -1) > .3) pushPad(e.a, 'side', ta); }
            if (e.b.pad) { if (sidewalkWidth(e, 1) > .3) pushPad(e.b, 'side', sb); if (sidewalkWidth(e, -1) > .3) pushPad(e.b, 'side', tb); }
            // kerbs: raised strip + vertical face along both edges
            if (!isMotorwayTrunk(e.type) && !e.tunnel) {
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
                    // (2026-11-08, realPass districts) the sidewalk itself at the kerb's height: its top from the kerb strip to the
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
                            if (!backCov(f0) && !backCov(f1) && !backCov(lp(f0, f1, 0.5)) && !backCov(lp(w0, f0, 0.5)) && !backCov(lp(w1, f1, 0.5))) c.ground.face4([w0[0], top, w0[1]], [w1[0], top, w1[1]], [f1[0], Y.landuse + 0.01, f1[1]], [f0[0], Y.landuse + 0.01, f0[1]], sideCol, [e.nx * s * 0.34, SL, e.nz * s * 0.34]);
                            else c.ground.wall(w0[0], w0[1], w1[0], w1[1], Y.landuse - 0.02, top, e.nx * s, e.nz * s, shadeRgb(sideCol, 0.8));
                            raisedPieces++;
                        };
                        const clear = (o0, o1, w0, w1, fs) => { for (const f of fs) { const p1 = lp(o0, o1, f), p2 = lp(w0, w1, f); if (cov(p1) || cov(p2) || cov(lp(p1, p2, 0.5))) return false; } return true; };
                        const F5 = [0, 0.25, 0.5, 0.75, 1], F3 = [0, 0.5, 1];
                        for (let j = 0; j < k; j++) {
                            const o0 = lp(oa, ob, j / k), o1 = lp(oa, ob, (j + 1) / k), w0 = lp(sa2, sb2, j / k), w1 = lp(sa2, sb2, (j + 1) / k);
                            if (clear(o0, o1, w0, w1, F5)) { swq(o0, o1, w0, w1); continue; }
                            const m = Math.max(1, Math.ceil(Math.hypot(o1[0] - o0[0], o1[1] - o0[1]) / 0.8));
                            for (let q = 0; q < m; q++) { const a0 = lp(o0, o1, q / m), a1 = lp(o0, o1, (q + 1) / m), b0 = lp(w0, w1, q / m), b1 = lp(w0, w1, (q + 1) / m); if (clear(a0, a1, b0, b1, F3)) swq(a0, a1, b0, b1); }
                        }
                    }
                    if (raise) for (const n of [e.a, e.b]) { // a raised sidewalk that just stops (dead end, map edge): close its end
                        if (n.pad || n.edges.filter(f => !f.virtual).length !== 1) continue;
                        const [ki, wo] = n === e.a ? [oa, sa2] : [ob, sb2], ri = n === e.a ? ia : ib, out = n === e.a ? -1 : 1;
                        c.ground.wall(ri[0], ri[1], wo[0], wo[1], Y.landuse - 0.02, top, e.dirx * out, e.dirz * out, shadeRgb(sideCol, 0.8));
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
                if (realPass) { // (2026-11-08, Street View walk of Calea Floreasca) plain asphalt behind a wide solid line, not red paint (red only on the boulevards that have it)
                    const wl = rgb('#ecebe6');
                    if (evenLanes) { const o = -e.wL + Wc * (nEff - 1) / nEff; band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); } // (on the last divider of the evenly marked lanes)
                    else if (e.lanesF > 1) { const o = shift + med2 + e.laneW * (e.lanesF - 1); band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                    if (e.lanesB > 1) { const o = shift - (med2 + e.laneW * (e.lanesB - 1)); band(longM, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                } else {
                    if (e.lanesF > 1) band(longM, e, s0, s1, shift + med2 + e.laneW * (e.lanesF - 1), shift + med2 + e.laneW * e.lanesF, yM - 0.004, busCol);
                    if (e.lanesB > 1) band(longM, e, s0, s1, shift - (med2 + e.laneW * (e.lanesB - 1)), shift - (med2 + e.laneW * e.lanesB), yM - 0.004, busCol);
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
                for (let i = 1; i < nEff; i++) if (!(e.busLane && realPass && i === nEff - 1)) dashLine(longM, e, s0, s1, -e.wL + Wc * i / nEff, yM, white, dash[0], dash[1], hw);
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
                    dashLine(edgeM, e, s0, s1, -(e.wL - 0.15), yM, (US && e.oneway && isMotorwayTrunk(e.type)) ? yellow : white, Math.min(1, s1 - s0), 0, 0.08);
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
        const resLamp = !US && realPass && /^(residential|unclassified|living_street)$/.test(e.type);
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
    const tramHallPieces = []; let hallRoads = null;
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
    // raised junction corners (realPass): between two neighbouring sidewalk ends round a pad, a quad from one end (asphalt
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
            if (r1.e.name && r1.e.name === r2.e.name && Math.abs(r1.e.dirx * r2.e.dirx + r1.e.dirz * r2.e.dirz) > 0.9) { skip('median'); continue; } // (the two halves of a dual carriageway)
            const inP = (p, f = 0.3) => { const l = Math.hypot(cx - p[0], cz - p[1]) || 1; return [p[0] + (cx - p[0]) / l * f, p[1] + (cz - p[1]) / l * f]; };
            const smp = [[cx, cz], ...q.map(v => inP(v)), ...q.map((v, k) => inP([(v[0] + q[(k + 1) % 4][0]) / 2, (v[1] + q[(k + 1) % 4][1]) / 2]))];
            if (smp.some(([x, z]) => coveredByOther(x, z, null, padHeightAt(n, x, z), 0.02))) { skip('covered'); continue; }
            const hy = (x, z) => Y.road + Y.kerb + padHeightAt(n, x, z), base = mb.vc;
            for (const [x, z] of q) mb.v(x, hy(x, z), z, 0, 1, 0, x * 0.25, z * 0.25, sideCol);
            mb.triUp(base, base + 1, base + 2); mb.triUp(base, base + 2, base + 3);
            const tn = (a, b, away) => { const mx = (a[0] + b[0]) / 2 - n.x, mz = (a[1] + b[1]) / 2 - n.z, l = Math.hypot(mx, mz) || 1; return away ? [mx / l, mz / l] : [-mx / l, -mz / l]; };
            { const [nx, nz] = tn(q[3], q[0], false); mb.wall(q[3][0], q[3][1], q[0][0], q[0][1], Y.road - 0.01 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(kerbCol, 0.85)); }   // kerb face toward the pad
            { const [nx, nz] = tn(q[1], q[2], true), f1 = [q[1][0] + nx * 2.4, q[1][1] + nz * 2.4], f2 = [q[2][0] + nx * 2.4, q[2][1] + nz * 2.4], yg = Y.landuse + 0.01 + padHeightAt(n, cx, cz); // back: a 2.4 m slope (a face where it would land on a road)
              if (![f1, f2].some(([x, z]) => coveredByOther(x, z, null, padHeightAt(n, x, z), 0.02))) mb.face4([q[1][0], hy(q[1][0], q[1][1]), q[1][1]], [q[2][0], hy(q[2][0], q[2][1]), q[2][1]], [f2[0], yg, f2[1]], [f1[0], yg, f1[1]], sideCol, [nx * 0.34, 2.4, nz * 0.34]);
              else mb.wall(q[1][0], q[1][1], q[2][0], q[2][1], Y.landuse - 0.02 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(sideCol, 0.8)); }
            const cp = { p: q, n, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) };
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
    /** (realPass) top of the raised sidewalk at (x, z): a sidewalk band of a raised edge (between its asphalt edge and the
     *  property line, + tol: fences / hedges standing on the back edge) or a raised junction corner, never on a carriageway /
     *  pad → height (with the street's profile) or null */
    const RIB_ONLY = () => true;
    const raisedTop = (x, z, tol = 0) => {
        if (!realPass) return null;
        let top = null;
        cornerGrid.each(x - tol, z - tol, x + tol, z + tol, (cp) => {
            if (top !== null || x < cp.x0 - tol || x > cp.x1 + tol || z < cp.z0 - tol || z > cp.z1 + tol) return;
            if (pointInPolygon(x, z, cp.p) || (tol > 0 && polyDist(x, z, cp.p) < tol)) top = Y.road + Y.kerb + padHeightAt(cp.n, x, z);
        });
        if (top === null) edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (top !== null || !raisedEdge(e)) return;
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z); if (q.t <= 0 || q.t >= 1) return;
            const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1, wa = widthAsphalt(e, side) + sideExtra(e, side, q.t * e.len);
            if (!raisedEdge(e, side) || q.d < wa + 0.02 || q.d > wa + sidewalkWidth(e, side) + SIDE_BACK + tol) return;
            top = railRoadside.surface(e, x, z, Y.road + Y.kerb + yAlong(e,x,z));
        });
        if (top !== null && onRibbon(x, z, 0, RIB_ONLY)) return null;
        return top;
    };
    /** vertices added to a cell's solid / detail builders since (v0s, v0d) lifted onto the raised sidewalk when (x, z) is on one */
    const liftOnSide = (c, v0s, v0d, x, z, tol = 0) => {
        if (!realPass || raisedTop(x, z, tol) === null) return false;
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
    let basarabDeckSet = null;
    const basarabDeck = e => {
        if (!basarabDeckSet) {
            basarabDeckSet = new Set(edges.filter(f => basarabEdge(data, f))); const todo = [...basarabDeckSet];
            while (todo.length) { const e2 = todo.pop(); for (const n of [e2.a, e2.b]) for (const f of n.edges) if (!basarabDeckSet.has(f) && f.bridge && !f.virtual && !f.tunnel && Math.max(f.ya, f.yb) > .3) { basarabDeckSet.add(f); todo.push(f); } }
        }
        return basarabDeckSet.has(e);
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
                if (!up && !dn && plainMw) {
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
                const sib = distId && rb.e && w.edge && ((/_link$/.test(rb.e.type) && /_link$/.test(w.edge.type)) || rb.e.bridge || w.edge.bridge) && (rb.e.a === w.edge.a || rb.e.a === w.edge.b || rb.e.b === w.edge.a || rb.e.b === w.edge.b);
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
            if(w.kind==='rail'&&w.edge&&basarabDeck(w.edge)){} // (drawn after the guard completion, its joins and the width-step tapers: see there)
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
            if (w.inferred === true && w.edge && basarabDeck(w.edge)) continue; // (owner, 2026-11-12, (77, 112): grey piece on a 2.4 m ramp too) // (replaced by the continuous guard: see the guard completion below)
            const ya = w.y0a + 0.45, yb = w.y0b + 0.45, L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1, px = -(w.bz - w.az) / L * 0.15, pz = (w.bx - w.ax) / L * 0.15;
            const c = cellOf(w.x, w.z);
            const metadata={inferred:w.inferred===true,emitter:'separation-barrier',sourceId:data.roadSourceGeometry?.[w.edge?.road]?.sourceId,edgeId:w.edge?.id};
            // (reviewed guard class of a bridge way, bridge-guards.js: the concrete part keeps this owned emission at the class's height, the steel part is added above it)
            const gRow = w.inferred === true && w.edge?.bridge ? bridgeGuardRow(metadata.sourceId) : null, gH = gRow && guardBlockH(gRow) != null ? guardBlockH(gRow) - .25 : .9, gCol = gH !== .9 ? GUARD_CONCRETE : barrierCol;
            for (const sd of [1, -1]) emitOwnedSeparationQuad(c.solid,[[w.ax + px * sd, ya, w.az + pz * sd], [w.bx + px * sd, yb, w.bz + pz * sd], [w.bx + px * sd, yb + gH, w.bz + pz * sd], [w.ax + px * sd, ya + gH, w.az + pz * sd]],shadeRgb(gCol,sd>0?1:.9),[px*sd,0,pz*sd],metadata,parapetOwnership);
            emitOwnedSeparationQuad(c.solid,[[w.ax + px, ya + gH, w.az + pz], [w.bx + px, yb + gH, w.bz + pz], [w.bx - px, yb + gH, w.bz - pz], [w.ax - px, ya + gH, w.az - pz]],shadeRgb(gCol,1.08),[0,1,0],metadata,parapetOwnership);
            if (gH !== .9) emitGuardSteel(c.detail, w.ax, w.az, w.bx, w.bz, ya - .25, yb - .25, gRow);
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
    const sourceBoundaryPolygons = data.district && data.roadGeometryPolicy === 'source' ? ribbons.flatMap(rb => {
        const ownerEdges = rb.e ? sourceCoreEdge(rb.e) ? [rb.e] : [] : (rb.node?.edges || []).filter(sourceCoreEdge);
        if (!ownerEdges.length) return [];
        const poly = rb.poly.map(([x, z], i) => [x, Y.road + (rb.e ? yAlong(rb.e, x, z) : rb.hs?.[i] ?? padHeightAt(rb.node, x, z)), z]);
        return [{ poly, ownerEdges, sourceId: rb.e ? data.roadSourceGeometry[rb.e.road].sourceId : 'source-junction-pad' }];
    }) : [];
    const boundarySupport = buildSourceBoundarySupport(sourceBoundaryPolygons);
    dmask = boundarySupport.extendMask(dmask);
    if (dmask) Object.assign(bounds, { minX: dmask.x0 - pad, minZ: dmask.z0 - pad,
        maxX: dmask.x0 + dmask.w * dmask.cell + pad, maxZ: dmask.z0 + dmask.h * dmask.cell + pad });
    // ---- district edge (chapters): every road cut at the district boundary ends in a red/white "road closed" barrier
    //      with a solid wall across it (kind 'end'); the inside-mask outline is an invisible wall (kind 'boundary')
    const mapEnds = [];
    if (data.district) {
        // (after round 6) the boundary cuts + every other dead end of a through road (a road whose continuation was dropped:
        // "the road stops without indication") — service lanes / living streets / short stubs are left as they are
        const endIdx = new Set(data.district.ends || []);
        nodeArr.forEach((n, i) => { if (!n || endIdx.has(i)) return; const real = n.edges.filter(f => !f.virtual && f.publicDrive !== false); if (real.length !== 1) return; const e = real[0];
            if (/service|living_street|track|path|footway|pedestrian|parking/.test(e.type || '') || (e.len || 0) < 25) return; endIdx.add(i); });
        const candidates = [];
        for (const i of endIdx) {
            const n = nodeArr[i]; const real = n ? n.edges.filter(f => !f.virtual && f.publicDrive !== false) : []; if (real.length !== 1) continue; // (a U-turn connector may join a cut dual carriageway)
            const e = real[0];
            const out = e.a === n ? 1 : -1; // into the edge (= into the map)
            // road direction over the last ~20 m (a short, skewed last OSM segment made the barrier run diagonally)
            let ix = e.dirx * out, iz = e.dirz * out;
            if (data.roadGeometryPolicy !== 'source') { let m = n, f = e, acc = 0, qx = n.x, qz = n.z; const seen = new Set([n]);
              while (f && acc < 20) { const o = f.a === m ? f.b : f.a; if (seen.has(o)) break; seen.add(o); acc += f.len; qx = o.x; qz = o.z; m = o; const nx2 = o.edges.filter(g => g !== f && !g.virtual); f = nx2.length === 1 ? nx2[0] : null; }
              const L = Math.hypot(qx - n.x, qz - n.z); if (L > 4) { const dx = (qx - n.x) / L, dz = (qz - n.z) / L; if (dx * ix + dz * iz > 0.7) { ix = dx; iz = dz; } } }
            const px = -iz, pz = ix;
            const setback = Math.min(1.5, e.len / 2), cx = n.x + ix * setback, cz = n.z + iz * setback, y = Y.road + yAlong(e, cx, cz);
            n.mapEnd = true;
            const kind = isMotorwayTrunk(e.type) ? 'highway' : (/^(primary|secondary)(_link)?$/.test(e.type) || e.lanesF + e.lanesB >= 4) ? 'boulevard' : 'small';
            // One asymmetric full exit span (road/shoulder/source sidewalk) is
            // finalized before both the physical wall and visible decoration.
            const sgn = px * e.nx + pz * e.nz >= 0 ? 1 : -1,
                wP = (sgn > 0 ? e.wR : e.wL) + shoulderOf(e) + sidewalkWidth(e, sgn) + .3,
                wN = (sgn > 0 ? e.wL : e.wR) + shoulderOf(e) + sidewalkWidth(e, -sgn) + .3;
            candidates.push({ x: cx, z: cz, node: n, edge: e, ix, iz, px, pz, half: (wN + wP) / 2, y, barrierHeight: US ? 1.51 : 1.36, kind, heading: Math.atan2(ix, iz), l0: -wN, l1: wP });
        }
        mapEnds.push(...normalizeSourceMapEnds(candidates, boundarySupport));
        // (A road-closed barrier keeps its whole span even where a tram track crosses it: the tram plans its stop in front
        //  of it, Traffic.railDistrictLimit. Cutting the span to let the rigid tram body through left half a road open.)
        for (const m of mapEnds) {
            const { x, z, px, pz, y, ix, iz, l0, l1, edge, node } = m,
                ax = x + px * l0, az = z + pz * l0, bx = x + px * l1, bz = z + pz * l1;
            walls.push({ wall: true, ax, az, bx, bz, y0a: y, y1a: y + m.barrierHeight, y0b: y, y1b: y + m.barrierHeight,
                nx: ix, nz: iz, kind: 'closure', soft: true, edge, node,
                x: (ax + bx) / 2, z: (az + bz) / 2, r: m.half + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.2,
                normalizedSourceBoundary: true, bundleId: m.bundleId, l0, l1 });
        }
        for (const { ax, az, bx, bz, nx, nz } of districtMaskSegments(dmask))
            walls.push({ wall: true, ax, az, bx, bz, y0a: -40, y1a: 80, y0b: -40, y1b: 80, nx, nz, kind: 'boundary', edge: null,
                x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 0 });
    }
    // The same source grade resolver is later exposed to Traffic. Heights are
    // explicit model profiles, independent of motor routing and source layers.
    // tram tracks
    for (const [run, pl] of trams.entries()) {
        for (let i = 0; i < pl.length - 1; i++) {
            const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            const grade = tramGrades.forRun(run, i);
            if (grade) {
                // Flat decks need only bounded pieces for cells; smooth ramp
                // chords stay within2mm of the exact shared continuous profile.
                for (const piece of tramGradeRenderPieces([ax, az], [bx, bz], grade, Y.ballast)) {
                    const { a, b, t0, t1, y0, y1, quad, supported, top, band } = piece, c = cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                    if (supported) {
                        const bottom = top.map(p => [p[0], p[1] - grade.thicknessM, p[2]]), slab = rgb('#96938b');
                        c.solid.face4(...top, slab, [0, 1, 0]);
                        c.solid.face4(...bottom.slice().reverse(), rgb('#55524d'), [0, -1, 0]);
                        for (const [n, k] of [[0, 1], [2, 3]]) c.solid.face4(bottom[n], bottom[k], top[k], top[n], slab, n === 0 ? [nx, 0, nz] : [-nx, 0, -nz]);
                        const poly = top.map(p => [p[0], p[2]]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                        const deck = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, railDeck: true,
                            kind: 'source-tram-deck', sourceId: data.tramSources[run].sourceId, sourceSegment: grade.sourceSegment,
                            supportPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId),
                            sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags,
                            estimated: true, elevationSource: grade.basis, sourceAnchorIds: grade.sourceAnchorIds, modelId: grade.modelId,
                            supportA: a, supportB: b, supportTop: top, topProfile: piece.topProfile, sourceBridgeModelId:grade.sourceBridgeModelId,
                            y0: Math.min(...bottom.map(p => p[1])), y1: Math.max(...top.map(p => p[1])), h: Math.max(...top.map(p => p[1])),
                            roofHeightAt: (px, pz, radius) => band(px, pz, radius).top, minHeightAt: (px, pz, radius) => band(px, pz, radius).bottom };
                        sceneryDeckGrid.insert(x - deck.r, z - deck.r, x + deck.r, z + deck.r, deck); tramDecks.push(deck);
                        tramGrades.report.renderedDeckPieces++; tramGrades.report.renderedTriangles += 8;
                    }
                    if (Math.min(y0, y1) < -1e-6) {
                        // Estimated retaining sides follow the actual source
                        // centreline; the source tunnel=yes length is roofed.
                        if (piece.roof) tramHallPieces.push({ a, b, half: grade.deckHalfWidthM });
                        const upper = piece.roof ? piece.roof.bottomM : 0, sides = quad(grade.deckHalfWidthM, Math.max(Y.ballast + y0, upper), Math.max(Y.ballast + y1, upper));
                        for (const [n, k, sign] of [[0, 1, -1], [2, 3, 1]]) {
                          for (const [lo, hi] of uncoveredTramTrenchWall(top[n], top[k], [-nx * sign, -nz * sign], tramGrades.support, grade.modelId)) {
                            const interpolate = (p, q, t) => p.map((v, j) => v + (q[j] - v) * t), A = interpolate(top[n], top[k], lo), B = interpolate(top[n], top[k], hi), U = interpolate(sides[n], sides[k], lo), V = interpolate(sides[n], sides[k], hi);
                            const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
                            // (shared hall: beside a deep covered carriageway the roofed station has a pier row, not a wall; the collision wall stays)
                            if (!(piece.roof && (sharedHallRoad(mx, mz, nx, nz) || sharedHallRoad(mx, mz, -nx, -nz)))) c.solid.face4(A, B, V, U, rgb('#888982'), [nx * sign, 0, nz * sign]);
                            walls.push({ wall: true, ax: A[0], az: A[2], bx: B[0], bz: B[2], y0a: A[1], y0b: B[1], y1a: U[1], y1b: V[1],
                                nx: nx * sign, nz: nz * sign, kind: 'source-tram-trench', edge: null, sourceId: data.tramSources[run].sourceId,
                                sourceSegment: grade.sourceSegment, modelId: grade.modelId, estimated: true, elevationSource: grade.basis,
                                sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags,
                                renderPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId) + `:wall:${sign}:${lo}:${hi}`,
                                renderedVertices: [A, B, V, U],
                                x: mx, z: mz, r: Math.hypot(B[0] - A[0], B[2] - A[2]) / 2 + .1, hw: 0, hd: 0, angle: 0, poly: null, h: Math.max(U[1], V[1]) });
                            tramGrades.report.renderedTriangles += 2;
                          }
                        }
                    }
                    if (piece.roof) {
                        const roof = piece.roof, roofTop = quad(grade.deckHalfWidthM, roof.topM, roof.topM), roofBottom = quad(grade.deckHalfWidthM, roof.bottomM, roof.bottomM);
                        c.solid.face4(...roofTop, rgb('#92938d'), [0, 1, 0]);
                        c.solid.face4(...roofBottom.slice().reverse(), rgb('#646761'), [0, -1, 0]);
                        for (const [n, k] of [[0, 1], [2, 3]]) c.solid.face4(roofBottom[n], roofBottom[k], roofTop[k], roofTop[n], rgb('#787b74'), n === 0 ? [nx, 0, nz] : [-nx, 0, -nz]);
                        const poly = roofTop.map(p => [p[0], p[2]]), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                        const cover = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, railRoof: true,
                            kind: 'source-tram-roof', sourceId: data.tramSources[run].sourceId, sourceSegment: grade.sourceSegment,
                            sourceNodeIds: data.tramSources[run].nodeIds.slice(i, i + 2), sourceTags: data.tramSources[run].tags, modelId: grade.modelId, estimated: true, elevationSource: roof.basis,
                            renderPieceId: tramSupportPieceId(data.tramSources[run].sourceId, grade.sourceSegment, piece, grade.modelId) + ':roof', renderedTop: roofTop, renderedBottom: roofBottom,
                            y0: roof.bottomM, y1: roof.topM, h: roof.topM, roofHeightAt: () => roof.topM, minHeightAt: () => roof.bottomM };
                        sceneryDeckGrid.insert(x - cover.r, z - cover.r, x + cover.r, z + cover.r, cover); tramDecks.push(cover);
                        tramGrades.report.renderedRoofPieces = (tramGrades.report.renderedRoofPieces || 0) + 1; tramGrades.report.renderedTriangles += 8;
                    }
                    const ballast = quad(1.4, Y.ballast + y0 + (supported ? .001 : 0), Y.ballast + y1 + (supported ? .001 : 0));
                    (supported ? c.road : c.ground).face4(...ballast, ballastCol, [0, 1, 0], -1, ballast.map(p => [p[0] * .3, p[2] * .3]));
                    for (const offset of [-.72, .72]) {
                        const hw = .045, yy = Y.road + Y.mark + .006;
                        c.marks.face4([a[0] + nx * (offset + hw), yy + (grade.heightAtWorld?.(a[0]+nx*(offset+hw),a[1]+nz*(offset+hw))??y0), a[1] + nz * (offset + hw)], [b[0] + nx * (offset + hw), yy + (grade.heightAtWorld?.(b[0]+nx*(offset+hw),b[1]+nz*(offset+hw))??y1), b[1] + nz * (offset + hw)],
                            [b[0] + nx * (offset - hw), yy + (grade.heightAtWorld?.(b[0]+nx*(offset-hw),b[1]+nz*(offset-hw))??y1), b[1] + nz * (offset - hw)], [a[0] + nx * (offset - hw), yy + (grade.heightAtWorld?.(a[0]+nx*(offset-hw),a[1]+nz*(offset-hw))??y0), a[1] + nz * (offset - hw)], railCol, [0, 1, 0], -1, [[0, 0], [0, 0], [0, 0], [0, 0]]);
                    }
                    tramGrades.report.renderedTriangles += 6;
                }
                continue;
            }
            const c = cellOf(ax, az);
            c.ground.flatQuad(ax + nx * 1.4, az + nz * 1.4, bx + nx * 1.4, bz + nz * 1.4, bx - nx * 1.4, bz - nz * 1.4, ax - nx * 1.4, az - nz * 1.4, Y.ballast, ballastCol, 0.3);
            for (const o of [-0.72, 0.72]) {
                const hw = 0.045, y = Y.road + Y.mark + 0.006;
                c.marks.flatQuad(ax + nx * (o + hw), az + nz * (o + hw), bx + nx * (o + hw), bz + nz * (o + hw), bx + nx * (o - hw), bz + nz * (o - hw), ax + nx * (o - hw), az + nz * (o - hw), y, railCol, 0);
            }
        }
    }
    /** Exact containing new rail slabs only. The slab/ballast base is0.2m;
     * Traffic's native actor base remains0.24m above the same displacement. */
    const tramDeckSupportAt = tramGrades.support.at;

    // -----------------------------------------------------------------------
    //  BUILDINGS (+ CV POIs, landmarks)
    // -----------------------------------------------------------------------
    setProgress('Raising the buildings…'); await tick();
    const B_OFF = (data.version || 1) >= 2 ? 9 : 6;
    const bRecs = data.buildings.map((b, i) => {
        const ring = data.buildingFootprints?.[i] || undelta(b, B_OFF);
        const holes = data.buildingHoleFootprints?.[i] || (data.buildingHoles?.[i] || []).map(h => undelta(h, 0)).filter(h => h.length >= 3);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const c = centroid(ring);
        const sourceHeight = data.buildingDimensions?.[i]?.[0] ?? b[1] / 10, minimum = data.buildingDimensions?.[i]?.[1] ?? b[2] / 10;
        const roofProfile = validRoofProfile(data.buildingRoofProfiles?.[i], sourceHeight, minimum) ? data.buildingRoofProfiles[i] : null;
        // A building whose own source tags (kept for multipolygon relations) say it is a hotel shows the hotel's sign: the builder
        // reads POIs from nodes and ways only, so a tenant inside it had taken the sign (Courtyard, Bellevue, OSM r8064670).
        // (r2-builder) data.buildingOwnTags (tools/osm/add-pois.mjs): a way building's own name where a tenant POI had taken its
        // sign (Sheraton read "Pizza Hut", Victoria Center "Starbucks"); the tenant keeps its unit fascia (addUnitSign)
        const ownTags = data.buildingSourceTags?.[data.buildingIds?.[i]] || data.buildingOwnTags?.[data.buildingIds?.[i]];
        const ownSign = ownTags && /^(hotel|hostel|motel)$/.test(ownTags.tourism || '') ? (ownTags.brand || ownTags.name || '') : (data.buildingOwnTags?.[data.buildingIds?.[i]]?.name || '');
        return { i, sourceId: data.buildingIds?.[i], heightSourceCode: data.buildingInfo?.[i * 5 + 4], style: data.styles[b[0]], h: data.buildingDimensions?.[i]?.[0] ?? b[1] / 10, minH: data.buildingDimensions?.[i]?.[1] ?? b[2] / 10, roof: data.roofs[b[3]], name: ownSign || str(b[4]), flags: ownSign ? (b[5] | 2 | (ownTags.brand ? 8 : 0)) : b[5], signStreet: ownSign ? ownTags['addr:street'] || '' : '', ring, holes, c, x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false,
            roofProfile, canopy: data.buildingCanopies?.[i] || null, levels: B_OFF === 9 ? b[6] : 0, colour: B_OFF === 9 ? str(b[7]) : '', roofColour: B_OFF === 9 ? str(b[8]) : '' };
    });
    for (const b of bRecs) b.aircraft = data.buildingAircraft?.[b.i] || null;
    const carParkOutlines = distId ? bRecs.filter(o => o.ring?.length >= 3 && carParkOf(data.buildingIds?.[o.i], data.buildingSourceTags)) : []; // (r2: a car park drawn through its building parts keeps its decks)
    const roofProfileAudit = { supplied: Object.keys(data.buildingRoofProfiles || {}).length, applied: bRecs.filter(b => b.roofProfile).length, rejected: bRecs.filter(b => data.buildingRoofProfiles?.[b.i] && !b.roofProfile).map(b => data.buildingIds?.[b.i] || b.i), uncertain: bRecs.filter(b => b.roofProfile?.issues?.length).map(b => ({ source: data.buildingIds?.[b.i] || b.i, issues: b.roofProfile.issues })), surfacesApplied: 0, surfacesRejected: [] };
    // ---- (round 6 notes 10 / 46) Bucharest 'house' buildings: the village-house look (shutters, steep gable) read wrong —
    //      in Floreasca / Romană they are interwar villas (plaster, low hipped roof), and a lone house among office towers
    //      (Pipera, Bd. Dimitrie Pompeiu) reads as a low commercial block. Seattle keeps its wooden houses.
    if (!US) {
        const tall = bRecs.filter(b => b.h > 20);
        for (const b of bRecs) {
            if (b.style !== 'house') continue;
            let n = 0; for (const t of tall) if (Math.hypot(t.c[0] - b.c[0], t.c[1] - b.c[1]) < 70 && ++n >= 3) break;
            if (n >= 3 && !(b.flags & 16) && !b.roofProfile) { b.style = 'plain'; b.roof = 'flat'; }
            else { b.style = 'interwar'; b.villa = true; if (!b.roofProfile && !(b.flags & 16) && (b.roof === 'gabled' || b.roof === 'pitched')) b.roof = 'hipped'; } // (flags 16: roof shape measured — OSM / aerial survey — kept)
        }
    }
    // ---- facade style from data.buildingInfo (world-data: OSM type, start_date year, architect, material, height source)
    {
        const BI = data.buildingInfo || [];
        let restyled = 0;
        for (const b of bRecs) {
            const k = b.i * 5; if (k + 4 >= BI.length) break;
            const type = BI[k] >= 0 ? str(BI[k]) : '', yr = BI[k + 1] || 0, mat = BI[k + 3] >= 0 ? str(BI[k + 3]) : '';
            b.type = type; b.year = yr; b.material = mat;
            if (b.style === 'church' || b.style === 'house' || b.style === 'shop') continue;
            let st = null;
            if (/glass/.test(mat) || ((type === 'office' || type === 'commercial') && yr >= 1995)) st = 'glass';
            else if (yr && yr < 1914) st = US ? 'interwar' : 'eclectic';
            else if (yr >= 1925 && yr <= 1945) st = US ? 'interwar' : 'interwar';
            else if (yr >= 1960 && yr <= 1989 && /apartments|residential|yes|^$/.test(type) && !US) st = 'bloc';
            else if (/brick/.test(mat) && US) st = 'interwar';
            if (st && st !== b.style) { b.style = st; restyled++; }
        }
        if (restyled) console.info('[world] facade styles from buildingInfo:', restyled);
    }
    // ---- principal occupant (2026-11-12 fidelity pass, SeaTac): the data build signs a building with the first POI attached to
    //      it, so hotels carried a tenant's name (Hilton = "Spencer's", Radisson = "RBG Bar & Grill", Ramada = "Ginger Palace")
    //      and a fuel canopy its kiosk's ("Food Mart" on the 76). A hotel / motel (a hotel POI on the building, one named like it
    //      beside it, or tourism=* on the building's own source tags) or a fuel station names its building; and a US hotel is a
    //      windowed block, not the windowless 'plain' shed / glass 'shop' row the US style fallback gives untagged footprints.
    {
        const kindOf = (p) => data.poiKinds?.[p[0]], q = data.q || 10, lodging = new Map(), fuel = new Map(), museums = new Map();
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const p of data.pois || []) {
            const k = kindOf(p); if (k !== 'hotel' && k !== 'fuel') {
                // (Romană: Muzeul Țăranului Român was signed "Cinema Muzeul Țăranului") a museum POI attached to a building that is
                // signed with another POI's name names it; a building without a POI sign keeps its own name
                if (k === 'landmark' && str(p[5]) === 'museum' && p[6] >= 0 && str(p[3]) && !museums.has(p[6])) museums.set(p[6], str(p[3]));
                continue;
            }
            const brand = str(p[4]), name = str(p[3]); let i = p[6];
            if (i < 0 && k === 'hotel') { // not attached by the build: the building beside it that already carries its name
                let best = 60; for (const b of bRecs) { const n = norm(b.name); if (!n || (n !== norm(brand) && n !== norm(name))) continue; const d = Math.hypot(b.c[0] - p[1] / q, b.c[1] - p[2] / q); if (d < best) { best = d; i = b.i; } }
            }
            if (i >= 0 && !(k === 'hotel' ? lodging : fuel).has(i)) (k === 'hotel' ? lodging : fuel).set(i, { text: brand || name, brand: !!brand });
        }
        for (const b of bRecs) { const t = data.buildingSourceTags?.[b.sourceId] || data.buildingOwnTags?.[b.sourceId]; if (t && /^(hotel|motel|hostel|guest_house)$/.test(t.tourism || '') && !lodging.has(b.i)) lodging.set(b.i, { text: t.brand || t.name || '', brand: !!t.brand }); }
        for (const [i, s] of fuel) { const b = bRecs[i]; if (b && s.text && !lodging.has(i)) { b.name = s.text; b.flags |= 2 | (s.brand ? 8 : 0); } }
        for (const [i, text] of museums) { const b = bRecs[i]; if (b && (b.flags & 2) && !lodging.has(i) && !fuel.has(i)) { b.name = text; b.flags &= ~8; } }
        for (const [i, s] of lodging) {
            const b = bRecs[i]; if (!b) continue;
            if (s.text) { b.name = s.text; b.flags |= 2 | (s.brand ? 8 : 0); }
            if (US && (b.style === 'plain' || b.style === 'shop')) { b.style = 'bloc'; b.flags &= ~1; }
        }
    }
    // ---- street-level review rows by OSM id (round 2 fidelity pass; game/src/building-review.js): reviewed storeys / style / colour
    const buildingReviewAudit = applyBuildingReview({ key: city.id + '-' + distId, bRecs });
    // ---- height sanity (2026-11-07, world-visual): the data build gives every untagged large footprint outside the old
    //      centre 8–10 storeys (23–30 m 'bloc'), so museums, villas and institutions on Kiseleff / Dorobanți became grey
    //      slabs. Buildings without building:levels whose height is exactly such a default are re-estimated here from
    //      their name and shape: real slab blocks (≤ 22 m wide, ≥ 30 m long) keep their storeys, compact or courtyard
    //      footprints become 3–5 storeys, named institutions 2–4 (data-build fix requested in spec 12 Requests)
    const heightFixes = [];
    {
        const DEF = new Set([11.6, 12.6, 14.5, 15.5, 23.2, 24.2, 29, 30]);
        const INST = /muze|museum|biseric|church|catedral|institut|[șs]coal|liceu|gr[ăa]dini|teatr|atene|bibliotec|universit|facult|spital|palat|casa |vila|villa|ambasada\b|embassy|primări|primari|tribunal|ministe/i;
        const minWidth = (ring) => { // smallest width over the footprint's own edge directions
            let best = Infinity, len = 0;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of ring) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                if (c1 - c0 < best) { best = c1 - c0; len = a1 - a0; }
            }
            return { w: best, l: len };
        };
        const villaZone = (x, z) => { if (US) return false; const ll = city.proj.inverse ? city.proj.inverse(x, z) : null; return !!ll && ll.lat > 44.447 && ll.lat < 44.48 && ll.lon > 26.07 && ll.lon < 26.112; }; // (to 26.112: Garibaldi / the composer streets)
        for (const b of bRecs) {
            if (b.roofProfile || b.levels > 0 || b.style === 'church' || b.style === 'glass' || b.minH > 0 || /^(bl(oc)?\.?\s|bloc\b|block\b)/i.test(b.name || '')) continue; // (a named apartment block keeps its storeys)
            const named = INST.test(b.name || '');
            const isDef = DEF.has(Math.round(b.h * 10) / 10);
            if (!isDef && !(named && b.h > 18)) continue;
            const { w, l } = minWidth(b.ring);
            const slab = w <= 22 && l >= 30 && !named && !villaZone(b.c[0], b.c[1]);
            if (slab || (!named && b.h < 16)) continue;
            const lv = named ? (b.area > 3000 ? 4 : b.area > 800 ? 3 : 2) : villaZone(b.c[0], b.c[1]) ? (b.area > 1500 ? 4 : 3) : (w > 22 ? 5 : 4);
            const floor = named ? 4.6 : 3.3, h2 = Math.round((lv * floor + 1.2) * 10) / 10;
            if (h2 >= b.h - 0.5) continue;
            heightFixes.push({ name: b.name || '', from: b.h, to: h2, w: Math.round(w), l: Math.round(l), x: Math.round(b.c[0]), z: Math.round(b.c[1]) });
            b.h = h2; b.levels = lv; if (named && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
            if (!named && villaZone(b.c[0], b.c[1]) && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
        }
        if (heightFixes.length) console.info('[world] height sanity:', heightFixes.length, 'buildings re-estimated', heightFixes.slice(0, 8));
    }
    if (distId) for (const b of bRecs) { const rh = reviewedCarParkHeight(b.sourceId, b.heightSourceCode); if (rh && (!b.roofProfile || (b.roofProfile.shape === 'flat' && b.roofProfile.heightSource === 'style estimate'))) { b.h = rh; if (b.roofProfile) b.roofProfile = { ...b.roofProfile, totalM: rh, eavesM: rh, heightSource: 'street-level review estimate' }; } } // (r2: car-park storeys counted from the street: car-parks.js)
    const fuelCanopyReview = distId ? applyFuelCanopyReview(city.id + '-' + distId, bRecs, data.buildingIds) : []; // (r2: reviewed open fuel roofs the pack draws as blocks: fuel-canopy-review.js)
    coveredRoadModels.useNativeRibbons(ribbons);
    const buildingPassageAudit=(data.buildingPassageIssues||[]).map(i=>({...i,accepted:false}));
    const configurePassages=b=>{
        b.passages=[];b.passageSolids=null;
        for(const source of [...(data.buildingPassages?.[b.derivedFrom??b.i]||[]),...(coveredRoadModels.passages.get(b.derivedFrom??b.i)||[])]){
            if(passageBaseUnknown(source.tags)){buildingPassageAudit.push({source:data.buildingIds?.[b.derivedFrom??b.i],road:source.sourceRoadId,accepted:false,reason:'absolute-passage-base-unknown',baseUnknown:true,tags:source.tags});continue;}
            const mid=centroid(source.ring),indices=new Set(source.roadIndices||[]);
            const ne=nearestEdge(mid[0],mid[1],e=>!e.virtual&&(indices.has(e.road)||data.roadAccess?.[e.road]?.sourceId===source.sourceRoadId),100);
            const roadY=ne?Y.road+yAlong(ne.edge,mid[0],mid[1]):Y.road,ceilingM=roadY+source.clearanceM,top=b.roofProfile?.eavesM??b.h;
            if(!(ceilingM>Math.max(0,b.minH)&&ceilingM<top-.01)){buildingPassageAudit.push({source:data.buildingIds?.[b.i],road:source.sourceRoadId,accepted:false,reason:'opening-clearance-incompatible-with-source-body',ceilingM,bodyTopM:top});continue;}
            const key=source.sourceRoadId+'/'+source.sourceSegment+'/'+(source.sourcePreparedEdgeId===undefined?'':source.sourcePreparedEdgeId+'/')+ceilingM.toFixed(5);
            b.passages.push({...source,key,ceilingM});
            buildingPassageAudit.push({source:data.buildingIds?.[b.i],road:source.sourceRoadId,accepted:true,clearanceM:source.clearanceM,ceilingM,widthM:source.widthM,clearanceSource:source.clearanceSource,widthSource:source.widthSource});
        }
        if(b.passages.length)b.passageSolids=passageSolids(b.ring,b.holes,b.minH,b.h,b.passages);
    };
    for(const b of bRecs)configurePassages(b);
    // Source-policy contacts are audited against the actual low passage voids.
    // Legacy data retains its historical clearance behaviour until rebuilt.
    let bShrunk = 0, bDropped = 0; const clearanceAudit = [];
    const laneInPoly = (ring, noService = false, b = null) => { // lane samples (as devCheck / traffic see them) inside the footprint (noService: a big named building's own service lanes don't count)
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = false;
        edgesInBox(x0 - 12, z0 - 12, x1 + 12, z1 + 12, (e) => {
            if (hit || e.virtual || e.tunnel || e.layer < 0 || (noService && e.type === 'service') || (b && (b.minH > Math.max(e.ya, e.yb) + Y.road + 3 || Math.min(e.ya, e.yb) > b.h + 1))) return;
            for (let t = 0.03; t < 0.98 && !hit; t += Math.min(0.05, 1 / e.len)) for (const o of [0, e.wR * 0.45, e.wR * 0.85, -e.wL * 0.45, -e.wL * 0.85]) {
                const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && pointInPolygon(x, z, ring) && !b?.holes.some(h => pointInPolygon(x, z, h))) { hit = true; break; }
            }
        });
        return hit;
    };
    const bBad = (ring, b) => {
        if(b.passageSolids)return b.passageSolids.some(band=>band.polys.some(poly=>polyOnRibbon(poly,rb=>!(band.y0>rb.y+Y.road+2||rb.y>band.y1+1))));
        const filter = rb => !(b.minH > rb.y + Y.road + 3 || rb.y > b.h + 1) && (!(b.flags & 64) || (!(rb.e && rb.e.type === 'service') && !(rb.node && (rb.node.allEdges || rb.node.edges).every(q => q.type === 'service'))));
        let overlap = polyOnRibbon(ring, filter);
        if (overlap && b.holes.length) {
            overlap = false;
            ribGrid.each(b.x0, b.z0, b.x1, b.z1, rb => {
                if (overlap || !rb.block || !filter(rb)) return;
                // The solid wing, rather than its enclosing outline, must touch
                // a road: mapped roads through open courtyards remain open.
                overlap = footprintCells(rb.poly, [ring, ...b.holes]).some(c => c.covered.includes(0) && c.covered.length === 1 && Math.abs(signedArea(c.ring)) > 0.02);
            });
        }
        return overlap || laneInPoly(ring, !!(b.flags & 64), b);
    };
    for (const b of bRecs) {
        if (!bBad(b.ring, b)) continue;
        if (data.buildingGeometryPolicy === 'source') {
            clearanceAudit.push({ source: data.buildingIds?.[b.i] || b.i, before: b.area, after: b.area, conflict: true, resolution: 'source-footprint-preserved' });
            continue;
        }
        let ring = b.ring, holes = b.holes, ok = false;
        for (let k = 0; k < 6 && !ok; k++) {
            const shrink = ([x, z]) => [b.c[0] + (x - b.c[0]) * 0.88, b.c[1] + (z - b.c[1]) * 0.88];
            ring = ring.map(shrink); holes = holes.map(h => h.map(shrink)); ok = !bBad(ring, { ...b, holes });
        }
        if (!ok || Math.abs(signedArea(ring)) < 8) { b.skip = true; b.dropped = true; bDropped++; continue; }
        clearanceAudit.push({ source: data.buildingIds?.[b.i] || b.i, before: b.area, after: Math.abs(signedArea(ring)) });
        b.ring = ring; b.holes = holes; b.area = Math.abs(signedArea(ring)); bShrunk++;
        b.x0 = Math.min(...ring.map(p => p[0])); b.x1 = Math.max(...ring.map(p => p[0])); b.z0 = Math.min(...ring.map(p => p[1])); b.z1 = Math.max(...ring.map(p => p[1]));
    }
    // OSM 3-D outlines can have a separately mapped part over their whole footprint.
    // Keep both source records for audits, but draw/collide only the complete part.
    // Recheck after runtime clearance: an altered or dropped part cannot erase its outline.
    const coveredOutlines = [];
    const coveredBy = data.buildingCoveredBy || {}, targetCounts = new Map();
    for (const value of Object.values(coveredBy)) if (Number.isInteger(value)) targetCounts.set(value, (targetCounts.get(value) || 0) + 1);
    const ringKey = ring => {
        const pts = ring.map(([x, z]) => Math.round(x * 1e4) + ',' + Math.round(z * 1e4)), keys = [];
        for (const seq of [pts, [...pts].reverse()]) for (let i = 0; i < seq.length; i++) keys.push(seq.slice(i).concat(seq.slice(0, i)).join(';'));
        return keys.sort()[0] || '';
    };
    const footprintKey = b => ringKey(b.ring) + '|' + b.holes.map(ringKey).sort().join('|');
    for (const [key, index] of Object.entries(coveredBy)) {
        const baseIndex = Number(key), base = bRecs[baseIndex], part = bRecs[index];
        if (!Number.isInteger(baseIndex) || !Number.isInteger(index) || baseIndex === index || !base || !part || base.skip || part.skip || targetCounts.get(index) !== 1 || Object.hasOwn(coveredBy, index)) continue;
        if (part.minH > 0 || part.h + 1e-6 < base.h || footprintKey(base) !== footprintKey(part)) continue;
        base.skip = true; base.coveredBy = index;
        if (!part.name) { part.name = base.name; part.flags |= base.flags & (2 | 8); }
        part.flags |= base.flags & 1; // a sourced ground-floor tenant remains on the complete building
        if (!part.type || part.type === 'yes') part.type = base.type;
        for (const field of ['year', 'material', 'levels']) if (!part[field]) part[field] = base[field];
        coveredOutlines.push({ outline: data.buildingIds?.[baseIndex] || baseIndex, part: data.buildingIds?.[index] || index, type: part.type, levels: part.levels, name: part.name, sign: !!(part.flags & 2) });
    }
    const assemblyAudit = [], assemblyRejected = [];
    const claimedParts = new Map();
    for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) for (const i of spec.parts || []) claimedParts.set(i, (claimedParts.get(i) || 0) + 1);
    for (const [key, spec] of Object.entries(data.buildingAssemblies || {})) {
        const base = bRecs[Number(key)], indices = spec.parts || [], parts = indices.map(i => bRecs[i]);
        const invalid = !base || base.skip ? 'missing-or-inactive-outline' : base.holes.length ? 'unsupported-courtyard-outline' : !parts.length ? 'empty-parts' : new Set(indices).size !== indices.length ? 'duplicate-part' : parts.some((p, n) => !p || p.skip || p === base || claimedParts.get(indices[n]) !== 1) ? 'missing-inactive-or-ambiguous-part' : parts.some(p => p.holes.length) ? 'unsupported-part-courtyard' : null;
        if (invalid) { assemblyRejected.push({ outline: data.buildingIds?.[Number(key)] || Number(key), reason: invalid }); continue; }
        const cached = spec.geometry, keepOutline = spec.mode === 'union';
        if (!cached || !Array.isArray(cached.residuals) || !Array.isArray(cached.surfaces) || !signatureMatches(cached.signature, assemblySignature(base, parts)) || cached.surfaces.length !== parts.length + cached.residuals.length + (keepOutline ? 1 : 0)) {
            assemblyRejected.push({ outline: data.buildingIds?.[base.i] || base.i, reason: 'prepared-geometry-mismatch' }); continue;
        }
        const residualH = spec.residualHeightM ?? spec.residualHeightDm / 10;
        const ground = parts.filter(p => p.minH === 0);
        const residuals = cached.residuals.map((source, n) => {
            const ring = geometryRing(source.ring, data.buildingGeometryPoints), x0 = Math.min(...ring.map(p => p[0])), x1 = Math.max(...ring.map(p => p[0])), z0 = Math.min(...ring.map(p => p[1])), z1 = Math.max(...ring.map(p => p[1]));
            return { ...base, i: bRecs.length + n, ring, holes: [], c: centroid(ring), x0, x1, z0, z1, area: Math.abs(signedArea(ring)), h: source.h, minH: 0, roof: 'flat', roofProfile: null, levels: 0, flags: base.flags & 32, name: '', derivedFrom: base.i };
        });
        base.skip = !keepOutline; base.assemblyParts = indices;
        const volumes = keepOutline ? [base, ...parts] : [...parts, ...residuals];
        for (const [ordinal, p] of volumes.entries()) {
            p.assemblySurface = geometrySurface(cached.surfaces[ordinal], data.buildingGeometryPoints);
            p.assembly = volumes; p.roof = p.roofProfile ? p.roofProfile.shape : (p.flags & 16) ? p.roof : 'flat';
            if (!p.type || p.type === 'yes') { p.type = base.type; if (p.style === 'plain' && p.area > 40 && !/glass/.test(p.material || '')) p.style = base.style; }
            for (const field of ['year', 'material']) if (!p[field]) p[field] = base[field];
        }
        // The source name belongs to the whole assembly, not to each tier.
        const primary = keepOutline ? base : ground.reduce((a, b) => a.area > b.area ? a : b);
        if (!primary.name) { primary.name = base.name; primary.flags |= base.flags & (1 | 2 | 8); }
        base.assemblyPrimary = primary.i;
        bRecs.push(...residuals);
        assemblyAudit.push({ mode: spec.mode, outline: data.buildingIds?.[base.i] || base.i, parts: indices.map(i => data.buildingIds?.[i] || i), residualArea: residuals.reduce((sum, p) => sum + p.area, 0), residualHeight: residualH, residualHeightSource: spec.residualHeightSource, residualHeights: [...new Set(residuals.map(p => p.h))].sort((a, b) => a - b), cells: residuals.length });
    }
    // ---- unpaired 3-D outlines (owner, 2026-11-12, Unirii bus stop: "WAT are those") OSM maps a detailed building as an
    // outline plus building:part volumes; the outline is then only an envelope. Where the prepared data did not pair them
    // (a part vertex 16 mm outside the outline), the outline was drawn at its style-estimated height and the overlap cut
    // below removed the measured parts inside it: two 3 m bus shelters stood as 7.2 m houses. An outline whose height is
    // only a style estimate, and whose footprint is covered by buildings with tagged heights standing inside it (at least
    // one of them from the ground), is not drawn: the tagged volumes are.
    const outlineParts = { outlines: 0, samples: [] };
    {
        const tagged = new BoxGrid(32);
        for (const p of bRecs) if (!p.skip && !p.assembly && p.ring?.length >= 3 && !p.holes.length && /^OSM /.test(p.roofProfile?.heightSource || '')) tagged.insert(p.x0, p.z0, p.x1, p.z1, p);
        const within = (x, z, ring, tol) => { if (pointInPolygon(x, z, ring)) return true; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if (distPointSeg(x, z, ring[j][0], ring[j][1], ring[i][0], ring[i][1]).d <= tol) return true; return false; };
        for (const o of bRecs) {
            if (o.skip || o.assembly || o.assemblyParts || !(o.ring?.length >= 3) || o.holes.length || o.minH > 0 || o.roofProfile?.heightSource !== 'style estimate') continue;
            const inside = new Set();
            tagged.each(o.x0, o.z0, o.x1, o.z1, p => { if (p !== o && !p.skip && p.x0 >= o.x0 - .3 && p.x1 <= o.x1 + .3 && p.z0 >= o.z0 - .3 && p.z1 <= o.z1 + .3 && p.ring.every(([x, z]) => within(x, z, o.ring, .3))) inside.add(p); });
            const ground = [...inside].filter(p => !(p.minH > 0)); if (!ground.length) continue;
            const step = Math.max(.2, Math.min(o.x1 - o.x0, o.z1 - o.z0) / 16); let n = 0, covered = 0;
            for (let x = o.x0 + step / 2; x < o.x1; x += step) for (let z = o.z0 + step / 2; z < o.z1; z += step) {
                if (!pointInPolygon(x, z, o.ring)) continue; n++;
                for (const p of inside) if (pointInPolygon(x, z, p.ring)) { covered++; break; }
            }
            if (!n || covered < n * .9) continue;
            o.skip = true; o.replacedByParts = [...inside].map(p => p.i);
            const primary = ground.reduce((a, b) => a.area > b.area ? a : b);
            if (o.name && !primary.name) { primary.name = o.name; primary.flags |= o.flags & (1 | 2 | 8); }
            for (const p of inside) if (!p.type || p.type === 'yes') p.type = o.type;
            outlineParts.outlines++; if (outlineParts.samples.length < 40) outlineParts.samples.push({ outline: data.buildingIds?.[o.i] || o.i, parts: [...inside].map(p => data.buildingIds?.[p.i] || p.i), coverage: +(covered / n).toFixed(3), estimatedH: o.h });
        }
    }
    // ---- overlapping source buildings (building-overlap.js): a lower building is cut to stop at a taller one's walls
    const overlapCuts = { pairs: 0, cut: 0, removedM2: 0, skipped: {}, samples: [] };
    {
        const plan = buildPool ? await planOverlapCutsParallel(bRecs, buildPool) : planOverlapCuts(bRecs);
        for (const q of plan.skipped) overlapCuts.skipped[q.reason] = (overlapCuts.skipped[q.reason] || 0) + 1;
        for (const cut of plan.cuts) {
            const L = cut.lower; overlapCuts.pairs += cut.tallers.length; overlapCuts.removedM2 += cut.removedM2;
            if (overlapCuts.samples.length < 40 || L.assembly) overlapCuts.samples.push({ lower: L.sourceId ?? L.i, tallers: cut.tallers.map(t => t.sourceId ?? t.i), overlapM2: Math.round(cut.overlapM2), pieces: cut.pieces.length, ...(L.assembly ? { assemblyMember: true, at: [Math.round(L.c?.[0] ?? (L.x0 + L.x1) / 2), Math.round(L.c?.[1] ?? (L.z0 + L.z1) / 2)], h: L.h } : {}) });
            L.skip = true; L.overlapCutBy = cut.tallers.map(t => t.i); overlapCuts.cut++;
            const primary = cut.pieces.reduce((a, b) => Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a, cut.pieces[0]);
            for (const ring of cut.pieces) {
                let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
                const own = ring === primary; // the name, sign and ground-floor tenant stay on the largest piece
                bRecs.push({ ...L, ...(L.assembly ? { assembly: null, assemblySurface: null, assemblyCut: true } : {}), i: bRecs.length, ring, holes: [], c: centroid(ring), x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false, derivedFrom: L.i, overlapCut: true, name: own ? L.name : '', flags: own ? L.flags : (L.flags & ~(1 | 2 | 8)) });
            }
        }
        overlapCuts.removedM2 = Math.round(overlapCuts.removedM2);
    }
    for(const b of bRecs)if(b.derivedFrom!==undefined)configurePassages(b);
    // (spec 10 load budget) the source roofs the building loop will mesh (a roof profile, no prepared roof surface) are
    // meshed in the build workers meanwhile, from the ring, holes and profile each building has now; the loop uses one only
    // while the building still has those same objects (else it meshes the roof itself, as before)
    const roofPrefetch = buildPool ? buildPool.roofMeshes(bRecs.filter(b => !b.skip && !b.canopy && b.roofProfile && !data.buildingRoofSurfaces?.[b.i]).map(b => ({ key: b, ring: b.ring, holes: b.holes, profile: b.roofProfile }))).catch(err => (console.warn('[world] roof workers failed, meshing here', err), null)) : null;
    const buildingIndex = (index, x, z) => {
        const b = bRecs[index];
        if (b?.assemblyParts) return b.assemblyParts.find(i => { const p = bRecs[i]; return p.minH === 0 && pointInPolygon(x ?? b.c[0], z ?? b.c[1], p.ring); }) ?? b.assemblyPrimary;
        return b?.coveredBy ?? index;
    };
    const bGrid = new BoxGrid(32);
    for (const b of bRecs) bGrid.insert(b.x0, b.z0, b.x1, b.z1, b);
    const buildingAt = (x, z) => { let r = null; bGrid.each(x, z, x, z, (b) => { if (!r && !b.skip && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring) && !b.holes.some(h => pointInPolygon(x, z, h))) r = b; }); return r; };

    // landmarks (another module; optional)
    let LANDMARKS = [], buildLandmarkFn = null, landmarkSurfaceMats = [];
    let SEA_SCALE = 0.5;
    try { const mod = await landmarksModule(); landmarkSurfaceMats = mod.landmarkSurfaceMaterials?.() || []; LANDMARKS = (mod.LANDMARKS || []).filter(l => l.city === city.id); buildLandmarkFn = mod.buildLandmark || null; SEA_SCALE = mod.SEA_SCALE || 0.5; } catch (err) { LANDMARKS = []; }
    // a district only builds its own landmarks (+ distant backdrops such as Rainier)
    // (a landmark the district lists explicitly may stand outside it, up to ~2.5 km: skyline landmarks seen down an
    //  avenue, e.g. the Parliament / People's Salvation Cathedral at the west end of Bd. Unirii seen from Piața Unirii)
    if (distCfg) LANDMARKS = LANDMARKS.filter(l => (distCfg.landmarks ? distCfg.landmarks.includes(l.id) : true) && (l.backdrop || inDistrictLL(l.lat, l.lon, distCfg.landmarks ? 0.022 : 0.004)));
    const landmarks = [], landmarkSourceReplacements = [];
    const landmarkFences = []; // (2026-11-08) fences of landmark grounds, drawn off the streets (below)
    const landmarkWaterFootprints = [];
    const lmGrounds = []; // (2026-11-08) a landmark's own surfaces (sports grounds): no measured / generated trees on them
    const collisionBoxes = [];
    // ---- floating source parts (owner register #51 Romana "floating detached upper office volume", #55 Otopeni "large floating
    //      roof / upper building shell": the elevated train station, OSM min_height 5). A mapped part that starts above the ground
    //      (min_height > 2.5 m) with nothing under it read as hovering. Where no lower part or building reaches its underside,
    //      it stands on columns (inset 0.6 m along its outline, at most 9 m apart, never on a road, rail or water); an estimate.
    const floatingSupport = { parts: 0, columns: 0, colls: [] };
    {
        const grid = new BoxGrid(32);
        for (const o of bRecs) { if (!o.ring || o.ring.length < 3) continue; const xs = o.ring.map(p => p[0]), zs = o.ring.map(p => p[1]); grid.insert(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), o); }
        const conc = rgb('#a9a69e');
        for (const b of bRecs) {
            if (!(b.minH > 2.5) || !b.ring || b.ring.length < 3) continue;
            const cx = b.ring.reduce((n, p) => n + p[0], 0) / b.ring.length, cz = b.ring.reduce((n, p) => n + p[1], 0) / b.ring.length;
            const inset = (p, d) => { const dx = cx - p[0], dz = cz - p[1], L = Math.hypot(dx, dz) || 1; return [p[0] + dx / L * Math.min(d, L * .5), p[1] + dz / L * Math.min(d, L * .5)]; };
            const under = (x, z) => { let hit = false; grid.each(x, z, x, z, o => { if (!hit && o !== b && o.minH < b.minH - .3 && o.h >= b.minH - .6 && pointInPolygon(x, z, o.ring)) hit = true; }); return hit; };
            const samples = [[cx, cz], ...b.ring.map(p => inset(p, 1))];
            if (samples.filter(([x, z]) => under(x, z)).length >= samples.length * .4) continue;
            // a volume more than 8 m up with nothing under it is a source part whose lower storeys are not mapped (not a 60 m stilt
            // frame): it is drawn down to the ground
            if (b.minH > 8 && samples.some(([x, z]) => onRibbon(x, z, 1) || isWater(x, z))) continue; // (a building spanning a street or water: a real passage over it)
            if (b.minH > 8) { b.minH = 0; floatingSupport.grounded = (floatingSupport.grounded || 0) + 1; continue; }
            let n = 0;
            for (let i = 0; i < b.ring.length; i++) {
                const a = b.ring[i], c = b.ring[(i + 1) % b.ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), k = Math.max(1, Math.ceil(L / 9));
                for (let j = 0; j < k; j++) {
                    const [x, z] = inset([a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k], .6);
                    if (under(x, z) || onRibbon(x, z, .6) || isWater(x, z)) continue;
                    cellOf(x, z).solid.box(x, 0, z, .6, b.minH, .6, 0, conc); floatingSupport.colls.push({ x, z, hw: .3, hd: .3, angle: 0, r: .45, poly: null, h: b.minH, prop: true, kind: 'pier' }); n++;
                }
            }
            if (n) { floatingSupport.parts++; floatingSupport.columns += n; }
        }
    }
    const lmGroup = new THREE.Group(); lmGroup.name = 'landmarks'; group.add(lmGroup);
    const sourceBuildingRecs = new Map();
    if (data.buildingGeometryPolicy === 'source') for (const b of bRecs) {
        if (b.i >= data.buildings.length) continue; // derived residuals do not invent additional source identities
        const sourceId = data.buildingIds?.[b.i];
        if (sourceId) { const list = sourceBuildingRecs.get(sourceId) || []; list.push(b); sourceBuildingRecs.set(sourceId, list); }
    }
    // (owner, 2026-11-12, Bd. Unirii: "fountains ... towards street or on street") the carriageway edges as built, drivable
    // ribbons and scenery streets alike, for a model that stands between two carriageways (ctx.kerbAlong below)
    let kerbGrid = null;
    const kerbSegments = () => {
        if (kerbGrid) return kerbGrid;
        kerbGrid = new BoxGrid(64);
        const add = (ax, az, bx, bz) => kerbGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]);
        for (const e of edges) {
            if (e.virtual || e.tunnel || e.bridge || e.layer) continue;
            for (const o of [-e.wL, e.wR]) add(e.a.x + e.nx * o, e.a.z + e.nz * o, e.b.x + e.nx * o, e.b.z + e.nz * o);
        }
        for (const [ri, r] of (data.scenery || []).entries()) {
            if ((r[3] & 1) && data.roadGeometryPolicy !== 'source') continue;
            const profile = scenerySourceProfile(data, ri, undelta(r, 4)), pts = profile.points;
            for (let i = 0; i + 1 < pts.length; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                const nx = -(bz - az) / L, nz = (bx - ax) / L;
                for (const o of [-profile.leftM, profile.rightM]) add(ax + nx * o, az + nz * o, bx + nx * o, bz + nz * o);
            }
        }
        return kerbGrid;
    };
    // (r2-builder) the scenery street nearest to a point, shaped like nearestEdge's result: businesses of the edge strip
    // (data.pois appended by tools/osm/add-pois.mjs, up to 100 m outside the playable edge) face a real street that is not
    // a graph edge, so their fascia had no "street front" to go on
    let sceneryStreetGrid = null;
    const sceneryStreetNear = (x, z, maxR) => {
        if (!sceneryStreetGrid) {
            sceneryStreetGrid = new BoxGrid(64);
            for (const [ri, r] of (data.scenery || []).entries()) {
                if (r[3] & 1) continue; // (bridge decks: not a street front)
                const pts = scenerySourceProfile(data, ri, undelta(r, 4)).points;
                for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; sceneryStreetGrid.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), [ax, az, bx, bz]); }
            }
        }
        let best = null, bd = maxR;
        sceneryStreetGrid.each(x - maxR, z - maxR, x + maxR, z + maxR, ([ax, az, bx, bz]) => { const q = distPointSeg(x, z, ax, az, bx, bz); if (q.d < bd) { bd = q.d; best = { d: q.d, cx: q.cx, cz: q.cz }; } });
        return best;
    };
    for (const lm of LANDMARKS) {
        try {
            let p = city.proj(lm.lat, lm.lon);
            // district worlds (1:1): realScale models (contract 01: lk = scale / authoredScale, R = radiusM · scale)
            const ctx = { THREE, rng: makeRng(Math.floor(Math.abs(lm.lat * 1e4 + lm.lon * 1e4))), helpers: landmarkHelpers, proj: city.proj, scale: data.proj.scale, US, realScale: !!distId };
            { // (owner register #59 / #60, SeaTac: ramps cut into the garage helix) a model may ask whether a mapped road surface passes
              // a point of its own (local, unrotated) frame within a height band, to leave an opening there
              const c0 = Math.cos(lm.rotation || 0), s0 = Math.sin(lm.rotation || 0), sc = data.proj.scale;
              ctx.roadAt = (lx, lz, y0, y1) => { const wx = p.x + (lx * c0 + lz * s0) * sc, wz = p.z + (-lx * s0 + lz * c0) * sc; let hit = false; surfacesAt(wx, wz, h => { if (h > y0 - .4 && h < y1 + 2.2) hit = true; }, null, true); return hit; };
              // distance (m, model frame) from a point of the model along a unit direction to the nearest carriageway edge, or null
              ctx.kerbAlong = (lx, lz, dx, dz, maxM = 14) => {
                  const wx = p.x + (lx * c0 + lz * s0) * sc, wz = p.z + (-lx * s0 + lz * c0) * sc, ux = dx * c0 + dz * s0, uz = -dx * s0 + dz * c0, R = maxM * sc;
                  let best = Infinity;
                  kerbSegments().each(Math.min(wx, wx + ux * R), Math.min(wz, wz + uz * R), Math.max(wx, wx + ux * R), Math.max(wz, wz + uz * R), ([ax, az, bx, bz]) => {
                      const ex = bx - ax, ez = bz - az, den = ux * ez - uz * ex; if (Math.abs(den) < 1e-9) return;
                      const t = ((ax - wx) * ez - (az - wz) * ex) / den, s = ((ax - wx) * uz - (az - wz) * ux) / den;
                      if (t > 0 && t <= R && s >= 0 && s <= 1 && t < best) best = t;
                  });
                  return best < Infinity ? best / sc : null;
              };
            }
            if (data.buildingGeometryPolicy === 'source') {
                const c = Math.cos(lm.rotation || 0), s = Math.sin(lm.rotation || 0), scale = data.proj.scale;
                const local = ([x, z]) => { const dx = (x - p.x) / scale, dz = (z - p.z) / scale; return [dx * c - dz * s, dx * s + dz * c]; };
                ctx.sourceBuildings = Object.fromEntries((lm.sourceIds || []).map(sourceId => [sourceId, (sourceBuildingRecs.get(sourceId) || []).map(b => ({
                    sourceId, ring: b.ring.map(local), holes: b.holes.map(h => h.map(local)), h: b.h, minH: b.minH, levels: b.levels, roof: b.roof,
                    colour: b.colour, roofColour: b.roofColour, roofProfile: b.roofProfile, rawHeight: b.roofProfile?.originalOSM?.height ?? b.roofProfile?.raw?.height, heightSource: b.roofProfile?.heightSource, heightSourceCode: data.buildingInfo?.[b.i * 5 + 4],
                    provenance: 'precise district source geometry; inverse landmark yaw and projection scale; dimensions retain their recorded source/estimate code',
                }))]));
            }
            if (lm.backdrop) {
                // real position is beyond the far plane: pull it in along the same bearing from the map centre and shrink it
                const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
                const dx = p.x - cx, dz = p.z - cz, real = Math.hypot(dx, dz) || 1;
                const want = Math.min(real, 3600);
                ctx.backdropScale = want / real;
                p = { x: cx + dx / real * want, z: cz + dz / real * want };
            }
            const res = buildLandmarkFn ? buildLandmarkFn(lm, ctx) : lm.build(ctx);
            if (!res || !res.mesh) continue;
            res.mesh.position.set(p.x, res.mesh.position.y || 0.12, p.z);
            // models are authored at 1:1 (Seattle ones already squashed to 0.5) → match the world's x/z scale
            const lk = distId && res.authoredScale ? data.proj.scale / res.authoredScale : lm.city === 'seattle' ? data.proj.scale / SEA_SCALE : data.proj.scale; // (legacy: Seattle models are authored squashed by SEA_SCALE)
            // in the compressed DN1 strip (Băneasa → Otopeni) the city is squashed north–south: squash the model too
            const cf = (!lm.backdrop && data.proj.compress && lm.lat > data.proj.compress.above) ? data.proj.compress.factor : 1;
            if (cf !== 1) {
                const wrap = new THREE.Group(); wrap.name = 'landmark-wrap:' + lm.id;
                wrap.position.copy(res.mesh.position); res.mesh.position.set(0, 0, 0);
                wrap.scale.set(lk, 1, lk * cf); wrap.add(res.mesh); res.mesh = wrap;
            } else if (lk !== 1 && !lm.backdrop) { res.mesh.scale.x *= lk; res.mesh.scale.z *= lk; }
            if (lm.backdrop) { lmGroup.add(res.mesh); res.mesh.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); continue; }
            res.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            lmGroup.add(res.mesh);
            const names = (lm.osmNames || []).map(s => s.toLowerCase());
            const R = distId && res.authoredScale && lm.radiusM != null ? lm.radiusM * data.proj.scale : (lm.footprintRadius || 0) * lk;
            const sourcePolicy = data.buildingGeometryPolicy === 'source';
            const replacementIds = new Set(lm.sourceIds || []), replacedSources = new Set();
            if (sourcePolicy) {
                for (const b of bRecs) if (replacementIds.has(data.buildingIds?.[b.derivedFrom ?? b.i])) {
                    b.skip = true;
                    b.landmarkReplacement = lm.id; b.landmarkUnitSigns = !!lm.unitSigns; // (unitSigns: a mall model keeps its mapped tenants' fascias)
                    replacedSources.add(data.buildingIds[b.derivedFrom ?? b.i]);
                }
                landmarkSourceReplacements.push({ landmark: lm.id, declared: [...replacementIds], replaced: [...replacedSources], unmatched: [...replacementIds].filter(id => !replacedSources.has(id)) });
            }
            bGrid.each(p.x - R - 60, p.z - R - 60, p.x + R + 60, p.z + R + 60, (b) => {
                if (sourcePolicy) return; // identity, never a nearby centroid/name, determines the authored replacement
                if (b.skip) return;
                const nm = b.name.toLowerCase();
                const dB = Math.hypot(b.c[0] - p.x, b.c[1] - p.z);
                // (2026-11-08) a name match only counts near the model: the school's name reached its sports hall (a POI sign)
                // 65 m away and hid it
                const namedMatch = nm && names.some(n => nm.includes(n));
                // A scenery landmark's radius is only a coarse clearing hint.
                // Keep other named OSM buildings in the detailed ring (e.g.
                // Sala Palatului behind the Royal Palace), not covered by it.
                const namedNeighbour = (b.flags & 32) && nm && !namedMatch;
                if ((namedMatch && dB < R + 25) || (dB < R && !namedNeighbour)) b.skip = true;
                else if (nm && names.some(n => nm.includes(n)) && (lm.ownSign || lm.cvStop)) { b.flags &= ~2; b.name = ''; } // (its name only: the model carries the sign)
            });
            for (const cb of res.collision || []) {
                const baseY = res.mesh.position.y || 0.12, bands = { h: cb.h === undefined ? 20 : cb.h + baseY };
                // Explicit structural bands use the complete native body height.
                // Legacy authored colliders have no minH and retain their exact bands.
                if (cb.minH !== undefined) bands.minH = cb.minH + baseY;
                if (cb.structureKind) { bands.structureKind = cb.structureKind; bands.sourceId = cb.sourceId; }
                if (cb.y0 !== undefined) bands.y0 = cb.y0 + baseY;
                if (cb.y1 !== undefined) bands.y1 = cb.y1 + baseY;
                if (cb.poly?.length >= 3) {
                    const toWorld = ([x, z]) => [p.x + x * lk, p.z + z * lk * cf];
                    const poly = cb.poly.map(toWorld), holes = (cb.holes || []).map(h => h.map(toWorld));
                    const xs = poly.map(v => v[0]), zs = poly.map(v => v[1]);
                    const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
                    const hw = (Math.max(...xs) - Math.min(...xs)) / 2, hd = (Math.max(...zs) - Math.min(...zs)) / 2;
                    collisionBoxes.push({ x, z, hw, hd, angle: 0, r: Math.hypot(hw, hd), ...bands, poly, holes, landmark: lm.id });
                    continue;
                }
                if (cf !== 1) { // axis-aligned bounds of the rotated box, squashed N–S
                    const a = cb.angle || 0, ex = Math.abs(cb.hw * Math.cos(a)) + Math.abs(cb.hd * Math.sin(a)), ez = Math.abs(cb.hw * Math.sin(a)) + Math.abs(cb.hd * Math.cos(a));
                    const hw = ex * lk, hd = ez * lk * cf;
                    collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk * cf, hw, hd, angle: 0, r: Math.hypot(hw, hd), ...bands, poly: null, landmark: lm.id });
                } else collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk, hw: cb.hw * lk, hd: cb.hd * lk, angle: cb.angle || 0, r: Math.hypot(cb.hw, cb.hd) * lk, ...bands, poly: null, landmark: lm.id });
            }
            const toW = ([x, z]) => [p.x + x * lk, p.z + z * lk];
            for (const a of res.waterFootprints || []) landmarkWaterFootprints.push({ ...a, ring: a.ring.map(toW) });
            for (const f of res.fences || []) landmarkFences.push({ ...f, ring: f.ring.map(toW), inside: f.inside ? f.inside.map(toW) : (f.closed ? f.ring.map(toW) : null), gates: (f.gates || []).map(g => ({ ...g, x: p.x + g.x * lk, z: p.z + g.z * lk, w: (g.w || 4) * lk })) });
            for (const g of res.grounds || []) { const q = g.map(toW); lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) }); }
            for (const g of res.coverPolys || []) { // every OSM building centred inside (a stadium's own stands / boxes)
                const q = g.map(toW), x0 = Math.min(...q.map(v => v[0])), x1 = Math.max(...q.map(v => v[0])), z0 = Math.min(...q.map(v => v[1])), z1 = Math.max(...q.map(v => v[1]));
                if (!sourcePolicy) bGrid.each(x0, z0, x1, z1, (b) => { if (!b.skip && pointInPolygon(b.c[0], b.c[1], q)) b.skip = true; });
            }
            for (const pt of res.covers || []) { // OSM buildings the model replaces (e.g. a school's sports hall)
                const [cx, cz] = toW(pt);
                if (!sourcePolicy) bGrid.each(cx, cz, cx, cz, (b) => { if (!b.skip && cx >= b.x0 && cx <= b.x1 && cz >= b.z0 && cz <= b.z1 && pointInPolygon(cx, cz, b.ring)) b.skip = true; });
            }
            landmarks.push({ id: lm.id, label: lm.name, x: p.x, z: p.z, clear: res.clear || R, radius: R, mesh: res.mesh });
        } catch (err) { console.warn('landmark failed', lm.id, err); }
    }
    // Validate physical visibility after authored replacements, without changing
    // source assembly membership or suppressing legitimate exterior details.
    const physicalUnionAudit = [], physicalUnionRejected = [];
    const unionSources = new Map((data.buildingUnions?.sources || []).map(s => [s.i, s]));
    const unionChecks = new Map(); // (this loop only sets b.sourceSurface, which no check reads)
    for (const spec of data.buildingUnions?.surfaces || []) {
        const b = bRecs[spec.i], reason = validateSourceSurface(spec, unionSources, bRecs, { requireAuthority: data.buildingUnions.version >= 2, points: data.buildingGeometryPoints, memo: unionChecks });
        if (reason) { physicalUnionRejected.push({ source: data.buildingIds?.[b?.derivedFrom ?? spec.i] || spec.i, reason }); continue; }
        b.sourceSurface = geometrySurface(spec.surface, data.buildingGeometryPoints);
        physicalUnionAudit.push({ source: data.buildingIds?.[b.derivedFrom ?? b.i] || b.i, neighbours: spec.neighbours.length });
    }
    const inferredDetailAudit = { ranges: 0, clippedAreaM2: 0, issues: [] }, detailRoofs = new Map();
    // roofMesh is pure and its result is only read: a building's roof (the building loop) and the same building as a
    // detail-clipping neighbour share one computation while its ring, holes and profile are the same objects
    const roofMeshMemo = new Map();
    function roofMeshOf(b) {
        const m = roofMeshMemo.get(b);
        if (m && m.ring === b.ring && m.holes === b.holes && m.profile === b.roofProfile) return m.mesh;
        const mesh = roofMesh(b.ring, b.holes, b.roofProfile, triangulate);
        roofMeshMemo.set(b, { ring: b.ring, holes: b.holes, profile: b.roofProfile, mesh }); return mesh;
    }
    /** () => the roof mesh of b over `ring` with b's current holes and profile, computed on the first call */
    function lazyRoofMesh(b, ring) {
        const holes = b.holes, profile = b.roofProfile; let mesh = null;
        return () => mesh || (mesh = ring === b.ring && holes === b.holes && profile === b.roofProfile ? roofMeshOf(b) : roofMesh(ring, holes, profile, triangulate));
    }
    function completeDetailRoof(b) {
        if (detailRoofs.has(b.i)) return detailRoofs.get(b.i);
        let mesh = null;
        if (sourceSurfaceEligible(b)) {
            if (b.roofProfile) mesh = roofMeshOf(b);
            else if (b.roof === 'flat') { const { pts, tris } = triangulate(b.ring, b.holes); mesh = { faces: tris.map(t => t.map(i => [pts[i][0], b.h, pts[i][1]])) }; }
        }
        const result = mesh ? { i: b.i, sourceId: b.sourceId, minH: b.minH, mesh } : null;
        detailRoofs.set(b.i, result); return result;
    }
    // (spec 10 load budget) With the build workers, a range's clipping is computed there: its faces stay in the builder
    // for now and finishDetailClips(), right after the building loop and before anything else reads those builders,
    // splices each clipped result in, in call order, shifting the vertex indices of the triangles appended after it.
    // That yields the arrays the in-place clip (clipBuildingDetailRange) produces, and the same audit, in the same order.
    const pendingDetailClips = [];
    const unflatFaces = (flat, size) => { const faces = []; for (let k = 0; k < flat.length; k += 3 * size) { const f = []; for (let j = 0; j < 3; j++) f.push(Array.from(flat.subarray(k + j * size, k + (j + 1) * size))); faces.push(f); } return faces; };
    // (spec 10 load budget) with the build workers a neighbour's complete roof is made there, from its ring, holes, profile
    // and height as they are at its first use here (completeDetailRoof keeps a neighbour's first roof in the same way)
    const detailSpecs = new Map();
    function detailSpec(b) {
        if (detailSpecs.has(b.i)) return detailSpecs.get(b.i);
        const kind = sourceSurfaceEligible(b) ? (b.roofProfile ? 1 : b.roof === 'flat' ? 2 : 0) : 0;
        const spec = kind ? { i: b.i, sourceId: b.sourceId, minH: b.minH, kind, ring: b.ring, holes: b.holes, profile: b.roofProfile, h: b.h } : null;
        detailSpecs.set(b.i, spec); return spec;
    }
    /** the complete roof faces of a spec, as completeDetailRoof makes them (build-worker.js makes the same) */
    const specFaces = spec => { if (spec.kind === 1) return roofMesh(spec.ring, spec.holes, spec.profile, triangulate).faces; const { pts, tris } = triangulate(spec.ring, spec.holes); return tris.map(t => t.map(i => [pts[i][0], spec.h, pts[i][1]])); };
    function detailNeighbours(owner, faces, flat = null, spec = false) {
            let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
            if(flat)for(let k=0;k<flat.length;k+=12){x0=Math.min(x0,flat[k]);z0=Math.min(z0,flat[k+2]);x1=Math.max(x1,flat[k]);z1=Math.max(z1,flat[k+2]);}
            else for(const f of faces)for(const p of f){x0=Math.min(x0,p[0]);z0=Math.min(z0,p[2]);x1=Math.max(x1,p[0]);z1=Math.max(z1,p[2]);}
            const neighbours=[],seen=new Set();
            bGrid.each(x0,z0,x1,z1,b=>{
                if(seen.has(b.i))return;seen.add(b.i);
                // BoxGrid visits each occupied cell. Query each actual source
                // once, and reject disjoint bounds in the emitted Float32 frame.
                if(b===owner||b.skip||Math.min(b.x0,Math.fround(b.x0))>x1||Math.max(b.x1,Math.fround(b.x1))<x0||Math.min(b.z0,Math.fround(b.z0))>z1||Math.max(b.z1,Math.fround(b.z1))<z0)return;
                if(spec){const s=detailSpec(b);neighbours.push(s?{i:s.i,sourceId:s.sourceId,minH:s.minH,spec:s}:{i:b.i,sourceId:b.sourceId,minH:b.minH,spec:null});return;}
                const roof=completeDetailRoof(b);
                if(roof)neighbours.push(roof);else neighbours.push({i:b.i,sourceId:b.sourceId,minH:b.minH});
            });
            return neighbours;
    }
    function clipBuildingDetails(builder, start, owner) {
        if (data.buildingGeometryPolicy !== 'source' || builder.ic === start.ic) return;
        if (buildPool) {
            // the faces exactly as clipBuildingDetailRange reads them (12 attributes per point)
            const P = builder.p, N = builder.n, U = builder.u, C = builder.c, Tl = builder.t, I = builder.i, nf = (builder.ic - start.ic) / 3, flat = new Float64Array(nf * 36);
            let k = 0;
            for (let q = start.ic; q < builder.ic; q++) { const v = I[q]; flat[k++] = P[v * 3]; flat[k++] = P[v * 3 + 1]; flat[k++] = P[v * 3 + 2]; flat[k++] = N[v * 3]; flat[k++] = N[v * 3 + 1]; flat[k++] = N[v * 3 + 2]; flat[k++] = U[v * 2]; flat[k++] = U[v * 2 + 1]; flat[k++] = C[v * 3]; flat[k++] = C[v * 3 + 1]; flat[k++] = C[v * 3 + 2]; flat[k++] = Tl ? Tl[v] : -1; }
            const neighbours = detailNeighbours(owner, null, flat, true);
            const job = { builder, sv: start.vc, ev: builder.vc, si: start.ic, ei: builder.ic, owner, flat, neighbours };
            job.promise = buildPool.clip(flat, { i: owner.i, sourceId: owner.sourceId }, neighbours);
            pendingDetailClips.push(job);
            return;
        }
        const result = clipBuildingDetailRange(builder, start, owner, faces => detailNeighbours(owner, faces));
        inferredDetailAudit.ranges++; inferredDetailAudit.clippedAreaM2 += result.clippedAreaM2;
        for(const issue of result.issues)if(inferredDetailAudit.issues.length<100)inferredDetailAudit.issues.push({owner:owner.sourceId,...issue});
    }
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
    // keep the marker colour in sync when main.js assigns poi.color later
    for (const p of pois) Object.defineProperty(p, 'color', {
        get() { return this._color; }, set(v) { this._color = v; if (this.marker && v) this.marker.userData.pin.material.color.set(v); }, configurable: true, enumerable: true,
    });
    for (const p of pois) p.color = p._color || (city.pois.find(q => q.id === p.id) || {}).color || null;
    const lmSignColl = []; // (monument signs: colliders added with the other props below)
    // CV facade sign on landmark-hosted stops (poi.landmark: uipath-bel → lincoln, uipath-buc → thelandmark, arnia →
    // europehouse): the models only carry real-world signage, so the stop's sign goes on the facade nearest its door,
    // found by casting rays from the door at sign height to the model (the real facade, not a trimmed collision box)
    {
        const rc = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(), nW = new THREE.Vector3();
        lmGroup.updateMatrixWorld(true);
        for (const poi of pois) {
            if (!poi.landmark || poi.passing) continue;
            const lmk = landmarks.find(l => l.id === poi.landmark); if (!lmk || !lmk.mesh) continue;
            if (LANDMARKS.some(l => l.id === lmk.id && l.ownSign)) continue; // the model carries its own real signage (landmarks Request)
            const s = signs.get(poi.label, '#111827', '#ffffff', poi._color || '#f97316'); if (!s) continue;
            const facadeAt = (ys, minDot) => { let best = null;
                for (let k = -6; k <= 6; k++) { // a fan of rays toward the model
                    const bx = lmk.x - poi.doorX, bz = lmk.z - poi.doorZ, a0 = Math.atan2(bz, bx) + k * 0.12;
                    o3.set(poi.doorX, ys, poi.doorZ); d3.set(Math.cos(a0), 0, Math.sin(a0));
                    rc.set(o3, d3); rc.far = 80;
                    const hit = rc.intersectObject(lmk.mesh, true).find(h => h.face && h.object.isMesh && h.object.visible);
                    if (!hit) continue;
                    nW.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); nW.y = 0;
                    if (nW.lengthSq() < 0.25) continue; nW.normalize();
                    if (nW.x * -d3.x + nW.z * -d3.z < minDot) continue; // facing the door
                    if (!best || hit.distance < best.d) best = { d: hit.distance, x: hit.point.x, z: hit.point.z, nx: nW.x, nz: nW.z };
                }
                return best; };
            // beside the entrance at 7.5 m (its canopy carries the building's own lettering), else above the canopy,
            // on a flush stretch of facade (slid along it); last resort: over the door, narrower
            let pick = null;
            for (const ys of [7.5, 10, 12.5]) {
                const best = facadeAt(ys, 0.8); if (!best) continue;
                const { nx, nz } = best, w = 12;
                for (const sg of [0, 1, -1]) {
                    const tx = nz * (sg || 1), tz = -nx * (sg || 1), d = sg ? w / 2 + 3 : 0, px = best.x + tx * d, pz = best.z + tz * d;
                    let flush = true;
                    for (const f of [-w / 2 + 0.5, -w / 4, 0, w / 4, w / 2 - 0.5]) {
                        o3.set(px + tx * f + nx * 6, ys, pz + tz * f + nz * 6); d3.set(-nx, 0, -nz); rc.set(o3, d3); rc.far = 12;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0]; if (!h2 || Math.abs(h2.distance - 6) > 0.6) { flush = false; break; }
                    }
                    if (flush) { pick = { ys, nx, nz, cx: px, cz: pz, w }; break; }
                }
                if (pick) break;
            }
            if (!pick) { // entrance canopy: tenant letters standing on its front edge, facing the street (above the canopy's own lettering)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35);
                if (best) {
                    // walk from the kerb side of the door toward the building with downward rays: the first roof found
                    // 3–8.5 m up is the canopy's front edge
                    let end = null, ch = 0;
                    for (let k = 0; k < 40; k++) {
                        const px = poi.doorX + best.nx * 2 - best.nx * 0.3 * k, pz = poi.doorZ + best.nz * 2 - best.nz * 0.3 * k;
                        o3.set(px, 9.0, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 9.0;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0], hy = h2 ? 9.0 - h2.distance : 0;
                        if (h2 && hy > 3 && hy < 8.5) { end = [px, pz]; ch = hy; break; }
                        if (h2 && hy >= 8.5) break;
                    }
                    if (end) {
                        // (round 6 note 24) the letters must not run into the model: at Lincoln Square the 8 m sign's end went
                        // through the angled lobby glazing's mullions. Rays along the sign's face (left end → right end, at
                        // three heights) find anything crossing it; narrower / further forward until it is clear.
                        const asp = (signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316') || s).aspect, tx = best.nz, tz = -best.nx;
                        const clearAt = (cx, cz, ww, ys0, hh0) => {
                            for (const fy of [-0.4, 0, 0.4]) for (const fn of [-0.05, 0.05]) {
                                o3.set(cx - tx * (ww / 2 + 0.3) + best.nx * fn, ys0 + fy * hh0, cz - tz * (ww / 2 + 0.3) + best.nz * fn); d3.set(tx, 0, tz);
                                rc.set(o3, d3); rc.far = ww + 0.6; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false;
                            }
                            return true;
                        };
                        let fit = null;
                        for (const ww of [8, 7, 6, 5, 4.2]) { for (const fwd of [-0.4, 0.15, 0.7]) { const hh2 = ww / asp, cx = end[0] + best.nx * fwd, cz = end[1] + best.nz * fwd, ys0 = ch + hh2 / 2 + 0.25; if (clearAt(cx, cz, ww, ys0, hh2)) { fit = { ww, cx, cz, ys0 }; break; } } if (fit) break; }
                        if (!fit) { const hh2 = 4.2 / asp; fit = { ww: 4.2, cx: end[0] + best.nx * 0.7, cz: end[1] + best.nz * 0.7, ys0: ch + hh2 / 2 + 0.25 }; }
                        pick = { ys: fit.ys0, nx: best.nx, nz: best.nz, cx: fit.cx, cz: fit.cz, w: fit.ww, canopy: true, text: poi.label.split(' — ')[0] };
                    }
                }
            }
            if (!pick) { // no flush facade (glazed lobby under a canopy): a freestanding tenant monument sign by the entrance,
                // set across the sidewalk so it reads from the street in both directions (like real office-tower signage)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35); if (!best) continue;
                const { nx, nz } = best, short = signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316'); if (!short) continue;
                const midX = (best.x + poi.doorX) / 2, midZ = (best.z + poi.doorZ) / 2;
                let placed = false;
                // (round 6 note 24) clear of the model itself: Lincoln Square's lobby mullions / door frames stand 0.66 m out
                // from its glazing and cut through a sign placed there
                const clearOfModel = (x, z, tx, tz, W) => {
                    for (const f of [-W / 2 - 0.3, 0, W / 2 + 0.3]) {
                        const px = x + tx * f, pz = z + tz * f;
                        for (const sd of [1, -1]) { o3.set(px, 1.6, pz); d3.set(nx * sd, 0, nz * sd); rc.set(o3, d3); rc.far = 1.4; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false; }
                        o3.set(px, 12, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 11.8;
                        const h = rc.intersectObject(lmk.mesh, true).find(h => h.object.isMesh && h.object.visible); if (h && 12 - h.distance > 0.3 && 12 - h.distance < 3.5) return false;
                    }
                    return true;
                };
                for (const [off, out] of [[6, 0], [-6, 0], [9, 0], [-9, 0], [4, 0], [-4, 0], [6, 2], [-6, 2], [9, 2], [-9, 2], [0, 3], [12, 1], [-12, 1]]) {
                    const tx = nz, tz = -nx, x = midX + tx * off + nx * out, z = midZ + tz * off + nz * out;
                    if (onRibbon(x, z, 1.8) || buildingAt(x, z) || !clearOfModel(x, z, tx, tz, 3.2)) continue;
                    const c2 = cellOf(x, z), W = 3.2, H = W / short.aspect;
                    c2.solid.box(x, 0.15, z, W + 0.5, 0.35, 0.7, Math.atan2(nx, nz) + Math.PI / 2, rgb('#8a8d91')); // plinth
                    c2.solid.box(x, 0.5, z, W + 0.3, H + 0.5, 0.42, Math.atan2(nx, nz) + Math.PI / 2, rgb('#2b2f36')); // slab
                    for (const sd of [1, -1]) addSignQuad(c2, x, z, Math.atan2(tx, tz), sd, W, H, 0.75 + H / 2, short, 0.22);
                    lmSignColl.push([x, z]);
                    poi.landmarkSign = { x, z, y: 0.75 + H / 2, nx: tx, nz: tz, w: W, h: H, monument: true }; placed = true; break;
                }
                if (placed) continue;
                pick = { ys: 7.5, nx, nz, cx: best.x, cz: best.z, w: 8 };
            }
            const { ys, nx, nz, cx, cz, w } = pick;
            const sg = pick.text ? signs.get(pick.text, '#111827', '#ffffff', poi._color || '#f97316') || s : s;
            const hh = w / sg.aspect, mx = cx + nx * 0.15, mz = cz + nz * 0.15;
            const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
            const mbS = signMB(cellOf(mx, mz), sg.page), wh = [255, 255, 255];
            const i0 = mbS.v(lx, ys - hh / 2, lz, nx, 0, nz, sg.u0, sg.v0, wh), i1 = mbS.v(rx, ys - hh / 2, rz, nx, 0, nz, sg.u1, sg.v0, wh);
            const i2 = mbS.v(rx, ys + hh / 2, rz, nx, 0, nz, sg.u1, sg.v1, wh), i3 = mbS.v(lx, ys + hh / 2, lz, nx, 0, nz, sg.u0, sg.v1, wh);
            mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
            poi.landmarkSign = { x: mx, z: mz, y: ys, nx, nz, w, h: hh };
        }
    }

    // ground-floor shops along the streets of the CV stops (the owner drives there: give them life) — legacy corridor maps
    // only: the district worlds are real 1:1 streets, their shops come from the data (OSM shops / businesses / research);
    // invented ones put shopfronts with awnings on the residential blocks round C.A. Rosetti (Str. Georges Bizet)
    if (!realPass) for (const p of pois) if (p.cv) bGrid.each(p.x - 140, p.z - 140, p.x + 140, p.z + 140, (o) => {
        if (!o.skip && o.h > 6 && o.minH <= 0 && ['interwar', 'eclectic', 'civic', 'bloc', 'plain'].includes(o.style) && Math.hypot(o.c[0] - p.x, o.c[1] - p.z) < 140 && o.area < 6000) o.flags |= 1;
    });
    // ---- extrude buildings
    // (round 5, note 77) non-residential archetypes from the research building specs: game/src/archetypes.js
    let ARCH = null;
    const archetypeData = coveredOutlines.length && data.buildingSpec ? { ...data, buildingSpec: data.buildingSpec.map(row => row.length === 17 ? [buildingIndex(row[0]), ...row.slice(1)] : row) } : data;
    try { ARCH = (await archetypesModule()).createArchetypes({ city, distId, data: archetypeData, US, CELL, proj: (la, lo) => city.proj(la, lo), bGrid, buildingAt, nearestEdge, onRibbon, signs, addSignQuad, brandStyle, triangulate, pointInPolygon, signedArea, TILE, TILE_GRID }); ARCH.match(bRecs); }
    catch (err) { console.warn('[arch] archetypes unavailable', err); ARCH = null; }
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    const facadeBoards = [], fasciaLayoutAudit = [];
    const propColl = []; // small circles for street furniture (trees, posts, shelters…)
    propColl.push(...floatingSupport.colls); // (the columns under floating source parts, above)
    propColl.push(...tramDecks, ...bridgeJunctionDecks);
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
        basarabStructure = buildBasarabStructure(data, tramGrades, cellOf, group, edges, { roadRegions: basarabRoadRegions, tramEnvelope: tramPropEnvelope, tramSweep, roadFootprints: basarabDistrict ? edges.filter(e => e.bridge && !e.virtual && !e.tunnel && basarabDeck(e)).map(e => asphaltCorners(e, (f, sd) => widthAsphalt(f, sd) + .4)) : [], supportAt: (x, z, base) => { let top = null; surfacesAt(x, z, h => { if (Math.abs(h - base) < .3 && (top === null || Math.abs(h - base) < Math.abs(top - base))) top = h; }); return top; } });
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
    // ---- the guard of the Pasajul Basarab decks: one rule (deck-outline.js). The railing stands 0.3 m outside every
    //      elevated carriageway side and pad rim, wherever no other carriageway (or filled median) continues there at
    //      its level: the outline of the union of the carriageways. It replaces five stages that each cut or added
    //      pieces by their own tests (the builder's rail, the lane cut, the "completion" walk, end joins, width tapers,
    //      a last removal on other roads); their thresholds disagreed and left the reports of 2026-11-12: no guard above
    //      a street passing below (588, -861), none between the carriageway and the tram slab (498, -797), gore noses
    //      left open (426, -750), zigzag and stray pieces at merges (376, -727), (80, -90), (93, 72). A tram slab, the
    //      slot infill or a platform beside the carriageway no longer opens the edge (Street View on Pasajul Basarab at
    //      44.44503, 26.06120: the carriageway keeps its barrier along the tracks). The railing runs down to 0.15 m
    //      above the street (owner, (134, -475): "why not fence till the end").
    const ghostRails = []; // railing pieces drawn without a collision wall (inside the tram guard's cover, clear of the tram body)
    const railingDrops = [], DROP = (x, z, why) => railingDrops.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, why]); // (stats.railingDrops: where a railing piece was left out, and why)
    const guardCompletion = { basis: 'Pasajul Basarab: railing on the outline of the union of its elevated carriageways (deck-outline.js)', candidates: 0, runs: 0, lengthM: 0, addedM: 0, welds: 0, strays: 0, sweptM: 0, replacedWalls: 0 };
    {
        const GROW = .3, EPS = .05, LEVEL = .6, LOW = .15;
        for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i]; if (w.edge && !w.tramDeckRailing && basarabDeck(w.edge) && (w.kind === 'rail' || w.kind === 'embank' || (w.kind === 'barrier' && w.inferred === true))) { walls.splice(i, 1); guardCompletion.replacedWalls++; } }
        // is (x, z) of a guard line at road level y taken by another surface: within GROW of a carriageway or pad at this
        // level (its own guard line runs there, or the two are one road), inside a deck up to 3 m above (the line would stand
        // in that deck), or at a filled median
        const sidePolys = new Map(), sideOf = e => { let q = sidePolys.get(e); if (!q) sidePolys.set(e, q = asphaltCorners(e, widthSide)); return q; };
        const takenAt = (x, z, y, ownE, ownN, ownMedian = null) => {
            let hit = false;
            surfGrid.each(x - 1, z - 1, x + 1, z + 1, o => {
                if (hit || (ownE && o.e === ownE) || (ownN && o.node === ownN) || x < o.x0 - 1 || x > o.x1 + 1 || z < o.z0 - 1 || z > o.z1 + 1) return;
                const dy = o.h(x, z) - y; if (dy <= -LEVEL || dy >= 3) return;
                // (on another deck's walkway band too: two decks parting share their walkways until those separate, so the
                // two guards meet in one nose there instead of a short cage of two pieces before a filled median begins)
                if (pointInPolygon(x, z, o.poly) || polyDist(x, z, o.poly) < GROW - EPS || (o.e && o.e.bridge && pointInPolygon(x, z, sideOf(o.e)))) hit = true;
            });
            if (!hit) medianGrid.each(x - .7, z - .7, x + .7, z + .7, d => { if (!hit && d !== ownMedian && Math.abs(d.roofHeightAt(x, z) - Y.road - y) < 1.6 && (pointInPolygon(x, z, d.poly) || polyDist(x, z, d.poly) < (ownMedian ? .05 : .65))) hit = true; });
            return hit;
        };
        const cands = [];
        for (const e of edges) {
            if (!e.bridge || e.virtual || e.tunnel || !basarabDeck(e)) continue;
            const [aR, bR, bL, aL] = asphaltCorners(e, (f, sd) => widthAsphalt(f, sd) + GROW), h = (x, z) => yAlong(e, x, z);
            cands.push({ e, node: null, a: aR, b: bR, nx: -e.nx, nz: -e.nz, h, low: e.overWater ? -Infinity : LOW }, { e, node: null, a: aL, b: bL, nx: e.nx, nz: e.nz, h, low: e.overWater ? -Infinity : LOW });
        }
        for (const o of surfList) {
            const n = o.node; if (!n || o.poly.length < 3 || !n.edges.some(e => e.bridge && !e.virtual && !e.tunnel && basarabDeck(e))) continue;
            const P = o.poly, cx = P.reduce((s2, q) => s2 + q[0], 0) / P.length, cz = P.reduce((s2, q) => s2 + q[1], 0) / P.length, h = (x, z) => padHeightAt(n, x, z);
            for (let k = 0; k < P.length; k++) {
                const p = P[k], q = P[(k + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < .05) continue;
                let ox = (q[1] - p[1]) / L, oz = -(q[0] - p[0]) / L; if (((p[0] + q[0]) / 2 - cx) * ox + ((p[1] + q[1]) / 2 - cz) * oz < 0) { ox = -ox; oz = -oz; }
                cands.push({ e: n.edges.find(e => e.bridge && !e.virtual && basarabDeck(e)), node: n, a: [p[0] + ox * GROW, p[1] + oz * GROW], b: [q[0] + ox * GROW, q[1] + oz * GROW], nx: -ox, nz: -oz, h, low: LOW });
            }
        }
        // the open end of a filled median (where its two carriageways part by more than the fill spans) is an edge too
        for (const d of medianFill.decks) {
            if (!d.edge || !basarabDeck(d.edge)) continue;
            for (const [p, q] of d.caps) {
                const L = Math.hypot(q[0] - p[0], q[2] - p[2]); if (L < .3) continue;
                let ox = (q[2] - p[2]) / L, oz = -(q[0] - p[0]) / L; if (((p[0] + q[0]) / 2 - d.x) * ox + ((p[2] + q[2]) / 2 - d.z) * oz < 0) { ox = -ox; oz = -oz; }
                cands.push({ e: d.edge, node: null, median: d, a: [p[0], p[2]], b: [q[0], q[2]], ox, oz, nx: -ox, nz: -oz, h: (x, z) => d.roofHeightAt(x, z) - Y.road, low: LOW });
            }
        }
        guardCompletion.candidates = cands.length;
        const pieces = [];
        for (const c of cands) {
            const taken = c.median
                ? (x, z) => { const y = c.h(x, z); return !(y > c.low) || takenAt(x + c.ox * .3, z + c.oz * .3, y, null, null, c.median); } // (beyond the cap: the next piece of the fill, or a carriageway)
                : (x, z) => { const y = c.h(x, z); return !(y > c.low) || takenAt(x, z, y, c.node ? null : c.e, c.node); };
            for (const [t0, t1] of openRuns(c.a, c.b, taken)) {
                const a = [c.a[0] + (c.b[0] - c.a[0]) * t0, c.a[1] + (c.b[1] - c.a[1]) * t0], b = [c.a[0] + (c.b[0] - c.a[0]) * t1, c.a[1] + (c.b[1] - c.a[1]) * t1];
                pieces.push({ a, b, ya: c.h(...a), yb: c.h(...b), c });
            }
        }
        // a railing a tram's swept body reaches is not built (the tram would run through it): a run that the sweep touches
        // first moves toward its own carriageway, to the asphalt edge at most
        const bodyLine = (a, b, ya, yb) => !!tramSweep && !!tramSweep.segment(a, b, -.15, Math.min(ya, yb) - .6, Math.max(ya, yb) + 1.1); // (the tram's own body plus 5 cm)
        const sweptLine = (a, b, ya, yb) => !!tramSweep && !!tramSweep.segment(a, b, .05, Y.road + Math.min(ya, yb) - .6, Y.road + Math.max(ya, yb) + 1.1);
        for (const p of pieces) {
            if (p.c.median || !sweptLine(p.a, p.b, p.ya, p.yb)) continue;
            for (const d of [.15, .3, .45, .6]) { const a = [p.a[0] + p.c.nx * d, p.a[1] + p.c.nz * d], b = [p.b[0] + p.c.nx * d, p.b[1] + p.c.nz * d]; if (!sweptLine(a, b, p.ya, p.yb)) { p.a = a; p.b = b; guardCompletion.insetM = (guardCompletion.insetM || 0) + Math.hypot(b[0] - a[0], b[1] - a[1]); break; } }
            // still inside the cover the tram guard keeps free (its body plus 0.2 m): the nearest line clear of the body itself
            if (sweptLine(p.a, p.b, p.ya, p.yb)) for (const d of [0, .15, .3, .45, .6]) { const a = [p.a[0] + p.c.nx * d, p.a[1] + p.c.nz * d], b = [p.b[0] + p.c.nx * d, p.b[1] + p.c.nz * d]; if (!bodyLine(a, b, Y.road + p.ya, Y.road + p.yb)) { p.a = a; p.b = b; break; } }
        }
        guardCompletion.welds = weldEnds(pieces);
        // (owner, 2026-11-12, Grozavesti (376, -727) "area looks broken", (93, 72) "fence sticks out"; earlier (712, -965), (81, -32)) where
        // the deck's outline steps sideways (a carriageway joining, a side narrowing at a node) the railing made a square jog
        // out into the road. The step becomes a 1:4 diagonal: the wider side's run stops early and the step piece leads from
        // there to the narrow side's corner (the deck beyond the diagonal stays as a strip outside the railing).
        {
            const key = q => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100), ends = new Map(), len = p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
            for (const p of pieces) for (const k of ['a', 'b']) { const id = key(p[k]); if (!ends.has(id)) ends.set(id, []); ends.get(id).push({ p, k }); }
            const mate = (p, k) => (ends.get(key(p[k])) || []).filter(q => q.p !== p);
            const away = ({ p: q, k }) => { const o = q[k === 'a' ? 'b' : 'a'], dx = o[0] - q[k][0], dz = o[1] - q[k][1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; };
            let tapers = 0;
            for (const p of pieces) {
                const L = len(p); if (L < .5 || L > 4 || p.c.median) continue;
                const ma = mate(p, 'a'), mb = mate(p, 'b'); if (ma.length !== 1 || mb.length !== 1) continue;
                const dx = (p.b[0] - p.a[0]) / L, dz = (p.b[1] - p.a[1]) / L, A = away(ma[0]), B = away(mb[0]);
                if (Math.abs(A[0] * dx + A[1] * dz) > .5 || Math.abs(B[0] * dx + B[1] * dz) > .5 || A[0] * B[0] + A[1] * B[1] > -.8) continue; // (two runs going opposite ways, square to the step)
                const wideAtA = A[0] * p.c.nx + A[1] * p.c.nz > 0, wide = wideAtA ? ma[0] : mb[0], W = wideAtA ? A : B, T = Math.min(4 * L, W[2] - .5); // (the run on the deck side of the step is the wider side's)
                if (T < 1.5 * L) continue;
                const q = wide.p, at = [q[wide.k][0] + W[0] * T, q[wide.k][1] + W[1] * T];
                q[wide.k] = at; p[wideAtA ? 'a' : 'b'] = at.slice();
                const l2 = len(p), mx = -(p.b[1] - p.a[1]) / l2, mz = (p.b[0] - p.a[0]) / l2, sgn = Math.sign(mx * q.c.nx + mz * q.c.nz) || 1; p.nx = mx * sgn; p.nz = mz * sgn; tapers++;
            }
            guardCompletion.tapers = tapers;
        }
        for (const p of pieces) {
            const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]); if (L < .05) continue;
            const k = Math.max(1, Math.round(L / 2.4)), at = f => [p.a[0] + (p.b[0] - p.a[0]) * f, p.a[1] + (p.b[1] - p.a[1]) * f], c = p.c;
            guardCompletion.runs++;
            for (let j = 0; j < k; j++) {
                const A = at(j / k), B = at((j + 1) / k), ya = Y.road + c.h(...A), yb = Y.road + c.h(...B), len = L / k;
                // the collision band hangs below the deck; above a tram passing below it starts higher. A railing a tram's
                // swept body itself reaches is not built (the tram would run through it)
                let base = null;
                for (const b of [2.2, 1.1, .3]) if (!tramSweep || !tramSweep.segment(A, B, .05, Math.min(ya, yb) - b - .3, Math.max(ya, yb) + 1.1)) { base = b; break; }
                // (owner, 2026-11-12: "fences are not continuous on the bridge still in many places") where the tram runs right beside
                // the carriageway the railing line lies inside the 0.2 m cover the tram guard keeps free around a tram's body, so
                // no wall can stand there. Clear of the body itself, the railing is still drawn, without a wall: a tram passes
                // 5 cm from it and a car can cross it onto the track slab, which is level with the road there.
                let ghost = false;
                if (base === null) { if (bodyLine(A, B, ya, yb)) { DROP((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, "swept"); guardCompletion.sweptM += len; continue; } ghost = true; base = .3; }
                const low = Math.min(ya, yb) - Y.road <= 2.6 && base === 2.2;
                const w = { wall: true, completed: true, ax: A[0], az: A[1], bx: B[0], bz: B[1], y0a: low ? -1.5 : ya - base, y1a: ya + 1.1, y0b: low ? -1.5 : yb - base, y1b: yb + 1.1, yr: undefined, nx: p.nx ?? c.nx, nz: p.nz ?? c.nz, kind: 'rail', edge: c.e, x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                if (c.node) w.node = c.node;
                w.basarabStyle = true; // (drawn with the whole railing network, further on)
                if (ghost) { w.wall = false; w.ghost = true; ghostRails.push(w); guardCompletion.visualOnlyM = (guardCompletion.visualOnlyM || 0) + len; } else walls.push(w);
                guardCompletion.lengthM += len;
            }
        }
        // the station platforms: where the carriageway beside a platform descends, the platform's edge stands up to 2 m above
        // it with nothing along it. The same railing follows every platform side that has no surface at its level beside it
        // (the track slab, another platform piece) and no carriageway railing at its height within 0.8 m.
        {
            const gg = new BoxGrid(16); for (const w of walls) if (w.completed && w.kind === 'rail') gg.insert(Math.min(w.ax, w.bx) - .8, Math.min(w.az, w.bz) - .8, Math.max(w.ax, w.bx) + .8, Math.max(w.az, w.bz) + .8, w);
            const guardAt = (x, z, y) => { let hit = false; gg.each(x, z, x, z, w => { if (hit) return; const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (Math.hypot(x - w.ax - dx * t, z - w.az - dz * t) < .8 && Math.abs(w.y1a + (w.y1b - w.y1a) * t - (y + 1.1)) < .6) hit = true; }); return hit; };
            let platformM = 0;
            for (const d of basarabStructure.pieces) {
                if (d.kind !== 'basarab-platform') continue;
                const P = d.poly, y = d.top.reduce((m, q) => m + q[1], 0) / d.top.length;
                for (let k = 0; k < P.length; k++) {
                    const a = P[k], b = P[(k + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .3) continue;
                    let ox = (b[1] - a[1]) / L, oz = -(b[0] - a[0]) / L; if (((a[0] + b[0]) / 2 - d.x) * ox + ((a[1] + b[1]) / 2 - d.z) * oz < 0) { ox = -ox; oz = -oz; }
                    const taken = (x, z) => { let level = false; for (const o of [.4, .9]) surfacesAt(x + ox * o, z + oz * o, h => { if (Math.abs(h - y) < .4) level = true; }); return level || guardAt(x, z, y); };
                    for (const [t0, t1] of openRuns(a, b, taken)) {
                        const len = (t1 - t0) * L, k2 = Math.max(1, Math.round(len / 2.4)), at = f => [a[0] + (b[0] - a[0]) * (t0 + (t1 - t0) * f) - ox * .1, a[1] + (b[1] - a[1]) * (t0 + (t1 - t0) * f) - oz * .1];
                        if (len < 1.5) continue;
                        for (let j = 0; j < k2; j++) {
                            const A = at(j / k2), B = at((j + 1) / k2);
                            if (tramSweep && tramSweep.segment(A, B, .05, y - .5, y + 1.1)) continue;
                            const w = { wall: true, estimated: true, completed: true, platformRailing: true, ax: A[0], az: A[1], bx: B[0], bz: B[1], y0a: y - .2, y1a: y + 1.1, y0b: y - .2, y1b: y + 1.1, yr: undefined, nx: -ox, nz: -oz, kind: 'rail', edge: null, tramDeckRailing: true, x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, r: len / k2 / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
                            walls.push(w); platformM += len / k2;
                            
                            w.basarabStyle = true;
                        }
                    }
                }
            }
            guardCompletion.platformM = Math.round(platformM);
        }
        guardCompletion.lengthM = Math.round(guardCompletion.lengthM); guardCompletion.addedM = guardCompletion.lengthM; guardCompletion.sweptM = Math.round(guardCompletion.sweptM * 10) / 10;
    }
    // ---- railings of the tram-only decks. The estimated tram viaduct had none: an open slab edge 6-11 m up. A railing runs
    //      along every slab edge that is high (or over water) and has no surface at its level beside it (the other track's
    //      slab, the slot infill, a platform, a carriageway). On a bend the rigid tram body overhangs its own 1.7 m slab
    //      edge: there the railing stands outboard, up to 0.75 m, on a walkway strip. Same white rails and blue fascia as
    //      the Basarab road decks; ESTIMATE, with a collision wall each.
    const tramRailings = { basis: 'MODEL: estimated railing on open edges of elevated tram slabs', runs: 0, lengthM: 0, outboardM: 0, sweptEdgeM: 0, besideGuardM: 0 };
    {
        // (owner, 2026-11-11: "fences on basarab are placed weirdly, they should be continuous" / "why is the fence not going all
        //  the way?") The outboard distance was chosen piece by piece, so the line stepped in and out every few metres; it
        //  stopped 1.5 m above the ground; and it doubled the road guard where one already stood beside the slab. Now: one
        //  outboard distance for each unbroken stretch of a source way's side (the largest any of its pieces needs), down to
        //  0.45 m above the ground, and none where a guard at least 0.6 m higher than the slab stands within 1.4 m.
        const ways = new Map();
        for (const d of tramDecks) { if (d.kind !== 'source-tram-deck' || !d.supportTop) continue; let l = ways.get(d.sourceId); if (!l) ways.set(d.sourceId, l = []); l.push(d); }
        // (owner, 2026-11-12, Grozavesti (1086, -1266): "should the fence not go all the way?") a street up to 1.2 m below the
        // descending tram slab counted as level with it and the railing stopped while the slab still stood a metre above the
        // street beside it. Only a surface within 0.35 m (the other track's slab, a platform) is level now.
        const level = (x, z, y) => { let found = false; surfacesAt(x, z, h => { if (Math.abs(h - y) < .35) found = true; }); return found; };
        const guardGrid = new BoxGrid(16); for (const w of walls) if (w.wall && (w.kind === 'rail' || w.kind === 'barrier')) guardGrid.insert(Math.min(w.ax, w.bx) - 1.4, Math.min(w.az, w.bz) - 1.4, Math.max(w.ax, w.bx) + 1.4, Math.max(w.az, w.bz) + 1.4, w);
        // (with a direction tx, tz only a guard converging at an angle counts: a parallel one 1 m off is the road's own barrier,
        // Street View on Pasajul Basarab shows both)
        const guardBeside = (x, z, y, reach = 1.4, tx = null, tz = null) => { let hit = false; guardGrid.each(x, z, x, z, w => { if (hit) return; const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (tx !== null && Math.abs(dx * tx + dz * tz) / (Math.hypot(dx, dz) || 1) > .985) return; const top = w.y1a + (w.y1b - w.y1a) * t; if (Math.hypot(x - w.ax - dx * t, z - w.az - dz * t) < reach && top >= y + .6 && top <= y + 2.25 && w.y0a + (w.y0b - w.y0a) * t <= y + .3) hit = true; }); return hit; }; // (owner, 2026-11-12: the guard of a deck more than 1.15 m above the slab stands over its railing, it does not replace it; the tram ramp beside Orhideelor lost 20 m of railing to the collision band of the road deck 2.3 m above)
        // is the railing line of slab side A -> B, k m outboard, on a carriageway beside the slab at about its level
        const onRoadLine = (A, B, ux, uz, k) => [0, .5, 1].some(f => { const x = A[0] + (B[0] - A[0]) * f + ux * k, z = A[2] + (B[2] - A[2]) * f + uz * k, y = A[1] + (B[1] - A[1]) * f - Y.road; let hit = false;
            surfGrid.each(x - .3, z - .3, x + .3, z + .3, o => { if (hit || x < o.x0 - .3 || x > o.x1 + .3 || z < o.z0 - .3 || z > o.z1 + .3) return; const dy = o.h(x, z) - y; if (dy <= -6 || dy >= 1.5) return; const inside = pointInPolygon(x, z, o.poly), d = polyDist(x, z, o.poly); if (inside ? d > .05 && dy > (k <= 0 ? -1.2 : -4.5) : dy > .3 && d < .25) hit = true; }); return hit; }); // (over a lane: on the slab edge only from 1.2 m above it, outboard only with 4.5 m of headroom, or it stands among the cars; and never right at the edge of a carriageway higher than the slab, where it would sink into it)
        const emit = (a, b, ux, uz, out, split = true, ghost = false) => {
            const o = out - .1, A = [a[0] + ux * o, a[1], a[2] + uz * o], B = [b[0] + ux * o, b[1], b[2] + uz * o], len = Math.hypot(B[0] - A[0], B[2] - A[2]); if (len < .6) return;
            // (owner, 2026-11-12, Grozavesti (826, -1050) "what's going on here") the railing as finally placed (outboard) is checked
            // against the road guards: where one stands within 0.7 m, or converges at an angle within 1.6 m, that part is left
            // out (the two crossed); the rest is emitted in pieces
            if (split) {
                const tx = (B[0] - A[0]) / len, tz = (B[2] - A[2]) / len, n = Math.max(1, Math.ceil(len / .5)), runs = []; let run = null;
                for (let i = 0; i < n; i++) {
                    const f = (i + .5) / n, x = A[0] + (B[0] - A[0]) * f, z = A[2] + (B[2] - A[2]) * f, y = A[1] + (B[1] - A[1]) * f;
                    const blocked = guardBeside(x, z, y, .7) || guardBeside(x, z, y, 1.6, tx, tz);
                    if (blocked) { if (run) { runs.push(run); run = null; } } else if (run) run[1] = (i + 1) / n; else run = [i / n, (i + 1) / n];
                }
                if (run) runs.push(run);
                if (!(runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1)) {
                    const at = f => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
                    tramRailings.besideGuardM += len * (1 - runs.reduce((m, r) => m + r[1] - r[0], 0));
                    for (const [f0, f1] of runs) emit(at(f0), at(f1), ux, uz, out, false, ghost);
                    return;
                }
            }
            const w = { wall: true, estimated: true, tramDeckRailing: true, ax: A[0], az: A[2], bx: B[0], bz: B[2], y0a: A[1] - .2, y1a: A[1] + 1.1, y0b: B[1] - .2, y1b: B[1] + 1.1, nx: -ux, nz: -uz, kind: 'rail', edge: null,
                x: (A[0] + B[0]) / 2, z: (A[2] + B[2]) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
            w.basarabStyle = true; if (ghost) { w.wall = false; w.ghost = true; ghostRails.push(w); tramRailings.visualOnlyM = (tramRailings.visualOnlyM || 0) + len; } else walls.push(w); tramRailings.runs++; tramRailings.lengthM += len; if (out > 0) tramRailings.outboardM += len;
        };
        for (const pieces of ways.values()) for (const side of [0, 1]) {
            // what each piece of this side needs: null (no railing), or the smallest outboard distance clear of the tram sweep
            const need = pieces.map(d => {
                const T = d.supportTop, A = side ? T[3] : T[0], B = side ? T[2] : T[1]; // both sides run a -> b
                const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2, my = (A[1] + B[1]) / 2, ox = mx - d.x, oz = mz - d.z, ol = Math.hypot(ox, oz) || 1, ux = ox / ol, uz = oz / ol, len = Math.hypot(B[0] - A[0], B[2] - A[2]);
                // (owner, 2026-11-12, Grozavesti (107, -234): "still random fence here") a slab at street level over the river is
                // inner where another slab or carriageway of the bridge lies beyond it (the river plate closes that slot): no railing
                const high = my > .45 || (isWater(mx + ux * 1.5, mz + uz * 1.5) && ![2, 4, 6, 8, 10].some(k => coveredByOther(mx + ux * k, mz + uz * k, null, my - Y.road, 0, false, .6)));
                if (!high || level(mx + ux * .5, mz + uz * .5, my) || level(mx + ux * 1.1, mz + uz * 1.1, my)) return null;
                // (owner, 2026-11-12, Grozavesti (135, -325), (159, -426): "missing fence chunks ... is the tram supposed to have
                // fence? check streetview"; Street View on Pasajul Basarab at 44.44503, 26.06120: the carriageway has a low concrete
                // barrier and the tram slab its own blue steel railing, both unbroken) a road guard beside the slab no longer
                // replaces the tram railing: where the road guard was cut, the slab was left open in chunks.
                if (guardBeside(mx + ux * .3, mz + uz * .3, my, .7) || [[mx, mz], [A[0], A[2]], [B[0], B[2]]].some(([px, pz]) => guardBeside(px + ux * .3, pz + uz * .3, my, 1.6, (B[0] - A[0]) / (len || 1), (B[2] - A[2]) / (len || 1)))) { tramRailings.besideGuardM += len; return null; } // (owner, 2026-11-12, (826, -1050): where they converge the two crossed; the road guard alone stands there) // (owner, 2026-11-12, (826, -1050) "what's going on here": only a guard within 0.7 m duplicates it; they crossed where they converged)
                // (owner, 2026-11-12, Grozavesti (983, -1179) "cars go in fence", (981, -1186) "goes underground": the outboard railing
                // stood in the lane of the street beside the descending slab, and sank into a carriageway higher than the slab)
                // the railing never stands on a carriageway; where no outboard place is free, a place just inside the slab edge is tried
                for (const out of [0, .25, .5, .75, 1, 1.25, 1.5, -.1, -.25]) { const k = out - .1; if (!onRoadLine(A, B, ux, uz, k) && !tramSweep?.segment([A[0] + ux * k, A[2] + uz * k], [B[0] + ux * k, B[2] + uz * k], .1, Math.min(A[1], B[1]) - .5, Math.max(A[1], B[1]) + 1.1)) return { A, B, ux, uz, out, len, mx, mz }; } // (up to 1.5 m outboard on a curve where a tram's body overhangs the slab)
                // (inside the cover the tram guard keeps free but clear of the tram body: drawn without a wall, like the road guard there)
                for (const out of [0, -.1, -.25, .25, .5]) { const k = out - .1; if (!onRoadLine(A, B, ux, uz, k) && !tramSweep?.segment([A[0] + ux * k, A[2] + uz * k], [B[0] + ux * k, B[2] + uz * k], -.15, Math.min(A[1], B[1]) - .5, Math.max(A[1], B[1]) + 1.1)) return { A, B, ux, uz, out, len, mx, mz, ghost: true }; }
                DROP(mx, mz, "t-swept"); tramRailings.sweptEdgeM += len; return null;
            });
            for (let i = 0; i < need.length;) {
                if (!need[i]) { i++; continue; }
                let j = i; while (j + 1 < need.length && need[j + 1] && (need[j + 1].out < 0) === (need[i].out < 0) && !!need[j + 1].ghost === !!need[i].ghost && Math.hypot(need[j + 1].A[0] - need[j].B[0], need[j + 1].A[2] - need[j].B[2]) < .3) j++;
                let out = need[i].out; for (let k = i; k <= j; k++) out = need[i].out < 0 ? Math.min(out, need[k].out) : Math.max(out, need[k].out);
                let start = need[i];
                const ghost = !!need[i].ghost, sweptAt = q => { const k = out - .1; return onRoadLine(q.A, q.B, q.ux, q.uz, k) || !!tramSweep?.segment([q.A[0] + q.ux * k, q.A[2] + q.uz * k], [q.B[0] + q.ux * k, q.B[2] + q.uz * k], ghost ? -.15 : .1, Math.min(q.A[1], q.B[1]) - .5, Math.max(q.A[1], q.B[1]) + 1.1); };
                for (let k = i; k <= j; k++) {
                    const q = need[k];
                    // the stretch's outboard distance can put this piece in the sweep of a neighbouring track: no railing here
                    if (sweptAt(q)) {
                        if (start !== q && k > i) emit(start.A, need[k - 1].B, q.ux, q.uz, out, true, ghost);
                        // (a piece the stretch's distance does not suit keeps its own place on the slab edge, when it has one)
                        if (q.out <= 0 && q.out !== out) emit(q.A, q.B, q.ux, q.uz, q.out, true, ghost); else { DROP(q.mx, q.mz, "t-swept2"); tramRailings.sweptEdgeM += q.len; }
                        start = need[k + 1]; continue;
                    }
                    if (!start) start = q;
                    if (out > 0) { // the walkway strip under an outboard railing
                        const mb = cellOf(q.mx, q.mz).solid, A1 = [q.A[0] + q.ux * out, q.A[1], q.A[2] + q.uz * out], B1 = [q.B[0] + q.ux * out, q.B[1], q.B[2] + q.uz * out], dn = v => [v[0], v[1] - .14, v[2]], grate = rgb('#8b8f8e');
                        mb.face4(q.A, q.B, B1, A1, grate, [0, 1, 0]); mb.face4(dn(A1), dn(B1), dn(q.B), dn(q.A), rgb('#5b5e5d'), [0, -1, 0]); mb.face4(dn(A1), A1, B1, dn(B1), grate, [q.ux, 0, q.uz]);
                    }
                    if (k === j || Math.hypot(need[k + 1].B[0] - start.A[0], need[k + 1].B[2] - start.A[2]) > 9.6) { emit(start.A, q.B, q.ux, q.uz, out, true, ghost); start = k < j ? need[k + 1] : null; }
                }
                i = j + 1;
            }
        }
        // (owner, 2026-11-12, Grozavesti (982, -1190): "not connected") stretches with different outboard distances, and the
        // pieces of two source ways meeting, ended side by side up to 1.5 m apart: two railings with an open step between them.
        // Two railing ends that close, at one height and facing each other, get a connecting piece clear of the tram sweep.
        {
            const rails = walls.filter(w => w.tramDeckRailing), ends = [];
            for (const w of rails) { const L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1; for (const end of [0, 1]) ends.push({ w, x: end ? w.bx : w.ax, z: end ? w.bz : w.az, y: end ? w.y1b : w.y1a, ux: (w.bx - w.ax) / L * (end ? 1 : -1), uz: (w.bz - w.az) / L * (end ? 1 : -1), used: false }); }
            for (const a of ends) {
                if (a.used) continue; let best = null;
                for (const b of ends) {
                    if (b === a || b.w === a.w || b.used || Math.abs(a.y - b.y) > .3) continue;
                    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < .05 || d > 1.5 || (best && d >= best.d)) continue;
                    if (a.ux * -b.ux + a.uz * -b.uz < .5 || dx * a.ux + dz * a.uz < -.6 || -dx * b.ux - dz * b.uz < -.6) continue; // (the two run on from each other)
                    best = { b, d };
                }
                if (!best) continue; const b = best.b;
                if (tramSweep?.segment([a.x, a.z], [b.x, b.z], .05, Math.min(a.y, b.y) - 1.3, Math.max(a.y, b.y))) continue;
                const len = best.d, w = { wall: true, estimated: true, tramDeckRailing: true, ax: a.x, az: a.z, bx: b.x, bz: b.z, y0a: a.y - 1.3, y1a: a.y, y0b: b.y - 1.3, y1b: b.y, nx: a.w.nx, nz: a.w.nz, kind: 'rail', edge: null,
                    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, r: len / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1, joinPiece: true };
                w.basarabStyle = true; walls.push(w); a.used = b.used = true; tramRailings.joins = (tramRailings.joins || 0) + 1;
            }
        }
        for (const k of ['lengthM', 'outboardM', 'sweptEdgeM', 'besideGuardM']) tramRailings[k] = Math.round(tramRailings[k]);
    }
    // ---- one railing network (owner, 2026-11-12: "fences are not continuous on the bridge still in many places", "random 1 off
    //      fences that are alone and randomly placed"). The road-deck guard, the tram-slab railings and the platform railings
    //      were each built and drawn by their own rule, so where one stopped and the next began there was an open end: a tram
    //      railing ending 1 m beside the road guard, two guards ending 2 m apart at a gore nose, the two inner railings of a
    //      slot ending without closing its end; and pieces that met nothing stood alone. All of them are one network now:
    //      (1) an open end in the air is joined to the nearest other open end (up to 12 m) or railing (up to 3 m) that it can
    //          reach without crossing a carriageway at its level, another railing or a tram's swept body;
    //      (2) a dead-end spur under 6 m and an isolated group under 16 m are removed;
    //      (3) only then is the railing drawn. What still ends in the air is listed in stats.railingNetwork.openEnds.
    const railingNetwork = { basis: 'MODEL: Basarab railings joined into one network before they are drawn', joins: 0, joinM: 0, endToRailing: 0, prunedSpurs: 0, prunedIsolated: 0, prunedM: 0, openEnds: [] };
    {
        const mine = w => w.kind === 'rail' && w.basarabStyle === true;
        if (basarabStructure.report.active) {
            const TOUCH = .3, len = w => Math.hypot(w.bx - w.ax, w.bz - w.az);
            const analyse = () => {
                const rails = walls.filter(mine).concat(ghostRails), ends = [], grid = new BoxGrid(8), bodies = new BoxGrid(8);
                for (const w of rails) {
                    const L = len(w) || 1, pair = [];
                    for (const e of [0, 1]) { const q = { w, e, x: e ? w.bx : w.ax, z: e ? w.bz : w.az, top: e ? w.y1b : w.y1a, ux: (w.bx - w.ax) / L * (e ? 1 : -1), uz: (w.bz - w.az) / L * (e ? 1 : -1) }; pair.push(q); ends.push(q); grid.insert(q.x, q.z, q.x, q.z, q); }
                    pair[0].other = pair[1]; pair[1].other = pair[0];
                    bodies.insert(Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz), w);
                }
                const nearestOn = (w, x, z) => { const dx = w.bx - w.ax, dz = w.bz - w.az, t = clamp(((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1), 0, 1), px = w.ax + dx * t, pz = w.az + dz * t; return { t, x: px, z: pz, d: Math.hypot(x - px, z - pz), top: w.y1a + (w.y1b - w.y1a) * t }; };
                for (const q of ends) {
                    const mates = new Set(); grid.each(q.x - TOUCH, q.z - TOUCH, q.x + TOUCH, q.z + TOUCH, f => { if (f !== q && f.w !== q.w && Math.hypot(f.x - q.x, f.z - q.z) <= TOUCH && Math.abs(f.top - q.top) < .5) mates.add(f); });
                    q.mates = [...mates]; q.onBody = false;
                    if (!q.mates.length) bodies.each(q.x - TOUCH, q.z - TOUCH, q.x + TOUCH, q.z + TOUCH, w => { if (q.onBody || w === q.w) return; const p = nearestOn(w, q.x, q.z); if (p.d < TOUCH && Math.abs(p.top - q.top) < .5) { q.onBody = true; q.bodyW = w; } });
                    q.open = !q.mates.length && !q.onBody && q.top - 1.1 > .8; // (an end at street level is where the deck meets the ground)
                    q.ground = !q.mates.length && !q.onBody && !q.open;
                }
                return { rails, ends, grid, bodies, nearestOn };
            };
            // (1) joins
            {
                const N = analyse(), cands = [];
                N.ends.forEach((q, i) => { q.i = i; });
                for (const q of N.ends) {
                    if (!q.open) continue;
                    const seenE = new Set(), seenW = new Set();
                    N.grid.each(q.x - 12, q.z - 12, q.x + 12, q.z + 12, f => {
                        if (!f.open || f.w === q.w || f.i <= q.i || seenE.has(f)) return; seenE.add(f);
                        const dx = f.x - q.x, dz = f.z - q.z, d = Math.hypot(dx, dz); if (d > 12 || d < .05 || Math.abs(f.top - q.top) > Math.max(.5, d * .09)) return;
                        if (dx * q.ux + dz * q.uz < -.3 * d || -dx * f.ux - dz * f.uz < -.3 * d) return; // (the other end lies back along the railing)
                        cands.push({ d, q, f });
                    });
                    N.bodies.each(q.x - 4, q.z - 4, q.x + 4, q.z + 4, w => {
                        if (w === q.w || seenW.has(w)) return; seenW.add(w);
                        const p = N.nearestOn(w, q.x, q.z), dy = Math.abs(p.top - q.top); if (p.d > 4 || p.d < .05 || dy > Math.max(.5, p.d * .4) || (p.d > 3 && dy <= .5) || (p.x - q.x) * q.ux + (p.z - q.z) * q.uz < -.3 * p.d) return;
                        // (onto a railing at another level only along a surface that carries the piece: a sloped infill)
                        if (dy > .5 && ![.25, .5, .75].every(f => { let on = false; const y = q.top + (p.top - q.top) * f - 1.1; surfacesAt(q.x + (p.x - q.x) * f, q.z + (p.z - q.z) * f, h => { if (Math.abs(h - y) < .5) on = true; }); return on; })) return;
                        cands.push({ d: p.d, q, p });
                    });
                }
                cands.sort((a, b) => a.d - b.d || a.q.i - b.q.i);
                const used = new Set(), added = [];
                const free = (a, b, ya, yb, skip) => {
                    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / .5));
                    for (let i = 1; i < n; i++) { const f = i / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; if (coveredByOther(x, z, null, ya + (yb - ya) * f - Y.road, .35, false, .8)) return false; } // (through a carriageway: a mouth stays open)
                    if (tramSweep && tramSweep.segment(a, b, .05, Math.min(ya, yb) - .5, Math.max(ya, yb) + 1.1)) return false;
                    let cross = false; const test = w => { if (cross || skip.includes(w)) return; if (Math.abs((w.y1a + w.y1b) / 2 - 1.1 - (ya + yb) / 2) < 1.5 && segsCross(a, b, [w.ax, w.az], [w.bx, w.bz])) cross = true; };
                    N.bodies.each(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), test); for (const w of added) test(w);
                    return !cross;
                };
                for (const c of cands) {
                    if (used.has(c.q) || (c.f && used.has(c.f))) continue;
                    const a = [c.q.x, c.q.z], b = c.f ? [c.f.x, c.f.z] : [c.p.x, c.p.z], ta = c.q.top, tb = c.f ? c.f.top : c.p.top;
                    if (!free(a, b, ta - 1.1, tb - 1.1, [c.q.w, c.f ? c.f.w : null])) continue;
                    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = -(b[1] - a[1]) / L, mz = (b[0] - a[0]) / L, sgn = Math.sign(mx * c.q.w.nx + mz * c.q.w.nz) || 1;
                    const w = { wall: true, estimated: true, completed: true, basarabStyle: true, networkJoin: true, tramDeckRailing: c.q.w.edge ? undefined : true, ax: a[0], az: a[1], bx: b[0], bz: b[1], y0a: ta - 1.3, y1a: ta, y0b: tb - 1.3, y1b: tb, yr: undefined, nx: mx * sgn, nz: mz * sgn, kind: 'rail', edge: c.q.w.edge || null,
                        x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, r: L / 2 + .3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.1 };
                    walls.push(w); added.push(w); used.add(c.q); if (c.f) used.add(c.f); else railingNetwork.endToRailing++;
                    railingNetwork.joins++; railingNetwork.joinM += L;
                }
                railingNetwork.joinM = Math.round(railingNetwork.joinM);
            }
            // (2) dead-end spurs and isolated groups
            for (let round = 0; round < 6; round++) {
                const N = analyse(), kill = new Set();
                for (const q of N.ends) {
                    if (!q.open || kill.has(q.w)) continue;
                    const chain = new Set(); let cur = q, total = 0, term = null;
                    for (;;) {
                        chain.add(cur.w); total += len(cur.w); const o = cur.other;
                        if (o.open) { term = 'open'; break; } if (o.ground) { term = 'ground'; break; }
                        if (o.onBody || o.mates.length !== 1 || o.mates[0].mates.length !== 1) { term = 'junction'; break; }
                        cur = o.mates[0]; if (chain.has(cur.w)) { term = 'loop'; break; }
                    }
                    if ((term === 'open' && total < 16) || (term === 'junction' && total < 6)) { for (const w of chain) kill.add(w); railingNetwork.prunedM += total; if (term === 'open') railingNetwork.prunedIsolated++; else railingNetwork.prunedSpurs++; DROP(q.x, q.z, 'pruned-' + term); }
                }
                if (!kill.size) break;
                for (let i = walls.length - 1; i >= 0; i--) if (kill.has(walls[i])) walls.splice(i, 1);
                for (let i = ghostRails.length - 1; i >= 0; i--) if (kill.has(ghostRails[i])) ghostRails.splice(i, 1);
            }
            // a small group that is closed on itself has no open end to start from (a 6 m ring on a gore nose, owner's pose
            // (426, -750)): every connected group under 16 m that does not reach the ground goes too
            {
                const N = analyse(), parent = new Map(N.rails.map(w => [w, w])), find = w => { let r = w; while (parent.get(r) !== r) r = parent.get(r); parent.set(w, r); return r; };
                for (const q of N.ends) { for (const f of q.mates) parent.set(find(q.w), find(f.w)); if (q.bodyW) parent.set(find(q.w), find(q.bodyW)); }
                const total = new Map(), grounded = new Set();
                for (const w of N.rails) total.set(find(w), (total.get(find(w)) || 0) + len(w));
                for (const q of N.ends) if (q.ground) grounded.add(find(q.w));
                const kill = new Set(N.rails.filter(w => total.get(find(w)) < 16 && !grounded.has(find(w))));
                if (kill.size) {
                    const groups = new Set([...kill].map(find)); railingNetwork.prunedGroups = groups.size; for (const g of groups) { railingNetwork.prunedM += total.get(g); DROP((g.ax + g.bx) / 2, (g.az + g.bz) / 2, 'pruned-group'); }
                    for (let i = walls.length - 1; i >= 0; i--) if (kill.has(walls[i])) walls.splice(i, 1);
                    for (let i = ghostRails.length - 1; i >= 0; i--) if (kill.has(ghostRails[i])) ghostRails.splice(i, 1);
                }
            }
            railingNetwork.prunedM = Math.round(railingNetwork.prunedM);
            { const N = analyse(); railingNetwork.rails = N.rails.length; railingNetwork.lengthM = Math.round(N.rails.reduce((n, w) => n + len(w), 0)); for (const q of N.ends) if (q.open) railingNetwork.openEnds.push([Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10, Math.round((q.top - 1.1) * 10) / 10]); }
        }
        // (3) draw (one post where two pieces meet)
        const posts = new Set(), postKey = (x, z) => Math.round(x * 20) + ',' + Math.round(z * 20), shared = basarabStructure.report.active;
        for (const w of walls.concat(ghostRails)) {
            if (!mine(w)) continue;
            if (!shared) { drawBasarabGuard(w, cellOf, basarabBlue); continue; } // (other districts: as they were reviewed)
            const L = Math.hypot(w.bx - w.ax, w.bz - w.az), n = Math.max(1, Math.round(L / 2.4)), at = [];
            for (let i = 0; i <= n; i++) { const f = i / n, key = postKey(w.ax + (w.bx - w.ax) * f, w.az + (w.bz - w.az) * f); if (i > 0 && i < n) at.push(f); else if (!posts.has(key)) { posts.add(key); at.push(f); } }
            drawBasarabGuard(w, cellOf, basarabBlue, at);
        }
    }
    // ---- Pasajul Basarab by night: the blue light band along the deck edges (owner's reference photograph, 2026-11-11).
    //      The band is the guards' own blue fascia, repeated a few centimetres proud in one mesh whose material glows at
    //      night (userData.nightEmissive). By day it is the same blue. ESTIMATE of colour and strength.
    if (basarabBlue.ic > 0) {
        const mesh = new THREE.Mesh(basarabBlue.build(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#2444ff', emissiveIntensity: 0, roughness: 0.6 }));
        mesh.material.userData.nightEmissive = 2.2; mesh.name = 'Basarab night light band (estimate)'; mesh.castShadow = false; group.add(splitMeshByTiles(mesh, 125)); // (tiles: culled out of view, same geometry)
    }
    const treeClear = []; // (after round 6) {x, z, r}: no trees here (fuel forecourts)
    const addPropColl = (x, z, r, kind = 'prop') => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind });
    propColl.push(...sportsColl); // (pitch / court fences, dugouts, goal and hoop posts)
    // (fidelity pass 2026-11-12, Pipera: Strada Petricani over the Colentina) railings on street-level bridges with water on both sides
    //   (district worlds only: on the legacy corridor map it put railings under the Pasajul Basarab deck — harness finding)
    const waterBridgeRailings = !distId ? { runs: [], pieces: 0, lengthM: 0 } : emitStreetLevelWaterBridgeRailings({ edges, isWater, widthSide, cellOf, addCollider: (x, z, r) => addPropColl(x, z, r, 'bridge-railing'),
        topAt: (x, z, e) => raisedTop(x, z, 0.3) ?? (Y.road + yAlong(e, x, z)), colour: rgb('#8d949b'), postColour: rgb('#7b838b') });
    // ---- landmark ground fences (2026-11-08, owner: "the Rosetti fence is on the street"): the model's fence line follows the
    //      OSM grounds, which the game's wider road + sidewalk ribbons overlap (Rosetti: OSM draws the grounds' east edge on
    //      the Garibaldi centre line). Every point that falls on a carriageway or sidewalk is moved out to the property line
    //      (sidewalk's back edge + 0.15 m) on the side of the grounds (`inside`), gates included; styles: 'bars' (iron bars
    //      on a concrete plinth, `plinth: 'arches'` = painted arches) and 'mesh' (welded-mesh panels on posts); collision.
    const fenceSegs = []; // for the property-line fences: no second fence along a landmark's
    {
        const plinth = rgb('#a9a59c'), bars = rgb('#2e3438'), pill = rgb('#cfc8b8'), meshC = rgb('#87928a'), plWhite = rgb('#e3dfd5');
        const ARCH = ['#d8473f', '#f0b62e', '#3f7fc4', '#5aa35a', '#e07a2e'].map(rgb);
        const offStreet = (x, z, inside) => { // → [x, z] on the property line when (x, z) is on a street's carriageway / sidewalk
            for (let it = 0; it < 3; it++) {
                const ne = nearestEdge(x, z, (e) => !e.virtual && !e.tunnel, 25); if (!ne) break;
                const e = ne.edge; let sd = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
                const need = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                if (ne.d >= need - 0.01 && !onRibbon(x, z, 0.2)) break;
                if (inside) { // the grounds' side of the street, whichever side of the centre line OSM put the point on
                    const inP = pointInPolygon(ne.cx + e.nx * need, ne.cz + e.nz * need, inside), inM = pointInPolygon(ne.cx - e.nx * need, ne.cz - e.nz * need, inside);
                    if (inP !== inM) sd = inP ? 1 : -1;
                }
                const nd = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                x = ne.cx + e.nx * sd * nd; z = ne.cz + e.nz * sd * nd;
            }
            return [x, z];
        };
        for (const f of landmarkFences) {
            const R0 = f.ring, n = R0.length, segs = f.closed ? n : n - 1, mesh = f.style === 'mesh';
            const pts = [];
            for (let i = 0; i < segs; i++) { const [ax, az] = R0[i], [bx, bz] = R0[(i + 1) % n], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / 1.0)); for (let j = 0; j < k; j++) pts.push(offStreet(ax + (bx - ax) * j / k, az + (bz - az) * j / k, f.inside)); }
            if (!f.closed) pts.push(offStreet(...R0[n - 1], f.inside)); else pts.push(pts[0]);
            const gates = (f.gates || []).map(g => { const [x, z] = offStreet(g.x, g.z, f.inside); return { ...g, x, z }; });
            const inGate = (x, z) => gates.some(g => Math.hypot(x - g.x, z - g.z) < g.w / 2);
            let run = 0; // metres along the fence (posts / arches at a steady pitch)
            for (let i = 0; i < pts.length - 1; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05 || L > 6) continue;
                const mx = (ax + bx) / 2, mz = (az + bz) / 2, r0 = run; run += L;
                if (inGate(mx, mz) || buildingAt(mx, mz) || onRibbon(mx, mz, 0.1)) continue;
                const ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), ux = (bx - ax) / L, uz = (bz - az) / L, v0s = c.solid.vc, v0d = c.detail.vc;
                const wire = (px, pz, y0, y1, w, col) => { c.detail.wall(px - ux * w, pz - uz * w, px + ux * w, pz + uz * w, y0, y1, -uz, ux, col); c.detail.wall(px + ux * w, pz + uz * w, px - ux * w, pz - uz * w, y0, y1, uz, -ux, col); };
                if (mesh) { // welded-mesh panels (f.h tall, 2 m default): vertical wires every 0.33 m, flat horizontal wires every ≈ 0.45 m + a
                    //         V-bend, posts every 2.5 m (thin two-sided strips, not boxes: ≈ 30 triangles a metre — the frame budget)
                    const fh = f.h || 2.0, hz = (y, t) => { c.detail.wall(ax, az, bx, bz, Y.side + y, Y.side + y + t, -uz, ux, meshC); c.detail.wall(bx, bz, ax, az, Y.side + y, Y.side + y + t, uz, -ux, meshC); };
                    c.solid.box(mx, Y.side, mz, 0.12, 0.12, L + 0.02, ang, plinth);
                    const nV = Math.max(1, Math.round(L / 0.33));
                    for (let j = 0; j < nV; j++) { const t = (j + 0.5) / nV; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.12, Y.side + fh, 0.011, meshC); }
                    const nH = Math.max(3, Math.round((fh - 0.3) / 0.45)); for (let k = 0; k <= nH; k++) hz(0.3 + (fh - 0.33) * k / nH, 0.025);
                    hz(fh * 0.66, 0.06);
                    if (Math.floor(r0 / 2.5) !== Math.floor(run / 2.5)) c.solid.box(ax, Y.side, az, 0.07, fh + 0.08, 0.07, ang, meshC);
                } else {
                    c.solid.box(mx, Y.side, mz, 0.28, 0.45, L + 0.02, ang, f.plinth === 'arches' ? plWhite : plinth);
                    c.solid.box(mx, Y.side + 1.95, mz, 0.06, 0.06, L, ang, bars); c.detail.box(mx, Y.side + 0.75, mz, 0.05, 0.05, L, ang, bars);
                    const nP = Math.max(1, Math.round(L / 0.14));
                    for (let j = 0; j < nP; j++) { const t = (j + 0.5) / nP; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.45, Y.side + 2.0, 0.017, bars); }
                    if (i % 3 === 0) c.solid.box(ax, Y.side, az, 0.12, 2.1, 0.12, ang, bars);
                    if (f.plinth === 'arches') { // painted rainbow arches on both faces of the plinth, one per metre
                        const col = ARCH[Math.floor(r0) % ARCH.length];
                        for (const sg of [1, -1]) { const ox = -uz * sg * 0.145, oz = ux * sg * 0.145, nx = -uz * sg, nz = ux * sg;
                            const seg = (t0, t1, y0, y1) => { const x0 = mx + ux * t0 + ox, z0 = mz + uz * t0 + oz, x1 = mx + ux * t1 + ox, z1 = mz + uz * t1 + oz; if (sg > 0) c.detail.wall(x0, z0, x1, z1, Y.side + y0, Y.side + y1, nx, nz, col); else c.detail.wall(x1, z1, x0, z0, Y.side + y0, Y.side + y1, nx, nz, col); };
                            const h = Math.min(0.42, L / 2 - 0.02); seg(-h, -h + 0.09, 0.06, 0.3); seg(h - 0.09, h, 0.06, 0.3); seg(-h + 0.05, h - 0.05, 0.3, 0.4); }
                    }
                }
                liftOnSide(c, v0s, v0d, mx, mz, 0.6);
                propColl.push({ x: mx, z: mz, hw: 0.15, hd: L / 2, angle: ang, r: Math.hypot(0.15, L / 2), poly: null, h: 2, prop: true, kind: 'fence' });
                fenceSegs.push([ax, az, bx, bz]);
            }
            for (const g of gates) { // gate pillars on the fence line either side of the opening
                let best = null, bd = 6; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - g.x, pts[i][1] - g.z); if (d < bd) { bd = d; best = i; } }
                if (best == null) continue;
                const a = pts[Math.max(0, best - 3)], b2 = pts[Math.min(pts.length - 1, best + 3)], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1, ux = (b2[0] - a[0]) / L, uz = (b2[1] - a[1]) / L, [gx, gz] = pts[best];
                for (const sg of [-1, 1]) { const px = gx + ux * sg * (g.w / 2 + 0.2), pz = gz + uz * sg * (g.w / 2 + 0.2); if (!onRibbon(px, pz, 0.25)) { cellOf(px, pz).solid.box(px, Y.side + (raisedTop(px, pz, 0.6) !== null ? DY_SIDE : 0), pz, 0.45, 2.4, 0.45, Math.atan2(ux, uz), pill); addPropColl(px, pz, 0.3, 'fence'); } }
            }
        }
    }
    for (const [x, z] of lmSignColl) addPropColl(x, z, 1.4, 'sign');
    // (fidelity pass 2026-11-12, Floreasca) a building whose sign text is the name of a business mapped inside it: the sign
    // belongs over that unit's street front (the OSM point), not on the wall nearest to the footprint centre, which was
    // often a rear service lane (Il Calcio, Komodo, Chez Toni, Roll Master had no sign on their street). The first such
    // POI owns the sign: addFacadeSign is skipped and addUnitSign places it in the POI pass.
    if (realPass) for (const [poiIndex, r] of data.pois.entries()) {
        if (!['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(data.poiKinds[r[0]]) || str(r[5]) === 'atm') continue;
        const pb = bRecs[buildingIndex(r[6], r[1] / 10, r[2] / 10)], text = str(r[4]) || str(r[3]);
        if (!pb || pb.poiSign != null || !(pb.flags & 2) || !pb.name || !text || pb.cv) continue;
        const nrm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const a = nrm(pb.name), c2 = nrm(text);
        if (a && c2 && (a.includes(c2) || c2.includes(a) || a.split(' ')[0] === c2.split(' ')[0])) pb.poiSign = poiIndex;
    }
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
            const ring = b.ring, roofCol = rgb(b.roofColour || '#a7a8a2'), sideCol = rgb('#d6d5ce');
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
            const fuelPoi = data.pois.find(r => r[6] === b.i && data.poiKinds[r[0]] === 'fuel' && (str(r[4]) || str(r[3]))), fuelBrand = fuelPoi ? brandStyle(str(fuelPoi[4]) || str(fuelPoi[3])) : null;
            // (canopy fascia colours as seen at the stations, reference checked 2026-11-12: Petrom yellow, Lukoil red; the sign palettes in data.brands are white-backed)
            const fuelFascia = fuelPoi && { petrom: '#ffd200', lukoil: '#e30613', omv: '#00539f', mol: '#e2001a', rompetrol: '#f39200', socar: '#0057a8' }[(str(fuelPoi[4]) || str(fuelPoi[3])).toLowerCase()];
            const fasciaCol = fuelFascia ? rgb(fuelFascia) : fuelBrand ? rgb(fuelBrand[0]) : sideCol;
            for (const wall of canopy.walls) mb.face4(...wall.vertices, fasciaCol, wall.normal);
            if (fuelBrand && canopy.eavesM - b.minH >= 0.3) {
                const fs = signs.get((str(fuelPoi[4]) || str(fuelPoi[3])).slice(0, 18), fuelBrand[0], fuelBrand[1], fuelBrand[2]), sh = Math.min(0.75, (canopy.eavesM - b.minH) * 0.84);
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
                mb.box(x, Y.side, z, width, Math.max(0.01, b.minH - Y.side), width, 0, rgb('#b8b9b4'));
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
        if (b.colour && b.style !== 'glass') {
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
        const shop = (b.flags & 1) && b.minH <= 0 && h > 6 && !carPark && b.style !== 'church';
        if (shop && !b.shopFaces && distId) b.shopFaces = streetFacing(b, signedArea(b.ring) > 0); // (district worlds: shopfronts on the street faces only)
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
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, distId ? mixRgb(wallCol, [255, 255, 255], 0.45) : rgb('#ffffff'), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (seedI % 2) * 8);
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
                const colAcc = cols.map(() => brng() < (distId && floors <= 5 ? 0 : 0.35));
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
            if (distId && ((b.i * 2654435761) >>> 0) % 3 !== 0) return;
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
    function addUnitSign(b, x, z, text, kind, poiIndex = -1) {
        if ((b.skip && !b.landmarkUnitSigns) || b.cv || (b.minH || 0) > 0.5 || b.h < 3) return;
        // (2026-11-08, owner: "Poke House duplicated") the building's own name sign already names this business
        // (2026-11-12: unless this POI owns that sign — b.poiSign — and places it here, over its own street front)
        if ((b.flags & 2) && b.name && !(poiIndex >= 0 && b.poiSign === poiIndex)) { const a = normName(b.name), c2 = normName(text); if (a && c2 && (a.includes(c2) || c2.includes(a) || a.split(' ')[0] === c2.split(' ')[0])) return; }
        const ring = b.ring, ccw = signedArea(ring) > 0;
        const central = kind === 'shop' && Math.abs(signedArea(ring)) >= 1500 && ring.every((p, k) => { const q = ring[(k + 1) % ring.length]; return distPointSeg(x, z, p[0], p[1], q[0], q[1]).d >= 10; });
        // (2026-11-12 render review, Romstal Otopeni w219767593) a store that IS the whole mapped building (its name is the
        // building's) is mapped at the centroid, which says nothing about its front: the board went on the blank wall facing
        // a lawn. Such a store signs the face toward the most important street (and its own car park), not the nearest wall.
        const wholeStore = kind === 'shop' && !!b.name && normName(b.name) === normName(text) && Math.abs(signedArea(ring)) >= 400;
        const streetRank = (e) => !e ? 0 : /^(trunk|primary)/.test(e.type) ? 30 : /^secondary/.test(e.type) ? 20 : /^tertiary/.test(e.type) ? 10 : e.type === 'service' ? -8 : 0;
        let best = null, bd = Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1), px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
            const ne = nearestEdge(px + nx * 4, pz + nz * 4, (e) => !e.virtual && e.drivable, 30) || ((b.flags & 32) ? sceneryStreetNear(px + nx * 4, pz + nz * 4, 30) : null) || (distId ? pedStreetNear(px + nx * 3, pz + nz * 3, 9) : null); if (!ne || buildingAt(px + nx * 1.5, pz + nz * 1.5)) continue; // (a street front; scenery-ring buildings: a scenery street; r2: a mapped pedestrian street)
            const pf = (central || wholeStore) && L >= 12 ? parkFront(ax + (bx - ax) * .5, az + (bz - az) * .5, nx, nz) : 0;
            const d = wholeStore ? Math.hypot(px - x, pz - z) * 0.2 + ne.d * 0.5 - streetRank(ne.edge) - 30 * pf + (L < 8 ? 20 : 0)
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
        y = clearPortal(b, mx, mz, w, y);
        const fitted = fitFacadeSign(best, { centre: tc, width: w, minWidth: Math.min(w, s.aspect * 0.3), y0: y - 0.1, y1: y + hh + 0.1 }, facadeBoards);
        if (!fitted) { fasciaLayoutAudit.push({ text, building: b.i, status: 'no-clear-inferred-fascia-span', x, z }); return; }
        const original = { x: mx, z: mz, width: w };
        tc = fitted.centre; w = fitted.width; hh = Math.min(hh, w / s.aspect);
        mx = ax + tx * tc + nx * proud; mz = az + tz * tc + nz * proud;
        fasciaLayoutAudit.push({ text, building: b.i, status: 'placed', original, x: mx, z: mz, width: w, height: hh, y });
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

    // ---- rooftop advertising (R12.3) from the field research (game/research/bucharest-romana.json rooftop_signs):
    //      lit sign boxes on the roof edge facing the street / square, on a steel frame; sign-atlas material = self-lit
    const ROOF_ADS = {
        bucharest: [
            { lat: 44.44660, lon: 26.09700, text: 'Coca-Cola', bg: '#e41e2b', fg: '#ffffff', w: 26 },   // Piața Romană 9 (photo Apr 2023)
            { lat: 44.44720, lon: 26.09560, text: 'NetBet', bg: '#141a2e', fg: '#3aa0ff', w: 16 },      // Lascăr Catargiu 2–4 (photo Apr 2023)
            // Piața Victoriei: rooftop ads exist on the 1990s blocks but the current brands are not researched → unbranded frames
            { lat: 44.45160, lon: 26.08720, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
            { lat: 44.45250, lon: 26.08690, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
        ],
    }[city.id] || [];
    let roofAds = 0; const roofAdList = [];
    for (const ad of ROOF_ADS) {
        if (!inDistrictLL(ad.lat, ad.lon, 0)) continue;
        const q = city.proj(ad.lat, ad.lon);
        let b = buildingAt(q.x, q.z); if (b && (b.skip || b.h < 18)) b = null;
        if (!b) { let bd = 70; bGrid.each(q.x - 70, q.z - 70, q.x + 70, q.z + 70, (o) => { if (o.skip || o.area < 200 || o.h < 18) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (!b) continue; // (rooftop signs stand on blocks of ≥ 6 storeys)
        const ne = nearestEdge(b.c[0], b.c[1], (e) => !e.virtual && /^(primary|secondary|trunk)/.test(e.type), 120); if (!ne) continue;
        // the roof edge facing that road
        const ring = b.ring, ccw = signedArea(ring) > 0; let best = null, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2, tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const sc = (tx * nx + tz * nz) / tl * 2 + Math.min(L, 30) / 30; if (sc > bs) { bs = sc; best = { mx, mz, nx, nz, L }; }
        }
        if (!best) continue;
        const sg = signs.get(ad.text, ad.bg, ad.fg, null, true); if (!sg) continue;
        const w = Math.min(ad.w, best.L * 0.9), hh = Math.min(4.5, w / sg.aspect), c2 = cellOf(best.mx, best.mz);
        const x = best.mx - best.nx * 1.0, z = best.mz - best.nz * 1.0, ang = Math.atan2(best.nx, best.nz), y = b.h + 1.2 + hh / 2;
        addSignQuad(c2, x, z, ang, 1, w, hh, y, sg, 0.15);
        const steel = rgb('#3a3d42');
        for (const f of [-0.42, 0, 0.42]) { const px = x + best.nz * w * f, pz = z - best.nx * w * f; c2.solid.box(px, b.h, pz, 0.14, 1.2 + hh, 0.14, ang, steel); }
        c2.solid.box(x - best.nx * 0.08, b.h + 1.2, z - best.nz * 0.08, w, hh, 0.12, ang, steel);
        roofAds++; roofAdList.push({ text: ad.text, x: Math.round(x), z: Math.round(z), y: Math.round(y), nx: +best.nx.toFixed(2), nz: +best.nz.toFixed(2) });
    }
    // (the warm 'square glow' pools were removed: render's lamps / floodlights carry the squares at night)

    // -----------------------------------------------------------------------
    //  POIs from OSM (businesses, transport…)
    // -----------------------------------------------------------------------
    setProgress('Opening the shops…'); await tick();
    const P = props();
    const fuelLog = []; // fuel forecourts: where the canopy went (or why not) — world.stats.fuel
    // (fidelity pass r2) pump islands under the mapped canopy + a brand pylon at the street: fuel-forecourt.js (districts only)
    const fuelForecourts = [];
    const fuelForecourt = (x, z, label, canopyRec) => {
        if (!distId || !label) return;
        // a second fuel point of one station (an LPG point beside the canopy) gets no pylon of its own
        if (!canopyRec && data.pois.some(r => { if (data.poiKinds[r[0]] !== 'fuel') return false; const d = Math.hypot(r[1] / 10 - x, r[2] / 10 - z); const other = (str(r[4]) || str(r[3])).toLowerCase(); return d > 1 && d < 60 && !!other && label.toLowerCase().includes(other) && !!bRecs[buildingIndex(r[6], r[1] / 10, r[2] / 10)]?.canopy; })) return; // (same brand only: GPL Lukoil beside Lukoil)
        const bsF = brandStyle(label) || ['#1f2937', '#ffffff', '#f97316'], lane = canopyRec ? nearestEdge(canopyRec.c[0], canopyRec.c[1], q => q.type === 'service' && !q.virtual && !q.tunnel, 22) : null;
        // (2026-11-12) the street is looked for from the canopy (else the mapped point); emitFuelForecourt keeps the pylon on
        // the station's own frontage, so a street that only passes 70 m away gives no pylon (was 90-98 m from the station)
        const ax = canopyRec ? canopyRec.c[0] : x, az = canopyRec ? canopyRec.c[1] : z;
        const streets = [], seenE = new Set();
        for (let k = 0; k < 3; k++) { // the three nearest public street edges (different edges), nearest first
            const stE = nearestEdge(ax, az, q => q.drivable && !q.virtual && !q.tunnel && q.type !== 'service' && !/motorway/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3 && !seenE.has(q), 70);
            if (!stE) break; seenE.add(stE.edge);
            const q = stE.edge, sd = ((ax - stE.cx) * q.nx + (az - stE.cz) * q.nz) >= 0 ? 1 : -1, off = (sd > 0 ? q.wR : q.wL) + 1.0;
            streets.push({ x: stE.cx + q.nx * off * sd, z: stE.cz + q.nz * off * sd, nx: q.nx * sd, nz: q.nz * sd, dirx: q.dirx, dirz: q.dirz });
        }
        const street = streets[0] || null;
        fuelForecourts.push(emitFuelForecourt({ cellOf, rgb, baseY: (px, pz) => raisedTop(px, pz) ?? Y.side,
            blocked: (px, pz, r) => onRibbon(px, pz, r) ? 'carriageway' : buildingAt(px, pz) && buildingAt(px, pz) !== canopyRec ? 'building' : tramSweep?.circle(px, pz, r + 0.2, 0, 7) ? 'tram-sweep' : null,
            addCollider: (px, pz, r, kind) => propColl.push({ x: px, z: pz, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind, estimated: true }), addSign: addSignQuad },
            { name: label, at: [x, z], ring: canopyRec?.ring || null, laneDir: lane ? [lane.edge.dirx, lane.edge.dirz] : null, street, streets, colours: bsF, sign: signs.get(label.slice(0, 18), bsF[0], bsF[1], bsF[2]), panel: signs.get(' ', '#15181c', '#15181c', null) }));
    };
    const transitShelterAudit = [];
    for (const [poiIndex, r] of data.pois.entries()) {
        const kind = data.poiKinds[r[0]];
        const x = r[1] / 10, z = r[2] / 10, name = str(r[3]), brand = str(r[4]), sub = str(r[5]), bIdx = buildingIndex(r[6], x, z);
        const ks = KIND_STYLE[kind] || KIND_STYLE.landmark;
        const label = name || brand || (kind === 'busstop' ? (sub.startsWith('tram') ? (US ? 'Streetcar stop' : 'Stație tramvai') : (US ? 'Bus stop' : 'Stație autobuz')) : kind === 'metro' ? (US ? 'Link station' : 'Metrou') : kind);
        const poi = { id: 'osm' + pois.length, kind, sub, label, brand, x, z, doorX: x, doorZ: z, color: ks.color, icon: sub.startsWith('cafe') ? '☕' : ks.icon, visited: false, h: 4, w: 4, d: 4, interactive: false, building: bIdx };
        pois.push(poi);
        if (kind === 'busstop') { poi.shelterModel = sourceTransitShelterDecision(data, poiIndex); transitShelterAudit.push({ poiId: poi.id, ...poi.shelterModel }); }
        if (kind === 'fuel') { // the pump is reached from the street: door at the kerb of the nearest drivable lane
            const okLane = (q) => q.drivable && !q.virtual && !q.tunnel && !/motorway|_link/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3;
            const dn = nearestEdge(x, z, (q) => okLane(q) && q.type !== 'service', 60) || nearestEdge(x, z, okLane, 150); // a street, not the forecourt's own service lane
            if (dn) {
                const q = dn.edge, sd = ((x - dn.cx) * q.nx + (z - dn.cz) * q.nz) >= 0 ? 1 : -1;
                let off = (sd > 0 ? q.wR : q.wL) + 1.2, dx = dn.cx + q.nx * off * sd, dz = dn.cz + q.nz * off * sd;
                if (buildingAt(dx, dz)) { off = (sd > 0 ? q.wR : q.wL) + 0.4; dx = dn.cx + q.nx * off * sd; dz = dn.cz + q.nz * off * sd; }
                poi.doorX = dx; poi.doorZ = dz;
            }
        }
        const c = cellOf(x, z);
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx >= 0 && bRecs[bIdx] && (brand || name) && sub !== 'atm') addUnitSign(bRecs[bIdx], x, z, (brand || name), kind, poiIndex); // (ATMs do not name a unit — world-data Request)
        let ne = nearestEdge(x, z);
        if (!ne) continue;
        let e = ne.edge;
        let side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        let roadAng = Math.atan2(e.dirx, e.dirz); // rotation about Y that maps local +z onto the edge direction
        if (kind === 'fuel') { // sourced stations keep their anchor; only clear footprints get forecourt decoration
            const sourceCanopy = bIdx >= 0 ? bRecs[bIdx] : null;
            if (sourceCanopy?.canopy && !sourceCanopy.skip) {
                // The source roof was already emitted at its real footprint. Do not add a guessed 10x16m canopy/pumps.
                poi.h = sourceCanopy.h; poi.w = sourceCanopy.x1 - sourceCanopy.x0; poi.d = sourceCanopy.z1 - sourceCanopy.z0;
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: true, source: data.buildingIds?.[sourceCanopy.i], sourceFootprint: true, topM: sourceCanopy.h, clearanceM: sourceCanopy.minH, topSource: sourceCanopy.canopy.topSource, clearanceSource: sourceCanopy.canopy.clearanceSource, supports: sourceCanopy.canopySupports || 0, supportSource: sourceCanopy.canopy.supportSource });
                { // (2026-11-12) the mapped canopy carries the station's brand board on its (up to four) main fascias (brand from the
                  // source POI, colours from the brand table); pumps / pylon stay unknown and are not drawn
                    const bsC = brandStyle(brand || name), fsC = bsC && (brand || name) ? signs.get((brand || name).slice(0, 18), bsC[0], bsC[1], bsC[2]) : null, R = sourceCanopy.ring;
                    if (fsC && R?.length >= 3) {
                        // (2026-11-12 render review) one board per facing side: an L-shaped canopy (Grozăvești Petrom wraps its
                        // kiosk) has two parallel edges on one face; an edge against another building (the kiosk wall) carries
                        // none; and a face the canopy builder already signed (brandBoardFaces, its two longest walls) gets no
                        // second board: those two boards read "Petrom / Petrom". Outward normal from the ring's winding.
                        const ccwC = signedArea(R) > 0, faces = [...(sourceCanopy.brandBoardFaces || [])];
                        const edges = R.map((a, k) => { const b2 = R[(k + 1) % R.length], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1; let nx = (b2[1] - a[1]) / L, nz = -(b2[0] - a[0]) / L; if (!ccwC) { nx = -nx; nz = -nz; } return { a, b: b2, L, nx, nz }; }).sort((p, q) => q.L - p.L);
                        for (const ed of edges) {
                            if (ed.L < 4 || faces.length >= 4) continue;
                            if (faces.some(f => f.nx * ed.nx + f.nz * ed.nz > Math.cos(25 * Math.PI / 180))) continue;
                            const mx = (ed.a[0] + ed.b[0]) / 2, mz = (ed.a[1] + ed.b[1]) / 2, ob = buildingAt(mx + ed.nx * 0.6, mz + ed.nz * 0.6);
                            if (ob && ob !== sourceCanopy) continue;
                            faces.push(ed);
                            addSignQuad(cellOf(mx, mz), mx, mz, Math.atan2(ed.nx, ed.nz), 1, Math.min(ed.L * 0.6, 1.0 * fsC.aspect), 1.0, sourceCanopy.h - 0.2, fsC, 0.04);
                        }
                    }
                }
                fuelForecourt(x, z, brand || name, sourceCanopy);
                continue;
            }
            if (data.buildingGeometryPolicy === 'source') {
                poi.h = sourceCanopy?.h || 4; fuelForecourt(x, z, brand || name, null);
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: false, sourceFootprint: false, reason: 'No reviewed mapped canopy at this source POI; canopy/pumps/pylon dimensions and fuel grades are unknown' });
                continue;
            }
            // canopy on pillars + pumps + pylon sign
            const fx = x, fz = z, pyl = { e, ne, side }; // the mapped station anchor never moves to fit decoration
            { // the forecourt (canopy 10 × 16 m + apron 14 × 22 m) must stay off every carriageway AND every building footprint
              // (2026-11-08: only its centre was tested, so the Pipera Petrom canopy cut through the station's own building):
              // if the complete footprint is unsafe at the mapped anchor, omit it instead of moving the station
                const notService = (rb) => rb.e ? rb.e.type !== 'service' : (rb.node.allEdges || rb.node.edges).some(q => q.type !== 'service'); // (the forecourt's own service lanes run under the canopy)
                const fpFreeA = (cx, cz, ang) => {
                    const fp = obbPoly({ x: cx, z: cz, hw: 7, hd: 11, angle: ang });
                    { let deck = false; surfacesAt(cx, cz, (hh) => { if (hh > Y.road + 2.5) deck = true; }); if (deck) return false; } // (never under a viaduct deck)
                    if (polyOnRibbon(fp, notService) || buildingAt(cx, cz) || fp.some(([qx, qz]) => buildingAt(qx, qz))) return false;
                    let hit = false;
                    bGrid.each(cx - 14, cz - 14, cx + 14, cz + 14, (o) => { if (hit || o.skip) return; if (o.ring.some(([qx, qz]) => pointInPolygon(qx, qz, fp)) || polysCross(o.ring, fp)) hit = true; });
                    return !hit;
                };
                if (!fpFreeA(fx, fz, roadAng)) { poi.h = 4; fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: false }); continue; }
                fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: true, fx: Math.round(fx), fz: Math.round(fz) });
            }
            const bs = brandStyle(brand || name) || ['#1f2937', '#ffffff', '#f97316'];
            const ca = Math.cos(roadAng), sa = Math.sin(roadAng);
            const L2W = (lx, lz) => [fx + lx * ca + lz * sa, fz - lx * sa + lz * ca];
            const canopyCol = rgb('#f3f4f6');
            treeClear.push({ x: fx, z: fz, r: 14 }); // the forecourt + shop stay clear of trees (they covered it)
            // (after round 6) canopy: a brand-coloured fascia all round with an accent stripe, a light underside
            c.solid.box(fx, 4.95, fz, 10, 0.1, 16, roadAng, canopyCol);
            c.solid.box(fx, 5.0, fz, 10.1, 0.85, 16.1, roadAng, rgb(bs[0]));
            c.solid.box(fx, 5.02, fz, 10.14, 0.12, 16.14, roadAng, rgb(bs[2] || bs[1]));
            for (const [lx, lz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.45, 4.8, 0.45, roadAng, rgb('#d1d5db')); addPropColl(px, pz, 0.35, 'fuel'); }
            for (const [lx, lz] of [[-1.6, -3.5], [1.6, -3.5], [-1.6, 3.5], [1.6, 3.5]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.9, 1.7, 0.6, roadAng, rgb('#e5e7eb')); c.solid.box(px, 1.5, pz, 0.92, 0.35, 0.62, roadAng, rgb(bs[0])); addPropColl(px, pz, 0.55, 'fuel'); }
            c.ground.flatFan([L2W(-7, -11), L2W(7, -11), L2W(7, 11), L2W(-7, 11)], Y.parking + 0.003, rgb('#77787b'), 0.15);
            { // canopy fascia with the sourced brand, underside light panels and pump island kerbs
              const fs = signs.get((brand || name || 'Benzinărie').slice(0, 18), bs[0], bs[1], bs[2]);
              if (fs) for (const sd of [1, -1]) { const [qx, qz] = L2W(sd * 5.06, 0); addSignQuad(c, qx, qz, roadAng + Math.PI / 2, sd, Math.min(9, 0.75 * fs.aspect), 0.75, 5.0, fs, 0.02); }
              for (const lz of [-4.5, 0, 4.5]) for (const lx of [-2.5, 2.5]) { const [qx, qz] = L2W(lx, lz); c.solid.box(qx, 4.53, qz, 1.4, 0.03, 0.6, roadAng, rgb('#fbfbf2')); }
              for (const lx of [-1.6, 1.6]) { const [qx, qz] = L2W(lx, 0); c.solid.box(qx, 0.05, qz, 1.2, 0.18, 9.5, roadAng, rgb('#c9c6bd')); }
            }
            // pylon at the kerb (of the reference street)
            const off2 = (pyl.side > 0 ? pyl.e.wR : pyl.e.wL) + 2.5;
            const px = pyl.ne.cx + pyl.e.nx * off2 * pyl.side + pyl.e.dirx * 9, pz = pyl.ne.cz + pyl.e.nz * off2 * pyl.side + pyl.e.dirz * 9;
            if (onRibbon(px, pz, 1.4)) { poi.h = 6; poi.w = 10; poi.d = 16; continue; }
            c.solid.box(px, 0.2, pz, 0.6, 7.5, 2.4, roadAng + Math.PI / 2, rgb(bs[0]));
            const s = signs.get((brand || name || 'Fuel').slice(0, 18), bs[0], bs[1], bs[2]);
            if (s) for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.3, Math.min(2.2, 2.3 / s.aspect * 2), 5.6, s, 0.32);
            { // price-board panels under the logo: fuel grades only (no invented prices)
              const g1 = signs.get(US ? 'REGULAR' : 'BENZINĂ', '#111111', '#f5f5f5', null), g2 = signs.get(US ? 'DIESEL' : 'MOTORINĂ', '#111111', '#f5f5f5', null);
              for (const sd of [1, -1]) { if (g1) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.9, g1, 0.32); if (g2) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.3, g2, 0.32); } }
            propColl.push({ x: px, z: pz, r: 1.4, poly: null, angle: roadAng + Math.PI / 2, hw: 0.3, hd: 1.2, h: 7, prop: true });
            poi.h = 6; poi.w = 10; poi.d = 16;
            continue;
        }
        if (kind === 'metro' && sub === 'subway_entrance') {
            if (onRibbon(x, z, 0.8)) continue;
            c.solid.box(x, 0.18, z, 0.18, 3.2, 0.18, roadAng, rgb('#4b5563')); addPropColl(x, z, 0.3, 'metro');
            const s = signs.get('M', '#1d4ed8', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, x, z, roadAng, sd, 0.9, 0.9, 3.0, s, 0.11);
            c.solid.box(x, 2.95, z, 0.95, 0.95, 0.2, roadAng, rgb('#1d4ed8'));
            continue;
        }
        if (kind === 'busstop') {
            if (!poi.shelterModel.emitInferred) continue; // no guessed unit/colliders; source owners and POI remain intact
            // (owner register #2, Floreasca: "bus shelter facing wrong direction or misplaced; check public road versus path
            // alignment") the shelter took the nearest edge of any kind (a service lane, a drive); it faces the bus road: the
            // nearest public carriageway within 25 m
            const neBus = nearestEdge(x, z, f => !f.virtual && !f.tunnel && f.publicDrive !== false && f.type !== 'service', 25);
            if (neBus) { ne = neBus; e = neBus.edge; side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1; roadAng = Math.atan2(e.dirx, e.dirz); }
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 12) continue;
            let off = sideW + shoulderOf(e) + Math.max(1.3, Math.min(e.sidewalk, 3) * 0.6);
            let sx = ne.cx + e.nx * off * side, sz = ne.cz + e.nz * off * side;
            const ang = roadAng; const ca = Math.cos(ang), sa = Math.sin(ang);
            { const shelterBad = () => { if (polyOnRibbon(obbPoly({ x: sx, z: sz, hw: 1.2, hd: 2.2, angle: ang }))) return true;
                    for (const [lx, lz, r] of [[-side * 0.5, -1.3, 0.75], [-side * 0.5, 0, 0.75], [-side * 0.5, 1.3, 0.75], [side * 0.3, 1.9, 0.15]]) if (onRibbon(sx + lx * ca + lz * sa, sz - lx * sa + lz * ca, r) || tramSweep?.circle(sx + lx * ca + lz * sa, sz - lx * sa + lz * ca, r, 0, 3)) return true; return false; }; // (an inferred shelter also keeps out of a tram's swept body)
              let k = 0; while (k < 8 && shelterBad()) { off += 0.6; sx = ne.cx + e.nx * off * side; sz = ne.cz + e.nz * off * side; k++; }
              if (shelterBad() || buildingAt(sx, sz)) continue; }
            const L2W = (lx, lz) => [sx + lx * ca + lz * sa, sz - lx * sa + lz * ca];
            const back = L2W(-side * 0.8, 0), v0b = c.solid.vc; // local +x points toward the road (= -normal)
            // (real STB / King County Metro shelter: ~3.4 × 1.5 m, 2.3 m roof, tinted glass on a raised frame — not a pale box)
            const glass = rgb('#6f8a99'), frame = rgb(US ? '#2f3e46' : '#3b3f45');
            c.solid.box(back[0], 0.35, back[1], 0.06, 1.9, 3.2, ang, glass);
            for (const lz of [-1.6, 1.6]) { const p2 = L2W(-side * 0.8, lz); c.solid.box(p2[0], 0.2, p2[1], 0.1, 2.15, 0.1, ang, frame); const p3 = L2W(-side * 0.25, lz); c.solid.box(p3[0], 0.35, p3[1], 1.1, 1.9, 0.05, ang, glass); }
            const roofP = L2W(-side * 0.25, 0); c.solid.box(roofP[0], 2.35, roofP[1], 1.6, 0.1, 3.5, ang, frame);
            const bench = L2W(-side * 0.5, 0); c.solid.box(bench[0], 0.45, bench[1], 0.4, 0.08, 2.4, ang, rgb('#6b4a2f'));
            const pole = L2W(side * 0.3, 1.9);
            for (const lz of [-1.3, 0, 1.3]) { const q2 = L2W(-side * 0.5, lz); addPropColl(q2[0], q2[1], 0.75, 'busstop'); }
            addPropColl(pole[0], pole[1], 0.15, 'busstop'); c.solid.box(pole[0], 0.2, pole[1], 0.08, 2.8, 0.08, ang, frame);
            const s = signs.get(sub.startsWith('tram') ? 'T' : 'BUS', sub.startsWith('tram') ? '#c2410c' : '#0f766e', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, pole[0], pole[1], ang, sd, 0.6, 0.5, 2.5, s, 0.05);
            liftOnSide(c, v0b, null, sx, sz, 0.5);
            continue;
        }
        // businesses without a building of their own (or in a building already signed) → small pylon / board
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx < 0 && (brand || name)) {
            // (fidelity pass 2026-11-12) reality-pass districts: every mapped business names its unit, branded or not (moft,
            // Mondayz Coffee, iMZA, Cozofino, Pizzeria Due Amici were dropped as "unbranded clutter" before the fascia rule
            // below was reached, and a pylon spot inside a building dropped others): the fascia goes on the nearest building
            if (realPass && sub !== 'atm') {
                let nb = null, nd = brand || brandStyle(name) || kind === 'pharmacy' ? 30 : 16; // (unbranded: only a building at the point; a kiosk 20 m from any wall gets no fascia)
                bGrid.each(x - 30, z - 30, x + 30, z + 30, (o) => { if (o.skip || o.cv || o.h < 3 || (o.minH || 0) > 0.5) return; const d = pointInPolygon(x, z, o.ring) ? 0 : polyDist(x, z, o.ring); if (d < nd) { nd = d; nb = o; } });
                if (nb) addUnitSign(nb, x, z, brand || name, kind);
                continue;
            }
            const bs = brandStyle(brand || name);
            if (!bs && kind !== 'pharmacy' && !brand) continue; // unbranded tiny places: skip the clutter
            const st = bs || [ks.bg, ks.fg, null];
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 40) continue;
            const off = sideW + shoulderOf(e) + Math.max(1.5, Math.min(e.sidewalk, 4) * 0.8);
            const px = ne.cx + e.nx * off * side, pz = ne.cz + e.nz * off * side;
            if (onRibbon(px, pz, 1.2) || buildingAt(px, pz)) continue;
            // (round 6 note 45) a business is a shop, not a sign on a stick: the fascia goes on the nearest building's street
            // front when one stands within ~18 m (the OSM point sits beside its unit); never invent a pavilion
            if (sub !== 'atm') {
                // (2026-11-08) reality-pass districts: the fascia goes on the nearest building within 30 m (the OSM point is often
                // mapped on the sidewalk in front of its unit); never a sign on a pole in the middle of the pavement
                const R = realPass ? 30 : 18; let nb = null, nd = R;
                bGrid.each(x - R, z - R, x + R, z + R, (o) => { if (o.skip || o.cv || o.h < 3 || (o.minH || 0) > 0.5) return; const d = pointInPolygon(x, z, o.ring) ? 0 : polyDist(x, z, o.ring); if (d < nd) { nd = d; nb = o; } });
                if (nb) { addUnitSign(nb, x, z, brand || name, kind); continue; }
                if (realPass) continue;
            }
            const s = signs.get((brand || name).slice(0, 22), st[0], st[1], st[2]);
            if (!s) continue;
            if (sub === 'atm') { // only an explicitly mapped ATM gets a booth; a bank POI alone does not establish one
                const fx = -e.nx * side, fz = -e.nz * side, fAng = Math.atan2(-e.nx * side, -e.nz * side);
                c.solid.box(px, 0, pz, 1.0, 2.25, 0.7, fAng, rgb('#3a3f46'));
                c.solid.box(px + fx * 0.36, 0.95, pz + fz * 0.36, 0.55, 0.4, 0.04, fAng, rgb('#5d7f93'));                  // screen
                addSignQuad(c, px + fx * 0.36, pz + fz * 0.36, Math.atan2(fx, fz), 1, 0.95, Math.min(0.5, 0.95 / s.aspect), 1.95, s, 0.02);
                addPropColl(px, pz, 0.6, 'pylon'); continue;
            }
            if (kind === 'hotel') { c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563')); addPropColl(px, pz, 0.2, 'pylon'); for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.2, 2.2 / s.aspect, 3.4, s, 0.08); continue; }
            c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563')); addPropColl(px, pz, 0.2, 'pylon');
            for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.2, 2.2 / s.aspect, 3.4, s, 0.08);
        }
    }
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
    const treeSeen = new Set();
    const exactTreeCentres = new Set();
    const dtSea = US ? city.proj(47.6062, -122.3321) : null, dtBel = US ? city.proj(47.6150, -122.2000) : null;
    const coniferChance = (x, z, kind) => {
        if (!US) return kind === 'forest' ? 0.1 : 0; // (Bucharest: conifers only where OSM says needleleaved, or in woods — note 17)
        const dt = Math.min(Math.hypot(x - dtSea.x, z - dtSea.z) / 1300, Math.hypot(x - dtBel.x, z - dtBel.z) / 700);
        return kind === 'street' ? (dt < 1 ? 0.08 : 0.3) : dt < 1 ? 0.2 : 0.62;
    };
    // species trees (trees.js): species from OSM where mapped, else per city / street-type defaults (one species per
    // street row; conifers only where OSM says needleleaved, in parks / forests / gardens); size from the OSM height,
    // else typical per kind. `s` (legacy ≈ 1 for a 6–8 m tree) only seeds the height when nothing better is known.
    const TG = treeGeometries();
    const treeGrid = new BoxGrid(20), treeNear = (x, z, r) => { let f = false; treeGrid.each(x - r, z - r, x + r, z + r, (t) => { if (!f && Math.hypot(t.x - x, t.z - z) < r) f = true; }); return f; };
    const treeCoverage = Array.isArray(data.treeCoverage) && data.treeCoverage.length === 4 ? data.treeCoverage : null;
    const measuredCanopyAt = (x, z) => {
        if (!treeCoverage) return false;
        const ll = city.proj.inverse(x, z);
        return ll.lat >= treeCoverage[0] && ll.lat <= treeCoverage[2] && ll.lon >= treeCoverage[1] && ll.lon <= treeCoverage[3];
    };
    // elevated decks a crown must keep out of: raised carriageways / pads and elevated rail slabs (nearest within reach)
    const TREE_DECK_GAP = .6, treeDeckClearance = { narrowed: 0, lowered: 0, excluded: [] };
    const elevatedDeckNear = (x, z, reach) => {
        let best = null; const take = (poly, soffit, top) => { const d = pointInPolygon(x, z, poly) ? 0 : polyDist(x, z, poly); if (d < reach && (!best || d < best.d)) best = { d, soffit, top }; };
        ribGrid.each(x - reach, z - reach, x + reach, z + reach, rb => {
            if (rb.y < 2.5 || x < rb.x0 - reach || x > rb.x1 + reach || z < rb.z0 - reach || z > rb.z1 + reach) return;
            const low = rb.e ? Math.min(rb.e.ya, rb.e.yb) : rb.node.y; take(rb.poly, low + Y.road - Math.min(1.1, Math.max(.05, low)), rb.y + Y.road);
        });
        sceneryDeckGrid.each(x - reach, z - reach, x + reach, z + reach, d => { if ((d.kind === 'source-tram-deck' || d.kind === 'bridge-slot-infill' || d.kind === 'basarab-centre-support' || d.kind === 'basarab-platform') && d.y1 > 2.5) take(d.poly, d.y0, d.y1); });
        return best;
    };
    const treeBuildingClearance = { narrowed: 0, skipped: 0, mapped: 0 };
    const elevatedDataset = `${city.id}-${distId}`, elevatedPlan = planElevatedSources(data, undelta, elevatedDataset); // rail viaduct / footbridge decks: no tree or inferred lamp grows through them
    const placeTree = (x, z, s, kind, con = null, dec = null, opt = {}) => {
        if (elevatedPlan.decks && elevatedPlan.under(x, z, 1.5)) { elevatedPlan.skipped.trees++; return false; }
        // Mapped/measured crowns arrive first as 'osm'. Where a canopy survey
        // actually covers the ground, do not fill its lawns/gaps with invented trees.
        if (kind !== 'osm' && measuredCanopyAt(x, z)) return false;
        if (treeList.length >= maxTrees) return false;
        if (kind === 'street' && treeNear(x, z, 4.5)) return false; // (a mapped OSM tree already stands there)
        { let under = false; surfacesAt(x, z, (hh,raised,surface) => { if(surface?.kind?.startsWith('basarab-')||surface?.kind==='bridge-slot-infill')return;if (hh > Y.road + 2.5) under = true; }); if (under) return false; } // New Basarab survey conflicts and slot slabs are audited after generation, preserving retained instances/RNG.
        if (kind === 'street' && onRibbon(x, z, 1.3)) return false; // (no row trees on medians / verges narrower than ≈ 2.6 m)
        const sourceCentre = sourceTreeCentrePolicy(kind, data.treeRetention);
        const k = Math.round(x / 1.6) + ',' + Math.round(z / 1.6);
        if (treeCentreDuplicate(x, z, sourceCentre, treeSeen, exactTreeCentres)) return false;
        if (onRibbon(x, z, 0.35 * s + 0.5) || buildingAt(x, z) || treeCentreWater(x, z, sourceCentre, isWater, nearWater)) return false;
        if (lmGrounds.some(g => x > g.x0 - 1.5 && x < g.x1 + 1.5 && z > g.z0 - 1.5 && z < g.z1 + 1.5 && (pointInPolygon(x, z, g.p) || polyDist(x, z, g.p) < 1.5))) return false;
        treeSeen.add(k);
        const isCon = con ?? (kind === 'street' || kind === 'osm' ? false : rng.chance(coniferChance(x, z, kind)));
        let species = opt.species || (isCon ? 'conifer' : defaultSpecies(city.id, kind, opt.road ?? Math.round(x * 0.01 + z * 0.013), rng()));
        if (species === 'conifer' && !isCon) species = 'generic';
        const shape = TG.shapes[(SPECIES[species] || SPECIES.generic).shape];
        const H = opt.h > 0 ? opt.h : kind === 'street' ? (US ? rng.range(8, 12) : rng.range(10, 14)) * (shape.top < 9 ? 0.75 : 1) : kind === 'garden' ? rng.range(5, 9) : kind === 'forest' ? rng.range(12, 20) : rng.range(8, 15);
        let sz = clamp(H / shape.top, 0.35, 1.5);
        // a crown that would reach over a carriageway is narrowed toward it (clear stems keep foliage above the lanes;
        // review #20); conifers are slimmed, never lifted
        const measuredCrown = opt.crownRadiusM > 0;
        let sh = measuredCrown ? opt.crownRadiusM / (shape.rx * sz) : 1;
        const R = shape.rx * sz;
        if (!measuredCrown && onRibbon(x, z, R)) {
            let lo = 0.35 * s + 0.5, hi = R;
            for (let it = 0; it < 4; it++) { const m = (lo + hi) / 2; if (onRibbon(x, z, m)) hi = m; else lo = m; }
            const lowCrown = (shape.cy - shape.ry * 0.8) * sz < 4.4; // crown bottom below truck height
            sh = clamp((lo + (lowCrown ? 0.3 : 1.6)) / R, isCon ? 0.35 : 0.55, 1);
        }
        // (owner report: crowns through the elevated carriageway) a crown may not occupy an elevated deck or the tram
        // viaduct beside it: measured crowns included. Narrow it to the deck edge; a trunk too close for that keeps
        // its place as a tree that stays below the soffit; only one that fits neither way is a physical exclusion.
        {
            const deck = elevatedDeckNear(x, z, shape.rx * sz * sh + TREE_DECK_GAP);
            if (deck && shape.top * sz > deck.soffit - .2 && (shape.cy - shape.ry) * sz < deck.top + 5) {
                const fit = (deck.d - TREE_DECK_GAP) / (shape.rx * sz);
                if (fit >= .45) { if (fit < sh) { sh = fit; treeDeckClearance.narrowed++; } }
                else if (deck.soffit - .4 >= shape.top * .35) { sz = Math.min(sz, (deck.soffit - .4) / shape.top); treeDeckClearance.lowered++; }
                else { treeDeckClearance.excluded.push({ x: +x.toFixed(1), z: +z.toFixed(1), kind, soffitM: +deck.soffit.toFixed(2) }); return false; }
            }
        }
        // guards (route-blocked on Str. Buzești): the trunk collider plus 0.3 m must be off every carriageway / lane strip,
        // and a crown hanging below 4.4 m may not reach over one (else it is dropped, never left in a lane)
        const collR = 0.3 * Math.max(0.6, sz * 1.4);
        if (onRibbon(x, z, collR + 0.3)) return false;
        if (treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r)) return false;
        if (kind !== 'osm' && pierColl.some(q => Math.abs(x - q.x) < q.r + 1.2 && Math.abs(z - q.z) < q.r + 1.2)) return false; // (inferred trees keep off the bridge columns)
        if (!measuredCrown && (shape.cy - shape.ry * 0.8) * sz < 4.4 && onRibbon(x, z, R * sh * 0.9)) { if (kind === 'street' || kind === 'garden') return false; sh = Math.max(0.3, sh * 0.6); }
        // (owner register #23, Unirii: "tree crown intersects building facade") a crown may not reach into a building: it is narrowed
        // to 0.3 m off the nearest wall (down to 45 %); an invented tree closer than that is not planted, a mapped one keeps its place
        {
            // (spec 10 load budget) every probe lies within Rc of the tree: the buildings that could hold one are gathered once
            // (as buildingAt finds them: not skipped, its box, its ring outside its holes); wallAt asks only whether one does
            const Rc = shape.rx * sz * sh, near = [], reach = Rc + 1e-6;
            bGrid.each(x - reach, z - reach, x + reach, z + reach, (b) => { if (!b.skip && b.x1 >= x - reach && b.x0 <= x + reach && b.z1 >= z - reach && b.z0 <= z + reach && !near.includes(b)) near.push(b); });
            const inBuilding = (px, pz) => { for (const b of near) if (px >= b.x0 && px <= b.x1 && pz >= b.z0 && pz <= b.z1 && pointInPolygon(px, pz, b.ring) && !b.holes.some(h => pointInPolygon(px, pz, h))) return true; return false; };
            const wallAt = r => { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; if (inBuilding(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; } return false; };
            if (wallAt(Rc)) {
                let lo = 0, hi = Rc; for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (wallAt(m)) hi = m; else lo = m; }
                const fit = (lo - .3) / (shape.rx * sz);
                if (fit >= .45) { sh = Math.min(sh, fit); treeBuildingClearance.narrowed++; }
                else if (kind !== 'osm') { treeBuildingClearance.skipped++; return false; }
                else { sh = Math.min(sh, .45); treeBuildingClearance.mapped++; }
            }
        }
        treeList.push({ x, z, s: sz, species, con: !!isCon, dec: dec ?? (isCon ? 0 : 1), kind, sh }); treeGrid.insert(x, z, x, z, treeList[treeList.length - 1]);
        exactTreeCentres.add(`${x},${z}`);
        addPropColl(x, z, collR, 'tree');
        if(basarabStructure.report.active&&Number.isInteger(opt.sourceIndex))treeSourceMetadata.set(treeList.at(-1),{sourceIndex:opt.sourceIndex,crownRadiusM:opt.crownRadiusM||0,collider:propColl.at(-1)});
        treeBodies.set(treeList.at(-1), propColl.at(-1));
        return true;
    };
    // OSM natural=tree / tree_row (real positions, leaf type where tagged)
    const osmTrees = data.trees || [];
    const TI = data.treeInfo || [];
    let treesOSM = 0, treesRows = 0;
    for (let i = 0; i + 2 < osmTrees.length; i += 3) {
        const x = osmTrees[i] / 10, z = osmTrees[i + 1] / 10, t = osmTrees[i + 2], hh = (t >> 1) / 10;
        // treeInfo (world-data): taxon text → species, circumference → size, leaf bits (2 needleleaved, 1 broadleaved)
        const k = i / 3, taxon = TI[k * 3] >= 0 ? str(TI[k * 3]) : '', circ = TI[k * 3 + 1] || 0, leaf = TI[k * 3 + 2] || 0;
        let species = taxon ? speciesFromOSM(taxon) : null;
        const con = species === 'conifer' || (leaf & 2) ? true : (t & 1) && !(leaf & 1) && !TI.length ? true : false; // (leaf data known: needleleaved only)
        if (con) species = 'conifer'; else if (species === 'conifer') species = null;
        const dbh = circ > 0 ? circ / Math.PI : 0; // trunk diameter, cm
        const h = hh > 0 ? hh : dbh > 0 ? clamp(4 + dbh * 0.2, 4, 26) : 0;
        if (placeTree(x, z, h > 0 ? clamp(h / 6.5, 0.6, 2.0) : rng.range(0.85, 1.25), 'osm', con, null, { h, species: species || undefined, crownRadiusM: (data.treeCrownRadii?.[k] || 0) / 10,sourceIndex:k })) treesOSM++;
    }
    for (const [x, z, s, kind, road, sp] of treeSpots) if (placeTree(x, z, s, kind, null, null, { road, species: sp || undefined })) treesRows++;
    // parks & forests
    for (const a of areas) {
        if (!['park', 'forest', 'scrub', 'cemetery', 'grass'].includes(a.kind)) continue;
        const dens = a.kind === 'forest' ? 1 / 70 : a.kind === 'park' ? 1 / 140 : a.kind === 'cemetery' ? 1 / 120 : a.kind === 'scrub' ? 1 / 200 : 1 / 600;
        const n = Math.min(3000, Math.floor(a.size * dens));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z)) continue;
            placeTree(x, z, rng.range(0.9, a.kind === 'forest' ? 1.7 : 1.4), a.kind);
        }
    }
    // residential gardens (sparse)
    for (const a of areas) {
        if (a.kind !== 'residential' || treeList.length >= maxTrees) continue;
        const n = Math.min(400, Math.floor(a.size / (US ? 500 : 900)));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z) || !clearOf(x, z, 2.5)) continue;
            placeTree(x, z, rng.range(0.8, 1.3), 'garden');
        }
    }
    const coveredCanopies=coveredPlatformCanopies(treeList,BASARAB_PLATFORMS.filter(p=>basarabStructure.report.sourcePlatforms.includes(p.sourceId)),treeSourceMetadata);
    basarabStructure.report.treeSourceConflicts={excludedMeasured:coveredCanopies.conflicts,retainedMapped:coveredCanopies.unresolved};
    const waterTreeConflicts = sourceWaterTreeConflicts(treeList, landmarkWaterFootprints, t => treeBodies.get(t));
    // A trunk inside the swept cover of the tram bodies cannot stand where the source puts it (the source positions of a
    // rail and of a tree are each good to about a metre). It is listed and left out after generation, as the basin
    // conflicts are: retained trees keep their rotation, colour and random stream.
    const tramTreeConflicts = new Set();
    if (tramSweep) for (const t of treeList) {
        const body = treeBodies.get(t), hit = body && tramSweep.circle(t.x, t.z, body.r, 0, body.h ?? 3); if (!hit) continue;
        const dx = t.x - hit.x, dz = t.z - hit.z;
        tramTreeConflicts.add(t); tramSweepConflicts.trees.push({ x: t.x, z: t.z, kind: t.kind, species: t.species ?? null, trunkRadiusM: body.r, acrossBodyAxisM: Math.abs(dz * hit.fx - dx * hit.fz), bodyHalfWidthM: hit.body.widthM / 2, bodyLengthM: hit.body.lengthM });
    }
    const excludedTrees = new Set([...coveredCanopies.excluded, ...waterTreeConflicts.excluded, ...tramTreeConflicts]);
    const treeCount = treeList.length - excludedTrees.size;
    // instanced trees in district 250 m / legacy 500 m chunks; crowns keep a per-instance colour (instanceColor)
    // so the season / weather code can tint each tree (world.vegetation)
    const vegetation = { treeCrownMeshes: [], treeTrunkMeshes: [], deciduousMask: null, grassMaterials: [], groundMaterials: [], roofMaterials: [], trees: treeList };
    {
        // (2026-11-08) district worlds carry the measured canopy (thousands of real trees): fewer full-detail near trees
        const T = buildSpeciesTrees(treeList, { rng, cull: distId ? 480 : 550, chunk: distId ? 250 : 500, near: distId ? 60 : 95, maxNear: distId ? 110 : 240, farLayer: 2, exclude: excludedTrees, stemLod: distId ? 180 : 0 }); // Covered-platform and water-basin source conflicts are recorded separately from LOD/culling; smaller district chunks cull off-screen trees precisely; no trees or LOD geometry are removed
        // Generate every instance first so unaffected colours, rotations and RNG stay identical.
        if (excludedTrees.size) {
            const bodies = new Set([...excludedTrees].map(t => treeBodies.get(t)));
            treesOSM -= [...excludedTrees].filter(t => t.kind === 'osm').length;
            let at = 0; for (const t of treeList) if (!excludedTrees.has(t)) treeList[at++] = t; treeList.length = at;
            at = 0; for (const p of propColl) if (!bodies.has(p)) propColl[at++] = p; propColl.length = at;
        }
        vegetation.treeCrownMeshes.push(...T.crownMeshes); vegetation.treeTrunkMeshes.push(...T.trunkMeshes);
        vegetation.update = T.update;
        vegetation.deciduousMask = new Float32Array(treeList.map(t => t.dec));
    }
    // street lamps: real OSM highway=street_lamp nodes (moved to the sidewalk edge when mapped on the carriageway)
    // + synthesized ones on lit / main roads at the outer edge of the sidewalk
    const lamps = [];
    const lampGrid = new BoxGrid(30);
    const lampNear = (x, z, r) => { let f = false; lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (!f && Math.hypot(l.x - x, l.z - z) < r) f = true; }); return f; };
    // a lamp stands on the surface under its own base (deck, embankment, trench floor, sidewalk or ground), never at
    // the height of its parent edge's profile while standing beside it (the floating / sunk lamps of review #19b)
    const standY = (x, z, y) => { const rt = raisedTop(x, z, 0.2); if (rt !== null) return rt; let best = 0.15, bd = Math.abs(y - 0.15); surfacesAt(x, z, (h, raised) => { const v = raised ? h : h - Y.road + 0.15, d = Math.abs(v - y); if (d < bd) { bd = d; best = v; } }); return best; }; // (a raised sidewalk wins)
    const addLamp = (l) => { if (nearWater(l.x, l.z, 1.5)) { lampsWet++; return; } l.y = standY(l.x, l.z, l.y);
        if (l.osm === false && elevatedPlan.decks && elevatedPlan.under(l.x, l.z, 2.2)) { elevatedPlan.skipped.lamps++; return; } // (the 8 m mast and its arm would stand through the deck)
        if (l.osm === false && tramPropEnvelope && tramGrades.excludesInferredObstacle([l.x, l.z], [l.x, l.z], { inferred: true, bodyEnvelope: tramPropEnvelope, radiusM: .18, y0a: l.y, y1a: l.y + l.h, kind: 'inferred-street-lamp' })) return;
        if (l.osm === false && sweptOut('street-lamp', tramSweep?.circle(l.x, l.z, .18, 0, 3))) return; // (its collider spans 0-3 m)
        lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); addPropColl(l.x, l.z, 0.18, 'lamp'); Object.assign(propColl.at(-1), { mapped: l.osm === true, inferred: l.osm === false }); };
    const osmLamps = data.lamps || [];
    let lampsWet = 0;
    let lampsMoved = 0;
    for (let i = 0; i + 2 < osmLamps.length; i += 3) {
        let x = osmLamps[i] / 10, z = osmLamps[i + 1] / 10;
        if (lampNear(x, z, 3)) continue;
        const ne = nearestEdge(x, z, null, 80);
        let hh = osmLamps[i + 2] / 10, ly = 0;
        if (ne && onRibbon(x, z, 0.4)) { // mapped in the carriageway: move to the sidewalk edge on the same side
            const e = ne.edge, side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
            const sp = kerbSpot(e, clamp(ne.t, 0, 1) * e.len, side); x = sp.x; z = sp.z; lampsMoved++;
            if (onRibbon(x, z, 0.4)) continue;
        }
        let rot = 0;
        if (ne) { rot = Math.atan2(-(ne.cz - z), ne.cx - x); ly = ne.d < ne.edge.halfW + 6 && !ne.edge.tunnel ? yAlong(ne.edge, x, z) : 0; if (!hh) hh = /^(motorway|trunk|primary|secondary)/.test(ne.edge.type) ? 8 : 5; }
        if (!hh) hh = 6;
        if (buildingAt(x, z)) continue;
        addLamp({ x, z, h: hh, rot, y: 0.15 + ly, osm: true });
    }
    for (const [x, z, ang, ly, hh] of lampSpots) {
        if (lampNear(x, z, osmLamps.length > 300 ? 17 : 10) || buildingAt(x, z) || onRibbon(x, z, 0.35)) continue;
        addLamp({ x, z, h: hh, rot: ang, y: 0.15 + ly, osm: false });
    }
    // ---- Pasajul Basarab deck lamps. The generic rule above keeps no lamp on a deck (its spot is on the carriageway
    //      ribbon), so the whole structure was unlit. One arc lamp stands in the guard line about every 30 m along each
    //      guarded outer edge of the road decks: ESTIMATED positions and form (a white post curving in over the deck).
    //      None inside a tram's sweep or touching a stay, pylon, arch or roof member.
    const basarabLamps = { basis: 'MODEL: estimated arc lamps in the guard line of the Basarab road decks, about every 30 m', lamps: 0, skippedStructure: 0, skippedTram: 0 };
    if (basarabStructure.report.active) {
        const along = new Map(), members = basarabStructure.colliders.filter(c => c.minHeightAt && c.roofHeightAt), H = 9, STEP = 30;
        const touches = (x, z, y0, y1) => members.some(c => { if (Math.abs(x - c.x) > c.r + .5 || Math.abs(z - c.z) > c.r + .5 || !pointInPolygon(x, z, c.poly)) return false; const lo = c.minHeightAt(x, z, .4), hi = c.roofHeightAt(x, z, .4); return lo !== null && hi !== null && hi > y0 && lo < y1; });
        for (const w of walls) {
            if (!w.wall || w.kind !== 'rail' || !w.edge || w.tramDeckRailing || !basarabEdge(data, w.edge)) continue;
            const side = w.nx * w.edge.nx + w.nz * w.edge.nz < 0 ? 1 : -1, key = w.edge.road + '|' + side, len = Math.hypot(w.bx - w.ax, w.bz - w.az);
            let cum = along.get(key) ?? STEP * .5;
            for (let d = STEP - cum; d <= len; d += STEP) {
                const t = len ? d / len : 0, x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t, y = w.y1a + (w.y1b - w.y1a) * t - 1.1;
                if (!(y > 2) || lampNear(x, z, 14)) continue;
                if (tramSweep?.circle(x, z, .2, y, y + H) || tramGrades.excludesInferredObstacle([x, z], [x, z], { inferred: true, bodyEnvelope: tramPropEnvelope, radiusM: .18, y0a: y, y1a: y + H, kind: 'inferred-deck-lamp' })) { basarabLamps.skippedTram++; continue; }
                if ([0, 1.2, 2.5].some(o => touches(x + w.nx * o, z + w.nz * o, y + (o ? 6.5 : 1.2), y + H + .4))) { basarabLamps.skippedStructure++; continue; }
                const l = { x, z, y, h: H, rot: Math.atan2(-w.nz, w.nx), osm: false, arc: true };
                lamps.push(l); lampGrid.insert(x, z, x, z, l); basarabLamps.lamps++;
                propColl.push({ x, z, r: .18, hw: .18, hd: .18, angle: 0, poly: null, prop: true, kind: 'lamp', inferred: true, y, h: H, top: y + H, y0: y - .3, y1: y + H });
            }
            along.set(key, (cum + len) % STEP);
        }
        // (reality check, Pasajul Basarab west ramp, Street View 2026-11-11) tall curved twin-arm lamps stand on the median
        // between the carriageways: two arc lamps back to back on the filled medians, about every 30 m (form estimated)
        const twins = [];
        for (const d of medianFill.decks) {
            if (d.medianKind === 'asphalt') continue;
            const x = d.x, z = d.z, y = d.roofHeightAt(x, z), skip = r => { (basarabLamps.medianSkipped ??= {})[r] = (basarabLamps.medianSkipped[r] || 0) + 1; };
            if (!(y > .3)) { skip('low'); continue; } if (!pointInPolygon(x, z, d.poly)) { skip('outside'); continue; } if (twins.some(q => Math.hypot(q[0] - x, q[1] - z) < 28)) { skip('spacing'); continue; }
            const ne = nearestEdge(x, z, null, 20); if (!ne) { skip('no-edge'); continue; } const e = ne.edge, MH = 10;
            if (tramSweep?.circle(x, z, .25, y, y + MH) || [0, 1.5, 2.6].some(o => [1, -1].some(sg => touches(x + e.nx * o * sg, z + e.nz * o * sg, y + (o ? 7 : 1.2), y + MH + .4)))) { basarabLamps.skippedStructure++; continue; }
            // an ordinary inferred lamp standing on this median gives way (Street View: the median carries the twin-arm lamps)
            for (let i = lamps.length - 1; i >= 0; i--) { const q = lamps[i]; if (q.osm === false && !q.arc && Math.hypot(q.x - x, q.z - z) < 16 && pointInPolygon(q.x, q.z, d.poly)) { lamps.splice(i, 1); basarabLamps.medianOrdinaryReplaced = (basarabLamps.medianOrdinaryReplaced || 0) + 1; } }
            twins.push([x, z]);
            for (const sg of [1, -1]) { const l = { x, z, y, h: MH, rot: Math.atan2(-e.nz * sg, e.nx * sg), osm: false, arc: true, twin: true }; lamps.push(l); lampGrid.insert(x, z, x, z, l); }
            propColl.push({ x, z, r: .2, hw: .2, hd: .2, angle: 0, poly: null, prop: true, kind: 'lamp', inferred: true, y, h: MH, top: y + MH, y0: y - .3, y1: y + MH });
            basarabLamps.medianTwin = (basarabLamps.medianTwin || 0) + 1;
        }
    }
    // street furniture from OSM (benches, bins, bollards, post boxes, hydrants, …) — never on a carriageway
    let furnCount = 0;
    {
        const F = data.furniture || [], K = data.furnKinds || [];
        const metal = rgb('#4b5563'), wood = rgb('#7a5534');
        for (let i = 0; i + 2 < F.length; i += 3) {
            const kind = K[F[i]], x = F[i + 1] / 10, z = F[i + 2] / 10;
            const R = { bench: 0.9, waste_basket: 0.3, bollard: 0.15, post_box: 0.35, bicycle_parking: 0.9, drinking_water: 0.25, fountain: 1.6, fire_hydrant: 0.2, recycling: 1.0, telephone: 0.5, vending_machine: 0.5, picnic_table: 1.0, advertising: 0.7 }[kind] ?? 0.4;
            if (onRibbon(x, z, R + 0.2) || buildingAt(x, z) || nearWater(x, z, R + 1.2)) continue;
            const ne = nearestEdge(x, z, null, 40); const ang = ne ? Math.atan2(ne.edge.dirx, ne.edge.dirz) : 0;
            const c = cellOf(x, z), sb = c.solid, v0f = sb.vc;
            switch (kind) {
                case 'bench': sb.box(x, 0.4, z, 0.5, 0.08, 1.7, ang, wood); sb.box(x, 0.15, z, 0.4, 0.25, 1.5, ang, metal); propColl.push({ x, z, hw: 0.3, hd: 0.85, angle: ang, r: 0.9, poly: null, h: 1, prop: true, kind }); break;
                case 'waste_basket': sb.box(x, 0.15, z, 0.4, 0.8, 0.4, ang, US ? rgb('#2f3a2f') : rgb('#3f6f4a')); addPropColl(x, z, 0.25, 'furniture'); break;
                case 'bollard': sb.box(x, 0.15, z, 0.16, 0.9, 0.16, ang, rgb('#3a3d42')); addPropColl(x, z, 0.12, 'furniture'); break;
                case 'post_box': sb.box(x, 0.15, z, 0.5, 1.15, 0.45, ang, US ? rgb('#1f4e9b') : rgb('#e3b021')); addPropColl(x, z, 0.3, 'furniture'); break;
                case 'fire_hydrant': sb.box(x, 0.15, z, 0.26, 0.7, 0.26, ang, US ? rgb('#c9a227') : rgb('#b91c1c')); addPropColl(x, z, 0.18, 'furniture'); break;
                case 'fountain': sb.geo(props().sphere, x, 0.12, z, 0, 1.6, 0.35, 1.6, rgb('#b8b1a3')); sb.box(x, 0.12, z, 0.4, 1.6, 0.4, 0, rgb('#a49c8c')); addPropColl(x, z, 1.5, 'furniture'); break;
                case 'recycling': sb.box(x, 0.15, z, 1.2, 1.4, 1.0, ang, rgb('#2f6b3f')); propColl.push({ x, z, hw: 0.6, hd: 0.5, angle: ang, r: 0.8, poly: null, h: 1.5, prop: true, kind }); break;
                case 'telephone': case 'vending_machine': sb.box(x, 0.15, z, 0.8, 2.0, 0.7, ang, kind === 'telephone' ? rgb('#9aa3ad') : rgb('#b91c1c')); addPropColl(x, z, 0.45, 'furniture'); break;
                case 'picnic_table': sb.box(x, 0.7, z, 0.8, 0.06, 1.8, ang, wood); sb.box(x, 0.4, z, 1.6, 0.05, 1.8, ang, wood); propColl.push({ x, z, hw: 0.8, hd: 0.9, angle: ang, r: 1.2, poly: null, h: 0.8, prop: true, kind }); break;
                case 'advertising': sb.box(x, 0.12, z, 1.1, 3.0, 1.1, ang + 0.4, rgb('#d9d4c4')); sb.box(x, 3.1, z, 1.3, 0.25, 1.3, ang + 0.4, rgb('#3f3f46')); addPropColl(x, z, 0.65, 'furniture'); break;
                case 'drinking_water': sb.box(x, 0.15, z, 0.3, 1.0, 0.3, ang, metal); addPropColl(x, z, 0.2, 'furniture'); break;
                case 'bicycle_parking': for (const o of [-0.6, 0, 0.6]) { const ox = Math.cos(ang) * o, oz = -Math.sin(ang) * o; sb.box(x + ox, 0.15, z + oz, 0.06, 0.75, 0.9, ang, metal); } propColl.push({ x, z, hw: 0.8, hd: 0.5, angle: ang, r: 0.95, poly: null, h: 0.8, prop: true, kind }); break;
                default: continue;
            }
            liftOnSide(c, v0f, null, x, z); // (on a raised sidewalk)
            furnCount++;
        }
    }
    // ---- Dâmbovița channel (note 11): quay wall, service bank, lower wall into the water, parapet + railing on the quay;
    //      cut where a street / bridge crosses (the decks stay at street level over the channel)
    let channelM = 0;
    for (const a of channelAreas) {
        const CHAN = a.chanProfile; // (shadows the model section with this polygon's own, see water-channel-review.js)
        const conc = rgb('#9c9890'), wet = rgb('#5d615a'), bankC = rgb('#86857c'), rail = rgb('#3d4246'), capC = rgb('#b3afa6');
        for (const ring of [a.outer, ...a.holes]) for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = -uz, nz = ux; // inward (toward the water) normal
            { const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (!isWater(mx + nx * 1.5, mz + nz * 1.5)) { nx = -nx; nz = -nz; } }
            const n = Math.max(1, Math.round(L / 4));
            for (let i = 0; i < n; i++) {
                const t0 = i / n * L, t1 = (i + 1) / n * L, P = (t, o, y) => [ax + ux * t + nx * o, y, az + uz * t + nz * o];
                const mx = ax + ux * (t0 + t1) / 2, mz = az + uz * (t0 + t1) / 2;
                if (onRibbon(mx, mz, 1.0) || onRibbon(mx + nx * 3, mz + nz * 3, 0.5)) continue; // a bridge / street over the channel
                if (tramGrades.excludesInferredObstacle([ax + ux * t0, az + uz * t0], [ax + ux * t1, az + uz * t1], { inferred: true, y0a: 0, y1a: 1.15, radiusM: .15, kind: 'channel-quay-inferred' })) continue;
                const sb = cellOf(mx, mz).solid, o1 = CHAN.slope, o2 = CHAN.slope + CHAN.bankW, toW = [nx, 0.4, nz];
                sb.face4(P(t0, 0, 0.02), P(t1, 0, 0.02), P(t1, o1, CHAN.bank), P(t0, o1, CHAN.bank), conc, toW);            // quay wall (battered)
                sb.face4(P(t0, o1, CHAN.bank), P(t1, o1, CHAN.bank), P(t1, o2, CHAN.bank), P(t0, o2, CHAN.bank), bankC, [0, 1, 0]); // service bank
                sb.face4(P(t0, o2, CHAN.bank), P(t1, o2, CHAN.bank), P(t1, o2, CHAN.water - 0.4), P(t0, o2, CHAN.water - 0.4), wet, [nx, 0, nz]); // lower wall, wet
                // (fidelity pass r2, Unirii (-900, 32)) the ground stopped 0.3-0.4 m short of the quay kerb: an open slot along the whole bank,
                // read from the street as a thin strip of water at pavement level. A coping strip closes it (districts only).
                if (distId) sb.face4(P(t0, -1.1, 0.03), P(t1, -1.1, 0.03), P(t1, 0, 0.03), P(t0, 0, 0.03), conc, [0, 1, 0]);
                const ang = Math.atan2(ux, uz), [rx, , rz] = P((t0 + t1) / 2, -0.15, 0);
                if (distId === 'unirii') {
                    // (fidelity pass, street-level look 2024: Splaiul Unirii / Splaiul Independenței at Piața Unirii) no solid
                    // parapet: a low stone kerb and a dark-green iron balustrade (posts ≈ 2 m apart, three rails, top at 1.05 m)
                    const iron = rgb('#27402f'), KH = 0.22;
                    sb.face4(P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, KH), P(t0, 0, KH), capC, [nx, 0, nz]);
                    sb.face4(P(t1, -0.3, 0), P(t0, -0.3, 0), P(t0, -0.3, KH), P(t1, -0.3, KH), capC, [-nx, 0, -nz]);
                    sb.face4(P(t0, -0.3, KH), P(t1, -0.3, KH), P(t1, 0, KH), P(t0, 0, KH), conc, [0, 1, 0]);
                    for (const [ry, rh] of [[1.0, 0.06], [0.66, 0.035], [0.34, 0.035]]) sb.box(rx, ry, rz, 0.05, rh, t1 - t0, ang, iron);
                    for (let t = t0 + 1; t < t1; t += 2) { const [px, , pz] = P(t, -0.15, 0); sb.box(px, KH, pz, 0.08, 0.86, 0.08, ang, iron); }
                } else {
                // parapet (0.75 m, 0.3 m thick) on the quay edge + a steel railing on top (posts every 2.5 m, top rail at 1.15 m)
                sb.face4(P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, 0.75), P(t0, 0, 0.75), capC, [nx, 0, nz]);
                sb.face4(P(t1, -0.3, 0), P(t0, -0.3, 0), P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), capC, [-nx, 0, -nz]);
                sb.face4(P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), P(t1, 0, 0.75), P(t0, 0, 0.75), conc, [0, 1, 0]);
                sb.box(rx, 1.1, rz, 0.05, 0.06, t1 - t0, ang, rail); sb.box(rx, 0.9, rz, 0.03, 0.03, t1 - t0, ang, rail);
                for (let t = t0 + 1.25; t < t1; t += 2.5) { const [px, , pz] = P(t, -0.15, 0); sb.box(px, 0.75, pz, 0.05, 0.4, 0.05, ang, rail); }
                }
                channelM += t1 - t0;
            }
        }
    }
    // ---- district edge closures (spec R10.9): a GTA-style closure set on every road cut at the boundary, sized to the
    //      road (small street / boulevard / highway) and local in style (RO: DRUM ÎNCHIS / LUCRĂRI / DEVIERE, red-white
    //      barriers, cones, jersey barriers, arrow boards, an excavator or a Poliția Rutieră car; US: ROAD CLOSED type III
    //      barricades, drums, DETOUR / LOCAL TRAFFIC ONLY, a flagger, ramp closed for bridge maintenance)
    const closures = [];
    await finishPendingRanges();
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
            const starts = new Map(closureBuilders().map(mb => [mb, mb.ic])), sourceScene = data.roadGeometryPolicy === 'source';
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
            for (const mb of closureBuilders()) if (mb.ic > (starts.get(mb) || 0))
                boundarySupport.applyMesh(mb, starts.get(mb) || 0, clipOptions);
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
    const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(), _ly = new THREE.Vector3(0, 1, 0);
    const fillLamps = (vx, vz, R) => {
        let n = 0, na = 0;
        lampGrid.each(vx - R, vz - R, vx + R, vz + R, (l) => {
            if (Math.abs(l.x - vx) > R || Math.abs(l.z - vz) > R || (l.arc ? na >= ARC_MAX : n >= LAMP_MAX)) return;
            const k = l.h / 8;
            _lm.compose(_lp.set(l.x, l.y, l.z), _lq.setFromAxisAngle(_ly, l.rot), _ls.set(k, k, k));
            if (l.arc) { arcPostMesh.setMatrixAt(na, _lm); arcHeadMesh.setMatrixAt(na, _lm); na++; }
            else { lampPostMesh.setMatrixAt(n, _lm); lampHeadMesh.setMatrixAt(n, _lm); n++; }
        });
        lampPostMesh.count = lampHeadMesh.count = n; arcPostMesh.count = arcHeadMesh.count = na;
        lampPostMesh.instanceMatrix.needsUpdate = true; lampHeadMesh.instanceMatrix.needsUpdate = true;
        arcPostMesh.instanceMatrix.needsUpdate = true; arcHeadMesh.instanceMatrix.needsUpdate = true;
    };
    void P;
    // parked cars on surface parking lots
    const carKinds = US ? ['suv', 'sedan', 'suv', 'hatch'] : ['hatch', 'sedan', 'hatch', 'suv'];
    // parked cars: vehicles.js `makeParkedCars` (low-detail ~250-tri parked models as one InstancedMesh per kind, per-car
    // colour), one group per 500 m super-cell (culling + few draw calls); full lots again (the 700 k cap is gone).
    // Fallback without it: merged low-LOD props, triangle-capped.
    const parkedLots = new Map(); // super-cell key → [{kind, color, x, y, z, yaw}]
    const parkingOverlap = parkingPolygonsOverlap;
    // Mapped lots can extend under the modeled pavement (the lot at the Rosetti
    // start does). Test the complete car, including intersections through its
    // edges, against sidewalk bands and junction corners; a clear centre is not
    // enough. Keep the source lot polygon and the remaining stalls in place.
    const parkingWalks = new BoxGrid(24);
    const addParkingWalk = (p) => parkingWalks.insert(Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1])), p);
    if (realPass) {
        for (const e of edges) if (raisedEdge(e)) for (const sd of [1, -1]) {
            if (!raisedEdge(e, sd)) continue;
            const wi = widthAsphalt(e, sd) + 0.02, wo = widthAsphalt(e, sd) + sidewalkWidth(e, sd) + SIDE_BACK;
            addParkingWalk([[e.a.x + e.nx * wi * sd, e.a.z + e.nz * wi * sd], [e.b.x + e.nx * wi * sd, e.b.z + e.nz * wi * sd], [e.b.x + e.nx * wo * sd, e.b.z + e.nz * wo * sd], [e.a.x + e.nx * wo * sd, e.a.z + e.nz * wo * sd]]);
        }
        for (const cp of cornerPolys) addParkingWalk(cp.p);
    }
    const parkingFits = (a, fp) => fp.every(([x, z]) => inArea(a, x, z)) && !polysCross(fp, a.outer) && !a.holes.some(h => parkingOverlap(fp, h));
    const parkingOnWalk = (fp) => {
        let hit = false;
        parkingWalks.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), p => { if (!hit && parkingOverlap(fp, p)) hit = true; });
        return hit;
    };
    const parkingOnBuilding = fp => {
        let hit = false;
        bGrid.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), b => {
            if (hit || b.skip && data.buildingGeometryPolicy !== 'source') return;
            hit = parkingBodyOverlap(fp, { outer: b.ring, holes: b.holes, minHeightM: b.minH, maxHeightM: b.h });
        });
        return hit;
    };
    const parkingSupports = new BoxGrid(24);
    for (const c of propColl) if (c.kind === 'canopy-support') {
        const p = c.poly || obbPoly(c);
        parkingSupports.insert(Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1])), p);
    }
    const parkingOnSupport = fp => {
        let hit = false;
        parkingSupports.each(Math.min(...fp.map(q => q[0])), Math.min(...fp.map(q => q[1])), Math.max(...fp.map(q => q[0])), Math.max(...fp.map(q => q[1])), p => { if (!hit && parkingOverlap(fp, p)) hit = true; });
        return hit;
    };
    // (2026-11-08, owner: cars parked across a CV stop's glowing door ring) no parked car within 7 m of a stop's door
    const stopDoors = pois.filter(p => p.interactive && p.doorX !== undefined), nearDoor = (x, z) => stopDoors.some(p => Math.hypot(p.doorX - x, p.doorZ - z) < 7);
    const useInst = typeof makeParkedCars === 'function';
    const carTris = useInst ? 260 : carKinds.reduce((s2, k) => { const pr = carProps(k, CAR_COLORS[0]); return s2 + (pr.index ? pr.index.length / 3 : 772); }, 0) / carKinds.length;
    const parkingClearance = { candidates: 0, retained: 0, outsideSourceLot: 0, raisedSidewalk: 0, buildingBody: 0, canopySupport: 0, measuredLots: [] };
    let parked = 0, lotSeeds = 0; const maxParked = Math.round(Math.min(city.id === 'bucharest' ? 2600 : 2000, 195000 / Math.max(1, carTris)));
    for (const a of areas) {
        if (a.kind !== 'parking' || lotSeeds >= maxParked || a.size < 120) continue;
        // orientation: longest edge
        let best = 0, ang = 0;
        for (let k = 0; k < a.outer.length; k++) { const [ax, az] = a.outer[k], [bx, bz] = a.outer[(k + 1) % a.outer.length]; const L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ang = Math.atan2(bx - ax, bz - az); } }
        const measured = a.parkingLayout?.sourceId === a.sourceId ? resolveParkingLayout(a.parkingLayout, a.parkingLayout.sourceTags).layout : null;
        if (measured) parkingClearance.measuredLots.push(a.sourceId);
        if (measured) ang = parkingRowPose(measured, 0).rowYaw;
        const ux = Math.sin(ang), uz = Math.cos(ang), vx = uz, vz = -ux; // u along rows, v across
        const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, R = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / 2;
        let lotCount = 0;
        // (2026-11-08) lots in the scenery ring outside the playable area (reality-pass districts): a light fill, frame budget
        const lotFill = realPass && dmask && !dmask.at(cx, cz) ? 0.22 : 0.72, lotMax = realPass ? 45 : 80;
        for (let v = -R, row = 0; v < R; row++) {
            const measuredRow = measured ? parkingRowPose(measured, row) : null;
            for (let u = -R; u < R; u += measuredRow?.stallPitchM || 2.6) {
                const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
                if (!inArea(a, x, z) || !inArea(a, x + vx * 2.6, z + vz * 2.6) || !inArea(a, x - vx * 2.6, z - vz * 2.6)) continue;
                if (!rng.chance(lotFill) || (buildingAt(x, z)?.minH ?? Infinity) <= 2.1 || nearWater(x, z, 3.5) || nearDoor(x, z)) continue; // (never on a channel quay slope / in water)
                const rot = measuredRow?.stallYaw ?? (ang + (row % 2 ? 0 : Math.PI) + Math.PI / 2);
                const box = { x, z, hw: 0.95, hd: 2.3, angle: rot, r: 2.5, poly: null, h: 1.5, prop: true, kind: 'parked', parkingSourceId: a.sourceId, parkingAreaIndex: a.areaIndex };
                if (polyOnRibbon(obbPoly({ ...box, hw: 1.3, hd: 2.7 })) || [-1.6, 0, 1.6].some(o => onRibbon(x + Math.sin(rot) * o, z + Math.cos(rot) * o, 1.2))) continue; // keep off any carriageway / lane strip
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                // Consume the original seed and paint choices even when rejected:
                // removing an obstructing car must not shuffle the valid stalls.
                lotSeeds++; lotCount++;
                const size = vehicleSize(kind, city.id);
                box.hw = Math.max(box.hw, size.width / 2); box.hd = Math.max(box.hd, size.length / 2); box.r = Math.hypot(box.hw, box.hd);
                const fp = obbPoly({ ...box, hw: box.hw + 0.1, hd: box.hd + 0.1 });
                parkingClearance.candidates++;
                const fits = parkingFits(a, fp), walk = fits && parkingOnWalk(fp), body = fits && !walk && parkingOnBuilding(fp), support = fits && !walk && !body && parkingOnSupport(fp);
                if (!fits) parkingClearance.outsideSourceLot++;
                else if (walk) parkingClearance.raisedSidewalk++;
                else if (body) parkingClearance.buildingBody++;
                else if (support) parkingClearance.canopySupport++;
                else {
                    if (useInst) { const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []); L.push({ kind, color: col, x, y: 0.12, z, yaw: rot }); }
                    else cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, rot, 1, 1, 1, [255, 255, 255]);
                    propColl.push(box); parked++;
                    parkingClearance.retained++;
                }
                if (lotSeeds >= maxParked || lotCount > lotMax) break;
            }
            if (lotSeeds >= maxParked || lotCount > lotMax) break;
            v += row % 2 ? 7.5 : 5.2; // two rows back to back, then an aisle
        }
    }

    // -----------------------------------------------------------------------
    //  TRAFFIC LIGHTS (static poles + instanced lit lamps)
    // -----------------------------------------------------------------------
    const lights = [];
    const lampList = [];
    for (const n of nodeArr) {
        if (!n.hasLight || !n.edges.length) continue;
        const cl = n.lightCluster;
        const approaches = [];
        for (const e of n.edges) {
            const atA = e.a === n;
            if (atA && e.oneway) continue; // traffic only leaves the node on this edge
            const out = atA ? 1 : -1;
            const dx = e.dirx * out, dz = e.dirz * out; // pointing away from the node along the edge
            const rx = dz, rz = -dx; // right-hand side of the incoming travel direction (-d)
            const w = (atA ? e.wL : e.wR) + shoulderOf(e) + 0.9;
            const r = retract(e, n) + 1.2;
            let px = n.x + dx * r + rx * w, pz = n.z + dz * r + rz * w;
            const poleBlocked = () => onRibbon(px, pz, 0.3) || !!tramSweep?.circle(px, pz, 0.2, 0, 3);
            for (let k = 0; k < 5 && poleBlocked(); k++) { px += rx * 0.7; pz += rz * 0.7; } // never in another approach's carriageway or in a tram's swept body
            const noPole = !!poleBlocked(); // no room for a pole: the approach keeps its phase, no pole is drawn
            const c = cellOf(px, pz);
            const rot = Math.atan2(-dz, dx); // housing local +x faces along +d (toward incoming cars)
            const tly = 0.15 + n.y + (raisedTop(px, pz, 0.3) !== null ? DY_SIDE : 0); // (on a raised corner)
            if (!noPole) { c.solid.geo(P.tlight, px, tly, pz, rot, 1, 1, 1, [255, 255, 255]); addPropColl(px, pz, 0.2, 'tlight'); }
            const ap = { edge: e, node: n, x: px + dx * 0.36, z: pz + dz * 0.36, y: noPole ? -200 : tly, state: null, lamp: lampList.length, lamps: null, noPole };
            lampList.push(ap);
            approaches.push(ap);
        }
        if (approaches.length) lights.push({ node: n, approaches, offset: cl.offset });
    }
    for (const cl of clusters.values()) cl.phaseCount = assignSignalPhases(lights.filter(l => l.node.lightCluster === cl).flatMap(l => l.approaches));
    const nodeLight = {};
    for (const l of lights) nodeLight[l.node.id] = l;
    const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), Math.max(1, lampList.length));
    lampMesh.count = lampList.length;
    lampMesh.frustumCulled = false;
    lampMesh.name = 'trafficLamps';
    const LAMP_COL = { red: new THREE.Color('#ff3b30').multiplyScalar(1.6), yellow: new THREE.Color('#ffcc00').multiplyScalar(1.6), green: new THREE.Color('#34c759').multiplyScalar(1.6) };
    const LAMP_Y = { red: 4.5, yellow: 4.12, green: 3.74 };
    const tmpM = new THREE.Matrix4();
    for (const ap of lampList) { tmpM.makeTranslation(ap.x, ap.y + 4.5, ap.z); lampMesh.setMatrixAt(ap.lamp, tmpM); lampMesh.setColorAt(ap.lamp, LAMP_COL.red); }
    group.add(lampMesh);

    // -----------------------------------------------------------------------
    //  MESHES
    // -----------------------------------------------------------------------
    setProgress('Finishing…'); await tick();
    const atlas = earlyAtlas ? earlyAtlas.atlas : makeAtlas();
    const solidMat = solidMaterial(atlas, earlyAtlas?.night);
    // shop light spill: additive, black diffuse + warm emissive with a falloff away from the window; render eases
    // emissiveIntensity 0 → nightEmissive at dusk (0 by day: adds nothing); dimmed as shops close (uClosed)
    const spillMat = (() => {
        const g = makeCanvasTexture(4, 64, (ctx, w, h) => { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#6a6a6a'); gr.addColorStop(1, '#000000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); });
        g.colorSpace = THREE.NoColorSpace;
        const m = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color('#ffc890'), emissiveMap: g, emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12, fog: true });
        m.userData.nightEmissive = 0.3; m.name = 'shop-spill';
        m.onBeforeCompile = (sh) => { sh.uniforms.uClosed = solidMat.userData.uClosed; sh.fragmentShader = 'uniform float uClosed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= 1.0 - 0.8 * uClosed;'); };
        return m;
    })();
    const noise = noiseTexture();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise });
    if (!underpassCover.empty) {
        const material = new THREE.MeshBasicMaterial({ colorWrite: UNDERPASS_COVER_POLICY.colorWrite, depthWrite: UNDERPASS_COVER_POLICY.depthWrite, depthTest: UNDERPASS_COVER_POLICY.depthTest });
        material.name = 'underpass-earth-cover';
        const mesh = new THREE.Mesh(underpassCover.build(), material);
        mesh.name = 'underpass-earth-cover'; mesh.renderOrder = UNDERPASS_COVER_POLICY.renderOrder;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.castShadow = mesh.receiveShadow = false;
        group.add(mesh);
    }
    // strict layering (spec R11.2): ground/sidewalks (0) < carriageways (-1) < junction pads (-2) < markings (-4); each also has
    // its own renderOrder, so coplanar pieces resolve the same way every frame (no z-fighting / flicker)
    const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); roadMat.name = 'road';
    const padMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); padMat.name = 'junction';
    const marksMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); marksMat.name = 'markings';
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
    const sportMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: true, depthFunc: THREE.AlwaysDepth }); sportMat.name = 'sport-ground'; // (own weather: a dusting, not buried like a lawn)
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true }); roofMat.name = 'roofs';
    const backdropMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas, emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 0 }); backdropMat.name = 'backdrop';
    // (after round 6) the distant city keeps its lights on at night: a procedural window grid on the walls (≈ 38 % lit,
    // warm, per-window brightness), averaged into an even glow where the cells get sub-pixel (no shimmer); render.js eases
    // emissiveIntensity to userData.nightEmissive at night
    backdropMat.userData.nightEmissive = 0.9;
    backdropMat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
            // facade atlas on the walls only: a roof is plain (no windows on top of the boxes), a touch darker
            if (abs(vBN.y) < 0.5) diffuseColor *= texture2D(map, vMapUv); else diffuseColor.rgb *= 0.62;
        #endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {   float wall = 1.0 - smoothstep(0.3, 0.6, abs(vBN.y));
            vec2 tg = normalize(vec2(-vBN.z, vBN.x) + 1e-5);
            vec2 cell = vec2(dot(vBW.xz, tg), vBW.y - 1.0) / vec2(3.2, 3.0);
            vec2 id = floor(cell), f = fract(cell);
            float h = fract(sin(dot(id + floor(vBW.xz * 0.03) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.82);
            float lit = step(h, 0.38) * (0.6 + 0.8 * fract(h * 37.0));
            float fw = length(fwidth(cell));
            float m = mix(win * lit, 0.31 * 0.38, smoothstep(0.35, 0.9, fw));
            totalEmissiveRadiance *= wall * m * step(0.0, cell.y); }`);
    };
    backdropMat.customProgramCacheKey = () => 'backdrop-night2';
    const signTex = signs.textures();
    // (owner L23 / #25: a facade sign flickering) a sign stands 0.14 m off its wall; with the 0.2 m near plane the depth
    // buffer cannot hold 0.14 m apart beyond about 600 m (drone views), so the wall and the sign fought. A small polygon
    // offset keeps the sign in front of its wall at any distance, as road markings over the asphalt
    const signMats = signTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: '#e8e8e8', alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    // ---- front-garden boundaries (district worlds, Bucharest, 2026-11-08): along residential streets the property line
    //      behind the sidewalk is a railing on a low plinth, a plastered wall or a hedge (one kind per stretch, a gate /
    //      driveway gap every 15–35 m), wherever a garden lies between the sidewalk and the house. Visual only (no
    //      collision: pedestrians keep their sidewalk lines).
    let fenceM = 0;
    if (realPass && !US) {
        const fRng = makeRng(7331);
        const kindsF = [['rail', '#2f3a33'], ['rail', '#1f2326'], ['rail', '#4a4f55'], ['wall', '#d8cfbf'], ['wall', '#c9c2b4'], ['wall', '#e6dfd2'], ['rail', '#26292c'], ['wall', '#bfb8aa'], ['hedge', '#355e2e'], ['rail', '#3b4a3f'], ['rail', '#5a4a3c']];
        const plinth = rgb('#b8b2a6');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 16 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(residential|unclassified|living_street|tertiary)$/.test(e.type) || e.sidewalk < 1.2) continue;
            for (const sd of [1, -1]) {
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + e.sidewalk + 0.12;
                const s0 = retract(e, e.a) + 4, s1 = e.len - retract(e, e.b) - 4; if (s1 - s0 < 6) continue;
                let run = null;
                // (2026-11-08, owner: "some of these fences don't make sense and they are not continuous") one boundary per plot,
                // chosen from the building behind it: apartment blocks keep open lawns (none, or a low railing); villas a
                // railing on a plinth, a plastered wall topped by a railing, a hedge, rarely a solid wall. No random gaps.
                const plotOf = (x, z) => { const ix = x + e.nx * sd * 7, iz = z + e.nz * sd * 7; let best = null, bd = 22;
                    bGrid.each(ix - 22, iz - 22, ix + 22, iz + 22, (b) => { if (b.skip || b.area < 25) return; const d2 = polyDist(ix, iz, b.ring); if (d2 < bd) { bd = d2; best = b; } }); return best; };
                const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }; // (deterministic per building)
                const kindOf = (b) => { if (!b) return null; const hh = hash01(b.i * 7919 + 17);
                    if (b.style === 'bloc' || b.h > 10.5 || b.area > 450) return hh < 0.55 ? null : ['low', '#2f3a33'];
                    const tone = ['#2f3a33', '#1f2326', '#4a4f55', '#26292c'][Math.floor(hash01(b.i * 104729 + 3) * 4)], plaster = ['#d8cfbf', '#c9c2b4', '#e6dfd2', '#bfb8aa'][Math.floor(hash01(b.i * 1299709 + 5) * 4)];
                    return hh < 0.5 ? ['rail', tone] : hh < 0.72 ? ['hedge', '#355e2e'] : hh < 0.92 ? ['wallrail', plaster, tone] : ['wall', plaster]; };
                let curPlot = undefined;
                const ok = (sAl) => {
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.3) || buildingAt(x, z) || nearWater(x, z, 0.5)) return null;
                    if (fenceSegs.some(([ax, az, bx, bz]) => Math.abs(ax - x) < 12 && Math.abs(az - z) < 12 && distPointSeg(x, z, ax, az, bx, bz).d < 4)) return null; // (a landmark's own fence is there)
                    // Empty space alone is not evidence of a private garden: museums,
                    // civic forecourts and parks must not acquire invented perimeter walls.
                    const ix = x + e.nx * sd * 1.5, iz = z + e.nz * sd * 1.5; if (buildingAt(ix, iz)) return null;
                    if (isPark(ix, iz)) return null;
                    let home = null;
                    for (const depth of [3, 6, 10, 16, 24, 32]) {
                        const b = buildingAt(x + e.nx * sd * depth, z + e.nz * sd * depth);
                        if (b) { home = b; break; }
                    }
                    if (!home || home.name || (home.flags & 1) || home.h > 20 || !/^(house|interwar|eclectic|bloc)$/.test(home.style)) return null;
                    return [x, z];
                };
                const flushRun = () => {
                    if (!run || run.pts.length < 2) { run = null; return; }
                    const [k, hex] = run.kind, col = rgb(hex), pts = run.pts;
                    // (2026-11-08, owner: "some of them end abruptly") no stubs under 6 m; railings / walls end on a pier
                    let runL = 0; for (let i = 0; i < pts.length - 1; i++) runL += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
                    if (runL < 6) { run = null; return; }
                    if (k !== 'hedge') for (const q of [pts[0], pts[pts.length - 1]]) { const cq = cellOf(q[0], q[1]), v0 = cq.solid.vc; cq.solid.box(q[0], Y.side, q[1], k === 'low' ? 0.12 : 0.42, k === 'low' ? 0.8 : 1.75, k === 'low' ? 0.12 : 0.42, 0, k === 'wall' || k === 'wallrail' ? shadeRgb(col, 0.95) : k === 'low' ? col : rgb('#cfc8b8')); liftOnSide(cq, v0, null, q[0], q[1], 0.6); }
                    for (let i = 0; i < pts.length - 1; i++) {
                        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                        const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), v0s = c.solid.vc, v0d = c.detail.vc;
                        if (k === 'wall') { c.solid.box(mx, Y.side, mz, 0.22, 1.6, L + 0.02, ang, col); c.solid.box(mx, Y.side + 1.6, mz, 0.3, 0.07, L + 0.02, ang, shadeRgb(col, 0.82)); }
                        else if (k === 'low') { // a low railing round a block's lawn: two rails on posts
                            c.solid.box(mx, Y.side, mz, 0.12, 0.1, L + 0.02, ang, plinth);
                            c.detail.box(mx, Y.side + 0.68, mz, 0.04, 0.04, L, ang, col); c.detail.box(mx, Y.side + 0.35, mz, 0.03, 0.03, L, ang, col);
                            c.detail.box(ax, Y.side, az, 0.05, 0.72, 0.05, ang, col); }
                        else if (k === 'wallrail') { // a plastered wall with a coping, an iron railing on top, piers every few metres
                            const rc = rgb(run.kind[2] || '#26292c');
                            c.solid.box(mx, Y.side, mz, 0.3, 0.9, L + 0.02, ang, col); c.solid.box(mx, Y.side + 0.9, mz, 0.36, 0.06, L + 0.02, ang, shadeRgb(col, 0.85));
                            c.solid.box(mx, Y.side + 1.58, mz, 0.04, 0.04, L, ang, rc);
                            const nP = Math.max(1, Math.round(L / 0.18)), ux = (bx - ax) / L, uz = (bz - az) / L, pnx = -uz, pnz = ux;
                            for (let j = 1; j < nP; j++) { const f = j / nP, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
                                c.detail.wall(px - ux * 0.012, pz - uz * 0.012, px + ux * 0.012, pz + uz * 0.012, Y.side + 0.96, Y.side + 1.6, pnx, pnz, rc);
                                c.detail.wall(px + ux * 0.012, pz + uz * 0.012, px - ux * 0.012, pz - uz * 0.012, Y.side + 0.96, Y.side + 1.6, -pnx, -pnz, rc); }
                            if (i % 2 === 0) c.solid.box(ax, Y.side, az, 0.42, 1.75, 0.42, ang, shadeRgb(col, 0.95)); }
                        else if (k === 'hedge') { // a clipped hedge: uneven, rounded top, mottled greens (a flat green box read as a painted fence)
                            const ux = (bx - ax) / L, uz = (bz - az) / L, n2 = Math.max(1, Math.round(L / 0.9));
                            for (let j = 0; j < n2; j++) { const f = (j + 0.5) / n2, px = ax + (bx - ax) * f, pz = az + (bz - az) * f, hh2 = 1.25 + fRng() * 0.35, ww = 0.75 + fRng() * 0.25;
                                const g = shadeRgb(col, 0.8 + fRng() * 0.35); c.solid.box(px, Y.side, pz, ww, hh2, L / n2 + 0.2, ang, g);
                                c.solid.geo(props().sphere, px, Y.side + hh2 - 0.05, pz, ang, ww * 0.55, 0.28, L / n2 * 0.65 + 0.15, shadeRgb(g, 1.12)); }
                        }
                        else { // railing: plinth, two rails, posts every ~2 m and pickets as thin boxes (near LOD)
                            c.solid.box(mx, Y.side, mz, 0.26, 0.45, L + 0.02, ang, plinth);
                            c.solid.box(mx, Y.side + 1.55, mz, 0.05, 0.05, L, ang, col); c.detail.box(mx, Y.side + 0.62, mz, 0.04, 0.04, L, ang, col);
                            c.detail.box(ax, Y.side + 0.45, az, 0.08, 1.2, 0.08, ang, col);
                            // pickets: a 3 cm strip seen from both sides every 25 cm (4 triangles each, near LOD)
                            const nP = Math.max(1, Math.round(L / 0.25)), ux = (bx - ax) / L, uz = (bz - az) / L, pnx = -uz, pnz = ux;
                            for (let j = 1; j < nP; j++) { const f = j / nP, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
                                c.detail.wall(px - ux * 0.015, pz - uz * 0.015, px + ux * 0.015, pz + uz * 0.015, Y.side + 0.45, Y.side + 1.57, pnx, pnz, col);
                                c.detail.wall(px + ux * 0.015, pz + uz * 0.015, px - ux * 0.015, pz - uz * 0.015, Y.side + 0.45, Y.side + 1.57, -pnx, -pnz, col); }
                        }
                        liftOnSide(c, v0s, v0d, mx, mz, 0.6); // (on the raised sidewalk's back edge)
                        // (2026-11-08, owner: "I shouldn't be able to drive into this") solid: walls, hedges and railings collide
                        { const hwC = k === 'hedge' ? 0.45 : 0.15; propColl.push({ x: mx, z: mz, hw: hwC, hd: L / 2 + 0.05, angle: ang, r: Math.hypot(hwC, L / 2 + 0.05), poly: null, h: k === 'low' ? 0.8 : k === 'hedge' ? 1.5 : 1.7, prop: true, kind: 'fence' }); }
                        fenceM += L;
                    }
                    run = null;
                };
                for (let sAl = s0; sAl <= s1; sAl += 2) {
                    const p = ok(sAl);
                    if (!p) { flushRun(); curPlot = undefined; continue; }
                    const pl = plotOf(p[0], p[1]);
                    if (pl !== curPlot) { if (run) { run.pts.push(p); flushRun(); } curPlot = pl; } // (the next plot's boundary starts where this one ends: continuous)
                    const kind = kindOf(pl); if (!kind) { flushRun(); continue; }
                    if (!run) run = { kind, pts: [] };
                    run.pts.push(p);
                }
                flushRun();
            }
        }
    }
    // ---- kerb bollards (district worlds, Bucharest, 2026-11-08): the anti-parking posts that line the kerbs of the main
    //      streets wherever parking is not allowed (OSM parking:<side>=no; untagged sides of every other main street), with
    //      gaps at junctions, crossings and driveways. Visual only (near LOD).
    let bollards = 0;
    if (realPass && !US) {
        const RI = data.roadInfo || [], bc = rgb('#3a3d42'), cap = rgb('#b9b9b4');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 14 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(primary|secondary|tertiary)$/.test(e.type) || e.sidewalk < 1.5) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            for (const sd of [1, -1]) {
                if (sidewalkWidth(e, sd) < 1.5) continue;
                const yes = sd > 0 ? (rf & 64) : (rf & 128), no = sd > 0 ? (rf & 256) : (rf & 512);
                if (yes || (!no && ((e.road * 31 + (sd > 0 ? 7 : 3)) % 2))) continue;
                const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + 0.35;
                const s0 = retract(e, e.a) + 3 + (e.a.crossing ? 5 : 0), s1 = e.len - retract(e, e.b) - 3 - (e.b.crossing ? 5 : 0);
                let gapAt = s0 + 25 + ((e.id * 13) % 20);
                for (let sAl = s0; sAl < s1; sAl += 2.2) {
                    if (sAl > gapAt) { sAl += 4; gapAt = sAl + 25 + ((e.id * 7 + Math.round(sAl)) % 25); continue; } // (a driveway / gate)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.15) || buildingAt(x, z)) continue;
                    if (sweptOut('bollard', tramSweep?.circle(x, z, .1, 0, 3))) continue; // (a generated row; its collider spans 0-3 m)
                    const c = cellOf(x, z), v0d = c.detail.vc; c.detail.box(x, Y.side, z, 0.11, 0.85, 0.11, 0, bc); c.detail.box(x, Y.side + 0.85, z, 0.13, 0.05, 0.13, 0, cap); bollards++;
                    liftOnSide(c, c.solid.vc, v0d, x, z);
                    addPropColl(x, z, 0.1, 'bollard'); // (owner: "I can drive through this") solid, like the OSM bollards
                }
            }
        }
    }
    // scenery streets (district worlds, 2026-11-08): the real streets of the ring of buildings outside the playable area
    // (data.scenery from build-data: carriageway width, sidewalk, class, flags, polyline) as flat asphalt + sidewalk strips,
    // below the drivable ribbons (no traffic, no markings beyond a centre dash on two-way main streets)
    let sceneryStreets = 0;
    const scenerySourceAudit = { precisePieces: 0, literalWidthPieces: 0, reviewedWidthPieces: 0, estimatedWidthPieces: 0, fallbackPieces: 0, resolvedWidths: [], issues: [] };
    {
        const SC = data.scenery || [], asp = rgb(ASPHALT), side = rgb(US ? '#a4a29d' : '#9d9a92'), dash = rgb('#cfcfca');
        const sourceProfiles = SC.map((r, i) => scenerySourceProfile(data, i, undelta(r, 4)));
        const bridgeProfiles = sceneryBridgeProfiles(data, sourceProfiles, edges);
        scenerySourceAudit.bridges = bridgeProfiles.stats;
        const yA = Y.side + 0.05, yS = Y.side + 0.03;
        const strip = (pts, l0, l1, y, col, heights = null, covered = null) => {
            for (let i = 0; i < pts.length - 1; i++) {
                if (covered?.[i]) continue;
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < (heights ? 1e-6 : 0.2)) continue;
                // mitred offsets at the joints
                const nrm = (k) => { const [px, pz] = pts[Math.max(0, k - 1)], [qx, qz] = pts[Math.min(pts.length - 1, k + 1)]; const l = Math.hypot(qx - px, qz - pz) || 1; return [-(qz - pz) / l, (qx - px) / l]; };
                const [n0x, n0z] = nrm(i), [n1x, n1z] = nrm(i + 1);
                const c = cellOf((ax + bx) / 2, (az + bz) / 2);
                if (heights) c.ground.face4([ax + n0x * l0, y + heights[i], az + n0z * l0], [bx + n1x * l0, y + heights[i + 1], bz + n1z * l0], [bx + n1x * l1, y + heights[i + 1], bz + n1z * l1], [ax + n0x * l1, y + heights[i], az + n0z * l1], col, [0, 1, 0]);
                else c.ground.flatQuad(ax + n0x * l0, az + n0z * l0, bx + n1x * l0, bz + n1z * l0, bx + n1x * l1, bz + n1z * l1, ax + n0x * l1, az + n0z * l1, y, col);
            }
        };
        for (const [ri, r] of SC.entries()) {
            const sw = r[1] / 10, cls = data.classes[r[2]] || 'residential', fl = r[3];
            if ((fl & 1) && data.roadGeometryPolicy !== 'source') continue; // legacy ring behaviour
            const profile = sourceProfiles[ri], bridge = bridgeProfiles.profiles.get(ri), pts = bridge?.points || profile.points, wC = profile.widthM, heights = bridge?.heights;
            if (pts.length < 2) continue;
            scenerySourceAudit[profile.precise ? 'precisePieces' : 'fallbackPieces']++;
            scenerySourceAudit[profile.widthSource === 'OSM width' ? 'literalWidthPieces' : profile.review ? 'reviewedWidthPieces' : 'estimatedWidthPieces']++;
            if (profile.rawWidth || profile.review) scenerySourceAudit.resolvedWidths.push({ piece: ri, sourceId: profile.sourceId, widthM: profile.widthM, leftM: profile.leftM, rightM: profile.rightM, widthSource: profile.widthSource, rawWidth: profile.rawWidth, review: profile.review });
            if (profile.issue) scenerySourceAudit.issues.push({ piece: ri, sourceId: profile.sourceId, reason: profile.issue });
            strip(pts, -profile.leftM, profile.rightM, bridge ? Y.road : yA, asp, heights, bridge?.coveredSegments);
            const sideM = sw > 0.5 && !/service|motorway/.test(cls) ? Math.max(1.2, sw) : 0;
            // (owner, 2026-11-12, Bd. Unirii east: the fountain median was a slab of paving) one carriageway of a divided street
            // has its pavement on the outer side only (OSM oneway=yes + sidewalk=right|left): the median side gets none, so the
            // median shows its mapped grass instead of two pavements meeting in the middle
            const swTags = data.scenerySourceGeometry?.[ri]?.tags, divided = swTags?.oneway === 'yes' && /^(left|right)$/.test(swTags.sidewalk || '');
            const sideL = divided && swTags.sidewalk === 'right' ? 0 : sideM, sideR = divided && swTags.sidewalk === 'left' ? 0 : sideM;
            if (sideR) strip(pts, profile.rightM, profile.rightM + sideR, bridge ? Y.road : yS, side, heights, bridge?.coveredSegments);
            if (sideL) strip(pts, -profile.leftM - sideL, -profile.leftM, bridge ? Y.road : yS, side, heights, bridge?.coveredSegments);
            if (/primary|secondary|tertiary/.test(cls) && wC > 6) { // dashed centre line
                for (let i = 0; i < pts.length - 1; i++) { if (bridge?.coveredSegments[i]) continue; const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 1; d + 3 < L; d += 9) { const f0 = d / L, f1 = (d + 3) / L; strip([[ax + (bx - ax) * f0, az + (bz - az) * f0], [ax + (bx - ax) * f1, az + (bz - az) * f1]], profile.lineOffsetM - 0.07, profile.lineOffsetM + 0.07, (bridge ? Y.road : yA) + 0.005, dash, heights ? [heights[i] + (heights[i + 1] - heights[i]) * f0, heights[i] + (heights[i + 1] - heights[i]) * f1] : null); } }
            }
            if (bridge) for (let i = 1; i < pts.length; i++) {
                if (bridge.coveredSegments[i - 1]) continue;
                const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-6) continue;
                const nrm = k => { const p = pts[Math.max(0, k - 1)], q = pts[Math.min(pts.length - 1, k + 1)], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / L, (q[0] - p[0]) / L]; };
                const n0 = nrm(i - 1), n1 = nrm(i), left = profile.leftM + sideL, right = profile.rightM + sideR;
                const poly = [[a[0] - n0[0] * left, a[1] - n0[1] * left], [b[0] - n1[0] * left, b[1] - n1[1] * left], [b[0] + n1[0] * right, b[1] + n1[1] * right], [a[0] + n0[0] * right, a[1] + n0[1] * right]];
                const band = sceneryDeckBand(a, b, heights[i - 1], heights[i], bridge.thicknessM), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
                const top = [band(...a).top, band(...b).top], bottom = top.map(h => h - bridge.thicknessM), c = cellOf(x, z);
                const vertices = poly.map((p, j) => [p[0], top[j === 0 || j === 3 ? 0 : 1], p[1]]);
                if (bridge.bridge || Math.max(...heights.slice(i - 1, i + 1)) > .05) {
                    for (let j = 0; j < 4; j++) { const k = (j + 1) % 4, lo = v => [v[0], v[1] - bridge.thicknessM, v[2]], outward = [poly[k][1] - poly[j][1], 0, poly[j][0] - poly[k][0]]; c.solid.face4(lo(vertices[j]), lo(vertices[k]), vertices[k], vertices[j], rgb('#99968e'), outward); }
                    c.solid.face4(...vertices.map(v => [v[0], v[1] - bridge.thicknessM, v[2]]), rgb('#55524d'), [0, -1, 0]);
                }
                const deck = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, kind: 'scenery-road-deck', sourceId: bridge.sourceId, sourceTags: bridge.tags, access: bridge.access, estimated: true, elevationSource: bridge.elevationSource, y0: Math.min(...bottom), y1: Math.max(...top), h: Math.max(...top), roofHeightAt: (px, pz, radius) => band(px, pz, radius).top, minHeightAt: (px, pz, radius) => band(px, pz, radius).bottom };
                sceneryDeckGrid.insert(x - deck.r, z - deck.r, x + deck.r, z + deck.r, deck); propColl.push(deck);
            }
            sceneryStreets++;
        }
    }
    // low-poly backdrop: building masses beyond the corridors (so the horizon is not empty)
    let backdropCount = 0;
    const backdropSourceOwnership = [];
    const builtLandmarks = new Set(landmarks.map(lm => lm.id));
    // (owner register #31 / L25, Unirii: blank blocks in front of the Palace of the Parliament, "buildings inside distant
    // landmarks") backdrop and horizon masses are anonymous filler: none stands inside the grounds of a built landmark
    const landmarkDiscs = landmarks.filter(l => l.radius > 0 && !LANDMARKS.find(m => m.id === l.id)?.backdrop).map(l => ({ x: l.x, z: l.z, r: l.radius }));
    const inLandmarkGrounds = (x, z, w, d) => landmarkDiscs.some(L => Math.hypot(x - L.x, z - L.z) < L.r + Math.hypot(w, d) / 2);
    let backdropInLandmark = 0;
    const backdropBindings = LANDMARKS.filter(lm => builtLandmarks.has(lm.id)).flatMap(lm =>
        (lm.backdropSources?.[distId] || []).map(record => ({...record, landmark:lm.id, declaredSourceIds:lm.sourceIds || []})));
    const ringGeometry = data.district?.geometry || (distCfg?.bands ? {
        pieces: distCfg.bands.map(b => ({ r: b.r, ring: b.sceneryRing !== false, pts: b.line.map(([lat, lon]) => { const p = city.proj(lat, lon); return [p.x, p.z]; }) })),
        circles: (distCfg.circles || []).map(c => ({ ...city.proj(c.lat, c.lon), r: c.r })), polys: [],
    } : null);
    // detailOnly: skip playable strips added after the district data was built (cities.js `sceneryRing: false`): the data has
    // no real footprints round them, so the far backdrop must not be cleared there.
    // The compiled district geometry carries no flags: find the pieces of the `sceneryRing: false` strips by radius and end points.
    const lateStrips = (distCfg?.bands || []).filter(b => b.sceneryRing === false).map(b => ({ r: b.r, pts: b.line.map(([lat, lon]) => { const p = city.proj(lat, lon); return [p.x, p.z]; }) }));
    const sameEnd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 2;
    for (const p of ringGeometry?.pieces || []) if (p.pts?.length && lateStrips.some(b => b.r === p.r && ((sameEnd(b.pts[0], p.pts[0]) && sameEnd(b.pts.at(-1), p.pts.at(-1))) || (sameEnd(b.pts[0], p.pts.at(-1)) && sameEnd(b.pts.at(-1), p.pts[0]))))) p.ring = false;
    const sceneryMargin = (x, z, detailOnly = false) => {
        let margin = Infinity;
        for (const c of ringGeometry?.circles || []) margin = Math.min(margin, Math.hypot(x - c.x, z - c.z) - c.r);
        for (const p of ringGeometry?.pieces || []) if (!(detailOnly && p.ring === false)) for (let i = 1; i < p.pts.length; i++) {
            const a = p.pts[i - 1], b = p.pts[i];
            margin = Math.min(margin, distPointSeg(x, z, a[0], a[1], b[0], b[1]).d - p.r);
        }
        for (const p of ringGeometry?.polys || []) {
            let distance = Infinity;
            for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; distance = Math.min(distance, distPointSeg(x, z, a[0], a[1], b[0], b[1]).d); }
            margin = Math.min(margin, pointInPolygon(x, z, p) ? -distance : distance);
        }
        return margin;
    };
    // Optional source railway scenery. Ground assumptions are explicit; no layer-to-metre conversion or trains.
    const railStats = { sourceWays: data.railways?.length || 0, renderedWays: 0, renderedMetres: 0, ties: 0, unresolved: [] };
    // SeaTac: the Link aerial guideway has a sourced rail level (station platform 18 m), see seatac-guideway.js.
    const seatacGuideway = distId === 'seatac' ? emitSeatacGuideway({ railways: data.railways, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl,
        keep: (x, z, len) => !(ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + len / 2), stationCentre: bRecs.find(b => b.sourceId === 'w54139654')?.c || null }) : null;
    if (seatacGuideway) railStats.guideway = { ways: [...seatacGuideway.ways], metres: seatacGuideway.metres, piers: seatacGuideway.piers, piersOmitted: seatacGuideway.piersOmitted };
    // Bellevue: the 2 Line guideway over I-405 to Wilburton; rail level is a stated estimate over USGS ground, see bellevue-guideway.js.
    const bellevueGuideway = distId === 'bellevue' ? emitBellevueGuideway({ railways: data.railways, scenery: data.scenery, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl,
        keep: (x, z, len) => !(ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + len / 2) }) : null;
    if (bellevueGuideway) railStats.bellevueGuideway = { ...bellevueGuideway, ways: [...bellevueGuideway.ways] };
    for (const r of data.railways || []) {
        const t = r.tags || {}, gaugeMM = Number(t.gauge), layer = t.layer == null ? 0 : Number(t.layer);
        if (t.railway === 'abandoned') continue; // OSM abandoned tracks have had their rails removed.
        if (bellevueGuideway?.ways.has(r.id)) { railStats.renderedWays++; continue; }
        if (seatacGuideway?.ways.has(r.id)) { railStats.renderedWays++; continue; }
        if (!(gaugeMM > 0) || !Number.isFinite(layer) || layer !== 0 || (t.bridge && t.bridge !== 'no') || (t.tunnel && t.tunnel !== 'no')) { railStats.unresolved.push({ source: r.id, reason: 'unknown-gauge-or-vertical-placement' }); continue; }
        const pts = undelta(r.points, 0), gauge = gaugeMM / 1000, bedHalf = gauge / 2 + 0.8; let travelled = 0, emitted = false;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
            const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux, angle = Math.atan2(ux, uz), steps = Math.ceil(L / 12);
            for (let j = 0; j < steps; j++) {
                const lo = j * L / steps, hi = (j + 1) * L / steps, mid = (lo + hi) / 2, x = a[0] + ux * mid, z = a[1] + uz * mid, length = hi - lo;
                // A 1-Lipschitz margin certifies that no portion inside600m is omitted. Small overhang is far context.
                if (ringGeometry && sceneryMargin(x, z) > (distCfg?.outerRing ?? 600) + length / 2) continue;
                const c = cellOf(x, z), ax = a[0] + ux * lo, az = a[1] + uz * lo, bx = a[0] + ux * hi, bz = a[1] + uz * hi;
                c.ground.flatQuad(ax + nx * bedHalf, az + nz * bedHalf, bx + nx * bedHalf, bz + nz * bedHalf, bx - nx * bedHalf, bz - nz * bedHalf, ax - nx * bedHalf, az - nz * bedHalf, 0.135, rgb('#787269'), 0.2, -1);
                for (const sign of [-1, 1]) c.solid.box(x + nx * gauge / 2 * sign, 0.24, z + nz * gauge / 2 * sign, 0.07, 0.06, length + 0.02, angle, rgb('#777b7d'));
                // Ties are flat strips in the existing detail material, without an extra shadow pass.
                for (let s = Math.ceil((travelled + lo) / 0.7) * 0.7 - travelled; s < hi; s += 0.7) {
                    const tx = a[0] + ux * s, tz = a[1] + uz * s, half = gauge / 2 + 0.45, thick = 0.13;
                    c.detail.flatQuad(tx + nx * half - ux * thick, tz + nz * half - uz * thick, tx - nx * half - ux * thick, tz - nz * half - uz * thick, tx - nx * half + ux * thick, tz - nz * half + uz * thick, tx + nx * half + ux * thick, tz + nz * half + uz * thick, 0.21, rgb('#54483b'), 0.1, -1); railStats.ties++;
                }
                railStats.renderedMetres += length; emitted = true;
            }
            travelled += L;
        }
        if (emitted) railStats.renderedWays++;
    }
    railStats.renderedMetres = Math.round(railStats.renderedMetres);
    // Elevated source structures the road builder does not own: rail viaducts (bridge-tagged data.railways) and footbridges
    // (footbridge-sources.js). Geometry, estimates and the rule for supports: elevated-sources.js.
    const elevatedSources = buildElevatedSources(data, { cellOf, undelta, surfacesAt, addPropColl, roadY: Y.road, tramSweep, plan: elevatedPlan, dataset: elevatedDataset,
        visible: (x, z, len) => !ringGeometry || sceneryMargin(x, z) <= (distCfg?.outerRing ?? 600) + len / 2,
        overTrunk: (x, z) => { const q = nearestEdge(x, z, e => /^(motorway|trunk)$/.test(e.type) && !e.virtual, 40); return !!q && q.d < q.edge.halfW + 1.5; } });
    // (fidelity pass r2) free-standing monuments / memorials / artworks at their mapped OSM positions (monuments.js): districts only
    const monuments = distId ? emitMonuments({ pois: data.pois.filter(r => data.poiKinds[r[0]] === 'landmark').map(r => ({ name: str(r[3]), sub: str(r[5]), x: r[1] / 10, z: r[2] / 10, building: r[6] })),
        project: (la, lo) => city.proj(la, lo), keep: (x, z) => !ringGeometry || sceneryMargin(x, z) <= 400, cellOf, rgb, shadeRgb, landmarkDiscs: landmarkDiscs.filter(d => d.r <= 12),
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : underRoof(x, z) ? 'under-roof' : isWater(x, z) ? 'in-water' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        faceAngle: (x, z) => { const q = nearestEdge(x, z, e => !e.virtual && !e.tunnel, 80); return q ? Math.atan2(q.edge.dirx, q.edge.dirz) + Math.PI / 2 : 0; },
        baseY: (x, z) => raisedTop(x, z) ?? 0.05, addCollider: (x, z, r, h, rec) => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h, prop: true, kind: 'monument', sourceId: rec.id, estimated: true }) }) : null;
    // (2026-11-12 render review) under ANY mapped footprint, also one drawn by a landmark model (skipped here), a canopy
    // or an elevated part: SeaTac's Talking Fountain n8920167700 stands inside the Main Terminal w23772634 (drawn by its
    // landmark) and was drawn under the terminal roof. Only invalid (dropped) outlines do not count.
    function underRoof(x, z) { let r = false; bGrid.each(x, z, x, z, (b) => { if (!r && !b.dropped && b.ring?.length >= 3 && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring) && !b.holes?.some(h => pointInPolygon(x, z, h))) r = true; }); return r; }
    // (fidelity pass r2) Otopeni: OSM lighting masts and the CFR station's platform vault (airport-forecourt.js)
    const airportForecourt = distId ? emitAirportForecourt({ key: city.id + '-' + distId, project: (la, lo) => city.proj(la, lo), cellOf,
        blocked: (x, z, r) => onRibbon(x, z, r) ? 'on-carriageway' : buildingAt(x, z) ? 'inside-building' : tramSweep?.circle(x, z, r + 0.2, 0, 6) ? 'tram-sweep' : null,
        baseY: (x, z) => raisedTop(x, z) ?? 0.05, addCollider: (x, z, r, h, rec) => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h, prop: true, kind: 'lighting-mast', sourceId: rec.id }),
        // a source building a landmark model replaced (or any otherwise skipped record) is drawn by that model only
        building: id => { const recs = bRecs.filter(o => data.buildingIds?.[o.derivedFrom ?? o.i] === id), lmRec = recs.find(o => o.landmarkReplacement), b = recs.find(o => !o.skip);
            return lmRec ? { replacedBy: lmRec.landmarkReplacement } : b ? { ring: b.ring, h: b.h } : null; } }) : null;
    const touchesDetailedRing = (x, z, w, d) => realPass && ringGeometry && sceneryMargin(x, z, true) <= (distCfg?.outerRing ?? 600) + Math.hypot(w, d) / 2;
    {
        const bd = data.backdrop || [], pal = PALETTES[country];
        for (let i = 0; i + 5 < bd.length; i += 6) {
            const x = bd[i] / 10, z = bd[i + 1] / 10, w = bd[i + 2] / 10, d = bd[i + 3] / 10, h = bd[i + 4] / 10, rot = -bd[i + 5] * Math.PI / 180;
            const box = { x, z, hw: w / 2, hd: d / 2, angle: rot, r: Math.hypot(w, d) / 2, poly: null, h, kind: 'backdrop' };
            if (touchesDetailedRing(x, z, w, d)) continue;
            if (inLandmarkGrounds(x, z, w, d)) { backdropInLandmark++; continue; }
            if (polyOnRibbon(obbPoly({ ...box, hw: w / 2 + 2, hd: d / 2 + 2 }))) continue;
            const st = h > 30 ? 'glass' : h > 14 ? 'bloc' : US ? 'house' : 'bloc';
            const colr = shadeRgb(rgb(rng.pick(pal[st])), 0.9);
            // Consume the original palette draw above, retaining later RNG order.
            const owner = backdropSourceOwner(bd, i, backdropBindings);
            if (owner) { backdropSourceOwnership.push({index:i/6,landmark:owner.landmark,sourceIds:owner.sourceIds,tuple:owner.tuple}); continue; }
            cellOf(x, z).backdrop.box(x, 0.12, z, w, h, d, rot, colr);
            propColl.push(box); backdropCount++;
        }
    }
    // horizon masses (district worlds): the rest of the city as low-detail blocks in a ring 250 m – 4 km outside the map,
    // so the district edge and the empty ground beyond it never show (one merged mesh, always drawn). Bucharest: dense
    // 4–11 storey blocks; Seattle: low suburbs / wooded hills, no masses toward the open water west of Bellevue / SeaTac.
    const horizon = new MeshBuilder();
    if (distId) {
        const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2, R0 = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 250;
        const hr = makeRng(4711 + distId.length * 31), pal = PALETTES[country];
        const woods = [shadeRgb(rgb(env.grass), 0.55), shadeRgb(rgb(env.grass), 0.45)];
        for (let ring = 0; ring < 4; ring++) {
            const R = R0 + ring * 900 + hr.range(0, 300), n = Math.round(2 * Math.PI * R / (US ? 70 : 55));
            for (let i = 0; i < n; i++) {
                const a = (i + hr.range(-0.3, 0.3)) / n * Math.PI * 2, x = cx + Math.cos(a) * (R + hr.range(-150, 150)), z = cz + Math.sin(a) * (R + hr.range(-150, 150));
                const westDeg = ((Math.atan2(z - cz, x - cx) * 180 / Math.PI) + 360) % 360; // 180 = west (−x)
                if (US && westDeg > 150 && westDeg < 230 && (distId === 'bellevue' || distId === 'seatac')) continue;
                if (isWater(x, z)) continue;
                const trees = US ? hr.chance(0.55) : hr.chance(0.15);
                const w = hr.range(30, 70), d = hr.range(14, 40), h = trees ? hr.range(10, 22) : US ? hr.range(6, ring === 0 ? 30 : 14) : hr.range(12, ring === 0 ? 36 : 28);
                const col = trees ? hr.pick(woods) : shadeRgb(rgb(hr.pick(pal[h > 20 ? 'bloc' : US ? 'house' : 'plain'] || pal.plain)), 0.85);
                const rotation = a + hr.range(-0.4, 0.4);
                if (touchesDetailedRing(x, z, w, d)) continue;
                if (inLandmarkGrounds(x, z, w, d)) { backdropInLandmark++; continue; }
                horizon.box(x, -0.2, z, w, h, d, rotation, col);
            }
        }
    }
    const cellsGroup = new THREE.Group(); cellsGroup.name = 'cells'; group.add(cellsGroup);
    const fallbackApertures=fallbackGroundApertures();
    for(const piece of tramGrades.support.pieces)if(!piece.roof&&piece.top){
        const top=piece.top.map(p=>p.map(Math.fround));
        fallbackApertures.addTriangle([top[0],top[1],top[2]],'tram-floor');
        fallbackApertures.addTriangle([top[0],top[2],top[3]],'tram-floor');
    }
    let tris = underpassCover.ic / 3;
    // Destination guides are gameplay markers, including at doors reached from a sidewalk.
    // Keep their exact paint/material while batching them separately from physical carriageway markings.
    if (!poiDoorGuides.empty) {
        const m = new THREE.Mesh(poiDoorGuides.build(), marksMat);
        m.name = 'poi-door-guides'; m.receiveShadow = true; m.renderOrder = 4;
        m.matrixAutoUpdate = false; m.updateMatrix(); poiGroup.add(m); tris += poiDoorGuides.ic / 3;
    }
    const addMesh = (mb, mat, cast, name) => {
        if (mb.empty) return null;
        const m = new THREE.Mesh(mb.build(), mat);
        m.castShadow = cast; m.receiveShadow = true; m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
        tris += mb.ic / 3;
        m.userData.cx = (cx + 0.5) * CELL; m.userData.cz = (cz + 0.5) * CELL;
        if (name.startsWith('signs')) m.userData.cull = 520; else if (name.startsWith('marks')) m.userData.cull = 820;
        cellsGroup.add(m); return m;
    };
    // view ranges (render's weather-driven visibility is 15–20 km on clear days, so culling no longer follows the fog):
    // buildings / ground / roads ≈ 2.7 km, small props / trees / parked cars ≈ 1.2 km, signs 520 m, markings 820 m
    const VIEW = { far: 2700, props: 1200 };
    const cullR = VIEW.far + CELL * 0.71;
    let cx = 0, cz = 0;
    // (2026-11-07, world-visual) draw calls: the flat / cheap layers of neighbouring cells are merged into super-cells
    // (2×2 cells = 500 m; the far backdrop 4×4) — fewer meshes for the same pixels; solid buildings stay per cell (culling)
    const SUPER = { area: 4, grass: 4, pave: 4, sport: 4, roof: 4, backdrop: 4, ground: 2, road: 2, pad: 2, marks: 2, water: 4, signs: 4, spill: 4, solid: 2, detail: 1 };
    const supers = new Map();
    const superOf = (c, layer, page = 0) => {
        const K = SUPER[layer], I = Math.floor(c.i / K), J = Math.floor(c.j / K), key = layer + page + ':' + I + ',' + J;
        let o = supers.get(key); if (!o) supers.set(key, o = { layer, page, K, I, J, mb: null });
        return o;
    };
    const tramTrench = buildTramTrenchCutter(tramGrades.support);
    // (spec 10 load budget) a super-cell's first builder takes the others once, at their final size (appendAll), when its
    // mesh is made: the same arrays as appending them one by one here; o.ic is the merged index count so far
    const superAdd = (o, mb) => { if (!o.mb) o.mb = mb; else (o.pending ||= []).push(mb); o.ic = (o.ic || 0) + mb.ic; };
    for (const c of cells.values()) {
        for (const layer of ['area', 'grass', 'pave', 'sport', 'roof', 'backdrop', 'ground', 'road', 'pad', 'marks', 'water', 'solid', 'detail']) {
            if (c[layer].empty) continue;
            if (['area', 'grass', 'pave', 'sport', 'ground'].includes(layer)) c[layer] = tramTrench.cut(c[layer]);
            const o = superOf(c, layer);
            if (['solid', 'roof', 'area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad', 'marks'].includes(layer)) {
                const mb = c[layer], box = new THREE.Box3().setFromArray(mb.p.subarray(0, mb.vc * 3));
                (o.parts ||= []).push({ start: o.ic || 0, count: mb.ic, bounds: [...box.min.toArray(), ...box.max.toArray()] });
            }
            superAdd(o, c[layer]);
        }
        c.signs.forEach((mb, k) => { if (!mb || mb.empty) return; superAdd(superOf(c, 'signs', k), mb); });
        if (c.spill && !c.spill.empty) superAdd(superOf(c, 'spill'), c.spill);
    }
    const addSuper = (o, mat, cast, name) => {
        if (o.pending) { o.mb.appendAll(o.pending); o.pending = null; }
        cx = o.I * o.K + o.K / 2 - 0.5; cz = o.J * o.K + o.K / 2 - 0.5; // (addMesh centres at (cx + 0.5) · CELL)
        const m = addMesh(o.mb, mat, cast, `${name} ${o.I},${o.J}`); if (!m) return null;
        if(['ground','road','pad'].includes(o.layer))fallbackApertures.addGeometry(m.geometry,'road-floor');
        if (o.parts) cullMergedCells(m, o.parts, { blockTriangles: o.layer === 'ground' || o.layer === 'grass' ? 64 : 0 });
        const extra = CELL * (o.K - 1) * 0.71; m.userData.cull = (m.userData.cull || cullR) + extra;
        return m;
    };
    for (const o of supers.values()) {
        switch (o.layer) {
            case 'area': { const m = addSuper(o, areaMat, false, 'area'); if (m) m.renderOrder = -19.5; break; }
            case 'grass': { const m = addSuper(o, grassMat, false, 'grass'); if (m) m.renderOrder = -19.2; break; }
            case 'pave': { const m = addSuper(o, paveMat, false, 'pave'); if (m) m.renderOrder = -19; break; }
            // (2026-11-08, owner: a band across a pitch) pitch stripes / court lines draw after every grass / paved mesh: these
            // layers do not write depth, so a neighbouring cell's lawn drawn later painted over the part of a pitch in its cell
            case 'sport': { const m = addSuper(o, sportMat, false, 'sport'); if (m) m.renderOrder = -18.9; break; }
            case 'roof': addSuper(o, roofMat, true, 'roofs'); break;
            case 'backdrop': { const m = addSuper(o, backdropMat, true, 'backdrop'); if (m) m.userData.cull = cullR + 600 + CELL * (o.K - 1) * 0.71; break; }
            case 'ground': { const m = addSuper(o, groundMat, false, 'ground'); if (m) m.renderOrder = 1; break; }
            case 'road': { const m = addSuper(o, roadMat, false, 'road'); if (m) m.renderOrder = 2; break; }
            case 'pad': { const m = addSuper(o, padMat, false, 'junction'); if (m) m.renderOrder = 3; break; }
            case 'marks': { const m = addSuper(o, marksMat, false, 'marks'); if (m) m.renderOrder = 4; break; }
            case 'water': { const m = addSuper(o, waterMat, false, 'water'); if (m) { m.renderOrder = -18; shoreFoam(m, preparedSmallWater?.get(o.I + ',' + o.J)); fallbackApertures.addGeometry(m.geometry,'final-water'); } break; }
            case 'solid': addSuper(o, solidMat, true, 'solid'); break;
            case 'detail': { const m = addSuper(o, solidMat, false, 'detail'); if (m) { m.userData.cull = 110 + CELL * 0.71; m.layers.set(2); } break; } // (main view only) // near LOD only // (2026-11-08: no shadow pass — pickets, wires, nets: the frame budget)
            case 'signs': addSuper(o, signMats[o.page], false, 'signs'); break;
            case 'spill': { const m = addSuper(o, spillMat, false, 'shop-spill'); if (m) { m.renderOrder = 5; m.castShadow = m.receiveShadow = false; } break; }
        }
    }
    if (preparedSmallWater && [...preparedSmallWater.values()].some(entry => !entry.consumed)) throw Error('A certified small-water group was not assembled');
    // ---- kerbside parking (district worlds, Bucharest): mapped parking keeps its location / orientation; legacy yes
    //      flags alone cannot authorize sidewalk cars. Untagged residential / unclassified streets (and tertiary streets
    //      with one lane each way) retain the parallel-kerb fallback where the sidewalk is ≥ 2.2 m. Clear of junctions,
    //      crossings, bus stops, fuel forecourts, trees, lamps and buildings. Kerb cars stand on the raised sidewalk;
    //      surface-lot cars above must clear that pavement with their whole footprint.
    let kerbParked = 0;
    if (realPass && !US && useInst) {
        const RI = data.roadInfo || [], kRng = makeRng(90127), cols = CAR_COLORS;
        const mappedParking = new Map((data.parking || []).map(row => [row[0], row]));
        const stops = pois.filter(p => p.kind === 'busstop'), parkLots = areas.filter(a => a.kind === 'parking');
        const kinds = ['hatch', 'hatch', 'sedan', 'suv', 'hatch', 'sedan'];
        const pcGrid = new BoxGrid(16); for (const pc of propColl) { const r = pc.r || 0.5; pcGrid.insert(pc.x - r, pc.z - r, pc.x + r, pc.z + r, pc); }
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 22 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            const parking = mappedParking.get(e.road);
            const resid = /^(residential|unclassified|living_street)$/.test(e.type) || (e.type === 'tertiary' && e.lanesF <= 1 && e.lanesB <= 1);
            for (const sd of [1, -1]) {
                const tagged = sd > 0 ? (rf & 64) : (rf & 128), none = sd > 0 ? (rf & 256) : (rf & 512);
                if (none || (!resid && !tagged) || e.sidewalk < 2.2) continue;
                // Legacy yes flags omit the mapped location/orientation. A parking
                // lane (e.g. Calea Floreasca) does not authorize sidewalk cars.
                if (tagged && !parking) continue;
                if (parking) {
                    const offset = sd > 0 ? 1 : 3, location = str(parking[offset]), orientation = str(parking[offset + 1]);
                    // This pass draws parallel cars wholly on the kerb. Mapped
                    // carriageway bays, diagonal/perpendicular parking and half-on-
                    // kerb arrangements need their own surfaces/placement; don't
                    // silently turn those source facts into parallel sidewalk cars.
                    if ((orientation && orientation !== 'parallel') || (location && location !== 'on_kerb')) continue;
                    if (orientation && !location) continue;
                }
                const occ = tagged ? 0.86 : 0.72;
                const s0 = retract(e, e.a) + 9 + (e.a.crossing ? 8 : 0), s1 = e.len - retract(e, e.b) - 9 - (e.b.crossing ? 8 : 0);
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + 1.2, yaw = Math.atan2(e.dirx, e.dirz) + (kRng() < 0.5 ? 0 : Math.PI);
                for (let sAl = s0 + kRng() * 2; sAl < s1; sAl += 5.4 + kRng() * 0.8) {
                    if (kRng() > occ) { if (kRng() < 0.25) sAl += 6; continue; } // (gaps, sometimes a driveway)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    const box = { x, z, hw: 0.92, hd: 2.25, angle: yaw, r: 2.4, poly: null, h: 1.5, prop: true, kind: 'parked' };
                    const fp = obbPoly(box);
                    if (polyOnRibbon(fp) || fp.some(([qx, qz]) => buildingAt(qx, qz)) || buildingAt(x, z) || nearWater(x, z, 2.5)) continue;
                    const ry = raisedTop(x, z); if (ry === null) continue; // (only where the sidewalk is raised: the wheels stand on it)
                    if (treeNear(x, z, 2.2) || lampNear(x, z, 1.9) || treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < (q.r + 3) ** 2)) continue;
                    if (stops.some(p => Math.hypot(p.x - x, p.z - z) < 14) || nearDoor(x, z)) continue;
                    // (2026-11-08, owner: "remove the cars parked next to the parking lot — their wheels are in the road") a
                    // street front with a car park behind the sidewalk has no kerbside parking: people park in the lot
                    if (parkLots.some(a => [2.5, 5, 8].some(d => { const qx = x + e.nx * sd * d, qz = z + e.nz * sd * d; return inArea(a, qx, qz); }))) continue;
                    if (mapEnds.some(m => Math.hypot(m.x - x, m.z - z) < 30)) continue; // (owner: "this sign is overlapping a car": the road-closure scene at the map edge)
                    let blocked = false; pcGrid.each(x - 3, z - 3, x + 3, z + 3, (pc) => { if (!blocked && Math.hypot(pc.x - x, pc.z - z) < (pc.r || 0.5) + 1.6) blocked = true; });
                    if (blocked) continue;
                    pcGrid.insert(x - 2.4, z - 2.4, x + 2.4, z + 2.4, box);
                    const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []);
                    const kind = kinds[Math.floor(kRng() * kinds.length)], color = cols[Math.floor(kRng() * cols.length)], cyaw = yaw + (kRng() - 0.5) * 0.05;
                    L.push({ kind, color, x, y: ry + 0.005, z, yaw: cyaw });
                    propColl.push(box); kerbParked++;
                }
            }
        }
    }
    let parkedCalls = 0;
    for (const [k, list] of parkedLots) {
        const [I, J] = k.split(',').map(Number);
        const pg = makeParkedCars(list, { city: city.id, paintSpace: 'linear', castShadow: false }); // (no shadow pass for lots) pg.name = `parked ${k}`; // (CAR_COLORS are sRGB hex: let three.js linearise them, as the old merged lots did)
        pg.userData.cx = (I + 0.5) * CELL * 2; pg.userData.cz = (J + 0.5) * CELL * 2; pg.userData.cull = (distId ? 300 : 700) + CELL * 0.71; // (district worlds line every residential kerb with cars: drawn to ≈ 0.3 km beyond the cell)
        tris += pg.userData.triangles || 0; parkedCalls += pg.userData.drawCalls || 0;
        pg.traverse(o => o.layers.set(2)); // (layer 2, main view only: the mirror pass skips parked lots)
        cellsGroup.add(pg);
    }
    for (const m of vegetation.treeCrownMeshes.concat(vegetation.treeTrunkMeshes)) { cellsGroup.add(m); tris += (m.userData.always ? m.instanceMatrix.count : m.count) * (m.geometry.index.count / 3); }
    { const hMat = new THREE.MeshLambertMaterial({ vertexColors: true }); hMat.name = 'horizon'; const hm = addMesh(horizon, hMat, false, 'horizon'); if (hm) { hm.userData.always = true; hm.frustumCulled = true; } }
    let waterMesh = addMesh(bigWater, waterMat, false, 'water-big'); if (waterMesh) shoreFoam(waterMesh);
    if (distId && waterMesh && (waterMesh.geometry.index?.count || waterMesh.geometry.attributes.position.count) > 15000) {
        // A single lake/river mesh spanning the district defeats frustum culling:
        // the mirror submitted all 60k water triangles even when it saw no water.
        // Partition after shoreline calculation, preserving every triangle and
        // attribute (including shore distance) so chunk edges add no foam seams.
        const source = waterMesh.geometry, position = source.attributes.position, index = source.index;
        const chunks = new Map(), count = index ? index.count : position.count;
        const vertex = i => index ? index.getX(i) : i;
        for (let i = 0; i < count; i += 3) {
            const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
            const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
            const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
            const key = Math.floor(x / 500) + ',' + Math.floor(z / 500);
            let vertices = chunks.get(key); if (!vertices) chunks.set(key, vertices = []);
            vertices.push(a, b, c);
        }
        if (chunks.size > 1) {
            const parent = new THREE.Group(); parent.name = 'water-big';
            for (const [key, vertices] of chunks) {
                const geometry = new THREE.BufferGeometry();
                for (const [name, attribute] of Object.entries(source.attributes)) {
                    const size = attribute.itemSize, array = new attribute.array.constructor(vertices.length * size);
                    vertices.forEach((v, i) => { for (let c = 0; c < size; c++) array[i * size + c] = attribute.array[v * size + c]; });
                    geometry.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized));
                }
                geometry.computeBoundingSphere();
                const mesh = new THREE.Mesh(geometry, waterMat); mesh.name = 'water-big ' + key;
                mesh.receiveShadow = true; mesh.renderOrder = -18; mesh.matrixAutoUpdate = false;
                parent.add(mesh);
            }
            parent.userData.triangles = count / 3; parent.userData.chunks = chunks.size;
            waterMesh.removeFromParent(); source.dispose(); cellsGroup.add(parent); waterMesh = parent;
        }
    }
    if (waterMesh) { waterMesh.userData.always = true; waterMesh.renderOrder = -18; }
    if (waterMesh?.isGroup) {
        // Group order precedes mesh order in Three's opaque sort. Keep this group
        // neutral so land draws first; small water/shore meshes still overlay it.
        waterMesh.renderOrder = 0;
        for (const mesh of waterMesh.children) mesh.renderOrder = -18.1;
    }
    // Read the complete final retained water before its first view selection.
    if(waterMesh?.isGroup)for(const m of waterMesh.children)fallbackApertures.addGeometry(m.geometry,'final-water');
    else if(waterMesh?.geometry)fallbackApertures.addGeometry(waterMesh.geometry,'final-water');
    for (const pit of landmarkPits) for (const q of pit.tris) { const v = q.map(([x, z]) => [x, pit.floorY, z]); fallbackApertures.addTriangle(v, 'landmark-pit'); fallbackApertures.addTriangle([v[0], v[2], v[1]], 'landmark-pit'); }
    if (waterMesh?.isGroup) batchWaterChunks(waterMesh);
    // distance culling: cells beyond the fog are hidden (three.js only frustum-culls, and the camera far plane is 5 km).
    // The viewer is world.camera if set, else the widest perspective camera found in the scene.
    const _v = new THREE.Vector3();
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
    const startLL = distId ? (() => { const st = opts.start || city.activeStart || (CHAPTERS.find(c => c.city === city.id && c.district === distId) || {}).start; return st ? { lat: st.lat, lon: st.lon, road: st.road, bearing: st.heading ?? st.bearing } : null; })() : city.spawnLL;
    if (startLL) {
        const sp = startLL; const q = city.proj(sp.lat, sp.lon);
        const brW = (sp.bearing ?? 0) * Math.PI / 180, wantX = Math.sin(brW), wantZ = -Math.cos(brW);
        const legalDir = (e) => sp.bearing == null || !e.oneway || e.dirx * wantX + e.dirz * wantZ > 0.2; // a one-way carriageway must run the way the chapter faces
        const flt = (e) => e.drivable && legalDir(e) && (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : (sp.road && distId) ? true : !/motorway/.test(e.type)) && e.len > 15;
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
    const stats = { waterBridgeRailings, fasciaLayout: { records: fasciaLayoutAudit, boards: facadeBoards, scope: 'Inferred coplanar fascia boards on existing source walls; source POIs and names unchanged' }, sourceWaterTreeConflicts: { records: waterTreeConflicts.records, sourceRecordsRetained: true, marginM: 0, scope: 'Physical trunk bodies intersect detailed basins and their rendered granite rims; not canopy thinning or road/traffic change' }, parkingClearance, phases, railways: railStats, network: sccInfo, edges: edges.length, walls: walls.length, wallPiecesCut: wallCut, piers: pierColl.length, bridgeBents: bridgeBents.report, treeDeckClearance, furniture: furnCount, roadSigns: signCount, roofAds, roofAdList, backdrop: backdropCount, backdropSourceOwnership, sceneryStreets, kerbParked, marksDropped: edges.filter(e => (e._mkAll || 0) > 4 && ((e._mkDrop || 0) + (e._mkOut || 0)) / e._mkAll > 0.2).sort((p, q) => ((q._mkDrop || 0) + (q._mkOut || 0)) / q._mkAll - ((p._mkDrop || 0) + (p._mkOut || 0)) / p._mkAll).slice(0, 30).map(e => ({ name: e.name, type: e.type, id: e.id, lanes: [e.lanesF, e.lanesB], oneway: e.oneway, x: Math.round((e.a.x + e.b.x) / 2), z: Math.round((e.a.z + e.b.z) / 2), len: Math.round(e.len), cover: +((e._mkDrop || 0) / e._mkAll).toFixed(2), out: +((e._mkOut || 0) / e._mkAll).toFixed(2) })), raisedSidewalk: { pieces: raisedPieces, corners: cornerPolys.length, joins: sideJoins.size, skipped: cornerSkips }, greenQuads, fenceM: Math.round(fenceM), bollards, pitchesDressed, fuel: fuelLog,
        buildingRoofProfiles: roofProfileAudit, profile: profileStats, buildingPassages: buildingPassageAudit, treesOSM, treesRows, heightFixes: heightFixes.length, heightFixSamples: heightFixes.slice(0, 30), buildingsShrunk: bShrunk, buildingClearance: clearanceAudit, buildingsDropped: bDropped, buildingsCovered: coveredOutlines, buildingAssemblies: assemblyAudit, buildingAssembliesRejected: assemblyRejected, buildingUnions: physicalUnionAudit, buildingUnionsRejected: physicalUnionRejected, inferredBuildingDetails: inferredDetailAudit, landmarkSourceReplacements, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, lampsInWater: lampsWet, shoreTris: Math.round(shoreTris), vacantUnits, channelM: Math.round(channelM), unitSigns, unitSignSpots: signedSpots.slice(0, 40).map(q => q.map(v => Math.round(v))), crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
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
    stats.monuments = monuments;
    stats.fuelForecourts = fuelForecourts;
    stats.landmarkWaterFootprints = landmarkWaterFootprints;
    stats.trenchGroundCuts = { corridors: trenchQuads.length, channelWaterTriangles: channelCuts.length, triangles: trenchCutTris }; // (ground layers cut out of open trenches and sunken water channels)
    stats.trenchGoreCuts = trenchGoreCuts; // (#59: trench wall sides stopped at another sunken ramp)
    stats.buildingOverlapCuts = overlapCuts; // (world-space basin outlines: audits of what stands in or over them)
    stats.buildingOutlineParts = outlineParts; // (style-estimated outlines left undrawn in favour of the tagged volumes inside them)
    stats.bridgeGuardCompletion = guardCompletion; stats.railingNetwork = railingNetwork; stats.railingDrops = railingDrops;
    stats.elevatedSources = elevatedSources.report;
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
        const seen = new Set();
        sceneryDeckGrid.each(x, z, x, z, deck => { if (pointInPolygon(x, z, deck.poly)) cb(deck.roofHeightAt(x, z),false,deck); });
        if (realPass && !carriagewayOnly && cornerPolys.length) { // a raised junction corner: the only surface there (cb(h, raised))
            let hc = null; cornerGrid.each(x, z, x, z, (cp) => { if (hc === null && x >= cp.x0 && x <= cp.x1 && z >= cp.z0 && z <= cp.z1 && pointInPolygon(x, z, cp.p)) hc = Y.road + Y.kerb + padHeightAt(cp.n, x, z); });
            if (hc !== null && !onRibbon(x, z, 0, RIB_ONLY)) { cb(hc, true); return; }
        }
        edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (seen.has(e) || e.virtual || e === exclude) return; seen.add(e);
            // (spec 10 load budget) the distance below is at least the gap to the edge's box; lim is at most the wider width +
            // the largest shoulder (1.2) + the wider sidewalk + SIDE_BACK (+ 1.5 preferred): past that bound it returns anyway
            const gap = Math.max(Math.min(e.a.x, e.b.x) - x, x - Math.max(e.a.x, e.b.x), Math.min(e.a.z, e.b.z) - z, z - Math.max(e.a.z, e.b.z));
            if (gap > Math.max(e.wR, e.wL) + 1.2 + (carriagewayOnly ? 0 : Math.max(sidewalkWidth(e, 1), sidewalkWidth(e, -1)) + SIDE_BACK) + (e === prefer ? 1.5 : 0) + 1e-6) return;
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
            const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1;
            const lim = (side > 0 ? e.wR : e.wL) + shoulderOf(e) + (carriagewayOnly ? 0 : sidewalkWidth(e, side) + (raisedEdge(e, side) ? SIDE_BACK : 0.05)) + (e === prefer ? 1.5 : 0);
            if (q.d > lim) return;
            if ((q.t <= 0 || q.t >= 1) && Math.hypot(x - (q.t <= 0 ? e.a.x : e.b.x), z - (q.t <= 0 ? e.a.z : e.b.z)) > (q.t <= 0 ? e.a : e.b).radius + (carriagewayOnly ? 0 : 1)) return;
            const h = Y.road + yAlong(e,x,z);
            if (!carriagewayOnly && q.t > 0 && q.t < 1 && raisedEdge(e, side) && q.d > widthAsphalt(e, side) + 0.02 && !onRibbon(x, z, 0, RIB_ONLY)) { const sh = railRoadside.surface(e, x, z, h + Y.kerb); if (sh !== null) cb(sh, sh > h + .01); return; } // source-rail flush paving follows rendered height
            let adjusted = railRoadside.surface(e, x, z, h);
            if (adjusted === null && !carriagewayOnly) adjusted = railRoadside.surface(e, x, z, h + Y.side - Y.road);
            if (adjusted !== null) cb(adjusted);
        });
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
         *  barriers where roads leave the map; node.mapEnd = true), inside(x, z) (the drivable area)} — null for the legacy corridor maps */
        district: distId ? { id: distId, ...distCfg, areaKm2: data.district?.areaKm2, ends: mapEnds, mask: dmask, inside: insideDistrict, flightBoundary } : null,
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
            return { network: sccInfo, blocked: blocked.length, deadEnds: deadEnds.length, samples: { blocked: blocked.slice(0, 10), deadEnds: deadEnds.slice(0, 10) } };
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
        /** (realPass districts) top of the raised sidewalk at (x, z) or null — where walkers' feet go (traffic crowd) */
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

function mixRgb(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

function buildSky(env) {
    const geo = new THREE.SphereGeometry(3000, 24, 12);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(env.skyTop) }, bottom: { value: new THREE.Color(env.skyBottom) }, sunDir: { value: new THREE.Vector3(...env.sun).normalize() }, sunColor: { value: new THREE.Color(env.sunColor) }, clouds: { value: env.clouds } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float clouds; varying vec3 vDir;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
            void main(){
                float h = clamp(vDir.y, 0.0, 1.0);
                vec3 col = mix(bottom, top, pow(h, 0.55));
                float s = max(dot(normalize(vDir), sunDir), 0.0);
                col += sunColor * (pow(s, 256.0) * 1.5 + pow(s, 8.0) * 0.25);
                vec2 uv = vDir.xz / max(vDir.y, 0.05) * 0.8;
                float n = noise(uv * 1.5) * 0.6 + noise(uv * 4.0) * 0.3 + noise(uv * 9.0) * 0.1;
                float c = smoothstep(0.55 - clouds * 0.25, 0.9, n) * clouds * smoothstep(0.0, 0.25, h);
                col = mix(col, vec3(1.0) * mix(0.75, 1.0, h), c * 0.8);
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    m.frustumCulled = false;
    return m;
}

// ---------------------------------------------------------------------------
//  Collision: real footprints (polygon) + oriented boxes (landmarks)
// ---------------------------------------------------------------------------
/** Point check for developer road-overlap audits, including a two-metre vehicle body above its road. */
export function buildingBlocksRoad(c, x, z, roadY, bodyHeight = 2) {
    if (c.roadDeck) return false;
    if (c.roofHeightAt && roadY > (c.roofHeightAt(x, z) ?? c.h)) return false;
    if (c.passageSolids) return c.passageSolids.some(band => band.y0 <= roadY + bodyHeight && band.y1 >= roadY && band.polys.some(p => pointInPolygon(x, z, p)));
    if (!c.poly || !pointInPolygon(x, z, c.poly) || (c.holes || []).some(h => pointInPolygon(x, z, h))) return false;
    if ((c.minH ?? 0) > roadY + bodyHeight || (c.h !== undefined && roadY > c.h + 0.5)) return false;
    if ((c.y0 !== undefined && roadY + bodyHeight < c.y0) || (c.y1 !== undefined && roadY > c.y1)) return false;
    return true;
}

/** Conservative horizontal bounds for the exact native collision primitives. */
export function collisionBounds(b) {
    if(b.wall&&[b.ax,b.az,b.bx,b.bz].every(Number.isFinite))return[Math.min(b.ax,b.bx),Math.min(b.az,b.bz),Math.max(b.ax,b.bx),Math.max(b.az,b.bz)];
    if(b.poly?.length){let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(const[x,z]of b.poly){x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}return[x0,z0,x1,z1];}
    if(!(b.prop&&b.hw===b.r)&&Number.isFinite(b.hw)&&Number.isFinite(b.hd)&&Number.isFinite(b.angle)){const c=Math.abs(Math.cos(b.angle)),s=Math.abs(Math.sin(b.angle)),x=c*b.hw+s*b.hd,z=s*b.hw+c*b.hd;return[b.x-x,b.z-z,b.x+x,b.z+z];}
    return[b.x-b.r,b.z-b.r,b.x+b.r,b.z+b.r];
}

function collisionHeightClear(b,x,z,radius,y,bodyHeight) {
    if (b.roofHeightAt) {
        const top = b.roofHeightAt(x, z, radius);
        // The same triangulated roof drives collision; the full total-height box is only broad phase.
        if (top === null || (y ?? 0.24) > top || (b.roadDeck && (y ?? .24) >= b.roofHeightAt(x, z, 0) - 1e-4)) return false;
    }
    if (b.minHeightAt) { const bottom = b.minHeightAt(x, z, radius); if (bottom === null || (y ?? .24) + bodyHeight < bottom) return false; }
    return true;
}

// Bounding box of a collision outline, kept per outline array. A point farther than `radius` outside it is neither inside
// the outline nor within `radius` of any of its edges: the full test below would return null. (SeaTac: the terminal's
// passage solids were copied and walked edge by edge for every walker near it, 70 % of that district's simulation step.)
const outlineBoxes = new WeakMap();
function outsideOutline(poly, x, z, radius) {
    let box = outlineBoxes.get(poly);
    if (!box) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } outlineBoxes.set(poly, box = [x0, z0, x1, z1]); }
    return x < box[0] - radius || x > box[2] + radius || z < box[1] - radius || z > box[3] + radius;
}
// A large outline (an airport terminal has 400 vertices, a garage 160 plus holes, each on several levels) was walked edge
// by edge for every body near it. Its edges are kept in 2 m rows by z: the crossing count for "inside" needs only the
// edges of the point's own row, and an edge within `radius` lies in the rows the point's reach touches. Same edges, same
// arithmetic, same order as the full walk; a point inside the outline still takes the full walk for its nearest edge.
const OUTLINE_ROW_M = 2, OUTLINE_INDEX_MIN_VERTICES = 40, outlineRowIndexes = new WeakMap();
function outlineRowIndex(poly, holes) {
    let ix = outlineRowIndexes.get(poly);
    if (ix && ix.holes === holes) return ix;
    const boundaries = holes?.length ? [poly, ...holes] : [poly]; let z0 = Infinity, z1 = -Infinity;
    for (const boundary of boundaries) for (const p of boundary) { if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const rows = Array.from({ length: Math.max(1, Math.floor((z1 - z0) / OUTLINE_ROW_M) + 1) }, () => []); let seq = 0;
    for (let bi = 0; bi < boundaries.length; bi++) { const boundary = boundaries[bi]; for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const e = { seq: seq++, bi, xi: boundary[i][0], zi: boundary[i][1], xj: boundary[j][0], zj: boundary[j][1] };
        for (let r = Math.floor((Math.min(e.zi, e.zj) - z0) / OUTLINE_ROW_M), last = Math.floor((Math.max(e.zi, e.zj) - z0) / OUTLINE_ROW_M); r <= last; r++) rows[r].push(e);
    } }
    outlineRowIndexes.set(poly, ix = { holes, z0, rows, parity: new Uint8Array(boundaries.length), finite: Number.isFinite(z0) && Number.isFinite(z1) });
    return ix;
}
/** null: the point is neither inside the outline nor within `radius` of an edge. Otherwise { inside } and, when not
 *  inside, the nearest edge (bd, bnx, bnz) exactly as the full walk finds it. */
function outlineContact(ix, x, z, radius) {
    const rows = ix.rows, row = Math.floor((z - ix.z0) / OUTLINE_ROW_M), parity = ix.parity; parity.fill(0);
    if (row >= 0 && row < rows.length) for (const e of rows[row]) if (((e.zi > z) !== (e.zj > z)) && (x < (e.xj - e.xi) * (z - e.zi) / (e.zj - e.zi) + e.xi)) parity[e.bi] ^= 1;
    let inside = parity[0] === 1; if (inside) for (let k = 1; k < parity.length; k++) if (parity[k]) { inside = false; break; }
    if (inside) return { inside: true };
    const r0 = Math.max(0, Math.floor((z - radius - ix.z0) / OUTLINE_ROW_M)), r1 = Math.min(rows.length - 1, Math.floor((z + radius - ix.z0) / OUTLINE_ROW_M));
    let bd = Infinity, bnx = 0, bnz = 0, bseq = Infinity;
    for (let r = r0; r <= r1; r++) for (const e of rows[r]) {
        if ((e.xi < x - radius && e.xj < x - radius) || (e.xi > x + radius && e.xj > x + radius)) continue; // cannot be within radius
        const q = distPointSeg(x, z, e.xj, e.zj, e.xi, e.zi);
        // the full walk keeps the first of equal distances: here the lowest edge number
        if (q.d < bd || (q.d === bd && e.seq < bseq)) { bd = q.d; bseq = e.seq; if (q.d > 1e-5) { bnx = (x - q.cx) / q.d; bnz = (z - q.cz) / q.d; } else { bnx = 0; bnz = 0; } }
    }
    return bd < radius ? { inside: false, bd, bnx, bnz } : null;
}
export function collideOne(b, x, z, radius, y, bodyHeight = 2) {
    if (!b.wall) {
        const height = y ?? 0.24;
        if ((b.y0 !== undefined && (b.roofHeightAt ? height + bodyHeight < b.y0 : height < b.y0)) || (b.y1 !== undefined && height > b.y1)) return null;
    }
    if (b.wall) { // wall segment, active only for bodies within its height band
        const r = distPointSeg(x, z, b.ax, b.az, b.bx, b.bz);
        if (r.d >= radius) return null;
        const yq = y ?? 0.24;
        const y0 = b.y0a + (b.y0b - b.y0a) * r.t, y1 = b.y1a + (b.y1b - b.y1a) * r.t;
        if (yq < y0 - 0.3 || yq > y1) return null;
        let nx, nz;
        if (r.d > 1e-4) { nx = (x - r.cx) / r.d; nz = (z - r.cz) / r.d; } else { nx = b.nx; nz = b.nz; }
        if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        return { nx, nz, pen: radius - r.d };
    }
    if(b.passageSolids){
        const height=y??.24;let best=null;
        for(const band of b.passageSolids){
            if(height+bodyHeight<band.y0||height>band.y1)continue;
            for(const poly of band.polys){if(outsideOutline(poly,x,z,radius))continue;const hit=collideOne({...b,passageSolids:null,poly,holes:[],minH:band.y0,y0:undefined,y1:band.y1},x,z,radius,y,bodyHeight);if(hit&&(!best||hit.pen>best.pen))best=hit;}
        }
        return best&&collisionHeightClear(b,x,z,radius,y,bodyHeight)?best:null;
    }
    if (b.minH > (y ?? 0.24) + bodyHeight) return null; // mapped passage: body fits below the source underside
    if (b.yMax !== undefined && (y ?? 0.24) > b.yMax) return null; // e.g. bridge piers: only for traffic below the deck
    if (b.prop && b.hw === b.r) { // small circle (tree trunk, post…)
        const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
        if (d >= b.r + radius) return null;
        if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        return d > 1e-4 ? { nx: dx / d, nz: dz / d, pen: b.r + radius - d } : { nx: 1, nz: 0, pen: b.r + radius };
    }
    if (b.poly) {
        const poly = b.poly;
        if (outsideOutline(poly, x, z, radius)) return null; // (holes lie inside the outline)
        if (poly.length + (b.holes ? b.holes.reduce((n, h) => n + h.length, 0) : 0) >= OUTLINE_INDEX_MIN_VERTICES) {
            const ix = outlineRowIndex(poly, b.holes);
            if (ix.finite) {
                const near = outlineContact(ix, x, z, radius);
                if (!near) return null;
                if (!near.inside) { if (!collisionHeightClear(b, x, z, radius, y, bodyHeight)) return null; return { nx: near.bnx, nz: near.bnz, pen: radius - near.bd }; }
            }
        }
        const holes = b.holes || [];
        const inside = pointInPolygon(x, z, poly) && !holes.some(h => pointInPolygon(x, z, h));
        let bd = Infinity, bnx = 0, bnz = 0;
        for (const boundary of [poly, ...holes]) for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
            const r = distPointSeg(x, z, boundary[j][0], boundary[j][1], boundary[i][0], boundary[i][1]);
            if (r.d < bd) { bd = r.d; if (r.d > 1e-5) { bnx = (x - r.cx) / r.d; bnz = (z - r.cz) / r.d; } else { bnx = 0; bnz = 0; } }
        }
        if((inside||bd<radius)&&!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
        if (inside) return { nx: -bnx, nz: -bnz, pen: radius + bd };
        if (bd < radius) return { nx: bnx, nz: bnz, pen: radius - bd };
        return null;
    }
    const dx = x - b.x, dz = z - b.z;
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
    const ddx = lx - cx, ddz = lz - cz;
    const d = Math.hypot(ddx, ddz);
    if (d >= radius) return null;
    let nx, nz;
    if (d > 1e-4) { nx = ddx / d; nz = ddz / d; }
    else { const ox = b.hw - Math.abs(lx), oz = b.hd - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; } else { nx = 0; nz = Math.sign(lz) || 1; } }
    if(!collisionHeightClear(b,x,z,radius,y,bodyHeight))return null;
    const pen = d > 1e-4 ? radius - d : radius + Math.min(b.hw - Math.abs(lx), b.hd - Math.abs(lz));
    return { nx: nx * c + nz * s, nz: -nx * s + nz * c, pen };
}

/**
 * Returns a push vector {px, pz, hit} or null. `buildings` may carry a spatial `.query(x, z, r, cb)`.
 * `y` (optional) = height of the body's base (e.g. player.y): walls (bridge railings, embankments, trench walls,
 * guard rails) and bridge piers only collide with bodies at their level. Without `y` the body is assumed on the
 * ground (0.24): railings of elevated decks are then ignored (so cars under a bridge are never blocked).
 */
export function collideBuildings(buildings, x, z, radius, y, bodyHeight = 2) {
    let px = 0, pz = 0, hit = null;
    const test = (b) => {
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz > (b.r + radius) * (b.r + radius)) return;
        const r = collideOne(b, x, z, radius, y, bodyHeight);
        if (r && r.pen > 0) { px += r.nx * r.pen; pz += r.nz * r.pen; hit = b; }
    };
    if (buildings.query) buildings.query(x, z, radius + 2, test); else for (const b of buildings) test(b);
    return hit ? { px, pz, hit } : null;
}
