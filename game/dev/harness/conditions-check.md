# Conditions, travel and Continue regression

Run the focused browser check from the repository root:

```sh
node game/dev/harness/conditions-check.cjs --controls --out=/tmp/dmcv-conditions-check
```

It requires Playwright and its Chromium browser. `--only-controls` runs just the mirror/light checks in one district. This managed workspace uses the installed system browser with:

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
  node game/dev/harness/conditions-check.cjs --controls --out=/workspace/reality-pass/conditions-qa/verified
```

The tool starts its own static server, mutes audio and isolates its two fixtures in fresh browser contexts. A reload keeps that fixture's IndexedDB and localStorage so the visible Continue button restores a real saved session. It exits nonzero for any failed assertion or fixture and writes `report.json` plus screenshots. `--controls` also checks the cockpit mirror and driving/on-foot L behavior.

The checks cover:

- Real Esc → Settings → Time, weather & season clicks while driving and on foot; K and Esc open/close behavior; active time, weather and season buttons in story and free roam. A hit test ensures the Golden hour button receives the pointer.
- Title Night/rain into `startFreeRoam`, and title Sunset/snow into the world-map jump. District changes preserve named Golden hour/Night choices and numeric local 21:15 through Bucharest/Seattle time zones; live time/weather and automatic season remain distinct.
- Same- and different-district chapter entry; same-district and cross-city Resume story; story and free-roam Continue after reload, including persistent Settings options and Winter.
- Positive fuel and an empty tank survive Continue; negative, NaN and infinite fuel values are ignored.
- With `--controls`, the mirror stays attached to the rig in the driver's view, remains hidden through on-foot `place`/`updateRig` calls and a requested mirror draw, and produces no mirror-camera render on foot. Medium graphics supplies the visible-mirror positive control. Driving L toggles headlights and produces its feedback blip; on-foot L leaves headlights and honks unchanged and adds no key-fob sound/light flash beyond an idle frame's normal parked hazards. Audio/light observers forward every call to the original method.

The wall clock is fixed at 2026-11-08 10:00 UTC to make local-hour assertions deterministic. Open-Meteo requests fail deterministically to exercise the climate fallback. Only the main game RAF is suppressed: real keyboard events are consumed by manually calling the actual `game.loop`, while native RAF and timers run montage/flight transitions. Rendering runs for captures and the mirror-render check. This is a functional/UI regression, not a frame-rate or full weather-transition visual test.

## Repair handoff, 2026-11-08

Three concrete browser failures were found and repaired:

1. Story conditions applied Winter and Noon, but the panel selected Auto and no time preset. `syncConditions()` now reads `travelConditions()` for the effective season/time selection rather than assuming `freeRoam` exists.
2. Continue replaced a saved zero-fuel tank with the chapter/free-roam minimum of 27 L. The restore guard now admits finite zero and still rejects negative/nonfinite values.
3. A hidden title-menu Achievements button intercepted the Golden hour button at 1280×720 because it explicitly enabled pointer events below an invisible overlay. The closed title menu now has `visibility: hidden`, excluding its descendants from pointer and keyboard interaction.

Initial evidence is under `/workspace/reality-pass/conditions-qa/`: `initial-story-panel.jpg`, `initial-hidden-menu-interception.jpg`, and the first run's `final/report.json`. The validated run and reviewed captures are in `verified/` (**58 passed, 0 failed, 0 page errors**). The supplemental `--only-controls` run in `controls-verified/` passes **10/10** checks, including sound/light observers. Earlier intermediate control failures were assertions against the wrong mirror parent/quality flag, against method invocation instead of an actual mirror-camera render, and against the normal idle hazard-light call; the final checks observe the real rig and renderer and compare the parked lights to an idle control frame.

The source repair owns only `syncConditions()` in `main.js`, the fuel guard in `save.js`, and the hidden title-menu rule in `style.css`. The root's separate mirror/key-fob commit is a validation dependency, with no additional mirror source changes here. World, map, cockpit, chapter and tourist-scene geometry are untouched by this repair.
