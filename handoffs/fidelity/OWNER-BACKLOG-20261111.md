# Owner backlog · 11 November 2026 (Claude owns everything)

The owner reassigned all work packs to Claude on 2026-11-11 ("Codex is not doing anything anymore, you do all"). The
71-report register and its delivery ledger stay where they are:
[REPORT-STATUS-20261110.md](REPORT-STATUS-20261110.md) and [owner-reports-20261110.json](owner-reports-20261110.json).
This file adds the reports the owner made while inspecting branch `fidelity/basarab-structure-claude` on the local preview
on 10-11 November, so none is lost. Nothing below is published; publishing (merging to `master`) is the owner's call.

States: **fixed on branch** (implemented and checked in the probe; not published, not live-verified) · **partly** ·
**open** (not started or not solved).

## Reported in the live session

| # | Where | Owner said | State | Branch commit / note |
| ---: | --- | --- | --- | --- |
| L1 | Grozăvești, Basarab | fences and concrete borders mixed; missing and overlapping chunks | fixed on branch | `edd7f16f` one continuous white rail on elevated Basarab edges |
| L2 | Grozăvești, Basarab | tram-deck fences not continuous, not going all the way | fixed on branch | `edd7f16f` |
| L3 | Grozăvești (1163, -1271) | misplaced road block | fixed on branch | `edd7f16f` full-width closures again; trams stop before them |
| L4 | Grozăvești, Basarab | lit at night (pylon, cables, blue band) | fixed on branch | `edd7f16f` estimated colours |
| L5 | everywhere, Ultra | invisible boxes / shadows on pedestrians | fixed on branch | `edd7f16f` crowd out of the AO prepass; `43ae2a44` rounded shoulders |
| L6 | Unirii fountains | jets are "just a shadow" | fixed on branch | `c1362cf0` transparent meshes out of the AO prepass |
| L7 | Unirii, Unirea store | roof slab sticks out | fixed on branch | `c1362cf0` |
| L8 | Pipera and app-wide | colliding buildings | partly | `4162dc1c` a lower source building stops at a taller one's walls (787 cut in Unirii, 103 Romană, ...). Left: members of prepared assemblies, courtyard buildings being cut |
| L9 | Old Town | Freddo busy by day; should be closed with a sign | fixed on branch | `44f73a18` club night 22:00-05:00, sign, no party crowd by day, more families |
| L10 | Old Town | tour says enter Freddo while closed | fixed on branch | `44f73a18` |
| L11 | Old Town | dizziness with shots; hidden blackout goal after 5, "Romanian style" | fixed on branch | `44f73a18` not played through in a browser |
| L12 | Hidden bar | no exit door shown | fixed on branch | `44f73a18` |
| L13 | Hidden bar | sitting height wrong | fixed on branch | `44f73a18` stool sitters |
| L14 | everywhere | 60 fps at Ultra on an RTX 5070 | partly | `4812d116` mean 8.4-16.1 ms per frame in the probe; Grozăvești p95 19 ms; not confirmed in the owner's browser |
| L15 | Grozăvești, Unirii, Pipera | pedestrians pile up | open | keep-right lanes tried and reverted (worse) |
| L16 | Unirii and others | cars stuck in junctions ("traffic caused by collisions"); a car looping a U-turn; two cars nose to nose (1148, -1278) | open | idle-claim release tried and set aside (made head-on contacts) |
| L17 | Grozăvești | Basarab tram ramp fork: flat-branch tram overlaps the estimated ramp slab | open | needs the tram grade model changed |
| L18 | Romană (-588, -422) | underground pass leaks; tram stuck there | open | |
| L19 | Grozăvești (1069, -849), (896, -1091); Unirii (-28, 59) | broken / see-through ramps and bridges ("fix all bridges/paths") | open | |
| L20 | Grozăvești (863, -1109) | tram path goes on the road | open | |
| L21 | Unirii (-425, -27) | car drives under grass | open | |
| L22 | Unirii (67, -189) | junction markings incomplete | open | related to reports 26, 32-34 |
| L23 | Romană (Penny) | sign flicker; wants a generic fix | open | coplanar surfaces |
| L24 | Unirii (-1153, 285) | fountains go on the streets | partly | measured: 1 of 44 basins reaches 0.27 m into the carriageway; the rest fill the median to the kerbs |
| L25 | Unirii, Parliament | buildings inside distant landmarks | open | |
| L26 | Unirii (-372, -290) | trees inside a church; is the building accurate? | open | |
| L27 | World map | "Mark" on another district should fast-travel directly, in any mode | open | |
| L28 | Hidden bar | video unavailable; should play in the background without action | open | the official FIFA video does not embed here; a licensed loop is not available |
| L29 | Carturești Carusel | jumping from the top floor teleports to the ground, no falling | open | |
| L30 | All spots | chat bubbles feel random; want location/event-specific cultural lines | open | content rewrite |
| L31 | Tourist spots | a custom waypoint should draw the same trail as the guided tour | open | |
| L33 | Old Town, Freddo | "this is broken": by day the ground floor read as a hole through the building, the name board ran into the balcony, guests sat on the closed club's terrace | fixed on branch | the room behind the glass keeps its walls; board over the left bays below the balcony; the club's terrace seats are empty while closed |
| L35 | Old Town (Freddo and every street) | "you are working around a broken building, that balcony looks broken" | fixed on branch | the 3-D balconies and string course now follow the facade actually drawn (shop floor 4.3 m, the style's storey and window bays): they stood between windows and under the sills on every Old Town street |
| L34 | All tourist spots | "all tourist spots suck -- fix all" | open | Cișmigiu first (L32), then a captured pass over every spot |
| L32 | Cișmigiu Gardens | "still looks terrible, needs a FULL visual refresh to make it more real" (stepped jagged lake shore, railing standing in the water, flat grass banks) | open | large: lake shoreline and banks, railing on the real edge, paths, planting |

## The 71-report register

17 delivered and live-verified before this session (see the ledger). Of the 54 open ones, the reports in packs A/B
(12-18) have fixes on this branch awaiting publication and a check at the original cameras; 19 and 40 are addressed by
L8; 28 by L6. All others remain as the ledger states.
