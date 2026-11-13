// ============================================================================
//  BUILDING REVIEW — per-building appearance corrections from the street-level review of named businesses
//  (fidelity pass round 2, 2026-11-12; records in game/research/bucharest-otopeni.md / bucharest-romana.md; round 3 rows
//  for Floreasca, Grozăvești, Romană and SeaTac, 2026-11-13).
//
//  The district data gives a named building without OSM height / levels a default (e.g. 17.7 m, five storeys, apartment
//  'bloc' style) and estimated facade colours. Where the review found the real building visibly different (a one-storey
//  supermarket drawn as an eight-storey block, a white hotel drawn blue), a row below states what was seen. Rules:
//    - keyed by OSM id: footprint, position and identity always stay the district data's; nothing is added or moved;
//    - OSM tags win: a row never changes a height / storey count that comes from OSM `height` / `building:levels`
//      (buildingInfo height source 0), nor a roof shape tagged in OSM;
//    - storeys are counted from the street; `h` is an estimate from that count (about 3.3 m a storey, shop halls
//      6 - 8.5 m) and the roof profile says so (`heightSource: 'street-level review estimate'`);
//    - colours are a tone class seen on the facade, not a sampled pixel;
//    - no sign, name or shop is created here. `name` only replaces a sign the data build took from a tenant inside
//      the building with the building's own OSM name (the OSM object is cited in the note).
//  Row: 'w<id>' / 'r<id>': { h, levels, style, roof, colour, roofColour, name, shopfront: false, note }
//    shopfront: false removes a glazed shop ground floor where the real building has none (museum, church house).
//    shopFaceAt: [lat, lon] keeps the shop ground floor only on the face nearest that point (the mapped shop's OSM node).
//    roofShape: a drawable shape for an OSM roof:shape the roof builder cannot draw; dormers: 'oval' (reviewed-dormers.js).
//    style: district facade style: 'bloc' (apartment block, balconies), 'civic' (window grid behind a columned portico: institutions only),
//           'interwar' (plain plaster window grid), 'eclectic', 'glass' (curtain wall), 'shop' (glazed shop hall), 'plain' (windowless panels), 'house'.
// ============================================================================

import { LOOK_REVIEW } from './building-review-look.js'; // (r3: church / downtown Bellevue colour rows of lane `look`)
// rows of both tables per OSM id; this file's own row wins field by field; null when neither has the district
const mergeLook = (own, look) => { if (!own && !look) return null; const t = { ...(look || {}) }; for (const [id, r] of Object.entries(own || {})) t[id] = { ...(t[id] || {}), ...r }; return t; };

