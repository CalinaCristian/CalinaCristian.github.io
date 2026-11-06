# Bucharest — Otopeni — Henri Coandă (OTP) (`otopeni`): field research dossier

Role: research-buc-districts · generated 2026-11-06 22:18 UTC · machine-readable twin: `bucharest-otopeni.json` · images: `refs/otopeni/` (see LICENSES.md).

Every OSM-derived fact is keyed by OSM id (w = way, n = node, r = relation) and comes from the OSM API 0.6 snapshot of 2026-11-06 [osm]. Bracketed keys like [wp_lascar] point to the **Sources** table at the end. Confidence: *high* = OSM/official/encyclopedic; *medium* = consistent across photos/common knowledge, verify on refs; *low* = estimate.

## Coverage

| metric | value |
|---|---|
| route_streets | Bulevardul Aeroportului, Calea Bucureștilor |
| route_streets_researched | Bulevardul Aeroportului, Calea Bucureștilor |
| fronting_route_buildings | 5 |
| fronting_route_with_height | 0.0 |
| fronting_route_with_colour | 0.0 |
| fronting_route_researched | 0.0 |
| fronting_route_with_street_frontage_rule | 100.0 |
| fronting_route_with_storeys_any_source | 100.0 |
| fronting_route_with_facade_hex_any | 0.0 |
| fronting_main_buildings | 24 |
| fronting_main_with_height | 58.3 |
| buildings_total | 150 |
| buildings_with_height | 49.3 |
| businesses_total | 133 |
| businesses_on_route | 1 |
| businesses_branded | 22 |
| trees_osm | 13 |
| lamps_osm | 0 |
| crossings | 87 |
| signal_nodes | 0 |
| transit_stops | 7 |
| metro_entrances | 0 |

## Proposed boundary (~1 km²)

- Polygon (lat, lon): `[[44.56, 26.0675], [44.5745, 26.0675], [44.5745, 26.081], [44.5675, 26.081], [44.56, 26.074]]` → bbox `[44.56, 26.0675, 44.5745, 26.081]`, area **1.494 km²**.
- Why: A pentagon ≈1.3 km²: the DN1 (Calea Bucureștilor) corridor through Otopeni town from Str. Zborului (S) to the Hilton Garden Inn / Bd. Aeroportului (N), plus the landside of the airport — access roads, departures ramp (bridge, layer 1), arrivals level, multi-storey car parks, the CFR Aeroport station and the Terminal Vioara; airside (aprons, runways) left as backdrop.

## Chapter routes

### otopeni · 2022 — Henri Coandă Airport — departures (boarding for Seattle)

- **Start**: DN1 Calea Bucureștilor northbound in Otopeni (Novomatic / OMV) — `44.563825, 26.06962`, heading 2° on Calea Bucureștilor.
- **End**: Departures kerb (Plecări), elevated level, heading north along the terminal — `44.569445, 26.077273`.
- **Length**: 2332 m (computed on the OSM drivable graph respecting one-ways; routable: True).
- **Why this route**: North on DN1 (Calea Bucureștilor, 2+2 with central barrier, 70 km/h on the flyover) through Otopeni → exit 'Henri Coandă Airport' → round via Bd. Aeroportului (Hilton Garden Inn, car parks) → south on the landside road past the multi-storey car park → up the elevated departures ramp and along the Plecări glass facade to the drop-off.
- **Sequence**: Calea Bucureștilor (904 m) → (trunk_link) (105 m) → Bulevardul Aeroportului (290 m) → (tertiary) (555 m) → (service) (26 m) → (tertiary) (451 m)
- Waypoints for `CHAPTERS`/autopilot: `[{"lat": 44.564, "lon": 26.0697, "road": "Calea Bucureștilor", "bearing": 0}, {"lat": 44.57, "lon": 26.07, "road": "Calea Bucureștilor", "bearing": 0}, {"lat": 44.5694, "lon": 26.077, "bearing": 0}]`

## CV stops (verified)

### otopeni — Henri Coandă International Airport (OTP) — Departures (Plecări)

