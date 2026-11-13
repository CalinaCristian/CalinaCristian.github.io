# Drive My CV — visual QA

The logic harness ([../README.md](../README.md)) checks logic. This tool checks what a player sees: it drives the camera
along every chapter route and the main streets of each district, renders the driver's view, makes contact sheets and
runs detectors on the geometry, the pixels, the cockpit and the HUD. A person (or the QA agent) then looks at every sheet
and writes `report/review.md`. It never edits the game: it loads `game/index.html` in headless Chromium (software GL),
injects `page/visual.js` and renders only on request.

## Run

```sh
npm run harness:visual                                              # everything, both cities in parallel
npm run harness:visual -- --city=seattle --route=uipath-bel --every=40
npm run harness:visual -- --city=bucharest --route=rosetti --from=0 --to=800 --no-aerial --viewports=none   # fast loop
npm run harness:visual -- --viewports=844x390 --route=none          # cockpit / HUD checks only
npm run harness:visual -- --city=bucharest --district=romana --quality=high --traffic-every=200
npm run harness:visual -- --city=seattle --route=uipath-bel --time=night --no-geometry --no-aerial
npm run harness:spots                                               # the tourist spots only (= --city=none --spots=all)
```

`node game/dev/harness/run.js --visual …` is the same entry. `--help` prints this file.

| option | default | |
|---|---|---|
| `--city=bucharest,seattle` | both | one page per city, run in parallel (`--jobs=2`); `none` for spots only |
| `--route=<id>[,…]` / `--chapter=` | all | plan ids or substrings: chapter ids (`rosetti`, `upb`, …, `uipath-bel`) and `sweep-<street>`; `all`, `none` |
| `--district=<id>[,…]` | all | only these district worlds; a `--route` list of chapter ids also skips districts that do not hold them |
| `--time=day`, `--weather=clear` | | survey look via the game's `clock.override` / `setWeatherOverride`. `road-dark-patch` / `road-not-asphalt` are skipped at night / dusk, `road-sky-hole` in rain / snow / fog |
| `--traffic-every=<m>` | off | an extra frame of the same view with traffic and crowd (sheet `…-traffic`), feeding the perf table's "+traffic" columns; forward frames stay traffic-free |
| `--spots[=<id\|scene\|city>,…]` | off | tourist spots via `game/dev/spots.html?manual=1`: spawn, postcard pose and a 3 s walk; sheet `sheets/spots-<id>.jpg`. `--spot-q=high` |
| `--every=40` | 40 m | forward shot spacing |
| `--from=<m> --to=<m>` | whole route | distance range of each route |
| `--look-every=200`, `--aerial-every=200`, `--tile=120` | | side / back looks, top-down tiles (tile size in m) |
| `--no-aerial`, `--no-looks`, `--no-zfight`, `--zevery=3` | | skip captures / flicker test every N samples |
| `--viewports=1280x720,1920x1080,2560x1080,844x390,390x844` | these | cockpit + HUD screenshots (`none` or `--no-cockpit` to skip); widths < 1000 add a `-touch` variant |
| `--quality=medium` | medium | `low`, `medium`, `high`, set before the district loads |
| `--pr=0.5` | 0.5 | render resolution × the 1280×720 viewport (software GL is fragment-bound); `--pr=1` full |
| `--far=0` | game | survey far plane; 0 = the game's weather-driven visibility |
| `--traffic` | off | keep traffic / pedestrians visible |
| `--no-geometry`, `--geo=all`, `--corridor=70`, `--focus=40` | | geometry detectors off / whole map / corridor half-width / number of 40 m close-ups |
| `--no-offices` | | skip the office-lobby shots |
| `--sweep=2`, `--sweep-max=2000` | | main streets surveyed per district beyond the chapter routes, metres per sweep |
| `--root=<dir>` | repo | serve the game from another checkout (e.g. a `git archive HEAD` snapshot while `game/src` is mid-edit) |
| `--debug-masks` | | save the lane / cockpit masks (`report/debug/`) |
| `--report-only` | | rewrite `visual.md` from `visual.json` |
| `--keep`, `--out=<dir>`, `--port=8123`, `--headed`, `--timeout=120`, `--verbose` | | |

Exit code: 0 no high finding, 1 at least one, 3 the tool failed.

One city per run: `node game/dev/harness/run.js --visual --city=seattle --out=game/dev/harness/visual/report/seattle`.
Finding ids (`#n`, also drawn on aerial tiles) restart at 1 per city; with both cities in one run Seattle's start at
100001. Office lobbies only: `--route=none --viewports=none --no-geometry --pr=1`.

Routes come from `CHAPTERS` in `game/src/cities.js`: each chapter is surveyed in its district
(`game.loadCity(city, { district })`, start pose from `game.chapterPose(ch)`), along `game.nav.compute()`, plus sweeps of
the district's longest named main streets.

## Captures

- **forward** every `--every` m: the driver's view, HUD hidden.
- **looks** (left / right / back) and **aerial** top-down tiles (car at the centre, driving direction up; geometry
  findings circled with their id) every ~200 m.