export const BUILDING_REVIEW = {
    'bucharest-otopeni': {
        w219767593: { h: 8.5, levels: 2, style: 'plain', roof: 'flat', colour: '#2F6DB5', note: 'Romstal: blue panel showroom hall, two low storeys (data: 24.2 m block)' },
        w312547018: { h: 6, levels: 1, style: 'plain', roof: 'flat', colour: '#4A4D52', note: 'Mega Image: one-storey dark grey flat-roofed box, red entrance portal (data: 9 m gabled glazed shed)' },
        w259171763: { h: 11.5, levels: 3, style: 'interwar', roof: 'flat', colour: '#E6E6E3', note: 'Ferremo Trendy: three-storey furniture showroom, white / grey panels, dark red glazed centre bay (data: 17.7 m five-storey block)' },
        w259171686: { style: 'glass', note: 'Cris Garden Plaza: glazed garden-centre hall behind a fenced yard (OSM building:levels=3 kept)' },
        w259171710: { style: 'interwar', colour: '#C9CDD1', note: 'Ramada: silver-grey panels and glass, curved glazed corner (drawn as an ochre apartment block)' },
        w303678262: { style: 'interwar', colour: '#F1F0EC', note: 'Vienna House Easy: white six-storey hotel slab (drawn as a blue apartment block)' },
        w303678255: { style: 'house', colour: '#F0EDE4', roofColour: '#4A3B32', note: 'Casa Românească hotel: white walls with dark timber framing, dark shingle roof (drawn as a grey block)' },
        w495066823: { style: 'house', colour: '#F0EDE4', roofColour: '#4A3B32', note: 'Casa Românească restaurant: same white and dark timber house' },
    },
    'bucharest-romana': {
        w162494340: { colour: '#EDE9DF', note: 'Hotel Lido (Bd. Magheru): cream-white interwar hotel front (drawn saturated blue from a default hotel colour)' },
        r2552618: { colour: '#A65A44', shopfront: false, levels: 2, roofShape: 'hipped', riseM: 6, roofColour: '#7A3E2C', note: 'Muzeul Național al Țăranului Român: red-brick neo-Romanian museum behind trees, two tall storeys under steep tiled roofs, no shop windows on Șos. Kiseleff (drawn beige with a glazed shop ground floor, then a flat-roofed four-storey block). The 19.6 m total stays (not measurable from the street); the 6 m roof rise is an estimate; the entrance tower has no OSM part and is not drawn (round 4, r2-districts-view-10)' },
        w231445058: { style: 'eclectic', colour: '#E6D08A', note: 'Colecția Severeanu (Str. Henri Coandă 26): yellow one-storey eclectic house with white window surrounds (drawn tan)' },
        w29819032: { name: 'Sheraton', note: 'Sheraton Bucharest Hotel (OSM w29819032 name / brand): the building was signed with its ground-floor tenant Pizza Hut' },
        // (round 3, 2026-11-13) official panoramas 44.448503, 26.093125 heading 275 and 44.450278, 26.087635 heading 262
        w79139872: { h: 13, levels: 3, style: 'eclectic', colour: '#EFE7D6', note: 'Observatorul Urseanu (Bd. Lascăr Catargiu 21): cream three-storey villa with rounded corner bays and iron balconies (drawn as a 6.4 m two-storey box); the round east tower w1220336122 and its dome are the landmark urseanudome' },
        // (round 4, r3-look-12) official panorama Yv9RTMCoVSMxEoPO0dOE7g h245 shows the east front; Viggo n5602930826 (shop=clothes,
        // check_date 2026-06-15) lies 4.4 m inside the south-west face and 8 m from the west one, not at that front
        w171045146: { style: 'eclectic', colour: '#D9CAA8', shopFaceAt: [44.447466, 26.0962622], note: 'Casa Gheorghe Petrașcu: beige ornamented stone with barred ground-floor windows on the east front (drawn white with a glazed shop front all round); the Viggo shop front stays on the south-west face nearest its OSM node' },
        // (round 4, r3-landmarks-7) Storck collection n2634651933 (Str. Vasile Alecsandri 16; OSM tourism=artwork, in no outline):
        // the house of 1912-13 by Alexandru Clavel, Anglo-Norman neo-Gothic (cimec ghidul muzeelor / Muzeul Bucureștiului); its
        // Wikipedia coordinates 44.4509722, 26.0944917 lie 12 m from w546500256, the red-brick gabled house seen from pano
        // 44.450834, 26.094312 h 60, and 19 / 25 m from the other two outlines. Storeys from that view; heights are estimates
        w546500256: { h: 9, levels: 2, style: 'house', roofShape: 'gabled', colour: '#8A4334', roofColour: '#5A3A2E', shopfront: false, note: 'Muzeul Storck: red-brick two-storey gabled house (drawn as a cream 12.8 m four-storey block with a glazed shop floor)' },
        w546500238: { h: 4.5, levels: 1, style: 'house', colour: '#EDE3CC', shopfront: false, note: 'cream one-storey house beside the Storck museum (drawn as a 12.8 m four-storey block)' },
        w131269864: { style: 'eclectic', colour: '#E8DCC4', roofColour: '#4B5057', roofShape: 'mansard', dormers: 'oval', note:'Casa Filipescu-Cesianu (Calea Victoriei 151): cream two-storey eclectic palace under a dark slate mansard with oval dormers (OSM roof:shape=quadruple_saltbox and building:levels=2 kept; drawn plain with a light roof)' },
    },
    // (round 3, 2026-11-13) official panoramas on Calea Floreasca: 44.460443, 26.101023 h 240; 44.461341, 26.101235 h 262;
    // 44.462811, 26.101521 h 265; 44.454184, 26.100804 h 40
    'bucharest-floreasca': {
        w34832556: { h: 9, levels: 2, style: 'glass', colour: '#c5cacc', note: 'Piața Floreasca / Agora (Calea Floreasca 111-113): two-storey light glass curtain-wall front with hedges and terraces (drawn as a dark slatted 7.4 m shop box); the lower single-storey Banul Antonache side is part of the same footprint and is not split' },
        w245407579: { h: 27.5, levels: 8, style: 'glass', note: 'Nusco Floreasca 1 (Calea Floreasca 131-137, OSM building=office): blue-grey reflective glass tower, about six glazed storeys over a tall dark ground floor and a set-back top storey (drawn as an 11.6 m four-storey block); storey count from the street' },
        w39348919: { h: 7.5, levels: 2, style: 'interwar', colour: '#F1EFEA', note: 'Souk (Calea Floreasca 131B): low white two-storey building with a red band and a dark roof edge (drawn as a 12.6 m four-storey block)' },
        w245345976: { style: 'glass', note: 'Spitalul Euroclinic (Calea Floreasca 14A): modern glass and pale grey panel block, seen only from about 40 m (drawn as a beige eclectic house; OSM building:levels=7 kept)' },
    },
    // (round 3, 2026-11-13) official panoramas on Calea Giulești 44.447216, 26.061955 heading 0 and 44.448422, 26.062576 heading 270
    'bucharest-grozavesti': {
        w247015071: { style: 'plain', colour: '#E2E3E0', note: 'Brico Dépôt / Altex (Calea Giulești 1-3): long light-grey ribbed panel box with a red fascia band and a red Altex front at the south-east corner (drawn as a dark glass hall; OSM height=15 kept)' },
        w23557062: { style: 'plain', colour: '#ECEBE6', note: 'Centrul Comercial Orhideea: pale panel façade with red bands, no continuous shop glazing (drawn with dark shopfront glazing round the hall; OSM height=8 kept). The red entrance canopy is not drawn' },
    },
    // (round 3, 2026-11-13) official panoramas 47.447515, -122.293784 heading 265 and 47.439912, -122.294810 heading 185
    'seattle-seatac': {
        w647567422: { h: 6.5, levels: 2, style: 'interwar', colour: '#D7642F', note: 'Rodeway Inn (S 176th St): two-storey orange motel with blue trim and a blue entrance canopy (drawn as a 4.2 m one-storey shop)' },
        w364221560: { h: 13, levels: 4, style: 'interwar', colour: '#D8CDB2', note: 'Red Lion Inn (International Blvd 18220): beige multi-storey wing with a brick-red end, three window rows visible above a 4 m hedge; the fourth (ground) storey is an estimate (drawn as a 4.2 m one-storey shop)' },
    },
};

