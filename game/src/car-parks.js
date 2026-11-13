// Multi-storey car parks: open parking decks instead of a windowed office facade.
//
// Which buildings: OSM objects tagged `building=parking`, or `amenity=parking` + `parking=multi-storey`, that the district
// pack holds as a building (live OSM, 2026-11-12). The pack exports raw tags for relations only, so the ids are listed
// here; a building whose retained source tags say the same is recognised without being listed. The Sea-Tac airport
// garage (r15763840) is hand-modelled in landmarks.js and is not in this list.
// What is drawn on the unchanged source footprint and height: per level a concrete spandrel / parapet band and a dark open
// band above it (the deck is open to the air), concrete piers on the long faces, a closing band at the top.
// Sourced: footprint, total height (pack), `levels` where OSM tags building:levels. Estimates, stated: spandrel height,
// slab edge, pier spacing and width, and the level count where OSM has none (height / 3.1 m).
export const CAR_PARK_MODEL = { spandrelM: 1.1, slabEdgeM: 0.4, pierEveryM: 8.1, pierWidthM: 0.5, levelM: 3.1, estimates: ['spandrelM', 'slabEdgeM', 'pierEveryM', 'pierWidthM', 'levelM when OSM has no building:levels'] };

export const LOUVRE_MODEL = { ribbonM: 1.3, slats: 3, estimates: ['ribbonM', 'slats'] };

export const CAR_PARK_SOURCES = {
    w1215048759: { district: 'otopeni', name: '', levels: 2, tags: 'building=parking, building:levels=2, height=6' },
    w184169515: { district: 'unirii', name: 'Parcare Unirea', levels: 10, tags: 'amenity=parking, parking=multi-storey, building=yes, building:levels=10',
        // (2026-11-12 render review, official panorama ZB0x1qp9_B503488Hc4AGw at 44.428334, 26.105980 looking 243°: rendered
        //  pale stucco walls with a dark grey louvre ribbon on every level, rounded corners; not open decks)
        facade: 'louvred', wallColour: '#cdc6b6', louvreColour: '#4b5058', review: 'street-level panorama' },
    w433205175: { district: 'seatac', name: 'MasterPark Airport Valet Parking', levels: 0, tags: 'amenity=parking, parking=multi-storey, building=yes',
        // (r2 street-level review, panorama pxYzj6Jzy03xcWqPPm_jug at 47.452126, -122.295417 heading 95: a glazed ground floor and
        //  five open decks above it, glazed stair tower; OSM has no height / levels. Height = 6 x levelM, an estimate)
        reviewedLevels: 6, reviewedH: 18.6, review: 'street-level count' },
    // w479818870 (SeaTac): seen from 47.444099, -122.293207 (panorama KauyPKtqD_ylEozRWpdOXg, 22°): pale solid precast walls
    // with a vehicle portal, not open decks. Drawn solid-clad (no deck bands, no piers; the portal and its "PARKING"
    // lettering are not drawn); its level count was not visible and is not changed here (backlog)
    w479818870: { district: 'seatac', name: '', levels: 0, tags: 'amenity=parking, parking=multi-storey, building=yes', facade: 'solid', wallColour: '#e2ded5', review: 'street-level panorama' },
    w30758875: { district: 'bellevue', name: 'West Parking Garage', levels: 4, tags: 'amenity=parking, parking=multi-storey, building=yes, building:levels=4' },
    w34040306: { district: 'bellevue', name: 'Southeast Parking Garage', levels: 2, tags: 'amenity=parking, parking=multi-storey, building=yes, building:levels=2' },
    w104581576: { district: 'bellevue', name: '', levels: 4, tags: 'amenity=parking, parking=multi-storey, building=yes, building:levels=4' },
    w161929522: { district: 'bellevue', name: 'Northeast Parking Garage', levels: 6, tags: 'building=parking, amenity=parking, parking=multi-storey, building:levels=6' },
    // (r3, 2026-11-13) w450055216: panoramas WQYAZP9zih6YvbMOma73mw / MXEGRAuCD3pdurAoVdtLNA (47.6134, -122.1843) were taken ON
    // its roof: an open rooftop deck with planters and trellises over the REI store podium (FjAPRHBV5IcENxea32KJiw, 47.613084,
    // -122.184367 heading 7: the deck edge one storey up behind a glass railing). Level count below the roof not visible; no change
    w450055216: { district: 'bellevue', name: '', levels: 0, tags: 'building=parking, amenity=parking, parking=multi-storey' },
    // (r3) Parcare Cocor w658281398 (building:part inside the Cocor store): the street side is a dark grey panelled wall with a
    // vehicle entrance (panorama ky8lvOleKFvuiFVszKDv7Q, 44.430274, 26.104834, heading 240); the pack draws the store volume
    // there (glass), the part is not a building record of its own: its street face is drawn by car-park-fronts.js (round 4)
};

