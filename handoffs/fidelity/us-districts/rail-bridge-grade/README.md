# Source rail bridge grade research

Research-only branch `fidelity/rail-bridge-grade`, based on `f320b747436ad98d6ac6624ce587d5666178e4df`. No production changes, browser or native acceptance run in this lane. Root owns integration; US owns `tram-path.js`/Traffic; QA owns the one native support export.

## Source findings

`source-audit.json` re-reads every cached raw OSM tile and records their SHA256s, the exact metadata dataset hash, complete selected source way/node identities/tags/XY, source-connected endpoints, geometric highway crossings, and sampled bridge-polygon containment. It contains no reference imagery.

| Source track | Complete length | Source bridge tags | Relevant source structure |
|---|---:|---|---|
| `w128304859` | 38.793 m | `bridge=yes`, `layer=1` | `w902056192`, Podul Grozăvești |
| `w660918286` | 38.841 m | `bridge=yes`, `layer=1` | `w902056192`, Podul Grozăvești |
| `w118416425` | 1182.382 m | `bridge=yes`, `layer=2`, `level=1` | Basarab road/tram structure confirmed by engineering project descriptions; no bridge outline in raw cache |
| `w205971103` | 1190.843 m | `bridge=yes`, `layer=2`, `level=1` | Same Basarab limitation |

These four ways account for US's 54 unresolved modeled source segments (1+1+26+26). The complete source ways above are longer than arbitrary district clips; preserving them does not admit unseen track as a runtime route.

The raw cache has no `type=bridge`/`man_made=bridge` relation. `w902056192` is an actual closed source bridge outline with `man_made=bridge`, `bridge:structure=arch`, `layer=1`, `name=Podul Grozăvești`. Motor bridge sources `w128304847` and `w128304855` (dataset roads20/24) cross this outline. It is the lower river crossing; the nearby Basarab viaduct is a different upper structure.

At no more than0.5m longitudinal spacing, testing the source rail centre and±1.2m lateral support gives223/237 contained samples for `w128304859` and224/237 for `w660918286`. The outside samples are at the mapped outline's ends. This is a source outline/extent mismatch, not permission to expand the outline. Exact full physical support still needs native deck coverage. Sparse sampling can disprove containment; passing it would not alone prove continuous full-body containment.

Neither the selected rail ways nor their selected tagged source nodes supplies an absolute elevation or incline. None of their geometric highway crossings supplies a numeric `maxheight`. The audit's full selected-track bounding rectangle also contains no `maxheight` way vertex. A geometric crossing is an ordering check, not a rail/motor graph join.

## Source-connected approaches

Basarab's bridge endpoints join untagged tram approaches. They cannot automatically retain zero height when the bridge grade is resolved:

| Bridge | Endpoint node | Connected untagged source |
|---|---:|---|
| `w118416425` south |4544537085|`w314447163` (95.420m)|
| `w118416425` north |296078599|`w118583391` (200.311m)|
| `w205971103` north |6187888833|`w660931074` (310.829m)|
| `w205971103` south |2159751758|`w660918284` (96.753m)|

The lower Grozăvești bridge joins `w128304860`/`w132127990` and `w660918285`/`w660918280`. All connectivity above uses equal original source node IDs. It supplies no absolute vertical datum.

## Engineering evidence and limits

