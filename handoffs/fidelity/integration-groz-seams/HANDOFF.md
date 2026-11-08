# Grozăvești fork continuity and clearance

Production: **3c010aa**, `game/src/world.js` only. This proof uses source **14c76c5**, locally cherry-picked as 293851f. Do not cherry-pick 293851f over the root source delivery. The later combined staging datasets require their own integrated checks.

Bretea (source `w84482671`) met Basarab (`w1535667122`) with a0.26 m step over19.6 m². The actual player controller brushed Basarab's barrier at least25 times while completing the103 m test path. Exit→Giulești (`w84483589`) also had a light slab1.28 m over its road beside Basarab `w1552024281`.

The existing gore relaxation now follows connected forks120 m and permits4.5 m of lowering, keeping its original equality tolerance and8% grade limit. Its clearance floors use the same mitered pavement footprint as rendering. Where a long ramp starts below a clearance floor outside the overlap, the original linear piece is retained rather than independently clamping its endpoints. This avoids an11 mm clearance loss at a0.13 m² corner which the ordinary finding threshold missed. Paint priority follows the visible pavement before class/id priority, and the sidewalk hull retains its exterior while its overlap with the road pad is clipped. No source coordinates, widths, lane counts, access, barriers or buildings were changed or removed. The vertical profiles remain source-layer estimates, not surveyed elevations.

## Focused evidence

| Check | Before | After |
|---|---:|---:|
| Bretea actual controller contacts (capped) |25|0|
| Completed actual controller paths |10|10|
| Raw geometry high / medium / low |12 /22 /125|10 /12 /125|
| Newly added exact type/location high or medium records |—|0|
| Target pair overlap vertices, maximum separation |1.015975 m|0.011341 m|
| Previously clear road-footprint pairs retaining≥ 5.2 m |266|266|
| Minimum separation from the earlier ramp to the upper deck |—|5.442350 m|

All ten after paths keep every static collider, isolate moving actors, and run actual`Player.update` at60 Hz. Both ramp lanes cover318.2 m, ground Orhideelor189.2 m, upper Basarab279 m, northern approaches81 m each, Bretea103 m, Exit251 m and both through lanes169 m. Maximum frame height change is0.015 m; maximum lateral deviation0.485 m. Seven retained guard probes block within their height bands and reject bodies below, above and1.5 m to the side. The old virtual map-end connector is absent in this rebuilt source and is not claimed as a new closure test.

The 20 exact target road-pair intersections,266 whole-world previously-clear footprint pairs, full trajectories, raw findings and source hashes are in`proof/{before,after}/`. The separate baseline inventory was captured from the same immutable baseline world/data hashes. Source JSON is byte-identical before/after (SHA-256`523632a18195768063bb82cc454f9b454ea969d802daaee6f446ebf423cbc3ef`). The road source audit has no issues, including no missing whole source ways/vertices. This does not establish complete source parity.

The identical driver poses show [Bretea before](proof/before/bretea-driver.png), [Bretea after](proof/after/bretea-driver.png), [Exit before](proof/before/exit-giulesti-driver.png) and [Exit after](proof/after/exit-giulesti-driver.png). The after high/full-mirror steady frames are238 calls/1,082,423 triangles and330 calls/1,238,509 triangles. Raw first-frame setup counters are retained separately; none are reset inside a complete frame. Native renderer captures use1280×720CSS and0.5 pixel ratio. System Chromium/SwiftShader supplies no physical hardware FPS evidence.

## Mandatory and wider visual checks

`npm run harness -- --scenario=foot,a --city=bucharest` ran both scenarios: **0 high /0 medium /1 low**, with no scenario errors or resets. The low record is software-GL FPS. Raw results are`proof/mandatory-foot-a.{json,md}`.

The stock wider visual run is deliberately retained as **INCOMPLETE**, exit2. All48 planned captures finished (UPB40, Grozăvești8), but the required Splai sweep could not be routed. Source-owner analysis confirms the farthest named-street endpoints lie on opposite one-way carriageways with no legal U-turn. The same route-missing finding is present in the baseline. The owning worker is repairing the generic planner with legal source routes and explicit unreachable-extents diagnostics. This run cannot establish full district coverage.

The observed48 captures contain10 high /13 medium /126 low raw visual records, world maxima287 calls/1,171,692 triangles, and nine traffic+mirror samples with maxima330 calls/1,261,060 triangles. All27 contact sheets were reviewed in the five`proof/review/`montages;`sheet-inventory.json` retains their original hashes. The remaining raw geometry findings, pixel flags and missing route are preserved, not relabelled as passing. Raw reports are`proof/visual-incomplete.{json,md}`.

Rejected candidates are retained in`proof/rejected-candidates.json` and locally under`/workspace/integration-qa-evidence/groz-seams/`. These include the original clearance regression, a tighter tolerance that worsened controller contacts, and an overly broad clearance envelope. The accepted version uses neither rejected approach.

## Reproduce

```sh
node handoffs/fidelity/integration-groz-seams/verify.cjs
node handoffs/fidelity/integration-groz-seams/run.cjs BASELINE_ROOT /tmp/groz-before --captures
node handoffs/fidelity/integration-groz-seams/run.cjs PATCHED_ROOT /tmp/groz-after --captures
node handoffs/fidelity/integration-groz-seams/verify.cjs /tmp/groz-before /tmp/groz-after
```

The scripts use source 14c76c5  road indices and no production hooks. Run the mandatory harness from its immutable snapshot; it has no`--root` flag. Final all-eight-dataset logic, mobile, memory and population soak gates remain integration work.
