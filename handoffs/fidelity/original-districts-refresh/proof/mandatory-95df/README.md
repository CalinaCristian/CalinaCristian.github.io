# Mandatory walking and spawn checks

Immutable GAME source: `95df337` (complete source SHA recorded in Git). This includes root `9afb80e`, the corrected positive relation-part compiler/auditor, all three rebuilt original districts and the scene-only MoPOP source material fix.

Official harness command: `node game/dev/harness/run.js --city=bucharest --scenario=foot,a --timeout=900`, using the installed system Chromium and DOMContentLoaded / explicit boot handshakes. The served files came from `git archive 95df337 game public package.json`. The external `system-chromium.cjs` wrapper preserves all gameplay assertions and extends only cold boot handshakes.

Both scenarios finish: **0 high, 0 medium**, with zero new issues in either scenario. The raw low software-GL frame-rate diagnostic remains in the report. It is not a hardware performance result or a high-quality frame-budget acceptance claim. Initial full-city compilation took 147.3 seconds; this is preserved as an observation.

The official harness loads the legacy complete Bucharest city (19,939 graph edges / 70,022 colliders), rather than an individual source district. This mandatory minimum gate therefore supplements the separate final source-district visual, geometry, native access and render-budget evidence. Raw reports, screenshots and stdout remain unchanged.
