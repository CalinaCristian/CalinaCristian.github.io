# Source-backed finite driving domain and shared closures

Candidate base60729377 plus reviewed source-return/data9c9a0b04/44dee82d and the root's exact crew hook78aae20d
(local aliasd73badae). World/source data, renderer, traffic and caller acceptance remain separately scoped below.

The runtime domain is the existing finite district mask unioned with the complete cockpit circumradius around actual
already-kept core source road/pad surfaces. It includes bridges the builder retains beyond its original analytic core.
Passive scenery and virtual OUT create no extension, source join or travel right. The same decoded mask supplies World
and player bounds, `district.inside/mask`, the minimap containment query and the emitted invisible-wall outline.

Physical closures and visible boards consume immutable normalized `l0/l1/half` frames. Actual source-floor triangles
split only synthetic sections that obstruct another compatible-level retained road. Coplanar overlaps are emitted once;
local nearparallel same-level street bundles have one primary for cones, extra props and crew. The physical main barrier
uses its emitted1.36m/1.51m RO/US height rather than an invented2m wall hanging below its deck. The existing collision
kernel and its tolerances are unchanged.

Source-policy districts already retain the real source streets beyond their boundaries: they no longer get additional
straight invented asphalt/kerb tails and trenches. Their actual scenery remains. Generated barrier/sign mesh fragments
clip against the same actual-level support; discrete prop geometry and its collider pass one shared source admission.
Props carry their real emitted vertical range. Mapped source barriers, fences, roads, buildings, dimensions, coordinates,
directions and actor populations are untouched. Main's root-owned `worker!==false` filter consumes the shared crew flag.

The caller APIs are `boundarySupport.clipPolygon(polyXYZAndAttributes,{ownerEdges,y0,y1})`, `clearCircle(...)`,
`clearMeshRange(...)` and `applyMesh(...)`. Mesh clipping touches only a saved appended index range, preserving previous
source vertices and indices. Physical/visual end frames are finalized before either emission; decoration never widens
them afterward. Runtime diagnostics are `world.stats.districtBoundary`, `world.district.mask` and `world.boundarySupport`.

## Exact native-data CPU regression

`native-8e4-fixture.json.gz` retains all1714 actual native road/pad support polygons/heights and1736 native read-only
source/lane/body scan poses from QA8e4. It pins the original full native export and scan hashes, source mask and actual
3.42m front/2.36m rear/1.8m width nine-disc body. This is **CPU replay of actual native data**, not a fresh app or driven pass.

The current native `collideBuildings` function reproduces all6 old wall27535 positive rows and their push vectors within
1e−9. The proposed shared domain then has0mask-wall hits for all1736 poses.183 unrelated original wall segments remain
exactly identical,196old segments become300finite segments,144mask cells are added and no original inside cell is lost.
The original x640,z[-900,-840],y[-40,80] wall is synthetic; its first positive is actual sourcew668700431/edge1118,
station1119.807663m, lane1, centre(638.2198575,-866.8309326), surface11.24m. No source support or graph object is mutated.

Run:

```sh
node --test game/dev/harness/district-boundary.test.mjs game/dev/harness/district-boundary-native.test.mjs
```

20focused/native-data CPU cases pass, including actual-level controls, clipped attributes, immutable frames, retained
source mesh prefixes, same-level bundle deduplication, no hanging bridge wall, unrelated boundaries and no RNG use.
The actual helper build on the retained native support is about42ms in this environment; no hardware FPS claim follows.

## Fresh native gate

`prepare.mjs REPO FULLSHA NEW_SOURCE NEW_PREPARATION` creates a minimal exact Git runtime archive plus native harness
modules, with per-file SHA256/Gitblob ledger. `native.cjs SOURCE NEW_OUTPUT FULLSHA MANIFEST REPO` uses one muted system
Chromium, native High/1280×720/PR1/full mirror and normal rush/clear/summer public Groz entry. It preserves constructor
objects/IDs and full native populations, reports pre-draw counters and every actual draw delta (including warm/reflection
work/setup carry), runs a read-only body/source scan, then a bounded actual public-start drive. The harness stops before
any recovery reset or pedestrian push policy; such an attempt is a failure, not a watchdog waiver or a successful trip.

No camera, FOV, far, source, actor, mesh, shader, index, population or clock/date replacement is used. Complete warm frame
work and all actual failures remain. The scan locates the start by literal source node4544537057, never an old generated
node index. Native and driven results will be published separately after executing the exact committed candidate.
