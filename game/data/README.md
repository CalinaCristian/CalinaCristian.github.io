# game/data

**Chapter districts (real 1:1 scale)**: `<city>-<district>.json` — `bucharest-{floreasca,grozavesti,unirii,pipera,romana,otopeni}.json`,
`seattle-{seatac,bellevue}.json` — built by `node tools/osm/build-data.mjs --tiles DIR --districts` from the districts in
`game/src/cities.js` (`CITIES[city].districts`) and loaded by `buildWorld(city, renderer, { district })`. Same schema as below
plus `district: {id, name, bbox, areaKm2, polys, ends: [node index of every road cut at the boundary], mask: {x0, z0, cell, w, h,
rle}}` (inside-mask, 20 m cells, run lengths alternating outside/inside starting with outside) and optional `brands`
(`{brand: [bg, fg, accent]}` sign colours from `game/research/`). The field research (`game/research/<city>-<district>.json`)
fills missing building heights / levels / facade and roof colours / roof shapes at build time.

**Legacy corridor maps**: `bucharest.json` and `seattle.json` are generated from OpenStreetMap by
`tools/osm/build-data.mjs` (see `tools/osm/README.md`) and loaded at runtime by
`game/src/world.js`. Do not edit by hand. Data © OpenStreetMap contributors (ODbL).

## Schema (version 2)

All coordinates are **integers in decimetres** in game space (x = east, z = south, origin at the
city anchor). *delta* arrays are `[x0, z0, dx1, dz1, …]` (each point relative to the previous).
String fields are indices into `strings` (`-1` = none).

| key | content |
|---|---|
| `proj` | `{lat0, lon0, scale, mPerLat, mPerLon, compress}` — x = (lon−lon0)·mPerLon·scale, z = −dlat·mPerLat·scale; latitudes above `compress.above` are multiplied by `compress.factor` |
| `bounds` | `[minX, minZ, maxX, maxZ]` of the road graph |
| `classes`, `styles`, `roofs`, `poiKinds`, `areaKinds`, `lineKinds` | lookup tables for the indices below |
| `nodes` | road graph nodes `[x0, z0, x1, z1, …]` (absolute) |
| `nodeFlags` | `[nodeIndex, flags, …]`: 1 traffic signals, 2 crossing, 4 zebra, 8 signalised crossing, 16 stop, 32 give way, 64 bus stop, 128 tram stop, 256 speed camera, 512 mini roundabout |
| `roads` | `[name, class, lanesF, lanesB, median_dm, laneW_dm, sidewalk_dm, maxspeed_kmh, flags, layer, node…]` — nodes in travel order for one-way roads (`lanesB = 0`); `median` is negative for one-way roads (= −lanesF·laneW) so that the lane-centre formula `median/2 + laneW·(i+0.5)` centres the lanes on the way; flags: 1 oneway, 2 bridge, 4 tunnel, 8 roundabout, 16 bus lane, 32 tram, 64 toll, 128 unpaved/cobbles, 256 tram in the median, 512 painted bike lane, 1024 cycle track beside the road, 2048 lit, 4096 lit=no |
| `trams` | tram track centre lines (delta) |
| `buildings` | `[style, height_dm, minHeight_dm, roof, name, flags, levels, colour, roofColour, ring delta…]` (v2; v1 had the ring at index 6); `levels` = OSM `building:levels` (0 unknown), `colour`/`roofColour` = string index of `#rrggbb` from `building:colour` / `building:material` / `roof:colour` / `roof:material` (−1 none); roofs: flat, pyramid, gabled, dome, hipped, skillion, mansard; flags: 1 ground-floor shops, 2 has a sign (`name` = sign text), 4 landmark-ish, 8 the sign is a brand |
| `pois` | `[kind, x, z, name, brand, sub, buildingIndex]` (`sub` = OSM value, e.g. `fast_food:burger`) |
| `areas` | `[kind, name, outer delta, hole delta, …]` |
| `lines` | `[kind, width_dm, name, delta]` (runways, taxiways, rivers) |
| `lamps` | `[x, z, height_dm, …]` — OSM `highway=street_lamp` nodes (height 0 = unknown) |
| `places` | `[name, x, z, rank]` (0 city, 1 suburb, 2 quarter, 3 neighbourhood) |
| `trees` | `[x, z, t, …]` — OSM `natural=tree` nodes and `tree_row` ways (sampled every 7 m); `t = height_dm·2 + conifer` (height 0 = unknown, conifer from `leaf_type` / `genus`) |
| `treeInfo` | (districts, 2026-11-07) one triple per tree, same order as `trees`: `[taxon, circumferenceCm, leaf, …]` — `taxon` = string index of the OSM `species` / `taxon` / `species:en` / `genus` text (most specific first, −1 none), circumference in cm (0 unknown; OSM metres converted), `leaf` bits: 1 broadleaved, 2 needleleaved, 4 deciduous, 8 evergreen, 16 generated from a `tree_row` (7 m spacing) |
| `furniture` | `[kind, x, z, …]` — kinds in `furnKinds` (bench, waste_basket, bollard, post_box, bicycle_parking, drinking_water, fountain, fire_hydrant, recycling, telephone, vending_machine, picnic_table, advertising); none on a carriageway |
| `backdrop` | `[x, z, w, d, h, angleDeg, …]` (dm, degrees) — low-poly building masses beyond the corridors (one box per 40 m cell) so the horizon is not empty |
| `corridor` | `{areaKm2, legs: [[label, km], …]}` — the routes the map was cut to (see `tools/osm/corridors.mjs`) |

### Corridors (since v2)

The maps only contain what the story drives: travel-time routes on the drivable graph between the CV stops in
story order (+ the centre / north loops in Bucharest, the SR-520 alternative and a downtown loop in Seattle),
buffered by 300 m (450 m around stops and landmarks, 600 m in the historic centre of Bucharest). Roads, buildings,
POIs, lamps, trees and furniture outside are dropped; parks / water may extend 600 m further for scenery.
