// ============================================================================
//  CITY CONFIG — the 3D worlds are generated from real OpenStreetMap data
//  (game/data/<city>.json, built by tools/osm/build-data.mjs). This file only
//  holds what OSM does not know: the CV stops, spawn point, traffic mood and
//  the look (sky / fog / colours) of each city.
//  Game space: metres, x = east, z = south (north = -z), y up.
// ============================================================================

/**
 * lat/lon → game metres. Must match tools/osm/build-data.mjs (the JSON header
 * carries the same parameters and world.js re-applies them after loading).
 */
export function projector({ lat0, lon0, scale = 1, compress = null, mPerLat = 111132, mPerLon = null }) {
    const mLon = mPerLon || 111320 * Math.cos(lat0 * Math.PI / 180);
    const proj = (lat, lon) => {
        let dlat = lat - lat0;
        if (compress && lat > compress.above) dlat = (compress.above - lat0) + (lat - compress.above) * compress.factor;
        return { x: (lon - lon0) * mLon * scale, z: -dlat * mPerLat * scale };
    };
    /** inverse (game metres → lat/lon) */
    proj.inverse = (x, z) => {
        let dlat = -z / (mPerLat * scale);
        if (compress && lat0 + dlat > compress.above) dlat = (compress.above - lat0) + (lat0 + dlat - compress.above) / compress.factor;
        return { lat: lat0 + dlat, lon: lon0 + x / (mLon * scale) };
    };
    proj.params = { lat0, lon0, scale, compress, mPerLat, mPerLon: mLon };
    return proj;
}

// Kept for backwards compatibility with older modules (traffic fallbacks). The OSM graph uses real highway classes.
export const ROAD_TYPES = {
    boulevard: { lanes: 3, speed: 14, laneW: 3.4, sidewalk: 4, trafficMul: 2.4 },
    street: { lanes: 2, speed: 12, laneW: 3.3, sidewalk: 3, trafficMul: 1 },
    small: { lanes: 1, speed: 9, laneW: 3.4, sidewalk: 2.5, trafficMul: 0.5 },
    dn: { lanes: 3, speed: 22, laneW: 3.6, sidewalk: 2, trafficMul: 1.4 },
    highway: { lanes: 3, speed: 30, laneW: 3.7, sidewalk: 1.5, trafficMul: 0.35 },
    ramp: { lanes: 1, speed: 15, laneW: 3.8, sidewalk: 1, trafficMul: 0.3 },
    avenue: { lanes: 2, speed: 13, laneW: 3.6, sidewalk: 3.5, trafficMul: 0.35 },
};

// ---------------------------------------------------------------------------
//  BUCHAREST
// ---------------------------------------------------------------------------
// CV stops (ids are referenced by data.js STOPS). `road` (optional) restricts the kerb snap to a street name.
const BUC_POIS = [
    { id: 'rosetti', lat: 44.46709, lon: 26.1063, label: 'Liceul C.A. Rosetti', kind: 'school', address: 'Str. Giuseppe Garibaldi 11', road: /Garibaldi/ }, // research: gate on the W side of one-way (northbound) Garibaldi
    { id: 'upb', lat: 44.4385, lon: 26.0515, label: 'Politehnica (UPB)', kind: 'school', address: 'Splaiul Independenței 313 — Rectorat (car gate on Bd. Doina Cornea)', road: /Doina Cornea/, roadRadius: 450, doorAlong: { m: 90, bearing: 30 } }, // research: the Rectorat (politehnica landmark) has no street frontage; the campus roads are private → door at the Doina Cornea vehicle gate
    { id: 'gts', lat: 44.4333, lon: 26.11762, label: 'GTS Global Intelligence', kind: 'office', address: 'Calea Călărașilor 101, lângă Hala Traian', road: /Călărașilor/ }, // research: N side, ~240 m west of the Traian junction
    // owner-confirmed (spec 10 Owner decisions): both on Bd. Dimitrie Pompeiu, Pipera. Pins = the researched entrances (game/research/bucharest-pipera.json stops[].door)
    { id: 'luxoft', lat: 44.4804, lon: 26.1139, label: 'Luxoft — Hermes Business Campus', kind: 'office', address: 'Bd. Dimitrie Pompeiu 5-7 (Hermes Business Campus)', road: /Pompeiu/, roadRadius: 120 }, // N side lobby, inside the `hermes` landmark
    { id: 'db', lat: 44.47969, lon: 26.11461, label: 'Deutsche Bank — BOB Tower', kind: 'office', address: 'Bd. Dimitrie Pompeiu 6A (BOB Tower)', road: /Pompeiu/, roadRadius: 120, doorAlong: { m: 12, bearing: 65 } }, // OSM w55450549, GF+6 glass; entrance on the S side of Pompeiu, opposite Hermes
    { id: 'arnia', lat: 44.45118, lon: 26.08795, label: 'Arnia Software — Europe House', kind: 'office', address: 'Bd. Lascăr Catargiu 47-53', road: /Lascăr Catargiu/ },
    { id: 'uipath-buc', lat: 44.4499, lon: 26.0944, label: 'UiPath HQ', kind: 'office', address: 'Str. Vasile Alecsandri 4', road: /Vasile Alecsandri/ },
    { id: 'otopeni', lat: 44.5696, lon: 26.0770, label: 'Henri Coandă Airport (OTP)', kind: 'airport', doorAlong: { m: 42, bearing: 0 } }, // research: landside Departures (Plecări) drop-off kerb on the elevated ramp (was airside, 600 m east)
];


