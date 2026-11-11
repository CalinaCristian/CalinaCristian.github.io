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
| L19 | Grozăvești (1069, -849), (896, -1091), (-28, 59) (the summary had it under Unirii; the F8 report says Grozăvești) | broken / see-through ramps and bridges ("fix all bridges/paths") | partly | (-28, 59) fixed: no bridge parapet on an at-grade stretch. (1069, -849) fixed on branch: the north-east Pasajul branch descends from the 11 m deck to street level at its OSM junction with Calea Griviței (reviewed descent model basarab-northeast-grivita-descent); the closure stands on the street. (896, -1091) diagnosed: flat green ground breaks into triangles on the embankment beside the viaduct |
| L20 | Grozăvești (863, -1109) | tram path goes on the road | fixed on branch | | see L40
| L21 | Unirii (-425, -27) | car drives under grass | fixed on branch | aerial green ground and mapped grass / landuse lying across the open Pasajul Unirii trench covered its traffic; those layers are cut out of open sunken corridors (tunnels stay covered) |
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
| L34 | All tourist spots | "all tourist spots suck -- fix all" | partly | captured pass over the 7 live spots (below); fixed so far: Cișmigiu (L32), Freddo (L33), Old Town balconies (L35), Pike Place and Space Needle not opening on this branch (L36), Space Needle spawn canopy (L37) |
| L32 | Cișmigiu Gardens | "still looks terrible, needs a FULL visual refresh to make it more real" (stepped jagged lake shore, railing standing in the water, flat grass banks) | fixed on branch | graded banks, terrain cut exactly at the outline, granite kerb, lake-shaped water, railing on the coping, weeping willows, Debarcader landing stage; paths and lawns not yet reworked |

