# About
This is my Resume (CV) website.

I wanted to create something responsive & animated, and to challenge myself with some CSS.

It is done in vanilla JS, HTML & CSS.

I used media queries to make it fully responsive (alongside with flexbox)

# Live Demo

You can find the live version [here](https://cristiancalina.com)

# 🎮 Drive My CV — the interactive résumé game

The landing page keeps the classic CV; an opt-in **🎮 Play my CV** button lazy-loads `game/`, a first-person 3D
game (Three.js r170, vanilla ES modules, no build step) that tells my career as a drive: from high school in
Bucharest (2009) through Politehnica and every office I worked in, a flight from Otopeni to Seattle, and the last
drive to UiPath's office at Lincoln Square in **Bellevue**. Each office is a walkable interior whose screens hold
that chapter of the CV.

## What's in it
- **Story — 10 chapters in real places.** Each chapter is played in a compact district rebuilt at **real 1:1 scale**
  from OpenStreetMap (Floreasca, Grozăvești, Unirii, Pipera, Romană & Victoriei, Otopeni, SeaTac, downtown Bellevue),
  starting on a real street a 2–3 minute drive from the office. Map montages connect the districts; leaving the
  playable area hits a GTA-style roadworks closure ("DRUM ÎNCHIS" in Bucharest, "ROAD CLOSED" in Washington) that
  hints at the chapter where that road opens: a barrier with warning lamps, and behind it a work site with a trench cut
  in the asphalt, its spoil heap, kerbstones on a pallet and an orange safety mesh (a mini excavator digs at some).
- **One mode: the story, and the world map to go anywhere.** The chapters are the spine. The **World map** hub (🌍,
  pause menu, or "World map" on the title screen) has București / Seattle / Bellevue / World tabs, a high-detail globe
  with the real Otopeni → Sea-Tac great-circle route, and a "Here" tab to mark a destination and set a navigation route.
  Selecting a map pin or search result keeps you in place; hold `F` for 1.2 seconds or choose **Fast travel** to move.
  Remote marks retain the destination without drawing a local route across unloaded areas. Travelling to
  another district or a tourist spot leaves the story for free roam (no objective); a **📖 Resume story · Chapter N**
  chip brings the objective, navigation and chapter cards back where you left them. Change the **time of day, weather
  and season live** with `K`, the ☀️ conditions panel, or **Settings → Time, weather & season** from the title or pause menu.
  Choose **Live** time to return to the city's current local clock. Selected conditions
  follow district and story travel, changes of city and Continue (also on phones).
- **Drone.** On foot (districts and spots), G deploys a drone with its own camera HUD, rotor sound, Cine / Normal / Sport
  speeds, real EU / FAA limits (120 m / 400 ft ceiling, ~800 m range, 10-minute battery with return-home) and photo mode;
  T flies you to the spot under it, G lands it back in your hand. There are hidden interactions to discover with it,
  including a kickable football on the Dinamo pitch that rewards a drone-assisted goal with a secret achievement.
  The open stadium bowl is traversable; physical stands and roofs retain collision. The size-5 ball uses amber/black
  panels in snow and a small contact shadow.
  Mouse/touch look sets the flight direction: W/S follow the full viewing pitch and A/D strafe. There are no separate
  up/down keys or touch pads. Flight starts level and stays within the playable boundary plus a 150 m margin, including
  the whole Dinamo stadium. Swept movement preserves thin roof/wall collisions; return-home follows the same boundary.
  The pilot marker uses the same seasonal character system as pedestrians.
  At Rosetti’s existing basketball court, pick up the ball, aim along its predicted dotted arc and throw. A real basket
  unlocks a secret achievement; desktop and mobile actions are supported. Pause, map, camera, drone or leaving cancels the aim.
- **Tourist spots (bonus).** 24 walk-only destinations across 19 scenes (each is listed in the menu once it passes a side-by-side
  review against the real place) — Bucharest's top 10 (Palace of the Parliament, People's
  Salvation Cathedral, Old Town & Cărturești Carusel, Stavropoleos & CEC, the Athenaeum, Arcul de Triumf, Herăstrău,
  the Village Museum, the Spring Palace, Cișmigiu), Seattle's top 10 (Pike Place, the Space Needle, Chihuly Garden and
  Glass, MoPOP, the Fremont Troll, Kerry Park, the waterfront, Pioneer Square, the Ballard Locks, Gas Works Park) and
  4 in Bellevue. Each has crowds chatting in culture-researched lines (Romanian with English underneath), info plaques,
  a spot map with objectives, an optional short guided tour, a postcard photo challenge and activities — ride the Space
  Needle elevator to the revolving Loupe, catch a fish at Pike Place, row in Cișmigiu, frame the Arc de Triumf memorial,
  rent a bike in Herăstrău, and more. Short tours select an available activity first and use at most three stops / 180 m
  of walkable route, with **Skip** and **End tour** controls. Activities and postcards require participation; narration
  alone never completes them. Seasonal Cișmigiu rowing starts at the mapped Debarcader: use the visible oars to propel
  the boat along a short return course. Idle time grants no progress. Pause, map, photo mode, drone launch or leaving
  cancels an unfinished activity and restores the walker safely to shore. Explicit local time, weather and season choices also follow travel into tourist scenes; K and Pause → Settings open their conditions panel. A hidden sports room reached through Carusel retains the World Cup Predictions Easter egg;
  a second TV shows an actual Dinamo drone goal as a hint. The real Starbucks street frontage stays in place.
  Exterior camera challenges at the Athenaeum, Spring Palace, Parliament, Arc and Lincoln Square require aiming and taking three pictures. They preserve public access; museum and office interiors are not implied. The cathedral has a virtual handheld candle practice on its mapped forecourt. Stable activity IDs preserve existing saves.
  Reused landmark collisions preserve their exact polygons, courtyard holes and raised volume bands in tourist scenes.
  Narrow desktop windows keep the keyboard-help footer above the lower HUD; touch screens use their dedicated action buttons.
  Source-backed tourist activities can declare a narrow drone launch/approach area outside their original scene focus. The same 150 m flight margin applies; this does not open an entire park or lake.
  Disposing a tourist water material removes it from shared environment updates, so later travel does not retain retired water materials.
  The overview includes separate shareable evidence views for every landmark and tourist destination, with game captures, source links and explicit remaining estimates.
  District galleries retain dated historical collections separately from current surveys. Game-only street, weather and drone context has its own gallery and exact camera metadata; only square north-up surveys are paired with aerial imagery. Available collections load inline, and official aerial images keep their original 15-minute browser cache expiry across reloads.
