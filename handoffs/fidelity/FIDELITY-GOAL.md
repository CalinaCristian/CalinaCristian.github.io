# Fidelity, gameplay and performance orchestration

Owner-authorized scope (2026-11-08): reference comparisons for the game, remaining district/landmark/location work, removal of fabricated gameplay places everywhere, and fixes for the reported visual/gameplay defects. The owner authorizes tested integration to master and deletion of the task branches. Commit identity: `CalinaCristian <cristycalina@gmail.com>`.

The native `/goal` control is not exposed to this session. This file is the tracked goal, not a claim that an external background goal was registered. Root monitors live workers through integration and acceptance.

## Current reported failures

1. Dinamo football difficult to find from the air; compare the real running scene, including snow and pitch markings.
2. Invisible boundaries block movement across the Dinamo field; test trajectories across the whole pitch, both goals and the bowl approach.
3. Floating upper sections of the building to the right of the Romană spawn (Hotel Ambasador is a candidate).
4. Ambasador rooftop lettering readable from the wrong side.
5. Heavy facade flicker near Arnia and multiple other buildings; inspect complete OSM outlines overlapping mapped parts, including Bl. D5/H6.
6. Broken concave roofs behind the Romană spawn; do not flatten correctly sourced pitched roofs to hide bad geometry.
7. Facades/windows intruding into streets; preserve legitimate source footprints and building passages, never move/delete a real building to fit decoration.
8. Time/weather/season choices reset on travel. Expose controls in the in-game Settings menu and preserve selected conditions across travel/Continue.
9. Conflicting traffic signals turn green together and cars collide. Test crossing movements and clearing intervals, not only signal meshes.
10. Performance, pedestrians, collision bodies and carried items are acceptance gates too.

## Acceptance

- Actual game/reference comparisons across the complete reviewed area, including close drone angles, street level, night and weather. Street View is comparison-only; source attributes come from OSM, aerial measurements or independently cited sources. No reference imagery in git or publication.
- Top-down comparisons use satellite/aerial imagery, not ground-level Street View. Label provider, date/coverage, camera pose and source commit. Keep both overview navigation and low-enough tiles showing trees/parked cars.
- Remove invented gameplay locations globally, with dead creation code, UI/map pins and assumptions cleaned up. Keep sourced stations/places; never remove a real building to make a fabricated facility fit.
- No accepted open reproductions of the reported flicker, roof holes, floating tiers, road intrusions, invisible pitch walls, signal conflicts, pedestrian teleports or collision mismatch. Preserve raw detector output and classify false positives with evidence.
- High quality, world + traffic + mirror: <=1,500,000 triangles and <=400 draw calls. Test hotspots and evolving traffic, plus drone/season/weather views. Preserve physical/source fidelity when optimizing.
- Mandatory foot/a logic: 0 high / 0 medium; relevant collision, signal, football and settings/travel tests; zero browser errors. Inspect pictures. Do not claim hardware FPS from software-GL measurements.
- Inventory every remaining district, landmark and tourist scene. Give each one an owner/status/source/evidence/check record. Unknown or unavailable reference detail remains explicitly unresolved; 100% review coverage is not the same as 100% real-world parity. Do not mark complete while material parity gaps remain.
- Integrate into a staging branch, test the combined tree, fetch/rebase onto current master, push master only after checks pass, verify the remote, then delete only this effort's local/remote task branches and worktrees. Never force-push master or delete unrelated work.

## First wave

| Workstream | File boundary | Status |
|---|---|---|
| Conditions / settings / persistence | main.js, explore.js, save.js, UI hooks | root in progress |
| Building parts, roofs and road clearance | world.js geometry blocks, building-parts.js, tools/osm, Romană data | queued worker |
| Dinamo pitch access / ball visibility | football.js, drone.js, Dinamo landmark function; shared world hooks via root | queued worker |
| Signal conflicts / pedestrian and collision review | signal section of world.js, traffic.js, new isolated signal helper | queued worker |
| Aerial/Street View comparison evidence and visual QA | dev harness + local artifact output | queued worker |
| Global invented-location/dead-code audit | read-only first, proposed small cleanups | queued worker |
| Remaining locations inventory + scoped task manifest | handoffs/fidelity/inventory only | queued worker |

All workers use fresh context and isolated worktrees/branches. They must not switch branches in another worker's directory. Root owns this file, shared integration and global spec/status updates. Each worker writes a uniquely named handoff.
