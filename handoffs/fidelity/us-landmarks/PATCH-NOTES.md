# US landmark source and model changes for root integration

Production scope: all 24 Seattle/Bellevue registry entries. Shared Builder dependency is `d90f6dc6611c4fdddb583b563b77b72235573e06`; its equivalent cherry-pick on this branch is `a3b69e2`. Integrate the new US commits only if the root already contains the shared helper.

README/spec consolidation requested from root (root owns global documentation):

- US landmark source ownership now enumerates exact OSM identities. Context-only tunnel facade, Murrow arch spans, Ferris wheel ride and mountain terrain claim no unrelated building replacements. The Great Wheel ticket office remains its own real building.
- Refreshed full source rings and raw version/tag provenance cover all 24 entries. The Needle now has its mapped base and a deep continuous top house; Smith Tower follows its mapped 114 m eaves / 27 m roof / 148 m tip; the Spheres use three individually tagged dome heights and a procedural structural frame.
- SeaTac control tower is 71 m overall. Bellevue Towers are north 137 m / south 131 m including crowns. Bellevue 600 includes the mapped low podium parts and 43-level office floor rhythm; unresolved facade details remain estimates.
- Lumen has source canopy contours, the source pitch, the north 60 m board and open bowl collision. T-Mobile includes all ten mapped 20 m lower decks with their individual skillion directions and the full curved 46–66 m roof contour. The airport garage preserves all eight lightwells in geometry and collision. The Link platform uses the published 60 ft elevation.
- The invented detached Bellevue Square bridge-landing block is removed; the actual mall footprint remains in the world. Full source concavities are used for upgraded building collision.
- Rainier and Olympics now use decimated public-domain USGS 3DEP elevations. Exact returned GeoTIFF pixel-centre extents are recorded, including ArcGIS's extent adjustment. No synthetic narrow summit is added; coarse sampling and procedural snow colour remain explicit limitations.
- Pioneer Square's Smith Tower, the shared Seattle skyline's Smith/Columbia silhouettes and both tourist mountain backdrop paths reuse the same reviewed source models. No Google/reference imagery is committed or published.
- `game/dev/landmarks.html` top views are orthographic north-up isolated studies. Capture metadata records the exact camera and ground coverage; these are never labelled matched Street View/aerial comparisons.

Meaningful checks: `node tools/landmarks/geometry-check.mjs` (all 61 model invariants), `node tools/landmarks/us-source-check.mjs` (all 24 source scopes, independently stated total heights, eight court probes, solid control, open stadium pitch and context-only replacement exclusions). Mandatory `foot,a`, visual review, source-linked individual records and captures are separate acceptance evidence, not implied by these checks.

Follow-up visual corrections: the Mount Baker facade is moved about 330 m east from an underground polygon end to the actual three highway tunnel mouths, with collision piers aligned around all three mapped approaches. Lumen's inherited 38 m upper-deck blocks are lowered clear of the source 26–36 m canopies; roof lettering conforms to the curved surface. The source `roof:colour=white` is retained despite navy in the independently viewed aerial, and that conflict remains explicit.

Final model-study inspection also corrected the registry Wheel's spoke centres (the old spokes did not radiate from the hub) and replaced red solid gondola cubes with 41 white framed glazed cabins and the dark VIP cabin. Lumen lettering now follows its published approximately 93 m / 40 m lengths. Tourist waterfront already uses its separate framed 42-cabin animated model.

Murrow follow-up: measured independent aerial rib-seat extents are approximately 70 m west / 66 m east (±3 m), supporting a shared 68 m arch estimate. Both anchors move east onto their true spans on mapped highway way123889285 (about70 m west-span shift /45 m east-span shift), and crown openings increase from three to the observed six. Height, rib thickness, finish and hanger detailing remain estimates. Numerical pixel/ground measurements are in `game/research/us-landmark-aerial-measurements.json`; no imagery is published.