// ---------------------------------------------------------------------------
//  DISTRICTS — the game is played in chapters, each in a compact district drawn at REAL 1:1 scale
//  (game/data/<city>-<district>.json, built by tools/osm/build-data.mjs --districts). A district is either an area
//  (`poly` / `bbox`: every road, building and POI inside) or a corridor (`route`: a buffered drive, e.g. DN1 or the
//  I-90 bridges) or both. `bbox` = [minLat, minLon, maxLat, maxLon] of the whole district; `poly` = [[lat, lon], …].
//  Routes: [{lat, lon, road?, bearing?, motorway?, name}] (buffer `rRoute` m; `circles` add round areas).
// ---------------------------------------------------------------------------
const RUSH = [[7, 10], [16, 19]];
const BUC_DISTRICTS = {
    grozavesti: {
        name: 'Grozăvești', label: 'Grozăvești & Politehnica — Splaiul Independenței, Podul Grozăvești, Bd. Doina Cornea',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.4357, 26.0482, 44.4509, 26.0688], center: { lat: 44.4412, lon: 26.0592 },
        bands: [
            { r: 130, chapter: 'upb', line: [[44.448553, 26.065443], [44.447432, 26.062617], [44.446923, 26.060540], [44.446793, 26.060264], [44.446586, 26.060205], [44.444227, 26.060704], [44.443543, 26.060555], [44.441596, 26.059892], [44.440701, 26.058795], [44.440322, 26.058441], [44.438050, 26.055450]] },
        ],
        circles: [{ lat: 44.438050, lon: 26.055450, r: 200, name: 'upb door' }, { lat: 44.448490, lon: 26.065400, r: 110, name: 'upb start' }, { lat: 44.438500, lon: 26.051500, r: 120, name: 'upb building' }],
        landmarks: ['politehnica', 'cathedral', 'thebridge1'],
        scenery: ['cathedral', 'thebridge1'], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/bucharest-grozavesti.json traffic.hotspots
            { lat: 44.44370, lon: 26.06120, radius: 180, hours: [[7.5,  10],  [16.5,  19.5]], level: 0.65, note: 'Podul Grozăvești / Orhideelor' },
            { lat: 44.43460, lon: 26.05450, radius: 160, hours: [[7.5,  9.5],  [16,  19]], level: 0.60, note: 'Iuliu Maniu × Doina Cornea (Politehnica)' },
            { lat: 44.43810, lon: 26.05540, radius: 100, hours: [[7.5,  9],  [15,  18]], level: 0.35, note: 'UPB gates (term time)' },
        ],
    },
    unirii: {
        name: 'Unirii', label: 'Piața Unirii, Calea Călărașilor, Hala Traian',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.4234, 26.0976, 44.4356, 26.1210], center: { lat: 44.4297, lon: 26.1090 },
        bands: [
            { r: 130, chapter: 'gts', line: [[44.426927, 26.100981], [44.426111, 26.100920], [44.425907, 26.101701], [44.425784, 26.104054], [44.427032, 26.103996], [44.428195, 26.103841], [44.428610, 26.103876], [44.428684, 26.104054], [44.428791, 26.103988], [44.428978, 26.104592], [44.429683, 26.106264], [44.431118, 26.109333], [44.432334, 26.111620], [44.432857, 26.112458], [44.433274, 26.115953], [44.433300, 26.117620]] },
        ],
        circles: [{ lat: 44.433300, lon: 26.117620, r: 200, name: 'gts door' }, { lat: 44.426766, lon: 26.100968, r: 110, name: 'gts start' }, { lat: 44.433300, lon: 26.117620, r: 120, name: 'gts building' }],
        landmarks: ['gts', 'unirea', 'fountains', 'halatraian', 'parliament', 'cathedral'],
        scenery: ['parliament', 'cathedral'], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/bucharest-unirii.json traffic.hotspots
            { lat: 44.42680, lon: 26.10250, radius: 250, hours: [[7.5,  10],  [16,  19.5]], level: 0.90, note: 'Piața Unirii (all arms, Pasajul Unirii)' },
            { lat: 44.43230, lon: 26.11180, radius: 150, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Bd. Mircea Vodă × Coposu × Călărașilor' },
            { lat: 44.43320, lon: 26.12050, radius: 120, hours: [[8,  10],  [16,  19]], level: 0.50, note: 'Calea Călărașilor × Traian (Hala Traian)' },
        ],
    },
    romana: {
        name: 'Romană & Victoriei', label: 'Piața Romană, Bd. Lascăr Catargiu, Piața Victoriei, Vasile Alecsandri',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.4385, 26.0803, 44.4584, 26.1031], center: { lat: 44.4483, lon: 26.0912 },
        bands: [
            { r: 130, chapter: 'arnia', line: [[44.440838, 26.099802], [44.446562, 26.097044], [44.446999, 26.096764], [44.452215, 26.086566], [44.452423, 26.086032], [44.452459, 26.085643], [44.451904, 26.086143], [44.451774, 26.087021], [44.451507, 26.087592], [44.451180, 26.087950]] },
            { r: 130, chapter: 'uipath-buc', line: [[44.456072, 26.083680], [44.453471, 26.085201], [44.452535, 26.085595], [44.451904, 26.086143], [44.451921, 26.087215], [44.452318, 26.090390], [44.451142, 26.090449], [44.451624, 26.094327], [44.449900, 26.094400]] },
        ],
        circles: [{ lat: 44.451180, lon: 26.087950, r: 200, name: 'arnia door' }, { lat: 44.441800, lon: 26.098800, r: 110, name: 'arnia start' }, { lat: 44.451180, lon: 26.087950, r: 120, name: 'arnia building' }, { lat: 44.449900, lon: 26.094400, r: 200, name: 'uipath-buc door' }, { lat: 44.456000, lon: 26.084200, r: 110, name: 'uipath-buc start' }, { lat: 44.449900, lon: 26.094400, r: 120, name: 'uipath-buc building' }],
        landmarks: ['victoria', 'ase', 'ambasador', 'thelandmark', 'europehouse', 'antipa', 'catargiu', 'veronafountain', 'skytower', 'ateneu', 'regal', 'tnb'],
        scenery: ['skytower', 'ateneu', 'regal', 'tnb'], // real skyline/600 m ring landmarks; no unreachable marker, label or route
        congestion: [ // from game/research/bucharest-romana.json traffic.hotspots
            { lat: 44.45260, lon: 26.08580, radius: 220, hours: [[7.5,  10],  [16,  19.5]], level: 0.90, note: 'Piața Victoriei' },
            { lat: 44.44680, lon: 26.09700, radius: 160, hours: [[7.5,  10],  [16,  19.5]], level: 0.85, note: 'Piața Romană' },
            { lat: 44.44920, lon: 26.09150, radius: 450, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Bd. Lascăr Catargiu (whole length)' },
            { lat: 44.45050, lon: 26.09850, radius: 200, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Calea Dorobanților (south, one-way)' },
        ],
    },
    floreasca: {
        name: 'Floreasca', label: 'Calea Floreasca, Piața Floreasca, Str. Garibaldi and the streets around C.A. Rosetti',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.4526, 26.0972, 44.4694, 26.1099], center: { lat: 44.4644, lon: 26.1038 },
        bands: [
            { r: 130, chapter: 'rosetti', line: [[44.454951, 26.100726], [44.458072, 26.100564], [44.465921, 26.102013], [44.465668, 26.104509], [44.465449, 26.106037], [44.467042, 26.106528], [44.467090, 26.106300]] },
        ],
        circles: [{ lat: 44.467090, lon: 26.106300, r: 200, name: 'rosetti door' }, { lat: 44.455600, lon: 26.100710, r: 110, name: 'rosetti start' }, { lat: 44.467090, lon: 26.106300, r: 120, name: 'rosetti building' }],
        landmarks: ['rosetti', 'dinamo', 'skytower', 'globalworth'],
        scenery: ['skytower', 'globalworth'], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/bucharest-floreasca.json traffic.hotspots
            { lat: 44.47100, lon: 26.10350, radius: 200, hours: [[8,  10],  [17,  19.5]], level: 0.70, note: 'Calea Floreasca N (towards Barbu Văcărescu / Sky Tower)' },
            { lat: 44.46650, lon: 26.10550, radius: 140, hours: [[7.5,  8.25],  [13,  14.5]], level: 0.45, note: 'Rosetti school run (Garibaldi/Ceaikovski)' },
            { lat: 44.46050, lon: 26.10050, radius: 120, hours: [[9,  13]], level: 0.40, note: 'Piața Floreasca market' },
        ],
    },
    pipera: {
        name: 'Pipera', label: 'Bd. Dimitrie Pompeiu, Hermes Business Campus, BOB Tower, Șos. Fabrica de Glucoză, Șos. Pipera',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.4704, 26.0918, 44.4830, 26.1289], center: { lat: 44.4800, lon: 26.1130 },
        bands: [
            { r: 130, chapter: 'luxoft', line: [[44.472705, 26.124272], [44.473605, 26.123959], [44.474163, 26.123943], [44.474873, 26.124244], [44.475769, 26.125045], [44.476093, 26.125215], [44.477372, 26.125362], [44.477663, 26.125321], [44.478797, 26.125516], [44.478236, 26.119797], [44.477880, 26.116884], [44.480660, 26.115250], [44.480290, 26.113970]] },
            { r: 130, chapter: 'db', line: [[44.479160, 26.095132], [44.479249, 26.096969], [44.479190, 26.097300], [44.479334, 26.099265], [44.479665, 26.101054], [44.480292, 26.103069], [44.478865, 26.105057], [44.478228, 26.105800], [44.479212, 26.110726], [44.480350, 26.114420]] },
        ],
        circles: [{ lat: 44.480290, lon: 26.113970, r: 200, name: 'luxoft door' }, { lat: 44.473000, lon: 26.124300, r: 110, name: 'luxoft start' }, { lat: 44.480400, lon: 26.113900, r: 120, name: 'luxoft building' }, { lat: 44.480350, lon: 26.114420, r: 200, name: 'db door' }, { lat: 44.479190, lon: 26.096300, r: 110, name: 'db start' }, { lat: 44.479690, lon: 26.114610, r: 120, name: 'db building' }],
        landmarks: ['hermes', 'bob', 'globalworth', 'skytower', 'promenada'],
        scenery: [], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/bucharest-pipera.json traffic.hotspots
            { lat: 44.48020, lon: 26.11400, radius: 300, hours: [[8,  10.5],  [16.5,  20]], level: 0.95, note: 'Bd. Dimitrie Pompeiu (whole street)' },
            { lat: 44.47750, lon: 26.10450, radius: 220, hours: [[8,  10],  [16.5,  19.5]], level: 0.85, note: 'Barbu Văcărescu × Fabrica de Glucoză (Sky Tower)' },
            { lat: 44.48400, lon: 26.11400, radius: 200, hours: [[7.5,  10],  [17,  20]], level: 0.75, note: 'Șos. Pipera / Podul Pipera' },
        ],
    },
    otopeni: {
        name: 'Otopeni', label: 'DN1 at Otopeni and the Henri Coandă terminal (OTP)',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [44.5534, 26.0659, 44.5719, 26.0807], center: { lat: 44.5650, lon: 26.0770 },
        bands: [
            { r: 130, chapter: 'otopeni', line: [[44.555701, 26.069266], [44.567688, 26.069828], [44.568107, 26.070210], [44.568353, 26.070566], [44.568595, 26.071160], [44.568712, 26.071910], [44.568865, 26.074766], [44.568688, 26.075155], [44.568738, 26.075716], [44.568673, 26.075837], [44.568362, 26.076033], [44.568238, 26.076278], [44.568195, 26.076570], [44.568229, 26.076890], [44.568409, 26.077228], [44.568659, 26.077371], [44.569445, 26.077274], [44.569560, 26.077200]] },
        ],
        circles: [{ lat: 44.569560, lon: 26.077200, r: 200, name: 'otopeni door' }, { lat: 44.556000, lon: 26.070000, r: 110, name: 'otopeni start' }, { lat: 44.569600, lon: 26.077000, r: 120, name: 'otopeni building' }],
        landmarks: ['otp'],
        scenery: [], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/bucharest-otopeni.json traffic.hotspots
            { lat: 44.56200, lon: 26.06970, radius: 400, hours: [[7,  10],  [16.5,  20]], level: 0.65, note: 'DN1 southbound towards Băneasa (Otopeni)' },
            { lat: 44.56960, lon: 26.07700, radius: 150, hours: [[4.5,  7.5],  [15,  20]], level: 0.45, note: 'Departures kerb / ramp' },
        ],
    },
};

