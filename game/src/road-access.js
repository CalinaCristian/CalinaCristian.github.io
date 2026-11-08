// OSM access is inherited from the most specific motorcar mode, never from a substring.
const MODES = ['motorcar', 'motor_vehicle', 'vehicle', 'access'];
const PUBLIC = new Set(['yes', 'designated', 'permissive', 'discouraged']);
const DESTINATION = new Set(['destination', 'customers']);

export function resolveRoadAccess(tags = {}) {
    const raw = {};
    for (const [key, value] of Object.entries(tags)) if (MODES.some(m => key === m || key.startsWith(m + ':')) || ['service', 'hov', 'hov:lanes', 'oneway', 'foot', 'bicycle', 'bridge', 'tunnel', 'layer', 'level', 'covered'].includes(key)) raw[key] = value;
    const key = MODES.find(k => tags[k] != null && String(tags[k]).trim() !== '') || null;
    const value = key ? String(tags[key]).trim().toLowerCase() : null;
    const conditional = Object.fromEntries(Object.entries(raw).filter(([k]) => MODES.some(m => k === m + ':conditional')));
    const conditionalUnresolved = Object.keys(conditional).length > 0;
    let publicDrive = value == null || PUBLIC.has(value) || DESTINATION.has(value);
    let throughAccess = publicDrive && !DESTINATION.has(value);
    let reason = value == null ? 'OSM road class default; no motorcar restriction mapped' : 'OSM ' + key + '=' + value;
    // A conditional permission cannot be evaluated without its time, vehicle and purpose context.
    // Retain the complete source road physically; do not assert public routing while unresolved.
    if (conditionalUnresolved) { publicDrive = false; throughAccess = false; reason += '; conditional permission unresolved'; }
    const hovOnly = tags.hov === 'designated' || /^designated(\|designated)*$/.test(tags['hov:lanes'] || '');
    if (hovOnly) { publicDrive = false; throughAccess = false; reason += '; HOV-designated vehicle context required'; }
    if (tags.oneway === 'reversible') { publicDrive = false; throughAccess = false; reason += '; reversible direction unresolved'; }
    if (tags.service === 'emergency_access' && !['motorcar', 'motor_vehicle'].includes(key)) { publicDrive = false; throughAccess = false; reason += '; emergency-only service'; }
    if (/^(parking_aisle|drive-through)$/.test(tags.service || '')) throughAccess = false;
    return { publicDrive, throughAccess, key, value, reason, conditionalUnresolved, ...(conditionalUnresolved ? { conditional } : {}), tags: raw };
}

export function ambientTrafficAccess(edge) { return edge.publicDrive !== false && edge.throughAccess !== false; }

// Destination/customer streets are usable only when a selected endpoint is in that connected access area.
export function endpointAccessEdges(start, goal) {
    const allowed = new Set(), pending = [start, goal].filter(e => e?.throughAccess === false && e.publicDrive !== false);
    while (pending.length) {
        const edge = pending.pop(); if (allowed.has(edge)) continue; allowed.add(edge);
        for (const node of [edge.a, edge.b]) for (const next of node.edges || []) if (next.publicDrive !== false && next.throughAccess === false && !allowed.has(next)) pending.push(next);
    }
    return allowed;
}
