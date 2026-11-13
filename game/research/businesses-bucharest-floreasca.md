# Businesses & speed limits — Floreasca (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-floreasca.json` (one entry per business, independents included) and the `bucharest-floreasca` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

## Counts (2026-11-07)

98 businesses in the zone, 45 within 60 m of a chapter route; 28 chain brands; 3 confirmed by an official locator; confidence high 4 / medium 67 / low 27; no chain store missing from its locator; 3 closed per lifecycle tags on the route. Against the game data of that day: 68 POIs within 35 m, 30 missing (19 dropped by the `poiKind()` build filter: bookmakers, books, opticians, beauty, dry cleaning, pubs and other classes; 11 outside the mask / deduplicated). The 2026-11-12 POI append (below) has filled part of that gap.

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

## On the chapter route (rosetti)

| brand | category | address | side | conf. |
|---|---|---|---|---|
| Garanti BBVA | bank | Calea Floreasca 141-143 | W side of Calea Floreasca | medium |
| Maxbet | bookmaker | Calea Floreasca 91-111 | W side of Calea Floreasca | low |
| Paul | bakery | Calea Floreasca 111-113 | W side of Calea Floreasca | low |
| Superbet | bookmaker | Calea Floreasca 111-113 | W side of Calea Floreasca | low |
| Dona | pharmacy | Calea Floreasca 111-113 | N side of Str. Bălănescu Rosetti | high |

Garanti: OSM `brand=Garanti Bankası` (Turkish parent); Romanian branches are signed **Garanti BBVA** (garantibbva.ro, 2026-11-07); `tools/osm/poi-kinds.mjs` renames it. 40 independents on the route are in the JSON.

## Official-locator checks

- **Dona** Calea Floreasca 111-113: address match, "Crisen Farm - CF2 - Floreasca" (55 m), dona.ro/farmacii.
- **Carrefour Express** Calea Dorobanților 102-110: position match, "Express Proxi Dorobanti" (26 m), carrefour.ro/corporate/magazine.
- **McDonald's** Str. Barbu Văcărescu 146-158: address match, "McDonald's Barbu Văcărescu", mcdonalds.ro/restaurante.

Closed per OSM lifecycle tags (draw as a vacant "De închiriat" unit if modelled): n1081724064 (`disused:amenity=cafe`, 44.45817, 26.10084), My Maya n4454713391 (`disused:shop=bakery`, 44.45557, 26.09995), n7038739416 (`disused:shop=motorcycle_repair`, 44.45634, 26.10046).

## POIs added from live OSM (2026-11-12)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 64 rows (94 before; 56 in the edge strip; 8 dropped by class; 2 own building names). Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls, unnamed objects, ATMs outside the area. Street View at 109 Calea Dorobanți: ground-floor shop fronts where the game has a Banca Transilvania fascia; the preview was too coarse to read the name.

## Speed limits on the chapter route

**Legal default (Romania).** 50 km/h inside localities unless signed; the road owner may, with police approval, raise sections to 80 or lower them to 30 (OUG 195/2002 art. 49, via en.wikipedia.org/wiki/Speed_limits_in_Romania, 2026-11-07; legislatie.just.ro did not respond). Big boulevards are signed 60 (OSM `maxspeed=60`); no automatic school-zone limit: "Copii" warning signs and, where the city chose, a signed 30.

**rosetti** — 1637 m, all OSM ways tagged.

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Calea Floreasca | tertiary | 758 | 50 | 50 |
| Strada Béla Bartók | residential | 124 | RO:urban | 50 |
| Strada Serghei Vasilievici Rahmaninov | residential | 535 | RO:urban | 50 |
| Strada Georges Bizet | residential | 176 | RO:urban | 50 |
| Strada General Giuseppe Garibaldi | residential | 42 | 40 | 40 |

Schools / kindergartens within 150 m: Paradisul Copiilor (n1544915641, 12 m), Grădinița nr. 12 Albinuța (n4365350292, 111 m), Școala Gimnazială Maria Rosetti (w26974362, 129 m), Liceul Teoretic C.A. Rosetti (w253216276, 76 m).

## Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL; element ids in every entry.
- Locators (2026-11-07): mcdonalds.ro/restaurante (118 restaurants, coordinates for 33), kfc.ro/restaurante, kaufland.ro/.klstorefinder.json, carrefour.ro/corporate/magazine (451 stores, `temporarily_closed` flag), dona.ro/farmacii (672 with coordinates).
- Not machine-readable then (OSM only): Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen (403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall).
