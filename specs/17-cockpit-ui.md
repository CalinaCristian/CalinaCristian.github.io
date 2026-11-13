# 17 — Cockpit, in-car screen, mirror, HUD, text

Owner role: **cockpit-ui** (vehicles.js, office.js, flight.js, canvasText.js, style.css); HUD logic in hud.js by
**gameplay**.

## Requirements
R17.1 Centre nav screen in a proper housing on the console: fully visible and unoccluded at FOV 72–86 and aspect 16:9,
16:10, 21:9, phone landscape; tilted to the driver; instrument cluster readable behind the wheel.
R17.2 The mirror camera excludes all cockpit/cabin layers; correct position and frame. Enabling the mirror (e.g. after a
quality change) refreshes its view immediately, never showing a stale or black frame; Low keeps its mirror policy. Mirror
and display shader variants are prepared during setup.
R17.3 `fitText()` for every canvas text (office signs, station screens, gauges, taxi/brand signs, flight captions);
nothing overflows; texts needing > 2 lines are logged.
R17.4 No sky gaps through the dash/doors at wide FOV or when looking ±150°; thin pillars.
R17.5 HUD (DOM): no overlapping elements, nothing off-screen at 16:9/21:9/phone; touch controls don't cover the nav
screen.
R17.6 Instrument and navigation/media displays stay sharp at every quality tier (redrawn at bounded output resolution
with physical occlusion), including in the mirror; their work counts in the frame budget and causes no first-headlight
shader churn.
R17.7 Phone portrait: one mode-aware Map launcher and Menu at the top (weather, drone, camera and car exit through
Menu); movement / pedals and the contextual action below; a small collapsible mini-map above the left control zone; one
toast at a time. Outdoor launchers hide inside offices. World-map city tabs wrap so all five stay visible.

## Acceptance
- Visual QA cockpit detectors: screen fully in frustum and unoccluded at all four viewports; 0 canvas text overflows;
  0 HUD overlaps.
- Screenshots per viewport, portrait and landscape.
