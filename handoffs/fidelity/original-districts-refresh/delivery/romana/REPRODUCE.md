# romana reproducible source delivery

This district was rebuilt with compiler/runtime source `4fdacd3f14bc8b09c109b51f986889d524271907`. The dataset commit is the commit containing this file; its exact bytes are identified by `source-summary.json:dataSha256`. This proof is source preservation and calibration, not whole-world visual acceptance. Final capture evidence follows the remaining shared runtime fixes.

The exact 39 XML inputs (36 original map tiles and 3 full relations) are in `osm-source-snapshot.tar.gz`. They contain public OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0. The archive preserves every XML byte; only archive entry timestamps/owners are normalized for a deterministic archive. `osm-source-manifest.json` lists every raw file hash and its original XML version/timestamp fields remain intact. Archive assembly date is not source acquisition date. No reference imagery or credentials are included.

The four current research inputs (main district, aerial roofs, measured crowns and measured green) are tracked under `game/research/` and individually hashed in `source-summary.json`. Every original measured crown position and radius remains unchanged. All-measured retention records geometry/duplicate/out-of-district rejection separately, with zero budget thinning. Crown species and heights remain estimates; aerial acquisition date is unknown. Floreasca's coverage envelope is explicitly reconstructed from its original recorded zoom/bbox and tile-rounding rule, rather than asserted as an observed date or new imagery footprint.

`romana-checks.json` records independent building, geometry and whole-source-road audit exit codes, immutable dataset hash and output hashes. Raw building rows are in `romana-buildings.json.gz`; no row or finding is removed. Geometry checks retain literal total/eave/minimum dimensions and all native source footprint holes. Source road checks include every public/private core way and every required 600 m scenery piece, exact node order, raw lanes and source cut identity. `before/` preserves the earlier dataset audit, including its failures, against source `7d3364c1c9b880cb084740f5405cfe97036aa2e3`. Earlier Floreasca spatial matches are not called source-ID matches.

`estimates.json` records height/rise provenance and every native-profile issue, including literal source contradictions and unsupported roof families. A default body above a mapped minimum remains an explicit estimate. Complete source identity/topology does not establish exact untagged roof, facade, height, canopy species or terrain agreement.

To reproduce from the delivery checkout, run from the repository root (Node and Python 3, no Google service needed):

```sh
DISTRICT_PROOF=handoffs/fidelity/original-districts-refresh/delivery/romana
SOURCE_FIXTURE=$(mktemp -d)
tar -xzf "$DISTRICT_PROOF/osm-source-snapshot.tar.gz" -C "$SOURCE_FIXTURE"
node --max-old-space-size=8000 tools/osm/build-data.mjs --tiles "$SOURCE_FIXTURE/tiles" --cache "$SOURCE_FIXTURE/builder-cache" --city bucharest --districts --district romana
python3 tools/osm/building-audit.py --data game/data/bucharest-romana.json --osm "$SOURCE_FIXTURE"/tiles/*.xml --roofs game/research/roofs-bucharest-romana.json --out "$SOURCE_FIXTURE/romana"
node tools/osm/building-geometry-check.mjs --data=game/data/bucharest-romana.json --osm="$SOURCE_FIXTURE/tiles"
node tools/osm/road-source-audit.mjs --data game/data/bucharest-romana.json --osm "$SOURCE_FIXTURE/tiles"
```

The compiler writes the current calendar date to `generated`; a later-day reproduction will differ in that metadata field. `contentSha256ExcludingGenerated` is the SHA256 of UTF-8 Python `json.dumps` with sorted keys, separators `(',', ':')`, `ensure_ascii=False`, after removing only `generated`. All geometry, source IDs, profiles, cache points and research inputs must remain identical.
