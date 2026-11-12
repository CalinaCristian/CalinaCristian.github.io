# 10 — Chapters in districts

Owner roles: **world** (district data, CHAPTERS, boundaries), **gameplay** (chapter flow, transitions, chapter select).

## Current map and conditions behavior (owner, 2026-11-08)

Map selection marks a destination and sets any available local driving/walking route; it does not move the player in Story, free roam or a tourist scene. Remote districts/spots retain a destination without inventing a route through unloaded areas. Hold F for 1.2 s or choose the explicitly labelled Fast travel action to move. A brief F press cancels; fuel, clamp, legal-landing and transit checks still apply. Selecting/Clearing a mark preserves the chapter and its objective; choosing the car route replaces a remote mark. On-foot district travel returns to the parked car before driving travel. The explicit drone T action remains separate.

Pause → Settings → Time, weather & season and K work in driving and on-foot play. Chosen local hour/preset, weather and season follow district/city changes, story resume/chapter entry and Continue; Live/Auto follows the destination. The panel highlights the effective selections, including story play. Continue preserves a finite empty tank instead of silently refilling it.

## Why
Trips between story points were too long; districts keep a good amount of driving but in about 1 km² each, sized by drive time. The 0.7/0.5 scale squeeze also caused overlapping parallel roads.

