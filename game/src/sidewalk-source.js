// Directional sidewalk tags refer to the original OSM way, not vehicle travel.
// This only describes inferred roadside pavement. Separately mapped footways
// and source areas are not altered or reclassified here.
const absent = v => v == null || v === '';
const state = v => /^(yes|both|left|right)$/.test(v) ? true : /^(no|none|separate)$/.test(v) ? false : null;

function sourceDirection(source, edge) {
    const points = source?.projected; if (!Array.isArray(points) || points.length < 2) return null;
    const mx = (edge.a.x + edge.b.x) / 2, mz = (edge.a.z + edge.b.z) / 2, ex = edge.b.x - edge.a.x, ez = edge.b.z - edge.a.z, length = Math.hypot(ex, ez);
    if (!(length > 1e-8)) return null;
    let best = null; const candidates = [];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; if (l2 < 1e-10) continue;
        const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (mz - a[1]) * dz) / l2)), error = Math.hypot(mx - a[0] - dx * t, mz - a[1] - dz * t), dot = (ex * dx + ez * dz) / (length * Math.sqrt(l2));
        const candidate = { error, dot }; candidates.push(candidate); if (!best || error < best.error) best = candidate;
    }
    // Associate only with this exact source way's matching segment; unrelated
    // road proximity never supplies a sidewalk direction.
    if (!best || best.error > .25 || Math.abs(best.dot) <= .9) return null;
    const direction = Math.sign(best.dot);
    return candidates.some(c => c.error <= best.error + .001 && Math.abs(c.dot) > .9 && Math.sign(c.dot) !== direction) ? null : direction;
}

export function sourceSidewalkSides(data, edge) {
    const source = data.roadSourceGeometry?.[edge.road], tags = source?.tags || {}, width = Math.max(0, edge.sidewalk || 0);
    const explicit = ['sidewalk', 'sidewalk:both', 'sidewalk:left', 'sidewalk:right'].some(k => !absent(tags[k]));
    const result = { rightM: width, leftM: width, explicit, sourceId: source?.sourceId || null, sourceForward: null,
        basis: explicit ? 'literal original-source sidewalk side tags' : 'unchanged inferred fallback; source side tags absent' };
    if (!explicit) return result;
    const forward = sourceDirection(source, edge); result.sourceForward = forward;
    if (forward == null) return { ...result, unresolved: 'source-way direction not uniquely matched; inferred fallback retained' };
    const forSide = side => {
        const named = tags['sidewalk:' + side];
        if (!absent(named)) { const allowed = state(String(named)); if (allowed != null) return allowed ? width : 0; }
        const both = tags['sidewalk:both'];
        if (!absent(both)) { const allowed = state(String(both)); if (allowed != null) return allowed ? width : 0; }
        const combined = String(tags.sidewalk || '');
        if (combined === 'left' || combined === 'right') return combined === side ? width : 0;
        const allowed = state(combined); return allowed == null ? width : allowed ? width : 0;
    };
    result.rightM = forSide(forward > 0 ? 'right' : 'left'); result.leftM = forSide(forward > 0 ? 'left' : 'right');
    return result;
}

/** side +1/-1 is relative to the current edge a→b. Legacy scalar is retained. */
export function sidewalkWidth(edge, side) {
    const value = side > 0 ? edge.sidewalkRightM : edge.sidewalkLeftM;
    return Number.isFinite(value) ? value : Math.max(0, edge.sidewalk || 0);
}
