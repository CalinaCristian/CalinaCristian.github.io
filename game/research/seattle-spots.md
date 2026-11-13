# Seattle + Bellevue tourist spots — research dossier (research-sea-spots)

Updated 2026-11-06. Machine-readable scene specs: [`seattle-spots.json`](seattle-spots.json) (`spots[]`, `ranking`, `culture`, `dialogue_general`). Per-spot OSM geometry + USGS terrain: [`osm/sea-spots/`](osm/sea-spots/). Reference photos (Wikimedia Commons, free licences): [`refs/sea-spots/`](refs/sea-spots/) with `LICENSES.md` in each folder.

## 1. How the top 10 was chosen

Composite of: Tripadvisor Seattle ranking (via Stacker, data 2024-05-31, rank + review count), Visit Seattle "Top 25" (2026), Lonely Planet top things (2025), Wikivoyage Seattle/Downtown/Fremont "See" lists and remarks, published visitor numbers; owner must-haves (Fremont Troll, Gum Wall) forced in; scenes must be small walkable outdoor places (indoor-only or far-flung venues demoted).

Evidence snapshot (Tripadvisor via Stacker, data as of 2024-05-31; rank = Tripadvisor Seattle rank, reviews in brackets): #1 Chihuly Garden and Glass (25,026), #2 Pike Place Market (21,952), #3 Space Needle (19,894), #4 Museum of Flight (6,866), #5 Washington State Ferries (8,588), #6 Kerry Park (3,510), #7 T-Mobile Park (4,411), #8 Hiram M. Chittenden Locks (3,258), #9 MoPOP (7,258), #10 Sky View Observatory, #11 Seattle Public Library, #12 Klondike Gold Rush NHP, #15 Seattle Center, #16 Great Wheel (2,946), #20 Smith Tower (821), #26 Seattle Waterfront, #28 Aquarium (4,334), #30 Gas Works Park (995). Visit Seattle Top 25 (2026): 1 Seattle Center (Needle, Chihuly, MoPOP), 2 Pike Place Market (sign, Rachel, Gum Wall, original Starbucks, fish), 3 SAM, 4 Waterfront (Great Wheel, Aquarium, Overlook Walk), 8 Kerry Park, 9 Pioneer Square (Smith Tower, Underground), 11 Ballard, 15 Gas Works. Lonely Planet (2025): Discovery Park, Pike Place, MoPOP, ferries, coffee, Capitol Hill, Space Needle, Lake Union, public art, …, Ballard Locks (13), Chihuly (15), Underground (16). Visitor numbers: Pike Place ~10 M/yr (City of Seattle via KIRO 7; Wikipedia: 20.9 M visits in 2023), Space Needle ~1.3 M/yr (official), Ballard Locks >1 M (Wikipedia; >2 M per Army Corps via Cascade PBS), Bellevue Square >23 M/yr (2014).

### Seattle top 10

| # | Spot | Why (evidence) |
|---|---|---|
| 1 | **Pike Place Market & the Gum Wall** (`pike-place`) | Tripadvisor #2 in Seattle (21,952 reviews, 4.5/5); Visit Seattle #2; Lonely Planet #2; ~10 M visitors/yr per City of Seattle (Wikipedia cites 20.9 M total visits in 2023). Owner explicitly asked for the Gum Wall. |
| 2 | **Chihuly Garden and Glass** (`chihuly`) | Tripadvisor #1 in Seattle (25,026 reviews, 5/5); Visit Seattle #1 (Seattle Center); Lonely Planet #15. |
| 3 | **Space Needle & Seattle Center** (`space-needle`) | Tripadvisor #3 (19,894 reviews); Visit Seattle #1 ("Explore Seattle Center"); Lonely Planet #7; ~1.3 M guests/yr (Space Needle official); Wikivoyage: "The first thing that pops into most people's minds". |
| 4 | **Fremont Troll (the Troll under the Bridge)** (`fremont-troll`) | Owner's explicit must-have; Wikivoyage Fremont "Strikingly large (photos generally don't do it justice)"; widely called one of Seattle's most photographed sights; Klook lists 52K+ reviews. Not in Tripadvisor's Seattle top 30 (it is free public art, not a ticketed attraction). |
| 5 | **Kerry Park viewpoint** (`kerry-park`) | Tripadvisor #6 (3,510 reviews); Visit Seattle #8 "Capture the perfect shot"; Wikivoyage: "the most photographed view of Seattle". |
| 6 | **Museum of Pop Culture (MoPOP)** (`mopop`) | Tripadvisor #9 (7,258 reviews); Lonely Planet #3; Visit Seattle #1 (Seattle Center). |
| 7 | **Waterfront: Great Wheel, Pier 57, Aquarium & Overlook Walk** (`waterfront`) | Visit Seattle #4 "Wander the waterfront"; Tripadvisor: Great Wheel #16 (2,946), Seattle Waterfront #26, Aquarium #28 (4,334 reviews); ~4 M waterfront users/yr (City via KIRO). |
| 8 | **Pioneer Square & Smith Tower** (`pioneer-square`) | Visit Seattle #9 "Step through history in Pioneer Square"; Tripadvisor: Klondike Gold Rush NHP #12, Smith Tower #20; Lonely Planet #16 (Underground); Wikivoyage Seattle highlights the Underground tours. |
| 9 | **Ballard Locks (Hiram M. Chittenden Locks) & fish ladder** (`ballard-locks`) | Tripadvisor #8 (3,258 reviews); Lonely Planet #13; Visit Seattle #11 (Ballard); >1 M visitors/yr (Wikipedia; Army Corps via Cascade PBS: >2 M). |
| 10 | **Gas Works Park** (`gas-works`) | Tripadvisor #30 (995 reviews); Visit Seattle #15 standout green space; spec 15 candidate; iconic in film (Singles, 10 Things I Hate About You) and The Amazing Race. First alternate if replaced: Seattle Central Library (TA #11, VS #14). |

The Fremont Troll is not in Tripadvisor's top 30 (free public art, not a ticketed venue) but is the owner's explicit must-have and Wikivoyage's Fremont highlight; the Gum Wall is part of the Pike Place scene. Space Needle, Chihuly and MoPOP share one Seattle Center scene (≤150 m apart) with three spawn points.

Alternates considered and why they lost:

- Museum of Flight — Tripadvisor #4 (6,866 reviews): Indoor aviation museum 15 km south at Boeing Field; not a walkable street-scale icon.
- Washington State Ferries (Colman Dock) — Tripadvisor #5 (8,588): An activity; ferries appear as backdrop in the waterfront and Kerry Park scenes.
- T-Mobile Park / Lumen Field — Tripadvisor #7 / #19: Stadium interiors; visible from the Pioneer Square scene.
- Sky View Observatory (Columbia Center) — Tripadvisor #10: Indoor observation deck; Space Needle covers the view experience.
- Seattle Central Library — Tripadvisor #11, Visit Seattle #14: Mostly an interior experience — first alternate if Gas Works is dropped.
- Seattle Art Museum / Hammering Man / Olympic Sculpture Park — Visit Seattle #3: Lower on Tripadvisor (#25); artworks in copyright.
- Discovery Park — Lonely Planet #1, Tripadvisor #24: 534-acre wild park — not a small iconic scene.
- Woodland Park Zoo — Tripadvisor #13, Visit Seattle #22: Animals/indoor exhibits; large.

### Bellevue top 4

