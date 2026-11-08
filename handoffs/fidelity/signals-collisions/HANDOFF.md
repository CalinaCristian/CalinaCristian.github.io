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

## Limits and follow-up

The movement fixture covers actual conflicting paths and repeated releases at the reported crossing; it does not assert that every possible road-graph junction worldwide is conflict-free. Rush-hour overlap-guard and deadlock-recovery counters still exist, so a claim of globally zero NPC collisions would be unsupported. Signal phase grouping is conservative simulation correctness and source-based placement, not surveyed controller plans. Source raw failed runs remain in the evidence directory; the final gates above are from immutable qa8.

The newly reported stopped-NPC sideways slide has a separate exact reproduction: an actual stopped red-light NPC changes laneCur from 0 toward a planned lane 1 and moves 3.499 m laterally over four seconds while speed and along-road s remain exactly zero/constant. Cause: unconditional time-based lane and bypass interpolation in stepVehicle. Reproduction and raw samples: `/workspace/reality-pass/signals-collisions/sliding.cjs`, `/workspace/reality-pass/signals-collisions/sliding-before/sliding.json`. The separate stopped-vehicle correction and its validation are recorded below.


## Stopped NPC lateral drift and visible recovery (second commit)

Exact reproduction: an actual normal NPC at the Romană edge 421 red stop line, speed 0 and constant s, planned lane 1 / physical lane 0. Over four seconds the old time-only lane interpolation translated it **3.499325807 m sideways while speed stayed exactly zero**. `latExtraCur` bypass interpolation also had a positive time-only floor, and body damping kept moving even after the internal lane target stopped changing. Before/after reproduction JSON and script are in the evidence directory (`sliding-before`, `sliding-after`, `sliding.cjs`). After: **0 m** sideways, same s and speed 0.

Lane and bypass steering now share a lateral-distance budget tied to actual forward travel (maximum 0.45 m lateral per metre forward), including long bodies. The drawn body uses the same travel bound and holds its actual pose and heading at speed 0, so residual damping cannot finish a lane change after braking. Acceleration, obstacle braking, road geometry and collision checks still govern the movement.

The full rush trace separately identified visible automatic recovery teleports: `nudge`, stuck-vehicle respawn, overlap unknotting and deadlock recovery removed visible stopped cars, moving their source positions up to 1.3 km in one frame. Automatic relocation/respawn now checks both visible source and actual destination. Failed relocation, respawn and rush placement restore the complete physical pose, steering, route/history and pitch; they no longer snap a car back onto its lane target or reverse it on failure. Visible player-contact nudges use bounded physical separation; a blocked queue without contact never gets the former 3.5 m snap. A visible route-ending bus waits at its last edge until hidden recycling is possible. Pooled rush vehicles also use hidden destinations during normal population updates. Explicit player load/reset/summon/fast-travel clearing remains an explicit operation.

Additional gate: `node game/dev/vehicle-lanes.test.mjs` passes stopped lane and bypass holds, moving/long-body shared steering bounds and actual progress, braking midway through steering, visible-source recycling prevention, exact physical/route/pitch restoration on failed placements, bounded player-contact nudging, and a visible bus ending its route. The prior signal/collision/pedestrian tests still pass. Syntax and diff whitespace checks pass.

Final runtime snapshot: `/workspace/reality-pass/signals-collisions/qa14-source.tar`, SHA256 `92f55a86ffcc97accf36583e1677fa7dc07a4fb4f26f0d05d54b9288159d3ece`.
Final mandatory `foot,a,h` on qa14: **0 high, 0 medium**, only software-GL fps information; foot 64.7 s, driving 37.5 s, walls/props 17.6 s. No JavaScript errors. `/workspace/reality-pass/signals-collisions/logic-qa14/`.

The 600 s actual Romană four-queue movement fixture after the steering change still completed **217** movements, maximum wait **13.4 s**, **0** unsafe green pair-ticks / red entries / SAT overlap. `/workspace/reality-pass/signals-collisions/movement-qa14/` (the exact final runtime snapshot).