export const BUCHAREST = {
    id: 'bucharest',
    name: 'Bucharest',
    country: 'Romania',
    units: 'kmh',
    center: { lat: 44.4268, lon: 26.1025 },
    timeZone: 'Europe/Bucharest',
    data: './data/bucharest.json',
    proj: projector({ lat0: 44.4268, lon0: 26.1025, scale: 0.7, compress: { above: 44.497, factor: 0.35 } }), // whole city drawn at 0.7
    pois: BUC_POIS,
    districts: BUC_DISTRICTS,
    // drive off from Politehnica eastwards along the Dâmbovița
    spawnLL: { lat: 44.4392, lon: 26.0585, road: /Splaiul Independenței/, bearing: 80 },
    spawn: null, // filled in by buildWorld: { edge: [aId, bId], t, dir }
    // named streets lined with dense trees
    treeStreets: /Kiseleff|Aviatorilor|Prezan|Primăverii|Herăstrău|Mareșal Averescu|Dorobanți|Ion Mihalache|Lascăr Catargiu|Bulevardul Unirii/,
    traffic: {
        density: 1.0, chaos: 1.0, parkedChance: 0.6, trams: true, lightCycle: 11,
        // world.trafficProfile(hour): TomTom-style congestion curve for Bucharest (weekday): peaks 07–10 and 16–19 ×1.6,
        // midday ×1.0, night 22–05 ×0.25. Index = local hour (linear interpolation between hours).
        hourly: [0.25, 0.25, 0.25, 0.25, 0.25, 0.3, 0.75, 1.45, 1.6, 1.6, 1.25, 1.05, 1.0, 1.0, 1.05, 1.25, 1.55, 1.6, 1.6, 1.3, 0.9, 0.6, 0.35, 0.25],
        hourlyWeekend: [0.3, 0.25, 0.25, 0.25, 0.25, 0.25, 0.35, 0.5, 0.7, 0.9, 1.05, 1.15, 1.2, 1.2, 1.15, 1.1, 1.1, 1.15, 1.15, 1.05, 0.9, 0.7, 0.5, 0.35],
        // how strongly each road class follows the curve (arterials congest most, side streets barely change)
        classWeights: { motorway: 1.0, motorway_link: 0.9, trunk: 1.1, trunk_link: 0.9, primary: 1.15, primary_link: 0.9, secondary: 1.0, secondary_link: 0.8, tertiary: 0.85, tertiary_link: 0.7, residential: 0.55, unclassified: 0.55, living_street: 0.3, service: 0.3 },
    },
    env: {
        skyTop: '#2b6cb0', skyBottom: '#f6c177', sun: [0.55, 0.42, 0.72], sunColor: '#ffd9a0', sunIntensity: 2.4,
        hemiSky: '#9ec5ff', hemiGround: '#b08a5a', fog: '#e9c79a', fogNear: 220, fogFar: 1300,
        ground: '#8a8a7a', asphalt: '#43434a', sidewalk: '#b7b1a3', grass: '#6a8f45', water: '#3a6f93',
        rain: false, exposure: 1.05, clouds: 0.4,
    },
    bounds: { pad: 300 },
};

