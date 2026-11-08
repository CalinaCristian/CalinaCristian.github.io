# Native source roof profiles

Generic implementation is isolated on `fidelity/native-roof-profiles`. Commit identity: CalinaCristian <cristycalina@gmail.com>.

## Shared data contract

- `buildings[i][1]` and `buildingDimensions[i][0]` remain **total height**, including the roof, for newly rebuilt districts. Existing JSON without a roof profile keeps the legacy renderer.
- New `buildingRoofProfiles[i]` records `version:1`, `shape`, `totalM`, `eavesM`, `riseM`, `heightSource`, `riseSource`, the x/z slope `axis` and its `low/high` projections. `raw` retains the original dimension/roof strings supplied to the profile. Pipera's pre-enrichment snapshot `t.__originalDimensions` is copied into `originalOSM`, distinguishing native OSM values from injected research. `issues` retains unsupported/invalid/contradictory tags.
- A literal positive OSM height wins; its total never acquires an extra roof rise. Literal positive minimum height is preserved. Levels estimate wall height; a pitched attic adds roof rise. Research heights are totals, with measured/estimated provenance retained. Rise priority is `roof:height`, then `roof:angle`, then a `roof:levels` estimate, then a footprint estimate. `roof:direction` is the downslope compass bearing; `roof:orientation=across` rotates the inferred ridge. Unsupported shapes remain explicitly uncertain.
- Native facade/window/detail heights and cached physical wall ownership use `eavesM`. `assemblySignature` validates eaves rather than total for profiled source bodies. Source and body identities/footprints/holes remain intact. Residual bodies clear inherited source roof profiles.
- Optional `buildingRoofSurfaces[i]` caches source roof visibility against neighbouring actual roof planes. Its `sources` signatures validate source identity, precise footprint/holes, total/minimum and the complete profile. `faces` and wall `vertices` index `buildingRoofGeometryPoints` (x/y/z, 0.0001m). Invalid caches retain the original source mesh and record the rejection. Collision uses the original solid, independent of surface visibility ownership.
- Cache signatures include `nativeRoofMesh:2`; rebuild earlier cached roofs after adopting the final helper. Nearly rectangular envelopes retain every source edge and vertex while using continuous hip planes, including centimetre-scale surveyed jogs (99% area coverage and 1% boundary tolerance). Boundary upstands close the difference at the original edge. This prevents triangle teeth from triangulation of extra vertices. A literal `roof:angle=0` remains zero rise.
- `world.stats.buildingRoofProfiles` exposes supplied/applied/rejected/uncertain profiles and applied/rejected roof surface caches. A list of uncertainties is not a claim of measured parity.
- `collideBuildings(list,x,z,r,y,bodyHeight=2)` interprets `y` as body base. Drone supplies `pos.y-0.35, 0.7`. Profile collision uses the same triangulated roof surface, actual source minimum and total; legacy callers retain their 2m body height.
- Reviewed aircraft are excluded from native roof profiles; Pipera owns their source semantics and separate geometry.

## Geometry and limitations

Directional gables and skillions are exact planar surfaces clipped to the complete footprint including courtyard holes; their exposed gable/upstand walls and elevated undersides close the source volume. Rectangular hips/mansards/pyramids use explicit roof-plane regions. Explicit `round` roofs use a shared 16-segment elliptical barrel section along the source slope axis; every source triangle and boundary wall is split at the same section cuts, including courtyard boundaries. The total and supplied rise remain exact; an absent rise remains an estimate. Concave or courtyard hips/mansards/domes use a continuous low-poly distance-to-eaves surface with shared subdivision vertices; they stay pitched and preserve every hole. A supplied angle derives rise from this actual roof run rather than a concave building's enclosing rectangle. This is a generic low-poly representation, not evidence of exact ridge topology for unmeasured complex roofs. Curved, unsupported or inferred profiles need source-led review; do not claim 100% measured roof parity from these fixtures.

The profile path suppresses guessed rooftop plants, poles/cupolas and overshooting crowns. Existing inferred facade features remain a separate fidelity question. Generic source-wall cache clipping is based on the source eaves; intersecting complex roofs and facade contacts still require actual-image review.

## Validation

