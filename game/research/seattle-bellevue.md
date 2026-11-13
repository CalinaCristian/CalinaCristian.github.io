# Seattle · `bellevue` district — field research dossier

Role **research-sea-districts** · generated 2026-11-06 · machine-readable twin: [`seattle-bellevue.json`](seattle-bellevue.json) · photos: [`refs/bellevue/`](refs/bellevue/LICENSES.md)

Scope (spec 10): the finale drive — I-90 eastbound out of the **Mount Baker Ridge Tunnel**, across Lake Washington on the **Lacey V. Murrow floating bridge**, under the **Mercer Island lids**, over the **East Channel Bridge**, up **I-405** into **downtown Bellevue** (NE 8th St, Bellevue Way, 108th Ave NE, Lincoln Square, Bellevue Square), ending at UiPath's office: **Plaza Center, 10900 NE 8th St** (2018 – Sept 2025) or **Lincoln Square North, 700 Bellevue Way NE** (since Sept 2025).

How to read the JSON: `chapterRoutes[].segments` is every OSM way in driving order with lanes / `hov:lanes` / `turn:lanes` / `destination:lanes` / surface / bridge / tunnel / layer; `streets[]` = curated corridor stretches + a catalogue of every downtown street; `buildings[]` = every building within 70 m of a route or ≥ 25 m tall in the core (OSM footprint, parts, height, curated facade hex); `landmarks[]` holds the two CV stops (`lincoln-square`, `plaza-center`); `traffic.hotspots` maps 1:1 onto `CITIES.seattle.districts.bellevue.congestion`. All OSM data © OpenStreetMap contributors (ODbL).

---

## 1. District boundary and chapter routes

