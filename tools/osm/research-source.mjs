// Research must select the original OSM entity type; numeric IDs are not globally unique.
export function resolveResearchSource(record, ways, relations) {
    const raw = record?.osm;
    const text = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : typeof raw === 'string' ? raw : '';
    const match = /^([wr]?)([1-9]\d*)$/.exec(text);
    if (!match) return null;
    const id = Number(match[2]);
    if (!Number.isSafeInteger(id)) return null;
    const prefixType = match[1] === 'r' ? 'relation' : match[1] === 'w' ? 'way' : null;
    const declaredType = record.osmType ?? null;
    if (declaredType !== null && declaredType !== 'way' && declaredType !== 'relation') return null;
    if (declaredType && prefixType && declaredType !== prefixType) return null;
    const type = declaredType || prefixType || 'way'; // Legacy numeric dossiers describe ways.
    const object = (type === 'relation' ? relations : ways).get(id);
    return object ? { id, type, sourceId: (type === 'relation' ? 'r' : 'w') + id, object } : null;
}
