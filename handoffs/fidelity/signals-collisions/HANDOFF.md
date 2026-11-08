# Signals, pedestrian collisions and regression evidence

## Diagnosis and scope

The reported Romană crossing is reproduced on the actual road graph at Grigore Alexandrescu × Lascăr Catargiu (nodes 321/355, incoming edges 312/421). The approaches differ by 44.4° (−9.566° / 34.816°); the previous `<45°` two-phase bucket assigned both crossing streets phase 0. Nearby split pads could also be separate controllers, stopped traffic could ignore a downstream red after eight seconds, and a box claim only covered one node and could expire while a slow car or bus still occupied it.

`signals.js` groups only near-parallel axes (within 20°, including opposing approaches), creates as many phases as needed and adds yellow plus an all-red clearing interval. Timings are conservative simulation settings, not measured Bucharest signal timings. Existing source signal locations stay the source of lamps. Signal clusters cover split junctions at the same elevation; connecting degree-two graph nodes share the controller without acquiring invented lamps. Unknown approaches fail red. Actual occupied movements hold conflicting greens until the rear clears. Traffic reserves every pad and connecting lane through a controller, makes permissive left turns yield to conflicting reservations, and never grants a red entry merely because a driver has waited. A committed movement clears the split junction as one movement.

Full rush-hour pedestrian observation exposed additional concrete bugs: visible population recycling, sidewalk-side flips at dead ends/road overlaps, instant kerb/adopt-line/un-piling corrections, detour sides oscillating with a passing offset, and collision pushes losing their along-edge coordinate or active detour. Hidden recycling now checks both source and destination. Recovery uses real walking steps and collision checks. Detours have a stable sidewalk-relative side and bounded lateral motion, crowd separation shares one walking budget per frame, and collision pushes retain the full physical pose. Walk planning excludes the same unwalkable edges as spawning (including bridges without a sidewalk). A final collision cleanup follows crowd separation.

Runtime ownership: only `traffic.js`, signal construction/clustering/state blocks in `world.js`, and the new pure `signals.js`. No player/main/mirror edits. The existing asymmetric cockpit collision body and carried-item crowd reach are preserved and explicitly tested.

## Validation

- `node game/dev/signals.test.mjs`: PASS. Actual Romană angles across cycles; unknown approaches; split-controller conflicting paths and left-turn yielding; occupied-phase hold and queue release; slow cars and a bus on short exit segments; invalidation after hidden relocation; cockpit front/rear and umbrella/guitar reach; visible pedestrian recycling, walking recovery, bounded separation/detour and full-pose collision retention; walkable route planning.
- Final immutable snapshot: `/workspace/reality-pass/signals-collisions/qa8-source.tar`, SHA256 `1e3deb1bd6642b5dd362c3ff8a89ea8ebcdc3a58fd4bcdbd8e3f08d6be50eb6a`.
- Mandatory actual browser harness on that snapshot: `--scenario=foot,a,h --city=bucharest`: **0 high, 0 medium**, one low software-GL information item. Foot 64.7 s; spawn-driving 37.4 s; wall/prop controls 17.7 s. No JavaScript errors. Report and screenshots: `/workspace/reality-pass/signals-collisions/logic-qa8/`.
- Actual four-queue Romană movement fixture, 600 simulated seconds at 30 Hz: **217 completed movements**, maximum queue wait 13.4 s, **0 unsafe simultaneous green pair-ticks**, no red entries, maximum SAT overlap 0, no JavaScript errors. The old implementation produced 14,618 unsafe green pair-ticks in the same fixture; the existing overlap guard limited physical penetration there, so this fixture reproduces the unsafe signal permission rather than claiming to recreate a large crash. Report: `/workspace/reality-pass/signals-collisions/movement-qa5/movement.json`. Relevant reservation/signal code is identical to final qa8; pedestrians are disabled in this isolated movement fixture.
- Full rush-hour scene: 640 vehicles, 560 pedestrians, high quality, mirror enabled, 1280×720, far clip 5,000 m. Three viewpoints, each 60 simulated seconds at 30 Hz. No JavaScript errors. No visible pedestrian frame steps over 0.4 m, and zero detected final pedestrian/static-obstacle overlaps at all three. Maximum visible step: Catargiu 0.106 m, Arnia 0.158 m, Victoriei 0.133 m.

| Full high-quality mirror frame | Triangles | Draw calls |
| --- | ---: | ---: |
| Catargiu | 1,361,938 | 371 |
| Arnia | 1,398,718 | 361 |
| Victoriei | 1,168,558 | 305 |

Screenshots and raw observation/performance JSON: `/workspace/reality-pass/signals-collisions/perf-qa8/` (`catargiu.png`, `arnia.png`, `victoriei.png`). Both budgets stay below 1.5 M / 400. These are geometry/call measurements, not a hardware frame-rate claim. Source/screenshot archives are local evidence; no public reference imagery is committed.

Syntax checks for all edited modules and `git diff --check`: PASS. Browser runs use system Chromium, muted, via `NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs`.

## Limits and next isolated issue

The movement fixture covers actual conflicting paths and repeated releases at the reported crossing; it does not assert that every possible road-graph junction worldwide is conflict-free. Rush-hour overlap-guard and deadlock-recovery counters still exist, so a claim of globally zero NPC collisions would be unsupported. Signal phase grouping is conservative simulation correctness and source-based placement, not surveyed controller plans. Source raw failed runs remain in the evidence directory; the final gates above are from immutable qa8.

The newly reported stopped-NPC sideways slide has a separate exact reproduction: an actual stopped red-light NPC changes laneCur from 0 toward a planned lane 1 and moves 3.499 m laterally over four seconds while speed and along-road s remain exactly zero/constant. Cause: unconditional time-based lane and bypass interpolation in stepVehicle. Reproduction and raw samples: `/workspace/reality-pass/signals-collisions/sliding.cjs`, `/workspace/reality-pass/signals-collisions/sliding-before/sliding.json`. That correction will be a separate commit with a before/after lane-hold fixture.