**Proposal: a corridor district, not a 1 km square** (the lake crossing *is* the chapter): 250 m either side of I-90 from the tunnel lid (lon −122.3030) to the I-90/I-405 stack (−122.1820); 200 m either side of I-405 from I-90 to NE 10th; the **downtown core box Main St → NE 12th × 100th Ave NE → I-405** (= the official downtown boundary, ~160 ha, [Downtown Bellevue](https://en.wikipedia.org/wiki/Downtown_Bellevue)); for route B a 120 m band on Bellevue Way SE. Lake surface to the horizon as a non-drivable plane. Polygons/centrelines in `district.corridorPolygons`.

End-of-map ideas that look real: inside the WB tunnel (fade to dark + barricade), the I-405 work zone (the Renton–Bellevue express-toll-lane project is genuinely under construction until **summer 2027** — [WSDOT](https://wsdot.wa.gov/construction-planning/search-projects/i-405renton-bellevue-widening-and-express-toll-lanes-project)), Mercer Island off-ramps ending at the signal with a Type III barricade.

| route | path | length | notes |
|---|---|---|---|
| **A (recommended, spec-literal)** | start inside the south 1940 tunnel bore, 150 m before the east portal (47.58993, −122.29050, heading 90°, way 481403971) → Murrow bridge → Mercer Island → East Channel Bridge → exit **10A "405 N Everett"** flyover → I-405 NB → exit **13B "NE 8th St"** → "NE 8th St West" ramp → NE 8th WB → stop at Plaza Center (47.61744, −122.19400) | **14.39 km** | ≈ 9.5 min off-peak. Exceeds the spec-10 limit (≤ 12 km). To fit: start just past the Murrow west high-rise (s ≈ 2.0 km) — but the tunnel-portal reveal is the best moment of the drive; recommend accepting 14.4 km for the finale. |
| B (scenic alt.) | same start → exit **9 Bellevue Way** → Bellevue Way SE (Enatai, Mercer Slough, South Bellevue station) → Bellevue Way NE past Downtown Park, Bellevue Square, the Lincoln Square skybridge → right on NE 8th → Plaza Center (south kerb) | **13.22 km** | ≈ 13 min; every downtown hero landmark at street level; can end at Lincoln Square instead. |

Route A in driving order (OSM ways in JSON; s = distance from start):

| s (m) | length | stretch |
|---|---|---|
| 0 | 215 | I-90 EB inside the Mount Baker Ridge Tunnel (south 1940 bore, 2 lanes) → east portal |
| 215 | 2,473 | **Lacey V. Murrow Memorial Bridge** (west high-rise arch, floating section, east high-rise arch) |
| 2,688 | 4,160 | I-90 across Mercer Island (First Hill lid tunnel 788 m, short lid undercrossings, Mercer Island station in the median) |
| 6,847 | 680 | **East Channel Bridge** |
| 7,526 | 545 | I-90 Enatai/Mercer Slough approach (5–6 lanes) |
| 8,071 | 1,681 | exit 10A ramps: 2 → 3 lanes, split "Everett" / "Renton", single-lane flyover onto I-405 NB |
| 9,752 | 2,727 | **I-405 NB** (5 lanes, exit 12 SE 8th, 4 lanes, 5 at the exit-13 auxiliary lane) |
| 12,479 | 1,398 | exit 13 → 13B "NE 8th St" → "NE 8th St West" loop |
| 13,877 | 513 | **NE 8th St WB** to Plaza Center |

---

## 2. Freeway road design, segment by segment

### 2.1 Mount Baker Ridge Tunnel (EB)
- Three tubes: the **twin 1940 bores** (each 29 ft / 8.8 m Ø, interiors squared off in the 1989–93 rehab except the arched portals) now carry **eastbound** traffic; the **1989 bore** (63 ft / 19 m Ø — world's largest-diameter soft-ground tunnel) carries westbound on the upper deck, the former reversible roadway (now light rail) on the lower deck and the I-90 Trail on top. Official length 1,440 ft (440 m) but ~1 km perceived because of the 2,000 ft cut-and-cover lid to the west ([Mount Baker Tunnel](https://en.wikipedia.org/wiki/Mount_Baker_Tunnel)).
- OSM lanes: 4 EB lanes west of the bores (lane 1 = HOV 2+), splitting at lon −122.2986 into **north bore: HOV + GP** (way 123889282, `hov:lanes=designated|`) and **south bore: 2 GP** (98733141 / 481403971); both 60 mph, concrete ([OSM](https://www.openstreetmap.org/way/481403971)).
- East portals: 1940 arched concrete portals with the carved band **"SEATTLE · PORTAL TO THE PACIFIC"** and relief murals ("Portal of the North Pacific", James FitzGerald) — City of Seattle landmark together with the Murrow bridge ([Wikipedia](https://en.wikipedia.org/wiki/Mount_Baker_Tunnel); photo `refs/bellevue/Seattle_-_Portal_to_the_Pacific_01.jpg`). Inside the bore the photo shows warm tan/terracotta wall tone under the lights.

### 2.2 Lacey V. Murrow Memorial Bridge (EB) — and the Hadley bridge beside it
- **4 EB lanes** (HOV + 3 GP), 6,620 ft / 2,020 m, 2nd-longest floating bridge in the world; opened 1940, sank 25 Nov 1990 during rehab, reopened 12 Sep 1993; boats pass only under the elevated fixed spans at each end (29 ft clearance) ([Murrow](https://en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge)).
- **High-rise arches**: at both ends the EB lanes drive *through* cream concrete arches whose ribs fuse into a flattened oval crown ring with oval holes, ~8 dark steel hangers per side per arch (photos `I-90_headed_east_from_Seattle_-_west_high-rise.jpg`, `…east_high-rise.jpg`). Colour ≈ `#c9c0ae` (sunlit photo median `#b8a68b`).
- **Floating section**: deck ~2–3 m over the water, concrete pontoons, steel finger expansion joints at pontoon joints; low concrete safety-shape parapets both sides (outer face weathered dark `#3a3a38`); **no sidewalk on the Murrow**. Deck concrete `#8e8f8a` dry / `#5f615e` wet.
- **Hadley bridge** (WB, 5,811 ft, 1989): 4 WB lanes, the **I-90 Trail** on its north edge (black steel picket railing on a concrete parapet), and since **28 March 2026** the **2 Line light rail** on the former express roadway in the middle — the world's first light rail on a floating bridge, overhead catenary on dark steel portal frames ([Hadley](https://en.wikipedia.org/wiki/Homer_M._Hadley_Memorial_Bridge), [2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit)); photo `Light_rail_on_a_floating_bridge_2_.jpg`, 2026-03-28). Pontoons 105 ft (32 m) wide.
- Exit 6 West Mercer Way leaves from the right lane at the east end (`destination:lanes none|none|none|none;West Mercer Way`).

### 2.3 Mercer Island
- 4 EB lanes (HOV + 3 GP) throughout; exits **7A 77th Ave SE**, **7B Island Crest Way**, **8 East Mercer Way** (right); HOV/bus-only direct ramp to Island Crest Way from the left lane ([OSM](https://www.openstreetmap.org/way/4744334)).
- EB passes 788 m under the **"I-90 First Hill Lid"** (lit tunnel, OSM `tunnel:name`) beneath Aubrey Davis Park, then several 40–50 m lid undercrossings; tall retaining and noise walls (OSM `wall=noise_barrier`) and conifer slopes. "Mercer Island Lid, a landscaped park built atop a curved section of the freeway" and the **Mercer Island station in the freeway median** ([I-90 in Washington](https://en.wikipedia.org/wiki/Interstate_90_in_Washington)).

### 2.4 East Channel Bridge → I-405
- 4 → 5 → 6 lanes; on the bridge the left HOV lane is signed for the **HOV direct ramp to I-405** ("Everett; Renton") and an HOV-only slip to Bellevue Way; lane 5 is **exit 9 Bellevue Way** (OSM `destination:lanes Everett;Renton;none|none|none|none|none;Bellevue Way`).
- Exit 10 split (way 621378267): lanes 4–5 exit, lane 4 "Factoria Blvd; Everett", lane 5 "Renton"; ramp 2 → 3 lanes → split → 1-lane flyover (layer 2) onto I-405 NB. I-90 widens to **16 lanes** with C-D roads at the stack ([I-90 in Washington](https://en.wikipedia.org/wiki/Interstate_90_in_Washington)).

### 2.5 I-405 NB to downtown
- 5 lanes (HOV 2+ left + 4 GP) → 4 after exit 12 SE 8th St → 5 with the exit-13 auxiliary lane; destination:lanes at the split `none|none|Seattle|Redmond;NE 4th St|NE 8th St` ([OSM](https://www.openstreetmap.org/way/736892510)). 60 mph. "Widens to ten lanes… NE 4th diamond, NE 6th HOV-only Texas-T to the Bellevue Transit Center under the 2 Line guideway, NE 8th cloverleaf… four HOT lanes begin at NE 6th" ([I-405](https://en.wikipedia.org/wiki/Interstate_405_(Washington))).
- **Do not route the player into the left lane at NE 6th** — that ramp is HOV/bus only.
- Nov 2026 reality: Renton–Bellevue ETL construction south of downtown (orange barrels, temporary concrete barrier, work-zone signs); WSDOT closed all NB lanes in Bellevue 16–19 Oct 2026 ([WSDOT newsletter](https://content.govdelivery.com/accounts/WADOT/bulletins/42f0f84)).
- Exit 13: 13A (left) "NE 4th St — Meydenbauer Center / Bellevue Square / Bellevue Arts Museum", 13B (right) "NE 8th St" → "NE 8th St East" / "NE 8th St West" ([OSM](https://www.openstreetmap.org/way/531674824)).

---

## 3. US / WSDOT markings — exact spec (fixes "all the roads and markings in US are so broken")

| element | spec | source |
|---|---|---|
| lane line | white, **4 in** (10 cm), **10 ft dash / 30 ft gap** (3.05 / 9.14 m) | [WSDOT M-20.10-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.10-04_e.pdf) |
| wide broken lane line (HOV ↔ GP) | white **8 in**, 10/30 ft | M-20.10; [MUTCD 3D.02](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm) |
| dotted lane line (lane drops, aux lanes) | 4 in (wide 8 in), **3 ft / 9 ft** | M-20.10 sheet 2 |
| dotted extension (gores, ramp continuations) | 4 in 2 ft / 6 ft; wide 8 in 6 ft / 6 ft | M-20.10 sheet 2 |
| edge lines | **right = solid white, left = solid yellow** on every one-way roadway (each freeway carriageway, each one-way couplet) | M-20.10 note 2 |
| double centreline | yellow 4 in lines, **12 in apart on state routes**, 4 in apart at left-turn channelisation/narrow roads and allowed on local streets | M-20.10 note 3 |
| barrier line | yellow 18 in | M-20.10 |
| line material | profiled plastic (bumps every ~2 ft) / embossed plastic on freeways → textured, glossy-when-wet look | [M-20.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.20-02_e.pdf) |
| raised pavement markers | **Type 2W** (white, one-sided) centred in every lane-line gap at **80 ft** (40 ft on curves R < 1,500 ft); **Type 2Y** yellow just outside the left edge line every 80 ft; 2YY on two-way centrelines | [M-20.30-05](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.30-05_e.pdf) |
| Botts' dots | western WA historically uses non-reflective ceramic buttons to *simulate* lane lines; WSDOT still uses RPMs "in select locations" and MMA bumps | [WSDOT Traffic Manual ch.3](https://wsdot.wa.gov/publications/manuals/fulltext/M51-02/Chapter3.pdf), [Columbian 2024](https://columbian.com/news/2024/oct/28/why-dont-many-wa-highways-have-reflectors-if-the-state-gets-so-much-rain-we-asked-wsdot) |
| HOV diamond | white outline, ≥ 2.5 ft × 12 ft, lines ≥ 6 in, in the centre of the HOV lane; freeway spacing up to ~1,000 ft and at every decision point | [MUTCD 3D.01](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm) |
| arrows | high-speed Type 1/2/5 arrows (~16–23 ft) on ramps; 8 ft arrows on ≤ 40 mph arterials | [M-24.20](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.20-02_e.pdf), [M-24.40](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.40-02_e.pdf) |
| gores / crosshatch | white chevrons **12 in** wide at ≥ 45 mph (8 in ≤ 40 mph) inside wide solid channelising lines | [M-24.60](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.60-04_e.pdf) |
| stop line | white solid, 1 ft 6 in typical | M-24.60 |

Rendering rules that follow: never paint a yellow line between two same-direction lanes; never a double yellow on a freeway; the **left** edge of every freeway carriageway is **yellow**; lane lines stop at the gore and continue as dotted extension lines across ramp mouths; HOV lane separated by a *wider* white broken line plus diamonds. Photos from the floating bridge show exactly this: yellow left edge line, white 10/30 dashes with RPMs between them (`I-90_headed_east…` refs).

---

## 4. Guide signs (green, white legend, FHWA Series E(M)/Clearview, retroreflective)

From OSM `destination:*` tags (mapped from the real signs) along route A — full list in `signs[]`:

1. I-90 EB tunnel: lane destination **"Spokane"** (EAST I-90); Seattle-side gantries over the lid (OSM gantries 1493489126, 1493491355).
2. Murrow east end: **EXIT 6 — West Mercer Way** (lane 4 exit only).
3. Mercer Island: **HOV ONLY — Island Crest Way** (left, diamond), **EXIT 7A 77th Ave SE**, **EXIT 7B Island Crest Way**, **EXIT 8 East Mercer Way**. WB side photographed: **"Mercer Island NEXT 2 EXITS"**.
4. East Channel Bridge gantry: HOV lane **"405 NORTH Everett / 405 SOUTH Renton"**; right lane **"EXIT 9 Bellevue Way"** EXIT ONLY (yellow panel).
5. Before the stack: **"EXIT 10 — 405 NORTH Everett"** / **"405 SOUTH Renton"**, **"Factoria Blvd"**.
6. I-405 NB: **EXIT 12 — SE 8th St / 116th Ave SE**; **"405 NORTH — 520 Seattle / Redmond"** (lanes 3–4); **"EXIT 13 — NE 4th St / NE 8th St"** EXIT ONLY; left **"HOV — NE 6th St"**.
7. Exit 13 split: **13A "NE 4th St — Meydenbauer Center, Bellevue Square, Bellevue Arts Museum"**, **13B "NE 8th St"** → **"NE 8th St East" / "NE 8th St West"**.
8. Downtown: street-name blades on every signal mast arm (white on green), far right of the arm ([Bellevue TDM 4.1.6](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf)).

Sign gantries are galvanised steel box trusses (OSM `man_made=gantry`, positions in `furniture.osm.signGantries`).

---

## 5. Downtown Bellevue streetscape

- **NE 8th St** (principal arterial, 30 mph): two one-way carriageways 11–14 m apart centre-to-centre → 3–4 lanes each way incl. left pockets (`left|||right` WB at 106th/108th), narrow raised median whose **kerb noses are painted yellow** (Plaza Center photo). Signals at 112th, 110th, 108th, 106th, Bellevue Way.
- **Bellevue Way NE**: split carriageways 9.7–12.3 m apart, 2–3 lanes each way + left pockets; Bellevue Square (west) and Lincoln Square (east); skybridge over the road at ~NE 7th.
- **108th Ave NE**: office spine, bike lanes both sides (some separated), mostly 1 lane each way + turn lane.
- **NE 6th St** between 108th and 110th = Bellevue Transit Center bus street with **diagonal scramble crossing** — no private cars.
- **Sidewalks** (all downtown): concrete per Bellevue detail DT-120-1, **2 ft × 2 ft scored squares, light broom finish**, separated from the kerb by **≥ 5 ft planters / tree pits**, 12-in step-off strip where parking exists; 6-in vertical concrete kerb + gutter ([Bellevue Transportation Design Manual, May 2024 §3](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf)).
- **Signals**: Bellevue standard Type II/III **mast-arm poles**, one 12-in 3-section head per lane mounted on the arm (WSDOT J-75.20 Type M), **backplates with retroreflective border**, emergency pre-emption sensor on each arm, terminal cabinet facing away from the intersection, street-name sign on each arm (same source §4.1).
- **Lights**: freeway — single bent-arm/davit LED heads on the median/parapet (OSM `lamp_mount=bent_mast` ×74); downtown — roadway poles with LED fixtures; pedestrian-scale poles in Old Bellevue (Main St, `lit=yes` on 34 ways).
- **Trees**: OSM maps 1,132 trees in the core (488 broadleaved, 30 needleleaved, 367 `denotation=avenue`), densest on Main St (112), NE 12th (80), 108th (64), NE 4th (52) — but **NE 8th (4) and Bellevue Way (17) are under-mapped**: photos show continuous street trees (autumn orange/red maples in the Plaza Center photo). Positions in `trees.osmTrees`.
- **Furniture counts in the core (OSM)**: 1,403 kerb nodes, 867 crossings (230 signalised), 331 benches, 101 bins, 60 bus stops, 49 fire hydrants, 45 artworks, 113 garage entrances.

---

## 6. Hero landmarks (CV stops)

### 6.1 `lincoln-square` — UiPath Bellevue since September 2025
- **UiPath's office: Lincoln Square North, 700 Bellevue Way NE, Suite 2000** (UiPath's own offices page, fetched 2026-11-06 — [uipath.com/about-us/offices](https://www.uipath.com/about-us/offices)). GeekWire (2025): UiPath relocated its Bellevue office to Lincoln Square as its **product & engineering hub, two floors, 44,735 sq ft**, having opened at Plaza Center in 2018 ([GeekWire](https://www.geekwire.com/2025/uipath-hires-former-f5-executive-as-cmo-relocates-bellevue-offices-to-lincoln-square/) — host blocked from this sandbox, quoted via search summary).
- Tower: **Lincoln Square North office tower**, **412 ft / 126 m, 28 floors, 2005**, formerly "Eddie Bauer at Lincoln Square", later mostly Microsoft ([tallest buildings list](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington); OSM part 604028609 height 126). Footprint ≈ 53 × 43 m on the **SE corner of NE 8th × Bellevue Way**.
- Facade (photo `Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg`): blue-grey reflective glass `#7f97ad` with alternating light-grey spandrel bands `#c8ced3` (ribbon-window look), darker recessed top floors and a dark louvred crown `#5f6163`, flat roof.
- **Entrance used by staff**: OSM entrance node 7945526075 at **47.61723, −122.20148**, on the **Bellevue Way NE frontage just south of NE 8th, facing west** (address = Bellevue Way; confidence medium). Second level-1 entrance from the podium/skybridge on the NE 8th side (47.61726, −122.20089). Lobby interior and any UiPath signage: **not documented in open sources** — no exterior UiPath sign found.
- Complex massing (all OSM-mapped, heights from the Wikipedia list): **One Lincoln Tower** (Westin Bellevue + condos, 450 ft/137 m, 42 fl, 2005; green-grey glass `#6f786f`, white "WESTIN" letters on the crown), **400 Lincoln Square** (office, 449 ft/137 m, 31 fl, 2017; blue-grey glass `#6e8a9e` with silver mullions), **Two Lincoln Tower** (W Bellevue + residences, 450 ft/137 m, 42 fl, 2017), 3-level retail podiums north (10455 NE 8th: Cinemark Reserve, Earls, Din Tai Fung, Paddy Coyne's, Topgolf Swing Suite, The Container Store) and south (500 Bellevue Way NE: Fogo de Chão, Duke's Seafood, Wild Ginger, Japonessa, TruFusion).
- **Skybridges** (OSM): (1) **over Bellevue Way NE** at ~NE 7th to Bellevue Square, ~32 m, covered, 2007 ([Bellevue Square](https://en.wikipedia.org/wiki/Bellevue_Square)); (2) **diagonally over NE 8th** from the Lincoln Square North podium to Bellevue Place/Hyatt, ~56 m, covered; (3) over NE 6th St between Lincoln Square North and South, ~22 m.

### 6.2 `plaza-center` — UiPath Bellevue 2018 – 2025
- **10900 NE 8th St, Suite 400**; **223 ft / 68 m, 16 floors, 1982** — briefly Bellevue's tallest (1982–83) ([tallest list](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington)); OSM way 33725899 + an OSM office node "UI Path" inside it (47.61778, −122.19400). North side of NE 8th between 108th and 110th; footprint ≈ 60 × 35 m with notched corners.
- Facade (CC0 photo 2026-10-26, `refs/bellevue/Plaza_Center_Bellevue_WA.jpg`): **full-height ivory precast piers `#ddd6bf` alternating with continuous dark bronze-charcoal glass strips `#2f3338`**, ~13 bays on the long face, notched corners, plain ivory parapet, small dark "PLAZA CENTER" letters near the top; **black glazed ground floor** `#1a1b1d` with "10900" over the doors and a **U.S. Bank** branch; a tall black pylon with huge vertical white numerals **"10900"** at the west driveway. Main doors face NE 8th (≈ 47.61762, −122.19405).

### 6.3 Other landmarks
Murrow high-rise arches and the 1967 dedication plaque (text in JSON), Mount Baker tunnel east portals, Aubrey Davis Park lid, **Bellevue Square** (1946; Macy's + Nordstrom; >200 stores; 23 M visitors/yr), **Bellevue Towers** (430/450 ft, 2008; OSM swaps the two heights — Wikipedia used), **Amazon Sonic** and **Bellevue 600** (both 600 ft/183 m, tallest in the city).

---

## 7. Buildings along the routes (heights, floors, facades)

All in `buildings[]` with OSM footprint rings. Heights: Wikipedia/SkyscraperCenter-sourced list where available, else OSM `height`, else `building:levels` × 3.9 m (offices/towers) / 3.2 m, else a rule estimate (marked `estimateBasis`). Unnamed `building:part`s are attributed to the containing named outline (`partOf`).

| OSM | name | height (m) | floors | dist to route | facade (hex) |
|---|---|---|---|---|---|
| w1453402305 | Bellevue 600 | 183 | 43 | 119 m (B) | — |
| w1214424283 | Amazon Sonic (555 108th Ave NE) — main 42-level part of OSM 1214423752 | 183 | 42 | 252 m (B) | — |
| w1326151866 | 400 Lincoln Square | 137 | 31 | 19 m (B) | glass `#6e8a9e`, mullion `#b9c0c4` |
| w604028611 | One Lincoln Tower / Westin Bellevue | 137 | 42 | 39 m (B) | glass `#6f786f`, frame `#4f5550`, crown `#76807a` |
| w604028603 | Two Lincoln Tower / W Bellevue | 137 | 42 | 54 m (B) | glass `#6b7c86` |
| w370239409 | Bellevue Towers South | 137 | 43 | 255 m (B) | glass `#7a96a8` |
| w370237986 | Bellevue Towers North | 131 | 42 | 222 m (B) | glass `#7a96a8` |
| w604028609 | Lincoln Square North (700 Bellevue Way NE) — UiPath 2025+ | 126 | 28 | 10 m (B) | glass `#7f97ad`, spandrel `#c8ced3`, crown `#5f6163` |
| w1556489725 | part of Amazon.com Sonic | ≈124.8 (est.) | 32 | 297 m (B) | — |
| r4547847 | — | 110.0 | 27 | 268 m (B) | — |
| w1474780185 | — | ≈109.2 (est.) | 28 | 98 m (A) | — |
| w1474780176 | — | ≈109.2 (est.) | 28 | 158 m (B) | — |
| r4547842 | City Center Bellevue (500 108th Ave NE) | 109 | 27 | 275 m (B) | — |
| w325852400 | — | ≈105.3 (est.) | 27 | 227 m (B) | — |
| r4547854 | City Center Plaza | 102.0 | 25 | 272 m (B) | — |
| w1215907936 | — | ≈101.4 (est.) | 26 | 69 m (B) | — |
| w210294281 | Symetra Center (777 108th Ave NE) | 99 | 25 | 11 m (B) | — |
| w1474761427 | — | ≈97.5 (est.) | 25 | 33 m (B) | — |
| w604031696 | part of Bellevue Place | ≈97.5 (est.) | 25 | 86 m (B) | — |
| w1215907937 | — | ≈97.5 (est.) | 25 | 123 m (B) | — |
| w604028622 | part of Washington Square Tower 2 | ≈97.5 (est.) | 25 | 138 m (B) | — |
| w325852420 | Skyline Tower (10900 NE 4th St) | 97 | 24 | 343 m (B) | — |
| w1474780168 | part of The Artise | ≈93.6 (est.) | 24 | 13 m (B) | — |
| w1223378663 | — | ≈93.6 (est.) | 24 | 78 m (B) | — |
| w604028614 | part of Washington Square Tower 1 | ≈93.6 (est.) | 24 | 137 m (B) | — |
| w325852418 | part of Skyline Tower | ≈93.6 (est.) | 24 | 352 m (B) | — |
| r4547844 | Skyline Tower | ≈93.6 (est.) | 24 | 365 m (B) | — |
| w99253500 | Elements Too | ≈89.7 (est.) | 23 | 108 m (A) | — |
| w99046833 | 989 Elements | ≈89.7 (est.) | 23 | 168 m (A) | — |
| w1474780191 | part of Bravern 2 | ≈85.8 (est.) | 22 | 28 m (A) | — |
| w418863769 | part of Key Center | ≈85.8 (est.) | 22 | 131 m (B) | — |
| w1455348197 | part of Broadstone Savoie | ≈85.8 (est.) | 22 | 216 m (A) | — |
| w1474744291 | part of Ten20 | ≈85.8 (est.) | 22 | 269 m (B) | — |
| w1474744292 | part of Ten20 | ≈85.8 (est.) | 22 | 276 m (B) | — |
| w183373055 | Tower 333 | 83 | 20 | 314 m (B) | — |
| w604031697 | Bank of America Tower (Bellevue Place) | 82 | 21 | 22 m (B) | — |
| w1223374204 | — | 82.0 | 26 | 156 m (B) | — |
| w956125654 | One88 | ≈81.9 (est.) | 21 | 10 m (B) | — |
| w955934398 | part of One88 | ≈81.9 (est.) | 21 | 11 m (B) | — |
| w55480142 | Bellevue Pacific Center | ≈81.9 (est.) | 21 | 210 m (B) | — |
| w1474755842 | part of Four106 | ≈81.9 (est.) | 21 | 212 m (B) | — |
| w1474744290 | part of Ten20 | ≈81.9 (est.) | 21 | 257 m (B) | — |
| w1223091245 | — | 80.0 | 25 | 152 m (B) | — |
| w604031692 | part of Bellevue Pacific Center | 79.0 | 23 | 210 m (B) | — |
| w33725928 | One Bellevue Center | 79 | 22 | 324 m (B) | — |
| w1474744285 | part of Ashton | ≈78.0 (est.) | 20 | 227 m (B) | — |
| w1474744289 | part of Ten20 | ≈78.0 (est.) | 20 | 256 m (B) | — |
| w604028599 | 929 Office Tower | 76 | 19 | 84 m (B) | — |
| w604031691 | SoMa North Tower | 76.0 | 22 | 211 m (B) | — |
| w656577798 | — | ≈74.1 (est.) | 19 | 82 m (B) | — |
| w1474759288 | — | ≈74.1 (est.) | 19 | 127 m (B) | — |
| w1474759285 | — | ≈70.2 (est.) | 18 | 111 m (B) | — |
| w1474759287 | — | ≈70.2 (est.) | 18 | 149 m (B) | — |
| w604031695 | Avalon Towers Bellevue East Tower | 70.0 | 24 | 148 m (B) | — |
| w33725899 | Plaza Center (UiPath 2018–2025) | 68 | 16 | 19 m (A) | pier `#ddd6bf`, glass `#2f3338`, podium `#1a1b1d` |
| w604031689 | SoMa South Tower | 67.0 | 18 | 211 m (B) | — |
| w543183572 | 888 Bellevue | ≈66.3 (est.) | 17 | 117 m (B) | — |
| w1474759290 | — | ≈66.3 (est.) | 17 | 129 m (B) | — |
| w432690843 | Centre 425 | ≈66.3 (est.) | 17 | 135 m (B) | — |
| w1474759286 | — | ≈66.3 (est.) | 17 | 136 m (B) | — |
| w965258752 | Summit 3 | ≈66.3 (est.) | 17 | 410 m (B) | — |
| w99451060 | Pacific Regent | 61.0 | 17 | 106 m (A) | — |
| w1215906032 | Amazon - Tahoe | ≈58.5 (est.) | 15 | 226 m (B) | — |
| w1215906033 | Amazon - Blueshift | ≈58.5 (est.) | 15 | 228 m (B) | — |
| w347030486 | Seattle Marriott Bellevue | ≈58.5 (est.) | 15 | 321 m (A) | — |
| w34040324 | Paccar Tower (777 106th Ave NE) | 52 | 13 | 68 m (B) | — |
| w38224226 | Bravern 1 | ≈50.7 (est.) | 13 | 28 m (A) | — |
| w99043577 | Elements Too | ≈50.7 (est.) | 13 | 57 m (A) | — |
| w192834684 | Summit 2 | ≈50.7 (est.) | 13 | 423 m (B) | — |
| w99253497 | Elements Too | 49.0 | 3 | 118 m (A) | — |

## 8. Ground-floor businesses and brands along the routes

From OSM POIs within 35 m of a route (all branded POIs within 60 m are in `businesses[]` with lat/lon, level and sign colours). Route B frontage on Bellevue Way is the densest retail strip; route A's NE 8th block is banks and offices.

| route · dist | brand — name | kind | address | level |
|---|---|---|---|---|
| A · 29 m | Apptio | company |  |  |
| A · 22 m | U.S. Bank | bank |  |  |
| A · 20 m | Berntson Porter & Company PLLC | company |  |  |
| A · 20 m | Umpqua Bank | bank |  |  |
| A · 13 m | Starbucks | cafe | 11010 Northeast 8th Street |  |
| A · 13 m | Hummus Republic | fast_food |  |  |
| A · 13 m | CoCo — Coco | cafe | 11028 Northeast 8th Street |  |
| A · 14 m | Charles Schwab | bank |  |  |
| A · 14 m | BarclayDean | company | 11100 NE 8th Street |  |
| A · 36 m | Hermès | clothes | 11111 Northeast 8th Street |  |
| A · 47 m | Microsoft Store | electronics | 11025 Northeast 8th Street |  |
| A · 23 m | Wasserman Chiropractic | doctors |  |  |
| B · 28 m | Sabine Cafe and Bar | cafe |  |  |
| B · 27 m | Optima Dental Spa | dentist | 10500 Northeast 8th Street | 1 |
| B · 26 m | Eco Car Cafe | car_wash | 10500 Northeast 8th Street Lvl 3 |  |
| B · 26 m | Yardbird | furniture | 10400 Northeast 8th Street |  |
| B · 23 m | Fidelity Investments | bank |  | 0 |
| B · 30 m | Water Lily | artwork |  |  |
| B · 52 m | Crate & Barrel | furniture |  | 0;2 |
| B · 20 m | Paddy Coyne's | pub | 700 Bellevue Way Northeast | 0 |
| B · 27 m | Din Tai Fung | restaurant | 700 Bellevue Way Northeast | 0 |
| B · 27 m | Gallagher | company |  |  |
| B · 21 m | Bellevue Water Grill | restaurant | 115 Bellevue Way Northeast | 0 |
| B · 27 m | Pressed — Pressed Juicery | fast_food |  |  |
| B · 33 m | TD Ameritrade | financial_advisor |  |  |
| B · 27 m | Starbucks | cafe | 545 Bellevue Way Northeast |  |
| B · 19 m | Par One | miniature_golf |  | 2 |
| B · 25 m | Topgolf — Topgolf Swing Suite | sports_centre |  | 2 |
| B · 23 m | Forum Social House | bar |  | 2 |
| B · 39 m | Wells Fargo Advisors | financial_advisor |  |  |
| B · 22 m | Thomasville & Urban Interiors | furniture |  | 1 |
| B · 15 m | Lincoln Square Fiori | artwork |  | 0 |
| B · 35 m | Cactus - Bellevue Square | restaurant |  | 2 |
| B · 12 m | Lincoln Square End of the Day Chandelier | artwork |  | 0 |
| B · 26 m | Farzi Café | restaurant | 515 Bellevue Way Northeast | 0 |
| B · 17 m | The Container Store | houseware | Bellevue Way Northeast | 0 |
| B · 33 m | Tavern Hall | pub |  |  |
| B · 31 m | Schoener | furniture |  |  |
| B · 58 m | Microsoft | company |  |  |
| B · 25 m | Castilla Restaurant and Tapas Bar | restaurant | 504 Bellevue Way Northeast |  |
| B · 24 m | Shake Shack | fast_food | 503 Bellevue Way Northeast | 0 |
| B · 30 m | The Studio, The Bellevue Collection Leasing Center | property_management |  | 1 |
| B · 14 m | Earls | restaurant | 700 Bellevue Way Northeast |  |
| B · 6 m | Praise for You, Dive with Me | artwork |  |  |
| B · 13 m | Paper Source | paper | 610 Bellevue Way Northeast | 0 |
| B · 28 m | The Cheesecake Factory | restaurant | 401 Bellevue Square |  |
| B · 15 m | STK Steakhouse | restaurant | 610 Bellevue Way Northeast |  |
| B · 55 m | Finish Line | sports |  | -1 |
| B · 6 m | The Shoppers, The Sidewalk, Passerby, 11AM Saturday Morning, The Intersection, The Crosswalk | artwork |  |  |
| B · 24 m | Xfinity | telecommunication | 408 Bellevue Way Northeast |  |
| B · 16 m | Wild Ginger | restaurant | 508 Bellevue Way Northeast | 0 |
| B · 32 m | Baron's Sino Kitchen & Bar | restaurant |  | 1 |
| B · 24 m | Duke's Seafood | restaurant |  | 1 |
| B · 16 m | Fogo de Chão | restaurant | Bellevue Way Northeast | 0 |
| B · 27 m | TruFusion | fitness_centre | 500 Bellevue Way Northeast | 1 |
| B · 15 m | Fogo de Chão | restaurant | 440 Bellevue Way mNortheast | 0 |
| B · 26 m | Cinemark — Cinemark Reserve Lincoln Square - Dine-In 21+ | cinema |  | 2 |
| B · 48 m | Nordstrom Rack | clothes |  | 0 |
| B · 19 m | Capital One Café | cafe | 400 Bellevue Way Northeast |  |
| B · 21 m | Roots Salon | hairdresser | 10419 Bellevue Way Northeast |  |
| B · 26 m | em Salon & Spa | beauty | 10425 Northeast 4th Street |  |
| B · 36 m | Macu — Macu Tea | cafe | 10435 Northeast 4th Street |  |
| B · 15 m | Salt & Straw | ice_cream | 10415 Northeast 4th Street |  |
| B · 9 m | Museum Quality Framing | frame |  |  |
| B · 10 m | Bishops | hairdresser |  |  |
| B · 10 m | Starbucks | cafe | 300 Bellevue Way Northeast |  |
| B · 52 m | Safeway | supermarket | 300 Bellevue Way Northeast |  |
| B · 10 m | The Lash Lounge | beauty |  |  |
| B · 10 m | LensCrafters | optician |  |  |
| B · 10 m | PokeWorks | fast_food | 222 Bellevue Way Northeast |  |
| B · 10 m | Hear USA | hearing_aids | 208 Bellevue Way Northeast |  |
| B · 14 m | BECU | bank | 200 Bellevue Way Northeast |  |
| B · 25 m | Amazon Hub — Amazon Hub | parcel_locker |  |  |
| B · 15 m | HSBC | bank | 196 Bellevue Way Northeast |  |
| B · 16 m | Takai by Kashiba | restaurant | 180 Bellevue Way Northeast |  |
| B · 15 m | Aesthetic Facial Plastic Surgery | doctors | 170 Bellevue Way Northeast |  |
| B · 17 m | Garlic Crush | restaurant |  |  |
| B · 21 m | Mango Mango Dessert | cafe |  |  |
| B · 24 m | Mediterranean Kitchen | restaurant |  |  |
| B · 17 m | Cafe Bollywood | restaurant |  |  |
| B · 27 m | Molly Tea Bellevue | cafe | 103 Bellevue Way Northeast |  |
| B · 24 m | Robbins Brothers | jewelry | 33 Bellevue Way Northeast |  |
| B · 27 m | The Shade Store | interior_decoration | 13 Bellevue Way Northeast |  |
| B · 58 m | Starbucks | cafe | 42 Bellevue Way Northeast |  |
| B · 58 m | FedEx — FedEx Office | copyshop |  |  |
| B · 23 m | west elm | furniture | 1 Bellevue Way Northeast |  |
| B · 35 m | Bellevue Barber Shop | hairdresser | 10393 Main Street |  |
| B · 22 m | Green Lake Jewelry Works | jewelry | 25 Bellevue Way Southeast |  |
| B · 31 m | 7-Eleven | convenience | 100 Bellevue Way Southeast |  |
| B · 17 m | CVS Pharmacy | pharmacy | 107 Bellevue Way Southeast |  |
| B · 31 m | Premier Nails & Spa | beauty |  |  |
| B · 31 m | Calico Corners | furniture | 104 Bellevue Way Southeast |  |
| B · 22 m | Rainbow Learning Center | childcare |  |  |
| B · 24 m | Bellevue Nursery | garden_centre | 842 104th Avenue Southeast |  |
| B · 34 m | Pilgrim Lutheran Church | place_of_worship |  |  |
| B · 31 m | First Baptist Church of Bellevue | place_of_worship |  |  |
| B · 21 m | Bellecare Dental | dentist |  |  |
| B · 33 m | Enatai Cleaners | laundry | 1614 Bellevue Way Southeast |  |
| B · 32 m | Woodinville Shoe Repair | shoe_repair |  |  |
---

## 9. Transit seen from the car

- **2 Line light rail** (Sound Transit Link): full Lynnwood–Seattle–Mercer Island–Bellevue–Redmond line opened **28 March 2026**; runs in the I-90 centre roadway beside the player for ~6 km, Mercer Island station in the median, South Bellevue station on Bellevue Way SE (route B), elevated over I-405 near NE 6th, Bellevue Downtown station at 110th/NE 6th ([2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit))). Trains: white Siemens LRVs with a Sound Transit blue lower band and teal wave graphics, "Link" logo, 2–4 cars (2026 photos in refs).
- **Buses** on route ways (OSM route relations): King County Metro 111, 218, 226, 240, 246, 249, 556, 630, Trailhead Direct 636/643, **RapidRide B Line** (red `#96172E`/yellow) on NE 8th/112th; Sound Transit Express 532, 535, 560, 566 on I-405; Flixbus on I-90.

## 10. Congestion hotspots (feeds `CITIES.seattle.districts.bellevue.congestion`)

| id | where | local hours (weekday) | level | evidence |
|---|---|---|---|---|
| `i405-nb-downtown` | I-405 NB SE 8th → NE 8th (47.6000, −122.1810, r 900 m) | 06:30–09:30, 15:00–19:00 | 0.85 | corridor congested up to 15 h/day, 192,000 ADT at NE 8th/NE 4th ([WSDOT CSS](https://appstest.wsdot.wa.gov/sites/default/files/2021-10/CSS504-i405-i5JctTukwila-BellevueCityCenter.pdf)); Bellevue→Everett severe at 16:25 on 70% of 2024 weekdays ([WSDOT dashboard I-405](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm)); ETL work zone to 2027 |
| `i405-sb-downtown` | opposite carriageway | 15:00–19:00 | 0.9 | Bellevue→Tukwila ~17:00 < 36 mph on up to 97% of days (2014); Everett→Bellevue 07:30 severe 73% (2024) |
| `i90-wb-bridge` | **WB Hadley bridge — visible beside you** | 07:30–09:30, 15:30–18:30 | 0.8 | Bellevue→Seattle severe at 08:25 on 54.8% and at **16:35 on 84.6%** of 2024 weekdays ([WSDOT dashboard I-90](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate90-cps/severe-congestion.htm)) |
| `i90-eb-bridge` | EB (player) | 16:30–18:00 | 0.35 | Seattle→Bellevue severe at 17:10 on only 20.9% |
| `ne8th-112th` | NE 8th × 112th Ave NE / I-405 ramps | 16:00–18:30 | 0.75 | PM-peak **v/c 1.00** (2018), forecast 1.31 ([Bellevue MIP vol.2 App. B](https://bellevuewa.gov/sites/default/files/media/pdf_document/2022/Bellevue-MIP-report-vol2.pdf)) |
| `bellevueway-main` | Bellevue Way × Main St | 16:00–18:30 | 0.6 | PM v/c 0.93 (2019) (MIP) |
| `bellevueway-se-to-i90` | Bellevue Way SE southbound to I-90 | 15:30–18:30 | 0.55 | 2019 PM 2.38 min SB vs 1.82 NB (MIP App. A) |
| `bellevue-square-weekend` | Bellevue Way at the Bellevue Collection garages | Sat/Sun 12–18, Nov–Dec | 0.5 | retail peak (23 M visitors/yr); **estimate** |

Other downtown PM v/c (MIP 2019): Bellevue Way × NE 8th 0.66, × NE 4th 0.59, × NE 12th 0.71; 108th × NE 8th 0.66, × NE 4th 0.79; 100th × NE 8th 0.80; 112th × Main 0.98. Seattle overall: 7th most congested US city in TomTom 2025, peak ≈ 17:00 ([TomTom](https://www.tomtom.com/traffic-index/seattle-traffic/)). Speed limits: I-90 and I-405 60 mph, downtown arterials 30 mph (OSM `maxspeed`), residential 20–25 mph.

## 11. Colour palette (sRGB)

| item | hex | note |
|---|---|---|
| freeway concrete dry / wet | `#8e8f8a` / `#5f615e` | I-90, I-405 are mostly PCC concrete (OSM `surface=concrete`) |
| arterial asphalt dry / wet | `#3d3f42` / `#26282b` | downtown streets |
| lane white / edge yellow | `#e9e9e4` / `#e1b12c` | |
| parapet concrete / weathered face | `#a7a59e` / `#3a3a38` | floating bridges |
| Murrow arches | `#c9c0ae` | photo `#b8a68b` warm sun |
| tunnel portal concrete | `#bdb9ae` | |
| guide-sign green / gantry steel | `#006b3f` / `#a3a6a7` | |
| sidewalk / kerb concrete | `#bdb8ae` / `#a9a49a` | |
| Lake Washington overcast / clear | `#5d6d72` / `#3e6787` | |
| Lincoln Sq North glass / spandrel / crown | `#7f97ad` / `#c8ced3` / `#5f6163` | photo |
| One Lincoln Tower glass | `#6f786f` | photo |
| Plaza Center piers / glass / podium | `#ddd6bf` / `#2f3338` / `#1a1b1d` | photo 2026 |
| Bellevue Towers glass | `#7a96a8` | estimate |
| trail railing / OCS steel | `#2e3133` / `#4e5459` | photo 2026 |
| conifer / winter lawn | `#2f4a32` / `#4f6b35` | |

Photo-derived values are medians of hand-picked regions (script `sample.py`, see Method).

## 12. Top 30 things a local would notice if wrong

1. EB traffic exits the **old twin arched portals** (with "SEATTLE PORTAL TO THE PACIFIC"), not the big round 1989 bore — that one is westbound.
2. The tunnel splits into **two 2-lane bores** EB; the HOV lane is in the north bore.
3. You drive **through the cream concrete arches** of the Murrow "high-rise" at both ends — the bridge's signature.
4. On the floating section the roadway is **almost at water level**, with no piers and no towers.
5. **No sidewalk on the Murrow**; the walkers/cyclists are on the Hadley's north edge behind a black picket railing.
6. **Light-rail trains under catenary** run between you and the westbound lanes (since March 2026).
7. Each I-90 direction has **4 lanes: HOV diamond lane on the left + 3 GP**.
8. Every freeway carriageway has a **yellow left edge line** and a **white right edge line**.
9. Lane lines are **10 ft dashes with 30 ft gaps** and reflective RPMs in the gaps — not short European dashes.
10. HOV lane separated by a **wider** white dashed line; white diamonds painted in it.
11. **Concrete** (light grey, jointed) freeway pavement, not black asphalt.
12. Mercer Island: you dip under the **lid** (a lit tunnel ~800 m) with park on top.
13. Downtown Bellevue's towers dominate the view half-left from the bridge — **Amazon Sonic & Bellevue 600 at 600 ft** are the tallest.
14. Exits are **numbered**: 6, 7A, 7B, 8, 9, 10A, 12, 13A/13B, with **yellow "EXIT ONLY"** panels for dropped lanes.
15. The I-405 connection from I-90 EB is a **long single-lane flyover** looping over the interchange.
16. **Never take the left lane at NE 6th** — it's an HOV/bus-only "Texas T" ramp to the transit center.
17. Exit 13B splits into "NE 8th St East" / "NE 8th St West".
18. NE 8th is **wide (3–4 lanes each way)** with a narrow raised median with **yellow-painted noses**.
19. Signals are on **mast arms over the lanes**, one head per lane, yellow-bordered backplates, green street-name blade on the arm.
20. Downtown sidewalks are **pale concrete scored in 2 ft squares**, separated from the kerb by tree planters.
21. **Covered glass skybridges** cross Bellevue Way and NE 8th at Lincoln Square.
22. **Plaza Center** = vertical **ivory stripes + dark glass**, "10900" pylon — instantly recognisable 1980s tower.
23. **Lincoln Square North** = blue-grey glass with light horizontal bands at the NE 8th × Bellevue Way corner; One Lincoln Tower beside it with "WESTIN" on top.
24. **Bellevue Square** is a long, low 3-storey mall with Nordstrom and Macy's, across Bellevue Way from Lincoln Square.
25. Ground floors along Bellevue Way are restaurants/retail (Cheesecake Factory, Shake Shack, Din Tai Fung, Earls, Starbucks), not offices.
26. **Banks everywhere on NE 8th**: Chase, U.S. Bank (inside Plaza Center), Umpqua, Schwab, Fidelity, BECU/HSBC on Bellevue Way.
27. Speed limit signs: **60 mph** on I-90/I-405, **30 mph** downtown (black on white R2-1).
28. Weekday 4–6 pm: **westbound I-90 crawls** while eastbound mostly flows; I-405 through downtown is jammed both ways.
29. Conifers (Douglas-fir) line the freeway cuts on Mercer Island and around Mercer Slough; street trees downtown are deciduous (orange/red in Nov).
30. Work-zone barrels and temporary barriers on I-405 near I-90 (ETL project until 2027).

## 13. Gaps and confidence

- **Lincoln Square lobby & UiPath signage**: no open source; modelled lobby is a plausible generic (low confidence). Exact second UiPath floor unknown (suite 2000 → floor 20 + one adjacent).
- **Facades**: photo-sampled for Lincoln Square North, One Lincoln Tower, Plaza Center, bridge/tunnel elements; others (400 Lincoln Square, Two Lincoln Tower, Bellevue Towers, Bellevue Square) estimated from photos with lower confidence; most mid-rise buildings have no facade colour → use district style rules. 39/78 downtown buildings within 40 m of a route have OSM height/levels; the rest carry rule-based estimates (`estimateBasis`).
- **Street trees on NE 8th and Bellevue Way** are under-mapped in OSM (4 and 17 trees); species unverified.
- **Signal pole colour** (galvanised vs painted) not verified per intersection.
- **Sign legends** are reconstructed from OSM `destination:lanes` (which mappers take from the real signs) — layout/arrow arrangement unverified.
- **Tunnel interior** lighting/wall finish only from one portal photo.
- **Hadley/Murrow parapet heights, deck freeboard** — approximate from photos (no WSDOT drawing retrieved).
- **Route A length 14.4 km** exceeds the spec-10 bellevue limit of 12 km — decision for world/orchestrator (see §1).
- Port of Seattle / GeekWire hosts are blocked from the sandbox; their facts come via search-engine summaries.
- **Photos**: 19 licensed photos downloaded to `refs/bellevue/`; 19 more vetted candidates (Lincoln Square North close-up, skybridge, Bellevue Square entrance, I-405, Mercer Island station, Amazon Sonic…) are listed in `refs/bellevue/LICENSES.md` but could not be fetched (upload.wikimedia.org HTTP 429, 10-min Retry-After). Facades of 400 Lincoln Square, Two Lincoln Tower, Bellevue Towers and Bellevue Square should be re-sampled once those are fetched.

## 14. Sources

All ids used in the JSON `src` fields resolve in `sources`:
- OpenStreetMap (ODbL), API 0.6 extracts 2026-11-06 — <https://www.openstreetmap.org>
- Wikipedia: [Lacey V. Murrow Memorial Bridge](https://en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge), [Homer M. Hadley Memorial Bridge](https://en.wikipedia.org/wiki/Homer_M._Hadley_Memorial_Bridge), [Mount Baker Tunnel](https://en.wikipedia.org/wiki/Mount_Baker_Tunnel), [I-90 in Washington](https://en.wikipedia.org/wiki/Interstate_90_in_Washington), [I-405](https://en.wikipedia.org/wiki/Interstate_405_(Washington)), [2 Line](https://en.wikipedia.org/wiki/2_Line_(Sound_Transit)), [Tallest buildings in Bellevue](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington), [Bellevue Square](https://en.wikipedia.org/wiki/Bellevue_Square), [Bellevue Towers](https://en.wikipedia.org/wiki/Bellevue_Towers), [Downtown Bellevue](https://en.wikipedia.org/wiki/Downtown_Bellevue)
- WSDOT Standard Plans [M-20.10-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.10-04_e.pdf), [M-20.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.20-02_e.pdf), [M-20.30-05](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.30-05_e.pdf), [M-20.40-03](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m20.40-03_e.pdf), [M-24.20-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.20-02_e.pdf), [M-24.40-02](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.40-02_e.pdf), [M-24.60-04](https://wsdot.wa.gov/publications/fulltext/Standards/english/PDF/m24.60-04_e.pdf); [Traffic Manual ch.3](https://wsdot.wa.gov/publications/manuals/fulltext/M51-02/Chapter3.pdf)
- MUTCD 2009 [Part 3A](https://mutcd.fhwa.dot.gov/htm/2009r1r2r3/part3/part3a.htm), [Part 3D](https://mutcd.fhwa.dot.gov/htm/2009/part3/part3d.htm)
- WSDOT Multimodal Mobility Dashboard [I-405](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate405-cps/severe-congestion.htm), [I-90](https://wsdot.wa.gov/about/data/Multimodal-mobility-dashboard/dashboard/central-puget-sound/interstate90-cps/severe-congestion.htm); [I-405 corridor sketch CSS504](https://appstest.wsdot.wa.gov/sites/default/files/2021-10/CSS504-i405-i5JctTukwila-BellevueCityCenter.pdf); [Renton–Bellevue ETL project](https://wsdot.wa.gov/construction-planning/search-projects/i-405renton-bellevue-widening-and-express-toll-lanes-project); [I-405/SR 167 newsletter 2026-10-13](https://content.govdelivery.com/accounts/WADOT/bulletins/42f0f84)
- City of Bellevue: [Transportation Design Manual 2024](https://bellevuewa.gov/sites/default/files/media/pdf_document/2024/trans-design-standards-v1pt1-2024.pdf), [Mobility Implementation Plan vol.2](https://bellevuewa.gov/sites/default/files/media/pdf_document/2022/Bellevue-MIP-report-vol2.pdf)
- [UiPath offices](https://www.uipath.com/about-us/offices); [GeekWire 2025](https://www.geekwire.com/2025/uipath-hires-former-f5-executive-as-cmo-relocates-bellevue-offices-to-lincoln-square/); [UiPath 2018 press release](https://ir.uipath.com/news/detail/134/uipath-opens-first-u-s-development-center-in-bellevue-wash)
- [TomTom Traffic Index Seattle](https://www.tomtom.com/traffic-index/seattle-traffic/); [The Columbian 2024 on WSDOT RPMs](https://columbian.com/news/2024/oct/28/why-dont-many-wa-highways-have-reflectors-if-the-state-gets-so-much-rain-we-asked-wsdot)
- Wikimedia Commons photos — see [refs/bellevue/LICENSES.md](refs/bellevue/LICENSES.md)

## 15. Method (reproducible)
Scripts live in the research scratchpad (not shipped): OSM `/api/0.6/map` tiles (≤ 0.02° squares, split on refusal, ≥ 1.5 s apart) → Python parser → Dijkstra router over drivable ways (oneway-aware, HOV-only links excluded) with way-snapped waypoints → extractor (route segments with tags, buildings with footprint/parts within 70 m or ≥ 25 m tall, POIs within 60 m, furniture nodes) → curated overlay (`curated_bel.py`) → `seattle-bellevue.json`. Photo colours: median RGB of hand-picked rectangles. Wikimedia API calls rate-limited (≥ 4 s, honouring `Retry-After`), descriptive User-Agent.

## 16. Reality review of the driving district (2026-11-12)

Scope: the playable `bellevue` district as built (`district.geometry`: NE 8th St from I-405 to Bellevue Way plus 200 m around Lincoln Square, 0.39 km²) and what is seen from it. Positions and tags: live OSM (Overpass, bbox 47.6138,-122.2051 – 47.6198,-122.1839, 2026-11-12). Appearance: street-level panoramas compared by eye with game renders at the same pose (`game/dev/reality/viewpoints.json`, ids `bel-*`); no panorama imagery is stored.

Businesses (OSM named shop / amenity / tourism / leisure / office in the bbox: 494; game POIs: 157)
- Inside the playable geometry every OSM food / bank / shop / hotel POI is in the game except: **Courtyard** hotel (relation 8064670: the builder reads POIs from nodes and ways only), Lucky Strike (node 4188521492, `leisure=amusement_arcade`), Topgolf Swing Suite and Par One (nodes 11214249972 / 11214249971, level 2, indoor), Pure Barre (node 3883822560), TD Ameritrade and Wells Fargo Advisors (nodes 4190985796 / 4190985798, `office=financial_advisor`), The Ruby Room (node 5608446843). Two exclusions made by the earlier research stand: Starbucks node 471973082 (not in the official locator; the corner unit of the Courtyard building at 110th Ave NE carries a CoCo sign in the panorama) and Microsoft Store node 7658557693 (the Bravern frontage shows a Microsoft office sign, not a shop).
- The Courtyard building showed a tenant's name (Hummus Republic) as its building sign. Reference: "COURTYARD" letters on the NE 8th / 110th corner. world.js now gives a building whose own source tags are a hotel the hotel's sign, on its `addr:street` face. The hotel is still missing from `pois` (map marker): needs the builder to read multipolygon relations as POIs and a rebuild.
- Outside the playable geometry (scenery ring) 322 OSM businesses have no POI by design of the district mask; the ones a driver can see from the playable streets are the Bellevue Square east frontage on Bellevue Way and the blocks north of NE 8th on Bellevue Way. Not added: needs a rebuild with a wider POI mask.

Bridges, skybridges, passages
- NE 8th St over I-405 (ways 1058885032, 428073537, 513238699, 30615115, 55481043, ramp 623055163): present as a bridge over the freeway, piers under the deck. Reference: low grey concrete parapet with a steel rail and a sidewalk on the north side, concrete pavement, a sign gantry over the east end, the freeway in a cut with grass slopes and a concrete median barrier. Game: tall blue-grey slab parapets, no sidewalk, freeway at grade on a flat plain.
- Lincoln Square skybridges (way 43872832 over Bellevue Way, 43872826 + building 1364249504 diagonally over NE 8th, 516915099 over NE 6th): all three present at the mapped places. Reference: open white steel trusses with glazing; the NE 8th bridge has a glazed pitched roof and stands on a white curved pier on the north sidewalk. The models were solid blue glass boxes; they now have white chords, posts and alternating diagonals over paler glazing. The pitched roof and the north pier are not modelled.
- Bellevue Square bridges west of Bellevue Way (ways 29234890, 497738385, 29234888, 30758942) and Avenue Bellevue (way 1222676052): outside this review's renders; not checked.
- 2 Line (East Link): the elevated guideway (bridge ways 669516620 / 1154876472, layer 2, over I-405 and NE 8th to Wilburton station, platform 922284294) and the station-side tracks (614517901 / 669516619, layer 1) are in `railways` but not drawn: world.js draws ground rails only and leaves bridge / layered ways unresolved. From the NE 8th bridge and from NE 8th east of I-405 the real guideway and Wilburton station are in view; the game shows open sky. The tunnel portal, Bellevue Downtown station (node 7744630735), the Transit Center (way 29234897), City Hall (way 418863779) and Meydenbauer Center lie 200 – 350 m south of the playable area and were not compared.
- NE 10th, NE 6th and NE 4th St overpasses of I-405 are scenery pieces flagged as bridges; none is visible in the renders from the NE 8th deck looking south. Not verified further.

Water and sports
- Water inside the playable geometry: OSM ponds 87177189, 87177192, 135465893, 135465898 (I-405 interchange), 468675532, 469892287, 470030698 (plazas at 108th Ave NE) are all in `areas`. Fountains 469892286 (47.61756, -122.19944) and 838537627 (47.61824, -122.18624) are not in the data (`furniture` has no fountain). No comparison renders were made for the water bodies.
- No outdoor sports ground lies inside the playable geometry; indoor venues are listed under businesses.

Landmarks
- Lincoln Square North podium: reference shows cream / tan stone panels over a grey storefront base on both street faces and the curved corner, blue awnings, a red-brick accent bay at the NE 8th skybridge landing. The model's wall colour was orange brick (#b57f52); it is now cream stone (#d9cba6, lighter bands #e6dcc3), with dark lettering. The brick accent bay and the awnings are not modelled.
- Bellevue Square front entrance (node 5752777692): gable with lettering, gridded glazing and brick flanks agree with the reference in arrangement; the reference has red brick down to the ground, round-globe lamp posts, bollards, flower beds and trees in the forecourt, which the game lacks.
- Plaza Center: striped tower, black base, "10900" pylon and U.S. Bank sign agree; the reference panorama shows a UiPath sign over the door.
- Bellevue Way NE and NE 8th St: the reference has continuous street trees and a planted median on Bellevue Way; the game has almost none there.
- Buildings without a landmark model (The Bravern, Bellevue Place / Hyatt, Courtyard, Key Center, towers on 108th) are all drawn as dark blue glass. Reference: The Bravern has a cream stone retail podium and towers with punched windows; Bellevue Place is pink-beige precast with square windows; the Courtyard is grey stucco.

## 17. Lincoln Square North podium, round 2 (2026-11-12, lane landmarks)

- OSM w161929514 `building=retail`, `building:levels=3`. Panoramas on Bellevue Way NE at 47.6170863, -122.2018217
  (east) and 47.6164672, -122.2018012 (headings 20 / 60 / 120): cream stone piers with wide blue-glass bays on the
  upper levels; the bay directly south of the Bellevue Square skybridge is red-brown brick with the same glazing; brick
  piers between the shopfronts; south of it (One Lincoln / Westin) tan stone with punched windows. The NE 8th face was
  not looked at and keeps the earlier windows.

## 18. Landmark catalogue review against panoramas (fidelity pass round 2b, lane landmarks-b, 2026-11-12)

Method: official panorama ids found from Maps coverage metadata (`photometa/ac`, coverage only), the game rendered at the
pano position and bearing (eye 2.5 m), then compared side by side by eye. No imagery kept. Poses: `viewpoints-add.json`
of this lane and the poses below. "Match" = shape class, height, roof, main materials/colours, entrance side and signage
read as the real thing at street distance; it is not a claim of parity. Table positions are rounded and some are
approximate; the exact poses with their pano ids are in this lane's `pick/*.json`, `views2b.json` and `views3.json`,
and the kept ones in `viewpoints-add.json`.

| Landmark | Pose (lat, lon, heading) | Verdict |
| --- | --- | --- |
| lincoln | — | compared in round 2 (lane landmarks) |
| onelincoln | 47.615169, -122.201847 h 39 | fixed: blue glass with white slab bands (was matt grey-green) |
| lincolnsouth | 47.61479, -122.201752 h 93 | fixed podium: tall glazed bays (were punched windows); tower glass bluer |
| plazacenter | 47.6181, -122.1937 h 231 / 335 | match (ivory piers, dark glass strips) |
| sonic | 47.6149, -122.1960 h 83 / 279 | match (dark glass); base retaining wall not in scope |
| bellevue600 | — | not compared: the candidate poses face a garage in front of it |
| bellevuetowers | 47.613977, -122.198816 h 54 | fixed podium (stone + glazed retail floor, stripes removed); real podium stone is darker grey at that corner |
| bellevuesq | 47.615603, -122.201778 h 272 | partial: real east face is red brick with glazed bays and columns; model grey with a blue band (open, module landmark-bellevue-square.js) |

Statues not modelled: Bellevue artworks (Gandhi n1704038437, Forest Deity n7205021680: the nearest panoramas show trees / a car park, nothing recognisable).

## 19. Round 2 (2026-11-12), lane world: 2 Line guideway and car parks

**2 Line guideway (`game/src/bellevue-guideway.js`).** Drawn from the OSM ways w669516620 / w1154876472 (bridge, layer 2),
the crossovers w762965202 / w762965203 and the station tracks w614517901 / w669516619 (layer 1). Streets crossed, from the
district pack's scenery roads: 112th Ave NE (13 m along the first track), I-405 and its ramps (141 - 221 m), 116th Ave NE
(414 m), NE 8th St (683 - 696 m); the track is at grade again at 1,144 m (OSM: no bridge tag north of there).

Ground under the track, USGS 3DEP via epqs.nationalmap.gov, sampled every 50 m on 2026-11-12 (m): 35.6, 33.2, 30.5, 30.2,
30.4, 28.3, 28.4, 29.2, 31.1, 34.1, 36.9, 38.5, 42.6, 44.3, 44.3, 44.8, 45.1, 45.0, 43.4, 44.2, 43.6, 43.8, 44.9, 46.5;
west of the bridge 41.2 / 39.4. NE 8th St at the crossing: 44.3 m.

Rail level: **an estimate**. No published profile was found (Wikipedia and Sound Transit pages give the structure type
only: an 810 ft long-span bridge over I-405, an elevated Wilburton station above NE 8th St). Assumed 42.1 m at the west
end (5 m clearance + 1.5 m structure over 112th Ave NE), 51.3 m over NE 8th St (5 m + 2 m), held 150 m for the platform,
straight grades between and down to the at-grade track. Drawn deck height over the game's flat ground = rail level minus
ground: 6.5 m at 112th, up to 17.7 m over the I-405 valley, 7 m at NE 8th. Girder 2.2 m, deck half-width 2.6 m, piers
every 34 m (26 placed, 1 omitted on a carriageway): estimates. Not drawn: Wilburton platform (w922284294) and canopies,
overhead line, trains. Street View was not compared for the guideway.

**Car parks (`game/src/car-parks.js`).** Open decks on the unchanged footprint and height for w30758875 (West Parking
Garage, 4 levels), w34040306 (Southeast, 2), w161929522 (Northeast, 6), w104581576 (4), w450055216 (no levels in OSM:
3 from the 10 m pack height, estimate). Not compared with Street View.

**Monuments (`game/src/monuments.js`).** 11 placed as generic class objects (Mahatma Gandhi statue, Guan Yin, Double
Inquiry, Heronious One, #BVUE and unnamed sculptures); murals and untyped artworks are left as markers; Root (in water)
and Story Pole VI (on a carriageway) skipped.

## 20. Round 2 (2026-11-12), lane world-b

Street View was used only to look (official panoramas, ids found from coverage metadata); nothing was saved or traced.

NE 8th St over I-405 (w30615115, w55481043, w428073537, w513238699, w1058885032): concrete parapet
with a dark steel picket fence: drawn so. 2 Line guideway: single-column hammerhead piers and box deck match the class at
47.61504, -122.188416 and 47.616547, -122.184279; the I-405 span's girders are sage green in reality (grey in the game).
Monuments (Gandhi, Guan Yin, Double Inquiry and 8 others) and the car parks were render-checked (generic class forms).

## 21. Round 3 (2026-11-13), lane structures

Official Street View panoramas were looked at only (ids from coverage metadata); nothing was saved, traced or measured from them.

Exit → Renton w623055163 shares the NE 8th St north deck edge: concrete parapet with the dark picket
fence (47.617466, -122.189428 h110). The same view shows an overhead sign gantry over the bridge (not drawn: its sign text was not
legible at this resolution).

## 22. Round 3 street-level review, lane look (2026-11-13)

- **Pedestrians down the middle of NE 8th St east of I-405** (bellevue-3): cause found in the data. NE 8th St is a dual carriageway
  whose halves are tagged `sidewalk:left=no` / `sidewalk:right=separate`; between them run two untagged left-turn lanes,
  `primary_link` w1548748925 (47.61732 → 47.61729, -122.18699 → -122.18568) and its connector w1548748924. Untagged ways get the
  inferred fallback walkway (2.5 m) on both sides, so these links carried the only "sidewalks" in reach and the crowd walked them in a
  column (probe at the report pose: 30 walkers on the two links). sidewalk-overlap.js now removes the inferred walkway of an at-grade
  `*_link` whose connecting roads are all tagged without walkways, or whose walkway band lies on / beside a parallel carriageway. After
  the change: no walker on either link (same probe), none visible at the report pose.
- **Arco** w425947102 (building=roof, amenity=fuel): blue fascia over two pump islands (ZPhc55a5IH684ZTmf463zw h83); the pack has no
  canopy record for it (POI only). No pylon identified (a small sign on a pole only): none drawn.
- **Downtown colours** (bellevue-6, rows in building-review-look.js): Bellevue Place w33613428 pink-beige precast with a red-brick arched
  base (kxosxD8k3pWuWhUSIn2npQ h15); Courtyard r8064670 grey panel / stucco walls (sTPVjoz6jM0aI-f3NYYzng h187). Bravern 2 w38224225:
  cream stone at street level (8BgiFdoVWhfWK7YqNBAXgw h184), but the street face is its 22-storey OSM part w1474780191 (glass above),
  so no single-colour row; left as glass.
- **Street trees** (bellevue-5): the aerial survey (trees-seattle-bellevue.json) has 1 crown within 16 m of Bellevue Way's centre line
  between 47.6140 and 47.6195 and 7 along NE 8th St (-122.2045 to -122.1960); live OSM has 3 + 1 `natural=tree` there and no tree_row.
  The panorama north of NE 4th (iLkRrRQ1F0GfQpsOWl9O7Q h0) shows medium street trees on both sides north of NE 6th. The survey area
  covers these streets, so inferred street trees are suppressed there by rule; positions cannot come from panoramas. Needs a
  re-measurement of small crowns on the aerial mosaic (tools/aerial) along these two streets.
- **Garage w450055216** (47.6134, -122.1843): the official panoramas there were taken on its roof: an open rooftop deck with planters
  and trellises over the REI store podium (WQYAZP9zih6YvbMOma73mw, MXEGRAuCD3pdurAoVdtLNA); from the street to the south
  (FjAPRHBV5IcENxea32KJiw h7) the deck edge is one storey up behind a glass railing. Levels below not visible. The game draws nothing
  at that pose (outside the drawn area).

## 23. Backlog clearance (2026-11-13)

- **2 Line I-405 span colour** (r2-world-b-guideway-colour): the girders of the span over I-405 are painted sage green (official
  panoramas 47.61504, -122.188416 h60 and 47.616547, -122.184279 h180). `bellevue-guideway.js` now draws the girder faces and soffit
  of that span `#7f9a83` between the piers the game places either side of I-405 and its ramps (129 - 232 m along w669516620; OSM puts
  the carriageways at 141 - 221 m). Parapets stay concrete. The span ends are an estimate: OSM maps no supports.
- **2 Line decks at Wilburton**: the two tracks spread to 9.3 m round the station; they now share one deck below 14 m, as at SeaTac.
- **Garage w450055216** (r2-world-carparkheights): an open rooftop deck over the REI podium (section 22). Estimate: 3 levels from the
  pack's 10 m height; OSM has no levels, the panoramas were taken on the roof, and no other source was found.
- **Road-sky hole at Bellevue Way / NE 7th St** (r3-look-15): visual QA on 2026-11-13 (route uipath-bel, sample #33 at
  47.616117, -122.200589, the covered drive under Lincoln Square) flags no `road-sky-hole`; the pale band at the horizon is the road
  surface in daylight. Not reproduced, so closed.
- **Bravern 2** (r3-look-10): the street face is the 22-storey part w1474780191; `facade-bands.js` now draws a cream stone base band
  round it (0.15 - 8.4 m, two retail storeys: estimate) with shop-window bays, the glass curtain wall above unchanged.
- **Landmark colours** (r2-landmarks-b-2): Bellevue Square's Bellevue Way face is red brick with two-storey glazed bays between proud
  brick columns (was grey stone with one blue shop band; bay rhythm 7.5 m and heights are estimates); the Bellevue Towers podium
  stone is darker grey (#9c978e).
