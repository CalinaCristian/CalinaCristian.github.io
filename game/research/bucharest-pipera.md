# Bucharest — Pipera (Dimitrie Pompeiu) (`pipera`): field research dossier

Role: research-buc-districts · generated 2026-11-06 22:19 UTC · machine-readable twin: `bucharest-pipera.json` · images: `refs/pipera/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Dimitrie Pompeiu, Calea Floreasca, Strada Barbu Văcărescu, Strada Gara Herăstrău, Strada George Constantinescu, Șoseaua Fabrica de Glucoză |
| route_streets_researched | Bulevardul Dimitrie Pompeiu, Calea Floreasca, Strada Barbu Văcărescu, Strada Gara Herăstrău, Strada George Constantinescu, Șoseaua Fabrica de Glucoză |
| fronting_route_buildings | 39 |
| fronting_route_with_height | 53.8 |
| fronting_route_with_colour | 5.1 |
| fronting_route_researched | 10.3 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 61.5 |
| fronting_main_buildings | 58 |
| fronting_main_with_height | 70.7 |
| buildings_total | 295 |
| buildings_with_height | 51.2 |
| businesses_total | 273 |
| businesses_on_route | 19 |
| businesses_branded | 61 |
| trees_osm | 1 |
| lamps_osm | 0 |
| crossings | 140 |
| signal_nodes | 20 |
| transit_stops | 34 |
| metro_entrances | 2 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.4745, 26.103], [44.4845, 26.103], [44.4845, 26.1215], [44.4745, 26.1215]]` → bbox `[44.4745, 26.103, 44.4845, 26.1215]`, area **1.633 km²**.
- Why: 1.11 km N-S × 1.47 km E-W ≈ 1.6 km² trimmed to ~1.3 km² of built area: west edge Calea Floreasca/Gara Herăstrău (Sky Tower, Promenada, Floreasca Park just inside the NW corner), south edge Șos. Fabrica de Glucoză, north edge the Pipera industrial lots / Podul Pipera ramps, east edge Str. George Constantinescu / Conect offices. Contains Hermes Business Campus (luxoft), BOB Tower (DB Global Technology), Novo Park, Globalworth Campus, Pipera metro (M2 terminus).

## Chapter routes

### luxoft · 2017 — Luxoft — Hermes Business Campus

