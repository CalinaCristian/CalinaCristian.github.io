# Grozavesti performance investigation · 10 November 2026

Owner sample:48.125ms traffic of50.1ms visible frame,240draw calls/729710triangles,313vehicles/560pedestrians. The primary current problem is CPU simulation. WebGPU/TSL changes the rendering path and cannot remove that simulation cost.

Immutable8abd production-component profile retains311vehicles and560pedestrians for600simulation seconds/18000steps. Source/module hashes, every phase, V8 samples and scope: `/workspace/integration-qa-evidence/basarab-20261110/cpu-baseline/`. Pedestrians account for532.4s of751.4s sampled traffic time(~71%). Spatial queries, body separation and exact sidewalk heights dominate. Renderer paused; this is CPU attribution, not hardware FPS or a driven journey.

Implemented candidate root52419b4a, isolated runtime67b39084: dirty-index queries use recorded spatial cells plus every body that moved cells, with unchanged exact body/height predicates. No cap or population reduction. Exact static height cache retains4096fixed slots and removes allocated string keys.4000moving-query/full-scan contact decisions plus independent height-collision/adjacent-double controls pass; existing physical passing/recovery/relocation tests pass. Candidate600s profile completed with311/560 and0page errors. The first full-run timings overlapped native software-rendered screenshots and are not a controlled speedup. The subsequent quiet sequential comparison below supplies the bounded timing result.

Next improvements worth testing, in priority order:

1. Reuse a validated static sidewalk patch/triangle for each moving body. Evaluate its exact height while the point remains inside that same patch; crossing its boundary triggers the full query. This can remove repeated broad-phase, polygon and on-ribbon queries without rounding coordinates.
2. Stagger recovery planning and bound its per-frame queue while retaining normal physical motion. A blocked population currently produces repeated6s replan waves. Measure tail latency and actual progress around cars/closures before changing this scheduling.
3. Keep the pedestrian index incrementally consistent at safe query boundaries instead of rebuilding it after each cell-crossing actor. Preserve deterministic candidate order and include actors moved during a query; compare every contact against complete scans.
4. Profile moving-player recycling separately. Constructor/static-spawn profiles do not reproduce every reported driving hotspot. Cache immutable edge/corridor candidates, invalidate occupancy-dependent results, and measure relocation retries, heap and retained collections over the exact Basarab route.
5. After CPU fixes, consider WebGPU/TSL as an isolated renderer migration. Inventory current custom crowd/facade shaders, depth/AO, mirrors, office targets, shadows, water and fog. Keep a WebGL fallback and compare matched hardware GPU timings and appearance before choosing it.

Population thinning, lowering Ultra, hiding real geometry and quoting software-renderer FPS are not acceptance methods. Basarab normal approaches, ascent, both directions, ground exit, mirror views and same-population sustained frames remain required.

Quiet sequential control completed after all render browsers closed:180simulation seconds/5400steps each,311vehicles560people throughout,0page errors. Baseline8abd median of18batch medians38.85ms,last60s38.30ms; candidate67b median32.50ms,last60s32.00ms. Median reduction16.34%. Raw report quiet-comparison-summary.json and bothquiet-*directories retain scope and exact hashes. This is fixed-spawn component CPU; complete driven-route/hardware and published acceptance remain open.


Additional candidate under measurement: conservative cached road-segment AABBs skip distant strips before the unchanged pedestrian projection/hypot/asymmetric-width/deepest-contact predicate.16,000native-source queries match the retained predicate in district and legacy modes; native physical motion/recovery and4,000peer decisions pass. Current67b V8 self-time includes about36.5s in roadAt across its sampled invocations, motivating this bounded change. No measured speedup is claimed yet.

Mandatory immutable67b foot/a run completed:0HIGH/0MEDIUM, traffic-update8.9ms LOW and software-GL FPS LOW. Immutable1816a467(CPU plus elevated-view light coverage) foot/a also0HIGH/0MEDIUM, one software-GL FPS LOW. These legacy scenarios do not certify the complete Basarab journey. Raw basarab-20261110/logic-candidate and night-viewer-20261110/logic-candidate retain served file hashes and reports.
