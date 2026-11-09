# Mapped turn lanes and the native 2/423 knot

The native `46211271218d6d6b170cb821ec11518ed47a9213` run contains a real moving-traffic failure: hatch 2 and estate 423 remain in positive contact for 727 physical samples, 5.9–30.2667 seconds, then the drive resets. Penetration is 0.003737–0.049923 m. These are contacts; the ordinary 0.05 m guard tolerance does not make them globally clear. Joining recorded proposed hatch steps to final physical frames finds 309 accepted, 40 exact reversions and 31 later corrections while the pair remains in contact. Current odometer/lateral extras and estate proposed steps were not captured.

The actual source approach is road 33, `w153967352`, `turn:lanes=left|left|left;through|right`. Its prepared terminal is node 139 and its original terminal is OSM node 31404739. Intermediate node 148 is not that terminal. Hatch 2 starts in lane 1 but its former route turns right/west via 157 in direction −1. Estate 423 starts in lane 3 but its former route turns left/east via 142 in direction +1. Both begin inside the junction and have no claim in its recorded reservations. The lane-count lookahead additionally pulled the opposing turns toward lanes 0 and 2. This change addresses the source-lane error; it does not seed reservations for invalid movements.

The runtime change, based on `f320b747436ad98d6ac6624ce587d5666178e4df`, reads the existing source turn-lane table at the actual way exit. It filters route choices using the actual or projected entry lane, including future route legs and lane changes before motion. Unknown/missing/count-mismatched turn values retain the native default. Direction classification uses 30° for through, 15–60° for an explicit slight arrow, ≥120° for an explicit sharp arrow, and ≥150° for reverse; ordinary left/right arrows accept that side between through and reverse. No source tag is fabricated or rewritten.

A real turn retains its incoming lane across the junction even when its exit has fewer lanes. Straight lane drops across literal short segments keep their early merge. The incoming lateral coordinate is retained in path history so a right turn from lane 3 to a one-lane exit remains continuous at the node. Future path/reservation lane context follows each preceding leg. Guards, tolerances, watchdogs, source graph, fleet identities, constructor spawn methods and rendering are unchanged. The source-rule lookup uses no RNG; later route evolution changes because routes now obey mapped arrows.

`turn-lanes.test.mjs` includes source-direction, terminal/intermediate, unmapped/count-mismatch, bidirectional, slight/through/sharp/reverse, no-illegal-U-turn, projected-lane, straight-drop, long-body/stopped and continuous-handoff controls. It reconstructs all 697 recorded native hatch placements with maximum error `5.56e−16`, with missing lateral extras explicitly reconstructed as zero. The path point difference across the actual 3→0 handoff is zero.

Two bounded CPU motion controls use the unchanged native `stepVehicle` and `overlapGuard`, the exact 624 publication body poses, and fixed actual source legs. Hatch 2 uses left/east exit 142 in both; estate 423 separately uses the two legal right/west exits 157 or 158. Only these two bodies move; the other 622 stay frozen. Their mutual SAT clearance stays at least 0.4428 m, hatch 2 advances 9.2687 m in eight seconds, and maximum body step is 0.19391 m. **Negative evidence is retained:** estate 423 contacts frozen hatch 229 for 203/228 samples, up to 0.04989 m, and progresses only 0.348/0.402 m. This is not a global clearance, drive completion, evolving-fleet, pedestrian, static-world or native browser acceptance claim. A full captured Unirii graph was unavailable; motion controls use the actual recorded local source legs and freeze route continuation, with no invented joins.

Run from the repository root:

```sh
node handoffs/fidelity/pipera-fidelity/unirii-462-turn-knot/turn-lanes.test.mjs --out=/tmp/turn-lanes-new-output
node handoffs/fidelity/pipera-fidelity/unirii-462-turn-knot/analyze.cjs /tmp/turn-knot-new-attribution.json
node --test game/dev/*.test.mjs
node --input-type=module --check < game/src/traffic.js
node --input-type=module --check < game/src/turn-lanes.js
```

The lossless fixture and original native modules are compressed under `fixtures/4621127/`; their manifest pins hashes. `extract.cjs REPORT SOURCE_ROOT NEW_OUTPUT` reproduces the reduction without a browser. The original 157,654,497-byte report SHA is `bde41d404f17cf9847444b3c1a8d53b6c5167be02fa5e97083b3694bd991b327`. The full negative run, original images, direct-caller evidence and full source audit remain in the [RO negative proof](../../unirii-pedestrian-recovery/unirii-current-4621127-negative/README.md), committed separately as `cc669747231d3202bcee9a31ba4fddcaf324c08c`.

US rail integration must preserve its early source-rail branches in `chooseNext`, `pathPoint`, `laneTarget`, `latOn` and source admission. Merge the history entry's new `lat` alongside the rail-specific history retention limit, and keep the motor-only policy bypass for trams/rail edges. No browser was started for this work.
