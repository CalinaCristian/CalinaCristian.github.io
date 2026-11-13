// Reviewed cross-sections of sunken river channels, by OSM water polygon.
//
// world.js draws every channel with one model section (CHAN: a steep quay wall, a 2 m service bench, water 4.4 m below
// the street). No source carries a water level or a bank section, so the section stays a model; where a street-level
// review showed that the model is visibly wrong, the reviewed values are listed here (appearance only, no measurement
// was taken from imagery; all figures are estimates to about half a metre).
//  - w174990751, Dâmbovița west of Piața Unirii (review 2026-11-12 from Splaiul Independenței, 44.42932, 26.09763): one
//    broad sloped concrete bank from the quay kerb down to the water, no bench; the water is low, about 4.5 m down.
//  - w174991904, Dâmbovița east of Piața Unirii (review 2026-11-12 from the east end of the covered section, 44.42609,
//    26.10433, looking east): a wide basin with sloped concrete banks and the water high, about 2 - 2.5 m below the quay.
//    The level is applied to the whole polygon inside the district; it was looked at only at that place.
//  - w170930341, Dâmbovița at Grozăvești (review 2026-11-12, lane world-b, from the north quay at 44.443748, 26.058521
//    looking south-south-west, and from the Podul Grozăvești deck looking upstream): the water is high, about 1.5 m below
//    the quay railing, with a short sloped concrete revetment and no bench. Applied to the polygon inside the district.
export const CHANNEL_REVIEW = {
    grozavesti: {
        w170930341: { water: -1.6, bank: -1.4, bankW: 0.3, slope: 1.4, source: 'street-level review 2026-11-12 (world-b): high water, short sloped revetment; level estimate' },
    },
    unirii: {
        w174990751: { water: -4.4, bank: -3.9, bankW: 0.5, slope: 4.6, source: 'street-level review 2026-11-12: sloped bank; level estimate' },
        w174991904: { water: -2.4, bank: -2.2, bankW: 0.4, slope: 3.2, source: 'street-level review 2026-11-12: high water, sloped bank; level estimate' },
    },
};
export const channelProfile = (districtId, sourceId, base) => CHANNEL_REVIEW[districtId]?.[sourceId] || base;
