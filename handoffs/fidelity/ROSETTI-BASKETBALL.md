# Rosetti basketball challenge

Feature branch: `fidelity/rosetti-basketball`.

Base: `035af4c` (origin `fix/dinamo-and-ambasador`). Dependencies cherry-picked before the feature:

- `931f6c4` reproduces `0ba575def3bc08a621a2ca20c7704c1ed7d7ca31` (native mobile tourist controls).
- `d3ce04d` reproduces `30b466c54487c1c538fd81385f69e76b34005185` (district lifecycle disposal).

The root integrator should cherry-pick only the feature commit(s) when those dependencies are already present. README/spec/STATUS changes belong to the root's integrated feature documentation.

## Player behavior

A regulation-size orange basketball rests at the center of Rosetti's existing west red court. On foot within reach, use the visible **Pick up** button or E. Hold the ball, aim with the normal mouse/right-side touch look, and follow the dotted predicted trajectory. Use **Throw** or E to shoot; **Drop** or B releases it without scoring eligibility. Throw speed is fixed. The release has a fixed upward lob so the hoop stays visible; a preview that passes through a hoop turns green. The actual physical throw must carry the entire ball downward through an existing rim before hidden achievement **After-school hoops** (`rosetti-basket`) unlocks. Repeated baskets reuse progression's existing id/timestamp persistence.

All four existing hoops can score. The ball and preview come from a shared fixed 240 Hz integrator: gravity, damped floor bounce, authored rectangular backboard face bounce, rim contact, and swept full-ball scoring. Side entries, upward passes, unthrown/dropped balls, and repeated frames cannot award a basket. A ball that strays beyond the courts' derived bounds or rests for a while returns to the court; a fresh district visit also starts there.

## Source geometry and resources

`bRosetti` forwards two court polygons, their existing cap heights, and each hoop's rim/backboard dimensions directly from the same builder variables used to draw them. No court, hoop, board, footprint, gate, fence, collider, or source position changes. Runtime resolves the landmark mesh and uses its model/world transform, with district mode only.

The moving ball uses a locally generated seam texture and 168 triangles; both low-poly hands total 24 triangles. The round dotted preview uses a single points draw and no triangles. While aiming the feature adds 192 triangles and four draw calls, with no shadow pass. Only the ball draws while resting or in flight. There are no downloaded/network ball assets or new dependencies.

## Integration hooks

`main.js` imports/creates/disposes `createRosettiBasketball(game)` with the district; calls `syncActivity()` before drone/modal early returns; updates physics only while its foot controls are available; calls `updateFoot()` after the normal walker update; and cancels immediately at map, pause, leaving-foot/office, and sidewalk-reset boundaries. `syncActivity()` handles pause/map/photo/conditions/panels/achievements/drone/office/car transitions and detects teleports. Cancellation hides local controls, clears pending score eligibility, and returns a held ball to the court. Paused and other-mode frames skip ball physics. District disposal removes all meshes, textures, buffers/materials and the controls DOM.

Only the local `#basketball-controls` block is added to CSS. Both action buttons have minimum 44 px targets and invoke the same guarded pickup/throw/drop actions as desktop input.

## Verification

- `node game/dev/harness/basketball-check.mjs`: 16/16 deterministic checks.
- `node game/dev/harness/football-check.mjs`: existing Dinamo checks remain 13/13.
- ES module syntax and `git diff --check` pass.
- Initial court screenshot was visually inspected: orange ball rests at the existing court marking, correctly scaled, with original hoops and court intact.

- Required `foot,a` Bucharest regression from the feature snapshot: **0 high / 0 medium**, 2 low informational/shared-software-GL performance findings.
- Native desktop: visible-button pickup, 6.50 m of real walking, native right-mouse look, green shared preview and real Throw click made a basket.
- Native phone: 390×844 touch joystick running, right-side touch look and actual Throw tap made a second basket. Timestamp stayed identical; reload retained the achievement.
- Reachability: Navigator finds 1,674.33 m from the real chapter spawn to Garibaldi's existing gate approach. The normal walker then physically followed the continuous-collider route through that existing entrance: **133.156 m / 3,158 × 25 ms frames**, no block, ending in pickup reach. This composed route proof preserves every source fence, gate and collider; it does not claim a single uninterrupted native walk of the entire district road leg.
- Pause's actual game loop froze the ball; pause/map/photo/conditions/drone/office/car/teleport cancellation checks passed. Actual drone deploy and abort were used.
- On replacement with Romană: all three feature roots detached; all **3 geometries / 3 materials / 2 textures** disposed exactly once; UI removed; no basketball in the new world; repeat disposal was harmless.
- Final screenshots were visually inspected at **1280×720**, **390×844**, and **844×390**. Phone panel/fuel no longer overlap; all local buttons are at least 44 px. The round dots remain visible against sky, and the original rim remains visible below the controls.
- Final representative frames (normal traffic: desktop 142 moving + 2 parked): desktop **442,774 triangles / 284 calls**, portrait **381,253 / 64**, landscape **436,296 / 97**, under 1.5 M / 400. The mirror is hidden on foot. This verifies the feature frames; the root's full combined district/traffic/mirror budget survey remains the integration authority.
- Zero browser page errors. Machine-readable evidence is in `handoffs/fidelity/rosetti-basketball-results.json`.

Runtime artifacts are outside the checkout at `/workspace/reality-pass/rosetti-basketball/`: `browser-results.json`, `desktop-aim-final.png`, `phone-aim-final.png`, `landscape-aim-final.png`, native automation helpers, and `regression/latest.md`. No Google imagery or external ball assets were used.
