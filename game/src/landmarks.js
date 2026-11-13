import { LANDMARK_SOURCE_IDS } from './landmark-source-identities.js';
import { FOUNTAIN_STATE, fountainSchedule, FOUNTAIN_WATER } from './landmarks/fountain-water.js';
import { landmarkSurfaceMaterials, pts, M, Builder } from './landmarks/kit.js';
import { P, P2 } from './landmarks/footprints.js';
import { airliner } from './landmarks/parts.js';
import { bParliament, bCathedral, bArcul, bCasaPresei, bGrandHotel, bUniv, bTNB } from './landmarks/bucharest-civic.js';
import { bAteneu, bRegal, bVictoria, bCEC, bMNIR, bMarriott, bUnirea, bASE, bAmbasador, bARO } from './landmarks/bucharest-centre.js';
import { FOUNTAIN_RINGS, bFountains } from './landmarks/fountains.js';
import { bSkyTower, bPromenada, bBaneasaSC, bRomexpo, bAviatorilor, bGara, bOpera, bHermes, bBaneasaTerm, bOTP, bOtpGara } from './landmarks/bucharest-north.js';
import { bSpaceNeedle, bColumbia, bSmith, bLumen, bTMobile, bGreatWheel, bSpheres, bMtBaker, bSeaTac, bSeaTower, bRainier, bOlympics, bMurrow, bSeaGarage, bSeaLink } from './landmarks/seattle.js';
import { bBellevueTowers, bBellevueSq, bLincolnN, bOneLincoln, bLincolnS, bPlazaCenter, bSonic, bBellevue600 } from './landmarks/bellevue.js';
import { bGTS, bRosetti, bBOB, bTheBridge1, bPolitehnica, bTheLandmark, bEuropeHouse, bHalaTraian, bGlobalworth } from './landmarks/bucharest-districts.js';
import { DIN_OUT, DIN_DEPTH, bDinamo, bAntipa, bCatargiu, bNobilDac, bEnescu, bVeronaFountain, bCetGrozavesti, bOrhideeaSign, bWaterTower, bAutomatica, bGrozMetro, bUrseanuDome } from './landmarks/bucharest-dinamo-monuments.js';
import { A } from './landmarks/anchors.js';

