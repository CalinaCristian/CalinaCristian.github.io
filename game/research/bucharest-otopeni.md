# Bucharest — Otopeni — Henri Coandă (OTP) (`otopeni`): research dossier

The reference for why the Otopeni district looks the way it does. Facts are keyed by OSM id (w = way, n = node, r = relation);
bracketed keys point to **Sources** at the end. Git history keeps the round-by-round review notes this page replaced.

## 1. Overview and sources

- **Machine-readable twin**: `bucharest-otopeni.json` (generated 2026-11-06 from the OSM API 0.6 snapshot of that day): coverage
  metrics, per-segment street data, all buildings with style-rule estimates (`buildings[]`, reviewed values under
  `buildings[].research`), junctions, crossings, transit stops and liveries, colour palette, Bucharest-wide streetscape rules
  (`city_rules`), "things a local would notice" (`top_local_details`), pedestrian dialogue and the sources table.
  Businesses: `businesses-bucharest-otopeni.json` (one entry per business, section 6); speed limits: `speedlimits.json`.
  Reference photos: `refs/otopeni/` (licences in `LICENSES.md`).
- **Extraction area**: bbox `[44.552, 26.062, 44.578, 26.093]` (world bbox of `cities.js` BUC_DISTRICTS, 7.1 km²): the DN1
  (Calea Bucureștilor) corridor through Otopeni town plus the landside of the airport. Airside (aprons, the two parallel
  3,500 m runways 08R/26L and 08L/26R) is backdrop. Otopeni is in Ilfov county, not Bucharest (blue "Otopeni" town signs).
- **Method** (fidelity passes 2026-11-12/13): live OSM (Overpass, bbox 44.5524,26.0645 – 44.5729,26.0820) decides position
  and kind; official street-level panoramas were looked at for appearance only (ids from coverage metadata; nothing stored,
  traced or measured). Game views: `game/dev/reality/viewpoints.json` (`otp-*`). Not reviewed: the airside, the terminal
  interior, DN1 north of the playable edge (≈ 44.5694), night views.

## 2. Chapter and CV stop

- **Chapter `otopeni` (2022, departure for Seattle)**: start on DN1 northbound at 44.5560, 26.0700 (`cities.js` CHAPTERS,
  authoritative), through Otopeni, exit "Henri Coandă Airport", round via Bd. Aeroportului and the landside road, up the
  elevated departures ramp to the Plecări kerb. Research route length 3.24 km on the OSM drivable graph.
- **Stop: Henri Coandă International Airport, Departures (Plecări)**, Calea Bucureștilor 224E. Terminal w771096082 ("Plecări"),
  arrivals w771096081 ("Sosiri"), CFR station w813193384. Door 44.5696, 26.0770 on the departures ramp w180054678 (tertiary,
  `bridge=yes`, `layer=1`, one-way northbound along the terminal; terminal on the right). The stop was first airside
  ≈ 600 m east; it is now this landside kerb.
- **Drop-off history**: in 2022 cars dropped off on the elevated kerb. Since 8 Dec 2025 cars may not stop on the Plecări lane
  (M6 works): drop-off moved to the car park in front of Departures; the Sosiri multi-storey car park (588 spaces) closed for
  structural repairs; taxis / ride-hailing / buses moved to Plecări [otp_plecari_2025] [otp_sosiri_parking]. The game models
  the 2022 layout.
