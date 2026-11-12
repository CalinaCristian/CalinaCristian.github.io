#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseFiles } from './parse-osm.mjs';
import { readDistrictData } from './district-data.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'source-relation-parts-'));
try {
    fs.mkdirSync(path.join(tmp, 'tiles'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'game/research'), { recursive: true });
    fs.cpSync(path.join(root, 'tools/osm'), path.join(tmp, 'tools/osm'), { recursive: true, filter: f => !f.includes('/cache/') });
    fs.cpSync(path.join(root, 'game/src'), path.join(tmp, 'game/src'), { recursive: true }); fs.symlinkSync(path.join(root, 'game/vendor'), path.join(tmp, 'game/vendor'), 'dir');
    let xml = fs.readFileSync(path.join(root, 'tools/osm/fixtures/bellevue-relation-parts.xml'), 'utf8');
    const original = parseFiles([path.join(root, 'tools/osm/fixtures/bellevue-relation-parts.xml')]);
    const basis = xml.match(/<relation id="4547848"[\s\S]*?<\/relation>/)[0];
    const controls = [['990000001', 'no', 'yes', true], ['990000002', 'no', 'no', false], ['990000003', 'false', '0', false], ['990000004', '0', 'false', false], ['990000005', 'yes', 'no', true]];
    const extras = controls.map(([id, building, part]) => basis.replace('id="4547848"', `id="${id}"`).replace(/<tag k="building:part"[^>]*\/>/, `<tag k="building:part" v="${part}"/><tag k="building" v="${building}"/>`)).join('');
    xml = xml.replace('</osm>', extras + '<node id="999000001" lat="47.617" lon="-122.197"/><node id="999000002" lat="47.617" lon="-122.193"/><way id="999000003"><nd ref="999000001"/><nd ref="999000002"/><tag k="highway" v="residential"/></way></osm>');
    const fixture = path.join(tmp, 'tiles/sea_fixture.xml'); fs.writeFileSync(fixture, xml);
    execFileSync(process.execPath, [path.join(tmp, 'tools/osm/build-data.mjs'), '--tiles', path.join(tmp, 'tiles'), '--city', 'seattle', '--district', 'bellevue'], { stdio: 'pipe' });
    const dataPath = path.join(tmp, 'game/data/seattle-bellevue.json'), d = readDistrictData(dataPath);
    execFileSync('python3', ['-I', path.join(root, 'tools/osm/building-audit.py'), '--data', dataPath, '--osm', fixture, '--out', path.join(tmp, 'audit')], { stdio: 'pipe' });
    const rows = JSON.parse(fs.readFileSync(path.join(tmp, 'audit.json')));
    const actualParts = [...original.rels].filter(([, r]) => r.tags['building:part'] && !r.tags.building);
    assert.equal(actualParts.length, 9);
    for (const [id, relation] of actualParts) {
        const sid = 'r' + id, rr = rows.filter(r => r.osm === sid); assert.ok(rr.length > 0, sid + ' expected by independent auditor');
        for (const row of rr) {
            assert.ok(row.identityPresent && row.topologyMatches && row.literalHeightMatches && row.literalMinimumMatches && row.storeysMatch, sid + ' original topology and literal dimensions retained');
            if (row.holeCountOSM) assert.ok(row.courtyardInteriorsClear && row.holeCountGame === row.holeCountOSM);
        }
        assert.deepEqual(d.buildingSourceTags[sid], relation.tags, sid + ' complete original tag map retained');
        if (relation.tags['building:min_levels']) {
            for (const row of rr) assert.equal(row.unsupportedMinimumTags['building:min_levels'], relation.tags['building:min_levels']);
            const i = d.buildingIds.indexOf(sid); assert.ok(d.buildingSourceIssues[i].some(x => x.includes('unsupported minimum-level'))); assert.equal(d.buildings[i][2], 0, 'Nonstandard relative levels are never silently converted into a physical minimum');
        }
    }
    for (const [id, , , expected] of controls) { assert.equal(d.buildingIds.includes('r' + id), expected); assert.equal(rows.some(r => r.osm === 'r' + id), expected, 'Independent expected-set agrees on explicit negative tags'); }
    assert.ok(d.buildingIds.includes('r4547843') && rows.some(r => r.osm === 'r4547843'), 'Ordinary building relation remains');
    console.log(JSON.stringify({ actualPartRelations: 9, actualBodies: rows.filter(r => actualParts.some(([id]) => r.osm === 'r' + id)).length, explicitTagControls: 5, ordinaryBuildingControl: 1, issues: 0 }));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
