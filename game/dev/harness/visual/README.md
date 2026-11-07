# Drive My CV — visual QA

The logic harness (`../README.md`) checks *logic* (routes blocked, overlaps, heights). This one checks what a
**human sees**: it drives the camera along every story route, renders what the driver would see, makes contact
sheets, and runs detectors on the geometry, the pixels, the cockpit and the HUD. Then a person (or the QA agent)
looks at every sheet and writes `report/review.md`.

It never edits the game. It loads `game/index.html` in headless Chromium (software GL), injects
`page/visual.js` on top of `window.game`, takes over the render loop and renders only on request.

## Run

```sh
npm run harness:visual                                              # everything, both cities in parallel
npm run harness:visual -- --city=seattle                            # one city
npm run harness:visual -- --city=seattle --route=seatac-uipath-bel --every=40
npm run harness:visual -- --city=bucharest --route=rosetti --from=0 --to=800 --no-aerial --viewports=none   # fast loop
npm run harness:visual -- --viewports=844x390 --route=none          # only the cockpit / HUD checks
npm run harness:visual -- --city=bucharest --district=romana --quality=high --traffic-every=200   # one district, perf + traffic shots
npm run harness:visual -- --city=seattle --route=uipath-bel --time=night --no-geometry --no-aerial  # night subset
npm run harness:visual -- --city=none --spots=all                   # the 24 tourist spots only (R19.4)
node game/dev/harness/run.js --visual …                             # same thing
```

