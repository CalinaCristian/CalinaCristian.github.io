# Fidelity handoffs

- [BACKLOG.md](BACKLOG.md): every open owner report and what is fixed on a branch but not yet published. The only tracker.
- [owner-reports-20261110.json](owner-reports-20261110.json): the 71 owner inspection reports (poses, notes).
- [reality-check/](reality-check/README.md): OSM decides positions, Street View panoramas validate looks (reference only,
  never stored); one review sheet per district.
- The remaining folders hold JSON / image evidence that game code, tools or tests read (for example
  `d-otopeni/terminal-roof-measurements.json`, `integration-final-acceptance/proof/initial-body-audit-tooling/fixtures/`).
  Older handoff notes were removed on 2026-11-11 once stale; they stay in git history.

Rules that still apply: publishing (merging to `master`) is the owner's call; work on a branch, `git fetch origin master`
and merge before each push; a report closes only after a published fix is re-checked live at its original pose; never
store or publish copied reference imagery; do not claim hardware frame rates from emulation.
