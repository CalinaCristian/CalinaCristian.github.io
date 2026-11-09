# Native 00c Seattle candidate: failures retained

Exact source: `00c603358ac547b898cb8ad18f3d7ed9b229c10c`. The original public-app observer closed at 14:47:17 UTC on 2026-11-09; the separate, unchanged-source cost/matrix observer closed at 15:13:02 UTC. Both ran High/full passes in system Chromium with software GL, muted audio, fresh browser contexts, blocked service workers and unthrottled local HTTP. There were no page/console/local asset errors. This is neither hardware FPS evidence nor an accepted visual rebuild.

All twenty canvas images and both full-UI PNGs are preserved at full size in `images/`. Every image was inspected individually at full size. `files.json` pins the bytes. Original external files remain under `/workspace/reality-pass/seattle-context-00c60335/`; the two executed observer tools and the reproducible reducer are in this handoff's parent directory. The raw reports, source ledger and profiles are retained compressed here, with their original data and timestamps. No reference-provider pixels are included.

## Actual cold loads and native input

| Scene | Unprofiled public `enterSpot` | Native fetch / build / finish | Result |
| --- | ---: | ---: | --- |
| Pike Place | 14,144.6 ms | 478 / 11,668 / 720 ms | Fails 3-second target |
| Seattle Center | 18,682.6 ms | 456 / 15,086 / 1,115 ms | Fails 3-second target |

Pike's ordinary W/arrow route reached four of five goals over 66.04165 m. Maximum floor error was 0.007142 m and maximum vertical step 0.009373 m, but the Gum Wall end remained blocked. The static building observer recorded zero contacts; nearby crowd bodies remain in the raw trace. This does not prove the exact crowd dependency or turn the incomplete walk into a pass. The source-paving fixed fixture is almost entirely occluded by a nearby body/structure and is rejected as a meaningful paving picture; its raw image and displaced actual pose are retained.

The Needle approach used W/arrows, E started the actual elevator, and the native 41-second ride reached the Loupe. Later cardinal views rotate the camera at that arrival position. West/north views look through the real central structure and are **orientation-only evidence**, not a walk around the outward viewing ring. Phone views are 390×844 responsive captures with `hasTouch:false`, not touch playthroughs. They preserve the old 00c activity toolbar overlap, before root's later UI fix; they cannot be relabelled as current mobile acceptance.

## Exact draw attribution

The read-only wrapper preserves `renderBufferDirect` receiver, arguments, calls and return. For all three probed frames, sums equal actual `r3d.stats` with **zero unattributed calls/triangles**. `profile-summary.json` contains every object/pass group, including main, shadow and post work. Wrapper CPU measurements include instrumentation/driver overhead and are not GPU timings.

| Frame | Main triangles | Shadow triangles | Other triangles | Total / calls |
| --- | ---: | ---: | ---: | ---: |
| Pike native spawn | 529,851 | 263,877 | 18 | 793,746 / 285 |
| Needle native spawn | 1,399,005 | 286,993 | 18 | 1,686,016 / 369 — over budget |
| Loupe downtown arrival | 1,009,965 | 252,221 | 18 | 1,262,204 / 331 |

Needle spawn includes 169,000 triangles in `chihuly-suspended`, separate from 422,704 native tree triangles over main and shadow passes, 219,376 source-tree triangles, 564,925 source-building triangles and 107,616 native terrain triangles. At Loupe the native tree total is still 422,704. No tree/actor/source record was removed to obtain these numbers. The original unprofiled observer preserves every additional condition/view budget failure, including the 1,480,430 / 415-call occluded Pike fixture and the 1,654,046-triangle elevator approach.

CDP profiles use a 1-ms sampling interval. Profiled public loads were 19,607.1 ms and 21,107.5 ms, so use the earlier unprofiled loads for acceptance. Inclusive sampled times overlap and must not be added: source-context ground accounts for approximately 3,256.9 ms Pike / 4,259.5 ms Needle, with water-face cutting nested inside at 1,904.0 / 2,964.6 ms. Environment-map setup is a separate 996.9 / 3,659.0 ms inclusive path, including shader/driver calls. The two profiles retain self and inclusive costs for reproducible attribution; software-GL driver cost does not establish RTX5070 performance.

## Rainier: real bounds and failed presentation

The native measured matrices match the independent source reconstruction exactly. There is no observed stale matrix or camera-height error. The retained USGS mesh has 13,824 emitted vertices, original elevations 345–4,297 m, width 31.64 km and depth 46.19 km. The coarse source mesh's peak is 4,297 m; no surveyed summit-height claim or replacement height is made.

At the actual Loupe camera `[15.389047,155.75,9.364910]`, scale is uniformly `0.0832096130863174`. Its world bounds are `[2383.648354,168.127430,5168.765181]` to `[5016.773086,496.971821,9012.570850]`. Native projection bounds at 1200×800 span about **291.86×23.47 pixels**; the peak projects to approximately `[624.51,298.46]`. The finite cropped highland patch begins above the camera and has no regional terrain joining it to the local ±4-km context. Its material is `MeshLambertMaterial`, `fog:false`, opacity 1. The city fades into haze while this finite crop stays dark and opaque, producing the visible floating strip. Source heights, winding, camera and draw visibility are preserved as measured; changing a screenshot camera or squashing/lowering the mesh is not a justified correction.

Mountain continuity, atmospheric appearance and source water visibility are separate defects. Current mountain placement uses the existing flat geographic projection, without a curvature model. A future geographic/terrain correction needs explicit source and projection provenance, continuous regional support and fresh actual views. Fog adjustments alone cannot supply missing terrain.

## Tree and visual findings

The native camera is parented to `onfoot`: its local position is `[0,0,0]` while world position changes during walking/elevation. Context trees read this local value. The native spot updater already reads world X/Z but discards Y, and these two scenes do not enable its available native tree LOD. Both LOD selectors currently use horizontal distance, keeping ground crowns at near detail under an elevated observer. This is a measured correction target, not a reason to thin source trees or lower a quality preset.

Visual acceptance remains **failed**: Rainier is disconnected; clear-day water/city contrast is weak; the Pike upper frontage still uses generic repeated windows and the canopy has a heavy unsupported appearance. The Gum Wall image is crowd-obstructed; the Needle queue appears raised relative to the approach slab and needs a physical support query before assigning its cause. Source context improves geographic density but does not establish photographic fidelity or a finished market scene. Night, winter, rain and both phone layouts were inspected and remain candidate evidence only.

No production source or quality changes occurred during either immutable run. Next meaningful checks require corrected source/runtime, current activity chrome, native walking around the Loupe for outward views, and synchronized current overview images. All present failures remain historical evidence.
