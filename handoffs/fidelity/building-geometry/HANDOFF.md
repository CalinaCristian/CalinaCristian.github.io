# Building geometry handoff

Code/data commit: `2e6fef77b4635fb0042a9f66c053ccd603e87518`, branch `fidelity/building-geometry`, base `7349ab4`. No pushes. This handoff, the explicit world-spawn camera addition and defensive guards for incomplete cache objects are a following commit. The latter only reject malformed caches and do not change valid-cache geometry.

## Result and scope

Source assembly reconstruction removes duplicate aggregate/part facades without changing the source records or making holes in their required ground envelope. The final Romană data contains 5,552 records: every original record/identity multiplicity, plus 792 explicitly mapped low/small parts previously filtered out. There are 900 mapped parts in total. Source heights/minima are retained, including 39.25 m and 0.01 m values that cannot fit the legacy decimetre header.

38 uniquely associated assemblies use 569 source parts. Complete assemblies replace the duplicate aggregate body with the source parts and every residual strip. Partial assemblies retain the full original body and union only interior surfaces. Floor-derived parent heights are not measurements; explicit parent metre heights remain source records and determine unresolved residual envelopes. For near-exact complete raw coverage, tiny preparation residuals use their nearest ground part's height, recorded separately from the parent height.

The full source sets improve the original five/three-part D5/H6 investigation:

| Outline | Retained source parts | Raw union coverage | Raw outside area |
|---|---:|---:|---:|
| D5 `w180556785` | 7 | 100% | 0.074097 m² |
| H6 `w236091148` | 4 | 100% | 0 m² |
| Tower Center `w156797704` | 19 | 100% | 0 m² |
| Țiriac `w967066303` | 88 | 99.999258% | 0.038201 m² |

Associations require one enclosing raw-source simple outline; each part's outside tolerance is at most 0.1 m² and the raw bounding box tolerance is 1 mm. The regression independently reprojects the XML and verifies every accepted unique association. Prepared coordinates are not used to invent parent relationships.

Physical visibility is a separate pass. Neighboring solids can share a face while having ambiguous source association. A local union cache removes those interior/copied surfaces without merging source identities or removing volumes. This fixes an additional reproduction at `w1001017513` / `w1494002952` and the aggregate/low-parts overlap at Consiliul Municipal al Elevilor `w1526701230`. Each of 4,419 cached surfaces validates its own source and direct neighbors; a changed neighbor cannot invalidate a whole connected block. Invalid caches retain source bodies and report explicit reasons. Runtime performs linear identity checks, never costly planar reconstruction.

All cap/residual mesh vertices use a lossless shared table: 46,052 points. This reduced the intermediate 16.5 MB cache to 7,721,750 bytes (zlib level9: 1,878,458 bytes), without rounding source/cut coordinates. Source records and their audits remain independently readable.

Roof changes validate every inset strip, retain convex-only fan/special-quad paths, support long concave outlines, and provide a watertight lifted-triangulation fallback when no inset works. Mansards use validated insets. Roof props require their full footprint to clear concave edges/courtyards. Native mapped pitched part roof classes are preserved instead of being flattened by the assembly path.

Road/collision checks respect actual vertical bands and courtyard holes. An elevated mapped passage is not shrunk against a ground-level road. Elevated tiers begin at the exact source minimum, removing the artificial 0.18 m air seam. The non-wall collision guard keeps a walking body below a sufficiently high source minimum. Existing source footprint/courtyard records remain unchanged.

Two preparation defects were corrected: `w182932596` has the same prepared corner positions in a simple boundary order (old signed area127.21→130.07 m²; no shrinking), and `w1520043705` uses a sparse precise ring where decimetre quantization folded a tiny notch.

## Verification

Private evidence root: `/workspace/reality-pass/romana/geometry-goal/`. Reference imagery and screenshots are not in git. No Street View assets/data were extracted; the reference pairs use the supplied private Esri/Maxar/Earthstar mosaic. Its metadata does not supply imagery dates. Tall-building aerial parallax is visible; these images do not establish measured roof-profile parity.

- `final-source-regression.json`: all source identities/multiplicities retained; all 4,652 original non-part records have exact semantic headers/courtyards and exact footprints apart from the corner-order repair; 884 literal part metre heights and 489 minima checked against 16 XML tiles; all 38 unique raw-source associations; all 4,419 local surface caches; all 1,925 pitched/mansard source rings have positive, complete inset strips. Roads, nodes, flags, trees, areas, scenery, parking, green and backdrop remain exact after resolving shifted string indices.
- `final-building-audit.json`: 654/654 inside and 1,843/1,843 ring buildings≥40 m² matched; tagged heights 223/223 and 480/480; source relation identities 5/5 and 14/14; courtyards 5/5 and 11/11. Aerial class residuals 3 inside + 4 ring remain, as before.
- `final-gate/runtime.json`: **45 actual-data target poses ×3 jitters: zero detector blocks**; all 38 assemblies and 4,419 physical surfaces applied, zero cache rejections/page errors; devCheck blocked 0/deadEnds 0. **15 high-quality traffic/pedestrian/mirror frames: max 1,216,429 triangles / 345 calls.** Whole-world geometry 2,673,018 triangles is not the per-frame count.
- `final-proof/`: five expanded reproduction targets, each near +eight ground-up angles, each with 1/2/3 mm jitter: **135 checks, all zero**. Beauty/topdown/oblique/ground-up files include Tower Center and Țiriac. Useful open tower views: `w156797704-ground-up-angle-4.png`, `-7.png`; `w967066303-ground-up-angle-2.png`, `-3.png`.
- `final-roof-facade-images/`: current D5/H6 and six roof candidates; all jitter 0. `baseline-final-poses/` retains identical original target poses: D5[5,5,1], H6[25,23,22], Medident[3,3,3], BRD[19,0,0]. `baseline-tower-angles/` retains raw additional original tower detections. Early failing extra reproductions and the ray/source evidence are preserved in `final-complete-sweep/`, `final-tower-angles/`, `tower-angle-ray-evidence.json`, `other-assembly-ray-evidence.json`; they were not suppressed.
- `source-comparisons/`: 11 private north-up square aerial/game pairs, source/provider/pose index in `camera-source-index.json`. High-rise aerial displacement and missing imagery dates are explicit.
- `final-world-spawn/`: actual `world.spawn` and chapter spawn both equal x 636.548168, z 710.937750, heading 0.337140; camera y 2.04, same-heading forward/up and right-up, pitch0/.65. These are the worker's baseline landmarks, not root's staged Ambasador repair. Root must retake the combined tree. The prior chapter-only frames happened to have the same coordinates; the explicit world-source check removes that ambiguity.
- Module syntax and `git diff --check` pass; nine courtyard collision checks pass. Mandatory `foot,a` returned 0 high/0 medium (one software-GL FPS low). A final exact-commit rerun is recorded under `logic-final/`.

