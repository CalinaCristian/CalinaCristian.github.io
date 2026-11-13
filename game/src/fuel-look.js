// ============================================================================
//  FUEL LOOK — what the fuel stations of the eight chapter districts look like, from the street-level review
//  (fidelity pass round 3, 2026-11-13; every station compared with official Street View panoramas, records below and in
//  game/research/fuel-stations-review.json).
//
//  OSM decides where a station is and what brand it carries (`amenity=fuel`, `brand`, the mapped `building=roof`
//  canopy). OSM maps no pumps and no price pylon at any of these stations, and no brand has a colour in Wikidata (P465
//  checked for all nine brands), so the look is a brand class seen at the stations themselves:
//    fascia      main colour of the canopy edge;  band / bandAt / bandFrac: a second stripe along the bottom (or top);
//    soffit      canopy underside (white at every station seen);  column: the canopy column cladding;
//    sign        [background, letters, accent] of the brand board on the canopy and on the pylon;
//    pylon       { body, cap } of the price pylon, where one was seen.
//  Colours are tone classes read by eye, not sampled pixels. Per station (keyed by the canopy's OSM id, or by brand +
//  mapped position for a station without a mapped canopy) a row says whether a pylon was seen and roughly where
//  (`pylon: { lat, lon }`: an estimate from the panorama bearing and apparent distance, ±10 m; the emitter puts the pylon
//  on the nearest free ground there), or that none was seen (`pylon: 'none'`), and the panoramas it rests on.
//  No price, fuel grade or shop name is drawn; a station that a panorama shows under another brand than OSM's keeps its
//  OSM identity in the data, and its row records the documented exception (`seenBrand`); its canopy, pylon, building name
//  and map label (world.js) follow the row's `text`.
// ============================================================================

export const FUEL_LOOK = {
    mol: { fascia: '#86c440', band: '#2f8f3a', bandAt: 'bottom', bandFrac: 0.3, soffit: '#eeeeea', column: '#ececec', sign: ['#86c440', '#ffffff', '#ffffff'], pylon: { body: '#4f9a35', cap: '#e2001a' } },
    omv: { fascia: '#86c440', band: '#2a8a3e', bandAt: 'bottom', bandFrac: 0.3, soffit: '#eeeeea', column: '#1c4f9c', sign: ['#1c4f9c', '#ffffff', '#86c440'], pylon: { body: '#f2f3f4', cap: '#1c4f9c' } },
    lukoil: { fascia: '#e30613', soffit: '#efefec', column: '#e8e8e6', sign: ['#e30613', '#ffffff', '#ffffff'], pylon: { body: '#f2f2f0', cap: '#e30613' } },
    petrom: { fascia: '#ffd200', band: '#1d4f9c', bandAt: 'bottom', bandFrac: 0.22, soffit: '#eeeeea', column: '#1d4f9c', sign: ['#ffd200', '#1d4f9c', '#1d4f9c'], pylon: { body: '#f2f2f0', cap: '#1d4f9c' } },
    gazprom: { fascia: '#174f9e', band: '#4fa0d8', bandAt: 'bottom', bandFrac: 0.3, soffit: '#eeeeea', column: '#174f9e', sign: ['#174f9e', '#ffffff', '#4fa0d8'], pylon: { body: '#f2f3f4', cap: '#174f9e' } },
    rompetrol: { fascia: '#f5f5f2', band: '#f39200', bandAt: 'bottom', bandFrac: 0.35, soffit: '#eeeeea', column: '#f39200', sign: ['#ffffff', '#f39200', '#e30613'], pylon: { body: '#f4f4f2', cap: '#f39200' } },
    shell: { fascia: '#ffd500', band: '#dd1d21', bandAt: 'bottom', bandFrac: 0.4, soffit: '#f0f0ee', column: '#f0f0ee', sign: ['#ffd500', '#dd1d21', '#dd1d21'], pylon: { body: '#f0f0ee', cap: '#ffd500' } },
    '76': { fascia: '#d9dadb', band: '#f47920', bandAt: 'top', bandFrac: 0.18, soffit: '#eeeeea', column: '#e6e6e4', sign: ['#f47920', '#0055a5', '#0055a5'], pylon: { body: '#e6e6e4', cap: '#f47920' } },
    arco: { fascia: '#1f5fae', soffit: '#eeeeea', column: '#eeeeea', sign: ['#1f5fae', '#ffffff', '#e2231a'], pylon: { body: '#eeeeea', cap: '#1f5fae' } },
};

