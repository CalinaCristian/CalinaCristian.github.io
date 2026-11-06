# 17 — Cockpit, in-car screen, mirror, HUD, text

Owner role: **cockpit-ui** (vehicles.js, office.js, flight.js, canvasText.js, style.css); HUD logic in hud.js by **gameplay**.

## Owner findings
- The in-car map screen is intersected by the dashboard and cut by the bottom of the view.
- Office lobby sign subtitle was clipped — quick fix shipped; generalize.
- Mirror shows odd content in Seattle; steering wheel direction (fixed); look-back cabin (fixed).

## Requirements
R17.1 Centre nav screen in a proper housing on the console: fully visible and unoccluded at FOV 72–86 and aspect 16:9, 16:10, 21:9, phone landscape; tilted to the driver; instrument cluster readable behind the wheel.
R17.2 Mirror camera excludes all cockpit/cabin layers; correct position and frame.
R17.3 `fitText()` helper used by every canvas text (office signs, station screens, gauges, taxi/brand signs, flight captions); nothing ever overflows; log any text needing > 2 lines.
R17.4 No sky gaps through the dash/doors at wide FOV or when looking ±150°; thin pillars.
R17.5 HUD (DOM): no overlapping elements, nothing off-screen at 16:9/21:9/phone; touch controls don't cover the nav screen.

## Acceptance
- [ ] Visual QA cockpit detectors: screen fully in frustum and unoccluded at all four viewports; 0 canvas text overflows; 0 HUD overlaps.
- [ ] Screenshots per viewport in the log.

## Requests
## Progress log
