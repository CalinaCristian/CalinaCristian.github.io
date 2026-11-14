import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readDistrictData } from './district-data.mjs';
import { extractTramCrossingMetadata, appendTramCrossingMetadata, snapshotTramCrossingSources, TRAM_SOURCE_FIELDS } from './tram-sources.mjs';
const results = [], test = (name, fn) => { fn(); results.push(name); console.log('PASS ' + name); };
const fixture = () => {
    const tags = { crossing: 'traffic_signals', highway: 'crossing', 'traffic_signals:sound': 'no' };
    const osm = { nodes: new Map([[1, [0, 0]], [2, [0, 1]], [3, [0, 2]], [4, [0, 3]], [5, [0, 4]], [6, [1, 0]], [7, [2, 0]], [8, [2, 1]]]), ntags: new Map([[2, tags], [3, { railway: 'crossing', crossing: 'traffic_signals' }]]), ways: new Map([
        [11, { nodes: [1, 2, 3, 4], tags: { highway: 'footway', footway: 'crossing', surface: 'asphalt' } }],
        [12, { nodes: [6, 1, 7], tags: { highway: 'footway', footway: 'crossing' } }], // curb shared with11, no rail
        [13, { nodes: [7, 8], tags: { highway: 'footway' } }],
        [20, { nodes: [6, 2, 7], tags: { highway: 'secondary' } }],
    ]) };
    const doc = { q: 10, proj: { lat0: 0, lon0: 0, mPerLat: 1, mPerLon: 1, scale: 1 }, trams: [[20, 0, 10, 0]], tramSources: [{ sourceId: 'w30', nodeIds: [3, 4] }], tramSourceWays: [], tramRoutes: [], tramSourceNodeTags: {}, roadNodeIds: [6, 2, 7], roads: [[0, 0, 1, 0, 0, 35, 30, 50, 0, 0, 0, 1, 2]], roadSourceGeometry: { 0: { sourceId: 'w20', nodeIds: [6, 2, 7] } }, generated: 'fixed' };
    return { doc, osm };
};
test('literal complete crossing preserves raw references/order/all tags/delta and exact road incidence', () => {
    const { doc, osm } = fixture(), c = extractTramCrossingMetadata(doc, osm).tramSourceCrossings;
    assert.equal(c.length, 1); assert.deepEqual(c[0], { sourceId: 'w11', nodeIds: [1, 2, 3, 4], tags: osm.ways.get(11).tags, points: [0, 0, 10, 0, 10, 0, 10, 0], nodeTags: { 1: {}, 2: osm.ntags.get(2), 3: osm.ntags.get(3), 4: {} }, railNodeIds: [3, 4], roadIncidences: [{ nodeId: 2, sourceId: 'w20' }] });
});
test('sharing a curb never pulls in an adjacent crossing transitively', () => {
    const { doc, osm } = fixture(); assert.deepEqual(extractTramCrossingMetadata(doc, osm).tramSourceCrossings.map(c => c.sourceId), ['w11']);
});
test('compiler snapshot retains complete source context across mutable clipping and decoration', () => {
    const { doc, osm } = fixture(), expected = extractTramCrossingMetadata(doc, osm), snapshot = snapshotTramCrossingSources(osm);
    osm.ways.get(11).nodes.splice(1, 2); osm.ways.get(11).tags.surface = 'changed';
    osm.ways.get(20).nodes.splice(1, 1); osm.ways.get(20).tags.highway = 'service';
    osm.nodes.get(3)[0] = 999; osm.ntags.get(2).crossing = 'uncontrolled';
    assert.deepEqual(extractTramCrossingMetadata(doc, snapshot), expected);
    assert.deepEqual(doc.tramSources[0].nodeIds, [3, 4]);
});
test('coincident geometry with distinct rail IDs creates no crossing identity', () => {
    const { doc, osm } = fixture(); doc.tramSources[0].nodeIds = [30, 40]; assert.deepEqual(extractTramCrossingMetadata(doc, osm).tramSourceCrossings, []);
});
test('complete raw road node alone does not qualify when absent from prepared source graph', () => {
    const { doc, osm } = fixture(); doc.roads[0] = doc.roads[0].slice(0, 10).concat([0, 2]); assert.deepEqual(extractTramCrossingMetadata(doc, osm).tramSourceCrossings, []);
});
test('missing crossing coordinates remain null with all literal refs and unavailable IDs', () => {
    const { doc, osm } = fixture(); osm.nodes.delete(4); const c = extractTramCrossingMetadata(doc, osm).tramSourceCrossings[0]; assert.equal(c.points, null); assert.deepEqual(c.missingNodeIds, [4]); assert.deepEqual(c.nodeIds, [1, 2, 3, 4]);
});
test('missing raw candidate road fails; an unrelated uncached source way requires no invented coverage', () => {
    const { doc, osm } = fixture(); doc.roadSourceGeometry[1] = { sourceId: 'w99', nodeIds: [900, 901] }; assert.equal(extractTramCrossingMetadata(doc, osm).tramSourceCrossings.length, 1);
    osm.ways.delete(20); assert.throws(() => extractTramCrossingMetadata(doc, osm), /Cached crossing source road unavailable/);
});
test('append-only field preserves bytes, old four metadata fields, date and every existing value', () => {
    const { doc, osm } = fixture(), original = JSON.stringify(doc) + '\n', next = appendTramCrossingMetadata(original, extractTramCrossingMetadata(doc, osm));
    assert.ok(next.startsWith(original.slice(0, -2))); const parsed = JSON.parse(next); delete parsed.tramSourceCrossings; assert.deepEqual(parsed, doc);
    for (const field of TRAM_SOURCE_FIELDS) assert.deepEqual(parsed[field], doc[field]);
    assert.throws(() => appendTramCrossingMetadata(next, {}), /already exists/); assert.equal(appendTramCrossingMetadata('{"trams":[]}', {}), '{"trams":[]}');
});
test('the four tram districts carry their source crossing records', () => {
    // (the packs are rebuilt binary files now; the one-time byte-prefix check against the 81c78e35 JSON packs is retired)
    for (const name of ['grozavesti', 'pipera', 'romana', 'unirii']) {
        const doc = readDistrictData(`game/data/bucharest-${name}.bin.gz`);
        assert.ok(Array.isArray(doc.tramSourceCrossings), name);
        for (const c of doc.tramSourceCrossings) assert.ok(c && typeof c === 'object', name);
    }
});
console.log(JSON.stringify({ passed: true, controls: results.length, browserOpened: false, networkUsed: false }));
