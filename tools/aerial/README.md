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

How the builder uses them (district mode, OSM tags always win): `roofs` → `roof:shape` / `roof:colour` and the villa vs
block decision in the villa quarter (tiled & small → villa 1–3 storeys; dark flat → 1950s–60s bloc P+3; light flat &
compact → newer 4–6-storey block; deterministic per OSM id); `trees` → `data.trees` (+ `treeInfo` leaf bit 32), off
carriageways, scenery streets, buildings, pitches, parking and water; `green` → `data.green`, drawn as grass under
everything paved. Game-vs-imagery check: `node game/dev/harness/viewpoints.js --district=<id> --topdown=250 --mosaic=$S/flo18`.
