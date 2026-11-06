# OSM → game data

The Bucharest and Seattle→Bellevue worlds of *Drive My CV* (`game/`) are built from real
OpenStreetMap data. This folder holds the offline tools that turn raw OSM XML into the compact
JSON the game loads at runtime (`game/data/bucharest.json`, `game/data/seattle.json`).
The game itself has no build step and no dependencies; these tools only need Node ≥ 18 and `curl`.

## Re-running

```bash
# 1. download the raw tiles (OSM API 0.6 `map` calls, ~550 MB, resumable; be gentle with the API)
node tools/osm/fetch-tiles.mjs --out /some/dir/tiles

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
and `game/research/<city>-<district>.json` (if present) enriches building tags and brand sign colours.

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
* **Buildings** – footprints (ways + multipolygon outers), simplified (≥1 m, ≤40 vertices), within
  250 m of the road network, shrunk away from the road ribbons, with height (tags or defaults),
  facade style (by tags, district and street: civic / interwar / eclectic / bloc / glass / house /
  shop / plain / church) and roof shape. Seattle footprints are drawn at 0.7 of real size around
  their (half-scale) position, the Bucharest DN1 strip at 0.75 × 0.45, then de-overlapped.
* **Street lamps** – `highway=street_lamp` nodes (+ `height`); roads carry `lit=yes/no` and bike lanes / tracks as flags.
* **Trees / furniture** – `natural=tree` (+ `tree_row`), benches, bins, bollards, post boxes, hydrants … (off the carriageway).
* **POIs** – fuel, food, shops, banks, pharmacies, hospitals, schools, metro, bus/tram stops,
  hotels, landmarks, airports; brand/name attached to the building they sit in (→ facade signs).
* **Areas / lines / places** – water (incl. Puget Sound from coastline ways), parks, forests,
  landuse, parking lots, aprons, runways, rivers; `place=*` names for map labels.

Data © OpenStreetMap contributors, ODbL.
