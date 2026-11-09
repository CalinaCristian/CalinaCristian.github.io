# Bounded static preparation proof

Actual source `29f25970faa65b3edd8a7a53a2b11a6314ec8e4e`, preparation commit `18757638`,2026-11-09. This proof ran static archive/dependency/integrity controls and six disposable Git-fixture controls. It did **not** run the31 actual Node tests, native `foot,a`, HTTP or Chromium. FINAL900 remains HOLD.

A temporary prepared archive contained265 exact committed files /120,105,371 bytes (114.54MiB). Both complete file-set/Git-blob/SHA-256 checks passed. Every selected file and omission is in `source-manifest.json`; `dependency-audit.json` records static module/CommonJS parsing, exact references and explicitly excluded conditional imports. Native `run.js`/`report.js` also passed `node --check`. The runner's derived ROOT resolved to that temporary immutable source, and the explicit test argv exactly matched all31 current files in the historical four-glob game-test recipe.

Only three research JSON files are included, each referenced by the CEC test. The six native fixtures, one street-sweep fixture and two visual helper modules are exact transitive dependencies. No overview images, gallery files, raw handoffs or reference images entered the archive. The source bytes and inventory remained unchanged through these static controls.

`fixture-controls.log` records six passing preparation tests covering transitive selection, runner/root/command contracts, a missing fixture, unreviewed dynamic import, JavaScript syntax error, repository escape, changed ROOT contract, reused OUT and altered source. It was produced by:

```sh
PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/root-acceptance-archive/test_archive_preparation.py > handoffs/fidelity/root-acceptance-archive/controls-29f25970/fixture-controls.log 2>&1
```

`summary.json` pins source/tool/helper hashes and the source-manifest hash. `source-precheck.json` and `static-source-postcheck.json` are checks around **static controls only**. `prepared.json` retains the original plan with temporary source/OUT paths. Those paths were automatically removed at completion and must not be reused or represented as a final acceptance run. Root must prepare a new base from its actual FINAL and retain fresh source checks around every real command.
