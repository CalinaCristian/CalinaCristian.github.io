# Embedded comparison evidence

The normal website entry is `/game/overview/#comparisons`. There is no separate
comparison website or redirect. `catalog.json` lists the district manifests
consumed by the scoped `../comparison-viewer.js` ES module and its CSS.

Mount with `await mountComparisonViewer(element)` (or pass `{baseURL}` for another
asset root). The returned controller exposes `dispose()`,
`setLocation(id, {scope, query})`, and
`setState({location, scope, query, row, tile, baseline, lat, lon, label})`.
Valid scopes are `core`, `nearby`, `distant`, and `all`. Unsupported locations show
an unavailable state. Landmark coordinates select the nearest district survey
tile, with a visible note that this is district evidence, not a dedicated pair.
URL search parameters use `compareLocation`, `compareTile`, `compareScope`,
`compareRow`, `compareQuery`, `compareBaseline`, `compareLat`, `compareLon`, and
`compareLabel`; `#comparisons` remains the overview anchor. Existing unrelated
URL parameters are preserved. Keyboard browsing is scoped to the viewer.

Each manifest records game image locations, source commits, original dimensions,
SHA-256 hashes, WGS84 capture centres, and tile size. Thumbnail JPEGs derive only
from the corresponding game images. Source captures are immutable; a website
release does not retroactively update the game revision visible in an image.

Romană retains all 199 original game JPEGs without recompression: 195 historical
survey tiles (30 touching the playable core, 83 touching the nearby scenery ring,
82 farther background) and four separate published baseline views. The survey
uses 192 captures from b10d8d3684b702fa529076bb92e3f0c1948d85cd and three targeted
ce54c6b548b155c3bafe9a120d24627d0b38346f overrides. The four baseline views use
58129abe74a93be2ef52d3c3bf40682768531bc3. These are historical source images,
not evidence of fixes made after their recorded revisions.

Floreasca records 90 source captures from df9b2e2ced83b8b30bcc8e34cf809a434b25bc27:
20 tiles touching the source playable mask, 64 nearby tiles covering the exact
600 m analytic scenery ring, and six optional distant context views. Four
context views occupy grid corners; two skyline views are centred on their source
anchors and are separate from the grid. Summer / clear / high settings and
traffic-disabled capture conditions are recorded per frame. `boundary-source.json`
records the actual scope geometry, including the roughly 25 m legal-drive mask
extension. Source provenance, capture report and validation retain the capture
conditions and review limits. `capture-manifest.json` preserves the exact source
ledger (and its validation hash); `manifest.json` adds embedded UI and provider
metadata without changing game imagery. All 90 captures were reviewed; coarse distant
masses and procedural simplifications remain visible.

The default collection shows tiles touching the playable area. The scenery ring
is an optional, approximately 600 m area around it; distant background is a
separate optional filter. Tile intersection does not make a whole square
driveable. Driving follows the loaded street graph and road closures at district
edges. Scenery roads do not form a continuous driving network. Visibility depends
on camera position, height and weather; no tile is categorically “out of view.”
Review coverage is not a claim of exact game/reality parity.

Reference aerials are requested live from the official Esri World Imagery
MapServer export service. The request is a north-up EPSG:3857 square, adjusted
for latitude to match the 250 m ground extent. No aerial or Street View imagery
is stored in this repository. Attribution: Esri, Maxar, Earthstar Geographics,
and the GIS User Community. Acquisition dates are unknown, and current imagery
can differ from the imagery inspected during a historical review. Map and
Street View links open the provider's own service at the selected coordinates.