- **Start**: Barbu Văcărescu × Calea Floreasca (Sky Tower) heading east — `44.477868, 26.10547`, heading 149° on Strada Barbu Văcărescu.
- **End**: Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7 (north side) — `44.48017, 26.113727`.
- **Length**: 1605 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Start at the Barbu Văcărescu × Calea Floreasca junction under Sky Tower → east on Șos. Fabrica de Glucoză (tram 5 terminus area, Globalworth Tower/Campus, Novo Park on the left) → north on Str. George Constantinescu (Medicover, MG offices) → west a block on Bd. Dimitrie Pompeiu to the Hermes Business Campus (Pipera metro M2 terminus just east).
- **Sequence**: Strada Barbu Văcărescu (288 m) → Șoseaua Fabrica de Glucoză (840 m) → Strada George Constantinescu (345 m) → Bulevardul Dimitrie Pompeiu (133 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4772, "lon": 26.1045, "road": "Barbu Văcărescu|Fabrica", "bearing": 90}, {"lat": 44.479, "lon": 26.116, "road": "George Constantinescu", "bearing": 0}, {"lat": 44.4806, "lon": 26.1135, "road": "Pompeiu"}]`

### db · 2017 — DB Global Technology — BOB Tower, Bd. Dimitrie Pompeiu 6A

- **Start**: Calea Floreasca northbound at Promenada / Sky Tower — `44.476872, 26.102975`, heading 160° on Calea Floreasca.
- **End**: BOB Tower (DB Global Technology), Pompeiu 6A (south side) — `44.48017, 26.113727`.
- **Length**: 1488 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: From Calea Floreasca at Promenada/Sky Tower → Șos. Fabrica de Glucoză → north on Str. Gara Herăstrău past Floreasca Park/AFI offices → east along narrow two-lane Bd. Dimitrie Pompeiu (office canyon, barrier-gated parking entrances) to BOB Tower (DB Global Technology) on the south side opposite Hermes.
- **Sequence**: Calea Floreasca (141 m) → Șoseaua Fabrica de Glucoză (313 m) → (primary_link) (33 m) → Șoseaua Fabrica de Glucoză (30 m) → Strada Gara Herăstrău (304 m) → Bulevardul Dimitrie Pompeiu (667 m)
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

- OSM: 21 ways, 3018 m in district, classes primary, secondary; lanes values ['2', '3', '4']; one-way segments 21/21; maxspeed ['40']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 343, bus 449, bus 459, bus 461, bus 1929.
- OSM furniture: {'gate': 2, 'bicycle_rental': 1, 'bicycle_parking': 2, 'lift_gate': 5}.
- Fronting buildings: 38; businesses: 9.
- **cross_section**: one-way pairs 2–4 lanes with turn pockets; 40 km/h signed (OSM maxspeed 40); buses 343, 449, 459, 461; tram 5 loop/terminus near Barbu Văcărescu
- **frontage**: Globalworth Tower (118–120 m, 26 floors, 2016) and Globalworth Campus; 12-storey new residential blocks (Bl. 1–4) on the S side; Novo Park on the N side
- confidence: high (OSM, Wikipedia) [osm] [wp_globalworth_tower]

### Strada Barbu Văcărescu (chapter route)

- OSM: 9 ways, 1515 m in district, classes primary; lanes values ['2', '3', '4']; one-way segments 9/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 330, bus 449, bus 461, bus 1929, tram 5.
- OSM furniture: {'parking_entrance': 1}.
- Fronting buildings: 8; businesses: 7.
- **cross_section**: dual carriageway 2–3 lanes each way with tram 5 on a central reservation; 50 km/h; offices AFI Lakeview (15 lv, 65 m), Zone 313, FCC, Raiffeisen Bank HQ, DHL
- confidence: high (OSM) [osm]

### Bulevardul Dimitrie Pompeiu (chapter route)

- OSM: 9 ways, 1404 m in district, classes tertiary; lanes values ['1', '2']; one-way segments 2/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 416, bus 459.
- OSM furniture: {'gate': 4, 'parking_entrance': 1, 'bicycle_parking': 2, 'lift_gate': 8}.
- Fronting buildings: 18; businesses: 25.
- **cross_section**: despite "Bulevard" it is a narrow 2-lane (1+1) street (≈7–8 m) with a 581 m one-way single-lane section (OSM w1040373748) and frequent office driveways with lift-gate barriers; 50 km/h; buses 416, 459 only; sidewalks 2–3 m, new paving in front of offices, broken elsewhere; a 105 M€ widening/tram project (4 lanes or 2 + double tram + bike lanes, target 2028) is planned — model today's narrow street
- **frontage**: office canyon: N: Hermes Business Campus (5-7), Nova Building (9 lv), Santo Raphael clinic; S: Courtyard by Marriott (14 lv, 55 m), Novo Park A–G (5–14 lv), BOB Tower (6A), Upground towers; Pipera metro terminus (M2) at the east end; Euronet ATMs, cafes (ibrik), bakeries
- confidence: lanes high (OSM); project status medium [osm] [pompeiu_project] [pompeiu_105m] [pipera_capital]

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

### Calea Floreasca (chapter route)

- OSM: 7 ways, 322 m in district, classes living_street, secondary; lanes values ['2', '4']; one-way segments 0/7; maxspeed ['10', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 135, bus 343, bus 449, bus 459, bus 461.
- OSM furniture: {'gate': 2}.
- Fronting buildings: 3; businesses: 1.
- **cross_section**: north end at Promenada/Sky Tower: 2+2 with turn pockets
- confidence:  [osm]

### Șoseaua Pipera

- OSM: 13 ways, 1993 m in district, classes secondary; lanes values ['1', '2', '3']; one-way segments 13/13; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 112, bus 135, bus 343, bus 416, bus 449, bus 459.
- OSM furniture: {'lift_gate': 5}.
- Fronting buildings: 11; businesses: 12.

### Aleea New York

- OSM: 1 ways, 295 m in district, classes service; lanes values []; one-way segments 0/1; maxspeed ['10']; surface ['paved']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

### Strada Marin Preda

- OSM: 1 ways, 285 m in district, classes residential; lanes values ['2']; one-way segments 0/1; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'lift_gate': 1, 'parking_entrance': 1}.
- Fronting buildings: 7; businesses: 1.

### Podul Barbu Văcărescu

- OSM: 1 ways, 270 m in district, classes secondary; lanes values ['4']; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 1.

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
| n7752045889 | Strada Barbu Văcărescu × Șoseaua Fabrica de Glucoză | yes |  | 14 |
| n656968 | Calea Floreasca × Șoseaua Fabrica de Glucoză | yes |  | 4 |
| n7684747704 | Intrarea Chefalului × Șoseaua Fabrica de Glucoză | yes |  | 3 |
| n12500889187 | Strada Gara Herăstrău × Șoseaua Fabrica de Glucoză | yes |  | 11 |
| n255387694 | Bulevardul Dimitrie Pompeiu × Strada Gara Herăstrău |  |  | 1 |
| n3413363629 | Bulevardul Dimitrie Pompeiu × Strada George Constantinescu |  |  | 2 |
| n11396319606 | Strada George Constantinescu × Șoseaua Fabrica de Glucoză | yes |  | 3 |
| n7684747707 | Anton Holban × Șoseaua Fabrica de Glucoză |  |  | 4 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w764534288 | Courtyard by Marriott Bucharest Floreasca | 14 / 55 |   |  |  |  [osm] |
| w533147567 | Hermes Business Campus (Luxoft, HBC2) | 9 / 36 | #E3E4E1 panels + glazing | flat | 2011–2016 | luxoft [hermes_atenor] [osm] |
| w237911115 | AFI Lakeview | 15 / 65 |  glass |  |  |  [osm] |
| w55450549 | BOB Tower (DB Global Technology) | 7 / 28 | #6F8C99 glass curtain wall | flat | 2008 | db [bob_globalworth] [osm] |

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
| w237911115 | Strada Barbu Văcărescu | SW | 301-311 | office · AFI Lakeview | 15 | 65 | 2010 |  | modern office/glass curtain wall | #6F8C99 est | 2 |
| w289666722 | Strada Barbu Văcărescu | SW |  | yes | 8 | 38 |  |  | unknown (use district rule) | #D9D6CF est | 0 |
| w771247146 | Strada Barbu Văcărescu | SW | 313-315 | office · Zone 313 | 10 | 35 |  |  | modern office/glass curtain wall | #6F8C99 est | 0 |
| w232754997 | Strada Barbu Văcărescu | SW | 246D | office · FCC Office Building | 7 | 22 |  |  | modern office/glass curtain wall | #6F8C99 est | 1 |
| w1289605669 | Strada Gara Herăstrău | NE | 2A | apartments · Corp A | 15 | 53 |  |  | communist-era block (likely) | #C7C3BA est | 0 |
| w1289605668 | Strada Gara Herăstrău | E | 2A | apartments · Corp B | 15 | 53 |  |  | communist-era block (likely) | #D9D6CF est | 0 |
| w231123133 | Strada Gara Herăstrău | NE |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
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
| n4548556190 | DHL | DHL bg #FFCC00 fg #D40511 | amenity=post_office | Strada Barbu Văcărescu | SW | 301 |
| n6853428014 | Huawei Enterprise Romania GSC |  | office=company | Strada Barbu Văcărescu | W | 301 |
| n2443484061 | Raiffeisen Bank Romania | Raiffeisen Bank bg #FFE600 fg #000000 | office=company | Strada Barbu Văcărescu | SW | 246D |
| w823202265 |  |  | amenity=parking | Strada George Constantinescu | NE |  |
| n11187972861 | A•R•C Bakery |  | amenity=restaurant | Strada George Constantinescu | NE | 2-4 |
| n10111661679 | Fayn |  | amenity=restaurant | Strada George Constantinescu | SW | 9B |
| n1579273709 | Honeywell Romania |  | office=company | Strada George Constantinescu | SW | 3 |
| n3749088960 | Medicover |  | amenity=doctors | Strada George Constantinescu | NE | 2C |
| n3392494601 | Mood Media |  | office=company | Strada George Constantinescu | SW | 3 |
| n7063165051 | Radcom |  | office=it | Strada George Constantinescu | NE | 2C |
| n12652303089 | Ted's Coffee Co. | Ted's Coffee Co. bg #1F1F1F fg #FFFFFF | amenity=cafe | Strada George Constantinescu | NE |  |
| w823202263 |  |  | amenity=parking | Șoseaua Fabrica de Glucoză | S |  |

Other branded businesses in the district (off-route): 5 to go (Bulevardul Dimitrie Pompeiu, n4080665314); Catena (Bulevardul Dimitrie Pompeiu, n4080665316); Fornetti (Bulevardul Dimitrie Pompeiu, n10113539352); Luca (Bulevardul Dimitrie Pompeiu, n6435803578); Raiffeisen Bank (Bulevardul Dimitrie Pompeiu, n1563503912); Euronet (Strada Gara Herăstrău, n7071797487); Patria Bank (Strada Gara Herăstrău, n4831193724); 5 to go (, n8828063881); Alpha Bank (, n4375547592); Auchan (, n11958088007); BCR (, n9574970238); BCR (, w318990256); BRD (, n10113539339); Banca Transilvania (, n10113539338); CEC Bank (, n5014501222); Calzedonia (, n4866452022); Carrefour Express (, n7024202579); Carrefour Market (, n4618747780); Carrefour Market (, n4866483524); Chopstix (, n2484089641); Cărturești (, n2484089644); Douglas (, n4866286221); Froo (, n13808225715); Garanti (, n3796917465); Garanti (, n4375519191); Help Net (, n2484107173); Intersport (, n2484107185); KFC (, n2484107187); McDonald's (, n2484107194); Mega Image (, n3056571033); Noriel (, n2484107196); OPTIblu (, n12088849037); Orange (, n4866516025); Pizza Hut (, n5014501224); Pizza Hut (, n9226855841); Profi (, n4866592324); Raiffeisen Bank (, n4866553723); Raiffeisen Bank (, n5014501122); Regina Maria (, n6436505010); Samsonite (, n5014390421); Starbucks (, n4107002593); Starbucks (, n6155859303); Ted's Coffee Co. (, n12652303088); Ted's Coffee Co. (, n12759697006); Telekom (, n2484107170); UniCredit (, n4167364826); UniCredit (, n7080689124); Vodafone (, n4866524526); Yves Rocher (, n4866280923); dm (, n4866520622); Inmedio (, n2484107183); Inmedio (, n5014501121); Libra Bank (Șoseaua Fabrica de Glucoză, n13333870192); Shop&Go (Șoseaua Fabrica de Glucoză, n12079963619); Carrefour Market (Șoseaua Pipera, n11096758505); Ted's Coffee Co. (Șoseaua Pipera, n11958088014).

## Transit

- Lines with OSM route relations touching the district: bus 112, bus 135, bus 330, bus 343, bus 416, bus 449, bus 459, bus 461, bus 1929, tram 5.
- Stops: Barbu Văcărescu (bus); Chefalului (bus); Cloud 9 (bus); Electronica (tram); George Constantinescu (bus); Marin Drăcea (bus); Metrou Pipera (bus); Muzeul Aviației (bus); Muzeul Aviației (tram); Pipera-Cosmopolis (bus); Platforma Industrială Pipera (tram); Platforma Pipera (bus); Rocin (bus); Rocin (tram); Șoseaua Fabrica de Glucoză (bus); Șoseaua Pipera (tram).
- Metro entrances: Pipera  (44.48078, 26.11660); Pipera  (44.48073, 26.11639).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

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
