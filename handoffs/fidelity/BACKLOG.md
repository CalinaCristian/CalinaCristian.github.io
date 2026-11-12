# Backlog · the one list of open work

Updated 2026-11-12. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json) and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| — | none | every owner report so far is fixed on `master` and re-checked live; new reports go here |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R10 | District data size and load-time targets (3 MB gzip per district, 4 s load) | 10 | in progress (own session) |
| R22 | Code cleanup after the district migration (corridor era, split `world.js`, dead code) | 22 | todo, after R10 |

## Rules

- Fixes go straight to `master`, no PR (owner, 2026-11-11), after the checks below pass. `git fetch origin master` and
  merge before each push.
- OSM decides where things are; Street View panoramas decide what they look like. Panoramas are a visual reference only:
  never downloaded in bulk, stored, traced, copied into textures or published. When a panorama shows OSM is wrong, the fix
  is a documented exception, never a silent move. Review tool: `node game/dev/reality/capture.cjs --district=<id>`
  (viewpoints in `game/dev/reality/viewpoints.json`); what a review establishes goes into the district's
  `game/research/` dossier.
- Do not claim hardware frame rates from emulation.
- The other folders here hold JSON / image evidence that game code, tools or tests read (for example
  `d-otopeni/terminal-roof-measurements.json`); older notes were removed once stale and stay in git history.

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`.