const P = (id, lat, lon, heading) => `panorama ${id} (${lat}, ${lon}) heading ${heading}`;

// Per station. key: canopy OSM id (`w…`), or `poi:<brand>@lat,lon` for a station whose canopy is not mapped.
export const FUEL_STATION_REVIEW = {
    'bucharest-floreasca': {
        w235639134: { brand: 'MOL', pylon: { lat: 44.465672, lon: 26.108805 }, pylonLook: { body: '#3b4045', cap: '#86c440' },
            seen: 'lime-green fascia with white MOL letters and a darker green lower band, white soffit, white round columns, green pump islands; dark grey pylon with a green edge in a kerbed bed between the forecourt and Str. Barbu Văcărescu, by the south entrance',
            evidence: [P('rt_5dQilD9RWXQ93yElt2w', 44.465646, 26.108857, '33 / 290'), P('JP23iWj1iHarqB7b0BfNkA', 44.465912, 26.108943, 169)] },
    },
    'bucharest-grozavesti': {
        w239359996: { brand: 'OMV', pylon: { lat: 44.438331, lon: 26.056313 }, islandsBesideLane: true,
            seen: 'green fascia with a blue OMV panel, white soffit, blue-clad columns, two pump islands either side of the drive lane; white pylon with a blue head by the grass at the west entrance (Bd. Doina Cornea)',
            evidence: [P('o-A84Hr8qgnnLr-yuzR3ag', 44.438328, 26.056375, 85), P('MvkbucAsNkIDNRPMJ6Q9Ag', 44.438534, 26.056561, 172)] },
        w256806132: { brand: 'Lukoil', pylon: 'none',
            seen: 'red fascia with white LUKOIL letters, white soffit, red-clad columns; no pylon on the Șos. Orhideelor frontage (a billboard stands there)',
            evidence: [P('hGqephV5yIK6jWNVMdcHBw', 44.446305, 26.060395, 70), P('FxOOz6e8e3HgHwgY0fxicg', 44.44658, 26.060338, 137)] },
        w237830689: { brand: 'Petrom', pylon: 'none',
            seen: 'yellow fascia with blue curved accents, round blue columns, white soffit, canopy wrapping the kiosk; no pylon seen from either street',
            evidence: [P('dfKJPktXMs74JuwfOWbUDQ', 44.451702, 26.073522, 88), P('lScnlaZqLyfRA7Kzl9V6nQ', 44.451538, 26.073734, 358)] },
        w326062450: { brand: 'MOL', seen: 'open canopy on columns with a green MOL fascia and a small kiosk (the pack had a closed block; OSM brand=MOL on the way itself); no fuel POI in the pack, so no pumps / pylon are drawn',
            evidence: [P('PXJbcAsSr6l3B5-zQqqutA', 44.445115, 26.074413, 124)] },
    },
    'bucharest-unirii': {
        w263315803: { brand: 'OMV', pylon: { lat: 44.4312, lon: 26.10988 },
            seen: 'green fascia with a blue OMV panel, white soffit, blue-and-white clad columns, islands with blue bases; white / blue pylon south-west of the canopy by the street',
            evidence: [P('XTVqSWyob94uGXTDzkYZFg', 44.431121, 26.110035, 45), P('D1ZNjm-lmugZGMje_XXCGg', 44.431349, 26.110228, 189)] },
        w670595374: { brand: 'MOL', pylon: { lat: 44.4316, lon: 26.11082 },
            seen: 'green fascia with white MOL letters; curved green MOL pylon with the red logo at the west entrance',
            evidence: [P('h16qhTmS_zN0GfsQ2P6rIA', 44.43178, 26.110786, 140), P('7VQRohD43rltUvsClUDt_Q', 44.431678, 26.110699, 103)] },
    },
    'bucharest-pipera': {
        w241976323: { brand: 'Petrom', pylon: 'none',
            seen: 'long yellow fascia, blue square-clad columns, white soffit, yellow / blue / red shop front; no pylon on the Șos. Pipera frontage or at the west end',
            evidence: [P('zLWCouEoyC82uJ90Q-pXdA', 44.479372, 26.098716, 356), P('zy0-QE4qE154VeHmviOP0A', 44.479444, 26.098493, '49 / 250')] },
        w547396767: { brand: 'Lukoil', pylon: { lat: 44.48035, lon: 26.10203 },
            seen: 'red fascia with white LUKOIL letters, white soffit, red / white columns, minimarket beside it; white pylon with a red head at the north-east entrance',
            evidence: [P('VrpS5Xl6H0bPq1iUAjN4-w', 44.480106, 26.101976, 342), P('WAU_Ey5duTIjThXrwFsqcA', 44.480467, 26.102105, 218)] },
    },
    'bucharest-otopeni': {
        w918040928: { brand: 'Gazprom', pylon: { lat: 44.55810, lon: 26.06971 },
            seen: 'dark blue fascia with a light blue band, blue columns, white soffit, flag masts at the DN1 frontage; white pylon with the blue logo at the south end of the frontage',
            evidence: [P('ruj2lFmYlbzU5U31pcteyQ', 44.558241, 26.069286, 87), P('7c-Lsllq2RjtY7Wyb3ITGg', 44.55837, 26.069389, 120)] },
        w312547071: { brand: 'Rompetrol', pylon: { lat: 44.560697, lon: 26.06979 },
            seen: 'white fascia with an orange lower band and the red drop logo, orange columns; white pylon with the logo by DN1',
            evidence: [P('rwBEQtyul8wwideP-uqqYQ', 44.560742, 26.069501, 81), P('ugmV2tKj3xdC4nMf5Vme5Q', 44.560931, 26.069601, 130)] },
        w918040922: { brand: 'Rompetrol', pylon: { lat: 44.561327, lon: 26.06913 },
            seen: 'white fascia with the orange band and the rompetrol logo, orange columns; slim white pylon beside the flag masts on the DN1 frontage',
            evidence: [P('S-NLftUc9aS5ox2xY6-tLA', 44.561153, 26.06884, 19), P('7DPejJPO8OrQJAdWxso_3A', 44.56146, 26.069094, 225)] },
        w244429098: { brand: 'OMV', seenBrand: 'mol', text: 'MOL', pylon: { lat: 44.5668, lon: 26.07006 },
            seen: 'a MOL station: green fascia with white MOL letters, white columns, green MOL pylon at the south end by DN1. OSM still says brand=OMV (its own brand:wikipedia tag already reads en:MOL (company)): documented exception, drawn and labelled on the map as seen (r3-look-2); the data keeps the OSM brand',
            evidence: [P('NDGwi1S_sXzOjXEXu_Xs8w', 44.566864, 26.070119, 16), P('iNwZVPNKq8h9KgXzPzc8YA', 44.567234, 26.070075, 152)] },
    },
    'seattle-seatac': {
        // (r3-look-3) OSM maps the station as a node (n824050627) but its two canopies as untagged building=roof, layer=1 ways
        // w647569414 / w647566814 (covered service ways under them, maxheight 13'0''); the pack already carries both as open canopies.
        // canopies ties them to the node: pumps under each, the brand look on both, the pylon by the nearer one (w647569414)
        'poi:shell@47.450517,-122.295791': { brand: 'Shell', pylon: { lat: 47.450584, lon: -122.295732 }, canopies: ['w647569414', 'w647566814'],
            seen: 'white canopies with a yellow / red fascia stripe over the pumps in front of the Food Mart; slim white pylon with the Shell sign at the corner of International Blvd / S 170th',
            evidence: [P('fmPpufJiQj3Z0heB49Z9MQ', 47.450512, -122.295971, 87), 'OSM w647569414 / w647566814 building=roof layer=1'] },
        w647569414: { brand: 'Shell', pylon: { lat: 47.450584, lon: -122.295732 }, seen: 'Shell canopy by the pylon (see the station row above)', evidence: [P('fmPpufJiQj3Z0heB49Z9MQ', 47.450512, -122.295971, 87)] },
        w647566814: { brand: 'Shell', pylon: 'none', seen: 'second Shell canopy, north-west of the first (see the station row above)', evidence: [P('fmPpufJiQj3Z0heB49Z9MQ', 47.450512, -122.295971, 87)] },
        w433205179: { brand: '76', pylon: 'none',
            seen: 'light grey fascia with a thin orange top line, kiosk under the canopy; no pylon on the International Blvd frontage (an older panorama shows a red fascia: rebranded since)',
            evidence: [P('bpGv_kTfou2TMftytaQqEQ', 47.451014, -122.295834, 98), P('MPSenMWz4D9YPpME0MO0DA', 47.450952, -122.295066, 275)] },
    },
    'seattle-bellevue': {
        'poi:arco@47.617073,-122.184892': { brand: 'Arco', pylon: 'none',
            seen: 'blue fascia over two pump islands; no pylon identified from the nearest panorama (a small sign on a pole only)',
            evidence: [P('ZPhc55a5IH684ZTmf463zw', 47.617048, -122.185186, 83)] },
    },
};

