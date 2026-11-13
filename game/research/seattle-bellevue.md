# Seattle · `bellevue` district — research dossier

Machine-readable twin: [`seattle-bellevue.json`](seattle-bellevue.json) · businesses and speed limits: [`businesses-seattle-bellevue.md`](businesses-seattle-bellevue.md) · photos: [`refs/bellevue/LICENSES.md`](refs/bellevue/LICENSES.md)

The JSON: `chapterRoutes[].segments` = every OSM way of the researched routes in driving order with lanes / `hov:lanes` / `turn:lanes` / `destination:lanes` / surface / bridge / tunnel / layer; `streets[]` = curated stretches + every downtown street; `buildings[]` = every building within 70 m of a route or ≥ 25 m tall in the core (footprint, parts, height, curated facade hex, `estimateBasis`); `businesses[]` = branded POIs within 60 m; `signs[]`; `landmarks[]` = the two CV stops (`lincoln-square`, `plaza-center`); `traffic.hotspots` maps 1:1 onto `CITIES.seattle.districts.bellevue.congestion`. All OSM data © OpenStreetMap contributors (ODbL).

Street-level reviews (2026-11-12/13) compared game renders with official Street View panoramas at the same pose (ids from coverage metadata; looked at only, nothing stored, traced or measured). Reference poses: `game/dev/reality/viewpoints.json` (ids `bel-*`).

## 1. District and chapter route

UiPath's Bellevue office: **Plaza Center, 10900 NE 8th St** (2018 – Sept 2025), then **Lincoln Square North, 700 Bellevue Way NE** (since Sept 2025), the chapter's stop.

Playable district as built: NE 8th St from I-405 to Bellevue Way plus 200 m around Lincoln Square (0.39 km²; live OSM bbox 47.6138,−122.2051 – 47.6198,−122.1839). Chapter `uipath-bel` (cities.js): off I-405 on the "NE 8th St West" loop, west on NE 8th St past Plaza Center, then Bellevue Way NE to the Lincoln Square entrance; 1,388 m.

The research first proposed a corridor district for the finale (I-90 EB out of the Mount Baker Ridge Tunnel, over the Murrow floating bridge and Mercer Island, I-405 NB, exit 13B; 14.4 km, above the spec-10 limit of 12 km). The playable district does not include it; the chapter montage map (data.js) shows the lake crossing. §2 holds the facts.

## 2. The approach: I-90 and I-405

