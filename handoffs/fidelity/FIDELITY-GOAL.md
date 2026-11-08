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
11. ASE's distinctive corner, dome, facade and courtyard context need a source-led landmark pass.
12. Cockpit mirror glass sometimes reappears outside the car; remove the on-foot L key-fob action, retaining driving headlights.
13. Stopped NPC cars slide between lanes or snap at skewed junctions; inspect recovery/recycling as well as steering.
14. Map clicks must select a waypoint/route without moving the player; F or an explicit Fast travel action performs travel.
15. Generated cars obstruct the raised sidewalk at the Floreasca spawn parking lot; reject whole-footprint overlap without moving the real lot.
16. Tourist visits need short, optional, activity/view-led routes. Keep the Troll, cathedral, Old Town and strong US views prominent; larger parks/gardens are secondary. Registry/READY flags are not fidelity acceptance.
17. Publish a single `/game/overview/` with technical documentation and embedded Romană/Floreasca comparisons. Remove the separate `/comparisons/romana/` page without a redirect. Separate playable district, nearby scenery and distant context; distant content can still be visible.

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
| Conditions / settings / persistence | main.js conditions, save.js, isolated browser harness | staged `d2fbfa5`; 58 conditions + 10 controls checks; combined gate pending |
| Building parts, roofs and road clearance | world.js geometry, building-parts.js, tools/osm, Romană data | active: source parts/assemblies, roof topology and coplanar-neighbor ownership; raw wider-sweep findings still being resolved |
| Dinamo pitch access / ball visibility | football.js, drone.js, Dinamo; shared world hooks via root | staged `efb66c0`; 13 playability checks plus physics/courtyard controls |
| Signals / pedestrians / stopped lane slides | world.js signals, traffic.js, signals.js | core staged `d5adfc8`; extended 180-second movement traces still found corrections, second fix under test |
| Comparison evidence and website | own game captures + live official aerial; no cached reference publication | 195 historical/4 baseline gallery published `df9b2e2`; owner now requests removal and consolidation under overview; Floreasca capture active |
| Invented locations / dead code | exact CV/fuel/ATM/camera blocks; fictional Old Town venue | staged `70b7a1a` + `4b9f6d7`; source anchors preserved; missing real camera flags remain a coverage gap |
| Remaining location inventory | handoffs/fidelity/inventory | complete inventory only (`39dbc5f`): 8 districts, 61 landmark entries, 24 spots/19 scenes; queued fidelity passes remain open |
| ASE | bASE, source ledger and exact courtyard collision | staged `3174ed6`; 713 probes/four courts plus solid controls; dimensions/topology estimates remain explicit |
| Short tours / tourist portfolio | spots core; handoff-only all-24 reviews | staged `719d7b2`, `90f6227`, `afc0263`; 58 tour checks; Seattle Center lift/view/budget work active, readiness unchanged |
| Mirror / on-foot L | main.js car visibility + player.js | staged `c8d2482`; focused controls passed; L remains driving headlights |
| Floreasca parking | surface-lot/kerb placement in world.js | staged `b395322`; target lot 28→22, retained poses unchanged; sidewalk intersections 11→0, walker path opens |
| Map marking / explicit F | explore.js, worldmap.js, main map/nav/F sections | staged `a1d1f22` + root car-route hook; 25 UI checks + tourist-map controls; combined gate pending |
| Overview / embedded gallery | game/overview, source inventories, scoped shared viewer | active isolated workers; no redirect at old comparison URL |

All workers use fresh context and isolated worktrees/branches. They must not switch branches in another worker's directory. Root owns this file, shared integration and global spec/status updates. Each worker writes a uniquely named handoff.
