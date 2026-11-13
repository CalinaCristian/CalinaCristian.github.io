# Bucharest — Pipera (Dimitrie Pompeiu) (`pipera`): field research dossier

Role: research-buc-districts · generated 2026-11-06 23:08 UTC · machine-readable twin: `bucharest-pipera.json` · images: `refs/pipera/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Dimitrie Pompeiu, Calea Floreasca, Strada Gara Herăstrău, Strada George Constantinescu, Șoseaua Fabrica de Glucoză, Șoseaua Pipera |
| route_streets_researched | Bulevardul Dimitrie Pompeiu, Calea Floreasca, Strada Gara Herăstrău, Strada George Constantinescu, Șoseaua Fabrica de Glucoză, Șoseaua Pipera |
| fronting_route_buildings | 39 |
| fronting_route_with_height | 53.8 |
| fronting_route_with_colour | 5.1 |
| fronting_route_researched | 7.7 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 59.0 |
| fronting_main_buildings | 103 |
| fronting_main_with_height | 66.0 |
| buildings_total | 473 |
| buildings_with_height | 46.1 |
| businesses_total | 346 |
| businesses_on_route | 40 |
| businesses_branded | 80 |
| trees_osm | 2 |
| lamps_osm | 3 |
| crossings | 199 |
| signal_nodes | 26 |
| transit_stops | 46 |
| metro_entrances | 2 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.4745, 26.101], [44.49, 26.101], [44.49, 26.124], [44.4745, 26.124]]` → bbox `[44.4745, 26.101, 44.49, 26.124]`, area **3.147 km²**.
- Why: Extraction area = world agent bbox from cities.js BUC_DISTRICTS (so every street the world builds is covered). 1.11 km N-S × 1.47 km E-W ≈ 1.6 km² trimmed to ~1.3 km² of built area: west edge Calea Floreasca/Gara Herăstrău (Sky Tower, Promenada, Floreasca Park just inside the NW corner), south edge Șos. Fabrica de Glucoză, north edge the Pipera industrial lots / Podul Pipera ramps, east edge Str. George Constantinescu / Conect offices. Contains Hermes Business Campus (luxoft), BOB Tower (DB Global Technology), Novo Park, Globalworth Campus, Pipera metro (M2 terminus).
- Research-proposed compact ~1 km² polygon (optional tighter cut): `[[44.4745, 26.103], [44.4845, 26.103], [44.4845, 26.1215], [44.4745, 26.1215]]`

## Chapter routes

### luxoft · 2017 — Luxoft — Hermes Business Campus

- **Start**: WORLD START: Barbu Văcărescu north-east-bound — `44.475539, 26.10716`, heading 84° on Șoseaua Fabrica de Glucoză.
- **End**: Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7 (north side) — `44.48017, 26.113727`.
- **Length**: 1302 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Start at the Barbu Văcărescu × Calea Floreasca junction under Sky Tower → east on Șos. Fabrica de Glucoză (tram 5 terminus area, Globalworth Tower/Campus, Novo Park on the left) → north on Str. George Constantinescu (Medicover, MG offices) → west a block on Bd. Dimitrie Pompeiu to the Hermes Business Campus (Pipera metro M2 terminus just east).
- **Sequence**: Șoseaua Fabrica de Glucoză (825 m) → Strada George Constantinescu (345 m) → Bulevardul Dimitrie Pompeiu (133 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4752, "lon": 26.1032, "road": "Barbu Văcărescu", "bearing": 40}, {"lat": 44.479, "lon": 26.116, "road": "George Constantinescu", "bearing": 0}, {"lat": 44.4806, "lon": 26.1135, "road": "Pompeiu"}]`

### db · 2017 — DB Global Technology — BOB Tower, Bd. Dimitrie Pompeiu 6A

- **Start**: Calea Floreasca northbound at Promenada / Sky Tower — `44.477552, 26.102661`, heading 339° on Calea Floreasca.
- **End**: BOB Tower (DB Global Technology), Pompeiu 6A (south side) — `44.48017, 26.113727`.
- **Length**: 1401 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: From Calea Floreasca at Promenada/Sky Tower → Șos. Fabrica de Glucoză → north on Str. Gara Herăstrău past Floreasca Park/AFI offices → east along narrow two-lane Bd. Dimitrie Pompeiu (office canyon, barrier-gated parking entrances) to BOB Tower (DB Global Technology) on the south side opposite Hermes.
- **Sequence**: Calea Floreasca (268 m) → Șoseaua Pipera (149 m) → Strada Gara Herăstrău (316 m) → Bulevardul Dimitrie Pompeiu (667 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4778, "lon": 26.1036, "road": "Calea Floreasca", "bearing": 0}, {"lat": 44.48, "lon": 26.108, "road": "Pompeiu", "bearing": 90}, {"lat": 44.48, "lon": 26.1146, "road": "Pompeiu"}]`

## CV stops (verified)

### luxoft — Luxoft — Hermes Business Campus

- **address**: Bd. Dimitrie Pompeiu 5-7, Sector 2 — building HBC2, 5th floor (RIPE registry); second Luxoft site later at Pompeiu 6 (Novo Park E)
- **building_osm**: campus w1040373224 (landuse "Hermes"); buildings w533147567 ("Clădirea A", 9 lv) + w231123137 (unnamed) — OSM does not split HBC1/2/3
- **lat**: 44.48073
- **lon**: 26.11388
- **door**: lat: 44.4804; lon: 26.1139; street: Bulevardul Dimitrie Pompeiu; side: N side (odd numbers); barrier-gated car entrance + glazed lobby; note: Pipera metro (M2 terminus, w41337085) ~200 m east
- **building**: campus: Atenor development, 3 buildings (HBC1–HBC3), ≈75,200 m² offices, phase 1 started 2011, completed end-2016; HBC3 leased to Genpact (22,000 m²); sold to Adventum 2021; facade: contemporary office blocks ~9–10 storeys: white/light-grey panels with horizontal bands and blue-grey glazing, landscaped plaza between buildings; facade_hex: #E3E4E1; glass_hex: #6D8796; conf: campus facts high; facade medium–low [luxoft_careers] [luxoft_ripe] [hermes_atenor] [hermes_sale_2021] [hermes_adventum] [osm]
- **cities_js_check**: cities.js luxoft {44.4855, 26.1165} is ~500 m NORTH of Hermes (it lands in the old Pipera industrial lots). Use {44.4805, 26.1139}.

### db — DB Global Technology (Deutsche Bank) — BOB Tower

- **address**: Bd. Dimitrie Pompeiu 6A, Sector 2
- **building_osm**: w55450549 ("BOB Tower"; the OSM office node n12252625817 lies inside it)
- **lat**: 44.47969
- **lon**: 26.11461
- **door**: lat: 44.47995; lon: 26.11462; street: Bulevardul Dimitrie Pompeiu; side: S side (even numbers), opposite Hermes; note: Upground towers (w41506373) and Globalworth Campus next door to the east/south
- **building**: name: Globalworth BOB (Bucharest Office Building); delivered: 2008; floors: GF + 6; facade: mid-rise glass office (blue-green curtain wall with grey spandrels); facade_hex: #6F8C99; conf: floors/year high (Globalworth sheet); facade medium [bob_globalworth] [db_careers] [db_hq_2015] [osm]
- **history**: DB Global Technology opened in 2014 and was already headquartered on Bd. Dimitrie Pompeiu in 2015 (2 floors, 6,000+ m²); it has never been in Floreasca Park/Calea Floreasca 169A per available sources.
- **cities_js_check**: cities.js db {44.4760, 26.1030} (Floreasca district, "Calea Floreasca 169A") is wrong: move the stop to pipera {44.4799, 26.1146}.

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Șoseaua Fabrica de Glucoză (chapter route)

- OSM: 21 ways, 3394 m in district, classes primary, secondary; lanes values ['2', '3', '4']; one-way segments 21/21; maxspeed ['40']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 343, bus 449, bus 459, bus 461, bus 1929.
- OSM furniture: {'gate': 2, 'bicycle_rental': 1, 'bicycle_parking': 2, 'lift_gate': 5}.
- Fronting buildings: 41; businesses: 12.
- **cross_section**: one-way pairs 2–4 lanes with turn pockets; 40 km/h signed (OSM maxspeed 40); buses 343, 449, 459, 461; tram 5 loop/terminus near Barbu Văcărescu
- **frontage**: Globalworth Tower (118–120 m, 26 floors, 2016) and Globalworth Campus; 12-storey new residential blocks (Bl. 1–4) on the S side; Novo Park on the N side
- confidence: high (OSM, Wikipedia) [osm] [wp_globalworth_tower]