// ---------------------------------------------------------------------------
//  SEATTLE / BELLEVUE (all coordinates at half scale: the 25 km drive becomes 12.5 km)
// ---------------------------------------------------------------------------
const SEA_POIS = [
    { id: 'seatac', lat: 47.4435, lon: -122.3016, label: 'SeaTac Airport (SEA)', kind: 'airport' },
    // UiPath Bellevue: Lincoln Square North since Sept 2025; entrance on Bellevue Way NE just south of NE 8th (research: OSM entrance node 7945526075)
    { id: 'uipath-bel', lat: 47.61723, lon: -122.20148, label: 'UiPath Bellevue — Lincoln Square', kind: 'office', address: '700 Bellevue Way NE (Lincoln Square North, since Sept 2025)', road: /Bellevue Way/ },
    // passing landmark on the chapter route (UiPath's Bellevue office 2022–2025): a caption, not a stop
    { id: 'plaza-center', lat: 47.61762, lon: -122.19405, label: 'Plaza Center — UiPath Bellevue 2022–2025', kind: 'office', address: '10900 NE 8th St', road: /8th Street|NE 8th/, passing: true, caption: 'Plaza Center: UiPath\'s Bellevue office from 2022 until the move to Lincoln Square in September 2025.' },
];


const SEA_DISTRICTS = {
    seatac: {
        name: 'SeaTac', label: 'SeaTac — arrivals kerb, terminal loop and the Airport Expressway',
        // round 6 (owner note 53): the chapter starts at the arrivals kerb (it used to start on the expressway, outside the
        // airport); playable area = the whole box round the terminal drives and the Airport Expressway (every road kept)
        bbox: [47.4385, -122.3060, 47.4575, -122.2925], center: { lat: 47.4500, lon: -122.2850 },
        landmarks: ['seatac', 'seatower', 'seagarage', 'sealink', 'rainier', 'olympics'],
        scenery: ['seatac', 'seatower', 'seagarage', 'sealink', 'rainier', 'olympics'], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/seattle-seatac.json traffic.hotspots
            { lat: 47.44400, lon: -122.30000, radius: 250, hours: [[4.5,  7.5],  [11,  14]], level: 0.70, note: 'Departures Drive kerb' },
            { lat: 47.44350, lon: -122.30000, radius: 250, hours: [[11,  14],  [20.5,  24]], level: 0.60, note: 'Arrivals Drive kerb' },
            { lat: 47.46300, lon: -122.26800, radius: 500, hours: [[6.5,  9],  [15,  19]], level: 0.65, note: 'SR-518 EB approaching I-5/I-405 (Southcenter)' },
        ],
    },
    bellevue: {
        name: 'Downtown Bellevue', label: 'I-405 at the NE 8th St exit, NE 8th St, Bellevue Way, Lincoln Square',
        // round 5 (note 43, owner-approved 2026-11-07): playable area = 130 m either side of the chapter route(s), 200 m round each door,
        // 110 m round each start, 120 m round the CV-stop building (routes from the CHAPTERS starts; closures sit at this edge)
        bbox: [47.6138, -122.2051, 47.6198, -122.1839], center: { lat: 47.6145, lon: -122.1950 },
        bands: [
            { r: 130, chapter: 'uipath-bel', line: [[47.617456, -122.187236], [47.617379, -122.187755], [47.617488, -122.196736], [47.617485, -122.201792], [47.616422, -122.201779], [47.616112, -122.201664], [47.616804, -122.201630], [47.617230, -122.201520]] },
        ],
        circles: [{ lat: 47.617230, lon: -122.201520, r: 200, name: 'uipath-bel door' }, { lat: 47.617460, lon: -122.187250, r: 110, name: 'uipath-bel start' }, { lat: 47.617230, lon: -122.201480, r: 120, name: 'uipath-bel building' }],
        landmarks: ['lincoln', 'onelincoln', 'lincolnsouth', 'plazacenter', 'sonic', 'bellevue600', 'bellevuetowers', 'bellevuesq', 'rainier', 'olympics'],
        scenery: ['sonic', 'bellevue600', 'bellevuetowers', 'rainier', 'olympics'], // background only (round 5, notes 9/18): built and visible, but no marker / label / route — not reachable in this district
        congestion: [ // from game/research/seattle-bellevue.json traffic.hotspots (I-90 / Bellevue Way SE entries dropped with those roads)
            { lat: 47.60500, lon: -122.18500, radius: 500, hours: [[6.5,  9.5],  [15,  19]], level: 0.85, note: 'I-405 NB through downtown (SE 8th → NE 8th)' },
            { lat: 47.60900, lon: -122.18700, radius: 450, hours: [[15,  19]], level: 0.90, note: 'I-405 SB Bellevue → Tukwila (opposite carriageway)' },
            { lat: 47.61738, lon: -122.19091, radius: 220, hours: [[16,  18.5]], level: 0.75, note: 'NE 8th St at 112th Ave NE / I-405 ramps' },
            { lat: 47.61020, lon: -122.20150, radius: 160, hours: [[16,  18.5]], level: 0.60, note: 'Bellevue Way × Main St' },
            { lat: 47.61600, lon: -122.20170, radius: 250, hours: [[12,  18]], level: 0.50, note: 'Bellevue Way NE at Bellevue Square/Lincoln Square garages' },
        ],
    },
};

