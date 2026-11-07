# Businesses & speed limits — Romană & Victoriei (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-romana.json` (one entry per business) and the `bucharest-romana` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask of `game/data/bucharest-romana.json`. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts

| | |
|---|---|
| businesses in zone | 429 |
| … of which within 60 m of a chapter route | 126 |
| chain brands | 134 |
| confirmed by an official store locator | 8 |
| confidence high | 40 |
| confidence medium | 322 |
| confidence low | 67 |
| chain store NOT in its official locator (possibly closed) | 0 |
| in the official locator but not in OSM (added) | 0 |
| closed per OSM lifecycle tags (on route, listed below) | 14 |
| in the game (POI within 35 m) | 336 |
| in the game only as a facade sign | 1 |
| missing in the game | 92 |
| … of which on a chapter route | 42 |
| ATMs drawn as bank POIs on a route | 1 |

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter routes (chain brands)

| chapter | brand | category | address | side | conf. | in game | note |
|---|---|---|---|---|---|---|---|
| arnia | Help Net | pharmacy | — | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | 5 to go | cafe | — | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | Calzedonia | clothes | — | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | Help Net | pharmacy | Bulevardul General Gheorghe Magheru 18, București | E side of Bulevardul General Gheorghe Magheru | medium | present |  |
| uipath-buc | CEC Bank | bank | Bulevardul Iancu de Hunedoara 8, București | S side of Bulevardul Iancu de Hunedoara | low | present |  |
| arnia | McDonald's | fast_food | Bulevardul General Gheorghe Magheru 24, București | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | UniCredit | bank | Bulevardul General Gheorghe Magheru 24, București | NW side of Strada George Enescu | high | present |  |
| arnia | BRD | bank | Calea Victoriei 224, București | SW side of Bulevardul Lascăr Catargiu | medium | present |  |
| arnia | Terranova | clothes | — | W side of Bulevardul General Gheorghe Magheru | medium | present |  |
| arnia | Orange | mobile_phone | Bulevardul Lascăr Catargiu 47-53, București | SW side of Bulevardul Lascăr Catargiu | medium | facade sign only |  |
| arnia | Dona | pharmacy | — | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | Mesopotamia | fast_food | Bulevardul General Gheorghe Magheru 26, București | E side of Bulevardul General Gheorghe Magheru | medium | present |  |
| arnia | BRD | bank | Bulevardul General Gheorghe Magheru 35, București | W side of Bulevardul General Gheorghe Magheru | medium | present |  |
| arnia | Miniso | variety_store | — | E side of Bulevardul General Gheorghe Magheru | high | missing |  |
| arnia | Dent estet | dentist | — | NE side of Bulevardul Lascăr Catargiu | medium | missing |  |
| arnia | Orange | mobile_phone | Bulevardul General Gheorghe Magheru 41, București | W side of Bulevardul General Gheorghe Magheru | medium | missing |  |
| arnia | KFC | fast_food | Bulevardul General Gheorghe Magheru 28-30, București | E side of Bulevardul General Gheorghe Magheru | high | present |  |
| arnia | Superbet | bookmaker | — | W side of Bulevardul General Gheorghe Magheru | low | missing |  |
| arnia | BCR | bank | Bulevardul General Gheorghe Magheru 43, București | W side of Bulevardul General Gheorghe Magheru | medium | present |  |
| uipath-buc | Ted's Coffee Co. | cafe | — | E side of Strada Vasile Alecsandri | medium | present |  |
| arnia | Maxbet | casino | — | W side of Bulevardul General Gheorghe Magheru | medium | missing |  |
| arnia | dm | chemist | Bulevardul General Gheorghe Magheru 43, București | W side of Bulevardul General Gheorghe Magheru | high | missing |  |
| arnia | Fornetti | pastry | Piața Romană, București | S side of Bulevardul Dacia | medium | missing |  |
| arnia | Carrefour Express | convenience | Piața Victoriei 155, București | SW side of Calea Victoriei | high | present |  |
| arnia | BCR | bank | Calea Victoriei 155, București | SW side of Calea Victoriei | medium | present |  |
| arnia | Ted's Coffee Co. | cafe | Calea Victoriei 224, București | NE side of Calea Victoriei | medium | present |  |
| arnia | Ted's Coffee Co. | cafe | Strada Căderea Bastiliei 13B, București | W side of Strada Căderea Bastiliei | medium | present |  |
| arnia | Cărturești | books | Bulevardul General Gheorghe Magheru 16, București | N side of Strada Pictor Arthur Verona | medium | missing |  |
| arnia | 5 to go | cafe | — | NW side of Strada George Enescu | medium | present |  |
| arnia | Intesa Sanpaolo | bank | Calea Victoriei 155, București | SW side of Calea Victoriei | medium | present |  |
| arnia | Il Calcio | restaurant | Strada Anastase Simu 6, București | NW side of Strada Benjamin Franklin | medium | present |  |
| arnia | Mega Image | supermarket | Bulevardul General Gheorghe Magheru 9, București | SE side of Strada George Enescu | medium | present |  |
| arnia | First Bank | bank | Bulevardul General Gheorghe Magheru 7, București | W side of Bulevardul General Gheorghe Magheru | low | present |  |
| arnia | UniCredit | bank | Bulevardul General Gheorghe Magheru 7, București | W side of Bulevardul General Gheorghe Magheru | medium | present |  |