### Șoseaua Pipera (chapter route)

- OSM: 28 ways, 2952 m in district, classes residential, secondary, secondary_link; lanes values ['1', '2', '3', '4']; one-way segments 25/28; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 112, bus 135, bus 343, bus 416, bus 449, bus 459.
- OSM furniture: {'lift_gate': 8, 'parking_entrance': 2}.
- Fronting buildings: 18; businesses: 18.
- **cross_section**: one-way pairs 2–3 lanes (secondary, 50 km/h) between Floreasca Park and the Pipera bridge; buses 112, 135, 343, 416, 449, 459; Floreasca Park office campus (Oracle, AFI) on the W side, rail line and Gara Herăstrău nearby
- confidence: high (OSM) [osm]

### Bulevardul Dimitrie Pompeiu (chapter route)

- OSM: 9 ways, 1561 m in district, classes tertiary; lanes values ['1', '2']; one-way segments 2/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 416, bus 459.
- OSM furniture: {'gate': 4, 'parking_entrance': 1, 'bicycle_parking': 2, 'lift_gate': 8}.
- Fronting buildings: 20; businesses: 28.
- **cross_section**: despite "Bulevard" it is a narrow 2-lane (1+1) street (≈7–8 m) with a 581 m one-way single-lane section (OSM w1040373748) and frequent office driveways with lift-gate barriers; 50 km/h; buses 416, 459 only; sidewalks 2–3 m, new paving in front of offices, broken elsewhere; a 105 M€ widening/tram project (4 lanes or 2 + double tram + bike lanes, target 2028) is planned — model today's narrow street
- **frontage**: office canyon: N: Hermes Business Campus (5-7), Nova Building (9 lv), Santo Raphael clinic; S: Courtyard by Marriott (14 lv, 55 m), Novo Park A–G (5–14 lv), BOB Tower (6A), Upground towers; Pipera metro terminus (M2) at the east end; Euronet ATMs, cafes (ibrik), bakeries
- confidence: lanes high (OSM); project status medium [osm] [pompeiu_project] [pompeiu_105m] [pipera_capital]

### Calea Floreasca (chapter route)

- OSM: 24 ways, 1000 m in district, classes living_street, secondary; lanes values ['2', '4']; one-way segments 14/24; maxspeed ['10', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 135, bus 343, bus 449, bus 459, bus 461.
- OSM furniture: {'gate': 3, 'parking_entrance': 2}.
- Fronting buildings: 8; businesses: 24.
- **cross_section**: north end at Promenada/Sky Tower: 2+2 with turn pockets
- confidence:  [osm]

### Strada Gara Herăstrău (chapter route)

- OSM: 4 ways, 620 m in district, classes tertiary; lanes values ['2']; one-way segments 0/4; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 416, bus 459.
- OSM furniture: {'lift_gate': 3, 'charging_station': 1, 'parking_entrance': 1}.
- Fronting buildings: 7; businesses: 5.
- **cross_section**: two-way tertiary; Corp A/B (15 lv, 53 m) towers, Floreasca Park office park entrance
- confidence: high (OSM) [osm]

### Strada George Constantinescu (chapter route)

- OSM: 3 ways, 345 m in district, classes tertiary; lanes values ['2']; one-way segments 0/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'bicycle_parking': 1, 'lift_gate': 3, 'charging_station': 3, 'vending_machine': 1}.
- Fronting buildings: 5; businesses: 8.
- **cross_section**: two-way 1+1 office street; Medicover, Ted's Coffee, A•R•C Bakery; MG 2, Globalworth Campus B (13 lv)
- confidence: high (OSM) [osm]

### Strada Câmpul Pipera

- OSM: 6 ways, 1615 m in district, classes residential; lanes values ['2']; one-way segments 2/6; maxspeed ['50', 'RO:urban']; surface ['asphalt', 'concrete']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 343.
- Fronting buildings: 11; businesses: 1.

### Strada Barbu Văcărescu

- OSM: 9 ways, 1572 m in district, classes primary; lanes values ['2', '3', '4']; one-way segments 9/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 330, bus 449, bus 461, bus 1929, tram 5.
- OSM furniture: {'parking_entrance': 1}.
- Fronting buildings: 8; businesses: 10.
- **cross_section**: dual carriageway 2–3 lanes each way with tram 5 on a central reservation; 50 km/h; offices AFI Lakeview (15 lv, 65 m), Zone 313, FCC, Raiffeisen Bank HQ, DHL
- confidence: high (OSM) [osm]

### Bulevardul Pipera

- OSM: 10 ways, 716 m in district, classes secondary; lanes values ['2', '4']; one-way segments 7/10; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 343, bus 416, bus 449, bus 459.
- OSM furniture: {'lift_gate': 2, 'gate': 1}.
- Fronting buildings: 8; businesses: 1.

### Podul Pipera

- OSM: 1 ways, 472 m in district, classes secondary; lanes values ['4']; one-way segments 0/1; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 343, bus 416, bus 449, bus 459.
- Fronting buildings: 7; businesses: 0.

### Podul Barbu Văcărescu

- OSM: 1 ways, 447 m in district, classes secondary; lanes values ['4']; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 1.

### Strada Marin Preda

- OSM: 1 ways, 435 m in district, classes residential; lanes values ['2']; one-way segments 0/1; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'lift_gate': 2, 'parking_entrance': 2}.
- Fronting buildings: 9; businesses: 2.

### Aleea New York

- OSM: 1 ways, 295 m in district, classes service; lanes values []; one-way segments 0/1; maxspeed ['10']; surface ['paved']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

## Squares, junctions, landmarks

