# Shared source tram grade candidate — physical gate OPEN

Base `a294fff1`; isolated branch `fidelity/rail-bridge-model`. Root authorized the helper and narrow `world.js` hooks. US owns Traffic/tram-path integration (`world.tramGrade` callback); global README/specs remain root-owned. No browser was started in this lane.

The candidate computes source-connected grade once and shares it between rendering, Traffic and passive physical deck bands. Source data arrays/IDs/XY are untouched. Source relative layers restrict reviewed associations; they are never converted into metres. A literal `ele`/`incline`, changed layer/structure, missing ground anchor, incompatible station profile or impossible smooth ramp refuses the model.

## Explicit MODEL assumptions

- Lower Grozăvești tracks `w128304859`/`w660918286`: zero displacement, verified against exact lower motor sources `w128304847`/`w128304855`. The source bridge identity is `w902056192`. Never use the upper Basarab deck above them.
- Basarab central tracks `w118416425`/`w205971103`: an independent rail deck rises from an estimated6m southern bridge entry toward the verified modeled cable-station11m profile. Original stop nodes5865238769/1775175278 each bracket `w668700429` and `w23770172`, both actually11m in the immutable native export. The independently varying intermediate motor profiles are not averaged across the central tracks.
- Preserve existing flat ground branches at source-node forks6187776680/981543139 (`w660918283`/`w660918281`), supported by the connected explicit ground reference nodes6233585073/6233585074 on `w665700250`. The forks' zero datum is a preserved local MODEL choice, not an OSM metre tag. Raising those branches toforce a flat11m bridge was rejected.
- South source-connected ramps are95.464m/96.730m in native quantized XY; north ramps167.857m/172.511m to source nodes6262162593/6262162594 on actually rendered flat ground scenery source `w23554680`. Quadratic20m derivative eases at each end keep the approaches C1 and below8%. The source bridge's6→11m smoothstep ends with zero derivative at the cable station. Bridge maximum grade is0.861%; maximum approach grade7.951%.
- Deck half-width1.7m and thickness0.4m are explicit visual/physical estimates along unchanged mapped rail centre lines. They are not new OSM footprints. Original ballast base0.2m, rail heads0.276m and actor base0.24m remain distinct offsets over the shared displacement. The passive slab band exactly evaluates that displacement; rendered chords differ by at most1.087mm in the CPU sample control.

`world.js` adds the profile resolver, regrades the existing track runs without changing their XY/membership, batches the estimated slabs with existing cell solids, and registers matching passive deck polygons in the existing deck grid/collision list. Existing roads retain their geometry/heights. Mitered source-path offsets join adjacent slab pieces at source vertices and source-way boundaries. Per-world stats expose every model assumption/unresolved model plus deck-piece/triangle work.

## What passes

`controls-metric-guard.json` is a CPU replay of QA's exact6cb native export (`a1dcca3b1a573028b7f659787b2c7db34dd874b0a28b6697d34593be6f417bb3`):211/211 modeled segments admitted, all54 source bridge segments known, zero shared-source-node grade seams,66,066 finite height samples, maximum slope0.0795084 and maximum render-chord error0.00108666m. Changed literal source elevation, incompatible station and non-ground north-source controls reject. Native data and edge inputs remain byte-equivalent after the helper. Syntax checks pass.

This is source/model consistency, not native motion/render/support/budget acceptance.

## Blocking physical counterexample

The independent central grade intersects existing native motor-carriageway geometry. This remains a material OPEN gate; do not label the candidate ready.

`actual-body-intersections-metric-guard.json` uses actual native `Traffic.ensureRoute/placeOnLane`, both literal emitted tram meshes (27m V3A and36m Imperio,2.4m wide, full pantograph to5.79m), and their actual pitch/heading/parent transform. Triangle/triangle intersection against QA's immutable emitted `road`/`solid` context finds at least30 contacts in each of four retained poses:

- Reverse source `w205971103`, segment20, t0.843137: source centre(582.5765,−854.8569), floor10.456688m. Native `w1552024282` road surface is11.24m. V3A body triangle0 crosses actual road triangle95 in `road 1,-2` at(570.5866,11.24,−848.9034).
- Segment27, t0.818182: source centre(359.7727,−723.0455), floor8.405737m. Native `w1552024280` surface is9.892549m. The actual body also intersects `solid 0,-2` underside/fascia triangle12109.

The preceding unledgered first replay remains unchanged as `actual-body-intersections.json`; the new replay records all consumed source hashes. Both are positive physical counterexamples, not full-scene negative tests. QA's dump excludes circles/non-polygon props and some non-context meshes.

Pipera's independent source-width audit confirms two mapped motor lanes without literal width/placement on the relevant right-side road sources. Shrinking or shifting those roads tohide the contacts is unsupported. Root/Pipera are resolving the common physical support/profile conflict; existing motor heights have not been rewritten here. The verified lower river water datum is itself a−4.4m MODEL estimate, not hydrological survey data. A complete native before/after render, support/clearance replay, actual moving trams and full400-call/1.5M-triangle counts remain pending.

## Reproduce

```sh
node tools/osm/tram-grade-check.mjs /workspace/integration-qa-evidence/groz-support-6cb-native/native-support.json
node handoffs/fidelity/us-districts/rail-bridge-model/actual-body-check.mjs \
  /workspace/integration-qa-evidence/groz-support-6cb-native/native-support.json \
  /workspace/fidelity-workers/remaining-us-districts \
  /workspace/fidelity-workers/rail-bridge-model /tmp/actual-tram-body-check.json
```

QA's portable native source proof is commit `fabe253236781261dde4b706a0b9be809ecf96aa`, `handoffs/fidelity/tram-native-support-6cb/`. Source/engineering research is separately retained on `fidelity/rail-bridge-grade` (`ac8e96c1`, `e559642e`); it contains no published reference imagery.
