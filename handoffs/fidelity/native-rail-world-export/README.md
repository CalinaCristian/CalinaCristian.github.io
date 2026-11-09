# Fresh native rail-world export tooling

This isolated tooling collects newly constructed Grozăvești and Romană worlds from one exact combined Git source. It never filters or substitutes an older world export. Root must give GO and a full immutable source SHA before a browser runs. The delivered preparation controls launch no browser and create no runtime archive.

`prepare.mjs --dry-run --source FULLSHA` plans the source manifest only. Actual preparation copies exact Git blobs for runtime src/vendor/assets/index/style/public/package and data, excluding other district datasets and unused overview/research/dev/handoffs. A dry plan at `835e54dd60603cf9962d53704e64151136f11abb` selected 211 files / 70.205 MiB; it is a preparation observation, not the eventual native capture source. All five required grade/body/trench/path/crossing modules must exist before freezing. Existing archive/output paths are refused.

After root GO, use two new paths and the exact supplied SHA:

```sh
node handoffs/fidelity/native-rail-world-export/prepare.mjs \
  --source FULL_COMBINED_SHA --archive /workspace/integration-qa-evidence/rail-world-SHA-source \
  --out /workspace/integration-qa-evidence/rail-world-SHA-native
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules \
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
node /workspace/integration-qa-evidence/rail-world-SHA-native/runner.cjs --go \
  --source FULL_COMBINED_SHA --archive /workspace/integration-qa-evidence/rail-world-SHA-source \
  --out /workspace/integration-qa-evidence/rail-world-SHA-native
```

The runner rechecks all copied Git blob SHA1/SHA256 and tool hashes, verifies every served response, and rechecks the source after both districts. It refuses an existing run report. One muted system Chromium uses normal public High desktop construction, fixed `nowDate` `2026-06-21T09:00:00Z`, clear/summer, and no traffic update steps. The explicit frozen date takes precedence over the requested native noon offset. No source, pose, visibility, population, source-choice, admission or RNG override is used. Weather HTTP is a deterministic clear fixture, not a live-weather gate. The unchanged normal lifecycle owns disposal, profile/hot population additions, player admission and binding.

Observer wrappers preserve receivers, arguments and return values at original spawnAll, before/after source binding and before original attachWorldRender. Later records cover public entry and the first explicit native world draw. They retain complete active/pool IDs and poses, actual pedestrians, named tram variants, actual model geometry/hierarchy/parents/pose, ordered route/history, native support metadata and producer certificate/static diagnostics. Those producer results are labeled diagnostics; they never establish independent physical acceptance.

The fresh export is split per district into gzip JSON artifacts, each with exact raw/compressed byte counts and SHA256 in the report:

- `*-facts`: all real constructor/binding/publication stages and errors. All nonfinite/undefined/unsupported values remain explicit.
- `*-world`: actual unmodified native data, all road/rail edges and native grade samples, ribbons, every collider variant (including props/circles/walls/roof), source/model/estimated metadata, new roof/trench rendered-piece IDs and vertices, support catalog IDs/topProfile, and native lights/controller associations/state/claims. Native support band calls use independent fractions 0, .137, .389, .613, .877, 1 and radii 0/1.2; public support/surface/walk responses are retained too. Coefficients are not used to manufacture these samples.
- `*-scene`: every fresh native scene mesh's complete geometry attribute/index bytes, groups/drawRange, local/world/parent/instance transforms and visibility/draw scope. All native solid/road/marks triangle batches reference these full fresh buffers. Both primary and far tram geometry remain available, with exact native fleet-instance matrix matches where actually rendered. Unrendered model availability is distinct from actual batch membership.
- `*-buffer-integrity`: independent SHA256 for exact native attribute/index bytes. Actual front-view PNGs document both native scenes; visual review is a later run step.

There is no coordinate thinning or expected-model geometry generation. Exact typed buffers use base64 with type/count/byte-order metadata. The independent `decode-geometry.cjs` API is:

```js
const D = require('./decode-geometry.cjs');
const parts = D.meshParts(scene, scene.objects[0]);
// part: { positions:{array,count,itemSize,get(i),stride,offset},
//         indices:TypedArray|null, drawRange, groups, matrixWorld, geometryId, instance? }
for (const part of parts) for (const triangle of D.triangles(part)) { /* triangle.vertices in world XYZ */ }
// Set {respectDrawRange:true} for actual draw-range topology; default retains the full native buffer.
```

This preserves every triangle without expanding millions of repeated coordinates. Actual drawRange/groups/instance counts remain separate from full available geometry. Interleaved positions and nonidentity parents/instances are supported. Normalized/half positions, skinning or active morph deformations require explicit further interpretation and are refused by this decoder rather than silently guessed. Changed native geometry is recaptured even if no version counter changed; immutable old geometry records and fresh poses remain separate. Geometry hashes and raw producer fingerprints are different evidence.

