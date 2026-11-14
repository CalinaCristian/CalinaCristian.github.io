# Bucharest — Floreasca (`floreasca`): research dossier

The reference for why the Floreasca district looks the way it does: facts about the real place, their sources, the
estimates the game makes where no source exists, and the places where it knowingly differs from OSM.

## Overview and sources

- **Data.** First generated 2026-11-06 (role research-buc-districts) from the OSM API 0.6 snapshot of that day; live OSM
  re-checked 2026-11-12 and 2026-11-13. Every OSM fact is keyed by id (w = way, n = node, r = relation). Bracketed keys
  like [wp_fcc] point to **Sources** at the end.
- **Machine-readable twin** `bucharest-floreasca.json` holds the generated tables: per-street
  segments (lanes, turn lanes, parking, speed, surface), every building with its style-rule facade estimate, businesses,
  junctions and crossings, transit lines, stops and STB liveries, the Bucharest-wide streetscape rules (`city_rules`),
  palette (`colours`), `top_local_details`, `gaps`, district pedestrians (`dialogue`) and traffic hotspots (`traffic`).
  Business detail: the Businesses and speed limits section below.
- **Street level.** Official Street View panoramas (mostly May 2024) were looked at only; nothing was stored, traced or
  measured from them. A panorama is cited as its id plus heading (`orHAmm3GllAsPPrvYACycA h105`) or as its position.
- **Images.** `refs/floreasca/`: seven Commons panoramio photos from Sky Tower and Promenada (licences in `LICENSES.md`).
- **Area.** The playable geometry is `cities.js` (BUC_DISTRICTS floreasca); the research extraction box was
  [44.454, 26.096, 44.479, 26.112]. Sky Tower and Promenada stand about 600 m north of the core: skyline backdrop.
- **Confidence.** *high* = OSM / official / encyclopedic; *medium* = consistent across photos or common knowledge;
  *low* = estimate.

**The place.** Around 44.4645, 26.1045: long four-storey (P+3) flat-roofed 1950s–60s blocks with dark bitumen roofs and
plain balconies; one- to three-storey red-tile villas between them, densest on the "composer streets" (Mozart, Chopin,
Bach, Verdi, Ceaikovski, Garibaldi) laid out between the wars; newer four- to six-storey blocks with light membrane roofs.
Gardens, wrought-iron fences, sliding gates and dense tree canopy almost everywhere; cars parked on both kerbs (on the
sidewalk) of the residential streets. Calea Floreasca is the food and nightlife street (terraces, valet parking). Aerial
and reality pass 2026-11-08 [osm] [floreasca_nightlife] [strazi_compozitori].

## Chapter route and CV stop: `rosetti` (2009)

- **Route.** Start on Calea Floreasca northbound at 44.455787, 26.10069 (heading 358°), 400 m before Piața Floreasca;
  north past the market, park and offices with Sky Tower ahead, right into one-way Str. Johann Strauss, then Rahmaninov and
  Georges Bizet through the villa grid, left onto one-way Str. Garibaldi to the gate at 44.467042, 26.106527. 2320 m on
  the OSM drivable graph respecting one-ways: Calea Floreasca 1910 m, Johann Strauss 153 m, Rahmaninov 38 m, Bizet 176 m,
  Garibaldi 42 m.
- **Stop.** Liceul Teoretic C.A. Rosetti, Str. General Giuseppe Garibaldi 11, Sector 2: school block w28240279 (3 levels,
  U-shaped) inside grounds w253216276. Door at the address node n7119137467 (44.46709, 26.1063) on the W side of one-way
  northbound Garibaldi; fenced yard and gate on Garibaldi. Școala Gimnazială "Maria Rosetti" at Garibaldi 3 is a different
  school. Listed by the Ministry of Education among Bucharest school buildings at seismic risk (class not given)
  [osm] [edupedu_seismic] [bucharest_ro_rosetti].
