# Round 5 — dispatch plan (ready; starts when the owner finishes the play-test notes)

Source: `game/FEEDBACK.md` "Round 4 play-test" notes 1–27 (+ any that follow), the business / speed-limit research (`game/research/businesses-*.json`, `speedlimits.json`, Requests in specs 11/12), QA round 2 leftovers. Owners per 01-architecture. Every fix is verified with before/after screenshots at the exact pose of the note and a harness check that would have caught it.

## P0 — chapter routes must be drivable and clean
| Notes | Owner | Work |
|---|---|---|
| 1, 2, 10b, 12 | world-visual (+ world-data for data) | Deck/profile regression from the layer-lift pass: no deck may end in mid-air, slope into a lane or lift a non-bridge segment; ramps connect to their roads; Doina Cornea route to the Rectorat drivable; upb chapter start on Șos. Orhideelor, not a service road. Diagnosis so far (read-only, 2026-11-07): the upb chapter start pose is identical before and after the lift commit (on Șos. Orhideelor, 1.6 km route), so the breakage is not only that commit — inspect the owner's poses (looking up/left under Basarab, the service-road spot, Doina Cornea toward the Rectorat) at HEAD and at the pre-lift commit, then rebuild the viaduct correctly. New detectors: `deck-dangling` (ribbon end with no connected ribbon at the same height), `route-blocked` on every chapter route at both 30/60 Hz. |
| 45 | world-visual | Piața Victoriei underpass visible through the square: tunnel lids, portals only at real entrances, real square surface. |
| 12 (fines) | gameplay | Fine accumulation on world collisions, RO number formatting. |
| 4 | gameplay (+ vehicles) | Buses never placed broadside across carriageways/junction mouths; stops at real stops, in lane. |

## P1 — fidelity the owner called out
| Notes | Owner | Work |
|---|---|---|
| 3, 5, research | world-data + world-visual | Brand-name normalisation table (Lukoil, Garanti BBVA …; no non-local scripts on signage), whole-word brand matching, ATMs not as branches, stale shops removed, 147 missing on-route businesses (widen `poiKind`), US brand colours. **Every fuel station modelled as a fuel station** (canopy with brand fascia + lights, pump islands, price pylon, shop, driveways) at its real position. |
| 10a | world-visual | Real storefront signage at ground floor: fascia with brand name/colours, projecting signs, lit at night; no upper-floor box signs; balconies/AC units that read as such. |
| 70 | render | Wet-road/snow look: no blotchy camouflage puddle mask — uniformly darker glossy asphalt with streak reflections, few small puddles; snow only on verges/roofs/cars; bare crowns not as scribbles at night. |
| 11, 17 | render + world-visual | Realistic water (Dâmbovița channel with walls, railing, reflections, flow; lakes); nothing placed in water/fountain basins; conifers only where real. |
| 6 | world-visual + gameplay | Closures: sign plate not in front of the worker's head, worker on the instanced crowd, barrier spans the carriageway, the road visibly continues past the closure into the far city. |
| 9, 18 | world-data + gameplay + spots | Only reachable landmarks shown in a district; unreachable ones (Sky Tower, Globalworth, I-90 bridge/Mt Baker portal, SeaTac tower …) live in tourist spots; map/minimap show every reachable place clearly (icons, labels, legend, list/search) for easy waypoints. |
| 39 | research + landmarks | GTS building at Calea Călărașilor 101 modelled from real references (owner photos if available), realistic office signage, no billboard; same for every CV-stop building (each should be recognisable). |
| 13 | gameplay + world-visual | Clear entrances: modelled doors at the real entrance, beacon + ground ring, prompt only at the door, routes end at the door. |
| 14 | cockpit-ui (office.js) | Unique interiors per CV stop (school, Rectorat, GTS, Luxoft, DB, Arnia, UiPath Bucharest, UiPath Bellevue, airports) with era props, brand colours, real views, colleagues. |
| 37 | cockpit-ui (office.js) + gameplay + progression | Office CV screens → an in-character NPC (teacher / professor / manager / host) with A–D question choices and answers drawn only from the CV content; achievements count answers heard. |
| 71 | gameplay + cockpit-ui (style) | Finale "Story complete" page redesign: hero header, visual timeline, aligned roles/dates, styled skills, contact buttons with icons, stat tiles, actions (CV, free roam, spots, replay), responsive. |
| 16 | gameplay (chapters.js) + cockpit-ui (style) | Cinematic chapter transition (animated stylised map, route line, district fly-over, year counter, clean CV card). |
| 47 | cockpit-ui (flight.js) | Realistic flight map: Natural Earth coastlines (baked, small), proper projection for the great-circle arc (or a 3D globe), clean typography; shared style with the chapter-transition map (16). |
| 15 | gameplay (data.js) | Remove the student-projects GitHub line. |

