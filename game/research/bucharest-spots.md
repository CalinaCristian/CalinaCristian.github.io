# Bucharest tourist spots (research dossier)

What the seven Bucharest spot scenes model, from which sources, what is a documented exception to OSM, what is estimated
and what was not compared. First research 2026-11-06; reviewed against live OSM and Street View 2026-11-12/13.

The scene specs are machine-readable in [`bucharest-spots.json`](bucharest-spots.json): `ranking` (method, evidence per
spot, places considered and not selected, caveats, source key), `dialogue_general` (persona library, pedestrian lines,
`culture_notes`) and `spots[]` (footprint, `walk_extent`, structures with OSM ids and dimensions, ground, vegetation,
furniture, lighting, backdrop, crowd, sounds, plaques with sources, interaction, postcard pose, season, copyright note,
colour samples, refs, dialogue). Those fields are not repeated here. Reference images: [`refs/buc-spots/`](refs/LICENSES.md).

## Sources and conventions

- **OSM decides** position, outline and class (ODbL, © OpenStreetMap contributors). Live reads: OSM API 0.6 `map` calls and
  Overpass, 2026-11-12/13; where live reads failed, the scene extracts of 2026-11-07.
- **Street View**: official Google panoramas were looked at beside game renders from the same position and bearing, as a
  visual reference only; nothing was stored, traced or measured. What a panorama shows and OSM does not map is listed per
  scene as a documented exception or an estimate. User photospheres: position and heading unreliable.
- **No freedom of panorama in Romania.** Photos of recent works (the Parliament, the 2015 Carusel interior, the Memorial of
  Rebirth, the National Cathedral, sculptures) are modelling reference only, never textures. Sculptures are drawn as size
  class and material, not reproduced.
- Colours (`*_hex`) are judged albedos from photos under varying light; paving patterns (fan setts at Stavropoleos,
  Lipscani cobbles) are photo-derived, not surveyed. Dimensions in metres; `*_est` = estimated.
- Ranking: Tripadvisor, Lonely Planet, Trip.com and bucharest.ro were not reachable (403 / DNS); their positions come from
  search snippets. Visit Bucharest studies measure searches on one guide site, not footfall. KartaView / Mapillary not used.
- Dialogue: Romanian for locals with an English translation, tourists in their own language; tourist origins from the
  Visit Bucharest 2024 study. Lines stay factual about 1989 and Ceaușescu, Vlad Țepeș is a national figure (Dracula only as
  souvenir patter), no ethnic jokes, never confuse Romanians with Roma (full notes: `dialogue_general.culture_notes`).

## Rules shared by the Bucharest scenes

- **Shopfront evidence** (`spots/buc.js` `bucBackdrop`, `shopfrontKinds`). `spots/osm.js` (hash-locked for the Seattle
  context pack) glazes the whole ground-floor ring of every urban `building=yes` over 7 m. The Bucharest backdrop gives such
  a building a neutral kind unless there is evidence: a mapped front business (shop, craft, street-front amenity) inside or
  within 3 m of the outline, or an outline within 22 m of a trunk / primary / secondary centre line. The 22 m part is a
  rule of thumb from panoramas (Calea 13 Septembrie blocks have commercial ground floors OSM does not map; the palace 25.6 m
  behind Calea Victoriei at the Memorial of Rebirth and Piața Revoluției 1 have none). Blocks of flats with mapped shops
  (Bd. Unirii 1–11) stay without a shopfront because osm.js would glaze their courtyard sides too (C. A. Rosetti courtyard
  gate panorama); a front-only shopfront would have to live outside osm.js. Old Town opts out (`shopEvidence: false`).
- **Name boards.** Mapped named venues get a board on their own building; names are the OSM names, colours procedural.
  Closed venues (OSM `disused:` / lifecycle tags) get none. Strip clubs, massage parlours and erotic shops (17 adult-venue
  POIs in Old Town) stay unsigned by design, although Street View shows their lit signs. The north scenes (Arcul,
  Herăstrău / Village Museum, Spring Palace) build with `urban: false`: no shopfronts (villas, embassies, museum and park
  buildings behind walls and trees); named businesses / embassies / museums get a plain board on the façade facing the
  nearest mapped way, slid and narrowed so it never hangs past a corner (`scenes/buc-green.js` `businessSigns`,
  `boardOnWall`).
- **OSM barriers** (`spots/buc-barriers.js` `osmBarriers`): mapped walls, fences, hedges, retaining / city walls and
  `area=yes` walls (plinths, piers) within 60–120 m of the walk extents; `height` / `min_height` where tagged (a fence with
  `min_height` stands on a plinth). Openings where a mapped footway or street crosses and at mapped gates; skipped where the
  scene has its own railing / wall / hedge within 1.2 m, inside hero exclusions and inside building outlines. Untagged
  heights are estimates (`DEFAULT_H`: wall 1.8, fence 1.5, hedge 1.1, retaining wall 1.0, city wall 3.0 m).
- **Unnamed mapped places** (`spots/buc-places.js` `osmPlaces`): waterfalls as small stone cascades, viewpoints as "look out"
  points, playgrounds as swing frame + slide + sand box clear of mapped ways and buildings, `furniture.gate` nodes as stone
  piers with an open iron double gate, point-mapped households as a peasant house turned along the nearest lane.
  Estimates: waterfalls 1.6 m high × 2.4 m wide, playground equipment and layout (OSM maps only the point), gates 3.6 m wide
  with 2.4 m piers, node houses 8 × 5.5 m.
- **Trees.** Mapped OSM trees carry heights (5–36 m) and size the crowns; generated street trees are dropped within 16 m of
  a mapped tree. OSM maps the park polygons of the north scenes but almost no trees: `buc-green.js` `parkWoods` fills mapped
  `leisure=park|garden`, `landuse=forest`, `natural=wood` (and, thinner, garden land between buildings) with a deterministic
  scatter clear of every mapped way, building, pitch, playground, fountain, statue and water body; counts and positions are
  estimates. `dropMedianTrees` removes generated trees between two mapped one-way carriageways, on mapped
  `area_highway=traffic_island` or ringed by carriageway. Far trees are chunk-culled with a low crown (`farCanopy`).
