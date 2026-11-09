// Pure source metadata only. Rendered lines, motor roads, dates and native geometry are never rewritten here.
export const TRAM_SOURCE_FIELDS = ['tramSources', 'tramSourceWays', 'tramRoutes', 'tramSourceNodeTags'];
export const TRAM_CROSSING_FIELDS = ['tramSourceCrossings'];
const copyTags = tags => Object.fromEntries(Object.entries(tags || {}));
const tramWay = tags => tags?.railway === 'tram' || (['construction', 'disused', 'abandoned', 'proposed', 'razed'].includes(tags?.railway) && [tags[tags.railway], tags[`${tags.railway}:railway`]].includes('tram'));
const tramRelation = tags => tags?.route === 'tram' || tags?.route_master === 'tram';
const key = value => String(value);

/** Snapshot raw identity/tags before the general builder decorates source records. */
export function snapshotTramSources(osm) {
    const ways = new Map(), routes = new Map(), neededNodes = new Set();
    for (const [id, way] of osm.ways) if (tramWay(way.tags)) {
        ways.set(key(id), { sourceId: `w${id}`, nodeIds: [...way.nodes], tags: copyTags(way.tags) });
        for (const n of way.nodes) neededNodes.add(key(n));
    }
    for (const [id, relation] of osm.rels) if (tramRelation(relation.tags)) {
        routes.set(key(id), { sourceId: `r${id}`, tags: copyTags(relation.tags), members: relation.members.map(m => ({ type: m.type, ref: m.ref, role: m.role ?? '' })) });
        for (const m of relation.members) if (m.type === 'node') neededNodes.add(key(m.ref));
    }
    const nodes = new Map(), nodeTags = new Map();
    for (const [id, ll] of osm.nodes) if (neededNodes.has(key(id)) && ll?.length >= 2 && ll.slice(0, 2).every(Number.isFinite)) nodes.set(key(id), ll.slice(0, 2));
    for (const [id, tags] of osm.ntags || []) if (neededNodes.has(key(id))) nodeTags.set(key(id), copyTags(tags));
    return { ways, routes, nodes, nodeTags };
}

/** Preserve crossing source input before the general compiler decorates and
 * clips its mutable OSM records. Road references remain complete; coordinates
 * are needed only for the literal pedestrian crossing ways. */
export function snapshotTramCrossingSources(osm) {
    const ways = new Map(), neededNodes = new Set();
    for (const [id, way] of osm.ways) if (way.tags?.highway || way.tags?.footway === 'crossing') {
        ways.set(id, { nodes: [...way.nodes], tags: copyTags(way.tags) });
        if (way.tags?.highway === 'footway' || way.tags?.footway === 'crossing') for (const n of way.nodes) neededNodes.add(n);
    }
    const nodes = new Map(), ntags = new Map();
    for (const n of neededNodes) {
        const ll = osm.nodes.get(n); if (ll) nodes.set(n, [...ll]);
        if (osm.ntags?.has(n)) ntags.set(n, copyTags(osm.ntags.get(n)));
    }
    return { ways, nodes, ntags };
}

export function tramProjection(proj) {
    if (![proj?.lat0, proj?.lon0, proj?.scale, proj?.mPerLat, proj?.mPerLon].every(Number.isFinite)) throw Error('Missing exact dataset projection');
    return (lat, lon) => {
        let dlat = lat - proj.lat0;
        if (proj.compress && lat > proj.compress.above) dlat = (proj.compress.above - proj.lat0) + (lat - proj.compress.above) * proj.compress.factor;
        return [(lon - proj.lon0) * proj.mPerLon * proj.scale, -dlat * proj.mPerLat * proj.scale];
    };
}

