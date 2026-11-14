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
drive to UiPath's office at Lincoln Square in **Bellevue**. Each office is a walkable interior where someone from
that chapter tells its part of the CV.

## What's in it
- **Story: 10 chapters in 8 real districts.** Floreasca, Grozăvești, Unirii, Pipera, Romană & Victoriei, Otopeni,
  SeaTac and downtown Bellevue, each rebuilt at 1:1 scale from OpenStreetMap, with the chapter starting a 2–3 minute
  drive from the office. Map montages and the flight connect them. Roads leaving the playable area end at a roadworks
  closure ("DRUM ÎNCHIS" / "ROAD CLOSED") that names the chapter where that road opens.
- **Office visits.** A teacher, professor or manager tells the chapter in order: `E` starts or resumes, `Enter` /
  `Space` / Continue advances, `Esc` pauses; only the final Continue completes the chapter. Some rooms show the live
  district (same clock, weather and traffic) through their windows; floors and window bearings are estimates.
- **World map and free roam.** The 🌍 hub (title screen, HUD, pause menu) has București / Seattle / Bellevue / World
  tabs, a globe with the real Otopeni → Sea-Tac route and a "Here" tab. Selecting a place marks it and sets a route;
  hold `F` for 1.2 s or choose **Fast travel** to move. Going to another district or a tourist spot leaves the story
  for free roam; the **📖 Resume story** chip brings the objective back.
- **Time, weather and season, live.** `K`, the ☀️ panel or Settings → Time, weather & season; **Live** follows the
  local clock. The choices follow travel and Continue.
- **On foot and photo mode.** Get out anywhere, walk / run / jump, enter offices on foot, find or call your car. Take
  pictures with filters; they stay in the in-game gallery until you save or share them. Park illegally and you get
  reactions, a ticket, a clamp or the tow truck.
- **Drone.** On foot, `G` deploys a drone with its own HUD, Cine / Normal / Sport speeds, EU / FAA limits (120 m /
  400 ft, ~800 m range, 10-minute battery with return-home) and photo mode; it stays within the playable area plus
  150 m. Hidden interactions include a football on the Dinamo pitch (score with the drone for a secret achievement)
  and, on foot, a basketball you can throw at Rosetti's court.
- **Tourist spots.** Seven visits: Old Town, Cișmigiu and Arcul de Triumf (Bucharest); Pike Place and the Space
  Needle–Chihuly visit (Seattle); Meydenbauer and Downtown Park (Bellevue). Each has chatting crowds (Romanian lines
  with English underneath), info plaques, a spot map with waypoints, a short guided tour (at most three stops /
  300 m, `J` skips a step), a postcard challenge and activities, for example: the Freddo club dance, coffee,
  papanași, a busker, a photo walk and karaoke in Old Town (each at a real place, only while it is open); table
  (Romanian backgammon) against a park regular, rowing and bike rental in Cișmigiu; an island race and a baguette
  catch at the Arc; the Space Needle elevator and catching a fish at Pike Place. Activities need participation;
  pausing or leaving cancels them. The older 24-spot catalogue stays in saves; retired visits do not count.
- **A living city.** Country-specific traffic (taxis, vans, police; STB trams, trolleybuses and buses; King County
  Metro) on real lanes, one-ways, turn lanes, signals and speed limits; density by hour and rush-hour standstills at
  real hotspots (Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, I-405); trams on their mapped rails and stops;
  honking and NPC dialogue (Romanian lines with an English gloss, gated by place, time and weather); pedestrians
  dressed for the season; fuel at the stations mapped in OSM; speed / red-light cameras; turn-by-turn navigation on the
  car's screen. The car collides with its whole body.
- **Real light and weather.** Sun and moon from each place's position and local time, street lights, headlights, lit
  windows at night, live weather (Open-Meteo, 1991–2020 climate fallback) with rain, snow and fog, and seasons
  (autumn colours, bare winter trees, the Unirii fountains drained in winter).
- **Landmarks and buildings.** 74 hand-modelled landmarks (every CV-stop building plus Hala Traian, the Parliament,
  Victoria Palace, Sky Tower, Stadionul Dinamo, the SeaTac garage and tower, …). Every other building comes from OSM
  footprints with researched heights, roofs, colours and styles; about 600 non-residential buildings have their real
  type, shops carry their researched brands at their addresses, trees are species-specific. Each district has
  real buildings and streets in a 600 m ring past the playable edge. Every district and tourist scene has been checked
  against OSM and, where a panorama exists, compared by eye with Street View; what is still estimated or wrong is in
  [`handoffs/fidelity/BACKLOG.md`](handoffs/fidelity/BACKLOG.md) and the district dossiers in `game/research/`.
- **Saves, achievements, completion %.** Progress, position and photos persist in IndexedDB; **Continue** resumes
  where you left off. 129 achievements (story, exploration, driving, local colour, activities, photography, walking,
  secrets); only those for available destinations and current activities count toward the weighted completion %.
- **Performance.** Adaptive quality tiers, instancing and culling keep every district and tourist frame within
  1.5 M triangles / 400 draw calls, including traffic and the mirror. The instrument cluster and nav screen stay sharp
  at every tier.
- **Bug inspection.** `?inspect=1` shows live lat/lon and local coordinates, copies a report with `F8` and lifts the
  drone's range, altitude and battery limits.

