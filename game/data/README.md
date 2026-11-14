# game/data

The single reference for the district data format. Data © OpenStreetMap contributors (ODbL).

| file | what |
|---|---|
| `<city>-<district>.bin.gz` | one 1:1 chapter district: `bucharest-{grozavesti,unirii,romana,floreasca,pipera,otopeni}`, `seattle-{seatac,bellevue}` (≤ 3 MiB each, spec 10) |
| `places.json` | reachable places per district for the world map / minimap, written by `tools/osm/places.mjs` (format below) |
| `dialogue.json` | city crowd lines `{p, ctx, text, orig?, lang?, when?, wx?, season?}` and culture tips (`game-foot.js`, `spots/index.js`) |
| `landmarks/` | generated exact source massing of Bucharest landmarks (`bucharest-source-masses.json`, `cec-source-masses.json`), read by `game/src/landmarks/source-data.js` |
| `spots/` | tourist-spot data (`<spot>.json`) and the Seattle context assets (below) |

## District packs

A pack is a lossless binary encoding of the district JSON. `game/src/district-pack.js` decodes it to exactly the object
`JSON.parse` gave (same keys and order, same strings, bit-identical numbers). The only difference: cache signatures of 64
characters or more (`signature` / `authoritySignature`) are stored as a 53-bit hash `h1:…` and compared with
`signatureMatches`.

- Game: `buildWorld(city, renderer, { district })` loads the pack of a district in `game/src/cities.js`.
- Node: `readDistrictData` / `writeDistrictData` / `resolveDistrictFile` in `tools/osm/district-data.mjs`.
- Convert: `node tools/osm/pack-district.mjs FILE.json [--replace]` (pack; `--replace` deletes the JSON once verified) and
  `node tools/osm/pack-district.mjs --unpack FILE.bin.gz [OUT.json]`. Tools that read or append to the JSON text
  (`add-tram-source-metadata.mjs`, `add-footbridges.mjs`, `graft-roads.cjs`, `road-source-audit.mjs`,
  `tram-source-audit.py`) need an unpacked copy.
- Build and edit tools: `tools/osm/README.md`. Do not edit packs by hand.

## District definition (`game/src/cities.js`)

`CITIES[city].districts[id]`: `name`, `label`, `center {lat, lon}` (projection anchor), `bbox [minLat, minLon, maxLat, maxLon]`,
and the playable area as any union of `poly [[lat, lon], …]`, `bands [{r, line: [[lat, lon], …], chapter}]` (r metres either
side of a line), `circles [{lat, lon, r, name}]` and `route` waypoints (buffered by `rRoute`); a bbox alone is the area when
none of these is given. `outerRing` (default 600 m) is the scenery ring around it. `landmarks` lists the landmark ids built
in the district; `scenery` the subset that is background only (no marker, label or route). `congestion` lists traffic
hotspots. `tools/osm/corridors.mjs` computes the exact area from these shapes.

## Conventions

- Coordinates are integers in decimetres (`q` = 10 units per metre) in game space: x = east, z = south, origin at the
  district `center`. Fields named `…M` or holding `[[x, z], …]` point lists are in metres.
- *delta* arrays are `[x0, z0, dx1, dz1, …]` (each point relative to the previous).
- String fields are indices into `strings` (−1 = none).
- Sparse objects are keyed by row index (`{"12": …}`); a missing key means "no record".
- OSM identities are `w<id>` / `r<id>` (or `node/…`, `way/…`, `relation/…` in POI records). Row indices belong to one
  pack; join across rebuilds by OSM identity and full geometry, never by index.
- Source tags and dimensions win over estimates. Fields with `…Source`, `evidence`, `dimensionNote` record provenance;
  values marked `estimate` are authoring choices, not OSM tags.

## Core

