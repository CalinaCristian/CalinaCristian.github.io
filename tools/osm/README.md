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
| `build-data.mjs` | the converter; the JSON schema is documented at the top of the file and in `game/data/README.md` |

## What the converter does

* **Projection** – metres, x = east, z = south. Bucharest 1:1 around Piața Unirii, latitudes north
  of 44.497 (DN1 → Otopeni) compressed ×0.35. Seattle ×0.5 around SeaTac. Parameters are written
  to the JSON header and mirrored by `game/src/cities.js` `projector()`.
* **Roads** – drivable `highway=*` ways (motorway … living_street), lane counts (`lanes`,
  `lanes:forward/backward`, sensible defaults), one-way (incl. roundabouts, `oneway=-1` reversed),
  max speed (km/h; mph converted), bridges/tunnels/layers, bus lanes, tolls, trams. Polylines are
  simplified (0.35 m) keeping junctions and tagged nodes (signals, crossings, stops…). Opposite
  one-way carriageways that would overlap at the drawn lane widths are pushed apart.
* **Buildings** – footprints (ways + multipolygon outers), simplified (≥1 m, ≤40 vertices), within
  250 m of the road network, shrunk away from the road ribbons, with height (tags or defaults),
  facade style (by tags, district and street: civic / interwar / eclectic / bloc / glass / house /
  shop / plain / church) and roof shape. Seattle footprints are drawn at 0.7 of real size around
  their (half-scale) position, the DN1 strip at 0.6 N-S, then de-overlapped.
* **POIs** – fuel, food, shops, banks, pharmacies, hospitals, schools, metro, bus/tram stops,
  hotels, landmarks, airports; brand/name attached to the building they sit in (→ facade signs).
* **Areas / lines / places** – water (incl. Puget Sound from coastline ways), parks, forests,
  landuse, parking lots, aprons, runways, rivers; `place=*` names for map labels.

Data © OpenStreetMap contributors, ODbL.
