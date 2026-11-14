// Measured street-tree crowns the district's aerial survey missed (r3-look-8, 2026-11-13).
//
// The Bellevue survey (game/research/trees-seattle-bellevue.json) found 1 crown within 16 m of Bellevue Way between 47.6140
// and 47.6195 and 7 along NE 8th St, while the official panorama north of NE 4th (iLkRrRQ1F0GfQpsOWl9O7Q h0) shows medium street
// trees on both sides. Inside survey coverage inferred street trees are suppressed by rule, so the small crowns were re-measured
// by eye on the aerial mosaic (Esri World Imagery, zoom 19, 0.20 m/px; tools/aerial method, imagery kept in scratch only): each
// entry is a crown centre read off the mosaic and converted with the exact Web Mercator tile maths, radius from the crown's
// width. Positions come from the aerial image, never from a panorama. Crowns in the towers' shadows (most of NE 8th St and
// Bellevue Way between 47.6150 and 47.6185) could not be read and are not added. They are placed as measured crowns ('osm' kind): the world
// builder still refuses any that would stand on a carriageway, in a building or under a deck.
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
