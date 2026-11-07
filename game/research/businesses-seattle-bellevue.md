# Businesses & speed limits — Downtown Bellevue (Seattle)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-seattle-bellevue.json` (one entry per business) and the `seattle-bellevue` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/seattle-bellevue.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 226 |
| … of which within 60 m of a chapter route | 47 |
| chain brands | 91 |
| confirmed by an official store locator | 10 |
| confidence high | 66 |
| confidence medium | 121 |
| confidence low | 39 |
| chain store NOT in its official locator (possibly closed) | 2 |
| in the official locator but not in OSM (added) | 1 |
| closed per OSM lifecycle tags (on route, listed below) | 3 |
| in the game (POI within 35 m) | 191 |
| in the game only as a facade sign | 1 |
| missing in the game | 34 |
| … of which on a chapter route | 14 |
| ATMs drawn as bank POIs on a route | 0 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| uipath-bel | Fidelity Investments | bank | — | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | Starbucks | cafe | Northeast 8th Street 11010 | N side of Northeast 8th Street | low | present | not in official locator |
| uipath-bel | CoCo | cafe | Northeast 8th Street 11028 | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | Charles Schwab | bank | NE 8th Street 11100 | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | Earls | restaurant | Bellevue Way Northeast 700 | E side of Bellevue Way Northeast | high | present |  |
| uipath-bel | Starbucks | cafe | Bellevue Way Northeast 545 | W side of Bellevue Way Northeast | high | present |  |
| uipath-bel | Pressed | fast_food | — | W side of Bellevue Way Northeast | high | present |  |
| uipath-bel | Shake Shack | fast_food | Bellevue Way Northeast 503 | W side of Bellevue Way Northeast | medium | present |  |
| uipath-bel | The Container Store | houseware | Bellevue Way Northeast | E side of Bellevue Way Northeast | high | missing |  |
| uipath-bel | Umpqua Bank | bank | NE 8th Street 11100 | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | U.S. Bank | bank | Northeast 8th Street 10900 | N side of Northeast 8th Street | low | present |  |
| uipath-bel | Chase | bank | Northeast 8th Street 10550 | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | The Cheesecake Factory | restaurant | Bellevue Square 401 | W side of Bellevue Way Northeast | medium | present |  |
| uipath-bel | Hermès | clothes | Northeast 8th Street 11111 | S side of Northeast 8th Street | high | present |  |
| uipath-bel | Din Tai Fung | restaurant | Bellevue Way Northeast 700 | S side of Northeast 8th Street | medium | present |  |
| uipath-bel | U.S. Bank | bank | Northeast 8th Street 10800 | N side of Northeast 8th Street | medium | present |  |
| uipath-bel | Crate & Barrel | furniture | — | S side of Northeast 8th Street | medium | present | inside a building on level 0;2: no street-front sign |
| uipath-bel | Microsoft Store | electronics | Northeast 8th Street 11025 | S side of Northeast 8th Street | low | present | Microsoft announced the closure of all its consumer retail stores in June 2020; OSM check_date 2024-09-05 still says "Microsoft Store" — verify with a dated photo before drawing a shopfront |
| uipath-bel | AT&T | mobile_phone | Bellevue Way Northeast 821 | N side of Northeast 8th Street | high | missing |  |

Independents on the routes (28): ? (second_hand), Bellevue Water Grill (restaurant), Cactus - Bellevue Square (restaurant), Castilla Restaurant and Tapas Bar (restaurant), Chocolate Lounge (bar), Chromatique (hairdresser), Daniel's Broiler (restaurant), Eco Car Cafe (car_wash), Farzi Café (restaurant), Forum Social House (bar), Hummus Republic (fast_food), Joey (restaurant), MIX Poke Bar (fast_food), Optima Dental Spa (dentist), Paddy Coyne's (pub), Paper Source (paper), Prime 21 Lounge (bar), STK Steakhouse (restaurant), Sabine Cafe and Bar (cafe), Schoener (furniture), Story Coffee (cafe), Sugar Factory (restaurant), TRUCE Spa (beauty), Tavern Hall (pub), Thomasville & Urban Interiors (furniture), Trillium Custom Tailoring & Design (tailor), Woods Coffee (cafe), Yardbird (furniture)

