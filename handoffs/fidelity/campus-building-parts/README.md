# Inferred detail/source solid visibility candidate

Base ROOT `8e4fb0a63cf672d2adf42d6c71d93435b9ff5f2b`. Production change is a new pure helper only; World is owned/integrated separately by ROOT. No browser, source data, physical collider, RNG, camera, landmark or existing building volume changed here.

`clipInferredBuildingDetail(faces, owner, neighbours, {inferred:true})` accepts triangles with all per-vertex attributes, `{i,sourceId}` ownership and neighboring `{i,sourceId,minH,mesh:{faces}}` source volumes. Each neighbor mesh is its COMPLETE authoritative source roof before visibility clipping, including courtyard holes and actual pitched planes. It clips only inferred dressing inside those literal solids. Source solids own equal-height surfaces; source order cannot give an inferred cornice priority over a real roof. Own volume is excluded; invalid/unknown neighbor metadata retains faces and reports an issue. Default/literal faces remain untouched. Exact splits interpolate attributes. Queries use emitted Float32 geometry, with no coordinate offset or changed source footprint/height.

The exact ff6 native fixture confirms four cornice-top/roof pairs between **Corp CK w660503519** and **Corp CF w660503523**, at Y14.5. Actual detail triangles122/123 and162/163 in `detail -4,0` overlap `roofs -1,0` triangles766/753 by about3.07m² each. The selected roof mesh exports its complete7092/7092 indices, with one all-visible selection, and the detail mesh has an unbounded native draw range/no index compaction. Therefore this fixture does not use stale culling tails. Both source buildings retain their complete footprints/heights/roofs. Existing assembly-only suppression misses their common boundary because neither record is a mapped building part.

Four actual native pairs plus11 focused controls pass, including literal/source retention, relative source-order invariance, real height separation, elevated air, courtyards, attribute interpolation, unknown-source retention, own-volume exclusion, immutable inputs and actual pitched-roof air. The tiny remaining exterior detail fragments at the CK/CF corner remain visible; only the overlapping inferred area is removed.

The broader CPU audit at `/workspace/reality-pass/remaining-ro/campus-native-coplanar-ff6.json` is DIAGNOSTIC: meshes with a compacted frustum buffer have stale unused index tails, so raw duplicate counts are not accepted as source duplicates. Future canonical-index capture is being coordinated with QA/ROOT. Main gray façade moiré, Orhideea floating roof strip, dense historic roof joins and SkyTower remain separate active investigations. No camera-motion visual acceptance is claimed.

ROOT integration requirement: supply complete source roof/band candidates to this helper for only the inferred detail primitive ranges. Preserve source roof/collider emission and explicit/literal decorations. Replay native camera motion on the exact combined candidate before claiming the visible flicker fixed.

```sh
node game/dev/harness/building-detail-visibility.test.mjs
```
