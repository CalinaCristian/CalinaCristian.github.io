# Businesses & speed limits — Unirii (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-unirii.json` (one entry per business) and the `bucharest-unirii` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-unirii.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 361 |
| … of which within 60 m of a chapter route | 89 |
| chain brands | 119 |
| confirmed by an official store locator | 5 |
| confidence high | 28 |
| confidence medium | 220 |
| confidence low | 113 |
| chain store NOT in its official locator (possibly closed) | 1 |
| in the official locator but not in OSM (added) | 0 |
| closed per OSM lifecycle tags (on route, listed below) | 2 |
| in the game (POI within 35 m) | 253 |
| in the game only as a facade sign | 1 |
| missing in the game | 107 |
| … of which on a chapter route | 46 |
| ATMs drawn as bank POIs on a route | 2 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| gts | KFC | fast_food | Piața Unirii 1, București | SE side of Bulevardul Corneliu Coposu | high | present |  |
| gts | New Yorker | clothes | Piața Unirii 1, București | SE side of Bulevardul Corneliu Coposu | high | present |  |
| gts | Froo | convenience | Bulevardul Corneliu Coposu 4, București | SE side of Bulevardul Corneliu Coposu | medium | present |  |
| gts | MoneyGram | money_transfer | — | SE side of Bulevardul Corneliu Coposu | medium | missing |  |
| gts | Superbet | bookmaker | Bulevardul Ion Constantin Brătianu 39, București | NW side of Bulevardul Corneliu Coposu | medium | missing |  |
| gts | Telekom | mobile_phone | Bulevardul Corneliu Coposu, București | NW side of Bulevardul Corneliu Coposu | low | missing | Telekom Romania Mobile shops: brand status not verifiable here (telekom.ro behind a bot wall, 2026-11-07); OSM only |
| gts | McDonald's | fast_food | Piața Unirii 1, București | E side of Pasajul Unirii | high | present |  |
| gts | ING | bank | Bulevardul Corneliu Coposu 3, București | NW side of Bulevardul Corneliu Coposu | low | present |  |
| gts | Dona | pharmacy | Bulevardul Corneliu Coposu, București | NW side of Bulevardul Corneliu Coposu | high | present |  |
| gts | Patria Bank | bank | Bulevardul Corneliu Coposu, București | NW side of Bulevardul Corneliu Coposu | medium | present |  |
| gts | 5 to go | cafe | Bulevardul Corneliu Coposu, București | NW side of Bulevardul Corneliu Coposu | medium | present |  |
| gts | MOL | fuel | Bulevardul Corneliu Coposu 14, București | SE side of Bulevardul Corneliu Coposu | medium | present |  |
| gts | Alpha Bank | bank | Bulevardul Corneliu Coposu 7-11, București | NW side of Bulevardul Corneliu Coposu | low | present | bank brand possibly absorbed in a 2024–25 merger; official site did not respond (2026-11-07) — verify with a dated photo |
| gts | Banca Transilvania | bank | Bulevardul Corneliu Coposu 3-5, București | NW side of Bulevardul Corneliu Coposu | medium | present |  |
| gts | OMV | fuel | Bulevardul Corneliu Coposu 12, București | SE side of Bulevardul Corneliu Coposu | low | present |  |
| gts | DHL | post_office | Bulevardul Corneliu Coposu, București | NW side of Bulevardul Corneliu Coposu | low | missing |  |
| gts | Chopstix | fast_food | Piața Unirii 1, București | E side of Pasajul Unirii | high | present |  |
| gts | Luca | bakery | Piața Unirii 1, București | E side of Pasajul Unirii | medium | present |  |
| gts | Sephora | cosmetics | Piața Unirii 1, București | E side of Pasajul Unirii | medium | missing |  |
| gts | Maxbet | casino | Bulevardul Dimitrie Cantemir 2, București | W side of Bulevardul Dimitrie Cantemir | medium | missing |  |
| gts | Stanleybet | bookmaker | — | NW side of Bulevardul Corneliu Coposu | medium | missing |  |
| gts | Garanti BBVA | bank | — | SW side of Strada Sfânta Vineri | medium | present | OSM brand tag says "Garanti Bankası" (Turkish parent); Romanian branches are signed "Garanti BBVA" (garantibbva.ro, 2026-11-07) |
| gts | Annabella | convenience | — | NE side of Strada Sfânta Vineri | medium | present |  |
| gts | Mega Image | supermarket | Piața Unirii 1, București | E side of Pasajul Unirii | medium | present |  |
| gts | Douglas | perfumery | Piața Unirii 1, București | E side of Pasajul Unirii | low | missing |  |