- **Interiors** (Carusel, the Freddo room, the hidden bar) are declared roofed volumes (`spots/precip-shelter.js`
  `declareInterior`): no rain or snow inside, interior floors never take the snow tint, and from inside the first 30 m of
  each view ray stay clear while the weather fog acts beyond (the street seen through the Carusel door keeps its fog).
- **Data.** Scene data is built by `game/src/spots/tools/build-data.mjs` from `fetch-buc.mjs` extracts (box = research
  footprint + 260 m, `bboxOf`). A rebuild keeps unnamed viewpoint / playground / waterfall nodes, named building nodes, named
  office / embassy outline ways, `barrier=gate` nodes (not disused) as `furniture.gate`, and the tags `min_height`,
  `description`, `start_date`, `bridge:structure`, `bridge:support`. Live-OSM additions between rebuilds:
  `tools/spots/append-osm-features.mjs` (SHA-256 of the raw API replies in each scene's `osmAppend.runs[].inputs`) and
  `tools/spots/enrich-osm-tags.mjs`. A research `walk_extent` sets the walkable extent instead of the footprint (the
  footprint still sets the extract box).

## Palace of the Parliament and People's Salvation Cathedral (scene `buc-parliament`)

### Palace of the Parliament & Piața Constituției (`palace-parliament`)

- **Modelled (OSM):** Palatul Parlamentului r2230391: 270 × 240 m, 84 m (en wiki) / 86 m above ground (ro wiki), 9 levels
  above and 9 below ground, 92 m deep; OSM `height=29` is only the eave of the outer wings. Piața Constituției w219710325
  (236 × 103 m), a paid car park most of the year, cleared for events (panorama July 2019: matches). Clock "București 1459"
  n6049432585. Bd. Unirii fountains n10936684801–811, n10936684660–668, basins w1177217420 / w1177217423 in the median
  (match). Curved 9-storey blocks on Bd. Libertății w41474365, w207162869 (268 m). Visitor entrance on the north side
  (Str. Izvor 2-4 / Bd. Națiunile Unite). Senate gardens r19749443 (in the data as r19749443_0 / _1).
- **Hill (estimate).** From Bd. Libertății the lawns climb behind a tall retaining wall and the palace base stands above
  the fence line. Raw EU-DEM v1.1 on the axis: about +8 m at 40 m and +15 m at 60–80 m behind the fence. Scene levels:
  platform +16 m over the square, lawns 5.5→8, 10.5→12.5 and 15→16 m between the mapped retaining walls w1444650056 /
  w1444650060 / w1444650053. The platform is clipped to the mapped wall ring; Calea 13 Septembrie and Bd. Națiunile Unite
  keep the DEM and the lawn banks up behind the wall (bank width estimated). EU-DEM / SRTM / ASTER are surface models (palace
  and trees mask the ground): settled only by a ground survey or LiDAR.
- **Perimeter wall** w94522653 (`barrier=wall`, 13 gate nodes; `scenes/buc-walls.js`): a solid cream stone wall a little
  over head height (about 2.2 m on a base course), relief panels between square piers with pyramid caps about every 8 m,
  closed iron gates at the mapped gate nodes (13 Septembrie, Izvor); short wrought-iron grilles between the piers on
  Bd. Libertății; on Bd. Națiunile Unite the piers carry an iron grille on a low base course. Height, bay and gate width
  are estimates.
- **Flags:** three masts right in front of the portico, about as tall as its columns: the tricolour between the EU and
  NATO flags.
- **Bd. Unirii head:** mapped tree rows (107 north, 145 south between scene x 150 and 330 m) and brick alleys between
  shoulder-high clipped hedges (panoramas May 2025). The hedges are not mapped: offset 2.4 m from the alley centre line and
  height 1.25 m are estimates.
- **Calea 13 Septembrie:** mapped limes and chestnuts are 5–12 m, so the cathedral shows from the street as in the May 2025
  panoramas. The blocks have commercial ground floors OSM does not map (panoramas 7vLdZnH1rb0pRqmlF8cOTQ,
  HruNm9PDoDAxhtpKreQ8hw, 2024). 25 name signs from live OSM on Bd. Unirii / Calea 13 Septembrie.
- **Parcul Izvor** w14262324: all 308 mapped trees kept (far canopy beyond the nearest 1,400); fence w178307163 low and dark
  green (height estimated). Garages block w393036569 (`building=garages`): one storey.
- **Panoramas used:** Bd. Libertății (May 2025, about 44.42744, 26.09073), Calea 13 Septembrie at the cathedral (44.42471,
  26.08879, Aug 2024), Strada Izvor 86 (44.42951, 26.08152), Bd. Națiunile Unite at the visitors' gate (44.43034,
  26.08874). The north / west palace faces seen from Națiunile Unite match in tiers and colour; façade detail is generic.
- **Not compared:** the palace's south face and the Senate gardens' look (no panorama resolved on Bd. Libertății south,
  Calea 13 Septembrie west or Izvor west).
- **Copyright:** the architect's heirs have claimed a 2 % royalty for commercial use of images of the building;
  non-commercial use is described as unrestricted (en wiki). Keep the game non-commercial; no palace photos as textures.
- **A local would notice if wrong:** the square is huge, open setts / parked cars, no trees or lawn; cream / ivory stone
  with dozens of identical arched windows per tier, not grey concrete; embroidered-looking flower parterre and conical
  clipped thujas in the front garden; the curved blocks have an arcaded top storey; the Unirii fountains start where the
  square ends, axial with the palace centre; gendarmes at the gates.

### People's Salvation Cathedral (`peoples-salvation-cathedral`)

