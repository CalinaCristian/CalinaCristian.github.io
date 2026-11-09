// Read-only payload for page.evaluate after the native Groz lifecycle completes.
module.exports = async function nativeSupportDump(input) {
    const g = game, w = g.world, d = w.data;
    const { scenerySourceProfile } = await import('./src/scenery-source.js');
    const { sceneryBridgeProfiles } = await import('./src/scenery-bridges.js');
    const finite = v => Number.isFinite(v) ? v : null;
    const scalar = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)));
    const node = n => ({ ...scalar(n), edgeIds: (n.allEdges || n.edges || []).map(e => e.id), liveGraphEdgeIds: (n.edges || []).map(e => e.id) });
    const edge = e => ({ ...scalar(e), a: node(e.a), b: node(e.b), access: e.access || null, roadWidthSource: e.roadWidthSource || null,
        sourceId: d.roadSourceGeometry?.[e.road]?.sourceId || null, sourceNodeIds: [e.a.sourceId ?? null, e.b.sourceId ?? null],
        rawRoadInfo: d.roadInfo?.slice(e.road * 6, e.road * 6 + 6) || null,
        profileSamples: [0, .25, .5, .75, 1].map(t => ({ t, x: e.a.x + (e.b.x - e.a.x) * t, z: e.a.z + (e.b.z - e.a.z) * t,
            displacementY: e.ya + (e.yb - e.ya) * t, topY: w.roadHeight(e.a.x + (e.b.x - e.a.x) * t, e.a.z + (e.b.z - e.a.z) * t, e) })) });
    const project = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz, t = len2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / len2 : 0;
        return { t, distance: Math.hypot(x - a[0] - dx * Math.max(0, Math.min(1, t)), z - a[1] - dz * Math.max(0, Math.min(1, t))) }; };
    const inside = (x, z, poly) => {
        let hit = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (project(x, z, poly[j], poly[i]).distance <= 1e-7) return true;
            if ((poly[i][1] > z) !== (poly[j][1] > z) && x < (poly[j][0] - poly[i][0]) * (z - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) hit = !hit;
        }
        return hit;
    };
    const within = (x, z, c) => inside(x, z, c.poly) && !(c.holes || []).some(h => inside(x, z, h));
    const decode = (line, start = 0) => { let x = 0, z = 0; const out = []; for (let i = start; i < line.length; i += 2) { x += line[i]; z += line[i + 1]; out.push([x / d.q, z / d.q]); } return out; };
    const lines = input.sourceWayIds.map(id => { const source = d.tramSourceWays.find(v => v.sourceId === id); if (!source?.points) throw Error('Missing complete target source geometry ' + id); return { source, points: decode(source.points) }; });
    const segmentBoxes = lines.flatMap(l => l.points.slice(1).map((b, i) => ({ a: l.points[i], b, x0: Math.min(l.points[i][0], b[0]) - 25, x1: Math.max(l.points[i][0], b[0]) + 25, z0: Math.min(l.points[i][1], b[1]) - 25, z1: Math.max(l.points[i][1], b[1]) + 25 })));
    const decks = w.buildings.map((c, i) => ({ c, i })).filter(({ c }) => c.roadDeck);
    const rbHeight = (rb, x, z) => {
        if (rb.e) return w.roadHeight(x, z, rb.e);
        // The native pad renderer emits a fan from its exact native poly + hs.
        const p = rb.poly, hs = rb.hs;
        if (!hs) return null;
        for (let i = 1; i + 1 < p.length; i++) {
            const a = p[0], b = p[i], c = p[i + 1], den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
            if (Math.abs(den) < 1e-12) continue;
            const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den;
            const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den, q = 1 - u - v;
            if (Math.min(u, v, q) >= -1e-7) return .24 + u * hs[0] + v * hs[i] + q * hs[i + 1];
        }
        return null;
    };
    const at = (x, z) => ({ x, z, surfacesAt: w.surfacesAt(x, z), walkTop: w.walkTop(x, z),
        ribbonCandidates: w.ribbons.flatMap((rb, i) => x < rb.x0 - 1e-7 || x > rb.x1 + 1e-7 || z < rb.z0 - 1e-7 || z > rb.z1 + 1e-7 || !inside(x, z, rb.poly) ? [] : [{ ribbon: i, edge: rb.e?.id ?? null, node: rb.node?.id ?? null,
            sourceId: rb.e ? d.roadSourceGeometry?.[rb.e.road]?.sourceId || null : null, layer: rb.e?.layer ?? null, bridge: rb.e?.bridge ?? null, tunnel: rb.e?.tunnel ?? null,
            topY: rbHeight(rb, x, z), heightMethod: rb.e ? 'native world.roadHeight(x,z,edge)' : 'native rendered pad fan reconstructed from exact poly/hs (not a public surface query)' }]),
        passiveDeckCandidates: decks.filter(({ c }) => within(x, z, c)).map(({ c, i }) => ({ collider: i, sourceId: c.sourceId, topY: finite(c.roofHeightAt(x, z, 0)), bottomY: finite(c.minHeightAt(x, z, 0)), estimated: c.estimated, elevationSource: c.elevationSource })) });
    const perimeter = (rings, sample) => rings.flatMap((poly, ring) => poly.flatMap((a, i) => {
        const b = poly[(i + 1) % poly.length], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / input.spacingM));
        return Array.from({ length: count + 1 }, (_, k) => { const t = k / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return { ring, edge: i, t, x, z, ...sample(x, z) }; });
    }));
    const ribbons = w.ribbons.map((rb, i) => ({ i, ...scalar(rb), poly: rb.poly, holes: rb.holes || [], hs: rb.hs || null, edge: rb.e ? edge(rb.e) : null, node: rb.node ? node(rb.node) : null,
        nativePolygonVertexHeights: rb.poly.map(([x, z]) => ({ x, z, topY: rbHeight(rb, x, z) })),
        bridgePerimeterSamples: (rb.e && (rb.e.bridge || Math.max(Math.abs(rb.e.ya), Math.abs(rb.e.yb)) > .3)) || (rb.node && Math.abs(rb.node.y) > .3)
            ? perimeter([rb.poly], (x, z) => ({ ownTopY: rbHeight(rb, x, z) })) : null }));
    const roadDecks = decks.map(({ c, i }) => ({ collider: i, ...scalar(c), poly: c.poly, holes: c.holes || [], sourceTags: c.sourceTags || null, access: c.access || null,
        heightFunctionText: { roofHeightAt: String(c.roofHeightAt), minHeightAt: String(c.minHeightAt) },
        perimeterSamples: perimeter([c.poly, ...(c.holes || [])], (x, z) => ({ topAtR0: finite(c.roofHeightAt(x, z, 0)), bottomAtR0: finite(c.minHeightAt(x, z, 0)), topAtR1_2: finite(c.roofHeightAt(x, z, 1.2)), bottomAtR1_2: finite(c.minHeightAt(x, z, 1.2)) })) }));
    const modeledPairs = new Set(d.tramSources.flatMap(s => s.nodeIds.slice(1).map((b, i) => [s.sourceId, s.nodeIds[i], b].join(':'))));
    const railSamples = lines.map(({ source, points }) => ({ sourceId: source.sourceId, nodeIds: source.nodeIds, sourceTags: source.tags,
        sourceVertices: points.map(([x, z], i) => ({ nodeId: source.nodeIds[i], ...at(x, z) })),
        segments: points.slice(1).map((b, i) => {
            const a = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.ceil(len / input.spacingM)), nx = -(b[1] - a[1]) / (len || 1), nz = (b[0] - a[0]) / (len || 1);
            return { sourceNodeIds: [source.nodeIds[i], source.nodeIds[i + 1]], a, b, lengthM: len, renderedPair: modeledPairs.has([source.sourceId, source.nodeIds[i], source.nodeIds[i + 1]].join(':')) || modeledPairs.has([source.sourceId, source.nodeIds[i + 1], source.nodeIds[i]].join(':')),
                samples: Array.from({ length: count + 1 }, (_, k) => { const t = k / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
                    return { t, stations: [-1.2, 0, 1.2].map(lateralM => ({ lateralM, ...at(x + nx * lateralM, z + nz * lateralM) })) }; }) };
        }) }));
    const sceneryProfiles = d.scenery.map((row, i) => scenerySourceProfile(d, i, decode(row, 4))), passive = sceneryBridgeProfiles(d, sceneryProfiles, w.allEdges);
    const scenery = sceneryProfiles.map((p, i) => { const b = passive.profiles.get(i); return { piece: i, ...p, source: d.scenerySourceGeometry?.[i] || null, access: d.sceneryAccess?.[i] || null, nativeModel: b || null }; });
    const requestedPolygonId = input.rawBridgePolygon.sourceId;
    const sourcePolygonPresence = { sourceId: requestedPolygonId, areaIndices: (d.areaSourceIds || []).flatMap((id, i) => id === requestedPolygonId ? [i] : []),
        buildingIndices: (d.buildingIds || []).flatMap((id, i) => id === requestedPolygonId ? [i] : []), colliderIndices: w.buildings.flatMap((c, i) => c.sourceId === requestedPolygonId ? [i] : []),
        note: 'Raw OSM bridge footprint is separate from native support geometry. Absence is retained; its footprint never supplies a fabricated native height.' };
    // Context triangles are exact native emitted vertices, not a new support assignment.
    // Preserve all road/ground/junction/solid/detail triangles whose XZ bbox intersects a target-source corridor bbox (25m).
    const renderedContext = [], meshInventory = [];
    w.group.updateMatrixWorld(true);
    w.group.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
        const materials = (Array.isArray(o.material) ? o.material : [o.material]).map(m => m?.name || ''), selected = materials.some(n => /^(road|junction|ground|solid|detail)$/.test(n)) || /^(road|junction|ground|solid|detail)( |$)/.test(o.name);
        meshInventory.push({ name: o.name, uuid: o.uuid, materials, positions: o.geometry.attributes.position.count, indexed: !!o.geometry.index, selected });
        if (!selected) return;
        const geo = o.geometry, pos = geo.attributes.position, indices = geo.index, count = indices ? indices.count : pos.count, m = o.matrixWorld.elements, vertices = [];
        for (let j = 0; j + 2 < count; j += 3) {
            const tri = [0, 1, 2].map(k => { const q = indices ? indices.getX(j + k) : j + k, x = pos.getX(q), y = pos.getY(q), z = pos.getZ(q); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; });
            const x0 = Math.min(...tri.map(v => v[0])), x1 = Math.max(...tri.map(v => v[0])), z0 = Math.min(...tri.map(v => v[2])), z1 = Math.max(...tri.map(v => v[2]));
            if (segmentBoxes.some(b => x0 <= b.x1 && x1 >= b.x0 && z0 <= b.z1 && z1 >= b.z0)) vertices.push({ triangle: j / 3, vertices: tri });
        }
        if (vertices.length) renderedContext.push({ name: o.name, uuid: o.uuid, materials, matrixWorld: [...m], vertices, scope: 'Exact contextual emitted mesh triangles near source rail corridors; material/name does not establish physical support or surveyed grade.' });
    });
    const allPolygonColliders = w.buildings.flatMap((c, i) => c.poly ? [{ collider: i, ...scalar(c), poly: c.poly, holes: c.holes || [], sourceTags: c.sourceTags || null,
        hasRoofHeightFunction: typeof c.roofHeightAt === 'function', hasMinHeightFunction: typeof c.minHeightAt === 'function' }] : []);
    return { scope: 'ONE read-only native Groz construction/support export. No traffic steps, routing fixes, actor moves, support assignment, height invention, contacts, budgets or district acceptance.',
        sourceCommit: input.sourceCommit, district: w.district.id, capturedUtc: new Date().toISOString(), spacingM: input.spacingM, lateralOffsetsM: [-1.2, 0, 1.2],
        provenance: { heights: 'All native road and passive-deck profiles are current runtime MODEL estimates, not surveyed elevations. The .24m road/actor base is separate from displacement y. Raw OSM layers are identifiers, never metres.',
            sourceGeometry: 'Complete source arrays are exported as actually held by native world.data; original cached bridge footprint is separately labeled raw input.',
            nativeQueries: 'surfacesAt and walkTop retain every actual response; no nearest-road winner, average, source-layer exemption or invented support is selected.',
            padHeights: 'rb.hs are exact native rendered-pad displacement vertices; fan interpolation reconstructs rendered triangles and is distinct from public surfacesAt.',
            sourceModelFunctions: 'Core roadHeight(x,z,edge) uses native linear profile/clamped station. Passive roofHeightAt/minHeightAt are called directly at radius0 and1.2 on complete perimeter samples.' },
        nativePopulation: { vehicleIds: g.traffic.vehicles.map(v => v.id), poolIds: g.traffic.pool.map(v => v.id), pedestrianIds: g.traffic.peds.list.map(p => p.i), trams: g.traffic.vehicles.filter(v => v.kind === 'tram').map(v => ({ ...scalar(v), meshPosition: v.mesh.position.toArray(), meshRotation: v.mesh.rotation.toArray() })) },
        data: d, graph: { nodeIds: Object.keys(w.graph.nodes), edgeIds: w.graph.edges.map(e => e.id) }, allEdges: w.allEdges.map(edge), ribbons, roadDecks, allPolygonColliders,
        nativeStats: w.stats, waterAreas: w.areas.filter(a => a.kind === 'water'), scenery, recomputedSceneryStatsMatchNative: JSON.stringify(passive.stats) === JSON.stringify(w.stats.scenerySource.bridges), railSamples,
        rawBridgePolygon: input.rawBridgePolygon, sourcePolygonPresence, meshInventory, renderedContext };
};