- **Barbu Văcărescu × Calea Floreasca × Fabrica de Glucoză** — large signalised junction under Sky Tower, tram 5;  [osm]
- **Dimitrie Pompeiu × Șos. Pipera / metro** — signalised, bus terminus, heavy pedestrian flow;  [osm]
- **Hermes Business Campus** (`hermes`, w1040373224) — 3 office buildings around a plaza; Luxoft (HBC2), Genpact (HBC3) [hermes_atenor] [hermes_sale_2021]
- **Globalworth Tower** (`globalworth_tower`, ) — 118–120 m, 26 floors (2016), glass tower on Barbu Văcărescu/Fabrica de Glucoză — skyline marker [wp_globalworth_tower]
- **Sky Tower** (`skytower`, w219622660) — 137 m, at the SW corner of the district (Barbu Văcărescu × Calea Floreasca)
- **Pipera metro (M2 terminus)** (`pipera_metro`, w41337085) — low pavilion with blue M sign at the east end of Pompeiu; buses/taxis queue [osm]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|
| n7684747704 | Intrarea Chefalului × Șoseaua Fabrica de Glucoză | yes |  | 3 |
| n1450415444 | Strada Gara Herăstrău × Șoseaua Pipera | yes |  | 4 |
| n255387694 | Bulevardul Dimitrie Pompeiu × Strada Gara Herăstrău |  |  | 1 |
| n1450415450 | Calea Floreasca × Șoseaua Pipera | yes |  | 6 |
| n2128199316 | Strada Barbu Văcărescu × Strada Căpitan Aviator Alexandru Șerbănescu × Șoseaua Pipera | yes |  | 10 |
| n3413363629 | Bulevardul Dimitrie Pompeiu × Strada George Constantinescu |  |  | 2 |
| n11396319606 | Strada George Constantinescu × Șoseaua Fabrica de Glucoză | yes |  | 3 |
| n7684747707 | Anton Holban × Șoseaua Fabrica de Glucoză |  |  | 4 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w764534288 | Courtyard by Marriott Bucharest Floreasca | 14 / 55 |   |  |  |  [osm] |
| w533147567 | Hermes Business Campus (Luxoft, HBC2) | 9 / 36 | #E3E4E1 panels + glazing | flat | 2011–2016 | luxoft [hermes_atenor] [osm] |
| w55450549 | BOB Tower (DB Global Technology) | 7 / 28 | #6F8C99 glass curtain wall | flat | 2008 | db [bob_globalworth] [osm] |
| w237911115 | AFI Lakeview | 15 / 65 |  glass |  |  |  [osm] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w764534288 | Bulevardul Dimitrie Pompeiu | S | 2A | hotel · Courtyard by Marriott Bucharest | 14 | 55 | 2019 |  | modern office/glass curtain wall | #6F8C99 est | 2 |
| w1104992266 | Bulevardul Dimitrie Pompeiu | S |  | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) |  | 0 |
| w50535003 | Bulevardul Dimitrie Pompeiu | N | 2-4 | office · Nova Building | 9 |  | 2008 |  | modern office/glass curtain wall | #6F8C99 est | 0 |
| w256525668 | Bulevardul Dimitrie Pompeiu | N |  | university | 12.0 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w51572143 | Bulevardul Dimitrie Pompeiu | N |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w231123134 | Bulevardul Dimitrie Pompeiu | N |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w231123140 | Bulevardul Dimitrie Pompeiu | N |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w231123135 | Bulevardul Dimitrie Pompeiu | N |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w334235184 | Bulevardul Dimitrie Pompeiu | SE |  | yes · Clădirea D | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w51571117 | Bulevardul Dimitrie Pompeiu | N |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 1 |
| w55450675 | Bulevardul Dimitrie Pompeiu | SE |  | yes · Clădirea B+C | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w231123131 | Bulevardul Dimitrie Pompeiu | NW |  | yes · Centrul naturist de sănătate Santo Raphael | 2 est |  |  |  | unknown (use district rule) |  | 1 |
| w533147567 | Bulevardul Dimitrie Pompeiu | NW | 5-7 | commercial · Clădirea A | 9 |  |  |  | modern office/glass curtain wall | #E3E4E1 | 1 |
| w547396774 | Calea Floreasca | E | 201 | office · Globalworth Tower | 27 | 120 |  |  | modern office/glass curtain wall | #6F8C99 est | 3 |
| w533147566 | Strada Gara Herăstrău | NE | 4B | office | 12 | 45 | 2016 |  | modern office/glass curtain wall | #6F8C99 est | 0 |
| w766842568 | Strada Gara Herăstrău | NE | 6 | office · Globalworth Square | 15 | 78 | 2021 |  | modern office/glass curtain wall | #6F8C99 est | 1 |
| w236041902 | Strada Gara Herăstrău | NE | 42 | office · Nusco Tower | 20 | 80 | 2010 |  | modern office/glass curtain wall | #6F8C99 est | 7 |
| w1289605664 | Strada Gara Herăstrău | NE |  | yes | 3 | 14 |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w1418380081 | Strada George Constantinescu | NE | 11A | yes · Grup Feroviar Roman | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w41506373 | Strada George Constantinescu | SW |  | office · Upground | 5 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 3 |
| w334223277 | Strada George Constantinescu | NE | 2C | office · MG 2 | 7 |  |  |  | modern office/glass curtain wall | #6F8C99 est | 2 |
| w55450549 | Strada George Constantinescu | SW |  | office · BOB Tower | 5 est |  |  |  | unknown (use district rule) | #6F8C99 | 5 |
| w725165285 | Strada George Constantinescu | NE | 4B | office · Globalworth Campus B | 13 |  | 2018 |  | modern office/glass curtain wall | #6F8C99 est | 6 |
| w324877671 | Șoseaua Fabrica de Glucoză | S |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w462893447 | Șoseaua Fabrica de Glucoză | S |  | apartments | 5 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w1016719142 | Șoseaua Fabrica de Glucoză | SE |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w462893448 | Șoseaua Fabrica de Glucoză | SE |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w1453910007 | Șoseaua Fabrica de Glucoză | SE |  | construction | 1 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w1334250596 | Șoseaua Fabrica de Glucoză | SE |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w1132411170 | Șoseaua Fabrica de Glucoză | S | 6-8 | apartments · Bl. 1 | 12 |  | 2021 |  | post-1990 building | #D9D6CF est | 0 |
| w1132411169 | Șoseaua Fabrica de Glucoză | S | 6-8 | apartments · Bl. 2 | 12 |  | 2021 |  | post-1990 building | #E3E4E1 est | 0 |
| w1132411168 | Șoseaua Fabrica de Glucoză | S | 6-8 | apartments · Bl. 3 | 12 |  | 2021 |  | post-1990 building | #C7C3BA est | 0 |
| w1132411167 | Șoseaua Fabrica de Glucoză | S | 6-8 | apartments · Bl. 4 | 12 |  | 2021 |  | post-1990 building | #D9D6CF est | 0 |
| w1132411163 | Șoseaua Fabrica de Glucoză | S |  | apartments | 3 |  | 2021 |  | post-1990 building | #E3E4E1 est | 0 |
| w1132411164 | Șoseaua Fabrica de Glucoză | S |  | apartments | 3 |  | 2021 |  | post-1990 building | #D9D6CF est | 0 |
| w1132411165 | Șoseaua Fabrica de Glucoză | S |  | apartments | 3 |  | 2021 |  | post-1990 building | #C7C3BA est | 0 |
| w1132411166 | Șoseaua Fabrica de Glucoză | S |  | apartments | 3 |  | 2021 |  | post-1990 building | #E3E4E1 est | 0 |
| w467228902 | Șoseaua Pipera | SE | 201 | yes · Mega Image | 2 |  |  |  | low house/villa (19th-early 20th c. likely) |  | 6 |
| w828429008 | Șoseaua Pipera | SE |  | roof | 1 est |  |  |  | utility/annex |  | 0 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| n659550006 |  |  | amenity=parking | Bulevardul Dimitrie Pompeiu | N |  |
| n659540901 | ANAPAN |  | shop=bakery | Bulevardul Dimitrie Pompeiu | N |  |
| w231123131 | Centrul naturist de sănătate Santo Raphael |  | amenity=clinic | Bulevardul Dimitrie Pompeiu | NW |  |
| n7071915116 | Euronet | Euronet bg #0D2F6A fg #FFFFFF | amenity=atm | Bulevardul Dimitrie Pompeiu | S |  |
| n7057976265 | Euronet | Euronet bg #0D2F6A fg #FFFFFF | amenity=atm | Bulevardul Dimitrie Pompeiu | NW |  |
| n517345542 | Food store |  | shop=convenience | Bulevardul Dimitrie Pompeiu | N |  |
| n13233924327 | ibrik |  | amenity=cafe | Bulevardul Dimitrie Pompeiu | N |  |
| w467560249 |  |  | amenity=parking | Calea Floreasca | E |  |
| n2484094075 | EcoClean Promenada |  | shop=dry_cleaning | Calea Floreasca | E |  |
| n9574755540 | Fayn |  | amenity=restaurant | Calea Floreasca | NE | 246 |
| n4866592321 | Florens |  | shop=gift | Calea Floreasca | E |  |
| n4866589923 | GNC |  | shop=nutrition_supplements | Calea Floreasca | E |  |
| n5289269918 | Huawei Romania |  | office=company | Calea Floreasca | E | 201 |
| n4866592323 | JPB Tabac |  | shop=tobacco | Calea Floreasca | E |  |
| n4866589922 | Next |  | shop=clothes | Calea Floreasca | E | 246B |
| n4866592422 | Oblio |  | shop=toys | Calea Floreasca | E |  |
| n2484113356 | Optiblu | OPTIblu bg #005BAC fg #FFFFFF | shop=optician | Calea Floreasca | E |  |
| n2484113369 | Paul | Paul bg #1A1A1A fg #FFFFFF | shop=bakery | Calea Floreasca | E | 246B |
| n4866592324 | Profihairshop | Profi bg #F7A600 fg #E30613 | shop=cosmetics | Calea Floreasca | E | 246B |
| n4866592521 | Simona's Cookshop |  | shop=kitchen | Calea Floreasca | E |  |
| n4866592421 | Smyk |  | shop=toys | Calea Floreasca | E |  |
| n4833254421 | Starbucks | Starbucks bg #00704A fg #FFFFFF | amenity=cafe | Calea Floreasca | NE | 246B |
| n4191473434 | Vivo Fusion Food Bar |  | amenity=restaurant | Calea Floreasca | E | 246 |
| n5289269917 | Vodafone Romania | Vodafone bg #E60000 fg #FFFFFF | office=company | Calea Floreasca | NE | 201 |
| n7071797487 | Euronet | Euronet bg #0D2F6A fg #FFFFFF | amenity=atm | Strada Gara Herăstrău | NE |  |
| n3069844972 | NoaDent |  | amenity=dentist | Strada Gara Herăstrău | NE | 42 |
| n5868977715 | Pasta Bar |  | shop=vacant | Strada Gara Herăstrău | NE | 42 |
| n4831193724 | Patria Bank | Patria Bank bg #1C3F94 fg #FFFFFF | amenity=bank | Strada Gara Herăstrău | NE | 42 |
| n12437261249 | Qualitest |  | office=it | Strada Gara Herăstrău | NE | 6 |
| w823202265 |  |  | amenity=parking | Strada George Constantinescu | NE |  |
| n11187972861 | A•R•C Bakery |  | amenity=restaurant | Strada George Constantinescu | NE | 2-4 |
| n10111661679 | Fayn |  | amenity=restaurant | Strada George Constantinescu | SW | 9B |
| n1579273709 | Honeywell Romania |  | office=company | Strada George Constantinescu | SW | 3 |
| n3749088960 | Medicover |  | amenity=doctors | Strada George Constantinescu | NE | 2C |
| n3392494601 | Mood Media |  | office=company | Strada George Constantinescu | SW | 3 |
| n7063165051 | Radcom |  | office=it | Strada George Constantinescu | NE | 2C |
| n12652303089 | Ted's Coffee Co. | Ted's Coffee Co. bg #1F1F1F fg #FFFFFF | amenity=cafe | Strada George Constantinescu | NE |  |
| w823202263 |  |  | amenity=parking | Șoseaua Fabrica de Glucoză | S |  |
| w828429008 |  |  | amenity=parking | Șoseaua Pipera | SE |  |
| w467228902 | Mega Image | Mega Image bg #E30613 fg #FFFFFF | shop=supermarket | Șoseaua Pipera | SE | 201 |