- **address**: Calea Bucureștilor 224E, Otopeni, Ilfov
- **building_osm**: w771096082 (terminal "Plecări"); arrivals w771096081 ("Sosiri"); CFR station w813193384
- **lat**: 44.57127
- **lon**: 26.07745
- **door**: lat: 44.5696; lon: 26.077; street: departures ramp (OSM w180054678: tertiary, bridge=yes, layer=1, one-way northbound along the terminal front); side: E side (terminal on the right when driving north); note: In 2022 (chapter year) cars dropped off on this elevated kerb. Since 8 Dec 2025 cars may no longer stop on the Plecări lane because of the M6 "Aeroport Otopeni" metro works: drop-off moved to the car park in front of Departures; the Sosiri multi-storey car park (588 spaces) was closed for structural repairs and taxis/ride-hailing/buses moved to Plecări.
- **building**: facade: long low terminal (2–3 storeys) with a full-height glass curtain wall facing landside, white/silver metal canopy over the kerb, big "Plecări / Departures" signs and the Bucharest Airports logo; Sosiri hall to the south is older/lower with a grey facade; glass_hex: #5F7F8E; canopy_hex: #D9DCDE; conf: medium (verify on refs) [wp_otp] [osm]
- **facts**: Romania's busiest airport: just over 17 million passengers in 2025 (+6.6 %), 142,000 movements; a new 176,000 m² terminal (30 M pax/yr) is in design (2025–26); metro M6 Gara de Nord–Aeroport under construction since Dec 2023 (target 2028); CFR train link to "Aeroport Henri Coandă" station since 2020.
- **cities_js_check**: cities.js otopeni {44.5712, 26.0850} is ~600 m EAST of the terminal, airside on the apron. Landside departures kerb is at {44.5696, 26.0770}; terminal centroid {44.5713, 26.0775}.

## Streets — route and main streets

Per-segment OSM data (lanes, turn:lanes, bus lanes, parking, trolley wires, speed, surface) is in the JSON `streets[].segments[]`. Below: research cross-sections + OSM summary.

### Calea Bucureștilor (chapter route)

- OSM: 19 ways, 4651 m in district, classes trunk, trunk_link; lanes values ['2', '3']; one-way segments 19/19; maxspeed ['50', '70']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 403, bus 441, bus 446, bus 780, bus None.
- OSM furniture: {'gate': 4, 'lift_gate': 5}.
- Fronting buildings: 13; businesses: 8.
- **cross_section**: DN1 (E60) dual carriageway, 2–3 lanes each way separated by a concrete/steel central barrier; 70 km/h through Otopeni (50 on the airport link); flyover (bridge, layer 1) by the airport; wide asphalt shoulders, roadside service lanes
- **frontage**: car dealerships, fuel stations (OMV, Rompetrol), Novomatic HQ (275-277), warehouses, hotels (Ibis Styles, Hilton Garden Inn), billboards on tall poles; flat open land
- **transit**: airport express bus 100 (Piața Unirii/Victoriei – Aeroport, STB) and 780 (Gara de Nord – Aeroport), regional 4xx buses
- confidence: lanes/speed high (OSM); frontage medium [osm]

### Bulevardul Aeroportului (chapter route)

