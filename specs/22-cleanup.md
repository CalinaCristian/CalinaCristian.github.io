# 22 — Code cleanup after the district migration

Owner roles: each role cleans **its own files**; a **code-health** pass (orchestrator or a dedicated agent) handles cross-cutting dead code. Starts only after spec 10 is `done` (districts + chapter flow verified).

## Why
The move to 1:1 districts and chapters makes the corridor-era code obsolete: scale squeezes, compression hacks, workarounds for overlapping parallel roads, legacy data files and single-map fallbacks. `world.js` has grown to ~200 KB of layered fixes. Less code = fewer bugs, faster loads, easier fixes.

## Requirements
R22.1 **Remove the corridor era**: `tools/osm/corridors.mjs` (or keep only as an optional tool), legacy `game/data/bucharest.json` / `seattle.json`, `buildWorld` without `district`, the 0.7/0.5 scale paths, the DN1 north–south compression, the landmark squash for the compressed strip, `SEA_SCALE` in landmarks.js, parallel-road push-apart hacks that only existed because of the squeeze.
R22.2 **Split `world.js`** into focused modules with the same public API (`world.js` becomes the assembler): `roads.js` (ribbons, junction pads, markings), `profile.js` (vertical profile solver), `walls.js`, `streetscape.js` (props, trees, lamps, furniture, signs), `buildings.js` (footprints, facades, roofs, shopfronts), `pois.js` (POIs, doors, stations), `audit.js` (audit/devCheck). Same for any other file > 60 KB where it helps (traffic.js, main.js).
R22.3 **Remove dead code and duplicates**: old rain in main.js (render owns weather), duplicate time-zone/phase tables, unused exports, unused vendored addons, superseded harness scenarios (keep the logic harness lean; visual QA is the main gate), debug leftovers (keep `B` overlay and `?dev` tools), old dev pages that no longer run.
R22.4 **Single sources of truth**: city/district/chapter config only in cities.js; CV content only in data.js; styles only in style.css; magic numbers (lane widths, heights, clearances, grades) in one constants module.
R22.5 **Keep behaviour identical**: no visual or gameplay change except bug fixes found along the way (log them).
R22.6 Document the final module map in `01-architecture.md` and a short `game/README.md` for future contributors.
R22.7 Before effort-branch cleanup, retain all local/fetched-remote tips, detached worktree HEADs and recorded source commits in an immutable evidence archive. Expose missing objects/provenance, preserve the exact accepted source tree and original capture dates, verify the remote archive, and preserve dirty-file backups. Never rewrite existing master history.

## Acceptance
- Logic harness and visual QA results before vs after: no new issues, no new review defects (attach both summaries).
- Total game JS size and per-district load time logged before/after (target: −30 % JS, no slower loads).
- No file in `game/src/` > 60 KB except vendored code; no unused exports (simple script check).