| key | content |
|---|---|
| `version`, `city`, `generated`, `attribution` | version 2; city id; build date |
| `proj` | `{lat0, lon0, scale, mPerLat, mPerLon, compress}`; x = (lon − lon0)·mPerLon·scale, z = −(lat − lat0)·mPerLat·scale. Districts: scale 1, `compress` null |
| `bounds` | `[minX, minZ, maxX, maxZ]` of the road graph |
| `classes`, `styles`, `roofs`, `poiKinds`, `areaKinds`, `lineKinds`, `furnKinds` | lookup tables for the indices below. Roofs: flat, pyramid, gabled, dome, hipped, skillion, mansard. Append new kinds at the end so old indices stay valid |
| `district` | `{id, name, bbox, areaKm2, geometry, polys, ends, sourceReturns?, mask}` (below) |
| `corridor` | `{areaKm2, legs}`: playable-area size from `corridors.mjs` (`legs` is empty) |
| `backdrop` | `[x, z, w, d, h, angleDeg, …]` low-poly boxes (one per 40 m cell) beyond the scenery ring |
| `brands` | `{brand: [bg, fg, accent, logoText?]}` sign colours from research |

`district`:

- `geometry`: `{pieces: [{r, pts: [[x, z], …]}], circles: [{x, z, r}], polys: [[[x, z], …]]}` in metres. The exact union of
  buffered polylines, circles and polygons is the playable boundary; the scenery ring is measured from it.
- `mask`: `{x0, z0, cell, w, h, rle}` inside mask on 20 m cells; `rle` run lengths alternate outside / inside, starting
  outside. Looser than `geometry`; used to place closures and by `places.mjs`.
- `ends`: node index of every road cut at the boundary.
- `sourceReturns` (optional): reviewed finite source-road legs outside the area `{schema, envelope, evidence, corridors,
  restrictions}` (directed `{sourceId, from, to, fromXZ, toXZ}` legs, turn checks, restriction compliance records). Read by
  `motor-turn-restrictions.js`; they never join sources, reverse travel or route through the virtual outside.

## Roads

| key | content |
|---|---|
| `nodes` | road graph nodes `[x0, z0, x1, z1, …]` (absolute dm) |
| `nodeFlags` | `[nodeIndex, flags, …]`: 1 traffic signals, 2 crossing, 4 zebra / marked, 8 signalised crossing, 16 stop, 32 give way, 64 bus stop, 128 tram stop, 256 speed camera, 512 mini roundabout, 1024 red-light camera |
| `roads` | `[name, class, lanesF, lanesB, median_dm, laneW_dm, sidewalk_dm, maxspeed_kmh, flags, layer, node…]`. One-way roads (`lanesB` 0) list nodes in travel order and have a negative median (−lanesF·laneW) so lane centres `median/2 + laneW·(i + 0.5)` sit on the way. Flags: 1 oneway, 2 bridge, 4 tunnel, 8 roundabout, 16 bus lane, 32 tram, 64 toll, 128 unpaved / cobbles, 256 tram in the median, 512 painted bike lane, 1024 cycle track, 2048 lit, 4096 lit=no |
| `roadInfo` | 6 per road: `[osmLayer, flags, widthDm, maxheightDm, placement, bridgeStructure]`. Raw OSM `layer` (`roads` keeps the adjusted one); flags 1 covered, 2 tunnel=building_passage, 4 bridge, 8 `level` tagged, 16 `*_link`, 32 `layer` tagged, 64 / 128 kerbside parking right / left, 256 / 512 no parking right / left; OSM `width` / `maxheight` (0 unknown); `placement` and `bridge:structure` / `bridge:name` as strings |
| `turnLanes` | `[roadIndex, forward, backward, …]`: OSM `turn:lanes` strings (`left\|through;right`) for painted arrows |
| `parking` | optional rows `[roadIndex, rightLocation, rightOrientation, leftLocation, leftOrientation]` (strings) from `parking:{side}[:orientation]` / `parking:lane:*`; sides follow the output road direction. Location `lane` / `street_side` / `on_kerb` does not imply sidewalk parking |
| `rampLimits` | `[roadIndex, legalKmh, …]`: US ramps without a posted limit (`maxspeed` holds the advisory). Written by the build; no runtime reader |
| `scenery` | `[carriagewayWidthDm, sidewalkDm, class, flags, delta…]` per street piece of the scenery ring and inside pieces off the drivable network; flags 1 bridge, 2 inside fragment. Drawn as asphalt and sidewalks, no traffic |

