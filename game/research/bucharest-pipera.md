# Bucharest — Pipera (Dimitrie Pompeiu) (`pipera`): research dossier

The reference for why the Pipera district looks the way it does. Facts are keyed by OSM id (w = way, n = node, r = relation);
bracketed keys point to **Sources** at the end. Git history keeps the round-by-round review notes this page replaced.

## 1. Overview and sources

- **Machine-readable twin**: `bucharest-pipera.json` (generated 2026-11-06 from the OSM API 0.6 snapshot of that day): coverage
  metrics, per-segment street data, all buildings with style-rule estimates (`buildings[]`), junctions, crossings, transit
  stops, metro entrances and liveries, colour palette, Bucharest-wide streetscape rules (`city_rules`), "things a local would
  notice" (`top_local_details`), pedestrian dialogue, building passages, road widths and the sources table. Businesses:
  `businesses-bucharest-pipera.json` (section 6); speed limits: `speedlimits.json`; measurement ledger:
  `measurements-bucharest-pipera.json` (section 7). Reference photos: `refs/pipera/` (licences in `LICENSES.md`).
- **Extraction area**: bbox `[44.4745, 26.101, 44.49, 26.124]` (world bbox of `cities.js` BUC_DISTRICTS): west edge Calea
  Floreasca / Gara Herăstrău (Sky Tower, Promenada, Floreasca Park), south edge Șos. Fabrica de Glucoză, north edge the Pipera
  industrial lots / Podul Pipera ramps, east edge Str. George Constantinescu. Playable area: 130 m either side of the two chapter
  routes (bbox 44.4704,26.0918 – 44.4830,26.1289).
- **Character**: a corporate office cluster on former factories and fields: glass towers (Globalworth Tower 118–120 m / 26
  floors, 2016; AFI Lakeview 15 lv / 65 m; Corp A/B 15 lv / 53 m; Courtyard by Marriott 14 lv / 55 m; Sky Tower 137 m at the
  SW corner), lift-gate barriers at every office car park, remnant Pipera industrial halls (JTI factory, Corp 1–20) north of
  Pompeiu, few old trees, wide new sidewalks in front of new offices and broken ones elsewhere [wp_globalworth_tower] [osm].
- **Method** (fidelity passes 2026-11-12/13): live OSM (API 0.6 `map` 2026-11-12: 19,803 nodes, 2,850 ways, 192 relations)
  decides position and kind; official street-level panoramas were looked at for appearance only (ids from coverage metadata;
  nothing stored, traced or measured). Game views: `game/dev/reality/viewpoints.json` (`pip-*`).

## 2. Chapters and CV stops

Both chapters are 2017. Starts and roads are authoritative in `cities.js` CHAPTERS.

- **luxoft** (start Șos. Petricani northbound, 44.4730, 26.1243): Petricani NB → Fabrica de Glucoză WB (Globalworth offices)
  → George Constantinescu NB → Pompeiu WB, Hermes on the right.
- **db** (start Șos. Pipera north-east-bound off Podul Barbu Văcărescu, 44.47919, 26.0963): Șos. Pipera past Sky Tower →
  right on Str. Gara Herăstrău (Floreasca Park / AFI offices) → east along Bd. Dimitrie Pompeiu (office canyon, barrier-gated
  parking entrances) to BOB Tower on the right. The south-west-bound start off Podul Pipera would need a U-turn (no left turn
  into Gara Herăstrău).

### luxoft — Luxoft — Hermes Business Campus

- Bd. Dimitrie Pompeiu 5-7, Sector 2: building HBC2, 5th floor (RIPE registry); a second Luxoft site later at Pompeiu 6
  (Novo Park E). The 2017 site is taken as Hermes (owner decision) [luxoft_careers] [luxoft_ripe].
- OSM: campus w1040373224 (landuse "Hermes"); buildings w533147567 ("Clădirea A", 9 lv) and w231123137; relation r6774709. OSM
  does not split HBC1/2/3; Hermes A and B+C each have 9 OSM levels and B+C's courtyard stays open at every tier.
- Door 44.4804, 26.1139, N side (odd numbers): barrier-gated car entrance and glazed lobby; Pipera metro (M2 terminus,
  w41337085) ≈ 200 m east.
