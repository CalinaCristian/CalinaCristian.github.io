# Final combined physical soak — prepared, not launched

Owner: `fidelity/final-physical-soak`, worktree `/workspace/fidelity-workers/final-physical-soak`. Root must supply the actual full FINAL freeze SHA before this lane archives or starts the final browser. The current c78 proof remains historical. The tourist worktree's two original dirty files are untouched.

Reviewed instructions: `../integration-final-acceptance/queue/README.md`, retained `proof/soak-c78a5f4/REVIEW.md`, runner `game/dev/harness/integration-district-final-soak.cjs`, helper `integration-browser-bounds.cjs`, and strict `verify-district-soak.cjs`. Runner lineage: commit `444f96c3b9b0b303c008eaf62ada74434a82ac04`; preparation begins at root `11058d861cad31b64e64056b42f6f40531aa6a27`. Runner/helper/verifier syntax checks pass without starting a browser.

After root supplies FINAL, use a fresh evidence base named for that actual source. The preparation script archives exact committed game runtime/public files, verifies every extracted Git blob, records SHA-256 source hashes, preserves the original release bytes, and freezes the known committed runner/helper/verifier beside OUT. It refuses to reuse an existing evidence directory and does not launch a browser.

```sh
python handoffs/fidelity/final-physical-soak/prepare-freeze.py "$QA_FREEZE_SHA" "$QA_PHYSICAL_BASE"
export NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules
export NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs
export SOAK_WALLCLOCK=1
node "$QA_PHYSICAL_OUT/runner.cjs" "$QA_FREEZE_ROOT" "$QA_PHYSICAL_OUT" 15
node "$QA_PHYSICAL_OUT/verify-district-soak.cjs" "$QA_PHYSICAL_OUT" "$QA_FREEZE_SHA"
```

Set `QA_FREEZE_ROOT` to the printed `sourceRoot` and `QA_PHYSICAL_OUT` to the printed `out`. Record actual PID, command, start time and exit code in launch metadata; keep stdout/stderr in `runner.log`. Before starting, inspect actual `/proc/*/cmdline` (`MainThread` is a normal Node comm name), existing launch manifests and raw progress; do not duplicate an existing heavy soak. No diagnostic-only flag is allowed. A stale or incomplete output directory is retained, never restarted or relabelled.

Acceptance requires native **560 pedestrian / 631 vehicle identities** throughout **900 physical seconds**, with the wall guard retaining at least 900 wall seconds before evolved conditions. Retain all source actors, high quality/full post processing, native far plane and actual mirror. Every measured complete frame must stay under 1,500,000 triangles / 400 calls, with matching raw/logical counters, zero errors, visible snaps and stalled recoveries. Inspect actual initial publication and combined night/rain publication through their complete frames and fade1; the retained protocol produced50 frames in each transition. Do not infer completion from a pending job or an early subset.

Require terminal relocation audit, `finalFrame`, `evolved-final.png`, full lifecycle and `complete:true`. Inspect all five original PNGs (`minute-0`, `minute-5`, `minute-10`, `minute-15`, `evolved-final`). Run the strict verifier with OUT **and the exact supplied40-character FINAL SHA**, not its historical default. Preserve all original reports, logs, PNGs, hashes and failure states. Compress/copy portable evidence only after the run ends, keeping original sources and dates. Root owns any runtime fix, final source/release stamp, other QA lanes, integration and global documentation.
