# Integrated native conditions and office controls

Runtime base **9afb80e**, immutable local snapshot f7124b0 (the added commits only bound QA navigation). This is UI/control proof; the final rebuilt district datasets still need mandatory, population/render and memory acceptance. The source manifest records tested UI/runtime file hashes and all eight dataset hashes. Reuse after a source-only rebuild requires the relevant UI/runtime hashes to match.

`conditions-check.cjs --controls` passes **124/124**, with **zero page errors**. Actual keyboard, pointer and touchscreen controls exercise:

- Title Settings, focus/close behavior, independent time/weather/season highlights and no pre-world weather request.
- Live clearing numeric offsets and fixed looks, correct destination-local sun and traffic time, and correct Winter/Auto highlights.
- Story, free roam, direct district and cross-city travel, same/different chapter entry, and Resume story preserving selected conditions.
- Actual saved-session reload/Continue preserving positive and zero fuel and Settings options; negative, NaN and infinite fuel values remain rejected. Saved conditions take precedence over new title picks.
- K in the car and on foot, both 390×844 and 844×390 touch layouts, scrollable panel bounds and native close taps.
- Driving L changes headlights and emits its feedback; walking L leaves lights/honks unchanged and adds no flash/sound beyond an idle hazard frame. On-foot place/updateRig and an explicit mirror request retain zero mirror-camera renders; driving supplies the visible-mirror positive control.

The clock is deterministically fixed at 2026-11-08 10:00 UTC. Only the main game RAF is manually stepped after native keys; cutscene RAF/timers remain native. Normal world draws are suppressed between actual captures. These screenshots can precede the next body's modal-control synchronization frame, so they are not proof that underlying HUD controls disappear; the final continuously running native mobile UI check owns that case. The independent tourist owner separately proves destination-local conditions and activity cancellation across actual spot scenes.

`office-touch-check.cjs` passes **32/32 office/viewport cases**, with **104 dialogue taps**, all 32 Bye closures, **zero blocked hit points**, no accidental Achievements opening and **zero page errors**. Every one of four fresh phone contexts first opens and closes the actual title Achievements panel; all eight offices then complete through native touch. Viewports: 390×844, 844×390, 440×756 and 956×352. Nine interior hit points per dialogue target check that the closed title panel cannot intercept taps.

The office fixture owns state and disables RAF, so it proves DOM/input/dialogue behavior rather than office 3D rendering or general game-loop modal behavior. A first successful run captured after Bye and therefore mostly showed the closed panel; that raw run remains local at `/workspace/integration-qa-evidence/office-9afb`. The corrected helper waits for visible panel opacity before tapping and captures the dialogue before closing. It passes the same 32 cases, with the same 104 dialogue taps. Portrait and landscape visible-panel captures were reviewed. Conditions title, phone landscape, Continue and on-foot footer captures were also reviewed.

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
  node SNAPSHOT/game/dev/harness/conditions-check.cjs --controls --out=/tmp/conditions
node game/dev/harness/office-touch-check.cjs --root=SNAPSHOT --out=/tmp/offices
node handoffs/fidelity/integration-native-controls/verify.cjs
```

All browser launches are muted. Chromium/SwiftShader and phone touch emulation are not physical iPhone or hardware FPS evidence. Raw reports are retained losslessly in `proof/`; source imagery and provider credentials are absent. Root owns README/spec consolidation and release.
