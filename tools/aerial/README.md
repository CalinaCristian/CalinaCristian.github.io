# Aerial measurements (dev tooling)

Measures a district on aerial imagery so the district build (`tools/osm/build-data.mjs`) can fill what OSM does not map:
roof shapes and colours, trees, gardens. Only **measurements** are committed (`game/research/*-<city>-<district>.json`);
imagery stays in a scratch folder. Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics, and the GIS User
Community). Needs Python 3 with numpy, Pillow and (for `trees.py`) scipy. Works for any district: pass its bbox and OSM
tiles.

```bash
S=/some/scratch
# 0. OSM tiles (tools/osm/README.md)
node tools/osm/fetch-tiles.mjs --out $S/tiles --only buc
# 1. georeferenced mosaic of the district + ~300 m (zoom 18 ≈ 0.43 m/px; tiles cached, one request at a time)
python3 tools/aerial/mosaic.py --bbox 44.4480,26.0900,44.4740,26.1180 --z 18 --cache $S/esri --out $S/flo18
# 2. roofs per OSM footprint
python3 -I tools/aerial/roofs.py --mosaic $S/flo18 --osm $S/tiles/buc_44.45* $S/tiles/buc_44.46* --out game/research/roofs-bucharest-floreasca.json
# 3. tree crowns + green ground raster
python3 -I tools/aerial/trees.py --mosaic $S/flo18 --osm $S/tiles/buc_44.45* $S/tiles/buc_44.46* \
    --out game/research/trees-bucharest-floreasca.json --ground-out game/research/green-bucharest-floreasca.json
# 4. rebuild the district (picks the three files up by name)
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles $S/tiles --districts --district floreasca
```

| tool | output | method |
|---|---|---|
| `mosaic.py` | `<out>.jpg` + `<out>.json` (`{z, px0, py0, w, h, bbox, mPerPx}`, exact Web Mercator pixel ↔ lat/lon) | Esri XYZ tiles stitched for a bbox |
| `roofs.py` | `roofs: {wayId: [shape flat\|hipped\|gabled\|unknown, confidence, median colour, m²]}` + optional `colourMeasurements` | registers OSM outlines on the imagery (global offset, then ±3 m per footprint), shrinks the footprint to 72 %, then: red / brown tiles → pitched (gabled when long and lit / shaded across the ridge, else hipped); tree cover or deep shadow → unknown; long slabs → flat; grey roofs with a lit and a shaded half → low-confidence hipped; the rest flat. `--full` keeps every measurement for calibration |
| `trees.py` | crowns `[lat, lon, radius]`, `_coverage`; `--ground-out`: green raster (3.4 m cells, RLE) | vegetation = normalised excess green (lower bar in shade); crowns = rough or shaded vegetation (lawns are smooth) outside footprints, distance-transform maxima ≥ 1.8 m from the canopy edge |

`colourMeasurements[wayId]` records the raw median `hex`, its own `confidence` (capped at 0.9; rejected above 20 %
vegetation, median luma < 50 or > 35 % deep shadow) and the sample statistics. `_coverage: [south, west, north, east]` is
the area actually measured (intersected with an optional `trees.py --bbox`).

How the build uses them (OSM tags always win): `roofs` → `roof:shape` / `roof:colour` (a colour measurement applies at
confidence ≥ 0.65) and the villa vs block guess in villa quarters (tiled and small → 1–3-storey villa; dark flat → P+3
bloc; light flat and compact → 4–6-storey block; deterministic per OSM id); `trees` → `data.trees` (`treeInfo` leaf bit
32, `treeCrownRadii`), off carriageways, streets, buildings, pitches, parking and water; `_coverage` → `data.treeCoverage`
(inferred street and park trees are suppressed only inside it); `_retention: "all-measured"` keeps every crown; `green` →
`data.green`, grass under everything paved.

Calibrate on crops, not counts: draw footprints (with their registered shift) over the imagery and inspect about 80
random buildings. Grey sheet-metal pitched roofs (Romană) stay low confidence rather than flat. Keep `--full` output and
crops in scratch.

Game vs imagery check: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=$S/flo18`.

## Game capture grid

`plan-game-grid.cjs`, `capture-game-grid.cjs` and `validate-game-grid.py` capture **game images only** (no reference
imagery is fetched) as a top-down tile grid covering a district's playable area and its 600 m ring, from its
`district.geometry` (a district without it is rejected). Capture from a `git archive` so working edits cannot leak in;
include `public/` (favicon, telemetry script):

```sh
GAME_SNAPSHOT=/tmp/published-game GRID_OUT=/tmp/game-grid
mkdir -p "$GAME_SNAPSHOT" "$GRID_OUT"
git archive <published-commit> game public package.json | tar -x -C "$GAME_SNAPSHOT"
node tools/aerial/plan-game-grid.cjs --root="$GAME_SNAPSHOT" --out="$GRID_OUT" --city=bucharest --district=floreasca \
  --commit=<full-40-character-published-commit> --locations=handoffs/fidelity/floreasca-comparisons/locations.json
node tools/aerial/capture-game-grid.cjs --root="$GAME_SNAPSHOT" --out="$GRID_OUT" --city=bucharest --district=floreasca
python3 tools/aerial/validate-game-grid.py --out="$GRID_OUT"
```

`--locations` (optional) takes sourced records `{id, label, lat, lon, kind, source}`; `kind: skyline` adds a distant
tile. Defaults: summer, clear day, high quality, 640×640, north up, 250 m tiles, fov 60°; moving traffic hidden
(`--traffic=true` shows it). Output: `manifest.json`, source / asset hashes, geometry and mask polygons, camera records,
thumbnails, pixel-variation checks, contact sheets; `boundsWgs84` gives each tile's ground extent for a reference export.
Keep reference imagery out of git; a public comparison viewer should load it from the provider with attribution.
