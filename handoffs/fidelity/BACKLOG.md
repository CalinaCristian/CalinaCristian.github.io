# Backlog · the one list of open work

Updated 2026-11-13. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose, from the F8 JSON the owner pastes); its record is the git history.

## Owner reports

None open.

## Other open work

None.

## Rules

- Fixes go straight to `master`, no PR (owner rule), after the checks below pass. `git fetch origin master` and merge
  before each push.
- OSM decides where things are; Street View panoramas decide what they look like. Panoramas are a visual reference only:
  never downloaded in bulk, stored, traced, copied into textures or published. When a panorama shows OSM is wrong, the fix
  is a documented exception, never a silent move. Review tool: `node game/dev/reality/capture.cjs --district=<id>`
  (viewpoints in `game/dev/reality/viewpoints.json`); what a review establishes goes into the district's
  `game/research/` dossier.
- Do not claim hardware frame rates from emulation.
- The other folders here hold only evidence that game code, tools, tests or the overview read (for example
  `d-otopeni/terminal-roof-measurements.json`); delete a folder once nothing reads it (git history keeps it).

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`.
