// ============================================================================
//  BUILDING REVIEW — per-building appearance corrections from the street-level review of named businesses
//  (fidelity pass round 2, 2026-11-12; records in game/research/bucharest-otopeni.md / bucharest-romana.md).
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
//    style: district facade style: 'bloc' (apartment block, balconies), 'civic' (window grid behind a columned portico: institutions only),
//           'interwar' (plain plaster window grid), 'eclectic', 'glass' (curtain wall), 'shop' (glazed shop hall), 'plain' (windowless panels), 'house'.
// ============================================================================

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
        r2552618: { colour: '#A65A44', shopfront: false, note: 'Muzeul Național al Țăranului Român: red-brick neo-Romanian museum behind trees, no shop windows on Șos. Kiseleff (drawn beige with a glazed shop ground floor)' },
        w231445058: { style: 'eclectic', colour: '#E6D08A', note: 'Colecția Severeanu (Str. Henri Coandă 26): yellow one-storey eclectic house with white window surrounds (drawn tan)' },
        w29819032: { name: 'Sheraton', note: 'Sheraton Bucharest Hotel (OSM w29819032 name / brand): the building was signed with its ground-floor tenant Pizza Hut' },
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
    const table = BUILDING_REVIEW[key], audit = { applied: [], missing: [], osmKept: [] };
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
        if (r.style) b.style = r.style;
        if (r.colour) { b.colour = r.colour; b.reviewedColour = true; }
        if (r.roofColour) b.roofColour = r.roofColour;
        if (r.name) { b.name = r.name; b.flags |= 2; }
        if (r.shopfront === false) b.flags &= ~1;
        audit.applied.push(id);
    }
    return audit;
}
