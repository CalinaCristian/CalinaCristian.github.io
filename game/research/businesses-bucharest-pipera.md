# Businesses & speed limits — Pipera (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-pipera.json` (one entry per business) and the `bucharest-pipera` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-pipera.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 123 |
| … of which within 60 m of a chapter route | 61 |
| chain brands | 56 |
| confirmed by an official store locator | 5 |
| confidence high | 4 |
| confidence medium | 79 |
| confidence low | 40 |
| chain store NOT in its official locator (possibly closed) | 0 |
| in the official locator but not in OSM (added) | 4 |
| closed per OSM lifecycle tags (on route, listed below) | 0 |
| in the game (POI within 35 m) | 84 |
| in the game only as a facade sign | 3 |
| missing in the game | 36 |
| … of which on a chapter route | 21 |
| ATMs drawn as bank POIs on a route | 6 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| db | Patria Bank | bank | Șoseaua Pipera 42, București | NE side of Strada Gara Herăstrău | medium | present |  |
| db | La Doi Pași | convenience | — | N side of Șoseaua Pipera | medium | present |  |
| db | Garanti BBVA | bank | — | N side of Șoseaua Pipera | medium | present | OSM brand tag says "Garanti Bankası" (Turkish parent); Romanian branches are signed "Garanti BBVA" (garantibbva.ro, 2026-11-07) |
| db | Ted's Coffee Co. | cafe | Șoseaua Pipera 42, București | SE side of Șoseaua Pipera | medium | present |  |
| db | Mega Image | supermarket | Podul Barbu Văcărescu 201, București | SE side of Șoseaua Pipera | medium | present |  |
| db | ING | bank | Șoseaua Pipera 35, București | N side of Șoseaua Pipera | medium | present |  |
| luxoft | Libra Internet Bank | bank | Șoseaua Fabrica de Glucoză, București | S side of Șoseaua Fabrica de Glucoză | medium | present |  |
| db | Petrom | fuel | Șoseaua Pipera 23A, București | N side of Șoseaua Pipera | medium | present |  |
| luxoft | Mobexpert | furniture | Șoseaua Fabrica de Glucoză 21, București | N side of Șoseaua Fabrica de Glucoză | low | present |  |
| db | Raiffeisen Bank | bank | Șoseaua Pipera 21, București | N side of Șoseaua Pipera | medium | present |  |
| luxoft | Shop&Go | convenience | Șoseaua Fabrica de Glucoză, București | S side of Șoseaua Fabrica de Glucoză | medium | present |  |
| luxoft | Ted's Coffee Co. | cafe | Strada George Constantinescu 4B, București | NE side of Strada George Constantinescu | medium | present |  |
| db | UniCredit | bank | Șoseaua Pipera 35, București | N side of Șoseaua Pipera | medium | present |  |
| db | Help Net | pharmacy | Șoseaua Pipera 31-33, București | N side of Șoseaua Pipera | medium | present |  |
| db | Maxbet | casino | — | N side of Șoseaua Pipera | medium | missing |  |
| db | Fortuna | bookmaker | — | N side of Șoseaua Pipera | medium | missing |  |
| db | Lukoil | fuel | Strada Căpitan Aviator Alexandru Șerbănescu 1, București | NW side of Șoseaua Pipera | medium | present | fuel: canopy fascia in brand colours + price pylon at the kerb; Lukoil international assets (incl. Romanian stations) were the subject of a sale offer in Nov 2025 (Wikipedia "Lukoil"); station brand may change — re-check |
| luxoft | Mega Image | supermarket | Șoseaua Fabrica de Glucoză 9B, București | SW side of Strada George Constantinescu | medium | present |  |
| db | Auchan | convenience | Șoseaua Pipera, București | N side of Șoseaua Pipera | medium | present |  |
| db | Courtyard | hotel | Bulevardul Dimitrie Pompeiu 2A, București | S side of Bulevardul Dimitrie Pompeiu | high | present |  |
| db | Shop&Go | convenience | Șoseaua Pipera 31-33, București | N side of Șoseaua Pipera | medium | present |  |
| db | Carrefour Express | convenience | Strada Gara Herastrau Nr. 4C, Sector 2, Bucuresti | NE side of Strada Gara Herăstrău | medium | missing |  |
| luxoft | Kaufland | supermarket | Str.Fabrica de Glucoza nr 6-8, București | E side of Strada Marin Preda | medium | missing |  |
| db | 5 to go | cafe | — | N side of Șoseaua Pipera | medium | present |  |

