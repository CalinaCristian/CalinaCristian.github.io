# game/data

`bucharest.json` and `seattle.json` are generated from OpenStreetMap by
`tools/osm/build-data.mjs` (see `tools/osm/README.md`) and loaded at runtime by
`game/src/world.js`. Do not edit by hand. Data © OpenStreetMap contributors (ODbL).

## Schema (version 1)

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
| `roads` | `[name, class, lanesF, lanesB, median_dm, laneW_dm, sidewalk_dm, maxspeed_kmh, flags, layer, node…]` — nodes in travel order for one-way roads (`lanesB = 0`); `median` is negative for one-way roads (= −lanesF·laneW) so that the lane-centre formula `median/2 + laneW·(i+0.5)` centres the lanes on the way; flags: 1 oneway, 2 bridge, 4 tunnel, 8 roundabout, 16 bus lane, 32 tram, 64 toll, 128 unpaved/cobbles, 256 tram in the median |
| `trams` | tram track centre lines (delta) |
| `buildings` | `[style, height_dm, minHeight_dm, roof, name, flags, ring delta…]`; flags: 1 ground-floor shops, 2 has a sign (`name` = sign text), 4 landmark-ish, 8 the sign is a brand |
| `pois` | `[kind, x, z, name, brand, sub, buildingIndex]` (`sub` = OSM value, e.g. `fast_food:burger`) |
| `areas` | `[kind, name, outer delta, hole delta, …]` |
| `lines` | `[kind, width_dm, name, delta]` (runways, taxiways, rivers) |
| `lamps` | `[x, z, height_dm, …]` — OSM `highway=street_lamp` nodes (height 0 = unknown) |
| `places` | `[name, x, z, rank]` (0 city, 1 suburb, 2 quarter, 3 neighbourhood) |
