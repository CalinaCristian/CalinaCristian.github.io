# Seven exceptional tourist visits and source-backed CV interiors

Owner instruction, 9 November 2026: rebuild the selected tourist visits with good graphics, convincing source-backed scenery, substantial activities and a clear map/tour flow. Iterate until the actual player experience is excellent. Keep the published overview synchronized, including its images. This is an active tracked goal; no external background goal service has been registered.

## Fixed scope

At most three visits per Bucharest, Seattle and Bellevue; seven total. One menu entry per experience. Retired visits, old saved achievements and historical evidence must not inflate current completion. Source buildings outside the focus remain geographic context rather than additional visits.

| Visit | Required experience | Current state |
| --- | --- | --- |
| Bucharest — Old Town | Compact researched Lipscani/Smârdan nightlife; dance with visible crowd/avatar and timed moves; pour/toast/drink; convincing day/night crowd and original culturally fitting club music; rebuilt Carusel with visible entry/interior; retained sports bar with official Gică Hagi highlights on repeat | Functional compact candidate in staging; source interior/entry/visual rebuild and actual access/mobile gates open |
| Bucharest — Cișmigiu | Row a complete source-backed return course; play a complete backgammon match against an older park regular; achievement for winning | Replace chess; scene visual rebuild and actual playthrough open |
| Bucharest — Arcul de Triumf | Recognizable famous arch/setting; race actual NPC opponents around a safe source-backed course; playful baguette activity with visible actions | New activities and visual rebuild open |
| Seattle — Pike Place | Recognizable market, real streets/slopes, stalls and Gum Wall; meaningful fish throwing/catching and market interactions | Severe pavement/facade/canopy failures; shared ground correction under investigation |
| Seattle — Seattle Center | One Needle/Chihuly destination; convincing elevator/observation/Loupe experience and garden; geographically grounded skyline, terrain and shoreline from elevated views | Separate Chihuly/MoPOP entries retired; scenery/ride-camera rebuild open |
| Bellevue — Meydenbauer | Convincing shore, pier, park and lake; actual kayaking with input, return and clear finish/cancel | Native route history retained; complete visual/activity rebuild open |
| Bellevue — Downtown Park | Recognizable promenade/canal/waterfall and skyline; actual NPC race around the loop | New race and scene rebuild open |

The sports room is an explicitly authored game interior. Real club addresses/opening hours need current sources; do not present an estimated interior as a survey. Club music must be original or appropriately licensed. Hagi highlights must use an official rights-holder player/embed with repeat and audio controls; non-commercial use is not a copyright exemption. Do not download/rehost an unlicensed broadcast.

## Added owner scope: offices, high school and university

Rebuild every enterable CV office interior, Liceul C. A. Rosetti and the university/Politehnica interior with the same visual-quality standard. Find actual public interior photographs for the specific institution/company and location; record source URL, identity, date when available, evidence scope and usage rights. Use verified appropriate photos directly where permission/license allows; otherwise use them as references for the modeled room and keep protected source pixels out of the repository. Do not substitute photographs from an unrelated branch, tenant or building. The setting may represent the CV period; distinguish historical and current sources.

For every window, show the actual corresponding district subsection from that building's geographic position, facade orientation and floor/eye height. Preserve real neighboring buildings, streets, foliage and occlusion/parallax rather than a generic generated skyline or a disconnected panorama. Keep unmeasured floor/interior placement explicit in the evidence.

The exterior must use the shared current weather, time of day, season, lighting, traffic and pedestrian state. Day/night and season/weather changes while inside must update the view coherently. Pause freezes it consistently; entering/leaving must not reset the district, duplicate actors or create a second independently simulated world. Respect each window's frame, glass, furniture and interior occlusion. No exterior drawn over a wall, visible under floors, or clipping at a mismatched height.

Render only the visible source-backed exterior subsection/frusta with bounded work. Reuse the live district and shared resources where possible, avoid one full-world copy/pass per window, and measure actual interior plus window-pass counters/resources. Test multiple windows, walking/parallax, looking away, repeated enter/leave and desktop/phone conditions changes. Verify outside geometry/traffic agree with the same district when the visitor exits.

Maintain a per-location photo/reference and window-anchor ledger, native visual/playthrough evidence and updated overview office/school/university records and captures. No-photo locations remain explicit gaps, never fabricated reference claims. This additional scope is open and does not count as completed because it has been added to the goal.

## Definition of an accepted visit

