# Drone controls and 150m flight margin — 2026-11-08

Controls and the bounded flight implementation are complete. The wider flight view still reveals inherited scenery gaps in districts that have not been rebuilt; their visual/source acceptance remains open. No fog, culling or invented geometry was added to conceal them.

## Integration

Branch: `fidelity/drone-controls`, base `6cf6e18`. Identity: `CalinaCristian <cristycalina@gmail.com>`.

- Root dependency `035af4c` is cherry-picked here as `edc7ff1`. Root already owns this full-Dinamo `world.js`/architecture patch; do not apply it twice.
- `932910808532ac93abed97b192cd6feda94d5ed0` contains the controller, 150m boundary and initial focused harness changes.
- `5f9b1f6` adds short physical movement steps so boosted upward/downward flight cannot skip thin roof bands or walls. Include this runtime fix too.
- The intervening commits improve native range/photo checks and stadium capture headings. All own changes are the first-parent range after `edc7ff1`; the later evidence commit contains this handoff and numeric proof.
- Master was fetched and already merged before pushing. Only this worker branch was pushed; no master push or PR.

## Resulting behavior

- Mouse look supplies yaw and pitch. W/S move toward/away from the full 3D viewing heading; A/D always strafe, including after releasing the mouse gesture. Keyboard flight movement uses WASD only.
- Free flight starts level. Pitch reaches straight up/down. No Ctrl, Space, E, Q, C, PageUp/PageDown or arrow movement/turning is used for flight.
- Touch right-side drag changes look direction. The fixed drone stick and the existing floating left stick use the same forward/back/strafe mapping. The obsolete up/down pads and hold handlers are removed. Other mobile buttons remain.
- Cine/Normal/Sport use 4/12/26m/s total movement speed, with Shift ×1.8. Diagonal input is normalized. Short movement steps of at most 0.35m sweep ordinary physical collision, including vertical roof bands.
- `FLIGHT_GRACE = 150` is the Euclidean horizontal buffer. Deploy refusals and edge messages share this constant. Concavities, holes and separate islands retain swept constraints and bounded return routing.
- Root's world hook admits the complete authored Dinamo model for flight: stands, roofs, masts and perimeter. Walking/car containment and pitch boundary clipping still use the inner play area. Physical stand/roof colliders remain active.
- Existing height ceilings, 800m district/450m spot ranges, battery drain/low-battery return, photo, speed controls and landing paths remain. Venue activity cancellation still runs before saving/freezing the walker at deployment.

## Verification and proof

Final tested runtime is `5f9b1f6`; the complete native/boundary/Dinamo suites were run with the final harness through `4118627`. Numeric artifacts in this folder are portable copies of the results under `/workspace/reality-pass/drone-controls/`.

- Native browser events: **31/31**. Forward climb/descent, backward flight, strafing without a held mouse gesture, ignored legacy keys, speed keys/wheel/boost, actual 800m range stop, 120m ceiling, native photo shutter/tagging, H routing, battery return, touch look/stick and floating-stick strafe. The final suite also exercises boosted crossings of thin roof/wall fixtures. See `native-input.json`.
- Pure boundary fixtures: **9/9**, including rounded 150m corners, gradual outward braking, concave A* return, holes, rotated edges, island separation and range-bounded routing. See `boundary-fixtures.log`.
- Eight real loaded districts: **32/32** Normal/Sport × 60/110m edge flights, each stopped at **149.999m**; return-home docked and remained legal. Two tourist scenes (Parliament's two-member union and Fremont) also returned within their buffered extents/range. See `flight-boundaries.json`. The selected real-world fixtures have no remaining concavity across the tested return leg at the larger buffer; the pure fixtures explicitly exercise concave routing.
- Dinamo: **13/13** playability checks, including **493** clear pitch/goal-approach body samples, **38** continuous routes/descents, solid stands and roof bands, both actual controller goals, unlock persistence/disposal and clear/snow ball visibility. The descent fixture now looks straight down and holds W. Both goals still score in **102 controller frames** after adding physical substeps. The final rerun omits duplicate PNG capture; the six earlier clear/snow images were already inspected. See `dinamo-playability.json`; physics remains **13/13** in `football-physics.log`.
- Full stadium: **52,977** independently transformed authored-model vertices, **0** rejected, all four X/Z bounds corners at source-distance **0m**. Four legal 110m views, 150m beyond each stadium bounds side, fit all eight 3D bounds corners inside the frame at 227–269m from the pilot. Some side views remain inside the district union, so their distance to the union is less than 150m. See `stadium-views.json` and the committed north/east screenshots.
- Render inspection: all **24** district edge views (outward/inward 110m, outward 12m) and four complete-stadium views were inspected, plus six clear/snow Dinamo activity images. Measured edge/stadium maximum **850,016 triangles / 310 calls**, high quality, with the mirror included. This focused capture is not a claim about every traffic hotspot or hardware FPS. Root owns the combined performance gate and full district visual survey.
- Mandatory Bucharest `foot,a`: **0 high / 0 medium**; both scenarios add zero issues. One informational SwiftShader FPS low remains. See `logic.json` / `logic.md`.
- Edited-module/harness syntax and `git diff --check` pass. `source-manifest.json` records the exact source hashes.

## What the pictures still show

Floreasca and Romană sampled edges have continuous surrounding buildings/streets. The old Grozăvești source used here has **102 buildings**, no `scenery`, and does not include the other worker's `10d9b98` rebuild with 2,401 source buildings. At x=-189.999/z=-350/y=110, west-facing, it exposes sparse boxes, grey ground and clipped road ribbons. That source worker was informed and is testing the new data with this controller.

Unirii, Pipera, Otopeni and Bellevue also show inherited generic outskirts and incomplete scenery streets in these sampled views. Pipera's southward view is particularly sparse around the river ribbon. SeaTac shows its open airfield and the inherited distant mountain/backdrop strip; no new source-coverage sign-off is claimed. Representative inherited limitations are committed as `grozavesti-outward110m.png` and `pipera-outward110m.png`; they must not be presented as clean fidelity results. This worker does not assert that every old district has a real 600m scenery ring.

## Exact root-owned documentation follow-up

Update README's Drone paragraph/control text and the old “20m margin” line to describe mouse-look + WASD, W/S following pitch, A/D strafe, level takeoff heading, touch look + stick with no vertical pads, the 150m Euclidean buffer and the full-stadium flight extent. Retain the existing ceilings, battery and ranges. Add `drone-input-check.cjs` and `drone-edge-views.cjs` to the focused QA tool list.

Append the current owner decision to spec 10 (supersedes historical Space/E/Q/C and ▲▼ descriptions), finish the architecture contract's “implementation tracked separately” wording, and log the current numeric evidence in specs 19/23 and STATUS. Qualify the scenery-ring claim for unrebuilt districts. README/spec/status changes remain root-owned by assignment.

## Reproduction

Run from an immutable checkout. The local environment provides system Chromium through:

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/drone-input-check.cjs --out=/tmp/drone-native
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/drone-flight-check.cjs --spots=palace-parliament,fremont-troll --out=/tmp/drone-bounds
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/dinamo-playability-check.cjs --out=/tmp/drone-dinamo
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/drone-edge-views.cjs --out=/tmp/drone-edges
```

The browser harnesses remain muted. `drone-edge-views.cjs --districts=none` captures only the four stadium views; `--root=…` supports a source snapshot. No reference imagery is committed. The final no-duplicate-capture Dinamo rerun uses `--screenshots=none`; readiness waits poll independently of the deliberately frozen animation loop.
