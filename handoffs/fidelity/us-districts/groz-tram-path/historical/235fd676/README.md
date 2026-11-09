# Source tram runtime candidate — ground-path stage

Base runtime: `8ccab8b8f2e207aed8ceaca7fd6485590f1c7be7`. Required source metadata: `6cbf82b61de8267f662bf50239c37ccc1764635c`. Independent original source/off-track audit: `8ee6081d98bea46b45b265e94e67093d48c04b74`. Root owns integration, global docs and the shared elevated rail render/profile hook; this candidate edits only `traffic.js`, a new pure `tram-path.js`, and this proof directory. It does not edit the pure admission planner, motor graph, datasets, rendering, source coordinates, widths, fleet or actor counts.

The historic spawn loop still consumes its original RNG sequence and creates every original actor/mesh. Before initial admission, trams are rebound locally to actual source rail segments in their legal directions. The six Grozăvești corrections are5.06–8.34 m, fixing the measured off-track motor-carriageway assignments. Source graph nodes join only by literal OSM node ID; complete external source ways remain retained, while only unchanged rendered-run segments become active paths. Full native body coverage must remain within the district activity mask, and accepted placements/movement must pass the existing native static clearance function. Failed bindings remain explicit and force `initialAdmission.passed=false`; no actor is hidden, deleted or pooled to manufacture a pass.

The same source path supplies rail station spans, native long-body front/rear points, movement, continuation, out-of-view relocation/respawn and reservation segments. Source bends remain in reservation geometry. Actual shared rail/motor source nodes share physical reservation keys without adding motor routing edges or modifying motor node adjacency. Native physical vehicle/player/pedestrian guards remain in force. Rail recovery samples a source station instead of sliding along a turning body's chord.

Source-mode trams stop at actual tagged `railway=tram_stop` / `public_transport=stop_position` nodes. The five-second dwell remains an explicit gameplay estimate; old random spawn draws/fields are retained, but periodic invented stop locations are not used in source mode. Numeric source speed limits cap the existing11m/s gameplay maximum. At30Hz, the old unconditional .05m/s cutoff erased a tram's first .04m/s acceleration every tick; source-mode trams now retain that positive acceleration while ordinary traffic keeps its existing cutoff.

## Explicit grade boundary

This stage uses the existing **unsurveyed flat local ground datum**. Tagged bridge/tunnel/nonzero-layer and numeric elevation/incline cases are retained as unresolved until a justified profile is supplied. Source-connected height/coordinate conflicts cannot become usable joins. The four metadata graphs currently contain:

| District | Modeled source segments | Ground admitted | Unresolved grade segments |
| --- | ---: | ---: | ---: |
| Grozăvești | 211 | 157 | 54 |
| Pipera | 49 | 49 | 0 |
| Romană | 33 | 26 | 7 |
| Unirii | 45 | 45 | 0 |

Grozăvești bridge sources128304859/660918286 and118416425/205971103, and Romană tunnel sources241374326/920117619 remain explicit. A full body stops before such a leaf; existing out-of-view recovery can use another legal source station. This is not complete elevated transit or whole-world acceptance. The exported `nativeTramGradeResolver` is an **unhooked containment prototype**, tested as a relative modeled deck constraint. It is not used to elevate bodies over the current flat rendered rails. Root's separate source-supported bridge grade/render work is required before enabling those legs. Layer/level values are never converted into metres.

## Verification in this commit

- 13 pure source-path controls: legal direction, no nearby-node joins, full short-leg/body traversal, exact bend reservations, source speed, complete/missing geometry, modeled boundary leaves, source-node physical binding, explicit unresolved and compatible/incompatible modeled grade controls.
- Actual `Traffic.bindSourceTrams`, `placeOnLane`, `pathPoint`, `ensureRoute` and `advance` on the immutable263-actor Groz fixture: all263 object identities and six tram mesh identities retained; correct directed tracks; source positions/forward movement; whole bodies inside the bare native activity mask; motor source graph unchanged; zero Traffic RNG calls during binding. **Static collider set is deliberately empty in this CPU fixture**, so it is not native static acceptance.
- Actual `Traffic.stepVehicle` isolated40-second CPU fixture: starts at .04m/s, serves a mapped stop for150ticks/~5s, resumes and stops with its whole body before the source leaf (maximum front99.601m on a100m path). No lateral source error. This fixture has no peer/static population and does not establish full-scene traffic behavior.
- Actual native reservation methods: an older tram claim blocks a conflicting motor car; an older motor claim blocks the tram; empty reservations admit the legal path. Exact source identity shares the physical key; original motor adjacency remains intact. Signal timing and the full scene remain separate gates.

Run from repository root:

```sh
node handoffs/fidelity/us-districts/groz-tram-path/test-tram-path.mjs
node handoffs/fidelity/us-districts/groz-tram-path/test-native-binding.mjs /workspace/reality-pass/remaining-ro/admission-fixture-groz-c2acc8d/fixture.json /workspace/fidelity-workers/tram-source-metadata/game/data/bucharest-grozavesti.json /tmp/groz-source-binding.json
node handoffs/fidelity/us-districts/groz-tram-path/test-native-motion.mjs
node handoffs/fidelity/us-districts/groz-tram-path/test-native-crossing.mjs
```

Full native static/source/interactions, first-publication body audit, real tram approaches/crossings and final integrated acceptance remain pending. No browser was opened by this candidate's CPU tests. QA's separate read-only bridge-support export does not count as motion acceptance. All previous raw failures and source/capture histories remain intact.
