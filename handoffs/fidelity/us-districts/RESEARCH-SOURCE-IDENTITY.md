# Typed OSM research identity

Research building records select the original OSM entity through `osm: "r123"` / `"w123"`, or `osmType: "relation"` / `"way"` with a numeric ID. Numeric IDs without a declared type retain legacy way semantics. An unknown type, malformed ID, conflicting prefix/type, or absent requested entity is ignored without falling back to a different source entity. Way and relation IDs may have the same number.

The original dimensions are captured on the selected entity before missing research fields are filled. Positive literal OSM heights, minima and storey counts retain priority. Documented permit storeys still produce an estimated metre height; they are not literal OSM heights.

`node tools/osm/research-source-check.mjs` exercises actual Bellevue r4547843 and tagged relation r4547842, plus an explicitly controlled same-number way fixture with positive height/minimum/storeys. It verifies type selection, fail-closed mismatches, legacy compatibility and literal dimension priority. The controlled way ID collision is test-only and does not enter production source data.