const lookKey = (text) => { const k = String(text || '').toLowerCase(); for (const b of Object.keys(FUEL_LOOK)) if (new RegExp('(^|[^\\p{L}\\p{N}])' + b + '($|[^\\p{L}\\p{N}])', 'u').test(k)) return b; return null; };

/** the review row of a station: by canopy OSM id, else by brand and mapped position (project(lat, lon) -> {x, z}) */
export function fuelStationRow(key, sourceId, label = '', x = null, z = null, project = null) {
    const rows = FUEL_STATION_REVIEW[key]; if (!rows) return null;
    if (sourceId && rows[sourceId]) return { id: sourceId, ...rows[sourceId] };
    if (x == null || !project) return null;
    for (const [id, r] of Object.entries(rows)) {
        const m = /^poi:([^@]+)@(-?[\d.]+),(-?[\d.]+)$/.exec(id); if (!m || lookKey(label) !== m[1]) continue;
        const q = project(+m[2], +m[3]); if (Math.hypot((q.x ?? q[0]) - x, (q.z ?? q[1]) - z) < 30) return { id, ...r };
    }
    return null;
}

/** the look of a station (brand class + row overrides) or null for a brand without a reviewed class */
export function fuelLookFor(text, row = null) {
    const k = row?.seenBrand || lookKey(text); const L = k && FUEL_LOOK[k]; if (!L) return null;
    return { key: k, text: row?.text || null, ...L, pylon: row?.pylon === 'none' ? null : { ...L.pylon, ...(row?.pylonLook || {}) } };
}

/** the fascia wall [a0, b0, b1, a1] (bottom a→b, then top) as one or two coloured quads: [{ v, col }] (col null = fascia) */
export function fasciaQuads(wall, look) {
    const v = wall.vertices; if (!look?.band) return [{ v, col: null }];
    const f = look.bandFrac || 0.3, lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const t = look.bandAt === 'top' ? 1 - f : f, m0 = lerp(v[0], v[3], t), m1 = lerp(v[1], v[2], t);
    const lower = [v[0], v[1], m1, m0], upper = [m0, m1, v[2], v[3]];
    return look.bandAt === 'top' ? [{ v: lower, col: null }, { v: upper, col: look.band }] : [{ v: lower, col: look.band }, { v: upper, col: null }];
}