export function tramDelta(points, q = 10) {
    if (!Number.isFinite(q) || !(q > 0)) throw Error('Invalid dataset tram quantization');
    const out = []; let px = 0, pz = 0;
    for (const [i, p] of points.entries()) {
        if (!p || !p.every(Number.isFinite)) throw Error('Cannot encode unavailable source coordinates');
        const x0 = Math.round(p[0] * q), z0 = Math.round(p[1] * q), x = x0 === 0 ? 0 : x0, z = z0 === 0 ? 0 : z0;
        out.push(i ? x - px : x, i ? z - pz : z); px = x; pz = z;
    }
    return out;
}

function decodeIntegers(delta) {
    if (!Array.isArray(delta) || delta.length < 4 || delta.length % 2 || !delta.every(Number.isInteger)) throw Error('Invalid existing rendered tram run');
    let x = 0, z = 0; const out = [];
    for (let i = 0; i < delta.length; i += 2) { x += delta[i]; z += delta[i + 1]; out.push([x, z]); }
    return out;
}

/** Existing vertex-filter clipping can skip unavailable nodes; their complete way stays explicitly unresolved. */
export function alignTramRuns(trams, snapshot, { project, q = 10 }) {
    const candidates = [...snapshot.ways.values()].filter(w => w.tags.railway === 'tram' && w.tags.service !== 'yard' && w.tags.service !== 'siding' && w.tags.usage !== 'depot').map(way => {
        const vertices = way.nodeIds.flatMap(id => { const ll = snapshot.nodes.get(key(id)); if (!ll) return []; const p = project(...ll); return [{ id, point: p.map(n => Math.round(n * q)) }]; });
        return { way, vertices };
    });
    return trams.map((delta, renderIndex) => {
        const wanted = decodeIntegers(delta), matches = new Map();
        for (const { way, vertices } of candidates) for (const direction of [1, -1]) {
            const line = direction === 1 ? vertices : [...vertices].reverse();
            for (let start = 0; start + wanted.length <= line.length; start++) {
                if (!wanted.every((p, i) => p[0] === line[start + i].point[0] && p[1] === line[start + i].point[1])) continue;
                const nodeIds = line.slice(start, start + wanted.length).map(v => v.id), signature = JSON.stringify([way.sourceId, nodeIds]);
                matches.set(signature, { sourceId: way.sourceId, nodeIds, tags: copyTags(way.tags) });
            }
        }
        if (matches.size !== 1) throw Error(`Rendered tram run ${renderIndex} has ${matches.size} exact source identity matches; refusing a guessed/proximity join (${[...matches.values()].map(m => m.sourceId).join(',')})`);
        return [...matches.values()][0];
    });
}

