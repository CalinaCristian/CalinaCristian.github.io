// Pure source metadata only. Rendered lines, motor roads, dates and native geometry are never rewritten here.
export const TRAM_SOURCE_FIELDS = ['tramSources', 'tramSourceWays', 'tramRoutes', 'tramSourceNodeTags'];
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