// ============================================================================
//  Drive My CV — procedural models of the real landmarks of Bucharest and
//  Seattle / Bellevue.
//
//  Usage (world side):
//      import { LANDMARKS, buildLandmark } from './landmarks.js';
//      for (const lm of LANDMARKS.filter(l => l.city === city.id)) {
//          const q = proj(lm.lat, lm.lon);                 // anchor in world metres
//          const r = buildLandmark(lm, { THREE, rng });     // { mesh, clear, collision, triangles }
//          r.mesh.position.set(q.x, groundY, q.z);          // rotation is already applied
//          scene.add(r.mesh);
//          for (const c of r.collision) boxes.push({ ...c, x: q.x + c.x, z: q.z + c.z, r: Math.hypot(c.hw, c.hd) });
//      }
//
//  Conventions
//  - Model local frame: origin at the anchor (lat/lon), +y up, +x east, +z south (before rotation).
//  - `rotation` is a yaw in radians applied as mesh.rotation.y = rotation (three.js convention:
//    a model vector (x, z) ends up at (x cos r + z sin r, -x sin r + z cos r)). buildLandmark()
//    already assigns it, so the world only needs to set the position (re-assigning is harmless).
//  - Collision boxes {x, z, hw, hd, angle} are returned relative to the anchor in WORLD axes
//    (rotation and city scale already applied), `angle` uses the same convention as
//    world.js collideBuildings(). Add the anchor's world position to x/z.
//  - Every model is authored and built in real metres (1:1, the chapter districts of spec 10); LANDMARKS[].radiusM is
//    the clearing radius in metres. (`ctx.realScale` is accepted and ignored: the half-scale Seattle of the corridor
//    maps is gone, spec 22.)
//  - District-era landmarks (2026-11, `P2` footprints) use rotation 0 and footprints projected at the anchor from the
//    raw OSM tiles; `cvStop` / `passing` name the CV POI hosted by the model; `districtOnly` marks road-aligned
//    structures anchored on the district road graph.
//  - Anchors / orientations / footprints come from OpenStreetMap (ways listed per landmark,
//    footprints simplified with Douglas-Peucker and stored in P (landmarks/footprints.js), in model-frame metres).
//  - Geometry is merged into one BufferGeometry per material (vertex colours), so every
//    landmark costs 1-4 draw calls.
//  - Facade detail comes from cheap Builder helpers (windows = 1 quad per window, cornice, pilasters,
//    text = 5x7 block letters, fence) and storeys() for classical blocks; each builder cites its sources
//    ("Src:" line + numbers in its comment). Dev viewer: game/dev/landmarks.html?id=<id>&view=street|top.
//
//  Modules (spec 22 split this file; same public API): this file is the registry (LANDMARKS, buildLandmark,
//  landmarkGroundPits) and re-exports landmarkSurfaceMaterials and the fountain state / schedule. The models and
//  their helpers live in game/src/landmarks/:
//    landmarks/anchors.js                    lat / lon / yaw of every landmark (A)
//    landmarks/fountain-water.js             Fountain water
//    landmarks/kit.js                        Builder kit
//    landmarks/footprints.js                 Footprints
//    landmarks/parts.js                      Shared parts
//    landmarks/bucharest-civic.js            Bucharest civic landmarks
//    landmarks/bucharest-centre.js           Bucharest centre landmarks
//    landmarks/fountains.js                  The Unirii fountains
//    landmarks/bucharest-north.js            Bucharest north landmarks
//    landmarks/seattle.js                    Seattle landmarks
//    landmarks/bellevue.js                   Bellevue landmarks
//    landmarks/bucharest-districts.js        Bucharest district-era landmarks (P2 footprints)
//    landmarks/bucharest-dinamo-monuments.js Bucharest monuments
//  The generated source massing they read is game/data/landmarks/*.json (landmarks/source-data.js).
// ============================================================================

// P, P2, FOUNTAIN_RINGS, Builder, airliner, M, FOUNTAIN_WATER are imported above although this module does not use them: tools load this file's
// source with an appended `export { … }` of them (tools/landmarks/{geometry,bucharest-source,seatac-aircraft}-check.mjs,
// game/dev/harness/fountain-lifecycle.test.mjs).
export { landmarkSurfaceMaterials, FOUNTAIN_STATE, fountainSchedule };

/** Landmarks sunk below the street: the world opens its flat ground layers over `ring` (model metres, x east / z south, at
 *  the anchor; rotation 0) and takes `floorY` as the lowest surface there. */
export function landmarkGroundPits(cityId, ids = null) {
    return cityId === 'bucharest' && (!ids || ids.includes('dinamo')) ? [{ id: 'dinamo', lat: A.dinamo[0], lon: A.dinamo[1], ring: pts(DIN_OUT), floorY: -DIN_DEPTH }] : [];
}

function L(id, city, name, osmNames, radius, fn, extra = {}) {
    const [lat, lon, rotation] = A[id];
    // radiusM: the clearing radius in metres
    const lm = { id, city, name, lat, lon, rotation, osmNames, radiusM: radius,
        ...(LANDMARK_SOURCE_IDS[id] ? { sourceIds: LANDMARK_SOURCE_IDS[id] } : {}), ...extra };
    Object.defineProperty(lm, '_fn', { value: fn, enumerable: false });
    lm.build = (ctx) => buildLandmark(lm, ctx);
    return lm;
}

/**
 * All landmarks. sourceIds enumerates the complete authored replacement scope for
 * source-preserving districts. Radius/name fields are legacy compatibility metadata;
 * they never authorize deletion of a neighboring source building in that policy.
 */
