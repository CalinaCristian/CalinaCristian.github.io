# Bucharest — Unirii & Călărașilor (`unirii`): research dossier

The reference for why the Unirii district looks the way it does: facts about the real place, their sources, the
estimates the game makes where no source exists, and the places where it knowingly differs from OSM.

## Overview and sources

- **Data.** First generated 2026-11-06 (role research-buc-districts) from the OSM API 0.6 snapshot of that day; live OSM
  re-validated 2026-11-12 over 44.4198, 26.0976 – 44.4356, 26.1210 (API 0.6 / Overpass) and re-checked 2026-11-13. Every
  OSM fact is keyed by id (w = way, n = node, r = relation). Bracketed keys like [wp_unirea] point to **Sources**.
  "Inside" means inside the exact playable geometry (`district.geometry`, from `cities.js`).
- **Machine-readable twin** `bucharest-unirii.json` holds the generated tables this file no longer repeats: per-street
  segments and OSM tree species, every building with its style-rule facade estimate, businesses, junctions and crossings,
  transit lines, stops, metro entrances and STB liveries, the fountain basins (`fountains.layout.basins[]`, with jet
  nodes), reviewed carriageway widths (`road_widths`), the Bucharest-wide streetscape rules (`city_rules`), palette
  (`colours`), `top_local_details`, `gaps`, district pedestrians (`dialogue`) and traffic hotspots (`traffic`). Business
  detail: `businesses-bucharest-unirii.md`; missing-business list with distances: `businesses-gamediff.json` →
  `bucharest-unirii.missing` (`edgeM`).
- **Street level.** Official Street View panoramas (dates as the provider shows them, many May 2024) were looked at only;
  nothing was stored, traced or extracted into data. A panorama is cited as its id plus heading
  (`NrlzOfq1HTfol_d90aJ3FA h95`) or as its position. Game views: the `unr-*` viewpoints in
  `game/dev/reality/viewpoints.json`.
- **Images.** `refs/unirii/`: 40 Commons photos (Hala Traian, Calea Călărașilor and Matei Basarab listed houses, Piața
  Unirii fountains, Bd. Unirii, Dealul Mitropoliei; licences in `LICENSES.md`).
- **Confidence.** *high* = OSM / official / encyclopedic; *medium* = consistent across photos or common knowledge;
  *low* = estimate.
- **Era.** The chapter is 2015: the game models the finished, normal layout of Piața Unirii (working fountains, open
  carriageways), not the 2024–26 slab works (see **Documented exceptions**).

## Chapter route and CV stop: `gts` (2015)

- **Route.** Start on the west side of Piața Unirii by the Dâmbovița, southbound (44.426766, 26.100968, heading 183°),
  fountain field on the left and Dealul Mitropoliei ahead; round the south side, east on Bd. Unirii along the median
  basins (Unirea Shopping Center on the left), north on Bd. Mircea Vodă, east on Calea Călărașilor through the listed
  merchant-house row to no. 101 (Hala Traian is 250 m further). 2237 m on the OSM drivable graph respecting one-ways:
  Piața Unirii 421 m, Bd. Unirii 633 m, link 17 m, Mircea Vodă 665 m, Coposu 32 m, Călărașilor 469 m.
- **Stop.** GTS Global Intelligence (Global Technical Systems group), Calea Călărașilor 101, Sector 3 (group address on job
  listings; the trade-register seat of GTS Global Intelligence SA is Str. Frunzei 26, Sector 2). GTS later moved to about
  800 m² in Hermes Business Campus, Pipera [gts_job] [gts_hermes].
- **Building.** w245117704: `building=apartments`, 1 level, `heritage=2` (LMI B-II-m-B-18379), a low listed merchant-era
  house; offices typically sit in the courtyard or behind. Door 44.4333, 26.11762 on the north (odd-numbered) side,
  eastbound kerb, about 240 m west of the Str. Traian junction / Hala Traian (no. 133). A 1936 six-storey block (no. 105,
  w245117686) stands two doors east. Street level (`gts`, 44.433259, 26.117608 h358): three arched windows, garland stucco,
  mansard: the game's model matches [osm] [calarasi_200].

## Streets and traffic

- **Bd. Unirii** (primary, 50–60 km/h): the communist-era showpiece (1984–89, "Victoria Socialismului"), 92 m between
  facades: two one-way carriageways of three lanes either side of a wide central reservation with the fountain basins in a
  long chain (the east part continues to about Bd. Mircea Vodă / Nerva Traian), lawns and linden rows; 8–10 m grey-paver
  sidewalks with kerbside lindens; restaurant pavilions with terraces (Aici, Altfel, Jo Lounge, Naked Kitchen, Moon, The
  Clique, Exotique; w693861074–84, w787816882) along the south side east of the square. Buses 104, 116, 117, 123, 361, 385;
  trolleybus 73. The median and carriageway widths are under **Fountains** [wp_bd_unirii] [fountains_44].
- **Piața Unirii**: the largest square in central Bucharest. A one-way gyratory (3–9 lane approaches with heavy turn
  channelisation) round a central park with the fountain field; the square is a concrete slab ("Planșeul Unirii",
  32 × 360 m) over the Dâmbovița, which runs diagonally underneath; Bd. Unirii crosses west–east; Pasajul Unirii runs
  under it north–south (I.C. Brătianu ↔ Cantemir); Piața Unirii metro (M1 / M2 / M3, Unirii 1 and 2) with many
  entrances; tram terminus near the south-west corner (trams 7, 27, 32, 47); big taxi rank and STB bus hub. Park: lawns,
  rose beds, linden and birch groups, benches [wp_unirii_sq].
- **Bd. Corneliu Coposu** (secondary, one-way pair of 2–6 lanes): from Piața Unirii north-east to the Călărașilor / Mircea
  Vodă junction, past the rear of Unirea and Hala Unirii; trolleybus 73.
