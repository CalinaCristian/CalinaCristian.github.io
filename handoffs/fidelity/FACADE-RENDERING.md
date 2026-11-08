# Facade rendering handoff — 2026-11-08

Branch: `fidelity/facade-rendering`, based on `65ba08d`. Integrate the resulting commit; do not replace whole files from this older base. Scope is `buildings.js` facade slab helper, `world.js` material/balcony hunks and a focused diagnostic. No data, source footprint, building-part/union, road, parking, cache, signal or flight-boundary changes.

## Reproduced causes

The exact owner screenshot camera is unknown. Root identified its live build as `58129ab`; the affected material/night-atlas, near slab, near bloc balcony and base balcony code blocks are byte-identical there and at this branch's `65ba08d` base. Exact block hashes are saved in `/workspace/facade-evidence/live-source-equivalence.json`. This is a reproduction of the shared defects using actual game materials, not a claim to have matched the screenshot pose.

- Room identity used `floor(vMapUv * 4)` even though the atlas has different window grids. One opening could contain multiple room identities and curtain boundaries. The old near-window position atlas also quantised the ray origin, visibly stepping floor edges during motion.
- `cross(up, normal)` can oppose increasing facade U on one footprint winding. Fixed 1.4 m × 1.7 m room openings also disagreed with the actual facade window dimensions. Together these moved the inferred furniture positions as the camera translated. The existing built-in view position and matrices already update per draw; no stale manual camera uniform was found.
- Generic balcony floors had front/top/end faces but no downward soffit. A separate legacy pass added offset sheets over the near balconies. The result was visibly open from below and inconsistent from the side.

## Changes

Each connected window now stores exact constant rectangle bytes in the existing RGBA8 data texture. Window coordinates are continuous, room identity stays constant within an opening, and the shader recovers increasing-U/V axes and physical window width/height from view-position and UV derivatives. Curtain, floor, furniture, picture, reveal, night light and reflection detail remain. Rooms still use one facade material and no room geometry. One former near-window texture lookup is removed; the replacement adds local tangent/scale arithmetic.

`emitFacadeSlab` emits a front/top/soffit/end shell. Existing balcony floors and thin parapet plates use it; the parapet omits its hidden contact underside to avoid coplanar duplicate faces. Floor + plate cost 20 triangles in the existing merged mesh. Duplicate near balcony sheets are removed. Existing tall/scenery silhouette placement and culling policy remain; tall accessories and the detail random stream are retained. This does not add balconies to other styles or claim source knowledge of apartment interiors/balcony finish.

## Focused independent checks

`node game/dev/harness/facades.js --out=/tmp/facades`

Optional `--root=/path/to/baseline` serves a different source tree. The diagnostic exposes private material factories only through its local server response; no production debug exports are added. It uses the actual compiled shader and compares GPU ray hits against independent camera rays through a fixed world back-wall point.

- Final: **38/38**, no page/console errors. Shader subset **32/32**; floor shell front-side visibility/normals from below, above, left, right and front plus triangle budget **6/6**.
- Untouched `65ba08d`: shader subset **0/32**, worst inferred anchor error **1.819 m**. Its additional missing-helper check fails as expected (33 failures total).
- Final worst anchor error **0.000282 m**, with 0.1 m/1 m translations, camera rotation, both facade windings, a rotated cell at x650/z−550, and alternating main/secondary cameras. This verifies current-draw camera coordinates without flattening the room depth.
- Evidence: `/workspace/facade-evidence/{focused-final,focused-before}/results.json` and their production-material images.

## Actual game review and budgets

Targets: Romană OSM `w1449310913` (source index4338, center x297.144/z−389.201, h11.6 m), and Floreasca source index2147 (center x−264.208/z942.418, h14.5 m). Floreasca has no `buildingIds` at this base, so the diagnostic matches its source footprint centroid instead of fabricating an ID. Cameras are recorded in results JSON.

The exact final-source immutable snapshot is `/workspace/facade-evidence/candidate-final`; baseline is `/workspace/facade-evidence/baseline`. Final warmed high/full-mirror frames and baseline frames are in `perf-final/` and `perf-baseline/`, with zero page/shader errors. Every matched pose has unchanged draw calls. Maxima:

| district | baseline triangles / calls | final triangles / calls |
|---|---:|---:|
| Romană | 1,163,678 / 343 | 1,174,910 / 343 |
| Floreasca | 1,105,327 / 343 | 1,107,079 / 343 |

These sampled warmed frames are below 1.5 M / 400. A cold first-render sample reached 439 calls in both baseline and candidate; this is retained in the exploratory results and is not described as passing. No hardware FPS claim is made from software GL.

Human review confirms continuous floor soffits and side edges in the final `perf-final/*-below.png` and `*-side.png`, including the blue Floreasca balcony panels. Earlier 18-angle A/B sets (`district-final/` and `district-baseline/`) cover movement/rotation/above and attempted far views. Those used the preceding candidate before a tall-accessory-preservation cleanup; the inspected target buildings are unchanged by that cleanup. The far street-level target views are obscured by trees/nearby buildings and are not positive evidence for distant balcony visibility. Existing near/far culling policy is unchanged.

A final traffic-evolution retake steps traffic twelve times per pose and records visible fleet/pedestrian counts. All eight final/baseline frames pass with zero page/shader errors and unchanged draw calls: Romană has321 vehicles/560 pedestrians, final max **1,186,124 triangles /343 calls**, baseline **1,174,892 /343**; Floreasca has184 vehicles/560 pedestrians, final max **1,113,757 /343**, baseline **1,112,005 /343**. See `traffic-final/` and `traffic-baseline/`.

After the environment migration, supplemental compositor screenshots timed out while fonts loaded (numeric render results completed without page errors). The completed evolved-traffic retake captures the renderer canvas immediately after each render and succeeds. No production workaround was needed.

The tracked `facade-rendering-proof.json` preserves source hashes, affected-live-code equivalence, the complete focused checks/ray comparisons, eight matched frozen frames and eight matched evolved-traffic frames per source, and logic totals. It contains no reference imagery or credentials. Pre-pause scratch images remain useful where the workspace retained them; the tracked numerical proof survives environment divergence.

`npm run harness -- --scenario=foot,a --city=bucharest`: **0 high / 0 medium**, two low software-GL/performance notes. Evidence `/workspace/facade-evidence/logic-after/latest.md`. Syntax checks and `git diff --check` pass. Exact final file hashes are in `/workspace/facade-evidence/final-source-manifest.json`.

## Integration

Root owns README/spec/STATUS integration. Suggested player-facing note: “Window interiors remain fixed in their rooms as you move; balcony floors render correctly from below and from the side.” Keep the source/modeling limits above; no whole-district parity or full visual-detector survey is claimed by this focused change.
