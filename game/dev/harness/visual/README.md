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
node game/dev/harness/run.js --visual …                             # same thing
```

| option | default | |
|---|---|---|
| `--city=bucharest,seattle` | both | cities (one page each, run in parallel with `--jobs=2`) |
| `--route=<id>[,<id>…]` / `--chapter=` | all | route ids or substrings (`all`, `none`). Chapter mode: chapter ids (`rosetti`, `upb`, …) and `sweep-<street>`; legacy mode: `spawn-rosetti`, `rosetti-upb`, …, `uipath-buc-otopeni`, `seatac-uipath-bel` |
| `--every=40` | 40 m | forward shot spacing |
| `--from=<m> --to=<m>` | whole route | only this distance range of each route (the geometry corridor shrinks with it) |
| `--look-every=200`, `--aerial-every=200`, `--tile=120` | | left/right/back looks, top-down tiles (tile size in m) |
| `--no-aerial`, `--no-looks`, `--no-zfight`, `--zevery=3` | | skip captures / flicker test every N samples |
| `--viewports=1280x720,1920x1080,2560x1080,844x390` | these | cockpit + HUD screenshots (`none` / `--no-cockpit` to skip). Widths < 1000 also get a `-touch` variant (touch controls shown) |
| `--quality=medium` | medium | game quality ladder (`low`, `medium`, `high`); time of day is always `day`, weather `clear` |
| `--pr=0.75` | 0.75 | internal render resolution × the 1280×720 viewport (software GL is fragment-bound; sheets are 640 px wide). `--pr=1` = full 1280×720 |
| `--far=450` | 450 m | camera far plane for survey frames (fog hides the rest) |
| `--traffic` | off | keep traffic / pedestrians visible (off = the map alone) |
| `--no-geometry`, `--geo=all`, `--corridor=70`, `--focus=40` | | geometry detectors off / whole map / corridor half-width / number of 40 m close-ups |
| `--no-offices` | | skip the office-lobby shots (legacy mode only) |
| `--sweep=2` | 2 | chapter mode: main streets per district surveyed in addition to the chapter routes (streets the chapter routes already cover are skipped); `--sweep-max=2000` m surveyed per sweep |
| `--root=<dir>` | repo | serve the GAME from another checkout (e.g. a `git archive HEAD` snapshot while `game/src` is mid-edit); the visual QA code always comes from this checkout |
| `--debug-masks` | | save the lane / cockpit masks used by the pixel detectors (`report/debug/`) |
| `--report-only` | | rewrite `visual.md` from `visual.json` (after editing the report code) |
| `--keep`, `--out=<dir>`, `--port=8123`, `--headed`, `--timeout=120`, `--verbose` | | |

Exit code: 0 = no high finding, 1 = at least one high finding, 3 = the tool failed.

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
- **offices**: the lobby (entrance view) of every stop in the city (legacy mode).

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
| `ribbon-zfight` | carriageways / junction pads of different edges overlap in plan with \|Δy\| < 0.05 m (z-fighting asphalt, markings of one road across the other); also consecutive ribbons overlapping at a mitre |
| `pad-overlap` | an edge's carriageway runs > 1.5 m² into its own junction pad (4 mm apart → z-fight at range) |
| `ribbon-stacked` | two road surfaces overlap with 0.05–4 m between them (spec R11.4: share one surface or ≥ 5 m clearance) |
| `ribbon-flipped` | inverted / bow-tie carriageway quad (junction retraction or mitre longer than the edge) |
| `ribbon-gap` | consecutive ribbons of the same road > 0.3 m apart at their shared node |
| `road-hole` | a point of the driven lane not covered by any carriageway / pad |
| `surface-above-road` | a ground-mesh triangle (kerb strip, sidewalk, pad, other asphalt) 3 cm–2.5 m above another road's carriageway |
| `marking-off-road` / `marking-on-pad` / `marking-buried` / `marking-floating` | marking triangle not on any carriageway (> 0.25 m out) / inside a junction pad / under or level with another surface / > 4.5 cm above every surface |
| `tunnel-lid-low` | a tunnel edge less than 3.8 m below street level: world.js's street-level lid (and ceiling) cut across the road |
| `bridge-underside-buried` | a bridge's 1.1 m deck fascia / underside goes into the ground at a low end |
| `object-floating` / `object-sunk` | tree trunk / street lamp / landmark / POI / station prop base > 0.3 m above or > 0.5 m below the ground or road under it |
| `building-over-road` | a building footprint covers > 0.7 m² of a carriageway (at a level the road is drawn) |

Pixels (forward frames; the lane strip 7–40 m ahead along the route is projected to the screen, cockpit pixels are
masked with a cockpit-only render):

| type | what |
|---|---|
| `road-dark-patch` | > 8 % of the lane ahead has luminance < 6 % (black road patches) |
| `road-sky-hole` | > 3 % of the lane ahead matches the sky colour (holes) |
| `road-not-asphalt` | < 55 % grey and > 30 % saturated colour in the lane ahead (grass / wall / slab over the road) |
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

## Speed

Software GL is fragment-bound: a medium-quality 960×540 frame costs ≈ 0.5–1 s on an idle 4-core machine
(2–3 s with several other headless browsers running), the flicker test ≈ 2 × 0.3 s, looks 3 frames per 200 m,
aerials 1 per 200 m. Rough cost: ≈ 1.5–2 s per 40 m sample idle. Use `--from/--to`, `--route`,
`--no-looks --no-aerial --no-zfight` or `--every=80` for a quick loop; one page per city is reused for all its routes.

## Files

- `run.js` — CLI (also reached via `../run.js --visual`): server, browser, per-city page, plan, report.
- `page/visual.js` — in-page orchestration: route plans + sampling, captures, sheets, aerials, crops.
- `page/geometry.js`, `page/pixels.js`, `page/ui.js` — detectors. `page/textprobe.js` — the canvas text probe (init script).