- **Bd. Mircea Vodă** (secondary, two-way 2+2, 3+2 near junctions, 50 km/h): trolleybus 73 wires, buses 116 / 117 / 312
  / 323 / 385. W: Day Tower (37A), Mercure (28), Hotel Marina; E: nine-storey 1980s blocks E1 / E2, 21D Downtown, BCR and
  BRD branches, the Sector 3 civil-status office.
- **Calea Călărașilor** (secondary): **two-way 1+1** (about 7–8 m carriageway), 50 km/h, patched asphalt, cars parked half
  on the narrow 1.5–2.5 m sidewalks on both sides, overhead telecom cables and older concrete lamp poles; no trolleybus.
  Bucharest's best-preserved row of late-19th / early-20th-century merchant houses ("case de târgoveț"): one- and two-storey
  rendered street houses (nos. 78–111 listed LMI B-II-m-B-183xx, built 1900–1920) with tall windows, pilasters, cornices and
  carriage gates, many shabby or at seismic risk, among four- to six-storey interwar blocks (no. 105, 1936; 117-119
  S+P+4+attic, 1957, seismic class II) and a few 1990s infills; more than 200 legally protected buildings along the street.
  Businesses: Mega Image (133), Superbet, Farmacia Dona, myGOLD and Tezaur pawn shops, shaorma, a pastry shop, car-parts
  shops, Bulgust, Toka, Tripoli [calarasi_200].
- **Str. Traian** (tertiary, two-way 1+1): trolleybus 97 wires, Hala Traian bus / trolley stop; Biserica Hagiu (1872) at
  no. 142.
- **Splaiul Unirii / Splaiul Independenței**: the quays either side of the Dâmbovița (see **Water**); trams 23 / 27 on
  Splaiul Unirii.
- **Signals** on the route: Mircea Vodă × Bd. Unirii (n31404743), Cantemir × Piața Unirii × Splaiul Unirii (n31404741),
  Coposu × Călărașilor × Mântuleasa (n248736293), Mircea Vodă × Anton Pann / Sfânta Vineri / Matei Basarab / Căuzași;
  Calea Călărașilor × Str. Traian is a signalised four-arm junction with market crowds. The rest are in the JSON.
- **Trams.** Live OSM has running track (`railway=tram`) only at the Piața Unirii terminus, Sf. Gheorghe and Bd. Cantemir.
  The track on Bd. Corneliu Coposu is `railway=disused`; the Calea Călărașilor line is `railway=construction` ("lot 1",
  progress 1 % on 2026-10-03, opening 2029) while its stops are still mapped as `railway=tram_stop` (the 2024 panorama
  still shows two embedded tracks). The game draws disused rails in the Coposu carriageway, no track on Călărașilor, and
  the stops.
- **Stops and metro.** Every bus / tram stop and metro entrance inside the playable area is in the data (seven entrances of
  Piața Unirii 1 / 2). Stops appended just outside the edge are listed under **Estimates**.
- **Traffic hotspots** (JSON `traffic.hotspots`, read by `cities.js` congestion). City: about 62.5 % congestion, 171 h
  lost per driver in 2025, more than 32 min per 10 km and 45 min at the evening peak; worst slot Wednesday 17:00–18:00
  [tomtom_2025] [tomtom_2025b] [euronews_10km].

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Piața Unirii (all arms, Pasajul Unirii) | 44.4268, 26.1025 | 250 | 7.5–10, 16–19.5 | 0.9 | the Victoriei–Unirii axis is the most congested in the city; 2024–26 slab works add lane closures [hotnews_axis] [planseu_traffic] |
| Bd. Mircea Vodă × Coposu × Călărașilor | 44.4323, 26.1118 | 150 | 8–10, 17–19 | 0.6 | queues on Coposu and Mircea Vodă northbound [tomtom_peak] |
| Calea Călărașilor × Traian (Hala Traian) | 44.4332, 26.1205 | 120 | 8–10, 16–19 | 0.5 | one lane each way + market deliveries + double parking [calarasi_200] |

## Buildings and shopfronts

**Key buildings** (research rows; the JSON `buildings[].research` carries the same values):

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w649953603 | Day Tower (Mircea Vodă 37A) | 9 / – | #7E9AA6 glass curtain wall | | 2018 | Starbucks on the ground floor [osm] |
| w170338254 | Mercure Bucharest Unirii (Mircea Vodă 28) | 12 / – | | | 2006 | [osm] |
| w245117704 | Calea Călărașilor 101 (GTS address) | 1 / 5.5 | #E3D3B8 | low pitched, grey / brown sheet | c. 1900–1920, listed | gts [osm] [gts_job] |
| w23492027 | Unirea Shopping Center | 6 / 25 | #C8C1B3 panels, large glazing, banners | flat, rooftop signage | 1976, enlarged 1989; mall since the 1990s | [wp_unirea] [osm] |
| w245117686 | Calea Călărașilor 105 | 6 / – | #D9D2C3 | | 1936, listed | [osm] |

