# Invented-location source audit and cleanup

Owner: `fidelity/locations-audit`. Base: `7349ab4`. Root explicitly expanded ownership to the precise CV/fuel/business hunks in `world.js`, no-station fuel/enforcement hunks in `main.js`, and two unsupported Pioneer storefront boards. No district JSON, research records, real building footprints or landmark models were edited.

## Completed source audit

- Read `AGENTS.md`, architecture, fidelity goal, district/map/on-foot contracts and relevant streetscape/data/research documentation. Searched runtime world generation, gameplay, minimap/world-map, source builders, CV configuration and tourist-scene sign creation for fabricated facilities, arbitrary business names, fallback coordinates and dead builders.
- All ten bundled world JSONs were inspected: the two legacy corridors and eight districts. They contain 80 loaded fuel rows across overlapping worlds, not 80 unique physical stations. Every one of the 13 district fuel pins in `places.json` exactly matches a district fuel POI (0 unmatched). `tools/osm/build-data.mjs` classifies OSM `amenity=fuel`; district business additions use cited research, not random service placement. `places.mjs` and minimap/world-map consume those source records without creating fallback fuel places.
- Preserved mapped fuel identities, including Pipera Petrom `way/241976323`, GPL Lukoil Aviației `node/2437135667`, Lukoil `way/547396767`; Grozăvești OMV `way/239359996` and Lukoil `way/256806132`; Unirii OMV `way/263315803` and MOL `way/670595374`; Otopeni OMV `way/244429098`, Rompetrol `way/312547071`, Rompetrol `way/918040922`, Gazprom `way/918040928`; SeaTac Shell `node/824050627` and 76 `way/433205179`. Evidence: `game/research/businesses-<city>-<district>.json` and `/tmp/fidelity-locations-audit/source-check.json`.
- CV stops and objective coordinates in `cities.js` are actual researched/owner-confirmed places. All ten runtime baseline worlds had 0 generated CV offices, so the unsupported office fallback was latent. All baseline CV anchors and all station interaction/source coordinates were preserved exactly in the after audit.
- Existing imagined rooftop brands remain absent. `world.js` retains researched Coca-Cola/NetBet plus neutral advertising frames. OSM/research names continue to supply building/unit signs. No random shop-name table or autonomous station/place generator remains in the audited source paths.
- Tourist scenes retain their researched landmark/OSM identities and activities. Hero names such as the original Starbucks (`n2397461017`), Seattle Center attractions, the Bellevue office and waterfront piers have source structures in the dossiers. Two Pioneer storefront boards had unsupported coordinates and were removed as described below; their actual places/source metadata remain.

## Implemented changes

1. `main.js`: removed legacy synthetic speed-camera placement, `spreadEdges`, `buildCameraMesh`, and the arbitrary default fuel-brand table. Source camera POIs/graph nodes remain supported, with duplicate detection. Unnamed source stations use “Fuel station”.
2. `main.js`: no mapped station means no empty-tank limp cap, low/empty toast, nonexistent station tow prompt, invented tow refill, fast-travel fuel burn or fuel-based rejection. Existing mapped-station economy/refuelling remains. Driving already had no-station burn suppression at the base; this closes the remaining assumptions.
3. `main.js`/`world.js`: red-light camera fines now require a mapped `nodeFlags` bit 1024, exposed as `redLightCamera`, or an actual nearby police vehicle. Seattle no longer acquires camera enforcement at every light. Police fines retain the police label.
4. `world.js`: deleted the missing-CV-footprint office generator, its dead `cvBuildings` map and `poi.generated` assumption. In particular, removed its “remove anything in the way” path which could hide real buildings. Actual CV location, marker, door and interaction stay available without a substitute building.
5. `world.js`: deleted assumed fuel-shop buildings and unmatched business pavilions. Existing source buildings, source POIs, supported facade signs and source names remain. A bank POI alone no longer produces an ATM booth; explicit `sub=atm` still does.
6. `world.js`: fuel canopy/apron geometry is tested only at the original source point. Removed initial roadside repositioning and the search for another free lot. Unsafe geometry is omitted, leaving the actual station anchor/refuelling intact. No source building is moved or deleted to fit it.
7. `spots/scenes/pioneer-square.js`: removed only hardcoded `UNDERGROUND TOUR` at `[-13,-2]` and `MERCHANT'S CAFE` at `[52,12]`. The mapped Underground Tour is `n825301150` at `[35.9,-76.8]`, about 89 m from the old sign. Merchant’s Cafe is mentioned at 109 Yesler Way in `game/research/seattle-spots.json` signage, but no coordinate/host was established for that board. Source metadata, actual buildings, POIs and activities remain unchanged.

