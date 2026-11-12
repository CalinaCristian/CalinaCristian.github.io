# Drive My CV — play-test harness

An autopilot that plays the game end-to-end in headless Chromium (Playwright, software GL) and reports
what goes wrong: JS errors, invisible collisions, clipping, bridge snapping, traffic overlaps, pedestrians
in cars, objects in the road, unreachable doors, broken routes… plus a static audit of the whole road
network of both cities.

It never edits the game. It loads `game/index.html`, injects `page/index.js` as an ES module on top of
`window.game`, takes over the game loop (fixed-step simulation, rendering only for screenshots) and drives.

## Run

```sh
npm run harness                                     # everything: audit + all scenarios, both cities (~5–8 min)
npm run harness -- --scenario=b --city=bucharest    # one scenario group (b = the 11 streets)
npm run harness -- --scenario=b:magheru             # one street
npm run harness -- --scenario=a,h,i                 # several
npm run harness -- --audit                          # static world audit only (both cities, ~30 s)
npm run harness -- --audit --city=seattle
npm run harness -- --scenario=c --headed            # watch it (still software GL, slow)
```

Options: `--city=bucharest|seattle`, `--verbose` (progress log + page warnings), `--no-audit`,
`--traffic=full|low` (full = the desktop/auto traffic density the owner plays with, default; low = mobile
density), `--dt=30` (physics Hz, default 30), `--shots=40` (screenshot budget), `--timeout=240` (s per
scenario), `--size=640x360` (viewport), `--port=8123`, `--out=<dir>` (report folder, default `report/`),
`--trace[=2]` (autopilot state every N sim seconds into `latest.log`), `--shot-all`.

Exit code: `0` = no high-severity issue, `1` = at least one high-severity issue (driving or audit),
`2` = bad arguments, `3` = the harness itself failed.

The game is served from `http://127.0.0.1:8123/` if something answers there (e.g.
`python3 -m http.server 8123`), otherwise the runner starts its own no-cache static server on a free port.
Playwright is required as a module (`require('playwright')`, globally installed here). Nothing is cached
between runs: every run starts a fresh browser context, and the report folder's screenshots are wiped.

Speed: the simulation runs headless at roughly 5–8× real time (≈4–5 ms per 1/30 s step with ~250 vehicles
in Bucharest, ≈1.5 ms in Seattle); nothing is rendered except screenshots. A screenshot frame is rendered at
half pixel ratio with the far plane clipped to 300 m (≈0.3–1 s in SwiftShader; the first one per city ~6–10 s
for shader compilation), and they are rationed: 2 per issue type and 3 per scenario, 30 per run, none for
remote/transient types (vehicle overlaps, pedestrians) unless `--shot-all`. A full run takes ≈5 min on an idle
4-core machine (7–8 min measured here with several other headless browsers competing for the CPU).

## Scenarios

| id | city | what |
|---|---|---|
| `a` | both | spawn sanity: pose on the road / legal direction / not touching anything, objective + route + nav line present, drive the first 150 m |
| `b:<street>` | Bucharest | drive ~400 m on Magheru, Calea Victoriei, Unirii, Kiseleff, Ștefan cel Mare, Pipera, DN1, Splaiul Independenței, Lascăr Catargiu, Calea Floreasca, Barbu Văcărescu (`b` = all) |
| `c` | Bucharest | visit every CV stop: fast travel near it, drive to the door, E, walk to a screen, read it, leave, check it is unlocked |
| `d` | both | refuel: drive to the nearest station, E, tank full |
| `e` | both | fast travel to each stop and the airport: landing pose, route, last-mile drive |
| `f` | Bucharest→Seattle | fly (skip the cut-scene), SR-518 → I-5 → I-90 floating bridge → I-405 → NE 8th, enter UiPath Bellevue, finale panel |
| `g` | Bucharest | night: night lights / headlights / NPC lights on; drive Calea Victoriei; street-lamp light-pool churn (flicker heuristic) |
| `h` | both | crash into a building wall, keep pushing (stuck prompt), R reset (pose checks), drive away; drive into a lamp/tree (must stop, not pass through), R |
| `i` | Bucharest | 60 s stopped in the inner lane of Magheru: vehicles behind must get past |

Every scenario keeps ≤ 90 s of simulated time per drive (teleports instead of long trips).

### Invariants checked every frame while driving

