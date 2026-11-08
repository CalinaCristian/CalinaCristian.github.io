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

## Requests
### → gameplay (`main.js`): construct the photo mode (≈8 lines). Nothing per-frame is needed: PhotoMode listens to `P` itself (when `canOpen()`), owns the keyboard while active (the car brakes to a stop via `input.touch.brake`), owns `camera.fov` while active, and grabs the frame in the animation frame after the game rendered it.
```js
import { PhotoMode } from './photo.js';
// constructor, once hud / input / audio / renderer / camera exist:
this.photo = new PhotoMode({
    renderer: this.renderer, getScene: () => (this.state === 'office' ? this.office?.scene : this.scene), getCamera: () => this.camera,
    hud: this.hud, audio: this.audio, input: this.input,
    canOpen: () => (this.state === 'drive' || this.state === 'office') && !this.mapOpen && !this.hud.panelOpen,
    getInfo: () => ({ place: this.state === 'office' ? this.office?.stop.company : document.getElementById('street')?.textContent, city: this.city?.id, timeZone: this.clock.timeZone, night: !!this.r3d.nightLights }),
    onPhoto: (meta) => this.hud.toast('📸 Saved', `${meta.place || 'Photo'} · ${meta.filter}`),
});
// wherever the state changes away from drive/office (enterOffice, leaveOffice, fly, fastTravel, finale, on-foot enter/exit): this.photo.close();
```
Tourist spots / on-foot: pass `onPhoto(meta)` to mark postcard challenges; `getInfo` may return `{ place, sub }` (sub = a second caption line).
## Progress log
- **2026-11-06 22:40 UTC — cockpit-ui.** R16.1–R16.4 + R16.6 implemented in `game/src/photo.js` (new) + `style.css` (photo section); R16.5 gallery done, spot challenges via the `onPhoto(meta)` callback (spots wire it). Contract kept: `new PhotoMode({renderer, getScene, getCamera, hud, audio, input, …}); open(); close(); active; update(dt)` (+ optional `render`, `getInfo`, `canOpen`, `onPhoto`, `hotkey`).
  - Viewfinder: 3:2 frame with darkened surround, corner brackets, rule-of-thirds (G), focus box, blinking REC, ISO/shutter/aperture/35 mm-equivalent focal length, place · city + local date/time (city time zone), filter + zoom chip; bottom bar (filter, grid, zoom slider, shutter, gallery, close); HUD hidden (`body.photo-mode`); 📷 button on touch devices.
  - Aim: game mouse look / touch drag keep working; zoom wheel / pinch / + − / slider, FOV 20–90 (PhotoMode owns `camera.fov` while active via a property override, so the car/office FOV damping can't fight it). Filters none / warm / B&W / film (CSS preview on the canvas, matching per-pixel version in the saved file; film adds grain + vignette). While active the camera owns the keyboard (Space/Enter shoot, F, G, V, + −, P/Esc close) and the car brakes to a stop (`input.touch.brake`).
  - Shutter: two-click WebAudio sound, white flash, frame grabbed in the animation frame right after the game rendered it (or via `render()` in the same task), cropped to the viewfinder (≤ 1600 px), filtered, framed as a polaroid (caption via fitText ≤ 2 lines, cristiancalina.com watermark), JPEG q 0.9; "developing" print animation with Save / Share / Keep shooting; gallery of the last 12 (object URLs revoked). Desktop: auto-download `drive-my-cv-<place>-<YYYYMMDD-HHMMSS>.jpg`; touch + `navigator.canShare({files})`: Share button → `navigator.share({files})`. Telemetry `photo_taken {city, place, filter}` via `window.cvTelemetry`.
  - Verified (Playwright, scratchpad `ck/`): real game (hook injected as in *Requests*): P opens, wheel zoom 72 → 66.7°, F×3 = film, Space → download `drive-my-cv-calea-floreasca-20261107-002402.jpg` **182 904 bytes** (`photo_saved.jpg`), car speed 0 while active, P closes (HUD visible again, FOV handed back); office (C.A. Rosetti lobby) → `drive-my-cv-liceul-teoretic-c-a-rosetti-…jpg` 74 432 bytes (`photo_office.jpg`). Mobile emulation (hasTouch/isMobile, mocked `navigator.share`): 📷 tap → shutter tap → Share → `share({files:[1 × image/jpeg 45–56 KB]})` at 844×390 and 390×844 (1× DPR; real phones 2–3× → larger). Viewfinder screenshots: `photo_viewfinder_1280.png`, `photo_print_1280.png`, `photo_gallery_1280.png`, `pb_touch_print_844x390.png`, `pb_touch_view_390x844.png`; 2560×1080 shot 153 921 bytes.
- **2026-11-06 22:55 UTC — cockpit-ui.** Verified with gameplay's real main.js hook (no injection): Seattle, P → viewfinder active, Space → download `drive-my-cv-departures-drive-20261106-144534.jpg` 83 859 bytes (`ck/final_photo_seattle.jpg`). Print card now stays 12 s (and while hovered) so Share/Save can be tapped. Portrait (≤ 520 px wide) readout sizes reduced. Status → review.
- **2026-11-08 — owner request.** No automatic download on desktop any more: a shot is kept in the gallery ("Kept in your gallery" on the print card) and saved only with ⬇ Save / Share… on the print or from the gallery. Verified in Playwright (Floreasca): shot → 0 downloads, 1 in the in-viewfinder gallery, 1 in the persistent gallery; ⬇ Save → 1 download `drive-my-cv-bucuresti-20261108-093939.jpg`.
