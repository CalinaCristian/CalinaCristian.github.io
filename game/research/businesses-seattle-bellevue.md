# Businesses & speed limits — Downtown Bellevue (Seattle)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-seattle-bellevue.json` (one entry per business) and the `seattle-bellevue` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out. District review of businesses: `seattle-bellevue.md` §8.

## Counts (2026-11-07)

226 businesses in the zone, 47 within 60 m of a chapter route; 91 chain brands; 10 confirmed by an official locator (1 added, not in OSM); confidence high 66 / medium 121 / low 39; 2 chain stores missing from their locator; 3 closed per lifecycle tags. At the time 191 were game POIs (within 35 m), 1 a facade sign only, 34 missing (14 on a route: 28 dropped by the build filter's `poiKind()` classes, 5 outside the mask / deduplicated, 1 locator-only).

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter route `uipath-bel` (chain brands)

| brand | category | address | side | conf. | note |
|---|---|---|---|---|---|
| Fidelity Investments | bank | — | N of NE 8th St | medium | |
| Starbucks | cafe | 11010 NE 8th St | N of NE 8th St | low | not in the official locator; the unit carries a CoCo sign (exclusion) |
| CoCo | cafe | 11028 NE 8th St | N of NE 8th St | medium | |
| Charles Schwab | bank | 11100 NE 8th St | N of NE 8th St | medium | |
| Umpqua Bank | bank | 11100 NE 8th St | N of NE 8th St | medium | |
| U.S. Bank | bank | 10900 NE 8th St (Plaza Center) | N of NE 8th St | low | |
| U.S. Bank | bank | 10800 NE 8th St | N of NE 8th St | medium | |
| Chase | bank | 10550 NE 8th St | N of NE 8th St | medium | |
| Hermès | clothes | 11111 NE 8th St | S of NE 8th St | high | |
| Microsoft Store | electronics | 11025 NE 8th St | S of NE 8th St | low | all Microsoft consumer stores closed (June 2020); the Bravern frontage shows a Microsoft office sign, not a shop (exclusion) |
| Crate & Barrel | furniture | — | S of NE 8th St | medium | inside a building on level 0;2: no street-front sign |
| Din Tai Fung | restaurant | 700 Bellevue Way NE | S of NE 8th St | medium | signed on the Lincoln Square podium's NE 8th face |
| Earls | restaurant | 700 Bellevue Way NE | E of Bellevue Way | high | |
| The Container Store | houseware | Bellevue Way NE | E of Bellevue Way | high | class dropped by `poiKind()` |
| AT&T | mobile_phone | 821 Bellevue Way NE | N of NE 8th St | high | class dropped by `poiKind()` |
| Starbucks | cafe | 545 Bellevue Way NE | W of Bellevue Way | high | |
| Pressed | fast_food | — | W of Bellevue Way | high | |
| Shake Shack | fast_food | 503 Bellevue Way NE | W of Bellevue Way | medium | |
| The Cheesecake Factory | restaurant | 401 Bellevue Square | W of Bellevue Way | medium | |

Independents on the route (28): ? (second_hand), Bellevue Water Grill, Cactus - Bellevue Square, Castilla Restaurant and Tapas Bar, Chocolate Lounge, Chromatique, Daniel's Broiler, Eco Car Cafe, Farzi Café, Forum Social House, Hummus Republic, Joey, MIX Poke Bar, Optima Dental Spa, Paddy Coyne's, Paper Source, Prime 21 Lounge, STK Steakhouse, Sabine Cafe and Bar, Schoener, Story Coffee, Sugar Factory, TRUCE Spa, Tavern Hall, Thomasville & Urban Interiors, Trillium Custom Tailoring & Design, Woods Coffee, Yardbird.

## Official-locator checks

Position matches: Starbucks 545 Bellevue Way NE ("The Lodge", [18615](https://www.starbucks.com/store-locator/store/18615)), 10214 NE 8th St ([18416](https://www.starbucks.com/store-locator/store/18416)), 601 108th Ave NE ("Key Center", [11106](https://www.starbucks.com/store-locator/store/11106)), 10116 NE 8th St (inside QFC 808, [8021](https://www.starbucks.com/store-locator/store/8021)), 300 Bellevue Way NE (inside Safeway 1600, [11038](https://www.starbucks.com/store-locator/store/11038)), 42 Bellevue Way NE ("Main St.&Bellevue Way", [16023](https://www.starbucks.com/store-locator/store/16023)); Safeway 300 Bellevue Way NE; Bank of America 425 106th Ave NE and one more pin ([locator](https://locators.bankofamerica.com/wa/bellevue/)). **QFC** 10116 NE 8th St: not in OSM within the zone, added from the locator.

Not in the official locator (possibly closed; do not add until a dated photo confirms): Starbucks 11010 NE 8th St (node/471973082, check_date 2024-09-05), Bank of America 10116 NE 8th St (node/697212586, last edit 2024-01-16).

Closed per OSM lifecycle tags (draw as a vacant 'For Lease' unit if modelled): Plaza Salon `disused:shop=hairdresser` (node/5752787322, 47.61768, −122.19418), unnamed `disused:amenity=restaurant` (node/1271661516, 47.61683, −122.20197), Legion `disused:amenity=bar` (node/3926527641, 47.61626, −122.20122).

Missing chain brands at research time: 7-Eleven, AT&T★, CVS Pharmacy, Edible Arrangements, FedEx, Finish Line, Jo Malone, LensCrafters, Mattress Firm, Mephisto, QFC, See's Candies, Tempur-Pedic, The Container Store★, Xfinity (★ = on the route). Most brands here have no sign colours in `data.brands` or `world.js BRANDS` and fall back to generic kind colours.

## POIs added from live OSM (2026-11-12)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 112 rows (91 in the edge strip, 20 of dropped classes, 1 new in OSM / relation, 7 own building names; 157 before). POIs mapped as relations (Courtyard hotel r8064670) are read by `tools/osm/build-data.mjs`. Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside the Bellevue malls (68), unnamed objects, ATMs outside the area. Street View: Westin lettering on the tower at NE 6th St; 999 Bellevue Way NE (Tempur-Pedic) unreadable behind a tree.

## Speed limits on the chapter route

**Legal default (Washington).** RCW 46.61.400: 25 mph on city and town streets, 50 on county roads, 60 on state highways unless posted (https://app.leg.wa.gov/rcw/default.aspx?cite=46.61.400, fetched 2026-11-07). School and playground crosswalks: 20 mph when signed, 300 ft either side (RCW 46.61.440). Bellevue: posted limits 20–40 mph; arterials 25–40; most local streets are being lowered to 20 mph during 2026 (https://bellevuewa.gov/city-government/departments/transportation/safety-and-maintenance/traffic-safety/speed-limits-speed-management, fetched 2026-11-07). Seattle's 25 mph arterial default applies only inside Seattle city limits.

**uipath-bel** — 1388 m; OSM ways with `maxspeed`: 26 (1262 m), without: 3 (92 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Northeast 8th Street West | motorway_link | 39 | — | 64 (default) |
| Northeast 8th Street | primary | 1056 | 30 mph | 48 |
| Bellevue Way Northeast | primary | 206 | 30 mph | 48 |
| (unnamed) | primary_link | 39 | — | 48 (default) |
| Northeast 7th Street | service | 14 | — | 24 (default) |

Mapped signs / cameras within 150 m: node/5773437927 speed_camera (traffic_signals enforcement), 20 m.

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL — element ids in every entry.
- Starbucks store locator API https://www.starbucks.com/store-locator (`/apiproxy/v1/locations`, 6 query points around downtown Bellevue and SeaTac, 107 stores, 2026-11-07). Licensed stores inside Safeway / QFC / Target also confirm those host stores.
- Bank of America locator https://locators.bankofamerica.com/wa/bellevue/ (2026-11-07: 4 pins in or near downtown).
- Bartell Drugs: Wikipedia "Bartell Drugs" / "Rite Aid" (fetched 2026-11-07): about half the stores closed by 2025, the rest rebranded CVS Pharmacy during Rite Aid's 2025 liquidation (all Rite Aid stores closed 2025-10-03). No Bartell storefront should appear in the game.
- Not machine-readable from here: Chase, U.S. Bank, Walgreens (JavaScript-only), CVS, McDonald's US, Trader Joe's (HTTP 403), QFC (no response).