Independents on the routes (92): ? (newsagent), AGS (jewelry), Amanet (pawnbroker), Andreea F - Patiserie fină artizanală (bakery), Animaletto Pizza Bar (restaurant), Artemis.Masaj (massage), Baba Market (convenience), Basarabia (deli), Blue Margarita (restaurant), Boba chaya (cafe), Bruncherry by Happy Eggs (fast_food), Cafeneaua Nației (cafe), Carte (cafe), Casandra (confectionery), Clinica Audionova (clinic), Club XS (nightclub), Coffetea (cafe), Crăpelniță (fast_food), Dental Pallace (dentist), Depot 96 (clothes), DiKa (clothes), Emre Baklava (bakery), Exchange Non Stop (bureau_de_change), F.M. Medident - Piața Victoriei (dentist), Farmacia Santia (pharmacy), First Copy (copyshop), Florăria Iris - pct. Magheru x Take Ionescu (florist), Florărie Non-Stop (florist), Friddi (ice_cream), Grand Boulevard Apartment at Piata Romana (apartment), Gregory's (pastry), Gyros (restaurant), High Life Bistro (restaurant), Hobby Mobile Accessories (mobile_phone_accessories), Hotel Ambasador (hotel), Hotel Duke (hotel), Hotel Lido (hotel), Hotel Minerva (hotel), Hotspot (cafe), Innovative Romana (copyshop), Italian Vintage (cafe), J'Info Tours (travel_agency), Kix (shoes), Lashez (clothes), Librarul (books), Librăria Papirus (books), Limerence (pastry), Madame Briolette (clothes), Magazin Mixt (convenience), Marshal Turism (travel_agency), Medicover (clinic), Mini Market (convenience), Modamore (clothes), Mon Bijou (fashion_accessories), My Private Sex Shop (erotic), Noodle Pack (fast_food), Old Bastards Tattoo (tattoo), Pan Caldi (bakery), Pasta Bella (restaurant), Patiseria Tineretului (fast_food) …

## Official-locator checks

- **McDonald's** Bulevardul General Gheorghe Magheru 24, București: address match with "McDonald's Romană" (176 m) — https://mcdonalds.ro/restaurante
- **Dona** Farmacia Dona: position match with "Farmacia Dona - Magheru, București" (13 m) — https://www.dona.ro/farmacii
- **KFC** Bulevardul General Gheorghe Magheru 28-30, București: address match with "KFC Romană" (11 m) — https://kfc.ro/restaurante
- **Carrefour Express** Piața Victoriei 155, București: address match with "Express Calea Victoriei" (76 m) — https://carrefour.ro/corporate/magazine
- **Carrefour Market** Calea Dorobanților 31-33, București: address match with "Market Dorobantilor-ASE" (22 m) — https://carrefour.ro/corporate/magazine
- **Carrefour Express** Calea Dorobanților 102-110, București: position match with "Express Proxi Dorobanti" (26 m) — https://carrefour.ro/corporate/magazine
- **McDonald's** Strada Doctor Iacob Felix 8, București: address match with "McDonald's Buzești" (3 m) — https://mcdonalds.ro/restaurante
- **McDonald's** McDonald's PlayPlace: position match with "McDonald's Buzești" (15 m) — https://mcdonalds.ro/restaurante

