# Bucharest — Unirii & Călărașilor (`unirii`): field research dossier

Role: research-buc-districts · generated 2026-11-06 23:06 UTC · machine-readable twin: `bucharest-unirii.json` · images: `refs/unirii/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Corneliu Coposu, Bulevardul Mircea Vodă, Bulevardul Unirii, Calea Călărașilor, Piața Unirii |
| route_streets_researched | Bulevardul Corneliu Coposu, Bulevardul Mircea Vodă, Bulevardul Unirii, Calea Călărașilor, Piața Unirii |
| fronting_route_buildings | 82 |
| fronting_route_with_height | 61.0 |
| fronting_route_with_colour | 4.9 |
| fronting_route_researched | 3.7 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 98.8 |
| fronting_main_buildings | 449 |
| fronting_main_with_height | 27.2 |
| buildings_total | 3636 |
| buildings_with_height | 33.9 |
| businesses_total | 1101 |
| businesses_on_route | 43 |
| businesses_branded | 142 |
| trees_osm | 5054 |
| lamps_osm | 28 |
| crossings | 277 |
| signal_nodes | 74 |
| transit_stops | 61 |
| metro_entrances | 14 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.423, 26.0975], [44.4365, 26.0975], [44.4365, 26.1205], [44.423, 26.1205]]` → bbox `[44.423, 26.0975, 44.4365, 26.1205]`, area **2.743 km²**.
- Why: Extraction area = world agent bbox from cities.js BUC_DISTRICTS (so every street the world builds is covered). Hexagon ~1.3 km E-W: west edge just past Piața Unirii (Dâmbovița/Splaiul, Dealul Mitropoliei foot), south edge Bd. Unirii + one block (Str. Radu Vodă / Splaiul Unirii quiet), north edge one block past Calea Călărașilor (Str. Popa Soare/Mihăileanu, quiet), east edge Str. Traian + Hala Traian; cut corners (SE Văcărești, NW Lipscani) keep it ≈1.1 km².
- Research-proposed compact ~1 km² polygon (optional tighter cut): `[[44.4238, 26.0995], [44.4238, 26.1135], [44.43, 26.1215], [44.4346, 26.1215], [44.4346, 26.11], [44.43, 26.0995]]`

## Chapter routes

### gts · 2015 — GTS Global Intelligence — Calea Călărașilor

