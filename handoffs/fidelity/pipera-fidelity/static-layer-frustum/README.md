# Static layer frustum proof

Accepted run R4 uses immutable source `c78a5f4c522723fb2f4e640999e3ac5d164fc724`. The native Unirii first 150 m produced **334 calls / 1,576,147 triangles** before selection and **334 / 1,486,993** afterward. The largest accepted frame, including an actual progressive reflection step, was **342 / 1,488,049**. Winter reached **1,461,009** triangles. This proof does not claim acceptance of independent water or pedestrian changes subsequently integrated by root.

## Change

Two construction hooks in `world.js` retain original 250 m component spans for the area, grass, paving, sport, ground, road, pad and marking layers. The helper selects complete spans; ground and grass additionally use contiguous blocks of at least 64 triangles. Block bounds are computed once from their complete canonical geometry and expanded by 1 cm. Runtime tests only whole bounds against camera planes, first rejecting the original parent component. There is no per-triangle or backface selection during rendering.

The helper caches world bounds and camera planes with exact matrix invalidation, reuses typed masks, and copies consecutive surviving ranges in original index order. Canonical index arrays, all vertex attributes, source geometry, trees, material settings, ranges, populations and physical outputs remain available. Native mesh raycasts temporarily use the complete canonical index and restore the current render selection in `finally`.

## Accepted evidence

`summary.json` records the results; `accepted/report.json.gz` retains the complete original report payload. `accepted/pixels.json` records all eight 1280 × 720 RGB comparisons: forward, left, back and right in summer and winter. Every pair has exactly equal camera transforms/FOV and **zero changed pixels**. All eight final images were also inspected visually. The native run uses high quality, pixel ratio 1, far 5000, mirror far 150, clear rush conditions and the original FOV 75.3991286597627. It retains all 624 vehicle and 560 pedestrian objects and their native state. The public first drive reached 137 m over 16.9 simulated seconds with no reset before the camera controls.

The summer forward main pass changes from 1,111,354 to 1,054,635 triangles; mirror changes from 260,497 to 228,062. The true sun-shadow pass remains 204,278 triangles and is counted in both totals. A/B comparisons freeze the clock and in-flight reflection publication; separate accepted warm/sample frames run the unchanged native progressive reflection stepping and include its draws. Summer explicitly requests a job through the existing builder when needed; winter continues an existing job. Those methods are recorded individually in the raw report.

The report checks exact physical output signatures for colliders, road geometry/grades/directions, all road-midpoint surface/road-height/walk-top queries and tree records. It also checks all actor states, object identities and the identities of all 284 position/normal/UV/color attributes. The native fine-block raycast control finds canonical ground face 158 in `ground -1,2` while that child block is culled inside a visible parent: the render subset misses, the canonical mesh hits, and the selected index/range is restored. The 15 block controls and 11 original controls pass, including transforms, cache invalidation and an orthographic shadow camera.

The 71 additional flat meshes have 316 original components and 2,770 selected blocks. Measured added typed storage is **1,389,544 bytes**, including index copies, local/world bounds, ranges and masks. This excludes original geometry, small JavaScript objects, shared camera caches and driver storage. One-time preprocessing measured 45.3 ms under shared cloud load.

Actual instrumented callback elapsed time across 20 accepted frames has median 0.95 ms and maximum 4.9 ms. A separate replay of the exact final native 68-callback sequence, using unchanged production callbacks without draw logging or rasterization, has 50 samples: median 0.2 ms, p95 0.5 ms, maximum 1.7 ms. These measurements exclude GPU draw/upload costs; SwiftShader cloud measurements are not hardware FPS evidence.

## Retained unsuccessful attempts

All original external raw directories remain unchanged. Portable copies in `superseded/` retain every image, candidate source, report and source hash; reports are losslessly gzip-compressed. R1 used only coarse spans, exceeded the budget and had a QA camera/FOV damping confound. R2 used 256-triangle blocks and had zero changed pixels but reached 1,500,019 triangles, exceeding the cap. R3 used 64-triangle blocks and passed image/budget controls but was superseded to remove bounds/key allocations and reduce callback costs. Their dated results are not relabelled as accepted R4 results. `manifest.json` hashes the portable files.

## Reproduction

Archive the exact source commit to `SOURCE`. Use a new empty `OUTPUT` directory. The preload chooses installed Chromium and bounded browser waits without changing served source files. With the managed environment's Node dependencies:

```sh
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node --require ./browser-preload.cjs ./native-probe.cjs \
  "$SOURCE" "$OUTPUT" ./accepted/world.candidate.js ./accepted/cell-frustum.candidate.js
```

Run `node verify-blocks.mjs` from this directory for the 15 block controls. The original 11 controls are in `../cell-frustum/verify.mjs`. The browser runner requires the unchanged c78 baseline and asserts that the production world delta contains only the two static-layer hooks. Source hashes, production file hashes, runner hash, browser/preload details and native frame counters are retained in the report. Repeated native traffic captures can have different evolving actor positions; the paired comparisons use the same scene and actor state.
