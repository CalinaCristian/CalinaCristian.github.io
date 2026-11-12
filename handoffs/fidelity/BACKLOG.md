# Backlog · the one list of open work

Updated 2026-11-12. Only what is still open. A finished item is removed once its fix is on `master` and re-checked live
(owner reports: at the report pose); its record is the git history. Report poses:
[owner-reports-20261110.json](owner-reports-20261110.json), [owner-reports-20261112.json](owner-reports-20261112.json)
and the F8 JSON the owner pastes.

## Owner reports

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozavesti, whole Basarab | "fences are not continuous on the bridge still in many places", "random 1 off fences that are alone" | fixed in the builder (one railing network: joins, pruning, then drawing; 100 railing ends in the air before, 16 after). Still open: (a) 60 m of road-deck railing and 36 m of tram-slab railing are left out where a tram's body itself crosses the line (the tram junction around (340..380, -710..-735) and the track crossings), listed in `stats.railingDrops`; (b) 95 m of railing beside the tram is drawn without a collision wall (`visualOnlyM`): it lies inside the 0.2 m cover the tram guard keeps free, so a wall there would stop the trams. A real fix needs the carriageway and track centre lines further apart there. The 16 remaining ends are in `stats.railingNetwork.openEnds`. |
| Grozavesti (376, -727), (352, -726) | "area looks broken" | fences, strips and the one real level conflict fixed (measured 2026-11-12: carriageway asphalt overlapping at different levels was 45 m² up to 0.52 m, all at the north-east Grivitei ramp (790, -974), now 2 m²; `bridge-bents-check` asserts it). What is left here is layout, to be judged by the owner: the Orhideelor entry ramp r268 runs beside the deck r179 for 190 m up to 2.5 m lower and their walkway bands overlap (290 m²); the same at the loop ramp r259 beside r388 (39 m², 1.4 m) and r276 beside r127 (32 m², 2.4 m). The shared fork model already holds each branch at deck level while its asphalt overlaps the main one. |

## Other open work

| ID | Item | Spec | State |
| --- | --- | --- | --- |
| R10 | District data size and load-time targets (3 MB gzip per district, 4 s load) | 10 | in progress: size met (binary packs 0.40–2.90 MiB, on `master` since 2026-11-12); < 4 s desktop load still open for Grozăvești 9.6 s, Unirii 7.5 s, Romana 5.1 s |
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
