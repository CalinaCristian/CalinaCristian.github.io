// node --test game/dev/source-facade.test.mjs
// Scene details placed on the drawn facade (Old Town balconies) use game/src/spots/source-facade.js, which mirrors the
// shop-floor rule of buildBuildings in osm.js without changing osm.js (it is hashed into the Seattle source-context
// cache). This checks the mirrored rule against the source text of osm.js, so a change there cannot drift silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const osm = readFileSync(new URL('../src/spots/osm.js', import.meta.url), 'utf8');
const mirror = readFileSync(new URL('../src/spots/source-facade.js', import.meta.url), 'utf8');

test('the shop-floor rule and height in source-facade.js match buildBuildings in osm.js', () => {
    const inline = "const shop=urban&&r.minHeight===0&&r.height>7&&(b.shop||b.amenity||style==='mall'||/commercial|retail|mixed|yes/.test(b.k))&&style!=='house'&&style!=='industrial',gf=shop?Math.min(v.h,r.datum+4.3):v.minH;";
    assert.ok(osm.includes(inline), 'osm.js changed its shop-floor rule: update source-facade.js to match');
    const rule = "urban && r.minHeight === 0 && r.height > 7 && (b.shop || b.amenity || style === 'mall' || /commercial|retail|mixed|yes/.test(b.k)) && style !== 'house' && style !== 'industrial'";
    assert.ok(mirror.includes(rule));
    assert.ok(/SHOP_FLOOR_M = 4\.3;/.test(mirror));
    // wall bays: restarted per wall, max(1, round(L / bay)) of them (sourceWallGeometry)
    assert.ok(osm.includes('const ua=Math.round(u/S.bay)*S.bay,span=Math.max(S.bay,Math.round(L/S.bay)*S.bay)'));
});
