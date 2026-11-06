# 11 — Roads, junctions, markings, vertical profile, walls

Owner role: **world**. Inputs: research JSON (spec 20), visual QA review (spec 19).

## Owner findings to resolve
- Seattle roads and markings look broken (black patches, broken markings, stacked carriageways).
- Many places on the route from the start to C.A. Rosetti look broken.
- Stuck at a concrete barrier across the lane on Șos. Orhideelor (Belvedere/Grozăvești).
- Objects in the middle of the street; invisible collisions; jumping onto/off bridges.

## Requirements
R11.1 Each carriageway is one continuous mitred strip per OSM way, clipped cleanly at junction pads; junction pads are single polygons built from incoming ribbon corners; no two road meshes overlap coplanar anywhere (overlapping dual carriageways merged or separated).
R11.2 Strict layering with `renderOrder` + `polygonOffset`: ground < landuse < sidewalk < road < junction < markings < decals. Zero z-fighting.
R11.3 Markings per country from research: RO white lane/centre lines, bus lanes, tram tracks, zebra crossings, stop lines, turn arrows (from `turn:lanes`); US white dashed lanes, double yellow centre on two-way, yellow left/white right edges on freeways, HOV diamonds where tagged. Markings never cross junction pads (except stop lines/zebras at pad edges) and never sit outside their own ribbon. No markings on service roads.
R11.4 Vertical profile: grades ≤ 8 %; overlapping ribbons either share one surface or have ≥ 5 m clearance (never 0.05–4 m stacked); local junctions at grade; floating bridges at water level; tunnels with portals.
R11.5 Walls/barriers: never across a carriageway or junction on their level band; visible railing only where a collision wall exists; jersey barriers where real (research).
R11.6 Nothing on the road: props, trees, lamps, poles, parked cars, buildings, landmark boxes clipped against carriageway polygons (incl. lane strips).
R11.7 Sidewalks with real widths, kerbs, paving colours (research); driveways/curb cuts at parking entries optional.
R11.8 Pending: GTS door reachable on Calea Călărașilor; Lukoil Barbu Văcărescu reachable or dropped; all `world.audit()` counts 0.

## Acceptance
- [ ] `npm run harness -- --audit`: 0 high, 0 medium in every district.
- [ ] Visual QA detectors: 0 z-fighting / stacked ribbons / markings-outside-ribbon / black-patch findings on all chapter routes.
- [ ] Visual review (human-style, spec 19): roads/markings/junctions category empty.
- [ ] Owner spot-check: spawn → Rosetti and SeaTac → Bellevue look right.

## Requests
## Progress log
