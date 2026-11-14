# Bucharest — Grozăvești & Politehnica (`grozavesti`): research dossier

The reference for why the Grozăvești district looks the way it does: facts about the real place, their sources, the
estimates the game makes where no source exists, and the places where it knowingly differs from OSM.

## Overview and sources

- **Data.** First generated 2026-11-06 (role research-buc-districts) from the OSM API 0.6 snapshot of that day; reality
  pass 2026-11-08 (sixteen OSM API tiles over 44.425–44.465, 26.029–26.093, the actual `cities.js` band and circles plus
  their 600 m scenery ring, at 1:1; source hashes and the imagery measurement ledger in
  `handoffs/fidelity/d-grozavesti/source-ledger.json`; z18 aerial mosaic 44.428, 26.038 – 44.458, 26.079 at about
  0.426 m/px, acquisition date unknown, only derived measurements committed); live OSM re-checked 2026-11-12/13. Every
  OSM fact is keyed by id (w = way, n = node, r = relation). Bracketed keys like [osm] point to **Sources**.
- **Machine-readable twin** `bucharest-grozavesti.json` holds the generated tables: per-street
  segments, every building with its style-rule facade estimate, businesses, junctions and crossings, transit lines, stops,
  metro entrances and STB liveries, the Bucharest-wide streetscape rules (`city_rules`), palette (`colours`),
  `top_local_details`, `gaps`, district pedestrians (`dialogue`) and traffic hotspots (`traffic`). Business detail:
  the Businesses and speed limits section below.
- **Street level.** Official Street View panoramas were looked at only; nothing was stored, traced or measured from them.
  A panorama is cited as its id plus heading (`hGqephV5yIK6jWNVMdcHBw h70`) or as its position. Game views:
  `node game/dev/reality/capture.cjs --district=grozavesti`.
- **Images.** `refs/grozavesti/`: nine Commons photos, mostly of the UPB Rectorat (2004, 2024 day and night) and the
  Bitdefender building (licences in `refs/LICENSES.md`).
- **Heights.** OSM `height` / `building:levels` where mapped, otherwise default estimates.
- **Confidence.** *high* = OSM / official / encyclopedic; *medium* = consistent across photos or common knowledge;
  *low* = estimate.

**The place.** The Dâmbovița runs here in a straight concrete channel with a one-way Splai on each bank; Pasajul Basarab, a
two-level viaduct carrying cars and trams, towers over Șos. Orhideelor; the Regie student campus (long rows of 1970s
dormitories) lines the north bank and the fenced UPB campus the south; The Bridge glass towers (IBM, Bitdefender, BCR) stand
on Orhideelor. Students everywhere in term time; open, flat, windy riverside.

## Chapter route and CV stop: `upb` (2013)

- **Route.** Start on Șos. Orhideelor southbound at 44.447432, 26.062618 (heading 242°), with the Basarab overpass
  alongside; over the Dâmbovița on Podul Grozăvești (Grozăvești metro and the Regie campus on the right), south on Bd.
  Doina Cornea along the UPB campus (trams in the middle), in through the campus gate to the Rectorat forecourt
  (44.438998, 26.051727). 1744 m on the OSM drivable graph respecting one-ways: Orhideelor 586 m, Podul Grozăvești 57 m,
  Șos. Grozăvești 70 m, Doina Cornea 607 m, campus service road 424 m.
- **Stop.** Universitatea Politehnica din București, Rectorat, Splaiul Independenței 313, Sector 6 (campus "Noul Local";
  the Leu site is at Bd. Iuliu Maniu 1-3): w28240552 (5 levels) inside campus w23608402 [osm] [upb_address].
- **No street frontage.** The drive ends through a campus gate and about 420 m of private campus road (`access=private`,
  barriers at the gates). Vehicle gates: Bd. Doina Cornea side (n6810324892, 44.43807, 26.05543) and Splaiul Independenței
  side (campus road w26314495 / w178160268 meets the eastbound Splai at about 44.4441, 26.0538). The Splai carriageway
  beside the campus (w227053932) is one-way eastbound.