## Closed per OSM lifecycle tags (within 60 m of a route)

- (unnamed) — `disused:shop=kiosk` at 44.44243, 26.09926 (node/2546324265, last edit 2026-07-03) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=yes` at 44.44175, 26.09953 (node/4549374247, last edit 2026-04-07) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=coffee` at 44.44214, 26.09935 (node/6513758411, last edit 2025-02-12) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=coffee` at 44.44240, 26.09921 (node/9001427429, last edit 2025-02-12) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=newsagent` at 44.44457, 26.09833 (node/11261959885, last edit 2025-02-12) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=florist` at 44.44458, 26.09838 (node/11261959886, last edit 2025-02-12) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:amenity=bureau_de_change` at 44.44432, 26.09851 (node/11618365273, last edit 2026-06-30) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:amenity=pharmacy` at 44.45095, 26.09006 (node/2637716554, last edit 2026-06-15) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:amenity=bank` at 44.45178, 26.08787 (node/3757940559, last edit 2026-06-15) — draw as a vacant unit ('De închiriat') if modelled
- Centrul Rus de Știință și Cultură din București — `disused:amenity=community_centre` at 44.45085, 26.08962 (node/3956663257, last edit 2026-08-31) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=florist` at 44.45156, 26.08714 (node/11222737061, last edit 2026-06-15) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=mobile_phone` at 44.44556, 26.09720 (node/5084229431, last edit 2026-06-30) — draw as a vacant unit ('De închiriat') if modelled
- Cinema Studio — `disused:amenity=cinema` at 44.44502, 26.09747 (node/5859527796, last edit 2026-06-30) — draw as a vacant unit ('De închiriat') if modelled
- (unnamed) — `disused:shop=yes` at 44.44709, 26.09586 (node/7293870987, last edit 2023-09-21) — draw as a vacant unit ('De închiriat') if modelled

## Game comparison (`game/data/bucharest-romana.json`)

Missing businesses by reason: 13× not found within 35 m (outside the district mask, deduplicated, or dropped by the near-network filter); 79× dropped by the build filter.

Categories dropped by `poiKind()`: books (10), optician (7), mobile_phone (4), bookmaker (3), pastry (3), copyshop (3), dentist (3), massage (3), shoes (2), erotic (2), florist (2), cosmetics (2), travel_agency (2), jewelry (2), casino (2), post_office (2), newsagent (2), fashion_accessories (2), chemist (2), tobacco (2), e-cigarette (1), tattoo (1), telecommunication (1), nightclub (1), perfumery (1), deli (1), car_rental (1), bag (1), pawnbroker (1), appliance (1), pet (1), mobile_phone_accessories (1), variety_store (1), ticket (1), confectionery (1), apartment (1), dry_cleaning (1), tiles (1), fast_food (1).

Missing chain brands: 5àsec, Admiral, Animax, Cărturești★, DHL, Dent estet★, Digi, Fornetti★, Froo, IQOS, Inmedio, Marionnaud, Maxbet★, McDonald's, Meli Melo, Miele, Miniso★, Opticris, Orange, Orange★, Porcelanosa, Samsonite, Sephora, Shop&Go, Sixt, Superbet, Superbet★, Vodafone, dm, dm★ (★ = on a chapter route).

Brands with no sign colours in `data.brands` nor in `world.js BRANDS` (fall back to generic kind colours): 5àsec, Admiral, Animax, Burberry, COS, Dent estet, Digi, Hugo Boss, IQOS, Il Calcio, InterContinental, Intesa Sanpaolo, La Romana, Libra Internet Bank, Marionnaud, Max Mara, Meli Melo, Miele, Miniso, Park Inn, Porcelanosa, ProCredit Bank, Radisson Blu, Sheraton, Sixt, TBI Bank, Terranova, Triumph, Tucano Coffee.

