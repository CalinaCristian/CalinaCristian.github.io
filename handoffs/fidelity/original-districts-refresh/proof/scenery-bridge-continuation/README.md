# Exact source bridge continuation repair

Baseline: `4378317f3fcdccc886d6c7c1ed092ee15d95db8a`. Source data, source XY/nodes, widths/access, core graph and final core grades are unchanged.

The passive scenery planner now follows the same source way through a degree-three merge. A bridge mouth may also continue into two exact-node-connected, equally named, same-class, ground-layer approach arms when both are within 30° of the reverse bridge bearing and each other. Real transverse streets, different approach names/classes, elevated arms and fixed core constraints retain their original caps. Every newly accepted continuation records its source node, source ways and evidence.

All eight CPU reconstructions match the actual native baseline core hashes and complete baseline bridge statistics. Five districts (Floreasca, Romană, Grozăvești, Unirii, Otopeni) have byte-identical bridge profile geometry. Pipera changes three source ways; its one prior target has 5.24 m paired clearance. Bellevue changes 23 source ways; all 13 prior targets have at least 5.2 m paired clearance. The two actual 2 m-body obstructions identified by QA become clear in the production `collideBuildings` function. SeaTac changes two source ways but retains all 15 unresolved targets and nine CPU body contacts. None is accepted by this proof.

`pure-check.json` contains 1165 passing pure controls, including actual production collision and local sloped underside controls, same-way merge/fork positive cases, and negative real cross-street/fixed-core cases. Each district JSON retains the original targets, changed candidate profiles and before/after production body queries. The body probes invoke the immutable production collision function CPU-side on exact profile quads; they are not native browser controller travel or rendered evidence. Native after-integration collision/render follow-up remains required.

Reproduce with the immutable source snapshot and the actual native baseline records from `proof/scenery-bridges/native-bf32` (see that proof's provenance):

```sh
node tools/osm/scenery-bridges-check.mjs
node handoffs/fidelity/original-districts-refresh/scenery-bridge-impact.mjs --root=/path/to/immutable-4378317 --candidate=$PWD/game/src/scenery-bridges.js --native=/path/to/native-bf32 --out=/tmp/bridge-continuation-impact
```

All imagery captured on 4378317 remains before evidence wherever the profiles change. New atlas/context recaptures must preserve their actual source SHA. Unchanged profiles support scoped reuse, not blanket scene acceptance.
