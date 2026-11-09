# Rigid emitted tram support

The rail-only native placement branch retains the literal rail centre X/Z and the existing drawn heading. It derives pitch and chord height from the foremost/rearmost lowest wheel-support vertices in the actual emitted mesh, then finds the minimum nonnegative vertical anchor required to clear its own shared source slab. No model, source vertex, profile, road height, population or RNG is changed.

The fit transforms **every emitted triangle** and clips it against the actual rendered slab top triangles. It also solves exact quadratic extrema on every clipped edge against the shared continuous C1 band, including interior crests between mesh vertices. Endpoint clamps are split explicitly. Unsupported nonquadratic profiles remain unknown. The fit adds no clearance epsilon. These are rigid proxies; the resulting suspension gaps and vertical offsets do not claim articulated real tram behavior or surveyed datums.

`controls.json` contains 9 controls, including a crest hidden under a triangle interior and actual 27/36 m flat/linear tracks preserving their native pose. `static-controls.json` contains 10 controls. Initial static admission revalidates the actual emitted geometry, fresh pose, support profile fingerprint and exact shared piece IDs. A producer-supplied pass flag or forged fresh pose digest cannot hide a real own-slab penetration. True pantograph ceiling, post, other-model slab, stale pose/catalogue, unsupported span and unidentified-piece failures remain blocked. The old conservative static path is unchanged for other colliders and ordinary vehicles. Native previews carry their fresh rail certificate instead of the live actor's older station certificate.

Geometry/certificate digests use deterministic FNV-1a for cache identity, not a security claim; file provenance uses SHA-256 in the manifest. Identical stationary fit and revalidation reuse bounded WeakMap entries tied to the immutable source world, geometry/version and current pose/certificate. Moving actors recompute exact geometry. Weak keys retain no retired world or actor.

`groz-full-source-sweep.json.gz` contains **2,878 requested poses** over all 211 modeled source segments, every original vertex and intervals <=5 m, for both actual meshes. **2,822 complete source-body-span poses pass**, with zero source centre X/Z error and no emitted-vertex slab penetration. **56 literal coverage-end poses remain unknown/excluded**, never physical passes. The analytical triangle-interior controls complement the independent post-fit emitted-vertex queries. Whole native static/publication/solid/ceiling acceptance is still required from the fresh combined export.

Maximum rigid vertical offset is **0.928028277 m** at Imperio w660918283 segment 0, t=1/6. The former w314447163 segment 0/t=.15 own-slab contact now clears with the bogie chord: V3A offset .262337134 m, Imperio .399396473 m. Its old conservative static failures and the superseded constructor-only-span sweep are retained under `historical/`; the latter excluded valid moving junction poses and must not replace the final 2,822/56 count.

The actual moving 36 m curve placement kernel over 120 placements measured median **8.264 ms**, p95 **16.882 ms**, max **20.325 ms** in this CPU environment. Over 240 identical stationary placements, the exact cached certificate remains the same object and measured median .01073 ms/p95 .01337 ms. These timings exclude full scene/render/static queries and do not establish hardware FPS. Full-scene native budget remains a separate gate.

The unchanged 13 rail controls, native motion/claim/mode fixtures, six Groz bindings/all 263 identities and original 13 native adapter controls also pass. `legacy-adapter13.json` pins its original d981 native Traffic/model implementation while exercising the changed current adapter. No browser was opened by this lane. No native whole-scene pass is asserted here.

API: `fitTramBodySupport(v,{samplePath,supportAt,nativePitch})` returns known/y/pitch and a derived `railSupport` record. `validateTramSupportCertificate(v,supportAt)` independently rechecks its mesh/pose/catalogue and exact triangle clearance. The shared `world.tramDeckSupportAt.inBox(x0,z0,x1,z1,{modelId})` returns indexed exact pieces with stable `.id`; native own slab colliders expose the identical `.supportPieceId`. Other model IDs are never selected for support. Initial admission accepts a support exception only after the actual geometry recheck and matching exact piece identity (or disjoint actual mesh bounds).

Reproduce:

```sh
node handoffs/fidelity/us-districts/groz-tram-path/body-support/test.mjs
node handoffs/fidelity/us-districts/groz-tram-path/body-support/test-static.mjs
node handoffs/fidelity/us-districts/groz-tram-path/body-support/sweep.mjs /path/to/native-support.json /path/to/rail-bridge-runtime /tmp/new-sweep.json
```