Source road detail (districts declare `roadGeometryPolicy: "source"`; runtime uses the precise metre values):

| key | content |
|---|---|
| `roadNodePositions` | `[x, z, …]` lossless metres parallel to `nodes` |
| `roadNodeIds` | OSM node id per node (negative = boundary cut) |
| `roadSourceGeometry` | `{roadIndex: {sourceId, nodeIds, wgs84, projected, tags, …}}` full original way and its prepared node ids |
| `scenerySourceGeometry` | same per `scenery` piece |
| `roadAccess` / `sceneryAccess` | `{index: {sourceId, publicDrive, throughAccess, key, value, reason, conditionalUnresolved, tags}}`. Motorcar permission follows `motorcar > motor_vehicle > vehicle > access`. `publicDrive: false` keeps the physical road but excludes it from the SCC, navigator, traffic and map closures; `destination` / `customers` allow only a selected endpoint. HOV, reversible and unevaluated conditional access stay excluded |
| `roadWidths` | `{roadIndex: {sourceId, widthM, medianM, laneWidthM, leftM?, rightM?, source, widthSource, rawWidth?, review?, issues?, definition}}`: precise total width (incl. median). Priority: OSM `width`, then a research `road_widths` review. `leftM` / `rightM` are measured either side of the source centreline (swapped for `oneway=-1`); runtime edges get `wL` / `wR` and `laneCenterShiftM`. A literal `placement` wins over a review |
| `sharedLanes` | `{roadIndex: {widthM, sourceId, widthSource, evidence, classificationSource}}`: an OSM `lanes=1` two-way road with one physical lane. Graph keeps both directions on the centreline, no dividing line; `laneW` in `roads` is half the width |
| `roadRestrictions` / `roadRestrictionCoverage` | raw OSM turn-restriction relations `[{sourceId, tags, members}]` and their source ledger (files, hashes, counts, missing core ways / nodes). Read by `motor-turn-restrictions.js` |
| `roadSourceNodeTags` / `roadSourceNodeTagCoverage` | literal `ele` / `incline` / `level` strings per OSM node id, plus inspected keys, node count and missing nodes. Read by the bridge-profile code; no height is inferred from them |

## Buildings

