# Aerial measurements (dev tooling)

Measures the real district on aerial imagery so the world builder (`tools/osm/build-data.mjs`) can fill what OSM does
not map in Bucharest's residential quarters: roof shapes and colours, the trees, the gardens. Only **measurements**
are committed (`game/research/*-<city>-<district>.json`); the imagery itself never leaves the scratch folder.
Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics, and the GIS User Community).

Needs Python 3 with numpy, Pillow and (for `trees.py`) scipy. Any city / district: pass its bbox and OSM tiles.

```bash
S=/some/scratch
# 0. OSM tiles (see tools/osm/README.md)
node tools/osm/fetch-tiles.mjs --out $S/tiles --only buc
# 1. georeferenced mosaic of the district + ~300 m (zoom 18 ≈ 0.43 m/px; cached, one request at a time)
python3 tools/aerial/mosaic.py --bbox 44.4480,26.0900,44.4740,26.1180 --z 18 --cache $S/esri --out $S/flo18
# 2. roofs: per OSM footprint → [shape flat|hipped|gabled|unknown, conf, median roof colour, m²]
python3 -I tools/aerial/roofs.py --mosaic $S/flo18 --osm $S/tiles/buc_44.45* $S/tiles/buc_44.46* --out game/research/roofs-bucharest-floreasca.json
# 3. tree crowns [lat, lon, crown radius] + the green-ground raster (lawns, gardens, ground under crowns)
python3 -I tools/aerial/trees.py --mosaic $S/flo18 --osm $S/tiles/buc_44.45* $S/tiles/buc_44.46* \
    --out game/research/trees-bucharest-floreasca.json --ground-out game/research/green-bucharest-floreasca.json
# 4. rebuild the district (picks the three files up by name)
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles $S/tiles --districts --district floreasca
```

| tool | what it measures | how |
|---|---|---|
| `mosaic.py` | — | Esri XYZ tiles for a bbox stitched into `<out>.jpg` + `<out>.json` (`{z, px0, py0, w, h, bbox, mPerPx}`: exact Web Mercator pixel ↔ lat/lon) |
| `roofs.py` | roof shape + colour per footprint | registration first (OSM outlines vs imagery differ by a few metres: a global offset where all outlines sit on the strongest image edges, then ±3 m per footprint), footprint shrunk to 72 %, then: red / brown tiles (r − max(g, b) > 16) → pitched (gabled when long and lit/shaded across the ridge, else hipped); tree crowns (excess green) or deep shadow → unknown; long slabs → flat; small grey roofs with a lit and a shaded half → hipped (conf 0.4); the rest flat. `--full` keeps every measurement for calibration |
| `trees.py` | tree crowns, green ground | vegetation = normalised excess green (lower bar in shade); crowns = vegetation that is rough or shaded (mown lawns / pitches are smooth), OSM footprints removed, distance-transform maxima ≥ 1.8 m from the canopy edge with greedy spacing; `--ground-out` = all vegetation as a lat/lon raster (3.4 m cells, RLE) |

Calibrate on crops, not on counts: draw the footprint (and its registered shift) over the imagery with the label and
look at 80 random buildings of the district (that is how the thresholds above were set for Floreasca, 2026-11-08).

Romană calibration found grey sheet-metal pitched roofs larger than the Floreasca villas. Strong lit/shaded halves on a
grey or mixed roof now remain low confidence rather than being confidently called flat; roof plant and cast shadows can
produce the same signal. OSM roof tags retain priority. Keep `--full` measurements and the reviewed crops in scratch when
calibrating; the compact game research file stores only the measured attributes.

Tree surveys record `_coverage: [south, west, north, east]` for the image pixels actually measured, intersected with an
optional `trees.py --bbox` crop. The builder copies it to `data.treeCoverage`, allowing the world to suppress inferred
street rows and park/garden fills only inside measured coverage. Older survey files without `_coverage` leave that coverage unknown.

## Published-source game capture grid

