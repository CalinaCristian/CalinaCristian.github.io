# Businesses & speed limits — SeaTac (Seattle)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-seattle-seatac.json` (one entry per business) and the `seattle-seatac` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/seattle-seatac.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 23 |
| … of which within 60 m of a chapter route | 1 |
| chain brands | 12 |
| confirmed by an official store locator | 1 |
| confidence high | 5 |
| confidence medium | 13 |
| confidence low | 5 |
| chain store NOT in its official locator (possibly closed) | 0 |
| in the official locator but not in OSM (added) | 1 |
| closed per OSM lifecycle tags (on route, listed below) | 0 |
| in the game (POI within 35 m) | 16 |
| in the game only as a facade sign | 1 |
| missing in the game | 6 |
| … of which on a chapter route | 1 |
| ATMs drawn as bank POIs on a route | 0 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|

Independents on the routes (1): Seattle Airport Car Rental (car_rental)

## Official-locator checks

- **Starbucks** 17801 International Blvd, SeaTac: locator only match with "SEA Bag Claim 4" — https://www.starbucks.com/store-locator/store/1024029 — *not found in OSM within the zone; added from the locator*

## Game comparison (`game/data/seattle-seatac.json`)

Missing businesses by reason: 1× dropped by the build filter; 4× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter); 1× not in OSM (official locator only).

Categories dropped by `poiKind()`: car_rental (1).

Missing chain brands: ARCO, Starbucks, ampm (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): Denny's, Extended Stay America, Hudson, Red Roof Inn, ampm.

## Speed limits on the chapter routes

**Legal default (Washington).** RCW 46.61.400: 25 mph on city and town streets, 50 on county roads, 60 on state highways unless posted (https://app.leg.wa.gov/rcw/default.aspx?cite=46.61.400, fetched 2026-11-07). School and playground crosswalks: 20 mph when signed, the zone extending 300 ft either side (RCW 46.61.440). Bellevue: posted limits range 20–40 mph; arterials 25–40; most local streets are being lowered to 20 mph during 2026 (https://bellevuewa.gov/city-government/departments/transportation/safety-and-maintenance/traffic-safety/speed-limits-speed-management, fetched 2026-11-07). Seattle's 25 mph arterial default (2020–21, SDOT Vision Zero page) applies only inside Seattle city limits — not to the SeaTac or Bellevue districts.


**seatac** — 2375 m; OSM ways with `maxspeed`: 7 (1540 m), without: 3 (815 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Airport Expressway | motorway | 596 | 40 mph | 64 |
| Seattle;Tacoma | motorway_link | 372 | — | 64 (default) |
| (unnamed) | motorway_link | 443 | — | 64 (default) |
| SR 518 | motorway | 944 | 60 mph | 97 |

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06, © OpenStreetMap contributors, ODbL — element ids in every entry.
- Starbucks store locator API https://www.starbucks.com/store-locator (`/apiproxy/v1/locations`, 6 query points around downtown Bellevue and SeaTac, 107 stores, 2026-11-07). Licensed stores ("LS") inside Safeway / QFC / Target also confirm those host stores.
- Bank of America locator https://locators.bankofamerica.com/wa/bellevue/ (2026-11-07: 4 pins in or near downtown).
- Bartell Drugs: Wikipedia "Bartell Drugs" / "Rite Aid" (fetched 2026-11-07): about half the stores closed by 2025, the rest acquired and rebranded by CVS Pharmacy during Rite Aid's 2025 liquidation (all Rite Aid stores closed 2025-10-03). No Bartell storefront should appear in the game.
- Not machine-readable from here: Chase, U.S. Bank, Walgreens (JavaScript-only), CVS, McDonald's US, Trader Joe's (HTTP 403), QFC (no response).
