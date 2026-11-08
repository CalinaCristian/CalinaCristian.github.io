#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveResearchSource } from './research-source.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const way = { tags: { height: '13.6' } }, relation = { tags: {} };
const ways = new Map([[4547843, way]]), relations = new Map([[4547843, relation]]);
for (const record of [{ osm: 'r4547843' }, { osm: 4547843, osmType: 'relation' }, { osm: '4547843', osmType: 'relation' }]) assert.equal(resolveResearchSource(record, ways, relations).object, relation);
for (const record of [{ osm: 'w4547843' }, { osm: 4547843 }, { osm: '4547843' }, { osm: 4547843, osmType: 'way' }]) assert.equal(resolveResearchSource(record, ways, relations).object, way);
for (const record of [{ osm: 'r4547843', osmType: 'way' }, { osm: 'w4547843', osmType: 'relation' }, { osm: 4547843, osmType: 'node' }, { osm: '4547843bad' }, { osm: -4547843 }, { osm: 'r99999' }, { osm: 'r4547843', osmType: '' }]) assert.equal(resolveResearchSource(record, ways, relations), null);
assert.equal(resolveResearchSource({ osm: 'r4547843' }, ways, new Map()), null, 'No fallback to a same-number way when the requested relation is absent');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'research-source-identity-'));
try {
    fs.mkdirSync(path.join(tmp, 'tiles'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'game/research'), { recursive: true });
    fs.cpSync(path.join(root, 'tools/osm'), path.join(tmp, 'tools/osm'), { recursive: true, filter: f => !f.includes('/cache/') });
    fs.cpSync(path.join(root, 'game/src'), path.join(tmp, 'game/src'), { recursive: true }); fs.symlinkSync(path.join(root, 'game/vendor'), path.join(tmp, 'game/vendor'), 'dir');
    let xml = fs.readFileSync(path.join(root, 'tools/osm/fixtures/research-relation-identity.xml'), 'utf8');
    // Controlled identity-collision fixture: actual w210912230 geometry, renamed only inside this test.
    xml = xml.replace(/<way id="210912230"[\s\S]*?<\/way>/, s => s.replace('id="210912230"', 'id="4547843"').replace('</way>', '<tag k="height" v="13.6"/><tag k="min_height" v="1.2"/><tag k="building:levels" v="4"/></way>'));
    xml = xml.replace('</osm>', '<node id="999000001" lat="47.617" lon="-122.197"/><node id="999000002" lat="47.617" lon="-122.193"/><way id="999000003"><nd ref="999000001"/><nd ref="999000002"/><tag k="highway" v="residential"/></way></osm>');
    fs.writeFileSync(path.join(tmp, 'tiles/sea_fixture.xml'), xml);
    fs.writeFileSync(path.join(tmp, 'game/research/seattle-bellevue.json'), JSON.stringify({ buildings: [
        { osm: 'r4547843', research: { storeys: 25 } },
        { osm: 'w4547843', research: { height_m: 999, storeys: 99 }, min_height: 88 },
        { osm: 4547842, osmType: 'relation', research: { height_m: 999, storeys: 99 } },
        { osm: 'r4547843', osmType: 'way', research: { height_m: 888 } },
    ] }));
    execFileSync(process.execPath, [path.join(tmp, 'tools/osm/build-data.mjs'), '--tiles', path.join(tmp, 'tiles'), '--city', 'seattle', '--district', 'bellevue'], { stdio: 'pipe' });
    const d = JSON.parse(fs.readFileSync(path.join(tmp, 'game/data/seattle-bellevue.json')));
    const profile = id => { const i = d.buildingIds.indexOf(id); assert.ok(i >= 0, id + ' retained'); return d.buildingRoofProfiles[i]; };
    const rp = profile('r4547843'); assert.equal(rp.raw['building:levels'], '25'); assert.equal(rp.heightSource, 'research storeys estimate'); assert.equal(rp.originalOSM['building:levels'], undefined);
    const wp = profile('w4547843'); assert.equal(wp.totalM, 13.6); assert.equal(wp.raw.min_height, '1.2'); assert.equal(d.buildings[d.buildingIds.indexOf('w4547843')][2] / 10, 1.2); assert.equal(wp.raw['building:levels'], '4'); assert.equal(wp.heightSource, 'OSM height');
    const tagged = profile('r4547842'); assert.equal(tagged.totalM, 109); assert.equal(tagged.originalOSM.height, '109'); assert.equal(tagged.heightSource, 'OSM height');
    console.log(JSON.stringify({ actualRelation: 'r4547843', actualTaggedRelationControl: 'r4547842', sameNumericWayCollision: 'controlled fixture only', sourceSelectionControls: 15, issues: 0 }));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
