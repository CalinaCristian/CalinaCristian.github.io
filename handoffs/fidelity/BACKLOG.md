# Backlog · the one list of open work

Updated 2026-11-12. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozavesti (69, 19) | "the road looks wrong here -- lane collapse suddenly" | open. Soseaua Grozavesti is `lanes=2` with `turn:lanes=merge_to_right` up to the node at (63.5, 43.9), then `lanes=1`: the 7 m ribbon steps to 3.5 m at the node. A ribbon has one width per edge; a merge needs tapered widths (ribbon, markings and lane geometry). |
| Grozavesti (163, -410) | "same" (tram fence in pieces) | open in part. The railing on the tram ramp slab has an 8 m gap at (149, -410): the street-level track beside the slab is 3.2 m away and its tram sweep covers the slab edge, so no railing can stand there without a tram running through it. Needs the two tracks' real spacing (Street View) or a narrower railing rule. |
| Grozavesti (376, -727), (352, -726) | "area looks broken" | fences and strips fixed; still open: six forks on reviewed descent profiles keep two overlapping carriageways at different levels (the Orhideelor ramp r268 rising beside r179 from the node at (363, -730)). Same fix as the Grivitei slip ramps: a `crownHoldSourceNode` per model, each to be reviewed. |
| Grozavesti (983, -1179) | "cars go in fence" | fixed (the tram railing no longer stands in the lane); the slab edge beside Titulescu's carriageway now has no railing where the slab overlaps that lane (slab 0.5-1.2 m above it). |
| Grozavesti (410, 450) | (found while fixing the river) | the Gradina Botanica pond (way 133955992) shows as a 4.4 m deep concrete basin: `water-channel.js` classes it as a channel; it is a pond at grade. |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R10 | District data size and load-time targets (3 MB gzip per district, 4 s load) | 10 | in progress (own session) |
| R22 | Code cleanup after the district migration (corridor era, split `world.js`, dead code) | 22 | todo, after R10 |
| R21 | Landing background choice | 21 | blocked: owner decision |

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
