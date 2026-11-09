# Pasajul Unirii public-source approach proposal

This is a CPU source proposal from combined `2696df66fd0331fc645f7c003cbcca7a5410740b`, not shipped data, a new native route or a driven passage pass. No game runtime, compiler or dataset is changed by this packet. All raw inputs are retained cached OSM XML; no network lookup or reference-provider imagery is used.

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