- **Look.** 1970s modernist Rectorat: long symmetrical frame of pale vertical concrete fins with red panels between the
  window bays, a brick recessed lower floor, a recessed glazed top storey, a wide roof slab, and a wide shallow saucer
  dome (the aula) on the roof, its rim lit blue at night; flagpoles; large paved forecourt with parking. Facade review
  2026-11-08 from the 2024 Commons photos (CC BY-SA 4.0), measurements in `landmark-politehnica-measurements.json`. OSM
  gives 5 levels and no metre height; the dome is roof part w1217715300 (`min_level=6`), about 40 ± 4 m across on aerial
  imagery [ref_upb]. No driving-street panorama faces it (none within 200 m).

## Streets and traffic

- **Șos. Orhideelor** (secondary, one-way pairs of 2–3 lanes, 50 km/h): runs beside and below the elevated Pasajul Basarab
  from the Gara de Nord side down to Podul Grozăvești; trams 11 / 44 in the shared carriageway, buses 105, 123, 162, 163,
  178. Frontage W: The Bridge office campus (three towers, 11 levels, 52 m), Ahrend; E: Poliția Locală Sector 6, the
  Lukoil station, Sir Orhideea hotel. OSM maps **no** jersey barrier or guard rail across Orhideelor at ground level: the
  concrete parapets belong to the Basarab decks above (`bridge=yes`, layer 1–2) [osm] [newsweek_basarab].
- **Bd. Doina Cornea** (secondary, dual carriageway 2+2, 3 at junctions, 50 km/h): trams 1, 10, 11 on a central
  reservation (part shares the Basarab viaduct approach), bus 105; UPB campus fence on the W side, the Politehnica railway
  halt on the E side, Enel and OMV.
- **Șos. Grozăvești** (primary / secondary, one-way pairs, 2 lanes each, 50 km/h): trolleybus 63, buses 105 / 1929; tram
  tracks cross at the Splai.
- **Podul Grozăvești** (57 m, 3 lanes each way): short road bridge over the Dâmbovița linking Orhideelor and Șos.
  Grozăvești; Grozăvești metro (M1) entrances at both ends, Regie campus to the north-west [wp_grozavesti_metro]
  [adevarul_grozavesti_works].
- **Splaiul Independenței**: a one-way carriageway on each bank: south (campus) bank eastbound 2–3 lanes (40–50 km/h),
  north (Regie) bank westbound 2 lanes; trams 1 / 11 and trolleybus 90 sections; poplar and linden rows on the
  embankments. Frontage N: Regie dormitories (P1–P27, U1–U6, five- to nine-storey 1970s blocks), Ibis Politehnica, Novum
  Invest; S: UPB campus fence, Casa Corpului Didactic.
- **Bd. Iuliu Maniu** (south edge, one-way pairs of 3 lanes, 50 km/h): trolleybuses 61, 62, 63, 93; Politehnica metro
  (M3) entrances A–C; new 11-storey offices on the north side (The Light One, Campus 6.1 / 6.2, 45 m).
- **Signals** on the route: n32934941 (Podul Grozăvești × Splai × Orhideelor), n304485447 (Doina Cornea × Economu
  Cezărescu), n32934934 (Bd. Regiei × Orhideelor), n981556145 (Calea Giulești × Orhideelor); Doina Cornea × Iuliu Maniu
  (Politehnica metro) is a large signalised junction with trams and trolleybuses.
- **Transit**: buses 105 (the classic UPB–Regie line), trams 1, 10, 11, 44 on and beside the viaduct, trolleybuses on
  Iuliu Maniu, Șos. Grozăvești and the Splai; metro Grozăvești (M1, entrances 44.44285, 26.05994 and 44.44264, 26.06105),
  Politehnica (M3) and Petrache Poenaru.
- **Traffic hotspots** (JSON `traffic.hotspots`, read by `cities.js` congestion). City: about 62.5 % congestion, 171 h
  lost per driver in 2025, worst slot Wednesday 17:00–18:00 [tomtom_2025] [tomtom_2025b].

