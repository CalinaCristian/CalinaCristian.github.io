# Root acceptance archive preparation

This independent tool prepares exact-source native `foot,a` and the current game Node-test recipe while FINAL remains HOLD. It never imports shipped modules, executes their tests, starts an HTTP server or launches Chromium. It does not change the physical900 preparer or runtime. Wait for root's actual FINAL before running the commands it records.

```sh
PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/root-acceptance-archive/prepare-root-acceptance.py prepare FULL_FINAL_SHA NEW_ACCEPTANCE_BASE
```

`source/` contains exact committed runtime/public/root/stamp files, the actual browser harness modules, native `game/dev/harness/run.js` plus `report.js`/help, and every committed test selected by the four historical c4 recipe globs. Import/resource closure adds specifically needed helpers, fixtures and research JSON. At source29f25970 this is265 files /120,105,371 bytes (114.54MiB),31 Node test files and12 exact additional dependencies. Unused overview images, research, galleries, raw handoffs and reference images are omitted. The full selected path/blob/SHA inventory and omissions are retained under `raw/`.

V8 parses ES modules and wrapped CommonJS without evaluation. Missing dependencies, syntax failures, unknown bare modules, repository escapes and unreviewed dynamic imports stop preparation. Nine existing tests have optional old-source comparison imports; their complete reviewed SHA-256 values are pinned. The default test command supplies no `--baseline`, `--strict-source` or `--entry-source` flags. A changed conditional test must be reviewed explicitly. The native runner's exact `--visual` delegation is recorded as outside this `foot,a` scope; visual surveys are not supported by this archive.

The native runner derives ROOT from `__dirname` and has no `--root` option. `prepared.json` therefore records a command pointing at the **archived** `game/dev/harness/run.js`. `--port=0` prevents reuse of an unrelated existing server; `--out=.../raw/foot-a` and `TMPDIR=.../raw/node-temp` keep output outside served source. `nodeTestsCommand` expands all test paths explicitly, preserving the c4 `--test-concurrency=4` recipe. The Node suite includes a native 2D Chromium fixture, so it also waits for FINAL and lane coordination. Resolve Playwright using the recorded environment; do not rewrite package/source files or substitute a live checkout.

Every extracted/servable file is checked against its committed Git blob and SHA-256, with an exact file-set check that rejects extra overrides. Preparation writes `source-precheck.json`; run the recorded `verificationCommand` immediately before and after **each** real command and retain distinct pre/postcheck outputs:

```sh
python handoffs/fidelity/root-acceptance-archive/prepare-root-acceptance.py verify FULL_FINAL_SHA ACCEPTANCE_BASE > ACCEPTANCE_BASE/raw/after-node-source-check.json
```

Existing acceptance bases are refused. Retain failed or incomplete outputs without reuse. This preparer neither approves FINAL nor launches/retries an acceptance run. Root owns execution, final source, global documentation and integration.

Bounded fixture controls, without running actual game tests:

```sh
PYTHONDONTWRITEBYTECODE=1 python handoffs/fidelity/root-acceptance-archive/test_archive_preparation.py
```

[Retained source29f25970 static controls](controls-29f25970/README.md) pass for the full265-file preparation and all six fixture controls. Its temporary source and OUT were removed; actual game tests/browser acceptance remain unrun.

The source-sidewalk test optional `--baseline` import is reviewed and pinned at c906d3d20b2e742bf1b40f0e558df8752898e620810eb54ba1f34873b580a541. Its default path imports only current native modules; the recorded Node command never supplies the optional comparison flag. The first b1 preparation rejection is retained as a tool guard result, not a game failure.
