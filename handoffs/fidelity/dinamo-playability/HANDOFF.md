# Dinamo playability handoff — 2026-11-08

Worker branch: `fidelity/dinamo-playability`; original base `7349ab4`.
Only cherry-pick the worker's final fix commit into root: root hooks `8f76c3c` and `a786ba6` are already integrated there (their cherry-picked ancestors here are `53143fd` and `71268cc`). No pushes performed.

## Changes

- Replaced the six filled Dinamo bowl boxes with stand envelopes derived from the existing 155-segment stadium profile. The pitch, infield and track are open; stands, the west roof and floodlight masts retain collision with appropriate height bands. Added optional collision-band plumbing in Builder only for this use.
- Added `footballPitch.playArea`, a 155-vertex local-coordinate polygon at the innermost stand wall. Root's world hook clips only artificial `boundary` segments inside this polygon, preserving the exterior fragments and all physical colliders. The district's inside query admits the same interior.
- Removed the drone's blanket Dinamo collision exemption. The drone now supplies its actual height to the ordinary collision query, including for roof bands. Cars/walkers share the open stadium interior and still collide with the stands.
- Changed painted pitch markings from 5 cm extrusions to flat caps 2 mm above the grass. The football's radius remains 0.115 m; existing goal metadata already correctly matches the post centre planes and crossbar underside.
- Snow cover selects amber/black football panels; clear conditions retain white/black. Added a soft contact disk that fades as the ball lifts. Ball + disk total 200 triangles / two calls, without a shadow pass. Root's larger clear reticle aperture keeps the ball visible at the aim point.

No stadium shape, footprint, goal placement or source facilities were invented or moved.

## Validation

`NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/dinamo-playability-check.cjs --out=/workspace/reality-pass/dinamo-playability/final`

**13/13 checks passed**, zero page or console errors:

- 493 positions across the whole pitch and both goal approaches clear for the drone and a 1.05 m ground body (larger than a walker).
- 38 continuous Normal-mode held-key routes: both directions along seven full-length rows and nine full-width columns, two diagonals, both bowl approaches at 30 m and descents to playing height. Maximum lateral drift ~1.8e-12 m; each route completed within 210 × 50 ms frames.
- 13 sampled real stand envelopes remain solid; all 22 roof boxes block only within their height band and are clear below/above; an unrelated external boundary still pushes the drone 0.3535 m.
- Both goals scored through actual `Drone._fly` controls in 102 × 50 ms frames each. The hidden unlock persisted after reload; district replacement disposed/detached the football and contact disk and left no Dinamo football in Romană.
- Six rendered close / 18 m overhead / approximately 50 m oblique views in clear and snow conditions. The ball is the first ray hit in all views. Visually inspected clear close and snow close/overhead/wide images. Snow close and overhead show the amber panels; at approximately 50 m the regulation-size ball remains only 2–3 pixels wide, a natural resolution limit.
- Maximum captured high-quality drone frame: **572,221 triangles / 171 draw calls**. These are software-GL counts, not a hardware FPS claim; full traffic + mirror and district-wide regression remain root's combined acceptance gate.

Additional checks: `football-check.mjs` **13/13**, `courtyard-check.mjs` **9/9**, ES-module syntax checks for football/drone/landmarks, harness syntax and `git diff --check` all pass.

## Evidence and root follow-up

Final JSON and six screenshots: `/workspace/reality-pass/dinamo-playability/final/`.
Previous successful pre-roof-band run: `/workspace/reality-pass/dinamo-playability/with-world-hook/`.
Negative boundary reproduction: `/workspace/reality-pass/dinamo-playability/before-world-hook/results.json` contains 20 blocked ground-body samples and stalled/sliding controller routes before root's clipping hook. Its later ball checks were confounded by the test's exhausted battery and centre-spot home marker; use final evidence for ball/lifecycle conclusions.

No remaining Dinamo reproduction in the focused suite. Root owns README/spec/status updates and the combined mandatory Bucharest foot/a regression, traffic/mirror performance checks, final staging integration and deployment. README should mention the open bowl and high-visibility winter ball; spec 23 should replace the previous coarse-box exemption description with these shared physical colliders.