/** Full literal-node connected tram component inside supplied cached coverage, not a spatial join. */
export function tramMetadataFromRuns(snapshot, runs, { project, q = 10 }) {
    const incident = new Map(), selected = new Set(), queue = [];
    for (const [id, way] of snapshot.ways) for (const n of new Set(way.nodeIds.map(key))) { if (!incident.has(n)) incident.set(n, []); incident.get(n).push(id); }
    for (const run of runs) {
        const id = run.sourceId?.replace(/^w/, ''), way = snapshot.ways.get(id);
        if (!way || !run.nodeIds?.length || run.nodeIds.some(n => !way.nodeIds.some(v => key(v) === key(n)))) throw Error(`Invalid original tram run source identity ${run.sourceId}`);
        if (!selected.has(id)) { selected.add(id); queue.push(id); }
    }
    for (let i = 0; i < queue.length; i++) for (const n of snapshot.ways.get(queue[i]).nodeIds) for (const id of incident.get(key(n)) || []) if (!selected.has(id)) { selected.add(id); queue.push(id); }
    const selectedNodes = new Set(), tramSourceWays = [...selected].sort((a, b) => +a - +b).map(id => {
        const way = snapshot.ways.get(id), missingNodeIds = way.nodeIds.filter(n => !snapshot.nodes.has(key(n)));
        for (const n of way.nodeIds) selectedNodes.add(key(n));
        return { sourceId: way.sourceId, nodeIds: [...way.nodeIds], tags: copyTags(way.tags), points: missingNodeIds.length ? null : tramDelta(way.nodeIds.map(n => project(...snapshot.nodes.get(key(n)))), q), ...(missingNodeIds.length ? { missingNodeIds } : {}) };
    });
    const selectedRelations = new Set();
    for (const [id, r] of snapshot.routes) if (r.members.some(m => m.type === 'way' && selected.has(key(m.ref)))) selectedRelations.add(id);
    let changed = true;
    while (changed) { changed = false; for (const [id, r] of snapshot.routes) if (!selectedRelations.has(id) && r.members.some(m => m.type === 'relation' && selectedRelations.has(key(m.ref)))) { selectedRelations.add(id); changed = true; } }
    const tramRoutes = [...selectedRelations].sort((a, b) => +a - +b).map(id => {
        const r = snapshot.routes.get(id), missingWayIds = [...new Set(r.members.filter(m => m.type === 'way' && !selected.has(key(m.ref))).map(m => m.ref))];
        for (const m of r.members) if (m.type === 'node') selectedNodes.add(key(m.ref));
        return { sourceId: r.sourceId, tags: copyTags(r.tags), members: r.members.map(m => ({ ...m })), ...(missingWayIds.length ? { missingWayIds } : {}) };
    });
    const tramSourceNodeTags = {};
    for (const id of [...selectedNodes].sort((a, b) => +a - +b)) if (snapshot.nodeTags.has(id)) tramSourceNodeTags[id] = copyTags(snapshot.nodeTags.get(id));
    return { tramSources: runs.map(r => ({ sourceId: r.sourceId, nodeIds: [...r.nodeIds], tags: copyTags(r.tags) })), tramSourceWays, tramRoutes, tramSourceNodeTags };
}

export function extractTramMetadata(doc, osm) {
    if (!doc.trams?.length) return {};
    if (!(doc.q > 0)) throw Error('Missing exact dataset quantization');
    const snapshot = snapshotTramSources(osm), project = tramProjection(doc.proj), q = doc.q;
    const runs = alignTramRuns(doc.trams, snapshot, { project, q });
    return tramMetadataFromRuns(snapshot, runs, { project, q });
}

/** Literal crossing-way context only: no proximity join or flood through a curb.
 * A source road incidence must survive in the prepared graph, not merely occur
 * somewhere on the complete raw road way. */
