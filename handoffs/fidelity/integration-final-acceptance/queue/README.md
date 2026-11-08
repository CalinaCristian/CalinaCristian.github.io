# Final native acceptance queue

Prepared from tooling45cea83. This queue is pending; no final result is implied. Root supplies an immutable integrated source snapshot after retaining-mouth, cell-frustum and final source/gameplay integration. The historical437soak PID204694 exited terminal-incomplete and is retained without restart. Use the current run launch manifest for its exact PID/source/status; never run a second heavy browser in this lane. Inspect `/proc/*/cmdline` and comm `MainThread`, and raw `frame-stage.json`/`profile.json`, before starting.

Set `QA_FREEZE_ROOT` to the immutable tested app snapshot and `QA_EVIDENCE_OUT` to a new directory named for its actual commit. Record the exact snapshot commit, tool commit45cea83, runtime source/data hashes, original release.json and command logs. Never reuse an incomplete output directory or relabel historical source captures. The tools below take ROOT explicitly; launch them from this QA worktree so its known bounded tooling is used. All launches are muted, use system Chromium and keep native source populations.

```sh
export NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules
export NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs
export QA_BRIDGE_PAYLOAD=/workspace/fidelity-workers/original-districts-refresh/handoffs/fidelity/original-districts-refresh/scenery-bridge-native-dump.cjs
node game/dev/harness/integration-ui-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/phone"
PROBE_CHECKS=1 PROBE_CYCLES=2 BRIDGE_DUMP_PAYLOAD="$QA_BRIDGE_PAYLOAD" node game/dev/harness/integration-transitions.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/transitions/report.json" auto chromium
node game/dev/harness/headlights-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/headlights-keyboard" keyboard high
node game/dev/harness/headlights-check.cjs "$QA_FREEZE_ROOT" "$QA_EVIDENCE_OUT/headlights-touch" touch auto
```

Run sequentially, preserving each command's stdout/stderr and return code. Inspect its complete raw report before moving forward; a timeout is incomplete evidence, never a passing check. Phone gate:37actual native controls/modal/map/recovery/layout checks and required portrait/landscape screenshots. Transition gate:15successful loads (Floreasca initial plus two seven-step cycles), native resource counts, weakrefs after garbage collection, context events, outgoing world/nav/traffic/player clearing at fetch, malformed replacement preservation and actual empty-fuel Continue. Inspect Pipera/Bellevue bridge dumps; require actual recomputed stats agreement and preserve unresolved source pairs. `QA_BRIDGE_PAYLOAD` must be the reviewed exported read-only bridge-dump function, not a runner or the unrelated asymmetric-pose tool. Payload reviewed at original-lane Git blob7cde0638df9a91a155ea3c0ecb3a7ffe3a1b5585 (current926f21d; payload unchanged fromed66388). Preserve its bytes/hash with the final queue run. Retain the existing S1601.929m/body2m contact explicitly; isolated slab checks do not imply all-pair clearance. A missing or changed payload remains a named coverage gap until reviewed.

Headlights gate: actual keyboard/touch cold toggles allocate zero new programs/shaders/light textures or targets; verify manual/Auto day/night/fog, travel and Settings state. Inspect required captures. Software-GL wall timings and emulated phones do not establish physical iPhone behavior or hardware FPS.

Telemetry runs last on root's committed, release-stamped snapshot. Root owns stamp mutation. First run the snapshot's read-only check, then the health fixture:

```sh
node "$QA_FREEZE_ROOT/tools/telemetry/stamp-release.mjs"
node game/dev/harness/telemetry-health-check.cjs --root="$QA_FREEZE_ROOT" --out="$QA_EVIDENCE_OUT/telemetry"
```

Require valid release fingerprint, actual final source/release context, correlated load/build/first frame, native key latency/program counters, bounded mode-specific summaries, failed replacement/Continue and interrupted-load breadcrumb handling, DNT/GPC/storage/early-error controls. The fixture fulfills production-origin assets locally with a capturing SDK stub and sends no test events to PostHog. Preserve deliberately injected errors distinctly. Final telemetry proof does not replace root's external dashboard/deployment checks.

The437soak retained900physical seconds and complete50-frame sun/cloud publication+fade, but exited without terminal finalFrame/relocation audit/finalPNG/complete flag. It is explicitly terminal-incomplete. Its generic-mouth compatibility is currently blocked: exact Romană retaining collision output changes271→268walls, cut count647→676. Keep the original source SHA and report. A later scope/reuse decision needs root's explicit evidence review; distance from Arnia alone is not exact source equivalence.
