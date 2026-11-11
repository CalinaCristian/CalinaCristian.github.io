# Reality check · Grozăvești

Viewpoints: `game/dev/reality/viewpoints.json` (district `grozavesti`). Panoramas viewed as reference only (see README).
States: **match** · **differs** (finding open) · **fixed** (commit) · **not reviewed**.

| Viewpoint | Panorama shows | Game shows | State |
| --- | --- | --- | --- |
| grz-pasaj-west-cet (82 Șos. Grozăvești, h 34) | both carriageways at grade, wide grass median with a low kerb and bollards; CET oil tanks and a concrete wall with a fence on the right | at grade; the Pasajul carriageway starts its climb here | differs: the climb should start further north (see next) |
| grz-pasaj-west-start (31 Șos. Grozăvești, h 355) | the carriageway stays flat for 100 m or more; the overpass arch far ahead | the climb begins at once and reaches 5.5 m 76 m on (7.8 %) | differs: start of the climb a little early |
| grz-pasaj-west-overpass (on the ramp, h 0) | the deck a few metres up; Șos. Grozăvești below on the right behind a concrete parapet with a steel railing on top, on a retaining wall; grass median between the two Pasajul carriageways with tall curved twin-arm lamp posts; Basarab arch ahead | deck at 5.2 m, about right; white rail with a blue band on both sides; a railing gap instead of the grass median; ordinary single-arm lamps; grassy slope (c5df657c) below the side | differs: (1) side above the lower road should be a retaining wall + concrete parapet + steel railing; (2) median: grass with curved twin-arm lamps, no railing between same-level carriageways |
| grz-l40 / grz-l19b (nearest panorama: 92 Șos. Nicolae Titulescu, under the deck, h 190) | the raised road stands on a tall, solid, vertical concrete retaining wall (weathered grey, graffiti) right beside the street, a narrow sidewalk at its foot; the deck edge and a fence on top; no open slope, no visible piers along this stretch | open slopes / embankment ground that read as see-through (L19b), piers | differs: model the ramp sides along Titulescu as a continuous vertical retaining wall from the street up to the deck edge |
| grz-l50 (corner of Calea Griviței and Str. Căpitan Octav Cocărăscu; a second panorama on Calea Griviței at the ramp foot, 44.4521689, 26.0665856, h 150) | Calea Griviței at street level with trolleybus wires; the Basarab link carriageway alongside stays level for well over 100 m before it climbs | a 7 m concrete wedge: the scenery Calea Griviței rose to the link ramp, which OSM joins at node 1330584235 but the game held 7.3 m up (the link bridge w295756128 stayed at 11 m to its south-west end) | fixed (reviewed descent `basarab-southwest-grivita-link-descent`: 11 m at the main deck, ground at the Calea Griviței node, 3.4 % over 341 m; the 8 railway crossings lie in the first 30 m, still above 10 m). OSM checked against the live API on 2026-11-11: same node lists and tags as the build. The real climb starts later than the model's; scenery around the corner (buildings, side street) is simpler than the panorama |
| all viewpoints with broadleaf trees (autumn) | crowns thin out tree by tree | half-bare crowns had sky-blue holes punched through them (clump mask), which read as missing polygons | fixed: a crown is either fully leafed or fully bare (render.js) |
| all other viewpoints | | | not reviewed |

General finding so far: the Basarab and Pasajul ramps in Grozăvești stand on vertical concrete retaining walls with a
parapet or fence on top wherever a street runs beside them; grass medians separate same-level carriageways. The grassy
embankment slope added in c5df657c was wrong for these ramps: embankment ramps (raised, not bridges) now stand on a
continuous vertical concrete retaining wall (game/src/world.js, commit "reality check: ramps on retaining walls").

Open from this pass: the descending Basarab branch along Nicolae Titulescu is tagged as a bridge in OSM and drawn as an
open viaduct on V piers, while the panorama shows a solid retaining wall there; median between same-level Pasajul
carriageways (grass with curved twin-arm lamps, not railings); start of the west climb slightly early.
