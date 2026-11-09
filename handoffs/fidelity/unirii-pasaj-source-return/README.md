# Pasajul Unirii public-source approach proposal

The original proposal was committed as `14b012110034a553236a5afd07c0d20e22029437` from combined `2696df66fd0331fc645f7c003cbcca7a5410740b`. This branch now also contains an explicitly scoped rebuilt source-data candidate and immutable prior-model compiler support (`249a02f098f0ee37ca1ca50a40690560f111c452`). It is not a fresh native route, current overview capture or driven passage pass. All raw inputs are retained cached OSM XML; no network lookup or reference-provider imagery is used.

The old actual source graph clips the main Pasaj approach/exit at four synthetic ends. The northern entry is already2.617m below the street datum at its cut, while the southern entry and both exits are already about5.2m down. The default story can reach Coposu, but cannot route into this disconnected through-chain. Marking a map waypoint cannot bypass that: production Fast Travel requires a computed route. The earlier possible MAP-entry suggestion was rejected before a new heavy browser or player placement.

Literal ramp sources are retained in full raw records:

| Direction | Source way | Literal source-node course | Raw incline |
|---|---|---|---|
| North entry, southbound | w23782207 | 257684039→2351340244 | down |
| South exit, southbound | w241368619 | 257684144→257685697 | up |
| South entry, northbound | w4045772 | 257685484→257684209 | down |
| North exit, northbound | w241368616 | 2351340230→2351309047 | up |

`proposal/review.json` uses the existing `compileSourceReturns` contract. Four finite40m domain buffers follow exact consecutive source legs. This radius is a gameplay/body/raster envelope, not a changed road width. The outer endpoints are original positive source nodes in the historical public GTS-journey incidence; each portal includes one existing tunnel leg so the ramp/tunnel transition is checked too. No nearby coordinate alias, invented connector, private shortcut, skipped shape vertex or immediate U-turn is supplied.

| Reviewed corridor | Legs | Length | Maximum required source/body/raster envelope |
|---|---:|---:|---:|
| North entry | 44 | 1041.205m | 26.379m |
| South entry | 27 | 945.249m | 28.129m |
| North exit/return | 42 | 971.435m | 27.629m |
| South exit/return | 13 | 727.434m | 28.629m |

All four compile together with exact source direction/access/turn-lane and touching motor-restriction checks. Five actual-path negative controls reject missing ways, wrong node joins, reverse one-way travel, private access and insufficient domain buffers; compilation consumes no RNG. The complete source tile hashes, raw ways/node tags/restrictions, selected duplicate checks, normalized compiler output and unknown restriction report are retained. Runtime GPS/NPC modes, body/static/terrain clearance and publication remain separate gates.

Historical native source incidence is pinned in `native-incidence-395.json.gz`. Its nine road-plan/identity fields equal combined2696 exactly. That establishes a source-plan bridge, not a fresh native physical claim or a return to the same origin. Newer `native-profiles-before-9fc.json.gz` supplies actual recorded heights after the canopy correction. `profile-queries.json.gz` retains5515stations covering every old core edge:560main-Pasaj,20cropped-ramp,15other-tunnel and4920ordinary-road stations. Native endpoint values and linear-interior reconstruction are labelled separately. Five profile-sampler controls prove explicit-edge level selection, missing/ambiguous-source handling and refusal of nearest-road API fallback. Fresh paired native exports must also capture old passive scenery profiles and actual emitted geometry.

The unexpanded diagnostic rebuild matches all old roads/source nodes/XY/widths/access, all6188building rows/precise footprints/dimensions/canopies/holes/roof profiles, all15758tree tuples/crowns/info, all444area records and old scenery/parking/POIs/furniture exactly. It still changes generated date, source metadata and cache fields; `baseline-retention.json` records them. The current full compiler enriches rail route context without changing the old foreground runs or old source-way records; this cannot silently become motor-domain physical acceptance. It also omits `reviewedCoveredRoads`: reapply/revalidate the finite MOL canopy review after every rebuild so Coposu does not sink again.

`retention-and-profile-plan.json` defines the next gate. No AFTER height is invented here. All changed old interior/ordinary heights must be recorded; replacing the four clipped ramp ends may legitimately extend their inferred model, while literal3.5m legal height, categorical incline, estimated depth, estimated opening and outside-terrain provenance remain distinct. All source footprints/heights/parts/courts/crowns stay subject to exact retention checks. A diagnostic domain build is stored outside Git and automatically restores the old tracked dataset/research state; it is not a release candidate.

Re-run the source proposal with the retained nine-tile cache:

```sh
node handoffs/fidelity/unirii-pasaj-source-return/tools/audit-source-return.mjs \
  /workspace/reality-pass/remaining-ro/unirii/tiles /tmp/pasaj-source-proposal-new
node handoffs/fidelity/unirii-pasaj-source-return/tools/profile-sampler-controls.cjs
```

The complete old native pictures/buffers remain in the separate proof-only branch `fidelity/unirii-underpass-native-proof` at `0d634c996101c3ac87205aea4e99886d2b9c957e`. This packet includes only the compact source/profile records needed to review the next correction.

