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
### → gameplay (`player.js`): put the rear-view mirror where the cockpit says (R17.2)
The mirror glass currently floats 36 cm *outside* the windshield (rig z −1.5 at y 1.68; the glass is at z −1.14 there) and its camera sits off-centre at x 0.3. The cockpit now exports the mount (and draws the stalk + foot to it). In `Player` constructor, right after `this.rig.add(this.mirror);`:
```js
const mm = this.cockpit.userData.mirrorMount;
if (mm) {
    this.mirror.position.copy(mm.position); this.mirror.quaternion.copy(mm.quaternion); this.mirror.scale.set(mm.width / 0.33, mm.height / 0.11, 1);
    this.mirrorCam.position.copy(mm.camPosition); this.mirrorCam.rotation.copy(mm.camRotation); this.mirrorCam.fov = mm.camFov; this.mirrorCam.updateProjectionMatrix();
}
```
(The mirror camera already renders layer 0 only; every cockpit mesh is now on layer 1, so it can never see the car.)
### → gameplay (`main.js` line ~108) + render (verify): main camera near plane 0.4 → 0.2 (R17.4)
`this.camera = new THREE.PerspectiveCamera(72, 1, 0.2, 5000);` The driver's eye is only 0.47 m from the door trim; with near = 0.4 the near plane cuts the door / roof at the edges of wide views, so the outside shows through below the belt line (gap test: up to 9.7 % of the frame at 21:9 straight ahead, 5.9 % looking around). With 0.2: 0 gaps in 400 views. Render role: please check distant z-fighting (roads/markings) at 0.2.
### → gameplay (`hud.js`) — nothing required; HUD layout changes are CSS only (street name moved to the top centre, ticker kept left of the nav screen, compact HUD + 3×2 touch pad on short landscape screens).
## Progress log
