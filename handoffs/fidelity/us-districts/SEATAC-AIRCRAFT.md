# SeaTac airside aircraft correction

The exact 437 street comparison exposed a procedural aircraft in the public terminal forecourt at `Arrivals-Drive-50-R-right`. The game-only before image and actual camera are retained in `seatac/aircraft/before-camera.json`. Street View triggered review only; no attributes were extracted from it.

Independent retained Esri aerial measurements and original OSM apron polygons show that the old terminal-perimeter fractions 0.12 and 0.40 fall outside mapped airside aprons. Four unmeasured perimeter/hardcoded placements are replaced by four independently observed aircraft poses beside source gate contexts C11, C9, B7 and A4. `game/research/landmarks-seatac-aircraft.json` preserves raw gate identities/tags, original apron support, mosaic and metadata hashes, sampled nose/tail/wing pixels, geographic coordinates, measured axes, plan dimensions and uncertainty. Acquisition date is unknown. These are four representative observed aircraft, not a current fleet/operator claim.

All four anchors lie inside original mapped apron polygons. The complete emitted geometry has zero plan overlap with any of the 1,858 retained source building footprints. A D2 candidate was rejected because its observed nose would contact the current original terminal footprint; the source building was not changed. At A4 one sampled outer wingtip is outside the mapped apron border; that uncertainty is explicit, and the original apron/road geometry remains exact. Full apron-polygon containment is not claimed.

The existing generic airframe is scaled along its measured fuselage axis and across its measured wing span. Height, subtype, engines/gear/windows and small shape details remain estimates. Paint is unbranded; the independently visible yellow A4 fuselage is retained. Unsupported operator-specific stripe faces are removed. All four aircraft remain; the change is not population or performance thinning. Total isolated SeaTac triangles are 14,547, compared with 14,619 before the correction.

Every source terminal footprint, literal building dimension and collider is unchanged. The terminal collision SHA256 remains `00aa1e2fff8a64cc4007252d014b835d66ffb9a6e46d7f134b45f2f6621a4720`. Moving the decorative aircraft legitimately changes the full scene's horizontal bounds; facade regression checks retain the actual glass/opaque controls, exact collider and unchanged 0–36.5 m vertical envelope. Separate aircraft checks verify the measured axes/span and complete source-body clearance.

Passed CPU checks:

- `node tools/landmarks/seatac-aircraft-check.mjs`
- `node tools/landmarks/seatac-facade-check.mjs`
- `node tools/landmarks/us-source-check.mjs` (all 24 US models)
- `node tools/landmarks/geometry-check.mjs` (all 61 models)

Native corrected-curb/airside images, the three refreshed isolated model studies and final capture provenance are pending the next combined runtime release and completion of the single-browser 437 before walk. No final rendered acceptance is claimed by this source/geometry checkpoint. Atlas/native jobs were held before starting so that they use the next consolidated freeze.
