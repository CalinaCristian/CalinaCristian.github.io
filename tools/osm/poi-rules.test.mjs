// node --test tools/osm/poi-rules.test.mjs
// The district build (build-data.mjs) and the cached-source appender (add-pois.mjs) share one classifier and one set of
// POI / sign rules (poi-kinds.mjs), so a rebuild keeps what the round-2 append added. Proven on a synthetic OSM fixture
// built as the Bellevue district (no tile cache needed): the dropped classes, frontages up to POI_EDGE_M past the playable
// edge, a POI mapped as a relation, the principal occupant, a building's own name back from its tenant, fountain outlines
// as water, the small fountain outline as furniture and storeys from max_level.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { poiKind, basePoiKind, ownBuildingSign, levelsFromLevelTags, isClosedPoi, POI_EDGE_M } from './poi-kinds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('classifier: base classes keep their kind; dropped classes map onto existing kinds', () => {
    assert.deepEqual(poiKind({ amenity: 'cafe', name: 'x' }), ['food', 'cafe']);
    assert.deepEqual(poiKind({ amenity: 'nightclub', name: 'x' }), ['food', 'nightclub']);
    assert.deepEqual(poiKind({ leisure: 'fitness_centre', name: 'Columbia Fitness' }), ['shop', 'fitness_centre']);
    assert.deepEqual(poiKind({ amenity: 'kindergarten', name: 'Grădinița nr. 168' }), ['school', 'kindergarten']);
    assert.deepEqual(poiKind({ leisure: 'marina', name: 'Debarcaderul Regie' }), ['landmark', 'marina']);
    assert.deepEqual(poiKind({ office: 'employment_agency', name: 'Manpower' }), ['office', 'employment_agency']);
    assert.deepEqual(poiKind({ shop: 'yes', name: 'Germag' }), ['shop', 'yes']);
    assert.equal(poiKind({ shop: 'yes' }), null, 'an unnamed shop=yes is not a sign');
    assert.equal(basePoiKind({ shop: 'yes', name: 'Germag' }), null, 'the base classifier is unchanged');
    assert.ok(isClosedPoi({ 'disused:shop': 'clothes', name: 'x' }));
    assert.equal(POI_EDGE_M, 100);
});

test('own building sign and level tags', () => {
    assert.deepEqual(ownBuildingSign({ building: 'commercial', name: 'Victoria Center', 'addr:street': 'Calea Victoriei' }, 'Starbucks', 'food', 'RO'), { name: 'Victoria Center', 'addr:street': 'Calea Victoriei' });
    assert.deepEqual(ownBuildingSign({ building: 'hotel', tourism: 'hotel', name: 'Sheraton Bucharest Hotel', brand: 'Sheraton' }, 'Pizza Hut', 'food', 'RO'), { name: 'Sheraton Bucharest Hotel', tourism: 'hotel', brand: 'Sheraton' });
    assert.deepEqual(ownBuildingSign({ building: 'university', name: 'Facultatea X' }, 'Cafeneaua Y', 'landmark', 'RO'), { kept: 'landmark' });
    assert.equal(ownBuildingSign({ building: 'apartments', name: 'Bl. 8A' }, 'Mega Image', 'shop', 'RO'), null);
    assert.equal(levelsFromLevelTags({ min_level: '0', max_level: '1' }), 2);
    assert.equal(levelsFromLevelTags({ max_level: '3' }), 4);
    assert.ok(Number.isNaN(levelsFromLevelTags({ min_level: '2', max_level: '4' })), 'an elevated part has no storey count from the ground');
    assert.ok(Number.isNaN(levelsFromLevelTags({})));
});