- Campus: Atenor development, three buildings (HBC1–HBC3), ≈ 75,200 m² offices, phase 1 started 2011, completed end-2016; HBC3
  leased to Genpact (22,000 m²); sold to Adventum 2021. Contemporary 9–10-storey blocks, white / light-grey panels (#E3E4E1)
  with horizontal bands and blue-grey glazing (#6D8796), landscaped plaza between the buildings. Campus facts high, facade
  medium–low [hermes_atenor] [hermes_sale_2021] [hermes_adventum] [hermes_owner].

### db — DB Global Technology — BOB Tower (w55450549)

- Bd. Dimitrie Pompeiu 6A, Sector 2; OSM w55450549 ("BOB Tower"; office node n12252625817 inside). Door 44.47995, 26.11462,
  S side (even numbers), opposite Hermes; Upground towers (w41506373) and Globalworth Campus next door east / south.
- Globalworth BOB (Bucharest Office Building), delivered 2008, GF + 6 floors (Globalworth particulars); metre height ≈ 28 m is
  an estimate. Mid-rise glass office, blue-green curtain wall #6F8C99 with grey spandrels (floors / year high, facade medium)
  [bob_globalworth] [db_careers] [db_hq_2015].
- History: DB Global Technology opened in 2014 and was already on Bd. Dimitrie Pompeiu in 2015 (2 floors, 6,000+ m²); it was
  never in Floreasca Park / Calea Floreasca 169A per available sources, so the stop belongs to Pipera, not Floreasca.
- Which of the two buildings in the frame at 44.4797, 26.1150 h 156 is BOB was not established on the panorama.

## 3. Streets and traffic

- **Bd. Dimitrie Pompeiu**: despite "Bulevard" a narrow 1+1 street (≈ 7–8 m) with a 581 m one-way single-lane section
  (w1040373748) and frequent office driveways with lift-gate barriers; 50 km/h; buses 416, 459 only; sidewalks 2–3 m. Frontage
  N: Hermes (5-7), Nova Building (w50535003, 9 lv, 2008), Santo Raphael clinic; S: Courtyard by Marriott (w764534288, 2A,
  2019), Novo Park A–G (5–14 lv), BOB Tower, Upground; Pipera metro at the east end. A 105 M€ widening / tram project (4 lanes,
  or 2 + double tram + bike lanes, target 2028) is planned; the game models today's narrow street [pompeiu_project]
  [pompeiu_105m] [pipera_capital].
- **Șos. Fabrica de Glucoză**: one-way pairs of 2–4 lanes with turn pockets, signed 40 km/h; buses 343, 449, 459, 461; tram 5
  loop near Barbu Văcărescu. Globalworth Tower (w547396774, Calea Floreasca 201, 27 lv / 120 m) and Campus; 12-storey 2021
  residential blocks Bl. 1–4 (w1132411167–70) on the S side; Novo Park on the N side.
- **Șos. Pipera**: one-way pairs of 2–3 lanes (secondary, 50 km/h) between Floreasca Park and the Pipera bridge; buses 112,
  135, 343, 416, 449, 459.
- **Str. Gara Herăstrău**: two-way tertiary, Corp A/B towers, Globalworth Square (w766842568, 15 lv / 78 m, 2021), Nusco Tower
  (w236041902, 20 lv / 80 m, 2010), Floreasca Park entrance.
- **Str. George Constantinescu**: two-way 1+1 office street; Medicover, Ted's Coffee, A•R•C Bakery; MG 2 (w334223277, 7 lv),
  Globalworth Campus B (w725165285, 13 lv, 2018).
- **Str. Barbu Văcărescu**: dual carriageway, 2–3 lanes each way, tram 5 on a central reservation (the only tram here; none on
  Pompeiu); AFI Lakeview, Raiffeisen HQ, DHL.
- **Calea Floreasca** north end at Promenada / Sky Tower: 2+2 with turn pockets. A hedge and jersey-barrier median is seen in
  front of Promenada but not mapped (no `barrier=hedge` / `jersey_barrier`; the carriageways alternate between one 4-lane way
  and one-way pairs), so it has no line and is not drawn.
- **Speed limits on the routes** (OSM maxspeed = game km/h): luxoft: Șos. Petricani 60 / 40 / 50, Str. Petricani 40, Fabrica de
  Glucoză 40, George Constantinescu 50, Pompeiu 50; db: Șos. Pipera 50, Gara Herăstrău 50, Pompeiu 50. Schools within 150 m:
  Colegiul Tehnic "Edmond Nicolau" (w23732187, 72 m), Liceul Tehnologic "Constantin Brâncuși" (w256525667, 62 m). Romanian
  rule: 50 km/h in localities unless signed, signed range 30–80; no automatic school-zone limit [speed_ro].
- **Congestion hotspots** (feed `congestion`; city: ≈ 62.5 % congestion, 171 h lost per driver in 2025, worst slot Wednesday
  17–18 [tomtom_2025] [tomtom_2025b]): Bd. Dimitrie Pompeiu (44.4802, 26.114, r 300 m, 8–10:30 and 16:30–20, level 0.95;
  "paralysed for hours" as thousands of employees leave, parking barriers block lanes) [pipera_protv] [pipera_adevarul];
  Barbu Văcărescu × Fabrica de Glucoză under Sky Tower (44.4775, 26.1045, r 220 m, 8–10 and 16:30–19:30, 0.85)
  [pipera_capital] [tomtom_peak]; Șos. Pipera / Podul Pipera (44.484, 26.114, r 200 m, 7:30–10 and 17–20, 0.75)
  [pompeiu_105m].

## 4. Structures

- **Podul Barbu Văcărescu** (w119926495, bridge, layer 1, 4 lanes): overpass from Șos. Pipera over Str. Șerbănescu and the tram
  loop, side roads at grade on both sides; CFR line 800 (w1221367953 …) at grade beneath. Panorama 44.479661, 26.100612 h 253:
  low concrete kerb with galvanised posts and mesh panels, transparent noise screens on posts to ≈ 3 m above the mesh on the
  north edge, single-arm lamps on both deck edges. Drawn: guard class `kerb-mesh` with the north screen frames
  (`bridge-guards.js`); lamps in the guard line of both edges about every 30 m wherever the deck is ≥ 2 m up (44 lamps,
  `deck-lamps.js`). OSM maps no `street_lamp` on the deck.
- **Strada Petricani bridge over the Colentina** (w8208289, layer 1; outline w902027552; cycle bridge w902027549): level road
  bridge between Lacul Tei and Lacul Plumbuita. Panoramas 44.474233, 26.124001 h 7 / 95 / 275: W-beam guard rails at both
  carriageway edges, yellow steel picket railing at the east sidewalk edge, water some metres below on the east; on the west a
  gravel / green strip, no water visible. Drawn: W-beam guards and the yellow railing (`bridge-guards.js`,
  `water-bridge-railings.js`). Settled: the "weir" w1507038443 is a small `natural=water`, `water=weir` polygon at 44.4705,
  26.1230, ≈ 420 m south of the bridge, not a line across the lake; not seen on a panorama, not drawn. The tram reserve west of
  the bridge carries the tram bridges w23583767 / w902027550 (`railway=construction`, STB extension, opening_date 2027):
  construction railways are not drawn until OSM maps them open. Open (backlog pipera-2): the lake water is drawn at street level
  and the lake polygon w117140691 is a coarse 2006 CORINE import with measured crowns inside it.
- **Metro pedestrian tunnels** w739789922–24 (Aurel Vlaicu) and w739791318 / 19 (Pipera): `layer=-1` footways under the street;
  all five entrance nodes lie inside mapped buildings (drawn as those buildings), so nothing shows at street level.
- **Promenada car-park tunnels** (w764616770/1, w467560865, w467560480/1, w467560867, layer −1): service roads flagged tunnel.
- **Covered forecourt lanes**: w668515452 (Petrom), w668523278 (Lukoil), w1284446130: reviewed covered roads.
- **Building passages** (`tunnel=building_passage`) w1566299306 / 09 / 12 / 15 / 19, w48272349, w1339943929 (Șos. Fabrica de
  Glucoză blocks): in `buildingPassages`; not compared at street level.
- **Service passage** w350999211 is `maxheight=2`: the player's car (2.14 m model height) does not fit.

## 5. Landmarks, monuments and tourist features

- **Sky Tower** (`skytower`, w219622660): tagged 137 m / 37 levels / flat roof and colour have priority [skytower_owner].
  Reads correctly behind Promenada (pose 44.4787, 26.1065 h 249).
- **Globalworth Tower** (`globalworth`, pose 44.479318, 26.103249 h 263): white-framed glazed podium, grey-blue shaft.
- **Hermes** (`hermes`, pose 44.48056, 26.115007 h 308): striped glass offices; the real view is mostly hidden by trees.
- **BOB** (`bob`): section 2.
- **Promenada Mall** (`promenada`, w240694437, 3 levels / 18 m): Calea Floreasca front (pose 44.477617, 26.102507 h 48) with
  white walls without a window row, a black tenant band at the north end (Douglas, Hervis, Zara, C&A, H&M: OSM shop nodes inside
  the mall), Starbucks under it (n4833254421, level 0), the glazed entrance hall south of it, the mall's name and colour bars;
  positions along the wall estimated to a few metres. East (Barbu Văcărescu) front, pano 44.478431, 26.104866 h 255: white
  cladding, dark glazed band, rounded corners, curved roof edge, a large LED screen and flagpoles on a paved forecourt; the
  glazed band, screen and curved edge are not modelled (open: backlog r3-landmarks-8).
- **Pipera metro** (M2 terminus, w41337085): low pavilion with the blue M sign at the east end of Pompeiu; entrances at 44.48078,
  26.11660 and 44.48073, 26.11639.
- **Courtyard by Marriott** (w764534288; pose `pip-courtyard` 44.478444, 26.106966 h 163): dark anthracite glass tower and a
  mirrored podium behind a lawn; the game's glass reads more saturated.
- **Muzeul Național al Aviației Române** (w392466489): the 23 mapped `historic=aircraft` outlines are aircraft exhibits (not
  houses), drawn by the aircraft class at their planforms (`building-aircraft.js`); vertical body / fin / clearance detail is
  estimated and their silhouettes are excluded from roof-class claims. Three exhibits mapped only as points (IAK-52
  n13340068830, L-29 n13340068854, Yak-23 n13340068855) have no planform and are not drawn. From Bd. Dimitrie Pompeiu (pose
  `pip-aviation-museum` 44.479143, 26.110517 h 163) a 2 m concrete panel fence with graffiti and a tree belt hide the grounds:
  the fence is drawn (section 8), the graffiti and the tree belt are not.
- **Monumentul Soldatului Sovietic** (n1174026151, `historic=monument`, no form tags) in park w23731459: the nearest official
  panorama on Șos. Pipera (44.479208, 26.097410 h 185, 44 m) shows a ≈ 1.1 m red-brick wall with a cap along the pavement, a
  lawn, trees and rows of white grave markers (cemetery w28379658); the monument is hidden by trees from both poses. Drawn as a
  generic `monument` (`monuments.js`); the wall is drawn (section 8).
- **Clubul Sportiv Năstase & Marica** (w23731450): clay courts w885503360 / 61 / 62 / 71 / 73 / 74, pool w1284446111 and the
  stadium pitch w885503357 / w47422913 at their OSM positions (no public panorama inside the club). The clay courts at
  44.47793, 26.09902 and 44.47814, 26.10046 are hidden behind houses from every panorama.
- **Water**: Lacul Tei w117140691 and Lacul Plumbuita r11546654 (section 4); pond w1423621338.

## 6. Buildings, businesses and fuel

Business research (2026-11-07): zone = within 60 m of a chapter route plus recognisable businesses within 50 m of a main
street in the district mask; standalone ATMs, parcel lockers, chargers and pure company offices left out. Confidence: high =
official locator match or OSM `check_date` ≥ 2025-05; medium = OSM element edited / checked since 2023-11; low = older.
POIs: `tools/osm/add-pois.mjs` (live OSM 2026-11-12, `--edge 100`) appended 61 rows to the original 260.

- **Added from official locators** (not in OSM in the zone): Carrefour Express "Express Green Court" (Str. Gara Herăstrău 4C),
  Kaufland "Kaufland Bucuresti Fabrica de Glucoza" (Str. Fabrica de Glucoză 6-8), KFC Promenada and McDonald's Promenada Mall
  (Calea Floreasca 246B). Carrefour Market Șos. Pipera 61 matches "Market Cloud 9 Residence" (79 m) [locators].
- **Garanti BBVA**: OSM `brand=Garanti Bankası` (Turkish parent); Romanian branches are signed "Garanti BBVA"
  (garantibbva.ro, 2026-11-07).
- **Lukoil**: its international assets (incl. Romanian stations) were offered for sale in Nov 2025 (Wikipedia "Lukoil"); the
  station brand may change.
- **Kaufland** (w1198250017, store mapped as one point deep inside the footprint): the sign goes on the east face toward its
  own car park; from Str. Marin Preda the real wall is a blank service wall. From Șos. Fabrica de Glucoză (`pip-kaufland`,
  44.478452, 26.122228 h 149) the store is a low box far behind its car park, with a concrete barrier in the middle of the road;
  store front not compared.
- **Pedestrian fronts**: four businesses on the mapped pedestrian way w1568673179 (Pizzeria Geniale x Vice Cream, Plantini,
  Pasta del Popolo, BigBoys Barbershop) sign their own buildings (shop + sign flags); World Class on w1472893992 is in the
  scenery ring (no signs there by rule).
- **Interior units**: about 60 shops inside Promenada on levels −1 / 1 / 2 have no street sign (only the tenant band);
  `add-pois.mjs` keeps nodes deep inside multi-tenant halls out. Pasta Bar n5868977715 is `shop=vacant`.
- Floreasca Tower (169 Calea Floreasca): glass office tower; no tenant name dominates the facade at street level.
- **Petrom Șos. Pipera** (w241976323): long yellow fascia, blue square-clad columns, white soffit, yellow / blue / red shop front;
  no pylon on the Șos. Pipera frontage nor at the west end (panoramas zLWCouEoyC82uJ90Q-pXdA h356, zy0-QE4qE154VeHmviOP0A h49 /
  h250), so none is drawn (`fuel-look.js` `pylon: 'none'`). About four pump islands seen, two drawn by the generic forecourt
  model; the shop under the canopy is not modelled.
- **Lukoil Str. Căpitan Aviator Șerbănescu** (w547396767): red fascia with white LUKOIL letters, red / white columns,
  minimarket beside it (VrpS5Xl6H0bPq1iUAjN4-w h342); white pylon with a red head at the north-east entrance
  (WAU_Ey5duTIjThXrwFsqcA h218), placed there; three islands drawn. `GPL Lukoil Aviației` n2437135667 is an LPG POI without a
  canopy or pylon. Both canopies carry the brand fascia colour and name on their two longest faces.
- **Reaching the stations**: all three stand on Șos. Pipera westbound, whose only inflows inside the district come from the map
  ends or through passage w350999211. From the luxoft start no legal route reaches them, from the db start one does; the Gas
  stations list offers a station only when a route reaches it (`main.js` `stationOffered`).

Key buildings:

| OSM | Name | Storeys / height | Facade | Era |
|---|---|---|---|---|
| w764534288 | Courtyard by Marriott Bucharest Floreasca | 14 / 55 | dark glass | 2019 |
| w533147567 | Hermes Business Campus, Clădirea A (Luxoft, HBC2) | 9 / 36 | #E3E4E1 panels + glazing, flat roof | 2011–2016 |
| w55450549 | BOB Tower (DB Global Technology) | 7 / 28 | #6F8C99 glass curtain wall, flat roof | 2008 |
| w237911115 | AFI Lakeview | 15 / 65 | glass | |

## 7. Measurements, trees and green

Independent full-ring measurements (2026-11-08; ledger `measurements-bucharest-pipera.json`):

- Fresh OSM API 0.6 tiles cover the analytic core and a complete 600 m ring of intersecting sources; every source ID is audited
  directly, including small structures, parts and courtyard relations (all 2,282 source records retained).
- Esri World Imagery 44.465–44.490 N / 26.084–26.141 E, zoom 18 (≈ 0.426 m/pixel, 1,161 tiles; acquisition date unknown,
  accessed 2026-11-08). Roof calibration: 80 random samples and 12 key structures; 2,266 source roof records (uncertain
  classes kept); roof rise / direction and metre heights are not measured. Canopy: 47,585 crown centres / radii over the whole
  mosaic; untagged heights and species are estimates. Green ground uses the same mosaic.
- All 9 `building=roof` records were reviewed with explicit open-roof metadata and estimated vertical dimensions; the two station
  canopies also have mapped covered access (section 4). No fuel station is invented on free ground.
- Very few old trees; young planted trees in office plazas. Invented trees are never placed over the measured canopy (so the
  aviation museum's tree belt, absent from the survey, is not added).

## 8. Documented exceptions to OSM

- **Soviet Soldier park wall** (`park-walls.js`): ≈ 1.1 m red-brick wall with a cap (panorama above). OSM maps no barrier; the
  line is the north edge of park w23731459 (n257012533 → n11871379035, 156 m), open at the mapped swing gates n311736694 /
  n311737019 where footway w28379731 enters.
- **Aviation museum fence** (`park-walls.js`): 2 m concrete panel fence along the grounds' boulevard edge (n696844080 →
  n4161774631 → n4161774633, 238 m); no mapped barrier.

## 9. Estimates and open questions

- Park wall: opening 3.2 m, thickness 0.3 m, cap colour. Museum fence: height and post pitch.
- Deck lamps on Podul Barbu Văcărescu: spacing 30 m and height 8 m.
- Soviet Soldier monument: form and size (hidden by trees).
- Aircraft exhibits: vertical dimensions; the three point-only aircraft (size unknown, not drawn).
- BOB metre height (≈ 28 m from GF + 6); which building in the panorama is BOB.
- Promenada tenant-band positions; the Calea Floreasca median (unmapped).
- Petrom pump islands (≈ 4 seen, 2 drawn); reviewed pylon places ±10 m (`fuel-stations-review.json`).
- Uncompared: entrance buildings of the metro tunnels, the building passages, the clay courts, Kaufland's store front, the
  Kaufland median barrier on Fabrica de Glucoză.
- Pompeiu widening works status; HBC1/2/3 footprints not split in OSM.

## 10. Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 tiles 2026-11-06 and 2026-11-08; live API 2026-11-12/13) |
| luxoft_careers | https://career.luxoft.com/locations/romania |
| luxoft_ripe | https://ripe.net/membership/indices/data/ro.lux.html |
| hermes_atenor | https://atenor.eu/en/?p=19339 |
| hermes_sale_2021 | https://www.atenor.eu/wp-content/uploads/2021/05/2021-Vente-HBC-EN-2.pdf |
| hermes_financing_2020 | https://www.atenor.eu/wp-content/uploads/2020/08/2020-HBC-financement-EN-1.pdf |
| hermes_adventum | https://eurobuildcee.com/en/news/31229-adventum-purchases-hermes-business-campus |
| hermes_owner | https://adventum.eu/asset/hermes-business-campus/ |
| bob_globalworth | https://www.globalworth.com/wp-content/uploads/2021/01/BOB-particulars.pdf |
| db_careers | https://careers.db.com/explore-the-bank/locations/emea/romania |
| db_hq_2015 | https://www.romania-insider.com/deutsche-banks-technology-center-in-bucharest-reached-300-employees-plans-to-add-200-more |
| skytower_owner | https://www.skytower.ro/ |
| wp_globalworth_tower | https://en.wikipedia.org/wiki/Globalworth_Tower |
| pompeiu_project | https://www.ziarulprofit.ro/bulevardul-dimitrie-pompeiu-din-zona-pipera-se-transforma-complet-cum-se-transforma-una-dintre-cele-mai-aglomerate-artere-din-bucuresti/ |
| pompeiu_105m | https://www.g4media.ro/primarul-interimar-al-capitalei-anunta-o-investitie-de-105-milioane-de-euro-pentru-deblocarea-traficului-din-zona-dimitrie-pompeiu-a-fost-finalizat-studiul-de-fezabilitate-iar-dupa-aprobarea-in-con.html |
| pipera_adevarul | https://adevarul.ro/economie/pipera-dragostea-mea-866424.html |
| pipera_protv | https://stirileprotv.ro/exclusiv/stirile-tale/epopeea-traficului-din-bucuresti-partea-a-ii-a.html |
| pipera_capital | https://www.capital.ro/investitie-pentru-fluidizarea-traficului-in-nordul-capitalei-se-construieste-o-noua-sosea-in-zona-dimitrie-pompeiu.html |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |
| speed_ro | https://en.wikipedia.org/wiki/Speed_limits_in_Romania (fetched 2026-11-07; legislatie.just.ro did not respond) |
| locators | McDonald's https://mcdonalds.ro/restaurante, KFC https://kfc.ro/restaurante, Kaufland https://www.kaufland.ro/.klstorefinder.json, Carrefour https://carrefour.ro/corporate/magazine, Dona https://www.dona.ro/farmacii (all 2026-11-07). Not machine-readable then: Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen, Lidl, Penny, Catena, BT, BCR, ING, Orange, Vodafone, Petrom, OMV, MOL, Rompetrol, Lukoil, OTP, Alpha Bank, Digi, Telekom: these rely on OSM edit / check dates |

The remaining keys cited inside `bucharest-pipera.json` resolve in its `meta.sources`.