`js-error` / `console-error` (window errors, unhandled rejections, console.error), `nan-state` (player or any
vehicle), `height-jump` (car surface height changes > 1.5 m in one frame), `car-off-surface`
(|car y − surface| > 1 m), `surface-mismatch` / `route-wrong-level` (the car's height differs > 1 m from the
profile of the route edge it is driving on — e.g. snapped onto an overpass), `invisible-collision` (throttle on,
< 0.5 m/s for 2 s, nothing within ~4 m ahead; includes `player.debug.lastCollider` when the game exposes it),
`clipping` (car body overlapping a building / box / prop that the game's collision considers solid at the car's
level), `vehicle-overlap` (two NPCs overlapping > 0.5 m for > 1 s; `-ghost` when deadlock ghosting is on),
`vehicle-overlaps-player`, `vehicle-off-road` (> half-width + 1 m from its edge, away from junctions),
`vehicle-wrong-way` (against a one-way), `ped-in-vehicle`, `ped-on-carriageway` (> 5 s, not on a crossing
leg), `ped-stuck-crossing`, `route-failure`, `nav-missing`, `traffic-blockage` (autopilot blocked 18 s, needed
R), `autopilot-no-progress`, `perf-traffic-update` (traffic.update average > 8 ms, low), `perf-fps` (low;
software GL, only at quality low ≤ 640×360). After each drive the road ribbons near the driven path are
checked for objects (`object-in-road`, `object-under-elevated-road`, `object-over-sunken-road`).

### Static world audit (`--audit`, also part of the full run)

For every drivable edge of the city: props (trees, lamps, posts, shelters, furniture…) and
buildings/landmark boxes intersecting the carriageway (`*-in-road`, by how deep they reach into it, level
aware: under a deck / over a trench are separate low/medium types), props/buildings inside junction boxes,
`cliff-edge` (|ya − yb| / len > 0.25), `node-height-mismatch`, `height-snap` (driving an edge at its own height,
the car's surface resolver — `player.surfaceAt` when present, else `world.roadHeight` — returns another road's
height), CV / airport / fuel doors not reachable from a routable lane (11 / 90 / 12 m), doors inside buildings,
no route from the spawn, freshly spawned vehicles overlapping each other or objects, pedestrians spawned inside
vehicles/buildings, the player spawn. The world's own self-checks (`world.audit()`, `world.devCheck()`) are
ingested as `world.audit:<group>` issues when they exist.

## Read the report

`report/latest.md` (human), `report/latest.json` (machine), `report/latest.log` (the harness log: scenario
steps, autopilot decisions, every issue as it happened), `report/shots/<run>-*.jpg`. If the game does not boot
(syntax error mid-edit…), the report contains a single `boot-failure` issue with the page errors and the exit
code is 1.

- Each issue: `type`, `severity` (high / medium / low), `scenario`, `city`, `x, z` (game metres), `lat, lon`
  (inverse of `city.proj`), `street` (nearest edge), `msg`, `count` (occurrences merged into it — issues are
  deduplicated by type + ~30 m cell or by object), `data` (ids, depths, heights…), `shot` (screenshot).
- The markdown lists the scenarios (sim/wall time, outcome), then driving issues grouped by type with the top
  examples, then one static-audit section per city with positions, sorted by depth / severity.
- To look at a spot in the game: `game.player.place(x, z, heading)` in the console (plus
  `game.traffic.setPlayer(game.player)`), or run `harness.H.placeOnRoad(x, z)` after injecting the harness.

## Add a scenario

Scenarios live in `page/scenarios.js` (`SCENARIOS`). Each is `{ id, title, city, run(H) }`, `city` =
`'bucharest' | 'seattle' | 'any'`; `run` returns any JSON-able result. Useful pieces of `H` (`page/core.js`):

```js
await H.run(seconds, until?)                 // step the sim (invariants run every frame)
await H.driveTo(x, z, { arriveR, timeout, stop, label })   // autopilot along the nav route → { ok, reason, t, dist }
H.placeOnRoad(x, z, heading, { edge, dir, s, lane })        // teleport onto a lane (rebuilds the traffic bubble)
findStreet(H, /Regex/, 400, { ll: [lat, lon], bearing })   // a stretch of a named road → { edge, dir, s, end }
H.issue(type, 'high'|'medium'|'low', msg, { x, z, ...data }, { key, shot: true })
await H.shot('name')                         // screenshot now (→ report/shots/name.jpg)
H.press('KeyE'); H.setControls(throttle, steer, brake); H.auditAroundPath(radius)
```

Add new streets for `b` to `STREETS`. Add the scenario id to `FULL` in `run.js` (and `DEFAULT_CITIES` for
`'any'` scenarios) to include it in the full run. In the page, `window.harness` exposes
`driveTo`, `visitStop(id)`, `refuel()`, `fly()`, `stats()`, `issues`, `runScenario(id)`, `audit()`.

## Files