## Official-locator checks

- **Starbucks** Bellevue Way Northeast 545: position match with "The Lodge" (6 m) — https://www.starbucks.com/store-locator/store/18615
- **Starbucks** Northeast 8th Street 10214: position match with "Bellevue" (2 m) — https://www.starbucks.com/store-locator/store/18416
- **Starbucks** 108th Avenue Northeast 601: position match with "Key Center Bellevue" (13 m) — https://www.starbucks.com/store-locator/store/11106
- **Starbucks** Northeast 8th Street 10116: position match with "QFC Bellevue 808" (9 m) — https://www.starbucks.com/store-locator/store/8021
- **QFC** 10116 NE 8th St, Bellevue: locator only match with "QFC Bellevue 808 (host store of a licensed Starbucks)" — https://www.starbucks.com/store-locator/store/8021 — *not found in OSM within the zone; added from the locator*
- **Bank of America** 106th Avenue Northeast 425: position match with "Bank of America (locator pin)" (14 m) — https://locators.bankofamerica.com/wa/bellevue/
- **Starbucks** Bellevue Way Northeast 300: position match with "Safeway Bellevue 1600" (8 m) — https://www.starbucks.com/store-locator/store/11038
- **Safeway** Bellevue Way Northeast 300: position match with "Safeway Bellevue 1600 (host store of a licensed Starbucks)" (36 m) — https://www.starbucks.com/store-locator/store/11038
- **Bank of America** Bank of America: position match with "Bank of America (locator pin)" (5 m) — https://locators.bankofamerica.com/wa/bellevue/
- **Starbucks** Bellevue Way Northeast 42: position match with "Main St.&Bellevue Way" (14 m) — https://www.starbucks.com/store-locator/store/16023

**Not in the official locator (treat as possibly closed — do not add until a dated photo confirms):**
- Starbucks — Northeast 8th Street 11010 (node/471973082, OSM node/471973082 v13 (last edit 2024-09-06, check_date 2024-09-05), brand:wikidata Q37158)
- Bank of America — Northeast 8th Street 10116 (node/697212586, OSM node/697212586 v4 (last edit 2024-01-16), brand:wikidata Q487907)

## Closed per OSM lifecycle tags (within 60 m of a route)

- Plaza Salon — `disused:shop=hairdresser` at 47.61768, -122.19418 (node/5752787322, last edit 2026-05-11) — draw as a vacant unit ('For Lease') if modelled
- (unnamed) — `disused:amenity=restaurant` at 47.61683, -122.20197 (node/1271661516, last edit 2022-02-13) — draw as a vacant unit ('For Lease') if modelled
- Legion — `disused:amenity=bar` at 47.61626, -122.20122 (node/3926527641, last edit 2026-05-02) — draw as a vacant unit ('For Lease') if modelled

## Game comparison (`game/data/seattle-bellevue.json`)

Missing businesses by reason: 5× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter); 28× dropped by the build filter; 1× not in OSM (official locator only).

Categories dropped by `poiKind()`: bar (3), optician (3), mobile_phone (2), bed (2), pub (2), copyshop (1), electronics_repair (1), houseware (1), telecommunication (1), hairdresser (1), shoes (1), confectionery (1), paper (1), gift (1), dentist (1), beauty (1), tailor (1), sports (1), perfumery (1), car_wash (1), second_hand (1).

