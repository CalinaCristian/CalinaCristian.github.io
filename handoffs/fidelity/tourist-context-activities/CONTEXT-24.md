# Frozen tourist scene context pass

All 24 destination instances were loaded from the clean `94ef22859007a724356e7c3ecf270f2488ae0b49` snapshot. Every instance has four actual GAME-only 1280×720 WebP captures: arrival, a native public-path attempt, postcard and a scene activity approach. The last approach is the shared scene's first activity; the review notes explicitly identify cases where it belongs to a different destination in that scene. No reference-provider imagery is published.

The overview contract is `game/overview/evidence/spots/<id>.json`, with image files in `game/overview/assets/spots/<id>/`. The 96 images total 5,072,810 bytes. Every image decodes and matches its recorded SHA-256. Complete dossier URL values are preserved, including parentheses in Commons and Wikipedia page names; primary OSM IDs retain their own labelled links. `tools/spots/export-context-evidence.mjs` reproduces this export from the completed capture output and the explicit review notes.

All 24 native scene loads, source-solid membership checks, exact geometry-cache checks and captured high-quality budgets pass. Maximum unique geometry is 601,426 triangles; maximum captured rendering is 1,341,596 triangles / 302 draw calls. These software-GL captures are not a hardware frame-rate benchmark. The prior mandatory native `foot,a` proof remains 0 high / 0 medium / 1 low, recorded separately in `proof/`.

Six native plaque approaches fail: Fremont Troll, MoPOP, Waterfront, Ballard Locks, the Cathedral and Cișmigiu. The other 18 complete their bounded native walk, which is weaker than a complete entry/access/tour acceptance test. Actual pictures also expose occluded endpoint views at Pioneer Square, Lipscani and several crowded plaques. Twenty-one instances retain raw physical-audit findings. All 24 retain a failed full matched-scene-comparison gate and `needs_review` status; none is promoted to READY.

The highest-priority actionable findings are:

- The Cathedral's restored western source building now correctly occupies the old postcard position. Move the viewpoint and arrival/plaque route to the mapped public piazza, retain that building, and resolve the explicitly unverified candle pavilion. Actual public boundary gates and fences remain incomplete.
- MoPOP's preserved source parts obscure the approximate sculpted shell in the actual scene. Unite the source-part geometry and the architecture instead of deleting valid parts. Its native plaque approach is also blocked.
- Ballard's nominal public route reaches a floor about six metres below the wall top. Reconcile source path grade, terrain and walkable geometry. A clear raw audit did not catch it.
- Waterfront's route meets the pier building; Cișmigiu's route meets the bridge railing; Troll's plaque approach meets crowds. Fix physical access and route planning with real public geometry, preserving visitors, trees and buildings.
- Several existing activity handlers remain passive, automatic or premature: Herăstrău bike/boat placement and start award, Meydenbauer automatic kayak and invisible stones, passive Athenaeum/Spring histories, Pioneer automatic Underground and totem timer, and Palace pacing relocation. The per-destination records retain these gaps instead of treating an activity registry entry as completion.

This evidence commit changes overview data and tooling only. Source/participation production was committed separately as `be3af93`, with portable native proof in `94ef228`. Root owns the shared overview UI and README/spec/achievement-copy integration noted in `ROUND-3.md`.
