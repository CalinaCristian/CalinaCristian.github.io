# Mobile district transition lifecycle

Reported: iPhone 16 Pro, Chrome, Floreasca → Politehnica/Grozăvești appeared to return to the initial screen; Continue restored Floreasca and retry succeeded. The report establishes a real interruption, not its cause. Local Chromium mobile emulation reproduces resource accumulation; it has not reproduced the reported tab reset. Root separately queried PostHog: no captured exception/context-loss event proves a hard tab kill absent, and the existing telemetry has no load-start event.

## Scope and ownership

Based on immutable `65ba08d639d4367288e1647cacd34bbb44e683c5`. Main changes are city replacement/disposal and saving the last stable session before travel. Renderer changes release scene references, obsolete post-processing/shadow targets and superseded environment maps. `sceneResources.js` distinguishes district resources from persistent cockpit/renderer rigs and cached tree/vehicle/landmark templates. One authorized `world.js` line declares ownership of the facade shader's hidden night/window textures; preserve the facade worker's neighboring hook metadata when integrating it.

No district geometry, source data, traffic behavior, drone behavior, pause controls or quality presets were changed. Tourist visits continue retaining their street world for the return trip.

## Findings

- Previous `loadCity` disposed only unmarked geometry. The old world, navigator, traffic, minimaps, renderer scene and player scene still existed while the replacement world was fetched/built. Traffic disposal happened after building the replacement.
- The scene traversal included the persistent cockpit rig. Its geometry was disposed immediately before reusing it.
- Textures/materials and `InstancedMesh` instance buffers were not generally disposed. Facade night/window textures existed only inside shader closures. Crowd teardown removed its instance attributes before `BufferGeometry.dispose()` could free their GL buffers.
- Fleet/parked/crowd wrapper geometries share cached model position/normal/index attributes. Cleanup detaches those base attributes and disposes the owned instance attributes, retaining the cached templates.
- Inactive bloom/SMAA/GTAO passes owned render targets even after removal from the composer. Disabling sun shadows also retained the old shadow target.
- Heap-snapshot proof found an additional CPU retainer: permanent `#minimap` canvas → registered click listener → anonymous closure → the `MiniMap` constructor's lexical context → `world`. The sibling asynchronous places callback captured `world` in that same context. Clearing `canvas.__mm` alone did not release it. The authorized `minimap.js` hunk moves the identical handler to module scope and obtains the current map through `event.currentTarget.__mm`; the mobile-controls worker confirmed no overlap.

## Heap retainer verification

Identical Floreasca load → `disposeCity()` → discard debugger console entries → forced GC:

| Measure | Before moving the minimap listener | After |
|---|---:|---:|
| Retired world WeakRef | alive | collected (`undefined`) |
| V8 ArrayBuffer backing storage | 573,060,901 bytes | 7,157,357 bytes |
| V8 used JavaScript heap | 35,807,784 bytes | 12,018,892 bytes |

These values describe a controlled, disposed-scene Chromium heap, not total browser RSS or hardware GPU memory. In the final travel replay, the collected-heap Grozăvești sample has 398,610,345 backing bytes and the retired Floreasca world is collected; the earlier retained-first-world replay had 964,513,587 bytes. Final replay records WeakRef status for every retired world. This demonstrates removal of a real old-world allocation overlap without assigning the original iPhone reset a confirmed cause.

## Measured repeated travel

Mobile viewport 393×852, device scale factor 3, touch enabled, system Chromium/SwiftShader, muted audio. High tier keeps the existing 1.5× cap; Auto starts at the existing mobile low+ tier at 1×. Explicit frames include the mirror. Sequence: Floreasca → Grozăvești → Romană → Floreasca → Grozăvești → Romană → Floreasca.

| Profile / source | Floreasca textures, initial → first return → second return | Live GL buffers at those returns |
|---|---|---|
| High baseline | 37 → 64 → 92 | 1056 → 1408 → 1741 |
| High candidate | 37 → 36 → 36 | 1056 → 1088 → 1098 |
| Auto baseline, CPU 2× throttle | 21 → 48 → 76 | 1050 → 1402 → 1735 |
| Auto candidate, CPU 2× throttle | 21 → 20 → 20 | 1050 → 1082 → 1092 |

