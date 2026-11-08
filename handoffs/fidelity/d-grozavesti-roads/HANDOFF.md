# Grozăvești road approach correction

Production commit: **57986a65bac7a86268b3678d6d0cd40d9fe5c746** (`game/src/world.js` only), on `fidelity/grozavesti-roads`.
Dependency/source baseline: **10d9b98b9e8020ff8791de5466d4565824d876da**. Source JSON is byte-identical before/after.
The source worker separately owns canopies, rail, vegetation and detector minimum-height/holes/noAudit fixes. Those fixes are **not** included in this standalone road measurement.

The unnamed OSM bridge approach was held at ground until the `bridge=yes` tag began. The correction follows an unchanged unnamed carriageway through plain degree-two nodes (same highway, direction, lane counts and near-parallel heading), stopping at a named street, carriageway change or 300 m limit. The existing grade cones spread the climb. Higher-layer decks cap the approach with the same grade constraint, including the outer pavement edges. An elevated sidewalk's back apron uses its retaining face where its plan would project over another carriageway. No source width, footprint, guard collider, closure or building was removed.

## Physical and picture checks

| Location | Before separation above Orhideelor | After |
|---|---:|---:|
| 44.445235, 26.061605 (#53; x191.2/z−448.4) | 0.434 m | 6.234 m |
| 44.445382, 26.061677 (#54; x196.8/z−464.7) | 1.771 m | 7.571 m |

Both ground surfaces remain 0.24 m. Exact convex intersections of the affected approach/ramp and the upper viaduct have **at least 5.2 m** separation at every intersection vertex. `profile.gradeResidual` remains zero (≤8%); these remain source-layer/convention estimates, **not surveyed elevations**. OSM ways `84477811` (approach) and `128304850` (bridge, layer 2) have no width/lanes tag. Independent Esri review supports retaining the existing divided-carriageway estimate; it did not justify narrowing the road. No Street View data was extracted.

The [before](images/before-under-target54.png) and [after](images/after-under-target54.png) ground-road pictures show the low concrete slab removed from the driven view. The [side](images/after-side-target53.png) and [ramp](images/after-ramp-target54.png) pictures retain the ramp and guard geometry. Ground before/after camera plan/heading is identical; the before compositor screenshot is 1280×720 and the after native renderer capture is 640×360, with the same 1280×720 CSS viewport / 0.5 pixel ratio. These diagnostic pictures use summer/day/clear; the full survey retains its original automatic season.

Actual `Player.update` trajectories keep all static world colliders and isolate moving traffic. Both ramp lanes complete **318.2 m**, ground Orhideelor **189.2 m**, upper Basarab **279.0 m**, and both northern legal approaches **81.0 m** each. All six after trajectories have zero static contacts, maximum lateral deviation <0.5 m and maximum frame height change **0.0193 m** at 60 Hz. Before, the inner ramp brushes the ground road's separation barrier near x186.1/z−449.1/y0.59. Guard probes on both sides still block within their height bands, and reject bodies underneath, above and 1.5 m to the side. Full trajectories and positive/negative probes are in `proof/{before,after}/`.

**#138 is retained and classified, not “fixed” by deleting geometry.** The path at 44.452139/26.071926 is virtual SCC connector edge 992 between two map-end nodes. It crosses the real retaining wall and both deliberate closure barriers. Both legal approaches pass unchanged. `proof/*/walls.json` retains the virtual endpoints, closure bands and guard counterexamples; the [northern legal view](images/after-north-legal.png) preserves the road-end context.

## Full raw QA and performance

The full immutable after survey is **92 samples** (40 UPB, 45 Basarab, 7 Splai), high quality, full mirror, street vehicles/crowd every 200 m, no page errors. All **43 contact sheets** were inspected in the eight review montages in `images/`, together with the larger target pictures. The exact inventory and image hashes are `proof/sheet-review-inventory.json`. This inspection does not establish complete reality parity.

| Measurement | 10d9b98 before | 57986a6 after |
|---|---:|---:|
| Raw high / medium / low | **9 / 16 / 124** | **7 / 13 / 124** |
| World maximum triangles | 984,811 | 985,409 |
| World maximum draw calls | 313 | 313 |
| Traffic + mirror maximum triangles | 1,119,059 | 1,117,343 |
| Traffic + mirror maximum draw calls | 378 | 378 |

The separate warmed target check at x196.8/z−464.7 keeps traffic and pedestrians visible, advances 900 traffic steps (30 simulated seconds) after each immutable load, warms three rendered frames, and records three stable full-mirror frames: **947,315 triangles / 274 calls before**, **959,389 / 269 after**. The exact render/traffic history and pictures are retained in `proof/warm-traffic-comparison.json` and `images/*-warm-traffic.png`; traffic placements are observed states, not an identical-placement guarantee.

Triangle and draw-call maxima can be different poses. All sampled frames remain below **1.5 M triangles / 400 calls**. The baseline table and all 25 baseline high/medium records come from the source worker's published evidence commit **15a03f99084da4b14c71b5bea955bbb6a7eced3c**, with the original raw-report hash retained. The complete after raw report and route perf rows are committed here. Baseline low-location comparison awaits its portable raw report; no unchanged-low-location claim is made from the equal low totals.

The five removed high/medium records are the two high target stacks, the medium stack at x205.8/z−488, the sidewalk projection at x200.4/z−479.4 and the buried marking at x190.3/z−444.6. **No high/medium type/location finding is added.** `proof/full-visual-comparison.json` preserves every removed record, before/after counts and exact perf rows. Raw reports are not clean and have not been re-labelled to claim success.

Remaining high records include the inherited Bretea/viaduct 19.2 m² / 0.25 m overlap at x437.8/z−749.3 and the inherited nine-block flicker at x85.9/z20. Four other high records are the source worker's separately diagnosed action-pin/canopy detector issues (two explicit `noAudit` fuel UI pins and two mapped 4.8 m-clearance canopy overlaps); their raw records remain in this road-only report. The virtual-route #138 also remains. The other inherited medium/low records, source-unknown dimensions, complex profiles and all source preservation issues remain open for their owning/integration work.

Mandatory `foot,a` on the immutable after snapshot: **0 high / 0 medium / 2 low**, both scenarios complete. The low notes are software-GL FPS and traffic update timing; `proof/logic-after.{md,json}` retains them. Static audit still reports four fuel furniture and one canopy building entry belonging to the source/forecourt work; no claim of a globally clean audit is made. Wall/cliff audit counts remain zero.

## Reproduce

The scripts are local QA, with no production hooks. Source road indices are tied to the frozen source snapshot above.

```sh
node handoffs/fidelity/d-grozavesti-roads/verify.cjs
node handoffs/fidelity/d-grozavesti-roads/run-targeted.cjs /path/to/10d9b98-snapshot /tmp/groz-before --captures
node handoffs/fidelity/d-grozavesti-roads/run-targeted.cjs /path/to/57986a6-snapshot /tmp/groz-after --captures
node handoffs/fidelity/d-grozavesti-roads/verify.cjs /tmp/groz-before /tmp/groz-after
npm run harness:visual -- --city=bucharest --district=grozavesti --viewports=none --quality=high --traffic-every=200 --jobs=1 --root=/path/to/57986a6-snapshot --out=/tmp/groz-full
```

Run mandatory `foot,a` from the immutable snapshot itself: the logic harness has no `--root` flag. `CHROMIUM_PATH` can select the browser for the targeted runner; it uses `/usr/bin/chromium` when available and always mutes audio. No imagery from reference providers is committed here. Failed/premature custom queries during a snapshot reload and blank asynchronous canvas reads were discarded; only post-readiness probes and valid inspected game images are retained.

The root orchestrator owns current-master integration and branch cleanup. This branch deliberately retains its assigned dependency base; production, source data, render-budget and detector work must be integrated and rechecked together. The handoff does not authorize or claim deployment.