| hotspot | lat, lon | radius m | hours (local) | level | evidence |
|---|---|---|---|---|---|
| Podul Grozăvești / Orhideelor | 44.4437, 26.0612 | 180 | 7.5–10, 16.5–19.5 | 0.65 | Basarab corridor overloads (+10,000 cars when Podul Grant is closed) [newsweek_basarab] [tomtom_peak] |
| Iuliu Maniu × Doina Cornea (Politehnica) | 44.4346, 26.0545 | 160 | 7.5–9.5, 16–19 | 0.6 | Militari commuter flow + campus [tomtom_peak] |
| UPB gates (term time) | 44.4381, 26.0554 | 100 | 7.5–9, 15–18 | 0.35 | students crossing, cars queuing at the barrier (assumption) |

## Buildings and shopfronts

**Key buildings** (research rows; the JSON `buildings[].research` carries the same values):

| OSM | name | storeys / height | facade | roof | era | notes |
|---|---|---|---|---|---|---|
| w661134293 | The Bridge 1 (Orhideelor 15D) | 11 / 52 | #7D93A0 glass curtain wall | | 2017 | [osm] |
| w699470645 | The Light One | 11 / 45 | #8A9BA5 glass + white fins | | | [osm] |
| w28240552 | UPB Rectorat | 5 / – (OSM has no height) | #EDEDE8 white concrete frame grid + red infill panels (#B8312F) + glazing | flat with a central shallow saucer dome (aula), blue rim lighting at night | 1970s | upb [osm] [ref_upb] |
| w50538006 | Biblioteca Centrală UPB | | | | | [osm] |

**Reviewed buildings and landmarks** (`building-review.js`, `game/src/landmarks/`; live OSM 2026-11-13):

- **The Bridge 1** (`thebridge1`; pano 44.4441, 26.0628 h212): dark glass box, grey mullion grid, BCR band: matches.
- **Centrul Comercial Orhideea** w23557062 (height 8) with **Carrefour** w925593033: pale panel façade with red bands, no
  continuous shop glazing, large blue Carrefour lettering above the west façade (pano 44.444372, 26.061485 h25 / h70).
  Row: style `plain`, pale; landmark `orhideeasign` draws the white panel wall with red bands and the lettering. The red /
  orange entrance canopy at the north-west rotunda has no OSM outline or height and is not drawn.
- **Brico Dépôt / Altex** w247015071 (height 15, flat roof; Altex POI at 44.448203, 26.062284; panos 44.447216, 26.061955
  h0 and 44.448422, 26.062576 h270): long light-grey ribbed panel box with a red fascia band, a red Altex front at the
  south-east corner and a grey glazed entrance volume. Row: style `plain`, light grey. `facade-bands.js` draws the band
  round the top (1.5 m deep, 0.4 m under the eaves) and the red front on the south-east corner, 16 m along each of its two
  walls, from the top of the shopfront glazing (4.2 m) to the eaves.
