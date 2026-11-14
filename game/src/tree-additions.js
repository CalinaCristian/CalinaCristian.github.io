// Measured tree crowns the district's aerial survey missed. Inside survey coverage inferred trees are suppressed by rule, so
// each crown here is read by eye on the aerial mosaic (tools/aerial, Esri World Imagery zoom 19, 0.21 m/px; imagery kept in
// scratch only): centre read off the mosaic and converted with the exact Web Mercator tile maths, radius from the crown's
// width. Positions come from the aerial image, never from a panorama.
//
// Bellevue (r3-look-8): the Bellevue survey (game/research/trees-seattle-bellevue.json) found 1 crown within 16 m of Bellevue Way between 47.6140
// and 47.6195 and 7 along NE 8th St, while the official panorama north of NE 4th (iLkRrRQ1F0GfQpsOWl9O7Q h0) shows medium street
// trees on both sides; the small crowns are re-measured on the mosaic. Crowns in the towers' shadows (most of NE 8th St and
// Bellevue Way between 47.6150 and 47.6185) cannot be read and are not added.
//
// All are placed as measured crowns ('osm' kind): the world builder still refuses any that would stand on a carriageway, in a
// building or under a deck.
const MEASURED_TREE_ADDITIONS = [
    // Bellevue Way NE, west kerb, 47.6187 - 47.6200 (either side of the crossing at about 47.6192)
    ...[[47.619932, -122.20185], [47.619797, -122.20185], [47.619661, -122.20185], [47.619525, -122.20185], [47.619417, -122.20185],
        [47.619059, -122.20185], [47.618965, -122.20185], [47.618871, -122.201856], [47.618775, -122.201856], [47.618679, -122.201856]].map(([lat, lon]) => ({ district: 'bellevue', lat, lon, crownRadiusM: 2.8 })),
    // Bellevue Way NE, east kerb
    { district: 'bellevue', lat: 47.619887, lon: -122.20155, crownRadiusM: 3.2 }, { district: 'bellevue', lat: 47.618987, lon: -122.201521, crownRadiusM: 2.4 },
    { district: 'bellevue', lat: 47.61549, lon: -122.201542, crownRadiusM: 2.8 }, { district: 'bellevue', lat: 47.615381, lon: -122.201542, crownRadiusM: 2.8 },
    // Bellevue Way NE, west side, 47.6142 - 47.6147 (a row along the car park frontage)
    ...[47.614712, 47.614613, 47.614514, 47.614405, 47.614297, 47.614188].map(lat => ({ district: 'bellevue', lat, lon: -122.201872, crownRadiusM: 2.6 })),
    // NE 8th St, south kerb at -122.1996 / -122.1999
    { district: 'bellevue', lat: 47.617349, lon: -122.199938, crownRadiusM: 3.0 }, { district: 'bellevue', lat: 47.617358, lon: -122.19963, crownRadiusM: 3.0 },
    // Romană, the Grigore Antipa museum front on Șos. Kiseleff (w23610985; no OSM natural=tree / tree_row within 250 m): the
    // lawn between the east facade and the footway w303358002 is under continuous canopy on the mosaic, the survey's crowns
    // there are fewer and smaller than the canopy. These are the lit crowns no survey crown covers (bucharest-romana.md § 8).
    { district: 'romana', lat: 44.453027, lon: 26.085067, crownRadiusM: 4.5 }, // purple-leaved crown before the south wing
    { district: 'romana', lat: 44.453174, lon: 26.084976, crownRadiusM: 3.5 }, // before the porch, west half of a broad crown
    { district: 'romana', lat: 44.453174, lon: 26.085046, crownRadiusM: 3.0 }, // before the porch, east half
    { district: 'romana', lat: 44.453322, lon: 26.085059, crownRadiusM: 3.5 }, // before the north wing
];

/** places the district's measured additions with the world's own placeTree (x, z, s, kind, con, dec, opt); returns the count placed */
export function placeTreeAdditions(distId, proj, placeTree) {
    let placed = 0, refused = 0;
    for (const t of MEASURED_TREE_ADDITIONS) {
        if (t.district !== distId) continue;
        const p = proj(t.lat, t.lon);
        if (placeTree(p.x, p.z, 1, 'osm', false, 1, { crownRadiusM: t.crownRadiusM, h: t.crownRadiusM * 3 })) placed++; else refused++;
    }
    return { placed, refused };
}
