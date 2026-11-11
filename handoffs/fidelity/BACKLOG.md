# Backlog · open owner reports (single list)

Updated 2026-11-11. The one place for what is still open. Report poses: [owner-reports-20261110.json](owner-reports-20261110.json)
(register #1–#71, camera eye / bearing / pitch per record). Reality checks against Street View:
[reality-check/](reality-check/README.md).

Rule: a report is closed only when its fix is published (merged to `master`, the owner's call) and re-checked live at
the original pose. Until then a fix stays under "Fixed on branch".

## Open

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozăvești | L17 Basarab tram ramp fork | the climbing track's slab starts at the fork node, on the flat branch's track (tram-sweep-audit: 105 refused poses on w660918284 / w314447163). Holding the climb at grade until 3.4 m clear does not fit: the south approach already climbs at the 8 % cap (95 m to the 6 m bridge entry). Needs a lower, Street View-checked bridge entry height or a longer source approach |
| Everywhere | Reality-check viewpoints | Grozăvești: all 19 rendered and reviewed 2026-11-11 (open findings in reality-check/REVIEW-grozavesti.md); other districts have no viewpoints yet |
| Unirii | #25 facade flicker near the ground floor | not reproduced in still captures (street-level capture at the pose shows a park) |
| Unirii | L22 junction markings (67, -189) | re-checked 2026-11-11 (capture + Street View, Bd. Corneliu Coposu): approaches carry lane lines and whole crossings, the junction interior is unmarked in both; owner to give a pose if a specific marking is missing |
| Romană | L23 sign flicker (Penny) | not reproducible: no Penny sign or POI in the current Romană data; facade signs stand 0.14 m off their walls; owner to give the pose if it still flickers |
| Bellevue | #67 / L15 pedestrian pileups at closures | mitigated on branch (walkers blocked head-on by peers on a crossing step through after 1.5 s; walkers boxed in by a closure both ways leave the road); the headless probe still shows walkers frozen mid-crossing with no recorded blocker, so re-check live |
| SeaTac | #59 / #60 garage helix and ramps | partly: edge bands open where the mapped ramps pass (74136408); trench walls no longer cross the other ramp at gores and two sunken ramps side by side share one wall (58a8908a). Left: short inferred drop barriers at the gore mouths of the sunken ramps beside the helix (each at its own road's height); the report camera stands inside the garage footprint, where the garage is cut away |
| SeaTac | #62 / #63 / #65 frontage objects, parapet gaps, markings | not reproduced at the report poses or closer (the drive hugs the terminal face; ramp edges and crossings look whole); owner to give a closer pose |
| Everywhere | L8 colliding buildings | partly: members of prepared assemblies and courtyard buildings still cut |
| Everywhere | L14 60 fps at Ultra (RTX 5070) | probe means 8–16 ms per frame; not measurable on the owner's hardware from here |
| Everywhere | L16 cars stuck / nose to nose | crossing deadlock fixed (ba592d07); re-check live |
| Spots | L28 hidden bar video | the official video does not embed; no licensed loop available |
| Interiors | #52 Luxoft interior | needs the owner's floor number. Tried 2026-11-11: with a floor-3 estimate (10.8 m) and the facade hold lifted, the Hermes window binding resolves, but the live view is refused ("virtual eye outside the certified room envelope": the 16 × 18 m ground-floor lobby room does not fit the building at that floor), so the room has to be re-planned to the real floor's depth. Reverted; the interior is still the generic lobby |

## Fixed on branch `fidelity/basarab-structure-claude` (awaiting publication and a live re-check)

| Commit | Reports |
| --- | --- |
| (next commit) | Pasajul west deck over the Dâmbovița: it crosses right above Podul Grozăvești (OSM layer 2 over layer 1, no `maxheight` mapped). Street View from Podul Grozăvești shows a deep steel-blue box girder whose underside passes about two storeys up; the arch span now carries 2.45 m edge girders and cross girders in that blue (estimated), underside 8.5 m up instead of a thin slab at 9.9 m; road heights unchanged |
| f63b6aa4 | L41 sky through the Basarab deck west of the station: Street View under the station shows one continuous underside; an elevated tram deck now joins a carriageway up to 12 m away (only the Basarab viaduct has tram decks that high: slot infill 2,476 → 7,944 m²), and the gore partners leaving one split node are paired for the median fill. A hairline gap remains under the deck near (600, -880) |
| 2e751d33 | #66 night drone road lighting: street-lamp pools and real lights followed the player on the ground while the drone flew elsewhere; a camera away from the player is now the centre (its ground point plus a look-ahead growing with height) and the lit reach widens with height (capture 300 m from the player: 13 lights / 47 pools under the drone, before 7 / 21 by the player) |
| 66d4bfe6 | L34 tourist spots (all 7 live spots now reviewed): Pike Place spawn moved off the 1st Avenue carriageway (a car brushed past the player); mapped canopies (`building=roof`) stand on posts along their free edges (Pike Place arcade canopy, Seattle Center walkways, a Bellevue fuel station), none inside a building; Bellevue's Piloti shell covers its mapped 19 × 17 m footprint instead of a dark slab over a shell a third its size. Earlier on this branch: Cișmigiu, Freddo, Old Town shopfronts and balconies, Arcul masonry, Space Needle canopy, Downtown Park crowns |
| 561576a4 | L30 spot chat bubbles: each person keeps one character's voice (no fishmonger selling cherries, no visitor speaking another tourist's language), talks about the sub-spot they stand at, and keeps quiet rather than repeat; place and yearly-event lines added for every Seattle and Bellevue spot (Bumbershoot, Solstice Parade, Snowflake Lane, Garden d'Lights…) and Bucharest (Mărțișor, Enescu Festival, Easter, December 1989) |
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
| 4c8849d1 | #3 Floreasca road patch flicker: overlapping repair patches each get their own height below the lines |
| ef1ce210 | #15 Basarab parapet gaps: rail pieces joined across slots, width changes and deck corners |
| 7d2d7cd4 | #2 Floreasca bus shelter: faces the nearest public carriageway (Strada Ceaikovski, the bus route), never a service lane |
| earlier on this branch | L1–L7, L9–L13, L19 (all three places), L20, L21, L32, L33, L35–L40, L42, L43, L44, L46–L49; register #12–#14, #16–#18 (re-checked at their poses 2026-11-11) |
| 4ba732e4 | #57 / #58 SeaTac station west bridge reaches the garage; #61 the station name board stands on posts |
| af8237bb | L24 / #30 Unirii fountain kerbs on and inside the OSM outlines (no basin reaches a carriageway) |
| 92486a7a | #50 Romană (and #22 / #35 Unirii, part of L8): a street side running into OSM building footprints narrows to 0.3 m off the wall (Romană 49 sides, Unirii 60); #47 / #48 checked close up: crossings and parking-island markings whole |
| by design | #64 SeaTac road ending in grass: OSM w1067079743 is a real dead-end service road (live API checked) |
| by design | #10 Floreasca courtyard: the blue inner roof is the hospital's real courtyard building (OSM w236118733, blue roof on satellite imagery), and the main block has courtyard windows |
| by design | #28 Unirii fountains run May–October 10:00–23:00 (`?fountains=on` forces them); L18 Romană underpass re-checked closed |

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`. `git fetch origin master` and merge first.