`node tools/osm/test-building-roofs.mjs` verifies strict m/ft/in/cm/mm units and rejection of ambiguous dimensions; total/eaves/rise priorities; angle/direction/orientation; literal low heights; L/U/courtyard/thin-part area, open holes and complete pitched surfaces; equal-height ownership; overlapping and elevated parts; cache invalidation; actual `collideBuildings` ridge/eave/underside behavior.

`node game/dev/harness/football-check.mjs`: 13/13. `node game/dev/harness/drone-boundary-check.cjs`: 9/9. Edited modules pass syntax and diff checks.

Romană is rebuilt privately using `/workspace/reality-pass/romana/tiles`; final all-district generated JSON belongs to root and district owners. No reference imagery belongs in git. Further actual browser, reference-image and mandatory foot/a results are appended in the evidence commit.

### Browser and source evidence, 2026-11-08

Private evidence: `/workspace/reality-pass/native-roof-profiles/`. The final immutable browser snapshot is `candidate-barrel`, archived from `c6d243d`, with its independently rebuilt Romană JSON. Subsequent `cf8c842` changes only the builder's small-building fallback: positive mapped levels now reach the normal levels estimate before a generic 3/4m roof default. The Unirii owner verifies source `w406473986` (two levels, 6.4m estimate and reviewed 5.8m clearance) during final district rebuilds.

| Check | Result |
| --- | --- |
| Actual browser, final source profiles | 5,694 supplied/applied; zero rejected; 72 profiles retain explicit tag issues, with further estimated dimensions identified by their source fields |
| Actual browser, final source roof caches | 1,856 applied; zero rejected |
| High quality, full traffic, normal mirrors | Six Arnia/UiPath route frames; maximum 1,268,132 triangles and 331 calls (limits 1,500,000/400) |
| Browser errors | Zero page errors and zero console errors |
| Independent raw XML dimension audit | All 1,024 positive literal heights and 496 positive literal minimum heights in the rebuilt profile set agree; zero mismatches |
| Mandatory `foot,a` | Zero high, zero medium; two low software-rendering/performance findings |
| Actual drone flights | Four altitude/mode cases pass, no page/console errors; 150m boundary, stop and return behavior retained |
| Football / drone boundary fixtures | 13/13 and 9/9 |

`browser-barrel/results.json` records source profiles, precise rings, local roof collision probes and the six renderer counts. The five source examples are `w1526701232`, `w1526701233`, concave `w76256178`, two-courtyard `r2230393` and round `w1493880907`. All tested positions above each source total are clear, tested positions inside each actual roof solid collide, and both courtyard probes remain clear. The literal 9m/3m examples peak at 9m with 6m eaves; the literal 16m/1m round example has 15m eaves and its mapped 15m minimum. Foot/a ran against the earlier immutable `candidate-source` with the same collision API; later helper changes add roof topology without changing that API or legacy corridor data. Results are `logic/latest.json`, `drone/results.json`, `pure-fixtures.log`, `football.log` and `drone-boundary.log`.

Top, south and north views of all five source cases were inspected in `inspected-source-contact-sheet.jpg`; the tower initially obscured the northern view of the 9m examples, so the clear northeast angle was recaptured and inspected in `browser-clear-angle`. Independent Esri World Imagery crops were fetched for the literal-height site, concave source, courtyard source and round source; acquisition dates are unknown. The courtyard openings and barrel building footprint can be compared, but tree/shadow cover prevents an exact visual roof judgment at the literal-height site. Its narrow projecting roofs are mapped gabled parts `w1526701235`–`w1526701239` and remain present. These references support source-led review, not a blanket claim of measured roof parity. No Street View data, meshes or copyrighted reference images are committed.

The private final JSON is 19.46MB and is intentionally excluded from this branch; root/district workers regenerate all eight final districts with the complete prerequisites. Existing JSON continues through the legacy no-profile path.

## Root documentation requests

Update README/spec01/spec12/data README in the integration commit: source height now includes the roof; native pitched courtyard/concave roofs retain their openings; literal imperial dimensions are converted; roof metadata/uncertainty and visibility cache fields are optional and backward compatible; the collision API gains optional `bodyHeight`. Keep source estimates explicit and avoid declaring unmeasured complex-ridge topology complete.
