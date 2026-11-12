# Bucharest — Grozăvești & Politehnica (`grozavesti`): field research dossier

Role: research-buc-districts · generated 2026-11-06 23:07 UTC · machine-readable twin: `bucharest-grozavesti.json` · images: `refs/grozavesti/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Doina Cornea, Podul Grozăvești, Șoseaua Grozăvești, Șoseaua Orhideelor |
| route_streets_researched | Bulevardul Doina Cornea, Podul Grozăvești, Șoseaua Grozăvești, Șoseaua Orhideelor |
| fronting_route_buildings | 10 |
| fronting_route_with_height | 80.0 |
| fronting_route_with_colour | 10.0 |
| fronting_route_researched | 10.0 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 80.0 |
| fronting_main_buildings | 219 |
| fronting_main_with_height | 66.2 |
| buildings_total | 1598 |
| buildings_with_height | 39.5 |
| businesses_total | 475 |
| businesses_on_route | 11 |
| businesses_branded | 75 |
| trees_osm | 27 |
| lamps_osm | 0 |
| crossings | 305 |
| signal_nodes | 38 |
| transit_stops | 50 |
| metro_entrances | 7 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.4335, 26.046], [44.449, 26.046], [44.449, 26.0725], [44.4335, 26.0725]]` → bbox `[44.4335, 26.046, 44.449, 26.0725]`, area **3.628 km²**.
- Why: Extraction area = world agent bbox from cities.js BUC_DISTRICTS (so every street the world builds is covered). 1.39 km N-S × 1.35 km E-W ≈ 1.2 km² (some of it campus/park): north edge Bd. Regiei/Regie campus, east edge just past Podul Grozăvești/Șos. Grozăvești (Basarab overpass ramps), south edge Bd. Iuliu Maniu, west edge Str. Petre Popovăț/Splai bend; includes the whole UPB campus, Regie dorms, Grozăvești metro and the Dâmbovița with both Splai carriageways.
- Research-proposed compact ~1 km² polygon (optional tighter cut): `[[44.4345, 26.047], [44.447, 26.047], [44.447, 26.064], [44.4345, 26.064]]`

## Chapter routes

### upb · 2013 — Politehnica (UPB) — Rectorat