- `run.js` — CLI: server, browser, plan, timeouts, recovery, screenshots, exit code.
- `report.js` — writes `report/latest.json`, `report/latest.md`, the stdout summary.
- `page/index.js` — injected entry, `window.harness`.
- `page/core.js` — loop takeover, autopilot (pure pursuit + speed planning + obstacle/red-light handling +
  unstick), per-frame invariants, issue log, ribbon checks.
- `page/scenarios.js` — scenarios and street list. `page/audit.js` — static world audit.
- `page/util.js` — self-contained geometry/edge helpers (no imports from `game/src`, so the harness survives
  refactors; game APIs it needs are feature-checked and reported as `harness-api` when missing).

## Known limitations

- Software GL: fps and lamp flicker are only heuristics; visual-only bugs (z-fighting, textures, the look of a
  model) are not detected. Look at the screenshots.
- Traffic, pedestrians and the spawn-overlap audit only cover the ~650 m simulation bubble around the player.
- Collider kinds are taken from `collider.kind` when the world sets it, else inferred from the radius.
- The autopilot is a reasonable driver, not a perfect one: `traffic-blockage`, `autopilot-no-progress` and
  some `drive-failed` results can be the harness's fault — check the screenshot before filing a game bug.

## Settings, conditions and Continue (`conditions-check.cjs`)

```sh
node game/dev/harness/conditions-check.cjs --controls --out=/tmp/dmcv-conditions-check
```

Needs Playwright and its Chromium. It starts its own static server, mutes audio, fixes the clock at 2026-11-08 10:00 UTC,
fails Open-Meteo requests on purpose (climate fallback) and isolates each fixture in a fresh browser context; it exits
nonzero on any failed assertion and writes `report.json` plus screenshots. It covers the title-screen Settings panel
(time / weather / season, the Live button, touch layouts at 390×844 and 844×390), conditions kept across district and
city changes, Resume story and Continue after a reload (fuel included: zero survives, negative / NaN are ignored).
`--controls` adds the cockpit mirror and driving / on-foot L (headlights vs nothing); `--only-controls` and
`--only-access` run subsets. It is a functional check, not a frame-rate or weather-transition visual test.

## Reality comparison: viewpoints and the Street View street walk (`viewpoints.js`, 2026-11-08)

Renders a district world from real poses next to Google Street View (same spot, heading, camera height, fov) or, for
top-down poses, next to an aerial mosaic crop. Any `--city` / `--district`. Street View is used for **visual comparison
only** (Google's terms): nothing from it goes into the game data; images are cached in the output folder, never committed.

```sh
# walk every drivable street: a stop every 25 m on both sidewalks, facade + along-street views, snapped to the nearest pano
node game/dev/harness/viewpoints.js --city=bucharest --district=floreasca --walk --streetview --out=/tmp/walk
node game/dev/harness/viewpoints.js --district=floreasca --walk --streets='Georges Bizet' --every=50 --streetview --max=24
node game/dev/harness/viewpoints.js --district=floreasca --walk --dry --max=5000          # count poses / panos, fetch no images
node game/dev/harness/viewpoints.js --district=floreasca --views=game/dev/harness/views/floreasca.json --streetview
node game/dev/harness/viewpoints.js --district=floreasca --topdown=250 --mosaic=/tmp/flo18  # game vs aerial tiles
```

Key: `$GOOGLE_MAPS_KEY` (or injected by the network proxy). Pano lookups use the free metadata endpoint; images cost
money, so `--max` caps the poses (default 400) and `--dry` lists them first. `--eye=pano` (default) puts the game camera
where the Street View camera stood (2.5 m); `--eye=sidewalk` stands on the sidewalk at 1.7 m. `--season` defaults to
summer with Street View (most panos are summer shots). Output: `<out>/index.html` grouped by street, `poses.json`,
`world-stats.json` (buildings, trees, kerbside cars, fences, fuel forecourts …).

Walks accept official Google panoramas by default; public uploads are excluded because their lighting and camera
height can differ. `--pano-provider=any` allows those uploads explicitly. Metadata and image requests have a 30 s
absolute timeout; network errors contain codes rather than key-bearing URLs or response bodies. Reuse `--cache=<dir>`
for retakes to avoid paying for the same reference image again.

Generated walk poses preserve `sourceEdge` and `sourceLayer` alongside their original road-centre coordinates.
The comparison camera follows that source road's grade only when the panorama remains in its road corridor and
overlapping runtime surfaces agree within 0.25 m. Legacy manifests resolve the source edge from their original
road centre and street name. A missing explicit source edge or conflicting surface levels keeps the default
ground height and records the ambiguity; the harness does not infer panorama altitude. `<out>/camera-poses.json`
records each rendered pose's `cameraBaseY`, `cameraY`, `cameraSourceEdge` and `cameraLevelAmbiguity` for review.