Brand name: OSM `brand=Garanti Bankası` (Turkish parent) → the game writes "Garanti Bankası" on the facade; Romanian branches read **Garanti BBVA**.

Extra in game near the routes: Euronet (atm) — ATM drawn as a bank POI (and as the building's sign if it is the first POI inside).

## Speed limits on the chapter routes

**Legal default (Romania).** Inside localities the limit is 50 km/h unless signed; the road owner may, with traffic-police approval, raise it on some sections up to 80 km/h or lower it down to 30 km/h (OUG 195/2002 art. 49 as summarised in https://en.wikipedia.org/wiki/Speed_limits_in_Romania, fetched 2026-11-07; the official text at legislatie.just.ro did not respond). Bucharest's big boulevards are signed 60 (Magheru, Lascăr Catargiu, Kiseleff, parts of Bd. Unirii) — OSM `maxspeed=60` on those ways; DN1 through Otopeni is signed 70 on the flyover (OSM `maxspeed=70`). There is no automatic school-zone limit in Romania: schools get the triangular "Copii" warning sign and, where the city chose so, a signed 30 (OSM tags these as `maxspeed=30`, e.g. Grigore Alexandrescu by the children's hospital, parts of Garibaldi).


**arnia** — 1920 m; OSM ways with `maxspeed`: 26 (1875 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Bulevardul General Gheorghe Magheru | primary | 572 | 60 | 60 |
| Piața Romană | primary | 67 | 60 | 60 |
| Bulevardul Lascăr Catargiu | primary | 1013 | 60 | 60 |
| Piața Victoriei | primary | 223 | 50 | 50 |

**uipath-buc** — 1458 m; OSM ways with `maxspeed`: 12 (1454 m), without: 0 (0 m).

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Pavel Dimitrievici Kiseleff | primary | 342 | 60 | 60 |
| Piața Victoriei | primary | 214 | 50 | 50 |
| Bulevardul Iancu de Hunedoara | primary | 267 | 50 | 50 |
| Strada Clopotarii Vechi | residential | 132 | RO:urban | 50 |
| Strada Grigore Alexandrescu | residential | 313 | 30 | 30 |
| Strada Vasile Alecsandri | residential | 186 | RO:urban | 50 |

Mapped signs / cameras within 150 m: node/6251793021 maxweight;maxspeed@40 19 m.

Schools / kindergartens within 150 m of a route: Grădinița nr. 116 (node/2558783253, 117 m); Liceul de Arte Plastice Nicolae Tonitza (way/405529583, 148 m); Școala Internațională Italiană „Aldo Moro” din București (way/245083700, 57 m); Grădiniţa Nr. 50 (way/1059582478, 104 m); Școala Generală nr. 11 "Ion Heliade Rădulescu" (way/23611106, 34 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 (`/api/0.6/map`), © OpenStreetMap contributors, ODbL — element ids in every entry.
- McDonald's România restaurant list https://mcdonalds.ro/restaurante (fetched 2026-11-07; 118 restaurants, coordinates for 33).
- KFC România https://kfc.ro/restaurante (fetched 2026-11-07, coordinates per restaurant).
- Kaufland România store finder JSON https://www.kaufland.ro/.klstorefinder.json (2026-11-07).
- Carrefour România store list https://carrefour.ro/corporate/magazine (2026-11-07, 451 stores incl. Express/Market, `temporarily_closed` flag).
- Farmacia Dona list https://www.dona.ro/farmacii (2026-11-07, 672 pharmacies with coordinates).
- Not machine-readable from here (2026-11-07): Mega Image (GraphQL API refused by the network after one call), Profi, Dr.Max, HelpNet, CEC, Raiffeisen (HTTP 403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol locators (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall). These brands rely on OSM (edit / check dates) only.
- Garanti BBVA brand name: https://www.garantibbva.ro (page title "… | Garanti BBVA", 2026-11-07).
