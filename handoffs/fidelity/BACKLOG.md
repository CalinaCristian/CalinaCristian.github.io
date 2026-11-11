# Backlog · open owner reports (single list)

Updated 2026-11-11. The one place for what is still open. Report poses: [owner-reports-20261110.json](owner-reports-20261110.json)
(register #1–#71, camera eye / bearing / pitch per record). Reality checks against Street View:
[reality-check/](reality-check/README.md).

Rule: a report is closed only when its fix is published (merged to `master`, the owner's call) and re-checked live at
the original pose. Until then a fix stays under "Fixed on branch".

## Open

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozăvești | #15 upper ramp parapet gaps | railing pieces still stand on a junction pad at the foot of a ramp (original pose) |
| Grozăvești | L17 Basarab tram ramp fork | the flat-branch tram overlaps the estimated ramp slab; needs the tram grade model changed |
| Grozăvești | L41 hole under the north-east branch split | the branch deck parts from the main deck after the gore (median fill closes it up to 6 m); owner to confirm this matches the real split |
| Grozăvești | Pasajul west deck height over the Dâmbovița | the shared Basarab model holds 11 m over the river; Street View on the arch suggests a lower deck (not measured) |
| Grozăvești | Reality-check viewpoints | most of the 19 viewpoints in `game/dev/reality/viewpoints.json` not reviewed yet; other districts have none |
| Unirii | #25 facade flicker near the ground floor | not reproduced in still captures |
| Unirii | L24 / #30 fountain basin in the carriageway | 1 of 44 basins reaches 0.27 m into the carriageway |
| Unirii | L22 / #26 / #32–#34 junction and longitudinal markings | look whole at the report poses from above; verify at street level |
| Romană | L23 sign flicker (Penny) | coplanar surfaces; generic fix wanted |
| Romană | #47 / #48 / #50 crossing paint, markings at parking islands, building in the street | look whole at the report poses; verify at street level |
| Floreasca | #2 bus shelter orientation, #3 rectangular road patch flicker | open |
| Floreasca | #10 courtyard windows and inner slab | the slab is a mapped building part; owner question, not a defect yet |
| Bellevue | #67 / L15 pedestrian pileups at closures | crowds still gather at the district-edge closures |
| SeaTac | #57–#65 airport assembly | skybridge connector ends in the air, garage helix and ramps cut into each other, station sign and roof without mounting, frontage objects on the terminal road, parapet gaps, truncated road, broken markings |
| Everywhere | L8 colliding buildings | partly: members of prepared assemblies and courtyard buildings still cut |
| Everywhere | L14 60 fps at Ultra (RTX 5070) | probe means 8–16 ms per frame; not measurable on the owner's hardware from here |
| Everywhere | L16 cars stuck / nose to nose | crossing deadlock fixed (ba592d07); re-check live |
| Spots | L28 hidden bar video | the official video does not embed; no licensed loop available |
| Spots | L30 chat bubbles | wants location / event specific cultural lines (content rewrite) |
| Spots | L34 tourist spot refresh | Cișmigiu, Freddo, Old Town, Arcul, Space Needle done; the rest not reworked |
| Interiors | #52 Luxoft interior, #66 night drone road lighting | unfinished / unverified |

## Fixed on branch `fidelity/basarab-structure-claude` (awaiting publication and a live re-check)

| Commit | Reports |
| --- | --- |
| 281ac396 | holes in autumn crowns; L50 Basarab link ramp reaches Calea Griviței at street level |
| 687fcde6 | Basarab ramps by Șos. Nicolae Titulescu and the west ramp follow Street View (street-level starts, retaining walls, filled medians, hammerhead piers, Podul Grozăvești deck plate); `tunnel=passage` at street level |
| ba592d07 | traffic jam at Calea Plevnei (crossing deadlock) |
| 767271f8 | The Bridge 1 (BCR) landmark |
| 163665bb | L45 parapets in chunks |
| 47c5dd67 | L27 Mark travels to another area at once; L29 stepping off a floor falls |
| 8fed7234 | L31 waypoint trail in tourist spots |
| c5d27c3f | #51 Romană floating office volume, #55 Otopeni floating station roof |
| 0311834a | #31 / L25 blank blocks in front of the Parliament |
| ae7fef3d | #23 tree crowns in facades |
| 94e9bb78, dd0ceacc | #45 Pipera walls across streets under the bridge |
| earlier on this branch | L1–L7, L9–L13, L19 (all three places), L20, L21, L32, L33, L35–L40, L42, L43, L44, L46–L49; register #12–#14, #16–#18 (re-checked at their poses 2026-11-11) |
| by design | #28 Unirii fountains run May–October 10:00–23:00 (`?fountains=on` forces them); L18 Romană underpass re-checked closed |

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`. `git fetch origin master` and merge first.
