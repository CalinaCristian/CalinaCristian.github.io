# 14 — On foot (GTA-style)

Owner role: **gameplay** (`onfoot.js` new, hooks in main.js/input.js/hud.js).

The player can leave the car and walk, run and jump, GTA-style.

## Requirements
R14.1 `Enter` (+ touch button) near/at the car: exit on the driver's side (short animation: door opens, camera steps out); get back in within 3 m of the driver's door.
R14.2 First person on foot: mouse look (pointer lock / hold-right / touch drag), WASD, Shift run (2×), Space jump, crouch optional; head bob; footstep sounds by surface.
R14.3 Collisions: buildings, props, walls, vehicles (cars can bump/push you; cars yield at crossings and honk); can't walk through the parked player car.
R14.4 The car stays where parked (hazard lights), is an obstacle for traffic; traffic routes around it.
R14.5 Walk into CV offices through the door; walking nav route on the dash map/minimap (sidewalk preferred); speed-limit HUD hidden on foot.
R14.6 Reusable `OnFootController` (contract in 01) used by the office interiors and tourist spots (spec 15).
R14.7 Photo mode works on foot (spec 16).
R14.8 Car finding uses the distance chip, map/walking route, V to return and T to call the car. The on-foot L key-fob action and menu entry were removed at the owner's request (2026-11-08); L remains the driving headlight control. Cockpit meshes, including the mirror glass, remain hidden during on-foot placement, car calls and camera changes.

## Acceptance
- [ ] Exit/enter works in every district; can't fall through the world; can't get stuck (R reset on foot → nearest sidewalk).
- [ ] Harness scenario `foot`: exit, walk 200 m along sidewalks, cross at a zebra, enter an office, return, drive away — no issues.

## Current linear office story · 10 November 2026

The owner supersedes the earlier A–D conversation design: E starts/resumes the teacher/professor/manager’s fixed CV sequence; Enter, Space or a single Continue button advances it. Follow-up lines are included in order. Esc or the close button pauses; leaving early does not complete a chapter. The final Continue finishes the visit and advances the story. CV completion uses fully presented sections and preserves the existing stop/topic achievement keys and previous earned progress. Dated progress logs above describe their original historical implementations.

GTS report24 candidate: shift the virtual host from(2.2,-2.6), the rear desk boundary, to(.8,-2.8) in the central aisle. The existing host collider and story stations derive from the same theme position. Furniture and the source-bound room/window remain unchanged. Verify native clearance, approach, conversation and exit on desktop/phone before acceptance. Gameplay placement is not a claim about a real employee location.

GTS report24 acceptance: native host reach0.3m overlaps one desk before and no furniture after; all3story stations and the host collider bind to the relocated host. E opens the dialogue at desktop and390px after the visible pause button closes it. Original screenshots inspected. Mandatory foot/a0H0M1LOWsoftwareGLFPS; no ordinary physical street approach or authentic-room claim. Original evidence is published at overview/fix-gts-host/summary.json.

## UPB CV placard clearance · 11 November 2026

Report20: the shared tall-room sign formula placed the placard at4m, behind the gallery rail and vertical fins. The UPB theme now places its unchanged5.6×1.4m sign at1.5m centre height (top2.2m, below the gallery underside2.73m), .18m inward from the back wall to clear the brick finish at.145m. Other themes keep the previous placement. This is an authored CV exhibit in an estimated hall, not surveyed real-world signage. Native before/after and normal-room interaction acceptance remain required.
