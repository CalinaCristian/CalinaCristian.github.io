# Initial native vehicle admission: d981 causal proof and unhooked helper

Actual observed source `d981eee75d254faf7efd993bba18c9b4226db4e7`, exact reused immutable archive `/workspace/reality-pass/combined-native-budget/source-d981eee7`. This lane made no production-source edits in that archive, no extra source clone, no traffic.js/main.js edits and no reference-image requests. The one browser is closed. The new helper in this commit is **not imported or applied to production**; its full-scene native acceptance is pending root/RO integration.

## Causal result

Both original surface pairs are real drawn-body overlaps on native y0.24m/layer0, present in Traffic.spawnAll before any player placement, setPlayer, either clearForPlayer or first render:

| Pair | Exact mapped source edges | Initial body SAT penetration |
| --- | --- | ---: |
| hatch229 / estate423 |157w665204215 and124w153967352, node31404739|3.090759046m|
| hatch323 / hatch461 |129w217748475 and103w4276104, node2270491981|1.211441124m|

The later body's first spawn→placeOnLane introduces each overlap. Constructor free() keys its occupied map only by edge:dir:lane; accepted plans call spawn(), which does not call global body spawnClear. Different legal edges meeting the same actual node therefore admit intersecting cars. Actual drawn-heading and cached lane-axis SAT are identical for these two starting pairs, ruling out a heading mismatch here. Grid.items is null during construction; after admission both IDs occupy their correct current grid buckets and queries include their peers. Stale cell membership does not introduce these initial pairs.

The added loadCity player-clear and the existing enterRoam clear both leave these four native poses/penetrations unchanged. Main's changed order is not the origin of these two pairs. The one read-only replay matches the original native Unirii rush/clear/summer/high start, original spawn coordinates,624vehicles/560pedestrians, and the original H.run(.5) scheduling. It reproduces the original two medium warnings at scenario t0.4 with2.93m/1.01m penetration. H.run(.5) actually executes16updates/.5333333333s because of its floating interval; raw step count is authoritative. The producer's scope string saying15 is retained as authored, corrected here; this is not a user-facing product bug. No page, console or HTTP errors, and all13bound native source inputs remain unchanged after run.

`native-observation-report.json` preserves all385call-through observations,29constructor/load-phase snapshots, actual headings/meshes/source IDs/heights and bucket chains, observer/source/served-file hashes, failures and browser closure. `causal-summary.json` provides a compact index. `original-findings.json` retains the original two pair warnings, pedestrian lane blockage, compact87 blockage and failed two-reset drive with original raw report path/hash. Diagnosing constructor admission does not clear the later NPC/drive failures.

RO3ca's traffic/nav/vehicle/cities/shared-lane/access/data bytes match d981 (see `source-comparison.json`); main/world diffs are retained. Historical clean route reports did not certify constructor admission: the source-bound `observe-combined-native.cjs` captured issues0 **after** its .5s warm-up, then published H.issues.slice(issues0). It also used explicit per-condition lanePose/P.place/setPlayer/clear. Startup t0.4 warnings were outside that saved drive interval. `historical-observer-scope.json` records exact source excerpts and hash; original reports remain unchanged.

## Pure helper contract

`game/src/initial-vehicle-admission.js` exports:

- `vehicleVerticalInterval(v)`: actual primary emitted model vertices (`mesh.userData._model.geo`) under native YXZ pitch/roll/scale plus native worldy. Geometry/pitch ranges are cached. Explicit externally derived native intervals are supported. Missing geometry can use explicitly reported unpitched model-height metadata; unsupported/unknown height remains observable. Native traffic parent groups are identity; nonidentity parent transforms require the caller's explicit interval/callback. QA's independent composed-parent audit remains required.
- `vehicleBodyPenetration(a,b)`: native length/width body rectangles with actual drawn heading, never stale road fx/fz. Mirrors/lights outside horizontal body dimensions are not a triangle-intersection claim.
- `initialVehicleConflict(a,b,{clearanceM,interval})`: body SAT plus actual vertical intersection, without ordinal-layer or generic2.5m height exemption. Unknown heights stay conservative/observable.
- `ordinaryVehicleStations(v,{spacingM:.25,endMarginM:.05,maxCandidates:256})`: nearest-first deterministic stations with the entire ordinary car inside its unchanged mapped edge. The unmeasured4m centre buffer is replaced only by actual body containment. Bus/tram/long bodies get no ordinary-car station restriction or fabricated path.
- `planInitialVehicleAdmission(vehicles,{candidates,validateCandidate,canAdjust?,interval?,clearanceM:.05,maxCandidatesPerVehicle:256,maxPasses:2})`: returns an **unapplied plan** with `updates[{vehicle(original reference),pose,previous}]`, `bodies`, `initialConflicts`, `unresolved`, `unknownHeights`, `invalidBodies`, `attempts`, `passed`, `originalIds`, `rngDraws:0` and `applied:false`.

