# Seattle · `seatac` district — research dossier

Machine-readable twin: [`seattle-seatac.json`](seattle-seatac.json) · businesses and speed limits: [`businesses-seattle-seatac.md`](businesses-seattle-seatac.md) · photo candidates: [`refs/seatac/LICENSES.md`](refs/seatac/LICENSES.md) (none downloaded).

Scope (spec 10): chapter "Welcome to Seattle" (2022), out of Sea-Tac: the terminal loop (Departures upper / Arrivals lower drives), the garage and its skybridges, the SeaTac/Airport Link station, the Airport Expressway and SR-518 east to the I-5 / I-405 junction. US marking, sign and furniture standards are those of the Bellevue dossier (WSDOT + MUTCD), [`seattle-bellevue.md` §3–§5](seattle-bellevue.md). All OSM data © OpenStreetMap contributors (ODbL).

Street-level reviews (2026-11-12/13) compared game renders with official Street View panoramas at the same pose (ids from coverage metadata; looked at only, nothing stored, traced or measured). Reference poses are in `game/dev/reality/viewpoints.json` (`district: seatac`).

## 1. District boundary and chapter route

Terminal box 47.4380–47.4500 × −122.3060…−122.2930 (terminal frontage, garage, station, International Blvd hotel strip) plus 200 m bands along the Airport Expressway and SR-518 to the I-5/I-405 interchange (lon −122.2640). Natural ends: the "AIRPORT EMPLOYEES ONLY" barricade south of the International Arrivals Facility, International Blvd (SR 99) north of S 160th / south of S 188th, SR-518 west of the expressway (Burien), I-5/I-405 beyond the final split.

Route A: start on **Departures Drive** (upper, elevated, w428095059) at the north end of the terminal (47.44557, −122.29902, heading ≈ 200°) → under skybridges 6→1 → "Return to Terminal / Exit" split → ramp onto the **Airport Expressway** NB → "518 EAST Seattle · Tacoma" → **SR-518 EB** → final split "405 N Renton" / "5 S Tacoma Portland" (47.46195, −122.26779): 5.62 km. Spec 10 asks 1.5–2.5 km; the terminal frontage alone is ~0.75 km, and ending at the expressway → SR-518 merge (47.4631, −122.2879) gives ≈ 3.9 km.

| s (m) | length | stretch |
|---|---|---|
| 0 | 572 | Departures Drive, elevated (layer 2), 2–3 lanes SB, terminal doors on the right |
| 572 | 182 | Departures Drive descending (layer 2→1) |
| 755 | 200 | ramps "Return to Terminal" → expressway |
| 955 | 2,099 | Airport Expressway NB: 3→4→5 lanes, 30→40 mph |
| 3,055 | 815 | ramp "Seattle; Tacoma" → SR-518 EB merge |
| 3,870 | 1,748 | SR-518 EB, 3 lanes, 60 mph, to the I-5/I-405 split |

## 2. Roads and decks