export function extractTramCrossingMetadata(doc, osm) {
    if (!doc.trams?.length) return {};
    if (!(doc.q > 0) || !Number.isFinite(doc.q)) throw Error('Missing exact dataset quantization');
    if (!Array.isArray(doc.tramSources) || doc.tramSources.length !== doc.trams.length) throw Error('Crossing context requires existing exact rendered rail identities');
    const railNodes = new Set(doc.tramSources.flatMap(r => r.nodeIds).map(key));
    const preparedNodes = new Set((doc.roadNodeIds || []).filter(id => id != null).map(key));
    const crossings = [...osm.ways].filter(([, w]) => (w.tags?.highway === 'footway' || w.tags?.footway === 'crossing') && w.nodes.some(n => railNodes.has(key(n))));
    const crossingNodes = new Set(crossings.flatMap(([, w]) => w.nodes).map(key));
    const roadsByNode = new Map();
    for (const [index, road] of Object.entries(doc.roadSourceGeometry || {})) {
        const nativeNodes = new Set((doc.roads?.[Number(index)] || []).slice(10).map(i => key(doc.roadNodeIds?.[i])));
        // An unrelated road outside these cached crossing ways is not needed
        // coverage. Every candidate incidence still requires its raw road.
        if (!road.nodeIds?.some(n => crossingNodes.has(key(n)) && nativeNodes.has(key(n)))) continue;
        const raw = osm.ways.get(Number(String(road.sourceId).replace(/^w/, '')));
        if (!raw) throw Error('Cached crossing source road unavailable: ' + road.sourceId);
        for (const id of raw.nodes) if (preparedNodes.has(key(id)) && nativeNodes.has(key(id))) {
            let ways = roadsByNode.get(key(id)); if (!ways) roadsByNode.set(key(id), ways = new Set());
            ways.add(road.sourceId);
        }
    }
    const project = tramProjection(doc.proj), q = doc.q, tramSourceCrossings = [];
    for (const [id, way] of crossings) {
        const railNodeIds = way.nodes.filter(n => railNodes.has(key(n))), roadIncidences = [];
        for (const nodeId of way.nodes) for (const sourceId of roadsByNode.get(key(nodeId)) || []) roadIncidences.push({ nodeId, sourceId });
        if (!railNodeIds.length || !roadIncidences.length) continue;
        const missingNodeIds = way.nodes.filter(n => !(osm.nodes.get(n)?.length >= 2) || !osm.nodes.get(n).slice(0, 2).every(Number.isFinite));
        const nodeTags = Object.fromEntries(way.nodes.map(n => [key(n), copyTags(osm.ntags?.get(n))]));
        tramSourceCrossings.push({ sourceId: 'w' + id, nodeIds: [...way.nodes], tags: copyTags(way.tags),
            points: missingNodeIds.length ? null : tramDelta(way.nodes.map(n => project(...osm.nodes.get(n))), q), nodeTags,
            railNodeIds, roadIncidences, ...(missingNodeIds.length ? { missingNodeIds } : {}) });
    }
    tramSourceCrossings.sort((a, b) => Number(a.sourceId.slice(1)) - Number(b.sourceId.slice(1)));
    return { tramSourceCrossings };
}

export function appendTramCrossingMetadata(original, metadata) {
    const doc = JSON.parse(original);
    if (!doc.trams?.length) return original;
    if (!TRAM_SOURCE_FIELDS.every(k => Object.hasOwn(doc, k))) throw Error('Existing source rail metadata required before crossing append');
    if (Object.hasOwn(doc, 'tramSourceCrossings')) throw Error('Crossing metadata already exists; refuse to overwrite an existing dataset value');
    if (!Array.isArray(metadata.tramSourceCrossings)) throw Error('Incomplete crossing metadata contract');
    const end = original.match(/}\s*$/); if (!end) throw Error('Expected JSON object dataset');
    const updated = original.slice(0, end.index) + ',"tramSourceCrossings":' + JSON.stringify(metadata.tramSourceCrossings) + end[0];
    const check = JSON.parse(updated); delete check.tramSourceCrossings;
    if (JSON.stringify(check) !== JSON.stringify(doc)) throw Error('An existing dataset value changed');
    return updated;
}

/** Append only new fields to the original JSON bytes; no existing values, formatting or date is regenerated. */
export function appendTramMetadata(original, metadata) {
    const doc = JSON.parse(original);
    if (!doc.trams?.length) return original;
    if (TRAM_SOURCE_FIELDS.some(k => Object.hasOwn(doc, k))) throw Error('Source metadata already exists; refuse to overwrite an existing dataset value');
    if (!TRAM_SOURCE_FIELDS.every(k => Object.hasOwn(metadata, k))) throw Error('Incomplete tram metadata contract');
    const end = original.match(/}\s*$/); if (!end) throw Error('Expected JSON object dataset');
    const insertion = TRAM_SOURCE_FIELDS.map(k => `${JSON.stringify(k)}:${JSON.stringify(metadata[k])}`).join(',');
    const updated = original.slice(0, end.index) + ',' + insertion + end[0];
    const check = JSON.parse(updated); for (const k of TRAM_SOURCE_FIELDS) delete check[k];
    if (JSON.stringify(check) !== JSON.stringify(doc)) throw Error('An existing dataset value changed');
    return updated;
}
