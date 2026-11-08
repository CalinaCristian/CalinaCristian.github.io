# Real Old Town venue activities

This branch starts at `65ba08d`, with secret-room dependency `02b1d2e` cherry-picked as `5708ce8`. Root already integrated that dependency: **do not cherry-pick it again**. The separate collision correction is `7de997eb3806e288395b7b11a10f58206ab78225` (root has integrated it). Root lifecycle hooks `8ed0cf3` were replayed as `6f9cb55` for actual control QA; **do not integrate that dependency again either**. Root only needs the final activity commit.

## Source identity and placement

Both venue identities, addresses and coordinates are verified against the existing measured/researched OSM records in `game/research/bucharest-spots.json` and their projected POIs in `game/data/spots/buc-old-town.json`:

| Venue | Source | Address | Lat/lon | Spot POI x/z | Host footprint |
|---|---|---|---|---|---|
| Dristor Kebap | node/1731040881 | Strada Franceză 17 | 44.4300458, 26.1002826 | 62.3, 139.4 | w657568318 |
| Shoteria | node/10775253367 | Strada Șelari 17 | 44.4301868, 26.1006161 | 88.9, 123.7 | w658248961 |

The interaction approaches are derived from each source POI's containing footprint and nearest mapped pedestrian street, at its outward-facing edge, with collision clearance. Both have a strict walk path from the actual Old Town spawn. Current approaches: Dristor `(72.4983,142.7173)` and Shoteria `(79.2781,120.7085)`. The source footprints, elevations, shop frontage meshes, furniture placement, data JSON, and ordinary crowd density are preserved. Activities use player-held props; they do not claim to reproduce a surveyed interior or outdoor counter. No Street View geometry, colours or imagery were extracted.

Existing fidelity limitation: the generic Old Town terrace pass spans the Shoteria frontage despite the POI's `outdoor_seating=no`, and its existing shop-sign selection does not show a Shoteria sign. This work retains those pre-existing frontage meshes. The activity and map identify the exact real source venue/address; generic terrace source fidelity remains district work.

## Participation and lifecycle

`game/src/spots/venue-activities.js` supplies the shared camera-held prop/hand animation and accessible action card. Dristor requires three separate bites (1.8 seconds each), visibly lifting the wrap and removing one edible section per completed bite; the paper remains. Shoteria requires a 2.2-second bottle pour (stream connected to the bottle neck and rising liquid), a separate 1.6-second raised toast, then a 2.2-second tilted drink with emptying liquid. Each step waits for another deliberate action; idling and repeated input cannot skip or queue steps. Both are repeatable.

The card has labelled action/Leave buttons, progress and polite narration, with 44-pixel minimum targets in portrait and landscape. Keyboard E is equivalent to tapping the action; Escape leaves the activity first. The walker's previous active state is restored at completion/cancel; no position snap is used. Starting ends a guided tour so its automatic movement cannot compete.

Activity completion is emitted **only after the final animation ends**, via existing `bucActivity` and progression persistence:

- `old-town-lipscani:dristor-shaorma` → `lm-dristor-shaorma` / “Poftă bună!”
- `old-town-lipscani:shoteria-shot` → `lm-shoteria-shot` / “Noroc!”

Cancelled partial activities award nothing. No stored partial progress exists. Existing progression prevents repeat achievement timestamps/rewards. Map, teleport and exit call the optional scene helper directly; update checks also cancel for photo/panel/drone/pause/distance/document-hidden. Disposing removes card, camera props, geometry/materials/textures and key/visibility listeners. The hidden Carusel WCP room, project panel and TV helpers are preserved.

## Root-owned integration and docs

Scene API: `session.spot.ctx.extras.venueActivities` with `active`, `cancel(reason)`, `dispose()`, `disposed`, plus focused-test `debug()` / `lastCancel`. All calls in core are optional, so other scenes stay compatible. Root-owned shared-mode hooks are present in dependency `8ed0cf3` and were exercised through actual controls:

1. `main.updateSpot`: cancel when photo, HUD panel, pause or drone is active; cancel before entering pause branches.
2. `main.togglePause(open=true)`: cancel **before** setting `_pauseOpen`; the paused main loop skips `updateSpot`, so the gear button requires this hook.
3. Successful drone deploy: cancel **before** the drone stores/takes the walker's previous active state.

`spots/index.js` adds the two exact ACTIVITIES entries, optional map/teleport/dispose cancel calls and an interaction guard while the activity is active; other prompts/E actions do not compete with the explicit card. The mobile-controls worker owns the generic touch interaction button in `spots/ui.js` and the corresponding main click hook; it queues the same normal E action for starting these activities.

