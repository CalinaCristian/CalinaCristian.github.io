// Read-only page.evaluate payload for an already-loaded native world. No GL/world allocation.
module.exports = async function sceneryBridgeNativeDump() {
    const w = game.world, data = w.data;
    const { scenerySourceProfile } = await import('./src/scenery-source.js');
    const { sceneryBridgeProfiles } = await import('./src/scenery-bridges.js');
    const unpack = row => { let x = 0, z = 0; const p = []; for (let i = 4; i < row.length; i += 2) { x += row[i]; z += row[i + 1]; p.push([x / 10, z / 10]); } return p; };
    const profiles = (data.scenery || []).map((r, i) => scenerySourceProfile(data, i, unpack(r)));
    const estimated = sceneryBridgeProfiles(data, profiles, w.allEdges);
    const project = (x, z, a, b) => {
        const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
        const t = len2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / len2 : 0;
        return { t, distanceM: Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) };
    };
    const inPoly = (x, z, poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (project(x, z, poly[j], poly[i]).distanceM < 1e-7) {
                const q = project(x, z, poly[j], poly[i]); if (q.t >= 0 && q.t <= 1) return true;
            }
            const a = poly[i], b = poly[j];
            if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        return inside;
    };
    const core = w.allEdges.filter(e => !e.virtual).map(e => ({
        id: e.id, road: e.road, sourceId: data.roadSourceGeometry?.[e.road]?.sourceId,
        a: { sourceId: e.a.sourceId, x: e.a.x, z: e.a.z, nodeY: e.a.y },
        b: { sourceId: e.b.sourceId, x: e.b.x, z: e.b.z, nodeY: e.b.y },
        ya: e.ya, yb: e.yb, bridge: !!e.bridge, layer: e.layer, tunnel: !!e.tunnel,
        wL: e.wL, wR: e.wR, publicDrive: e.publicDrive, access: e.access,
    }));
    const scenery = profiles.map((profile, piece) => {
        const source = data.scenerySourceGeometry?.[piece], native = estimated.profiles.get(piece);
        return { piece, sourceId: source?.sourceId, nodeIds: source?.nodeIds, tags: source?.tags,
            precise: profile.precise, widthM: profile.widthM, leftM: profile.leftM, rightM: profile.rightM,
            widthSource: profile.widthSource, points: native?.points || profile.points,
            heights: native?.heights || null, coveredSegments: native?.coveredSegments || null,
            bridge: !!native?.bridge, thicknessM: native?.thicknessM || null,
            elevationSource: native?.elevationSource || 'Existing flat scenery renderer: Y.side + .05 = .20 m; no surveyed height or traffic/nav extension',
            renderedBaseY: native ? .24 : .20 };
    });
    const decks = w.buildings.filter(c => c.roadDeck);
    const atSource = (sourceId, x, z) => ({
        core: core.filter(e => e.sourceId === sourceId).flatMap(e => {
            const q = project(x, z, [e.a.x, e.a.z], [e.b.x, e.b.z]);
            return q.distanceM < 1e-5 && q.t >= -1e-7 && q.t <= 1 + 1e-7
                ? [{ edge: e.id, t: q.t, renderedTopM: .24 + e.ya + (e.yb - e.ya) * q.t, bridge: e.bridge, layer: e.layer }] : [];
        }),
        scenery: scenery.filter(p => p.sourceId === sourceId).flatMap(p => p.points.slice(1).flatMap((b, i) => {
            const q = project(x, z, p.points[i], b);
            return q.distanceM < 1e-5 && q.t >= -1e-7 && q.t <= 1 + 1e-7
                ? [{ piece: p.piece, segment: i, t: q.t, coveredByCore: !!p.coveredSegments?.[i], renderedTopM: p.renderedBaseY + (p.heights ? p.heights[i] + (p.heights[i + 1] - p.heights[i]) * q.t : 0), elevationSource: p.elevationSource }] : [];
        })),
        passiveBands: decks.filter(c => c.sourceId === sourceId && inPoly(x, z, c.poly)).map(c => ({
            bottomM: c.minHeightAt(x, z, 0), topM: c.roofHeightAt(x, z, 0),
            poly: c.poly, elevationSource: c.elevationSource,
        })),
    });
    return { scope: 'Read-only exact current native core/source profile dump. Rendered lower tops and actual passive local underside/top bands are retained separately; no inferred pair is silently selected as physical acceptance.',
        district: w.district.id, core, scenery,
        recomputedStatsMatchNative: JSON.stringify(estimated.stats) === JSON.stringify(w.stats.scenerySource?.bridges),
        nativeStats: w.stats.scenerySource?.bridges,
        unresolvedPairs: estimated.stats.unresolved.map(p => ({ ...p, upper: atSource(p.sourceId, p.x, p.z), lower: atSource(p.lowerSourceId, p.x, p.z) })) };
};