Independents on the routes (64): 20 grams (cafe), ? (antiques), ? (bureau_de_change), ? (dentist), ARCADIA TRADE S.R.L. (deli), AVRAHAM KOSHER (restaurant), AZAD Exchange (bureau_de_change), Amanet Cashbook (pawnbroker), Amore Rotondo Pizza (restaurant), AnaPan (bakery), Antiquariat (books), Art Estetic (beauty), Art Implant (clinic), Berezka (convenience), BikeXpert (bicycle), Bulgust (restaurant), C.T W. Bubble ea (cafe), Cargus Ship & Go (post_office), Carne Mântuleasa (butcher), Cheesy Pasta (fast_food), Cofetarie Agapitos (pastry), DAILY FLOWERS (florist), Dentall Pro (dentist), El Studio Unirii (beauty), Fastprint (copyshop), First Copy (copyshop), FotoTapet 3D.ro (home_decoration), Fx Auto (car_repair), Gelato Experience (confectionery), Grilly's Corner (deli), Hair Story by Amelie (hairdresser), Hotel Horoscop (hotel), Iris (florist), Jade Palace (massage), Librăria Sophia (books), Medident (dentist), Megapan (bakery), Mil Pasos Penthouse (apartment), Mini market (convenience), Noodle Pack (restaurant), Oftaprax (optician), Pet Shop Boys (pet), Piese auto Dacia (car_parts), RO dog (fast_food), Restaurant Horoscop (restaurant), Sex Shop Erotica (erotic), Sfinx (florist), Smokin'Pig (fast_food), Spălătorie Unirea Etaj 7 (car_wash), Stephanus (books), THE BARBER (hairdresser), Teatrul Coquette (theatre), The Harp (restaurant), The Harp Bakery (cafe), Toka (restaurant), Trattoria L'Oroscopo (restaurant), Trei (restaurant), Tripoli (restaurant), Trored Anticariat (books), Victoria Gold (jewelry) …

## Official-locator checks

- **KFC** Piața Unirii 1, București: position match with "KFC Unirea" (2 m) — https://kfc.ro/restaurante
- **McDonald's** Piața Unirii 1, București: address match with "McDonald's Unirea" (64 m) — https://mcdonalds.ro/restaurante
- **Dona** Bulevardul Corneliu Coposu, București: position match with "Farmacia Dona - Coposu, București" (10 m) — https://www.dona.ro/farmacii
- **Carrefour Express** Bulevardul Unirii 21, București: address match with "Express Bucuresti Unirii" (20 m) — https://carrefour.ro/corporate/magazine
- **Dona** Farmacia Dona: position match with "Farmacia Dona - Hala Traian, București" (14 m) — https://www.dona.ro/farmacii

**Not in the official locator (treat as possibly closed — do not add until a dated photo confirms):**
- Carrefour Express — Carrefour Express (node/14152468402, OSM node/14152468402 v1 (last edit 2026-09-04))

## Closed per OSM lifecycle tags (within 60 m of a route)

- H&M — `disused:shop=clothes` at 44.42725, 26.10448 (node/1814949000, last edit 2026-10-19) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=yes` at 44.43284, 26.11216 (node/1726032531, last edit 2023-02-05) — draw as a vacant unit ('De închiriat') if modelled

## Game comparison (`game/data/bucharest-unirii.json`)

Missing businesses by reason: 32× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter); 75× dropped by the build filter.

Categories dropped by `poiKind()`: books (12), bookmaker (7), mobile_phone (6), optician (5), cosmetics (3), florist (3), dentist (3), copyshop (3), bicycle (2), pastry (2), chemist (2), post_office (2), money_transfer (2), beauty (2), deli (2), hairdresser (2), car_wash (1), apartment (1), erotic (1), antiques (1), pawnbroker (1), pet (1), jewelry (1), chocolate (1), home_decoration (1), perfumery (1), car_parts (1), casino (1), massage (1), car_repair (1), confectionery (1), butcher (1), newsagent (1).

Missing chain brands: 5 to go, Carrefour Express, Cărturești, DHL★, Douglas★, Fortuna, Giant, Inglot, Inmedio, Leonidas, Maxbet★, Mega Image, MoneyGram, MoneyGram★, Opticris, Sephora★, Shop&Go, Stanleybet★, Superbet, Superbet★, Telekom★, Vodafone, dm (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): Avbs Broker, DoubleTree by Hilton, Fortuna, Garanti BBVA, Giant, Intesa Sanpaolo, Mercure, MoneyGram, New Yorker, Tucano Coffee.

Wrong colours / names: `inglot` — data.brands gives Inglot (cosmetics, black/white fascia) the ING orange colours.

Brand name: OSM `brand=Garanti Bankası` (Turkish parent) → the game writes "Garanti Bankası" on the facade; Romanian branches read **Garanti BBVA**.

Extra in game near the routes: Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside); Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside).

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**gts** — 1891 m; OSM ways with `maxspeed`: 22 (1887 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Piața Unirii | primary | 577 | 50 | 50 |
| Piața Unirii | primary | 18 | 40 | 40 |
| Piața Unirii | primary | 67 | 60 | 60 |
| Bulevardul Corneliu Coposu | secondary | 756 | 50 | 50 |
| Calea Călărașilor | secondary | 339 | 50 | 50 |
| Calea Călărașilor | secondary | 130 | RO:urban | 50 |

Mapped signs / cameras within 150 m: node/6242940774 maxspeed@60 113 m; node/6225649427 maxspeed@60 38 m.

Schools / kindergartens within 150 m of a route: Liceul Tehnologic Unirea (way/83488919, 121 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