## Validation and evidence

Raw scripts/results/screenshots are outside git at `/tmp/fidelity-locations-audit/`.

- Syntax checks for all three edited modules and `git diff --check`: passed.
- `source-check.cjs`: 10 source world files, 13 fuel pins, 0 unmatched pins, 0 static camera flag records. Source JSON/research files are unchanged.
- `method-check.cjs`: **21 checks passed**, 0 page errors. Negative camera fallback; mapped camera POI/node and dedup controls; no stations; neutral station name; mapped refuel; stationless tow; six fast-travel fuel cases; red-light camera/police controls.
- `runtime-before.json`, `runtime-after.json`, `runtime-compare.json`: **all 10 worlds loaded with 0 page errors**, identical CV anchors and all station coordinates, 0 generated CV offices, 0 moved retained canopies. This sweep covers the main deletion/relocation changes. The final ATM-only condition is separately exercised through the actual `buildWorld` fixture below; the final Pioneer change is deletion-only and syntax checked.
- `booth-check.cjs`/`.json`: actual tiny `buildWorld` fixture gives **bank booth 0 / explicit ATM booth 1**, retains source bank pin/name, and confirms absent/present red-light camera flag parsing. 0 page errors.
- `drive-check.cjs`/`.json`: actual Floreasca empty-tank frame gives fuel 0 unchanged, 0 stations/fuel map places/action markers, max-speed option 38 m/s, no empty/low toast, 0 page errors.
- `real-station-check.cjs`/`.json`: actual Pipera Petrom source POI `[-1136.1,48]`, interaction `[-1135.4120277714205,54.742127840078304]`, successfully refuels **20→45 L**, buys 25 L, 0 page errors.
- `NODE_OPTIONS='--require=/tmp/fidelity-locations-audit/chromium-preload.cjs' npm run harness -- --scenario=foot,a --city=bucharest --port=8205 --out=/tmp/fidelity-locations-audit/logic --shots=0`: **0 high / 0 medium**, one software-GL perf-FPS low. System Chromium was supplied because Playwright’s bundled executable is absent. All browser launches were muted. This is not hardware FPS evidence.
- `views.cjs`, `views.json`, `before/after-{petrom,lpg-lukoil}.png`: inspected matched day/summer Pipera game views. Petrom canopy and source buildings stay intact. The shifted GPL canopy disappears; adjacent sourced Lukoil canopy remains at its own source point. These are game-before/after pictures, not reality-reference comparisons. High-quality view counts before→after: Petrom **126/230,699→126/229,861** calls/triangles; LPG/Lukoil **139/226,460→139/225,904**. These stationary aerial captures do not establish the combined traffic/mirror performance acceptance.

| World | Source stations retained | Canopies before → after |
|---|---:|---:|
| Legacy Bucharest | 37 | 29 → 8 |
| Legacy Seattle | 30 | 23 → 3 |
| Floreasca | 0 | 0 → 0 |
| Grozăvești | 2 | 2 → 2 |
| Unirii | 2 | 2 → 1 |
| Romană | 0 | 0 → 0 |
| Pipera | 3 | 3 → 2 |
| Otopeni | 4 | 4 → 3 |
| Bellevue | 0 | 0 → 0 |
| SeaTac | 2 | 2 → 0 |

## Integration requests and explicit limits

- Root owns README/spec updates: camera locations are source-only; stationless fast travel/driving burn no fuel; source stations do not all get assumed full forecourts or substitute shops. Add red-light camera bit 1024 to data documentation if desired.
- Root agreed to remove the eight dead CV `size:[w,h,d]` fields in `cities.js`; their only consumer was the deleted office fallback. Do not remove coordinates, names, door hints or sourced locations.
- Root’s `25ef75b` already removes the old empty fallback-station map drawing block/comment; keep that cleanup during integration. No fabricated map pin loop was reintroduced here.
- No bundled world currently has a speed-camera or red-light-camera flag. Research `speedlimits.json` cites Bellevue red-light camera `node/5773437927` at NE 8th × 110th; it has not reached these bundled graph flags. This remains a source-data coverage gap, not a license to fabricate enforcement elsewhere. Mechanism controls pass, but this audit does not claim every real camera is represented.
- Retained generic canopy dimensions/orientation are representative decoration at a sourced fuel anchor, not a measured reconstruction. Some legacy/source POIs may be stale; existing research confidence and dates remain. Gameplay fuel prices are fixed economy values, not verified current pump prices.
- Existing kerb door/refuel access points and nearby source-building fascia association still offset interaction/sign geometry from POI centers. The station source point and real building geometry are unchanged. Tourist/landmark parity, signal changes, geometry fixes and final combined performance belong to their active owners and root integration.