- **Civic-Centre blocks**: continuous 8–10-storey 1980s apartment blocks on Bd. Unirii and the corners of the square, with
  ground-floor arcades, cream / ochre stone and render (#D8CDB5–#C9B99A), dark wood or aluminium windows, balcony rows,
  pitched / mansard metal roofs with decorative cornices, large rooftop advertising letters and LED screens (brands not
  verified).
- **Unirea Shopping Center** (`unirea`, w23492027, `building:levels=6`, no colour or material tags; pano at Piața Unirii
  44.4269991, 26.1037744 h40 / h85, May 2024): the south front and south-west rotunda in large flat white-grey panels with a
  blank white billboard frame on the curve (H&M logo in 2024, disused in OSM since) and a white canopy band over a recessed
  glazed ground floor; the west front on Bd. I. C. Brătianu a dark bronze louvred wall with a full-height advertising
  banner next to the rotunda; a red UNIREA logo near the roof at the west end of the south front. North-west corner:
  McDonald's (with McCafé) and "Noodle Pack" signs (not in OSM under that name, not drawn) and unlit "KOTON" letters (OSM
  `shop=vacant`, not shown). The landmark keeps the unit signs of the nine businesses OSM maps inside (McDonald's,
  Chopstix, Luca, Megapan, Sephora, Douglas, Mega Image, First Bank, a bubble-tea counter); H&M n1814949000 stays a vacant
  unit. The trees in front are OSM tree nodes (159 round the south front); the hedge strip has no OSM object (no
  `barrier=hedge`, live OSM 2026-11-13) and is not drawn.
- **Hanul lui Manuc** (r19803024, `building:colour=white`, `roof:shape=hipped`, `roof:colour=brown`, 2 levels, courtyard;
  inn of 1808 at the north-east corner towards the Old Town): two storeys, white walls, long dark-brown hipped roof, shops
  and terraces on the ground floor of the Str. Halelor front. A literal `building:colour` in the source tags wins over the
  style palette (`world.js`). The wooden courtyard galleries and the terraces are not modelled.
- **Hala Traian** (`halatraian`, w35147215, Calea Călărașilor 133 at the Traian corner): 1896 market hall, one of the last
  two 19th-century halls; cream facade with red-brick bands and a big arched window, small shops in front (red fascia,
  blue PESCĂRIE), a Mega Image inside; Piața Traian open market opposite on the south side; tram stop "Hala Traian" at the
  junction (platforms with red-white kerbs, wires overhead). Panorama review (44.4334, 26.1197 h257 / h351): cream hall,
  red / cream banded piers, arched central gable: match; ground-floor tenant fascias not checked. The hall and its shops
  stand 13–45 m outside the playable edge, so Mega Image n1890565824, Superbet n8628418067, Farmacia Dona n10539907931,
  Tezaur n13456671086, myGOLD n13456671089, Megapan n3144454751, Fortuna n10539907930, 5 to go n13456671090, Farmacia
  Pharma Plant n3873157367 (alphega fascia confirmed on the east side) and the tram stop n11360886995 are not in the data
  [hala_traian_mega] [hala_traian_zf].
- **Parcare Unirea** w184169515 (`amenity=parking`, `parking=multi-storey`, 10 levels): drawn with the reviewed louvred
  facade (`car-parks.js`, pale wall with a dark louvre ribbon per level), signed with its own name. The car wash on its 7th
  floor ("Spălătorie Unirea Etaj 7", n1439628129, no `level` tag) gets no street board: a business named for an upper
  floor ("Etaj n") has no street-level fascia (`world.js` `addUnitSign`).
- **Parcare Cocor** w658281398 (a `building:part` of the Cocor store, an amenity polygon without a building tag): the
  north-east street face (live OSM vertices 44.4301812, 26.1048784 → 44.4304824, 26.1044621) is a dark grey panelled
  wall with a vehicle entrance and barrier arm (`ky8lvOleKFvuiFVszKDv7Q h240`), drawn over the store's glazing there
  (`car-park-fronts.js`). Levels not visible.