test('build-data.mjs imports the shared classifier (no inline copy left)', () => {
    const src = fs.readFileSync(path.join(root, 'tools/osm/build-data.mjs'), 'utf8');
    assert.match(src, /from '\.\/poi-kinds\.mjs'/);
    assert.doesNotMatch(src, /const poiKind = \(t\) =>/);
    assert.doesNotMatch(src, /const BRAND_NORM = \[/);
});

// ---- fixture district build
const P = { lat0: 47.6145, lon0: -122.195, mPerLat: 111132, mPerLon: 75042.53557591343 }; // seattle-bellevue projection
const ll = (x, z) => [+(P.lat0 - z / P.mPerLat).toFixed(8), +(P.lon0 + x / P.mPerLon).toFixed(8)];
function fixtureXml() {
    let id = 900000000; const out = [];
    const node = (x, z, tags = {}) => { const n = ++id, [la, lo] = ll(x, z); out.push(`<node id="${n}" lat="${la}" lon="${lo}">${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</node>`); return n; };
    const way = (ns, tags = {}) => { const w = ++id; out.push(`<way id="${w}">${ns.map(n => `<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</way>`); return w; };
    const rect = (cx, cz, hw, hd) => { const a = [node(cx - hw, cz - hd), node(cx + hw, cz - hd), node(cx + hw, cz + hd), node(cx - hw, cz + hd)]; return [...a, a[0]]; };
    const rel = (members, tags) => { const r = ++id; out.push(`<relation id="${r}">${members.map(([t, ref, role]) => `<member type="${t}" ref="${ref}" role="${role}"/>`).join('')}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join('')}</relation>`); return r; };
    const ids = {};
    way([node(-650, -303), node(-489, -303), node(-330, -303)], { highway: 'residential', name: 'Test Street' });
    way([node(-489, -303), node(-489, -460)], { highway: 'residential', name: 'Edge Street' });
    ids.inside = node(-489, -296, { amenity: 'cafe', name: 'Inside Cafe' });
    ids.edge = node(-489, -540, { amenity: 'restaurant', name: 'Edge Diner' });          // ≈ 37 m outside the playable edge
    ids.far = node(-489, -660, { amenity: 'restaurant', name: 'Far Diner' });             // ≈ 157 m outside
    ids.edgeAtm = node(-480, -540, { amenity: 'atm', brand: 'Test Bank' });
    ids.club = node(-470, -310, { amenity: 'nightclub', name: 'Night Owl' });
    ids.shopYes = node(-455, -296, { shop: 'yes', name: 'Germag Test' });
    ids.closed = node(-450, -310, { 'disused:shop': 'clothes', name: 'Gone Shop' });
    // a hotel mapped as a multipolygon building with a restaurant node inside it
    const hw = way(rect(-400, -285, 15, 15)); ids.hotelRel = rel([['way', hw, 'outer']], { type: 'multipolygon', building: 'hotel', tourism: 'hotel', name: 'Test Hotel' });
    ids.hotelTenant = node(-400, -280, { amenity: 'restaurant', name: "Spencer's Test" });
    // a named commercial building signed by its street-level tenant
    ids.tower = way(rect(-560, -285, 12, 12), { building: 'commercial', name: 'Own Tower' });
    ids.towerTenant = node(-560, -280, { amenity: 'cafe', name: 'Tenant Cafe' });
    // fountains: a 100 m² basin and a 1.4 m² bowl
    ids.basin = way(rect(-520, -330, 5, 5), { amenity: 'fountain' });
    ids.bowl = way(rect(-540, -330, 0.6, 0.6), { amenity: 'fountain' });
    // a two-level building mapped with level tags only
    ids.levels = way(rect(-600, -330, 8, 8), { building: 'commercial', name: 'Two Level', min_level: '0', max_level: '1' });
    return { xml: `<?xml version='1.0' encoding='utf-8'?>\n<osm version="0.6">${out.join('\n')}</osm>`, ids };
}

test('a fixture district build keeps the round-2 classes, edge frontages, relation POIs and own names', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-rules-'));
    try {
        fs.mkdirSync(path.join(tmp, 'tiles'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'game/research'), { recursive: true });
        fs.cpSync(path.join(root, 'tools/osm'), path.join(tmp, 'tools/osm'), { recursive: true, filter: f => !/[\\/]cache([\\/]|$)/.test(f) });
        fs.cpSync(path.join(root, 'game/src'), path.join(tmp, 'game/src'), { recursive: true });
        fs.cpSync(path.join(root, 'game/vendor'), path.join(tmp, 'game/vendor'), { recursive: true });
        const { xml, ids } = fixtureXml();
        fs.writeFileSync(path.join(tmp, 'tiles/sea_fixture.xml'), xml);
        execFileSync(process.execPath, [path.join(tmp, 'tools/osm/build-data.mjs'), '--tiles', path.join(tmp, 'tiles'), '--city', 'seattle', '--district', 'bellevue'], { stdio: 'pipe', maxBuffer: 1 << 28 });
        const { readDistrictData } = await import(pathToFileURL(path.join(tmp, 'tools/osm/district-data.mjs')).href);
        const d = readDistrictData(path.join(tmp, 'game/data/seattle-bellevue.bin.gz'));
        const src = d.poiSources || {}, byOsm = new Map(Object.entries(src).map(([i, s]) => [s, d.pois[+i]]));
        const str = (i) => (i >= 0 ? d.strings[i] : '');
        const has = (osm) => byOsm.has(osm);
        assert.ok(has('node/' + ids.inside), 'inside POI');
        assert.ok(has('node/' + ids.edge), 'a frontage 37 m past the edge is kept (POI_EDGE_M)');
        assert.ok(!has('node/' + ids.far), 'nothing past POI_EDGE_M');
        assert.ok(!has('node/' + ids.edgeAtm), 'no ATM across the edge');
        assert.equal(d.poiKinds[byOsm.get('node/' + ids.club)?.[0]], 'food', 'nightclub (a class the first builds dropped)');
        assert.equal(str(byOsm.get('node/' + ids.shopYes)?.[5]), 'yes', 'named shop=yes');
        assert.ok(!has('node/' + ids.closed), 'disused shop not kept');
        const hotel = byOsm.get('relation/' + ids.hotelRel);
        assert.equal(d.poiKinds[hotel?.[0]], 'hotel', 'a hotel mapped as a relation has its POI');
        const hb = d.buildingIds.indexOf('r' + ids.hotelRel);
        assert.ok(hb >= 0 && hotel[6] === hb, 'the relation POI points at its own building');
        assert.equal(str(d.buildings[hb][4]), 'Test Hotel', 'principal occupant: the hotel names its building, not the restaurant inside');
        const tb = d.buildingIds.indexOf('w' + ids.tower);
        assert.equal(str(d.buildings[tb][4]), 'Tenant Cafe', 'the tenant keeps the build sign');
        assert.deepEqual(d.buildingOwnTags?.['w' + ids.tower], { name: 'Own Tower' }, 'the building gets its own name back (buildingOwnTags)');
        const ai = (d.areaSourceIds || []).indexOf('w' + ids.basin);
        assert.ok(ai >= 0 && d.areaKinds[d.areas[ai][0]] === 'water', 'a fountain outline is its basin water');
        assert.equal(d.areaSourceTags?.['w' + ids.basin]?.amenity, 'fountain');
        assert.ok(!(d.areaSourceIds || []).includes('w' + ids.bowl), 'a 1.4 m² bowl is not an area');
        const fk = d.furnKinds.indexOf('fountain'), F = d.furniture; let bowl = false;
        for (let i = 0; i + 2 < F.length; i += 3) if (F[i] === fk && Math.hypot(F[i + 1] / 10 + 540, F[i + 2] / 10 + 330) < 1) bowl = true;
        assert.ok(bowl, 'the small fountain outline is the furniture fountain');
        const lb = d.buildingIds.indexOf('w' + ids.levels);
        assert.equal(d.buildings[lb][6], 2, 'storeys from min_level / max_level');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
