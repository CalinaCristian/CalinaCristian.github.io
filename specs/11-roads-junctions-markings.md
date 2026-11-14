# 11 — Roads, junctions, markings, vertical profile, walls

Owner role: **world**. Inputs: research JSON (spec 20), visual QA review (spec 19).

## Requirements
R11.1 Each carriageway is one continuous mitred strip per OSM way, clipped cleanly at junction pads; junction pads are
single polygons built from incoming ribbon corners; no two road meshes overlap coplanar anywhere.
R11.2 Strict layering with `renderOrder` + `polygonOffset`: ground < landuse < sidewalk < road < junction < markings <
decals. Zero z-fighting.
R11.3 Markings per country from research: RO white lane/centre lines, bus lanes, tram tracks, zebra crossings, stop
lines, turn arrows (from `turn:lanes`), a bus lane against a one-way (`busway=opposite_lane`) behind the wide solid
bus-lane line with BUS lettering read by the bus; US white dashed lanes, double yellow centre on two-way roads, yellow left / white
right edges on every one-way carriageway, HOV diamonds where tagged. Markings never cross junction pads (except stop
lines/zebras at pad edges) and never leave their own ribbon. No markings on service roads.
R11.4 Vertical profile: grades ≤ 8 %; overlapping ribbons either share one surface or have ≥ 5 m clearance (never
0.05–4 m stacked); local junctions at grade; floating bridges at water level; tunnels with portals.
- A covered underground road gets a positive roof slab (not two crossing skins) below the street-level lid that keeps
  the legal clearance; portal and roof share one mitred section; open ramps stay open; the ground above keeps its own
  colour and geometry.
- Elevated bridge forks get a continuous underside below the existing pad pavement, closed only on the exterior boundary;
  no cross-lane cap walls; source, grade and route data are never altered to hide gaps.
- Modelled depths, openings and deck heights are estimates distinct from legal limits and source tags; layer/level tags
  never supply metres.
R11.5 Walls/barriers: never across a carriageway or junction on their level band; a visible railing only where a
collision wall exists; jersey barriers where real (research). Every raised deck carries one guard on the outline of the
union of its raised carriageways (the reviewed guard class or a concrete parapet).
R11.6 Nothing on the road: props, trees, lamps, poles, parked cars, buildings and landmark boxes are clipped against
carriageway polygons (incl. lane strips).
R11.7 Sidewalks with real widths and sides (`sidewalk:left/right/both/separate`), kerbs and paving colours; inferred
shoulders, sidewalks and bridge margins yield to a known flat tram corridor, never mapped footways or furniture.
R11.8 All `world.audit()` counts 0; every CV door reachable from a lane.

## Acceptance
- `npm run harness -- --audit`: 0 high, 0 medium in every district.
- Visual QA detectors: 0 z-fighting / stacked ribbons / markings-outside-ribbon / black-patch findings on all chapter
  routes.
- Visual review (spec 19): roads/markings/junctions category empty.
