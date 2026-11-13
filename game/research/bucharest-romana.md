# Bucharest — Romană & Victoriei (`romana`): field research dossier

Role: research-buc-districts · generated 2026-11-06 23:03 UTC · machine-readable twin: `bucharest-romana.json` · images: `refs/romana/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul General Gheorghe Magheru, Bulevardul Iancu de Hunedoara, Bulevardul Lascăr Catargiu, Piața Romană, Piața Victoriei, Strada Clopotarii Vechi, Strada Grigore Alexandrescu, Strada Vasile Alecsandri, Șoseaua Pavel Dimitrievici Kiseleff |
| route_streets_researched | Bulevardul General Gheorghe Magheru, Bulevardul Iancu de Hunedoara, Bulevardul Lascăr Catargiu, Piața Romană, Piața Victoriei, Strada Clopotarii Vechi, Strada Grigore Alexandrescu, Strada Vasile Alecsandri, Șoseaua Pavel Dimitrievici Kiseleff |
| fronting_route_buildings | 109 |
| fronting_route_with_height | 41.3 |
| fronting_route_with_colour | 12.8 |
| fronting_route_researched | 0.9 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 100.0 |
| fronting_main_buildings | 541 |
| fronting_main_with_height | 57.3 |
| buildings_total | 2910 |
| buildings_with_height | 32.8 |
| businesses_total | 1046 |
| businesses_on_route | 74 |
| businesses_branded | 144 |
| trees_osm | 102 |
| lamps_osm | 6 |
| crossings | 304 |
| signal_nodes | 68 |
| transit_stops | 64 |
| metro_entrances | 6 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.4395, 26.0825], [44.457, 26.0825], [44.457, 26.1], [44.4395, 26.1]]` → bbox `[44.4395, 26.0825, 44.457, 26.1]`, area **2.705 km²**.
- Why: Extraction area = world agent bbox from cities.js BUC_DISTRICTS (so every street the world builds is covered). 1.0 km (N-S) x 1.25 km (E-W). West edge just past Piața Victoriei (Antipa museum, Kiseleff start), north edge = Bd. Iancu de Hunedoara + one block (Str. Washington quiet), east edge = Calea Dorobanților / Str. Mihai Eminescu, south edge = Str. Biserica Amzei / Piața Amzei (quiet) so all of Piața Romană, Lascăr Catargiu, Piața Victoriei and Vasile Alecsandri are inside.
- Research-proposed compact ~1 km² polygon (optional tighter cut): `[[44.445, 26.0838], [44.4542, 26.0838], [44.4542, 26.0995], [44.445, 26.0995]]`

## Chapter routes

### arnia · 2019 — Arnia Software — Europe House

- **Start**: WORLD START: Bd. Magheru northbound (cities.js CHAPTERS arnia) — `44.441885, 26.099288`, heading 341° on Bulevardul General Gheorghe Magheru.
- **End**: Europe House, Bd. Lascăr Catargiu 47-53 (SE-bound kerb) — `44.451507, 26.087592`.
- **Length**: 2094 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Bd. Magheru (Romană side) → around Piața Romană (ASE dome) → full length of Lascăr Catargiu → lap of Piața Victoriei (Palatul Victoria, Antipa, rooftop ads) → back to Europe House.
- **Sequence**: Bulevardul General Gheorghe Magheru (576 m) → Piața Romană (67 m) → Bulevardul Lascăr Catargiu (904 m) → Piața Victoriei (437 m) → Bulevardul Lascăr Catargiu (109 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4418, "lon": 26.0988, "road": "Magheru|Bălcescu", "bearing": 0}, {"lat": 44.4492, "lon": 26.0912, "road": "Lascăr Catargiu", "bearing": 315}, {"lat": 44.4532, "lon": 26.0866, "road": "Piața Victoriei"}, {"lat": 44.4511, "lon": 26.0878, "road": "Lascăr Catargiu", "bearing": 135}]`

### uipath-buc · 2020 — UiPath HQ — The Landmark, Vasile Alecsandri 4

- **Start**: WORLD START: Șos. Kiseleff southbound into Piața Victoriei (cities.js CHAPTERS uipath-buc) — `44.455966, 26.08374`, heading 157° on Șoseaua Pavel Dimitrievici Kiseleff.
- **End**: The Landmark, Str. Vasile Alecsandri 4 — `44.44995, 26.094298`.
- **Length**: 1464 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: World start on Șos. Kiseleff southbound (Antipa museum on the right) → into Piața Victoriei → east on Bd. Iancu de Hunedoara behind Palatul Victoria (tram reservation) → right into one-way Str. Clopotarii Vechi → left on one-way Str. Grigore Alexandrescu (children's hospital) → right into one-way Str. Vasile Alecsandri south to The Landmark (UiPath).
- **Sequence**: Șoseaua Pavel Dimitrievici Kiseleff (352 m) → Piața Victoriei (214 m) → Bulevardul Iancu de Hunedoara (267 m) → Strada Clopotarii Vechi (132 m) → Strada Grigore Alexandrescu (313 m) → Strada Vasile Alecsandri (186 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.456, "lon": 26.0842, "road": "Kiseleff", "bearing": 160}, {"lat": 44.4527, "lon": 26.0898, "road": "Iancu de Hunedoara", "bearing": 90}, {"lat": 44.4499, "lon": 26.0943, "road": "Vasile Alecsandri", "bearing": 180}]`

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

### Bulevardul Iancu de Hunedoara (chapter route)

- OSM: 15 ways, 1950 m in district, classes primary; lanes values ['2', '3']; one-way segments 15/15; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 1929, tram 1, tram 10, tram 46.
- OSM trees within 25 m: 3 (species —, genus —).
- OSM furniture: {'gate': 2}.
- Fronting buildings: 54; businesses: 16.
- **cross_section**: Dual carriageway 2 lanes each way (3 near junctions) either side of a central tram reservation (lines 1, 10, 46) with poles carrying the tram overhead; diagonal/kerb parking in short stretches on the S side (parking:right=street_side diagonal); 50 km/h; DJ200B
- **frontage**: 9-storey 1960s–70s blocks (Bl. H4–H6 S side, Bl. I1–I3, Bl. 2, 3 N side), Bloc Volga (37, 7 lv/30 m), Capital Plaza Hotel (54) near Dorobanți; Palatul Victoria rear at the W end
- confidence: high (OSM) [osm]

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
- **rooftop_signs_observed**: Photo Apr 2023 (refs/romana/4_Bulevardul_Lasc_r_Catargiu_Bucharest_03_.jpg): "NetBet" rooftop sign (white/blue letters on a dark frame) on the block at Lascăr Catargiu 2–4 next to a neo-Romanian villa; LED screen and vertical banners on facades; black steel anti-parking bollards along the kerb; iron villa fences.
- confidence: lanes/speed/wires high (OSM); trees/paving/lamps medium [osm] [wp_lascar]

### Bulevardul General Gheorghe Magheru (chapter route)

- OSM: 12 ways, 1407 m in district, classes primary; lanes values ['3', '4']; one-way segments 12/12; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 168, bus 226, bus 301, bus 331, bus 361, bus 368, bus 381, bus 331B.
- OSM trees within 25 m: 6 (species —, genus —).
- OSM furniture: {'bench': 7, 'waste_basket': 4, 'bicycle_rental': 1}.
- Fronting buildings: 14; businesses: 70.
- **cross_section**: Wide boulevard, one-way pairs at Romană: N-bound 4 lanes (through×3 + through;right), S-bound 3 lanes; 60 km/h; metro M2 beneath; wide sidewalks (6–8 m) with grey pavers; continuous interwar modernist blocks (8–12 storeys, Magheru is THE interwar modernist boulevard) with ground-floor shops and cinemas further south
- **ads**: whole-facade mesh banners on several blocks (pressone_ads)
- **rooftop_signs_observed**: Photo Apr 2023 (refs/romana/14_Bulevardul_Gheorghe_Magheru_Bucharest_04_.jpg): whole-facade mesh ad on the interwar block at Magheru 14 plus an empty steel rooftop billboard frame; municipal "Dragă Sector 1" banners; traffic signals on mast arms with black backplates.
- confidence: lanes high; facades medium [osm] [pressone_ads]

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

### Șoseaua Pavel Dimitrievici Kiseleff (chapter route)

- OSM: 1 ways, 578 m in district, classes primary; lanes values ['4']; one-way segments 1/1; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 203, bus 361.
- Fronting buildings: 0; businesses: 2.
- **cross_section**: grand tree-lined avenue entering Piața Victoriei from the north (world start for uipath-buc): wide dual carriageway with broad lawn/tree verges and park-like sidewalks under mature chestnuts/lindens and planes; primary, 50 km/h (verify signs); Grigore Antipa museum and the Museum of the Romanian Peasant at its southern end on the W side
- confidence: medium (OSM class; photos pending) [osm] [wp_victoriei]

### Piața Romană (chapter route)

