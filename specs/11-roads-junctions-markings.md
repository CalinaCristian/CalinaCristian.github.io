# 11 — Roads, junctions, markings, vertical profile, walls

Owner role: **world**. Inputs: research JSON (spec 20), visual QA review (spec 19).

## Requirements
R11.1 Each carriageway is one continuous mitred strip per OSM way, clipped cleanly at junction pads; junction pads are single polygons built from incoming ribbon corners; no two road meshes overlap coplanar anywhere (overlapping dual carriageways merged or separated).
R11.2 Strict layering with `renderOrder` + `polygonOffset`: ground < landuse < sidewalk < road < junction < markings < decals. Zero z-fighting.
R11.3 Markings per country from research: RO white lane/centre lines, bus lanes, tram tracks, zebra crossings, stop lines, turn arrows (from `turn:lanes`); US white dashed lanes, double yellow centre on two-way, yellow left/white right edges on freeways, HOV diamonds where tagged. Markings never cross junction pads (except stop lines/zebras at pad edges) and never sit outside their own ribbon. No markings on service roads.
R11.4 Vertical profile: grades ≤ 8 %; overlapping ribbons either share one surface or have ≥ 5 m clearance (never 0.05–4 m stacked); local junctions at grade; floating bridges at water level; tunnels with portals.

An existing underground tunnel roof is a positive slab, not two crossing skins. Its estimated underside is bounded below the street-level lid and must retain the literal legal clearance. Portal and roof use one native mitred section; open ramp intervals remain open. Existing source ground keeps its color/geometry, while the closed roof top supplies bounded depth occlusion rather than a gray replacement of lawns/paving. Road heights, source widths, legal directions and actor cardinality are not changed by this closure model. CPU actual-buffer witnesses and fresh native passage/side/mirror views remain separate acceptance gates.

Pasajul Unirii's reviewed source-domain candidate retains the complete mapped ramp ways23782207/241368619/4045772/241368616 and exact public approach/return joins; a finite40m domain buffer is not a road width or surveyed height. Replacing the four synthetic cut ends changes inferred ramp profiles and the last11.51m northbound tunnel/portal leg, explicitly recorded per source station in `handoffs/fidelity/unirii-pasaj-source-return/candidate-r3/profile-comparison.json`; ordinary retained street profiles remain unchanged in the isolated CPU solver. Legal3.5m limits, literal categorical incline, modeled depth/opening and terrain provenance stay distinct. The expanded foreground rail sources and source-control/restriction context require fresh natural-cohort native admission; source selection/CPU graph reachability cannot substitute for a completed public passage, source body/earth/roof clearance or current pictures.
R11.5 Walls/barriers: never across a carriageway or junction on their level band; visible railing only where a collision wall exists; jersey barriers where real (research).
R11.6 Nothing on the road: props, trees, lamps, poles, parked cars, buildings, landmark boxes clipped against carriageway polygons (incl. lane strips).
R11.7 Sidewalks with real widths, kerbs, paving colours (research); driveways/curb cuts at parking entries optional.
R11.8 Pending: GTS door reachable on Calea Călărașilor; Lukoil Barbu Văcărescu reachable or dropped; all `world.audit()` counts 0.

## Acceptance
- [ ] `npm run harness -- --audit`: 0 high, 0 medium in every district.
- [ ] Visual QA detectors: 0 z-fighting / stacked ribbons / markings-outside-ribbon / black-patch findings on all chapter routes.
- [ ] Visual review (human-style, spec 19): roads/markings/junctions category empty.
- [ ] Owner spot-check: spawn → Rosetti and SeaTac → Bellevue look right.

## Source-rail roadside clearance (2026-11-09)

The inferred roadside compiler preserves each complete mitred lane footprint and all literal/reviewed widths. Only generated outside-lane shoulder, sidewalk-underlay and structural-margin geometry can yield to a known flat source rail's emitted fleet corridor at compatible model heights. It closes newly cut bridge margins and shares those caps with collision. Inferred raised crossing paving is lowered to the shared ground surface, retaining paving and matching walking/surface queries. Separately mapped footways/areas/props, source XY/directions and motor/rail grades remain unchanged. Non-convex protected lanes and mapped dimensions stay unresolved/retained instead of being clipped. See the architecture contract and `game/dev/rail-roadside.test.mjs`; a contact replay is not a native visual or full-path pass.

## Structural bridge pads (2026-11-09)

Bridge-edge retraction at a source fork leaves a real junction pad whose existing road pavement must have a continuous underside. Reuse its complete serialized road-pad skin/XY tessellation and modeled adjacent depth; close only the exterior boundary after removing connected structural road-mouth intervals. Share the exact derived slab triangles with passive collision/height queries. Do not create cross-lane cap walls or alter source/grade/route data to hide gaps. The first patch excludes speculative outer sidewalk slab width. Its low current deck over source rail w660927514 remains a recorded profile/headroom blocker until the separate profile model and fresh native checks resolve it.

- 2026-11-09 root: exact8b bridge witness matches ground closure bundle73/w106797419/e882 atY.24 while cockpit isY11.24 onw668700431. Main warning and Player.nearClosure were XZ-only; World now exposes the unchanged normalized barrier y..y+barrierHeight, consumed by existing Player.atLevel for warnings/soft-proximity classification and crew chatter. No source closure/physical guard/routing/tolerance changes. Three actual-Player CPU controls cover exact warning/soft-zone witnesses, real ground closure, elevated/sunken bands and strict25mreach. Fresh native event/driver retake remains required; original source replay retains its historical pins.

- 2026-11-09 (Pipera, review): source-tunnel DOWN jobs now wait until existing landmark-owned pool collapse. The original nonwater/raw-big ground owner snapshot is preserved; retained4×4 small-water and explicitly identified transformed landmark-water triangles can still refuse a roof. Final normal water reuses the exact shared6m/60000-cap/covered-centroid topology only after all original source attributes match. No water geometry/material/opacity policy changes. Unirii CPU World replay keeps all106 prior complete roof models/bands exact and resolves six raw-only water refusals; nine source-replayed small groups and big-water kernel have exact topology/shore parity. Local native738-position/246-triangle water buffer matches; whole-district native/visual/drive/budget gates remain pending. Proof: handoffs/fidelity/pipera-fidelity/final-water-underpass-index/.