/**
 * Apply one district's review rows to the freshly decoded building records (world.js, after the occupant-sign pass and
 * before the height sanity pass). Mutates `bRecs` only. A reviewed height replaces an estimated roof profile by one at
 * the reviewed height (flat when the row says so, otherwise the same shape scaled); prepared surfaces of that building
 * then fail their signature check and the live geometry is used.
 * Returns { applied: [ids], missing: [ids not in this district's data], osmKept: [ids whose OSM-tagged height stayed] }.
 */
export function applyBuildingReview({ key, bRecs }) {
    const table = mergeLook(BUILDING_REVIEW[key], LOOK_REVIEW[key]), audit = { applied: [], missing: [], osmKept: [] };
    if (!table) return audit;
    const byId = new Map(); for (const b of bRecs) if (b.sourceId && !byId.has(b.sourceId)) byId.set(b.sourceId, b);
    for (const [id, r] of Object.entries(table)) {
        const b = byId.get(id); if (!b) { audit.missing.push(id); continue; }
        const p = b.roofProfile, osmHeight = b.heightSourceCode === 0 || /^OSM/.test(p?.heightSource || '');
        const osmRoof = !!(p && (p.originalOSM?.['roof:shape'] || p.raw?.['roof:shape']));
        if (r.h && osmHeight) audit.osmKept.push(id);
        else if (r.h) {
            const flat = (r.roof === 'flat' && !osmRoof) || !p || p.shape === 'flat', k = p && p.totalM > 0 ? r.h / p.totalM : 1;
            b.h = r.h; if (r.levels) b.levels = r.levels; b.reviewedHeight = true;
            if (p) b.roofProfile = flat ? { ...p, shape: 'flat', totalM: r.h, eavesM: r.h, riseM: 0, riseSource: 'flat', heightSource: 'street-level review estimate' }
                : { ...p, totalM: r.h, eavesM: +(p.eavesM * k).toFixed(2), riseM: +(p.riseM * k).toFixed(2), heightSource: 'street-level review estimate' };
            if (flat) b.roof = 'flat';
        }
        if (r.roof && !b.roofProfile && !osmRoof) b.roof = r.roof;
        // (r3-landmarks-3) an OSM roof:shape the roof builder cannot draw (e.g. quadruple_saltbox) falls back to 'hipped'; a
        // reviewed row may name the drawable shape the panorama shows instead (the OSM tag itself is kept in the profile)
        // (a profile whose shape is the builder's estimate, no OSM roof:shape, takes the reviewed shape as well)
        if (r.roofShape && b.roofProfile && (!osmRoof || b.roofProfile.issues?.some(s => /^unsupported roof:shape/.test(s)))) {
            const q = b.roofProfile, rise = r.riseM > 0 && r.riseM < q.totalM ? r.riseM : q.riseM; // (riseM: a reviewed roof rise inside the unchanged total height)
            b.roofProfile = { ...q, shape: r.roofShape, riseM: rise, eavesM: +(q.totalM - rise).toFixed(2), riseSource: r.riseM > 0 ? 'street-level review estimate' : q.riseSource, shapeSource: 'street-level review (OSM roof:shape not drawable)' };
        }
        if (r.levels && !r.h && !osmHeight) b.levels = r.levels; // (a storey count seen from the street, height unchanged)
        if (r.dormers) b.dormers = r.dormers;
        if (r.shopFaceAt) b.shopFaceAt = r.shopFaceAt;
        if (r.style) b.style = r.style;
        if (r.colour) { b.colour = r.colour; b.reviewedColour = true; }
        if (r.roofColour) b.roofColour = r.roofColour;
        if (r.name) { b.name = r.name; b.flags |= 2; }
        if (r.shopfront === false) { b.flags &= ~1; b.reviewedNoShopfront = true; } // (the flag kept: a later part / overlap merge may OR a tenant's shop bit back in)
        audit.applied.push(id);
    }
    return audit;
}
