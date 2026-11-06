# 10 — Chapters in districts

Owner roles: **world** (district data, CHAPTERS, boundaries), **gameplay** (chapter flow, transitions, chapter select).

## Why
Trips between story points were too long; districts keep a good amount of driving but in about 1 km² each, sized by drive time. The 0.7/0.5 scale squeeze also caused overlapping parallel roads.

## Requirements
R10.1 Districts at **real 1:1 scale**, ~**1 km²** each (sized so the chapter route is 1.5–2.5 km ≈ 2–4 min with traffic; the Seattle finale may be longer). Fully covered inside the boundary (all roads, buildings, POIs, trees, furniture), not a corridor.
R10.2 District list (boundaries chosen by world, snapped to quiet streets/parks/river where possible):
| id | city | area | chapters (stop · year) |
|---|---|---|---|
| `floreasca` | bucharest | Calea Floreasca, Barbu Văcărescu, Garibaldi, Floreasca Park | rosetti · 2009, db · 2017 |
| `grozavesti` | bucharest | Grozăvești, Politehnica, Splaiul, Podul Grozăvești | upb · 2013 |
| `unirii` | bucharest | Piața Unirii (fountains), Calea Călărașilor, Hala Traian, Bd. Unirii east | gts · 2015 |
| `pipera` | bucharest | Pipera, Bd. Dimitrie Pompeiu, Novo Park/Hermes | luxoft · 2017 |
| `romana` | bucharest | Piața Romană, Lascăr Catargiu, Vasile Alecsandri, Piața Victoriei | arnia · 2019, uipath-buc · 2020 |
| `otopeni` | bucharest | Henri Coandă terminal + short DN1 approach | otopeni · 2022 (boarding) |
| `seatac` | seattle | SeaTac terminal loop, departures/arrivals, SR-518 to I-5 | seatac · 2022 (waypoint: drive out) |
| `bellevue` | seattle | I-90 floating bridge (scenic approach) → Mercer Island → I-405 → downtown Bellevue (NE 8th, Bellevue Way, Lincoln Square) | uipath-bel · 2022→2025 (stop = UiPath's entrance in Lincoln Square; Plaza Center 2022–2025 shown as a passing landmark with a story caption) |
R10.3 Roads leaving a district end in a visible "end of map / road closed" barrier + soft invisible wall; traffic despawns there; the player can't leave.
R10.4 `CHAPTERS` exported from cities.js in story order with `start` chosen so the route to the stop is 1.5–2.5 km through the district's most characteristic streets/landmarks, on a legal lane.
R10.5 Chapter flow: start at chapter 1; on leaving the office (or reaching a waypoint) → "Chapter complete" card → "Next: <year> · <title>" with Continue / Free drive here; transition = 4–6 s montage on the city map (district jump, year ticking, `intro` caption); load the next district (reuse if same); otopeni → flight cutscene → seatac.
R10.6 Chapter select (menu + map panel) for chapters reached; free drive in any unlocked district; fast travel limited to the current district.
R10.7 Progress UI shows chapters (n/10) and the year; finale after uipath-bel as today.
R10.8 Congestion hotspots per district in `CITIES[city].districts[id].congestion` (see spec 13).

## Acceptance
- [ ] All 8 district JSONs build; each ≤ 3 MB; each loads in < 4 s (desktop) / < 12 s (software GL).
- [ ] Every chapter route 1.5–2.5 km (bellevue ≤ 12 km), routable, no detours via service roads.
- [ ] Full story playable in ≈ 20–30 min; logic harness `c`/`f` pass per chapter.
- [ ] Visual QA review of each chapter route: 0 defects of severity ≥ medium.

## Requests
_(other roles write needed changes here)_
- (world → gameplay, 2026-11-06) Load a chapter with `buildWorld(city, renderer, { district: ch.district, start: ch.start })` (or set `CITIES[city].activeDistrict = ch.district; CITIES[city].activeStart = ch.start` before the existing `loadCity`). `world.spawn` is then the chapter start on a legal lane. `world.district.inside(x, z)` tells whether a point is inside the playable area; `world.district.ends` / `node.mapEnd === true` mark the roads cut at the boundary (red/white barrier + wall): **traffic must despawn vehicles that reach a `mapEnd` node and may spawn new ones entering from `mapEnd` sources** (the SCC treats all map ends as connected through "the rest of the city", so one-way streets that only lead out are still `drivable`). The `seatac` chapter has `stop: null` and a `waypoint {lat, lon, label}`. In `bellevue` a passing POI `plaza-center` (`poi.passing = true`, `poi.caption`, not interactive) sits on the chapter route: show its caption when driving by.

## Progress log
- 2026-11-06 21:50 UTC (world): district mode in `tools/osm/build-data.mjs` (`--districts [--city c] [--district id,…]`): projection anchored at the district centre, scale 1, no compression; area districts (`bbox`/`poly`) keep everything inside, corridor districts (`route` + `circles`, otopeni/seatac/bellevue) keep a buffered drive; roads are cut EXACTLY at the boundary (new end node) → `district.ends`; an inside-mask (20 m RLE) → `district.mask`; the backdrop (low-poly masses) covers 70–1700 m beyond. `cities.js`: `districts` (8, ids per this spec) with `congestion` hotspots, `CHAPTERS` (10). `world.js`: `buildWorld(city, renderer, { district, start })` (also `city.activeDistrict` / `city.activeStart` so main.js's `loadCity` can pick one without a signature change), only the district's stops/landmarks, Seattle landmark models scaled ×(1/SEA_SCALE) at 1:1, red/white "road closed" barrier + wall (`kind:'end'`, `node.mapEnd = true`, `world.district.ends`) at every cut road, invisible `kind:'boundary'` walls along the mask outline, `world.district = {id, …cfg, areaKm2, ends, inside(x,z)}`, `world.bounds` = mask extent. Legacy `buildWorld(city, renderer)` still loads `game/data/<city>.json`.
