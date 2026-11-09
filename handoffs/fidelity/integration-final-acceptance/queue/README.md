# Final native acceptance queue

Prepared from tooling45cea83. This queue is pending; no final result is implied. Root supplies an immutable integrated source snapshot after retaining-mouth, cell-frustum and final source/gameplay integration. The historical437soak PID204694 exited terminal-incomplete and is retained without restart. Use the current run launch manifest for its exact PID/source/status; never run a second heavy browser in this lane. Inspect `/proc/*/cmdline` and comm `MainThread`, and raw `frame-stage.json`/`profile.json`, before starting.

Set `QA_FREEZE_ROOT` to the immutable tested app snapshot and `QA_EVIDENCE_OUT` to a new directory named for its actual commit. Record the exact snapshot commit, tool commit45cea83, runtime source/data hashes, original release.json and command logs. Never reuse an incomplete output directory or relabel historical source captures. The tools below take ROOT explicitly; launch them from this QA worktree so its known bounded tooling is used. All launches are muted, use system Chromium and keep native source populations.

```sh
export NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules
export NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs
export QA_BRIDGE_TARGETS="$PWD/handoffs/fidelity/integration-final-acceptance/queue/bridge-targets.json"
export QA_BRIDGE_PAYLOAD="$PWD/handoffs/fidelity/integration-final-acceptance/queue/bridge-native-dump.cjs"
node game/dev/harness/integration-ui-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/phone"
PROBE_CHECKS=1 PROBE_CYCLES=2 BRIDGE_DUMP_PAYLOAD="$QA_BRIDGE_PAYLOAD" BRIDGE_DUMP_TARGETS="$QA_BRIDGE_TARGETS" node game/dev/harness/integration-transitions.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/transitions/report.json" auto chromium
node game/dev/harness/headlights-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/headlights-keyboard" keyboard high
node game/dev/harness/headlights-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/headlights-touch" touch auto
```

Run sequentially, preserving each command's stdout/stderr and return code. Inspect its complete raw report before moving forward; a timeout is incomplete evidence, never a passing check. Phone gate:37actual native controls/modal/map/recovery/layout checks and required portrait/landscape screenshots. Transition gate:15successful loads (Floreasca initial plus two seven-step cycles), native resource counts, weakrefs after garbage collection, context events, outgoing world/nav/traffic/player clearing at fetch, malformed replacement preservation and actual empty-fuel Continue. Inspect Pipera/Bellevue/SeaTac bridge dumps, including all 1/13/15 pinned historical source targets; require actual recomputed stats agreement and preserve unresolved source pairs. `QA_BRIDGE_PAYLOAD` must be the reviewed exported read-only bridge-dump function, not a runner or the unrelated asymmetric-pose tool. Payload reviewed at original-lane Git blob7cde0638df9a91a155ea3c0ecb3a7ffe3a1b5585 (current926f21d; payload unchanged fromed66388). Its reviewed bytes are copied beside the targets in this queue; preserve both hashes with the final run. Retain the existing S1601.929m/body2m contact explicitly; isolated slab checks do not imply all-pair clearance. A missing or changed payload remains a named coverage gap until reviewed.

The transition sequence is now initial Floreasca followed by Grozăvești, Pipera, Romană, Unirii, Otopeni, SeaTac and Bellevue, then that seven-district cycle again: **15 loads across all eight districts**. Cycle-end memory comparison remains Bellevue against Bellevue. Keep the existing malformed replacement/empty-fuel Continue, weakrefs, ownership, native bridge dumps and quality-release controls.

The runner requires frozen `integration-initial-body-audit.cjs` beside its frozen copy, in addition to `integration-browser-bounds.cjs`. Its read-only wrappers observe **before `attachWorldRender` and before the first actual world-scene renderer draw**, preserving the original receiver, arguments and return pointer. No simulation/warm-up steps or admission/clearance calls are added by this observer. Every phase immediately emits a plain-data record to `report.initial-body-audit.json`; all 15 normal loads require exactly both records. Continue's additional publication records are retained too. Raw positives remain even when the final gate fails; no warm-up issue slice is discarded.

Each snapshot retains actual active/pool IDs and poses, native targets/counts, model/body headings, emitted-model vertices transformed by native quaternion/scale/parent transforms into world Y intervals, and physical pedestrian IDs/XZ/cached foot Y. Full body-OBB pairs include every active vehicle even when its mesh is hidden; source-layer differences never exempt actual height intersections. Every positive XY pair is retained. The fixed failure threshold is **XY penetration >0.05m and actual vertical intersection >0m**; unknown or fallback-only active model bounds also fail acceptance and stay explicit. The player's front/rear centre offset and actual cockpit geometry height are audited separately. Body L/W scope excludes mirrors or accessories outside that nominal rectangle.

The observer retains only plain numeric/string records and weak geometry/scene keys; it does not retain outgoing world/actor objects. Stage heap observations include the intentionally retained audit records, whose count/approximate JSON bytes are recorded separately. No final browser result is implied by the CPU/model/pointer/static tooling controls in `proof/initial-body-audit-tooling/`.

Headlights gate: actual keyboard/touch cold toggles allocate zero new programs/shaders/light textures or targets; verify manual/Auto day/night/fog, travel and Settings state. Both native actions are binary; Auto is checked in the separate conditions protocol. Inspect required captures. Software-GL wall timings and emulated phones do not establish physical iPhone behavior or hardware FPS.

Telemetry runs last on root's committed, release-stamped snapshot. Root owns stamp mutation. First run the snapshot's read-only check, then the health fixture:

```sh
node "$QA_FREEZE_ROOT/tools/telemetry/stamp-release.mjs"
node game/dev/harness/telemetry-health-check.cjs --root="$QA_FREEZE_ROOT" --out="$QA_EVIDENCE_OUT/telemetry"
```

Require valid release fingerprint, actual final source/release context, correlated load/build/first frame, native key latency/program counters, bounded mode-specific summaries, failed replacement/Continue and interrupted-load breadcrumb handling, DNT/GPC/storage/early-error controls. The fixture fulfills production-origin assets locally with a capturing SDK stub and sends no test events to PostHog. Preserve deliberately injected errors distinctly. Final telemetry proof does not replace root's external dashboard/deployment checks.

The437soak retained900physical seconds and complete50-frame sun/cloud publication+fade, but exited without terminal finalFrame/relocation audit/finalPNG/complete flag. It is explicitly terminal-incomplete. Its generic-mouth compatibility is currently blocked: exact Romană retaining collision output changes271→268walls, cut count647→676. Keep the original source SHA and report. A later scope/reuse decision needs root's explicit evidence review; distance from Arnia alone is not exact source equivalence.


The later global pedestrian/vehicle guard candidate requires a new combined physical freeze. Root owns scheduling it, possibly in another lane while QA runs the sequential headlight/load matrix. The existing `integration-district-final-soak.cjs` runs the actual 900-second high/full-mirror and combined night/rain protocol on an explicit ROOT/OUT; keep its helper and source manifest beside the frozen runner. After its complete flag, final relocation audit, measured frame and all five inspected original captures exist, verify the exact intended commit explicitly:

```sh
node handoffs/fidelity/integration-final-acceptance/verify-district-soak.cjs "$QA_PHYSICAL_OUT" "$QA_FREEZE_SHA"
```

The verifier defaults to c78 only for its retained historical proof. It does not infer that a later actor runtime is compatible.