High Romană repetitions both report 37 textures / 1002 buffers; Auto Romană repetitions both report 21 textures / 973 buffers. Small Floreasca buffer/geometry changes include cached fleet variants. Sampled high frames stay below 1.023 million triangles / 292 calls; Auto samples below 0.878 million / 255. All source buildings, trees and world geometry remain present.

These are live GL object counts and uploaded-buffer byte counters, not total hardware VRAM. Chromium software rendering, CPU throttling and concurrent worker browsers do not establish iPhone performance. Post-GC heap readings from earlier diagnostic runs are not a product-memory result: retaining console argument handles can itself retain logged build objects. The committed runner releases those handles and discards console entries, and reports retired worlds through WeakRefs.

## Verification and reproduction

Unit tests: `node --test game/dev/harness/scene-resources.test.mjs game/dev/harness/minimap-lifecycle.test.mjs` (4/4). They check persistent/cached resource preservation, owned shader texture disposal, instance/base buffer ownership, removal of disposed water materials from the registry, and unchanged legend coordinates/event routing to the current map with one permanent listener.

Browser runner: `PROBE_CYCLES=2 PROBE_CHECKS=1 NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node game/dev/harness/district-transitions.cjs ROOT OUT.json auto`. `PROBE_CPU_RATE=2` enables Chromium CPU throttling. `PROBE_CYCLES=0 PROBE_CHECKS=1` performs a shorter ownership/failure/Continue/quality smoke. Browser checks assert retained-world fields are null at the replacement fetch and compare the warmed repeat's resource counts. They inject invalid JSON for one Grozăvești load and check the stable saved district/fuel, single failed request, same document generation, Continue restore and high→Auto target cleanup.

The completed high resource run has no application exception, context loss or navigation reset, but its final screenshot timed out after 30 seconds under concurrent software rendering. That failure is retained. The final runner allows 120 seconds for screenshots. Baseline Auto, candidate Auto and final failure/Continue smoke screenshots were inspected and show buildings/trees/street/cockpit/mirror, with no blank-world fallback.

Failure/Continue checks passed on full-cycle Auto and a separate high smoke: one invalid-JSON Grozăvești request returns `false`, clears loading and returns to the menu in document generation 1. Continue remains available and restores Floreasca, the saved coordinates and fuel 0. High→Auto releases bloom/SMAA/sun-shadow targets; textures fall 36→20 in the separate smoke and the existing Auto low+ tier has four lamp slots. There is no automatic retry or progress reset. The deliberately injected parse error is recorded as a console error; there are no unhandled application errors/context losses.

Required `foot,a` harness: both scenarios add zero issues, final report **0 high / 0 medium / 1 low** (the inherited software-GL FPS note). This run preceded the final progression-cache clearing and minimap-listener hunk; final full travel/ownership/legend checks cover those changes, and root must still run combined-source QA. The local harness's 400-second wall time under competing software browsers is not a performance claim.

WebKit was attempted: the official Playwright browser download succeeded, but launch is blocked by missing host libraries `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, `libGLESv2.so.2`. This executor has no sudo/scoped installer and no apt package metadata. No TLS verification was disabled. Linux WebKit, even if available, would not establish behavior on the reported iPhone.

Root must run combined-source QA after integrating the newer Romană parts/data and other workers. The owner must retry the original route on the iPhone; this patch addresses verified lifecycle faults without claiming a measured cause of the original reset.

Final browser failure/Continue, visual and mandatory foot/a results are recorded in [`mobile-transition-results.json`](mobile-transition-results.json). The final full replay reports all seven retired worlds collected, including the district disposed for the deliberately failed trip; the warmed repeated cycle adds zero textures and ten buffers/two cached fleet geometries. The final screenshot was inspected. No unhandled exception, context loss or document navigation occurred.
