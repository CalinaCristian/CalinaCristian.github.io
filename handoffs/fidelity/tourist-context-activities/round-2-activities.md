# Rowing and scene participation

The previous Cișmigiu offset selected no water points, so its interaction could not start. The replacement is a 48 m
return course validated against the actual lake polygon and bridge clearance. The source Debarcader node lies 3.61 m
inside the water polygon; its public interaction is on the adjacent dry bank, 6.61 m from the unchanged node. An existing
artificial continuous lakeside railing now has an opening at this mapped landing. No building/way/area record changed.
The dry approach is reachable from the existing arrival by a 206.64 m collision-checked route; it remains optional and is
outside the 180 m short-tour limit. The boats are not presented as a compulsory full-lake visit.

`participation.js` owns native 44 px controls, busy phases, E/Escape, look, restoration and cancellation. Rowing needs real
strokes; waiting adds no progress. The boat has an inner floor/rim so the original one-sided hemisphere no longer vanishes
from the seated camera. Animated oars add forward velocity, which decays under drag. The camera follows the boat and
restores its exact dry-bank pose on cancellation. A completed 48 m return required 30 test strokes.

The dated renderer decides winter appearance rather than November wall time. The warm-season calendar is an approximation:
the existing dossier confirms summer rowing and winter skating, but current rental hours could not be verified. This work
removes claims of exact April–October opening hours. Entrances at the Athenaeum and Spring Palace now describe outdoor,
explicitly advanced history; they do not simulate an unseen interior. Village Museum porch stamps use mapped household
names and no longer invent identical furniture for every house. Curtea Veche's unsourced souvenir vendor was removed.

## Evidence and limits

`tourist-water-route-check.mjs` passes real 48 m water/bank/bridge checks plus concave-bank, narrow-water, dry-shore and
source-preservation fixtures. `tourist-participation-check.cjs` tests actual game rowboat controls: no idle completion,
repeat-E rejection, early exit, exact restoration, map/photo/pause/teleport/hidden cancellation, both phone orientations,
full completion and no thrown page errors. The first run correctly failed pause on the existing host. A subsequent run
passes with the four precise requested main/drone cancellation hooks applied in a Playwright response override
(`HOST_CONTRACT=1`); this is an explicit host-contract test, not evidence that the root source already contains those hooks.
Parent root is applying the production hooks. Re-run without `HOST_CONTRACT` once that commit is merged.

The high renders captured 995,521 triangles/219 calls maximum; phone renders 977,140/103 and 982,860/123. The rowboat's
scene count was 540,413 triangles before subsequent small visual refinements. Both phone layouts fit the viewport and
both buttons measure 44 px high. Raw context audits still contain unrelated existing findings. No new READY acceptance,
reference-parity claim, exact rental equipment claim, or clean-all-context claim is made.

Source references: https://www.openstreetmap.org/node/473428602,
https://www.openstreetmap.org/way/16292044,
https://en.wikipedia.org/wiki/Ci%C8%99migiu_Gardens;
existing `game/research/activities.md` records ALPAB's unavailable current-hours source.
