# Combined render budget and first headlight toggle

Only cherry-pick this worker's implementation commits; the branch also contains traffic, activity and lifecycle dependencies already integrated by the root agent.

- `cfa0ff7`: instance the visible taxi roof signs. Same cached geometry, materials, transforms, camera layers, 70 m eligibility and individual main/mirror frusta. No traffic, crowd, building or density changes.
- `afede87`: initialize the actual location clock/weather before the required PMREM bake. Removes the duplicate bake from the first logical frame.
- `532afab`: retain both existing player SpotLights in the shader layout and use intensity zero when off. The first native headlight toggle no longer compiles the second family of world material programs. Lamp emissive behavior, beam strengths, layers and absence of shadow maps are preserved.
- `5d5bbab`: share the resolved Auto/manual request and force it after world loading or spot return. Fixes Auto fog headlights becoming off after travel because the renderer was reset while the sent-request cache remained true.

`1a1dfc8` spreads periodic PMREM refreshes over frames: one unchanged cubeUV face or one native two-pass blur at a time, main and water sequentially. Both previous completed maps remain in use until both replacements are complete. The main map then uses the existing 1.5 s fade. The sky uniforms and water color are frozen for the entire capture. Resolution (256), mip levels, sigma, pole axes, scene geometry/materials and water pre-blur are unchanged. A capture takes 35 steps (about 0.6 s at 60 Hz or 1.2 s at 30 Hz), then the existing fade. New-scene initialization remains synchronous setup work. The adapter explicitly supports vendored Three r170; incompatible versions use native `fromScene` and require the budget gate to be rerun. Scene release, immediate replacement and renderer disposal cancel pending work and release its owned temporary resources.

## Final checks

| Case | Peak complete-frame calls | Peak complete-frame triangles | Main + water HDR values differing from native |
|---|---:|---:|---:|
| Arnia day, mirror active | 377 | 1,259,252 | 0 / 6,291,456 |
| Arnia night/rain, mirror active | 352 | 1,085,054 | 0 / 6,291,456 |
| Actual Space Needle / Seattle Center day/rain | 293 | 1,327,752 | 0 / 6,291,456 |

Automatic sun and cloud refreshes each passed at 377 calls with the actual 640-vehicle / 560-person physical pool retained. Old completed maps remained bound while pending. A quality change disposed no pending resources; actual spot replacement disposed the pending target, cloned sky material, ground geometry and block material once each. Renderer disposal during the water stage freed both pending main and water targets once each. Native fallback retained valid completed maps.

The final `foot,a` source run reports **0 high / 0 medium / 2 low** (software GL FPS and traffic-update timing under concurrent software rendering). All changed modules and helpers pass syntax checks. The taxi proof's three frozen native/batched views have exact zero pixel differences; instance cleanup and shared template survival pass. First native headlights actions create zero programs, shaders or light resources after the stable-layout fix; the pre-fix desktop/touch probes created 22/19 new programs.

[Taxi comparison](taxi-comparison.png), [night headlight beam](headlights-night.png), and [native/progressive reflection comparison](pmrem-comparison.png) contain only rendered game imagery and were visually inspected. Complete scene screenshot differences are also retained in JSON (day 2 pixels, night/rain 14, Seattle 10,146); these captures include scene/UI animation and are not asserted pixel-identical. The reflection atlases themselves match every float HDR value exactly.

The final progressive checks force the formerly expensive refresh paths; they are **not a second post-progressive 15-minute physical soak**. The root integration still owns the final whole-tree soak and cold-load acceptance.

## Evidence and reproduction

Compact source hashes, raw failure summaries, pass totals and exact comparisons are in `EVIDENCE.json`. Full raw JSON and game-generated PNGs are under `/workspace/reality-pass/combined-render-budget/` on this executor. These are software Chromium/SwiftShader checks, not physical phone FPS measurements.

Run from an immutable source snapshot. All browser launches are muted. `CHROMIUM_PATH` can select a Chromium executable; the helpers otherwise use system Chromium when available.

