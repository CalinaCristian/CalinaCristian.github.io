// Source stop positions remain on the track. Only the inferred shelter model
// gets a platform frame; neither source feature is moved or resized.
const closest = (p, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 1e-6) return null;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (len * len)));
    return { x: a[0] + dx * t, z: a[1] + dz * t, t, len, ux: dx / len, uz: dz / len, distanceM: Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) };
};
const sourceRef = m => (m.type === 'node' ? 'n' : m.type === 'way' ? 'w' : 'r') + m.ref;
const level = tags => Number(tags.layer ?? 0);

/** Null retains old datasets/ordinary roadside stops. Known rail stop sources
 * return explicit resolved/unresolved records, never nearest-motor-road shelter
 * coordinates. Model association is distinguished from a literal stop_area. */
export function sourceTransitStopPlacement(data, poiIndex) {
    const catalogue = data.publicTransportSources, source = catalogue?.poiSources?.[poiIndex];
    if (!source || !(source.tags.public_transport === 'stop_position' || source.tags.railway === 'tram_stop')) return null;
    const failure = reason => ({ resolved: false, sourceId: source.sourceId, reason });
    if (source.points.length !== 1) return failure('non-point-vehicle-stop');
    if (source.tags.shelter === 'no') return failure('literal-shelter-no');
    const stop = source.points[0], explicit = new Set();
    for (const area of catalogue.stopAreas || []) if (area.tags.public_transport === 'stop_area' && area.members.some(m => sourceRef(m) === source.sourceId))
        for (const m of area.members) explicit.add(sourceRef(m));
    const choices = [];
    for (const platform of catalogue.platforms || []) {
        const t = platform.tags;
        if (t.shelter !== 'yes' || t.area === 'yes' || platform.points.length < 2 || platform.nodeIds[0] === platform.nodeIds.at(-1)) continue;
        if (level(t) !== 0 || level(source.tags) !== 0 || [t, source.tags].some(t => t.level != null || t.ele != null || t.incline != null || t.bridge && t.bridge !== 'no' || t.tunnel && t.tunnel !== 'no' || t.location === 'underground')) continue;
        const associated = explicit.has(platform.sourceId);
        if (!associated && (!source.tags.name || t.name !== source.tags.name)) continue;
        for (let i = 1; i < platform.points.length; i++) {
            const p = closest(stop, platform.points[i - 1], platform.points[i]);
            if (!p || p.distanceM < .2 || p.distanceM > 12 || p.t * p.len < 2.2 || (1 - p.t) * p.len < 2.2) continue;
            // A model association additionally needs an actual parallel source
            // rail through the literal stop, rather than a nearby namesake.
            const rails = (data.tramSourceWays || []).filter(w => w.nodeIds.includes(source.nodeIds[0]));
            const railDirections = rails.flatMap(w => {
                let x = 0, z = 0; const points = [];
                for (let k = 0; k < w.points.length; k += 2) { x += w.points[k] / (data.q || 10); z += w.points[k + 1] / (data.q || 10); points.push([x, z]); }
                const at = w.nodeIds.indexOf(source.nodeIds[0]), out = [];
                for (const k of [at - 1, at]) if (k >= 0 && k + 1 < points.length) out.push(closest(stop, points[k], points[k + 1]));
                return out.filter(Boolean);
            });
            if (!associated && !railDirections.some(r => Math.abs(r.ux * p.ux + r.uz * p.uz) > .98)) continue;
            choices.push({ platform, p, associated, segment: i - 1 });
        }
    }
    choices.sort((a, b) => Number(b.associated) - Number(a.associated) || a.p.distanceM - b.p.distanceM || a.platform.sourceId.localeCompare(b.platform.sourceId) || a.segment - b.segment);
    const pick = choices[0];
    if (!pick) return failure('sheltered-platform-placement-unresolved');
    const other = choices.find(c => c.platform.sourceId !== pick.platform.sourceId && c.associated === pick.associated);
    if (other && other.p.distanceM - pick.p.distanceM < 1) return failure('ambiguous-platform-association');
    const { p, platform } = pick, nx = p.uz, nz = -p.ux, side = (stop[0] - p.x) * nx + (stop[1] - p.z) * nz > 0 ? 1 : -1;
    // The historic roof has local centre -side*.25. This origin puts that
    // centre ON the unchanged platform line, with the open side facing track.
    return { resolved: true, sourceId: source.sourceId, platformSourceId: platform.sourceId,
        association: pick.associated ? 'literal-stop-area' : 'estimated-unique-nearest-same-name-parallel-platform',
        x: p.x + nx * side * .25, z: p.z + nz * side * .25, angle: Math.atan2(p.ux, p.uz), side,
        platformPoint: [p.x, p.z], platformSegment: pick.segment, platformT: p.t, stopDistanceM: p.distanceM,
        model: { estimated: true, roofWidthM: 1.6, roofLengthM: 3.5, roofTopM: 2.45, station: 'projection-of-literal-stop-on-platform-line', widthAndRoofFootprint: 'unmapped-existing-generic-shelter-estimate' } };
}

/** The existing generic shelter, unchanged dimensions. Shared by emission and
 * offline whole-body tests; these are model parts, not mapped roof geometry. */
export function transitShelterModel({ x, z, angle, side }, liftM = 0) {
    const ca = Math.cos(angle), sa = Math.sin(angle), at = (lx, lz) => [x + lx * ca + lz * sa, z - lx * sa + lz * ca];
    const boxes = [], add = (lx, y, lz, w, h, d, material) => { const p = at(lx, lz); boxes.push({ x: p[0], y: y + liftM, z: p[1], w, h, d, angle, material }); };
    add(-side * .8, .35, 0, .06, 1.9, 3.2, 'glass');
    for (const lz of [-1.6, 1.6]) { add(-side * .8, .2, lz, .1, 2.15, .1, 'frame'); add(-side * .25, .35, lz, 1.1, 1.9, .05, 'glass'); }
    add(-side * .25, 2.35, 0, 1.6, .1, 3.5, 'frame');
    add(-side * .5, .45, 0, .4, .08, 2.4, 'bench');
    add(side * .3, .2, 1.9, .08, 2.8, .08, 'frame');
    const pole = at(side * .3, 1.9), discs = [-1.3, 0, 1.3].map(lz => { const p = at(-side * .5, lz); return { x: p[0], z: p[1], r: .75 }; });
    discs.push({ x: pole[0], z: pole[1], r: .15 });
    return { boxes, discs, pole };
}