| 77 | research → world-data → world-visual (+ landmarks) | Every non-residential building in the smaller districts realistic: per-building specs from research (on-route first), parametric archetypes in buildings.js driven by them, iconic ones as landmarks; reference-vs-game sheets per street. |

## P1 — tourist spots
| Notes | Owner | Work |
|---|---|---|
| 22, 24, 25 | spots | Old Town fidelity pass per street (layout, fronts, venues, string lights instead of random cables, terraces with seated people, no hard-hat figures). |
| 23, 26 | spots (+ qa) | Z-fighting and invisible walls in all spots: de-duplicate overlapping footprints/coplanar facades, colliders only from visible geometry; z-fight + phantom-collider detectors in `harness:spots`. |
| 29 | spots | Lamps in the middle of carriageways in spots (Arc), overlapping spot traffic cars. |
| 28 | render (+ spots) | Screen-aligned black rectangle flashing while walking at Arcul de Triumf — likely NaN pixels spreading through bloom; find the NaN source shader, guard bloom input. |
| 30, 34 | spots | Village Museum houses (roofs floating over boxes) and Spring Palace (oversized roof, doubled fences, flat peacock) rebuilt from real references. |
| 31 | spots + gameplay | Rentable bike at Herăstrău next to the spawn; ride park paths. |
| 32, 33 | spots + gameplay (minimap/map) | Map in spots; every landmark/spot has its own map with everything relevant (entrances, hero, plaques, postcard, cafés, toilets, bikes, transit), waypoints. |
| 35 | spots | Cișmigiu: railing across the bridge entrance, stepped blocky deck, broken handrails — walkable arched footbridges like the real ones. |
| 36 | spots | Blank green signboards (no text) — readable plaques on both faces, no empty signs. |
| 55 | spots/landmarks (+ render) | Space Needle underside flickers (coplanar discs / depth precision); proper underside beams + elevators; consider near-plane/log depth on foot. |
| 54 | spots (+ render) | Chihuly Glasshouse: real glass, sculpture as translucent glass forms, no floating slab, night lighting; full fidelity pass. |
| 66 | spots + world-visual | Lincoln Square/Bellevue Square spot: reuse the district landmark models + facade/lit-floor shader, real ground/streets, skybridges, streetscape. |
| 67 | spots + gameplay + progression | In every spot: minimap with objectives (plaques, postcard, activities, viewpoints, entrances) + optional guided tour (guide NPC with flag, route line, narration, checklist, achievement). |
| 65 | spots (+ render) | Gas Works Park: gasworks towers, Kite Hill + sundial, Lake Union shoreline + water, the skyline view across the lake (lit + reflected at night). |
| 64 | spots (+ render) | Ballard Locks: lock chambers + gates + boats + water levels, fish ladder, spillway, botanical garden; night lighting (crowns/people not black scribbles). |
| 63 | research + spots | Pioneer Square totem pole modelled faithfully and respectfully (carved figures, formline palette, weathered cedar), correct attribution on the plaque; Pioneer Place pergola, bust, Pioneer Building. |
| 62 | spots | Great Wheel ride: inside an enclosed gondola (glass, frame, bench, riders), slow rotation, real 3D lit skyline (no noise-textured slabs). |
| 69 | spots (+ render) | US spots as a set are unacceptable (Meydenbauer: black slab bay, thin pier, flat boxes, silhouettes): rebuild shared ground/water/lighting/buildings first, then each hero; hidden from the menu until each passes the note-61 review. |
| 60, 61 | spots (+ render, qa) | Waterfront: Pier 57 + promenade, lit Great Wheel, water reflections, bay context. **Quality bar for all 24 spots**: reference-driven rebuild + side-by-side review vs real photos (day/night, spawn, postcard, 3 walk poses); spots below the bar hidden until fixed. |
| 59 | spots | MoPOP: folded sheet-metal Gehry forms in the real colours with panel texture, monorail beam + train through the building, plaza; no floating squiggle. |
| 58 | spots (+ render) | Kerry Park: the real postcard view — elevation, slope, Space Needle foreground, 3D lit downtown skyline at real scale, Elliott Bay + ferries + cranes, Rainier when clear, nothing blocking. |
| 53 | spots | Pike Place full fidelity pass from references (arcade + stalls, sign + clock, Post Alley, Gum Wall, paving and slope, crowds, night). |
| 51, 52 | spots Pike Place signs tilted/floating/overlapping across upper floors; indoor market shops get no outer-facade signs (or a directory board), one non-overlapping sign per shopfront, upright at fascia height. |
| 50 | spots (+ render) | Pike Place: Rachel inside the fish counter, broken plaque stand, old blocky vendors, blown-out floor under arcade lights; no prop–prop intersections (detector). |
| 49 | spots | See-through/floating buildings in spots: extrude to the ground, closed volumes, walker can't enter buildings. |
| 48, 56, 68 | spots | Pike Place / Seattle Center (and all spots): streets replaced by terrain blobs — ground from OSM streets/pavements; lit windows via the shared building shader; non-overlapping bubbles; only place-appropriate lines. |
| 20, 27 | spots | Terrain flattened under paved esplanades/plinths (Parliament), no camera roll on slopes; crowds on the walkable surface (steps), never inside colliders. |

