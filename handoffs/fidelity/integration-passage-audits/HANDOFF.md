# Passage collision audit

The shared controller audit previously treated the complete source building outline as solid after the native player had correctly driven through a mapped opening. The QA helpers now query active passage polygons and courtyard boundaries at the body's actual height, retaining source undersides, ceilings, roof surfaces and pier bands. Player clipping, blocker-ahead, elevated ribbon samples, doors and spawn checks pass their own height. No runtime building geometry or detector tolerance changed in this correction.

The immutable US source dataset is `1b73d42`. Before and after reports are retained losslessly in `proof/`. All **five actual Player-controller traversals** complete through the exact source ways: SeaTac `w1185430933`, Bellevue `w513188426`, `w816498788`, `w816498790` and `w816498786`. The updated shared harness reports **0 high / 0 medium / 2 low**, with zero JavaScript exceptions. The original outer-outline clipping findings remain in the before report.

Each actual source crossing also checks its source building's opening, surviving post, ceiling, point below its roof and point above its roof: **25 native source assertions pass** across five control groups. These use actual colliders for source buildings `w647567422`, `w33115668` and `w33115737`; they do not whitelist those buildings. Four independent pure cases cover the same physical distinctions, courtyard boundaries and above-ground openings. The above-ground source records in Pipera's separate `efaddeb` fixture have unknown absolute bases and must not create a claimed ground opening; its source guard remains separate from this audit correction.

```sh
node --test game/dev/harness/integration-passage-audits.test.mjs
node game/dev/harness/integration-passage-check.cjs SNAPSHOT_ROOT /tmp/passage-audits 1b73d42
node handoffs/fidelity/integration-passage-audits/verify.cjs
```

The replay helper uses DOMContentLoaded and bounded readiness, one muted Chromium browser and SwiftShader. Native controller screenshots are reviewed together in `proof/source-controller-montage.jpg`. Its complete high-quality mirror frames peak at **300 calls / 815,919 triangles at 960×540**. That is a focused source-opening result, not the final evolved Arnia budget or a physical hardware FPS claim. Root owns final README/spec consolidation and deployment.
