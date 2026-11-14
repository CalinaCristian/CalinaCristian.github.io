// Where the facade drawn on a source building actually sits, for scene details that must line up with it (balconies,
// string courses). Mirrors buildBuildings in osm.js: a shop ground floor up to datum + 4.3 m (shop style), then the
// building style's storeys and window bays from there (or from the datum without a shop floor). Each wall carries
// max(1, round(L / bay)) equal bays with a window centred in each. osm.js is not changed for this: it is hashed into the
// Seattle source-context cache. game/dev/source-facade.test.mjs checks that the shop-floor rule here still matches it.
import { facadeStyle, buildingStyle } from './osm.js';

export const SHOP_FLOOR_M = 4.3;
/** does buildBuildings give this source building a shopfront ground floor? (r: its sourceRecord) */
function sourceHasShopFloor(b, r, style, urban = true) {
    return !!(urban && r.minHeight === 0 && r.height > 7 && (b.shop || b.amenity || style === 'mall' || /commercial|retail|mixed|yes/.test(b.k)) && style !== 'house' && style !== 'industrial');
}
/** the drawn upper-floor facade of a source building: its style's bay and storey (S) and where its first upper storey starts */
export function sourceFacadeFrame(b, r, { style = null, urban = true } = {}) {
    const st = style || buildingStyle(b, urban), S = facadeStyle(st), shop = sourceHasShopFloor(b, r, st, urban);
    return { style: st, S, shop, upperBase: shop ? Math.min(r.datum + r.height, r.datum + SHOP_FLOOR_M) : r.datum, datum: r.datum };
}