| option | default | |
|---|---|---|
| `--city=bucharest,seattle` | both | cities (one page each, run in parallel with `--jobs=2`) |
| `--route=<id>[,<id>…]` / `--chapter=` | all | route ids or substrings (`all`, `none`). Chapter mode: chapter ids (`rosetti`, `upb`, …) and `sweep-<street>`; legacy mode: `spawn-rosetti`, `rosetti-upb`, …, `uipath-buc-otopeni`, `seatac-uipath-bel` |
| `--district=<id>[,…]` | all | only these district worlds (`romana`, `bellevue`, …); a `--route` list of chapter ids also skips the districts that do not hold them |
| `--time=day` / `--weather=clear` | day, clear | look of the survey (`night`, `dusk`, …; `rain`, `fog`, `snow`, …): the game's own `clock.override` / `setWeatherOverride`. `road-dark-patch` and `road-not-asphalt` are skipped at night / dusk (lamp pools), `road-sky-hole` in rain / snow / fog (wet asphalt mirrors the sky); headlights auto at night |
| `--traffic-every=<m>` | off | every N m an extra frame of the same view **with** the fleet, transit and the instanced crowd (sheet `…-traffic`), after 12 traffic steps; its draw calls / triangles feed the perf table's "+traffic" columns. Forward frames stay traffic-free so the pixel detectors stay comparable |
| `--spots[=<id|scene|city>,…]` | off | tourist spots via `game/dev/spots.html?manual=1` + `window.spotDev`: spawn, postcard (the challenge's pose and pitch) and a 3 s walk from the spawn; one sheet per spot (`sheets/spots-<id>.jpg`), frames in `spots/`, a table in `visual.md`. `--spot-q=high` quality. Use `--city=none` for spots only |
| `--every=40` | 40 m | forward shot spacing |
| `--from=<m> --to=<m>` | whole route | only this distance range of each route (the geometry corridor shrinks with it) |
| `--look-every=200`, `--aerial-every=200`, `--tile=120` | | left/right/back looks, top-down tiles (tile size in m) |
| `--no-aerial`, `--no-looks`, `--no-zfight`, `--zevery=3` | | skip captures / flicker test every N samples |
| `--viewports=1280x720,1920x1080,2560x1080,844x390,390x844` | these | cockpit + HUD screenshots (`none` / `--no-cockpit` to skip). Widths < 1000 also get a `-touch` variant (touch controls shown) |
| `--quality=medium` | medium | game quality ladder (`low`, `medium`, `high`), set before the district loads (traffic pool sizes follow it) |
| `--pr=0.75` | 0.75 | internal render resolution × the 1280×720 viewport (software GL is fragment-bound; sheets are 640 px wide). `--pr=1` = full 1280×720 |
| `--far=0` | game | camera far plane for survey frames; 0 = the game's own (weather-driven visibility, round 2). `--far=450` = the round-1 clip |
| `--traffic` | off | keep traffic / pedestrians visible (off = the map alone) |
| `--no-geometry`, `--geo=all`, `--corridor=70`, `--focus=40` | | geometry detectors off / whole map / corridor half-width / number of 40 m close-ups |
| `--no-offices` | | skip the office-lobby shots |
| `--sweep=2` | 2 | chapter mode: main streets per district surveyed in addition to the chapter routes (streets the chapter routes already cover are skipped); `--sweep-max=2000` m surveyed per sweep; sweeps start 42 m in from their map end (not inside the closure) |
| `--root=<dir>` | repo | serve the GAME from another checkout (e.g. a `git archive HEAD` snapshot while `game/src` is mid-edit); the visual QA code always comes from this checkout |
| `--debug-masks` | | save the lane / cockpit masks used by the pixel detectors (`report/debug/`) |
| `--report-only` | | rewrite `visual.md` from `visual.json` (after editing the report code) |
| `--keep`, `--out=<dir>`, `--port=8123`, `--headed`, `--timeout=120`, `--verbose` | | |

Exit code: 0 = no high finding, 1 = at least one high finding, 3 = the tool failed.

Per-city runs (review one city while the other runs, or after a fix in one city):
`node game/dev/harness/run.js --visual --city=seattle --out=game/dev/harness/visual/report/seattle`. Finding ids
(`#n`, also drawn on the aerial tiles) are per report: with one city per run they restart at 1, with both cities in
one run Seattle's start at 100001. Office lobbies only: `--route=none --viewports=none --no-geometry --pr=1`.

**Routes are data-driven.** If `game/src/cities.js` exports `CHAPTERS` (spec 10), every chapter is surveyed in its
district world (`game.loadCity(city, { district, start })`, start pose from `game.chapterPose(ch)` when present),
plus a sweep of the district's longest named main streets. Otherwise the legacy corridor maps are used:
Bucharest spawn → rosetti → upb → gts → luxoft → db → arnia → uipath-buc → otopeni, Seattle seatac → uipath-bel.
Routes come from `game.nav.compute()`; the car is placed on lane 0 of the route's edge (`player.place(x, z, heading, edge)`).

## What it captures (per route)

- **forward** every `--every` m: the driver's view, HUD hidden (`#hud` visibility hidden), quality medium, day, clear.
- **looks** every ~200 m: left / right / back (`player.camHolder` yaw, `lookBack` for the back view).
- **aerial** every ~200 m: an orthographic top-down tile (120 m, car at the centre, driving direction up) rendered
  with the game renderer; geometry findings are circled with their id.
- **geometry close-ups**: a 40 m top-down tile (north up) for the worst findings of each geometry detector.
- **cockpit** at each viewport with the HUD visible (full-page screenshot), once per city.
- **offices**: the lobby of every stop in the city (entrance view + a close-up of the lobby sign), once per city.

**Perf.** Every forward frame records `r3d.stats` (draw calls, triangles; `renderer.info` is reset first so the
harness's own mask / flicker renders do not count) — the world alone; `--traffic-every` frames record the full scene.
`visual.md` → *Perf*: the chapter-start frame and the worst frame per route, ⚠ above 400 calls or 1.5 M triangles.

## Report (`report/`, not tracked except review.md)

- `visual.md` — counts per detector, routes, links to every contact sheet and cockpit screenshot, findings with
  position (x/z, lat/lon, street), severity, crop / frame links. `visual.json` — everything, machine-readable.
- `sheets/<world>-<route>-forward|looks|aerial-NNN.jpg`, `sheets/<world>-geometry-NNN.jpg`, `sheets/cockpit-*.jpg`,
  `sheets/offices-*.jpg` — contact sheets, ≤ 6 tiles each, every tile ≥ 640 px wide, labelled with index, distance,
  street, x/z, lat/lon, road height and the detector flags for that spot (red label = flagged).
- `issues/` — crops for pixel findings and close-ups for geometry findings; `frames/` — full frames of flagged samples;
  `cockpit/` — the viewport screenshots.
- `review.md` — the human-style review (numbered defects by category, written after looking at every sheet).

## Detectors

Geometry (from `world.ribbons`, the edges' vertical profile, the merged `ground` / `marks` cell meshes, instanced
trees, `world.lamps`, landmark / POI groups, `world.buildings`; corridor = 70 m around the surveyed routes):

| type | what |
|---|---|
| `ribbon-zfight` | carriageways / junction pads of different edges overlap in plan with \|Δy\| < 0.05 m (z-fighting asphalt, markings of one road across the other); also consecutive ribbons overlapping at a mitre. Round 2: **low** when both surfaces are the same colour family (world.js `asphaltOf`: asphalt / concrete / tunnel / unpaved; a US ramp counts as the colour of the road at its nearer end) — invisible since one asphalt colour + world-space UVs; graded by area when the colours differ (`data.surfaces`) |
| `pad-overlap` | an edge's carriageway runs > 1.5 m² into its own junction pad (4 mm apart → z-fight at range) |
| `ribbon-stacked` | two road surfaces overlap with 0.05–4 m between them (spec R11.4: share one surface or ≥ 5 m clearance) |
| `ribbon-flipped` | inverted / bow-tie carriageway quad (junction retraction or mitre longer than the edge) |
| `ribbon-gap` | consecutive ribbons of the same road > 0.3 m apart at their shared node |
| `road-hole` | a point of the driven lane not covered by any carriageway / pad |
| `surface-above-road` | a ground-mesh triangle (kerb strip, sidewalk, pad, other asphalt) 3 cm–2.5 m above another road's carriageway |
| `marking-off-road` / `marking-on-pad` / `marking-buried` / `marking-floating` | marking triangle not on any carriageway (> 0.25 m out) / inside a junction pad / under or level with another surface / > 4.5 cm above every surface |
| `tunnel-lid-low` | a **lidded** tunnel edge (`edge.lidded`, > 4.5 m deep) less than 3.8 m below street level: world.js's street-level lid (and ceiling) cut across the road (shallow tunnels are open trenches, skipped) |
| `bridge-underside-buried` | a bridge's 1.1 m deck fascia / underside goes into the ground at a low end |
| `object-floating` / `object-sunk` | tree trunk / street lamp / landmark / POI / station prop base > 0.3 m above or > 0.5 m below the ground or road under it (objective markers `poi.marker` float by design and are skipped) |
| `building-over-road` | a building footprint covers > 0.7 m² of a carriageway (at a level the road is drawn) |
| `deck-dangling` / `lifted-nonbridge` / `tunnel-visible` / `phantom-wall` | (world-visual, 2026-11-07) a raised road end with no road connected; a road that is neither bridge nor ramp lifted > 0.5 m; a tunnel ≥ 3 m deep without a lid; a collision wall crossing the surveyed path inside its height band |

Pixels (forward frames; the lane strip 7–40 m ahead along the route is projected to the screen, cockpit pixels are
masked with a cockpit-only render):

| type | what |
|---|---|
| `road-dark-patch` | > 8 % of the lane ahead has luminance < 6 % (black road patches) |
| `road-sky-hole` | > 3 % of the lane ahead matches the sky colour (holes) |
| `road-not-asphalt` | < 55 % grey and > 30 % saturated colour in the lane ahead (grass / wall / slab over the road). Round 2: blue-dominant, moderately saturated, darker pixels count as asphalt in shade (sky-tinted shade ≈ (38, 45, 63) is not a wall) |
| `zfight` | the same view rendered twice with a 1 mm camera jitter (unlit material clones with the same depth / polygon-offset state, no shadows): ≥ 2 flat (non-edge) 24 px blocks with > 12 % changed pixels |

Cockpit / UI (each viewport): `cockpit-screen-offscreen` / `cockpit-cluster-offscreen` (part of the nav screen /
instrument cluster outside the frustum), `cockpit-screen-occluded` / `cockpit-cluster-occluded` (a 9×6 ray grid from
the camera to the plane hits another cockpit mesh first — the occluder is named by colour and cockpit-local hit
point), `cockpit-screen-small`, `hud-offscreen`, `hud-overlap`, `hud-covers-cockpit` (a DOM HUD block over the
projected nav screen / cluster), `hud-text-clipped`, `hud-text-tiny`.

Canvas text (`canvas-text-overflow`): `page/textprobe.js` is injected before the game loads and wraps
`CanvasRenderingContext2D.fillText/strokeText`: text whose drawn box leaves the canvas, that overflows the filled
background panel it was drawn on (the last `fillRect` / `roundRect` containing the anchor — e.g. one sign-atlas cell),
or that `maxWidth` squeezes below 72 %. Covers signs, the nav screen, the gauges, office lobby signs, HUD canvases.
The source line (`game/src/<file>:<line>`) is reported.

Tourist spots (`--spots`): `spot-load-failed`, `spot-page-error`, `spot-walk-stuck` (< 2 m in 3 s from the spawn),
`spot-walk-nan`, `spot-dark` (> 30 % near-black frame at day), `spot-perf` (> 400 calls / > 1.5 M drawn triangles; scene
> 1 M triangles = R15.5, low).

## Speed

Software GL is fragment-bound, so frames are rendered at `--pr=0.5` (640×360 internal for the 1280×720 viewport,
exactly the sheet tile size; `--pr=1` for full resolution). Measured 2026-11-06 with both cities in parallel on a
4-core box shared with other agents' browsers (load average 20–30): 1.5–4.4 s per 40 m sample including looks,
aerials and the flicker test; Seattle 815 samples in 39 min, Bucharest 812 samples in 50 min. On an idle machine
expect roughly half. For the fast loop use `--route`, `--from/--to`, `--every=80`, `--no-looks --no-aerial
--no-zfight`, `--viewports=none` (one 40 m sample ≈ 1 s idle); one page per city is reused for all its routes and
district loads take 2–15 s.

## Files

- `run.js` — CLI (also reached via `../run.js --visual`): server, browser, per-city page, plan, report.
- `page/visual.js` — in-page orchestration: route plans + sampling, captures, sheets, aerials, crops.
- `page/geometry.js`, `page/pixels.js`, `page/ui.js` — detectors. `page/textprobe.js` — the canvas text probe (init script).