- **Offices you can talk in.** Each CV stop is a distinct interior (a 2009 classroom, the Politehnica rectorate,
  turnstile lobbies, the UiPath robot floor…) with a teacher, professor or manager who answers A–D questions about that
  chapter of the CV.
  Hidden title-menu controls cannot intercept conversation taps on phones.
- **On foot and photo mode.** Get out of the car anywhere, walk/run/jump, enter offices on foot, find your car again
  (distance chip, walking route, call it to the kerb); pull out a camera and frame a shot with filters — it is
  kept in the in-game gallery, and you save (or share) only the ones you want, from the print or the gallery. Leave the
  car somewhere illegal and passers-by react — then the ticket, the clamp or the tow truck.
- **Saves.** Progress, position and photos persist in IndexedDB; **Continue** resumes exactly where you left off.
- **Achievements and completion %.** 116 catalogue entries (115 initially active; the cycling activity becomes active after bike use), covering story, explorer, driver, local colour, landmarks and activities,
  photographer, on foot and a few secrets) and one weighted completion score shown in the menu, map and pause screens.
- **A living city.** Country-specific traffic (taxis, delivery vans, police; STB trams, trolleybuses and buses; King
  County Metro buses) driven by real lanes, one-ways, signals and speed limits, with traffic density by hour, rush-hour
  standstills at real hotspots (Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, I-405), honking and angry chat
  bubbles in Bucharest, pedestrians dressed for the season and weather (their umbrellas, guitars and bags take up room:
  people pass each other and you, on foot, round them; a car knocks them over and they get up and walk back), fuel and
  the gas stations mapped in OpenStreetMap (driving and fast travel in a district without one burn no fuel; no invented
  stations), mapped speed/red-light cameras, turn-by-turn navigation on the car's screen and fast travel. The car collides with its whole visible body
  (bonnet to boot).