Independents on the routes (37): ? (butcher), ? (car_wash), ? (convenience), ANAPAN (bakery), Audio Forum (hifi), A•R•C Bakery (restaurant), Beneva (pharmacy), Bilete STB (ticket), Cabinet Veterinar Aviației (veterinary), Cafe' de Fleurs (florist), Centrul naturist de sănătate Santo Raphael (clinic), Cloche Exchange (bureau_de_change), Creo Kitchens (kitchen), Express Pub&Grill (fast_food), Fayn (restaurant), Florăria Voicu (garden_centre), Florărie (florist), Food store (convenience), GPL Lukoil Aviației (fuel), Husqvarna (appliance), La halaleala (fast_food), Medicover (doctors), NoaDent (dentist), Nufărul - Aviației (dry_cleaning), Orygyns Speciality Coffee (cafe), Rainbowls (restaurant), Rental Car Center (car_rental), Salon Rebelle (hairdresser), Sophia home decoration (curtain), The Library (restaurant), Tunel Carwash (car_wash), Turkish Doner Grill (restaurant), Vlaicu (bakery), Yoyo Burgers (fast_food), eiluminat Concept Store (lighting), ibrik (cafe)

## Official-locator checks

- **Carrefour Express** Strada Gara Herastrau Nr. 4C, Sector 2, Bucuresti: locator only match with "Express Green Court" — https://carrefour.ro/corporate/magazine — *not found in OSM within the zone; added from the locator*
- **Kaufland** Str.Fabrica de Glucoza nr 6-8, București: locator only match with "Kaufland Bucuresti Fabrica de Glucoza" — https://www.kaufland.ro/.klstorefinder.json — *not found in OSM within the zone; added from the locator*
- **KFC** București, Floreasca, Nr. 246B, sector 1: locator only match with "KFC Promenada" — https://kfc.ro/restaurante — *not found in OSM within the zone; added from the locator*
- **McDonald's** Calea Floreasca 246B, sector 1 14476: locator only match with "McDonald's Promenada Mall" — https://mcdonalds.ro/restaurante — *not found in OSM within the zone; added from the locator*
- **Carrefour Market** Șoseaua Pipera 61, București: address match with "Market Cloud 9 Residence" (79 m) — https://carrefour.ro/corporate/magazine

## Game comparison (`game/data/bucharest-pipera.json`)

Missing businesses by reason: 2× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter); 30× dropped by the build filter; 4× not in OSM (official locator only).

Categories dropped by `poiKind()`: books (2), car_wash (2), florist (2), bookmaker (2), hairdresser (1), butcher (1), shoes (1), sports (1), optician (1), dentist (1), dry_cleaning (1), post_office (1), telecommunication (1), interior_decoration (1), nutrition_supplements (1), cosmetics (1), toys (1), casino (1), doctors (1), lighting (1), appliance (1), hifi (1), curtain (1), kitchen (1), garden_centre (1), ticket (1).

Missing chain brands: Carrefour Express★, Cărturești, DHL, Deichmann, Digi, English Home, Fortuna★, GNC, Hervis, KFC, Kaufland★, Maxbet★, McDonald's, OPTIblu, Smyk, Superbet (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): C&A, Courtyard, Deichmann, Digi, English Home, Fortuna, GNC, Garanti BBVA, Hervis, Hyundai, Libra Internet Bank, Maxbet, Mazda, Mobexpert, Next, Smyk, SsangYong, Superbet, Vianor.

Brand name: OSM `brand=Garanti Bankası` (Turkish parent) → the game writes "Garanti Bankası" on the facade; Romanian branches read **Garanti BBVA**.

Extra in game near the routes: Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); BRD (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); UniCredit Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside).

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**luxoft** — 1814 m; OSM ways with `maxspeed`: 14 (1720 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Petricani | secondary | 272 | 60 | 60 |
| Șoseaua Petricani | secondary | 166 | 40 | 40 |
| Strada Petricani | secondary | 63 | 40 | 40 |
| Șoseaua Petricani | secondary | 175 | 50 | 50 |
| Șoseaua Fabrica de Glucoză | primary | 693 | 40 | 40 |
| Strada George Constantinescu | tertiary | 335 | 50 | 50 |
| Bulevardul Dimitrie Pompeiu | tertiary | 16 | 50 | 50 |

**db** — 1584 m; OSM ways with `maxspeed`: 14 (1540 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Pipera | secondary | 557 | 50 | 50 |
| Strada Gara Herăstrău | tertiary | 316 | 50 | 50 |
| Bulevardul Dimitrie Pompeiu | tertiary | 667 | 50 | 50 |

Schools / kindergartens within 150 m of a route: Colegiul Tehnic "Edmond Nicolau" (way/23732187, 72 m); Liceul Tehnologic "Constantin Brâncuși" (way/256525667, 62 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
