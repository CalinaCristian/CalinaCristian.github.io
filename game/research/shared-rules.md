# Shared rules (research)

Rules that apply in every district the same way. Each district dossier lists only what the rule gives there.

## Pedestrian plazas

`ground-review.js`, plazas in `pedestrian-plazas.js` (from live OSM via `tools/osm/pedestrian-plazas.mjs`).
A mapped pedestrian area (`highway=pedestrian|footway` + `area=yes`, `area:highway`, `place=square`; ways and
multipolygons) is paved over its whole polygon: its `surface` decides, no surface tag counts as paved, and only
`surface=grass` keeps the aerial raster's lawn there. Mapped grass / park polygons and trees inside a plaza stay as
OSM has them (Piața Unirii's `place=square` covers its park: its lawns are OSM polygons and are unchanged). Not
compared with a panorama: the rule follows OSM's tags.

## Places of worship

`worship.js`, tags in `worship-source.js` (from live OSM via `tools/osm/worship-source.mjs`).
One rule from OSM tags, not church by church. A building with an Orthodox (or Armenian) `denomination` gets the
convention towers, an octagonal drum with a metal helmet and a cross over the middle of its long axis, and a smaller
pronaos tower 30 % of the length towards the west end when the footprint is at least 20 m long and 1.6 times as long
as wide (Armenian: one drum with a cone; `building=chapel` or under 120 m2: one small tower; under 60 m2: none), and
only where its height and roof are the build's estimates: an OSM `height` is read as the top of the church with its
tower (nothing added), and building parts, mapped domes / flat roofs and courtyards are kept as mapped. Western-rite,
free-church, Jewish and untagged buildings get none. Estimates: radius 0.2 x footprint width (1.4-3 m; small 0.9-1.5
m), drum 1.4 r + 0.8 m (2.4-5.5 m) above the roof top, helmet 1.3 r, pronaos tower 0.7 r and 0.4 of the drum, helmet
colour from `roof:colour` / `roof:material`, else the roof's colour, else dark tin #5e6668. Which churches really have
one tower or two, a porch (pridvor) or a separate bell tower was not compared (porches and separate bell towers stay
unmodelled unless mapped).

## Business research

Per-business records: `businesses-<city>-<district>.json` (one entry per business, independents included, with side,
`onRoute`, `confidence`, `sign`); speed limits per way: the district's block of `speedlimits.json`. Each dossier lists
only its own locator matches, exceptions and route notes.

- **Zone**: within 60 m of a chapter route (routed on the OSM graph from the `CHAPTERS` start to the door, one-way and
  turn-restriction aware) plus recognisable businesses within 50 m of a main street (motorway…tertiary) inside the
  district mask. Standalone ATMs, parcel lockers, chargers and pure company offices are left out.
- **Confidence**: high = official locator match, or OSM `check_date` ≥ 2025-05; medium = OSM element edited or checked
  since 2023-11; low = older OSM data, or a chain store missing from its official locator.
- **Sign style** is a category rule (fuel → pylon, RO pharmacy → projecting green cross, drive-thru fast food in its own
  building → pylon, else fascia); `sign.basis` says where the colours come from.
- **Live POIs**: `tools/osm/add-pois.mjs --edge 100` appends the businesses, places and stops the build lacked (playable
  area + 100 m edge strip). Not added by rule: closed / disused / vacant objects, research-stale and research-closed
  businesses, units with `level` ≠ 0 or indoor, nodes deep inside multi-tenant halls and malls, unnamed objects, ATMs
  outside the area. Classes `poiKind()` does not keep are not POIs.
- **Romania**: OSM `brand=Garanti Bankası` (Turkish parent) is signed **Garanti BBVA**, as the Romanian branches are
  (garantibbva.ro; renamed in `tools/osm/poi-kinds.mjs`). Lukoil's international assets (Romanian stations included) were
  offered for sale in Nov 2025 (Wikipedia "Lukoil"), so that brand may change. Speed default: 50 km/h inside localities
  unless signed; the road owner may, with police approval, sign 30–80 (OUG 195/2002 art. 49, via
  [Speed limits in Romania](https://en.wikipedia.org/wiki/Speed_limits_in_Romania)); big boulevards are signed 60; no
  automatic school-zone limit ("Copii" warning signs and, where the city chose, a signed 30). Locators: mcdonalds.ro,
  kfc.ro, kaufland.ro (`.klstorefinder.json`), carrefour.ro/corporate/magazine, dona.ro/farmacii. OSM-only (no
  machine-readable locator): Mega Image, Profi, Dr.Max, HelpNet, CEC, Raiffeisen, Lidl, Penny, Catena, BT, BCR, ING,
  Orange, Vodafone, Petrom, OMV, MOL, Rompetrol, Lukoil, OTP, Alpha Bank, Digi, Telekom.
- **Washington**: RCW [46.61.400](https://app.leg.wa.gov/rcw/default.aspx?cite=46.61.400): 25 mph on city streets, 50
  on county roads, 60 on state highways unless posted; school crosswalks 20 mph when signed, 300 ft either side
  (RCW 46.61.440); Seattle's 25 mph arterial default applies only inside Seattle
  ([Bellevue speed limits](https://bellevuewa.gov/city-government/departments/transportation/safety-and-maintenance/traffic-safety/speed-limits-speed-management)).
  Locators: Starbucks store-locator API (<https://www.starbucks.com/store-locator>, `/apiproxy/v1/locations`), Bank of
  America (<https://locators.bankofamerica.com/wa/bellevue/>). Not machine-readable: Chase, U.S. Bank, Walgreens, CVS,
  McDonald's US, Trader Joe's, QFC.
