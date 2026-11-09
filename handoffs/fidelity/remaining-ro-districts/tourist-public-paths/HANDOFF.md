# Bounded public-path corrections and native proof

Ballard scene source: `2dc9b41` → `3a92f4a` → `20e0332` → `5dc9792`.
The first commit was superseded by the following mapped-path solution; use the complete chain or the final scene file. Only `game/src/spots/scenes/ballard-locks.js` changes production behavior. Cișmigiu and Waterfront scene sources remain unchanged.

The game captures come from immutable source archives. Context captures use `5dc97921ccbb3411463c5f95972a0b3b7ca71fa0`; Waterfront's crowd-aware native walk uses `b84de82` (the scene and runtime are identical apart from the later Ballard-only change). Prior records retain the old `94ef228` results. The capture worktree reported dirty only because of an untracked generated Python cache; the served archive consists entirely of the recorded tracked source. All images here and in the three overview records are GAME renders. No reference imagery is included.

## Findings and actual movement

- **Cișmigiu:** the unchanged public bridge route completes with the actual `OnFootController`: 144.38 m, 1,711 steps. The old 0.9 m waypoint tolerance cut the bridge corner. Shared harness `03520ad` uses 0.45 m and a route-length-derived bound. No scene source change is warranted.
- **Waterfront:** the original static plan still stops against the complete ticket queue after 78.37 m. Planning against read-only snapshots of the real crowd OBBs allows the same native controller to walk 160.04 m from the original spawn to Pier 57, then 86.47 m back to Over the water. Source geometry, colliders and people are unchanged. This establishes physical public access; it does not fix the runtime guided planner, which still ignores people. The later Ocean Pavilion test returns no plan from the crowded endpoint; no actual native failure is inferred from that return value.
- **Ballard:** the old 1,500-step failure was a capture cap, not an impossible route. A longer native baseline walk completes but leaves the reader at y −6.1 beside the authored coping at y 0.6. The final scene regrades only exact mapped public ways `w60973303`, `w472179831`, western access `w1305390459`, and mapped steps `w60973302`. Their source XY remains exact. Grade 0.6 m, path width 3.2 m and steps width 2.6 m are **unmeasured estimates**, aligned with existing authored coping. No chamber/courtyard is bridged, no source body/collider/tree/person is deleted, and no teleport or lift is added. The last board reader follows the real mapped bend around the operating house; the observation/staff point follows the mapped bank path.

The final continuous Ballard native walk reaches Lakes lowered, Two locks, Fish ladder, Busiest lock, lock observation and postcard: 180.51 + 30.12 + 29.87 + 89.98 + 68.47 + 97.60 m. Every endpoint has feet y 0.6. Movement uses `ctl.auto` and native 0.05 s updates, with no XYZ assignment during walking. The source-membership hash remains `0f40f8a30d285596a57159ca20781a1fcbb5af4fefc28f3701adadf0848fe52d`; all 107 source buildings, 713 colliders, 450 trees and 55 people remain. The separate context harness's 180 m planning cap returns no Ballard path; the independently bounded 181 m plan completes and supplies its public-walk image.

## Honest remaining limits

The changed Ballard terrain signature correctly invalidates the old source geometry cache. All 107 source volumes recompute with zero dropped/inset; tourist owner should rebake that scene's cache after source integration. The record leaves the cache check pending until that is done.

Raw findings remain visible in the three records. Cișmigiu retains 1 bad geometry, 1 z-fight and 1 phantom report; Waterfront retains 45 z-fights, 6 below-deck and 6 sunk-person reports. Ballard's post-walk observation retains 1 phantom report on its **unchanged south** lock wall at x 8.7, z 97.4. `ballard-wall-rays.json` directly hits the actual rendered concrete wall and metal handrail at all three audited positions (six of six rays). The audit excludes triangle AABBs with either horizontal span above 120 m; the long lock triangles exceed that bound. No detector code or finding count was suppressed. Initial Ballard audit is zero; post-walk count is preserved as a separate scope.

Full matched scene/source comparison, exact path widths/heights, water datums and fish-ladder context remain open. Posed postcard/activity context cameras are labeled as such; actual continuous movement is recorded separately. These bounded corrections do not establish full tourist-scene acceptance.

## Reproduction

Serve an immutable archive of `5dc9792` on port 8197 (or pass `PORT`). Then run:

```sh
PORT=8197 SPOTS=ballard-locks,waterfront OUT=/tmp/tourist-public-targets \
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
node handoffs/fidelity/remaining-ro-districts/tourist-public-paths/native-targets-probe.cjs
```

The test uses real scene collision and native movement. Crowd OBBs are temporary planning inputs only for Waterfront; source arrays, scene bodies and populations are never mutated by the probe. `native-wall-probe.cjs` supplies the independent direct mesh-ray control. The source controller and renderer remain production components.
