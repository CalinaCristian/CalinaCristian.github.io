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
| `nodeFlags` | `[nodeIndex, flags, …]`: 1 traffic signals, 2 crossing, 4 zebra, 8 signalised crossing, 16 stop, 32 give way, 64 bus stop, 128 tram stop, 256 speed camera, 512 mini roundabout, 1024 red-light camera |
| `roads` | `[name, class, lanesF, lanesB, median_dm, laneW_dm, sidewalk_dm, maxspeed_kmh, flags, layer, node…]` — nodes in travel order for one-way roads (`lanesB = 0`); `median` is negative for one-way roads (= −lanesF·laneW) so that the lane-centre formula `median/2 + laneW·(i+0.5)` centres the lanes on the way; flags: 1 oneway, 2 bridge, 4 tunnel, 8 roundabout, 16 bus lane, 32 tram, 64 toll, 128 unpaved/cobbles, 256 tram in the median, 512 painted bike lane, 1024 cycle track beside the road, 2048 lit, 4096 lit=no |
| `trams` | tram track centre lines (delta) |
| `buildings` | `[style, height_dm, minHeight_dm, roof, name, flags, levels, colour, roofColour, ring delta…]` (v2; v1 had the ring at index 6); `levels` = OSM `building:levels` (0 unknown), `colour`/`roofColour` = string index of `#rrggbb` from `building:colour` / `building:material` / `roof:colour` / `roof:material` (−1 none); roofs: flat, pyramid, gabled, dome, hipped, skillion, mansard; flags: 1 ground-floor shops, 2 has a sign (`name` = sign text), 4 landmark-ish, 8 the sign is a brand, 16 roof shape measured (OSM `roof:shape` or the aerial roof survey: world.js keeps it), 32 scenery ring (district worlds: a real footprint outside the playable area, no shops / signs / street clutter), 64 a large named building its own service lanes run into (market hall: not shrunk away by them) |
| `areaKinds` additions | (2026-11-08, appended so older indices stay valid) `track` (velodrome / running track, under its infield), `clay` (clay / tartan courts), `turf` (artificial-turf pitch), `hard` (asphalt / acrylic courts), `pool` (outdoor pool), `yard` (school / university / hospital / sports-centre grounds). District builds keep every area out to the scenery ring (was 120 m past the edge for all but parks / water). world.js dresses pitch / turf / clay / hard / pool areas with markings, goals, nets, fences, hoops, copings |
| `scenery` | (districts, 2026-11-08) `[carriagewayWidthDm, sidewalkDm, class, flags, delta…]` per street piece of the scenery ring (≤ 600 m outside the playable area by default) and inside pieces off the drivable network; flags 1 bridge (skipped), 2 inside fragment. Drawn as asphalt + sidewalks, no traffic |
| `green` | (districts, 2026-11-08) `{x0, z0, cx, cz, w, h, rle}` green ground (gardens, lawns, ground under crowns) measured on aerial imagery (`tools/aerial/trees.py --ground-out` → `game/research/green-<city>-<district>.json`), re-gridded in game metres; `rle` = run lengths per row (off, on, …, −1 at each row end) |
| `pois` | `[kind, x, z, name, brand, sub, buildingIndex]` (`sub` = OSM value, e.g. `fast_food:burger`) |
| `areas` | `[kind, name, outer delta, hole delta, …]` |
| `lines` | `[kind, width_dm, name, delta]` (runways, taxiways, rivers) |
| `lamps` | `[x, z, height_dm, …]` — OSM `highway=street_lamp` nodes (height 0 = unknown) |
| `places` | `[name, x, z, rank]` (0 city, 1 suburb, 2 quarter, 3 neighbourhood) |
| `trees` | `[x, z, t, …]` — OSM `natural=tree` nodes and `tree_row` ways (sampled every 7 m); `t = height_dm·2 + conifer` (height 0 = unknown, conifer from `leaf_type` / `genus`) |
| `rampLimits` | (2026-11-07) `[roadIndex, legalKmh, …]`: US ramps without a posted limit; `roads[i].maxspeed` = advisory, `legalKmh` for the HUD, no limit sign |
| `vacant` | (2026-11-07) `[x, z, buildingIndex, …]` disused shop units from research (`businesses-gamediff.json` closed) |
| `brands` | `{brand: [bg, fg, accent, logoText?]}` sign colours from research (district dossier + `businesses-<city>-<district>.json`) |
| `streetTrees` | (districts, 2026-11-07) `{street name: [species keys]}` from the research dossier's per-street tree notes (`streets[].research.trees` text + `streets[].trees.genus`, mapped with `trees.js speciesFromOSM`); `[]` = researched as treeless. world.js reads it instead of fetching `game/research/*.json` |
| `roadInfo` | (districts, 2026-11-07) 6 per road, same order as `roads`: `[osmLayer, flags, widthDm, maxheightDm, placement, bridgeStructure, …]` — raw OSM `layer`; flags 1 covered, 2 tunnel=building_passage, 4 bridge, 8 `level` tagged, 16 `*_link`, 32 `layer` tagged, 64 / 128 kerbside parking right / left (OSM `parking:*`, way direction), 256 / 512 no parking right / left; OSM `width` / `maxheight` (dm, 0 unknown); `placement`, `bridge:structure` / `bridge:name` (string indices, −1 none) |
| `parking` | (districts, 2026-11-08, optional) rows `[roadIndex, rightLocation, rightOrientation, leftLocation, leftOrientation]`; the last four values are string indices (`−1` absent), preserving OSM `parking:{side}` / `parking:{side}:orientation` and older `parking:lane:{side}` / `:{orientation}` tags. Sides follow the output road direction (swapped for `oneway=-1`). Location such as `lane`, `street_side` or `on_kerb` does not imply sidewalk parking. Missing tags remain unknown; `roadInfo` stride is unchanged. |
| `treeCoverage` | (districts, 2026-11-08, optional) `[south, west, north, east]` lat/lon rectangle measured by the aerial canopy survey. Inferred street, park and garden trees should be suppressed only inside this measured coverage, not throughout any district that happens to contain OSM/aerial trees. |
| `buildingIds` | (districts, 2026-11-08, optional) source OSM `w<id>` / `r<id>` parallel to `buildings`, for exact source matching in development audits. An empty string means an aggregate shape without one source identity. |
| `buildingHoles` | (2026-11-08, optional) sparse object `{buildingIndex: [holeDelta, …]}` for mapped multipolygon courtyards. Each hole is a headerless delta ring in the same absolute decimetre coordinate system as its building's outer ring, without a repeated closing point. Missing entries mean no holes. Courtyards exclude building walls, roofs, collisions and point containment; tree and POI filtering uses the remaining building footprint. Stadiums retain their existing annular stand sectors. |
| `buildingCoveredBy` | (2026-11-08, optional) sparse object `{baseBuildingIndex: coveringPartIndex}` for a unique mapped ground-based building part covering the base's entire footprint and height. Both records and source IDs remain intact for audits. The builder requires exact source and prepared outer/hole equality up to rotation/reversal, tagged part height/levels covering the base, zero minimum height and no ambiguous matches. Runtime validates the relation, renders the part once and redirects source-building associations; partial or elevated parts are excluded. |
| `buildingDimensions` / `buildingFootprints` | Optional sparse records keyed by building index: `[heightM,minHeightM]` preserves precise source metres, and `[[x,z],…]` preserves the prepared footprint where decimetre encoding loses thin structural strips. Absent values use the legacy building row. |
| `buildingAssemblies` | Optional records keyed by aggregate index: `mode: parts` reconstructs the complete aggregate from uniquely associated source parts; `mode: union` retains its residual body. Source identities, raw/prepared coverage and raw outside area remain auditable, with separately described residual dimensions and baked surfaces. Source rows are retained; associations resolve to the suitable ground part/body. |
| `buildingUnions` / `buildingGeometryPoints` | Optional validated physical-surface cache: `{sources:[{i,signature}],surfaces:[{i,neighbours,surface}]}` indexes lossless mesh coordinates in `buildingGeometryPoints`. This removes coincident surfaces, not source records or parent identities. Invalid caches preserve source bodies and expose rejection reasons in runtime stats. |
| `district.geometry` | (2026-11-08, optional) `{pieces:[{r,pts:[[x,z],…]}],circles:[{x,z,r}],polys:[[[x,z],…]]}` in game metres. The exact union of buffered polylines, circles and polygons defines the playable boundary and its 600 m scenery ring. This differs from the looser driving-mask cells used to position closures. |
| `buildingInfo` | (districts, 2026-11-07) one 5-tuple per building, same order as `buildings`: `[type, startYear, architect, material, hSrc, …]` — OSM `building` value / `architect` / `building:material` as string indices (−1 none), `start_date` year (0 unknown), height source 0 OSM, 1 research, 2 default estimate, 3 re-estimated by the height-sanity pass |
| `treeInfo` | (districts, 2026-11-07) one triple per tree, same order as `trees`: `[taxon, circumferenceCm, leaf, …]` — `taxon` = string index of the OSM `species` / `taxon` / `species:en` / `genus` text (most specific first, −1 none), circumference in cm (0 unknown; OSM metres converted), `leaf` bits: 1 broadleaved, 2 needleleaved, 4 deciduous, 8 evergreen, 16 generated from a `tree_row` (7 m spacing), 32 measured on aerial imagery (`tools/aerial/trees.py` crowns, height from the crown radius; 2026-11-08) |
| `furniture` | `[kind, x, z, …]` — kinds in `furnKinds` (bench, waste_basket, bollard, post_box, bicycle_parking, drinking_water, fountain, fire_hydrant, recycling, telephone, vending_machine, picnic_table, advertising); none on a carriageway |
| `backdrop` | `[x, z, w, d, h, angleDeg, …]` (dm, degrees) — low-poly building masses beyond the corridors (one box per 40 m cell) so the horizon is not empty |
| `corridor` | `{areaKm2, legs: [[label, km], …]}` — the routes the map was cut to (see `tools/osm/corridors.mjs`) |

