# Backlog · open owner reports (single list)

Updated 2026-11-12. Only what is still open. Finished reports are removed once their fix is on
`master` and re-checked live at the report pose; their record is the commit history (`git log -- handoffs/fidelity`).
Report poses: [owner-reports-20261110.json](owner-reports-20261110.json) and the F8 JSON the owner pastes. Reality checks
against Street View: [reality-check/](reality-check/README.md).

Publishing: the owner asked (2026-11-11) for fixes to go straight to `master`, no PR, after the checks below pass.

## Open

| Where | Report | State / diagnosis |
| --- | --- | --- |
| — | none | every owner report so far is fixed on `master` and re-checked live; new reports go here |

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`. `git fetch origin master` and merge first.