- **Modelled (OSM):** Catedrala Națională w232332568: 120.7 × 70.9 m, 127 m (133 m to the cross), bell tower 86 m over the
  west portal, long axis 95°. Piazza r16698908 (pedestrian area, 13,270 m² in OSM; 11,600 m² and 23,000 people per en
  wiki), retaining walls w1223607030–35, chapel w224624283, Casa Academiei r2230394. Parcul Catedralei w393036564
  (`landuse=construction`) is drawn as plain ground.
- **Not compared:** no official panorama on the piazza or within 217 m of Parcul Catedralei, so the precinct is not
  compared up close.
- **Copyright:** recent architecture, reference only.
- **A local would notice if wrong:** white stone with many gilded ribbed domes, the central one huge and gold; bell tower
  over the west portal; wide open stone piazza; 9–11 storey 1980s blocks along Calea 13 Septembrie; the Parliament right
  next to it on the north.

## Old Town and south Calea Victoriei (scene `buc-old-town`)

Spots `old-town-lipscani` and `stavropoleos-cec`. Walkable: the research `walk_extent` of each spot (Lipscani 28–71 and
upper Smârdan; Strada Stavropoleos from the church to Caru' cu Bere), `OLD_TOWN_FOCUS` in
`scenes/old-town-nightlife.js`. Everything else is the source streets and buildings as scenery. Façades not trimmed by the scene follow the Bucharest rules (19th-century
stucco fronts below 7 storeys).

### Streets

Per-street venue lists (every OSM venue within 18 m with terrace flag, hours, position, plus listed buildings):
[`old-town-streets.json`](old-town-streets.json). History from ro / en Wikipedia (Strada Lipscani, Gabroveni, Șelari,
Covaci, Smârdan, Franceză articles; Hanul cu Tei, Hanul lui Manuc, Curtea Veche).

- **Lipscani** (about 1 km in OSM, Calea Victoriei to Calea Moșilor): named after merchants of goods from Leipzig (Lipsca);
  eclectic late-19th / early-20th-c. fronts; restored and repaved in the early 2010s, when medieval inn ruins were found.
  Banca Berliner Gesellschaft (1910–13), Hanul Gabroveni (1739, ARCUB), Hanul cu Tei, Cărturești Carusel (no. 55), the
  National Bank old palace on the south side between Smârdan and Doamnei.
- **Gabroveni** (220 m, Șelari to Bd. I.C. Brătianu): Gabrovo knife merchants; Caragiale's beer hall of 1893; the whole
  street is a listed ensemble (LMI B-II-a-B-18798).
- **Șelari** (260 m, Lipscani to Splaiul): saddlers; nos. 20–22 listed (B-II-m-B-19749).
- **Covaci** (210 m, Șelari to Sf. Anton, setts): "smith"; Cafeneaua Veche (listed B-II-m-B-18510, "the oldest attested
  café in Bucharest") and Taverna Covaci, next to where mici were invented; "Strada Nouă" until 1852; setting of Mateiu
  Caragiale's "Craii de Curtea-Veche".
- **Smârdan** (370 m arc, Doamnei to Șelari): Ulița Nemților, documented 1672, renamed 1878; 19th-c. Hotel Brenner / Hotel
  d'Europe; at no. 39 (Hotel Concordia) the National Party decided on 23 January 1859 to elect Cuza in both principalities;
  former Banca Agricolă, Van Gogh Café, the old National Bank wing.
- **Franceză** (526 m, Piața Unirii side to Calea Victoriei): probably the oldest street on its medieval line; the 1847
  fire started here; listed ensemble B-II-a-B-18765 (listed houses at nos. 2–4, 8, 9, 11–14, 16–18, 20, 28, 30–32, 34, 36,
  40, 42, 44, 48); Curtea Veche church at no. 33, Hanul lui Manuc at no. 62.
- Look: 1–3-storey eclectic / neoclassical fronts with cornices, wrought-iron balconies, arched ground-floor shop openings;
  shared-surface grey cobbles without kerbs; continuous terraces with awnings, lanterns and festoons (panoramas May 2025 on
  Lipscani and Smârdan). Awning colours, terrace sizes, per-building façade colours, string-light positions and lamp models
  are estimates.

### Old Town heroes (`old-town-lipscani`)

- **Cărturești Carusel** w658009149 (shop n3355049764): 27.4 × 13.4 m, narrow front on Lipscani, six levels with the
  white atrium; an 1860 bank building, bookshop since 2015. Interior (2015 redesign) is copyrighted: reference only.
- **Hanul lui Manuc** r19803024 (70.6 × 61.8 m, two storeys, white plaster, long dark roof, "HANUL MANUC"): matches from
  Bd. Coposu and Str. Franceză. Built 1806–08 by Manuc Bei (1812 Treaty of Bucharest); four wings with two tiers of
  galleries (arcaded ground floor, wooden balustraded gallery above) round the courtyard, a grand staircase under a kiosk
  with a pointed roof; historically 15 vaulted cellars, 23 shops, 107 rooms; restored 2012 (LMI B-II-m-A-18788).
- **Curtea Veche** ruins w658220894 (67.8 × 42.3 m) and the Buna Vestire church w150803286 (1559; single tower, fine brick /
  plaster banding; blind arcade and windows generic). **Owner decision:** the game shows the open ruins, the monument's
  lasting state. The latest official panorama (2022-10, Str. Franceză) shows them under a temporary roof behind site
  fencing; the 2026 state is unknown.
- **Hanul cu Tei** r19931391 (1833, passage Lipscani 63–65 → Blănari 14; passage way w658009190) and **Pasajul Gabroveni**
  w304275386. Hanul cu Tei, built by Anastasie Hagi Gheorghe Polizu and Ștefan Popovici, is the only Bucharest inn kept in
  its original form: a 75 m north–south passage of shops over vaulted cellars, ornamented iron gates at both ends, the
  monogram "A.P." / "S.P." at the Blănari end and "1833" over the entrance; today galleries and a cellar bar. Documented exception: two storeys with deep timber eaves round the outer walls and the passage (2022-10
  panorama), while the data keeps OSM's `building:levels=4`. Eave depth and colour estimated; the shops' iron shutters are
  not drawn. Passage venues Mom Art (n10775260927) and Cele Trei Grații (n10775962190) get boards.
- **Ruinele Hanului Șerban Vodă** n6164079116 (part w658220780; inn of 1683–85, dug up 2007): a low walk-on glass cover
  over the cellars; frame layout estimated.
- **National Bank**, old palace w1210146218 and new palace w1210147193: no OSM height or colour; pale limestone, 4 / 6
  storeys (estimates). Lipscani front (2022-10 panorama): no shopfront, a 7-step stair, planted beds behind a spear-top
  railing, and a façade skin with rusticated ground floor and round-arched windows, pedimented windows between paired
  pilasters, a dentilled top storey, cornice and balustrade (`scenes/ot-fronts.js` `bnrLipscani`). Bay width, storey
  heights and balustrade height are estimates; the Doamnei side (colonnade) has no official panorama and stays generic; the
  conifers in the Lipscani beds are not in OSM and not added.
- **Businesses:** live OSM 2026-11-12 matches the data; node n1731040985 is "Mojo Music Club" on the OSM API (an Overpass
  mirror returned an older "Mao Pub"). Appended from live OSM: Gelateria La Romania dal 1947 n14360710671, Pizza al taglio
  n14360710672 (Lipscani 76, panorama `5US26vfoz6vYXxqBYx39Fg`), Class shoes n14360710673. Closed for good per Google Maps (2026-11-11) but still in OSM, so their signs stay until OSM changes:
  Coffee & Travel (Lipscani 52), Ted's Coffee Co. (Lipscani 79), CLATeatARIE (Lipscani 20), Uau Gelato (Gabroveni 1-3).
- The plaques "Lipscani = Leipzig" and "Guild streets" stand on Lipscani.
- **A local would notice if wrong:** every ground floor a bar with a terrace pergola; black cast-iron lantern lamps, not LED
  poles; Carusel pure white and curving inside behind an ordinary 19th-c. front; Vlad Țepeș bust at Curtea Veche and
  Dracula-magnet stalls; overhead cables and AC units; uneven 2–5-storey heights.

### Things to do by day and night

Every activity stands at a real OSM place inside the visit area, on the street in front of it; no interior, kiosk, sign
or terrace is added (`scenes/old-town-daylife.js`; achievements `lm-<key>`). A closed place says so and gives its opening
hour. Checked 2026-11-11.

| Activity (key) | Place | Open in game | Source and what is estimated |
| --- | --- | --- | --- |
| `lipscani-coffee` | Gregory's, Lipscani 27 (n6324709232) | 08:00–16:00 | Google Maps only (medium): Mon–Fri 07:30–16:00, Sat–Sun 07:30–18:00; game uses the weekday hours, rounded, every day. The cup is a plain espresso |
| `jacks-papanasi` | Jack's Pub, Lipscani 45 (n1416626264) | 10:00–02:00 | jackspub.ro + Google Maps (high): Sun–Thu 10:00–02:00, Fri–Sat 10:00–05:00; reviews mention papanași. Generic plate |
| `lipscani-busker` | the scene's busker on Lipscani | 10:00–24:00 | buskers documented thinly (Coldplay filmed a Lipscani singer, June 2024, antena3.ro; a 2005 "free zone" for about 20 street musicians, adevarul.ro); busker, guitar case and hours are estimates |
| `lipscani-photo-walk` | Smârdan to Lipscani | always | Freddo's front, the Carusel arch, the festoons over Lipscani (the scene's own modelled fronts) |
| `mojo-karaoke` | Mojo Music Club, Lipscani 69 (n1731040985, `karaoke=yes`) | 21:00–03:00 | venue hours Google Maps; karaoke nightly from 21:00 (In Your Pocket, bucharest.ro: undated, medium), end not found, game stops 03:00; upstairs, free entry, 18+ from 22:00 (mojomusic.ro/regulament). Room not modelled: you sing at the door. Tune "Lipscani refrain" (2026), original, CC0-1.0 |

- **Freddo** (Smârdan 24; OSM n1416523788 in w657568283; freddo.ro checked 2026-11-09): the source building and entrance;
  the interior is estimated. **Owner decision:** by day Freddo is visibly closed with "opens 22:00"; the game's
  Freddo is its club night, 22:00–05:00; the bar's published daytime hours (10:00) are not modelled. Club music
  (`spots/club-music.js`, "Lipscani after dark", 2026) is an original procedural composition, CC0-1.0: no samples,
  quotations, recordings or known melodies.
- **Left out:** Bubble Waffles (Smârdan 37, existence not verified); Obraznic (Smârdan 12, adult-novelty waffles);
  St. Patrick Irish Pub (Smârdan 23-25, daily 11:00–02:00, stpatrick.ro); Muzeul Micul Paris (Lipscani 41, Wed–Sun
  11:00–19:00, would need an interior); ARCUB Hanul Gabroveni (Lipscani 84-90, Tue–Sun 10:00–20:00, would need an interior
  and programme); Hanul cu Tei gateways as a photo target; the Șerban Vodă glass cover (just west of the visit area).

### Stavropoleos, Caru' cu Bere, CEC Palace and the History Museum (`stavropoleos-cec`)

The entry arrives on Str. Stavropoleos.

- **Stavropoleos church** w78444014 (1724; 17.9 × 13.8 m, about 18 m high, est.): ochre plaster under dark timber-shingle
  roofs (panoramas Str. Stavropoleos 44.43189, 26.09864 and 26.09812); frieze colours estimated. The churchyard boundary is
  OSM's plinths and piers (w657432484, w1181448687–698) with the fences on them (w1181448722–730, `min_height` 0.5,
  `height` 1.8), on the street and west sides only.