### Corridors (since v2)

The maps only contain what the story drives: travel-time routes on the drivable graph between the CV stops in
story order (+ the centre / north loops in Bucharest, the SR-520 alternative and a downtown loop in Seattle),
buffered by 300 m (450 m around stops and landmarks, 600 m in the historic centre of Bucharest). Roads, buildings,
POIs, lamps, trees and furniture outside are dropped; parks / water may extend 600 m further for scenery.


Optional `buildingCanopies` is an object keyed by building index. It marks only an explicitly reviewed open roof, keeping the corresponding `buildingIds` identity and complete mapped footprint. `topM` and `clearanceM` agree with that building's height/minHeight band; `classificationSource`, `evidence`, `topSource`, `clearanceSource`, `supportSource` and `dimensionNote` record provenance. Values marked `estimate` are authoring choices, not OSM metre tags. `estimateSupports` optionally adds narrow estimated supports only where their full footprints clear roads and neighbouring buildings; `supportWidthM` is their width. Runtime draws the source roof slab and colliding supports, keeps the roof band collidable, and omits the guessed fuel-canopy/pump template for that source record. Neither `amenity=fuel` nor OSM `layer` alone enables this field. OSM positive height/minimum tags take precedence over estimated dimensions.

Optional `buildingSourceIssues` maps building indices to source anomalies such as a nonpositive OSM height. A nonpositive height is not treated as a valid measured dimension; its fallback remains an estimate. Positive literal heights, including structures below 2.5m, are retained.