- **Start**: WORLD START: Piața Unirii west side, southbound — `44.426766, 26.100968`, heading 183° on Piața Unirii.
- **End**: Calea Călărașilor 101 (north side) — `44.433256, 26.117583`.
- **Length**: 2237 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Start on the west side of Piața Unirii by the Dâmbovița (Fântâna lui Bucur fountain field on the left, Dealul Mitropoliei ahead) → round the south side → Bd. Unirii east along the median fountain basins (Unirea Shopping Center on the left) → Bd. Mircea Vodă north → Calea Călărașilor east through the listed 1900s merchant-house row to no. 101 (Hala Traian 250 m further on).
- **Sequence**: Piața Unirii (421 m) → Bulevardul Unirii (633 m) → (secondary) (17 m) → Bulevardul Mircea Vodă (665 m) → Bulevardul Corneliu Coposu (32 m) → Calea Călărașilor (469 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.426766, "lon": 26.100968, "road": "Unirii", "bearing": 183}, {"lat": 44.4266, "lon": 26.108, "road": "Bulevardul Unirii", "bearing": 90}, {"lat": 44.43, "lon": 26.1117, "road": "Mircea Vodă", "bearing": 0}, {"lat": 44.4327, "lon": 26.1135, "road": "Călărașilor", "bearing": 90}, {"lat": 44.43325, "lon": 26.11765, "road": "Călărașilor", "bearing": 90}]`

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

- OSM: 13 ways, 3556 m in district, classes primary; lanes values ['2', '3', '4', '5']; one-way segments 13/13; maxspeed ['50', '60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 104, bus 116, bus 117, bus 123, bus 361, bus 385, trolleybus 73.
- OSM trees within 25 m: 1035 (species {'Abies alba': 91, 'Tilia tomentosa': 175, 'Quercus robur': 268, 'Tilia platyphyllos': 58, 'Fraxinus americana': 128, 'Quercus petraea': 59, 'Fraxinus excelsior': 60, 'Thuja orientalis': 73, 'Acer negundo': 7, 'Prunus cerasifera': 23, 'Abies concolor': 3, 'Thuja occidentalis': 23, 'Morus alba': 4, 'Acer tataricum': 2, 'Platanus occidentalis': 4, 'Populus alba': 17, 'Sambucus nigra': 13, 'Ulmus minor': 11}, genus {'Malus': 1}).
- OSM furniture: {'fountain': 113}.
- Fronting buildings: 20; businesses: 23.
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
- **fountains**: see top-level `fountains` (layout, basins, jets, lighting, show schedule)
- **park**: lawns, rose beds, linden & birch groups, benches; the round central fountain basin (OSM n1423222582 "Fântâna lui Bucur")
- **frontage**: E: Unirea Shopping Center (1976, enlarged 1989; 6 levels in OSM, long horizontal facade with ad banners) + Hala Unirii + Parcare Unirea deck; N: Hanul lui Manuc (1808) near NE corner, Old Town edge; S/SW: Dealul Mitropoliei with the Patriarchal Cathedral on the hill, Sf. Spiridon Nou church (Cantemir); 1980s Civic-Centre blocks (8–10 storeys, cream/beige stone-clad, arcaded ground floors, mansard-like roofs) on all corners carrying large rooftop advertising letters/LED screens
- **works_2023_2026**: Since 2023 vehicles >3.5 t are banned on the slab; reconstruction of the Dâmbovița cover started 2024–25 and was in its final stage in summer 2026 (>60 % done, expected end-2026) with restrictions around Pasajul Unirii. Recommendation: model the finished/normal layout (the CV chapter is 2015) and optionally add hoardings at the Pasaj.
- confidence: high (Wikipedia/news) except frontage colours medium [wp_unirii_sq] [wp_unirea] [fountains_44] [fountains_record] [fountains_2025] [planseu_2026] [planseu_60pct] [planseu_traffic]

### Bulevardul Mircea Vodă (chapter route)

- OSM: 20 ways, 1076 m in district, classes secondary, secondary_link; lanes values ['2', '3', '4', '5']; one-way segments 1/20; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 116, bus 117, bus 312, bus 323, bus 385, trolleybus 73.
- OSM trees within 25 m: 37 (species {'Sambucus nigra': 4, 'Tilia platyphyllos': 13, 'Tilia tomentosa': 4, 'Populus alba': 1, 'Ulmus minor': 6, 'Fraxinus americana': 3}, genus —).
- OSM furniture: {'lift_gate': 1, 'gate': 1}.
- Fronting buildings: 14; businesses: 11.
- **cross_section**: two-way 2+2 (3+2 near junctions), 50 km/h, trolleybus 73 wires, buses 116/117/312/323/385
- **frontage**: W: Day Tower (37A, 9 lv, 2018 glass office, Starbucks ground floor), Mercure hotel (28, 12 lv, 2006), Hotel Marina; E: 9-storey 1980s blocks E1/E2 and new 21D Downtown residences (9 lv, 2016), BCR & BRD branches, Sector 3 civil-status office
- confidence: high (OSM) [osm]

### Calea Călărașilor (chapter route)

- OSM: 7 ways, 743 m in district, classes secondary; lanes values ['2', '4']; one-way segments 3/7; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 56; businesses: 18.
- **cross_section**: TWO-WAY 1+1 (≈7–8 m carriageway), 50 km/h, asphalt with patches; cars parked half on the narrow (1.5–2.5 m) sidewalks on both sides; no tram/trolley on this stretch; overhead telecom cables and older concrete lamp poles
- **frontage**: Bucharest's best-preserved row of late-19th/early-20th-c. merchant houses ("case de târgoveț"): 1–2-storey rendered street houses (nos. 78–111 listed LMI B-II-m-B-183xx, built 1900–1920) with tall windows, pilasters, cornices, carriage gates, many shabby or seismic-risk; interspersed with 4–6-storey interwar blocks (no. 105, 1936; 117-119 S+P+4+attic) and a few 1990s infills; >200 legally protected buildings along the street
- **hala_traian**: no. 133 at the Traian corner: Hala Traian (1896) — one of the last two 19th-c. market halls; cream facade with red-brick bands and a big arched window, small shops (red fascia, blue PESCĂRIE) in the front, supermarket inside; Piața Traian open market opposite (south side). Trams stop right at the junction (stop "Hala Traian", platforms with red-white painted kerbs, trolley/tram wires overhead) — photos 2019–2022
- **businesses**: Mega Image (133), Superbet, Farmacia Dona, myGOLD & Tezaur pawn shops, shaorma, pastry shop, car-parts shops, Bulgust, Toka, Tripoli restaurants (OSM)
- confidence: lanes/heritage high (OSM, Digi24); facades medium [osm] [calarasi_200] [hala_traian_mega] [hala_traian_zf]

### Bulevardul Ion Constantin Brătianu

- OSM: 16 ways, 2032 m in district, classes primary; lanes values ['2', '3', '4']; one-way segments 16/16; maxspeed ['50', '60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: central reservation.
- Transit lines (OSM route relations): bus 100, bus 361, bus 381, bus N108, tram 21.
- OSM trees within 25 m: 16 (species {'Prunus persica': 5}, genus —).
- OSM furniture: {'block': 1, 'taxi': 1, 'gate': 2, 'clock': 1}.
- Fronting buildings: 32; businesses: 50.

### Pasajul Unirii

- OSM: 7 ways, 1831 m in district, classes primary; lanes values ['2']; one-way segments 7/7; maxspeed ['40']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 381.
- OSM trees within 25 m: 41 (species {'Robinia pseudoacacia': 1, 'Quercus rubra': 3, 'Tilia tomentosa': 2, 'Quercus robur': 2, 'Fraxinus americana': 11, 'Tilia cordata': 1, 'Prunus cerasifera': 2, 'Pseudotsuga menziesii': 2, 'Rhus typhina': 1, 'Tilia platyphyllos': 1, 'Prunus persica': 9}, genus {'Magnolia': 1}).
- OSM furniture: {'taxi': 1, 'bicycle_parking': 2, 'drinking_water': 2, 'fountain': 27}.
- Fronting buildings: 26; businesses: 26.

### Calea Moșilor

- OSM: 15 ways, 1038 m in district, classes living_street, residential, tertiary; lanes values ['2']; one-way segments 5/15; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: True; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): tram 16, tram 21.
- OSM trees within 25 m: 15 (species {'Prunus persica': 11}, genus —).
- OSM furniture: {'recycling': 1, 'gate': 1}.
- Fronting buildings: 72; businesses: 28.

### Strada Matei Basarab

- OSM: 8 ways, 867 m in district, classes tertiary; lanes values ['2', '3', '4']; one-way segments 3/8; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 22 (species —, genus —).
- OSM furniture: {'lift_gate': 1, 'gate': 2, 'taxi': 1, 'drinking_water': 1}.
- Fronting buildings: 52; businesses: 11.

### Strada Romulus

- OSM: 6 ways, 862 m in district, classes tertiary; lanes values ['2']; one-way segments 5/6; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 5 (species —, genus —).
- Fronting buildings: 59; businesses: 1.

### Strada Nerva Traian

- OSM: 6 ways, 819 m in district, classes secondary; lanes values ['2', '3']; one-way segments 6/6; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): trolleybus 97.
- OSM trees within 25 m: 4 (species {'Morus alba': 1, 'Gleditsia triacanthos': 1, 'Fraxinus excelsior': 1, 'Acer tataricum': 1}, genus —).
- Fronting buildings: 2; businesses: 9.

### Strada Sfânta Vineri

- OSM: 11 ways, 800 m in district, classes living_street, tertiary; lanes values ['1', '2', '3']; one-way segments 3/11; maxspeed ['30', '50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 312, bus 323, bus 385.
- OSM trees within 25 m: 27 (species {'Prunus persica': 22}, genus —).
- OSM furniture: {'fountain': 1}.
- Fronting buildings: 32; businesses: 15.

### Strada Traian

- OSM: 13 ways, 745 m in district, classes tertiary; lanes values ['1', '2']; one-way segments 8/13; maxspeed ['30', '50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): trolleybus 97.
- OSM trees within 25 m: 24 (species {'Thuja orientalis': 5, 'Tilia tomentosa': 2, 'Quercus robur': 1, 'Populus alba': 2, 'Sambucus nigra': 1, 'Juglans regia': 1, 'Fraxinus excelsior': 1}, genus —).
- Fronting buildings: 23; businesses: 14.
- **cross_section**: two-way 1+1 tertiary with trolleybus 97 wires; Hala Traian bus/trolley stop (STB ref 97), tram stop Hala Traian on the cross street; Biserica Hagiu (1872) at no. 142
- confidence: high (OSM) [osm]

### Bulevardul Dimitrie Cantemir

- OSM: 8 ways, 741 m in district, classes primary; lanes values ['2', '3', '5']; one-way segments 8/8; maxspeed ['50']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 116, trolleybus 73, trolleybus 74, trolleybus 76.
- OSM trees within 25 m: 165 (species {'Tilia tomentosa': 40, 'Fraxinus excelsior': 14, 'Carpinus betulus': 3, 'Pinus sylvestris': 3, 'Picea abies': 17, 'Tilia platyphyllos': 6, 'Thuja occidentalis': 7, 'Koelreuteria paniculata': 14, 'Acer pseudoplatanus': 7, 'Prunus persica': 1, 'Salix alba': 3, 'Prunus cerasus': 1, 'Acer tataricum': 4, 'Catalpa bignonioides': 1, 'Robinia pseudoacacia': 2, 'Prunus cerasifera': 2, 'Thuja orientalis': 6, 'Betula pendula': 3, 'Morus alba': 3, 'Chamaecyparis lawsoniana': 11, 'Thuja plicata': 7, 'Pinus strobus': 1, 'MALUS SYLVESTRIS': 1, 'Acer platanoides': 1, 'Abies alba': 2, 'Syringa vulgaris': 1, 'Rhus typhina': 1}, genus {'Fagus': 1, 'Malus': 1}).
- Fronting buildings: 5; businesses: 13.

### Splaiul Unirii

- OSM: 5 ways, 643 m in district, classes secondary; lanes values ['2', '3']; one-way segments 5/5; maxspeed ['60']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 312, tram 23, tram 27.
- OSM trees within 25 m: 137 (species {'Tilia tomentosa': 67, 'Acer saccharinum': 9, 'Fraxinus americana': 12, 'Platanus occidentalis': 13, 'Thuja orientalis': 8, 'Acer negundo': 1, 'Aesculus hippocastanum': 1, 'Ulmus minor': 1, 'Fraxinus excelsior': 5, 'Morus nigra': 1, 'Catalpa bignonioides': 4, 'Prunus armeniaca': 1, 'Thuja plicata': 3, 'Chamaecyparis lawsoniana': 1, 'Prunus cerasifera': 1, 'Acer pseudoplatanus': 1, 'Rhus typhina': 1, 'Abies concolor': 1, 'Abies alba': 1, 'Acer platanoides': 1}, genus {'Paulownia': 3, 'Prunus': 1}).
- OSM furniture: {'block': 1}.
- Fronting buildings: 6; businesses: 13.

### Bulevardul Hristo Botev

- OSM: 4 ways, 609 m in district, classes tertiary; lanes values ['2']; one-way segments 0/4; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 2 (species —, genus —).
- Fronting buildings: 37; businesses: 6.

### Splaiul Independenței

- OSM: 4 ways, 557 m in district, classes primary; lanes values ['3']; one-way segments 4/4; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 104, bus 123, bus 385.
- OSM trees within 25 m: 91 (species {'Tilia tomentosa': 51, 'Platanus occidentalis': 27, 'Thuja occidentalis': 1, 'Koelreuteria paniculata': 2, 'Fraxinus americana': 1}, genus —).
- OSM furniture: {'gate': 2}.
- Fronting buildings: 52; businesses: 18.

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
| w786158568 | Bulevardul Mircea Vodă | E |  | apartments | 3 |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w1576034831 | Bulevardul Mircea Vodă | W |  | construction | 1 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w86134168 | Bulevardul Mircea Vodă | W |  | apartments · Hotel Marina | 3 |  |  |  | unknown (use district rule) | #E2D8C4 est | 2 |
| w304074690 | Bulevardul Mircea Vodă | W | 14 | apartments | 3 |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w82978172 | Bulevardul Mircea Vodă | E |  | yes · Casa Eliad | 2 est |  |  |  | unknown (use district rule) | #D9C3A0 est | 1 |
| w304074692 | Bulevardul Mircea Vodă | W | 12 | apartments | 3 |  |  |  | unknown (use district rule) | #CFC8B8 est | 0 |
| w162494169 | Bulevardul Mircea Vodă | E |  | apartments · Bl. U114 | 3.0 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w162494335 | Bulevardul Mircea Vodă | E |  | apartments | 3.0 est |  |  |  | unknown (use district rule) | #E2D8C4 est | 0 |
| w693861078 | Bulevardul Unirii | S |  | yes · Aici | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 1 |
| w693861084 | Bulevardul Unirii | S |  | yes · Jo Lounge | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w693861081 | Bulevardul Unirii | S |  | yes · Naked Kitchen & Beach Bar | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 1 |
| w693861075 | Bulevardul Unirii | S |  | yes · Altfel | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 1 |
| w693861079 | Bulevardul Unirii | S |  | yes · Moon | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w693861074 | Bulevardul Unirii | S |  | yes · The Clique Bistro | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 1 |
| w787816882 | Bulevardul Unirii | S |  | yes · Exotique Lounge | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w343510267 | Calea Călărașilor | SE |  | yes | 3.0 est |  |  |  | unknown (use district rule) | #D9C3A0 est | 0 |
| w250284622 | Calea Călărașilor | S |  | yes | 2 est |  |  |  | unknown (use district rule) | #D9C3A0 est | 3 |
| w1173133036 | Calea Călărașilor | S | 36 | yes | 4 |  |  |  | unknown (use district rule) | #E2D8C4 est | 0 |
| w1173133035 | Calea Călărașilor | S | 36A | yes | 2.0 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w86038865 | Calea Călărașilor | S |  | retail · Piața Traian | 5 est |  |  |  | unknown (use district rule) | #CFC8B8 est | 1 |
| w1173271578 | Calea Călărașilor | S |  | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w1173271579 | Calea Călărașilor | S | 58 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 0 |
| w1173271581 | Calea Călărașilor | S | 62 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 0 |
| w1173271580 | Calea Călărașilor | S | 60 | yes | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w1173271583 | Calea Călărașilor | S | 78 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w245117583 | Calea Călărașilor | S | 80 | yes | 1 |  | 1910 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #E6CFC0 est | 1 |
| w230400920 | Calea Călărașilor | S | 110 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w187078764 | Calea Călărașilor | N | 57 | apartments | 3 |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w1480407691 | Calea Călărașilor | S |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E8D9BE est | 0 |
| w1480407692 | Calea Călărașilor | S |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #D9C3A0 est | 0 |
| w250285029 | Calea Călărașilor | S | 66 | semidetached_house | 2 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w187078773 | Calea Călărașilor | N | 59 | apartments | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w245117703 | Calea Călărașilor | S | 82 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E6CFC0 est | 0 |
| w236368849 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w245117600 | Calea Călărașilor | S |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w245117584 | Calea Călărașilor | S |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w230288962 | Calea Călărașilor | S | 90 | yes | 1.0 est |  | 1900 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 2 |
| w309372403 | Calea Călărașilor | S |  | hotel | 5 est |  |  |  | unknown (use district rule) | #E2D8C4 est | 0 |
| w236368845 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w236368856 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E8D9BE est | 0 |
| w245117578 | Calea Călărașilor | S |  | semidetached_house | 2 est |  |  |  | unknown (use district rule) | #E6CFC0 est | 0 |
| w236368853 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E6CFC0 est | 0 |
| w1173271582 | Calea Călărașilor | N |  | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w236368860 | Calea Călărașilor | N | 61 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w236368862 | Calea Călărașilor | N | 75 | apartments | 4 |  | 1940 | Non Corresponding Urgency Category | interwar (art deco / modernist) apartment block | #CFC8B8 est | 0 |
| w178704672 | Calea Călărașilor | N |  | apartments | 3 |  |  |  | unknown (use district rule) | #D9D2C3 est | 1 |
| w245117577 | Calea Călărașilor | N | 129 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 0 |
| w236368847 | Calea Călărașilor | N | 67 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 0 |
| w245117545 | Calea Călărașilor | N |  | semidetached_house | 2 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w1464553529 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w245117755 | Calea Călărașilor | N |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w230248621 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E8D9BE est | 1 |
| w1464553528 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E6CFC0 est | 0 |
| w1173271585 | Calea Călărașilor | N | 97 | yes · Casă de târgoveț | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 est | 0 |
| w245117661 | Calea Călărașilor | N | 111 | semidetached_house | 1 |  | 1920 | Non Corresponding Urgency Category | interwar (art deco / modernist) apartment block | #D9D2C3 est | 0 |
| w230288960 | Calea Călărașilor | N | 117-119 | apartments | S+P+4E+Pod |  | 1957 | Seismic Risk Class II | communist-era block (prefab or brick, 1950s-80s) | #D8CDB5 est | 0 |
| w245117629 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w245117717 | Calea Călărașilor | N | 103 | apartments | 2 |  |  |  | low house/villa (19th-early 20th c. likely) | #D9C3A0 est | 1 |
| w245117723 | Calea Călărașilor | N | 109 | semidetached_house | 2 est |  |  |  | unknown (use district rule) | #E6CFC0 est | 0 |
| w230249029 | Calea Călărașilor | N | 85 | apartments | 3 |  |  |  | unknown (use district rule) | #E2D8C4 est | 2 |
| w245117553 | Calea Călărașilor | N | 99 | apartments | S+P |  | 1992 | Seismic Risk Class I | post-1990 building | #C9B99A est | 0 |
| w245117537 | Calea Călărașilor | N | 87 | yes | 2 |  | 1915 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 0 |
| w1480407690 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E3D3B8 est | 0 |
| w1173271584 | Calea Călărașilor | N | 89 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #CFC1A8 est | 0 |
| w1464553527 | Calea Călărașilor | N |  | yes | 2.0 est |  |  |  | unknown (use district rule) | #D9C3A0 est | 0 |
| w1480407689 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
| w245117627 | Calea Călărașilor | N | 91 | yes | 1 |  | 1912 | Non Corresponding Urgency Category | pre-1919 eclectic / neo-romanian house or villa | #D9C3A0 est | 0 |
| w245117586 | Calea Călărașilor | N | 93 | yes | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E8D9BE est | 0 |
| w245117704 | Calea Călărașilor | N | 101 | apartments | 1 |  |  |  | low house/villa (19th-early 20th c. likely) | #E3D3B8 | 0 |
| w1173271586 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E8D9BE est | 0 |
| w245117681 | Calea Călărașilor | N |  | yes | 1.0 est |  |  |  | unknown (use district rule) | #E8D9BE est | 0 |
| w1176579392 | Piața Unirii | N |  | yes |  | 3 |  |  | unknown (use district rule) | #D9C3A0 est | 0 |
| w1176579389 | Piața Unirii | N |  | yes |  | 3 |  |  | unknown (use district rule) | #CFC1A8 est | 0 |
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
| w86038865 | Piața Traian |  | amenity=marketplace | Calea Călărașilor | S |  |
| n2567699408 | Shaormeria Baneasa |  | amenity=fast_food | Calea Călărașilor | S |  |
| n8628418067 | Superbet | Superbet bg #E30613 fg #FFFFFF | shop=bookmaker | Calea Călărașilor | N |  |
| n13456671086 | Tezaur |  | shop=pawnbroker | Calea Călărașilor | S |  |
| n2479038675 | Toka |  | amenity=restaurant | Calea Călărașilor | S | 78 |
| n5396036261 | Trei |  | amenity=restaurant | Calea Călărașilor | N |  |
| n2567699480 | Tripoli |  | amenity=restaurant | Calea Călărașilor | S | 90 |
| n13706032501 | iiana |  | shop=clothes | Calea Călărașilor | N | 103 |
| n9411250630 | Fastprint |  | shop=copyshop | Piața Unirii | S |  |
| n6053541301 | Stephanus |  | shop=books | Piața Unirii | S |  |
| n9999021745 | Synevo |  | healthcare=laboratory | Piața Unirii | S | 1 |
| n327226173 | The Harp |  | amenity=restaurant | Piața Unirii | S | 2 |
| n9411250343 | The Harp Bakery |  | amenity=cafe | Piața Unirii | S | 2 |
| n9411250344 | Trattoria L'Oroscopo |  | amenity=restaurant | Piața Unirii | S | 2 |

Other branded businesses in the district (off-route): Patria Bank (Aleea Dealul Mitropoliei, n9680128525); Patria Bank (Aleea Dealul Mitropoliei, w232296927); Banca Transilvania (Bulevardul Carol I, n932206947); 5 to go (Bulevardul Corneliu Coposu, n10539882353); Alpha Bank (Bulevardul Corneliu Coposu, n2690048045); Banca Transilvania (Bulevardul Corneliu Coposu, n3711838133); Froo (Bulevardul Corneliu Coposu, n7106580120); ING (Bulevardul Corneliu Coposu, n510598710); KFC (Bulevardul Corneliu Coposu, n286860947); MOL (Bulevardul Corneliu Coposu, w670595374); OMV (Bulevardul Corneliu Coposu, w263315803); Patria Bank (Bulevardul Corneliu Coposu, n2690812691); Euronet (Bulevardul Dimitrie Cantemir, n7072636090); Maxbet (Bulevardul Dimitrie Cantemir, n9999021744); 5 to go (Bulevardul Hristo Botev, n9667850805); 5 to go (Bulevardul Ion Constantin Brătianu, n11617982012); 5 to go (Bulevardul Ion Constantin Brătianu, n12851066022); BRD (Bulevardul Ion Constantin Brătianu, n647187505); Banca Transilvania (Bulevardul Ion Constantin Brătianu, n1731040872); Dr. Max (Bulevardul Ion Constantin Brătianu, n3875095827); Euronet (Bulevardul Ion Constantin Brătianu, n7072038765); Luca (Bulevardul Ion Constantin Brătianu, n1731040875); Mega Image (Bulevardul Ion Constantin Brătianu, n3507751793); Raiffeisen Bank (Bulevardul Ion Constantin Brătianu, n1814904459); Ted's Coffee Co. (Bulevardul Ion Constantin Brătianu, n6758629185); Euronet (Bulevardul Nicolae Bălcescu, n7072028924); Banca Transilvania (Bulevardul Octavian Goga, n3711874815); Superbet (Bulevardul Octavian Goga, n8628418193); 5 to go (Bulevardul Regina Elisabeta, n9192608742); BRD (Bulevardul Regina Elisabeta, n1814904311); Luca (Bulevardul Regina Elisabeta, n4467052089); Paul (Bulevardul Regina Elisabeta, n1814904449); Pizza Hut (Bulevardul Regina Elisabeta, n286859702); Starbucks (Bulevardul Regina Elisabeta, n8167866130); Ted's Coffee Co. (Bulevardul Regina Elisabeta, n9668008977); Regina Maria (Bulevardul Regina Maria, n3096589729); Exim Banca Românească (Bulevardul Unirii, n7074349066); First Bank (Bulevardul Unirii, n1563413172); La Doi Pași (Bulevardul Unirii, n14125548801); Shop&Go (Bulevardul Unirii, n10000060582); BCR (Calea Victoriei, n11057114990); First Bank (Calea Victoriei, n1563413163); Gloria Jean's (Intrarea Maximilian Popper, n9420725778); Chopstix (Pasajul Unirii, n6323313080); Euronet (Pasajul Unirii, n7072030137); Luca (Pasajul Unirii, n12269022952); McDonald's (Pasajul Unirii, n125285209); Sephora (Pasajul Unirii, n9255719431); Dr. Max (Piața C. A. Rosetti, n9416312641); BCR (Piața Unirii, n7411821210); Banca Transilvania (Piața Unirii, n3718543194); Catena (Piața Unirii, n6939504485); Dr. Max (Piața Unirii, n6939489489); Fornetti (Piața Unirii, n9159258049); Help Net (Piața Unirii, n6228250431); Luca (Piața Unirii, n4073525677); Luca (Piața Unirii, n7411821211); Inmedio (Piața Universității, n11157791272); Euronet (Splaiul Independenței, n7072094252); ING (Splaiul Independenței, n2454097616); Vodafone (Splaiul Independenței, n9159258050); 5 to go (Splaiul Unirii, n14230343278); Shop&Go (Splaiul Unirii, n14230343280); UniCredit (Splaiul Unirii, n5183790886); Banca Transilvania (Strada Academiei, n3711872239); Cărturești (Strada Academiei, n9240541064); Fornetti (Strada Academiei, n10634730705); Luca (Strada Academiei, n9410316001); Shop&Go (Strada Academiei, n1814904278); Superbet (Strada Anastasie Panu, n9424549167); Froo (Strada Bibescu Vodă, n13503309729); Euronet (Strada Blănari, n7072148316); La Doi Pași (Strada Blănari, n12060738969); DHL (Strada Bălcești, n7942218168); Farmacia Dona (Strada Bărăției, n2690055639); Stanleybet (Strada Bărăției, n12759899758); Catena (Strada Colței, n11617977723); Euronet (Strada Constantin Mille, n7027320837); Leonidas (Strada Doamnei, n12436995130); Hilton Garden Inn (Strada Doamnei, n6162234562); Leonidas (Strada Doamnei, n6053541486); dm (Strada Doamnei, n12759263037); Cărturești (Strada Edgar Quinet, n2538454246); Shop&Go (Strada Edgar Quinet, n7602204605); 5 to go (Strada Halelor, n12269022954); Euronet (Strada Halelor, n7071986524); Starbucks (Strada Halelor, n3578133327); Superbet (Strada Halelor, n8628417559); dm (Strada Halelor, n3748890801); Banca Transilvania (Strada Lipscani, n3711811990); UniCredit (Strada Lipscani, n7106680234); 5 to go (Strada Matei Basarab, n12493379679); ING (Strada Negru Vodă, n8478282369); Garanti (Strada Nerva Traian, n807099753); ING (Strada Nerva Traian, n1215409043); Segafredo (Strada Nerva Traian, n1960132008); Superbet (Strada Patriei, n8628417649); Telekom (Strada Patriei, n2451994413); Mega Image (Strada Prof. Dr. Mihail Georgescu, w86038763); Carrefour Express (Strada Sfinții Apostoli, n10690413105); Opticris (Strada Sfinții Apostoli, n4549705871); Patria Bank (Strada Sfânta Ecaterina, w79641030); Annabella (Strada Sfânta Vineri, n9990622882); Berezka (Strada Sfânta Vineri, n4997248581); Euronet (Strada Sfânta Vineri, n7071986573); Garanti (Strada Sfânta Vineri, n2690812695); Patria Bank (Strada Sfânta Vineri, n4997248609); Shop&Go (Strada Sfânta Vineri, n6945449587); Shop&Go (Strada Sfânta Vineri, n13276538913); Dr. Max (Strada Slănic, n6053541828); CEC Bank (Strada Traian, n6279013986); Euronet (Strada Traian, n7072094253); Patria Bank (Strada Traian, n7080689383); CEC Bank (Strada Vasile Adamache, n1439641536); BCR (, n286859155); BCR (, n9999253977); Banca Transilvania (, n1814941239); Carrefour (, w405564542); Cărturești (, n3355049764); Douglas (, n9336831437); Dristor Kebap (, n9999146569); Dristor Kebap (, n10015209218); Dristor Kebap (, n1731040881); Euronet (, n7071972917); Euronet (, n7072038767); Euronet (, n7072148314); Euronet (, n7072148318); Euronet (, n9999072877); Euronet (, n10775253391); Mega Image (, n1439628129); Raiffeisen Bank (, n10000060581); Shop&Go (, n7613013081); Starbucks (, n10775260925); Superbet (, n8628417910); UniCredit (, n2757850673); UniCredit (, n7080689121).

## Transit

- Lines with OSM route relations touching the district: bus 100, bus 104, bus 116, bus 117, bus 122, bus 123, bus 137, bus 311, bus 312, bus 323, bus 361, bus 381, bus 385, bus N108, bus None, tram 7, tram 16, tram 19, tram 21, tram 23, tram 27, tram 32, tram 47, trolleybus 61, trolleybus 66, trolleybus 69, trolleybus 70, trolleybus 73, trolleybus 74, trolleybus 76, trolleybus 85, trolleybus 90, trolleybus 97.
- Stops: Alexandru Sihleanu (tram); Bd. Octavian Goga (platform); Bd. Octavian Goga (tram); Bd. Unirii (bus); Bd. Unirii (platform); Biblioteca Națională a României (bus); Bulevardul I.C. Brătianu (bus); Hala Traian (tram); Hristo Botev (bus); Hristo Botev (tram); Matei Basarab (bus); Matei Basarab (platform); Mircea Vodă (bus); Mântuleasa (tram); Nerva Traian (tram); Piata sf. Gheorghe (bus); Piața Corneliu Coposu (tram); Piața Rosetti (bus); Piața Rosetti (bus/trolleybus); Piața Sf. Gheorghe (bus); Piața Sf. Gheorghe (platform); Piața Sf. Gheorghe (tram); Piața Sfânta Vineri (bus); Piața Sfânta Vineri (bus/tram); Piața Sfântul Gheorghe (bus); Piața Sfântul Gheorghe (tram); Piața Sfântul Ștefan (tram); Piața Unirii (bus); Piața Unirii (bus/trolleybus); Piața Unirii (platform); Piața Unirii (tram); Piața Unirii 1 (bus); Piața Unirii 2 (bus); Piața Unirii 3 (bus); Piața Unirii 4 (bus); Piața Unirii 5 (bus); Sfânta Vineri (bus); Teatrul Național (bus/trolleybus); Traian (bus); Universitate (bus); Universitate (bus/trolleybus); Universitate (trolleybus).
- Metro entrances: Piața Unirii 2 D (44.42754, 26.10421); Piața Unirii 2 C (44.42907, 26.10304); Piața Unirii 2 D (44.42809, 26.10415); Piața Unirii 1 B (44.42837, 26.10103); Piața Unirii 1 B (44.42815, 26.10101); Piața Unirii 1 A (44.42560, 26.10370); Piața Unirii 2  (44.42804, 26.10354); Piața Unirii 2 C (44.42905, 26.10329); Piața Unirii 1  (44.42597, 26.10337); Teatrul Național  (44.43589, 26.10275); Muzeul de istorie  (44.43511, 26.10224); Spitalul Colțea  (44.43535, 26.10300); Teatrul Național  (44.43594, 26.10255); Universitate  (44.43565, 26.10198).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Fountains (Piața Unirii & Bd. Unirii) — layout, jets, lighting, show

44 independent, individually controllable fountains along almost 1.4 km of Bd. Unirii + Piața Unirii, ≈16,200 m² of water surface; built late 1980s (Civic Centre), rehabilitated by Apa Nova with the city for ≈€7 M and reopened Sept 2018 with a digitally controlled water-music-light system; certified 2019 by the World Record Academy as the longest synchronised choreographed fountain array. OSM maps 45 basins in the extraction area (10 on Bd. Unirii west of the square, 25 in the square, 10 east) — matching the official 44 + the small amenity=fountain w413969309. [fountains_44] [fountains_record] [fountains_cost] [fountains_bucharest_ro] [fountains_agir] [fountains_2025] [fountains_2100] [fountains_mediafax_45min] [fountains_ro_insider_2023] [fountains_drones] [fountains_dismantle] [fountains_until_june] [planseu_2026] [osm]

- **square**: symmetric field centred on the round central fountain (OSM node "Fântâna lui Bucur", 44.42678, 26.10246) in the middle of the park: two rows (N and S of the Bd. Unirii axis) of large rectangular basins ~48×35 m (≈1,000 m² each, w1128204286/287/292/293) flanked by ~34×31 m basins (≈630 m²) and ~31×18 m end basins (≈450 m²), separated by paved promenades; thin 1–2 m wide water channels (w1176142645 etc.) link them; basins are shallow (OSM height 0.4 m rim) with grey stone/concrete coping
- **boulevard**: a single line of basins in the central reservation of Bd. Unirii, alternating long 28×7 m basins (~11 jet nodes each) and short 13×6 m basins (~3 jets) at ≈37 m pitch, running west towards Piața Constituției/the Parliament and east to ≈26.110 (Bd. Mircea Vodă); lawns, low hedges and linden rows either side of the basins
- **OSM summary**: {"boulevard_west": {"basins": 10, "area_m2": 888, "jet_nodes": 58}, "square": {"basins": 25, "area_m2": 8998, "jet_nodes": 248}, "boulevard_east": {"basins": 10, "area_m2": 892, "jet_nodes": 68}}; jet/nozzle nodes mapped: 374 (positions in JSON `fountains.layout.basins[]` + OSM amenity=fountain nodes).
- **jets**: per basin: lines of vertical jets in the long basins, central tall jet + ring in the large square basins, arching/rotating "Vario" jet groups; ~374 jet/nozzle points mapped as amenity=fountain nodes in OSM (use as nozzle positions); show jets reach ~10–15 m in the square (estimate from photos; no official figure found), boulevard jets 2–6 m
- **lighting**: underwater RGB LED projectors in every basin; colour-cycling on show nights, static white/blue after sunset otherwise; street lamps + ad screens around the square add warm/white light
- **show.name**: Simfonia Apei (Water Symphony)
- **show.season**: May → end of September (2025: 23 May – 28 Sept, weekly)
- **show.days**: Friday–Sunday
- **show.start**: 21:00 (21:30 in June/July in some seasons)
- **show.duration_min**: 45
- **show.content**: water choreography synchronised to music (themes change yearly — 2024 film themes; special editions with drone shows, e.g. Olympic tribute) + lights; crowds of families line the basins, ~200,000 spectators over the first 70 shows
- **show.game_rule**: if local time is Fri–Sun, May–Sept, 21:00–21:45 → run the show (jets animate to music, LEDs cycle); otherwise jets run in a calm daytime pattern 10:00–23:00 and are off at night/in winter (basins drained Nov–Apr).
- **median (review 2026-11-12, OSM API + Street View at Bd. Unirii 30)**: the boulevard basins stand in the middle of a grass median about 8.9 m wide (OSM natural=grassland strips either side of each basin wall, e.g. w1177070488 / w1177070489; basin 6 m wide, granite wall 0.4 m high, a narrow grass strip and a kerb between wall and carriageway; shrubs and small trees between basins). The boulevard is symmetric about the basin axis: mapped kerbs in the square at ±14.3 m, roadside tree rows at ±14–16 m, so each carriageway is about 10 m. The carriageway centrelines are mapped less exactly (17.4–18.4 m apart, up to 1.2 m off the basin axis; w87716894 sits about 1.7 m too close at the east end). Both carriageways are oneway with sidewalk=right: no pavement on the median side. The game centres each median basin between the carriageways as built. The four carriageways beside the basins (w87716894, w450554042, w4276104, w153967344) carry reviewed widths in the JSON twin (`road_widths`: 9.5 m for the 3-lane ones, an estimate from median edge to tree row; inner kerb placed 4.45 m from the basin axis), which gives a median of 8.5–9.3 m from the square to x = -1130 m and at the east end; west of that the mapped centrelines converge and the median narrows to 6.8 m
- **status 2025–26**: The 2025 season was cut short: shows only until the end of June 2025, then the fountains in the square were decommissioned for the Planșeul Unirii slab reconstruction (final stage summer 2026, completion expected end-2026). For the 2015 chapter / free drive render the full working fountains.
- confidence: counts/length/area/record/schedule high (news, World Record Academy via press); jet heights & LED details medium–low

| basin OSM | group | lat, lon | area m² | E-W × N-S m | jet nodes |
|---|---|---|---|---|---|
| w1177042946 | boulevard_west | 44.427072, 26.096125 | 127 | 28 × 7 | 10 |
| w1020561055 | boulevard_west | 44.42911, 26.096386 | 74 | 14 × 7 | 1 |
| w1177023237 | boulevard_west | 44.427054, 26.096573 | 58 | 13 × 6 | 3 |
| w198130706 | boulevard_west | 44.429078, 26.096751 | 74 | 14 × 7 | 2 |
| w1177042943 | boulevard_west | 44.42703, 26.097034 | 127 | 28 × 7 | 11 |
| w1177023234 | boulevard_west | 44.42701, 26.097491 | 58 | 13 × 6 | 3 |
| w1177038230 | boulevard_west | 44.426988, 26.097955 | 127 | 28 × 7 | 11 |
| w1177023231 | boulevard_west | 44.426967, 26.098405 | 58 | 13 × 6 | 3 |
| w1177038227 | boulevard_west | 44.426948, 26.09887 | 127 | 28 × 7 | 11 |
| w1177023228 | boulevard_west | 44.426928, 26.099316 | 58 | 13 × 6 | 3 |
| w1177038224 | square | 44.426903, 26.099778 | 127 | 28 × 7 | 11 |
| w1177023225 | square | 44.426884, 26.100229 | 58 | 13 × 6 | 3 |
| w1128204284 | square | 44.426618, 26.101305 | 457 | 30 × 19 | 14 |
| w1176581103 | square | 44.427048, 26.10134 | 444 | 31 × 16 | 14 |
| w1177667553 | square | 44.426829, 26.10136 | 127 | 28 × 7 | 11 |
| w1176128444 | square | 44.426582, 26.101552 | 9 | 1 × 14 | 2 |
| w1176581104 | square | 44.427077, 26.101607 | 9 | 2 × 14 | 1 |
| w1176969066 | square | 44.426811, 26.101756 | 58 | 13 × 6 | 7 |
| w1128204285 | square | 44.426525, 26.101761 | 637 | 34 × 31 | 7 |
| w1176591248 | square | 44.427087, 26.101819 | 631 | 34 × 30 | 7 |
| w1128204286 | square | 44.42635, 26.102088 | 1013 | 48 × 39 | 18 |
| w1128204292 | square | 44.42726, 26.102171 | 984 | 49 × 33 | 20 |
| w1176142645 | square | 44.42627, 26.102403 | 13 | 2 × 24 | 12 |
| w1176591246 | square | 44.427324, 26.102505 | 15 | 2 × 23 | 12 |
| w1128204287 | square | 44.426311, 26.102744 | 1022 | 48 × 35 | 16 |
| w1128204293 | square | 44.427221, 26.102829 | 979 | 48 × 38 | 27 |
| w1128204288 | square | 44.426474, 26.10309 | 636 | 34 × 31 | 7 |
| w1176632036 | square | 44.427027, 26.103136 | 629 | 33 × 32 | 7 |
| w1176969064 | square | 44.426746, 26.103144 | 58 | 13 × 6 | 8 |
| w1176576623 | square | 44.426501, 26.103301 | 7 | 1 × 14 | 1 |
| w1176632035 | square | 44.426999, 26.103344 | 9 | 1 × 15 | 1 |
| w1176969065 | square | 44.426725, 26.103534 | 127 | 28 × 7 | 11 |
| w1128204289 | square | 44.426513, 26.103549 | 486 | 33 × 16 | 14 |
| w1176632037 | square | 44.426937, 26.103561 | 405 | 27 × 19 | 14 |
| w1177026767 | square | 44.426693, 26.10445 | 58 | 13 × 6 | 3 |
| w1177038207 | boulevard_east | 44.426665, 26.105009 | 127 | 28 × 7 | 11 |
| w413969309 | boulevard_east | 44.426899, 26.105118 | 25 | 6 × 6 | 0 |
| w1177026770 | boulevard_east | 44.42664, 26.105572 | 58 | 13 × 6 | 3 |
| w1177038210 | boulevard_east | 44.426606, 26.106177 | 127 | 28 × 7 | 11 |
| w1177038202 | boulevard_east | 44.426585, 26.106751 | 58 | 13 × 6 | 3 |
| w1177038213 | boulevard_east | 44.426556, 26.107322 | 127 | 28 × 7 | 12 |
| w1177026776 | boulevard_east | 44.426532, 26.107892 | 58 | 13 × 6 | 3 |
| w1177038216 | boulevard_east | 44.426508, 26.108468 | 127 | 28 × 7 | 11 |
| w1177026773 | boulevard_east | 44.426482, 26.10906 | 58 | 13 × 6 | 3 |
| w1177038219 | boulevard_east | 44.426452, 26.109662 | 127 | 28 × 7 | 11 |

## Dialogue (district pedestrians)

Each line {text (original language), en (English)}; persona.lang = language of text; `base` refers to bucharest-spots.json dialogue_general.persona_library; categories greeting / bumped / photographed / idle / district (place-specific facts, all consistent with this dossier). Shared: bucharest-spots.json → dialogue_general.pedestrian_general (honked_at, near_miss, sidewalk_parking, idle, small_talk) applies to every district pedestrian. Total district lines: 65.

### Familia Popescu (fountain show) (`fountain_family`, local, lang ro, 30-45 + kids) — 17 lines
Parents with two kids waiting for the evening water show on Bd. Unirii.

- *greeting*: „Bună seara!” (Good evening!) · „Ați venit și dumneavoastră la fântâni?” (Did you come for the fountains too?) · „Salut! Începe la nouă?” (Hi! Does it start at nine?)
- *bumped*: „Ai grijă la copii!” (Watch out for the kids!) · „Hopa, era să cad în fântână!” (Whoa, I nearly fell in the fountain!) · „Ușurel, e lume multă.” (Easy, it's crowded.)
- *photographed*: „Prinde jeturile în spate!” (Get the jets behind us!) · „Stai să se aprindă luminile!” (Wait for the lights to come on!) · „Încă una, a clipit cel mic.” (One more, the little one blinked.)
- *idle*: „Am adus și sucuri pentru copii.” (We brought juice for the kids.) · „Era mai frumos înainte de lucrări.” (It was nicer before the works.) · „Hai să găsim o bancă.” (Let's find a bench.)
- *district*: „Spectacolul ține vreo trei sferturi de oră.” (The show lasts about three-quarters of an hour.) · „Sunt peste patruzeci de fântâni, pe aproape un kilometru și jumătate.” (There are over forty fountains along almost a kilometre and a half.) · „Au intrat în Cartea Recordurilor, cică.” (They say they're in the record books.) · „Muzica e de film anul ăsta.” (The music is film themes this year.) · „Cel mic vrea să bage mâna în apă!” (The little one wants to put his hand in the water!)

### Tom (visitor from Manchester) (`uk_tourist`, tourist, lang en, 25-40) — 16 lines
Weekend city-breaker with a phone gimbal; first time in Bucharest.

- *greeting*: „Hiya!” · „Excuse me, is this Unirii Square?” · „Bună! Did I say that right?”
- *bumped*: „Oops, sorry mate!” · „My fault, wasn't looking.” · „Steady on!”
- *photographed*: „Cheers! Get the Palace in the back?” · „Can you do one with the fountains lit?” · „Brilliant, thanks!”
- *idle*: „The traffic here is mental.” · „Is the mall still open?” · „Where do I get a metro card?”
- *district*: „These fountains go on forever.” · „Is that the Parliament at the end of the boulevard?” · „Someone said Old Town is just behind Manuc's Inn.” · „The taxi drivers here honk like it's a sport.”

### Nea Costel (Piața Traian stall) (`market_vendor`, vendor, lang ro, 50-70) — 16 lines
Sells vegetables at the Traian market opposite Hala Traian; jovial, haggles for fun.

- *greeting*: „Hai la roșii, hai la roșii bune!” (Come get tomatoes, good tomatoes!) · „Bună ziua, ce vă pun?” (Good day, what can I get you?) · „Să trăiți! Gustați un castravete!” (Hello there! Taste a cucumber!)
- *bumped*: „Ai grijă la lădițe!” (Mind the crates!) · „Hopa, că-mi răstorni cartofii!” (Whoa, you'll knock my potatoes over!) · „Nu-i bai, nu s-a stricat nimic.” (No worries, nothing's broken.)
- *photographed*: „Fă-le poză la roșii, că-s de la țară!” (Photograph the tomatoes, they're from the countryside!) · „Mă pui în ziar?” (Am I going in the paper?) · „Stai să-mi pun șapca!” (Wait, let me put my cap on!)
- *idle*: „Azi e lume puțină.” (Not many people today.) · „Hala a devenit Mega Image, ce să-i faci.” (The market hall became a Mega Image, what can you do.) · „La prânz se strânge lumea.” (People come at lunch.)
- *district*: „Hala Traian e din 1896, domnule!” (Hala Traian is from 1896, sir!) · „Pe Călărași parcarea e o loterie.” (Parking on Călărași is a lottery.) · „Casele astea vechi sunt toate monument.” (These old houses are all listed.) · „Pe Traian trece troleibuzul, nu pe Călărași.” (The trolleybus runs on Traian, not on Călărași.)

### Doamna Elena (Calea Călărașilor resident) (`calarasi_elder`, local, lang ro, 70-85) — 16 lines
Has lived in a listed merchant house on Calea Călărașilor all her life.

- *greeting*: „Bună ziua, tinere.” (Good day, young man.) · „Ziua bună!” (Good day!) · „Căutați pe cineva?” (Looking for someone?)
- *bumped*: „Vai de mine, atenție!” (Oh my, careful!) · „Mergeți mai încet, vă rog.” (Walk more slowly, please.) · „Trotuarul e plin de mașini, n-ai pe unde merge.” (The sidewalk is full of cars, there's nowhere to walk.)
- *photographed*: „Pe mine? Lasă, fă-i poză casei!” (Me? Never mind, photograph the house!) · „Casa asta e din 1910.” (This house is from 1910.) · „Nu mă mai fotografiați, că-s nearanjată.” (Don't photograph me, I'm not done up.)
- *idle*: „Pe vremuri aici erau prăvălii.” (In the old days there were shops here.) · „Au vrut să lărgească strada, dar n-au lăsat.” (They wanted to widen the street, but it was stopped.) · „Mă duc la Hală după pâine.” (I'm going to the Hall for bread.)
- *district*: „Pe Călărași sunt peste două sute de case vechi protejate.” (There are over two hundred protected old houses on Călărași.) · „Seara e liniște, doar tramvaiul pe Traian.” (Evenings are quiet, just the tram on Traian.) · „La cutremur din '77 a tremurat tot.” (In the '77 earthquake everything shook.) · „Biserica Hagiu e chiar după colț.” (Hagiu church is right round the corner.)

Culture notes:

- **Register** — "Bună ziua" with strangers, "Salut/Neața" among young people; "dumneavoastră" (formal you) to older people; "Mersi" is as common as "Mulțumesc". (https://en.wikivoyage.org/wiki/Romanian_phrasebook)
- **Traffic temper** — Bucharest drivers honk readily and often do not stop at zebras; pedestrians answer with sarcasm rather than aggression — keep lines teasing, not violent. (https://en.wikivoyage.org/wiki/Bucharest#Stay_safe)
- **Sidewalk parking** — Cars parked on sidewalks are a constant pedestrian complaint; a natural topic for bumped/idle lines in side streets. (https://en.wikivoyage.org/wiki/Bucharest#Get_around)
- **Taxis at the airport** — At OTP passengers order licensed taxis from touch-screen kiosks in Arrivals; unsolicited offers are a known nuisance — staff lines should point to the kiosks. (https://www.inyourpocket.com/bucharest/The-Definitive-Guide-to-Finding-a-Taxi-at-Bucharest-Airport_74243f)
- **No stereotypes** — Personas are defined by role/place (student, vendor, commuter), never by ethnicity; Roma, Moldovan or diaspora characters are not caricatured; humour targets traffic, weather, parking and the metro. (spec 20 (game/research) requirement)
- **Shared library** — Generic personas (local_elder, tour_guide …) and the pedestrian_general set (honked_at, near_miss, sidewalk_parking) live in bucharest-spots.json → dialogue_general; district personas below add place-specific lines. (game/research/bucharest-spots.json)

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
2. Fountains continue as a long chain of alternating long/short basins in the Bd. Unirii median; the square has big rectangular basins around a round central fountain; Simfonia Apei shows Fri–Sun 21:00 May–Sept.
3. Bd. Unirii = 1980s Champs-Élysées copy: uniform 8–10-storey cream/ochre blocks with arcades and decorative rooflines; Palace of the Parliament closes the vista west.
4. Bd. Unirii carriageways are one-way 3-lane each side of the fountain median.
5. Rooftop advertising letters and LED screens on the blocks around Piața Unirii.
6. Unirea Shopping Center: long 1970s facade with brand banners, partly empty windows on the north side.
7. Dealul Mitropoliei with the Patriarchal Cathedral visible from the square.
8. Calea Călărașilor is a narrow TWO-WAY street, nothing like a boulevard.
9. Calea Călărașilor is lined by low 1900–1920 merchant houses (listed), many shabby, with a few 1930s 6-storey blocks.
10. Cars parked on the sidewalks of Calea Călărașilor; loose overhead cables.
11. Hala Traian (1896): cream facade striped with red brick, big arched window, small shop fascias; supermarket inside.
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

## Fidelity pass 2026-11-12 — live OSM re-validation (lane `unirii`)

Source: OpenStreetMap API 0.6 map calls of 2026-11-12 over 44.4198,26.0976 – 44.4356,26.1210 (© OpenStreetMap contributors,
ODbL), compared with `game/data/bucharest-unirii.json` (generated 2026-11-09) and with game renders at the `unr-*` viewpoints
in `game/dev/reality/viewpoints.json`. "Inside" = inside the exact playable geometry (`district.geometry`).
The first round had no street-level imagery (verdicts from OSM, plans and renders); the street-level comparison done in
round 2 is at the end of this section.

### Structures (bridges, underpasses, passages)

| OSM | what | game | verdict |
|---|---|---|---|
| w241368617, w241368618, w1383050305 | Pasajul Unirii, `tunnel=yes layer=-1 maxheight=3.5`, 2 lanes each way, 44.42962,26.10357 → 44.42481,26.10405 | three tunnel roads at layer −1, open ramps in a walled trench at both ends, a covered box under the square | match (levels, extent); interior finish not checked |
| w43898061 | Dâmbovița under the square, `tunnel=yes layer=-3`, 44.42881,26.10107 → 44.42608,26.10438 | not visible: the square is continuous over it; the open channel starts / ends at the mapped tunnel ends | match |
| w79870041, w826403112, w1478497247 | covered forecourt lanes of the Coposu fuel station (`covered=yes maxheight=4.25`) | reviewed covered road under the canopy | match |
| w231671712 | footbridge `bridge=yes layer=1`, 13 m, between the Unirea car park (w184169515) and the Carrefour building (w405564542), 44.42873,26.10576 → 44.42867,26.10562 | absent | **missing** (its form is unknown without a street-level look: not built) |
| w533137833, w533137834, w737802918, w740314410, w776448464, w1518548736…39, w1519547524/26, w1520124741/49/53, w1520220670, w1520593143, w737802926, w1476540742 | pedestrian subways and stairs of the Piața Unirii 1 / 2 metro stations (`tunnel=yes layer=-1/-2`) | not modelled (entrances are POIs) | by design: the game has no pedestrian underground |
| w237628815, w304275386, w658176196, w658009188/90, w658267308, w1574342598, w733578958, w1106897137, w658258526 | Old Town foot passages (Pasajul Latin, Gabroveni, Hanul cu Tei, Sf. Gheorghe Nou) and two building passages on footways | not modelled (footways are not in the data) | open, low visibility from the carriageways |
| w241369341, w241369588, w241369345, w899314658 | Pasajul Mărășești (road + tram underpass), 44.4237,26.1124 — 600 m outside the playable area | scenery street at grade | not checked (scenery ring) |

### Water

- **Dâmbovița, open sections** (polygons w174990751 west of the square, w174991904 east): drawn as the sunken concrete channel
  (water ≈ 4.4 m below the quays, battered wall, service bank, parapet + railing). Defect found and fixed in this pass: the
  aerial green raster painted grass cells over the channel (crowns overhanging the water were measured as green ground), which
  floated as green slabs above the river on both sides of the square. `world.js` now skips green cells whose centre is in a
  mapped water polygon (all districts). Verified on `unr-top-river-east`, `unr-top-river-west`, `unr-river-east`, `unr-river-west`.
- **Weirs** w1434558024 (44.42606,26.10458, at the outfall east of the square) and w1434558023 (44.42366,26.10951): not drawn.
- **Fountain field**: all 31 basin polygons of the square and the Bd. Unirii median inside / beside the playable area are
  present with their OSM outlines, plus the two relations of the round centre (r19943684, r19943685, "Fântâna lui Bucur",
  n1423222582, monument w1176896690). Not in the data: the six ≈ 0.6 m wide jet slits between basins (w1176128444,
  w1176142645, w1176576623, w1176581104, w1176591246, w1176632035).
- **Fountains mapped only as `amenity=fountain` ways** (no `natural=water`) are dropped by the builder and missing:
  w413969309 (Ø 6 m, 44.42690,26.10512, north sidewalk of Bd. Unirii by Unirea), w608657873 (Ø 8 m, 44.43414,26.11631, Piața
  Sfântul Ștefan), w1474406316 (44.43491,26.10395, Colțea). The three Colțea park basins w1180500523, w1180500524, w1180503225
  (`natural=water`, 44.4341–44.4345, 26.1034–26.1037) are also missing from the data.
- **Planșeul Unirii works (documented exception)**: live OSM has Bd. Unirii through the square as `highway=construction
  access=no` (w153967343, w228997261, checked 2026-05-28) and the north half of the park as `landuse=construction`
  (w1408424765 "Zona de lucrări consolidare Planșeu Unirii"); the game keeps the working fountain field and lawn of the
  2015 chapter (see "Fountains" above) and has no carriageway through the fountain field.

### Sports and play

Pitches w412096075 (artificial turf, 44.43047,26.11164) and w787971672 (44.42998,26.11096) by the school on Str. Matei Basarab
are present with markings (`unr-top-pitches`); w411424158 and w788040235 further east are present in the scenery ring. The
block of courts at 44.4255,26.1165 (w1188316462, w1431737648…53: three tennis, basketball, two volleyball) is 500 m outside
the playable area and is not in the data. Playgrounds n7958996084 (44.42468,26.10324) and n5766022623 (44.43433,26.11637) are
nodes and are not drawn.

### Tourist features

39 mapped inside the playable area: 28 are POIs, 5 exist as their building only, 6 are not in the data — wayside crosses
n2079451985 "Troița Mântuirii Neamului" (44.42795,26.10300) and n9411250345 "Cruce de piatră" (44.42586,26.10053), plaques
n13197997354 and n7128900791, an unnamed artwork n7849534785 (44.42298,26.10365).

- **Hanul lui Manuc** (r19803024, `building:colour=white`, `roof:shape=hipped`, `roof:colour=brown`, 2 levels, courtyard):
  the tagged white came out ochre because pale tagged colours were mixed 85 % towards the style palette. A literal
  `building:colour` in the retained source tags now wins (`world.js`); render `unr-manuc`: white walls, brown hipped roof,
  open courtyard (`unr-top-manuc`). The wooden galleries of the courtyard are not modelled.
- **Unirea Shopping Center** (w23492027): the landmark model replaced the source building and with it every tenant fascia.
  The landmark now keeps the unit signs of the nine businesses OSM maps in it (McDonald's, Chopstix, Luca, Megapan, Sephora,
  Douglas, Mega Image, First Bank, a bubble-tea counter); renders `unr-unirea-nw`, `unr-unirea-mid`. H&M (n1814949000) stays a
  vacant unit; "Koton" (n6323283871) is `shop=vacant` in OSM and is not shown.
- **Unirea car park** (w184169515, OSM `amenity=parking parking=multi-storey`, 10 levels, name "Parcare Unirea"): drawn as a
  windowed block signed "Spălătorie Unirea Etaj 7" (the car wash on its 7th floor, n1439628129, has no `level` tag). Wrong
  type and wrong sign; needs a builder rule (multi-storey car parks; a business named for an upper floor is not a street sign).
- **Hala Traian** (w35147215) is the landmark model; it and its shops stand 13–45 m outside the playable edge, so Mega Image
  (n1890565824), Superbet (n8628418067), Farmacia Dona (n10539907931), Tezaur (n13456671086), myGOLD (n13456671089), Megapan
  (n3144454751), Fortuna (n10539907930), 5 to go (n13456671090), Pharma Plant (n3873157367) and the tram stop "Hala Traian"
  (n11360886995) are not in the data.
- **Dealul Mitropoliei**: the game world is flat; the hill (≈ 15 m) is not modelled.

### Businesses

238 named OSM businesses inside the playable area: 223 have a game POI of the same name / brand within 40 m; the other 15 are
in categories the builder does not draw (craft, healthcare, generic offices, holiday apartments, `shop=vacant`, the Piața
Traian marketplace polygon). No game business POI is absent from live OSM except four ATMs drawn as bank markers (Euronet
×3, "Bitcoin ATM - Shitcoins.club"). 120 more businesses stand within 60 m outside the playable edge, on frontages that are
visible from the playable streets, and are not in the data because the builder keeps POIs only inside the edge; the largest
clusters are Hala Traian (above), the north side of Str. Halelor / Hanul lui Manuc (5 to go n12269022954, Kiss Tea
n12269022955, Starbucks n3578133327, restaurant Hanu' lui Manuc n2486324769), the west side of the square at Splaiul
Independenței (Catena n6939504485, Luca n4073525677, Vodafone n9159258050, MEI n2455062365, Carrefour Express n10690413105),
and the Old Town streets off Bd. I.C. Brătianu. Full list with distances: `businesses-gamediff.json` → `bucharest-unirii.missing`
(`edgeM`). Five more disused units inside the playable area were added to `closed` (Subway n5157603013, Uncle John
n9410330827, a pharmacy n6262384181, two unnamed shops n3875095826, n5686059121).

### Transit

Every bus / tram stop and metro entrance mapped inside the playable area is in the data (7 entrances of Piața Unirii 1 / 2).
Just outside the edge and missing: metro entrances "Piața Unirii 1 B" n5172764451 (5 m out, 44.42815,26.10101) and
n5172764450 (30 m), bus stop "Piața Unirii" n1668620625 (4 m), "Hristo Botev" n5235082193 (1 m).
Tram: live OSM has running track (`railway=tram`) only at the Piața Unirii terminus, Sf. Gheorghe and Bd. Cantemir; the track
on Bd. Corneliu Coposu is `railway=disused` and the Calea Călărașilor line is `railway=construction` ("lot 1", progress 1 %
on 2026-10-03, opening 2029) while its stops are still mapped as `railway=tram_stop`. The game matches: disused rails in the
Coposu carriageway, no track on Călărașilor, stops shown.

### Street-level comparison, round 2 (2026-11-12)

Panoramas were looked at in the browser only (nothing saved); dates as shown by the provider. Seen:

- **Pasajul Unirii** (south ramp from Bd. Cantemir, May 2024; north ramp; interior): both carriageways run in one walled
  trench with a row of concrete planters between them; the ramp walls are clad in dark grey perforated metal with green leaf,
  flower and butterfly motifs and rise well above street level as a screen; a "PASAJUL UNIRII" header over the portal; inside,
  pale mesh wall panels with yellow accent panels, a continuous light line along the wall head, a dark mesh ceiling and a
  raised kerb walkway. Game after this round: dark ramp walls, pale interior walls with yellow panels and a light line
  (`unr-pasaj-south`, `unr-pasaj-inside`). Still different: no motifs, no portal lettering, no planter median, 1 m parapet
  instead of the tall screen.
- **Dâmbovița quays** (Splaiul Unirii east of the square; Splaiul Independenței west): open channel, water roughly 2.5–3 m
  below the quay, no solid parapet — an iron balustrade on a low stone kerb (dark ornamental panels east, plain green railing
  west), grass strip and plane trees on the quay, sloped concrete far bank with graffiti. Game after this round: low kerb and
  dark-green three-rail iron balustrade in this district (`unr-river-east`, `unr-river-west`); the water is still 4.4 m down.
- **Footbridge w231671712**: an enclosed glazed walkway one storey up across the brick-paved Aleea Alexandru
  Brătescu-Voinești, "Carrefour" lettering and logo on its side; the car-park side wall is plain grey with louvres and a
  "LIFT ACCES PARCARE" sign, the Carrefour side is a banded glass front. Built in the Unirea landmark model (`unr-skybridge`);
  deck height 6 m and section 3.2 × 3 m are estimates.
- **Unirea Shopping Center**: the long west front is dark grey mesh over a dark ground floor, largely covered by a full-height
  advertising banner in 2026; at the north-west corner McDonald's (with McCafé) and "Noodle Pack" signs, and unlit "KOTON"
  letters left on the fascia (matches OSM `shop=vacant`); the south-west rotunda is clad in white panels (H&M logo in 2024,
  disused in OSM since) with a bronze louvred bay beside it. Game: uniform grey ribbed skin; McDonald's fascia present.
  Still different: white rotunda, bronze bay, advertising banners, Noodle Pack (not in OSM under that name).
- **Fountain field** (2024): jets running; a carriageway of Bd. Unirii crossed the square beside the basins (now
  `highway=construction` in OSM and absent in the game); tall dark candelabra lamps with globe clusters, an advertising
  column and billboards at the corners, sphere bollards. Game: basins match in place and rim; plain modern lamps.
- **Bd. Unirii east median**: lobed stone basins in lawn, large conifers and linden rows — matches in kind.
- **Hanul lui Manuc** (Str. Halelor front): two storeys, white walls, long dark-brown hipped roof, shops and terraces on the
  ground floor — matches after the colour fix; terraces not drawn.
- **Hala Traian east side**: "Farmacia Pharma Plant" (alphega) fascia confirmed (OSM n3873157367, outside the playable edge).
  Calea Călărașilor still showed two embedded tram tracks in the panorama; OSM (2026-11) has the line as `railway=construction`.
- **Dealul Mitropoliei** foot (Str. Bibescu Vodă): parking and trees, steps rising to the hill — the game is flat there.
- **Bd. Mircea Vodă**, a Călărași merchant house: nothing structural to correct.

Not seen at street level: Hala Traian main front, Sf. Spiridon Nou, the school pitches, Piața Sf. Ștefan fountain, the park
interior of Piața Unirii, the tenant fronts along the middle of the Unirea west side.

## Reference images (`refs/unirii/`, 40 files, licences in LICENSES.md)

| file | taken | near | licence | facade-texture candidate |
|---|---|---|---|---|
| 133_Calea_C_l_ra_ilor_Bucharest_01_.jpg | 2022-05-05 | Hala Traian | CC BY-SA 4.0 | yes |
| 10_Strada_Sf_nta_Vineri_Bucharest_01_.jpg | 2023-05-11 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| Entrance_of_Hala_Traian_from_the_Calea_C_l_ra_i_in_Bucharest_Romania_.jpg | 2019-10-27 | Hala Traian | CC BY-SA 4.0 |  |
| 43_Strada_B_r_iei_Bucharest_01_.jpg | 2023-05-11 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| 43_Strada_B_r_iei_Bucharest_02_.jpg | 2023-05-11 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| Bucarest_Pia_a_Unirii_main_fountain_2023.jpg | 2023-08-13 | Piața Unirii fountains | CC BY-SA 4.0 |  |
| 5_Strada_Baia_de_Fier_Bucharest_05_.jpg | 2023-05-11 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| 40_Strada_B_r_iei_Bucharest_01_.jpg | 2023-04-29 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| 23_Strada_Mihail_Georgescu_Bucharest_03_.jpg | 2022-09-30 | Hala Traian | CC BY-SA 4.0 | yes |
| 23_Strada_Mihail_Georgescu_Bucharest_02_.jpg | 2022-09-30 | Hala Traian | CC BY-SA 4.0 | yes |
| 34_Calea_Mo_ilor_Bucharest_03_.jpg | 2023-04-29 | Bd. I.C. Brătianu / Coposu | CC0 | yes |
| The_pediment_above_the_entrance_of_Hala_Traian_from_the_Calea_C_l_ra_i_in_Bucharest_Romani.jpg | Taken on 2 | Hala Traian | CC BY-SA 4.0 |  |
| Ikarus_415T_-_trolleybus_Bucarest_5_.jpg | 2023-07-29 | Piața Unirii south / Dealul Mitropoliei | CC BY 4.0 |  |
| Degraded_building_on_Strada_Bibescu_Vod_in_Bucharest_01_.jpg | 2022-05-31 | Piața Unirii south / Dealul Mitropoliei | CC BY-SA 4.0 |  |
| Bucharest_-_tram_in_front_of_Hala_Traian_01.jpg | Taken on 1 | Hala Traian | CC BY-SA 4.0 |  |
| Bulevardul_Unirii_with_fountains.jpg | Taken on 1 | Bd. Unirii east | CC BY-SA 4.0 |  |
| Cablaggio_strutturato_lampione_angolo_boulevardul_unirii_-_panoramio.jpg | Taken on 3 | Bd. Unirii east | CC BY 3.0 |  |
| 20260523_115813_May_2026_in_Bucharest.jpg | 2026-05-23 | Piața Unirii south / Dealul Mitropoliei | CC0 |  |
| Boulevardul_Unirii_-_panoramio.jpg | 8 April 20 | Piața Unirii fountains | CC BY 3.0 |  |
| Strada_Vulturilor_-_Bucharest_Romania_-_Travel_photography_33785881754_.jpg | Taken on 1 | Bd. Unirii / Calea Călărașilor east | CC BY 2.0 |  |
| Strada_Vulturilor_Bucharest_Romania_Travel_Photography_211763961_.jpeg | 12 May 201 | Bd. Unirii / Calea Călărașilor east | CC BY 3.0 |  |
| Piata_Unirii_-_panoramio_2_.jpg | Taken on 1 | Piața Unirii fountains | CC BY 3.0 |  |
| Bucharest_Day_1_-_Unirii_9330316144_.jpg | 2013-07-20 | Piața Unirii fountains | CC BY-SA 2.0 |  |
| Bucharest_-_Hala_Traian_01.jpg | Taken on 1 | Hala Traian | CC BY-SA 4.0 |  |
| Bucharest_Day_1_-_Unirii_9330342042_.jpg | 2013-07-20 | Piața Unirii south / Dealul Mitropoliei | CC BY-SA 2.0 |  |
| Bucharest_Day_2_-_Unirii_9335170995_.jpg | 2013-07-21 | Piața Unirii south / Dealul Mitropoliei | CC BY-SA 2.0 |  |
| Romania-1164_-_Romanian_Military_Academy_7557743754_.jpg | 2012-05-08 | Piața Unirii south / Dealul Mitropoliei | CC BY-SA 2.0 |  |
| Boekarest_Traian_hotel_view_north_-_panoramio.jpg | 26 Novembe | Piața Alba Iulia | CC BY 3.0 |  |
| Bucharest_Day_2_-_Unirii_9335170651_.jpg | 2013-07-21 | Piața Unirii south / Dealul Mitropoliei | CC BY-SA 2.0 |  |
| Welcome_217726283_.jpeg | before 27  | Piața Unirii fountains | CC BY 3.0 |  |
| Strada_Parfumului_nr._11_B-II-m-B-19334_.JPG | 2012-04-29 | Bd. Unirii / Calea Călărașilor east | CC BY-SA 3.0 |  |
| Strada_Matei_Basarab_nr._59_B-II-m-B-18088_.JPG | 2012-04-29 | Calea Călărașilor × Traian | CC BY-SA 3.0 |  |
| Strada_Parfumului_nr._13_B-II-m-B-19336_.JPG | 2012-04-29 | Bd. Unirii / Calea Călărașilor east | CC BY-SA 3.0 |  |
| Strada_Matei_Basarab_nr._50_B-II-m-B-18083_.JPG | 2012-04-29 | Calea Călărașilor × Traian | CC BY-SA 3.0 |  |
| Strada_Matei_Basarab_nr._52_B-II-m-B-18085_.JPG | 2012-04-29 | Calea Călărașilor × Traian | CC BY-SA 3.0 |  |
| Strada_Matei_Basarab_nr._48_B-II-m-B-18081_.JPG | 2012-04-29 | Calea Călărașilor × Traian | CC BY-SA 3.0 |  |
| Strada_Matei_Basarab_nr._46_B-II-m-B-18080_.JPG | 2012-04-29 | Calea Călărașilor × Traian | CC BY-SA 3.0 |  |
| Strada_Parfumului_nr._6_B-II-m-B-19333_.JPG | 2012-04-29 | Bd. Unirii / Calea Călărașilor east | CC BY-SA 3.0 |  |
| Red_bushes_and_young_trees_i-Contrast_off_5727584545_.jpg | Taken on 1 | Bd. Unirii east | CC BY 2.0 |  |
| Red_bushes_and_young_trees_i-Contrast_on_5727585257_.jpg | Taken on 1 | Bd. Unirii east | CC BY 2.0 |  |

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
| ref_hala | https://commons.wikimedia.org/wiki/File:133_Calea_C%C4%83l%C4%83ra%C8%99ilor,_Bucharest_(01).jpg |
| fountains_cost | https://www.romania-insider.com/bucharest-unirii-fountains-record |
| fountains_ro_insider_2023 | https://romania-insider.com/bucharest-urban-fountains-resume-shows-summer-2023 |
| fountains_bucharest_ro | https://www.bucharest.ro/article/the-urban-fountains-of-unirii-square-a-tourist-attraction-recognized-by-the-academy-of-world-records-83 |
| fountains_agir | https://www.agir.ro/univers-ingineresc/numar-17-2019/fantanile-urbane-din-piata-unirii-omologate-drept-„cel-mai-lung-sir-de-fantani-coregrafice-sincronizate-din-lume“_6553.html |
| fountains_2100 | https://www.antena3.ro/actualitate/noul-sezon-al-evenimentului-urban-simfonia-apei-debuteaza-pe-4-mai-cu-incepere-de-la-ora-21-00-519481.html |
| fountains_mediafax_45min | https://www.mediafax.ro/cultura-media/spectacolul-simfonia-apei-revine-si-anul-acesta-sambata-la-fantanile-urbane-din-piata-unirii-18109548/amp |
| fountains_dismantle | https://www.g4media.ro/spectacolele-simfonia-apei-de-la-fantanile-urbane-din-piata-unirii-vor-mai-avea-loc-doar-in-urmatoarele-trei-weekenduri-din-30-iunie-incepe-dezafectarea-fantanilor-pentru-lucrarile.html |
| fountains_until_june | https://www.antena3.ro/actualitate/spectacolele-simfonia-apei-de-la-fantanile-urbane-continua-pana-la-finalul-lunii-iunie-749199.html |
| fountains_drones | https://www.stiripesurse.ro/fantanile-urbane-din-piata-unirii-vor-celebra-performantele-olimpice-romanesti-cu-spectacole-de-apa-lumini-si-drone_3384799.html |

## Fidelity pass round 2, 2026-11-12 (sweep)

- **Median basin at 44.42695, 26.098886** (28 × 6 m water area on Bd. Unirii west of the square; `unr-water-west`, 44.427025, 26.099343, heading 261): low stone basins in a grassed median between tree rows, parked cars along the kerb; the game has the basins with water in a grassed median and tree rows. Match.
- No other bridge, underpass, water body or sports ground of the district data lacks a viewpoint within 130 m. The Bd. Unirii carriageway and Călărași tram works were not touched (owner decision).

## Unirea Shopping Center, round 2 (2026-11-12, lane landmarks)

- OSM w23492027 `building:levels=6`, no colour / material tags. Panorama at Piața Unirii (44.4269991, 26.1037744,
  headings 40 and 85, May 2024): south front and south-west rotunda in large flat white-grey panels with a blank white
  billboard frame on the curve and a white canopy band over a recessed glazed ground floor; west front (Bd. I. C.
  Brătianu) dark bronze louvres with a full-height advertising banner next to the rotunda; red Unirea logo near the roof.
  Panel module (6.2 m), louvre pitch and banner size in the model are estimates; the banner is a plain canvas.

## Landmark catalogue review against panoramas (fidelity pass round 2b, lane landmarks-b, 2026-11-12)

Method: official panorama ids found from Maps coverage metadata (`photometa/ac`, coverage only), the game rendered at the
pano position and bearing (eye 2.5 m), then compared side by side by eye. No imagery kept. Poses: `viewpoints-add.json`
of this lane and the poses below. "Match" = shape class, height, roof, main materials/colours, entrance side and signage
read as the real thing at street distance; it is not a claim of parity. Table positions are rounded and some are
approximate; the exact poses with their pano ids are in this lane's `pick/*.json`, `views2b.json` and `views3.json`,
and the kept ones in `viewpoints-add.json`.

| Landmark | Pose (lat, lon, heading) | Verdict |
| --- | --- | --- |
| cathedral | 44.4241, 26.0827 h 340 / h 48 | match (cream-white body, gold domes, tall central tower); wall in front not in the model's scope |
| gts | 44.433259, 26.117608 h 358 | match (three arched windows, garland stucco, mansard) |
| fountains | 44.427059, 26.102191 h 140 | match in form (round basins on the median); water is off in the game in November, on in the summer panorama |
| halatraian | 44.4334, 26.1197 h 257 / 351 | match (cream hall, red/cream banded piers, arched central gable); ground-floor tenant fascias not checked |
| parliament | 44.4292, 26.0897 h 287 | match (massing, cream colour) |
| unirea | — | compared in round 2 (lane landmarks) |

## Round 2 (2026-11-12), lane world: Dâmbovița, monuments, car park, fuel

**Dâmbovița.** Street-level review (appearance only):
- West of Piața Unirii, from the south quay at 44.42932, 26.09763 looking north: dark-green iron railing on a low kerb
  (as modelled), then one broad sloped concrete bank down to low water; no service bench. The model section had a steep
  wall and a 2 m bench. Now `water-channel-review.js` gives w174990751 a 4.6 m sloped bank; level kept at -4.4 m (estimate).
- East end of the covered section, 44.42609, 26.10433 looking east: open water begins at the railing; a wide basin with
  sloped banks, water about 2 - 2.5 m below the quay; a row of concrete blocks across the basin. The game had the water
  4.4 m down: w174991904 is now at -2.4 m with sloped banks (estimate, reviewed at this one place). The blocks are not drawn.
  The game still shows about 80 m of bare construction ground east of the railing where reality has water: that is the
  Piața Unirii construction state in OSM (owner decision), not changed.
- The "thin strip of water at pavement level" along the quay was an open slot: the ground stopped 0.3 - 0.4 m short of
  the quay kerb and the channel water showed through. A coping strip closes it along every channel quay (seen fixed at
  (-900, 32)).

**Monuments** (generic class objects, `monuments.js`): 27 placed (among them Lupoaica, Constantin Brâncoveanu, the four
statues at Universitate, Alexandru Ioan Cuza, Șerban Cantacuzino, Barbu Catargiu, the Pogrom memorial obelisk, busts).
Not placed: Mihail Cantacuzino and Domnița Bălașa (the point is inside a building footprint in the pack), Dimitar
Hadjvasilev and Bustul lui Barbu Constantinescu (on a carriageway), Fântâna Vioara Spartă (in water); plaques and
untyped artworks (Kilometrul 0, Horațiu) stay markers. None compared with Street View in this district.

**Parcare Unirea** (w184169515, 10 levels): open decks on the source footprint. Parcare Cocor (w658281398) is an amenity
polygon without a building tag and keeps the store facade.

**Fuel**: OMV (w263315803) 2 pump islands + pylon; MOL (w670595374) 4 islands + pylon: generic model, not compared.

## Round 2 (2026-11-12), lane world-b

Street View was used only to look (official panoramas, ids found from coverage metadata); nothing was saved or traced.

Old Town pedestrian streets (Str. Franceză, Lipscani): cobbled wall to wall in the panoramas; the
raster drew lawn. Mapped highway=pedestrian ways now keep a 7 m paved band; 32 business fascias were added on pedestrian
fronts (e.g. Hanu' lui Manuc, City Grill, Mojo Music Club, Gelateria La Romania dal 1947; see world.stats.fasciaLayout).

## Round 3, lane builder (2026-11-13)

Sources: live OSM (API 0.6 / Overpass, 2026-11-12/13; the round-2 map.json tiles of each district for the cached-source
tools), official Street View panoramas looked at for appearance only (nothing stored, nothing extracted into data).

Fountain outlines (`tools/osm/add-areas.mjs`): w413969309 (20 m², replaces the round-2 furniture bowl), w1474406316,
w586376877, w1459195391 / w1459195396, and the Colțea garden basins w1180500523 / w1180500524 / w1180503225
(`natural=water`, 13–16 m², 19–46 m outside the playable edge) are water areas with a stone coping (world.js patch).
w608657873 (44.43414, 26.11631, Str. Ion Câmpineanu side square) is NOT added: the official panorama
m4ZygVZxXJZodU3nvvedUg shows a round planted bed at grade (a shrub, grass), no basin — OSM looks stale there.
The six 0.6 m jet slits (w1176128444 …) stay out (degenerate after simplification; inside the `fountains` landmark).

## Round 3 street-level review, lane look (2026-11-13)

Official panoramas only (ids cited; no imagery stored). Runtime modules named in brackets.

- **Fuel stations** (fuel-look.js, game/research/fuel-stations-review.json). OMV Bd. Corneliu Coposu w263315803: green fascia with a
  blue OMV panel, white soffit, blue-and-white clad columns, islands with blue bases; white / blue pylon south-west of the canopy
  (XTVqSWyob94uGXTDzkYZFg h45, D1ZNjm-lmugZGMje_XXCGg h189). MOL w670595374: green fascia, curved green MOL pylon with the red logo at
  the west entrance (h16qhTmS_zN0GfsQ2P6rIA h140, 7VQRohD43rltUvsClUDt_Q h103). The game had a blue OMV / red MOL fascia.
- **Weir w1434558024** (OSM `waterway=weir`, 44.425858-44.426298, 26.10454-26.10461): a row of about sixteen low grey concrete blocks
  across the basin just downstream of the covered section (NrlzOfq1HTfol_d90aJ3FA h95). weirs.js draws it at the reviewed basin level
  (water -2.4 m + 0.45 m freeboard; block count / size are estimates), but only where the game has open water: the west end of
  w174991904 is bare construction ground in the game (the Piața Unirii era, an owner decision), so no block is drawn today.
- **Dâmbovița level**: at 44.429203, 26.099789 (4Tc0SMwEbrKg8LFcABcVWg h110, just west of the square) the water is high, about 2.5 - 3 m
  below the quay, with a broad sloped bank on the north side; round 2 saw it about 4.5 m down at 26.0976 on the same polygon
  w174990751. The level varies inside the polygon; water-channel-review.js holds one level per polygon (not changed).
- **Kilometrul 0** n2496554613 (tourism=artwork, no artwork_type): a dark bronze ring sculpture on a low round plinth in the fenced
  churchyard of Sf. Gheorghe Nou (FW4Rlti5tfUkf9fpP8YuJg h106): now drawn with the generic `sculpture` class, bronze (monument-sources.js).
- **Wayside crosses**: 45 OSM `historic=wayside_cross` / `man_made=cross` nodes in the Bucharest district areas are drawn with a
  new small stone wayside-cross class (`wayside`, 1.5 m on a low base, estimate): the crosses in the grass median of Bd. Brătianu at
  Piața Universității (WTniXBNPVx6ZDxHLKCnDSQ h322) are about 1 - 1.5 m stone crosses, far smaller than the 3.2 m memorial `cross`
  class. 20 are in Unirii (Troița Mântuirii Neamului n2079451985 and Cruce de piatră n9411250345 among them; one duplicate position
  skipped). No official panorama within 40 m of the Troița, whose real size is not known.
- **Horațiu** n2486324771: the mapped point is a shop front (OPtvWjzotRRHelaG81dCHg h81); nothing free-standing; OSM itself has
  `fixme=Is this really here?`. Not drawn.
- **Parcare Unirea** w184169515: the building sign now reads its own name "Parcare Unirea" (rule "Etaj n is not the building sign"
  verified in a render from four sides); the car wash POI "Spălătorie Unirea Etaj 7" (shop car_wash on the same footprint) still
  gets two small stacked unit boards on the west face at street level.
- **Parcare Cocor** w658281398 (building:part in the Cocor store): the street side is a dark grey panelled wall with a vehicle
  entrance and barrier (ky8lvOleKFvuiFVszKDv7Q h240); the pack draws the store's glazing there and the part is not a building record
  of its own, so car-parks.js cannot restyle it. Levels not visible.
- **Domnița Bălașa** w78564921: cream stone with red-brown brick bands (2tFsWbmuz3BKVzjdbjqNww h277): matches the church class colour.
- **Piața Unirii lamps**: 16 OSM `highway=street_lamp` nodes in the square (no style tags) are drawn as the generic lamp; the
  candelabra form needs a second lamp instance set in the lamp renderer (not done). Advertising column w1176142649 is an OSM building
  (height 4, onion roof, #1d3b35), drawn by the pack's building path.

## Round 4, backlog clearance (2026-11-13)

- **Parcare Unirea** w184169515: rendered from four sides at HEAD: the reviewed louvred facade (`car-parks.js` `facade:
  'louvred'`, pale wall with a dark louvre ribbon per level) is what the game draws, not open decks. The car wash "Spălătorie
  Unirea Etaj 7" no longer gets street boards: a business named for an upper floor ("Etaj n") has no street-level fascia
  (world.js `addUnitSign`, the same rule as the building sign).

### Estimates

- **Stops outside the playable edge** (unirii-edge-pois): 18 appended bus / tram stops lie outside the edge (game render
  2026-11-13, metres outside the edge). Within the 30 m frontage cap, so with the inferred shelter on their scenery street:
  Piața Unirii osm377 (4 m), Hristo Botev osm504 (1 m) and tram osm524 (30 m), Piața Sf. Gheorghe osm507 (26 m), Hala Traian
  tram osm520 (28 m), Bd. Dimitrie Cantemir tram osm561 (25 m). Beyond the cap (POI and map marker only, no shelter model):
  Bd. Mărășești osm342 / osm359 (49 m), Universitate osm429 (44 m), Hristo Botev osm505 (74 m), Piața Sf. Gheorghe osm512
  (95 m) and trams osm521 (41 m) / osm522 (93 m) / osm523 (42 m), Hala Traian osm544 (75 m) / osm545 (52 m) and trams osm552
  (95 m) / osm553 (60 m). The cap is the frame budget's (a shelter further out is distant scenery); whether those stops have a
  shelter at all is not established either way (r3-builder-4).
