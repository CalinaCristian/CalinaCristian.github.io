# Seattle · `seatac` district — field research dossier

Role **research-sea-districts** · generated 2026-11-06 · machine-readable twin: [`seattle-seatac.json`](seattle-seatac.json) · photos: [`refs/seatac/`](refs/seatac/LICENSES.md)

Scope (spec 10): chapter "Welcome to Seattle" (2022) — out of Sea-Tac: the terminal loop (Departures upper / Arrivals lower drives), the garage and its skybridges, the SeaTac/Airport Link station, the Airport Expressway, and SR-518 east to the I-5 / I-405 junction. US marking, sign and furniture standards are identical to the Bellevue dossier (WSDOT + MUTCD) — see [`seattle-bellevue.md` §3–§5](seattle-bellevue.md); not repeated here. All OSM data © OpenStreetMap contributors (ODbL).

## 1. District boundary and chapter route

**Proposal**: terminal box 47.4380–47.4500 × −122.3060…−122.2930 (terminal frontage, garage, station, International Blvd hotel strip) + 200 m bands along the Airport Expressway and SR-518 to the I-5/I-405 interchange (lon −122.2640). End-of-map: "AIRPORT EMPLOYEES ONLY" barricade south of the International Arrivals Facility, International Blvd (SR 99) north of S 160th / south of S 188th, SR-518 west of the expressway (Burien), I-5/I-405 beyond the final split.

| route | path | length |
|---|---|---|
| **A** (recommended) | start on **Departures Drive** (upper, elevated, way 428095059) at the north end of the terminal (47.44557, −122.29902, heading ≈ 200°) → past the doors under skybridges 6→1 → "Return to Terminal / Exit" split → 1-lane ramp onto the **Airport Expressway** NB → "518 EAST Seattle · Tacoma" → **SR-518 EB** → final split "405 N Renton" / "5 S Tacoma Portland" (47.46195, −122.26779) | **5.62 km**, ≈ 5–6 min |
| A-short | same, end at the Airport Expressway → SR-518 merge (47.4631, −122.2879) | ≈ 3.9 km (spec 10 asks 1.5–2.5 km; the terminal frontage alone is ~0.75 km) |

| s (m) | length | stretch (OSM ways in JSON) |
|---|---|---|
| 0 | 572 | Departures Drive, elevated (layer 2), 2–3 lanes SB, terminal doors on the right |
| 572 | 182 | "Seattle-Tacoma Airport Departures" / Departures Drive descending (layer 2→1) |
| 755 | 200 | ramps "Return to Terminal" → expressway |
| 955 | 2,099 | **Airport Expressway** NB: 3→4→5 lanes, 30→40 mph |
| 3,055 | 815 | ramp "Seattle; Tacoma" → SR-518 EB merge |
| 3,870 | 1,748 | **SR-518 EB**, 3 lanes, 60 mph, to the I-5/I-405 split |

## 2. Road design

