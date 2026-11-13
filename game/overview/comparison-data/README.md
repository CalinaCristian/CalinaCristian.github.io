# Comparison data (overview `#comparisons`)

Game captures of each district shown beside live aerial imagery in `/game/overview/#comparisons`. The viewer is
`../comparison-viewer.js` (+ `../comparison-viewer.css`); there is no separate site.

## Viewer API

`await mountComparisonViewer(element, { baseURL?, onLocation? })` returns `{ dispose(), setLocation(id, { scope, query }),
setState({ location, scope, query, row, tile, baseline, lat, lon, label }) }`. Scopes: `core`, `nearby`, `distant`,
`all`. A landmark lat/lon selects the nearest district tile (with a note that it is district evidence, not a dedicated
pair); an unknown location shows an unavailable state. URL parameters: `compareLocation`, `compareTile`, `compareScope`,
`compareRow`, `compareQuery`, `compareBaseline`, `compareLat`, `compareLon`, `compareLabel`, `compareArchive`; other URL
parameters are preserved.

## Files

- `catalog.json` — `{ schemaVersion, locations: [{ id, label, manifest }] }`.
- `<district>/manifest.json` — the fields the viewer reads: `items`, `defaultTile`, `aerial` (`endpoint`,
  `attribution`), `description`, `coverageNote`, `reviewNote`, `collectionNotes`, `historicalCollections`
  (`[{ manifest, label, frames, generatedAt, gameSourceCommit, publishedBaseline }]`). Each item: `id`, `label`,
  `row`, `column`, `lat`, `lon` (WGS84 centre), `size` (m), `scope` (`core-touches` → core, `ring-touches` → nearby,
  `outside-ring` → distant, `published-capture` → baseline), `dataset`, `places`, `image`, `thumbnail` (relative to the
  manifest), `width`, `height`, `gameSourceCommit`, `captureType`, `capturedAt`. Items also carry `sha256` and the
  capture pose/conditions for provenance.
- `<district>/images/`, `thumbs/` — original game JPEGs (never recompressed) and thumbnails derived only from them.
- `<district>/capture-manifest.json`, `boundary-source.json`, `validation.json`, `provenance/` — the source capture
  ledger, the actual scope geometry and the capture checks.
- `<district>/retakes/<commit>/` — tiles retaken at their original poses from that commit, with a mask giving the reason
  per tile, the tiles tried and rejected, and the review.
- `<district>/historical/<name>/manifest.json` — the collection before a retake, resolving to the unchanged files. The
  site deploy excludes `historical/` (`_config.yml`), so these archives exist only in the repository.

A capture is immutable: it shows the game at its recorded `gameSourceCommit`, not later fixes.

## Reading the tiles

The default view shows tiles touching the playable area; the scenery ring (about 600 m around it) and the distant
background are optional filters. A tile touching the playable area does not make the whole square driveable: driving
follows the loaded street graph and the closures at district edges. Review coverage is not a claim of exact
game/reality parity.

## Aerial imagery

Requested live from the Esri World Imagery MapServer `export` service: a north-up EPSG:3857 square, latitude-corrected
to the tile's ground size. No aerial or Street View imagery is stored in this repository or on the site server.
Attribution: Esri, Maxar, Earthstar Geographics, and the GIS User Community; acquisition dates are unknown. Responses are
cached only in the visitor's browser: CacheStorage records expire 15 minutes after the original fetch (reuse does not
extend them), with an in-memory front of at most 96 images; if storage fails, the memory cache is used until reload.
