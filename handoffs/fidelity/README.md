# Fidelity handoffs

- [BACKLOG.md](BACKLOG.md): every open owner report and what waits for the owner. The only tracker.
- [owner-reports-20261110.json](owner-reports-20261110.json): the 71 owner inspection reports (poses, notes).
- [reality-check/](reality-check/README.md): OSM decides positions, Street View panoramas validate looks (reference only,
  never stored); one review sheet per district.
- The remaining folders hold JSON / image evidence that game code, tools or tests read (for example
  `d-otopeni/terminal-roof-measurements.json`, `integration-final-acceptance/proof/initial-body-audit-tooling/fixtures/`).
  Older handoff notes were removed on 2026-11-11 once stale; they stay in git history.

Rules that still apply: fixes go straight to `master` after the checks in BACKLOG.md pass (owner, 2026-11-11);
`git fetch origin master` and merge before each push; a report closes only after its fix is re-checked live at its
original pose; never store or publish copied reference imagery; do not claim hardware frame rates from emulation.
