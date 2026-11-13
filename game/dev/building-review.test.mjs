// node --test game/dev/building-review.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { BUILDING_REVIEW, applyBuildingReview } from '../src/building-review.js';
import { decodeDistrictPack } from '../src/district-pack.js';

const rec = (over = {}) => ({ i: 0, sourceId: 'w1', h: 17.7, levels: 5, style: 'bloc', roof: 'flat', flags: 1, colour: '', roofColour: '', heightSourceCode: 2,
    roofProfile: { version: 1, shape: 'flat', totalM: 17.7, eavesM: 17.7, riseM: 0, heightSource: 'style estimate', raw: {}, originalOSM: {} }, ...over });

test('a reviewed height replaces an estimated one and its roof profile', () => {
    BUILDING_REVIEW['test-a'] = { w1: { h: 6, levels: 1, style: 'plain', roof: 'flat', colour: '#4A4D52', note: 't' } };
    const b = rec({ roofProfile: { version: 1, shape: 'gabled', totalM: 9, eavesM: 4.2, riseM: 4.8, heightSource: 'style estimate', raw: {}, originalOSM: {} } });
    const audit = applyBuildingReview({ key: 'test-a', bRecs: [b] });
    assert.deepEqual(audit.applied, ['w1']);
    assert.equal(b.h, 6); assert.equal(b.levels, 1); assert.equal(b.style, 'plain'); assert.equal(b.colour, '#4A4D52'); assert.equal(b.reviewedColour, true);
    assert.equal(b.roofProfile.shape, 'flat'); assert.equal(b.roofProfile.totalM, 6); assert.equal(b.roofProfile.eavesM, 6);
    assert.equal(b.roofProfile.heightSource, 'street-level review estimate');
    delete BUILDING_REVIEW['test-a'];
});

test('an OSM-tagged height and roof shape stay', () => {
    BUILDING_REVIEW['test-b'] = { w1: { h: 6, levels: 1, roof: 'flat', colour: '#FFFFFF', shopfront: false, note: 't' } };
    const profile = { version: 1, shape: 'hipped', totalM: 18, eavesM: 15, riseM: 3, heightSource: 'OSM height', raw: { height: '18', 'roof:shape': 'hipped' }, originalOSM: { height: '18', 'roof:shape': 'hipped' } };
    const b = rec({ h: 18, levels: 6, heightSourceCode: 0, roof: 'hipped', roofProfile: profile });
    const audit = applyBuildingReview({ key: 'test-b', bRecs: [b] });
    assert.deepEqual(audit.osmKept, ['w1']);
    assert.equal(b.h, 18); assert.equal(b.levels, 6); assert.equal(b.roofProfile, profile); assert.equal(b.roof, 'hipped');
    assert.equal(b.colour, '#FFFFFF'); assert.equal(b.flags & 1, 0);
    delete BUILDING_REVIEW['test-b'];
});

test('unknown districts and ids change nothing', () => {
    const b = rec(), before = JSON.stringify(b);
    assert.deepEqual(applyBuildingReview({ key: 'nowhere', bRecs: [b] }), { applied: [], missing: [], osmKept: [] });
    BUILDING_REVIEW['test-c'] = { w999: { style: 'glass', note: 't' } };
    assert.deepEqual(applyBuildingReview({ key: 'test-c', bRecs: [b] }).missing, ['w999']);
    assert.equal(JSON.stringify(b), before);
    delete BUILDING_REVIEW['test-c'];
});

test('every review row names a building of its district data, has a note and never overrides an OSM height', () => {
    for (const [key, rows] of Object.entries(BUILDING_REVIEW)) {
        const d = decodeDistrictPack(new Uint8Array(zlib.gunzipSync(fs.readFileSync(new URL(`../data/${key}.bin.gz`, import.meta.url)))));
        for (const [id, r] of Object.entries(rows)) {
            const i = d.buildingIds.indexOf(id);
            assert.ok(i >= 0, `${key} ${id} is in the district data`);
            assert.ok(r.note && r.note.length > 10, `${key} ${id} has a note`);
            const p = d.buildingRoofProfiles?.[i], osm = d.buildingInfo?.[i * 5 + 4] === 0 || /^OSM/.test(p?.heightSource || '');
            if (r.h) assert.ok(!osm, `${key} ${id}: a reviewed height on an OSM-tagged height would be ignored`);
            for (const c of [r.colour, r.roofColour]) if (c) assert.match(c, /^#[0-9A-Fa-f]{6}$/);
            if (r.style) assert.ok(['bloc', 'civic', 'interwar', 'eclectic', 'glass', 'shop', 'plain', 'house'].includes(r.style), `${key} ${id} style`);
        }
    }
});