- **Caru' cu Bere** w1456401783 (OSM `building=yes` only; POI n916075216): steep slate roof with a gabled centre and a slim
  corner spire, "CARU' CU BERE" over the door. Roof rise, gable and spire sizes estimated; bay balconies and terrace
  parasols not modelled. The terrace (position and furniture from OSM `outdoor_seating`) is not compared with a panorama.
- **CEC Palace** w973712798 (60.5 × 45.2 m, landmark model). The 162 mapped parts carry the domes as stepped flat rings
  (`roof:shape=dome` / `onion` unsupported), so dome shells sit over the mapped steps: central r 8.4 m from 24.6 m (the
  lantern w657898053 rises to 37.5 m above it), four corner domes r 4.5 m from 25.2 m; radii and rises are estimates inside
  the mapped totals. Garden boundary w657976539 / w657976540: a turquoise railing on a stone kerb with the mapped gates
  (heights estimated). In this scene the stone is warmed (red +4 %, green +1.5 %, blue −7 %, an estimate) toward the warm
  cream limestone of the 2023-08 panoramas; the landmark source colours and the driving world are unchanged. OSM maps the
  garden trees as 5 m Prunus persica while the 2023 panorama shows mature 12–18 m trees; OSM's trees are kept.
- **National History Museum** (Palatul Poștelor) r19919941 (`landmarks/bucharest-centre.js` `bMNIR`): colonnade, steps, lettering; the two
  end pavilions on Calea Victoriei carry domes (r 4.7 m, estimate) over a low hip base; the 10 OSM flagpoles. Invented
  street trees in front of both palaces are removed (OSM trees kept) and the landuse grass is paved.
