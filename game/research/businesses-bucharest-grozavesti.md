# Businesses & speed limits — Grozăvești (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-grozavesti.json` (one entry per business) and the `bucharest-grozavesti` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-grozavesti.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 92 |
| … of which within 60 m of a chapter route | 13 |
| chain brands | 34 |
| confirmed by an official store locator | 1 |
| confidence high | 4 |
| confidence medium | 61 |
| confidence low | 27 |
| chain store NOT in its official locator (possibly closed) | 0 |
| in the official locator but not in OSM (added) | 0 |
| closed per OSM lifecycle tags (on route, listed below) | 1 |
| in the game (POI within 35 m) | 78 |
| in the game only as a facade sign | 1 |
| missing in the game | 13 |
| … of which on a chapter route | 3 |
| ATMs drawn as bank POIs on a route | 0 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| upb | BCR | bank | Șoseaua Orhideelor 15D, București | W side of Șoseaua Orhideelor | medium | present |  |
| upb | Lukoil | fuel | Șoseaua Orhideelor 4, București | E side of Șoseaua Orhideelor | medium | present | fuel: canopy fascia in brand colours + price pylon at the kerb; Lukoil international assets (incl. Romanian stations) were the subject of a sale offer in Nov 2025 (Wikipedia "Lukoil"); station brand may change — re-check |
| upb | Lukoil | convenience | Șoseaua Orhideelor 4, București | E side of Șoseaua Orhideelor | medium | present | Lukoil international assets (incl. Romanian stations) were the subject of a sale offer in Nov 2025 (Wikipedia "Lukoil"); station brand may change — re-check |
| upb | OMV | fuel | Bulevardul Doina Cornea 5, București | SE side of Bulevardul Doina Cornea | medium | present |  |

Independents on the routes (9): 14th Lane (cafe), 14th Lane (restaurant), ? (convenience), Ahrend (furniture), Choco-Museum (chocolate), Fabrica Grivița (bar), Green Day Spa (hairdresser), Sir Orhideea (hotel), So Coffee (cafe)

## Official-locator checks

- **Carrefour Express** Șoseaua Orhideelor 15A, București: position match with "Express Orhideea Towers" (121 m) — https://carrefour.ro/corporate/magazine

## Closed per OSM lifecycle tags (within 60 m of a route)

- (unnamed) — `disused:amenity=restaurant` at 44.44581, 26.05984 (node/6792143476, last edit 2024-11-06) — draw as a vacant unit ('De închiriat') if modelled

## Game comparison (`game/data/bucharest-grozavesti.json`)

Missing businesses by reason: 6× dropped by the build filter; 7× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter).

Categories dropped by `poiKind()`: bookmaker (1), post_office (1), hairdresser (1), copyshop (1), doctors (1), chocolate (1).

Missing chain brands: LYB Arhi-Proiect S.R.L., Mega Image, Superbet, Synevo (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): Altex, Dodo Pizza, Honda, Kia, LYB Arhi-Proiect S.R.L., Samsung, Synevo, Toyota, Tucano Coffee.

Wrong colours / names: `Molson Coors GBS` — world.js brandStyle() prefix match gives it the 'mol' brand colours.

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**upb** — 1661 m; OSM ways with `maxspeed`: 16 (1653 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Orhideelor | secondary | 536 | 50 | 50 |
| Șoseaua Orhideelor | secondary | 300 | RO:urban | 50 |
| Podul Grozăvești | secondary | 56 | 50 | 50 |
| Șoseaua Grozăvești | secondary | 70 | 50 | 50 |
| Bulevardul Doina Cornea | secondary | 691 | 50 | 50 |

Schools / kindergartens within 150 m of a route: Gradinița nr. 168 (way/1331454041, 41 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
