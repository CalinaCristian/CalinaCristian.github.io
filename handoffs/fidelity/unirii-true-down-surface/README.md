# True underpass roof closure candidate

This is a bounded structural candidate from root `208fdc5ef184bf38de4a0321004b7cfe838ed1cb`. It changes the DOWN structure branch and adds a depth-only physical roof top; the UP/shared bridge branch, source road profiles/widths/directions, data, fleet, actor arrays and RNG are unchanged. It is not a fresh native visual, whole-body path, all-district or frame-budget pass.

The separate original Coposu proof is on branch `fidelity/unirii-underpass-native-proof`, commit `0d634c996101c3ac87205aea4e99886d2b9c957e`. Its 197.7MB native packet is deliberately not copied here. That corrected a fuel-canopy driveway datum; it does not validate true underground roads.

The historical actual canonical Pasaj geometry has 15 stations where the emitted ceiling is above the street lid. These are retained as complete triangle witnesses, not inferred from flags. Four additional exact endpoint samples have real road triangles but miss the old roof; they sit at the portal boundary, and the old portal's perpendicular section differs from the roof's mitred section. They are not described as an established interior tunnel hole. `portal-boundary-classification.json` retains their actual source triangles/layers.

The candidate keeps the existing covered interval and estimated maximum opening, while bounding the underside below a positive estimated .25m slab. A literal physical opening wins over the generic estimate; legal maxheight is separate. An incompatible literal height remains unresolved. Ceiling and endpoint closure use the same native mitred section. Every slab has closed sides/endpoints within its actual thickness, including buried top-height steps; no street-height beam is added across the opening. Uncovered ramps keep their old geometry.

The roof top is derived from actual retained overhead Float32 surface bands. It writes depth with color writes disabled after opaque land colors and before actors. Existing source grass, paving, roads, source polygons and global materials are neither recolored nor removed. Uncovered parts of a roof footprint use the unchanged emitted groundPlane datum (`-.3m`) as an explicit estimated fallback, not a surveyed earth height. Only nearby covered-source corridors are indexed; districts with no such spans do no triangle indexing.

Three draws opaque objects before transparent objects regardless of cross-list `renderOrder`. Therefore any intersecting raw water skin is **unresolved** until the final retained water topology is known. It receives no new roof/mask/collider; the old negative geometry is retained, not restamped as fixed. Current native private water-big topology is a named capture gap. The historical source-skin fixture does not establish that the complete live pre-roof water builders are clear. Actual grass/pave/road/water pixel checks remain required.

18 CPU controls pass. The literal current production DOWN branch replay consumes 7,458 actual canonical overhead triangles and all 112 historical Pasaj edges, corrects the 15 inverted-roof witnesses, preserves source profiles/tags, and has a minimum modeled opening of4.41m against the unchanged literal3.5m limit. Ceiling joins are continuous; 45 actual overhead top steps remain and each slab is individually closed. The four negative production controls retain exact Float32 solid/ground geometry: ordinary sunken road, open tunnel ramp, reviewed canopy, unresolved water. Original solid/lid geometry680/224tri becomes1608solid+232depth-onlytri in this scoped replay, a936tri structural increase. Actual submitted main/mirror/shadow budgets are still open.

The roof collider uses the same actual Float32 slab triangles, rather than a full-height box. It preserves space below and above the slab. Actual oversize actors must obey literal source limits; the existing5.695m trolley model is not authorized beneath a3.5m source limit or fitted by lifting the roof. Shared legal routing/admission is owned by QA; this candidate makes no Traffic/Nav edits.

Run the retained controls from this worktree:

```sh
node game/dev/underpass-roof.test.mjs
node handoffs/fidelity/unirii-true-down-surface/tools/replay-native-down.mjs /tmp/native-down.json
```

`native-overhead-fixture.json.gz` preserves actual decoded triangles and native object/triangle IDs. Its extractor excludes the old generated gray lids by their explicit feature/height only for historical replay; production indexes the native builders before roofs are emitted, so no such retrospective filter exists at runtime. The full immutable canonical input and raw source hashes are held in the separate proof branch. `baseline-down-block.js.txt` is the literal old DOWN branch, with its World source SHA pinned in `baseline-source.json`.

Fresh native full-size above/under/portal/side/mirror views, actual passage contacts and oversize admission, transparent-water ownership, legal source spans, source-field retention and high/full native budgets remain required. A normal public map transition may enter the source through-chain for a separately labelled partial approach/passage; the district clips the northern ramp while it is already2.6m below datum, so this cannot be called a complete surface-to-surface approach or repaired by inventing a graph join.
