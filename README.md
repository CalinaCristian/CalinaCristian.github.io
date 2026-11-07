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
  hints at the chapter where that road opens.
- **One game, two modes: Story and Explore.** Switch in place from the pause menu at any time. Explore unlocks every
  district and tourist spot with no objectives; the **World map** hub (M) has București / Seattle / Bellevue / World tabs,
  a high-detail globe with the real Otopeni → Sea-Tac great-circle route, and a "Here" tab to fast-travel by clicking a
  street. Change the **time of day, weather and season live** from the ☀️ conditions panel (also on phones).
- **Drone.** On foot (districts and spots), G deploys a drone with its own camera HUD, rotor sound, Cine / Normal / Sport
  speeds, real EU / FAA limits (120 m / 400 ft ceiling, ~800 m range, 10-minute battery with return-home) and photo mode;
  T flies you to the spot under it, G lands it back in your hand.
- **Tourist spots (bonus).** 24 small walk-only scenes (each is listed in the menu once it passes a side-by-side
  review against the real place) — Bucharest's top 10 (Palace of the Parliament, People's
  Salvation Cathedral, Old Town & Cărturești Carusel, Stavropoleos & CEC, the Athenaeum, Arcul de Triumf, Herăstrău,
  the Village Museum, the Spring Palace, Cișmigiu), Seattle's top 10 (Pike Place, the Space Needle, Chihuly Garden and
  Glass, MoPOP, the Fremont Troll, Kerry Park, the waterfront, Pioneer Square, the Ballard Locks, Gas Works Park) and
  4 in Bellevue. Each has crowds chatting in culture-researched lines (Romanian with English underneath), info plaques,
  a spot map with objectives, an optional guided tour, a postcard photo challenge and real activities — ride the Space
  Needle elevator to the revolving Loupe, catch a fish at Pike Place, row in Cișmigiu, climb the Arc de Triumf terrace,
  rent a bike in Herăstrău, and more. Somewhere on Lipscani there is a football bar with a hidden project.
- **Offices you can talk in.** Each CV stop is a distinct interior (a 2009 classroom, the Politehnica rectorate,
  turnstile lobbies, the UiPath robot floor…) with a teacher, professor or manager who answers A–D questions about that
  chapter of the CV.
- **On foot and photo mode.** Get out of the car anywhere, walk/run/jump, enter offices on foot, find your car again
  (distance chip, walking route, key fob, call it to the kerb); pull out a camera, frame a shot with filters, save it to
  your device and keep it in the in-game gallery. Leave the car somewhere illegal and passers-by react — then the
  ticket, the clamp or the tow truck.
- **Saves.** Progress, position and photos persist in IndexedDB; **Continue** resumes exactly where you left off.
- **Achievements and completion %.** 112 achievements (story, explorer, driver, local colour, landmarks and activities,
  photographer, on foot and a few secrets) and one weighted completion score shown in the menu, map and pause screens.
- **A living city.** Country-specific traffic (taxis, delivery vans, police; STB trams, trolleybuses and buses; King
  County Metro buses) driven by real lanes, one-ways, signals and speed limits, with traffic density by hour, rush-hour
  standstills at real hotspots (Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu, I-405), honking and angry chat
  bubbles in Bucharest, pedestrians dressed for the season and weather, fuel and real gas stations, speed cameras,
  turn-by-turn navigation on the car's screen and fast travel.
- **Real light and weather.** Sun and moon from each place's real position and local time, street lights,
  headlights, lit windows and shops at night, live weather (Open-Meteo, with a 1991–2020 climate fallback) with rain,
  snow and fog, weather-driven visibility, and seasons (autumn colours, bare winter trees, the Unirii fountains drained
  in winter).
- **Landmarks and buildings.** 60 hand-modelled landmarks (e.g. every CV-stop building — the GTS house on Calea
  Călărașilor, Liceul C.A. Rosetti, the Politehnica rectorate, Hermes Business Campus, BOB Tower, Europe House, The
  Landmark, Lincoln Square — plus Hala Traian, the Parliament, Victoria Palace, Sky Tower, the SeaTac garage and tower);
  every other building comes from OSM footprints with researched heights, facade colours and styles by era. ~600
  researched non-residential buildings get their real type (curtain-wall offices, malls, supermarkets, hotels, parking
  garages, schools, warehouses), fuel stations get full forecourts, shops carry their real brands at their real
  addresses, and street trees are species-specific. The Dâmbovița runs in its concrete channel.
- **Performance.** Adaptive quality tiers, instanced traffic/crowds/parked cars, view-range culling and a draw-call
  budget per district, so it stays smooth on laptops and phones.

## Controls
| | Keyboard / mouse | Touch |
|---|---|---|
| Drive | `W`/`S` throttle & reverse · `A`/`D` steer · `Space` brake · `H` horn | steering wheel (left thumb), analog pedals, horn |
| Look | click the view and move the mouse (`Esc` frees the cursor) · `C` look back | drag the right half |
| Car | `L` headlights · `E` enter office / refuel · `R` reset to the road · `F` fast travel · `U` U-turn at a closure | buttons |
| Map | `M` map & navigation (click to drop a waypoint; in Explore: world map) · `N` mini-map | 🧭 |
| On foot | `Enter` get out / back in · `W`/`A`/`S`/`D` walk · `Shift` run · `Space` jump · `L` key fob · `T` call the car | 🚶 + thumbstick |
| Drone | `G` deploy / land · `WASD` fly · `Space`/`E` up · `Q`/`C` down · `1` `2` `3` speed · `T` go here · `H` home | 🚁 + stick |
| Spots | `E` read / interact · `G` spot map | buttons |
| Camera | `P` photo mode | 📷 |
| Explore | `K` time / weather / season panel · `Esc` pause → Switch to Story / Explore | ☀️ |

## Run it locally
```bash
python3 -m http.server 8123
```
Then open <http://localhost:8123/> (landing page) or <http://localhost:8123/game/> (game). Useful URL switches for
testing: `?hour=8.5` (traffic hour), `?jam=1`, `?season=winter`, `?fountains=on`.

Developer pages: `game/dev/spots.html?id=<spot>`, `game/dev/landmarks.html`, `game/dev/render.html`.

## Tests and QA
- `npm run harness` — logic harness (Playwright + software GL): drives every chapter, Explore, on foot, the tourist
  spots, rush hour and the finale; checks placement, routing, overlaps, timings and page errors.
- `npm run harness:spots` — loads every tourist spot, walks from the spawn and runs the spot audit (z-fighting,
  invisible walls, people inside props, lamps on roads…).
- `npm run harness:visual` — visual QA: route surveys from the driver's seat, defect detectors, contact sheets and a
  review report (`game/dev/harness/visual/README.md`).

The work is planned spec-first in [`specs/`](specs/) (requirements, contracts, ownership and a status board).

## Data, credits and privacy
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL); built offline by
  `tools/osm/` into `game/data/*.json`.
- Weather by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Coastlines and borders on the globe from
  [Natural Earth](https://www.naturalearthdata.com/) 1:50m (public domain); night-side city lights from NASA Earth
  Observatory's Black Marble 2016 (public domain).
- Artworks are modelled in 3-D from public descriptions and credited in-game (e.g. the Fremont Troll by Steve Badanes,
  Will Martin, Donna Walter and Ross Whitehead; glass by Dale Chihuly). Romanian buildings are modelled without photo
  textures; research reference photos are not part of the repository.
- Analytics: cookieless PostHog (EU), production only, respects Do Not Track / Global Privacy Control.