## Controls
| | Keyboard / mouse | Touch |
|---|---|---|
| Drive | `W`/`S` throttle & reverse · `A`/`D` steer · `Space` brake · `H` horn | steering wheel (left thumb), analog pedals, horn |
| Look | click the view and move the mouse (`Esc` frees the cursor) · `C` look back | drag the right half |
| Car | `L` headlights · `E` enter office / refuel · `R` reset to the road · `F` fast travel · `U` U-turn at a closure | buttons |
| Map | `M` map & navigation (click to drop a waypoint; in free roam: the world map) · `N` mini-map · 🌍 world map | 🧭 🌍 |
| On foot | `Enter` get out / back in · `W`/`A`/`S`/`D` walk · `Shift` run · `Space` jump · `T` call the car | 🚶 + thumbstick |
| Drone | `G` deploy / land · mouse look + `WASD` fly (W/S follow pitch, A/D strafe) · `1` `2` `3` speed · `T` go here · `H` home | 🚁 + stick |
| Spots | `E` read / interact · `G` spot map · `J` skip a tour step | buttons |
| Camera | `P` photo mode | 📷 |
| World | `K` time / weather / season panel · `Esc` pause → World map, Resume story (in free roam), Chapters, Tourist spots | ☀️ 📖 |

## Run it locally
```bash
python3 -m http.server 8123
```
Then open <http://localhost:8123/> (landing page) or <http://localhost:8123/game/> (game). URL switches for testing:
`?hour=8.5` (traffic hour), `?jam=1`, `?weather=<kind>`, `?season=winter`, `?fountains=on|off|show`, `?inspect=1`.
Developer pages: `game/dev/spots.html?id=<spot>`, `game/dev/landmarks.html`, `game/dev/render.html`,
`game/dev/crowd.html`.

## Tests and QA
- `node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` — unit and regression tests.
- `node --input-type=module --check < game/src/<file>.js` — syntax check of an edited module.
- `npm run harness` — logic harness (Playwright + software GL): drives the chapters, on foot, rush hour and the
  finale, and checks placement, routing, overlaps and page errors. `npm run harness:audit` runs the static road audit
  only. Usage and scenarios: [`game/dev/harness/README.md`](game/dev/harness/README.md).
- `npm run harness:visual` — visual QA: route surveys, defect detectors, contact sheets and a review report
  ([`game/dev/harness/visual/README.md`](game/dev/harness/visual/README.md)); `npm run harness:spots` does the same for
  every tourist spot.
- Standalone checks in `game/dev/harness/` (`*-check.cjs` / `*-check.mjs`, e.g. `conditions-check.cjs`,
  `football-check.mjs`, `drone-flight-check.cjs`, `map-waypoints-check.cjs`, `office-touch-check.cjs`,
  `tram-sweep-audit.cjs`, `bridge-bents-check.cjs`) document their arguments in their header.
- Reality checks: `node game/dev/harness/viewpoints.js --district=<id> --walk --streetview` puts game frames next to
  Street View along every street; `--topdown=250 --mosaic=<dir>` compares the district from above with aerial imagery.
  The district data pipeline is in [`tools/osm/README.md`](tools/osm/README.md) and
  [`tools/aerial/README.md`](tools/aerial/README.md).

Requirements, architecture and the definition of done are in [`specs/`](specs/); open work is in
[`handoffs/fidelity/BACKLOG.md`](handoffs/fidelity/BACKLOG.md).

## Publishing
GitHub Pages serves `master`. Before deploying runtime changes, commit them, run
`node tools/telemetry/stamp-release.mjs --write` (or `--source=<commit>` for a commit with identical runtime bytes),
commit the release metadata and verify with the same command without `--write`. Large internal evidence folders stay
in Git but are excluded from the deploy in `_config.yml`.

## Data, credits and privacy
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), built offline by
  `tools/osm/` into `game/data/<city>-<district>.bin.gz` (lossless binary packs, ≤ 3 MiB each;
  `node tools/osm/pack-district.mjs --unpack FILE` gives the JSON back; format in
  [`game/data/README.md`](game/data/README.md)). Later OSM additions are appended by `tools/osm/add-pois.mjs`.
- Ground levels under the Bellevue Link guideway and Victor Steinbrueck Park: USGS 3DEP 1 m elevation (public domain).
- Aerial roof, tree-crown and vegetation measurements: Esri World Imagery (Esri, Maxar, Earthstar Geographics and the
  GIS User Community). Only measurements are stored in the game. Google Street View is used only for visual comparison,
  never as a source of game data or committed imagery.
- Weather by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Coastlines and borders on the globe from
  [Natural Earth](https://www.naturalearthdata.com/) (public domain); night-side city lights from NASA Earth
  Observatory's Black Marble 2016 (public domain).
- Artworks are modelled in 3-D from public descriptions and credited in-game (e.g. the Fremont Troll by Steve Badanes,
  Will Martin, Donna Walter and Ross Whitehead; glass by Dale Chihuly). Buildings are modelled without photo textures.
  Research reference photos stay out of the repository, except eight Wikimedia Commons photos in
  `game/research/refs/unirii/`; every reference photo's source and licence is in
  [`game/research/refs/LICENSES.md`](game/research/refs/LICENSES.md).
- Analytics: cookieless PostHog (EU), production only, respects Do Not Track / Global Privacy Control. Health
  diagnostics cover loads, renderer stalls and recoveries; a 15-minute per-tab breadcrumb carries fixed place/action
  IDs only, no visitor identity or precise position. Dashboards: [`tools/telemetry/README.md`](tools/telemetry/README.md).

## Technical overview
[The game overview](https://cristiancalina.com/game/overview/) documents the architecture, simulation, controls and the
spec-driven AI workflow, with game-versus-reality comparisons for every district, landmark and tourist destination.
