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
- [x] Visual QA cockpit detectors: screen fully in frustum and unoccluded at all four viewports; 0 canvas text overflows; 0 HUD overlaps. (raycast + DOM-rect checks in the log; HUD-overlap re-run pending after the last CSS tweak for Seattle/touch)
- [x] Screenshots per viewport in the log.

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
- **2026-11-06 22:20 UTC — cockpit-ui.** R17.1–R17.4 implemented, R17.5 CSS part done (`vehicles.js`, `canvasText.js` new, `office.js`, `flight.js`, `style.css`).
  - **Dashboard redesign (R17.1)**: parts laid out by viewing angle from the driver eye (−0.3, 1.36, −0.45): cluster pod (binnacle with visor) at 20.6° below the horizon, read *over* a lowered wheel (rim top 27.5°, centre (−0.3, 0.89, −0.945)); nav screen 0.34×0.2125 m (same 1.6 aspect as the CarScreen canvas) at az 27°, el 20.5°, 0.86 m, turned + tilted to face the eye, in a glossy bezel + back shell on a centre stack (vents, hazard, climate panel) aligned with its yaw; console moved to the car centre (x 0.03). Everything sits below the windshield's bottom edge in screen space (rain overlay never draws over it).
  - **Raycast check** (camera → 9×9 grid on the screen and on the cluster, all cockpit meshes, all layers): screen 0/81 occluded, 0/81 off-screen at FOV 72/79/86 × 1280×720, 1920×1200, 2560×1080, 844×390 (bench) and in the real game (Bucharest + Seattle, day/night). Screen NDC at FOV 72: x 0.16–0.69, y −0.354 to −0.876 (bottom margin 6 % of the half-height). Cluster 0/81 occluded, NDC y −0.41 to −0.64. Same results in game.
  - **Mirror (R17.2)**: every visible cockpit mesh (interior, rear cabin, trunk, hood, wheel, cluster, screen, wipers) is on layer 1 → the mirror camera (layer 0) renders 0 px of the car (bench `mirrorOnly` = 0). `userData.mirrorMount` gives the right place (glass 4 cm behind the windshield at (0, 1.655, −1.125), 0.27×0.09, faces the eye; camera centred under the roof at (0, 1.52, 0.9), FOV 30). Stalk + foot drawn to it. Needs the player.js lines in *Requests*. The Seattle "grid of window frames" is the SeaTac terminal / garage facade behind the spawn (real content, `game_seattle_day_1280x720_*.png`), not cabin geometry.
  - **fitText (R17.3)**: `canvasText.js` `fitText/drawFitText/fitTextLog`; used by the lobby sign (company ≤ 2 lines, subtitle ≤ 2 lines), station screens (≤ 3 lines), exit mat, gauges (ticks, labels, digital speed, unit, FUEL), taxi sign (own canvas now), flight airport labels, photo postcards. `auditOfficeTexts(STOPS)` (office.js export): all 10 stops / 30 station titles fit, max 2 lines (Rosetti subtitle 2 lines @44 px, DB company 2 lines @60 px…), 0 need > 2 lines, 0 overflow; a stress text (100+ chars) also stays inside.
  - **Gaps (R17.4)**: render test with the cockpit alone on magenta + glass apertures scaled ×6 about the eye (same solid angle, beyond the near plane), 400 views (yaw −150…150 step 15, pitch −40…40, FOV 72/86, 16:9 + 21:9): with camera near = 0.2 → max 0.02 % (1-px aperture seams); with today's near = 0.4 the driver door / roof get cut by the near plane at the frame edges (up to 9.7 % → 5.9 % after the added door/roof skins) → **near 0.2 requested** (Requests). Added: firewall, door pockets, driver door skin at x −0.985, roof skin y 2.12, roof-edge skins, header cap, C-pillar trims to the body side. A-pillars 0.05×0.034 (were 0.06×0.045). Cockpit triangles 2376 (< 8k).
  - **HUD CSS (R17.5, part)**: street name → top centre (bottom centre is the 3D cluster); facts ticker right edge at 55 % (left of the nav screen at every aspect/FOV); bottom-right block max 220 px wide; touch pad right = 3×2 grid; compact HUD for short landscape screens (≤ 520 px tall). HUD-over-screen check (DOM rects vs projected screen rect) in game: none at 1280×720, 1920×1200, 2560×1080, 844×390 (Bucharest day).
  - Evidence (scratchpad `ck/`): `game_bucharest_day_{1280x720,1920x1200,2560x1080,844x390}_{hud,nohud}.png`, `game_bucharest_night_touch_{844x390,1920x1200}_*.png`, `game_seattle_day_1280x720_*.png`, bench `b_*.png`, `texts.png`, `gaps_0.4.txt`, `gaps_0.2.txt`. In-game shots were taken with the requested player.js/main.js changes applied at runtime (`PATCH=1`).