## Requirements
R10.1 Districts at **real 1:1 scale**, ~**1 km²** each (sized so the chapter route is 1.5–2.5 km ≈ 2–4 min with traffic). The Bellevue finale drive is **≤ 3 min** at legal speeds including signals. Fully covered inside the boundary (all roads, buildings, POIs, trees, furniture), not a corridor.
R10.2 District list (boundaries chosen by world, snapped to quiet streets/parks/river where possible):
| id | city | area | chapters (stop · year) |
|---|---|---|---|
| `floreasca` | bucharest | Calea Floreasca, Barbu Văcărescu, Garibaldi, Floreasca Park | rosetti · 2009 |
| `grozavesti` | bucharest | Grozăvești, Politehnica, Splaiul, Podul Grozăvești | upb · 2013 |
| `unirii` | bucharest | Piața Unirii (fountains), Calea Călărașilor, Hala Traian, Bd. Unirii east | gts · 2015 |
| `pipera` | bucharest | Pipera, Bd. Dimitrie Pompeiu, Hermes Business Campus, BOB Tower | luxoft · 2017 (Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7), db · 2017 (BOB Tower, Bd. Dimitrie Pompeiu 6A) |
| `romana` | bucharest | Piața Romană, Lascăr Catargiu, Vasile Alecsandri, Piața Victoriei | arnia · 2019, uipath-buc · 2020 |
| `otopeni` | bucharest | Henri Coandă terminal + short DN1 approach | otopeni · 2022 (boarding) |
| `seatac` | seattle | SeaTac terminal loop, departures/arrivals, SR-518 to I-5 | seatac · 2022 (waypoint: drive out) |
| `bellevue` | seattle | Downtown Bellevue + the I-405 stretch at the NE 8th St exit (NE 8th, Bellevue Way, Lincoln Square); the I-90 floating bridge appears only in the montage into the chapter | uipath-bel · 2022→2025 (stop = UiPath's entrance in Lincoln Square; Plaza Center 2022–2025 shown as a passing landmark with a story caption) |
R10.3 Roads leaving a district end in a visible "end of map / road closed" barrier + soft invisible wall; traffic despawns there; the player can't leave.
R10.9 **Free drive inside every district** (all streets around the work locations are drivable, not just the chapter route), with **in-world, GTA-style boundaries** instead of an invisible wall:
- **Bucharest**: every road crossing the boundary ends at an authentic roadworks closure: "DRUM ÎNCHIS / LUCRĂRI" signs, red-white barriers and cones, a "DEVIERE" (detour) arrow, an excavator or a dug-up tram line, sometimes a Poliția Rutieră car with lights, and a worker whose chat bubbles joke about Bucharest's never-ending roadworks (lines from research). Main boulevards use larger setups (concrete jersey barriers, flashing arrow boards).
- **Seattle/Bellevue**: WSDOT/SDOT closures: "ROAD CLOSED" type III barricades with flashers, orange drums, "LOCAL TRAFFIC ONLY" / "DETOUR" signs, a flagger with a STOP/SLOW paddle, and an I-90 ramp closed "for bridge maintenance".
- **Story hints like Vice City's closed bridges**: closures on roads that lead toward a later chapter carry a sign with the next location, e.g. "Pipera → 2017" or "SeaTac → after your flight". Approaching one shows a HUD toast: "Road closed — Pipera opens in Chapter 4 (2017)". Other closures say the area is outside the story.
- **It still looks like a city past the edge**: real buildings continue as low-detail backdrop for ≥ 1 km, with distance haze, so the world never ends in a void; the minimap/big map shows the outside area hatched.
- **Smooth turnaround**: pushing into a closure gently stops the car (soft collision, no damage); after 2 s a prompt offers "Turn around" (auto U-turn into the right lane). On foot, the closure is a fence or tape line.
- **Traffic**: NPCs never drive into a closure; they U-turn or turn off before it, honk at it occasionally (Bucharest), and despawn out of view behind it.
R10.10 **Free-roam menu**: the main menu offers "Free roam" from the start (no story progress needed): pick any of the 8 districts, a time of day (now / morning rush / noon / golden hour / night) and weather (live / clear / rain / fog / snow); the car starts on a main road (the district's chapter start). No objective or chapter cards; offices in the district can be entered and their CV content read; story progress is unaffected. **In free roam an in-game conditions panel** (a ☀️/⚙️ button on the HUD + a key, and an entry in the pause menu) changes live, without reloading: time of day (slider over 24 h + presets: dawn, morning rush, noon, golden hour, dusk, night), weather (live / clear / cloudy / rain / storm / fog / snow) and season (auto from date / spring / summer / autumn / winter); traffic density follows the chosen hour. The panel works on phones (touch, portrait and landscape, large hit targets, doesn't cover the touch pad while open, pauses or slows the game while open). Districts stay separate (closures at the edges); M → map offers switching district (montage) and the tourist spots.
R10.4 `CHAPTERS` exported from cities.js in story order with `start` chosen so the route to the stop is 1.5–2.5 km through the district's most characteristic streets/landmarks, on a legal lane.
R10.5 Chapter flow: start at chapter 1; on leaving the office (or reaching a waypoint) → "Chapter complete" card → "Next: <year> · <title>" with Continue / Free drive here; transition = 4–6 s montage on the city map (district jump, year ticking, `intro` caption); load the next district (reuse if same); otopeni → flight cutscene → seatac.
R10.6 Chapter select (menu + map panel) for chapters reached; free drive in any unlocked district; fast travel limited to the current district.
R10.7 Progress UI shows chapters (n/10) and the year; finale after uipath-bel as today.
R10.8 Congestion hotspots per district in `CITIES[city].districts[id].congestion` (see spec 13).

## Acceptance
- All 8 district data files build; each ≤ 3 MB.
- Each district loads in < 4 s (desktop) / < 12 s (software GL).
- Every chapter route 1.5–2.5 km (bellevue: ≤ 3 min drive), routable, no detours via service roads.
- Full story playable in ≈ 20–30 min; logic harness `c`/`f` pass per chapter.
- Visual QA review of each chapter route: 0 defects of severity ≥ medium.

## Owner decisions
- 2026-11-07: Deutsche Bank (2017–2018) was at BOB Tower, Bd. Dimitrie Pompeiu 6A, Pipera (44.4797, 26.1146) → chapter `db` moves to `pipera`. Luxoft confirmed at Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7 (44.4805, 26.1139). Bellevue finale shortened to ≤ 3 min of driving (start near downtown Bellevue; the floating bridge moves into the montage).

- 2026-11-07: free roam = a menu entry opening any district directly (time/weather picker); districts stay separate maps (no merging/streaming).

- 2026-11-07: one game, two modes — Story and Explore over the same world, switchable in place from the pause menu; a shared world-map hub with all districts and tourist spots; Explore has everything unlocked; progress/achievements shared. Explore supersedes the free-roam menu section of R10.10. **Superseded 2026-11-08: one mode (below).**
- 2026-11-08 (owner decision: "we can delete explore"): **one mode.** The chapters are the spine; the world-map hub goes anywhere for everyone (title screen "🌍 World map", the 🌍 HUD button, pause → World map). A jump to another district or a tourist spot leaves the story for free roam (`game.freeRoam`, objective hidden, no chapter cards; `game.explore.active` = roaming); the "📖 Resume story · Chapter N" chip (`#story-chip`) and pause → Resume story bring the objective, nav and cards back where the player left them (`game.explore.resumeStory()`). Gone: the title "🧭 Explore" entry, the pause "Switch to Explore / Story" item, the in-place mode switch. For everyone now: "Here" fast travel in the hub, K (time / weather / season), the drone, tourist spots. explore.js keeps its name / API (`roam`, `resumeStory`; `enterExplore` / `exitExplore` = aliases) so hooks and saves did not churn; saves keep `mode: 'explore'` as the stored key for free roam (old saves restore into free roam).

- 2026-11-07 (round 5, note 43): smaller districts approved as proposed (scratchpad round5/world-data/proposal.md): playable area = 130 m either side of the chapter routes, 200 m round each door, 110 m round each start, 120 m round the CV-stop building; current chapter routes kept (sub-1.5 km allowed but not used); SeaTac option A (Airport Expressway start, terminal / garage / Link station as background scenery); far landmarks may stay as pure background scenery (no marker, label or route).
- 2026-11-07 (round 5, notes 9/18): a landmark is shown / offered only where it is reachable; the others stay visible as `scenery` (no marker / label / route) and live in the tourist spots.
- 2026-11-07 (round 5, note 81): map readability — outside the story area is a calm flat dim (no heavy hatch); the legend is an opaque, compact, collapsible panel whose rows are the category filters (shops and transit off by default); by default the big map shows CV stops, reachable landmarks, spots and fuel with clear labels (shops only as small dots when zoomed in, one transit marker per station, one label size per rank with a halo and no overlaps); the minimap shows the CV stop, the next objective and fuel only.

## Office visits (owner, 2026-11-10)

The owner supersedes the earlier A–D conversation design: E starts/resumes the teacher/professor/manager’s fixed CV sequence; Enter, Space or a single Continue button advances it. Follow-up lines are included in order. Esc or the close button pauses; leaving early does not complete a chapter. The final Continue finishes the visit and advances the story. CV completion uses fully presented sections and preserves the existing stop/topic achievement keys and previous earned progress.
