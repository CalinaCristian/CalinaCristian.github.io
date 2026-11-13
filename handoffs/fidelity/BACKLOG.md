# Backlog · the one list of open work

Updated 2026-11-13. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Romana, UiPath (241, -184), 2026-11-13 | "uipath is broken it has a building in side it" | not reproduced: rendered at the exact F8 eye / bearing / pitch by day and at the report hour (21:05, night). The Landmark (Corp B, L-shaped) has no other mesh or collider inside its walls (scene scan of its volume); the only neighbour touching it is w583612401 (Corp A, a 25 m generic glass block east of the courtyard), which overlaps the open courtyard by a 2.5 m strip, not the building. The F8 `release` / `source` fields were stale (stamped 2026-11-11, before the round-2 remodel of this model), so which build the owner saw is unknown; re-stamped 2026-11-13, so the next F8 report identifies its build |
| SeaTac (-981, -16), 2026-11-13 | "bridges with borders that don't connect", "floating connecting buildings that don't connect to anything", "invisible wall … can't even reach destination" | wall fixed (the Airport Expressway fork's junction slab, node 255158306, stood 0.13-0.37 m above the road height the car follows: a car within 0.5 m of a junction slab's top is on it); railings: every raised deck of every district takes the Basarab guard rule now (one railing on the outline of the union of the raised carriageways, joined and pruned as one network, drawn as the reviewed guard class or a concrete parapet); SeaTac 486 runs, 14 open ends left at abutments and the garage helix. Floating connectors: the garage skybridges were checked from the drives and reach both ends; the owner's pose of the floating one is needed |
| Bellevue, 2026-11-13 | "fences do not connect, etc" | railings as SeaTac (50 runs, 8 open ends); the merge at (327, -329) is level now: NE 8th St west of the bridge was one 92 m straight slope still 0.3–0.6 m up where the Exit to NE 8th St West joins it, and an approach with a merging ramp is cut into 10 m profile pieces like a deck, so it reaches grade at x ≈ 339 (barrier no longer across the lanes) |
| SeaTac and Bellevue, 2026-11-13 | "lanes are drawn badly on both seattle and bellevue" | the median-side edge line of every US one-way carriageway is yellow now (MUTCD 3B.06; it was white except on motorways / trunks); the Bellevue merge barrier above is fixed |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R22 | Code cleanup after the district migration (spec 22) | 22 | in progress. Done: corridor era (maps, harness, main.js, world.js / landmarks.js branches); world.js 860 → 47 KB (`buildWorld` is the assembler) in 33 `world-*.js` modules (each under 60 KB; ranges whose names world.js reassigns later read / write them through getter objects), every step with world, collider, graph, stats and crowd fingerprints identical on all 8 districts; landmarks.js 422 → 22 KB (registry, same API) + 14 `landmarks/*.js` modules ≤ 50 KB, its 4.6 MB of generated source massing (landmark-cec-source.js, landmark-source-masses.js) moved to `game/data/landmarks/*.json`, world fingerprints and all 74 landmark builds identical. world-facades-guards.js / world-ribbons.js split (world-bridge-structures.js, world-edge-ribbons.js); BUILDING_SPECS, the archetype atlas and the pedestrian-plaza table in their own modules (per-district data files under building-specs/ and pedestrian-plazas/). main.js 218 → 35 KB (Game methods in 8 `game-*.js` prototype mixins + `game-common.js`, via `mixin.js`), render.js 109 → 36 KB (`render-shaders/lighting/lamps/weather.js`), geo-ne110.js → `game/data/geo/ne110.js`, fingerprints, crowd, tests and harness foot,a / ch unchanged. traffic.js 286 KB → traffic.js + traffic-shared / -lanes / -step / -parking.js and pedestrians.js + pedestrians-walk / -road.js (prototype mixins), vehicles.js 126 KB → vehicles.js + vehicle-models / -materials / -cockpit.js, pedestrian-fronts.js 113 KB → one data module per district under pedestrian-fronts/ (all < 60 KB, same exports, world and crowd / vehicle fingerprints identical). Left: the corridor build branch in tools/osm/build-data.mjs, dead code (R22.3), single sources (R22.4) |

## Rules

- Fixes go straight to `master`, no PR (owner rule), after the checks below pass. `git fetch origin master` and merge
  before each push.
- OSM decides where things are; Street View panoramas decide what they look like. Panoramas are a visual reference only:
  never downloaded in bulk, stored, traced, copied into textures or published. When a panorama shows OSM is wrong, the fix
  is a documented exception, never a silent move. Review tool: `node game/dev/reality/capture.cjs --district=<id>`
  (viewpoints in `game/dev/reality/viewpoints.json`); what a review establishes goes into the district's
  `game/research/` dossier.
- Do not claim hardware frame rates from emulation.
- The other folders here hold only evidence that game code, tools, tests or the overview read (for example
  `d-otopeni/terminal-roof-measurements.json`); delete a folder once nothing reads it (git history keeps it).

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`.
