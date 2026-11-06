# Bucharest — Romană & Victoriei (`romana`): field research dossier

Role: research-buc-districts · generated 2026-11-06 22:18 UTC · machine-readable twin: `bucharest-romana.json` · images: `refs/romana/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Dacia, Bulevardul General Gheorghe Magheru, Bulevardul Lascăr Catargiu, Piața Romană, Piața Victoriei, Strada Clopotarii Vechi, Strada Grigore Alexandrescu, Strada Vasile Alecsandri |
| route_streets_researched | Bulevardul Dacia, Bulevardul General Gheorghe Magheru, Bulevardul Lascăr Catargiu, Piața Romană, Piața Victoriei, Strada Clopotarii Vechi, Strada Grigore Alexandrescu, Strada Vasile Alecsandri |
| fronting_route_buildings | 105 |
| fronting_route_with_height | 36.2 |
| fronting_route_with_colour | 2.9 |
| fronting_route_researched | 1.0 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 36.2 |
| fronting_route_with_facade_hex_any | 21.9 |
| fronting_main_buildings | 410 |
| fronting_main_with_height | 53.7 |
| buildings_total | 1395 |
| buildings_with_height | 34.9 |
| businesses_total | 409 |
| businesses_on_route | 54 |
| businesses_branded | 59 |
| trees_osm | 80 |
| lamps_osm | 0 |
| crossings | 145 |
| signal_nodes | 52 |
| transit_stops | 46 |
| metro_entrances | 6 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.445, 26.0838], [44.4542, 26.0838], [44.4542, 26.0995], [44.445, 26.0995]]` → bbox `[44.445, 26.0838, 44.4542, 26.0995]`, area **1.276 km²**.
- Why: 1.0 km (N-S) x 1.25 km (E-W). West edge just past Piața Victoriei (Antipa museum, Kiseleff start), north edge = Bd. Iancu de Hunedoara + one block (Str. Washington quiet), east edge = Calea Dorobanților / Str. Mihai Eminescu, south edge = Str. Biserica Amzei / Piața Amzei (quiet) so all of Piața Romană, Lascăr Catargiu, Piața Victoriei and Vasile Alecsandri are inside.

## Chapter routes

### arnia · 2019 — Arnia Software — Europe House

- **Start**: Bd. Magheru northbound at Str. Biserica Amzei / Piața Amzei — `44.44513, 26.09775`, heading 340° on Bulevardul General Gheorghe Magheru.
- **End**: Europe House, Bd. Lascăr Catargiu 47-53 (SE-bound kerb) — `44.451507, 26.087592`.
- **Length**: 1713 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Bd. Magheru (Romană side) → around Piața Romană (ASE dome) → full length of Lascăr Catargiu → lap of Piața Victoriei (Palatul Victoria, Antipa, rooftop ads) → back to Europe House.
- **Sequence**: Bulevardul General Gheorghe Magheru (195 m) → Piața Romană (67 m) → Bulevardul Lascăr Catargiu (904 m) → Piața Victoriei (437 m) → Bulevardul Lascăr Catargiu (109 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4452, "lon": 26.0978, "road": "Magheru", "bearing": 0}, {"lat": 44.4492, "lon": 26.0912, "road": "Lascăr Catargiu", "bearing": 315}, {"lat": 44.4532, "lon": 26.0866, "road": "Piața Victoriei"}, {"lat": 44.4511, "lon": 26.0878, "road": "Lascăr Catargiu", "bearing": 135}]`

### uipath-buc · 2020 — UiPath HQ — The Landmark, Vasile Alecsandri 4

- **Start**: Europe House (leaving Arnia), SE-bound — `44.451507, 26.087592`, heading 126° on Bulevardul Lascăr Catargiu.
- **End**: The Landmark, Str. Vasile Alecsandri 4 — `44.44995, 26.094298`.
- **Length**: 2144 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Leave Europe House SE down the whole of Lascăr Catargiu (trolleybus wires, 3+3 lanes) → lap of Piața Romană (ASE dome, metro M2) → back NW on the other carriageway → right into Str. Clopotarii Vechi → right on one-way Str. Grigore Alexandrescu → right into one-way Str. Vasile Alecsandri south to The Landmark (UiPath, Building A).
- **Sequence**: Bulevardul Lascăr Catargiu (828 m) → Piața Romană (74 m) → Bulevardul Dacia (15 m) → Piața Romană (67 m) → Bulevardul Lascăr Catargiu (484 m) → Strada Clopotarii Vechi (176 m) → Strada Grigore Alexandrescu (313 m) → Strada Vasile Alecsandri (186 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4511, "lon": 26.0878, "road": "Lascăr Catargiu", "bearing": 135}, {"lat": 44.4469, "lon": 26.0968, "road": "Piața Romană"}, {"lat": 44.4488, "lon": 26.092, "road": "Lascăr Catargiu", "bearing": 315}, {"lat": 44.4499, "lon": 26.0943, "road": "Vasile Alecsandri", "bearing": 180}]`

## CV stops (verified)

### arnia — Arnia Software — Europe House

- **address**: Bd. Lascăr Catargiu 47-53 (OSM: 51-53), Sector 1
- **building_osm**: w246115249
- **office_node**: n9913919522 (office=research "arnia software", inside Europe House, 44.4512929, 26.0875373)
- **lat**: 44.45111
- **lon**: 26.08769
- **door**: lat: 44.45118; lon: 26.08795; street: Bulevardul Lascăr Catargiu; side: SW side, on the SE-bound carriageway; note: main entrance faces the boulevard; Orange shop (n3357667293) at the corner on the ground floor
- **building**: name: Europe House; completed: 2001–2002 (CA Immo: delivered 2001); levels_osm: 14; levels_sources: 2 basements + ground + 10 floors (C&W Echinox listing); "11 levels" (CA Immo); gla_m2: ≈16,400; owner: CA Immo; facade: one of Bucharest's first glass office buildings: large blue-green reflective glass curtain wall with grey aluminium mullions, asymmetric massing with a taller glazed volume and stone/grey-panelled base; facade_hex: #5E7F8C; frame_hex: #9EA3A6; base_hex: #B9B4AA; roof: flat, plant room + antennas; tenants: Orange Romania (HQ offices + shop), Bristol Myers Squibb, Tremend, arnia software; conf: facts high (sources); facade hex medium (verify on refs) [europe_house_caimmo] [europe_house_cw] [europe_house_zf] [osm]
- **cities_js_check**: cities.js arnia {44.4510, 26.0880} is within 30 m — OK; snap to the SE-bound carriageway (road /Lascăr Catargiu/, bearing 135).

### uipath-buc — UiPath HQ — The Landmark

