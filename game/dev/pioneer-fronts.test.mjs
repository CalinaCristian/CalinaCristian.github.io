// Pioneer Square round 3: the per-front facade table and the west-end OSM snapshot stay tied to their sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTS, OCC_CANOPY } from '../src/spots/scenes/pioneer-square-fronts.js';
import { WESTEND } from '../src/spots/scenes/pioneer-square-westend-data.js';
import { FRONTS_OSM } from '../src/spots/scenes/pioneer-square-backfronts.js';

const data = JSON.parse(readFileSync(new URL('../data/spots/pioneer-square.json', import.meta.url), 'utf8'));
const byId = new Map(data.buildings.map((b) => [b.id, b]));

test('every front is a mapped building of the spot extract, with its panorama recorded; OSM colour wins where mapped', () => {
    for (const [id, F] of Object.entries(FRONTS)) {
        const b = byId.get(id); assert.ok(b, `${id} (${F.name}) is not in pioneer-square.json`);
        assert.ok(!b.part, `${id} is a building:part`);
        assert.match(F.src, /[A-Za-z0-9_-]{22}@\d+/, `${id}: panorama id @ bearing`);
        if (b.c) assert.equal(F.osmColour, true, `${id} has building:colour ${b.c}: the table must defer to it`);
        else assert.match(F.wall || '', /^#[0-9a-f]{6}$/i, `${id}: a wall colour`);
    }
    assert.ok(byId.get(OCC_CANOPY), 'the Occidental Square canopy is a mapped way');
});

test('the OSM-only fronts behind the walk area are mapped buildings, not panorama fronts, and defer to building:colour', () => {
    for (const [id, F] of Object.entries(FRONTS_OSM)) {
        const b = byId.get(id); assert.ok(b, `${id} (${F.name}) is not in pioneer-square.json`);
        assert.ok(!b.part, `${id} is a building:part`); assert.ok(!FRONTS[id], `${id} is also a panorama front`);
        if (b.c) assert.equal(F.osmColour, true, `${id} has building:colour ${b.c}`); else assert.match(F.wall || '', /^#[0-9a-f]{6}$/i);
    }
});

test('the west-end snapshot holds only features the spot extract does not already carry', () => {
    const have = new Set([...data.ways.map((w) => w.id), ...data.areas.map((a) => a.id)]);
    for (const k of ['roads', 'foot', 'crossings', 'beds', 'piers', 'parks']) for (const f of WESTEND[k]) {
        assert.match(f.id, /^w\d+$/); assert.ok(!have.has(f.id), `${f.id} duplicated`);
        for (const p of f.pts || f.poly) assert.ok(p[0] < 0, `${f.id} lies west of 1st Ave`);
    }
    assert.ok(WESTEND.signals.length > 0 && WESTEND.trees.length > 0);
});