- **Look.** 1950s–60s rendered masonry, cream / light yellow (#E8DDB8, estimate), white window frames, a regular grid of tall
  windows, flat or low roof (row in **Key buildings** below). Street level: from Garibaldi 28 a yellow-topped hall with a
  grey centre panel, a low pink annex, mesh fence and lawn; at 44.4687, 26.1061 h352 the game's school block and painted
  fence plinth match.
- **Deutsche Bank.** The 2017 `db` chapter is in Pipera, not here: DB Global Technology has been on Bd. Dimitrie Pompeiu
  (6A, BOB Tower, n12252625817) since at least 2015; no source places it in Floreasca [db_careers] [db_hq_2015]. See
  `bucharest-pipera.md`.

## Streets and traffic

- **Calea Floreasca** (secondary / tertiary, 50 km/h): the north–south artery, 2 lanes northbound + 1–2 southbound (OSM
  lanes 3–5 with turn pockets such as `left|through|through;right`), split into one-way pairs round short islands at
  Piața Floreasca and Ceaikovski; kerbside parking lanes (`parking=lane`) on long stretches; buses only (OSM relations 135,
  343, 449, 459, 461; no tram, no trolleybus). The bus lane is a contraflow lane on the west side, plain asphalt with BUS
  lettering (aerial 2026-11-08). Renovated 3–4 m grey-paver sidewalks, bollards along the west side, linden and chestnut
  rows both sides. Frontage W: Piața Floreasca market (S end), Agora, Souk (131B), Nusco Floreasca offices, One Tower (151,
  16 levels), Sanador clinic (165), Parcul Floreasca; E: three- to four-storey 1930s–50s villas and small blocks with cafés,
  restaurants and clinics on the ground floor [osm] [wp_fcc] [floreasca_nightlife].
- **Str. General Giuseppe Garibaldi**: one-way northbound along its whole length, single lane (maxspeed 30 / 40), cars
  parked on both sides half on the 1.5–2 m sidewalks, linden and robinia trees; interwar villas (two to three storeys,
  stucco, tile roofs, iron fences) and the two Rosetti schools [osm] [strazi_compozitori].
- **Composer streets**: Rahmaninov (mostly one-way), Georges Bizet, Johann Strauss (one-way eastbound; Hotel Johann
  Strauss at no. 1), Mozart, Chopin, Bach, Verdi, Puccini: narrow one-way residential streets, 30 km/h or RO:urban.
- **Str. Piotr Ilici Ceaikovski** (tertiary, two-way, 40–50 km/h): tram 5 in the shared carriageway, buses 282 / 461.
  **Str. Barbu Văcărescu** (primary, one-way pairs, tram 5 on a central reservation) and **Bd. Mircea Eliade** lie on the
  north and east edge; **Bd. Lacul Tei** (buses 182 / 282) on the north-east.
- **Signals** on the route: n656960 (Bd. Mircea Eliade × Calea Floreasca × Ceaikovski, pedestrian countdowns), n656968
  (× Șos. Fabrica de Glucoză), n2136557810 (× Str. Glinka). The other route junctions are unsignalised (list in the JSON).
- **Transit**: buses on Calea Floreasca and Lacul Tei, tram 5 on Ceaikovski / Barbu Văcărescu; no metro entrance in the
  area.
- **Traffic hotspots** (JSON `traffic.hotspots`, read by `cities.js` congestion). City: about 62.5 % congestion, 171 h
  lost per driver in 2025, worst slot Wednesday 17:00–18:00 [tomtom_2025] [tomtom_2025b].

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Calea Floreasca N (towards Barbu Văcărescu / Sky Tower) | 44.471, 26.1035 | 200 | 8–10, 17–19.5 | 0.7 | commuter queue to the Barbu Văcărescu / Pipera offices [tomtom_peak] |
| Rosetti school run (Garibaldi / Ceaikovski) | 44.4665, 26.1055 | 140 | 7.5–8.25, 13–14.5 | 0.45 | double-parked parents on one-lane streets (assumption) |
| Piața Floreasca market | 44.4605, 26.1005 | 120 | 9–13 | 0.4 | Saturday-morning market traffic (assumption) |

## Buildings and shopfronts

**Key buildings** (research rows; the JSON `buildings[].research` carries the same values):

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w245407585 | Nusco Floreasca 2 (Calea Floreasca 141-143) | 5 / – | #C8C8C4 glass + aluminium panels | | | [osm] |
| w872211888 | One Tower (Calea Floreasca 151 / 165) | 16 / – | #6F8A94 glass curtain wall | | 2020s | [osm] |
| w28240279 | Liceul Teoretic C.A. Rosetti (main block) | 3 / 11 | #E8DDB8 | flat / low | post-war school block (est.) | rosetti [osm] [edupedu_seismic] |

**Reviewed buildings** (`building-review.js`; official panoramas, live OSM 2026-11-13):

- **Piața Floreasca / Agora** w34832556 (Calea Floreasca 111-113; pano 44.460443, 26.101023 h240): two-storey light
  silver-grey glass curtain wall with hedges and terraces, Medicover / Agora signs, AGORA letters on the roof edge. Row: 9 m,
  two storeys, `glass`, #c5cacc; a light reviewed glass colour renders as pale coated glass (`world.js`). South end
  (Bălănescu Rosetti): mauve upper storey with a dark louvred panel, the drive-through passage in the middle, the Dona
  pharmacy right of it. Banul Antonache side: single-storey dark-grey front with the Mega Image sign and perpendicular
  parking bays; it is the same OSM footprint (see **Estimates**).
- **Nusco Floreasca 1** w245407579 (`building=office`, the iMZA / Farmaplus corner; pano 44.461341, 26.101235 h262):
  blue-grey reflective glass tower, about six glazed storeys over a tall dark ground floor plus a set-back top storey. Row:
  27.5 m, 8 storeys, `glass` (storey count from the street, height an estimate).
- **Souk** w39348919 (Calea Floreasca 131B; pano 44.462811, 26.101521 h265): low white two-storey building with a red
  band and dark roof edge, beside the park. Row: 7.5 m, two storeys, white `interwar`.
- **Spitalul Euroclinic** w245345976 (OSM `building:levels=7` kept; pano 44.454184, 26.100804 h40): grey panels and a
  blue glass curtain wall, seen only from about 40 m. Row: style `glass`.
- Seen and matching, no row needed: Il Calcio (no. 118, block with a glazed ground-floor terrace); moft (no. 88, cream
  block with French balconies and a dark shopfront; the game's block is green); no. 70–72 (brick-and-cream modern block
  with a yellow villa beside it).

**Businesses.** In live OSM 2026-11-12, 93 named businesses lie within 40 m of the playable area; every one the builder's
`poiKind()` accepts inside the mask is in the game with the same name on the same building (Chez Toni n14289829501, Poke
House n14295309652 and Shop&Go n14316864304 confirmed). A building signed with a business mapped inside it carries the
sign over the unit's street front at the OSM point; unbranded businesses whose point lies outside a footprint (moft, iMZA,
Cozofino, Farine, Pizzeria Due Amici) are signed too; names are not cut short.

