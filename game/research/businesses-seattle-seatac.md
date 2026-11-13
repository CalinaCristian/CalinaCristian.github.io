# Businesses & speed limits — SeaTac (Seattle)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-seattle-seatac.json` (one entry per business) and the `seattle-seatac` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out. Airport and hotel businesses: `seattle-seatac.md` §8.

## Counts (2026-11-07)

23 businesses in the zone, 1 within 60 m of a chapter route; 12 chain brands; 1 confirmed by an official locator (and added, not in OSM); confidence high 5 / medium 13 / low 5; no chain store missing from its locator, none closed per lifecycle tags. At the time 16 were game POIs (within 35 m), 1 a facade sign only, 6 missing (1 dropped by the build filter: car_rental; 4 outside the mask / deduplicated; 1 locator-only).

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter route

No chain brand. Independent: Seattle Airport Car Rental (car_rental, dropped by `poiKind()`).

## Official-locator checks

- **Starbucks** 17801 International Blvd ("SEA Bag Claim 4", https://www.starbucks.com/store-locator/store/1024029): not in OSM within the zone; added from the locator.

Missing chain brands at research time: ARCO, Starbucks, ampm. Brands with no sign colours (generic kind colours): Denny's, Extended Stay America, Hudson, Red Roof Inn, ampm.

## POIs added from live OSM (2026-11-12)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 5 rows (2 in the edge strip, 1 new in OSM / relation; 210 before). Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside the terminal (11), unnamed objects, ATMs outside the area. Street View: the 7-Eleven has a pylon at the lot (the game signs the store fascia).

Bibito Cafe (n14111796067) and Olympia Coffee (n14189991289, Concourse C) were re-mapped in live OSM in 2026; the game rows stay.

## Speed limits on the chapter route

**Legal default (Washington).** RCW 46.61.400: 25 mph on city and town streets, 50 on county roads, 60 on state highways unless posted (https://app.leg.wa.gov/rcw/default.aspx?cite=46.61.400, fetched 2026-11-07). School and playground crosswalks: 20 mph when signed, the zone extending 300 ft either side (RCW 46.61.440). Seattle's 25 mph arterial default applies only inside Seattle city limits, not to SeaTac or Bellevue.

**seatac** — 2375 m; OSM ways with `maxspeed`: 7 (1540 m), without: 3 (815 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Airport Expressway | motorway | 596 | 40 mph | 64 |
| Seattle;Tacoma | motorway_link | 372 | — | 64 (default) |
| (unnamed) | motorway_link | 443 | — | 64 (default) |
| SR 518 | motorway | 944 | 60 mph | 97 |

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL — element ids in every entry.
- Starbucks store locator API https://www.starbucks.com/store-locator (`/apiproxy/v1/locations`, 6 query points around downtown Bellevue and SeaTac, 107 stores, 2026-11-07).
- Not machine-readable from here: Chase, U.S. Bank, Walgreens (JavaScript-only), CVS, McDonald's US, Trader Joe's (HTTP 403), QFC (no response).