`plan-game-grid.cjs`, `capture-game-grid.cjs` and `validate-game-grid.py` produce **game images only**. They never fetch
reference imagery. The planner supports uncompressed 1:1 districts defined by bands, circles, polygons or a bbox. It uses the builder's exact solid-footprint distance, preferring generated `district.geometry`; a routed district without that geometry is rejected. It intersects square
tiles with the exact runtime drive-mask cells, then measures rectangle-to-source-capsule/circle distances for the 600 m
ring. It retains every touched tile, including partial boundary tiles, and adds four optional far corners plus any
explicitly sourced skyline locations. Capture coverage is not a claim that the world matches reality perfectly.

Use a git archive so another agent's working edits cannot enter a capture. Include `public/`, which supplies the game's
favicon and local telemetry script. Example (scratch paths outside the repository):

```sh
GAME_SNAPSHOT=/tmp/published-game
GRID_OUT=/tmp/game-grid
mkdir -p "$GAME_SNAPSHOT" "$GRID_OUT"
git archive <published-commit> game public package.json | tar -x -C "$GAME_SNAPSHOT"
node tools/aerial/plan-game-grid.cjs --root="$GAME_SNAPSHOT" --out="$GRID_OUT" --city=bucharest --district=floreasca \
  --commit=<full-40-character-published-commit> --locations=handoffs/fidelity/floreasca-comparisons/locations.json
node tools/aerial/capture-game-grid.cjs --root="$GAME_SNAPSHOT" --out="$GRID_OUT" --city=bucharest --district=floreasca
python3 tools/aerial/validate-game-grid.py --out="$GRID_OUT"
```

`--locations` is optional and takes sourced navigation records (id, label, lat, lon, kind, source; `kind: skyline` adds
a distant context tile when necessary). The default capture is summer, clear daytime, high quality, 640×640, north up,
250 m at ground level (h 216.506350946 m, horizontal/vertical fov 60°). Trees and parked cars retain their normal LODs.
Moving traffic is hidden by default; `--traffic=true` enables/relocates it. Mirror rendering is excluded. Render counts
are per-camera observations, not a driving performance acceptance test.

The output includes `manifest.json`, source/asset hashes, the source analytic geometry and exact runtime-mask polygons,
camera records, dimensions, thumbnails, pixel-variation checks and contact sheets. Every image has its own source commit
and capture time. `boundsWgs84` preserves the game projection's actual ground extent for a live reference export. Keep
reference imagery out of git and public assets; a public comparison viewer should request its reference directly from
the provider with attribution and leave the unknown acquisition date explicit.

How the builder uses them (district mode, OSM tags always win): `roofs` → `roof:shape` / `roof:colour` and the villa vs
block decision in the villa quarter (tiled & small → villa 1–3 storeys; dark flat → 1950s–60s bloc P+3; light flat &
compact → newer 4–6-storey block; deterministic per OSM id); `trees` → `data.trees` (+ `treeInfo` leaf bit 32), off
carriageways, scenery streets, buildings, pitches, parking and water; `green` → `data.green`, drawn as grass under
everything paved. Game-vs-imagery check: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=$S/flo18`.

Roof colour can be measured independently of shape. `roofs.py` now emits optional `colourMeasurements[osmWayId]` objects without changing the existing four-slot roof array (`[shape, shapeConfidence, medianColour, areaM2]`). Each object records the raw median `hex`, independent `confidence`, sample pixel count, median luma, fraction of pixels in deep shadow, vegetation contamination, luma spread and registration gain. The quality rule rejects >20% vegetation, median luma <50 or >35% deep shadow, penalizes mixed light and tiny samples, and caps confidence at 0.9. The builder applies independent colours at confidence >=0.65; explicit OSM roof colours and materials always take priority. An explicitly unreliable colour record cannot fall back to its older shape confidence to force a colour. Files without the optional map preserve their legacy behaviour. `node tools/osm/roof-colour-check.mjs` exercises the actual builder with uncertain shape/reliable colour, unreliable canopy/shadow, OSM colour/material overrides and legacy files.
