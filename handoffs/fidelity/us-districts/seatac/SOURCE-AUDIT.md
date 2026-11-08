# SeaTac source world

Dataset production commit `8c1d04a`; immutable combined source `a9f77967c37fdf004ebd154609ec3b2f6cd013e9`. These records cover the exact configured core and the analytic 600 m ring, using whole intersecting footprints. They are source checks, not a finished visual-fidelity acceptance.

- All 1,858 eligible positive-area source building bodies match identity and topology: 169 core (including two multipolygon bodies), 1,689 ring (including eight multipolygon bodies). Maximum boundary discrepancy is 0.00007 m from serialized coordinate precision. Every mapped courtyard remains.
- All 732 physical road rows preserve original node coordinates, identities and tags, including 145 restricted physical rows and 91 short source ways. Public driving access is filtered separately; airfield runways are not public driving roads. The current road audit covers core road rows; a separate extended scenery-order audit is pending.
- All 210 compiled POIs match an original OSM element or explicitly documented official locator within 0.08 m of quantized output. This includes both fuel POIs and 20 transit POIs. No location or business attributes come from Street View.
- The aerial survey measured 2,215 eligible roof footprints, inspected 80 calibration crops, and retained independently reliable roof colour separately from uncertain shape. Esri acquisition date is unknown. Small gray/brown pitched roofs and complex terminal roofs retain stated uncertainty.
- The final source ring retains 10,888 measured crown positions plus 227 OSM trees. Another 2,524 measured crowns are outside the required district scope; 532 duplicate/invalid geometry samples are rejected. No budget thinning applies. Crown height remains a radius-derived estimate.

`building-source-audit.json` contains every source body. `road-source-audit.json` compares compiled coordinates with raw OSM XML. `poi-source-audit.json` independently reconstructs source POI locations, names and brands. `source-summary.json` records dataset hash, native height provenance and outstanding acceptance gates. Reference imagery remains outside git.

Visual driving, actual controls, full Street View image comparisons, atlas coverage and mirror/traffic budgets are still being completed. Raw retained building-road conflicts must be classified by mapped layer, passage, access and independently measured width; geometry must not be moved or deleted to make those detections disappear.