| key | content |
|---|---|
| `buildings` | `[style, height_dm, minHeight_dm, roof, name, flags, levels, colour, roofColour, ring delta…]`. `levels` = `building:levels` (0 unknown); `colour` / `roofColour` = `#rrggbb` string from colour / material tags. Flags: 1 ground-floor shops, 2 has a sign (`name` = sign text), 4 landmark-ish, 8 sign is a brand, 16 roof shape measured (OSM or aerial survey), 32 scenery ring (no shops / signs / clutter), 64 large named building its own service lanes run into (not shrunk away) |
| `buildingInfo` | 5 per building: `[type, startYear, architect, material, hSrc]`; `building` value, `architect`, `building:material` as strings, `start_date` year (0 unknown); hSrc 0 OSM, 1 research, 2 default estimate, 3 re-estimated by the height-sanity pass |
| `buildingIds` | OSM `w…` / `r…` per building ("" for an aggregate). A relation can own several outers |
| `buildingSourceTags` | `{sourceId: {all raw tags}}` retained raw OSM tags; the renderer uses them for car parks, worship towers, lodging signs and literal colours |
| `buildingGeometryPolicy` | `"source"`: footprints are kept whole at source precision, no road-clearance shrinking |
| `buildingFootprints` | `{index: [[x, z], …]}` precise outer ring (0.0001 m) |
| `buildingHoleFootprints` | `{index: [[[x, z], …], …]}` precise courtyard rings |
| `buildingHoles` | `{index: [holeDelta, …]}` courtyards in dm (headerless delta rings, no closing point). Courtyards are excluded from walls, roofs, collision and point tests |
| `buildingDimensions` | `{index: [heightM, minHeightM]}` source metres beyond dm precision |
| `buildingCoveredBy` | `{baseIndex: partIndex}`: a ground part exactly covering the base footprint and height; the part is rendered once |
| `buildingAssemblies` | `{index: {mode: "parts" \| "union", parts, residualHeightM, residualHeightSource, sourceCoverage, preparedCoverage, geometry}}`: an aggregate rebuilt from its source parts, or its residual body |
| `buildingUnions` / `buildingGeometryPoints` | physical-surface cache `{version: 2, sources: [{i, signature, authoritySignature}], surfaces: [{i, neighbours, surface}]}` with a shared lossless point table; removes coincident walls between touching solids. An invalid cache falls back to the source bodies |
| `buildingRoofProfiles` | `{index: {version, shape, totalM, eavesM, riseM, heightSource, riseSource, axis, low, high, raw, issues?}}` roof geometry per building |
| `buildingRoofSurfaces` / `buildingRoofGeometryPoints` | cached roof meshes `{index: {sources: [{i, signature}], …}}` with a shared `[x, y, z]` point table; validated by signature, else meshed at load |
| `buildingCanopies` | `{index: {topM, clearanceM, estimateSupports, supportWidthM, evidence, dimensionNote, …Source}}`: a reviewed open roof (fuel canopy, entrance cover). Draws the roof slab and supports instead of a fuel-canopy template; `amenity=fuel` or `layer` alone never creates one |
| `buildingPassages` | `{index: [{sourceRoadId, sourceSegment, sourceNodeIds, roadIndices, ring, widthM, clearanceM, …Source, tags, mouthGeometry, evidence}]}`: openings from `tunnel=building_passage` ways (or a reviewed shared-wall passage). Untagged clearance is an explicit 3.1 m estimate. Runtime cuts only that low void |
| `buildingPassageIssues` | rejected passages, e.g. `reason: "absolute-passage-base-unknown"` for a nonzero level / layer (no fabricated ground void) |
| `buildingAircraft` | `{index: {…Source, dimensionNote}}`: `historic` / `aeroway=aircraft` exhibits mapped as buildings, drawn as wing, fuselage and fin |
| `buildingOwnTags` | `{sourceId: {name, tourism?, brand?, 'addr:street'?}}`: the building's own name where its sign went to a tenant POI; the building is signed with it, the tenant keeps its fascia |
| `vacant` | `[x, z, buildingIndex, …]` closed shop units from research (`businesses-gamediff.json`), drawn with a to-let board |
| `reviewedCoveredRoads` | reviewed covered-street records (source road / cover ids, raw tags, ground joins, estimated clearance), validated at load by `covered-road-models.js` and `source-canopy-road-models.js` |

District `buildings` include every whole source footprint whose solid geometry (edges, holes) intersects the core or the
scenery ring; a large one may extend past it. An authored landmark replaces only the OSM identities in its registry
`sourceIds` (`world.stats.landmarkSourceReplacements`); its builder gets those footprints as `ctx.sourceBuildings[sourceId]`
(precise rings in the landmark frame with height, roof and colour fields).

## Trees, ground, areas, lines

