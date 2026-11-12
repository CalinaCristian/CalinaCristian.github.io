# 17 — Cockpit, in-car screen, mirror, HUD, text

Owner role: **cockpit-ui** (vehicles.js, office.js, flight.js, canvasText.js, style.css); HUD logic in hud.js by **gameplay**.

## Requirements
R17.1 Centre nav screen in a proper housing on the console: fully visible and unoccluded at FOV 72–86 and aspect 16:9, 16:10, 21:9, phone landscape; tilted to the driver; instrument cluster readable behind the wheel.
R17.2 Mirror camera excludes all cockpit/cabin layers; correct position and frame.
On a quality transition that enables the mirror, request its existing three warm refresh frames immediately; a target left dormant on Low must not show a stale/black view while waiting for the normal cadence. This does not enable the mirror on Low or add a second rear-scene render to one frame.
Prewarm the existing Player-owned mirror target without taking ownership, and compile actual original-color/depth material variants with the current world's FogExp2 in both linear-target and sRGB presentation modes. Three's compile traverses object materials, so temporarily assign the depth reference only to private clones. Initialize the Low multisample target only on the actual Low render path; use the already-needed reference target for linear shader compilation on other tiers.
R17.3 `fitText()` helper used by every canvas text (office signs, station screens, gauges, taxi/brand signs, flight captions); nothing ever overflows; log any text needing > 2 lines.
R17.4 No sky gaps through the dash/doors at wide FOV or when looking ±150°; thin pillars.
R17.5 HUD (DOM): no overlapping elements, nothing off-screen at 16:9/21:9/phone; touch controls don't cover the nav screen.
R17.6 Instrument and navigation/media displays remain sharp on Low, Medium and Auto as well as higher tiers. Preserve world quality/adaptive resolution, physical occlusion, original geometry/camera/picking and mirror visibility policy. The same output-resolution protection applies to the mirror when enabled. Prewarm display resources and count every display/depth/presentation draw in the complete frame budget; do not introduce first-headlight shader or resource churn.

## Acceptance
- Visual QA cockpit detectors: screen fully in frustum and unoccluded at all four viewports; 0 canvas text overflows; 0 HUD overlaps.
- Screenshots per viewport.

## Portrait layout

Portrait update: retain one mode-aware Map launcher and Menu at the top; weather, drone, camera and driving car exit stay available through Menu. Keep native movement/pedals and contextual interaction below, a smaller collapsible mini-map above the left control zone, and one current toast. The Office body class follows actual room lifetime so outdoor launchers hide in rooms. Dialog close pauses the linear sequence without granting chapter completion. Native hit targets, maps, secondary actions, activities and landscape regression require verification.

Portrait World-map city tabs wrap into three columns, so all five choices remain visible instead of hiding Bellevue and World beyond an unmarked horizontal edge.
