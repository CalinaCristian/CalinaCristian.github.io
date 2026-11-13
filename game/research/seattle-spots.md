# Seattle + Bellevue tourist spots — research dossier

Scope: the Seattle and Bellevue tourist-spot scenes (`game/src/spots/scenes/`). Machine-readable spec:
[`seattle-spots.json`](seattle-spots.json) (`spots[]` with structures, plaques, iconic photo, local checks and dialogue;
`ranking`, `culture`, `dialogue_general`). Per-spot OSM extract + USGS terrain grid: [`osm/sea-spots/`](osm/sea-spots/).
Reference photos: [`refs/sea-spots/`](refs/sea-spots/) (Wikimedia Commons, free licences; attribution per file in each
folder's `LICENSES.md`). Activities: [`activities.md`](activities.md). Data © OpenStreetMap contributors (ODbL); USGS 3DEP is
public domain; Google Street View panoramas were viewed for reference only (nothing stored, traced or copied).

Conventions: scene metres are x east / z south of the scene origin (`origin` in `game/data/spots/<id>.json`); heights are
NAVD88 unless marked "relative" (to the origin's ground). Panoramas are official Google ones, cited as `id @ bearing`.
"Estimate" means no available source gives the value.

## Sources and method

- **OSM**: live API 0.6 map calls and Overpass, 2026-11-12/13, diffed against the spot extracts of 2026-11-06.
- **Terrain**: the research grid (`*.terrain.json`) is coarse (EPQS ≈ 15 s per point when it was built); over water the
  bare-earth value is ≈ 0, and the 3DEP DEM is hydro-flattened (lakes at one level, lock walls flattened into the water).
  Wherever a level changes within a few metres the scenes use fine grids of the USGS 3DEP 1 m DEM sampled through EPQS
  (`scenes/fine-dem-<scene>.js`, read through `scenes/fine-dem.js`).
- **Street View**: panoramas found through Maps' coverage lookup (`photometa/ac/v1`, z17 tiles, metadata only) and viewed
  through the thumbnail endpoint, where a positive `pitch` looks down. In the hidden browser pane a Maps tab resolves a
  panorama only after a screenshot forces a frame (navigate, one small screenshot, wait 3–5 s, read the tab URL). User
  photospheres were not used for bearings (their heading is unreliable). Panorama metadata has no altitude, so views from a
  bridge deck or lock wall put the game's eye in the wrong place. Game frames were rendered at the panorama position, eye
  2.5 m, same bearing (`game/dev/spots.html`, summer, clear day, High).
- **Colours** are estimates (judged albedo) unless a structure has `ref_check` in the JSON (Troll, Pike Place sign) or OSM
  maps `building:colour`.

## Selection of the spots

Composite of the Tripadvisor Seattle ranking (via Stacker, data 2024-05-31), Visit Seattle "Top 25" (2026), Lonely Planet
(2025), Wikivoyage Seattle / Downtown / Fremont / Bellevue and published visitor numbers; owner must-haves (Fremont Troll,
Gum Wall) forced in; scenes must be small walkable outdoor places. Rank evidence per spot is in `seattle-spots.json`
`ranking`.

- **Seattle**: Pike Place Market & Gum Wall (TA #2, VS #2, ≈ 10 M visitors/yr per the City; Wikipedia 20.9 M visits in
  2023); Chihuly Garden and Glass (TA #1); Space Needle & Seattle Center (TA #3, ≈ 1.3 M guests/yr); Fremont Troll (owner
  must-have; free public art, not in TA's top 30); Kerry Park (TA #6); MoPOP (TA #9, LP #3); Waterfront (VS #4; Great Wheel
  TA #16, Aquarium #28); Pioneer Square & Smith Tower (VS #9; Klondike Gold Rush NHP TA #12, Smith Tower #20); Ballard Locks
  (TA #8, > 1 M visitors/yr, > 2 M per the Army Corps); Gas Works Park (TA #30, VS #15). Space Needle, Chihuly and MoPOP share
  one scene (`seattle-center`, ≤ 150 m apart) with three spawns.
- **Bellevue**: Lincoln Square / Bellevue Square & skybridges (Bellevue Square > 23 M visitors/yr in 2014; UiPath's office
  since 2025, the game's final CV chapter); Downtown Park; Botanical Garden; Meydenbauer Bay Park.
- **Alternates rejected**: Museum of Flight (indoor, 15 km south), Washington State Ferries (an activity; ferries are
  backdrop), T-Mobile Park / Lumen Field (stadium interiors), Sky View Observatory (indoor; the Needle covers the view),
  Seattle Central Library (interior; first alternate for Gas Works), SAM / Olympic Sculpture Park (artworks in copyright),
  Discovery Park (too large), Woodland Park Zoo; in Bellevue: Bellevue Arts Museum (kept as a façade in Lincoln Square),
  The Bravern, Old Main Street (one block south of Downtown Park), Mercer Slough / Kelsey Creek Farm.
- Ranking sources: [ta_stacker](https://stacker.com/washington/seattle/highest-rated-things-do-seattle-according-tripadvisor),
  [vs_top25](https://visitseattle.org/things-to-do/sightseeing/top-25-attractions/),
  [lp_top](https://www.lonelyplanet.com/articles/top-things-to-do-in-seattle),
  [wv_seattle](https://en.wikivoyage.org/wiki/Seattle), [wv_downtown](https://en.wikivoyage.org/wiki/Seattle/Downtown),
  [wv_fremont](https://en.wikivoyage.org/wiki/Seattle/Fremont), [wv_bellevue](https://en.wikivoyage.org/wiki/Bellevue),
  [vb_attr](https://www.visitbellevuewa.com/things-to-do/attractions/),
  [kiro_ppm10m](https://www.kiro7.com/news/local/city-of-seattle-plans-to-extend-pike-place-market-to-waterfront/545245400),
  [needle_facts](https://www.spaceneedle.com/facts-1),
  [cascadepbs_locks](https://www.cascadepbs.org/environment/2025/02/key-maintaining-and-renovating-seattles-ballard-locks),
  [wp_ppm](https://en.wikipedia.org/wiki/Pike_Place_Market), [wp_bellsq](https://en.wikipedia.org/wiki/Bellevue_Square).
  Tripadvisor itself was not fetchable (403); Stacker's 2024 copy is used.

## Shared findings and tooling

- **Copyright**: the US has no freedom of panorama for artworks. The Fremont Troll's artists hold image rights and have
  sued commercial users (free for non-profits, per Wikipedia); Chihuly glass, Rachel (Gerber 1986), Changing Form (1971),
  Piloti (2023), Typewriter Eraser are in copyright too. Artworks are stylised from descriptions, never photo-textured.
  Owner to confirm the Troll replica for this non-commercial portfolio. No Commons photos exist of Rachel, the Glasshouse
  interior or the UiPath office; the Troll has one full view.
- **Reference photos** for Ballard Locks, Gas Works, part of Pioneer Square and the four Bellevue spots are vetted (licence +
  URL in each `LICENSES.md` and `refs_candidates[]`) but were not downloaded (upload.wikimedia.org HTTP 429 with a renewing
  Retry-After). Lincoln Square photos are shared from `refs/bellevue/`.
- **Relation outlines**: the extracts had joined multipolygon member ways without reversing them (bow-tie outlines).
  `tools/spots/repair-relation-outlines.mjs --from-extracts --clip-scenes` repaired 28 relation outlines in
  `osm/sea-spots/*.json` and the scene files from live OSM relation geometry; a relation with several outer rings keeps its
  id on the largest ring and gets `<id>_<k>` areas for the others. The extract tool is not in this repo: the repaired
  extracts are the source, so a rebuild with `build-data.mjs` keeps the repair. Clipped bodies (Lake Washington r2793848,
  Lake Union r2793813, Elliott Bay r13316235, Ballard railway r4065613) are the assembled live ring clipped to the stored
  outline's bounding box.
- **Appending live OSM**: `tools/spots/append-osm-features.mjs` appends live ways to a spot's data in the
  `build-data.mjs` schema.
- **Furniture**: picnic tables with both seats and flagpoles at the mapped nodes come from `spots/furniture-extra.js` (the
  hash-locked `osm.js` draws one seat and no poles); `tourism=information` boards stay undrawn by design (note 36).
  Playground equipment where OSM maps only the area: `spots/playground-kit.js` (generic climbing tower and swings).
- **Backdrop** (`spots/source-landmark.js`): Mount Rainier and the Olympics recolour a copy of the shared USGS mesh with
  snow from 1950 m (blend 1650–1950 m) over haze-tinted rock and a 45 % haze mix — judged, not measured (artistic
  distant-view treatment; heights untouched). Midrise blocks take the same haze as the far ground under them.

## Crowds, dialogue and tone

- "Seattle Freeze": locals are "very polite but not particularly friendly" to strangers; Washington ranked 48th of 50
  states for extraversion (2008 study) — local lines courteous, brief, low-key
  ([source](https://en.wikipedia.org/wiki/Seattle_Freeze)).
- Honking is rare and seen as rude (≈ 3 in 4 Northwest drivers rarely or never honk, PEMCO 2017; 65 % found it at least
  somewhat appropriate by 2021): NPCs react surprised / disapproving, not aggressive
  ([source](https://pemco.com/blog/horn-honking-nw-drivers)).
- Coffee is a safe icebreaker (Seattle drinks more coffee than any other US city,
  [source](https://en.wikipedia.org/wiki/Coffee_in_Seattle)); rain talk is universal, locals favour hoods over umbrellas
  (folklore, keep light).
- Visitors: Canada was 73 % of Seattle's 2.4 M international visitors in 2024, then China, India, UK, South Korea, Germany,
  Japan, Australia, France, Taiwan ([source](https://visitseattle.org/press/press-releases/visit-seattle-2025-annual-meeting/)).
  Non-English lines carry `orig` + `lang` (fr-CA, zh-Hans, hi, ko, ja, de, es) with the English `text` as subtitle.
- Indigenous art (totems, Salish Welcome): staff and guides speak respectfully; no jokes about sacred objects. No
  stereotypes, phonetic accents, slurs, politics or alcohol jokes about any group.
- `dialogue_general.lines` (49) also serve the Seattle and Bellevue driving districts. Personas: `local`, `tech`,
  `tourist_us`, `tourist_ca`, `tourist_cn`, `tourist_in`, `tourist_kr`, `tourist_jp`, `tourist_de`, `tourist_es`,
  `fishmonger`, `vendor`, `busker`, `guide`, `staff`, `kid`, `photographer`.

## Pike Place Market & the Gum Wall (`pike-place`)

**Modelled**: Pike St from 1st Ave down to the Main Arcade corner, Pike Place north to Victor Steinbrueck Park, Post Alley
down to the Gum Wall, MarketFront, Western Ave below the bluff. Spawn 47.60897, −122.33987 heading 229° (Pike St at 1st Ave,
looking at the sign). Pike Place is car-free in the scene by design: a car-free trial began April 2025 and was extended into
2026 (Wikipedia); panoramas of 2020–2024 show parked cars.
- Levels: Pike Place ≈ 30 m at Pike St (EPQS 30.1 m at 47.6085, −122.3405); the bluff drops ≈ 20 m to Western Ave; Post
  Alley at the Gum Wall is about one storey below Pike St. The east bank of Western Ave follows a USGS profile
  (`pike-place-streets.js`), flat to 13 m from the centre line.
- Main + North Arcade (OSM w231357660, w1271653801, w1271653800; ≈ 290 m along Pike Place; 2–3 storeys street side,
  4–6 below towards Western Ave). The North Arcade's street front is an open day-stall shed (dark-green fascia, one
  grey-green roof plane rising from the eave; panoramas grsVDUMkuBMlk2jyCNtErA, gUpSU7FwJVKGzsOM5hEfWg,
  qe8_CeOlBF2k55UTq3zkAg), not the windowed hall of the Main Arcade. The market halls' and Main Arcade's west walls are
  white-painted with rows of wide red-framed multi-pane steel windows (iFZRr4o9WP2yFdlbuLUkeQ @ 60).
- PUBLIC MARKET CENTER sign and clock (n4217400413): three rows in red neon on an open black X-braced steel frame on the
  roof of the one-storey corner, clock right of MARKET / CENTER (Willatsen, 1937 roof); MEET THE PRODUCER on the roof edge
  of the taller cream building behind; FARMERS MARKET band at street level; PIKE PLACE FISH at the corner. Matched in
  panoramas.
- Rachel (n3559896932; 36 × 66 × 16 in, 250 kg), Gum Wall (n2443738130, n2397493563; 2024: 54 ft × 8 ft, densest 0.5–2.4 m),
  original Starbucks (n2397461017, 1912 Pike Pl, east side, narrow front with pale band sign), Corner Market and Sanitary
  Market (w206858876, w206858888, r5402577; 11.1 m; Corner Market buff with brick-red panels, round-arched top windows,
  green canopy), MarketFront (w184870424) and its viewpoints, Victor Steinbrueck Park (w14026690) with its two poles at
  their nodes (n3211770167 Farmer's Pole 50 ft, n3211770169 untitled, height not mapped). Also matched: Beecher's, Mr. D's,
  Sur La Table and Cafe Campagne on Post Alley, the POST ALLEY banner, brick paving.
- Steinbrueck Park is level at −5.7 relative: the DEM gives 30.7–31.5 m at 24 points over the whole park.
- 1st Ave lamps are low three-globe posts (globe on top + two on a cross arm; tT8x8F7kggeRi_KoY1vLng); the tall cobra heads
  stay on Pike Place. No street tree on the Corner Market's 1st Ave frontage (no OSM tree, open in the panoramas).
- SkyBridge over Western Ave (w296789534, `building=roof`, layer 1): an enclosed walkway between two green steel Warren
  trusses with pale green panels, flat roof, white concrete pier at the market-side kerb (iFZRr4o9WP2yFdlbuLUkeQ @ 315).
- Pike Place Market Parking garage w184870422: its Western Ave wall is a garage front, not shops.
- Western Ave (`pike-place-westface.js`): a colonnade at street level along the market's west walls facing the avenue
  (Main Arcade / Leland Hotel volumes w1271653801, w1271653800, w231357660: square white piers, beam and soffit) and
  PIKE PLACE MARKET in red letters on the white wall above it. West side: the low pink-stucco building with a parking
  sign = Market Heritage Center (w231359028, 1 storey, PARKING board on its avenue face); the cream three-storey block =
  Fix Building (w231359020). "Market Place North" (tan, ribbon windows) is not an OSM name: the mapped Market Place
  complex north of the market (landuse w403552339) has Market Place One (w231355701, 2003 Western Ave, 8 levels) and Two
  (w231355696, 2001 Western Ave, 5 levels); both take the tan band-window front.
- Victor Steinbrueck Park lamps: the three mapped `street_lamp` nodes (n11660363671, n11660363674, n11660363677) and
  the generated park lamps are drawn by the shared lamp builder.

**Estimates**: sign letter row ≈ 14–16 m, clock Ø ≈ 2.5–3 m; North Arcade eave 3.3 m, roof run 7 m; SkyBridge underside
≈ 6.5 m over the road. Western Ave: which mapped volumes the pink and cream west-side blocks and "Market Place North"
are (assignments above), their colours (#d8a598 pink, #e6dcc4 cream, #c8b08a tan) and storeys (Heritage Center 4.6 m,
Fix Building 3 × 3.7 m); colonnade piers 0.7 m square, 1.6 m off the wall, ≈ 4.5 m apart, beam at 4.4 m; the lettering's
face (the longest avenue-facing wall), height (7.2 m over the road), 18 m width and red. The Gum Wall's current height after cleanings is unknown (2024 figure used).

**Open (needs a panorama look)**: the Main Arcade street front has a green dado, small-pane windows and ENTRANCE signs —
the pigs on the roof edge of the Economy / Main Arcade were not seen on any panorama checked and are not modelled; the
barrel-vaulted canopy left of the sign is neither confirmed nor excluded (small and partly hidden by the sign frame from
1st Ave and the Corner Market).

**Source gaps**: Steinbrueck Park benches — none mapped in the park (the two mapped benches nearby, n8508584428 and
n8508584429, are on 1st Ave / Pike Place) and no recorded positions, so none are drawn.

## Seattle Center: Space Needle, Chihuly Garden and Glass, MoPOP (`space-needle`, `chihuly`, `mopop`)

One scene (`seattle-center`, polygon union ≈ 290 × 330 m), three spawns: Space Needle 47.61995, −122.34935 heading 0°
(south base plaza by the Howard S. Wright fountain); Chihuly 47.6204, −122.3504 heading 80° (garden path west of the
Glasshouse); MoPOP 47.6216, −122.3474 heading 250° (5th Ave N under the monorail). Ground ≈ 40 m (OSM `ele=40` at the
Needle).

**Modelled**:
- Space Needle (w12903132 + parts w394254330, w394254334, w394254484, w394254488): 184.4 m total, deck 158.5 m, top 42.1 m
  wide; OSM parts: core / legs to 152.4 m, saucer glass bands 152.4–156.1 and 158.1–161.2 m, roof 166.9–170.3 m, spire cap
  to 181.1 m, SkyLine ring 30.5–36.6 m, mid ring 61.0–64.0 m. Six legs in three pairs, white / light roof today (Galaxy Gold
  only in 1962, 2012, 2022–23), exterior glass elevators. Base pavilion: curved glass with a white soffit band, stone ball
  bollards (matched).
- Chihuly Glasshouse (w329416207; 12.2 m, 418 m², 30.5 m red / orange / yellow suspended sculpture), Exhibition Hall
  (w329416198); the garden glass sits in dense planting, fenced and ticketed.
- MoPOP (w161587742, `building:material=steel`; Sky Church w1092469435, 22 m; 21,000 shingles on 3,000 panels): the seven
  OSM lobes are drawn in their tagged colours (maroon, silver, #6495ED, red, gold); the outline and Sky Church have no
  colour tag. The monorail passes through the building. Lobe camera targets sit at two thirds of each part's mapped
  height; its guided tour stops at "Frame MoPOP's metal lobes". Grass Blades (w1362384591; 44 m × 9.1 m, 110 blades),
  Typewriter Eraser (n8533332630), Chris Cornell statue (n6140930665).
- Monorail (w161609433): twin beams on T-columns, the beam into MoPOP (matched). Seattle Center station: a curved
  translucent canopy on arched ribs over the platforms (w333355314/5/7) and concourse (w637649471), dark columns, black
  fascia with "ALWEG MONORAIL" in red (1_C7cgJZv-E44e8HIqd5tg @ 330).
- International Fountain (w35352476, `height=37`): not in the spot extract nor the source context; its 34-node ring is
  stored in `scenes/seattle-center-fountain.js`, and the native ground extends west from x = −208 to −288 to hold it. Dome
  = OSM w394955907 (`roof:shape=dome`, height 3, 9.5 m across; Wikipedia's 27 ft = 8.2 m loses — the panorama shows it
  lower). DEM: bowl floor 32.90–32.99 m within ≈ 17 m of the centre, rising to 35.1 (north) … 37.0 (south) m at the ring.
  Wikipedia: 4 super shooters to 120 ft (= the OSM height), 56 micro shooters in the granite floor, floodlights between
  them and the dome. Efow4N6Ma8F4LGpK2x3jWQ: low kerb with a red-brown face, light grey bowl, low silver dome, and asphalt
  (not lawn) all round between the rim and the Fountain Lawn (w394955954).
- Olympic Iliad (n3211770187, Alexander Liberman 1984, `scenes/seattle-center-heroes.js`): 41 red rolled-steel cylinders
  48–64 in Ø, H 45 ft × W 60 ft × D 30 ft (city art record quoted in the node); LUaNF3kzF_XhFiy0kx43bA @ 278 and
  RB_2Feewsyx_qfiPQNLcaA @ 17 show an open arcade — upright tubes as legs in two rows, one leaning out at the north end, a
  tangle of tilted tubes on top, long axis north–south.
- Climate Pledge Arena (w25123756): its OSM parts drawn as mapped — roof w411521517 (white, pyramidal, 8 m to 33 m),
  skillion buttresses w1352666990 / w1352647807 / w1352647810 / w1352647812, Alaska Airlines Atrium w1270549342 — and the
  parent outline as a glass curtain wall up to 8 m under a thin white fascia (xLh7PyEOCxKVuesNWAzPBw @ 270,
  jLP72IlkxVljWg52cvsHAA @ 10 / 60: green-tinted glass, white mullions, a white sloped A-frame mid east side).
- MoPOP skin (`scenes/seattle-center-mopop.js`): the seven lobes keep their OSM footprints, heights and colours but are
  continuous curved metal masses — corners rounded, walls bulging out above the ground and rolling into a rounded crown at
  the mapped height, each leaning away from the building's middle — in an iridescent shingled metal (purple sheen on the
  silver lobes).
- Climate Pledge Arena: the west and north A-frames stand on the parent outline's mapped 4.6 m spurs (feet at x −427.4,
  z −254.5), with the mapped east part's section (white wedge, ground → 11 m, 10.1 m inside the wall); the south side has
  no spur (the atria). CLIMATE PLEDGE ARENA lettering on the white fascia of the longest east (1st Ave N) glass wall.
- Planting (`scenes/seattle-center-trees.js`): 56 live-OSM trees missing from the extract (rows along the Armory's west
  side and Thomas St, the double row west of the Chihuly garden; API map call 2026-11-13); the mapped natural=wood
  polygons round the Armory and east of the Needle (w394259997) filled at one tree per 30 m²; shrubs and small trees in
  the mapped bed w394259987 by the pavilion.
- Howard S. Wright fountain (w241876412), Armory (w231764919), Pacific Science Center (w394955903) at their mapped places.
  All 35 live businesses and 25 tourism / artwork objects inside the terrain box were in the extract (2026-11-12).

**Estimates**: MoPOP's bulge (≤ 6 %), crown profile, 1.6 m lean, shingle size, metal sheen / iridescence and the 18 %
toning of the tagged colours toward polished metal; the A-frames' inner end (copied from the east part); the lettering's
face (the review that noted it did not record which face), its dark green colour and 26 m width; wood fill density
(1 / 30 m², ≥ 3.5 m apart), the bed's shrub density and tree sizes. International Fountain micro-shooter and floodlight ring radii, the show rhythm (90 s show, 60 s still),
the 6 m asphalt apron; the Iliad's split into legs and top, tube lengths and angles; the station canopy's rise and rib
spacing; MoPOP height at the highest lobes ≈ 26–30 m; monorail beam ≈ 6–8 m overhead. Pacific Science Center has no
height tag (generic volume) and its arches have no OSM object.

**Not modelled**: the Acrobat Constellation (n3211770205: three figures 21–25 ft on poles, mapped as one node, pole
positions unknown); Chihuly's EXHIBITION ENTRANCE / bookstore signs and planted wall.

**Source gaps**: the Pacific Science Center arches (no OSM object, no panorama found shows them); the Needle pavilion's
deeper soffit band (no measurement recorded).

## Fremont Troll (`fremont-troll`)

**Modelled**: Troll Ave N under the north end of the Aurora Bridge, the Troll, Troll's Knoll (w295288784) and P-Patch
(w554528163), Moss Turtle (n11849109533). Spawn 47.6506, −122.34722 heading 2° (≈ 50 m south, looking up into the shadow).
- The Troll (n2485251324; 1990, Badanes, Martin, Walter, Whitehead): 5.5 m, 5,900 kg; head, shoulders and two hands
  emerge, viewer-left hand splayed, viewer-right hand on a grey-painted VW Beetle (≈ 4.07 × 1.54 × 1.50 m); one hubcap
  eye.
- Bridge end: OSM `man_made=bridge` w370645739 and bridge way w378090317 end at 47.65120 N (z = −66.5); north of it
  Aurora Ave N is at grade. DEM (`fine-dem-fremont-troll.js`): roadway there 43.4–43.6 m, N 36th St under the bridge
  35.5 m, the ground at the Troll 35.8–36.0 m, a bank climbing 7 m in 20 m behind the Troll to the abutment — the deck
  soffit is ≈ 7 m above N 36th St with the Troll just under it.
- Structure: a concrete girder bridge on rectangular columns with capitals; haunched girders make each span read as a very
  shallow arch, not a tall arcade (s2nejgAfrxEcFPqUbBfauA; Waz2-sx9krbbJvb3y-2BUw). Aurora north has a balustrade parapet.
- Stairs from N 36th St to the Aurora sidewalks on both sides: w50612754 (east), w50612756 (west).

**Estimates**: Troll footprint ≈ 7 × 9 m; the three column lines under the deck (two are visible flanking the Troll).
Panoramas under the bridge along N 36th St (Z4ECcm_Bohycl_4lNh_0Yw, 1Ei0hgAU9k4ebaKIP7yMvw, Yz1JPc9S36oaFTKzQyz7Mg,
s2nejgAfrxEcFPqUbBfauA) disagree with the Troll's bearing by ≈ 30°: whether the arch over the Troll spans to a column on
its east side, or the x = −8.75 bent line stands west of it, needs an aerial or survey of the bent positions; the game
keeps its bent lines. From the deck panoramas the column lines are not visible.

**Open (needs a panorama look)**: the Troll itself (the nearest official panorama is on the deck), the fences behind it,
the knoll's planting (Street View shows the east bank wooded; the scene has lawn with scattered trees), the Troll Eye
Apartments sign.

## Kerry Park (`kerry-park`)

**Modelled**: the terrace on W Highland Dr between 2nd and 3rd Ave W, stairs (w50329131) down to Bayview-Kinnear Park.
Spawn 47.6295, −122.3601 heading 141° (railing beside Changing Form). Park ≈ 104 m (EPQS 103.8 m).
- Changing Form (n693337510, Doris Totten Chase 1971; city art inventory GCK74.048: "a square frame with a circle cut out
  of the middle stacked on a triangular frame with circles cut out of each side", Cor-ten, 16'6" × 6'3" × 4'5"): two
  stacked frames of equal width, a full round opening in each, dark brown-black, on a round three-step plinth in a brick
  plaza, upper opening facing the street / bay (pmkM273v38BcX2jtOhHfww; y4VIyX3fc6pkQsYrTG-A1w, D19wLVvtz886pOofJWALBA).
- Edge: railing w240890465 (west, 1.2 m), wall w240890467 (middle, 1 m, small bay), railing w240890466 (east, 1.2 m); coin
  binoculars n2485862631; guidepost "Kerry Park Sign" n2485862643 at the west end; the 8 mapped benches.
- Levels (DEM 2026-11-13), relative: terrace (z = 5) +1.18 (x −28), +1.28 (−15), +1.00 (0), +0.58 (25), +0.43 (40), +0.29
  (55); W Highland Dr (z = −8) +1.10, +0.78, +0.45, +0.18. Terrace, street, railing, wall, plinth and binoculars follow
  these. Bayview-Kinnear's play terrace is flat at −17.5.
- No street trees on the park's kerb (none in OSM or the panoramas).
- Postcard: Needle at bearing 141°, Rainier at 152.4° and ≈ 2.1° above the horizon; the backdrop matches both.

**Open**: hanging planters and plaza benches seen in earlier reviews have no OSM nodes or recorded positions; the "street
lamp in front of the sculpture" was not found within 9 m of Changing Form. Parked cars along W Highland Dr and the north
side's hedges are not modelled.

## Waterfront (`waterfront`)

**Modelled**: the rebuilt Alaskan Way promenade (viaduct removed 2019) from Pier 54 to Pier 60, Pier 57 / Miners Landing,
the Great Wheel, the Aquarium and Ocean Pavilion, the Overlook Walk. Spawn 47.6069, −122.3416 heading 215°; that point lies
in OSM water (w1417461574), so the postcard stand is the promenade paving 8 m north-east (scene 3.5, −7.5), Wheel on the
same bearing.
- Shoreline: the `natural=coastline` ways of relation 13316235 (unchanged in live OSM) run Pier 62 → Pier 54 round every
  pier; water w1417461574 is the cove between the rebuilt Pier 58 (w1155067802, `start_date=2025-07-25`) and the seawall,
  w776848804 the basin between Piers 59 and 60. The land / water edge comes from these (`waterfront-shore.js`).
- Piers: the extract stored each pier relation as one concatenated ring (Pier 57 self-crossing, Piers 59 / 60 half their
  area, Pier 56 reversed); the scene uses the live relations joined into closed rings (`waterfront-pier-rings.js`). The
  Great Wheel base (−67.7, 81.2) and ticket booth (w429553385) stand on walkable deck.
- Sheds as seen along Alaskan Way (Sep 2025 panoramas at 47.60520, −122.33931 and four points north to 47.60832,
  −122.34237; header of `waterfront-piers.js`): Pier 54 pale grey-green two-storey (Ivar's, Ye Olde Curiosity Shop); Pier 55
  red-brown under a dark hipped roof (Starbucks); Pier 56 dark green gabled with white trim, shopfront on its slanted
  street end; Pier 57 red with MINERS LANDING in gold letters, yellow awnings; Pier 59 grey-green with SEATTLE AQUARIUM on
  the street front; Pier 60 (w1154870289) a low open-sided shed under a shallow gable (VuVTZJti0rfyEFN0lJAiMQ @ 240). The panorama Google returns at 47.60625, −122.34070 is from the construction
  years: not used.
- Pier 57 is several sheds joined: each mapped `building:part` is its own gabled volume at its OSM height, ridges along
  the pier — the 3-level main shed (w429553383, 10.9 m) with the 4-level raised middle shed (w396606860, 14.2 m,
  clerestory windows) down its spine, the 2-level street-end shed on the slanted Alaskan Way front (w429553384, 7.6 m,
  ridge along that front; MINERS LANDING on it, PIER 57 on the main gable above), the 2-level west shed (w429553382) and
  the 1-level west tip (w396606855); a party wall is drawn by the taller part only. Pier 60: the shallow gable clipped
  to its irregular 59-vertex plan (`spots/gable-plan.js`), on posts, the deck walkable under it.
- Great Wheel (n1809238334): 53.3 m, 42 gondolas, 12.2 m over the water.
- Ocean Pavilion (w1256939021, Aug 2024): charcoal ribbed cladding over a board-formed concrete base ≈ 2.2 m high
  (d_zvaPdDFeRnyCx2epCvqA @ 250, nVwg3181AIHZBcGR4Gy80w @ 270), outside stair tower.
- Overlook Walk (w1256939020, 2024): a thick pale concrete deck on round columns, walkable, solid at its level over Alaskan
  Way (w1256939017, layer −1), railings as walls. Levels (DEM): 4.99 m at the Ocean Pavilion (47.608159, −122.342797),
  7.5–7.9 m on Alaskan Way under the walk, 15.1–17.1 m on the slope, 23.83 m at MarketFront (47.609508, −122.342930); deck
  15.5 m over the road (pavilion ground 5 m + OSM height 10.9 m) rising to 24 m. Salish Steps (w1320933922 + w1320933923)
  are a 6.5 m flight from the deck's west edge to the promenade (cLi3KbZ4ALUiPoUywFMtKw @ 70); the east stair core
  (w1289027232–4, w1256939012, levels 1–4) is a "take the stairs" use (its flights are too small for the game's body).
- Promenade: planted beds (OSM `natural=scrub`, `landuse=flowerbed`, `man_made=bioswale`) carry low shrubs; a two-way cycle
  track between road and promenade; lamps are tall dark square-section posts with a slim arm and flat head, every 22 m
  (not the shared cobra). Pier 58 playground (w1417461575, equipment not mapped) uses the generic kit.
- **Businesses**: live OSM 2026-11-12 adds Mark's Ark, Pirates Plunder, Sports Den, The Sourdough Bakery (Pier 57); The
  Seattle Shop at Pier 56, WingDome (Pier 56); Starbucks, Seattle Shirt Company, Burgundy Viscosi Gallery (Pier 55); Ivar's
  Acres of Clams, Ye Olde Curiosity Shop, Simply Seattle, Ivar's Fish Bar, Great State Burger, Premier Meat Pies,
  Harley-Davidson Motorcycles (Pier 54); Copperworks Tasting Room & Distillery. Mapped closed (`disused:*`), not signed:
  Frankly Sweets, Salt District (Pier 55). The 95 Pike Place Market businesses on the bluff are signed in `pike-place`, not
  here.
- **Documented exception (OSM incomplete)**: "Elliott's Oyster House" has no OSM object; its sign is on the Pier 56 street
  gable in the Sep 2025 panorama, and the game shows the name there only.

**Estimates**: shed eave / ridge heights (OSM gives 10.9 m for Piers 54 / 55 and 4.3–14.2 m for Pier 57's parts), window
rhythm, colours; Pier 57's eaves (ridge − 2.4 m main, − 1.6 m middle, − 1.4 m 2-level parts, − 0.7 m west tip), 0.45 m
roof overhang and the clerestory row; Pier 60 (no height or roof tags): eave 5.2 m, ridge 7 m, ridge along the plan's
long axis, posts every ≈ 6 m, 0.6 m overhang, dark grey roof over a pale soffit; Salish Steps width; promenade lamp post 9 m, arm 2 m, head size; the
Overlook Walk's bridge steps w1320933924/5 are folded into the deck's one level (their fall is not known). Source gaps kept:
the water triangle (−39.5, 58.4)–(−35.6, 65.7)–(−33.6, 65.8) lies outside Pier 57 (r812609) and Pier 58 in OSM and is water
in the coastline; Pier 55's three inner rings are recorded in `waterfront-pier-rings.js` and not opened (the coastline
treats them as land).

**Source gaps**: the Ocean Pavilion's oculus and planted roof (no view of the roof, no OSM roof object; the roof is the
green-grey tint only); planters and bins on Alaskan Way (not mapped; open paving in the game). No official panorama lies
within 45 m of Piers 55–57.

## Pioneer Square & Smith Tower (`pioneer-square`)

**Modelled**: Pioneer Place (1st Ave × Yesler Way), Yesler Way east to Smith Tower, Occidental Ave S and Occidental Square,
the west end down to Elliott Bay. Spawn 47.60166, −122.3342 heading 20° (1st Ave S south of the pergola). Yesler Way rises
≈ 8 m east to 2nd Ave.
- Pergola (w52782041): triangular cast iron and glass, 1909, architect Julian F. Everett, a cable-car shelter over an
  underground comfort station; ≈ 60 ft × 16 ft on iron columns; restored 1972–73 (James E. Casey / UPS donation);
  destroyed by a semi-truck on 15 January 2001 and rebuilt by Seidelhuber Iron and Bronze Works (99 % original material),
  reopened 17 August 2002; bollards round it (Wikipedia "Pioneer Square pergola").
- Chief Seattle bust (n3211770115): bronze by James A. Wehn, 1909, on a former drinking fountain for people, dogs and
  horses made for the Alaska-Yukon-Pacific Exposition (Wikipedia "Bust of Chief Seattle").
- Pioneer Place trees: OSM maps nine maples there (a 2019 photosphere shows a full canopy hiding the Pioneer Building).
- Pioneer Building (w52782046; 1892, Elmer H. Fisher, Richardsonian Romanesque; stone, red brick, terracotta, cast iron;
  on the site of Henry Yesler's house; 28 m, 6 storeys): red brick wings and a central full-height tower bay of rough-faced
  grey-brown sandstone round the arched entrance on Pioneer Place, two stacked oriel bays of dark blue-grey metal and glass
  over the middle floors (kJVn9dVw2rWKgTf-rsYWzw @ 75–100). The entrance is on the longest street face (the longest
  west-facing edge is a party wall).
- Fronts: the 25 mapped fronts on Pioneer Place, 1st Ave S, Yesler Way, Occidental Ave S and S Main St each have their own
  facade (table `FRONTS` in `scenes/pioneer-square-fronts.js`: material, wall / base colour, OSM `building:levels`,
  cornice, arch pattern, storefront colour); volumes, roofs and colliders stay the native source plan. OSM
  `building:colour` wins where mapped (1st Ave S row J&M Hotel, Skagit, Marathon, Lucky Hotel, w439990255: #85552e).
  Panorama evidence:
  - Mutual Life Building (w140345971), kJVn9… @ 250: tan brick upper floors over a red-brown two-storey base, round-arched
    ground floor, pale paired windows.
  - Yesler Building (w439990280): grey stone, arched first floor.
  - Gatzert & Schwabacher (w226937778), uVzwONsTTGBy9AqfGImghA @ 290: pale painted wall, dark storefront base, no cornice.
  - Terry Denny Lofts (w226321137), uVzw… @ 250 / StRtj6G68vgv607YPmToqw @ 310: red brick, arched top floor.
  - Maynard Building (w226937777), StRtj… @ 250 / 270: grey stone, arched ground and top floors.
  - 1st Ave S west row (J&M, Skagit, Marathon, Lucky, w439990255, New England Hotel), iEVQhhDOR8aTqLQD5K522g @ 255,
    g3aSGggFrVoEYwpMr3OBLA @ 270: red-brown brick, dark storefront bases, white-framed windows, brick cornices.
  - Olympic Block (w226321142), uVzw… @ 70 / 97bndGEyQS57itfhcMvcfA @ 200: beige modern cladding, ribbon-like windows.
  - Lippy Building (w140631721), uVzw… @ 110: dark brick, green storefronts.
  - City Club Building (w226321147) and The Delmar (w367359273), StRtj… @ 60 / 75: red brick; the Delmar with two-storey
    round arches over each bay.
  - Buttnick Building (w140631796), iEVQ… @ 60 / 100: dark grey painted front.
  - Grand Central (w140631769), g3aS… @ 70 / 90: red brick over a buff stone ground floor of tall round arches, arched top
    floor.
  - Globe Building (w226323009), OqApslrrErDPH77wLl-ESg @ 110 / 998tDSzok9LVXyH1FIpejQ @ 135: red brick over a grey
    two-storey base, teal storefronts.
  - Union Trust Building / Annex (w389138212 / w389138218), KLmc32jpRbH8dU_WjBku6A @ 215: buff stone over a grey rusticated
    base, dark green storefronts, arched top floor, cornice.
  - Interurban Building (w226321146), Eoj9slwTpsFLNZYztebPNg @ 60: lighter red brick, two-storey round arches, arched top
    floor.
  - Korn Building (w439990299) and Merchant's Cafe (w52782171, 1890), 97bnd… @ 185: red brick, dark green storefronts.
  - w439990295 (one storey at Yesler / Occidental), Eoj9… @ 250: dark modern front.
  - 200 Occidental (w27183365), b5T7tpwVchrYOjElqXCH9Q @ 140: dark brown modern cladding over a glazed ground floor.
- Smith Tower (w52781661; 1914, Gaggin & Gaggin; roof 140.8 m, pinnacle 147.5 m, 38 storeys; OSM height 75 m is the
  22-storey base block): white terracotta, pyramid top.
- Vault lights: iron panels of round prisms in the sidewalks (purple glass).
- Occidental Square (w174692555): Duane Pasco's four carvings at their nodes (n3211770100–103: Sun and Raven 35 ft, Killer
  Whale 12 ft, Tsonqua 13 ft, Bear 13 ft); Fallen Fire Fighters' Memorial (n2998927033, Hai Ying Wu); table tennis
  n14005376908 and chess n14005378203 at their points; playground w1155308011 (climbing tower and swings, generic);
  w1155305355 (`building=yes`, no other tags) is an open canopy of glass panels on pale timber beams over black steel posts
  with a small timber-clad glass kiosk (wtV8CTwZJSh3TDNhSKHKLA @ 265–290). No tree nodes are mapped in the square.
- **Documented exception**: Sinking Ship Garage (w52781697, `amenity=parking`, OSM 3 levels / 10.9 m) is an open concrete
  deck whose top is level with 2nd Ave Extension (NMuWBnWs062EFE23JyuBAg at its north-east corner shows parked cars and
  the PARK sign about level with the street). The deck stands at 12.68 m (mean DEM at the two 2nd Ave Extension corners;
  12.50 m at the north-east one) with the levels below running down the slope (`pioneer-square.js`); OSM's height is
  probably taken from Yesler Way.
- West end (Western Ave → Elliott Bay), live Overpass 2026-11-13 (bbox 47.6005, −122.3395, 47.6040, −122.3352): 117 roads
  (Alaskan Way S as two roadways w223785010 + w835645674, w1321962096 + w1321962090; Colman Dock holding lanes 1–45;
  Columbia / Marion / Madison St), 131 foot and cycle ways, 45 crossings, 17 traffic signals, 137 trees (nodes + tree rows
  sampled every 7 m), 17 planted beds, 17 pier / pedestrian areas — stored in `scenes/pioneer-square-westend-data.js`
  (generated, ground level only). Coastline w1464900126 (seawall, Colman Dock and Pier 48 as land); Washington State
  Ferries terminal (w1154870285, 2 levels, 2023): a glazed ground floor under a timber-slatted storey and a dark flat roof
  (96BnTtZETD_9PxJd3_oy9w @ 250 / 300); Water Taxi terminal (w226321140, 1 level). Panoramas fYcy5IxBB8nxBtlHlp0w6w,
  icoHFzEOnBuL9Tmg_QeZUw: concrete roadways, white zebras, grey mast-arm signals, young street trees, grass beds. The fine
  (2 m) terrain reaches x = −336; west of it 8 m steps.
- Fronts behind the walk area (`scenes/pioneer-square-backfronts.js`, `FRONTS_OSM`; no panorama recorded): the mapped
  fronts on 2nd Ave, Yesler Way east of Occidental and S Washington St east in the same facade system, from OSM tags
  (live API 2026-11-13): storeys, `building:colour` #85552e and `building:architecture=neo-romanesque` on the S Washington
  St pair (w226321135, w439990240, 1890), start dates 1890–1928 (Collins Building w226321732 1894, Florence Building
  w910445794 1900, Monterey Lofts w226323029 1909, Chin Gee Hee Building w226323030 1890, Apex Building w439990263 1928,
  Frye Apartments w226323020 1908, w226321144 1893, McCoy's Firehouse BBQ w226321143, w439990242, w439990247).
- Smith Tower's storefront base: a two-storey granite facing with storefront and mezzanine glazing on every street face
  of the mapped footprint, a pale terracotta cornice band over it, the entrance canopy with SMITH TOWER on the face
  nearest 2nd Ave (its address street). Merchant's Cafe and Saloon (w52782171, 109 Yesler Way): its own name board,
  MERCHANT'S CAFE & SALOON in gold on the storefront's dark green over the Yesler Way front (the generic shop sign is
  dropped for it).
- Colman Dock (`scenes/pioneer-square-colman.js`, live OSM 2026-11-13): the Water Taxi / Fast Ferries Terminal on its
  outline (w226321140, 1 level) as the "low grey shed" with a glazed waiting room, a flat roof overhanging as a canopy
  and its name; the 2-level block at the end of its pier (w736858270) with the two flights up to it (w736858271,
  w736858273); the WSF slip-approach canopy (w1251064470, metal shelter roof, layer 3) on posts; the WSF stairs
  (w1194539050, w1436091947); the four ferry slips (`mooring=ferry`: w389138743, w448857944, w448857945, w1241786940) as
  steel aprons on piles with a pair of white transfer-span towers where each outline widens; the Waterfront Trail's
  mapped benches (n14145559226 … 39) and lamps (n14005374592, n14005381663, n14005403057, n14005408300, n14145559225).
  The fine terrain now reaches x = −440 (the slips and Pier 48's west end are off the 8 m outer steps).
- Businesses: live OSM 2026-11-12 adds Sam Day Studio & Gallery, Cookie's Country Chicken, Good Bar; mapped closed and not
  signed: Woven Art (n2351695509), Luigi's (n2351695585), The Underground Gallery (n2351695606), Revolution Books
  (n2351695730), Flame Catering Cafe (n2351700811), Tobacco Patch (n2354406522), Comedy Underground (n4626879391).

**Estimates**: bay widths, opening sizes, floor heights, colours and window frames of the 25 fronts; Pioneer Building tower
width, depths, oriel sizes; vault-light strip extent (1.2 m panels of 4 × 4 prisms); Occidental Square's trees (generated);
playground pieces. Behind the walk area: every wall colour without `building:colour`, arch patterns, bases, cornices and
storefront colours of the 12 OSM-only fronts. Smith Tower base: 7.6 m granite band, ≈ 4.2 m bays, glazing sizes, the
canopy (5.2 × 1.6 m at 4.1 m) and its bronze; Merchant's Cafe board 7.5 × 0.85 m at 4.15 m and its lettering. Colman Dock:
shed 4.6 m with 1.2 m roof overhang, glazed band, the 2-level block 7.2 m, flight rises (2.4 m, 4.2 m), canopy at 10.5 m
on posts every ≈ 8 m, apron thickness, piles, towers 9 m; colours. Pier 48: no `surface` tag — plain concrete paint.

**Open (needs a panorama look)**: Smith Tower's crown colours.

### The totem pole (n3211770116)

Main source: Wikipedia "Pioneer Square totem pole" (Good Article, fetched 2026-11-07), resting on Viola E. Garfield, *The
Seattle Totem Pole* (University of Washington Press, pp. 9–30), HistoryLink (Wilma 2000), the NPS National Historic
Landmark file (Pitts 1977) and the Seattle Department of Neighborhoods. NRHP location 47°36′7.5″N 122°20′2.6″W.

- **Today's pole is the 1940 replica.** An arsonist damaged the 1899 pole in 1938; it came down on 12 April 1939, beyond
  repair. The U.S. Forest Service had a replica carved at Saxman, Alaska, by Tlingit carvers employed through the Civilian
  Conservation Corps, directed by Charles Brown and including members of the Kinninook family, the original owners
  (Jonaitis 2017 p. 6; Garfield 1996 p. 13). About three months of carving; an act of Congress transferred it (federal
  cedar and pay); raised on 24 July 1940. ≈ 50 ft (15.2 m) × 4.5 ft, from a 70 ft western red cedar from Kina Cove near
  Kasaan (the original was 49 ft 8 in, hemlock). Restored and repainted in 1972 by Tsimshian carver John C. Hudson Jr.
  National Historic Landmark 1977 with the Pioneer Building and pergola (NRHP 77001340). The other CCC carvers' names are
  not in the reachable sources (Garfield's book would confirm them): do not invent names.
- **The original** (Chief-of-All-Women pole) was carved about 1790 for the Kinninook family (Tlingit, Raven moiety) to
  honour Chief-of-All-Women, who drowned in the Nass River; raised at a potlatch on Tongass Island, Alaska; one of few poles
  dedicated to a woman. On 28 August 1899 the Seattle Post-Intelligencer's business expedition (steamship *City of
  Seattle*) cut it down at Fort Tongass while the villagers were away, sawed it in two and broke the bottom figure's beak
  (later restored wrongly); unveiled in Pioneer Square on 18 October 1899. A federal grand jury indicted eight members; the
  P-I paid $500 to each of four claimants; the case was dismissed in June 1900 with a further $500 settlement. The
  original had been repainted in non-Tlingit colours; the replica returned to Tlingit black, red and blue-green (Garfield
  p. 15).
- **Figures, top to bottom** (Garfield p. 17): 1 Raven with the crescent moon in his beak (*Raven Steals the Sun*); 2 woman
  holding her frog child and 3 her frog husband (*The Woman Who Married the Frog*); 4 Mink, 5 Raven, 6 Whale with a seal in
  his mouth (*Raven and Mink inside the Whale*); 7 Raven-at-the-Head-of-Nass / Grandfather of Raven (the chief who owned
  the sun, moon and stars). The top figure identifies the owner.
- **Model**: black formline, red secondary formline / lips / nostrils, blue-green eye sockets and tertiary areas on
  unpainted grey-brown weathered cedar; no other colours. Deep relief with projecting beaks, fins, wings and the frog child
  (`pioneer-square.js`). Proportions and paint placement: check against the Commons category "Pioneer Square totem pole"
  (reference only).
- **Wording**: say "taken without consent" or "stolen", never "gift". The Coast Salish peoples native to Seattle did not
  traditionally carve totem poles; the city reviewed its totem poles for cultural sensitivity in 2018. Plaque text in
  `seattle-spots.json` credits the carvers first.

## Ballard Locks (`ballard-locks`)

**Modelled**: north bank (Administration Building, garden), the large and small locks, spillway dam, the public crossing,
the south-bank plaza and fish ladder. Spawn 47.6664, −122.397 heading 180°. Lift up to 26 ft (7.9 m).
- Layout from OSM: large-lock gates w293079629 (west), w293079656 (intermediate), w1305545916 (east); small-lock gates
  w1305545915 / w293079859; lock and guide walls are `man_made=breakwater` polygons w159935907 (the 355 m wall between the
  locks), w51818718 (small lock's south wall and guide wall), w51818719, w1305542077; spillway = `waterway=dam` w32823954,
  70 m from the small lock's south wall SSW to the south bank; public crossing = footways w472179838 – w285286403 –
  w472179843 – w1475183519 – w1475183520 (west gate, middle wall, small-lock gate, south wall, dam) plus w472179834 over the
  intermediate gate (gate decks 2.1 m wide, 1.3 m clear between railings); fish ladder w764035003, w285286401 (21 weirs,
  rebuilt 1976) and viewing room n3413278212 (tunnel footway w285281016) on the south bank. Large lock 251.5 × 24.4 m, small
  lock 45.7 × 9.1 m.
- Levels (DEM, `fine-dem-ballard-locks*.js`): lake 4.98 m, tidewater −0.36 m (the DEM's low-water surface, used as a fixed
  tide), coping and north bank 7.0 m.
- Spillway (Y0Yw3Wz4h2RpdyuvBvYE7w): stained concrete piers, an arched concrete service bridge with pipe railings above the
  dark ribbed gate leaves, the public footbridge along the downstream face ≈ 2.4 m below it with galvanised railings and
  lamp posts; gate tops a little above the footbridge deck. No red hoist boxes.
- Buildings (1915: Administration Building w51475867, Operating Houses w285289605 / w285289606, Control Tower w223562285
  of 1969): grey concrete walls with arched openings (Administration front), red tile hipped roofs (seen from the dam).
- `scenes/ballard-locks-buildings.js`: the 1915 buildings carry a concrete tile with tall round-arched windows; the
  Control Tower (w223562285: `man_made=tower`, `tower:type=observation`, 1969, the lock's VHF station "Locks") is a
  concrete shaft on its footprint under a glazed control cab, flat roof and radio mast; the Fish Ladder Viewing Room
  (n3413278212, wheelchair, 07:00–21:00) is entered at the mapped tunnel mouths (ramp w285281015 → tunnel w285281016,
  steps w285281017): the scene's ground is one terrain surface, so the room is built apart (like the Carusel bar) — a dim
  concrete room with six windows into the ladder and salmon swimming upstream past them.
- Administration garden w60973304 (`leisure=garden`): wooded with tall conifers in Street View, drawn as conifers on a 5 m
  staggered grid. Carl S. English Jr. Botanical Garden: w51475864.
- Salmon Waves (n3211770269, Paul Sorey 2001, SPU04.087; `scenes/ballard-locks-art.js`): "Seven stainless steel waves
  varying from 6 to 9 ft. high", 350 sq ft, blue LEDs; on plaza w1475183524 over the fish ladder (layer −1).
  AVeeBVnYYgdepI_VExHVWQ @ 60: seven brushed-steel bands curling over into spirals in a loose row running east, curls
  facing the promenade. The DEM is hydro-flattened over most of the plaza; its dry samples give 6.72 / 6.94 m, so the plaza
  is a deck at −1.67 relative with a 1.05 m concrete parapet where it stands over water or lower ground (open at the mapped
  footways).
- Salmon Bay Bridge (BNSF bridge 6.3, `man_made=bridge` w859885667, movable span on w34680546 / w53826213 at 122.4021 W):
  rust-brown camelback through truss, counterweight tower at the north end (from W Commodore Way); a silhouette.

**Estimates**: footbridge and service-bridge levels (lake +0.1 m / +2.5 m) and all wall tops (7.0 m, the north bank's coping)
read from one panorama and the bank; the large chamber moves as one sheet across the intermediate gate; Salmon Waves'
layout, facing and curl from one panorama; plaza level from two dry DEM samples; parapet 1.05 × 0.25 m; the garden's
conifer grid and tree sizes; 1915 building heights; the arched windows' size and rhythm (one per 3.2 m bay and 3 m
floor); Control Tower shaft 9 m, cab 3 m with a 0.45 m overhang, mast 4.5 m; the viewing room's size (18 × 7 × 3.2 m),
six 2.4 × 2.2 m windows, the water colour and the 14 salmon.

**Open (needs a panorama look of the lock grounds)**: the visitor centre, the garden's planting; roof-tile colour against a
reference. Lock-wall panoramas put the game's eye in the chamber (no valid comparison).

## Gas Works Park (`gas-works`)

**Modelled**: Kite Hill with the sundial, the fenced generator towers, Play Barn and picnic shelter, the Prow, lawn relics,
the lake view closed by the high bridges. Spawn 47.6456, −122.3356 heading 160°. The towers are fenced with no climbing
(three fatal falls, 2012 / 2022 / 2025).
- Levels: the whole park on a 5 m grid of the 1 m DEM (`fine-dem-gas-works.js`, 2,277 EPQS samples); lake 4.98 m, Kite
  Hill summit 20.4 m (OSM `ele=20`), the Prow / "Lake View Point" (n3667766956) 10.8 m, shore path 6.1–6.2 m.
- Sundial (n31096103, Charles Greening): 27'9" across, painted under the OSM pedestrian disc w191328703 ("Kite Hill").
- Play Barn = the south shed w52137309 (Oct 2012 pano 8m6r8xCsZ1nuwWZ4N4U8sw): open sides, white posts with white wedge
  braces, low grey corrugated roof, red / orange / pink machinery inside, tall blue and white vessels at its corner; the
  north shed w52137316 is taller and grey (picnic shelter).
- Lawn relics: `building=industrial` w406480498–w406480503 west of the barn are slender rust-brown towers 15–20 m with fat
  sweeping pipes, a row of three low vessels (w406480503) and a small grey shed; "Concrete Train Trestles"
  (`tourism=artwork` w405794428) a row of concrete bents.
- Generator towers inside fence w4835090: OSM maps six round tanks of 6–7 m, one rectangular block, two chimneys
  (`man_made=chimney`, 1.5 m) and nine small vessels (also w425465783, w449626310, w449626314); heights ≈ 15–25 m
  (estimate; falls of 50 ft reported).
- Aurora Bridge (w370645739, 870 m west) and I-5 Ship Canal Bridge (w4644173 / w474077561 along 122.3225 W, 1 km east) as
  silhouettes at their mapped positions.

**Open / unverified** (one official panorama within 60 m, at the entrance): the amphitheatre steps (not found in OSM), the
sundial's real design (the scene's is stylised), the towers' individual shapes, the car park, the entrance sign, the
Burke-Gilman trail edge, floatplane and houseboat positions.

## Lincoln Square, Bellevue Square & the skybridges (`bel-lincoln-square`)

**Modelled**: both sides of Bellevue Way NE between NE 4th and NE 8th St. Spawn 47.61755, −122.20195 heading 135° (NW corner
of NE 8th × Bellevue Way). The landmark models (Lincoln Square towers, Bellevue Square, skybridges) are in
`game/src/landmarks.js` / `landmark-bellevue-square.js`; facade colours, entrance node and skybridges are in
`seattle-bellevue.md` §6.1.
- **UiPath Bellevue**: UiPath's offices page lists Lincoln Square North, 700 Bellevue Way NE, Suite 2000; GeekWire (2025):
  two floors, 44,735 sq ft, product & engineering hub, moved Sept 2025. Lincoln Square North (w604028609, 2005): 126 m,
  28 storeys (Wikipedia's 2005 plan says 27), staff entrance on Bellevue Way (OSM entrance n7945526075). The lobby, suite
  look and second floor are not public — owner to confirm. `cities.js` `uipath-bel` is at 47.61723, −122.20148.
- One Lincoln Tower (w604028611, w328017119; Westin + condos, 137 m, 42 storeys); Lincoln Square podium (w161929514,
  3 storeys, 10.9 m; glass canopy, The Container Store and Earls at street level, beige / salmon piers, "LINCOLN SQUARE"
  on the NE 8th canopy); Lincoln Square South (w1326151866, w1326151868, w1326151818; office 137 m / 31 storeys, W Bellevue /
  Avalon 41 storeys); Bellevue Square (w29234887, w33106348, w497738386, w497739259; 1946, 3 storeys, 120,774 m² GLA);
  Bellevue Arts Museum (w33613449, Steven Holl 2001; sale to KidsQuest announced Oct 2025 — keep the façade, check
  signage).
- w33106348 ("Bellevue Square Mall", the L-shaped block at the SW corner of NE 8th × Bellevue Way wrapping the NE parking
  garage) is not one of the `bellevuesq` landmark's source rings (w29234887 + w497739259): it is drawn as an OSM building
  with its mapped ground-level shop signs (Crate & Barrel on the corner; Pressed Juicery, Starbucks, Cactus, Farzi Café,
  Tavern Hall, Castilla, Shake Shack along Bellevue Way; Cactus and Thai Kitchen Bird Pepper are level 2 with no legible
  street sign). Look (panoramas at 47.617039 / 47.616778, −122.2016; NE 8th 47.617365, −122.202878; towards NE 6th
  47.616193, −122.202176): two tall storeys, white stucco with dark shopfronts and ivy bays on Bellevue Way, Crate & Barrel
  a white two-storey glazed corner; the west part on NE 8th red brick with a steel-and-glass canopy and glazed upper
  storey; towards NE 6th cream stucco on a brick base. The red-brick building further south (The Cheesecake Factory) is
  part of the Bellevue Square model.
- Bellevue Place across NE 8th (w366831926 + parts, w33613428): tan / rose precast with rectangular punched windows.
- Avenue Bellevue (w1215907936 / w1215907937 + parts): two white towers ringed by balcony bands (one balcony slab per
  storey); the curved plan is not modelled.
- Bellevue Way skybridge (w43872832): steel truss with glazing on branching columns. Other skybridge ways w43872826,
  w516915099, w1222676052, w29234890, w497738385 match live OSM (lengths from OSM geometry 32 m, 58 m diagonal, 17 m).
- Bellevue Square ↔ West Parking Garage (w30758875) strip: twelve `highway=footway` + `bridge=yes` + `layer=1` ways cross
  the service drive (appended to `bel-lincoln-square.json` by `append-osm-features.mjs`). Covered ones drawn by the scene's
  skybridge list: w387201731, w29234888, w843400178, w843400185, w843400163, w30758942, w843400165 (the 2 m junction stubs
  w843400176 / w843400164 are left out); open garage-deck walkways w29234889, w843400118, w843400136, w843400114 drawn as
  concrete decks with rails. Skybridges have one floor level and mitred bends. The strip's 62 live-OSM ground ways
  (service drive, aisles, sidewalks, crossings, steps) are drawn.
- Bellevue Way south of NE 8th is mapped as two one-way carriageways (w425272687 southbound; w738584326 / w470492322
  northbound): a yellow-kerbed raised median under the skybridge and a planted median near NE 6th.

**Estimates**: w33106348 heights (restaurant row 10 m, Crate & Barrel corner 12 m, read against street-light heads); its
garage-facing inner faces keep the generic shopfront; median width = the gap between the painted carriageway edges
(0.6–2.4 m), planted stretch, kerb height, turn-lane breaks; skybridge / open walkway floor 6.2 m over the higher end's
ground (`SKY_Y`, no measured level); skybridge width ≈ 4–5 m; Avenue Bellevue balcony depth 1.2 m, slab 0.22 m.

**Open (needs a panorama look)**: the drive between the mall and the West Parking Garage (official panoramas
EE7cKAltcksKzsSBPd822A, odcxtWhNyv-UeSc9O436Lw, _-8mGqQtoDS7uRaPUYC-ww, xnT4Gtmue9XZR7R-xc0iTQ, not yet viewed) for the
skybridge floor level; UiPath lobby and signage (owner); Snowflake Lane dates (annual, December).

## Bellevue Downtown Park (`bel-downtown-park`)

**Modelled**: the whole park — promenade ring (805 m), canal ring (w1326469164 / 165 / 169, complete since 2017), weirs,
upper pool w1326469168, cascade w842753013, reflecting pool w1326469177, waterfall (73 m / 240 ft wide, SW), lower plaza
w1326475313, south fountain w842753014, Inspiration Playground w503657594. Spawn 47.6133, −122.2034 heading 200° (NE 4th ×
Bellevue Way gateway).
- NE 4th St forecourt (r11564632, `highway=pedestrian`, `surface=paving_stones`): grey pavers from kerb to canal wall.
  Fountain w655090567: a raised round granite bowl (mapped Ø 5.4 m) spilling onto three circular steps ringed by low
  round-topped bollards. Four pink-granite obelisk lamps with globes (not mapped), placed by bearings from two panoramas
  (± 2 m) at (−72.8, −35.8), (−55.6, −35.8), (−82.0, −41.5), (−46.4, −41.5); the ring obelisks exist too. Flagpole
  n12195609190 (US flag), stone relief-map table n4957270649, ten white benches n7861958149–158.
- Piloti (w1326469154; Marc Fornes / THEVERYMANY 2023; 7 m, 6,000 panels, 180,000 rivets): a cluster of slender white
  columns flaring into the canopy (seven columns drawn).
- WWI memorial (n5657152449, `memorial=obelisk`, "Lest We Forget"; 1926 elms): an obelisk on a plinth with three elms
  ("Three elms and a plaque"); the plate carries the mapped name only.
- Playground shelters w842810342, w842810343, w1389888659, w1389888660 (`amenity=shelter`) are open roofs on posts;
  restrooms w503657595, w479656681, w505219712 low blocks; playground equipment at its mapped nodes (2 structures,
  climbing frame, 4 slides, swing, 2 basket swings, spinner bowl, spinning circle, trampoline, bannister bars, water
  table; stand-in shapes); splash pad w1389888661 painted.
- Terrace walls w810574801–803, w842753004–006 (no height tag) and old-school outline w810575032 (`height=0.2`).

**Estimates**: no official panorama inside the park — canal coping colour, weir sills, cascade face, waterfall drop
(≈ 3 m), terrace walls (0.45 m above the higher side), the old-school kerb, Piloti's column count / places and six 0.9 m
vaults (its undulating canopy edge is a plain shell), obelisk height 2.9 m. Not modelled: the forecourt's lantern lamps
and kerb bollards (no OSM nodes). Unchecked: the Bellevue Way raised median near NE 2nd St.

## Bellevue Botanical Garden (`bel-botanical-garden`)

**Modelled**: the core garden (53 acres, free, dawn to dusk). Spawn 47.6088, −122.1793 heading 180° (Shorts Visitor Center
courtyard).
- Ravine Experience bridge (w210457899; `bridge:structure=suspension`, `surface=metal`, `width=1.5`): metal deck, ≈ 45–50 m.
- Name sign: a teal panel between two posts on the east side of the drive at Main St.
- Yao Garden (w32121704): gate (r19659543), basalt streambed, boulders, lanterns, maples per OSM (no raked gravel); stone
  lanterns at their artwork nodes (Kasuga n13176039734, Miyoshi n13176039735, Stone Lantern n13179881929) and the Kyoto
  stone water basin n13176039736. No tree in a mapped pond.
- Artworks (forms from tags and the garden's art page bellevuebotanical.org/garden-art): Friendship Circle n4499338296
  (standing stone circle), Night Blooming n5531375272 (wood, 4.1 × 3 m), Basalt Bench n4730801813, Stacked Stones
  n13176504583 (cairn), Waterwall n9251586886 / w1433659335 (slate wall fountain); Owl's Glare (bronze owl landing on a
  boulder), Goldiwarts (bronze toad beside a bronze leaf), Large Galaxy (S-curved brushed-steel stem with coloured kinetic
  pieces, ≈ 5 m), Shaman (pointed dark carved monolith, ≈ 2.3 m), Three Cranes (verdigris metal cranes, one stooping),
  Sophia's Dream (long low dark carved stone, ≈ 2 m), The Nature of Sitting (aluminium leaf cut-out on a granite block),
  Sheepish Rabbit (bronze rabbit on a grey stone drum).
- Aaron Education Center r19675678 (Olson Kundig, June 2014): inner rings w1435225256 (bed GC03) and w1435225279 are open
  courtyards; garden side (Commons "Bellevue Botanical Garden 04 - Aaron Education Center"): one storey, pale timber panels
  between white posts, white multi-pane glazed doors, thin grey metal roof edge with a deep overhang.
- Shorts House r6758706 (`building=retail`, the shop): the Shorts' 1957 contemporary home by Paul Kirk (garden history
  page); inner ring w184864667 is the atrium (bed SH06, Sheepish Rabbit), pale grey wall base and light timber above.
- Sharp Cabin w453135458 (Commons photo named by the OSM `image` tag, "Bellevue, WA (2023)"): one-storey cottage, khaki lap siding, taupe trim, steep grey shingle roof with a
  cross gable, recessed porch with white rail and fretwork brackets in the north gable end, red door.
- Perennial Border r19655849 (`garden:style=flower_garden`; Northwest Perennial Alliance): no mapped beds inside, painted
  as one flower garden with 150 perennial clumps. Shelter by Shorts House w1433659397: an open roof.
- Wilburton Hill Park sports ground east of the garden: soccer pitch w32025468 (`artificial_turf`), running loop
  w403375045, bleachers w1434241117/8, six `man_made=mast` floodlights, basketball court w1332124896.
- Car park r19655198: in use with dense conifers round it; parked cars square to the mapped aisles.
- Postcard: the guided tour's postcard frames the Perennial Border; the research iconic photo (ravine bridge) is ≈ 300 m
  from the entry spawn, past the tour's 230 m reach, and the bridge keeps its own activity ("Cross the suspension
  bridge"). Kept that way (2026-11-13): the postcard stays inside the tour's reach and the bridge has its own activity.

**Estimates**: artwork stand-ins sized from one photo each; Shorts House exterior (one storey, flat roof — no exterior
photo); pitch markings (standard proportions), floodlight masts 18 m; parked cars (OSM maps lot + aisles, not bays). Name
only, none of the garden interior has an official panorama: the Aaron Center, artworks, ravine bridge, Tateuchi pavilion
(w32121769), boardwalks w453135455 / w1433659385, Lost Meadow bridge w1431835804. Garden d'Lights LED count: unknown
(annual).

## Meydenbauer Bay Park (`bel-meydenbauer`)

**Modelled**: beach, crescent pier, pavilion, marina, Whaling Building and boathouse, the ravine, the Lake Washington Blvd
bridge, far shores. Spawn 47.6106, −122.2108 heading 250°. Ferry landing 1890s–1921; first park 1953; reopened March 2019.
Official panoramas: Lake Washington Blvd bridge 47.61201, −122.21094; 99th Ave NE foot 47.61046, −122.20985; LWB × 99th Ave
NE 47.61105, −122.20915; marina lot 47.60989, −122.20898; under the bridge 47.612160, −122.211318. The beach, pier deck and
playground have user photospheres only (judged from OSM).

| Feature (OSM) | What is modelled |
|---|---|
| Pavilion w688203355 (`building=toilets`), footway w841411879 `layer=1`, picnic tables n7850600507–510 `layer=1` | Set into the bank; its roof is a public terrace level with the upper walk (light concrete deck, galvanised mesh rails, tables at their nodes). DEM: beach side 1.0–1.8 m, uphill 4.2–4.6 m; terrace at 4.45 m. No name plate (no source). |
| Whaling Building w819159071 (`building:levels=2`) | Dark brown boards, white-trimmed windows, steep brown-grey shingle roof, ridge about level with 99th Ave NE (≈ 7 m). |
| REI Boathouse w698374975 | Same dark brown / white trim / shingles; no name board readable. |
| Covered moorage w819159076 (`building=roof`, layer 1) | Open shed roof on posts, grey roof with deep brown timber fascia, motor boats beneath. |
| Yacht-club w627898895 / 896 / 897 (inside marina w393293243) | Long covered-moorage sheds over the water. |
| Piers w753594668–678, w753594680, w737163199–206 | 19 linear timber decks on piles (private, not walkable). |
| Crescent pier w688415225 / w687934817 (2019; ≈ 128 m / 420 ft) | Low grey deck, mesh rails, white pile tops above the rail; walkable. |
| Pier-tip node n6455415841 (`amenity=clock`, `display=sundial`, `tourism=viewpoint`) | A low sundial. |
| Buoys n6901346624–629 (`buoy_special_purpose`) | Six white cans with an orange band. |
| Lake Washington Blvd bridge w243441596, sidewalks w753604118 / w753604114 | One sloped walkable slab, raised concrete sidewalks inside concrete balustrades, dark lantern posts on the parapet; below: concrete slab deck on single upright tapered rectangular piers (no struts). |
| Park sign (park w57883263) | Low teal panel between two posts at the LWB × 99th Ave NE corner. |
| Lights | Park: dark ≈ 5 m posts with a pendant shade; boulevard: grey cobra heads with light pools under them; 99th Ave NE: dark posts with a bell pendant. |
| Steps w840902386 (17 steps), w841411878 (5 steps) | On a bank graded to the DEM: w840902386 rises 2.2 m (y 0.30 → 2.49), w841411878 from y 3.7 → 4.45. |
| Far shores | Dense fir belt; houses, condos and boathouses at the waterline from 152 live-OSM footprints within 120 m of the water outside the DEM grid (`game/data/spots/bel-meydenbauer-shore.json`). |
| Beach w688203354, swimming area w737163174, swim float, playground w688639344, bubbler n6458275653 | At their mapped places; playground and tables off the terrace are generic stand-ins. |

**Estimates** (each read against one panorama): terrace deck 4.45 m; Whaling Building eaves 3.3 m / rise 3.4 m; boathouse
sizes; the 19 piers 2.2 m wide; LWB bridge piers (count 3, spacing, section) and its four lanterns; shore houses' levels /
roof / colour by rule where OSM has no tags; lamp positions are generated (no lamp nodes), the bell lamp's post 4.6 m, arm
0.75 m and bell size; flight widths 2.0 m; buoy shape; ravine ≈ 25 m from beach to Main St level.

**Not seen in any official panorama**: the pavilion's beach face, the pier deck from on it, playground equipment, the
upper walk's railing (not modelled), fish sculpture n13707322282 ("A native-PNW style fish sculpture", hidden by shrubs,
not modelled).