Required global README/spec/STATUS edits (root-owned, deliberately not edited here): mention the two real venue activities and E/tap/Leave controls; document the optional scene activity lifecycle contract in spec 01; add source-backed placement, visible participation, cancellation and evidence to spec 15; add the two activity→achievement keys in spec 23 and account for +2 catalogue entries; record the separate terrace collider correction and verification. Catalogue totals should come from the integrated runtime, since other lanes may add achievements.

## Verification and reproduction

Use the prepared system Chromium preloader and `--mute-audio` (all scripts already launch muted):

```bash
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs PORT=8150 OUT=/workspace/reality-pass/lipscani-activities/with-control-hooks node game/dev/harness/lipscani-activities-check.cjs
node game/dev/harness/old-town-terraces-check.mjs
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs PORT=8147 node game/dev/harness/venue-look-check.cjs
```

Serve the checkout root on PORT (Python `http.server`), not the `game/` subdirectory. The focused browser script disables automatic RAF and steps real SpotSession updates deterministically; it opens real E interactions, uses real keyboard/button inputs for actions, and uses existing achievement/persistence code. Pause uses an actual pause-button click; map uses the host M action; photo uses real PhotoMode.open/updateSpot/close; drone uses successful real deploy/abort and verifies input substitution and restored walking. Hidden-document cancellation is tested with a deterministic visibility signal. The separate lightweight test uses real browser Input and OnFootController with a real right-mouse gesture and native Space button activation to prove that leaving does not retain look/jump input; it observes disposal events for every prop resource. Software GL results are correctness/budget evidence, not hardware FPS claims.

The collision fixture executes actual `oldTownTerraces` against full committed source, compares each generated canopy's actual mesh edge to its OBB axis, and checks street clearance, solid furniture and unchanged source id/polygons: **114/114**. Only caller: `buc-old-town.js`. Former `yaw+π/2` aligned the long OBB axis outward, blocking the street; `yaw` aligns it with the existing canopy width. Source geometry remains unchanged.

Artifacts live outside git in `/workspace/reality-pass/lipscani-activities/`: baseline JSON and before pictures, final focused results and inspected activity/mobile screenshots. The final browser run uses the immutable `candidate-hooks/` snapshot so concurrent source/doc edits cannot contaminate the served scene. The final input-queue/keyboard refinements are covered by the separate lightweight browser test against the current helper.

Final checks (2026-11-08):

- Full focused activity browser suite **passed**, including both exact source identities, both strict spawn-to-frontage walk paths, real E start, visible intermediate motion/fill, no idle/spam/partial awards, final awards, all nine cancel modes, successful actual drone takeover/abort, actual pause/map/photo paths, repeated completion without timestamp changes, persistence, disposal, 390×844 and 844×390 bounds and minimum 44px buttons, **zero page errors**. Results: `with-control-hooks/results.json`.
- Resource/input browser suite **passed**: right-mouse movement and native Space activation do not cause a camera turn or jump after leaving; actual disposal signals received for **55 geometries, 16 materials and one texture**, no retained card/camera props, zero page errors.
- Scene: **795,900 triangles**, up **1,676** from the 794,224-triangle secret-room baseline. No new pedestrians. All six captured active frames stay below **1.5M triangles / 400 calls**. Maximum captured active triangles **1,208,058**, maximum active calls **226**; measured approach frame **1,218,658 / 385**. Startup and active frames are recorded separately so one-time environment initialization is not accumulated into a later manual activity frame. These are software-renderer correctness/budget measurements, not hardware FPS claims.
- Existing `secret-bar-check.cjs` **passed**: hidden Carusel entry/path/objectives, preserved Starbucks footprint and POI, native TV play/loop/pause, no remote Dinamo goal or project award, original WCP six-preview panel/link, project-only persistence, exact return pose, video and callback disposal, zero page errors. Room frame **270,108 triangles / 45 calls**. Catalogue **115 entries, 114 active** before the first bike ride. Results: `secret-bar-regression/results.json`.
- Syntax checks pass for every changed JS module and both new browser harnesses; `git diff --check` passes; geometry/OBB fixture **114/114**.
- Actually inspected baseline `before-n1731040881.png` and `before-n10775253367.png`, plus all final captures in `with-control-hooks/`: `dristor-bite.png`, `shoteria-pour.png`, `shoteria-noroc.png`, `shoteria-drink.png`, `mobile-390.png`, `mobile-844.png`. The wrap/fillings, connected pour, raised toast, drink tilt, whole portrait prop and readable phone controls are visible. Generic frontage limitations above remain explicit.

Root still owns the final combined mandatory Bucharest foot/a regression and district-wide visual/render survey, because other lanes change those shared systems. No master or deployment change was made by this worker.