/** the car-park record of a source building id (listed, or recognised from retained source tags), else null */
export function carParkOf(sourceId, sourceTags) {
    if (!sourceId) return null;
    if (CAR_PARK_SOURCES[sourceId]) return CAR_PARK_SOURCES[sourceId];
    const t = sourceTags?.[sourceId];
    if (t && (t.building === 'parking' || (t.amenity === 'parking' && t.parking === 'multi-storey'))) return { name: t.name || '', levels: Number(t['building:levels']) || 0, tags: 'retained source tags' };
    return null;
}

/** (r2) a reviewed total height for a car park whose height is the pack's style default (never over an OSM height) */
export function reviewedCarParkHeight(sourceId, heightSourceCode) {
    const r = CAR_PARK_SOURCES[sourceId]; return r?.reviewedH > 0 && heightSourceCode !== 0 ? r.reviewedH : 0;
}

/** level count and its provenance for a building of height span (top - base) */
export function carParkLevels(record, dataLevels, span) {
    if (record.levels > 0) return { levels: record.levels, source: 'OSM building:levels' };
    if (record.reviewedLevels > 0) return { levels: record.reviewedLevels, source: 'street-level review count' };
    if (dataLevels > 0) return { levels: dataLevels, source: 'district pack levels' };
    return { levels: Math.max(1, Math.round(span / CAR_PARK_MODEL.levelM)), source: 'estimate (height / 3.1 m)' };
}

/**
 * One wall face of an open-deck car park. (ax, az) -> (bx, bz) is the face, visible between fy0 and fy1; the building runs
 * from base to top with `levels` decks. cols = { concrete, dark, pier } as rgb triples.
 */
export function emitCarParkWall(mb, ax, az, bx, bz, fy0, fy1, base, top, levels, nx, nz, cols) {
    const M = CAR_PARK_MODEL, fh = (top - base) / levels, L = Math.hypot(bx - ax, bz - az);
    const band = (y0, y1, col) => { const lo = Math.max(y0, fy0), hi = Math.min(y1, fy1); if (hi - lo > 0.02) mb.wall(ax, az, bx, bz, lo, hi, nx, nz, col); };
    // reviewed facade variants (CAR_PARK_SOURCES[].facade): 'solid' = closed cladding; 'louvred' = solid wall with one louvre
    // ribbon per level (LOUVRE_MODEL: ribbon height, three lighter slat lines; estimates)
    if (cols.facade === 'solid') { band(base, top, cols.concrete); return; }
    if (cols.facade === 'louvred') {
        const LM = LOUVRE_MODEL, rh = Math.min(LM.ribbonM, fh * 0.45);
        for (let i = 0; i < levels; i++) {
            const y = base + i * fh, r0 = y + (fh - rh) / 2, r1 = r0 + rh;
            band(i ? y : base, r0, cols.concrete);
            let at = r0; for (let k = 1; k <= LM.slats; k++) { const s = r0 + rh * k / (LM.slats + 1); band(at, s - 0.03, cols.louvre); band(s - 0.03, s + 0.03, cols.slat); at = s + 0.03; } // (adjacent bands, never overlapping: no z-fight)
            band(at, r1, cols.louvre); band(r1, y + fh, cols.concrete);
        }
        return;
    }
    const open = fh - M.spandrelM - M.slabEdgeM > 0.6;
    if (!open) { band(base, top, cols.concrete); return; }
    for (let i = 0; i < levels; i++) {
        const y = base + i * fh;
        band(i ? y - M.slabEdgeM : y, y + M.spandrelM, cols.concrete);
        band(y + M.spandrelM, y + fh - M.slabEdgeM, cols.dark);
    }
    band(top - M.slabEdgeM, top, cols.concrete);
    if (L < 3) return;
    const n = Math.max(1, Math.round(L / M.pierEveryM)), ux = (bx - ax) / L, uz = (bz - az) / L, hw = M.pierWidthM / 2, ox = nx * 0.06, oz = nz * 0.06;
    for (let i = 0; i <= n; i++) {
        const s = Math.min(L - hw, Math.max(hw, L * i / n));
        mb.wall(ax + ux * (s - hw) + ox, az + uz * (s - hw) + oz, ax + ux * (s + hw) + ox, az + uz * (s + hw) + oz, fy0, fy1, nx, nz, cols.pier);
    }
}
