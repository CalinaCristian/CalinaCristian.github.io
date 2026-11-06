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
    { id: 'upb', lat: 44.4366, lon: 26.0526, label: 'Politehnica (UPB)', kind: 'school', address: 'Splaiul Independenței 313 (Bd. Doina Cornea gate)', road: /Doina Cornea|Splaiul Independenței|Paul Teodorescu/, roadRadius: 250, size: [60, 22, 40] },
    { id: 'gts', lat: 44.4333, lon: 26.11762, label: 'GTS Global Intelligence', kind: 'office', address: 'Calea Călărașilor 101, lângă Hala Traian', road: /Călărașilor/, size: [20, 18, 20] }, // research: N side, ~240 m west of the Traian junction
    { id: 'luxoft', lat: 44.4855, lon: 26.1165, label: 'Luxoft — Hermes Business Campus', kind: 'office', address: 'Bd. Dimitrie Pompeiu 5-7', road: /Pompeiu/, size: [36, 42, 26] },
    { id: 'db', lat: 44.4760, lon: 26.1030, label: 'Deutsche Bank — Floreasca Park', kind: 'office', address: 'Calea Floreasca 169A', road: /Floreasca/, size: [40, 48, 30] },
    { id: 'arnia', lat: 44.45118, lon: 26.08795, label: 'Arnia Software — Europe House', kind: 'office', address: 'Bd. Lascăr Catargiu 47-53', road: /Lascăr Catargiu/, size: [24, 26, 20] },
    { id: 'uipath-buc', lat: 44.4499, lon: 26.0944, label: 'UiPath HQ', kind: 'office', address: 'Str. Vasile Alecsandri 4', road: /Vasile Alecsandri/, size: [28, 24, 24] },
    { id: 'otopeni', lat: 44.5712, lon: 26.0850, label: 'Henri Coandă Airport (OTP)', kind: 'airport' },
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
        bbox: [44.4335, 26.0460, 44.4490, 26.0725], center: { lat: 44.4412, lon: 26.0592 },
        landmarks: ['politehnica'],
        congestion: [ // from game/research/bucharest-grozavesti.json traffic.hotspots
            { lat: 44.44370, lon: 26.06120, radius: 180, hours: [[7.5,  10],  [16.5,  19.5]], level: 0.65, note: 'Podul Grozăvești / Orhideelor' },
            { lat: 44.43460, lon: 26.05450, radius: 160, hours: [[7.5,  9.5],  [16,  19]], level: 0.60, note: 'Iuliu Maniu × Doina Cornea (Politehnica)' },
            { lat: 44.43810, lon: 26.05540, radius: 100, hours: [[7.5,  9],  [15,  18]], level: 0.35, note: 'UPB gates (term time)' },
        ],
    },
    unirii: {
        name: 'Unirii', label: 'Piața Unirii, Calea Călărașilor, Hala Traian',
        bbox: [44.4230, 26.0975, 44.4365, 26.1205], center: { lat: 44.4297, lon: 26.1090 },
        landmarks: ['unirea', 'fountains'],
        congestion: [ // from game/research/bucharest-unirii.json traffic.hotspots
            { lat: 44.42680, lon: 26.10250, radius: 250, hours: [[7.5,  10],  [16,  19.5]], level: 0.90, note: 'Piața Unirii (all arms, Pasajul Unirii)' },
            { lat: 44.43230, lon: 26.11180, radius: 150, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Bd. Mircea Vodă × Coposu × Călărașilor' },
            { lat: 44.43320, lon: 26.12050, radius: 120, hours: [[8,  10],  [16,  19]], level: 0.50, note: 'Calea Călărașilor × Traian (Hala Traian)' },
        ],
    },
    romana: {
        name: 'Romană & Victoriei', label: 'Piața Romană, Bd. Lascăr Catargiu, Piața Victoriei, Vasile Alecsandri',
        bbox: [44.4395, 26.0825, 44.4570, 26.1000], center: { lat: 44.4483, lon: 26.0912 },
        landmarks: ['victoria', 'ase', 'ambasador'],
        congestion: [ // from game/research/bucharest-romana.json traffic.hotspots
            { lat: 44.45260, lon: 26.08580, radius: 220, hours: [[7.5,  10],  [16,  19.5]], level: 0.90, note: 'Piața Victoriei' },
            { lat: 44.44680, lon: 26.09700, radius: 160, hours: [[7.5,  10],  [16,  19.5]], level: 0.85, note: 'Piața Romană' },
            { lat: 44.44920, lon: 26.09150, radius: 450, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Bd. Lascăr Catargiu (whole length)' },
            { lat: 44.45050, lon: 26.09850, radius: 200, hours: [[8,  10],  [17,  19]], level: 0.60, note: 'Calea Dorobanților (south, one-way)' },
        ],
    },
    floreasca: {
        name: 'Floreasca', label: 'Calea Floreasca, Barbu Văcărescu, Floreasca Park, the lake shore',
        bbox: [44.4540, 26.0960, 44.4790, 26.1120], center: { lat: 44.4665, lon: 26.1040 },
        landmarks: ['skytower', 'promenada'],
        congestion: [ // from game/research/bucharest-floreasca.json traffic.hotspots
            { lat: 44.47100, lon: 26.10350, radius: 200, hours: [[8,  10],  [17,  19.5]], level: 0.70, note: 'Calea Floreasca N (towards Barbu Văcărescu / Sky Tower)' },
            { lat: 44.46650, lon: 26.10550, radius: 140, hours: [[7.5,  8.25],  [13,  14.5]], level: 0.45, note: 'Rosetti school run (Garibaldi/Ceaikovski)' },
            { lat: 44.46050, lon: 26.10050, radius: 120, hours: [[9,  13]], level: 0.40, note: 'Piața Floreasca market' },
        ],
    },
    pipera: {
        name: 'Pipera', label: 'Bd. Dimitrie Pompeiu, Barbu Văcărescu north, Hermes / Novo Park',
        bbox: [44.4745, 26.1010, 44.4900, 26.1240], center: { lat: 44.4822, lon: 26.1125 },
        landmarks: ['hermes'],
        congestion: [
            { lat: 44.4850, lon: 26.1160, radius: 250, hours: RUSH, level: 0.9, note: 'Bd. Dimitrie Pompeiu (Pipera offices)' },
            { lat: 44.4795, lon: 26.1095, radius: 160, hours: RUSH, level: 0.7, note: 'Barbu Văcărescu × Pipera bridge' },
        ],
    },
    otopeni: {
        name: 'Otopeni', label: 'DN1 at Otopeni and the Henri Coandă terminal (OTP)',
        bbox: [44.5520, 26.0620, 44.5780, 26.0930], center: { lat: 44.5650, lon: 26.0770 },
        rRoute: 260,
        route: [{ lat: 44.5560, lon: 26.0700, road: /DN1|București-Ploiești|Bucureşti-Ploieşti|Calea Bucureștilor/, bearing: 0, name: 'DN1 Otopeni' },
            { lat: 44.5712, lon: 26.0850, name: 'Otopeni terminal' }],
        circles: [{ lat: 44.5712, lon: 26.0850, r: 600, name: 'OTP terminal' }],
        landmarks: ['otp'],
        congestion: [
            { lat: 44.5600, lon: 26.0700, radius: 300, hours: RUSH, level: 0.6, note: 'DN1 Otopeni (towards Băneasa)' },
            { lat: 44.5705, lon: 26.0830, radius: 150, hours: [[5, 8], [16, 20]], level: 0.4, note: 'OTP departures kerb' },
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
    { id: 'uipath-bel', lat: 47.61723, lon: -122.20148, label: 'UiPath Bellevue — Lincoln Square', kind: 'office', address: '700 Bellevue Way NE (Lincoln Square North, since Sept 2025)', road: /Bellevue Way/, size: [34, 70, 30] },
    // passing landmark on the chapter route (UiPath's Bellevue office 2022–2025): a caption, not a stop
    { id: 'plaza-center', lat: 47.6175, lon: -122.1955, label: 'Plaza Center — UiPath Bellevue 2022–2025', kind: 'office', address: '10900 NE 8th St', road: /8th Street|NE 8th/, passing: true, caption: 'Plaza Center: UiPath\'s Bellevue office from 2022 until the move to Lincoln Square in September 2025.', size: [34, 60, 30] },
];


const SEA_DISTRICTS = {
    seatac: {
        name: 'SeaTac', label: 'SeaTac — terminal drives and SR-518 to the I-5 junction',
        bbox: [47.4330, -122.3130, 47.4700, -122.2560], center: { lat: 47.4500, lon: -122.2850 },
        rRoute: 260,
        route: [{ lat: 47.4425, lon: -122.3005, road: /Departures/, bearing: 135, name: 'Departures' },
            
            { lat: 47.4648, lon: -122.2665, road: /SR-518/, bearing: 90, motorway: true, name: 'SR-518 at I-5' }],
        circles: [{ lat: 47.4435, lon: -122.3016, r: 600, name: 'terminal' }, { lat: 47.4650, lon: -122.2640, r: 350, name: 'I-5 / SR-518' }],
        landmarks: ['seatac', 'seatower', 'rainier', 'olympics'],
        congestion: [ // from game/research/seattle-seatac.json traffic.hotspots
            { lat: 47.44400, lon: -122.30000, radius: 250, hours: [[4.5,  7.5],  [11,  14]], level: 0.70, note: 'Departures Drive kerb' },
            { lat: 47.44350, lon: -122.30000, radius: 250, hours: [[11,  14],  [20.5,  24]], level: 0.60, note: 'Arrivals Drive kerb' },
            { lat: 47.46300, lon: -122.26800, radius: 500, hours: [[6.5,  9],  [15,  19]], level: 0.65, note: 'SR-518 EB approaching I-5/I-405 (Southcenter)' },
        ],
    },
    bellevue: {
        name: 'Lake Washington & Bellevue', label: 'I-90 floating bridges, Mercer Island, I-405, downtown Bellevue',
        bbox: [47.5740, -122.3060, 47.6240, -122.1760], center: { lat: 47.5980, lon: -122.2350 },
        // research (seattle-bellevue.json district.corridorPolygons): bands along I-90 and I-405 + the downtown core
        bands: [
            { r: 250, line: [[47.59, -122.306], [47.5899, -122.2857], [47.5892, -122.2547], [47.5911, -122.2404], [47.5843, -122.2248], [47.5787, -122.2076], [47.5797, -122.1934], [47.5791, -122.182]] },
            { r: 200, line: [[47.5785, -122.176], [47.5847, -122.1773], [47.5982, -122.1798], [47.6034, -122.1844], [47.6074, -122.1874], [47.6165, -122.1885], [47.6195, -122.1889]] },
            { r: 120, line: [[47.5834, -122.1887], [47.5875, -122.1915], [47.5938, -122.1952], [47.5969, -122.1984], [47.6012, -122.2005], [47.6076, -122.2014], [47.6101, -122.2015]] },
        ],
        poly: [[47.6075, -122.2075], [47.6075, -122.1850], [47.6235, -122.1850], [47.6235, -122.2075]], // downtown core (Main St → NE 12th × 100th Ave NE → I-405)
        landmarks: ['mtbaker', 'lincoln', 'bellevuetowers', 'bellevuesq', 'rainier', 'olympics'],
        congestion: [ // from game/research/seattle-bellevue.json traffic.hotspots
            { lat: 47.60000, lon: -122.18100, radius: 900, hours: [[6.5,  9.5],  [15,  19]], level: 0.85, note: 'I-405 NB (Tukwila/Renton → Bellevue) through SE 8th → NE 8th' },
            { lat: 47.60500, lon: -122.18400, radius: 800, hours: [[15,  19]], level: 0.90, note: 'I-405 SB Bellevue → Tukwila (opposite carriageway)' },
            { lat: 47.59000, lon: -122.26000, radius: 1500, hours: [[7.5,  9.5],  [15.5,  18.5]], level: 0.80, note: 'I-90 WB (Bellevue → Seattle) on the Hadley bridge — OPPOSITE carriageway, visible beside t' },
            { lat: 47.58950, lon: -122.26000, radius: 1500, hours: [[16.5,  18]], level: 0.35, note: 'I-90 EB (the player’s direction)' },
            { lat: 47.61738, lon: -122.19091, radius: 220, hours: [[16,  18.5]], level: 0.75, note: 'NE 8th St at 112th Ave NE / I-405 ramps' },
            { lat: 47.61020, lon: -122.20150, radius: 160, hours: [[16,  18.5]], level: 0.60, note: 'Bellevue Way × Main St' },
            { lat: 47.58800, lon: -122.19250, radius: 500, hours: [[15.5,  18.5]], level: 0.55, note: 'Bellevue Way SE southbound to I-90 (route B opposite direction)' },
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
        start: { lat: 44.4565, lon: 26.1000, heading: 8, road: /Calea Floreasca/ } }, // Calea Floreasca northbound, 400 m before Piața Floreasca (research start + a longer run-in)
    { id: 'upb', stop: 'upb', city: 'bucharest', district: 'grozavesti', year: 2013, title: 'Politehnica', intro: 'Down Șoseaua Orhideelor under the Basarab overpass, over Podul Grozăvești and along the Splai to the Politehnica gate.',
        start: { lat: 44.447432, lon: 26.062618, heading: 242, road: /Orhideelor/ } }, // research: Șos. Orhideelor southbound (the owner's way from home)
    { id: 'gts', stop: 'gts', city: 'bucharest', district: 'unirii', year: 2015, title: 'First job', intro: 'Round Piața Unirii and its fountains, then out along Calea Călărașilor towards Hala Traian.',
        start: { lat: 44.426766, lon: 26.100968, heading: 183, road: /Unirii/ } }, // research: Piața Unirii west side, southbound
    { id: 'luxoft', stop: 'luxoft', city: 'bucharest', district: 'pipera', year: 2017, title: 'Luxoft', intro: 'Up Barbu Văcărescu and over to Bd. Dimitrie Pompeiu: the Pipera office park.',
        start: { lat: 44.4752, lon: 26.1032, heading: 40, road: /Barbu Văcărescu/ } },
    { id: 'db', stop: 'db', city: 'bucharest', district: 'floreasca', year: 2017, title: 'Deutsche Bank', intro: 'North on Calea Floreasca, past Rosetti and the lake shore, to Floreasca Park.',
        start: { lat: 44.4575, lon: 26.1010, heading: 10, road: /Calea Floreasca/ } },
    { id: 'arnia', stop: 'arnia', city: 'bucharest', district: 'romana', year: 2019, title: 'Arnia', intro: 'Up Magheru to Piața Romană and along Lascăr Catargiu to Europe House.',
        start: { lat: 44.4418, lon: 26.0988, heading: 0, road: /Magheru|Bălcescu/ } },
    { id: 'uipath-buc', stop: 'uipath-buc', city: 'bucharest', district: 'romana', year: 2020, title: 'UiPath', intro: 'Down Kiseleff into Piața Victoriei and through the streets behind Romană to Vasile Alecsandri.',
        start: { lat: 44.4560, lon: 26.0842, heading: 160, road: /Kiseleff/ } },
    { id: 'otopeni', stop: 'otopeni', city: 'bucharest', district: 'otopeni', year: 2022, title: 'Departure', intro: 'DN1 into Otopeni and up to Henri Coandă departures: a flight to Seattle is waiting.',
        start: { lat: 44.5560, lon: 26.0700, heading: 5, road: /DN1|București-Ploiești|Bucureşti-Ploieşti|Calea Bucureștilor/ } },
    { id: 'seatac', stop: null, city: 'seattle', district: 'seatac', year: 2022, title: 'Welcome to Seattle', intro: 'Out of SeaTac: Departures Drive and SR-518 east to the I-5 junction.',
        start: { lat: 47.44557, lon: -122.29902, heading: 200, road: /Departures/ }, waypoint: { lat: 47.46195, lon: -122.26779, label: 'SR-518 east: I-405 / I-5 split' } }, // research
    { id: 'uipath-bel', stop: 'uipath-bel', city: 'seattle', district: 'bellevue', year: 2022, title: 'UiPath Bellevue', intro: 'Across Lake Washington on the I-90 floating bridge, over Mercer Island, up I-405 into downtown Bellevue.',
        start: { lat: 47.5893, lon: -122.2700, heading: 90, road: /^I-90\b/ } }, // owner: eastbound on the Lacey V. Murrow floating bridge, mid-lake
];

