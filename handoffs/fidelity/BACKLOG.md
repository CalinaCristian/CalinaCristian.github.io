# Backlog · the one list of open work

Updated 2026-11-13. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Romana, UiPath (241, -184), 2026-11-13 | "uipath is broken it has a building in side it" | not reproduced: rendered at the exact F8 eye / bearing / pitch by day and at the report hour (21:05, night). The Landmark (Corp B, L-shaped) has no other mesh or collider inside its walls (scene scan of its volume); the only neighbour touching it is w583612401 (Corp A, a 25 m generic glass block east of the courtyard), which overlaps the open courtyard by a 2.5 m strip, not the building. The F8 `release` / `source` fields were stale (stamped 2026-11-11, before the round-2 remodel of this model), so which build the owner saw is unknown; re-stamped 2026-11-13, so the next F8 report identifies its build |
| SeaTac (-981, -16), 2026-11-13 | "bridges with borders that don't connect", "floating connecting buildings that don't connect to anything", "invisible wall … can't even reach destination" | wall and railings fixed (live); not reproduced: the floating connectors — the garage skybridges reach both ends from the drives, and skybridge ends now extend up to 8 m to their buildings. Needs the owner's pose of the one that floats |

## Other open work

None. (Spec 22 cleanup finished 2026-11-13: module map in `specs/01-architecture.md`.)

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
