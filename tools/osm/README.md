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
| `graft-roads.cjs` | `node tools/osm/graft-roads.cjs <committed.json> <fresh-build.json> <out.json>` (on unpacked JSON: `pack-district.mjs --unpack` / pack again): after a district's boundary changes, takes only the re-cut and new road rows, their nodes, the boundary and the scenery streets they replace from a fresh build, and leaves every other field of the committed file as it is. A full rebuild renumbers buildings and strings, which reshuffles index-seeded details (shop names, sign colours) across the district and drops fields added after the build (`roadRestrictions`). Used for the Romana west strip (2026-11-12) |
| `add-pois.mjs` | cached-source POI append (below): adds the OSM businesses / public places / stops a district dataset lost, without a rebuild |
| `poi-kinds.mjs` | OSM tags → POI kind and the POI / sign rules shared by `build-data.mjs` and `add-pois.mjs` (round 3): `basePoiKind` (the first builds' classifier), `extraPoiKind` (classes those builds dropped, + named `shop=yes`), `POI_EDGE_M` (100 m frontage strip), lifecycle and street-level tests, sign text, `ownBuildingSign`, `levelsFromLevelTags`. `poi-rules.test.mjs` proves on a synthetic fixture build that a rebuild keeps the round-2 additions |
| `add-areas.mjs` | cached-source water / pool area append (round 3): fountain basins mapped as outlines (`amenity=fountain`), missing `natural=water` basins and outdoor pools of 4 m² and more, as `areas` + `areaSourceIds` + `areaSourceTags`; a furniture fountain inside an added fountain outline is removed; `--exclude` for water a landmark models or a reviewed stale object |
| `add-area-tags.mjs` | live-OSM area tag append (2026-11-13): the own literal `tourism` / `man_made` / `sport` of every area identity (`areaSourceIds`) into `areaSourceTags` (OSM API 0.6 multi-fetch; existing keys and rows unchanged; provenance `areaTagAppend`) |
| `fix-pois.mjs` | cached-source POI corrections (round 3): a node POI drawn just outside its footprint is linked to it (one footprint within 5 m, the next 2.5 m further); `poiSignAnchors` = where OSM says the sign is (an `entrance` node of the building, else the face on the POI's own `addr:street`) |
| `fix-buildings.mjs` | cached-source building estimates (round 3): storeys from `min_level` / `max_level`, the "glass curtain wall" palette estimate cleared on non-glass buildings, named office / commercial / transportation footprints with estimated storeys styled as a window grid instead of an apartment block |
| `places.mjs` | `game/data/places.json` (reachable places per district) from the district packs, `cities.js`, `landmarks.js`, the spots index and `places-navfix.json`; run it after a build, a POI append or a landmark change (`--repo`, `--data-dir`, `--out` for a dry run elsewhere) |

## Round 3 (2026-11-13): the build adopts the append rules; areas, links, sign anchors and estimates without a rebuild

`build-data.mjs` now imports its classifier and POI rules from `poi-kinds.mjs`: district builds keep POIs up to
`POI_EDGE_M` (100 m) past the edge, the classes the first builds dropped, POIs mapped as relations, mark interior units of
multi-tenant halls (no sign), skip closed objects, write `poiSources` for every row and `buildingOwnTags`; a hotel, then a
fuel station, names its building before other tenants (the SeaTac "principal occupant" rule, so far only in world.js);
fountain outlines (≥ 4 m², not splash pads) are water areas with `amenity=fountain` kept in `areaSourceTags`, smaller ones
furniture fountains; water / pool areas need 4 m² (was 30); storeys come from `min_level` / `max_level` when
`building:levels` is missing; the "glass curtain wall" palette estimate is dropped on buildings the build does not draw as
glass; named office / commercial / transportation footprints are not styled as apartment blocks. Proof without a tile
cache: `node --test tools/osm/poi-rules.test.mjs` (a synthetic Bellevue fixture build).

For the shipped packs the same changes are appended by `add-areas.mjs`, `add-pois.mjs` (re-run, named `shop=yes`),
`fix-buildings.mjs` and `fix-pois.mjs`, each with `--osm <tiles> [--report F] [--write]` like `add-pois.mjs`, in that order.
Every pack change is checked with a decoded before/after comparison (every other section deep-equal).

## POIs without a rebuild (`add-pois.mjs`, 2026-11-12)

A district build keeps POIs only inside the playable edge, reads them from nodes and ways only, and knows a fixed list
of classes. A rebuild renumbers buildings and strings (see `graft-roads.cjs`), so the missing POIs are appended instead:

```bash
# 1. raw OSM for the district and its edge strip, outside the repo (API 0.6 map.json tiles of ~0.008° × 0.006°;
#    Overpass `out body geom;` JSON works too)
curl -o /scratch/osm/bucharest-unirii/t1.json "https://api.openstreetmap.org/api/0.6/map.json?bbox=26.096,44.424,26.104,44.430"
# 2. dry run (prints counts, writes the review list), then --write
node tools/osm/add-pois.mjs --city bucharest --district unirii --osm /scratch/osm/bucharest-unirii --report /scratch/unirii.json
node tools/osm/add-pois.mjs --city bucharest --district unirii --osm /scratch/osm/bucharest-unirii --write
# 3. the places list follows the POIs
node tools/osm/places.mjs
```

* **Added**: (1) everything the build's classifier keeps, up to `--edge` metres (default 100) outside the playable edge
  (`district.geometry`: frontages across the edge street, metro entrances, stops); (2) the classes the build drops,
  mapped onto the existing `poiKinds` with the OSM value in `sub` — nightclub → `food`; gallery, fitness / gaming centre,
  bowling, craft, non-hospital `healthcare=*` → `shop`; kindergarten, childcare, language / music school → `school`;
  guest house → `hotel`; courthouse, embassy, marketplace, community / conference / events centre, sports centre,
  marina, castle / ruins → `landmark`; every named `office=*` → `office`; (3) POIs mapped as multipolygon relations;
  (4) anything of these inside the area that live OSM has and the dataset does not.
* **Never added**: `disused:` / `abandoned:` / `was:` objects, `shop=vacant`, `opening_hours=closed`, construction;
  research-stale and research-closed businesses (`businesses-<city>-<district>.json`, `businesses-gamediff.json`);
  units off street level (`level` ≠ 0, indoor, underground; a node more than 10 m inside a footprint over 3000 m² that holds
  four or more businesses: mall gallery, terminal); unnamed businesses; anything already in the dataset
  (same name within 40 m, same kind within 1 m, transit of the same kind within 8 m); ATMs outside the area.
* **Written**: rows appended to `pois` and `strings` (existing indices unchanged, so `publicTransportSources.poiSources`
  and index-seeded details stay valid), `poiSources` (OSM id per appended row; a second run skips them),
  `buildingOwnTags` (a signed building's own OSM name where a street-level tenant had taken the sign: the building shows
  its name, the tenant keeps a unit fascia; a faculty / clinic / office tenant, which has no fascia, keeps the sign; addresses, block numbers,
  lettered wings and plain residential names are not signs, a named house with a `wikidata` / `historic` tag is),
  small `amenity=fountain` ways as `furniture` fountains (a basin over 30 m² is reported, not added: it needs its outline
  as water), and `poiAppend` (date, edge, input digest, counts). Everything else, `generated` included, is untouched;
  the tool refuses a compressed or non-district dataset. Compare before / after section by section before committing.
* world.js: a POI of kind food / shop / bank / pharmacy / hotel gets its fascia on a street face of its building; for a
  scenery-ring building that face is found against the scenery streets (`sceneryStreetNear`). Stops outside the edge are
  POIs only (the inferred shelter needs a graph edge); metro entrances get their pole.

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

District source roads retain physical restricted roads and service aisles. `roadAccess` resolves the OSM motorcar hierarchy independently of physical geometry; restricted rows never enter the public runtime graph, and destination/customer streets are available only for selected endpoints. Raw conditional/HOV/reversible restrictions remain explicit and unresolved. `node tools/osm/road-access-check.mjs` verifies precedence, endpoint routing and an isolated builder fixture, including a private elevated trunk, a specifically public service road, parking/customer access, a footway and a runway.

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

Road-overlap developer audits use each solid body's vertical band and courtyard holes. A reviewed canopy clears a ground road only when its underside is above the two-metre vehicle envelope; a low underside or a source wing still reports an overlap. Visual QA also respects the existing explicit `userData.noAudit` marker on action UI pins/rings; physical fuel columns/pumps remain audited. Raw pre-fix findings are retained in the district evidence ledger.


District rebuilds optionally export source `railways` for rail, disused and abandoned ways touching the exact600m source ring, preserving full node IDs and raw tags. Tram rendering stays in its existing field. Run `node tools/osm/rail-tree-check.mjs --data=game/data/<district>.json --osm=<tiles>` to verify every selected source way, exact tags, full node order, coordinate quantization and measured-crown accounting. `_retention: "all-measured"` disables the legacy small-ring crown thinning for a reviewed survey; `treeCrownRadii` carries the independent radius measurement into the renderer. Tree heights and untagged species remain estimates. New data fields gate all new rendering; no old dataset is mutated by runtime defaults.

Footbridges without a rebuild: `node tools/osm/add-footbridges.mjs --data game/data/<city>-<district>.json --osm <overpass out body geom json>` writes that dataset's OSM footway-bridge ways (and the steps ways at their ends) into `game/src/footbridge-sources.js`; the district JSON is only read. `game/src/elevated-sources.js` renders them, together with bridge-tagged `railways` that carry `min_height`.

Run `node tools/osm/road-source-check.mjs` for actual builder fixtures at all eight district masks: near parallel main roads, a five-metre private stub, an unjoined nearby dead end and a crossing elevated source road must retain exact original coordinates, node identities and topology. It also checks that a tempting virtual border connector cannot enter car or foot GPS routes. Audit each rebuilt dataset independently against its raw source with `node tools/osm/road-source-audit.mjs --data game/data/seattle-seatac.json --osm /path/to/raw/xml/tiles`. A source way wholly inside the core must retain every source vertex; clipping may add only exact boundary cuts on its original segments. The audit reports private physical rows and short source ways rather than dropping either.

`node tools/osm/positive-levels-check.mjs` compiles three actual OSM SeaTac source ways whose positive mapped levels previously became an unconditional9m default, and checks literal imperial height, untagged estimates, religious levels and source grandstand levels. Positive levels now reach normal estimated storey spacing; known positive heights continue to override that estimate.