- **Real light and weather.** Sun and moon from each place's real position and local time, street lights,
  headlights, lit windows and shops at night, live weather (Open-Meteo, with a 1991–2020 climate fallback) with rain,
  snow and fog, weather-driven visibility (snow settles on streets, roofs, lawns, sports grounds and the landmarks
  alike — pitches and courts get a dusting their lines still show through), and seasons (autumn colours, bare winter
  trees, the Unirii fountains drained in winter).
- **Landmarks and buildings.** 61 hand-modelled landmarks (e.g. every CV-stop building — the GTS house on Calea
  Călărașilor, Liceul C.A. Rosetti with its sports hall, sports ground and fenced yard, the Politehnica rectorate, Hermes Business Campus, BOB Tower, Europe House, The
  Landmark, Lincoln Square — plus Hala Traian, the Parliament, Victoria Palace, Sky Tower, Stadionul Dinamo with its
  track, terraces, covered main stand and floodlight masts, the SeaTac garage and tower);
  every other building comes from OSM footprints with researched heights, facade colours and styles by era. ~600
  researched non-residential buildings get their real type (curtain-wall offices, malls, supermarkets, hotels, parking
  garages, schools, warehouses), fuel stations keep their sourced locations with canopy decoration only where it fits,
  shops carry their researched brands at their
  addresses, and street trees are species-specific. The Dâmbovița runs in its concrete channel.
- **Floreasca, rebuilt street by street against reality.** Every real building footprint in the playable area and in a
  600 m ring around it (real streets too — no empty belt or lonely boxes past the closures); roof shapes and colours,
  tree crowns and gardens measured on aerial imagery; villas vs 1950s–60s blocks decided from those measurements; raised
  sidewalks at kerb height with corner pieces at every junction and a gentle slope down to the gardens behind; lane lines
  that run straight where OSM changes a street's lane count; a railing, wall-with-railing or hedge per villa plot and open
  or low-railed lawns in front of the blocks; parking follows the mapped side, location and orientation, with full car
  footprints checked against raised sidewalks and parking-lot boundaries; front-garden railings, walls and hedges, kerb bollards, street lamps;
  every pitch, tennis court, pool and school yard with its markings, goals, nets and fences (football pitches with mowing
  stripes, real goals with sloping nets, corner flags, dugouts with bucket seats on the clear side of the pitch, and
  ball-stop fences; a sports ground mapped as one big pitch round smaller ones stays plain); the Piața Floreasca market
  hall; Liceul Rosetti's gym, sports hall and sports ground with its basketball hoops; only real shops and signs.
- **Romană & Victoriei reality pass.** Sourced buildings and streets continue through a 600 m scenery ring, with aerial
  roof, tree-crown and green-ground measurements, mapped courtyard openings, and parking-side/orientation metadata.
  Fully covering OSM building parts render once while their outline records remain available for source audits.
  Mapped partial assemblies and neighbouring building surfaces share baked, validated geometry to remove coincident
  walls without deleting source buildings; concave roof surfaces stay closed. Tagged roof profiles still have modelling gaps.
  Civic buildings keep their identity, apartment blocks retain their upper floors, and the Louis Blanc office uses its
  published eight above-ground storeys. The full district has local Street View and aerial comparison reports. Complex
  roofs, detailed historic facades, canopy shape and covered footbridges still need further modelling.
