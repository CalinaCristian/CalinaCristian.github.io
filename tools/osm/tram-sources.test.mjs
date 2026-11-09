import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { snapshotTramSources, tramProjection, tramDelta, alignTramRuns, tramMetadataFromRuns, extractTramMetadata, appendTramMetadata, TRAM_SOURCE_FIELDS } from './tram-sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../..'), controls = [];
const check = (name, run) => { try { const details = run(); controls.push({ name, pass: true, details }); console.log('PASS ' + name); } catch (error) { controls.push({ name, pass: false, error: String(error.stack || error) }); if (process.argv[2]) { fs.mkdirSync(path.dirname(path.resolve(process.argv[2])), { recursive: true }); fs.writeFileSync(process.argv[2], JSON.stringify({ complete: false, controls, browserLaunched: false, networkUsed: false }, null, 2) + '\n'); } throw error; } };
const proj = { lat0: 0, lon0: 0, scale: 1, mPerLat: 1, mPerLon: 1, compress: null };
function fixture() {
    return { nodes: new Map([[1, [0, 0]], [2, [0, 1]], [3, [0, 2]], [4, [0, 3]], [5, [1, 3]], [6, [-1, 1]], [7, [1, 1]], [9, [2, 3]], [50, [4, 5]]]), ntags: new Map([[1, { railway: 'signal', 'railway:signal:direction': 'forward', '__literal_raw_tag': 'retained' }], [2, { highway: 'traffic_signals', access: 'yes', ele: 'unknown' }], [50, { public_transport: 'stop_position', tram: 'yes' }], [999, { ele: '3' }]]), ways: new Map([
        [101, { nodes: [1, 2, 3, 4], tags: { railway: 'tram', oneway: 'yes', gauge: '1435', operator: 'test', frequency: '0' } }],
        [102, { nodes: [4, 5], tags: { railway: 'tram', bridge: 'yes', layer: '1' } }],
        [103, { nodes: [6, 7], tags: { railway: 'tram', oneway: '-1' } }], // geometry crossing is not a source-node join
        [104, { nodes: [4, 9], tags: { railway: 'disused', 'disused:railway': 'tram', oneway: 'reversible' } }],
        [105, { nodes: [4, 5], tags: { railway: 'tram', service: 'siding' } }],
        [106, { nodes: [5, 999, 9], tags: { railway: 'tram' } }],
    ]), rels: new Map([
        [201, { tags: { type: 'route', route: 'tram', ref: '1' }, members: [{ type: 'node', ref: 50, role: 'stop' }, { type: 'way', ref: 101, role: '' }, { type: 'way', ref: 102, role: 'forward' }, { type: 'way', ref: 777, role: '' }] }],
        [202, { tags: { type: 'route_master', route_master: 'tram', ref: '1' }, members: [{ type: 'relation', ref: 201, role: '' }] }],
        [203, { tags: { type: 'route', route: 'tram', ref: '11', note: 'Temporarily suspended; preserve literal note' }, members: [{ type: 'way', ref: 101, role: 'backward' }] }],
    ]) };
}
const doc = () => ({ version: 2, city: 'test', generated: '2020-02-03', q: 10, proj, trams: [[10, 0, 10, 0]], roads: [[1, 2, 3]], sentinel: { exact: -7.125 } });