- **Departures Drive (upper roadway)**: one-way southbound viaduct along the terminal face, 2–3 lanes + drop-off kerb on the right, 20 mph (OSM `maxspeed`), asphalt deck. Overhead: **six enclosed pedestrian skybridges** ("Skybridge 1"–"Skybridge 6" in OSM, ~33–40 m long, garage level 4 ↔ terminal, ~70 m apart) ([OSM](https://www.openstreetmap.org/way/37017725)). On the left the 7-level garage.
- **Arrivals Drive (lower roadway)**: under the departures viaduct, 3–5 lanes SB, posted clearance **12 ft 0 in** (OSM `maxheight`), baggage-claim doors on the right, columns between lanes, soffit lighting.
- **Exit**: at the south end "Return to Terminal / Parking / Overheight Vehicle Parking" vs "International Blvd — SR 99, to I-5 · I-405 · SR 509" ([OSM](https://www.openstreetmap.org/way/952961192)).
- **Airport Expressway**: 3 → 5 lanes NB between the garage and the elevated Link guideway; lane destinations "Terminal Parking ×3 | Terminal Parking; International Blvd; Rental Car Return; Cell Phone Lot", later "Burien | Burien; Seattle; Tacoma | Seattle; Tacoma" ([OSM](https://www.openstreetmap.org/way/68522640)). Freeway-style markings: white 10/30 dashes, yellow left edge.
- **SR-518**: 3.42-mile freeway Burien–Tukwila, **38,000–102,000 veh/day**, busiest between the airport and I-5; becomes I-405 east of I-5 ([SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518)). OSM: 3 EB lanes, 60 mph, asphalt with concrete bridge decks; at 51st Ave S "Seattle | Renton | Tacoma; Portland; 51st Ave S; Southcenter Pkwy"; final 2-lane split Renton (left) / Tacoma-Portland (right). The Link 1 Line guideway parallels it (OSM light_rail, bridge, layer 3).

## 3. Landmarks

| id | what | key facts (source) |
|---|---|---|
| `sea-main-terminal` | Main Terminal landside face (OSM 23772634) | opened 1949, rebuilt around in 1973, central terminal by Fentress Architects 2003; 89 gates, Concourses A–D + N/S satellites ([Sea-Tac](https://en.wikipedia.org/wiki/Seattle%E2%80%93Tacoma_International_Airport)) |
| `sea-garage` | Port of Seattle garage (OSM relation 15763840, 7 levels) | **12,100 spaces, "North America's largest parking structure under one roof"** (same) |
| `seatac-airport-station` | SeaTac/Airport Link station (OSM 54139654) | opened 2009-12-19; island platform **60 ft (18 m)** up; steel-truss flight-themed roof (David Hewitt); west bridge to garage level 4 then a 1,200 ft covered walkway to the terminal; east bridge over the Airport Expressway to International Blvd ([station](https://en.wikipedia.org/wiki/SeaTac/Airport_station)) |
| `sea-control-tower` | ATC tower (OSM 1199936807) | opened 2004, cab floor 233 ft (71 m), 269 ft (82 m) overall ([Sea-Tac](https://en.wikipedia.org/wiki/Seattle%E2%80%93Tacoma_International_Airport)) |
| `sea-iaf` | International Arrivals Facility (2022) + aerial walkway 85 ft over the taxiway | (same) |

Airport signage (from OSM `destination:*` and SEA conventions): green freeway-style guide signs on the expressway/SR-518; on the drives white-on-dark terminal signs "Departures"/"Arrivals" and per-door airline listings — **the airline-to-door layout was not verified** (gap).

## 4. Businesses

Landside along the route: hotels on International Blvd (Hilton Seattle Airport, Radisson, Red Lion, Coast Gateway, Skybridge Seattle Airport Hotel, Red Roof Inn, SureStay, Rodeway Inn), **76** gas station + car wash (47.45096, −122.29545), Denny's, Wally Park and MasterPark garages, the rental-car facility (Alamo, Avis, Budget, Dollar, Enterprise, Hertz, National, Payless, SIXT, Thrifty, Fox) — all with lat/lon in `businesses[]` (`airside:false`). Airside/terminal (`airside:true`): Starbucks ×5, Hudson ×8, McDonald's (B gates), Qdoba, Pei Wei, Peet's, MAC, Coach, Tumi, Delta Sky Club, Alaska Lounge, Centurion Lounge, Salty's at the Sea, Lucky Louie Fish Shack, Ballard Brew Hall, Floret.

## 5. Congestion hotspots (feeds `CITIES.seattle.districts.seatac.congestion`)

| id | where | hours | level | evidence |
|---|---|---|---|---|
| `departures-am` | Departures Drive kerb (47.4440, −122.3000, r 250) | **04:30–07:30**, 11:00–14:00 | 0.7 | Port of Seattle: departures-level peak 4:30–7:30 a.m.; both drives back up 11–2 ([Port of Seattle](https://www.portseattle.org/node/1435), via search summary — host 403 here) |
| `arrivals-pm` | Arrivals Drive kerb | 11:00–14:00, **20:30–24:00** | 0.6 | Port of Seattle: arrivals late evening |
| `sr518-i5-i405` | SR-518 EB approaching I-5/I-405 | 06:30–09:00, 15:00–19:00 | 0.65 | up to 102,000 veh/day near I-5 ([SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518)); I-405 Tukwila↔Bellevue severe in peaks ([WSDOT dashboard](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm)); spill-back level is an **estimate** |

## 6. Top 30 things a local would notice if wrong

1. Departures is the **upper** level, Arrivals the **lower** — the drive you start on is an elevated viaduct.
2. Both drives are **one-way southbound** past the terminal.
3. **Six enclosed skybridges** cross over the drives from the garage (level 4) to the terminal.
4. The **garage is huge** (7 levels, 12,100 spaces) and fills the whole left side.
5. Speed on the drives is **20 mph**; Arrivals has a **12 ft clearance** sign.
6. Drop-off kerb on the right only; you cannot stop in the through lanes.
7. Leaving means looping south and up onto the **Airport Expressway northbound**.
8. The **Link light-rail guideway** (elevated, concrete) runs right next to the expressway; trains are Sound Transit white/blue.
9. The SeaTac/Airport station is a **tall steel-truss roof 18 m up** on the east side, bridges to the garage and to International Blvd.
10. The **ATC tower** (82 m) is visible to the north-west.
11. Expressway signs: "Terminal Parking", "Rental Car Return", "Cell Phone Lot", then "518 East Seattle / Tacoma", "518 West Burien".
12. SR-518 is a plain 3-lane freeway with **60 mph** signs, conifer-lined.
13. Final split: left **"405 N Renton"**, right **"5 S Tacoma Portland"**; I-5 North to Seattle splits earlier.
14. Freeway pavement here is **asphalt** with concrete bridge decks (darker than I-90's concrete).
15. Yellow left edge / white right edge on every carriageway; 10/30 ft dashes with reflective RPMs.
16. Green guide signs on galvanised truss gantries, yellow "EXIT ONLY" panels.
17. International Blvd (SR 99) has a **bus/HOV lane** (OSM `bus:lanes`) and RapidRide A Line stops.
18. Mid-rise airport hotels along International Blvd (Hilton, Radisson, Red Lion, Coast Gateway, 12-storey Skybridge hotel) — brand signage positions not verified.
19. A **76** station + car wash on International Blvd at ~S 168th St (OSM).
20. The rental-car facility is a separate 4-level garage north at S 160th.
21. No houses near the terminal; low-rise hotels/parking lots east, the airfield west.
22. Rain-slick asphalt and grey sky are the default (Seattle).
23. Planes on approach/departure: the three runways run nearly north–south just west of the terminal (Wikipedia).
24. Kerb-side: crowds with luggage, TNC/taxi islands on the lower level.
25. Port of Seattle police / "Active loading and unloading only" signs.
26. Morning (4:30–7:30) departures jam; late-evening arrivals jam.
27. Light rail 1 Line, not 2 Line, at SeaTac.
28. No tolls on SR-518 / Airport Expressway.
29. Night lighting on the drives and expressway: white LED is typical today (not verified for SEA).
30. The road climbs/descends between the upper drive and the expressway — no level crossings.

## 7. Gaps and confidence
- Commons has almost no CC photos of the Departures/Arrivals drives themselves; terminal facade and airline door signs **not photo-verified** (low).
- Garage facade colours estimated (`#a9a8a2` precast); terminal glass `#7c8e99` estimated.
- Building heights: only 11/95 listed buildings have OSM height/levels (hotels, offices, garage); the rest carry rule estimates.
- Port of Seattle pages are blocked (403) from the sandbox; peak hours via search summaries.
- **Photos**: none downloaded (upload.wikimedia.org rate-limited the sandbox); 11 vetted CC/PD candidates incl. a 2026 Departures-terminal photo are listed in `refs/seatac/LICENSES.md`.
- Coverage: route segments with lane counts 30/30; 95 buildings; 144 businesses (47 landside).

## 8. Sources
OpenStreetMap (ODbL) <https://www.openstreetmap.org> · [Seattle–Tacoma International Airport](https://en.wikipedia.org/wiki/Seattle%E2%80%93Tacoma_International_Airport) · [SeaTac/Airport station](https://en.wikipedia.org/wiki/SeaTac/Airport_station) · [SR 518](https://en.wikipedia.org/wiki/Washington_State_Route_518) · [Port of Seattle travel tips](https://www.portseattle.org/node/1435) · [WSDOT I-405 dashboard](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm) · WSDOT Standard Plans & MUTCD (see Bellevue dossier) · Commons photos in [refs/seatac/LICENSES.md](refs/seatac/LICENSES.md).
