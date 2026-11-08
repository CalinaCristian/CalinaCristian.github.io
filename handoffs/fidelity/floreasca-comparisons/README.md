# Floreasca game capture handoff

The final game-only atlas is at `/workspace/reality-pass/floreasca-comparisons/`. The overview comparison owner receives
`manifest.json`, `images/`, `thumbs/` and `boundary-source.json` for `game/overview/comparison-data/floreasca/`. The viewer
requests its attributed Esri reference live; no aerial or Street View reference image is included in this handoff or git.

- Published game source: **`df9b2e2ced83b8b30bcc8e34cf809a434b25bc27`**, archived separately from all working trees.
- **90 frames**: 20 touching the exact runtime playable mask, 64 additional tiles touching the exact 600 m source ring,
  and 6 optional distant context frames. The 84 playable/ring frames retain every partial boundary cell. Four distant
  frames show grid corners; Sky Tower and Globalworth use their actual source anchors for useful centered roof views.
- Every frame: north up, pitch −90°, 250 m ground span, h 216.506350946 m, fov 60°, 640×640, high quality, summer,
  clear daytime. Moving traffic is hidden; static parked cars remain visible. Mirror rendering is excluded.
- All 90 frames and thumbnails exist, have their expected dimensions and SHA256, and pass pixel-variation checks.
  All **317 archived source files** retain their hashes. The full run and two centered skyline retakes have **zero page,
  console or failed-request errors**. Full run: 258.418 s; two context retakes: 18.315 s.
- All 90 frames were inspected on **8 contact sheets**, with six full-size targets for the chapter spawn/Dinamo,
  Rosetti/parking, lake, market and composer streets. The final skyline retakes were also inspected.
- Separate aerial maxima: **820,036 triangles / 121 calls**. These world-only camera observations are not driving or
  traffic performance acceptance; the mirror and moving fleet were excluded.

`summary.json` preserves the final manifest and boundary hashes, source identities, capture report and exact review
wording. The artifact directory also contains `validation.json`, `manifest.sha256`, `source-provenance.json`,
`capture-report.json`, `world-stats.json`, `grid-plan.json`, `poses.json` and all contact sheets. Unused first-attempt
context frames are outside `images/` and are absent from the manifest.

Capture coverage is not a fidelity score. Boundary-touching squares include land beyond the detailed ring, and the
published source retains sparse peripheral ground, simplified distant masses and modeled roofs/canopy/facades. The
camera is perspective: 250 m describes the ground plane, while elevated rooftops project larger. Live reference imagery
has its own acquisition-date, season and registration limits. Later working game fixes are excluded from this source
snapshot. The manifest records these limits without marking the reality pass complete.

The generic tools and usage are documented in `tools/aerial/README.md`. This branch changes capture tooling, navigation
source records and documentation only; it changes no game/world/data files and performs no deployment.