```sh
node game/dev/harness/render-budget.cjs ROOT OUT 15 day
node game/dev/harness/taxi-signs-check.cjs ROOT OUT
node game/dev/harness/headlights-check.cjs ROOT OUT keyboard high
node game/dev/harness/headlights-check.cjs ROOT OUT touch auto
node game/dev/harness/pmrem-check.cjs ROOT OUT
# PMREM_CASE can select arnia-day, arnia-night-rain, seattle-center-day-rain, or resources-only.
npm run harness -- --scenario=foot,a --city=bucharest
```

`render-budget.cjs` runs the real Arnia chapter spawn, full high quality, actual rear-view mirror, 640 vehicles and 560 identical crowd members. It advances the unchanged physical traffic at 30 Hz for 15 minutes, sampling 0/5/10/15 minutes. Every complete frame includes main, mirror, shadow and post draws. Scene-load setup and the raw accumulated `r.info`/stats are preserved separately; the helper never resets counters inside a logical frame. `chapter` uses the actual current local clock/weather, while `day` or `night` selects the clock before scene initialization.

`taxi-signs-check.cjs` compares native source signs with instancing at three real cameras (including night and the mirror), freezing the physical state. It checks exact visible matrices/counts/materials/triangle totals and pixels, then loads another actual district to verify instance-buffer disposal and cached template survival.

`headlights-check.cjs` uses native keyboard L or native touch pause/headlights actions. It records program/shader creation, texture/framebuffer/renderbuffer allocations, long tasks, event-loop gaps, context loss, cold startup and repeat toggles. Extended cases verify day/night off/on, Auto clear/fog, actual district travel and native settings changes. Wall times from software GL and Playwright touch actionability are diagnostic, not hardware latency claims.

`pmrem-check.cjs` compares every float HDR value in both completed atlases against synchronous native `fromScene`. It measures actual complete high-quality frames for all six main cube faces plus representative main blur, water face, water blur and publication stages in Arnia day, Arnia night/rain and Seattle Center day/rain. Other blur steps are explicitly labeled isolated reference bake work, retained with raw counters and not presented as complete-frame measurements. It also forces the automatic sun/cloud refresh conditions, checks that old maps remain bound while work is pending, exercises quality changes and actual scene replacement, cancels work during the water stage on renderer disposal, and verifies native fallback with internal APIs hidden.

## Preserved failures and limits

- Traffic-fixed baseline at 5/10/15 physical minutes exceeded the calls gate: 411/410/417, with all 640 vehicles and 560 people retained. Taxi signs alone used six material-group calls per visible taxi.
- An earlier optimized 15-minute day/shadow candidate measured 379/379/382 calls and at most 1,417,038 triangles. Independent physical evolutions differ; only the frozen camera A/B establishes exact identity of rendering.
- The full dependency-integrated pre-progressive run retained a genuine failure: at minute 15 the real sun/weather environment refresh contributed 96 additional calls, producing 441 calls / 1,176,021 triangles. Earlier steady samples were 376/344/344. The later samples omit shadow draws; those lower totals are not claimed as worst-case daylight/shadow coverage. This failure motivated the progressive refresh rather than a counter adjustment.
- Published `58129` and combined pre-fix source both recreated many programs on the first headlight toggle: desktop 22 programs / 44 shaders, touch 19 / 38. No light shadow maps, texture/framebuffer growth or context loss explained the stall. Stable-layout candidates created zero programs/shaders/light resources on those same first native actions. Initial program family counts remained 49 desktop / 32 touch; cold compilation still exists at startup.
- The first touch probe timed out because its manually owned game loop did not synchronize the standard body mode/pause-button bookkeeping. The rerun uses the actual bookkeeping and native taps. The timeout is preserved and is not reported as a product UI failure.
- The first PMREM test attempt over-warmed 30 full source frames per condition and was intentionally interrupted for excessive validation overhead; its partial native screenshot and attempt metadata remain in `pmrem-proof/`. The successor keeps the same native HDR comparison and explicit representative full-frame checks.
- The PMREM fixture also initially ignored an explicit fade time step and used a scene key instead of the selectable Space Needle place id. Those rejected/partial attempts remain recorded; the corrected probe honors the time step and asserts actual spot state/id. No renderer change was needed for either fixture correction.
- Cold new-scene PMREM/setup work is recorded separately and can exceed the active-frame gate when accumulated with the first displayed frame. It has not been erased or presented as steady work.