- **Performance.** Adaptive quality tiers, instanced traffic/crowds/parked cars and view-range culling target at most
  1.5 million triangles / 400 draw calls per district frame including traffic and the mirror. The overview records
  measured checks and remaining limits; software-rendered test timing is not phone performance.

## Controls
| | Keyboard / mouse | Touch |
|---|---|---|
| Drive | `W`/`S` throttle & reverse · `A`/`D` steer · `Space` brake · `H` horn | steering wheel (left thumb), analog pedals, horn |
| Look | click the view and move the mouse (`Esc` frees the cursor) · `C` look back | drag the right half |
| Car | `L` headlights · `E` enter office / refuel · `R` reset to the road · `F` fast travel · `U` U-turn at a closure | buttons |
| Map | `M` map & navigation (click to drop a waypoint; in free roam: the world map) · `N` mini-map · 🌍 world map | 🧭 🌍 |
| On foot | `Enter` get out / back in · `W`/`A`/`S`/`D` walk · `Shift` run · `Space` jump · `T` call the car | 🚶 + thumbstick |
| Drone | `G` deploy / land · mouse look + `WASD` fly (W/S follow pitch, A/D strafe) · `1` `2` `3` speed · `T` go here · `H` home | 🚁 + stick |
| Spots | `E` read / interact · `G` spot map | buttons |
| Camera | `P` photo mode | 📷 |
| World | `K` time / weather / season panel · `Esc` pause → World map, Resume story (in free roam), Chapters, Tourist spots | ☀️ 📖 |

## Run it locally
```bash
python3 -m http.server 8123
```
Then open <http://localhost:8123/> (landing page) or <http://localhost:8123/game/> (game). Useful URL switches for
testing: `?hour=8.5` (traffic hour), `?jam=1`, `?season=winter`, `?fountains=on`.

Developer pages: `game/dev/spots.html?id=<spot>`, `game/dev/landmarks.html`, `game/dev/render.html`.

## Tests and QA
- `npm run harness` — logic harness (Playwright + software GL): drives every chapter, free roam, on foot, the tourist
  spots, rush hour and the finale; checks placement, routing, overlaps, timings and page errors.
- `npm run harness:spots` — loads every tourist spot, walks from the spawn and runs the spot audit (z-fighting,
  invisible walls, people inside props, lamps on roads…).
- `npm run harness:visual` — visual QA: route surveys from the driver's seat, defect detectors, contact sheets and a
  review report (`game/dev/harness/visual/README.md`).
- `node game/dev/harness/football-check.mjs` — deterministic drone-football checks (contact, both goals, post/crossbar
  rebounds, resets and invalid approaches).
- `node game/dev/harness/courtyard-check.mjs` — mapped courtyard openings and inner/outer wall collision checks.
- `node game/dev/harness/conditions-check.cjs` — Settings, conditions across travel/Continue, and mirror/headlight controls
  (`game/dev/harness/conditions-check.md`).
- `node game/dev/harness/office-touch-check.cjs` — native phone taps across every office's dialogue, including closing
  Achievements first; detects invisible menu controls intercepting answer buttons.
