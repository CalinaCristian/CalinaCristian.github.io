# Backlog · open owner reports (single list)

Updated 2026-11-12. The one place for what is still open. Report poses: [owner-reports-20261110.json](owner-reports-20261110.json)
(register #1–#71, camera eye / bearing / pitch per record). Reality checks against Street View:
[reality-check/](reality-check/README.md).

Rule: a report is closed only when its fix is published (merged to `master`, the owner's call) and re-checked live at
the original pose. Until then a fix stays under "Fixed on branch".

## Open

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozăvești (1118, -1284) | "right is shorter than left" | Street View at 44.45272, 26.07322 (the report point) looking south-west shows the tram at grade on Șos. Nicolae Titulescu with road on both sides as far as the view reaches; the game's tram ramp already climbs to 5 m within 60 m of there. The ramp's start (tram grade model) needs moving; the short right railing (the road ramp beside is level with the slab there) follows from it |
| Grozăvești (826, -1050), (314, -697) | "what's going on here", "missing" | where the road guard and the tram-slab railing converge they still cross over a few metres, and one road-side gap remains by (314, -697) |
| Grozăvești (194, -453) | "why is it like that?" | the unnamed ramp beside Șos. Orhideelor is an embankment 5.2 m high at this point (not a bridge in OSM); Street View shows it still low there, rising later: its grade needs checking |
| people at night | "shadows for people (texture like they are just standing that are transparent)" | not reproduced in a visible Ultra window at night among walkers (the AO pass already skips the crowd, lamps cast no shadows); needs an F8 report where they appear |

## Fixed on master 2026-11-12 (owner reports of 2026-11-12, re-check live at the poses)

| Report | Fix |
| --- | --- |
| Grozăvești (354, -718), (329, -703), (330, -716), (387, -745), (435, -756), (878, -1118), (869, -1076), (837, -1061) "see through" | junction pads up on the Basarab deck (bends, pads shared by two carriageways) had a top skin only; each now has the decks' underside, 0.3 m wider so it meets the mitred decks, and a fascia where no deck continues |
| Grozăvești (259, -645) "what is this gray spot" | a slot infill quad (tram slab to carriageway) passed under a carriageway at the same level and fought its asphalt; a slot never covers a carriageway now (13 quads kept off) |
| Grozăvești (249, -617) "this looks random" | consecutive slot infill quads along a bend met at one side only and the ground showed through a wedge; each overlaps the next by 0.3 m |
| Grozăvești (770, -1001) "random thing", (763, -1020) "missing pieces" | the Bretea slip ramps kept grey pad-rim barrier pieces (one stood in the carriageway); every raised bridge edge connected to the Basarab deck is now one structure with the continuous white guard and blue band |
| Grozăvești (982, -1190), (836, -1060), (814, -1000) "not connected"; blue band patches missing | a tram slab or slot infill beside a carriageway counted as road continuing at its level and left the road railing in pieces; only a carriageway or filled median opens it now. Tram-deck railing ends up to 1.5 m apart are joined |
| Grozăvești (1086, -1266) "should the fence not go all the way?" | the tram ramp's railing stopped where a street within 1.2 m counted as level; only a surface within 0.35 m does now |
| Grozăvești (933, -1180) "see through" | ramps up to 4.5 m (was 3.5) stand on retaining walls, and a pad between two such ramps reaches the ground |
| Grozăvești (423, -745) "lines look wrong", (898, -1136) "lines seem odd" | where a ramp merges with a carriageway at one level, its edge line ran on across the other road's lanes; edge lines are laid in 1 m pieces and a piece inside another level carriageway is left out |
| Grozăvești (107, -234), (77, 112), (87, 30), (78, -76) "random fence", grey block | guard runs under 6 m that meet no other railing are left out (65 strays); grey barrier pieces on Basarab ramps above 1.5 m are replaced by the guard (was 2.5 m); no tram railing on an inner slab edge of the river bridge |
| Grozăvești (135, -325), (159, -426) "missing fence chunks ... check streetview" | Street View on Pasajul Basarab (44.44503, 26.06120): a low concrete barrier at the carriageway and an unbroken blue steel railing on the tram slab; the tram railing is no longer dropped where a road guard stands beside it, and moves up to 1.5 m outboard (was 0.75 m) where a tram's body overhangs the slab on a curve |
| Grozăvești (434, -693) "too many fences", (452, -760) "on the road fences" | railing ends side by side are no longer joined across (zigzags); no guard where its line lies on a merging carriageway |
| Grozăvești (591, -854) "pillars ... no support" | 44 single-column piers were dropped near the trams: a tram riding on the slab a pier carries counted (the test reached 0.1 m above the pier), and a beam end reaching into a tram beside was fatal; the test now stops at the pier top and such beams are trimmed (14 piers back: 94 → 108) |
| Grozăvești (931, -1147) "cars are driving in the fence", (603, -877) "car drives on the tram station" | a one-way carriageway narrowed on its tram side (wL 1.75-3.1 m) kept its lanes starting at the old 3.5 m edge, so the outer lane ran 0.45 m off the asphalt; the lanes now start at the narrowed edge (also for carriageways narrowed at building footprints) |
| Grozăvești (712, -965) "huge issue", (815, -1042), (81, -32) "fence ... too much into the street" | where a carriageway's side narrows at a node, the wide side's guard stops early and a 1:6 diagonal leads to the narrow one (49 tapers) instead of a sideways corner; the Basarab guards are drawn after all joins |
| Grozăvești (135, -325), (826, -1050) | the tram-slab railing is dropped only where a road guard stands within 0.7 m (a true duplicate) |
| chat bubble too high | a walker's bubble sits 0.25 m above the head (scaled with the walker), was a fixed 2.4 m |
| office windows break up close | the live window view renders at up to 4096 px (4 MP) on Ultra / High, was 2048 px (1 MP) |
| #67 Bellevue walkers frozen (live: 65 of 114 moved under 1 m in 60 s) | a walker stuck 2.5 s on a crossing turns back, and if stuck again relocates; a walker in recovery mode stuck 3 s leaves the road or resumes its route (the earlier 55ca854d rule never fired for walkers in recovery) |

## Published (master 264ef5f3, 2026-11-11) and re-checked live at the report poses on cristiancalina.com

| Commit | Reports |
| --- | --- |
| 95e222a5 | #25 Unirii facade flicker: reproduced on published `master` at the report pose with a depth-fight detector (two renders 2 mm apart: 307 changed pixels, red patch on a ground-floor facade where a ray hits two coplanar walls); on this branch 55 changed pixels, none on a building (the overlapping-building cuts of L8). L23 Romană sign flicker: every one of the 269 Romană facade signs scanned at street level and from 250 m on published `master` and on this branch; on master "The Costume" (315, 91) flickers (306 changed pixels), on this branch 0, with or without the sign polygon offset, so the overlapping-building cuts removed it; the offset stays as the generic safeguard the owner asked for |
| 5589632d | L28 hidden bar: the sports TV plays on its own while the bar is open: an original, procedurally drawn match broadcast (pitch, Romania in tricolour kit, ball passed and scored, score bug, clock, goal replay card); no footage or broadcast graphics copied; E still opens the official highlights. L14 Ultra 60 fps: vehicles 160-250 m from the viewer step every other frame (was full rate to 250 m); measured on this PC's RTX 5070 at 2560 × 1440 Ultra, morning peak, pipelined frames (no per-frame read-back), the worst district Grozăvești 10.5 ms per frame = 95 fps (CPU p99 13.3 ms), Unirii 125, Romană 127, Pipera 115, Floreasca 196, Otopeni 192, SeaTac 230, Bellevue 184 fps (headless on the same GPU). In a real visible Chromium window on this PC (the game's own loop, vsync): Grozăvești 91 fps (p95 12.7 ms), Unirii 100, Romană 102, Pipera 105, Floreasca 139, Otopeni 146, SeaTac 162, Bellevue 160. Reality check: tall twin-arm lamps on the Basarab medians (13), an ordinary lamp standing on a median gives way |
| 66e39be4 | L17 Basarab tram ramp fork: the climbing track now stays at grade until it is 3 m from the flat branch (about 25 m past the fork, measured on the source rails), then climbs to the 6.1 m bridge entry at up to 9 % (MODEL estimate; 8 % on the deck), so the climbing slab no longer covers the flat branch's track; Street View shows the trams on a grassed bed at grade there. The tram sweep now refuses no pose at all: a V-leg is checked along its whole length, and the Pasajul west ramp's embankment collision wall steps up to 1 m toward its carriageway where a tram runs beside it |
| 945898a9 | L8 colliding buildings, the rest: a lower courtyard building is now cut at a taller neighbour with its courtyard kept open (Unirii 787 → 798 cuts), and a ground-level member of a prepared assembly running into a taller building outside its assembly is cut too (Romană 104 → 117); parts of one assembly still stack by design (476 pairs in Romană). #59 / #60 SeaTac: drop barriers beside the sunken ramps join across up to 3 m and stay on while the drop is over 0.25 m (they started at 0.45 m and switched off at once); with 74136408 and 58a8908a the ramps, gores and walls are done — the remaining barrier pieces stand where the neighbouring ramp lies at another level |
| 1afadcde | #52 Luxoft: an upper office floor (floor 3, an estimate for the owner to confirm, 10.8 m) with open-plan desks, a meeting room and a live window onto Pipera from the Hermes facade; the window binding resolves and the view is active everywhere in the room. It was a ground-floor lobby with an opaque window band |
| 55ca854d | L15 Bellevue pedestrian pileups at closures: walkers blocked head-on by peers on a crossing step through after 1.5 s; walkers boxed in by a closure both ways leave the road (#67 itself: see 2026-11-12 above) |
| ceccfdd8 | Pasajul west deck over the Dâmbovița: it crosses right above Podul Grozăvești (OSM layer 2 over layer 1, no `maxheight` mapped). Street View from Podul Grozăvești shows a deep steel-blue box girder whose underside passes about two storeys up; the arch span now carries 2.45 m edge girders and cross girders in that blue (estimated), underside 8.5 m up instead of a thin slab at 9.9 m; road heights unchanged |
| f63b6aa4 | L41 sky through the Basarab deck west of the station: Street View under the station shows one continuous underside; an elevated tram deck now joins a carriageway up to 12 m away (only the Basarab viaduct has tram decks that high: slot infill 2,476 → 7,944 m²), and the gore partners leaving one split node are paired for the median fill. A hairline gap remains under the deck near (600, -880) |
| 2e751d33 | #66 night drone road lighting: street-lamp pools and real lights followed the player on the ground while the drone flew elsewhere; a camera away from the player is now the centre (its ground point plus a look-ahead growing with height) and the lit reach widens with height (capture 300 m from the player: 13 lights / 47 pools under the drone, before 7 / 21 by the player) |
| 66d4bfe6 | L34 tourist spots (all 7 live spots now reviewed): Pike Place spawn moved off the 1st Avenue carriageway (a car brushed past the player); mapped canopies (`building=roof`) stand on posts along their free edges (Pike Place arcade canopy, Seattle Center walkways, a Bellevue fuel station), none inside a building; Bellevue's Piloti shell covers its mapped 19 × 17 m footprint instead of a dark slab over a shell a third its size. Earlier on this branch: Cișmigiu, Freddo, Old Town shopfronts and balconies, Arcul masonry, Space Needle canopy, Downtown Park crowns |
| 561576a4 | L30 spot chat bubbles: each person keeps one character's voice (no fishmonger selling cherries, no visitor speaking another tourist's language), talks about the sub-spot they stand at, and keeps quiet rather than repeat; place and yearly-event lines added for every Seattle and Bellevue spot (Bumbershoot, Solstice Parade, Snowflake Lane, Garden d'Lights…) and Bucharest (Mărțișor, Enescu Festival, Easter, December 1989) |
| 281ac396 | holes in autumn crowns; L50 Basarab link ramp reaches Calea Griviței at street level |
| 687fcde6 | Basarab ramps by Șos. Nicolae Titulescu and the west ramp follow Street View (street-level starts, retaining walls, filled medians, hammerhead piers, Podul Grozăvești deck plate); `tunnel=passage` at street level |
| ba592d07 | traffic jam at Calea Plevnei (crossing deadlock); L16 cars nose to nose |
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

## Resolved without a change on this branch

| Report | Evidence |
| --- | --- |
| #62 / #63 / #65 SeaTac frontage objects, ramp edge pieces, crossings | reported on release `game-471508886`; rendered at the report poses on published `master` (a5f80d75) and on this branch: no poles in the terminal road, ramp barriers and crossings whole in both, so already fixed and published |
| Grozăvești (591, -854) "pillars ... huge spots where there's no support" | the pier-free stretch is the cable-stayed main span: Street View on the deck at 44.44893, 26.06688 shows the last stays anchoring right there with the pylon ahead, so no piers stand between that point and the pylon; the game's 170 m span ends at the same place. The other long gaps were fixed in 07ce18b7. Full walk of the bridge 2026-11-12 (33 stations every 45 m, deck / aerial / underside): railings, blue band, stays, canopy, undersides and piers consistent end to end |
| L22 Unirii junction markings (67, -189) | checked against live OSM and Street View / satellite on Bd. Corneliu Coposu: zebras stand at the mapped signalised crossings, the two crossings mapped `crossing=unmarked` have none, the junction interior is unmarked in reality, and the tram rails are mapped `railway=construction` (the line is being rebuilt), so no tracks are drawn; published master and this branch render the junction identically |

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`. `git fetch origin master` and merge first.