- **Mount Baker Ridge Tunnel**: the twin 1940 bores (8.8 m Ø, interiors squared off in the 1989–93 rehab except the arched portals) carry **eastbound**; the 1989 bore (19 m Ø, world's largest-diameter soft-ground tunnel) carries westbound on the upper deck, light rail below and the I-90 Trail on top. Official length 440 m, ~1 km perceived with the cut-and-cover lid ([Mount Baker Tunnel](https://en.wikipedia.org/wiki/Mount_Baker_Tunnel)). OSM: 4 EB lanes (lane 1 HOV 2+) splitting at lon −122.2986 into north bore HOV + GP (w123889282) and south bore 2 GP (w98733141 / w481403971), 60 mph, concrete. East portals: arched concrete with the carved band "SEATTLE · PORTAL TO THE PACIFIC" and relief murals (James FitzGerald), a City of Seattle landmark with the Murrow bridge (photo `Seattle_-_Portal_to_the_Pacific_01.jpg`; warm tan wall tone inside).
- **Lacey V. Murrow Memorial Bridge** (EB): 4 lanes (HOV + 3 GP), 2,020 m, 2nd-longest floating bridge; opened 1940, sank 25 Nov 1990 during rehab, reopened 12 Sep 1993; 29 ft clearance under the fixed spans at each end ([Murrow](https://en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge)). At both ends the lanes pass *through* cream concrete high-rise arches (ribs fusing into a flattened oval crown ring with oval holes, ~8 dark steel hangers per side). Floating section: deck ~2–3 m over the water, steel finger joints at pontoon joints, low concrete safety-shape parapets, **no sidewalk**. Exit 6 West Mercer Way from the right lane at the east end.
- **Homer M. Hadley bridge** (WB, 1989, 5,811 ft): 4 WB lanes, the I-90 Trail on its north edge (black steel picket railing on a concrete parapet), and since **28 March 2026** the **2 Line** in the middle, the world's first light rail on a floating bridge, catenary on dark steel portal frames; pontoons 32 m wide ([Hadley](https://en.wikipedia.org/wiki/Homer_M._Hadley_Memorial_Bridge), [2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit))).
- **Mercer Island**: 4 EB lanes; exits 7A 77th Ave SE, 7B Island Crest Way, 8 East Mercer Way; HOV-only left ramp to Island Crest Way. 788 m under the "I-90 First Hill Lid" (Aubrey Davis Park), then short lid undercrossings; noise walls, conifer slopes; Mercer Island station in the median ([I-90 in Washington](https://en.wikipedia.org/wiki/Interstate_90_in_Washington)).
- **East Channel Bridge → I-405**: 4 → 6 lanes; left HOV lane signed for the HOV direct ramp to I-405, lane 5 exit 9 Bellevue Way. Exit 10 (w621378267): "Factoria Blvd; Everett" / "Renton", ramp 2 → 3 lanes, single-lane flyover (layer 2) onto I-405 NB; I-90 widens to 16 lanes with C-D roads at the stack.
- **I-405 NB**: 5 lanes (HOV 2+ left + 4 GP) → 4 after exit 12 SE 8th St → 5 with the exit-13 auxiliary lane, 60 mph ([w736892510](https://www.openstreetmap.org/way/736892510)); NE 4th diamond, **NE 6th HOV/bus-only "Texas T"** to the Transit Center (never route the player into the left lane there), NE 8th cloverleaf ([I-405](https://en.wikipedia.org/wiki/Interstate_405_(Washington))). Exit 13A (left) "NE 4th St — Meydenbauer Center / Bellevue Square / Bellevue Arts Museum", 13B (right) "NE 8th St" → "NE 8th St East" / "NE 8th St West" ([w531674824](https://www.openstreetmap.org/way/531674824)). Renton–Bellevue express-toll-lane construction south of downtown until summer 2027 ([WSDOT](https://wsdot.wa.gov/construction-planning/search-projects/i-405renton-bellevue-widening-and-express-toll-lanes-project)).

## 3. US / WSDOT markings

| element | spec | source |
|---|---|---|
| lane line | white, **4 in** (10 cm), **10 ft dash / 30 ft gap** (3.05 / 9.14 m) | [WSDOT M-20.10-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.10-04_e.pdf) |
| wide broken lane line (HOV ↔ GP) | white **8 in**, 10/30 ft | M-20.10; [MUTCD 3D.02](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm) |
| dotted lane line (lane drops, aux lanes) | 4 in (wide 8 in), **3 ft / 9 ft** | M-20.10 sheet 2 |
| dotted extension (gores, ramp continuations) | 4 in 2 ft / 6 ft; wide 8 in 6 ft / 6 ft | M-20.10 sheet 2 |
| edge lines | **right = solid white, left = solid yellow** on every one-way roadway (each freeway carriageway, each one-way couplet) | M-20.10 note 2 |
| double centreline | yellow 4 in lines, **12 in apart on state routes**, 4 in apart at left-turn channelisation/narrow roads and allowed on local streets | M-20.10 note 3 |
| barrier line | yellow 18 in | M-20.10 |
| line material | profiled / embossed plastic on freeways → textured, glossy-when-wet look | [M-20.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.20-02_e.pdf) |
| raised pavement markers | **Type 2W** centred in every lane-line gap at **80 ft** (40 ft on curves R < 1,500 ft); **Type 2Y** just outside the left edge line every 80 ft; 2YY on two-way centrelines | [M-20.30-05](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.30-05_e.pdf) |
| Botts' dots | western WA historically uses non-reflective ceramic buttons to *simulate* lane lines; WSDOT still uses RPMs "in select locations" | [Traffic Manual ch.3](https://wsdot.wa.gov/publications/manuals/fulltext/M51-02/Chapter3.pdf), [Columbian 2024](https://columbian.com/news/2024/oct/28/why-dont-many-wa-highways-have-reflectors-if-the-state-gets-so-much-rain-we-asked-wsdot) |
| HOV diamond | white outline, ≥ 2.5 ft × 12 ft, lines ≥ 6 in, centred in the HOV lane; freeway spacing up to ~1,000 ft and at every decision point | [MUTCD 3D.01](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm) |
| arrows | high-speed Type 1/2/5 arrows (~16–23 ft) on ramps; 8 ft arrows on ≤ 40 mph arterials | [M-24.20](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.20-02_e.pdf), [M-24.40](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.40-02_e.pdf) |
| gores / crosshatch | white chevrons **12 in** wide at ≥ 45 mph (8 in ≤ 40 mph) inside wide solid channelising lines | [M-24.60](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.60-04_e.pdf) |
| stop line | white solid, 1 ft 6 in typical | M-24.60 |

Rules that follow: never a yellow line between two same-direction lanes; never a double yellow on a freeway; the median-side (left) edge of every one-way carriageway is yellow (MUTCD 3B.06); lane lines stop at the gore and continue as dotted extensions across ramp mouths; the HOV lane is separated by a wider white broken line plus diamonds. Floating-bridge photos show exactly this.

## 4. Guide signs

Green, white legend, FHWA Series E(M)/Clearview, retroreflective, on galvanised steel box-truss gantries (OSM `man_made=gantry`, positions in `furniture.osm.signGantries`). Legends come from OSM `destination:*` (mapped from the real signs; layout and arrows unverified), full list in `signs[]`: I-90 EB "Spokane"; EXIT 6 West Mercer Way; HOV ONLY Island Crest Way, EXITS 7A / 7B / 8, WB "Mercer Island NEXT 2 EXITS"; East Channel Bridge "405 NORTH Everett / 405 SOUTH Renton" (HOV) and "EXIT 9 Bellevue Way" EXIT ONLY; "EXIT 10 — 405 NORTH Everett / 405 SOUTH Renton", "Factoria Blvd"; I-405 "EXIT 12 SE 8th St / 116th Ave SE", "405 NORTH — 520 Seattle / Redmond", "EXIT 13 NE 4th St / NE 8th St" EXIT ONLY, left "HOV — NE 6th St"; exit 13 split as in §2. Downtown: white-on-green street-name blades at the far right of every signal mast arm ([Bellevue TDM 4.1.6](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf)). A gantry stands over the east end of the NE 8th St bridge (w1188380109; text not legible; not drawn).

## 5. Downtown streetscape

- **NE 8th St** (principal arterial, 30 mph): two one-way carriageways 11–14 m apart centre-to-centre, 3–4 lanes each way incl. left pockets (`left|||right` WB at 106th/108th), narrow raised median with **yellow-painted kerb noses**. Signals at 112th, 110th, 108th, 106th, Bellevue Way. East of I-405, the untagged left-turn links between the carriageways (`primary_link` w1548748925 and connector w1548748924) get no inferred walkway: `sidewalk-overlap.js` drops the walkway of an at-grade `*_link` whose connecting roads are all tagged without walkways, or whose band lies on / beside a parallel carriageway.
- **NE 8th St over I-405** (w1058885032, w428073537, w513238699, w30615115, w55481043, ramp w623055163 sharing the north deck edge): low concrete parapet with a dark steel picket fence (drawn, `bridge-guards.json`), concrete pavement, sidewalk on the north side, freeway in a cut with grass slopes and a concrete median barrier.
  - **Median barrier** (drawn 2026-11-13, `freeway-cut.js`): OSM maps no barrier on the I-405 median in the district (its only `barrier=jersey_barrier`, w1188380108, is on a ramp at −122.1867), so the barrier is the panorama evidence above. It runs midway between the two carriageways for the whole district (47.6162–47.6186, 221 m), between the two median lanes of the HOV ramps, open only round the bridge piers; 0.86 m concrete single-slope section (WSDOT Type F size, estimate).
  - **Cut** (drawn 2026-11-13, `freeway-cut.js`): the game keeps I-405 at the district's level with the deck about 5 m up on piers, so the cut slopes cannot be drawn without lifting the loops and the ground round them. Under each end of the deck a concrete abutment wall rises from the outermost carriageway's shoulder to the deck soffit (soffit 0.9 m below the deck surface, estimate) and is filled back to where the approach meets the ground (west 22 m, east 26 m along the freeway), so the freeway and its ramps pass under the bridge between concrete walls.
  - **North sidewalk: not drawn.** OSM maps it as a separate way, footway w67144854 (`bridge=yes`, `footway=sidewalk`, 47.61748–47.61750; the westbound carriageways carry `sidewalk:right=separate`), and the south one as w111869523. Both centrelines lie on the game's deck edges: the five 3.5 m westbound lanes (with the Renton exit lane) and the four eastbound lanes fill the deck from parapet to parapet, so a sidewalk needs the deck widened by about 2 m on each side and the reviewed parapet and fence moved out with it. The parapet is drawn by the raised-deck railing network from the carriageway outline (shared with every district), and narrowing the lanes would change the road: left for a deck-outline change.
  - **Gantry** w1188380109 (`man_made=gantry`, layer 2) over the east end of the deck: not drawn, its sign text is not legible on any source.
- **Bellevue Way NE**: split carriageways 9.7–12.3 m apart, 2–3 lanes each way + left pockets; Bellevue Square west, Lincoln Square east; a planted median.
- **108th Ave NE**: office spine, bike lanes both sides, mostly 1 lane each way + turn lane. **NE 6th St** 108th–110th: Transit Center bus street with a diagonal scramble crossing, no private cars.
- **Sidewalks**: concrete, **2 ft × 2 ft scored squares, light broom finish** (detail DT-120-1), ≥ 5 ft planters / tree pits between walk and kerb, 6-in vertical kerb + gutter ([Bellevue Transportation Design Manual 2024 §3](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf)).
- **Signals**: Type II/III mast-arm poles, one 12-in 3-section head per lane on the arm (WSDOT J-75.20 Type M), backplates with retroreflective border, pre-emption sensor on each arm, cabinet facing away from the intersection (same manual §4.1). Pole finish (galvanised vs painted) not verified per intersection.
- **Lights**: freeway — bent-arm LED heads on median/parapet (OSM `lamp_mount=bent_mast` ×74); downtown — roadway poles with LED fixtures; pedestrian-scale poles on Main St.
- **Street trees**: OSM maps 1,132 trees in the core but almost none on NE 8th and Bellevue Way, where panoramas show continuous deciduous street trees (orange/red maples in November). 22 crowns were read by eye on the aerial mosaic (Esri World Imagery, zoom 19, 0.20 m/px; imagery kept in scratch only) and added in `tree-additions.js`: ten on the west kerb of Bellevue Way at 47.6187–47.6200, four on its east kerb, six on the west side at 47.6142–47.6147, two on the south kerb of NE 8th; the builder refuses 4 for clearance. Crowns in the towers' shadows (most of NE 8th, Bellevue Way 47.6150–47.6185) cannot be read on this imagery: not added. Species unverified.
- **Furniture in the core (OSM)**: 1,403 kerb nodes, 867 crossings (230 signalised), 331 benches, 101 bins, 60 bus stops, 49 hydrants, 45 artworks, 113 garage entrances.
- **Fountains**: w469892286 (47.61756, −122.19944) has a red-brick coping (world.js `FOUNTAIN_COPING`), round basin; the one panorama shows it dry with a sculpture (possibly seasonal; sculpture form unknown), so it keeps water and no sculpture. No panorama shows w838537627, w545422304, w656577811, w865988158, w655090567, w842753014, w862758179. OSM ponds in the playable area (87177189, 87177192, 135465893, 135465898, 468675532, 469892287, 470030698) are in `areas`.

## 6. CV-stop landmarks

### 6.1 `lincoln-square` — UiPath Bellevue since September 2025

- **Lincoln Square North, 700 Bellevue Way NE, Suite 2000** ([UiPath offices](https://www.uipath.com/about-us/offices), fetched 2026-11-06). GeekWire (2025): product & engineering hub, two floors, 44,735 sq ft, after Plaza Center from 2018 ([GeekWire](https://www.geekwire.com/2025/uipath-hires-former-f5-executive-as-cmo-relocates-bellevue-offices-to-lincoln-square/), via search summary). Second floor unknown (suite 2000 → floor 20 + one adjacent).
- **Tower**: 126 m, 28 floors, 2005, formerly "Eddie Bauer at Lincoln Square", later mostly Microsoft ([tallest list](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington); OSM part w604028609). Footprint ≈ 53 × 43 m on the SE corner of NE 8th × Bellevue Way. Facade (photo `Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg`): blue-grey reflective glass `#7f97ad` with light-grey spandrel bands `#c8ced3`, darker recessed top floors, dark louvred crown `#5f6163`, flat roof.
- **Entrance**: OSM node 7945526075 at **47.61723, −122.20148** on the Bellevue Way NE frontage just south of NE 8th, facing west (confidence medium); a level-1 entrance from the podium/skybridge on the NE 8th side (47.61726, −122.20089). Lobby interior and UiPath signage: no open source, no exterior UiPath sign found; the modelled lobby is generic.
- **Podium** (OSM w161929514, `building=retail`, 3 levels; `bLincolnN` / `bOneLincoln` in landmarks.js): cream / tan stone piers (`#d9cba6`, bands `#e6dcc3`) with wide blue-glass bays over a grey storefront base on both street faces and the curved corner; brick piers between shopfronts; blue sidewalk canopies. The bay just south of the Bellevue Square skybridge is red-brown brick; a red-brick accent bay where the NE 8th skybridge lands (drawn on the NE 8th face, 12 m wide, estimate). Mapped OSM tenants carry their own fascias where OSM puts them (Din Tai Fung on the NE 8th face). Westin podium and its level 2–3 connector: tan stone with punched square windows (size / pitch estimated). The NE 8th face beyond these items was never compared with a panorama; poster boards beside the Cinemark sign are not drawn (no source).
- **Complex** (heights from the Wikipedia list): **One Lincoln Tower** (Westin + condos, 137 m, 42 fl, 2005; blue glass with white slab bands, "WESTIN" letters on the crown), **400 Lincoln Square** (office, 137 m, 31 fl, 2017; blue-grey glass `#6e8a9e`, silver mullions; podium of tall glazed bays), **Two Lincoln Tower** (W Bellevue + residences, 137 m, 42 fl, 2017); retail podiums north (10455 NE 8th: Cinemark Reserve, Earls, Din Tai Fung, Paddy Coyne's, Topgolf Swing Suite, The Container Store) and south (500 Bellevue Way NE: Fogo de Chão, Duke's Seafood, Wild Ginger, Japonessa, TruFusion).
- **Skybridges** (OSM; open white steel trusses with glazing, drawn with white chords, posts and diagonals): (1) over Bellevue Way NE at ~NE 7th to Bellevue Square, w43872832, ~32 m, 2007 ([Bellevue Square](https://en.wikipedia.org/wiki/Bellevue_Square)); (2) diagonally over NE 8th to Bellevue Place / Hyatt, w43872826 + building w1364249504, ~56 m, glazed pitched roof (ridge 1.2 m above the eaves, estimate) and a white curved pier on the north sidewalk (not drawn: not mapped); (3) over NE 6th St, w516915099, ~22 m.

### 6.2 `plaza-center` — UiPath Bellevue 2018 – 2025

- **10900 NE 8th St, Suite 400**; 68 m, 16 floors, 1982, briefly Bellevue's tallest ([tallest list](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington)); OSM w33725899 + office node "UI Path" (47.61778, −122.19400). North side of NE 8th between 108th and 110th; ≈ 60 × 35 m with notched corners.
- Facade (CC0 photo 2026-10-26, `Plaza_Center_Bellevue_WA.jpg`; panorama match): full-height ivory precast piers `#ddd6bf` alternating with dark bronze-charcoal glass strips `#2f3338`, ~13 bays on the long face, plain ivory parapet, small dark "PLAZA CENTER" letters; black glazed ground floor `#1a1b1d` with "10900" over the doors and a U.S. Bank branch; tall black pylon with vertical white "10900" at the west driveway. Main doors face NE 8th (≈ 47.61762, −122.19405). The panorama shows a UiPath sign over the door.

### 6.3 Other landmarks

| landmark | facts and review |
|---|---|
| Bellevue Square (front entrance n5752777692) | 1946; Macy's + Nordstrom; >200 stores; 23 M visitors/yr. Bellevue Way face: red brick with two-storey glazed bays between proud brick columns (bay rhythm 7.5 m and heights estimated; `landmark-bellevue-square.js`). The forecourt's globe lamps, bollards, beds and trees are not drawn. |
| Bellevue Towers | 137 / 131 m, 2008 (OSM swaps the two heights; Wikipedia used); podium stone + glazed retail floor, darker grey stone `#9c978e` |
| Amazon Sonic, Bellevue 600 | both 183 m, the tallest in the city; Sonic dark glass (match) |
| Bellevue Place | pink-beige precast with square windows, red-brick arched base (w33613428, `building-review-look.js`) |
| Courtyard (r8064670) | grey panel / stucco walls; "COURTYARD" letters on the NE 8th / 110th corner (a building whose own tags are a hotel takes the hotel's sign) |
| The Bravern | cream stone retail podium; Bravern 2's street face is its 22-storey part w1474780191, drawn with a cream stone base band (0.15–8.4 m, estimate) and glass above (`facade-bands.js`) |

Other unmodelled downtown towers (Key Center, towers on 108th) are drawn as glass. Not compared: Bellevue 600 (candidate poses face a garage), the Bellevue Square bridges west of Bellevue Way (w29234890, w497738385, w29234888, w30758942), Avenue Bellevue (w1222676052), the NE 10th / 6th / 4th overpasses of I-405.

## 7. Buildings

All in `buildings[]` with footprints. Heights: Wikipedia/SkyscraperCenter where listed, else OSM `height`, else `building:levels` × 3.9 m (offices/towers) / 3.2 m, else a rule estimate (`estimateBasis`); unnamed `building:part`s are attributed to the containing outline (`partOf`). 39 of 78 downtown buildings within 40 m of the routes have OSM height/levels. Sourced heights of the main towers: Bellevue 600 183 m; Amazon Sonic (555 108th Ave NE, w1214424283) 183 m; 400 Lincoln Square, One / Two Lincoln Tower, Bellevue Towers South 137 m; Bellevue Towers North 131 m; Lincoln Square North 126 m; City Center Bellevue 109 m; City Center Plaza 102 m; Symetra Center 99 m; Skyline Tower 97 m; Tower 333 83 m; Bank of America Tower (Bellevue Place) 82 m; One Bellevue Center 79 m; 929 Office Tower 76 m; Plaza Center 68 m; Paccar Tower 52 m.

## 8. Businesses

Live OSM (2026-11-12): 494 named shops / amenities / offices in the bbox; inside the playable geometry every food / bank / shop / hotel POI is in the game, except indoor level-2 units (Topgolf Swing Suite n11214249972, Par One n11214249971), Lucky Strike (n4188521492, `leisure=amusement_arcade`), Pure Barre (n3883822560), financial-advisor offices (TD Ameritrade n4190985796, Wells Fargo Advisors n4190985798) and The Ruby Room (n5608446843). Documented exclusions: Starbucks n471973082 (not in the official locator; the corner unit at 110th Ave NE carries a CoCo sign) and Microsoft Store n7658557693 (the Bravern frontage shows a Microsoft office sign). Route B (Bellevue Way) is the densest retail strip: restaurants and shops (Cheesecake Factory, Shake Shack, Din Tai Fung, Earls, Starbucks); NE 8th is banks and offices. Full lists: `businesses[]` and `businesses-seattle-bellevue.md`.

- **Arco** w425947102 (`building=roof`, `amenity=fuel`): blue fascia over two pump islands; no canopy record in the pack (POI only); no pylon (a small pole sign). Its nearest edge is NE 8th St just past the map edge, so `nav.compute` ends routes on the next reachable edge, 6.5 m away.
- No mapped business lies within 15 m of the 11 pedestrian ways / named footways, so the pedestrian-front sign rule has nothing to sign here.

## 9. Transit

- **2 Line** (Sound Transit Link): Lynnwood–Seattle–Mercer Island–Bellevue–Redmond, full line opened 28 March 2026; I-90 centre roadway, Mercer Island station in the median, South Bellevue station on Bellevue Way SE, Bellevue Downtown station at 110th / NE 6th (n7744630735), elevated over I-405 to Wilburton station above NE 8th ([2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit))). Trains: white Siemens LRVs, blue lower band, teal wave graphics, 2–4 cars.
- **Guideway** (`game/src/bellevue-guideway.js`): OSM bridge ways w669516620 / w1154876472 (layer 2), crossovers w762965202 / w762965203, station tracks w614517901 / w669516619 (layer 1, drawn as the guideway class; the station lies outside the district). Streets crossed: 112th Ave NE (13 m along the first track), I-405 and ramps (141–221 m), 116th Ave NE (414 m), NE 8th St (683–696 m); at grade again at 1,144 m. Single-column hammerhead piers and box deck (panorama match); the I-405 span's girders and soffit are sage green `#7f9a83` between the piers either side of I-405 (129–232 m; span ends estimated), parapets concrete. Tracks spread to 9.3 m round Wilburton share one deck below 14 m. Overhead line: contact and messenger wires, pole with cross arm every 55 m (`guideway-ocs.js`, estimates).
- **Ground and rail level**: USGS 3DEP (epqs.nationalmap.gov, 2026-11-12), every 50 m along the track (m): 35.6, 33.2, 30.5, 30.2, 30.4, 28.3, 28.4, 29.2, 31.1, 34.1, 36.9, 38.5, 42.6, 44.3, 44.3, 44.8, 45.1, 45.0, 43.4, 44.2, 43.6, 43.8, 44.9, 46.5; west of the bridge 41.2 / 39.4; NE 8th at the crossing 44.3. **Rail level is an estimate** (no published profile; sources give only an 810 ft long-span bridge over I-405 and an elevated station above NE 8th): 42.1 m at the west end (5 m clearance + 1.5 m structure over 112th), 51.3 m over NE 8th (5 m + 2 m), held 150 m for the platform, straight grades between. Drawn deck height over the flat game ground: 6.5 m at 112th, up to 17.7 m over the I-405 valley, 7 m at NE 8th. Girder 2.2 m, deck half-width 2.6 m, piers every 34 m (one of 27 left out where a scenery carriageway passes under): estimates.
- **Wilburton station**: island platform w922284294 at deck level, roof outline w615292866 on one row of columns, lifts n11812430045 / n11812430046 as shafts from the street (the pack's 7.8 m block for the `building=train_station` roof is left out). Estimates: platform 0.36 m above the rail, roof 4.2 m clear and 0.5 m deep, columns every 12 m, shafts 2.4 m. Stairs (w1273554471-73, w1274300267) and the station's look were not compared with a panorama. No trains run (no light-rail service in the game).
- **Buses** (OSM route relations): King County Metro 111, 218, 226, 240, 246, 249, 556, 630, Trailhead Direct 636/643, **RapidRide B Line** (red `#96172E` / yellow) on NE 8th / 112th; Sound Transit Express 532, 535, 560, 566 on I-405.

## 10. Car parks and monuments

- **Car parks** (`car-parks.js`, open decks on the OSM footprint and height): West Parking Garage w30758875 (4 levels), Southeast w34040306 (2), Northeast w161929522 (6), w104581576 (4). w450055216 (47.6134, −122.1843): an open rooftop deck with planters and trellises over the REI store podium, deck edge one storey up behind a glass railing from the south; 3 levels from the pack's 10 m height is an estimate (OSM has no levels; the panoramas were taken on the roof).
- **Monuments** (`monuments.js`): 11 placed as generic class objects (Mahatma Gandhi statue n1704038437, Guan Yin, Double Inquiry, Heronious One, #BVUE, unnamed sculptures; no likenesses). Murals and untyped artworks stay markers. Skipped by the footprint test: Root n11862631648 (in water), Story Pole VI n12554043199 (on a carriageway). Forest Deity n7205021680 (Dudley C. Carter, 1947) lies outside the playable area.

## 11. Congestion hotspots (feeds `CITIES.seattle.districts.bellevue.congestion`)

| id | where | local hours (weekday) | level | evidence |
|---|---|---|---|---|
| `i405-nb-downtown` | I-405 NB SE 8th → NE 8th (47.6000, −122.1810, r 900 m) | 06:30–09:30, 15:00–19:00 | 0.85 | corridor congested up to 15 h/day, 192,000 ADT at NE 8th/NE 4th ([WSDOT CSS](https://appstest.wsdot.wa.gov/sites/default/files/2021-10/CSS504-i405-i5JctTukwila-BellevueCityCenter.pdf)); Bellevue→Everett severe at 16:25 on 70% of 2024 weekdays ([WSDOT dashboard I-405](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm)); ETL work zone to 2027 |
| `i405-sb-downtown` | opposite carriageway | 15:00–19:00 | 0.9 | Bellevue→Tukwila ~17:00 < 36 mph on up to 97% of days (2014); Everett→Bellevue 07:30 severe 73% (2024) |
| `i90-wb-bridge` | WB Hadley bridge | 07:30–09:30, 15:30–18:30 | 0.8 | Bellevue→Seattle severe at 08:25 on 54.8% and at 16:35 on 84.6% of 2024 weekdays ([WSDOT dashboard I-90](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate90-cps/severe-congestion.htm)) |
| `i90-eb-bridge` | EB | 16:30–18:00 | 0.35 | Seattle→Bellevue severe at 17:10 on only 20.9% |
| `ne8th-112th` | NE 8th × 112th Ave NE / I-405 ramps | 16:00–18:30 | 0.75 | PM-peak v/c 1.00 (2018), forecast 1.31 ([Bellevue MIP vol.2 App. B](https://bellevuewa.gov/sites/default/files/media/pdf_document/2022/Bellevue-MIP-report-vol2.pdf)) |
| `bellevueway-main` | Bellevue Way × Main St | 16:00–18:30 | 0.6 | PM v/c 0.93 (2019) (MIP) |
| `bellevueway-se-to-i90` | Bellevue Way SE southbound to I-90 | 15:30–18:30 | 0.55 | 2019 PM 2.38 min SB vs 1.82 NB (MIP App. A) |
| `bellevue-square-weekend` | Bellevue Way at the Bellevue Collection garages | Sat/Sun 12–18, Nov–Dec | 0.5 | retail peak (23 M visitors/yr); **estimate** |

Other downtown PM v/c (MIP 2019): Bellevue Way × NE 8th 0.66, × NE 4th 0.59, × NE 12th 0.71; 108th × NE 8th 0.66, × NE 4th 0.79; 100th × NE 8th 0.80; 112th × Main 0.98. Seattle: 7th most congested US city in TomTom 2025, peak ≈ 17:00 ([TomTom](https://www.tomtom.com/traffic-index/seattle-traffic/)). Speed limits: I-90 and I-405 60 mph, downtown arterials 30 mph (OSM `maxspeed`), residential 20–25 mph.

## 12. Colour palette (sRGB)

| item | hex | note |
|---|---|---|
| freeway concrete dry / wet | `#8e8f8a` / `#5f615e` | I-90, I-405 mostly PCC concrete (OSM `surface=concrete`) |
| arterial asphalt dry / wet | `#3d3f42` / `#26282b` | downtown streets |
| lane white / edge yellow | `#e9e9e4` / `#e1b12c` | |
| parapet concrete / weathered face | `#a7a59e` / `#3a3a38` | floating bridges |
| Murrow arches | `#c9c0ae` | photo `#b8a68b` in warm sun |
| tunnel portal concrete | `#bdb9ae` | |
| guide-sign green / gantry steel | `#006b3f` / `#a3a6a7` | |
| sidewalk / kerb concrete | `#bdb8ae` / `#a9a49a` | |
| Lake Washington overcast / clear | `#5d6d72` / `#3e6787` | |
| Lincoln Sq North glass / spandrel / crown | `#7f97ad` / `#c8ced3` / `#5f6163` | photo |
| Plaza Center piers / glass / podium | `#ddd6bf` / `#2f3338` / `#1a1b1d` | photo 2026 |
| Bellevue Towers glass | `#7a96a8` | estimate |
| 2 Line I-405 span girders | `#7f9a83` | panorama |
| trail railing / OCS steel | `#2e3133` / `#4e5459` | photo 2026 |
| conifer / winter lawn | `#2f4a32` / `#4f6b35` | |

Photo-derived values are medians of hand-picked regions. Facades of 400 Lincoln Square, Two Lincoln Tower, Bellevue Towers and Bellevue Square are estimated from photos with lower confidence; 19 more vetted Commons candidates (listed in `refs/bellevue/LICENSES.md`) could not be fetched (HTTP 429) and would allow re-sampling.

## 13. What a local would notice if wrong

1. EB traffic leaves the old twin arched portals ("SEATTLE PORTAL TO THE PACIFIC"), two 2-lane bores, HOV in the north bore; the big round 1989 bore is westbound.
2. You drive through the cream concrete arches of the Murrow high-rise at both ends; the floating section is almost at water level, no piers, no towers, no sidewalk; walkers and cyclists use the Hadley's north edge; 2 Line trains under catenary run between you and the WB lanes.
3. Each I-90 direction: 4 lanes, HOV diamond lane on the left; yellow left / white right edge lines; 10/30 ft dashes with RPMs; a wider dashed line for the HOV lane; light grey jointed concrete pavement.
4. Mercer Island: an ~800 m lit lid tunnel with a park on top; Douglas-fir on the freeway cuts.
5. Downtown towers half-left from the bridge; Amazon Sonic and Bellevue 600 the tallest.
6. Numbered exits (6, 7A, 7B, 8, 9, 10A, 12, 13A/13B) with yellow "EXIT ONLY" panels; the I-405 connection is a long single-lane flyover; never the left lane at NE 6th (HOV/bus "Texas T"); 13B splits "NE 8th St East" / "West".
7. NE 8th is wide (3–4 lanes each way) with a narrow raised median with yellow noses; signals on mast arms, one head per lane, bordered backplates, green name blade.
8. Pale concrete sidewalks scored in 2 ft squares behind tree planters; deciduous street trees (orange/red in November).
9. Covered white-truss glass skybridges over Bellevue Way and NE 8th at Lincoln Square.
10. Plaza Center: vertical ivory stripes + dark glass, the "10900" pylon. Lincoln Square North: blue-grey glass with light bands at the NE 8th × Bellevue Way corner; One Lincoln Tower beside it with "WESTIN" on top. Bellevue Square: long, low red-brick mall across Bellevue Way.
11. Ground floors on Bellevue Way are restaurants / retail; NE 8th is banks (Chase, U.S. Bank in Plaza Center, Umpqua, Schwab, Fidelity; BECU / HSBC on Bellevue Way).
12. Speed limit signs (black on white R2-1): 60 mph on I-90/I-405, 30 mph downtown.
13. Weekday 4–6 pm: westbound I-90 crawls while eastbound flows; I-405 through downtown jammed both ways; ETL work-zone barrels on I-405 near I-90 until 2027.

## 14. Open questions and estimates still standing

- **Pedestrian plazas** (r3-look-14, 2026-11-13): a mapped pedestrian area (`highway=pedestrian|footway` + `area=yes`,
  `area:highway`, `place=square`; `pedestrian-plazas.js`) is drawn paved over its whole polygon unless its OSM `surface` is
  grass (no surface tag counts as paved); mapped grass / park polygons inside stay. Rule as in `bucharest-romana.md`
  section 8; not compared with a panorama. Here: 18 plazas, none tagged grass.
- Lincoln Square: lobby and UiPath signage, the second UiPath floor, the NE 8th podium face beyond the reviewed items (§6.1).
- NE 8th St bridge over I-405: the north sidewalk (mapped, footway w67144854) needs a wider deck and the parapet moved out; the overhead gantry's text is not legible; the cut slopes need ground heights (§5).
- Street trees in the towers' shadows on NE 8th / Bellevue Way (§5).
- Wilburton station look and stairs; the 2 Line rail level (§9).
- Tunnel interior and floating-bridge parapet heights / deck freeboard come from photos only (no WSDOT drawing retrieved).
- Menu: `bel-lincoln-square` is not in `MENU_ORDER` (`game/src/spot-availability.js`), so places.json does not list it; offering it is the owner's decision.

## 15. Sources and method

- OpenStreetMap (ODbL), API 0.6 extracts 2026-11-06 and live Overpass 2026-11-12/13 — <https://www.openstreetmap.org>
- Wikipedia: [Lacey V. Murrow Memorial Bridge](https://en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge), [Homer M. Hadley Memorial Bridge](https://en.wikipedia.org/wiki/Homer_M._Hadley_Memorial_Bridge), [Mount Baker Tunnel](https://en.wikipedia.org/wiki/Mount_Baker_Tunnel), [I-90 in Washington](https://en.wikipedia.org/wiki/Interstate_90_in_Washington), [I-405](https://en.wikipedia.org/wiki/Interstate_405_(Washington)), [2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit)), [Tallest buildings in Bellevue](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington), [Bellevue Square](https://en.wikipedia.org/wiki/Bellevue_Square), [Bellevue Towers](https://en.wikipedia.org/wiki/Bellevue_Towers), [Downtown Bellevue](https://en.wikipedia.org/wiki/Downtown_Bellevue)
- WSDOT Standard Plans [M-20.10-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.10-04_e.pdf), [M-20.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.20-02_e.pdf), [M-20.30-05](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.30-05_e.pdf), [M-20.40-03](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.40-03_e.pdf), [M-24.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.20-02_e.pdf), [M-24.40-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.40-02_e.pdf), [M-24.60-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.60-04_e.pdf); [Traffic Manual ch.3](https://wsdot.wa.gov/publications/manuals/fulltext/M51-02/Chapter3.pdf)
- MUTCD 2009 [Part 3A](https://mutcd.fhwa.dot.gov/htm/2009r1r2r3/part3/part3a.htm), [Part 3D](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm)
- WSDOT Multimodal Mobility Dashboard [I-405](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm), [I-90](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate90-cps/severe-congestion.htm); [I-405 corridor sketch CSS504](https://appstest.wsdot.wa.gov/sites/default/files/2021-10/CSS504-i405-i5JctTukwila-BellevueCityCenter.pdf); [Renton–Bellevue ETL project](https://wsdot.wa.gov/construction-planning/search-projects/i-405renton-bellevue-widening-and-express-toll-lanes-project); [I-405/SR 167 newsletter 2026-10-13](https://content.govdelivery.com/accounts/WADOT/bulletins/42f0f84)
- City of Bellevue: [Transportation Design Manual 2024](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf), [Mobility Implementation Plan vol.2](https://bellevuewa.gov/sites/default/files/media/pdf_document/2022/Bellevue-MIP-report-vol2.pdf)
- [UiPath offices](https://www.uipath.com/about-us/offices); [GeekWire 2025](https://www.geekwire.com/2025/uipath-hires-former-f5-executive-as-cmo-relocates-bellevue-offices-to-lincoln-square/) (host blocked from the sandbox; via search summary); [UiPath 2018 press release](https://ir.uipath.com/news/detail/134/uipath-opens-first-u-s-development-center-in-bellevue-wash)
- [TomTom Traffic Index Seattle](https://www.tomtom.com/traffic-index/seattle-traffic/); [The Columbian 2024 on WSDOT RPMs](https://columbian.com/news/2024/oct/28/why-dont-many-wa-highways-have-reflectors-if-the-state-gets-so-much-rain-we-asked-wsdot)
- USGS 3DEP elevation (epqs.nationalmap.gov); Esri World Imagery (tree crowns read by eye, imagery not kept)
- Wikimedia Commons photos — [refs/bellevue/LICENSES.md](refs/bellevue/LICENSES.md)

Method (the scripts lived in the research scratchpad, not shipped): OSM `/api/0.6/map` tiles (≤ 0.02° squares, ≥ 1.5 s apart) → parser → Dijkstra router over drivable ways (oneway-aware, HOV-only links excluded) → extractor (route segments, buildings within 70 m or ≥ 25 m tall, POIs within 60 m, furniture) → curated overlay → `seattle-bellevue.json`. Photo colours: median RGB of hand-picked rectangles. Wikimedia API calls rate-limited, honouring `Retry-After`.