The caller must provide exact native snapped candidates and validate source legality, full-body static clearance, shared-lane/transit reservations. Planner candidates cannot replace source edge/dir/lane, ID, kind or length/width. It never consumes RNG, mutates input poses/meshes/arrays or drops/pools actors. Later ordinary bodies are tried first; constrained later transit can cause its earlier flexible peer to move. Default canAdjust allows ordinary cars only; the caller may enable transit and supply its existing native connected-leg/sSpan semantics. Long bodies may span connected mapped legs; no blanket one-edge body containment is imposed on them. If no source-legal candidate exists, the real conflict remains unresolved.

Root/RO owns the minimal integration:

```js
import { planInitialVehicleAdmission, ordinaryVehicleStations,
         vehicleVerticalInterval } from './initial-vehicle-admission.js';
// Traffic constructor, immediately after this.spawnAll():
// Build a plan using exact native pose + source/static/shared-lane callbacks.
// Apply only accepted native stations/poses before base/Pedestrians/first draw.
// Rebuild the actual vehicle grid after applying; retain the full audit result.
```

The adapter is intentionally not invented here. Preview native placement on isolated candidate state, preserving original route/history/mesh/RNG; do not mutate live geometry while searching or copy derived static intervals into moving vehicles indefinitely. Apply the accepted plan through normal native placement once, then rebuild grid. Root owns README/spec/runtime-hook updates when this becomes an active feature.

## Focused checks and pending full-scene gates

`admission-check.json`:11meaningful CPU controls pass. The exact four constructor bodies use source-bound native emitted hatch/estate geometry. Same-source-edge full-body-contained candidates move estate423−4.25m to station10.96136056 and hatch461+2.25m to6.933910066; each remains on its existing lane/dir/height/source, with negative final pair penetration. Full fleet identity/mesh/input snapshots and zero RNG use are verified. Repeated plans are identical. Static/reservation rejection, impossible placement, invalid body data and unknown height remain failed/unresolved without dropping IDs; ordinal layers do not hide real height intersections, different physical decks clear; drawn heading and actual pitched vertex heights are tested. A constrained later long body can keep its mapped-leg pose while the earlier flexible peer moves. The first10-control success is separately retained with its original helper/producer hashes.

Actual hatch geometry has localY−0.0649999976..1.5199999809, exceeding its declared1.46m height; the accessor uses geometry. Native horizontal body width/length remain1.79/4.28m, distinct from mirrors outside that body rectangle.

**This is not a full624/static-world repair pass.** The candidate validator in the pair fixture checks exact straight-source whole-body endpoint bounds; separate rejection controls exercise its static/reservation contract, not the actual whole-world collider tree. RO independently found three additional real tunnel constructor pairs at y−5.76m on w241368617:40bus/266crossover(edges32/33),61bus/366bus(998/997),155bus/315bus(987/988). Both-bus cases need exact existing transit source-leg candidates and full-scene proof. No actor thinning, new RNG, blanket collider/traffic exemption, source joining or graph invention is authorized by these tests. Root/RO owns that integration; QA will audit every active/pool ID and actual-height OBB at constructor/attach/first publication across final loads.

Reproduce the focused CPU controls, without another browser:

```sh
node handoffs/fidelity/us-districts/start-admission-d981eee7/admission-check.mjs \
  --native-root=/path/to/exact/source-d981eee7 --out=/tmp/new-admission-result.json
```

The browser observer command is recorded in the tool usage header; preserve earlier output directories and coordinate the shared browser slot before any authorized replay. Native scene/capture/source gaps remain explicit. No full parity or combined release pass is asserted.


## Constructor-count correction and adapter continuation

Subsequent inspection distinguishes **484 actors immediately after spawnAll** from **624 before attach/first publication**. The later140 rush actors are added through rebalance→spawn→placeInHot→spawnClear. The full captured native start remains624/560, and the raw per-phase counts in native-observation-report.json are authoritative. Earlier informal text calling the constructor gate a full624 gate was imprecise. Initial adapter hook is after spawnAll (484 identities); the independent first-publication gate must separately cover all624. No second runtime/live admission is implied. New unhooked native adapter and focused controls are separately recorded under ../initial-traffic-adapter/.
