# Businesses & speed limits — Floreasca (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-floreasca.json` (one entry per business) and the `bucharest-floreasca` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-floreasca.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 98 |
| … of which within 60 m of a chapter route | 45 |
| chain brands | 28 |
| confirmed by an official store locator | 3 |
| confidence high | 4 |
| confidence medium | 67 |
| confidence low | 27 |
| chain store NOT in its official locator (possibly closed) | 0 |
| in the official locator but not in OSM (added) | 0 |
| closed per OSM lifecycle tags (on route, listed below) | 3 |
| in the game (POI within 35 m) | 68 |
| in the game only as a facade sign | 0 |
| missing in the game | 30 |
| … of which on a chapter route | 12 |
| ATMs drawn as bank POIs on a route | 0 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| rosetti | Garanti BBVA | bank | Calea Floreasca 141-143, București | W side of Calea Floreasca | medium | present | OSM brand tag says "Garanti Bankası" (Turkish parent); Romanian branches are signed "Garanti BBVA" (garantibbva.ro, 2026-11-07) |
| rosetti | Maxbet | bookmaker | Calea Floreasca 91-111, București | W side of Calea Floreasca | low | missing |  |
| rosetti | Paul | bakery | Calea Floreasca 111-113, București | W side of Calea Floreasca | low | present |  |
| rosetti | Superbet | bookmaker | Calea Floreasca 111-113, București | W side of Calea Floreasca | low | missing |  |
| rosetti | Dona | pharmacy | Calea Floreasca 111-113, București | N side of Strada Bălănescu Rosetti | high | present |  |

Independents on the routes (40): Agora Floreasca (mall), Beautyland Salon (beauty), Bollo - Restaurant & Bar (restaurant), Bun și Tot (restaurant), Cannoleria (restaurant), Chez Toni (restaurant), Cozofino (cafe), E3 by Entourage (restaurant), Farmaplus (pharmacy), Graffiti Hotel (hotel), Hotel Johann Strauss (hotel), Komodo Lounge (restaurant), La Magie Beauty Salon (hairdresser), Matinée Floreasca (restaurant), Medissima (clinic), Medlife (clinic), Mega Image Maison des Chefs (restaurant), Mondayz Coffee (cafe), No7 (restaurant), Nomasvello (beauty), Ny Bagels & Burgers (fast_food), POT (restaurant), Piața Floreasca (marketplace), Pizzeria Due Amici (restaurant), Raionul Floreasca (seafood), Rosa Mundi (perfumery), Ruka Izakaya (restaurant), Sara (restaurant), Schnitzel King (restaurant), Simetria (dentist), SlimArt (doctors), Souk (restaurant), Submarine Original (fast_food), The Beer Institute (pub), Trattoria Il Calcio Floreasca (restaurant), Vacamuuu (restaurant), Verso Cărturești (books), iMZA Fine Cuisine (restaurant), moft (restaurant)

## Official-locator checks

- **Dona** Calea Floreasca 111-113, București: address match with "Crisen Farm - CF2 - Floreasca" (55 m) — https://www.dona.ro/farmacii
- **Carrefour Express** Calea Dorobanților 102-110, București: position match with "Express Proxi Dorobanti" (26 m) — https://carrefour.ro/corporate/magazine
- **McDonald's** Strada Barbu Văcărescu 146-158, București: address match with "McDonald's Barbu Văcărescu" — https://mcdonalds.ro/restaurante

## Closed per OSM lifecycle tags (within 60 m of a route)

- (unnamed) — `disused:amenity=cafe` at 44.45817, 26.10084 (node/1081724064, last edit 2025-04-22) — draw as a vacant unit ('De închiriat') if modelled
- My Maya — `disused:shop=bakery` at 44.45557, 26.09995 (node/4454713391, last edit 2026-04-25) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=motorcycle_repair` at 44.45634, 26.10046 (node/7038739416, last edit 2025-04-22) — draw as a vacant unit ('De închiriat') if modelled

## Game comparison (`game/data/bucharest-floreasca.json`)

Missing businesses by reason: 19× dropped by the build filter; 11× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter).

Categories dropped by `poiKind()`: bookmaker (3), books (2), optician (2), beauty (2), dry_cleaning (1), seafood (1), pub (1), perfumery (1), hairdresser (1), doctors (1), post_office (1), car_rental (1), dentist (1), marketplace (1).

Missing chain brands: 5àsec, Carrefour Express, Farmacia Tei, Garanti BBVA, Help Net, ING, Libra Internet Bank, Lidl, Maxbet★, OTP Bank, Opticris, Superbet, Superbet★ (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): 5àsec, Dona, Fresh Corner, Garanti BBVA, Libra Internet Bank, TBI Bank.

Brand name: OSM `brand=Garanti Bankası` (Turkish parent) → the game writes "Garanti Bankası" on the facade; Romanian branches read **Garanti BBVA**.

Extra in game near the routes: Garanti Bankası (bank) — not matched by this research (unbranded duplicate or outside research filters).

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**rosetti** — 1637 m; OSM ways with `maxspeed`: 16 (1635 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Calea Floreasca | tertiary | 758 | 50 | 50 |
| Strada Béla Bartók | residential | 124 | RO:urban | 50 |
| Strada Serghei Vasilievici Rahmaninov | residential | 535 | RO:urban | 50 |
| Strada Georges Bizet | residential | 176 | RO:urban | 50 |
| Strada General Giuseppe Garibaldi | residential | 42 | 40 | 40 |

Schools / kindergartens within 150 m of a route: Paradisul Copiilor (node/1544915641, 12 m); Grădinița nr. 12 Albinuța (node/4365350292, 111 m); Școala Gimnazială Maria Rosetti (way/26974362, 129 m); Liceul Teoretic C.A. Rosetti (way/253216276, 76 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