- **address**: Str. Vasile Alecsandri 4 / Str. Constantin Daniel 11, "Building A", floors 5–6, Sector 1
- **building_osm**: w546500235
- **osm_name**: The Landmark Corp B (7 levels) — the address node "Vasile Alecsandri 4" (n2533820195) lies inside this footprint; OSM letter (B) differs from UiPath's "Building A" naming
- **lat**: 44.45001
- **lon**: 26.09466
- **door**: lat: 44.4499; lon: 26.0944; street: Strada Vasile Alecsandri; side: E side of the one-way (southbound) street; note: Ted's Coffee (n13572917435) and Friddi gelato (n7175004386) are on this building's ground floor
- **building**: name: The Landmark (office campus of several blocks, also Corp C w583612401, both 7 levels in OSM); completed: 2016–2017; gla_m2: ≈23,500–23,700 (whole campus); owner: Vectr Holdings (bought from Revetas/Cerberus in 2024); bounded_by: Str. Căderea Bastiliei, Str. Vasile Alecsandri, Str. Constantin Daniel; other_tenants: TotalEnergies, Wolf Theiss, Premier Energy, Systematic, Geotab; facade: contemporary class-A office: light stone/fibre-cement panels with regular vertical window bands and dark grey aluminium frames; glazed ground floor with cafes; recessed top floor; facade_hex: #D8D3C8; frame_hex: #3C3F42; glass_hex: #6F8A94; conf: facts high (sources); facade description/hex low–medium (verify on refs) [uipath_addr] [landmark_vectr] [landmark_economedia] [landmark_spatii] [osm]
- **cities_js_check**: cities.js uipath-buc {44.4485, 26.0940} is ~170 m SOUTH of the real door (it falls on Str. Povernei/Constantin Daniel). Use {44.4499, 26.0944}; Vasile Alecsandri is ONE-WAY SOUTHBOUND (enter from Str. Grigore Alexandrescu).

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Bulevardul Lascăr Catargiu (chapter route)

- OSM: 23 ways, 1841 m in district, classes primary; lanes values ['3', '4']; one-way segments 23/23; maxspeed ['60']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 361, bus 381, trolleybus 79, trolleybus 86.
- OSM trees within 25 m: 49 (species {'Salix babylonica': 1, 'Platanus orientalis': 44}, genus {'Platanus': 44}).
- OSM furniture: {'bicycle_parking': 1, 'drinking_water': 1}.
- Fronting buildings: 32; businesses: 22.
- **cross_section**: Dual carriageway: 3 lanes each way (3.0–3.3 m), separated by a narrow raised central strip (≈1–2 m, kerbed, with lamp/trolley poles; left-turn pockets cut into it at signalised junctions → 4 lanes, e.g. "left/through/through/through"). Trolleybus overhead wires above the kerb-side lanes on both carriageways. No tram. No bus lane in OSM.
- **lanes**: {"NW_bound": 3, "SE_bound": 3, "turn_pockets": "left pocket NW-bound before Piața Victoriei (way 667696381); \"through/through/through;right\" before most side streets"}
- **speed_limit_kmh**: 60
- **surface**: asphalt, good (resurfaced), dark #3F3F44
- **parking**: none on the carriageway (parking:both=no); cars park on side streets and in a small ADP lot (w874893780)
- **sidewalks**: 4–6 m, grey concrete pavers with tree pits; kerb grey concrete
- **trees**: continuous rows of mature linden (Tilia) and horse chestnut on both sidewalks (cities.js treeStreets) — crowns meet over the sidewalk; few on the median
- **lamps**: grey steel poles ~10–12 m on both kerbs carrying LED heads and trolleybus span wires (verify on refs)
- **signals**: signalised at Piața Victoriei, Grigore Alexandrescu, Clopotarii Vechi, Puțul de Piatră, Gheorghe Manu, Henri Coandă, Piața Romană; unsignalised right-in/right-out at Povernei, Viișoarei, Visarion, Constantin Daniel
- **landmarks_on_street**: ["Statue of Lascăr Catargiu (Antonin Mercié, 1907; reinstalled 2011) at the Viișoarei/Povernei junction (≈44.4491, 26.0921)", "Gheorghe Petrașcu House at the Piața Romană corner", "Bucharest Astronomical Observatory \"Amiral Vasile Urseanu\" at no. 21 (dome on roof)", "Henri Coandă House no. 29", "Iran embassy no. 39", "Europe House 47-53"]
- **heritage**: 12 listed houses along the boulevard (nos. 8, 12, 15, 21, 29, 39, 40, 50, 54, 56, 58 + Petrașcu House); the boulevard itself is listed as a historic monument
- **frontage_rule**: alternating: 2–3-storey eclectic/neo-Romanian villas set back behind iron fences and gardens, and 6–9-storey interwar modernist apartment blocks (1929–1940, flat roofs, rounded corners, cream/grey render, steel windows) built to the sidewalk; few modern offices (Europe House). Many blocks carry seismic-risk class plaques (red dot "Bulină roșie" on class I).
- **transit**: trolleybus 79, 86 (+ bus 100 airport express, 361, 381 on Lascăr Catargiu; 168, 226, 301, 331, 368 on Magheru)
- **history**: part of the old Strada Colței; named Ana Ipătescu under communism
- confidence: lanes/speed/wires high (OSM); trees/paving/lamps medium [osm] [wp_lascar]

### Bulevardul Dacia (chapter route)

