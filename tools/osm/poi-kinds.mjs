// OSM tags → game POI kind, shared by the cached-source POI appender (add-pois.mjs).
//   basePoiKind(t)  the classifier of build-data.mjs (section 4, `poiKind`), copied verbatim: what a district build keeps
//   extraPoiKind(t) classes the build drops (fidelity pass 2026-11-12, BACKLOG fp-rebuild): they map onto the EXISTING
//                   `poiKinds` table (no new kind index, so world.js needs no new kind), the OSM value travels in `sub`
//   poiKind(t)      base first, then the extra classes: an element the build already classifies never changes kind
// A future district rebuild should import poiKind from here instead of its inline copy (not done: no tile cache to re-run it).
export const POI_KINDS = ['office', 'school', 'airport', 'fuel', 'food', 'shop', 'bank', 'pharmacy', 'metro', 'busstop', 'hospital', 'landmark', 'park', 'hotel'];

export function basePoiKind(t) {
    const a = t.amenity, s = t.shop, tr = t.tourism;
    if (a === 'fuel') return ['fuel', a];
    if (a === 'fast_food' || a === 'cafe' || a === 'restaurant' || a === 'food_court' || a === 'ice_cream') return ['food', a];
    if (a === 'bank' || a === 'atm' || a === 'bureau_de_change') return ['bank', a];
    if (a === 'pharmacy') return ['pharmacy', a];
    if (a === 'hospital' || a === 'clinic') return ['hospital', a];
    if (a === 'university' || a === 'school' || a === 'college') return ['school', a];
    if (a === 'cinema' || a === 'theatre' || a === 'place_of_worship' || a === 'police' || a === 'fire_station' || a === 'townhall' || a === 'arts_centre' || a === 'library') return ['landmark', a];
    if (a === 'bus_station') return ['busstop', a];
    if (['supermarket', 'mall', 'convenience', 'department_store', 'car', 'bakery', 'electronics', 'clothes', 'doityourself', 'hardware', 'furniture'].includes(s)) return ['shop', s];
    if (s && !/^(vacant|no|yes|disused)$/.test(s) && (t.name || t.brand)) return ['shop', s];
    if (['bookmaker', 'casino', 'gambling', 'car_rental', 'car_wash', 'post_office', 'money_transfer', 'dentist', 'doctors', 'veterinary', 'internet_cafe', 'driving_school'].includes(a)) return ['shop', a];
    if (a === 'bar' || a === 'pub' || a === 'biergarten') return ['food', a];
    if (t.office === 'courier' && (t.name || t.brand)) return ['shop', 'courier'];
    if (tr === 'hotel' || tr === 'hostel' || tr === 'motel') return ['hotel', tr];
    if (tr === 'attraction' || tr === 'museum' || tr === 'viewpoint' || tr === 'artwork' && t.name || t.historic === 'monument' || t.historic === 'memorial' && t.name) return ['landmark', tr || t.historic];
    if (t.railway === 'subway_entrance' || t.station === 'subway' || (t.railway === 'station' && (t.subway === 'yes' || t.station === 'subway' || t.station === 'light_rail'))) return ['metro', t.railway || 'station'];
    if (t.railway === 'station' || (t.public_transport === 'station' && !t.bus)) return ['landmark', 'station'];
    if (t.highway === 'bus_stop' || (t.public_transport === 'platform' && t.bus === 'yes')) return ['busstop', 'bus_stop'];
    if (t.railway === 'tram_stop' || (t.public_transport === 'platform' && t.tram === 'yes')) return ['busstop', 'tram_stop'];
    if (t.leisure === 'park' && t.name) return ['park', 'park'];
    if (t.leisure === 'stadium') return ['landmark', 'stadium'];
    if (t.aeroway === 'terminal' || t.aeroway === 'aerodrome') return ['airport', t.aeroway];
    if (t.office && t.name && ['company', 'it', 'telecommunication', 'government', 'diplomatic', 'financial', 'insurance'].includes(t.office)) return ['office', t.office];
    return null;
}

