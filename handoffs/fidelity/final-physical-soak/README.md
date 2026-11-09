# Final combined physical soak — prepared, not launched

Owner: `fidelity/final-physical-soak`, worktree `/workspace/fidelity-workers/final-physical-soak`. Root must supply the actual full FINAL freeze SHA before this lane archives or starts the final browser. The current c78 proof remains historical. The tourist worktree's two original dirty files are untouched.

Reviewed instructions: `../integration-final-acceptance/queue/README.md`, retained `proof/soak-c78a5f4/REVIEW.md`, runner `game/dev/harness/integration-district-final-soak.cjs`, helper `integration-browser-bounds.cjs`, and strict `verify-district-soak.cjs`. Runner lineage: commit `444f96c3b9b0b303c008eaf62ada74434a82ac04`; preparation begins at root `11058d861cad31b64e64056b42f6f40531aa6a27`. Runner/helper/verifier syntax checks pass without starting a browser.

After root supplies FINAL, use a fresh evidence base named for that actual source. Final runs **must use `--runtime-only`**. The preparation script archives exact committed game runtime/public files, verifies every extracted Git blob and the complete copied/servable file set, records SHA-256 source hashes, preserves the original release bytes, and freezes the known committed runner/helper/verifier beside OUT. It refuses to reuse an existing evidence directory and does not launch a browser.

```sh
python handoffs/fidelity/final-physical-soak/prepare-freeze.py "$QA_FREEZE_SHA" "$QA_PHYSICAL_BASE" --runtime-only
export NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules
export NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs
export SOAK_WALLCLOCK=1
node "$QA_PHYSICAL_OUT/runner.cjs" "$QA_FREEZE_ROOT" "$QA_PHYSICAL_OUT" 15
node "$QA_PHYSICAL_OUT/verify-district-soak.cjs" "$QA_PHYSICAL_OUT" "$QA_FREEZE_SHA"
```

For durable PID/start/exit metadata, `python handoffs/fidelity/final-physical-soak/launch-soak.py "$QA_PHYSICAL_OUT" "$QA_FREEZE_SHA"` runs that exact Node argument list with the prepared environment and preserves stdout/stderr in `runner.log`. It refuses any previously launched OUT or another active district soak and never retries. Do not execute the direct Node line and this wrapper both.

Runtime-only selection keeps `game/src`, `data`, `vendor`, `assets`, game HTML/style, public/package files and the actual `game/dev/harness/page/**` browser modules. Static dependency discovery adds any specifically imported harness helper/assets outside that subtree, without copying developer galleries. Root HTML/CSS/JS/canvas and the read-only release-stamp script are retained so its fingerprint inputs stay faithful. Exact `game/release.json` bytes are preserved when committed; the older `game/meta/release.json` is also preserved if present. No missing pre-stamp release file is manufactured.

`source-manifest.json` lists every included file/blob/SHA, total bytes, initial included prefixes, required dependency exceptions, omitted overview/research/dev file counts and bytes, and explicit partial-archive scope. `dependency-audit.json` records V8 syntax/static-module parsing **without evaluating shipped JavaScript**, literal dynamic imports/new-URL references, HTML/CSS subresources and conservative committed template-prefix candidates. Missing modules/assets, syntax errors, unresolved dynamic module expressions or repository escapes fail preparation; they never cause a live-worktree or shipped-source fallback. Every copied file is verified after extraction, including files not on a specific exercised path.

Without `--runtime-only`, the legacy bulk-dev archive remains explicitly labelled `legacy-bulk-dev`; it is not the final900 mode. Static preparation tests may create disposable Git fixture archives or a temporary named-source archive while FINAL remains HOLD. These tests never launch Chromium, never count as the final soak, and leave no reusable final OUT. Run the fixture controls with `PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/final-physical-soak/test_prepare_freeze.py`.

The retained [06d static controls](preparation-controls-06d471c4/README.md) verify219 exact-source files (113.61MiB), including all208 files used by QA's native minimal snapshot, six browser harness modules and root/stamp support. Reproduce that disposable comparison with `test_runtime_archive.py FULL_SHA PRIOR_QA_MANIFEST NEW_REPORT_DIR`; it checks copied file/blob/SHA parity, static dependencies and frozen tool syntax, then removes its temporary source and OUT. This source is a preparation control, not the awaited FINAL source.

Set `QA_FREEZE_ROOT` to the printed `sourceRoot` and `QA_PHYSICAL_OUT` to the printed `out`. Record actual PID, command, start time and exit code in launch metadata; keep stdout/stderr in `runner.log`. Before starting, inspect actual `/proc/*/cmdline` (`MainThread` is a normal Node comm name), existing launch manifests and raw progress; do not duplicate an existing heavy soak. No diagnostic-only flag is allowed. A stale or incomplete output directory is retained, never restarted or relabelled.

Acceptance requires native **560 pedestrian / 631 vehicle identities** throughout **900 physical seconds**, with the wall guard retaining at least 900 wall seconds before evolved conditions. Retain all source actors, high quality/full post processing, native far plane and actual mirror. Every measured complete frame must stay under 1,500,000 triangles / 400 calls, with matching raw/logical counters, zero errors, visible snaps and stalled recoveries. Inspect actual initial publication and combined night/rain publication through their complete frames and fade1; the retained protocol produced50 frames in each transition. Do not infer completion from a pending job or an early subset.

Require terminal relocation audit, `finalFrame`, `evolved-final.png`, full lifecycle and `complete:true`. Inspect all five original PNGs (`minute-0`, `minute-5`, `minute-10`, `minute-15`, `evolved-final`). Run the strict verifier with OUT **and the exact supplied40-character FINAL SHA**, not its historical default. Preserve all original reports, logs, PNGs, hashes and failure states. Compress/copy portable evidence only after the run ends, keeping original sources and dates. Root owns any runtime fix, final source/release stamp, other QA lanes, integration and global documentation.
