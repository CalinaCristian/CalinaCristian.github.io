# OSM → game data

The Bucharest and Seattle→Bellevue worlds of *Drive My CV* (`game/`) are built from real
OpenStreetMap data. This folder holds the offline tools that turn raw OSM XML into the compact
JSON the game loads at runtime (`game/data/bucharest.json`, `game/data/seattle.json`).
The game itself has no build step and no dependencies; these tools only need Node ≥ 18 and `curl`.

## Re-running

```bash
# 1. download the raw tiles (OSM API 0.6 `map` calls, ~550 MB, resumable; be gentle with the API)
node tools/osm/fetch-tiles.mjs --out /some/dir/tiles

# limit the existing region grid to tiles intersecting a district and its scenery ring
node tools/osm/fetch-tiles.mjs --out /some/dir/tiles --only buc --bbox 44.4327,26.0722,44.4642,26.1112

# 2. build both cities (≈40 s). Writes game/data/*.json
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles
#    or a single city
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles --city seattle
```

Chapter districts (real 1:1 scale, `game/data/<city>-<district>.json`, a few seconds each):

```bash
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles --districts                 # all 8
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles --districts --district romana,bellevue
```

District mode (`districtSetup` in `build-data.mjs`) takes the district from `game/src/cities.js`: projection anchored at its
`center`, scale 1, no compression; `bbox` / `poly` areas keep every road, building, POI inside; `route` + `circles` districts
(otopeni, seatac, bellevue) keep a buffered drive (`corridors.mjs`, now also with `polys`). Roads are cut exactly at the
boundary (a new end node, listed in `district.ends`), only tiles near the district are parsed, tall `building:part`s are kept,
and `game/research/<city>-<district>.json` (if present) enriches building tags and brand sign colours (a building's hand-researched
`research: {height_m, storeys, facade_hex, roof}` beats the generic estimates; OSM tags always win). Link roads whose every lane is
HOV-designated (e.g. Bellevue's NE 6th St direct-access ramps) are dropped. Tiles: region `bucx` (east of Pipera) was added on
2026-11-07 for the `pipera` district; fetch it with `node tools/osm/fetch-tiles.mjs --out DIR --only bucx`.

Regions (bounding boxes) are listed in `fetch-tiles.mjs` (`REGIONS`). Tile files are named
`<region>_<minlat>_<minlon>_<maxlat>_<maxlon>.xml`; `build-data.mjs` picks the tiles of a city by
filename prefix (`buc_`, `dn1_`, `bucx_` for Bucharest, `sea_` for Seattle). Overlapping tiles are
deduplicated by OSM id. Large water / park multipolygons that are cut by the tiles (e.g. Lake
Washington) are completed with `/api/0.6/relation/<id>/full`, cached in `tools/osm/cache/`.

## Files

| file | what |
|---|---|
| `fetch-tiles.mjs` | downloads the tiles (splits a tile in four when the API refuses it) |
| `parse-osm.mjs` | tiny dependency-free OSM XML parser |
| `geom.mjs` | polygon / polyline helpers (Douglas–Peucker, ring assembly, spatial grid) |
| `corridors.mjs` | the story corridors: shortest travel-time routes between the CV stops + loops, buffered into a 10 m margin raster |
| `build-data.mjs` | the converter; the JSON schema is documented at the top of the file and in `game/data/README.md` |

## What the converter does

* **Corridors** (`corridors.mjs`, config in `build-data.mjs` `corridorConfig()`): the map is cut to the routes the story
  drives — Bucharest: spawn (Splaiul Independenței at Grozăvești) → rosetti → upb → gts → luxoft → db → arnia →
  uipath-buc → DN1 Băneasa → Otopeni, plus a closed centre loop (Victoriei – Romană – Universitate – Unirii – Calea
  Victoriei) and a north loop (Kiseleff – Arcul de Triumf – Casa Presei – Aviatorilor); Seattle: SeaTac departures →
  SR-518 → I-5 → I-90 floating bridge → I-405 → UiPath Bellevue, the SR-520 alternative and a downtown loop. Routes are
  directed travel-time Dijkstra on the OSM graph (waypoints snap to a named road with an optional bearing so one-way
  carriageways are picked the right way). Buffers: 300 m, 450 m around stops / landmarks (landmarks off the corridor
  get a short spur route), 600 m in the historic centre. Everything outside is dropped (roads are clipped and only
  the pieces connected to the routes are kept); building masses 70–1700 m beyond become a low-poly `backdrop`.

* **Projection** – metres, x = east, z = south. Bucharest ×0.7 around Piața Unirii (play-tested: 1:1
  trips were too long), latitudes north of 44.497 (DN1 → Otopeni) additionally compressed ×0.35. Seattle ×0.5 around SeaTac. Parameters are written
  to the JSON header and mirrored by `game/src/cities.js` `projector()`.
* **Roads** – drivable `highway=*` ways (motorway … living_street), lane counts (`lanes`,
  `lanes:forward/backward`, sensible defaults), one-way (incl. roundabouts, `oneway=-1` reversed),
  max speed (km/h; mph converted), bridges/tunnels/layers, bus lanes, tolls, trams. Polylines are
  simplified (0.35 m) keeping junctions and tagged nodes (signals, crossings, stops…). Parallel
  carriageways that would overlap at the drawn lane widths (dual carriageways, a street beside an underpass /
  overpass ramp) are pushed apart (3 passes, long segments densified, tapering to zero at shared junctions).
  Dev checks (printed as `dev-check:`): dead ends that stop < 12 m short of another road on the same
  layer are connected, dead-end stubs < 15 m are dropped, and any building whose footprint covers a
  road ribbon is removed.
* **Buildings** – footprints (ways + multipolygon outers and their mapped courtyard holes), simplified (outer ≥1 m, ≤40 vertices), within
  250 m of the road network, shrunk away from the road ribbons, with height (tags or defaults),
  facade style (by tags, district and street: civic / interwar / eclectic / bloc / glass / house /
  shop / plain / church) and roof shape. Seattle footprints are drawn at 0.7 of real size around
  their (half-scale) position, the Bucharest DN1 strip at 0.75 × 0.45, then de-overlapped. Optional sparse `buildingHoles`
  stores headerless delta rings by final building index (same decimetre coordinates as the outer). Inner rings are associated
  with their containing outer, retained during clearance corrections, and excluded from building/tree/POI point containment.
  The building audit reports multipolygon identity and courtyard preservation separately from its existing way-only metrics.
  Small unnamed `building:part=yes` components without a building/use type or any roof tags use a plain flat fallback
  instead of independent-house roof heuristics. Their explicit height, minimum height and colour remain authoritative;
  sub-metre strips use a smaller simplification tolerance to retain their width. Named, typed and roof-tagged parts keep
  their existing treatment, and no minimum height is inferred for an untagged component.
  Optional sparse `buildingCoveredBy` identifies a unique full-height ground-based mapped part whose source and prepared
  footprint (including holes) exactly equals a base building up to ring rotation/reversal. Both source records stay in the
  data; runtime can suppress the coincident base facade. Partial/elevated parts and ambiguous matches are excluded.
* **Street lamps** – `highway=street_lamp` nodes (+ `height`); roads carry `lit=yes/no` and bike lanes / tracks as flags.
* **Trees / furniture** – `natural=tree` (+ `tree_row`), benches, bins, bollards, post boxes, hydrants … (off the carriageway).
* **POIs** – fuel, food, shops, banks, pharmacies, hospitals, schools, metro, bus/tram stops,
  hotels, landmarks, airports; brand/name attached to the building they sit in (→ facade signs).
* **Areas / lines / places** – water (incl. Puget Sound from coastline ways), parks, forests,
  landuse, parking lots, aprons, runways, rivers; `place=*` names for map labels.

Data © OpenStreetMap contributors, ODbL.

## District reality data (2026-11-08)

District builds also read the aerial measurements in `game/research/` (see `tools/aerial/README.md`):
`roofs-<city>-<district>.json` (roof shape / colour per OSM way, and the villa vs block defaults in the villa quarter),
`trees-…` (tree crowns → `data.trees`) and `green-…` (gardens / lawns → `data.green`). Every real footprint up to
`district.outerRing` m (default 600) outside the playable area is a full building (flag 32, no shops / signs), with its
streets as `data.scenery`; the boxes of `backdrop` only start beyond. `DEBUG_DROPS=<file.json>` lists every footprint inside
the area the build did not keep and why (`far`, `simplify`, `road-clearance`, `tiny`, `overlap`). Address-like names
("Georges Bizet 10"), block numbers and residential names no longer become shop signs. OSM `parking:*` tags reach
world.js through `roadInfo` permission bits and optional `parking` location/orientation rows; mapped diagonal street-side bays
are not interchangeable with parallel sidewalk parking. New builds retain source `buildingIds` and exact district geometry
for the independent footprint/height auditor, and keep buildings throughout that geometry, including campuses beyond the
drivable-road buffer. The legacy corridor network-distance filter does not apply inside an explicitly selected district.
Check the result street by street against Street View:
`node game/dev/harness/viewpoints.js --district=<id> --walk --streetview` (`game/dev/harness/README.md`).


Explicit open roofs may be declared in a district building's `research.open_canopy` with nonempty `evidence`, numeric `topM > clearanceM > 0`, and a `dimensionNote`. This is a reviewed structural classification, not a rule for every fuel station. OSM dimensions still win. The builder emits `buildingCanopies`, retains the full roof outline/source ID, and exempts only its ground service lane from the late overlap deletion where the declared roof clearance is at least3m. Estimated dimensions/supports remain labelled estimates. Invalid nonpositive OSM heights are retained as `buildingSourceIssues`; valid positive heights are never raised to the default2.5m minimum.

`building-geometry-check.mjs --data=<district.json> --osm=<tile-directory>` also assembles multipolygon relation outer rings, associates each repeated relation identity with its corresponding prepared outer, and verifies literal positive heights/minima, canopy collision bands and explicit source anomalies. A relation may have several independent outer buildings; it is not a way-node list.


District building admission and `building-audit.py` use the complete source footprint against the analytic core and600m ring, including polygon edges and mapped holes. Exact segment-to-segment, circle-to-solid and polygon overlap distances replace centroid-only admission. Every intersecting footprint is retained whole; its source centre may lie beyond600m. A source core inside an open courtyard does not by itself intersect the building. The auditor retains `centroidMargin` alongside the new solid-footprint `margin`, so historical centroid totals remain distinguishable. Read-only Floreasca/Romană fixtures and crossing/containment/courtyard cases verify that this extends valid coverage.

The current canopy emitter supports flat open roofs. An explicit non-flat OSM roof shape or explicit zero minimum conflicts with that review model: the review is not applied, authoritative source tags remain, and `buildingSourceIssues` records the unsupported review. This prevents a future canopy hint from silently changing an OSM roof shape or inventing clearance over an explicit ground-based minimum.
