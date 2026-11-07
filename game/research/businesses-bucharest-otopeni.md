# Businesses & speed limits — Otopeni (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-otopeni.json` (one entry per business) and the `bucharest-otopeni` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-otopeni.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 27 |
| … of which within 60 m of a chapter route | 21 |
| chain brands | 16 |
| confirmed by an official store locator | 0 |
| confidence high | 0 |
| confidence medium | 18 |
| confidence low | 9 |
| chain store NOT in its official locator (possibly closed) | 1 |
| in the official locator but not in OSM (added) | 0 |
| closed per OSM lifecycle tags (on route, listed below) | 0 |
| in the game (POI within 35 m) | 17 |
| in the game only as a facade sign | 1 |
| missing in the game | 9 |
| … of which on a chapter route | 8 |
| ATMs drawn as bank POIs on a route | 12 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| otopeni | Gazprom | fuel | Calea Bucureștilor 280A, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Rompetrol | fuel | Calea Bucureștilor 216-218, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | OMV | fuel | Calea Bucureștilor 224D, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Gazprom | convenience | Calea Bucureștilor 280A, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Carrefour Express | convenience | — | E side of Monumentul Eroilor Jandarmi | low | present | not in official locator |
| otopeni | hei | convenience | Calea Bucureștilor 216-218, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Viva | convenience | Calea Bucureștilor 224D, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Ramada | hotel | Strada Zborului 1A, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | Alamo | car_rental | — | NE side of Monumentul Eroilor Jandarmi | low | missing | inside a building on level 1: no street-front sign |
| otopeni | Rompetrol | fuel | Calea Bucureștilor 253A, București | W side of Calea Bucureștilor | medium | present |  |
| otopeni | Avis | car_rental | — | NE side of Monumentul Eroilor Jandarmi | low | missing | inside a building on level 1: no street-front sign |
| otopeni | Hertz | car_rental | — | NE side of Monumentul Eroilor Jandarmi | low | missing | inside a building on level 1: no street-front sign |
| otopeni | Ibis Styles | hotel | Calea Bucureștilor 222, București | E side of Calea Bucureștilor | medium | present |  |
| otopeni | SIXT | car_rental | — | NE side of Monumentul Eroilor Jandarmi | low | missing | inside a building on level 1: no street-front sign |

Independents on the routes (7): ? (furniture), Autonom (car_rental), Ferremo Trendy (furniture), Gaia's Cafe (cafe), Press & GO (kiosk), Speli-Singur.ro (car_wash), okmobility (car_rental)


**Not in the official locator (treat as possibly closed — do not add until a dated photo confirms):**
- Carrefour Express — Carrefour Express (node/4892173053, OSM node/4892173053 v6 (last edit 2025-06-07), brand:wikidata Q2940190)

## Game comparison (`game/data/bucharest-otopeni.json`)

Missing businesses by reason: 8× dropped by the build filter; 1× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter).

Categories dropped by `poiKind()`: car_rental (7), kiosk (1).

Missing chain brands: Alamo★, Avis★, Hertz★, SIXT★ (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): Alamo, Avis, Hertz, Ramada, SIXT, Vienna House, Viva, hei.

Extra in game near the routes: Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); CEC Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); BRD (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Raiffeisen Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Alpha Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); BRD (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Raiffeisen Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); UniCredit Bank (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside).

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**otopeni** — 2113 m; OSM ways with `maxspeed`: 9 (2111 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Calea Bucureștilor | trunk | 1299 | 70 | 70 |
| (unnamed) | tertiary | 509 | 50 | 50 |
| (unnamed) | tertiary | 303 | RO:urban | 50 |

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
