# Romană aerial comparison gallery

Static HTML, CSS and JavaScript; no build step, API key or third-party library.
Serve the repository root and open `/comparisons/romana/`.

`manifest.json` records all 199 game originals, their WGS84 centres, ground size,
coverage, source commit, dimensions and SHA-256 hashes. The whole-district survey
has 195 locations (30 core, 83 touching the scenery ring, 82 outside the ring):
192 game captures from `b10d8d3684b702fa529076bb92e3f0c1948d85cd`, and three
targeted overrides from `ce54c6b548b155c3bafe9a120d24627d0b38346f`. These are
historical captures and do not represent later fixes. The separate four-view
collection records published baseline `58129abe74a93be2ef52d3c3bf40682768531bc3`.
Original game JPEGs are copied without recompression; the 160 px thumbnails are
derived only from those game images.

The browser requests aerial images directly from the official Esri World Imagery
MapServer export service. No reference aerial or Street View imagery is stored
here. Each request uses a north-up EPSG:3857 square centred at the capture's
coordinates, with Mercator latitude scale correction for a 250 m ground extent.
Attribution: Esri, Maxar, Earthstar Geographics, and the GIS User Community.
The acquisition date is unknown, and live imagery can differ from the retained
imagery used in the historical review. Google Maps and Street View links open
the official site at the selected coordinates.

Hash links retain the collection, tile, coverage, row and search query; for
example `#set=atlas&tile=aerial-r11-c09&scope=core-touches&row=11&q=r11`.
Left/right arrow keys browse the filtered locations. Images open at original
resolution in a scrollable zoom dialog; Escape closes it.

Gallery checks: module syntax, all 199 original hashes and 398 local image URLs,
collection and coverage counts, grid and coordinate filters, no-result state,
saved links, keyboard/buttons, original-resolution zoom, and desktop/mobile
layout. The game itself is unchanged.