| key | content |
|---|---|
| `trees` | `[x, z, t, …]`, `t = height_dm·2 + conifer` (height 0 unknown): OSM trees, `tree_row` samples (7 m) and aerial crowns |
| `treeInfo` | 3 per tree: `[taxon, circumferenceCm, leaf]`; taxon string (species → genus, −1 none), circumference (0 unknown), leaf bits 1 broadleaved, 2 needleleaved, 4 deciduous, 8 evergreen, 16 from a `tree_row`, 32 measured on aerial imagery |
| `treeCrownRadii` | parallel to `trees`: measured crown radius dm (0 unknown) |
| `treeRetention` | `{policy, inputCrowns, retained, rejectedGeometryOrDuplicate, outsideSurveyDistrict, thinned}` accounting of the aerial crowns (`policy: "all-measured"` = no thinning) |
| `treeCoverage` | `[south, west, north, east]` area the aerial canopy survey measured; inferred street / park trees are suppressed only inside it |
| `streetTrees` | `{street name: [species keys]}` from the research dossier; `[]` = researched as treeless |
| `green` | `{x0, z0, cx, cz, w, h, rle}` green ground measured on aerial imagery (cells `cx` × `cz` m); `rle` per row: off, on, …, −1 at row end |
| `areas` | `[kind, name, outer delta, hole delta, …]`. Kinds include `track`, `clay`, `turf`, `hard`, `pool`, `yard` (sports and school grounds get markings, goals, fences) |
| `areaSourceIds` | OSM identity per area row (one relation can own several rows) |
| `areaSourceTags` | `{sourceId: {water?, natural?, waterway?, amenity?, fountain?, tourism?, man_made?, sport?}}` literal tags. `water=lake\|pond\|reservoir` stops the channel estimate; `amenity=fountain` gets a stone coping |
| `parkingFootprints` | `{areaIndex: [ring, …]}` precise metre rings of parking areas |
| `parkingLayouts` | `{areaIndex: {sourceId, rowBearingDeg, stallBearingDeg, confidence, coverage, evidence}}` stall rows measured on aerial imagery (`game/research/parking-layouts-*.json`) |
| `lines` | `[kind, width_dm, name, delta]` runways, taxiways, rivers |
| `lineSources` | parallel to `lines`: `{sourceId, tags, nodeIds, points, widthM, …}`; runtime prefers these points and positive widths |
| `lamps` | `[x, z, height_dm, …]` OSM street lamps (0 = unknown height) |
| `furniture` | `[kind, x, z, …]`, kinds in `furnKinds` (bench, waste basket, bollard, post box, bicycle parking, drinking water, fountain, hydrant, recycling, telephone, vending machine, picnic table, advertising); never on a carriageway |
| `places` | `[name, x, z, rank]` (0 city, 1 suburb, 2 quarter, 3 neighbourhood) |

## Trams and rail

| key | content |
|---|---|
| `trams` | tram track centre lines (delta) |
| `tramSources` | parallel to `trams`: `{sourceId, nodeIds, tags}` per rendered run |
| `tramSourceWays` | complete selected source ways `{sourceId, nodeIds, tags, points}` (`points: null` + `missingNodeIds` when coordinates are missing) |
| `tramRoutes` | OSM tram route relations `{sourceId, tags, members: [{type, ref, role}], missingWayIds?}` |
| `tramSourceNodeTags` | `{nodeId: {raw tags}}` signals, crossings, stops on those ways |
| `tramSourceCrossings` | footway crossings `{sourceId, nodeIds, tags, points, nodeTags, railNodeIds, roadIncidences: [{nodeId, sourceId}]}` |
| `railways` | `[{id, nodeIds, tags, points}]` rail / disused / abandoned ways touching the scenery ring. Ground rail with a numeric gauge is drawn; a bridge with `min_height` is a viaduct (`elevated-sources.js`); other bridges / tunnels stay unresolved |

Rail connectivity uses identical OSM node ids only; layer numbers are not metres and no direction or grade is invented.
The tram fields come from the build or from `tools/osm/add-tram-source-metadata.mjs` (append-only; Grozăvești, Pipera,
Romană and Unirii have trams). Pedestrian footbridges live in `game/src/footbridge-sources.js`, not in the pack
(`tools/osm/add-footbridges.mjs`).

## POIs and transit

