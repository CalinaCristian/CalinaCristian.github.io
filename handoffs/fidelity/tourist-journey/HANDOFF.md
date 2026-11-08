# Tourist journey core handoff

Worktree: `/workspace/fidelity-workers/tourist-journey`, branch `fidelity/tourist-journey`, based on `a786ba6`. Own changes: `spots/index.js`, `spots/ui.js`, new `spots/tour.js`, regression tool, this evidence folder. No registry, readiness, scene geometry, world data, achievement catalogue, root README or specs changes.

## Concrete diagnosis

Real-load baseline is retained in `baseline.json`. Pike originally sent the player through three plaques before an activity. Herăstrău selected a landmark, four plaques and a photo, without its bike/boat. Gas Works selected about 359 m of actual path despite a 350 m selection budget because the budget used straight distances and appended the postcard afterwards. Needle selected six stops including another scene member's hero, and baseline Seattle Center has **1,113,342 scene triangles**, already over the 1 M budget. Geometry/readiness remain with the portfolio work.

Code defects fixed: A* accepted a closest reachable point up to 45 m from a stop; appended a blocked exact endpoint merely because a grid cell was within 2.2 m; smoothing tested neither exact segment collision nor step heights; oversized searches returned an unchecked straight line. The guide snapped next to the player if the player reached a stop first, and its local steering still committed the final attempted move when all choices collided. Empty routes dereferenced an undefined stop. Six seconds of narration marked activities seen without participation. Opening map/camera or flying the drone did not pause tour advancement. Shared-scene teleport changed only `id`, retaining old title, entry, spawn, current route and tour.

## Result

The optional short tour chooses one currently eligible activity first, then a reachable nearby fact and the active entry's postcard. If no activity is reachable it can use the active entry's view/hero. Every planned leg is measured before inclusion; up to **three stops / 180 m**. A strict route cannot substitute a distant location. All content remains in free exploration and on the map.

Activity stops wait for a real E interaction; photo stops wait for the photo hook to satisfy the real postcard challenge. Trying an activity is participation in the tour, not an activity achievement (the scene still owns success). Narration grants no activity, plaque-read or postcard completion. A skipped route never grants the tour achievement. Skip/End controls and the map's End button return to exploration. Guide movement is continuous and checks collision, water and steps; blocked alternatives leave it stationary. Route material is disposed when rebuilding.

Shared-scene teleport cancels the active tour, refreshes objectives, and synchronizes `id/name/entry/spawn`, title and photo caption. **Limitation:** it does not teleport the guide. A guide at a remote previous entrance may have no safe short route; the UI reports this instead of sending the player on a long walk. Entering that spot normally creates its local guide. Existing seasonal restrictions hidden inside a scene's `use()` cannot be inferred by generic core; scenes can expose them with `cond` or optional `tourAvailable`.

New backward-compatible API: `SpotSession.endTour()`, `skipTourStop()`; optional `interactable.tourAvailable(session) -> boolean` is checked alongside `cond` and explicit `y` before tour selection. `objectives()` retains old fields and adds references/ids used internally. `startTour()` returns false for a safe empty route. Existing callers ignoring its return still work.

## Verification

Run from repository root:

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node tools/tourist-tour-check.mjs --out=/tmp/tourist-tour-check
```

The tool starts its own static server and muted Chromium. Final result: **58/58 passed, zero runtime map/tour errors**. Raw findings and visually inspected rendered screenshots are in `final/`; intermediate failed/partial runs are retained in `regression-1/2/3/` (first run had a test-server path bug; second over-assumed a remote guide could restart a local short tour immediately). Synthetic fixtures cover obstacle detour budget, enclosed goals, blocked exact endpoints, cliffs, deep water and oversize input. Real loads cover Pike, Fremont, Gas Works, Needle→Chihuly→MoPOP, Herăstrău→Village and Old Town. Pike uses the actual interaction dispatch and photo hook, walks the full route, persists tour completion exactly once, and verifies no fake fish/catch achievement. Runtime pause, unavailable/upper-floor objectives, empty routes, and actual Skip/End UI controls are checked. Screenshots are for tour UI/layout; scene fidelity is assessed by the separate portfolio audits. Every edited JS module passes syntax, and `git diff --check` passes.

Representative safe routes (metres rounded, not a guarantee of visit duration):

| Entry | Planned route | Metres |
| --- | --- | ---: |
| Pike Place | Ask fishmongers → flying-fish fact → photo | 89 |
| Fremont Troll | Climb hand → Troll fact → photo | 62 |
| Gas Works | Fly kite | 75 |
| Needle | Hero view → 605 feet → photo; elevator door not safely reachable | 176 |
| Chihuly | Suspended sculpture → Glasshouse fact → photo | 154 |
| MoPOP | Monorail activity | 165 |
| Herăstrău | Bike → Many names → photo | 42 |
| Village Museum | Ieud household | 69 |
| Old Town | Carusel level 1 → Carusel fact → photo | 107 |

For an activity-first two-to-five-minute design, prioritize compact Pike/Fremont/Herăstrău routes. Gas Works can work as a single kite/view visit. Needle access and Seattle Center budget need scene work before promoting its tour; MoPOP's spawn-to-activity walk is long for one stop. Village Museum can offer one household as the quick visit while preserving the full museum as optional wandering. These are recommendations, not content removals or READY changes.

## Root documentation integration

README/spec15 should describe optional short tours, ≤3 stops/180 m of validated path, activity participation and real postcard capture, Skip/End, pause during map/photo/drone/rides, and retained free exploration. Architecture can add `endTour/skipTourStop` and optional `tourAvailable`. Spec23 should state that scene-owned activity successes remain unchanged and skipped tours do not grant completion. Log the final regression count and raw findings location; root integration owns global foot/a and main/save/Explore regressions.