- **Start**: WORLD START: Șos. Orhideelor southbound — `44.447432, 26.062618`, heading 242° on Șoseaua Orhideelor.
- **End**: UPB Rectorat forecourt (campus road behind the Doina Cornea gate) — `44.438998, 26.051727`.
- **Length**: 1744 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: Come down Șos. Orhideelor (Basarab overpass towering alongside), cross the Dâmbovița on Podul Grozăvești (Grozăvești metro + Regie student campus on the right), turn onto Bd. Doina Cornea south along the UPB campus (tram reservation in the middle), then in through the campus gate to the Rectorat forecourt.
- **Sequence**: Șoseaua Orhideelor (586 m) → Podul Grozăvești (57 m) → Șoseaua Grozăvești (70 m) → Bulevardul Doina Cornea (607 m) → (service) (424 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.447432, "lon": 26.062618, "road": "Orhideelor", "bearing": 242}, {"lat": 44.4405, "lon": 26.057, "road": "Doina Cornea", "bearing": 200}, {"lat": 44.4387, "lon": 26.0515}]`

## CV stops (verified)

### upb — Universitatea Politehnica din București — Rectorat

- **address**: Splaiul Independenței 313, Sector 6 (campus "Noul Local"; the Leu site is at Bd. Iuliu Maniu 1-3)
- **building_osm**: w28240552 (Rectorat, 5 levels) inside campus area w23608402
- **lat**: 44.43848
- **lon**: 26.05145
- **door**: lat: 44.4387; lon: 26.0515; street: campus road (service, access=private, barrier at the gates); side: forecourt north of the Rectorat; gates: vehicle gates: Bd. Doina Cornea side (gate node n6810324892 at 44.43807, 26.05543) and Splaiul Independenței side (campus road w26314495/w178160268 meets the eastbound Splai at ≈44.4441, 26.0538)
- **building**: storeys: 5 + rooftop dome; facade: iconic 1970s modernist Rectorat: long symmetrical white concrete frame grid (#EDEDE8) with RED infill panels (#B8312F) between the window bays, recessed ground floor, and a wide shallow saucer-shaped DOME on the roof (aula), flagpoles; at night the dome rim is lit blue; large paved forecourt + parking; conf: high from photos (refs/grozavesti), storeys OSM [osm] [upb_address] [ref_upb]
- **cities_js_check**: cities.js upb {44.4366, 26.0526} is ~200 m south of the Rectorat (near the Iuliu Maniu side of campus). The Rectorat is at {44.4385, 26.0515}; it has NO public-street frontage — the drive ends via a campus gate (Doina Cornea) and ~420 m of private campus road. The Splai carriageway next to the campus (way 227053932) is ONE-WAY EASTBOUND.

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Șoseaua Orhideelor (chapter route)

- OSM: 18 ways, 2251 m in district, classes secondary; lanes values ['1', '2', '3', '4']; one-way segments 18/18; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 105, bus 123, bus 162, bus 163, bus 178, tram 11, tram 44.
- OSM furniture: {'lift_gate': 6}.
- Fronting buildings: 13; businesses: 12.
- **cross_section**: one-way pairs 2–3 lanes each running beside/below the elevated Pasajul Basarab (layer 1–2 bridge) from Gara de Nord side down to Podul Grozăvești; 50 km/h; buses 105, 162, 163
- **frontage**: W: The Bridge office campus (3 towers, 11 lv, 52 m — IBM, Bitdefender, BCR), Ahrend; E: Poliția Locală Sector 6, Lukoil fuel station (canopy, n/w296332666), Sir Orhideea hotel
- **barrier_note**: OSM maps NO jersey barrier/guard-rail across Orhideelor here; the concrete parapets belong to the elevated Pasajul Basarab ribbons above/alongside (bridge=yes, layer 1–2). The owner's "concrete barrier across the lane on Orhideelor" is therefore a generation bug (an overpass wall projected onto ground level) — walls must stay on the Basarab layer.
- confidence: high (OSM) [osm] [newsweek_basarab]

### Bulevardul Doina Cornea (chapter route)

- OSM: 11 ways, 2246 m in district, classes secondary; lanes values ['1', '2', '3']; one-way segments 11/11; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 105, tram 1, tram 10, tram 11.
- OSM furniture: {'gate': 3, 'bicycle_rental': 1, 'parking_entrance': 1}.
- Fronting buildings: 11; businesses: 7.
- **cross_section**: dual carriageway 2+2 (3 at junctions) with trams 1, 10, 11 on a central reservation (part shares the Basarab viaduct approach, bridge segments layer 1–2); bus 105; 50 km/h; UPB campus fence on the W side, Politehnica railway halt on the E side, Enel and OMV buildings
- confidence: high (OSM) [osm]

### Șoseaua Grozăvești (chapter route)

- OSM: 12 ways, 1851 m in district, classes primary, secondary; lanes values ['1', '2', '3']; one-way segments 12/12; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 105, bus 1929, trolleybus 63.
- Fronting buildings: 16; businesses: 1.
- **cross_section**: one-way pairs, 2 lanes each, 50 km/h; trolleybus 63, buses 105/1929; tram tracks cross at the Splai
- confidence: high (OSM) [osm]

### Podul Grozăvești (chapter route)

- OSM: 6 ways, 115 m in district, classes secondary; lanes values ['3']; one-way segments 6/6; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 105.
- Fronting buildings: 0; businesses: 0.
- **cross_section**: short road bridge over the Dâmbovița canal (57 m) linking Orhideelor and Șos. Grozăvești; railings both sides; Grozăvești metro (M1) entrances at both ends, Regie student campus NW
- confidence: high (OSM) [osm] [wp_grozavesti_metro] [adevarul_grozavesti_works]

### Splaiul Independenței

- OSM: 25 ways, 5137 m in district, classes secondary, service; lanes values ['2', '3', '4']; one-way segments 24/25; maxspeed ['10', '30', '40', '50', '60', 'RO:urban']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 123, tram 1, tram 11, trolleybus 90, trolleybus 96.
- OSM furniture: {'lift_gate': 8, 'gate': 8, 'surveillance': 1, 'drinking_water': 1, 'waste_basket': 1, 'bench': 1, 'bicycle_parking': 1}.
- Fronting buildings: 56; businesses: 26.
- **cross_section**: the Dâmbovița runs in a straight concrete-lined canal (trapezoidal, ~40 m wide, low water, steel railings) with a ONE-WAY carriageway on each bank: south bank (campus side) EASTBOUND 2–3 lanes (40–50 km/h), north bank (Regie side) WESTBOUND 2 lanes; tram 1/11 and trolleybus 90 sections; poplar/linden rows on the embankments
- **frontage**: N bank: Regie student campus (dormitories P1–P27, U1–U6: 5–9-storey 1970s blocks), Ibis Politehnica, Novum Invest office; S bank: UPB campus fence, Casa Corpului Didactic
- confidence: high (OSM); canal look medium [osm]

### Pasajul Basarab

- OSM: 14 ways, 2612 m in district, classes primary; lanes values ['1', '2']; one-way segments 14/14; maxspeed []; surface ['asphalt']; trolley_wire —; turn lanes tagged: True; bus/psv lanes tagged: False; tram: central reservation, shared carriageway (rails in road).
- Transit lines (OSM route relations): bus 1929, tram 1, tram 10, tram 11, tram 44.
- Fronting buildings: 3; businesses: 2.
- Street View (viewed 2026-11-11/12, reference only; the game follows it):
  - West ramp (Pasajul): both carriageways at street level at 44.44005 (z ≈ 128), then one embankment on retaining walls
    with a grass median as they climb; a kerbed concrete median with the arch hangers on the river arch; no railing
    between the carriageways.
  - Ramps by Șos. Nicolae Titulescu: the climbing carriageway (with the tram) is at street level at 92 Titulescu, about
    2.5 m up at 87 Titulescu on a solid retaining wall with a low parapet, and an open viaduct about 6 m up with parking
    beneath at 44.45084, where Titulescu stays at street level. The trams reach street level where the rail bridge ends
    on Titulescu (44.45172, 26.07131).
  - Viaducts stand on single hammerhead piers about every 30–40 m. The cable-stayed main span carries the deck with no
    piers from the last stay anchor (44.44893, 26.06688) to the pylon.
  - The tram slab has its own blue steel railing beside the carriageway's concrete barrier.
  - The Orhideelor entry ramp passes under the viaduct about 1 m up, its barrier at the street's edge (44.44529, 26.06167).
  - Calea Griviței at the south-west link ramp foot is at street level.

### Bulevardul Iuliu Maniu

- OSM: 15 ways, 2216 m in district, classes primary; lanes values ['3']; one-way segments 15/15; maxspeed ['30', '50', '60']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: False; bus/psv lanes tagged: True; tram: —.
- Transit lines (OSM route relations): bus 139, bus 1929, trolleybus 61, trolleybus 62, trolleybus 63, trolleybus 93.
- OSM furniture: {'gate': 7, 'lift_gate': 4, 'bench': 6}.
- Fronting buildings: 24; businesses: 24.
- **cross_section**: south edge: one-way pairs 3 lanes each with trolleybus wires (61, 62, 63, 93), 50 km/h; Politehnica metro (M3) entrances A–C; new 11-storey offices (The Light One, Campus 6.1/6.2, 45 m) on the N side
- confidence: high (OSM) [osm]

### Șoseaua Cotroceni

- OSM: 16 ways, 1861 m in district, classes primary, secondary; lanes values ['2', '3', '6']; one-way segments 16/16; maxspeed ['50', '60']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 1929, trolleybus 61, trolleybus 62, trolleybus 93.
- OSM furniture: {'gate': 2, 'waste_basket': 2, 'bench': 2}.
- Fronting buildings: 49; businesses: 14.

### Bulevardul Regiei

- OSM: 5 ways, 487 m in district, classes residential, tertiary; lanes values ['2']; one-way segments 3/5; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 162, bus 163.
- OSM furniture: {'gate': 4, 'lift_gate': 2}.
- Fronting buildings: 15; businesses: 5.

### Strada Economu Cezărescu

- OSM: 6 ways, 469 m in district, classes residential; lanes values ['2']; one-way segments 0/6; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM trees within 25 m: 4 (species —, genus {'Populus': 4}).
- OSM furniture: {'gate': 2, 'parking_entrance': 1}.
- Fronting buildings: 19; businesses: 14.

### Bulevardul Geniului

- OSM: 4 ways, 415 m in district, classes primary; lanes values ['2']; one-way segments 4/4; maxspeed ['50']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 139, trolleybus 63.
- OSM furniture: {'bench': 1}.
- Fronting buildings: 6; businesses: 0.

### Bulevardul General Paul Teodorescu

- OSM: 5 ways, 405 m in district, classes secondary; lanes values ['2']; one-way segments 5/5; maxspeed ['50']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 105, bus 139, trolleybus 93.
- OSM furniture: {'lift_gate': 1}.
- Fronting buildings: 6; businesses: 11.

### Intrarea Grozăvești

- OSM: 3 ways, 395 m in district, classes service; lanes values []; one-way segments 1/3; maxspeed ['50', 'RO:urban']; surface ['asphalt', 'dirt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

### Strada Sergent Constantin Ghercu

- OSM: 1 ways, 371 m in district, classes residential; lanes values ['2']; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- OSM furniture: {'lift_gate': 4, 'gate': 1}.
- Fronting buildings: 11; businesses: 10.

### Strada Palatul Cotroceni

- OSM: 4 ways, 316 m in district, classes service; lanes values []; one-way segments 0/4; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

### Intrarea Sergent Constantin Ghercu

- OSM: 1 ways, 140 m in district, classes service; lanes values []; one-way segments 0/1; maxspeed []; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 0; businesses: 0.

### Podul Cotroceni

- OSM: 2 ways, 65 m in district, classes secondary; lanes values ['3']; one-way segments 2/2; maxspeed ['50']; surface ['asphalt']; trolley_wire ['yes']; turn lanes tagged: True; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 123, trolleybus 62, trolleybus 93.
- Fronting buildings: 0; businesses: 0.

## Squares, junctions, landmarks

- **Podul Grozăvești (Orhideelor × Splai × Grozăvești)** — signalised bridge-head junctions on both banks, tram crossing on the Splai;  [osm]
- **Doina Cornea × Iuliu Maniu (Politehnica metro)** — large signalised junction, trams + trolleybuses;  [osm]
- **UPB campus & Rectorat** (`politehnica`, w23608402) — fenced campus, parking everywhere, students; Rectorat with flags [osm] [upb_address]
- **Regie student campus** (`regie`, w23770544) — rows of 5–9-storey 1970s dormitories along the north bank; Fabrica Grivița/One Club bars [osm]
- **Dâmbovița canal** (`dambovita`, ) — concrete trapezoidal canal with steel railings, one-way Splai on each bank [osm]
- **Pasajul Basarab (cable-stayed viaduct, 2011)** (`basarab`, ) — elevated 2-level structure along Orhideelor/Doina Cornea carrying cars + trams; cable-stayed span near Gara de Nord (outside) [osm]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|
| n32934941 | Podul Grozăvești × Splaiul Independenței × Șoseaua Orhideelor | yes |  | 5 |
| n249659921 | Strada Sergent Constantin Ghercu × Șoseaua Orhideelor |  |  | 3 |
| n2159714546 | Bulevardul Doina Cornea × Șoseaua Grozăvești |  |  | 0 |
| n304485447 | Bulevardul Doina Cornea × Strada Economu Cezărescu | yes |  | 7 |
| n32934934 | Bulevardul Regiei × Șoseaua Orhideelor | yes |  | 5 |
| n981556145 | Calea Giulești × Șoseaua Orhideelor | yes |  | 8 |

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w661134293 | The Bridge 1 | 11 / 52 | #7D93A0 glass curtain wall |  | 2010s |  [osm] |
| w699470645 | The Light One | 11 / 45 | #8A9BA5 glass + white fins |  |  |  [osm] |
| w28240552 | UPB Rectorat | 5 / 24 | #EDEDE8 white concrete frame grid + red infill panels + glazing | flat with a central shallow saucer dome (aula), blue rim lighting at night | 1970s | upb [osm] [ref_upb] |
| w50538006 | Biblioteca Centrală UPB |  /  |   |  |  |  [osm] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w239358321 | Bulevardul Doina Cornea | W | 4A | office | 8 |  | 2004 |  | modern office/glass curtain wall | #7D93A0 est | 2 |
| w413703560 | Bulevardul Doina Cornea | NW | 2P | yes · Enel | 4.0 est |  |  |  | unknown (use district rule) |  | 1 |
| w312139192 | Bulevardul Doina Cornea | NW |  | commercial | 5 |  |  |  | unknown (use district rule) | #7D93A0 est | 0 |
| w312139191 | Bulevardul Doina Cornea | NW | 2I | commercial | 6 |  | 2010 |  | modern office/glass curtain wall | #7D93A0 est | 0 |
| w741025125 | Bulevardul Doina Cornea | W | 2F | commercial | 7.0 est |  |  |  | unknown (use district rule) | #D9D2C3 est | 0 |
| w661134294 | Șoseaua Orhideelor | W |  | yes | 12 | 50 |  |  | unknown (use district rule) | #D3CEC2 est | 5 |
| w1559344858 | Șoseaua Orhideelor | W | 15A | office | 16 | 64 | 2018 |  | modern office/glass curtain wall | #7D93A0 est | 0 |
| w740780913 | Șoseaua Orhideelor | W |  | yes | 16 | 64 |  |  | unknown (use district rule) | #BDB7AA est | 4 |
| w661134293 | Șoseaua Orhideelor | W | 15D | office · The Bridge 1 | 11 | 52 | 2017 |  | modern office/glass curtain wall | #7D93A0 | 7 |
| w247015074 | Șoseaua Orhideelor | N |  | warehouse | 1 | 8 |  |  | low house/villa (19th-early 20th c. likely) |  | 0 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| n12320402685 | Clinica Victoria |  | amenity=dentist | Bulevardul Doina Cornea | W | 4 |
| w413703560 | Enel |  | office=energy_supplier | Bulevardul Doina Cornea | NW | 2P |
| n10027962824 | Testronic |  | office=it | Bulevardul Doina Cornea | W | 4A |
| n14189240522 | Ahrend |  | shop=furniture | Șoseaua Orhideelor | W | 15D |
| n6773934063 | BCR | BCR bg #0074BC fg #FFFFFF | amenity=bank | Șoseaua Orhideelor | W | 15D |
| n6933055419 | Bitdefender |  | office=it | Șoseaua Orhideelor | W | 15A |
| n13710547706 | Domestina România |  | craft=cleaning | Șoseaua Orhideelor | W | 15A |
| w247015087 | Fabrica Grivița |  | amenity=bar | Șoseaua Orhideelor | N | 2 |
| w1331454041 | Gradinița nr. 168 |  | amenity=kindergarten | Șoseaua Orhideelor | N | 19 |
| n3756985973 | Green Day Spa |  | shop=hairdresser | Șoseaua Orhideelor | W | 19 |
| n6933055421 | IBM |  | office=company | Șoseaua Orhideelor | W | 15D |

Other branded businesses in the district (off-route): OMV (Bulevardul Doina Cornea, w239359996); Starbucks (Bulevardul Doina Cornea, n6098653953); BRD (Bulevardul General Paul Teodorescu, n2437110915); ING (Bulevardul General Paul Teodorescu, n2394811005); Luca (Bulevardul General Paul Teodorescu, n5431039851); 5 to go (Bulevardul Iuliu Maniu, w1158163403); Banca Transilvania (Bulevardul Iuliu Maniu, n1827391331); Dristor Kebap (Bulevardul Iuliu Maniu, n10770721474); Dristor Kebap (Bulevardul Iuliu Maniu, w771711009); Superbet (Bulevardul Iuliu Maniu, n8628417856); Catena (Calea Plevnei, n6257141008); Catena (Calea Plevnei, n11747813932); Shop&Go (Calea Plevnei, n12816643597); ING (Intrarea Elizeu, n7026903567); 5 to go (Splaiul Independenței, n11210115650); Carrefour Express (Splaiul Independenței, n12258231590); Petrom (Strada Doctor Ernest Juvara, w170950529); Profi (Strada Drajna, n9990622878); 5 to go (Strada Economu Cezărescu, n13236285714); Carrefour (Strada Economu Cezărescu, n11528410571); La Doi Pași (Strada Economu Cezărescu, n13236285710); BCR (Strada George Ranetti, n2414411003); 5 to go (Strada Sergent Constantin Ghercu, n6877476154); CEC Bank (Strada Zării, n13174885875); ING (Strada Zării, n6952897499); 5 to go (, n11210073895); 5 to go (, n11876439490); 5 to go (, n12318869822); Vodafone (, n11009381359); BCR (, n610615259); BCR (, n3021606033); BRD (, n4805940522); BRD (, n6773898600); Banca Transilvania (, n1306485690); Carrefour (, w925593033); Chopstix (, n6768983283); Domino's (, n9958810731); Dr. Max (, n11009381348); Dristor Kebap (, n11009381368); Euronet (, n7072653286); Fornetti (, n4805940722); Help Net (, n12319355969); Help Net (, n2637755374); Ibis Styles (, w899792464); Intersport (, n11009381360); KFC (, n3619175487); Kaufland (, w423683661); Libra Bank (, w23608496); Maxbet (, n11009381371); McDonald's (, n4805940523); Mega Image (, n12319355971); Mesopotamia (, n11009381367); Mesopotamia (, n11009381353); MOL (, n14189221844); Noriel (, n11009381369); OPTIblu (, n11009381346); Orange (, n6772394787); Pepco (, n11009381363); Pizza Hut (, n10060255155); Profi (, n8727848532); Profi (, n8727848953); Raiffeisen Bank (, n4805940721); Regina Maria (, n11508840142); Regina Maria (, n9888785698); Samsonite (, n11009381350); Sephora (, n11009381374); Starbucks (, n6768983282); Ted's Coffee Co. (, n12652304729); Yves Rocher (, n11009381345); dm (, n11009381361); Inmedio (, n3619175488); Regina Maria (Șoseaua Cotroceni, n6245711398); Shop&Go (Șoseaua Cotroceni, n6952897501); Lukoil (Șoseaua Orhideelor, w256806132).

## Transit

- Lines with OSM route relations touching the district: bus 105, bus 122, bus 123, bus 137, bus 139, bus 162, bus 163, bus 168, bus 178, bus 182, bus 226, bus 282, bus 368, bus 780, bus 1929, tram 1, tram 10, tram 11, tram 44, trolleybus 61, trolleybus 62, trolleybus 63, trolleybus 69, trolleybus 85, trolleybus 86, trolleybus 90, trolleybus 93, trolleybus 96, trolleybus 97.
- Stops: A.N.E.F.S. (bus/trolleybus); Bd. Dr. Marinescu (trolleybus); Bd. G-ral Paul Teodorescu (bus/trolleybus); Bd. Iuliu Maniu (bus/trolleybus); Bd. Iuliu Maniu (tram); Bd. Regiei (bus); Calea Giulești (bus); Calea Giulești (platform); Calea Giulești (tram); Calea Plevnei (platform); Calea Plevnei (tram); Calea Plevnei (trolleybus); Carol Davila (bus/trolleybus); Complex Grozăvești (platform); Complex Regie (platform); Cămin U4 (bus); E.L.C.E.N. (bus); Economu Anastasie Stoicescu (bus); Facultatea de Electronică (bus/trolleybus); Facultatea de Filosofie (bus); Facultatea de Medicină (bus/trolleybus); Facultatea de Medicină (trolleybus); Gara Basarab (bus); General Petre Popovăț (bus); Grădina Botanică (bus/trolleybus); M Petrache Poenaru (bus); Mircea Vulcănescu (bus); Piața Leul (bus/trolleybus); Piața Leul (platform); Pod Cotroceni (bus); Pod Cotroceni (bus/trolleybus); Pod Cotroceni (trolleybus); Pod Grozăvești (bus); Pod Grozăvești (tram); Podul Grozăvești (bus); Podul Grozăvești (platform); Primăria Sector 6 (bus); Spitalul Universitar (platform); Universitatea Politehnica (bus/trolleybus); Universitatea Politehnică (bus); Witing (bus/trolleybus); Șos. Orhideelor (platform).
- Metro entrances: Cale acces A Statie Metrou Politehnica (M3) A (44.43476, 26.05506); Cale acces C Politehnica (M3) C (44.43603, 26.05618); Cale acces B Statie Metrou Politehnica (M3) B (44.43526, 26.05627); None  (44.43506, 26.05461); Grozăvești  (44.44285, 26.05994); Grozăvești  (44.44264, 26.06105); Petrache Poenaru  (44.44534, 26.04669).
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

### Vlad (UPB student) (`upb_student`, local, lang ro, 19-24) — 16 lines
Computer-science student heading from Regie to the Politehnica campus.

- *greeting*: „Salut!” (Hi!) · „Neața, colega!” (Morning, mate!) · „Hei, la ce facultate ești?” (Hey, which faculty are you at?)
- *bumped*: „Băi, am laptopul la mine!” (Hey, I have my laptop on me!) · „Scuze, eram cu ochii pe cod.” (Sorry, I was looking at code.) · „Ușurel, colega.” (Easy, mate.)
- *photographed*: „Prinde și Rectoratul!” (Get the Rectorate in!) · „Pentru grupul de an? Ok.” (For the year group chat? OK.) · „Fă-o rapid, am laborator.” (Make it quick, I have a lab.)
- *idle*: „Am predare la proiect mâine.” (Project hand-in tomorrow.) · „Cantina e plină la unu.” (The canteen is full at one.) · „Mergem la Fabrica după examen?” (Shall we go to Fabrica after the exam?)
- *district*: „De la Regie la Rectorat faci zece minute pe jos.” (From Regie to the Rectorate is a ten-minute walk.) · „Splaiul e cu sens unic pe fiecare mal.” (The Splai is one-way on each bank.) · „105 e autobuzul studenților.” (The 105 is the students' bus.) · „Metroul Grozăvești e chiar lângă pod.” (Grozăvești metro is right by the bridge.)

### Cristina (Regie dorm resident from Chișinău) (`regie_student_md`, local, lang ro, 19-23) — 16 lines
Engineering student from the Republic of Moldova living in the Regie dorms; same language, slightly different everyday words.

- *greeting*: „Bună!” (Hi!) · „Salut, ce mai faci?” (Hi, how are you?) · „Bună ziua, știți unde-i căminul P5?” (Good day, do you know where dorm P5 is?)
- *bumped*: „Ai grijă, te rog!” (Careful, please!) · „Ups, scuze!” (Oops, sorry!) · „Nimic, nimic, se întâmplă.” (Nothing, nothing, it happens.)
- *photographed*: „Trimit poza la mama acasă!” (I'll send the picture to my mum back home!) · „Fă-o cu Dâmbovița în spate.” (Take it with the Dâmbovița behind.) · „Mulțumesc frumos!” (Thank you kindly!)
- *idle*: „Diseară gătim în bucătăria de la cămin.” (Tonight we cook in the dorm kitchen.) · „De sărbători plec acasă cu autocarul.” (For the holidays I go home by coach.) · „Am sesiune, nu ies nicăieri.” (Exams are on, I'm not going out.)
- *district*: „Căminele din Regie sunt toate din anii șaptezeci.” (The Regie dorms are all from the seventies.) · „Pe Splai bate vântul tot timpul.” (The wind always blows on the Splai.) · „Biblioteca Politehnicii e deschisă până seara.” (The Politehnica library is open until evening.) · „Pasajul Basarab se vede de la geamul meu.” (I can see the Basarab overpass from my window.)

### Prof. Ionescu (UPB lecturer) (`professor`, local, lang ro, 50-70) — 16 lines
Engineering professor in a tweed jacket, formal and dry-witted.

- *greeting*: „Bună ziua.” (Good day.) · „Bună ziua, domnule coleg.” (Good day, colleague.) · „Căutați secretariatul?” (Looking for the faculty office?)
- *bumped*: „Atenție, vă rog.” (Careful, please.) · „Mai încet, nu e examen de viteză.” (Slower, this isn't a speed exam.) · „Nu s-a întâmplat nimic.” (Nothing happened.)
- *photographed*: „Fotografiați clădirea, e mai interesantă.” (Photograph the building, it's more interesting.) · „Pentru revista facultății?” (For the faculty magazine?) · „Bine, dar repede.” (Fine, but quickly.)
- *idle*: „Am patruzeci de lucrări de corectat.” (I have forty papers to mark.) · „Studenții de azi nu mai scriu de mână.” (Students today don't write by hand anymore.) · „Ședința de consiliu e la două.” (The council meeting is at two.)
- *district*: „Politehnica are rădăcini din 1818, școala lui Gheorghe Lazăr.” (Politehnica's roots go back to 1818, Gheorghe Lazăr's school.) · „Rectoratul e pe Splaiul Independenței 313.” (The Rectorate is at Splaiul Independenței 313.) · „Accesul cu mașina e doar cu permis, la barieră.” (Car access is by permit only, at the barrier.) · „Pe vremuri veneam cu tramvaiul pe Splai.” (In the old days I came by tram along the Splai.)

### Bogdan (shaorma kiosk by the metro) (`shaorma_vendor`, vendor, lang ro, 25-45) — 16 lines
Runs a late-night shaorma window near Grozăvești metro.

- *greeting*: „Salut, șefu', ce-ți fac?” (Hi boss, what can I make you?) · „Una mare cu de toate?” (A large one with everything?) · „Bună seara, mai avem și falafel.” (Good evening, we have falafel too.)
- *bumped*: „Ai grijă la geam!” (Mind the window!) · „Hopa, era să-ți cadă sosul!” (Whoa, you nearly dropped the sauce!) · „Nu-i nimic, frate.” (No worries, bro.)
- *photographed*: „Fă poză la shaorma, e vedeta!” (Photograph the shaorma, it's the star!) · „Dă-ne și o stea pe hartă!” (Give us a star on the map!) · „Stai că zâmbesc!” (Hold on, I'll smile!)
- *idle*: „La două noaptea vin toți studenții.” (At two a.m. all the students turn up.) · „Azi s-a terminat cartofii devreme.” (We ran out of fries early today.) · „Plata și cu cardul, da.” (Card is fine, yes.)
- *district*: „Lângă metrou e cea mai bună locație din Grozăvești.” (Next to the metro is the best spot in Grozăvești.) · „Pe Orhideelor e trafic până seara târziu.” (Orhideelor has traffic until late evening.) · „Studenții de la Regie sunt cei mai buni clienți.” (The Regie students are the best customers.) · „Când plouă, se umple tot de umbrele aici.” (When it rains, this place fills with umbrellas.)

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
| Podul Grozăvești / Orhideelor | 44.4437, 26.0612 | 180 | [[7.5, 10], [16.5, 19.5]] | 0.65 | Basarab corridor overloads (+10,000 cars when Podul Grant is closed) [newsweek_basarab] [tomtom_peak] |
| Iuliu Maniu × Doina Cornea (Politehnica) | 44.4346, 26.0545 | 160 | [[7.5, 9.5], [16, 19]] | 0.6 | Militari commuter flow + campus [tomtom_peak] |
| UPB gates (term time) | 44.4381, 26.0554 | 100 | [[7.5, 9], [15, 18]] | 0.35 | students crossing, cars queuing at barrier (assumption) |

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

- facades_1970s_90s_blocks: #C9C4B8 #BDB7AA #D3CEC2 #B8B2A6
- facades_interwar_modernist: #D9D2C3
- glass_office: #7D93A0
- canal_water: #5E6F5A
- canal_concrete: #A8A499
- road: #424247
- sidewalk: #A3A097
- kerb: #9B9A94
- marking: #F4F4F0
- conf: medium/estimated

## Top 30 things a local would notice if wrong

1. The Dâmbovița is a straight concrete canal here with a one-way Splai on each bank.
2. Pasajul Basarab viaduct towers over Orhideelor — two levels, trams on it.
3. Podul Grozăvești is short; Grozăvești metro entrances at both ends.
4. Regie dorms: long rows of grey/cream 1970s student blocks on the north bank.
5. UPB Rectorat = white grid facade with red panels and a flat saucer dome on the roof, inside the fenced campus.
6. Bd. Doina Cornea has trams (1, 10, 11) in the median along the campus.
7. The Bridge glass towers (IBM, Bitdefender) on Orhideelor.
8. Lukoil station on Orhideelor (east side).
9. Students everywhere 08–20 in term time; kiosks, copy shops, cheap food.
10. Politehnica metro (M3) on Iuliu Maniu at the south edge; railway halt "Politehnica" on Doina Cornea.
11. Trolleybuses on Iuliu Maniu (61, 62, 63, 93).
12. New 11-storey offices on Iuliu Maniu (The Light One, Campus 6).
13. Poplars and lindens along the canal embankment.
14. Steel railings along the canal and on Podul Grozăvești.
15. No concrete barrier across Orhideelor at ground level.
16. Splai south bank is eastbound only, north bank westbound only.
17. Parking lots and parked cars filling campus roads.
18. Ibis Politehnica hotel by the Splai.
19. Fabrica Grivița / One Club bars at Regie.
20. Wide intersections with tram crossings at the bridge heads.
21. Cotroceni Palace area lies just south-east (outside).
22. Graffiti on canal walls and underpasses.
23. Bus 105 is the classic UPB–Regie line.
24. Evening queues on the Basarab ramps.
25. Open, flat, windy riverside — big sky.
26. Concrete lamp poles along the Splai, newer LED poles on Iuliu Maniu.
27. BCR branch in The Bridge.
28. Policlinica Regie and Sala de Sport Regie on Bd. Regiei.
29. Faculty buildings (Electronics/ETTI) at the south-east corner by the metro.
30. Dust and construction around new office projects on Iuliu Maniu.

## Gaps / to verify

- Rectorat construction year/architect not found (look confirmed from photos). Facade review 2026-11-08 (measurements in `landmark-politehnica-measurements.json`): Mister rf's 2024 Commons photos (CC BY-SA 4.0) show pale vertical concrete fins, red main-floor panels, a brick lower facade, a recessed glazed top floor, a wide roof slab and a blue-lit dome rim at night. OSM gives 5 levels, no metre height; the dome is roof part `w1217715300` (`min_level=6`), about 40 ± 4 m across on aerial imagery. Floor heights, fin depths and bay widths are estimates
- Canal/embankment details from photos pending
- Campus internal road layout only from OSM

## Reference images (`refs/grozavesti/`, 9 files, licences in LICENSES.md)

| file | taken | near | licence | facade-texture candidate |
|---|---|---|---|---|
| Politehnica_University_of_Bucharest_at_night.jpg | 2024-04-24 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest_at_night_01.jpg | 2024-04-24 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest_at_night_02.jpg | 2024-04-24 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest.jpg | 2024-01-22 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest_02.jpg | 2024-01-22 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest_03.jpg | 2024-01-22 | UPB Rectorat | CC BY-SA 4.0 |  |
| Politehnica_University_of_Bucharest_04.jpg | 2024-01-22 | UPB Rectorat | CC BY-SA 4.0 |  |
| Bitdefender_Headquarters_Bucharest_Romania.jpg | 2023-02-16 | Grozăvești metro | CC BY-SA 4.0 |  |
| RO_B_Politehnica_university_rectorate.jpg | 2004-03-20 | Politehnica campus | CC BY-SA 3.0 |  |

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
| upb_address | https://upb.ro/en/?p=14876 |
| upb_bucharest_ro | https://www.bucharest.ro/article/the-polytechnic-university-of-bucharest-a-legacy-of-innovation-and-excellence-223 |
| upb_zsn | https://zilesinopti.ro/locuri/universitatea-politehnica-din-bucuresti-upb/ |
| wp_grozavesti_metro | https://en.wikipedia.org/wiki/Groz%C4%83ve%C8%99ti_metro_station |
| adevarul_grozavesti_works | https://adevarul.ro/stiri-locale/bucuresti/de-azi-nu-se-mai-circula-in-zona-podului-1377962.html |
| newsweek_basarab | https://newsweek.ro/actualitate/podul-grant-se-deschide-doar-pe-jumatate-bucurestenii-nu-scapa-de-haos-in-trafic |
| ref_upb | https://commons.wikimedia.org/wiki/Category:Universitatea_Politehnica_din_Bucure%C8%99ti (see refs/grozavesti/LICENSES.md for the exact files) |


## District reality pass — 2026-11-08

The earlier tables above describe the historical research rectangle. The current pass follows `cities.js`'s actual Grozăvești analytic band/circles and their complete 600 m scenery ring, at scale 1:1. Sixteen fresh OSM API tiles cover latitude 44.425–44.465, longitude 26.029–26.093, including a western extension missing from the standard tile prefix. Source hashes and the independent imagery measurement ledger are in `handoffs/fidelity/d-grozavesti/source-ledger.json`. The local z18 aerial mosaic covers 44.428,26.038–44.458,26.079 at approximately 0.426 m/px; acquisition date is unknown. Only derived measurements are committed.

Heights: OSM `height` / `building:levels` where mapped; otherwise default estimates. The earlier unsupported Rectorat 24 m override was removed. Build counts and capture status from that pass are in the git history.

## Fidelity pass — 2026-11-12 (live OSM + street-level reference)

Sources: OSM API 0.6 map tiles fetched 2026-11-12 for 44.4335–44.4540, 26.0470–26.0750 (the playable geometry and its
surroundings). Street-level panoramas were looked at as a visual reference only; nothing is stored. Game views:
`node game/dev/reality/capture.cjs --district=grozavesti` (26 viewpoints added for the bridge, canal, sports grounds,
businesses and landmarks).

- **Dâmbovița** (OSM w170930341 `water=river`, r6213935): a concrete channel with sloped slab banks, green water, a black
  steel railing with posts on the quay sidewalk and a tree row between the sidewalk and the railing, on both banks. The
  aerial green raster classified the river surface as lawn (3,975 cells, about 46,000 m²), which covered the sunken channel
  with grass; green cells that touch a channel area are no longer drawn. A weir crosses the river about 100 m west of
  Podul Grozăvești (OSM w902058419); it is drawn as a low sill (its height is a model estimate).
- **Podul Grozăvești / Basarab arch** (OSM w902056192 `bridge:structure=arch`, w128304847, w128304855, trams w128304859,
  w660918286): street-level decks with a grey steel picket railing between concrete posts; the Basarab viaduct crosses
  above on blue steel girders hung from a pale grey arch. The game's arch, blue deck and street-level decks agree. All 31
  road bridge ways of live OSM match the game's bridge flag and layer; no road tunnel exists in the area.
- **CET Grozăvești**: four waisted concrete cooling towers (OSM w188102855, w188102865, w188102870, w188102882, height 50)
  and seven steel stacks (OSM w905217275–7, w905217281, w905217307–9, height 50) behind two large grey fuel tanks on
  Șoseaua Grozăvești. The towers were round blocks with windows and the stacks were missing; they are now the
  `cetgrozavesti` landmark (profile estimated).
- **Centrul Comercial Orhideea** (OSM w23557062) with **Carrefour** (OSM w925593033): pale façade with a red band, large
  blue "Carrefour" lettering above the west façade, an orange curved entrance canopy at the south-west rotunda. The sign
  and band are added (`orhideeasign`); the canopy and the façade colour are not modelled.
- **Businesses**: 116 named businesses of live OSM lie inside the playable geometry; 108 are in the game at their mapped
  place. Not in the game (categories the builder does not keep): Columbia Fitness (n6793227019), Domestina România
  (n13710547706), Manpower (n11508840180), WorkAsia.ro (n11998746459), Germag (n5862008006), Bioclinica (n14013820311),
  Debarcaderul Regie (w1429973848, marina), Grădinița nr. 168 (w1331454041, drawn as grounds without a name sign).
  Mall units beyond the playable edge are not signed by design. No game business is closed in live OSM.
- **Still different from the street** (see the backlog rows): Grozăvești metro entrance pavilion (glazed canopy at the
  south-west bridge head) is not built; the footbridge over the river by Regie (OSM w799487638) is missing; OMV and
  Lukoil have no brand dressing (Lukoil's `building=roof` is a solid slab); the Brico Dépôt / Altex box (OSM w247015071)
  is red and orange with an ALTEX sign, the game draws glass; the pedestrian passages (OSM w737986560/1, w277315766,
  Politehnica and Basarab subways) and the Basarab station footbridges (OSM w738281332–345) are not modelled.