| L36 | Pike Place, Space Needle | (found in the spot pass) "Could not open the spot" on this branch | fixed on branch | osm.js is hashed into the Seattle source-context cache; restored byte for byte, willows and the facade frame moved to their own modules; new test guards the hashed scripts |
| L37 | Space Needle | (found in the spot pass) a dark slab 5.6 m over the spawn | fixed on branch | OSM way 241876407 is a glass canopy (building=roof, material=glass); drawn as clear glass on a steel edge with posts |
| L38 | Everywhere | "improve all buildings to make them look nicer (the generic ones too and other landmarks if they fit)" | fixed on branch | facade-detail.js: plaster, ashlar, rusticated bases, panel joints and base grime on world and spot facades; masonry on ten stone-fronted landmarks |
| L39 | Grozăvești, Basarab | "the basarab bridge needs more supports properly positioned, it looks like it's floating" | fixed on branch | a support station where no pier could stand (a road or rail line below, too little clearance) was skipped; it now moves along the deck up to 12 m to the nearest valid spot: 87 bents (was 66), 124 columns (was 101), all clearance rules unchanged (min crosshead clearance 4.50 m) |
| L40 | Grozăvești (863, -1109) and the owner's screenshot | "the tram path is still going on the street" | fixed on branch | on the Basarab deck the tram line runs 3-5 m from the mapped centre of a carriageway drawn 3.5 m each side, so the asphalt (and its lane marks) reached over the tracks, and the strip between them was drawn as road. Bridge carriageways now keep 2.2 m clear of a tram line beside them (tram-facing side narrowed, far side widened, total width and mapped line unchanged: 82 edges); tram rails are drawn into a deck carriageway only where the tram lies within its asphalt; the strip between a tram slab and a road stays concrete |
| L41 | Grozăvești (731, -955), camera bearing 178.6 pitch 14.7 | "why are there holes": seen from below, an open gap in the Basarab deck with sky through it | partly | gore infill added where decks split (106 pieces in the district); this hole remains: the drivable surface is continuous there (roadHeight finds the 11 m deck at about (731, -980)) but nothing is drawn: a surface counted for driving (likely a pad or junction surface between the merging carriageways) has no rendered slab or soffit |
| L42 | Grozăvești (982, -1187), bearing 57.2 pitch -51.1; also (978.6, 14.5, -1186.0), bearing 47.9 pitch -35.3 (two railing runs overlap side by side with a step instead of meeting) | "fence still broken": the white guard stops short where the elevated carriageway meets the descending one; gap and overlap at the join | open | related to L1 / L2 |
| L43 | Grozăvești (1107, -1290), bearing 215.6 pitch 1.5 | "still; doesn't go all the way": the tram-deck railing ends before the ramp foot | open | diagnosed: the railing ends where the tram deck pieces (railDeck) end; the tram line continues down an embankment ramp, still about 1 m above the street, that is not a deck, so world.js tramRailings never sees it |
| L44 | Grozăvești (68.5, 1.9, 203.0), bearing 33.9 pitch -14.7 | "looks odd", "not smooth", "it finishes abruptly?", "let's simulate real life" | partly | Street View (reference only, nothing copied): at 82 / 31 Șoseaua Grozăvești (44.4394) both carriageways are at grade with a grass median; 100 m north (44.4403, "Basarab Overpass") Pasajul is already raised a few metres above Șoseaua Grozăvești, which runs below on the right behind a concrete parapet and steel railing on a retaining wall. So the game's climb and its 5.2 m plateau over Șoseaua Grozăvești are about right (the climb may start slightly early). What differs: (1) the ramp's side above the lower road is a vertical retaining wall with a concrete parapet and railing, not a grassy slope (c5df657c); (2) between the two Pasajul carriageways at one level there is a grass median with tall curved twin-arm lamp posts, not a railing gap |
| L45 | Grozăvești (285.9, 13.4, -776.2), bearing 94.3 pitch -31.4 | "still broken": barriers on the Exit to Giulești ramp in chunks | partly | the bridge parapets are continuous runs (also across edge boundaries); the median barrier there is a collision guard (`rail` walls in world.js `add`) opened by the rule that leaves a wall open wherever another surface at about its level lies just beyond it (junction mouths, merges): needs a parallel-carriageway vs junction-mouth distinction before its gaps can be closed |
| L46 | Grozăvești (364.3, 24.3, -727.4), bearing 254.7 pitch -42.2 | "broken lines": lane markings on the elevated carriageway break, jump sideways and stop, with dark patches on the asphalt | open | related to L22 (junction markings) |
| L47 | Grozăvești (549.1, 28.7, -831.5), bearing 55.5 pitch -30.2 | "why is this cut": a pale tapering wedge in the middle of the Basarab deck | fixed on branch | it was the Basarab centre support between the two tram tracks, drawn pale (#a8aaa7) and tapering where the tracks converge; now deck concrete; slot infill beside a carriageway is drawn as asphalt |
| L48 | Grozăvești, Basarab | "drone can fly through bridge street from underneath": the drone passes up through an elevated deck from below | fixed on branch | a drone under a deck stops 1.6 m below its surface |
| L49 | Grozăvești (1030.1, 13.4, -869.3), bearing 62.4 pitch -44.0 | "car stuck": the police car at the Pasajul closure sank into the rising road | fixed on branch | the car takes the road height where it stands; no car on a slope over 3 % |
| L50 | Grozăvești (579.3, 18.7, -1245.9), bearing 173.5 pitch -28.4 | screenshot without a comment: a side road with edge lines meets a junction whose surface is a patchwork of dark asphalt and pale grey pads; the edge lines end at a dark bar, and grey squares lie on the lawn | fixed, not yet published | reality capture grz-l50 showed the cause: a 7 m concrete wedge where the scenery Calea Griviței rose to the Basarab link ramp held 7.3 m up. The reviewed descent `basarab-southwest-grivita-link-descent` brings the link to street level at its OSM junction (live OSM checked). Grey squares on the lawn: to recheck from the report pose |

### Cross-district sweep (owner, 2026-11-11: "figure out all districts and locations for those kind of issues")

The fixes made for Grozăvești are general rules in world.js / bridge-bents.js and apply in every district: trench grass
cut, at-grade parapets, continuous parapet runs, gore infill, support positions, tram-clear carriageways, embankment slopes.
First counts per district (probe, 11 November):

| District | tram line inside an unflagged carriageway (points) | embankment ramps (slope) | open-trench corridors (grass cut) | carriageways narrowed for a tram |
| --- | ---: | ---: | ---: | ---: |
| Unirii | 19 (Bd. Dimitrie Cantemir, Str. Bibescu Vodă: likely at-grade crossings, to check) | 0 | 4 | 0 |
| Romană | 0 | 0 | 29 | 0 |
| Grozăvești | 13 (Șos. Grozăvești, Str. Alfabetului: at grade, to check) | 10 | 14 | 141 |
| Pipera | 0 | 0 | 61 | 0 |
| Floreasca | 0 | 0 | 0 | 0 |
| Otopeni | 0 | 0 | 20 | 0 |

Next: an audit script per issue class (parapet gaps, deck holes between same-level decks, unsupported spans, stepped verges,
rails on asphalt, surface patchwork) run over all eight districts with a capture at each worst location.

### Spot pass, 11 November (probe captures at the spawn, four directions, 25 m ahead, above)

| Spot | Seen | Next |
| --- | --- | --- |
| Old Town (Lipscani) | neutral shopfront glazing read as dark panels with tan blocks; one design repeated | fixed on branch: a 16-bay shopfront atlas (fascia, awnings, transoms, lit displays of eight kinds of shop, doors, stall risers, piers), one picked per bay; interiors lit at night; no business names |
| Cișmigiu | lake fixed (L32); paths were plain grey strips, lawns one flat green | fixed on branch: alleys by mapped surface with kerbs, mottled lawns, low hoop borders; flower beds not added |
| Arcul de Triumf | read as a plain pale block; bare sides | fixed on branch: dressed-stone masonry (coursed blocks, per-block tint) on the landmark's walls |
| Pike Place | sound; a parked van blocks the spawn view | |
| Space Needle | glass canopy fixed (L37) | |
| Bellevue Meydenbauer | sound (beach, boulders, pier) | |
| Bellevue Downtown Park | dark flakes at eye level round the trees | fixed on branch: they were the last leaf clumps of nearly bare crowns; past about 60 % bare a crown keeps only its twig haze |

## The 71-report register

17 delivered and live-verified before this session (see the ledger). Of the 54 open ones, the reports in packs A/B
(12-18) have fixes on this branch awaiting publication and a check at the original cameras; 19 and 40 are addressed by
L8; 28 by L6. All others remain as the ledger states.