Eleven CPU controls cover bit-exact arrays/nonfinite values, indexed/nonindexed/interleaved geometry, parent/instance transforms, groups/draw ranges, fresh changed buffers, fresh poses with immutable geometry, malformed/unsupported geometry, independent byte hashes and deeply linked native graph references. They do not establish native support or movement acceptance. RO owns the independent emitted-triangle/support/static analysis; Bridge/US own runtime models/body fit. Final all8/mobile15/37/headlights/900 gates remain separate.

The first exact54c native load succeeded without app/console/HTTP errors, but returning `world()` as an ordinary Playwright object exceeded its reference-chain depth through native district graph references. Its original tools/report/log/source manifest are retained under `transport-diagnostic-54c/`; no geometry or binding acceptance is claimed from that incomplete job. The corrected tool encodes native graph references as explicit IDs (full graphs are already exported separately), transfers fresh payloads as JSON strings, and saves constructor/binding/admission facts before heavy geometry. Native `tramMotorCrossings` Set IDs and direct rail/motor light-state queries are recorded, with actual renderer approach state separately labeled; undriven observations are not signal movement challenges. `--reuse-archive` permits a new output directory only after every original source blob/hash and file inventory is reverified; it never changes the prior archive or report.

## Exact54 native extraction and negative findings

Root gave GO for `54c044421640cfe3569bfc3f72159d2169f87581`. The successful collection retry used tool commit `dbb4d568077abb14c52490a825cf8b751dc201ff`, the same reverified 211-file / 70.205 MiB immutable archive and a fresh output directory. All 211 copied and 115 served files match Git blob SHA1/SHA256 before/after, and both native datasets canonically match the exact source. The single browser closed `2026-11-09T07:19:30.537Z`, PID 437391 terminal `Z`. Browser, console, HTTP and observer errors are empty. Collection completed; **physical acceptance is false**.

`proof-54c-r2/` retains the exact executed tools, raw gzip data, source/served ledgers, launch/report, extracted constructor summary, inspected PNGs, assessment and hashes. Raw/compressed hashes and byte counts are independently reverified; no uncompressed native payload is regenerated. Stable originals remain at `/workspace/integration-qa-evidence/rail-world-54c04442-native-r2/`.

| Native district | Constructor actors / trams | Public active / pool / pedestrians | Fresh meshes / geometry records | All colliders | Shared floor pieces / roofs / trench walls |
| --- | --- | --- | --- | ---: | --- |
| Grozăvești | 260 / IDs 256–259 | 166 / 94 / 560 | 624 / 422 | 27,990 | 444 / 0 / 0 |
| Romană | 492 / IDs 490–491 | 313 / 179 / 560 | 727 / 495 | 37,278 | 633 / 84 / 636 |

Grozăvești native binding fails for 258 and 259: both remain on old motor `w277315765`, with no local legal static-clear rail placement found among 77/75 candidates. 256 and 257 bind to `w128304860` and `w660918285`. Native initial admission is false with invalid rail-mode records for 258/259, while its pair/unknown-height lists are empty. This is not an all-clear.

Romană native binding fails for Imperio 490 (16 candidates), which remains on old motor `w1396530918`; V3A 491 binds to `w920117610:1`. Native admission is false, retaining genuine constructor pairs 129/172 (0.945929 m XY penetration) and 154/350 (1.129281 m), with intersecting actual emitted Y intervals and no unknown-height exemption. Actual current constructor IDs/poses differ from the historical6cb run; those historical records are not substituted here. US owns source-binding classification, Pipera owns the bounded planner diagnosis and RO owns independent native geometry/support analysis. Final900/all8/full15 remain on hold.

Both fresh whole scene inventories and all new floors/marks/roofs/trenches are retained. All 1,077 support pieces have direct native band samples, with zero missing band functions or band-query exceptions. These collection counts do not certify their geometry or body clearance. Native crossing Set IDs and direct undriven state queries are retained (Groz 20 motor crossings / 422 rail incidence queries, Rom 0 / 66); no stop/resume challenge was run.

RO independently decoded the actual Groz scene and found one explicit export coverage gap: the executed tool asked for `e.directions`, while runtime declares `e.railDirections`. The54 raw therefore has no recorded native legal-direction array. Raw source tags/node IDs and actual native graph/actor poses remain available, but source-tag reconstruction is separate evidence. This gap is preserved in `assessment.json`, with no replay or relabel. The current tool corrects that field for future runs; `proof-54c-r2/install-observer.cjs` preserves the exact originally executed version. An after-bind wrapper pose snapshot also precedes caller assignment of `initialTramBinding`; its real assigned summary is present at later publication stages.

The two actual front-view PNGs were inspected. They show native cockpit/street scenes, not close bridge/tunnel parity or successful rail motion. Producer pass/assertion fields remain diagnostic only. The internal proof bundle is about81 MB, with every individual file below100 MiB; it has no public runtime/gallery consumer and belongs in root's internal Pages exclusion pass.