Other branded businesses in the district (off-route): 5 to go (Bulevardul Dimitrie Pompeiu, n4080665314); Catena (Bulevardul Dimitrie Pompeiu, n4080665316); Fornetti (Bulevardul Dimitrie Pompeiu, n10113539352); Luca (Bulevardul Dimitrie Pompeiu, n6435803578); Raiffeisen Bank (Bulevardul Dimitrie Pompeiu, n1563503912); CEC Bank (Calea Floreasca, n4833254521); Luca (Calea Floreasca, n9574755538); DHL (Strada Barbu Văcărescu, n4548556190); Euronet (Strada Barbu Văcărescu, n7057977916); Raiffeisen Bank (Strada Barbu Văcărescu, n2443484061); La Doi Pași (Strada Câmpul Pipera, n11307582092); Kaufland (Strada Marin Preda, w1198250017); 5 to go (, n8828063881); Alpha Bank (, n4375547592); Auchan (, n11958088007); BCR (, n9574970238); BCR (, w318990256); BRD (, n10113539339); Banca Transilvania (, n10113539338); CEC Bank (, n5014501222); Calzedonia (, n4866452022); Carrefour Express (, n7024202579); Carrefour Market (, n4618747780); Carrefour Market (, n4866483524); Chopstix (, n2484089641); Cărturești (, n2484089644); Douglas (, n4866286221); Dr. Max (, n4866258022); Froo (, n13808225715); Garanti (, n3796917465); Garanti (, n4375519191); Help Net (, n2484107173); ING (, n7026814342); Intersport (, n2484107185); KFC (, n2484107187); Kaufland (, n12857585674); Kaufland (, w1198250027); Kaufland (, w1238689138); McDonald's (, n2484107194); Mega Image (, n3056571033); Noriel (, n2484107196); OPTIblu (, n12088849037); Orange (, n4866516025); Pizza Hut (, n5014501224); Pizza Hut (, n9226855841); Raiffeisen Bank (, n4866553723); Raiffeisen Bank (, n5014501122); Regina Maria (, n6436505010); Samsonite (, n5014390421); Sephora (, n4866265921); Starbucks (, n4107002593); Starbucks (, n6155859303); Ted's Coffee Co. (, n12652303088); Ted's Coffee Co. (, n12759697006); Telekom (, n2484107170); UniCredit (, n4167364826); UniCredit (, n7080689124); Vodafone (, n4866524526); Yves Rocher (, n4866280923); dm (, n4866520622); Inmedio (, n2484107183); Inmedio (, n5014501121); Libra Bank (Șoseaua Fabrica de Glucoză, n13333870192); Shop&Go (Șoseaua Fabrica de Glucoză, n12079963619); Libra Bank (Șoseaua Fabrica de Glucoză, n516859749); Carrefour Market (Șoseaua Pipera, n11096758505); Lukoil (Șoseaua Pipera, n2437135667); Lukoil (Șoseaua Pipera, w547396767); Ted's Coffee Co. (Șoseaua Pipera, n11958088014).

## Transit

- Lines with OSM route relations touching the district: bus 112, bus 135, bus 330, bus 343, bus 416, bus 449, bus 459, bus 461, bus 1929, tram 5.
- Stops: Aurel Vlaicu (bus); Barbu Văcărescu (bus); Chefalului (bus); Cloud 9 (bus); Electronica (tram); Fabrica de Glucoză 15 (bus); Fabrica de Glucoză 8 (bus); George Constantinescu (bus); Marin Drăcea (bus); Metrou Aurel Vlaicu (bus); Metrou Pipera (bus); Muzeul Aviației (bus); Muzeul Aviației (tram); Pasaj CFR Constanța (bus); Pasajul Pipera Urcare (bus); Pasajul Pipera coborare (bus); Pipera-Cosmopolis (bus); Platforma Industrială Pipera (tram); Platforma Pipera (bus); Rocin (bus); Rocin (tram); Șoseaua Fabrica de Glucoză (bus); Șoseaua Pipera (bus); Șoseaua Pipera (tram).
- Metro entrances: Pipera  (44.48078, 26.11660); Pipera  (44.48073, 26.11639).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Dialogue (district pedestrians)

Each line {text (original language), en (English)}; persona.lang = language of text; `base` refers to bucharest-spots.json dialogue_general.persona_library; categories greeting / bumped / photographed / idle / district (place-specific facts, all consistent with this dossier). Shared: bucharest-spots.json → dialogue_general.pedestrian_general (honked_at, near_miss, sidewalk_parking, idle, small_talk) applies to every district pedestrian. Total district lines: 64.

### Irina (QA engineer, Hermes campus) (`corporate_dev`, local, lang ro, 25-40) — 16 lines
Corporate employee with a badge and coffee cup; mixes Romanian with English office jargon.

- *greeting*: „Bună!” (Hi!) · „Hey, morning!” · „Salut, mergi și tu spre metrou?” (Hi, heading to the metro too?)
- *bumped*: „Ups! Sorry!” (Oops! Sorry!) · „Atenție, am cafeaua fierbinte!” (Careful, hot coffee!) · „No worries, se întâmplă.” (No worries, it happens.)
- *photographed*: „Stai să-mi ascund badge-ul.” (Wait, let me hide my badge.) · „Fă una cu Hermes în spate.” (Take one with Hermes behind.) · „Perfect, mersi!” (Perfect, thanks!)
- *idle*: „Am call cu echipa din India la zece.” (Call with the team in India at ten.) · „Sprint review iar vineri...” (Sprint review on Friday again...) · „Facem lunch la food truck?” (Lunch at the food truck?)
- *district*: „Pe Dimitrie Pompeiu stai o oră seara.” (You sit for an hour on Dimitrie Pompeiu in the evening.) · „Vin cu metroul, e singura variantă sigură.” (I come by metro, it's the only reliable option.) · „Barierele de la parcări blochează tot bulevardul.” (The car-park barriers block the whole boulevard.) · „Au promis că lărgesc bulevardul, mai vedem.” (They promised to widen the boulevard, we'll see.)

### Domnul Gelu (office security) (`security_guard`, staff, lang ro, 40-60) — 16 lines
Security guard in a reflective vest controlling the barrier at an office car park.

