# Bucharest — Unirii & Călărașilor (`unirii`): field research dossier

Role: research-buc-districts · generated 2026-11-06 22:18 UTC · machine-readable twin: `bucharest-unirii.json` · images: `refs/unirii/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Corneliu Coposu, Bulevardul Mircea Vodă, Bulevardul Unirii, Calea Călărașilor, Piața Unirii |
| route_streets_researched | Bulevardul Corneliu Coposu, Bulevardul Mircea Vodă, Bulevardul Unirii, Calea Călărașilor, Piața Unirii |
| fronting_route_buildings | 83 |
| fronting_route_with_height | 61.4 |
| fronting_route_with_colour | 6.0 |
| fronting_route_researched | 4.8 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 61.4 |
| fronting_route_with_facade_hex_any | 49.4 |
| fronting_main_buildings | 360 |
| fronting_main_with_height | 27.8 |
| buildings_total | 1801 |
| buildings_with_height | 28.9 |
| businesses_total | 540 |
| businesses_on_route | 45 |
| businesses_branded | 85 |
| trees_osm | 3003 |
| lamps_osm | 22 |
| crossings | 171 |
| signal_nodes | 42 |
| transit_stops | 41 |
| metro_entrances | 9 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.4238, 26.0995], [44.4238, 26.1135], [44.43, 26.1215], [44.4346, 26.1215], [44.4346, 26.11], [44.43, 26.0995]]` → bbox `[44.4238, 26.0995, 44.4346, 26.1215]`, area **1.667 km²**.
- Why: Hexagon ~1.3 km E-W: west edge just past Piața Unirii (Dâmbovița/Splaiul, Dealul Mitropoliei foot), south edge Bd. Unirii + one block (Str. Radu Vodă / Splaiul Unirii quiet), north edge one block past Calea Călărașilor (Str. Popa Soare/Mihăileanu, quiet), east edge Str. Traian + Hala Traian; cut corners (SE Văcărești, NW Lipscani) keep it ≈1.1 km².

## Chapter routes

### gts · 2015 — GTS Global Intelligence — Calea Călărașilor