/** classes the build drops; all need a name or brand (an unnamed gym or office is not a sign) */
export function extraPoiKind(t) {
    if (!(t.name || t.brand)) return null;
    const a = t.amenity, tr = t.tourism, l = t.leisure, h = t.healthcare, o = t.office;
    if (a === 'nightclub') return ['food', a];                                         // like bar / pub
    if (['kindergarten', 'childcare', 'language_school', 'music_school', 'prep_school', 'dancing_school'].includes(a)) return ['school', a];
    if (['courthouse', 'embassy', 'community_centre', 'conference_centre', 'events_venue', 'exhibition_centre', 'marketplace', 'music_venue', 'public_bath', 'monastery'].includes(a)) return ['landmark', a];
    if (tr === 'gallery') return ['shop', 'gallery'];                                  // a street-front unit with a fascia
    if (tr === 'guest_house') return ['hotel', tr];
    if (tr === 'zoo' || tr === 'theme_park' || tr === 'aquarium') return ['landmark', tr];
    if (['fitness_centre', 'bowling_alley', 'amusement_arcade', 'adult_gaming_centre', 'escape_game', 'dance', 'sauna'].includes(l)) return ['shop', l];
    if (l === 'sports_centre' || l === 'marina' || l === 'water_park') return ['landmark', l];
    if (t.craft) return ['shop', 'craft'];
    if (h) return h === 'hospital' || h === 'clinic' ? ['hospital', h] : ['shop', h];  // (amenity=dentist / doctors are 'shop' in the base table)
    if (o && !/^(vacant|no|disused)$/.test(o)) return ['office', o];
    if (['castle', 'manor', 'ruins', 'archaeological_site', 'city_gate', 'fort'].includes(t.historic)) return ['landmark', t.historic];
    return null;
}
export const poiKind = (t) => basePoiKind(t) || extraPoiKind(t);

/** not a trading / open place: never added */
export function isClosedPoi(t) {
    if (t.disused === 'yes' || t.abandoned === 'yes' || t.demolished === 'yes' || t.ruins === 'yes' && !t.historic) return true;
    if (/^(closed|off)$/i.test(String(t.opening_hours || '').trim())) return true;
    if (/^(vacant|disused|no)$/.test(t.shop || '') || /^(vacant|disused)$/.test(t.office || '')) return true;
    if (/^(construction|proposed|planned)$/.test(t.amenity || '') || t.construction || t.proposed) return true;
    if (t.end_date && /^\d{4}/.test(t.end_date) && t.end_date.slice(0, 10) <= new Date().toISOString().slice(0, 10)) return true;
    for (const k in t) if (/^(disused|abandoned|was|demolished|removed|razed|closed|former|construction|proposed|planned):(amenity|shop|tourism|leisure|office|craft|healthcare|railway|highway|public_transport)$/.test(k) && !t[k.split(':')[1]]) return true;
    return false;
}
/** not at street level (a unit inside a mall, an upper floor, underground): no street sign can be claimed for it */
export const isOffStreet = (t) => (t.level != null && !/^0(;0)*$/.test(String(t.level).trim())) || t.location === 'indoor' || t.indoor === 'yes' || t.location === 'underground';

// brand names as they are written on the signs (build-data.mjs BRAND_NORM / signText, copied verbatim)
const BRAND_NORM = [
    [/^garanti( bankas[ıi]| bank)?$/i, 'Garanti BBVA'], [/^(лукойл|lukoil)$/i, 'Lukoil'], [/^(omv petrom|petrom)$/i, 'Petrom'],
    [/^omv$/i, 'OMV'], [/^mol( romania)?$/i, 'MOL'], [/^rompetrol$/i, 'Rompetrol'], [/^(газпром|gazprom)$/i, 'Gazprom'],
    [/^socar$/i, 'SOCAR'], [/^banca transilvania$/i, 'Banca Transilvania'], [/^brd( groupe soci[eé]t[eé] g[eé]n[eé]rale)?$/i, 'BRD'],
    [/^ing( bank)?$/i, 'ING'], [/^bcr$/i, 'BCR'],
];
const NON_LATIN = /[Ͱ-ϿЀ-ӿ֐-ۿ฀-໿぀-鿿가-힯]/;
export function signText(t, country) {
    let name = t.name || '', brand = t.brand || '';
    for (const [re, v] of BRAND_NORM) { if (re.test(brand.trim())) brand = v; if (re.test(name.trim())) name = v; }
    if (country === 'RO') { if (NON_LATIN.test(name)) name = t['name:ro'] || t['name:en'] || (NON_LATIN.test(brand) ? '' : brand); if (NON_LATIN.test(brand)) brand = t['brand:en'] || ''; }
    return { name, brand };
}
