# Native Grozăvești support/profile export

Exact source: `6cbf82b61de8267f662bf50239c37ccc1764635c`, tree `69419e78c1dc1200853278672418342ed6a13d41`. All 130 runtime modules are byte-identical to `8ccab8b8f2e207aed8ceaca7fd6485590f1c7be7`; the four source tram metadata fields are present. This is one bounded read-only support extraction, not a final district, movement, contact or frame-budget gate.

The native public `startFreeRoam('grozavesti', …)` calls the unchanged `loadCity`, constructor, `attachWorldRender` and `enterRoam` lifecycle. The harness stops the update loop, fixes `nowDate` to `2026-06-21T09:00:00Z`, requests native High/clear/summer/noon and renders the native scene. The fixed date is 12:00 local; it takes precedence over the stored noon offset. No source patch, actor/geometry/material/count/visibility override or traffic update step is used. One browser loaded the world at 05:16:25 UTC, exported it at 05:17:11 and closed at 05:17:25 on 9 November 2026. PID 394390 is terminal (`Z`). Browser, console and HTTP error arrays are empty.

`prepare.mjs` copies only exact Git runtime blobs (`src`, `data`, `vendor`, `assets`, index/style, public and package), excluding unused overview/research/dev files. All 208 copied files (113.804 MiB) and all 105 actually served files match both their Git blob SHA and SHA256 before/after the run. The native `world.data` canonical JSON equals the exact archived dataset. `proof/source-manifest.json`, `served-files.json`, `preparation.json`, `launch.json`, `report.json` and `assessment.json` retain the actual sources, checks, tools and timestamps.

The raw export is retained at `/workspace/integration-qa-evidence/groz-support-6cb-native/native-support.json`: 50,584,720 bytes, SHA256 `a1dcca3b1a573028b7f659787b2c7db34dd874b0a28b6697d34593be6f417bb3`. `proof/native-support.json.gz` decompresses to those exact bytes. It includes:

- Complete native `data`, including all road/scenery/source/tram arrays, raw source tags and original node IDs.
- All 1,540 native road edges and 1,714 ribbons: full polygons, native node IDs/XY/Y, `e.road`, source/access IDs, raw roadInfo, width, direction, layer, bridge/tunnel, `ya/yb` and exact linear profiles. Native pad `hs` vertices are retained. Elevated ribbon boundaries have 44,907 samples, at most 0.5 m apart.
- All 164 passive road-deck colliders: complete polygons/holes, source tags, native bands/provenance and 11,272 boundary samples calling their actual `roofHeightAt`/`minHeightAt` at radii 0 and 1.2 m. All 2,574 polygon colliders are also inventoried, with vertical fields and function-presence flags.
- Native scenery/source profiles and all solved points/heights/covered pieces. Read-only recomputation matches the actual native scenery bridge stats exactly.
- Every source vertex and 19,461 centre/lateral station queries, at most 0.5 m apart and at offsets −1.2/0/+1.2 m, across the four bridge ways `w128304859`, `w660918286`, `w118416425`, `w205971103` and the four untagged approaches `w314447163`, `w118583391`, `w660918284`, `w660931074`. Every public `surfacesAt`/`walkTop` response and all containing ribbon/deck candidates remain available, including gaps and ambiguous levels. Full source coverage and unchanged modeled render pairs are distinguished.
- All 18 native water areas with actual rings/holes and complete water-channel stats. Dâmbovița/channel water at −4.4 m remains explicitly a model estimate.
- 99,315 exact contextual emitted road/ground/junction/solid/detail triangles within 25 m corridor bounding boxes, with native mesh transforms. These expose median/slab context separately; mesh names, culling or colors do not establish physical support.
- Full active/pool/pedestrian IDs (169/94/560) and the separately pinned raw `w902056192` footprint (13 original nodes, all tags, no cached parent relation). This source footprint has no native area, building or collider entry. Its absence is explicit; the polygon supplies no invented native height.

`proof/podul-grozavesti.png` and `basarab.png` are actual native High captures, both visually inspected. Only the survey camera changes after the support export; recorded camera transforms accompany both images. The river crossing/upper overpass and the long viaduct/approaches are visible. They document the current model, not photographic parity or rail movement.

Known export limits are retained in `assessment.json`. The optional `nativePopulation.trams` field filters only literal `kind === 'tram'`, so named tram variants are omitted; the empty list is not an actual tram count. Full native ID arrays are complete. Pad fan interpolation reconstructs the exact rendered `poly/hs` geometry and is labeled separately from public surface queries. Context triangles are geometry inventory regardless of current visibility. All road, passive-deck and water heights remain native model estimates, not surveyed elevations. No nearby road/layer winner, rail support, crossing right or smooth approach has been inferred.

US and the rail-grade lane received the stable raw dump for separate source-incidence, homologous-chainage and support analysis. No production files change in this proof commit. Earlier failed final15/weakref artifacts and the later bounded fountain-memory proof remain untouched.

To reproduce from this repository, choose two fresh output paths and run:

```sh
node handoffs/fidelity/tram-native-support-6cb/prepare.mjs /tmp/groz-support-source /tmp/groz-support-native
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node /tmp/groz-support-native/runner.cjs /tmp/groz-support-source /tmp/groz-support-native
```

The preparation command is cached-source only and refuses to overwrite an existing archive or output. Reproduction starts another browser and requires normal lane coordination; this handoff does not request another run.