- **Terminal**: long low terminal (2–3 storeys), full-height glass curtain wall landside (#5F7F8E), white / silver metal canopy
  (#D9DCDE), "Plecări / Departures" signs; Sosiri to the south is older, lower and grey (#B9BDBF). Airside: a row of concrete
  arches and the red-white control tower to the east [wp_otp] [ref_otp].
- **Airport facts**: just over 17 M passengers in 2025 (+6.6 %), 142,000 movements; a new 176,000 m² terminal (30 M pax/yr) in
  design (2025–26); metro M6 Gara de Nord – Aeroport under construction since Dec 2023 (target 2028); CFR train to
  "Aeroport Henri Coandă" since 2020 [otp_17m] [otp_2025_traffic] [otp_new_terminal] [wp_m6].

## 3. Streets and traffic

- **DN1 / Calea Bucureștilor** (E60; trunk / trunk_link, all ways one-way): dual carriageway, three lanes each way (OSM
  `lanes=3`), 70 km/h through Otopeni and on the flyover, 50 on the airport link. Seen at 44.5595, 44.5672, 44.5687 and
  44.568650, 26.069899: one continuous concrete New Jersey barrier between the carriageways; kerb, sidewalk, bollards and grass
  on the outer edges, no guard rail in town. Game: one barrier on the line between the carriageways (`dualCarriagewayBarrier`
  in `cities.js`, rule in `world.js`); plain trunk edges with a mapped sidewalk of 1.2 m or more get no generated concrete
  guard (`world.js`; only DN1 qualifies in the eight districts). Frontage: car dealerships, fuel stations, Novomatic HQ,
  warehouses, hotels, billboards on tall poles, flat open land. Transit: STB express buses 100 and 780, regional 4xx.
- **Bd. Aeroportului**: one-way airport loop (2 lanes, north side), Hilton Garden Inn (w756554173, 4 lv / 12 m), car parks.
- **Access road from DN1 under the rail viaduct** (panoramas 44.568636, 26.071303; 44.56877, 26.07244; 44.56878, 26.0734):
  two lanes, grass verges, sidewalk on the south side only (the game also has a sidewalk with bollards on the north side).
- **Signs**: blue gantry signs for DN routes, white for local, to "Aeroport Henri Coandă".
- **Congestion hotspots** (feed `congestion`): DN1 southbound towards Băneasa (44.562, 26.0697, r 400 m, 7–10 and 16:30–20,
  level 0.65; northbound lighter in the morning) [tomtom_peak]; departures kerb / ramp (44.5696, 26.077, r 150 m, 4:30–7:30
  and 15–20, level 0.45; early-morning departure waves, taxis) [otp_plecari_2025] [otp_taxi_guide].
- **Speed limits on the route** (OSM maxspeed = game): Calea Bucureștilor trunk 70; airport tertiary 50 (tagged 50 or
  `RO:urban`). Romanian rules: 50 km/h inside localities unless signed; the road owner may sign 30–80 (OUG 195/2002 art. 49)
  [speed_ro].
- **Rompetrol on Str. Nicolae Grigorescu** (w918040922): the street and the DN1 northbound carriageway south of it form a
  pocket entered only from the southern map edge; no legal route reaches it from the chapter start inside the district (no join
  is invented). The map's Gas stations list offers a station only when a route reaches it (`main.js` `stationOffered`); it
  stays a real POI.

## 4. Structures

- **CFR airport railway viaduct** (w681892716 bridge / layer 1; w681892717 / w681892718 / w1474519622 / w1474519623 layer 2;
  all `height=5`, `min_height=5`): crosses DN1 at ≈ 44.5678, 26.0698, curves north-east and runs above the airport access road
  to the station. Seen at 44.56716, 26.06980 (looking north) and 44.56877, 26.07244 (under it): steel trough girder with
  vertical stiffeners and a top railing on concrete wall piers; the span over DN1 is green, the girders along the access road
  light grey; piers beside the carriageway. Built from `data.railways` (`elevated-sources.js`): soffit = OSM `min_height`; piers
  never stand on a carriageway (a portal or offset column carries a crosshead where the road runs under the deck).
- **Footbridges over DN1**: w1051337378 (44.55417, 26.06919; steps w1051337377 / w1051337379), w433374768 at the ICSITMUA bus
  stops (44.56023, 26.06939; steps w433374755 / w433374760, `surface=metal`), w319077395 by Casa Românească (44.56941,
  26.06987; steps w319077386 / w319077400, `step_count=16`). Seen at 44.55949, 26.06944 and 44.56865, 26.06990: steel truss,
  a stair flight at each end, both sides covered by advertising banners. Built from `footbridge-sources.js` (written by
  `tools/osm/add-footbridges.mjs`); side panels blank (no advertising text invented); decks and stairs cannot be walked.
- **DN1 flyover at the airport junction** (w39728276 / w313002848, bridge, layer 1, 44.5703 – 44.5717): outside the playable
  area; seen only from a distance.
- **Departures ramp** w180054678 (bridge, layer 1): elevated road beside the terminal landmark; steel post-and-rail railing
  (seen from the forecourt only). No official panorama within 110 m of the deck (user photospheres only).
- **Covered roads and service tunnels** by the station and terminal (w885163907 / w885163908 covered; w1395443535 /
  w406482207 tunnel layer −1; w406482205 layer −2): present as roads; no panorama.
- **M6 metro works** (w1564835985 … w1564835992, `highway/railway=construction`, tunnel; construction roads w1475545133 /
  w1491003767): nothing visible above ground but hoardings (in front of Departures since 2024, after the 2022 chapter); not
  built [wp_m6] [otp_parking_m6].

## 5. Airport landside

- **Panorama coverage**: official panoramas exist on the access road (above), under the station deck (44.56885, 26.07486), the
  long-term car park road (44.569156, 26.074543), the forecourt roundabout (44.569998, 26.075594), the departures car park road
  (44.570356, 26.074949) and the ground-level kerb at the Plecări hall (44.5709, 26.07702, older camera). None within 50 m of
  the arrivals kerb (44.5686, 26.0766), the ramp foot (44.56828, 26.07705), the Sosiri front (44.56926, 26.07826) or Salonul
  Oficial (44.568268, 26.077911); user photospheres only at the memorial (44.568687, 26.074156) and on the old car-park deck
  (44.56966, 26.07725, before the station was built).
- **Terminal landmark `otp`** (Plecări hall w771096082; pose 44.570884, 26.076884 h 20 / 100 / 125): silver barrel-vaulted
  entrance canopies on white columns, a white cylindrical stair tower and the blue curtain wall at the ground kerb; drawn so.
  The vault canopy positions along the front are estimates (door groups not mapped). Terminal Vioara has no panorama in reach.
- **Control tower**: the five ring floors stand under the mapped cab w794617342 (`aeroway=tower`, `min_height=20`,
  `height=25`). In the panorama the tower looks about twice as tall; the OSM height is kept (estimate not settled).
- **CFR station `otpgara`** (w813193384; poses 44.56887, 26.07495 h 10 / 300 and 44.568817, 26.073336 h 60 / 66): concrete box
  girder deck on hammerhead wall piers with crossheads, glazed barrel vault with green ribs and edge bands over the platforms
  (rise 4.6 m estimate), glazed stair / lift tower at the west end. `airport-forecourt.js` skips its own vault when the
  landmark replaced the footprint.
- **Forecourt roundabout** (44.5700, 26.0757): planted island. 12 OSM lighting masts (`man_made=tower`,
  `tower:type=lighting`) are drawn at their nodes (`airport-forecourt.js`): OSM height where tagged (20–40 m), else 25 m
  estimate; n4089486527 banded orange / white as seen. The panorama also shows two flag masts and a sculpture group on the
  island; live OSM (2026-11-13) has no object there and the island is now crossed by the M6 works, so the panorama may predate
  them. Not drawn (no mapped position).
- **Monumentul Eroilor Jandarmi** (w565845891, `historic=memorial`): granite-paved plaza, low stone blocks, benches, dense trees
  behind (photosphere only); drawn as a marble `stele` (`monument-sources.js`).
- **Car parks**: staff / taxi w23585062, long-term w406904953, departures w110663816: surface car parks behind hedges, red /
  white barriers, lamp masts. Airport car park w1215048759 (drawn through its part w217927380, 2 levels): open decks.
- **TAROM office** w216626527: long office slab south of the departures car park (OSM 4 lv / 20 m); facade not compared.
- **Salonul Oficial** w771096084 (1969): two storeys from OSM `min_level=0` / `max_level=1` (previously a 17.7 m default);
  look not compared (no panorama).

## 6. Buildings and businesses on DN1

Business research (2026-11-07): zone = within 60 m of a chapter route (routed on the OSM graph from the CHAPTERS start to the
door, one-way and turn-restriction aware) plus recognisable businesses within 50 m of a main street in the district mask;
standalone ATMs, parcel lockers, chargers and pure company offices left out. Confidence: high = official locator match or OSM
`check_date` ≥ 2025-05; medium = OSM element edited / checked since 2023-11; low = older, or a chain missing from its
locator. Locators used are listed under Sources [locators]. POIs in the game: `tools/osm/add-pois.mjs` (live OSM 2026-11-12,
`--edge 100`) appended 17 rows to the original 72.

Businesses along DN1, south to north (all present in the game on the right building unless noted):

- East: Romstal (w219767593), Mega Image (w312547018), Ferremo Trendy (w259171763), Gazprom + shop (w918040928 / w918040927),
  Ramada (w259171710), Rompetrol + hei (w312547071 / w918040920), Ibis Styles (w918040921, 4 lv / 12 m, 2023), Parking
  Autopeni (w936804565), "OMV" (MOL, below) + Viva (w244429098 / w244429094).
- West: Cris Garden Plaza (w259171686), Rompetrol + hei (w918040922 / w918040923), Speli-Singur.ro car wash (w1244020417),
  RIN Airport Hotel (w336933042), Hotel Otopeni (w413830137), Novomatic Romania (w303678264), Maxigel (w303678268), Frescia
  Store / Zoe Auto Rent / Urban Automobile (n12238896056 / n12238896058 / n12238896057), Vienna House Easy (w303678262),
  Casa Românească hotel and restaurant (w303678255 / w495066823).

Reviewed looks (rows in `game/src/building-review.js`, mirrored in `buildings[].research` of the JSON twin; heights in rows
are estimates from the storey count, a height or roof shape tagged in OSM is never changed):

| OSM | Seen at street level | Row |
| --- | --- | --- |
| Romstal w219767593 | blue panel showroom hall, two low storeys | 8.5 m (was a 24.2 m block) |
| Mega Image w312547018 | one-storey dark grey flat-roofed box, red entrance portal, car park in front | 6 m flat box (portal not drawn) |
| Ferremo Trendy w259171763 | three-storey showroom, white / grey panels, dark red glazed centre bay | 11.5 m, ribbon windows (was 17.7 m) |
| Cris Garden Plaza w259171686 | low glazed garden-centre hall behind a fenced yard | glazed; OSM levels 3 kept |
| Ramada w259171710 | silver-grey panels and glass, curved glazed corner | light grey (OSM 20 m / 5 lv kept) |
| Vienna House Easy w303678262 | white hotel slab, vertical HOTEL lettering, flags | white (OSM 18 m / 6 lv kept) |
| Casa Românească w303678255 / w495066823 | white walls, dark timber framing, dark shingle roof, wooden porch | white, dark roof |
| Maxigel w303678268 | red-panel showroom, about three storeys, curved glazed corner, "maxigel" lettering (pano XiEkrn45SiO9mH88qzVfbA) | 11.5 m red (corner not modelled) |

Match without a row: Ibis Styles (grey four-storey box, green sign), Novomatic (four-storey glass office behind a fenced lawn).
Not compared: RIN Airport Hotel and Hotel Otopeni (set back on a side street).

Fuel stations (looks in `fuel-look.js` / `brand-review.js`; reviewed pylon places ±10 m in `fuel-stations-review.json`):

- **Rompetrol** w312547071 and w918040922: white fascia with an orange lower band, orange columns, the red / orange drop logo on
  white; a slim white pylon on the DN1 frontage (panoramas rwBEQtyul8wwideP-uqqYQ h81, ugmV2tKj3xdC4nMf5Vme5Q h130;
  S-NLftUc9aS5ox2xY6-tLA h19, 7DPejJPO8OrQJAdWxso_3A h225). The business research palette (`data.brands.rompetrol` white /
  blue) is not Rompetrol's; `brand-review.js` gives the district white / orange / red.
- **Gazprom** w918040928: dark blue fascia with a light blue band, blue columns, flag masts on the frontage; white pylon with the
  blue logo at the south end (ruj2lFmYlbzU5U31pcteyQ h87, 7c-Lsllq2RjtY7Wyb3ITGg h120).
- **"OMV" w244429098 (Calea Bucureștilor 224D) is a MOL station**: see section 8.
- Islands drawn: Gazprom 2, Rompetrol 3 and 4, OMV / MOL 1. The flag masts at Gazprom / Rompetrol have no OSM object: not drawn.

Other business facts:

- **Terminal interior units** are kept out on purpose: Gloria Jean's w1360387415, Buongiorno w1360387418, Relay w1360387425,
  Aelia w1360387422 and City Grill w1360350022 are mapped `level=1` / indoor (airside upper floor); the airline desks
  n4836899527 / -528 / -530 / -531 / -642, n4836901429 / -430, n4836902828 and Brioche Dorée n4836902823 are nodes deep inside
  the hall. `add-pois.mjs` skips units not at street level and interior units of a multi-tenant hall over 3000 m² (the rule
  that keeps mall galleries off outer walls); the game has no terminal interior. Hesburger w1360360979 and Left Bank
  n4836899632 are POIs; the ticket desks south of 44.5714 come from the original build and stay.
- **Car rentals** Alamo, Avis, Hertz, SIXT are inside the terminal on level 1 (no street-front sign): not POIs.
- **Carrefour Express** n4892173053 (44.56854, 26.07787; OSM v6, last edit 2025-06-07) is in live OSM but not in Carrefour's
  locator: treated as possibly closed, not shown.
- **Out by the 100 m frontage rule**: KTM Bucuresti n4566226637 (235 m), the rental returns at 291B (n4473174189,
  n11452068656, n11059234902, n12584873472; 298–322 m).
- **No OSM input**: Dix Depot w1501279482 and Ifantis w217108491 were not in the cached OSM input; not reviewed.
- Cris Garden Plaza seen from Str. Libertății: garden-centre building, consistent with its POI.

## 7. Trees, green, water and sports

- Flat, open landscape: the forecourts and fields along DN1 are open grass with few trees.
- **DN1 fields crowns**: the crowns in 44.563–44.568 × 26.0705–26.078 are measured (aerial survey
  `trees-bucharest-otopeni.json`: 307 crowns, radius median 3.1 m, quartiles 2.2 / 4.9 m), not inferred. All 307 were drawn
  over Esri z19 imagery and inspected (2026-11-13): 63 stood on the airside taxiway and 2 on paving and were removed from the
  survey and the pack (ledger `trees-bucharest-otopeni-review.json` `dn1FieldsReview20261113`); the other 242 (hedgerow trees,
  wood edge, ambiguous vegetation) stay. Removing more needs a bounded crop review on the aerial mosaic (`tools/aerial`),
  never thinning.
- No water body or fountain inside the district. Ramada pools w1322339467 (21 m², 44.55956, 26.07210) and w706499892 are
  areas with a coping / deck (`add-areas.mjs`); no panorama shows them. Pitch w1244012657, tennis w1244012659 and the Water
  Park Otopeni pools (r3149817, w233941336, w233941343) are 190 – 390 m outside the playable area, present as areas; the
  Allianz Țiriac Arena ice rink (w703060988) is a building.

## 8. Documented exceptions to OSM

- **MOL station tagged OMV** (w244429098): green canopy with white MOL letters, white columns, green MOL pylon at the south end
  by DN1 (panoramas NDGwi1S_sXzOjXEXu_Xs8w h16, iNwZVPNKq8h9KgXzPzc8YA h152). OSM tags `brand=OMV` but its own
  `brand:wikipedia` reads en:MOL. Drawn as seen: MOL look, canopy / pylon lettering, map label and canopy building name
  (`fuel-look.js` `seenBrand` / `text`, read by `world.js`); the data keeps OSM's brand. Upstream fix still to make
  (brand=MOL), then the exception can go.

## 9. Estimates and open questions

- **Rail viaduct**: deck width 6.5 m, girder depth 2.2 m, piers every 24 m (real pier positions not surveyed; 3 spans have no
  support where no free ground was found). **Footbridges**: clearance 5.5 m, deck 2.6 m, truss 2.4 m. All recorded per source
  in `world.stats.elevatedSources` (`models.rail` / `models.footbridge` `estimates`).
- **Terminal**: vault canopy positions; control tower height (OSM 25 m kept, the panorama suggests about twice that); CFR
  station vault rise 4.6 m.
- **Lighting masts** without a tagged height: 25 m.
- **Reviewed building heights** (Romstal, Mega Image, Ferremo, Maxigel): from storey counts.
- **Uncompared** (no official panorama): the departures ramp parapets, the arrivals level, the P2 car park, Salonul Oficial,
  Terminal Vioara, the memorial plaza, the Ramada pools.
- **Access road sidewalk**: the game has a sidewalk with bollards on the north side; reality has one on the south side only.
- **Forecourt flags / sculpture**: in the panorama, not in OSM (possibly removed by the M6 works).
- **2022 vs 2025 kerb layout** and terminal facade details beyond the reviewed poses.

## 10. Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 tiles 2026-11-06; live Overpass / API 2026-11-12/13) |
| wp_otp | https://en.wikipedia.org/wiki/Henri_Coand%C4%83_International_Airport |
| wp_m6 | https://en.wikipedia.org/wiki/Bucharest_Metro_Line_M6 |
| otp_2025_traffic | https://www.romania-insider.com/index%2Ephp/traffic-bucharest-airports-2025 |
| otp_17m | https://www.teamfrance-export.fr/infos-sectorielles/39842/39842-laeroport-de-bucarest-otopeni-a-enregistre-17-m-de-passagers-en-2025 |
| otp_new_terminal | https://www.wall-street.ro/articol/transporturi-and-infrastructura/noul-terminal-otopeni-intra-in-etapa-de-proiectare.html |
| otp_parking_m6 | https://www.romania-insider.com/bucharest-airport-parking-close-construction-works-subway-line-2024 |
| otp_plecari_2025 | https://playtech.ro/2025/accesul-interzis-cu-masina-la-terminalul-plecari-al-aeroportului-otopeni-noile-rute-auto-anuntate-de-autoritati/ |
| otp_sosiri_parking | https://www.euronews.ro/articole/aeroportul-otopeni-parcarea-de-la-sosiri-inchisa-pentru-consolidare-ce-alternativ |
| otp_taxi_guide | https://www.inyourpocket.com/bucharest/The-Definitive-Guide-to-Finding-a-Taxi-at-Bucharest-Airport_74243f |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |
| speed_ro | https://en.wikipedia.org/wiki/Speed_limits_in_Romania (fetched 2026-11-07; legislatie.just.ro did not respond) |
| ref_otp | `refs/otopeni/LICENSES.md` (Commons photos of the CFR station canopy and the terminal arches / control tower) |
| locators | McDonald's https://mcdonalds.ro/restaurante, KFC https://kfc.ro/restaurante, Kaufland https://www.kaufland.ro/.klstorefinder.json, Carrefour https://carrefour.ro/corporate/magazine, Dona https://www.dona.ro/farmacii (all 2026-11-07). Not machine-readable then: Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen, Lidl, Penny, Catena, BT, BCR, ING, Orange, Vodafone, Petrom, OMV, MOL, Rompetrol, Lukoil, OTP, Alpha Bank, Digi, Telekom: these rely on OSM edit / check dates |

The remaining keys cited inside `bucharest-otopeni.json` resolve in its `meta.sources`.
