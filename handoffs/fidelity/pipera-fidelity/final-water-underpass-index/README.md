# Final-water ownership for source tunnel roofs

Base: `720a460a8a1d3dc9ad9f601081196a8d3d22162d`. CPU candidate; no browser or native passage acceptance. No source JSON, profiles, water materials, opacity policy, covered-water cut, subdivision/cap, `underpass-roof.js` or retained-water refusal policy changes.

World's original owner index sampled raw small-water triangles before final rendering subdivided and removed the buried Dâmbovița stretch. Six real native roof queries were refused by those raw triangles even though the complete locally captured final small-water mesh has no intersection with any of the six query polygons. RO's independently committed witness is `0c964062429644fc54f8ccd35425715e3b162fe1`, frozen native source `be12cd87cf988a097c7c54011f0b816694119db7`.

## Runtime change

`final-water-topology.js` factors the existing literal projection, centroid-based covered cut and unchanged `subdivideWater(6,60000)` call. It builds nonmutating4×4 small-water groups in exact cell insertion order. Retained-water topology is cap-sensitive: collapsing a landmark-owned pool before subdivision can change how the60,000 cap is spent on other triangles. An early snapshot is therefore insufficient.

Only true source-tunnel DOWN jobs are queued until immediately after the existing OWN_WATER collapse. UP, embankments and nonsource DOWN remain at their original stage. The original nonwater and raw-big ownership snapshot stays pinned at the original pre-structure point; it is never rebuilt from later ground/building geometry. Later exact final-small water and explicitly identified, fully transformed landmark-water meshes can only add a water refusal. Raw big-water intersections remain HOLD. The original minimum-opening/source maxheight/roof-thickness rules remain in force.

Normal final water consumes the same prepared geometry after exact equality of all original source attributes and indices. An unconsumed group, changed buffer or prepared-path shore failure aborts the build instead of publishing a stale roof certificate. The helper retains the original4×4 grouping, negative-coordinate floor, member order, material/count/cut/cap/shore code. In the source corpus the late prepared input is complete: area/line water emission ends before1918, and the later OWN_WATER collapse is the last position edit. New later cells have empty water.

The generic landmark-water membership is explicit material name `water`, `landmark-fountain-water`, or the shared material's `userData.waterU`; arbitrary transparency is not classified as water. Complete model/parent matrices are applied. This does not claim support for every arbitrary transparent or fluid-effect material. Any intersection in the supplied retained-water index still returns `retained-water-topology-unresolved`; no roof is authorized above it by a height/order guess.

Source tunnel solid/legacy-lid triangles are appended later in their same per-edge queue order. Global solid append indices/order may therefore differ. No global solid-index byte parity is claimed. Roof/collider arrays are consumed only after the flush. Existing lidded/wall/pier logic uses unchanged source/profile metadata. CPU comparison by edge ID preserves all106 prior complete roof models and ground-owner bands exactly; six formerly raw-only refusals alone become known (112 total). This remains a model/source result pending fresh native geometry and driving checks.

## Evidence

- `check.json`:13 focused controls. Actual old/new World execution through OWN_WATER preserves all27 nonempty water builders, cell order, pool ownership, raw big water and transformed generated fountain-water buffers. All nine source-replayed final small groups (51,035 triangles) and the big-water kernel (59,797 triangles) keep exact topology, shore attributes and audits.
- `final-assembly-parity.json`: the literal old/current World super merge, `shoreFoam`, `addSuper`, big-water chunk and batching code is replayed on those exact post-collapse buffers. Other layers are empty, rather than synthesizing their contents. All final water attributes/indices, transforms, material flags, render order, counts and shore audits are deep-identical; all prepared groups are consumed. Final payload SHA256: `671af62873c8bc12dc1c39c49f9fc9862b8adde4bbe967b69c20ad6e2b8e010c`.
- `native-complete-small-water.json.gz`: complete native local object `water -1,0`,246 triangles/738 vertices. Every captured POSITION byte equals source replay. Its capture included whole meshes intersecting Pasaj corridor x[-500,-320],z[-150,850], not all district water groups. Far groups are source replay only. Native big-water canonical capture is not claimed.
- `ro-be12-witnesses.json`: six actual raw-water positives on edges1210–1213/w241368617 and1239–1240/w241368618. Raw intersection areas are49.142,78.644,74.120,26.333,17.586,18.229 m². Exact mitred query polygons are reconstructed from captured native edge/node/width inputs, explicitly not directly serialized query polygons. Five polygon positive/negative controls and native final local intersections0 remain preserved.
- `old-late-water.json.gz` and `candidate-late-water.json.gz`: lossless CPU World snapshots including all models/bands, water buffers, actual pool replacements and transformed named fountain-water. Their source/derived/data hashes are internal. The13 controls compare all106 previously known complete models exactly and preserve retained-water/raw-big refusal negatives. A real60,000-cap fixture proves pre/post collapse topology differs, and verifies both orders against the legacy kernel.
- `raw-water-prefix.json.gz`: exact CPU World area/line prefix snapshot, before pool replacements, pinned separately; no Canvas was needed for that early prefix.

The failed attempt to execute unrelated full World code through shops/signs is retained in `observer-full-world-limitation.json`. Installed Node Canvas rejects `measureText(undefined)` where the browser performs DOMString coercion. This is a CPU adapter limitation, not a production failure or a completed full World replay. The isolated literal final-water path avoids unrelated sign/scene substitutions.

## Reproduction

Use the exact root720 source/data and this candidate in an isolated worktree. The installed `@napi-rs/canvas` supports the actual landmark build for late-prefix snapshots; no WebGL, browser or actor simulation is involved.

```sh
node --no-warnings --max-old-space-size=5000 handoffs/fidelity/pipera-fidelity/final-water-underpass-index/capture-late-water.mjs old game/data/bucharest-unirii.json /tmp/water-old-late.json
node --no-warnings --max-old-space-size=5000 handoffs/fidelity/pipera-fidelity/final-water-underpass-index/capture-late-water.mjs candidate game/data/bucharest-unirii.json /tmp/water-candidate-late.json
node --no-warnings --max-old-space-size=4000 handoffs/fidelity/pipera-fidelity/final-water-underpass-index/check.mjs /tmp/water-old-late.json /tmp/water-candidate-late.json game/data/bucharest-unirii.json /tmp/water-check.json
node --no-warnings --max-old-space-size=4000 handoffs/fidelity/pipera-fidelity/final-water-underpass-index/replay-final-assembly.mjs /tmp/water-old-late.json /tmp/water-candidate-late.json game/data/bucharest-unirii.json /tmp/water-final-parity.json
```

`manifest.json` pins source modules, dataset, producer evidence, decoded snapshots and proof files. Fresh combined native roof/portal/static/body/source checks, normal-input passage, full-size desktop/phone/drone visual review, all reflection/display-pass budgets and affected overview retakes remain required. No constructor/fleet/actor-count or driving acceptance follows from these CPU results. The separate shelter draft6e204029 remains HOLD and is not part of this branch.