- Not drawn: Mondayz Coffee n5053344722 (an OSM point with no building within 16 m, so no wall to sign); Golf Room and
  Beat45 inside Agora (arcade / fitness, not `poiKind` classes); Paradisul Copiilor kindergarten; ONE Estate office.
  Outside the mask by 5–34 m: Luxury Aesthetics, Two Minute, Rawdia, Kanpai, Expert Implant, Hotel Diesel (its restaurant
  building is signed). Fantasy Massage n2526169532 lost its shop tags on 2026-08-30 and is absent.
- Disused in OSM: n5053344622 (44.46589, 26.10271), n7038762287 (44.46140, 26.10021), n6968373504 (44.46004, 26.09999)
  carry no "DE ÎNCHIRIAT" board: OSM says only that the shop closed, and the one panorama that reaches a disused point (the
  café at Calea Floreasca 70–72) shows no board. Calea Floreasca 43 (n7038739416, `disused:shop=motorcycle_repair`, edit
  2025-04-22) keeps the vacant board although the May 2024 panorama shows a trading blue "Automecanica" shop: OSM is the
  later source (owner decision).
- Cannoleria (n13869497589) is newer than the panorama, which shows "Nadasan" and "Chicineta" there: OSM kept.
- Not compared at street level; names, positions and signs are OSM's: Banul Antonache 40–44 (Yoshi, CAU), Madison,
  Graffiti Hotel / My Maya, Komodo, Schnitzel King, Genin / Mumbai, Shop&Go, Hotel Johann Strauss.

