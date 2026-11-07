# game/data/geo — the world globe

Loaded lazily by `game/src/globe.js` (the Explore hub's **World** tab and the OTP → SEA flight cut-scene), never on a
district load. Until they arrive (or if they fail) the globe draws the 1:110m set baked into `game/src/geo-ne110.js`,
without city lights.

| file | size | content |
|---|---|---|
| `ne50m.bin` | 157 KB | Natural Earth **1:50m** land (1,412 rings, the Caspian Sea as a hole), the big lakes (area ≥ 0.12 deg²: Great Lakes, Baikal, Ladoga, Victoria…, with their islands), land borders (admin-0 boundary lines), glaciated areas — Douglas–Peucker 0.01°, quantised to 0.01°, ~73 k points |
| `lights.jpg` | 113 KB | NASA Earth Observatory **Black Marble 2016** (0.1° global composite) reduced to a grayscale city-lights mask, equirectangular 2880 × 1440 (lon −180…180, lat 90…−90) |

`ne50m.bin` layout (little endian): `NEG1`, u8 layer count; per layer u8 kind (1 land, 2 lakes, 3 borders, 4 ice), varint
ring count; per ring varint n, then n zigzag-varint (dx, dy) pairs in 0.01° from (0, 0). Polygon rings are counter-clockwise
in (lon, lat) and implicitly closed (fill even-odd); borders are open polylines. Edges longer than 1° are densified
linearly in lon/lat (parallels such as 49° N stay straight; the data cuts along ±180° and −90° are flagged as seams at
load time and never stroked).

Rebuild: `python3 -I tools/geo/build-globe-data.py <ne_geojson_dir> BlackMarble_2016_01deg.jpg game/data/geo` (Pillow +
numpy) from

- Natural Earth `ne_50m_land`, `ne_50m_lakes`, `ne_50m_admin_0_boundary_lines_land`, `ne_50m_glaciated_areas`
  (GeoJSON from <https://github.com/nvkelso/natural-earth-vector/tree/master/geojson>, v5),
- NASA `BlackMarble_2016_01deg.jpg` (<https://earthobservatory.nasa.gov/features/NightLights>, 3600 × 1800; fetched from
  `assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/`).

## Licence

- **Natural Earth** — public domain (<https://www.naturalearthdata.com/about/terms-of-use/>). "Made with Natural Earth."
- **NASA Black Marble 2016** — NASA Earth Observatory images by Joshua Stevens, using Suomi NPP VIIRS data from Miguel
  Román, NASA's Goddard Space Flight Center; NASA imagery is not copyrighted (public domain, credit requested:
  <https://www.nasa.gov/nasa-brand-center/images-and-media/>).

In-game credit line: *Globe: Natural Earth 1:50m (public domain) · city lights: NASA Earth Observatory Black Marble 2016
(public domain)*.
