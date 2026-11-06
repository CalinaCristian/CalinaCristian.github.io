# Bucharest — Floreasca (`floreasca`): field research dossier

Role: research-buc-districts · generated 2026-11-06 22:53 UTC · machine-readable twin: `bucharest-floreasca.json` · images: `refs/floreasca/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Calea Floreasca, Strada General Giuseppe Garibaldi, Strada Georges Bizet, Strada Johann Strauss, Strada Serghei Vasilievici Rahmaninov |
| route_streets_researched | Calea Floreasca, Strada General Giuseppe Garibaldi, Strada Georges Bizet, Strada Johann Strauss, Strada Serghei Vasilievici Rahmaninov |
| fronting_route_buildings | 82 |
| fronting_route_with_height | 24.4 |
| fronting_route_with_colour | 3.7 |
| fronting_route_researched | 3.7 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 100.0 |
| fronting_main_buildings | 338 |
| fronting_main_with_height | 32.5 |
| buildings_total | 1916 |
| buildings_with_height | 18.3 |
| businesses_total | 488 |
| businesses_on_route | 39 |
| businesses_branded | 82 |
| trees_osm | 0 |
| lamps_osm | 1 |
| crossings | 237 |
| signal_nodes | 33 |
| transit_stops | 43 |
| metro_entrances | 0 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.454, 26.096], [44.479, 26.096], [44.479, 26.112], [44.454, 26.112]]` → bbox `[44.454, 26.096, 44.479, 26.112]`, area **3.532 km²**.
- Why: Extraction area = world agent bbox from cities.js BUC_DISTRICTS (so every street the world builds is covered). 1.41 km N-S × 0.81 km E-W ≈ 1.14 km²: Calea Floreasca from Piața Floreasca (market, S) to Str. Gheorghe Țițeica (N), the 'composer streets' villa quarter (Mozart, Chopin, Bach, Verdi, Ceaikovski, Garibaldi) east of it, Parcul/Grădina Floreasca west of it; edges on quiet residential streets (Str. Banul Antonache W, Str. Ramuri Tei/Kepler E, Bd. Lacul Tei S-ish). Sky Tower (137 m) and Promenada lie 600 m north — render as skyline backdrop.
- Research-proposed compact ~1 km² polygon (optional tighter cut): `[[44.4595, 26.099], [44.4722, 26.099], [44.4722, 26.1092], [44.4595, 26.1092]]`

## Chapter routes

### rosetti · 2009 — Liceul Teoretic C.A. Rosetti

- **Start**: WORLD START: Calea Floreasca northbound, 400 m before Piața Floreasca — `44.455787, 26.10069`, heading 358° on Calea Floreasca.
- **End**: Liceul C.A. Rosetti gate, Str. Garibaldi 11 (one-way northbound; school on the left/W side) — `44.467042, 26.106527`.
- **Length**: 2320 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Start at Piața Floreasca market and drive north up Calea Floreasca (park and old cinema garden on the left, Nusco/One Tower offices, cafes; Sky Tower dead ahead on the skyline) → right into one-way Str. Johann Strauss → Rahmaninov → Georges Bizet through the 1930s composer-street villa grid → left onto one-way Str. Garibaldi north to the school gate.
- **Sequence**: Calea Floreasca (1910 m) → Strada Johann Strauss (153 m) → Strada Serghei Vasilievici Rahmaninov (38 m) → Strada Georges Bizet (176 m) → Strada General Giuseppe Garibaldi (42 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4565, "lon": 26.1, "road": "Calea Floreasca", "bearing": 8}, {"lat": 44.47, "lon": 26.103, "road": "Calea Floreasca", "bearing": 0}, {"lat": 44.46745, "lon": 26.10635, "road": "Garibaldi", "bearing": 0}]`

### db · 2017 — Deutsche Bank (world pin: Floreasca Park) — see pipera for the real DB building

- **Start**: WORLD START: Calea Floreasca northbound — `44.457969, 26.100559`, heading 2° on Calea Floreasca.
- **End**: cities.js db pin (44.4760, 26.1030) — `44.47601, 26.103147`.
- **Length**: 2126 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: World chapter as configured: north on Calea Floreasca past Rosetti's quarter and Parcul Floreasca to the Sky Tower / Barbu Văcărescu junction and the cities.js db pin. NOTE research finding: DB Global Technology is actually at BOB Tower, Bd. Dimitrie Pompeiu 6A (pipera).
- **Sequence**: Calea Floreasca (2106 m) → (living_street) (20 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4575, "lon": 26.101, "road": "Calea Floreasca", "bearing": 10}, {"lat": 44.47, "lon": 26.103, "road": "Calea Floreasca", "bearing": 0}, {"lat": 44.476, "lon": 26.103}]`

## CV stops (verified)

### rosetti — Liceul Teoretic C.A. Rosetti

