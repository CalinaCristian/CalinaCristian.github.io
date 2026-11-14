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