- *greeting*: „Bună ziua, aveți acces?” (Good day, do you have access?) · „Ecusonul, vă rog.” (Your badge, please.) · „Bună dimineața!” (Good morning!)
- *bumped*: „Atenție la barieră!” (Mind the barrier!) · „Nu pe aici, intrarea e în stânga.” (Not this way, the entrance is on the left.) · „Mai încet, domnule.” (Slower, sir.)
- *photographed*: „Nu e voie cu poze în incintă.” (No photos on the premises.) · „Fotografiați de pe trotuar, vă rog.” (Please take pictures from the sidewalk.) · „Bine, dar fără clădirea pe dinăuntru.” (Fine, but not the inside of the building.)
- *idle*: „La cinci iese toată lumea deodată.” (At five everyone leaves at once.) · „Azi e liniște, e vineri.” (Quiet today, it's Friday.) · „Am tura de douăsprezece ore.” (I'm on a twelve-hour shift.)
- *district*: „Vizitatorii se anunță la recepție.” (Visitors check in at reception.) · „Curierii lasă coletele la poartă.” (Couriers leave parcels at the gate.) · „Seara fac eu semn mașinilor să iasă pe Pompeiu.” (In the evening I wave the cars out onto Pompeiu.) · „Metroul Pipera e la două minute.” (Pipera metro is two minutes away.)

### Marian (food-delivery courier) (`courier`, vendor, lang ro, 20-40) — 16 lines
Bike/scooter courier with an insulated backpack, delivering lunches to the office towers.