| # | Spot | Why (evidence) |
|---|---|---|
| 1 | **Lincoln Square, Bellevue Square & the skybridges (UiPath Bellevue)** (`bel-lincoln-square`) | Wikivoyage Bellevue lists Bellevue Square as "the flagship mall of the city" connected by skybridge to Lincoln Square; Bellevue Square drew >23 M visitors/yr (2014, Wikipedia); Visit Bellevue shopping/dining focus; personally: UiPath's Bellevue office moved here in 2025 (GeekWire) — the game's final CV chapter. |
| 2 | **Bellevue Downtown Park** (`bel-downtown-park`) | Wikivoyage Bellevue "Downtown Park" (cascading waterfall in a circular loop); PlanetWare #1 attraction in Bellevue; Visit Bellevue listing; city flagship park. |
| 3 | **Bellevue Botanical Garden** (`bel-botanical-garden`) | Wikivoyage: "A must-see, especially the Garden d'Lights in the winter"; top-rated on aggregators (Wanderlog #1); free admission (City of Bellevue). |
| 4 | **Meydenbauer Bay Park** (`bel-meydenbauer`) | Wikivoyage Bellevue (closest public lake access to downtown); Visit Bellevue outdoors; reopened 2019 with the crescent pier. |

Alternates: Bellevue Arts Museum (Building sale to KidsQuest announced Oct 2025 (Wikipedia); included as a façade in the Lincoln Square scene.); The Bravern (Luxury mall/office complex; less visitor evidence than Bellevue Square.); Old Main Street (One block south of Downtown Park — optional extension of that scene (Visit Bellevue "Explore Bellevue's Old Main Street").); Mercer Slough Nature Park / Kelsey Creek Farm (Large natural areas; listed by Wikivoyage/PlanetWare but lower profile.)

Ranking sources: [ta_stacker](https://stacker.com/washington/seattle/highest-rated-things-do-seattle-according-tripadvisor), [vs_top25](https://visitseattle.org/things-to-do/sightseeing/top-25-attractions/), [lp_top](https://www.lonelyplanet.com/articles/top-things-to-do-in-seattle), [wv_seattle](https://en.wikivoyage.org/wiki/Seattle), [wv_downtown](https://en.wikivoyage.org/wiki/Seattle/Downtown), [wv_fremont](https://en.wikivoyage.org/wiki/Seattle/Fremont), [wv_bellevue](https://en.wikivoyage.org/wiki/Bellevue), [vb_attr](https://www.visitbellevuewa.com/things-to-do/attractions/), [kiro_ppm10m](https://www.kiro7.com/news/local/city-of-seattle-plans-to-extend-pike-place-market-to-waterfront/545245400), [needle_facts](https://www.spaceneedle.com/facts-1), [cascadepbs_locks](https://www.cascadepbs.org/environment/2025/02/key-maintaining-and-renovating-seattles-ballard-locks), [wp_ppm](https://en.wikipedia.org/wiki/Pike_Place_Market), [wp_bellsq](https://en.wikipedia.org/wiki/Bellevue_Square)

## 2. Cross-cutting findings for the spots builder

- **Copyright (important):** the US has no freedom of panorama for artworks. The Fremont Troll's artists hold image rights and have sued commercial users (free for non-profits, per Wikipedia). Chihuly glass, Rachel (Gerber 1986), Changing Form (1971), Piloti (2023), Typewriter Eraser are in copyright too. Build stylised versions from the descriptions (no photo textures); orchestrator/owner to confirm the Troll replica for this non-commercial portfolio. Few Troll photos survive on Commons for this reason (only one full view found).
- **UiPath Bellevue:** UiPath's offices page lists **Lincoln Square North, 700 Bellevue Way NE, Suite 2000** (found by research-sea-districts, see `seattle-bellevue.md` §6.1); GeekWire (2025): two floors, 44,735 sq ft, product & engineering hub, moved Sept 2025. Tower = 28-floor, 126 m blue-grey glass office tower at the SE corner of NE 8th × Bellevue Way; staff entrance on the Bellevue Way frontage (OSM entrance 7945526075). Lobby/suite look and the second floor are not public — **owner to confirm**. Note for world role: `cities.js` `uipath-bel` POI is still at Plaza Center (10900 NE 8th St) while its address string already says "Lincoln Square since 2025" — the door should move ~400 m west to 47.61723,-122.20148.
- **Pike Place is pedestrian:** a car-free trial began April 2025 and was extended into 2026 with planters/fences at entrances (Wikipedia) — no through traffic on the brick street in the scene.
- **Gas Works towers are deadly in real life** (three fatal falls 2012/2022/2025): fence them, no climbing interaction.
- **Bellevue Arts Museum** building sale to KidsQuest announced Oct 2025 — keep the Steven Holl façade, check signage.
- **Waterfront**: the Alaskan Way Viaduct is gone; Overlook Walk (2024) and Ocean Pavilion (Aug 2024) and rebuilt Pier 58 (2025) are new — older photos are outdated.
- **Terrain**: USGS 3DEP samples on a 40 m grid per spot (`*.terrain.json`); over water/shoreline the bare-earth value is ~0 m — use OSM piers/coastline there. EPQS takes ~15 s per point, so the grid is coarse; densify locally if needed.
- **Colours**: hex values are estimates; structures with `ref_check` were verified against a reference photo (Troll, Pike Place sign).

## 3. Spots

### 1. Pike Place Market & the Gum Wall — `pike-place` (seattle)

Seattle's 1907 public market under the red "PUBLIC MARKET CENTER" neon sign: flying fish, Rachel the bronze pig, the original Starbucks and the Gum Wall in Post Alley.

- **Walkable extent:** 398 m E-W × 376 m N-S (9.32 ha); polygon in JSON. Pike St from 1st Ave down to the Main Arcade corner (sign, clock, Rachel, Pike Place Fish), Pike Place north (brick, pedestrian since 2025 trial) past Beecher's, Le Panier, Piroshky Piroshky and the original Starbucks (1912 Pike Pl) to Victor Steinbrueck Park; Post Alley south under the market to the Gum Wall / Market Theater; MarketFront plaza (2017) west over the bluff. Lower levels (Down Under) and Hillclimb are optional interiors/edges.
- **Terrain:** -0.36–49.96 m NAVD88 in the grid; spawn ground 36.8 m. Pike Place level ~30 m NAVD88 at Pike St (USGS EPQS 30.1 m at 47.6085,-122.3405); bluff drops ~20 m to Western Ave/Alaskan Way. Post Alley at the Gum Wall is ~1 storey below Pike St (stairs + ramp under the Pike St bridge/arcade).
- **Spawn:** 47.60897, -122.33987 heading 229° — Pike St at 1st Ave, looking down Pike St at the sign + clock (classic arrival view).
- **Key structures:**
  - Main Arcade (incl. 1900 Leland Hotel, 1907/1914 Goodwin & Willatsen) — height_m: 2-3 storeys street side (≈10–11 m); 4–6 storeys below toward Western Ave; length_m: ≈ 290 m along Pike Place (Main + North Arcade) — OSM w231357660, w1271653801, w1271653800
  - "PUBLIC MARKET CENTER" neon sign and clock — height_m: ≈ 9–10 m ("three stories tall"); width_m: ≈ 14–16 m letter row (estimate from photos); clock_diameter_m: ≈ 2.5–3 (estimate) — OSM n4217400413
  - Rachel the Piggy Bank (Georgia Gerber, 1986) — size_cm: ≈ 91 × 168 × 41 (36 × 66 × 16 in); weight_kg: 250 — OSM n3559896932
  - Gum Wall (Market Theater, Post Alley) — length_m: 16.5; dense_height_m: 2.4; max_height_m: 4.6; note: 2024: 54 ft long × 8 ft high, ~180 pieces/brick; earlier reached 15–20 ft — OSM n2443738130, n2397493563
  - Original Starbucks (1912 Pike Place) — frontage_m: ≈ 6 m; height_m: 2 storeys (Soames-Dunn Building, 1918) — OSM n2397461017
  - Corner Market (1912) & Sanitary Market (1910/1942) east of Pike Place — height_m: 11.1 — OSM w206858876, w206858888, r5402577
  - MarketFront (2017) + viewpoints over Elliott Bay — OSM w184870424, n12223598541, n12223870944
  - Victor Steinbrueck Park + two Haida-style poles (James Bender) — OSM w14026690, n3211770167, n3211770169
- **Signage:** "PUBLIC / MARKET / CENTER + clock" (rooftop over the Pike St entrance (Main Arcade corner)); "MEET THE PRODUCER" (rooftop billboard on the building across Pike Place from the clock sign (right of the FARMERS MARKET entrance when viewed from Pike St)); "FARMERS MARKET" (neon over the arcade entrance just right of/below the clock sign at Pike St (ref photo); the Market also credits Willatsen with a Farmers Market neon at Pike Place & Pine St); "PIKE PLACE FISH" (over the fish stall at the corner); "STARBUCKS (original siren)" (1912 Pike Place); "MARKET THEATER" (Post Alley beside the Gum Wall); ""No Gum" signs" (businesses opposite the Gum Wall)
- **Iconic photo:** from [47.60897, -122.33987] heading 229°, pitch 8°, FOV 55° — Looking down Pike St: the PUBLIC MARKET CENTER sign and clock above the arcade corner, fish stall and crowds below; best at blue hour when the neon glows.
- **Fun interaction:** Stick gum on the Gum Wall: buy a gum pack at a stall (or from inventory), aim at the wall, choose a colour; the blob persists for the session (instanced decal). Bonus: arrange 5 blobs into a heart for an achievement.
- **Plaques:**
  - *Since 1907* — Pike Place Market opened on August 17, 1907, and is one of the oldest continuously operated public farmers' markets in the United States. ([source](https://en.wikipedia.org/wiki/Pike_Place_Market))
  - *The sign* — The Public Market Center clock and sign went up on a new 1937 roof; designed by architect Andrew Willatsen, it was one of the largest neon signs on the West Coast. ([source](https://www.pikeplacemarket.org/pike-place-market-clock-upgrade/))
  - *Rachel* — Rachel, a 550 lb bronze piggy bank by Georgia Gerber, was dedicated on the market's 79th birthday in 1986; donations fund the Market's social services. ([source](https://en.wikipedia.org/wiki/Rachel_(Gerber)))
  - *Flying fish* — Pike Place Fish Market (founded 1930) nearly went bankrupt in 1986, then became "world famous" by throwing fish; up to 10,000 people watch on a summer day. ([source](https://en.wikipedia.org/wiki/Pike_Place_Fish_Market))
  - *The Gum Wall* — Gum started appearing here in the 1990s while theatre-goers waited in line; as of 2024 the wall is 54 ft long and 8 ft high, about 180 pieces of gum per brick. ([source](https://en.wikipedia.org/wiki/Gum_Wall))
  - *Original Starbucks* — Starbucks opened in 1971 at 2000 Western Ave and moved to 1912 Pike Place in 1977, where it still uses the original siren logo. ([source](https://en.wikipedia.org/wiki/Original_Starbucks))
- **What a local would notice if wrong:**
  - The sign has THREE rows (PUBLIC / MARKET / CENTER) with the clock beside it on a black X-braced frame — not one line of text
  - Neon is red; FARMERS MARKET neon (orange-red, green border) over the arcade entrance; teal MEET THE PRODUCER billboard with bulbs
  - Pike Place is red brick and (since Apr 2025) effectively pedestrian — no traffic stream through the market
  - Rachel stands on the sidewalk under the sign at the arcade corner, polished snout/back
  - The fish stall is at the Pike St corner, crew in orange bib overalls throwing whole salmon
  - The Gum Wall is DOWN in Post Alley under the market (stairs from Pike St), both walls, densest at 0.5–2.4 m
  - Original Starbucks is a narrow storefront with a queue, on the EAST side of Pike Place at 1912
  - Elliott Bay and the Great Wheel are visible from the MarketFront/west edge — the market sits on a bluff
- **Coverage:** 8 structures, 6 plaques, 20 reference images (+0 vetted candidates listed), 29 dialogue lines (greeting 2, bumped 2, photographed 2, idle 1, spot 21, rain 1), OSM extract `osm/sea-spots/pike-place.json`.

### 2. Chihuly Garden and Glass — `chihuly` (seattle)

Dale Chihuly's glass art museum at the foot of the Space Needle: a 40-ft glass-and-steel Glasshouse with a 100-ft red-orange-yellow suspended sculpture and a garden of glass among plants.

- **Walkable extent:** 173 m E-W × 177 m N-S (3.05 ha); polygon in JSON. The 1.5-acre plot: exterior Garden (fenced, ticketed), Glasshouse, Art Plaza; inside galleries optional (dark rooms with lit glass). Walkable perimeter outside the fence for free view.
- **Terrain:** 36.7–47.13 m NAVD88 in the grid; spawn ground 43.1 m. flat
- **Spawn:** 47.6204, -122.3504 heading 80° — Garden path west of the Glasshouse looking east to the Glasshouse with the Needle above it.
- **Shared scene:** `seattle-center` — Space Needle, Chihuly Garden and Glass and MoPOP stand within ~150 m of each other on the 1962 World's Fair grounds. Build ONE scene (polygon union ≈ 290 × 330 m) with three spawn points / plaque sets; loadSpot(id) picks the spawn.
- **Key structures:**
  - Glasshouse (2012; Chihuly with Owen Richards Architects) — height_m: 12.2; floor_area_m2: 418; sculpture_length_m: 30.5 — OSM w329416207
  - The Garden
  - Exhibition Hall (repurposed 1962-era building) + Bar at Chihuly — OSM w329416198
- **Signage:** "CHIHULY GARDEN AND GLASS" (entrance on the Needle plaza side)
- **Iconic photo:** from [47.62061, -122.35022] heading 95°, pitch 45°, FOV 75° — Inside the Glasshouse looking up through the red-orange sculpture and glass roof to the Space Needle
- **Fun interaction:** Glass-light puzzle: walk under the suspended sculpture at different times of day; when the sun breaks through, coloured light patches on the floor — photograph three colours in one frame for the postcard.
- **Plaques:**
  - *The Glasshouse* — 40 ft tall and 4,500 sq ft, the Glasshouse holds one of Chihuly's largest suspended sculptures, about 100 ft long in red, yellow and orange. ([source](https://chihulygardenandglass.com/about/glasshouse))
  - *From fun fair to garden* — It opened on May 21, 2012 on the site of the former Fun Forest amusement park. ([source](https://en.wikipedia.org/wiki/Chihuly_Garden_and_Glass))
  - *Green building* — The Glasshouse is LEED certified: radiant floors, natural ventilation through sliding doors and recycled glass, steel and gypsum. ([source](https://chihulygardenandglass.com/about/exhibition))
- **What a local would notice if wrong:**
  - The Glasshouse is tall and narrow with a pitched roof and the Needle rising directly behind it
  - The big sculpture is red/orange/yellow/amber only — no blues inside the Glasshouse
  - Garden glass is integrated in dense planting, not on plinths
  - It is fenced and ticketed; the Needle base is a few steps east
- **Coverage:** 3 structures, 3 plaques, 6 reference images (+0 vetted candidates listed), 20 dialogue lines (greeting 1, bumped 1, photographed 2, idle 2, spot 13, rain 1), OSM extract `osm/sea-spots/chihuly.json`.

### 3. Space Needle & Seattle Center — `space-needle` (seattle)

The 605-ft (184 m) 1962 World's Fair tower with its flying-saucer top, glass "Loupe" floor and the Seattle Center grounds at its feet.

- **Walkable extent:** 233 m E-W × 243 m N-S (5.48 ha); polygon in JSON. Needle base pavilion and plaza, Howard S. Wright Memorial Fountain, Chihuly exterior, Monorail station and track, MoPOP south front, Broad St / 5th Ave N edges.
- **Terrain:** 30.94–46.34 m NAVD88 in the grid; spawn ground 41.9 m. Gentle; base ~40 m elevation (OSM ele=40).
- **Spawn:** 47.61995, -122.34935 heading 0° — South base plaza by the Howard S. Wright fountain looking north up at the Needle.
- **Shared scene:** `seattle-center` — Space Needle, Chihuly Garden and Glass and MoPOP stand within ~150 m of each other on the 1962 World's Fair grounds. Build ONE scene (polygon union ≈ 290 × 330 m) with three spawn points / plaque sets; loadSpot(id) picks the spawn.
- **Key structures:**
  - Space Needle (1962; John Graham Jr. / Edward Carlson; Victor Steinbrueck) — total_height_m: 184.4; observation_deck_m: 158.5; top_width_m: 42.1; skyline_level_m: 30.5; base_foundation: 36.6 m square, 9.1 m deep; weight_t: 8660; osm_parts: core/legs to 152.4 m; saucer glass bands 152.4–156.1 and 158.1–161.2 m; roof 166.9–170.3 m; pyramidal spire cap to 181.1 m; SkyLine ring 30.5–36.6 m; mid ring 61.0–64.0 m — OSM w12903132, w394254330, w394254334, w394254484, w394254488
  - Base pavilion / gift shop + ticketing
  - Howard S. Wright Memorial Fountain — OSM w241876412
  - Seattle Center Monorail (1962, ALWEG) + Seattle Center station — OSM w161609433
- **Signage:** "SPACE NEEDLE" (base pavilion / ticket entrance); "Seattle Center" (wayfinding pylons)
- **Iconic photo:** from [47.62, -122.3493] heading 0°, pitch 60°, FOV 70° — Straight up the legs from the south base
- **Fun interaction:** Ride the elevator (41 s cut-scene) to the observation deck: a 360° view from 158 m using a pre-rendered or low-poly city panorama + the Loupe glass floor (look down).
- **Plaques:**
  - *605 feet* — Built for the 1962 World's Fair, the Space Needle is 605 ft (184 m) tall and was the tallest structure west of the Mississippi when it opened. ([source](https://en.wikipedia.org/wiki/Space_Needle))
  - *Built fast* — It was finished in less than a year; the last elevator car was installed the day before the fair opened on April 21, 1962. ([source](https://en.wikipedia.org/wiki/Space_Needle))
  - *Original colours* — 1962 paint: Orbital Olive, Astronaut White, Re-entry Red and Galaxy Gold — the gold roof returned for the 50th and 60th anniversaries. ([source](https://en.wikipedia.org/wiki/Space_Needle))
  - *Glass floor* — Since 2018 "The Loupe" has a revolving glass floor that turns once every 45 minutes. ([source](https://en.wikipedia.org/wiki/Space_Needle))
  - *Built to last* — The tower is designed for 200 mph winds and a magnitude 9.0 earthquake; its foundation weighs as much as the tower above ground. ([source](https://en.wikipedia.org/wiki/Space_Needle))
- **What a local would notice if wrong:**
  - Six slender legs in three pairs, pinched waist, saucer at 158 m — proportions are everything
  - Today's roof is white/light; Galaxy Gold orange only in 1962, 2012 and 2022–23
  - Exterior glass elevators on the core
  - Monorail beam runs along 5th Ave N and into MoPOP, not past the Needle base
- **Coverage:** 4 structures, 5 plaques, 9 reference images (+0 vetted candidates listed), 21 dialogue lines (greeting 1, bumped 1, photographed 2, idle 3, spot 13, rain 1), OSM extract `osm/sea-spots/space-needle.json`.

### 4. Fremont Troll (the Troll under the Bridge) — `fremont-troll` (seattle)

An 18-ft (5.5 m) concrete troll crouching under the north end of the Aurora Bridge, crushing a real Volkswagen Beetle in its left hand.

- **Walkable extent:** 150 m E-W × 243 m N-S (3.04 ha); polygon in JSON. Troll Ave N under the Aurora Bridge from N 34th/35th St up to N 36th St, the Troll and its stair/terrace, Troll's Knoll Park (east slope) and P-Patch; bridge piers and the underside of the deck as a ceiling. Optional link SW to Fremont centre ("Waiting for the Interurban", Fremont Bridge, 220 m).
- **Terrain:** 15.78–45.49 m NAVD88 in the grid; spawn ground 33.1 m. Troll Ave climbs north (see terrain grid). The Aurora Bridge deck is ~51 m above Lake Union at mid-span; at the Troll's north-end site the approach arches are low: crown ≈ 9–10 m above the Troll's base (ref photo).
- **Spawn:** 47.6506, -122.34722 heading 2° — On Troll Ave N ~50 m south of the Troll, looking north up the slope into the shadow under the bridge — the reveal.
- **Key structures:**
  - The Troll (1990; Steve Badanes, Will Martin, Donna Walter, Ross Whitehead) — height_m: 5.5; weight_kg: 5900; footprint_m: ≈ 7 × 9 (estimate from photos); beetle: VW Type 1 ≈ 4.07 × 1.54 × 1.50 m — OSM n2485251324
  - Aurora Bridge / George Washington Memorial Bridge (1932, SR 99) — length_m: 898; width_m: 21.3; height_above_water_m: 51; main_span_m: 145; lanes: 6 — OSM w370645739, w378090317
  - Troll's Knoll Park + P-Patch — OSM w295288784, w554528163
  - Moss Turtle (Michiko Tanaka, 2020) — OSM n11849109533
- **Signage:** "Troll Ave N" (green street-name sign at N 36th St); "N 36 St" (intersection)
- **Iconic photo:** from [47.65085, -122.34725] heading 4°, pitch 8°, FOV 70° — Troll head-on framed by the concrete arch, splayed hand left, Beetle under the left hand on the right, stairs at right edge
- **Fun interaction:** Climb the Troll: scripted climb points on the left hand → wrist → nose → top of the head (stairs behind); sit-on-the-Beetle and stand-on-the-hand poses for photo mode.
- **Plaques:**
  - *The Troll* — Built in 1990 by Steve Badanes, Will Martin, Donna Walter and Ross Whitehead; 18 ft tall, 13,000 lb of steel rebar, wire and concrete. ([source](https://en.wikipedia.org/wiki/Fremont_Troll))
  - *A real Beetle* — The Troll clutches a real Volkswagen Beetle with a California licence plate; it once held a time capsule with a plaster bust of Elvis. ([source](https://en.wikipedia.org/wiki/Fremont_Troll))
  - *Why a troll?* — The Fremont Arts Council's 1990 competition wanted art to reclaim the space under the bridge; the troll-under-a-bridge idea comes from Scandinavian folklore. ([source](https://en.wikipedia.org/wiki/Fremont_Troll))
  - *Troll Avenue* — In 2005 this stretch of Aurora Avenue North under the bridge was renamed Troll Avenue. ([source](https://en.wikipedia.org/wiki/Fremont_Troll))
  - *The bridge above* — The Aurora Bridge opened on February 22, 1932 — George Washington's 200th birthday — and is 167 ft above the water. ([source](https://en.wikipedia.org/wiki/Aurora_Bridge))
- **What a local would notice if wrong:**
  - The Troll is under CONCRETE ARCHES of the bridge approach, not a steel girder deck
  - Only head, shoulders and two hands emerge; viewer-left hand splayed, viewer-right hand on the Beetle
  - The Beetle is grey (painted), not a shiny coloured car
  - One hubcap eye; the other hidden under hair
  - Concrete stairs on the right side up to the head; boulders around; people climbing
  - Troll Ave N slopes down to the south toward N 34th St and the ship canal
- **Coverage:** 4 structures, 5 plaques, 6 reference images (+0 vetted candidates listed), 22 dialogue lines (greeting 1, bumped 1, photographed 2, idle 2, spot 15, rain 1), OSM extract `osm/sea-spots/fremont-troll.json`.

### 5. Kerry Park viewpoint — `kerry-park` (seattle)

A small terrace on Queen Anne Hill with Seattle's postcard view: the Space Needle in front of the downtown towers, Elliott Bay to the right and Mount Rainier behind on clear days.

- **Walkable extent:** 225 m E-W × 144 m N-S (3.24 ha); polygon in JSON. The 1.26-acre park strip along W Highland Dr between 2nd and 3rd Ave W: sidewalk, lawn terrace, railing edge, Changing Form sculpture, stairs west down to W Prospect St and Bayview-Kinnear Park (playground). Highland Dr mansions as the north backdrop.
- **Terrain:** 79.58–114.43 m NAVD88 in the grid; spawn ground 103.0 m. Park at ≈104 m (USGS EPQS 103.8 m at the viewpoint); Space Needle base ≈40 m, so its top (≈224 m) appears ~5.3° above the eye; slope falls ~60 m to Mercer St.
- **Spawn:** 47.6295, -122.3601 heading 141° — At the railing beside Changing Form, facing the Needle.
- **Key structures:**
  - Changing Form (Doris Totten Chase, 1971) — height_m: 4.6 — OSM n693337510
  - Viewing terrace + railing — OSM w49734702, n693337509
  - Stairs down to Bayview-Kinnear Park — OSM w50329131
- **Signage:** "KERRY PARK" (park sign near W Highland Dr)
- **Iconic photo:** from [47.62946, -122.35993] heading 143°, pitch 1°, FOV 35° — Space Needle centred-left, Columbia Center stack behind, Rainier to the right, at blue hour
- **Fun interaction:** "The Mountain is out": weather-dependent Rainier visibility — the postcard challenge requires Needle + Rainier in one frame (only possible on clear days in real weather, spec 18).
- **Plaques:**
  - *A gift of the view* — Albert S. and Katharine Kerry donated the land in 1927 "so that all who stop here may enjoy [its] view." ([source](https://en.wikipedia.org/wiki/Kerry_Park))
  - *Changing Form* — Doris Totten Chase's 15-ft steel sculpture (1971) is a favourite frame for photographers and a jungle gym for kids. ([source](https://en.wikipedia.org/wiki/Changing_Form))
  - *On screen* — Kerry Park's view opens 10 Things I Hate About You and is the view from Frasier's apartment. ([source](https://en.wikipedia.org/wiki/Kerry_Park))
- **What a local would notice if wrong:**
  - Needle LEFT-of-centre with Columbia Center stacked behind it; Rainier to the right (~11°) and far lower than the Needle top
  - The park is a narrow terrace on a steep slope, not a big lawn
  - Changing Form is black with a circular hole — people frame the skyline through it
  - Highland Dr mansions behind you
- **Coverage:** 3 structures, 3 plaques, 6 reference images (+0 vetted candidates listed), 20 dialogue lines (greeting 2, bumped 1, photographed 2, idle 2, spot 12, rain 1), OSM extract `osm/sea-spots/kerry-park.json`.

### 6. Museum of Pop Culture (MoPOP) — `mopop` (seattle)

Frank Gehry's "smashed guitar" of 21,000 stainless-steel and painted-aluminium shingles, with the Monorail gliding straight through it.

- **Walkable extent:** 218 m E-W × 276 m N-S (6.02 ha); polygon in JSON. All around the building: Sky Church lawn / Fisher Pavilion side, 5th Ave N, the monorail passage, Grass Blades screen (John Fleming 2002), Typewriter Eraser (Oldenburg), Chris Cornell statue.
- **Terrain:** 23.72–43.26 m NAVD88 in the grid; spawn ground 32.8 m. flat; monorail beam ~ 6–8 m overhead (estimate)
- **Spawn:** 47.6216, -122.3474 heading 250° — 5th Ave N side under the monorail beam, facing the purple/red/gold shingle masses.
- **Shared scene:** `seattle-center` — Space Needle, Chihuly Garden and Glass and MoPOP stand within ~150 m of each other on the 1962 World's Fair grounds. Build ONE scene (polygon union ≈ 290 × 330 m) with three spawn points / plaque sets; loadSpot(id) picks the spawn.
- **Key structures:**
  - MoPOP (2000, Frank O. Gehry) — floor_area_m2: 13006; footprint_m2: 3252; height_m: ≈ 26–30 m at highest lobes (estimate; OSM Sky Church part 22 m); panels: 3000; shingles: 21000 — OSM w161587742, w1092469435
  - Monorail passage through MoPOP — OSM w161609433
  - Grass Blades (John Fleming, 2002) — length_m: 44; height_m: 9.1; blades: 110 — OSM w1362384591
  - Typewriter Eraser, Scale X (Oldenburg & van Bruggen) — OSM n8533332630
  - Chris Cornell in Performance (Nick Marra, 2018) — OSM n6140930665
- **Signage:** "MoPOP" (entrance + banners); "Museum of Pop Culture" (wayfinding)
- **Iconic photo:** from [47.62175, -122.3472] heading 235°, pitch 12°, FOV 60° — Gehry shingle masses with the monorail emerging and the Space Needle behind
- **Fun interaction:** Monorail race: time your photo when the train passes through the building (shutter timing challenge).
- **Plaques:**
  - *Smashed guitar* — Gehry's team collected Stratocaster photos and guitar bodies while designing; the building was compared to "a smashed electric guitar". ([source](https://en.wikipedia.org/wiki/Museum_of_Pop_Culture))
  - *21,000 shingles* — 3,000 panels made of 21,000 individually cut stainless steel and painted aluminium shingles cover the outside. ([source](https://www.mopop.org/building))
  - *First with CATIA* — Gehry used the aerospace CAD software CATIA to design the building — the first architect to do so. ([source](https://www.mopop.org/building))
  - *Paul Allen* — Microsoft co-founder Paul Allen founded the museum in 2000 as the Experience Music Project. ([source](https://en.wikipedia.org/wiki/Museum_of_Pop_Culture))
- **What a local would notice if wrong:**
  - Monorail passes THROUGH the building
  - Distinct masses: matte silver, sky-blue, and an iridescent gold→magenta→purple mass, plus deep red — with a crumpled steel ribbon on top
  - Shingle skin shifts colour with angle — flat colours look wrong
- **Coverage:** 5 structures, 4 plaques, 6 reference images (+0 vetted candidates listed), 20 dialogue lines (greeting 1, bumped 1, photographed 1, idle 3, spot 13, rain 1), OSM extract `osm/sea-spots/mopop.json`.

### 7. Waterfront: Great Wheel, Pier 57, Aquarium & Overlook Walk — `waterfront` (seattle)

The rebuilt Elliott Bay waterfront: the 175-ft Seattle Great Wheel over the water at Pier 57, Miners Landing, the Aquarium and the 2024 Overlook Walk bridge up to Pike Place.

- **Walkable extent:** 293 m E-W × 398 m N-S (8.64 ha); polygon in JSON. Alaskan Way promenade from University St (Pier 56) to Pier 60, Pier 57 deck and Miners Landing, Waterfront Park (Pier 57–58, rebuilt 2025), Aquarium plaza (Pier 59) and Ocean Pavilion, Overlook Walk ramp/stairs up to MarketFront.
- **Terrain:** -0.36–36.98 m NAVD88 in the grid; spawn ground 0.6 m. Promenade ~3–5 m above sea level; Overlook Walk climbs ~20 m to MarketFront.
- **Spawn:** 47.6069, -122.3416 heading 215° — New Alaskan Way promenade at the foot of Union St looking SW to the Wheel.
- **Key structures:**
  - Seattle Great Wheel (2012) — height_m: 53.3; gondolas: 42; gondola_capacity: 8; overhang_over_water_m: 12.2; ride: 12 min, 3 revolutions — OSM n1809238334
  - Pier 57 / Miners Landing (1902) — OSM w166910699
  - Seattle Aquarium (1977, Piers 59/60) + Ocean Pavilion (Aug 2024) — OSM r16051213, w1256939021
  - Overlook Walk (2024) — OSM w1256939020
  - Waterfront Fountain (James FitzGerald & Margaret Tomkins) — OSM n13025976571
- **Signage:** "SEATTLE GREAT WHEEL" (ticket booth / pier entrance); "MINERS LANDING / PIER 57" (pier facade, painted wood sign); "SEATTLE AQUARIUM" (Pier 59 facade); "Ferries / Colman Dock wayfinding" (promenade pylons)
- **Iconic photo:** from [47.6069, -122.3416] heading 215°, pitch 15°, FOV 55° — Great Wheel with gondolas lit against Elliott Bay at dusk
- **Fun interaction:** Ride the Great Wheel: 3 revolutions in a gondola, camera free-look, best photo at the top (53 m) facing the skyline.
- **Plaques:**
  - *Over the water* — At 175 ft the Great Wheel was the tallest Ferris wheel on the US West Coast when it opened on June 29, 2012, and extends 40 ft over Elliott Bay. ([source](https://en.wikipedia.org/wiki/Seattle_Great_Wheel))
  - *Pier 57* — Built in 1902 for the John B. Agen Company, Pier 57 later served the Milwaukee Road railroad; the city traded it in 1989 for Piers 62/63. ([source](https://en.wikipedia.org/wiki/Pier_57_(Seattle)))
  - *Ocean Pavilion* — The Aquarium's Ocean Pavilion, devoted to the Coral Triangle, opened in August 2024. ([source](https://en.wikipedia.org/wiki/Seattle_Aquarium))
  - *Overlook Walk* — Completed in 2024, the Overlook Walk bridges Alaskan Way to link the waterfront with Pike Place Market. ([source](https://en.wikipedia.org/wiki/Overlook_Walk))
- **What a local would notice if wrong:**
  - The viaduct is GONE (removed 2019): open promenade, new plantings, Overlook Walk bridge
  - Great Wheel is white and overhangs the water at the end of Pier 57
  - Green-and-white WSF ferries, cranes of Harbor Island, Olympics across the bay
- **Coverage:** 5 structures, 4 plaques, 7 reference images (+0 vetted candidates listed), 21 dialogue lines (greeting 1, bumped 1, photographed 2, idle 3, spot 13, rain 1), OSM extract `osm/sea-spots/waterfront.json`.

### 8. Pioneer Square & Smith Tower — `pioneer-square` (seattle)

Seattle's 1890s birthplace: the cast-iron 1909 pergola, the Tlingit-style totem pole, red-brick Romanesque blocks, the Underground and the white terracotta Smith Tower (1914).

- **Walkable extent:** 308 m E-W × 332 m N-S (9.01 ha); polygon in JSON. Pioneer Place (triangular plaza at 1st Ave & Yesler Way): pergola, totem pole, Chief Seattle bust; Pioneer Building; Yesler Way east to Smith Tower at 2nd Ave; Occidental Ave S pedestrian mall south to Occidental Square (totems, firefighters memorial); Underground Tour entrance; 1st Ave historic façades.
- **Terrain:** 3.48–23.44 m NAVD88 in the grid; spawn ground 7.9 m. Gentle slope up east along Yesler Way toward 2nd Ave (≈ +8 m).
- **Spawn:** 47.60166, -122.3342 heading 20° — 1st Ave S sidewalk south of the pergola, looking north at pergola + Pioneer Building + totem pole.
- **Key structures:**
  - Pioneer Square Pergola (1909, Julian F. Everett; rebuilt 2002) — length_m: 18.3; height_m: 4.9 — OSM w52782041
  - Pioneer Square totem pole (replica 1938–40, carved by Charles Brown et al.) — height_m: 15.2 — OSM n3211770116
  - Chief Seattle Fountain (James Wehn, 1909) — OSM n3211770115
  - Pioneer Building (1892, Elmer Fisher) — height_m: 28; storeys: 6 — OSM w52782046
  - Smith Tower (1914, Gaggin & Gaggin) — roof_m: 140.8; pinnacle_m: 147.5; storeys: 38; base_block_m: 75; note: OSM height 75 m for the 22-storey base block; tower rises above to the pyramid — OSM w52781661
  - Occidental Square + Occidental Ave S mall — OSM w174692555, n3211770100, n3211770101, n3211770102, n3211770103, n2998927033
  - Sinking Ship Garage (1961) — OSM w52781697
- **Signage:** "Pioneer Square" (brown historic-district street-name blades); "UNDERGROUND TOUR" (Doc Maynard's, 1st Ave); "SMITH TOWER" (2nd Ave entrance + observatory banners); "Merchant's Cafe" (109 Yesler Way (1890))
- **Iconic photo:** from [47.60166, -122.3342] heading 20°, pitch 8°, FOV 60° — Pergola in front of the Pioneer Building with the totem pole on the left
- **Fun interaction:** Underground descent: a short scripted walk below the sidewalk among old storefronts, looking up at the purple vault lights from beneath.
- **Plaques:**
  - *The pergola* — Built in 1909 to shelter cable-car passengers, the pergola was destroyed by a truck in 2001 and rebuilt in 2002 using 99% original material. ([source](https://en.wikipedia.org/wiki/Pioneer_Square_pergola))
  - *Underground Seattle* — After the Great Fire of June 6, 1889, streets were raised by up to a storey, leaving old sidewalks and storefronts below — the Seattle Underground. ([source](https://en.wikipedia.org/wiki/Seattle_Underground))
  - *Purple glass* — The glass prisms in the sidewalks are vault lights that once lit the buried sidewalks; the clear glass later turned amethyst. ([source](https://en.wikipedia.org/wiki/Seattle_Underground))
  - *Smith Tower* — Completed in 1914 at 462 ft, Smith Tower was the tallest building on the West Coast until the Space Needle in 1962. ([source](https://en.wikipedia.org/wiki/Smith_Tower))
  - *The totem pole* — The original pole was taken from a Tlingit village in Alaska in 1899; today's pole is a replica carved in 1938–40. ([source](https://en.wikipedia.org/wiki/Pioneer_Square_totem_pole))
- **What a local would notice if wrong:**
  - Pergola is a triangular cast-iron shelter with a glass roof and bollards around it
  - Totem pole stands right next to it; Pioneer Building's red brick + round arches behind
  - Purple vault-light glass squares in the sidewalks
  - Smith Tower's white terracotta pyramid top up Yesler Way
  - Occidental Square: brick paving under big plane trees
- **Coverage:** 7 structures, 5 plaques, 3 reference images (+4 vetted candidates listed), 21 dialogue lines (greeting 1, bumped 1, photographed 1, idle 1, spot 16, rain 1), OSM extract `osm/sea-spots/pioneer-square.json`.

### 9. Ballard Locks (Hiram M. Chittenden Locks) & fish ladder — `ballard-locks` (seattle)

Boats from kayaks to fishing trawlers rise and fall 26 ft between Puget Sound and the lakes; salmon climb a 21-weir fish ladder past underwater windows; a botanical garden on the north bank.

- **Walkable extent:** 285 m E-W × 376 m N-S (10.29 ha); polygon in JSON. Carl S. English Jr. Botanical Garden and visitor centre (north), walkways across the lock walls and gates, large and small locks, spillway dam with tainter gates, south bank fish ladder + underground viewing room, Commodore Park edge.
- **Terrain:** -0.36–27.76 m NAVD88 in the grid; spawn ground 8.5 m. Upstream lake level 20–22 ft above sea level; Puget Sound tidal; lift up to 26 ft (7.9 m).
- **Spawn:** 47.6664, -122.397 heading 180° — North bank by the Administration Building looking south over the large lock.
- **Key structures:**
  - Large lock (1917) — length_m: 251.5; width_m: 24.4; lift_m: 7.9 — OSM w164115502, w472179860
  - Small lock — length_m: 45.7; width_m: 9.1 — OSM w164115503
  - Spillway dam — length_m: 71.6; gates: 6 tainter gates 9.8 × 3.7 m
  - Fish ladder (rebuilt 1976) + viewing room — weirs: 21; step_m: 0.3 — OSM n3413278212, n3211770269
  - Administration Building (1915), Operating Houses (1914), Control Tower (1969) — OSM w51475867, w285289605, w285289606, w223562285
  - Carl S. English Jr. Botanical Garden (1917) — OSM w51475864
- **Signage:** "Hiram M. Chittenden Locks" (entrance gate on NW 54th St); "US Army Corps of Engineers castle logo signs" (visitor centre, fences); ""Share the Shore with Harbor Seals"" (interpretive board (OSM)); ""Indian Fishing Rights"" (interpretive board (OSM))
- **Iconic photo:** from [47.6662, -122.3962] heading 200°, pitch -10°, FOV 60° — Large lock full of boats from the north wall with the gates and control tower
- **Fun interaction:** Operate a lockage (with an attendant NPC): close the lower gates, open the fill valve, watch the water rise and boats float up, open upper gates.
- **Plaques:**
  - *Busiest lock in the US* — The Ballard Locks carry more boat traffic than any other lock in the United States. ([source](https://en.wikipedia.org/wiki/Ballard_Locks))
  - *Lakes lowered* — Opening the canal in 1916 lowered Lake Washington by 8.8 ft, drying more than 1,000 acres of wetland. ([source](https://en.wikipedia.org/wiki/Ballard_Locks))
  - *Two locks* — The small lock is 30 × 150 ft and the large lock 80 × 825 ft; boats rise or fall up to 26 ft in 10–15 minutes. ([source](https://en.wikipedia.org/wiki/Ballard_Locks))
  - *Fish ladder* — Rebuilt in 1976 with 21 weirs, the ladder is unusual for sitting where salt and fresh water meet; peak sockeye viewing is July to mid-August. ([source](https://en.wikipedia.org/wiki/Ballard_Locks))
- **What a local would notice if wrong:**
  - Two locks side by side (large + small) with the spillway south; you walk across on the lock gates
  - Fish ladder and viewing room are on the SOUTH bank
  - Historic buildings with red tile roofs and a large garden on the north
  - Water level difference visible: lake side higher
- **Coverage:** 6 structures, 4 plaques, 0 reference images (+7 vetted candidates listed), 20 dialogue lines (greeting 2, bumped 1, photographed 1, idle 1, spot 14, rain 1), OSM extract `osm/sea-spots/ballard-locks.json`.

### 10. Gas Works Park — `gas-works` (seattle)

The rusted towers of the last US coal-gasification plant on a lawn promontory in Lake Union, a kite hill with a mosaic sundial and a skyline view across the water.

- **Walkable extent:** 397 m E-W × 299 m N-S (11.87 ha); polygon in JSON. Kite Hill with sundial, the fenced generator towers, Play Barn (painted exhauster-compressor building), Prow terrace on the south point, picnic shelter, lakeshore paths.
- **Terrain:** 4.98–18.2 m NAVD88 in the grid; spawn ground 10.9 m. Kite Hill summit ~20 m (OSM ele), park otherwise ~6–8 m above lake.
- **Spawn:** 47.6456, -122.3356 heading 160° — Path between Kite Hill and the towers, skyline across the lake.
- **Key structures:**
  - Gas generator towers (1906–1956 plant) — height_m: ≈ 15–25 (estimate; falls of 50 ft reported) — OSM w4835090, w425465783, w449626310, w449626314
  - Play Barn (former exhauster-compressor building)
  - Kite Hill + Gas Works Memorial Sundial (Charles Greening) — OSM w191328703, n31096103
- **Signage:** "GAS WORKS PARK" (entrance sign by the parking area); "Danger / keep out" (tower fence)
- **Iconic photo:** from [47.6447, -122.3345] heading 330°, pitch 12°, FOV 55° — Rusty towers against the sky
- **Fun interaction:** Fly a kite on Kite Hill (wind from real weather; higher wind = higher kite).
- **Plaques:**
  - *Last gasworks* — Gas Works Park holds the remnants of the sole remaining coal-gasification plant in the United States (1906–1956). ([source](https://en.wikipedia.org/wiki/Gas_Works_Park))
  - *Richard Haag* — Landscape architect Richard Haag kept the plant as an industrial ruin; the park opened in 1975. ([source](https://en.wikipedia.org/wiki/Gas_Works_Park))
  - *Strangest park* — A Seattle Times-affiliated site called it "easily the strangest park in Seattle and may rank among the strangest in the world". ([source](https://en.wikipedia.org/wiki/Gas_Works_Park))
- **What a local would notice if wrong:**
  - Rusty black-orange towers are fenced (not climbable)
  - Kite Hill is a grassy mound with a mosaic sundial on top
  - Downtown + Space Needle across Lake Union to the SSW, seaplanes landing
- **Coverage:** 3 structures, 3 plaques, 0 reference images (+6 vetted candidates listed), 20 dialogue lines (greeting 1, bumped 1, photographed 2, idle 3, spot 12, rain 1), OSM extract `osm/sea-spots/gas-works.json`.

### 1. Lincoln Square, Bellevue Square & the skybridges (UiPath Bellevue) — `bel-lincoln-square` (bellevue)

Downtown Bellevue's core at NE 8th St × Bellevue Way: Kemper Freeman's Bellevue Collection — the 1946 Bellevue Square mall, the Lincoln Square towers (UiPath's product & engineering hub since 2025) and the glass skybridges that tie them together.

- **Walkable extent:** 353 m E-W × 442 m N-S (15.6 ha); polygon in JSON. Both sides of Bellevue Way NE between NE 4th and NE 8th St: Bellevue Square east entrances (Nordstrom, Macy's, Apple, main east court), Lincoln Square (North office tower, One Lincoln Tower/Westin, 3-level retail podium with Cinemark, Lucky Strike, Din Tai Fung), Lincoln Square South (31-storey office tower, W Bellevue/Avalon tower, food hall), Bellevue Arts Museum, the skybridges; NE 8th × Bellevue Way corner with Bellevue Place/Hyatt across.
- **Terrain:** 36.93–54.53 m NAVD88 in the grid; spawn ground 49.5 m. Gentle slope; ground ~45–55 m (see terrain); skybridges at level 1 (~2nd floor, ≈ 6–7 m clearance over Bellevue Way — estimate).
- **Spawn:** 47.61755, -122.20195 heading 135° — NW corner of NE 8th St × Bellevue Way looking SE across the junction at Lincoln Square North (UiPath) with the Bellevue Way skybridge to the right.
- **Key structures:**
  - Lincoln Square North office tower (2005), 700 Bellevue Way NE — UiPath Bellevue, Suite 2000 — height_m: 126; storeys: 28; note: Wikipedia (2005 plan) says 27 storeys; OSM/GeekWire 28 — OSM w604028609
  - UiPath Bellevue entrance / lobby / signage — OSM n7945526075
  - One Lincoln Tower (Westin Bellevue hotel + condominiums, 2005) — height_m: 137; storeys: 42 — OSM w604028611, w328017119
  - Lincoln Square retail podium (2005) + Chihuly glass — storeys: 3; height_m: 10.9 — OSM w161929514, n11212853758, n11214221844
  - Lincoln Square South (2017): office tower + W Bellevue/Avalon tower + podium — office_height_m: 137; office_storeys: 31; residential_hotel_storeys: 41 — OSM w1326151866, w1326151868, w1326151818
  - Bellevue Square (1946; Kemper Development) — storeys: 3; gla_m2: 120774; stores: 200+ — OSM w29234887, w33106348, w497738386, w497739259
  - Skybridges — clear_height_m: ≈ 5.5–6.5 over roadway (estimate); width_m: ≈ 4–5 (estimate); length_m: (a) 32, (b) 58 diagonal, (c) 17 (from OSM geometry) — OSM w43872832, w43872826, w1222676052, w29234890, w497738385, w516915099
  - Bellevue Arts Museum building (2001, Steven Holl) — sale to KidsQuest Children's Museum announced Oct 2025 — OSM w33613449
  - NE 8th St × Bellevue Way intersection
- **Signage:** "LINCOLN SQUARE" (podium entrances, metal letters); "BELLEVUE SQUARE" (east entrance canopy); "THE BELLEVUE COLLECTION" (wayfinding pylons); "Westin" (hotel porte-cochère); "W" (Lincoln Square South hotel); "Bellevue Arts Museum" (BAM facade); "UiPath (tenant directory / suite)" (Lincoln Square North lobby — owner to confirm)
- **Iconic photo:** from [47.61712, -122.20195] heading 120°, pitch 20°, FOV 60° — Lincoln Square North and One Lincoln Tower with the Bellevue Way skybridge in the foreground
- **Fun interaction:** Badge in at UiPath: walk from the NE 8th corner into Lincoln Square North, tap a badge at the turnstile, ride to the UiPath floor — the final CV chapter "Principal Engineer 2025" unlock (ties to chapter uipath-bel).
- **Plaques:**
  - *Bellevue Square* — Bellevue Square opened on August 20, 1946 as "Bellevue Shopping Square"; it now has 200+ stores and drew over 23 million visitors a year (2014). ([source](https://en.wikipedia.org/wiki/Bellevue_Square))
  - *Skybridge* — In 2007 Bellevue Square was linked by skybridge to Lincoln Square; together they form the Bellevue Collection. ([source](https://en.wikipedia.org/wiki/Bellevue_Square))
  - *Lincoln Square* — Phase I opened in November 2005; the $1.2 billion Lincoln Square South expansion opened in 2016–17. ([source](https://en.wikipedia.org/wiki/Lincoln_Square_(Bellevue)))
  - *UiPath in Bellevue* — UiPath opened its first US development center in Bellevue in 2018 and in 2025 moved to Lincoln Square: two floors, 44,735 sq ft, its product and engineering hub. ([source](https://www.geekwire.com/2025/uipath-hires-former-f5-executive-as-cmo-relocates-bellevue-offices-to-lincoln-square/))
- **What a local would notice if wrong:**
  - Bellevue Way is wide (3–4 lanes each way with turn pockets) and the skybridge crosses it at ~NE 7th
  - Lincoln Square North (126 m) at the NE 8th corner; One Lincoln Tower (137 m) south of it; Lincoln Square South (137 m) further south
  - Nordstrom anchors the NE 8th end of Bellevue Square
  - Very little honking; pedestrians wait for the walk signal
  - Snowflake Lane drummers/"snow" in December
- **Coverage:** 9 structures, 4 plaques, 0 reference images (+7 vetted candidates listed, +2 shared in refs/bellevue/), 24 dialogue lines (greeting 2, bumped 2, photographed 1, idle 4, spot 14, rain 1), OSM extract `osm/sea-spots/bel-lincoln-square.json`.

### 2. Bellevue Downtown Park — `bel-downtown-park` (bellevue)

A 20-acre circle of lawn ringed by a half-mile promenade and a stepped canal ending in a 240-ft-wide waterfall, with the Bellevue skyline rising behind.

- **Walkable extent:** 420 m E-W × 321 m N-S (13.48 ha); polygon in JSON. Whole park: circular promenade, canal ring, waterfall + reflecting pool (south-west), central 10-acre meadow with the WWI memorial elms, NE Gateway plaza with Piloti (2023), Inspiration Playground (SW), formal gardens; Old Main Street is one block south.
- **Terrain:** 26.03–50.26 m NAVD88 in the grid; spawn ground 39.8 m. Mostly flat; waterfall drop ~3 m into the pond (estimate).
- **Spawn:** 47.6133, -122.2034 heading 200° — NE Gateway plaza (NE 4th × Bellevue Way) by the Piloti sculpture looking SW over the canal toward the waterfall.
- **Key structures:**
  - Canal + promenade ring — promenade_length_m: 805; meadow_area_ha: 4
  - Waterfall and reflecting pond — width_m: 73
  - Piloti (Marc Fornes / THEVERYMANY, 2023) — height_m: 7; panels: 6000; rivets: 180000 — OSM w1326469154
  - WWI memorial elms (1926) + "Lest We Forget" — OSM n5657152449
  - Inspiration Playground — OSM w503657594
- **Signage:** "DOWNTOWN PARK" (entrances)
- **Iconic photo:** from [47.6118, -122.2056] heading 40°, pitch 8°, FOV 65° — Waterfall and pond in front, Bellevue towers rising behind the trees
- **Fun interaction:** Walk the half-mile loop (timer + step counter achievement); toss a coin into the reflecting pond.
- **Plaques:**
  - *A park by competition* — An international design competition (67 entries) picked Beckley-Myers' circular promenade, canal and waterfall in 1984; the park opened in 1987. ([source](https://en.wikipedia.org/wiki/Bellevue_Downtown_Park))
  - *240-ft waterfall* — The half-mile promenade ends at a 240-ft-wide waterfall that falls into a reflecting pond. ([source](https://parks.bellevuewa.gov/parks-and-trails/nature-trails/downtown-park-trails))
  - *Remembering WWI* — The central elms are a 1926 memorial to Eastside World War I veterans, restored from 2015. ([source](https://en.wikipedia.org/wiki/Bellevue_Downtown_Park))
  - *Piloti* — Marc Fornes' 23-ft Piloti (2023) is made of 6,000 white aluminium panels held by 180,000 rivets. ([source](https://en.wikipedia.org/wiki/Bellevue_Downtown_Park))
- **What a local would notice if wrong:**
  - The canal is a full ring around the lawn (complete since 2017)
  - Waterfall is wide (240 ft) and low, in the SW
  - Bellevue Square directly north, skyline over the trees
- **Coverage:** 5 structures, 4 plaques, 0 reference images (+6 vetted candidates listed, +1 shared in refs/bellevue/), 20 dialogue lines (greeting 1, bumped 1, photographed 1, idle 4, spot 12, rain 1), OSM extract `osm/sea-spots/bel-downtown-park.json`.

### 3. Bellevue Botanical Garden — `bel-botanical-garden` (bellevue)

53 free acres of Pacific Northwest gardens: the Perennial Border, the Yao Japanese garden, a suspension bridge over the ravine and the winter Garden d'Lights.

- **Walkable extent:** 390 m E-W × 409 m N-S (15.97 ha); polygon in JSON. Core garden: visitor center, Perennial Border, Rock/Waterwise gardens, Urban Meadow, Yao Garden, Fuchsia garden, Lost Meadow Trail, the Ravine Experience suspension bridge.
- **Terrain:** 32.24–72.35 m NAVD88 in the grid; spawn ground 69.3 m. Hilly; ravine drops ~15 m under the suspension bridge (estimate; see terrain).
- **Spawn:** 47.6088, -122.1793 heading 180° — Outside the Shorts Visitor Center courtyard at the start of the Tateuchi Loop.
- **Key structures:**
  - Shorts Visitor Center
  - Ravine Experience suspension bridge — length_m: ≈ 45 (from OSM line ~50 m) — OSM w210457899
  - Yao Garden
  - Perennial Border (Northwest Perennial Alliance)
- **Signage:** "BELLEVUE BOTANICAL GARDEN" (entrance off Main St)
- **Iconic photo:** from [47.6065, -122.1774] heading 80°, pitch 0°, FOV 60° — Suspension bridge disappearing into ferns and firs
- **Fun interaction:** Cross the ravine suspension bridge (gentle sway physics).
- **Plaques:**
  - *From a gift* — What began as a 7-acre gift from the Shorts family in the early 1980s is now a 53-acre public garden, opened June 27, 1992. ([source](https://en.wikipedia.org/wiki/Bellevue_Botanical_Garden))
  - *Perennial Border* — Maintained by the Northwest Perennial Alliance and volunteers, the Perennial Border is described as the largest public perennial garden in America. ([source](https://en.wikipedia.org/wiki/Bellevue_Botanical_Garden))
  - *Yao Garden* — The Yao Garden celebrates Bellevue's sister city Yao, Japan, with plants from the Pacific Northwest, Japan and the Pacific Rim. ([source](https://en.wikipedia.org/wiki/Bellevue_Botanical_Garden))
  - *Free* — The garden is free and open dawn to dusk. ([source](https://bellevuewa.gov/city-government/departments/parks/parks-and-trails/parks/bellevue-botanical-garden))
- **What a local would notice if wrong:**
  - It is hilly forest with garden rooms, not a flat formal garden
  - Suspension bridge over a ravine; Yao Japanese garden
- **Coverage:** 4 structures, 4 plaques, 0 reference images (+5 vetted candidates listed), 19 dialogue lines (greeting 1, bumped 1, photographed 1, idle 3, spot 12, rain 1), OSM extract `osm/sea-spots/bel-botanical-garden.json`.

### 4. Meydenbauer Bay Park — `bel-meydenbauer` (bellevue)

Bellevue's lakefront: a sandy beach and a floating 420-ft crescent pier on Lake Washington with the Seattle skyline across the water.

- **Walkable extent:** 278 m E-W × 409 m N-S (11.36 ha); polygon in JSON. Beach, floating crescent pier, kayak rental pavilion, paved/unpaved trails up the ravine toward 100th Ave NE / Downtown Park, playground, restroom building.
- **Terrain:** 4.98–47.76 m NAVD88 in the grid; spawn ground 5.7 m. Ravine climbs ~25 m from the beach to Main St level.
- **Spawn:** 47.6106, -122.2108 heading 250° — Beach promenade at the root of the crescent pier looking out over Lake Washington.
- **Key structures:**
  - Floating crescent pedestrian pier (2019) — length_m: 128
  - Sand and gravel beach + lifeguard stand
  - Restroom/kayak pavilion
- **Signage:** "MEYDENBAUER BAY PARK" (entrance at Lake Washington Blvd)
- **Iconic photo:** from [47.6102, -122.2115] heading 270°, pitch 2°, FOV 45° — Crescent pier curving out with the Seattle skyline on the horizon at sunset
- **Fun interaction:** Rent a kayak (short paddle loop inside the bay) or skip stones from the beach.
- **Plaques:**
  - *Ferry landing* — From the 1890s until 1921 this was the landing for passenger ferries between Seattle and Bellevue. ([source](https://en.wikipedia.org/wiki/Meydenbauer_Bay_Park))
  - *First park* — In 1953 it became Bellevue's first park; it reopened in March 2019 with an expanded beach and a 420-ft floating crescent pier. ([source](https://en.wikipedia.org/wiki/Meydenbauer_Bay_Park))
  - *Wildwood Park* — The site once hosted Wildwood Park, a dance hall popular with Seattle residents. ([source](https://en.wikipedia.org/wiki/Meydenbauer_Bay_Park))
- **What a local would notice if wrong:**
  - Crescent-shaped floating pier, sandy beach, steep wooded ravine behind
  - Seattle skyline is far (≈9 km) and small on the horizon
- **Coverage:** 3 structures, 3 plaques, 0 reference images (+5 vetted candidates listed, +1 shared in refs/bellevue/), 19 dialogue lines (greeting 2, bumped 1, photographed 1, idle 3, spot 11, rain 1), OSM extract `osm/sea-spots/bel-meydenbauer.json`.

## 4. Crowds, dialogue and tone

- "Seattle Freeze": locals are described as "very polite but not particularly friendly" to strangers — keep local NPC lines courteous, brief, low-key; few unprompted chats. ([source](https://en.wikipedia.org/wiki/Seattle_Freeze))
- Washington ranked 48th of 50 states for extraversion (2008 study cited by Wikipedia) — locals default to nods, "sorry", "you're good". ([source](https://en.wikipedia.org/wiki/Seattle_Freeze))
- Honking is rare and seen as rude: ~3 in 4 Northwest drivers said they rarely or never honk (PEMCO 2017); attitudes softened by 2021 (65% say honking at least somewhat appropriate). NPC reaction to player honking near spots: surprised/disapproving, not aggressive. ([source](https://pemco.com/blog/horn-honking-nw-drivers))
- Coffee culture: Seattle drinks more coffee than any other US city; espresso small talk is a safe icebreaker. ([source](https://en.wikipedia.org/wiki/Coffee_in_Seattle))
- Rain talk is universal small talk; locals rarely use umbrellas (hoods/rain shells) — common local self-image, unsourced folklore: keep light. (design guidance)
- Visitors: Canada was 73% of Seattle's 2.4 M international visitors in 2024; then China, India, UK, South Korea, Germany, Japan, Australia, France, Taiwan — languages used: English, French (Québec), Mandarin, Hindi, Korean, German, Japanese, Spanish (domestic + Latin America). ([source](https://visitseattle.org/press/press-releases/visit-seattle-2025-annual-meeting/))
- Indigenous art (totems, Salish Welcome): staff/guides speak respectfully; no jokes about sacred objects. (design guidance)
- Guardrails: no stereotypes, accents written phonetically, slurs, politics or alcohol jokes about any group; tourists are curious and happy, locals helpful-but-reserved. (design guidance)

General pedestrian set (`dialogue_general.lines`, 49 lines) works in the Seattle and Bellevue driving districts too. Personas: `local`, `tech`, `tourist_us`, `tourist_ca`, `tourist_cn`, `tourist_in`, `tourist_kr`, `tourist_jp`, `tourist_de`, `tourist_es`, `fishmonger`, `vendor`, `busker`, `guide`, `staff`, `kid`, `photographer`. Non-English lines carry `orig` + `lang` (fr-CA, zh-Hans, hi, ko, ja, de, es) with the English `text` for subtitles.

## 5. Gaps / to verify

- UiPath's second floor, lobby and signage in Lincoln Square North (Suite 2000 confirmed; owner to describe the rest).
- Ballard Locks roof tiles and Smith Tower crown colours — check against refs/ (MoPOP, Troll + Aurora arches, Pike Place sign, pergola already checked).
- Gum Wall current height after periodic cleanings (2024 figure used).
- Garden d'Lights LED count and Snowflake Lane dates (annual).
- Bellevue Downtown Park waterfall drop height; Kerry Park railing details; Meydenbauer pier width — estimates.
- Reference photos for Ballard Locks, Gas Works, part of Pioneer Square and the 4 Bellevue spots are vetted (licence + URL in each LICENSES.md and `refs_candidates[]`) but not downloaded: upload.wikimedia.org returned HTTP 429 with a 10-minute Retry-After that kept renewing (shared egress). Lincoln Square photos exist in refs/bellevue/ (sibling).
- No Commons photos of Rachel the pig, the Chihuly Glasshouse interior (copyright) or the UiPath office; Troll has one full photo.
- Tripadvisor live ranking not fetchable (403); Stacker's 2024 copy used. Lonely Planet fetched via curl.

## 6. Bellevue spots — fidelity pass 2026-11-12 (live OSM)

Method: whole-area live OSM (`api.openstreetmap.org/api/0.6/map`, 2026-11-12; Overpass was unreachable) for the four scene
extents, diffed against `game/data/spots/bel-*.json` and the scene modules, then game renders at fixed poses before / after
each change. **Street View was available for one official panorama only** (NW corner of NE 8th St × Bellevue Way, late in the
pass; the shared browser pane was at its tab limit before, and park photospheres did not load), so apart from the two
Lincoln Square notes marked (SV) nothing below is a statement about look — only about what exists, where, and of which
type. Sizes marked "estimate" have no tag.

Established (and changed in the scenes):

- **Lincoln Square.** OSM w33106348 ("Bellevue Square Mall", the L-shaped building at the SW corner of NE 8th St × Bellevue
  Way that wraps the NE parking garage: Crate & Barrel on the corner, then Pressed Juicery, Starbucks, Cactus, Farzi Café,
  Tavern Hall, Castilla, Shake Shack along Bellevue Way) is not one of the `bellevuesq` landmark's source rings (w29234887 +
  w497739259). The scene skipped it as if it were: the corner was an empty paved plot with an invisible collider. It is an
  OSM building again and carries the mapped ground-level shop signs. No `building:levels` is mapped (default height).
  (SV) The corner building is a white two-storey glazed Crate & Barrel store: present in reality, as mapped; the game's
  generic dark shopfront does not yet look like it. (SV) Bellevue Place across NE 8th (w366831926 + parts, w33613428) is
  tan / rose precast with rectangular punched windows: it now uses the plain `concrete` facade in that colour instead of
  red brick with arched windows.
- **Downtown Park.** The four playground shelters (w842810342, w842810343, w1389888659, w1389888660, `amenity=shelter`) and
  the restrooms (w503657595, w479656681, w505219712, `amenity=toilets`) are open roofs on posts / one low block, not
  multi-storey blocks with shopfronts. Inspiration Playground equipment stands at its mapped nodes (2 structures, climbing
  frame, 4 slides, swing, 2 basket swings, spinner bowl, spinning circle, trampoline, bannister bars, water table) and the
  splash pad (w1389888661) is painted; shapes are stand-ins for the mapped type. "Lest We Forget" (n5657152449) is mapped
  `memorial=obelisk`: an obelisk on a plinth (2.9 m, estimate) replaces the low slab; the plate carries the mapped name only.
- **Botanical Garden.** The Ravine Experience bridge (w210457899) is `bridge:structure=suspension`, `surface=metal`,
  `width=1.5`: the deck is metal, not timber planks. Wilburton Hill Park's sports ground east of the garden (soccer pitch
  w32025468 `artificial_turf`, paved running loop w403375045, bleachers w1434241117/8, six `man_made=mast` floodlights,
  basketball court w1332124896) was covered by the scene's scattered forest: it is open, marked (standard proportions,
  estimate) and lit by masts (18 m, estimate). The Yao Garden stone lanterns stand at their mapped artwork nodes (Kasuga
  n13176039734, Miyoshi n13176039735, Stone Lantern n13179881929) and the Kyoto stone water basin (n13176039736) is added;
  no tree stands in a mapped pond. The shelter by Shorts House (w1433659397) is an open roof.
- **Meydenbauer Bay Park.** The node at the pier tip (n6455415841) is `amenity=clock`, `display=sundial`,
  `tourism=viewpoint`: a low sundial (form estimated) replaces the four-faced clock post with a vane, which is not mapped.
  The marina's covered moorage (w819159076, `building=roof`, layer 1) was skipped and undrawn: it is an open shed roof on
  posts (eaves 4.4 m above the lake, estimate) with motor boats only beneath it.

Checked and left as is (matches live OSM): skybridge ways w43872832, w43872826, w516915099, w1222676052, w29234890,
w497738385; the canal weirs, upper pool, reflecting pool and waterfall line of Downtown Park; the crescent pier
(w688415225 / w687934817), beach, swimming area, pavilion (`building=toilets`), Whaling Building (w819159071), boathouse
(w698374975), Lake Washington Blvd bridge (w243441596); the garden's ponds, Yao Gate (r19659543), Tateuchi pavilion.
Open items are listed in the backlog rows of this pass.

## 7. Fidelity pass 2026-11-12 (Pike Place, Waterfront, Pioneer Square, Seattle Center)

Live OpenStreetMap (API 0.6 map call, 2026-11-12) against the spot extracts of 2026-11-06; Google Street View panoramas viewed for reference only (nothing stored or copied); USGS 3DEP 1 m DEM point queries.

**Waterfront**
- Shoreline: the `natural=coastline` ways (members of relation 13316235) are unchanged in the live database. They run Pier 62 → Pier 54 around every pier; `natural=water` way 1417461574 is the cove between the rebuilt Pier 58 (way 1155067802, `start_date=2025-07-25`) and the seawall, way 776848804 the basin between Piers 59 and 60. The scene now takes its land / water edge from these (`waterfront-shore.js`), not from the 20 m elevation grid.
- Panoramas along the rebuilt Alaskan Way (47.60520,-122.33931 dated Sep 2025; 47.60665,-122.34064; 47.60742,-122.34135; 47.60793,-122.34190; 47.60832,-122.34237): no viaduct; planted beds and a two-way cycle track between road and promenade; Pier 55 red-brown with a dark hipped roof (Starbucks), Pier 56 dark green gabled with white trim, Pier 57 red with MINERS LANDING in gold letters and yellow awnings, Pier 59 grey-green with SEATTLE AQUARIUM on the street front and a dark vaulted building behind on Pier 60, Ocean Pavilion charcoal ribbed metal with a planted roof and an outside stair tower, the Overlook Walk a thick pale concrete deck over Alaskan Way on round columns, the Pike Place Market garage east of it. The panorama Google returns at 47.60625,-122.34070 is from the construction years (old road line, barrels): not used.
- Documented exception (OSM incomplete): "Elliott's Oyster House" has no OSM object; its sign is on the Pier 56 street gable in the Sep 2025 panorama. The game shows that name on the Pier 56 gable only.
- Levels: USGS 1 m DEM 4.99 m at the Ocean Pavilion (47.608159,-122.342797), 7.5–7.9 m on Alaskan Way under the Overlook Walk, 15.1–17.1 m on the slope at 47.60919–47.60937,-122.34306–-122.34313, 23.83 m at MarketFront (47.609508,-122.342930). Overlook Walk deck in the game: 15.5 m over the road (pavilion ground 5 m + OSM height 10.9 m) rising to 24 m at MarketFront; a straight ramp is an estimate (the real walk has terraces and stairs).
- Businesses in the live database and not in the extract (now signed): Mark's Ark, Pirates Plunder, Sports Den, The Sourdough Bakery (Pier 57); The Seattle Shop at Pier 56, WingDome (Pier 56); Starbucks, Seattle Shirt Company, Burgundy Viscosi Gallery (Pier 55); Ivar's Acres of Clams, Ye Olde Curiosity Shop, Simply Seattle, Ivar's Fish Bar, Great State Burger, Premier Meat Pies, Harley-Davidson Motorcycles (Pier 54); Copperworks Tasting Room & Distillery. Mapped closed (`disused:*`), not signed: Frankly Sweets, Salt District (Pier 55).

**Pioneer Square**
- 130 of the 133 live businesses inside the terrain box were already in the extract; new: Sam Day Studio & Gallery, Cookie's Country Chicken, Good Bar. Now mapped closed and no longer signed: Woven Art (n2351695509), Luigi's (n2351695585), The Underground Gallery (n2351695606), Revolution Books (n2351695730), Flame Catering Cafe (n2351700811), Tobacco Patch (n2354406522), Comedy Underground (n4626879391).
- Occidental Square: Duane Pasco's four carvings (nodes 3211770100–103: Sun and Raven 35 ft, Killer Whale 12 ft, Tsonqua 13 ft, Bear 13 ft) and the Fallen Fire Fighters' Memorial (node 2998927033, Hai Ying Wu) are at their mapped places; table tennis (n14005376908), chess (n14005378203) and the playground (w1155308011) are mapped and not built.
- Sinking Ship Garage (way 52781697) is `amenity=parking`: drawn as an open parking deck, not a brick block.

**Seattle Center**
- All 35 live businesses and 25 tourism / artwork objects inside the terrain box are in the extract. MoPOP's outline (way 161587742, `building:material=steel`) and the Sky Church (way 1092469435) carry no colour tag; the seven lobes do (maroon, silver, #6495ED, red, gold).

**Pike Place** — re-checked: no business of the extract changed since the 2026-11-12 Street View pass; nothing edited.

**Round 2 (2026-11-12), Street View side by side** (official panoramas only; near the tourist spots Google mostly returns user photospheres or indoor business panoramas, which were not used for bearings)
- Pioneer Square, Yesler Way at Post Ave (47.60172,-122.33578): west = the signalled Alaskan Way crossing, trees, Colman Dock, open sky over the bay, no viaduct; east = a dark red brick block, towers behind. 2nd Ave x Yesler (47.60170,-122.33211): west = a dark red Romanesque block on a rusticated stone base with round-arched openings, the Sinking Ship garage as an open concrete deck, the Butler garage behind; north-east = Smith Tower, white, storefronts at its base. S Washington St at Occidental (47.60089,-122.33315) looking north: a low dark one-storey shopfront with columns at the square's edge, globe lamps, trees. A user photosphere at 1st Ave x Yesler (Oct 2019) shows Pioneer Place under a full canopy of large trees that hides the Pioneer Building; OSM maps nine maples there (now drawn).
- West of Western Ave, live OSM: coastline way 1464900126 (seawall, Colman Dock and Pier 48 as land), Alaskan Way as two roadways (ways 223785010 + 835645674, 1321962096 + 1321962090), Washington State Ferries Terminal (way 1154870285, 2 levels, start_date 2023-08-03), Water Taxi / Fast Ferries Terminal (way 226321140, 1 level). Drawn from these; the Pioneer Building could not be seen in a panorama and is built from this dossier's description.
- Pike Place, Western Ave below the market (47.60878,-122.34155): north-west = the market's west side as a cream multi-storey block with red-framed industrial windows, a green steel footbridge over Western Ave, the garage (plain tan concrete) on the west side; south-east = the same cream / red-frame block, brick opposite. The game has the block and the bridge in place; the red frames, the bridge's green steel and the plain garage wall are not matched.
- Seattle Center, 5th Ave N at MoPOP (47.62138,-122.34768) looking 240: bronze-gold metal skin, curved, down to the ground behind street trees. Broad St (47.61991,-122.34862) looking 320: the Needle behind large trees, a lawn with a dark sculpture.

## 8. Fidelity pass 2026-11-12 — Fremont Troll, Kerry Park, Ballard Locks, Gas Works

Sources: live OSM (API 0.6 map call, 2026-11-12; Overpass was saturated), the USGS 3DEP 1 m DEM through EPQS sampled on
4–5 m grids (10 m at Gas Works) — stored as `game/src/spots/scenes/fine-dem-<scene>.js` — and Google Street View as a
look reference only (nothing stored, traced or measured from it beyond the proportions noted below). The 20 m research
terrain grid is too coarse wherever a level changes within a few metres (a lock wall, a bridge abutment, a viewpoint
platform on a shore); the fine grids replace it there (`scenes/fine-dem.js`).

### Fremont Troll
- **Bridge end.** OSM `man_made=bridge` w370645739 and bridge way w378090317 end at 47.65120 N (z = −66.5 in the scene):
  north of it Aurora Ave N is at grade. DEM: roadway there 43.4–43.6 m NAVD88, N 36th St under the bridge 35.5 m, the
  ground at the Troll 35.8–36.0 m, and a bank climbing 7 m in 20 m from behind the Troll to the abutment. So the deck
  soffit is about 7 m above N 36th St and the Troll (5.5 m) sits just under it. The scene had the deck 3.7 m too high,
  30 m too long (an invented piece of viaduct with two extra bents, fences and graffiti walls over what is the
  embankment) and the Troll's base 1.2 m too high.
- **Structure type** (Street View, 2025 pano on N 36th St east of the bridge, id s2nejgAfrxEcFPqUbBfauA; 2013
  photosphere at the junction): a concrete girder bridge on rectangular columns with capitals; the girders are haunched,
  so each span reads as a very shallow arch — not a tall arcade. Column lines across the deck could not be counted
  reliably (two are visible flanking the Troll); the scene keeps its three lines — unverified.
- **Stairs.** OSM maps steps on both sides of the bridge: w50612754 east and w50612756 west, from N 36th St to the
  Aurora sidewalks at the bridge end. The west flight was missing.
- Not checked on imagery: the fences behind the Troll, the knoll's planting (Street View shows the east bank wooded,
  the scene has lawn with scattered trees), the Troll Eye Apartments sign.

### Kerry Park
- **Changing Form.** OSM n693337510 (city art inventory GCK74.048): "a square frame with a circle cut out of the middle
  stacked on a triangular frame with circles cut out of each side", Cor-ten, 16'6" × 6'3" × 4'5". Street View (2025
  pano on W Highland Dr, id pmkM273v38BcX2jtOhHfww): two stacked frames of equal width, a full round opening in each,
  dark brown-black, on a round three-step plinth in a brick plaza; the upper opening faces the street / the bay. The
  scene had two curved half-slabs forming one ring, turned towards the Needle, on a small base in the lawn.
- **Edge.** OSM: railing w240890465 (west, 1.2 m), wall w240890467 (middle, 1 m, with a small bay), railing w240890466
  (east, 1.2 m); coin binoculars n2485862631 at the railing; guidepost "Kerry Park Sign" n2485862643 at the west end.
- **Levels.** DEM: the terrace falls gently from +1.2 m (west) to +0.3 m (east) relative to the origin and is level
  with W Highland Dr; the scene keeps it flat at +0.15 m (sub-metre, left as is). Bayview-Kinnear's play terrace is
  flat at −17.5 m.
- **Postcard.** Needle bearing 141°, Rainier 152.4° and ≈ 2.1° above the horizon: the scene's backdrop matches both.
  Rainier itself reads as a dark slab with a small snow cap (shared `landmark-us-terrain.js`, not changed here).

### Ballard Locks
- **Layout from OSM** (scene metres, x east / z south of 47.6664 N 122.3970 W): lock gates w293079629 (west),
  w293079656 (intermediate), w1305545916 (east) of the large lock, w1305545915 / w293079859 of the small lock; lock and
  guide walls are the `man_made=breakwater` polygons w159935907 (the 355 m wall between the locks), w51818718 (south
  wall of the small lock and its guide wall), w51818719, w1305542077; the spillway is `waterway=dam` w32823954, running
  70 m from the small lock's south wall SSW to the south bank; the public crossing is the chain of footways
  w472179838 – w285286403 – w472179843 – w1475183519 – w1475183520 (west gate, middle wall, small-lock gate, south
  wall, dam) plus w472179834 over the intermediate gate; the fish ladder (w764035003, w285286401) and its viewing room
  (n3413278212, tunnel footway w285281016) are on the south bank. The scene had the spillway as a block parallel to
  the locks in open water, no guide walls, no intermediate gate and no way across.
- **Levels from the DEM** (hydro-flattened): lake 4.98 m NAVD88, tidewater −0.36 m (a low-tide surface), coping and
  north bank 7.0 m. The scene's coping stood 2.1 m higher. The DEM carries no walls (they are flattened into the
  water), so their tops are taken at the north bank's coping level.
- **Spillway look** (Street View, Sep 2022 pano on the walkway, id Y0Yw3Wz4h2RpdyuvBvYE7w): stained concrete piers, an
  arched concrete service bridge with pipe railings above the dark ribbed gate leaves, the public footbridge along the
  downstream face about 2.4 m below it with galvanised railings and lamp posts; the gate tops stand a little above the
  footbridge deck, so the deck is close to lake level. Footbridge and service-bridge levels are read off that pano,
  not surveyed. The red hoist boxes the scene had are not there.
- **Buildings.** Street View (Administration Building front): grey concrete with arched openings, not buff. Roofs
  red tile (seen from the dam). The window pattern is still the generic one.
- **Salmon Bay Bridge.** OSM man_made=bridge w859885667 (BNSF bridge 6.3, bascule) with the movable span on
  w34680546 / w53826213 at 122.4021 W; Street View from W Commodore Way: a rust-brown camelback through truss, lowered,
  counterweight tower at the north end. Added as a silhouette.
- Not checked on imagery: the fish ladder's own look and the viewing room entrance, the garden's planting, the
  visitor centre, "Salmon Waves" (n3211770269, not modelled), the Control Tower's shape, businesses on NW 54th St /
  Market St at the edge of the extract (Lockspot Cafe, Pagliacci Pizza, 7-Eleven carry OSM names in the data).

### Gas Works Park
- **Levels from the DEM**: lake 4.98 m NAVD88; Kite Hill summit 20.4 m (OSM `ele=20`); the Prow / "Lake View Point"
  (n3667766956) 10.8 m, i.e. 5.9 m above the lake, with the shore path at 6.1–6.2 m. The scene had the lake surface
  1.3 m too high, the Prow and the amphitheatre under water (the 20 m grid misses the platform) and a synthetic mound
  2.3 m too tall for Kite Hill.
- **Sundial.** OSM n31096103: 27'9" across. The mosaic was painted, then covered by the OSM pedestrian disc
  w191328703 ("Kite Hill") drawn over it as plain slabs.
- **Play Barn.** The mapped sheds are w52137309 (south) and w52137316 (north), 40 m east of where the scene had an
  invented shed. Street View (Oct 2012 pano on the path at their west end, id 8m6r8xCsZ1nuwWZ4N4U8sw): the south shed
  is the Play Barn — open sides, white posts with white wedge braces, low grey corrugated roof, red / orange / pink
  machinery inside, tall blue and white vessels at its corner; the north shed is taller and grey (the picnic shelter).
- **Lawn relics.** The `building=industrial` footprints w406480498–w406480503 west of the barn are slender rust-brown
  towers 15–20 m tall with fat sweeping pipes, a row of three low vessels (w406480503) and a small grey shed — not
  painted machines. `tourism=artwork` w405794428 "Concrete Train Trestles" is a row of concrete bents.
- **Generator towers.** Inside fence w4835090 OSM maps six round tanks of 6–7 m, one rectangular block, two chimneys
  (`man_made=chimney`, 1.5 m) and nine small vessels; the scene chose tank or stack by list position.
- **High bridges.** Aurora Bridge (w370645739, 870 m west) and the I-5 Ship Canal Bridge (bridge ways w4644173 /
  w474077561 along 122.3225 W, 1 km east) close the lake view on both sides; neither was in the scene. Added as
  silhouettes at their mapped positions.
- Not checked on imagery: the sundial's actual design (the scene's is a stylised pattern), the amphitheatre steps,
  the car park and the entrance sign, the Burke-Gilman trail edge, the towers' individual shapes.

## 9. Fidelity pass round 2, 2026-11-12 (lane sea-spots)

Sources: the spot extracts and scene modules at 94a177d5; one Google Maps user photosphere viewed for reference only
(nothing stored or copied). After that view the Maps pane returned "No Street View imagery available here" for every
request, including a point where round 1 had a panorama, so no further imagery was compared in this round.

**Pike Place, 1st Ave x Pike St looking down Pike St** (photosphere dated May 2020, position 47.60907,-122.33981 as
reported by Maps; a photosphere's heading is not reliable). Seen: the PUBLIC MARKET CENTER sign in red letters on an
open steel frame on the roof of the one-storey corner at the end of Pike St, three rows, the clock right of MARKET /
CENTER; MEET THE PRODUCER on the roof edge of the taller cream building behind it; a red FARMERS MARKET band at
street level; the Corner Market on the right, buff with brick-red panels, round-arched top windows, a green canopy
and three-globe lamp posts at the kerb; brick paving on Pike St; cars on Pike Place (2020, before the car-free trial).
Game at the same place (scene x −6, z 10): sign, frame, clock position, MEET THE PRODUCER, FARMERS MARKET and the
Corner Market are present in the same arrangement. Differences: no three-globe lamp posts; a tree at the Corner
Market corner on the Pike St side; a barrel-vaulted canopy left of the sign that the photo neither confirms nor
excludes.

**Waterfront, the research photo point.** 47.6069,-122.3416 (scene 0, 0) lies in OSM `natural=water` way 1417461574,
the cove between the rebuilt Pier 58 (way 1155067802) and the seawall. The postcard stand is now the promenade paving
8 m north-east of it (scene 3.5, −7.5), the Great Wheel on the same bearing (215). The data's pier polygons for the
relations (Pier 55 / 56 / 57 / 59 / 60) are single self-crossing rings; the Great Wheel base and the ticket booth
(way 429553385) therefore stand partly over open water. The "Over the water" plaque and the queue were moved onto the
promenade south of the booth; the pier rings themselves were not repaired.

**Seattle Center, presence in the extract** (data only, no imagery): Space Needle way 12903132, MoPOP way 161587742,
Armory way 231764919, Pacific Science Center way 394955903 (no height tag), Climate Pledge Arena way 25123756
(35 m, west of the terrain box), Chihuly Garden and Glass way 161587729, Howard S. Wright Memorial Fountain way
241876412, the monorail guideway ways. The International Fountain lies north of the native extract and is not
modelled. Shape class and materials of these were not compared with imagery in this round.

**Frame budget** (High quality, 1200 x 700, 12 bearings at every spawn, postcard, plaque and activity anchor):
Pike Place 2,452,726 triangles / 686 draw calls before, 1,113,634 / 339 after; Seattle Center 1,626,690 / 508 before,
1,232,012 / 274 after. What dominated: the mapped city context (855 k triangles in ~270 chunk meshes of 800 m, drawn
whenever a chunk touched the view), the sun's shadow pass over every window frame and glazing bar of the market
facades (309 k), six draw calls per sign board and seven per plaque in each pass. Nothing was removed: the context is
one multi-draw per material with 120 m cells culled by the frustum and by the skyline of nearer solid blocks, the
facades are one multi-draw per material with a shadow-only proxy (walls, roofs, canopies, awnings, balconies,
cornices, window surrounds, shop piers), far-LOD tree trunks are not submitted beyond 500 m (their crowns are).
Still over: a drone frame 90 m above Pike Place looking north, 1.61 M triangles.

## 10. Fidelity pass round 2b, 2026-11-12 (lane sea-spots-b): Street View side by side

Sources: official Google panoramas, found through Maps' own coverage lookup (`photometa/ac/v1`, z17 tiles: coverage
metadata only), viewed for reference through the thumbnail endpoint and never stored; game frames rendered at the
panorama's position, eye 2.5 m, same bearing (High quality, summer); live OSM (Overpass + API 0.6, 2026-11-12); USGS
3DEP 1 m DEM (EPQS). User photospheres were skipped. 68 bearings compared across 9 scenes; the panorama ids are given
where a fix depends on them.

**Pike Place** (27 bearings at 12 panoramas on Pike St, Pike Pl, Post Alley, Virginia St, Western Ave)
- Matches: the PUBLIC MARKET CENTER sign and clock, MEET THE PRODUCER, FARMERS MARKET, PIKE PLACE FISH, Corner Market
  (CORNER MARKET lettering, arched top windows), Sanitary Market, the Starbucks front and pale band sign, Beecher's
  Handmade Cheese, Mr. D's Greek Delicacies, Sur La Table and Cafe Campagne on Post Alley, the POST ALLEY banner,
  brick paving, the falling street profile.
- Fixed: three-globe lamp posts on 1st Ave (panorama tT8x8F7kggeRi_KoY1vLng: low posts, globe on top + two on a cross
  arm; the tall cobra heads stay on Pike Pl), placed at the generator's 1st Ave lamp points. No generated street tree
  on the Corner Market's 1st Ave frontage (no OSM tree, open in the panorama at 235 / 265°). The North Arcade's street
  front is an open day-stall shed (dark-green fascia, single grey-green roof plane rising from the eave), not the
  windowed hall of the Main Arcade (grsVDUMkuBMlk2jyCNtErA, gUpSU7FwJVKGzsOM5hEfWg, qe8_CeOlBF2k55UTq3zkAg); eave 3.3 m,
  run 7 m are estimates. Victor Steinbrueck Park: the bay carve west of x = −315 cut the park into the bluff (lawn
  sloping off to roof level); the DEM gives 30.7–31.5 m NAVD88 at 24 points over the whole OSM park (way 14026690):
  the park is now level at −5.7 relative, the carve stops at the park's west wall. Its two poles stand at their OSM
  nodes (n3211770167 Farmer's Pole 50 ft, n3211770169 untitled, height not mapped).
- Not fixed: Main Arcade street front (reality: green dado + small-pane windows + ENTRANCE signs, pigs on the roof
  edge of the Economy/Main arcade at Pike Pl; game: similar band but no roof pigs); Western Ave market west face
  (red-framed industrial windows); the Steinbrueck park has no benches, lamps or trees beyond the OSM trees and the
  office block west of it (Market Place North) is a generic grey extrusion where reality is tan with ribbon windows;
  parked cars on Pike Pl (panoramas 2023–2024; the scene is car-free by design, the 2025 trial).
- Barrel-vault canopy left of the sign: from the official panoramas at 1st Ave (235° / 265°) and at the Corner Market
  (250°) that spot is small and partly hidden by the sign frame; not settled either way. No change.

**Seattle Center** (28 bearings at 12 panoramas)
- Space Needle base pavilion: curved glass with a white soffit band, queue, stone ball bollards: shape matches; the
  soffit band in reality is deeper and the pavilion is screened by large trees and planting that the game lacks.
- MoPOP from the west steps and 5th Ave N: reality is a multicoloured iridescent / purple-bronze and silver skin,
  continuous curved lobes; the game draws the seven OSM lobes as flat red, blue, gold and white-grey slabs (way colours)
  and the monorail passes through as in reality. Colours follow OSM tags; the iridescence and the curvature are not
  modelled (needs a hero model).
- Monorail guideway and station: twin beams on T-columns and the beam into MoPOP match; the station roof is a plain
  slab (reality: a long curved canopy over three platforms, OSM w333355314/5/7).
- Chihuly: Glasshouse frame and red suspended forms match in kind; the EXHIBITION ENTRANCE / bookstore signs and the
  planted wall are not modelled.
- Armory: from the monorail walkway the real Armory is screened by large trees; the game has open lawn there.
- Pacific Science Center: reality shows the red Olympic Iliad (n3211770187) in the park south of it; the white
  arches are not visible from the nearest official panorama; the game has no Iliad and generic volumes.
- Climate Pledge Arena (way 25123756): reality is the sweeping 1962 roof with sloped buttresses and a glass front;
  the game has a generic box at the edge of the extract.
- International Fountain (w35352476, 57 × 56 m, `height=37`, Fountain Lawn w394955954, International Fountain
  Pavilion w492644115, Acrobat Constellation n3211770205): the fountain lies 15–43 m west of the native terrain box
  (x0 = −190); the panorama at its edge shows the white dome bowl inside a ring of trees, the game a plain lawn.
  Adding it needs: the fountain ring and lawn as literal OSM rings in a scene module (as `waterfront-pier-rings.js`
  does), the native ground extended west (the source context terrain already covers it), and a hero model of the
  bowl / dome / jets from sources.
- Howard S. Wright fountain (w241876412): present at its mapped place.

**Waterfront**: the pier relations were stored as one concatenated ring each (Pier 57 self-crossing, Piers 59 / 60
half their area, Pier 56 reversed). The scene now uses the live relations joined into closed rings
(`waterfront-pier-rings.js`). Probe: the Great Wheel base (−67.7, 81.2) and the ticket booth (w429553385) already
stood on walkable deck at HEAD and still do. The water triangle (−39.5, 58.4)–(−35.6, 65.7)–(−33.6, 65.8) is
outside both Pier 57 (r812609) and Pier 58 (w1155067802) in OSM and water in the coastline: a source gap, kept.
Pier 55's three inner rings are recorded and not opened (the coastline treats them as land). Panoramas: Aquarium
walkway and Overlook Walk (ssVBdmKRn3zMu6r2avuajw, I70pAql2e9X-e2-1ah4X8w), where the game's eye fell inside the
Ocean Pavilion volume and under the Overlook, which is not a useful comparison. From the cove corner (FK3X6Xtysq2K8zjHYn66Kw)
the wheel, Pier 57 and the promenade read right; reality has planters, bins and two-way traffic on Alaskan Way where
the game has open paving. No official panorama within 45 m of Piers 55–57.

**Pioneer Square**: 1st Ave x Yesler (uDkRVtPBN2CfJGuwgVQGvw): pergola, totem, Smith Tower, brick blocks and the open
crossing match; reality's trees are taller and fuller, the Pioneer Building is a stone-and-brick Romanesque front
(game: plain red brick). Occidental Ave S looking south: the Union Trust Building / Annex (granite piers, green
storefronts) is a generic red-brick block in the game. 2nd Ave Ext x Yesler looking 250°: the panorama shows a
surface lot with a booth; the game camera stood against the Sinking Ship Garage (way 52781697, still mapped as a
3-level garage, v14 2026-10-20). Unverified.

**Kerry Park** (y4VIyX3fc6pkQsYrTG-A1w, D19wLVvtz886pOofJWALBA): Changing Form, plinth, brick plaza, lawn, railing
and the view match. Fixed: the street-tree row the generator planted on the park's own kerb (none in OSM, none in
either panorama). Not changed: parked cars along W Highland Dr, the hedges / gardens on the north side.

**Fremont Troll**: the official panorama nearest the Troll is on the Aurora deck (no altitude in panorama metadata),
so the Troll itself was not compared. N 36th St west (Waz2-sx9krbbJvb3y-2BUw): concrete columns with capitals and
haunched girders; the game's arches read taller and rounder (as section 8 says). Aurora north: balustrade parapet in
reality, plain wall in the game.

**Ballard Locks**: the walkway panoramas confirm the "Salmon Waves" (n3211770269, a row of curled concrete forms with
globe lamp posts on the south-bank promenade), not modelled. Lock-wall views put the game's eye in the chamber
(panorama metadata has no altitude): not a valid comparison. Administration garden: reality is wooded with tall
conifers; the game shows open lawn with scattered trees.

**Gas Works**: one official panorama inside 60 m (park entrance); the towers, the barn and Kite Hill have no official
panorama in reach. Not compared.

## 11. Bellevue spots — round 2, 2026-11-12 (Street View side by side + live OSM)

Method: the live OSM extracts of round 1 (same day) for position / type, official Street View panoramas for look, the game
rendered at each panorama's position and bearing (`game/dev/spots.html`, summer, clear day) before and after each change.
No panorama imagery was saved; only the observations below. Heights quoted "on the scene datum" use the USGS 3DEP 1 m DEM
(`epqs.nationalmap.gov`) where the 20 m research grid is too coarse.

Street View technique notes (they explain round 1's "no panorama" result): the Maps tab in the hidden browser pane does not
resolve a panorama until a screenshot forces a frame — navigate, take one small screenshot, wait 3–5 s, read the tab URL.
In the thumbnail endpoint a **positive `pitch` looks down**, a negative one up.

Official panoramas used (lat, lon): Lake Washington Blvd bridge 47.61201, −122.21094; 99th Ave NE foot 47.61046, −122.20985;
Lake Washington Blvd × 99th Ave NE 47.61105, −122.20915; marina lot 47.60989, −122.20898; NE 4th St at the park gate
47.61381, −122.20422 and 47.61381, −122.20442; NE 4th St by Piloti 47.61391, −122.20251; Bellevue Way 47.61291, −122.20171;
100th Ave NE 47.61190, −122.20696; NE 1st St 47.61122, −122.20480; Main St at the garden drive 47.60995, −122.17853; garden
drive 47.60941, −122.17850; garden drop-off loop 47.60893, −122.17824; Bellevue Way under the skybridge 47.61642, −122.20159;
Bellevue Way × NE 6th 47.61577, −122.20179; NE 8th St east of Bellevue Way 47.61735, −122.20089. Park interiors (beach, pier
deck, canal ring, waterfall, playground, garden rooms, ravine bridge) have user photospheres only: they were judged from OSM.

**Meydenbauer Bay Park** (scene origin 47.6106, −122.2108)

| Feature (OSM) | Verdict | What was established / changed |
|---|---|---|
| Pavilion w688203355 (`building=toilets`), footway w841411879 `layer=1`, picnic tables n7850600507–510 `layer=1` | was wrong type → fixed | It is set into the bank; its roof is a public terrace level with the upper walk (SV: light concrete deck, galvanised mesh rails, picnic tables; no dark overhanging roof). DEM: beach side 1.0–1.8 m, uphill side 4.2–4.6 m. Terrace at 4.45 m, walkable from both mapped approaches, tables at their nodes. The "MEYDENBAUER BAY PARK" plate on it had no source: removed. Beach face not seen (no panorama). |
| Whaling Building w819159071 (`building:levels=2`) | was wrong look → fixed | SV: dark brown boards, white-trimmed windows, steep brown-grey shingle roof, ridge about level with 99th Ave NE (≈ 7 m). Was a white two-storey box 9.3 m high. Eaves 3.3 m / rise 3.4 m are estimates. |
| REI Boathouse w698374975 | was wrong look → fixed | SV: same dark brown / white trim / shingles — not red. No name board readable from the street: the invented "BOATHOUSE · KAYAKS · SUP" plate is removed. |
| Covered moorage w819159076 (`building=roof`) | match, detail added | SV (marina lot): grey roof, deep brown timber fascia, posts. Fascia added. |
| Yacht-club buildings w627898895 / 896 / 897 (`building=yes`, over water, inside `leisure=marina` w393293243) | was wrong type → fixed | SV from 99th Ave NE: long covered-moorage sheds. They were four-storey windowed blocks standing in the lake. |
| Piers `man_made=pier` w753594668–678, w753594680, w737163199–206 | missing → added | 19 linear piers (marina fingers, yacht club, private docks NW). 2.2 m timber decks on piles; width / height estimated. Not walkable (private / `access=no`). |
| Crescent pier w688415225 / w687934817 | match | SV: low grey deck, mesh rails, white pile tops above the rail. Walkable deck had slivers of open water (collision boxes turned the wrong way, last panels skipped): fixed. |
| Buoys n6901346624–629 (`seamark:type=buoy_special_purpose`) | missing → added | six white can buoys with an orange band (shape estimated). |
| Lake Washington Blvd bridge w243441596, sidewalks w753604118 / w753604114 (`layer=1`) | partly wrong → fixed | SV on the deck: raised concrete sidewalk each side inside concrete balustrades, dark lantern posts on the parapet. The deck was 24 level boxes (a 13 cm stair every 4 m) with nothing to stand on: walkers on the boulevard dropped to the ravine floor. One sloped slab, sidewalks, four lanterns (number / places estimated), walkable. Substructure under the deck not seen. |
| Park name sign (park w57883263) | missing → added | SV: low teal panel between two posts at the LWB × 99th Ave NE corner. |
| Far shores | was wrong look → fixed | SV: continuous belt of tall firs with houses at the waterline. Was bare green hills with a scatter of trees. Dense low-detail tree belt; the shore houses are not modelled. |
| Promenade lights | partly fixed | SV: dark ≈ 5 m posts with a pendant shade. One lamp style per scene: the boulevard's tall grey cobra heads now share it (wrong for the street). |
| Beach w688203354, swimming area w737163174, swim float, playground w688639344, streams, parking, viewpoints | match (position / type) | swim float and buoy line seen from 99th Ave NE. Playground equipment, picnic tables off the terrace, bubbler n6458275653: generic stand-ins. |
| Fish sculpture n13707322282 | not modelled | description only ("native-PNW style fish"), not seen. |

**Bellevue Downtown Park** (origin 47.6133, −122.2034)

| Feature (OSM) | Verdict | What was established / changed |
|---|---|---|
| NE 4th St forecourt r11564632 (`highway=pedestrian`, `surface=paving_stones`) | was wrong → fixed | SV: grey pavers from the kerb to the canal wall. Was a lawn in a brick frame. |
| Fountain w655090567 | was wrong form → fixed | SV: raised round granite bowl spilling over its rim onto three circular steps ringed by low round-topped bollards. Was a flat basin at ground level. Sizes estimated from the mapped Ø 5.4 m outline. |
| Obelisk lamps (not mapped) | missing at the forecourt → added | SV: pink-granite obelisks with globe lamps, as on the canal ring. Four at the forecourt, placed by bearings from two panoramas (± 2 m): (−72.8, −35.8), (−55.6, −35.8), (−82.0, −41.5), (−46.4, −41.5). The same views confirm the ring obelisks exist. |
| Flagpole n12195609190, map table n4957270649 (`information=map`) | missing → added | SV: flagpole with the US flag at the east edge; stone table with a relief map. |
| Piloti w1326469154 | partly wrong → improved | SV from NE 4th: a cluster of slender white columns flaring into the canopy. Was three thick legs. Seven columns (count / places estimated); the canopy's undulating edge is still a plain shell. |
| WWI memorial n5657152449 | corrected | research: "Three elms and a plaque"; seven elms stood round it. |
| Canal ring w1326469164 / 165 / 169, weirs, upper pool w1326469168, cascade w842753013, reflecting pool w1326469177, lower plaza w1326475313, south fountain w842753014, Inspiration Playground w503657594 + nodes, shelters, restrooms, splash pad | match (position / type) | no panorama inside the park: stone colour, cascade and pool edges unverified in look. Playground seen across the 100th Ave NE car park only (position right). |
| Terraces w810574801–803, w842753004–006, old school outline w810575032 (`height=0.2`) | not modelled as walls | paths only. |
| Skyline | sanity | Lincoln Square towers north-east, mid-rise blocks south: present. Bellevue Way raised median near NE 2nd St not checked. |

**Bellevue Botanical Garden** (origin 47.6088, −122.1793)

| Feature (OSM) | Verdict | What was established / changed |
|---|---|---|
| Name sign | wrong place → fixed | SV on Main St: teal panel between two posts on the east side of the drive. A 5.6 m board stood inside the garden by Shorts House (no source). |
| Yao Garden w32121704 | invented feature removed | an 18 m ellipse of raked gravel was painted; OSM describes gate, basalt streambed, boulders, lanterns, maples. |
| Artworks | 5 added, 8 not modelled | Friendship Circle n4499338296 (standing stone circle), Night Blooming n5531375272 (wood, 4.1 × 3 m), Basalt Bench n4730801813, Stacked Stones n13176504583 (cairn), Waterwall n9251586886 / w1433659335 (slate wall fountain): forms from their tags, sizes estimated. Owl's Glare, Goldiwarts, Large Galaxy, Shaman, Three Cranes, Sophia's Dream, The Nature of Sitting, Sheepish Rabbit: name only. |
| Car park r19655198 | dressed | SV from the drop-off loop: lot in use, dense conifers round it. Parked cars square to the mapped aisles (bays not mapped). |
| Aaron Education Center r19675678 | generic | not visible from any panorama (hidden by planting). Two mapped courtyards still not cut. |
| Ravine Experience bridge w210457899, Tateuchi pavilion w32121769, Yao Gate r19659543, ponds, boardwalks w453135455 / w1433659385, Lost Meadow bridge w1431835804, Wilburton Hill sports ground | match (position / type) | not seen in Street View. Wilburton Hill Park frontage on Main St: forest edge, matches. |

**Lincoln Square** (origin 47.61755, −122.20195)

| Feature (OSM) | Verdict | What was established / changed |
|---|---|---|
| Bellevue Square NE block w33106348, Bellevue Way face | corrected | SV under the skybridge: white stucco on both storeys, dark shopfronts, ivy bays (Tavern Hall, Castilla, Shake Shack); the red-brick building is the next one south (The Cheesecake Factory, part of the Bellevue Square model). Round 1's brick base removed. |
| Avenue Bellevue w1215907936 / w1215907937 + parts | was wrong look → fixed | SV: two white towers ringed by balcony bands. Were dark office glass. Curved plan and balconies not modelled. |
| Bellevue Way skybridge w43872832 | match (class) | SV: steel truss with glazing on branching columns; the landmark model's truss bridge is of that class. |
| Lincoln Square North podium w161929514 | landmark model (other lane) | SV: glass canopy, The Container Store and Earls at street level, beige / salmon piers; "LINCOLN SQUARE" lettering on the NE 8th canopy. |
| Bellevue Way medians | not in the scene | SV: a yellow-kerbed raised median under the skybridge and a planted median near NE 6th. Roads are painted by the locked `osm.js`. |
| Research plaques "Bellevue Square", "Skybridge" | fixed | they stood inside the w33106348 block since round 1 made it a building again. |

## 12. Fidelity pass round 3, 2026-11-13 (lane sea-spots)

Sources: live OSM (API 0.6 / Overpass, 2026-11-12/13), USGS 3DEP 1 m DEM (EPQS point queries, 2026-11-13), the Seattle
public-art records quoted in the OSM nodes' tags, Wikipedia ("International Fountain"), and official Google panoramas
(found through Maps' coverage lookup, viewed through the thumbnail endpoint, nothing stored). Game frames rendered at the
panorama position (eye 2.5 m) and bearing.

**International Fountain (Seattle Center).** OSM w35352476 (amenity=fountain, height=37) is not in the spot extract nor in
the source context; its 34-node ring is stored in `scenes/seattle-center-fountain.js`. The dome is OSM building
w394955907 (roof:shape=dome, height 3, 9.5 m across; Wikipedia gives 27 ft = 8.2 m × 10 ft for the 1995 stainless dome —
OSM kept). The native volume of w394955907 had been drawn as an apartment block with windows. DEM across the bowl: floor
32.90–32.99 m NAVD88 within ~17 m of the centre, rising to 35.1 (north) … 37.0 (south) m at the ring. Wikipedia: 4 "super
shooters" up to 120 ft (37 m = the OSM height), 56 micro shooters in the granite floor, a ring of floodlights between them
and the dome. Panorama Efow4N6Ma8F4LGpK2x3jWQ (south-east edge) looking 351°: a low kerb on the rim with a red-brown
face, a light grey bowl, a low silver dome, the jets off; looking 300° / 0°: the ground between that panorama and the rim
is asphalt paving, not lawn (OSM maps only the landuse=recreation_ground "Fountain Lawn" w394955954 there). The scene's
native ground (and the seam of the source-context ground) now extends west from x = −208 to x = −288 to hold the bowl and its terraces. Estimates: micro-shooter ring radius, floodlight ring radius,
the show rhythm (90 s show, 60 s still).

**Olympic Iliad.** OSM n3211770187 (Alexander Liberman, 1984): "41 … bright red rolled steel cylinders ranging in size from
48 to 64 in diameter … piled on top of one another at various angles", H 45' × W 60' × D 30'. Panoramas
LUaNF3kzF_XhFiy0kx43bA (looking 278°) and RB_2Feewsyx_qfiPQNLcaA (looking 17°): an open arcade — upright tubes as legs in
two rows, one tube leaning out at the north end, a tangle of tilted tubes with oblique cut ends on top; long axis
north–south. The split of the 41 tubes into legs and top, their lengths and angles are estimates.

**Pike Place — Western Ave.** Panorama iFZRr4o9WP2yFdlbuLUkeQ (47.60878,-122.34155) looking 315–318°: the SkyBridge
(OSM w296789534, building=roof, layer 1) is an enclosed walkway between two green steel Warren trusses with pale green
panels, a flat roof, a white concrete pier at the market-side kerb; its underside about 6.5 m over the road (estimate).
The west side of Western Ave at that panorama is a low pink-stucco building with a parking sign and a cream three-storey
block, with the Pike Place Market Parking garage beyond; the game shows the garage's long wall with shopfront glazing
and colour bands there. The market's west face carries "Pike Place Market" lettering and white walls with dark windows
over a street-level colonnade. Ground: the east bank of Western Ave (USGS profile in `pike-place-streets.js`) is now flat
to 13 m from the centre line (the 2 m terrain grid had ramped up in front of the market walls as pale mounds).

**Ballard Locks — south-bank plaza and "Salmon Waves".** OSM n3211770269 (Paul Sorey, 2001, SPU04.087): "Seven stainless
steel waves varying from 6 to 9 ft. high", 350 sq ft, blue LEDs (round 2b's "curled concrete forms" was the look; the
material is stainless steel). The node lies on the plaza w1475183524 (highway=footway, area=yes) over the fish ladder
(w285286401, layer −1). The DEM is hydro-flattened to the lake (4.98 m NAVD88) over most of that plaza, so the scene drew
open water there; its dry samples give 6.72 / 6.94 m NAVD88 (−1.78 / −1.56 relative): the plaza is now a deck at −1.67.
Panorama AVeeBVnYYgdepI_VExHVWQ (6 m west of the node) looking 60°: seven brushed-steel bands rising and curling over
into spirals, in a loose row running east across the plaza, curls facing the promenade (layout and curl estimated from
that view).

**Kerry Park.** DEM (2026-11-13) on the terrace (z = 5): +1.18 (x −28), +1.28 (−15), +1.00 (0), +0.58 (25), +0.43 (40),
+0.29 (55) m; on W Highland Dr (z = −8): +1.10, +0.78, +0.45, +0.18 m. The terrace and the street now follow these
profiles (they were level at +0.15); railing, wall, plinth and binoculars follow the terrace.

**Monorail station / Climate Pledge Arena / Pacific Science Center.** The panorama nearest the station
(NaVvIpRPS6R1zvL4egrPUQ, 2022) shows a service yard, not the platforms; no official panorama in reach shows the canopy.
The Science Center's arches have no OSM object; the panoramas checked do not show them. Not changed.

**Guided tour.** A guide held up by a walker (body overlapping the guide) used to replan from inside that walker's
clearance, find no start and end the leg as "blocked" (HEAD: blocked 1 s after the body arrived, waterfront). The replan
now leaves out the bodies whose clearance holds the guide, the guide may step out of such a body, and a leg is called
blocked only after 6 s without progress. The planner retries a failed search on a 0.75 m grid: the Ballard Locks
crossing (north bank → west gate → middle wall → small-lock gates → south wall → dam) plans at 221 m, where the 1.5 m grid
found none (the 2.1 m gate decks leave a 1.3 m band between their railings).

## 13. Fidelity pass round 3, 2026-11-13 (lane sea-spots-b)

Sources: live OSM (API 0.6 and Overpass, 2026-11-13), USGS 3DEP 1 m DEM (EPQS point queries, 2026-11-13), official Google
panoramas found through Maps' coverage lookup and viewed through the thumbnail endpoint (nothing stored, nothing traced).
Game frames rendered at the panorama position (eye 2.5 m) and bearing, summer day, High.

**Pioneer Square fronts.** Each mapped front on Pioneer Place, 1st Ave S, Yesler Way, Occidental Ave S and S Main St
(25 buildings, table `FRONTS` in `scenes/pioneer-square-fronts.js`) now has its own facade instead of the generic red
brick: material (brick / rusticated stone / painted / modern), wall and base colour, storey count (OSM `building:levels`),
cornice, arch pattern (arched ground floor, arched first floor, arched top floor, two-storey arches), storefront colour.
OSM `building:colour` wins where mapped (the 1st Ave S row J&M Hotel, Skagit, Marathon, Lucky Hotel, w439990255:
#85552e). What the panoramas show (id @ bearing):
- Mutual Life Building (w140345971), kJVn9dVw2rWKgTf-rsYWzw @ 250: tan brick upper floors over a red-brown two-storey base
  with round-arched ground-floor openings, pale window frames, paired windows.
- Yesler Building (w439990280): grey stone, arched first-floor windows.
- Gatzert & Schwabacher (w226937778), uVzwONsTTGBy9AqfGImghA @ 290: pale painted wall, dark storefront base, no cornice.
- Terry Denny Lofts (w226321137), uVzw… @ 250 / StRtj6G68vgv607YPmToqw @ 310: red brick, arched top-floor windows.
- Maynard Building (w226937777), StRtj… @ 250 / 270: grey stone, arched ground and top floors.
- 1st Ave S west row (J&M, Skagit, Marathon, Lucky, w439990255, New England Hotel), iEVQhhDOR8aTqLQD5K522g @ 255,
  g3aSGggFrVoEYwpMr3OBLA @ 270: red-brown brick (OSM colour), dark storefront bases, white-framed windows, brick cornices.
- Olympic Block (w226321142), uVzw… @ 70 / 97bndGEyQS57itfhcMvcfA @ 200: beige modern cladding, ribbon-like windows.
- Lippy Building (w140631721), uVzw… @ 110: dark brick, green storefronts.
- City Club Building (w226321147) and The Delmar (w367359273), StRtj… @ 60 / 75: red brick, the Delmar with two-storey
  round arches over each bay.
- Buttnick Building (w140631796), iEVQ… @ 60 / 100: dark grey painted front.
- Grand Central (w140631769), g3aS… @ 70 / 90: red brick over a buff stone ground floor of tall round arches, arched
  top floor.
- Globe Building (w226323009), OqApslrrErDPH77wLl-ESg @ 110 / 998tDSzok9LVXyH1FIpejQ @ 135: red brick over a grey
  two-storey base, teal storefronts.
- Union Trust Building / Annex (w389138212 / w389138218), KLmc32jpRbH8dU_WjBku6A @ 215, 998tD… @ 135: buff stone with a
  grey rusticated base, dark green storefronts, arched top floor, cornice.
- Interurban Building (w226321146), Eoj9slwTpsFLNZYztebPNg @ 60: lighter red brick, two-storey round arches, arched
  top floor.
- Korn Building (w439990299) and Merchant's Cafe (w52782171), 97bnd… @ 185: red brick, dark green storefronts.
- w439990295 (one storey at Yesler / Occidental), Eoj9… @ 250: dark modern front.
- 200 Occidental (w27183365), b5T7tpwVchrYOjElqXCH9Q @ 140: dark brown modern cladding over a glazed ground floor.
Volumes, roofs and colliders stay the native source plan (same footprints and heights); only the wall material differs.
Estimates: bay widths, opening sizes, floor heights, colours (judged albedo), window frames.

**Pioneer Building (w52782046).** Panorama kJVn9… (47.60198,-122.33415) @ 75–100: red brick wings and a central full-height
tower bay of rough-faced grey-brown sandstone round the arched entrance on Pioneer Place, with two stacked oriel bays of dark
blue-grey metal and glass over the middle floors. The entrance had been drawn on a party wall (the longest west-facing edge
touches the Mutual Life block's neighbour); it now goes on the longest street face. Tower width, depths, oriel sizes estimated.

**Occidental Square.** OSM w1155305355 (building=yes, no other tags) is an open canopy: panorama wtV8CTwZJSh3TDNhSKHKLA
(47.60026,-122.33301) @ 265–290 shows glass roof panels on pale timber beams over black steel posts with a small
timber-clad glass kiosk under it; it had been drawn as a closed block. Table tennis n14005376908 and chess n14005378203
(leisure=pitch, both live OSM 2026-11-13) are now at their mapped points. The playground w1155308011 is still not built.
No tree nodes are mapped in the square (the random trees stay).

**Sinking Ship Garage (w52781697, r2-sea-spots-b-7).** Panorama NMuWBnWs062EFE23JyuBAg at the garage's north-east corner
on 2nd Ave Extension looks across its open top deck (parked cars, the PARK sign) about level with the street; the USGS DEM
gives 12.50 m NAVD88 there (scene ground 4.50 m relative, matching). The game draws the mapped volume (3 levels, 10.9 m)
with its roof at 15.4 m relative, about 11 m over that street corner. OSM's height is probably taken from Yesler Way;
the datum of a deck on a slope is a source question (not changed).

**West end (Western Ave → Elliott Bay).** From live Overpass (bbox 47.6005,-122.3395,47.6040,-122.3352, 2026-11-13):
117 roads (Alaskan Way S, the Colman Dock holding lanes 1–45, Columbia / Marion / Madison St), 131 foot and cycle ways,
45 crossings, 17 traffic signals, 137 trees (nodes + tree_rows sampled every 7 m), 17 planted beds (natural=scrub,
landuse=flowerbed), 17 pier / pedestrian areas. Stored in `scenes/pioneer-square-westend-data.js` (generated, ground
level only). Panoramas fYcy5IxBB8nxBtlHlp0w6w (Yesler at Post Ave @ 270), icoHFzEOnBuL9Tmg_QeZUw (Alaskan Way @ 250),
96BnTtZETD_9PxJd3_oy9w (Alaskan Way at Columbia @ 250 / 300): concrete roadways with white zebra crossings, grey
mast-arm signals, young street trees, beds of grasses, the 2023 ferry terminal (a glazed ground floor under a
timber-slatted storey and a dark flat roof). The fine (2 m) terrain now reaches x = −336 (was −144).

**Seattle Center.** Climate Pledge Arena (w25123756): its OSM parts (roof w411521517 white pyramidal from 8 m to 33 m, the
skillion buttresses w1352666990 / w1352647807 / w1352647810, w1352647812, the Alaska Airlines Atrium w1270549342) were
hidden inside the parent drawn as a 35 m box of apartment windows. Panoramas xLh7PyEOCxKVuesNWAzPBw (1st Ave N @ 270:
glass curtain wall under a thin white fascia, a white sloped concrete A-frame at the middle of the east side) and
jLP72IlkxVljWg52cvsHAA (Thomas St @ 10 / 60: green-tinted glass, white mullions). Now the parts are drawn as mapped (untagged
colours white) and the parent outline as the glass wall up to the roof part's 8 m with a fascia. Monorail station:
panorama 1_C7cgJZv-E44e8HIqd5tg (the concourse, 47.62111,-122.34999) @ 330 shows a curved translucent canopy on arched
ribs over the platforms (w333355314/5/7) and the concourse (w637649471), dark columns, a black fascia with "ALWEG
MONORAIL" in red letters; drawn so (rise, rib spacing estimated). International Fountain apron: panorama
Efow4N6Ma8F4LGpK2x3jWQ @ 140 / 320: asphalt all round between the rim kerb and the lawn; now a 6 m asphalt apron (width
estimated). Not done: MoPOP skin (iridescent curved lobes), screening trees, Pacific Science Center arches.

**Pike Place west walls.** Panorama iFZRr4o9WP2yFdlbuLUkeQ (Western Ave) @ 60: white-painted walls with rows of wide
red-framed multi-pane steel windows several storeys down the bluff; drawn so on the market halls' and the Main Arcade's
west walls (were the generic apartment tile). The Western Ave west side (low pink stucco building, cream three-storey
block) and the "Pike Place Market" lettering are still not drawn.

**Waterfront.** Overlook Walk (w1256939020) is walkable: the deck is a solid at its level over Alaskan Way (w1256939017,
layer −1), with railings as walls; the Salish Steps (w1320933922 + w1320933923, steps "down" from the deck's west edge)
are a 6.5 m wide flight to the promenade (panorama cLi3KbZ4ALUiPoUywFMtKw @ 70: a wide concrete flight between handrails
and cheek walls; width estimated), and the east stair core (w1289027232–4, w1256939012, levels 1–4) is a "take the
stairs" use between its foot and the deck (its flights are too small to walk with the game's body). Ocean Pavilion
(w1256939021): panoramas d_zvaPdDFeRnyCx2epCvqA @ 250 and nVwg3181AIHZBcGR4Gy80w @ 270 show a board-formed concrete base
about 2.2 m high under the charcoal ribbed cladding: drawn. Panorama VuVTZJti0rfyEFN0lJAiMQ @ 240: Pier 60 is a low
open-sided shed under a shallow gabled roof (not a vault): not changed yet. The lane lines of the concrete roadways north
of Union St and the street trees there were checked on a top-down: lane lines present, no tree in a roadway (already at
9824fd56).

**Fremont Troll / Aurora Bridge.** Official panoramas run under the bridge along N 36th St (Z4ECcm_Bohycl_4lNh_0Yw,
1Ei0hgAU9k4ebaKIP7yMvw, Yz1JPc9S36oaFTKzQyz7Mg, s2nejgAfrxEcFPqUbBfauA) and on the deck (x2QjqdB3dcu1G078SXSXkA and the
x = −12.5 / −1.0 rows). From the deck the column lines are not visible. Z4ECcm @ 90 shows the arch over the Troll spanning
to a column on its east side; the game draws a column line west of the Troll as well (x = −8.75). The positions could not
be fixed from these views with confidence (pano heading vs the Troll's bearing disagree by about 30°).

**Gas Works fine terrain.** EPQS answered again on 2026-11-13 (single queries 2–9 s, about one point a second): a 5 m grid of the 1 m DEM over the Prow and the south shore (x 0…160, z 70…130, 429 points) refines the 10 m grid of 2026-11-12; the two agree exactly at their 119 shared points. The full-park 5 m grid (2,277 points) was not finished.

## 14. Bellevue scenes — round 3 of the fidelity pass (2026-11-13, lane bel-spots)

Sources used: live OSM (Overpass extracts of 2026-11-12, plus buildings round Meydenbauer Bay at osm_base 2026-11-13T05:52Z);
official Street View panoramas found with the coverage-metadata lookup (viewed only, nothing saved); the Bellevue Botanical
Garden's own art page (bellevuebotanical.org/garden-art, the `source` the artwork nodes cite) and history page; Commons photos
named by OSM `image` tags ("Bellevue, WA (2023) - 02 / 12 / 28") and "Bellevue Botanical Garden 04 - Aaron Education Center";
USGS 3DEP 1 m elevations.

**Botanical Garden.**
- Aaron Education Center r19675678 (Olson Kundig, June 2014): two inner rings (w1435225256 = bed GC03, w1435225279) are open
  courtyards. Garden side (Commons): one storey, pale timber panels between white posts, white multi-pane glazed doors, a thin
  grey metal roof edge with a deep overhang.
- Shorts House r6758706 (building=retail, the shop): the Shorts' 1957 "contemporary home" by Paul Kirk (garden history page);
  its inner ring w184864667 is the atrium (bed SH06, Sheepish Rabbit). The garden's rabbit photo shows a pale grey wall base and
  light timber above in the atrium. No exterior photo found: storeys / roof are estimates.
- Sharp Cabin w453135458 (Commons photo from its north-west, 2023): one-storey cottage, khaki lap siding, taupe trim, steep grey
  shingle roof with a cross gable, recessed porch with white rail and fretwork brackets in the north gable end, red door.
- Artworks (art-page photos): Owl's Glare — bronze owl landing with raised wings on a boulder; Goldiwarts — large bronze toad
  beside a bronze leaf; Large Galaxy — tall S-curved brushed-steel stem with a cluster of coloured kinetic pieces (≈ 5 m);
  Shaman — tall pointed dark monolith with carved folds (≈ 2.3 m); Three Cranes — three verdigris metal cranes on thin legs,
  one stooping; Sophia's Dream — a long low dark carved stone (bench-like, ≈ 2 m); The Nature of Sitting — a brushed-aluminium
  leaf cut-out on a rough granite block; Sheepish Rabbit — hunched rounded bronze rabbit on a grey stone drum.
- Perennial Border r19655849: garden:style=flower_garden; its ring is two outer ways sharing both ends. The spot extract appends
  the second way unreversed (a bow-tie outline); the scene rejoins it. It has no mapped beds inside.
- The visitor-lot parked cars stay an estimate (OSM maps lot + aisles, not bays / occupancy); the drive's official panorama shows
  the lot in use.
- The research iconic photo (ravine bridge) is ≈ 300 m from the entry spawn, past the guided tour's 230 m reach; the game's
  postcard frames the Perennial Border instead (owner decision open: r3-bel-spots-9).

**Meydenbauer Bay Park.**
- Lake Washington Blvd bridge, seen from below (official panorama on the lane beside it, 47.612160, −122.211318): concrete slab
  deck on single upright tapered rectangular piers under its middle — no canted struts.
- Lake Washington Blvd street lights: grey cobra heads (round 2); park lights: dark posts. The 99th Ave NE light is a dark post
  with a bell pendant.
- Far shores from 99th Ave NE (47.610531, −122.209775, yaw 235): houses, condos and boathouses at the waterline under the fir
  belt. 152 live-OSM footprints outside the DEM grid within 120 m of the water: `game/data/spots/bel-meydenbauer-shore.json`.
- Steps: w840902386 (17 steps) rises 2.2 m on the USGS DEM (y 0.30 → 2.49 on the scene datum); w841411878 (5 steps up to the
  terrace) from y 3.7 → 4.45. The scene's bank grading gives 0.76 m and ≈ 0 m there.
- Fish sculpture n13707322282: OSM "A native-PNW style fish sculpture"; hidden by shrubs from both panoramas in reach; no photo.

**Downtown Park.** Ten forecourt benches n7861958149–158 (white in Street View). Mapped terrace walls w810574801–803 and
w842753004–006 (no height tag), old-school outline w810575032 (height=0.2). No OSM nodes for the forecourt's lantern lamps /
kerb bollards.

**Lincoln Square.** w33106348: official panoramas on Bellevue Way (47.617039, −122.201613; 47.616778, −122.201609): two tall
storeys, restaurant-row cornice level with the street-light heads (≈ 10 m), Crate & Barrel corner parapet ≈ 12 m; on NE 8th
(47.617365, −122.202878) the west part is red brick with a steel-and-glass canopy and a glazed upper storey; towards NE 6th
(47.616193, −122.202176) cream stucco with a brick base, ivy and tall windows. Upper-level tenants (Cactus, Thai Kitchen Bird
Pepper, both level 2) show no legible street sign. Bellevue Way south of NE 8th is mapped as two one-way carriageways
(w425272687 southbound; w738584326 / w470492322 northbound): a divided road, consistent with the medians seen in round 2.

## 15. bel-lincoln-square: Bellevue Square ↔ West Parking Garage skybridges (round 3, lane builder, 2026-11-13)

Live OSM (API 0.6, 2026-11-13): twelve `highway=footway` + `bridge=yes` + `layer=1` ways cross the service drive between the
mall's west wall and the West Parking Garage (w30758875): covered w387201731 (z ≈ 86), w29234888 / w843400176 / w843400178 /
w843400185 / w843400163 (z ≈ 155–163), w30758942 / w843400164 (z ≈ 277–280, continuing as the already-extracted
w843400165 to the east); open w29234889, w843400118, w843400136, w843400114 (garage-deck walkways). All twelve are appended to
`bel-lincoln-square.json` `ways` by `tools/spots/append-osm-features.mjs` (schema of `build-data.mjs`; nothing else changed).
The scene draws a covered one only through its own skybridge() list: `patches/bel-lincoln-square.js.patch` adds
w387201731, w29234888, w843400178, w843400185, w843400163, w30758942 and w843400165 (the 2 m junction stubs w843400176 /
w843400164 are left out: an unmitred 4.6 m box on a 2 m stub stuck out of the garage corner). Floor height: the scene's
skybridge estimate (6.2 m); no measured height. The 54 ground ways of the same strip are still not extracted (backlog
r3-builder-spots-4). Official panoramas on the drive: EE7cKAltcksKzsSBPd822A, odcxtWhNyv-UeSc9O436Lw, _-8mGqQtoDS7uRaPUYC-ww;
not viewed this round (browser pane at its tab cap).

## 16. Round 3, lane builder (2026-11-13): multipolygon outlines in the Seattle spot extracts

Sources: live OSM (API 0.6 / Overpass, 2026-11-12/13; the round-2 map.json tiles of each district for the cached-source
tools), official Street View panoramas looked at for appearance only (nothing stored, nothing extracted into data).

Bow-tie multipolygons in the Seattle spot extracts (member ways joined without reversing): 23 relation areas repaired in
the scene data from live OSM relation geometry (`tools/spots/repair-relation-outlines.mjs`): Bellevue Botanical Garden
(Perennial Border r19655849, Curbside Gardens, Waterwise, Shorts Ground Cover, Rock Garden … 15), Gas Works (park r1047789,
r5579292, r7174145), Seattle Aquarium r16051213 (pike-place, waterfront), Broad Street Green r5569823, Piers 55 / 59.
Render: the Perennial Border bed now shows its planting (was lawn). Clipped water bodies (Lake Washington, Lake Union,
Elliott Bay) and Ballard railway r4065613 were not touched (stored outline is a clip, not the same vertices).

Follow-up 2026-11-13 (backlog r3-builder-6 / r3-bel-spots-5 closed): `repair-relation-outlines.mjs --from-extracts
--clip-scenes` repaired the source extracts themselves (`game/research/osm/sea-spots/*.json`: 28 bow-tie relation outlines,
a relation with several outer rings now keeps its id on the largest ring and gets `<id>_<k>` areas for the others, as in the
scene files), so a rebuild with `build-data.mjs` no longer brings the bow-ties back; the extract tool itself is not in this
repo, the repaired extracts are the source from here on. The four clipped outlines (Lake Washington r2793848, Lake Union
r2793813, Elliott Bay r13316235, Ballard railway r4065613) are now the assembled live OSM ring clipped to the stored
outline's bounding box, in the extracts and the scene files (0 crossings; renders of Meydenbauer, Gas Works, the Waterfront
and the Locks unchanged apart from the repaired edges).

## 17. Backlog close-out, 2026-11-13 (Bellevue spots and the spot builder)

Fixed in the game (git history has the commits): picnic tables with both seats and flagpoles at the mapped nodes
(`spots/furniture-extra.js`, the hash-locked `osm.js` drew one seat and no poles; `tourism=information` boards stay undrawn
by design, note 36); the spot audit no longer counts elevated building:part volumes inside another collider as phantoms
(Avenue Bellevue); the Meydenbauer flights w840902386 / w841411878 stand on a bank graded to the USGS DEM; boulevard light
pools sit under the cobra heads; 99th Ave NE has dark bell-pendant posts; the Bellevue Square ↔ West Parking Garage strip
has its 62 live-OSM ground ways (service drive, aisles, sidewalks, crossings, steps), the four open garage-deck walkways are
drawn as concrete decks with rails, the skybridges have one floor level and mitred bends; Avenue Bellevue's tower parts carry
a balcony slab per storey.

Estimates that no available source settles (moved here from the backlog):
- **Meydenbauer.** Terrace deck 4.45 m (USGS DEM), whaling building eaves 3.3 m / rise 3.4 m, boathouse sizes, the 19 added
  piers 2.2 m wide: each read against one panorama. Lake Washington Blvd bridge piers: count (3), spacing and section read
  from one panorama under the bridge. Shore houses (152 live-OSM footprints): levels / roof / colour by rule where OSM has
  no tags. Not seen in any official panorama: the pavilion's beach face, the pier deck from on it, the playground equipment,
  the upper walk's railing (not modelled), fish sculpture n13707322282 (hidden by shrubs, description only: unmodelled).
  Boulevard and 99th Ave NE lamps are generated points (no lamp nodes mapped); the bell lamp's post 4.6 m, arm 0.75 m and
  bell size are estimates. Flight widths 2.0 m.
- **Botanical Garden.** The eight round-3 artworks are low-poly stand-ins sized from one photo each; Shorts House (one
  storey, flat roof, timber over a grey base) has no exterior photo; the Aaron Education Center and the artworks are inside
  the garden (no official panorama). Parked cars use three car models (the others add audit z-fights). The Perennial
  Border's inner beds are not mapped: its ring is painted as one flower garden with 150 perennial clumps. Postcard: the
  Perennial Border frames the tour's postcard (the ravine bridge is ≈ 300 m from the entry spawn, past the tour's 230 m
  reach; the bridge keeps its own activity, "Cross the suspension bridge").
- **Downtown Park.** No official panorama inside the park: canal coping colour, weir sills, cascade face, the terrace walls
  (w810574801–803, w842753004–006: 0.45 m above the higher side), the old-school outline kerb and Piloti's six 0.9 m vaults
  are estimates; the forecourt's lantern lamps and kerb bollards have no OSM nodes (unmodelled).
- **Lincoln Square.** w33106348 heights (row 10 m, Crate & Barrel corner 12 m) read against street-light heads; the
  garage-facing inner faces keep the generic shopfront (no panorama reaches them). Bellevue Way median width = the gap
  between the painted carriageway edges (0.6–2.4 m); planted stretch, kerb height and turn-lane breaks are estimates.
  Skybridge / open walkway floor 6.2 m over the higher end's ground (no measured level; official panoramas on the drive
  EE7cKAltcksKzsSBPd822A, odcxtWhNyv-UeSc9O436Lw, _-8mGqQtoDS7uRaPUYC-ww, xnT4Gtmue9XZR7R-xc0iTQ were not viewable from this
  session). Avenue Bellevue balcony depth 1.2 m and slab 0.22 m are estimates.