export const SEATTLE = {
    id: 'seattle',
    name: 'Seattle → Bellevue',
    country: 'USA',
    units: 'mph',
    center: { lat: 47.6062, lon: -122.3321 },
    timeZone: 'America/Los_Angeles',
    data: './data/seattle.json',
    proj: projector({ lat0: 47.4435, lon0: -122.3016, scale: 0.5 }),
    pois: SEA_POIS,
    districts: SEA_DISTRICTS,
    // spawn on the straight of the (elevated) Departures Drive in front of the terminal, heading for the SR-518 exit
    spawnLL: { lat: 47.4425, lon: -122.3005, road: /Departures/, bearing: 135 },
    spawn: null,
    treeStreets: /Bellevue Way|NE 8th|Boylston|Lake Washington Boulevard/,
    traffic: {
        density: 0.35, chaos: 0.1, parkedChance: 0, trams: false, lightCycle: 14,
        // Seattle–Bellevue corridor (I-5 / I-90 / I-405 / SR-520): same shape, lower peaks (×1.35 AM, ×1.4 PM)
        hourly: [0.22, 0.2, 0.2, 0.2, 0.25, 0.4, 0.85, 1.3, 1.35, 1.2, 1.0, 0.95, 0.95, 0.95, 1.05, 1.25, 1.4, 1.4, 1.25, 1.0, 0.75, 0.55, 0.4, 0.28],
        hourlyWeekend: [0.25, 0.2, 0.2, 0.2, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95, 1.05, 1.1, 1.1, 1.1, 1.05, 1.05, 1.0, 0.95, 0.85, 0.7, 0.55, 0.42, 0.3],
        classWeights: { motorway: 1.15, motorway_link: 1.0, trunk: 1.0, trunk_link: 0.9, primary: 1.0, primary_link: 0.8, secondary: 0.9, secondary_link: 0.7, tertiary: 0.75, tertiary_link: 0.6, residential: 0.45, unclassified: 0.45, living_street: 0.3, service: 0.3 },
    },
    env: {
        skyTop: '#4b5f7a', skyBottom: '#aeb9c6', sun: [-0.3, 0.5, 0.6], sunColor: '#dde4ec', sunIntensity: 1.6,
        hemiSky: '#b7c4d2', hemiGround: '#5c665a', fog: '#b3bec9', fogNear: 180, fogFar: 1600,
        ground: '#5b6b4e', asphalt: '#2f3136', sidewalk: '#8e918e', grass: '#4f7a3f', water: '#3b5f78',
        rain: true, exposure: 1.12, clouds: 1.0,
    },
    bounds: { pad: 400 },
};

