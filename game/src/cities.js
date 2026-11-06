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
    { id: 'rosetti', lat: 44.4565, lon: 26.1055, label: 'Liceul C.A. Rosetti', kind: 'school', address: 'Str. Giuseppe Garibaldi 11' },
    { id: 'upb', lat: 44.4366, lon: 26.0526, label: 'Politehnica (UPB)', kind: 'school', address: 'Splaiul Independenței 313 (Bd. Doina Cornea gate)', road: /Doina Cornea|Splaiul Independenței|Paul Teodorescu/, roadRadius: 250, size: [60, 22, 40] },
    { id: 'gts', lat: 44.4302, lon: 26.1178, label: 'GTS Global Intelligence', kind: 'office', address: 'Calea Călărașilor 101, lângă Hala Traian', road: /Călărașilor/, junction: [/Călărașilor/, /Traian/], size: [20, 18, 20] },
    { id: 'luxoft', lat: 44.4855, lon: 26.1165, label: 'Luxoft — Hermes Business Campus', kind: 'office', address: 'Bd. Dimitrie Pompeiu 5-7', road: /Pompeiu/, size: [36, 42, 26] },
    { id: 'db', lat: 44.4760, lon: 26.1030, label: 'Deutsche Bank — Floreasca Park', kind: 'office', address: 'Calea Floreasca 169A', road: /Floreasca/, size: [40, 48, 30] },
    { id: 'arnia', lat: 44.4510, lon: 26.0880, label: 'Arnia Software — Europe House', kind: 'office', address: 'Bd. Lascăr Catargiu 47-53', road: /Lascăr Catargiu/, size: [24, 26, 20] },
    { id: 'uipath-buc', lat: 44.4485, lon: 26.0940, label: 'UiPath HQ', kind: 'office', address: 'Str. Vasile Alecsandri 4', road: /Vasile Alecsandri/, size: [28, 24, 24] },
    { id: 'otopeni', lat: 44.5712, lon: 26.0850, label: 'Henri Coandă Airport (OTP)', kind: 'airport' },
];

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
    { id: 'uipath-bel', lat: 47.6175, lon: -122.1955, label: 'UiPath Bellevue — Plaza Center', kind: 'office', address: '10900 NE 8th St (Lincoln Square since 2025)', road: /NE 8th/, size: [34, 70, 30] },
];

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
