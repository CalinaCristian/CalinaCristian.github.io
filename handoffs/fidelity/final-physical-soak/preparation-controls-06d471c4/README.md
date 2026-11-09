# Minimal archive preparation controls

Static controls passed at actual source `06d471c4b2486633b325a62c52b46e08e4a3053f`, preparation/tool commit `853ea6ce22974e400d2e0532437938cd4cd347ce`, on2026-11-09. No server, browser or physical soak ran. FINAL900 remains HOLD until root supplies its actual freeze.

The disposable exact Git archive contained219 files /119,130,349 bytes (113.61MiB). Every copied/servable file matched its committed Git blob and SHA-256, including all208 files in QA's existing native minimal-source manifest. Eleven extra files provide the six actual browser harness modules and root HTML/CSS/JS/canvas plus the release-stamp script. The preserved manifest lists all included paths and hashes.

The archive omits12,669 overview files (601,989,451 bytes),179 research files (40,250,021 bytes), and125 unused developer files (1,479,862 bytes). Only the six imported browser harness files remain under `game/dev/`; no runtime source was patched. V8 parsed157 JavaScript modules without executing them; HTML/CSS parsing covered four additional files and463 local dependency edges. All three frozen external runner/helper/verifier files passed `node --check`.

`fixture-tests.log` records12 passing controls, including missing transitive module/asset/entry, invalid syntax, unresolved dynamic import, repository escape, reused OUT, altered HTML, extra unverified served file, exact canonical/legacy release bytes and explicit legacy-mode labelling. Source06d has no committed release file; that absence is retained in `prepared.json`, while fixtures separately verify byte-preservation when releases exist.

`summary.json` records source/tool/script hashes, baseline-manifest hash, exact additional files and limitations. `dependency-audit.json` and `source-manifest.json` retain the complete closure and archive inventory. `prepared.json` is an original static-control plan whose temporary paths were removed after validation; it is not launchable final evidence. Do not reuse these paths or relabel this control as runtime acceptance.

Commands run from the final-physical-soak worktree:

```sh
PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/final-physical-soak/test_runtime_archive.py 06d471c4b2486633b325a62c52b46e08e4a3053f /workspace/integration-qa-evidence/fountain-memory-06d471c4-source/qa-source-manifest.json handoffs/fidelity/final-physical-soak/preparation-controls-06d471c4
PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/final-physical-soak/test_prepare_freeze.py > handoffs/fidelity/final-physical-soak/preparation-controls-06d471c4/fixture-tests.log 2>&1
```