A 180 s full-rush probe of the lane/recovery code (qa11, before the final terminal-only stop guard) recorded **218,633 visible stopped-car frames**, **0 m non-contact lateral drift**, all **620 moving vehicles** making progress and **8,578 edge changes**. Maximum stopped physical correction was 0.248 m, from overlap separation. There were no visible stopped-vehicle recycling teleports. Report: `stopped-rush-qa11/stopped-rush.json`. A preceding qa10 pass also had 0 non-contact drift across 242,037 stopped frames. Physical overlap-guard separation remains collision response and is reported separately; these results do not claim globally zero NPC contacts.


The longer qa12 gate was deliberately rejected despite passing geometry budgets and mandatory controls. Its three 180 s observations exposed two further causes which the earlier 60 s observations missed:

- Pedestrian recovery could finish at a collision-corrected physical pose, restore `walk`, and then jump **3.74 m** back to stale `s` / `walkOff`. Completion now adopts the actual physical pose before resuming. An unexpected large `placeWalk` correction itself becomes a walking recovery. The exact finishing-recovery case is included in `signals.test.mjs`; `diagnose-qa12/perf-pedestrians.json` contains the method trace.
- An estate entering the **6.494 m Aviatorilor → 21.305 m Piața Victoriei** skew link projected its centre onto the new road axis, moving **7.55 m** even at a near-zero restart speed, without a hidden relocation (same generation). Normal cars now keep road history, follow the same junction chords as long bodies/reservations and bound both actual forward and lateral movement by travel. The exact road directions, lane drop and short-link restart are in `vehicle-lanes.test.mjs`.

Rejected raw output remains in `rush-qa12/stopped-rush.json` and its screenshots; it is not being relabelled as a clean acceptance run.


The qa13 long run removed those two causes, but found one further Arnia `avoidVehicles` correction of 0.59 m: a car had swept its drawn body over a sidewalk/corner pedestrian whose `onRoad` flag was false. A vehicle guard now refuses worsening body penetration of **all** street-level pedestrians, also after vehicle separation. Hidden vehicle placement checks existing pedestrians too. Existing contact corrections share one walking-step budget per pedestrian per frame; repeated cleanup calls cannot multiply it. New tests cover a corner walker outside the carriageway, rejecting a vehicle spawn onto a pedestrian, and the shared contact-correction budget. The earlier qa12 geometry/recovery tests fail on qa12 and pass on final code (`late-regressions-before.json`).

Final **qa14**, 180 simulated seconds at 30 Hz **at each** of Catargiu, Arnia and Victoriei, 640 vehicles / 560 pedestrians, high quality with mirror:

| View | Visible stopped-car frames | Maximum non-contact lateral step | Maximum visible pedestrian step | Triangles | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catargiu | 225,074 | 0.000392 m | 0.115 m | 1,452,098 | 357 |
| Arnia | 553,053 | 0 m | 0.134 m | 1,367,001 | 357 |
| Victoriei | 741,198 | 0 m | 0.168 m | 1,117,286 | 280 |

Across **1,519,325** visible stopped-car samples: no non-contact lane slide; the small 0.4 mm bound at Catargiu is a low-speed/braking-frame residual. No visible pedestrian steps over 0.4 m, no detected final pedestrian/static-obstacle overlaps, no browser errors. Maximum physical stopped-vehicle separation was 0.25 m and is retained as contact response, rather than described as steering. Actual movement across edges continued (8,591 / 6,629 / 6,812 edge changes); 620 / 522 / 544 non-parked vehicles moved at the respective views. These are traffic-density queues, not a claim that every actor moves throughout every red phase. Screenshots were inspected. Raw events, contact classifications, source and rejected runs remain preserved under `/workspace/reality-pass/signals-collisions/`; final report/screenshots are in `rush-qa14/`.

The owner's new long stationary Romană spawn crowd buildup report is a separate open follow-up, to be addressed in a third commit. A 15-minute actual `arnia` chapter-start soak on deployed baseline `df9b2e2` is running, measuring allocated/rendered counts, 10/20/40 m concentrations, identities, lifecycle events and per-person progress. This second commit does not claim that the new concentration report is resolved; it preserves source-visible people and therefore needs a proper walking-capacity/replanning solution, not visible recycling or an arbitrary lower population budget.
