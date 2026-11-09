# Basarab rail / carriageway width and support audit

This is a read-only audit of immutable native export `6cbf82b61de8267f662bf50239c37ccc1764635c`, SHA `a1dcca3b1a573028b7f659787b2c7db34dd874b0a28b6697d34593be6f417bb3`. It changes no production geometry, source, widths, grades, actors or rendering. No browser was started.

The centered 7 m carriageways are estimates. Cached raw OSM independently confirms `w1552024280`, `w1552024281` and `w1552024282` each have `lanes=2`, `oneway=yes`, `bridge=yes`, `layer=2`; none has width or placement tags. `w458458361` has the bridge/layer/oneway tags but no lane count, width or placement. Native all-edge records use 3.5 m lanes, left/right extents 3.5/3.5 m and zero shift without a width-source record. The raw rails `w118416425` and `w205971103` have bridge/layer 2/level 1, 1435 mm gauge and 750 V contact-line electrification, with no surveyed elevation. Common tags alone do not establish one shared deck height.

The existing Esri z18 mosaic covers the sites. Fresh official Esri z19 tiles were read with system TLS trust and provide about 0.213 m per pixel. z20 returned “Map data not yet available” placeholders and was excluded. Image acquisition dates are unknown. Reference imagery stays private; this folder contains measurements, source geometry, calibration and hashes only.

Manual visible asphalt-edge ranges were measured in transverse crops with the literal OSM road line at zero, positive normal to the right of travel. These are asphalt edges, with the adjacent parapet/rail strip excluded where distinguishable. Shadow, markings, curb blur and source/image registration prevent survey precision.

| Native road / reverse rail station | Central left extent | Central right extent | What it establishes |
|---|---:|---:|---|
| edge 1150, `w1552024282`; rail segment 20, t=0.843137 | 1.2–1.9 m | 4.8–5.6 m | The line appears toward the inner lane, not at the visible asphalt midpoint. |
| edge 915, `w1552024280`; rail segment 27, t=0.818182 | 2.5–3.3 m | 4.7–5.6 m | The footprint also appears asymmetric; a centered narrower strip is not justified. |

The three transects per site and exact display pixel ranges are in `reference-measurements.json`. Near the first site the left extent varies 1.2–2.2 m across the sampled interval; near the fork it varies 2.1–3.4 m. Treat local image/source registration and elevated-deck parallax as an additional approximately 0.5–1 m uncertainty, not a selected correction. No offset has been applied to any source line. These ranges are evidence for further footprint review, not approved production widths.

The grade worker's four exact **pre-100m-rise** native CPU poses were reproduced independently using `Traffic.ensureRoute/placeOnLane` and emitted fleet geometry. Their consumed grade-module hashes are retained. Every world vertex matched its independent export exactly. Their 27/36 m bodies reach the following lateral positions toward the road, including all model vertices and actual pitch:

| Rail segment | V3A 27 m | Imperio 36 m |
|---|---:|---:|
| 20 | −2.01883 m | −2.01161 m |
| 27 | −2.05012 m | −1.96138 m |

Thus a uniform left road extent would have to be below those positive magnitudes to exclude the entire emitted footprint. This is a footprint bound, not a negative triangle clearance test. It uses the nearest literal source-road segment for each vertex, including neighboring `w1552024281` where the long body spans it. The pinned pre-100m-rise model against the native geometry has at least 30 actual triangle intersections per case. Full train height reaches roughly 5.79 m above its origin; the intermediate-height ribbon in that model cannot be called an overhead passage.

The first site's measured asymmetry may explain its false road footprint overlap. The fork's central measured edge still overlaps the emitted body by roughly 0.45–1.34 m before registration uncertainty. **Measured widths alone do not certify both intervals.** Use source-backed physical asphalt/deck extents, then rerun the actual full-body/support test. Where a real footprint conflict remains, associate the physical support before fitting a local grade. Do not force a passing width, move source ways, infer a shared height from layer tags, or tie every nearby viaduct to the same deck.

While this audit was being packaged, the grade worker's later 100 m rise cleared its fork triangle tests and left a north guardrail intersection. That is a separate model and pose; the old vertex arrays here remain historical evidence. Asphalt-edge measurements are not guardrail measurements: the visible north parapet/strip is further toward the rail than the asphalt edge, roughly 0.5–1 m. Do not automatically move a barrier to the measured asphalt edge to make clearance pass. A separate barrier-band/registration and current-body check is still needed.

Reproduce the numeric audit from this folder:

```sh
python analyze.py /tmp/new-rail-width-report.json
python calibrate.py /workspace/reality-pass/pipera-rail-width-audit /tmp/new-private-reference-crops
```

The reference command requires the pinned private `north19.jpg` and `fork19.jpg`; it refuses image output inside the checkout. Official tile URLs and hashes are recorded, so a different future provider image cannot silently replace the measured source. `fixtures/raw-osm.json` retains the six raw way records and contributing tile hashes. The compressed native subset and actual emitted body data retain source/module hashes. The grade proposal remains a model, with source and acceptance scope recorded in its own [actual-body proof](../../us-districts/rail-bridge-model/actual-body-intersections.json).
