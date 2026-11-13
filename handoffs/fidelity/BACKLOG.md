# Backlog · the one list of open work

Updated 2026-11-13. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Romana, UiPath (241, -184), 2026-11-13 | "uipath is broken it has a building in side it" | open: at the pose the model's dark door canopy and frame stand out of the west face; no other building, part or mesh found inside The Landmark's footprint (ray scan of the volume) |
| SeaTac (-981, -16), 2026-11-13 | "bridges with borders that don't connect", "floating connecting buildings that don't connect to anything", "invisible wall … can't even reach destination" | wall fixed (the Airport Expressway fork's junction slab, node 255158306, stood 0.13-0.37 m above the road height the car follows: a car within 0.5 m of a junction slab's top is on it); railings: every raised deck of every district takes the Basarab guard rule now (one railing on the outline of the union of the raised carriageways, joined and pruned as one network, drawn as the reviewed guard class or a concrete parapet); SeaTac 486 runs, 14 open ends left at abutments and the garage helix. Floating connectors: the garage skybridges were checked from the drives and reach both ends; the owner's pose of the floating one is needed |
| Bellevue, 2026-11-13 | "fences do not connect, etc" | railings as SeaTac (50 runs, 8 open ends); the Exit to NE 8th St West keeps 0.58 m above NE 8th where it merges (327, -329), so its inferred side barrier crosses the street's lanes: ramp profile still open |
| SeaTac and Bellevue, 2026-11-13 | "lanes are drawn badly on both seattle and bellevue" | the median-side edge line of every US one-way carriageway is yellow now (MUTCD 3B.06; it was white except on motorways / trunks); the Bellevue merge barrier above is the other visible fault |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R22 | Code cleanup after the district migration (spec 22) | 22 | in progress. Done: corridor era (maps, harness, main.js, world.js / landmarks.js branches); world.js 860 → 227 KB in 21 `world-*.js` modules, every step with world, collider, graph, stats and crowd fingerprints identical on all 8 districts. Left: the rest of `buildWorld` (227 KB: the `world` API object, sports dressing, the facade / sign helpers are tied to later state), `world-facades-guards.js` 74 KB and `world-ribbons.js` 63 KB, other files over 60 KB (landmarks.js 415, traffic.js 280, main.js 219, vehicles.js 125, pedestrian-fronts.js 113, render.js 108, buildings.js 81, archetypes.js 70; data modules landmark-cec-source.js / landmark-source-masses.js), the corridor build branch in tools/osm/build-data.mjs, dead code (R22.3), single sources (R22.4) |
| pipera-2 | Strada Petricani bridge (w8208289, 44.4743,26.1240): W-beam guard rails and the yellow east railing drawn since round 3; still open: water of Lacul Tei (w117140697, w117140691) and Lacul Plumbuita (r11546654) drawn at street level on both sides (real surface metres lower; needs a sunken-lake bank model and a level source), crowns inside the coarse CORINE lake polygon w117140691 (measured trees on the real bank: needs a documented outline exception). Weir and tram reserve: dossier (2026-11-13) | 11 | todo |
| unirii-small | Unirii: Dealul Mitropoliei has no relief: the district ground is flat, and the hill needs ground heights under its roads (Aleea Dealul Mitropoliei), buildings and the Patriarchal Cathedral; playgrounds and ATM markers are done since round 4 (`playgrounds.js`) | 12 | todo |
| seatac-6 | Terrain: International Blvd between S 176th and S 170th lies below a ~3 m concrete retaining wall, rockery and planted bank carrying the Airport Expressway and the station; the game is flat there (USGS: 3 - 9 m step, `seattle-seatac.md` section 5; needs ground heights outside the road decks) | 01 | todo |
| bellevue-2 | NE 8th St bridge over I-405 (47.61739, -122.1890): the deck edges draw the reviewed concrete parapet with a dark steel picket fence since round 2b, Exit → Renton w623055163 classed in round 3 (`game/research/bridge-guards.json`); still no north sidewalk and no overhead sign gantry on the bridge (text not legible); reference has the freeway in a cut with a concrete median barrier | 12 | todo |
| r3-look-11 | Places of worship: 6 compared in round 3 (Boteanu, Crețulescu, Amzei recoloured; Albă, Icoanei, Domnița Bălașa match the class); about 110 others in the eight districts not compared; porches / bell towers not modelled (only OSM-tagged towers / domes) | 12 | todo |
| r3-look-14 | Raster lawn on pedestrian streets (r2-world-b-pedestrian-lawn): top-down renders of mapped pedestrian ways in Romană (44.4398, 26.0968), Grozăvești, Pipera and Bellevue looked at in round 3 (no lawn on the bands; plazas outside the 3.5 m band keep raster green in Romană); none compared with a panorama | 12 | todo |
| r3-landmarks-8 | Promenada Mall east (Barbu Văcărescu) front, pano 44.478431, 26.104866 h 255: dark glazed band, LED screen, rounded corners and curved roof edge not modelled (extents not measured); the model's white panels read as a plain grey wall there | 12 | todo |

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
