# Pipera: complete current-source atlas

Fresh **133/133** game frames from immutable integrated source
`c78a5f4c522723fb2f4e640999e3ac5d164fc724`, captured
2026-11-08 22:59:17–23:17:43 UTC. All 133 images and 133 thumbnails are in
`game/overview/comparison-data/pipera/`. The global catalogue and inventory are
left for root integration.

Coverage is **38 core-touching / 91 ring-touching / four distant context**
250 m squares. The 600 m source ring uses the exact analytic district boundary;
partially intersecting tiles also contain land beyond that boundary. Every
current frame retains its actual source SHA and capture time. No prior capture
is used as a current frame.

All 133 planned square/north-up poses pass, with 133 unique image hashes,
266 verified image/thumbnail hashes, zero page/console/request errors and
**2,580 unchanged served files**. The maximum coordinate round-trip difference
is `3.5925040720030665e-10` m. Cameras are 640×640, high quality, summer,
clear daytime, at 216.506350946 m above the local ground. Moving traffic and
mirrors are disabled for these aerials. Separate world-only maxima are
504,164 triangles and 131 calls; these do not establish driving performance or
hardware FPS.

All **133 matched game/aerial pairs** were manually inspected across 17 private
sheets. The first 120 were reviewed during capture; their 15 preview sheets
are byte-identical to the final sheets. Reference coverage is 100% for every
square, with image/source hashes in `paired-source-ledger.json`. Esri imagery
was accessed 2026-11-08; acquisition dates remain unknown. Reference images and
paired sheets remain private, outside the checkout.

The review is complete **with modelling limits**. The public `review.json`
lists actual affected frame IDs: industrial/rail yard detail, roof equipment,
panel/atrium detail, scrub/gardens, bank structures, docks and occupancy remain
generalized. Some source-backed structures differ from undated construction
imagery. Water appearance is not a bathymetry or water-quality measurement.
The four outside-ring context views are deliberately sparse. Source conflicts
on w27750597/w176791388 and w176792203 remain unresolved; this atlas does not
invent road directions, widths, shifted roads or removed buildings to clear them.

Source checks on the same snapshot pass:

- **2,283/2,283** raw source identities, no missing bodies or literal positive
  height/minimum mismatches. All **2,283 outer rings and seven inner rings**
  match raw OSM vertices at the existing 0.1 mm serialization precision.
- **894/894** pitched roof coverage checks, four source assemblies and 15
  physical union surfaces pass; 73 explicit heights and nine mapped parts retain
  their source values.
- 387 core road rows / 1,048 scenery pieces; all **1,232 required visible source
  ways / 6,089 required vertices** retained. No missing whole ways or path issues.
- All 23 museum aircraft identities remain present; vertical dimensions retain
  their recorded estimates.

`prior-capture-retention.json` verifies the original **20-frame d9a4e19** and
**11-frame 080b185** incomplete attempts, plus the earlier 133-frame 36bd4a8
collection, are untouched at their original private paths. Incomplete attempts
are not presented as complete historical public collections. An earlier
geometry-check invocation with unsupported space-form flags is retained under
`superseded/`; its default Romană output is excluded from Pipera acceptance.

`tool-provenance.json` records the immutable tools, external capture preload,
audit commands and hashes. The preload adds bounded waits and compositor
screenshots without changing served source or requesting an extra game draw.
`complete-coverage.json`, the compressed raw source audit, exact-footprint and
road/roof reports, paired source ledger and installed-delivery hashes are the
portable acceptance evidence.

Seven public navigation anchors come directly from the frozen chapter starts
and landmark anchors. They select existing atlas squares and add no camera poses.
The source capture manifest is preserved separately from the enriched viewer
manifest. No reference imagery, catalogue/global documentation, source data or
runtime code is changed by this delivery.