`engineering-sources.json` records verified direct-response hashes/URLs and the accepted facts. [Webuild's project description](https://www.webuildgroup.ro/en/projects-romania/basarab-overpass/) confirms a common structure carrying two vehicle roadways and two tram lines, with a790m intermediate viaduct. [MIDAS's engineering application](https://www.midasbridge.com/en/project-application/the-basarab-overpass-0), crediting C&T Engineering, independently describes a791m road/tramway viaduct. Their public overall/span dimensions differ and must not be forced onto OSM chainage. Neither gives a usable local rail-base elevation, longitudinal slope or clearance. Direct designer CFCSL pages returned503; search snippets are not accepted dimensional authority.

The existing world's road profiles are modeled geometry, not survey data: `world.js` starts from an estimated6m crossing clearance and includes older5.5m-per-layer deck targets; `scenery-bridges.js` explicitly uses modeled5.2m clearance,0.4m slab,8% approaches and2.8% decks with exact source connectivity. Reusing a physically shared profile can be a consistent model estimate. It cannot establish the real bridge's measured height. Public10m bridge-height summaries and80/84m pylon heights are not local track-base datums.

[PMB's official archived project page](https://www2.pmb.ro/primarul/prioritati_proiecte/pasajul_basarab/pasajul_basarab.php) links the [ASTALDI/FCC proposed solution,26September2006](https://doc.pmb.ro/primarul/prioritati_proiecte/pasajul_basarab/docs/pasaj.pdf). The PDF was read directly and pages3/7/9 inspected as temporary rasterizations outside the repository. Page7 differentiates the upper Basarab river roadbridge from the separate lower road/tram crossing; page8 describes central tramstation and side vehiclecarriageways, and page9 Scheme6 shows their common structural cross-section. This strengthens the structure association, but its150m mainspan/100m riverarch proposal differs from completed project descriptions. Do not apply historic proposed diagram dimensions as finalbuilt elevations. The linked2009site/expropriation plan and scanned2005/2006approvals supply no verified raildeck verticaldatum in this review. Only source URLs/hashes and findings are committed; no PDF or reference raster is published.

## Smallest shared runtime hook

1. Resolve a source rail segment's displacement once, after final native deck/approach profiles exist. A reviewed bridge structure association restricts candidates. Reuse exactly containing native support when available. Where a separately mapped bridge track needs its own deck, `railway=tram` plus `bridge=yes` is already evidence of a real bridge: model a slab along that exact centreline with explicitly estimated width/thickness, retaining the distinction between source geometry and estimated rendering dimensions. This does not require inventing a bridge outline. Establish homologous structural cross-sections by intersecting a rail normal with both reviewed, source-connected carriageway chains, preserving monotonic chainage. Use their actual native profile to constrain the common section; retain disagreement/crossfall and support/ordering conflicts. Do not select a nearest road, convert `layer` into metres, infer a route join or relabel a modeled slab outline as an OSM footprint.
2. Return the same `{known, ya, yb, heightAt, estimated, basis, sourceDeckIds}` result to US's existing `buildTramNetwork(data,{resolveGrade})` and the rail renderer. The displacement datum is relative to `Y.road`; Traffic already adds0.24m. Include source-connected approach grade and reject endpoint seams, including the untagged ways above.
3. In `world.js`'s current tram loop, preserve all source XY, source segment membership and rail widths. Apply the common displacement to both ballast and rail heads, subdividing render-only along the profile's own breakpoints. Emit the source-backed estimated bridge slab in the existing opaque solid batch where needed, with a matching passive physical band; its supporting width must cover the complete tram body. Keep batching; do not add a draw call per segment. Emit model/survey provenance and every unresolved segment in world stats.
4. A source bridge outline that misses rail endpoints cannot by itself authorize an extension. Existing native deck support at those endpoints, or the explicitly estimated source-backed rail slab above, can cover a separately recorded outline/extent mismatch. At the lower Grozăvești bridge, match `w128304847`/`w128304855` and the river model, retaining zero displacement and ground-level ends if confirmed. Never match the higher nearby Basarab. Check slab underside against the actual mapped water ring and modeled water elevation (`world.js`'s Dâmbovița estimate is−4.4m); do not claim surveyed hydrological clearance. At Basarab's southern bridge endpoints, the connected rail approaches are only95/97m: an arbitrary11m flat-deck assignment could produce an approach seam or excessive climb. Shared profile constraints must include the complete connected approach, its actual ground join and the lower crossed source roads.

The exact candidate Basarab carriageway source chains, independently connected through identical original source nodes, are:

- SideA south→north: `w458458361 → w1535667121 → w1535667122 → w668700432 → w668700431 → w668700428 → w668700430 → w668700429 → w668700433`.
- SideB north→south: `w23770172 → w1552024282 → w1552024281 → w1552024280 → w1552024279`.

These are structural association candidates, not rail route joins. The proof includes complete source road tags/XY. Do not assume equal normalized whole-way station is homologous chainage, or that identical source `layer` guarantees equal physical height.

`cross-sections.py` verifies these12original-node joins and tests correspondence at≤0.5m over both complete source bridge ways. `source-cross-sections.json` retains a useful negative control: constant per-leg normals uniquely bracket both chains at2432/2432 and2447/2447samples, but changing normal at a curved source vertex jumps the corresponding road station. Independently resolved leg endpoints could therefore disagree. `source-continuous-sections.json` uses one normalized bisector frame at each source vertex and interpolates only that comparison frame along the unchanged source segment. It retains all unique opposite-side brackets and monotonic chainage on both sides (centreline separation13.469–29.844m). This proves source correspondence under that explicit frame, not native support/grade. A runtime implementation must share one rail-node grade across source-way boundaries too; this source-only script has not resolved approaches or assigned any elevation.

QA's exact6cb metadata/native-world8cc support export is pending. Source-only evidence here does not certify native support, moving trams, crossings, collision or budgets.

Reproduce from the scratch cache (writes only the output proof):

```sh
python handoffs/fidelity/us-districts/rail-bridge-grade/audit.py \
  --tiles /workspace/reality-pass/grozavesti/tiles \
  --dataset /workspace/fidelity-workers/tram-source-metadata/game/data/bucharest-grozavesti.json \
  --ways 128304859 660918286 118416425 205971103 \
  --structures 902056192 \
  --road-names 'Pasajul Basarab' 'Podul Grozăvești' \
  --out /tmp/rail-bridge-source-audit.json

python handoffs/fidelity/us-districts/rail-bridge-grade/cross-sections.py \
  --audit /tmp/rail-bridge-source-audit.json \
  --side-a w458458361 w1535667121 w1535667122 w668700432 w668700431 w668700428 w668700430 w668700429 w668700433 \
  --side-b w23770172 w1552024282 w1552024281 w1552024280 w1552024279 \
  --rails w118416425 w205971103 --step .5 \
  --frame-mode vertex-bisector --out /tmp/rail-bridge-continuous-sections.json
```
