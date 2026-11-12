# Backlog · open owner reports (single list)

Updated 2026-11-12. Only what is still open or waits for the owner. Finished reports are removed once their fix is on
`master` and re-checked live at the report pose; their record is the commit history (`git log -- handoffs/fidelity`).
Report poses: [owner-reports-20261110.json](owner-reports-20261110.json) and the F8 JSON the owner pastes. Reality checks
against Street View: [reality-check/](reality-check/README.md).

Publishing: the owner asked (2026-11-11) for fixes to go straight to `master`, no PR, after the checks below pass.

## Open

| Where | Report | State / diagnosis |
| --- | --- | --- |
| Grozăvești (314, -697) | small seam | where the carriageway's guard steps 1.5 m sideways at a width change the diagonal piece meets the next guard with a short gap seen from low angles |
| people at night | "shadows for people (texture like they are just standing that are transparent)" | not shadows: at night the moon shadow is off and lamps / headlights cast none; not reproduced in a visible Ultra window at night among walkers (the AO pass already skips the crowd, lamps cast no shadows); needs an F8 report where they appear |

## Waiting for the owner's walk-through: Space Needle rebuild (2026-11-11 / 12)

| Request | What was built |
| --- | --- |
| "fix space needle area ... rebuilt based on street view, osm ... realistic ... proper night lighting ... the upstairs floor ... glass ... bar, restaurants ... the elevator back to be visible" | One tower model (`spots/space-needle.js`) from the OSM parts of way 12903132 and Street View (Space Needle Loop, Aug 2025): twin-beam legs merging at the waist and forking under the top house, open lattice core, three-winged 100 ft level, 48 fins under the glass floor, halo, both glazed rings at the mapped radii (15.5 m and 13.7 m; the old model drew them at 20.4 m and 17.1 m), roof, spire. Visit scene: base pavilion on the mapped footprint, The Loupe (turning glass floor, The Loupe Lounge) and the 520 ft level (Atmos Cafe, Atmos Wine Bar, open-air deck with the leaning glass barrier and glass benches) are fitted out and walkable, joined by a walkable stair; the elevator goes to 520 ft, the car has its doors and back wall; fountain jets; all three entrance canopies are glass. Night: floodlighting baked per vertex, rooms lit by their fittings, halo ring, beacon. The same tower is used by every far backdrop (Kerry Park, Gas Works, Pike Place, Bellevue) and the driving-world landmark follows the same proportions. Estimates (interior layout, furniture, member sizes, light strengths) are listed in the module header. Not modelled: the pavilion interior (seen through the glass only), the 510 ft mezzanine, the glass "Oculus" at the stair foot, the 100 ft level's interior, the holiday sky beam. |

| "eat & drink activities in the space needle ... achievements mentioning how expensive it is" (2026-11-12) | Three orders at the counters: an Old Fashioned at The Loupe Lounge ($24), a latte and croissant at Atmos Cafe ($14), a Washington red at Atmos Wine Bar ($19). Each is ordered, then sipped / bitten step by step with the glass or cup in hand; the panel keeps a running bill with the $35-39 ticket. Achievements: "Sky-high bar tab", "Altitude surcharge", "Priced by the foot", and "The view is not free" (about $94) for all three. Menu prices are the game's guess, not a sourced menu. |

## Checks before every push

`node --test game/dev/*.test.mjs game/dev/harness/*.test.mjs` (landmark-cec-source and spot-availability fail on
`master` too), `npm run harness -- --scenario=foot,a --city=bucharest` (0 high / 0 medium),
`node game/dev/harness/bridge-bents-check.cjs <repo> <out> bucharest grozavesti`,
`node game/dev/harness/tram-sweep-audit.cjs <repo> <out> bucharest grozavesti`. `git fetch origin master` and merge first.
