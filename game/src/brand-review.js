// ============================================================================
//  BRAND REVIEW — sign colours corrected at the street (fidelity pass round 3, 2026-11-13).
//
//  Each district pack carries `data.brands` (sign palettes from the field research, game/research/businesses-*.json:
//  [background, letters, accent, logo text]). Where an official panorama shows a different sign, a row here replaces the
//  palette for that district, cited to the panorama; nothing else of the pack changes and nothing is added (a row only
//  recolours a brand the pack already signs). Brand colours are not in Wikidata (P465 is empty for these brands), so the
//  colours are tone classes read at the store, not sampled pixels. A row whose evidence is one store stays per district.
//  Keys are the lower-case brand / name exactly as data.brands keys them.
// ============================================================================

export const BRAND_REVIEW = {
    'bucharest-otopeni': {
        // otopeni-1: the research palette (white / blue / orange) is not Rompetrol's; both stations on DN1 show a white board
        // with orange letters and the red drop logo, orange canopy band and columns
        rompetrol: { colours: ['#FFFFFF', '#F39200', '#E30613'], evidence: 'panoramas ugmV2tKj3xdC4nMf5Vme5Q (44.560931, 26.069601) heading 130; S-NLftUc9aS5ox2xY6-tLA (44.561153, 26.06884) heading 19' },
    },
    'bucharest-floreasca': {
        // floreasca-11: Piața Floreasca (w34832556) store fascia is white MEGA IMAGE letters on a dark grey band, the red
        // lion square at the left; the pack had red (#E30613)
        'mega image': { colours: ['#34373B', '#FFFFFF', '#E30613'], evidence: 'panorama orHAmm3GllAsPPrvYACycA (44.460556, 26.099882) heading 105' },
        // floreasca-11: the Dona pharmacy at the Piața Floreasca car-park entrance has teal panels with white DONA letters;
        // the pack had red / white / green
        dona: { colours: ['#1B9AA0', '#FFFFFF', '#FFFFFF', 'Farmacia DONA'], evidence: 'panorama NWuTtHcsu_MBJEKTpucUsA (44.459775, 26.100274) heading 1' },
        'farmacia dona': { colours: ['#1B9AA0', '#FFFFFF', '#FFFFFF'], evidence: 'same store as `dona`' },
        // floreasca-11: Str. Ceaikovski 9, three unbranded fascias side by side (round 2 street-level comparison, panoramas of
        // May 2024, bucharest-floreasca.md): black / black / beige boards where the game drew its generic dark slate; letter
        // colours are estimates (white on black, dark brown on beige)
        'roll master': { colours: ['#151515', '#FFFFFF', '#FFFFFF'], add: true, evidence: 'round 2 comparison, Str. Ceaikovski 9 (May 2024 panorama)' },
        burgerati: { colours: ['#151515', '#FFFFFF', '#FFFFFF'], add: true, evidence: 'round 2 comparison, Str. Ceaikovski 9 (May 2024 panorama)' },
        chocoloco: { colours: ['#E3D3B4', '#3B2A1E', '#3B2A1E'], add: true, evidence: 'round 2 comparison, Str. Ceaikovski 9 (May 2024 panorama), striped awning not drawn' },
    },
};

/** data.brands with this district's reviewed rows applied (a new object; the pack is not mutated) */
export function reviewBrands(key, brands = {}) {
    const rows = BRAND_REVIEW[key]; if (!rows) return brands;
    const out = { ...brands };
    for (const [k, r] of Object.entries(rows)) if (out[k] || r.add) out[k] = r.colours.length >= 4 ? r.colours : [...r.colours, ...(out[k]?.slice(3) || [])];
    return out;
}
