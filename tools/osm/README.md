# OSM → game data

Offline tools that turn raw OpenStreetMap XML into the district packs the game loads
(`game/data/<city>-<district>.bin.gz`; format: `game/data/README.md`). They need Node ≥ 18 and `curl`; the audits need
Python 3. Data © OpenStreetMap contributors, ODbL.

## Build a district

```bash
# 1. raw tiles (OSM API 0.6 `map` calls; resumable, existing files are skipped; be gentle with the API)
node tools/osm/fetch-tiles.mjs --out /some/dir/tiles                       # every region (~550 MB)
node tools/osm/fetch-tiles.mjs --out /some/dir/tiles --only buc --bbox 44.4327,26.0722,44.4642,26.1112   # one region, clipped

# 2. build (a few seconds each), written as game/data/<city>-<district>.bin.gz
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles --districts                    # all 8
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles /some/dir/tiles --districts --district romana,bellevue

# 3. the places list follows every build
node tools/osm/places.mjs
```

Regions are `REGIONS` in `fetch-tiles.mjs`; tiles are named `<region>_<minlat>_<minlon>_<maxlat>_<maxlon>.xml` and picked
by prefix (`buc_`, `dn1_`, `bucx_` for Bucharest, `sea_` for Seattle; Pipera needs `bucx`, Otopeni `dn1`). Overlapping
tiles are deduplicated by OSM id. Water / park relations cut by the tiles are completed with `/api/0.6/relation/<id>/full`
and cached in `tools/osm/cache/` (`--cache DIR`). `DEBUG_DROPS=<file.json>` lists every footprint inside the area the
build did not keep and why.

A full rebuild renumbers buildings and strings (reshuffling index-seeded details such as shop names and sign colours) and
drops the fields no tool writes (listed in `game/data/README.md`). For small changes prefer the append tools below.

### What the build does

- **Area**: the district from `game/src/cities.js` (`center`, `bbox`, `poly`, `bands`, `circles`, `route`); projection
  anchored at `center`, scale 1. `corridors.mjs` turns the shapes into the exact playable area (`district.geometry`) and
  its mask. Roads are cut exactly at the boundary (new end nodes in `district.ends`); only tiles near the district are
  parsed.
- **Roads**: drivable `highway=*` ways with lanes, one-way (`oneway=-1` reversed), max speed (mph converted),
  bridges / tunnels / layers, bus lanes, tolls, trams, bike lanes, `lit`, `parking:*`, `turn:lanes`. Source geometry
  policy: every mapped vertex and stub kept, no displacement, no inferred joins or virtual connectors. Restricted roads
  stay as physical rows; `roadAccess` keeps them out of the public graph.
- **Buildings**: every whole footprint (ways and multipolygon outers with their courtyards) whose solid geometry touches
  the area or the `outerRing` (default 600 m) scenery ring; ring buildings get flag 32 and their streets become
  `scenery`; `backdrop` boxes start beyond. Height from tags, else estimates; storeys from `min_level` / `max_level` when
  `building:levels` is missing; facade style from tags, district and street (civic / interwar / eclectic / bloc / glass /
  house / shop / plain / church). Unnamed bare `building:part`s without type or roof tags get a flat fallback. Invalid
  nonpositive OSM heights go to `buildingSourceIssues`; positive heights are never raised to a minimum.
- **Research** (`game/research/`, OSM tags always win): the district dossier fills heights, storeys, facade / roof colour,
  roof shape, reviewed open canopies, passages and road widths; `roofs-` / `trees-` / `green-` files from
  `tools/aerial/` add roof shapes and colours, measured crowns (`treeCoverage`) and green ground; `businesses-*` drop stale
  businesses and add vacant units; `parking-layouts-*` add stall rows.
- **POIs** (`poi-kinds.mjs`, shared with `add-pois.mjs`): kept up to `POI_EDGE_M` (100 m) past the edge, including
  relations; closed / disused objects and units off street level skipped; interior units of multi-tenant halls get no
  sign; a hotel, then a fuel station, names its building before other tenants (`buildingOwnTags`). Address-like names,
  block numbers and plain residential names never become signs.
- **Other**: street lamps, trees and `tree_row`s, street furniture (off the carriageway), areas (water incl. coastline,
  parks, landuse, parking, sports grounds; fountain outlines ≥ 4 m² as water), lines (runways, taxiways, rivers),
  `place=*` labels, rail and tram source metadata.

Check a rebuilt district street by street against Street View:
`node game/dev/harness/viewpoints.js --district=<id> --walk --streetview` (`game/dev/harness/README.md`).

## Changing a pack without a rebuild

These tools keep every existing row and index and write only with `--write` (or without `--check` / `--dry`). Most edit
the pack in place and log a provenance record in it; the ones marked "unpacked JSON" work on
`pack-district.mjs --unpack` output, to be packed again afterwards. Compare decoded before / after section by section
before committing.