- `node game/dev/harness/drone-boundary-check.cjs` and `drone-flight-check.cjs` — buffered flight limits and actual-controller returns.
- `node game/dev/harness/map-waypoints-check.cjs` — map marking, held-F travel, fuel checks, and desktop/touch interactions.
- `node game/dev/signals.test.mjs` — conflicting approaches, junction clearance and pedestrian recovery regression checks.
- `node tools/tourist-tour-check.mjs` — walkable short tours, real participation, pause/skip/end and shared-scene entrances.
- District reality passes combine OSM footprints with aerial roof/canopy/green-ground measurements and local-only
  game-versus-imagery comparisons. See `tools/aerial/README.md` and `tools/osm/README.md`; OSM tile downloads accept
  `--bbox minlat,minlon,maxlat,maxlon` to limit a pass to the district and its scenery ring. Romană & Victoriei has been
  reviewed across 1,144 official Street View pairs and 195 aerial tiles; local evidence and remaining fidelity limits
  are recorded in `specs/12-buildings-streetscape.md` and `specs/19-qa-harness.md`.
  The [game overview](https://cristiancalina.com/game/overview/) documents the spec-driven AI workflow, architecture,
  generation, simulation, controls and fidelity coverage. Its embedded viewer includes 199 Romană, 90 Floreasca and 99 Grozăvești
  game captures beside live Esri World Imagery, grouped by playable district, nearby scenery and distant context.
  Capture commits and imagery limits are labelled; live aerials are cached in the browser for 15 minutes across reloads.
  The former separate comparison page is removed without a redirect.
  Street-walk comparisons use official Google panoramas by default (`--pano-provider=any` permits public uploads);
  unambiguous mapped underpass/bridge grades determine the comparison camera's height. Overlapping road levels are
  flagged in `camera-poses.json` for review because panorama metadata does not identify altitude.
- `node game/dev/harness/viewpoints.js --district=<id> --walk --streetview` — reality check: walks every drivable street of
  a district (both sidewalks) and puts each game frame next to Google Street View from the same spot; `--topdown=250
  --mosaic=<path>` compares the whole district from above with aerial imagery, `--weather=snow|rain|fog` renders any pose
  in that weather (dev only; nothing from Street View goes into the game).
- `tools/aerial/` (roof survey, tree crowns, green ground from an aerial mosaic) and `tools/osm/building-audit.py`
  (every OSM footprint matched, heights and roofs checked) — the district reality-pass pipeline (`tools/aerial/README.md`).
  Its game-only grid planner/capture/validator can archive a published commit, cover the exact playable mask plus 600 m
  source scenery ring, and record each square frame's source SHA, pose, capture time, image hash and render counts.
  District builds retain source buildings throughout the playable boundary, including campus buildings beyond the
  drivable-road buffer; only legacy corridor builds apply the extra road-distance filter.

The work is planned spec-first in [`specs/`](specs/) (requirements, contracts, ownership and a status board).

## Data, credits and privacy
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL); built offline by
  `tools/osm/` into `game/data/*.json`.
- Aerial roof, tree-crown and vegetation measurements: Esri World Imagery (Esri, Maxar, Earthstar Geographics and the GIS
  User Community). Only measurements are stored in the game; reference imagery stays in local research output. Google
  Street View is used only for visual comparison, never as a source for game data or committed imagery.
- Weather by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Coastlines and borders on the globe from
  [Natural Earth](https://www.naturalearthdata.com/) 1:50m (public domain); night-side city lights from NASA Earth
  Observatory's Black Marble 2016 (public domain).
- Artworks are modelled in 3-D from public descriptions and credited in-game (e.g. the Fremont Troll by Steve Badanes,
  Will Martin, Donna Walter and Ross Whitehead; glass by Dale Chihuly). Romanian buildings are modelled without photo
  textures; research reference photos are not part of the repository.
- Analytics: cookieless PostHog (EU), production only, respects Do Not Track / Global Privacy Control. Bounded health
  diagnostics identify load attempts, renderer stalls/resources and recoveries. A 15-minute per-tab sessionStorage
  breadcrumb can survive reload; it carries fixed place/action IDs, not a persistent visitor identity or precise position.
  Interrupted loads are labelled as possible interruptions, not confirmed operating-system crashes.
  Before a master deployment, commit runtime changes, run `node tools/telemetry/stamp-release.mjs --write`, commit its
  release metadata, and verify with the same command without `--write`. Diagnostics then include the runtime fingerprint.
  Dashboard definitions and reproducible validation live in [tools/telemetry](tools/telemetry/README.md). Seven health tables
  distinguish requests, build/first-frame outcomes, frame tails, resources, first headlight responses, recovery and activities.