| key | content |
|---|---|
| `pois` | `[kind, x, z, name, brand, sub, buildingIndex]`; `sub` = OSM value (e.g. `fast_food:burger`). Rows may lie up to 100 m outside the playable edge and point at a scenery-ring building. Classes without their own kind reuse one with the OSM value in `sub` (nightclub → food; gallery, fitness centre, craft → shop; kindergarten → school; any `office=*` → office) |
| `poiSources` | `{poiIndex: 'node/…' \| 'way/…' \| 'relation/…'}` OSM identity per row |
| `poiSignAnchors` | `{poiIndex: [x, z, how, source]}` where the sign goes: `entrance` (OSM entrance node, `source` = node id) or `street` (the footprint face on the POI's `addr:street`) |
| `publicTransportSources` | optional `{schema: 1, poiSources, platforms, stopAreas, coverage}`: literal platform / stop-area features (`sourceId`, `nodeIds`, `points`, `tags`) keyed by POI index, read by `source-transit-shelter.js`. `stop_position` belongs to the vehicle, not a shelter |

## Provenance records

Written by the build or the append tools for audits; no runtime reader: `buildingSourceSkips` (invalid / unclosed source
geometry and why), `buildingRoadConflicts` (footprints kept despite an inferred road envelope), `buildingSourceIssues`
(e.g. a nonpositive OSM height, an unsupported canopy review), `parkingLayoutAudit`, and one `{schema: 1, runs: [{tool,
date, …counts}]}` record per append tool: `poiAppend` (`add-pois.mjs`), `poiFix` (`fix-pois.mjs`, incl. the
`[poiIndex, buildingSourceId]` links it set), `areaAppend` (`add-areas.mjs`), `areaTagAppend` (`add-area-tags.mjs`),
`buildingFix` (`fix-buildings.mjs`), `roadAppend` (`add-roads.mjs`).

No tool in `tools/osm` writes `roadRestrictions(+Coverage)`, `roadSourceNodeTags(+Coverage)`, `publicTransportSources`,
`reviewedCoveredRoads` or `district.sourceReturns`: a rebuild from tiles drops them, so carry them over (or graft roads
with `graft-roads.cjs`).

## Research inputs read by the build

From `game/research/` (OSM tags always win):

- `<city>-<district>.json` dossier: per-building `research: {height_m, storeys, facade_hex, roof}` and `open_canopy`
  (`evidence`, `topM > clearanceM > 0`, `dimensionNote`), `building_passages` (reviewed shared-wall passages),
  `road_widths` (`{sourceRoadId, widthM, source, uncertaintyM, evidence, measurement?, leftM?, rightM?}`; a
  `physicalSingleLane` review needs aerial calipers and no raw width / lane tags), street tree notes, brand colours.
- `roofs-…json`: `roofs: {wayId: [shape, confidence, colour, areaM2]}` plus optional `colourMeasurements[wayId]` (colour applied
  at confidence ≥ 0.65). `trees-…json` (crowns, optional `_coverage`, `_retention: "all-measured"`), `green-…json`.
  See `tools/aerial/README.md`.
- `businesses-<city>-<district>.json`, `businesses-gamediff.json` (stale / closed businesses), `parking-layouts-…json`.

## places.json

`{generated, legend: [{cat, label, icon, color}], districts: {"<city>-<district>": {city, district, scenery, notReachable,
counts, places}}}`. `places` maps each category (`cv`, `landmark`, `spot`, `fuel`, `business`, `park`, `transit`) to
`[{id?, name, lat, lon, x, z, nx, nz, …}]`: `x` / `z` in district metres, `nx` / `nz` the nearest street point reachable
from the chapter start (the route target), `walk` metres on foot where `tools/osm/places-navfix.json` moved it; extra keys
per category (`chapter`, `stop`, `brand`, `kind`, `sub`, `mode`). Only places inside the playable area beside a reachable
street are listed. Regenerate with `node tools/osm/places.mjs` after a build, POI append or landmark change.

## Spots

`spots/<spot>.json` holds tourist-spot data (see `game/src/spots/`). Seattle context: `spots/seattle-context.json.gz`
(indexed source records and original elevations), `spots/seattle-context-render.bin.gz` (lossless geometry: 16-byte
header, UTF-8 JSON metadata block, aligned little-endian typed arrays) and `spots/seattle-context-manifest.json`; data
and consumer hashes reject stale caches.