Missing chain brands: 7-Eleven, AT&T★, CVS Pharmacy, Edible Arrangements, FedEx, Finish Line, Jo Malone, LensCrafters, Mattress Firm, Mephisto, QFC, See's Candies, Tempur-Pedic, The Container Store★, Xfinity (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): 7-Eleven, AC Hotel, AT&T, BECU, Banner Bank, Charles Schwab, Chicha San Chen, Chick-fil-A, Chipotle, Cinemark, CoCo, Crate & Barrel, Din Tai Fung, Dough Zone, Earls, Edible Arrangements, Evergreens, FedEx, Fidelity Investments, Finish Line, First Citizens Bank, First Tech Federal Credit Union, Fogo de Chão, H Mart, HSBC, Haidilao Hot Pot, Hermès, Hilton Garden Inn, Hui Lau Shan, Hyatt Regency, Jimmy John's, Jo Malone, KeyBank, LensCrafters, MOD Pizza, Macu, Macy's, Mango Mango Dessert, Marriott, Mattress Firm, Men's Wearhouse, Mendocino Farms, Mephisto, Microsoft Store, Nordstrom, Nordstrom Rack, Pagliacci Pizza, Paris Baguette, Potbelly, Pressed, Salt & Straw, See's Candies, Shake Shack, Tempur-Pedic, The Cheesecake Factory, The Container Store, The Melting Pot, Tous les Jours, U.S. Bank, Umpqua Bank, Uniqlo, Voodoo Doughnut, WSECU, WaFd Bank, Xfinity, Zara, ZoomCare, west elm.

Wrong colours / names: `Molly Moon's Homemade Ice Cream` — world.js brandStyle() prefix match gives it the 'mol' brand colours; `Molly Tea Bellevue` — world.js brandStyle() prefix match gives it the 'mol' brand colours; `Orangetheory Fitness` — world.js brandStyle() prefix match gives it the 'orange' brand colours.

Extra in game near the routes: Westin (hotel) — not matched by this research (unbranded duplicate or outside research filters).

## Speed limits on the chapter routes

**Legal default (Washington).** RCW 46.61.400: 25 mph on city and town streets, 50 on county roads, 60 on state highways unless posted (https://app.leg.wa.gov/rcw/default.aspx?cite=46.61.400, fetched 2026-11-07). School and playground crosswalks: 20 mph when signed, the zone extending 300 ft either side (RCW 46.61.440). Bellevue: posted limits range 20–40 mph; arterials 25–40; most local streets are being lowered to 20 mph during 2026 (https://bellevuewa.gov/city-government/departments/transportation/safety-and-maintenance/traffic-safety/speed-limits-speed-management, fetched 2026-11-07). Seattle's 25 mph arterial default (2020–21, SDOT Vision Zero page) applies only inside Seattle city limits — not to the SeaTac or Bellevue districts.


**uipath-bel** — 1388 m; OSM ways with `maxspeed`: 26 (1262 m), without: 3 (92 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Northeast 8th Street West | motorway_link | 39 | — | 64 (default) |
| Northeast 8th Street | primary | 1056 | 30 mph | 48 |
| Bellevue Way Northeast | primary | 206 | 30 mph | 48 |
| (unnamed) | primary_link | 39 | — | 48 (default) |
| Northeast 7th Street | service | 14 | — | 24 (default) |

Mapped signs / cameras within 150 m: node/5773437927 speed_camera (traffic_signals enforcement) 20 m.

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06, © OpenStreetMap contributors, ODbL — element ids in every entry.
- Starbucks store locator API https://www.starbucks.com/store-locator (`/apiproxy/v1/locations`, 6 query points around downtown Bellevue and SeaTac, 107 stores, 2026-11-07). Licensed stores ("LS") inside Safeway / QFC / Target also confirm those host stores.
- Bank of America locator https://locators.bankofamerica.com/wa/bellevue/ (2026-11-07: 4 pins in or near downtown).
- Bartell Drugs: Wikipedia "Bartell Drugs" / "Rite Aid" (fetched 2026-11-07): about half the stores closed by 2025, the rest acquired and rebranded by CVS Pharmacy during Rite Aid's 2025 liquidation (all Rite Aid stores closed 2025-10-03). No Bartell storefront should appear in the game.
- Not machine-readable from here: Chase, U.S. Bank, Walgreens (JavaScript-only), CVS, McDonald's US, Trader Joe's (HTTP 403), QFC (no response).