export const LANDMARKS = [
    // ---- Bucharest ----
    L('parliament', 'bucharest', 'Palatul Parlamentului', ['Palatul Parlamentului', 'Casa Poporului'], 175, bParliament, { floodlit: true, masonry: true }),
    L('cathedral', 'bucharest', 'Catedrala Mântuirii Neamului', ['Catedrala Națională', 'Catedrala Mântuirii Neamului', 'Catedrala Mântuirii Neamului Românesc'], 70, bCathedral, { floodlit: true, masonry: true }),
    L('arcul', 'bucharest', 'Arcul de Triumf', ['Arcul de Triumf'], 18, bArcul, { floodlit: true, masonry: true }),
    L('casapresei', 'bucharest', 'Casa Presei Libere', ['Casa Presei Libere', 'Casa Scînteii'], 160, bCasaPresei),
    L('grandhotel', 'bucharest', 'Grand Hotel Bucharest (ex-InterContinental)', ['Grand Hotel Bucharest', 'InterContinental', 'Hotel InterContinental'], 40, bGrandHotel),
    L('univ', 'bucharest', 'Palatul Universității', ['Universitatea din București', 'Palatul Universității'], 110, bUniv, { floodlit: true, masonry: true }),
    L('tnb', 'bucharest', 'Teatrul Național București', ['Teatrul Național', 'Teatrul Național București', 'Teatrul Național „Ion Luca Caragiale”'], 95, bTNB),
    L('ateneu', 'bucharest', 'Ateneul Român', ['Ateneul Român'], 38, bAteneu, { floodlit: true, masonry: true }),
    L('regal', 'bucharest', 'Palatul Regal (MNAR)', ['Palatul Regal', 'Muzeul Național de Artă al României'], 130, bRegal, { floodlit: true, masonry: true }),
    L('victoria', 'bucharest', 'Palatul Victoria', ['Palatul Victoria'], 58, bVictoria, { floodlit: true, masonry: true }),
    L('cec', 'bucharest', 'Palatul CEC', ['Palatul Casei de Economii şi Consemnaţiuni', 'Palatul CEC'], 36, bCEC, { floodlit: true, masonry: true }),
    L('mnir', 'bucharest', 'Muzeul Național de Istorie a României', ['Palatul Poștelor', 'Muzeul Național de Istorie a României'], 70, bMNIR, { floodlit: true, masonry: true }),
    L('marriott', 'bucharest', 'JW Marriott Grand Hotel', ['JW Marriott', 'JW Marriott Bucharest Grand Hotel'], 75, bMarriott),
    L('unirea', 'bucharest', 'Unirea Shopping Center', ['Unirea Shopping Center'], 115, bUnirea, { unitSigns: true }), // (fidelity pass: OSM tenants on the ground floor)
    L('fountains', 'bucharest', 'Fântânile din Piața Unirii', [], 0, bFountains),
    L('skytower', 'bucharest', 'Sky Tower', ['Sky Tower'], 28, bSkyTower, { sourceIds: ['w219622660'],
        // Reproduced from the retained w219622660 source centroid, 137m height,
        // longest-edge104deg and original40m-cell compiler (see spec12).
        backdropSources:{floreasca:[{sourceIds:['w219622660'],tuple:[745,-15068,403,317,1370,104]}]} }),
    L('promenada', 'bucharest', 'Promenada Mall', ['Promenada Mall'], 95, bPromenada),
    L('baneasasc', 'bucharest', 'Băneasa Shopping City', ['Băneasa Shopping City'], 190, bBaneasaSC),
    L('romexpo', 'bucharest', 'Romexpo', ['Romexpo'], 65, bRomexpo),
    L('aviatorilor', 'bucharest', 'Monumentul Eroilor Aerului', ['Monumentul Eroilor Aerului'], 8, bAviatorilor, { masonry: true }),
    L('gara', 'bucharest', 'Gara de Nord', ['Gara de Nord'], 120, bGara),
    L('opera', 'bucharest', 'Opera Națională București', ['Opera Națională'], 70, bOpera),
    L('politehnica', 'bucharest', 'Rectoratul Politehnicii', ['Rectorat Universitatea Politehnica din București'], 30, bPolitehnica, { cvStop: 'upb', ownSign: true, floodlit: true, sourceIds: ['w28240552', 'w1217715300'] }),
    L('hermes', 'bucharest', 'Hermes Business Campus', ['Hermes', 'Clădirea B+C', 'Hermes Business Campus'], 80, bHermes, { cvStop: 'luxoft', ownSign: true, sourceIds: ['w533147567', 'w231123137', 'r6774709'] }),
    L('baneasaterm', 'bucharest', 'Aeroportul Băneasa (terminal 1952)', ['Aeroportul Internațional Aurel Vlaicu'], 75, bBaneasaTerm),
    L('otp', 'bucharest', 'Aeroportul Henri Coandă', ['Aeroportul Otopeni Henri Coandă - Plecări', 'Aeroportul Otopeni Henri Coandă - Sosiri', 'Terminalul Vioara'], 230, bOTP),
    L('ase', 'bucharest', 'ASE — Palatul Ion N. Angelescu', ['Clădirea Ion N. Angelescu', 'Academia de Studii Economice'], 0, bASE, { ownSign: true }),
    L('ambasador', 'bucharest', 'Hotel Ambasador', ['Hotel Ambasador'], 30, bAmbasador, { floodlit: true, masonry: true }),
    L('aro', 'bucharest', 'Blocul ARO / Patria', ['Bl. ARO/Patria', 'Hanul Elias - Patria'], 32, bARO),
    L('thelandmark', 'bucharest', 'The Landmark (UiPath HQ)', ['The Landmark Corp B'], 25, bTheLandmark, { cvStop: 'uipath-buc', ownSign: true }),
    L('europehouse', 'bucharest', 'Europe House', ['Europe House'], 24, bEuropeHouse, { cvStop: 'arnia', ownSign: true }),
    L('antipa', 'bucharest', 'Muzeul Antipa', ['Muzeul Național de Istorie Naturală "Grigore Antipa"', 'Muzeul Antipa'], 46, bAntipa, { floodlit: true, masonry: true, sourceIds: ['w23610985'] }),
    L('catargiu', 'bucharest', 'Statuia Lascăr Catargiu', [], 5, bCatargiu, { sourceIds: [] }),
    L('veronafountain', 'bucharest', 'Fântâna Arthur Verona', [], 5, bVeronaFountain, { sourceIds: [] }),
    L('nobildac', 'bucharest', 'Statuia „Nobil Dac”', [], 3, bNobilDac, { districtOnly: true, sourceIds: [] }),
    L('enescu', 'bucharest', 'Statuia George Enescu', [], 4, bEnescu, { districtOnly: true, sourceIds: [] }),
    L('otpgara', 'bucharest', 'Gara Aeroport Henri Coandă', ['Aeroport Henri Coandă'], 0, bOtpGara, { districtOnly: true, sourceIds: ['w813193384'] }), // replaces the generic slab of its own footprint only
    L('gts', 'bucharest', 'Calea Călărașilor 101 (GTS Global Intelligence)', [], 9.5, bGTS, { cvStop: 'gts', ownSign: true, floodlit: true }),
    L('dinamo', 'bucharest', 'Stadionul Dinamo', ['Stadionul Dinamo', 'Peluza Catalin Hildan', 'Peluza Cătălin Hildan'], 95, bDinamo, { floodlit: true, sourceIds: ['w28212482', 'w427813551', 'w860001496', 'r9146640'] }), // r9146640: the building=stadium multipolygon of the same bowl (it stood as a 14 m generic wall round the sunk model)
    L('rosetti', 'bucharest', 'Liceul Teoretic C.A. Rosetti', ['Liceul Teoretic C.A. Rosetti', 'Liceul Teoretic „C.A. Rosetti”', 'Liceul C.A. Rosetti'], 26, bRosetti, { cvStop: 'rosetti', ownSign: true, floodlit: true }),
    L('bob', 'bucharest', 'BOB Tower (DB Global Technology)', ['BOB Tower'], 40, bBOB, { cvStop: 'db', ownSign: true, sourceIds: ['w55450549'] }),
    L('halatraian', 'bucharest', 'Hala Traian', ['Hala Traian'], 12, bHalaTraian),
    L('globalworth', 'bucharest', 'Globalworth Tower', ['Globalworth Tower'], 12, bGlobalworth),
    L('thebridge1', 'bucharest', 'The Bridge 1 (BCR)', ['The Bridge 1'], 45, bTheBridge1, { sourceIds: ['w661134293'] }),
    L('cetgrozavesti', 'bucharest', 'CET Grozăvești (cooling towers)', [], 60, bCetGrozavesti, { districtOnly: true, sourceIds: ['w188102855', 'w188102865', 'w188102870', 'w188102882'] }),
    L('orhideeasign', 'bucharest', 'Carrefour Orhideea', [], 0, bOrhideeaSign, { districtOnly: true, sourceIds: [] }),
    L('turnulapa', 'bucharest', 'Turnul de apă (Belvedere)', [], 0, bWaterTower, { districtOnly: true, sourceIds: ['w678037221'] }), // (round 3) replaces the generic round block of its own footprint only
    L('automatica', 'bucharest', 'Automatica Ford (building site)', [], 0, bAutomatica, { districtOnly: true, sourceIds: ['w39348916'] }), // (round 3) OSM building=construction
    L('urseanudome', 'bucharest', 'Observatorul Urseanu (tower and dome)', [], 0, bUrseanuDome, { districtOnly: true, sourceIds: ['w1220336122'] }), // (round 3) replaces the 25.6 m default cylinder of its own building:part only
    L('grozmetro', 'bucharest', 'Metrou Grozăvești (west entrance)', [], 0, bGrozMetro, { districtOnly: true, sourceIds: [] }),
    // ---- Seattle / Bellevue (radius given in real metres, halved by L()) ----
    L('spaceneedle', 'seattle', 'Space Needle', ['Space Needle'], 30, bSpaceNeedle, { floodlit: true, sourceIds: ['w12903132','w394254329','w394254330','w394254331','w394254332','w394254333','w394254334','w394254335','w394254336','w394254337','w394254484','w394254485','w394254486','w394254487','w394254488','w394956342','w394956343','w394956344'] }),
    L('columbia', 'seattle', 'Columbia Center', ['Columbia Center'], 50, bColumbia, { sourceIds: ['r4648083','w107124288','w331293871','w418132520','w418132515','w418132517','w418132525'] }),
    L('smith', 'seattle', 'Smith Tower', ['Smith Tower'], 28, bSmith, { sourceIds: ['w52781661','w418140384','w418140385','w418140386'] }),
    L('lumen', 'seattle', 'Lumen Field', ['Lumen Field'], 140, bLumen, { sourceIds: ['w458208102','w458208103','w458208104','w458208105','w458208106','w458208107','w458208112'] }),
    L('tmobile', 'seattle', 'T-Mobile Park', ['T-Mobile Park'], 135, bTMobile, { sourceIds: ['w1451834508','w1451834509','w1451834510','w1451834511','w1451834512','w1451834513','w1451834514','w1451834515','w1451834516','w1451834517','w1451834518','w1451834519','w1451834520','w1451834521','w1451834522','w1451834523'] }),
    L('greatwheel', 'seattle', 'Seattle Great Wheel', ['Seattle Great Wheel Tickets'], 30, bGreatWheel, { sourceIds: [] }),
    L('spheres', 'seattle', 'Amazon Spheres', ['Amazon.com The Spheres'], 36, bSpheres, { sourceIds: ['w868099742','w398816077','w491817110','w491817111'] }),
    L('mtbaker', 'seattle', 'Mount Baker Tunnel (east portal)', [], 0, bMtBaker, { sourceIds: [] }),
    L('seatac', 'seattle', 'Seattle-Tacoma International Airport', ['Sea-Tac Airport Main Terminal'], 480, bSeaTac, { sourceIds: ['w23772634','w23772637','w734002404','w869951038'] }),
    L('seatower', 'seattle', 'SeaTac Control Tower', ['SeaTac Control Tower'], 30, bSeaTower, { sourceIds: ['w53199557','w1199936806','w1199936807'] }),   // r 30: also the 71 m parent outline w53199557 (centroid ~15-21 m off)
    L('lincoln', 'seattle', 'Lincoln Square North (UiPath Bellevue)', ['Lincoln Square', 'Lincoln Square North', 'Cinemark Lincoln Square'], 72, bLincolnN, {  cvStop: 'uipath-bel', hero: true, unitSigns: true, sourceIds: ['w604028609','w161929514','w1364249504'] }),
    L('onelincoln', 'seattle', 'One Lincoln Tower / Westin Bellevue', ['One Lincoln Tower', 'Westin Bellevue', 'Westin'], 40, bOneLincoln, { sourceIds: ['w604028611','w328017119','w1474737770'] }),
    L('lincolnsouth', 'seattle', 'Lincoln Square South', ['Lincoln Square South', 'Lincoln Square South Tower', '400 Lincoln Square', 'Two Lincoln Tower', 'W Bellevue'], 50, bLincolnS, { sourceIds: ['w1326151866','w604028603','w1326151868'] }),
    L('plazacenter', 'seattle', 'Plaza Center (UiPath Bellevue 2018–2025)', ['Plaza Center'], 32, bPlazaCenter, {  passing: 'plaza-center', sourceIds: ['w33725899'] }),
    L('sonic', 'seattle', 'Amazon Sonic', ['Amazon.com Sonic', 'Amazon Sonic', '555 Tower'], 30, bSonic, { sourceIds: ['w1214423752','w1214424283','w1556489725'] }),
    L('bellevue600', 'seattle', 'Bellevue 600', ['Bellevue 600'], 12, bBellevue600, { sourceIds: ['w1453402304','w1453402305','w1474780170','w1474780171','w1474780172','w1474780173'] }),
    L('murroww', 'seattle', 'Murrow Bridge — west high-rise arches', [], 0, bMurrow, {  districtOnly: true, sourceIds: [] }),
    L('murrowe', 'seattle', 'Murrow Bridge — east high-rise arches', [], 0, bMurrow, {  districtOnly: true, sourceIds: [] }),
    L('seagarage', 'seattle', 'Sea-Tac parking garage + skybridges', ['Sea-Tac Parking Garage', 'Seattle-Tacoma International Airport Parking Garage'], 80, bSeaGarage, { sourceIds: ['r15763840','w37017724','w37017725','w37017726','w37017727','w37017728','w37017729'] }),
    L('sealink', 'seattle', 'SeaTac/Airport Link station', ['SeaTac/Airport'], 30, bSeaLink, { sourceIds: ['w54139654', 'w469766788'] }),   // w469766788: the bridge's stair / lift tower east of International Blvd (was drawn as a generic pitched-roof house)
    L('bellevuetowers', 'seattle', 'Bellevue Towers', ['Bellevue Towers', 'North Tower', 'South Tower'], 55, bBellevueTowers, { sourceIds: ['w118119171','w370237986','w370239409'] }),
    L('bellevuesq', 'seattle', 'Bellevue Square', ['Bellevue Square Mall'], 190, bBellevueSq, { sourceIds: ['w29234887','w497739259'] }),
    L('rainier', 'seattle', 'Mount Rainier', [], 0, bRainier, {  backdrop: true, realDistanceKm: 87, sourceIds: [] }),
    L('olympics', 'seattle', 'Olympic Mountains', [], 0, bOlympics, {  backdrop: true, realDistanceKm: 60, sourceIds: [] }),
];