- OSM: 8 ways, 988 m in district, classes residential, tertiary; lanes values ['1', '2']; one-way segments 6/8; maxspeed ['50', 'RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Transit lines (OSM route relations): bus 100, bus 780.
- OSM furniture: {'gate': 1, 'lift_gate': 5}.
- Fronting buildings: 10; businesses: 6.
- **cross_section**: one-way airport loop road 2 lanes (north side), Hilton Garden Inn, Olimpia parking, Airport Grill
- confidence: high (OSM) [osm]

### Drumul Gării Odăii

- OSM: 1 ways, 308 m in district, classes tertiary; lanes values ['2']; one-way segments 0/1; maxspeed ['RO:urban']; surface ['asphalt']; trolley_wire —; turn lanes tagged: False; bus/psv lanes tagged: False; tram: —.
- Fronting buildings: 6; businesses: 4.

## Squares, junctions, landmarks

- **DN1 × airport exit (trunk_link "Henri Coandă Airport")** — grade-separated diverge; flyover;  [osm]
- **Henri Coandă terminal** (`otp`, w771096082) — control tower and aircraft tails (TAROM blue/white, Wizz Air pink/purple, Blue Air (defunct), Lufthansa…) visible beyond the terminal [wp_otp]
- **Aeroport Henri Coandă CFR station** (`cfr_station`, w813193384) — small modern station with covered walkway to the terminal (2020) [osm]
- **M6 metro works (Aeroport Otopeni station)** (`m6_works`, ) — construction hoardings in front of Departures since 2024 — optional for the 2022 chapter [wp_m6] [otp_parking_m6]

Signalised / main junctions on the chapter routes (OSM):

| node | streets | signals | roundabout | crossings ≤40 m |
|---|---|---|---|---|

## Key buildings (researched)

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w756554173 | Hilton Garden Inn Bucharest Airport | 4 / 12 |   |  |  |  [osm] |
| w771096081 | OTP Arrivals (Sosiri) | 2 /  | #B9BDBF  |  |  |  [wp_otp] [osm] |
| w216626527 | TAROM office | 4 / 20 |   |  |  |  [osm] |
| w771096082 | OTP Departures (Plecări) | 3 / 20 | #5F7F8E glass curtain wall + white metal canopy | flat/curved metal |  | otopeni [wp_otp] [osm] |

## Buildings fronting the chapter routes (all, from OSM + style rules)

`facade_hex_est` is a district style-rule estimate (not observed) — research values override. Side = compass side of the street axis.

| OSM | street | side | addr | type | levels | height | year | condition | style (est.) | facade | shops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| w267125181 | Bulevardul Aeroportului | SE |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w267125197 | Bulevardul Aeroportului | S |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w703958634 | Calea Bucureștilor | E |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |
| w244429098 | Calea Bucureștilor | E | 224D | roof · OMV | 1 est |  |  |  | utility/annex |  | 1 |
| w1506836377 | Calea Bucureștilor | E |  | yes | 2 est |  |  |  | unknown (use district rule) |  | 0 |

## Ground-floor businesses on the chapter routes

| OSM | name | brand / sign colours | kind | street | side | addr |
|---|---|---|---|---|---|---|
| w244429098 | OMV | OMV bg #FFFFFF fg #0A2165 | amenity=fuel | Calea Bucureștilor | E | 224D |

Other branded businesses in the district (off-route): Rompetrol (Calea Bucureștilor, w312547071); Rompetrol (Strada Nicolae Grigorescu, w918040922); BRD (, n11257054224); BRD (, n11257028031); BRD (, n11594858571); CEC Bank (, n11257054219); Carrefour Express (, n4892173053); Euronet (, n11257054216); Euronet (, n11257054217); Euronet (, n11257054221); Euronet (, n11257054223); Euronet (, n11257054226); Euronet (, n11257054233); Fornetti (, w1360360981); Gloria Jean's (, w1360387415); Hilton Garden Inn (, w756554173); Ibis Styles (, w918040921); Raiffeisen Bank (, n11257054231); Raiffeisen Bank (, n11594858572); Alpha Bank (, n11594858570); UniCredit (, n11594858573).

## Transit

- Lines with OSM route relations touching the district: bus 100, bus 403, bus 441, bus 446, bus 780, bus None.
- Stops: Aeroport Henri Coandă Plecări (bus); Aeroport Henri Coandă Sosiri (bus); Aeroportul Henri Coandă (bus); Filan (bus); Mir Trans Bus Stop (bus).
- Liveries:
  - **tram_imperio**: Astra Vagoane Arad Imperio Metropolitan (100 ordered 2021, in service since Dec 2022; 3-section, 100% low floor); body #F4C300 accent #C8102E; yellow STB body with darker front mask; verify accent colours on refs (medium) [imperio] [imperio2] [wp_transport]
  - **tram_v3a**: V3A-93 / V3A-93-2000 / V3A-CH-PPC (articulated, Bucharest URAC-built); body #F2C230 accent #B5121B; yellow with red stripe; frequent full-body advertising wraps (medium) [stb]
  - **tram_bucur**: Bucur LF / Bucur 1 (modernised V3A with low-floor middle section); body #F2C230 accent #1F4E9A;  (low)
  - **trolleybus**: Astra-Ikarus 415T (163 of 265 in 2022, 1990s high-floor, 2-axle 12 m) + Solaris Trollino 12 (100 delivered from 2024) + Astra Citelis; body #F4C300 accent #C8102E;  (medium) [wp_transport]
  - **bus**: Mercedes-Benz Citaro (1,000 delivered 2006–2009), Citaro Hybrid (2020+), Otokar Kent C 12/18 m, Mercedes eCitaro / BYD electric; body #F4C300 accent #C8102E; STB yellow; Citaro hybrids yellow with STB logo; many carry ad wraps (medium) [stb]
  - **taxi**: ; body #F7D417 accent ; Bucharest licensed taxis are yellow with chequer/stripe and company name/phone on doors (Dacia Logan, Toyota Corolla/Prius, Škoda Octavia) (high)
  - **ride_hail**: ; body  accent ; Uber/Bolt cars are unmarked (any colour), very common (high)

## Traffic / congestion (feeds `congestion`, spec 13)

- City: ; worst slot  [tomtom_peak]

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| DN1 southbound towards Băneasa (Otopeni) | 44.562, 26.0697 | 400 | [[7, 10], [16.5, 20]] | 0.65 | commuter queues; northbound lighter in the morning [tomtom_peak] |
| Departures kerb / ramp | 44.5696, 26.077 | 150 | [[4.5, 7.5], [15, 20]] | 0.45 | wave departures early morning; drop-off congestion, taxis [otp_plecari_2025] [otp_taxi_guide] |

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

- glass_office: #5F7F8E
- facades_1970s_90s_blocks: #D7D5CF #BFC2C4
- road: #3E3E43
- barrier: #9EA2A4
- sidewalk: #A9A59C
- marking: #F4F4F0
- conf: medium/estimated

## Top 30 things a local would notice if wrong

1. DN1 is a dual carriageway with a central barrier, 70 km/h, flyover at the airport.
2. The departures kerb is ELEVATED (upper level), arrivals below.
3. OTP terminal = long glass front with a white canopy and "Plecări/Departures" signage.
4. Aircraft tails and the control tower visible beyond the terminal.
5. Yellow taxis and lots of ride-hailing cars at the kerb.
6. Express bus 100 / 780 (STB yellow) stops at the terminal.
7. CFR train station with covered walkway north-west of the terminal.
8. Multi-storey car parks opposite the terminal.
9. Since late 2024–25: M6 metro construction hoardings in front of Departures (not in 2022).
10. Hilton Garden Inn and Ibis Styles near the exit.
11. Fuel stations (OMV, Rompetrol) on DN1 in Otopeni.
12. Billboards on tall poles along DN1.
13. Flat, open landscape; few trees.
14. Security/police presence at the kerb; "Kiss & Go" style signs.
15. Planes landing/taking off on the two parallel 3,500 m runways 08R/26L and 08L/26R (OSM).
16. Novomatic HQ glass building on DN1.
17. Car dealerships lining DN1.
18. Wide shoulders and bus bays on DN1.
19. Overhead gantry direction signs (blue for DN, white for local) to "Aeroport Henri Coandă".
20. Speed cameras/radars on DN1 (local reputation).
21. Night: tall sodium/LED masts lighting the airport roads.
22. Rental-car lots and parking shuttles.
23. Departures hall glows at night through the glass.
24. TAROM office building near the access road.
25. Arrivals (Sosiri) hall older and lower than Departures.
26. Trolley-luggage crowds on the sidewalk.
27. Ilfov county (not Bucharest) — different street signs (blue "Otopeni" town signs).
28. Concrete Jersey barriers at the ramps.
29. Wizz Air pink/purple tails dominate the apron.
30. Gloria Jean's, Fornetti, Carrefour Express inside the terminal.

## Gaps / to verify

- Terminal facade details pending licensed photos
- Exact 2022 kerb layout vs 2025 changes

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
| wp_otp | https://en.wikipedia.org/wiki/Henri_Coand%C4%83_International_Airport |
| wp_m6 | https://en.wikipedia.org/wiki/Bucharest_Metro_Line_M6 |
| otp_2025_traffic | https://www.romania-insider.com/index%2Ephp/traffic-bucharest-airports-2025 |
| otp_17m | https://www.teamfrance-export.fr/infos-sectorielles/39842/39842-laeroport-de-bucarest-otopeni-a-enregistre-17-m-de-passagers-en-2025 |
| otp_new_terminal | https://www.wall-street.ro/articol/transporturi-and-infrastructura/noul-terminal-otopeni-intra-in-etapa-de-proiectare.html |
| otp_parking_m6 | https://www.romania-insider.com/bucharest-airport-parking-close-construction-works-subway-line-2024 |
| otp_plecari_2025 | https://playtech.ro/2025/accesul-interzis-cu-masina-la-terminalul-plecari-al-aeroportului-otopeni-noile-rute-auto-anuntate-de-autoritati/ |
| otp_sosiri_parking | https://www.euronews.ro/articole/aeroportul-otopeni-parcarea-de-la-sosiri-inchisa-pentru-consolidare-ce-alternativ |
| otp_taxi_guide | https://www.inyourpocket.com/bucharest/The-Definitive-Guide-to-Finding-a-Taxi-at-Bucharest-Airport_74243f |
