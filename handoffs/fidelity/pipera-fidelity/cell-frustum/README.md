# Conservative merged-cell frustum selection

`game/src/cell-frustum.js` retains each merged solid/roof mesh's canonical index
and all vertex attributes. Before each draw it copies the surviving original
250 m cell spans, in their original order, into a dynamic index buffer. Bounds
come from the complete component geometry, expanded by 1 cm, rather than a tile
rectangle. Each main, mirror and true shadow camera selects its own spans.
Source data, geometry, population, render distance, materials and LOD are unchanged.

Physical `Mesh.raycast` calls temporarily use the complete canonical index and
original draw range, then restore the current render selection in `finally`.
This keeps roofs outside the last rendered camera available to drone queries.

## Evidence and scope

The native probe serves immutable baseline **0775fdaf15442a46c3fe98f4e6875c9c09046a99**
from `/tmp/drivecv-runtime-0775`. Its explicit world-source override only records
the original cell spans; the helper is installed on the same live scene after
the before frames. Full native high quality, 1280×720, summer/day/clear,
hour-eight traffic, player at `(-505.7, -657.7)` on source `w1372391887`.
The original **631 vehicle objects / 560 pedestrian objects** survive every
frame. No NPC positions are changed.

For the A/B pixels, the performance clock and in-flight reflection publication
are held constant; true shadow and mirror draws still run. Reflection stepping
and the real performance clock are restored for the final native complete-frame
sample. Raw per-draw counters include every pass, rather than assuming that a
renderer counter is reset between draws. Software GL does not establish hardware FPS.

- `initial-comparison/`: unchanged first raw report and all four image pairs.
  Left, back and right are **exactly equal**. First forward differs in 14,955
  mirror pixels (bbox 758,84–980,191); this comparison was confounded by the
  first mirror using the previous shadow state and is retained as a failed
  image comparison. Its helper predates the physical-query wrapper.
- `warmed-native/`: unchanged final raw report and forward image pair, with a
  warm frame before capture on each side. Forward is **exactly equal**,
  including the mirror. This uses the final helper hash recorded in the report.
  The actual loaded-world off-camera roof control hits `roofs 0,-1`, canonical
  face 0, at `[440.3029378255208,28.799999237060547,-595.1970621744791]`;
  the render subset misses and the wrapper restores index identity and range.
- `pixels.json`: decoded RGB equality and image hashes for all four accepted
  pairs, explicitly retaining their separate capture origins.
- `cpu-controls.json`: eleven CPU controls, including true shadow-camera
  selection, transformed geometry bounds, original index order, unchanged
  attributes, empty selection and an off-camera roof query.
- `manifest.json`: retained source/report/image hashes and production hook hashes.

| Camera | Before triangles | After triangles | Calls before/after |
|---|---:|---:|---:|
| Main, forward | 1,181,344 | 1,143,149 | 251 / 251 |
| True sun shadow | 167,242 | 98,572 | 24 / 24 |
| Mirror | 182,535 | 129,581 | 50 / 50 |
| Other, frozen comparison | 18 | 18 | 18 / 18 |
| Complete frozen frame | 1,531,139 | 1,371,320 | 343 / 343 |

The optimization covers **74 merged meshes / 288 components / 2,514,843
canonical indices** in this native world. The complete final frame with actual
reflection stepping is **1,372,376 triangles / 351 calls**. All recorded after
frames are below 1.5 M triangles / 400 calls, with zero page or console errors.
The first forward baseline's budget failure is retained separately in the raw
report; it is not counted as an optimized pass.

This is a targeted hotspot optimization proof, not a replacement for the final
integrated all-district budget survey, foot/a regression or full Pipera atlas.
Source ambiguities on Pipera w27750597 / w176791388 and w176792203 remain open.

## Reproduce

```sh
node handoffs/fidelity/pipera-fidelity/cell-frustum/verify.mjs
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node handoffs/fidelity/pipera-fidelity/cell-frustum/native-probe.cjs \
  /tmp/drivecv-runtime-0775 /tmp/cell-frustum-comparison
```

Add `--forward` for the bounded warmed-forward and native roof-query proof.
The baseline must have the unmodified merged-cell construction site; the runner
refuses another source shape. Preserve reports from incomplete/failed runs.