- **geometry close-ups**: a 40 m north-up tile for the worst findings of each geometry detector.
- **cockpit** at each viewport with the HUD, and **offices** (lobby entrance + sign close-up), once per city.
- **perf**: every forward frame records draw calls and triangles; `visual.md` → *Perf* flags frames above 400 calls or
  1.5 M triangles.

## Report (`report/`, untracked except `review.md`)

- `visual.md` / `visual.json` — counts per detector, routes, links to every sheet, findings with position, street,
  severity and crop / frame links.
- `sheets/` — contact sheets (≤ 6 tiles, each ≥ 640 px, labelled with distance, street, x/z, lat/lon, road height and
  the detector flags; red label = flagged). `issues/` crops and close-ups, `frames/` flagged full frames, `cockpit/`.
- `review.md` — the human review: numbered defects by category, written after looking at every sheet.

## Detectors

Geometry (ribbons, edge profiles, ground / marking meshes, trees, lamps, landmarks, buildings; 70 m corridor):

| type | what |
|---|---|
| `ribbon-zfight` | carriageways / pads of different edges overlap with \|Δy\| < 0.05 m; **low** when both are the same surface colour family, graded by area otherwise |
| `pad-overlap` | an edge's carriageway runs > 1.5 m² into its own junction pad |
| `ribbon-stacked` | two road surfaces 0.05–4 m apart (R11.4: one surface or ≥ 5 m clearance) |
| `ribbon-flipped` | inverted / bow-tie carriageway quad |
| `ribbon-gap` | consecutive ribbons of one road > 0.3 m apart |
| `road-hole` | a point of the driven lane not covered by any carriageway / pad |
| `surface-above-road` | a ground-mesh triangle 3 cm–2.5 m above another road's carriageway |
| `marking-off-road` / `-on-pad` / `-buried` / `-floating` | marking not on a carriageway / inside a pad / under another surface / > 4.5 cm above every surface |
| `tunnel-lid-low` | a lidded tunnel less than 3.8 m below street level |
| `bridge-underside-buried` | a bridge fascia / underside goes into the ground |
| `object-floating` / `object-sunk` | tree / lamp / landmark / POI base > 0.3 m above or > 0.5 m below the surface (objective markers skipped) |
| `building-over-road` | a building footprint covers > 0.7 m² of a carriageway at its level |
| `deck-dangling` / `lifted-nonbridge` / `tunnel-visible` / `phantom-wall` | raised road end with nothing connected; non-bridge road lifted > 0.5 m; tunnel ≥ 3 m deep without a lid; collision wall across the surveyed path |

Pixels (forward frames; the lane 7–40 m ahead projected to the screen, cockpit pixels masked):

| type | what |
|---|---|
| `road-dark-patch` | > 8 % of the lane ahead below 6 % luminance |
| `road-sky-hole` | > 3 % of the lane ahead matches the sky colour |
| `road-not-asphalt` | < 55 % grey and > 30 % saturated colour in the lane (bluish shade counts as asphalt) |
| `zfight` | the view rendered twice with 1 mm camera jitter: ≥ 2 flat 24 px blocks with > 12 % changed pixels |

Cockpit / UI (each viewport): `cockpit-screen-offscreen` / `cockpit-cluster-offscreen`, `cockpit-screen-occluded` /
`cockpit-cluster-occluded` (the occluding mesh is named), `cockpit-screen-small`, `hud-offscreen`, `hud-overlap`,
`hud-covers-cockpit`, `hud-text-clipped`, `hud-text-tiny`.

Canvas text (`canvas-text-overflow`, `page/textprobe.js` wraps `fillText` / `strokeText`): text leaving its canvas,
overflowing the background panel it was drawn on, or squeezed by `maxWidth` below 72 %; reports the source line.

Tourist spots (`--spots`): `spot-load-failed`, `spot-page-error`, `spot-walk-stuck` (< 2 m in 3 s), `spot-walk-nan`,
`spot-dark` (> 30 % near-black at day), `spot-perf` (> 400 calls / > 1.5 M drawn triangles; scene > 1 M triangles =
R15.5, low).

## Speed

Software GL: roughly 1–4 s per 40 m sample with looks, aerials and the flicker test; a full survey of both cities takes
most of an hour. For a fast loop use `--route`, `--from/--to`, `--every=80`, `--no-looks --no-aerial --no-zfight`,
`--viewports=none` (≈ 1 s per sample). One page per city is reused; district loads take 2–15 s.

## Files

`run.js` (CLI, also via `../run.js --visual`), `page/visual.js` (route plans, sampling, captures, sheets),
`page/street-sweeps.js` (sweep planning on real directed roads; test `street-sweeps.test.mjs`), `page/geometry.js`,
`page/pixels.js`, `page/ui.js` (detectors), `page/textprobe.js` (canvas text probe), `page/office-sign-frame.js`
(lobby-sign framing), `coverage-check.cjs` (regression: capture timeouts must fail the run).