- **Pasajul Macca–Vilacrosse** (w108817126, w108817130, w657742193, w108817132, w657740097, w657740103; OSM `tunnel=yes`,
  `layer=-1`, `covered=arcade`; not walkable): Eugeniu Carada portal (arch, iron-and-glass fanlight, stone surround); block
  r19924112 three storeys per panorama. Documented exception: the Calea Victoriei end of the Macca arm (w108817132) is
  mapped open but covered in the 2023-08 panorama, so it has a pitched iron-and-glass roof between the mapped walls
  (`ot-fronts.js` `maccaGlassRoof`; height 1 m under the lower flanking eaves, at most 10.5 m, 1.4 m rise, 2 m ribs:
  estimates). The Vilacrosse end (w657740097) runs on the shared wall of r19924111 / r19924112 with no gap to roof: as mapped.
- **Panoramas used:** Calea Victoriei 2023-08 (44.43181, 26.09704; 44.43137, 26.09688; 44.43238, 26.09701), Lipscani at the
  BNR 2022-10 (44.43216, 26.09936 / 26.09985), Eugeniu Carada 2022-10 (44.43299, 26.09897), Bd. Corneliu Coposu (44.42903,
  26.10212).
- **History Museum, known differences:** (1) from 44.4319, 26.097074 heading 150 the real view shows the south pavilion dome above the
  colonnade; in the game the line to the dome (top 32.2 m, 90 m away) crosses the portico attic, which projects about 8 m
  in front of the pavilions with its top at 20.3 m. The real projection, column height and attic height are not measured
  (OSM maps the outline only). (2) The model's 3 m podium has four steps protruding 1.1 m; the 2023-08 panoramas show broad
  steps rising from the forecourt. Podium height and stair depth unmeasured, no steps in OSM; the model stays as it is
  without a measurement.
- **A local would notice if wrong:** Stavropoleos is tiny and hemmed in by taller buildings; carved stone columns and
  painted medallions; setts in fan arcs with light slab bands; Caru' cu Bere usually has a queue; CEC glass dome plus four
  corner domes; the naked bronze Trajan on the History Museum steps.

## Romanian Athenaeum & Piața Revoluției (`athenaeum-revolution`)

- **Ateneul Român** w16291602 (41 m, peristyle 48 m, hall Ø 28.5 m, 794 seats; frieze "ATHENEUL ROMAN"). Garden w23556716:
  white stone balustrade on a low wall, tall old trees with many conifers (panoramas Aug 2023); Eminescu n1911337561 a
  standing bronze on a low base.
- **Royal Palace / MNAR** w232472401: drawn on the mapped outline, 17.5 m (mapped parts 15.7–18 m); beige limestone,
  rusticated ground floor with arched windows, piano-nobile windows as tall round arches with balustrades, paired
  pilasters, attic balustrade (panoramas Sept 2024). Court railings w1478814648, w1476829138, w1476829137 (`height=2`,
  metal), w1457045952, w1457045969: iron on a low base. Three sculptures in the court n11068954269–71.
- **Central University Library** r19896250: dark slate mansard, domes with lanterns on the two rounded corner pavilions
  facing the square (sized to the mapped pavilion outlines). Carol I n1883108499 at the mapped 13 m.
- **Kretzulescu church** w1476760553: red brick, two towers domed per the OSM parts. Part w1476833908 (31–31.5 m, no
  base) is open sky in the 2024 panoramas: not drawn, listed in `extras.sourceContradictions`.
- **Revolution Square:** Memorialul Renașterii n1393030628, a plain white spire with a dark woven ball about 3/4 up (sizes
  estimated; no Commons images, deleted for no FoP). Memorial Revoluție w996044652, a white marble wedge on the mapped 6 m
  outline (size and orientation estimated). Former CC building: white stone, giant columns, balcony at the recessed centre.
  Wall of Remembrance w1454592908 / w1454592909 (1.6 m, estimate). Fountain basin w175449008 with jets at the 7 mapped
  nodes. Busts Corneliu Coposu, Avram Iancu, Alexander Dubček; Iuliu Maniu memorial w1454535798. The bronze figure group is
  not in OSM: not placed.
- **Calea Victoriei 68–70** w958584624 (`building=apartments`, 7 levels, `start_date=1954`): stone neoclassical in the 2024
  panorama, so the eclectic stone façade (`athenaeum-revolution.js` `STYLE_BY_ID`) instead of the levels rule's 1980s bloc.
