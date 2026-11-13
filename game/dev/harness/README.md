# Drive My CV — play-test harness

An autopilot that plays the game in headless Chromium (Playwright, software GL) and reports JS errors, invisible
collisions, clipping, height snapping, traffic overlaps, pedestrians in cars, objects in the road, unreachable doors,
broken routes, plus a static audit of the loaded district's road network. It never edits the game: it loads
`game/index.html`, injects `page/index.js` on top of `window.game`, takes over the loop (fixed-step simulation, rendering
only for screenshots) and drives. Visual QA (what a player sees) is a separate tool: [visual/README.md](visual/README.md).

## Run

```sh
npm run harness                                     # audit + the full scenario set, both cities (~5–8 min)
npm run harness -- --scenario=b --city=bucharest    # one scenario group (b = the street drives)
npm run harness -- --scenario=b:magheru             # one scenario
npm run harness -- --scenario=a,h,i                 # several
npm run harness:audit                               # static audit only (= --audit), ~30 s
npm run harness -- --audit --city=seattle
npm run harness -- --scenario=c --headed            # watch it (still software GL, slow)
```

Options: `--city=bucharest|seattle`, `--verbose` (progress log + page warnings), `--no-audit`, `--traffic=full|low`
(desktop density, default / mobile density), `--dt=30` (physics Hz), `--shots=30` (screenshot budget), `--shot-all`
(also for overlap / pedestrian issues), `--timeout=240` (s per scenario), `--size=640x360`, `--port=8123`,
`--out=<dir>` (default `report/`), `--trace[=2]` (autopilot state every N sim seconds into `latest.log`), `--help`.

Exit code: `0` no high-severity issue, `1` at least one, `2` bad arguments, `3` the harness failed.

The game is served from `http://127.0.0.1:8123/` if something answers there, otherwise the runner starts its own
no-cache server. Needs the `playwright` module. Every run uses a fresh browser context, wipes the report screenshots and
answers Open-Meteo requests with an error (the game falls back to climate data).

## Scenarios

Every map is a 1:1 chapter district. A city loads the district of its first chapter (Bucharest: Floreasca, Seattle:
SeaTac) unless the scenario names its own. The full run is `FULL` in `run.js`.

| id | city | district | what |
|---|---|---|---|
| `a` | both | first chapter | spawn sanity: pose on a legal lane, objective + route + nav line, drive 150 m |
| `b:<street>` | Bucharest | the street's | drive ~400 m: `magheru`, `victoriei`, `catargiu` (Romana), `unirii` (Unirii), `floreasca` (Floreasca), `barbu` (Pipera) |
| `c` | both | loaded | visit each CV stop: fast travel, drive to the door, E, read, leave |
| `d` | both | Floreasca / SeaTac | refuel at the nearest station |
| `e` | both | loaded | fast travel to each stop and the airport: landing pose, route, last-mile drive |
| `g` | Bucharest | Romana | night: lights on, drive Calea Victoriei, lamp light-pool churn |
| `h` | both | Romana / Bellevue | crash into a wall (stuck prompt, R reset), drive into a lamp / tree (must stop) |
| `i` | Bucharest | Romana | 60 s stopped in Magheru's inner lane: traffic must get past |

Run by id only (not in the full run): `ch` (every chapter in its district, including the flight), `drive:<chapter>`
and `fin` (a chapter route at legal speed), `jam` (Romana rush hour), `foot` (walk to an office and back), `roam` (free
roam in every district), `spots:<id>` (enter a tourist spot from the drive and leave), and the `r5` group (`pause`,
`fines`, `chain`, `restore`, `office-talk`, `findcar`, `parking`). `run.js` lists the known ids on a typo.

### Checked every frame while driving

`js-error` / `console-error`, `nan-state`, `height-jump` (> 1.5 m in a frame), `car-off-surface` (> 1 m),
`surface-mismatch` / `route-wrong-level` (snapped to another level), `invisible-collision` (throttle on, stopped 2 s,
nothing ahead), `clipping`, `vehicle-overlap`, `vehicle-overlaps-player`, `vehicle-off-road`, `vehicle-wrong-way`,
`ped-in-vehicle`, `ped-on-carriageway`, `ped-stuck-crossing`, `route-failure`, `nav-missing`, `traffic-blockage`,
`autopilot-no-progress`, `perf-traffic-update`, `perf-fps` (low; software GL). After each drive the road ribbons near
the path are checked for objects (`object-in-road`, `object-under-elevated-road`, `object-over-sunken-road`); the
closure barriers at district edges are not counted.

