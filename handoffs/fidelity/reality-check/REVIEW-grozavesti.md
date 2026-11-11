# Reality check · Grozăvești

Viewpoints: `game/dev/reality/viewpoints.json` (district `grozavesti`). Panoramas viewed as reference only (see README).
States: **match** · **differs** (finding open) · **fixed** (commit) · **not reviewed**.

| Viewpoint | Panorama shows | Game shows | State |
| --- | --- | --- | --- |
| grz-pasaj-west-cet (82 Șos. Grozăvești, h 34) | both carriageways at grade, wide grass median with a low kerb and bollards; CET oil tanks and a concrete wall with a fence on the right | at grade; the Pasajul carriageway starts its climb here | differs: the climb should start further north (see next) |
| grz-pasaj-west-start (31 Șos. Grozăvești, h 355) | the carriageway stays flat for 100 m or more; the overpass arch far ahead | the climb begins at once and reaches 5.5 m 76 m on (7.8 %) | differs: start of the climb a little early |
| grz-pasaj-west-overpass (on the ramp, h 0) | the deck a few metres up; Șos. Grozăvești below on the right behind a concrete parapet with a steel railing on top, on a retaining wall; grass median between the two Pasajul carriageways with tall curved twin-arm lamp posts; Basarab arch ahead | deck at 5.2 m, about right; white rail with a blue band on both sides; a railing gap instead of the grass median; ordinary single-arm lamps; grassy slope (c5df657c) below the side | differs: (1) side above the lower road should be a retaining wall + concrete parapet + steel railing; (2) median: grass with curved twin-arm lamps, no railing between same-level carriageways |
| grz-l40 / grz-l19b (nearest panorama: 92 Șos. Nicolae Titulescu, under the deck, h 190) | the raised road stands on a tall, solid, vertical concrete retaining wall (weathered grey, graffiti) right beside the street, a narrow sidewalk at its foot; the deck edge and a fence on top; no open slope, no visible piers along this stretch | open slopes / embankment ground that read as see-through (L19b), piers | differs: model the ramp sides along Titulescu as a continuous vertical retaining wall from the street up to the deck edge |
| all other viewpoints | | | not reviewed |

General finding so far: the Basarab and Pasajul ramps in Grozăvești stand on vertical concrete retaining walls with a
parapet or fence on top wherever a street runs beside them; grass medians separate same-level carriageways. The grassy
embankment slope added in c5df657c was wrong for these ramps: embankment ramps (raised, not bridges) now stand on a
continuous vertical concrete retaining wall (game/src/world.js, commit "reality check: ramps on retaining walls").

Open from this pass: the descending Basarab branch along Nicolae Titulescu is tagged as a bridge in OSM and drawn as an
open viaduct on V piers, while the panorama shows a solid retaining wall there; median between same-level Pasajul
carriageways (grass with curved twin-arm lamps, not railings); start of the west climb slightly early.