**Sign colours** (`brand-review.js`, this district only; no brand here has a Wikidata colour P465):

- Mega Image at Piața Floreasca (w34832556): white MEGA IMAGE letters on a dark grey band with the red lion square
  (`orHAmm3GllAsPPrvYACycA h105`).
- Dona pharmacy at the car-park entrance: teal panels with white DONA letters (`NWuTtHcsu_MBJEKTpucUsA h1`).
- Str. Ceaikovski 9: Roll Master, Burgerati, Chocoloco side by side in that order with terraces; boards black, black,
  beige (letter colours estimated; Chocoloco's striped awning is not drawn).
- Every other unbranded business keeps the neutral dark slate board #1f2937 (estimate: no review covers it).

**MOL Barbu Văcărescu** w235639134: open canopy on a row of round white columns over the islands (pano 44.465747,
26.108980); lime-green fascia with white MOL letters and a darker green lower band, white soffit, green-clad pumps
(`rt_5dQilD9RWXQ93yElt2w h33`); dark grey pylon with a green edge in the kerbed bed by the south entrance on Str. Barbu
Văcărescu (same pano h290; `JP23iWj1iHarqB7b0BfNkA h169`).

**Palette** (estimates, JSON `colours`): villas #E9E0CF #E4D2B0 #D8C7A8 #EDE3D2 #D9C9B4; interwar modernist #E8E1D3
#DAD3C4 #CFC8B8; 1970s–90s blocks #BDB5A6 #C7C1B5; office glass #6F8A94; roof tiles #8C3B2A; iron fences #2B2B2B.

## Landmarks and sports grounds

- **Sky Tower** (`skytower`, w219622660, 44.47797, 26.10473): 137 m, 37 floors + 5 basements, opened October 2012,
  Romania's tallest; elongated elliptical plan, blue-green glass curtain wall, cylindrical crown and spire, lit at night.
  **Promenada Mall** next to it (October 2013, landscaped roof terraces). Both are skyline backdrop on the northbound drive
  [wp_fcc] [skytower_ctbuh] [skytower_site].
- **Piața Floreasca market** (w34832556, 6275 m²): covered market hall and stalls at the south end of Calea Floreasca, on
  the route; see Agora above. **Parcul Floreasca / Parcul Cinema Floreasca** (w586357887): wooded park west of Calea
  Floreasca, the former summer cinema garden [parcul_floreasca].
- **Automatica Ford** w39348916 (`building=construction`, `historic=building`, start_date 1938, `building:levels=2`,
  check_date 2026-04-08), Calea Floreasca 151–159: being converted into One Floreasca City. Pano 44.464086, 26.101630 h270
  (May 2024): white scaffold netting on tubes behind a dark navy "#ONEGALLERY" hoarding, tower cranes, glass towers
  behind. Landmark `automatica` on its own footprint: 10 m netting body (two OSM storeys, storey height estimated), tube
  grid, 2.6 m navy hoarding on the mapped outline; the advertising text is not drawn.
- **Muzeul Memorial George Călinescu** (n2634651941): a POI on its house.

**Stadionul Dinamo** (`dinamo`). OSM: w28212482 `leisure=stadium`, r9146640 `building=stadium` (Calea Floreasca 22, one of
the model's source ids), w427813551 pitch, r9146639 track, w860001496 Peluza Cătălin Hîldan. No `height`, `levels`,
`layer` or `location` tag: OSM does not say how deep the bowl is.

- Street level: from Calea Floreasca 33 (44.4558352, 26.1007094, looking east) a car park, a guard booth, a graffitied
  brick boundary wall about 2.5 m high and floodlight masts, no stand, roof or scoreboard above it; at no. 20 a low
  balustrade wall with orange mesh gates and two-storey white club buildings. From Șos. Ștefan cel Mare 7 (44.4530935,
  26.1026882, looking north) the gate pillars, an unfinished four-storey concrete frame west of the gate lane and an access
  lane falling towards the pitch. The Ștefan cel Mare gate is a single-storey gatehouse with red DINAMO letters on its
  roof, a slim tower, a brick-paved forecourt and a statue plinth (not modelled).
- Elevation, EU-DEM 25 m (opentopodata `eudem25m`, 2026-11-12): pitch 74.2–77.0 m; Calea Floreasca 82–84 m; Ștefan cel
  Mare side 79–82 m (inflated by buildings); the sports park north and east of the stadium 77 m. A smoothed surface model
  under-reads a 190 m pit.
- Decision: the bowl is sunk 9 m below the street (`DIN_DEPTH`, `landmarks.js`, estimate); top rows 0–1.6 m above the
  street, parapet 1.1 m; masts on the rim inside the outline.
- OSM gap: w387467641 (`building=yes`, 44.45373, 26.10237) lies 60 m north of the gate, so the unfinished frame seen west
  of the gate lane has no footprint at its place and is not drawn.

**Dinamo complex**, all present at the right place and kind: three football pitches (w143759799, w143759804 grass,
w143759807 artificial turf), six clay tennis courts (w859431639–44), Sala Polivalentă w28246357, Bazinul Tolea Grințescu
w38757552, grandstand w859972644, outdoor pool w23611448.

- **Velodromul Dinamo** w37899329 (`leisure=track`, `sport=cycling`, `surface=concrete`) round the rugby pitch w362465818
  (`leisure=pitch`, `sport=rugby_league`). `sport-areas.js` dresses both by these tags: a banked concrete track between the
  two mapped outlines and rugby league markings with H posts on the infield. No panorama reaches the grounds (Calea
  Floreasca 85 shows only villas and trees), so every dimension is an estimate (see **Estimates**).
- **Statues**: the Dinamo row on Șos. Ștefan cel Mare (n8013556514–18: Atletul, Discobolul, Alergătorul, Cătălin Hîldan,
  Ivan Patzaichin; n14180087101 Statuie poloist) and the statue in Parcul Cinema Floreasca (w1171561661,
  `tourism=artwork`, `artwork_type=statue`, 16 × 15 m outline), 60–180 m outside the playable edge, stand as generic
  objects of their OSM class
  (`monuments.js`: plinth and a plain figure). No panorama shows any of them (inside the Dinamo grounds; behind the park
  trees from 44.461990, 26.105017 h282), so there is no likeness.

## Water, bridges and structures

- No bridge, underpass or tunnel on the playable network. The only structure is the service way through the market hall
  (w1322035262, `tunnel=building_passage`, 107 m, north–south through w34832556), drawn as a passage through the building.
- Pedestrian subways and passages at Șos. Ștefan cel Mare (w910363909–12, w229833216/7, w1205054012, w246119130,
  w229829897) lie 120–220 m outside the playable edge and are not modelled.
- No river, canal, lake or fountain inside the playable area or within 250 m; Lacul Floreasca is 600 m north in the
  scenery ring. Two outdoor pools are drawn: Dinamo w23611448 and Grădina Floreasca w903986055.

## Trees and green

- **Pedestrian plazas**: the shared rule ([shared-rules.md](shared-rules.md#pedestrian-plazas)). Here: 3 plazas, none
  tagged grass.
- OSM maps no individual trees in the district (2026-11-06). Calea Floreasca has mature linden and chestnut rows on both
  sides; Garibaldi and the villa streets linden and robinia over gardens; Parcul Floreasca old park trees. The street
  species lists live in the JSON (`streets[].research.trees`) and feed `streetTrees`.

## Estimates and open questions

- **Places of worship**: the shared rule ([shared-rules.md](shared-rules.md#places-of-worship)). Here: no church takes
  a tower: Nașterea Maicii Domnului - Floreasca has a measured flat roof, the greco-catolică cathedral is Western-rite,
  three are untagged.
- **Velodrome** (`SPORT_ESTIMATES`, UCI outdoor range): flat apron 1.2 m; bank 12° on the straights rising to 32° in the
  bends; outer edge capped 3.6 m above the infield, 1 m rail on top. Rugby: try lines 100 m apart, in-goals fitted inside
  the capsule-shaped infield (dead-ball lines 56 m from the centre), field width 56 m (limited by the outline; the standard
  is 68 m), posts 5.5 m apart, crossbar 3 m, uprights 10 m.
- **Dinamo pit**: depth 9 m from EU-DEM and two panoramas. The district ground is flat, so the pit has a rim all round,
  although the real ground north and east is about as low as the pitch; no finer elevation source exists for Bucharest in
  the toolset. Not established: west-stand roof, scoreboard, exact mast positions, the boundary wall (not mapped), the
  gatehouse.
- **Statues**: form and size are class estimates.
- **Agora**: the whole footprint is drawn at the reviewed 9 m. OSM has no line between the glass front and the
  single-storey Banul Antonache side, and a panorama cannot be traced for one, so the footprint is not split.
- **Nusco Floreasca 1** height and **Automatica** netting storey height: estimates.
- **Facades and heights**: facade colours are per-type palettes (no measurement source); untagged heights are rule-based.
  A shadow-length height estimate calibrated on OSM-tagged buildings is the obvious next step. Villa-by-villa facades on
  Garibaldi were not researched individually; the Rosetti building's construction year is unverified.
- **Bus lane**: the contraflow bus lane on the west side of Calea Floreasca is not in the game's road topology (open).
- **School-run congestion** is an assumption, not sourced.

## Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 map tiles, 2026-11-06; live re-checks 2026-11-12/13) |
| wp_floreasca | https://en.wikipedia.org/wiki/Floreasca |
| wp_fcc | https://en.wikipedia.org/wiki/Floreasca_City_Center |
| skytower_ctbuh | https://www.skyscrapercenter.com/building/floreasca-city-sky-tower/9029 |
| skytower_site | https://skytower.getanchor.io/index.html |
| strazi_compozitori | https://edituravremea.ro/images/pdf/StraziVI.pdf |
| edupedu_seismic | https://www.edupedu.ro/colegiul-national-gheorghe-sincai-si-alte-9-cladiri-de-scoli-din-bucuresti-pe-lista-ministerului-educatiei-de-scoli-in-pericol-de-prabusire-la-cutremur/ |
| bucharest_ro_rosetti | https://www.bucharest.ro/locations/education-c-a-rosetti-theoretical-high-school-390 |
| parcul_floreasca | https://zilesinopti.ro/locuri/parcul-floreasca/ |
| floreasca_nightlife | https://hotnews.ro/?p=1594020 |
| db_careers | https://careers.db.com/explore-the-bank/locations/emea/romania |
| db_hq_2015 | https://www.romania-insider.com/deutsche-banks-technology-center-in-bucharest-reached-300-employees-plans-to-add-200-more |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |

The Bucharest-wide sources (road signs and markings, STB, Metrorex, lighting, trams) are listed in the JSON `meta.sources`.

## Businesses and speed limits

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-floreasca.json` (one entry per business, independents included) and the `bucharest-floreasca` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.

Confidence: **high** = official locator match, or OSM `check_date` ≥ 2025-05; **medium** = OSM element edited or checked since 2023-11; **low** = older OSM data, or a chain store missing from its official locator. Sign `style` is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own building → pylon, else fascia); `sign.basis` says where the colours come from.

### On the chapter route (rosetti)

| brand | category | address | side | conf. |
|---|---|---|---|---|
| Garanti BBVA | bank | Calea Floreasca 141-143 | W side of Calea Floreasca | medium |
| Maxbet | bookmaker | Calea Floreasca 91-111 | W side of Calea Floreasca | low |
| Paul | bakery | Calea Floreasca 111-113 | W side of Calea Floreasca | low |
| Superbet | bookmaker | Calea Floreasca 111-113 | W side of Calea Floreasca | low |
| Dona | pharmacy | Calea Floreasca 111-113 | N side of Str. Bălănescu Rosetti | high |

Garanti: OSM `brand=Garanti Bankası` (Turkish parent); Romanian branches are signed **Garanti BBVA** (garantibbva.ro, 2026-11-07); `tools/osm/poi-kinds.mjs` renames it. 40 independents on the route are in the JSON.

### Official-locator checks

- **Dona** Calea Floreasca 111-113: address match, "Crisen Farm - CF2 - Floreasca" (55 m), dona.ro/farmacii.
- **Carrefour Express** Calea Dorobanților 102-110: position match, "Express Proxi Dorobanti" (26 m), carrefour.ro/corporate/magazine.
- **McDonald's** Str. Barbu Văcărescu 146-158: address match, "McDonald's Barbu Văcărescu", mcdonalds.ro/restaurante.

Closed per OSM lifecycle tags (draw as a vacant "De închiriat" unit if modelled): n1081724064 (`disused:amenity=cafe`, 44.45817, 26.10084), My Maya n4454713391 (`disused:shop=bakery`, 44.45557, 26.09995), n7038739416 (`disused:shop=motorcycle_repair`, 44.45634, 26.10046).

### POIs added from live OSM (2026-11-12)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended 64 rows (94 before; 56 in the edge strip; 8 dropped by class; 2 own building names). Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls, unnamed objects, ATMs outside the area. Street View at 109 Calea Dorobanți: ground-floor shop fronts where the game has a Banca Transilvania fascia; the preview was too coarse to read the name.

### Speed limits on the chapter route

**Legal default (Romania).** 50 km/h inside localities unless signed; the road owner may, with police approval, raise sections to 80 or lower them to 30 (OUG 195/2002 art. 49, via en.wikipedia.org/wiki/Speed_limits_in_Romania, 2026-11-07; legislatie.just.ro did not respond). Big boulevards are signed 60 (OSM `maxspeed=60`); no automatic school-zone limit: "Copii" warning signs and, where the city chose, a signed 30.

**rosetti** — 1637 m, all OSM ways tagged.

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Calea Floreasca | tertiary | 758 | 50 | 50 |
| Strada Béla Bartók | residential | 124 | RO:urban | 50 |
| Strada Serghei Vasilievici Rahmaninov | residential | 535 | RO:urban | 50 |
| Strada Georges Bizet | residential | 176 | RO:urban | 50 |
| Strada General Giuseppe Garibaldi | residential | 42 | 40 | 40 |

Schools / kindergartens within 150 m: Paradisul Copiilor (n1544915641, 12 m), Grădinița nr. 12 Albinuța (n4365350292, 111 m), Școala Gimnazială Maria Rosetti (w26974362, 129 m), Liceul Teoretic C.A. Rosetti (w253216276, 76 m).

### Sources

- OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL; element ids in every entry.
- Locators (2026-11-07): mcdonalds.ro/restaurante (118 restaurants, coordinates for 33), kfc.ro/restaurante, kaufland.ro/.klstorefinder.json, carrefour.ro/corporate/magazine (451 stores, `temporarily_closed` flag), dona.ro/farmacii (672 with coordinates).
- Not machine-readable then (OSM only): Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen (403), Lidl / Penny / Catena / BT / BCR / ING / Orange / Vodafone / Petrom / OMV / MOL / Rompetrol (JavaScript-only or 404), Lukoil / OTP / Alpha Bank / Digi / telekom.ro (no response or bot wall).
