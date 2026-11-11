# 16 — Photo mode

Owner role: **cockpit-ui** (`photo.js`, styles); hook lines in main.js by **gameplay**.

A button pulls out a camera with a viewfinder frame; taking a picture captures the framed area and saves it on the player's device.

## Requirements
R16.1 `P` (+ touch button) opens a camera: HUD hides, viewfinder overlay (frame, corner brackets, focus box, rule-of-thirds toggle, ISO/shutter/zoom readouts, place + city + local date/time, REC-style dot). Works in the car, on foot and in tourist spots.
R16.2 Aim with mouse/touch, zoom with wheel/pinch (FOV 20–90°), filters (none / warm / B&W / film).
R16.3 Shutter (`Space`/click/tap): sound, flash, polaroid print animation; capture the rendered frame cropped to the viewfinder (render + read in the same task, or render target + readPixels).
R16.4 Compose a framed postcard (polaroid border, caption "Șoseaua Kiseleff · București · 6 Nov 2026 · 14:32", small cristiancalina.com watermark) and keep it in the gallery (in-viewfinder strip + the persistent photo gallery); nothing is downloaded automatically (owner, 2026-11-08): the player saves from the print card (⬇ Save / Share…) or from the gallery — `navigator.share({files})` on mobile when available, else download `drive-my-cv-<place>-<timestamp>.jpg`. Nothing is uploaded.
R16.5 In-session gallery of the last 12 shots; tourist-spot postcard challenges mark completion.
R16.6 Telemetry `photo_taken {city, place, filter}`.

## Acceptance
- [x] JPEG blob > 50 KB produced in Playwright; saved via download on desktop; share sheet path on mobile emulation. (182 KB desktop download; share called with the file on mobile emulation)
- [x] Viewfinder layout correct at 16:9, 21:9, phone landscape/portrait. (screenshots in the log; awaiting main.js hook for in-game QA)