check('clipped render runs map to original per-vertex IDs while full source ways stay complete', () => {
    const osm = fixture(), before = JSON.stringify(doc()), metadata = extractTramMetadata(doc(), osm);
    assert.deepEqual(metadata.tramSources[0].nodeIds, [2, 3]); assert.equal(metadata.tramSources[0].sourceId, 'w101');
    const full = metadata.tramSourceWays.find(w => w.sourceId === 'w101'); assert.deepEqual(full.nodeIds, [1, 2, 3, 4]); assert.deepEqual(full.points, [0, 0, 10, 0, 10, 0, 10, 0]); assert.equal(JSON.stringify(doc()), before);
    return { render: metadata.tramSources[0], complete: full };
});
check('shared source nodes include continuation/service/status ways but a geometric crossing does not join', () => {
    const metadata = extractTramMetadata(doc(), fixture()), ids = metadata.tramSourceWays.map(w => w.sourceId);
    assert.ok(ids.includes('w102') && ids.includes('w104') && ids.includes('w105') && ids.includes('w106')); assert.ok(!ids.includes('w103'));
    assert.deepEqual(metadata.tramSourceWays.find(w => w.sourceId === 'w104').tags, fixture().ways.get(104).tags);
    return ids;
});
check('every raw way/node tag and ordered relation role/ref/status survives unchanged', () => {
    const osm = fixture(), metadata = extractTramMetadata(doc(), osm), route = metadata.tramRoutes.find(r => r.sourceId === 'r201');
    assert.deepEqual(metadata.tramSources[0].tags, osm.ways.get(101).tags); assert.deepEqual(route.members, osm.rels.get(201).members); assert.deepEqual(route.tags, osm.rels.get(201).tags);
    assert.deepEqual(metadata.tramSourceNodeTags['1'], osm.ntags.get(1)); assert.deepEqual(metadata.tramSourceNodeTags['50'], osm.ntags.get(50));
    assert.equal(metadata.tramRoutes.find(r => r.sourceId === 'r203').tags.note, osm.rels.get(203).tags.note); assert.ok(metadata.tramRoutes.some(r => r.sourceId === 'r202'));
    return { orderedMembers: route.members, note: metadata.tramRoutes.find(r => r.sourceId === 'r203').tags.note };
});
check('missing complete-way coordinates stay null with all node refs and unavailable route ways explicit', () => {
    const metadata = extractTramMetadata(doc(), fixture()), way = metadata.tramSourceWays.find(w => w.sourceId === 'w106');
    assert.equal(way.points, null); assert.deepEqual(way.nodeIds, [5, 999, 9]); assert.deepEqual(way.missingNodeIds, [999]);
    assert.deepEqual(metadata.tramRoutes.find(r => r.sourceId === 'r201').missingWayIds, [777]); assert.deepEqual(metadata.tramSourceNodeTags['999'], { ele: '3' });
    return way;
});
check('invalid coordinate records remain unavailable rather than inventing projected points', () => {
    const osm = fixture(); osm.nodes.set(999, [NaN, 1]); const metadata = extractTramMetadata(doc(), osm), way = metadata.tramSourceWays.find(w => w.sourceId === 'w106');
    assert.equal(way.points, null); assert.deepEqual(way.missingNodeIds, [999]); assert.deepEqual(way.nodeIds, [5, 999, 9]); return way;
});
check('raw snapshot is independent of later builder tag/node decoration', () => {
    const osm = fixture(), snapshot = snapshotTramSources(osm), project = tramProjection(proj);
    osm.ways.get(101).tags.oneway = '-1'; osm.nodes.get(2)[1] = 100;
    const runs = alignTramRuns(doc().trams, snapshot, { project, q: 10 }); assert.equal(runs[0].tags.oneway, 'yes'); assert.deepEqual(runs[0].nodeIds, [2, 3]); return runs;
});
check('unknown directions/grades remain literal and layer/bridge never become invented metre heights', () => {
    const metadata = extractTramMetadata(doc(), fixture()), bridge = metadata.tramSourceWays.find(w => w.sourceId === 'w102'), ground = metadata.tramSourceWays.find(w => w.sourceId === 'w101');
    assert.deepEqual(bridge.tags, { railway: 'tram', bridge: 'yes', layer: '1' }); assert.equal(ground.tags.ele, undefined); assert.equal(ground.height, undefined); assert.equal(bridge.height, undefined);
    assert.equal(metadata.tramSourceWays.find(w => w.sourceId === 'w104').tags.oneway, 'reversible'); return { bridge, groundTags: ground.tags };
});
check('reverse-render coverage and source oneway=-1 do not rewrite original source order or travel tags', () => {
    const osm = fixture(); osm.ways.get(101).tags.oneway = '-1'; const data = doc(); data.trams = [[20, 0, -10, 0]]; const metadata = extractTramMetadata(data, osm);
    assert.deepEqual(metadata.tramSources[0].nodeIds, [3, 2]); assert.equal(metadata.tramSources[0].tags.oneway, '-1'); assert.deepEqual(metadata.tramSourceWays.find(w => w.sourceId === 'w101').nodeIds, [1, 2, 3, 4]);
    return { renderNodeIds: metadata.tramSources[0].nodeIds, rawOneway: metadata.tramSources[0].tags.oneway };
});
check('ambiguous/coincident IDs and unmatched lines fail instead of guessing a rail identity', () => {
    const osm = fixture(); osm.nodes.set(11, [0, 1]); osm.nodes.set(12, [0, 2]); osm.ways.set(107, { nodes: [11, 12], tags: { railway: 'tram' } });
    assert.throws(() => extractTramMetadata(doc(), osm), /2 exact source identity matches/); const bad = doc(); bad.trams = [[1000, 1000, 10, 0]]; assert.throws(() => extractTramMetadata(bad, fixture()), /0 exact source identity matches/); return { ambiguousRejected: true, unmatchedRejected: true };
});
check('existing bytes, field values, render arrays and generated date survive append-only metadata', () => {
    const original = '{"generated":"2001-01-01", "trams":[[10,0,10,0]],"roads":[1,2],"value":-3.125}\n', metadata = extractTramMetadata(doc(), fixture()), updated = appendTramMetadata(original, metadata);
    const prefix = original.slice(0, original.lastIndexOf('}')); assert.ok(updated.startsWith(prefix)); assert.ok(updated.endsWith('}\n'));
    const parsed = JSON.parse(updated); for (const k of TRAM_SOURCE_FIELDS) delete parsed[k]; assert.deepEqual(parsed, JSON.parse(original)); assert.equal(parsed.generated, '2001-01-01'); assert.throws(() => appendTramMetadata(updated, metadata), /already exists/);
    assert.equal(appendTramMetadata('{"trams":[],"generated":"fixed"}\n', {}), '{"trams":[],"generated":"fixed"}\n'); return { prefixBytes: prefix.length, originalDate: parsed.generated };
});
check('dataset projection/compression/q match the existing delta convention without resampling', () => {
    const p = tramProjection({ ...proj, scale: .7, compress: { above: 1, factor: .35 } }); assert.deepEqual(p(2, 3), [2.0999999999999996, -.945]); assert.deepEqual(tramDelta([p(0, 0), p(2, 3)], 10), [0, 0, 21, -9]); return { delta: tramDelta([p(0, 0), p(2, 3)], 10) };
});
check('actual changed builder clipping emits byte-equivalent render arrays to the baseline compiler', () => {
    const current = fs.readFileSync(path.join(here, 'build-data.mjs'), 'utf8'), previous = execFileSync('git', ['show', '8ccab8b8f2e207aed8ceaca7fd6485590f1c7be7:tools/osm/build-data.mjs'], { cwd: repo, encoding: 'utf8' });
    const block = text => text.match(/    const outT = \[\][\s\S]*?(?=    const doc =)/)?.[0]; assert.ok(block(current) && block(previous));
    const osm = fixture(), snapshot = snapshotTramSources(osm), P = tramProjection(proj), line = [1, 2, 3, 4].map(n => P(...osm.nodes.get(n))), lines = [line], sources = new WeakMap([[line, { sourceId: 'w101', nodeIds: [1, 2, 3, 4], tags: osm.ways.get(101).tags }]]);
    const M = x => x === 0 || x === 3 ? 31 : 0, near = () => true;
    const old = new Function('tramLines', 'M', 'nearNetwork', 'delta', block(previous) + ';return outT;')(lines, M, near, points => tramDelta(points, 10));
    const now = new Function('tramLines', 'tramLineSources', 'M', 'nearNetwork', 'delta', 'tramMetadataFromRuns', 'tramRawSnapshot', 'P', block(current) + ';return {outT,outTramMetadata};')(lines, sources, M, near, points => tramDelta(points, 10), tramMetadataFromRuns, snapshot, P);
    assert.equal(JSON.stringify(now.outT), JSON.stringify(old)); assert.deepEqual(now.outTramMetadata.tramSources[0].nodeIds, [2, 3]); return { old, current: now.outT };
});
const report = { complete: true, controls, browserLaunched: false, networkUsed: false, baseCommit: '8ccab8b8f2e207aed8ceaca7fd6485590f1c7be7', contractCommit: '29f25970', scope: 'Pure source metadata/compiler clipping controls, not runtime rail or native district acceptance.' };
const out = process.argv[2]; if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
console.log(`PASS ${controls.length} source metadata/compiler controls; no browser/network`);
