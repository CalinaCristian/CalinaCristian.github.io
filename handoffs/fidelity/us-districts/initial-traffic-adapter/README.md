# Native initial traffic adapter, before first publication

This commit adds only `game/src/initial-traffic-admission.js`, focused CPU controls/proof and a constructor-count documentation correction. It does not edit/import a hook in traffic.js/main.js and does not start another browser. Root owns constructor hook/README/spec integration; RO owns moving peer logic; QA independently checks all active/pool bodies at attach and first publication.

Minimal root integration, immediately after existing `this.spawnAll()` and before base/Pedestrians:

```js
import { admitInitialTraffic } from './initial-traffic-admission.js';
// Traffic constructor, after this.spawnAll():
this.initialAdmission = admitInitialTraffic(this);
```

Inspect `initialAdmission.passed`, all unresolved/unknown/invalid records and full native gates before release. Nothing is hidden, pooled, deleted or assigned a fabricated fallback when a legal placement cannot be found. Native d981 constructs484 actors first; later rush rebalance adds140, yielding624 before attach. The constructor hook cannot by itself certify those later admissions. No additional hook/live re-admission is authorized by this module.

`admitInitialTraffic(T,options)` refuses any call after physical time/frame advancement. It uses the pure planner from9454f95c, with exact isolated `T.placeOnLane(clone,true,0)` previews. Candidate route/history arrays and no-draw mesh stubs are separate; live actors/mesh states and fleet RNG remain untouched during search. Actual native laneTarget/pathPoint/sSpan determines source pose and ramp pitch. Ordinary cars use whole-body endpoint containment, replacing only the unmeasured4m centre buffer. Transit uses native long sSpan/pathPoint and may span existing connected source legs; its centre remains on the original edge/dir/lane. Parked/service actors stay fixed; conflicting movable peers may yield. Unresolved cases remain explicit.

Source/access/direction/lane and native SharedLaneGate.canPlace validate candidates against the entire planned body set. Every accepted candidate's full horizontal native body rectangle is covered by circumscribed discs over cells≤0.75m, with actual emitted model vertical range. The adapter queries the native collider set and calls unchanged collideBuildings for actual intersecting collider bands, including roofs/passages and walls above the foot. This conservatively extends slightly outside each rectangle cell; it never leaves gaps or samples only the centre. An exact native roadDeck support roof under the ground anchor follows the existing support rule; intrusions from below remain blocked. Other mapped fences/posts/decks/solids remain active. Collider records/geometry are not altered.

Optional existing pedestrians are checked with the native0.3m body disc. Without explicit pedestrian vertical intervals, overlapping XY candidates are conservatively rejected even across grades; unknown height is not excused by an invented2.5m rule. This is a truthful conservative restriction if root ever authorizes a separate pre-publication call after pedestrian creation; no such extra call is added here.

Apply changes only through each original vehicle's station and native placeOnLane, then rebuild the actual grid. Derived candidate pitch/roll/height intervals are never copied onto live vehicles, so future native road rotations remain authoritative. Vehicle/pool arrays, every vehicle/mesh/source assignment/kind/dimension and RNG draw sequence are retained. Summary returns applied updates, initial/planned/actual unresolved pairs, invalid/unknown heights, rejection reasons, identity/exact-pose checks and static query counts. It validates changed candidates against statics; untouched historical static contacts are not certified by the summary.

## Focused CPU result

`adapter-check.json`:13controls pass, with actual pinned d981 Traffic.placeOnLane/sSpan/pathPoint and emitted vehicle models. Exact four-body constructor fixture uses its captured straight-lane offsets, calibrated only in the fixture's laneTarget; production adapter calls the complete real native method. Accepted two-pair shifts423−4.25m/461+2.25m are applied exactly, with all actors/arrays/meshes/source IDs/route/history preserved, zero native/global RNG, no stale pitch fields and one final grid rebuild. The whole-body cover is checked over a dense rectangle interior/edge/corner lattice. Tests include actual thin corner post, head/slab intersection, high/low wall/prop clearance, deck support versus intrusion, source/shared-lane rejection, unknown optional pedestrian contact, live-time refusal and the actual spatial-query interface.

A synthetic complete connected-leg fixture uses native long bus placement and49candidate stations, including body extents outside its13m centre edge. It verifies preserved connected-leg semantics, not repair of the three real tunnel pairs. Full actual484constructor/all624first-publication gates across all8districts remain required. No new native all-scene pass or whole-world fidelity claim is made.

`first-fixture-failure.log` is retained: the shared-lane rejection fixture initially omitted its direction vectors, so source validation rejected earlier than its expected shared-lane reason. The corrected fixture supplies those vectors; adapter code was unchanged for that correction. `first12-success.*` preserves the earlier successful control set, separately from the final13. `collision-source-equivalence.json` verifies the complete underlying collideOne/collideBuildings source tail is byte-identical between the owned module base and pinned d981.

```sh
node handoffs/fidelity/us-districts/initial-traffic-adapter/adapter-check.mjs \
  --native-root=/path/to/exact/source-d981eee7 --out=/tmp/new-adapter-check.json
```

No reference imagery, data deletion, population thinning, RNG resampling, new graph join, source/lane reassignment or runtime warp is introduced. The native observer at ../start-admission-d981eee7/ remains immutable; its documents now distinguish484constructor actors from624later public actors.
