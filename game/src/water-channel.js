export const isDambovita = name => /d[âa]mbovi[tţț]a/i.test(name || '');

// Literal source water type wins over the legacy unnamed shape heuristic.
// Neither branch supplies a measured absolute surface elevation.
export function waterChannelDecision(area, { us = false, tags = {} } = {}) {
    const p = area.outer, perimeter = p.reduce((s, a, i) => s + Math.hypot(a[0] - p[(i + 1) % p.length][0], a[1] - p[(i + 1) % p.length][1]), 0);
    const named = isDambovita(area.name);
    const shape = !/lac|lacul|iaz|fântân|fantan|bazin/i.test(area.name || '') && perimeter > 400 && area.size / (perimeter / 2) < 60;
    const legacy = !us && (named || shape), type = String(tags.water || '').trim().toLowerCase();
    if (['lake', 'pond', 'reservoir'].includes(type)) return { channel: false, source: 'literal OSM water=' + tags.water + '; flat surface remains a model estimate', suppressedLegacyChannel: legacy, sourceWaterType: tags.water, ...(named ? { sourceConflict: 'named Dâmbovița with explicit lake/pond/reservoir type' } : {}) };
    return { channel: legacy, source: legacy ? named ? 'explicit mapped Dâmbovița name; vertical profile remains a model estimate' : 'legacy unnamed shape estimate; no absolute source water height' : 'standard flat-water model estimate' };
}
