# US landmark delivery and acceptance evidence

All 24 Seattle/Bellevue registry entries have individual source-linked records, actual model changes or source-verified retained sections, and three game-only views. The records remain `in-progress` because the listed facade, vertical-fit, source-conflict and integrated-world limits remain open. Complete review coverage does not establish complete real-world parity.

Production commits, in order:

- `97a0e5cc486f9e0d3ae6363a4dd5f39e6dd4ae33`: all 24 explicit source scopes, current full OSM contours, source-led model and tourist silhouette changes, georeferenced USGS terrain, viewer poses and collision checks.
- `9239a5cc04963ae1d8172d0b324a9416f35abc3a`: actual Mount Baker east mouths and clear approaches; Lumen canopy clearance, curved lettering and tagged white finish.
- `4a0c5d69aa9f3a0d607a31c59313385c88e182eb`: radial Wheel spokes, glazed cabins and published Lumen lettering lengths.
- `727320456f352da453cb2be15c92dad575012cb1`: actual Murrow arch placement, measured extent and six observed crown openings.
- `e29276d19d24a161e66c72cc9088d2f92b3b0c28`: continuous Olympics terrain across adjacent source exports.

Shared Builder prerequisite: `d90f6dc6611c4fdddb583b563b77b72235573e06`, equivalent to this branch's `a3b69e2`. If the prerequisite is already integrated, cherry-pick the new US commits without duplicating the helper. Root owns shared README/spec consolidation; `PATCH-NOTES.md` supplies the needed changes.

## Model and evidence checks

- `node tools/landmarks/geometry-check.mjs`: all 61 model invariants pass.
- `node tools/landmarks/us-source-check.mjs`: 224 checks pass across 24 US models and 94 distinct explicit source identities. Independent total-height expectations, eight garage courts and solid control, open pitch, three mapped portal endpoints, bridge centreline clearance, contextual exclusions and connected DEM surfaces are covered.
- `node tools/landmarks/evidence-check.mjs --city=seattle`: 24 records, 72 captures and 72 distinct game-image hashes; exact registry identity/coordinates, lossless WebP files, source commits, finite poses and north-up orthographic plans validated.
- All 72 views were rendered from frozen `7273204`; the three Olympics views were updated from frozen `e29276d`. Capture inputs were compared byte-for-byte with `git show` for the registry, source geometry, source roof helper, terrain and viewer. Input hashes are in `proof/capture-inputs-*.json`.
- Front, north-up top and oblique pictures were inspected. They are explicitly isolated model studies; no matched street-eye or aerial comparison metadata is asserted. Independent aerials were privately reviewed; no reference imagery is committed.

## Game checks and limits

- Required `foot,a` on frozen `9239a5c`: **0 high / 0 medium / 2 low**, 666 s shared software-GL wall time. The two low findings concern traffic timing and software rendering. Later production changes are confined to US models/terrain; no Bucharest logic changes follow this run.
- High quality, full traffic and visible mirror, six actual driving samples across SeaTac/Bellevue: max **337 draw calls / 552,270 triangles**, no page errors. This is a six-pose sample using the existing district data, not an integrated rebuilt-data or hardware-FPS signoff.
- The two flagged world poses were compared with `069f9d9`: SeaTac's facade-at-spawn exists in both; Bellevue's sky detector falls from 12%/high at baseline to 9%/medium. No new flagged location appears in this sample. The SeaTac spawn/facade is still a real integration concern, handed to the remaining-US-district owner.
- Tourist high/day/clear: Kerry Park 690,167 unique scene triangles; Pioneer Square 400,258; Bellevue Lincoln 285,075; Meydenbauer 601,848. All four walk 5 m. Maximum sampled draw calls 271. Meydenbauer's rendered spawn/walk reaches 1.01/1.02 M with passes/reflections, below the world 1.5 M limit; its unique scene stays below 1 M.
- Tourist automatic audits report four high `spot-page-error` findings from audit warnings: Kerry `badGeometry=2, zfight=23`; Pioneer `zfight=20`; Lincoln `zfight=35`; Meydenbauer `zfight=28`. They are retained in the raw report and handed to root's tourist-context lane. The Pioneer postcard also shows two floating rectangular blue/black volumes; this has not been signed off as parity.
- The shared explicit-ID-only policy, new native district source data, final mirror/traffic acceptance and night/weather/seasonal comparison remain root integration work. The captures' branch predates the policy; its radius/name compatibility path must not be used for final source-preserving districts.

Raw machine-readable evidence is in `proof/`. Larger private game frames and reports remain under `/workspace/reality-pass/us-landmarks/`. No physical GPU FPS is inferred from SwiftShader timing. No Google/reference imagery is committed or published.
