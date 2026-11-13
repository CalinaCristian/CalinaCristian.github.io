# Businesses & speed limits — Grozăvești (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-grozavesti.json` (one entry per business, independents included) and the `bucharest-grozavesti` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out. Confidence and sign-style rules as in `businesses-bucharest-floreasca.md`.

Against the game data of 2026-11-07, 13 businesses were missing (6 dropped by the `poiKind()` build filter: bookmaker, post office, hairdresser, copyshop, doctors, chocolate; 7 outside the mask / deduplicated); the 2026-11-12 POI append (below) has filled part of that gap. Brands without sign colours fall back to the generic kind colours (Altex, Dodo Pizza, Honda, Kia, Samsung, Synevo, Toyota, Tucano Coffee at the time).

## On the chapter route (upb)

| brand | category | address | side | conf. |
|---|---|---|---|---|
| BCR | bank | Șoseaua Orhideelor 15D | W side of Șos. Orhideelor | medium |
| Lukoil | fuel + convenience | Șoseaua Orhideelor 4 | E side of Șos. Orhideelor | medium |
| OMV | fuel | Bd. Doina Cornea 5 | SE side of Bd. Doina Cornea | medium |

Fuel: canopy fascia in brand colours plus a price pylon at the kerb. Lukoil's international assets (Romanian stations included) were offered for sale in Nov 2025 (Wikipedia "Lukoil"): the station brand may change, re-check. Nine independents on the route are in the JSON.

## Official-locator checks

- **Carrefour Express** Șos. Orhideelor 15A: position match, "Express Orhideea Towers" (121 m), carrefour.ro/corporate/magazine.
- Closed per OSM lifecycle tags: n6792143476 (`disused:amenity=restaurant`, 44.44581, 26.05984): draw as a vacant "De închiriat" unit if modelled.

## POIs added from live OSM (2026-11-12 / 13)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 140 rows (161 before; 117 in the edge strip; 21 dropped by class; 2 new in OSM / relations; 6 own building names). Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls (Carrefour Orhideea gallery, 40), unnamed objects, ATMs outside the area.
- Germag n5862008006 (`shop=yes`, named; named `shop=yes` is now a shop class): pano wEy2ri9fhmOq0iOEkX5jIg shows the GERMAG front at Bd. Banu Manta 2.
- Street View, Calea Griviței 158: ground-floor shop fronts where the game has a Catena fascia (name not readable in the preview). 6 Bd. Iuliu Maniu (The Light One): glass office tower, no tenant name dominates at street level.

## Speed limits on the chapter route

Romanian legal default: see `businesses-bucharest-floreasca.md`. **upb** — 1661 m, all OSM ways tagged.

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Orhideelor | secondary | 536 | 50 | 50 |
| Șoseaua Orhideelor | secondary | 300 | RO:urban | 50 |
| Podul Grozăvești | secondary | 56 | 50 | 50 |
| Șoseaua Grozăvești | secondary | 70 | 50 | 50 |
| Bulevardul Doina Cornea | secondary | 691 | 50 | 50 |

Schools / kindergartens within 150 m: Grădinița nr. 168 (w1331454041, 41 m).

## Sources

OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL; official Street View panoramas viewed for appearance only (nothing stored); locators as listed in `businesses-bucharest-floreasca.md`.
