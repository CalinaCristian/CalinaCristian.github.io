# Round 5 — dispatch plan (ready; starts when the owner finishes the play-test notes)

Source: `game/FEEDBACK.md` "Round 4 play-test" notes 1–27 (+ any that follow), the business / speed-limit research (`game/research/businesses-*.json`, `speedlimits.json`, Requests in specs 11/12), QA round 2 leftovers. Owners per 01-architecture. Every fix is verified with before/after screenshots at the exact pose of the note and a harness check that would have caught it.

## P0 — chapter routes must be drivable and clean
| Notes | Owner | Work |
|---|---|---|
| 1, 2, 10b, 12 | world-visual (+ world-data for data) | Deck/profile regression from the layer-lift pass: no deck may end in mid-air, slope into a lane or lift a non-bridge segment; ramps connect to their roads; Doina Cornea route to the Rectorat drivable; upb chapter start on Șos. Orhideelor, not a service road. Diagnosis so far (read-only, 2026-11-07): the upb chapter start pose is identical before and after the lift commit (on Șos. Orhideelor, 1.6 km route), so the breakage is not only that commit — inspect the owner's poses (looking up/left under Basarab, the service-road spot, Doina Cornea toward the Rectorat) at HEAD and at the pre-lift commit, then rebuild the viaduct correctly. New detectors: `deck-dangling` (ribbon end with no connected ribbon at the same height), `route-blocked` on every chapter route at both 30/60 Hz. |
| 12 (fines) | gameplay | Fine accumulation on world collisions, RO number formatting. |
| 4 | gameplay (+ vehicles) | Buses never placed broadside across carriageways/junction mouths; stops at real stops, in lane. |

## P1 — fidelity the owner called out
| Notes | Owner | Work |
|---|---|---|
| 3, 5, research | world-data + world-visual | Brand-name normalisation table (Lukoil, Garanti BBVA …; no non-local scripts on signage), whole-word brand matching, ATMs not as branches, stale shops removed, 147 missing on-route businesses (widen `poiKind`), US brand colours. **Every fuel station modelled as a fuel station** (canopy with brand fascia + lights, pump islands, price pylon, shop, driveways) at its real position. |
| 10a | world-visual | Real storefront signage at ground floor: fascia with brand name/colours, projecting signs, lit at night; no upper-floor box signs; balconies/AC units that read as such. |
| 11, 17 | render + world-visual | Realistic water (Dâmbovița channel with walls, railing, reflections, flow; lakes); nothing placed in water/fountain basins; conifers only where real. |
| 6 | world-visual + gameplay | Closures: sign plate not in front of the worker's head, worker on the instanced crowd, barrier spans the carriageway, the road visibly continues past the closure into the far city. |
| 9, 18 | world-data + gameplay + spots | Only reachable landmarks shown in a district; unreachable ones (Sky Tower, Globalworth, I-90 bridge/Mt Baker portal, SeaTac tower …) live in tourist spots; map/minimap show every reachable place clearly (icons, labels, legend, list/search) for easy waypoints. |
| 39 | research + landmarks | GTS building at Calea Călărașilor 101 modelled from real references (owner photos if available), realistic office signage, no billboard; same for every CV-stop building (each should be recognisable). |
| 13 | gameplay + world-visual | Clear entrances: modelled doors at the real entrance, beacon + ground ring, prompt only at the door, routes end at the door. |
| 14 | cockpit-ui (office.js) | Unique interiors per CV stop (school, Rectorat, GTS, Luxoft, DB, Arnia, UiPath Bucharest, UiPath Bellevue, airports) with era props, brand colours, real views, colleagues. |
| 37 | cockpit-ui (office.js) + gameplay + progression | Office CV screens → an in-character NPC (teacher / professor / manager / host) with A–D question choices and answers drawn only from the CV content; achievements count answers heard. |
| 16 | gameplay (chapters.js) + cockpit-ui (style) | Cinematic chapter transition (animated stylised map, route line, district fly-over, year counter, clean CV card). |
| 15 | gameplay (data.js) | Remove the student-projects GitHub line. |

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
| 20, 27 | spots | Terrain flattened under paved esplanades/plinths (Parliament), no camera roll on slopes; crowds on the walkable surface (steps), never inside colliders. |

## P2 — gameplay features
| Notes | Owner | Work |
|---|---|---|
| 38 | gameplay (traffic.js peds) | Street pedestrians avoid trees, lamps, poles, bins, parked cars (sidewalk lanes around obstacles + local steering), harness check. |
| 7 | gameplay | Find the car on foot: map/minimap/HUD marker + distance/direction, walk-to-car route, key-fob beep/flash, call the car. |
| 8 | gameplay + research | Illegal parking reactions by culture (RO / US) with researched lines, tow/clamp/ticket, NPCs routing around. |
| 41 | gameplay (chapters/main) | Luxoft → DB: no respawn, no card — the DB objective appears where you are (walk/drive to BOB Tower across the street). |
| 19 | cockpit-ui (photo.js) | Photo mode restores the exact camera state on close. |
| 21 | gameplay (input/main) | Closing any panel returns focus/pointer lock to the game. |
| — | gameplay | WebGL context-loss recovery (pause + restore instead of a broken page). |

## Verification
- qa: visual QA round 3 over all chapter routes + spots after the P0/P1 batches; every note's pose re-shot; Top-25 list updated.
- Preview republished only after telling the owner (republishing reloads an open preview).
