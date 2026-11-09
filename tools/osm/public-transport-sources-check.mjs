import assert from 'node:assert/strict';
import fs from 'node:fs';
import { snapshotPublicTransportSources, publicTransportCatalogue } from './public-transport-sources.mjs';
import { sourceTransitStopPlacement } from '../../game/src/source-transit-stop.js';
const tests = [], test = (name, fn) => { fn(); tests.push(name); };
const real = JSON.parse(fs.readFileSync(new URL('../../game/data/bucharest-grozavesti.json', import.meta.url)));
const copy = () => structuredClone(real);
test('actual southbound stop uses literal west platform', () => {
    const p = sourceTransitStopPlacement(real, 2); assert.equal(p.resolved, true); assert.equal(p.sourceId, 'n933659725'); assert.equal(p.platformSourceId, 'w909062875'); assert.equal(p.model.estimated, true); assert.ok(Math.abs(p.stopDistanceM - 2.24352340729) < 1e-9);
});
test('actual northbound stop uses literal east platform', () => {
    const p = sourceTransitStopPlacement(real, 17); assert.equal(p.resolved, true); assert.equal(p.platformSourceId, 'w909062874'); assert.ok(Math.abs(p.stopDistanceM - 2.32974875923) < 1e-9);
    assert.equal(p.association, 'estimated-unique-nearest-same-name-parallel-platform');
});
test('roof centre stays exactly on unchanged platform line', () => {
    for (const i of [2, 17]) { const p = sourceTransitStopPlacement(real, i); assert.ok(Math.hypot(p.x - p.side * .25 * Math.cos(p.angle) - p.platformPoint[0], p.z + p.side * .25 * Math.sin(p.angle) - p.platformPoint[1]) < 1e-10); }
});
test('generic model station is literal platform half arclength, independent of vehicle-stop projection', () => {
    for (const i of [2, 17]) { const p = sourceTransitStopPlacement(real, i), way = real.publicTransportSources.platforms.find(w => w.sourceId === p.platformSourceId); assert.deepEqual(p.platformPoint, [(way.points[0][0] + way.points[1][0]) / 2, (way.points[0][1] + way.points[1][1]) / 2]); assert.ok(Math.hypot(p.platformPoint[0] - p.associationPoint[0], p.platformPoint[1] - p.associationPoint[1]) > 5); }
});
test('stale prepared POI association is explicit', () => { const d = copy(); d.pois[2][1] += 10; assert.equal(sourceTransitStopPlacement(d, 2).reason, 'stale-source-poi-anchor'); });
test('source-free legacy datasets retain existing placement', () => { const d = copy(); delete d.publicTransportSources; assert.equal(sourceTransitStopPlacement(d, 2), null); });
test('ordinary bus stop retains existing roadside placement', () => assert.equal(sourceTransitStopPlacement(real, 0), null));
test('literal shelter=no is respected', () => { const d = copy(); d.publicTransportSources.poiSources[2].tags.shelter = 'no'; assert.equal(sourceTransitStopPlacement(d, 2).reason, 'literal-shelter-no'); });
test('shelter existence is not guessed from stop_position', () => { const d = copy(); for (const p of d.publicTransportSources.platforms) delete p.tags.shelter; assert.equal(sourceTransitStopPlacement(d, 2).resolved, false); });
test('nearby namesake without parallel source track is refused', () => { const d = copy(); d.tramSourceWays = []; assert.equal(sourceTransitStopPlacement(d, 2).resolved, false); });
test('equidistant separate platforms remain ambiguous', () => { const d = copy(); const p = structuredClone(d.publicTransportSources.platforms.find(p => p.sourceId === 'w909062875')); p.sourceId = 'w900000000000'; d.publicTransportSources.platforms.push(p); assert.equal(sourceTransitStopPlacement(d, 2).reason, 'ambiguous-platform-association'); });
test('literal stop_area membership outranks model association', () => { const d = copy(); d.publicTransportSources.stopAreas.push({ sourceId: 'r1', tags: { public_transport: 'stop_area' }, members: [{ type: 'node', ref: 933659725, role: 'stop' }, { type: 'way', ref: 909062874, role: 'platform' }] }); const p = sourceTransitStopPlacement(d, 2); assert.equal(p.platformSourceId, 'w909062874'); assert.equal(p.association, 'literal-stop-area'); });
test('different layer / tagged grade never silently becomes flat', () => { for (const tags of [{ layer: '1' }, { incline: 'up' }, { ele: '75' }, { level: '1' }, { bridge: 'yes' }]) { const d = copy(); for (const p of d.publicTransportSources.platforms) Object.assign(p.tags, tags); assert.equal(sourceTransitStopPlacement(d, 2).resolved, false); } });
test('closed platform footprint is not treated as a centre line', () => { const d = copy(); for (const p of d.publicTransportSources.platforms) p.nodeIds.push(p.nodeIds[0]); assert.equal(sourceTransitStopPlacement(d, 2).resolved, false); });
test('short source line cannot host the unchanged shelter', () => { const d = copy(); const p = d.publicTransportSources.platforms.find(p => p.sourceId === 'w909062875'); const c = sourceTransitStopPlacement(d, 2).platformPoint; p.points = [[c[0], c[1] - 1], [c[0], c[1] + 1]]; d.publicTransportSources.platforms = [p]; assert.equal(sourceTransitStopPlacement(d, 2).resolved, false); });
test('repeat placement preserves all source arrays / identities / RNG', () => { const before = JSON.stringify(real), random = Math.random; Math.random = () => { throw Error('RNG called'); }; try { for (let i = 0; i < 10; i++) assert.deepEqual(sourceTransitStopPlacement(real, 2), sourceTransitStopPlacement(real, 2)); } finally { Math.random = random; } assert.equal(JSON.stringify(real), before); });
test('raw snapshot retains complete tags/geometry independently of later edits', () => {
    const raw = { nodes: new Map([[1, [0, 0]], [2, [0, .01]], [3, [0, .02]]]), ntags: new Map([[1, { railway: 'tram_stop', public_transport: 'stop_position' }]]), ways: new Map([[5, { nodes: [2, 3], tags: { railway: 'platform', shelter: 'yes', width: 'unknown' } }]]), rels: new Map([[7, { tags: { type: 'public_transport', public_transport: 'stop_area' }, members: [{ type: 'node', ref: 1, role: 'stop' }, { type: 'way', ref: 5, role: 'platform' }] }]]) };
    const snapshot = snapshotPublicTransportSources(raw); raw.ways.get(5).tags.shelter = 'no';
    const d = { proj: { lat0: 0, lon0: 0, mPerLat: 1, mPerLon: 1, scale: 1 }, pois: [[0, 0, 0, 0, -1, 1, -1]], poiKinds: ['busstop'], strings: ['', 'tram_stop'] };
    const meta = publicTransportCatalogue(d, snapshot, [{ file: 'raw.xml', sha256: 'a'.repeat(64) }]).publicTransportSources;
    assert.equal(meta.poiSources[0].sourceId, 'n1'); assert.equal(meta.platforms[0].tags.width, 'unknown'); assert.equal(meta.platforms[0].tags.shelter, 'yes'); assert.equal(meta.stopAreas[0].sourceId, 'r7'); assert.deepEqual(meta.platforms[0].nodeIds, [2, 3]);
});
console.log(JSON.stringify({ passed: tests.length, tests }, null, 2));
