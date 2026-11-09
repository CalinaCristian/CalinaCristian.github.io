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

Ten CPU controls cover bit-exact arrays/nonfinite values, indexed/nonindexed/interleaved geometry, parent/instance transforms, groups/draw ranges, fresh changed buffers, fresh poses with immutable geometry, malformed/unsupported geometry and independent byte hashes. They do not establish native support or movement acceptance. RO owns the independent emitted-triangle/support/static analysis; Bridge/US own runtime models/body fit. Final all8/mobile15/37/headlights/900 gates remain separate.