| tool | what |
|---|---|
| `add-pois.mjs --city C --district D --osm DIR [--edge 100] [--report F] [--write]` | appends OSM businesses, public places and stops the dataset lacks (up to `--edge` m outside the area; classes the build once dropped mapped onto existing kinds) to `pois`, `poiSources`, `buildingOwnTags`; small fountains to `furniture` (`--no-fountains`, `--no-building-names` to skip). Never adds closed / research-stale businesses, off-street units, unnamed businesses or duplicates |
| `add-areas.mjs --city C --district D --osm DIR [--exclude w1,w2] [--classes water,pool] [--write]` | appends fountain basins, `natural=water` basins and outdoor pools ≥ 4 m² to `areas` / `areaSourceIds` / `areaSourceTags`; removes a furniture fountain inside an added basin |
| `add-area-tags.mjs --city C --district D [--report F] [--write]` | adds each area's literal `tourism` / `man_made` / `sport` from the live OSM API to `areaSourceTags` |
| `fix-pois.mjs --city C --district D --osm DIR [--write]` | links a node POI drawn just outside its footprint (one footprint within 5 m, the next 2.5 m further) and writes `poiSignAnchors` (OSM entrance node, else the face on the POI's `addr:street`) |
| `fix-buildings.mjs --city C --district D --osm DIR [--write]` | building estimates: storeys from `min_level` / `max_level`, no glass palette on non-glass buildings, named office / commercial / transport footprints not styled as blocks |
| `add-roads.mjs --data FILE --ways way-full.json[,…] --as CLASS --reason "…" [--write]` | reviewed exception: appends whole OSM ways the build dropped (e.g. `highway=construction`) as road rows with the builder's defaults, reusing junction nodes by OSM id |
| `apply-road-width-reviews.mjs <city>-<district> [--check]` | applies the dossier's `road_widths` reviews to `roadWidths` and the road rows (plain one-way carriageways only; anything else is refused) |
| `graft-roads.cjs <committed.json> <fresh-build.json> <out.json>` | after a boundary change: takes only the re-cut and new road rows, their nodes, the boundary and the replaced scenery streets from a fresh build; every other field stays (unpacked JSON in and out) |
| `add-tram-source-metadata.mjs --data FILE.json --osm DIR [--crossings-only] [--report F] [--write]` | appends the tram source fields to an unpacked JSON, byte-preserving the existing prefix; refuses unmatched or ambiguous identities |
| `area-source-tags.py --data FILE.json --osm DIR --proof F` | appends literal area tags from cached XML by exact `areaSourceIds` (unpacked JSON) |
| `add-footbridges.mjs --data FILE.json --osm overpass.json [--out F] [--margin 100] [--dry]` | writes the dataset's footway-bridge ways and their end steps into `game/src/footbridge-sources.js`; the pack is only read (unpacked JSON) |
| `worship-source.mjs` | writes the live OSM religion / denomination / roof and colour tags of every place-of-worship building way in the packs to `game/src/worship-source.js` (read by `worship.js` for the Orthodox tower rule); the packs are only read |

The POI, area and fix tools take `--osm` as a folder of API 0.6 `map.json` tiles or Overpass `out body geom;` JSON for the
district and its edge strip, kept outside the repo, e.g.
`curl -o /scratch/osm/bucharest-unirii/t1.json "https://api.openstreetmap.org/api/0.6/map.json?bbox=26.096,44.424,26.104,44.430"`.
Run `places.mjs` after any POI or landmark change.

## Files

| file | what |
|---|---|
| `fetch-tiles.mjs` | downloads the tiles (splits a tile in four when the API refuses it) |
| `build-data.mjs` | the converter |
| `corridors.mjs` | the playable area of a district: union of bands, circles, polygons and buffered routes, plus its mask |
| `parse-osm.mjs`, `geom.mjs` | XML parser; polygon / polyline helpers |
| `district-data.mjs`, `pack-district.mjs` | read / write packs; `pack-district.mjs FILE.json [--replace]` and `--unpack FILE.bin.gz [OUT.json]` |
| `poi-kinds.mjs` | OSM tags → POI kind, sign text and the POI rules shared by the build and `add-pois.mjs` |
| `places.mjs` | `game/data/places.json` from the packs, `cities.js`, `landmarks.js`, the spots index and `places-navfix.json` (`--repo`, `--data-dir`, `--out` for a dry run elsewhere) |
| `places-navfix.json` | in-game verified nav points for places whose nearest street the nav cannot reach |
| `source-footprints.mjs`, `source-passages.mjs`, `source-height-review.mjs`, `research-source.mjs`, `tram-sources.mjs`, `road-audit-geometry.mjs` | modules shared by the build and its checks |

## Checks

| command | checks |
|---|---|
| `python3 -I tools/osm/building-audit.py --data FILE.json --osm TILES… [--roofs F] [--out F] [--ring 600]` | every source footprint touching the area or ring is in the game; position, area, height, roof vs the aerial survey (unpacked JSON) |
| `node tools/osm/building-geometry-check.mjs --data=FILE --osm=DIR` | relation outers, literal heights / minima, canopy bands, assemblies, roof triangulation |
| `node tools/osm/road-source-audit.mjs --data FILE.json --osm DIR` | prepared roads vs raw source: identities, topology, every vertex kept (unpacked JSON) |
| `node tools/osm/road-source-check.mjs` | builder fixtures at all eight masks: source coordinates and topology kept, no virtual connector in GPS routes |
| `node tools/osm/road-access-check.mjs` | access precedence, endpoint routing, restricted rows outside the public graph |
| `node tools/osm/rail-tree-check.mjs --data=FILE --osm=DIR` | railway source ways and measured-crown accounting |
| `python3 tools/osm/tram-source-audit.py --data FILE.json --osm DIR --report F` | tram metadata vs the cached XML (unpacked JSON) |
| `node --test tools/osm/poi-rules.test.mjs` | the build's POI rules on a synthetic fixture (no tile cache needed) |
| `node tools/osm/positive-levels-check.mjs`, `roof-colour-check.mjs` | storey estimates from positive levels; roof colour priority |

Other regression checks follow the same pattern (`*-check.mjs`, `*.test.mjs`, `test-*.mjs`): aircraft, parking
layouts, relation parts, research source, reviewed roof shape, source height review, building canopies / passages /
roofs, road widths, scenery bridges / source, shared lanes, sidewalks, tram grade / trench / tunnel / signals / crossings /
prop clearance. `building-geometry-browser.cjs` takes targeted in-game
screenshots outside git.
