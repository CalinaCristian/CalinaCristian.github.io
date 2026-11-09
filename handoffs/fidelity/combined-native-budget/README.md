# Combined native budget probe

**Prepared; not executed.** Await the final combined immutable source SHA. Earlier c78 performance numbers are not acceptance evidence for the later combined runtime or its evolved actors.

`probe.cjs ROOT OUTPUT FULL40SHA [GIT_REPO]` serves the exact archived production files. Before boot it verifies every archive file against the supplied Git tree, recording SHA256 and Git blob identities. It hashes each file actually served and verifies the entire archive again after the run. A nonempty output directory is rejected so an incomplete attempt cannot be overwritten.

The probe selects **high through the normal quality UI**, then uses the public Unirii free-roam start with summer, clear weather and rush time. The viewport is 1280 × 720 at device scale 1. Production FOV, near/far planes, native populations, trees, mirror, shaders, geometry, indices and LOD remain in use. There are no served-source substitutions or camera-property assignments. The source harness controls fixed-step scheduling at 30 Hz; its reduced-far/half-resolution screenshot scheduler is replaced only with a call to the unchanged full production draw path. Every counted frame includes the mirror.

The first 150 m of the native route to GTS is driven using navigation and ordinary input controls. There is **no extra player placement, traffic clearing or population edit**. The report retains the native start, target, actual endpoint, simulated duration, path trace, contacts and harness issues. Distance from the historical hotspot is recorded; an endpoint over 30 m away is flagged as a coverage gap.

After the drive, summer and winter each receive forward/left/back/right warm and sample frames at the evolved endpoint. These are **stationary orientation QA**, separately labelled from movement proof: only player heading and vehicle-rig yaw are changed, then restored. No camera transform, FOV or projection is assigned. NPC state and identities must remain unchanged throughout these draw-only controls, and the inherited native FOV/near/far must remain equal. This scope intentionally preserves the evolved actor arrangement rather than claiming four new physical drives.

Native reflection stepping, clock functions and render callbacks remain intact. If no progressive reflection job is pending, the probe makes one explicit render-only request through the unchanged native builder and records that fact. All resulting draws, including warm frames, count toward the limits. The draw observer calls the original `renderBufferDirect` with the original receiver/arguments and records its actual counter differences; it does not select geometry or change render state. Unknown post/reflection blur draws remain included under `other` rather than being excluded from totals.

Acceptance requires every recorded complete frame to remain within 400 calls / 1,500,000 triangles, with main/mirror/true-shadow passes present, native settings retained and NPC invariants satisfied. Images, full per-draw records, per-pass totals, actual source population IDs and source hashes are retained. Warm frames are never discarded from the maxima. SwiftShader elapsed time is not hardware FPS evidence. This narrow render probe does not replace physical collision, pedestrian, source geometry or destination acceptance.

After root provides the final SHA, create a fresh immutable archive of `game`, `public` and `package.json`, inspect existing process arguments before starting another browser, then run:

```sh
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node --require ./browser-preload.cjs ./probe.cjs \
  "$SOURCE" "$OUTPUT" "$FINAL_SHA" /workspace/CalinaCristian.github.io
```

The external preload selects installed muted Chromium, uses bounded waits and saves compositor screenshots without requesting an additional game draw. Review the final raw report and all images before recording acceptance. Preserve failures as separate dated attempts; do not edit production runtime files in this lane unless root explicitly authorizes a response to a measured combined failure.