- OSM: 14 ways, 384 m in district, classes primary; lanes values ['3', '5']; one-way segments 14/14; maxspeed ['50', '60', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 168, bus 226, bus 361, bus 368, bus 381, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM furniture: {'clock': 1}.
- Fronting buildings: 1; businesses: 2.
- **layout**: Signalised square where Magheru (S, one-way N-bound arm 3–4 lanes + the S-bound arm), Lascăr Catargiu (NW) and Bd. Dacia (E–W) cross; traffic circulates around a small central island (former Capitoline Wolf statue site 1997–2010, statue moved to Bd. I.C. Brătianu). Metro M2 Piața Romană with entrances on Magheru.
- **frontage**: N/NE: ASE main building (Academia de Studii Economice, Piața Romană 6 — monumental neoclassical with central dome and portico, 1916–1926) and Casa Nanu-Muscel; SW: Gheorghe Petrașcu House no. 1 (1907, Ion Mincu, neo-Romanian, arcaded loggia, tiled roof); no. 5: second Petrașcu house (1913, Spiridon Cegăneanu); interwar 4–8-storey blocks with shops on Magheru; Sheraton (18 lv, 70 m, 1976) east on Bd. Dacia.
- **ground_floor**: 5 to go kiosk-cafe, Help Net & Dona pharmacies, Calzedonia, Miniso, STB ticket booth, Patiseria Tineretului, Treevi Pizza (Magheru east side, OSM)
- **rooftop_signs_observed**: Photo Apr 2023 (refs/romana/9_Pia_a_Roman_Bucharest_05_.jpg): the large curved 8-storey interwar block at Piața Romană 9 (corner Magheru/Dacia, facing the square) carries a long RED Coca-Cola rooftop sign following the curve (red band #E41E2B with white bubbles and white "Coca-Cola" script), plus a tall vertical Coca-Cola bottle panel on its facade and red shop fascias at street level; a glass office tower rises behind to the left. The square has wide multi-lane asphalt with white dashed lane lines and many white turn arrows, kerbed islands and a small monument on the central island.
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

### Calea Victoriei

- OSM: 7 ways, 1642 m in district, classes secondary; lanes values ['2', '3', '4']; one-way segments 7/7; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 122, bus 137, bus 168, bus 226, bus 311, bus 361, bus 368.
- OSM trees within 25 m: 32 (species —, genus —).
- OSM furniture: {'gate': 2, 'drinking_water': 1, 'bicycle_rental': 1, 'waste_basket': 7}.
- Fronting buildings: 113; businesses: 89.
- **cross_section**: northern end: 1–2 lanes each way, 50 km/h; listed houses (Casa Vernescu 133 — casino/restaurant, Casa Nenciu, Casa cu cariatide 202, Palatul Cantacuzino 141 — George Enescu Museum) and 1990s towers at Piața Victoriei
- **lamps**: black ornamental cast-iron style lanterns along Calea Victoriei (city rule "historic")
- confidence: medium [osm]

### Pasajul Victoria

- OSM: 9 ways, 1411 m in district, classes primary; lanes values ['2']; one-way segments 9/9; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 1929, tram 1, tram 10, tram 46.
- Fronting buildings: 0; businesses: 3.

### Bulevardul Dacia

- OSM: 21 ways, 1336 m in district, classes primary, residential, secondary; lanes values ['1', '2', '3', '4']; one-way segments 13/21; maxspeed ['30', '50', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 168, bus 226, bus 301, bus 331, bus 361, bus 368, bus 331B, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM trees within 25 m: 8 (species —, genus —).
- OSM furniture: {'gate': 1, 'lift_gate': 1, 'taxi': 1, 'drinking_water': 1}.
- Fronting buildings: 34; businesses: 31.
- **cross_section**: two-way 2+2 (4 lanes) through Piața Romană, trolleybus 79/86/97 and many buses; ASE Mihai Eminescu building (41), Sheraton (5-7), Academy Library (125) further west
- confidence: high (OSM) [osm]

### Calea Dorobanților

- OSM: 13 ways, 1255 m in district, classes primary, secondary, tertiary; lanes values ['4', '6']; one-way segments 4/13; maxspeed ['60', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 301, bus 331, bus 335, bus 461, bus 331B, trolleybus 79, trolleybus 86, trolleybus 97.
- OSM furniture: {'post_box': 1, 'lift_gate': 1, 'gate': 2, 'drinking_water': 1}.
- Fronting buildings: 38; businesses: 72.
- **cross_section**: between Piața Romană and Iancu de Hunedoara: one-way SOUTHBOUND for cars (4 lanes) with a CONTRAFLOW northbound bus/trolleybus lane (busway=opposite_lane); trolleybus 79, 86, 97
- confidence: high (OSM) [osm]

### Bulevardul Aviatorilor

- OSM: 16 ways, 1060 m in district, classes primary, residential; lanes values ['1', '6']; one-way segments 5/16; maxspeed ['60', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 203, bus 361.
- Fronting buildings: 6; businesses: 6.

### Strada Buzești

- OSM: 11 ways, 986 m in district, classes primary; lanes values ['2', '3']; one-way segments 8/11; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 205.
- OSM furniture: {'surveillance': 1, 'gate': 1, 'lift_gate': 1, 'recycling': 1}.
- Fronting buildings: 106; businesses: 25.

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

### Bulevardul Ion Mihalache

- OSM: 6 ways, 473 m in district, classes primary; lanes values ['2']; one-way segments 6/6; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 205, bus 381.
- OSM furniture: {'gate': 1, 'lift_gate': 1}.
- Fronting buildings: 6; businesses: 3.

### Șoseaua Nicolae Titulescu

- OSM: 5 ways, 399 m in district, classes primary; lanes values ['2']; one-way segments 5/5; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 381.
- OSM furniture: {'bicycle_parking': 2, 'lift_gate': 2}.
- Fronting buildings: 7; businesses: 11.

### Strada Constantin Daniel

- OSM: 2 ways, 273 m in district, classes residential; lanes values ['1']; one-way segments 2/2; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 17; businesses: 2.

### Strada Mihai Eminescu

- OSM: 1 ways, 253 m in district, classes secondary; lanes values ['2']; one-way segments 1/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 2; businesses: 3.

### Șoseaua Ștefan cel Mare

- OSM: 3 ways, 230 m in district, classes primary; lanes values ['3', '4']; one-way segments 3/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 335, bus 461, bus 1929, tram 1, tram 46.
- Fronting buildings: 0; businesses: 9.

### Intrarea Buzești

- OSM: 1 ways, 82 m in district, classes residential; lanes values []; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 7; businesses: 0.

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
| n6498351591 | Bulevardul General Gheorghe Magheru × Strada Jules Michelet | yes |  | 7 |
| n1340445073 | Bulevardul General Gheorghe Magheru × Strada Pictor Arthur Verona |  |  | 1 |
| n257680252 | Bulevardul Lascăr Catargiu × Strada Povernei |  |  | 2 |
| n257680249 | Bulevardul Lascăr Catargiu × Strada Viișoarei |  |  | 0 |
| n31402063 | Calea Victoriei × Piața Victoriei | yes |  | 5 |
| n31402056 | Bulevardul Iancu de Hunedoara × Piața Victoriei | yes |  | 3 |
| n255721965 | Piața Victoriei × Strada Duiliu Zamfirescu | yes |  | 2 |
| n255895639 | Strada Monetăriei × Șoseaua Pavel Dimitrievici Kiseleff | yes |  | 2 |
| n1006024745 | Bulevardul Lascăr Catargiu × Strada Clopotarii Vechi | yes |  | 5 |
| n33390176 | Bulevardul Lascăr Catargiu × Strada General Gheorghe Manu | yes |  | 8 |
| n1397123589 | Bulevardul Aviatorilor × Piața Victoriei × Strada Duiliu Zamfirescu | yes |  | 4 |
| n257714748 | Bulevardul Lascăr Catargiu × Piața Victoriei | yes |  | 5 |
| n2404275892 | Bulevardul Iancu de Hunedoara × Bulevardul Lascăr Catargiu × Piața Victoriei | yes |  | 2 |
| n31402059 | Piața Victoriei × Șoseaua Pavel Dimitrievici Kiseleff |  |  | 0 |
| n256192514 | Bulevardul Iancu de Hunedoara × Strada Clopotarii Vechi |  |  | 1 |
| n296039801 | Bulevardul Iancu de Hunedoara × Pasajul Victoria | yes |  | 3 |
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
| w241932504 | Bulevardul General Gheorghe Magheru | E | 8 | yes · Garajul Ciclop | 7 |  | 1923 |  | interwar (art deco / modernist) apartment block | #E2D3B5 est | 0 |
| w442813528 | Bulevardul General Gheorghe Magheru | E | 8-10 | yes · Hotel Ambasador | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 3 |
| w162494339 | Bulevardul General Gheorghe Magheru | E | 18 | apartments | 8 |  |  |  | communist-era block (likely) | #C7C1B5 est | 3 |
| w162494314 | Bulevardul General Gheorghe Magheru | E | 20 | apartments | 7 |  |  |  | unknown (use district rule) | #E2D3B5 est | 5 |
| w241932500 | Bulevardul General Gheorghe Magheru | E |  | apartments | 7.0 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 3 |
| w283091403 | Bulevardul General Gheorghe Magheru | E |  | apartments | 10 |  |  |  | communist-era block (likely) | #BDB5A6 est | 3 |
| w283091435 | Bulevardul General Gheorghe Magheru | E |  | apartments | 6 |  |  |  | unknown (use district rule) | #E8E1D3 est | 2 |
| w317347462 | Bulevardul General Gheorghe Magheru | E |  | apartments | 9 |  |  |  | communist-era block (likely) | #A9A49B est | 12 |
| w559450992 | Bulevardul Iancu de Hunedoara | S |  | house | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #D8C3A5 est | 0 |
| w1517168168 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 4 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517168167 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 30 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w236091148 | Bulevardul Iancu de Hunedoara | S |  | apartments · Bl. H6 | 11.0 est |  |  |  | unknown (use district rule) | #BFB8A8 est | 0 |
| w1517168170 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 36 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517168169 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 33 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517060715 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 30 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517060714 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 30 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w236091150 | Bulevardul Iancu de Hunedoara | S |  | apartments · Bl. H5 | 9 |  |  |  | communist-era block (likely) | #BDB5A6 est | 0 |
| w1517060713 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 27 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517060712 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 30 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517060710 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 27 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w45514712 | Bulevardul Iancu de Hunedoara | S |  | apartments · Bl. H4 | 3.0 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 1 |
| w1517060716 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 24 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1517060711 | Bulevardul Iancu de Hunedoara | S |  | yes |  | 24 |  |  | unknown (use district rule) | #fff8dc | 0 |
| w1520984127 | Bulevardul Iancu de Hunedoara | S |  | yes | 5.0 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1441705293 | Bulevardul Lascăr Catargiu | NE |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w171045145 | Bulevardul Lascăr Catargiu | NE |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w583614925 | Bulevardul Lascăr Catargiu | NE |  | detached | 2 est |  |  |  | low house/villa (19th-early 20th c. likely) | #E9E0CF est | 0 |
| w571479979 | Bulevardul Lascăr Catargiu | NE | 7a | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 0 |
| w323875142 | Bulevardul Lascăr Catargiu | NE | 14 | apartments · Fischer International | 4 |  | 1938 | Seismic Risk Class III | interwar (art deco / modernist) apartment block | #CFC8B8 est | 1 |
| w324094050 | Bulevardul Lascăr Catargiu | NE | 16 | apartments | 4 | 14 | 1929 | Seismic Risk Class III | interwar (art deco / modernist) apartment block | #E8E1D3 est | 0 |
| w583614940 | Bulevardul Lascăr Catargiu | NE |  | apartments | 4 |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w171045066 | Bulevardul Lascăr Catargiu | NE |  | yes · Secția 1 | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 1 |
| w171045123 | Bulevardul Lascăr Catargiu | NE |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w180556783 | Bulevardul Lascăr Catargiu | NE | 28 | apartments | 5 | 17.5 | 1935 | Urgency Category 2 | interwar (art deco / modernist) apartment block | #BFB8A8 est | 0 |
| w245083672 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w245083609 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w245083664 | Bulevardul Lascăr Catargiu | NE |  | retail | 3 |  |  |  | unknown (use district rule) | #E2D3B5 est | 0 |
| w245083655 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w245083616 | Bulevardul Lascăr Catargiu | NE |  | yes | 3 |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w231445034 | Bulevardul Lascăr Catargiu | NE | 44 | semidetached_house | 3 | 13 | 1910 | Seismic Risk Class I | pre-1919 eclectic / neo-romanian house or villa | #E7D8C9 est | 0 |
| w324179820 | Bulevardul Lascăr Catargiu | NE |  | commercial | 5.0 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w1418176530 | Bulevardul Lascăr Catargiu | NE | 48 | apartments | 3 | 13 | 1880 | Retrofitted | pre-1919 eclectic / neo-romanian house or villa | #E9E0CF est | 0 |
| w405553978 | Bulevardul Lascăr Catargiu | NE | 54 | civic | 2.0 est |  |  |  | unknown (use district rule) | #BFB8A8 est | 1 |
| w231445037 | Bulevardul Lascăr Catargiu | NE |  | apartments | 3 |  |  |  | unknown (use district rule) | #CFC8B8 est | 1 |
| w923421208 | Bulevardul Lascăr Catargiu | SW |  | apartments | 11 | 39.25 |  |  | unknown (use district rule) | #E5E5CF | 0 |
| w923520626 | Bulevardul Lascăr Catargiu | SW |  | yes |  | 39.25 |  |  | unknown (use district rule) | #E5E5CF | 0 |
| w559463171 | Bulevardul Lascăr Catargiu | NE | 58 | house | 3 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6D3B3 est | 0 |
| w1516933653 | Strada Grigore Alexandrescu | S |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1516933654 | Strada Grigore Alexandrescu | S |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1516933652 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w231445015 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w231445041 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w180556816 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w1449310934 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310935 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w1449310932 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310933 | Strada Grigore Alexandrescu | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310948 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w231445047 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w231445063 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w206360989 | Strada Grigore Alexandrescu | S | 56 | yes · Zen Sushi | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 1 |
| w559463172 | Strada Grigore Alexandrescu | N |  | residential · Casa Ronald McDonald | 3 |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w1449310947 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310946 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w559463173 | Strada Grigore Alexandrescu | N |  | hospital · Clinică de Arsuri și Chirurgie Plastică | 3 |  |  |  | unknown (use district rule) | #BFB8A8 est | 0 |
| w206360981 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w1449310914 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310936 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w1449310915 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w369058096 | Strada Grigore Alexandrescu | N |  | hospital · Ambulator | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6D3B3 est | 0 |
| w1449310922 | Strada Grigore Alexandrescu | S |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310938 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310937 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310931 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w1449310939 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310940 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w1449310941 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w1449310942 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310943 | Strada Grigore Alexandrescu | N |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310944 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310945 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w1449310928 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310930 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w1449310929 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310927 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 1 |
| w1449310923 | Strada Grigore Alexandrescu | N |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w171045139 | Strada Grigore Alexandrescu | N |  | commercial · HQ Victoriei | 5 |  |  |  | unknown (use district rule) | #5E7F8C est | 0 |
| w182933471 | Strada Vasile Alecsandri | E |  | apartments | 3 |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w23647615 | Strada Vasile Alecsandri | W |  | school · Școala Națională de Studii Politice și Administrative | 7.0 est |  |  |  | unknown (use district rule) | #E8E1D3 est | 0 |
| w546500235 | Strada Vasile Alecsandri | E |  | office · The Landmark Corp B | 7 |  |  |  | modern office/glass curtain wall | #D8D3C8 | 3 |
| w1449310958 | Strada Vasile Alecsandri | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 1 |
| w546500248 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310957 | Strada Vasile Alecsandri | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w546500247 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #D8C3A5 est | 0 |
| w1449310956 | Strada Vasile Alecsandri | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w206360983 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w1449310955 | Strada Vasile Alecsandri | W |  | yes | 2 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w206360984 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310954 | Strada Vasile Alecsandri | W |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w546500238 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #C9B79C est | 0 |
| w245083610 | Strada Vasile Alecsandri | W |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w546500256 | Strada Vasile Alecsandri | E |  | yes | 2 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 0 |
| w546500250 | Strada Vasile Alecsandri | E |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E9E0CF est | 0 |
| w1449310919 | Strada Vasile Alecsandri | E |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w583614934 | Strada Vasile Alecsandri | E |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E7D8C9 est | 0 |
| w1449310921 | Strada Vasile Alecsandri | W |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #E6D3B3 est | 1 |
| w180563617 | Strada Clopotarii Vechi | W | 9 | yes · Electrica | 5 |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w813353254 | Strada Clopotarii Vechi | E |  | hospital | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E7D8C9 est | 0 |
| w303383746 | Strada Clopotarii Vechi | W |  | office | 10 |  |  |  | modern office/glass curtain wall | #5E7F8C est | 1 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| n2546324265 |  |  | disused:shop=kiosk | Bulevardul General Gheorghe Magheru | E |  |
| n2980319633 |  |  | disused:shop=kiosk | Bulevardul General Gheorghe Magheru | E |  |
| n4549374247 |  |  | disused:shop=yes | Bulevardul General Gheorghe Magheru | E |  |
| n6513758411 |  |  | disused:shop=coffee | Bulevardul General Gheorghe Magheru | E |  |
| n9001427429 |  |  | disused:shop=coffee | Bulevardul General Gheorghe Magheru | E |  |
| n11261959885 |  |  | disused:shop=newsagent | Bulevardul General Gheorghe Magheru | E |  |
| n11261959886 |  |  | disused:shop=florist | Bulevardul General Gheorghe Magheru | E |  |
| n6464523585 | 5 to go | 5 to go bg #FFD100 fg #1D1D1B | amenity=cafe | Bulevardul General Gheorghe Magheru | E |  |
| n9789836226 | ANSPDCP |  | office=government | Bulevardul General Gheorghe Magheru | E | 28-30 |
| n5519214706 | Basarabia |  | shop=deli | Bulevardul General Gheorghe Magheru | E |  |
| n11172363189 | Calzedonia | Calzedonia bg #FFFFFF fg #000000 | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n6513747170 | Carte |  | amenity=cafe | Bulevardul General Gheorghe Magheru | E |  |
| n11513855675 | Casandra |  | shop=confectionery | Bulevardul General Gheorghe Magheru | E |  |
| n11581824569 | Crăpelniță |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E |  |
| n11513871803 | Depot 96 |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11513886232 | DiKa |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n4549374505 | Emre Baklava |  | shop=bakery | Bulevardul General Gheorghe Magheru | E |  |
| n2637716251 | Farmacia Dona | Farmacia Dona bg #E30613 fg #FFFFFF | amenity=pharmacy | Bulevardul General Gheorghe Magheru | E |  |
| n12318228499 | FormART |  | tourism=gallery | Bulevardul General Gheorghe Magheru | E |  |
| n12318285854 | Galeria SIMEZA |  | tourism=gallery | Bulevardul General Gheorghe Magheru | E |  |
| n6513779013 | Help Net | Help Net bg #E30613 fg #FFFFFF | amenity=pharmacy | Bulevardul General Gheorghe Magheru | E |  |
| n11172363183 | Help Net | Help Net bg #E30613 fg #FFFFFF | amenity=pharmacy | Bulevardul General Gheorghe Magheru | E |  |
| n11172363186 | Hobby Mobile Accessories |  | shop=mobile_phone_accessories | Bulevardul General Gheorghe Magheru | E |  |
| w442813528 | Hotel Ambasador |  | tourism=hotel | Bulevardul General Gheorghe Magheru | E | 8-10 |
| n11172363184 | Innovative Romana |  | shop=copyshop | Bulevardul General Gheorghe Magheru | E |  |
| n328610358 | KFC | KFC bg #E4002B fg #FFFFFF | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 28-30 |
| n11513884483 | Lashez |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11198089510 | Mayari |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n453472519 | McDonald's | McDonald's bg #DA291C fg #FFC72C | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 24 |
| n4549351693 | Mesopotamia | Mesopotamia bg #B31B1B fg #FFD200 | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 26 |
| n11178795303 | Miniso |  | shop=variety_store | Bulevardul General Gheorghe Magheru | E |  |
| n11618363305 | My Private Sex Shop |  | shop=erotic | Bulevardul General Gheorghe Magheru | E |  |
| n2994807532 | Noodle Pack |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 26 |
| n2872402339 | OB'ART |  | tourism=gallery | Bulevardul General Gheorghe Magheru | E |  |
| n11172363185 | Pan Caldi |  | shop=bakery | Bulevardul General Gheorghe Magheru | E |  |
| n2394766461 | Patiseria Tineretului |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E | 32-36 |
| n849372213 | Patria | Patria Bank bg #1C3F94 fg #FFFFFF | amenity=cinema | Bulevardul General Gheorghe Magheru | E |  |
| n11513853602 | Prego |  | shop=shoes | Bulevardul General Gheorghe Magheru | E |  |
| n11263095690 | STB |  | shop=ticket | Bulevardul General Gheorghe Magheru | E |  |
| n12318285863 | Super Gold |  | shop=jewelry | Bulevardul General Gheorghe Magheru | E |  |
| n11513879453 | T!naR |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n11172363187 | Tabakos |  | shop=tobacco | Bulevardul General Gheorghe Magheru | E |  |
| n328622616 | Teatrul Nottara |  | amenity=theatre | Bulevardul General Gheorghe Magheru | E |  |
| n11648912069 | The Kimchi |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E |  |
| n4549374246 | Toan's |  | amenity=fast_food | Bulevardul General Gheorghe Magheru | E |  |
| n11172363188 | Treevi Pizza Al Taglio |  | amenity=restaurant | Bulevardul General Gheorghe Magheru | E | 9 |
| n9001379102 | Târgul Cărții  |  | amenity=library | Bulevardul General Gheorghe Magheru | E |  |
| n12318280957 | Uniunea Juriștilor din România |  | office=lawyer | Bulevardul General Gheorghe Magheru | E |  |
| n11513872026 | sadhana |  | shop=clothes | Bulevardul General Gheorghe Magheru | E |  |
| n3757940564 | CEC Bank | CEC Bank bg #004C97 fg #FFFFFF | amenity=bank | Bulevardul Iancu de Hunedoara | S | 8 |
| n3707528309 | F.M. Medident - Piața Victoriei |  | amenity=dentist | Bulevardul Iancu de Hunedoara | S | 6 |
| w813353255 | Farmacia Santia |  | amenity=pharmacy | Bulevardul Iancu de Hunedoara | S | 30-32 |
| n11222737061 |  |  | disused:shop=florist | Bulevardul Lascăr Catargiu | SW |  |
| w874893780 | ADP Sector 1 |  | amenity=parking | Bulevardul Lascăr Catargiu | S |  |
| n2457790509 | Aeroclubul României |  | office=association | Bulevardul Lascăr Catargiu | NE |  |
| n8572234851 | BRD | BRD bg #000000 fg #FFFFFF | amenity=bank | Bulevardul Lascăr Catargiu | SW | 224 |
| w323875142 | Fischer International |  | amenity=library | Bulevardul Lascăr Catargiu | NE | 14 |
| n12906263752 | Grand Boulevard Apartment at Piata Romana |  | tourism=apartment | Bulevardul Lascăr Catargiu | NE |  |
| w171045066 | Secția 1 |  | amenity=police | Bulevardul Lascăr Catargiu | NE |  |
| n1493026199 | Trattoria Buongiorno |  | amenity=restaurant | Bulevardul Lascăr Catargiu | NE | 56 |
| n5602930826 | Viggo |  | shop=clothes | Bulevardul Lascăr Catargiu | NE |  |
| w180563617 | Electrica |  | office=energy_supplier | Strada Clopotarii Vechi | W | 9 |
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
| w1264549614 |  |  | amenity=parking | Șoseaua Pavel Dimitrievici Kiseleff | W |  |
| w23611106 | Școala Generală nr. 11 "Ion Heliade Rădulescu" |  | amenity=school | Șoseaua Pavel Dimitrievici Kiseleff | SW | 2 |

Other branded businesses in the district (off-route): Alpha Bank (Bulevardul Dacia, n2504757652); Fornetti (Bulevardul Dacia, n8513025042); Libra Bank (Bulevardul Dacia, n11261905154); Luca (Bulevardul Dacia, n3756982645); Pizza Hut (Bulevardul Dacia, n328607517); Shop&Go (Bulevardul Dacia, n3907600553); Starbucks (Bulevardul Dacia, n3499962407); BRD (Bulevardul General Gheorghe Magheru, n3734652403); Euronet (Bulevardul General Gheorghe Magheru, n7056486518); Libra Bank (Bulevardul General Gheorghe Magheru, n4549374248); Orange (Bulevardul General Gheorghe Magheru, n7293870988); Samsonite (Bulevardul General Gheorghe Magheru, n10996915893); Superbet (Bulevardul General Gheorghe Magheru, n8628417865); Vodafone (Bulevardul General Gheorghe Magheru, n2446512554); Domino's (Bulevardul Iancu de Hunedoara, n3759186612); Mega Image (Bulevardul Iancu de Hunedoara, n1762277750); BRD (Bulevardul Ion Mihalache, n928470206); Orange (Bulevardul Lascăr Catargiu, n3357667293); Orange (Bulevardul Lascăr Catargiu, n3357667193); BCR (Bulevardul Nicolae Bălcescu, n5519217930); Euronet (Bulevardul Nicolae Bălcescu, n7056420367); Sephora (Bulevardul Nicolae Bălcescu, n5602931594); Shop&Go (Bulevardul Nicolae Bălcescu, n2446520566); 5 to go (Calea Dorobanților, n13547226676); BRD (Calea Dorobanților, n328585677); Dr. Max (Calea Dorobanților, n4564413803); Garanti (Calea Dorobanților, n4657735590); Help Net (Calea Dorobanților, n1768903148); ING (Calea Dorobanților, n2394901656); Libra Bank (Calea Dorobanților, n7056384863); Luca (Calea Dorobanților, n13427923360); OTP Bank (Calea Dorobanților, n7038716407); Orange (Calea Dorobanților, n2432213825); Pepco (Calea Dorobanților, n13429496906); Raiffeisen Bank (Calea Dorobanților, n13427923361); Shop&Go (Calea Dorobanților, n3200340961); Shop&Go (Calea Dorobanților, n13132808504); Superbet (Calea Dorobanților, n13429496917); Ted's Coffee Co. (Calea Dorobanților, n7312238328); Profi (Calea Griviței, n5050770522); Superbet (Calea Griviței, n8628418145); BCR (Calea Victoriei, n1563503947); CEC Bank (Calea Victoriei, n2582107010); Carrefour Express (Calea Victoriei, n9913921972); Euronet (Calea Victoriei, n7027278278); Euronet (Calea Victoriei, n7056447103); Exim Banca Românească (Calea Victoriei, n4353553453); Froo (Calea Victoriei, n13686920006); La Doi Pași (Calea Victoriei, n2546327480); Leonidas (Calea Victoriei, n4353556019); Starbucks (Calea Victoriei, n4350720097); Ted's Coffee Co. (Calea Victoriei, n8572234820); UniCredit (Calea Victoriei, n7080689122); 5 to go (Piața General Gheorghe Angelescu, n14299990815); UniCredit (Strada Anastase Simu, n4549374245); First Bank (Strada Arthur Verona, n4549374244); Banca Transilvania (Strada Axinte Uricariul, n3707543170); Carrefour Express (Strada Axinte Uricariul, n5068656516); Libra Bank (Strada Axinte Uricariul, n1768905825); Opticris (Strada Axinte Uricariul, n13427923367); Regina Maria (Strada Axinte Uricariul, n4766207560); Ted's Coffee Co. (Strada Axinte Uricariul, n13427923366); 5 to go (Strada Biserica Amzei, n13592808737); Libra Bank (Strada Biserica Amzei, n14205359901); Annabella (Strada Buzești, n9913945479); DHL (Strada Buzești, n3756813282); Dr. Max (Strada Buzești, n2637716538); Dr. Max (Strada Buzești, n8709661327); Euronet (Strada Buzești, n7056388009); ING (Strada Buzești, n2394831465); Luca (Strada Buzești, n9726046117); OTP Bank (Strada Buzești, n3767754712); Regina Maria (Strada Buzești, n9913743863); Starbucks (Strada Buzești, n6696629629); UniCredit (Strada C. A. Rosetti, n2723374088); 5 to go (Strada Constantin D. Stahi, n6420082185); 5 to go (Strada Căderea Bastiliei, n14090031824); Ted's Coffee Co. (Strada Căderea Bastiliei, n13634135886); BCR (Strada Dimitri Ivanovici Mendeleev, n5602922763); Catena (Strada Dimitri Ivanovici Mendeleev, n2637716141); Euronet (Strada Dimitri Ivanovici Mendeleev, n7055438633); Maxbet (Strada Dimitri Ivanovici Mendeleev, n11825001199); Mega Image (Strada Dimitri Ivanovici Mendeleev, n4048726666); dm (Strada Dimitri Ivanovici Mendeleev, n7293845639); Catena (Strada Doctor Vasile Sion, n2637716156); Euronet (Strada Episcopiei, n7056368460); Berezka (Strada General Christian Tell, n11361439323); CEC Bank (Strada General Christian Tell, n4637225118); Exim Banca Românească (Strada General Christian Tell, n4637225119); Fortuna (Strada General Christian Tell, n11361405951); Stanleybet (Strada General Christian Tell, n11361411581); Superbet (Strada General Christian Tell, n8628417678); Domino's (Strada General Constantin Budișteanu, n10310765209); 5 to go (Strada George Enescu, n11261883854); 5 to go (Strada George Enescu, n13483547259); Mega Image (Strada George Enescu, n328617948); Mega Image (Strada George Enescu, n3038087033); Regina Maria (Strada George Enescu, n10012619118); UniCredit (Strada George Enescu, n3118870194); Raiffeisen Bank (Strada Grigore Alexandrescu, n1312175595); dm (Strada Hatmanul Arbore, n4564405596); Help Net (Strada Hristache Pitarul, n1768906184); Regina Maria (Strada Louis Blanc, n12964827742); 5 to go (Strada Luterană, n11131305331); Euronet (Strada Luterană, n7057665442); Carrefour Market (Strada Maior Giurescu Dimitrie, n1768896770); BRD (Strada Mihail Moxa, n4690003478); Euronet (Strada Mihail Moxa, n7056393674); Shop&Go (Strada Mihail Moxa, n11991603619); Garanti (Strada Paris, n13286822065); Garanti (Strada Paris, n13877761337); 5 to go (Strada Piața Amzei, n13544497924); Banca Transilvania (Strada Piața Amzei, n1393093204); Dr. Max (Strada Piața Amzei, n7293870994); Dr. Max (Strada Piața Amzei, n11361456713); Help Net (Strada Piața Amzei, n7293870989); Mega Image (Strada Piața Amzei, n1393093079); Mega Image (Strada Piața Amzei, n7293870990); Raiffeisen Bank (Strada Piața Amzei, n1563503900); Cărturești (Strada Pictor Arthur Verona, n328616370); Catena (Strada Sevastopol, n12315963238); Inmedio (Strada Sevastopol, n2621106559); BCR (, n2379990970); Mega Image (, n2613331337); dm (, n7932109194); BRD (Șoseaua Nicolae Titulescu, w405520011); Starbucks (Șoseaua Nicolae Titulescu, n1296347641); UniCredit (Șoseaua Nicolae Titulescu, n7106709740); Inmedio (Șoseaua Nicolae Titulescu, n10951615124); Berezka (Șoseaua Ștefan cel Mare, n11608041705); UniCredit (Șoseaua Ștefan cel Mare, n3759186613); Vodafone (Șoseaua Ștefan cel Mare, n3759186615).

## Transit

- Lines with OSM route relations touching the district: bus 100, bus 122, bus 137, bus 168, bus 178, bus 203, bus 205, bus 226, bus 301, bus 311, bus 331, bus 335, bus 361, bus 368, bus 381, bus 461, bus 1929, bus 331B, tram 1, tram 10, tram 46, trolleybus 79, trolleybus 86, trolleybus 97.
- Stops: A.S.E. (bus); Arthur Verona (bus); Bd. Dacia (bus); Bd. Nicolae Bălcescu (bus); Biblioteca Academiei Române (bus); Calea Dorobanților (bus); Calea Dorobanților (tram); Calea Griviței (bus); Calea Victoriei (bus); Cișmigiu (bus); Constantin Cristescu (bus); Gheorghe Manu (bus); Luterană (bus); Muzeul Țăranului Român (bus); Nicolae Golescu (bus); Orlando (platform); Pasaj Victoria (bus); Perla (bus); Piata Victoriei (bus); Piața Alexandru Lahovari (bus); Piața Buzești (tram); Piața Buzești (trolleybus); Piața Romană (bus); Piața Romană (bus/trolleybus); Piața Romană (platform); Piața Romană (trolleybus); Piața Victoriei (bus); Piața Victoriei (tram); Popa Tatu (bus/trolleybus); Povernei (platform); Roma (bus); Roma (tram); Sala Palatului (bus); Sfintii Voievozi (bus); Spitalul Clinic Filantropia (bus); Spitalul Grigore Alexandrescu (tram); Șoseaua Ștefan cel Mare (bus); Știrbei Vodă (bus).
- Metro entrances: Piața Victoriei - M1 M2 A (44.45161, 26.08712); Piața Victoriei B (44.45171, 26.08762); Piața Victoriei - M1 M2 C (44.45371, 26.08624); Piața Victoriei - Ascensor  (44.45174, 26.08672); Piața Romană  (44.44583, 26.09757); Piața Romană  (44.44506, 26.09796).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Dialogue (district pedestrians)

Each line {text (original language), en (English)}; persona.lang = language of text; `base` refers to bucharest-spots.json dialogue_general.persona_library; categories greeting / bumped / photographed / idle / district (place-specific facts, all consistent with this dossier). Shared: bucharest-spots.json → dialogue_general.pedestrian_general (honked_at, near_miss, sidewalk_parking, idle, small_talk) applies to every district pedestrian. Total district lines: 67.

### Ioana (ASE student) (`ase_student`, local, lang ro, 19-23) — 17 lines
Economics student with a tote bag and iced coffee, rushing between the ASE building and the metro.

- *greeting*: „Salut!” (Hi!) · „Neața! Știi cumva unde-i sala 0101?” (Morning! Do you know where room 0101 is?) · „Hei, ești și tu la ASE?” (Hey, are you at ASE too?)
- *bumped*: „Au! Am cursul în două minute!” (Ow! My lecture starts in two minutes!) · „Atenție, că-mi varși cafeaua!” (Careful, you'll spill my coffee!) · „Scuze, eram pe telefon.” (Sorry, I was on my phone.)
- *photographed*: „Stai, să-mi aranjez părul!” (Wait, let me fix my hair!) · „Fă una cu cupola ASE în spate!” (Take one with the ASE dome behind!) · „O pui pe Insta? Dă-mi tag!” (Posting it on Insta? Tag me!)
- *idle*: „Am sesiune și n-am deschis cartea.” (Exams are on and I haven't opened the book.) · „Metroul de la Romană e plin ochi.” (The metro at Romană is packed.) · „Mergem la un 5 to go după curs?” (Shall we grab a 5 to go after class?)
- *district*: „Piața Romană la opt dimineața e un haos.” (Piața Romană at eight in the morning is chaos.) · „Clădirea mare cu cupolă e ASE-ul, din 1913 facultatea.” (The big domed building is ASE, the school dates from 1913.) · „Pe Magheru e tot timpul aglomerat.” (Magheru is always jammed.) · „Trolebuzul 79 nu mai vine odată!” (Trolleybus 79 is never coming!) · „Aici era lupoaica, au mutat-o pe Brătianu.” (The Capitoline Wolf used to stand here, they moved it to Brătianu.)

### Radu (developer, Lascăr Catargiu) (`office_worker`, local, lang ro, 25-40) — 17 lines
Software engineer with a lanyard and laptop backpack, walking between Europe House and The Landmark.

- *greeting*: „Salut, bună!” (Hi there!) · „Bună ziua, căutați recepția?” (Good day, looking for reception?) · „Hey, good morning!”
- *bumped*: „Hopa! Ai grijă, am laptopul în rucsac.” (Whoa! Careful, my laptop's in the bag.) · „Nicio problemă, se întâmplă.” (No problem, it happens.) · „Ușor, că am stand-up în cinci minute.” (Easy, I have stand-up in five minutes.)
- *photographed*: „Pentru LinkedIn? Stai să zâmbesc.” (For LinkedIn? Let me smile.) · „Prinde și Europe House în cadru.” (Get Europe House in the frame.) · „Gata, am ieșit cu ochii închiși, mai una.” (I blinked, one more.)
- *idle*: „Iar e deploy vineri seara...” (Another Friday-evening deploy...) · „Luăm un Ted's de pe Vasile Alecsandri?” (Grab a Ted's on Vasile Alecsandri?) · „Am ședință cu clientul din State la 17.” (Call with the US client at 5 pm.)
- *district*: „Pe Lascăr Catargiu faci un sfert de oră de la Romană la Victoriei.” (On Lascăr Catargiu it takes a quarter of an hour from Romană to Victoriei.) · „Vasile Alecsandri e cu sens unic, intri din Grigore Alexandrescu.” (Vasile Alecsandri is one-way, enter from Grigore Alexandrescu.) · „La Landmark e UiPath, la etajele cinci și șase.” (UiPath is in The Landmark, floors five and six.) · „Europe House a fost printre primele clădiri de sticlă din București.” (Europe House was one of Bucharest's first glass office buildings.) · „Statuia lui Lascăr Catargiu au repus-o în 2011.” (They put the Lascăr Catargiu statue back in 2011.)

### Jandarm at Palatul Victoria (`gendarme`, staff, lang ro, 25-45) — 17 lines
Gendarme on duty by the barriers in front of the Government building; polite, brief, firm.

- *greeting*: „Bună ziua.” (Good day.) · „Bună ziua, vă pot ajuta?” (Good day, can I help you?) · „Circulați, vă rog.” (Move along, please.)
- *bumped*: „Atenție, domnule!” (Careful, sir!) · „Păstrați distanța de gard, vă rog.” (Please keep away from the fence.) · „Mai ușor, vă rog.” (Easy, please.)
- *photographed*: „Fără poze cu mine, vă rog.” (No photos of me, please.) · „Fotografiați clădirea, nu personalul.” (Photograph the building, not the staff.) · „E în regulă, dar nu blocați trecerea.” (That's fine, but don't block the way.)
- *idle*: „Liniște azi în piață.” (Quiet in the square today.) · „Schimbul vine la opt.” (The shift changes at eight.) · „Iar plouă...” (Raining again...)
- *district*: „Aici e sediul Guvernului.” (This is the seat of the Government.) · „Intrarea publicului e pe partea laterală.” (Public entrance is at the side.) · „Nu parcați pe trotuar în fața Palatului.” (No parking on the sidewalk in front of the Palace.) · „Trecerea de pietoni e la semafor.” (The crossing is at the lights.) · „Muzeul Antipa e vizavi, peste Kiseleff.” (The Antipa museum is across Kiseleff.)

### Doamna Mariana (florist kiosk) (`flower_vendor`, vendor, lang ro, 45-65) — 16 lines
Runs a small flower kiosk near Piața Romană; friendly, calls everyone "dragă".

- *greeting*: „Bună ziua, dragă! Flori proaspete!” (Good day, dear! Fresh flowers!) · „Trandafiri, lalele, ce doriți?” (Roses, tulips, what would you like?) · „Bună seara, mai am buchete gata făcute.” (Good evening, I still have ready-made bouquets.)
- *bumped*: „Vai, florile mele!” (Oh, my flowers!) · „Ai grijă la găleți, dragă!” (Mind the buckets, dear!) · „Nu-i nimic, nu s-a rupt nimic.” (It's nothing, nothing broke.)
- *photographed*: „Fă-le poză la flori, nu mie!” (Take a picture of the flowers, not me!) · „Stai să pun bujorii în față.” (Let me put the peonies in front.) · „Frumoasă poză, să mai veniți!” (Nice picture, come again!)
- *idle*: „Azi s-au vândut lalelele repede.” (The tulips sold fast today.) · „De 8 Martie nu mai am loc de clienți.” (On 8 March I can't fit the customers.) · „Florile de la Piața Amzei sunt mai scumpe.” (Flowers at Piața Amzei are pricier.)
- *district*: „Studenții de la ASE iau câte un trandafir la examene.” (ASE students buy a single rose before exams.) · „Mașinile claxonează toată ziua aici.” (Cars honk here all day.) · „Metroul e chiar la colț, pe Magheru.” (The metro is right on the corner, on Magheru.) · „Iarna vând și mărțișoare.” (In late winter I sell mărțișor charms too.)

Culture notes:

- **Register** — "Bună ziua" with strangers, "Salut/Neața" among young people; "dumneavoastră" (formal you) to older people; "Mersi" is as common as "Mulțumesc". (https://en.wikivoyage.org/wiki/Romanian_phrasebook)
- **Traffic temper** — Bucharest drivers honk readily and often do not stop at zebras; pedestrians answer with sarcasm rather than aggression — keep lines teasing, not violent. (https://en.wikivoyage.org/wiki/Bucharest#Stay_safe)
- **Sidewalk parking** — Cars parked on sidewalks are a constant pedestrian complaint; a natural topic for bumped/idle lines in side streets. (https://en.wikivoyage.org/wiki/Bucharest#Get_around)
- **Taxis at the airport** — At OTP passengers order licensed taxis from touch-screen kiosks in Arrivals; unsolicited offers are a known nuisance — staff lines should point to the kiosks. (https://www.inyourpocket.com/bucharest/The-Definitive-Guide-to-Finding-a-Taxi-at-Bucharest-Airport_74243f)
- **No stereotypes** — Personas are defined by role/place (student, vendor, commuter), never by ethnicity; Roma, Moldovan or diaspora characters are not caricatured; humour targets traffic, weather, parking and the metro. (spec 20 (game/research) requirement)
- **Shared library** — Generic personas (local_elder, tour_guide …) and the pedestrian_general set (honked_at, near_miss, sidewalk_parking) live in bucharest-spots.json → dialogue_general; district personas below add place-specific lines. (game/research/bucharest-spots.json)

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
4. Piața Victoriei is a huge oval gyratory with 6 arms, central lawns and an underpass (Pasajul Victoria) beneath. OSM (2026-11-12): two one-way road tunnels (w669751868 / w241374325 westbound, w669751870 / w669751871 / w241374324 eastbound) with the two tram tracks between them (w241374326, w920117619), all tagged tunnel=yes over the same extent, portal to portal; the west ramps (w241374320 up, w27008418 down) reach Șos. Nicolae Titulescu about 190 m west of the west portal. The driveway under Palatul Victoria (w1516934660, tunnel=yes layer=-1) runs under a building part with min_height=7: a street-level passage, not a dug tunnel.
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
19. Coca-Cola red rooftop sign on the curved block at Piața Romană 9; NetBet rooftop sign at Lascăr Catargiu 2-4; mesh banners on Magheru (photos 2023).
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

- Rooftop brands at Piața Victoriei not photo-verified (Romană + Lascăr Catargiu verified from 2023 photos; brands rotate)
- Exact lamp/luminaire model per street
- Facade hex for unnamed buildings is style-rule based
- Europe House storey count conflict (OSM 14 vs listing GF+10)

## Reference images (`refs/romana/`, 32 files, licences in LICENSES.md)

| file | taken | near | licence | facade-texture candidate |
|---|---|---|---|---|
| 24_Bulevardul_Gheorghe_Magheru_Bucharest_02_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 26_Bulevardul_Gheorghe_Magheru_Bucharest_01_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 26_Bulevardul_Gheorghe_Magheru_Bucharest_02_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 24_Bulevardul_Gheorghe_Magheru_Bucharest_03_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 54_Bulevardul_Lasc_r_Catargiu.jpg | 2023-04-22 | Europe House / Lascăr Catargiu north | CC BY 4.0 | yes |
| 14_Bulevardul_Gheorghe_Magheru_Bucharest_04_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 14_Bulevardul_Gheorghe_Magheru_Bucharest_02_.jpg | 2023-03-24 | Bd. Magheru north | CC BY-SA 4.0 | yes |
| 9_Bulevardul_Gheorghe_Magheru_Bucharest_02_.jpg | 2023-04-30 | Bd. Magheru north | CC0 | yes |
| 48_Calea_Doroban_ilor_Bucharest_15_.jpg | 2023-04-19 | Calea Dorobanților south | CC0 | yes |
| 4_Bulevardul_Lasc_r_Catargiu_Bucharest_03_.jpg | 2023-04-30 | Piața Romană | CC0 | yes |
| 64_Calea_Doroban_ilor_Bucharest_01_.jpg | 2022-06-21 | Calea Dorobanților south | CC BY-SA 4.0 | yes |
| 6_Bulevardul_Lasc_r_Catargiu_Bucharest_15_.jpg | 2023-04-30 | Piața Romană | CC0 | yes |
| 8_Strada_Tache_Ionescu_Bucharest_01_.jpg | 2023-05-02 | Bd. Magheru north | CC0 | yes |
| 9_Pia_a_Roman_Bucharest_06_.jpg | 2023-04-30 | Piața Romană | CC0 | yes |
| 9_Strada_Gherghe_Manu_Bucharest_11_.jpg | 2023-05-30 | Bd. Lascăr Catargiu (middle) | CC0 | yes |
| 9_Strada_Gherghe_Manu_Bucharest_12_.jpg | 2023-05-30 | Bd. Lascăr Catargiu (middle) | CC0 | yes |
| 9_Pia_a_Roman_Bucharest_05_.jpg | 2023-04-30 | Piața Romană | CC0 | yes |
| 151_Calea_Victoriei_Bucharest_02_.jpg | 2022-09-24 | Europe House / Lascăr Catargiu north | CC BY-SA 4.0 | yes |
| 151_Calea_Victoriei_Bucharest_01_.jpg | 2022-02-25 | Europe House / Lascăr Catargiu north | CC BY-SA 4.0 | yes |
| 5_Pia_a_Roman_Bucharest_58_.jpg | 2023-04-30 | Piața Romană | CC0 | yes |
| 8A_Bulevardul_Aviatorilor_Bucharest_26_.jpg | 2023-05-30 | Palatul Victoria | CC0 | yes |
| 10_Strada_Paris_Bucharest_02_.jpg | 2023-06-03 | Palatul Victoria | CC0 | yes |
| 35_Strada_Grigore_Alexandrescu_Bucharest_01_.jpg | 2022-09-22 | Bd. Iancu de Hunedoara | CC BY-SA 4.0 | yes |
| 30_Bulevardul_Lasc_r_Catargiu_Bucharest_Romania_2.jpg | Taken on 1 | Bd. Lascăr Catargiu (middle) | CC BY-SA 4.0 |  |
| 30_Bulevardul_Lasc_r_Catargiu_Bucharest_Romania_.jpg | 2020-05-17 | Bd. Lascăr Catargiu (middle) | CC BY-SA 4.0 |  |
| 20230426.Ansichten_von_Bukarest.-023.jpg | 2023-04-26 | Palatul Victoria | CC BY-SA 4.0 |  |
| Grigore_Antipa_Natural_History_Museum_11.jpg | Taken on 2 | Antipa museum / Kiseleff | CC BY-SA 4.0 |  |
| Grigore_Antipa_Natural_History_Museum.jpg | Taken on 2 | Antipa museum / Kiseleff | CC BY-SA 4.0 |  |
| Nicu_or_Dan_campaign_rally_in_Bucharest_May_11_2025.jpg | 2025-05-11 | Palatul Victoria | CC BY 2.0 |  |
| Grigore_Antipa_Natural_History_Museum_8.jpg | Taken on 2 | Antipa museum / Kiseleff | CC BY-SA 4.0 |  |
| Mavrogheni_Church_51.jpg | 2021-12-23 | Antipa museum / Kiseleff | CC0 |  |
| Carmina_Cotfas_16_decembrie_2021.jpg | 2021-12-16 | Calea Dorobanților south | CC BY-SA 4.0 |  |

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
| ref_romana9 | https://commons.wikimedia.org/wiki/File:9_Pia%C8%9Ba_Roman%C4%83,_Bucharest_(05).jpg |
| ref_lascar4 | https://commons.wikimedia.org/wiki/File:4_Bulevardul_Lasc%C4%83r_Catargiu,_Bucharest_(03).jpg |
| ref_magheru14 | https://commons.wikimedia.org/wiki/File:14_Bulevardul_Gheorghe_Magheru,_Bucharest_(04).jpg |

## Fidelity pass 2026-11-12 (live OSM + Street View review)

Sources: OSM API 0.6 `map` tiles for 44.4385,26.0803 – 44.4584,26.1031 fetched 2026-11-12 (48 672 nodes, 6 390 ways,
287 relations); Street View looked at only for comparison (no imagery stored). Game views: `game/dev/reality/viewpoints.json`
(40 `rom-*` viewpoints). Playable area = the 130 m bands and circles of `cities.js`.

What the review established

- **Businesses.** 320 mapped businesses (shop / food / bank / hotel / office / craft / leisure / healthcare) lie inside the
  playable area, 316 of them named. 292 are in `data.pois` with the same name within 45 m; no game POI lacks a live OSM
  object (nothing stale). The 24 missing ones are kinds the builder's `poiKind()` does not keep: nightclub (Club XS
  n3118882252), `craft` (Miva Foto n2615818199), `leisure=adult_gaming_centre` (Win Boss n11618371471),
  `leisure=fitness_centre` (Sky Fitness Romana n9947523117), `tourism=gallery` (OB'ART n2872402339, FormART n12318228499,
  Galeria SIMEZA n12318285854, Galeria Romană n6513765648), kindergartens (n2558783253, w1059582478), offices of kinds
  outside the kept list (Electrica w180563617, notary n13120820695, travel agent n5526244073, lawyer n12318280957,
  accountant n2665235676, consulting n9714060730, association n2457790509, political party n12044737494, research
  n9913919522), physiotherapist n2839154414, apartment n12906263752, pub Sexy Smash n11795229276 (on the area edge), plus
  two that exist under another record (hospital w23611366 is present 45 m from the way centroid; Sala de Sport ASE
  w783025569 is the building's own sign).
- **Pasajul Victoria** (OSM w241374324 / w241374325 / w669751868 / w669751870 / w669751871, tram w241374326 / w920117619,
  busway w1358411333, tram stop nodes n8544117694 / n8544117695 on level −1). In reality it is one hall: an outer wall on the
  outside of each carriageway and, on the tram side, a row of large rectangular piers with fences between them; the tram
  tracks and the underground tram stop are in the middle; sodium lighting. The east ramp trench on Bd. Iancu de Hunedoara has
  a stone-pier and iron-panel balustrade. The game draws three separate walled and roofed tubes (road, tram, road) with a
  plain concrete parapet: levels, ramps and portals agree, the pier rows, tram platforms and balustrade do not.
- **Antipa museum** (w23610985) has no OSM height or levels and was drawn 5.8 m tall; it is two tall storeys with a raised,
  pedimented central pavilion and an engaged-column porch on the Kiseleff front. Now a landmark model (`antipa`).
- **Statue of Lascăr Catargiu** (w800350070) and **Fântâna Arteziană Arthur Verona** (w1183885625, a low round basin) were
  absent; both are now landmark models (`catargiu`, `veronafountain`). The statue's proportions are estimates; it was not
  seen in Street View (only user photospheres with unreliable headings exist at that spot).
- **Blocul ARO / Patria** (w163622261): about eight ribbon-window storeys, a taller slim tower at the north end, shops under
  a canopy. The existing `aro` landmark model has the bands but no shopfronts and drops the ground-floor business signs, so
  it stays out of the district list; the generic building keeps the signs.
- Not modelled although mapped and visible: Monumentul Infanteriei Române (n987467409), George Enescu statue (w1171605516),
  Nobil Dac (w1170480716), the Urseanu observatory dome (w79139872, drawn as a flat 6.4 m house), Muzeul Țăranului Român
  (r2552618: generic block with a shopfront ground floor, signed "Cinema Muzeul Țăranului"), Muzeul Național Geologic
  (w23611090), Casa Filipescu-Cesianu (w131269864), the three covered ASE footbridges (w783025570, w783025571, w942676266).
- Agree with OSM: the four building passages on the service ways (w672096997, w1458318537, w1575956753, w229193339), the
  service tunnel w1516934660, the Kiseleff fountains n7894980887 / n4405655095 and pond w1092796819, Piscina Lido
  (w810540711), the tartan pitch w916708228, the metro entrance POIs.

## Fidelity pass round 2, 2026-11-12 (Magheru, Piața Romană, Calea Victoriei, Lascăr Catargiu, Dorobanți side, Piața Victoriei, Kiseleff)

Sources: the live OSM extract of 2026-11-12 used in round 1 (100 mapped hotels, banks, museums, churches, fountains, statues, structures, pools and pitches in the playable area; 81 are game POIs by name); official panoramas looked at for appearance only (nothing stored). Game views: `viewpoints.json` (`rom-*`, 27 added). Pose ids below are viewpoint ids.

What was looked at, with a verdict

- **Bd. Magheru.** `rom-magheru-scala`, `rom-magheru-mcd`, `rom-balcescu-bcr`: tree-lined six-lane boulevard, white modernist blocks of 8 – 10 storeys with shops at the ground floor; the game matches in massing, signs come from POIs. Match (generic facades). `rom-magheru-patria`: the ARO / Patria block is a grey-beige ribbon-window slab with its tower at the north end; the game has a white ribbon-window block without the tower (romana-3 stays open). `rom-magheru-ambasador`: the real front is pale stone with dark red-brown window bays; the landmark model has blue windows on white: still wrong (lane landmarks). `rom-magheru-lido`: Hotel Lido (w162494340) is a cream-white interwar hotel with a bronze entrance canopy; it was drawn saturated blue from a default hotel colour: fixed (cream). Banks First Bank n4549374244, UniCredit n4549374245 / n3118870194, Libra n4549374248, BCR n5519217930, BRD n3734652403, BCR n5602922763: present as POIs on the right blocks; fascias not compared one by one.
- **Piața Romană.** `rom-romana-ase`: ASE palace with its dome and lettering matches (landmark); beside it reality has the copper-glass new wing, a white eclectic house and a yellow four-storey eclectic building where the game has a beige eight-storey block: generic, not corrected. `rom-romana-south`: the large corner block with roof advertising matches in massing. Match.
- **Dorobanți side.** Calea Dorobanților itself is scenery (not drivable). `rom-dorobanti-sheraton`: grey stone-clad podium with Pizza Hut at the ground floor and a cylindrical glazed corner; the game has a grey block; the building was signed "Pizza Hut" only: fixed, it now carries "Sheraton" and keeps the tenant sign. The cylinder is not modelled.
- **Bd. Lascăr Catargiu.** `rom-catargiu-mid-nw`, `rom-catargiu-mid-se`: two carriageways, grassed and tree-planted median, mature trees hiding two- to five-storey houses; the game has the median, smaller trees and taller generic fronts on the north side. Match in layout; heights generic. `rom-severeanu`: Colecția Severeanu (w231445058) is a yellow one-storey eclectic house: fixed (yellow). `rom-coanda-michelangelo`: eclectic two- and three-storey houses with rusticated bases; game: cream block and a seven-storey grey block behind: not corrected (identity of the footprints not established). `rom-nobil-dac`: statue on a tall plinth in the small square: absent in the game (lane world).
- **Calea Victoriei / Piața Victoriei.** `rom-victoriei-south`: curved nine-storey stone block with roof advertising, BCR n1563503947 (blue fascia), Intesa n2502640586 and Mega Image n2613331337 at the ground floor, a small park in front: the game's curved block matches in massing; roof advertising absent. `rom-victoriei-palat`: the square is one asphalt expanse in front of Palatul Victoria; the game fills the centre with lawn: still wrong (lane world). `rom-hunedoara-cec`: blue curtain-wall office with CEC Bank n3757940564: match. `rom-hunedoara-east`: long eight-storey block north side, curved glass office south side: match. `rom-bariera`: small park with trees at the Bariera Mogoșoaiei marker n13849319703; the marker itself is visible in neither. `rom-cv-banks` / `rom-cv-south`: only a user photosphere lies within 25 m of this point; not compared.
- **More Magheru / side-street poses.** `rom-scala-hotel`: Scala Boutique Hotel (w163622247) is a cream three-storey house with green awnings; the game has a cream three-storey house with its sign: match. `rom-magheru-banks`: small park with trees and benches in front of the blocks: match. `rom-magheru-unicredit`: UniCredit at the ground floor, terrace, spherical bollards: match (sign present, bollards are posts). `rom-magheru-libra`: white streamlined block with Libra Bank: match in massing. `rom-buzesti`: the ground floor of the curved block is a row of shopfronts (a burger restaurant, a pharmacy, Starbucks) behind a parking strip; the game shows signs on a wall with ordinary windows, no glazed shop floor: still wrong (small). `rom-titulescu-west`: at 44.452076, 26.082576 the panorama is already inside the walled west descent of Pasajul Victoria (retaining walls with stone-pier and iron-panel balustrades, fenced tram reservation to the north); the game is at street level there with a planted median: check the ramp start against w241374320 (lane world). `rom-duke`, `rom-romana-bcr`, `rom-unique`, `rom-storck` poses are too close to the walls for a judgement of the named building.
- **Kiseleff.** `rom-kiseleff-mtr`: Muzeul Țăranului Român (r2552618) is red brick behind large trees; it was beige with a glazed shop ground floor: fixed (red, no shopfront; height unchanged). `rom-kiseleff-geologic`: three storeys under a red tiled roof behind trees: match. `rom-mavrogheni`, `rom-khayyam`: church and statue not visible from the panoramas found; not compared.
- **Churches and the synagogue.** `rom-sinagoga`, `rom-visarion`, `rom-boteanu`: all three are drawn with house windows on four floors under a pyramid roof (the `church` style uses the eclectic window tile); the real buildings are a two-storey synagogue front with a tracery window, a church with a round banded porch tower, and an ochre neo-Romanian church with an arcaded porch: still wrong, a class defect (lane world). A Stanleybet shop stands beside the synagogue in the panorama; OSM has Stanleybet only at n11361411581 (44.44393, 26.09433), so it is not shown.
- **Storck museum** (n2634651933): dark red house; the POI is a bare node without a footprint link, so the cream building with a shopfront there was not changed (lane builder).

Fixes are rows in `game/src/building-review.js` (`bucharest-romana`), mirrored in `buildings[].research` of `bucharest-romana.json`: w162494340 colour, r2552618 colour and no shopfront, w231445058 colour and style, w29819032 sign.

Not checked: Pasajul Victoria (round 1), interiors, side streets beyond the poses listed, Piscina Lido, Hotel Minerva, SNSPA, the Storck and Joja houses beyond the note above, night views.

## Landmarks, round 2 (2026-11-12, lane landmarks)

- Royal Palace (`regal`, OSM w232472401 + 263 parts, parts tagged `building:colour=#eee8aa`): the district model used the
  mapped colour name and read olive. Panorama at Piața Revoluției (44.43972, 26.0971644, heading 245, 2024): warm cream
  limestone, arched ground-floor windows, tall first-floor and lower second-floor windows, engaged columns. The model
  takes the walk scene's #e1d6bc (documented exception to the mapped colour) and one window per wall panel on three storeys.
- Hotel Ambasador (w442813528, no height / levels tags): window bays dark red-brown between pale piers (panorama
  44.441899, 26.098971 heading 75, reported by lane districts-view); the model had blue glass.
- OSM heights against the models (live tags 2026-11-12): TNB `height=24` = model body (fly towers above are modelled
  to 34 m); Europe House 14 levels / 56 m; The Landmark 7 levels / 29.4 m; Sky Tower 137; Victoria parts 20 / 23 / 30.

## Landmark catalogue review against panoramas (fidelity pass round 2b, lane landmarks-b, 2026-11-12)

Method: official panorama ids found from Maps coverage metadata (`photometa/ac`, coverage only), the game rendered at the
pano position and bearing (eye 2.5 m), then compared side by side by eye. No imagery kept. Poses: `viewpoints-add.json`
of this lane and the poses below. "Match" = shape class, height, roof, main materials/colours, entrance side and signage
read as the real thing at street distance; it is not a claim of parity. Table positions are rounded and some are
approximate; the exact poses with their pano ids are in this lane's `pick/*.json`, `views2b.json` and `views3.json`,
and the kept ones in `viewpoints-add.json`.

| Landmark | Pose (lat, lon, heading) | Verdict |
| --- | --- | --- |
| ase | 44.4472, 26.096476 h 39 | match (dome, colonnade, www.ase.ro lettering) |
| ambasador | 44.441899, 26.098971 h 81 | fixed: dark windows over muted red-brown aprons between pale piers (were red squares, before that blue) |
| aro | 44.442644, 26.098615 h 110 | fixed: grey-beige ribbon-window slab, pale tower at the NORTH end (was white, tower at the south end, not in the district list); PATRIA marquee removed (not seen on the boulevard front) |
| thelandmark | 44.450288, 26.094312 h 143 | fixed: stone grid with windows on every storey, glazed ground floor, set-back glass top storey (was a blank stone block) |
| europehouse | 44.4508, 26.0882 h 315 / 44.4511, 26.0869 h 87 | partial: long glass slab right; real glass is a lighter blue, the end at Lascăr Catargiu is a curved grey-banded volume, not a charcoal wedge (open) |
| antipa | 44.453011, 26.085294 h 280 | not compared: facade hidden by trees in reality; the game shows it over open lawn (tree belt missing, world scope) |
| catargiu | 44.449226, 26.092807 h 146 | fixed: standing bronze figure in a long coat + smaller figure against the pedestal (was cylinder/box/ball) |
| veronafountain | 44.442772, 26.09817 h 265 | match (low round stone rim on paving) |
| ateneu | 44.441005, 26.098035 h 305 | not compared (no pose with a clear view found) |
| tnb | 44.4365, 26.1054 h 75 | match (red hat roof, glazed front) |
| regal, victoria | — | compared in round 2 (lane landmarks) |

Statues (hand models, silhouettes only, sizes estimated): Lascăr Catargiu (w800350070), Nobil Dac (w1170480716, marble, cloaked standing figure on a square plinth), George Enescu (w1171605516, seated bronze on two granite steps). Not modelled: Monumentul Infanteriei n987467409 (not in a chapter district).

## Round 2 (2026-11-12), lane world

Monuments: 18 generic class objects placed (Alexandru Lahovary on the Piața Lahovari island:
compared with the panorama at 44.44553, 26.09976, a figure on a plinth in the planted island, class matches; Mihai
Eminescu, George Enescu, Nobil Dac, Carol I at its OSM height of 13 m, Monumentul Infanteriei as a stele, busts).
Lascăr Catargiu is the landmark's. No bridges, fuel stations or mapped car-park buildings in the district.

## Round 2 (2026-11-12), lane world-b

Street View was used only to look (official panoramas, ids found from coverage metadata); nothing was saved or traced.

Piața Victoriei: the panorama at the centre (44.452163, 26.085980) shows asphalt in every
direction; the green came from the aerial green raster (no OSM polygon). A reviewed paved ring (ground-review.js) keeps
the raster grass out of the square. Pasajul Victoria west ramp: the panorama at 44.452076, 26.082576 is inside the walled
descent; the eastbound ramp w27008418 now descends at half the model grade (grade-review.js), about 60 m earlier.
Places of worship (Sinagoga Eșua Tova, Boteanu, Visarion): plain walls with tall arched openings now (worship.js).

## Round 3, lane builder (2026-11-13)

Sources: live OSM (API 0.6 / Overpass, 2026-11-12/13; the round-2 map.json tiles of each district for the cached-source
tools), official Street View panoramas looked at for appearance only (nothing stored, nothing extracted into data).

Hotel Michelangelo n2942500701 is now linked to w437256698 (4.8 m from the node; next footprint 7.8 m): panorama
tj5o-VAsm5bhIxSueHjLCQ looking WSW shows a cream eclectic house with flags at its gate there. Colecția Vasile Pârvan
n2634652176 → w678558174 (2.3 m). Storck n2634651933 is tagged `tourism=artwork`: not linked (see backlog r3-builder-3).
Hotel Minerva w171045151 (pano 0IR_4oFjbwg7c8euMfNEkw, Str. Gen. Gheorghe Manu): plastered grey-beige walls with white
window surrounds and stained-glass ground-floor windows; the "glass curtain wall" palette estimate #5e7f8c is cleared;
OSM `building=retail` still gives it the glazed 'shop' style (r3-builder-5).

## Round 3 (2026-11-13), lane structures

Official Street View panoramas were looked at only (ids from coverage metadata); nothing was saved, traced or measured from them.

ASE covered footbridges w783025570 / w783025571 / w942676266 (`bridge=covered`, layer 1): concrete deck
with a cream solid parapet band and a glazed pitched canopy on light steel frames, about one storey above the street (44.447532,
26.097783 h160 looking up): drawn (pedestrian-bridges.js 'covered-glass'; width 3.2 m and soffit 5.2 m are estimates; the two
shorter ways were not seen on their own). Pasajul Victoria east ramp (44.452073, 26.088653 h91): square light stone piers with dark
iron balustrade panels; the open approaches of Pasajul Victoria now draw that class instead of the plain parapet
(trench-parapets.js; pier spacing / heights estimated, the panels' cast ornament drawn as bars).

## Round 3 street-level review, lane look (2026-11-13)

- **Signs** (r2-districts-view-11): Victoria Center w173938539 now carries its own name board; its corner unit really is a Starbucks
  (dark fascia, white STARBUCKS COFFEE letters, GKPZybRO6HC9NrDEiel-DA h240), so the Starbucks unit board is right. Casa Gheorghe
  Petrașcu w171045146 now carries its own name instead of "Viggo"; Viggo (n5602930826, shop=clothes, check_date 2026-06-15) is still
  in live OSM on that footprint, so its unit stays. The street front seen from Yv9RTMCoVSMxEoPO0dOE7g h245 is beige ornamented stone
  with barred windows (the game draws white walls and a glazed shop front); not changed, because the Viggo unit is mapped there.
- **Churches** (r2-world-b-church-likeness; rows in building-review-look.js): Boteanu-Ienii w179319626 warm ochre / sand plaster with
  an arcaded porch (SjOI2XLkhdK5Ic0qM-OaLQ h71); Crețulescu w1476760553 exposed red brick over a stone plinth (q4sm16NZ5g9nzAl59Pleug
  h140); Amzei w76915020 cream stone banded with red brick, one warm tone (8to4VNCB5GgzGL5IUsc2oA h162). Biserica Albă w78467985 and
  Icoanei w76920898 are white and match the class colour. Towers / domes unchanged (only where OSM tags them).
- **Statue n3495777662** (tourism=artwork, no artwork_type, 44.44385, 26.100948): a pale stone standing figure on a plinth in a small
  fenced garden (MEOXvDv_jIyjjHmsQMop0g h95): now drawn with the generic `statue` class, stone.
- **White Creature** n3236859765 (Calea Griviței 37): wall art on a building front (R_ibENhyicLAd8a1JxM1ug h187): not drawn.

## Fidelity pass round 3 — landmarks lane (2026-11-13)

Official panoramas viewed only (no imagery kept); live OSM fetched 2026-11-13.

- **Observatorul Astronomic „Amiral Vasile Urseanu”** (w79139872 building=civic, man_made=observatory; pano 44.448503,
  26.093125 h 275): a cream three-storey villa with rounded corner bays and iron balconies; the roof over the round east
  tower is blurred on the panorama. The round tower is OSM w1220336122 (`building:part=yes`, no height), which the data drew
  as a 25.6 m default cylinder in front of a 6.4 m two-storey box. Review row: villa 13 m / 3 storeys, cream eclectic.
  New landmark `urseanudome` replaces the part only (sourceIds w1220336122): the exact mapped round outline as a 13.5 m cream
  tower with windows and two dark balcony bands, and a grey hemispherical observatory dome (r 2.6 m, rise 2.4 m) on it —
  tower height, dome form, size and finish are estimates (the panorama blurs the roof; the dome itself is documented by the
  observatory's OSM tags and Wikipedia).
- **Casa Filipescu-Cesianu** (w131269864, building:levels=2, roof:shape=quadruple_saltbox; pano 44.450278, 26.087635 h 262):
  cream two-storey eclectic palace under a dark slate mansard with oval dormers. Review row: eclectic, cream walls, dark slate
  roof colour. OSM storeys and roof shape kept; the mansard form is not modelled by the roof profile.
- **Europe House** (pano 44.450804, 26.088191 h 315): the glass is lighter blue; the south-east end is a rounded volume of
  grey bands between ribbon windows. Model: lighter glass, grey-banded end volume (still square), band pitch estimated.
- **Hotel Ambasador** (pano 44.441899, 26.098971 h 75): pale stone front, dark windows over red-brown aprons, two raised
  wings — the round-2 model already matches; no change.
- **Statuia Lascăr Catargiu** (pano 44.448932, 26.093057 h 331): the panorama shows an open island and the figure clear
  against the buildings. In the game an aerial-measured crown (`kind: osm`, no OSM tree node within 20 m) stands 11 m
  south-east of the statue (≈ 44.449049, 26.093009), on the island, and hides the figure. Not changed here (tree data is
  the builder / world lane's; it is a physical-exclusion question, not a landmark one).
- **Storck collection** (n2634651933, tourism=artwork, Str. Vasile Alecsandri 16): the node lies in no building outline
  (Overpass 2026-11-13); the nearest footprints are w546500238 (11 m), w546500256 (16 m) and w546500250 (31 m). From pano
  44.450834, 26.094312 h 60 the red-brick gabled house and a cream one-storey house both stand there; which outline is the
  museum is not settled, so nothing is changed.

## Round 4, backlog clearance (2026-11-13)

Sources: live OSM, the official panorama poses recorded in the backlog rows (looked at only, nothing stored), the cited pages.

- **Statuia Lascăr Catargiu** (r3-landmarks-4): the aerial-measured crown about 11 m south-east of the statue (no OSM tree node)
  stood on the paved island that the official panorama at 44.448932, 26.093057 h 331 shows open; it hid the figure. It is now a
  reviewed physical exclusion (`game/src/tree-reviews.js`); the source record stays in the pack.
- **Casa Filipescu-Cesianu** w131269864 (r3-landmarks-3): OSM `roof:shape=quadruple_saltbox` is not a shape the roof builder
  draws (it fell back to a plain hipped roof); the building-review row now draws it as a mansard (`roofShape`) with oval dormers
  (`game/src/reviewed-dormers.js`: one per 3.6 m along each face, size and set-back estimates). The OSM tag stays in the profile.
- **Casa Gheorghe Petrașcu** w171045146 (r3-look-12): Viggo n5602930826 lies 4.4 m inside the south-west face (8 m from the west
  face), not at the east front seen from Yv9RTMCoVSMxEoPO0dOE7g h 245. The front is now beige ornamented stone with a window grid;
  the Viggo shop front stays only on the south-west face (`shopFaceAt` in the review row).
- **Storck collection** (r3-landmarks-7): the museum is the house of 1912–13 by Alexandru Clavel, described as Anglo-Norman
  neo-Gothic (Muzeul Bucureștiului, cimec ghidul muzeelor); Wikipedia's coordinates (44.4509722, 26.0944917) lie 12 m from
  w546500256, the red-brick gabled house, and 19 / 25 m from w546500238 / w546500250. w546500256 is now a red-brick two-storey
  gabled house without a shop floor, w546500238 the cream one-storey house (storeys from pano 44.450834, 26.094312 h 60; heights
  9 m / 4.5 m are estimates). OSM still tags the museum node `tourism=artwork` in no outline: a tagging fix for OSM
  (tourism=museum on w546500256), not made here.
- **Muzeul Țăranului Român** r2552618 (r2-districts-view-10): two tall storeys under a steep red tile roof (6 m rise inside the
  unchanged 19.6 m total), red brick, no shop floor.
- **Pasajul Victoria hall** (romana-1): the shared hall now has the steel fence between the piers along the road edge of the
  platform, benches and a stop pole on the platform only where the hall holds a mapped tram stop (the four `Piața Victoriei`
  tram_stop nodes, x ≈ -376 … -329), and dark lamp housings with orange (sodium) lenses every 9 m under the soffit
  (`game/src/hall-furniture.js`; 139 posts, 20 benches, 103 lamps at HEAD). Render checked inside the hall.
- **Royal Palace / Carol I** (r2-landmarks-3): the court front of the central body carries paired giant columns on pedestals,
  a dentilled cornice and the attic balustrade (landmarks.js `bRegal`); the Carol I statue n1883108499 is drawn with a new
  `equestrian` monument class (horse and rider on a tall plinth, OSM height 13 m kept). Its form comes from the node's own tags
  (wikipedia=en:Equestrian statue of Carol I, artist Florin Codre, 2010).
- **Pasajul Victoria flicker / overlap** (r2-perf-2), re-measured at HEAD with a two-render 2 mm camera shift: at the four
  underpass points (-506.8, -413.3), (-386.8, -413.7), (-267.8, -424.7) and (-701.6, -417.2) the changing pixels are moving
  vehicles and road-texture shimmer; no coplanar pair (second hit within 5 cm) except the markings over the road (3 cm, by
  design). The Titulescu overlap points (-629.4, -434.8) / (-606.7, -435.5) render without a visible step from street level
  and above. The 6.8 m² overlap of a building outline with service edge 1193 at (-642.1, -470.5) is a source-data overlap
  (both mapped), kept as mapped.

### Estimates

- **Monumentul Infanteriei Române** (n987467409, romana-11): a bronze work by Ioan Bolborea, unveiled 27 April 2000 on the site of
  the interwar infantry monument (ro.wikipedia "Parcul Kiseleff", citing Formula AS "Coloana lui Bolborea": a column). Its form
  and height are not visible from any official panorama on Șos. Kiseleff (hidden by trees) and no source gives dimensions, so it
  stays the generic bronze `stele` class of `monument-sources.js` (an upright column-like mass), size from the class.
- **Muzeul Țăranului Român**: the total height (19.6 m, a re-estimate) and the 6 m roof rise are not measurable from the street
  (the museum stands behind the Kiseleff tree belt); the entrance tower has no OSM `building:part` and no sourced height, so it is
  not drawn.
- **Pasajul Victoria hall**: platform and pier sizes, fence height (1.1 m), post / bench / lamp spacing and the lamp colour are
  estimates (`HALL_FURNITURE_MODEL.estimates`); no OSM object maps them.
- **Pasajul Victoria rim balustrade** (`trench-parapets.js`): the class comes from the east-ramp panorama and is applied to
  every open approach of the way; the west ramp has not been compared at its own pose, pier spacing and heights are estimates,
  and the cast panel ornament is simplified to bars.
- **Pasajul Victoria ramp grades** (`grade-review.js`): the eastbound west ramp w27008418 descends at half the model grade
  (walls seen 115 m before the portal); the westbound exit ramp w241374320 keeps the model grade (9 %, about 67 m): it was not
  seen from its own carriageway, and a longer ramp would pass at full depth under the at-grade crossing of the same way in the
  data, so its real start stays an estimate.
- **Royal Palace front**: column radius, pair spacing (one pair per two 4.2 m bays), cornice depth, dentil and baluster pitch
  are estimates; the equestrian Carol I is massing only (plinth / group split of the 13 m OSM height estimated).

## Backlog clearing (2026-11-13)

- **Not seen from any street panorama** (backlog r2-districts-view-15): Piscina Lido (w810540711), Mavrogheni church
  (w78841431), SNSPA (w23647615), Casa Henri Coandă (w256051276). Drawn from OSM outlines and classes; their look is the class
  estimate. Hotel Minerva (w171045151) is covered by the review above.

## Backlog close-out, cross-district lane (2026-11-13)

- **Fountain basins** w1331108694 and w809629318 (add-areas.mjs) keep the generic 0.45 m light-stone coping and full water: no
  official panorama found within reach; the coping is an estimate.
- **Hotel Minerva** w171045151: review row (building-review.js) from pano 0IR_4oFjbwg7c8euMfNEkw: plastered grey-beige with
  white window surrounds instead of a glazed 'shop' block. OSM `building=retail`, `building:levels=8` and height kept.
- **Monuments**: Memorialul Renașterii (n1393030628) has a low-poly subject form (`monuments.js` `MONUMENT_SUBJECT`; the
  equestrian Carol I has its own `equestrian` class since round 4) (a white marble spire through a
  dark crown, about 25 m after ro.wikipedia; OSM has no height), but its node lies inside a mapped building outline, so the
  monument is skipped (reported, never moved) and the subject form shows only if that conflict is resolved in OSM.
- **antipa** (r2-landmarks-b-1): still not compared (facade hidden by trees in reality). The tree belt on Șos. Kiseleff in front of
  the museum is missing in the game: inferred trees are suppressed inside the aerial survey's coverage, so those crowns need
  measuring on the aerial mosaic (`tools/aerial`, as r3-look-8), never placing from a panorama.
- **Pedestrian streets and the green raster** (r3-look-14): top-down renders (round 3) show no lawn on the mapped pedestrian
  bands; plazas outside the 3.5 m band (around 44.4398, 26.0968) keep the aerial-measured green-ground raster. The raster is a
  measurement (`tools/aerial`); whether that ground is lawn or paving was not compared with a panorama.
- **Signals, queues and walkers** (h-sim): a car that has just left a signal controller's box is not held by the same
  controller's next signal head within 40 m (`traffic.js` `SAME_CONTROLLER_M`): at Piața Romană the cars queued inside the box
  kept every other phase red while the car in front of them waited at the square's Magheru exit head, and the square and
  Magheru locked for minutes. Signal timings remain conservative equal-slot simulation phases, not measured plans (Magheru's
  slot at the five-phase square is one fifth of the cycle). Walkers no longer creep along a carriageway on a corner leg that
  cuts it (Magheru at Jules Michelet / Tache Ionescu: the leg is walked as a crossing) and step back onto their line before
  turning round (Magheru at C. A. Rosetti).

## Estimates (structures, 2026-11-13)

- ASE covered footbridges (w783025570, w783025571, w942676266): width 3.2 m, soffit 5.2 m and the shallow-arch canopy (0.7 m rise) are estimates; only w783025570 was seen on a panorama.
- ASE footbridge w783025570: its east end lies in the ASE footprint the `ase` landmark replaces, but the model does not fill that corner, so the corridor ends open in the air there (a landmark-model gap; w783025571 / w942676266 now run on to their walls).
