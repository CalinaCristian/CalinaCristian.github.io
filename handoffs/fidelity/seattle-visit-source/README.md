# Pike ground and Seattle context repair

Candidate implementation only; native full-size before/after views and normal-input walking are still required.

On unchanged Pike source data, the old lot-settlement ownership cutoff makes points 2 cm apart differ by 5.184654 m. Near the Gum Wall the corresponding maximum is 3.389947 m. The candidate applies the settlement beneath the authored modifiers and blends overlapping corridor leg profiles continuously. In 391,851 market/approach samples the maximum 2 cm difference becomes 0.037808 m; 7,371 Gum Wall samples give 0.033585 m. These include genuine steep terrain outside the legal paved route and are not slope-acceptance claims.

The old analytic walking query differs from the emitted 2 m pavement triangles by up to 5.011488 m. Even the continuous shaping field differs by 0.958326 m at a steep transition; physical terrain support now queries the actual emitted Float32 triangles. Eight independent Three.js raycasts, including inner/outer seams and corners, agree exactly with the new accessor. Reachable solids, overhead exclusion, deep-water blocking, aircraft support, exact flat corridors, straight 8% grades and repeated settlement have focused controls.

The relevant conform/settle functions and authored Pike ground profiles are identical at prepreview `dc5339f4da79e6fb84b8f98d9e241aa352e8bdf6` and preview `0b18608b215172ed3283cf062349978084495219`: this cause predates that preview. No terrain samples, source coordinates, building records or numeric elevation anchors change.

Run `node handoffs/fidelity/seattle-visit-source/ground-audit.mjs . <new-report.json>` from this worktree. It reconstructs the unchanged prior Ground implementation directly from Git, invokes the real Pike ground setup, then stops before building rendering. It records source hashes and calculates the actual terrain diagonal independently of the new support query. It adds no runtime instrumentation.

Open work includes market facade/canopy support, actual route/step images, current overview captures, and source-backed Seattle Center skyline/shoreline/terrain rather than procedural block scatter. Historical sources and pictures remain intact. No reference-provider imagery belongs in this handoff.
