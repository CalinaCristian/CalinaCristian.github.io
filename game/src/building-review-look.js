// ============================================================================
//  BUILDING REVIEW, LOOK ROWS — facade colour / style rows from the round-3 street-level review (lane `look`,
//  2026-11-13): places of worship (r2-world-b-church-likeness) and downtown Bellevue (bellevue-6).
//  Same row format and rules as BUILDING_REVIEW in building-review.js, which merges these rows (its own row for the same
//  OSM id wins field by field): keyed by OSM id, footprint / height / identity unchanged, colours are tone classes seen
//  on the facade in an official panorama (cited), not sampled pixels; no tower or dome is added here (worship.js draws a
//  cupola only where OSM tags one).
// ============================================================================

export const LOOK_REVIEW = {
    'bucharest-romana': {
        w179319626: { colour: '#D6BF8A', note: 'Biserica Boteanu-Ienii: warm ochre / sand plaster, arcaded porch (drawn from the cream church palette); panorama SjOI2XLkhdK5Ic0qM-OaLQ (44.440213, 26.098773) heading 71' },
        w1476760553: { colour: '#8E4634', note: 'Biserica Crețulescu: exposed red brick over a stone plinth (drawn cream); panorama q4sm16NZ5g9nzAl59Pleug (44.43819, 26.096548) heading 140' },
        w76915020: { colour: '#D4B39B', note: 'Biserica Amzei: cream stone banded with red brick courses, read as one warm tone (drawn cream); panorama 8to4VNCB5GgzGL5IUsc2oA (44.444672, 26.093732) heading 162' },
        // matched the class colour, no row: Biserica Albă w78467985 (white plaster; o7rMW6TX8oLpXSUPg2UhRA heading 351),
        // Biserica Icoanei w76920898 (white; MhUPs539tfyVaB8D4iflnw heading 160)
    },
    'bucharest-unirii': {
        // matched the class colour, no row: Biserica Domnița Bălașa w78564921 (cream stone with red-brown brick bands;
        // panorama 2tFsWbmuz3BKVzjdbjqNww (44.42822, 26.100585) heading 277)
    },
    'seattle-bellevue': {
        // Bravern 2 (w38224225, 47.617297, -122.192967 heading 184): cream stone at street level, but the street face is its
        // 22-storey OSM part w1474780191 (glass curtain above): one colour per part cannot hold both; left as glass (backlog)
        w33613428: { style: 'interwar', colour: '#CDB3A3', note: 'Bellevue Place: pink-beige precast with a red-brick arched base and a glass atrium (drawn as dark blue glass); panorama kxosxD8k3pWuWhUSIn2npQ (47.618065, -122.200804) heading 15' },
        r8064670: { style: 'interwar', colour: '#9A9D9C', note: 'Courtyard by Marriott: grey panel / stucco walls (drawn as dark blue glass); panorama sTPVjoz6jM0aI-f3NYYzng (47.618231, -122.193019) heading 187' },
    },
};