## P1 — game structure (owner decision)
| 75 | gameplay (+ cockpit-ui style, progression) | One game, two modes: Story ↔ Explore switchable in place from the pause menu; shared world-map hub (all districts + spots as pins, the flight between cities); main menu Continue · New story · Explore; shared progress/achievements. Supersedes the free-roam menu section. |

## P2 — gameplay features
| 57 | research + spots + progression | Activities at every landmark/spot (e.g. Space Needle elevator → The Loupe rotating floor → open deck view), researched real experiences only, each with an achievement in a new Landmarks category. |
| Notes | Owner | Work |
|---|---|---|
| 38 | gameplay (traffic.js peds) | Street pedestrians avoid trees, lamps, poles, bins, parked cars (sidewalk lanes around obstacles + local steering), harness check. |
| 73 | gameplay + progression | IndexedDB persistence: autosave + "Continue" (exact position/state), photo gallery, optional data cache; migrate localStorage keys; fallback + versioned schema. |
| 72, 74 | gameplay (+ cockpit-ui style) | "Deploy drone" on foot (spots + districts, not indoors): lift-off transition, drone mode with its own HUD (altitude/range/battery/REC), rotor audio, sway/gimbal, fast flight, range + return-home, aerial photos/achievements; distinct from Explore's free camera. Pause menu on Esc / ⏸ (Resume, Map, Free roam, Chapters, Spots, Conditions, Achievements, Photo, Settings, Main menu) everywhere incl. spots/offices and phones. |
| 7 | gameplay | Find the car on foot: map/minimap/HUD marker + distance/direction, walk-to-car route, key-fob beep/flash, call the car. |
| 8 | gameplay + research | Illegal parking reactions by culture (RO / US) with researched lines, tow/clamp/ticket, NPCs routing around. |
| 44 | progression (achievements.js) + gameplay | Achievements unlock at the event (chapter goal reached), not a chapter later; toast not queued behind transitions. |
| 41, 42 | gameplay (chapters/main) | Same-district consecutive chapters (Luxoft → DB, Arnia → UiPath Bucharest): no respawn, no card — the next objective appears where you are (walk/drive there). |
| 43 | orchestrator → world-data | Smaller districts focused on the chapter streets for ~100 % fidelity: propose per-district boundaries to the owner first, then rebuild; route-length rule relaxed. |
| 19 | cockpit-ui (photo.js) | Photo mode restores the exact camera state on close. |
| 21 | gameplay (input/main) | Closing any panel returns focus/pointer lock to the game. |
| — | gameplay | WebGL context-loss recovery (pause + restore instead of a broken page). |

## Verification
- qa: visual QA round 3 over all chapter routes + spots after the P0/P1 batches; every note's pose re-shot; Top-25 list updated.
- Preview republished only after telling the owner (republishing reloads an open preview).