### Static audit (`--audit`, also part of the full run)

For every drivable edge: props and buildings in the carriageway or junction boxes (level aware), `cliff-edge`,
`node-height-mismatch`, `height-snap` (the surface resolver returns another road's height), CV / airport / fuel doors not
reachable from a lane or inside buildings, no route from the spawn, spawned vehicles / pedestrians overlapping, the
player spawn. `world.audit()` / `world.devCheck()` results are ingested as `world.audit:<group>` issues.

## Report

`report/latest.md` (human), `latest.json` (machine), `latest.log` (steps, autopilot decisions, issues as they happen),
`report/shots/<run>-*.jpg`. A game that does not boot gives one `boot-failure` issue and exit code 1. Each issue has
`type`, `severity`, `scenario`, `city`, `x, z`, `lat, lon`, `street`, `msg`, `count` (merged by type + ~30 m cell or
object), `data`, `shot`. Screenshots are rationed (2 per issue type, 3 per scenario).

To look at a spot in the game: `game.player.place(x, z, heading)` then `game.traffic.setPlayer(game.player)`, or
`harness.H.placeOnRoad(x, z)` after injecting the harness.

## Add a scenario

Scenarios live in `page/scenarios.js` (`SCENARIOS`; streets for `b` in `STREETS`). Each is
`{ id, group?, title, city: 'bucharest'|'seattle'|'any', district?, run(H) }`; `run` returns any JSON-able result. `H`
(`page/core.js`):

```js
await H.run(seconds, until?)                                // step the sim (invariants run every frame)
await H.driveTo(x, z, { arriveR, timeout, stop, label })    // autopilot along the nav route → { ok, reason, t, dist }
H.placeOnRoad(x, z, heading, { edge, dir, s, lane })        // teleport onto a lane (rebuilds the traffic bubble)
findStreet(H, /Regex/, 400, { ll: [lat, lon], bearing })    // scenarios.js: a stretch of a named road
H.issue(type, 'high'|'medium'|'low', msg, { x, z, ...data }, { key, shot: true })
await H.shot('name'); H.note(msg)
H.press('KeyE'); H.setControls(throttle, steer, brake); H.auditAroundPath(radius)
```

Add the id to `FULL` in `run.js` (and `DEFAULT_CITIES` for `'any'` scenarios) to include it in the full run. In the page,
`window.harness` exposes `list()`, `runScenario(id)`, `audit()`, `driveTo`, `visitStop(id)`, `refuel`, `findStreet`,
`stats()`, `perfProbe()`, `issues`.

Files: `run.js` (CLI), `report.js` (report writer), `page/index.js` (entry, `window.harness`), `page/core.js` (loop
takeover, autopilot, invariants, ribbon checks), `page/scenarios.js`, `page/audit.js`, `page/util.js` (self-contained
helpers; missing game APIs are reported as `harness-api`).

Limits: software GL, so fps and lamp flicker are heuristics and visual-only bugs are not detected; traffic and
pedestrians only exist in the ~650 m bubble around the player; the autopilot is not perfect, so check the screenshot of a
`traffic-blockage`, `autopilot-no-progress` or `drive-failed` before filing a game bug.

## Other checks in this folder

Standalone `*-check.*` and `*.test.mjs` scripts each document their purpose and flags in their header. Two are general:

- `conditions-check.cjs` — Settings panel (time / weather / season, Live, touch layouts at 390×844 and 844×390),
  conditions kept across district / city changes, Resume and Continue after a reload. Starts its own server, fixes the
  clock, fails Open-Meteo on purpose, exits nonzero on a failed assertion, writes `report.json` + screenshots.
  `node game/dev/harness/conditions-check.cjs [--controls | --only-controls | --only-access] --out=<dir>`.
- `viewpoints.js` — renders a district from real poses beside Google Street View (or an aerial mosaic for top-down
  poses). Street View is for visual comparison only: nothing from it enters the game data, and images are cached in the
  output folder, never committed. Key: `$GOOGLE_MAPS_KEY`. Images cost money: `--max` caps the poses (default 400) and
  `--dry` lists them first. All options are in the file header.

  ```sh
  node game/dev/harness/viewpoints.js --city=bucharest --district=floreasca --walk --streetview --out=/tmp/walk
  node game/dev/harness/viewpoints.js --district=floreasca --views=game/dev/harness/views/floreasca.json --streetview
  node game/dev/harness/viewpoints.js --district=floreasca --topdown=250 --mosaic=/tmp/flo18
  ```
