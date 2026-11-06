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

## Acceptance
- [ ] Exit/enter works in every district; can't fall through the world; can't get stuck (R reset on foot → nearest sidewalk).
- [ ] Harness scenario `foot`: exit, walk 200 m along sidewalks, cross at a zebra, enter an office, return, drive away — no issues.

## Requests
## Progress log