## Parallel lanes and file ownership (round 5, started 2026-11-07 — overrides 01-architecture for this round)
Each lane edits ONLY its files. Anything else → a dated Request in the owning spec + mention in the final report. Cross-lane hooks in `main.js` are added by the **gameplay** lane (or as tiny, localized hook lines the brief explicitly allows — re-read the region right before each Edit, never reformat others' code). Nobody commits, pushes or republishes the preview; the orchestrator does.

| Lane | Owns | Notes (game/FEEDBACK.md round 4) |
|---|---|---|
| gameplay | main.js, player.js, input.js, hud.js, nav.js, audio.js, data.js, chapters.js, onfoot.js, index.html, telemetry-game.js, dev/harness/page/* | 72 pause menu, 12/71 fines, 44, 21, 19 (close path in photo.js), 41/42, 15 → then hooks for explore/traffic/save/finale/transition, 7 find the car, 9 map entries |
| explore (new) | new: explore.js, worldmap.js, drone.js; delimited `/* explore */` block in style.css | 74 deploy drone, 75 Story↔Explore + world-map hub, 76 retire old free roam (with gameplay) |
| traffic (new) | traffic.js | 4 buses broadside, 38 peds avoid obstacles, 8 illegal-parking reactions (behaviour + bubbles), NPC spawn/overlap leftovers |
| world-visual | world.js, geobuild.js, buildings.js, trees.js, dev/harness/visual/page/geometry.js (detectors) | residual 1/2/10b/12 (stacked ribbons, ramp lifts), 6 closures, 10a/10c storefront signs + balconies, 5 real fuel stations, 17 nothing in water + conifers, signage Requests from research (brandStyle whole-word, styles, ATMs, vacant) |
| world-data | cities.js, minimap.js, tools/osm/*, game/data/*.json (not spots) | 43 smaller-district boundary PROPOSAL (maps for owner approval, no rebuild yet), 9/18 reachable-landmark lists + map POI categories/icons/legend data, data for the world-map hub |
| render | render.js, weather.js, new water.js, vendor/addons/* | 11 water (shared water material/API for districts + spots), 70 wet road/snow/night crowns, 55 depth precision, 50 blown-out floors |
| spots-core | spots/{index,osm,ground,kit,props,people,ui,walker,backdrop,sdf,sound,cars}.js, new spots/bike.js, dev/spots.html | 48/56/68 ground from OSM, 49 closed buildings, 23/26 z-fight + phantom colliders, degenerate normals, 27 crowds on surfaces, 29 lamps/traffic in spots, 36 plaques, 51/52 sign placement, 32/33/67 spot map + guided tour, 31 Herăstrău bike, 61 review gate (hide spots not passing) |
| spots-buc | spots/scenes/{buc-*,arcul-de-triumf,athenaeum-revolution,cismigiu,spring-palace}.js, game/data/spots/{buc-*,arcul-*,athenaeum-*,cismigiu,spring-palace}.json | 20, 22, 24, 25, 30, 34, 35 + hero fidelity, activities from research (57) |
| spots-sea | spots/scenes/{seattle-center,pike-place,kerry-park,waterfront,pioneer-square,ballard-locks,gas-works,fremont-troll}.js + their data | 50, 53, 54, 55, 58, 59, 60, 62, 63, 64, 65 + activities (57) |
| spots-bel | spots/scenes/bel-*.js + their data | 66, 68, 69 + activities (57) |
| cockpit-ui | vehicles.js, crowd.js, office.js, flight.js, canvasText.js, photo.js (except the close path), new transition.js, new finale.js, style.css (except the explore/achievements blocks) | 14 unique interiors, 37 NPC dialogue A–D (CV content only), 16 chapter transition, 47 flight map, 71 finale page |
| progression | achievements.js, new save.js, delimited `/* achievements */` css | 73 IndexedDB autosave/Continue/photo gallery, 57 Landmarks achievement category |
| landmarks | landmarks.js, dev/landmarks.html | 39 CV-stop buildings faithful (GTS Călărașilor 101, BOB Tower, Hermes, Europe House, The Landmark, Rosetti, Rectorat) from research |
| research | game/research/* | 57 real activities per landmark, 63 totem attribution, 39 CV-stop building facts, 24 Old Town street fronts, 37 dialogue grounding notes, drone rules |
| qa (later) | dev/harness/run.js, report.js, README, visual/* (except detectors in geometry.js this round) | round 3 after the batches |
