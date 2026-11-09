# ASE landmark fidelity correction

Worktree: `/workspace/fidelity-workers/ase-landmark`, branch `fidelity/ase-landmark`, based on `d43fb9e` plus the orchestrator's exact landmark polygon/courtyard contract (`c8d2482`, locally cherry-picked as `b2f1bce`). Integrate only the ASE commit after that contract; do not duplicate the shared commit.

The old model guessed its dome from an extreme footprint vertex, placed a small colonnade on the roof, used a dark hemisphere, and filled all mapped courtyard collision areas. This correction retains the 29-vertex OSM outer and all four original inner rings, restores the mapped rounded corner, puts a silver profiled dome on that southwest corner, and models giant columns across the two upper facade levels, arched windows, entablature, attic, open lantern, and the verified facade/roof signs. Two OSM covered footway centrelines now have provisional enclosures. The model uses two merged materials and 17,075 triangles.

Inputs and credits are in [`game/research/ase-landmark.json`](../../../game/research/ase-landmark.json): OSM contributors, ASE's own reference photographs, Mihai Petre's 2011 Commons photograph (CC BY-SA 3.0 ro), and the existing Esri/Maxar/Earthstar aerial mosaic. No reference image or Google-derived game attribute is shipped. The source dossier preserves source facts separately from modelling estimates.

OSM `r2274298` supplies no height, storey, roof, material or colour tags. The 22 m wall height is the previous model's convention, not a new measurement. Dome placement is based on the mapped corner arc (fit centre −33.2975, 32.9768 m, radius 7.085 m, radial residual ≤0.186 m). Dome radius/profile, vertical dimensions, bay/rib counts, palettes, roof slopes and bridge width/clearance remain explicit estimates. The complex roof is a conservative hole-preserving pitched approximation; precise historic roof ridges and individual wing heights remain open.

The suppression radius changes 60 → 0 m. Exact OSM names still replace the main source relation; neighbouring campus buildings and Casa Nanu-Muscel are retained. Their generic facades remain context gaps, particularly the low commercial-looking block obscuring part of the left street view. No guessed campus podium was added.

Validation: `verify.cjs` checks all source vertices, 713 independent open-courtyard geometry/collision samples, four solid-wing controls, and the shared polygon transform at nonzero rotation/half scale. It loads the actual high-quality Romană game and checks that one polygon collider with all four courtyards survives world placement, then captures north-up overhead and street views. Zero page errors. The two actual game frames are 383,003 triangles / 182 calls overhead and 395,500 / 103 at street level (high, no traffic/mirror). Module/CJS/JSON syntax and diff whitespace checks pass. Full district traffic/mirror budget and regression acceptance stay with the orchestrator; the two local captures are not a whole-district budget survey.

```sh
NODE_PATH=/opt/codex/cua_node/lib/node_modules node handoffs/fidelity/ase-landmark/verify.cjs /path/to/checkout /tmp/ase-verification
```

Local-only evidence: `/workspace/ase-evidence/accepted/` (final game/model captures + report), `/workspace/ase-evidence/before/` (old model), and `/workspace/ase-evidence/` (reference images, aerial overlay, source API responses and comparisons). That scratch folder includes Google Street View imagery; do not commit or publish it.

Root documentation follow-up: describe the corrected ASE facade/corner dome and retained courtyards in README/spec 12, cite the ASE source dossier, and keep measured heights, detailed roof topology, campus context and bridge dimensions open.
