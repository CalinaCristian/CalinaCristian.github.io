# Asymmetric pavement consumers

Production **3afcb4b**, based on combined staging **5e069d5**, consumes the field contract from Pipera **7bbc64d**. Source XY stays unchanged. The canonical signed `edge.laneCenterShiftM` is added once along `edge.nx`; `laneOffset(e, lane, dir)` returns the travel-relative offset, so its caller's existing multiplication by `dir` places both directions correctly. A shared lane has one physical centre for both graph directions.

Direction now reaches traffic/tram placement, current/previous/next long-body path points, junction reservations, lane changes, bypass and tow placement. Game road poses, legacy city spawns, district world spawns, resets and fast-travel route poses consume the same shift. Player surface selection, shared-lane player occupancy and roadside checks use the measured pavement sides. Shared-lane reservations, batching, rear-clearance generations and light rules remain active.

The pure check runs **23 tests**, including all **18 existing shared-lane fairness tests** and the existing moving/stationary vehicle regression. New controls cover unequal forward/backward lane counts, one-way negative medians, reverse graph ordering, long bodies, trams, absent-shift legacy behavior, shifted player occupancy and physical width bounds.

The native controlled-pavement fixture runs actual `Traffic.update` for **2,400 frames at 30 Hz** per case. Ordinary pavement shifts 2 m; shared pavement shifts 1 m; the intermediate edge reverses prepared direction. Straight, timed-light, player and batch cases run both cars and buses; an additional bus platoon case checks opposite-waiter fairness. All **nine cases** retain their full populations and complete traversal with zero body contacts, player contacts, off-pavement bodies, conflicting reservations, teleports, stationary slides, ghosts or red entries. The body-length, wait, claim, signal and raw trajectory controls remain in the losslessly compressed reports. These are controlled geometry checks, not source-world fidelity claims.

Another browser check invokes actual Game prototype methods with controlled asymmetric edge contracts. All **12 pose/spawn/route/foot-reset cases** pass, including reverse lanes physically on the canonical right and shared-service fallback resets. RAF is disabled for that method check; it does not claim full world or native mobile UI coverage.

`proof/source-hashes.json` identifies the frozen six runtime files. Every raw native report has a SHA-256 and gzip copy; `native-summary.json` retains the uncompressed local artifact path. The two pictures show the native bus batch before and after traversal. No external telemetry events or provider imagery are used.

```sh
node --test game/dev/integration-asymmetric-lanes.test.mjs game/dev/shared-lanes.test.mjs game/dev/vehicle-lanes.test.mjs
node handoffs/fidelity/integration-asymmetric-consumers/verify.cjs
node game/dev/harness/integration-asymmetric-check.cjs --root=SNAPSHOT_ROOT --out=/tmp/asymmetric-bus --case=batch --long
node game/dev/harness/integration-asymmetric-poses.cjs SNAPSHOT_ROOT /tmp/asymmetric-poses
```

Chromium launches are muted and use SwiftShader. No physical hardware FPS or iPhone equivalence is claimed. Mandatory all-eight-source logic, native UI, evolving population soak and repeated-world memory checks remain pending the final integration freeze. Root owns README/spec consolidation and deployment.