- **Turnul de apă, Belvedere** w678037221 (`man_made=water_tower`, historic, height 30, `building:levels=8`,
  `roof:shape=cone`; pano 44.447216, 26.061955 h19 from Calea Giulești): weathered grey-beige rendered shaft with flat
  pilasters and one vertical row of small windows, a wider tank head with round windows and cornices, low crown. Landmark
  `turnulapa`: tank head on the exact mapped outline (r ≈ 5.6 m), shaft radius 4.2 m (0.75 of the head, from the
  panorama's proportions), top 30 m (OSM), low cone behind a parapet.
- **CET Grozăvești** (`cetgrozavesti`): four waisted concrete cooling towers (w188102855, w188102865, w188102870,
  w188102882, height 50) and seven steel stacks (w905217275–7, w905217281, w905217307–9, height 50) behind two large grey
  fuel tanks on Șos. Grozăvești; profile estimated. Hidden behind blocks and trees at every street pose found.
- **Germag** (Bd. Banu Manta 2, n5862008006, appended by `add-pois.mjs`): a block carrying an appended street-level shop
  POI gets the builder's shop-unit flag, so a shop front with its fascia (pano `wEy2ri9fhmOq0iOEkX5jIg`).

**Businesses.** Live OSM 2026-11-12: 116 named businesses inside the playable geometry, 108 in the game at their mapped
place. Not drawn (categories the builder does not keep): Columbia Fitness n6793227019, Domestina România n13710547706,
Manpower n11508840180, WorkAsia.ro n11998746459, Bioclinica n14013820311, Debarcaderul Regie w1429973848 (marina),
Grădinița nr. 168 w1331454041 (drawn as grounds without a name sign). Mall units beyond the playable edge are not signed by
design.

**Fuel stations** (`fuel-look.js`, `fuel-canopy-review.js`, `fuel-stations-review.json`):

- **OMV Bd. Doina Cornea** w239359996: green fascia with a blue OMV panel, white soffit, blue-clad columns, pump islands
  either side of the drive lane; a white pylon with a blue head by the grass at the west entrance (`o-A84Hr8qgnnLr-yuzR3ag
  h85`, `MvkbucAsNkIDNRPMJ6Q9Ag h172`). The station's own mapped service lanes cross the canopy in three directions; three
  islands are drawn, each 2.7 m clear of every service centre line. A second plain white canopy (wash / shop side) is part
  of the same footprint area.
- **Lukoil Șos. Orhideelor** w256806132: open canopy on white columns, red fascia with white LUKOIL letters, white soffit,
  red-clad columns (`hGqephV5yIK6jWNVMdcHBw h70`); no pylon on the frontage in two panoramas (a billboard stands there).
  Canopy height: see **Documented exceptions**.
- **Petrom Bd. Al. I. Cuza** w237830689: yellow fascia with blue curved accents, round blue columns, open canopy wrapping
  the kiosk; no pylon from either street (`dfKJPktXMs74JuwfOWbUDQ h88`, `lScnlaZqLyfRA7Kzl9V6nQ h358`). Entered only from
  outside the map; the shop under the canopy is not modelled.
- **MOL Bd. Dinicu Golescu** w326062450 (`PXJbcAsSr6l3B5-zQqqutA h124`): open canopy on columns, green MOL fascia, small
  kiosk; fascia and boards from the way's own OSM brand tag (estimated 5.4 m top / 4.6 m clearance); the pack has no fuel
  POI on it, so no pumps or pylon.

**Palette** (estimates, JSON `colours`): 1970s–90s blocks #C9C4B8 #BDB7AA #D3CEC2 #B8B2A6; interwar #D9D2C3; office glass
#7D93A0; canal water #5E6F5A; canal concrete #A8A499.

## Landmarks, monuments and campus

- **UPB campus and Rectorat** (`politehnica`, w23608402): fenced campus, parking everywhere; see the CV stop.
- **Regie student campus** (w23770544): rows of five- to nine-storey 1970s dormitories along the north bank; Fabrica
  Grivița (w247015087) and One Club bars.
- **School pitch** w678756216 (46 × 33 m; pose 44.439158, 26.056929 h313) inside the school ground w813901657
  (`amenity=school`, `barrier=fence`), which shares its south-east side with Universitatea Artifex w813677026
  (`amenity=university`, `barrier=fence`). The pack keeps no barrier tags, so `area-fences.js` draws both outlines as a 2 m
  welded-mesh fence, open along building walls, on mapped paths and at the gate nodes n6244816927 and n3709955844. The
  street-side tree row has no OSM trees; the generated kerb row stands there.
- **Monuments** (generic class objects, `monuments.js`): 11 placed, among them Leul (Monumentul Trupelor de Geniu,
  w170953582: a low-poly lion on its pedestal, `MONUMENT_SUBJECT`, not a likeness), the George Caranda obelisk (OSM height
  6 m), the Panait Donici bust (OSM height 4 m), Coloana Timpului and sculptures.
- **Fountain basins** w1454825579 and w1279629948 (`add-areas.mjs`): no official panorama within 50 m.

## Water, bridges and structures

**Dâmbovița** (w170930341 `water=river`, r6213935): a concrete channel with sloped slab banks and green water; a black
steel railing with posts on the quay sidewalk and a tree row between sidewalk and railing, on both banks. From the north
quay (44.443748, 26.058521, looking SSW) the water is about 1.5 m below the quay with a short sloped revetment; the
section is drawn at -1.6 m (`water-channel-review.js`). Green aerial-raster cells that touch a channel are not drawn (the
raster classifies about 46,000 m² of river surface as lawn). A weir crosses the river about 100 m west of Podul
Grozăvești (w902058419), drawn as a low sill.

**Podul Grozăvești and the Basarab arch** (w902056192 `bridge:structure=arch`, street-level decks w128304847 /
w128304855, trams w128304859, w660918286): street-level decks with, from the kerb, a row of concrete planters with shrubs,
a sidewalk, and a grey steel picket railing between square concrete posts at the water (44.443114, 26.060816 h80); drawn
as planters at the kerb (same collision rail) and the picket railing on the sidewalk edge (`water-bridge-railings.js`,
`bridge-guards.js`). The Basarab viaduct crosses above on blue steel girders hung from a pale grey arch. All 31 road bridge
ways of live OSM match the game's bridge flag and layer; no road tunnel exists in the area.

**Regie footbridge** w799487638 (`type=moon bridge`; 44.444677, 26.053527 h220): humped open footbridge with green steel
railings, street level at both ends; drawn by `pedestrian-bridges.js` ('arched'); the quay parapet and railing stay open
where it lands.

### Pasajul Basarab

Cable-stayed viaduct (2011) along Orhideelor and Doina Cornea carrying cars and trams; the cable-stayed span is near Gara de
Nord, outside the district. Street View, viewed 2026-11-11/13 (reference only; the game follows it):

- **West ramp** (Pasajul): both carriageways at street level at 44.44005 (z ≈ 128), then one embankment on retaining
  walls with a grass median as they climb; a kerbed concrete median with the arch hangers on the river arch; no railing
  between the carriageways.
- **Ramps by Șos. Nicolae Titulescu**: the climbing carriageway (with the tram) is at street level at 92 Titulescu, about
  2.5 m up at 87 Titulescu on a solid retaining wall with a low parapet, and an open viaduct about 6 m up with parking
  beneath at 44.45084, where Titulescu stays at street level. The trams reach street level where the rail bridge ends on
  Titulescu (44.45172, 26.07131).
- **Piers**: single hammerhead piers about every 30–40 m. The cable-stayed main span carries the deck with no piers from
  the last stay anchor (44.44893, 26.06688) to the pylon.
- **Guards**: blue steel railings (rails and posts) on concrete kerb barriers on every deck seen (Doina Cornea, Bretea,
  Exit → Giulești, Calea Plevnei, ramp w128304850; 44.441673, 26.060264 h220; 44.444732, 26.061237 h13). Only the
  river-arch span carries a white tube guard rail with an outer orange pedestrian railing (44.443076, 26.060567 h250, on
  the upper deck). Game: blue off the arch, white on it (`basarab-structure.js` `BASARAB_GUARD_STEEL`). The tram slab has
  its own blue steel railing beside the carriageway's concrete barrier.
- The Orhideelor entry ramp passes under the viaduct about 1 m up, its barrier at the street's edge (44.44529, 26.06167).
  Calea Griviței at the south-west link ramp foot is at street level.
- **Tram station on the viaduct**: covered platforms w620826242 / w620826243 with a glazed barrel canopy over both; the
  "footbridges" w738281332–45 are the footways on the two platforms (layer 1, level 1), drawn by the platform model;
  w738281345 is a 5 m `layer=3` link between platform footways w738281336 (ref 1) and w738281339 (ref 10), a tagging
  oddity, not a separate structure.

**Pedestrian passages** (live OSM 2026-11-13; `underpass-mouths.js`):

- **Grozăvești metro passage** w737986560 / w737986561 (`tunnel=yes`, `layer=-1`) between the two subway entrances. West
  entrance n610921621 (no OSM building; pano 44.442913, 26.060332 h256): a low glazed pavilion, grey metal frames, shallow
  white roof, blue Metrorex "M" on the east front: landmark `grozmetro`, 10 × 5 m, 3 m west of the door node. East entrance
  n2479115705 under the OSM roof w905217305 (`building=roof`, 14 × 8 m): an open canopy (3.9 m top, 3.45 m clearance) over
  a stair well, open at the east end, down towards the passage that leaves westwards. No panorama of the east entrance was
  compared.
- **Doina Cornea / Splaiul Independenței underpass** w277315766 (35 m, no steps or width mapped): a stair well with
  parapets and handrails at each end node on the tunnel's axis; both runs are cut short where they would reach the Splai
  kerb (4.3 m and 3.5 m drawn).
- **Politehnica** w737868100 / w980510524 / w1071237750 are `level=-1` concourse ways between the station stairs
  (w1071237751 / -754 / -756, `level=-2;-1`) with no street-level end; the street entrances are subway_entrance POIs.
  Other pedestrian subways (`tunnel=yes`, layer -1) are underground and their entrances not modelled.

## Trees and green

- **Pedestrian plazas**: the shared rule ([shared-rules.md](shared-rules.md#pedestrian-plazas)). Here: 45 plazas, none
  tagged grass.
- 27 OSM trees in the 2026-11-06 extract (four Populus near Str. Economu Cezărescu); poplar and linden rows along the
  canal embankments; campus lawns and car parks. Street species lists are in the JSON (`streets[].research.trees`).

## Estimates

- **Places of worship**: the shared rule ([shared-rules.md](shared-rules.md#places-of-worship)). Here: 3 churches with
  5 towers; no tower on 4 with an OSM height (Sf. Mina, Sf. Nicolae, Belvedere, Sf. Gheorghe - Plevna), the Baptist ones
  and the untagged chapels.
- **Dâmbovița**: the -1.6 m section was seen at one place; the weir sill height is a model estimate.
- **Regie footbridge**: rise 1.6 m and width 4.2 m.
- **Grozăvești metro pavilion**: footprint, heights and position; the east canopy's height, columns, stair run and well
  width; the Doina Cornea underpass stair runs.
- **Turnul de apă**: shaft radius and bands; **CET Grozăvești** tower profile.
- **Altex**: band depth, front width and the glazing line.
- **School pitch fence**: height and post pitch.
- **Fountain basins** w1454825579, w1279629948: the generic coping and full water.
- **Leul**: height is the class estimate.
- **MOL Dinicu Golescu** canopy height.
- **Rectorat**: construction year and architect not found (look from photos); floor heights, fin depths and bay widths
  are estimates. The campus internal road layout is only from OSM; the Orhideea entrance canopy cannot be measured
  without tracing a panorama, so it is not drawn.

## Documented exceptions

- **Lukoil canopy** w256806132: live OSM (v7, 2026-11-13) tags `height=3`, which leaves 2.6 m under the slab; both official
  panoramas (`hGqephV5yIK6jWNVMdcHBw h70`, `FxOOz6e8e3HgHwgY0fxicg h137`) show a roof about 5–5.5 m high. Drawn at 5.4 m
  with 4.6 m clearance like the district's other canopies (`fuel-canopy-review.js`) for as long as OSM tags 3 m.

## Sources

| key | URL |
|---|---|
| osm | https://www.openstreetmap.org (API 0.6 map tiles, 2026-11-06; live re-checks 2026-11-12/13) |
| upb_address | https://upb.ro/en/?p=14876 |
| upb_bucharest_ro | https://www.bucharest.ro/article/the-polytechnic-university-of-bucharest-a-legacy-of-innovation-and-excellence-223 |
| upb_zsn | https://zilesinopti.ro/locuri/universitatea-politehnica-din-bucuresti-upb/ |
| ref_upb | https://commons.wikimedia.org/wiki/Category:Universitatea_Politehnica_din_Bucure%C8%99ti (exact files in refs/LICENSES.md (refs/grozavesti/)) |
| wp_grozavesti_metro | https://en.wikipedia.org/wiki/Groz%C4%83ve%C8%99ti_metro_station |
| adevarul_grozavesti_works | https://adevarul.ro/stiri-locale/bucuresti/de-azi-nu-se-mai-circula-in-zona-podului-1377962.html |
| newsweek_basarab | https://newsweek.ro/actualitate/podul-grant-se-deschide-doar-pe-jumatate-bucurestenii-nu-scapa-de-haos-in-trafic |
| tomtom_2025 | https://www.romania-insider.com/tomtom-bucharest-residents-stuck-traffic-2025 |
| tomtom_2025b | https://universul.net/bucharest-residents-spent-over-a-week-stuck-in-traffic-in-2025/ |
| tomtom_peak | https://www.romania-insider.com/bucharest-has-the-biggest-traffic-jams-in-europe-study-shows-which-are-the-busiest-hours |

The Bucharest-wide sources (road signs and markings, STB, Metrorex, lighting, trams) are listed in the JSON `meta.sources`.

## Businesses and speed limits

Research pass 2026-11-07 (spec 20, R12.2 / R11). Machine-readable: `businesses-bucharest-grozavesti.json` (one entry per business, independents included) and the `bucharest-grozavesti` block of `speedlimits.json`. Zone = everything within **60 m of a chapter route** (routes recomputed on the OSM graph from `CHAPTERS` starts to the stop doors, one-way and turn-restriction aware) **plus** recognisable businesses within 50 m of a main street (motorway…tertiary) inside the district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out. Confidence and sign-style rules as in `bucharest-floreasca.md` (Businesses and speed limits).

### On the chapter route (upb)

| brand | category | address | side | conf. |
|---|---|---|---|---|
| BCR | bank | Șoseaua Orhideelor 15D | W side of Șos. Orhideelor | medium |
| Lukoil | fuel + convenience | Șoseaua Orhideelor 4 | E side of Șos. Orhideelor | medium |
| OMV | fuel | Bd. Doina Cornea 5 | SE side of Bd. Doina Cornea | medium |

Fuel: canopy fascia in brand colours plus a price pylon at the kerb. Lukoil's international assets (Romanian stations included) were offered for sale in Nov 2025 (Wikipedia "Lukoil"), so the station brand may change. Nine independents on the route are in the JSON.

### Official-locator checks

- **Carrefour Express** Șos. Orhideelor 15A: position match, "Express Orhideea Towers" (121 m), carrefour.ro/corporate/magazine.
- Closed per OSM lifecycle tags: n6792143476 (`disused:amenity=restaurant`, 44.44581, 26.05984): draw as a vacant "De închiriat" unit if modelled.

### POIs added from live OSM (2026-11-12 / 13)

`tools/osm/add-pois.mjs --edge 100` on API 0.6 tiles of the playable area + 260 m appended the businesses, places and stops the build lacked, including the 100 m edge strip. Not added by rule: closed / disused / vacant objects, research-stale and research-closed businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls (Carrefour Orhideea gallery, 40), unnamed objects, ATMs outside the area.
- Germag n5862008006 (`shop=yes`, named; a named `shop=yes` counts as a shop): pano wEy2ri9fhmOq0iOEkX5jIg shows the GERMAG front at Bd. Banu Manta 2.
- Street View, Calea Griviței 158: ground-floor shop fronts where the game has a Catena fascia (name not readable in the preview). 6 Bd. Iuliu Maniu (The Light One): glass office tower, no tenant name dominates at street level.

### Speed limits on the chapter route

Romanian legal default: see `bucharest-floreasca.md` (Businesses and speed limits). **upb** — 1661 m, all OSM ways tagged.

| street | class | m | OSM maxspeed | game km/h |
|---|---|---|---|---|
| Șoseaua Orhideelor | secondary | 536 | 50 | 50 |
| Șoseaua Orhideelor | secondary | 300 | RO:urban | 50 |
| Podul Grozăvești | secondary | 56 | 50 | 50 |
| Șoseaua Grozăvești | secondary | 70 | 50 | 50 |
| Bulevardul Doina Cornea | secondary | 691 | 50 | 50 |

Schools / kindergartens within 150 m: Grădinița nr. 168 (w1331454041, 41 m).

### Sources

OpenStreetMap API 0.6 tiles fetched 2026-11-06 and 2026-11-12, © OpenStreetMap contributors, ODbL; official Street View panoramas viewed for appearance only (nothing stored); locators as listed in `bucharest-floreasca.md` (Businesses and speed limits).
