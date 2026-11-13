# 22 — Code cleanup after the district migration

Owner roles: each role cleans **its own files**; a code-health pass handles cross-cutting dead code.

## Why
The move to 1:1 districts made the corridor-era code obsolete, and `world.js` has grown into one very large
`buildWorld` closure of layered fixes. Less code means fewer bugs, faster loads and easier fixes.

## Requirements
R22.1 **Remove the corridor era**: whole-city corridor maps, `buildWorld` without a district, scale squeezes and the
workarounds that existed only because of them. `tools/osm/corridors.mjs` stays only as the playable-area tool.
R22.2 **Split `world.js`** into focused modules (< 60 KB each) with the same public API, `world.js` becoming the assembler
(roads, vertical profile, walls, streetscape, buildings, POIs, audit). Same for any other file > 60 KB where it helps
(traffic.js, main.js).
R22.3 **Remove dead code and duplicates**: unused exports, duplicate time-zone/phase tables, unused vendored addons,
superseded harness scenarios, debug leftovers (keep the `B` overlay and `?dev` tools), dev pages that no longer run.
R22.4 **Single sources of truth**: city/district/chapter config only in cities.js; CV content only in data.js; styles
only in style.css; magic numbers (lane widths, heights, clearances, grades) in one constants module.
R22.5 **Keep behaviour identical**: every district world byte-identical before and after unless a bug fix is logged.
R22.6 Document the final module map in `01-architecture.md`.
R22.7 Before deleting effort branches, keep every branch tip, worktree HEAD and recorded capture commit reachable in an
immutable annotated archive tag (`python3 tools/fidelity/archive-evidence.py --write-tag=<name>`; a dry run lists
missing objects); never rewrite `master` history.

## Acceptance
- Logic harness and visual QA before vs after: no new issues, no new review defects.
- Total game JS size and per-district load time logged before/after (target: −30 % JS, no slower loads).
- No file in `game/src/` > 60 KB except vendored code; no unused exports.
