# Geometry caches on the integrated scene freeze

All nineteen unique scene builds were evaluated from committed root input `09766dc7a870657b76e3114c15a12f55e5c373cb`. The exact native reports are retained in `source-bake.json`. Ballard Locks, Old Town and Herăstrău had stale caches; their derived caches were rebuilt. The other sixteen caches retain their original bytes.

Independent packaging compares every non-cache field in all nineteen source files against the committed input: all 6,681 raw source building records and all other source/terrain/metadata fields are unchanged. It also verifies 302 remaining runtime files byte-for-byte against that input. These checks are recorded in `source-unchanged.json`.

Derived runtime commit `93b0d8649e7c3a1217ae5b009f124347c41da6a8` is a direct child of the root freeze and changes only those three geometry-cache files. It is retained by the scoped evidence tag in `derived-commit.json`; no extra task branch is introduced. The immutable runtime directory contains the same application files and derived cache bytes as that commit. This commit can be integrated independently of the proof tooling.

This is geometry-cache/source-preservation evidence, not visual or performance acceptance. The low-quality bake does not count its zero pre-render draw-call field as a budget result. A separate high-quality all-24 runtime sweep on the derived committed source verifies warm cache hits, actual public-path attempts, native phone condition selections and rendered views. Failed or unverified approaches remain explicit failures; no READY flags are promoted by cache generation.

The superseded partial `2b5e92d` bake is retained externally with its actual revision and six completed scenes; it is not counted as the final nineteen-scene evaluation.
