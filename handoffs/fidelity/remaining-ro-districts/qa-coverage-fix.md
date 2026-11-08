# Native visual capture coverage

The immutable3c01f75 Unirii/Otopeni baseline surveys recorded capture timeouts but exited0 because the runner considered only raw detector high counts. Their raw report JSONs/images remain outside git and unchanged; this correction does not reclassify a tool timeout as a game defect.

The runner now records explicit required/captured/missing sample coverage in JSON and Markdown, including missing sample indices and capture/runtime errors. Duplicate sample indices cannot replace missing poses. Missing requested worlds/routes and saved-image errors also prevent complete coverage. Both native runs and report-only regeneration exit2 for incomplete capture coverage. Raw detector findings keep their original severities.

`node game/dev/harness/visual/coverage-check.cjs` passes a CLI regression fixture for a timeout with0high/0medium, a silent missing/duplicate sample case and a complete positive control; detector JSON remains identical. Both module syntax checks pass. `qa-coverage-evidence.json` retains exact hashes and the unmodified native baseline results reprocessed in separate scratch directories.

A private instrumented one-camera Otopeni probe diagnosed software-GL workload rather than establishing a game freeze:50.49s first capture,39.23s warm-up,10.50s pixel analysis,0.47s step and0.28s main render when extra looks/aerial/flicker/traffic passes are disabled. Final full source surveys will use an explicit larger per-capture watchdog and retain actual timings; no passing frame budget or full visual acceptance follows from the incomplete baselines.

Root owns the corresponding shared README/spec19 notes and final integration. This commit changes only the assigned runner/report coverage hunks plus its isolated regression fixture/evidence.