**Businesses.** Live OSM 2026-11-12: 238 named businesses inside the playable area; 223 have a game POI of the same name or
brand within 40 m, the other 15 are categories the builder does not draw (craft, healthcare, generic offices, holiday
apartments, `shop=vacant`, the Piața Traian marketplace polygon). The four mapped ATMs (Euronet ×3, "Bitcoin ATM -
Shitcoins.club") show the ATM symbol on the map. 120 more businesses stand within 60 m outside the edge on frontages
visible from the playable streets and are not in the data (the builder keeps POIs only inside the edge): Hala Traian
(above), the north side of Str. Halelor / Hanul lui Manuc (5 to go n12269022954, Kiss Tea n12269022955, Starbucks
n3578133327, Hanu' lui Manuc n2486324769), the west side of the square on Splaiul Independenței (Catena n6939504485, Luca
n4073525677, Vodafone n9159258050, MEI n2455062365, Carrefour Express n10690413105) and the Old Town streets off Bd. I.C.
Brătianu. Disused units inside are in `closed` (Subway n5157603013, Uncle John n9410330827, a pharmacy n6262384181, two
unnamed shops n3875095826, n5686059121).

- **Old Town pedestrian streets** (Str. Franceză, Lipscani): cobbled wall to wall; mapped `highway=pedestrian` ways keep a
  7 m paved band, and business fascias stand on pedestrian fronts (e.g. Hanu' lui Manuc, City Grill, Mojo Music Club,
  Gelateria La Romania dal 1947).
- **Sign side** (`fix-pois.mjs`, all districts): a POI is moved only to an `entrance`-node anchor, never to the face on
  its own `addr:street` (a postal address names a street, not the face a sign hangs on: the sample would have moved
  Unirea's interior KFC / Mega Image 57 m onto the Piața Unirii facade). A node POI with two footprints within 2.5 m of
  each other stays at its own point, unlinked (`linksAmbiguous`).

**Fuel stations** (`fuel-look.js`, `fuel-stations-review.json`): OMV Bd. Corneliu Coposu w263315803: green fascia with a
blue OMV panel, white soffit, blue-and-white clad columns, islands with blue bases, white / blue pylon south-west of the
canopy (`XTVqSWyob94uGXTDzkYZFg h45`, `D1ZNjm-lmugZGMje_XXCGg h189`); its covered forecourt lanes (w79870041, w826403112,
w1478497247, `covered=yes`, `maxheight=4.25`) are a reviewed covered road under the canopy. MOL w670595374: green fascia,
curved green MOL pylon with the red logo at the west entrance (`h16qhTmS_zN0GfsQ2P6rIA h140`, `7VQRohD43rltUvsClUDt_Q
h103`).

**Palette** (estimates, JSON `colours`): interwar #D9D2C3 #E2D8C4 #CFC8B8; villas / merchant houses #E3D3B8 #E8D9BE
#D9C3A0 #E6CFC0 #CFC1A8; 1970s–90s blocks #D8CDB5 #C9B99A #BDB5A6 #CBBFA6; Civic-Centre blocks #D2C4A6; fountain water
#3FA7C9; fountain rim #A7A39A; brick hall #B5543C.

## Fountains (Piața Unirii & Bd. Unirii) — layout, jets, lighting, show

44 independent, individually controllable fountains along almost 1.4 km of Bd. Unirii and Piața Unirii, about 16,200 m² of
water; built in the late 1980s (Civic Centre), rehabilitated by Apa Nova with the city for about €7 M and reopened in
September 2018 with a digitally controlled water-music-light system; certified in 2019 by the World Record Academy as the
longest synchronised choreographed fountain array. OSM maps 45 basins in the extraction area (10 on Bd. Unirii west of the
square, 25 in the square, 10 east), matching the official 44 plus the small `amenity=fountain` w413969309. Basin outlines,
areas and jet nodes: JSON `fountains.layout.basins[]` [fountains_44] [fountains_record] [fountains_cost]
[fountains_bucharest_ro] [fountains_agir] [osm].

- **Square**: a symmetric field round the round central fountain ("Fântâna lui Bucur", n1423222582, 44.42678, 26.10246;
  relations r19943684, r19943685, monument w1176896690) in the middle of the park: two rows (north and south of the Bd.
  Unirii axis) of large rectangular basins about 48 × 35 m (≈1,000 m² each; w1128204286 / -287 / -292 / -293) flanked by
  about 34 × 31 m basins (≈630 m²) and 31 × 18 m end basins (≈450 m²), separated by paved promenades and linked by
  0.6–2 m water channels (jet slits w1176128444, w1176142645, w1176576623, w1176581104, w1176591246, w1176632035: inside
  the `fountains` landmark, not separate areas). Basins are shallow (OSM rim height 0.4 m) with grey stone / concrete
  coping.
- **Boulevard**: one line of basins in the central reservation, alternating long 28 × 7 m basins (about 11 jet nodes) and
  short 13 × 6 m basins (about 3 jets) at about 37 m pitch, west towards Piața Constituției and the Parliament and east to
  about 26.110 (Bd. Mircea Vodă); lawns, low hedges and linden rows either side; lobed stone basins in lawn with large
  conifers on the east median.
- **OSM summary**: boulevard west 10 basins, 888 m², 58 jet nodes; square 25 basins, 8,998 m², 248 jet nodes; boulevard
  east 10 basins, 892 m², 68 jet nodes; 374 jet / nozzle points mapped as `amenity=fountain` nodes (used as nozzle
  positions).
- **Jets**: lines of vertical jets in the long basins, a central tall jet and ring in the large square basins, arching /
  rotating "Vario" groups; show jets about 10–15 m in the square (estimate from photos; no official figure), boulevard
  jets 2–6 m.
- **Lighting**: underwater RGB LED projectors in every basin; colour-cycling on show nights, static white / blue after
  sunset otherwise; street lamps and advertising screens round the square add warm / white light.
- **Show** "Simfonia Apei" (Water Symphony): May to the end of September (2025: 23 May – 28 Sept), Friday–Sunday, 21:00
  (21:30 in June / July in some seasons), 45 min; water choreography to music (themes change yearly, film themes in 2024;
  special editions with drone shows) and lights; about 200,000 spectators over the first 70 shows [fountains_2025]
  [fountains_2100] [fountains_mediafax_45min] [fountains_ro_insider_2023] [fountains_drones].
- **Game rule**: Fri–Sun, May–Sept, 21:00–21:45 local → the show (jets animate to music, LEDs cycle); otherwise a calm
  daytime pattern 10:00–23:00, off at night and in winter (basins drained Nov–Apr).
- **Median** (review 2026-11-12, OSM API + Street View at Bd. Unirii 30): the boulevard basins stand in a grass median
  about 8.9 m wide (OSM `natural=grassland` strips either side of each basin wall, e.g. w1177070488 / w1177070489; basin
  6 m wide, granite wall 0.4 m high, a narrow grass strip and a kerb between wall and carriageway; shrubs and small trees
  between basins). The boulevard is symmetric about the basin axis: mapped kerbs in the square at ±14.3 m, roadside tree
  rows at ±14–16 m, so each carriageway is about 10 m. The carriageway centrelines are mapped less exactly (17.4–18.4 m
  apart, up to 1.2 m off the basin axis; w87716894 about 1.7 m too close at the east end). Both carriageways are one-way
  with `sidewalk=right`: no pavement on the median side. The game centres each median basin between the carriageways. The
  four carriageways beside the basins (w87716894, w450554042, w4276104, w153967344) carry reviewed widths in the JSON
  `road_widths` (9.5 m for the three-lane ones, an estimate from median edge to tree row; inner kerb 4.45 m from the basin
  axis), which gives a median of 8.5–9.3 m from the square to x = -1130 m and at the east end; west of that the mapped
  centrelines converge and the median narrows to 6.8 m. West of the square (44.42695, 26.098886, `unr-water-west`): low
  stone basins in a grassed median between tree rows, parked cars along the kerb: match.
- **Status 2025–26**: the 2025 season was cut short (shows until the end of June 2025), then the square's fountains were
  decommissioned for the Planșeul Unirii slab reconstruction; the game renders the full working fountains (see
  **Documented exceptions**) [fountains_dismantle] [fountains_until_june] [planseu_2026].
- **Review** (`fountains`, 44.427059, 26.102191 h140): round basins on the median match in form.
- **Other fountain basins** (`tools/osm/add-areas.mjs`, water areas with a stone coping): w413969309 (Ø 6 m, north
  sidewalk of Bd. Unirii by Unirea), w1474406316 (Colțea), w586376877, w1459195391 / w1459195396, and the Colțea garden
  basins w1180500523 / w1180500524 / w1180503225 (`natural=water`, 13–16 m², 19–46 m outside the playable edge).
  w608657873 (Piața Sfântul Ștefan, 44.43414, 26.11631): see **Documented exceptions**.

## Landmarks, monuments and street furniture

- **Dealul Mitropoliei** (Patriarchal Cathedral, `cathedral`; the Palace of the Parliament, `parliament`, closes the Bd.
  Unirii vista to the west): the hill (about 15 m) is not modelled, the district ground is flat; at its foot on Str.
  Bibescu Vodă parking, trees and steps rising to the hill. Reviews: cathedral (44.4241, 26.0827 h340 / h48) cream-white
  body, gold domes, tall central tower: match (the wall in front is outside the model); parliament (44.4292, 26.0897
  h287) massing and cream colour: match.
- **Other places**: Sf. Spiridon Nou church on Bd. Cantemir south of the square; Biserica Hagiu (1872) on Str. Traian;
  Domnița Bălașa w78564921, cream stone with red-brown brick bands (`2tFsWbmuz3BKVzjdbjqNww h277`), matches the church
  class colour.
- **Monuments** (generic class objects, `monuments.js`): 27 placed, among them Lupoaica (n1731041124) and Leul
  Ierusalimului (n7350336938) with low-poly subject forms (`MONUMENT_SUBJECT`: the she-wolf with the twins on a tall
  pedestal; a standing lion), Constantin Brâncoveanu, the four statues at Universitate, Alexandru Ioan Cuza, Șerban
  Cantacuzino, Barbu Catargiu, the Pogrom memorial obelisk and busts; none is a likeness. Not placed, reported and never
  moved (`monuments-review.json`): Mihail Cantacuzino n916016099 and Domnița Bălașa n921821381 fall inside a building
  footprint, Dimitar Hadjvasilev n6945692385 and Bustul lui Barbu Constantinescu n10726686133 on a carriageway; Fântâna
  Vioara Spartă (in water) is not placed either. Plaques and untyped artworks stay markers.
- **Kilometrul 0** n2496554613 (`tourism=artwork`): a dark bronze ring sculpture on a low round plinth in the fenced
  churchyard of Sf. Gheorghe Nou (`FW4Rlti5tfUkf9fpP8YuJg h106`): generic `sculpture` class, bronze
  (`monument-sources.js`).
- **Horațiu** n2486324771: the mapped point is a shop front (`OPtvWjzotRRHelaG81dCHg h81`), nothing free-standing; OSM has
  `fixme=Is this really here?`. Not drawn.
- **Wayside crosses**: 45 OSM `historic=wayside_cross` / `man_made=cross` nodes in the Bucharest districts use a small
  stone wayside-cross class (`wayside`, 1.5 m on a low base); the crosses in the grass median of Bd. Brătianu at Piața
  Universității (`WTniXBNPVx6ZDxHLKCnDSQ h322`) are about 1–1.5 m. 20 are in Unirii, including Troița Mântuirii Neamului
  n2079451985 (44.42795, 26.10300; no panorama within 40 m) and Cruce de piatră n9411250345 (44.42586, 26.10053).
- **Piața Unirii lamps**: tall dark candelabra lamps with globe clusters in the 2024 panoramas of the fountain field. The
  mapped `highway=street_lamp` nodes within 150 m of the square centre (16 in the square, no style tags; 8 drawn after
  de-duplication) take that form (`lamp-reviews.js`: dark post on a plinth, a cross of arms, five globes); positions are
  OSM's. Also at the corners: an advertising column (w1176142649, an OSM building, height 4, onion roof, #1d3b35),
  billboards and sphere bollards.
- **Playgrounds** n7958996084 (44.424677, 26.103238) and n5766022623 (44.43433, 26.116368): `leisure=playground` nodes
  without an outline, drawn as a generic set (rubber patch, swing frame, slide; `playgrounds.js`).
- **Sports**: pitches w412096075 (artificial turf, 44.43047, 26.11164) and w787971672 (44.42998, 26.11096) by the school on
  Str. Matei Basarab are drawn with markings; w411424158 and w788040235 further east are in the scenery ring. The courts at
  44.4255, 26.1165 (w1188316462, w1431737648–53) are 500 m outside the playable area and not in the data.

## Water, bridges and structures

**Dâmbovița.** Open channel west (polygon w174990751) and east (w174991904) of the square, covered under it (w43898061,
`tunnel=yes`, `layer=-3`, 44.42881, 26.10107 → 44.42608, 26.10438); the square is continuous over the culvert and the open
channel starts and ends at the mapped tunnel ends, with square ends (`final-water-topology.js`).

- **West** (from the south quay at 44.42932, 26.09763 looking north): dark-green iron railing on a low kerb, then one broad
  sloped concrete bank down to low water, no service bench. `water-channel-review.js`: a 4.6 m sloped bank, water at
  -4.4 m.
- **East** (44.42609, 26.10433 looking east): open water begins at the railing; a wide basin with sloped banks, water
  about 2–2.5 m below the quay. Drawn at -2.4 m with sloped banks.
- **Quays** (Splaiul Unirii east, Splaiul Independenței west): no solid parapet; an iron balustrade on a low stone kerb
  (dark ornamental panels east, plain green railing west), a grass strip and plane trees on the quay, a sloped concrete far
  bank with graffiti. The game draws a low kerb and a dark-green three-rail iron balustrade on the west channel; a coping
  strip closes the gap between ground and quay kerb along every channel quay. On the east basin w174991904 (since
  2026-11-13, `quay-balustrades.js`, from the recorded review, no new panorama) the iron is dark cast panels between square
  posts: handrail, bottom and frame rails, a lozenge with a boss in each panel and a baluster either side.
- **Weir** w1434558024 (`waterway=weir`, 44.425858–44.426298, 26.10454–26.10461, at the outfall east of the square): a row
  of about sixteen low grey concrete blocks across the basin just downstream of the covered section
  (`NrlzOfq1HTfol_d90aJ3FA h95`); `weirs.js` draws it at the basin level (water -2.4 m + 0.45 m freeboard). Weir
  w1434558023 (44.42366, 26.10951) is not drawn.

**Pasajul Unirii** (w241368617, w241368618, w1383050305; `tunnel=yes`, `layer=-1`, `maxheight=3.5`, 2 lanes each way,
44.42962, 26.10357 → 44.42481, 26.10405): three tunnel roads at layer −1, open ramps in a walled trench at both ends and a
covered box under the square. Street level (south ramp from Bd. Cantemir, May 2024; north ramp; interior): both
carriageways in one walled trench with a row of concrete planters between them; the ramp walls clad in dark grey
perforated metal with green leaf, flower and butterfly motifs, rising well above street level as a screen; a "PASAJUL
UNIRII" header over the portal; inside, pale mesh wall panels with yellow accent panels, a continuous light line along the
wall head, a dark mesh ceiling and a raised kerb walkway. The game has the dark ramp walls and the pale interior with
yellow panels and the light line (`unr-pasaj-south`, `unr-pasaj-inside`). Since 2026-11-13 (`pasaj-unirii-look.js`, drawn
from the recorded review above, no new panorama): the open ramp walls carry a pattern of green leaf sprays, flowers and
butterflies on the dark cladding, the rim is a dark cladding screen rising to 2.4 m above the street where the cut is deep
(steel uprights on the street side, the motifs on both faces), the south pair (w241368618 / w1383050305, centre lines
8.4 m apart in one cut) has a row of concrete planters with shrubs on the line between the carriageways instead of trench
walls or an inferred barrier there (the collision walls are unchanged), and each portal has a dark beam with "PASAJUL
UNIRII" (one shared by the south pair; the two north portals, 22 m apart, one each).

**Footbridge** w231671712 (`bridge=yes`, `layer=1`, 13 m, 44.42873, 26.10576 → 44.42867, 26.10562): an enclosed glazed
walkway one storey up across the brick-paved Aleea Alexandru Brătescu-Voinești from the Unirea car park (w184169515) to the
Carrefour building (w405564542), "Carrefour" lettering and logo on its side; the car-park side wall plain grey with louvres
and a "LIFT ACCES PARCARE" sign, the Carrefour side a banded glass front. Built in the Unirea landmark model.

**Not modelled**: the pedestrian subways and stairs of the Piața Unirii 1 / 2 metro stations (w533137833, w533137834,
w737802918, w740314410, w776448464, w1518548736…39, w1519547524 / 26, w1520124741 / 49 / 53, w1520220670, w1520593143,
w737802926, w1476540742; the game has no pedestrian underground, entrances are POIs); the Old Town foot passages (Pasajul
Latin, Gabroveni, Hanul cu Tei, Sf. Gheorghe Nou; w237628815, w304275386, w658176196, w658009188 / 90, w658267308,
w1574342598, w733578958, w1106897137, w658258526; footways are not in the data). Pasajul Mărășești (w241369341,
w241369588, w241369345, w899314658, 44.4237, 26.1124) is 600 m outside the playable area, a scenery street at grade.

## Trees and green

- OSM maps 5,054 trees in the extraction area with species (lists per street in the JSON): Bd. Unirii's 25 m band alone
  holds about 1,035 (Quercus robur, Tilia tomentosa, Fraxinus americana, Abies alba, Thuja and others). Lindens line Bd.
  Unirii; old chestnuts and robinias on Călărașilor; the square is open with trees mainly in the central park.
- The aerial green raster is not drawn where a cell's centre lies in a mapped water polygon (crowns over the water had
  been measured as green ground).

## Estimates and open questions

- **Places of worship** (r3-look-11, 2026-11-13; `worship.js`, tags in `worship-source.js` from the live OSM API): one rule
  from OSM tags, not church by church. A building with an Orthodox (or Armenian) `denomination` gets the convention towers,
  an octagonal drum with a metal helmet and a cross over the middle of its long axis, and a smaller pronaos tower 30 % of
  the length towards the west end when the footprint is at least 20 m long and 1.6 times as long as wide (Armenian: one
  drum with a cone; `building=chapel` or under 120 m2: one small tower; under 60 m2: none), and only where its height and
  roof are the build's estimates: an OSM `height` is read as the top of the church with its tower (nothing added), and
  building parts, mapped domes / flat roofs and courtyards are kept as mapped. Western-rite, free-church, Jewish and
  untagged buildings get none. Estimates: radius 0.2 x footprint width (1.4-3 m; small 0.9-1.5 m), drum 1.4 r + 0.8 m
  (2.4-5.5 m) above the roof top, helmet 1.3 r, pronaos tower 0.7 r and 0.4 of the drum, helmet colour from
  `roof:colour` / `roof:material`, else the roof's colour, else dark tin #5e6668. Which churches really have one tower or
  two, a porch (pridvor) or a separate bell tower was not compared (porches and separate bell towers stay unmodelled unless
  mapped). Here: 26 churches with 44 towers; no tower on 3 with an OSM height, 3 Jewish, 3 free-church, 2 Western-rite, 1 mapped dome (Sf. Nicolae - Ghica), the small or untagged ones and building parts.
- **Dâmbovița levels**: one water level per polygon, each reviewed at one place: east basin w174991904 -2.4 m (44.42609,
  26.10433), Grozăvești w170930341 -1.6 m. The west polygon w174990751 looked about 2.5–3 m down at 26.0998
  (`4Tc0SMwEbrKg8LFcABcVWg h110`) and about 4.5 m at 26.0976, but OSM maps no weir, dam or lock between them (live OSM
  2026-11-13: only the river and its culvert w43898061), and the two panoramas are of different dates on a regulated
  channel: the difference is read as the level on different days, not a step, and one level is kept (-4.4 m). The weir's
  block count and size are estimates.
- **Stops outside the playable edge** (appended, metres outside the edge): within the 30 m frontage cap, so with the
  inferred shelter on their scenery street: Piața Unirii osm377 (4 m), Hristo Botev osm504 (1 m) and tram osm524 (30 m),
  Piața Sf. Gheorghe osm507 (26 m), Hala Traian tram osm520 (28 m), Bd. Dimitrie Cantemir tram osm561 (25 m). Beyond the cap
  (POI and map marker only): Bd. Mărășești osm342 / osm359 (49 m), Universitate osm429 (44 m), Hristo Botev osm505 (74 m),
  Piața Sf. Gheorghe osm512 (95 m) and trams osm521 (41 m) / osm522 (93 m) / osm523 (42 m), Hala Traian osm544 (75 m) /
  osm545 (52 m) and trams osm552 (95 m) / osm553 (60 m). The cap is the frame budget's; whether those stops have a shelter
  is not established. Just outside the edge and not in the data: metro entrances "Piața Unirii 1 B" n5172764451 (5 m) and
  n5172764450 (30 m).
- **Playground equipment** and **candelabra sizes**: class estimates (`PLAYGROUND_MODEL`, `CANDELABRA_MODEL`).
- **Parcare Cocor front**: the wall runs to the host store's wall top (no height or levels tag); panel width, entrance size
  and barrier are estimates (`CAR_PARK_FRONT_MODEL`).
- **Unirea Shopping Center**: panel module (6.2 m), louvre pitch, banner size (a plain canvas) and the logo's letter height
  and place are estimates; the north end and the east (rear) faces were not seen on a sharp panorama and keep the light
  panel skin of the south front.
- **Footbridge** w231671712: deck height 6 m and section 3.2 × 3 m.
- **East quay balustrade** (`QUAY_PANEL_MODEL`): post pitch 2 m, post 0.1 m, handrail 1.05 m, rails at 0.36 / 0.94 m,
  colour #262b29 and the ornament (lozenge, two balusters per panel) are estimates; the review recorded "dark ornamental
  panels", not their design or sizes.
- **Pasajul Unirii look** (`PASAJ_UNIRII_MODEL`): screen height 2.4 m (rising from the 1 m rim over the first 2 m of cut
  depth), post pitch 3 m, the motif lattice (1.5 × 1.1 m), shapes and greens, planter size (2.2 × 0.9 × 0.85 m, 3.2 m
  pitch, from 0.9 m of cut depth), the header beam (1.3 m deep, letters 0.9 m, white on dark grey) are estimates: the review
  recorded what is there, not sizes or the exact panel design. Whether the north ramps (two separate cuts in OSM, 22 m
  apart) also have screens and motifs on every wall was not compared at the pano pose (the camera lands beside the trench);
  the game gives every open Pasajul Unirii wall the same treatment.
- **Fountain basins** appended by `add-areas.mjs`: the generic 0.45 m light-stone coping with full water (no panorama shows
  them; the Colțea ones are not visible from `i2dCK2VAtXOYKj-5Wy-EHA`). Show jet heights and LED details: medium–low.
- **Bd. Unirii carriageways through the square**: lane count (2), lane width and sidewalk are the builder's class defaults.
- **Wayside crosses**: size is a class estimate.
- **Fuel**: MOL's four pump islands were not counted on a panorama; OMV's curved shop canopy is not modelled. Canopy soffits
  read dark under shade although white in every panorama (lighting, not colour).
- **Open**: the GTS office unit at no. 101 (courtyard building?) is unverified; the rooftop advertising brands round
  Piața Unirii are not verified; Dealul Mitropoliei needs ground heights under its roads, buildings and the cathedral
  (backlog unirii-small); not seen at street level: Hala Traian main front, Sf. Spiridon Nou, the school pitches, the park
  interior of Piața Unirii, the tenant fronts along the middle of the Unirea west side.

## Documented exceptions

- **Planșeul Unirii works.** Since 2023 vehicles over 3.5 t are banned on the slab; its reconstruction started in 2024–25
  and was in its final stage in summer 2026 (more than 60 % done, completion expected end-2026), with restrictions round
  Pasajul Unirii [planseu_2026] [planseu_60pct] [planseu_traffic]. Live OSM tags Bd. Unirii through the square (w153967343,
  w228997261) `highway=construction construction=primary access=no` and the north half of the park `landuse=construction`
  (w1408424765 "Zona de lucrări consolidare Planșeu Unirii"). Owner decision: the game shows the 2015 chapter's layout:
  - the working fountain field and lawn;
  - both carriageways appended to the district pack as ordinary one-way primaries (`tools/osm/add-roads.mjs`, `roadAppend`
    provenance; the OSM tags stay in `roadSourceGeometry` with a `reviewedException` record), splitting round the central
    plaza between the basins as mapped and joining the existing junction nodes; traffic crossed the square beside the
    basins in the 2024 panoramas too.
- **w608657873** (Piața Sfântul Ștefan, 44.43414, 26.11631) is still mapped as `amenity=fountain`, but panorama
  `m4ZygVZxXJZodU3nvvedUg` shows a round planted bed at grade (a shrub, grass), no basin: OSM looks stale; excluded
  (`add-areas.mjs --exclude`). Correcting the OSM object is a mapper's edit, not made from this repo.
- **Stop at Piața Sf. Gheorghe** (node/5810960053, appended, no shelter metadata): pano `6pmwrKMHq2FbxifltMYaqw` shows a
  pole only; `world-shared.js` `STOP_POLE_ONLY` draws the pole and sign without the inferred shelter.

## Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 map tiles, 2026-11-06; live re-checks 2026-11-12/13) |
| wp_unirii_sq | https://en.wikipedia.org/wiki/Pia%C8%9Ba_Unirii_(Bucharest) |
| wp_bd_unirii | https://en.wikipedia.org/wiki/Bulevardul_Unirii |
| wp_unirea | https://en.wikipedia.org/wiki/Unirea_Shopping_Center |
| fountains_44 | https://www.antena3.ro/actualitate/celebrele-fantani-din-centrul-capitalei-se-pregatesc-sa-isi-reia-stralucirea-de-altadata-cand-se-487207 |
| fountains_record | https://newsweek.ro/actualitate/foto-fantanile-din-piata-unirii-bucuresti-recunoscute-ca-record-mondial |
| fountains_2025 | https://www.revistabiz.ro/programul-spectacolelor-de-apa-la-fantanile-urbane-din-piata-unirii-incepe-din-23-mai-2025/ |
| fountains_apanova | https://www.bursa.ro/apa-nova-reabiliteaza-fantanile-de-la-unirii-87307434 |
| fountains_cost | https://www.romania-insider.com/bucharest-unirii-fountains-record |
| fountains_ro_insider_2023 | https://romania-insider.com/bucharest-urban-fountains-resume-shows-summer-2023 |
| fountains_bucharest_ro | https://www.bucharest.ro/article/the-urban-fountains-of-unirii-square-a-tourist-attraction-recognized-by-the-academy-of-world-records-83 |
| fountains_agir | https://www.agir.ro/univers-ingineresc/numar-17-2019/fantanile-urbane-din-piata-unirii-omologate-drept-„cel-mai-lung-sir-de-fantani-coregrafice-sincronizate-din-lume“_6553.html |
| fountains_2100 | https://www.antena3.ro/actualitate/noul-sezon-al-evenimentului-urban-simfonia-apei-debuteaza-pe-4-mai-cu-incepere-de-la-ora-21-00-519481.html |
| fountains_mediafax_45min | https://www.mediafax.ro/cultura-media/spectacolul-simfonia-apei-revine-si-anul-acesta-sambata-la-fantanile-urbane-din-piata-unirii-18109548/amp |
| fountains_dismantle | https://www.g4media.ro/spectacolele-simfonia-apei-de-la-fantanile-urbane-din-piata-unirii-vor-mai-avea-loc-doar-in-urmatoarele-trei-weekenduri-din-30-iunie-incepe-dezafectarea-fantanilor-pentru-lucrarile.html |
| fountains_until_june | https://www.antena3.ro/actualitate/spectacolele-simfonia-apei-de-la-fantanile-urbane-continua-pana-la-finalul-lunii-iunie-749199.html |
| fountains_drones | https://www.stiripesurse.ro/fantanile-urbane-din-piata-unirii-vor-celebra-performantele-olimpice-romanesti-cu-spectacole-de-apa-lumini-si-drone_3384799.html |
| vice_fountains | https://www.vice.com/ro/article/fantanile-din-bucuresti/ |
| planseu_2026 | https://www.antena3.ro/actualitate/locale/lucrarile-la-planseul-unirii-intra-in-ultima-etapa-trafic-restrictionat-pe-perioada-verii-ce-trebuie-sa-stie-soferii-790958.html |
| planseu_60pct | https://www.g4media.ro/foto-de-sambata-noi-restrictii-de-trafic-in-piata-unirii-lucrarile-la-planseul-unirii-intra-in-ultima-etapa-de-executie-proiectul-este-realizat-in-proportie-de-peste-60.html |
| planseu_traffic | https://www.wall-street.ro/articol/transporturi-and-infrastructura/ultima-etapa-a-lucrarilor-la-planseul-unirii.html |
| hala_traian_mega | https://www.romania-insider.com/bucharest-city-hall-organizes-call-reconstruction-19th-century-hala-matache |
| hala_traian_zf | https://www.zf.ro/eveniment/sorin-paslaru-zf-piata-matache-piata-1-piata-obor-piata-sudului-22226182 |
| ref_hala | https://commons.wikimedia.org/wiki/File:133_Calea_C%C4%83l%C4%83ra%C8%99ilor,_Bucharest_(01).jpg |
| calarasi_200 | https://www.digi24.ro/stiri/actualitate/primaria-vrea-sa-largeasca-calea-calarasilor-pe-care-se-afla-200-de-imobile-protejate-de-lege-879277 |
| gts_job | https://poslovi.infostud.com/poslodavac/global-technical-systems/55637 |
| gts_hermes | https://www.zfenglish.com/companies/global-technical-systems-moves-offices-to-hermes-business-campus-23165494 |
| gts_termene | https://termene.ro/firma/31050700-- |
| gts_biz | https://www.revistabiz.ro/gts-global-intelligence-a-preluat-lummetry-companie-romaneasca-de-inteligenta-artificiala/ |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |
| euronews_10km | https://www.euronews.ro/articole/cosmarul-traficului-din-bucuresti-nu-s-a-schimbat-10-kilometri-in-peste-45-de-minute |
| hotnews_axis | https://hotnews.ro/bucurestiul-pe-locul-8-n-topul-celor-mai-aglomerate-de-trafic-orase-din-lume-23247 |

The Bucharest-wide sources (road signs and markings, STB, Metrorex, lighting, trams) are listed in the JSON `meta.sources`.