- **address**: Str. General Giuseppe Garibaldi 11, Sector 2
- **building_osm**: w28240279 (school, 3 levels) inside grounds w253216276
- **lat**: 44.46719
- **lon**: 26.10607
- **door**: lat: 44.46709; lon: 26.1063; street: Strada General Giuseppe Garibaldi; side: W side of a ONE-WAY NORTHBOUND street (address node n7119137467); note: school yard with fence and gate on Garibaldi; Școala Gimnazială "Maria Rosetti" is a different school at Garibaldi 3 — do not confuse
- **building**: storeys: 3; facade: 1950s–60s school block: rendered masonry, cream/light-yellow walls (#E8DDB8 est.) with white window frames, regular grid of tall windows, flat or low hipped roof; fenced sports yard; seismic: listed by the Ministry of Education among Bucharest school buildings at seismic risk (class not given); conf: storeys high (OSM); facade low (verify) [osm] [edupedu_seismic] [bucharest_ro_rosetti]
- **cities_js_check**: cities.js rosetti {44.4565, 26.1055} is ~1.2 km SOUTH of the school (it lands near Spitalul Floreasca / Bd. Ștefan cel Mare). Use {44.4671, 26.1062}; Garibaldi is ONE-WAY NORTHBOUND along its whole length (approach from the south or via Bizet/Rahmaninov).

### db — DB Global Technology (Deutsche Bank tech centre) — NOT in Floreasca

- **address**: Bd. Dimitrie Pompeiu 6A, Sector 2 (Pipera)
- **osm**: n12252625817 (office=company "Deutsche Bank Global Technology", 44.4798094, 26.1146639)
- **finding**: The DB technology centre opened in 2014 (UpGround/Dimitrie Pompeiu area) and has had its HQ on Bd. Dimitrie Pompeiu since at least 2015 (6,000+ m² on two floors in a building DB sold to Globalworth and leased back); the current careers page lists 6A Dimitrie Pompeiu Blvd, 020337. No source places it in Floreasca Park (Șos. Pipera 43) or at Calea Floreasca 169A (= Floreasca Business Park, tenants Oracle/Xerox/Holcim/GE…).
- **recommendation**: Move chapter `db` (2017) to district `pipera` — the DB building is ~150 m from Hermes Business Campus (luxoft). See bucharest-pipera.md for its route.
- **src**: ['db_careers', 'db_hq_2015']

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Calea Floreasca (chapter route)

- OSM: 60 ways, 3434 m in district, classes living_street, secondary, tertiary; lanes values ['1', '2', '3', '4', '5', '6']; one-way segments 24/60; maxspeed ['10', '50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 135, bus 343, bus 449, bus 459, bus 461.
- OSM furniture: {'gate': 3, 'lift_gate': 1, 'bollard': 12, 'parking_entrance': 2}.
- Fronting buildings: 74; businesses: 56.
- **cross_section**: Main N–S artery of the quarter: 2 lanes northbound + 1–2 southbound (OSM lanes 3–5 incl. turn pockets "left/through/through;right"), split into one-way pairs around short islands at Piața Floreasca and Ceaikovski; 50 km/h; kerbside parking lanes (parking=lane) on long stretches; buses 135, 343, 461 (no trolley, no tram)
- **frontage**: W side: Piața Floreasca market (S end), Nusco Floreasca 1–2 offices (141-143, 5 lv), Souk (131B), Agora Floreasca mall (111-113), One Tower (151, 16 lv glass, 2020s), Sanador clinic (165), Parcul Floreasca / former Cinema Floreasca park; E side: 3–4-storey 1930s–50s villas and small blocks with shops, cafes and restaurants on the ground floor (Floreasca became a nightlife/food hotspot)
- **trees**: mature linden/chestnut rows both sides; park trees on the W side
- **sidewalks**: 3–4 m grey pavers (renovated) with cars on the kerb edge in places
- **skyline**: Sky Tower (137 m, 37 floors, Romania's tallest) and the Promenada/Floreasca City Center complex 600 m north dominate the view northbound
- confidence: lanes high (OSM); frontage medium [osm] [wp_fcc] [skytower_ctbuh] [floreasca_nightlife]

### Strada Serghei Vasilievici Rahmaninov (chapter route)

- OSM: 12 ways, 1355 m in district, classes residential; lanes values ['1', '2']; one-way segments 9/12; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 41; businesses: 2.
- **cross_section**: mostly one-way single lane, residential; villas + 3–4-storey 1930s blocks
- confidence: high (OSM) [osm]

### Strada General Giuseppe Garibaldi (chapter route)

- OSM: 8 ways, 917 m in district, classes residential; lanes values ['2']; one-way segments 8/8; maxspeed ['30', '40']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'gate': 1, 'bollard': 1}.
- Fronting buildings: 25; businesses: 3.
- **cross_section**: ONE-WAY NORTHBOUND single lane, residential (RO:urban 50, effectively 30), asphalt, cars parked on both sides half on the sidewalk; narrow 1.5–2 m sidewalks with linden/robinia trees
- **frontage**: interwar villas (2–3 storeys, stucco, pitched tile roofs, wrought-iron fences) + the C.A. Rosetti school (11) and Maria Rosetti school (3)
- confidence: one-way high (OSM); frontage medium [osm] [strazi_compozitori]

### Strada Georges Bizet (chapter route)

- OSM: 2 ways, 363 m in district, classes residential; lanes values ['2']; one-way segments 2/2; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 8; businesses: 0.
- **cross_section**: one-way, single lane, villas
- confidence: high (OSM) [osm]

### Strada Johann Strauss (chapter route)

- OSM: 1 ways, 153 m in district, classes residential; lanes values []; one-way segments 1/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 4; businesses: 2.
- **cross_section**: one-way eastbound, single lane; Hotel Johann Strauss (no. 1), 5-storey small blocks
- confidence: high (OSM) [osm]

### Strada Barbu Văcărescu

- OSM: 34 ways, 5965 m in district, classes primary; lanes values ['2', '3', '4']; one-way segments 34/34; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 182, bus 282, bus 330, bus 449, bus 461, bus 1929, tram 5.
- OSM furniture: {'lift_gate': 1, 'gate': 7, 'bicycle_rental': 1, 'charging_station': 1, 'parking_entrance': 1}.
- Fronting buildings: 86; businesses: 37.
- **cross_section**: primary, multi-lane (outside the proposed boundary to the east/north); offices
- confidence:  [osm]

### Strada Mihail Ivanovici Glinka

- OSM: 13 ways, 1121 m in district, classes service, tertiary; lanes values ['1', '2', '3', '4']; one-way segments 8/13; maxspeed ['40', '50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'drinking_water': 1}.
- Fronting buildings: 10; businesses: 3.

### Strada Wolfgang Amadeus Mozart

- OSM: 1 ways, 955 m in district, classes residential; lanes values ['2']; one-way segments 1/1; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 49; businesses: 0.

### Strada Frédéric Chopin

- OSM: 1 ways, 955 m in district, classes residential; lanes values ['2']; one-way segments 1/1; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 46; businesses: 1.

### Strada Gheorghe Țițeica

- OSM: 9 ways, 860 m in district, classes living_street, tertiary; lanes values ['1', '2']; one-way segments 1/9; maxspeed ['10', '50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'lift_gate': 3}.
- Fronting buildings: 20; businesses: 3.

### Strada Johann Sebastian Bach

- OSM: 5 ways, 683 m in district, classes residential; lanes values []; one-way segments 4/5; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'bollard': 1}.
- Fronting buildings: 19; businesses: 1.

### Bulevardul Lacul Tei

- OSM: 6 ways, 622 m in district, classes secondary; lanes values ['2', '4']; one-way segments 4/6; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 182, bus 282.
- Fronting buildings: 4; businesses: 7.

### Strada Piotr Ilici Ceaikovski

- OSM: 5 ways, 525 m in district, classes tertiary; lanes values ['2', '3']; one-way segments 0/5; maxspeed ['40', '50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 282, bus 461, tram 5.
- Fronting buildings: 7; businesses: 5.

### Bulevardul Mircea Eliade

- OSM: 9 ways, 505 m in district, classes tertiary; lanes values ['3', '4', '5']; one-way segments 0/9; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 282, bus 343, bus 461.
- OSM furniture: {'lift_gate': 3}.
- Fronting buildings: 1; businesses: 1.

### Strada Giuseppe Verdi

- OSM: 5 ways, 504 m in district, classes residential; lanes values ['1', '2']; one-way segments 4/5; maxspeed ['30']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 5; businesses: 0.

### Strada Ramuri Tei

- OSM: 7 ways, 471 m in district, classes tertiary; lanes values ['1', '2']; one-way segments 2/7; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'lift_gate': 1}.
- Fronting buildings: 10; businesses: 0.

### Strada Giacomo Puccini

- OSM: 3 ways, 396 m in district, classes residential; lanes values []; one-way segments 3/3; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 17; businesses: 1.

## Squares, junctions, landmarks

- **Calea Floreasca × Str. Ceaikovski / Mircea Eliade** — signalised, turn pockets;  [osm]
- **Calea Floreasca × Piața Floreasca (Glinka)** — split around islands, market crowds;  [osm]
- **Sky Tower (Floreasca City Center)** (`skytower`, w219622660 44.47797, 26.10473) — 137 m, 37 floors (+5 basements), opened Oct 2012; elongated-elliptical plan, blue-green glass curtain wall with a cylindrical crown and spire, lit at night; outside the proposed boundary → render as skyline backdrop on the northbound drive [wp_fcc] [skytower_ctbuh] [skytower_site]
- **Promenada Mall** (`promenada`,  44.4783, 26.103) — opened Oct 2013 next to Sky Tower; landscaped/green roof terraces; backdrop only [wp_fcc]
- **Piața Floreasca (market)** (`piata_floreasca`, w34832556) — covered market hall + stalls at the S end of Calea Floreasca [osm]
- **Parcul Floreasca / Grădina Floreasca** (`parcul_floreasca`, w586357887) — park west of Calea Floreasca with old trees; former summer cinema garden [osm] [parcul_floreasca]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|
| n255895985 | Calea Floreasca × Strada Chile |  |  | 1 |
| n255896378 | Calea Floreasca × Strada Cronicarilor |  |  | 2 |
| n255896966 | Calea Floreasca × Strada Tudor Vianu |  |  | 1 |
| n255898050 | Calea Floreasca × Strada Aviator Stefan Protopopescu |  |  | 2 |
| n255902519 | Calea Floreasca × Strada Béla Bartók |  |  | 3 |
| n255903788 | Calea Floreasca × Strada Soldat Neagu Florea |  |  | 2 |
| n255906425 | Calea Floreasca × Strada Aviator Muntenescu |  |  | 1 |
| n292022780 | Calea Floreasca × Strada George Călinescu |  |  | 3 |
| n255902372 | Strada Piotr Ilici Ceaikovski × Strada Serghei Vasilievici Rahmaninov |  |  | 2 |
| n255901658 | Calea Floreasca × Strada Donizetti Gaetano |  |  | 3 |
| n2136557810 | Calea Floreasca × Strada Mihail Ivanovici Glinka | yes |  | 3 |
| n2197742153 | Calea Floreasca × Strada Bălănescu Rosetti |  |  | 3 |
| n255903785 | Calea Floreasca × Strada Căpitan Gheorghe Bulugea |  |  | 1 |
| n5292984469 | Calea Floreasca × Strada Locotenent Gheorghe Bănciulescu |  |  | 1 |
| n255897446 | Calea Floreasca × Strada Puțul lui Zamfir |  |  | 3 |
| n255908198 | Calea Floreasca × Strada Ghiță Pădureanu |  |  | 1 |
| n255908220 | Calea Floreasca × Strada Johann Strauss |  |  | 1 |
| n255908298 | Calea Floreasca × Strada Grădiștea Floreștilor |  |  | 1 |
| n255908343 | Calea Floreasca × Strada Postelnicul Stroe |  |  | 1 |
| n255908468 | Calea Floreasca × Strada Radu Captariu |  |  | 2 |
| n255908521 | Calea Floreasca × Strada Sergent Constantin Șomoiog |  |  | 2 |
| n255908609 | Calea Floreasca × Strada Theodor Buzoiu |  |  | 1 |
| n255908614 | Calea Floreasca × Strada Sergent Matei Dumitru |  |  | 1 |
| n255909117 | Calea Floreasca × Strada Biserica Floreasca |  |  | 2 |
| n255903801 | Strada General Giuseppe Garibaldi × Strada Piotr Ilici Ceaikovski |  |  | 1 |
| n257018571 | Calea Floreasca × Strada Țărmului |  |  | 1 |
| n656960 | Bulevardul Mircea Eliade × Calea Floreasca × Strada Piotr Ilici Ceaikovski | yes |  | 5 |
| n656968 | Calea Floreasca × Șoseaua Fabrica de Glucoză | yes |  | 4 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w245407585 | Nusco Floreasca 2 | 5 /  | #C8C8C4 glass + aluminium panels |  |  |  [osm] |
| w872211888 | One Tower (Calea Floreasca 165/151) | 16 /  | #6F8A94 glass curtain wall |  | 2020s |  [osm] |
| w28240279 | Liceul Teoretic C.A. Rosetti (main block) | 3 / 11 | #E8DDB8  | flat/low | post-war school block (est.) | rosetti [osm] [edupedu_seismic] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w1441704043 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245345970 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245531546 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w245531551 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w547626902 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w245531547 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w669019900 | Calea Floreasca | E | 28,29,30 | house | 2 est |  |  |  | low house/villa (19th-early 20th c. likely) | #E9E0CF est | 0 |
| w373440312 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w1068718923 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245345967 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w1441704040 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245345977 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w183889462 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w1100942782 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w183889434 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 1 |
| w245345978 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245414403 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245414387 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w245345979 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245414402 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w245345981 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w245414417 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 1 |
| w245345968 | Calea Floreasca | E | 48B | residential | 4 |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w245414397 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w1189550033 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w1189550034 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245345972 | Calea Floreasca | E |  | house | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #D8C7A8 est | 0 |
| w245345960 | Calea Floreasca | W | 55 | office · Grand Offices | 6 |  |  |  | modern office/glass curtain wall | #6F8A94 est | 0 |
| w245345971 | Calea Floreasca | E | 54 | residential | 5 |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w245407584 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245407580 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245414409 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w1449310899 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w1449310898 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245414399 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245407582 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w245414406 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w245414383 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w547824665 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245414379 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w1100942503 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w203630337 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w245414391 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w245345964 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245414410 | Calea Floreasca | W |  | apartments | 5 |  |  |  | unknown (use district rule) | #DAD3C4 est | 1 |
| w245345965 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245345961 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w245407587 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w547820093 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w245407585 | Calea Floreasca | W | 141-143 | office · Nusco Floreasca 2 | 5 |  |  |  | unknown (use district rule) | #C8C8C4 | 1 |
| w1235259483 | Calea Floreasca | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w39348919 | Calea Floreasca | W | 131B | commercial · Souk | 5 est |  |  |  | unknown (use district rule) | #DAD3C4 est | 1 |
| w39348923 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #EDE3D2 est | 0 |
| w39348922 | Calea Floreasca | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w39348410 | Calea Floreasca | E |  | apartments | 4 |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w245418767 | Calea Floreasca | E |  | yes | 4 |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w39348409 | Calea Floreasca | E |  | yes | 4 |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w872211888 | Calea Floreasca | W | 151 | commercial · One Tower | 16 |  |  |  | modern office/glass curtain wall | #6F8A94 | 2 |
| w39348408 | Calea Floreasca | E | 142 | apartments | 4 |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w245421189 | Calea Floreasca | SE |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w245081772 | Calea Floreasca | SW |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w39348381 | Strada General Giuseppe Garibaldi | E | 24 | apartments | 3.0 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39348378 | Strada General Giuseppe Garibaldi | W |  | apartments | 3 |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39348382 | Strada General Giuseppe Garibaldi | E | 26 | apartments | 3.0 est |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w39348377 | Strada General Giuseppe Garibaldi | W | 9 | apartments | 3.0 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w39348383 | Strada General Giuseppe Garibaldi | E | 26A | apartments | 3.0 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w28240279 | Strada General Giuseppe Garibaldi | W | 11 | school | 3 |  |  |  | unknown (use district rule) | #E8DDB8 | 0 |
| w39349681 | Strada General Giuseppe Garibaldi | E | 26 | apartments | 5 est |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w39349682 | Strada General Giuseppe Garibaldi | E | 28 | apartments | 5 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w39349683 | Strada General Giuseppe Garibaldi | E | 30 | apartments | 5 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39349684 | Strada General Giuseppe Garibaldi | E | 32 | apartments | 5 est |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w39243562 | Strada Serghei Vasilievici Rahmaninov | W | 3 | apartments | 4 |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w39243566 | Strada Serghei Vasilievici Rahmaninov | W |  | yes | 5.0 est |  |  |  | unknown (use district rule) | #E4D2B0 est | 0 |
| w39348366 | Strada Serghei Vasilievici Rahmaninov | E | 6 | apartments | 3 |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39243567 | Strada Serghei Vasilievici Rahmaninov | W |  | yes | 5.0 est |  |  |  | unknown (use district rule) | #D8C7A8 est | 0 |
| w39348367 | Strada Serghei Vasilievici Rahmaninov | E | 8 | apartments | 3 |  |  |  | unknown (use district rule) | #DAD3C4 est | 0 |
| w39348374 | Strada Georges Bizet | S | 7 | apartments | 3.0 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w253165221 | Strada Georges Bizet | N | 10 | residential · Georges Bizet 10 | 5 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39348364 | Strada Johann Strauss | S |  | yes | 3 |  |  |  | unknown (use district rule) | #D9C9B4 est | 0 |
| w39348363 | Strada Johann Strauss | S | 2B | yes | 5 |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w39243577 | Strada Johann Strauss | S | 2A | yes | 5 |  |  |  | unknown (use district rule) | #DAD3C4 est | 1 |
| w39348402 | Strada Johann Strauss | N | 1 | yes · Hotel Johann Strauss |  | 4 |  |  | unknown (use district rule) | #D8C7A8 est | 1 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| n7038739416 |  |  | disused:shop=motorcycle_repair | Calea Floreasca | W | 43 |
| w245531548 |  |  | amenity=parking | Calea Floreasca | E |  |
| w1441704033 |  |  | amenity=parking | Calea Floreasca | E |  |
| w1441704041 |  |  | amenity=parking | Calea Floreasca | E |  |
| n6968373520 | Agora Floreasca |  | shop=mall | Calea Floreasca | W | 111-113 |
| n6968373513 | Beat45 |  | leisure=fitness_centre | Calea Floreasca | W |  |
| n14289829501 | Chez Toni |  | amenity=restaurant | Calea Floreasca | E | 70-72 |
| n9507965361 | Clinica Sanador Floreasca |  | amenity=clinic | Calea Floreasca | W | 165 |
| n6968373516 | E3 by Entourage |  | amenity=restaurant | Calea Floreasca | W |  |
| n2637716363 | Farmaplus |  | amenity=pharmacy | Calea Floreasca | W | 133-137 |
| n678826122 | Garanti Bank | Garanti bg #00854A fg #FFFFFF | amenity=bank | Calea Floreasca | W | 141-143 |
| n2526169547 | Komodo Lounge |  | amenity=restaurant | Calea Floreasca | E | 60 |
| n7038739495 | Komodo Lounge |  | amenity=restaurant | Calea Floreasca | E |  |
| n7038741853 | Maxbet | Maxbet bg #000000 fg #FFD200 | shop=bookmaker | Calea Floreasca | W | 91-111 |
| n6968373511 | Medissima |  | amenity=clinic | Calea Floreasca | W |  |
| n11069855155 | Medlife |  | amenity=clinic | Calea Floreasca | W | 111-113 |
| n6968373508 | Mega Image Maison des Chefs | Mega Image bg #E30613 fg #FFFFFF | amenity=restaurant | Calea Floreasca | W | 111-113 |
| n5053344722 | Mondayz Coffee |  | amenity=cafe | Calea Floreasca | W |  |
| n6968373518 | No7 |  | amenity=restaurant | Calea Floreasca | W |  |
| n2794388697 | Nomasvello |  | shop=beauty | Calea Floreasca | W | 141-143 |
| n6968373506 | Paul | Paul bg #1A1A1A fg #FFFFFF | shop=bakery | Calea Floreasca | W |  |
| n7038726925 | Pizzeria Due Amici |  | amenity=restaurant | Calea Floreasca | E |  |
| n6968373509 | Raionul Floreasca |  | shop=seafood | Calea Floreasca | W |  |
| n6968373514 | Rosa Mundi |  | shop=perfumery | Calea Floreasca | W |  |
| n11069880299 | Ruka Izakaya |  | amenity=restaurant | Calea Floreasca | W | 111-113 |
| n6968373505 | Sara |  | amenity=restaurant | Calea Floreasca | W |  |
| n7038732501 | Schnitzel King |  | amenity=restaurant | Calea Floreasca | W |  |
| w39348919 | Souk |  | amenity=restaurant | Calea Floreasca | W | 131B |
| n6968373510 | The Beer Institute |  | amenity=pub | Calea Floreasca | W |  |
| n2315924186 | Trattoria Il Calcio Floreasca |  | amenity=restaurant | Calea Floreasca | E | 118-120 |
| n11466128556 | Treevi Pizza |  | amenity=restaurant | Calea Floreasca | W | 159-162 |
| n11423477323 | Uanderful |  | amenity=restaurant | Calea Floreasca | E | 240B |
| n4834993725 | Vacamuuu |  | amenity=restaurant | Calea Floreasca | W | 111 |
| n6968373512 | Verso Cărturești | Cărturești bg #FFFFFF fg #000000 | shop=books | Calea Floreasca | W |  |
| n2463675992 | Vulcanizare Auto |  | shop=car_repair | Calea Floreasca | SE |  |
| n11916478455 | iMZA Fine Cuisine |  | amenity=restaurant | Calea Floreasca | W | 133 |
| n2637716387 | moft |  | amenity=restaurant | Calea Floreasca | W | 111-113 |
| n7106638174 | Centrul de Diabet, Nutritie si Metabolism |  | amenity=clinic | Strada Johann Strauss | S |  |
| w39348402 | Hotel Johann Strauss |  | tourism=hotel | Strada Johann Strauss | N | 1 |

Other branded businesses in the district (off-route): Euronet (Bulevardul Dimitrie Pompeiu, n7071915116); Farmacia Tei (Bulevardul Lacul Tei, n3530644614); Ted's Coffee Co. (Bulevardul Lacul Tei, n3766017226); BRD (Calea Dorobanților, n328585677); Catena (Calea Dorobanților, n2637716146); Garanti (Calea Dorobanților, n4657735590); ING (Calea Dorobanților, n2394901656); Leonidas (Calea Dorobanților, n9988104517); Libra Bank (Calea Dorobanților, n7056384863); OTP Bank (Calea Dorobanților, n7038716407); Shop&Go (Calea Dorobanților, n13132808504); Superbet (Calea Dorobanților, n13429496917); CEC Bank (Calea Floreasca, n4833254521); OPTIblu (Calea Floreasca, n2484113356); Paul (Calea Floreasca, n2484113369); Regina Maria (Calea Floreasca, w245345976); Starbucks (Calea Floreasca, n4833254421); Shop&Go (Strada Aghireș, n14316864304); Banca Transilvania (Strada Axinte Uricariul, n3707543170); Carrefour Express (Strada Axinte Uricariul, n5068656516); Libra Bank (Strada Axinte Uricariul, n1768905825); Opticris (Strada Axinte Uricariul, n13427923367); Regina Maria (Strada Axinte Uricariul, n4766207560); Ted's Coffee Co. (Strada Axinte Uricariul, n13427923366); Help Net (Strada Banul Antonache, n6968373503); Mega Image (Strada Banul Antonache, n5832762987); DHL (Strada Barbu Văcărescu, n4548556190); Euronet (Strada Barbu Văcărescu, n4108393289); MOL (Strada Barbu Văcărescu, n2437148866); Lidl (Strada Barbu Văcărescu, n10904467979); MOL (Strada Barbu Văcărescu, w235639134); MOL (Strada Barbu Văcărescu, n2434411598); McDonald's (Strada Barbu Văcărescu, w28212133); Auchan (Strada Barbu Văcărescu, n11079124001); Petrom (Strada Barbu Văcărescu, n509051950); Raiffeisen Bank (Strada Barbu Văcărescu, n2443484061); Farmacia Dona (Strada Bălănescu Rosetti, n6968373519); Euronet (Strada Dinu Vintilă, n7057960555); Exim Banca Românească (Strada Dinu Vintilă, n3766017229); Shop&Go (Strada Dinu Vintilă, n11383539225); Help Net (Strada Hristache Pitarul, n1768906184); Help Net (Strada Mihail Ivanovici Glinka, n2637394284); Superbet (Strada Puțul lui Zamfir, n8628417842); Orange (Strada Școala Floreasca, n2484948513); Auchan (, n11958088007); BCR (, n9574970238); CEC Bank (, n5014501222); Calzedonia (, n4866452022); Carrefour Market (, n4866483524); Carrefour Market (, w28212047); Chopstix (, n2484089641); Cărturești (, n2484089644); Douglas (, n4866286221); Dr. Max (, n4866258022); Euronet (, n7055303540); Farmacia Tei (, n6476493485); Help Net (, n2484107173); ING (, n2394839102); ING (, n7026814342); Intersport (, n2484107185); KFC (, n2484107187); Kaufland (, w28211996); McDonald's (, n2484107194); Noriel (, n2484107196); Orange (, n4866516025); Pizza Hut (, n5014501224); Profi (, n4866592324); Raiffeisen Bank (, n4866553723); Raiffeisen Bank (, n5014501122); Samsonite (, n5014390421); Sephora (, n4866265921); Telekom (, n2484107170); Vodafone (, n4866524526); Yves Rocher (, n4866280923); dm (, n4866520622); Inmedio (, n2484107183); Inmedio (, n5014501121).

## Transit

- Lines with OSM route relations touching the district: bus 135, bus 182, bus 282, bus 301, bus 330, bus 331, bus 335, bus 343, bus 416, bus 449, bus 459, bus 461, bus 1929, bus 331B, tram 5.
- Stops: Ancuța Băneasa (bus); Barbu Văcărescu (bus); Bd. Lacul Tei (bus); Bulevardul Lacul Tei (bus/tram); Bulevardul Lacul Tei (tram); Calea Floreasca (bus); Ceaicovski (bus); Ceaikovski (bus); Ceaikovski (tram); Chefalului (bus); Circul București (bus); Colegiul Național I. L. Caragiale (bus); Garibaldi (bus); George Călinescu (bus); Giuseppe Verdi (bus); Giuseppe Verdi (tram); Glinka (bus); Mihail Glinka (bus); Mircea Eliade (bus); Muzeul Aviației (bus); Muzeul Aviației (tram); Piața Floreasca (bus); Rossini (bus); Rossini (tram); Șoseaua Fabrica de Glucoză (bus); Șoseaua Ștefan cel Mare (bus).
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

### Matei (C.A. Rosetti pupil) (`rosetti_student`, local, lang ro, 15-18) — 16 lines
High-school student with headphones, walking to Str. Garibaldi.

- *greeting*: „Salut!” (Hi!) · „Neața!” (Morning!) · „Hei, și tu la Rosetti?” (Hey, are you at Rosetti too?)
- *bumped*: „Băi, atenție!” (Hey, watch it!) · „Scuze, întârzii la oră!” (Sorry, I'm late for class!) · „Ușor, frate.” (Easy, bro.)
- *photographed*: „Nu, nu, fără poze!” (No, no, no photos!) · „Ok, dar fă-o cool.” (Ok, but make it cool.) · „Pune filtru, te rog.” (Use a filter, please.)
- *idle*: „Avem test la mate azi.” (We have a maths test today.) · „În pauză mergem la Mega.” (At break we go to the Mega.) · „Simularea la bac e săptămâna viitoare.” (The mock baccalaureate is next week.)
- *district*: „Garibaldi e cu sens unic, toți părinții se blochează aici dimineața.” (Garibaldi is one-way, all the parents get stuck here in the morning.) · „Străzile din jur au nume de compozitori.” (The streets around have composers' names.) · „Sky Tower se vede de peste tot.” (You can see Sky Tower from everywhere.) · „După ore mergem în Parcul Floreasca.” (After school we go to Floreasca park.)

### Andrei (parent on the school run) (`school_parent`, local, lang ro, 35-50) — 16 lines
Double-parked with hazards on, dropping a kid off before work.

- *greeting*: „Bună dimineața!” (Good morning!) · „Salut, ești tot pe aici?” (Hi, still around here?) · „Bună, nu stau, am treabă!” (Hi, can't stop, I'm busy!)
- *bumped*: „Pardon, mă grăbesc!” (Pardon, I'm in a hurry!) · „Atenție, deschid portiera!” (Careful, opening the door!) · „Scuze, am avariile pornite doar un minut.” (Sorry, hazards on just for a minute.)
- *photographed*: „Acum? Sunt în pijama practic.” (Now? I'm basically in pyjamas.) · „Fă-i poză piticului, nu mie.” (Take the kid's picture, not mine.) · „Ok, repede, că vine poliția locală.” (OK, quick, the local police are coming.)
- *idle*: „Iar e coadă pe Calea Floreasca.” (Queue on Calea Floreasca again.) · „Am ședință la nouă în Pipera.” (I have a meeting at nine in Pipera.) · „Locul de parcare e un mit aici.” (A parking space is a myth here.)
- *district*: „Pe Garibaldi nu poți opri, dar toată lumea oprește.” (You can't stop on Garibaldi, but everyone does.) · „Până la Barbu Văcărescu fac douăzeci de minute.” (It takes me twenty minutes to Barbu Văcărescu.) · „La prânz vin iar s-o iau.” (I come back at lunch to pick her up.) · „Piața Floreasca are cele mai bune roșii.” (Piața Floreasca has the best tomatoes.)

### Alex (waiter, Calea Floreasca terrace) (`terrace_waiter`, staff, lang ro, 20-35) — 16 lines
Waiter at one of the restaurants that made Floreasca a food hotspot.

- *greeting*: „Bună seara, o masă pentru doi?” (Good evening, a table for two?) · „Bine ați venit!” (Welcome!) · „Aveți rezervare?” (Do you have a reservation?)
- *bumped*: „Atenție, am tava plină!” (Careful, my tray is full!) · „Pardon, vin din spate!” (Sorry, coming through behind!) · „Nu-i nimic, s-a salvat paharul.” (No problem, the glass survived.)
- *photographed*: „Fă poză la farfurie, e mai fotogenică decât mine.” (Photograph the plate, it's more photogenic than me.) · „Ne dați și un review?” (Will you leave us a review?) · „Zâmbim pentru Instagram!” (Smile for Instagram!)
- *idle*: „E full în seara asta.” (We're full tonight.) · „Bucătăria închide la unsprezece.” (Kitchen closes at eleven.) · „Terasa se deschide din aprilie.” (The terrace opens from April.)
- *district*: „Floreasca e acum zona cu cele mai multe restaurante noi.” (Floreasca now has the most new restaurants.) · „Parcare? Doar valet, din păcate.” (Parking? Valet only, unfortunately.) · „Corporatiștii din Sky Tower vin la prânz.” (The Sky Tower office crowd comes at lunch.) · „Lacul e la cinci minute pe jos.” (The lake is five minutes' walk.)

### Domnul Mihai (villa resident) (`villa_resident`, local, lang ro, 65-80) — 16 lines
Retired engineer living in a 1930s villa on a composer street, walking his dog.

- *greeting*: „Bună ziua.” (Good day.) · „Să trăiți!” (Greetings!) · „Bună ziua, vă pot ajuta cu ceva?” (Good day, can I help with something?)
- *bumped*: „Ei, atenție, tinere!” (Hey, careful, young man!) · „Mai încet, că sperii câinele.” (Slower, you'll scare the dog.) · „Nu-i nimic, nu-i nimic.” (It's nothing, nothing.)
- *photographed*: „Faceți poze la vile, sunt frumoase.” (Take pictures of the villas, they're lovely.) · „Pe mine? Ce să faceți cu un moș?” (Me? What would you want with an old man?) · „Fotografiați și teiul, are o sută de ani.” (Photograph the linden too, it's a hundred years old.)
- *idle*: „Pe vremuri aici era liniște.” (It used to be quiet here.) · „Au dărâmat vila de vizavi pentru un bloc.” (They knocked the villa opposite down for a block.) · „Câinele ăsta mă scoate de trei ori pe zi.” (This dog takes me out three times a day.)
- *district*: „Cartierul a fost parcelat în perioada interbelică.” (The quarter was laid out between the wars.) · „Străzile poartă nume de compozitori: Mozart, Chopin, Bach.” (The streets carry composers' names: Mozart, Chopin, Bach.) · „Turnul ăla de sticlă, Sky Tower, e cel mai înalt din țară.” (That glass tower, Sky Tower, is the tallest in the country.) · „Toamna castanii acoperă trotuarul.” (In autumn the chestnuts cover the sidewalk.)

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
| Calea Floreasca N (towards Barbu Văcărescu / Sky Tower) | 44.471, 26.1035 | 200 | [[8, 10], [17, 19.5]] | 0.7 | commuter queue towards the Barbu Văcărescu/Pipera office cluster [tomtom_peak] |
| Rosetti school run (Garibaldi/Ceaikovski) | 44.4665, 26.1055 | 140 | [[7.5, 8.25], [13, 14.5]] | 0.45 | double-parked parents on one-lane streets (local pattern; assumption) |
| Piața Floreasca market | 44.4605, 26.1005 | 120 | [[9, 13]] | 0.4 | Saturday-morning market traffic (assumption) |

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

- facades_villas: #E9E0CF #E4D2B0 #D8C7A8 #EDE3D2 #D9C9B4
- facades_interwar_modernist: #E8E1D3 #DAD3C4 #CFC8B8
- facades_1970s_90s_blocks: #BDB5A6 #C7C1B5
- glass_office: #6F8A94
- roof_tiles: #8C3B2A
- fence_iron: #2B2B2B
- road: #404045
- sidewalk: #A9A59C
- kerb: #9B9A94
- marking: #F4F4F0
- conf: medium/estimated

## Top 30 things a local would notice if wrong

1. Rosetti is NOT on Calea Floreasca — it is in the villa quarter on Str. Garibaldi 11, ~1.2 km north of the old pin.
2. Garibaldi and most composer streets are narrow ONE-WAY single-lane streets lined with parked cars.
3. Sky Tower dominates the northbound view: tallest building in Romania (137 m), glass, rounded, lit crown.
4. Calea Floreasca has buses only (135/343/461) — no tram, no trolleybus.
5. Floreasca is leafy: lindens and chestnuts over villa gardens; wrought-iron fences.
6. 1930s villas with red tile roofs, stucco in cream/ochre, many restored, some replaced by boutique blocks.
7. Ground-floor cafes/restaurants and clinics along Calea Floreasca (Sanador, Medlife, Agora).
8. Piața Floreasca market at the south end of the avenue.
9. Parcul Floreasca/grădina on the west side with tall trees.
10. Nusco and One Tower glass offices on the west side of Calea Floreasca.
11. Mega Image Maison des Chefs, Garanti bank on Calea Floreasca.
12. School yard fence and kids crossing at 07:45 and 13:00–14:00.
13. Cars parked on sidewalks everywhere in the villa grid.
14. Speed humps/raised zebras around schools (verify).
15. Calea Floreasca splits into one-way pairs around islands at junctions.
16. Late-evening crowds and valet parking at restaurants (nightlife hotspot).
17. No high-rise blocks in the villa grid except a few 4–5-storey ones.
18. Promenada mall and Floreasca Park office campus lie further north.
19. Lake Floreasca west of the district (strand/sports complex).
20. Overhead cables and older concrete lamp posts on side streets.
21. Red seismic-risk plaques on some older blocks.
22. Hotel Johann Strauss at the corner of Str. Johann Strauss.
23. Yellow taxis and Bolt/Uber cars idling at restaurants.
24. Kerbside parking lanes on Calea Floreasca.
25. Pedestrian signals with countdowns at Ceaikovski.
26. Embassy residences and guard booths are common in the area.
27. Calm, low traffic inside the grid; queues only on Calea Floreasca.
28. Street-name plates are blue with white text.
29. Gated driveways with sliding metal gates.
30. Autumn: chestnut leaves pile on the sidewalks.

## Gaps / to verify

- Rosetti facade/era unverified (no licensed photo yet)
- School-run congestion is an assumption, not sourced
- Villa-by-villa facades on Garibaldi not individually researched

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
| wp_floreasca | https://en.wikipedia.org/wiki/Floreasca |
| wp_fcc | https://en.wikipedia.org/wiki/Floreasca_City_Center |
| skytower_ctbuh | https://www.skyscrapercenter.com/building/floreasca-city-sky-tower/9029 |
| skytower_site | https://skytower.getanchor.io/index.html |
| strazi_compozitori | https://edituravremea.ro/images/pdf/StraziVI.pdf |
| edupedu_seismic | https://www.edupedu.ro/colegiul-national-gheorghe-sincai-si-alte-9-cladiri-de-scoli-din-bucuresti-pe-lista-ministerului-educatiei-de-scoli-in-pericol-de-prabusire-la-cutremur/ |
| bucharest_ro_rosetti | https://www.bucharest.ro/locations/education-c-a-rosetti-theoretical-high-school-390 |
| parcul_floreasca | https://zilesinopti.ro/locuri/parcul-floreasca/ |
| floreasca_nightlife | https://hotnews.ro/?p=1594020 |
