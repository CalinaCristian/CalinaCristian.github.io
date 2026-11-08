# Otopeni depressed approaches and entrance guide

Production **91326c6**, based on combined runtime b7b4642 (own merge 5129552). The focused source dataset is immutable **59f953f**, SHA-256 `a27a950b979d140769494499bd717ed1821c9ada461518611a12ac57e25d1ea1`. Final rebuilt all-eight source datasets still need integrated acceptance. Root owns README/spec consolidation and deployment.

The refreshed source exposed three physical road findings: a 0.27 m overlap step and 0.47 m corner gap on the tiny consecutive bends of service source `w217693983`, and a separate depressed tunnel approach `w1395443534` only 2.86 m beneath tertiary `w1469559180`. Both source service chains have their own dead ends and connect to source tunnel `w1395443535`; neither creates an at-grade junction with the tertiary.

The profile pass follows only already depressed degree-2 source continuations of a tunnel. Actual asphalt-footprint intersections constrain headroom below the separate ground road. Very short bends whose inner mitres fold gain real junction pads, with their local footprint flattened after all overhead caps are known. The existing trench carries the approach grade, bounded by the existing 8% limit; all seven changed nodes only lower (maximum 2.754938 m). A grade-infeasible solution is reverted. Source XY, road nodes, widths, lanes, directions and access are unchanged. Heights remain layer-based runtime estimates rather than surveyed elevations.

The fourth raw medium finding was the orange airport entrance square, not carriageway paint. Its two triangles, all float positions, vertex colours, material, layer and dimensions are unchanged. It is now one `poi-door-guides` mesh, owned by the existing POI scene group. This adds at most one draw per visible pass, potentially two with the true mirror. A real white carriageway-paint square at the identical position still triggers the original 0.53 m `marking-off-road` finding. No detector tolerance changed.

| Focused check | Before | After |
|---|---:|---:|
| Raw geometry high / medium / low | 4 / 5 / 125 | 4 / 1 / 126 |
| Newly added high or medium type/location records | — | 0 |
| Completed actual controller paths, no contacts | 6 | 6 |
| Largest bend frame height change | 0.037011 m | 0.000166 m |
| Previously clear footprint pairs retaining at least 5.2 m | 9 | 9 |
| Target approach / tertiary clearance | 2.86 m | 5.2 m |

The one remaining medium and four highs are unchanged source building-road records; this proof does not reclassify them. Two new low same-colour asphalt overlaps are retained. Six paths use actual `Player.update` at 60 Hz, retain static colliders and isolate moving actors: both directions on the depressed bend, tunnel approach and separate tertiary. The short bend paths reach 27.6 m; approach paths 22.6 m; tertiary paths 86.4 m. Raw trajectories include every 30th frame, all capped contacts and support edges. Twelve actual trench wall probes remain blocking in their height band and clear below, above and 1.5 m to the side.

The independent Grozăvești regression uses the earlier exact source 14c76c5: all ten actual controller routes complete with zero contacts, all 266 previously clear footprint pairs retain at least 5.2 m, and all seven wall probes keep their active and negative controls. Combined retained clearance controls total 275. The source audit finds zero missing whole ways or vertices, and no issues: 177 core roads / 172 source ways; 593 expected visible-ring ways / 3,403 required vertices. Dataset bytes match before/after. This does not establish complete source parity.

High quality, native true mirror, 1280×720 CSS and 0.5 pixel ratio: the focused after captures peak at 283 calls / 433,075 triangles including cold setup; steady complete frames peak at 196 calls. Counters are never reset within a complete frame. The camera poses intentionally sit on the depressed service roads and face their retaining walls; they document the native scene, while full path traces establish traversal. Software Chromium/SwiftShader supplies no physical hardware FPS or iPhone memory evidence.

`proof/` contains losslessly compressed raw before/after reports, source hashes, game-only captures, the 28 passing lane/passage/vehicle consumer tests and a hash manifest. `rejected/` retains the first turning-pad candidate, which still had a 0.29 m step because a later cap changed one end; it was rejected. A missing-module QA overlay is explicitly incomplete, with no passing runtime claim. One later guide extraction initially mapped objects through a typed array (zero-coerced values); the corrected extraction uses ordinary arrays, and exact raw triangle equality now passes.

```sh
node handoffs/fidelity/integration-otopeni-grade/run.cjs BEFORE_SNAPSHOT /tmp/otp-before --captures
node handoffs/fidelity/integration-otopeni-grade/run.cjs AFTER_SNAPSHOT /tmp/otp-after --captures
node handoffs/fidelity/integration-otopeni-grade/verify.cjs
```

Use the documented source snapshot: these focused road IDs belong to 59f953f. Final source mandatory foot+a, stationary evolving-population high/mirror soak, native UI and repeated-world mobile memory remain integration gates.
