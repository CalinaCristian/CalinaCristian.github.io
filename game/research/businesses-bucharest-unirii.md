# Businesses & speed limits — Unirii (Bucharest)

Research pass 2026-11-07 (spec 20, R12.2 / R11), re-checked against live OSM on 2026-11-12. Machine-readable: `businesses-bucharest-unirii.json` (one entry per business, independents included), the `bucharest-unirii` block of `speedlimits.json`, and `businesses-gamediff.json` → `bucharest-unirii` (live missing list with `edgeM`, the `recheck` counts and `closed` disused units). Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out. Confidence and sign-style rules as in `businesses-bucharest-floreasca.md`.

## Counts

- 2026-11-07: 361 businesses in the zone, 89 within 60 m of the route; 119 chain brands; 5 confirmed by an official locator; confidence high 28 / medium 220 / low 113; 1 chain store missing from its locator; 2 closed per lifecycle tags on the route.
- 2026-11-12 (live OSM, data of 2026-11-09): 238 named businesses inside the playable area, 223 in the game, 15 not drawn by category (craft, healthcare, generic offices, holiday apartments, vacant). The route chains once missing (Sephora, Douglas, Superbet, Telekom, DHL, MoneyGram, Stanleybet, Maxbet) are in the data. 120 businesses within 60 m outside the playable edge are not drawn (the builder keeps POIs inside the edge only).
- Brands without sign colours fall back to the generic kind colours (at the time: Avbs Broker, DoubleTree by Hilton, Fortuna, Giant, Intesa Sanpaolo, Mercure, MoneyGram, New Yorker, Tucano Coffee). Inglot's ING orange from the old dossier is overridden to black / white in `tools/osm/build-data.mjs`; "Garanti Bankası" is renamed Garanti BBVA in `tools/osm/poi-kinds.mjs`. Euronet ATMs on the route are drawn as bank POIs.

## On the chapter route (gts)

| brand | category | address | side | conf. |
|---|---|---|---|---|
| KFC, McDonald's, Chopstix | fast_food | Piața Unirii 1 (Unirea) | SE of Bd. Corneliu Coposu / E of Pasajul Unirii | high |
| New Yorker | clothes | Piața Unirii 1 | SE of Coposu | high |
| Luca, Mega Image, Sephora, Douglas | bakery, supermarket, cosmetics, perfumery | Piața Unirii 1 | E of Pasajul Unirii | medium (Douglas low) |
| Froo | convenience | Bd. Corneliu Coposu 4 | SE of Coposu | medium |
| MOL, OMV | fuel | Bd. Corneliu Coposu 14, 12 | SE of Coposu | medium, low |
| MoneyGram, Stanleybet | money transfer, bookmaker | — | SE / NW of Coposu | medium |
| Superbet | bookmaker | Bd. I.C. Brătianu 39 | NW of Coposu | medium |
| Telekom | mobile_phone | Bd. Corneliu Coposu | NW of Coposu | low |
| ING, Banca Transilvania | bank | Bd. Corneliu Coposu 3, 3-5 | NW of Coposu | low, medium |
| Dona, Patria Bank, 5 to go, DHL | pharmacy, bank, cafe, post office | Bd. Corneliu Coposu | NW of Coposu | high, medium, medium, low |
| Alpha Bank | bank | Bd. Corneliu Coposu 7-11 | NW of Coposu | low |
| Maxbet | casino | Bd. Dimitrie Cantemir 2 | W of Cantemir | medium |
| Garanti BBVA, Annabella | bank, convenience | — | SW / NE of Str. Sfânta Vineri | medium |

To verify with a dated photo: Telekom Romania Mobile shops (brand status not verifiable, telekom.ro behind a bot wall, 2026-11-07); Alpha Bank (brand possibly absorbed in a 2024–25 merger; site did not respond).

## Official-locator checks

- **KFC** Piața Unirii 1: "KFC Unirea" (2 m). **McDonald's** Piața Unirii 1: "McDonald's Unirea" (64 m).
- **Dona** Bd. Corneliu Coposu: "Farmacia Dona - Coposu" (10 m); a second Dona: "Farmacia Dona - Hala Traian" (14 m).
- **Carrefour Express** Bd. Unirii 21: "Express Bucuresti Unirii" (20 m).
- **Not in the locator** (possibly closed, do not add until a dated photo confirms): Carrefour Express n14152468402 (v1, 2026-09-04).
- Closed per OSM lifecycle tags (vacant "De închiriat" unit if modelled): H&M n1814949000 (`disused:shop=clothes`, 44.42725, 26.10448, edit 2026-10-19), n1726032531 (`disused:shop=yes`, 44.43284, 26.11216); five more in `businesses-gamediff.json`.

## POIs added from live OSM (2026-11-12)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 241 rows (341 before; 200 in the edge strip; 34 dropped by class; 7 new in OSM / relations; 4 own building names). Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls, unnamed objects, ATMs outside the area. Street View: 104 Str. Lipscani (May 2024) has a Banca Transilvania branch, matched by the game's fascia (the real sign is a wide lettered band, the game's a small board); 13 Bd. Dimitrie Cantemir has ground-floor shop fronts where the game has a Catena fascia (name not readable in the preview).

## Speed limits on the chapter route

Romanian legal default: see `businesses-bucharest-floreasca.md`. **gts** — 1891 m, all OSM ways tagged.

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Piața Unirii | primary | 577 | 50 | 50 |
| Piața Unirii | primary | 18 | 40 | 40 |
| Piața Unirii | primary | 67 | 60 | 60 |
| Bulevardul Corneliu Coposu | secondary | 756 | 50 | 50 |
| Calea Călărașilor | secondary | 339 | 50 | 50 |
| Calea Călărașilor | secondary | 130 | RO:urban | 50 |

Mapped maxspeed=60 signs within 150 m: n6242940774 (113 m), n6225649427 (38 m). Schools within 150 m: Liceul Tehnologic Unirea (w83488919, 121 m).

## Sources

OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL; official Street View panoramas viewed for appearance only (nothing stored); locators as listed in `businesses-bucharest-floreasca.md`.