- OSM: 20 ways, 1232 m in district, classes primary, residential, secondary; lanes values ['1', '2', '3', '4']; one-way segments 13/20; maxspeed ['30', '50', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 168, bus 226, bus 301, bus 331, bus 361, bus 368, bus 331B, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM trees within 25 m: 8 (species —, genus —).
- OSM furniture: {'gate': 1, 'lift_gate': 1, 'drinking_water': 1}.
- Fronting buildings: 30; businesses: 30.
- **cross_section**: two-way 2+2 (4 lanes) through Piața Romană, trolleybus 79/86/97 and many buses; ASE Mihai Eminescu building (41), Sheraton (5-7), Academy Library (125) further west
- confidence: high (OSM) [osm]

### Piața Victoriei (chapter route)

- OSM: 18 ways, 949 m in district, classes primary; lanes values ['2', '3', '4', '5', '6']; one-way segments 18/18; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 100, bus 203, bus 205, bus 361, bus 381, tram 10, tram 46.
- OSM furniture: {'gate': 1}.
- Fronting buildings: 0; businesses: 1.
- **layout**: Large oval one-way gyratory (counter-clockwise, 3–6 lanes with heavy turn-lane channelisation, e.g. "left/left/left;through/through/through/right") around a central green with lawns; 6 arteries meet: Calea Victoriei (S), Lascăr Catargiu (SE), Iancu de Hunedoara (E, tram), Aviatorilor/Kiseleff (N), Ion Mihalache (NW) and Nicolae Titulescu (W). Pasajul Victoria road underpass (1987–89) passes beneath W–E; metro Piața Victoriei (M1/M2 interchange) underneath with entrances A, B, C + lift.
- **signals**: every arm signalised (OSM nodes 31402063, 31402056, 255721965, 1397123589, 257714748, 2404275892); signalised pedestrian crossings on each arm
- **trams**: lines 1, 10 (and 46) run E–W across the square from Iancu de Hunedoara towards Titulescu/Ion Mihalache (central reservation)
- **frontage**: NE: Palatul Victoria (Government) — long 3-storey stripped-classical travertine facade with arcaded ground floor and colonnade of slim piers, 2 recessed top floors; W: Grigore Antipa Natural History Museum (1903–06 neoclassical, columns, pediment) and Muzeul Țăranului Român behind; SW/S: 1992–94 apartment towers (Bl. D4/D5/D6/D7, 11–15 storeys) and Victoria Center (11 lv, 38.5 m) on Calea Victoriei; NW: BRD Tower and Bucharest Tower Center (one of the tallest buildings in Romania) on Bd. Ion Mihalache; parking lot opposite the Palace.
- **rooftop_signs**: large rooftop/ façade advertising on the 1990s blocks facing the square and LED screens at the Calea Victoriei corner — brands rotate; take current ones from refs (pressone_ads documents >200 large ad installations in the centre incl. mesh banners covering whole facades)
- **congestion**: one of the worst nodes in Bucharest at peaks (Victoriei–Unirii N–S axis named most congested)
- confidence: layout high (OSM, Wikipedia); rooftop brands unverified [osm] [wp_victoriei] [wp_victoria_palace] [hotnews_axis] [pressone_ads]

### Strada Grigore Alexandrescu (chapter route)

- OSM: 9 ways, 932 m in district, classes residential, tertiary; lanes values ['1', '2']; one-way segments 8/9; maxspeed ['30', '40', '50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'gate': 1, 'waste_basket': 1}.
- Fronting buildings: 78; businesses: 19.
- **cross_section**: one-way eastbound, 1 lane (30 km/h zone in the hospital stretch) with parked cars; Grigore Alexandrescu children's hospital complex on the N side (Casa Ronald McDonald, burns clinic), villas and small offices on the S side
- **speed_limit_kmh**: 30 (hospital stretch) / 50
- confidence: high (OSM) / medium [osm]

### Bulevardul General Gheorghe Magheru (chapter route)

- OSM: 6 ways, 494 m in district, classes primary; lanes values ['3', '4']; one-way segments 6/6; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 168, bus 226, bus 301, bus 331, bus 361, bus 368, bus 381, bus 331B.
- OSM furniture: {'bicycle_rental': 1, 'waste_basket': 1}.
- Fronting buildings: 5; businesses: 29.
- **cross_section**: Wide boulevard, one-way pairs at Romană: N-bound 4 lanes (through×3 + through;right), S-bound 3 lanes; 60 km/h; metro M2 beneath; wide sidewalks (6–8 m) with grey pavers; continuous interwar modernist blocks (8–12 storeys, Magheru is THE interwar modernist boulevard) with ground-floor shops and cinemas further south
- **ads**: whole-facade mesh banners on several blocks (pressone_ads)
- confidence: lanes high; facades medium [osm] [pressone_ads]

### Piața Romană (chapter route)

- OSM: 14 ways, 384 m in district, classes primary; lanes values ['3', '5']; one-way segments 14/14; maxspeed ['50', '60', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 168, bus 226, bus 361, bus 368, bus 381, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM furniture: {'clock': 1}.
- Fronting buildings: 1; businesses: 2.
- **layout**: Signalised square where Magheru (S, one-way N-bound arm 3–4 lanes + the S-bound arm), Lascăr Catargiu (NW) and Bd. Dacia (E–W) cross; traffic circulates around a small central island (former Capitoline Wolf statue site 1997–2010, statue moved to Bd. I.C. Brătianu). Metro M2 Piața Romană with entrances on Magheru.
- **frontage**: N/NE: ASE main building (Academia de Studii Economice, Piața Romană 6 — monumental neoclassical with central dome and portico, 1916–1926) and Casa Nanu-Muscel; SW: Gheorghe Petrașcu House no. 1 (1907, Ion Mincu, neo-Romanian, arcaded loggia, tiled roof); no. 5: second Petrașcu house (1913, Spiridon Cegăneanu); interwar 4–8-storey blocks with shops on Magheru; Sheraton (18 lv, 70 m, 1976) east on Bd. Dacia.
- **ground_floor**: 5 to go kiosk-cafe, Help Net & Dona pharmacies, Calzedonia, Miniso, STB ticket booth, Patiseria Tineretului, Treevi Pizza (Magheru east side, OSM)
- confidence: high (OSM/Wikipedia) except ASE description medium [osm] [wp_romana] [wp_ase]

### Strada Vasile Alecsandri (chapter route)

- OSM: 1 ways, 229 m in district, classes residential; lanes values []; one-way segments 1/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 19; businesses: 6.
- **cross_section**: one-way SOUTHBOUND single lane (≈229 m from Grigore Alexandrescu to Str. Povernei/Constantin Daniel), cars parked on both sides half on the sidewalk; narrow cracked-asphalt sidewalks; mature trees
- **frontage**: W side: SNSPA university building (w23647615), Italian Vintage cafe (no. 3); E side: The Landmark (no. 4, UiPath) with Ted's Coffee + Friddi gelato, villas incl. the Storck art collection museum (no. 16, 1913 house)
- **speed_limit_kmh**: 50
- confidence: high (OSM) [osm]

### Strada Clopotarii Vechi (chapter route)

- OSM: 2 ways, 308 m in district, classes residential; lanes values []; one-way segments 2/2; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'gate': 1}.
- Fronting buildings: 15; businesses: 3.
- **cross_section**: narrow one-way (NW-bound from Lascăr Catargiu to Grigore Alexandrescu, S-bound beyond), 1 lane + parked cars both sides on the sidewalk edge; Medicover clinic at 16-20
- **speed_limit_kmh**: 50
- confidence: medium [osm]

### Bulevardul Iancu de Hunedoara

- OSM: 15 ways, 1950 m in district, classes primary; lanes values ['2', '3']; one-way segments 15/15; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 1929, tram 1, tram 10, tram 46.
- OSM trees within 25 m: 3 (species —, genus —).
- OSM furniture: {'gate': 2}.
- Fronting buildings: 54; businesses: 16.
- **cross_section**: Dual carriageway 2 lanes each way (3 near junctions) either side of a central tram reservation (lines 1, 10, 46) with poles carrying the tram overhead; diagonal/kerb parking in short stretches on the S side (parking:right=street_side diagonal); 50 km/h; DJ200B
- **frontage**: 9-storey 1960s–70s blocks (Bl. H4–H6 S side, Bl. I1–I3, Bl. 2, 3 N side), Bloc Volga (37, 7 lv/30 m), Capital Plaza Hotel (54) near Dorobanți; Palatul Victoria rear at the W end
- confidence: high (OSM) [osm]

### Pasajul Victoria

- OSM: 9 ways, 1092 m in district, classes primary; lanes values ['2']; one-way segments 9/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 1929, tram 1, tram 10, tram 46.
- Fronting buildings: 0; businesses: 3.

### Calea Victoriei

- OSM: 2 ways, 917 m in district, classes secondary; lanes values ['2']; one-way segments 2/2; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 361.
- OSM trees within 25 m: 18 (species —, genus —).
- OSM furniture: {'drinking_water': 1, 'bicycle_rental': 1, 'waste_basket': 7}.
- Fronting buildings: 37; businesses: 28.
- **cross_section**: northern end: 1–2 lanes each way, 50 km/h; listed houses (Casa Vernescu 133 — casino/restaurant, Casa Nenciu, Casa cu cariatide 202, Palatul Cantacuzino 141 — George Enescu Museum) and 1990s towers at Piața Victoriei
- **lamps**: black ornamental cast-iron style lanterns along Calea Victoriei (city rule "historic")
- confidence: medium [osm]

### Calea Dorobanților

- OSM: 7 ways, 896 m in district, classes primary, secondary, tertiary; lanes values ['4', '6']; one-way segments 4/7; maxspeed ['60', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 301, bus 331, bus 335, bus 461, bus 331B, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM furniture: {'post_box': 1, 'lift_gate': 1, 'gate': 2, 'drinking_water': 1}.
- Fronting buildings: 22; businesses: 25.
- **cross_section**: between Piața Romană and Iancu de Hunedoara: one-way SOUTHBOUND for cars (4 lanes) with a CONTRAFLOW northbound bus/trolleybus lane (busway=opposite_lane); trolleybus 79, 86, 97
- confidence: high (OSM) [osm]

### Strada Căderea Bastiliei

- OSM: 2 ways, 648 m in district, classes tertiary; lanes values ['2']; one-way segments 2/2; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'gate': 3}.
- Fronting buildings: 54; businesses: 14.
- **cross_section**: two-way 1+1 tertiary, parked cars; villas and small embassies; The Landmark east side
- confidence: medium [osm]

### Strada Povernei

- OSM: 8 ways, 507 m in district, classes residential; lanes values ['1']; one-way segments 7/8; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 30; businesses: 4.

### Strada General Gheorghe Manu

- OSM: 4 ways, 482 m in district, classes tertiary; lanes values ['1', '2']; one-way segments 1/4; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): trolleybus 79, trolleybus 86.
- OSM furniture: {'waste_basket': 1}.
- Fronting buildings: 24; businesses: 4.

### Strada Buzești

- OSM: 6 ways, 462 m in district, classes primary; lanes values ['2', '3']; one-way segments 5/6; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 205.
- OSM furniture: {'surveillance': 1}.
- Fronting buildings: 93; businesses: 12.

### Strada Constantin Daniel

- OSM: 2 ways, 273 m in district, classes residential; lanes values ['1']; one-way segments 2/2; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 17; businesses: 2.

### Șoseaua Nicolae Titulescu

- OSM: 3 ways, 272 m in district, classes primary; lanes values ['2']; one-way segments 3/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 381.
- Fronting buildings: 0; businesses: 2.

### Bulevardul Ion Mihalache

- OSM: 3 ways, 188 m in district, classes primary; lanes values ['2']; one-way segments 3/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 205, bus 381.
- Fronting buildings: 0; businesses: 1.

### Bulevardul Aviatorilor

- OSM: 3 ways, 179 m in district, classes primary, residential; lanes values ['1', '6']; one-way segments 1/3; maxspeed ['60', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 203, bus 361.
- Fronting buildings: 2; businesses: 3.

### Șoseaua Ștefan cel Mare

- OSM: 3 ways, 167 m in district, classes primary; lanes values ['3', '4']; one-way segments 3/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 335, bus 461, bus 1929, tram 1, tram 46.
- Fronting buildings: 0; businesses: 4.

### Șoseaua Pavel Dimitrievici Kiseleff

- OSM: 1 ways, 147 m in district, classes primary; lanes values ['4']; one-way segments 1/1; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 203, bus 361.
- Fronting buildings: 0; businesses: 0.

### Intrarea Grigore Alexandrescu

- OSM: 1 ways, 70 m in district, classes service; lanes values []; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

### Intrarea Căderea Bastiliei

- OSM: 1 ways, 42 m in district, classes residential; lanes values []; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 5; businesses: 0.

## Squares, junctions, landmarks

- **Piața Victoriei** — signalised gyratory + underpass; streets["Piața Victoriei"]
- **Piața Romană** — signalised multi-arm square; streets["Piața Romană"]
- **Lascăr Catargiu × Gheorghe Manu / Henri Coandă** — signalised, 8 crossing nodes within 40 m, pedestrian countdowns;  [osm]
- **Palatul Victoria** (`victoria`, w23554419) — main facade faces SW onto the square; 19-bay arcade/colonnade; travertine #D9CDB4; two flagpoles; police barriers + parked gendarmerie vans common (protest site 2017–2018) [wp_victoria_palace] [wp_victoriei]
- **ASE main building** (`ase`, w942675763) — dome visible from Lascăr Catargiu and Magheru; students crowd the Piața Romană crossings 08–10 and 12–14 [wp_ase]
- **Grigore Antipa Museum** (`antipa`, w23610985) — neoclassical portico facing the square at the Kiseleff corner [wp_victoriei]
- **Statue of Lascăr Catargiu** (`catargiu_statue`,  44.4491, 26.0921) — bronze standing figure on a stone pedestal (Antonin Mercié 1907), on the small square at Viișoarei/Povernei [wp_lascar]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|
| n257680252 | Bulevardul Lascăr Catargiu × Strada Povernei |  |  | 2 |
| n257680249 | Bulevardul Lascăr Catargiu × Strada Viișoarei |  |  | 0 |
| n31402063 | Calea Victoriei × Piața Victoriei | yes |  | 5 |
| n31402056 | Bulevardul Iancu de Hunedoara × Piața Victoriei | yes |  | 3 |
| n255721965 | Piața Victoriei × Strada Duiliu Zamfirescu | yes |  | 2 |
| n256017667 | Bulevardul Lascăr Catargiu × Strada Amiral Vasile Urseanu |  |  | 2 |
| n1006024117 | Bulevardul Lascăr Catargiu × Strada Gina Patrichi |  |  | 0 |
| n1006024745 | Bulevardul Lascăr Catargiu × Strada Clopotarii Vechi | yes |  | 5 |
| n33390176 | Bulevardul Lascăr Catargiu × Strada General Gheorghe Manu | yes |  | 8 |
| n4191398561 | Bulevardul Lascăr Catargiu × Strada Henri Coandă | yes |  | 8 |
| n1397123589 | Bulevardul Aviatorilor × Piața Victoriei × Strada Duiliu Zamfirescu | yes |  | 4 |
| n257714748 | Bulevardul Lascăr Catargiu × Piața Victoriei | yes |  | 5 |
| n2404275892 | Bulevardul Iancu de Hunedoara × Bulevardul Lascăr Catargiu × Piața Victoriei | yes |  | 2 |
| n31402059 | Piața Victoriei × Șoseaua Pavel Dimitrievici Kiseleff |  |  | 0 |
| n2648513777 | Bulevardul Lascăr Catargiu × Strada Grigore Alexandrescu | yes |  | 7 |
| n1006015320 | Bulevardul Lascăr Catargiu × Strada Puțul de Piatră | yes |  | 6 |
| n117334964 | Bulevardul Lascăr Catargiu × Strada Visarion |  |  | 2 |
| n2405784164 | Bulevardul Dacia × Piața Romană | yes |  | 7 |
| n134971067 | Bulevardul Dacia × Bulevardul General Gheorghe Magheru × Piața Romană | yes |  | 8 |
| n125431052 | Bulevardul Lascăr Catargiu × Piața Romană | yes |  | 6 |
| n3262378104 | Bulevardul Dacia × Bulevardul General Gheorghe Magheru | yes |  | 8 |
| n117334345 | Bulevardul Lascăr Catargiu × Strada Constantin Daniel |  |  | 2 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w546500235 | The Landmark — UiPath block | 7 / 26 | #D8D3C8 stone/fibre-cement panels, glass | flat with recessed top floor | 2016–2017 | uipath-buc [landmark_vectr] [uipath_addr] [osm] |
| w29819032 | Sheraton Bucharest (ex-Hotel Dorobanți) | 18 / 70 | #C9C4BA  |  | 1976 | SHERATON wordmark on the roof crown (verify on refs) [osm] |
| w23554419 | Palatul Victoria (Government of Romania) | 3 + 2 recessed top floors / 25 | #D9CDB4 travertine cladding (post-1952; originally Carrara marble) | flat | 1937–1952, Duiliu Marcu, stripped classicism | arcaded ground floor, colonnade of slim piers on the main front, flag poles with RO + EU flags [wp_victoria_palace] [wp_victoriei] |
| w171045146 | Casa Gheorghe Petrașcu (Piața Romană 1) | 2 /  | #E9E0CF  | hipped, red-brown ceramic tiles #8C3B2A, deep eaves | 1907, Ion Mincu | neo-Romanian: arcaded loggia, carved stone columns, glazed ceramic accents [wp_romana] [wp_lascar] |
| w246115249 | Europe House | 10 above ground + ground (OSM says 14 levels incl. plant floors?) / 45 | #5E7F8C glass curtain wall + aluminium | flat | 2001–2002 | arnia [europe_house_caimmo] [europe_house_cw] |
| w583612401 | The Landmark Corp C | 7 /  | #D8D3C8  |  | 2016–2017 |  [osm] [landmark_spatii] |
| w79139872 | Observatorul Astronomic Amiral Vasile Urseanu (Lascăr Catargiu 21) | 2 /  |   | small observatory dome on the roof | villa early 20th c. |  [wp_lascar] [osm] |
| w173938539 | Victoria Center (Calea Victoriei 145) | 11 / 38.5 |   |  |  |  [osm] |
| w23610985 | Muzeul Național de Istorie Naturală Grigore Antipa | 2 /  | #E3D6B8 rendered masonry, stone columns | hidden/flat behind parapet | 1903–1906, Grigore Cerkez | neoclassical portico with columns and pediment [wp_victoriei] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w283091435 | Bulevardul General Gheorghe Magheru | E |  | apartments | 6 |  |  |  | unknown (use district rule) |  | 2 |
| w317347462 | Bulevardul General Gheorghe Magheru | E |  | apartments | 9 |  |  |  | communist-era block (likely) | #A9A49B est | 12 |
| w1418159688 | Bulevardul Lascăr Catargiu | SW | 7 | apartments | 5 | 17.5 | 1935 | Urgency Category 1 | interwar (art deco / modernist) apartment block | #BFB8A8 est | 0 |
| w1441705293 | Bulevardul Lascăr Catargiu | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w171045145 | Bulevardul Lascăr Catargiu | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w296527631 | Bulevardul Lascăr Catargiu | SW | 11A | apartments | 7 | 16 | 1939 | Seismic Risk Class I | interwar (art deco / modernist) apartment block | #D9D2C3 est | 0 |
| w583614925 | Bulevardul Lascăr Catargiu | NE |  | detached |  |  |  |  | low house/villa (19th-early 20th c. likely) | #E9E0CF est | 0 |
| w571479979 | Bulevardul Lascăr Catargiu | NE | 7a | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 0 |
| w1418769474 | Bulevardul Lascăr Catargiu | SW |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w324094052 | Bulevardul Lascăr Catargiu | SW | 15A | apartments | 7 | 13 | 1934 | Retrofitted | interwar (art deco / modernist) apartment block | #CFC8B8 est | 0 |
| w323875142 | Bulevardul Lascăr Catargiu | NE | 14 | apartments · Fischer International | 4 |  | 1938 | Seismic Risk Class III | interwar (art deco / modernist) apartment block | #CFC8B8 est | 1 |
| w324094050 | Bulevardul Lascăr Catargiu | NE | 16 | apartments | 4 | 14 | 1929 | Seismic Risk Class III | interwar (art deco / modernist) apartment block | #E8E1D3 est | 0 |
| w583614940 | Bulevardul Lascăr Catargiu | NE |  | apartments | 4 |  |  |  | unknown (use district rule) |  | 0 |
| w1418173745 | Bulevardul Lascăr Catargiu | SW | 27 | apartments | 6 | 21 | 1930 | Urgency Category 3 | interwar (art deco / modernist) apartment block | #E8E1D3 est | 0 |
| w171045066 | Bulevardul Lascăr Catargiu | NE |  | yes · Secția 1 |  |  |  |  | unknown (use district rule) |  | 1 |
| w171045123 | Bulevardul Lascăr Catargiu | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w319776846 | Bulevardul Lascăr Catargiu | SW |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w363436427 | Bulevardul Lascăr Catargiu | SW |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w180556783 | Bulevardul Lascăr Catargiu | NE | 28 | apartments | 5 | 17.5 | 1935 | Urgency Category 2 | interwar (art deco / modernist) apartment block | #BFB8A8 est | 0 |
| w245083672 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w245083609 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w245083664 | Bulevardul Lascăr Catargiu | NE |  | retail | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w245083655 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w245083616 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w309265221 | Bulevardul Lascăr Catargiu | SW | 41 | apartments | 4 | 17.5 | 1939 | Urgency Category 2 | interwar (art deco / modernist) apartment block | #D9D2C3 est | 0 |
| w309265224 | Bulevardul Lascăr Catargiu | SW | 43 | apartments |  |  |  |  | unknown (use district rule) |  | 0 |
| w231445034 | Bulevardul Lascăr Catargiu | NE | 44 | semidetached_house | 3 | 13 | 1910 | Seismic Risk Class I | pre-1919 eclectic / neo-romanian house or villa | #E7D8C9 est | 0 |
| w324179820 | Bulevardul Lascăr Catargiu | NE |  | commercial |  |  |  |  | unknown (use district rule) |  | 0 |
| w1418176530 | Bulevardul Lascăr Catargiu | NE | 48 | apartments | 3 | 13 | 1880 | Retrofitted | pre-1919 eclectic / neo-romanian house or villa | #E9E0CF est | 0 |
| w405553978 | Bulevardul Lascăr Catargiu | NE | 54 | civic |  |  |  |  | unknown (use district rule) |  | 1 |
| w231445037 | Bulevardul Lascăr Catargiu | NE |  | apartments | 3 |  |  |  | unknown (use district rule) |  | 1 |
| w923421208 | Bulevardul Lascăr Catargiu | SW |  | apartments | 11 | 39.25 |  |  | unknown (use district rule) | #E5E5CF | 0 |
| w923520626 | Bulevardul Lascăr Catargiu | SW |  | yes |  | 39.25 |  |  | unknown (use district rule) | #E5E5CF | 0 |
| w559463171 | Bulevardul Lascăr Catargiu | NE | 58 | house | 3 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6D3B3 est | 0 |
| w1516933653 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1516933654 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1516933652 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w231445015 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w231445041 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w180556816 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310934 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310935 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310932 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310933 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310948 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w231445047 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w231445063 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w206360989 | Strada Grigore Alexandrescu | S | 56 | yes · Zen Sushi | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 1 |
| w559463172 | Strada Grigore Alexandrescu | N |  | residential · Casa Ronald McDonald | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w1449310947 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310946 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w559463173 | Strada Grigore Alexandrescu | N |  | hospital · Clinică de Arsuri și Chirurgie Plastică | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w206360981 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310914 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310936 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310915 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w369058096 | Strada Grigore Alexandrescu | N |  | hospital · Ambulator | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6D3B3 est | 0 |
| w1449310922 | Strada Grigore Alexandrescu | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310938 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310937 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310931 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310939 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310940 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310941 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310942 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310943 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310944 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310945 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310928 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310930 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310929 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310927 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 1 |
| w1449310923 | Strada Grigore Alexandrescu | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w171045139 | Strada Grigore Alexandrescu | N |  | commercial · HQ Victoriei | 5 |  |  |  | unknown (use district rule) |  | 0 |
| w182933471 | Strada Vasile Alecsandri | E |  | apartments | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w23647615 | Strada Vasile Alecsandri | W |  | school · Școala Națională de Studii Politice și Administrative |  |  |  |  | unknown (use district rule) |  | 0 |
| w546500235 | Strada Vasile Alecsandri | E |  | office · The Landmark Corp B | 7 |  |  |  | modern office/glass curtain wall | #D8D3C8 | 3 |
| w1449310958 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 1 |
| w546500248 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310957 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w546500247 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310956 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w206360983 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310955 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w206360984 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310954 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w546500238 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245083610 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w546500256 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w546500250 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310919 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w583614934 | Strada Vasile Alecsandri | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1449310921 | Strada Vasile Alecsandri | W |  | yes |  |  |  |  | unknown (use district rule) |  | 1 |
| w245083674 | Strada Clopotarii Vechi | E |  | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 0 |
| w678558194 | Strada Clopotarii Vechi | W |  | commercial | 3 |  |  |  | unknown (use district rule) |  | 1 |
| w171045122 | Strada Clopotarii Vechi | E |  | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #D8C3A5 est | 0 |
| w231445061 | Strada Clopotarii Vechi | SW | 40 | apartments | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6D3B3 est | 0 |
| w546500264 | Strada Clopotarii Vechi | SW |  | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 0 |
| w245083650 | Strada Clopotarii Vechi | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w171045144 | Strada Clopotarii Vechi | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245083692 | Strada Clopotarii Vechi | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w180556824 | Strada Clopotarii Vechi | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w171045071 | Strada Clopotarii Vechi | W | 16-20 | office | 5 |  |  |  | unknown (use district rule) |  | 2 |
| w180556781 | Strada Clopotarii Vechi | NE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w171045061 | Strada Clopotarii Vechi | E |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| n6464523585 | 5 to go | 5 to go bg #FFD100 fg #1D1D1B | amenity=cafe | Bulevardul General Gheorghe Magheru | E |  |
| n9789836226 | ANSPDCP |  | office=government | Bulevardul General Gheorghe Magheru | E | 28-30 |
| n11172363189 | Calzedonia | Calzedonia bg #FFFFFF fg #000000 | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11513855675 | Casandra |  | shop=confectionery | Bulevardul General Gheorghe Magheru | E |  |
| n11513871803 | Depot 96 |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11513886232 | DiKa |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n2637716251 | Farmacia Dona | Farmacia Dona bg #E30613 fg #FFFFFF | amenity=pharmacy | Bulevardul General Gheorghe Magheru | E |  |
| n11172363183 | Help Net | Help Net bg #E30613 fg #FFFFFF | amenity=pharmacy | Bulevardul General Gheorghe Magheru | E |  |
| n11172363186 | Hobby Mobile Accessories |  | shop=mobile_phone_accessories | Bulevardul General Gheorghe Magheru | E |  |
| n11172363184 | Innovative Romana |  | shop=copyshop | Bulevardul General Gheorghe Magheru | E |  |
| n11513884483 | Lashez |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11178795303 | Miniso |  | shop=variety_store | Bulevardul General Gheorghe Magheru | E |  |
| n11172363185 | Pan Caldi |  | shop=bakery | Bulevardul General Gheorghe Magheru | E |  |
| n2394766461 | Patiseria Tineretului |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 32-36 |
| n11513853602 | Prego |  | shop=shoes | Bulevardul General Gheorghe Magheru | E |  |
| n11263095690 | STB |  | shop=ticket | Bulevardul General Gheorghe Magheru | E |  |
| n11513879453 | T!naR |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11172363187 | Tabakos |  | shop=tobacco | Bulevardul General Gheorghe Magheru | E |  |
| n11172363188 | Treevi Pizza Al Taglio |  | amenity=restaurant | Bulevardul General Gheorghe Magheru | E | 9 |
| n11513872026 | sadhana |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11222737061 |  |  | disused:shop=florist | Bulevardul Lascăr Catargiu | SW |  |
| n7293870987 |  |  | disused:shop=yes | Bulevardul Lascăr Catargiu | SW | 1 |
| w874893780 | ADP Sector 1 |  | amenity=parking | Bulevardul Lascăr Catargiu | S |  |
| n2457790509 | Aeroclubul României |  | office=association | Bulevardul Lascăr Catargiu | NE |  |
| n8572234851 | BRD | BRD bg #000000 fg #FFFFFF | amenity=bank | Bulevardul Lascăr Catargiu | SW | 224 |
| n9913919523 | BSS Integrated Property & Facility Management |  | office=company | Bulevardul Lascăr Catargiu | SW |  |
| n2734668732 | Cafeneaua Nației |  | amenity=cafe | Bulevardul Lascăr Catargiu | SW | 7 |
| n3145953243 | Clinica Audionova |  | amenity=clinic | Bulevardul Lascăr Catargiu | SW | 41 |
| w246115249 | Europe House |  | office=company | Bulevardul Lascăr Catargiu | SW | 51 - 53 |
| w323875142 | Fischer International |  | amenity=library | Bulevardul Lascăr Catargiu | NE | 14 |
| n12906263752 | Grand Boulevard Apartment at Piata Romana |  | tourism=apartment | Bulevardul Lascăr Catargiu | NE |  |
| n7038667102 | Lithuanian consulate |  | office=diplomatic | Bulevardul Lascăr Catargiu | SW |  |
| n9913922525 | Metropolitan Life |  | office=insurance | Bulevardul Lascăr Catargiu | SW |  |
| n3357667293 | Orange | Orange bg #000000 fg #FFFFFF | shop=mobile_phone | Bulevardul Lascăr Catargiu | SW | 47-53 |
| n3357667193 | Orange Romania Europe House | Orange bg #000000 fg #FFFFFF | office=company | Bulevardul Lascăr Catargiu | SW | 47-53 |
| n2617494293 | Restaurant Nan Jing |  | amenity=restaurant | Bulevardul Lascăr Catargiu | SW |  |
| n11215891117 | Sara Green |  | amenity=cafe | Bulevardul Lascăr Catargiu | SW | 43A |
| w171045066 | Secția 1 |  | amenity=police | Bulevardul Lascăr Catargiu | NE |  |
| n1493026199 | Trattoria Buongiorno |  | amenity=restaurant | Bulevardul Lascăr Catargiu | NE | 56 |
| n9414639015 | Tremend |  | office=it | Bulevardul Lascăr Catargiu | SW | 51-53 |
| n5602930826 | Viggo |  | shop=clothes | Bulevardul Lascăr Catargiu | NE |  |
| n9913919522 | arnia software |  | office=research | Bulevardul Lascăr Catargiu | SW |  |
| n3261827650 | Medicover |  | amenity=clinic | Strada Clopotarii Vechi | W | 16-20 |
| n2457793817 | Omniasig |  | office=insurance | Strada Clopotarii Vechi | W |  |
| n14090099867 | Baba Market |  | shop=convenience | Strada Grigore Alexandrescu | N |  |
| n8255184625 | Centrul Medical Recumed |  | amenity=hospital | Strada Grigore Alexandrescu | N | 33 |
| n14090085282 | THAI temple SPA |  | shop=massage | Strada Grigore Alexandrescu | S |  |
| w206360989 | Zen Sushi |  | amenity=restaurant | Strada Grigore Alexandrescu | S | 56 |
| n2634651933 | Colecția de Artă Plastica "Fr. Storck și Cecilia Cutescu Storck" |  | tourism=artwork | Strada Vasile Alecsandri | E | 16 |
| n7175004386 | Friddi |  | amenity=ice_cream | Strada Vasile Alecsandri | E | 4 |
| n7179026685 | Italian Vintage |  | amenity=cafe | Strada Vasile Alecsandri | W | 3 |
| n13572917435 | TED'S Coffee | Ted's Coffee Co. bg #1F1F1F fg #FFFFFF | amenity=cafe | Strada Vasile Alecsandri | E |  |
| n13572917436 | Xtime |  | shop=tobacco | Strada Vasile Alecsandri | E |  |
| w23647615 | Școala Națională de Studii Politice și Administrative |  | amenity=university | Strada Vasile Alecsandri | W |  |

Other branded businesses in the district (off-route): Alpha Bank (Bulevardul Dacia, n2504757652); Fornetti (Bulevardul Dacia, n8513025042); Libra Bank (Bulevardul Dacia, n11261905154); Luca (Bulevardul Dacia, n3756982645); Pizza Hut (Bulevardul Dacia, n328607517); Shop&Go (Bulevardul Dacia, n3907600553); Starbucks (Bulevardul Dacia, n3499962407); BRD (Bulevardul General Gheorghe Magheru, n3734652403); Orange (Bulevardul General Gheorghe Magheru, n7293870988); CEC Bank (Bulevardul Iancu de Hunedoara, n3757940564); Domino's (Bulevardul Iancu de Hunedoara, n3759186612); Mega Image (Bulevardul Iancu de Hunedoara, n1762277750); Dr. Max (Calea Dorobanților, n4564413803); Help Net (Calea Dorobanților, n1768903148); Luca (Calea Dorobanților, n13427923360); Orange (Calea Dorobanților, n2432213825); Pepco (Calea Dorobanților, n13429496906); Raiffeisen Bank (Calea Dorobanților, n13427923361); Shop&Go (Calea Dorobanților, n3200340961); BCR (Calea Victoriei, n1563503947); Carrefour Express (Calea Victoriei, n9913921972); Exim Banca Românească (Calea Victoriei, n4353553453); Froo (Calea Victoriei, n13686920006); La Doi Pași (Calea Victoriei, n2546327480); Leonidas (Calea Victoriei, n4353556019); Starbucks (Calea Victoriei, n4350720097); Ted's Coffee Co. (Calea Victoriei, n8572234820); 5 to go (Strada Biserica Amzei, n13592808737); Annabella (Strada Buzești, n9913945479); Dr. Max (Strada Buzești, n8709661327); Euronet (Strada Buzești, n7056388009); Luca (Strada Buzești, n9726046117); Starbucks (Strada Buzești, n6696629629); 5 to go (Strada Căderea Bastiliei, n14090031824); Ted's Coffee Co. (Strada Căderea Bastiliei, n13634135886); BCR (Strada Dimitri Ivanovici Mendeleev, n5602922763); Maxbet (Strada Dimitri Ivanovici Mendeleev, n11825001199); dm (Strada Dimitri Ivanovici Mendeleev, n7293845639); Raiffeisen Bank (Strada Grigore Alexandrescu, n1312175595); dm (Strada Hatmanul Arbore, n4564405596); Regina Maria (Strada Louis Blanc, n12964827742); Carrefour Market (Strada Maior Giurescu Dimitrie, n1768896770); BRD (Strada Mihail Moxa, n4690003478); Euronet (Strada Mihail Moxa, n7056393674); Shop&Go (Strada Mihail Moxa, n11991603619); Catena (Strada Sevastopol, n12315963238); Inmedio (Strada Sevastopol, n2621106559); Mega Image (, n2613331337); dm (, n7932109194); Berezka (Șoseaua Ștefan cel Mare, n11608041705); UniCredit (Șoseaua Ștefan cel Mare, n3759186613).

## Transit

- Lines with OSM route relations touching the district: bus 100, bus 168, bus 203, bus 205, bus 226, bus 301, bus 331, bus 335, bus 361, bus 368, bus 381, bus 461, bus 1929, bus 331B, tram 1, tram 10, tram 46, trolleybus 79, trolleybus 86, trolleybus 97.
- Stops: A.S.E. (bus); Calea Dorobanților (bus); Calea Dorobanților (tram); Calea Victoriei (bus); Gheorghe Manu (bus); Orlando (platform); Pasaj Victoria (bus); Perla (bus); Piata Victoriei (bus); Piața Romană (bus); Piața Romană (bus/trolleybus); Piața Romană (platform); Piața Romană (trolleybus); Piața Victoriei (bus); Piața Victoriei (tram); Povernei (platform); Roma (bus); Roma (tram); Sfintii Voievozi (bus); Spitalul Grigore Alexandrescu (tram); Șoseaua Ștefan cel Mare (bus).
- Metro entrances: Piața Victoriei - M1 M2 A (44.45161, 26.08712); Piața Victoriei B (44.45171, 26.08762); Piața Victoriei - M1 M2 C (44.45371, 26.08624); Piața Victoriei - Ascensor  (44.45174, 26.08672); Piața Romană  (44.44583, 26.09757); Piața Romană  (44.44506, 26.09796).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Traffic / congestion (feeds `congestion`, spec 13)

- City: Bucharest drivers lost ~171 h in 2025; congestion level ≈62.5 % (other outlets: 55 %); 10 km take >32 min on average and >45 min at evening peak; worst slot Wednesday 17:00–18:00 [tomtom_2025] [tomtom_2025b] [euronews_10km]

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Piața Victoriei | 44.4526, 26.0858 | 220 | [[7.5, 10], [16, 19.5]] | 0.9 | standstill in all arms at peaks; worst Lascăr Catargiu NW-bound and Kiseleff S-bound [hotnews_axis] [tomtom_peak] |
| Piața Romană | 44.4468, 26.097 | 160 | [[7.5, 10], [16, 19.5]] | 0.85 | "one of the most congested points in the capital"; queues back up Magheru and Lascăr Catargiu [tvr_romana] [hotnews_axis] |
| Bd. Lascăr Catargiu (whole length) | 44.4492, 26.0915 | 450 | [[8, 10], [17, 19]] | 0.6 | stop-and-go between the two squares [hotnews_axis] |
| Calea Dorobanților (south, one-way) | 44.4505, 26.0985 | 200 | [[8, 10], [17, 19]] | 0.6 | Dorobanți named among the most congested corridors [hotnews_axis] |

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

- facades_interwar_modernist: #E8E1D3 #D9D2C3 #CFC8B8 #BFB8A8 #E2D3B5
- facades_villas: #E9E0CF #E6D3B3 #D8C3A5 #C9B79C #E7D8C9
- facades_1970s_90s_blocks: #BDB5A6 #A9A49B #C7C1B5
- roof_tiles: #8C3B2A
- roof_flat: #6B6B66
- road: #3F3F44
- road_worn: #55555A
- sidewalk: #A9A59C
- kerb: #9B9A94
- marking: #F4F4F0
- travertine: #D9CDB4
- glass_office: #5E7F8C
- conf: medium (estimated from typical Commons photos; refine with refs)

## Top 30 things a local would notice if wrong

1. Lascăr Catargiu is a DUAL carriageway, 3+3 lanes, with trolleybus wires — not a single 2-way road.
2. Vasile Alecsandri is a narrow ONE-WAY street southbound; UiPath's door is on its east side (The Landmark, no. 4) with Ted's Coffee + Friddi on the ground floor.
3. Europe House is a 2001–02 blue-green glass tower on the SW side near Piața Victoriei, with an Orange shop at the base.
4. Piața Victoriei is a huge oval gyratory with 6 arms, central lawns and an underpass (Pasajul Victoria) beneath.
5. Palatul Victoria = long pale travertine stripped-classical facade with arcade/colonnade, Romanian + EU flags.
6. The Antipa museum portico (columns + pediment) at the Kiseleff corner.
7. Trams (lines 1, 10) cross Piața Victoriei E–W along Iancu de Hunedoara in a central reservation.
8. Piața Romană: ASE dome to the NE, metro M2 entrances on Magheru, 5 to go kiosk, students everywhere.
9. Gheorghe Petrașcu House (neo-Romanian, Ion Mincu 1907) at the Romană / Lascăr corner.
10. Statue of Lascăr Catargiu (reinstalled 2011) midway along the boulevard at Povernei/Viișoarei.
11. Linden/chestnut canopies line Lascăr Catargiu; interwar modernist blocks alternate with fenced villas.
12. Red seismic-risk dots on some 1930s blocks (Lascăr Catargiu 7: urgency class I).
13. Speed limit 60 km/h on Lascăr Catargiu & Magheru; 50 elsewhere; 30 at the Grigore Alexandrescu hospital.
14. Calea Dorobanților south of Iancu de Hunedoara is one-way southbound with a contraflow bus lane.
15. Trolleybuses 79/86 on Lascăr Catargiu; airport express bus 100 too.
16. Cars parked on sidewalks of all side streets (Clopotarii Vechi, Grigore Alexandrescu, Vasile Alecsandri).
17. BRD Tower and Tower Center (very tall glass towers) dominate the NW skyline from Victoriei.
18. Sheraton tower (70 m, 1976) visible east of Piața Romană on Bd. Dacia.
19. Rooftop/facade ad banners and LED screens around both squares.
20. Embassies with guard booths (Iran at Lascăr Catargiu 39) and police station Secția 1 on the boulevard.
21. Big signalised junctions have countdown pedestrian signals and many zebra crossings.
22. Grey concrete paver sidewalks with metal bollards along boulevards; cracked asphalt on side streets.
23. Yellow STB trolleybuses (Solaris Trollino) and yellow taxis.
24. Astronomical observatory dome on the roof of Lascăr Catargiu 21.
25. Medicover clinic on Clopotarii Vechi; Grigore Alexandrescu children's hospital on the street of the same name.
26. Interwar blocks with rounded corners and horizontal balcony bands on Magheru.
27. Bd. Iancu de Hunedoara is lined with 9-storey 1960s–70s blocks.
28. Heavy peak congestion: Victoriei and Romană lock up 08–10 and 17–19.
29. The Landmark campus is a modern beige/grey block among old villas — contrast is striking.
30. Night: sodium-orange light on side streets vs white LED on boulevards (mixed).

## Gaps / to verify

- Rooftop ad brands at Victoriei/Romană not verified (no current licensed photo yet)
- Exact lamp/luminaire model per street
- Facade hex for unnamed buildings is style-rule based
- Europe House storey count conflict (OSM 14 vs listing GF+10)

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
