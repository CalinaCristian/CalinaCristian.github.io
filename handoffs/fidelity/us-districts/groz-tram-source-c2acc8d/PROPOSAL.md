# Small generic source-rail adapter proposal — read-only

The existing rendered `data.trams[0]` and `[1]` already follow raw OSM ways 128304860 and 660918285 (maximum vertex-to-source differences .058 m and .054 m). Keep those 24 rendered polylines byte-identical. The defect is assigning moving trams to nearby motor-road paths and synthetic ±1.45 m offsets. Giving a reverse tram a motor-road exception would preserve that defect.

## Source fields

In `tools/osm/build-data.mjs`, keep source identity while collecting/clipping tram ways instead of reducing them to bare point lists. Add a parallel `tramSources` entry for each existing `trams` run:

```js
{ sourceId: 'w128304860', sourceNodeIds: [/* one per existing rendered vertex */],
  tags: { railway: 'tram', oneway: 'yes', gauge: '1435',
          operator: 'STB', electrified: 'contact_line', voltage: '750', frequency: '0' } }
```

Preserve all explicit direction/access/status/bridge/tunnel/layer/incline/elevation tags rather than selecting only the example keys. Include complete selected source-way node/point sequences in `tramSourceWays` and relevant ordered route members/tags in `tramRoutes`; clipped render runs are insufficient to prove endpoint connectivity or route direction outside the clipped run. A record can refer to an existing complete source-way record rather than duplicating points. Selected source identities, clipping membership, original source node IDs and unresolved datum fields must survive rebuilding. For this case route relations 1274386/ref1 and 2212351/ref10 provide opposite directed sequences. Relations 1270050/2205113/ref11 carry a temporary-suspension note and must keep that note.

## Adapter and owning files

1. A new pure `game/src/tram-source-network.js` can build the directed rail graph and source-leg sampler. Nodes join only through identical source node IDs; geometry crossings and nearby motor roads create no graph connection. `oneway=yes/-1/no` and explicit tram/access restrictions govern rail travel. Unknown direction remains unknown; motor-road lanes/oneway are not substituted. Edge positions use source track centres without `tramOffset` or lane-width inference. Full mapped connected legs supply long-body front/rear sampling and station packing, retaining each source vertex and way boundary.
2. `world.js` exposes this separate rail graph alongside the unchanged motor graph. Existing rendering remains untouched. Source height/grade metadata must stay separate from XY connectivity. These two local track ways have no bridge/tunnel/layer/ele/incline tags; current flat local ground is an explicit unsurveyed model datum. Their actual northern bridge continuation has bridge/layer1 tags, which do not specify a height in metres. Reuse a justified shared bridge profile only where the source connection supports it; otherwise return an unresolved grade constraint.
3. `traffic.js` (RO owner) dispatches tram spawning, direction tests, continuation, station span and native pose sampling to the rail adapter. Trams use actual rail legs, not a fabricated lane on a motor edge. All ordinary traffic still uses `world.graph`. Existing body sensing, shared physical interaction, reservation ordering, IDs/fleet/RNG and visibility rules remain in force. A dedicated rail path does not justify bypassing motor/pedestrian collision guards or adding a road join. At-grade rail/motor interactions need the existing physical crossing/claim controller with explicit association, not a routing connection. Pure path APIs could be `canTravelRail(leg)`, `railContinuation(leg, route)`, `railSpan(leg, length)`, `sampleRailPath(legs, station)`.
4. `initial-traffic-admission.js` uses the same source-rail candidate projection/validation for trams; its ordinary-car source-road validation remains unchanged. `initial-vehicle-admission.js` and the packing planner keep their generic actual-body overlap contract. Re-run planning on corrected physical tram poses; do not discard actors, waive reverse motor access, or accept the old off-track candidates. Current native IDs 257–262 and model kinds can be retained while their path ownership becomes the actual directed rail source. Any deterministic station reassignment still needs full-scene physical/static validation and a truthful unresolved list.

Root owns source builder/world integration and spec/API decisions; RO owns `traffic.js`; Pipera owns packing. This proposal assigns no production edits to the US audit lane. It requires no renderer optimization or actor-count cut.

## Focused controls before native publication

- Raw route1/10 shared-endpoint chains and `oneway=yes` directions pass; reversing either rail fails. Both motor roads remain one-way with their original IDs, node topology and lane/width records.
- Projected tram centres follow the mapped track to quantization tolerance; complete body samples use connected rail legs at short source segments and curves. Changing a road median/width does not move a tram track.
- Motor source-edge, true static/post/deck and pedestrian/vehicle overlap controls still reject. Source rail lines, native fleet/IDs and RNG state remain intact.
- Unknown bridge/height cases are explicit failures or bounded unresolved constraints; no layer-to-metres conversion. Full constructor/first-publication audit and actual tram/motor crossing motion remain separate native gates after implementation.