## R3 source-data candidate and limits

`game/research/source-returns-bucharest-unirii.json` installs the exact126leg proposal above. The full compiler uses the retained nine-tile cache; its actual command, input hashes and canopy revalidation are in `candidate-r3/build-job.json`. The dataset SHA256 is `e94dc563fc82efe0f6dac21e7e20ac8e34ea5a7e20eb38bf97e829abebe9657d`. No World/Nav/Traffic/actor, source width, legal clearance or light-timing code changes are part of this data candidate.

The first diagnostic exposed21fallback-height/roof and12style changes caused solely by new road proximity, plus109omitted measured crowns. R2's overly strict raw-only evidence gate correctly refused the building retention because these buildings already had reviewed facade colors. Both negative audits are retained. R3 separately pins raw tags and the identical prior effective evidence tags, outer rings and holes. All26reviewed models match the actual unexpanded compiler input stage; new source/research annotations still take precedence. The prior fallback remains an estimate, and crowns retain an unresolved physical-clearance note.

R3 preserves every old6,188building footprint/height/roof profile/canopy/courtyard,15,758tree tuple/crown/info record,444area, positive source-road node/XY, complete road source geometry/tag/width/access/model,246POI,198furniture,18roadside-parking metadata rows and106source-parking footprints. Building styles are also unchanged.204flag changes expose newly playable context;35newly matched business display names remain explicitly listed, so this is not whole-row parity. New counts are315roads,7,072buildings,18,785trees and496areas; counts alone do not establish fidelity.

Foreground rail coverage changes materially: the four old packed runs and their source records are exact subsets of20foreground runs. Sixteen additional literal tracks have `oneway=yes` and no bridge/tunnel/layer tags; this is not a surveyed grade or a native binding pass. Full retained rail ways increase8→148 (surrounding route context4→128), node tags10→286, route relations12→26, crossing contexts1→3 and motor restriction records26→46. Every old raw way/crossing/restriction record and route relation's tags/members survives; improved missing-way context is recorded separately in `candidate-r3/source-scope.json`. Fresh native natural fleet, source direction/mode/grade/binding/admission and body/static checks are required; the old four-run physical evidence does not transfer.

The isolated CPU tool executes the unchanged World graph/profile prefix with its actual hoisted mitre functions, stopping before geometry/rail emission. BEFORE agrees with the historical native endpoint/linear-interior records, retaining eight IEEE differences≤3.55e−15m. Of5,515old stations,22change:18on the four extended ramps (max+2.4174244m), and four on the final11.51m northbound tunnel/portal legw1383050305 (+.0301975…+.1207901m). All4,920ordinary stations are bit-identical. All630literal corridor stations have source matches; two strict raw ambiguity flags retain the shared node21448879's8.88e−16m edge-interpolation difference. No tolerance or road-height override was added. Full records and every delta are in `candidate-r3/profile-comparison.json` and the lossless CPU outputs.

CPU actual Navigator queries on the same drivable source graph find routes from the historical normal GTS origin to both ground ramp entries, and both complete through directions without virtual edges. The909.92m northbound query usesw241368618/w1383050305 from source node257685484 to2351309047. These are a normal public-entry proposal, not an executed MAP transition. Fresh paired native profiles, passive scenery/terrain provenance, actual earth/roof ordering and pixels, legal natural actors, continuous approach/descent/passage/ascent/exit, safe ordinary signal waiting, mirror/side views, contacts and native frame budgets all remain open.

`tools/observe-pasaj-native.cjs ROOT_AFTER OUT SOURCE_AFTER40 noon ROOT_BEFORE SOURCE_BEFORE40` runs one browser with sequential fresh contexts. Both sources must be immutable archives from `prepare-native-archive.py`. The BEFORE context exports normal GTS/noon profiles and all natural cohorts without observer warm/drive ticks. AFTER recomputes actual emitted model vertices through native parent matrices, source rail centre/direction/mode and strict body contacts; producer summaries remain diagnostics. Six positive/negative controls cover real hatch bounds, pitch/parents, deep contact, grade separation, missing geometry and rail source failures. A negative natural preflight preserves data/geometry and stops before MAP travel. Safe signal waits keep the native caller's controls/timers; reset requests are retained without executing the relocation. This remains tooling preparation until a terminal native report and full-size image inspection are saved.

The read-only `final-water-be12/` packet preserves six real raw-water positive roof-query witnesses, five polygon controls and the complete native nonindexed final small-water object472 (`water -1,0`,246 triangles). Those final triangles have zero projected intersections with the six reconstructed native query footprints. Big-water POSITION triples also test negative, with every selected index triple checked against the frozen World nonindexed-chunk/sequential-batch construction; this is separately labelled source-validated reconstruction, not a directly captured canonical index. The stale selected-index tail is never treated as complete topology. These results explain why an early raw-water refusal can be overly conservative; they neither assert six visible holes nor authorize changing water or a running native source. Native passage/roof pixels remain a separate gate.