- *greeting*: „Salut! Comanda pentru Irina?” (Hi! Order for Irina?) · „Bună, livrare!” (Hi, delivery!) · „Unde e intrarea B, știți?” (Where's entrance B, do you know?)
- *bumped*: „Hopa, atenție la rucsac!” (Whoa, mind the backpack!) · „Scuze, mă grăbesc, am trei comenzi!” (Sorry, in a hurry, three orders!) · „Ușor, că se varsă supa!” (Easy, the soup will spill!)
- *photographed*: „Nu, nu, sunt în cursă!” (No, no, I'm on a run!) · „Ok, dar dă-mi cinci stele!” (OK, but give me five stars!) · „Rapid, că se răcește mâncarea.” (Quick, the food's getting cold.)
- *idle*: „La prânz e nebunie aici.” (Lunchtime is madness here.) · „Bacșiș mic azi.” (Small tips today.) · „Cu trotineta ajung mai repede ca mașinile.” (On the scooter I beat the cars.)
- *district*: „Pe Pompeiu trec printre mașini, că stau toate.” (On Pompeiu I squeeze between the cars, they're all standing still.) · „Fiecare clădire are altă recepție.” (Every building has a different reception.) · „Globalworth e cel mai înalt de aici.” (Globalworth is the tallest here.) · „Seara livrez în Floreasca.” (In the evening I deliver in Floreasca.)

### Sorin (Pipera metro commuter) (`metro_commuter`, local, lang ro, 30-55) — 16 lines
Commuter coming out of the M2 terminus at Pipera every morning.

- *greeting*: „Bună dimineața.” (Good morning.) · „Salut.” (Hi.) · „Neața, iar ploaie?” (Morning, rain again?)
- *bumped*: „Atenție, oameni buni!” (Careful, folks!) · „Ieșim toți deodată din metrou...” (We all come out of the metro at once...) · „Scuze, n-am văzut.” (Sorry, didn't see.)
- *photographed*: „Ce, sunt la știri?” (What, am I on the news?) · „Fă poză la coadă la autobuz.” (Photograph the bus queue.) · „Ok, gata.” (OK, done.)
- *idle*: „M2 a mers bine azi, ciudat.” (The M2 ran fine today, strange.) · „Mai am o oră de proiect înainte de ședință.” (One hour of project work before the meeting.) · „Vineri lucrez de acasă.” (I work from home on Fridays.)
- *district*: „Pipera e capăt de linie la M2.” (Pipera is the end of the line on the M2.) · „Cu mașina nu mai vin de mult.” (I stopped coming by car long ago.) · „Pe vremuri aici erau fabrici și câmp.” (This used to be factories and fields.) · „Autobuzele spre Voluntari pleacă de aici.” (Buses to Voluntari leave from here.)

Culture notes:

- **Register** — "Bună ziua" with strangers, "Salut/Neața" among young people; "dumneavoastră" (formal you) to older people; "Mersi" is as common as "Mulțumesc". (https://en.wikivoyage.org/wiki/Romanian_phrasebook)
- **Traffic temper** — Bucharest drivers honk readily and often do not stop at zebras; pedestrians answer with sarcasm rather than aggression — keep lines teasing, not violent. (https://en.wikivoyage.org/wiki/Bucharest#Stay_safe)
- **Sidewalk parking** — Cars parked on sidewalks are a constant pedestrian complaint; a natural topic for bumped/idle lines in side streets. (https://en.wikivoyage.org/wiki/Bucharest#Get_around)
- **Taxis at the airport** — At OTP passengers order licensed taxis from touch-screen kiosks in Arrivals; unsolicited offers are a known nuisance — staff lines should point to the kiosks. (https://www.inyourpocket.com/bucharest/The-Definitive-Guide-to-Finding-a-Taxi-at-Bucharest-Airport_74243f)
- **No stereotypes** — Personas are defined by role/place (student, vendor, commuter), never by ethnicity; Roma, Moldovan or diaspora characters are not caricatured; humour targets traffic, weather, parking and the metro. (spec 20 (game/research) requirement)
- **Shared library** — Generic personas (local_elder, tour_guide …) and the pedestrian_general set (honked_at, near_miss, sidewalk_parking) live in bucharest-spots.json → dialogue_general; district personas below add place-specific lines. (game/research/bucharest-spots.json)

## Traffic / congestion (feeds `congestion`, spec 13)

- City: Bucharest ≈62.5 % congestion, 171 h lost per driver in 2025; worst slot Wednesday 17:00–18:00 [tomtom_2025] [tomtom_2025b]

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Bd. Dimitrie Pompeiu (whole street) | 44.4802, 26.114 | 300 | [[8, 10.5], [16.5, 20]] | 0.95 | "paralysed for hours" at the evening exit of thousands of employees; parking barriers block lanes [pipera_protv] [pipera_adevarul] [pompeiu_project] |
| Barbu Văcărescu × Fabrica de Glucoză (Sky Tower) | 44.4775, 26.1045 | 220 | [[8, 10], [16.5, 19.5]] | 0.85 | main entry to the Pipera office cluster [pipera_capital] [tomtom_peak] |
| Șos. Pipera / Podul Pipera | 44.484, 26.114 | 200 | [[7.5, 10], [17, 20]] | 0.75 | Voluntari/Pipera north commuters [pompeiu_105m] |

## Streetscape rules (Bucharest-wide, apply unless a street overrides)

- **driving**: side: right; urban_speed_default_kmh: 50; boulevard_signed_kmh: 50, 60; units: km/h; note: RO:urban default 50; several boulevards signed 60 (OSM maxspeed=60 on Lascăr Catargiu, Magheru, Dorobanți north). (high) [osm] [ro_signs]
- **markings**: colour_hex: #F4F4F0; lane_line: white dashed 3 m line / 6 m gap on urban roads (RO standard SR 1848-7), 0.10–0.15 m wide; centre_line: white continuous (single) on 2-lane two-way, double continuous on 4+ lane two-way without median; stop_line: white 0.4–0.5 m; zebra: white bars 0.5 m wide / 0.5 m gap, parallel to traffic, no side lines; a few school-zone crossings have red infill between the white bars (verify per crossing on refs); turn_arrows: white arrows per turn:lanes; bus_lane: white continuous line with "BUS" text; since 2019 some STB lanes on Magheru axis/Ștefan cel Mare painted red-brown (#9E3B2E) – verify per street; yellow: yellow only for temporary works and kerb no-parking (zig-zag at bus stops); wear: markings visibly worn/faded on most streets except freshly resurfaced arteries — use 60–80% opacity (medium) [ro_markings]
- **kerbs**: material: grey concrete kerbstones 15×25 cm (older streets: granite #8C8C8C), kerb height 12–18 cm, often chipped; colour_hex: #9B9A94 (medium)
- **sidewalks**: paving: mix: (a) grey concrete interlocking pavers ("pavele") #A9A59C on renovated boulevards; (b) cracked asphalt #6E6C68 on side streets; (c) 40×40 grey concrete slabs on 1960–80s estates; parking_on_sidewalk: very common: cars half/fully on the sidewalk on side streets, behind metal bollards on boulevards (medium)
- **traffic_lights**: model: RO 3-aspect vehicle heads (200/300 mm), black or yellow housing with yellow-black backplates on main arteries, mounted on grey/black poles + overhead mast arms at big junctions; pedestrian 2-aspect (red/green man) with countdown displays on major junctions (medium)
- **street_name_plates**: style: blue plate (#1F4E9A) white text "Bulevardul X" + sector number "Sector 1" in smaller text, on building corners or poles (medium)
- **bus_shelter**: style: STB/Clear-channel style glass shelters with grey steel frame and backlit ad panel; many stops have only a pole with the yellow STB stop sign + timetable (medium) [stb]
- **metro_totem**: style: Metrorex entrance: blue square sign with white "M", station name in white on blue; stairs down with grey stone/steel railings; colour_hex: #0055A4 (medium) [metrorex]
- **trolleybus_wires**: style: pair of copper contact wires 0.6 m apart per direction at ~5.6 m, carried by span wires between steel or concrete poles on both kerbs (often shared with street lamps) (medium)
- **tram_track**: style: standard gauge 1435 mm; on boulevards in a central reservation with concrete sleepers/ballast or grass, kerbed and fenced in places; overhead single contact wire on span wires (medium)
- **lamps**: boulevard: galvanised/grey steel octagonal poles 10–12 m, single or double arm, LED or older sodium cobra heads (sodium = orange #FFB45A; LED = 4000 K white #F2F0E6); 25–35 m spacing staggered on both kerbs and often in the median; side_street: 7–9 m grey poles or concrete poles with single arm, ~30 m spacing; historic: Calea Victoriei: black ornamental cast-iron style lanterns (medium) [lighting_2025] [lighting_ebrd]
- **trees**: species: Tilia (linden, dominant on boulevards), Aesculus hippocastanum (horse chestnut), Acer platanoides, Platanus (plane, older avenues), Robinia pseudoacacia (side streets), Celtis; crown 8–14 m; spacing_m: 8, 12 (medium)
- **furniture**: bin: grey/green metal municipal litter bins on poles; bollards: black or grey steel anti-parking posts (~0.9 m) lining boulevard kerbs; bike: I'Velo green docks at main squares (medium)
- **buildings**: ground_floor: shops with mixed signage, many vacant "De închiriat" (for rent) banners; ATM boxes; exchange offices; air_con: split AC units on facades (very visible); cables: loose telecom cables strung between buildings/poles on side streets (medium)

## Colour palette

- glass_office: #6F8C99
- facades_1970s_90s_blocks: #D9D6CF #C7C3BA #E3E4E1
- facades_interwar_modernist: #D9D2C3
- road: #3D3D42
- sidewalk: #A6A39B
- kerb: #9B9A94
- marking: #F4F4F0
- conf: medium/estimated

## Top 30 things a local would notice if wrong

1. Bd. Dimitrie Pompeiu is NARROW (1+1 lanes) despite the name — a corporate canyon.
2. Evening standstill on Pompeiu 17–19:30; everyone leaves at once.
3. Lift-gate barriers at every office car-park entrance.
4. Hermes campus: white/grey 9–10-storey blocks around a plaza (north side).
5. BOB Tower (DB) is a 7-storey glass block on the south side opposite Hermes.
6. Pipera metro M2 terminus at the east end; buses and taxis around it.
7. Glass towers everywhere: Globalworth Tower (120 m), AFI Lakeview, Corp A/B (53 m), Marriott (55 m).
8. Sky Tower at the SW corner (137 m).
9. Tram 5 on Barbu Văcărescu only; no trams on Pompeiu.
10. Construction sites/cranes for new offices and residences.
11. Food trucks and kiosks at lunch, smokers outside lobbies.
12. Ted's Coffee, ibrik, A•R•C Bakery, Medicover clinic.
13. Remnant old Pipera industrial halls (JTI factory, Corp 1–20) north of Pompeiu.
14. Wide new sidewalks in front of new offices, broken ones elsewhere.
15. Euronet ATMs along Pompeiu.
16. Bike-share and scooters at the metro.
17. Raiffeisen HQ and DHL on Barbu Văcărescu.
18. Șos. Fabrica de Glucoză signed 40 km/h.
19. 12-storey new residential blocks on Fabrica de Glucoză.
20. Courtyard by Marriott tower on Pompeiu.
21. Planned widening (tram + bike lanes) — not built yet.
22. Parking on sidewalks near the metro.
23. Corporate shuttle minibuses.
24. Mostly modern LED lamp posts on new sections.
25. Very few old trees; young planted trees in office plazas.
26. Security guards in reflective vests directing exits at peak.
27. Novo Park buildings A–G (5–14 lv) on the south side.
28. Upground residential/office towers next to BOB.
29. Globalworth Campus B (13 lv) on George Constantinescu.
30. Grey sky-reflecting glass dominates the palette.

## Gaps / to verify

- HBC1/HBC2/HBC3 footprints not split in OSM
- Luxoft 2017 site (Hermes vs Novo E) assumed Hermes per owner
- Pompeiu widening works status (Nov 2026)

## Reference images (`refs/pipera/`, 8 files, licences in LICENSES.md)

| file | taken | near | licence | facade-texture candidate |
|---|---|---|---|---|
| Sky_Tower_level_35_Floreasca_Lake_-_panoramio.jpg | Taken on 2 | Pipera bridge / Barbu Văcărescu | CC BY 3.0 |  |
| View_from_Sky_Tower_level_35_to_the_South_-_panoramio.jpg | Taken on 2 | Pipera bridge / Barbu Văcărescu | CC BY 3.0 |  |
| View_from_Sky_Tower_level_35_to_the_North-West_of_Bucharest_-_panoramio.jpg | Taken on 2 | Pipera bridge / Barbu Văcărescu | CC BY 3.0 |  |
| Sky_Tower_in_Winter_20160223_083746_1PS_28802141231_.jpg | Taken on 2 | Novo Park | CC BY 2.0 |  |
| Cugir_Mosin-Nagant_M44_carbine.jpg | 05.11.2020 | Pipera bridge / Barbu Văcărescu | CC BY-SA 4.0 |  |
| Pu_ca_ZB_model_1924_cu_vergea_i_baionet_.jpg | 05.11.2020 | Pipera bridge / Barbu Văcărescu | CC BY-SA 4.0 |  |
| SkyTower_in_the_urban_wilderness_20151028_101210_1PS_23383531113_.jpg | Taken on 2 | Novo Park | CC BY 2.0 |  |
| Sector_2_Bucharest_Romania_-_panoramio_3_.jpg | Taken on 2 | Pipera bridge / Barbu Văcărescu | CC BY 3.0 |  |

## Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 map tiles, 2026-11-06; tags lanes, turn:lanes, maxspeed, trolley_wire, building:*) |
| wp_lascar | https://en.wikipedia.org/wiki/Bulevardul_Lasc%C4%83r_Catargiu |
| wp_victoriei | https://en.wikipedia.org/wiki/Victory_Square,_Bucharest |
| wp_romana | https://en.wikipedia.org/wiki/Pia%C8%9Ba_Roman%C4%83 |
| wp_victoria_palace | https://en.wikipedia.org/wiki/Victoria_Palace |
| wp_ase | https://en.wikipedia.org/wiki/Bucharest_University_of_Economic_Studies |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |
| euronews_10km | https://www.euronews.ro/articole/cosmarul-traficului-din-bucuresti-nu-s-a-schimbat-10-kilometri-in-peste-45-de-minute |
| hotnews_axis | https://hotnews.ro/bucurestiul-pe-locul-8-n-topul-celor-mai-aglomerate-de-trafic-orase-din-lume-23247 |
| tvr_romana | https://tvrinfo.ro/nu-mai-exista-ora-de-varf-ci-un-blocaj-continuu-in-trafic-in-prag-de-sarbatori-in-bucuresti/ |
| pressone_ads | https://pressone.ro/peste-200-de-spatii-de-reclame-din-centrul-bucurestiului-aduc-profituri-de-zeci-de-milioane-de-euro-autoritatile-nu-raspund-daca-sunt-amplasate-legal |
| lighting_2025 | https://romania-insider.com/bucharest-replace-lighting-fixtures-energy-efficient-2025 |
| lighting_ebrd | https://ebrdgeff.com/projects/improved-public-lighting-in-bucharest/ |
| imperio | https://rollingstockworld.com/lrv/astra-vagoane-began-to-deliver-a-new-generation-of-imperio-trams-to-bucharest/ |
| imperio2 | https://www.gandul.ro/actualitate/stb-cifrele-tramvaiului-astra-imperio-din-bucuresti-dupa-doi-ani-137-de-milioane-de-calatorii-20377577 |
| europe_house_caimmo | https://caimmo.com/en/press-corner/news/news-detail/bristol-myers-squibb-romania-remains-another-5-years-in-europe-house-office-building |
| europe_house_cw | https://office.cwechinox.com/?p=20629 |
| europe_house_zf | https://m.zf.ro/amp/zf-english/the-first-glass-offices-of-bucharest-still-lure-tenants-owing-to-location-6744587 |
| landmark_vectr | https://romania-insider.com/vectr-realty-the-landmark-offices-deal-bucharest-2024 |
| landmark_economedia | https://economedia.ro/fratii-gupta-care-detin-si-london-partners-au-cumparat-cladirea-de-birouri-the-landmark-unde-are-sediu-uipath.html |
| landmark_spatii | https://www.spatii-de-birouri.ro/en/bucharest-the-landmark |
| uipath_addr | https://assets.opencorporates.com/companies/ro/34737997 |
| db_careers | https://careers.db.com/explore-the-bank/locations/emea/romania |
| db_hq_2015 | https://www.romania-insider.com/deutsche-banks-technology-center-in-bucharest-reached-300-employees-plans-to-add-200-more |
| luxoft_careers | https://career.luxoft.com/locations/romania |
| luxoft_ripe | https://ripe.net/membership/indices/data/ro.lux.html |
| gts_termene | https://termene.ro/firma/31050700-- |
| gts_biz | https://www.revistabiz.ro/gts-global-intelligence-a-preluat-lummetry-companie-romaneasca-de-inteligenta-artificiala/ |
| ro_signs | https://en.wikipedia.org/wiki/Road_signs_in_Romania |
| ro_markings | https://ro.wikipedia.org/wiki/Marcaj_rutier |
| stb | https://en.wikipedia.org/wiki/Societatea_de_Transport_Bucure%C8%99ti |
| metrorex | https://en.wikipedia.org/wiki/Bucharest_Metro |
| wp_transport | https://en.wikipedia.org/wiki/Transport_in_Bucharest |
| hermes_atenor | https://atenor.eu/en/?p=19339 |
| hermes_sale_2021 | https://www.atenor.eu/wp-content/uploads/2021/05/2021-Vente-HBC-EN-2.pdf |
| hermes_financing_2020 | https://www.atenor.eu/wp-content/uploads/2020/08/2020-HBC-financement-EN-1.pdf |
| hermes_adventum | https://eurobuildcee.com/en/news/31229-adventum-purchases-hermes-business-campus |
| bob_globalworth | https://www.globalworth.com/wp-content/uploads/2021/01/BOB-particulars.pdf |
| wp_globalworth_tower | https://en.wikipedia.org/wiki/Globalworth_Tower |
| pompeiu_project | https://www.ziarulprofit.ro/bulevardul-dimitrie-pompeiu-din-zona-pipera-se-transforma-complet-cum-se-transforma-una-dintre-cele-mai-aglomerate-artere-din-bucuresti/ |
| pompeiu_105m | https://www.g4media.ro/primarul-interimar-al-capitalei-anunta-o-investitie-de-105-milioane-de-euro-pentru-deblocarea-traficului-din-zona-dimitrie-pompeiu-a-fost-finalizat-studiul-de-fezabilitate-iar-dupa-aprobarea-in-con.html |
| pipera_adevarul | https://adevarul.ro/economie/pipera-dragostea-mea-866424.html |
| pipera_protv | https://stirileprotv.ro/exclusiv/stirile-tale/epopeea-traficului-din-bucuresti-partea-a-ii-a.html |
| pipera_capital | https://www.capital.ro/investitie-pentru-fluidizarea-traficului-in-nordul-capitalei-se-construieste-o-noua-sosea-in-zona-dimitrie-pompeiu.html |


## Independent full-ring measurements — 2026-11-08

The original route/coverage tables above are the2026-11-06 dossier snapshot. Current chapter anchors and playable geometry remain those in `cities.js`; this pass preserves them. The machine-readable measurement ledger is `measurements-bucharest-pipera.json`.

Fresh OpenStreetMap API0.6 tiles cover the analytic core and complete600m intersecting-source ring. Every valid source ID is audited directly, including small structures, source parts and mapped courtyard relations; spatial neighbours cannot mask a missing ID. The initial rebuild had2282 source records but omitted7 and shrank several others; the exact-source policy retains all2282. Road contacts remain source-review items until their mapped shared lanes, open roofs or building passages are implemented and verified.

Independent Esri World Imagery coverage is44.465–44.490N /26.084–26.141E, zoom18, approximately0.426m/pixel,1161tiles. Acquisition date is unknown; access date is2026-11-08. Roof calibration inspected80 deterministic random samples and12 key structures on5 private sheets. The compact input contains2266 source roof records, including retained uncertain classifications. It does not measure roof rise/direction or native metre height. The canopy input measures47585 crown centres/radii over the complete image coverage; the builder accounts for retention outside the source envelope and exact physical exclusions. Untagged heights/species remain estimates. Green ground uses the same source mosaic.

All9 `building=roof` records were independently reviewed, with explicit open-roof metadata and estimated untagged vertical dimensions. The two station canopies also have mapped covered service access: [Petrom](https://www.openstreetmap.org/way/241976323), [covered lane](https://www.openstreetmap.org/way/668515452); [Lukoil](https://www.openstreetmap.org/way/547396767), [covered lane](https://www.openstreetmap.org/way/668523278). No fuel station is invented from available ground.

The Aviation Museum's23 mapped `historic=aircraft` outlines describe aircraft exhibits, rather than houses. Their exact planforms and identities remain; vertical body/fin/clearance detail is explicitly estimated. Their silhouettes are excluded from roof-class claims.

Landmark evidence uses the [Sky Tower owner](https://www.skytower.ro/), [Hermes owner](https://adventum.eu/asset/hermes-business-campus/), [Globalworth BOB owner particulars](https://www.globalworth.com/wp-content/uploads/2021/01/BOB-particulars.pdf), the mapped building identities, and independent aerial plans. Sky Tower's tagged137m/37levels/flat roof and colour have priority. Hermes A and B+C each have9 OSM levels, and B+C's courtyard remains open at every tier. BOB has independently published GF+6 floors; its metre height remains an estimate. Ground-floor/site entrance details retain the existing source chapter approach.

Google Street View is used only for private side-by-side comparison. No geometry, height or colour is extracted from it, and no reference imagery is committed or published.

## Fidelity pass against live OSM and street-level reference — 2026-11-12

Scope: the playable area of `cities.js` (130 m either side of the two chapter routes, bbox 44.4704,26.0918 – 44.4830,26.1289) and what is seen from it. Live OSM: API 0.6 `map` call of 2026-11-12 for the bbox (19 803 nodes, 2 850 ways, 192 relations). Street-level panoramas were looked at only, at the poses in `game/dev/reality/viewpoints.json` (`pip-*`); nothing was stored or measured from them. Text findings only.

### Structures

| OSM | What | Game before | Verdict |
|---|---|---|---|
| w119926495 Podul Barbu Văcărescu (bridge, layer 1, 4 lanes) | overpass from Șos. Pipera over Str. Șerbănescu / the tram loop, side roads at grade on both sides | elevated deck, side roads at grade, Șerbănescu passes under | position / level match. Open: the real deck has a low kerb with a steel railing, transparent noise screens on the north side and lamp posts; the game draws a solid 1.1 m concrete parapet and no lamps |
| w8208289 Strada Petricani bridge over the Colentina (layer 1), outline w902027552, cycle bridge w902027549, tram bridges w23583767 / w902027550 (`railway=construction`, opening 2027) | level road bridge between Lacul Tei and Lacul Plumbuita; steel picket railing behind the east sidewalk, guard rail + tram reserve + concrete parapet on the west; water some metres below, a weir on the east side | drawn as an ordinary street, open water at both sidewalks, no railing | fixed: railing on the outer edge of both sidewalks (`water-bridge-railings.js`). Open: water is drawn at street level (real surface lies metres lower, weir w1507038443 not drawn); west side has no guard rail / tram reserve; the lake polygon w117140691 is a 2006 CORINE import and the aerial-measured crowns stand inside it (in reality the north tip of Lacul Tei is overgrown, no open water is visible from the bridge's west side) |
| w739789922-4 (Aurel Vlaicu), w739791318/9 (Pipera): pedestrian tunnels, layer −1 | metro access passages | not drawn (metro entrances are POIs / kiosks) | not modelled; record only |
| w764616770/1, w467560865, w467560480/1, w467560867 Promenada car-park tunnels (layer −1) | ramps into the underground car park | service roads flagged tunnel at layer −1 | present in data; not compared at street level |
| w668515452 (Petrom), w668523278 (Lukoil) covered lanes; w1284446130 | forecourt lanes under the canopies | present (reviewed covered roads) | match |
| w1566299306/09/12/15/19, w48272349, w1339943929 `tunnel=building_passage` | passages through the blocks on Șos. Fabrica de Glucoză etc. | present in `buildingPassages` | match in data; not compared at street level |
| railway w1221367953 … (CFR line 800) | at grade under Podul Barbu Văcărescu | in `railways` | present |

### Water and sports

- Lacul Tei w117140691 and Lacul Plumbuita r11546654: both present as water areas at the Petricani bridge (see above for the open points). Pond w1423621338: present.
- Clubul Sportiv Năstase & Marica w23731450: clay courts w885503360 / 61 / 71 / 73 / 74 / 62, pool w1284446111 and the stadium pitch w885503357 / w47422913 are present at the OSM positions (top-down render checked). Not compared at street level (no public panorama inside the club).

### Tourist features

- Muzeul Național al Aviației Române w392466489: the 23 mapped aircraft are present as exhibits at their OSM planforms (top-down render checked).
- Monumentul Soldatului Sovietic n1174026151: a map POI only; no statue is modelled. From Șoseaua Pipera the monument is hidden by the park's trees behind a low brick wall (two poses tried); the park w23731459 is present.
- Promenada Mall w240694437: the Calea Floreasca front now carries what the real front shows: a black tenant band at the north end (Douglas, Hervis, Zara, C&A, H&M: all OSM shop nodes inside the mall), Starbucks under it (n4833254421, level 0), the glazed entrance hall south of it (it was drawn at the middle of the front), the mall's name and its colour bars. Positions along the wall are estimated to a few metres from the look of the front; the curved roof edge and the hedge / jersey-barrier median of Calea Floreasca are not modelled.
- Sky Tower w219622660: present, reads correctly behind Promenada.

### Fuel

- Petrom w241976323 and Lukoil w547396767: the mapped canopies were bare grey concrete. They now have the brand's fascia colour (yellow / red, as at the stations) and the brand name on the two longest faces. Pumps, shop fronts and price pylons are still not drawn (positions unknown). `GPL Lukoil Aviației` n2437135667 is a POI without a canopy.

### Businesses (playable area + 150 m: 349 OSM objects with a business tag, 193 matched to a game POI by name within 90 m)

Missing from `data.pois`, at street level on or beside the routes (needs a POI rebuild / append; the builder's `poiKind()` has no rule for several of these classes): Starbucks n4107002593 (Fabrica de Glucoză 9B), Starbucks n6155859303 and Stradale n9226903343 (Pompeiu 4-6), Vista Bank n10113539341, World Class n4161831405 (`leisure=fitness_centre`), CEC Bank n4833254521 and French Revolution n9574755539 (Calea Floreasca 169A), Auchan Go n11958088007, Eggs Cup n9226929866, P44 n11096775776, Afina pharmacy n1143427037, Alpha Bank n304720869, Carrefour Market n412366230, Flora Studio n728736339, Toma's Optik n11222883620 (`craft`), Adecco n3717196110, DB Schenker n6866017228 and the office tenants (HP, Allianz, Amazon, Deloitte, Dell, Uber: `office=yes/company` nodes). About 60 more are shops inside Promenada on levels −1 / 1 / 2 (no street sign in reality either, apart from the tenant band).
Stale / to check in the game: `Pasta Bar` n5868977715 is `shop=vacant` in OSM (not in the game: correct). `Express Green Court` (Carrefour Express) and `McDonald's Promenada Mall` come from the brand locators, not OSM. Kaufland's POI is 63 m from the centroid of its OSM building w1198250017.

## Fidelity pass round 2, 2026-11-12 (sweep for uncovered structures, water, sports, large stores)

A sweep of the district data found these items in the playable area with no reference viewpoint within 130 m; viewpoints were added and compared with the official panorama at the same point (appearance only, nothing stored).

- **Kaufland** (POI at 44.477991, 26.122599; covered service road beside it): from Șos. Fabrica de Glucoză (`pip-kaufland`, 44.478452, 26.122228, heading 149) the store is a low box far behind its car park, with a concrete barrier in the middle of the road and towers under construction to the east; the game shows the car-park side with glass office blocks behind and no median barrier. Store front not compared (too far from the street).
- **Muzeul Național al Aviației Române** (POIs 44.4777 – 44.4790, 26.1102 – 26.1116): from Bd. Dimitrie Pompeiu (`pip-aviation-museum`, 44.479143, 26.110517, heading 163) a concrete fence with graffiti and a tree belt hide the grounds; the game has open lawn, no fence and none of the 25 mapped aircraft exhibits. Still wrong.
- **Courtyard by Marriott** (POI 44.47802, 26.107132; `pip-courtyard`, 44.478444, 26.106966, heading 163): dark glass hotel tower and a mirrored podium behind a lawn; the game has blue glass towers there. Match in massing, colour more saturated than the real anthracite.
- **Clay courts** at 44.47793, 26.09902 and 44.47814, 26.10046: hidden behind houses from every panorama found; present as areas; not compared.

## Landmark catalogue review against panoramas (fidelity pass round 2b, lane landmarks-b, 2026-11-12)

Method: official panorama ids found from Maps coverage metadata (`photometa/ac`, coverage only), the game rendered at the
pano position and bearing (eye 2.5 m), then compared side by side by eye. No imagery kept. Poses: `viewpoints-add.json`
of this lane and the poses below. "Match" = shape class, height, roof, main materials/colours, entrance side and signage
read as the real thing at street distance; it is not a claim of parity. Table positions are rounded and some are
approximate; the exact poses with their pano ids are in this lane's `pick/*.json`, `views2b.json` and `views3.json`,
and the kept ones in `viewpoints-add.json`.

| Landmark | Pose (lat, lon, heading) | Verdict |
| --- | --- | --- |
| hermes | 44.48056, 26.115007 h 308 | match in class (striped glass offices); real view mostly hidden by trees |
| bob | 44.4797, 26.1150 h 156 | unresolved: two different buildings in the frame, which one is BOB not established |
| globalworth | 44.479318, 26.103249 h 263 | fixed base: white-framed glazed podium (was navy); shaft grey-blue |
| skytower | 44.4787, 26.1065 h 249 | match |
| promenada | 44.477617, 26.102507 h 48 | fixed: no window row round the white walls; tenant band position on the corner not checked |

Statues not modelled: Soviet Soldier monument n1174026151 (both panoramas face a brick wall and trees, the monument is not visible).

## Round 2 (2026-11-12), lane world

Fuel: Petrom 2 islands + pylon, Lukoil 3 islands (no free place for the pylon); the LPG point
"GPL Lukoil Aviației" gets no pylon of its own. Monumentul Soldatului Sovietic: generic monument. Podul Barbu Văcărescu
guard not reviewed.

## Round 2 (2026-11-12), lane world-b

Street View was used only to look (official panoramas, ids found from coverage metadata); nothing was saved or traced.

Podul Barbu Văcărescu w119926495: low concrete kerb with galvanised posts and mesh panels
(panorama 44.479661, 26.100612 h253): drawn so. Str. Petricani bridge w8208289: W-beam guard rail + yellow railing; the
game deck is at grade without a railing (not changed). Kaufland w1198250017: the store is mapped as one point in the middle
of the footprint; the sign now goes on the east face toward its own car park w1198250027.