- **Departures Drive (upper)**: one-way SB viaduct along the terminal face, 2–3 lanes + drop-off kerb on the right, 20 mph (OSM `maxspeed`). Overhead: **six enclosed skybridges** ("Skybridge 1"–"6" in OSM, ~33–40 m long, garage level 4 ↔ terminal, ~70 m apart; [w37017725](https://www.openstreetmap.org/way/37017725)). On the left the 7-level garage. Upper deck against the garage with a concrete barrier: matches the panoramas in type.
- **Arrivals Drive (lower)**: under the viaduct, 3–5 lanes SB, posted clearance **12 ft 0 in** (OSM `maxheight`), baggage-claim doors on the right, round columns between the lanes and the garage wall.
- **Exit** at the south end: "Return to Terminal / Parking / Overheight Vehicle Parking" vs "International Blvd — SR 99, to I-5 · I-405 · SR 509" ([w952961192](https://www.openstreetmap.org/way/952961192)).
- **Airport Expressway**: 3 → 5 lanes NB between the garage and the Link guideway; lane destinations "Terminal Parking ×3 | Terminal Parking; International Blvd; Rental Car Return; Cell Phone Lot", later "Burien | Burien; Seattle; Tacoma | Seattle; Tacoma" ([w68522640](https://www.openstreetmap.org/way/68522640)). Over S 170th St (w23609851, w1165458667, w6429448; outlines w598629034, w1165460002, w598629039 beam): concrete girder bridges on column bents, street at grade — matches. At 47.45097, −122.30067 reality is one wide carriageway with a painted gore between expressway and ramp; the slot between the mapped decks is filled as painted asphalt gore (US link gores, world.js median fill).
- **SR-518**: 3.42-mile freeway Burien–Tukwila, 38,000–102,000 veh/day, busiest between the airport and I-5; becomes I-405 east of I-5 ([SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518)). OSM: 3 EB lanes, 60 mph, asphalt with concrete bridge decks; at 51st Ave S "Seattle | Renton | Tacoma; Portland; 51st Ave S; Southcenter Pkwy"; final 2-lane split Renton (left) / Tacoma-Portland (right).
- **Deck guards** (`bridge-guards.json`): concrete barriers on the expressway (w6429448, w23609851, w1165458667), its ramps (w291552722, w428094930, w1165458668), Departures Drive (w37017723, w963677010, w428095059, exit w1548998258), Airport Departures (w427909577, w428003817), Ramp w31928842, Exit to Parking w103929484, w369418216 and w124272635 (seen from below only). Rideshare ramp w955297074: solid parapet with a pipe rail. Garage service decks w955297071 / w722314207 / w1165140428 / w1165151564 / w256517923: solid concrete walls (seen from the surface car park; weak).
- **Garage aisles**: OSM maps the Port garage's aisles (rel 15763840) as `highway=service` on `layer=2` (w344201644-55, w430427477, w430442190, w722071151-60, w1444470941, ramp w521034679) and `layer=1` `tunnel=building_passage` `level=3` drives. A way on layer ≥ 1 lying wholly inside a multi-storey car park is taken as an internal deck (`game/src/garage-decks.js`): not drawn, not routable. The ground-level entry ways stay as mapped but have no mapped exit, so they are not routable.
- **Sign gantries** on the expressway are not drawn: not in OSM and their text is not legible in any panorama.

## 3. Landmarks

| id | what | key facts (source) |
|---|---|---|
| `sea-main-terminal` | Main Terminal landside face (OSM 23772634) | opened 1949, rebuilt around in 1973, central terminal by Fentress Architects 2003; 89 gates, Concourses A–D + N/S satellites ([Sea-Tac](https://en.wikipedia.org/wiki/Seattle%E2%80%93Tacoma_International_Airport)) |
| `sea-garage` | Port of Seattle garage (OSM relation 15763840, 7 levels) | 12,100 spaces, "North America's largest parking structure under one roof" (same) |
| `seatac-airport-station` | SeaTac/Airport Link station (OSM 54139654) | opened 2009-12-19; island platform **60 ft (18 m)** up; steel-truss flight-themed roof (David Hewitt); west bridge to garage level 4 then a 1,200 ft covered walkway to the terminal; east bridge over the Airport Expressway to International Blvd ([station](https://en.wikipedia.org/wiki/SeaTac/Airport_station)) |
| `sea-control-tower` | ATC tower (OSM 1199936807) | opened 2004, cab floor 233 ft (71 m), 269 ft (82 m) overall (Sea-Tac article) |
| `sea-iaf` | International Arrivals Facility (2022) + aerial walkway 85 ft over the taxiway | (same) |

Review against panoramas (2026-11-12):
- Terminal: glazed curtain wall, garage opposite — match. Terminal curb canopy, airline door signs and the airline-to-door layout are approximations (not verified).
- Control tower: shaft and cab match; the base building is beige concrete with dark window strips.
- Garage: facade columns round with a red band at street level (drawn 8-sided; band 0.9–1.8 m is an estimate). Garage `#a9a8a2` precast and terminal glass `#7c8e99` are estimated colours.
- Station: elevated guideway and truss canopy match. **Station footbridge over International Blvd** (footway w54139652, outline w469766790 `bridge:structure=beam`): open white steel truss around a glazed walkway with a thin flat roof, landing east of the road on a dark steel open stair tower with a glazed lift shaft (building w469766788); authored in `bSeaLink` (landmarks.js).
- Panoramas on the airport access road at S 182nd St predate the 2022 International Arrivals Facility; OSM (w734002404) is kept.

## 4. Link 1 Line guideway (`game/src/seatac-guideway.js`, `guideway-ocs.js`)

- OSM: both main tracks, the pocket-track sidings and the crossovers are `railway=light_rail`, `bridge=yes`, `layer=3` (w34746781, w260383054, w164665648, w260383057, w911020383/5/6/7, w916372227) from south of the district to 47.45198, −122.3002; north of that the tracks (w165240080 / w165240081) carry no bridge tag. Reality: a concrete box girder on single columns beside the expressway.
- Drawn at the station's sourced rail level (platform 18 m, §3), coming down to grade over the last 358 m. Round the station and pocket track the mains are 9.4–12 m apart; they share one deck below 14 m (pier between the tracks), siding decks sit just inside it.
- Overhead line: contact wire and messenger over each main track, a pole with a cross arm every 55 m.
- **Estimates** (OSM maps no supports, no published drawing found): pier positions and spacing (34 m; piers only clear of carriageways and buildings), girder depth 1.8 m, deck width 2 × 2.6 m plus the track spacing, wire / pole heights and spacing.
- Not drawn: the bridge ways w165240082 / w165240083 towards SR-518 (0.4–1.2 km north-east, outside the district, no sourced height). No trains: the game has no light-rail service (a simplification).

## 5. Ground levels west of International Blvd (open)

USGS 3DEP (epqs.nationalmap.gov, 2026-11-13): 107.9 m on International Blvd at 47.4475 and 110.8 / 115.2 / 114.6 m at 26 / 52 / 130 m west of it; 107.2 → 110.3 m at 47.4460; 113.4 → 122.0 m at 47.4490. Between S 176th and S 170th the boulevard lies below a ~3 m concrete retaining wall, rockery and planted bank carrying the expressway and the station, which stand 3–9 m above it. The district world is flat ground (only road decks and ramps have heights) and OSM maps no retaining wall there, so the step is not drawn: a wall with a berm behind it would put the expressway side below its own bank. Needs ground heights outside the road decks (backlog seatac-6).

## 6. Buildings, hotels and car parks

- **Hotels** get their own name as the sign and a windowed block facade (world.js "principal occupant" rule). Hilton (r5186200, white 3–4-storey wings behind trees), Radisson (w314940617, 7 storeys), Ramada (w374790721, cream stucco, arched windows), Red Roof Inn (w246328444, 4 storeys), Skybridge hotel (w246328436, 12-storey concrete tower), Motel 6 (w374790724, 2-storey motel). Hotels without `building:levels`, set from panoramas in `building-review.js`:
  - Rodeway Inn w647567422: two-storey orange motel, blue trim and entrance canopy → 6.5 m, 2 storeys.
  - Red Lion Inn w364221560: beige wing with a brick-red end, three window rows above a 4 m hedge → 13 m, 4 storeys (hidden ground storey estimated).
  - SureStay w314940622: only an old panorama (Clarion signage), at least three storeys behind a one-storey front; the 9 m default is an estimate.
- **Hilton wing skybridge** (corridor w1035290131 in outline w1035290130): low white enclosed corridor with a glazing band and a flat roof (`pedestrian-bridges.js` 'enclosed'). Width 4.6 m and soffit 4.4 m are estimates.
- **MasterPark** w433205175 (`parking=multi-storey`, no height in OSM): glazed ground floor, five open decks and a glazed stair tower (panorama 47.452126, −122.295417 h95) → 6 levels, 18.6 m (estimate from the count; `car-parks.js`).
- **Car park w479818870** (47.44449, −122.29277): white clad curved walls with a PARKING portal, not open decks; drawn solid-clad. Level count unknown (no OSM height/levels; the only panorama, KauyPKtqD_ylEozRWpdOXg, cuts the upper levels): 3 levels from the pack's 9 m height is an estimate.
- Also matching: office towers at S 180th (w294862715, w294862744, 13 Coins: two dark-glass towers); 17262 International Blvd, a fenced cleared lot. Not seen from any street panorama, drawn from OSM with the class look: the hotel pool (47.444558, −122.294232) and the garage rideshare ramps (47.4430, −122.2982).
- Only 11 of 95 listed buildings have OSM height/levels; the rest carry rule estimates.

## 7. Fuel stations (`fuel-look.js`)

- **76** w433205179 (mapped canopy): 3 islands, light grey fascia with a thin orange top line, kiosk under the canopy (bpGv_kTfou2TMftytaQqEQ h98); an older panorama shows a red fascia (rebranded since). No pylon on the International Blvd frontage.
- **Shell** n824050627 (node; checked 2024-06-16): its two canopies are mapped as untagged `building=roof` `layer=1` ways w647569414 / w647566814 (covered service ways with `maxheight=13'0"` under them). Drawn with the Shell fascia (yellow over red) on both, pumps under each, and a slim white pylon at the corner, in front of the Food Mart w647569318. Canopy height / clearance are the pack's estimates.

## 8. Businesses

Landside along the route: hotels on International Blvd (Hilton, Radisson, Red Lion, Coast Gateway, Skybridge, Red Roof Inn, SureStay, Rodeway Inn), the 76 station + car wash, Denny's, Wally Park and MasterPark, the rental-car facility (a separate 4-level garage north at S 160th: Alamo, Avis, Budget, Dollar, Enterprise, Hertz, National, Payless, SIXT, Thrifty, Fox) — `businesses[]` with `airside:false`. Airside (`airside:true`): Starbucks ×5, Hudson ×8, McDonald's (B gates), Qdoba, Pei Wei, Peet's, MAC, Coach, Tumi, Delta Sky Club, Alaska Lounge, Centurion Lounge, Salty's at the Sea, Lucky Louie Fish Shack, Ballard Brew Hall, Floret.

Live OSM (2026-11-12): 172 named businesses / amenities in the bbox, about 140 airside; all but the Hilton's hotel record and non-commercial desks are POIs. Bibito Cafe (n14111796067, 47.4563129, −122.2930413) and Olympia Coffee (n14189991289, Concourse C) were re-mapped in 2026 and stay.

## 9. Monuments

Three placed outdoors (Celestial Navigation, Talking Fountain, one statue); works inside the terminal are not drawn. Artwork n8604417196 (statue, no name) is the generic statue class (no likeness: the nearest panoramas show nothing recognisable). Not drawn, no panorama within 50 m: cloudsandclunkers n3643290937, Pantopol V n5164278023, Infinity Column n14013735472. Bow Lake (w37023588) is not visible from any public road.

## 10. Congestion hotspots (feeds `CITIES.seattle.districts.seatac.congestion`)

| id | where | hours | level | evidence |
|---|---|---|---|---|
| `departures-am` | Departures Drive kerb (47.4440, −122.3000, r 250) | **04:30–07:30**, 11:00–14:00 | 0.7 | Port of Seattle: departures-level peak 4:30–7:30 a.m.; both drives back up 11–2 ([Port of Seattle](https://www.portseattle.org/node/1435), via search summary — host 403) |
| `arrivals-pm` | Arrivals Drive kerb | 11:00–14:00, **20:30–24:00** | 0.6 | Port of Seattle: arrivals late evening |
| `sr518-i5-i405` | SR-518 EB approaching I-5/I-405 | 06:30–09:00, 15:00–19:00 | 0.65 | up to 102,000 veh/day near I-5 ([SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518)); I-405 Tukwila↔Bellevue severe in peaks ([WSDOT dashboard](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm)); spill-back level is an **estimate** |

## 11. What a local would notice if wrong

1. Departures is the upper level, Arrivals the lower; both drives are one-way southbound; drop-off on the right only.
2. Six enclosed skybridges from garage level 4 to the terminal; the 7-level garage fills the left side.
3. 20 mph on the drives; 12 ft clearance on Arrivals; "Active loading and unloading only" and Port of Seattle police signs; crowds with luggage, TNC/taxi islands on the lower level.
4. Leaving means looping south and up onto the Airport Expressway NB; the road climbs/descends between levels, no level crossings.
5. The Link guideway (concrete, elevated) runs beside the expressway; 1 Line (not 2 Line) at SeaTac; trains Sound Transit white/blue.
6. The station's tall steel-truss roof 18 m up, bridges to the garage and to International Blvd; the 82 m ATC tower to the north-west.
7. Expressway signs "Terminal Parking", "Rental Car Return", "Cell Phone Lot", then "518 East Seattle / Tacoma", "518 West Burien"; final split left "405 N Renton", right "5 S Tacoma Portland" (I-5 North splits earlier).
8. SR-518: plain 3-lane conifer-lined freeway, 60 mph, asphalt with concrete bridge decks, no tolls.
9. Yellow left / white right edge lines on every carriageway; 10/30 ft dashes with RPMs; green guide signs on galvanised truss gantries, yellow "EXIT ONLY" panels.
10. International Blvd (SR 99) has a bus/HOV lane (OSM `bus:lanes`) and RapidRide A Line stops; mid-rise hotels along it (brand sign positions not verified).
11. No houses near the terminal: hotels and parking east, the airfield west; the three runways run nearly north–south just west of the terminal.
12. Morning (4:30–7:30) departures jam, late-evening arrivals jam. White LED night lighting is typical (not verified for SEA).

## 12. Open questions and gaps

- **Pedestrian plazas** (r3-look-14, 2026-11-13): a mapped pedestrian area (`highway=pedestrian|footway` + `area=yes`,
  `area:highway`, `place=square`; `pedestrian-plazas.js`) is drawn paved over its whole polygon unless its OSM `surface` is
  grass (no surface tag counts as paved); mapped grass / park polygons inside stay. Rule as in `bucharest-romana.md`
  section 8; not compared with a panorama. Here: 1 plaza, untagged (paved).
- Ground step west of International Blvd (§5).
- Car park w479818870 level count and SureStay storeys (§6).
- Terminal facade, curb canopy and airline door signs are not photo-verified (Commons has almost no CC photos of the drives).

## 13. Sources

OpenStreetMap (ODbL) <https://www.openstreetmap.org> · [Seattle–Tacoma International Airport](https://en.wikipedia.org/wiki/Seattle%E2%80%93Tacoma_International_Airport) · [SeaTac/Airport station](https://en.wikipedia.org/wiki/SeaTac/Airport_station) · [SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518) · [Port of Seattle travel tips](https://www.portseattle.org/node/1435) (403 from the sandbox; peak hours via search summaries) · [WSDOT I-405 dashboard](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm) · USGS 3DEP elevation (epqs.nationalmap.gov) · WSDOT Standard Plans & MUTCD (Bellevue dossier) · Commons photo candidates in [refs/seatac/LICENSES.md](refs/seatac/LICENSES.md).