/**
 * Build one landmark.
 * @param lm  entry of LANDMARKS
 * @param ctx { THREE?, rng?, helpers?, backdropScale? } — nothing is required; the module is self-contained.
 * @returns { mesh: THREE.Group (rotation applied, position at origin), clear / clearM: clearing radius (m),
 *            collision: [{x, z, hw, hd, angle}] relative to the anchor in world axes, triangles, authoredScale: 1 }
 */
export function buildLandmark(lm, ctx = {}) {
    const hs = 1;
    const b = new Builder(hs);
    lm._fn(b, ctx);
    const { group, tris } = b.finish({ floodlit: !!lm.floodlit && ctx.floodlit !== false, masonry: !!lm.masonry });
    group.name = 'landmark:' + lm.id;
    group.userData.landmark = lm.id;
    if (b.sourceMassAudit) group.userData.sourceMassAudit = b.sourceMassAudit;
    if (b.footballPitch) group.userData.footballPitch = b.footballPitch;
    if (b.basketballCourt) group.userData.basketballCourt = b.basketballCourt;
    group.rotation.y = lm.rotation;
    if (b.baseY) group.position.y = 0.12 + b.baseY; // a model sunk below the street: the world keeps this height and adds it to the collider bands
    let k = 1;
    if (lm.backdrop) { k = ctx.backdropScale ?? 1; group.scale.setScalar(k); }
    const c = Math.cos(lm.rotation), s = Math.sin(lm.rotation);
    const rot = ([x0, z0]) => { const x = x0 * hs, z = z0 * hs; return [x * c + z * s, -x * s + z * c]; };
    const collision = lm.backdrop ? [] : b.cols.map(q => {
        const x = q.x * hs, z = q.z * hs;
        return { ...q, x: x * c + z * s, z: -x * s + z * c, hw: q.hw * hs, hd: q.hd * hs, angle: lm.rotation + q.angle,
            ...(q.poly ? { poly: q.poly.map(rot), holes: (q.holes || []).map(h => h.map(rot)) } : {}) };
    });
    // fences the world draws (it knows the streets): {ring|line in world axes relative to the anchor, closed, gates, style}
    //  `inside`: the grounds polygon (the fence is kept on its side of a street); `covers`: points of OSM buildings the model
    //  replaces (the world hides the footprint under each point, e.g. the school's sports hall)
    const fences = lm.backdrop ? [] : b.fences.map(f => ({ ...f, ring: (f.ring || f.line).map(rot), inside: f.inside ? f.inside.map(rot) : null,
        gates: (f.gates || []).map(g => ({ ...g, x: g.x * hs * c + g.z * hs * s, z: -g.x * hs * s + g.z * hs * c })) }));
    const covers = lm.backdrop ? [] : b.covers.map(rot), grounds = lm.backdrop ? [] : b.grounds.map(g => g.map(rot)); // grounds: surfaces kept clear of trees
    const coverPolys = lm.backdrop ? [] : b.coverPolys.map(g => g.map(rot)); // polygons: every OSM building centred inside is the model's own
    const waterFootprints = lm.backdrop ? [] : (b.waterFootprints || []).map(a => ({ ...a, ring: a.ring.map(rot) }));
    return { waterFootprints, mesh: group, clear: lm.radiusM, clearM: lm.radiusM, collision, triangles: tris, authoredScale: hs, fences, covers, grounds, coverPolys };
}