Reproduction commands:

```sh
node tools/osm/building-geometry-check.mjs --baseline --osm=/workspace/reality-pass/romana/tiles --out=/tmp/source-regression.json
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node tools/osm/building-geometry-browser.cjs --targets=assemblies --checks-only --out=/tmp/geometry-gate
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node tools/osm/building-geometry-browser.cjs --targets=w156797704,w967066303,w1526701230 --angles --quick --out=/tmp/tower-proof
node --test game/dev/harness/courtyard-check.mjs
```

## Genuine limits / acceptance followups

1. **Native roof profile parity is still incomplete.** Native pitched roofs preserve source classes and closed geometry, but use inferred rise rather than `roof:height`, angle and direction. The existing renderer treats `h` as eaves; for explicitly dimensioned pitched parts this can place the peak above the tagged height (CME height 9 / roof:height 3 is a concrete example). Narrow concave insets can also yield very low inferred rise. No claim is made that those complete 3D profiles match measurements. This requires a separate source roof-profile/schema/rendering pass, including intersections between mapped roof parts; do not mark strict measured 3D parity complete.
2. Existing runtime adjustment `w243836145` remains: source area1,352.305→runtime1,047.224992 m². The new audit exposes it; it is not used to fix these duplicates. The inherited broad shrinking fallback is not eliminated district-wide.
3. Cache/topology tests cover simple source solids; mapped courtyard bodies retain their existing hole-aware path. They are not flattened/filled to enter a union cache. Complex pitched courtyard roofs remain a separate source-model limitation.
4. Build times in concurrent software-GL workers varied widely: final gate 10.27 s, final proof 10.70 s, one targeted earlier source probe 3.84 s. The accidental runtime-subdivision path took76 s and was removed. These runs do **not** establish the<4 s desktop load goal or hardware FPS. Profile a quiet combined build on real target hardware; frame budgets are verified here.
5. The direct `7349ab4` baseline has the same `not-asphalt` flag at the same sample; baseline frame max is 1,156,942 triangles /345 calls (`baseline-traffic/runtime.json`). Final traffic output retains `not-asphalt` at Iancu de Hunedoara sweep sample 7, x 67.5, z −469.7, with zfight 0 and 987,189 tris/ 236 calls. Raw output and the direct baseline are retained. It is not introduced by this change. Do not silently discard it or claim a geometric road collision: devCheck reports no blocked road there.
6. This worker's source snapshots do not include root's Ambasador/ASE/Dinamo or other workers' changes. Root owns combined source/landmark clearance, source collider polygon propagation, time/weather, traffic and all remaining district waves.

## Exact integration requests for root-owned contracts

- Document optional `buildingAssemblies[index]`: `mode`=`parts` (complete source reconstruction) or `union` (retain partial aggregate body), unique `parts`, raw/prepared coverage, raw outside area, separately described residual height/source, source identity plus baked surface/residual geometry. Source records remain in place; associations route to a suitable source ground part/primary body. No floor count is a measured height.
- Document sparse `buildingDimensions[index]=[heightM,minHeightM]` and `buildingFootprints[index]=[[x,z],…]`; absent fields retain legacy decimetre data behavior.
- Document `buildingUnions={sources:[{i,signature}],surfaces:[{i,neighbours,surface}]}` as physical surface visibility only, never source parent association. Surface caps/residual rings index `buildingGeometryPoints`; this is a lossless derived-mesh table, not replacement source footprints. Cache validation failures preserve source bodies and expose reasons in world stats.
- Preserve both root's non-wall h/y0/y1 collision band guard and this commit's `minH > bodyFeet+2` passage guard. Keep the wall-specific guard independent.
- This branch changes only `buildingIndex(r[6],x,z)` routing in the POI loop and vacant-sign call sites near the location-audit owner's edits. Keep coordinate routing while integrating their CV/fuel/pavilion deletions. No parking, traffic-signal or landmark-propagation ownership was changed here.
- Add relevant README/spec/status notes centrally; this worker was explicitly instructed not to edit global docs/status. No new attribution is required beyond existing OSM/aerial sources; no reference imagery is committed.
