// A coarse mass may yield only to one successfully built, explicitly declared
// owner of every source in its exact recorded tuple. Unknowns retain the mass.
export function backdropSourceOwner(flat, offset, bindings) {
    if (!flat || !Number.isInteger(offset) || offset < 0 || offset % 6 || offset + 6 > flat.length || !Array.isArray(bindings)) return null;
    let match = null;
    for (const b of bindings) {
        if (!b || !Array.isArray(b.tuple) || b.tuple.length !== 6 || !Array.isArray(b.sourceIds) || !b.sourceIds.length || !Array.isArray(b.declaredSourceIds) || typeof b.landmark !== 'string' || !b.landmark) continue;
        if (!b.sourceIds.every(id => typeof id === 'string' && /^[wr]\d+$/.test(id) && b.declaredSourceIds.includes(id))) continue;
        if (!b.tuple.every((n, i) => Number.isFinite(n) && n === flat[offset + i])) continue;
        if (match) return null; // competing declarations do not establish ownership
        match = b;
    }
    return match;
}
