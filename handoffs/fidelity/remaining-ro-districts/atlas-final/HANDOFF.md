# Corrected Unirii and Otopeni game atlases

Capture source: immutable `0775fdaf15442a46c3fe98f4e6875c9c09046a99`. The served archive's Unirii dataset SHA-256 is `9797d9f5b1a4f2593528ce6c8c4ad04ec38fb953c9770bf32f6d7d5c7c54f26c`; Otopeni is `5e1242d5583db482717545ca0ba99e12b45611c25dcda0c04d1ffe45e084a711`. Both were independently compared byte for byte with the recorded git objects. This archive includes the corrected bounded non-crown inputs and water render changes. Capture source and release source remain distinct.

Unirii is complete: all 98 planned frames, 26 touching the playable mask, 66 additional squares touching its exact 600 m ring, and six optional distant views. Capture completed at `2026-11-08T22:24:28.197Z`. Validation checked all 98 original 640 px game JPEGs, thumbnails, camera poses and 2,816 served source-file hashes, with no missing or duplicate IDs and zero page/console/request failures. All 98 private Esri pairs were inspected on 17 contact sheets. Two independent official supplemental exports cover the Parliament/Cathedral context squares; acquisition dates remain unknown. The per-frame review ledger is `handoffs/fidelity/d-unirii/atlas-paired-review-0775fda.json`.

Otopeni's fresh 107 frames are still capturing in this first delivery. Its completed `4198996` and `4378317` historical collections are retained alongside Unirii's. The former has complete paired review ledgers; the latter is labelled capture-verified only. Neither is relabelled as corrected source evidence. Original source revisions, capture times, image bytes and validated capture manifests are retained.

`publish.py` selects only validated game images, thumbnails, game-only contact sheets and an explicit metadata allowlist. It checks the exact ordered planned ID set, scope counts, original image and thumbnail hashes, dimensions, source identity and error lists. Private aerials, paired contact sheets and Street View images are never selected. For each district, publish the two histories first, then the corrected current collection:

```sh
python handoffs/fidelity/remaining-ro-districts/atlas-final/publish.py --evidence-root=/workspace/reality-pass/remaining-ro --district=unirii --revision=4198996 --historical
python handoffs/fidelity/remaining-ro-districts/atlas-final/publish.py --evidence-root=/workspace/reality-pass/remaining-ro --district=unirii --revision=4378317 --historical
python handoffs/fidelity/remaining-ro-districts/atlas-final/publish.py --evidence-root=/workspace/reality-pass/remaining-ro --district=unirii
```

Repeat with `--district=otopeni` after its final validation and actual paired review. The current manifests expose `historicalCollections` using the root viewer's `historical/<revision>/manifest.json` contract. Root owns catalog/global documentation integration and final browser checks. Perspective street, night and drone context must use the separate typed `perspectiveCollections` contract and must not inherit north-up aerial comparison labels.

Review coverage does not claim architectural parity. Estimated heights, complex/native roof approximations, facade ornament and canopy shape remain visible limits. The Unirea roof remains simplified. Unirii retains five contradictory literal height/minimum profiles and four dependent complete-source fallback roofs. Its capture places 15,723 of 15,758 source tree entries; all 35 physical guard exclusions remain explicit in the source-centre proof. Optional distant context, Cathedral construction-date differences, actual street/foot/drone movement, bridge clearance and evolving traffic/mirror budgets remain separately scoped.

No runtime or district data changes are part of this delivery. The parent may retain these captures after a later source change only with a dependency/geometry invariant proof; a newer release does not change the original per-frame source revision.
