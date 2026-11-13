// ============================================================================
//  FUEL CANOPY REVIEW — OSM `building=roof` fuel canopies that the district packs carry as closed blocks
//  (fidelity pass round 2, 2026-11-12). Each row was looked at in an official street-level panorama: an open canopy on
//  columns over the pumps. The row adds the same reviewed-canopy record the builder writes into `buildingCanopies`
//  (game/data/README.md), so world.js draws the open roof, its fascia and the forecourt (fuel-forecourt.js).
//  Footprint and identity stay the district data's. A height tagged in OSM wins (Lukoil: OSM height=3, kept although the
//  panorama suggests a higher roof: listed in the backlog); otherwise top and clearance are estimates and say so.
// ============================================================================

const EST = { topSource: 'estimate', clearanceSource: 'estimate', supportSource: 'estimate', estimateSupports: true, supportWidthM: 0.4,
    dimensionNote: 'Clearance, slab thickness and support arrangement are explicit authoring estimates; open canopy on columns seen in the panorama.' };

export const FUEL_CANOPY_REVIEW = {
    'bucharest-grozavesti': {
        w256806132: { ...EST, topM: 3, clearanceM: 2.6, topSource: 'OSM height', classificationSource: 'r2 street-level review', evidence: ['OSM w256806132 building=roof, amenity=fuel (Lukoil), height=3', 'panorama hGqephV5yIK6jWNVMdcHBw (44.446305, 26.060395) heading 70: open canopy on white columns, red fascia'] },
        w237830689: { ...EST, topM: 5.4, clearanceM: 4.6, classificationSource: 'r2 street-level review', evidence: ['OSM w237830689 building=roof (Petrom)', 'panorama dEYcD3j7N8Vy0WbKBbGDtA (44.451717, 26.073637) heading 40: canopy on round blue columns over the shop front'] },
        // (r3, 2026-11-13) MOL Bd. Dinicu Golescu 29: the pack has no fuel POI on it, so the brand comes from the way's own
        // OSM tags (brand=MOL, amenity=fuel); no pumps or pylon are drawn without the POI
        w326062450: { ...EST, topM: 5.4, clearanceM: 4.6, brand: 'MOL', classificationSource: 'r3 street-level review', evidence: ['OSM w326062450 building=roof, amenity=fuel, brand=MOL, layer=1', 'panorama PXJbcAsSr6l3B5-zQqqutA (44.445115, 26.074413) heading 124: open canopy on columns with a green MOL fascia over the pumps, small kiosk'] },
    },
    'bucharest-floreasca': {
        w235639134: { ...EST, topM: 5.4, clearanceM: 4.6, classificationSource: 'r2 street-level review', evidence: ['OSM w235639134 building=roof (MOL)', 'panorama -b_uOZJ5oACAjuUjodA6nQ (44.465747, 26.108980) headings 110 / 290: white canopy on a row of round columns over the islands'] },
    },
};

/** bRecs: the district's building records (world.js). Returns the list applied. */
export function applyFuelCanopyReview(key, bRecs, buildingIds) {
    const rows = FUEL_CANOPY_REVIEW[key], out = []; if (!rows) return out;
    for (const b of bRecs) {
        const id = buildingIds?.[b.i], row = id && rows[id]; if (!row || b.canopy) continue;
        b.canopy = row; b.h = row.topM; b.minH = row.clearanceM; b.roof = 'flat'; b.roofProfile = null; b.flags &= ~1; out.push(id);
    }
    return out;
}