export const CITIES = { bucharest: BUCHAREST, seattle: SEATTLE };

// ---------------------------------------------------------------------------
//  CHAPTERS — story order. Each is played in one district; `start` = where the car is placed (on a legal lane of
//  `road`, facing compass `heading`°), chosen so the drive to the stop is 2–4 km through the district's
//  characteristic streets. `waypoint` chapters have no office: the objective is to drive to that point.
// ---------------------------------------------------------------------------
export const CHAPTERS = [
    { id: 'rosetti', stop: 'rosetti', city: 'bucharest', district: 'floreasca', year: 2009, title: 'High school', intro: 'Floreasca, 2009: up Calea Floreasca from the market to C.A. Rosetti on Str. Garibaldi.',
        start: { lat: 44.4556, lon: 26.10071, heading: 358, road: /^Calea Floreasca$/ } }, // on the one-way northbound Calea Floreasca itself (the old pin lay 55 m west of it and the car could land on parallel Str. Turbinei)
    { id: 'upb', stop: 'upb', city: 'bucharest', district: 'grozavesti', year: 2013, title: 'Politehnica', intro: 'Down Șoseaua Orhideelor beside the Basarab overpass, over Podul Grozăvești and south on Doina Cornea to the Politehnica gate.',
        start: { lat: 44.44849, lon: 26.06540, heading: 242, road: /Orhideelor/ } }, // research start moved 250 m back up Orhideelor (southbound): the door is now the Doina Cornea car gate (the Rectorat's campus roads are private)
    { id: 'gts', stop: 'gts', city: 'bucharest', district: 'unirii', year: 2015, title: 'First job', intro: 'Round Piața Unirii and its fountains, then out along Calea Călărașilor towards Hala Traian.',
        start: { lat: 44.426766, lon: 26.100968, heading: 183, road: /Unirii/ } }, // research: Piața Unirii west side, southbound
    { id: 'luxoft', stop: 'luxoft', city: 'bucharest', district: 'pipera', year: 2017, title: 'Luxoft', intro: 'Pipera, 2017: up Șoseaua Petricani, west on Fabrica de Glucoză past the Globalworth offices, then George Constantinescu to Hermes Business Campus.',
        start: { lat: 44.4730, lon: 26.1243, heading: 350, road: /Petricani/ } }, // Șos. Petricani NB → Fabrica de Glucoză WB → G. Constantinescu NB → Pompeiu WB (Hermes on the right; research route + run-in)
    { id: 'db', stop: 'db', city: 'bucharest', district: 'pipera', year: 2017, title: 'Deutsche Bank', intro: 'Same street, other end: north-east on Șoseaua Pipera past Sky Tower, right on Gara Herăstrău, then along Dimitrie Pompeiu to BOB Tower.',
        start: { lat: 44.47919, lon: 26.0963, heading: 85, road: /Șoseaua Pipera/ } }, // NE-bound from Podul Barbu Văcărescu → right on Gara Herăstrău → left on Pompeiu EB (BOB on the right). The SW-bound start off Podul Pipera needed a U-turn (no left turn into Gara Herăstrău).
    { id: 'arnia', stop: 'arnia', city: 'bucharest', district: 'romana', year: 2019, title: 'Arnia', intro: 'Up Magheru to Piața Romană and along Lascăr Catargiu to Europe House.',
        start: { lat: 44.4418, lon: 26.0988, heading: 0, road: /Magheru|Bălcescu/ } },
    { id: 'uipath-buc', stop: 'uipath-buc', city: 'bucharest', district: 'romana', year: 2020, title: 'UiPath', intro: 'Down Kiseleff into Piața Victoriei and through the streets behind Romană to Vasile Alecsandri.',
        start: { lat: 44.4560, lon: 26.0842, heading: 160, road: /Kiseleff/ } },
    { id: 'otopeni', stop: 'otopeni', city: 'bucharest', district: 'otopeni', year: 2022, title: 'Departure', intro: 'DN1 into Otopeni and up to Henri Coandă departures: a flight to Seattle is waiting.',
        start: { lat: 44.5560, lon: 26.0700, heading: 5, road: /DN1|București-Ploiești|Bucureşti-Ploieşti|Calea Bucureștilor/ } },
    { id: 'seatac', stop: null, city: 'seattle', district: 'seatac', year: 2022, title: 'Welcome to Seattle', intro: 'Landed at SEA: out of the arrivals kerb, round the terminal loop and north on the Airport Expressway toward SR-518.',
        start: { lat: 47.44350, lon: -122.30030, heading: 170, road: /Arrivals Drive/ }, waypoint: { lat: 47.45400, lon: -122.30023, label: 'Airport Expressway north (SR-518 / I-405)' } }, // round 6 (owner note 53): from the arrivals kerb, ~2.0 km via the terminal loop + Airport Expressway, then the montage to Bellevue
    { id: 'uipath-bel', stop: 'uipath-bel', city: 'seattle', district: 'bellevue', year: 2022, title: 'UiPath Bellevue', intro: 'Bellevue: off I-405 on the NE 8th St West loop, west on NE 8th past Plaza Center, then Bellevue Way to Lincoln Square.',
        montageCaption: 'Over Lake Washington on the I-90 floating bridge, across Mercer Island, then north on I-405 to Bellevue.',
        start: { lat: 47.61746, lon: -122.18725, heading: 255, road: /Northeast 8th Street West/ } }, // owner decision (≤ 3 min): bottom of the I-405 NB exit 13B loop, merging onto NE 8th WB (I-405 beside/behind) → past Plaza Center → Bellevue Way → Lincoln Square (1.38 km, ≈ 1:55 at the limits, ≈ 2:30 with expected signal waits)
];

