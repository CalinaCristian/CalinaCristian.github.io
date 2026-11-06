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
- 2026-11-07 00:25 UTC (world): rendering restructured for R11.1–3. Pass 1 computes every carriageway polygon (mitred at degree-2 nodes, cut back to the pad at junctions) and every junction pad (hull of the incoming ribbon corners) into a surface grid; pass 2 draws. Carriageways go to their own per-cell mesh (`road`, polygonOffset −1/−2, renderOrder 2), junction pads to `junction` (−2/−4, renderOrder 3, same height as the roads: the old +4 mm offset that flickered at distance is gone), markings to `marks` (−4/−8, renderOrder 4), ground/sidewalks/kerbs renderOrder 1. Kerbs are cut in 4 m pieces and a piece is dropped where it would stand on another carriageway / pad; every marking quad (solid lines in 4 m pieces, bands in 6 m pieces, dashes, zebras) is dropped where its centre lies on another surface (pads, touching dual carriageways, slip lanes) → no markings across junctions or over another road. No markings at all on service roads. Bridge decks / embankment and trench walls / tunnel ceilings and lids now use mitred corners at the ends (no gaps / overlaps at bends — the "two-piece overpass" at SeaTac). CV doors are kept ≥ 4 m clear of junction pads (UiPath HQ door mat was in a junction). At 1:1 the district maps have no squeezed parallel carriageways; `world.audit()` = 0 props / buildings / walls / lamps / cliffs / doors in all 8 districts. Chapter route screenshots (driver's seat at 1.7 m without the cockpit + top-down, every 50 m): /tmp/claude-0/-home-user-CalinaCristian-github-io/c23e7db4-0398-5255-9d52-f406a6fe27a7/scratchpad/shots/v1/ (first pass) and …/shots/v2/ (final), contact sheets …/shots/*-d1.png / *-t1.png.
- 2026-11-07 01:40 UTC (world): turn arrows from OSM `turn:lanes` (build-data `turnLanes`, 1–406 per district) painted per lane 9 m before the junction; continuous lines end on the mitre line at plain bends; last barrier sweep is followed by a lane cut (legacy maps: 23 barrier-in-lane walls → 1). Layering re-checked after the near plane moved to 0.2 m: road/pad/marking polygon offsets keep them apart at 200–800 m (…/shots/far-sheet.png). Remaining: HOV diamonds, US RPMs, stop lines only at signals/stop/give-way, legacy Seattle (I-5 height snap 1418,-755; Bellevue Way barrier; 3rd Ave S ramp cliff).