1. **Recognizable, coherent place.** Verify current source footprints, heights where known, road/path/water/shore geometry, landmark orientation and surroundings against appropriate references. Preserve source provenance and distinguish estimates. No placeholder skyline scatter at primary views, residential window skins on market/terminal facades, misleading signs, floating canopies, missing floors, collapsed streets, buried cameras, lamps in water or visible coplanar flicker.
2. **A worthwhile activity.** Require meaningful native input and visible response, a clear objective, an opponent or simulation where applicable, real success/failure, cancellation and a finish. Opening a panel, hearing narration, standing idle, photographing a sign or clicking through text is not the principal activity. Backgammon needs full legal play and opponent turns; races need moving opponents/course progress/timing. No automatic awards or developer teleports used as playthrough proof.
3. **Clear navigation.** One current task with a clear completion condition; map selection and custom waypoints; visible marker/direction/distance; readable full names and icon actions. Actual activity completion advances the tour exactly once. Cancel keeps an unfinished step; skip/end stay visible, work on keyboard/touch and never award skipped completion. Entering/exiting an interior preserves coherent tour state.
4. **Desktop and phone playthrough.** Start from the normal public menu/spawn. Walk to the activity, enter, play, finish, cancel and leave using ordinary controls. Check actual first-person/ride cameras and physical clearance. Inspect full-size day/night captures, important details and the complete approach, not only aerials or a best-case frame. Verify touch actions, text, focus and 44px targets at phone widths.
5. **Performance and lifecycle.** Keep the project High/full-pass targets (1.5M triangles/400 calls) under meaningful evolving activity/flight views and realistic actor populations. Check Ultra separately, including actual shader compilation. Preserve source records/crowns/actors; use bounded LOD/culling/instancing rather than thinning data. Repeated travel/flight must not accumulate resources or degrade work unboundedly. Software-rendered FPS is not proof of RTX5070 performance.
6. **Honest overview.** In the same accepted change, update affected prose, inventory, menu/activity/control/status records and every affected published screenshot/thumbnail/phone/activity image. Capture from the exact changed source, retain original dates/SHAs on historical evidence, inspect desktop/phone rendering and validate assets/links/cache. After publishing, verify actual live assets. Never relabel an old capture as current or treat a catalogue entry as quality acceptance.

The owner explicitly reiterated Ultra FPS: establish whether there is a real performance issue, including the reported progressive drone slowdown on an RTX5070. Profile matched routes/cameras/conditions and repeated flight/travel cycles; distinguish CPU, GPU, geometry/draw work, shader errors and resource growth. Record frame-time distribution and relevant resource/pass counters; use real hardware/production observations when available. Fix measured causes while preserving the requested visuals and source fidelity. A downgrade of the Ultra preset, a software-GL FPS number or a smaller scene is not by itself an adequate diagnosis or completion claim. The reproduced normal-only shader compile error now has a native compile/pixel correction in staging; actual full-scene FPS improvement remains unverified.

Fresh/incognito main-menu regression: Continue must remain hidden before a resumable story/session exists and become available for a valid saved session. The button's `.btn` display rule previously overrode its native hidden attribute. Verify fresh/valid-save/reset cases at desktop and phone sizes.

## Iteration and release rule

For each visit: reproduce the user failure → identify the actual source/render/controller cause → implement the cohesive scene/activity correction → play it natively → inspect full-size pictures and compare with references → fix remaining defects → update overview → repeat. Focus tests on meaningful behavior. Retain failed evidence and unresolved source contradictions.

Do not declare the goal complete merely because every scene loads, geometry counts match, helpers pass unit tests or the menu contains seven entries. The user-provided failures are explicit regression cases. Final acceptance requires all seven actual experiences and the shared navigation/performance/lifecycle gates. Publish tested, reviewable changes within the owner's existing authorization; avoid exposing unfinished bulk candidates as a completed rebuild.

## Ownership and integration

- Root: goal/integration, seven-entry menu/completion, maps/tours, activity registry/achievements, Hagi player, overview/release/source archives.
- Old Town lane: the complete compact night-out scene, Carusel and sports-room physical access, native club play and day/night/phone visuals.
- US lane: shared Seattle source ground/context, Pike Place, Seattle Center; coordinate Bellevue park source visuals after the shared defects.
- QA lane: finish source road joins/paint/closure proof, then complete Cișmigiu backgammon engine/opponent/table activity.
- Existing source-grade/domain/skin lanes finish their concrete shared fixes before taking individual remaining visit rebuilds; root coordinates disjoint file ownership and native browser slots.

Live preview master remains `24ceb55e546862babe36af849613cff221bb357e` until a new tested publication. Staging candidates are not live and are not accepted by association with earlier scoped checks. Original district/source/physics defects in [PLAYTEST-20261109.md](PLAYTEST-20261109.md) remain tracked alongside this primary tourist rebuild.