- **Start**: START: Piața Unirii west side, southbound by the Dâmbovița (fountains on the left, Patriarchal hill ahead) — `44.426766, 26.100968`, heading 183° on Piața Unirii.
- **End**: Calea Călărașilor 101 (north side) — `44.433256, 26.117583`.
- **Length**: 2237 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Start on the west side of Piața Unirii by the Dâmbovița (Fântâna lui Bucur fountain field on the left, Dealul Mitropoliei ahead) → round the south side → Bd. Unirii east along the median fountain basins (Unirea Shopping Center on the left) → Bd. Mircea Vodă north → Calea Călărașilor east through the listed 1900s merchant-house row to no. 101 (Hala Traian 250 m further on).
- **Sequence**: Piața Unirii (421 m) → Bulevardul Unirii (633 m) → (secondary) (17 m) → Bulevardul Mircea Vodă (665 m) → Bulevardul Corneliu Coposu (32 m) → Calea Călărașilor (469 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.4268, "lon": 26.1009, "road": "Piața Unirii", "bearing": 180}, {"lat": 44.4266, "lon": 26.108, "road": "Bulevardul Unirii", "bearing": 90}, {"lat": 44.43, "lon": 26.1117, "road": "Mircea Vodă", "bearing": 0}, {"lat": 44.4327, "lon": 26.1135, "road": "Călărașilor", "bearing": 90}, {"lat": 44.43325, "lon": 26.11765, "road": "Călărașilor", "bearing": 90}]`

## CV stops (verified)

### gts — GTS Global Intelligence (Global Technical Systems group)

- **address**: Calea Călărașilor 101, Sector 3 (group address on job listings); trade-register seat of GTS Global Intelligence SA: Str. Frunzei 26, Sector 2
- **building_osm**: w245117704
- **lat**: 44.43349
- **lon**: 26.11763
- **door**: lat: 44.4333; lon: 26.11762; street: Calea Călărașilor; side: N side (odd numbers), eastbound kerb; note: about 240 m WEST of the Str. Traian junction / Hala Traian (no. 133); no. 101 is a listed (LMI B-II-m-B-18379) low merchant-era house — offices typically sit in the courtyard/behind; a 1936 6-storey block (no. 105, w245117686) stands two doors east
- **building**: osm_tags: building=apartments, 1 level, heritage=2 (LMI B-II-m-B-18379); facade: single-storey rendered street house with tall windows, cornice and a carriage gate, pastel render (#E3D3B8 est.) and grey/brown sheet roof; conf: address medium (job listing, group-level), building tags high (OSM), facade low [gts_job] [osm] [calarasi_200]
- **later**: GTS (Global Technical Systems) later moved to ~800 m² in Hermes Business Campus (Pipera) [gts_hermes].
- **cities_js_check**: cities.js gts {44.4302, 26.1178} is ~330 m SOUTH of Calea Călărașilor (it lands in the Vulturilor/Anton Pann blocks). Use {44.4333, 26.1176}. The doorAlong {m:45,bearing:270} from the Traian junction is too short: no. 101 is ~240 m west of Traian. Calea Călărașilor here is TWO-WAY 1+1.

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Bulevardul Unirii (chapter route)

- OSM: 10 ways, 2821 m in district, classes primary; lanes values ['2', '3', '4', '5']; one-way segments 10/10; maxspeed ['50', '60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 104, bus 116, bus 117, bus 123, bus 361, bus 385, trolleybus 73.
- OSM trees within 25 m: 697 (species {'Abies alba': 52, 'Tilia tomentosa': 123, 'Quercus robur': 200, 'Fraxinus americana': 128, 'Fraxinus excelsior': 9, 'Thuja orientalis': 56, 'Acer negundo': 7, 'Prunus cerasifera': 17, 'Tilia platyphyllos': 15, 'Quercus petraea': 20, 'Thuja occidentalis': 17, 'Platanus occidentalis': 4, 'Populus alba': 17, 'Sambucus nigra': 13, 'Ulmus minor': 11, 'Morus alba': 2}, genus {'Malus': 1}).
- OSM furniture: {'fountain': 84}.
- Fronting buildings: 20; businesses: 19.
- **cross_section**: Communist-era showpiece (1984–89, "Victoria Socialismului"), 92 m wide between facades: two one-way carriageways of 3 lanes each (60 km/h) either side of a wide central reservation holding the fountain basins in a long chain (east part continues to ~Bd. Mircea Vodă/Nerva Traian), lawns and linden rows; generous 8–10 m sidewalks with grey pavers, kerbside lindens; restaurant pavilions/terraces (Aici, Altfel, Jo Lounge, Naked Kitchen, Moon, The Clique) along the south side east of the square
- **frontage**: continuous 8–10-storey 1980s Civic-Centre apartment blocks with ground-floor arcades, cream/ochre stone & render facades (#D8CDB5–#C9B99A), dark-wood/aluminium windows, balcony rows, pitched/mansard metal roofs with decorative cornices; rooftop advertising letters on several blocks
- **transit**: buses 104, 116, 117, 123, 361, 385; trolleybus 73
- confidence: lanes high (OSM); facades medium [osm] [wp_bd_unirii] [fountains_44]

### Bulevardul Corneliu Coposu (chapter route)

- OSM: 16 ways, 1522 m in district, classes secondary; lanes values ['2', '3', '4', '6']; one-way segments 16/16; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 116, bus 117, bus 312, bus 323, bus 385, trolleybus 73.
- OSM trees within 25 m: 1 (species —, genus —).
- OSM furniture: {'bench': 1}.
- Fronting buildings: 36; businesses: 38.
- **cross_section**: one-way pair (2–6 lanes) from Piața Unirii NE to the Călărașilor/Mircea Vodă junction; Unirea Shopping Center rear + Hala Unirii; trolleybus 73
- confidence: high (OSM) [osm]

### Piața Unirii (chapter route)

- OSM: 21 ways, 1344 m in district, classes primary, secondary; lanes values ['2', '3', '4', '5', '6', '8', '9']; one-way segments 21/21; maxspeed ['40', '50', '60', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 100, bus 104, bus 116, bus 117, bus 123, bus 312, bus 323, bus 361, bus 385, bus N108, tram 7, tram 27, tram 32, tram 47, trolleybus 73.
- OSM trees within 25 m: 176 (species {'Tilia platyphyllos': 21, 'Tilia tomentosa': 38, 'Quercus robur': 10, 'Quercus petraea': 18, 'Prunus cerasifera': 9, 'Robinia pseudoacacia': 6, 'Platanus × hispanica': 5, 'Rhus typhina': 3, 'Prunus persica': 7, 'Acer negundo': 7, "Salix matsudana 'Tortuosa'": 4, 'Quercus rubra': 10, 'Pinus nigra': 5, 'Tamarix tetrandra': 1, 'PAULOWNIA TOMENTOSA (SIN. P. IMPERIALIS)': 3, 'Catalpa bignonioides': 1, 'Acer tataricum': 2, 'Pseudotsuga menziesii': 4, 'Fraxinus americana': 2, 'Ailanthus altissima': 2, 'Fraxinus excelsior': 1, 'Celtis occidentalis': 2, 'Aesculus hippocastanum': 1, 'Abies alba': 3}, genus {'Prunus': 1, 'Ulmus': 1, 'Malus': 2, 'Fagus': 6}).
- OSM furniture: {'bicycle_parking': 1, 'drinking_water': 2, 'fountain': 31}.
- Fronting buildings: 7; businesses: 17.
- **layout**: Largest square in central Bucharest; one-way gyratory system (3–9 lane approaches with heavy turn channelisation) around a central park with the fountain field; the square is a concrete slab ("Planșeul Unirii", 32 × 360 m) over the Dâmbovița, which runs diagonally underneath; Bd. Unirii crosses W–E; Pasajul Unirii road underpass N–S (I.C. Brătianu ↔ Cantemir); Piața Unirii metro (M1/M2/M3, Unirii 1 & 2) with many entrances; tram terminal near the SW corner; big taxi rank
- **fountains**: 44 independent fountains along ≈1.4 km of Bd. Unirii + the square, >16,000 m² water surface, built late 1980s, rehabilitated by Apa Nova and reopened Sept 2018 with light/music shows ("Simfonia Apei" weekends May–Sept, after sunset); World Record Academy 2019: longest line of synchronised choreographed fountains. Basins: grey granite/concrete rims, turquoise-tiled bottoms, jets 2–15 m.
- **park**: lawns, rose beds, linden & birch groups, benches; the round central fountain basin (OSM n1423222582 "Fântâna lui Bucur")
- **frontage**: E: Unirea Shopping Center (1976, enlarged 1989; 6 levels in OSM, long horizontal facade with ad banners) + Hala Unirii + Parcare Unirea deck; N: Hanul lui Manuc (1808) near NE corner, Old Town edge; S/SW: Dealul Mitropoliei with the Patriarchal Cathedral on the hill, Sf. Spiridon Nou church (Cantemir); 1980s Civic-Centre blocks (8–10 storeys, cream/beige stone-clad, arcaded ground floors, mansard-like roofs) on all corners carrying large rooftop advertising letters/LED screens
- **works_2023_2026**: Since 2023 vehicles >3.5 t are banned on the slab; reconstruction of the Dâmbovița cover started 2024–25 and was in its final stage in summer 2026 (>60 % done, expected end-2026) with restrictions around Pasajul Unirii. Recommendation: model the finished/normal layout (the CV chapter is 2015) and optionally add hoardings at the Pasaj.
- confidence: high (Wikipedia/news) except frontage colours medium [wp_unirii_sq] [wp_unirea] [fountains_44] [fountains_record] [fountains_2025] [planseu_2026] [planseu_60pct] [planseu_traffic]

### Bulevardul Mircea Vodă (chapter route)

- OSM: 17 ways, 976 m in district, classes secondary, secondary_link; lanes values ['2', '3', '4', '5']; one-way segments 1/17; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 116, bus 117, bus 312, bus 323, bus 385, trolleybus 73.
- OSM trees within 25 m: 38 (species {'Sambucus nigra': 5, 'Tilia platyphyllos': 13, 'Tilia tomentosa': 4, 'Populus alba': 1, 'Ulmus minor': 6, 'Fraxinus americana': 3}, genus —).
- OSM furniture: {'lift_gate': 1, 'gate': 1}.
- Fronting buildings: 14; businesses: 11.
- **cross_section**: two-way 2+2 (3+2 near junctions), 50 km/h, trolleybus 73 wires, buses 116/117/312/323/385
- **frontage**: W: Day Tower (37A, 9 lv, 2018 glass office, Starbucks ground floor), Mercure hotel (28, 12 lv, 2006), Hotel Marina; E: 9-storey 1980s blocks E1/E2 and new 21D Downtown residences (9 lv, 2016), BCR & BRD branches, Sector 3 civil-status office
- confidence: high (OSM) [osm]

### Calea Călărașilor (chapter route)

- OSM: 10 ways, 843 m in district, classes secondary; lanes values ['2', '4']; one-way segments 3/10; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 61; businesses: 23.
- **cross_section**: TWO-WAY 1+1 (≈7–8 m carriageway), 50 km/h, asphalt with patches; cars parked half on the narrow (1.5–2.5 m) sidewalks on both sides; no tram/trolley on this stretch; overhead telecom cables and older concrete lamp poles
- **frontage**: Bucharest's best-preserved row of late-19th/early-20th-c. merchant houses ("case de târgoveț"): 1–2-storey rendered street houses (nos. 78–111 listed LMI B-II-m-B-183xx, built 1900–1920) with tall windows, pilasters, cornices, carriage gates, many shabby or seismic-risk; interspersed with 4–6-storey interwar blocks (no. 105, 1936; 117-119 S+P+4+attic) and a few 1990s infills; >200 legally protected buildings along the street
- **hala_traian**: no. 133 at the Traian corner: Hala Traian (1896) — one of the last two 19th-c. market halls; structure kept but converted into a Mega Image supermarket (red Mega Image fascia on the historic hall); Piața Traian open market opposite (south side)
- **businesses**: Mega Image (133), Superbet, Farmacia Dona, myGOLD & Tezaur pawn shops, shaorma, pastry shop, car-parts shops, Bulgust, Toka, Tripoli restaurants (OSM)
- confidence: lanes/heritage high (OSM, Digi24); facades medium [osm] [calarasi_200] [hala_traian_mega] [hala_traian_zf]

### Pasajul Unirii

- OSM: 7 ways, 1560 m in district, classes primary; lanes values ['2']; one-way segments 7/7; maxspeed ['40']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 381.
- OSM trees within 25 m: 41 (species {'Robinia pseudoacacia': 1, 'Quercus rubra': 3, 'Tilia tomentosa': 2, 'Quercus robur': 2, 'Fraxinus americana': 11, 'Tilia cordata': 1, 'Prunus cerasifera': 2, 'Pseudotsuga menziesii': 2, 'Rhus typhina': 1, 'Tilia platyphyllos': 1, 'Prunus persica': 9}, genus {'Magnolia': 1}).
- OSM furniture: {'taxi': 1, 'bicycle_parking': 2, 'drinking_water': 2, 'fountain': 27}.
- Fronting buildings: 26; businesses: 26.

### Strada Matei Basarab

- OSM: 9 ways, 948 m in district, classes tertiary; lanes values ['2', '3', '4']; one-way segments 4/9; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 24 (species —, genus —).
- OSM furniture: {'lift_gate': 1, 'gate': 2, 'taxi': 1, 'drinking_water': 1}.
- Fronting buildings: 53; businesses: 12.

### Bulevardul Ion Constantin Brătianu

- OSM: 5 ways, 934 m in district, classes primary; lanes values ['2']; one-way segments 5/5; maxspeed ['50', '60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 361, bus 381, bus N108.
- OSM trees within 25 m: 4 (species {'Prunus persica': 4}, genus —).
- OSM furniture: {'block': 1, 'gate': 1}.
- Fronting buildings: 18; businesses: 20.

### Strada Romulus

- OSM: 5 ways, 809 m in district, classes tertiary; lanes values ['2']; one-way segments 4/5; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 2 (species —, genus —).
- Fronting buildings: 54; businesses: 1.

### Strada Sfânta Vineri

- OSM: 11 ways, 800 m in district, classes living_street, tertiary; lanes values ['1', '2', '3']; one-way segments 3/11; maxspeed ['30', '50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 312, bus 323, bus 385.
- OSM trees within 25 m: 27 (species {'Prunus persica': 22}, genus —).
- OSM furniture: {'fountain': 1}.
- Fronting buildings: 32; businesses: 15.

### Strada Traian

- OSM: 13 ways, 794 m in district, classes tertiary; lanes values ['1', '2', '4']; one-way segments 4/13; maxspeed ['30', '50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): trolleybus 97.
- OSM trees within 25 m: 8 (species —, genus —).
- OSM furniture: {'gate': 4}.
- Fronting buildings: 38; businesses: 16.
- **cross_section**: two-way 1+1 tertiary with trolleybus 97 wires; Hala Traian bus/trolley stop (STB ref 97), tram stop Hala Traian on the cross street; Biserica Hagiu (1872) at no. 142
- confidence: high (OSM) [osm]

### Splaiul Unirii

- OSM: 4 ways, 540 m in district, classes secondary; lanes values ['2', '3']; one-way segments 4/4; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 312.
- OSM trees within 25 m: 128 (species {'Tilia tomentosa': 62, 'Acer saccharinum': 9, 'Fraxinus americana': 12, 'Platanus occidentalis': 12, 'Thuja orientalis': 8, 'Fraxinus excelsior': 5, 'Morus nigra': 1, 'Catalpa bignonioides': 4, 'Prunus armeniaca': 1, 'Thuja plicata': 3, 'Chamaecyparis lawsoniana': 1, 'Prunus cerasifera': 1, 'Acer pseudoplatanus': 1, 'Rhus typhina': 1, 'Abies concolor': 1, 'Abies alba': 1, 'Acer platanoides': 1}, genus {'Paulownia': 3, 'Prunus': 1}).
- OSM furniture: {'block': 1}.
- Fronting buildings: 3; businesses: 10.

### Calea Moșilor

- OSM: 8 ways, 470 m in district, classes living_street, residential, tertiary; lanes values ['2']; one-way segments 2/8; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: True; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): tram 16, tram 21.
- OSM trees within 25 m: 11 (species {'Prunus persica': 11}, genus —).
- OSM furniture: {'recycling': 1, 'gate': 1}.
- Fronting buildings: 47; businesses: 14.

### Bulevardul Dimitrie Cantemir

- OSM: 8 ways, 455 m in district, classes primary; lanes values ['2', '3', '5']; one-way segments 8/8; maxspeed ['50']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 116, trolleybus 73, trolleybus 74, trolleybus 76.
- OSM trees within 25 m: 111 (species {'Tilia tomentosa': 31, 'Acer pseudoplatanus': 4, 'Koelreuteria paniculata': 7, 'Prunus cerasifera': 2, 'Fraxinus excelsior': 4, 'Thuja orientalis': 6, 'Picea abies': 11, 'Acer tataricum': 2, 'Betula pendula': 3, 'Thuja occidentalis': 6, 'Carpinus betulus': 2, 'Morus alba': 3, 'Chamaecyparis lawsoniana': 11, 'Robinia pseudoacacia': 1, 'Thuja plicata': 7, 'Pinus strobus': 1, 'MALUS SYLVESTRIS': 1, 'Acer platanoides': 1, 'Salix alba': 1, 'Pinus sylvestris': 2, 'Abies alba': 2, 'Syringa vulgaris': 1, 'Rhus typhina': 1}, genus {'Malus': 1}).
- Fronting buildings: 3; businesses: 10.

### Bulevardul Hristo Botev

- OSM: 3 ways, 304 m in district, classes tertiary; lanes values ['2']; one-way segments 0/3; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 2 (species —, genus —).
- Fronting buildings: 23; businesses: 2.

### Splaiul Independenței

- OSM: 3 ways, 216 m in district, classes primary; lanes values ['3']; one-way segments 3/3; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 104, bus 123, bus 385.
- OSM trees within 25 m: 35 (species {'Tilia tomentosa': 21, 'Platanus occidentalis': 10, 'Thuja occidentalis': 1, 'Koelreuteria paniculata': 2}, genus —).
- OSM furniture: {'gate': 1}.
- Fronting buildings: 8; businesses: 7.

## Squares, junctions, landmarks

- **Piața Unirii** — multi-lane gyratory + Pasajul Unirii underpass + metro; streets["Piața Unirii"]
- **Bd. Mircea Vodă × Bd. Coposu × Calea Călărașilor** — signalised; trolleybus 73 turns here;  [osm]
- **Calea Călărașilor × Str. Traian (Hala Traian)** — signalised 4-arm, market crowds, trolleybus 97 crossing;  [osm]
- **Piața Unirii & Bd. Unirii fountains** (`fountains`,  44.4266, 26.1025) — 44 fountains, ~1.4 km, synchronised light/music shows Fri–Sun evenings May–Sept; at night coloured LED lighting [fountains_44] [fountains_record] [fountains_2025]
- **Unirea Shopping Center** (`unirea`, w23492027) — east side of the square; big brand banners; underground Mega Image [wp_unirea]
- **Dealul Mitropoliei (Patriarchal Cathedral, Palace of the Parliament beyond)** (`patriarchal_hill`,  44.4245, 26.0975) — view west/south-west from the square; the Palace of the Parliament closes the Bd. Unirii vista to the west [wp_bd_unirii]
- **Hala Traian** (`hala_traian`, w35147215) — 1896 market hall now Mega Image [hala_traian_mega]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|
| n31404743 | Bulevardul Mircea Vodă × Bulevardul Unirii | yes |  | 6 |
| n31404739 | Aleea Dealul Mitropoliei × Piața Unirii × Strada Bibescu Vodă |  |  | 3 |
| n31404741 | Bulevardul Dimitrie Cantemir × Piața Unirii × Splaiul Unirii | yes |  | 4 |
| n2687992834 | Aleea Dealul Mitropoliei × Piața Unirii |  |  | 2 |
| n574821 | Calea Călărașilor × Piața Sfântul Ștefan × Strada Remus |  |  | 3 |
| n2190976613 | Calea Călărașilor × Intrarea Pristolului |  |  | 0 |
| n248727721 | Calea Călărașilor × Strada Romulus |  |  | 2 |
| n11730392505 | Calea Călărașilor × Strada Sfântul Ștefan |  |  | 3 |
| n2279089977 | Calea Călărașilor × Strada Profesor Valaori Iuliu |  |  | 1 |
| n248729693 | Calea Călărașilor × Strada Fetițelor × Strada Prof. Dr. Mihail Georgescu |  |  | 2 |
| n248729695 | Calea Călărașilor × Strada Profesor Constantinescu Mitriță |  |  | 1 |
| n2317665867 | Calea Călărașilor × Strada Gheorghe Ionescu-Gion |  |  | 4 |
| n256207130 | Calea Călărașilor × Strada Popa Soare |  |  | 2 |
| n256210253 | Calea Călărașilor × Strada Alexandru Sihleanu |  |  | 3 |
| n479155100 | Bulevardul Mircea Vodă × Strada Strehaia |  |  | 3 |
| n248727077 | Bulevardul Mircea Vodă × Strada Anton Pann | yes |  | 4 |
| n1858219470 | Bulevardul Mircea Vodă × Strada Vintilă Vodă |  |  | 3 |
| n248736293 | Bulevardul Corneliu Coposu × Calea Călărașilor × Strada Mântuleasa | yes |  | 1 |
| n134860954 | Bulevardul Mircea Vodă × Strada Sfânta Vineri | yes |  | 4 |
| n134860944 | Bulevardul Mircea Vodă × Strada Matei Basarab | yes |  | 4 |
| n318820568 | Bulevardul Mircea Vodă × Strada Căuzași | yes |  | 3 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w649953603 | Day Tower | 9 /  | #7E9AA6 glass curtain wall |  | 2018 |  [osm] |
| w170338254 | Mercure Bucharest Unirii | 12 /  |   |  | 2006 |  [osm] |
| w35147215 | Hala Traian (Mega Image) | 1 / 9 | #B5543C exposed red brick with iron/glass roof lanterns (19th-c. market hall) | pitched metal with clerestory | 1896 |  [hala_traian_mega] [osm] |
| w245117704 | Calea Călărașilor 101 (GTS address) | 1 / 5.5 | #E3D3B8  | low pitched, grey/brown sheet | c. 1900–1920, listed | gts [osm] [gts_job] |
| w23492027 | Unirea Shopping Center | 6 / 25 | #C8C1B3 concrete/stone panels, large glazing + ad banners | flat, rooftop signage | 1976, enlarged 1989; mall since 1990s |  [wp_unirea] [osm] |
| w245117686 | Calea Călărașilor 105 (1936 block) | 6 /  | #D9D2C3  |  | 1936, listed |  [osm] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w209173451 | Bulevardul Mircea Vodă | E |  | apartments · Bloc E2 | 9 |  |  |  | communist-era block (likely) | #CBBFA6 est | 1 |
| w649953603 | Bulevardul Mircea Vodă | W | 37A | office · Day Tower | 9 |  | 2018 |  | modern office/glass curtain wall | #7E9AA6 | 3 |
| w170338254 | Bulevardul Mircea Vodă | W | 28 | yes · Mercure | 12 |  | 2006 |  | post-1990 building | #BDB5A6 est | 1 |
| w209172522 | Bulevardul Mircea Vodă | E |  | apartments · Bloc E1 | 9 |  |  |  | communist-era block (likely) | #BDB5A6 est | 1 |
| w175189336 | Bulevardul Mircea Vodă | W | 24D | office | 5 |  | 2005 |  | post-1990 building | #D8CDB5 est | 1 |
| w541428922 | Bulevardul Mircea Vodă | E | 21D Downtown | apartments | 9 |  | 2016 |  | post-1990 building | #BDB5A6 est | 0 |
| w786158568 | Bulevardul Mircea Vodă | E |  | apartments | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w1576034831 | Bulevardul Mircea Vodă | W |  | construction |  |  |  |  | unknown (use district rule) |  | 0 |
| w86134168 | Bulevardul Mircea Vodă | W |  | apartments · Hotel Marina | 3 |  |  |  | unknown (use district rule) |  | 2 |
| w304074690 | Bulevardul Mircea Vodă | W | 14 | apartments | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w82978172 | Bulevardul Mircea Vodă | E |  | yes · Casa Eliad |  |  |  |  | unknown (use district rule) |  | 1 |
| w304074692 | Bulevardul Mircea Vodă | W | 12 | apartments | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w162494169 | Bulevardul Mircea Vodă | E |  | apartments · Bl. U114 |  |  |  |  | unknown (use district rule) |  | 0 |
| w162494335 | Bulevardul Mircea Vodă | E |  | apartments |  |  |  |  | unknown (use district rule) |  | 0 |
| w693861078 | Bulevardul Unirii | S |  | yes · Aici | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 1 |
| w693861084 | Bulevardul Unirii | S |  | yes · Jo Lounge | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w693861081 | Bulevardul Unirii | S |  | yes · Naked Kitchen & Beach Bar | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 1 |
| w693861075 | Bulevardul Unirii | S |  | yes · Altfel | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 1 |
| w693861079 | Bulevardul Unirii | S |  | yes · Moon | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w693861074 | Bulevardul Unirii | S |  | yes · The Clique Bistro | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w787816882 | Bulevardul Unirii | S |  | yes · Exotique Lounge | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w343510267 | Calea Călărașilor | SE |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w250284622 | Calea Călărașilor | S |  | yes |  |  |  |  | unknown (use district rule) |  | 3 |
| w1173133036 | Calea Călărașilor | S | 36 | yes | 4 |  |  |  | unknown (use district rule) |  | 0 |
| w1173133035 | Calea Călărașilor | S | 36A | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w86038865 | Calea Călărașilor | S |  | retail · Piața Traian |  |  |  |  | unknown (use district rule) |  | 1 |
| w1173271578 | Calea Călărașilor | S |  | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w1173271579 | Calea Călărașilor | S | 58 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 0 |
| w1173271581 | Calea Călărașilor | S | 62 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 0 |
| w1173271580 | Calea Călărașilor | S | 60 | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w1173271583 | Calea Călărașilor | S | 78 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w245117583 | Calea Călărașilor | S | 80 | yes | 1 |  | 1910 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #E6CFC0 est | 1 |
| w230400920 | Calea Călărașilor | S | 110 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w187078764 | Calea Călărașilor | N | 57 | apartments | 3 |  |  |  | unknown (use district rule) |  | 0 |
| w1480407691 | Calea Călărașilor | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1480407692 | Calea Călărașilor | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w250285029 | Calea Călărașilor | S | 66 | semidetached_house |  |  |  |  | unknown (use district rule) |  | 0 |
| w187078773 | Calea Călărașilor | N | 59 | apartments | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w245117703 | Calea Călărașilor | S | 82 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w236368849 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117600 | Calea Călărașilor | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117584 | Calea Călărașilor | S |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w230288962 | Calea Călărașilor | S | 90 | yes |  |  | 1900 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 2 |
| w309372403 | Calea Călărașilor | S |  | hotel |  |  |  |  | unknown (use district rule) |  | 0 |
| w236368845 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w236368856 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117578 | Calea Călărașilor | S |  | semidetached_house |  |  |  |  | unknown (use district rule) |  | 0 |
| w236368853 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1173271582 | Calea Călărașilor | N |  | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w236368860 | Calea Călărașilor | N | 61 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w236368862 | Calea Călărașilor | N | 75 | apartments | 4 |  | 1940 | Non Corresponding Urgency Category | interwar (art deco / modernist) apartment block | #CFC8B8 est | 0 |
| w178704672 | Calea Călărașilor | N |  | apartments | 3 |  |  |  | unknown (use district rule) |  | 1 |
| w245117577 | Calea Călărașilor | N | 129 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 0 |
| w236368847 | Calea Călărașilor | N | 67 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 0 |
| w245117545 | Calea Călărașilor | N |  | semidetached_house |  |  |  |  | unknown (use district rule) |  | 0 |
| w1464553529 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117755 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w230248621 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 1 |
| w1464553528 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1173271585 | Calea Călărașilor | N | 97 | yes · Casă de târgoveț | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w245117661 | Calea Călărașilor | N | 111 | semidetached_house | 1 |  | 1920 | Non Corresponding Urgency Category | interwar (art deco / modernist) apartment block | #D9D2C3 est | 0 |
| w230288960 | Calea Călărașilor | N | 117-119 | apartments | S+P+4E+Pod |  | 1957 | Seismic Risk Class II | communist-era block (prefab or brick, 1950s-80s) | #D8CDB5 est | 0 |
| w245117629 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117717 | Calea Călărașilor | N | 103 | apartments | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w245117723 | Calea Călărașilor | N | 109 | semidetached_house |  |  |  |  | unknown (use district rule) |  | 0 |
| w230249029 | Calea Călărașilor | N | 85 | apartments | 3 |  |  |  | unknown (use district rule) |  | 2 |
| w245117553 | Calea Călărașilor | N | 99 | apartments | S+P |  | 1992 | Seismic Risk Class I | post-1990 building | #C9B99A est | 0 |
| w35147215 | Calea Călărașilor | N | 133 | retail · Hala Traian |  |  | 1896 |  | pre-1919 eclectic / neo-romanian house or villa | #B5543C | 7 |
| w245117537 | Calea Călărașilor | N | 87 | yes | 2 |  | 1915 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 0 |
| w1480407690 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1173271584 | Calea Călărașilor | N | 89 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 0 |
| w1464553527 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1480407689 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117627 | Calea Călărașilor | N | 91 | yes | 1 |  | 1912 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 0 |
| w245117586 | Calea Călărașilor | N | 93 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 0 |
| w245117704 | Calea Călărașilor | N | 101 | apartments | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 | 0 |
| w1173271586 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w245117681 | Calea Călărașilor | N |  | yes |  |  |  |  | unknown (use district rule) |  | 0 |
| w1176579392 | Piața Unirii | N |  | yes |  | 3 |  |  | unknown (use district rule) |  | 0 |
| w1176579389 | Piața Unirii | N |  | yes |  | 3 |  |  | unknown (use district rule) |  | 0 |
| w1176579390 | Piața Unirii | E |  | service |  | 3 |  |  | utility/annex |  | 0 |
| w1176142648 | Piața Unirii | E |  | yes |  | 3 |  |  | unknown (use district rule) | #696969 | 0 |
| w1176142649 | Piața Unirii | E |  | yes |  | 4 |  |  | unknown (use district rule) | #1d3b35 | 0 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| w227217668 |  |  | amenity=parking | Bulevardul Corneliu Coposu | SE |  |
| n1814941235 | BCR | BCR bg #0074BC fg #FFFFFF | amenity=bank | Bulevardul Mircea Vodă | E | 43 |
| n2471073184 | BRD | BRD bg #000000 fg #FFFFFF | amenity=bank | Bulevardul Mircea Vodă | E | 2 |
| n2496353024 | Dentotal |  | amenity=dentist | Bulevardul Mircea Vodă | W | 24D |
| n9843243333 | Hotel Marina |  | tourism=hotel | Bulevardul Mircea Vodă | W |  |
| w86134168 | Hotel Marina |  | tourism=hotel | Bulevardul Mircea Vodă | W |  |
| w170338254 | Mercure |  | tourism=hotel | Bulevardul Mircea Vodă | W | 28 |
| n9017979844 | PPC |  | office=energy_supplier | Bulevardul Mircea Vodă | W |  |
| n6866461382 | Serviciul Stare Civilă Sector 3 |  | amenity=townhall | Bulevardul Mircea Vodă | E | 5 |
| n6098677599 | Starbucks | Starbucks bg #00704A fg #FFFFFF | amenity=cafe | Bulevardul Mircea Vodă | W | 37A |
| w82978020 | Școala Lauder-Reut |  | amenity=school | Bulevardul Mircea Vodă | W |  |
| w1177070485 |  |  | amenity=parking | Bulevardul Unirii | N |  |
| w693861078 | Aici |  | amenity=restaurant | Bulevardul Unirii | S |  |
| w693861075 | Altfel |  | amenity=restaurant | Bulevardul Unirii | S |  |
| w787816882 | Exotique Lounge |  | amenity=restaurant | Bulevardul Unirii | S |  |
| n14216490524 | Fornetti | Fornetti bg #E30613 fg #FFFFFF | shop=bakery | Bulevardul Unirii | S |  |
| w693861084 | Jo Lounge |  | amenity=restaurant | Bulevardul Unirii | S |  |
| w693861079 | Moon |  | amenity=bar | Bulevardul Unirii | S |  |
| w693861081 | Naked Kitchen & Beach Bar |  | amenity=restaurant | Bulevardul Unirii | S |  |
| w693861074 | The Clique Bistro |  | amenity=restaurant | Bulevardul Unirii | S |  |
| n5927196535 |  |  | shop=vacant | Calea Călărașilor | N |  |
| n13456671087 |  |  | shop=pastry | Calea Călărașilor | S |  |
| w230248621 |  |  | shop=car_parts | Calea Călărașilor | N |  |
| n7175249087 | 20 grams |  | amenity=cafe | Calea Călărașilor | N |  |
| n13574625919 | Bulgust |  | amenity=restaurant | Calea Călărașilor | N | 85 |
| n10539907931 | Farmacia Dona | Farmacia Dona bg #E30613 fg #FFFFFF | amenity=pharmacy | Calea Călărașilor | S |  |
| n2396942475 | Frizerie |  | shop=hairdresser | Calea Călărașilor | N |  |
| n7715933706 | Fx Auto |  | shop=car_repair | Calea Călărașilor | N |  |
| n5488312323 | Jade Palace |  | shop=massage | Calea Călărașilor | S | 90 |
| n1890565824 | Mega Image | Mega Image bg #E30613 fg #FFFFFF | shop=supermarket | Calea Călărașilor | N | 133 |
| w86038865 | Piața Traian |  | amenity=marketplace | Calea Călărașilor | S |  |
| n2567699408 | Shaormeria Baneasa |  | amenity=fast_food | Calea Călărașilor | S |  |
| n8628418067 | Superbet | Superbet bg #E30613 fg #FFFFFF | shop=bookmaker | Calea Călărașilor | N |  |
| n13456671086 | Tezaur |  | shop=pawnbroker | Calea Călărașilor | S |  |
| n2479038675 | Toka |  | amenity=restaurant | Calea Călărașilor | S | 78 |
| n5396036261 | Trei |  | amenity=restaurant | Calea Călărașilor | N |  |
| n2567699480 | Tripoli |  | amenity=restaurant | Calea Călărașilor | S | 90 |
| n13706032501 | iiana |  | shop=clothes | Calea Călărașilor | N | 103 |
| n13456671089 | myGOLD |  | shop=pawnbroker | Calea Călărașilor | N |  |
| n9411250630 | Fastprint |  | shop=copyshop | Piața Unirii | S |  |
| n6053541301 | Stephanus |  | shop=books | Piața Unirii | S |  |
| n9999021745 | Synevo |  | healthcare=laboratory | Piața Unirii | S | 1 |
| n327226173 | The Harp |  | amenity=restaurant | Piața Unirii | S | 2 |
| n9411250343 | The Harp Bakery |  | amenity=cafe | Piața Unirii | S | 2 |
| n9411250344 | Trattoria L'Oroscopo |  | amenity=restaurant | Piața Unirii | S | 2 |

Other branded businesses in the district (off-route): 5 to go (Bulevardul Corneliu Coposu, n10539882353); Alpha Bank (Bulevardul Corneliu Coposu, n2690048045); Banca Transilvania (Bulevardul Corneliu Coposu, n3711838133); Froo (Bulevardul Corneliu Coposu, n7106580120); ING (Bulevardul Corneliu Coposu, n510598710); KFC (Bulevardul Corneliu Coposu, n286860947); MOL (Bulevardul Corneliu Coposu, w670595374); OMV (Bulevardul Corneliu Coposu, w263315803); Patria Bank (Bulevardul Corneliu Coposu, n2690812691); Euronet (Bulevardul Dimitrie Cantemir, n7072636090); Maxbet (Bulevardul Dimitrie Cantemir, n9999021744); 5 to go (Bulevardul Ion Constantin Brătianu, n12851066022); BRD (Bulevardul Ion Constantin Brătianu, n647187505); Luca (Bulevardul Ion Constantin Brătianu, n1731040875); Regina Maria (Bulevardul Regina Maria, n3096589729); Exim Banca Românească (Bulevardul Unirii, n7074349066); First Bank (Bulevardul Unirii, n1563413172); La Doi Pași (Bulevardul Unirii, n14125548801); Shop&Go (Bulevardul Unirii, n10000060582); Catena (Calea Călărașilor, n2388108677); Chopstix (Pasajul Unirii, n6323313080); Euronet (Pasajul Unirii, n7072030137); Luca (Pasajul Unirii, n12269022952); McDonald's (Pasajul Unirii, n125285209); Sephora (Pasajul Unirii, n9255719431); BCR (Piața Unirii, n7411821210); Banca Transilvania (Piața Unirii, n3718543194); Catena (Piața Unirii, n6939504485); Dr. Max (Piața Unirii, n6939489489); Fornetti (Piața Unirii, n9159258049); Help Net (Piața Unirii, n6228250431); Luca (Piața Unirii, n4073525677); Luca (Piața Unirii, n7411821211); ING (Splaiul Independenței, n2454097616); Vodafone (Splaiul Independenței, n9159258050); 5 to go (Splaiul Unirii, n14230343278); Shop&Go (Splaiul Unirii, n14230343280); Froo (Strada Bibescu Vodă, n13503309729); DHL (Strada Bălcești, n7942218168); Farmacia Dona (Strada Bărăției, n2690055639); Stanleybet (Strada Bărăției, n12759899758); 5 to go (Strada Halelor, n12269022954); Euronet (Strada Halelor, n7071986524); Starbucks (Strada Halelor, n3578133327); Superbet (Strada Halelor, n8628417559); dm (Strada Halelor, n3748890801); Banca Transilvania (Strada Lipscani, n3711811990); UniCredit (Strada Lipscani, n7106680234); 5 to go (Strada Matei Basarab, n12493379679); Shop&Go (Strada Matei Basarab, n4151705165); ING (Strada Negru Vodă, n8478282369); Superbet (Strada Patriei, n8628417649); Telekom (Strada Patriei, n2451994413); Mega Image (Strada Prof. Dr. Mihail Georgescu, w86038763); Patria Bank (Strada Sfânta Ecaterina, w79641030); Annabella (Strada Sfânta Vineri, n9990622882); Berezka (Strada Sfânta Vineri, n4997248581); Euronet (Strada Sfânta Vineri, n7071986573); Garanti (Strada Sfânta Vineri, n2690812695); Patria Bank (Strada Sfânta Vineri, n4997248609); Shop&Go (Strada Sfânta Vineri, n6945449587); Shop&Go (Strada Sfânta Vineri, n13276538913); 5 to go (Strada Traian, n13456671090); Fortuna (Strada Traian, n10539907930); CEC Bank (Strada Vasile Adamache, n1439641536); Carrefour (, w405564542); Douglas (, n9336831437); Dristor Kebap (, n9999146569); Dristor Kebap (, n10015209218); Dristor Kebap (, n1731040881); Euronet (, n7071972917); Euronet (, n7072038767); Euronet (, n7072148314); Euronet (, n9999072877); Mega Image (, n1439628129); Raiffeisen Bank (, n10000060581); Shop&Go (, n7613013081); UniCredit (, n7080689121).

## Transit

- Lines with OSM route relations touching the district: bus 100, bus 104, bus 116, bus 117, bus 123, bus 312, bus 323, bus 361, bus 381, bus 385, bus N108, tram 7, tram 16, tram 21, tram 23, tram 27, tram 32, tram 47, trolleybus 73, trolleybus 74, trolleybus 76, trolleybus 97.
- Stops: Alexandru Sihleanu (tram); Biblioteca Națională a României (bus); Bulevardul I.C. Brătianu (bus); Hala Traian (bus/trolleybus); Hala Traian (tram); Matei Basarab (bus); Matei Basarab (platform); Mircea Vodă (bus); Mântuleasa (tram); Piata sf. Gheorghe (bus); Piața Corneliu Coposu (tram); Piața Sf. Gheorghe (bus); Piața Sfânta Vineri (bus); Piața Sfânta Vineri (bus/tram); Piața Sfântul Gheorghe (tram); Piața Sfântul Ștefan (tram); Piața Unirii (bus); Piața Unirii (bus/trolleybus); Piața Unirii (platform); Piața Unirii (tram); Piața Unirii 1 (bus); Piața Unirii 2 (bus); Piața Unirii 3 (bus); Piața Unirii 4 (bus); Piața Unirii 5 (bus); Sfânta Vineri (bus).
- Metro entrances: Piața Unirii 2 D (44.42754, 26.10421); Piața Unirii 2 C (44.42907, 26.10304); Piața Unirii 2 D (44.42809, 26.10415); Piața Unirii 1 B (44.42837, 26.10103); Piața Unirii 1 B (44.42815, 26.10101); Piața Unirii 1 A (44.42560, 26.10370); Piața Unirii 2  (44.42804, 26.10354); Piața Unirii 2 C (44.42905, 26.10329); Piața Unirii 1  (44.42597, 26.10337).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Traffic / congestion (feeds `congestion`, spec 13)

- City: Bucharest ≈62.5 % congestion, 171 h lost per driver in 2025; >32 min per 10 km, >45 min at evening peak; worst slot Wednesday 17:00–18:00 [tomtom_2025] [tomtom_2025b] [euronews_10km]

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Piața Unirii (all arms, Pasajul Unirii) | 44.4268, 26.1025 | 250 | [[7.5, 10], [16, 19.5]] | 0.9 | Victoriei–Unirii axis is the most congested in the city; 2024–26 slab works add lane closures [hotnews_axis] [planseu_traffic] |
| Bd. Mircea Vodă × Coposu × Călărașilor | 44.4323, 26.1118 | 150 | [[8, 10], [17, 19]] | 0.6 | queues on Coposu and Mircea Vodă N-bound [tomtom_peak] |
| Calea Călărașilor × Traian (Hala Traian) | 44.4332, 26.1205 | 120 | [[8, 10], [16, 19]] | 0.5 | single lane each way + market deliveries + double parking [calarasi_200] |

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

- facades_interwar_modernist: #D9D2C3 #E2D8C4 #CFC8B8
- facades_villas: #E3D3B8 #E8D9BE #D9C3A0 #E6CFC0 #CFC1A8
- facades_1970s_90s_blocks: #D8CDB5 #C9B99A #BDB5A6 #CBBFA6
- civic_centre_blocks: #D2C4A6
- fountain_water: #3FA7C9
- fountain_rim: #A7A39A
- brick_hall: #B5543C
- road: #404045
- sidewalk: #A9A59C
- kerb: #9B9A94
- marking: #F4F4F0
- conf: medium/estimated

## Top 30 things a local would notice if wrong

1. Piața Unirii is a vast square on a slab over the Dâmbovița — fountains, park, gyratory, metro, Unirea mall on the east side.
2. Fountains continue as a long chain in the central reservation of Bd. Unirii; at night they glow in changing colours (shows Fri–Sun in summer).
3. Bd. Unirii = 1980s Champs-Élysées copy: uniform 8–10-storey cream/ochre blocks with arcades and decorative rooflines; Palace of the Parliament closes the vista west.
4. Bd. Unirii carriageways are one-way 3-lane each side of the fountain median.
5. Rooftop advertising letters and LED screens on the blocks around Piața Unirii.
6. Unirea Shopping Center: long 1970s facade with brand banners, partly empty windows on the north side.
7. Dealul Mitropoliei with the Patriarchal Cathedral visible from the square.
8. Calea Călărașilor is a narrow TWO-WAY street, nothing like a boulevard.
9. Calea Călărașilor is lined by low 1900–1920 merchant houses (listed), many shabby, with a few 1930s 6-storey blocks.
10. Cars parked on the sidewalks of Calea Călărașilor; loose overhead cables.
11. Hala Traian (1896 brick market hall) now carries a red Mega Image fascia.
12. Piața Traian open market stalls opposite Hala Traian.
13. Trolleybus wires on Str. Traian and Mircea Vodă, not on Călărașilor.
14. Day Tower glass office + Starbucks and the 12-storey Mercure on Mircea Vodă.
15. Taxi rank and STB bus hub at Piața Unirii; tram terminus near the SW corner.
16. Pawn shops (myGOLD, Tezaur), Superbet and a Dona pharmacy along Călărașilor.
17. Restaurant terraces/pavilions on Bd. Unirii south side east of the square.
18. Big seismic-risk signs on some Călărașilor houses.
19. Lindens line Bd. Unirii; old chestnuts/robinias on Călărașilor.
20. Construction hoardings around Pasajul Unirii in 2025–26 (slab reconstruction).
21. Heavy congestion at Unirii 08–10 and 17–19, honking taxis.
22. Biserica Hagiu (1872) near Hala Traian on Str. Traian.
23. Sf. Spiridon Nou church on Bd. Cantemir south of the square.
24. Wide grey-paver sidewalks on Bd. Unirii vs narrow cracked ones on Călărașilor.
25. Metro "M" entrances all around Piața Unirii (Unirii 1 & 2).
26. Hanul lui Manuc (inn with wooden galleries) at the north-east edge toward the Old Town.
27. The square is noisy and open — few trees except in the central park.
28. Mega Image in Unirea basement and Hala Traian; Fornetti kiosk on Bd. Unirii.
29. At night: fountains lit, blocks lit by ad screens; Călărașilor dim.
30. Bus stop shelters with STB yellow signs at Bd. Unirii/Mircea Vodă.

## Gaps / to verify

- GTS exact office unit at no. 101 (courtyard building?) unverified; registered seat differs (Str. Frunzei 26)
- Rooftop advertising brands around Piața Unirii not verified
- Current (Nov 2026) state of the Planșeul Unirii works

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
| wp_unirii_sq | https://en.wikipedia.org/wiki/Pia%C8%9Ba_Unirii_(Bucharest) |
| wp_bd_unirii | https://en.wikipedia.org/wiki/Bulevardul_Unirii |
| wp_unirea | https://en.wikipedia.org/wiki/Unirea_Shopping_Center |
| fountains_44 | https://www.antena3.ro/actualitate/celebrele-fantani-din-centrul-capitalei-se-pregatesc-sa-isi-reia-stralucirea-de-altadata-cand-se-487207 |
| fountains_record | https://newsweek.ro/actualitate/foto-fantanile-din-piata-unirii-bucuresti-recunoscute-ca-record-mondial |
| fountains_2025 | https://www.revistabiz.ro/programul-spectacolelor-de-apa-la-fantanile-urbane-din-piata-unirii-incepe-din-23-mai-2025/ |
| fountains_apanova | https://www.bursa.ro/apa-nova-reabiliteaza-fantanile-de-la-unirii-87307434 |
| planseu_2026 | https://www.antena3.ro/actualitate/locale/lucrarile-la-planseul-unirii-intra-in-ultima-etapa-trafic-restrictionat-pe-perioada-verii-ce-trebuie-sa-stie-soferii-790958.html |
| planseu_60pct | https://www.g4media.ro/foto-de-sambata-noi-restrictii-de-trafic-in-piata-unirii-lucrarile-la-planseul-unirii-intra-in-ultima-etapa-de-executie-proiectul-este-realizat-in-proportie-de-peste-60.html |
| planseu_traffic | https://www.wall-street.ro/articol/transporturi-and-infrastructura/ultima-etapa-a-lucrarilor-la-planseul-unirii.html |
| hala_traian_mega | https://www.romania-insider.com/bucharest-city-hall-organizes-call-reconstruction-19th-century-hala-matache |
| hala_traian_zf | https://www.zf.ro/eveniment/sorin-paslaru-zf-piata-matache-piata-1-piata-obor-piata-sudului-22226182 |
| calarasi_200 | https://www.digi24.ro/stiri/actualitate/primaria-vrea-sa-largeasca-calea-calarasilor-pe-care-se-afla-200-de-imobile-protejate-de-lege-879277 |
| gts_job | https://poslovi.infostud.com/poslodavac/global-technical-systems/55637 |
| gts_hermes | https://www.zfenglish.com/companies/global-technical-systems-moves-offices-to-hermes-business-campus-23165494 |
| vice_fountains | https://www.vice.com/ro/article/fantanile-din-bucuresti/ |