- **Car parks:** 190 parked cars on the mapped aisles of w241119386, w239206890, w23556698 and neighbours
  (`scenes/ctr-parking.js`); the perpendicular bay layout is an estimate. The CC lot w23556698 shows more rows in 2024 than
  the mapped lawns allow: OSM's lawns are kept.
- **Venues:** boards for the mapped venues and named hotels / theatres; Hotel Lido w162494340 (`disused:tourism=hotel`) and
  English Bar n2463617058 (`disused:shop`) closed, no sign. Crocante n14363552618 (fast food, 44.443518, 26.09266) is in
  the data but about 200 m outside the walk (sign area = walk + 40 m): no board.
- **Panoramas used:** Calea Victoriei 47 / Piața Revoluției (44.43877, 26.09709), Piața George Enescu and Revolution Square
  2024–25, Piața Revoluției 1 (0sGmssKDFO598LkYM63_-A).
- **Not compared:** Athénée Palace (InterContinental) and the library's other sides.
- **A local would notice if wrong:** dark grey dome over a white drum with lyre medallions; six fluted Ionic columns, gold
  mosaic medallions behind; cars park in front behind steel bollards; equestrian Carol I in front of the library, the CC
  balcony opposite.

## Arcul de Triumf (`arcul-de-triumf`)

- **Modelled (OSM):** the arch w217851530 (27 m on a 25 × 11.5 m base, opening 11 × 9.5 m, long axis 69.7°, passage along
  Kiseleff at 160°), roof w1191615181, passage w1191738378; landmark model `landmarks/bucharest-civic.js` `bArcul`.
- **Inscriptions:** from Romanian Wikipedia, "Arcul de Triumf din București", section "Arhitectura monumentului" (accessed
  2026-11-13; no footnote): south "DUPĂ SECOLE DE SUFERINȚE … CU AJUTORUL ÎNTREGII NAȚIUNI ȘI GÂNDUL REGINEI MARIA", north
  "LIBERATOR DE NEAM … DUPĂ ÎNCORONAREA LA ALBA-IULIA", east "GLORIE CELOR CE PRIN LUMINA MINTEI ȘI PUTEREA SUFLETULUI AU
  PREGĂTIT UNITATEA NAȚIONALĂ", west "GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR DE SÂNGE AU ÎNFĂPTUIT UNITATEA
  NAȚIONALĂ" (full wording in `scenes/arcul-de-triumf.js` `INSCRIPTIONS` and the landmark). Carved five lines per long face,
  three per short face; the line breaks are not in the source (balanced by length).
- **Approaches:** splitter islands and the strips between carriageways are open (signals, paving, low grass): generated
  trees there are removed; the five mapped trees on the east side stay. Both sides of Kiseleff are closed mature woodland
  (estimated canopy).
- **Lamps:** Kiseleff has light grey poles with one curved arm and a disc head (single-arm style, light grey). The
  roundabout has tall multi-head masts: eight on the outer verge (`extras.arcMasts`, seven clear of the approach
  carriageways). Count, 16 m height, four heads and the verge offset (kerb + 2.2 m) are estimates; OSM maps no lamp there.
- **Panoramas used:** the arch from the south (44.466984, 26.078359; 44.46641, 26.07847), north (44.467656, 26.077879;
  44.46790, 26.07779), east (44.467132, 26.078782), Kiseleff south of the arch (44.466061, 26.078638).
- **Not compared:** the park edges; villas and embassies keep generic façades (no comparison per villa).
- **A local would notice if wrong:** it stands in a busy roundabout reached by signalised crossings; light granite with long
  carved inscriptions on all four attic faces; bronze medallions of Ferdinand and Maria on the south face; terrace open in
  season.

## King Michael I (Herăstrău) Park and the Village Museum (scene `buc-herastrau`)

### Herăstrău park (`herastrau-park`)

