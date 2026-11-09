# Shared source tram grade candidate

Base `a294fff1`; isolated branch `fidelity/rail-bridge-model`. Root authorized the shared helper, source-backed estimated slabs and narrow `world.js` hooks. US owns Traffic/tram-path/body fitting. Global docs remain root-owned. No browser was started in this lane. Native regenerated geometry, whole-body clearance and final performance acceptance remain open.

The resolver shares displacement between rendering, Traffic and passive physical support. Original source arrays, IDs and XY remain unchanged. Relative layer/level tags never become metres. Changed literal source elevation/incline, changed structure tags, missing source joins, incompatible station profile or infeasible smooth ramp refuse the model.

## Explicit MODEL assumptions

- Lower Grozăvești `w128304859`/`w660918286`: zero displacement, matching exact lower motor sources `w128304847`/`w128304855`; source bridge identity `w902056192`. Upper Basarab never supplies this lower slab.
- Basarab `w118416425`/`w205971103`: independent rail viaduct. Stop nodes5865238769/1775175278 each bracket actual native `w668700429`/`w23770172`, both11m. Existing intermediate motor heights remain unchanged.
- Existing flat source rail forks6187776680/981543139 remain zero, preserving branches `w660918283`/`w660918281`. Connected source ground references6233585073/6233585074 on `w665700250` justify that retained MODEL datum; no455m branch bridge is invented. South source ramps95.464/96.730m rise to estimated6m. The bridge then rises6→11m over100m and stays level through the verified cable station. North167.857/172.511m ramps return to nodes6262162593/6262162594 on actual flat source `w23554680`.
- Quadratic20m derivative eases are C1. Maximum approach7.951%, bridge rise6.25%, cap8%. This early rise replaces the retained failed slow-rise candidate after actual motor-deck clearance constraints were tested.
- Slab half-width1.7m/thickness0.4m are explicit estimates along mapped rail centres, not OSM footprint claims. Ballast base0.2m, rail head0.276m and actor base0.24m remain distinct offsets over the same displacement. Lower water datum−4.4m is an existing native MODEL, not a hydrological survey.

## Render and physical support

Slabs use existing cell solid batches and passive deck grids. Original rail membership/XY are preserved. Source path miters join at actual source vertices/way boundaries. Shared renderer/support pieces have deterministic IDs from model/sourceway/originalsegment/t0/t1. Each exports actual top vertices and exact piecewise quadratic `topProfile` coefficients for independent continuous-height replay. `world.tramDeckSupportAt(x,z,{modelId})` and `.inBox(...)` require the same model and never select a motor/upper deck.

Only generated inferred bridge guards/quay parapets are omitted where they conflict with a known source rail and its modeled fleet corridor. Mapped barrier records remain untouched. Independent source-gauge certificate `e77ca387` proves native inferred guard faces648/649 lie between the actual1435mm running rails of `w205971103`, with≥0.319m margin in precise raw source coordinates. Height overlap is verified. Existing roads/widths/heights are unchanged.

## CPU checks and retained failures

`controls-stable-support-ids.json` replays QA's immutable6cb export:211/211 segments admitted,54 bridge segments known, zero source-node seams,66,066 finite samples, maximum slope0.0795084, render chord error≤0.00108666m,444 support pieces with unique original-source IDs. Serialized quadratic heights agree with continuous bands within1e-8. Negative source/station/ground controls refuse; mapped/outer/upper barrier controls remain. Source inputs remain byte-equivalent.

Failed evidence is retained: `actual-body-intersections*.json` show old slow-rise motor-deck conflicts; `actual-body-100m-rise-*.json` show corrected road height but old inferred guards/quays; `actual-body-own-slab-counterexample.json` demonstrates a36m rigid body entering its curved slab by0.398m under centre anchoring. US's separate actual-mesh support fit addresses that issue. Old native triangles can establish positive failures, but cannot accept regenerated meshes or omitted props. Literal coverage-end body spans remain unknown rather than extrapolated.

## Reproduce

Run `node tools/osm/tram-grade-check.mjs /workspace/integration-qa-evidence/groz-support-6cb-native/native-support.json`. Actual-body replay takes nativeJSON/runtimeRoot/gradeRoot/outputJSON, with optional `--sweep`; the runtime must contain US's current actual-mesh support fit.

QA portable source proof: `fabe2532`, `handoffs/fidelity/tram-native-support-6cb/`. Separate source/engineering research: `ac8e96c1`, `e559642e` on `fidelity/rail-bridge-grade`. No reference images are published. Final native render/support/clearance/initial-pose/all-eight-mode and400-call/1.5M-triangle gates remain pending.

## Romana composition and final CPU candidate

The exact pure tunnel model7ad4181b is composed through additional source grades. World emits the matching negative floor, passive station-only roof and estimated retaining sides. Internal sides covered by another compatible same-model floor are clipped exactly, creating a shared paired-track compartment. Only open portions of estimated trench corridors are subtracted from flat render landuse/grass/pave/sport/ground surfaces; all attributes interpolate, all exterior fragments and original source polygons remain. Motor-road render surfaces are preserved. New source/model IDs and triangle work are exposed for QA.

The independent actual long-body audit found1.7m half-width too narrow (worst2.636m). Final pure-model commit904fd92d atomically estimates2.8m across floor/wall/roof/cuts. Its751 actual indexed-mesh poses clear the636 union outer wall segments, actual overhead roads and roof;19 literal boundary spans remain unknown. Minimum road-underside gap0.971806m and roof gap1.270m. Actual bodies have zero projected triangle-area overlap with the seven adjacent native car-road tubes/approaches. The widened floor itself overlaps226 car-road footprint strips0.04–3.89m below their asphalt, with zero slab/road-surface intersections; all motor surfaces remain. Fresh regenerated native geometry and final motion/support/performance acceptance remain required. `actual-body-fitted-old-context-sweep.json` independently replays US fitting against old Grozăvești geometry:804clear/104old inferred-solid contacts/14source-body-span unknown, with zero motor-road triangle contacts. The old generated triangles are intentionally retained in that diagnostic; only a fresh export can accept their emission gates.

Final composition control `controls-composed-final.json`:30 modeled original source legs,27 graded rendered legs plus6 other flat segments admitted (33 total),633 exact support pieces,84 station-roof pieces,636 union outer wall intervals, continuous-profile serialization error≤5.33e-15m. `tram-grade-compose-check.mjs` reproduces this from the immutable native constructor fixture.