- **Charles de Gaulle** bronze n530686317 (Mircea Corneliu Spătaru) at the south-east entrance. Panorama (44.466759,
  26.085790): wide asphalt forecourt, the bronze on a lawn island with a paved path and flower beds (beds not modelled),
  closed woods behind (the game's park is thinner).
- **Statues:** mapped `artwork_type=statue` objects are standing figures, or small animal forms for the three animal
  bronzes (Curcan, Căprioară, Gâscanul); bust / statue material follows the OSM `material` tag; each faces the nearest
  mapped path. The Sleeping Nymph n1342884103 carries a camera exercise. Michael Jackson plaque n2382565617 (the 1992
  concert fact is not plaque-sourced).
- **Japanese garden** w28342074 (10,749 m²): live OSM maps only a dog park (w274448991) and a footway (w339802841) inside, no
  water and no bridge, so none is drawn. The stone lanterns (from this dossier's description) stand at estimated positions
  clear of both; the cherries are an estimated scatter.
- **Shore:** the mapped asphalt promenade w370524819; lake r1130828. The water edge (coping / quay) and the garden planting
  are unseen: no official panorama within 230 m of the south shore or the Japanese garden.
- **Casa Presei Libere** r15922160 at its real position 1.3 km north-west, view-only; it closes the Kiseleff axis in the
  panorama at 44.475032, 26.074000 (faint in the game haze).
- **Trees:** 6,723 estimated park trees; beyond 320 m from the walk extents the two-lump far crown.
- Mapped and drawn: playground n2791579390, viewpoints n2791530781 / n2791530802 on Insula Trandafirilor.
- **A local would notice if wrong:** dozens of stone busts on plinths along asphalt alleys; joggers, cyclists and
  rollerbladers; benches full of retirees; lake railings, ducks, pedal and tour boats.

### Dimitrie Gusti National Village Museum (`village-museum`)

- **Modelled (OSM):** museum grounds and fence w29701978 (778 × 264 m, 10 ha); wooden church w277782593 (15.8 × 6.6 m,
  graveyard crosses n13004324741… south), identified as Dragomirești (1718–22) because it is the only wooden church in the
  sector (spire over 35 m from a single press source); Gospodăria din Ieud w277782449; Palatul Elisabeta w102780052
  (backdrop). The households are generic regional types on the real footprints. Point-mapped houses Casa Mastaacăn Neamț
  n6815285188 (OSM spelling) and Casa Naruja, Vrancea n6815289695 get a peasant house at their node.
- **Windmills: not placed.** No `man_made=windmill` in live OSM inside w29701978 (2026-11-12) and no official panorama inside
  the museum (nearest official coverage on Kiseleff, 44.47155, 26.07613), so there are no positions to place them at.
- **Panoramas used:** Kiseleff at the museum (44.471548, 26.076127; 44.472284, 26.075721): plane-tree verge, cycle track,
  dense wood; the gate is not visible from the coverage.
- **A local would notice if wrong:** houses in small fenced yards on grass; the church's needle spire and shingles
  everywhere, a tall spruce beside it; steep shingle or reed roofs, whitewashed walls in Oltenia / Muntenia; well sweeps,
  wayside crosses, wattle fences; dirt alleys under big old trees.

## Spring Palace (`spring-palace`)

- **Modelled (OSM):** main building w549676146 (53.5 × 42.3 m, identified by size), annex w549676153 (32 × 30.7 m, probably
  the pool wing), grounds w38236017. The grounds polygon is a 4-node outline in live OSM, much smaller than the real
  14,830 m² plot, so the tree belt behind the wall is thin. Architect attribution conflicts in the
  sources (Grimberg-Solari vs Lăzărescu).
- **Frontage:** on Bd. Primăverii a plain rendered wall about 2 m high with greenery over it (height estimated); the other
  sides keep a railing. The scene's gate on the boulevard is an estimate: none of the 11 mapped gate nodes in the extent
  lies on w38236017 (nearest 46 m; n6262632759–61 belong to neighbours); the mapped gates are drawn by `osmPlaces`. Planted
  grass median on the boulevard. No far city filler: north and east are Lake Floreasca and the park.
- **UN House** w216674220 / n12857652820 (`scenes/nth-un-house.js`; panoramas 44.468815, 26.091417 and 44.46881, 26.09142):
  white modernist block, ground floor + three storeys + a set-back top floor with a railing, stacked rounded balconies on the
  corner toward the palace, gold "UN HOUSE" letters with an emblem, and on the pavement a grey stone base wall with dark
  green bar panels and gates (the neighbouring lot has the same). Footprint from OSM, letters from the OSM name; storey
  heights (3.8 + 3 × 3.1 + 3.0 m), balcony radius 2.5 m, wall line (kerb + 3 m pavement) and gate positions are estimates;
  windows are continuous bands (reality: separate windows).
- **Kuwait embassy:** live OSM has n5470974719 "Ambasada Kuweit" (Bd. Aviatorilor 94-96, v4 2022-01-09) and w781162166
  "Ambasada Statului Kuwait" (Bd. Primăverii 52, v4 2022-09-21). Both stay (OSM decides); the board sits on the villa's east front (panorama `SX8mIxs3UE94qbTFIlKK4g`).
- Mapped and drawn: playground n6401707601. Other villas and embassies keep generic façades.
- **A local would notice if wrong:** a quiet villa street with high fences and embassies, not a grand square; cream stucco
  villa with arched ground-floor windows and a balustraded terrace; peacocks in the garden.

## Cișmigiu Gardens (`cismigiu`)

- **Modelled (OSM):** Lacul Cișmigiu w16292044 (410 × 140 m, 19,500 m², depth 1.5 m estimated) and Lacul Lebedelor
  r12837108 (two islets, stone edge, jet at w843007163); piers w753761841, w951486102 / 03; ponds w951486099 / 100. Bridge
  decks from the OSM outlines (Podul Mare 5.06 m); Podul de Nuc w1478446295 (`bridge:structure=beam`, abutment, 1859) a flat
  beam deck. Pole clock "Cișmigiu" n10864971740 at the Regina Elisabeta entrance. The rink plaque stands on the lakeside
  alley (scene 84.3, 93.8).
- **Rotonda Scriitorilor** n473428600 (1943): OSM maps the twelve busts one by one (n10877381995–n10877382004,
  n10877399405, n10877399406) on a ring of about 21 m radius: Bălcescu, Coșbuc, Odobescu, Vlahuță, Alecsandri, Hasdeu,
  Eminescu, Maiorescu, Caragiale, Iosif, Creangă, Zamfirescu.
- **Other monuments at their nodes** (stylised): busts of Gheorghe Panu, Theodor Șerbănescu, Traian Demetrescu, Maica
  Smara, Iosif Sava; statues Nimfa and Avântul Țării; Monumentul Sturdza (stele), Monumentul Eroilor Americani, Monumentul
  Eroilor Francezi n473428601; Izvorul Sissi Stefanidi n2315300547.
- **Mapped places:** waterfalls n8807086588 (artificial) and n12065694916; viewpoints n2723650896, n8809102213 (drawn by
  `osmPlaces`). Playgrounds w842284872 / 73, w843007162, w950134300, fitness station and tennis are present by id.
- **Documented exception:** on Bd. Regina Elisabeta (panorama no. 59, 44.43460, 26.09060) the lawns are closed by a green
  iron railing on a low stone base: drawn on the three mapped fence pieces round the gate recess (w1478446281 / 87 / 88)
  and along the mapped park outline w16291869 west and east of it.
- **Not compared:** the only official panoramas inside the garden date from August 2012 and none is within 90 m of Podul Mare,
  Podul de Nuc, café n13206539592, kiosk n13206526147 or Lacul Lebedelor's edge (render-checked only); the lake, kiosks,
  gates and the other sides' fences are not compared. The café and kiosk have no mapped outline; street name plates are not
  placed (positions not mapped); the lakeside restaurant (historic "Monte Carlo") name and status are unverified.
- **A local would notice if wrong:** winding lake with rowing boats (summer) and a rink (winter); weeping willows; old men
  at the concrete tables of "La Șahiști"; the round Writers' Rotunda with 12 white busts; wooden benches with backs
  everywhere.

### Table (Romanian backgammon) at "La Șahiști"

Research (web, 2026-11-11) for the seated game against Doru (`spots/backgammon-game.js`, rules in
`backgammon-engine.js`, lines in `backgammon-banter.js`). Doru and the onlooker are fictional. "La Șahiști" is OSM
n473428599 with three concrete tables n10877390595–97; board, checker and dice sizes are estimates.

**Rules as played in Romania** (confidence High / Medium / Low):

- Two dice, thirty "puluri" (fifteen each), the standard starting position. High ([ro.wikipedia: Table](https://ro.wikipedia.org/wiki/Table)).
- Opening: each throws one die, the higher starts, a tie is thrown again. Romanian press guides then have the winner throw
  both dice for the first move ([ProTV](https://stirileprotv.ro/divers/cum-se-joaca-table-regulament-si-secrete-pentru-unul-dintre-cele-mai-populare-jocuri-in-romania.html),
  [Fanatik](https://www.fanatik.ro/cum-se-joaca-table-acestea-sunt-regulile-jocului-si-asa-se-aranjeaza-piesele-21018787));
  pages translated from international rules play the two opening dice. Medium. **Game: the winner throws both dice again.**
- No doubling cube; the federation president calls it an American addition. High ([Dilema Veche, interview with Liviu Radu](https://dilemaveche.ro/sectiune/tema-saptamanii/articol/si-la-table-sintem-in-urma-interviu-cu-liviu-radu-presedintele-federatiei-romane-de-table)).
- Scoring: "linie" = plain win, 1; "marț" = 2, the loser has borne off nothing (Turkish "mars"). High
  ([dexonline: marț](https://dexonline.ro/definitie/marț)). "Marț tehnic" = 3, defined either as the international
  backgammon (loser still on the bar or in the winner's home; ProTV, Fanatik) or as a Romanian six-point variant. Medium /
  Low. **Game: the international definition.**
- Match "la trei linii" is the most cited. Medium-High. **Game: Doru keeps score to three lines; each game stands alone for
  the achievement.**
- No touch-move: a move may be tried and taken back (Liviu Radu). High. **Game: Take back.**
- Both dice must be played when possible, otherwise the higher (translated rules in Romanian guides). Medium.
- Not verified: restrictions on hitting in your own home board.

**Words:** pul / puluri (checkers; [dexonline](https://dexonline.ro/text/joc%20de%20table)), poartă (a made point; "a avea
poartă-n casă"), pul descoperit (blot), casă / bară / a scoate (home, bar, bear off), zar / a da cu zarul / dublă
([dexonline: zar](https://dexonline.ro/definitie/zar)), zar de fugă (running roll), gherlă (useless roll,
[dexonline](https://dexonline.ro/definitie/gherlă)), chibiț / tablagiu (onlooker, player): High; a lovi / a intra (hit,
enter), a închide tabla (close the board): Medium. Dice names: dictionaries attest only **dușeș** (6-6,
[dexonline](https://dexonline.ro/definitie/dușeș)), **epiec** (1-1, [dexonline](https://dexonline.ro/definitie/epiec)) and
**șeș-beș** (an old name of the game, so 6-5 is Medium); literature shows plain numbers ("patru-doi"); "dubeș" is glossed
inconsistently and not used. Doru calls rolls in Romanian with those three as flourishes.

**Attested lines** (used as they are or with a word changed): "Șase-șase, poartă-n casă."
([Ficțiunea](https://fictiunea.ro/2022/130/art8/), [JurnalMM](https://jurnalmm.ro/o-inventie-pe-zi-jocul-de-table/));
"Te-am făcut, frate!" (Ficțiunea); "Joci ca la Dîlga, da' ai zar!", "Atacă-l acum, la baionetă!", "Hai, că-ți trece
timpul.", "Dau tare, să vezi și să auzi bine ce joc.", "Ești la mutare!", "Să fii sănătos." (heard in Cișmigiu,
[Dilema Veche, "În Cișmigiu"](https://dilemaveche.ro/sectiune/tema-saptamanii/in-cismigiu-590567.html)); "Mai fierbe
zarurile alea cu busuioc.", "noroc porcesc" ([Dilema Veche](https://dilemaveche.ro/sectiune/tema-saptamanii/sahul-e-pentru-elfi-tablele-sint-pentru-gnomi-590568.html));
"a face marț", "a rămâne marț" (dexonline); "zarul contează", playing "la risc" (Liviu Radu); "Lasă-l bă, nu-l mai tachina,
că-i mic", "Am venit să joc, nu să mă uit la alții cum joacă!" ([Europa FM](https://www.europafm.ro/experiment-cum-am-invatat-sa-joc-table-in-parcul-cismigiu/));
the score notebook "Caietul tablelor din Cișmigiu", a stake of one ban, a wristwatch on the table (Dilema Veche). Not
verified, so not used as proverbs: "Zar ai, joc n-ai", "Zarul e orb". Every other line in `backgammon-banter.js` is written
for the game in the same register (polite "mata", "tinere") and is not a quotation.

**The place:** the board-game corner in the west of the garden, old stone tables, chess, rummy and table, circles of
onlookers (Europa FM; [amfostacolo.ro](https://amfostacolo.ro/impresii9.php?iid=74499&d=parcuri-bucurestene--bucuresti)).
Only men, many caps; regulars arrive around nine and wipe the tables; play is loud, risky and a show for the onlookers
([Dilema Veche](https://dilemaveche.ro/sectiune/tema-saptamanii/strategia-il-face-pe-om-590561.html)). Not verified: stakes
of a beer or a coffee; where the boards are made.
